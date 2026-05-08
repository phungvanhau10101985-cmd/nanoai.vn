export const BEFORE_AFTER_VIEW_EVENT = 'nanoai:image-before-after-view'
export const BEFORE_AFTER_VIEW_STORAGE_KEY = 'nanoai_before_after_view_v1'

export type BeforeAfterViewMode = 'split' | 'compare'

const VALID: BeforeAfterViewMode[] = ['split', 'compare']

export function readBeforeAfterViewMode(): BeforeAfterViewMode {
  if (typeof window === 'undefined') return 'split'
  try {
    const raw = window.localStorage.getItem(BEFORE_AFTER_VIEW_STORAGE_KEY)
    if (raw === 'compare' || raw === 'split') return raw
  } catch {
    /* ignore */
  }
  return 'split'
}

export function writeBeforeAfterViewMode(mode: BeforeAfterViewMode): void {
  if (typeof window === 'undefined') return
  if (!VALID.includes(mode)) return
  try {
    window.localStorage.setItem(BEFORE_AFTER_VIEW_STORAGE_KEY, mode)
    window.dispatchEvent(new CustomEvent(BEFORE_AFTER_VIEW_EVENT, { detail: { mode } }))
  } catch {
    /* ignore */
  }
}
