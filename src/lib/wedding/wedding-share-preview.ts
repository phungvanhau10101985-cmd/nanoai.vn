import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { invitationEditorCopy, invitationOccasionShape } from '@/lib/wedding/invitation-occasion'
import { parseWeddingSectionConfig, resolveCoverPhotoUrl } from '@/lib/wedding/wedding-section-config'

export type WeddingShareLook = {
  styleId: string
  background: string
  backgroundAlt: string
  scrim: string
  frame: string
  panel: string
  ink: string
  muted: string
  accent: string
}

const LOOKS: Record<string, WeddingShareLook> = {
  luxury: {
    styleId: 'luxury',
    background: '#f6e7bf',
    backgroundAlt: '#fff1f2',
    scrim: 'rgba(47, 36, 31, 0.28)',
    frame: '#a66a2d',
    panel: '#fffdf8',
    ink: '#2f241f',
    muted: '#6b5344',
    accent: '#8a5727',
  },
  minimal: {
    styleId: 'minimal',
    background: '#fafaf9',
    backgroundAlt: '#dbe7dd',
    scrim: 'rgba(28, 25, 23, 0.22)',
    frame: '#047857',
    panel: '#ffffff',
    ink: '#1c1917',
    muted: '#44403c',
    accent: '#047857',
  },
  traditional_vietnamese: {
    styleId: 'traditional_vietnamese',
    background: '#7f1d1d',
    backgroundAlt: '#f6c453',
    scrim: 'rgba(69, 10, 10, 0.34)',
    frame: '#e8b84a',
    panel: '#fff8f0',
    ink: '#6b1d1d',
    muted: '#8a4034',
    accent: '#9a3412',
  },
  floral: {
    styleId: 'floral',
    background: '#fff1f2',
    backgroundAlt: '#dff3e8',
    scrim: 'rgba(76, 29, 49, 0.22)',
    frame: '#be185d',
    panel: '#fffdfb',
    ink: '#2d3824',
    muted: '#6b4a55',
    accent: '#be185d',
  },
  vintage: {
    styleId: 'vintage',
    background: '#f5deb8',
    backgroundAlt: '#d8a48f',
    scrim: 'rgba(59, 38, 24, 0.28)',
    frame: '#9a5b2e',
    panel: '#fff8ee',
    ink: '#3b2618',
    muted: '#6c4328',
    accent: '#7b431f',
  },
  modern: {
    styleId: 'modern',
    background: '#020617',
    backgroundAlt: '#d6a84f',
    scrim: 'rgba(2, 6, 23, 0.5)',
    frame: '#fbbf24',
    panel: '#0f172a',
    ink: '#f8fafc',
    muted: '#cbd5e1',
    accent: '#fcd34d',
  },
}

const PRESET_STYLE: Record<string, string> = {
  classic_red: 'traditional_vietnamese',
  red_photo_arch: 'traditional_vietnamese',
  lotus_viet: 'traditional_vietnamese',
  blush_floral: 'floral',
  sage_garden: 'minimal',
  gold_luxury: 'luxury',
  night_modern: 'modern',
  dragon_phoenix: 'luxury',
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

export type WeddingSharePreviewModel = {
  look: WeddingShareLook
  groomName: string
  brideName: string
  groomSize: number
  brideSize: number
  dateLine: string
  venueLine: string
  inviteLine: string
  backgroundUrl: string
}

function plain(raw: string, maxLen: number) {
  const text = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLen) return text
  const cut = text.slice(0, Math.max(1, maxLen - 1))
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 24 ? cut.slice(0, sp) : cut).trim()}…`
}

function nameSize(name: string) {
  const n = name.trim().length
  if (n > 28) return 34
  if (n > 18) return 42
  return 54
}

function timeLabel(raw: string) {
  const value = String(raw || '').replace(/\s+/g, ' ').trim()
  const match = value.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!match) return plain(value, 28)
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return plain(value, 28)
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  const rest = plain(value.replace(match[0], ' ').replace(/[,|]+/g, ' '), 24)
  return [clock, rest].filter(Boolean).join(' · ')
}

function dateLabel(raw: string | null | undefined) {
  const value = String(raw || '').trim()
  if (!DATE_ISO.test(value)) return plain(value, 32)
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function weddingShareLook(styleId: string | null | undefined, coverPresetId?: string | null): WeddingShareLook {
  const preset = String(coverPresetId || '').trim()
  const fromPreset = preset ? PRESET_STYLE[preset] : ''
  const id = fromPreset || String(styleId || '').trim() || 'luxury'
  return LOOKS[id] ?? LOOKS.luxury
}

export function buildWeddingSharePreviewModel(
  card: Pick<
    WeddingCard,
    | 'groomName'
    | 'brideName'
    | 'weddingDate'
    | 'weddingTime'
    | 'venue'
    | 'invitationText'
    | 'selectedStyleId'
    | 'masterImageUrl'
    | 'sectionConfig'
    | 'groomImageUrl'
    | 'brideImageUrl'
  > & { occasionKey?: string | null },
  guestName?: string,
): WeddingSharePreviewModel {
  const section = parseWeddingSectionConfig(card.sectionConfig)
  const look = weddingShareLook(card.selectedStyleId, section.coverPresetId)
  const single = invitationOccasionShape(card.occasionKey) === 'single'
  const editor = invitationEditorCopy(card.occasionKey)
  const groomName = plain(card.groomName, 42) || (single ? editor.primaryRole || editor.label : 'Chú rể')
  const brideName = plain(card.brideName, 42) || (single ? '' : 'Cô dâu')
  const date = dateLabel(card.weddingDate)
  const guest = plain(String(guestName || ''), 40)
  const written = plain(card.invitationText, 88)
  const cover = resolveCoverPhotoUrl(section)
  const art = [card.masterImageUrl, cover, card.groomImageUrl, card.brideImageUrl]
    .map((url) => String(url || '').trim())
    .find((url) => /^https?:\/\//i.test(url) || url.startsWith('/'))
  return {
    look,
    groomName,
    brideName,
    groomSize: nameSize(groomName),
    brideSize: nameSize(brideName),
    dateLine: [date, timeLabel(card.weddingTime)].filter(Boolean).join('  ·  '),
    venueLine: plain(card.venue, 72),
    inviteLine: guest ? `Kính mời ${guest}` : written || 'Trân trọng kính mời',
    backgroundUrl: art || '',
  }
}

function shareVersion(parts: string[]) {
  let hash = 0
  const source = parts.join('|')
  for (let i = 0; i < source.length; i += 1) hash = (hash * 33 + source.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

function xmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function diamond(cx: number, cy: number, size: number, color: string) {
  const h = size / 2
  return `<polygon points="${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}" fill="${color}"/>`
}

export function buildWeddingSharePreviewSvg(model: WeddingSharePreviewModel, artDataUrl = ''): string {
  const look = model.look
  let inner = 40 + 22 + 16 + 12 + 18 + model.groomSize + 8 + 28 + 4 + model.brideSize + 18 + 16 + 24 + 36
  if (model.dateLine) inner += 16 + 26
  if (model.venueLine) inner += 8 + 24
  const panelH = inner
  const panelY = Math.max(52, Math.round((630 - panelH) / 2))
  const panelX = 160
  const panelW = 880
  let y = panelY + 40 + 22
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${look.background}"/><stop offset="100%" stop-color="${look.backgroundAlt}"/></linearGradient></defs>`,
    `<rect width="1200" height="630" fill="url(#bg)"/>`,
  ]
  if (artDataUrl.startsWith('data:image/')) {
    parts.push(
      `<image href="${artDataUrl}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>`,
      `<rect width="1200" height="630" fill="${look.scrim}"/>`,
    )
  }
  parts.push(
    `<rect x="22" y="22" width="1156" height="586" rx="18" fill="none" stroke="${look.frame}" stroke-width="2"/>`,
    diamond(48, 48, 14, look.frame),
    diamond(1152, 48, 14, look.frame),
    diamond(48, 582, 14, look.frame),
    diamond(1152, 582, 14, look.frame),
    `<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="28" fill="${look.panel}" stroke="${look.frame}" stroke-width="3"/>`,
    `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="22" font-weight="600" letter-spacing="6" fill="${look.accent}">THIỆP MỜI</text>`,
  )
  y += 16 + 12
  parts.push(diamond(600, y, 12, look.frame))
  y += 18 + model.groomSize
  parts.push(
    `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="${model.groomSize}" font-weight="600" fill="${look.ink}">${xmlText(model.groomName)}</text>`,
  )
  if (model.brideName) {
    y += 8 + 28
    parts.push(
      `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="28" font-weight="600" fill="${look.accent}">${xmlText('&')}</text>`,
    )
    y += 4 + model.brideSize
    parts.push(
      `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="${model.brideSize}" font-weight="600" fill="${look.ink}">${xmlText(model.brideName)}</text>`,
    )
  }
  y += 18
  parts.push(`<rect x="534" y="${y}" width="132" height="2" fill="${look.frame}"/>`)
  if (model.dateLine) {
    y += 16 + 26
    parts.push(
      `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="26" fill="${look.muted}">${xmlText(model.dateLine)}</text>`,
    )
  }
  if (model.venueLine) {
    y += 8 + 24
    parts.push(
      `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="22" fill="${look.muted}">${xmlText(model.venueLine)}</text>`,
    )
  }
  y += 16 + 24
  parts.push(
    `<text x="600" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro" font-size="24" font-weight="600" fill="${look.ink}">${xmlText(model.inviteLine)}</text>`,
    `</svg>`,
  )
  return parts.join('')
}

export function weddingPublicShareImageUrl(
  origin: string,
  card: Pick<
    WeddingCard,
    | 'slug'
    | 'groomName'
    | 'brideName'
    | 'weddingDate'
    | 'weddingTime'
    | 'venue'
    | 'invitationText'
    | 'selectedStyleId'
    | 'masterImageUrl'
    | 'sectionConfig'
  >,
  guestName?: string,
): string {
  const base = String(origin || '').replace(/\/$/, '')
  const slug = encodeURIComponent(String(card.slug || '').trim())
  const query = new URLSearchParams()
  const guest = String(guestName || '').trim().slice(0, 80)
  if (guest) query.set('guest', guest)
  query.set(
    'v',
    shareVersion([
      card.selectedStyleId,
      card.sectionConfig,
      card.groomName,
      card.brideName,
      card.weddingDate || '',
      card.weddingTime,
      card.venue,
      card.invitationText,
      card.masterImageUrl || '',
      guest,
    ]),
  )
  return `${base}/thiep-moi-cuoi/${slug}/share-preview?${query.toString()}`
}
