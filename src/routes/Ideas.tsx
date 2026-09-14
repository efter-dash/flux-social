/**
 * Idea bank.
 *
 * Replaces "09 Content Ideas". The important mechanic from the spreadsheet is the
 * promotion step: an approved idea becomes a real content item with a new code,
 * and the idea keeps a link to it so nothing gets double-planned.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  Field,
  Input,
  OptionSelect,
  PlatformChip,
  PriorityFlag,
  SectionTitle,
  Select,
  StatusChip,
  Tabs,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { Menu, Sheet, useConfirm } from '@/components/ui/Overlay'
import { StageFunnel } from '@/components/charts/charts'
import { useStore } from '@/state/store'
import type { Idea, IdeaStatus } from '@/lib/types'
import { IDEA_STATUSES } from '@/lib/types'
import { memberName, type Tone } from '@/lib/derive'
import { ideaFunnel } from '@/lib/metrics'
import { fmtDateFull } from '@/lib/date'

const STATUS_TONE: Record<IdeaStatus, Tone> = {
  new: 'neutral',
  reviewed: 'primary',
  approved: 'violet',
  converted: 'emerald',
  rejected: 'danger',
}

export function IdeasPage() {
  const { data, canEdit, createIdea, updateIdea, deleteIdea, promoteIdea } = useStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<IdeaStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Idea | null>(null)
  const confirm = useConfirm()

  if (!data) return null
  const { workspace, members, ideas } = data

  const funnel = useMemo(() => ideaFunnel(ideas), [ideas])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return ideas
      .filter((i) => (tab === 'all' ? true : i.status === tab))
      .filter((i) =>
        term ? `${i.code} ${i.topic} ${i.description} ${i.contentType} ${i.reference}`.toLowerCase().includes(term) : true,
      )
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.code.localeCompare(a.code))
  }, [ideas, tab, q])

  const add = async () => {
    const idea = await createIdea()
    setEditing(idea)
  }

  const promote = async (idea: Idea) => {
    const item = await promoteIdea(idea.id)
    if (item) navigate(`/content/${item.id}`)
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Idea bank"
        blurb="Log every idea here first. Approved ideas get promoted into the plan with their own code."
        action={
          canEdit ? (
            <Button variant="primary" icon="plus" onClick={() => void add()}>
              <span className="hidden sm:inline">New idea</span>
            </Button>
          ) : undefined
        }
      />

      {/* -------- Funnel -------- */}
      <Card>
        <CardHeader label="Funnel" title={`${ideas.length} ideas logged`} />
        <div className="p-widget pt-3">
          <StageFunnel
            steps={[
              { label: 'New', value: funnel.new, tone: 'neutral' },
              { label: 'Reviewed', value: funnel.reviewed, tone: 'primary' },
              { label: 'Approved', value: funnel.approved, tone: 'violet' },
              { label: 'Converted', value: funnel.converted, tone: 'emerald' },
              { label: 'Rejected', value: funnel.rejected, tone: 'danger' },
            ]}
          />
          {funnel.approved > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-md border border-violet/25 bg-violet/10 px-3 py-2 text-body-xs text-ink-dim">
              <Icon name="sparkle" size={14} className="shrink-0 text-violet" />
              {funnel.approved} approved idea{funnel.approved === 1 ? '' : 's'} not yet in the plan.
              <button onClick={() => setTab('approved')} className="ml-auto shrink-0 text-primary hover:underline">
                Review
              </button>
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <span className="relative min-w-0 flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas…" className="pl-9" />
        </span>
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: 'All', count: ideas.length },
          ...IDEA_STATUSES.map((s) => ({ id: s.id, label: s.label, count: ideas.filter((i) => i.status === s.id).length })),
        ]}
        value={tab}
        onChange={setTab}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="bulb"
          title={ideas.length ? 'No ideas in this state' : 'The idea bank is empty'}
          blurb="Anyone on the team can add an idea at any time — that is the point of keeping it separate from the plan."
          action={
            canEdit ? (
              <Button size="sm" icon="plus" onClick={() => void add()}>
                Add an idea
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((idea) => {
            const linked = data.content.find((c) => c.id === idea.contentId)
            return (
              <li key={idea.id}>
                <Card className="flex h-full flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <StatusChip tone={STATUS_TONE[idea.status]}>
                        {IDEA_STATUSES.find((s) => s.id === idea.status)?.label}
                      </StatusChip>
                      <span className="font-mono text-label-micro text-ink-faint">{idea.code}</span>
                    </span>
                    {canEdit && (
                      <Menu
                        items={[
                          { label: 'Edit', icon: 'pencil', onSelect: () => setEditing(idea) },
                          {
                            label: 'Promote into the plan',
                            icon: 'arrow-right',
                            disabled: idea.status === 'converted',
                            onSelect: () => void promote(idea),
                          },
                          {
                            label: 'Mark approved',
                            icon: 'check',
                            disabled: idea.status === 'approved' || idea.status === 'converted',
                            onSelect: () => void updateIdea(idea.id, { status: 'approved' }),
                          },
                          {
                            label: 'Reject',
                            icon: 'block',
                            disabled: idea.status === 'rejected',
                            onSelect: () => void updateIdea(idea.id, { status: 'rejected' }),
                          },
                          {
                            label: 'Delete',
                            icon: 'trash',
                            danger: true,
                            onSelect: () =>
                              confirm.ask({
                                title: `Delete ${idea.code}?`,
                                body: 'The idea is removed permanently.',
                                confirmLabel: 'Delete',
                                danger: true,
                                onConfirm: () => void deleteIdea(idea.id),
                              }),
                          },
                        ]}
                      />
                    )}
                  </div>

                  <button onClick={() => setEditing(idea)} className="mt-2 text-left">
                    <h3 className="text-body-md font-medium leading-snug text-ink">{idea.topic || 'Untitled idea'}</h3>
                  </button>
                  {idea.description && (
                    <p className="mt-1.5 line-clamp-3 text-body-xs text-ink-dim">{idea.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <PlatformChip
                      label={idea.platform || '—'}
                      size="sm"
                      color={workspace.taxonomies.platforms.find((p) => p.label === idea.platform)?.color}
                    />
                    <span className="font-mono text-label-micro uppercase text-ink-faint">{idea.contentType}</span>
                    <PriorityFlag priority={idea.priority} />
                    <Chip className="!py-0.5">
                      <Icon name="target" size={11} />
                      {idea.potential} potential
                    </Chip>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar name={memberName(members, idea.submittedBy)} size={20} />
                      <span className="truncate font-mono text-label-micro uppercase text-ink-faint">
                        {fmtDateFull(idea.dateAdded)}
                      </span>
                    </span>
                    {linked ? (
                      <Link
                        to={`/content/${linked.id}`}
                        className="inline-flex shrink-0 items-center gap-1 font-mono text-label-micro uppercase text-emerald hover:underline"
                      >
                        <Icon name="link" size={11} />
                        {linked.code}
                      </Link>
                    ) : (
                      canEdit &&
                      idea.status !== 'rejected' && (
                        <Button size="sm" variant="quiet" iconRight="arrow-right" onClick={() => void promote(idea)}>
                          Promote
                        </Button>
                      )
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <IdeaSheet open onClose={() => setEditing(null)} idea={editing} />}
      {confirm.element}
    </div>
  )
}

function IdeaSheet({ open, onClose, idea }: { open: boolean; onClose: () => void; idea: Idea }) {
  const { data, canEdit, updateIdea, promoteIdea } = useStore()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Idea>(idea)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(idea), [idea.id, open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return null

  const { taxonomies } = data.workspace
  const set = <K extends keyof Idea>(k: K, v: Idea[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await updateIdea(idea.id, draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={draft.topic || 'New idea'}
      subtitle={draft.code}
      footer={
        canEdit ? (
          <>
            {draft.status !== 'converted' && (
              <Button
                variant="ghost"
                icon="arrow-right"
                className="mr-auto"
                onClick={async () => {
                  await updateIdea(idea.id, draft)
                  const item = await promoteIdea(idea.id)
                  onClose()
                  if (item) navigate(`/content/${item.id}`)
                }}
              >
                Promote into the plan
              </Button>
            )}
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
        <Field label="Idea">
          <Input value={draft.topic} onChange={(e) => set('topic', e.target.value)} placeholder="One-line summary" />
        </Field>
        <Field label="Description" hint="what it actually is">
          <Textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Content type">
            <OptionSelect value={draft.contentType} onChange={(v) => set('contentType', v)} options={taxonomies.contentTypes} placeholder="—" />
          </Field>
          <Field label="Category">
            <OptionSelect value={draft.category} onChange={(v) => set('category', v)} options={taxonomies.categories} placeholder="—" />
          </Field>
          <Field label="Platform">
            <OptionSelect
              value={draft.platform}
              onChange={(v) => set('platform', v)}
              options={taxonomies.platforms.map((p) => p.label)}
              placeholder="—"
            />
          </Field>
          <Field label="Objective">
            <OptionSelect value={draft.objective} onChange={(v) => set('objective', v)} options={taxonomies.objectives} placeholder="—" />
          </Field>
          <Field label="Target audience">
            <Input value={draft.audience} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <Field label="Where it came from" hint="source or reference">
            <Input value={draft.reference} onChange={(e) => set('reference', e.target.value)} placeholder="e.g. Support tickets" />
          </Field>
          <Field label="Priority">
            <OptionSelect value={draft.priority} onChange={(v) => set('priority', v)} options={taxonomies.priorities} />
          </Field>
          <Field label="Potential">
            <OptionSelect value={draft.potential} onChange={(v) => set('potential', v)} options={taxonomies.ideaPotentials} />
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set('status', e.target.value as IdeaStatus)}>
              {IDEA_STATUSES.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === 'converted'}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date added">
            <Input type="date" value={draft.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} />
          </Field>
        </div>

        <Field label="Remarks">
          <Textarea value={draft.remarks} onChange={(e) => set('remarks', e.target.value)} rows={2} />
        </Field>

        {draft.status === 'converted' && (
          <p className={cx('rounded-md border border-emerald/25 bg-emerald/10 p-3 text-body-xs text-ink-dim')}>
            This idea has already been promoted into the plan.
          </p>
        )}
      </fieldset>
    </Sheet>
  )
}
