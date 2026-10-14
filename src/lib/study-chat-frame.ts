/**
 * Khung chat học sinh.
 * Mobile: cố định giữa header và thanh đáy. Nút Quay lại nằm trong header.
 * Desktop: cao vừa phần còn lại của màn hình, tin cuộn bên trong, ô gõ luôn ở đáy.
 */
export const STUDY_CHAT_SHELL_CLASS =
  'flex min-h-0 flex-col overflow-hidden max-md:fixed max-md:inset-x-0 max-md:z-30 max-md:bg-background max-md:top-[var(--site-header-height,3rem)] max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:sticky md:top-[var(--site-header-height,3rem)] md:z-20 md:h-[min(44rem,calc(100dvh-var(--site-header-height,3rem)-9.5rem))] md:rounded-xl md:border md:bg-card md:shadow-sm'

function composerInView(field: HTMLElement): boolean {
  const rect = field.getBoundingClientRect()
  const viewTop = window.visualViewport?.offsetTop ?? 0
  const viewHeight = window.visualViewport?.height ?? window.innerHeight
  return rect.top >= viewTop + 8 && rect.bottom <= viewTop + viewHeight - 8
}

/** Đưa ô gõ vào vùng nhìn và focus để bàn phím mở, người dùng gõ tiếp được ngay. */
export function revealStudyComposer(field: HTMLTextAreaElement | null): void {
  if (!field?.isConnected || field.disabled) return
  const desktop = window.matchMedia('(min-width: 768px)').matches
  if (desktop && !composerInView(field)) {
    field.scrollIntoView({ block: 'end', inline: 'nearest' })
  }
  field.focus({ preventScroll: true })
  const end = field.value.length
  try {
    field.setSelectionRange(end, end)
  } catch {
    // Một số trình duyệt từ chối setSelectionRange khi ô chưa sẵn sàng.
  }
}

/** Gọi lại sau khi dialog đóng và sau khi React vẽ hội thoại mới. */
export function scheduleStudyComposerReveal(run: () => void): () => void {
  const frame = window.requestAnimationFrame(run)
  const soon = window.setTimeout(run, 60)
  const later = window.setTimeout(run, 320)
  return () => {
    window.cancelAnimationFrame(frame)
    window.clearTimeout(soon)
    window.clearTimeout(later)
  }
}
