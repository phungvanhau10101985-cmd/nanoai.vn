const RELOAD_KEY = 'nanoai:chunk-reload'
let reloadStarted = false

/** Webpack / Next dynamic import after a deploy, or a crawler that cannot run the chunk. */
export function isChunkLoadError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const text = `${error.name || ''} ${error.message || ''}`
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    text
  )
}

/**
 * Tải lại đúng một lần khi chunk JS cũ không chạy.
 * Lần sau cùng tab vẫn lỗi thì để trang lỗi hiện, không lặp vô hạn.
 */
export function reloadOnceForStaleChunk(error: { name?: string; message?: string } | null | undefined): boolean {
  if (typeof window === 'undefined') return false
  if (!isChunkLoadError(error)) return false
  if (reloadStarted) return true
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    return false
  }
  reloadStarted = true
  window.location.reload()
  return true
}
