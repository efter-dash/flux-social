import { parseCSV, ratio } from './adsAudit.ts'

export interface CampaignRow {
  key: string
  name: string
  delivery: string
  indicator: string
  resultLabel: string
  results?: number
  spend: number
  impressions: number
  reach?: number
  attribution: string
  budget?: number
  budgetType: string
}
export interface CampaignImport {
  rows: CampaignRow[]
  currency: string
  start: string
  end: string
  columns: string[]
}
const normalized = (value: string) => value.replace(/^\uFEFF/,'').trim().toLowerCase()
export function isCampaignExport(text: string): boolean {
  const headers = parseCSV(text)[0]?.map(normalized) ?? []
  return headers.includes('campaign name') && !headers.includes('ad name')
}
export function resultLabel(indicator: string): string {
  if (['actions:offsite_conversion.fb_pixel_purchase','actions:purchase','actions:omni_purchase'].includes(indicator)) return 'Purchases'
  if (indicator === 'actions:onsite_conversion.messaging_conversation_started_7d') return 'Messaging conversations'
  if (indicator === 'actions:lead') return 'Leads'
  return indicator || 'Unspecified result'
}
export function importCampaignCSV(text: string): CampaignImport {
  const [columns, ...records] = parseCSV(text)
  if (!columns || !records.length) throw new Error('Include a header and at least one campaign row.')
  if (records.length > 10000) throw new Error('Use an aggregate export with no more than 10,000 campaign rows.')
  const headers = columns.map(normalized)
  for (const header of ['campaign name','campaign delivery','reporting starts','reporting ends','impressions','results','result indicator']) {
    if (!headers.includes(header)) throw new Error(`Campaign export is missing ${header}.`)
  }
  const spendIndex = headers.findIndex(h => /^amount spent \([a-z]{3}\)$/.test(h))
  if (spendIndex < 0) throw new Error('Campaign export needs Amount spent (XXX) with an explicit three-letter currency.')
  const currency = headers[spendIndex].match(/\(([a-z]{3})\)/)![1].toUpperCase()
  let start = '', end = ''
  const seen = new Set<string>()
  const rows = records.map((cells, i): CampaignRow => {
    if (cells.length !== columns.length) throw new Error(`Campaign row ${i+2}: column count differs from the header.`)
    const get = (header: string) => cells[headers.indexOf(header)]?.trim() ?? ''
    const numeric = (raw: string, label: string, optional = false): number | undefined => {
      if (raw === '' || raw === '-' || raw === '—') {
        if (optional) return undefined
        throw new Error(`Campaign row ${i+2}: ${label} is missing.`)
      }
      if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) throw new Error(`Campaign row ${i+2}: invalid ${label}.`)
      const value = Number(raw.replace(/,/g,''))
      if (!Number.isFinite(value)) throw new Error(`Campaign row ${i+2}: invalid ${label}.`)
      return value
    }
    const rowStart = get('reporting starts'), rowEnd = get('reporting ends')
    const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date
    if (!validDate(rowStart) || !validDate(rowEnd) || rowStart > rowEnd) throw new Error(`Campaign row ${i+2}: invalid reporting dates.`)
    if (i && (start !== rowStart || end !== rowEnd)) throw new Error('Campaign rows use different reporting ranges. Export a single aggregate period without daily breakdowns.')
    start = rowStart; end = rowEnd
    const name = get('campaign name'), id = get('campaign id') || name
    if (!name) throw new Error(`Campaign row ${i+2}: campaign name is missing.`)
    if (seen.has(id)) throw new Error('Duplicate campaign ID/name. Export one row per campaign without breakdowns; include Campaign ID if names are reused.')
    seen.add(id)
    const indicator = get('result indicator')
    const results = numeric(get('results'),'results',true)
    if (results !== undefined && !indicator) throw new Error(`Campaign row ${i+2}: result indicator is required to interpret results.`)
    return { key:id, name, delivery:get('campaign delivery'), indicator, resultLabel:resultLabel(indicator), results,
      spend:numeric(cells[spendIndex].trim(),'spend')!, impressions:numeric(get('impressions'),'impressions')!,
      reach:numeric(get('reach'),'reach',true), attribution:get('attribution setting'),
      budget:numeric(get('ad set budget'),'ad set budget',true), budgetType:get('ad set budget type') }
  })
  return { rows, currency, start, end, columns }
}
export function summarizeCampaigns(data: CampaignImport, activeOnly: boolean) {
  const rows = data.rows.filter(row => !activeOnly || row.delivery.toLowerCase() === 'active')
  const groups = new Map<string, { indicator: string; label: string; spend: number; results: number; complete: boolean; campaigns: number }>()
  for (const row of rows) {
    const group = groups.get(row.indicator) ?? {indicator:row.indicator,label:row.resultLabel,spend:0,results:0,complete:true,campaigns:0}
    group.spend += row.spend; group.results += row.results ?? 0; group.complete &&= row.results !== undefined; group.campaigns++
    groups.set(row.indicator,group)
  }
  const totalSpend = rows.reduce((sum,row)=>sum+row.spend,0)
  const impressions = rows.reduce((sum,row)=>sum+row.impressions,0)
  return {
    ...data, rows, scope:activeOnly ? 'Active campaigns only' : 'All exported campaigns',
    totalSpend, impressions, cpm:ratio(totalSpend*1000,impressions),
    activeCount:rows.filter(row=>row.delivery.toLowerCase()==='active').length,
    groups:[...groups.values()].map(group=>({...group,costPerResult:group.complete?ratio(group.spend,group.results):undefined})),
    limitations:[
      'Campaign-level summary only: ad/ad-set rankings, protected winners and pause/scale decisions cannot be established from these rows.',
      'Results are grouped by the exact Result indicator. Purchases and messaging conversations are never combined.',
      'Revenue, link clicks, video plays, 3-second views and ThruPlays are absent from this export. ROAS, CTR and hook/hold diagnosis are unavailable.',
      'Reach is unique within each campaign and may overlap across campaigns. Account reach and account frequency are not calculated by adding campaign reach.',
      'Attribution windows are shown as exported. Reported purchases are attributed events, not verified incremental sales.',
      'The selected reporting end date may include a partial current day. There is no daily series or previous period for trend/fatigue comparisons.',
    ],
  }
}
export type CampaignSummary = ReturnType<typeof summarizeCampaigns>
export function campaignMarkdown(summary: CampaignSummary, fileName: string): string {
  const metrics = summary.groups.map(g=>`- ${g.label} (${g.indicator}): ${g.complete?g.results:'Unknown'} results; spend ${g.spend.toFixed(2)} ${summary.currency}; cost per result ${g.costPerResult?.toFixed(2) ?? 'Unknown'}.`).join('\n')
  return `# FLUX campaign export summary\n\nSource: ${fileName}\nPeriod: ${summary.start} to ${summary.end}\nScope: ${summary.scope}\nSpend: ${summary.totalSpend.toFixed(2)} ${summary.currency}\nImpressions: ${summary.impressions}\n\n## Separate result groups\n${metrics}\n\n## Campaigns\n${summary.rows.map(r=>`- ${r.name}: ${r.delivery}; spend ${r.spend} ${summary.currency}; ${r.results ?? 'Unknown'} ${r.resultLabel}; attribution: ${r.attribution || 'Not supplied'}`).join('\n')}\n\n## Coverage limits\n${summary.limitations.map(l=>`- ${l}`).join('\n')}`
}
