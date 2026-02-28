import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

type Payload = {
  text?: string
  voiceName?: string
  locale?: string
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function normalizeTextForTts(input: string): string {
  return input
    .replace(/\*\*/g, '')
    .replace(/[_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTextForTtsCacheKey(input: string): string {
  return String(input || '')
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .trim()
}

function toTtsCacheKey(text: string, voiceName: string, locale: string): string {
  const textHash = createHash('sha256').update(text).digest('hex')
  const keyRaw = `${textHash}::${voiceName}::${locale || 'en-US'}`
  return createHash('sha256').update(keyRaw).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const rawText = String(payload.text || '').trim()
    const text = normalizeTextForTts(rawText).slice(0, 4500)
    const voiceName = String(payload.voiceName || 'Kore').trim()
    const locale = String(payload.locale || 'en-US').trim() || 'en-US'
    if (!text) return NextResponse.json({ found: false }, { status: 200 })

    const cacheKey = toTtsCacheKey(normalizeTextForTtsCacheKey(text), voiceName, locale)
    const adminSupabase = adminClient()
    const { data: rows } = await adminSupabase
      .from('language_coach_tts_cache')
      .select('audio_base64, mime_type')
      .eq('cache_key', cacheKey)
      .limit(1)
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    if (!row?.audio_base64) {
      return NextResponse.json({ found: false }, { status: 200 })
    }
    return NextResponse.json({
      found: true,
      audioBase64: String(row.audio_base64 || ''),
      mimeType: String(row.mime_type || 'audio/wav'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
