export const LYRIA35_MODEL = 'lyria-3.5' as const

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

type InteractionBlock = {
  type?: string
  text?: string
  data?: string
  mime_type?: string
  mimeType?: string
}

type InteractionJson = {
  status?: string
  error?: { message?: string }
  steps?: Array<{ type?: string; content?: InteractionBlock[] }>
}

export type Lyria35Audio = {
  audioBase64: string
  mimeType: string
  textParts: string[]
}

export type Lyria35GenerateResult =
  | ({ ok: true } & Lyria35Audio)
  | { ok: false; error: string; detail: string }

function extractAudio(json: InteractionJson): Lyria35Audio | null {
  const textParts: string[] = []
  let audioBase64: string | null = null
  let mimeType = 'audio/mpeg'
  for (const step of json.steps ?? []) {
    if (step.type && step.type !== 'model_output') continue
    for (const block of step.content ?? []) {
      const text = block.text?.trim()
      if ((block.type === 'text' || text) && text) textParts.push(text)
      if (block.type === 'audio' && block.data) {
        audioBase64 = block.data
        mimeType = block.mime_type || block.mimeType || mimeType
      }
    }
  }
  if (!audioBase64) return null
  return { audioBase64, mimeType, textParts }
}

function detailOf(http: number, json: InteractionJson): string {
  const bits = [`http=${http}`]
  if (json.status) bits.push(`status=${json.status}`)
  const steps = (json.steps ?? []).map((step) => step.type || '?').join(',')
  if (steps) bits.push(`steps=${steps}`)
  const message = json.error?.message?.trim()
  if (message) bits.push(message.slice(0, 240))
  return bits.join(' ')
}

function userMessage(detail: string): string {
  if (/block|safety|prohibited|filter/i.test(detail)) {
    return 'Bộ lọc nhạc đã chặn mô tả hoặc lời này nên không có file âm thanh. Hãy sửa lời hoặc mô tả rồi thử lại.'
  }
  return 'Model nhạc không trả file âm thanh. Thử mô tả hoặc lời khác.'
}

/** Lyria 3.5 trả file qua Interactions API. generateContent để trống part và finishReason OTHER. */
export async function generateLyria35Audio(opts: {
  apiKey: string
  prompt: string
  image?: { mimeType: string; base64: string } | null
}): Promise<Lyria35GenerateResult> {
  const input = opts.image?.base64
    ? [
        { type: 'text', text: opts.prompt },
        { type: 'image', mime_type: opts.image.mimeType, data: opts.image.base64 },
      ]
    : opts.prompt

  const res = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': opts.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: LYRIA35_MODEL, input }),
  })
  const raw = await res.text()
  let json: InteractionJson = {}
  try {
    json = JSON.parse(raw) as InteractionJson
  } catch {
    json = { error: { message: raw.slice(0, 180) } }
  }
  const audio = res.ok ? extractAudio(json) : null
  if (audio) return { ok: true, ...audio }
  const detail = detailOf(res.status, json)
  return { ok: false, error: userMessage(detail), detail }
}
