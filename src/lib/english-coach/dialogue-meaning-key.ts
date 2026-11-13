/** Khóa cache hội thoại: nghĩa tiếng mẹ đẻ, bỏ hoa thường, dấu câu và khoảng trắng. */
export function normalizeDialogueMeaningKey(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s.,!?;:()[\]{}'"`~@#$%^&*+=<>|\\/_-]+/g, '')
    .replace(/[。！？、；：「」『』（）【】《》〈〉…·]/g, '')
}
