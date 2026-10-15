import { AUDIT_SYSTEM, localAuditEndpoint } from './adsAudit.ts'

/** Verify model residency before transmitting any audit data. No redirects/cloud fallback. */
export async function streamAuditExplanation(options: {
  endpoint: string; model: string; prompt: string; signal: AbortSignal
  onText: (text: string) => void
}, transport: typeof fetch = fetch): Promise<string> {
  const origin = localAuditEndpoint(options.endpoint)
  if (!options.model.trim() || /cloud/i.test(options.model)) throw new Error('Select an installed local model, not a cloud model.')
  if (options.prompt.length > 60000) throw new Error('This audit exceeds the local explanation context limit. Export fewer ads for AI explanation; calculated findings remain available for every imported ad.')
  const show = await transport(`${origin}/api/show`, {method:'POST',redirect:'error',signal:options.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:options.model})})
  if (!show.ok) throw new Error(`Cannot verify local model (${show.status}). Install it in Ollama first.`)
  const info = await show.json()
  if (info.remote_host || info.remote_model || !info.model_info || !Object.keys(info.model_info).length) throw new Error('This model is remote or local model residency could not be verified. Use an installed model and disable Ollama Cloud.')
  const response = await transport(`${origin}/api/generate`, {method:'POST',redirect:'error',signal:options.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:options.model,prompt:options.prompt,system:AUDIT_SYSTEM,stream:true,options:{temperature:.1,num_ctx:16384,num_predict:2048}})})
  if (!response.ok) throw new Error(`Local model request failed (${response.status}). Check Ollama and the selected model.`)
  if (!response.body) throw new Error('Ollama returned no response stream.')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer='', text='', complete=false
  const parse = (line: string) => {
    if (!line.trim()) return
    let item: {response?: string; done?: boolean; error?: string; remote_host?: string; remote_model?: string}
    try { item=JSON.parse(line) } catch { throw new Error('Ollama returned malformed streaming data.') }
    if (item.error) throw new Error(`Ollama: ${item.error}`)
    if (item.remote_host || item.remote_model) throw new Error('Ollama reported remote inference. Stop and disable Ollama Cloud.')
    if (typeof item.response === 'string') {text+=item.response;options.onText(text)}
    complete ||= item.done === true
  }
  try {
    while (!complete) {
      const chunk=await reader.read()
      if (chunk.done) {buffer+=decoder.decode();if(buffer.trim())parse(buffer);break}
      buffer+=decoder.decode(chunk.value,{stream:true})
      const lines=buffer.split('\n');buffer=lines.pop() ?? ''
      for(const line of lines) {parse(line);if(complete)break}
    }
    if (!complete) throw new Error('Ollama stream ended before completion. The draft is incomplete.')
    if (!text.trim()) throw new Error('The model returned no explanation. Try another installed model.')
    return text
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock() }
}
