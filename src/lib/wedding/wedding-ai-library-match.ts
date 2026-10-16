export type WeddingLibraryLink = {
  imageUrl: string
  referenceImageUrl: string
}

/**
 * Ảnh tạo mới lưu URL ảnh kho được chọn làm tham khảo.
 * Chọn nền A thì đề xuất khung có reference = A, và khung mà A lấy làm tham khảo.
 * Chiều kia giống vậy.
 */
export function splitLibraryByRecommendation<T extends WeddingLibraryLink>(
  items: T[],
  partner: WeddingLibraryLink | null,
): { recommended: T[]; rest: T[] } {
  const partnerUrl = partner?.imageUrl.trim() ?? ''
  const partnerReference = partner?.referenceImageUrl.trim() ?? ''
  if (!partnerUrl && !partnerReference) return { recommended: [], rest: items }
  const recommended: T[] = []
  const rest: T[] = []
  for (const item of items) {
    const itemUrl = item.imageUrl.trim()
    const itemReference = item.referenceImageUrl.trim()
    const linked =
      (partnerUrl !== '' && itemReference === partnerUrl) ||
      (partnerReference !== '' && itemUrl === partnerReference)
    if (linked) recommended.push(item)
    else rest.push(item)
  }
  return { recommended, rest }
}
