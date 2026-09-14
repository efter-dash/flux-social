/**
 * Notification centre.
 *
 * Alerts are derived on every render from the workspace data — nothing is stored
 * — so they can never go stale. Dismissals live in localStorage per browser,
 * which is the right scope for "I have seen this".
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Button, StatusDot, Tabs, cx, EmptyState } from '@/components/ui/primitives'
import { Sheet } from '@/components/ui/Overlay'
import { useStore } from '@/state/store'
import { buildAlerts, type Alert, type AlertKind } from '@/lib/metrics'
import type { Tone } from '@/lib/derive'

const KIND_ICON: Record<AlertKind, IconName> = {
  overdue: 'clock',
  blocked: 'block',
  stuck: 'alert',
  due_soon: 'calendar',
  task_overdue: 'check-square',
  missing_metrics: 'chart',
  idea_ready: 'bulb',
}

const SEVERITY_TONE: Record<Alert['severity'], Tone> = {
  high: 'danger',
  medium: 'amber',
  low: 'neutral',
}

export function useAlerts() {
  const { data, dismissedAlerts, me } = useStore()
  return useMemo(() => {
    if (!data) return { all: [] as Alert[], visible: [] as Alert[], mine: [] as Alert[] }
    const all = buildAlerts(data)
    const visible = all.filter((a) => !dismissedAlerts.has(a.id))
    const mine = visible.filter((a) => a.memberId && a.memberId === me?.id)
    return { all, visible, mine }
  }, [data, dismissedAlerts, me?.id])
}

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dismissAlert, restoreAlerts, dismissedAlerts } = useStore()
  const { visible, mine } = useAlerts()
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const list = tab === 'mine' ? mine : visible

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={`${visible.length} open · derived live from your workspace`}
      footer={
        dismissedAlerts.size > 0 ? (
          <Button variant="quiet" size="sm" icon="refresh" onClick={restoreAlerts}>
            Restore {dismissedAlerts.size} dismissed
          </Button>
        ) : undefined
      }
    >
      <Tabs
        tabs={[
          { id: 'all', label: 'Everything', count: visible.length },
          { id: 'mine', label: 'Assigned to me', count: mine.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {list.length === 0 ? (
        <EmptyState
          icon="check"
          title={tab === 'mine' ? 'Nothing needs you right now' : 'All clear'}
          blurb="Overdue work, blockers, stalled stages and upcoming deadlines will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li
              key={a.id}
              className="group flex items-start gap-3 rounded-md border border-line/50 bg-panel/70 p-3 transition-colors hover:border-line"
            >
              <span
                className={cx(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  a.severity === 'high' ? 'bg-danger/15 text-danger' : a.severity === 'medium' ? 'bg-amber/15 text-amber' : 'bg-ink-faint/15 text-ink-faint',
                )}
              >
                <Icon name={KIND_ICON[a.kind]} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <Link to={a.href} onClick={onClose} className="block text-body-sm text-ink hover:text-primary">
                  {a.title}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-body-xs text-ink-dim">
                  <StatusDot tone={SEVERITY_TONE[a.severity]} size={5} />
                  <span className="truncate">{a.detail}</span>
                </p>
              </div>
              <button
                onClick={() => dismissAlert(a.id)}
                aria-label="Dismiss"
                title="Dismiss"
                className="shrink-0 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-raised hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
