/**
 * Aggregations: the dashboard, team performance, weekly rollups and alerts.
 *
 * These replace the spreadsheet's Dashboard, Team Performance and Weekly Review
 * formula blocks. Note the generalisation: the sheet hard-coded "Videos Edited",
 * "Videos Shot" and "Scripts Completed" columns, which only make sense for a
 * video team. Here the same numbers come from `stageThroughput`, one column per
 * configured pipeline stage, whatever those stages happen to be.
 */

import type { ContentItem, Member, Stage, TaskItem, WorkspaceData, Idea } from './types'
import {
  allStagesComplete,
  currentStage,
  daysInCurrentStage,
  engagement,
  engagementRate,
  isOverdue,
  isPublished,
  isTaskOnTime,
  isTaskOpen,
  isTaskOverdue,
  hasMetrics,
  overallStatus,
  publishTiming,
  responsibleMemberId,
  stageState,
  type OverallStatus,
} from './derive'
import { daysBetween, isInRange, monthKey, today as todayISO, addDays } from './date'

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface StageBucket {
  stage: Stage
  /** Items whose current stage is this one. */
  waiting: number
  /** Times this stage was completed within the period. */
  completed: number
}

export interface DashboardSummary {
  planned: number
  completed: number
  published: number
  inProduction: number
  ready: number
  overdue: number
  blocked: number
  onTimeRate: number | null
  stageBuckets: StageBucket[]
  statusCounts: Record<OverallStatus, number>
  byPlatform: { label: string; value: number }[]
  byType: { label: string; value: number }[]
  byWeek: { label: string; planned: number; published: number }[]
  totals: {
    views: number
    reach: number
    engagement: number
    leads: number
    conversions: number
    engagementRate: number | null
  }
}

export function dashboardSummary(
  data: WorkspaceData,
  month: string,
  now: string = todayISO(),
): DashboardSummary {
  const { workspace, content } = data
  const stages = workspace.stages
  const scope = content.filter((c) => c.month === month && c.lifecycle !== 'cancelled')

  const statusCounts = {
    idea: 0,
    on_track: 0,
    delayed: 0,
    blocked: 0,
    ready: 0,
    published: 0,
    cancelled: 0,
  } as Record<OverallStatus, number>

  let published = 0
  let ready = 0
  let overdue = 0
  let blocked = 0
  let inProduction = 0

  for (const item of scope) {
    const status = overallStatus(item, stages, now)
    statusCounts[status]++
    if (status === 'published') published++
    if (status === 'ready') ready++
    if (status === 'blocked') blocked++
    if (isOverdue(item, stages, now)) overdue++
    const started = stages.some((s) => stageState(item, s.id) !== 'pending')
    if (!isPublished(item) && started && !allStagesComplete(item, stages)) inProduction++
  }

  // Waiting counts per stage: whichever stage the item currently sits in.
  const stageBuckets: StageBucket[] = stages.map((stage) => {
    let waiting = 0
    for (const item of scope) {
      if (isPublished(item)) continue
      if (currentStage(item, stages)?.id === stage.id) waiting++
    }
    const completed = scope.filter((item) => stageState(item, stage.id) === 'complete').length
    return { stage, waiting, completed }
  })

  // On-time rate over everything actually published in the month.
  const publishedItems = scope.filter(isPublished)
  const timed = publishedItems.filter((c) => c.plannedPublishDate && c.actualPublishDate)
  const onTime = timed.filter((c) => publishTiming(c) !== 'late').length
  const onTimeRate = timed.length ? onTime / timed.length : null

  const byPlatform = countBy(scope, (c) => c.platform || 'Unassigned')
  const byType = countBy(scope, (c) => c.contentType || 'Unassigned')

  const byWeek = weekBuckets(scope, month, workspace.weekStartsOn)

  const totals = { views: 0, reach: 0, engagement: 0, leads: 0, conversions: 0, engagementRate: null as number | null }
  for (const item of publishedItems) {
    const m = item.performance
    if (!m) continue
    totals.views += m.views ?? 0
    totals.reach += m.reach ?? 0
    totals.engagement += engagement(m) ?? 0
    totals.leads += m.leads ?? 0
    totals.conversions += m.conversions ?? 0
  }
  const denom = totals.views || totals.reach
  totals.engagementRate = denom ? totals.engagement / denom : null

  return {
    planned: scope.length,
    completed: ready + published,
    published,
    inProduction,
    ready,
    overdue,
    blocked,
    onTimeRate,
    stageBuckets,
    statusCounts,
    byPlatform,
    byType,
    byWeek,
    totals,
  }
}

function countBy<T>(items: T[], key: (t: T) => string): { label: string; value: number }[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function weekBuckets(items: ContentItem[], month: string, weekStartsOn: 0 | 1) {
  const buckets = new Map<number, { planned: number; published: number }>()
  for (const item of items) {
    const ref = item.plannedPublishDate || item.actualPublishDate
    if (!ref) continue
    const w = weekIndexInMonth(ref, month, weekStartsOn)
    if (w === null) continue
    const b = buckets.get(w) ?? { planned: 0, published: 0 }
    b.planned++
    if (isPublished(item)) b.published++
    buckets.set(w, b)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, v]) => ({ label: `W${w}`, planned: v.planned, published: v.published }))
}

function weekIndexInMonth(date: string, month: string, weekStartsOn: 0 | 1): number | null {
  if (monthKey(date) !== month) return null
  const first = `${month}-01`
  const d = new Date(first)
  const shift = (d.getDay() - weekStartsOn + 7) % 7
  const firstWeekStart = addDays(first, -shift)
  const diff = daysBetween(firstWeekStart, date)
  if (diff === null) return null
  return Math.floor(diff / 7) + 1
}

// ---------------------------------------------------------------------------
// Team performance
// ---------------------------------------------------------------------------

export interface MemberScore {
  member: Member
  assigned: number
  completed: number
  pending: number
  overdue: number
  onTime: number
  late: number
  completionRate: number | null
  /** stageId -> completions attributable to this member in the period. */
  stageCompletions: Record<string, number>
  publishedOwned: number
  /** Items currently waiting on this person. */
  awaiting: number
}

export function teamPerformance(
  data: WorkspaceData,
  month: string,
  now: string = todayISO(),
): MemberScore[] {
  const { members, tasks, content, workspace } = data
  const stages = workspace.stages
  const monthTasks = tasks.filter((t) => monthKey(t.date) === month || monthKey(t.deadline) === month)
  const monthContent = content.filter((c) => c.month === month && c.lifecycle !== 'cancelled')

  return members
    .filter((m) => m.active)
    .map((member) => {
      const mine = monthTasks.filter((t) => t.memberId === member.id)
      const completed = mine.filter((t) => t.status === 'completed')
      const pending = mine.filter(isTaskOpen)
      const overdue = mine.filter((t) => isTaskOverdue(t, now))
      const onTime = completed.filter(isTaskOnTime)

      const stageCompletions: Record<string, number> = {}
      for (const stage of stages) {
        stageCompletions[stage.id] = monthContent.filter(
          (c) => c.stageAssignees?.[stage.id] === member.id && stageState(c, stage.id) === 'complete',
        ).length
      }

      const publishedOwned = monthContent.filter((c) => c.ownerId === member.id && isPublished(c)).length
      const awaiting = monthContent.filter(
        (c) => !isPublished(c) && responsibleMemberId(c, stages) === member.id,
      ).length

      return {
        member,
        assigned: mine.length,
        completed: completed.length,
        pending: pending.length,
        overdue: overdue.length,
        onTime: onTime.length,
        late: completed.length - onTime.length,
        completionRate: mine.length ? completed.length / mine.length : null,
        stageCompletions,
        publishedOwned,
        awaiting,
      }
    })
}

export interface LeaderboardEntry {
  title: string
  name: string
  score: string
}

export function leaderboard(scores: MemberScore[], stages: Stage[]): LeaderboardEntry[] {
  const out: LeaderboardEntry[] = []

  const best = <T>(list: MemberScore[], value: (s: MemberScore) => number, title: string, fmt: (n: number) => string) => {
    const ranked = [...list].sort((a, b) => value(b) - value(a))
    const top = ranked[0]
    if (top && value(top) > 0) out.push({ title, name: top.member.name, score: fmt(value(top)) })
    return null as T | null
  }

  // One entry per pipeline stage, so the leaderboard adapts to the workspace.
  for (const stage of stages) {
    best(scores, (s) => s.stageCompletions[stage.id] ?? 0, `Most ${stage.name.toLowerCase()} completed`, (n) => `${n}`)
  }
  best(scores, (s) => s.onTime, 'Most on time', (n) => `${n} tasks`)
  best(
    scores.filter((s) => s.assigned >= 1),
    (s) => s.completionRate ?? 0,
    'Highest completion rate',
    (n) => `${Math.round(n * 100)}%`,
  )
  return out
}

// ---------------------------------------------------------------------------
// Weekly rollup
// ---------------------------------------------------------------------------

export interface WeekRollup {
  planned: number
  produced: number
  published: number
  pending: number
  overdue: number
  stageCompletions: { stage: Stage; count: number }[]
  topContent: ContentItem | null
  bottomContent: ContentItem | null
}

export function weekRollup(
  data: WorkspaceData,
  start: string,
  end: string,
  now: string = todayISO(),
): WeekRollup {
  const { content, workspace } = data
  const stages = workspace.stages
  const inWeek = content.filter(
    (c) =>
      c.lifecycle !== 'cancelled' &&
      (isInRange(c.plannedPublishDate, start, end) || isInRange(c.actualPublishDate, start, end)),
  )
  const published = inWeek.filter((c) => isInRange(c.actualPublishDate, start, end))
  const produced = inWeek.filter((c) => allStagesComplete(c, stages))
  const pending = inWeek.filter((c) => !isPublished(c))
  const overdue = inWeek.filter((c) => isOverdue(c, stages, now))

  const stageCompletions = stages.map((stage) => ({
    stage,
    count: inWeek.filter((c) => stageState(c, stage.id) === 'complete').length,
  }))

  const rated = published
    .filter((c) => engagementRate(c.performance) !== null)
    .sort((a, b) => (engagementRate(b.performance) ?? 0) - (engagementRate(a.performance) ?? 0))

  return {
    planned: inWeek.length,
    produced: produced.length,
    published: published.length,
    pending: pending.length,
    overdue: overdue.length,
    stageCompletions,
    topContent: rated[0] ?? null,
    bottomContent: rated.length > 1 ? rated[rated.length - 1] : null,
  }
}

// ---------------------------------------------------------------------------
// Alerts (the in-app notification feed)
// ---------------------------------------------------------------------------

export type AlertKind = 'overdue' | 'blocked' | 'stuck' | 'due_soon' | 'task_overdue' | 'missing_metrics' | 'idea_ready'

export interface Alert {
  /** Stable across reloads so dismissals persist. */
  id: string
  kind: AlertKind
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  /** Route to open when tapped. */
  href: string
  memberId?: string
  date?: string
}

const STUCK_DAYS = 5
const METRICS_GRACE_DAYS = 3
const DUE_SOON_DAYS = 2

export function buildAlerts(data: WorkspaceData, now: string = todayISO()): Alert[] {
  const { content, tasks, ideas, workspace, members } = data
  const stages = workspace.stages
  const out: Alert[] = []
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unassigned'

  for (const item of content) {
    if (item.lifecycle === 'cancelled') continue
    const stage = currentStage(item, stages)

    if (item.blocker?.trim() && !isPublished(item)) {
      out.push({
        id: `blocked:${item.id}`,
        kind: 'blocked',
        severity: 'high',
        title: `${item.code} is blocked`,
        detail: item.blocker.trim(),
        href: `/content/${item.id}`,
        memberId: responsibleMemberId(item, stages),
      })
    } else if (isOverdue(item, stages, now)) {
      const days = item.plannedPublishDate ? Math.abs(daysBetween(now, item.plannedPublishDate) ?? 0) : 0
      out.push({
        id: `overdue:${item.id}`,
        kind: 'overdue',
        severity: 'high',
        title: `${item.code} is overdue`,
        detail: `${item.title || 'Untitled'} — ${days ? `${days} day${days === 1 ? '' : 's'} past the publish date` : 'stage deadline passed'}`,
        href: `/content/${item.id}`,
        memberId: responsibleMemberId(item, stages),
        date: item.plannedPublishDate,
      })
    }

    if (stage && !isPublished(item)) {
      const idle = daysInCurrentStage(item, stages, now)
      if (idle !== null && idle >= STUCK_DAYS && !item.blocker?.trim() && !isOverdue(item, stages, now)) {
        out.push({
          id: `stuck:${item.id}:${stage.id}`,
          kind: 'stuck',
          severity: 'medium',
          title: `${item.code} has sat in ${stage.name} for ${idle} days`,
          detail: `Waiting on ${nameOf(responsibleMemberId(item, stages))}`,
          href: `/content/${item.id}`,
          memberId: responsibleMemberId(item, stages),
        })
      }
    }

    if (!isPublished(item) && item.plannedPublishDate) {
      const d = daysBetween(now, item.plannedPublishDate)
      if (d !== null && d >= 0 && d <= DUE_SOON_DAYS) {
        out.push({
          id: `soon:${item.id}`,
          kind: 'due_soon',
          severity: 'medium',
          title: `${item.code} publishes ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`,
          detail: item.title || 'Untitled',
          href: `/content/${item.id}`,
          memberId: responsibleMemberId(item, stages),
          date: item.plannedPublishDate,
        })
      }
    }

    if (isPublished(item) && !hasMetrics(item.performance)) {
      const since = item.actualPublishDate ? daysBetween(item.actualPublishDate, now) : null
      if (since !== null && since >= METRICS_GRACE_DAYS) {
        out.push({
          id: `metrics:${item.id}`,
          kind: 'missing_metrics',
          severity: 'low',
          title: `${item.code} has no performance numbers`,
          detail: `Published ${since} days ago`,
          href: `/publishing`,
          memberId: item.ownerId,
        })
      }
    }
  }

  for (const task of tasks) {
    if (!isTaskOverdue(task, now)) continue
    out.push({
      id: `task:${task.id}`,
      kind: 'task_overdue',
      severity: task.status === 'blocked' ? 'high' : 'medium',
      title: `${task.code} is overdue`,
      detail: `${task.title || 'Untitled task'} — ${nameOf(task.memberId)}`,
      href: '/tasks',
      memberId: task.memberId,
      date: task.deadline,
    })
  }

  for (const idea of ideas) {
    if (idea.status !== 'approved' || idea.contentId) continue
    out.push({
      id: `idea:${idea.id}`,
      kind: 'idea_ready',
      severity: 'low',
      title: `${idea.code} is approved but not scheduled`,
      detail: idea.topic || 'Untitled idea',
      href: '/ideas',
    })
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

// ---------------------------------------------------------------------------
// Personal view
// ---------------------------------------------------------------------------

export interface MyWork {
  tasksToday: TaskItem[]
  tasksOverdue: TaskItem[]
  tasksUpcoming: TaskItem[]
  awaitingMe: ContentItem[]
}

export function myWork(data: WorkspaceData, memberId: string, now: string = todayISO()): MyWork {
  const { tasks, content, workspace } = data
  const mine = tasks.filter((t) => t.memberId === memberId && isTaskOpen(t))
  const horizon = addDays(now, 7)
  return {
    tasksToday: mine.filter((t) => t.deadline === now || t.date === now),
    tasksOverdue: mine.filter((t) => isTaskOverdue(t, now)),
    tasksUpcoming: mine.filter((t) => t.deadline > now && t.deadline <= horizon),
    awaitingMe: content.filter(
      (c) =>
        c.lifecycle !== 'cancelled' &&
        !isPublished(c) &&
        responsibleMemberId(c, workspace.stages) === memberId,
    ),
  }
}

/** Ideas grouped for the funnel strip on the ideas page. */
export function ideaFunnel(ideas: Idea[]) {
  const counts = { new: 0, reviewed: 0, approved: 0, converted: 0, rejected: 0 }
  for (const i of ideas) counts[i.status]++
  return counts
}
