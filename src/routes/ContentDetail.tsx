/**
 * Single content item.
 *
 * The one place that shows everything about a piece of work: the pipeline with a
 * one-tap advance, who is responsible next, its tasks, its links and its
 * performance. Reached from every list, and from search by code.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ExternalLink,
  KeyValue,
  PlatformChip,
  PriorityFlag,
  ProgressRing,
  StatusChip,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { Menu, useConfirm } from '@/components/ui/Overlay'
import { ContentSheet } from '@/components/content/ContentSheet'
import { MetricsSheet } from '@/components/content/MetricsSheet'
import { StageTrack, STATE_LABEL, STATE_TONE } from '@/components/content/pieces'
import { TaskRow } from '@/components/tasks/TaskRow'
import { useStore } from '@/state/store'
import {
  OVERALL_STATUS_LABEL,
  OVERALL_STATUS_TONE,
  currentStage,
  daysInCurrentStage,
  engagement,
  engagementRate,
  fmtCompact,
  fmtNumber,
  fmtPercent,
  hasMetrics,
  isPublished,
  memberName,
  memberRole,
  nextActionText,
  overallStatus,
  publishTiming,
  PUBLISH_TIMING_LABEL,
  responsibleMemberId,
  stageAction,
  stageProgress,
  stageState,
} from '@/lib/derive'
import { fmtDateFull, relativeDays, daysBetween, today, weekLabel } from '@/lib/date'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    data,
    canEdit,
    canManage,
    updateContent,
    deleteContent,
    setStageState,
    advanceStage,
    markPublished,
    createTask,
  } = useStore()
  const [editing, setEditing] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const confirm = useConfirm()

  const item = data?.content.find((c) => c.id === id)

  if (!data) return null
  if (!item) {
    return (
      <div className="py-16">
        <EmptyState
          icon="search"
          title="Content not found"
          blurb="It may have been deleted, or belong to another workspace."
          action={
            <Button icon="arrow-left" onClick={() => navigate('/content')}>
              Back to the plan
            </Button>
          }
        />
      </div>
    )
  }

  const { workspace, members } = data
  const stages = workspace.stages
  const status = overallStatus(item, stages)
  const stage = currentStage(item, stages)
  const progress = stageProgress(item, stages)
  const responsible = responsibleMemberId(item, stages)
  const idle = daysInCurrentStage(item, stages)
  const platform = workspace.taxonomies.platforms.find((p) => p.label === item.platform)
  const published = isPublished(item)

  const tasks = useMemo(
    () => data.tasks.filter((t) => t.contentId === item.id).sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [data.tasks, item.id],
  )

  const addStageTask = async () => {
    if (!stage) return
    await createTask({
      title: `${stage.verb ?? 'Complete'} ${stage.name.toLowerCase()} — ${item.title || item.code}`,
      contentId: item.id,
      stageId: stage.id,
      memberId: item.stageAssignees?.[stage.id] || item.ownerId,
      deadline: item.stageDeadlines?.[stage.id] || item.plannedPublishDate || today(),
      taskType: workspace.taxonomies.taskTypes[0] ?? '',
      priority: item.priority,
    })
  }

  return (
    <div className="space-y-4">
      {/* -------- Header -------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="quiet" icon="arrow-left" onClick={() => navigate('/content')}>
              Plan
            </Button>
            <span className="font-mono text-label-caps text-ink-faint">{item.code}</span>
            <StatusChip tone={OVERALL_STATUS_TONE[status]}>{OVERALL_STATUS_LABEL[status]}</StatusChip>
          </div>
          <h1 className="mt-2 text-headline-md text-ink sm:text-headline-lg">{item.title || 'Untitled'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PlatformChip label={item.platform || '—'} color={platform?.color} />
            {item.crossPost.map((p) => (
              <PlatformChip
                key={p}
                label={p}
                size="sm"
                color={workspace.taxonomies.platforms.find((x) => x.label === p)?.color}
              />
            ))}
            <span className="font-mono text-label-micro uppercase text-ink-faint">{item.contentType}</span>
            <PriorityFlag priority={item.priority} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && !published && (
            <Button variant="primary" icon="check" onClick={() => void advanceStage(item.id)}>
              {stage ? stageAction(stage) : 'Publish'}
            </Button>
          )}
          {canEdit && (
            <Button icon="pencil" onClick={() => setEditing(true)}>
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
          <Menu
            items={[
              { label: 'Edit details', icon: 'pencil', onSelect: () => setEditing(true), disabled: !canEdit },
              {
                label: published ? 'Update performance' : 'Mark published',
                icon: published ? 'chart' : 'send',
                disabled: !canEdit,
                onSelect: () => (published ? setMetricsOpen(true) : void markPublished(item.id)),
              },
              { label: 'Add a task for this', icon: 'plus', onSelect: () => void addStageTask(), disabled: !canEdit || !stage },
              {
                label: item.lifecycle === 'cancelled' ? 'Restore' : 'Cancel this item',
                icon: item.lifecycle === 'cancelled' ? 'refresh' : 'block',
                disabled: !canEdit,
                onSelect: () => void updateContent(item.id, { lifecycle: item.lifecycle === 'cancelled' ? 'active' : 'cancelled' }),
              },
              {
                label: 'Delete',
                icon: 'trash',
                danger: true,
                disabled: !canManage,
                onSelect: () =>
                  confirm.ask({
                    title: `Delete ${item.code}?`,
                    body: 'This removes the item permanently and unlinks its tasks.',
                    confirmLabel: 'Delete',
                    danger: true,
                    onConfirm: () => {
                      void deleteContent(item.id)
                      navigate('/content')
                    },
                  }),
              },
            ]}
          />
        </div>
      </div>

      {/* -------- Blocker banner -------- */}
      {item.blocker.trim() && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <Icon name="block" size={18} className="shrink-0 text-danger" />
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm text-ink">{item.blocker}</span>
            <span className="block font-mono text-label-micro uppercase text-danger">
              blocking · {memberName(members, responsible)}
            </span>
          </span>
          {canEdit && (
            <Button size="sm" variant="ghost" icon="check" onClick={() => void updateContent(item.id, { blocker: '' })}>
              Unblock
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* -------- Pipeline -------- */}
          <Card>
            <CardHeader
              label="Pipeline"
              title={published ? 'Published' : stage ? `Now in ${stage.name}` : 'Ready to publish'}
              action={
                <ProgressRing pct={progress.pct} size={48} stroke={5} tone={published ? 'emerald' : 'primary'}>
                  <span className="numeral font-mono text-label-micro text-ink">{progress.pct}%</span>
                </ProgressRing>
              }
            />
            <div className="p-widget pt-3">
              <StageTrack
                item={item}
                stages={stages}
                showLabels
                onToggle={canEdit ? (stageId, next) => void setStageState(item.id, stageId, next) : undefined}
              />

              <ul className="mt-4 space-y-1.5">
                {stages.map((s) => {
                  const st = published ? 'complete' : stageState(item, s.id)
                  const isCurrent = !published && stage?.id === s.id
                  const due = item.stageDeadlines?.[s.id]
                  const late = due && st !== 'complete' && due < today()
                  return (
                    <li
                      key={s.id}
                      className={cx(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2',
                        isCurrent ? 'border-accent/40 bg-accent/[0.07]' : 'border-line/40 bg-sunken/40',
                      )}
                    >
                      <StatusChip tone={STATE_TONE[st]} className="shrink-0">
                        {s.name}
                      </StatusChip>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={memberName(members, item.stageAssignees?.[s.id] ?? '')} size={20} />
                        <span className="truncate text-body-xs text-ink-dim">
                          {memberName(members, item.stageAssignees?.[s.id] ?? '')}
                        </span>
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-3">
                        <span className={cx('font-mono text-label-micro uppercase', late ? 'text-danger' : 'text-ink-faint')}>
                          {due ? fmtDateFull(due) : 'no deadline'}
                        </span>
                        <span className="font-mono text-label-micro uppercase text-ink-faint">{STATE_LABEL[st]}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-4 grid gap-3 border-t border-white/5 pt-3 sm:grid-cols-3">
                <KeyValue label="Responsible next">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={memberName(members, responsible)} size={20} />
                    {memberName(members, responsible)}
                    <span className="font-mono text-label-micro uppercase text-ink-faint">
                      {memberRole(members, responsible)}
                    </span>
                  </span>
                </KeyValue>
                <KeyValue label="Next action">{nextActionText(item, stages)}</KeyValue>
                <KeyValue label="Time in stage">
                  {published ? '—' : idle === null ? '—' : <span className={idle >= 5 ? 'text-amber' : ''}>{idle} days</span>}
                </KeyValue>
              </div>
            </div>
          </Card>

          {/* -------- Tasks -------- */}
          <Card>
            <CardHeader
              label="Tasks"
              title={`${tasks.filter((t) => t.status !== 'completed').length} open of ${tasks.length}`}
              action={
                canEdit && stage ? (
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => void addStageTask()}>
                    Add
                  </Button>
                ) : undefined
              }
            />
            <div className="px-2.5 pb-3 pt-1">
              {tasks.length ? (
                <ul className="divide-hair">
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} compact />
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-6 text-center text-body-sm text-ink-faint">
                  No tasks logged against this item yet.
                </p>
              )}
            </div>
          </Card>

          {/* -------- Performance -------- */}
          {published && (
            <Card>
              <CardHeader
                label="Performance"
                title={hasMetrics(item.performance) ? 'Results' : 'No numbers yet'}
                action={
                  canEdit ? (
                    <Button size="sm" variant="ghost" icon="pencil" onClick={() => setMetricsOpen(true)}>
                      {hasMetrics(item.performance) ? 'Update' : 'Add numbers'}
                    </Button>
                  ) : undefined
                }
              />
              <div className="p-widget">
                {hasMetrics(item.performance) ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Metric label="Views" value={fmtCompact(item.performance?.views)} />
                      <Metric label="Reach" value={fmtCompact(item.performance?.reach)} />
                      <Metric label="Engagement" value={fmtCompact(engagement(item.performance))} />
                      <Metric label="Eng. rate" value={fmtPercent(engagementRate(item.performance), 2)} tone="emerald" />
                      <Metric label="Likes" value={fmtNumber(item.performance?.likes)} />
                      <Metric label="Comments" value={fmtNumber(item.performance?.comments)} />
                      <Metric label="Shares" value={fmtNumber(item.performance?.shares)} />
                      <Metric label="Saves" value={fmtNumber(item.performance?.saves)} />
                      <Metric label="Leads" value={fmtNumber(item.performance?.leads)} />
                      <Metric label="Conversions" value={fmtNumber(item.performance?.conversions)} tone="violet" />
                      <Metric
                        label="Completion"
                        value={fmtPercent(item.performance?.completionRate, 0)}
                      />
                      <Metric label="Avg watch" value={item.performance?.avgWatchTimeSec ? `${item.performance.avgWatchTimeSec}s` : '—'} />
                    </div>
                    {item.performance?.keyLearning && (
                      <p className="mt-4 rounded-md border border-line/40 bg-sunken/50 p-3 text-body-sm text-ink-dim">
                        <span className="mb-1 block label-caps">Key learning</span>
                        {item.performance.keyLearning}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-body-sm text-ink-faint">
                    Published {item.actualPublishDate ? relativeDays(daysBetween(today(), item.actualPublishDate)) : ''} —
                    add views, reach and engagement to see the rate calculated.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* -------- Copy -------- */}
          {(item.caption || item.hashtags) && (
            <Card>
              <CardHeader label="Copy" title="Caption" />
              <div className="space-y-2 p-widget">
                {item.caption && <p className="whitespace-pre-wrap text-body-sm text-ink-dim">{item.caption}</p>}
                {item.hashtags && <p className="font-mono text-body-xs text-primary">{item.hashtags}</p>}
              </div>
            </Card>
          )}
        </div>

        {/* -------- Side panel -------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader label="Schedule" />
            <div className="space-y-3 p-widget pt-3">
              <KeyValue label="Planned publish">
                {item.plannedPublishDate ? (
                  <span className={cx(!published && item.plannedPublishDate < today() && 'text-danger')}>
                    {fmtDateFull(item.plannedPublishDate)}
                    <span className="ml-1.5 font-mono text-label-micro uppercase text-ink-faint">
                      {relativeDays(daysBetween(today(), item.plannedPublishDate))}
                    </span>
                  </span>
                ) : (
                  '—'
                )}
              </KeyValue>
              <KeyValue label="Actual publish">
                {item.actualPublishDate ? (
                  <span className="flex items-center gap-2">
                    {fmtDateFull(item.actualPublishDate)}
                    <StatusChip
                      tone={publishTiming(item) === 'late' ? 'danger' : 'emerald'}
                      dot={false}
                    >
                      {PUBLISH_TIMING_LABEL[publishTiming(item)]}
                    </StatusChip>
                  </span>
                ) : (
                  'Not published'
                )}
              </KeyValue>
              <KeyValue label="Planning month">
                {item.month} · {weekLabel(item.plannedPublishDate, workspace.weekStartsOn)}
              </KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader label="Brief" />
            <div className="space-y-3 p-widget pt-3">
              <KeyValue label="Owner">
                <span className="flex items-center gap-1.5">
                  <Avatar name={memberName(members, item.ownerId)} size={20} />
                  {memberName(members, item.ownerId)}
                </span>
              </KeyValue>
              <KeyValue label="Topic">{item.topic || '—'}</KeyValue>
              <KeyValue label="Category">{item.category || '—'}</KeyValue>
              <KeyValue label="Objective">{item.objective || '—'}</KeyValue>
              <KeyValue label="Audience">{item.audience || '—'}</KeyValue>
              {item.remarks && <KeyValue label="Remarks">{item.remarks}</KeyValue>}
            </div>
          </Card>

          <Card>
            <CardHeader label="Links" />
            <div className="space-y-3 p-widget pt-3">
              <KeyValue label="Brief / script">
                <ExternalLink href={item.links.brief} />
              </KeyValue>
              <KeyValue label="Raw assets">
                <ExternalLink href={item.links.raw} />
              </KeyValue>
              <KeyValue label="Final file">
                <ExternalLink href={item.links.final} />
              </KeyValue>
              <KeyValue label="Published post">
                <ExternalLink href={item.links.published} />
              </KeyValue>
            </div>
          </Card>

          {item.fromIdeaId && (
            <Link
              to="/ideas"
              className="flex items-center gap-2.5 rounded-lg border border-line/50 bg-panel px-4 py-3 text-body-sm text-ink-dim transition-colors hover:border-line hover:text-ink"
            >
              <Icon name="bulb" size={16} className="shrink-0 text-amber" />
              Promoted from the idea bank
              <Icon name="arrow-right" size={14} className="ml-auto shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {editing && (
        <ContentSheet
          open
          onClose={() => setEditing(false)}
          item={item}
          workspace={workspace}
          members={members}
          readOnly={!canEdit}
          canDelete={canManage}
          onSave={(patch) => updateContent(item.id, patch)}
          onDelete={() =>
            confirm.ask({
              title: `Delete ${item.code}?`,
              body: 'This removes the item permanently and unlinks its tasks.',
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => {
                void deleteContent(item.id)
                navigate('/content')
              },
            })
          }
        />
      )}

      {metricsOpen && (
        <MetricsSheet
          open
          onClose={() => setMetricsOpen(false)}
          item={item}
          workspace={workspace}
          onSave={(patch) => updateContent(item.id, patch)}
        />
      )}
      {confirm.element}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'violet' }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div
        className={cx(
          'numeral mt-1 text-data-numeral',
          tone === 'emerald' ? 'text-emerald' : tone === 'violet' ? 'text-violet' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  )
}
