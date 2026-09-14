/**
 * Date helpers.
 *
 * Every date in FLUX is stored as a plain `YYYY-MM-DD` string, never a
 * timestamp. Deadlines are calendar days — a shoot on the 12th is the 12th
 * everywhere — so time zones must not be able to shift them.
 */

export type ISODate = string // YYYY-MM-DD

const MS_PER_DAY = 86_400_000

/** Today as `YYYY-MM-DD` in the viewer's own time zone. */
export function today(): ISODate {
  return toISO(new Date())
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses `YYYY-MM-DD` at local midnight. Returns null for empty/invalid input. */
export function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function isValidISO(s: string | null | undefined): boolean {
  return parseISO(s) !== null
}

/** Whole days from `from` to `to`. Negative means `to` is in the past. */
export function daysBetween(from: ISODate, to: ISODate): number | null {
  const a = parseISO(from)
  const b = parseISO(to)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISO(date)
  if (!d) return date
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m - 1) + n, 1)
  return monthKey(toISO(d))
}

/** `YYYY-MM` for a date, or for a month key passed straight through. */
export function monthKey(date: string): string {
  return (date || '').slice(0, 7)
}

export function currentMonthKey(): string {
  return monthKey(today())
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const d = parseISO(date)
  if (!d) return date
  const shift = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - shift)
  return toISO(d)
}

export function endOfWeek(date: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  return addDays(startOfWeek(date, weekStartsOn), 6)
}

/**
 * Week-of-month, 1-based, matching the spreadsheet's "Week 1..Week 5" concept:
 * the calendar week containing the 1st is Week 1.
 */
export function weekOfMonth(date: string, weekStartsOn: 0 | 1 = 1): number | null {
  const d = parseISO(date)
  if (!d) return null
  const firstOfMonth = `${monthKey(date)}-01`
  const firstWeekStart = startOfWeek(firstOfMonth, weekStartsOn)
  const diff = daysBetween(firstWeekStart, date)
  if (diff === null) return null
  return Math.floor(diff / 7) + 1
}

export function weekLabel(date: string, weekStartsOn: 0 | 1 = 1): string {
  const n = weekOfMonth(date, weekStartsOn)
  return n ? `Week ${n}` : '—'
}

/** Every week-start in a month, for the weekly review table. */
export function weeksInMonth(month: string, weekStartsOn: 0 | 1 = 1): { start: ISODate; end: ISODate; label: string }[] {
  const first = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const last = `${month}-${`${lastDay}`.padStart(2, '0')}`
  const out: { start: ISODate; end: ISODate; label: string }[] = []
  let cursor = startOfWeek(first, weekStartsOn)
  let i = 1
  while (cursor <= last) {
    out.push({ start: cursor, end: addDays(cursor, 6), label: `Week ${i}` })
    cursor = addDays(cursor, 7)
    i++
  }
  return out
}

/** Month grid including leading/trailing days, for the calendar view. */
export function monthGrid(month: string, weekStartsOn: 0 | 1 = 1): ISODate[] {
  const first = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const gridStart = startOfWeek(first, weekStartsOn)
  const gridEnd = endOfWeek(`${month}-${`${lastDay}`.padStart(2, '0')}`, weekStartsOn)
  const out: ISODate[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

export function isInRange(date: string, start: ISODate, end: ISODate): boolean {
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= start && d <= end
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "12 Aug" — the default compact date used across cards and tables. */
export function fmtDate(date: string | null | undefined): string {
  const d = parseISO(date ?? '')
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/** "12 Aug 2026" for archival contexts where the year matters. */
export function fmtDateFull(date: string | null | undefined): string {
  const d = parseISO(date ?? '')
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDayName(date: string): string {
  const d = parseISO(date)
  return d ? DAYS_SHORT[d.getDay()] : '—'
}

/** "August 2026" from a `YYYY-MM` key. */
export function fmtMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${MONTHS_LONG[m - 1]} ${y}`
}

/** "Aug 2026" from a `YYYY-MM` key. */
export function fmtMonthShort(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${MONTHS_SHORT[m - 1]} ${y}`
}

export function weekdayHeaders(weekStartsOn: 0 | 1 = 1): string[] {
  return Array.from({ length: 7 }, (_, i) => DAYS_SHORT[(i + weekStartsOn) % 7])
}

/** "in 3 days" / "2 days ago" / "today" — for deadline chips. */
export function relativeDays(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 0) return `in ${n} days`
  return `${Math.abs(n)} days ago`
}

/** Month keys spanning the data, newest first, always including this month. */
export function monthRange(dates: string[]): string[] {
  const set = new Set<string>(dates.map(monthKey).filter((m) => /^\d{4}-\d{2}$/.test(m)))
  set.add(currentMonthKey())
  return [...set].sort().reverse()
}
