/**
 * Workspace defaults.
 *
 * Everything here is a *starting point* a workspace can edit in Settings. None
 * of it is hard-coded into the app's logic — the pipeline is read from
 * `workspace.stages` and every dropdown from `workspace.taxonomies`.
 */

import type { JobRole, PlatformDef, Stage, Taxonomies } from './types'

export const DEFAULT_ROLES: JobRole[] = [
  { id: 'lead', label: 'Team Lead' },
  { id: 'writer', label: 'Content Writer' },
  { id: 'designer', label: 'Designer' },
  { id: 'videographer', label: 'Videographer' },
  { id: 'editor', label: 'Video Editor' },
  { id: 'social', label: 'Social Manager' },
]

export const DEFAULT_PLATFORMS: PlatformDef[] = [
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'youtube', label: 'YouTube', color: '#ff3d3d' },
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee' },
  { id: 'linkedin', label: 'LinkedIn', color: '#3b9ae1' },
  { id: 'x', label: 'X', color: '#e7e9ea' },
  { id: 'threads', label: 'Threads', color: '#a78bfa' },
  { id: 'pinterest', label: 'Pinterest', color: '#f4526a' },
  { id: 'website', label: 'Website', color: '#4edea3' },
  { id: 'newsletter', label: 'Newsletter', color: '#ffc46b' },
]

export const DEFAULT_TAXONOMIES: Taxonomies = {
  contentTypes: [
    'Reel',
    'Short Video',
    'Long Video',
    'Carousel',
    'Static Post',
    'Story',
    'Live',
    'Testimonial',
    'Blog Post',
    'Newsletter',
    'Podcast',
  ],
  categories: [
    'Product',
    'Brand',
    'Educational',
    'Promotional',
    'Customer Story',
    'Behind the Scenes',
    'Announcement',
    'Community',
    'Seasonal',
  ],
  platforms: DEFAULT_PLATFORMS,
  priorities: ['High', 'Medium', 'Low'],
  taskTypes: [
    'Research',
    'Content Planning',
    'Script Writing',
    'Script Revision',
    'Copywriting',
    'Design',
    'Shooting',
    'Video Editing',
    'Video Revision',
    'Thumbnail',
    'Caption',
    'Publishing',
    'Performance Update',
  ],
  objectives: [
    'Brand awareness',
    'Engagement',
    'Lead generation',
    'Conversions',
    'Community building',
    'Education',
    'Traffic',
    'Retention',
  ],
  audiences: [],
  roles: DEFAULT_ROLES,
  performanceRatings: ['Excellent', 'Good', 'Average', 'Poor'],
  repurposeLevels: ['High', 'Medium', 'Low'],
  ideaPotentials: ['High', 'Medium', 'Low'],
}

// ---------------------------------------------------------------------------
// Pipeline templates
// ---------------------------------------------------------------------------

export interface PipelineTemplate {
  id: string
  name: string
  blurb: string
  stages: Omit<Stage, 'id'>[]
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'video',
    name: 'Video production',
    blurb: 'Script, shoot, edit, review — for teams whose main output is video.',
    stages: [
      { name: 'Script', ownerRole: 'Content Writer', verb: 'Write' },
      { name: 'Shoot', ownerRole: 'Videographer', verb: 'Shoot' },
      { name: 'Editing', ownerRole: 'Video Editor', verb: 'Edit' },
      { name: 'Review', ownerRole: 'Team Lead', verb: 'Review' },
    ],
  },
  {
    id: 'design',
    name: 'Design & graphics',
    blurb: 'Brief, copy, design, review — for carousels, static posts and stories.',
    stages: [
      { name: 'Brief', ownerRole: 'Team Lead', verb: 'Brief' },
      { name: 'Copy', ownerRole: 'Content Writer', verb: 'Write' },
      { name: 'Design', ownerRole: 'Designer', verb: 'Design' },
      { name: 'Review', ownerRole: 'Team Lead', verb: 'Review' },
    ],
  },
  {
    id: 'written',
    name: 'Written content',
    blurb: 'Outline, draft, edit, review — for blogs, newsletters and threads.',
    stages: [
      { name: 'Outline', ownerRole: 'Content Writer', verb: 'Outline' },
      { name: 'Draft', ownerRole: 'Content Writer', verb: 'Draft' },
      { name: 'Edit', ownerRole: 'Team Lead', verb: 'Edit' },
      { name: 'Review', ownerRole: 'Team Lead', verb: 'Review' },
    ],
  },
  {
    id: 'agency',
    name: 'Agency / client work',
    blurb: 'Adds a client approval gate before anything gets scheduled.',
    stages: [
      { name: 'Brief', ownerRole: 'Team Lead', verb: 'Brief' },
      { name: 'Production', ownerRole: 'Designer', verb: 'Produce' },
      { name: 'Internal review', ownerRole: 'Team Lead', verb: 'Review' },
      { name: 'Client approval', ownerRole: 'Social Manager', verb: 'Send' },
    ],
  },
  {
    id: 'simple',
    name: 'Simple two-step',
    blurb: 'Create, then review. The lightest pipeline that still tracks a handoff.',
    stages: [
      { name: 'Create', ownerRole: 'Content Writer', verb: 'Create' },
      { name: 'Review', ownerRole: 'Team Lead', verb: 'Review' },
    ],
  },
]

/** Tones cycled across pipeline stages so the stage track reads left-to-right. */
export const STAGE_TONES = ['primary', 'violet', 'amber', 'emerald'] as const
