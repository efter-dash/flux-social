import type { ContentItem, Member, Stage } from './types'
import { PIPELINE_TEMPLATES } from './templates'
import { PRODUCTION_FORMATS } from './productionFormats'
import { memberName, stageState, stageLabel } from './derive'

const STAGE_STATE_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
  blocked: 'Blocked',
}

const LIFECYCLE_LABELS: Record<string, string> = {
  idea: 'Idea (Not Started)',
  active: 'Active (In Production)',
  revision: 'Revision (Changes Requested)',
  published: 'Published (Live)',
  cancelled: 'Cancelled',
}

/**
 * Strips any asterisk (*) characters and resolves markdown formatting
 * to guarantee clean, professional text for word processors (Word, Docs, Notes).
 */
function cleanText(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  if (!str) return ''
  // Remove markdown bold/italic asterisks and list asterisks without disrupting content
  return str
    .replace(/\*\*/g, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\*/g, '')
    .trim()
}

/**
 * Formats all populated content item fields into clean, structured plain text
 * and HTML suitable for Word, Google Docs, Apple Notes, Notion, etc.
 *
 * Guarantees:
 * 1. Zero asterisk (*) characters anywhere in the text.
 * 2. No extra gaps, empty rows, or blank line breaks.
 * 3. Human-readable structured layout with distinct section headers.
 */
export function formatContentDetails(
  item: ContentItem,
  stages: Stage[],
  members: Member[],
): { plainText: string; htmlText: string } {
  const meta = item.productionMeta || {}
  const sections: { title: string; lines: { label?: string; value: string; isBlock?: boolean }[] }[] = []

  // Helper to add a field if value is non-empty
  const addField = (
    lines: { label?: string; value: string; isBlock?: boolean }[],
    label: string,
    rawVal: unknown,
    isBlock = false,
  ) => {
    const val = cleanText(rawVal)
    if (val) {
      lines.push({ label, value: val, isBlock })
    }
  }

  // 1. OVERVIEW & CLASSIFICATION
  const overviewLines: { label?: string; value: string; isBlock?: boolean }[] = []
  addField(overviewLines, 'Content Code', item.code)
  addField(overviewLines, 'Title', item.title || 'Untitled Content')

  const formatDef = PRODUCTION_FORMATS.find((f) => f.id === item.productionFormat)
  if (formatDef) {
    addField(overviewLines, 'Primary Segment', formatDef.label)
  }
  addField(overviewLines, 'Sub-category', item.contentType)

  const lifecycleLabel = LIFECYCLE_LABELS[item.lifecycle] || cleanText(item.lifecycle)
  addField(overviewLines, 'Lifecycle Status', lifecycleLabel)

  const activeStageLabel = cleanText(stageLabel(item, stages))
  if (activeStageLabel && activeStageLabel !== lifecycleLabel) {
    addField(overviewLines, 'Workflow Stage', activeStageLabel)
  }

  addField(overviewLines, 'Topic / Theme', item.topic)
  addField(overviewLines, 'Category', item.category)
  addField(overviewLines, 'Primary Platform', item.platform)
  if (item.crossPost && item.crossPost.length > 0) {
    addField(overviewLines, 'Also Posted To', item.crossPost.join(', '))
  }
  addField(overviewLines, 'Priority', item.priority)
  addField(overviewLines, 'Business Objective', item.objective)
  addField(overviewLines, 'Target Audience', item.audience)

  const owner = members.find((m) => m.id === item.ownerId)
  if (owner) {
    addField(overviewLines, 'Content Owner', `${owner.name} (${owner.role})`)
  } else if (item.ownerId) {
    addField(overviewLines, 'Content Owner', memberName(members, item.ownerId))
  }

  if (item.pipelineId) {
    const pipe = PIPELINE_TEMPLATES.find((p) => p.id === item.pipelineId)
    addField(overviewLines, 'Production Pipeline', pipe ? pipe.name : item.pipelineId)
  }

  if (overviewLines.length > 0) {
    sections.push({ title: 'CONTENT OVERVIEW', lines: overviewLines })
  }

  // 2. SCHEDULE & TIMELINE
  const scheduleLines: { label?: string; value: string; isBlock?: boolean }[] = []
  addField(scheduleLines, 'Planning Month', item.month)
  addField(scheduleLines, 'Planned Publish Date', item.plannedPublishDate)
  addField(scheduleLines, 'Actual Publish Date', item.actualPublishDate)
  if (scheduleLines.length > 0) {
    sections.push({ title: 'SCHEDULE & DATES', lines: scheduleLines })
  }

  // 3. STAGE WORKFLOW & ASSIGNEES
  if (stages.length > 0) {
    const stageLines: { label?: string; value: string; isBlock?: boolean }[] = []
    stages.forEach((s, idx) => {
      const stateKey = stageState(item, s.id)
      const stateLabel = STAGE_STATE_LABELS[stateKey] || stateKey
      const assigneeId = item.stageAssignees?.[s.id]
      const assignee = assigneeId ? memberName(members, assigneeId) : ''
      const deadline = item.stageDeadlines?.[s.id]

      const parts = [`Stage ${idx + 1}: ${s.name}`, `Status: ${stateLabel}`]
      if (assignee && assignee !== '—') parts.push(`Assignee: ${assignee}`)
      if (deadline) parts.push(`Deadline: ${deadline}`)

      stageLines.push({
        value: parts.join(' | '),
      })
    })
    if (stageLines.length > 0) {
      sections.push({ title: 'PRODUCTION STAGES & WORKFLOW', lines: stageLines })
    }
  }

  // 4. WHERE IT STANDS (NEXT ACTION & BLOCKERS)
  const statusLines: { label?: string; value: string; isBlock?: boolean }[] = []
  addField(statusLines, 'Next Action', item.nextAction)
  addField(statusLines, 'Current Blocker', item.blocker)
  if (statusLines.length > 0) {
    sections.push({ title: 'WHERE IT STANDS', lines: statusLines })
  }

  // 5. PRODUCTION SPECIFICATIONS (FORMAT-SPECIFIC)
  const specLines: { label?: string; value: string; isBlock?: boolean }[] = []

  // Video specs
  addField(specLines, 'Video Hook', meta.videoHook)
  addField(specLines, 'Aspect Ratio', meta.aspectRatio)
  addField(specLines, 'Custom Ratio', meta.customRatio)
  addField(specLines, 'Target Duration', meta.duration)
  addField(specLines, 'Shoot Style', meta.shootStyle)
  addField(specLines, 'Shoot Location', meta.shootLocation)
  addField(specLines, 'Shoot Date', meta.shootDate)
  addField(specLines, 'Presenter / Talent Notes', meta.talentNotes)
  addField(specLines, 'Shot List', meta.shotList, true)
  addField(specLines, 'Sound & Audio Notes', meta.soundNotes)
  addField(specLines, 'Trending Audio / Track', meta.trendingAudio)
  addField(specLines, 'Subtitle Style', meta.subtitleStyle)
  addField(specLines, 'Video Editing Notes', meta.editingNotes)
  addField(specLines, 'Motion Graphics Notes', meta.motionGraphicsNotes)
  addField(specLines, 'Animation Tool', meta.animationTool)
  addField(specLines, 'Guest Notes', meta.guestNotes)
  addField(specLines, 'Chapter Outline', meta.chapterNotes)
  addField(specLines, 'Rough Cut Link', meta.roughCutUrl)
  addField(specLines, 'Workfile Link', meta.workfileUrl)
  addField(specLines, 'Raw Footage Link', meta.rawFootageUrl)

  // Static / Graphic design specs
  addField(specLines, 'Target Platform / Format', meta.thumbnailPlatform)
  addField(specLines, 'Canvas Dimensions', meta.dimensions)
  addField(specLines, 'Design Software', meta.designTool)
  addField(specLines, 'Export Format', meta.exportFormat)
  addField(specLines, 'Graphic Headline', meta.graphicHeadline)
  addField(specLines, 'Thumbnail Text', meta.thumbnailText)
  addField(specLines, 'A/B Testing Variant', meta.abVariant)
  addField(specLines, 'Post Style / Layout', meta.postStyle)
  addField(specLines, 'Background & Palette', meta.backgroundStyle)
  addField(specLines, 'Focal Asset / Cutout Link', meta.thumbnailCutoutUrl || meta.focalAssetUrl)
  addField(specLines, 'Visual Brief Link', meta.visualBriefUrl)
  addField(specLines, 'Figma Project Link', meta.figmaUrl)
  addField(specLines, 'Design Notes', meta.designNotes, true)

  // Carousel specs
  if (meta.slideCount) addField(specLines, 'Slide Count', `${meta.slideCount} slides`)
  addField(specLines, 'Carousel Hook Headline', meta.carouselHookHeadline)
  addField(specLines, 'Carousel Outline & Slide Flow', meta.carouselOutline, true)
  addField(specLines, 'Visual Flow & Layout', meta.carouselVisualFlow)
  addField(specLines, 'Final Call To Action', meta.carouselFinalCta)

  // Banner specs
  addField(specLines, 'Banner Placement', meta.bannerPlacement)
  addField(specLines, 'Banner Tagline', meta.bannerTagline)
  addField(specLines, 'Safe Zone Notes', meta.bannerSafeZoneNotes)
  addField(specLines, 'Banner CTA', meta.bannerCta)

  // Infographic specs
  addField(specLines, 'Infographic Type', meta.infographicType)
  if (meta.infographicSectionCount) addField(specLines, 'Section Count', `${meta.infographicSectionCount} sections`)
  addField(specLines, 'Data Source Link', meta.dataSourceUrl)
  addField(specLines, 'Information Hierarchy Notes', meta.infographicHierarchyNotes)

  // Story specs
  if (meta.storyFrameCount) addField(specLines, 'Story Frame Count', `${meta.storyFrameCount} frames`)
  addField(specLines, 'Interactive Elements', meta.storyInteractivity)
  addField(specLines, 'Story Swipe-Up / Link URL', meta.storyLinkUrl)
  addField(specLines, 'Story Safe Zone Notes', meta.storySafeZoneNotes)

  // Written / Editorial specs
  if (meta.wordCountTarget) addField(specLines, 'Target Word Count', `${meta.wordCountTarget} words`)
  addField(specLines, 'Editorial Tone & Angle', meta.editorialTone)
  addField(specLines, 'Primary SEO Keywords', meta.seoKeywords)
  addField(specLines, 'Email Subject Line', meta.subjectLine)
  if (meta.threadCount) addField(specLines, 'Thread Post Count', `${meta.threadCount} posts`)
  addField(specLines, 'Article Outline & Core Thesis', meta.outlineNotes, true)
  addField(specLines, 'Draft Document Link', meta.draftUrl)
  addField(specLines, 'Proofreader & Fact-Checking Notes', meta.proofreadNotes)
  addField(specLines, 'Primary Call To Action', meta.callToAction)

  // Strategic Brief specs
  addField(specLines, 'Brand / Client Name', meta.clientName)
  addField(specLines, 'Campaign Budget', meta.campaignBudget)
  addField(specLines, 'Pitch Presentation Date', meta.clientSignoffDate)
  addField(specLines, 'Campaign Rollout / Deliverables', meta.deliverables || meta.scopeSummary, true)
  addField(specLines, 'Moodboard & Visual References', meta.moodboardUrl)

  if (specLines.length > 0) {
    const specTitle = formatDef ? `${formatDef.label.toUpperCase()} SPECIFICATIONS` : 'PRODUCTION SPECIFICATIONS'
    sections.push({ title: specTitle, lines: specLines })
  }

  // 6. SOCIAL COPY & DISTRIBUTION
  const socialLines: { label?: string; value: string; isBlock?: boolean }[] = []
  addField(socialLines, 'Caption', item.caption, true)
  addField(socialLines, 'Hashtags', item.hashtags)
  if (socialLines.length > 0) {
    sections.push({ title: 'SOCIAL COPY & DISTRIBUTION', lines: socialLines })
  }

  // 7. ASSET & DOCUMENT LINKS
  const linkLines: { label?: string; value: string; isBlock?: boolean }[] = []
  if (item.links) {
    addField(linkLines, 'Creative Brief Link', item.links.brief)
    addField(linkLines, 'Raw Assets Link', item.links.raw)
    addField(linkLines, 'Final Deliverable Link', item.links.final)
    addField(linkLines, 'Published URL', item.links.published)
  }
  if (linkLines.length > 0) {
    sections.push({ title: 'ASSET & RESOURCE LINKS', lines: linkLines })
  }

  // 8. NOTES & REMARKS
  const remarkLines: { label?: string; value: string; isBlock?: boolean }[] = []
  addField(remarkLines, 'Team Notes & Feedback', item.remarks, true)
  if (remarkLines.length > 0) {
    sections.push({ title: 'NOTES & REMARKS', lines: remarkLines })
  }

  // BUILD PLAIN TEXT
  // Structured sections separated by exactly one blank line (\n\n).
  // Zero asterisks (*) anywhere. No extra gaps.
  const plainTextSections: string[] = []

  for (const sec of sections) {
    const secLines: string[] = [sec.title]
    for (const itemLine of sec.lines) {
      if (itemLine.label) {
        if (itemLine.isBlock && itemLine.value.includes('\n')) {
          secLines.push(`${itemLine.label}:`)
          const indented = itemLine.value
            .split('\n')
            .map((l) => (l.trim() ? `  ${l.trim()}` : ''))
            .filter(Boolean)
            .join('\n')
          secLines.push(indented)
        } else {
          secLines.push(`${itemLine.label}: ${itemLine.value}`)
        }
      } else {
        secLines.push(itemLine.value)
      }
    }
    plainTextSections.push(secLines.join('\n'))
  }

  const plainText = plainTextSections.join('\n\n')

  // BUILD RICH HTML
  // Clean HTML suitable for Google Docs, Word, Apple Notes with bold labels,
  // semantic headings, and zero asterisks (*).
  const htmlSections: string[] = []
  for (const sec of sections) {
    let secHtml = `<h3 style="font-size: 14pt; margin: 12pt 0 4pt 0; color: #111827; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${sec.title}</h3>`
    secHtml += `<div style="font-size: 11pt; line-height: 1.5; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`
    for (const itemLine of sec.lines) {
      if (itemLine.label) {
        if (itemLine.isBlock && itemLine.value.includes('\n')) {
          const escaped = itemLine.value
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .join('<br>')
          secHtml += `<div style="margin-bottom: 6pt;"><strong>${itemLine.label}:</strong><div style="margin-top: 2pt; padding-left: 10pt; color: #4b5563;">${escaped}</div></div>`
        } else {
          secHtml += `<div style="margin-bottom: 4pt;"><strong>${itemLine.label}:</strong> ${itemLine.value}</div>`
        }
      } else {
        secHtml += `<div style="margin-bottom: 4pt;">${itemLine.value}</div>`
      }
    }
    secHtml += `</div>`
    htmlSections.push(secHtml)
  }

  const htmlText = `<div style="max-width: 650px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${htmlSections.join('')}</div>`

  return { plainText, htmlText }
}

/**
 * Copies the structured content details to the user's clipboard.
 * Writes rich text and plain text simultaneously if supported,
 * falling back safely across iframe contexts and older browsers.
 */
export async function copyContentToClipboard(
  item: ContentItem,
  stages: Stage[],
  members: Member[],
): Promise<boolean> {
  const { plainText, htmlText } = formatContentDetails(item, stages, members)

  // Modern Async Clipboard API with rich HTML and plain text
  if (navigator.clipboard && window.isSecureContext) {
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const itemBlob = new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
        })
        await navigator.clipboard.write([itemBlob])
        return true
      }
    } catch {
      // Fall through to plain text
    }

    try {
      await navigator.clipboard.writeText(plainText)
      return true
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  // Universal fallback for iframe or restricted permissions
  try {
    const textArea = document.createElement('textarea')
    textArea.value = plainText
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '-9999px'
    textArea.setAttribute('readonly', '')
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}
