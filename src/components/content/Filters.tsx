/**
 * Shared content filtering.
 *
 * The spreadsheet relied on per-tab auto-filter dropdowns; here one filter set is
 * reused by the plan, pipeline, publishing and library views so the mental model
 * is identical everywhere.
 */

import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Chip, IconButton, Input, OptionSelect, Select, cx } from '@/components/ui/primitives'
import type { ContentItem, Member, Workspace } from '@/lib/types'
import { OVERALL_STATUS_LABEL, isPublished, overallStatus, type OverallStatus } from '@/lib/derive'
import { monthKey } from '@/lib/date'

export interface ContentFilterState {
  q: string
  platform: string
  contentType: string
  category: string
  priority: string
  status: OverallStatus | ''
  ownerId: string
  scope: 'month' | 'all' | 'open'
}

export const EMPTY_FILTERS: ContentFilterState = {
  q: '',
  platform: '',
  contentType: '',
  category: '',
  priority: '',
  status: '',
  ownerId: '',
  scope: 'month',
}

export function useContentFilters(initial?: Partial<ContentFilterState>) {
  const [filters, setFilters] = useState<ContentFilterState>({ ...EMPTY_FILTERS, ...initial })
  const set = <K extends keyof ContentFilterState>(k: K, v: ContentFilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))
  const reset = () => setFilters({ ...EMPTY_FILTERS, ...initial })
  const activeCount = useMemo(
    () =>
      (['platform', 'contentType', 'category', 'priority', 'status', 'ownerId'] as const).filter((k) => filters[k])
        .length,
    [filters],
  )
  return { filters, set, reset, activeCount }
}

export function applyContentFilters(
  items: ContentItem[],
  filters: ContentFilterState,
  workspace: Workspace,
  month: string,
): ContentItem[] {
  const term = filters.q.trim().toLowerCase()
  return items.filter((c) => {
    if (filters.scope === 'month' && c.month !== month) return false
    if (filters.scope === 'open' && (isPublished(c) || c.lifecycle === 'cancelled')) return false
    if (filters.platform && c.platform !== filters.platform && !c.crossPost.includes(filters.platform)) return false
    if (filters.contentType && c.contentType !== filters.contentType) return false
    if (filters.category && c.category !== filters.category) return false
    if (filters.priority && c.priority !== filters.priority) return false
    if (filters.ownerId && c.ownerId !== filters.ownerId) return false
    if (filters.status && overallStatus(c, workspace.stages) !== filters.status) return false
    if (term) {
      const haystack = [c.code, c.title, c.topic, c.contentType, c.platform, c.category, c.audience, c.remarks]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
}

/** Month keys present in the data, so the scope switch never offers empty months. */
export function contentMonths(items: ContentItem[]): string[] {
  const set = new Set(items.map((c) => c.month || monthKey(c.plannedPublishDate)).filter(Boolean))
  return [...set].sort().reverse()
}

export function ContentFilterBar({
  filters,
  set,
  reset,
  activeCount,
  workspace,
  members,
  resultCount,
  totalCount,
  right,
}: {
  filters: ContentFilterState
  set: <K extends keyof ContentFilterState>(k: K, v: ContentFilterState[K]) => void
  reset: () => void
  activeCount: number
  workspace: Workspace
  members: Member[]
  resultCount: number
  totalCount: number
  right?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const { taxonomies } = workspace

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search title, code, topic…"
            className="pl-9"
          />
        </span>
        <IconButton
          icon="filter"
          label="Filters"
          onClick={() => setExpanded((v) => !v)}
          active={expanded || activeCount > 0}
        />
        {right}
      </div>

      {/* Scope switch is always visible — it is the filter people change most. */}
      <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
        {([
          { id: 'month', label: 'This month' },
          { id: 'open', label: 'Open work' },
          { id: 'all', label: 'Everything' },
        ] as const).map((s) => (
          <Chip key={s.id} active={filters.scope === s.id} onClick={() => set('scope', s.id)}>
            {s.label}
          </Chip>
        ))}
        {activeCount > 0 && (
          <Chip onClick={reset} className="!border-danger/40 !text-danger">
            <Icon name="x" size={12} />
            Clear {activeCount}
          </Chip>
        )}
        <span className="ml-auto shrink-0 whitespace-nowrap pl-2 font-mono text-label-micro uppercase text-ink-faint">
          {resultCount} of {totalCount}
        </span>
      </div>

      {expanded && (
        <div className="grid animate-fade-in gap-2 rounded-md border border-line/50 bg-panel/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <LabeledFilter label="Platform">
            <OptionSelect
              value={filters.platform}
              onChange={(v) => set('platform', v)}
              options={taxonomies.platforms.map((p) => p.label)}
              placeholder="Any platform"
            />
          </LabeledFilter>
          <LabeledFilter label="Content type">
            <OptionSelect
              value={filters.contentType}
              onChange={(v) => set('contentType', v)}
              options={taxonomies.contentTypes}
              placeholder="Any type"
            />
          </LabeledFilter>
          <LabeledFilter label="Category">
            <OptionSelect
              value={filters.category}
              onChange={(v) => set('category', v)}
              options={taxonomies.categories}
              placeholder="Any category"
            />
          </LabeledFilter>
          <LabeledFilter label="Priority">
            <OptionSelect
              value={filters.priority}
              onChange={(v) => set('priority', v)}
              options={taxonomies.priorities}
              placeholder="Any priority"
            />
          </LabeledFilter>
          <LabeledFilter label="Status">
            <Select
              value={filters.status}
              onChange={(e) => set('status', e.target.value as OverallStatus | '')}
              placeholder="Any status"
            >
              {(Object.keys(OVERALL_STATUS_LABEL) as OverallStatus[]).map((k) => (
                <option key={k} value={k}>
                  {OVERALL_STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          </LabeledFilter>
          <LabeledFilter label="Owner">
            <Select value={filters.ownerId} onChange={(e) => set('ownerId', e.target.value)} placeholder="Anyone">
              {members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </LabeledFilter>
        </div>
      )}
    </div>
  )
}

function LabeledFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cx('block')}>
      <span className="mb-1 block label-caps">{label}</span>
      {children}
    </label>
  )
}
