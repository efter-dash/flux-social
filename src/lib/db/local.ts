/**
 * IndexedDB adapter — the default backend.
 *
 * Everything runs in the browser with no account and no network, which makes the
 * app fully usable before any Firebase project exists. Multi-tab changes are
 * propagated over a BroadcastChannel so two windows on the same machine stay in
 * sync; genuine multi-user sync is what the Firestore adapter is for.
 */

import type { CodeKind, CollectionDocMap, CollectionName, Repo } from './types'
import type { AuthUser, Member, Membership, Workspace, WorkspaceData } from '../types'
import { formatCode } from '../factories'

const DB_NAME = 'flux'
const DB_VERSION = 1
const SESSION_KEY = 'flux.session'
const CHANNEL = 'flux.sync'

const STORES: { name: string; keyPath: string; indexes?: string[] }[] = [
  { name: 'workspaces', keyPath: 'id', indexes: ['joinCode'] },
  { name: 'members', keyPath: 'id', indexes: ['workspaceId'] },
  { name: 'content', keyPath: 'id', indexes: ['workspaceId'] },
  { name: 'tasks', keyPath: 'id', indexes: ['workspaceId'] },
  { name: 'ideas', keyPath: 'id', indexes: ['workspaceId'] },
  { name: 'reviews', keyPath: 'id', indexes: ['workspaceId'] },
  // uid -> membership rows, mirroring the Firestore user index
  { name: 'memberships', keyPath: 'key', indexes: ['uid'] },
]

interface MembershipRow extends Membership {
  key: string
  uid: string
}

export class LocalRepo implements Repo {
  readonly kind = 'local' as const
  private db: IDBDatabase | null = null
  private channel: BroadcastChannel | null = null
  private userListeners = new Set<(u: AuthUser | null) => void>()
  private wsListeners = new Map<string, Set<(d: WorkspaceData) => void>>()

  /**
   * The open() promise is stored, not just its result, so any call that arrives
   * while the database is still opening waits for it instead of failing. React
   * mounts effects twice in development, which makes that overlap routine.
   */
  private opening: Promise<IDBDatabase> | null = null

  async init(): Promise<void> {
    await this.ready()
  }

  private ready(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (!this.opening) {
      this.opening = open()
        .then((db) => {
          this.db = db
          if ('BroadcastChannel' in globalThis && !this.channel) {
            this.channel = new BroadcastChannel(CHANNEL)
            this.channel.onmessage = (e: MessageEvent<{ workspaceId: string }>) => {
              void this.notify(e.data?.workspaceId)
            }
          }
          return db
        })
        .catch((e) => {
          this.opening = null
          throw e
        })
    }
    return this.opening
  }

  private async req<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.ready()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const r = fn(tx.objectStore(store))
      r.onsuccess = () => resolve(r.result as T)
      r.onerror = () => reject(r.error)
    })
  }

  private byWorkspace<T>(store: string, workspaceId: string): Promise<T[]> {
    return this.req<T[]>(store, 'readonly', (s) => s.index('workspaceId').getAll(workspaceId))
  }

  // -- Session ------------------------------------------------------------

  async currentUser(): Promise<AuthUser | null> {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  }

  onUserChanged(cb: (user: AuthUser | null) => void): () => void {
    this.userListeners.add(cb)
    void this.currentUser().then(cb)
    return () => this.userListeners.delete(cb)
  }

  /** No provider in local mode; the local session is a named identity. */
  async signIn(): Promise<AuthUser> {
    return this.signInAs('You', 'you@local')
  }

  async signInAs(name: string, email: string): Promise<AuthUser> {
    const existing = await this.currentUser()
    const user: AuthUser = {
      // Keep the uid stable per email so memberships survive a sign-out.
      uid: existing?.email === email && existing ? existing.uid : `local_${hash(email || name)}`,
      name: name.trim() || 'You',
      email: email.trim().toLowerCase(),
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    this.userListeners.forEach((cb) => cb(user))
    return user
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY)
    this.userListeners.forEach((cb) => cb(null))
  }

  // -- Workspaces ---------------------------------------------------------

  async listMemberships(uid: string): Promise<Membership[]> {
    const rows = await this.req<MembershipRow[]>('memberships', 'readonly', (s) => s.index('uid').getAll(uid))
    return rows.map(({ key: _key, uid: _uid, ...m }) => m)
  }

  async createWorkspace(workspace: Workspace, firstMember: Member): Promise<void> {
    await this.req('workspaces', 'readwrite', (s) => s.put(workspace))
    await this.req('members', 'readwrite', (s) => s.put(firstMember))
    if (firstMember.userId) await this.addMembershipRow(firstMember.userId, workspace, firstMember)
  }

  private async addMembershipRow(uid: string, workspace: Workspace, member: Member) {
    const row: MembershipRow = {
      key: `${uid}:${workspace.id}`,
      uid,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      initials: workspace.initials,
      access: member.access,
      memberId: member.id,
    }
    await this.req('memberships', 'readwrite', (s) => s.put(row))
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceData | null> {
    const workspace = await this.req<Workspace | undefined>('workspaces', 'readonly', (s) => s.get(workspaceId))
    if (!workspace) return null
    const [members, content, tasks, ideas, reviews] = await Promise.all([
      this.byWorkspace<WorkspaceData['members'][number]>('members', workspaceId),
      this.byWorkspace<WorkspaceData['content'][number]>('content', workspaceId),
      this.byWorkspace<WorkspaceData['tasks'][number]>('tasks', workspaceId),
      this.byWorkspace<WorkspaceData['ideas'][number]>('ideas', workspaceId),
      this.byWorkspace<WorkspaceData['reviews'][number]>('reviews', workspaceId),
    ])
    return { workspace, members, content, tasks, ideas, reviews }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await this.req('workspaces', 'readwrite', (s) => s.put(workspace))
    // Keep denormalised name/initials in the membership index current.
    const rows = await this.req<MembershipRow[]>('memberships', 'readonly', (s) => s.getAll())
    await Promise.all(
      rows
        .filter((r) => r.workspaceId === workspace.id)
        .map((r) =>
          this.req('memberships', 'readwrite', (s) =>
            s.put({ ...r, workspaceName: workspace.name, initials: workspace.initials }),
          ),
        ),
    )
    this.broadcast(workspace.id)
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    for (const store of ['members', 'content', 'tasks', 'ideas', 'reviews'] as const) {
      const docs = await this.byWorkspace<{ id: string }>(store, workspaceId)
      await Promise.all(docs.map((d) => this.req(store, 'readwrite', (s) => s.delete(d.id))))
    }
    const rows = await this.req<MembershipRow[]>('memberships', 'readonly', (s) => s.getAll())
    await Promise.all(
      rows.filter((r) => r.workspaceId === workspaceId).map((r) => this.req('memberships', 'readwrite', (s) => s.delete(r.key))),
    )
    await this.req('workspaces', 'readwrite', (s) => s.delete(workspaceId))
  }

  async findByJoinCode(code: string): Promise<Workspace | null> {
    const all = await this.req<Workspace[]>('workspaces', 'readonly', (s) => s.getAll())
    const target = code.trim().toUpperCase()
    return all.find((w) => w.joinEnabled && w.joinCode === target) ?? null
  }

  async joinWorkspace(workspace: Workspace, member: Member): Promise<void> {
    await this.req('members', 'readwrite', (s) => s.put(member))
    if (member.userId) await this.addMembershipRow(member.userId, workspace, member)
    this.broadcast(workspace.id)
  }

  async leaveWorkspace(uid: string, workspaceId: string): Promise<void> {
    await this.req('memberships', 'readwrite', (s) => s.delete(`${uid}:${workspaceId}`))
  }

  // -- Documents ----------------------------------------------------------

  async put<K extends CollectionName>(name: K, doc: CollectionDocMap[K]): Promise<void> {
    await this.req(name, 'readwrite', (s) => s.put(doc))
    this.broadcast(doc.workspaceId)
  }

  async putMany<K extends CollectionName>(name: K, docs: CollectionDocMap[K][]): Promise<void> {
    if (!docs.length) return
    const db = await this.ready()
    await new Promise<void>((resolve, reject) => {
      // One transaction for the whole batch, so a bulk import is atomic.
      const tx = db.transaction(name, 'readwrite')
      const store = tx.objectStore(name)
      for (const d of docs) store.put(d)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    this.broadcast(docs[0].workspaceId)
  }

  async remove(name: CollectionName, workspaceId: string, id: string): Promise<void> {
    await this.req(name, 'readwrite', (s) => s.delete(id))
    this.broadcast(workspaceId)
  }

  async nextCode(workspaceId: string, kind: CodeKind): Promise<string> {
    const workspace = await this.req<Workspace | undefined>('workspaces', 'readonly', (s) => s.get(workspaceId))
    if (!workspace) throw new Error('Workspace not found')
    const next = (workspace.counters?.[kind] ?? 0) + 1
    const updated: Workspace = { ...workspace, counters: { ...workspace.counters, [kind]: next } }
    await this.req('workspaces', 'readwrite', (s) => s.put(updated))
    const prefix =
      kind === 'content' ? workspace.contentPrefix : kind === 'task' ? workspace.taskPrefix : workspace.ideaPrefix
    return formatCode(prefix, next, kind === 'idea' ? 3 : 4)
  }

  // -- Change propagation -------------------------------------------------

  subscribe(workspaceId: string, cb: (data: WorkspaceData) => void): () => void {
    const set = this.wsListeners.get(workspaceId) ?? new Set()
    set.add(cb)
    this.wsListeners.set(workspaceId, set)
    return () => {
      set.delete(cb)
      if (!set.size) this.wsListeners.delete(workspaceId)
    }
  }

  private broadcast(workspaceId: string) {
    this.channel?.postMessage({ workspaceId })
  }

  private async notify(workspaceId?: string) {
    if (!workspaceId) return
    const set = this.wsListeners.get(workspaceId)
    if (!set?.size) return
    const data = await this.loadWorkspace(workspaceId)
    if (data) set.forEach((cb) => cb(data))
  }
}

// ---------------------------------------------------------------------------

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const def of STORES) {
        const store = db.objectStoreNames.contains(def.name)
          ? req.transaction!.objectStore(def.name)
          : db.createObjectStore(def.name, { keyPath: def.keyPath })
        for (const idx of def.indexes ?? []) {
          if (!store.indexNames.contains(idx)) store.createIndex(idx, idx)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
