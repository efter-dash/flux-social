/**
 * Publishing & performance.
 *
 * Replaces "05 Publishing & Performance" without its worst chore: there is no
 * "type the Content ID to pull the title in", because performance lives on the
 * content item itself. Engagement and engagement rate are always computed.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ExternalLink,
  PlatformChip,
  SectionTitle,
  StatusChip,
  Tabs,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { HBars } from '@/components/charts/charts'
import { MetricsSheet } from '@/components/content/MetricsSheet'
import { ContentStatus, DeadlineChip } from '@/components/content/pieces'
import { useStore } from '@/state/store'
import type { ContentItem } from '@/lib/types'
import {
  allStagesComplete,
  engagement,
  engagementRate,
  fmtCompact,
  fmtNumber,
  fmtPercent,
  hasMetrics,
  isPublished,
  memberName,
  publishTiming,
  PUBLISH_TIMING_LABEL,
} from '@/lib/derive'
import { fmtDateFull, monthKey } from '@/lib/date'

type Tab = 'ready' | 'awaiting' | 'published'

export function PublishingPage() {
  const { data, month, setMonth, canEdit, markPublished, updateContent } = useStore()
  const [tab, setTab] = useState<Tab>('ready')
  const [metricsFor, setMetricsFor] = useState<ContentItem | null>(null)

  if (!data) return null
  const { workspace, members, content } = data

  const groups = useMemo(() => {
    const monthOf = (c: ContentItem) => monthKey(c.actualPublishDate || c.plannedPublishDate) || c.month
    const inMonth = content.filter((c) => c.lifecycle !== 'cancelled' && monthOf(c) === month)
    const published = inMonth.filter(isPublished).sort((a, b) => b.actualPublishDate.localeCompare(a.actualPublishDate))
    return {
      ready: inMonth
        .filter((c) => !isPublished(c) && allStagesComplete(c, workspace.stages))
        .sort((a, b) => (a.plannedPublishDate || '9999').localeCompare(b.plannedPublishDate || '9999')),
      published,
      awaiting: published.filter((c) => !hasMetrics(c.performance)),
    }
  }, [content, month, workspace.stages])

  const totals = useMemo(() => {
    const t = { views: 0, reach: 0, eng: 0, leads: 0, conv: 0 }
    for (const c of groups.published) {
      const m = c.performance
      if (!m) continue
      t.views += m.views ?? 0
      t.reach += m.reach ?? 0
      t.eng += engagement(m) ?? 0
      t.leads += m.leads ?? 0
      t.conv += m.conversions ?? 0
    }
    return { ...t, rate: t.views ? t.eng / t.views : null }
  }, [groups.published])

  const onTime = useMemo(() => {
    const timed = groups.published.filter((c) => c.plannedPublishDate && c.actualPublishDate)
    if (!timed.length) return null
    return timed.filter((c) => publishTiming(c) !== 'late').length / timed.length
  }, [groups.published])

  const topPlatforms = useMemo(() => {
    const map = new Map<string, { eng: number; views: number }>()
    for (const c of groups.published) {
      const e = engagement(c.performance) ?? 0
      const v = c.performance?.views ?? 0
      const cur = map.get(c.platform) ?? { eng: 0, views: 0 }
      map.set(c.platform, { eng: cur.eng + e, views: cur.views + v })
    }
    return [...map.entries()]
      .map(([label, v]) => ({
        label,
        value: v.views ? Math.round((v.eng / v.views) * 10000) / 100 : 0,
        color: workspace.taxonomies.platforms.find((p) => p.label === label)?.color,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [groups.published, workspace.taxonomies.platforms])

  const list = groups[tab]

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Publishing"
        blurb="Push finished work live, then come back and record how it did."
        action={<MonthNav month={month} onChange={setMonth} />}
      />

      {/* -------- Month totals -------- */}
      <Card>
        <CardHeader label="This month" title={`${groups.published.length} published`} />
        <div className="grid grid-cols-2 gap-4 p-widget sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Views" value={fmtCompact(totals.views)} />
          <Stat label="Reach" value={fmtCompact(totals.reach)} />
          <Stat label="Engagement" value={fmtCompact(totals.eng)} />
          <Stat label="Eng. rate" value={fmtPercent(totals.rate, 2)} tone="emerald" />
          <Stat label="Leads" value={fmtNumber(totals.leads)} />
          <Stat label="On time" value={fmtPercent(onTime, 0)} tone={onTime !== null && onTime < 0.8 ? 'danger' : undefined} />
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'ready', label: 'Ready to publish', count: groups.ready.length },
          { id: 'awaiting', label: 'Needs numbers', count: groups.awaiting.length },
          { id: 'published', label: 'Published', count: groups.published.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* -------- Ready to publish -------- */}
      {tab === 'ready' &&
        (list.length === 0 ? (
          <EmptyState
            icon="send"
            title="Nothing waiting to go live"
            blurb="Items appear here the moment every pipeline stage is complete."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((item) => (
              <li key={item.id}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <PlatformChip
                      label={item.platform || '—'}
                      size="sm"
                      color={workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color}
                    />
                    <ContentStatus item={item} stages={workspace.stages} />
                  </div>
                  <Link to={`/content/${item.id}`} className="mt-2 block">
                    <h3 className="text-body-md font-medium text-ink hover:text-primary">{item.title || 'Untitled'}</h3>
                    <span className="font-mono text-label-micro uppercase text-ink-faint">
                      {item.code} · {memberName(members, item.ownerId)}
                    </span>
                  </Link>
                  <div className="mt-2">
                    <DeadlineChip item={item} stages={workspace.stages} />
                  </div>
                  {item.links.final && (
                    <p className="mt-2 truncate text-body-xs">
                      <ExternalLink href={item.links.final}>final file</ExternalLink>
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="primary" icon="send" onClick={() => void markPublished(item.id)}>
                        Mark published
                      </Button>
                      <Button size="sm" variant="quiet" icon="calendar" onClick={() => setMetricsFor(item)}>
                        With details
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {/* -------- Needs numbers / published table -------- */}
      {tab !== 'ready' &&
        (list.length === 0 ? (
          <EmptyState
            icon={tab === 'awaiting' ? 'check' : 'chart'}
            title={tab === 'awaiting' ? 'Every published item has numbers' : 'Nothing published this month'}
            blurb={
              tab === 'awaiting'
                ? 'Good — the performance record is complete for this month.'
                : 'Publish something from the "Ready" tab and it will appear here.'
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] text-left">
                <thead className="bg-sunken/60">
                  <tr className="label-caps">
                    <th className="px-3 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium">Platform</th>
                    <th className="px-3 py-2.5 font-medium">Published</th>
                    <th className="px-3 py-2.5 text-right font-medium">Views</th>
                    <th className="px-3 py-2.5 text-right font-medium">Reach</th>
                    <th className="px-3 py-2.5 text-right font-medium">Eng.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                    <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                    <th className="px-3 py-2.5 font-medium">Rating</th>
                    <th className="px-3 py-2.5 font-medium">Link</th>
                    {canEdit && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-hair">
                  {list.map((item) => {
                    const rate = engagementRate(item.performance)
                    const timing = publishTiming(item)
                    return (
                      <tr key={item.id} className="row-hover">
                        <td className="max-w-[18rem] px-3 py-2.5">
                          <Link to={`/content/${item.id}`} className="block truncate text-body-sm text-ink hover:text-primary">
                            {item.title || 'Untitled'}
                          </Link>
                          <span className="font-mono text-label-micro uppercase text-ink-faint">{item.code}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PlatformChip
                            label={item.platform || '—'}
                            size="sm"
                            color={workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="block text-body-xs text-ink-dim">{fmtDateFull(item.actualPublishDate)}</span>
                          <span
                            className={cx(
                              'font-mono text-label-micro uppercase',
                              timing === 'late' ? 'text-danger' : 'text-emerald',
                            )}
                          >
                            {PUBLISH_TIMING_LABEL[timing]}
                          </span>
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                          {fmtCompact(item.performance?.views)}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                          {fmtCompact(item.performance?.reach)}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink">
                          {fmtCompact(engagement(item.performance))}
                        </td>
                        <td
                          className={cx(
                            'numeral px-3 py-2.5 text-right text-body-sm',
                            rate === null ? 'text-ink-faint' : rate >= 0.05 ? 'text-emerald' : 'text-ink-dim',
                          )}
                        >
                          {fmtPercent(rate, 2)}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                          {fmtNumber(item.performance?.leads)}
                        </td>
                        <td className="px-3 py-2.5">
                          {item.performance?.rating ? (
                            <StatusChip
                              tone={
                                /excellent/i.test(item.performance.rating)
                                  ? 'emerald'
                                  : /good/i.test(item.performance.rating)
                                    ? 'primary'
                                    : /poor/i.test(item.performance.rating)
                                      ? 'danger'
                                      : 'amber'
                              }
                            >
                              {item.performance.rating}
                            </StatusChip>
                          ) : (
                            <span className="font-mono text-label-micro uppercase text-ink-faint">not rated</span>
                          )}
                        </td>
                        <td className="max-w-[10rem] px-3 py-2.5 text-body-xs">
                          <ExternalLink href={item.links.published} />
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2.5">
                            <Button size="sm" variant="quiet" icon="pencil" onClick={() => setMetricsFor(item)}>
                              {hasMetrics(item.performance) ? 'Edit' : 'Add'}
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {/* -------- Platform effectiveness -------- */}
      {topPlatforms.length > 0 && (
        <Card>
          <CardHeader label="Effectiveness" title="Engagement rate by platform" />
          <div className="p-widget">
            <HBars rows={topPlatforms} format={(n) => `${n.toFixed(2)}%`} />
            <p className="mt-3 flex items-start gap-1.5 text-body-xs text-ink-faint">
              <Icon name="sparkle" size={13} className="mt-0.5 shrink-0" />
              Engagement ÷ views, aggregated across everything published this month.
            </p>
          </div>
        </Card>
      )}

      {metricsFor && (
        <MetricsSheet
          open
          onClose={() => setMetricsFor(null)}
          item={metricsFor}
          workspace={workspace}
          onSave={(patch) => updateContent(metricsFor.id, patch)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'danger' }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div
        className={cx(
          'numeral mt-1 text-data-numeral',
          tone === 'emerald' ? 'text-emerald' : tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  )
}
