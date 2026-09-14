/**
 * App shell.
 *
 * Mobile-first, as specified: a glass top bar, a 4-slot bottom navigation bar
 * with a "More" sheet for the remaining sections, and a floating action button.
 * From `lg` up it becomes the desktop layout from the design system — a fixed
 * 280px rail plus a sticky header — because the dense tables and the month
 * calendar need that width.
 */

import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Avatar, Button, IconButton, Spinner, StatusDot, cx } from '@/components/ui/primitives'
import { Sheet } from '@/components/ui/Overlay'
import { useStore } from '@/state/store'
import { APP_NAME, APP_TAGLINE } from '@/brand'
import { BOTTOM_NAV, GROUP_LABEL, NAV, type NavItem } from './nav'
import { CommandPalette, usePaletteShortcut } from './CommandPalette'
import { NotificationPanel, useAlerts } from './NotificationPanel'
import { fmtMonth } from '@/lib/date'

export function AppShell() {
  const { data, me, user, signOut, memberships, openWorkspace, canEdit, month } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  usePaletteShortcut(setPaletteOpen)
  const { visible: alerts } = useAlerts()

  // Close transient surfaces on navigation.
  useEffect(() => {
    setMoreOpen(false)
    setNotifOpen(false)
    setSwitcherOpen(false)
  }, [location.pathname])

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-ink-faint">
        <Spinner size={22} />
      </div>
    )
  }

  const bottomItems = BOTTOM_NAV.map((to) => NAV.find((n) => n.to === to)!).filter(Boolean)
  const moreItems = NAV.filter((n) => !BOTTOM_NAV.includes(n.to as (typeof BOTTOM_NAV)[number]))
  // Longest matching prefix, so /content/abc still reads as "Content plan".
  const current = [...NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))

  return (
    <div className="flex h-full">
      {/* ---------------- Desktop rail ---------------- */}
      <aside className="hidden w-sidebar shrink-0 flex-col border-r border-line/50 bg-panel/60 lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark />
          <div className="min-w-0">
            <div className="truncate font-display text-headline-sm tracking-tight text-ink">{APP_NAME}</div>
            <div className="truncate font-mono text-label-micro uppercase text-ink-faint">{APP_TAGLINE}</div>
          </div>
        </div>

        <WorkspaceButton onClick={() => setSwitcherOpen(true)} />

        <nav className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {(['work', 'insight', 'admin'] as const).map((group) => (
            <div key={group} className="mb-4">
              <div className="px-2 pb-1.5 pt-2 label-caps">{GROUP_LABEL[group]}</div>
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => (
                  <li key={item.to}>
                    <RailLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line/50 p-3">
          <button
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-2.5 rounded p-2 text-left transition-colors hover:bg-raised/60"
          >
            <Avatar name={me?.name ?? user?.name ?? '?'} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm text-ink">{me?.name ?? user?.name}</span>
              <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                {me?.role ?? 'Viewer'}
              </span>
            </span>
          </button>
          <Button variant="quiet" size="sm" icon="logout" block className="mt-1 justify-start" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar safe-top sticky top-0 z-30 border-b">
          <div className="flex h-14 items-center gap-2 px-4 lg:h-16 lg:px-8">
            {/* Mobile: brand + workspace. Desktop: page title. */}
            <button onClick={() => setSwitcherOpen(true)} className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <BrandMark size={30} />
              <span className="min-w-0 text-left">
                <span className="block truncate font-display text-body-md font-semibold leading-tight text-ink">
                  {data.workspace.name}
                </span>
                <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                  {current?.label ?? APP_NAME}
                </span>
              </span>
              <Icon name="chevron-down" size={14} className="shrink-0 text-ink-faint" />
            </button>

            <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
              <h1 className="truncate text-headline-sm text-ink">{current?.label ?? APP_NAME}</h1>
              <span className="rounded-full bg-sunken px-2 py-0.5 font-mono text-label-micro uppercase text-ink-faint">
                {fmtMonth(month)}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded border border-line/60 bg-sunken px-3 py-1.5 text-body-xs text-ink-faint transition-colors hover:border-line hover:text-ink-dim lg:flex"
              >
                <Icon name="search" size={15} />
                Search
                <kbd className="ml-2 rounded border border-line/60 px-1 font-mono text-label-micro">⌘K</kbd>
              </button>
              <IconButton icon="search" label="Search" onClick={() => setPaletteOpen(true)} className="lg:hidden" />

              <div className="relative">
                <IconButton icon="bell" label="Notifications" onClick={() => setNotifOpen(true)} />
                {alerts.length > 0 && (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-semibold text-void">
                    {alerts.length > 9 ? '9+' : alerts.length}
                  </span>
                )}
              </div>

              <span className="hidden lg:block">
                {canEdit && (
                  <Button variant="primary" size="sm" icon="plus" onClick={() => navigate('/content?new=1')}>
                    New content
                  </Button>
                )}
              </span>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-6">
            <Outlet />
          </div>
        </main>

        {/* ---------------- Mobile bottom bar ---------------- */}
        <nav className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-30 border-t lg:hidden">
          <div className="relative flex items-stretch justify-around px-1 pb-1 pt-1.5">
            {bottomItems.map((item) => (
              <BottomLink key={item.to} item={item} />
            ))}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-ink-faint transition-colors hover:text-ink-dim"
            >
              <Icon name="menu" size={20} />
              <span className="font-mono text-label-micro uppercase">More</span>
            </button>
          </div>
        </nav>

        {canEdit && (
          <button
            onClick={() => navigate('/content?new=1')}
            aria-label="New content"
            className="fixed bottom-[5.5rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-lg bg-accent text-white shadow-float shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-transform active:scale-95 lg:hidden"
          >
            <Icon name="plus" size={24} />
          </button>
        )}
      </div>

      {/* ---------------- Overlays ---------------- */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections">
        <ul className="grid grid-cols-2 gap-2">
          {moreItems.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-md border border-line/50 bg-panel p-3 transition-colors active:bg-raised"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sunken text-primary">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="min-w-0 truncate text-body-sm text-ink">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-md border border-line/50 bg-panel p-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={me?.name ?? user?.name ?? '?'} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-body-sm text-ink">{me?.name ?? user?.name}</span>
              <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">{me?.role}</span>
            </span>
          </span>
          <Button variant="quiet" size="sm" icon="logout" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Workspaces"
        subtitle="Switch team, or start a new one"
        size="sm"
      >
        <ul className="space-y-1.5">
          {memberships.map((m) => {
            const active = m.workspaceId === data.workspace.id
            return (
              <li key={m.workspaceId}>
                <button
                  onClick={() => {
                    setSwitcherOpen(false)
                    if (!active) void openWorkspace(m.workspaceId)
                  }}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors',
                    active ? 'border-accent/50 bg-accent/10' : 'border-line/50 bg-panel hover:bg-raised/60',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sunken font-mono text-body-xs text-primary">
                    {m.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm text-ink">{m.workspaceName}</span>
                    <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">{m.access}</span>
                  </span>
                  {active && <StatusDot tone="primary" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 grid gap-2">
          <Button icon="plus" onClick={() => navigate('/welcome?mode=create')}>
            Create a workspace
          </Button>
          <Button variant="quiet" icon="key" onClick={() => navigate('/welcome?mode=join')}>
            Join with a code
          </Button>
        </div>
      </Sheet>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-accent/15 text-primary"
      style={{ width: size, height: size, boxShadow: 'inset 0 0 0 1px rgb(var(--accent) / 0.35)' }}
      aria-hidden="true"
    >
      <Icon name="sparkle" size={Math.round(size * 0.55)} filled />
    </span>
  )
}

function WorkspaceButton({ onClick }: { onClick: () => void }) {
  const { data, memberships } = useStore()
  if (!data) return null
  return (
    <button
      onClick={onClick}
      className="mx-3 flex items-center gap-2.5 rounded-md border border-line/50 bg-sunken/70 p-2.5 text-left transition-colors hover:border-line"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/15 font-mono text-body-xs text-primary">
        {data.workspace.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm text-ink">{data.workspace.name}</span>
        <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
          {data.members.filter((m) => m.active).length} people
        </span>
      </span>
      <Icon name="chevron-down" size={15} className="shrink-0 text-ink-faint" />
      {memberships.length > 1 && <span className="sr-only">Switch workspace</span>}
    </button>
  )
}

function RailLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cx(
          'group flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm transition-colors duration-150',
          isActive ? 'bg-accent/15 text-primary' : 'text-ink-dim hover:bg-raised/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* 2px electric-blue marker on the active row. */}
          <span
            className={cx('h-5 w-0.5 shrink-0 rounded-full transition-colors', isActive ? 'bg-accent' : 'bg-transparent')}
          />
          <Icon name={item.icon} size={18} filled={isActive} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cx(
          'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors',
          isActive ? 'text-primary' : 'text-ink-faint hover:text-ink-dim',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cx(
              'flex h-7 w-12 items-center justify-center rounded-md transition-colors',
              isActive && 'bg-accent/15',
            )}
          >
            <Icon name={item.icon} size={20} filled={isActive} />
          </span>
          <span className="truncate font-mono text-label-micro uppercase">{item.short ?? item.label}</span>
        </>
      )}
    </NavLink>
  )
}
