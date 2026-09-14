/**
 * Application store.
 *
 * One context holds the signed-in user, their memberships, the active workspace
 * bundle and every mutation. Views read derived values through `lib/derive` and
 * `lib/metrics` rather than storing anything computed.
 *
 * Writes are optimistic: local state updates immediately, then the repository
 * persists. With the Firestore adapter, `subscribe` replaces local state with the
 * server's copy shortly after, which is what keeps two people in sync.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AccessLevel,
  AuthUser,
  ContentItem,
  Idea,
  Member,
  Membership,
  Stage,
  TaskItem,
  Taxonomies,
  WeeklyReview,
  Workspace,
  WorkspaceData,
  StageState,
} from '@/lib/types'
import { getRepo, backendKind, type Repo } from '@/lib/db'
import {
  contentFromIdea,
  newContentItem,
  newIdea,
  newMember,
  newTask,
  newWorkspace,
  makeJoinCode,
  uid,
} from '@/lib/factories'
import { buildSampleWorkspace } from '@/lib/sample'
import { currentMonthKey, today } from '@/lib/date'
import { suggestAssignee } from '@/lib/derive'

const ACTIVE_WS_KEY = 'flux.activeWorkspace'
const DISMISSED_KEY = 'flux.dismissedAlerts'

export interface Toast {
  id: string
  message: string
  tone: 'default' | 'success' | 'danger'
  /** Optional single-action undo. */
  action?: { label: string; run: () => void }
}

interface StoreValue {
  ready: boolean
  /**
   * True once the first workspace-load attempt has finished. Until then the app
   * must not decide that someone needs onboarding, or a reload on a deep link
   * would bounce to /welcome and lose the URL.
   */
  hydrated: boolean
  backend: 'local' | 'firestore'
  user: AuthUser | null
  memberships: Membership[]
  data: WorkspaceData | null
  /** The Member row for the signed-in user in the active workspace. */
  me: Member | null
  access: AccessLevel
  canEdit: boolean
  canManage: boolean
  loadingWorkspace: boolean
  error: string | null

  /** Month selected in the dashboard / performance views. */
  month: string
  setMonth: (m: string) => void

  toasts: Toast[]
  notify: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: (id: string) => void

  dismissedAlerts: Set<string>
  dismissAlert: (id: string) => void
  restoreAlerts: () => void

  // Session
  signIn: () => Promise<void>
  signInAs: (name: string, email: string) => Promise<void>
  signOut: () => Promise<void>

  // Workspaces
  createWorkspace: (opts: { name: string; templateId: string; contentPrefix?: string; weekStartsOn?: 0 | 1; withSample?: boolean }) => Promise<string>
  openWorkspace: (id: string) => Promise<void>
  joinByCode: (code: string, displayName?: string) => Promise<string>
  leaveWorkspace: (id: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  updateWorkspace: (patch: Partial<Workspace>) => Promise<void>
  regenerateJoinCode: () => Promise<void>
  updateTaxonomies: (patch: Partial<Taxonomies>) => Promise<void>
  setStages: (stages: Stage[]) => Promise<void>
  loadSampleData: () => Promise<void>

  // Members
  addMember: (opts: { name: string; email: string; role: string; access: AccessLevel; responsibility?: string }) => Promise<Member>
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>
  removeMember: (id: string) => Promise<void>

  // Content
  createContent: (patch?: Partial<ContentItem>) => Promise<ContentItem>
  updateContent: (id: string, patch: Partial<ContentItem>) => Promise<void>
  setStageState: (id: string, stageId: string, state: StageState) => Promise<void>
  advanceStage: (id: string) => Promise<void>
  markPublished: (id: string, date?: string, link?: string) => Promise<void>
  deleteContent: (id: string) => Promise<void>

  // Tasks
  createTask: (patch?: Partial<TaskItem>) => Promise<TaskItem>
  updateTask: (id: string, patch: Partial<TaskItem>) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  // Ideas
  createIdea: (patch?: Partial<Idea>) => Promise<Idea>
  updateIdea: (id: string, patch: Partial<Idea>) => Promise<void>
  deleteIdea: (id: string) => Promise<void>
  promoteIdea: (id: string) => Promise<ContentItem | null>

  // Weekly review
  upsertReview: (review: WeeklyReview) => Promise<void>
  ensureReview: (weekStart: string, weekEnd: string, label: string) => Promise<WeeklyReview>
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}

/** Convenience accessor for views that only run with a loaded workspace. */
export function useWorkspace() {
  const store = useStore()
  if (!store.data) throw new Error('No workspace loaded')
  return { ...store, data: store.data }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repo | null>(null)
  const [ready, setReady] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(currentMonthKey())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => loadDismissed())

  const notify = useCallback((message: string, tone: Toast['tone'] = 'default', action?: Toast['action']) => {
    const id = uid('t_')
    setToasts((prev) => [...prev, { id, message, tone, action }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), action ? 7000 : 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const restoreAlerts = useCallback(() => {
    localStorage.removeItem(DISMISSED_KEY)
    setDismissedAlerts(new Set())
  }, [])

  // -- Boot ---------------------------------------------------------------

  useEffect(() => {
    let unsubUser = () => {}
    let cancelled = false
    ;(async () => {
      try {
        const repo = await getRepo()
        if (cancelled) return
        repoRef.current = repo
        unsubUser = repo.onUserChanged((u) => {
          setUser(u)
          if (!u) {
            setData(null)
            setMemberships([])
            setHydrated(true)
          }
        })
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open the data store')
        setReady(true)
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
      unsubUser()
    }
  }, [])

  // Load memberships whenever the user changes, then open the last workspace.
  useEffect(() => {
    if (!user || !repoRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const repo = repoRef.current!
        const list = await repo.listMemberships(user.uid)
        if (cancelled) return
        setMemberships(list)
        const remembered = localStorage.getItem(ACTIVE_WS_KEY)
        const target = list.find((m) => m.workspaceId === remembered) ?? list[0]
        if (target) await openWorkspaceInternal(target.workspaceId)
        else setData(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your workspaces')
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // Live updates for the active workspace.
  useEffect(() => {
    const repo = repoRef.current
    const wsId = data?.workspace.id
    if (!repo || !wsId) return
    return repo.subscribe(wsId, (fresh) => setData(fresh))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.workspace.id])

  const openWorkspaceInternal = useCallback(async (id: string) => {
    const repo = repoRef.current
    if (!repo) return
    setLoadingWorkspace(true)
    try {
      const fresh = await repo.loadWorkspace(id)
      if (fresh) {
        setData(fresh)
        localStorage.setItem(ACTIVE_WS_KEY, id)
      } else {
        setError('That workspace could not be found.')
      }
    } finally {
      setLoadingWorkspace(false)
    }
  }, [])

  // -- Helpers ------------------------------------------------------------

  const repo = () => {
    const r = repoRef.current
    if (!r) throw new Error('Data store is not ready yet')
    return r
  }

  const me = useMemo(() => {
    if (!data || !user) return null
    return (
      data.members.find((m) => m.userId === user.uid) ??
      data.members.find((m) => m.email && m.email === user.email.toLowerCase()) ??
      null
    )
  }, [data, user])

  const access: AccessLevel = me?.access ?? 'viewer'
  const canEdit = access !== 'viewer'
  const canManage = access === 'owner' || access === 'admin'

  /** Applies a local patch to the bundle immediately, before persisting. */
  const patchLocal = useCallback((fn: (d: WorkspaceData) => WorkspaceData) => {
    setData((prev) => (prev ? fn(prev) : prev))
  }, [])

  const guard = useCallback(
    (allowed: boolean, action: string) => {
      if (!allowed) {
        notify(`You do not have permission to ${action}.`, 'danger')
        return false
      }
      return true
    },
    [notify],
  )

  // -- Session ------------------------------------------------------------

  const signIn = useCallback(async () => {
    await repo().signIn()
  }, [])

  const signInAs = useCallback(async (name: string, email: string) => {
    const r = repo()
    if (r.signInAs) await r.signInAs(name, email)
    else await r.signIn()
  }, [])

  const signOut = useCallback(async () => {
    await repo().signOut()
    localStorage.removeItem(ACTIVE_WS_KEY)
  }, [])

  // -- Workspaces ---------------------------------------------------------

  const createWorkspace = useCallback<StoreValue['createWorkspace']>(
    async (opts) => {
      if (!user) throw new Error('Sign in first')
      const r = repo()

      if (opts.withSample) {
        const sample = buildSampleWorkspace(user, opts.name)
        sample.workspace.contentPrefix = (opts.contentPrefix || 'CN').toUpperCase()
        sample.workspace.weekStartsOn = opts.weekStartsOn ?? 1
        await r.createWorkspace(sample.workspace, sample.members[0])
        await r.putMany('members', sample.members.slice(1))
        await r.putMany('content', sample.content)
        await r.putMany('tasks', sample.tasks)
        await r.putMany('ideas', sample.ideas)
        await r.putMany('reviews', sample.reviews)
        await r.saveWorkspace(sample.workspace)
        setMemberships(await r.listMemberships(user.uid))
        await openWorkspaceInternal(sample.workspace.id)
        notify('Workspace created with sample data', 'success')
        return sample.workspace.id
      }

      const workspace = newWorkspace({
        name: opts.name,
        templateId: opts.templateId,
        createdBy: user.uid,
        contentPrefix: opts.contentPrefix,
        weekStartsOn: opts.weekStartsOn,
      })
      const firstMember = newMember({
        workspaceId: workspace.id,
        name: user.name,
        email: user.email,
        role: 'Team Lead',
        access: 'owner',
        userId: user.uid,
        responsibility: 'Overall content operations',
      })
      await r.createWorkspace(workspace, firstMember)
      setMemberships(await r.listMemberships(user.uid))
      await openWorkspaceInternal(workspace.id)
      notify('Workspace created', 'success')
      return workspace.id
    },
    [user, notify, openWorkspaceInternal],
  )

  const joinByCode = useCallback<StoreValue['joinByCode']>(
    async (code, displayName) => {
      if (!user) throw new Error('Sign in first')
      const r = repo()
      const workspace = await r.findByJoinCode(code)
      if (!workspace) throw new Error('No workspace matches that code, or joining has been turned off.')

      // If an admin pre-created a directory entry for this email, adopt its role
      // and responsibility instead of asking the person to re-enter them. The new
      // row is still keyed by uid — that is what the security rules check — so the
      // placeholder is retired rather than edited in place.
      let placeholder: Member | undefined
      try {
        const existing = await r.loadWorkspace(workspace.id)
        placeholder = existing?.members.find(
          (m) => !m.userId && m.email && m.email === user.email.toLowerCase(),
        )
      } catch {
        // Expected with the Firestore backend: a non-member cannot read the roster.
      }

      const member = newMember({
        workspaceId: workspace.id,
        name: displayName?.trim() || placeholder?.name || user.name,
        email: user.email,
        role: placeholder?.role ?? workspace.taxonomies.roles[1]?.label ?? 'Content Writer',
        access: workspace.joinAccess,
        userId: user.uid,
        responsibility: placeholder?.responsibility,
      })
      await r.joinWorkspace(workspace, member)
      if (placeholder) {
        try {
          await r.remove('members', workspace.id, placeholder.id)
        } catch {
          // Only an admin may delete; leaving it is harmless, just a duplicate row.
        }
      }
      setMemberships(await r.listMemberships(user.uid))
      await openWorkspaceInternal(workspace.id)
      notify(`Joined ${workspace.name}`, 'success')
      return workspace.id
    },
    [user, notify, openWorkspaceInternal],
  )

  const leaveWorkspace = useCallback(
    async (id: string) => {
      if (!user) return
      await repo().leaveWorkspace(user.uid, id)
      const list = await repo().listMemberships(user.uid)
      setMemberships(list)
      if (data?.workspace.id === id) {
        localStorage.removeItem(ACTIVE_WS_KEY)
        if (list[0]) await openWorkspaceInternal(list[0].workspaceId)
        else setData(null)
      }
      notify('You left the workspace')
    },
    [user, data?.workspace.id, notify, openWorkspaceInternal],
  )

  const deleteWorkspace = useCallback(
    async (id: string) => {
      if (!guard(access === 'owner', 'delete this workspace')) return
      await repo().deleteWorkspace(id)
      if (user) setMemberships(await repo().listMemberships(user.uid))
      localStorage.removeItem(ACTIVE_WS_KEY)
      setData(null)
      notify('Workspace deleted')
    },
    [access, guard, user, notify],
  )

  const updateWorkspace = useCallback<StoreValue['updateWorkspace']>(
    async (patch) => {
      if (!data) return
      if (!guard(canManage, 'change workspace settings')) return
      const next = { ...data.workspace, ...patch }
      patchLocal((d) => ({ ...d, workspace: next }))
      await repo().saveWorkspace(next)
    },
    [data, canManage, guard, patchLocal],
  )

  const regenerateJoinCode = useCallback(async () => {
    await updateWorkspace({ joinCode: makeJoinCode() })
    notify('New join code generated', 'success')
  }, [updateWorkspace, notify])

  const updateTaxonomies = useCallback<StoreValue['updateTaxonomies']>(
    async (patch) => {
      if (!data) return
      await updateWorkspace({ taxonomies: { ...data.workspace.taxonomies, ...patch } })
    },
    [data, updateWorkspace],
  )

  const setStages = useCallback<StoreValue['setStages']>(
    async (stages) => {
      if (!data) return
      if (!guard(canManage, 'change the pipeline')) return
      // Existing items must keep valid maps: seed new stages, drop removed ones.
      const ids = new Set(stages.map((s) => s.id))
      const updated = data.content.map((item) => {
        const stageStates: Record<string, StageState> = {}
        const stageAssignees: Record<string, string> = {}
        const stageDeadlines: Record<string, string> = {}
        const stageEnteredAt: Record<string, string> = {}
        for (const s of stages) {
          stageStates[s.id] = item.stageStates?.[s.id] ?? 'pending'
          stageAssignees[s.id] = item.stageAssignees?.[s.id] ?? ''
          stageDeadlines[s.id] = item.stageDeadlines?.[s.id] ?? ''
          if (item.stageEnteredAt?.[s.id]) stageEnteredAt[s.id] = item.stageEnteredAt[s.id]
        }
        const changed =
          Object.keys(item.stageStates ?? {}).some((k) => !ids.has(k)) ||
          stages.some((s) => !(s.id in (item.stageStates ?? {})))
        if (!changed) return item
        return { ...item, stageStates, stageAssignees, stageDeadlines, stageEnteredAt, updatedAt: new Date().toISOString() }
      })

      const nextWorkspace = { ...data.workspace, stages }
      patchLocal((d) => ({ ...d, workspace: nextWorkspace, content: updated }))
      await repo().saveWorkspace(nextWorkspace)
      const touched = updated.filter((u, i) => u !== data.content[i])
      if (touched.length) await repo().putMany('content', touched)
    },
    [data, canManage, guard, patchLocal],
  )

  const loadSampleData = useCallback(async () => {
    if (!data || !user) return
    if (!guard(canManage, 'load sample data')) return
    const sample = buildSampleWorkspace(user, data.workspace.name)
    const r = repo()
    // Keep this workspace's identity and existing members; graft the sample
    // content on top, remapping people to whoever is actually in the team.
    const roster = data.members.length > 1 ? data.members : sample.members.map((m, i) => (i === 0 ? data.members[0] : m))
    if (data.members.length <= 1) await r.putMany('members', roster.slice(1))

    const remap = (id: string) => {
      const idx = sample.members.findIndex((m) => m.id === id)
      return roster[Math.min(idx < 0 ? 0 : idx, roster.length - 1)]?.id ?? roster[0].id
    }
    const content = sample.content.map((c) => ({
      ...c,
      workspaceId: data.workspace.id,
      ownerId: remap(c.ownerId),
      stageAssignees: Object.fromEntries(
        data.workspace.stages.map((s, i) => {
          const sampleStage = sample.workspace.stages[Math.min(i, sample.workspace.stages.length - 1)]
          return [s.id, remap(c.stageAssignees[sampleStage.id] ?? '')]
        }),
      ),
      stageStates: Object.fromEntries(
        data.workspace.stages.map((s, i) => {
          const sampleStage = sample.workspace.stages[Math.min(i, sample.workspace.stages.length - 1)]
          return [s.id, c.stageStates[sampleStage.id] ?? 'pending']
        }),
      ) as Record<string, StageState>,
      stageDeadlines: Object.fromEntries(
        data.workspace.stages.map((s, i) => {
          const sampleStage = sample.workspace.stages[Math.min(i, sample.workspace.stages.length - 1)]
          return [s.id, c.stageDeadlines[sampleStage.id] ?? '']
        }),
      ),
      stageEnteredAt: {},
    }))
    const tasks = sample.tasks.map((t) => ({
      ...t,
      workspaceId: data.workspace.id,
      memberId: remap(t.memberId),
      stageId: '',
    }))
    const ideas = sample.ideas.map((i) => ({ ...i, workspaceId: data.workspace.id, submittedBy: remap(i.submittedBy) }))
    const reviews = sample.reviews.map((rv) => ({
      ...rv,
      workspaceId: data.workspace.id,
      actionOwnerId: rv.actionOwnerId ? remap(rv.actionOwnerId) : '',
    }))

    await r.putMany('content', content)
    await r.putMany('tasks', tasks)
    await r.putMany('ideas', ideas)
    await r.putMany('reviews', reviews)
    const nextWorkspace = { ...data.workspace, counters: sample.workspace.counters }
    await r.saveWorkspace(nextWorkspace)
    await openWorkspaceInternal(data.workspace.id)
    notify('Sample data loaded', 'success')
  }, [data, user, canManage, guard, notify, openWorkspaceInternal])

  // -- Members ------------------------------------------------------------

  const addMember = useCallback<StoreValue['addMember']>(
    async (opts) => {
      if (!data) throw new Error('No workspace')
      if (!canManage) {
        notify('Only owners and admins can add people.', 'danger')
        throw new Error('Forbidden')
      }
      const member = newMember({ workspaceId: data.workspace.id, ...opts })
      patchLocal((d) => ({ ...d, members: [...d.members, member] }))
      await repo().put('members', member)
      notify(`${member.name} added to the team`, 'success')
      return member
    },
    [data, canManage, notify, patchLocal],
  )

  const updateMember = useCallback<StoreValue['updateMember']>(
    async (id, patch) => {
      if (!data) return
      const isSelf = me?.id === id
      if (!guard(canManage || isSelf, 'edit this person')) return
      const next = data.members.map((m) => (m.id === id ? { ...m, ...patch } : m))
      patchLocal((d) => ({ ...d, members: next }))
      const doc = next.find((m) => m.id === id)
      if (doc) await repo().put('members', doc)
    },
    [data, canManage, me?.id, guard, patchLocal],
  )

  const removeMember = useCallback<StoreValue['removeMember']>(
    async (id) => {
      if (!data) return
      if (!guard(canManage, 'remove people')) return
      const assigned = data.content.some(
        (c) => c.ownerId === id || Object.values(c.stageAssignees ?? {}).includes(id),
      )
      const hasTasks = data.tasks.some((t) => t.memberId === id)
      if (assigned || hasTasks) {
        // Deactivating preserves history; the sheet's "Active? = No" rule.
        await updateMember(id, { active: false })
        notify('That person has work attached, so they were deactivated instead of deleted.')
        return
      }
      patchLocal((d) => ({ ...d, members: d.members.filter((m) => m.id !== id) }))
      await repo().remove('members', data.workspace.id, id)
      notify('Person removed')
    },
    [data, canManage, guard, patchLocal, updateMember, notify],
  )

  // -- Content ------------------------------------------------------------

  const createContent = useCallback<StoreValue['createContent']>(
    async (patch) => {
      if (!data) throw new Error('No workspace')
      if (!canEdit) {
        notify('Viewers cannot create content.', 'danger')
        throw new Error('Forbidden')
      }
      const r = repo()
      const code = await r.nextCode(data.workspace.id, 'content')
      const base = newContentItem({
        workspaceId: data.workspace.id,
        code,
        stages: data.workspace.stages,
        taxonomies: data.workspace.taxonomies,
        ownerId: me?.id ?? data.members[0]?.id ?? '',
        updatedBy: user?.uid ?? '',
        month,
      })
      // Pre-assign each stage to someone holding the matching job role.
      for (const stage of data.workspace.stages) {
        base.stageAssignees[stage.id] = suggestAssignee(data.members, stage)
      }
      const item: ContentItem = { ...base, ...patch }
      patchLocal((d) => ({
        ...d,
        content: [...d.content, item],
        workspace: { ...d.workspace, counters: { ...d.workspace.counters, content: d.workspace.counters.content + 1 } },
      }))
      await r.put('content', item)
      return item
    },
    [data, canEdit, me?.id, user?.uid, month, notify, patchLocal],
  )

  const updateContent = useCallback<StoreValue['updateContent']>(
    async (id, patch) => {
      if (!data) return
      if (!guard(canEdit, 'edit content')) return
      const stamped = { ...patch, updatedAt: new Date().toISOString(), updatedBy: user?.uid ?? '' }
      const next = data.content.map((c) => (c.id === id ? { ...c, ...stamped } : c))
      patchLocal((d) => ({ ...d, content: next }))
      const doc = next.find((c) => c.id === id)
      if (doc) await repo().put('content', doc)
    },
    [data, canEdit, user?.uid, guard, patchLocal],
  )

  const setStageState = useCallback<StoreValue['setStageState']>(
    async (id, stageId, state) => {
      if (!data) return
      const item = data.content.find((c) => c.id === id)
      if (!item) return
      const stageStates = { ...item.stageStates, [stageId]: state }
      // Stamp entry time on the stage that becomes current, so "stuck for N days"
      // measures something real.
      const stageEnteredAt = { ...item.stageEnteredAt }
      const stages = data.workspace.stages
      const nextCurrent = stages.find((s) => (stageStates[s.id] ?? 'pending') !== 'complete')
      if (nextCurrent && !stageEnteredAt[nextCurrent.id]) stageEnteredAt[nextCurrent.id] = today()
      if (state === 'complete') stageEnteredAt[stageId] = stageEnteredAt[stageId] ?? today()

      const lifecycle =
        item.lifecycle === 'idea' && Object.values(stageStates).some((s) => s !== 'pending') ? 'active' : item.lifecycle
      await updateContent(id, { stageStates, stageEnteredAt, lifecycle })
    },
    [data, updateContent],
  )

  const advanceStage = useCallback<StoreValue['advanceStage']>(
    async (id) => {
      if (!data) return
      const item = data.content.find((c) => c.id === id)
      if (!item) return
      const stages = data.workspace.stages
      const stage = stages.find((s) => (item.stageStates?.[s.id] ?? 'pending') !== 'complete')
      if (!stage) {
        notify('Every stage is already complete — publish it next.')
        return
      }
      await setStageState(id, stage.id, 'complete')
      const remaining = stages.filter((s) => s.id !== stage.id && (item.stageStates?.[s.id] ?? 'pending') !== 'complete')
      notify(
        remaining.length ? `${stage.name} complete — now in ${remaining[0].name}` : `${stage.name} complete — ready to publish`,
        'success',
      )
    },
    [data, setStageState, notify],
  )

  const markPublished = useCallback<StoreValue['markPublished']>(
    async (id, date, link) => {
      if (!data) return
      const item = data.content.find((c) => c.id === id)
      if (!item) return
      const stageStates = { ...item.stageStates }
      for (const s of data.workspace.stages) stageStates[s.id] = 'complete'
      await updateContent(id, {
        lifecycle: 'published',
        actualPublishDate: date ?? today(),
        stageStates,
        blocker: '',
        links: { ...item.links, published: link ?? item.links.published },
        performance: item.performance ?? null,
      })
      notify(`${item.code} marked as published`, 'success')
    },
    [data, updateContent, notify],
  )

  const deleteContent = useCallback<StoreValue['deleteContent']>(
    async (id) => {
      if (!data) return
      if (!guard(canManage, 'delete content')) return
      const item = data.content.find((c) => c.id === id)
      const orphanTasks = data.tasks.filter((t) => t.contentId === id)
      patchLocal((d) => ({
        ...d,
        content: d.content.filter((c) => c.id !== id),
        tasks: d.tasks.map((t) => (t.contentId === id ? { ...t, contentId: '' } : t)),
      }))
      await repo().remove('content', data.workspace.id, id)
      if (orphanTasks.length) {
        await repo().putMany(
          'tasks',
          orphanTasks.map((t) => ({ ...t, contentId: '' })),
        )
      }
      notify(`${item?.code ?? 'Item'} deleted`)
    },
    [data, canManage, guard, patchLocal, notify],
  )

  // -- Tasks --------------------------------------------------------------

  const createTask = useCallback<StoreValue['createTask']>(
    async (patch) => {
      if (!data) throw new Error('No workspace')
      if (!canEdit) {
        notify('Viewers cannot create tasks.', 'danger')
        throw new Error('Forbidden')
      }
      const r = repo()
      const code = await r.nextCode(data.workspace.id, 'task')
      const task: TaskItem = {
        ...newTask({
          workspaceId: data.workspace.id,
          code,
          memberId: me?.id ?? data.members[0]?.id ?? '',
          taxonomies: data.workspace.taxonomies,
        }),
        ...patch,
      }
      patchLocal((d) => ({
        ...d,
        tasks: [...d.tasks, task],
        workspace: { ...d.workspace, counters: { ...d.workspace.counters, task: d.workspace.counters.task + 1 } },
      }))
      await r.put('tasks', task)
      return task
    },
    [data, canEdit, me?.id, notify, patchLocal],
  )

  const updateTask = useCallback<StoreValue['updateTask']>(
    async (id, patch) => {
      if (!data) return
      if (!guard(canEdit, 'edit tasks')) return
      const stamped = { ...patch, updatedAt: new Date().toISOString() }
      const next = data.tasks.map((t) => (t.id === id ? { ...t, ...stamped } : t))
      patchLocal((d) => ({ ...d, tasks: next }))
      const doc = next.find((t) => t.id === id)
      if (doc) await repo().put('tasks', doc)
    },
    [data, canEdit, guard, patchLocal],
  )

  const toggleTask = useCallback<StoreValue['toggleTask']>(
    async (id) => {
      if (!data) return
      const task = data.tasks.find((t) => t.id === id)
      if (!task) return
      const done = task.status === 'completed'
      await updateTask(id, {
        status: done ? 'working' : 'completed',
        completionDate: done ? '' : today(),
      })
      // Completing the last open task on a stage is a strong signal the stage is done.
      if (!done && task.stageId && task.contentId) {
        const siblings = data.tasks.filter(
          (t) => t.contentId === task.contentId && t.stageId === task.stageId && t.id !== id,
        )
        const allDone = siblings.every((t) => t.status === 'completed' || t.status === 'cancelled')
        if (allDone) {
          const item = data.content.find((c) => c.id === task.contentId)
          const stage = data.workspace.stages.find((s) => s.id === task.stageId)
          if (item && stage && (item.stageStates?.[stage.id] ?? 'pending') !== 'complete') {
            notify(`Mark ${stage.name} complete for ${item.code}?`, 'default', {
              label: `Complete ${stage.name}`,
              run: () => void setStageState(item.id, stage.id, 'complete'),
            })
          }
        }
      }
    },
    [data, updateTask, setStageState, notify],
  )

  const deleteTask = useCallback<StoreValue['deleteTask']>(
    async (id) => {
      if (!data) return
      if (!guard(canEdit, 'delete tasks')) return
      patchLocal((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
      await repo().remove('tasks', data.workspace.id, id)
      notify('Task deleted')
    },
    [data, canEdit, guard, patchLocal, notify],
  )

  // -- Ideas --------------------------------------------------------------

  const createIdea = useCallback<StoreValue['createIdea']>(
    async (patch) => {
      if (!data) throw new Error('No workspace')
      if (!canEdit) {
        notify('Viewers cannot add ideas.', 'danger')
        throw new Error('Forbidden')
      }
      const r = repo()
      const code = await r.nextCode(data.workspace.id, 'idea')
      const idea: Idea = {
        ...newIdea({
          workspaceId: data.workspace.id,
          code,
          taxonomies: data.workspace.taxonomies,
          submittedBy: me?.id ?? '',
        }),
        ...patch,
      }
      patchLocal((d) => ({
        ...d,
        ideas: [...d.ideas, idea],
        workspace: { ...d.workspace, counters: { ...d.workspace.counters, idea: d.workspace.counters.idea + 1 } },
      }))
      await r.put('ideas', idea)
      return idea
    },
    [data, canEdit, me?.id, notify, patchLocal],
  )

  const updateIdea = useCallback<StoreValue['updateIdea']>(
    async (id, patch) => {
      if (!data) return
      if (!guard(canEdit, 'edit ideas')) return
      const next = data.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i))
      patchLocal((d) => ({ ...d, ideas: next }))
      const doc = next.find((i) => i.id === id)
      if (doc) await repo().put('ideas', doc)
    },
    [data, canEdit, guard, patchLocal],
  )

  const deleteIdea = useCallback<StoreValue['deleteIdea']>(
    async (id) => {
      if (!data) return
      if (!guard(canEdit, 'delete ideas')) return
      patchLocal((d) => ({ ...d, ideas: d.ideas.filter((i) => i.id !== id) }))
      await repo().remove('ideas', data.workspace.id, id)
      notify('Idea deleted')
    },
    [data, canEdit, guard, patchLocal, notify],
  )

  const promoteIdea = useCallback<StoreValue['promoteIdea']>(
    async (id) => {
      if (!data) return null
      const idea = data.ideas.find((i) => i.id === id)
      if (!idea) return null
      const base = await createContent()
      const item = contentFromIdea(idea, base)
      await updateContent(item.id, item)
      await updateIdea(id, { status: 'converted', contentId: item.id })
      notify(`${idea.code} became ${item.code}`, 'success')
      return item
    },
    [data, createContent, updateContent, updateIdea, notify],
  )

  // -- Weekly review ------------------------------------------------------

  const upsertReview = useCallback<StoreValue['upsertReview']>(
    async (review) => {
      if (!data) return
      if (!guard(canEdit, 'edit the weekly review')) return
      const stamped = { ...review, updatedAt: new Date().toISOString() }
      const exists = data.reviews.some((r) => r.id === review.id)
      patchLocal((d) => ({
        ...d,
        reviews: exists ? d.reviews.map((r) => (r.id === review.id ? stamped : r)) : [...d.reviews, stamped],
      }))
      await repo().put('reviews', stamped)
    },
    [data, canEdit, guard, patchLocal],
  )

  const ensureReview = useCallback<StoreValue['ensureReview']>(
    async (weekStart, weekEnd, label) => {
      if (!data) throw new Error('No workspace')
      const existing = data.reviews.find((r) => r.weekStart === weekStart)
      if (existing) return existing
      const review: WeeklyReview = {
        id: uid('wr_'),
        workspaceId: data.workspace.id,
        weekStart,
        weekEnd,
        label,
        planned: '',
        completed: '',
        delayed: '',
        performedWell: '',
        needsAttention: '',
        keyWins: '',
        keyProblems: '',
        nextPriorities: '',
        actionOwnerId: '',
        actionDeadline: '',
        status: 'not_started',
        updatedAt: new Date().toISOString(),
      }
      patchLocal((d) => ({ ...d, reviews: [...d.reviews, review] }))
      await repo().put('reviews', review)
      return review
    },
    [data, patchLocal],
  )

  const value: StoreValue = {
    ready,
    hydrated,
    backend: backendKind(),
    user,
    memberships,
    data,
    me,
    access,
    canEdit,
    canManage,
    loadingWorkspace,
    error,
    month,
    setMonth,
    toasts,
    notify,
    dismissToast,
    dismissedAlerts,
    dismissAlert,
    restoreAlerts,
    signIn,
    signInAs,
    signOut,
    createWorkspace,
    openWorkspace: openWorkspaceInternal,
    joinByCode,
    leaveWorkspace,
    deleteWorkspace,
    updateWorkspace,
    regenerateJoinCode,
    updateTaxonomies,
    setStages,
    loadSampleData,
    addMember,
    updateMember,
    removeMember,
    createContent,
    updateContent,
    setStageState,
    advanceStage,
    markPublished,
    deleteContent,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    createIdea,
    updateIdea,
    deleteIdea,
    promoteIdea,
    upsertReview,
    ensureReview,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}
