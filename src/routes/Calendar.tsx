/**
 * Content calendar.
 *
 * Per the design system the month grid is a desktop affordance and mobile
 * reflows into a vertical agenda, so touch targets stay usable. Both views read
 * the same filtered set and can create content on a specific day.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Segmented,
  StatusChip,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { ContentSheet } from '@/components/content/ContentSheet'
import { ContentCard, ContentStatus } from '@/components/content/pieces'
import { ContentFilterBar, applyContentFilters, useContentFilters } from '@/components/content/Filters'
import { useStore } from '@/state/store'
import type { ContentItem } from '@/lib/types'
import { isPublished, isOverdue, memberName, overallStatus, OVERALL_STATUS_TONE } from '@/lib/derive'
import {
  fmtDate,
  fmtDayName,
  fmtMonth,
  monthGrid,
  monthKey,
  today,
  weekdayHeaders,
} from '@/lib/date'

export function CalendarPage() {
  const { data, month, setMonth, canEdit, createContent, updateContent, setStageState } = useStore()
  const { filters, set, reset, activeCount } = useContentFilters({ scope: 'month' })
  const [view, setView] = useState<'grid' | 'agenda'>(window.innerWidth >= 1024 ? 'grid' : 'agenda')
  const [editing, setEditing] = useState<ContentItem | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)

  if (!data) return null
  const { workspace, members, content } = data
  const now = today()

  // Scope is forced to the visible month for the grid; agenda respects the filter.
  const pool = useMemo(() => {
    const base = applyContentFilters(content, { ...filters, scope: 'all' }, workspace, month)
    return base.filter((c) => c.lifecycle !== 'cancelled')
  }, [content, filters, workspace, month])

  const byDay = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    for (const item of pool) {
      const key = item.actualPublishDate || item.plannedPublishDate
      if (!key) continue
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.priority || '').localeCompare(b.priority || '') || a.code.localeCompare(b.code))
    }
    return map
  }, [pool])

  const days = useMemo(() => monthGrid(month, workspace.weekStartsOn), [month, workspace.weekStartsOn])
  const monthDays = useMemo(
    () => days.filter((d) => monthKey(d) === month && (byDay.get(d)?.length ?? 0) > 0),
    [days, month, byDay],
  )
  const undated = useMemo(() => pool.filter((c) => !c.plannedPublishDate && !c.actualPublishDate), [pool])
  const monthCount = useMemo(() => days.filter((d) => monthKey(d) === month).reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0), [days, month, byDay])

  const addOnDay = async (date: string) => {
    const item = await createContent({ plannedPublishDate: date, month: monthKey(date) })
    setEditing(item)
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Calendar"
        blurb="What is going out, and when."
        action={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <Segmented
              options={[
                { id: 'grid', label: 'Month', icon: 'calendar' },
                { id: 'agenda', label: 'Agenda', icon: 'layers' },
              ]}
              value={view}
              onChange={setView}
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
        resultCount={monthCount}
        totalCount={content.length}
      />

      {view === 'grid' ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line/40 bg-sunken/60">
            {weekdayHeaders(workspace.weekStartsOn).map((d) => (
              <div key={d} className="px-2 py-2 text-center label-caps">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date) => {
              const inMonth = monthKey(date) === month
              const items = byDay.get(date) ?? []
              const isToday = date === now
              return (
                <div
                  key={date}
                  className={cx(
                    'group relative min-h-[6.5rem] border-b border-r border-line/30 p-1.5 transition-colors last:border-r-0',
                    inMonth ? 'bg-transparent hover:bg-raised/40' : 'bg-void/40',
                    // 2px electric-blue marker on the current day, per the design system.
                    isToday && 'border-l-2 border-l-accent bg-accent/[0.06]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        'numeral font-mono text-label-caps',
                        isToday ? 'text-primary' : inMonth ? 'text-ink-dim' : 'text-ink-faint/50',
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    {canEdit && inMonth && (
                      <button
                        onClick={() => void addOnDay(date)}
                        aria-label={`Add content on ${fmtDate(date)}`}
                        className="rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-raised hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    )}
                  </div>

                  <div className="mt-1 space-y-1">
                    {items.slice(0, 3).map((item) => {
                      const color =
                        workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color ?? '#8b90a0'
                      const late = isOverdue(item, workspace.stages)
                      return (
                        <Link
                          key={item.id}
                          to={`/content/${item.id}`}
                          title={`${item.code} · ${item.title}`}
                          className={cx(
                            'block truncate rounded px-1.5 py-1 text-[11px] leading-tight transition-transform hover:scale-[1.02]',
                            late && 'ring-1 ring-danger/50',
                          )}
                          style={{ backgroundColor: `${color}26`, color, borderLeft: `2px solid ${color}` }}
                        >
                          {isPublished(item) && '✓ '}
                          {item.title || item.code}
                        </Link>
                      )
                    })}
                    {items.length > 3 && (
                      <button
                        onClick={() => setOpenDay(date)}
                        className="block w-full rounded px-1.5 py-0.5 text-left font-mono text-label-micro uppercase text-ink-faint hover:bg-raised hover:text-ink"
                      >
                        +{items.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        /* -------- Agenda -------- */
        <div className="space-y-3">
          {monthDays.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={`Nothing scheduled in ${fmtMonth(month)}`}
              blurb="Add content with a publish date, or switch month."
              action={
                canEdit ? (
                  <Button size="sm" variant="primary" icon="plus" onClick={() => void addOnDay(now)}>
                    Add content
                  </Button>
                ) : undefined
              }
            />
          ) : (
            monthDays.map((date) => {
              const items = byDay.get(date) ?? []
              const isToday = date === now
              return (
                <section key={date}>
                  <header
                    className={cx(
                      'sticky top-0 z-10 mb-2 flex items-center gap-2 rounded border-l-2 bg-base/90 px-2.5 py-1.5 backdrop-blur-[8px]',
                      isToday ? 'border-l-accent' : 'border-l-line',
                    )}
                  >
                    <span className={cx('numeral text-body-md font-semibold', isToday ? 'text-primary' : 'text-ink')}>
                      {Number(date.slice(8, 10))}
                    </span>
                    <span className="font-mono text-label-caps uppercase text-ink-faint">{fmtDayName(date)}</span>
                    {isToday && <StatusChip tone="primary">today</StatusChip>}
                    <span className="ml-auto font-mono text-label-micro uppercase text-ink-faint">
                      {items.length} item{items.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <ContentCard
                          item={item}
                          workspace={workspace}
                          members={members}
                          onToggleStage={
                            canEdit ? (stageId, next) => void setStageState(item.id, stageId, next) : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}

      {/* -------- Unscheduled work is easy to lose; surface it under the calendar. -------- */}
      {undated.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-2 px-widget pt-widget">
            <div>
              <div className="label-caps">Not scheduled</div>
              <p className="mt-1 text-body-sm text-ink-dim">
                {undated.length} item{undated.length === 1 ? '' : 's'} with no publish date.
              </p>
            </div>
          </div>
          <ul className="divide-hair px-2.5 pb-3 pt-1">
            {undated.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-2 py-2">
                <Link to={`/content/${item.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm text-ink hover:text-primary">
                    {item.title || 'Untitled'}
                  </span>
                  <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                    {item.code} · {memberName(members, item.ownerId)}
                  </span>
                </Link>
                <StatusChip tone={OVERALL_STATUS_TONE[overallStatus(item, workspace.stages)]}>
                  {item.contentType || '—'}
                </StatusChip>
                {canEdit && (
                  <Button size="sm" variant="quiet" icon="calendar" onClick={() => setEditing(item)}>
                    Schedule
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* -------- Day overflow sheet -------- */}
      {openDay && (
        <DaySheet
          date={openDay}
          items={byDay.get(openDay) ?? []}
          onClose={() => setOpenDay(null)}
        />
      )}

      {editing && (
        <ContentSheet
          open
          onClose={() => setEditing(null)}
          item={editing}
          workspace={workspace}
          members={members}
          readOnly={!canEdit}
          onSave={(patch) => updateContent(editing.id, patch)}
        />
      )}
    </div>
  )
}

function DaySheet({ date, items, onClose }: { date: string; items: ContentItem[]; onClose: () => void }) {
  const { data } = useStore()
  if (!data) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 animate-fade-in bg-void/70 backdrop-blur-[3px]" />
      <div className="relative max-h-[85dvh] w-full animate-sheet-in overflow-y-auto rounded-t-xl border border-white/10 bg-overlay/95 p-4 shadow-float backdrop-blur-[16px] sm:max-w-lg sm:animate-scale-in sm:rounded-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-headline-sm text-ink">{fmtDate(date)}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1.5 text-ink-faint hover:bg-raised hover:text-ink">
            <Icon name="x" size={16} />
          </button>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/content/${item.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-md border border-line/50 bg-panel p-3 transition-colors hover:border-line"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm text-ink">{item.title || 'Untitled'}</span>
                  <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                    {item.code} · {item.platform}
                  </span>
                </span>
                <ContentStatus item={item} stages={data.workspace.stages} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
