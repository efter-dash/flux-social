/**
 * Object factories and the human-readable code system.
 *
 * Codes (CN-0001, T-0042, ID-007) come from per-workspace counters rather than
 * from the row count, so deleting an item never causes a code to be reused. The
 * spreadsheet relied on people typing the next number by hand; here it is the
 * storage layer's job.
 */

import type {
  ContentItem,
  Idea,
  Member,
  Stage,
  TaskItem,
  Taxonomies,
  Workspace,
  WeeklyReview,
  AccessLevel,
} from './types'
import { EMPTY_METRICS } from './types'
import { DEFAULT_TAXONOMIES, PIPELINE_TEMPLATES } from './templates'
import { monthKey, today } from './date'

/** Collision-resistant enough for client-generated document ids. */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}${time}${rand}`
}

export function formatCode(prefix: string, n: number, pad = 4): string {
  return `${prefix}-${`${n}`.padStart(pad, '0')}`
}

/** Six characters, no ambiguous 0/O/1/I, for workspace join codes. */
export function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'WS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function stagesFromTemplate(templateId: string): Stage[] {
  const tpl = PIPELINE_TEMPLATES.find((t) => t.id === templateId) ?? PIPELINE_TEMPLATES[0]
  return tpl.stages.map((s) => ({ ...s, id: uid('st_') }))
}

export function newWorkspace(opts: {
  name: string
  templateId: string
  createdBy: string
  contentPrefix?: string
  weekStartsOn?: 0 | 1
  taxonomies?: Taxonomies
}): Workspace {
  return {
    id: uid('ws_'),
    name: opts.name.trim() || 'Untitled workspace',
    initials: initialsFromName(opts.name),
    contentPrefix: (opts.contentPrefix || 'CN').toUpperCase(),
    taskPrefix: 'T',
    ideaPrefix: 'ID',
    counters: { content: 0, task: 0, idea: 0 },
    joinCode: makeJoinCode(),
    joinEnabled: true,
    joinAccess: 'member',
    weekStartsOn: opts.weekStartsOn ?? 1,
    stages: stagesFromTemplate(opts.templateId),
    taxonomies: opts.taxonomies ?? structuredClone(DEFAULT_TAXONOMIES),
    createdAt: new Date().toISOString(),
    createdBy: opts.createdBy,
  }
}

export function newMember(opts: {
  workspaceId: string
  name: string
  email?: string
  role?: string
  access?: AccessLevel
  userId?: string
  responsibility?: string
}): Member {
  return {
    // A signed-in person's member document is keyed by their uid. Firestore
    // security rules can then look up "what is this caller allowed to do here"
    // in a single get() — without it, permissions cannot be enforced server-side.
    // Directory entries added by an admin before that person joins keep a random
    // id until they sign in and get their own row.
    id: opts.userId ?? uid('mb_'),
    workspaceId: opts.workspaceId,
    name: opts.name.trim(),
    email: (opts.email ?? '').trim().toLowerCase(),
    role: opts.role ?? 'Content Writer',
    access: opts.access ?? 'member',
    active: true,
    responsibility: opts.responsibility ?? '',
    contact: '',
    notes: '',
    userId: opts.userId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * A blank content item with every stage map pre-populated, so views can index
 * `stageStates[stage.id]` without null checks.
 */
export function newContentItem(opts: {
  workspaceId: string
  code: string
  stages: Stage[]
  taxonomies: Taxonomies
  ownerId: string
  updatedBy: string
  month?: string
  plannedPublishDate?: string
}): ContentItem {
  const stageStates: Record<string, ContentItem['stageStates'][string]> = {}
  const stageAssignees: Record<string, string> = {}
  const stageDeadlines: Record<string, string> = {}
  for (const s of opts.stages) {
    stageStates[s.id] = 'pending'
    stageAssignees[s.id] = ''
    stageDeadlines[s.id] = ''
  }
  const nowISO = new Date().toISOString()
  const planned = opts.plannedPublishDate ?? ''
  return {
    id: uid('cn_'),
    workspaceId: opts.workspaceId,
    code: opts.code,
    month: opts.month ?? (planned ? monthKey(planned) : monthKey(today())),
    title: '',
    topic: '',
    contentType: opts.taxonomies.contentTypes[0] ?? '',
    category: opts.taxonomies.categories[0] ?? '',
    platform: opts.taxonomies.platforms[0]?.label ?? '',
    crossPost: [],
    objective: '',
    audience: '',
    ownerId: opts.ownerId,
    stageAssignees,
    stageDeadlines,
    stageStates,
    stageEnteredAt: opts.stages[0] ? { [opts.stages[0].id]: today() } : {},
    plannedPublishDate: planned,
    actualPublishDate: '',
    priority: opts.taxonomies.priorities[1] ?? opts.taxonomies.priorities[0] ?? 'Medium',
    lifecycle: 'idea',
    blocker: '',
    nextAction: '',
    caption: '',
    hashtags: '',
    links: { brief: '', raw: '', final: '', published: '' },
    remarks: '',
    performance: null,
    createdAt: nowISO,
    updatedAt: nowISO,
    updatedBy: opts.updatedBy,
  }
}

export function newTask(opts: {
  workspaceId: string
  code: string
  memberId: string
  taxonomies: Taxonomies
  date?: string
}): TaskItem {
  const nowISO = new Date().toISOString()
  const d = opts.date ?? today()
  return {
    id: uid('tk_'),
    workspaceId: opts.workspaceId,
    code: opts.code,
    date: d,
    memberId: opts.memberId,
    title: '',
    contentId: '',
    stageId: '',
    taskType: opts.taxonomies.taskTypes[0] ?? '',
    priority: opts.taxonomies.priorities[1] ?? 'Medium',
    deadline: d,
    status: 'not_started',
    completionDate: '',
    outputLink: '',
    remarks: '',
    createdAt: nowISO,
    updatedAt: nowISO,
  }
}

export function newIdea(opts: {
  workspaceId: string
  code: string
  taxonomies: Taxonomies
  submittedBy: string
}): Idea {
  return {
    id: uid('id_'),
    workspaceId: opts.workspaceId,
    code: opts.code,
    dateAdded: today(),
    topic: '',
    description: '',
    contentType: opts.taxonomies.contentTypes[0] ?? '',
    category: opts.taxonomies.categories[0] ?? '',
    platform: opts.taxonomies.platforms[0]?.label ?? '',
    audience: '',
    objective: '',
    reference: '',
    priority: opts.taxonomies.priorities[1] ?? 'Medium',
    potential: opts.taxonomies.ideaPotentials[1] ?? 'Medium',
    status: 'new',
    contentId: '',
    submittedBy: opts.submittedBy,
    remarks: '',
    createdAt: new Date().toISOString(),
  }
}

export function newReview(opts: {
  workspaceId: string
  weekStart: string
  weekEnd: string
  label: string
}): WeeklyReview {
  return {
    id: uid('wr_'),
    workspaceId: opts.workspaceId,
    weekStart: opts.weekStart,
    weekEnd: opts.weekEnd,
    label: opts.label,
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
}

/** Called when an idea is approved and promoted into the plan. */
export function contentFromIdea(
  idea: Idea,
  base: ContentItem,
): ContentItem {
  return {
    ...base,
    title: idea.topic,
    topic: idea.topic,
    contentType: idea.contentType || base.contentType,
    category: idea.category || base.category,
    platform: idea.platform || base.platform,
    objective: idea.objective,
    audience: idea.audience,
    priority: idea.priority || base.priority,
    remarks: idea.description ? `From idea ${idea.code}: ${idea.description}` : base.remarks,
    fromIdeaId: idea.id,
  }
}

export function blankMetrics() {
  return { ...EMPTY_METRICS }
}
