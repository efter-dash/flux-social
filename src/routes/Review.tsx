/**
 * Weekly review.
 *
 * Replaces "10 Weekly Review". The numbers for each week are computed from the
 * plan and pipeline; only the discussion notes are typed. Weeks are generated
 * from the calendar, so there is never a missing row to add by hand.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  SectionTitle,
  Select,
  StatusChip,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { MonthNav } from '@/components/ui/MonthNav'
import { useStore } from '@/state/store'
import type { WeeklyReview } from '@/lib/types'
import { weekRollup } from '@/lib/metrics'
import { engagementRate, fmtPercent, memberName, type Tone } from '@/lib/derive'
import { fmtDate, fmtDateFull, today, weeksInMonth } from '@/lib/date'

const STATUS_TONE: Record<WeeklyReview['status'], Tone> = {
  not_started: 'neutral',
  open: 'amber',
  done: 'emerald',
}

const STATUS_LABEL: Record<WeeklyReview['status'], string> = {
  not_started: 'Not started',
  open: 'Open',
  done: 'Done',
}

const NOTE_FIELDS: { key: keyof WeeklyReview; label: string; placeholder: string }[] = [
  { key: 'planned', label: 'What was planned', placeholder: 'The commitments made at the start of the week' },
  { key: 'completed', label: 'What was completed', placeholder: 'What actually shipped' },
  { key: 'delayed', label: 'What was delayed', placeholder: 'What slipped, and why' },
  { key: 'performedWell', label: 'What performed well', placeholder: 'Content that beat expectations' },
  { key: 'needsAttention', label: 'What needs attention next week', placeholder: 'The thing to fix' },
]

export function ReviewPage() {
  const { data, month, setMonth, canEdit, upsertReview, ensureReview } = useStore()
  const [activeWeek, setActiveWeek] = useState<string | null>(null)
  const [draft, setDraft] = useState<WeeklyReview | null>(null)
  const [saving, setSaving] = useState(false)

  const weeks = useMemo(
    () => (data ? weeksInMonth(month, data.workspace.weekStartsOn) : []),
    [data, month],
  )

  // Default to the week containing today, else the first week of the month.
  useEffect(() => {
    if (!weeks.length) return
    const now = today()
    const current = weeks.find((w) => now >= w.start && now <= w.end)
    setActiveWeek((prev) => (prev && weeks.some((w) => w.start === prev) ? prev : (current ?? weeks[0]).start))
  }, [weeks])

  const week = weeks.find((w) => w.start === activeWeek) ?? weeks[0]
  const rollup = useMemo(
    () => (data && week ? weekRollup(data, week.start, week.end) : null),
    [data, week],
  )
  const stored = data?.reviews.find((r) => r.weekStart === week?.start) ?? null

  useEffect(() => {
    setDraft(stored ? { ...stored } : null)
  }, [stored?.id, week?.start]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !week || !rollup) return null
  const { members } = data

  const startEditing = async () => {
    const review = stored ?? (await ensureReview(week.start, week.end, `Week of ${week.start}`))
    setDraft({ ...review })
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await upsertReview(draft)
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof WeeklyReview>(k: K, v: WeeklyReview[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d))

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Weekly review"
        blurb="A ready-made agenda for the weekly meeting: the numbers are computed, the notes are yours."
        action={<MonthNav month={month} onChange={setMonth} />}
      />

      {/* -------- Week picker -------- */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {weeks.map((w, i) => {
          const r = data.reviews.find((x) => x.weekStart === w.start)
          const isCurrent = today() >= w.start && today() <= w.end
          const active = w.start === week.start
          return (
            <button
              key={w.start}
              onClick={() => setActiveWeek(w.start)}
              className={cx(
                'min-w-[9rem] shrink-0 rounded-md border p-3 text-left transition-colors',
                active ? 'border-accent/60 bg-accent/10' : 'border-line/50 bg-panel hover:border-line',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-label-caps uppercase text-ink">Week {i + 1}</span>
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent))]" />}
              </span>
              <span className="mt-1 block font-mono text-label-micro uppercase text-ink-faint">
                {fmtDate(w.start)} – {fmtDate(w.end)}
              </span>
              <span className="mt-2 block">
                <StatusChip tone={STATUS_TONE[r?.status ?? 'not_started']}>
                  {STATUS_LABEL[r?.status ?? 'not_started']}
                </StatusChip>
              </span>
            </button>
          )
        })}
      </div>

      {/* -------- Computed numbers -------- */}
      <Card>
        <CardHeader
          label="Calculated"
          title={`${fmtDateFull(week.start)} – ${fmtDateFull(week.end)}`}
          action={
            <span className="font-mono text-label-micro uppercase text-ink-faint">pulled from the plan</span>
          }
        />
        <div className="grid grid-cols-2 gap-4 p-widget sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Planned" value={rollup.planned} />
          <Stat label="Produced" value={rollup.produced} tone="primary" />
          <Stat label="Published" value={rollup.published} tone="emerald" />
          <Stat label="Still pending" value={rollup.pending} tone="amber" />
          <Stat label="Overdue" value={rollup.overdue} tone={rollup.overdue ? 'danger' : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-white/5 p-widget sm:grid-cols-4">
          {rollup.stageCompletions.map((s) => (
            <Stat key={s.stage.id} label={`${s.stage.name} done`} value={s.count} />
          ))}
        </div>

        {(rollup.topContent || rollup.bottomContent) && (
          <div className="grid gap-3 border-t border-white/5 p-widget sm:grid-cols-2">
            {rollup.topContent && (
              <Highlight
                tone="emerald"
                icon="trend-up"
                label="Best performing"
                item={rollup.topContent.title || rollup.topContent.code}
                to={`/content/${rollup.topContent.id}`}
                value={fmtPercent(engagementRate(rollup.topContent.performance), 2)}
              />
            )}
            {rollup.bottomContent && rollup.bottomContent.id !== rollup.topContent?.id && (
              <Highlight
                tone="danger"
                icon="trend-down"
                label="Weakest performing"
                item={rollup.bottomContent.title || rollup.bottomContent.code}
                to={`/content/${rollup.bottomContent.id}`}
                value={fmtPercent(engagementRate(rollup.bottomContent.performance), 2)}
              />
            )}
          </div>
        )}
      </Card>

      {/* -------- Meeting notes -------- */}
      <Card>
        <CardHeader
          label="Agenda"
          title="Meeting notes"
          action={
            draft ? (
              <Button size="sm" variant="primary" icon="check" loading={saving} onClick={() => void save()}>
                Save
              </Button>
            ) : canEdit ? (
              <Button size="sm" icon="pencil" onClick={() => void startEditing()}>
                Start this review
              </Button>
            ) : undefined
          }
        />

        {!draft ? (
          <div className="p-widget">
            {stored ? null : (
              <p className="text-body-sm text-ink-faint">
                Nothing written for this week yet.
                {canEdit && ' Start the review to fill in the agenda before the meeting.'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-widget">
            <div className="grid gap-3 sm:grid-cols-2">
              {NOTE_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} className={f.key === 'needsAttention' ? 'sm:col-span-2' : undefined}>
                  <Textarea
                    value={(draft[f.key] as string) ?? ''}
                    onChange={(e) => set(f.key, e.target.value as WeeklyReview[typeof f.key])}
                    rows={3}
                    placeholder={f.placeholder}
                    disabled={!canEdit}
                  />
                </Field>
              ))}
            </div>

            <div className="grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-2">
              <Field label="Key wins">
                <Textarea value={draft.keyWins} onChange={(e) => set('keyWins', e.target.value)} rows={2} disabled={!canEdit} />
              </Field>
              <Field label="Key problems">
                <Textarea
                  value={draft.keyProblems}
                  onChange={(e) => set('keyProblems', e.target.value)}
                  rows={2}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Next week's priorities" className="sm:col-span-2">
                <Textarea
                  value={draft.nextPriorities}
                  onChange={(e) => set('nextPriorities', e.target.value)}
                  rows={2}
                  disabled={!canEdit}
                />
              </Field>
            </div>

            <div className="grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-3">
              <Field label="Action owner">
                <Select
                  value={draft.actionOwnerId}
                  onChange={(e) => set('actionOwnerId', e.target.value)}
                  placeholder="Unassigned"
                  disabled={!canEdit}
                >
                  {members
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Action deadline">
                <Input
                  type="date"
                  value={draft.actionDeadline}
                  onChange={(e) => set('actionDeadline', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Review status">
                <Select
                  value={draft.status}
                  onChange={(e) => set('status', e.target.value as WeeklyReview['status'])}
                  disabled={!canEdit}
                >
                  {(Object.keys(STATUS_LABEL) as WeeklyReview['status'][]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Card>

      {/* -------- History -------- */}
      {data.reviews.length > 0 && (
        <Card>
          <CardHeader label="History" title="Past reviews" />
          <ul className="divide-hair px-2.5 pb-3 pt-1">
            {[...data.reviews]
              .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
              .slice(0, 8)
              .map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setMonth(r.weekStart.slice(0, 7))
                      setActiveWeek(r.weekStart)
                    }}
                    className="flex w-full items-center gap-3 rounded px-2 py-2.5 text-left transition-colors hover:bg-raised/60"
                  >
                    <span className="w-28 shrink-0 font-mono text-label-micro uppercase text-ink-faint">
                      {fmtDate(r.weekStart)} – {fmtDate(r.weekEnd)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink-dim">
                      {r.keyWins || r.completed || r.nextPriorities || 'No notes'}
                    </span>
                    {r.actionOwnerId && (
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <Avatar name={memberName(members, r.actionOwnerId)} size={20} />
                      </span>
                    )}
                    <StatusChip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusChip>
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  const color =
    tone === 'emerald'
      ? 'text-emerald'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'amber'
          ? 'text-amber'
          : tone === 'primary'
            ? 'text-primary'
            : 'text-ink'
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={cx('numeral mt-1 text-headline-md', color)}>{value}</div>
    </div>
  )
}

function Highlight({
  tone,
  icon,
  label,
  item,
  to,
  value,
}: {
  tone: 'emerald' | 'danger'
  icon: 'trend-up' | 'trend-down'
  label: string
  item: string
  to: string
  value: string
}) {
  return (
    <Link
      to={to}
      className={cx(
        'flex items-center gap-3 rounded-md border p-3 transition-colors',
        tone === 'emerald' ? 'border-emerald/25 bg-emerald/10' : 'border-danger/25 bg-danger/10',
      )}
    >
      <Icon name={icon} size={18} className={cx('shrink-0', tone === 'emerald' ? 'text-emerald' : 'text-danger')} />
      <span className="min-w-0 flex-1">
        <span className="block label-caps">{label}</span>
        <span className="block truncate text-body-sm text-ink">{item}</span>
      </span>
      <span className={cx('numeral shrink-0 font-mono text-body-sm', tone === 'emerald' ? 'text-emerald' : 'text-danger')}>
        {value}
      </span>
    </Link>
  )
}
