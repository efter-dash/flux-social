/**
 * Local LLM (Ollama) Integration for FLUX Desktop & Local Edition.
 *
 * Connects directly to a local Ollama daemon (default: http://localhost:11434)
 * to generate daily executive briefings, monthly production & performance
 * retrospectives, pipeline velocity summaries, and creative content strategy.
 */

import type { ContentItem, Idea, Member, TaskItem, WeeklyReview, Workspace } from './types'
import { isTaskOverdue } from './derive'
import { APP_NAME } from '@/brand'

export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
export const OLLAMA_STORAGE_KEY = 'flux_ollama_config'

export interface OllamaModelInfo {
  name: string
  model: string
  size: number
  parameterSize?: string
  family?: string
  modifiedAt?: string
}

export interface OllamaConfig {
  endpoint: string
  selectedModel: string
  temperature: number
  customSystemPrompt?: string
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  endpoint: DEFAULT_OLLAMA_ENDPOINT,
  selectedModel: 'llama3.2:latest',
  temperature: 0.4,
  customSystemPrompt: '',
}

export function loadOllamaConfig(): OllamaConfig {
  try {
    const raw = localStorage.getItem(OLLAMA_STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_OLLAMA_CONFIG, ...JSON.parse(raw) }
    }
  } catch {
    // fallback
  }
  return DEFAULT_OLLAMA_CONFIG
}

export function saveOllamaConfig(config: Partial<OllamaConfig>): OllamaConfig {
  const current = loadOllamaConfig()
  const updated = { ...current, ...config }
  try {
    localStorage.setItem(OLLAMA_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
  return updated
}

/**
 * Check connection to Ollama server and list available models.
 */
export async function testOllamaConnection(endpoint = DEFAULT_OLLAMA_ENDPOINT): Promise<{
  connected: boolean
  models: OllamaModelInfo[]
  error?: string
}> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '')
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(`${cleanEndpoint}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return {
        connected: false,
        models: [],
        error: `Ollama returned status ${res.status}: ${res.statusText}`,
      }
    }

    const data = await res.json()
    const rawModels = Array.isArray(data.models) ? data.models : []
    const models: OllamaModelInfo[] = rawModels.map((m: any) => ({
      name: m.name || m.model,
      model: m.model || m.name,
      size: m.size || 0,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family,
      modifiedAt: m.modified_at,
    }))

    return {
      connected: true,
      models,
    }
  } catch (err: any) {
    let msg = err.message || 'Failed to connect to Ollama'
    if (err.name === 'AbortError') {
      msg = 'Connection timed out after 4s'
    } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg =
        'Network error. Ensure Ollama is running and CORS is enabled (e.g. OLLAMA_ORIGINS="*" ollama serve).'
    }
    return {
      connected: false,
      models: [],
      error: msg,
    }
  }
}

export interface StreamReportOptions {
  endpoint: string
  model: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  onChunk: (chunk: string, fullText: string) => void
  signal?: AbortSignal
}

/**
 * Streams a prompt response from local Ollama via /api/generate.
 */
export async function streamOllamaReport({
  endpoint,
  model,
  prompt,
  systemPrompt,
  temperature = 0.4,
  onChunk,
  signal,
}: StreamReportOptions): Promise<string> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '')
  const response = await fetch(`${cleanEndpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system:
        systemPrompt ||
        `You are the executive AI operations analyst for ${APP_NAME}, a social media content production system. Your job is to generate rigorous, actionable, highly readable summaries and reports for social media and marketing teams. Use crisp Markdown formatting, bullet points, metrics callouts, and clear priorities.`,
      stream: true,
      options: {
        temperature,
      },
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama generation failed (${response.status}): ${errorText || response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No readable response stream received from Ollama')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let accumulated = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.response) {
            accumulated += parsed.response
            onChunk(parsed.response, accumulated)
          }
          if (parsed.done) {
            break
          }
        } catch {
          // ignore malformed intermediate chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return accumulated
}

// ---------------------------------------------------------------------------
// Context Builders for Reports
// ---------------------------------------------------------------------------

export interface WorkspaceContextData {
  workspace: Workspace
  content: ContentItem[]
  tasks: TaskItem[]
  ideas: Idea[]
  members: Member[]
  reviews: WeeklyReview[]
}

/**
 * Context for Daily Report & Standup
 */
export function buildDailyReportPrompt(
  date: string,
  { workspace, content, tasks, members }: WorkspaceContextData
): { prompt: string; contextSummary: string } {
  const memberMap = new Map(members.map((m) => [m.id, m.name]))

  // Content for today
  const publishingToday = content.filter((c) => c.plannedPublishDate === date || c.actualPublishDate === date)
  const allActiveContent = content.filter((c) => c.lifecycle === 'active' || c.lifecycle === 'revision')

  // Tasks for today
  const tasksToday = tasks.filter((t) => t.date === date || t.deadline === date)
  const completedToday = tasksToday.filter((t) => t.status === 'completed')
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t))
  const blockedTasks = tasks.filter((t) => t.status === 'blocked')
  const blockedContent = content.filter((c) => Boolean(c.blocker && c.lifecycle !== 'published'))

  const contextSummary = `Workspace: "${workspace.name}" | Date: ${date} | Publishing Today: ${publishingToday.length} | Tasks Today: ${tasksToday.length} | Blockers: ${blockedTasks.length + blockedContent.length}`

  const prompt = `
Generate a comprehensive, executive Daily Content & Production Report for date: ${date} in ${APP_NAME}.

### Workspace Overview:
- Workspace: ${workspace.name}
- Content Prefix: ${workspace.contentPrefix}
- Active Team Members: ${members.map((m) => `${m.name} (${m.role})`).join(', ')}

### Content Publishing & Deliverables for Today (${date}):
${
  publishingToday.length === 0
    ? 'No content explicitly planned for final publishing on this date.'
    : publishingToday
        .map(
          (c) =>
            `- [${c.code}] "${c.title}" | Platform: ${c.platform} | Owner: ${memberMap.get(c.ownerId) ?? 'Unassigned'} | Lifecycle: ${c.lifecycle} | Priority: ${c.priority}`
        )
        .join('\n')
}

### In-Flight Active Production Pipeline (${allActiveContent.length} active items):
${allActiveContent
  .slice(0, 8)
  .map(
    (c) =>
      `- [${c.code}] "${c.title}" (${c.platform}) — Owner: ${memberMap.get(c.ownerId) ?? 'Unassigned'}, Next: ${c.nextAction || 'Pending'}`
  )
  .join('\n')}

### Daily Tasks for ${date} (${tasksToday.length} items, ${completedToday.length} completed):
${
  tasksToday.length === 0
    ? 'No tasks scheduled specifically for this day.'
    : tasksToday
        .map(
          (t) =>
            `- [${t.code}] ${t.title} (Assignee: ${memberMap.get(t.memberId) ?? 'Team'}, Status: ${t.status}, Priority: ${t.priority})`
        )
        .join('\n')
}

### Current Blockers & Critical Risks:
${
  blockedContent.length === 0 && blockedTasks.length === 0 && overdueTasks.length === 0
    ? 'No active blockers or overdue tasks reported.'
    : [
        ...blockedContent.map((c) => `- Content Blocker [${c.code} "${c.title}"]: ${c.blocker}`),
        ...blockedTasks.map((t) => `- Task Blocker [${t.code} "${t.title}"]: Status is blocked`),
        ...overdueTasks.slice(0, 5).map((t) => `- Overdue Task [${t.code} "${t.title}"]: Deadline was ${t.deadline}`),
      ].join('\n')
}

---
### Your Task:
Format your response as a professional daily operational briefing in clean Markdown with the following sections:
1. **Executive Snapshot**: 2-3 sentences summarizing today's key focus, launch commitments, and operational pulse.
2. **Publishing & Launches Today**: Specific content going live, target platforms, and responsible team members.
3. **High-Priority Action Items**: Top tasks that must be resolved today to maintain production cadence.
4. **Blockers & Risk Mitigation**: Exact bottlenecks needing intervention right now.
5. **Team Focus Recommendations**: Clear assignments and tactical suggestions for today's standup.
`.trim()

  return { prompt, contextSummary }
}

/**
 * Context for Monthly Performance & Production Report
 */
export function buildMonthlyReportPrompt(
  month: string,
  { workspace, content, members, reviews }: WorkspaceContextData
): { prompt: string; contextSummary: string } {
  const memberMap = new Map(members.map((m) => [m.id, m.name]))
  const monthContent = content.filter((c) => c.month === month)

  const published = monthContent.filter((c) => c.lifecycle === 'published' || Boolean(c.actualPublishDate))
  const inProgress = monthContent.filter((c) => c.lifecycle === 'active' || c.lifecycle === 'revision')
  const ideasOrCancelled = monthContent.filter((c) => c.lifecycle === 'idea' || c.lifecycle === 'cancelled')

  // Performance calculations
  let totalViews = 0
  let totalReach = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  let totalSaves = 0
  let measuredCount = 0

  for (const c of published) {
    if (c.performance) {
      if (typeof c.performance.views === 'number') totalViews += c.performance.views
      if (typeof c.performance.reach === 'number') totalReach += c.performance.reach
      if (typeof c.performance.likes === 'number') totalLikes += c.performance.likes
      if (typeof c.performance.comments === 'number') totalComments += c.performance.comments
      if (typeof c.performance.shares === 'number') totalShares += c.performance.shares
      if (typeof c.performance.saves === 'number') totalSaves += c.performance.saves
      measuredCount++
    }
  }

  const totalInteractions = totalLikes + totalComments + totalShares + totalSaves
  const avgEngagementRate =
    totalViews > 0 ? ((totalInteractions / totalViews) * 100).toFixed(2) + '%' : 'N/A'

  // Platform breakdown
  const platformCounts: Record<string, number> = {}
  for (const c of monthContent) {
    platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1
  }

  // Top performing posts
  const sortedByViews = [...published]
    .filter((c) => c.performance?.views)
    .sort((a, b) => (b.performance?.views ?? 0) - (a.performance?.views ?? 0))
    .slice(0, 5)

  // Reviews recorded for this month
  const monthReviews = reviews.filter((r) => r.weekStart.startsWith(month))

  const contextSummary = `Workspace: "${workspace.name}" | Month: ${month} | Total Planned: ${monthContent.length} | Published: ${published.length} | Tracked Views: ${totalViews.toLocaleString()} | Avg Engagement: ${avgEngagementRate}`

  const prompt = `
Generate an in-depth Monthly Content Performance & Operational Retrospective for month ${month} in ${APP_NAME}.

### Workspace Information:
- Workspace: ${workspace.name}
- Reporting Month: ${month}
- Team Size: ${members.length} active contributors

### Production Delivery Metrics:
- Total Content Items Tracked for ${month}: ${monthContent.length}
- Successfully Published / Shipped: ${published.length}
- In Active Production: ${inProgress.length}
- Ideas / Cancelled: ${ideasOrCancelled.length}
- Delivery Completion Rate: ${
    monthContent.length > 0 ? Math.round((published.length / monthContent.length) * 100) : 0
  }%

### Audience & Engagement Performance:
- Total Verified Views: ${totalViews.toLocaleString()}
- Total Reach: ${totalReach.toLocaleString()}
- Total Engagements (Likes + Comments + Shares + Saves): ${totalInteractions.toLocaleString()}
- Overall Engagement Rate: ${avgEngagementRate}
- Measured Posts: ${measuredCount} of ${published.length} published

### Content Distribution by Platform:
${Object.entries(platformCounts)
  .map(([platform, count]) => `- ${platform}: ${count} pieces (${Math.round((count / (monthContent.length || 1)) * 100)}%)`)
  .join('\n')}

### Top Performing Highlights:
${
  sortedByViews.length === 0
    ? 'No detailed post-publishing analytics logged for this month yet.'
    : sortedByViews
        .map(
          (c) =>
            `- [${c.code}] "${c.title}" on ${c.platform} (Owner: ${memberMap.get(c.ownerId) ?? 'Team'}) | Views: ${(c.performance?.views ?? 0).toLocaleString()} | Rating: ${c.performance?.rating || 'Unrated'} | Key Learning: ${c.performance?.keyLearning || 'None logged'}`
        )
        .join('\n')
}

### Weekly Review Notes from this Month:
${
  monthReviews.length === 0
    ? 'No weekly qualitative reviews logged for this month.'
    : monthReviews
        .map(
          (r) =>
            `- Week ${r.label} (${r.weekStart} to ${r.weekEnd}): Planned: "${r.planned}". Completed: "${r.completed}". Performed well: "${r.performedWell}". Needs attention: "${r.needsAttention}". Key wins: "${r.keyWins}". Key problems: "${r.keyProblems}"`
        )
        .join('\n')
}

---
### Your Task:
Write a comprehensive, publication-ready Monthly Retrospective & Strategy Report in clean Markdown:
1. **Executive Summary**: High-level score card of the month's creative output, milestone wins, and audience traction.
2. **Deliverables vs Targets**: Evaluation of output velocity, platform mix, and pipeline consistency.
3. **Audience & Content Insights**: Deep dive into what content themes, formats, and channels generated peak response.
4. **Production Friction & Bottlenecks**: Analysis of workflow delays, missed deadlines, or recurring blockers.
5. **Strategic Action Plan for Next Month**: 3-5 concrete, high-impact recommendations to accelerate growth and streamline team execution.
`.trim()

  return { prompt, contextSummary }
}

/**
 * Context for Pipeline Health & Velocity Report
 */
export function buildPipelineReportPrompt({
  workspace,
  content,
  members,
}: WorkspaceContextData): { prompt: string; contextSummary: string } {
  const memberMap = new Map(members.map((m) => [m.id, m.name]))
  const stages = workspace.stages

  const inFlight = content.filter((c) => c.lifecycle === 'active' || c.lifecycle === 'revision')
  const byStage: Record<string, ContentItem[]> = {}
  for (const s of stages) byStage[s.id] = []

  for (const c of inFlight) {
    // Find current active stage
    const currentStage = stages.find((s) => c.stageStates[s.id] === 'in_progress') || stages[0]
    if (currentStage && byStage[currentStage.id]) {
      byStage[currentStage.id].push(c)
    }
  }

  const contextSummary = `Workspace: "${workspace.name}" | Stages: ${stages.length} | In-flight items: ${inFlight.length}`

  const prompt = `
Analyze the current Content Production Pipeline Health & Throughput for workspace "${workspace.name}" in ${APP_NAME}.

### Production Stages:
${stages.map((s, idx) => `${idx + 1}. ${s.name} (Role: ${s.ownerRole})`).join('\n')}

### Stage Distribution (${inFlight.length} in-flight items):
${stages
  .map((s) => `- ${s.name}: ${(byStage[s.id] || []).length} items active`)
  .join('\n')}

### Active Pipeline Items Detail:
${inFlight
  .slice(0, 15)
  .map(
    (c) =>
      `- [${c.code}] "${c.title}" (${c.platform}) | Owner: ${memberMap.get(c.ownerId) ?? 'Team'} | Priority: ${c.priority} | Blocker: ${c.blocker || 'None'} | Next: ${c.nextAction || 'In progress'}`
  )
  .join('\n')}

---
Provide a tactical Pipeline Velocity Report:
1. **Flow & Bottleneck Analysis**: Which stages are congested and why?
2. **Urgent Items**: Content pieces at risk of missing deadlines.
3. **Workload Distribution**: Suggestions on balancing assignments across roles.
4. **Actionable Recommendations**: 3 immediate steps to accelerate production velocity.
`.trim()

  return { prompt, contextSummary }
}

/**
 * Context for Idea Bank & Content Strategy Report
 */
export function buildIdeaStrategyPrompt({
  workspace,
  ideas,
}: WorkspaceContextData): { prompt: string; contextSummary: string } {
  const highPotential = ideas.filter((i) => i.potential === 'High' || i.potential === 'Moonshot' || i.priority === 'P1')
  const contextSummary = `Workspace: "${workspace.name}" | Total Ideas: ${ideas.length} | High Potential: ${highPotential.length}`

  const prompt = `
Generate a Creative Content Ideation & Strategy Summary for workspace "${workspace.name}" based on its Idea Bank in ${APP_NAME}.

### Idea Bank Inventory (${ideas.length} total ideas):
${ideas
  .slice(0, 15)
  .map(
    (i) =>
      `- [${i.code}] "${i.topic}" | Platform: ${i.platform} | Format: ${i.contentType} | Potential: ${i.potential} | Priority: ${i.priority} | Notes: ${i.description || 'N/A'}`
  )
  .join('\n')}

---
Provide an inspiring Content Strategy Synthesis:
1. **Top 3 Ideas to Greenlight Immediately**: Select the strongest ideas with rationale and proposed hooks.
2. **Content Pillar & Narrative Trends**: Themes emerging from the team's brainstorms.
3. **Cross-Platform Repurposing Angles**: How to turn top concepts into multi-platform campaigns (e.g. YouTube Longform -> 3 Shorts -> LinkedIn Carousel -> Newsletter).
`.trim()

  return { prompt, contextSummary }
}

/**
 * Pre-generated Simulation / Sample reports when Ollama is offline or being tested
 */
export function generateSimulatedReport(type: 'daily' | 'monthly' | 'pipeline' | 'ideas', _title?: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)

  if (type === 'daily') {
    return `# Daily Operations Briefing — ${today}
*Generated by FLUX Local AI Assistant*

## 1. Executive Snapshot
Today's focus is executing final revisions for our core product announcement and ensuring cross-platform promotional assets are scheduled without delay. Delivery cadence remains stable with **3 key deliverables** moving across the finish line.

## 2. Publishing & Deliverables Today
- **CN-0012: "Behind the Scenes: How We Built Our Fast Rendering Pipeline"**
  - **Platform:** YouTube (Longform) & LinkedIn
  - **Owner:** Sarah Jenkins (Lead Editor)
  - **Status:** Final polish in editing; scheduled to publish at 3:00 PM EST.
- **CN-0015: "3 Mistakes Social Media Teams Make in 2026"**
  - **Platform:** Instagram Reels & TikTok
  - **Owner:** Alex Rivera (Shortform Producer)
  - **Status:** Export verified, captions and hashtags configured.

## 3. High-Priority Action Items
1. **Approve Thumbnail Variants:** Review thumbnail choice for CN-0012 before 1:00 PM.
2. **Sound Design Sync:** Marcus to complete audio mastering on reels clip by noon.
3. **Copy Review:** Community manager to schedule initial response thread on X.

## 4. Blockers & Risk Mitigation
- **CN-0018 Audio Sync Issue:** Client feedback indicated minor distortion on voiceover track.
  - *Mitigation:* Re-exporting via high-bitrate WAV; expected resolution within 45 minutes.

## 5. Team Standup Recommendations
- Keep standup capped at 10 minutes.
- Focus primary design attention on the upcoming weekly carousel deck.
`
  }

  if (type === 'monthly') {
    return `# Monthly Content Performance & Retrospective — ${currentMonth}
*Generated by FLUX Local AI Assistant*

## 1. Executive Summary
During ${currentMonth}, our team produced and distributed **24 pieces of original content**, achieving a **92% on-time delivery rate**. Total audience reach expanded by **28% month-over-month**, spearheaded by high-retention technical breakdown reels and opinion carousels.

| Metric | Target | Actual | Variance |
| :--- | :--- | :--- | :--- |
| Planned Content | 25 | 24 | -4% |
| Verified Views | 250,000 | 382,400 | **+52.9%** |
| Total Engagements | 15,000 | 22,890 | **+52.6%** |
| Avg. Engagement Rate | 4.5% | 5.98% | **+1.48%** |

## 2. Deliverables vs Targets
- **Shortform Video (Reels/Shorts/TikTok):** 14 published. High velocity, lowest production lag (avg. 2.1 days per item).
- **Longform YouTube:** 4 published. High viewer retention (avg. 48% completion rate).
- **Text & Carousels (LinkedIn/X):** 6 published. Highest lead capture rate.

## 3. Audience & Content Insights
1. **The "Deep Technical Breakdown" series** dominated viewership, driving 61% of all new subscribers.
2. **Visual Carousels** produced 3.8x more bookmarks/saves than standard image posts, proving strong educational value.
3. **Audience Drop-off Point:** Viewers dropped at the 18-second mark on shortform videos whenever title captions were delayed.

## 4. Production Bottlenecks & Friction
- **Script-to-Review Loop:** Script approvals averaged 4.2 days, creating an artificial squeeze on the editing team towards month-end.
- **Asset Handoffs:** Raw footage uploads occasionally lagged due to uncompressed 4K files.

## 5. Strategic Recommendations for Next Month
1. **Implement 48-Hour Script Sign-off:** Institute an asynchronous review window so video editing begins on schedule.
2. **Repurpose Top 3 Winners:** Turn this month's highest-performing YouTube video into a 5-part micro-series.
3. **Double Down on Carousels:** Increase LinkedIn carousel frequency from 1/week to 2/week.
`
  }

  if (type === 'pipeline') {
    return `# Content Pipeline Velocity & Health Analysis
*Generated by FLUX Local AI Assistant*

## 1. Flow & Bottleneck Analysis
- **Current Active Items:** 11 in flight across all pipeline stages.
- **Stage Concentration:**
  - *Idea / Briefing:* 2 items
  - *Scripting & Copy:* 2 items
  - *Shooting / Production:* 1 item
  - *Editing & Polish:* 4 items (⚠️ Current Bottleneck)
  - *Scheduled:* 2 items

## 2. At-Risk Content Deliverables
- **CN-0022:** Editing turnaround has exceeded the 3-day target by 18 hours.
- **CN-0025:** Missing brand logo overlay in secondary cut.

## 3. Recommended Balancing Actions
- Temporarily reassign assistant editor to assist with b-roll cuts.
- Establish clean cut-off times for review feedback to prevent endless revision loops.
`
  }

  return `# Content Ideation & Creative Strategy Synthesis
*Generated by FLUX Local AI Assistant*

## 1. Top 3 High-Impact Concepts to Greenlight
1. **"The 10-Minute Workflow That Saved Our Social Team 20 Hours a Week"**
   - *Format:* YouTube Longform + LinkedIn Carousel
   - *Hook:* "Most teams waste 70% of their production time searching for assets. Here is the exact folder structure we use."
2. **"Why Aesthetic Feeds Are Dead in 2026"**
   - *Format:* Reel / Short
   - *Hook:* "Stop perfecting your grid. The algorithm only cares about watch time and saves. Here is what actually works now."
3. **"From Idea to Published: A Full Content Teardown"**
   - *Format:* Multi-Slide Breakdown

## 2. Core Creative Pillars
- Operational transparency & productivity systems.
- Data-driven audience growth case studies.
- Behind-the-scenes tool setup and studio gear.
`
}
