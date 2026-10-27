import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'

type BackgroundPlateImage = {
  type: string
  imageUrl: string
  createdAt?: string
}

/**
 * Nền có sẵn thì dùng đúng bộ ảnh của mẫu đó (một ảnh hoặc nhiều ảnh).
 * Không có mẫu thì chỉ một ảnh master đang gắn. Không có master thì lấy master mới nhất.
 * Không ghép cover, album hay các mặt khác.
 */
export function weddingBackgroundPlateUrls(
  masterImageUrl: string | null | undefined,
  images: BackgroundPlateImage[],
  presetId?: string | null,
): string[] {
  const preset = findWeddingBackgroundPreset(presetId)
  if (preset) return [...preset.plates]
  const selected = (masterImageUrl || '').trim()
  if (selected) return [selected]
  const latestMaster = [...images]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .find((image) => image.type === 'master' && image.imageUrl.trim())
  const url = latestMaster?.imageUrl.trim() || ''
  return url ? [url] : []
}
