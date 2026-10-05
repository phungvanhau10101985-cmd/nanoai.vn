import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, createUserContent } from '@google/genai'
import { getUserForCreditAction } from '@/lib/auth'
import { insertMusicGenerationPg } from '@/lib/db/music-generations-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { trackApiUsage } from '@/lib/track-ai-usage'
import { LYRIA35_MODEL, generateLyria35Audio } from '@/lib/music/lyria35-generate'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export const maxDuration = 300
const LYRICS_TEXT_MODEL = 'gemini-2.5-flash' as const
const LYRIA3_TARGET_SEC = 180 as const
const LYRIA3_CHARGE = 3

const LYRIA3_DURATION_PROMPT =
  '\n\nSong length: about three minutes, with a verse, a chorus, and an outro.'

const INSTRUMENTAL_SUFFIX =
  '\n\nImportant: Instrumental only, no vocals, no singing, no voice. Pure instrumental track.'

const VOCAL_HINT =
  '\n\nSing the lyrics below as lead vocals. The words are final — do not rewrite them and do not reply with lyrics text only. The response must include the audio recording of the finished song.'

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

type ContentPart = { text?: string }

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

const LYRICS_LANG_HINTS: Record<string, string> = {
  auto: 'Write in the same language as the user brief. If the brief is Vietnamese or empty, write Vietnamese.',
  vi_north: 'Write the lyrics in Vietnamese with Northern (Hanoi) diction.',
  vi_central: 'Write the lyrics in Vietnamese with Central regional diction.',
  vi_south: 'Write the lyrics in Vietnamese with Southern diction.',
  en_uk: 'Write the lyrics in British English.',
  en_us: 'Write the lyrics in American English.',
  zh: 'Write the lyrics in standard Mandarin Chinese.',
  ja: 'Write the lyrics in natural Japanese.',
  ko: 'Write the lyrics in natural Korean.',
}

function textFromGenerateResponse(response: {
  text?: string
  candidates?: Array<{ content?: { parts?: ContentPart[] } }>
}): string {
  const direct = typeof response.text === 'string' ? response.text.trim() : ''
  if (direct) return direct
  const parts = response.candidates?.[0]?.content?.parts ?? []
  return parts
    .map((part) => part.text?.trim() || '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

function stripLyricFences(text: string): string {
  return text
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/** Viết lời từ ý tưởng + cài đặt. Không đọc ảnh. */
async function writeLyricsFromBrief(
  ai: GoogleGenAI,
  params: {
    userId: string
    genre: string
    songIdea: string
    voiceGender: string
    voiceTimbre: string
    voiceLanguage: string
    bpmPreset: string
    structurePreset: string
    densityPreset: string
  }
): Promise<string> {
  const genreHint = GENRE_MODEL_HINTS[params.genre] || 'Follow the mood and genre in the song idea.'
  const langHint = LYRICS_LANG_HINTS[params.voiceLanguage] || LYRICS_LANG_HINTS.auto
  const structureHint =
    STRUCTURE_PRESET_HINTS[params.structurePreset] || 'Song structure: verse, chorus, verse, chorus, short outro.'
  const bpmHint = BPM_PRESET_HINTS[params.bpmPreset] || ''
  const densityHint = DENSITY_PRESET_HINTS[params.densityPreset] || ''
  const vocalHint = buildVocalDirectionBlock(params.voiceGender, params.voiceTimbre, params.voiceLanguage)
  const idea = params.songIdea.trim()
  const instruction = [
    'You are a songwriter. Write original singable lyrics for one song of about three minutes.',
    'Use only the song idea and the settings below. Ignore any image. Do not invent a scene from a picture.',
    genreHint,
    langHint,
    structureHint,
    bpmHint,
    densityHint,
    vocalHint.trim(),
    idea
      ? `Song idea (theme, mood, story — not final lyrics):\n${idea}`
      : 'No extra idea. Write from the genre, language, structure, and vocal settings above.',
    'Output ONLY the lyrics. Use section labels [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro].',
    'Include a chorus that can be repeated. Keep lines short enough to sing.',
    'No song title, no chords, no commentary, no markdown fences.',
    'Original words only. Do not copy or closely paraphrase an existing copyrighted song.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await ai.models.generateContent({
    model: LYRICS_TEXT_MODEL,
    contents: createUserContent([{ text: instruction }]),
  })
  const usage = (
    response as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }
  ).usageMetadata
  void trackApiUsage({
    userId: params.userId,
    model: LYRICS_TEXT_MODEL,
    feature: 'music-lyria3-lyrics',
    promptTokenCount: usage?.promptTokenCount ?? 0,
    candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
    totalTokenCount: usage?.totalTokenCount ?? 1,
  })

  const lyrics = stripLyricFences(textFromGenerateResponse(response)).slice(0, 3800)
  if (lyrics.length < 20) {
    throw new Error('Không viết được lời bài hát từ ý tưởng.')
  }
  return lyrics
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const ct = request.headers.get('content-type') || ''

    let step: 'music' | 'lyrics' = 'music'
    let promptRaw = ''
    let vocalMode: 'instrumental' | 'vocal' = 'instrumental'
    let genre = 'custom'
    let songContent = ''
    let imageBuffer: Buffer | null = null
    let imageMime = 'image/jpeg'
    let voiceGender = 'auto'
    let voiceTimbre = 'auto'
    let voiceLanguage = 'auto'
    let bpmPreset = 'auto'
    let structurePreset = 'auto'
    let densityPreset = 'auto'

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      step = form.get('step') === 'lyrics' ? 'lyrics' : 'music'
      promptRaw = String(form.get('prompt') || '').trim()
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
        step?: string
      }
      step = body?.step === 'lyrics' ? 'lyrics' : 'music'
      promptRaw = String(body?.prompt || '').trim()
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

    const auth = await getUserForCreditAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    if (step === 'lyrics') {
      if (vocalMode !== 'vocal') {
        return NextResponse.json({ error: 'Chỉ tạo lời khi đang chọn Có lời.' }, { status: 400 })
      }
      if (promptRaw.length < 4) {
        return NextResponse.json({ error: 'Nhập ý tưởng bài hát (ít nhất 4 ký tự).' }, { status: 400 })
      }
      if (promptRaw.length > 6000) {
        return NextResponse.json({ error: 'Ý tưởng bài hát quá dài.' }, { status: 400 })
      }
      try {
        const ai = new GoogleGenAI({ apiKey })
        const lyrics = await writeLyricsFromBrief(ai, {
          userId: user.id,
          genre,
          songIdea: promptRaw,
          voiceGender,
          voiceTimbre,
          voiceLanguage,
          bpmPreset,
          structurePreset,
          densityPreset,
        })
        return NextResponse.json({ ok: true, lyrics })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không viết được lời bài hát từ ý tưởng.'
        console.error('[music-lyria3] lyrics step failed', msg)
        return NextResponse.json({ error: msg }, { status: 502 })
      }
    }

    const songOk = songContent.trim().length >= 10
    if (vocalMode === 'vocal' && !songOk) {
      return NextResponse.json(
        { error: 'Hãy tạo hoặc nhập lời bài hát trước khi tạo nhạc.' },
        { status: 400 }
      )
    }
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

    if (!bunnyStorageConfigured()) {
      return NextResponse.json(
        { error: 'Thiếu cấu hình lưu file âm thanh (Bunny Storage: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).' },
        { status: 503 }
      )
    }

    const cost = LYRIA3_CHARGE
    const charged = await deductUserCredits(user.id, cost, 'music-lyria3-generate')
    if (!charged.ok) {
      const status = charged.code === 'INSUFFICIENT_CREDITS' ? 402 : 500
      return NextResponse.json({ error: charged.error, code: charged.code }, { status })
    }

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

    const durationBlock = LYRIA3_DURATION_PROMPT

    const fullPrompt =
      vocalMode === 'instrumental'
        ? `${corePrompt}${durationBlock}${INSTRUMENTAL_SUFFIX}`
        : `${corePrompt}${durationBlock}${voiceHintBlock}${VOCAL_HINT}`

    const modelId = LYRIA35_MODEL

    let audioBase64: string
    let mimeType: string
    let textParts: string[]

    try {
      const generated = await generateLyria35Audio({
        apiKey,
        prompt: fullPrompt,
        image: imageBuffer?.length ? { mimeType: imageMime, base64: imageBuffer.toString('base64') } : null,
      })
      if (!generated.ok) {
        await refundUserCredits(user.id, cost, 'music-lyria3-generate')
        console.error('[music-lyria3]', generated.detail)
        return NextResponse.json({ error: generated.error }, { status: 502 })
      }
      void trackApiUsage({
        userId: user.id,
        model: modelId,
        feature: 'music-lyria3-generate',
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 1,
      })
      audioBase64 = generated.audioBase64
      mimeType = generated.mimeType
      textParts = generated.textParts
    } catch (e) {
      await refundUserCredits(user.id, cost, 'music-lyria3-generate')
      const msg = e instanceof Error ? e.message : 'Lỗi gọi Lyria 3.'
      console.error('[music-lyria3] generate failed', msg)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const buffer = Buffer.from(audioBase64, 'base64')
    const ext = mimeType.includes('wav') ? 'wav' : 'mp3'
    const timestamp = Date.now()
    const imgTag = hasImage ? 'img' : 'txt'
    const durTag = String(LYRIA3_TARGET_SEC)
    const uploadPath = `music-history/${user.id}/lyria3_pro_${durTag}s_${vocalMode}_${imgTag}_${timestamp}.${ext}`

    let audioUrl: string
    try {
      const { publicUrl } = await uploadTryOnImagePublic(uploadPath, buffer, {
        contentType: mimeType,
        upsert: true,
      })
      audioUrl = publicUrl
    } catch (uploadError: unknown) {
      await refundUserCredits(user.id, cost, 'music-lyria3-generate')
      const msg = uploadError instanceof Error ? uploadError.message : 'Không upload được audio.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const baseTitle = 'Lyria 3.5 — ~3 phút'
    let titleVi = vocalMode === 'vocal' ? `${baseTitle} (có lời)` : `${baseTitle} (không lời)`
    if (hasImage) titleVi += ' + ảnh'
    const styleSnippet = [genre, promptRaw.slice(0, 80)].filter(Boolean).join(' · ')

    const historySaved = await insertMusicGenerationPg({
      userId: user.id,
      mode: 'lyria3',
      title: titleVi,
      style: styleSnippet.slice(0, 120),
      durationSeconds: LYRIA3_TARGET_SEC,
      chargedCredits: cost,
      audioUrl,
    })
    if (!historySaved) {
      console.error('music_generations insert failed (pg)')
    }

    const modelNotes = textParts.length ? textParts.join('\n\n') : undefined
    return NextResponse.json({
      ok: true,
      audioUrl,
      mimeType,
      lyricsOrNotes: modelNotes,
      charged: cost,
      variant: 'pro',
      targetDurationSec: LYRIA3_TARGET_SEC,
      vocalMode,
      historySaved,
      historyError: historySaved ? undefined : 'Không lưu được lịch sử (DATABASE_URL hoặc lỗi DB).',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
