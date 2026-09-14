import type { IconName } from '@/components/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Short label for the mobile bottom bar. */
  short?: string
  group: 'work' | 'insight' | 'admin'
  /** Hidden from people who cannot manage the workspace. */
  manageOnly?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'grid', short: 'Home', group: 'work' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar', short: 'Calendar', group: 'work' },
  { to: '/pipeline', label: 'Pipeline', icon: 'board', short: 'Pipeline', group: 'work' },
  { to: '/content', label: 'Content plan', icon: 'layers', short: 'Content', group: 'work' },
  { to: '/tasks', label: 'Tasks', icon: 'check-square', short: 'Tasks', group: 'work' },
  { to: '/ideas', label: 'Idea bank', icon: 'bulb', short: 'Ideas', group: 'work' },
  { to: '/publishing', label: 'Publishing', icon: 'send', group: 'insight' },
  { to: '/library', label: 'Library', icon: 'library', group: 'insight' },
  { to: '/team', label: 'Team', icon: 'users', group: 'insight' },
  { to: '/review', label: 'Weekly review', icon: 'notes', group: 'insight' },
  { to: '/settings', label: 'Settings', icon: 'sliders', group: 'admin' },
]

/** The five slots in the mobile bottom bar; everything else lives under "More". */
export const BOTTOM_NAV = ['/', '/calendar', '/pipeline', '/tasks'] as const

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  work: 'Production',
  insight: 'Insight',
  admin: 'Workspace',
}
