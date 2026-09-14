/**
 * Derived fields — the replacement for every formula column in the spreadsheet.
 *
 * All functions here are pure and take `now` explicitly so views can be tested
 * and so a single render pass never sees two different "todays". Nothing in this
 * file is ever written back to storage.
 */

import type { ContentItem, Member, PerformanceMetrics, Stage, TaskItem } from './types'
import { daysBetween, isInRange, monthKey, today as todayISO } from './date'

// ---------------------------------------------------------------------------
// Status vocabulary
// ---------------------------------------------------------------------------

export type OverallStatus = 'idea' | 'on_track' | 'delayed' | 'blocked' | 'ready' | 'published' | 'cancelled'

export const OVERALL_STATUS_LABEL: Record<OverallStatus, string> = {
  idea: 'Idea',
  on_track: 'On track',
  delayed: 'Delayed',
  blocked: 'Blocked',
  ready: 'Ready',
  published: 'Published',
  cancelled: 'Cancelled',
}

/** Semantic colour key; components map these to Tailwind classes. */
export type Tone = 'neutral' | 'primary' | 'violet' | 'emerald' | 'amber' | 'danger'

export const OVERALL_STATUS_TONE: Record<OverallStatus, Tone> = {
  idea: 'neutral',
  on_track: 'primary',
  delayed: 'danger',
  blocked: 'danger',
  ready: 'violet',
  published: 'emerald',
  cancelled: 'neutral',
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function stageState(item: ContentItem, stageId: string) {
  return item.stageStates?.[stageId] ?? 'pending'
}

export function stageProgress(item: ContentItem, stages: Stage[]) {
  const total = stages.length
  const complete = stages.filter((s) => stageState(item, s.id) === 'complete').length
  return { complete, total, pct: total === 0 ? 0 : Math.round((complete / total) * 100) }
}

export function allStagesComplete(item: ContentItem, stages: Stage[]): boolean {
  return stages.length > 0 && stages.every((s) => stageState(item, s.id) === 'complete')
}

/**
 * The first stage that is not yet complete — the one the work actually sits in.
 * Returns null once every stage is done.
 */
export function currentStage(item: ContentItem, stages: Stage[]): Stage | null {
  return stages.find((s) => stageState(item, s.id) !== 'complete') ?? null
}

export function isPublished(item: ContentItem): boolean {
  return item.lifecycle === 'published' || Boolean(item.actualPublishDate)
}

/** Who the next move belongs to: the current stage's assignee, else the owner. */
export function responsibleMemberId(item: ContentItem, stages: Stage[]): string {
  if (isPublished(item)) return item.ownerId
  const stage = currentStage(item, stages)
  if (!stage) return item.ownerId
  return item.stageAssignees?.[stage.id] || item.ownerId
}

/** Deadline governing the current stage, falling back to the publish date. */
export function activeDeadline(item: ContentItem, stages: Stage[]): string {
  const stage = currentStage(item, stages)
  if (stage) {
    const d = item.stageDeadlines?.[stage.id]
    if (d) return d
  }
  return item.plannedPublishDate || ''
}

/** Days until the planned publish date. Negative once the date has passed. */
export function daysRemaining(item: ContentItem, now: string = todayISO()): number | null {
  if (!item.plannedPublishDate) return null
  return daysBetween(now, item.plannedPublishDate)
}

/**
 * Overdue means unpublished work whose planned publish date — or whose current
 * stage deadline — is already in the past.
 */
export function isOverdue(item: ContentItem, stages: Stage[], now: string = todayISO()): boolean {
  if (isPublished(item) || item.lifecycle === 'cancelled') return false
  const publishDue = item.plannedPublishDate && item.plannedPublishDate < now
  const stage = currentStage(item, stages)
  const stageDue = stage ? Boolean(item.stageDeadlines?.[stage.id] && item.stageDeadlines[stage.id] < now) : false
  return Boolean(publishDue || stageDue)
}

/** How long the item has sat in its current stage. */
export function daysInCurrentStage(item: ContentItem, stages: Stage[], now: string = todayISO()): number | null {
  const stage = currentStage(item, stages)
  if (!stage) return null
  const entered = item.stageEnteredAt?.[stage.id] || item.createdAt?.slice(0, 10)
  if (!entered) return null
  return daysBetween(entered, now)
}

/** The single status shown on badges everywhere. Mirrors the sheet's logic. */
export function overallStatus(item: ContentItem, stages: Stage[], now: string = todayISO()): OverallStatus {
  if (item.lifecycle === 'cancelled') return 'cancelled'
  if (isPublished(item)) return 'published'
  if (item.blocker?.trim() || stages.some((s) => stageState(item, s.id) === 'blocked')) return 'blocked'
  if (isOverdue(item, stages, now)) return 'delayed'
  if (allStagesComplete(item, stages)) return 'ready'
  if (item.lifecycle === 'idea' && stages.every((s) => stageState(item, s.id) === 'pending')) return 'idea'
  return 'on_track'
}

/** Human stage label: "Idea", "Editing", "Ready to publish", "Published". */
export function stageLabel(item: ContentItem, stages: Stage[]): string {
  if (item.lifecycle === 'cancelled') return 'Cancelled'
  if (isPublished(item)) return 'Published'
  if (item.lifecycle === 'revision') return 'Revision'
  if (allStagesComplete(item, stages)) return 'Ready to publish'
  const stage = currentStage(item, stages)
  if (!stage) return 'Ready to publish'
  if (item.lifecycle === 'idea' && stages.every((s) => stageState(item, s.id) === 'pending')) return 'Idea'
  return stage.name
}

/**
 * Action label for a stage: "Write Script", but just "Review" when the verb and
 * the stage name are the same word, so buttons never read "Review Review".
 */
export function stageAction(stage: Stage): string {
  const verb = stage.verb?.trim()
  if (!verb) return `Complete ${stage.name}`
  if (verb.toLowerCase() === stage.name.toLowerCase()) return stage.name
  return `${verb} ${stage.name}`
}

/** Next action text, falling back to a sensible suggestion. */
export function nextActionText(item: ContentItem, stages: Stage[]): string {
  if (item.nextAction?.trim()) return item.nextAction.trim()
  if (isPublished(item)) return 'Monitor performance'
  if (allStagesComplete(item, stages)) return 'Schedule and publish'
  const stage = currentStage(item, stages)
  if (!stage) return '—'
  return `${stage.verb || 'Complete'} ${stage.name.toLowerCase()}`
}

// ---------------------------------------------------------------------------
// Publishing & performance
// ---------------------------------------------------------------------------

export type PublishTiming = 'pending' | 'on_time' | 'late' | 'early'

export const PUBLISH_TIMING_LABEL: Record<PublishTiming, string> = {
  pending: 'Not published',
  on_time: 'On time',
  late: 'Late',
  early: 'Early',
}

export function publishTiming(item: ContentItem): PublishTiming {
  if (!item.actualPublishDate) return 'pending'
  if (!item.plannedPublishDate) return 'on_time'
  if (item.actualPublishDate > item.plannedPublishDate) return 'late'
  if (item.actualPublishDate < item.plannedPublishDate) return 'early'
  return 'on_time'
}

/** Likes + comments + shares + saves, exactly as the spreadsheet defined it. */
export function engagement(m: PerformanceMetrics | null): number | null {
  if (!m) return null
  const parts = [m.likes, m.comments, m.shares, m.saves]
  if (parts.every((p) => p === null)) return null
  return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0)
}

/** Engagement over views (reach as a fallback). Returned as a 0–1 fraction. */
export function engagementRate(m: PerformanceMetrics | null): number | null {
  const e = engagement(m)
  if (e === null || !m) return null
  const denom = m.views || m.reach
  if (!denom) return null
  return e / denom
}

export function hasMetrics(m: PerformanceMetrics | null): boolean {
  if (!m) return false
  return [m.views, m.reach, m.likes, m.comments, m.shares, m.saves, m.leads, m.conversions].some(
    (v) => v !== null && v !== undefined,
  )
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function isTaskOverdue(task: TaskItem, now: string = todayISO()): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false
  if (!task.deadline) return false
  return task.deadline < now
}

export function isTaskOpen(task: TaskItem): boolean {
  return task.status !== 'completed' && task.status !== 'cancelled'
}

/** Completed on or before the deadline. */
export function isTaskOnTime(task: TaskItem): boolean {
  if (task.status !== 'completed') return false
  if (!task.deadline || !task.completionDate) return task.status === 'completed'
  return task.completionDate <= task.deadline
}

export function taskTone(task: TaskItem, now: string = todayISO()): Tone {
  if (task.status === 'completed') return 'emerald'
  if (task.status === 'cancelled') return 'neutral'
  if (task.status === 'blocked') return 'danger'
  if (isTaskOverdue(task, now)) return 'danger'
  if (task.status === 'working') return 'amber'
  return 'neutral'
}

// ---------------------------------------------------------------------------
// Lookups & formatting
// ---------------------------------------------------------------------------

export function memberName(members: Member[], id: string): string {
  if (!id) return 'Unassigned'
  return members.find((m) => m.id === id)?.name ?? 'Unassigned'
}

export function memberById(members: Member[], id: string): Member | undefined {
  return members.find((m) => m.id === id)
}

export function memberRole(members: Member[], id: string): string {
  return members.find((m) => m.id === id)?.role ?? '—'
}

/** Suggests the best assignee for a stage: an active member with that job role. */
export function suggestAssignee(members: Member[], stage: Stage): string {
  const match = members.filter((m) => m.active && m.role === stage.ownerRole)
  return match[0]?.id ?? ''
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Stable hue per person so avatar colours never shuffle between sessions. */
export function hueOf(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US')
}

/** 12500 -> "12.5K". Used on metric tiles where space is tight. */
export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${trimZero(n / 1_000_000)}M`
  if (abs >= 1_000) return `${trimZero(n / 1_000)}K`
  return `${n}`
}

function trimZero(n: number): string {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/** 0.0796 -> "7.96%". */
export function fmtPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function fmtSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString('en-US')}` : n.toLocaleString('en-US')
}

// ---------------------------------------------------------------------------
// Scoping helpers used by every view
// ---------------------------------------------------------------------------

export function inMonth(item: ContentItem, month: string): boolean {
  return item.month === month
}

export function tasksInRange(tasks: TaskItem[], start: string, end: string): TaskItem[] {
  return tasks.filter((t) => isInRange(t.date, start, end) || isInRange(t.deadline, start, end))
}

export function contentInRange(content: ContentItem[], start: string, end: string): ContentItem[] {
  return content.filter(
    (c) => isInRange(c.plannedPublishDate, start, end) || isInRange(c.actualPublishDate, start, end),
  )
}

export function publishedInMonth(content: ContentItem[], month: string): ContentItem[] {
  return content.filter((c) => isPublished(c) && monthKey(c.actualPublishDate || c.plannedPublishDate) === month)
}
