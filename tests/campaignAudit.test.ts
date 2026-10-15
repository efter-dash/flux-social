import { test } from 'node:test'
import assert from 'node:assert/strict'
import { campaignMarkdown, importCampaignCSV, isCampaignExport, summarizeCampaigns } from '../src/lib/campaignAudit.ts'
const headers='Reporting starts,Reporting ends,Campaign name,Campaign delivery,Attribution setting,Results,Result indicator,Cost per results,Ad set budget,Ad set budget type,Amount spent (BDT),Impressions,Reach'
const fixture=headers+'\n2026-10-01,2026-10-16,Example purchase,active,7-day click,10,actions:offsite_conversion.fb_pixel_purchase,10,500,Daily,100,2000,1500\n2026-10-01,2026-10-16,Example messages,completed,1-day view,20,actions:onsite_conversion.messaging_conversation_started_7d,2.5,1000,Lifetime,50,1000,800\n'
test('detects campaign exports without fabricating ad identities',()=>{
 assert.equal(isCampaignExport(fixture),true)
 assert.equal(isCampaignExport('Ad name,Campaign name\nAd,Campaign'),false)
 const data=importCampaignCSV(fixture)
 assert.equal(data.currency,'BDT');assert.equal(data.start,'2026-10-01');assert.equal(data.end,'2026-10-16');assert.equal(data.rows.length,2)
})
test('reconciles spend and impressions but keeps heterogeneous results separate',()=>{
 const summary=summarizeCampaigns(importCampaignCSV(fixture),false)
 assert.equal(summary.totalSpend,150);assert.equal(summary.impressions,3000);assert.equal(summary.cpm,50)
 assert.equal(summary.groups.length,2);assert.equal(summary.groups[0].results,10);assert.equal(summary.groups[0].costPerResult,10)
 assert.equal(summary.groups[1].results,20);assert.equal(summary.groups[1].costPerResult,2.5)
 assert.equal('reach' in summary,false);assert.equal('totalResults' in summary,false)
})
test('active scope excludes completed/inactive campaigns from every group and total',()=>{
 const summary=summarizeCampaigns(importCampaignCSV(fixture),true)
 assert.equal(summary.rows.length,1);assert.equal(summary.totalSpend,100);assert.equal(summary.groups.length,1);assert.equal(summary.activeCount,1)
})
test('missing results remain unknown, zero results remain zero without infinite cost',()=>{
 const missing=summarizeCampaigns(importCampaignCSV(fixture.replace(',10,actions:',',,actions:')),false)
 assert.equal(missing.groups[0].complete,false);assert.equal(missing.groups[0].costPerResult,undefined)
 const zero=summarizeCampaigns(importCampaignCSV(fixture.replace(',10,actions:',',0,actions:')),false)
 assert.equal(zero.groups[0].results,0);assert.equal(zero.groups[0].costPerResult,undefined)
})
test('rejects mixed reporting ranges, invalid dates, duplicate names, missing indicators and negative spend',()=>{
 for(const invalid of [fixture.replace('2026-10-01,2026-10-16,Example messages','2026-10-02,2026-10-16,Example messages'),fixture.replaceAll('2026-10-01','2026-02-30'),fixture.replace('Example messages','Example purchase'),fixture.replace('actions:offsite_conversion.fb_pixel_purchase',''),fixture.replace(',100,2000,',',-100,2000,')]) assert.throws(()=>importCampaignCSV(invalid))
})
test('Markdown export preserves scope, event labels, currency and limitations',()=>{
 const report=campaignMarkdown(summarizeCampaigns(importCampaignCSV(fixture),false),'example.csv')
 assert.match(report,/150.00 BDT/);assert.match(report,/Messaging conversations/);assert.match(report,/No|cannot be established/)
})
