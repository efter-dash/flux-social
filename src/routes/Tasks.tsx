/**
 * Task tracker.
 *
 * Replaces "03 Daily Task Tracker". Defaults to the signed-in person's own work,
 * because that is what a team member opens the app for; leads switch to the whole
 * team with one tap. Overdue is derived from deadline vs status, never typed in.
 */

import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  OptionSelect,
  ProgressBar,
  SectionTitle,
  Select,
  Tabs,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { TaskRow, TaskSheet } from '@/components/tasks/TaskRow'
import { useStore } from '@/state/store'
import type { TaskItem } from '@/lib/types'
import { isTaskOpen, isTaskOverdue, fmtPercent } from '@/lib/derive'
import { addDays, fmtDate, monthKey, today } from '@/lib/date'

type Bucket = 'today' | 'week' | 'overdue' | 'done' | 'all'

export function TasksPage() {
  const { data, me, canEdit, createTask, month } = useStore()
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const [bucket, setBucket] = useState<Bucket>('today')
  const [q, setQ] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<TaskItem | null>(null)

  if (!data) return null
  const { workspace, members, tasks, content } = data
  const now = today()
  const weekEnd = addDays(now, 7)

  const scoped = useMemo(() => {
    let list = tasks
    if (scope === 'mine' && me) list = list.filter((t) => t.memberId === me.id)
    if (memberFilter) list = list.filter((t) => t.memberId === memberFilter)
    if (typeFilter) list = list.filter((t) => t.taskType === typeFilter)
    const term = q.trim().toLowerCase()
    if (term) {
      list = list.filter((t) => {
        const linked = content.find((c) => c.id === t.contentId)
        return `${t.code} ${t.title} ${t.remarks} ${t.taskType} ${linked?.code ?? ''} ${linked?.title ?? ''}`
          .toLowerCase()
          .includes(term)
      })
    }
    return list
  }, [tasks, scope, me, memberFilter, typeFilter, q, content])

  const buckets = useMemo(() => {
    const open = scoped.filter(isTaskOpen)
    return {
      overdue: open.filter((t) => isTaskOverdue(t, now)),
      today: open.filter((t) => (t.deadline || t.date) === now || isTaskOverdue(t, now)),
      week: open.filter((t) => t.deadline > now && t.deadline <= weekEnd),
      done: scoped.filter((t) => t.status === 'completed'),
      all: scoped,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, now, weekEnd])

  const list = useMemo(() => {
    const l = [...buckets[bucket]]
    return l.sort((a, b) => {
      // Overdue first, then by deadline, then by code.
      const oa = isTaskOverdue(a, now) ? 0 : 1
      const ob = isTaskOverdue(b, now) ? 0 : 1
      if (oa !== ob) return oa - ob
      return (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.code.localeCompare(b.code)
    })
  }, [buckets, bucket, now])

  // Monthly completion summary for whoever is in scope.
  const monthStats = useMemo(() => {
    const inMonth = scoped.filter((t) => monthKey(t.date) === month || monthKey(t.deadline) === month)
    const done = inMonth.filter((t) => t.status === 'completed').length
    return { total: inMonth.length, done, rate: inMonth.length ? done / inMonth.length : null }
  }, [scoped, month])

  const addTask = async () => {
    const task = await createTask({ memberId: memberFilter || me?.id || '' })
    setEditing(task)
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Tasks"
        blurb="Everyone logs and updates their own work here."
        action={
          canEdit ? (
            <Button variant="primary" icon="plus" onClick={() => void addTask()}>
              <span className="hidden sm:inline">New task</span>
            </Button>
          ) : undefined
        }
      />

      {/* -------- Scope + progress -------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-widget">
          <div className="inline-flex rounded border border-line/60 bg-sunken p-0.5">
            {([
              { id: 'mine', label: me ? 'My tasks' : 'Mine' },
              { id: 'team', label: 'Whole team' },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={cx(
                  'rounded-[0.35rem] px-3 py-1.5 text-body-xs font-medium transition-colors',
                  scope === s.id ? 'bg-raised text-ink' : 'text-ink-faint hover:text-ink-dim',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="min-w-[10rem] flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="label-caps">This month</span>
              <span className="numeral font-mono text-label-caps text-ink">
                {monthStats.done}/{monthStats.total} · {fmtPercent(monthStats.rate, 0)}
              </span>
            </div>
            <ProgressBar pct={(monthStats.rate ?? 0) * 100} tone={monthStats.rate === 1 ? 'emerald' : 'primary'} />
          </div>

          {buckets.overdue.length > 0 && (
            <button
              onClick={() => setBucket('overdue')}
              className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1 font-mono text-label-caps uppercase text-danger transition-colors hover:bg-danger/25"
            >
              <Icon name="alert" size={13} />
              {buckets.overdue.length} overdue
            </button>
          )}
        </div>
      </Card>

      {/* -------- Filters -------- */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <span className="relative min-w-0 flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" />
        </span>
        {scope === 'team' && (
          <Select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder="Anyone"
            className="sm:w-44"
          >
            {members
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        )}
        <OptionSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={workspace.taxonomies.taskTypes}
          placeholder="Any type"
          className="sm:w-44"
        />
      </div>

      <Tabs
        tabs={[
          { id: 'today', label: 'Today', count: buckets.today.length },
          { id: 'week', label: 'Next 7 days', count: buckets.week.length },
          { id: 'overdue', label: 'Overdue', count: buckets.overdue.length },
          { id: 'done', label: 'Completed', count: buckets.done.length },
          { id: 'all', label: 'All', count: buckets.all.length },
        ]}
        value={bucket}
        onChange={setBucket}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={bucket === 'overdue' ? 'check' : 'check-square'}
          title={
            bucket === 'overdue'
              ? 'Nothing overdue'
              : bucket === 'today'
                ? 'Nothing due today'
                : bucket === 'done'
                  ? 'Nothing completed yet'
                  : 'No tasks here'
          }
          blurb={
            scope === 'mine' && !me
              ? 'You are viewing this workspace without a team profile.'
              : 'Tasks are usually created from a content item, so the pipeline stage stays linked.'
          }
          action={
            canEdit ? (
              <Button size="sm" icon="plus" onClick={() => void addTask()}>
                New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            label={scope === 'mine' ? 'Your tasks' : 'Team tasks'}
            title={`${list.length} task${list.length === 1 ? '' : 's'}`}
          />
          <ul className="divide-hair px-2.5 pb-3 pt-2">
            {list.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </Card>
      )}

      {/* -------- Per-person load, only useful for leads -------- */}
      {scope === 'team' && (
        <Card>
          <CardHeader label="Load" title="Open tasks per person" />
          <div className="space-y-2 p-widget">
            {members
              .filter((m) => m.active)
              .map((m) => {
                const mineTasks = tasks.filter((t) => t.memberId === m.id)
                const open = mineTasks.filter(isTaskOpen).length
                const late = mineTasks.filter((t) => isTaskOverdue(t, now)).length
                const max = Math.max(
                  1,
                  ...members.map((x) => tasks.filter((t) => t.memberId === x.id && isTaskOpen(t)).length),
                )
                return (
                  <button
                    key={m.id}
                    onClick={() => setMemberFilter(m.id)}
                    className="flex w-full items-center gap-3 rounded px-1 py-1.5 text-left transition-colors hover:bg-raised/50"
                  >
                    <Avatar name={m.name} size={24} />
                    <span className="w-28 shrink-0 truncate text-body-xs text-ink-dim">{m.name}</span>
                    <span className="min-w-0 flex-1">
                      <ProgressBar pct={(open / max) * 100} tone={late ? 'danger' : 'primary'} height={6} />
                    </span>
                    <span className="numeral w-24 shrink-0 text-right font-mono text-label-micro uppercase text-ink-faint">
                      {open} open{late ? ` · ${late} late` : ''}
                    </span>
                  </button>
                )
              })}
          </div>
        </Card>
      )}

      {/* -------- Today's date footer, so "today" is never ambiguous -------- */}
      <p className="text-center font-mono text-label-micro uppercase text-ink-faint">today is {fmtDate(now)}</p>

      {editing && <TaskSheet open onClose={() => setEditing(null)} task={editing} />}
    </div>
  )
}
