import type { WebLocale } from '@/lib/i18n/config'
import { hasDictionaryLoaded } from '@/lib/i18n/dictionaries'

/** Load a non-bundled locale before a soft `router.refresh()` re-renders client copy in it. */
export function ensureClientDictionary(locale: WebLocale): Promise<void> {
  if (typeof document === 'undefined' || hasDictionaryLoaded(locale)) return Promise.resolve()
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `/api/i18n-dict/${locale}`
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}
