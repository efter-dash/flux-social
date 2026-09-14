/**
 * Create / edit form for a content item.
 *
 * Deliberately one long scrolling form rather than a wizard: the team lead
 * usually fills the top half when planning and comes back for the rest, and a
 * wizard makes that revisiting worse. Derived values (status, current stage,
 * responsible person) are shown read-only so it is obvious they are computed.
 */

import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Overlay'
import {
  Button,
  Chip,
  Field,
  Input,
  Label,
  OptionSelect,
  Select,
  StatusChip,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { StageTrack, STATE_LABEL, STATE_TONE } from './pieces'
import type { ContentItem, Member, StageState, Workspace } from '@/lib/types'
import {
  OVERALL_STATUS_TONE,
  currentStage,
  memberName,
  overallStatus,
  responsibleMemberId,
  stageLabel,
  stageState,
  suggestAssignee,
} from '@/lib/derive'
import { addDays, monthKey, today } from '@/lib/date'

export function ContentSheet({
  open,
  onClose,
  item,
  workspace,
  members,
  onSave,
  onDelete,
  canDelete,
  readOnly,
}: {
  open: boolean
  onClose: () => void
  item: ContentItem
  workspace: Workspace
  members: Member[]
  onSave: (patch: Partial<ContentItem>) => void | Promise<void>
  onDelete?: () => void
  canDelete?: boolean
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState<ContentItem>(item)
  const [saving, setSaving] = useState(false)

  // Re-seed when a different item is opened.
  useEffect(() => setDraft(item), [item.id, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const { taxonomies, stages } = workspace
  const activeMembers = useMemo(() => members.filter((m) => m.active), [members])
  const set = <K extends keyof ContentItem>(key: K, value: ContentItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const status = overallStatus(draft, stages)
  const responsible = memberName(members, responsibleMemberId(draft, stages))
  const stage = currentStage(draft, stages)

  /** Back-fills every empty stage deadline from the publish date. */
  const cascadeDeadlines = (publishDate: string) => {
    if (!publishDate) return
    const gap = 2
    const next = { ...draft.stageDeadlines }
    stages.forEach((s, i) => {
      if (!next[s.id]) next[s.id] = addDays(publishDate, -((stages.length - i) * gap))
    })
    setDraft((d) => ({ ...d, stageDeadlines: next }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const platformOptions = taxonomies.platforms.map((p) => p.label)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item.title ? item.title : `New content · ${item.code}`}
      subtitle={`${item.code} · ${stageLabel(draft, stages)}`}
      size="lg"
      footer={
        readOnly ? (
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            {canDelete && onDelete && (
              <Button
                variant="danger"
                icon="trash"
                className="mr-auto"
                onClick={() => {
                  onDelete()
                  onClose()
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-6">
        {/* -------- Derived summary -------- */}
        <div className="rounded-md border border-line/50 bg-sunken/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={OVERALL_STATUS_TONE[status]}>{stageLabel(draft, stages)}</StatusChip>
            <span className="font-mono text-label-micro uppercase text-ink-faint">
              next: {responsible}
              {stage ? ` · ${stage.name}` : ''}
            </span>
          </div>
          <div className="mt-3">
            <StageTrack
              item={draft}
              stages={stages}
              showLabels
              onToggle={
                readOnly
                  ? undefined
                  : (stageId, next) =>
                      setDraft((d) => ({ ...d, stageStates: { ...d.stageStates, [stageId]: next } }))
              }
            />
          </div>
          <p className="mt-2.5 text-body-xs text-ink-faint">
            Status, current stage and responsible person are calculated from the pipeline — tap a segment to advance it.
          </p>
        </div>

        {/* -------- Basics -------- */}
        <Group title="What it is">
          <Field label="Title" className="sm:col-span-2">
            <Input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Product launch teaser"
            />
          </Field>
          <Field label="Topic" hint="short theme">
            <Input value={draft.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Spring release" />
          </Field>
          <Field label="Content type">
            <OptionSelect value={draft.contentType} onChange={(v) => set('contentType', v)} options={taxonomies.contentTypes} placeholder="—" />
          </Field>
          <Field label="Category">
            <OptionSelect value={draft.category} onChange={(v) => set('category', v)} options={taxonomies.categories} placeholder="—" />
          </Field>
          <Field label="Priority">
            <OptionSelect value={draft.priority} onChange={(v) => set('priority', v)} options={taxonomies.priorities} />
          </Field>
          <Field label="Primary platform" hint="performance is tracked here">
            <OptionSelect value={draft.platform} onChange={(v) => set('platform', v)} options={platformOptions} placeholder="—" />
          </Field>
          <div className="sm:col-span-2">
            <Label hint="same asset, extra channels">Also posted to</Label>
            <div className="flex flex-wrap gap-1.5">
              {platformOptions
                .filter((p) => p !== draft.platform)
                .map((p) => {
                  const on = draft.crossPost.includes(p)
                  return (
                    <Chip
                      key={p}
                      active={on}
                      onClick={
                        readOnly
                          ? undefined
                          : () =>
                              set(
                                'crossPost',
                                on ? draft.crossPost.filter((x) => x !== p) : [...draft.crossPost, p],
                              )
                      }
                    >
                      {on && <Icon name="check" size={12} />}
                      {p}
                    </Chip>
                  )
                })}
            </div>
          </div>
        </Group>

        {/* -------- Goal -------- */}
        <Group title="Why it exists">
          <Field label="Objective">
            <OptionSelect value={draft.objective} onChange={(v) => set('objective', v)} options={taxonomies.objectives} placeholder="—" />
          </Field>
          <Field label="Target audience">
            <Input
              value={draft.audience}
              onChange={(e) => set('audience', e.target.value)}
              placeholder="e.g. Evaluating buyers"
              list="flux-audiences"
            />
            <datalist id="flux-audiences">
              {taxonomies.audiences.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
        </Group>

        {/* -------- Schedule -------- */}
        <Group title="Schedule">
          <Field label="Planning month" hint="drives dashboard filters">
            <Input type="month" value={draft.month} onChange={(e) => set('month', e.target.value)} />
          </Field>
          <Field label="Planned publish date">
            <Input
              type="date"
              value={draft.plannedPublishDate}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({ ...d, plannedPublishDate: v, month: v ? monthKey(v) : d.month }))
              }}
              onBlur={(e) => cascadeDeadlines(e.target.value)}
            />
          </Field>
          <Field label="Actual publish date" hint="set when it goes live">
            <Input
              type="date"
              value={draft.actualPublishDate}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({
                  ...d,
                  actualPublishDate: v,
                  lifecycle: v ? 'published' : d.lifecycle === 'published' ? 'active' : d.lifecycle,
                }))
              }}
            />
          </Field>
          <Field label="Lifecycle" hint="only for cases the pipeline cannot express">
            <Select value={draft.lifecycle} onChange={(e) => set('lifecycle', e.target.value as ContentItem['lifecycle'])}>
              <option value="idea">Idea — not started</option>
              <option value="active">Active — in production</option>
              <option value="revision">Revision — sent back</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </Group>

        {/* -------- People & per-stage deadlines -------- */}
        <Group title="Who does what" cols={1}>
          <Field label="Content owner" hint="accountable end to end">
            <Select value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)} placeholder="Unassigned">
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.role}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2">
            <Label hint="assignee and deadline per stage">Pipeline</Label>
            {stages.map((s) => {
              const state = stageState(draft, s.id)
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 gap-2 rounded-md border border-line/50 bg-sunken/40 p-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <div>
                    <span className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-label-micro uppercase text-ink-dim">{s.name}</span>
                      <StatusChip tone={STATE_TONE[state]} dot={false} className="!py-0">
                        {STATE_LABEL[state]}
                      </StatusChip>
                    </span>
                    <Select
                      value={draft.stageAssignees?.[s.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, stageAssignees: { ...d.stageAssignees, [s.id]: e.target.value } }))
                      }
                      placeholder={`Suggested: ${memberName(members, suggestAssignee(members, s))}`}
                    >
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.role}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Deadline</Label>
                    <Input
                      type="date"
                      value={draft.stageDeadlines?.[s.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, stageDeadlines: { ...d.stageDeadlines, [s.id]: e.target.value } }))
                      }
                    />
                  </div>
                  <Select
                    className="sm:w-36"
                    value={state}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        stageStates: { ...d.stageStates, [s.id]: e.target.value as StageState },
                      }))
                    }
                  >
                    {(['pending', 'in_progress', 'complete', 'blocked'] as StageState[]).map((v) => (
                      <option key={v} value={v}>
                        {STATE_LABEL[v]}
                      </option>
                    ))}
                  </Select>
                </div>
              )
            })}
          </div>
        </Group>

        {/* -------- Blockers -------- */}
        <Group title="Where it stands" cols={1}>
          <Field label="Blocker" hint="leave empty when unblocked">
            <Input
              value={draft.blocker}
              onChange={(e) => set('blocker', e.target.value)}
              placeholder="What is stopping this from moving?"
            />
          </Field>
          <Field label="Next action">
            <Input
              value={draft.nextAction}
              onChange={(e) => set('nextAction', e.target.value)}
              placeholder="The single next thing that needs doing"
            />
          </Field>
        </Group>

        {/* -------- Copy -------- */}
        <Group title="Copy" cols={1}>
          <Field label="Caption">
            <Textarea
              value={draft.caption}
              onChange={(e) => set('caption', e.target.value)}
              rows={4}
              placeholder="Caption or on-platform copy"
            />
          </Field>
          <Field label="Hashtags">
            <Input value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#launch #product" />
          </Field>
        </Group>

        {/* -------- Links -------- */}
        <Group title="Links">
          <Field label="Brief / script">
            <Input value={draft.links.brief} onChange={(e) => set('links', { ...draft.links, brief: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Raw assets">
            <Input value={draft.links.raw} onChange={(e) => set('links', { ...draft.links, raw: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Final file">
            <Input value={draft.links.final} onChange={(e) => set('links', { ...draft.links, final: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Published post">
            <Input value={draft.links.published} onChange={(e) => set('links', { ...draft.links, published: e.target.value })} placeholder="https://" />
          </Field>
        </Group>

        <Group title="Notes" cols={1}>
          <Field label="Remarks">
            <Textarea value={draft.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3} />
          </Field>
        </Group>

        {!readOnly && draft.lifecycle !== 'published' && (
          <Button
            variant="ghost"
            icon="send"
            block
            onClick={() =>
              setDraft((d) => {
                const stageStates = { ...d.stageStates }
                for (const s of stages) stageStates[s.id] = 'complete'
                return {
                  ...d,
                  stageStates,
                  lifecycle: 'published',
                  actualPublishDate: d.actualPublishDate || today(),
                  blocker: '',
                }
              })
            }
          >
            Mark everything complete and published
          </Button>
        )}
      </fieldset>
    </Sheet>
  )
}

function Group({
  title,
  children,
  cols = 2,
}: {
  title: string
  children: React.ReactNode
  cols?: 1 | 2
}) {
  return (
    <section>
      <h3 className="mb-2.5 border-b border-white/5 pb-1.5 label-caps">{title}</h3>
      <div className={cx('grid gap-3', cols === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>{children}</div>
    </section>
  )
}
