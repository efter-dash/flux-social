import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamAuditExplanation } from '../src/lib/adsAuditModel.ts'
function mock(chunks: string[], remote = false) {
  const requests: {url: string; body: unknown}[]=[]
  const transport: typeof fetch = async (input, init) => {
    requests.push({url:String(input),body:JSON.parse(String(init?.body))})
    if(String(input).endsWith('/api/show')) return Response.json(remote?{remote_host:'https://ollama.com',model_info:{}}:{model_info:{'general.architecture':'llama'}})
    return new Response(new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));controller.close()}}))
  }
  return {transport,requests}
}
const base=()=>({endpoint:'http://localhost:11434',model:'llama3.2:latest',prompt:'fictional metrics',signal:new AbortController().signal,onText:(_text:string)=>{}})
test('streams split JSON lines, preserves final line without newline and sends grounded system prompt',async()=>{
  const {transport,requests}=mock(['{"response":"Hel','lo"}\n{"response":" world","done":true}'])
  let output='';assert.equal(await streamAuditExplanation({...base(),onText:t=>output=t},transport),'Hello world');assert.equal(output,'Hello world')
  assert.ok(requests[0].url.endsWith('/api/show'));assert.ok(requests[1].url.endsWith('/api/generate'))
  assert.match(JSON.stringify(requests[1].body),/Never override/)
})
test('blocks remote model metadata before metrics are transmitted',async()=>{
  const {transport,requests}=mock([],true)
  await assert.rejects(()=>streamAuditExplanation(base(),transport),/remote/)
  assert.equal(requests.length,1);assert.doesNotMatch(JSON.stringify(requests[0].body),/fictional metrics/)
})
test('blocks cloud tags, oversized context and remote endpoints without requests',async()=>{
  const {transport,requests}=mock([])
  for(const patch of [{model:'large:cloud'},{endpoint:'https://ollama.com'},{prompt:'x'.repeat(60001)}])await assert.rejects(()=>streamAuditExplanation({...base(),...patch},transport))
  assert.equal(requests.length,0)
})
test('reports API errors, malformed data, empty outputs and incomplete streams',async()=>{
  for(const chunks of [['{"error":"out of memory"}\n'],['not json\n'],['{"done":true}\n'],['{"response":"partial"}\n']]) {
    const {transport}=mock(chunks);await assert.rejects(()=>streamAuditExplanation(base(),transport))
  }
})
test('passes cancellation through to both requests',async()=>{
  const controller=new AbortController();controller.abort()
  const transport: typeof fetch = async (_input, init)=>{assert.equal(init?.signal,controller.signal);throw new DOMException('Aborted','AbortError')}
  await assert.rejects(()=>streamAuditExplanation({...base(),signal:controller.signal},transport),{name:'AbortError'})
})
