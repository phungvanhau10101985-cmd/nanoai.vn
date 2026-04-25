'use client'

import { useEffect } from 'react'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import { isPathMatchedByFeatureRoute, toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    __nanoMetaLastViewContentKey?: string
    __nanoMetaLastViewContentAt?: number
  }
}

const FEATURE_ROUTES = [
  '/tao-giao-trinh',
  '/giao-trinh',
  '/tao-bai-thi',
  '/tao-bai-tap-ve-nha',
  '/lop',
  '/hoc-tieng-anh-ai',
  '/ghi-am-bao-cao-cuoc-hop',
  '/thu-do-online',
  '/phuc-dung-anh',
  '/lam-net-anh',
  '/lam-dep-anh',
  '/ghep-anh',
  '/tao-banner',
  '/tao-anh-tu-chu',
  '/du-anh-tu-phac-thao',
  '/tao-infographic-tu-sach',
  '/tao-anh-the',
  '/thiet-ke-logo',
  '/ke-chuyen-bang-hinh-anh',
  '/tao-nhan-gian',
  '/tao-nhan-gioi-thieu-san-pham',
  '/tao-tem-niem-phong-bao-hanh',
  '/thiet-ke-bao-bi',
  '/tao-ma-vach',
  '/che-anh',
  '/xoa-vat-the',
  '/xoa-nen-png',
  '/thay-nen-san-pham',
  '/tao-anh-3d',
  '/tao-mo-hinh-3d-tu-anh',
  '/thiet-ke-noi-ngoai-that',
  '/xay-nha-tu-dat-nen',
  '/tao-anh-chain-dung',
  '/mo-rong-khung-hinh',
  '/hoan-doi-khuon-mat',
  '/dich-anh-tai-lieu',
  '/tao-bai-hat-lyria-3',
]

function findMatchedFeatureRoute(pathname: string): string | null {
  for (const route of FEATURE_ROUTES) {
    if (isPathMatchedByFeatureRoute(pathname, route)) return route
  }
  return null
}

function track(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (isLikelyBotTraffic()) return
  window.gtag('event', eventName, params)
}

function firePageView() {
  if (typeof window === 'undefined') return
  const pagePath = `${window.location.pathname}${window.location.search}`
  track('page_view', {
    page_path: pagePath,
    page_title: document.title,
  })
}

function fireMetaFeatureViewContent() {
  if (typeof window === 'undefined') return
  if (isLikelyBotTraffic()) return
  if (window.top !== window.self) return
  const matched = findMatchedFeatureRoute(window.location.pathname || '/')
  if (!matched) return
  const viewKey = `${matched}|${window.location.pathname || '/'}|${window.location.search || ''}`
  const now = Date.now()
  const prevKey = window.__nanoMetaLastViewContentKey || ''
  const prevAt = Number(window.__nanoMetaLastViewContentAt || 0)
  if (prevKey === viewKey && now - prevAt < 5000) return
  window.__nanoMetaLastViewContentKey = viewKey
  window.__nanoMetaLastViewContentAt = now
  const contentId = toNanoAiFeatureCatalogIdFromHref(matched)
  const contentName = document.title?.trim().slice(0, 200) || matched
  fireMetaStandardEvent('ViewContent', {
    skipDedupe: true,
    customData: {
      content_type: 'product',
      content_category: 'ai_feature',
      content_ids: [contentId],
      content_name: contentName,
      feature_route: matched,
    },
  })
}

function handleMetaSignupFlagsFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const hasCompleteRegistration = url.searchParams.get('meta_complete_registration') === '1'
  if (!hasCompleteRegistration) return
  if (hasCompleteRegistration) {
    fireMetaStandardEvent('CompleteRegistration', { dedupeKey: 'auth_new_user_complete_registration' })
    url.searchParams.delete('meta_complete_registration')
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', nextUrl)
}

/**
 * Không dùng `usePathname` / Suspense — Next có thể chèn `<input>` và gây lỗi hydrate.
 * Theo dõi đổi route qua popstate + hook history (App Router dùng pushState).
 */
export function AnalyticsTracker() {
  useEffect(() => {
    firePageView()
    fireMetaFeatureViewContent()
    handleMetaSignupFlagsFromUrl()
    return subscribeToUrlChanges(() => {
      firePageView()
      fireMetaFeatureViewContent()
    })
  }, [])

  useEffect(() => {
    const onClick = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement | null
      if (!target) return

      const trackedElement = target.closest<HTMLElement>('[data-track]')
      if (trackedElement) {
        const eventName = trackedElement.dataset.track || 'custom_click'
        track(eventName, {
          route: window.location.pathname,
          label: trackedElement.dataset.trackLabel || trackedElement.textContent?.trim()?.slice(0, 60) || '',
        })
      }

      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (link?.href) {
        const url = new URL(link.href, window.location.origin)
        const isInternal = url.origin === window.location.origin
        track('navigation_click', {
          route: window.location.pathname,
          destination: isInternal ? url.pathname : url.href,
          is_internal: isInternal,
        })

        if (isInternal) {
          const matchedFeature = findMatchedFeatureRoute(url.pathname)
          if (matchedFeature) {
            track('feature_open', { feature_route: matchedFeature, from_route: window.location.pathname })
          }
        }
      }

      const button = target.closest<HTMLButtonElement>('button')
      if (button) {
        const label = (button.textContent || '').trim().toLowerCase()
        if (/(thử đồ|phục dựng|làm nét|làm đẹp|tạo|dịch|nạp|download|tải)/i.test(label)) {
          track('cta_click', {
            route: window.location.pathname,
            cta_label: label.slice(0, 80),
          })
        }
      }
    }

    const onSubmit = () => {
      track('form_submit', { route: window.location.pathname })
    }

    const onChange = (evt: Event) => {
      const input = evt.target as HTMLInputElement | null
      if (!input || input.type !== 'file' || !input.files) return
      track('file_upload_selected', {
        route: window.location.pathname,
        file_count: input.files.length,
      })
    }

    const onError = (evt: ErrorEvent) => {
      track('client_exception', {
        route: window.location.pathname,
        message: evt.message?.slice(0, 200) || 'unknown',
      })
    }

    const onUnhandledRejection = (evt: PromiseRejectionEvent) => {
      const reason = typeof evt.reason === 'string' ? evt.reason : (evt.reason?.message || 'unknown')
      track('client_promise_rejection', {
        route: window.location.pathname,
        reason: String(reason).slice(0, 200),
      })
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('change', onChange, true)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('change', onChange, true)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
