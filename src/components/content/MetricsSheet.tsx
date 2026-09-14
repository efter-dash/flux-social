/**
 * Performance entry.
 *
 * Only raw counts are typed in. Engagement (likes + comments + shares + saves)
 * and engagement rate (engagement ÷ views) are shown live as you type but never
 * stored — the same rule as everywhere else in the app.
 */

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Overlay'
import { Button, Field, Input, OptionSelect, StatusChip, Textarea, cx } from '@/components/ui/primitives'
import type { ContentItem, PerformanceMetrics, Workspace } from '@/lib/types'
import { EMPTY_METRICS } from '@/lib/types'
import { engagement, engagementRate, fmtCompact, fmtPercent, publishTiming, PUBLISH_TIMING_LABEL } from '@/lib/derive'

const COUNT_FIELDS: { key: keyof PerformanceMetrics; label: string; hint?: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'watchTimeMin', label: 'Watch time', hint: 'minutes' },
  { key: 'avgWatchTimeSec', label: 'Avg watch', hint: 'seconds' },
  { key: 'leads', label: 'Leads' },
  { key: 'conversions', label: 'Conversions' },
]

export function MetricsSheet({
  open,
  onClose,
  item,
  workspace,
  onSave,
}: {
  open: boolean
  onClose: () => void
  item: ContentItem
  workspace: Workspace
  onSave: (patch: Partial<ContentItem>) => void | Promise<void>
}) {
  const [m, setM] = useState<PerformanceMetrics>(item.performance ?? { ...EMPTY_METRICS })
  const [publishedLink, setPublishedLink] = useState(item.links.published)
  const [actualDate, setActualDate] = useState(item.actualPublishDate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setM(item.performance ?? { ...EMPTY_METRICS })
    setPublishedLink(item.links.published)
    setActualDate(item.actualPublishDate)
  }, [item.id, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const setNum = (key: keyof PerformanceMetrics, raw: string) => {
    const v = raw.trim() === '' ? null : Number(raw)
    setM((prev) => ({ ...prev, [key]: v === null || Number.isNaN(v) ? null : v }))
  }

  const eng = engagement(m)
  const rate = engagementRate(m)
  const preview = { ...item, performance: m, actualPublishDate: actualDate }

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        performance: m,
        actualPublishDate: actualDate,
        lifecycle: actualDate ? 'published' : item.lifecycle,
        links: { ...item.links, published: publishedLink },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Performance"
      subtitle={`${item.code} · ${item.platform}`}
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
            Save numbers
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* -------- Live derived values -------- */}
        <div className="grid grid-cols-2 gap-3 rounded-md border border-line/50 bg-sunken/60 p-3 sm:grid-cols-4">
          <Derived label="Engagement" value={fmtCompact(eng)} hint="likes + comments + shares + saves" />
          <Derived label="Engagement rate" value={fmtPercent(rate, 2)} hint="engagement ÷ views" tone="emerald" />
          <Derived
            label="Per 1k views"
            value={m.views ? `${(((eng ?? 0) / m.views) * 1000).toFixed(1)}` : '—'}
            hint="interactions"
          />
          <div>
            <div className="label-caps">Timing</div>
            <div className="mt-1.5">
              <StatusChip tone={publishTiming(preview) === 'late' ? 'danger' : 'emerald'}>
                {PUBLISH_TIMING_LABEL[publishTiming(preview)]}
              </StatusChip>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Actual publish date">
            <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
          </Field>
          <Field label="Published link">
            <Input value={publishedLink} onChange={(e) => setPublishedLink(e.target.value)} placeholder="https://" />
          </Field>
        </div>

        <section>
          <h3 className="mb-2.5 border-b border-white/5 pb-1.5 label-caps">Counts</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={(m[f.key] as number | null) ?? ''}
                  onChange={(e) => setNum(f.key, e.target.value)}
                  className="numeral"
                  placeholder="—"
                />
              </Field>
            ))}
            <Field label="Completion" hint="percent">
              <Input
                type="number"
                min={0}
                max={100}
                value={m.completionRate === null ? '' : Math.round(m.completionRate * 100)}
                onChange={(e) =>
                  setM((prev) => ({
                    ...prev,
                    completionRate: e.target.value.trim() === '' ? null : Number(e.target.value) / 100,
                  }))
                }
                className="numeral"
                placeholder="—"
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-2.5 border-b border-white/5 pb-1.5 label-caps">Assessment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Performance rating">
              <OptionSelect
                value={m.rating}
                onChange={(v) => setM((prev) => ({ ...prev, rating: v }))}
                options={workspace.taxonomies.performanceRatings}
                placeholder="Not rated"
              />
            </Field>
            <Field label="Repurpose potential">
              <OptionSelect
                value={m.repurposePotential}
                onChange={(v) => setM((prev) => ({ ...prev, repurposePotential: v }))}
                options={workspace.taxonomies.repurposeLevels}
                placeholder="—"
              />
            </Field>
            <Field label="Audience response" className="sm:col-span-2">
              <Input
                value={m.response}
                onChange={(e) => setM((prev) => ({ ...prev, response: e.target.value }))}
                placeholder="e.g. Strong comment thread, mostly questions"
              />
            </Field>
            <Field label="Key learning" className="sm:col-span-2" hint="what the team should repeat or avoid">
              <Textarea
                value={m.keyLearning}
                onChange={(e) => setM((prev) => ({ ...prev, keyLearning: e.target.value }))}
                rows={3}
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <Textarea
                value={m.remarks}
                onChange={(e) => setM((prev) => ({ ...prev, remarks: e.target.value }))}
                rows={2}
              />
            </Field>
          </div>
        </section>
      </div>
    </Sheet>
  )
}

function Derived({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'emerald'
}) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={cx('numeral mt-1 text-data-numeral', tone === 'emerald' ? 'text-emerald' : 'text-ink')}>{value}</div>
      {hint && <div className="mt-0.5 text-label-micro text-ink-faint">{hint}</div>}
    </div>
  )
}
