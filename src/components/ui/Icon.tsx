/**
 * Inline icon set.
 *
 * Hand-drawn on a 24px grid with a 1.75 stroke, rather than pulling an icon font
 * or package: the app stays self-contained, works offline, and every glyph
 * inherits `currentColor` and the same optical weight.
 */

import type { SVGProps } from 'react'

export type IconName =
  | 'grid'
  | 'calendar'
  | 'board'
  | 'check-square'
  | 'chart'
  | 'users'
  | 'sliders'
  | 'bell'
  | 'plus'
  | 'search'
  | 'filter'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'x'
  | 'pencil'
  | 'trash'
  | 'link'
  | 'clock'
  | 'alert'
  | 'more'
  | 'sparkle'
  | 'trend-up'
  | 'trend-down'
  | 'bulb'
  | 'library'
  | 'notes'
  | 'copy'
  | 'check'
  | 'logout'
  | 'layers'
  | 'key'
  | 'drag'
  | 'eye'
  | 'heart'
  | 'message'
  | 'share'
  | 'bookmark'
  | 'target'
  | 'flag'
  | 'refresh'
  | 'external'
  | 'inbox'
  | 'user-plus'
  | 'workspace'
  | 'send'
  | 'play'
  | 'image'
  | 'block'
  | 'arrow-right'
  | 'arrow-left'
  | 'download'
  | 'menu'
  | 'dot'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  /** Filled variants read as "active" in navigation. */
  filled?: boolean
}

export function Icon({ name, size = 20, filled = false, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name](filled)}
    </svg>
  )
}

const f = (filled: boolean) => (filled ? 'currentColor' : 'none')

const PATHS: Record<IconName, (filled: boolean) => JSX.Element> = {
  grid: (fl) => (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill={f(fl)} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill={f(fl)} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill={f(fl)} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill={f(fl)} />
    </>
  ),
  calendar: (fl) => (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill={fl ? 'currentColor' : 'none'} opacity={fl ? 0.18 : 1} />
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  board: (fl) => (
    <>
      <rect x="3.5" y="4" width="4.5" height="16" rx="1.5" fill={f(fl)} />
      <rect x="9.75" y="4" width="4.5" height="11" rx="1.5" fill={f(fl)} />
      <rect x="16" y="4" width="4.5" height="14" rx="1.5" fill={f(fl)} />
    </>
  ),
  'check-square': (fl) => (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill={fl ? 'currentColor' : 'none'} opacity={fl ? 0.18 : 1} />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.75 2.75L16.5 9.5" />
    </>
  ),
  chart: (fl) => (
    <>
      <path d="M4 20.5V4" />
      <rect x="7" y="12" width="3.5" height="6" rx="1" fill={f(fl)} />
      <rect x="12.75" y="8" width="3.5" height="10" rx="1" fill={f(fl)} />
      <rect x="18.5" y="14" width="2.5" height="4" rx="1" fill={f(fl)} />
      <path d="M4 20.5h17" />
    </>
  ),
  users: (fl) => (
    <>
      <circle cx="9" cy="8" r="3.5" fill={f(fl)} />
      <path d="M2.5 20a6.5 6.5 0 0113 0" fill={f(fl)} />
      <path d="M16 5.2a3.5 3.5 0 010 5.6M18 14.6a6.5 6.5 0 013.5 5.4" />
    </>
  ),
  sliders: () => (
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h10M18 17h2" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  bell: (fl) => (
    <>
      <path d="M6.5 10a5.5 5.5 0 1111 0c0 3.2.8 5 1.7 6H4.8c.9-1 1.7-2.8 1.7-6z" fill={f(fl)} />
      <path d="M10 19.5a2.2 2.2 0 004 0" />
    </>
  ),
  plus: () => <path d="M12 5v14M5 12h14" />,
  search: () => (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  filter: () => <path d="M4 6h16M7 12h10M10 18h4" />,
  'chevron-down': () => <path d="M6 9.5l6 6 6-6" />,
  'chevron-up': () => <path d="M6 14.5l6-6 6 6" />,
  'chevron-left': () => <path d="M14.5 6l-6 6 6 6" />,
  'chevron-right': () => <path d="M9.5 6l6 6-6 6" />,
  x: () => <path d="M6 6l12 12M18 6L6 18" />,
  pencil: () => (
    <>
      <path d="M4 20h4l10.5-10.5a2.5 2.5 0 00-3.5-3.5L4.5 16.5 4 20z" />
      <path d="M14 7l3 3" />
    </>
  ),
  trash: () => (
    <>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ),
  link: () => (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M12.5 7l1.5-1.5a3.5 3.5 0 015 5L17.5 12" />
      <path d="M11.5 17l-1.5 1.5a3.5 3.5 0 01-5-5L6.5 12" />
    </>
  ),
  clock: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (fl) => (
    <>
      <path d="M12 4l8.5 15h-17L12 4z" fill={fl ? 'currentColor' : 'none'} opacity={fl ? 0.18 : 1} />
      <path d="M12 4l8.5 15h-17L12 4z" />
      <path d="M12 9.5v4.5M12 16.8v.2" />
    </>
  ),
  more: () => (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (fl) => (
    <>
      <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8L12 3.5z" fill={f(fl)} />
      <path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill={f(fl)} />
    </>
  ),
  'trend-up': () => (
    <>
      <path d="M4 16.5l5.5-5.5 3.5 3.5L20 8" />
      <path d="M15.5 8H20v4.5" />
    </>
  ),
  'trend-down': () => (
    <>
      <path d="M4 8l5.5 5.5L13 10l7 7" />
      <path d="M15.5 17H20v-4.5" />
    </>
  ),
  bulb: (fl) => (
    <>
      <path d="M9 16.5a6 6 0 116 0v1.5a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 18v-1.5z" fill={f(fl)} />
      <path d="M10 21.5h4" />
    </>
  ),
  library: (fl) => (
    <>
      <rect x="4" y="4" width="5" height="16" rx="1.5" fill={f(fl)} />
      <rect x="10.5" y="4" width="5" height="16" rx="1.5" fill={f(fl)} />
      <path d="M17.5 5.5l3 14.2" />
    </>
  ),
  notes: (fl) => (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" fill={fl ? 'currentColor' : 'none'} opacity={fl ? 0.18 : 1} />
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8 8.5h8M8 12.5h8M8 16.5h4" />
    </>
  ),
  copy: () => (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h.5" />
    </>
  ),
  check: () => <path d="M5 12.5l4.5 4.5L19 7" />,
  logout: () => (
    <>
      <path d="M15 4.5h3.5A1.5 1.5 0 0120 6v12a1.5 1.5 0 01-1.5 1.5H15" />
      <path d="M11 8l-4 4 4 4M7 12h9" />
    </>
  ),
  layers: () => (
    <>
      <path d="M12 3.5l8 4.5-8 4.5-8-4.5 8-4.5z" />
      <path d="M4 12.5l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" />
    </>
  ),
  key: () => (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h8M17 12v3.5M20 12v2.5" />
    </>
  ),
  drag: () => (
    <>
      <circle cx="9" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  eye: () => (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  heart: (fl) => (
    <path
      d="M12 20s-7.5-4.4-7.5-9.2A4.3 4.3 0 0112 8.4a4.3 4.3 0 017.5 2.4C19.5 15.6 12 20 12 20z"
      fill={f(fl)}
    />
  ),
  message: () => <path d="M4 5.5h16v10H12l-5 4v-4H4v-10z" />,
  share: () => (
    <>
      <path d="M4 12v7.5h16V12" />
      <path d="M12 15.5V4M8 7.5L12 4l4 3.5" />
    </>
  ),
  bookmark: (fl) => <path d="M6.5 4h11v16.5L12 16l-5.5 4.5V4z" fill={f(fl)} />,
  target: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  flag: () => (
    <>
      <path d="M6 21V4h10l-1.5 4L16 12H6" />
      <path d="M6 4v17" />
    </>
  ),
  refresh: () => (
    <>
      <path d="M20 12a8 8 0 11-2.5-5.8" />
      <path d="M20 4v4h-4" />
    </>
  ),
  external: () => (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5L11 13" />
      <path d="M18 14v4.5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />
    </>
  ),
  inbox: () => (
    <>
      <path d="M3.5 13.5L6 5h12l2.5 8.5v5a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5v-5z" />
      <path d="M3.5 13.5h5l1 2.5h5l1-2.5h5" />
    </>
  ),
  'user-plus': () => (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0113 0" />
      <path d="M18 7v6M15 10h6" />
    </>
  ),
  workspace: (fl) => (
    <>
      <rect x="3.5" y="7" width="17" height="13.5" rx="2.5" fill={fl ? 'currentColor' : 'none'} opacity={fl ? 0.18 : 1} />
      <rect x="3.5" y="7" width="17" height="13.5" rx="2.5" />
      <path d="M9 7V5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5v2M3.5 12.5h17" />
    </>
  ),
  send: () => (
    <>
      <path d="M20.5 3.5L10 14" />
      <path d="M20.5 3.5l-6.5 17-4-7.5-7.5-4 18-5.5z" />
    </>
  ),
  play: (fl) => <path d="M8 5.5l11 6.5-11 6.5V5.5z" fill={f(fl)} />,
  image: () => (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-2.5 5 4" />
    </>
  ),
  block: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.5l11 11" />
    </>
  ),
  'arrow-right': () => <path d="M4 12h15M13.5 6.5L20 12l-6.5 5.5" />,
  'arrow-left': () => <path d="M20 12H5M10.5 6.5L4 12l6.5 5.5" />,
  download: () => (
    <>
      <path d="M12 3.5v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 18.5h16" />
    </>
  ),
  menu: () => <path d="M4 7h16M4 12h16M4 17h16" />,
  dot: () => <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
}
