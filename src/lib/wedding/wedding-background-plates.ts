type BackgroundPlateImage = {
  type: string
  imageUrl: string
  createdAt?: string
}

/**
 * Nền thiệp chỉ một ảnh đã chọn.
 * Ưu tiên ảnh master đang gắn. Không có thì lấy master mới nhất.
 * Không ghép cover, album hay các mặt khác.
 */
export function weddingBackgroundPlateUrls(
  masterImageUrl: string | null | undefined,
  images: BackgroundPlateImage[],
): string[] {
  const selected = (masterImageUrl || '').trim()
  if (selected) return [selected]
  const latestMaster = [...images]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .find((image) => image.type === 'master' && image.imageUrl.trim())
  const url = latestMaster?.imageUrl.trim() || ''
  return url ? [url] : []
}
