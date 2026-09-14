/**
 * Content library.
 *
 * Replaces "07 Content Library". In the spreadsheet this was a separate tab you
 * had to remember to file things into; here it is simply a view over everything
 * ever published, so nothing can be missing from it. Sorted by whatever the team
 * wants to learn from — usually engagement rate, not recency.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ExternalLink,
  Input,
  OptionSelect,
  PlatformChip,
  SectionTitle,
  Segmented,
  StatusChip,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { HBars } from '@/components/charts/charts'
import { useStore } from '@/state/store'
import type { ContentItem } from '@/lib/types'
import {
  engagement,
  engagementRate,
  fmtCompact,
  fmtPercent,
  isPublished,
  memberName,
  type Tone,
} from '@/lib/derive'
import { fmtDateFull } from '@/lib/date'

type SortKey = 'recent' | 'rate' | 'views' | 'leads'

const RATING_TONE = (rating: string): Tone =>
  /excellent/i.test(rating) ? 'emerald' : /good/i.test(rating) ? 'primary' : /poor/i.test(rating) ? 'danger' : 'amber'

export function LibraryPage() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [platform, setPlatform] = useState('')
  const [type, setType] = useState('')
  const [rating, setRating] = useState('')
  const [repurpose, setRepurpose] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<'table' | 'cards'>(window.innerWidth >= 1024 ? 'table' : 'cards')

  if (!data) return null
  const { workspace, members, content } = data

  const published = useMemo(() => content.filter(isPublished), [content])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = published.filter((c) => {
      if (platform && c.platform !== platform && !c.crossPost.includes(platform)) return false
      if (type && c.contentType !== type) return false
      if (rating && c.performance?.rating !== rating) return false
      if (repurpose && c.performance?.repurposePotential !== repurpose) return false
      if (term) {
        const hay = [
          c.code,
          c.title,
          c.topic,
          c.category,
          c.contentType,
          c.platform,
          c.audience,
          c.performance?.keyLearning ?? '',
          c.performance?.response ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'rate':
          return (engagementRate(b.performance) ?? -1) - (engagementRate(a.performance) ?? -1)
        case 'views':
          return (b.performance?.views ?? -1) - (a.performance?.views ?? -1)
        case 'leads':
          return (b.performance?.leads ?? -1) - (a.performance?.leads ?? -1)
        default:
          return (b.actualPublishDate || '').localeCompare(a.actualPublishDate || '')
      }
    })
  }, [published, q, platform, type, rating, repurpose, sort])

  /** What the archive is actually for: which formats keep working. */
  const byType = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const c of published) {
      const r = engagementRate(c.performance)
      if (r === null) continue
      const cur = map.get(c.contentType) ?? { total: 0, count: 0 }
      map.set(c.contentType, { total: cur.total + r, count: cur.count + 1 })
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label: `${label} (${v.count})`, value: Math.round((v.total / v.count) * 10000) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [published])

  const repurposable = useMemo(
    () => published.filter((c) => /high/i.test(c.performance?.repurposePotential ?? '')),
    [published],
  )

  const learnings = useMemo(
    () => published.filter((c) => c.performance?.keyLearning?.trim()).slice(0, 6),
    [published],
  )

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Library"
        blurb="Everything ever published, kept so the team can repeat what worked."
        action={
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
        }
      />

      {published.length === 0 ? (
        <EmptyState
          icon="library"
          title="Nothing archived yet"
          blurb="Once something is published it appears here automatically — there is no separate filing step."
          action={
            <Button size="sm" icon="send" onClick={() => (window.location.href = '/publishing')}>
              Go to publishing
            </Button>
          }
        />
      ) : (
        <>
          {/* -------- Filters -------- */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <span className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the archive…" className="pl-9" />
            </span>
            <OptionSelect
              value={platform}
              onChange={setPlatform}
              options={workspace.taxonomies.platforms.map((p) => p.label)}
              placeholder="Any platform"
            />
            <OptionSelect value={type} onChange={setType} options={workspace.taxonomies.contentTypes} placeholder="Any type" />
            <OptionSelect
              value={rating}
              onChange={setRating}
              options={workspace.taxonomies.performanceRatings}
              placeholder="Any rating"
            />
            <OptionSelect
              value={repurpose}
              onChange={setRepurpose}
              options={workspace.taxonomies.repurposeLevels}
              placeholder="Any repurpose value"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-label-micro uppercase text-ink-faint">sort</span>
            {(
              [
                { id: 'recent', label: 'Most recent' },
                { id: 'rate', label: 'Engagement rate' },
                { id: 'views', label: 'Views' },
                { id: 'leads', label: 'Leads' },
              ] as { id: SortKey; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cx(
                  'rounded-full border px-3 py-1 text-body-xs transition-colors',
                  sort === s.id
                    ? 'border-accent/60 bg-accent/15 text-primary'
                    : 'border-line/60 bg-sunken/60 text-ink-dim hover:border-line',
                )}
              >
                {s.label}
              </button>
            ))}
            <span className="ml-auto font-mono text-label-micro uppercase text-ink-faint">
              {rows.length} of {published.length}
            </span>
          </div>

          {/* -------- Archive -------- */}
          {rows.length === 0 ? (
            <EmptyState icon="search" title="Nothing matches" blurb="Try clearing a filter." />
          ) : view === 'cards' ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((item) => (
                <li key={item.id}>
                  <LibraryCard item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-left">
                  <thead className="bg-sunken/60">
                    <tr className="label-caps">
                      <th className="px-3 py-2.5 font-medium">Content</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Platform</th>
                      <th className="px-3 py-2.5 font-medium">Published</th>
                      <th className="px-3 py-2.5 text-right font-medium">Views</th>
                      <th className="px-3 py-2.5 text-right font-medium">Eng.</th>
                      <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                      <th className="px-3 py-2.5 font-medium">Rating</th>
                      <th className="px-3 py-2.5 font-medium">Repurpose</th>
                      <th className="px-3 py-2.5 font-medium">Key learning</th>
                      <th className="px-3 py-2.5 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-hair">
                    {rows.map((item) => (
                      <tr key={item.id} className="row-hover align-top">
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <Link to={`/content/${item.id}`} className="block truncate text-body-sm text-ink hover:text-primary">
                            {item.title || 'Untitled'}
                          </Link>
                          <span className="font-mono text-label-micro uppercase text-ink-faint">
                            {item.code} · {memberName(members, item.ownerId)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-body-xs text-ink-dim">{item.contentType}</td>
                        <td className="px-3 py-2.5">
                          <PlatformChip
                            label={item.platform || '—'}
                            size="sm"
                            color={workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-body-xs text-ink-dim">
                          {fmtDateFull(item.actualPublishDate)}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                          {fmtCompact(item.performance?.views)}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                          {fmtCompact(engagement(item.performance))}
                        </td>
                        <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink">
                          {fmtPercent(engagementRate(item.performance), 2)}
                        </td>
                        <td className="px-3 py-2.5">
                          {item.performance?.rating ? (
                            <StatusChip tone={RATING_TONE(item.performance.rating)}>{item.performance.rating}</StatusChip>
                          ) : (
                            <span className="font-mono text-label-micro uppercase text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-body-xs text-ink-dim">
                          {item.performance?.repurposePotential || '—'}
                        </td>
                        <td className="max-w-[18rem] px-3 py-2.5">
                          <span className="line-clamp-2 text-body-xs text-ink-dim">
                            {item.performance?.keyLearning || '—'}
                          </span>
                        </td>
                        <td className="max-w-[9rem] px-3 py-2.5 text-body-xs">
                          <ExternalLink href={item.links.published} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* -------- What the archive tells you -------- */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader label="Format" title="Average engagement rate by type" />
              <div className="p-widget">
                <HBars rows={byType} tone="violet" format={(n) => `${n.toFixed(2)}%`} emptyLabel="No rated content yet" />
              </div>
            </Card>

            <Card>
              <CardHeader label="Reuse" title={`${repurposable.length} worth repurposing`} />
              <div className="px-2.5 pb-3 pt-1">
                {repurposable.length ? (
                  <ul className="divide-hair">
                    {repurposable.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/content/${item.id}`}
                          className="flex items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-raised/60"
                        >
                          <Icon name="bookmark" size={15} className="shrink-0 text-emerald" />
                          <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{item.title || 'Untitled'}</span>
                          <span className="numeral shrink-0 font-mono text-label-micro text-ink-faint">
                            {fmtPercent(engagementRate(item.performance), 1)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-6 text-center text-body-sm text-ink-faint">
                    Mark repurpose potential as “High” when recording performance.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader label="Learnings" title="What the team wrote down" />
              <div className="space-y-2.5 p-widget">
                {learnings.length ? (
                  learnings.map((item) => (
                    <div key={item.id} className="rounded-md border border-line/40 bg-sunken/40 p-2.5">
                      <Link
                        to={`/content/${item.id}`}
                        className="font-mono text-label-micro uppercase text-primary hover:underline"
                      >
                        {item.code}
                      </Link>
                      <p className="mt-1 text-body-xs text-ink-dim">{item.performance?.keyLearning}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-body-sm text-ink-faint">
                    Add a key learning when recording performance and it will collect here.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function LibraryCard({ item }: { item: ContentItem }) {
  const { data } = useStore()
  if (!data) return null
  const { workspace, members } = data
  const rate = engagementRate(item.performance)

  return (
    <Card className="flex h-full flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <PlatformChip
          label={item.platform || '—'}
          size="sm"
          color={workspace.taxonomies.platforms.find((p) => p.label === item.platform)?.color}
        />
        {item.performance?.rating && (
          <StatusChip tone={RATING_TONE(item.performance.rating)}>{item.performance.rating}</StatusChip>
        )}
      </div>

      <Link to={`/content/${item.id}`} className="mt-2 block">
        <h3 className="line-clamp-2 text-body-md font-medium leading-snug text-ink hover:text-primary">
          {item.title || 'Untitled'}
        </h3>
      </Link>
      <p className="mt-1 font-mono text-label-micro uppercase text-ink-faint">
        {item.code} · {item.contentType} · {fmtDateFull(item.actualPublishDate)}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-line/40 bg-sunken/40 p-2.5">
        <Mini label="Views" value={fmtCompact(item.performance?.views)} />
        <Mini label="Eng." value={fmtCompact(engagement(item.performance))} />
        <Mini label="Rate" value={fmtPercent(rate, 1)} highlight />
      </div>

      {item.performance?.keyLearning && (
        <p className="mt-2.5 line-clamp-3 text-body-xs text-ink-dim">{item.performance.keyLearning}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={memberName(members, item.ownerId)} size={20} />
          <span className="truncate font-mono text-label-micro uppercase text-ink-faint">
            {memberName(members, item.ownerId)}
          </span>
        </span>
        <span className="shrink-0 text-body-xs">
          <ExternalLink href={item.links.published}>post</ExternalLink>
        </span>
      </div>
    </Card>
  )
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-label-micro uppercase text-ink-faint">{label}</div>
      <div className={cx('numeral mt-0.5 font-mono text-body-sm', highlight ? 'text-emerald' : 'text-ink')}>{value}</div>
    </div>
  )
}
