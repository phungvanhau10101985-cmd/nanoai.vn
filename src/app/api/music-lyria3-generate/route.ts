import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, createUserContent } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'

export const maxDuration = 300

const LYRIA3_MODELS = {
  clip: 'lyria-3-clip-preview',
  pro: 'lyria-3-pro-preview',
} as const

const CHARGE_CLIP = 3

/** Pro: mục tiêu độ dài (giây) — khớp công bố Lyria 3 Pro tối đa ~3 phút. */
const CHARGE_PRO_BY_TARGET: Record<60 | 150 | 180, number> = {
  60: 5,
  150: 8,
  180: 10,
}

function parseProTargetSeconds(raw: unknown): 60 | 150 | 180 {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (n === 60 || n === 150 || n === 180) return n
  return 150
}

function lyria3Charge(variant: 'clip' | 'pro', proTargetSec: 60 | 150 | 180): number {
  if (variant === 'clip') return CHARGE_CLIP
  return CHARGE_PRO_BY_TARGET[proTargetSec]
}

function storedDurationSeconds(variant: 'clip' | 'pro', proTargetSec: 60 | 150 | 180): number {
  return variant === 'clip' ? 30 : proTargetSec
}

function proDurationPromptBlock(seconds: 60 | 150 | 180): string {
  if (seconds === 60) {
    return '\n\nTarget output length: approximately 60 seconds (one minute) of continuous music. Shape the piece (intro, body, ending) to fit naturally within about one minute.'
  }
  if (seconds === 150) {
    return '\n\nTarget output length: approximately 150 seconds (two and a half minutes) of continuous music. Allow full song structure (verse, chorus, bridge as fits the genre) within about 2:30.'
  }
  return '\n\nTarget output length: up to approximately 180 seconds (three minutes) of continuous music — the maximum rich length for this model. Use the full duration where appropriate for a complete track with natural development and outro.'
}

const INSTRUMENTAL_SUFFIX =
  '\n\nImportant: Instrumental only, no vocals, no singing, no voice. Pure instrumental track.'

const VOCAL_HINT =
  '\n\nInclude lead vocals and sung lyrics appropriate to the genre and mood described above. Match the language of the main prompt and any provided lyrics when possible.'

const VALID_VOICE_GENDER = new Set(['auto', 'female', 'male', 'neutral', 'duet_mf'])
const VALID_VOICE_TIMBRE = new Set(['auto', 'high', 'bright', 'warm', 'soft', 'deep', 'rap'])
const VALID_VOICE_LANG = new Set([
  'auto',
  'vi_north',
  'vi_central',
  'vi_south',
  'en_uk',
  'en_us',
  'zh',
  'ja',
  'ko',
])

const VOICE_GENDER_HINTS: Record<string, string> = {
  auto: '',
  female: 'Lead vocalist: adult female voice.',
  male: 'Lead vocalist: adult male voice.',
  neutral: 'Lead vocalist: soft gender-neutral timbre — airy and natural; avoid caricatured stereotypes.',
  duet_mf:
    'Vocals: male and female voices together — harmony, call-and-response duet, or alternating leads as fits the lyrics.',
}

const VOICE_TIMBRE_HINTS: Record<string, string> = {
  auto: '',
  high: 'Vocal register: higher range — clear, bright, and open (soprano / tenor character as fits the lead).',
  bright: 'Vocal tone: bright, youthful pop energy — forward and present in the mix.',
  warm: 'Vocal tone: warm mid register — mellow, soulful, emotionally rounded.',
  soft: 'Vocal tone: soft and breathy — gentle, intimate close-mic delivery.',
  deep: 'Vocal tone: deeper, resonant register — rich baritone or bass character as fits the lead.',
  rap: 'Vocal delivery: confident rap or rhythmic spoken-sung flow — crisp on-beat articulation.',
}

const VOICE_LANG_HINTS: Record<string, string> = {
  auto: '',
  vi_north:
    'Singing diction (Vietnamese): Northern Vietnamese (Hanoi-area) accent — Northern vowels, clear consonants, natural Northern melodic phrasing.',
  vi_central:
    'Singing diction (Vietnamese): Central Vietnamese regional accent — authentic Central vowels and phrasing.',
  vi_south:
    'Singing diction (Vietnamese): Southern Vietnamese (Ho Chi Minh / Mekong) accent — open Southern vowels and phrasing.',
  en_uk:
    'Singing diction (English): British English (UK) pronunciation — modern British pop vocal style, not General American.',
  en_us:
    'Singing diction (English): American English (General American) — typical US pop vocal diction.',
  zh:
    'Singing diction (Chinese): clear standard Mandarin (Putonghua) pronunciation and natural Mandopop-style melodic phrasing when lyrics are in Chinese.',
  ja:
    'Singing diction (Japanese): natural Japanese pronunciation and intonation appropriate for J-pop or ballad singing when lyrics are in Japanese.',
  ko:
    'Singing diction (Korean): natural Korean pronunciation and contemporary K-pop melodic delivery when lyrics are in Korean.',
}

function parseVoiceAxis(raw: unknown, valid: Set<string>): string {
  const s = String(raw ?? 'auto')
    .toLowerCase()
    .trim()
  return valid.has(s) ? s : 'auto'
}

/** Gợi ý tiếng Anh cho model — vocalMode === vocal. */
function buildVocalDirectionBlock(gender: string, timbre: string, lang: string): string {
  const parts: string[] = []
  const g = VOICE_GENDER_HINTS[gender]
  if (g) parts.push(g)
  const t = VOICE_TIMBRE_HINTS[timbre]
  if (t) parts.push(t)
  const l = VOICE_LANG_HINTS[lang]
  if (l) parts.push(l)
  if (!parts.length) return ''
  return `\n\nVocal direction:\n${parts.join('\n\n')}`
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const VALID_GENRES = new Set([
  'custom',
  'pop',
  'rap',
  'trap',
  'nhac_tre',
  'ballad',
  'tam_trang',
  'rock',
  'edm',
  'house',
  'remix',
  'lofi',
  'chill',
  'indie',
  'jazz',
  'rnb',
  'bolero',
  'folk',
  'cinematic',
  'synthwave',
  'nhac_che_hai',
  'c_pop',
  'j_pop',
  'k_pop',
])

/** Hướng dẫn thể loại gửi model (tiếng Anh, ngắn). */
const GENRE_MODEL_HINTS: Record<string, string> = {
  custom: '',
  pop: 'Primary genre: modern pop — catchy hooks, clear song structure, polished production.',
  rap: 'Primary genre: rap / hip-hop — strong rhythmic delivery, beat-focused, contemporary flow.',
  trap: 'Primary genre: trap — heavy 808 bass, crisp hi-hats, dark or energetic modern trap production.',
  nhac_tre: 'Primary genre: Vietnamese youth pop (nhạc trẻ / V-pop) — bright, melodic, modern V-pop.',
  ballad: 'Primary genre: emotional ballad — piano or strings, dynamic build, expressive melody.',
  tam_trang:
    'Primary genre: mood / “tâm trạng” music — introspective, emotionally expressive; match sorrow, longing, hope, or bittersweet feelings described by the user.',
  rock: 'Primary genre: rock — guitars, live drums, energetic band arrangement.',
  edm: 'Primary genre: EDM / electronic dance — driving beat, synth layers, club energy.',
  house: 'Primary genre: house — four-on-the-floor kick, warm bass, groovy club-friendly house.',
  remix:
    'Primary style: remix / club rework energy — extended build-ups and drops, DJ-friendly structure, emphasis on rhythm and electronic excitement (original composition, not copying existing songs).',
  lofi: 'Primary genre: lo-fi hip hop — relaxed, warm textures, mellow drums.',
  chill: 'Primary genre: chillout / ambient chill — soft pads, gentle groove, spacious mix, stress-relief listening.',
  indie: 'Primary genre: indie pop or indie rock — organic instruments, distinctive character.',
  jazz: 'Primary genre: jazz — swing or modern feel, walking bass or brush drums, harmonic richness, improvisational character.',
  rnb: 'Primary genre: R&B — smooth groove, soulful harmony, polished production.',
  bolero: 'Primary genre: Vietnamese bolero / romantic ballad — nostalgic, melodic, traditional phrasing.',
  folk: 'Primary genre: folk / acoustic — acoustic guitar, natural sound, storytelling mood.',
  cinematic: 'Primary genre: cinematic orchestral — wide dynamics, strings and brass, film-score feel.',
  synthwave: 'Primary genre: synthwave / retro 80s — analog-style synths, gated reverb drums, neon nostalgic atmosphere.',
  nhac_che_hai:
    'Primary style: Vietnamese “nhạc chế” humorous parody song — playful, witty, lighthearted, comedic timing; catchy singalong feel and friendly satire. Compose original melody and original lyrics only (do not reproduce or closely mimic any existing copyrighted song).',
  c_pop:
    'Primary genre: Mandarin Chinese pop (C-pop / Mandopop) — modern Chinese pop melody, polished production, emotionally expressive hooks typical of contemporary Chinese-language pop.',
  j_pop:
    'Primary genre: J-pop — bright melodic Japanese pop, polished arrangement, energetic or sentimental mood typical of contemporary Japanese pop music.',
  k_pop:
    'Primary genre: K-pop — contemporary Korean pop production, tight rhythm section, catchy hooks, dynamic contrasts and modern K-pop energy (original composition).',
}

const VALID_BPM_PRESET = new Set(['auto', 'slow', 'medium', 'fast'])
const BPM_PRESET_HINTS: Record<string, string> = {
  auto: '',
  slow: 'Tempo target: roughly 72–88 BPM — relaxed, laid-back groove.',
  medium: 'Tempo target: roughly 96–112 BPM — moderate pop or walking tempo.',
  fast: 'Tempo target: roughly 122–138 BPM — energetic, driving pulse.',
}

const VALID_STRUCTURE_PRESET = new Set(['auto', 'verse_chorus', 'verse_chorus_bridge', 'short_hook', 'through'])
const STRUCTURE_PRESET_HINTS: Record<string, string> = {
  auto: '',
  verse_chorus: 'Song structure: clear alternating verses and a memorable repeating chorus.',
  verse_chorus_bridge:
    'Song structure: verses and choruses with a contrasting bridge section before the final chorus.',
  short_hook: 'Song structure: brief intro into verse; prioritize a catchy, memorable chorus hook.',
  through: 'Song structure: through-composed flow with smooth transitions; avoid rigid copy-paste sectional repeats.',
}

const VALID_DENSITY_PRESET = new Set(['auto', 'minimal', 'balanced', 'full'])
const DENSITY_PRESET_HINTS: Record<string, string> = {
  auto: '',
  minimal: 'Arrangement: sparse and intimate — few instruments, lots of space in the mix.',
  balanced: 'Arrangement: balanced texture — rhythm, bass, and harmony clearly audible without overcrowding.',
  full: 'Arrangement: rich and layered — full ensemble or dense synth stacks, wide energetic production.',
}

function parseLyriaProductionPreset(raw: unknown, valid: Set<string>): string {
  const s = String(raw ?? 'auto')
    .toLowerCase()
    .trim()
  return valid.has(s) ? s : 'auto'
}

type ContentPart = { text?: string; inlineData?: { mimeType?: string; data?: string } }

function extractFromResponse(response: {
  candidates?: Array<{ content?: { parts?: ContentPart[] } }>
}): { audioBase64: string; mimeType: string; textParts: string[] } | null {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const textParts: string[] = []
  let audioBase64: string | null = null
  let mimeType = 'audio/mpeg'

  for (const part of parts) {
    if (part.text?.trim()) textParts.push(part.text.trim())
    if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
      audioBase64 = part.inlineData.data
      mimeType = part.inlineData.mimeType
    }
  }

  if (!audioBase64) return null
  return { audioBase64, mimeType, textParts }
}

function buildCorePrompt(params: {
  genre: string
  promptRaw: string
  songContent: string
  hasImage: boolean
  vocalMode: 'instrumental' | 'vocal'
  bpmPreset: string
  structurePreset: string
  densityPreset: string
}): string {
  const blocks: string[] = []

  const genreHint = GENRE_MODEL_HINTS[params.genre] || ''
  if (genreHint) blocks.push(genreHint)

  const prodParts: string[] = []
  const bpmH = BPM_PRESET_HINTS[params.bpmPreset]
  if (bpmH) prodParts.push(bpmH)
  const structH = STRUCTURE_PRESET_HINTS[params.structurePreset]
  if (structH) prodParts.push(structH)
  const densH = DENSITY_PRESET_HINTS[params.densityPreset]
  if (densH) prodParts.push(densH)
  if (prodParts.length) blocks.push(`Production guidance:\n${prodParts.join('\n')}`)

  const desc = params.promptRaw.trim()
  if (params.hasImage) {
    blocks.push(
      desc
        ? 'Use the attached image as key inspiration together with the user directions below (mood, palette, scene → music).'
        : 'Compose music inspired by the attached image: match its mood, colors, atmosphere, and visual energy.'
    )
  }

  if (desc) {
    blocks.push(`Creative direction from the user:\n${desc}`)
  }

  const lyrics = params.songContent.trim()
  if (lyrics) {
    if (params.vocalMode === 'vocal') {
      blocks.push(
        `The user provided lyrics or song text — set them to music in the chosen genre (you may repeat sections for structure):\n${lyrics}`
      )
    } else {
      blocks.push(
        `Thematic reference only (no singing): let this text inspire mood, harmony, and rhythm of the instrumental:\n${lyrics}`
      )
    }
  }

  return blocks.join('\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const ct = request.headers.get('content-type') || ''

    let promptRaw = ''
    let variant: 'clip' | 'pro' = 'clip'
    let vocalMode: 'instrumental' | 'vocal' = 'instrumental'
    let genre = 'custom'
    let songContent = ''
    let imageBuffer: Buffer | null = null
    let imageMime = 'image/jpeg'
    let voiceGender = 'auto'
    let voiceTimbre = 'auto'
    let voiceLanguage = 'auto'
    let proTargetSec: 60 | 150 | 180 = 150
    let bpmPreset = 'auto'
    let structurePreset = 'auto'
    let densityPreset = 'auto'

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      promptRaw = String(form.get('prompt') || '').trim()
      variant = form.get('variant') === 'pro' ? 'pro' : 'clip'
      proTargetSec = parseProTargetSeconds(form.get('targetDurationSec'))
      vocalMode = form.get('vocalMode') === 'vocal' ? 'vocal' : 'instrumental'
      const g = String(form.get('genre') || 'custom').toLowerCase()
      genre = VALID_GENRES.has(g) ? g : 'custom'
      songContent = String(form.get('songContent') || '').trim()
      voiceGender = parseVoiceAxis(form.get('voiceGender'), VALID_VOICE_GENDER)
      voiceTimbre = parseVoiceAxis(form.get('voiceTimbre'), VALID_VOICE_TIMBRE)
      voiceLanguage = parseVoiceAxis(form.get('voiceLanguage'), VALID_VOICE_LANG)
      bpmPreset = parseLyriaProductionPreset(form.get('bpmPreset'), VALID_BPM_PRESET)
      structurePreset = parseLyriaProductionPreset(form.get('structurePreset'), VALID_STRUCTURE_PRESET)
      densityPreset = parseLyriaProductionPreset(form.get('densityPreset'), VALID_DENSITY_PRESET)
      const img = form.get('image')
      if (img instanceof File && img.size > 0) {
        if (img.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Ảnh quá lớn (tối đa 8MB).' }, { status: 400 })
        }
        imageMime = img.type || 'image/jpeg'
        if (!ALLOWED_IMAGE_TYPES.has(imageMime)) {
          return NextResponse.json({ error: 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.' }, { status: 400 })
        }
        imageBuffer = Buffer.from(await img.arrayBuffer())
      }
    } else {
      const body = (await request.json()) as {
        prompt?: string
        variant?: string
        vocalMode?: string
        genre?: string
        songContent?: string
        voiceGender?: string
        voiceTimbre?: string
        voiceLanguage?: string
        targetDurationSec?: number
        bpmPreset?: string
        structurePreset?: string
        densityPreset?: string
        imageBase64?: string
        imageMimeType?: string
      }
      promptRaw = String(body?.prompt || '').trim()
      variant = body?.variant === 'pro' ? 'pro' : 'clip'
      proTargetSec = parseProTargetSeconds(body?.targetDurationSec)
      vocalMode = body?.vocalMode === 'vocal' ? 'vocal' : 'instrumental'
      const g = String(body?.genre || 'custom').toLowerCase()
      genre = VALID_GENRES.has(g) ? g : 'custom'
      songContent = String(body?.songContent || '').trim()
      voiceGender = parseVoiceAxis(body?.voiceGender, VALID_VOICE_GENDER)
      voiceTimbre = parseVoiceAxis(body?.voiceTimbre, VALID_VOICE_TIMBRE)
      voiceLanguage = parseVoiceAxis(body?.voiceLanguage, VALID_VOICE_LANG)
      bpmPreset = parseLyriaProductionPreset(body?.bpmPreset, VALID_BPM_PRESET)
      structurePreset = parseLyriaProductionPreset(body?.structurePreset, VALID_STRUCTURE_PRESET)
      densityPreset = parseLyriaProductionPreset(body?.densityPreset, VALID_DENSITY_PRESET)
      const b64 = body?.imageBase64?.trim()
      const mime = body?.imageMimeType?.trim()
      if (b64 && mime && ALLOWED_IMAGE_TYPES.has(mime)) {
        imageBuffer = Buffer.from(b64, 'base64')
        imageMime = mime
        if (imageBuffer.length > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Ảnh quá lớn (tối đa 8MB).' }, { status: 400 })
        }
      }
    }

    const songOk = songContent.trim().length >= 10
    if (promptRaw.length < 4 && !imageBuffer && !songOk) {
      return NextResponse.json(
        {
          error:
            'Cần ít nhất một trong: mô tả từ 4 ký tự, hoặc ảnh, hoặc nội dung/lời bài hát từ 10 ký tự.',
        },
        { status: 400 }
      )
    }
    if (promptRaw.length > 6000) {
      return NextResponse.json({ error: 'Mô tả quá dài.' }, { status: 400 })
    }
    if (songContent.length > 4000) {
      return NextResponse.json({ error: 'Nội dung bài hát quá dài.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo nhạc.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const cost = lyria3Charge(variant, proTargetSec)
    const charged = await deductUserCredits(user.id, cost)
    if (!charged.ok) {
      const status = charged.code === 'INSUFFICIENT_CREDITS' ? 402 : 500
      return NextResponse.json({ error: charged.error, code: charged.code }, { status })
    }

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const hasImage = Boolean(imageBuffer?.length)
    const corePrompt = buildCorePrompt({
      genre,
      promptRaw,
      songContent,
      hasImage,
      vocalMode,
      bpmPreset,
      structurePreset,
      densityPreset,
    })

    const voiceHintBlock = vocalMode === 'vocal' ? buildVocalDirectionBlock(voiceGender, voiceTimbre, voiceLanguage) : ''

    const durationBlock = variant === 'pro' ? proDurationPromptBlock(proTargetSec) : ''

    const fullPrompt =
      vocalMode === 'instrumental'
        ? `${corePrompt}${durationBlock}${INSTRUMENTAL_SUFFIX}`
        : `${corePrompt}${durationBlock}${voiceHintBlock}${VOCAL_HINT}`

    const modelId = LYRIA3_MODELS[variant]

    let audioBase64: string
    let mimeType: string
    let textParts: string[]

    try {
      const ai = new GoogleGenAI({ apiKey })

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: fullPrompt }]
      if (imageBuffer?.length) {
        parts.push({
          inlineData: {
            mimeType: imageMime,
            data: imageBuffer.toString('base64'),
          },
        })
      }

      const contents = createUserContent(parts)

      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
          responseModalities: ['AUDIO', 'TEXT'],
        },
      })

      const extracted = extractFromResponse(response as { candidates?: Array<{ content?: { parts?: ContentPart[] } }> })
      if (!extracted) {
        await refundUserCredits(user.id, cost)
        return NextResponse.json(
          { error: 'API không trả về file âm thanh. Thử mô tả khác hoặc kiểm tra quyền model Lyria 3.' },
          { status: 502 }
        )
      }
      audioBase64 = extracted.audioBase64
      mimeType = extracted.mimeType
      textParts = extracted.textParts
    } catch (e) {
      await refundUserCredits(user.id, cost)
      const msg = e instanceof Error ? e.message : 'Lỗi gọi Lyria 3.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const buffer = Buffer.from(audioBase64, 'base64')
    const ext = mimeType.includes('wav') ? 'wav' : 'mp3'
    const timestamp = Date.now()
    const imgTag = hasImage ? 'img' : 'txt'
    const durTag = variant === 'clip' ? '30' : String(proTargetSec)
    const uploadPath = `music-history/${user.id}/lyria3_${variant}_${durTag}s_${vocalMode}_${imgTag}_${timestamp}.${ext}`

    const { error: uploadError } = await adminSupabase.storage
      .from('try-on-images')
      .upload(uploadPath, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      await refundUserCredits(user.id, cost)
      return NextResponse.json({ error: uploadError.message || 'Không upload được audio.' }, { status: 500 })
    }

    const { data: publicData } = adminSupabase.storage.from('try-on-images').getPublicUrl(uploadPath)
    const audioUrl = publicData.publicUrl

    const baseTitle =
      variant === 'clip'
        ? 'Lyria 3 — đoạn 30s'
        : proTargetSec === 60
          ? 'Lyria 3 — Pro ~1 phút'
          : proTargetSec === 150
            ? 'Lyria 3 — Pro ~2m30'
            : 'Lyria 3 — Pro ~3 phút (tối đa)'
    let titleVi = vocalMode === 'vocal' ? `${baseTitle} (có lời)` : `${baseTitle} (không lời)`
    if (hasImage) titleVi += ' + ảnh'
    const styleSnippet = [genre, promptRaw.slice(0, 80)].filter(Boolean).join(' · ')

    const { error: insertError } = await adminSupabase.from('music_generations').insert({
      user_id: user.id,
      mode: 'lyria3',
      title: titleVi,
      style: styleSnippet.slice(0, 120),
      duration_seconds: storedDurationSeconds(variant, proTargetSec),
      charged_credits: cost,
      audio_url: audioUrl,
    })

    const historySaved = !insertError
    if (insertError) {
      console.error('music_generations insert failed', insertError)
    }

    return NextResponse.json({
      ok: true,
      audioUrl,
      mimeType,
      lyricsOrNotes: textParts.length ? textParts.join('\n\n') : undefined,
      charged: cost,
      variant,
      targetDurationSec: variant === 'pro' ? proTargetSec : 30,
      vocalMode,
      historySaved,
      historyError: insertError?.message,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
