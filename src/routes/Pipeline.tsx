/**
 * Pipeline board.
 *
 * Replaces "04 Production Tracker". Columns are generated from the workspace's
 * own stages plus a terminal "Ready" and "Published" column, so a team that
 * renamed or reordered its pipeline sees exactly its own process. Cards can be
 * dragged between columns on desktop; on touch, tapping the stage track advances
 * a stage, which is the faster gesture on a phone anyway.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Segmented,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { ContentCard, ContentStatus, DeadlineChip } from '@/components/content/pieces'
import { ContentFilterBar, applyContentFilters, useContentFilters } from '@/components/content/Filters'
import { useStore } from '@/state/store'
import { today } from '@/lib/date'
import type { ContentItem, Stage } from '@/lib/types'
import {
  currentStage,
  daysInCurrentStage,
  isOverdue,
  isPublished,
  memberName,
  nextActionText,
  responsibleMemberId,
  type Tone,
} from '@/lib/derive'

type Column = { id: string; label: string; tone: Tone; stage?: Stage; items: ContentItem[] }

export function PipelinePage() {
  const { data, month, setMonth, canEdit, setStageState, updateContent, markPublished } = useStore()
  const { filters, set, reset, activeCount } = useContentFilters({ scope: 'open' })
  const [layout, setLayout] = useState<'board' | 'stuck'>('board')
  const [dragging, setDragging] = useState<string | null>(null)

  if (!data) return null
  const { workspace, members, content } = data
  const stages = workspace.stages

  const rows = useMemo(
    () => applyContentFilters(content, filters, workspace, month),
    [content, filters, workspace, month],
  )

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = stages.map((stage, i) => ({
      id: stage.id,
      label: stage.name,
      tone: STAGE_TONES[i % STAGE_TONES.length],
      stage,
      items: [],
    }))
    cols.push({ id: '__ready', label: 'Ready to publish', tone: 'violet', items: [] })
    cols.push({ id: '__published', label: 'Published', tone: 'emerald', items: [] })

    for (const item of rows) {
      if (isPublished(item)) {
        cols[cols.length - 1].items.push(item)
        continue
      }
      const stage = currentStage(item, stages)
      if (!stage) {
        cols[cols.length - 2].items.push(item)
        continue
      }
      cols.find((c) => c.id === stage.id)?.items.push(item)
    }

    // Late work first inside each column — that is the order a lead reads them in.
    for (const c of cols) {
      c.items.sort((a, b) => {
        const la = isOverdue(a, stages) ? 0 : 1
        const lb = isOverdue(b, stages) ? 0 : 1
        if (la !== lb) return la - lb
        return (a.plannedPublishDate || '9999').localeCompare(b.plannedPublishDate || '9999')
      })
    }
    return cols
  }, [rows, stages])

  /** Dropping onto a column marks every earlier stage complete and reopens the rest. */
  const moveTo = async (item: ContentItem, columnId: string) => {
    if (!canEdit) return
    if (columnId === '__published') {
      await markPublished(item.id)
      return
    }
    const stageStates = { ...item.stageStates }
    const targetIndex = columnId === '__ready' ? stages.length : stages.findIndex((s) => s.id === columnId)
    stages.forEach((s, i) => {
      if (i < targetIndex) stageStates[s.id] = 'complete'
      else if (i === targetIndex) stageStates[s.id] = stageStates[s.id] === 'complete' ? 'in_progress' : stageStates[s.id]
      else stageStates[s.id] = 'pending'
    })
    // The stage it lands in starts its clock now, so "idle for N days" restarts.
    const stageEnteredAt = { ...item.stageEnteredAt }
    const landed = stages[targetIndex]
    if (landed) stageEnteredAt[landed.id] = today()
    await updateContent(item.id, {
      stageStates,
      stageEnteredAt,
      lifecycle: item.lifecycle === 'idea' || item.lifecycle === 'published' ? 'active' : item.lifecycle,
      actualPublishDate: '',
    })
  }

  const stuck = useMemo(
    () =>
      rows
        .filter((c) => !isPublished(c) && (c.blocker.trim() || isOverdue(c, stages) || (daysInCurrentStage(c, stages) ?? 0) >= 5))
        .sort((a, b) => (daysInCurrentStage(b, stages) ?? 0) - (daysInCurrentStage(a, stages) ?? 0)),
    [rows, stages],
  )

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Pipeline"
        blurb="Where every piece of work sits, and who owns the next move."
        action={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <Segmented
              options={[
                { id: 'board', label: 'Board', icon: 'board' },
                { id: 'stuck', label: 'Attention', icon: 'alert' },
              ]}
              value={layout}
              onChange={setLayout}
            />
          </>
        }
      />

      <ContentFilterBar
        filters={filters}
        set={set}
        reset={reset}
        activeCount={activeCount}
        workspace={workspace}
        members={members}
        resultCount={rows.length}
        totalCount={content.length}
      />

      {layout === 'stuck' ? (
        stuck.length === 0 ? (
          <EmptyState icon="check" title="Nothing needs chasing" blurb="No blockers, nothing overdue, nothing stalled." />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left">
                <thead className="bg-sunken/60">
                  <tr className="label-caps">
                    <th className="px-3 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium">Stage</th>
                    <th className="px-3 py-2.5 font-medium">Waiting on</th>
                    <th className="px-3 py-2.5 font-medium">Idle</th>
                    <th className="px-3 py-2.5 font-medium">Blocker</th>
                    <th className="px-3 py-2.5 font-medium">Next action</th>
                    <th className="px-3 py-2.5 font-medium">Publish</th>
                  </tr>
                </thead>
                <tbody className="divide-hair">
                  {stuck.map((item) => {
                    const idle = daysInCurrentStage(item, stages)
                    return (
                      <tr key={item.id} className="row-hover">
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <Link to={`/content/${item.id}`} className="block truncate text-body-sm text-ink hover:text-primary">
                            {item.title || 'Untitled'}
                          </Link>
                          <span className="font-mono text-label-micro uppercase text-ink-faint">{item.code}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <ContentStatus item={item} stages={stages} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-body-xs text-ink-dim">
                          {memberName(members, responsibleMemberId(item, stages))}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cx(
                              'numeral font-mono text-label-caps',
                              (idle ?? 0) >= 5 ? 'text-amber' : 'text-ink-faint',
                            )}
                          >
                            {idle ?? '—'}d
                          </span>
                        </td>
                        <td className="max-w-[14rem] px-3 py-2.5">
                          {item.blocker ? (
                            <span className="line-clamp-2 text-body-xs text-danger">{item.blocker}</span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="max-w-[14rem] px-3 py-2.5">
                          <span className="line-clamp-2 text-body-xs text-ink-dim">{nextActionText(item, stages)}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <DeadlineChip item={item} stages={stages} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        /* -------- Board -------- */
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:snap-none lg:px-0">
          {columns.map((col) => (
            <section
              key={col.id}
              onDragOver={(e) => {
                if (dragging) e.preventDefault()
              }}
              onDrop={() => {
                const item = rows.find((r) => r.id === dragging)
                if (item) void moveTo(item, col.id)
                setDragging(null)
              }}
              className={cx(
                'flex w-[85vw] shrink-0 snap-center flex-col rounded-lg border bg-panel/50 sm:w-[20rem] lg:w-auto lg:flex-1',
                dragging ? 'border-accent/40' : 'border-line/50',
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line/40 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: `rgb(var(--${TONE_VAR[col.tone]}))`,
                      boxShadow: `0 0 6px rgb(var(--${TONE_VAR[col.tone]}))`,
                    }}
                  />
                  <span className="truncate font-mono text-label-caps uppercase text-ink-dim">{col.label}</span>
                </span>
                <span className="numeral shrink-0 rounded-full bg-sunken px-2 py-0.5 font-mono text-label-micro text-ink-faint">
                  {col.items.length}
                </span>
              </header>

              {col.stage && (
                <p className="border-b border-line/30 px-3 py-1.5 font-mono text-label-micro uppercase text-ink-faint">
                  owner role: {col.stage.ownerRole}
                </p>
              )}

              <div className="min-h-[6rem] flex-1 space-y-2 p-2">
                {col.items.length === 0 ? (
                  <p className="px-2 py-8 text-center text-body-xs text-ink-faint">Empty</p>
                ) : (
                  col.items.map((item) => (
                    <div
                      key={item.id}
                      draggable={canEdit}
                      onDragStart={() => setDragging(item.id)}
                      onDragEnd={() => setDragging(null)}
                      className={cx('transition-opacity', dragging === item.id && 'opacity-40')}
                    >
                      <ContentCard
                        item={item}
                        workspace={workspace}
                        members={members}
                        onToggleStage={canEdit ? (stageId, next) => void setStageState(item.id, stageId, next) : undefined}
                      />
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {layout === 'board' && (
        <p className="flex items-center gap-2 text-body-xs text-ink-faint">
          <Icon name="drag" size={14} className="shrink-0" />
          <span className="hidden lg:inline">Drag a card to another column, or</span>
          <span>tap the stage bars on a card to advance a stage.</span>
        </p>
      )}

      {rows.length === 0 && layout === 'board' && (
        <EmptyState
          icon="board"
          title="Nothing in the pipeline"
          blurb="Widen the scope, or add content to the plan."
          action={
            <Button size="sm" icon="refresh" onClick={reset}>
              Reset filters
            </Button>
          }
        />
      )}
    </div>
  )
}

const STAGE_TONES: Tone[] = ['primary', 'violet', 'amber', 'emerald']

const TONE_VAR: Record<Tone, string> = {
  neutral: 'ink-faint',
  primary: 'primary',
  violet: 'violet',
  emerald: 'emerald',
  amber: 'amber',
  danger: 'danger',
}
