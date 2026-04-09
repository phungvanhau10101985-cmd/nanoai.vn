import { getCurrentWebLocale } from '@/lib/i18n/server'
import type { ApiKeysHubLocale } from '@/lib/integration/api-keys-hub-copy'

/** Chỉ dùng trong Server Component / server code — không import từ client components. */
export function pickApiKeysHubLocale(): ApiKeysHubLocale {
  const l = getCurrentWebLocale()
  if (l === 'en' || l === 'zh' || l === 'ja' || l === 'ko') return l
  return 'vi'
}
