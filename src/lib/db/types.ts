/**
 * Storage contract.
 *
 * Two adapters implement this: `local.ts` (IndexedDB, zero setup, works offline)
 * and `firestore.ts` (Cloud Firestore, multi-user). The app only ever talks to
 * this interface, so switching backends is an environment variable rather than a
 * rewrite.
 */

import type {
  ContentItem,
  Idea,
  Member,
  Membership,
  TaskItem,
  WeeklyReview,
  Workspace,
  WorkspaceData,
  AuthUser,
} from '../types'

export type CollectionName = 'members' | 'content' | 'tasks' | 'ideas' | 'reviews'

export interface CollectionDocMap {
  members: Member
  content: ContentItem
  tasks: TaskItem
  ideas: Idea
  reviews: WeeklyReview
}

export type CodeKind = 'content' | 'task' | 'idea'

export interface Repo {
  readonly kind: 'local' | 'firestore'

  /** Opens connections. Safe to call more than once. */
  init(): Promise<void>

  // -- Session ------------------------------------------------------------

  /** Current signed-in user, or null. */
  currentUser(): Promise<AuthUser | null>
  /** Fires on every auth change; returns an unsubscribe function. */
  onUserChanged(cb: (user: AuthUser | null) => void): () => void
  signIn(): Promise<AuthUser>
  /** Local adapter only: sign in with a typed name, no provider. */
  signInAs?(name: string, email: string): Promise<AuthUser>
  signOut(): Promise<void>

  // -- Workspaces ---------------------------------------------------------

  listMemberships(uid: string): Promise<Membership[]>
  createWorkspace(workspace: Workspace, firstMember: Member): Promise<void>
  loadWorkspace(workspaceId: string): Promise<WorkspaceData | null>
  saveWorkspace(workspace: Workspace): Promise<void>
  deleteWorkspace(workspaceId: string): Promise<void>
  findByJoinCode(code: string): Promise<Workspace | null>
  /** Adds the member row and the user's membership index entry. */
  joinWorkspace(workspace: Workspace, member: Member): Promise<void>
  /** Removes only the membership index entry, leaving history intact. */
  leaveWorkspace(uid: string, workspaceId: string): Promise<void>

  // -- Documents ----------------------------------------------------------

  put<K extends CollectionName>(name: K, doc: CollectionDocMap[K]): Promise<void>
  putMany<K extends CollectionName>(name: K, docs: CollectionDocMap[K][]): Promise<void>
  remove(name: CollectionName, workspaceId: string, id: string): Promise<void>

  /** Atomically increments the workspace counter and returns the new code. */
  nextCode(workspaceId: string, kind: CodeKind): Promise<string>

  /** Live updates where supported; returns an unsubscribe function. */
  subscribe(workspaceId: string, cb: (data: WorkspaceData) => void): () => void
}
