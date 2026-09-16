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
import { Button, Field, Input, Toggle, cx } from '@/components/ui/primitives'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useStore } from '@/state/store'
import { APP_NAME, APP_TAGLINE } from '@/brand'
import { PIPELINE_TEMPLATES } from '@/lib/templates'

type Mode = 'create' | 'join'

export function Welcome() {
  const { user, memberships, data, signIn, signInAs, backend, createWorkspace, joinByCode, notify, openWorkspace } =
    useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) ?? 'create')

  // Where the person was heading before onboarding interrupted them.
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'

  // Sign-in form (local backend only)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // Create form
  const [wsName, setWsName] = useState('')
  const [templateId, setTemplateId] = useState('video')
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

  const template = useMemo(() => PIPELINE_TEMPLATES.find((t) => t.id === templateId)!, [templateId])

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
      await createWorkspace({
        name: wsName.trim(),
        templateId,
        contentPrefix: prefix.trim() || 'CN',
        weekStartsOn: mondayStart ? 1 : 0,
        withSample,
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
            <div className="mb-5 inline-flex rounded border border-line/60 bg-sunken p-0.5">
              {(['create', 'join'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cx(
                    'rounded-[0.35rem] px-3.5 py-1.5 text-body-sm font-medium transition-colors',
                    mode === m ? 'bg-raised text-ink' : 'text-ink-faint hover:text-ink-dim',
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

                <div>
                  <span className="mb-2 block label-caps font-bold text-ink">Production Pipeline</span>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {PIPELINE_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplateId(t.id)}
                        className={cx(
                          'rounded-lg border p-3.5 text-left transition-colors',
                          templateId === t.id
                            ? 'border-accent/60 bg-accent/10 ring-1 ring-accent/30'
                            : 'border-line/50 bg-sunken/50 hover:border-line',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-body-sm font-bold text-ink">{t.name}</span>
                          {templateId === t.id && <Icon name="check" size={15} className="shrink-0 text-primary" />}
                        </span>
                        <span className="mt-1 block text-body-xs text-ink-dim leading-relaxed">{t.blurb}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-body-xs text-ink-faint">
                    <strong className="font-semibold text-ink-dim">Stages:</strong> {template.stages.map((s) => s.name).join(' → ')} · fully editable later in Settings.
                  </p>
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

                <Button variant="primary" block icon="arrow-right" loading={busy} onClick={() => void doCreate()}>
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
                  block
                  icon="key"
                  loading={busy}
                  disabled={code.trim().length < 6}
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
                    <li key={m.workspaceId}>
                      <button
                        onClick={() => {
                          void openWorkspace(m.workspaceId)
                          navigate('/')
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md border border-line/50 bg-sunken/50 p-2.5 text-left transition-colors hover:border-line"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent/15 font-mono text-body-xs text-primary">
                          {m.initials}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{m.workspaceName}</span>
                        <Icon name="chevron-right" size={15} className="shrink-0 text-ink-faint" />
                      </button>
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
    </div>
  )
}
