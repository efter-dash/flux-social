/**
 * UI primitives.
 *
 * Follows the design system's component rules: solid electric-blue primary
 * buttons with a top inner highlight, ghost buttons with a 1px slate border,
 * pill status chips at 20% background opacity with full-opacity text, filled
 * inputs that sit darker than their container, and JetBrains Mono labels on
 * every widget header.
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Icon, type IconName } from './Icon'
import type { Tone } from '@/lib/derive'
import { hueOf, initialsOf } from '@/lib/derive'

// ---------------------------------------------------------------------------
// Tone system
// ---------------------------------------------------------------------------

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-dim',
  primary: 'text-primary',
  violet: 'text-violet',
  emerald: 'text-emerald',
  amber: 'text-amber',
  danger: 'text-danger',
}

export const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-ink-faint/15 text-ink-dim',
  primary: 'bg-primary/15 text-primary',
  violet: 'bg-violet/15 text-violet',
  emerald: 'bg-emerald/15 text-emerald',
  amber: 'bg-amber/15 text-amber',
  danger: 'bg-danger/15 text-danger',
}

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  primary: 'bg-primary',
  violet: 'bg-violet',
  emerald: 'bg-emerald',
  amber: 'bg-amber',
  danger: 'bg-danger',
}

export const TONE_FILL: Record<Tone, string> = {
  neutral: 'rgb(var(--ink-faint))',
  primary: 'rgb(var(--primary))',
  violet: 'rgb(var(--violet))',
  emerald: 'rgb(var(--emerald))',
  amber: 'rgb(var(--amber))',
  danger: 'rgb(var(--danger))',
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  loading?: boolean
}

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // Balanced borders on every variant prevent layout shifts and misaligned heights when buttons sit together.
  primary:
    'border border-accent/90 bg-accent text-white shadow-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-accent/90 hover:border-accent active:bg-accent/95',
  ghost:
    'border border-line/75 bg-sunken/40 text-ink hover:border-line hover:bg-raised/70 active:bg-raised/90 shadow-xs',
  quiet:
    'border border-transparent bg-transparent text-ink-dim hover:border-line/50 hover:bg-raised/60 hover:text-ink active:bg-raised/80',
  danger:
    'border border-danger/35 bg-danger/10 text-danger hover:border-danger/60 hover:bg-danger/20 active:bg-danger/25',
}

const BUTTON_SIZE = {
  sm: 'h-8 gap-2 px-3 text-body-xs',
  md: 'h-9.5 gap-2 px-4 text-body-sm',
  lg: 'h-11 gap-2.5 px-5 text-body-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, iconRight, block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 13 : 15} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'danger'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', tone = 'default', active, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg border transition-all duration-150 touch-manipulation active:scale-[0.96]',
        size === 'sm' ? 'h-9 w-9 sm:h-8 sm:w-8' : 'h-10 w-10 sm:h-9.5 sm:w-9.5',
        active
          ? 'border-accent/50 bg-accent/15 text-primary shadow-xs'
          : tone === 'danger'
            ? 'border-transparent text-ink-faint hover:border-danger/35 hover:bg-danger/15 hover:text-danger'
            : 'border-transparent text-ink-dim hover:border-line/60 hover:bg-raised/70 hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 19} />
    </button>
  )
})

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" fill="none" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Status vocabulary
// ---------------------------------------------------------------------------

export function StatusChip({
  tone = 'neutral',
  children,
  dot = true,
  className,
  size = 'md',
  onClick,
  title,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
  size?: 'sm' | 'md'
  onClick?: () => void
  title?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-mono uppercase transition-all duration-150',
        onClick &&
          'cursor-pointer select-none touch-manipulation active:scale-[0.98] hover:brightness-110 shadow-xs ring-1 ring-white/10',
        size === 'sm'
          ? onClick
            ? 'min-h-[36px] px-3 py-1.5 text-label-caps sm:min-h-[26px] sm:px-2.5 sm:py-0.5 sm:text-label-micro'
            : 'min-h-[22px] px-2.5 py-0.5 text-label-micro'
          : onClick
            ? 'min-h-[38px] px-3.5 py-1.5 text-label-caps font-semibold sm:min-h-[28px] sm:px-3 sm:py-1'
            : 'min-h-[24px] px-2.5 py-1 text-label-caps sm:text-label-micro font-medium',
        TONE_BG[tone],
        className,
      )}
    >
      {dot && <StatusDot tone={tone} size={size === 'sm' ? 5 : 6} />}
      {children}
    </Tag>
  )
}

/** Small dot with an outer glow of its own colour, per the design system. */
export function StatusDot({ tone = 'neutral', size = 6 }: { tone?: Tone; size?: number }) {
  return (
    <span
      className={cx('inline-block shrink-0 rounded-full', TONE_DOT[tone])}
      style={{ width: size, height: size, boxShadow: `0 0 6px ${TONE_FILL[tone]}` }}
    />
  )
}

export function Chip({
  children,
  className,
  onClick,
  active,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  active?: boolean
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border transition-all duration-150',
        onClick
          ? 'cursor-pointer active:scale-[0.98] select-none touch-manipulation min-h-[40px] px-4 py-2 text-body-xs font-medium sm:min-h-[32px] sm:px-3.5 sm:py-1'
          : 'min-h-[26px] px-3 py-1 text-body-xs font-medium',
        active
          ? 'border-accent bg-accent/20 font-semibold text-primary shadow-xs ring-1 ring-accent/35'
          : 'border-line/75 bg-sunken/60 text-ink-dim hover:border-line hover:bg-raised/70 hover:text-ink',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/** Platform badge: brand colour at 20% behind full-opacity text. */
export function PlatformChip({ label, color, size = 'md' }: { label: string; color?: string; size?: 'sm' | 'md' }) {
  const c = color ?? '#8b90a0'
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-mono uppercase',
        size === 'sm' ? 'px-2 py-0.5 text-label-micro' : 'px-2.5 py-1 text-label-caps font-medium',
      )}
      style={{ backgroundColor: `${c}25`, color: c, border: `1px solid ${c}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
      {label}
    </span>
  )
}

export function PriorityFlag({ priority }: { priority: string }) {
  const tone: Tone = /high|urgent/i.test(priority) ? 'danger' : /low/i.test(priority) ? 'neutral' : 'amber'
  return (
    <span className={cx('inline-flex items-center gap-1 text-label-micro font-mono uppercase', TONE_TEXT[tone])}>
      <Icon name="flag" size={11} />
      {priority || '—'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: As = 'div',
  interactive,
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
  interactive?: boolean
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cx(
        'rounded-lg border border-line/60 bg-panel',
        interactive && 'cursor-pointer transition-colors duration-150 hover:border-line hover:bg-raised/40',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  )
}

export function CardHeader({
  label,
  title,
  action,
  className,
}: {
  label?: string
  title?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-widget pt-widget', className)}>
      <div className="min-w-0">
        {label && <div className="label-caps font-bold text-ink-dim">{label}</div>}
        {title && <div className="mt-1 text-headline-sm font-bold text-ink">{title}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function SectionTitle({
  title,
  blurb,
  action,
}: {
  title: string
  blurb?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-headline-md text-ink sm:text-headline-lg">{title}</h1>
        {blurb && <p className="mt-1 max-w-2xl text-body-sm text-ink-dim">{blurb}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">{action}</div>}
    </div>
  )
}

export function EmptyState({
  icon = 'inbox',
  title,
  blurb,
  action,
}: {
  icon?: IconName
  title: string
  blurb?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line/70 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-ink-faint">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <p className="text-body-md font-medium text-ink">{title}</p>
        {blurb && <p className="mx-auto mt-1 max-w-sm text-body-sm text-ink-dim">{blurb}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function Avatar({ name, size = 28, dim }: { name: string; size?: number; dim?: boolean }) {
  const hue = hueOf(name || '?')
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium uppercase',
        dim && 'opacity-60',
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        background: `linear-gradient(140deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 22%))`,
        color: `hsl(${hue} 90% 88%)`,
        border: '1px solid rgb(255 255 255 / 0.09)',
      }}
      title={name}
    >
      {initialsOf(name || '?')}
    </span>
  )
}

export function AvatarStack({ names, size = 24, max = 3 }: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className="flex items-center">
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} className={i > 0 ? '-ml-2' : ''}>
          <Avatar name={n} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full border border-white/10 bg-raised font-mono text-label-micro text-ink-dim"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function ProgressBar({ pct, tone = 'primary', height = 4 }: { pct: number; tone?: Tone; height?: number }) {
  return (
    <span className="block w-full overflow-hidden rounded-full bg-sunken" style={{ height }}>
      <span
        className={cx('block h-full rounded-full transition-[width] duration-500 ease-swift', TONE_DOT[tone])}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  )
}

export function ProgressRing({
  pct,
  size = 64,
  stroke = 6,
  tone = 'primary',
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  tone?: Tone
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_FILL[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (clamped / 100) * circ}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.32,0.72,0,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="label-caps font-bold text-ink">{children}</span>
      {hint && <span className="text-label-micro text-ink-faint">{hint}</span>}
    </span>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx('field', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cx('field resize-y', className)} {...rest} />
  },
)

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Adds a leading blank option with this label. */
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, placeholder, ...rest },
  ref,
) {
  return (
    <span className="relative block">
      <select ref={ref} className={cx('field field-select', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={15}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
    </span>
  )
})

/** Select bound to a list of plain strings — the shape every taxonomy uses. */
export function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    >
      {/* Keep an unknown stored value visible instead of silently resetting it. */}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-line/60 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'border-accent bg-accent' : 'bg-sunken dark:bg-raised',
      )}
    >
      <span
        className={cx(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-swift',
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export interface TabDef<T extends string> {
  id: T
  label: string
  count?: number
}

/**
 * Horizontally scrolling pill tabs — the pattern from the Posts Manager mockup.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabDef<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cx(
        'no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1 touch-pan-x',
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              'group inline-flex shrink-0 items-center justify-center rounded-full border transition-all duration-150 select-none touch-manipulation active:scale-[0.98]',
              // Smartphone touch target: min-h-[42px] with px-4 py-2; desktop: min-h-[36px] with px-3.5 py-1.5
              'min-h-[42px] px-4 py-2 text-body-xs font-semibold sm:min-h-[36px] sm:px-3.5 sm:py-1.5 sm:font-mono sm:text-label-caps sm:uppercase',
              active
                ? 'border-accent bg-accent/20 text-primary shadow-xs ring-1 ring-accent/40 hover:bg-accent/25'
                : 'border-line/75 bg-sunken/70 text-ink-dim hover:border-line hover:bg-raised hover:text-ink',
            )}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={cx(
                  'ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-[11px] leading-none transition-colors',
                  active
                    ? 'bg-primary/25 font-bold text-primary'
                    : 'border border-line/50 bg-panel/70 text-ink-faint group-hover:text-ink-dim',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Compact segmented control for view switches (Board / Table / Calendar). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: IconName }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-line/70 bg-sunken/60 p-1">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md border min-h-[38px] px-3.5 py-1.5 text-body-xs sm:min-h-[30px] sm:px-3 sm:py-1 font-medium transition-all duration-150 touch-manipulation active:scale-[0.98]',
              active
                ? 'border-line/60 bg-panel text-ink shadow-xs font-semibold'
                : 'border-transparent text-ink-faint hover:text-ink hover:bg-raised/50',
            )}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label-caps">{label}</div>
      <div className="mt-1 truncate text-body-sm text-ink">{children}</div>
    </div>
  )
}

export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  if (!href) return <span className="text-ink-faint">—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      <span className="truncate">{children ?? href.replace(/^https?:\/\//, '')}</span>
      <Icon name="external" size={13} className="shrink-0" />
    </a>
  )
}

export function Hairline({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-white/5', className)} />
}
