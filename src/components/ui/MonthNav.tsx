/**
 * Month stepper used by the dashboard, calendar, team performance and review.
 * A single control keeps every view's month in sync through the store.
 */

import { IconButton, cx } from './primitives'
import { addMonths, currentMonthKey, fmtMonth } from '@/lib/date'

export function MonthNav({
  month,
  onChange,
  className,
  compact,
}: {
  month: string
  onChange: (m: string) => void
  className?: string
  compact?: boolean
}) {
  const isCurrent = month === currentMonthKey()
  return (
    <div className={cx('inline-flex items-center gap-1 rounded border border-line/60 bg-sunken/70 p-0.5', className)}>
      <IconButton icon="chevron-left" label="Previous month" size="sm" onClick={() => onChange(addMonths(month, -1))} />
      <button
        onClick={() => onChange(currentMonthKey())}
        title={isCurrent ? 'Current month' : 'Jump to current month'}
        className={cx(
          'min-w-[8.5rem] px-2 text-center text-body-sm font-medium transition-colors',
          isCurrent ? 'text-ink' : 'text-ink-dim hover:text-ink',
        )}
      >
        {compact ? fmtMonth(month).replace(/ \d{4}$/, '') : fmtMonth(month)}
      </button>
      <IconButton icon="chevron-right" label="Next month" size="sm" onClick={() => onChange(addMonths(month, 1))} />
    </div>
  )
}
