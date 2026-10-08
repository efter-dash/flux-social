/**
 * Production format definitions and contextual segment routing.
 *
 * Provides the first-layer selector when creating or editing content:
 * - Static (graphic design, carousels, social images)
 * - A Video (video graphics, photo shoot, video editing, reels)
 * - Written content (newsletters, blogs, threads, articles)
 * - A Brief (creative briefs, campaign deliverables, client work)
 *
 * Dynamically tailors visible pipeline stages, required segments, and production metadata.
 */

import type { IconName } from '@/components/ui/Icon'
import { getStageCanonical } from './pipelineMerge'
import type { ContentItem, ProductionFormat, Stage } from './types'

export interface ProductionFormatDef {
  id: ProductionFormat
  label: string
  icon: IconName
  tagline: string
  description: string
  defaultType: string
  contentTypes: string[]
  subCategories: string[]
  relevantStageKeys: string[]
}

export interface WorkflowPresetDef {
  id: string
  name: string
  badge: string
  tagline: string
  description: string
  pipelines: string[]
  formats: ProductionFormat[]
  subCategories: string[]
  categories?: string[]
}

export const CORE_TAXONOMY_CATEGORIES = [
  'Product',
  'Behind the Scenes',
  'Educational',
  'Promotional',
  'Community',
]

export const FULL_TAXONOMY_CATEGORIES = [
  'Product',
  'Brand',
  'Educational',
  'Promotional',
  'Customer Story',
  'Behind the Scenes',
  'Announcement',
  'Community',
  'Seasonal',
]

export const PRODUCTION_FORMATS: ProductionFormatDef[] = [
  {
    id: 'static',
    label: 'Static',
    icon: 'layers',
    tagline: 'Thumbnails, Carousels, Graphics',
    description: 'Design segment with sub categories for Thumbnails, Carousels, canvas dimensions, and visual specs.',
    defaultType: 'Thumbnails',
    contentTypes: ['Thumbnails', 'Carousel', 'Graphic Post', 'Banner / Header', 'Infographic', 'Story / Vertical Graphic'],
    subCategories: ['Thumbnails', 'Carousel', 'Graphic Post', 'Banner / Header', 'Infographic', 'Story / Vertical Graphic'],
    relevantStageKeys: ['brief', 'copy', 'design', 'production', 'review', 'client-approval'],
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'play',
    tagline: 'Reels, Shorts, Video Graphics',
    description: 'Photo shoot & video production segments with raw footage, aspect ratios, and editing cuts.',
    defaultType: 'Reels & Shorts (9:16)',
    contentTypes: ['Reels & Shorts (9:16)', 'Long-Form Video (16:9)', 'Video Graphics & Motion Promo', 'Interview & Podcast Video'],
    subCategories: ['Reels & Shorts (9:16)', 'Long-Form Video (16:9)', 'Video Graphics & Motion Promo', 'Interview & Podcast Video'],
    relevantStageKeys: ['brief', 'script', 'shoot', 'production', 'editing', 'review', 'client-approval'],
  },
  {
    id: 'written',
    label: 'Write-Up',
    icon: 'notes',
    tagline: 'Blogs, Newsletters, Articles',
    description: 'Editorial segment with outlines, target word counts, drafting docs, and SEO keywords.',
    defaultType: 'Blog Post',
    contentTypes: ['Blog Post', 'Newsletter', 'Social Thread', 'Case Study & Article'],
    subCategories: ['Blog Post', 'Newsletter', 'Social Thread', 'Case Study & Article'],
    relevantStageKeys: ['outline', 'draft', 'copy', 'editing', 'review', 'client-approval'],
  },
  {
    id: 'brief',
    label: 'Brief',
    icon: 'target',
    tagline: 'Campaign Briefs & Strategy',
    description: 'Strategic briefing segment with client stakeholders, key messages, and approval gates.',
    defaultType: 'Campaign Brief',
    contentTypes: ['Campaign Brief', 'Client Deliverable & Scope', 'Creative Concept & Pitch'],
    subCategories: ['Campaign Brief', 'Client Deliverable & Scope', 'Creative Concept & Pitch'],
    relevantStageKeys: ['brief', 'production', 'review', 'client-approval'],
  },
]

export const WORKFLOW_PRESETS: WorkflowPresetDef[] = [
  {
    id: 'all',
    name: 'All-in-One Studio (Full Suite)',
    badge: 'Full Suite',
    tagline: 'All pipelines & all fields included',
    description: 'Complete suite with Video, Static Graphics, Write-Up, and Briefing workflows. Ideal for teams that want every option active.',
    pipelines: ['video', 'design'],
    formats: ['video', 'static', 'written', 'brief'],
    subCategories: [
      'Reels & Shorts (9:16)',
      'Long-Form Video (16:9)',
      'Video Graphics & Motion Promo',
      'Interview & Podcast Video',
      'Thumbnails',
      'Carousel',
      'Graphic Post',
      'Banner / Header',
      'Infographic',
      'Story / Vertical Graphic',
      'Blog Post',
      'Newsletter',
      'Social Thread',
      'Case Study & Article',
      'Campaign Brief',
      'Client Deliverable & Scope',
      'Creative Concept & Pitch',
    ],
    categories: FULL_TAXONOMY_CATEGORIES,
  },
  {
    id: 'video',
    name: 'Video Production Studio',
    badge: 'Video Focused',
    tagline: 'Reels, long-form, podcasts & thumbnails',
    description: 'Streamlined exclusively for video creation, editing, and YouTube/IG thumbnails. Hides written articles and corporate briefs.',
    pipelines: ['video'],
    formats: ['video', 'static'],
    subCategories: [
      'Reels & Shorts (9:16)',
      'Long-Form Video (16:9)',
      'Video Graphics & Motion Promo',
      'Interview & Podcast Video',
      'Thumbnails',
    ],
    categories: CORE_TAXONOMY_CATEGORIES,
  },
  {
    id: 'graphics',
    name: 'Graphics & Visual Design',
    badge: 'Graphics Focused',
    tagline: 'Thumbnails, carousels, banners & posters',
    description: 'Focused on graphic artists and digital visual designers. Omits video shooting, editing, and editorial writing.',
    pipelines: ['design'],
    formats: ['static'],
    subCategories: [
      'Thumbnails',
      'Carousel',
      'Graphic Post',
      'Banner / Header',
      'Infographic',
      'Story / Vertical Graphic',
    ],
    categories: CORE_TAXONOMY_CATEGORIES,
  },
  {
    id: 'written',
    name: 'Editorial & Copywriting',
    badge: 'Editorial Focused',
    tagline: 'Blogs, newsletters, threads & articles',
    description: 'Tailored for publications, newsletter writers, and copywriters. Streamlines the workflow to focus solely on written pieces.',
    pipelines: ['written'],
    formats: ['written'],
    subCategories: [
      'Blog Post',
      'Newsletter',
      'Social Thread',
      'Case Study & Article',
    ],
    categories: ['Educational', 'Customer Story', 'Brand', 'Product', 'Seasonal'],
  },
]

export function getAllSubCategories(): string[] {
  return PRODUCTION_FORMATS.flatMap((f) => f.subCategories)
}

export function getPresetById(id: string): WorkflowPresetDef {
  return WORKFLOW_PRESETS.find((p) => p.id === id) || WORKFLOW_PRESETS[0]
}

/**
 * Automatically infers the production format from existing item properties.
 * Defaults to 'video' for new content items to immediately expose video production fields.
 */
export function detectProductionFormat(
  item: Partial<ContentItem>,
  defaultFallback: ProductionFormat = 'video',
): ProductionFormat {
  if (item.productionFormat) return item.productionFormat

  const ct = item.contentType?.trim().toLowerCase() || ''
  if (ct) {
    if (['reel', 'short video', 'long video', 'story video', 'podcast video', 'video graphic', 'video', 'long-form'].some((v) => ct.includes(v))) {
      return 'video'
    }
    if (['thumbnail', 'thumb', 'yt', 'ig', 'fb', 'carousel', 'static', 'infographic', 'banner', 'image', 'graphic', 'story / vertical'].some((v) => ct.includes(v))) {
      return 'static'
    }
    if (['write-up', 'writeup', 'blog', 'newsletter', 'thread', 'article', 'essay'].some((v) => ct.includes(v))) {
      return 'written'
    }
    if (['brief', 'campaign', 'deliverable', 'strategy', 'concept', 'pitch'].some((v) => ct.includes(v))) {
      return 'brief'
    }
  }

  if (item.pipelineId === 'video') return 'video'
  if (item.pipelineId === 'design') return 'static'
  if (item.pipelineId === 'written') return 'written'
  if (item.pipelineId === 'agency') return 'brief'

  return defaultFallback
}

/**
 * Filters the workspace pipeline stages to only the production segments
 * that make sense for the chosen format and subcategory.
 */
export function filterStagesForFormat(
  stages: Stage[],
  format: ProductionFormat,
  subCategory?: string,
): Stage[] {
  const def = PRODUCTION_FORMATS.find((f) => f.id === format)
  if (!def) return stages

  let allowedKeys = new Set(def.relevantStageKeys)

  // Subcategory specific tailoring
  if (format === 'video' && subCategory === 'Video Graphics & Motion Promo') {
    // Pure motion graphics does not require on-location shoot stage
    allowedKeys = new Set(['brief', 'script', 'design', 'production', 'editing', 'review', 'client-approval'])
  }

  const filtered = stages.filter((stage) => {
    const canonical = getStageCanonical(stage.name)
    return allowedKeys.has(canonical.key)
  })

  // If filtering left at least 2 stages, return filtered; otherwise fallback to full pipeline
  return filtered.length >= 2 ? filtered : stages
}
