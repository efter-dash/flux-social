/**
 * Cloud Firestore adapter — the multi-user backend.
 *
 * Document layout:
 *   workspaces/{wsId}                        the Workspace doc
 *   workspaces/{wsId}/members/{id}
 *   workspaces/{wsId}/content/{id}
 *   workspaces/{wsId}/tasks/{id}
 *   workspaces/{wsId}/ideas/{id}
 *   workspaces/{wsId}/reviews/{id}
 *   users/{uid}/memberships/{wsId}            which workspaces a person can open
 *
 * The membership index exists so signing in needs one cheap query instead of a
 * collection-group scan the security rules would have to allow.
 *
 * Firebase is loaded lazily: the local backend never pays for the SDK.
 */

import type { CodeKind, CollectionDocMap, CollectionName, Repo } from './types'
import type { AuthUser, Member, Membership, Workspace, WorkspaceData } from '../types'
import { formatCode } from '../factories'

type FirebaseBits = Awaited<ReturnType<typeof loadFirebase>>

async function loadFirebase() {
  const [{ initializeApp, getApps }, auth, fs] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  if (!config.apiKey || !config.projectId) {
    throw new Error(
      'Firebase config missing. Set VITE_FIREBASE_* in .env, or set VITE_DATA_BACKEND=local.',
    )
  }

  const app = getApps()[0] ?? initializeApp(config)
  const db = fs.getFirestore(app)
  // Offline cache; also makes the app survive a flaky connection.
  try {
    await fs.enableIndexedDbPersistence(db)
  } catch {
    // Multiple tabs or an unsupported browser — not fatal.
  }
  return { app, db, auth: auth.getAuth(app), authMod: auth, fs }
}

const SUB_COLLECTIONS: CollectionName[] = ['members', 'content', 'tasks', 'ideas', 'reviews']

export class FirestoreRepo implements Repo {
  readonly kind = 'firestore' as const
  private fb: FirebaseBits | null = null

  async init(): Promise<void> {
    if (!this.fb) this.fb = await loadFirebase()
  }

  private get bits(): FirebaseBits {
    if (!this.fb) throw new Error('Firestore adapter used before init()')
    return this.fb
  }

  // -- Session ------------------------------------------------------------

  async currentUser(): Promise<AuthUser | null> {
    await this.init()
    const u = this.bits.auth.currentUser
    return u ? toAuthUser(u) : null
  }

  onUserChanged(cb: (user: AuthUser | null) => void): () => void {
    let unsub = () => {}
    void this.init().then(() => {
      unsub = this.bits.authMod.onAuthStateChanged(this.bits.auth, (u) => cb(u ? toAuthUser(u) : null))
    })
    return () => unsub()
  }

  async signIn(): Promise<AuthUser> {
    await this.init()
    const { authMod, auth } = this.bits
    const provider = new authMod.GoogleAuthProvider()
    const cred = await authMod.signInWithPopup(auth, provider)
    return toAuthUser(cred.user)
  }

  async signOut(): Promise<void> {
    await this.init()
    await this.bits.authMod.signOut(this.bits.auth)
  }

  // -- Workspaces ---------------------------------------------------------

  async listMemberships(uid: string): Promise<Membership[]> {
    await this.init()
    const { fs, db } = this.bits
    const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'memberships'))
    return snap.docs.map((d) => d.data() as Membership)
  }

  async createWorkspace(workspace: Workspace, firstMember: Member): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    const batch = fs.writeBatch(db)
    batch.set(fs.doc(db, 'workspaces', workspace.id), workspace)
    batch.set(fs.doc(db, 'workspaces', workspace.id, 'members', firstMember.id), firstMember)
    batch.set(fs.doc(db, 'joinCodes', workspace.joinCode), { workspaceId: workspace.id })
    if (firstMember.userId) {
      batch.set(fs.doc(db, 'users', firstMember.userId, 'memberships', workspace.id), membershipOf(workspace, firstMember))
    }
    await batch.commit()
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceData | null> {
    await this.init()
    const { fs, db } = this.bits
    const wsSnap = await fs.getDoc(fs.doc(db, 'workspaces', workspaceId))
    if (!wsSnap.exists()) return null
    const lists = await Promise.all(
      SUB_COLLECTIONS.map((name) => fs.getDocs(fs.collection(db, 'workspaces', workspaceId, name))),
    )
    const [members, content, tasks, ideas, reviews] = lists.map((snap) => snap.docs.map((d) => d.data()))
    return {
      workspace: wsSnap.data() as Workspace,
      members: members as WorkspaceData['members'],
      content: content as WorkspaceData['content'],
      tasks: tasks as WorkspaceData['tasks'],
      ideas: ideas as WorkspaceData['ideas'],
      reviews: reviews as WorkspaceData['reviews'],
    }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    // Keep the code -> workspace mapping in step, and retire a rotated code so
    // regenerating one actually invalidates the old.
    const prev = await fs.getDoc(fs.doc(db, 'workspaces', workspace.id))
    const oldCode = prev.exists() ? (prev.data() as Workspace).joinCode : null
    const batch = fs.writeBatch(db)
    batch.set(fs.doc(db, 'workspaces', workspace.id), workspace, { merge: true })
    if (oldCode && oldCode !== workspace.joinCode) batch.delete(fs.doc(db, 'joinCodes', oldCode))
    batch.set(fs.doc(db, 'joinCodes', workspace.joinCode), { workspaceId: workspace.id })
    await batch.commit()
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    // Retire the join code first, so nobody can walk in mid-delete.
    const wsSnap = await fs.getDoc(fs.doc(db, 'workspaces', workspaceId))
    const code = wsSnap.exists() ? (wsSnap.data() as Workspace).joinCode : null
    if (code) await fs.deleteDoc(fs.doc(db, 'joinCodes', code)).catch(() => undefined)

    // Client-side recursive delete. Fine at team scale; a Cloud Function would
    // be the right tool for very large workspaces.
    for (const name of SUB_COLLECTIONS) {
      const snap = await fs.getDocs(fs.collection(db, 'workspaces', workspaceId, name))
      for (const chunk of chunked(snap.docs, 400)) {
        const batch = fs.writeBatch(db)
        chunk.forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
    }
    await fs.deleteDoc(fs.doc(db, 'workspaces', workspaceId))
  }

  /**
   * Looked up through the `joinCodes` mapping rather than a query, so the
   * security rules can forbid listing `workspaces` outright — otherwise anyone
   * signed in could enumerate every team on the project.
   */
  async findByJoinCode(code: string): Promise<Workspace | null> {
    await this.init()
    const { fs, db } = this.bits
    const map = await fs.getDoc(fs.doc(db, 'joinCodes', code.trim().toUpperCase()))
    if (!map.exists()) return null
    const { workspaceId } = map.data() as { workspaceId: string }
    const snap = await fs.getDoc(fs.doc(db, 'workspaces', workspaceId))
    if (!snap.exists()) return null
    const workspace = snap.data() as Workspace
    return workspace.joinEnabled ? workspace : null
  }

  async joinWorkspace(workspace: Workspace, member: Member): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    const batch = fs.writeBatch(db)
    batch.set(fs.doc(db, 'workspaces', workspace.id, 'members', member.id), member)
    if (member.userId) {
      batch.set(fs.doc(db, 'users', member.userId, 'memberships', workspace.id), membershipOf(workspace, member))
    }
    await batch.commit()
  }

  async leaveWorkspace(uid: string, workspaceId: string): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    await fs.deleteDoc(fs.doc(db, 'users', uid, 'memberships', workspaceId))
  }

  // -- Documents ----------------------------------------------------------

  async put<K extends CollectionName>(name: K, doc: CollectionDocMap[K]): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    await fs.setDoc(fs.doc(db, 'workspaces', doc.workspaceId, name, doc.id), doc)
  }

  async putMany<K extends CollectionName>(name: K, docs: CollectionDocMap[K][]): Promise<void> {
    if (!docs.length) return
    await this.init()
    const { fs, db } = this.bits
    for (const chunk of chunked(docs, 400)) {
      const batch = fs.writeBatch(db)
      for (const d of chunk) batch.set(fs.doc(db, 'workspaces', d.workspaceId, name, d.id), d)
      await batch.commit()
    }
  }

  async remove(name: CollectionName, workspaceId: string, id: string): Promise<void> {
    await this.init()
    const { fs, db } = this.bits
    await fs.deleteDoc(fs.doc(db, 'workspaces', workspaceId, name, id))
  }

  async nextCode(workspaceId: string, kind: CodeKind): Promise<string> {
    await this.init()
    const { fs, db } = this.bits
    const ref = fs.doc(db, 'workspaces', workspaceId)
    // A transaction is what stops two people creating CN-0007 at the same moment.
    return fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) throw new Error('Workspace not found')
      const ws = snap.data() as Workspace
      const next = (ws.counters?.[kind] ?? 0) + 1
      tx.update(ref, { [`counters.${kind}`]: next })
      const prefix = kind === 'content' ? ws.contentPrefix : kind === 'task' ? ws.taskPrefix : ws.ideaPrefix
      return formatCode(prefix, next, kind === 'idea' ? 3 : 4)
    })
  }

  // -- Realtime -----------------------------------------------------------

  subscribe(workspaceId: string, cb: (data: WorkspaceData) => void): () => void {
    const unsubs: (() => void)[] = []
    let cancelled = false

    void this.init().then(() => {
      if (cancelled) return
      const { fs, db } = this.bits
      // Assemble the bundle from six listeners, emitting once the workspace doc
      // has arrived so consumers never see a half-built workspace.
      const partial: Partial<WorkspaceData> = {}
      const emit = () => {
        if (!partial.workspace) return
        cb({
          workspace: partial.workspace,
          members: partial.members ?? [],
          content: partial.content ?? [],
          tasks: partial.tasks ?? [],
          ideas: partial.ideas ?? [],
          reviews: partial.reviews ?? [],
        })
      }

      unsubs.push(
        fs.onSnapshot(fs.doc(db, 'workspaces', workspaceId), (snap) => {
          if (snap.exists()) partial.workspace = snap.data() as Workspace
          emit()
        }),
      )

      for (const name of SUB_COLLECTIONS) {
        unsubs.push(
          fs.onSnapshot(fs.collection(db, 'workspaces', workspaceId, name), (snap) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(partial as any)[name] = snap.docs.map((d) => d.data())
            emit()
          }),
        )
      }
    })

    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }
}

// ---------------------------------------------------------------------------

function membershipOf(workspace: Workspace, member: Member): Membership {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    initials: workspace.initials,
    access: member.access,
    memberId: member.id,
  }
}

function toAuthUser(u: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): AuthUser {
  return {
    uid: u.uid,
    name: u.displayName || (u.email ? u.email.split('@')[0] : 'Teammate'),
    email: u.email ?? '',
    photoURL: u.photoURL ?? undefined,
  }
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
