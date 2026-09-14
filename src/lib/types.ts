/**
 * FLUX domain model.
 *
 * Derived from the "Content Production Management System" spreadsheet, with one
 * structural change: anything that was a spreadsheet formula is NOT stored here.
 * Current stage, overall status, responsible person, days remaining, overdue
 * flags, engagement rate and every dashboard number are computed in
 * `lib/derive.ts` and `lib/metrics.ts` from the fields below. Storing them would
 * let them drift, which is exactly what breaks in the spreadsheet.
 */

// ---------------------------------------------------------------------------
// Access & identity
// ---------------------------------------------------------------------------

/** Workspace-level permission. Distinct from a member's job role. */
export type AccessLevel = 'owner' | 'admin' | 'member' | 'viewer'

export const ACCESS_LEVELS: { id: AccessLevel; label: string; blurb: string }[] = [
  { id: 'owner', label: 'Owner', blurb: 'Full control, including deleting the workspace' },
  { id: 'admin', label: 'Admin', blurb: 'Manage members, pipeline, taxonomies and all content' },
  { id: 'member', label: 'Member', blurb: 'Create and edit content, tasks and ideas' },
  { id: 'viewer', label: 'Viewer', blurb: 'Read-only access to everything' },
]

export interface AuthUser {
  uid: string
  name: string
  email: string
  photoURL?: string
}

// ---------------------------------------------------------------------------
// Workspace configuration
// ---------------------------------------------------------------------------

/** One step in a workspace's production pipeline. Fully user-configurable. */
export interface Stage {
  id: string
  name: string
  /** Job-role label expected to own this stage; drives "responsible person". */
  ownerRole: string
  /** Short verb shown on the action button, e.g. "Write", "Shoot", "Edit". */
  verb?: string
}

export interface JobRole {
  id: string
  label: string
}

export interface PlatformDef {
  id: string
  label: string
  /** Brand colour, rendered at low opacity behind full-opacity text. */
  color: string
}

export interface Taxonomies {
  contentTypes: string[]
  categories: string[]
  platforms: PlatformDef[]
  priorities: string[]
  taskTypes: string[]
  objectives: string[]
  audiences: string[]
  roles: JobRole[]
  performanceRatings: string[]
  repurposeLevels: string[]
  ideaPotentials: string[]
}

export interface Workspace {
  id: string
  name: string
  /** Short label for avatars and the workspace switcher. */
  initials: string
  /** Prefixes for human-readable codes, e.g. "CN" -> CN-0001. */
  contentPrefix: string
  taskPrefix: string
  ideaPrefix: string
  counters: { content: number; task: number; idea: number }
  /** Anyone with this code can join at `joinAccess` level. */
  joinCode: string
  joinEnabled: boolean
  joinAccess: Exclude<AccessLevel, 'owner'>
  /** 0 = Sunday, 1 = Monday. Drives week numbering and the calendar grid. */
  weekStartsOn: 0 | 1
  stages: Stage[]
  taxonomies: Taxonomies
  createdAt: string
  createdBy: string
}

export interface Member {
  id: string
  workspaceId: string
  name: string
  email: string
  /** Job role label, must match a `taxonomies.roles` entry. */
  role: string
  access: AccessLevel
  active: boolean
  responsibility: string
  contact: string
  notes: string
  /** Set once the person actually signs in. */
  userId?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type StageState = 'pending' | 'in_progress' | 'complete' | 'blocked'

/**
 * Explicit lifecycle overrides. Everything between "planned" and "published" is
 * derived from stage states, so only the states the pipeline cannot express are
 * stored: an unstarted idea, a revision loop, a cancellation, and publication.
 */
export type LifecycleOverride = 'idea' | 'active' | 'revision' | 'published' | 'cancelled'

export interface PerformanceMetrics {
  views: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  watchTimeMin: number | null
  avgWatchTimeSec: number | null
  /** Stored 0–1. */
  completionRate: number | null
  leads: number | null
  conversions: number | null
  response: string
  rating: string
  keyLearning: string
  repurposePotential: string
  remarks: string
}

export const EMPTY_METRICS: PerformanceMetrics = {
  views: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  watchTimeMin: null,
  avgWatchTimeSec: null,
  completionRate: null,
  leads: null,
  conversions: null,
  response: '',
  rating: '',
  keyLearning: '',
  repurposePotential: '',
  remarks: '',
}

export interface ContentLinks {
  brief: string
  raw: string
  final: string
  published: string
}

export interface ContentItem {
  id: string
  workspaceId: string
  /** Permanent human-readable code, e.g. CN-0001. Never reused. */
  code: string
  /** Planning month, `YYYY-MM`. The dashboard and team performance filter on it. */
  month: string
  title: string
  topic: string
  contentType: string
  category: string
  /** Primary platform; performance is tracked against this one. */
  platform: string
  /** Additional platforms the same asset gets cross-posted to. */
  crossPost: string[]
  objective: string
  audience: string
  /** Member id accountable for the whole item. */
  ownerId: string
  /** stageId -> member id. Generalises the sheet's Script/Shoot/Edit owners. */
  stageAssignees: Record<string, string>
  /** stageId -> ISO date. Generalises the sheet's per-stage deadlines. */
  stageDeadlines: Record<string, string>
  /** stageId -> state. Drives current stage and overall status. */
  stageStates: Record<string, StageState>
  /**
   * stageId -> ISO date the stage became current. Written on transition so
   * "stuck in Editing for 3 days" is a real measurement, not a guess.
   */
  stageEnteredAt: Record<string, string>
  plannedPublishDate: string
  actualPublishDate: string
  priority: string
  lifecycle: LifecycleOverride
  blocker: string
  nextAction: string
  caption: string
  hashtags: string
  links: ContentLinks
  remarks: string
  /** Null until someone starts filling in numbers after publishing. */
  performance: PerformanceMetrics | null
  createdAt: string
  updatedAt: string
  updatedBy: string
  /** Set when converted from an idea, for traceability. */
  fromIdeaId?: string
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskStatus = 'not_started' | 'working' | 'completed' | 'blocked' | 'cancelled'

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'not_started', label: 'Not started' },
  { id: 'working', label: 'Working' },
  { id: 'completed', label: 'Completed' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'cancelled', label: 'Cancelled' },
]

export interface TaskItem {
  id: string
  workspaceId: string
  code: string
  /** Day the task is logged against. */
  date: string
  memberId: string
  title: string
  contentId: string
  /** Optional link to a pipeline stage; completing it can advance the stage. */
  stageId: string
  taskType: string
  priority: string
  deadline: string
  status: TaskStatus
  completionDate: string
  outputLink: string
  remarks: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

export type IdeaStatus = 'new' | 'reviewed' | 'approved' | 'rejected' | 'converted'

export const IDEA_STATUSES: { id: IdeaStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'approved', label: 'Approved' },
  { id: 'converted', label: 'Converted' },
  { id: 'rejected', label: 'Rejected' },
]

export interface Idea {
  id: string
  workspaceId: string
  code: string
  dateAdded: string
  topic: string
  description: string
  contentType: string
  category: string
  platform: string
  audience: string
  objective: string
  reference: string
  priority: string
  potential: string
  status: IdeaStatus
  /** Set when promoted into the content plan. */
  contentId: string
  submittedBy: string
  remarks: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Weekly review
// ---------------------------------------------------------------------------

export type ReviewStatus = 'not_started' | 'open' | 'done'

export interface WeeklyReview {
  id: string
  workspaceId: string
  /** `YYYY-MM-DD` of the week's first day; also the natural sort key. */
  weekStart: string
  weekEnd: string
  label: string
  planned: string
  completed: string
  delayed: string
  performedWell: string
  needsAttention: string
  keyWins: string
  keyProblems: string
  nextPriorities: string
  actionOwnerId: string
  actionDeadline: string
  status: ReviewStatus
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Bundle passed around the app
// ---------------------------------------------------------------------------

export interface WorkspaceData {
  workspace: Workspace
  members: Member[]
  content: ContentItem[]
  tasks: TaskItem[]
  ideas: Idea[]
  reviews: WeeklyReview[]
}

/** Row in the user -> workspace index, so a person can belong to many teams. */
export interface Membership {
  workspaceId: string
  workspaceName: string
  initials: string
  access: AccessLevel
  memberId: string
}
