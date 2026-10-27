import { findWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
import { isWeddingOrnamentLayoutKey } from '@/lib/wedding/wedding-background-ornament-store'

export type WeddingSharedFrameHole = { x: number; y: number; w: number; h: number }

/** Khung mặc định của một nền. Khách chưa tự chọn thì dùng bản này. */
export type WeddingSharedFrame = {
  mode: 'none' | 'preset' | 'library'
  presetId?: string
  imageUrl?: string
  hole?: WeddingSharedFrameHole
  panel?: string
  ink?: 'dark' | 'light'
}

export function weddingSharedFrameKey(baseKey: string): string {
  const base = baseKey.trim()
  return base ? `${base}@frame` : ''
}

export function isWeddingSharedFrameKey(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed.endsWith('@frame')) return false
  return isWeddingOrnamentLayoutKey(trimmed.slice(0, -'@frame'.length))
}

function readHole(value: unknown): WeddingSharedFrameHole | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return undefined
  if (w < 18 || h < 18 || x < 0 || y < 0 || x + w > 100.5 || y + h > 100.5) return undefined
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    w: Math.round(w * 100) / 100,
    h: Math.round(h * 100) / 100,
  }
}

export function parseWeddingSharedFrame(value: unknown): WeddingSharedFrame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.mode === 'none') return { mode: 'none' }
  if (raw.mode === 'preset') {
    const presetId = String(raw.presetId ?? '').trim()
    if (!findWeddingCoverPreset(presetId)?.frame) return null
    return { mode: 'preset', presetId }
  }
  if (raw.mode === 'library') {
    const imageUrl = String(raw.imageUrl ?? '').trim()
    const hole = readHole(raw.hole)
    if (!imageUrl || imageUrl.length > 2000 || !hole) return null
    const panelRaw = String(raw.panel ?? '')
    const panel = /^#[0-9a-fA-F]{6}$/.test(panelRaw) ? panelRaw : '#fffaf2'
    return {
      mode: 'library',
      imageUrl,
      hole,
      panel,
      ink: raw.ink === 'light' ? 'light' : 'dark',
    }
  }
  return null
}
