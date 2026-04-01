/**
 * Gợi ý prompt Veo cho flow video âm nhạc (đồng bộ id với Lyria 3 / tao-bai-hat-lyria-3).
 */

export type LyriaGenreId =
  | 'custom'
  | 'pop'
  | 'rap'
  | 'trap'
  | 'nhac_tre'
  | 'ballad'
  | 'tam_trang'
  | 'rock'
  | 'edm'
  | 'house'
  | 'remix'
  | 'lofi'
  | 'chill'
  | 'indie'
  | 'jazz'
  | 'rnb'
  | 'bolero'
  | 'folk'
  | 'cinematic'
  | 'synthwave'
  | 'nhac_che_hai'
  | 'c_pop'
  | 'j_pop'
  | 'k_pop'

const GENRE_EN: Record<LyriaGenreId, string> = {
  custom: 'custom style from user brief',
  pop: 'pop',
  rap: 'rap / hip-hop',
  trap: 'trap',
  nhac_tre: 'youth pop (V-pop style)',
  ballad: 'ballad',
  tam_trang: 'emotional / mood song',
  rock: 'rock',
  edm: 'EDM / electronic dance',
  house: 'house',
  remix: 'remix / club',
  lofi: 'lo-fi',
  chill: 'chill / relax',
  indie: 'indie',
  jazz: 'jazz',
  rnb: 'R&B',
  bolero: 'bolero / light folk',
  folk: 'folk / acoustic',
  cinematic: 'cinematic',
  synthwave: 'synthwave / retro 80s',
  nhac_che_hai: 'parody / humorous song',
  c_pop: 'Chinese pop (C-pop)',
  j_pop: 'Japanese pop (J-pop)',
  k_pop: 'Korean pop (K-pop)',
}

export type VoiceGenderId = 'auto' | 'female' | 'male' | 'neutral' | 'duet_mf'
export type VoiceTimbreId = 'auto' | 'high' | 'bright' | 'warm' | 'soft' | 'deep' | 'rap'
export type VoiceLangId = 'auto' | 'vi_north' | 'vi_central' | 'vi_south' | 'en_uk' | 'en_us' | 'zh' | 'ja' | 'ko'
export type BpmPreset = 'auto' | 'slow' | 'medium' | 'fast'
export type StructurePreset = 'auto' | 'verse_chorus' | 'verse_chorus_bridge' | 'short_hook' | 'through'
export type DensityPreset = 'auto' | 'minimal' | 'balanced' | 'full'

function voiceGenderEn(v: VoiceGenderId): string {
  switch (v) {
    case 'female':
      return 'female lead vocal'
    case 'male':
      return 'male lead vocal'
    case 'neutral':
      return 'neutral / androgynous vocal'
    case 'duet_mf':
      return 'male + female duet vocals'
    default:
      return 'vocal gender: auto (fit the lyrics language)'
  }
}

function voiceTimbreEn(v: VoiceTimbreId): string {
  switch (v) {
    case 'high':
      return 'high, bright voice'
    case 'bright':
      return 'youthful bright pop vocal'
    case 'warm':
      return 'warm mid-range vocal'
    case 'soft':
      return 'soft, breathy vocal'
    case 'deep':
      return 'deep, resonant vocal'
    case 'rap':
      return 'rap / rhythmic spoken vocal'
    default:
      return 'timbre: natural fit to genre'
  }
}

function voiceLangEn(v: VoiceLangId): string {
  switch (v) {
    case 'vi_north':
      return 'Vietnamese (Northern accent) singing'
    case 'vi_central':
      return 'Vietnamese (Central accent) singing'
    case 'vi_south':
      return 'Vietnamese (Southern accent) singing'
    case 'en_uk':
      return 'English (UK) singing'
    case 'en_us':
      return 'English (US) singing'
    case 'zh':
      return 'Mandarin Chinese singing'
    case 'ja':
      return 'Japanese singing'
    case 'ko':
      return 'Korean singing'
    default:
      return 'singing language should match the lyrics language'
  }
}

function bpmEn(v: BpmPreset): string {
  switch (v) {
    case 'slow':
      return 'slow tempo ~72–88 BPM'
    case 'medium':
      return 'medium tempo ~96–112 BPM'
    case 'fast':
      return 'fast tempo ~122–138 BPM'
    default:
      return 'tempo appropriate to genre'
  }
}

function structureEn(v: StructurePreset): string {
  switch (v) {
    case 'verse_chorus':
      return 'verse + chorus song form'
    case 'verse_chorus_bridge':
      return 'verse + chorus + bridge'
    case 'short_hook':
      return 'short intro, memorable hook'
    case 'through':
      return 'through-composed, minimal rigid repeats'
    default:
      return 'song structure: natural for genre'
  }
}

function densityEn(v: DensityPreset): string {
  switch (v) {
    case 'minimal':
      return 'sparse arrangement, few instruments'
    case 'balanced':
      return 'balanced arrangement'
    case 'full':
      return 'full layered production'
    default:
      return 'arrangement density: fit genre'
  }
}

/** Chỉ thể loại nhạc — gửi khi sinh lời (Flash), không gồm giọng/tempo/cấu trúc (dùng cho Veo sau). */
export function describeGenreForLyricsEn(genre: LyriaGenreId | string): string {
  const g = (genre in GENRE_EN ? genre : 'custom') as LyriaGenreId
  const genreLine = GENRE_EN[g] ?? String(genre)
  return `Target genre for lyrics: ${genreLine}. Match word choice, rhythm feel, and typical song tropes to this genre.`
}

export function describeMusicStyleForVeoEn(params: {
  genre: LyriaGenreId | string
  voiceGender: VoiceGenderId | string
  voiceTimbre: VoiceTimbreId | string
  voiceLanguage: VoiceLangId | string
  bpmPreset: BpmPreset | string
  structurePreset: StructurePreset | string
  densityPreset: DensityPreset | string
}): string {
  const g = (params.genre in GENRE_EN ? params.genre : 'custom') as LyriaGenreId
  const genreLine = GENRE_EN[g] ?? String(params.genre)
  return [
    `Musical style: ${genreLine}.`,
    voiceGenderEn(params.voiceGender as VoiceGenderId),
    voiceTimbreEn(params.voiceTimbre as VoiceTimbreId),
    voiceLangEn(params.voiceLanguage as VoiceLangId),
    bpmEn(params.bpmPreset as BpmPreset),
    structureEn(params.structurePreset as StructurePreset),
    densityEn(params.densityPreset as DensityPreset),
  ].join(' ')
}

/** Đoạn mở đưa vào clip ~8s đầu (cắt theo dòng / ký tự). */
export function defaultOpeningFromFullLyrics(full: string, maxChars = 480): string {
  const t = full.trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  const lines = t.split(/\n/)
  let out = ''
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line
    if (next.length > maxChars) break
    out = next
  }
  return out || t.slice(0, maxChars)
}

/** Chia toàn bộ lời thành N đoạn (theo dòng, gần đều) — mỗi đoạn ~ một clip 8s độc lập. */
export function splitLyricsIntoSegments(full: string, segmentCount: number): string[] {
  const fullT = full.trim()
  const n = Math.min(20, Math.max(1, Math.floor(segmentCount)))
  if (!fullT) return Array.from({ length: n }, () => '')
  const lines = fullT.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return Array.from({ length: n }, () => '')
  const per = Math.max(1, Math.ceil(lines.length / n))
  const out: string[] = []
  for (let s = 0; s < n; s++) {
    out.push(lines.slice(s * per, (s + 1) * per).join('\n'))
  }
  return out
}

const MAX_LYRICS_SEGMENTS = 20

/**
 * Chia toàn bộ lời thành các ô không cần nhập trước số đoạn:
 * - Nhiều khối cách nhau bởi dòng trống → mỗi khối một đoạn (tối đa 20).
 * - Một khối liền → chia theo dòng, gần đều ~4 dòng/ô.
 */
export function splitFullLyricsIntoAutoSegments(full: string): string[] {
  const fullT = full.trim()
  if (!fullT) return ['']
  const paras = fullT.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  if (paras.length >= 2) {
    return paras.slice(0, MAX_LYRICS_SEGMENTS)
  }
  const blob = paras[0] ?? fullT
  const lines = blob.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return ['']
  const n = Math.min(MAX_LYRICS_SEGMENTS, Math.max(1, Math.ceil(lines.length / 4)))
  return splitLyricsIntoSegments(blob, n)
}

/** Gộp gợi ý tùy chọn cho một clip (đoạn 1 hoặc prompt chung). */
export function buildMusicClipVisualNotesBlock(params: {
  onScreen?: string
  camera?: string
  character?: string
}): string {
  const lines: string[] = []
  const on = (params.onScreen ?? '').trim()
  const cam = (params.camera ?? '').trim()
  const ch = (params.character ?? '').trim()
  if (on) lines.push(`On-screen text / graphics / message to show: ${on}`)
  if (cam) lines.push(`Camera / framing / movement: ${cam}`)
  if (ch) lines.push(`Character performance / actions: ${ch}`)
  return lines.join('\n')
}

export function buildMusicVideoVeoUserPrompt(openingLyrics: string, styleEn: string, visualExtra?: string): string {
  const visual = (visualExtra ?? '').trim()
  return [
    'Create a short music video clip with synchronized singing matching the lyrics below. Lip-sync when faces are visible; keep mood, rhythm and genre consistent.',
    `Audio / music direction: ${styleEn}`,
    'Lyrics to perform in this ~8 second clip (may be truncated to fit duration):',
    '---',
    openingLyrics.trim(),
    '---',
    visual ? `Visual / scene notes: ${visual}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Mỗi clip sinh riêng (không extend); prompt đầy đủ gửi lại từng lần — phù hợp ghép hậu kỳ. */
export function buildMusicVideoVeoStandaloneClipPrompt(
  segmentLyrics: string,
  styleEn: string,
  visualExtra: string | undefined,
  segmentIndex: number,
  segmentTotal: number
): string {
  if (segmentTotal <= 1) {
    return buildMusicVideoVeoUserPrompt(segmentLyrics, styleEn, visualExtra)
  }
  const head = [
    `Standalone music-video clip ${segmentIndex + 1} of ${segmentTotal} (~8 seconds each).`,
    'This clip is generated independently, not as a continuation of another generated clip. Give this unit a clear start and end within ~8 seconds.',
    'You may vary shot, lighting, or setting between clips if it fits the lyrics; keep the same vocal character, genre, singing language, and musical direction.',
    '',
  ].join('\n')
  return head + buildMusicVideoVeoUserPrompt(segmentLyrics, styleEn, visualExtra)
}

/** Prompt kéo dài Veo: nối tiếp khung cuối, lời đoạn kế tiếp + cùng phong cách nhạc. */
export function buildMusicVideoExtendPrompt(
  lyricsChunk: string,
  styleEn: string,
  visualExtra?: string,
  segmentOneBased?: number,
  segmentTotal?: number,
  cameraHint?: string,
  characterAction?: string
): string {
  const visual = (visualExtra ?? '').trim()
  const camera = (cameraHint ?? '').trim()
  const character = (characterAction ?? '').trim()
  const pos =
    segmentOneBased != null && segmentTotal != null && segmentTotal > 1
      ? `Continuation segment ${segmentOneBased} of ${segmentTotal} of the same song. Seamlessly continue motion and space from the last frames; keep the same vocal identity and genre. `
      : ''
  return [
    pos +
      'Continue the music video with synchronized singing for this next ~8 seconds. Lip-sync when faces are visible; match rhythm and emotional arc to the prior clip.',
    `Music direction: ${styleEn}`,
    'Lyrics for this continuation segment:',
    '---',
    lyricsChunk.trim(),
    '---',
    visual ? `Visual / scene notes (subtle continuity or shift if lyrics demand): ${visual}` : '',
    camera ? `Camera / framing / movement: ${camera}` : '',
    character ? `Character actions / story beats: ${character}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
