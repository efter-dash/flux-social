/**
 * Task row and the task edit sheet.
 *
 * The checkbox is the whole point: most updates in a production tracker are
 * "I finished this", and that should be one tap from any list.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import {
  Avatar,
  Button,
  Field,
  Input,
  OptionSelect,
  Select,
  StatusChip,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Menu, Sheet, useConfirm } from '@/components/ui/Overlay'
import { useStore } from '@/state/store'
import type { TaskItem } from '@/lib/types'
import { TASK_STATUSES } from '@/lib/types'
import { isTaskOverdue, memberName, taskTone } from '@/lib/derive'
import { fmtDate, today } from '@/lib/date'

export function TaskRow({ task, compact = false }: { task: TaskItem; compact?: boolean }) {
  const { data, canEdit, toggleTask, deleteTask } = useStore()
  const [editing, setEditing] = useState(false)
  const confirm = useConfirm()
  if (!data) return null

  const done = task.status === 'completed'
  const overdue = isTaskOverdue(task)
  const linked = data.content.find((c) => c.id === task.contentId)
  const tone = taskTone(task)
  const statusLabel = TASK_STATUSES.find((s) => s.id === task.status)?.label ?? task.status

  return (
    <>
      <li className={cx('group flex items-start gap-3 px-2 py-2.5', overdue && 'bg-danger/[0.05]')}>
        <button
          onClick={() => canEdit && void toggleTask(task.id)}
          disabled={!canEdit}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150',
            done
              ? 'border-emerald bg-emerald text-void'
              : 'border-line bg-sunken text-transparent hover:border-emerald/60 hover:text-emerald/40',
            !canEdit && 'cursor-not-allowed opacity-60',
          )}
        >
          <Icon name="check" size={13} />
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={() => setEditing(true)}
            className="block w-full text-left"
          >
            <span className={cx('block text-body-sm', done ? 'text-ink-faint line-through' : 'text-ink')}>
              {task.title || 'Untitled task'}
            </span>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-label-micro uppercase text-ink-faint">{task.code}</span>
            {task.taskType && (
              <span className="font-mono text-label-micro uppercase text-ink-faint">{task.taskType}</span>
            )}
            <span
              className={cx(
                'inline-flex items-center gap-1 font-mono text-label-micro uppercase',
                overdue ? 'text-danger' : 'text-ink-faint',
              )}
            >
              <Icon name={overdue ? 'alert' : 'clock'} size={11} />
              {task.deadline ? fmtDate(task.deadline) : 'no deadline'}
            </span>
            {linked && !compact && (
              <Link
                to={`/content/${linked.id}`}
                className="inline-flex items-center gap-1 font-mono text-label-micro uppercase text-primary hover:underline"
              >
                <Icon name="link" size={11} />
                {linked.code}
              </Link>
            )}
            {task.outputLink && (
              <a
                href={task.outputLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-mono text-label-micro uppercase text-primary hover:underline"
              >
                <Icon name="external" size={11} />
                output
              </a>
            )}
          </div>

          {task.remarks && <p className="mt-1 truncate text-body-xs text-ink-dim">{task.remarks}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!compact && (
            <span className="hidden items-center gap-1.5 sm:flex">
              <Avatar name={memberName(data.members, task.memberId)} size={22} />
            </span>
          )}
          <StatusChip tone={tone} className="hidden sm:inline-flex">
            {statusLabel}
          </StatusChip>
          {canEdit && (
            <Menu
              items={[
                { label: 'Edit task', icon: 'pencil', onSelect: () => setEditing(true) },
                {
                  label: done ? 'Reopen' : 'Mark done',
                  icon: done ? 'refresh' : 'check',
                  onSelect: () => void toggleTask(task.id),
                },
                {
                  label: 'Delete',
                  icon: 'trash',
                  danger: true,
                  onSelect: () =>
                    confirm.ask({
                      title: `Delete ${task.code}?`,
                      body: 'The task is removed permanently.',
                      confirmLabel: 'Delete',
                      danger: true,
                      onConfirm: () => void deleteTask(task.id),
                    }),
                },
              ]}
            />
          )}
        </div>
      </li>

      {editing && <TaskSheet open onClose={() => setEditing(false)} task={task} />}
      {confirm.element}
    </>
  )
}

export function TaskSheet({ open, onClose, task }: { open: boolean; onClose: () => void; task: TaskItem }) {
  const { data, canEdit, updateTask } = useStore()
  const [draft, setDraft] = useState<TaskItem>(task)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(task), [task.id, open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return null

  const { workspace, members, content } = data
  const set = <K extends keyof TaskItem>(k: K, v: TaskItem[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const linkedItem = content.find((c) => c.id === draft.contentId)

  const save = async () => {
    setSaving(true)
    try {
      // Completion date should follow the status rather than be remembered separately.
      const completionDate =
        draft.status === 'completed' ? draft.completionDate || today() : draft.status === 'cancelled' ? draft.completionDate : ''
      await updateTask(task.id, { ...draft, completionDate })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={draft.title || 'Task'}
      subtitle={draft.code}
      footer={
        canEdit ? (
          <>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <fieldset disabled={!canEdit} className="space-y-3">
        <Field label="Task">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs doing?" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Assigned to">
            <Select value={draft.memberId} onChange={(e) => set('memberId', e.target.value)} placeholder="Unassigned">
              {members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Task type">
            <OptionSelect
              value={draft.taskType}
              onChange={(v) => set('taskType', v)}
              options={workspace.taxonomies.taskTypes}
              placeholder="—"
            />
          </Field>
          <Field label="Logged for" hint="the working day">
            <Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Deadline">
            <Input type="date" value={draft.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set('status', e.target.value as TaskItem['status'])}>
              {TASK_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <OptionSelect
              value={draft.priority}
              onChange={(v) => set('priority', v)}
              options={workspace.taxonomies.priorities}
            />
          </Field>
        </div>

        <Field label="Linked content" hint="ties the task to a pipeline stage">
          <Select
            value={draft.contentId}
            onChange={(e) => set('contentId', e.target.value)}
            placeholder="Not linked"
          >
            {content
              .filter((c) => c.lifecycle !== 'cancelled')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title || 'Untitled'}
                </option>
              ))}
          </Select>
        </Field>

        {linkedItem && (
          <Field label="Pipeline stage" hint="completing the task can advance this stage">
            <Select value={draft.stageId} onChange={(e) => set('stageId', e.target.value)} placeholder="No stage">
              {workspace.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Output link">
          <Input value={draft.outputLink} onChange={(e) => set('outputLink', e.target.value)} placeholder="https://" />
        </Field>

        <Field label="Remarks" hint="blockers, context, handover notes">
          <Textarea value={draft.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3} />
        </Field>

        {draft.status === 'completed' && (
          <Field label="Completion date">
            <Input
              type="date"
              value={draft.completionDate || today()}
              onChange={(e) => set('completionDate', e.target.value)}
            />
          </Field>
        )}
      </fieldset>
    </Sheet>
  )
}
