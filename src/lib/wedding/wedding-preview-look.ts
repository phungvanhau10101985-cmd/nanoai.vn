import { isWeddingOrnamentLayoutKey, parseWeddingOrnamentList } from '@/lib/wedding/wedding-background-ornament-store'
import type { WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
import { parseWeddingSharedFrame, type WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'

export const WEDDING_PREVIEW_LOOK_MESSAGE = 'wedding-preview-look'
export const WEDDING_PREVIEW_READY_MESSAGE = 'wedding-preview-ready'

export type WeddingPreviewLook = {
  sectionConfig: string
  selectedStyleId: string
  plateUrls: string[]
  ornaments: WeddingBackgroundOrnament[]
  ornamentKey: string
  sharedFrame: WeddingSharedFrame | null
}

function text(value: string | undefined): string {
  return value?.trim() || ''
}

function frameSignature(frame: WeddingSharedFrame | null): string {
  if (!frame) return ''
  if (frame.mode === 'none') return 'none'
  if (frame.mode === 'preset') return `preset:${text(frame.presetId)}`
  return `library:${text(frame.imageUrl)}`
}

/** Chỉ những phần nền và giao diện. Sửa chữ hay kéo hoa không đổi mã này. */
export function weddingPreviewLookToken(look: {
  sectionConfig: string
  selectedStyleId: string
  plateUrls: readonly string[]
  ornamentKey: string
  sharedFrame: WeddingSharedFrame | null
}): string {
  const section = parseWeddingSectionConfig(look.sectionConfig)
  return [
    look.ornamentKey,
    look.selectedStyleId.trim(),
    look.plateUrls.join('|'),
    text(section.backgroundPresetId),
    text(section.backgroundKitStyleId),
    text(section.buttonColorId),
    text(section.coverRsvpColorId),
    section.heroPhotoLayout === 'stack' ? 'stack' : '',
    text(section.coverPresetId),
    text(section.coverFrameMode),
    section.coverFrameChosen ? '1' : '',
    text(section.coverAiFrameUrl),
    text(section.groomPortraitShellMode),
    text(section.groomPortraitShellPresetId),
    text(section.groomPortraitShellUrl),
    section.groomPortraitFrameChosen ? '1' : '',
    text(section.bridePortraitShellMode),
    text(section.bridePortraitShellPresetId),
    text(section.bridePortraitShellUrl),
    section.bridePortraitFrameChosen ? '1' : '',
    frameSignature(look.sharedFrame),
  ].join('\n')
}

function safePlateUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (!url || url.length > 2000) return null
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('..')) return url
  if (/^https?:\/\//i.test(url)) return url
  return null
}

export function readWeddingPreviewLook(data: unknown): WeddingPreviewLook | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  if (raw.type !== WEDDING_PREVIEW_LOOK_MESSAGE) return null
  if (typeof raw.sectionConfig !== 'string' || !raw.sectionConfig.trim() || raw.sectionConfig.length > 200_000) return null
  try {
    const parsed = JSON.parse(raw.sectionConfig) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  } catch {
    return null
  }
  let selectedStyleId = typeof raw.selectedStyleId === 'string' ? raw.selectedStyleId.trim() : ''
  if (selectedStyleId.length > 80 || !/^[a-z0-9_-]+$/i.test(selectedStyleId)) selectedStyleId = ''
  const plateUrls: string[] = []
  if (Array.isArray(raw.plateUrls)) {
    for (const item of raw.plateUrls.slice(0, 12)) {
      const url = safePlateUrl(item)
      if (url) plateUrls.push(url)
    }
  }
  const ornamentKeyRaw = typeof raw.ornamentKey === 'string' ? raw.ornamentKey.trim() : ''
  const ornamentKey = ornamentKeyRaw && isWeddingOrnamentLayoutKey(ornamentKeyRaw) ? ornamentKeyRaw : ''
  const ornaments = Array.isArray(raw.ornaments) ? parseWeddingOrnamentList(raw.ornaments) ?? [] : []
  const sharedFrame = raw.sharedFrame == null ? null : parseWeddingSharedFrame(raw.sharedFrame)
  return {
    sectionConfig: raw.sectionConfig,
    selectedStyleId,
    plateUrls,
    ornaments,
    ornamentKey,
    sharedFrame,
  }
}
