/**
 * Team directory and performance.
 *
 * Merges "06 Team Performance" and "08 Team Directory". The per-stage output
 * columns are generated from the workspace pipeline, so a design team sees
 * "Design completed" where a video team sees "Editing completed" — the
 * spreadsheet could only ever say "Videos Edited".
 *
 * The leaderboard is kept, with the spreadsheet's own caveat: it exists for
 * workload visibility, not for ranking people against each other.
 */

import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  OptionSelect,
  ProgressBar,
  SectionTitle,
  Select,
  StatusChip,
  Textarea,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { Menu, Sheet, useConfirm } from '@/components/ui/Overlay'
import { MonthNav } from '@/components/ui/MonthNav'
import { useStore } from '@/state/store'
import type { AccessLevel, Member } from '@/lib/types'
import { ACCESS_LEVELS } from '@/lib/types'
import { leaderboard, teamPerformance } from '@/lib/metrics'
import { fmtPercent } from '@/lib/derive'

export function TeamPage() {
  const { data, month, setMonth, canManage, me, addMember, updateMember, removeMember } = useStore()
  const [editing, setEditing] = useState<Member | null>(null)
  const [adding, setAdding] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const confirm = useConfirm()

  if (!data) return null
  const { workspace, members } = data
  const stages = workspace.stages

  const scores = useMemo(() => teamPerformance(data, month), [data, month])
  const board = useMemo(() => leaderboard(scores, stages), [scores, stages])

  const roster = useMemo(
    () => members.filter((m) => showInactive || m.active).sort((a, b) => a.name.localeCompare(b.name)),
    [members, showInactive],
  )

  const inactiveCount = members.filter((m) => !m.active).length
  const totalAssigned = scores.reduce((n, s) => n + s.assigned, 0)

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Team"
        blurb="Who is in the workspace, and what each person produced this month."
        action={
          <>
            <MonthNav month={month} onChange={setMonth} />
            {canManage && (
              <Button variant="primary" icon="user-plus" onClick={() => setAdding(true)}>
                <span className="hidden sm:inline">Add person</span>
              </Button>
            )}
          </>
        }
      />

      {/* -------- Performance table -------- */}
      <Card className="overflow-hidden">
        <CardHeader
          label="Output"
          title="This month"
          action={
            <span className="font-mono text-label-micro uppercase text-ink-faint">
              {totalAssigned} task{totalAssigned === 1 ? '' : 's'} logged
            </span>
          }
        />
        {scores.length === 0 ? (
          <div className="p-widget">
            <EmptyState icon="users" title="No active team members" blurb="Add someone to start tracking output." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left">
              <thead className="bg-sunken/60">
                <tr className="label-caps">
                  <th className="px-3 py-2.5 font-medium">Person</th>
                  <th className="px-3 py-2.5 text-right font-medium">Assigned</th>
                  <th className="px-3 py-2.5 text-right font-medium">Done</th>
                  <th className="px-3 py-2.5 text-right font-medium">Open</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-3 py-2.5 font-medium">Completion</th>
                  {stages.map((s) => (
                    <th key={s.id} className="whitespace-nowrap px-3 py-2.5 text-right font-medium" title={`${s.name} completed`}>
                      {s.name}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium">Published</th>
                  <th className="px-3 py-2.5 text-right font-medium">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-hair">
                {scores.map((s) => (
                  <tr key={s.member.id} className="row-hover">
                    <td className="px-3 py-2.5">
                      <button onClick={() => setEditing(s.member)} className="flex items-center gap-2 text-left">
                        <Avatar name={s.member.name} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate text-body-sm text-ink">{s.member.name}</span>
                          <span className="block truncate font-mono text-label-micro uppercase text-ink-faint">
                            {s.member.role}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">{s.assigned}</td>
                    <td className="numeral px-3 py-2.5 text-right text-body-sm text-emerald">{s.completed}</td>
                    <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">{s.pending}</td>
                    <td
                      className={cx(
                        'numeral px-3 py-2.5 text-right text-body-sm',
                        s.overdue ? 'text-danger' : 'text-ink-faint',
                      )}
                    >
                      {s.overdue}
                    </td>
                    <td className="w-32 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          pct={(s.completionRate ?? 0) * 100}
                          tone={s.completionRate === 1 ? 'emerald' : s.overdue ? 'danger' : 'primary'}
                        />
                        <span className="numeral shrink-0 font-mono text-label-micro text-ink-dim">
                          {fmtPercent(s.completionRate, 0)}
                        </span>
                      </div>
                    </td>
                    {stages.map((st) => (
                      <td key={st.id} className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">
                        {s.stageCompletions[st.id] || '—'}
                      </td>
                    ))}
                    <td className="numeral px-3 py-2.5 text-right text-body-sm text-ink-dim">{s.publishedOwned || '—'}</td>
                    <td className="numeral px-3 py-2.5 text-right text-body-sm text-amber">{s.awaiting || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* -------- Leaderboard -------- */}
      {board.length > 0 && (
        <Card>
          <CardHeader label="Leaderboard" title="Highlights this month" />
          <div className="grid gap-3 p-widget sm:grid-cols-2 lg:grid-cols-4">
            {board.map((entry) => (
              <div key={entry.title} className="rounded-md border border-line/50 bg-sunken/50 p-3">
                <div className="label-caps">{entry.title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Avatar name={entry.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{entry.name}</span>
                </div>
                <div className="numeral mt-1.5 font-mono text-label-caps text-primary">{entry.score}</div>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-1.5 border-t border-white/5 px-widget py-3 text-body-xs text-ink-faint">
            <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
            For workload visibility, not for ranking people against each other.
          </p>
        </Card>
      )}

      {/* -------- Directory -------- */}
      <Card>
        <CardHeader
          label="Directory"
          title={`${members.filter((m) => m.active).length} active`}
          action={
            inactiveCount > 0 ? (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="font-mono text-label-micro uppercase text-primary hover:underline"
              >
                {showInactive ? 'Hide' : 'Show'} {inactiveCount} inactive
              </button>
            ) : undefined
          }
        />
        <ul className="grid gap-2 p-widget sm:grid-cols-2 xl:grid-cols-3">
          {roster.map((m) => (
            <li key={m.id}>
              <div
                className={cx(
                  'flex h-full items-start gap-3 rounded-md border p-3 transition-colors',
                  m.active ? 'border-line/50 bg-sunken/40' : 'border-line/30 bg-void/40 opacity-70',
                )}
              >
                <Avatar name={m.name} size={36} dim={!m.active} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(m)} className="min-w-0 truncate text-body-sm text-ink hover:text-primary">
                      {m.name}
                    </button>
                    {m.id === me?.id && <StatusChip tone="primary">you</StatusChip>}
                    {!m.active && <StatusChip tone="neutral">inactive</StatusChip>}
                  </div>
                  <p className="mt-0.5 font-mono text-label-micro uppercase text-ink-faint">
                    {m.role} · {m.access}
                  </p>
                  {m.responsibility && <p className="mt-1 line-clamp-2 text-body-xs text-ink-dim">{m.responsibility}</p>}
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="mt-1 block truncate text-body-xs text-primary hover:underline">
                      {m.email}
                    </a>
                  )}
                </div>
                {canManage && (
                  <Menu
                    items={[
                      { label: 'Edit', icon: 'pencil', onSelect: () => setEditing(m) },
                      {
                        label: m.active ? 'Deactivate' : 'Reactivate',
                        icon: m.active ? 'block' : 'refresh',
                        onSelect: () => void updateMember(m.id, { active: !m.active }),
                      },
                      {
                        label: 'Remove',
                        icon: 'trash',
                        danger: true,
                        disabled: m.access === 'owner',
                        onSelect: () =>
                          confirm.ask({
                            title: `Remove ${m.name}?`,
                            body: 'If they have any content or tasks attached, they are deactivated instead so history stays intact.',
                            confirmLabel: 'Remove',
                            danger: true,
                            onConfirm: () => void removeMember(m.id),
                          }),
                      },
                    ]}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {(editing || adding) && (
        <MemberSheet
          open
          onClose={() => {
            setEditing(null)
            setAdding(false)
          }}
          member={editing}
          onSave={async (patch) => {
            if (editing) await updateMember(editing.id, patch)
            else
              await addMember({
                name: patch.name ?? '',
                email: patch.email ?? '',
                role: patch.role ?? workspace.taxonomies.roles[1]?.label ?? 'Content Writer',
                access: patch.access ?? 'member',
                responsibility: patch.responsibility,
              })
          }}
        />
      )}
      {confirm.element}
    </div>
  )
}

function MemberSheet({
  open,
  onClose,
  member,
  onSave,
}: {
  open: boolean
  onClose: () => void
  member: Member | null
  onSave: (patch: Partial<Member>) => Promise<void>
}) {
  const { data, canManage, me } = useStore()
  const [draft, setDraft] = useState<Partial<Member>>(
    member ?? { name: '', email: '', role: '', access: 'member', active: true, responsibility: '', contact: '', notes: '' },
  )
  const [saving, setSaving] = useState(false)
  if (!data) return null

  const { taxonomies } = data.workspace
  const isSelf = member?.id === me?.id
  const editable = canManage || isSelf
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={member ? member.name : 'Add someone'}
      subtitle={member ? `${member.role} · ${member.access}` : 'They can also join themselves with the workspace code'}
      footer={
        editable ? (
          <>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="check"
              loading={saving}
              disabled={!draft.name?.trim()}
              onClick={() => void save()}
            >
              {member ? 'Save' : 'Add to team'}
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <fieldset disabled={!editable} className="space-y-3">
        <Field label="Name">
          <Input value={draft.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Email" hint="lets them claim this profile when they join">
          <Input
            type="email"
            value={draft.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@company.com"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job role" hint="drives stage assignment">
            <OptionSelect
              value={draft.role ?? ''}
              onChange={(v) => set('role', v)}
              options={taxonomies.roles.map((r) => r.label)}
              placeholder="—"
            />
          </Field>
          <Field label="Access level">
            <Select
              value={draft.access ?? 'member'}
              onChange={(e) => set('access', e.target.value as AccessLevel)}
              disabled={!canManage || draft.access === 'owner'}
            >
              {ACCESS_LEVELS.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === 'owner' && draft.access !== 'owner'}>
                  {a.label} — {a.blurb}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Primary responsibility">
          <Input
            value={draft.responsibility ?? ''}
            onChange={(e) => set('responsibility', e.target.value)}
            placeholder="e.g. Short-form editing and thumbnails"
          />
        </Field>
        <Field label="Contact">
          <Input value={draft.contact ?? ''} onChange={(e) => set('contact', e.target.value)} placeholder="Phone or handle" />
        </Field>
        <Field label="Notes">
          <Textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={2} />
        </Field>

        {member && canManage && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-line/50 bg-sunken/50 px-3 py-2.5">
            <span>
              <span className="block text-body-sm text-ink">Active</span>
              <span className="block text-body-xs text-ink-faint">
                Inactive people keep their history but leave every dropdown.
              </span>
            </span>
            <Toggle checked={draft.active ?? true} onChange={(v) => set('active', v)} label="Active" />
          </div>
        )}
      </fieldset>
    </Sheet>
  )
}
