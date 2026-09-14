/**
 * Dashboard — the management view.
 *
 * Replaces the spreadsheet's "01 Dashboard" tab. Every number is computed for the
 * selected month by `dashboardSummary`; the stage tiles are generated from the
 * workspace's own pipeline rather than the sheet's hard-coded script/shoot/edit
 * columns.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ProgressRing,
  SectionTitle,
  StatusDot,
  cx,
  TONE_TEXT,
} from '@/components/ui/primitives'
import { Icon, type IconName } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { AreaLineChart, Donut, GroupedBars, HBars } from '@/components/charts/charts'
import { ContentMiniRow } from '@/components/content/pieces'
import { NotificationPanel, useAlerts } from '@/components/layout/NotificationPanel'
import { useStore } from '@/state/store'
import { dashboardSummary, myWork, teamPerformance } from '@/lib/metrics'
import {
  OVERALL_STATUS_LABEL,
  OVERALL_STATUS_TONE,
  daysRemaining,
  fmtCompact,
  fmtPercent,
  isPublished,
  type OverallStatus,
  type Tone,
} from '@/lib/derive'
import { addMonths, fmtDate, fmtMonthShort } from '@/lib/date'

export function Dashboard() {
  const { data, month, setMonth, me, canEdit } = useStore()
  const navigate = useNavigate()
  const { visible: alerts } = useAlerts()
  const [notifOpen, setNotifOpen] = useState(false)

  if (!data) return null
  const { workspace, members, content } = data

  const summary = useMemo(() => dashboardSummary(data, month), [data, month])
  const prev = useMemo(() => dashboardSummary(data, addMonths(month, -1)), [data, month])
  const scores = useMemo(() => teamPerformance(data, month), [data, month])
  const mine = useMemo(() => (me ? myWork(data, me.id) : null), [data, me])

  // Six months of published counts for the trend chart.
  const trend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, -(5 - i)))
    return {
      labels: months.map((m) => fmtMonthShort(m).replace(/ \d{4}$/, '')),
      planned: months.map((m) => content.filter((c) => c.month === m && c.lifecycle !== 'cancelled').length),
      published: months.map((m) => content.filter((c) => c.month === m && isPublished(c)).length),
    }
  }, [content, month])

  const upcoming = useMemo(
    () =>
      content
        .filter((c) => !isPublished(c) && c.lifecycle !== 'cancelled' && c.plannedPublishDate)
        .sort((a, b) => a.plannedPublishDate.localeCompare(b.plannedPublishDate))
        .slice(0, 6),
    [content],
  )

  const statusSlices = (Object.keys(summary.statusCounts) as OverallStatus[])
    .filter((k) => k !== 'cancelled' && summary.statusCounts[k] > 0)
    .map((k) => ({ label: OVERALL_STATUS_LABEL[k], value: summary.statusCounts[k], tone: OVERALL_STATUS_TONE[k] }))

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Dashboard"
        blurb={`${workspace.name} · every figure below is calculated from the plan, tasks and pipeline.`}
        action={<MonthNav month={month} onChange={setMonth} />}
      />

      {/* -------- Attention banner -------- */}
      {(summary.overdue > 0 || summary.blocked > 0) && (
        <button
          onClick={() => setNotifOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-left transition-colors hover:bg-danger/15"
        >
          <Icon name="alert" size={19} className="shrink-0 text-danger" filled />
          <span className="min-w-0 flex-1 text-body-sm text-ink">
            <span className="font-medium text-danger">
              {summary.overdue} overdue
              {summary.blocked > 0 && `, ${summary.blocked} blocked`}
            </span>{' '}
            this month — {alerts.length} open alert{alerts.length === 1 ? '' : 's'} in total.
          </span>
          <Icon name="chevron-right" size={17} className="shrink-0 text-danger" />
        </button>
      )}

      {/* -------- Hero metrics -------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Planned"
          value={summary.planned}
          prev={prev.planned}
          icon="layers"
          tone="primary"
          to="/content"
        />
        <MetricTile
          label="Published"
          value={summary.published}
          prev={prev.published}
          icon="send"
          tone="emerald"
          to="/publishing"
        />
        <MetricTile
          label="In production"
          value={summary.inProduction}
          prev={prev.inProduction}
          icon="board"
          tone="amber"
          to="/pipeline"
        />
        <MetricTile
          label="Overdue"
          value={summary.overdue}
          prev={prev.overdue}
          icon="clock"
          tone={summary.overdue > 0 ? 'danger' : 'neutral'}
          to="/pipeline"
          invertDelta
        />
      </div>

      {/* -------- Stage queues -------- */}
      <Card>
        <CardHeader
          label="Pipeline load"
          title="What is waiting where"
          action={
            <Link to="/pipeline" className="inline-flex items-center gap-1 text-body-xs text-primary hover:underline">
              Open board <Icon name="arrow-right" size={13} />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 p-widget sm:grid-cols-3 lg:grid-cols-5">
          {summary.stageBuckets.map((b, i) => (
            <Link
              key={b.stage.id}
              to="/pipeline"
              className="rounded-md border border-line/50 bg-sunken/50 p-3 transition-colors hover:border-line"
            >
              <div className="flex items-center gap-1.5">
                <StatusDot tone={STAGE_TONES[i % STAGE_TONES.length]} />
                <span className="truncate font-mono text-label-micro uppercase text-ink-faint">{b.stage.name}</span>
              </div>
              <div className="numeral mt-1.5 text-headline-md text-ink">{b.waiting}</div>
              <div className="mt-0.5 text-body-xs text-ink-faint">{b.completed} done this month</div>
            </Link>
          ))}
          <div className="rounded-md border border-violet/25 bg-violet/10 p-3">
            <div className="flex items-center gap-1.5">
              <StatusDot tone="violet" />
              <span className="truncate font-mono text-label-micro uppercase text-violet">Ready</span>
            </div>
            <div className="numeral mt-1.5 text-headline-md text-ink">{summary.ready}</div>
            <div className="mt-0.5 text-body-xs text-ink-faint">awaiting publish</div>
          </div>
        </div>
      </Card>

      {/* -------- Charts -------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader label="Output trend" title="Planned vs published" />
          <div className="px-widget pb-widget pt-2">
            <AreaLineChart
              labels={trend.labels}
              series={[
                { label: 'Planned', tone: 'primary', values: trend.planned },
                { label: 'Published', tone: 'emerald', values: trend.published },
              ]}
              height={210}
            />
          </div>
        </Card>

        <Card>
          <CardHeader label="This month" title="Status mix" />
          <div className="p-widget">
            {statusSlices.length ? (
              <Donut
                slices={statusSlices}
                center={
                  <>
                    <span className="numeral text-headline-md text-ink">{summary.planned}</span>
                    <span className="label-caps">planned</span>
                  </>
                }
              />
            ) : (
              <p className="py-8 text-center text-body-sm text-ink-faint">Nothing planned for this month yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader label="Weekly rhythm" title="By week" />
          <div className="px-widget pb-widget pt-2">
            {summary.byWeek.length ? (
              <GroupedBars
                labels={summary.byWeek.map((w) => w.label)}
                groups={[
                  { label: 'Planned', tone: 'primary', values: summary.byWeek.map((w) => w.planned) },
                  { label: 'Published', tone: 'emerald', values: summary.byWeek.map((w) => w.published) },
                ]}
                height={180}
              />
            ) : (
              <p className="py-10 text-center text-body-sm text-ink-faint">No dated content this month.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader label="Distribution" title="By platform" />
          <div className="p-widget">
            <HBars
              rows={summary.byPlatform.map((p) => ({
                label: p.label,
                value: p.value,
                color: workspace.taxonomies.platforms.find((x) => x.label === p.label)?.color,
              }))}
              emptyLabel="No content this month"
            />
          </div>
        </Card>

        <Card>
          <CardHeader label="Distribution" title="By content type" />
          <div className="p-widget">
            <HBars rows={summary.byType} tone="violet" emptyLabel="No content this month" />
          </div>
        </Card>
      </div>

      {/* -------- Performance totals -------- */}
      {summary.published > 0 && (
        <Card>
          <CardHeader
            label="Published performance"
            title="Totals for the month"
            action={
              <Link to="/publishing" className="inline-flex items-center gap-1 text-body-xs text-primary hover:underline">
                Enter numbers <Icon name="arrow-right" size={13} />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-4 p-widget sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Views" value={fmtCompact(summary.totals.views)} />
            <Stat label="Reach" value={fmtCompact(summary.totals.reach)} />
            <Stat label="Engagement" value={fmtCompact(summary.totals.engagement)} />
            <Stat label="Eng. rate" value={fmtPercent(summary.totals.engagementRate)} tone="emerald" />
            <Stat label="Leads" value={fmtCompact(summary.totals.leads)} />
            <Stat label="Conversions" value={fmtCompact(summary.totals.conversions)} tone="violet" />
          </div>
        </Card>
      )}

      {/* -------- Next up + my work -------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader label="Next up" title="Closest deadlines" />
          <div className="px-2.5 pb-3">
            {upcoming.length ? (
              <ul className="divide-hair">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <ContentMiniRow item={item} workspace={workspace} members={members} />
                    </span>
                    <span
                      className={cx(
                        'shrink-0 pr-2 font-mono text-label-micro uppercase',
                        (daysRemaining(item) ?? 0) < 0 ? 'text-danger' : 'text-ink-faint',
                      )}
                    >
                      {fmtDate(item.plannedPublishDate)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3">
                <EmptyState
                  icon="calendar"
                  title="Nothing scheduled"
                  blurb="Add content with a planned publish date to see it here."
                  action={canEdit ? <Button size="sm" icon="plus" onClick={() => navigate('/content?new=1')}>Add content</Button> : undefined}
                />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            label="Your queue"
            title={me ? `Waiting on ${me.name.split(' ')[0]}` : 'Your work'}
            action={
              <Link to="/tasks" className="inline-flex items-center gap-1 text-body-xs text-primary hover:underline">
                All tasks <Icon name="arrow-right" size={13} />
              </Link>
            }
          />
          <div className="p-widget">
            {mine ? (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing
                    pct={
                      mine.tasksOverdue.length + mine.tasksToday.length + mine.tasksUpcoming.length === 0
                        ? 100
                        : Math.round(
                            (mine.tasksToday.length /
                              Math.max(1, mine.tasksToday.length + mine.tasksOverdue.length)) * 100,
                          )
                    }
                    tone={mine.tasksOverdue.length ? 'danger' : 'primary'}
                    size={72}
                  >
                    <span className="numeral text-headline-sm text-ink">{mine.awaitingMe.length}</span>
                  </ProgressRing>
                  <div className="min-w-0 space-y-1 text-body-sm">
                    <p className="text-ink">
                      <span className="numeral font-semibold">{mine.awaitingMe.length}</span> item
                      {mine.awaitingMe.length === 1 ? '' : 's'} need your next move
                    </p>
                    <p className={cx('text-body-xs', mine.tasksOverdue.length ? 'text-danger' : 'text-ink-faint')}>
                      {mine.tasksOverdue.length} overdue · {mine.tasksToday.length} due today ·{' '}
                      {mine.tasksUpcoming.length} this week
                    </p>
                  </div>
                </div>
                {mine.awaitingMe.length > 0 && (
                  <ul className="mt-3 divide-hair border-t border-white/5 pt-1">
                    {mine.awaitingMe.slice(0, 4).map((item) => (
                      <li key={item.id}>
                        <ContentMiniRow item={item} workspace={workspace} members={members} showOwner={false} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-body-sm text-ink-faint">
                You are viewing this workspace without a team profile, so there is nothing assigned to you.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* -------- Team snapshot -------- */}
      <Card>
        <CardHeader
          label="Team"
          title="Output this month"
          action={
            <Link to="/team" className="inline-flex items-center gap-1 text-body-xs text-primary hover:underline">
              Full breakdown <Icon name="arrow-right" size={13} />
            </Link>
          }
        />
        <div className="overflow-x-auto px-widget pb-widget pt-2">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="label-caps">
                <th className="pb-2 pr-3 font-medium">Person</th>
                <th className="pb-2 pr-3 text-right font-medium">Tasks</th>
                <th className="pb-2 pr-3 text-right font-medium">Done</th>
                <th className="pb-2 pr-3 text-right font-medium">Overdue</th>
                <th className="pb-2 pr-3 text-right font-medium">Waiting</th>
                <th className="pb-2 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-hair">
              {scores.map((s) => (
                <tr key={s.member.id} className="row-hover">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={s.member.name} size={24} />
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm text-ink">{s.member.name}</span>
                        <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                          {s.member.role}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="numeral py-2 pr-3 text-right text-body-sm text-ink-dim">{s.assigned}</td>
                  <td className="numeral py-2 pr-3 text-right text-body-sm text-emerald">{s.completed}</td>
                  <td className={cx('numeral py-2 pr-3 text-right text-body-sm', s.overdue ? 'text-danger' : 'text-ink-faint')}>
                    {s.overdue}
                  </td>
                  <td className="numeral py-2 pr-3 text-right text-body-sm text-ink-dim">{s.awaiting}</td>
                  <td className="numeral py-2 text-right text-body-sm text-ink">{fmtPercent(s.completionRate, 0)}</td>
                </tr>
              ))}
              {scores.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-body-sm text-ink-faint">
                    No active team members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}

const STAGE_TONES: Tone[] = ['primary', 'violet', 'amber', 'emerald']

function MetricTile({
  label,
  value,
  prev,
  icon,
  tone,
  to,
  invertDelta,
}: {
  label: string
  value: number
  prev: number
  icon: IconName
  tone: Tone
  to: string
  invertDelta?: boolean
}) {
  const delta = value - prev
  // For "overdue", a rise is bad — flip which direction reads as good.
  const good = invertDelta ? delta <= 0 : delta >= 0
  return (
    <Link
      to={to}
      className="group rounded-lg border border-line/60 bg-panel p-widget transition-colors duration-150 hover:border-line hover:bg-raised/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        <Icon name={icon} size={17} className={cx('shrink-0 opacity-70', TONE_TEXT[tone])} />
      </div>
      <div className="numeral mt-2 text-data-hero text-ink">{value}</div>
      {prev > 0 || value > 0 ? (
        <div
          className={cx(
            'mt-1 inline-flex items-center gap-1 font-mono text-label-micro uppercase',
            delta === 0 ? 'text-ink-faint' : good ? 'text-emerald' : 'text-danger',
          )}
        >
          {delta !== 0 && <Icon name={delta > 0 ? 'trend-up' : 'trend-down'} size={12} />}
          {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta} vs last month`}
        </div>
      ) : (
        <div className="mt-1 font-mono text-label-micro uppercase text-ink-faint">—</div>
      )}
    </Link>
  )
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={cx('numeral mt-1 text-data-numeral', tone === 'neutral' ? 'text-ink' : TONE_TEXT[tone])}>
        {value}
      </div>
    </div>
  )
}
