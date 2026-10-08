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

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useConfirm } from '@/components/ui/Overlay'
import { PWAInstallButton } from '@/components/ui/PWAInstallButton'
import { usePWAInstall } from '@/lib/usePWAInstall'
import {
  DEFAULT_OLLAMA_ENDPOINT,
  OllamaModelInfo,
  loadOllamaConfig,
  saveOllamaConfig,
  testOllamaConnection,
} from '@/lib/ollama'
import { useStore } from '@/state/store'
import type { AccessLevel, PlatformDef, ProductionFormat, Stage, Taxonomies } from '@/lib/types'
import { uid } from '@/lib/factories'
import { PIPELINE_TEMPLATES } from '@/lib/templates'
import {
  PRODUCTION_FORMATS,
  WORKFLOW_PRESETS,
  getAllSubCategories,
  getPresetById,
} from '@/lib/productionFormats'
import {
  PIPELINE_SECTIONS,
  getAllModuleIds,
  isModuleActive,
  reconfigureWorkspaceWorkflow,
  type PipelineSectionDef,
} from '@/lib/pipelineModules'
import { APP_NAME } from '@/brand'

type Tab = 'workspace' | 'pipeline' | 'workflow' | 'lists' | 'access' | 'data' | 'desktop'

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
          { id: 'workflow', label: 'Content & Workflow' },
          { id: 'lists', label: 'Dropdowns' },
          { id: 'access', label: 'Access' },
          { id: 'data', label: 'Data' },
          { id: 'desktop', label: 'Desktop & Ollama' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'workspace' && <WorkspaceTab onNavigateTab={(t) => setTab(t)} />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'workflow' && <WorkflowTab />}
      {tab === 'lists' && <ListsTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'desktop' && <DesktopTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function WorkspaceTab({ onNavigateTab }: { onNavigateTab?: (t: Tab) => void }) {
  const { data, canManage, updateWorkspace, notify } = useStore()
  const [name, setName] = useState(data?.workspace.name ?? '')
  const [initials, setInitials] = useState(data?.workspace.initials ?? '')
  const [prefix, setPrefix] = useState(data?.workspace.contentPrefix ?? 'CN')
  if (!data) return null
  const { workspace } = data

  const enabledFormats = workspace.enabledFormats && workspace.enabledFormats.length > 0
    ? workspace.enabledFormats
    : (['static', 'video', 'written', 'brief'] as ProductionFormat[])

  const enabledSubCategories = workspace.enabledSubCategories && workspace.enabledSubCategories.length > 0
    ? workspace.enabledSubCategories
    : getAllSubCategories()

  const dirty =
    name !== workspace.name || initials !== workspace.initials || prefix !== workspace.contentPrefix

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader label="Identity" title="Workspace" />
        <div className="space-y-3 p-widget">
          <Field label="Workspace Name">
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

      <Card className="lg:col-span-2">
        <CardHeader
          label="Workflow"
          title="Content Segments & Fields"
          action={
            onNavigateTab ? (
              <Button
                size="sm"
                variant="quiet"
                icon="sliders"
                onClick={() => onNavigateTab('workflow')}
              >
                Customize workflow
              </Button>
            ) : undefined
          }
        />
        <div className="space-y-3 p-widget">
          <div className="flex flex-col gap-3 rounded-md border border-line/50 bg-sunken/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-body-sm text-ink font-medium">
                Active Segments: {enabledFormats.map((f) => f.toUpperCase()).join(' · ')}
              </span>
              <span className="block text-body-xs text-ink-dim">
                {enabledFormats.length} of 4 content segments active ({enabledSubCategories.length} subcategory fields enabled).
                Hiding unused segments streamlines the New Content form.
              </span>
            </div>
            {onNavigateTab && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onNavigateTab('workflow')}
              >
                Manage Segments
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader label="Appearance" title="Theme mode" />
        <div className="space-y-3 p-widget">
          <div className="flex flex-col gap-3 rounded-md border border-line/50 bg-sunken/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-body-sm text-ink font-medium">Interface theme</span>
              <span className="block text-body-xs text-ink-faint">
                Switch between Obsidian dark theme and clean high-contrast light theme.
              </span>
            </div>
            <ThemeToggle variant="segmented" />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline & Module Configurator
// ---------------------------------------------------------------------------

function PipelineModulesConfigurator({
  onStagesUpdated,
}: {
  onStagesUpdated?: (stages: Stage[]) => void
}) {
  const { data, canManage, updateWorkspace, notify } = useStore()
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  if (!data) return null
  const { workspace } = data

  const currentModuleIds = useMemo(() => {
    if (workspace.enabledModules && workspace.enabledModules.length > 0) {
      return new Set(workspace.enabledModules)
    }
    const set = new Set<string>()
    for (const section of PIPELINE_SECTIONS) {
      for (const mod of section.modules) {
        if (isModuleActive(workspace, mod.id)) {
          set.add(mod.id)
        }
      }
    }
    return set
  }, [workspace])

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const handleToggleModule = async (moduleId: string) => {
    if (!canManage) return
    const nextSet = new Set(currentModuleIds)
    if (nextSet.has(moduleId)) {
      if (nextSet.size === 1) {
        notify('Keep at least one module enabled in your workspace', 'danger')
        return
      }
      nextSet.delete(moduleId)
    } else {
      nextSet.add(moduleId)
    }

    const patch = reconfigureWorkspaceWorkflow(workspace, Array.from(nextSet))
    await updateWorkspace(patch)
    if (patch.stages && onStagesUpdated) {
      onStagesUpdated(patch.stages)
    }
    notify('Pipeline module updated', 'success')
  }

  const handleToggleEntirePipeline = async (section: PipelineSectionDef) => {
    if (!canManage) return
    const sectionModuleIds = section.modules.map((m) => m.id)
    const isSectionActive = sectionModuleIds.some((id) => currentModuleIds.has(id))

    const nextSet = new Set(currentModuleIds)
    if (isSectionActive) {
      const remainingCount = Array.from(nextSet).filter(
        (id) => !sectionModuleIds.includes(id),
      ).length
      if (remainingCount === 0) {
        notify('Keep at least one pipeline active in your workspace', 'danger')
        return
      }
      for (const id of sectionModuleIds) {
        nextSet.delete(id)
      }
    } else {
      for (const id of sectionModuleIds) {
        nextSet.add(id)
      }
    }

    const patch = reconfigureWorkspaceWorkflow(workspace, Array.from(nextSet))
    await updateWorkspace(patch)
    if (patch.stages && onStagesUpdated) {
      onStagesUpdated(patch.stages)
    }
    notify(
      isSectionActive ? `Disabled ${section.name}` : `Enabled ${section.name}`,
      'success',
    )
  }

  const handleSetSectionModules = async (section: PipelineSectionDef, enableAll: boolean) => {
    if (!canManage) return
    const sectionModuleIds = section.modules.map((m) => m.id)
    const nextSet = new Set(currentModuleIds)

    if (enableAll) {
      for (const id of sectionModuleIds) nextSet.add(id)
    } else {
      const remainingCount = Array.from(nextSet).filter(
        (id) => !sectionModuleIds.includes(id),
      ).length
      if (remainingCount === 0) {
        notify('Keep at least one module enabled in the workspace', 'danger')
        return
      }
      for (const id of sectionModuleIds) nextSet.delete(id)
    }

    const patch = reconfigureWorkspaceWorkflow(workspace, Array.from(nextSet))
    await updateWorkspace(patch)
    if (patch.stages && onStagesUpdated) {
      onStagesUpdated(patch.stages)
    }
    notify(`${section.name} modules updated`, 'success')
  }

  const handleApplyPreset = async (presetId: 'all' | 'video' | 'design' | 'written') => {
    if (!canManage) return
    let targetModules: string[] = []

    if (presetId === 'all') {
      targetModules = getAllModuleIds()
    } else if (presetId === 'video') {
      const videoMods = PIPELINE_SECTIONS.find((s) => s.id === 'video')?.modules.map((m) => m.id) || []
      targetModules = [...videoMods, 'design_thumbnails']
    } else if (presetId === 'design') {
      targetModules = PIPELINE_SECTIONS.find((s) => s.id === 'design')?.modules.map((m) => m.id) || []
    } else if (presetId === 'written') {
      targetModules = PIPELINE_SECTIONS.find((s) => s.id === 'written')?.modules.map((m) => m.id) || []
    }

    const patch = reconfigureWorkspaceWorkflow(workspace, targetModules, [presetId === 'all' ? 'video' : presetId])
    await updateWorkspace(patch)
    if (patch.stages && onStagesUpdated) {
      onStagesUpdated(patch.stages)
    }
    notify('Applied workflow preset', 'success')
  }

  const totalModules = getAllModuleIds().length
  const activeCount = currentModuleIds.size

  return (
    <Card>
      <CardHeader
        label="Pipeline Configuration"
        title="Active Pipelines & Modules"
        action={
          canManage ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon="sparkle"
                onClick={() => void handleApplyPreset('all')}
              >
                Enable All
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="space-y-4 p-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <p className="text-body-sm text-ink-dim max-w-2xl leading-relaxed">
            Re-configure your active workspace pipelines at any time by checking or unchecking specific modules.
            The <strong>New Content</strong> form, Kanban pipeline columns, and filters dynamically adapt to these settings.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-label-micro font-bold text-primary">
              {activeCount} of {totalModules} Modules Active
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-label-micro font-bold text-emerald-600 dark:text-emerald-400">
              ● Persistent
            </span>
          </div>
        </div>

        {/* Quick Presets */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line/40">
            <span className="font-mono text-label-micro uppercase font-bold text-ink-faint">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => void handleApplyPreset('all')}
              className="rounded-md border border-line/60 bg-sunken/60 px-2.5 py-1 text-label-micro font-semibold text-ink hover:border-primary hover:bg-accent/15 transition-all"
            >
              ⚡ Full Suite (All Modules)
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset('video')}
              className="rounded-md border border-line/60 bg-sunken/60 px-2.5 py-1 text-label-micro font-semibold text-ink hover:border-primary hover:bg-accent/15 transition-all"
            >
              🎬 Video Focus (+ Thumbnails)
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset('design')}
              className="rounded-md border border-line/60 bg-sunken/60 px-2.5 py-1 text-label-micro font-semibold text-ink hover:border-primary hover:bg-accent/15 transition-all"
            >
              🎨 Graphics &amp; Design Focus
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPreset('written')}
              className="rounded-md border border-line/60 bg-sunken/60 px-2.5 py-1 text-label-micro font-semibold text-ink hover:border-primary hover:bg-accent/15 transition-all"
            >
              ✍️ Editorial Focus
            </button>
          </div>
        )}

        {/* Pipelines & Modules Checklists */}
        <div className="space-y-3.5 pt-1">
          {PIPELINE_SECTIONS.map((section) => {
            const sectionModuleIds = section.modules.map((m) => m.id)
            const activeCountInSection = sectionModuleIds.filter((id) =>
              currentModuleIds.has(id),
            ).length
            const isSectionActive = activeCountInSection > 0
            const isCollapsed = collapsedSections[section.id] ?? false

            return (
              <div
                key={section.id}
                className={cx(
                  'rounded-lg border transition-all',
                  isSectionActive
                    ? 'border-line/80 bg-raised shadow-xs'
                    : 'border-line/40 bg-sunken/30 opacity-70',
                )}
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-4 border-b border-line/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSectionActive}
                        disabled={!canManage}
                        onChange={() => void handleToggleEntirePipeline(section)}
                        className="h-4 w-4 rounded border-line text-primary focus:ring-accent"
                      />
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/20 text-primary shrink-0">
                        <Icon name={section.icon} size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-body-sm font-bold text-ink truncate">
                            {section.name}
                          </span>
                          <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-label-micro text-ink-dim">
                            {section.label}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-label-micro font-medium',
                        isSectionActive
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'bg-sunken text-ink-faint',
                      )}
                    >
                      {activeCountInSection} of {section.modules.length} active
                    </span>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleSetSectionModules(section, true)}
                          className="rounded px-2 py-0.5 text-label-micro font-medium text-ink-dim hover:text-primary hover:bg-sunken"
                          title="Enable all modules in this pipeline"
                        >
                          All
                        </button>
                        <span className="text-line">|</span>
                        <button
                          type="button"
                          onClick={() => void handleSetSectionModules(section, false)}
                          className="rounded px-2 py-0.5 text-label-micro font-medium text-ink-dim hover:text-danger hover:bg-sunken"
                          title="Deselect modules in this pipeline"
                        >
                          None
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleSectionCollapse(section.id)}
                      className="rounded p-1 text-ink-faint hover:text-ink hover:bg-sunken"
                      aria-label={isCollapsed ? 'Expand modules' : 'Collapse modules'}
                    >
                      <Icon
                        name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={14}
                      />
                    </button>
                  </div>
                </div>

                {/* Modules Grid */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 bg-sunken/20">
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {section.modules.map((mod) => {
                        const isChecked = currentModuleIds.has(mod.id)
                        return (
                          <label
                            key={mod.id}
                            className={cx(
                              'relative flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer select-none',
                              isChecked
                                ? 'border-primary/50 bg-raised shadow-xs'
                                : 'border-line/40 bg-sunken/50 opacity-60 hover:opacity-100',
                              !canManage && 'pointer-events-none',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canManage}
                              onChange={() => void handleToggleModule(mod.id)}
                              className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-accent shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={cx(
                                    'text-body-xs font-semibold leading-snug',
                                    isChecked ? 'text-ink' : 'text-ink-dim',
                                  )}
                                >
                                  {mod.name}
                                </span>
                                {mod.subCategory && (
                                  <span className="rounded bg-accent/15 px-1 py-0.2 font-mono text-label-micro text-primary shrink-0">
                                    Sub-format
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-label-micro text-ink-dim leading-snug line-clamp-2">
                                {mod.blurb}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Live Diagnostics & Merged Flow */}
        <div className="rounded-lg border border-line/70 bg-sunken/60 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-body-xs font-bold text-ink">
              <span className="text-primary font-bold">🔀</span>
              Active Merged Workflow Sequence ({workspace.stages.length} stages)
            </span>
            <span className="font-mono text-label-micro text-ink-dim">
              Pipelines: {workspace.selectedPipelines?.join(' + ') || 'video'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-label-micro">
            {workspace.stages.map((st, idx) => (
              <span key={st.id} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-ink-faint">→</span>}
                <span className="rounded border border-line/60 bg-raised px-2 py-0.5 text-ink font-medium">
                  {st.name}
                </span>
              </span>
            ))}
          </div>

          <p className="text-label-micro text-ink-dim pt-1 border-t border-line/40">
            💡 Checking or unchecking modules persistently configures the options visible when creating items in the <strong>New Content</strong> form, updates the Kanban columns, and filters out unselected fields.
          </p>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function PipelineTab() {
  const { data, canManage, setStages, mergeAndApplyPipelines, getMergedPipelinePreview, notify } = useStore()
  const [stages, setLocal] = useState<Stage[]>(data?.workspace.stages ?? [])
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>(
    data?.workspace.selectedPipelines?.length ? data.workspace.selectedPipelines : ['video'],
  )
  const [syncTaxonomies, setSyncTaxonomies] = useState(true)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()
  if (!data) return null

  const { workspace, content } = data
  const roles = workspace.taxonomies.roles.map((r) => r.label)
  const dirty = JSON.stringify(stages) !== JSON.stringify(workspace.stages)
  const mergeReport = useMemo(() => getMergedPipelinePreview(selectedPipelines), [getMergedPipelinePreview, selectedPipelines])

  const togglePipeline = (id: string) => {
    if (selectedPipelines.includes(id)) {
      if (selectedPipelines.length === 1) {
        notify('Keep at least one pipeline selected', 'danger')
        return
      }
      setSelectedPipelines(selectedPipelines.filter((p) => p !== id))
    } else {
      setSelectedPipelines([...selectedPipelines, id])
    }
  }

  const applyMerged = () => {
    const isMultiple = selectedPipelines.length > 1
    const pNames = selectedPipelines
      .map((id) => PIPELINE_TEMPLATES.find((t) => t.id === id)?.name || id)
      .join(' + ')
    const stageNames = mergeReport.stages.map((s) => s.name).join(' → ')
    const repeatsText = mergeReport.repeatedStages.length
      ? ` Repeating stages (${mergeReport.repeatedStages.map((r) => r.name).join(', ')}) will merge into 1 and duplicate features are removed.`
      : ''

    confirm.ask({
      title: isMultiple ? `Apply Merged Pipeline (${pNames})?` : `Apply “${pNames}” Pipeline?`,
      body: `The workspace pipeline will become ${mergeReport.stages.length} stages: ${stageNames}.${repeatsText} Existing content retains progress on stages that carry over.`,
      confirmLabel: isMultiple ? 'Apply merged pipeline' : 'Apply pipeline',
      danger: true,
      onConfirm: async () => {
        const report = await mergeAndApplyPipelines(selectedPipelines, { syncTaxonomies })
        setLocal(
          report.stages.map((s) => ({
            id: s.id || uid('st_'),
            name: s.name,
            ownerRole: s.ownerRole,
            verb: s.verb,
            pipelineId: s.sourcePipelineIds[0],
          })),
        )
      },
    })
  }

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
      await setStages(stages, selectedPipelines)
      notify('Pipeline updated', 'success')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Active Pipelines & Modular Components Configurator */}
      <PipelineModulesConfigurator onStagesUpdated={(newStages) => setLocal(newStages)} />

      <Card>
        <CardHeader
          label="Production pipeline"
          title={`${stages.length} stages`}
          action={
            canManage && dirty ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setLocal(workspace.stages)}>
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
          <CardHeader
            label="Production Pipelines & Multi-Selection"
            title="Configure and merge production pipelines"
            action={
              <Button
                size="sm"
                variant="primary"
                icon="sparkle"
                onClick={applyMerged}
              >
                {selectedPipelines.length > 1
                  ? `Apply Merged (${mergeReport.stages.length} Stages)`
                  : `Apply (${mergeReport.stages.length} Stages)`}
              </Button>
            }
          />
          <div className="space-y-4 p-widget">
            <p className="text-body-xs text-ink-dim leading-relaxed">
              Agencies and multi-format creators can select <strong>multiple production pipelines</strong> (e.g. Video Production + Design &amp; Graphics). When more than one pipeline is selected, features merge into one unified workflow: stages that repeat across pipelines (such as <strong>Review</strong> or <strong>Brief</strong>) merge into a single shared stage, and duplicate/redundant stages are removed.
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE_TEMPLATES.map((t) => {
                const isSelected = selectedPipelines.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => togglePipeline(t.id)}
                    className={cx(
                      'relative rounded-lg border p-3.5 text-left transition-all',
                      isSelected
                        ? 'border-primary/70 bg-accent/15 ring-1 ring-primary/40 shadow-sm'
                        : 'border-line/50 bg-sunken/40 hover:border-line hover:bg-sunken/70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="block text-body-sm font-bold text-ink">{t.name}</span>
                        <span className="mt-1 block text-body-xs text-ink-dim leading-relaxed">{t.blurb}</span>
                      </div>
                      <span
                        className={cx(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-line/80 bg-raised/80 text-transparent',
                        )}
                      >
                        <Icon name="check" size={13} />
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1 font-mono text-label-micro text-ink-faint">
                      {t.stages.map((s, idx) => (
                        <span key={s.name} className="flex items-center gap-1">
                          {idx > 0 && <span className="opacity-40">→</span>}
                          <span>{s.name}</span>
                        </span>
                      ))}
                    </div>

                    {t.contentTypes && (
                      <div className="mt-2 text-label-micro text-ink-faint">
                        Formats: {t.contentTypes.join(', ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Merge Analysis & Flow Diagnostics */}
            <div className="rounded-lg border border-line/70 bg-sunken/50 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/25 text-primary text-body-xs font-bold">
                    {selectedPipelines.length > 1 ? '🔀' : '⚡'}
                  </span>
                  <div>
                    <h4 className="text-body-sm font-bold text-ink">
                      {selectedPipelines.length > 1
                        ? `Merged Pipeline Analysis: ${selectedPipelines.length} Pipelines Combined`
                        : `Selected Pipeline: ${mergeReport.selectedPipelines[0]?.name}`}
                    </h4>
                    <span className="text-body-xs text-ink-dim">
                      Resulting workflow contains {mergeReport.stages.length} stages in production order
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-body-xs text-ink-dim cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncTaxonomies}
                      onChange={(e) => setSyncTaxonomies(e.target.checked)}
                      className="rounded border-line text-primary focus:ring-accent"
                    />
                    <span>Sync content formats &amp; roles</span>
                  </label>
                </div>
              </div>

              {selectedPipelines.length > 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-line/50 bg-raised/60 p-3">
                    <span className="block text-body-xs font-bold text-ink mb-1.5 flex items-center gap-1.5">
                      <span className="text-primary font-bold">🔁</span> Merged Repeating Features ({mergeReport.repeatedStages.length})
                    </span>
                    {mergeReport.repeatedStages.length > 0 ? (
                      <ul className="space-y-1 text-body-xs text-ink-dim">
                        {mergeReport.repeatedStages.map((r) => (
                          <li key={r.name} className="flex items-start gap-1.5">
                            <Icon name="check" size={12} className="text-primary mt-1 shrink-0" />
                            <span>
                              <strong className="text-ink font-semibold">{r.name}</strong>: Repeated in {r.sources.join(' & ')} · merged into 1 shared stage.
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-body-xs text-ink-faint">No overlapping stage names between these pipelines.</p>
                    )}

                    {mergeReport.removedDuplicates.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-line/40">
                        <span className="block text-label-micro font-bold text-ink-dim uppercase mb-1">
                          Duplicate instances removed:
                        </span>
                        <div className="flex flex-wrap gap-1 text-body-xs text-ink-faint">
                          {mergeReport.removedDuplicates.map((d, i) => (
                            <span key={i} className="line-through decoration-danger/60">
                              {d.name} ({d.fromPipeline})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-line/50 bg-raised/60 p-3">
                    <span className="block text-body-xs font-bold text-ink mb-1.5 flex items-center gap-1.5">
                      <span className="text-emerald-500 font-bold">✨</span> Specialized Features Contributed ({mergeReport.uniqueStages.length})
                    </span>
                    <ul className="space-y-1 text-body-xs text-ink-dim">
                      {mergeReport.uniqueStages.map((u) => (
                        <li key={u.name} className="flex items-start gap-1.5">
                          <span className="text-ink-faint mt-0.5">•</span>
                          <span>
                            <strong className="text-ink font-medium">{u.name}</strong>: from {u.fromPipeline}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Visual resulting stage track */}
              <div>
                <span className="block text-label-micro font-bold text-ink-dim uppercase mb-2">
                  Unified Stage Sequence:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-label-micro">
                  {mergeReport.stages.map((s, idx) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="text-ink-faint">→</span>}
                      <span
                        className={cx(
                          'rounded px-2.5 py-1 border text-body-xs',
                          s.isRepeated
                            ? 'border-primary/60 bg-accent/20 text-primary font-bold shadow-xs'
                            : 'border-line/70 bg-raised text-ink',
                        )}
                        title={
                          s.isRepeated
                            ? `Merged from: ${s.sourcePipelineNames.join(', ')}`
                            : `From: ${s.sourcePipelineNames.join(', ')}`
                        }
                      >
                        {s.name}
                        {s.isRepeated && (
                          <span className="ml-1 text-label-micro opacity-80" title="Consolidated repeating feature">
                            🔁
                          </span>
                        )}
                        <span className="ml-1.5 font-sans text-label-micro text-ink-dim opacity-70">
                          ({s.ownerRole})
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <span className="text-body-xs text-ink-faint">
                  Clicking "Apply" replaces the stages above with this merged sequence while safeguarding existing content progress.
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  icon="sparkle"
                  onClick={applyMerged}
                >
                  {selectedPipelines.length > 1 ? 'Apply Merged Pipeline' : 'Apply Pipeline'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      {confirm.element}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content & Workflow Segments
// ---------------------------------------------------------------------------

function WorkflowTab() {
  const { data, canManage, updateWorkspace, notify } = useStore()
  if (!data) return null
  const { workspace } = data

  const allFormats: ProductionFormat[] = ['static', 'video', 'written', 'brief']
  const enabledFormats = workspace.enabledFormats && workspace.enabledFormats.length > 0
    ? workspace.enabledFormats
    : allFormats

  const allSubCategories = getAllSubCategories()
  const enabledSubCategories = workspace.enabledSubCategories && workspace.enabledSubCategories.length > 0
    ? workspace.enabledSubCategories
    : allSubCategories

  const handleToggleFormat = async (fmt: ProductionFormat) => {
    if (!canManage) return
    let nextFormats: ProductionFormat[]
    let nextSubs = [...enabledSubCategories]
    const def = PRODUCTION_FORMATS.find((f) => f.id === fmt)

    if (enabledFormats.includes(fmt)) {
      if (enabledFormats.length === 1) {
        notify('At least one content segment must remain active', 'danger')
        return
      }
      nextFormats = enabledFormats.filter((f) => f !== fmt)
      if (def) {
        nextSubs = nextSubs.filter((sc) => !def.subCategories.includes(sc))
      }
    } else {
      nextFormats = [...enabledFormats, fmt]
      if (def) {
        nextSubs = Array.from(new Set([...nextSubs, ...def.subCategories]))
      }
    }

    await updateWorkspace({
      enabledFormats: nextFormats,
      enabledSubCategories: nextSubs,
      workflowPreset: 'custom',
    })
    notify('Content formats updated', 'success')
  }

  const handleToggleSubCategory = async (subCat: string) => {
    if (!canManage) return
    let nextSubs: string[]
    if (enabledSubCategories.includes(subCat)) {
      if (enabledSubCategories.length === 1) {
        notify('At least one subcategory must remain enabled', 'danger')
        return
      }
      nextSubs = enabledSubCategories.filter((sc) => sc !== subCat)
    } else {
      nextSubs = [...enabledSubCategories, subCat]
    }

    await updateWorkspace({
      enabledSubCategories: nextSubs,
      workflowPreset: 'custom',
    })
  }

  const handleApplyPreset = async (presetId: string) => {
    if (!canManage) return
    const preset = getPresetById(presetId)
    await updateWorkspace({
      enabledFormats: [...preset.formats],
      enabledSubCategories: [...preset.subCategories],
      workflowPreset: presetId,
    })
    notify(`Applied ${preset.name}`, 'success')
  }

  const handleEnableAll = async () => {
    if (!canManage) return
    await updateWorkspace({
      enabledFormats: allFormats,
      enabledSubCategories: allSubCategories,
      workflowPreset: 'all',
    })
    notify('All content formats and fields enabled', 'success')
  }

  return (
    <div className="space-y-4">
      {/* Overview & Quick Presets */}
      <Card>
        <CardHeader
          label="Workflow Presets"
          title="Content Segments & Fields"
          action={
            canManage ? (
              <Button size="sm" variant="ghost" icon="sparkle" onClick={() => void handleEnableAll()}>
                Enable All Fields
              </Button>
            ) : undefined
          }
        />
        <div className="space-y-4 p-widget">
          <p className="text-body-sm text-ink-dim">
            Control which content segments and subcategory fields appear in the <strong>New Content</strong> form.
            Whenever someone creates content, they will only see the options kept here. You can always get back here and add options as you need.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_PRESETS.map((p) => {
              const isCurrent = workspace.workflowPreset === p.id
              return (
                <div
                  key={p.id}
                  className={cx(
                    'rounded-lg border p-3 flex flex-col justify-between transition-all',
                    isCurrent
                      ? 'border-primary/80 bg-accent/15 ring-1 ring-primary/40'
                      : 'border-line/60 bg-sunken/40',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-body-xs font-bold text-ink">{p.name}</span>
                      {isCurrent && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-label-micro font-bold text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-label-micro text-ink-dim leading-snug">{p.tagline}</p>
                  </div>
                  {canManage && !isCurrent && (
                    <Button
                      size="sm"
                      variant="quiet"
                      className="mt-3 w-full text-label-micro"
                      onClick={() => void handleApplyPreset(p.id)}
                    >
                      Apply preset
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Granular Segment & Subcategory Toggles */}
      <div className="grid gap-4 lg:grid-cols-2">
        {PRODUCTION_FORMATS.map((fmt) => {
          const isEnabled = enabledFormats.includes(fmt.id)
          const activeSubs = fmt.subCategories.filter((sc) => enabledSubCategories.includes(sc))

          return (
            <Card key={fmt.id} className={cx(!isEnabled && 'opacity-70')}>
              <CardHeader
                label={`Format · ${activeSubs.length} of ${fmt.subCategories.length} options active`}
                title={fmt.label}
                action={
                  canManage ? (
                    <Toggle
                      checked={isEnabled}
                      onChange={() => void handleToggleFormat(fmt.id)}
                      label={`Enable ${fmt.label}`}
                    />
                  ) : undefined
                }
              />
              <div className="space-y-3 p-widget">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-accent/25 text-primary">
                    <Icon name={fmt.icon} size={15} />
                  </span>
                  <div>
                    <span className="block text-body-xs font-semibold text-ink">{fmt.tagline}</span>
                    <span className="text-label-micro text-ink-dim">{fmt.description}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-line/40">
                  <span className="block text-label-micro font-bold text-ink-faint uppercase mb-1.5">
                    Subcategories & Fields ({activeSubs.length} active):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {fmt.subCategories.map((subCat) => {
                      const isSubActive = isEnabled && enabledSubCategories.includes(subCat)
                      return (
                        <button
                          key={subCat}
                          type="button"
                          disabled={!canManage || !isEnabled}
                          onClick={() => void handleToggleSubCategory(subCat)}
                          className={cx(
                            'rounded-md px-2 py-1 text-body-xs transition-all flex items-center gap-1.5',
                            isSubActive
                              ? 'border border-primary/50 bg-primary/10 text-primary font-medium'
                              : 'border border-line/50 bg-sunken/60 text-ink-faint line-through opacity-60 hover:opacity-100',
                            (!canManage || !isEnabled) && 'cursor-default',
                          )}
                          title={isSubActive ? 'Click to disable' : 'Click to enable'}
                        >
                          <span
                            className={cx(
                              'h-1.5 w-1.5 rounded-full',
                              isSubActive ? 'bg-primary' : 'bg-ink-faint',
                            )}
                          />
                          <span>{subCat}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Modular Pipeline & Feature Configuration */}
      <PipelineModulesConfigurator />
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
                <Button size="sm" variant="ghost" icon="refresh" onClick={() => void regenerateJoinCode()}>
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

// ---------------------------------------------------------------------------
// Desktop & Local Ollama Tab
// ---------------------------------------------------------------------------

function DesktopTab() {
  const { notify } = useStore()
  const navigate = useNavigate()
  const { isInstalled } = usePWAInstall()

  const [ollamaConfig, setOllamaConfig] = useState(loadOllamaConfig)
  const [endpoint, setEndpoint] = useState(ollamaConfig.endpoint)
  const [temp, setTemp] = useState(ollamaConfig.temperature)
  const [models, setModels] = useState<OllamaModelInfo[]>([])
  const [status, setStatus] = useState<'testing' | 'connected' | 'disconnected'>('testing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    void checkConnection()
  }, [])

  const checkConnection = async () => {
    setStatus('testing')
    setErrorMsg(null)
    const res = await testOllamaConnection(endpoint)
    if (res.connected) {
      setStatus('connected')
      setModels(res.models)
      if (res.models.length > 0 && !res.models.some((m) => m.name === ollamaConfig.selectedModel)) {
        const next = saveOllamaConfig({ selectedModel: res.models[0].name })
        setOllamaConfig(next)
      }
    } else {
      setStatus('disconnected')
      setErrorMsg(res.error || 'Failed to connect')
    }
  }

  const handleSaveOllama = () => {
    const next = saveOllamaConfig({
      endpoint: endpoint.trim() || DEFAULT_OLLAMA_ENDPOINT,
      temperature: temp,
    })
    setOllamaConfig(next)
    notify('Ollama settings saved', 'success')
    void checkConnection()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Desktop App Installation & PWA */}
      <Card>
        <CardHeader
          label="Desktop Application"
          title={isInstalled ? 'Standalone Desktop App (Installed)' : 'Install FLUX for Desktop'}
        />
        <div className="space-y-4 p-widget">
          <div className="flex items-center gap-3.5 rounded-lg border border-line/40 bg-sunken/40 p-3">
            <img
              src="/pwa-192x192.png"
              alt="FLUX Desktop App Icon"
              className="h-11 w-11 rounded-xl shadow-md border border-line/40 shrink-0 bg-void"
            />
            <div className="min-w-0 flex-1 text-body-xs">
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    isInstalled ? 'bg-emerald animate-pulse' : 'bg-primary'
                  )}
                />
                <span className="font-semibold text-ink">
                  {isInstalled ? 'Running in Standalone Window' : 'Running in Web Browser'}
                </span>
              </div>
              <span className="text-ink-dim block mt-0.5">
                {isInstalled
                  ? 'FLUX is running as a local Mac application.'
                  : 'Install FLUX to launch it directly from your Mac Dock.'}
              </span>
            </div>
            {!isInstalled && (
              <PWAInstallButton size="sm" variant="primary" label="Install App" />
            )}
          </div>

          <div className="space-y-2 text-body-xs text-ink-dim">
            <h4 className="font-semibold text-ink">Desktop Features & Local Advantages</h4>
            <ul className="space-y-1.5 list-disc list-inside">
              <li><strong className="text-ink">100% Private Offline Storage:</strong> Workspace data is stored locally in IndexedDB.</li>
              <li><strong className="text-ink">Direct Ollama Integration:</strong> Connects to your local AI daemon (<code className="text-primary font-mono">localhost:11434</code>).</li>
              <li><strong className="text-ink">Fast Keyboard Navigation:</strong> Press <kbd className="rounded border border-line/60 bg-panel px-1 font-mono text-[10px]">⌘K</kbd> / <kbd className="rounded border border-line/60 bg-panel px-1 font-mono text-[10px]">Ctrl+K</kbd> anywhere.</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <a
              href="/flux-desktop-local.zip"
              download="flux-desktop-local.zip"
              className="inline-flex"
            >
              <Button icon="download" variant="ghost">
                Download Mac/Local Package (.zip)
              </Button>
            </a>
            <Button
              icon="sparkle"
              variant="ghost"
              onClick={() => navigate('/reports')}
            >
              Open AI Reports & Summaries
            </Button>
          </div>
        </div>
      </Card>

      {/* Ollama Local LLM Configuration */}
      <Card>
        <CardHeader label="Local LLM" title="Ollama Daemon Configuration" />
        <div className="space-y-4 p-widget">
          {/* Status badge */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-line/40 bg-sunken/40 p-3 text-body-xs">
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'h-2.5 w-2.5 rounded-full',
                  status === 'connected'
                    ? 'bg-emerald animate-pulse'
                    : status === 'testing'
                    ? 'bg-amber animate-ping'
                    : 'bg-danger'
                )}
              />
              <span className="font-semibold text-ink">
                {status === 'connected'
                  ? `Connected (${models.length} model${models.length === 1 ? '' : 's'} available)`
                  : status === 'testing'
                  ? 'Connecting to daemon...'
                  : 'Disconnected / Offline'}
              </span>
            </div>
            <Button size="sm" variant="quiet" icon="refresh" onClick={() => void checkConnection()}>
              Test
            </Button>
          </div>

          {errorMsg && (
            <div className="rounded bg-danger/10 border border-danger/30 p-2.5 text-body-xs text-danger">
              {errorMsg}
            </div>
          )}

          <Field label="Ollama Server URL" hint="Default local address: http://localhost:11434">
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:11434"
              className="font-mono text-body-sm"
            />
          </Field>

          <Field label="Default Model for Reports">
            <Select
              value={ollamaConfig.selectedModel}
              onChange={(e) => {
                const next = saveOllamaConfig({ selectedModel: e.target.value })
                setOllamaConfig(next)
              }}
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} {m.parameterSize ? `(${m.parameterSize})` : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value="llama3.2:latest">llama3.2:latest</option>
                  <option value="llama3.1:8b">llama3.1:8b</option>
                  <option value="mistral:latest">mistral:latest</option>
                  <option value="gemma2:9b">gemma2:9b</option>
                  <option value="qwen2.5:7b">qwen2.5:7b</option>
                  <option value="deepseek-r1:8b">deepseek-r1:8b</option>
                </>
              )}
            </Select>
          </Field>

          <Field label={`Model Temperature / Creativity: ${temp}`}>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-label-micro text-ink-faint font-mono">
              <span>0.0 (Precise / Structured)</span>
              <span>1.0 (Creative)</span>
            </div>
          </Field>

          <div className="rounded-md border border-line/40 bg-sunken/40 p-3 text-body-xs space-y-1.5">
            <div className="font-semibold text-ink">Enable Browser CORS on Ollama</div>
            <div className="text-ink-dim">
              Set the environment variable when launching Ollama:
            </div>
            <code className="block rounded bg-panel p-2 font-mono text-label-micro text-emerald selection:bg-primary/20">
              OLLAMA_ORIGINS="*" ollama serve
            </code>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="primary" onClick={handleSaveOllama}>
              Save Ollama Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

