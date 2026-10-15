import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditAds, importAdsCSV, parseCSV, localAuditEndpoint, AUDIT_TEMPLATE, type AuditOptions } from '../src/lib/adsAudit.ts'
const today = new Date().toISOString().slice(0,10)
const start = new Date(Date.now()-29*86400000).toISOString().slice(0,10)
const options: AuditOptions = {conversion:'purchase',currency:'BDT',start,end:today,activeConfirmed:false,trackerConfirmed:true,emq:9,targetCPA:50}
const demo = () => importAdsCSV(AUDIT_TEMPLATE,'purchase').ads

test('quoted CSV, BOM, commas, escaped quotes and multiline fields',()=>{
  assert.deepEqual(parseCSV('\uFEFFA,B\r\n"a,b","a""b\nc"\r\n'),[['\uFEFFA','B'],['a,b','a"b\nc']])
  assert.throws(()=>parseCSV('A\n"unclosed'),/unclosed/)
})
test('rejects duplicate ad IDs, absent results, malformed numbers and row widths',()=>{
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE+AUDIT_TEMPLATE.split('\n')[1]+'\n','purchase'),/Duplicate/)
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE.replace('250,18,','250,,'),'purchase'),/blank/)
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE.replace(',450,',',-450,'),'purchase'),/invalid/)
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE.replace(',450,',',1e999,'),'purchase'),/invalid/)
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE.replace(',450,',',450,extra,'),'purchase'),/column count/)
})
test('does not infer leads or custom results from purchase columns',()=>{
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE,'lead'),/lead/)
  assert.throws(()=>importAdsCSV(AUDIT_TEMPLATE,'custom'),/custom/)
})
test('protects highest converter and all ties even with high CPA',()=>{
  const ads=demo();ads[0].spend=10000;ads[1].results=18
  const report=auditAds(ads,options)
  assert.equal(report.findings.find(f=>f.ad.id==='1001')!.decision,'Keep')
  assert.equal(report.findings.find(f=>f.ad.id==='1002')!.decision,'Keep')
})
test('protects young ads and blocks optimization without tracking checks',()=>{
  const ads=demo();ads[2].spend=500
  assert.equal(auditAds(ads,options).findings.find(f=>f.ad.id==='1003')!.decision,'Watch')
  ads[2].ageDays=15
  assert.equal(auditAds(ads,options).findings.find(f=>f.ad.id==='1003')!.decision,'Review')
  for(const patch of [{emq:8},{emq:undefined},{trackerConfirmed:false},{end:'2020-01-30',start:'2020-01-01'}]) {
    assert.equal(auditAds(ads,{...options,...patch}).findings.find(f=>f.ad.id==='1003')!.decision,'Watch')
  }
})
test('excludes inactive and zero-impression ads and preserves unknown revenue',()=>{
  const ads=demo();ads[1].status='PAUSED';ads[2].impressions=0;ads[0].revenue=undefined
  const report=auditAds(ads,options)
  assert.equal(report.total.spend,450);assert.equal(report.excluded,2);assert.equal(report.revenueComplete,false)
  assert.equal(report.findings[0].roas,undefined)
})
test('90% spend coverage includes dominant and boundary-crossing ads',()=>{
  const report=auditAds(demo(),options)
  assert.ok(report.paretoSpend>=report.total.spend*.9)
  const ads=demo();ads[0].spend=100000
  assert.equal(auditAds(ads,options).findings.filter(f=>f.pareto).length,1)
})
test('calculates source hook and hold definitions; zero denominators remain unknown',()=>{
  const ads=demo(); const report=auditAds(ads,options)
  assert.equal(report.findings[0].hook,45);assert.equal(report.findings[0].hold,30)
  ads[0].videoPlays=0;ads[0].views3s=0
  const zero=auditAds(ads,options).findings[0];assert.equal(zero.hook,undefined);assert.equal(zero.hold,undefined)
})
test('rejects remote inference, credentials and alternate paths',()=>{
  assert.equal(localAuditEndpoint('http://localhost:11434'),'http://localhost:11434')
  assert.equal(localAuditEndpoint('http://[::1]:11434'),'http://[::1]:11434')
  for(const url of ['https://cloud.example','http://localhost.evil.com','http://user:pass@localhost','http://localhost/api','file:///tmp']) assert.throws(()=>localAuditEndpoint(url))
})
test('validates date range and required currency',()=>{
  assert.throws(()=>auditAds(demo(),{...options,start:'bad'}),/range/)
  assert.throws(()=>auditAds(demo(),{...options,currency:''}),/currency/)
})
