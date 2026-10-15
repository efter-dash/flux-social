import { CampaignAuditPanel } from '@/components/ads/CampaignAuditPanel'
import { campaignMarkdown, importCampaignCSV, isCampaignExport, summarizeCampaigns } from '@/lib/campaignAudit'
import { useEffect, useMemo, useRef, useState } from 'react'
import { streamAuditExplanation } from '@/lib/adsAuditModel'
import { Link } from 'react-router-dom'
import { Button, Card, Field, Input, SectionTitle, Select } from '@/components/ui/primitives'
import { MarkdownViewer } from '@/components/ui/MarkdownViewer'
import { Icon } from '@/components/ui/Icon'
import { loadOllamaConfig, testOllamaConnection } from '@/lib/ollama'
import { AUDIT_TEMPLATE, auditAds, importAdsCSV, localAuditEndpoint, ratio, type Conversion } from '@/lib/adsAudit'

function download(name: string, content: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const number = (value: number | undefined, suffix = '') => value === undefined ? '—' : `${value.toLocaleString(undefined, {maximumFractionDigits:2})}${suffix}`
const optional = (value: string) => value.trim() ? Number(value) : undefined

export function AdsAuditPage() {
  const [csv, setCSV] = useState('')
  const [fileName, setFileName] = useState('')
  const [conversion, setConversion] = useState<Conversion>('purchase')
  const [currency, setCurrency] = useState('')
  const [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [targetCPA, setTargetCPA] = useState(''), [targetROAS, setTargetROAS] = useState('')
  const [emq, setEMQ] = useState(''), [holdBaseline, setHoldBaseline] = useState('')
  const [activeConfirmed, setActiveConfirmed] = useState(false), [trackerConfirmed, setTrackerConfirmed] = useState(false)
  const [config] = useState(loadOllamaConfig)
  const [endpoint, setEndpoint] = useState(config.endpoint), [model, setModel] = useState(config.selectedModel)
  const [models, setModels] = useState<string[]>([]), [connection, setConnection] = useState('Not checked')
  const [connecting, setConnecting] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [report, setReport] = useState('')
  const [filter, setFilter] = useState('All')
  const [activeCampaignsOnly, setActiveCampaignsOnly] = useState(false)
  const campaignImport = useMemo(() => {
    try { return {data: csv && isCampaignExport(csv) ? importCampaignCSV(csv) : null, error: ''} }
    catch(e) { return {data:null,error:e instanceof Error?e.message:'Invalid campaign export'} }
  },[csv])
  const campaign = useMemo(()=>campaignImport.data ? summarizeCampaigns(campaignImport.data,activeCampaignsOnly) : null,[campaignImport,activeCampaignsOnly])
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const analysis = useMemo(() => {
    if (!csv || campaignImport.data || campaignImport.error) return { audit: null, imported: null, error: campaignImport.error }
    try {
      const imported = importAdsCSV(csv, conversion)
      for (const [label, value, max] of [['CPA target',targetCPA,Infinity],['ROAS target',targetROAS,Infinity],['EMQ',emq,10],['Hold baseline',holdBaseline,100]] as const) {
        if (value && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max)) throw new Error(`${label} is outside its valid range.`)
      }
      const audit = auditAds(imported.ads, {conversion,currency,start,end,targetCPA:optional(targetCPA),targetROAS:optional(targetROAS),emq:optional(emq),holdBaseline:optional(holdBaseline),activeConfirmed,trackerConfirmed})
      return {audit,imported,error:''}
    } catch (e) { return {audit:null,imported:null,error:e instanceof Error ? e.message : 'Invalid import'} }
  }, [csv,campaignImport,conversion,currency,start,end,targetCPA,targetROAS,emq,holdBaseline,activeConfirmed,trackerConfirmed])
  // Any change to evidence/settings invalidates an earlier narrative.
  useEffect(() => { setReport(''); setError('') }, [analysis, campaign, endpoint, model])
  const audit = analysis.audit
  async function connect() {
    setConnecting(true)
    try {
      const result = await testOllamaConnection(localAuditEndpoint(endpoint))
      setModels(result.models.filter(m=>! /cloud/i.test(m.name)).map(m=>m.name)); setConnection(result.connected ? `${result.models.length} local models available` : result.error || 'Offline')
      const localModels = result.models.filter(m=>! /cloud/i.test(m.name)); if (result.connected && localModels.length && !localModels.some(m=>m.name===model)) setModel(localModels[0].name)
    } catch (e) { setConnection(e instanceof Error ? e.message : 'Connection failed') }
    finally { setConnecting(false) }
  }
  async function generate() {
    if ((!audit && !campaign) || busy || !model.trim()) return
    setError(''); setReport(''); setBusy(true)
    const abort = new AbortController(); controller.current = abort
    const timeout = setTimeout(()=>abort.abort(),180000)
    try {
      const result = await streamAuditExplanation({endpoint, model, signal:abort.signal,
        prompt:JSON.stringify(campaign ? {source:fileName,level:'campaign summary only',...campaign} : {source:fileName,level:'ad',conversion,currency,start,end,targets:{CPA:optional(targetCPA),ROAS:optional(targetROAS)},...audit}),
        onText:setReport})
      if (!result.trim()) throw new Error('The model returned no text. Try another installed model.')
    } catch(e) { setError(abort.signal.aborted ? 'Generation stopped or timed out. Any text below is incomplete.' : e instanceof Error ? e.message : 'Generation failed') }
    finally { clearTimeout(timeout); controller.current=null; setBusy(false) }
  }
  function exportReport() {
    if (campaign) { download('flux-campaign-audit.md',campaignMarkdown(campaign,fileName) + `\n\n## Local AI draft\n${error ? 'Incomplete: '+error : ''}\n${report || 'Not generated.'}`); return }
    if (!audit) return
    download('flux-meta-ads-audit.md', `# FLUX Meta Ads Audit\n\nSource: ${fileName}\nPeriod: ${start} to ${end}\nConversion: ${conversion} | Currency: ${currency}\nModel: ${report ? model : 'No AI narrative'}\n\n## Data coverage\n${audit.warnings.map(w=>`- ${w}`).join('\n')}\n\n## Deterministic findings\n${audit.findings.map(f=>`- ${f.ad.name} [${f.ad.id}] — ${f.decision}: ${f.reason} Spend: ${f.ad.spend} ${currency}; results: ${f.ad.results}; CPA: ${number(f.cpa)}; ROAS: ${conversion==='purchase'?number(f.roas):'N/A'}. ${f.creative}`).join('\n')}\n\n## Local AI draft (human review required)\n${report || 'Not generated.'}`)
  }
  return <div className="space-y-6">
    <SectionTitle title="Ads Audit" blurb="Meta Ads performance, explained on your device. Import an export, inspect the evidence, and build your next creative test." action={<Button icon="download" disabled={(!audit && !campaign) || busy} onClick={exportReport}>Export audit</Button>} />
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/50 bg-primary/5 p-5"><Icon name="target" size={28} className="text-primary"/><div><h2 className="text-headline-sm text-ink">From account data to a clearer next move</h2><p className="text-body-sm text-ink-dim">Local calculations · Local Ollama inference · Recommendations for manual review</p></div></div>
      <fieldset disabled={busy} className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-ink">01 / Import & scope</h3><p className="text-body-xs text-ink-dim">Import an ad-level export or a campaign-level export. Campaign result types are detected and kept separate.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>download('meta-ads-template.csv',AUDIT_TEMPLATE,'text/csv')}>Download example CSV</Button><Button size="sm" onClick={()=>{setCSV(AUDIT_TEMPLATE);setFileName('DEMO — fictional purchase data');setCurrency('USD');const today=new Date();const endDate=new Date(today);endDate.setDate(today.getDate()-1);const startDate=new Date(endDate);startDate.setDate(endDate.getDate()-29);const date=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;setStart(date(startDate));setEnd(date(endDate));setConversion('purchase');setActiveConfirmed(false);setTrackerConfirmed(false);setEMQ('');setTargetCPA('');setTargetROAS('');setHoldBaseline('')}}>Explore demo</Button></div></div>
        <Button icon="plus" onClick={()=>input.current?.click()}>Import Meta Ads CSV</Button>
        <input hidden aria-hidden="true" tabIndex={-1} ref={input} type="file" accept=".csv,text/csv" aria-label="Import Meta Ads CSV" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('CSV must be smaller than 5 MB.');setCSV(await file.text());setFileName(file.name);setTrackerConfirmed(false);setActiveConfirmed(false);setEMQ('');setHoldBaseline('');setError('')}catch(e){setError(e instanceof Error?e.message:'Could not read file')}finally{e.target.value=''}}}/>
        {fileName && <div className="flex items-center justify-between gap-2 text-body-sm text-primary"><span>{fileName}</span><Button size="sm" onClick={()=>{setCSV('');setFileName('')}}>Clear data</Button></div>}
        {campaign && <p role="status" className="rounded-lg bg-primary/10 p-3 text-body-sm text-primary">Detected campaign-level export · {campaign.rows.length} campaigns · {campaign.currency} · {campaign.start} to {campaign.end}. Campaign summary mode is active.</p>}
        <div hidden={Boolean(campaign)}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Conversion event"><Select value={conversion} onChange={e=>setConversion(e.target.value as Conversion)}><option value="purchase">Purchase / ROAS</option><option value="lead">Lead / CPL</option><option value="custom">Custom / cost per result</option></Select></Field>
          <Field label="Account currency"><Input placeholder="e.g. BDT" maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></Field>
          <Field label="Reporting start"><Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></Field>
          <Field label="Reporting end"><Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></Field>
          <Field label="CPA / CPL target (optional)"><Input type="number" min="0" step="any" value={targetCPA} onChange={e=>setTargetCPA(e.target.value)}/></Field>
          {conversion==='purchase' && <Field label="ROAS target (optional)"><Input type="number" min="0" step="any" value={targetROAS} onChange={e=>setTargetROAS(e.target.value)}/></Field>}
          <Field label="Manual event EMQ (0–10)"><Input type="number" min="0" max="10" step=".1" value={emq} onChange={e=>setEMQ(e.target.value)} placeholder="From Events Manager"/></Field>
          <Field label="90-day hold rate (%)"><Input type="number" min="0" max="100" step=".1" value={holdBaseline} onChange={e=>setHoldBaseline(e.target.value)} placeholder="Separate 90-day aggregate"/></Field>
        </div>
        <label className="flex items-start gap-2 text-body-sm text-ink-dim"><input type="checkbox" className="mt-1" checked={activeConfirmed} onChange={e=>setActiveConfirmed(e.target.checked)}/>If status is absent, I confirm this export contains only active ads.</label>
        <label className="flex items-start gap-2 text-body-sm text-ink-dim"><input type="checkbox" className="mt-1" checked={trackerConfirmed} onChange={e=>setTrackerConfirmed(e.target.checked)}/>I verified the conversion event for every ad set, the export dates, and third-party tracker mapping. Registration events may represent purchases; selected result columns reflect the confirmed event.</label></div>
      </fieldset>
    </Card>
    {(error || analysis.error) && <p role="alert" className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-body-sm text-amber">{error || analysis.error}</p>}
    {campaign && <CampaignAuditPanel summary={campaign} activeOnly={activeCampaignsOnly} onScope={setActiveCampaignsOnly} disabled={busy}/>}
    {audit && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Spend',`${number(audit.total.spend)} ${currency}`,`${audit.findings.length} active ads · ${audit.excluded} excluded`],
        [conversion==='purchase'?'Purchases':conversion==='lead'?'Leads':'Results',number(audit.total.results),`Cost per result ${number(ratio(audit.total.spend,audit.total.results))} ${currency}`],
        [conversion==='purchase'?'Purchase ROAS':'Link CTR',conversion==='purchase'?(audit.revenueComplete?number(ratio(audit.total.revenue,audit.total.spend),'×'):'—'):number(ratio(audit.total.clicks*100,audit.total.impressions),'%'),conversion==='purchase'?(audit.revenueComplete?'Revenue / spend':'Revenue missing for one or more ads'):'Link clicks / impressions'],
        ['Spend concentration',number(ratio(audit.paretoSpend*100,audit.total.spend),'%'),`${audit.findings.filter(f=>f.pareto).length} ads in the 90% focus set`],
      ].map(([label,value,hint])=><Card key={label} className="p-5"><p className="font-mono text-label-micro uppercase text-ink-dim">{label}</p><p className="my-2 text-headline-lg text-ink">{value}</p><p className="text-body-xs text-ink-faint">{hint}</p></Card>)}</div>
      <Card className="space-y-3 p-5"><h2 className="font-semibold text-ink">Evidence & coverage</h2><p className="text-body-sm text-ink-dim">{analysis.imported?.columns.length} columns · {audit.days} days · CSV purchases are used directly, without deduplication. Import stays in this page’s memory and is cleared when you leave.</p>{audit.warnings.map(w=><p key={w} className="border-l-2 border-amber/60 pl-3 text-body-sm text-ink-dim">{w}</p>)}<p className="text-body-xs text-ink-faint">Optional columns absent: {analysis.imported?.missing.join(', ') || 'none'}. Blank optional values remain unknown.</p></Card>
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold text-ink">Performance & creative signals</h2><p className="text-body-xs text-ink-dim">Keep protects winners. Watch needs evidence. Review flags a candidate for further diagnostics.</p></div><Select aria-label="Filter audit findings" value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Focus set','Keep','Watch','Review'].map(x=><option key={x}>{x}</option>)}</Select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-body-sm"><thead className="bg-sunken text-ink-dim"><tr>{['Ad / ad set','Spend','Results','CPA / CPL',conversion==='purchase'?'ROAS':'CTR','Decision & evidence','Video signals'].map(h=><th scope="col" key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/40">{audit.findings.filter(f=>filter==='All'||(filter==='Focus set'?f.pareto:f.decision===filter)).map(f=><tr key={f.ad.id}><td className="max-w-[210px] p-3"><p className="font-semibold text-ink">{f.ad.name}</p><p className="text-body-xs text-ink-faint">{f.ad.adSet} · {f.ad.id}</p>{f.pareto && <span className="text-body-xs text-primary">90% focus</span>}</td><td className="p-3">{number(f.ad.spend)}</td><td className="p-3">{number(f.ad.results)}</td><td className="p-3">{number(f.cpa)}</td><td className="p-3">{conversion==='purchase'?number(f.roas,'×'):number(ratio(f.ad.clicks*100,f.ad.impressions),'%')}</td><td className="max-w-[300px] p-3"><span className={f.decision==='Keep'?'text-emerald':f.decision==='Review'?'text-amber':'text-ink-dim'}>{f.decision}</span><p className="mt-1 text-body-xs text-ink-dim">{f.reason}</p></td><td className="max-w-[250px] p-3 text-body-xs text-ink-dim">{f.creative}</td></tr>)}</tbody></table></div>
      </Card>
    </>}
    <Card className="space-y-4 p-5"><div><h2 className="font-semibold text-ink">02 / Explain with a local model</h2><p className="mt-1 text-body-sm text-ink-dim">Uses your installed Ollama models. Only localhost endpoints are accepted. No cloud fallback. <Link to="/reports" className="text-primary underline">Existing AI Reports settings</Link></p></div>
      <fieldset disabled={busy || connecting} className="grid items-end gap-3 sm:grid-cols-3"><Field label="Local Ollama endpoint"><Input value={endpoint} onChange={e=>{setEndpoint(e.target.value);setModels([]);setConnection('Not checked')}}/></Field><Field label="Model"><Input list="audit-local-models" value={model} onChange={e=>setModel(e.target.value)}/><datalist id="audit-local-models">{models.map(m=><option key={m} value={m}/>)}</datalist></Field><Button loading={connecting} onClick={()=>void connect()}>Check connection</Button></fieldset><p role="status" className="text-body-xs text-ink-dim">{connection}</p>
      <div className="flex flex-wrap gap-2"><Button variant="primary" icon="sparkle" disabled={(!audit && !campaign) || busy || !model.trim()} onClick={()=>void generate()}>Generate local explanation</Button>{busy && <Button onClick={()=>controller.current?.abort()}>Stop generation</Button>}</div>
      <p className="text-body-xs text-ink-faint">Run Ollama with OLLAMA_NO_CLOUD=1 and this app’s origin allowed in OLLAMA_ORIGINS. Model residency is checked before sending audit data. Hosted HTTPS installations may require local-network permission or running FLUX locally. Data goes only to the local endpoint when you press Generate.</p>
      {(report || busy) && <div className="rounded-lg border border-line/50 bg-sunken/40 p-4"><p className="mb-3 text-body-xs text-amber">Local AI draft · {model} · Review against the calculated evidence. {busy?'Generating…':''}</p><MarkdownViewer content={report}/></div>}
    </Card>
    <p className="text-body-xs text-ink-faint">Methodology adapted from <a className="underline" href="https://github.com/gomarble-ai/marketing-agent/tree/main/skills/gomarble-skills-meta-ads-audit" target="_blank" rel="noreferrer">GoMarble’s published Meta Ads audit framework</a>. This is a CSV-based implementation; advanced account structure, bid, targeting and attribution checks need additional data.</p>
  </div>
}
