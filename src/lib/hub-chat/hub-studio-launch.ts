import type { WebLocale } from '@/lib/i18n/config'

export type HubStudioLaunchId = 'packaging_kit' | 'bag_kit'

export const HUB_STUDIO_LAUNCH_QUERY = 'hubStudio'

export const HUB_STUDIO_LAUNCH_PROMPTS: Record<HubStudioLaunchId, Record<WebLocale, string>> = {
  packaging_kit: {
    vi: 'thiết kế hộp giấy',
    en: 'design paper box packaging',
    zh: '设计纸盒包装',
    ja: '紙箱包装をデザイン',
    ko: '종이 상자 포장 디자인',
  },
  bag_kit: {
    vi: 'thiết kế túi đựng',
    en: 'design paper shopping bag',
    zh: '设计纸袋',
    ja: '紙袋をデザイン',
    ko: '종이 쇼핑백 디자인',
  },
}

export function hubStudioLaunchHref(launchId: HubStudioLaunchId): string {
  return `/?${HUB_STUDIO_LAUNCH_QUERY}=${launchId}`
}

export function hubStudioLaunchPrompt(launchId: HubStudioLaunchId, locale: WebLocale): string {
  return HUB_STUDIO_LAUNCH_PROMPTS[launchId][locale] ?? HUB_STUDIO_LAUNCH_PROMPTS[launchId].vi
}

export function parseHubStudioLaunchId(value: string | null | undefined): HubStudioLaunchId | null {
  const id = String(value ?? '').trim()
  if (id === 'packaging_kit' || id === 'bag_kit') return id
  return null
}

const HUB_STUDIO_LAUNCH_STORAGE_KEY = 'nanoai_hub_studio_launch'

export function saveHubStudioLaunch(launchId: HubStudioLaunchId): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HUB_STUDIO_LAUNCH_STORAGE_KEY, launchId)
  } catch {
    /* ignore */
  }
}

/** Pending launch in sessionStorage (does not consume). */
export function peekHubStudioLaunch(): HubStudioLaunchId | null {
  if (typeof window === 'undefined') return null
  try {
    return parseHubStudioLaunchId(sessionStorage.getItem(HUB_STUDIO_LAUNCH_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Read queued studio launch once (survives router.replace and remount). */
export function consumeHubStudioLaunch(): HubStudioLaunchId | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HUB_STUDIO_LAUNCH_STORAGE_KEY)
    sessionStorage.removeItem(HUB_STUDIO_LAUNCH_STORAGE_KEY)
    return parseHubStudioLaunchId(raw)
  } catch {
    return null
  }
}
