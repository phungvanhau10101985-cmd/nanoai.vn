import { AiApiStopped, aiHost, aiIsPaused, aiStatusStops, markAiOk, notifyAiDown } from '@/lib/ai/ai-run-alert'

let installed = false

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const fromInit = init?.method?.trim()
  if (fromInit) return fromInit.toUpperCase()
  if (typeof input !== 'string' && !(input instanceof URL) && input.method) return input.method.toUpperCase()
  return 'GET'
}

function isCallerTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /aborted|timeout/i.test(error.message)
}

/** Mọi fetch tới Gemini, OpenAI, DeepSeek: lỗi thì dừng và email admin. */
export function installAiFetchGuard(): void {
  if (installed || typeof globalThis.fetch !== 'function') return
  installed = true
  const original = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input)
    const host = aiHost(url)
    if (!host) return original(input, init)
    const writing = !['GET', 'HEAD'].includes(requestMethod(input, init))
    if (writing && aiIsPaused(host)) {
      throw new AiApiStopped(`AI_API_STOPPED ${host}: đang dừng vì lần gọi trước không chạy`)
    }
    let response: Response
    try {
      response = await original(input, init)
    } catch (error) {
      if (error instanceof AiApiStopped || isCallerTimeout(error)) throw error
      const detail = error instanceof Error ? error.message : String(error)
      await notifyAiDown(host, detail)
      throw new AiApiStopped(`AI_API_STOPPED ${host}: ${detail}`)
    }
    if (aiStatusStops(response.status)) {
      const body = await response.clone().text().catch(() => '')
      const detail = `HTTP ${response.status} ${body.slice(0, 300)}`
      await notifyAiDown(host, detail)
      throw new AiApiStopped(`AI_API_STOPPED ${host}: ${detail}`)
    }
    if (writing && response.ok) markAiOk(host)
    return response
  }
}
