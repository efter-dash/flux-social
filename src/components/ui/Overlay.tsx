/**
 * Overlays: sheet/modal, confirm dialog, dropdown menu and the toast host.
 *
 * One component covers both form factors — on phones it is a bottom sheet that
 * slides up, on desktop a centred modal — because the content inside is
 * identical and maintaining two is how they drift apart.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton, cx } from './primitives'
import { Icon, type IconName } from './Icon'
import { useStore } from '@/state/store'

// ---------------------------------------------------------------------------
// Sheet / modal
// ---------------------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useLockBodyScroll(open)
  useEscape(open, onClose)
  const panelRef = useRef<HTMLDivElement>(null)

  // Move focus into the panel so keyboard users are not stranded behind it.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-close]), [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Close"
        data-close
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-void/70 backdrop-blur-[3px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-white/10 bg-overlay/95 shadow-float backdrop-blur-[16px]',
          'animate-sheet-in rounded-t-xl sm:animate-scale-in sm:rounded-lg',
          width,
        )}
      >
        {/* Grab handle reads as "draggable sheet" on touch devices. */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-headline-sm text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-body-xs text-ink-faint">{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} data-close />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="safe-bottom flex items-center justify-end gap-2 border-t border-white/10 bg-panel/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: ReactNode
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body-sm text-ink-dim">{body}</div>
    </Sheet>
  )
}

/** Hook form of the confirm dialog, for list rows with destructive actions. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    body: ReactNode
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => void
  }>({ open: false, title: '', body: null, onConfirm: () => {} })

  const ask = useCallback(
    (opts: { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void }) => {
      setState({ ...opts, open: true })
    },
    [],
  )

  const element = (
    <ConfirmDialog
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      onConfirm={state.onConfirm}
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
    />
  )

  return { ask, element }
}

// ---------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export function Menu({
  items,
  label = 'More actions',
  icon = 'more',
  align = 'right',
}: {
  items: MenuItem[]
  label?: string
  icon?: IconName
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <IconButton icon={icon} label={label} size="sm" onClick={() => setOpen((o) => !o)} active={open} />
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-40 mt-1 min-w-[11rem] animate-scale-in overflow-hidden rounded-md border border-white/10 bg-overlay/95 p-1 shadow-float backdrop-blur-[16px]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cx(
                'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-body-sm transition-colors disabled:opacity-40',
                item.danger ? 'text-danger hover:bg-danger/15' : 'text-ink-dim hover:bg-raised hover:text-ink',
              )}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export function ToastHost() {
  const { toasts, dismissToast } = useStore()
  if (!toasts.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md border px-3.5 py-2.5 shadow-float backdrop-blur-[16px] animate-slide-up',
            t.tone === 'success'
              ? 'border-emerald/30 bg-emerald/10'
              : t.tone === 'danger'
                ? 'border-danger/30 bg-danger/10'
                : 'border-white/10 bg-overlay/95',
          )}
        >
          <Icon
            name={t.tone === 'success' ? 'check' : t.tone === 'danger' ? 'alert' : 'sparkle'}
            size={16}
            className={
              t.tone === 'success' ? 'shrink-0 text-emerald' : t.tone === 'danger' ? 'shrink-0 text-danger' : 'shrink-0 text-primary'
            }
          />
          <span className="min-w-0 flex-1 text-body-sm text-ink">{t.message}</span>
          {t.action && (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                t.action?.run()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </Button>
          )}
          <IconButton icon="x" label="Dismiss" size="sm" onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useLockBodyScroll(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

function useEscape(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fn()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, fn])
}
