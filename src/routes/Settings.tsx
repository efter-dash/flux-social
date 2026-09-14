/**
 * Workspace settings.
 *
 * This is where the app stops being opinionated: the pipeline, every dropdown
 * vocabulary, the code prefixes and the week start are all editable here, which
 * is what makes one tool usable by a video team, a design team and an agency.
 *
 * Replaces the spreadsheet's hidden "Lists" tab, plus the parts of the README
 * that explained how to add a person or a month by hand.
 */

import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Field,
  Input,
  OptionSelect,
  SectionTitle,
  Select,
  StatusChip,
  Tabs,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { useConfirm } from '@/components/ui/Overlay'
import { useStore } from '@/state/store'
import type { AccessLevel, PlatformDef, Stage, Taxonomies } from '@/lib/types'
import { uid } from '@/lib/factories'
import { PIPELINE_TEMPLATES } from '@/lib/templates'
import { APP_NAME } from '@/brand'

type Tab = 'workspace' | 'pipeline' | 'lists' | 'access' | 'data'

export function SettingsPage() {
  const { data, canManage, access } = useStore()
  const [tab, setTab] = useState<Tab>('workspace')
  if (!data) return null

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Settings"
        blurb={
          canManage
            ? 'Shape the tool around how your team actually works.'
            : 'Your access level is read-only for workspace configuration.'
        }
      />

      {!canManage && (
        <p className="flex items-center gap-2 rounded-md border border-amber/25 bg-amber/10 px-3 py-2.5 text-body-sm text-ink-dim">
          <Icon name="key" size={15} className="shrink-0 text-amber" />
          You are a <span className="font-mono uppercase">{access}</span>. Only owners and admins can change these
          settings.
        </p>
      )}

      <Tabs
        tabs={[
          { id: 'workspace', label: 'Workspace' },
          { id: 'pipeline', label: 'Pipeline' },
          { id: 'lists', label: 'Dropdowns' },
          { id: 'access', label: 'Access' },
          { id: 'data', label: 'Data' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'workspace' && <WorkspaceTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'lists' && <ListsTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'data' && <DataTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function WorkspaceTab() {
  const { data, canManage, updateWorkspace, notify } = useStore()
  const [name, setName] = useState(data?.workspace.name ?? '')
  const [initials, setInitials] = useState(data?.workspace.initials ?? '')
  const [prefix, setPrefix] = useState(data?.workspace.contentPrefix ?? 'CN')
  if (!data) return null
  const { workspace } = data

  const dirty =
    name !== workspace.name || initials !== workspace.initials || prefix !== workspace.contentPrefix

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader label="Identity" title="Workspace" />
        <div className="space-y-3 p-widget">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Short badge" hint="2 characters">
              <Input
                value={initials}
                maxLength={3}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                className="font-mono uppercase"
                disabled={!canManage}
              />
            </Field>
            <Field label="Content ID prefix" hint={`${prefix || 'CN'}-0001`}>
              <Input
                value={prefix}
                maxLength={5}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                className="font-mono uppercase"
                disabled={!canManage}
              />
            </Field>
          </div>
          <p className="text-body-xs text-ink-faint">
            Changing the prefix affects new items only — existing codes are permanent, which is what keeps links and
            references stable.
          </p>
          {canManage && (
            <Button
              variant="primary"
              icon="check"
              disabled={!dirty || !name.trim()}
              onClick={() =>
                void updateWorkspace({
                  name: name.trim(),
                  initials: initials.trim() || name.slice(0, 2).toUpperCase(),
                  contentPrefix: prefix.trim() || 'CN',
                }).then(() => notify('Workspace updated', 'success'))
              }
            >
              Save changes
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader label="Calendar" title="Week and counters" />
        <div className="space-y-3 p-widget">
          <div className="flex items-center justify-between gap-3 rounded-md border border-line/50 bg-sunken/50 px-3 py-2.5">
            <span>
              <span className="block text-body-sm text-ink">Weeks start on Monday</span>
              <span className="block text-body-xs text-ink-faint">
                Affects the calendar grid, week numbering and the weekly review.
              </span>
            </span>
            <Toggle
              checked={workspace.weekStartsOn === 1}
              onChange={(v) => void updateWorkspace({ weekStartsOn: v ? 1 : 0 })}
              label="Weeks start Monday"
              disabled={!canManage}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: 'Content', n: workspace.counters.content, pfx: workspace.contentPrefix },
                { label: 'Tasks', n: workspace.counters.task, pfx: workspace.taskPrefix },
                { label: 'Ideas', n: workspace.counters.idea, pfx: workspace.ideaPrefix },
              ] as const
            ).map((c) => (
              <div key={c.label} className="rounded-md border border-line/50 bg-sunken/50 p-3">
                <div className="label-caps">{c.label}</div>
                <div className="numeral mt-1 text-headline-md text-ink">{c.n}</div>
                <div className="font-mono text-label-micro uppercase text-ink-faint">
                  next {c.pfx}-{`${c.n + 1}`.padStart(4, '0')}
                </div>
              </div>
            ))}
          </div>
          <p className="text-body-xs text-ink-faint">
            Counters never go backwards, so a deleted item never frees its code for reuse.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function PipelineTab() {
  const { data, canManage, setStages, notify } = useStore()
  const [stages, setLocal] = useState<Stage[]>(data?.workspace.stages ?? [])
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()
  if (!data) return null

  const { workspace, content } = data
  const roles = workspace.taxonomies.roles.map((r) => r.label)
  const dirty = JSON.stringify(stages) !== JSON.stringify(workspace.stages)

  const move = (index: number, dir: -1 | 1) => {
    const next = [...stages]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setLocal(next)
  }

  const usage = (stageId: string) =>
    content.filter((c) => (c.stageStates?.[stageId] ?? 'pending') !== 'pending').length

  const save = async () => {
    setSaving(true)
    try {
      await setStages(stages)
      notify('Pipeline updated', 'success')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          label="Production pipeline"
          title={`${stages.length} stages`}
          action={
            canManage && dirty ? (
              <div className="flex gap-2">
                <Button size="sm" variant="quiet" onClick={() => setLocal(workspace.stages)}>
                  Reset
                </Button>
                <Button size="sm" variant="primary" icon="check" loading={saving} onClick={() => void save()}>
                  Save pipeline
                </Button>
              </div>
            ) : undefined
          }
        />

        <div className="space-y-2 p-widget">
          {stages.map((s, i) => (
            <div
              key={s.id}
              className="grid gap-2 rounded-md border border-line/50 bg-sunken/40 p-3 sm:grid-cols-[auto_1fr_1fr_auto_auto] sm:items-end"
            >
              <span className="flex items-center gap-1.5 sm:pb-2">
                <span className="numeral flex h-6 w-6 items-center justify-center rounded bg-accent/15 font-mono text-label-micro text-primary">
                  {i + 1}
                </span>
              </span>

              <Field label="Stage name">
                <Input
                  value={s.name}
                  onChange={(e) => setLocal(stages.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                  disabled={!canManage}
                />
              </Field>

              <Field label="Owner role" hint="suggests the assignee">
                <OptionSelect
                  value={s.ownerRole}
                  onChange={(v) => setLocal(stages.map((x) => (x.id === s.id ? { ...x, ownerRole: v } : x)))}
                  options={roles}
                  disabled={!canManage}
                />
              </Field>

              <Field label="Verb" hint="button label">
                <Input
                  value={s.verb ?? ''}
                  placeholder="Complete"
                  className="sm:w-28"
                  onChange={(e) => setLocal(stages.map((x) => (x.id === s.id ? { ...x, verb: e.target.value } : x)))}
                  disabled={!canManage}
                />
              </Field>

              {canManage && (
                <div className="flex items-center gap-1 sm:pb-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded p-1.5 text-ink-faint hover:bg-raised hover:text-ink disabled:opacity-30"
                  >
                    <Icon name="chevron-up" size={15} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === stages.length - 1}
                    aria-label="Move down"
                    className="rounded p-1.5 text-ink-faint hover:bg-raised hover:text-ink disabled:opacity-30"
                  >
                    <Icon name="chevron-down" size={15} />
                  </button>
                  <button
                    onClick={() => {
                      const used = usage(s.id)
                      const remove = () => setLocal(stages.filter((x) => x.id !== s.id))
                      if (used > 0) {
                        confirm.ask({
                          title: `Remove the ${s.name} stage?`,
                          body: `${used} content item${used === 1 ? ' has' : 's have'} progress recorded on this stage. Removing it discards that progress, and the pipeline shortens for every item in the workspace.`,
                          confirmLabel: 'Remove stage',
                          danger: true,
                          onConfirm: remove,
                        })
                      } else remove()
                    }}
                    disabled={stages.length <= 1}
                    aria-label="Remove stage"
                    className="rounded p-1.5 text-ink-faint hover:bg-danger/15 hover:text-danger disabled:opacity-30"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {canManage && (
            <Button
              icon="plus"
              block
              onClick={() =>
                setLocal([...stages, { id: uid('st_'), name: 'New stage', ownerRole: roles[0] ?? '', verb: '' }])
              }
            >
              Add a stage
            </Button>
          )}

          <p className="flex items-start gap-1.5 pt-1 text-body-xs text-ink-faint">
            <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
            Existing content keeps its progress on stages that stay. New stages start as pending everywhere.
          </p>
        </div>
      </Card>

      {canManage && (
        <Card>
          <CardHeader label="Templates" title="Start from a preset" />
          <div className="grid gap-2 p-widget sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  confirm.ask({
                    title: `Replace the pipeline with “${t.name}”?`,
                    body: `The pipeline becomes ${t.stages.map((s) => s.name).join(' → ')}. Progress on stages that do not carry over is lost.`,
                    confirmLabel: 'Replace pipeline',
                    danger: true,
                    onConfirm: () => setLocal(t.stages.map((s) => ({ ...s, id: uid('st_') }))),
                  })
                }
                className="rounded-md border border-line/50 bg-sunken/40 p-3 text-left transition-colors hover:border-line"
              >
                <span className="block text-body-sm font-medium text-ink">{t.name}</span>
                <span className="mt-1 block text-body-xs text-ink-dim">{t.blurb}</span>
                <span className="mt-2 block font-mono text-label-micro uppercase text-ink-faint">
                  {t.stages.map((s) => s.name).join(' → ')}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
      {confirm.element}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dropdown vocabularies
// ---------------------------------------------------------------------------

const LIST_KEYS: { key: keyof Taxonomies; label: string; blurb: string }[] = [
  { key: 'contentTypes', label: 'Content types', blurb: 'Reel, Carousel, Blog post…' },
  { key: 'categories', label: 'Categories', blurb: 'How you group content by theme' },
  { key: 'priorities', label: 'Priorities', blurb: 'Ordered from most to least urgent' },
  { key: 'taskTypes', label: 'Task types', blurb: 'What a person logs their day against' },
  { key: 'objectives', label: 'Objectives', blurb: 'Why a piece of content exists' },
  { key: 'audiences', label: 'Audiences', blurb: 'Suggestions offered while typing' },
  { key: 'performanceRatings', label: 'Performance ratings', blurb: 'Excellent, Good, Average…' },
  { key: 'repurposeLevels', label: 'Repurpose levels', blurb: 'How reusable published work is' },
  { key: 'ideaPotentials', label: 'Idea potential', blurb: 'Used when triaging the idea bank' },
]

function ListsTab() {
  const { data, canManage, updateTaxonomies } = useStore()
  if (!data) return null
  const { taxonomies } = data.workspace

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {LIST_KEYS.map((l) => (
          <Card key={l.key}>
            <CardHeader label={l.label} title={<span className="text-body-sm text-ink-dim">{l.blurb}</span>} />
            <div className="p-widget pt-2">
              <TagEditor
                values={taxonomies[l.key] as string[]}
                disabled={!canManage}
                onChange={(next) => void updateTaxonomies({ [l.key]: next } as Partial<Taxonomies>)}
              />
            </div>
          </Card>
        ))}

        <PlatformEditor />
        <RoleEditor />
      </div>
    </div>
  )
}

function TagEditor({
  values,
  onChange,
  disabled,
}: {
  values: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v || values.includes(v)) {
      setDraft('')
      return
    }
    onChange([...values, v])
    setDraft('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-body-xs text-ink-faint">Empty — nothing will appear in this dropdown.</span>}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-sunken/60 py-1 pl-2.5 pr-1.5 text-body-xs text-ink-dim"
          >
            {v}
            {!disabled && (
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="rounded-full p-0.5 text-ink-faint transition-colors hover:bg-danger/20 hover:text-danger"
              >
                <Icon name="x" size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2.5 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Add an option…"
            className="h-9 text-body-xs"
          />
          <Button size="sm" icon="plus" onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

function PlatformEditor() {
  const { data, canManage, updateTaxonomies } = useStore()
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#4b8eff')
  if (!data) return null
  const platforms = data.workspace.taxonomies.platforms

  const update = (next: PlatformDef[]) => void updateTaxonomies({ platforms: next })

  return (
    <Card>
      <CardHeader label="Platforms" title={<span className="text-body-sm text-ink-dim">Each carries its own brand colour</span>} />
      <div className="space-y-2 p-widget pt-2">
        {platforms.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 rounded-md border border-line/40 bg-sunken/40 px-2.5 py-2">
            <input
              type="color"
              value={p.color}
              disabled={!canManage}
              onChange={(e) => update(platforms.map((x) => (x.id === p.id ? { ...x, color: e.target.value } : x)))}
              aria-label={`${p.label} colour`}
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line/60 bg-transparent p-0.5"
            />
            <Input
              value={p.label}
              disabled={!canManage}
              onChange={(e) => update(platforms.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
              className="h-8 text-body-xs"
            />
            <span
              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-label-micro uppercase"
              style={{ backgroundColor: `${p.color}30`, color: p.color }}
            >
              {p.label || '—'}
            </span>
            {canManage && (
              <button
                onClick={() => update(platforms.filter((x) => x.id !== p.id))}
                aria-label={`Remove ${p.label}`}
                className="shrink-0 rounded p-1 text-ink-faint hover:bg-danger/15 hover:text-danger"
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        ))}

        {canManage && (
          <div className="flex gap-2 pt-1">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="New platform colour"
              className="h-9 w-9 shrink-0 cursor-pointer rounded border border-line/60 bg-transparent p-0.5"
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Add a platform…"
              className="h-9 text-body-xs"
            />
            <Button
              size="sm"
              icon="plus"
              disabled={!label.trim()}
              onClick={() => {
                update([...platforms, { id: uid('pf_'), label: label.trim(), color }])
                setLabel('')
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function RoleEditor() {
  const { data, canManage, updateTaxonomies, notify } = useStore()
  const [label, setLabel] = useState('')
  if (!data) return null
  const roles = data.workspace.taxonomies.roles
  const { members, workspace } = data

  return (
    <Card>
      <CardHeader label="Job roles" title={<span className="text-body-sm text-ink-dim">Used by people and pipeline stages</span>} />
      <div className="space-y-2 p-widget pt-2">
        {roles.map((r) => {
          const inUse =
            members.filter((m) => m.role === r.label).length +
            workspace.stages.filter((s) => s.ownerRole === r.label).length
          return (
            <div key={r.id} className="flex items-center gap-2.5 rounded-md border border-line/40 bg-sunken/40 px-2.5 py-2">
              <Input
                value={r.label}
                disabled={!canManage}
                onChange={(e) =>
                  void updateTaxonomies({
                    roles: roles.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)),
                  })
                }
                className="h-8 text-body-xs"
              />
              <span className="shrink-0 font-mono text-label-micro uppercase text-ink-faint">{inUse} in use</span>
              {canManage && (
                <button
                  onClick={() => {
                    if (inUse > 0) {
                      notify('That role is still assigned to people or stages.', 'danger')
                      return
                    }
                    void updateTaxonomies({ roles: roles.filter((x) => x.id !== r.id) })
                  }}
                  aria-label={`Remove ${r.label}`}
                  className="shrink-0 rounded p-1 text-ink-faint hover:bg-danger/15 hover:text-danger"
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          )
        })}

        {canManage && (
          <div className="flex gap-2 pt-1">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Add a role…"
              className="h-9 text-body-xs"
            />
            <Button
              size="sm"
              icon="plus"
              disabled={!label.trim()}
              onClick={() => {
                void updateTaxonomies({ roles: [...roles, { id: uid('rl_'), label: label.trim() }] })
                setLabel('')
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

function AccessTab() {
  const { data, canManage, updateWorkspace, regenerateJoinCode, notify } = useStore()
  const [copied, setCopied] = useState(false)
  if (!data) return null
  const { workspace, members } = data

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(workspace.joinCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      notify('Could not copy — select the code manually.', 'danger')
    }
  }

  const byAccess = useMemo(() => {
    const map: Record<AccessLevel, number> = { owner: 0, admin: 0, member: 0, viewer: 0 }
    for (const m of members) map[m.access]++
    return map
  }, [members])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader label="Invitations" title="Join code" />
        <div className="space-y-3 p-widget">
          <div
            className={cx(
              'flex items-center justify-between gap-3 rounded-md border p-4',
              workspace.joinEnabled ? 'border-accent/40 bg-accent/[0.08]' : 'border-line/50 bg-sunken/50 opacity-60',
            )}
          >
            <span className="numeral font-mono text-headline-md tracking-[0.3em] text-ink">{workspace.joinCode}</span>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="ghost" icon={copied ? 'check' : 'copy'} onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              {canManage && (
                <Button size="sm" variant="quiet" icon="refresh" onClick={() => void regenerateJoinCode()}>
                  New
                </Button>
              )}
            </div>
          </div>

          <p className="text-body-xs text-ink-faint">
            Anyone with this code can join at the access level below. If their email already exists in the team
            directory, they claim that profile instead of creating a duplicate.
          </p>

          <div className="flex items-center justify-between gap-3 rounded-md border border-line/50 bg-sunken/50 px-3 py-2.5">
            <span>
              <span className="block text-body-sm text-ink">Joining enabled</span>
              <span className="block text-body-xs text-ink-faint">Turn off to close the workspace.</span>
            </span>
            <Toggle
              checked={workspace.joinEnabled}
              onChange={(v) => void updateWorkspace({ joinEnabled: v })}
              label="Joining enabled"
              disabled={!canManage}
            />
          </div>

          <Field label="Access granted by the code">
            <Select
              value={workspace.joinAccess}
              onChange={(e) => void updateWorkspace({ joinAccess: e.target.value as Exclude<AccessLevel, 'owner'> })}
              disabled={!canManage}
            >
              <option value="member">Member — can create and edit</option>
              <option value="viewer">Viewer — read only</option>
              <option value="admin">Admin — can manage the workspace</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader label="Permissions" title="What each level can do" />
        <div className="space-y-2 p-widget">
          {(
            [
              { id: 'owner' as const, can: 'Everything, including deleting the workspace' },
              { id: 'admin' as const, can: 'Manage people, pipeline, dropdowns and all content' },
              { id: 'member' as const, can: 'Create and edit content, tasks and ideas' },
              { id: 'viewer' as const, can: 'Read everything, change nothing' },
            ]
          ).map((row) => (
            <div key={row.id} className="flex items-start gap-3 rounded-md border border-line/40 bg-sunken/40 p-3">
              <StatusChip tone={row.id === 'owner' ? 'violet' : row.id === 'admin' ? 'primary' : 'neutral'}>
                {row.id}
              </StatusChip>
              <span className="min-w-0 flex-1 text-body-xs text-ink-dim">{row.can}</span>
              <span className="numeral shrink-0 font-mono text-label-micro uppercase text-ink-faint">
                {byAccess[row.id]}
              </span>
            </div>
          ))}
          <p className="pt-1 text-body-xs text-ink-faint">
            Job roles (Videographer, Designer…) are separate from access levels: they decide who a stage is suggested
            to, not what someone is allowed to do.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function DataTab() {
  const {
    data,
    backend,
    canManage,
    access,
    loadSampleData,
    deleteWorkspace,
    leaveWorkspace,
    restoreAlerts,
    dismissedAlerts,
    notify,
  } = useStore()
  const confirm = useConfirm()
  if (!data) return null
  const { workspace, content, tasks, ideas, members, reviews } = data

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('Workspace exported', 'success')
  }

  const exportCsv = () => {
    const stages = workspace.stages
    const header = [
      'Code',
      'Title',
      'Month',
      'Type',
      'Category',
      'Platform',
      'Owner',
      ...stages.map((s) => `${s.name} status`),
      'Planned publish',
      'Actual publish',
      'Priority',
      'Blocker',
      'Views',
      'Reach',
      'Engagement rate',
      'Published link',
    ]
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = content.map((c) =>
      [
        c.code,
        c.title,
        c.month,
        c.contentType,
        c.category,
        c.platform,
        members.find((m) => m.id === c.ownerId)?.name ?? '',
        ...stages.map((s) => c.stageStates?.[s.id] ?? 'pending'),
        c.plannedPublishDate,
        c.actualPublishDate,
        c.priority,
        c.blocker,
        c.performance?.views ?? '',
        c.performance?.reach ?? '',
        c.performance?.views && c.performance
          ? (
              ((c.performance.likes ?? 0) +
                (c.performance.comments ?? 0) +
                (c.performance.shares ?? 0) +
                (c.performance.saves ?? 0)) /
              c.performance.views
            ).toFixed(4)
          : '',
        c.links.published,
      ]
        .map(esc)
        .join(','),
    )
    const blob = new Blob([[header.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-content.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify('Content exported as CSV', 'success')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader label="Storage" title={backend === 'local' ? 'This browser' : 'Cloud Firestore'} />
        <div className="space-y-3 p-widget">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Content', n: content.length },
              { label: 'Tasks', n: tasks.length },
              { label: 'Ideas', n: ideas.length },
              { label: 'People', n: members.length },
              { label: 'Reviews', n: reviews.length },
            ].map((s) => (
              <Chip key={s.label}>
                <span className="numeral font-mono text-ink">{s.n}</span>
                {s.label}
              </Chip>
            ))}
          </div>

          <p className="text-body-xs text-ink-dim">
            {backend === 'local'
              ? `${APP_NAME} is running on IndexedDB in this browser. Nothing leaves the device, and the data is not shared with teammates. Set VITE_DATA_BACKEND=firestore with your Firebase config to switch to the shared cloud backend — the app code is identical either way.`
              : 'Connected to Cloud Firestore. Changes sync live to everyone in the workspace, and an offline cache keeps the app usable on a bad connection.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button icon="download" onClick={exportJson}>
              Export JSON
            </Button>
            <Button icon="download" onClick={exportCsv}>
              Export content CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader label="Maintenance" title="Housekeeping" />
        <div className="space-y-3 p-widget">
          {dismissedAlerts.size > 0 && (
            <Button icon="refresh" block onClick={restoreAlerts}>
              Restore {dismissedAlerts.size} dismissed notification{dismissedAlerts.size === 1 ? '' : 's'}
            </Button>
          )}

          {canManage && (
            <Button
              icon="sparkle"
              block
              onClick={() =>
                confirm.ask({
                  title: 'Load sample data?',
                  body: 'Adds a demo set of content, tasks, ideas and reviews on top of what is already here. Useful for trying the tool; noisy on a real workspace.',
                  confirmLabel: 'Load sample data',
                  onConfirm: () => void loadSampleData(),
                })
              }
            >
              Load sample data
            </Button>
          )}

          <div className="rounded-md border border-danger/25 bg-danger/[0.07] p-3">
            <div className="label-caps text-danger">Danger zone</div>
            <div className="mt-2.5 space-y-2">
              <Button
                variant="danger"
                icon="logout"
                block
                onClick={() =>
                  confirm.ask({
                    title: `Leave ${workspace.name}?`,
                    body: 'You lose access to this workspace. Your past work stays in the team history, and you can rejoin with the code.',
                    confirmLabel: 'Leave workspace',
                    danger: true,
                    onConfirm: () => void leaveWorkspace(workspace.id),
                  })
                }
              >
                Leave this workspace
              </Button>

              {access === 'owner' && (
                <Button
                  variant="danger"
                  icon="trash"
                  block
                  onClick={() =>
                    confirm.ask({
                      title: `Delete ${workspace.name}?`,
                      body: `This permanently removes ${content.length} content items, ${tasks.length} tasks, ${ideas.length} ideas and every member record. Export first if you might want any of it back. This cannot be undone.`,
                      confirmLabel: 'Delete permanently',
                      danger: true,
                      onConfirm: () => void deleteWorkspace(workspace.id),
                    })
                  }
                >
                  Delete workspace permanently
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
      {confirm.element}
    </div>
  )
}
