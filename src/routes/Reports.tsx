/**
 * AI Reports & Summaries with Local LLM (Ollama).
 *
 * Runs 100% on the user's machine via their local Ollama instance (default: localhost:11434).
 * Generates daily standup briefings, monthly performance retrospectives,
 * pipeline velocity health checks, and creative content strategy summaries.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Field,
  IconButton,
  Input,
  SectionTitle,
  Spinner,
  Tabs,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Sheet } from '@/components/ui/Overlay'
import { Icon } from '@/components/ui/Icon'
import { MarkdownViewer } from '@/components/ui/MarkdownViewer'
import { PWAInstallButton } from '@/components/ui/PWAInstallButton'
import { useStore } from '@/state/store'
import {
  DEFAULT_OLLAMA_ENDPOINT,
  OllamaModelInfo,
  buildDailyReportPrompt,
  buildIdeaStrategyPrompt,
  buildMonthlyReportPrompt,
  buildPipelineReportPrompt,
  generateSimulatedReport,
  loadOllamaConfig,
  saveOllamaConfig,
  streamOllamaReport,
  testOllamaConnection,
} from '@/lib/ollama'
import { today } from '@/lib/date'
import { uid } from '@/lib/factories'
import type { WeeklyReview } from '@/lib/types'

type ReportTab = 'daily' | 'monthly' | 'pipeline' | 'ideas' | 'custom'

const POPULAR_MODELS = [
  'llama3.2:latest',
  'llama3.2:3b',
  'llama3.1:8b',
  'mistral:latest',
  'gemma2:9b',
  'qwen2.5:7b',
  'deepseek-r1:8b',
  'phi3:latest',
]

export function ReportsPage() {
  const { data, month: defaultMonth, notify, upsertReview } = useStore()

  const [tab, setTab] = useState<ReportTab>('daily')
  const [targetDate, setTargetDate] = useState<string>(today())
  const [targetMonth, setTargetMonth] = useState<string>(defaultMonth)
  const [customPrompt, setCustomPrompt] = useState<string>('')

  // Ollama configuration state
  const [config, setConfig] = useState(loadOllamaConfig)
  const [models, setModels] = useState<OllamaModelInfo[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'disconnected'>('testing')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [tempEndpoint, setTempEndpoint] = useState(config.endpoint)
  const [tempTemp, setTempTemp] = useState(config.temperature)

  // Report Generation State
  const [generating, setGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [lastMeta, setLastMeta] = useState<string>('')
  const [saveReviewOpen, setSaveReviewOpen] = useState(false)
  const [reviewWeekStart, setReviewWeekStart] = useState<string>(today())

  const abortControllerRef = useRef<AbortController | null>(null)

  // Check Ollama connection on mount
  useEffect(() => {
    void verifyOllama()
  }, [config.endpoint])

  const verifyOllama = async () => {
    setConnectionStatus('testing')
    setConnectionError(null)
    const result = await testOllamaConnection(config.endpoint)
    if (result.connected) {
      setConnectionStatus('connected')
      setModels(result.models)
      if (result.models.length > 0 && !result.models.some((m) => m.name === config.selectedModel)) {
        const first = result.models[0].name
        const next = saveOllamaConfig({ selectedModel: first })
        setConfig(next)
      }
    } else {
      setConnectionStatus('disconnected')
      setConnectionError(result.error ?? 'Could not connect to Ollama')
    }
  }

  const handleSaveConfig = () => {
    const updated = saveOllamaConfig({
      endpoint: tempEndpoint.trim() || DEFAULT_OLLAMA_ENDPOINT,
      temperature: tempTemp,
    })
    setConfig(updated)
    setConfigModalOpen(false)
    notify('Ollama configuration saved')
  }

  // Pre-computed context numbers for active workspace
  const summaryChips = useMemo(() => {
    if (!data) return []
    if (tab === 'daily') {
      const pubToday = data.content.filter((c) => c.plannedPublishDate === targetDate || c.actualPublishDate === targetDate)
      const tasksToday = data.tasks.filter((t) => t.date === targetDate || t.deadline === targetDate)
      const blockers = data.content.filter((c) => c.blocker).length + data.tasks.filter((t) => t.status === 'blocked').length
      return [
        { label: 'Publishing Today', val: pubToday.length },
        { label: 'Tasks Today', val: tasksToday.length },
        { label: 'Active Blockers', val: blockers },
        { label: 'Team', val: data.members.length },
      ]
    }
    if (tab === 'monthly') {
      const monthItems = data.content.filter((c) => c.month === targetMonth)
      const published = monthItems.filter((c) => c.lifecycle === 'published' || c.actualPublishDate)
      const views = published.reduce((acc, c) => acc + (c.performance?.views ?? 0), 0)
      return [
        { label: 'Month Planned', val: monthItems.length },
        { label: 'Published', val: published.length },
        { label: 'Logged Views', val: views > 0 ? views.toLocaleString() : '0' },
        { label: 'Ideas Bank', val: data.ideas.length },
      ]
    }
    if (tab === 'pipeline') {
      const inFlight = data.content.filter((c) => c.lifecycle === 'active' || c.lifecycle === 'revision')
      return [
        { label: 'Pipeline Stages', val: data.workspace.stages.length },
        { label: 'Active In-Flight', val: inFlight.length },
        { label: 'Urgent P1', val: inFlight.filter((c) => c.priority === 'P1').length },
      ]
    }
    if (tab === 'ideas') {
      const high = data.ideas.filter((i) => i.potential === 'High' || i.potential === 'Moonshot' || i.priority === 'P1')
      return [
        { label: 'Total Ideas', val: data.ideas.length },
        { label: 'High Potential', val: high.length },
        { label: 'Converted to Content', val: data.ideas.filter((i) => i.status === 'converted').length },
      ]
    }
    return [{ label: 'Total Content', val: data.content.length }]
  }, [data, tab, targetDate, targetMonth])

  // Execute Generation
  const handleGenerate = async (forceSimulation = false) => {
    if (!data) return

    // If forcing simulation or if Ollama is disconnected, provide sample simulated report
    if (forceSimulation || connectionStatus !== 'connected') {
      let simType: 'daily' | 'monthly' | 'pipeline' | 'ideas' = 'daily'
      let title = 'Operations Briefing'
      if (tab === 'daily') {
        simType = 'daily'
        title = `Daily Operations Report (${targetDate})`
      } else if (tab === 'monthly') {
        simType = 'monthly'
        title = `Monthly Performance Report (${targetMonth})`
      } else if (tab === 'pipeline') {
        simType = 'pipeline'
        title = 'Pipeline Velocity Health Check'
      } else if (tab === 'ideas') {
        simType = 'ideas'
        title = 'Idea Bank & Content Strategy'
      } else {
        simType = 'daily'
        title = 'Custom Workspace Summary'
      }

      setGenerating(true)
      setStreamedText('')
      setLastMeta(`Simulated sample output (${tab})`)

      const fullReport = generateSimulatedReport(simType, title)
      // Simulate quick streaming typing effect
      let curr = ''
      const chunks = fullReport.split(' ')
      let i = 0

      const interval = setInterval(() => {
        if (i < chunks.length) {
          curr += (i === 0 ? '' : ' ') + chunks[i]
          setStreamedText(curr)
          i += 3
        } else {
          setStreamedText(fullReport)
          setGenerating(false)
          clearInterval(interval)
          notify('Sample report generated', 'success')
        }
      }, 25)
      return
    }

    // Build the payload
    let promptText = ''
    let meta = ''
    if (tab === 'daily') {
      const b = buildDailyReportPrompt(targetDate, data)
      promptText = b.prompt
      meta = b.contextSummary
    } else if (tab === 'monthly') {
      const b = buildMonthlyReportPrompt(targetMonth, data)
      promptText = b.prompt
      meta = b.contextSummary
    } else if (tab === 'pipeline') {
      const b = buildPipelineReportPrompt(data)
      promptText = b.prompt
      meta = b.contextSummary
    } else if (tab === 'ideas') {
      const b = buildIdeaStrategyPrompt(data)
      promptText = b.prompt
      meta = b.contextSummary
    } else {
      // Custom query
      if (!customPrompt.trim()) {
        notify('Please type a question or prompt for Ollama')
        return
      }
      promptText = `
Workspace: "${data.workspace.name}"
Active Content Items: ${data.content.length}
Tasks: ${data.tasks.length}
Ideas: ${data.ideas.length}
Members: ${data.members.map((m) => `${m.name} (${m.role})`).join(', ')}

User Prompt:
${customPrompt}
`.trim()
      meta = `Custom Query | Workspace: "${data.workspace.name}"`
    }

    setGenerating(true)
    setStreamedText('')
    setLastMeta(meta)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await streamOllamaReport({
        endpoint: config.endpoint,
        model: config.selectedModel,
        prompt: promptText,
        temperature: config.temperature,
        signal: controller.signal,
        onChunk: (_chunk, accumulated) => {
          setStreamedText(accumulated)
        },
      })
      notify('Report generated with local Ollama!', 'success')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        notify('Report generation stopped')
      } else {
        notify(err.message || 'Ollama generation failed', 'danger')
      }
    } finally {
      setGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setGenerating(false)
  }

  const copyToClipboard = () => {
    if (!streamedText) return
    navigator.clipboard.writeText(streamedText)
    notify('Report copied to clipboard', 'success')
  }

  const downloadMarkdown = () => {
    if (!streamedText) return
    const blob = new Blob([streamedText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flux-${tab}-report-${targetDate}.md`
    a.click()
    URL.revokeObjectURL(url)
    notify('Markdown file downloaded', 'success')
  }

  const handleSaveToWeeklyReview = async () => {
    if (!data || !streamedText) return
    const reviewId = uid('wr_')
    const newRev: WeeklyReview = {
      id: reviewId,
      workspaceId: data.workspace.id,
      weekStart: reviewWeekStart,
      weekEnd: reviewWeekStart,
      label: `W-${reviewWeekStart.slice(5)} (AI Report)`,
      planned: `Generated from ${tab.toUpperCase()} report: ${lastMeta}`,
      completed: streamedText.slice(0, 300) + '...',
      delayed: '',
      performedWell: 'Analyzed with local Ollama model ' + config.selectedModel,
      needsAttention: '',
      keyWins: 'Actionable report generated locally on-device',
      keyProblems: '',
      nextPriorities: 'Execute action recommendations',
      actionOwnerId: data.members[0]?.id || '',
      actionDeadline: today(),
      status: 'done',
      updatedAt: new Date().toISOString(),
    }
    await upsertReview(newRev)
    setSaveReviewOpen(false)
    notify('Report saved into Workspace Weekly Reviews!', 'success')
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      {/* Header & Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="AI Reports & Summaries"
          blurb="Private, on-device intelligence powered by your local Ollama LLM instance."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <PWAInstallButton variant="ghost" size="sm" label="Desktop App" />
          <Button
            variant="quiet"
            size="sm"
            icon="sliders"
            onClick={() => {
              setTempEndpoint(config.endpoint)
              setTempTemp(config.temperature)
              setConfigModalOpen(true)
            }}
          >
            Ollama Config
          </Button>
        </div>
      </div>

      {/* Ollama Connection & Model Selector Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/40 bg-sunken/50 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'h-2.5 w-2.5 rounded-full',
                connectionStatus === 'connected'
                  ? 'bg-emerald animate-pulse'
                  : connectionStatus === 'testing'
                  ? 'bg-amber animate-ping'
                  : 'bg-danger'
              )}
            />
            <span className="text-body-xs font-semibold text-ink">
              {connectionStatus === 'connected'
                ? 'Ollama Connected'
                : connectionStatus === 'testing'
                ? 'Checking Ollama...'
                : 'Ollama Offline / CORS Required'}
            </span>
          </div>

          <span className="text-line">|</span>

          {/* Model selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-body-xs text-ink-dim">Model:</span>
            <select
              value={config.selectedModel}
              onChange={(e) => {
                const next = saveOllamaConfig({ selectedModel: e.target.value })
                setConfig(next)
              }}
              className="rounded border border-line/40 bg-panel px-2.5 py-1 text-body-xs text-ink focus:border-primary focus:outline-none"
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} {m.parameterSize ? `(${m.parameterSize})` : ''}
                  </option>
                ))
              ) : (
                POPULAR_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="font-mono text-label-micro text-ink-faint">
            {config.endpoint.replace('http://', '')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus !== 'connected' && (
            <button
              onClick={() => void verifyOllama()}
              className="flex items-center gap-1 text-label-micro uppercase font-mono text-primary hover:underline"
            >
              <Icon name="refresh" size={13} />
              Retry Connection
            </button>
          )}
        </div>
      </div>

      {/* Connection Helper Notice if Disconnected */}
      {connectionStatus === 'disconnected' && (
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-3.5 text-body-xs text-ink-dim space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber">
            <Icon name="alert" size={16} />
            <span>Connect your local Ollama daemon for on-device generation</span>
          </div>
          {connectionError && (
            <div className="rounded bg-danger/10 border border-danger/30 p-2 font-mono text-label-micro text-danger">
              {connectionError}
            </div>
          )}
          <p>
            FLUX can query your local models (like <code className="text-primary font-mono">llama3.2</code>,{' '}
            <code className="text-primary font-mono">mistral</code>, or <code className="text-primary font-mono">deepseek-r1</code>)
            directly on <code className="text-primary font-mono">http://localhost:11434</code> without any cloud data leaving your machine.
          </p>
          <div className="rounded bg-sunken/80 p-2 font-mono text-label-micro text-ink space-y-1">
            <div className="text-ink-faint"># 1. Start Ollama with browser origin access:</div>
            <div className="text-emerald font-semibold selection:bg-primary/20">OLLAMA_ORIGINS="*" ollama serve</div>
            <div className="text-ink-faint mt-1"># 2. In another terminal, pull and run a model:</div>
            <div className="text-emerald font-semibold selection:bg-primary/20">ollama run llama3.2</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => void verifyOllama()}>
              Test Connection Again
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon="sparkle"
              onClick={() => void handleGenerate(true)}
              title="Preview with realistic sample data without running Ollama"
            >
              Preview Sample Output (Instant)
            </Button>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs
        tabs={[
          { id: 'daily', label: '🌅 Daily Standup' },
          { id: 'monthly', label: '📊 Monthly Report' },
          { id: 'pipeline', label: '⚡ Pipeline Health' },
          { id: 'ideas', label: '💡 Idea Strategy' },
          { id: 'custom', label: '💬 Custom Query' },
        ]}
        value={tab}
        onChange={(t) => setTab(t as ReportTab)}
      />

      {/* Configuration & Parameter Bar */}
      <Card>
        <CardHeader
          label="Scope & Parameters"
          title={
            tab === 'daily'
              ? 'Daily Operational Focus'
              : tab === 'monthly'
              ? 'Monthly Production & Performance Retrospective'
              : tab === 'pipeline'
              ? 'Production Velocity & Throughput'
              : tab === 'ideas'
              ? 'Content Ideation & Pillar Synthesis'
              : 'Direct Workspace Prompt'
          }
        />
        <div className="space-y-4 p-widget">
          {/* Form Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {tab === 'daily' && (
              <Field label="Target Date" className="w-48">
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="font-mono text-body-sm"
                />
              </Field>
            )}

            {tab === 'monthly' && (
              <Field label="Target Month (YYYY-MM)" className="w-48">
                <Input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="font-mono text-body-sm"
                />
              </Field>
            )}

            {/* Context chips */}
            <div className="flex flex-1 flex-wrap items-center gap-2 pt-5">
              {summaryChips.map((c) => (
                <Chip key={c.label}>
                  <span className="numeral font-mono font-semibold text-ink">{c.val}</span>
                  <span className="text-ink-dim">{c.label}</span>
                </Chip>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end pt-5">
              {generating ? (
                <Button variant="danger" icon="block" onClick={handleStop}>
                  Stop Generation
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="sparkle"
                  onClick={() => void handleGenerate(false)}
                >
                  Generate with {config.selectedModel.split(':')[0]}
                </Button>
              )}
            </div>
          </div>

          {tab === 'custom' && (
            <Field label="Ask Ollama about this workspace" hint="All items, tasks, and team assignments are injected into context">
              <Textarea
                rows={3}
                placeholder="e.g. Which content items are overdue? What should our YouTube team prioritize this week? Draft 5 high-converting hooks for our product launch video."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </Field>
          )}
        </div>
      </Card>

      {/* Generated Report Display */}
      {(generating || streamedText) && (
        <Card>
          <div className="flex flex-wrap items-center justify-between border-b border-line/40 px-4 py-3 bg-panel/70">
            <div className="flex items-center gap-2">
              <Icon name="sparkle" size={18} className="text-primary" />
              <div className="min-w-0">
                <h3 className="font-semibold text-body-base text-ink truncate">
                  {tab === 'daily'
                    ? `Daily Operations Report — ${targetDate}`
                    : tab === 'monthly'
                    ? `Monthly Content Retrospective — ${targetMonth}`
                    : tab === 'pipeline'
                    ? 'Pipeline Health & Velocity'
                    : tab === 'ideas'
                    ? 'Content Strategy & Idea Synthesis'
                    : 'Custom Workspace Analysis'}
                </h3>
                <p className="font-mono text-label-micro text-ink-faint truncate">{lastMeta}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {generating && (
                <div className="flex items-center gap-2 font-mono text-label-micro text-primary">
                  <Spinner size={14} />
                  <span>Streaming from {config.selectedModel}...</span>
                </div>
              )}

              <IconButton
                icon="copy"
                size="sm"
                label="Copy markdown"
                onClick={copyToClipboard}
              />
              <IconButton
                icon="download"
                size="sm"
                label="Download as .md file"
                onClick={downloadMarkdown}
              />
              <Button
                variant="ghost"
                size="sm"
                icon="notes"
                onClick={() => setSaveReviewOpen(true)}
                disabled={generating}
              >
                Save to Reviews
              </Button>
            </div>
          </div>

          <div className="p-widget bg-void/40 min-h-[280px]">
            <MarkdownViewer content={streamedText} />
            {generating && <span className="inline-block h-4 w-2 bg-primary animate-pulse ml-1" />}
          </div>
        </Card>
      )}

      {/* Save to Weekly Review Sheet */}
      {saveReviewOpen && (
        <Sheet
          open={saveReviewOpen}
          onClose={() => setSaveReviewOpen(false)}
          title="Save Report to Weekly Review"
          subtitle="Archive this executive summary directly into your team's weekly retrospective records"
        >
          <div className="space-y-4">
            <Field label="Review Week Starting Date">
              <Input
                type="date"
                value={reviewWeekStart}
                onChange={(e) => setReviewWeekStart(e.target.value)}
                className="font-mono text-body-sm"
              />
            </Field>

            <div className="rounded-md border border-line/40 bg-sunken/40 p-3 text-body-xs text-ink-dim space-y-1">
              <div className="font-semibold text-ink">Archive Details:</div>
              <div>• Workspace: <span className="text-ink">{data.workspace.name}</span></div>
              <div>• Report Length: <span className="font-mono text-ink">{streamedText.length} characters</span></div>
              <div>• Model: <span className="font-mono text-primary">{config.selectedModel}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setSaveReviewOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" icon="check" onClick={handleSaveToWeeklyReview}>
                Save into Reviews
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {/* Ollama Configuration Sheet */}
      {configModalOpen && (
        <Sheet
          open={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          title="Ollama Local Daemon Settings"
          subtitle="Configure on-device connection parameters, endpoint URL, and model temperature"
          size="md"
        >
          <div className="space-y-4">
            <Field label="Ollama Server URL" hint="Default is http://localhost:11434">
              <Input
                value={tempEndpoint}
                onChange={(e) => setTempEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono text-body-sm"
              />
            </Field>

            <Field label={`Creativity / Temperature: ${tempTemp}`}>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={tempTemp}
                onChange={(e) => setTempTemp(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-label-micro text-ink-faint font-mono">
                <span>0.0 (Precise / Structured)</span>
                <span>1.0 (Creative)</span>
              </div>
            </Field>

            <div className="rounded-md border border-line/40 bg-sunken/50 p-3 text-body-xs space-y-2">
              <div className="font-semibold text-ink flex items-center gap-1.5">
                <Icon name="sparkle" size={14} className="text-primary" />
                <span>Ollama CORS Setup</span>
              </div>
              <p className="text-ink-dim">
                Browsers restrict requests to localhost unless CORS headers are allowed. Launch Ollama with:
              </p>
              <code className="block rounded bg-panel p-2 font-mono text-label-micro text-emerald selection:bg-primary/20">
                OLLAMA_ORIGINS="*" ollama serve
              </code>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfigModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveConfig}>
                Save Configuration
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
