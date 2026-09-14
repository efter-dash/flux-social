/**
 * Content building blocks shared by the plan, pipeline, calendar and detail views.
 */

import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import {
  Avatar,
  PlatformChip,
  PriorityFlag,
  StatusChip,
  cx,
  TONE_FILL,
} from '@/components/ui/primitives'
import type { ContentItem, Member, Stage, StageState, Workspace } from '@/lib/types'
import {
  OVERALL_STATUS_TONE,
  currentStage,
  daysInCurrentStage,
  daysRemaining,
  isOverdue,
  isPublished,
  memberName,
  overallStatus,
  stageLabel,
  stageProgress,
  stageState,
  type Tone,
} from '@/lib/derive'
import { fmtDate, relativeDays } from '@/lib/date'

export const STATE_TONE: Record<StageState, Tone> = {
  pending: 'neutral',
  in_progress: 'amber',
  complete: 'emerald',
  blocked: 'danger',
}

export const STATE_LABEL: Record<StageState, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  complete: 'Complete',
  blocked: 'Blocked',
}

/** Cycles a stage forward through the states people actually use. */
export function nextStageState(s: StageState): StageState {
  if (s === 'pending') return 'in_progress'
  if (s === 'in_progress') return 'complete'
  if (s === 'complete') return 'pending'
  return 'in_progress' // blocked -> back to work
}

// ---------------------------------------------------------------------------
// Stage track
// ---------------------------------------------------------------------------

/**
 * The pipeline as a row of segments. Interactive when `onToggle` is given —
 * tapping a segment advances that stage, which is how most status updates get
 * made in practice.
 */
export function StageTrack({
  item,
  stages,
  onToggle,
  showLabels = false,
  size = 'md',
}: {
  item: ContentItem
  stages: Stage[]
  onToggle?: (stageId: string, next: StageState) => void
  showLabels?: boolean
  size?: 'sm' | 'md'
}) {
  const published = isPublished(item)
  const active = currentStage(item, stages)

  return (
    <div className={cx('flex w-full items-stretch', size === 'sm' ? 'gap-1' : 'gap-1.5')}>
      {stages.map((stage) => {
        const state: StageState = published ? 'complete' : stageState(item, stage.id)
        const isCurrent = !published && active?.id === stage.id
        const tone = STATE_TONE[state]
        const Tag = onToggle ? 'button' : 'div'
        return (
          <Tag
            key={stage.id}
            {...(onToggle
              ? {
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggle(stage.id, nextStageState(state))
                  },
                  title: `${stage.name}: ${STATE_LABEL[state]} — click to advance`,
                  type: 'button' as const,
                }
              : { title: `${stage.name}: ${STATE_LABEL[state]}` })}
            className={cx('group min-w-0 flex-1 text-left', onToggle && 'cursor-pointer')}
          >
            <span
              className={cx(
                'block w-full rounded-full transition-all duration-300',
                size === 'sm' ? 'h-1' : 'h-1.5',
                state === 'pending' && 'bg-sunken',
                state === 'in_progress' && 'animate-pulse-soft',
                isCurrent && state !== 'pending' && 'ring-1 ring-white/20',
                onToggle && 'group-hover:brightness-125',
              )}
              style={
                state === 'pending'
                  ? undefined
                  : { backgroundColor: TONE_FILL[tone], boxShadow: `0 0 8px ${TONE_FILL[tone]}66` }
              }
            />
            {showLabels && (
              <span
                className={cx(
                  'mt-1.5 block truncate font-mono text-label-micro uppercase transition-colors',
                  isCurrent ? 'text-ink' : state === 'complete' ? 'text-emerald/80' : 'text-ink-faint',
                )}
              >
                {stage.name}
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status summary
// ---------------------------------------------------------------------------

export function ContentStatus({ item, stages }: { item: ContentItem; stages: Stage[] }) {
  const status = overallStatus(item, stages)
  // Colour alone is too easy to miss, so trouble states also carry a glyph and
  // name themselves — the stage stays visible elsewhere on the card.
  const label =
    status === 'blocked' ? 'Blocked' : status === 'delayed' ? `Late · ${stageLabel(item, stages)}` : stageLabel(item, stages)
  return (
    <StatusChip tone={OVERALL_STATUS_TONE[status]} dot={status !== 'blocked' && status !== 'delayed'}>
      {status === 'blocked' && <Icon name="block" size={11} />}
      {status === 'delayed' && <Icon name="alert" size={11} />}
      {label}
    </StatusChip>
  )
}

/** Deadline chip that turns red once the date has passed. */
export function DeadlineChip({ item, stages }: { item: ContentItem; stages: Stage[] }) {
  if (isPublished(item)) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label-micro uppercase text-emerald">
        <Icon name="check" size={12} />
        {fmtDate(item.actualPublishDate)}
      </span>
    )
  }
  if (!item.plannedPublishDate) {
    return <span className="font-mono text-label-micro uppercase text-ink-faint">No date</span>
  }
  const late = isOverdue(item, stages)
  const d = daysRemaining(item)
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 font-mono text-label-micro uppercase',
        late ? 'text-danger' : d !== null && d <= 2 ? 'text-amber' : 'text-ink-faint',
      )}
    >
      <Icon name={late ? 'alert' : 'clock'} size={12} />
      {fmtDate(item.plannedPublishDate)}
      <span className="opacity-70">· {relativeDays(d)}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Cards & rows
// ---------------------------------------------------------------------------

/**
 * Mobile-first content card, modelled on the Posts Manager mockup: platform
 * badge, schedule line, title, blocker, stage track and the people on it.
 */
export function ContentCard({
  item,
  workspace,
  members,
  onToggleStage,
}: {
  item: ContentItem
  workspace: Workspace
  members: Member[]
  onToggleStage?: (stageId: string, next: StageState) => void
}) {
  const stages = workspace.stages
  const platform = workspace.taxonomies.platforms.find((p) => p.label === item.platform)
  const owner = memberName(members, item.ownerId)
  const stage = currentStage(item, stages)
  const idle = daysInCurrentStage(item, stages)
  const progress = stageProgress(item, stages)

  return (
    <Link
      to={`/content/${item.id}`}
      className="group block rounded-lg border border-line/60 bg-panel p-3.5 transition-colors duration-150 hover:border-line hover:bg-raised/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <PlatformChip label={item.platform || '—'} color={platform?.color} size="sm" />
          {item.crossPost.slice(0, 2).map((p) => {
            const c = workspace.taxonomies.platforms.find((x) => x.label === p)
            return <PlatformChip key={p} label={p} color={c?.color} size="sm" />
          })}
          <span className="font-mono text-label-micro text-ink-faint">{item.code}</span>
        </div>
        <ContentStatus item={item} stages={stages} />
      </div>

      <h3 className="mt-2 line-clamp-2 text-body-md font-medium leading-snug text-ink group-hover:text-primary">
        {item.title || 'Untitled'}
      </h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DeadlineChip item={item} stages={stages} />
        <PriorityFlag priority={item.priority} />
        {item.contentType && (
          <span className="font-mono text-label-micro uppercase text-ink-faint">{item.contentType}</span>
        )}
      </div>

      {item.blocker && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded border border-danger/25 bg-danger/10 px-2 py-1.5 text-body-xs text-danger">
          <Icon name="block" size={13} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{item.blocker}</span>
        </p>
      )}

      <div className="mt-3">
        <StageTrack item={item} stages={stages} onToggle={onToggleStage} size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={owner} size={22} />
          <span className="min-w-0">
            <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
              {stage ? `${stage.name} · ${memberName(members, item.stageAssignees?.[stage.id] ?? '')}` : 'Complete'}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-label-micro uppercase text-ink-faint">
          {idle !== null && idle >= 3 && !isPublished(item) && (
            <span className="text-amber">idle {idle}d</span>
          )}
          {progress.complete}/{progress.total}
        </span>
      </div>
    </Link>
  )
}

/** Compact one-line item used in dashboard lists and calendar day cells. */
export function ContentMiniRow({
  item,
  workspace,
  members,
  showOwner = true,
}: {
  item: ContentItem
  workspace: Workspace
  members: Member[]
  showOwner?: boolean
}) {
  const platform = workspace.taxonomies.platforms.find((p) => p.label === item.platform)
  return (
    <Link
      to={`/content/${item.id}`}
      className="flex items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-raised/60"
    >
      <span
        className="h-6 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: platform?.color ?? 'rgb(var(--ink-faint))' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm text-ink">{item.title || 'Untitled'}</span>
        <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
          {item.code} · {item.platform || '—'}
          {showOwner ? ` · ${memberName(members, item.ownerId)}` : ''}
        </span>
      </span>
      <ContentStatus item={item} stages={workspace.stages} />
    </Link>
  )
}
