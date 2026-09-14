/**
 * Content plan — the master calendar as a list.
 *
 * Replaces "02 Monthly Content Plan". Cards on mobile, a dense sortable table on
 * desktop. Days-remaining and overdue flags are computed, not stored.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  PlatformChip,
  PriorityFlag,
  SectionTitle,
  Segmented,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { useConfirm } from '@/components/ui/Overlay'
import { ContentCard, ContentStatus, DeadlineChip, StageTrack } from '@/components/content/pieces'
import { ContentSheet } from '@/components/content/ContentSheet'
import { ContentFilterBar, applyContentFilters, useContentFilters } from '@/components/content/Filters'
import { useStore } from '@/state/store'
import type { ContentItem } from '@/lib/types'
import { currentStage, daysRemaining, isOverdue, memberName, stageProgress } from '@/lib/derive'
import { fmtDate, relativeDays, weekLabel } from '@/lib/date'

type SortKey = 'date' | 'code' | 'title' | 'priority' | 'status'

export function ContentPlanPage() {
  const { data, month, setMonth, canEdit, canManage, createContent, updateContent, deleteContent, setStageState } =
    useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { filters, set, reset, activeCount } = useContentFilters()
  const [view, setView] = useState<'cards' | 'table'>(window.innerWidth >= 1024 ? 'table' : 'cards')
  const [sort, setSort] = useState<SortKey>('date')
  const [asc, setAsc] = useState(true)
  const [editing, setEditing] = useState<ContentItem | null>(null)
  const confirm = useConfirm()

  // `?new=1` from the header button and the mobile FAB.
  useEffect(() => {
    if (params.get('new') !== '1' || !canEdit) return
    params.delete('new')
    setParams(params, { replace: true })
    void (async () => {
      const item = await createContent()
      setEditing(item)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  if (!data) return null
  const { workspace, members, content } = data

  const rows = useMemo(() => {
    const list = applyContentFilters(content, filters, workspace, month)
    const priorityRank = (p: string) => workspace.taxonomies.priorities.indexOf(p)
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'code':
          return a.code.localeCompare(b.code)
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'priority':
          return priorityRank(a.priority) - priorityRank(b.priority)
        case 'status':
          return stageProgress(b, workspace.stages).pct - stageProgress(a, workspace.stages).pct
        default:
          return (a.plannedPublishDate || '9999').localeCompare(b.plannedPublishDate || '9999')
      }
    })
    return asc ? sorted : sorted.reverse()
  }, [content, filters, workspace, month, sort, asc])

  const newItem = async () => {
    const item = await createContent()
    setEditing(item)
  }

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v)
    else {
      setSort(key)
      setAsc(true)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Content plan"
        blurb="Every piece of content gets one row and one permanent code."
        action={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <span className="hidden lg:block">
              <Segmented
                options={[
                  { id: 'table', label: 'Table', icon: 'layers' },
                  { id: 'cards', label: 'Cards', icon: 'grid' },
                ]}
                value={view}
                onChange={setView}
              />
            </span>
            {canEdit && (
              <Button variant="primary" icon="plus" onClick={() => void newItem()}>
                <span className="hidden sm:inline">New</span>
              </Button>
            )}
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

      {rows.length === 0 ? (
        <EmptyState
          icon="layers"
          title={content.length ? 'Nothing matches these filters' : 'No content planned yet'}
          blurb={
            content.length
              ? 'Try widening the scope to “Everything”, or clear the filters.'
              : 'Add your first item, or promote something from the idea bank.'
          }
          action={
            content.length ? (
              <Button size="sm" icon="refresh" onClick={reset}>
                Clear filters
              </Button>
            ) : canEdit ? (
              <div className="flex gap-2">
                <Button size="sm" variant="primary" icon="plus" onClick={() => void newItem()}>
                  New content
                </Button>
                <Button size="sm" icon="bulb" onClick={() => navigate('/ideas')}>
                  Idea bank
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : view === 'cards' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <li key={item.id}>
              <ContentCard
                item={item}
                workspace={workspace}
                members={members}
                onToggleStage={canEdit ? (stageId, next) => void setStageState(item.id, stageId, next) : undefined}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] text-left">
              <thead className="bg-sunken/60">
                <tr className="label-caps">
                  <SortHeader label="Code" k="code" sort={sort} asc={asc} onSort={toggleSort} className="w-24" />
                  <SortHeader label="Title" k="title" sort={sort} asc={asc} onSort={toggleSort} />
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Platform</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <SortHeader label="Pipeline" k="status" sort={sort} asc={asc} onSort={toggleSort} className="w-40" />
                  <th className="px-3 py-2.5 font-medium">Next</th>
                  <SortHeader label="Publish" k="date" sort={sort} asc={asc} onSort={toggleSort} className="w-40" />
                  <SortHeader label="Priority" k="priority" sort={sort} asc={asc} onSort={toggleSort} />
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-hair">
                {rows.map((item) => {
                  const stage = currentStage(item, workspace.stages)
                  const late = isOverdue(item, workspace.stages)
                  return (
                    <tr key={item.id} className={cx('row-hover align-middle', late && 'bg-danger/[0.06]')}>
                      <td className="px-3 py-2.5">
                        <Link to={`/content/${item.id}`} className="font-mono text-label-caps text-primary hover:underline">
                          {item.code}
                        </Link>
                      </td>
                      <td className="max-w-[20rem] px-3 py-2.5">
                        <Link to={`/content/${item.id}`} className="block truncate text-body-sm text-ink hover:text-primary">
                          {item.title || 'Untitled'}
                        </Link>
                        <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                          {[item.topic, weekLabel(item.plannedPublishDate, workspace.weekStartsOn)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-body-xs text-ink-dim">{item.contentType || '—'}</td>
                      <td className="px-3 py-2.5">
                        <PlatformChip
                          label={item.platform || '—'}
                          color={workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={memberName(members, item.ownerId)} size={20} />
                          <span className="max-w-[7rem] truncate text-body-xs text-ink-dim">
                            {memberName(members, item.ownerId)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StageTrack
                          item={item}
                          stages={workspace.stages}
                          size="sm"
                          onToggle={canEdit ? (stageId, next) => void setStageState(item.id, stageId, next) : undefined}
                        />
                        <span className="mt-1 block font-mono text-label-micro uppercase text-ink-faint">
                          {stageProgress(item, workspace.stages).complete}/{workspace.stages.length}
                          {stage ? ` · ${stage.name}` : ' · done'}
                        </span>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2.5">
                        <span className="block truncate text-body-xs text-ink-dim">
                          {stage ? memberName(members, item.stageAssignees?.[stage.id] ?? '') : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <DeadlineChip item={item} stages={workspace.stages} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <PriorityFlag priority={item.priority} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ContentStatus item={item} stages={workspace.stages} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Totals strip mirrors the sheet's habit of showing counts under a filter. */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md border border-line/50 bg-panel/60 px-4 py-2.5 font-mono text-label-micro uppercase text-ink-faint">
          <span>{rows.length} items</span>
          <span className="text-danger">{rows.filter((r) => isOverdue(r, workspace.stages)).length} overdue</span>
          <span className="text-amber">{rows.filter((r) => r.blocker.trim()).length} blocked</span>
          <span>
            next up:{' '}
            {(() => {
              const next = rows
                .filter((r) => (daysRemaining(r) ?? -1) >= 0)
                .sort((a, b) => a.plannedPublishDate.localeCompare(b.plannedPublishDate))[0]
              return next ? `${next.code} ${relativeDays(daysRemaining(next))} (${fmtDate(next.plannedPublishDate)})` : '—'
            })()}
          </span>
        </div>
      )}

      {editing && (
        <ContentSheet
          open
          onClose={() => setEditing(null)}
          item={editing}
          workspace={workspace}
          members={members}
          readOnly={!canEdit}
          canDelete={canManage}
          onSave={(patch) => updateContent(editing.id, patch)}
          onDelete={() =>
            confirm.ask({
              title: `Delete ${editing.code}?`,
              body: 'The item is removed and any tasks pointing at it are unlinked. This cannot be undone.',
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => void deleteContent(editing.id),
            })
          }
        />
      )}
      {confirm.element}
    </div>
  )
}

function SortHeader({
  label,
  k,
  sort,
  asc,
  onSort,
  className,
}: {
  label: string
  k: SortKey
  sort: SortKey
  asc: boolean
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort === k
  return (
    <th className={cx('px-3 py-2.5 font-medium', className)}>
      <button
        onClick={() => onSort(k)}
        className={cx('inline-flex items-center gap-1 transition-colors', active ? 'text-ink' : 'hover:text-ink-dim')}
      >
        {label}
        {active && <Icon name={asc ? 'chevron-up' : 'chevron-down'} size={12} />}
      </button>
    </th>
  )
}
