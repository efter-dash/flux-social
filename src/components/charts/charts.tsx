/**
 * Charts, hand-drawn as SVG.
 *
 * Written rather than imported so they match the design system exactly: 2px
 * strokes, area gradients that fade into the page, a glowing endpoint on the
 * latest value, dashed gridlines, and tabular figures on every label. They scale
 * through `viewBox` so a single implementation works from a 360px phone to a
 * wide desktop widget.
 */

import { useId, type ReactNode } from 'react'
import { TONE_FILL, cx } from '@/components/ui/primitives'
import type { Tone } from '@/lib/derive'

export interface Series {
  label: string
  tone: Tone
  values: number[]
}

const W = 600
const H = 220
const PAD = { top: 16, right: 14, bottom: 26, left: 34 }

// ---------------------------------------------------------------------------
// Line / area
// ---------------------------------------------------------------------------

export function AreaLineChart({
  series,
  labels,
  area = true,
  height = 220,
  yFormat = (n: number) => `${n}`,
}: {
  series: Series[]
  labels: string[]
  area?: boolean
  height?: number
  yFormat?: (n: number) => string
}) {
  const gid = useId().replace(/:/g, '')
  const all = series.flatMap((s) => s.values)
  const max = Math.max(1, ...all)
  const niceMax = niceCeil(max)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const count = Math.max(1, labels.length - 1)

  const x = (i: number) => PAD.left + (i / count) * innerW
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH

  const ticks = [0, 0.5, 1].map((t) => niceMax * t)

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${gid}-fill-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TONE_FILL[s.tone]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={TONE_FILL[s.tone]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Dashed gridlines, low contrast so the data stays dominant. */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="rgb(var(--line))"
              strokeOpacity="0.5"
              strokeDasharray="2 5"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              className="numeral"
              fill="rgb(var(--ink-faint))"
              fontSize="10"
              fontFamily="'JetBrains Mono', monospace"
            >
              {yFormat(Math.round(t))}
            </text>
          </g>
        ))}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as const)
          const line = smoothPath(pts)
          const fill = `${line} L ${x(s.values.length - 1)} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`
          const last = pts[pts.length - 1]
          return (
            <g key={si}>
              {area && <path d={fill} fill={`url(#${gid}-fill-${si})`} />}
              <path
                d={line}
                fill="none"
                stroke={TONE_FILL[s.tone]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {last && (
                <>
                  {/* Glow ring on the latest point — the "neon endpoint". */}
                  <circle cx={last[0]} cy={last[1]} r="6" fill={TONE_FILL[s.tone]} opacity="0.22" />
                  <circle cx={last[0]} cy={last[1]} r="3" fill="rgb(var(--base))" stroke={TONE_FILL[s.tone]} strokeWidth="2" />
                </>
              )}
            </g>
          )
        })}

        {labels.map((l, i) => {
          // Thin out labels on narrow data so they never collide.
          const step = labels.length > 8 ? Math.ceil(labels.length / 6) : 1
          if (i % step !== 0 && i !== labels.length - 1) return null
          return (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fill="rgb(var(--ink-faint))"
              fontSize="10"
              fontFamily="'JetBrains Mono', monospace"
            >
              {l}
            </text>
          )
        })}
      </svg>

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-body-xs text-ink-dim">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TONE_FILL[s.tone], boxShadow: `0 0 6px ${TONE_FILL[s.tone]}` }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Catmull-Rom converted to cubic béziers — smooth without overshooting much. */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const t = 0.2
    const c1x = p1[0] + (p2[0] - p0[0]) * t
    const c1y = p1[1] + (p2[1] - p0[1]) * t
    const c2x = p2[0] - (p3[0] - p1[0]) * t
    const c2y = p2[1] - (p3[1] - p1[1]) * t
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`
  }
  return d
}

function niceCeil(n: number): number {
  if (n <= 5) return 5
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / mag) * mag
}

// ---------------------------------------------------------------------------
// Grouped bars
// ---------------------------------------------------------------------------

export function GroupedBars({
  labels,
  groups,
  height = 200,
}: {
  labels: string[]
  groups: { label: string; tone: Tone; values: number[] }[]
  height?: number
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values))
  const niceMax = niceCeil(max)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, labels.length)
  const barW = Math.min(22, (slot - 10) / groups.length)

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        {[0, 0.5, 1].map((t, i) => {
          const v = niceMax * t
          const yy = PAD.top + innerH - (v / niceMax) * innerH
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yy}
                y2={yy}
                stroke="rgb(var(--line))"
                strokeOpacity="0.5"
                strokeDasharray="2 5"
              />
              <text
                x={PAD.left - 8}
                y={yy + 3.5}
                textAnchor="end"
                fill="rgb(var(--ink-faint))"
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
              >
                {Math.round(v)}
              </text>
            </g>
          )
        })}

        {labels.map((l, i) => {
          const groupCenter = PAD.left + slot * i + slot / 2
          const totalW = barW * groups.length + 3 * (groups.length - 1)
          return (
            <g key={l}>
              {groups.map((g, gi) => {
                const v = g.values[i] ?? 0
                const h = (v / niceMax) * innerH
                const bx = groupCenter - totalW / 2 + gi * (barW + 3)
                return (
                  <rect
                    key={g.label}
                    x={bx}
                    y={PAD.top + innerH - h}
                    width={barW}
                    height={Math.max(v > 0 ? 2 : 0, h)}
                    rx="3"
                    fill={TONE_FILL[g.tone]}
                    opacity={gi === 0 ? 0.85 : 1}
                  />
                )
              })}
              <text
                x={groupCenter}
                y={H - 8}
                textAnchor="middle"
                fill="rgb(var(--ink-faint))"
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
              >
                {l}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {groups.map((g) => (
          <span key={g.label} className="inline-flex items-center gap-1.5 text-body-xs text-ink-dim">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: TONE_FILL[g.tone] }} />
            {g.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal bars — better than vertical for long category names
// ---------------------------------------------------------------------------

export function HBars({
  rows,
  tone = 'primary',
  max: maxOverride,
  format = (n: number) => `${n}`,
  emptyLabel = 'No data yet',
}: {
  rows: { label: string; value: number; tone?: Tone; color?: string }[]
  tone?: Tone
  max?: number
  format?: (n: number) => string
  emptyLabel?: string
}) {
  if (!rows.length) return <p className="py-6 text-center text-body-sm text-ink-faint">{emptyLabel}</p>
  const max = Math.max(1, maxOverride ?? Math.max(...rows.map((r) => r.value)))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-body-xs text-ink-dim">{r.label}</span>
            <span className="numeral shrink-0 font-mono text-label-caps text-ink">{format(r.value)}</span>
          </div>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-swift"
              style={{
                width: `${(r.value / max) * 100}%`,
                backgroundColor: r.color ?? TONE_FILL[r.tone ?? tone],
                boxShadow: `0 0 8px ${r.color ?? TONE_FILL[r.tone ?? tone]}55`,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------

export function Donut({
  slices,
  size = 160,
  thickness = 18,
  center,
}: {
  slices: { label: string; value: number; tone: Tone }[]
  size?: number
  thickness?: number
  center?: ReactNode
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={thickness} />
          {total > 0 &&
            slices.map((s) => {
              if (s.value === 0) return null
              const len = (s.value / total) * circ
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={TONE_FILL[s.tone]}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              )
              offset += len
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {center ?? (
            <>
              <span className="numeral text-headline-md text-ink">{total}</span>
              <span className="label-caps">total</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 text-body-xs">
              <span className="flex min-w-0 items-center gap-2 text-ink-dim">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: TONE_FILL[s.tone], boxShadow: `0 0 6px ${TONE_FILL[s.tone]}` }}
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="numeral shrink-0 font-mono text-ink">
                {s.value}
                <span className="ml-1 text-ink-faint">{total ? `${Math.round((s.value / total) * 100)}%` : ''}</span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline — sits inside metric tiles
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  tone = 'primary',
  width = 120,
  height = 34,
}: {
  values: number[]
  tone?: Tone
  width?: number
  height?: number
}) {
  const gid = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 3 - ((v - min) / span) * (height - 6),
  ] as const)
  const line = smoothPath(pts)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${gid}-sp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TONE_FILL[tone]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={TONE_FILL[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gid}-sp)`} />
      <path d={line} fill="none" stroke={TONE_FILL[tone]} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={TONE_FILL[tone]} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Funnel — the pipeline stage strip
// ---------------------------------------------------------------------------

export function StageFunnel({
  steps,
}: {
  steps: { label: string; value: number; tone: Tone }[]
}) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  return (
    <div className="flex items-end gap-2">
      {steps.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="numeral font-mono text-body-sm text-ink">{s.value}</span>
          <span
            className="w-full rounded-t transition-[height] duration-700 ease-swift"
            style={{
              height: `${Math.max(4, (s.value / max) * 72)}px`,
              backgroundColor: TONE_FILL[s.tone],
              opacity: 0.85,
            }}
          />
          <span className={cx('w-full truncate text-center text-label-micro uppercase text-ink-faint')} title={s.label}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
