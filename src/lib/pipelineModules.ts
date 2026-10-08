/**
 * Pipeline & Module Registry.
 *
 * Defines each production pipeline and its modular components.
 * Users can re-configure their workspace at any time by checking or unchecking
 * specific modules in Settings, dynamically tailoring:
 * - Active pipeline stages
 * - Content formats & subcategories in the 'New Content' form
 * - Specific form field sections (filming, motion graphics, sound, etc.)
 */

import type { IconName } from '@/components/ui/Icon'
import type { ProductionFormat, Stage, Workspace } from './types'
import { getAllSubCategories } from './productionFormats'
import { stagesFromPipelines } from './factories'

export interface PipelineModuleDef {
  id: string
  name: string
  label: string
  blurb: string
  subCategory?: string
  featureKey?: string
  defaultActive: boolean
}

export interface PipelineSectionDef {
  id: 'video' | 'design' | 'written' | 'agency'
  name: string
  label: string
  format: ProductionFormat
  icon: IconName
  blurb: string
  color: string
  modules: PipelineModuleDef[]
}

export const PIPELINE_SECTIONS: PipelineSectionDef[] = [
  {
    id: 'video',
    name: 'Video Production Pipeline',
    label: 'Video',
    format: 'video',
    icon: 'play',
    blurb: 'Photo shoot & video production pipeline from scripting to rough cuts and final delivery.',
    color: '#ff3d3d',
    modules: [
      {
        id: 'video_reels',
        name: 'Reels & Shorts (9:16)',
        label: 'Reels & Shorts',
        blurb: 'Vertical short-form videos for Instagram Reels, YouTube Shorts, and TikTok with trending audio & hooks.',
        subCategory: 'Reels & Shorts (9:16)',
        defaultActive: true,
      },
      {
        id: 'video_longform',
        name: 'Long-Form Video (16:9)',
        label: 'Long-Form Video',
        blurb: 'Horizontal broadcast, tutorials, and YouTube long-form content with timestamps & chapter cues.',
        subCategory: 'Long-Form Video (16:9)',
        defaultActive: true,
      },
      {
        id: 'video_motion',
        name: 'Motion Graphics & VFX',
        label: 'Motion Graphics',
        blurb: 'Animated promos, title sequences, lower thirds, and visual effects rendering notes.',
        subCategory: 'Video Graphics & Motion Promo',
        defaultActive: true,
      },
      {
        id: 'video_podcast',
        name: 'Interviews & Podcasts',
        label: 'Interviews & Podcasts',
        blurb: 'Multi-camera podcast recording, guest interview notes, microphone setups, and viral clip timestamp cues.',
        subCategory: 'Interview & Podcast Video',
        defaultActive: true,
      },
      {
        id: 'video_scripting',
        name: 'Scriptwriting & Hooks',
        label: 'Script & Concept',
        blurb: 'Opening video hooks, talking point outlines, teleprompter scripts, and narrative structure.',
        featureKey: 'scripting',
        defaultActive: true,
      },
      {
        id: 'video_filming',
        name: 'Camera & Shoot Style',
        label: 'Filming & Shoot Style',
        blurb: 'Outdoor shoot profiles, studio lighting, handheld UGC creator styles, and camera gear notes.',
        featureKey: 'filming',
        defaultActive: true,
      },
      {
        id: 'video_editing',
        name: 'Editing, Cuts & Sound',
        label: 'Editing & Sound',
        blurb: 'Footage workfile links, rough cut previews, sound design notes, and audio mixing.',
        featureKey: 'editing',
        defaultActive: true,
      },
    ],
  },
  {
    id: 'design',
    name: 'Graphics & Design Pipeline',
    label: 'Graphics & Design',
    format: 'static',
    icon: 'layers',
    blurb: 'Visual design pipeline for thumbnails, carousels, infographics, and brand canvas artwork.',
    color: '#3b9ae1',
    modules: [
      {
        id: 'design_thumbnails',
        name: 'Thumbnails',
        label: 'Thumbnails',
        blurb: 'High-CTR YouTube, Instagram, and Facebook thumbnail designs with aspect ratios and headline text overlays.',
        subCategory: 'Thumbnails',
        defaultActive: true,
      },
      {
        id: 'design_carousels',
        name: 'Carousels & Multi-Slide',
        label: 'Carousels',
        blurb: '4:5 portrait Instagram carousels and LinkedIn PDF slide decks with slide count tracking.',
        subCategory: 'Carousel',
        defaultActive: true,
      },
      {
        id: 'design_posts',
        name: 'Graphic Posts',
        label: 'Graphic Posts',
        blurb: '1:1 square feed graphics, promo flyers, announcement cards, and quotes.',
        subCategory: 'Graphic Post',
        defaultActive: true,
      },
      {
        id: 'design_banners',
        name: 'Banners & Headers',
        label: 'Banners & Headers',
        blurb: 'YouTube channel banners, LinkedIn headers, website hero artwork, and event covers.',
        subCategory: 'Banner / Header',
        defaultActive: true,
      },
      {
        id: 'design_infographics',
        name: 'Infographics & Long Visuals',
        label: 'Infographics',
        blurb: '9:16 vertical long infographics, statistical data cards, and comparison charts.',
        subCategory: 'Infographic',
        defaultActive: true,
      },
      {
        id: 'design_stories',
        name: 'Stories & Vertical Graphics',
        label: 'Stories & Mobile Visuals',
        blurb: 'Fullscreen 9:16 mobile graphic stories, event announcements, and temporary highlights.',
        subCategory: 'Story / Vertical Graphic',
        defaultActive: true,
      },
      {
        id: 'design_workfiles',
        name: 'Design Workfiles & Tools',
        label: 'Design Tools & Files',
        blurb: 'Figma, Illustrator, Photoshop workfile URLs, canvas dimensions, and export specs.',
        featureKey: 'design_tools',
        defaultActive: true,
      },
    ],
  },
  {
    id: 'written',
    name: 'Editorial & Writing Pipeline',
    label: 'Editorial & Writing',
    format: 'written',
    icon: 'notes',
    blurb: 'Copywriting and editorial pipeline for long-form articles, newsletters, and social threads.',
    color: '#ffc46b',
    modules: [
      {
        id: 'written_blogs',
        name: 'Blog Posts & Articles',
        label: 'Blog Posts',
        blurb: 'Long-form articles with target word counts, primary SEO keywords, and draft documents.',
        subCategory: 'Blog Post',
        defaultActive: true,
      },
      {
        id: 'written_newsletters',
        name: 'Newsletters & Email',
        label: 'Newsletters',
        blurb: 'Email campaigns with subject lines, preview text, and call-to-action links.',
        subCategory: 'Newsletter',
        defaultActive: true,
      },
      {
        id: 'written_threads',
        name: 'Social Threads',
        label: 'Social Threads',
        blurb: 'Serialized multi-post threads for X/Twitter and Threads with tweet counts and hooks.',
        subCategory: 'Social Thread',
        defaultActive: true,
      },
      {
        id: 'written_casestudies',
        name: 'Case Studies & Whitepapers',
        label: 'Case Studies',
        blurb: 'Customer stories, business case studies, measurable metrics, and client quotes.',
        subCategory: 'Case Study & Article',
        defaultActive: true,
      },
      {
        id: 'written_outlines',
        name: 'Research & Outlining',
        label: 'Research & Outlines',
        blurb: 'Topic pitch notes, research reference links, and content outlines.',
        featureKey: 'outlining',
        defaultActive: true,
      },
      {
        id: 'written_editorial',
        name: 'Tone & Proofreading',
        label: 'Tone & Proofreading',
        blurb: 'Editorial tone guidelines, proofreading notes, and legal/fact-checking signoff.',
        featureKey: 'proofreading',
        defaultActive: true,
      },
    ],
  },
  {
    id: 'agency',
    name: 'Strategic Brief & Agency Pipeline',
    label: 'Strategic Brief',
    format: 'brief',
    icon: 'target',
    blurb: 'Client and stakeholder briefing pipeline with approval milestones and scope tracking.',
    color: '#a78bfa',
    modules: [
      {
        id: 'brief_campaigns',
        name: 'Campaign Briefs',
        label: 'Campaign Briefs',
        blurb: 'High-level campaign briefs with target audience, core messaging, budget, and KPIs.',
        subCategory: 'Campaign Brief',
        defaultActive: true,
      },
      {
        id: 'brief_deliverables',
        name: 'Client Deliverables & Scope',
        label: 'Client Deliverables',
        blurb: 'Detailed scope milestones, deliverable checklists, and signoff target dates.',
        subCategory: 'Client Deliverable & Scope',
        defaultActive: true,
      },
      {
        id: 'brief_concepts',
        name: 'Creative Concepts & Pitches',
        label: 'Creative Concepts',
        blurb: 'Pitch presentations, moodboard links, visual concepts, and stakeholder presentation dates.',
        subCategory: 'Creative Concept & Pitch',
        defaultActive: true,
      },
      {
        id: 'brief_approval',
        name: 'Client Approval Gates',
        label: 'Client Approval',
        blurb: 'Formal client sign-off step before scheduling or public release.',
        featureKey: 'client_approval',
        defaultActive: true,
      },
    ],
  },
]

export function getAllModuleIds(): string[] {
  return PIPELINE_SECTIONS.flatMap((sec) => sec.modules.map((m) => m.id))
}

export function getModulesByPipeline(pipelineId: string): PipelineModuleDef[] {
  const section = PIPELINE_SECTIONS.find((s) => s.id === pipelineId)
  return section ? section.modules : []
}

export function isModuleActive(workspace: Workspace, moduleId: string): boolean {
  if (!workspace.enabledModules || workspace.enabledModules.length === 0) {
    // If enabledModules is not explicitly set, check if the corresponding subcategory / format is enabled
    const moduleDef = PIPELINE_SECTIONS.flatMap((s) => s.modules).find((m) => m.id === moduleId)
    if (!moduleDef) return true
    if (moduleDef.subCategory) {
      if (workspace.enabledSubCategories && workspace.enabledSubCategories.length > 0) {
        return workspace.enabledSubCategories.includes(moduleDef.subCategory)
      }
    }
    const section = PIPELINE_SECTIONS.find((s) => s.modules.some((m) => m.id === moduleId))
    if (section && workspace.enabledFormats && workspace.enabledFormats.length > 0) {
      return workspace.enabledFormats.includes(section.format)
    }
    return true
  }
  return workspace.enabledModules.includes(moduleId)
}

/**
 * Given a set of enabled module IDs and optional pipeline IDs,
 * recomputes the workspace's persistent configuration:
 * - selectedPipelines
 * - enabledFormats
 * - enabledSubCategories
 * - enabledModules
 * - stages (preserving existing stage IDs so in-progress content cards are untouched)
 * - taxonomies.contentTypes
 */
export function reconfigureWorkspaceWorkflow(
  currentWorkspace: Workspace,
  enabledModuleIds: string[],
  forcedPipelineIds?: string[],
): Partial<Workspace> {
  const moduleSet = new Set(enabledModuleIds)

  // Determine active pipelines: any section where at least one module is checked (or forced)
  const activePipelineIds: string[] = []
  const activeFormats: ProductionFormat[] = []
  const activeSubCategories: string[] = []

  for (const section of PIPELINE_SECTIONS) {
    const hasActiveModule = section.modules.some((m) => moduleSet.has(m.id))
    const isForced = forcedPipelineIds && forcedPipelineIds.includes(section.id)

    if (hasActiveModule || isForced) {
      activePipelineIds.push(section.id)
      if (!activeFormats.includes(section.format)) {
        activeFormats.push(section.format)
      }
    }

    // Collect active subcategories from active modules
    for (const mod of section.modules) {
      if (mod.subCategory && moduleSet.has(mod.id)) {
        activeSubCategories.push(mod.subCategory)
      }
    }
  }

  // Ensure at least one pipeline remains active
  const finalPipelineIds = activePipelineIds.length > 0 ? activePipelineIds : ['video']
  const finalFormats = activeFormats.length > 0 ? activeFormats : (['video'] as ProductionFormat[])
  const finalSubCategories = activeSubCategories.length > 0 ? activeSubCategories : getAllSubCategories()

  // Generate merged stages from the active pipelines
  const { stages: newStages } = stagesFromPipelines(finalPipelineIds)

  // Preserve existing stage IDs for matching stage names to avoid resetting content progress
  const existingStagesByName = new Map<string, Stage>()
  for (const st of currentWorkspace.stages) {
    existingStagesByName.set(st.name.toLowerCase().trim(), st)
  }

  const mergedStages: Stage[] = newStages.map((st) => {
    const matched = existingStagesByName.get(st.name.toLowerCase().trim())
    return matched ? { ...st, id: matched.id } : st
  })

  // Harmonize taxonomies.contentTypes with active subcategories
  const currentTax = currentWorkspace.taxonomies
  const remainingTypes = currentTax.contentTypes.filter((ct) => !finalSubCategories.includes(ct))
  const updatedContentTypes = Array.from(new Set([...finalSubCategories, ...remainingTypes]))

  return {
    selectedPipelines: finalPipelineIds,
    enabledFormats: finalFormats,
    enabledSubCategories: finalSubCategories,
    enabledModules: Array.from(moduleSet),
    stages: mergedStages,
    workflowPreset: 'custom',
    taxonomies: {
      ...currentTax,
      contentTypes: updatedContentTypes,
    },
  }
}
