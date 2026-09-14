/**
 * Command palette (⌘K / Ctrl-K).
 *
 * In a tool with eleven sections and hundreds of records, typing a code like
 * CN-0012 is the fastest possible navigation. Searches pages, content, tasks,
 * ideas and people in one list.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cx } from '@/components/ui/primitives'
import { useStore } from '@/state/store'
import { NAV } from './nav'
import { fmtDate } from '@/lib/date'

interface Result {
  id: string
  icon: IconName
  title: string
  meta: string
  to: string
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase()
    const pages: Result[] = NAV.map((n) => ({
      id: `page:${n.to}`,
      icon: n.icon,
      title: n.label,
      meta: 'Page',
      to: n.to,
    }))
    if (!data) return term ? pages.filter((p) => p.title.toLowerCase().includes(term)) : pages

    const content: Result[] = data.content.map((c) => ({
      id: `c:${c.id}`,
      icon: 'layers',
      title: `${c.code} · ${c.title || 'Untitled'}`,
      meta: [c.contentType, c.platform, c.plannedPublishDate ? fmtDate(c.plannedPublishDate) : null]
        .filter(Boolean)
        .join(' · '),
      to: `/content/${c.id}`,
    }))
    const tasks: Result[] = data.tasks.map((t) => ({
      id: `t:${t.id}`,
      icon: 'check-square',
      title: `${t.code} · ${t.title || 'Untitled task'}`,
      meta: [t.taskType, t.deadline ? `due ${fmtDate(t.deadline)}` : null].filter(Boolean).join(' · '),
      to: '/tasks',
    }))
    const ideas: Result[] = data.ideas.map((i) => ({
      id: `i:${i.id}`,
      icon: 'bulb',
      title: `${i.code} · ${i.topic || 'Untitled idea'}`,
      meta: [i.contentType, i.status].filter(Boolean).join(' · '),
      to: '/ideas',
    }))
    const people: Result[] = data.members.map((m) => ({
      id: `m:${m.id}`,
      icon: 'users',
      title: m.name,
      meta: `${m.role}${m.active ? '' : ' · inactive'}`,
      to: '/team',
    }))

    const pool = [...pages, ...content, ...tasks, ...ideas, ...people]
    if (!term) return pool.slice(0, 8)
    return pool
      .filter((r) => `${r.title} ${r.meta}`.toLowerCase().includes(term))
      .slice(0, 30)
  }, [q, data])

  useEffect(() => setCursor(0), [q])

  if (!open) return null

  const go = (r?: Result) => {
    if (!r) return
    navigate(r.to)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 animate-fade-in bg-void/70 backdrop-blur-[3px]" />
      <div className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-lg border border-white/10 bg-overlay/95 shadow-float backdrop-blur-[16px]">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4">
          <Icon name="search" size={17} className="shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                go(results[cursor])
              }
            }}
            placeholder="Search content, tasks, ideas, people…"
            className="h-12 w-full bg-transparent text-body-md text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line/60 px-1.5 py-0.5 font-mono text-label-micro text-ink-faint sm:block">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-body-sm text-ink-faint">Nothing matches “{q}”</li>
          )}
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r)}
                className={cx(
                  'flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-colors',
                  i === cursor ? 'bg-raised' : 'hover:bg-raised/60',
                )}
              >
                <Icon name={r.icon} size={16} className="shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm text-ink">{r.title}</span>
                  {r.meta && <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">{r.meta}</span>}
                </span>
                {i === cursor && <Icon name="arrow-right" size={15} className="shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

/** Registers the ⌘K / Ctrl-K shortcut. */
export function usePaletteShortcut(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])
}
