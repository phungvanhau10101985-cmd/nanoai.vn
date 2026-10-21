/** Cùng tab không nhận sự kiện storage. Icon trang chủ nghe sự kiện này. */
export const FEATURE_USAGE_EVENT = 'nanoai-feature-usage'

export function notifyFeatureUsage() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FEATURE_USAGE_EVENT))
}
