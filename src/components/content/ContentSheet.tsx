/**
 * Create / edit form for a content item.
 *
 * Deliberately structured to dynamically adapt to the selected content format
 * and subcategory:
 * - Static: Thumbnails, Carousels, Graphic Posts, Banners, Infographics, Stories
 * - Video: Reels & Shorts, Long-Form Video, Video Graphics & Motion, Interview & Podcast
 * - Write-Up: Blog Posts, Newsletters, Social Threads, Case Studies & Articles
 * - Brief: Campaign Briefs, Client Deliverables & Scope, Creative Concepts & Pitches
 *
 * Shows only the production steps and fields relevant to the selected content type
 * and active merged pipeline stages.
 */

import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Overlay'
import {
  Button,
  Chip,
  Field,
  Input,
  Label,
  OptionSelect,
  Select,
  StatusChip,
  Textarea,
  cx,
} from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { StageTrack, STATE_LABEL, STATE_TONE } from './pieces'
import { PIPELINE_TEMPLATES } from '@/lib/templates'
import {
  PRODUCTION_FORMATS,
  detectProductionFormat,
  filterStagesForFormat,
} from '@/lib/productionFormats'
import type { ContentItem, Member, ProductionFormat, ProductionMetadata, StageState, Workspace } from '@/lib/types'
import {
  OVERALL_STATUS_TONE,
  currentStage,
  memberName,
  overallStatus,
  responsibleMemberId,
  stageLabel,
  stageState,
  suggestAssignee,
} from '@/lib/derive'
import { addDays, monthKey, today } from '@/lib/date'

export function ContentSheet({
  open,
  onClose,
  item,
  workspace,
  members,
  onSave,
  onDelete,
  canDelete,
  readOnly,
}: {
  open: boolean
  onClose: () => void
  item: ContentItem
  workspace: Workspace
  members: Member[]
  onSave: (patch: Partial<ContentItem>) => void | Promise<void>
  onDelete?: () => void
  canDelete?: boolean
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState<ContentItem>(item)
  const [saving, setSaving] = useState(false)

  // Re-seed when a different item is opened.
  useEffect(() => setDraft(item), [item.id, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const { taxonomies, stages } = workspace
  const activeMembers = useMemo(() => members.filter((m) => m.active), [members])
  const set = <K extends keyof ContentItem>(key: K, value: ContentItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const currentFormat = useMemo(() => {
    return draft.productionFormat || detectProductionFormat(draft, 'video')
  }, [draft.productionFormat, draft.contentType, draft.pipelineId])

  const formatDef = useMemo(() => {
    return PRODUCTION_FORMATS.find((f) => f.id === currentFormat) || PRODUCTION_FORMATS[0]
  }, [currentFormat])

  const currentSubCategory = useMemo(() => {
    let sub = draft.productionMeta?.subCategory
    if (sub === 'Thumbnails (YT, IG, FB)') sub = 'Thumbnails'
    if (sub) return sub
    let ct = draft.contentType
    if (ct === 'Thumbnails (YT, IG, FB)') ct = 'Thumbnails'
    if (ct && formatDef.subCategories.includes(ct)) {
      return ct
    }
    return formatDef.subCategories[0] || ''
  }, [draft.productionMeta?.subCategory, draft.contentType, formatDef])

  const activeStages = useMemo(() => {
    return filterStagesForFormat(stages, currentFormat, currentSubCategory)
  }, [stages, currentFormat, currentSubCategory])

  const status = overallStatus(draft, activeStages)
  const responsible = memberName(members, responsibleMemberId(draft, activeStages))
  const stage = currentStage(draft, activeStages)

  const handleFormatChange = (fmt: ProductionFormat) => {
    const def = PRODUCTION_FORMATS.find((f) => f.id === fmt) || PRODUCTION_FORMATS[0]
    const nextSub = def.subCategories[0]
    setDraft((d) => {
      const nextMeta = { ...(d.productionMeta || {}), subCategory: nextSub, customRatio: '' }
      if (fmt === 'static') {
        nextMeta.dimensions = '1280×720 (16:9 YouTube Thumbnail / Landscape)'
        nextMeta.thumbnailPlatform = 'YouTube (1280×720 · 16:9 HD)'
        nextMeta.designTool = nextMeta.designTool || 'Figma'
      } else if (fmt === 'video') {
        nextMeta.aspectRatio = '9:16 (1080×1920 Vertical Reel/Short/TikTok)'
        nextMeta.duration = nextMeta.duration || '30s'
      } else if (fmt === 'written') {
        nextMeta.wordCountTarget = nextMeta.wordCountTarget || 800
        nextMeta.editorialTone = nextMeta.editorialTone || 'Conversational & Engaging'
      } else if (fmt === 'brief') {
        nextMeta.clientSignoffDate = nextMeta.clientSignoffDate || addDays(today(), 7)
      }
      return {
        ...d,
        productionFormat: fmt,
        contentType: nextSub,
        productionMeta: nextMeta,
      }
    })
  }

  const handleSubCategoryChange = (subCat: string) => {
    setDraft((d) => {
      const nextMeta = { ...(d.productionMeta || {}), subCategory: subCat, customRatio: '' }
      if (subCat === 'Thumbnails' || subCat === 'Thumbnails (YT, IG, FB)') {
        nextMeta.dimensions = '1280×720 (16:9 YouTube Thumbnail / Landscape)'
        nextMeta.thumbnailPlatform = 'YouTube (1280×720 · 16:9 HD)'
      } else if (subCat === 'Carousel') {
        nextMeta.dimensions = '1080×1350 (4:5 Instagram Portrait / Carousel)'
        nextMeta.slideCount = nextMeta.slideCount || 5
      } else if (subCat === 'Graphic Post') {
        nextMeta.dimensions = '1080×1080 (1:1 Instagram Square Feed)'
      } else if (subCat === 'Banner / Header') {
        nextMeta.dimensions = '2560×1440 (16:9 YouTube Channel Banner)'
        nextMeta.bannerPlacement = 'YouTube Channel Banner (2560×1440)'
      } else if (subCat === 'Infographic') {
        nextMeta.dimensions = '1080×1920 (9:16 Vertical Long Infographic)'
      } else if (subCat === 'Story / Vertical Graphic') {
        nextMeta.dimensions = '1080×1920 (9:16 Fullscreen Mobile Story / Reel)'
      } else if (subCat === 'Reels & Shorts (9:16)') {
        nextMeta.aspectRatio = '9:16 (1080×1920 Vertical Reel/Short/TikTok)'
        nextMeta.duration = '30s'
      } else if (subCat === 'Long-Form Video (16:9)') {
        nextMeta.aspectRatio = '16:9 (1920×1080 Full HD Landscape)'
        nextMeta.duration = '8–12 mins'
      } else if (subCat === 'Video Graphics & Motion Promo') {
        nextMeta.aspectRatio = '16:9 (Landscape YouTube/Broadcast)'
        nextMeta.duration = '15s'
      } else if (subCat === 'Interview & Podcast Video') {
        nextMeta.aspectRatio = '16:9 (Full Broadcast Episode)'
        nextMeta.duration = '45 mins'
      }
      return {
        ...d,
        contentType: subCat,
        productionMeta: nextMeta,
      }
    })
  }

  const updateMeta = <K extends keyof ProductionMetadata>(key: K, val: ProductionMetadata[K]) => {
    setDraft((d) => ({
      ...d,
      productionMeta: {
        ...(d.productionMeta || {}),
        [key]: val,
      },
    }))
  }

  const availableContentTypes = useMemo(() => {
    const specific = formatDef.contentTypes
    const others = taxonomies.contentTypes.filter((ct) => !specific.includes(ct))
    return [...specific, ...others]
  }, [formatDef, taxonomies.contentTypes])

  /** Back-fills every empty stage deadline from the publish date. */
  const cascadeDeadlines = (publishDate: string) => {
    if (!publishDate) return
    const gap = 2
    const next = { ...draft.stageDeadlines }
    activeStages.forEach((s, i) => {
      if (!next[s.id]) next[s.id] = addDays(publishDate, -((activeStages.length - i) * gap))
    })
    setDraft((d) => ({ ...d, stageDeadlines: next }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        ...draft,
        productionFormat: currentFormat,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const platformOptions = taxonomies.platforms.map((p) => p.label)

  const cleanCategories = useMemo(() => {
    return taxonomies.categories.filter((c) => !c.toLowerCase().includes('thumbnail'))
  }, [taxonomies.categories])

  // Subcategory metadata helpers
  const staticRatioValue =
    draft.productionMeta?.dimensions || '1280×720 (16:9 YouTube Thumbnail / Landscape)'
  const videoRatioValue =
    draft.productionMeta?.aspectRatio || '9:16 (1080×1920 Vertical Reel/Short/TikTok)'

  // Determine if social copy block should be displayed
  const isSocialFormat =
    currentFormat === 'static' ||
    currentFormat === 'video' ||
    (currentFormat === 'written' &&
      (currentSubCategory === 'Social Thread' || currentSubCategory === 'Newsletter'))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item.title ? item.title : `New content · ${item.code}`}
      subtitle={`${item.code} · ${stageLabel(draft, activeStages)}`}
      size="lg"
      footer={
        readOnly ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            {canDelete && onDelete && (
              <Button
                variant="danger"
                icon="trash"
                onClick={() => {
                  onDelete()
                  onClose()
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-6">
        {/* -------- Layer 1: Primary Segment Selector -------- */}
        <div className="rounded-lg border border-line/70 bg-sunken/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-body-sm font-bold text-ink">
                What are you looking to create?
              </span>
              <span className="text-body-xs text-ink-dim">
                Primary segment: choose what you want to create to reveal the exact production workflow.
              </span>
            </div>
            <span className="font-mono text-label-micro uppercase font-bold text-primary">
              Segment
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PRODUCTION_FORMATS.map((fmt) => {
              const isSelected = currentFormat === fmt.id
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => handleFormatChange(fmt.id)}
                  className={cx(
                    'relative rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary/80 bg-accent/20 ring-2 ring-primary/40 shadow-xs'
                      : 'border-line/60 bg-raised/70 hover:border-line hover:bg-raised',
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/25 text-primary">
                      <Icon name={fmt.icon} size={15} />
                    </span>
                    {isSelected && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                        <Icon name="check" size={10} />
                      </span>
                    )}
                  </div>
                  <span className="block text-body-sm font-bold text-ink">{fmt.label}</span>
                  <span className="mt-0.5 block text-label-micro text-ink-dim leading-tight">
                    {fmt.tagline}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* -------- Layer 2: Sub-category Selector -------- */}
        <div className="rounded-lg border border-line/70 bg-sunken/30 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-body-xs font-bold text-ink">
                Sub-category under {formatDef.label}
              </span>
              <span className="text-label-micro text-ink-dim">
                Select a sub-category to load specialized asset dimensions, ratio presets, and production steps.
              </span>
            </div>
            <span className="rounded bg-accent/25 px-2 py-0.5 font-mono text-label-micro font-bold text-primary">
              {currentSubCategory}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {formatDef.subCategories.map((subCat) => {
              const isSubActive = currentSubCategory === subCat
              return (
                <button
                  key={subCat}
                  type="button"
                  onClick={() => handleSubCategoryChange(subCat)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-body-xs font-medium transition-all',
                    isSubActive
                      ? 'border-primary/80 bg-accent/20 text-ink ring-1 ring-primary/40 font-semibold shadow-xs'
                      : 'border-line/60 bg-raised/70 text-ink-dim hover:border-line hover:bg-raised hover:text-ink',
                  )}
                >
                  {isSubActive && (
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-white">
                      <Icon name="check" size={8} />
                    </span>
                  )}
                  {subCat}
                </button>
              )
            })}
          </div>
        </div>

        {/* -------- Layer 3: Dynamic Corresponding Production Steps -------- */}

        {/* STATIC SUBCATEGORIES */}
        {currentFormat === 'static' && (
          <div className="space-y-5 rounded-lg border border-line/60 bg-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="label-caps font-bold text-ink">
                Static Production · {currentSubCategory}
              </span>
              <span className="font-mono text-label-micro text-primary">Tailored Output Steps</span>
            </div>

            {/* 1. Thumbnails */}
            {(currentSubCategory === 'Thumbnails' || currentSubCategory === 'Thumbnails (YT, IG, FB)') && (
              <Group title="Thumbnails Specifications">
                <Field label="Target thumbnail platform" hint="primary channel">
                  <OptionSelect
                    value={draft.productionMeta?.thumbnailPlatform || 'YouTube (1280×720 · 16:9 HD)'}
                    onChange={(v) => {
                      updateMeta('thumbnailPlatform', v)
                      if (v.includes('YouTube')) updateMeta('dimensions', '1280×720 (16:9 YouTube Thumbnail / Landscape)')
                      else if (v.includes('1080×1350')) updateMeta('dimensions', '1080×1350 (4:5 Instagram Portrait Cover)')
                      else if (v.includes('1080×1080')) updateMeta('dimensions', '1080×1080 (1:1 Instagram Square)')
                      else if (v.includes('Reel Cover')) updateMeta('dimensions', '1080×1920 (9:16 Reel Cover)')
                      else if (v.includes('Facebook')) updateMeta('dimensions', '1200×630 (1.91:1 Facebook Feed)')
                    }}
                    options={[
                      'YouTube (1280×720 · 16:9 HD)',
                      'Instagram Cover (1080×1350 · 4:5)',
                      'Instagram Square (1080×1080 · 1:1)',
                      'Instagram Reel Cover (1080×1920 · 9:16)',
                      'Facebook Feed (1200×630 · 1.91:1)',
                      'Multi-Platform Package (YT + IG + FB)',
                    ]}
                  />
                </Field>
                <Field label="A/B testing variant" hint="split-testing options">
                  <OptionSelect
                    value={draft.productionMeta?.abVariant || 'Variant A (Primary Hook & Expression)'}
                    onChange={(v) => updateMeta('abVariant', v)}
                    options={[
                      'Variant A (Primary Hook & Expression)',
                      'Variant B (Alternative Title & Color Scheme)',
                      'Variant C (Object / Graphic Centered)',
                      'Champion / Winning Thumbnail',
                    ]}
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '1280×720 (16:9 YouTube Thumbnail / Landscape)',
                    '1080×1350 (4:5 Instagram Portrait Cover)',
                    '1080×1080 (1:1 Instagram Square)',
                    '1080×1920 (9:16 Reel Cover)',
                    '1200×630 (1.91:1 Facebook Feed)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Thumbnail hook headline / text overlay"
                  className="sm:col-span-2"
                  hint="3–5 bold words legible on small mobile screens"
                >
                  <Input
                    value={draft.productionMeta?.thumbnailText || ''}
                    onChange={(e) => updateMeta('thumbnailText', e.target.value)}
                    placeholder="e.g. I TESTED THIS FOR 30 DAYS! / DON'T MISS THIS"
                  />
                </Field>

                <Field
                  label="Subject / face cutout & expression notes"
                  className="sm:col-span-2"
                  hint="reaction face, cutout border glow, contrast"
                >
                  <Input
                    value={draft.productionMeta?.thumbnailCutoutUrl || ''}
                    onChange={(e) => updateMeta('thumbnailCutoutUrl', e.target.value)}
                    placeholder="e.g. Shocked reaction face cutout on right side, bold yellow outline, high contrast background"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Photoshop', 'Canva', 'Illustrator']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="final asset format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'High-Res PNG (Lossless)'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={['High-Res PNG (Lossless)', 'JPG (Standard web)', 'WebP (Optimized)']}
                  />
                </Field>

                <Field label="Figma / Photoshop workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/... or PSD cloud link"
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or cloud export link"
                  />
                </Field>
              </Group>
            )}

            {/* 2. Carousel */}
            {currentSubCategory === 'Carousel' && (
              <Group title="Carousel Specifications & Slide Flow">
                <Field label="Slide / card count" hint="number of slides in deck">
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={draft.productionMeta?.slideCount || 5}
                    onChange={(e) => updateMeta('slideCount', Number(e.target.value))}
                  />
                </Field>
                <Field label="Visual flow & continuity style" hint="pacing style">
                  <OptionSelect
                    value={draft.productionMeta?.carouselVisualFlow || 'Seamless Panoramic Bleed'}
                    onChange={(v) => updateMeta('carouselVisualFlow', v)}
                    options={[
                      'Seamless Panoramic Bleed (Images span slides)',
                      'Connected Card Sequence (Step-by-step arrows)',
                      'Minimalist Typographic Cards',
                      'Case Study / Data Chart Breakdown',
                    ]}
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '1080×1350 (4:5 Instagram Portrait / Carousel)',
                    '1080×1080 (1:1 Instagram Square Carousel)',
                    '1080×1920 (9:16 Story Carousel)',
                    '1920×1080 (16:9 Landscape Slide Deck)',
                    '1200×628 (1.91:1 LinkedIn PDF Document)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Slide 1 hook & cover headline"
                  className="sm:col-span-2"
                  hint="the primary scroll-stopping hook on cover slide"
                >
                  <Input
                    value={draft.productionMeta?.carouselHookHeadline || ''}
                    onChange={(e) => updateMeta('carouselHookHeadline', e.target.value)}
                    placeholder="e.g. 5 Mistakes Every Marketing Team Makes (And How to Fix Them)"
                  />
                </Field>

                <Field
                  label="Slide-by-slide outline & swipe cues"
                  className="sm:col-span-2"
                  hint="structure each slide and swipe indicator"
                >
                  <Textarea
                    value={draft.productionMeta?.carouselOutline || ''}
                    onChange={(e) => updateMeta('carouselOutline', e.target.value)}
                    rows={3}
                    placeholder="Slide 1: Hook & core promise&#10;Slide 2: The hidden trap&#10;Slide 3–4: Step-by-step solution with diagrams&#10;Slide 5: Summary & Save CTA"
                  />
                </Field>

                <Field
                  label="Final slide save & share CTA"
                  className="sm:col-span-2"
                  hint="action prompt on the last slide"
                >
                  <Input
                    value={draft.productionMeta?.carouselFinalCta || ''}
                    onChange={(e) => updateMeta('carouselFinalCta', e.target.value)}
                    placeholder="e.g. Save this post for your next campaign planning session"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Illustrator', 'Canva', 'Photoshop']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="carousel bundle format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'Multi-image PNG Package'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={[
                      'Multi-image PNG Package',
                      'PDF Document Slide Deck (LinkedIn)',
                      'ZIP Archive of assets',
                    ]}
                  />
                </Field>

                <Field label="Figma / design workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/..."
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or carousel export link"
                  />
                </Field>
              </Group>
            )}

            {/* 3. Graphic Post */}
            {currentSubCategory === 'Graphic Post' && (
              <Group title="Graphic Post Specifications">
                <Field label="Post graphic style" hint="visual format">
                  <OptionSelect
                    value={draft.productionMeta?.postStyle || 'Quote Card & Typographic Focus'}
                    onChange={(v) => updateMeta('postStyle', v)}
                    options={[
                      'Quote Card & Typographic Focus',
                      'Stat & Key Metric Callout',
                      'Product Feature Highlight',
                      'Educational Framework / Checklist',
                      'Meme / Relatable Industry Visual',
                    ]}
                  />
                </Field>
                <Field label="Background style & color scheme" hint="canvas mood">
                  <OptionSelect
                    value={draft.productionMeta?.backgroundStyle || 'Gradient Mesh Accent'}
                    onChange={(v) => updateMeta('backgroundStyle', v)}
                    options={[
                      'Gradient Mesh Accent',
                      'Solid Dark (#0F172A)',
                      'Clean Brand Light (#FAFAFA)',
                      'Photo Backdrop with Dark Overlay',
                      'Textured Paper / Grid Accent',
                    ]}
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '1080×1080 (1:1 Instagram Square Feed)',
                    '1080×1350 (4:5 Instagram Portrait Feed)',
                    '1200×628 (1.91:1 Landscape Post / Link Card)',
                    '1920×1080 (16:9 Landscape Feed)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Graphic headline & text on image"
                  className="sm:col-span-2"
                  hint="the primary typography rendered directly on the asset"
                >
                  <Input
                    value={draft.productionMeta?.graphicHeadline || ''}
                    onChange={(e) => updateMeta('graphicHeadline', e.target.value)}
                    placeholder="e.g. 83% of top creators optimize their pipeline before scaling"
                  />
                </Field>

                <Field
                  label="Focal visual asset / 3D cutout link"
                  className="sm:col-span-2"
                  hint="product screenshot, 3D icon, or photography link"
                >
                  <Input
                    value={draft.productionMeta?.focalAssetUrl || ''}
                    onChange={(e) => updateMeta('focalAssetUrl', e.target.value)}
                    placeholder="https://figma.com/... or Google Drive cutout link"
                  />
                </Field>

                <Field
                  label="Visual typography & styling notes"
                  className="sm:col-span-2"
                  hint="margins, font pairings, brand accents"
                >
                  <Input
                    value={draft.productionMeta?.designNotes || ''}
                    onChange={(e) => updateMeta('designNotes', e.target.value)}
                    placeholder="e.g. JetBrains Mono label tags, bold serif headline, 80px padded safe margins"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Illustrator', 'Photoshop', 'Canva']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="final asset format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'High-Res PNG (Lossless)'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={['High-Res PNG (Lossless)', 'WebP (Optimized)', 'Vector SVG']}
                  />
                </Field>

                <Field label="Figma / design workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/..."
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or cloud export link"
                  />
                </Field>
              </Group>
            )}

            {/* 4. Banner / Header */}
            {currentSubCategory === 'Banner / Header' && (
              <Group title="Banner & Header Specifications">
                <Field label="Banner placement & channel" hint="target platform">
                  <OptionSelect
                    value={draft.productionMeta?.bannerPlacement || 'YouTube Channel Banner (2560×1440)'}
                    onChange={(v) => {
                      updateMeta('bannerPlacement', v)
                      if (v.includes('YouTube')) updateMeta('dimensions', '2560×1440 (16:9 YouTube Channel Banner)')
                      else if (v.includes('Twitter')) updateMeta('dimensions', '1500×500 (3:1 Twitter / X Header)')
                      else if (v.includes('LinkedIn')) updateMeta('dimensions', '1584×396 (4:1 LinkedIn Company Cover)')
                      else if (v.includes('Facebook')) updateMeta('dimensions', '1640×924 (1.77:1 Facebook Group Banner)')
                      else if (v.includes('Website')) updateMeta('dimensions', '1920×1080 (16:9 Website Hero Banner)')
                      else if (v.includes('Email')) updateMeta('dimensions', '1200×600 (2:1 Email Newsletter Header)')
                    }}
                    options={[
                      'YouTube Channel Banner (2560×1440)',
                      'Twitter / X Header (1500×500)',
                      'LinkedIn Company Cover (1584×396)',
                      'Facebook Group Banner (1640×924)',
                      'Website Hero Banner (1920×1080)',
                      'Email Newsletter Header (1200×600)',
                    ]}
                  />
                </Field>
                <Field label="Primary call-to-action prompt" hint="action copy">
                  <Input
                    value={draft.productionMeta?.bannerCta || ''}
                    onChange={(e) => updateMeta('bannerCta', e.target.value)}
                    placeholder="e.g. Subscribe for weekly drops / Link below"
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '2560×1440 (16:9 YouTube Channel Banner)',
                    '1500×500 (3:1 Twitter / X Header)',
                    '1584×396 (4:1 LinkedIn Company Cover)',
                    '1640×924 (1.77:1 Facebook Group Banner)',
                    '1920×1080 (16:9 Website Hero Banner)',
                    '1200×600 (2:1 Email Newsletter Header)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Core tagline & value proposition on banner"
                  className="sm:col-span-2"
                  hint="prominent headline displayed in center view"
                >
                  <Input
                    value={draft.productionMeta?.bannerTagline || ''}
                    onChange={(e) => updateMeta('bannerTagline', e.target.value)}
                    placeholder="e.g. The Operating System for Modern Creators & Production Teams"
                  />
                </Field>

                <Field
                  label="Center safe-zone & mobile crop notes"
                  className="sm:col-span-2"
                  hint="ensure key text is visible on both mobile and TV displays"
                >
                  <Input
                    value={draft.productionMeta?.bannerSafeZoneNotes || ''}
                    onChange={(e) => updateMeta('bannerSafeZoneNotes', e.target.value)}
                    placeholder="e.g. All copy and logo restricted to 1546×423 desktop/mobile safe area"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Illustrator', 'Photoshop', 'Canva']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="final asset format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'High-Res PNG (Lossless)'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={['High-Res PNG (Lossless)', 'JPG (Standard web)', 'WebP (Optimized)']}
                  />
                </Field>

                <Field label="Figma / design workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/..."
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or banner export link"
                  />
                </Field>
              </Group>
            )}

            {/* 5. Infographic */}
            {currentSubCategory === 'Infographic' && (
              <Group title="Infographic Structure & Data Specifications">
                <Field label="Infographic structure & layout" hint="layout framework">
                  <OptionSelect
                    value={draft.productionMeta?.infographicType || 'Step-by-Step Process Roadmap'}
                    onChange={(v) => updateMeta('infographicType', v)}
                    options={[
                      'Step-by-Step Process Roadmap',
                      'Comparison / Versus Matrix Table',
                      'Chronological Timeline & Milestones',
                      'Data Statistics & Chart Breakdown',
                      'Cheat-Sheet / Checklist Grid',
                    ]}
                  />
                </Field>
                <Field label="Number of steps or data sections" hint="section count">
                  <Input
                    type="number"
                    min={3}
                    max={25}
                    value={draft.productionMeta?.infographicSectionCount || 5}
                    onChange={(e) => updateMeta('infographicSectionCount', Number(e.target.value))}
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '1080×1920 (9:16 Vertical Long Infographic)',
                    '1080×2160 (1:2 Tall Infographic / Pinterest)',
                    '1080×1350 (4:5 Social Infographic)',
                    '1080×1080 (1:1 Square Chart Visual)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Data source & research reference link"
                  className="sm:col-span-2"
                  hint="link to spreadsheet, report, or verified stats"
                >
                  <Input
                    value={draft.productionMeta?.dataSourceUrl || ''}
                    onChange={(e) => updateMeta('dataSourceUrl', e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/... or industry research paper"
                  />
                </Field>

                <Field
                  label="Visual hierarchy & color legend notes"
                  className="sm:col-span-2"
                  hint="color coding rules, icon styling, callout pins"
                >
                  <Input
                    value={draft.productionMeta?.infographicHierarchyNotes || ''}
                    onChange={(e) => updateMeta('infographicHierarchyNotes', e.target.value)}
                    placeholder="e.g. Green for positive metrics, red for risks, numbered pins from 1 to 5"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Illustrator', 'Canva']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="infographic export format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'High-Res PNG (Lossless)'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={['High-Res PNG (Lossless)', 'Vector PDF', 'WebP (Optimized)', 'Vector SVG']}
                  />
                </Field>

                <Field label="Figma / design workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/..."
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or infographic export link"
                  />
                </Field>
              </Group>
            )}

            {/* 6. Story / Vertical Graphic */}
            {currentSubCategory === 'Story / Vertical Graphic' && (
              <Group title="Story / Vertical Graphic Specifications">
                <Field label="Story sequence & frame count" hint="number of screens">
                  <OptionSelect
                    value={draft.productionMeta?.storyFrameCount ? `${draft.productionMeta.storyFrameCount} Frames` : 'Single Frame (15s announcement)'}
                    onChange={(v) => {
                      const count = parseInt(v, 10) || 1
                      updateMeta('storyFrameCount', count)
                    }}
                    options={[
                      'Single Frame (15s announcement)',
                      '3-Part Mini Series (Hook -> Body -> CTA)',
                      '5-Part Product Walkthrough',
                      'Daily Flash Update (1–2 Frames)',
                    ]}
                  />
                </Field>
                <Field label="Interactive sticker type" hint="engagement tool">
                  <OptionSelect
                    value={draft.productionMeta?.storyInteractivity || 'Link Sticker CTA (External link)'}
                    onChange={(v) => updateMeta('storyInteractivity', v)}
                    options={[
                      'Link Sticker CTA (External link)',
                      'Poll Sticker (A vs B choice)',
                      'Question Box (AMA prompt)',
                      'Emoji Slider Rating',
                      'Countdown Timer to Launch',
                      'None (Clean visual only)',
                    ]}
                  />
                </Field>

                <RatioRow
                  ratioValue={staticRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '1080×1920 (9:16 Fullscreen Mobile Story / Reel)',
                    '1125×2436 (9:19.5 iPhone Full Screen)',
                    '1080×2400 (20:9 Android Tall Display)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('dimensions', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field
                  label="Link sticker destination URL & label"
                  className="sm:col-span-2"
                  hint="destination for the interactive link sticker"
                >
                  <Input
                    value={draft.productionMeta?.storyLinkUrl || ''}
                    onChange={(e) => updateMeta('storyLinkUrl', e.target.value)}
                    placeholder="https://... | Sticker label: e.g. 'Read Full Guide'"
                  />
                </Field>

                <Field
                  label="Safe-zone constraints & UI margins"
                  className="sm:col-span-2"
                  hint="ensure text avoids native story interface"
                >
                  <Input
                    value={draft.productionMeta?.storySafeZoneNotes || 'Keep critical text between 250px top and 300px bottom safe zone'}
                    onChange={(e) => updateMeta('storySafeZoneNotes', e.target.value)}
                    placeholder="e.g. Avoid top 15% header & bottom 20% swipe-up reply bar"
                  />
                </Field>

                <Field label="Primary design tool" hint="workspace suite">
                  <OptionSelect
                    value={draft.productionMeta?.designTool || 'Figma'}
                    onChange={(v) => updateMeta('designTool', v)}
                    options={['Figma', 'Illustrator', 'Canva', 'Photoshop']}
                  />
                </Field>

                <Field label="Export deliverable format" hint="story export format">
                  <OptionSelect
                    value={draft.productionMeta?.exportFormat || 'High-Res PNG (Lossless)'}
                    onChange={(v) => updateMeta('exportFormat', v)}
                    options={['High-Res PNG (Lossless)', '9:16 WebP (Optimized)', 'JPG (Standard)']}
                  />
                </Field>

                <Field label="Figma / design workfile link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.figmaUrl || ''}
                    onChange={(e) => updateMeta('figmaUrl', e.target.value)}
                    placeholder="https://figma.com/file/..."
                  />
                </Field>

                <Field label="Final output deliverable link" className="sm:col-span-2" hint="download export link">
                  <Input
                    value={draft.links.final}
                    onChange={(e) => set('links', { ...draft.links, final: e.target.value })}
                    placeholder="https://drive.google.com/... or story export link"
                  />
                </Field>
              </Group>
            )}
          </div>
        )}

        {/* VIDEO SUBCATEGORIES */}
        {currentFormat === 'video' && (
          <div className="space-y-6 rounded-lg border border-line/60 bg-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="label-caps font-bold text-ink">
                Video Production · {currentSubCategory}
              </span>
              <span className="font-mono text-label-micro text-primary">Photo Shoot & Motion Segments Active</span>
            </div>

            {/* 1. Reels & Shorts (9:16) */}
            {currentSubCategory === 'Reels & Shorts (9:16)' && (
              <Group title="Reels & Shorts Production Workflow">
                <Field label="Filming & creator shoot style" hint="style profile">
                  <OptionSelect
                    value={draft.productionMeta?.shootStyle || 'Handheld / UGC creator style'}
                    onChange={(v) => updateMeta('shootStyle', v)}
                    options={[
                      'Handheld / UGC creator style',
                      'Outdoor shoot',
                      'Screen recording & software demo',
                      'Studio set & lighting',
                      'B-Roll & voiceover',
                      'Interview / Talking head dialogue',
                    ]}
                  />
                </Field>
                <Field label="Target duration" hint="planned runtime">
                  <OptionSelect
                    value={draft.productionMeta?.duration || '30s'}
                    onChange={(v) => updateMeta('duration', v)}
                    options={['15s', '30s', '45s', '60s', '90s']}
                  />
                </Field>

                <RatioRow
                  ratioValue={videoRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '9:16 (1080×1920 Vertical Reel/Short/TikTok)',
                    '4:5 (1080×1350 Portrait Feed)',
                    '1:1 (Square Feed)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('aspectRatio', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field label="Opening 3-second hook direction" className="sm:col-span-2" hint="visual and spoken hook">
                  <Input
                    value={draft.productionMeta?.videoHook || ''}
                    onChange={(e) => updateMeta('videoHook', e.target.value)}
                    placeholder="e.g. 'Stop making this $10k mistake when building pipelines...' with bold text popup"
                  />
                </Field>

                <Field label="Sound track & trending audio notes">
                  <Input
                    value={draft.productionMeta?.trendingAudio || draft.productionMeta?.soundNotes || ''}
                    onChange={(e) => {
                      updateMeta('trendingAudio', e.target.value)
                      updateMeta('soundNotes', e.target.value)
                    }}
                    placeholder="e.g. Trending upbeat lo-fi track, sync cuts on the beat"
                  />
                </Field>

                <Field label="Caption & subtitle styling">
                  <OptionSelect
                    value={draft.productionMeta?.subtitleStyle || 'Yellow keyword pop & kinetic bouncing captions'}
                    onChange={(v) => updateMeta('subtitleStyle', v)}
                    options={[
                      'Yellow keyword pop & kinetic bouncing captions',
                      'Clean minimalist bottom subtitles',
                      'Full karaoke-style word highlighting',
                      'No subtitles (audio only)',
                    ]}
                  />
                </Field>

                <Field label="Shoot date" hint="planned filming day">
                  <Input
                    type="date"
                    value={draft.productionMeta?.shootDate || ''}
                    onChange={(e) => updateMeta('shootDate', e.target.value)}
                  />
                </Field>

                <Field label="Set location & studio bay">
                  <Input
                    value={draft.productionMeta?.shootLocation || ''}
                    onChange={(e) => updateMeta('shootLocation', e.target.value)}
                    placeholder="e.g. Studio Bay A or Creator Desk Setup"
                  />
                </Field>

                <Field label="Raw footage / camera roll link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.rawFootageUrl || draft.links.raw}
                    onChange={(e) => {
                      updateMeta('rawFootageUrl', e.target.value)
                      set('links', { ...draft.links, raw: e.target.value })
                    }}
                    placeholder="Google Drive, Dropbox, or Frame.io raw footage folder"
                  />
                </Field>

                <Field label="Rough cut preview link" hint="review draft">
                  <Input
                    value={draft.productionMeta?.roughCutUrl || ''}
                    onChange={(e) => updateMeta('roughCutUrl', e.target.value)}
                    placeholder="https://drive.google.com/... or Frame.io cut"
                  />
                </Field>

                <Field label="Video workfile link" hint="CapCut / Premiere / FCP">
                  <Input
                    value={draft.productionMeta?.workfileUrl || ''}
                    onChange={(e) => updateMeta('workfileUrl', e.target.value)}
                    placeholder="Project file repo or cloud link"
                  />
                </Field>

                <Field label="Editing & pacing notes" className="sm:col-span-2" hint="cuts, zoom-ins, SFX cues">
                  <Input
                    value={draft.productionMeta?.editingNotes || ''}
                    onChange={(e) => updateMeta('editingNotes', e.target.value)}
                    placeholder="e.g. Fast zooms every 2.5s, punch sound effects on keyword reveals, high saturation"
                  />
                </Field>
              </Group>
            )}

            {/* 2. Long-Form Video (16:9) */}
            {currentSubCategory === 'Long-Form Video (16:9)' && (
              <Group title="Long-Form Video Production & Studio Setup">
                <Field label="Filming & studio setup" hint="recording style">
                  <OptionSelect
                    value={draft.productionMeta?.shootStyle || 'Studio set & lighting'}
                    onChange={(v) => updateMeta('shootStyle', v)}
                    options={[
                      'Studio set & lighting',
                      'Outdoor shoot',
                      'Interview / A-Roll dialogue',
                      'On-location multi-cam shoot',
                      'Screen recording & software walkthrough',
                      'Documentary / B-Roll narrative',
                    ]}
                  />
                </Field>
                <Field label="Target duration" hint="planned runtime">
                  <Input
                    value={draft.productionMeta?.duration || '8–12 mins'}
                    onChange={(e) => updateMeta('duration', e.target.value)}
                    placeholder="e.g. 5–8 mins, 10–15 mins, or 20+ mins"
                  />
                </Field>

                <RatioRow
                  ratioValue={videoRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '16:9 (1920×1080 Full HD Landscape)',
                    '16:9 (3840×2160 4K UHD)',
                    '21:9 (Ultrawide Cinematic 2.39:1)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('aspectRatio', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field label="Shoot date" hint="planned filming day">
                  <Input
                    type="date"
                    value={draft.productionMeta?.shootDate || ''}
                    onChange={(e) => updateMeta('shootDate', e.target.value)}
                  />
                </Field>

                <Field label="Set location & studio bay">
                  <Input
                    value={draft.productionMeta?.shootLocation || ''}
                    onChange={(e) => updateMeta('shootLocation', e.target.value)}
                    placeholder="e.g. Soundstage 2, soundproof booth, or on-site client set"
                  />
                </Field>

                <Field label="Talent, actors & wardrobe notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.talentNotes || ''}
                    onChange={(e) => updateMeta('talentNotes', e.target.value)}
                    placeholder="e.g. Lead presenter, guest speaker, mic lavalier setup, wardrobe"
                  />
                </Field>

                <Field label="Shot list & B-roll directions" className="sm:col-span-2" hint="framing, angles, cutaways">
                  <Input
                    value={draft.productionMeta?.shotList || ''}
                    onChange={(e) => updateMeta('shotList', e.target.value)}
                    placeholder="e.g. Wide A-Cam (0-1m), tight B-Cam on key points, over-shoulder screencast"
                  />
                </Field>

                <Field label="Chapter markers & pacing breakdown" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.chapterNotes || ''}
                    onChange={(e) => updateMeta('chapterNotes', e.target.value)}
                    rows={3}
                    placeholder="00:00 - Intro & hook&#10;01:30 - Core problem breakdown&#10;05:15 - Practical demonstration&#10;09:40 - Summary & CTA"
                  />
                </Field>

                <Field label="Raw footage folder link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.rawFootageUrl || draft.links.raw}
                    onChange={(e) => {
                      updateMeta('rawFootageUrl', e.target.value)
                      set('links', { ...draft.links, raw: e.target.value })
                    }}
                    placeholder="Google Drive, Dropbox, or Frame.io raw footage folder"
                  />
                </Field>

                <Field label="Rough cut preview link" hint="team feedback review">
                  <Input
                    value={draft.productionMeta?.roughCutUrl || ''}
                    onChange={(e) => updateMeta('roughCutUrl', e.target.value)}
                    placeholder="https://drive.google.com/... or Frame.io rough cut"
                  />
                </Field>

                <Field label="Video workfile link" hint="Premiere / DaVinci">
                  <Input
                    value={draft.productionMeta?.workfileUrl || ''}
                    onChange={(e) => updateMeta('workfileUrl', e.target.value)}
                    placeholder="Project file link or Creative Cloud repo"
                  />
                </Field>

                <Field label="Editing, color grade & sound design notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.editingNotes || ''}
                    onChange={(e) => updateMeta('editingNotes', e.target.value)}
                    placeholder="e.g. Rec.709 color grade, normalized -14 LUFS voiceover audio, lower thirds on speaker intro"
                  />
                </Field>
              </Group>
            )}

            {/* 3. Video Graphics & Motion Promo */}
            {currentSubCategory === 'Video Graphics & Motion Promo' && (
              <Group title="Video Graphics & Motion Design Workflow">
                <Field label="Motion graphic & animation style" hint="visual design approach">
                  <OptionSelect
                    value={draft.productionMeta?.motionGraphicsNotes || 'Lower thirds & kinetic typography'}
                    onChange={(v) => updateMeta('motionGraphicsNotes', v)}
                    options={[
                      'Lower thirds & kinetic typography',
                      'Animated UI overlays & product demo',
                      'Logo stinger / intro & outro bumpers',
                      'Split-screen & picture-in-picture',
                      'Full custom 2D/3D motion graphics',
                    ]}
                  />
                </Field>

                <Field label="Animation software" hint="primary tool">
                  <OptionSelect
                    value={draft.productionMeta?.animationTool || 'After Effects'}
                    onChange={(v) => updateMeta('animationTool', v)}
                    options={['After Effects', 'Premiere Pro', 'Blender 3D', 'Canva Video', 'Cinema 4D']}
                  />
                </Field>

                <RatioRow
                  ratioValue={videoRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '16:9 (Landscape YouTube/Broadcast)',
                    '9:16 (Vertical Reel/Short/Promo)',
                    '1:1 (Square Ad)',
                    '4:5 (Portrait Social Ad)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('aspectRatio', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field label="Target duration" hint="planned runtime">
                  <Input
                    value={draft.productionMeta?.duration || '15s'}
                    onChange={(e) => updateMeta('duration', e.target.value)}
                    placeholder="e.g. 10s, 15s, or 30s"
                  />
                </Field>

                <Field label="Sound design & SFX mix" hint="audio assets">
                  <Input
                    value={draft.productionMeta?.soundNotes || ''}
                    onChange={(e) => updateMeta('soundNotes', e.target.value)}
                    placeholder="e.g. Whoosh transitions, digital UI clicks, riser intro"
                  />
                </Field>

                <Field label="Graphic headline & kinetic copy cues" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.graphicHeadline || ''}
                    onChange={(e) => updateMeta('graphicHeadline', e.target.value)}
                    placeholder="e.g. 'Build 10x Faster With Automated Pipelines' animated text sequence"
                  />
                </Field>

                <Field label="Project workfile repo link">
                  <Input
                    value={draft.productionMeta?.workfileUrl || ''}
                    onChange={(e) => updateMeta('workfileUrl', e.target.value)}
                    placeholder="After Effects .aep or repository link"
                  />
                </Field>

                <Field label="Rough cut preview link">
                  <Input
                    value={draft.productionMeta?.roughCutUrl || ''}
                    onChange={(e) => updateMeta('roughCutUrl', e.target.value)}
                    placeholder="Frame.io preview or Google Drive link"
                  />
                </Field>

                <Field label="Motion design & rendering notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.editingNotes || ''}
                    onChange={(e) => updateMeta('editingNotes', e.target.value)}
                    placeholder="e.g. 60fps render, ProRes 4444 with alpha transparency channel"
                  />
                </Field>
              </Group>
            )}

            {/* 4. Interview & Podcast Video */}
            {currentSubCategory === 'Interview & Podcast Video' && (
              <Group title="Interview & Podcast Video Production">
                <Field label="Recording setup" hint="production format">
                  <OptionSelect
                    value={draft.productionMeta?.shootStyle || 'Multi-camera studio podcast'}
                    onChange={(v) => updateMeta('shootStyle', v)}
                    options={[
                      'Multi-camera studio podcast',
                      'Outdoor shoot',
                      'Remote recording via Riverside/SquadCast',
                      'Dual-lapel microphone set',
                      'Single presenter desk setup',
                    ]}
                  />
                </Field>

                <Field label="Target duration" hint="episode runtime">
                  <Input
                    value={draft.productionMeta?.duration || '45 mins'}
                    onChange={(e) => updateMeta('duration', e.target.value)}
                    placeholder="e.g. 30 mins, 45 mins, or 60 mins"
                  />
                </Field>

                <RatioRow
                  ratioValue={videoRatioValue}
                  customRatioValue={draft.productionMeta?.customRatio || ''}
                  options={[
                    '16:9 (Full Broadcast Episode)',
                    '9:16 (Shorts/Reels Highlight Clips)',
                    '1:1 (Square Audiogram)',
                    'Custom ratio...',
                  ]}
                  onRatioChange={(v) => updateMeta('aspectRatio', v)}
                  onCustomRatioChange={(v) => updateMeta('customRatio', v)}
                />

                <Field label="Guest & speaker notes">
                  <Input
                    value={draft.productionMeta?.guestNotes || draft.productionMeta?.talentNotes || ''}
                    onChange={(e) => {
                      updateMeta('guestNotes', e.target.value)
                      updateMeta('talentNotes', e.target.value)
                    }}
                    placeholder="e.g. Guest name, title, company, bio"
                  />
                </Field>

                <Field label="Recording date" hint="session date">
                  <Input
                    type="date"
                    value={draft.productionMeta?.shootDate || ''}
                    onChange={(e) => updateMeta('shootDate', e.target.value)}
                  />
                </Field>

                <Field label="Studio location / sound booth">
                  <Input
                    value={draft.productionMeta?.shootLocation || ''}
                    onChange={(e) => updateMeta('shootLocation', e.target.value)}
                    placeholder="e.g. Podcast Bay 1 or Remote session"
                  />
                </Field>

                <Field label="Mic & audio soundproofing notes">
                  <Input
                    value={draft.productionMeta?.soundNotes || ''}
                    onChange={(e) => updateMeta('soundNotes', e.target.value)}
                    placeholder="e.g. Shure SM7B mics, Cloudlifters, sound foam baffles"
                  />
                </Field>

                <Field label="Highlight timestamps & viral clip cues" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.chapterNotes || ''}
                    onChange={(e) => updateMeta('chapterNotes', e.target.value)}
                    rows={3}
                    placeholder="12:30 - Story about scaling from zero to $1M (Extract for Reel)&#10;24:15 - Surprising advice for new founders&#10;38:00 - Closing lightning round"
                  />
                </Field>

                <Field label="Raw audio / multitrack link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.rawFootageUrl || draft.links.raw}
                    onChange={(e) => {
                      updateMeta('rawFootageUrl', e.target.value)
                      set('links', { ...draft.links, raw: e.target.value })
                    }}
                    placeholder="Riverside download link or Google Drive multitrack WAV/MP4 folder"
                  />
                </Field>

                <Field label="Rough cut preview link">
                  <Input
                    value={draft.productionMeta?.roughCutUrl || ''}
                    onChange={(e) => updateMeta('roughCutUrl', e.target.value)}
                    placeholder="Frame.io preview or Google Drive link"
                  />
                </Field>

                <Field label="Project workfile link">
                  <Input
                    value={draft.productionMeta?.workfileUrl || ''}
                    onChange={(e) => updateMeta('workfileUrl', e.target.value)}
                    placeholder="Premiere / Audition project link"
                  />
                </Field>

                <Field label="Editing & clip extraction notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.editingNotes || ''}
                    onChange={(e) => updateMeta('editingNotes', e.target.value)}
                    placeholder="e.g. Cut umms & long pauses, generate 3 vertical 9:16 teaser clips with animated captions"
                  />
                </Field>
              </Group>
            )}
          </div>
        )}

        {/* WRITE-UP SUBCATEGORIES */}
        {currentFormat === 'written' && (
          <div className="space-y-4 rounded-lg border border-line/60 bg-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="label-caps font-bold text-ink">
                Editorial Segment · {currentSubCategory}
              </span>
              <span className="font-mono text-label-micro text-primary">Written Content Workflow</span>
            </div>

            {/* 1. Blog Post */}
            {currentSubCategory === 'Blog Post' && (
              <Group title="Blog Post Editorial Specifications">
                <Field label="Target word count" hint="planned article length">
                  <Input
                    type="number"
                    step={100}
                    value={draft.productionMeta?.wordCountTarget || ''}
                    onChange={(e) => updateMeta('wordCountTarget', Number(e.target.value))}
                    placeholder="e.g. 1200 words"
                  />
                </Field>
                <Field label="Editorial tone & angle" hint="voice style">
                  <OptionSelect
                    value={draft.productionMeta?.editorialTone || 'Authoritative & Thought Leadership'}
                    onChange={(v) => updateMeta('editorialTone', v)}
                    options={[
                      'Authoritative & Thought Leadership',
                      'Conversational & Engaging',
                      'Educational & How-To',
                      'Punchy & Opinionated',
                      'Technical & In-Depth',
                    ]}
                  />
                </Field>

                <Field label="Primary SEO keywords" className="sm:col-span-2" hint="search optimization targets">
                  <Input
                    value={draft.productionMeta?.seoKeywords || ''}
                    onChange={(e) => updateMeta('seoKeywords', e.target.value)}
                    placeholder="e.g. video production pipeline, agency workflow, content automation"
                  />
                </Field>

                <Field label="Draft document link (Google Docs / Notion / CMS)" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.draftUrl || draft.links.brief}
                    onChange={(e) => {
                      updateMeta('draftUrl', e.target.value)
                      set('links', { ...draft.links, brief: e.target.value })
                    }}
                    placeholder="https://docs.google.com/document/... or Notion page link"
                  />
                </Field>

                <Field label="Article outline & core thesis" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.outlineNotes || ''}
                    onChange={(e) => updateMeta('outlineNotes', e.target.value)}
                    rows={3}
                    placeholder="1. Hook: Why multi-pipeline agencies struggle&#10;2. Framework: Unified pipeline merging&#10;3. Case Study & Results&#10;4. Key takeaways & call to action"
                  />
                </Field>

                <Field label="Proofreader & fact-checking review notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.proofreadNotes || ''}
                    onChange={(e) => updateMeta('proofreadNotes', e.target.value)}
                    placeholder="Fact-checking items, references, editorial signoff"
                  />
                </Field>

                <Field label="Published live article link" className="sm:col-span-2" hint="canonical URL">
                  <Input
                    value={draft.links.published}
                    onChange={(e) => set('links', { ...draft.links, published: e.target.value })}
                    placeholder="https://yourblog.com/..."
                  />
                </Field>
              </Group>
            )}

            {/* 2. Newsletter */}
            {currentSubCategory === 'Newsletter' && (
              <Group title="Newsletter Editorial Specifications">
                <Field label="Target word count" hint="newsletter length">
                  <Input
                    type="number"
                    step={50}
                    value={draft.productionMeta?.wordCountTarget || ''}
                    onChange={(e) => updateMeta('wordCountTarget', Number(e.target.value))}
                    placeholder="e.g. 600 words"
                  />
                </Field>
                <Field label="Editorial tone & style" hint="reader relationship">
                  <OptionSelect
                    value={draft.productionMeta?.editorialTone || 'Personal, Direct & High-Value'}
                    onChange={(v) => updateMeta('editorialTone', v)}
                    options={[
                      'Personal, Direct & High-Value',
                      'Weekly Industry Curated Digest',
                      'Deep Dive Framework',
                      'Quick Tip & Actionable Advice',
                    ]}
                  />
                </Field>

                <Field label="Email subject line & preview hook" className="sm:col-span-2" hint="open-rate driver">
                  <Input
                    value={draft.productionMeta?.subjectLine || ''}
                    onChange={(e) => updateMeta('subjectLine', e.target.value)}
                    placeholder="e.g. The single pipeline mistake costing you 10 hours a week (Issue #42)"
                  />
                </Field>

                <Field label="Primary Call to Action (CTA) link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.callToAction || ''}
                    onChange={(e) => updateMeta('callToAction', e.target.value)}
                    placeholder="e.g. Try the new workflow template at https://..."
                  />
                </Field>

                <Field label="Draft document / Substack / Beehiiv link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.draftUrl || draft.links.brief}
                    onChange={(e) => {
                      updateMeta('draftUrl', e.target.value)
                      set('links', { ...draft.links, brief: e.target.value })
                    }}
                    placeholder="https://docs.google.com/document/... or Beehiiv post link"
                  />
                </Field>

                <Field label="Newsletter section outline & sponsor slot" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.outlineNotes || ''}
                    onChange={(e) => updateMeta('outlineNotes', e.target.value)}
                    rows={3}
                    placeholder="1. Intro story & personal lesson&#10;2. Sponsor highlight / featured tool&#10;3. Main breakdown: 3 actionable workflow steps&#10;4. Question for readers & signoff"
                  />
                </Field>

                <Field label="Proofreader & review notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.proofreadNotes || ''}
                    onChange={(e) => updateMeta('proofreadNotes', e.target.value)}
                    placeholder="Link check, test email sent to team, subject line A/B test"
                  />
                </Field>
              </Group>
            )}

            {/* 3. Social Thread */}
            {currentSubCategory === 'Social Thread' && (
              <Group title="Social Thread / Micro-Copy Specifications">
                <Field label="Thread / card count" hint="number of posts in thread">
                  <Input
                    type="number"
                    min={2}
                    max={25}
                    value={draft.productionMeta?.threadCount || 7}
                    onChange={(e) => updateMeta('threadCount', Number(e.target.value))}
                  />
                </Field>
                <Field label="Editorial tone" hint="social engagement style">
                  <OptionSelect
                    value={draft.productionMeta?.editorialTone || 'Punchy & Actionable'}
                    onChange={(v) => updateMeta('editorialTone', v)}
                    options={[
                      'Punchy & Actionable',
                      'Storytelling & Case Study',
                      'Contrarian / Hot Take',
                      'Step-by-Step Tutorial',
                    ]}
                  />
                </Field>

                <Field label="Opening viral hook post (Post #1)" className="sm:col-span-2" hint="the scroll-stopper">
                  <Textarea
                    value={draft.productionMeta?.outlineNotes || ''}
                    onChange={(e) => updateMeta('outlineNotes', e.target.value)}
                    rows={2}
                    placeholder="e.g. Most production teams waste 40% of their week on manual handoffs. Here is the 4-step framework we used to fix it: 🧵👇"
                  />
                </Field>

                <Field label="Draft document / thread writer link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.draftUrl || draft.links.brief}
                    onChange={(e) => {
                      updateMeta('draftUrl', e.target.value)
                      set('links', { ...draft.links, brief: e.target.value })
                    }}
                    placeholder="https://typefully.com/... or Google Docs thread draft"
                  />
                </Field>

                <Field label="Final engagement prompt & follow CTA" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.callToAction || ''}
                    onChange={(e) => updateMeta('callToAction', e.target.value)}
                    placeholder="e.g. If you found this valuable, repost Post #1 and follow @creator for more"
                  />
                </Field>
              </Group>
            )}

            {/* 4. Case Study & Article */}
            {currentSubCategory === 'Case Study & Article' && (
              <Group title="Case Study & Article Specifications">
                <Field label="Target word count" hint="in-depth story">
                  <Input
                    type="number"
                    step={100}
                    value={draft.productionMeta?.wordCountTarget || ''}
                    onChange={(e) => updateMeta('wordCountTarget', Number(e.target.value))}
                    placeholder="e.g. 1500 words"
                  />
                </Field>
                <Field label="Editorial tone" hint="editorial approach">
                  <OptionSelect
                    value={draft.productionMeta?.editorialTone || 'Authoritative & Data-Backed'}
                    onChange={(v) => updateMeta('editorialTone', v)}
                    options={[
                      'Authoritative & Data-Backed',
                      'Narrative Journalism',
                      'Customer Hero Story',
                      'Technical Whitepaper',
                    ]}
                  />
                </Field>

                <Field label="Featured client / company">
                  <Input
                    value={draft.productionMeta?.clientSubject || ''}
                    onChange={(e) => updateMeta('clientSubject', e.target.value)}
                    placeholder="e.g. Acme Corp or Growth Agency Inc."
                  />
                </Field>

                <Field label="Primary metric / ROI highlight">
                  <Input
                    value={draft.productionMeta?.keyMetrics || ''}
                    onChange={(e) => updateMeta('keyMetrics', e.target.value)}
                    placeholder="e.g. 3.4x production velocity in 30 days"
                  />
                </Field>

                <Field label="Draft document link (Google Docs / Notion)" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.draftUrl || draft.links.brief}
                    onChange={(e) => {
                      updateMeta('draftUrl', e.target.value)
                      set('links', { ...draft.links, brief: e.target.value })
                    }}
                    placeholder="https://docs.google.com/document/..."
                  />
                </Field>

                <Field label="Challenge -> Solution -> Results framework" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.outlineNotes || ''}
                    onChange={(e) => updateMeta('outlineNotes', e.target.value)}
                    rows={3}
                    placeholder="Challenge: The bottleneck before implementation&#10;Solution: How the new pipeline solved it&#10;Results: Verified metric lift and team testimonial"
                  />
                </Field>

                <Field label="Customer quote & review notes" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.proofreadNotes || ''}
                    onChange={(e) => updateMeta('proofreadNotes', e.target.value)}
                    placeholder="Customer quote approval status and proofreader signoff"
                  />
                </Field>
              </Group>
            )}
          </div>
        )}

        {/* BRIEF SUBCATEGORIES */}
        {currentFormat === 'brief' && (
          <div className="space-y-4 rounded-lg border border-line/60 bg-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="label-caps font-bold text-ink">
                Strategic Briefing · {currentSubCategory}
              </span>
              <span className="font-mono text-label-micro text-primary">Campaign & Client Scope</span>
            </div>

            {/* 1. Campaign Brief */}
            {currentSubCategory === 'Campaign Brief' && (
              <Group title="Campaign Briefing Specifications">
                <Field label="Client / Stakeholder">
                  <Input
                    value={draft.productionMeta?.clientName || ''}
                    onChange={(e) => updateMeta('clientName', e.target.value)}
                    placeholder="e.g. Northwind Studio or Enterprise Client"
                  />
                </Field>
                <Field label="Approval target date" hint="client signoff">
                  <Input
                    type="date"
                    value={draft.productionMeta?.clientSignoffDate || ''}
                    onChange={(e) => updateMeta('clientSignoffDate', e.target.value)}
                  />
                </Field>

                <Field label="Campaign budget / tier">
                  <Input
                    value={draft.productionMeta?.campaignBudget || ''}
                    onChange={(e) => updateMeta('campaignBudget', e.target.value)}
                    placeholder="e.g. Tier 1 Hero ($25k) or Organic Sprint"
                  />
                </Field>

                <Field label="Primary Call to Action (CTA)">
                  <Input
                    value={draft.productionMeta?.callToAction || ''}
                    onChange={(e) => updateMeta('callToAction', e.target.value)}
                    placeholder="e.g. Request a demo / Sign up for product beta"
                  />
                </Field>

                <Field label="Moodboard & creative inspiration link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.moodboardUrl || ''}
                    onChange={(e) => updateMeta('moodboardUrl', e.target.value)}
                    placeholder="https://pinterest.com/... or Milanote board link"
                  />
                </Field>

                <Field label="Deliverables scope & checklist" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.deliverables || ''}
                    onChange={(e) => updateMeta('deliverables', e.target.value)}
                    placeholder="e.g. 1 Hero Video + 3 Static Carousels + 2 Story Ads"
                  />
                </Field>
              </Group>
            )}

            {/* 2. Client Deliverable & Scope */}
            {currentSubCategory === 'Client Deliverable & Scope' && (
              <Group title="Client Deliverable & Scope Specifications">
                <Field label="Client name">
                  <Input
                    value={draft.productionMeta?.clientName || ''}
                    onChange={(e) => updateMeta('clientName', e.target.value)}
                    placeholder="e.g. Global Brands Ltd"
                  />
                </Field>
                <Field label="Signoff target date" hint="milestone delivery">
                  <Input
                    type="date"
                    value={draft.productionMeta?.clientSignoffDate || ''}
                    onChange={(e) => updateMeta('clientSignoffDate', e.target.value)}
                  />
                </Field>

                <Field label="Project tier / budget">
                  <Input
                    value={draft.productionMeta?.campaignBudget || ''}
                    onChange={(e) => updateMeta('campaignBudget', e.target.value)}
                    placeholder="e.g. Retainer Tier A"
                  />
                </Field>

                <Field label="Primary client stakeholder">
                  <Input
                    value={draft.productionMeta?.callToAction || ''}
                    onChange={(e) => updateMeta('callToAction', e.target.value)}
                    placeholder="e.g. Jane Doe (Head of Marketing)"
                  />
                </Field>

                <Field label="Deliverable milestone breakdown" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.scopeSummary || draft.productionMeta?.deliverables || ''}
                    onChange={(e) => {
                      updateMeta('scopeSummary', e.target.value)
                      updateMeta('deliverables', e.target.value)
                    }}
                    rows={3}
                    placeholder="Milestone 1: Creative Brief & moodboard signoff&#10;Milestone 2: First-round asset drafts&#10;Milestone 3: Final package deliverable & source files"
                  />
                </Field>

                <Field label="Shared client repository / folder link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.moodboardUrl || ''}
                    onChange={(e) => updateMeta('moodboardUrl', e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/... or Dropbox shared repo"
                  />
                </Field>
              </Group>
            )}

            {/* 3. Creative Concept & Pitch */}
            {currentSubCategory === 'Creative Concept & Pitch' && (
              <Group title="Creative Concept & Pitch Specifications">
                <Field label="Brand / Client name">
                  <Input
                    value={draft.productionMeta?.clientName || ''}
                    onChange={(e) => updateMeta('clientName', e.target.value)}
                    placeholder="e.g. Horizon Labs"
                  />
                </Field>
                <Field label="Pitch presentation date" hint="target pitch date">
                  <Input
                    type="date"
                    value={draft.productionMeta?.clientSignoffDate || ''}
                    onChange={(e) => updateMeta('clientSignoffDate', e.target.value)}
                  />
                </Field>

                <Field label="Core concept theme & hook" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.callToAction || ''}
                    onChange={(e) => updateMeta('callToAction', e.target.value)}
                    placeholder="e.g. 'Beyond Friction' — A documentary-style brand narrative"
                  />
                </Field>

                <Field label="Concept moodboard & visual references link" className="sm:col-span-2">
                  <Input
                    value={draft.productionMeta?.moodboardUrl || ''}
                    onChange={(e) => updateMeta('moodboardUrl', e.target.value)}
                    placeholder="https://are.na/... or Figma deck link"
                  />
                </Field>

                <Field label="Key campaign rollout phases" className="sm:col-span-2">
                  <Textarea
                    value={draft.productionMeta?.deliverables || ''}
                    onChange={(e) => updateMeta('deliverables', e.target.value)}
                    rows={3}
                    placeholder="Phase 1: Teaser campaign & countdown (Week 1)&#10;Phase 2: Hero video launch & paid amplification (Week 2-3)&#10;Phase 3: Community UGC & customer case studies (Week 4)"
                  />
                </Field>
              </Group>
            )}
          </div>
        )}

        {/* -------- Derived Pipeline Summary -------- */}
        <div className="rounded-md border border-line/50 bg-sunken/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={OVERALL_STATUS_TONE[status]}>{stageLabel(draft, activeStages)}</StatusChip>
            <span className="font-mono text-label-micro uppercase text-ink-faint">
              next: {responsible}
              {stage ? ` · ${stage.name}` : ''}
            </span>
          </div>
          <div className="mt-3">
            <StageTrack
              item={draft}
              stages={activeStages}
              showLabels
              onToggle={
                readOnly
                  ? undefined
                  : (stageId, next) =>
                      setDraft((d) => ({ ...d, stageStates: { ...d.stageStates, [stageId]: next } }))
              }
            />
          </div>
          <p className="mt-2.5 text-body-xs text-ink-faint">
            Production flow scoped to <strong className="font-semibold text-ink-dim">{formatDef.label} · {currentSubCategory}</strong> ({activeStages.length} stages) — tap a stage to advance it.
          </p>
        </div>

        {/* -------- Basics: What it is -------- */}
        <Group title="What it is">
          <Field label="Title" className="sm:col-span-2">
            <Input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Product launch teaser"
            />
          </Field>

          <Field label="Topic" hint="short theme">
            <Input value={draft.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Spring release" />
          </Field>

          <Field label="Content type" hint="sub-category format">
            <OptionSelect
              value={draft.contentType}
              onChange={(v) => {
                set('contentType', v)
                updateMeta('subCategory', v)
              }}
              options={availableContentTypes}
              placeholder="—"
            />
          </Field>

          <Field label="Category" hint="taxonomy bucket">
            <OptionSelect
              value={draft.category && !draft.category.toLowerCase().includes('thumbnail') ? draft.category : ''}
              onChange={(v) => set('category', v)}
              options={cleanCategories}
              placeholder="—"
            />
          </Field>

          <Field label="Priority" hint="scheduling rank">
            <OptionSelect value={draft.priority} onChange={(v) => set('priority', v)} options={taxonomies.priorities} />
          </Field>

          <Field label="Primary platform" hint="performance channel">
            <OptionSelect value={draft.platform} onChange={(v) => set('platform', v)} options={platformOptions} placeholder="—" />
          </Field>

          <Field label="Production pipeline" hint="active workflow model">
            <Select
              value={draft.pipelineId || ''}
              onChange={(e) => set('pipelineId', e.target.value || undefined)}
            >
              <option value="">Auto-detected (Merged {formatDef.label} workflow)</option>
              {workspace.selectedPipelines &&
                workspace.selectedPipelines.map((id) => (
                  <option key={id} value={id}>
                    {PIPELINE_TEMPLATES.find((t) => t.id === id)?.name || id}
                  </option>
                ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Label hint="same asset, extra channels">Also posted to</Label>
            <div className="flex flex-wrap gap-1.5">
              {platformOptions
                .filter((p) => p !== draft.platform)
                .map((p) => {
                  const on = draft.crossPost.includes(p)
                  return (
                    <Chip
                      key={p}
                      active={on}
                      onClick={
                        readOnly
                          ? undefined
                          : () =>
                              set(
                                'crossPost',
                                on ? draft.crossPost.filter((x) => x !== p) : [...draft.crossPost, p],
                              )
                      }
                    >
                      {on && <Icon name="check" size={12} />}
                      {p}
                    </Chip>
                  )
                })}
            </div>
          </div>
        </Group>

        {/* -------- Goal: Why it exists -------- */}
        <Group title="Why it exists">
          <Field label="Objective" hint="business intention">
            <OptionSelect value={draft.objective} onChange={(v) => set('objective', v)} options={taxonomies.objectives} placeholder="—" />
          </Field>
          <Field label="Target audience" hint="buyer persona">
            <Input
              value={draft.audience}
              onChange={(e) => set('audience', e.target.value)}
              placeholder="e.g. Evaluating buyers"
              list="flux-audiences"
            />
            <datalist id="flux-audiences">
              {taxonomies.audiences.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
        </Group>

        {/* -------- Schedule -------- */}
        <Group title="Schedule">
          <Field label="Planning month" hint="drives calendar filters">
            <Input type="month" value={draft.month} onChange={(e) => set('month', e.target.value)} />
          </Field>
          <Field label="Planned publish date" hint="target launch day">
            <Input
              type="date"
              value={draft.plannedPublishDate}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({ ...d, plannedPublishDate: v, month: v ? monthKey(v) : d.month }))
              }}
              onBlur={(e) => cascadeDeadlines(e.target.value)}
            />
          </Field>
          <Field label="Actual publish date" hint="recorded when live">
            <Input
              type="date"
              value={draft.actualPublishDate}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({
                  ...d,
                  actualPublishDate: v,
                  lifecycle: v ? 'published' : d.lifecycle === 'published' ? 'active' : d.lifecycle,
                }))
              }}
            />
          </Field>
          <Field label="Lifecycle state" hint="production status">
            <Select value={draft.lifecycle} onChange={(e) => set('lifecycle', e.target.value as ContentItem['lifecycle'])}>
              <option value="idea">Idea — not started</option>
              <option value="active">Active — in production</option>
              <option value="revision">Revision — sent back</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </Group>

        {/* -------- Who does what: Pipeline Stages Assignment -------- */}
        <Group title="Who does what" cols={1}>
          <Field label="Content owner" hint="accountable end to end">
            <Select value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)} placeholder="Unassigned">
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.role}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2">
            <div className="hidden sm:grid sm:grid-cols-[1.3fr_1fr_1fr] gap-2 px-1 text-label-micro font-bold uppercase text-ink-dim">
              <span>Stage & Assignee</span>
              <span>Deadline</span>
              <span>Stage Status</span>
            </div>

            {activeStages.map((s) => {
              const state = stageState(draft, s.id)
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 gap-2 rounded-md border border-line/50 bg-sunken/40 p-2.5 sm:grid-cols-[1.3fr_1fr_1fr] sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-label-micro uppercase font-bold text-ink-dim">{s.name}</span>
                      <StatusChip tone={STATE_TONE[state]} dot={false} className="!py-0">
                        {STATE_LABEL[state]}
                      </StatusChip>
                    </div>
                    <Select
                      value={draft.stageAssignees?.[s.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, stageAssignees: { ...d.stageAssignees, [s.id]: e.target.value } }))
                      }
                      placeholder={`Suggested: ${memberName(members, suggestAssignee(members, s))}`}
                    >
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.role}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="sm:hidden text-label-micro text-ink-dim">Deadline</span>
                    <Input
                      type="date"
                      value={draft.stageDeadlines?.[s.id] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, stageDeadlines: { ...d.stageDeadlines, [s.id]: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="sm:hidden text-label-micro text-ink-dim">Stage Status</span>
                    <Select
                      value={state}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          stageStates: { ...d.stageStates, [s.id]: e.target.value as StageState },
                        }))
                      }
                    >
                      {(['pending', 'in_progress', 'complete', 'blocked'] as StageState[]).map((v) => (
                        <option key={v} value={v}>
                          {STATE_LABEL[v]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )
            })}
          </div>
        </Group>

        {/* -------- Where it stands -------- */}
        <Group title="Where it stands">
          <Field label="Blocker" hint="leave empty when unblocked">
            <Input
              value={draft.blocker}
              onChange={(e) => set('blocker', e.target.value)}
              placeholder="What is stopping this from moving?"
            />
          </Field>
          <Field label="Next action" hint="immediate step">
            <Input
              value={draft.nextAction}
              onChange={(e) => set('nextAction', e.target.value)}
              placeholder="The single next thing that needs doing"
            />
          </Field>
        </Group>

        {/* -------- Social Copy (Only shown when relevant) -------- */}
        {isSocialFormat && (
          <Group title="Social Copy & Distribution" cols={1}>
            <Field label="Caption" hint="on-platform copy">
              <Textarea
                value={draft.caption}
                onChange={(e) => set('caption', e.target.value)}
                rows={4}
                placeholder="Caption, hook, or on-platform social copy"
              />
            </Field>
            <Field label="Hashtags" hint="search tags">
              <Input value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#launch #marketing #design" />
            </Field>
          </Group>
        )}

        {/* -------- Notes -------- */}
        <Group title="Notes" cols={1}>
          <Field label="Remarks & internal feedback">
            <Textarea value={draft.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3} placeholder="Team collaboration notes or review feedback" />
          </Field>
        </Group>

        {!readOnly && draft.lifecycle !== 'published' && (
          <Button
            variant="ghost"
            icon="send"
            block
            onClick={() =>
              setDraft((d) => {
                const stageStates = { ...d.stageStates }
                for (const s of activeStages) stageStates[s.id] = 'complete'
                return {
                  ...d,
                  stageStates,
                  lifecycle: 'published',
                  actualPublishDate: d.actualPublishDate || today(),
                  blocker: '',
                }
              })
            }
          >
            Mark active pipeline complete and published
          </Button>
        )}
      </fieldset>
    </Sheet>
  )
}

/** Paired ratio field: Listed ratio preset dropdown alongside a Custom ratio text input. */
function RatioRow({
  ratioValue,
  customRatioValue,
  options,
  onRatioChange,
  onCustomRatioChange,
}: {
  ratioValue: string
  customRatioValue: string
  options: string[]
  onRatioChange: (v: string) => void
  onCustomRatioChange: (v: string) => void
}) {
  return (
    <>
      <Field label="Listed ratio & presets" hint="standard canvas">
        <OptionSelect
          value={ratioValue}
          onChange={(v) => {
            onRatioChange(v)
            if (v !== 'Custom ratio...') {
              onCustomRatioChange('')
            }
          }}
          options={options}
        />
      </Field>
      <Field label="Custom ratio or dimensions" hint="e.g. 21:9, 2:3, 1200×628">
        <Input
          value={customRatioValue}
          onChange={(e) => {
            const v = e.target.value
            onCustomRatioChange(v)
            if (v) onRatioChange(v)
          }}
          placeholder="e.g. 21:9, 2:3, or 1600×900"
        />
      </Field>
    </>
  )
}

function Group({
  title,
  children,
  cols = 2,
}: {
  title: string
  children: React.ReactNode
  cols?: 1 | 2
}) {
  return (
    <section>
      <h3 className="mb-2.5 border-b border-white/5 pb-1.5 label-caps">{title}</h3>
      <div className={cx('grid gap-3', cols === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>{children}</div>
    </section>
  )
}
