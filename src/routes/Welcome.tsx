/**
 * Sign-in and workspace onboarding.
 *
 * With the local backend there is no identity provider, so the "sign in" step
 * just names the session — enough to attribute work and keep memberships stable.
 * With Firestore the same button becomes Google sign-in. Joining is by 6-character
 * code, which needs no email delivery and therefore no paid Firebase tier.
 */

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { FluxLogo } from '@/components/ui/FluxLogo'
import { Button, Field, IconButton, Input, Toggle, cx } from '@/components/ui/primitives'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useConfirm } from '@/components/ui/Overlay'
import { useStore } from '@/state/store'
import { APP_NAME, APP_TAGLINE } from '@/brand'
import { PIPELINE_TEMPLATES } from '@/lib/templates'
import { mergePipelines } from '@/lib/pipelineMerge'
import {
  PRODUCTION_FORMATS,
  WORKFLOW_PRESETS,
  CORE_TAXONOMY_CATEGORIES,
  FULL_TAXONOMY_CATEGORIES,
  getAllSubCategories,
  getPresetById,
} from '@/lib/productionFormats'
import type { ProductionFormat } from '@/lib/types'

type Mode = 'create' | 'join'

export function Welcome() {
  const { user, memberships, data, signIn, signInAs, backend, createWorkspace, joinByCode, notify, openWorkspace, deleteWorkspace } =
    useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) ?? 'create')

  // Where the person was heading before onboarding interrupted them.
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'

  // Sign-in form (local backend only)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // Create form
  const [wsName, setWsName] = useState('')
  const [workflowPreset, setWorkflowPreset] = useState<string>('all')
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>(['video', 'design'])
  const [enabledFormats, setEnabledFormats] = useState<ProductionFormat[]>([
    'video',
    'static',
    'written',
    'brief',
  ])
  const [enabledSubCategories, setEnabledSubCategories] = useState<string[]>(getAllSubCategories())
  const [categoryScope, setCategoryScope] = useState<'streamlined' | 'all'>('all')
  const [showCustomWorkflow, setShowCustomWorkflow] = useState<boolean>(false)
  const [prefix, setPrefix] = useState('CN')
  const [mondayStart, setMondayStart] = useState(true)
  const [withSample, setWithSample] = useState(true)

  // Join form
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Already set up and just visiting /welcome: go home.
  useEffect(() => {
    if (user && data && !params.get('mode')) navigate(returnTo, { replace: true })
  }, [user, data, params, navigate, returnTo])

  const mergeReport = useMemo(() => mergePipelines(selectedPipelines), [selectedPipelines])

  const applyPreset = (id: string) => {
    setWorkflowPreset(id)
    if (id === 'custom') {
      setShowCustomWorkflow(true)
      return
    }
    const preset = getPresetById(id)
    setSelectedPipelines([...preset.pipelines])
    setEnabledFormats([...preset.formats])
    setEnabledSubCategories([...preset.subCategories])
    setCategoryScope(id === 'all' ? 'all' : 'streamlined')
  }

  const togglePipeline = (id: string) => {
    setWorkflowPreset('custom')
    if (selectedPipelines.includes(id)) {
      if (selectedPipelines.length === 1) return // Keep at least one active
      setSelectedPipelines(selectedPipelines.filter((p) => p !== id))
    } else {
      setSelectedPipelines([...selectedPipelines, id])
    }
  }

  const toggleFormat = (fmt: ProductionFormat) => {
    setWorkflowPreset('custom')
    if (enabledFormats.includes(fmt)) {
      if (enabledFormats.length === 1) return // Keep at least one
      const nextFormats = enabledFormats.filter((f) => f !== fmt)
      setEnabledFormats(nextFormats)
      const def = PRODUCTION_FORMATS.find((f) => f.id === fmt)
      if (def) {
        setEnabledSubCategories((prev) => prev.filter((sc) => !def.subCategories.includes(sc)))
      }
    } else {
      const nextFormats = [...enabledFormats, fmt]
      setEnabledFormats(nextFormats)
      const def = PRODUCTION_FORMATS.find((f) => f.id === fmt)
      if (def) {
        setEnabledSubCategories((prev) => Array.from(new Set([...prev, ...def.subCategories])))
      }
    }
  }

  const toggleSubCategory = (subCat: string) => {
    setWorkflowPreset('custom')
    if (enabledSubCategories.includes(subCat)) {
      if (enabledSubCategories.length === 1) return // Keep at least one
      setEnabledSubCategories((prev) => prev.filter((s) => s !== subCat))
    } else {
      setEnabledSubCategories((prev) => [...prev, subCat])
    }
  }

  const doSignIn = async () => {
    setBusy(true)
    try {
      if (backend === 'firestore') await signIn()
      else await signInAs(name || 'You', email || 'you@local')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Sign-in failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const doCreate = async () => {
    if (!wsName.trim()) {
      notify('Give the workspace a name first', 'danger')
      return
    }
    setBusy(true)
    try {
      const chosenCategories =
        categoryScope === 'streamlined' ? CORE_TAXONOMY_CATEGORIES : FULL_TAXONOMY_CATEGORIES

      await createWorkspace({
        name: wsName.trim(),
        templateId: selectedPipelines[0],
        templateIds: selectedPipelines,
        contentPrefix: prefix.trim() || 'CN',
        weekStartsOn: mondayStart ? 1 : 0,
        withSample,
        enabledFormats,
        enabledSubCategories,
        workflowPreset,
        categories: chosenCategories,
      })
      navigate(returnTo, { replace: true })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not create the workspace', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const doJoin = async () => {
    setJoinError(null)
    setBusy(true)
    try {
      await joinByCode(code, name)
      navigate(returnTo, { replace: true })
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-4 py-12 sm:px-6">
      {/* Top right theme toggle */}
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle variant="segmented" />
      </div>

      {/* -------- Masthead -------- */}
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 text-ink">
          <FluxLogo size={56} />
        </div>
        <h1 className="font-display text-headline-lg tracking-tight text-ink sm:text-display-lg">{APP_NAME}</h1>
        <p className="mt-1 font-mono text-label-caps uppercase text-ink-faint tracking-wider">{APP_TAGLINE}</p>
        <p className="mx-auto mt-3.5 max-w-lg text-body-md leading-relaxed text-ink-dim">
          <strong className="font-bold text-ink">Plan</strong>,{' '}
          <strong className="font-bold text-ink">Produce</strong>, and{' '}
          <strong className="font-bold text-ink">Publish</strong> social content as a team — one pipeline, one calendar, one set of numbers.
        </p>
      </header>

      {!user ? (
        /* -------- Step 1: identify -------- */
        <div className="w-full max-w-md rounded-xl border border-line/60 bg-panel p-6 shadow-ambient">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {backend === 'firestore' ? 'Sign in to continue' : 'Who are you?'}
            </h2>
            <p className="mt-1.5 text-body-sm text-ink-dim">
              {backend === 'firestore'
                ? 'Your Google account identifies you across workspaces.'
                : 'Running on this device only, so no password. Your name is used to attribute work.'}
            </p>
          </div>

          {backend === 'local' && (
            <div className="mt-5 space-y-3.5">
              <Field label="Your name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alexandra Morgan — Lead Social Producer & Content Director"
                  autoFocus
                  className="h-11 px-3.5 py-2.5 text-body-sm"
                />
              </Field>
              <Field label="Email" hint="used to match team invitations">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your organization email (e.g. alexandra.morgan@studio.com)"
                  className="h-11 px-3.5 py-2.5 text-body-sm"
                />
              </Field>
            </div>
          )}

          <Button variant="primary" size="lg" block className="mt-5" loading={busy} onClick={() => void doSignIn()}>
            {backend === 'firestore' ? 'Continue with Google' : 'Continue'}
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-body-xs text-ink-faint">
            <Icon name="key" size={13} className="shrink-0" />
            <span>
              Backend: <span className="font-mono uppercase">{backend}</span>
              {backend === 'local' && ' — data stays in this browser until you connect Firebase.'}
            </span>
          </p>
        </div>
      ) : (
        /* -------- Step 2: workspace -------- */
        <div className="w-full max-w-4xl grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-lg border border-line/60 bg-panel p-5">
            <div className="mb-5 inline-flex w-full sm:w-auto rounded-lg border border-line/60 bg-sunken p-1">
              {(['create', 'join'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cx(
                    'flex-1 sm:flex-initial rounded-md min-h-[42px] px-4 py-2 text-body-sm font-semibold transition-all touch-manipulation active:scale-[0.98]',
                    mode === m ? 'bg-raised text-ink shadow-xs' : 'text-ink-faint hover:text-ink-dim',
                  )}
                >
                  {m === 'create' ? 'Create a workspace' : 'Join with a code'}
                </button>
              ))}
            </div>

            {mode === 'create' ? (
              <div className="space-y-5">
                <Field label="Workspace Name" hint="your team, brand or client">
                  <Input
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    placeholder="e.g. Northwind Studio — Social Media & Content Command Hub"
                    autoFocus
                  />
                </Field>

                {/* -------- Workflow & Content Setup -------- */}
                <div className="space-y-4 rounded-xl border border-line/70 bg-sunken/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-body-sm font-bold text-ink">
                        Workflow & Content Setup
                      </span>
                      <span className="text-body-xs text-ink-dim">
                        Pick the workflow options and content segments you want to keep. You can always change or add more in Settings later.
                      </span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-label-micro uppercase font-bold text-primary">
                      Step 2 of 2
                    </span>
                  </div>

                  {/* Preset Choices */}
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {WORKFLOW_PRESETS.map((p) => {
                      const isSelected = workflowPreset === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPreset(p.id)}
                          className={cx(
                            'relative rounded-lg border p-3.5 text-left transition-all',
                            isSelected
                              ? 'border-primary/80 bg-accent/20 ring-2 ring-primary/40 shadow-sm'
                              : 'border-line/60 bg-raised/70 hover:border-line hover:bg-raised',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-body-sm font-bold text-ink">{p.name}</span>
                                <span className="rounded bg-accent/25 px-1.5 py-0.5 text-label-micro font-bold text-primary">
                                  {p.badge}
                                </span>
                              </div>
                              <span className="mt-1 block text-body-xs text-ink-dim leading-snug">
                                {p.description}
                              </span>
                            </div>
                            <span
                              className={cx(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-line/80 bg-sunken text-transparent',
                              )}
                            >
                              <Icon name="check" size={11} />
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-label-micro text-ink-faint">
                            <span>Segments:</span>
                            {p.formats.map((f) => (
                              <span key={f} className="rounded bg-sunken/80 px-1.5 py-0.5 capitalize text-ink">
                                {f}
                              </span>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Customization Toggle & Details */}
                  <div className="rounded-lg border border-line/60 bg-raised p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-body-xs font-bold text-ink">
                          Content Segments to Keep ({enabledFormats.length} of {PRODUCTION_FORMATS.length} active)
                        </span>
                        <span className="text-body-xs text-ink-dim">
                          Toggle segments on or off, and click individual subcategories to keep or exclude specific formats.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCustomWorkflow((v) => !v)}
                        className="shrink-0 text-body-xs font-semibold text-primary hover:underline"
                      >
                        {showCustomWorkflow ? 'Collapse details' : 'Customize options'}
                      </button>
                    </div>

                    {/* Segment Toggles */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PRODUCTION_FORMATS.map((fmt) => {
                        const isEnabled = enabledFormats.includes(fmt.id)
                        const activeSubs = fmt.subCategories.filter((sc) => enabledSubCategories.includes(sc))
                        return (
                          <div
                            key={fmt.id}
                            className={cx(
                              'rounded-lg border p-3 transition-colors',
                              isEnabled
                                ? 'border-primary/40 bg-accent/10'
                                : 'border-line/50 bg-sunken/40 opacity-70',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/25 text-primary">
                                  <Icon name={fmt.icon} size={14} />
                                </span>
                                <span className="text-body-sm font-bold text-ink">{fmt.label}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleFormat(fmt.id)}
                                className={cx(
                                  'rounded px-2 py-0.5 text-label-micro font-semibold transition-colors',
                                  isEnabled
                                    ? 'bg-primary text-white'
                                    : 'bg-sunken text-ink-dim hover:bg-raised border border-line/60',
                                )}
                              >
                                {isEnabled ? 'Active' : 'Excluded'}
                              </button>
                            </div>
                            <p className="text-label-micro text-ink-dim mb-2">
                              {fmt.tagline} · {isEnabled ? `${activeSubs.length} active` : 'excluded'}
                            </p>

                            {/* Subcategories */}
                            {isEnabled && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t border-line/40">
                                {fmt.subCategories.map((subCat) => {
                                  const subActive = enabledSubCategories.includes(subCat)
                                  return (
                                    <button
                                      key={subCat}
                                      type="button"
                                      onClick={() => toggleSubCategory(subCat)}
                                      className={cx(
                                        'rounded px-1.5 py-0.5 text-label-micro transition-all',
                                        subActive
                                          ? 'border border-primary/40 bg-primary/10 text-primary font-medium'
                                          : 'border border-line/40 bg-sunken/60 text-ink-faint line-through opacity-60 hover:opacity-100',
                                      )}
                                      title={subActive ? 'Click to exclude' : 'Click to include'}
                                    >
                                      {subCat}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Taxonomy Category Volume Choice */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-line/50 bg-sunken/40 p-3">
                      <div>
                        <span className="block text-body-xs font-bold text-ink">
                          Category Options in Dropdowns
                        </span>
                        <span className="text-label-micro text-ink-dim">
                          Avoid being bombarded with too many options by starting with core categories.
                        </span>
                      </div>
                      <div className="inline-flex rounded-md border border-line/60 bg-raised p-0.5">
                        <button
                          type="button"
                          onClick={() => setCategoryScope('streamlined')}
                          className={cx(
                            'rounded px-2.5 py-1 text-label-micro font-medium transition-colors',
                            categoryScope === 'streamlined'
                              ? 'bg-primary text-white shadow-xs'
                              : 'text-ink-dim hover:text-ink',
                          )}
                        >
                          Core 5 Categories
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategoryScope('all')}
                          className={cx(
                            'rounded px-2.5 py-1 text-label-micro font-medium transition-colors',
                            categoryScope === 'all'
                              ? 'bg-primary text-white shadow-xs'
                              : 'text-ink-dim hover:text-ink',
                          )}
                        >
                          All 9 Categories
                        </button>
                      </div>
                    </div>

                    {/* Granular Pipeline Accordion */}
                    {showCustomWorkflow && (
                      <div className="space-y-3 pt-2 border-t border-line/50">
                        <div className="flex items-center justify-between">
                          <span className="text-body-xs font-bold text-ink">Active Production Pipelines</span>
                          <span className="text-label-micro text-primary font-medium">
                            {selectedPipelines.length} pipeline{selectedPipelines.length > 1 ? 's' : ''} merged
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {PIPELINE_TEMPLATES.map((t) => {
                            const isSelected = selectedPipelines.includes(t.id)
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => togglePipeline(t.id)}
                                className={cx(
                                  'flex items-center justify-between rounded-lg border p-2.5 text-left text-body-xs transition-colors',
                                  isSelected
                                    ? 'border-primary/60 bg-accent/15 font-semibold text-ink'
                                    : 'border-line/50 bg-sunken/40 text-ink-dim hover:bg-sunken',
                                )}
                              >
                                <span>{t.name}</span>
                                <span
                                  className={cx(
                                    'flex h-4 w-4 items-center justify-center rounded border text-label-micro',
                                    isSelected
                                      ? 'border-primary bg-primary text-white'
                                      : 'border-line/60 bg-raised text-transparent',
                                  )}
                                >
                                  ✓
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 font-mono text-label-micro text-ink-dim pt-1">
                          <span className="font-semibold text-ink">Merged Stages ({mergeReport.stages.length}):</span>
                          {mergeReport.stages.map((s, idx) => (
                            <span key={s.name} className="flex items-center gap-1">
                              {idx > 0 && <span className="opacity-40">→</span>}
                              <span className="rounded border border-line/60 bg-sunken px-1.5 py-0.5 text-ink">{s.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reassurance Notice */}
                    <div className="flex items-start gap-2 rounded-md border border-line/60 bg-sunken/60 p-2.5 text-body-xs text-ink-dim">
                      <Icon name="key" size={14} className="mt-0.5 shrink-0 text-primary" />
                      <span>
                        <strong className="font-semibold text-ink">Always adjustable:</strong> You can return to Settings at any time to add new options, re-enable segments, or expand fields as your workflow evolves.
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <Field label="Content ID Prefix" hint="e.g. CN-0001">
                    <Input
                      value={prefix}
                      maxLength={5}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      className="max-w-xs font-mono uppercase"
                    />
                  </Field>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-line/60 bg-sunken/40 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block text-body-sm font-bold text-ink">Weeks start Monday</span>
                      <span className="block text-body-xs text-ink-faint">Calendar weeks begin on Monday instead of Sunday</span>
                    </div>
                    <div className="shrink-0">
                      <Toggle checked={mondayStart} onChange={setMondayStart} label="Weeks start Monday" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-line/60 bg-sunken/40 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block text-body-sm font-bold text-ink">Fill with sample data</span>
                      <span className="block text-body-xs text-ink-faint">
                        A demo team and 14 content items so every screen has something in it.
                      </span>
                    </div>
                    <div className="shrink-0">
                      <Toggle checked={withSample} onChange={setWithSample} label="Include sample data" />
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon="arrow-right"
                  loading={busy}
                  className="h-13 sm:h-12 min-h-[52px] sm:min-h-[48px] px-6 text-base font-semibold shadow-sm touch-manipulation active:scale-[0.99]"
                  onClick={() => void doCreate()}
                >
                  Create workspace
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Join code" hint="6 characters from your team lead">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    autoFocus
                    className="text-center font-mono text-headline-md tracking-[0.35em]"
                  />
                </Field>
                <Field label="Display name" hint="how you appear to the team">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={user.name} />
                </Field>
                {joinError && (
                  <p className="flex items-start gap-1.5 rounded border border-danger/30 bg-danger/10 p-2.5 text-body-xs text-danger">
                    <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                    {joinError}
                  </p>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon="key"
                  loading={busy}
                  disabled={code.trim().length < 6}
                  className="h-13 sm:h-12 min-h-[52px] sm:min-h-[48px] px-6 text-base font-semibold shadow-sm touch-manipulation active:scale-[0.99]"
                  onClick={() => void doJoin()}
                >
                  Join workspace
                </Button>
              </div>
            )}
          </div>

          {/* -------- Existing workspaces -------- */}
          <aside className="space-y-3">
            {memberships.length > 0 && (
              <div className="rounded-lg border border-line/60 bg-panel p-4">
                <h3 className="label-caps font-bold text-ink">Your workspaces</h3>
                <ul className="mt-2 space-y-1.5">
                  {memberships.map((m) => (
                    <li key={m.workspaceId} className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          void openWorkspace(m.workspaceId)
                          navigate('/')
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-line/50 bg-sunken/50 p-2.5 text-left transition-colors hover:border-line touch-manipulation"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/15 font-mono text-body-xs text-primary">
                          {m.initials}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink">{m.workspaceName}</span>
                        <Icon name="chevron-right" size={15} className="shrink-0 text-ink-faint" />
                      </button>
                      {m.access === 'owner' && (
                        <IconButton
                          icon="trash"
                          label={`Delete ${m.workspaceName}`}
                          tone="danger"
                          size="sm"
                          className="shrink-0 text-ink-faint hover:text-danger touch-manipulation"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirm.ask({
                              title: `Delete ${m.workspaceName}?`,
                              body: `This permanently removes "${m.workspaceName}" and all associated data. This action cannot be undone.`,
                              confirmLabel: 'Delete workspace permanently',
                              danger: true,
                              onConfirm: () => void deleteWorkspace(m.workspaceId),
                            })
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-line/60 bg-panel p-4">
              <h3 className="label-caps font-bold text-ink">What you get</h3>
              <ul className="mt-2.5 space-y-2 text-body-xs text-ink-dim">
                {[
                  'A configurable production pipeline with a responsible person at every stage',
                  'Calendar, board and table views over the same plan',
                  'Per-person task tracking with overdue detection',
                  'Publishing metrics with engagement rate calculated for you',
                  'A searchable library of everything published',
                  'Idea bank that promotes approved ideas straight into the plan',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-emerald" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
      {confirm.element}
    </div>
  )
}
