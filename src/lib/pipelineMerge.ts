/**
 * Pipeline merging engine.
 *
 * When a team or agency selects multiple production pipelines (e.g. Video + Design),
 * this module performs a deep merge of their stages, taxonomies, and features into a unified workflow.
 * Stages that repeat across pipelines merge into one shared stage; redundant duplicates
 * are eliminated, and features from unselected pipelines are cleanly isolated.
 */

import { PIPELINE_TEMPLATES, type PipelineTemplate } from './templates'
import type { JobRole, Stage, Taxonomies } from './types'

export type PipelineConfigInput =
  | string
  | PipelineTemplate
  | {
      id: string
      name?: string
      blurb?: string
      color?: string
      stages: (Partial<Stage> | string)[]
      contentTypes?: string[]
      taskTypes?: string[]
      roles?: (string | JobRole)[]
      taxonomies?: Partial<Taxonomies>
    }

export interface MergedStageResult extends Omit<Stage, 'id'> {
  id?: string
  sourcePipelineIds: string[]
  sourcePipelineNames: string[]
  isRepeated: boolean
}

export interface PipelineMergeReport {
  selectedPipelineIds: string[]
  selectedPipelines: PipelineTemplate[]
  stages: MergedStageResult[]
  repeatedStages: {
    name: string
    canonicalKey: string
    sources: string[]
    action: string
  }[]
  removedDuplicates: {
    name: string
    fromPipeline: string
    consolidatedInto: string
    reason: string
  }[]
  uniqueStages: {
    name: string
    fromPipeline: string
  }[]
  contentTypes: string[]
  removedContentTypes: string[]
  taskTypes: string[]
  roles: string[]
}

/**
 * Normalizes stage names into canonical keys to detect repeating features across pipelines.
 */
const CANONICAL_STAGE_KEYS: Record<string, { key: string; phaseWeight: number; defaultVerb?: string }> = {
  // Inception & Briefing (Phase 1: 100)
  brief: { key: 'brief', phaseWeight: 100, defaultVerb: 'Brief' },
  'creative brief': { key: 'brief', phaseWeight: 100, defaultVerb: 'Brief' },
  outline: { key: 'outline', phaseWeight: 110, defaultVerb: 'Outline' },
  research: { key: 'research', phaseWeight: 120, defaultVerb: 'Research' },
  concept: { key: 'brief', phaseWeight: 105, defaultVerb: 'Concept' },

  // Scripting & Copywriting (Phase 2: 200)
  script: { key: 'script', phaseWeight: 200, defaultVerb: 'Write' },
  copy: { key: 'copy', phaseWeight: 210, defaultVerb: 'Write' },
  draft: { key: 'draft', phaseWeight: 220, defaultVerb: 'Draft' },
  create: { key: 'create', phaseWeight: 230, defaultVerb: 'Create' },

  // Production & Execution (Phase 3: 300)
  shoot: { key: 'shoot', phaseWeight: 300, defaultVerb: 'Shoot' },
  design: { key: 'design', phaseWeight: 310, defaultVerb: 'Design' },
  production: { key: 'production', phaseWeight: 320, defaultVerb: 'Produce' },

  // Post-Production & Editing (Phase 4: 400)
  editing: { key: 'editing', phaseWeight: 400, defaultVerb: 'Edit' },
  edit: { key: 'editing', phaseWeight: 400, defaultVerb: 'Edit' },

  // Review & Quality Assurance (Phase 5: 500)
  review: { key: 'review', phaseWeight: 500, defaultVerb: 'Review' },
  'internal review': { key: 'review', phaseWeight: 500, defaultVerb: 'Review' },
  'team review': { key: 'review', phaseWeight: 500, defaultVerb: 'Review' },

  // Client / Final Gate Approval (Phase 6: 600)
  'client approval': { key: 'client-approval', phaseWeight: 600, defaultVerb: 'Approve' },
  approval: { key: 'client-approval', phaseWeight: 600, defaultVerb: 'Approve' },
}

export function getStageCanonical(name: string) {
  const clean = name.trim().toLowerCase()
  const matched = CANONICAL_STAGE_KEYS[clean]
  if (matched) return { key: matched.key, phaseWeight: matched.phaseWeight, verb: matched.defaultVerb }
  return { key: clean, phaseWeight: 350, verb: undefined }
}

/**
 * Normalizes any pipeline config input (ID string, PipelineTemplate, or custom config)
 * into a standardized PipelineTemplate structure.
 */
export function normalizePipelineConfig(
  input: PipelineConfigInput,
  fallbackTemplates: PipelineTemplate[] = PIPELINE_TEMPLATES,
): PipelineTemplate {
  if (typeof input === 'string') {
    const found = fallbackTemplates.find((t) => t.id === input)
    if (found) return found
    return {
      id: input,
      name: input.charAt(0).toUpperCase() + input.slice(1) + ' Pipeline',
      blurb: 'Custom pipeline',
      stages: [],
    }
  }

  // Already a full template with stages
  const id = input.id || 'custom'
  const name = input.name || id
  const blurb = input.blurb || ''
  const color = input.color

  const stages: Omit<Stage, 'id'>[] = (input.stages || []).map((s) => {
    if (typeof s === 'string') {
      const canonical = getStageCanonical(s)
      return {
        name: s,
        ownerRole: 'Team Lead',
        verb: canonical.verb || 'Complete',
      }
    }
    const nameStr = s.name || 'Stage'
    const canonical = getStageCanonical(nameStr)
    return {
      name: nameStr,
      ownerRole: s.ownerRole || 'Team Lead',
      verb: s.verb || canonical.verb || 'Complete',
    }
  })

  const roles = (input.roles || []).map((r) => (typeof r === 'string' ? r : r.label))

  return {
    id,
    name,
    blurb,
    color,
    stages,
    contentTypes: input.contentTypes,
    taskTypes: input.taskTypes,
    roles,
  }
}

/**
 * Helper function in the state management layer that takes selected pipeline configurations
 * and performs a deep merge of their features while removing duplicates to ensure the UI
 * reflects a unified production workflow.
 *
 * @param configs Selected pipeline configuration inputs (IDs, templates, or custom objects).
 * @param existingStages Optional existing workspace stages to retain permanent stage IDs for existing content.
 * @returns Deeply merged pipeline report with unified stages, deduplicated features, and diagnostics.
 */
export function mergePipelineConfigurations(
  configs: PipelineConfigInput[],
  existingStages?: Stage[],
): PipelineMergeReport {
  const cleanConfigs = configs.length ? configs : ['video']
  const normalizedPipelines = cleanConfigs.map((c) => normalizePipelineConfig(c))
  const selectedPipelineIds = normalizedPipelines.map((p) => p.id)

  // Map existing stages by canonical key so we reuse existing stage IDs where possible
  const existingMap = new Map<string, Stage>()
  if (existingStages) {
    for (const s of existingStages) {
      const key = getStageCanonical(s.name).key
      if (!existingMap.has(key)) existingMap.set(key, s)
      existingMap.set(s.name.trim().toLowerCase(), s)
    }
  }

  // If only 1 pipeline is selected, produce clean result preserving its original definition
  if (normalizedPipelines.length === 1) {
    const single = normalizedPipelines[0]
    return {
      selectedPipelineIds,
      selectedPipelines: normalizedPipelines,
      stages: single.stages.map((s) => {
        const canonical = getStageCanonical(s.name)
        const match = existingMap.get(canonical.key) || existingMap.get(s.name.trim().toLowerCase())
        return {
          ...s,
          id: match?.id,
          sourcePipelineIds: [single.id],
          sourcePipelineNames: [single.name],
          isRepeated: false,
        }
      }),
      repeatedStages: [],
      removedDuplicates: [],
      uniqueStages: single.stages.map((s) => ({ name: s.name, fromPipeline: single.name })),
      contentTypes: single.contentTypes ?? [],
      removedContentTypes: [],
      taskTypes: single.taskTypes ?? [],
      roles: single.roles ?? [],
    }
  }

  // 1. Gather all stages from all selected pipelines with metadata
  type StageWithMeta = Omit<Stage, 'id'> & {
    canonicalKey: string
    phaseWeight: number
    pipelineId: string
    pipelineName: string
    originalIndex: number
    existingId?: string
  }

  const allStages: StageWithMeta[] = []
  for (const pipeline of normalizedPipelines) {
    pipeline.stages.forEach((st, idx) => {
      const canonical = getStageCanonical(st.name)
      const match = existingMap.get(canonical.key) || existingMap.get(st.name.trim().toLowerCase())
      allStages.push({
        name: st.name,
        ownerRole: st.ownerRole,
        verb: st.verb || canonical.verb,
        canonicalKey: canonical.key,
        phaseWeight: canonical.phaseWeight,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        originalIndex: idx,
        existingId: match?.id,
      })
    })
  }

  // 2. Deep merge repeating stages by canonical identity
  const mergedMap = new Map<
    string,
    {
      primary: StageWithMeta
      sourcePipelineIds: Set<string>
      sourcePipelineNames: Set<string>
      occurrences: StageWithMeta[]
    }
  >()

  for (const st of allStages) {
    const existing = mergedMap.get(st.canonicalKey)
    if (!existing) {
      mergedMap.set(st.canonicalKey, {
        primary: st,
        sourcePipelineIds: new Set([st.pipelineId]),
        sourcePipelineNames: new Set([st.pipelineName]),
        occurrences: [st],
      })
    } else {
      existing.sourcePipelineIds.add(st.pipelineId)
      existing.sourcePipelineNames.add(st.pipelineName)
      existing.occurrences.push(st)

      // If the subsequent occurrence has a non-generic ownerRole or verb, deep-merge it into primary
      if (existing.primary.ownerRole === 'Team Lead' && st.ownerRole !== 'Team Lead') {
        existing.primary.ownerRole = st.ownerRole
      }
      if (!existing.primary.verb && st.verb) {
        existing.primary.verb = st.verb
      }
      if (!existing.primary.existingId && st.existingId) {
        existing.primary.existingId = st.existingId
      }
    }
  }

  // 3. Categorize into repeated and unique features, isolating removed duplicates
  const repeatedStages: PipelineMergeReport['repeatedStages'] = []
  const removedDuplicates: PipelineMergeReport['removedDuplicates'] = []
  const uniqueStages: PipelineMergeReport['uniqueStages'] = []
  const mergedList: MergedStageResult[] = []

  for (const [key, group] of mergedMap.entries()) {
    const isRepeated = group.sourcePipelineIds.size > 1 || group.occurrences.length > 1
    const sourceNames = Array.from(group.sourcePipelineNames)
    const sourceIds = Array.from(group.sourcePipelineIds)

    // Preferred standard display name (e.g. "Review" over "Internal review")
    const displayName =
      key === 'review' && group.occurrences.some((o) => o.name.toLowerCase() === 'review')
        ? 'Review'
        : group.primary.name

    if (isRepeated) {
      repeatedStages.push({
        name: displayName,
        canonicalKey: key,
        sources: sourceNames,
        action: `Merged ${group.occurrences.length} instances across ${sourceNames.join(' & ')} into 1 shared stage`,
      })
      // Track removed duplicate instances (all occurrences after the first)
      for (let i = 1; i < group.occurrences.length; i++) {
        removedDuplicates.push({
          name: group.occurrences[i].name,
          fromPipeline: group.occurrences[i].pipelineName,
          consolidatedInto: displayName,
          reason: 'Duplicate feature removed to unify production workflow',
        })
      }
    } else {
      uniqueStages.push({
        name: displayName,
        fromPipeline: sourceNames[0] || 'Unknown',
      })
    }

    mergedList.push({
      id: group.primary.existingId,
      name: displayName,
      ownerRole: group.primary.ownerRole,
      verb: group.primary.verb,
      sourcePipelineIds: sourceIds,
      sourcePipelineNames: sourceNames,
      isRepeated,
    })
  }

  // 4. Sort stages into logical creative workflow order (Brief -> Copy -> Shoot -> Edit -> Review -> Approval)
  mergedList.sort((a, b) => {
    const wa = getStageCanonical(a.name).phaseWeight
    const wb = getStageCanonical(b.name).phaseWeight
    if (wa !== wb) return wa - wb
    return a.name.localeCompare(b.name)
  })

  // 5. Deep merge content types with deduplication
  const activeContentTypes = new Set<string>()
  for (const p of normalizedPipelines) {
    for (const ct of p.contentTypes ?? []) {
      activeContentTypes.add(ct)
    }
  }

  // Find content types from standard templates not in selection
  const allKnownContentTypes = new Set<string>()
  for (const p of PIPELINE_TEMPLATES) {
    for (const ct of p.contentTypes ?? []) {
      allKnownContentTypes.add(ct)
    }
  }
  const removedContentTypes: string[] = []
  for (const ct of allKnownContentTypes) {
    if (!activeContentTypes.has(ct)) {
      removedContentTypes.push(ct)
    }
  }

  // 6. Deep merge task types & roles with deduplication
  const activeTaskTypes = new Set<string>()
  const activeRoles = new Set<string>()
  for (const p of normalizedPipelines) {
    for (const tt of p.taskTypes ?? []) activeTaskTypes.add(tt)
    for (const r of p.roles ?? []) activeRoles.add(r)
  }

  return {
    selectedPipelineIds,
    selectedPipelines: normalizedPipelines,
    stages: mergedList,
    repeatedStages,
    removedDuplicates,
    uniqueStages,
    contentTypes: Array.from(activeContentTypes),
    removedContentTypes,
    taskTypes: Array.from(activeTaskTypes),
    roles: Array.from(activeRoles),
  }
}

/**
 * Backward compatibility alias for mergePipelineConfigurations.
 */
export const mergePipelines = (selectedIds: string[], _templates?: PipelineTemplate[]) => {
  return mergePipelineConfigurations(selectedIds, undefined)
}
