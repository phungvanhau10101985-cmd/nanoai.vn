const CONTEXT_CHARS = 250

/**
 * Luôn lấy cửa sổ ±CONTEXT_CHARS quanh vị trí con trỏ – đảm bảo đúng chỗ vừa gõ.
 */
export function extractEditRegions(
  prevContent: string,
  newContent: string,
  cursorPos: number
): { originalRegion: string; editedRegion: string; editedStart: number; editedEnd: number; charCount: number } | null {
  if (!newContent || newContent.length < 10) return null

  const editedStart = Math.max(0, cursorPos - CONTEXT_CHARS)
  const editedEnd = Math.min(newContent.length, cursorPos + CONTEXT_CHARS)
  const editedRegion = newContent.slice(editedStart, editedEnd)
  if (!editedRegion.trim() || editedRegion.length < 5) return null

  const prefixLen = (() => {
    let i = 0
    while (i < prevContent.length && i < newContent.length && prevContent[i] === newContent[i]) i++
    return i
  })()
  const origStart = Math.max(0, prefixLen - CONTEXT_CHARS)
  const origEnd = Math.min(prevContent.length, prefixLen + CONTEXT_CHARS)
  const originalRegion = prevContent ? prevContent.slice(origStart, origEnd) : ''

  if (originalRegion === editedRegion && prevContent !== newContent) return null

  return {
    originalRegion,
    editedRegion,
    editedStart,
    editedEnd,
    charCount: editedRegion.length,
  }
}
