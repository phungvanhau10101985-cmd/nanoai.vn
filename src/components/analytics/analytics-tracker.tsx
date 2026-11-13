'use client'

import { useEffect } from 'react'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import { syncPlatformMetaAdvancedMatching } from '@/lib/tracking/platform-meta-advanced-matching-client'
import { nanoAiFeatureRemarketing } from '@/lib/catalog/nanoai-feature-remarketing'
import { isFeatureCartAction, languageCartRouteForLocation } from '@/lib/tracking/nanoai-platform-commerce'
import {
  broadcastNanoAiCommerce,
  flushPlatformPurchaseCookie,
} from '@/lib/tracking/nanoai-platform-commerce-client'
import { trackNanoAiFeatureView } from '@/lib/tracking/feature-remarketing-client'
import { fireNanoAiDynamicRemarketingPageView } from '@/lib/tracking/nanoai-platform-dynamic-remarketing-client'
import { readNanoAiFacebookSearchString } from '@/lib/tracking/nanoai-facebook-dynamic-events'
import { fireNanoAiFacebookDynamicEvent } from '@/lib/tracking/nanoai-facebook-dynamic-events-client'
import { trackWeddingViewContent } from '@/lib/tracking/wedding-commerce-client'
import { WEDDING_COMMERCE_PATH } from '@/lib/wedding/wedding-commerce-events'
import { isPathMatchedByFeatureRoute } from '@/lib/catalog/nanoai-feature-catalog-id'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    __nanoPlatformGaId?: string
    __nanoMetaLastViewContentKey?: string
    __nanoMetaLastViewContentAt?: number
    __nanoCartClickAt?: Record<string, number>
  }
}

const FEATURE_ROUTES = [
  '/tao-giao-trinh',
  '/giao-trinh',
  '/tao-bai-thi',
  '/tao-bai-tap-ve-nha',
  '/ho-tro-lam-bai',
  '/gia-su-ai',
  '/lop',
  '/hoc-tieng-anh-ai',
  '/hoc-tieng-viet',
  '/hoc-tieng-trung',
  '/hoc-tieng-nhat',
  '/hoc-tieng-han',
  '/ghi-am-bao-cao-cuoc-hop',
  '/thu-do-online',
  '/phuc-dung-anh',
  '/lam-net-anh',
  '/lam-dep-anh',
  '/ghep-anh',
  '/tao-banner',
  '/tao-anh-ban-hang',
  '/tao-thiep-moi-cuoi-ai',
  '/tao-anh-tu-chu',
  '/du-anh-tu-phac-thao',
  '/tao-infographic-tu-sach',
  '/tao-anh-the',
  '/thiet-ke-logo',
  '/ke-chuyen-bang-hinh-anh',
  '/tao-nhan-gian',
  '/tao-nhan-gioi-thieu-san-pham',
  '/tao-tem-niem-phong-bao-hanh',
  '/thiet-ke-con-dau',
  '/thiet-ke-bao-bi',
  '/tao-ma-vach',
  '/che-anh',
  '/xoa-vat-the',
  '/xoa-nen-png',
  '/thay-nen-san-pham',
  '/sua-anh-theo-yeu-cau',
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
  const pathname = window.location.pathname || '/'
  const pagePath = `${pathname}${window.location.search}`
  const gaId = String(window.__nanoPlatformGaId || '').trim()
  track('page_view', {
    page_path: pagePath,
    page_title: document.title,
    ...(gaId ? { send_to: gaId } : {}),
  })
  const matched = findMatchedFeatureRoute(pathname)
  fireNanoAiDynamicRemarketingPageView(pathname, matched)
  const searchString = readNanoAiFacebookSearchString(window.location.search || '')
  if (searchString) {
    const feature = matched ? nanoAiFeatureRemarketing(matched) : null
    fireNanoAiFacebookDynamicEvent({
      event: 'Search',
      contentId: feature?.contentId || '',
      contentName: searchString,
      valueVnd: feature?.valueVnd || 0,
      searchString,
      skipDedupe: true,
    })
  }
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
  if (matched === WEDDING_COMMERCE_PATH) {
    const path = window.location.pathname || '/'
    if (path !== WEDDING_COMMERCE_PATH) return
    trackWeddingViewContent()
    return
  }
  const contentName = document.title?.trim().slice(0, 200) || matched
  trackNanoAiFeatureView(matched, contentName)
}

function cartRouteForCurrentPage(): string | null {
  const path = window.location.pathname || '/'
  return languageCartRouteForLocation(path, window.location.search || '') || findMatchedFeatureRoute(path)
}

function controlLabel(control: HTMLElement): string {
  return (control.textContent || control.getAttribute('aria-label') || control.getAttribute('value') || '').trim()
}

function rememberFeatureCart(route: string, label: string) {
  const cartKey = `${route}|${label.slice(0, 40).toLowerCase()}`
  const now = Date.now()
  const lastMap = window.__nanoCartClickAt || {}
  if (now - (lastMap[cartKey] || 0) < 1200) return
  lastMap[cartKey] = now
  window.__nanoCartClickAt = lastMap
  const { contentId, valueVnd } = nanoAiFeatureRemarketing(route)
  broadcastNanoAiCommerce({
    event: 'AddToCart',
    contentId,
    contentName: label.slice(0, 200) || route,
    valueVnd,
    skipDedupe: true,
    extra: { feature_route: route },
  })
}

/** Thiệp và lớp học không tính lúc bấm. Thiệp chỉ khi tạo thiệp thành công. */
function rememberFeatureCartClick(control: HTMLElement | null) {
  if (!control || control.getAttribute('data-nano-cart') === '0') return
  const route = cartRouteForCurrentPage()
  if (!route || route === WEDDING_COMMERCE_PATH || route === '/lop') return
  const label = controlLabel(control)
  const explicit = control.getAttribute('data-nano-cart') === '1'
  if (!explicit && !isFeatureCartAction(route, label)) return
  rememberFeatureCart(route, label || route)
}

function rememberStudySendOnEnter(evt: KeyboardEvent) {
  if (evt.key !== 'Enter' || evt.shiftKey || evt.altKey || evt.ctrlKey || evt.metaKey) return
  const target = evt.target as HTMLElement | null
  const form = target?.closest('form')
  if (!form) return
  const route = cartRouteForCurrentPage()
  if (route !== '/ho-tro-lam-bai' && route !== '/gia-su-ai') return
  const send = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (!send || send.disabled || send.getAttribute('data-nano-cart') === '0') return
  const label = (send.getAttribute('aria-label') || send.textContent || '').trim()
  if (!isFeatureCartAction(route, label)) return
  rememberFeatureCart(route, label)
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
    let cancelled = false
    void (async () => {
      await syncPlatformMetaAdvancedMatching()
      if (cancelled) return
      handleMetaSignupFlagsFromUrl()
      fireMetaFeatureViewContent()
    })()
    firePageView()
    flushPlatformPurchaseCookie()
    const origFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const response = await origFetch(...args)
      flushPlatformPurchaseCookie()
      return response
    }
    const unsubscribe = subscribeToUrlChanges(() => {
      firePageView()
      fireMetaFeatureViewContent()
      flushPlatformPurchaseCookie()
    })
    return () => {
      cancelled = true
      window.fetch = origFetch
      unsubscribe()
    }
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
            const { contentId, valueVnd } = nanoAiFeatureRemarketing(matchedFeature)
            const viewKey = `${matchedFeature}|${url.pathname}|`
            window.__nanoMetaLastViewContentKey = viewKey
            window.__nanoMetaLastViewContentAt = Date.now()
            broadcastNanoAiCommerce({
              event: 'ViewContent',
              contentId,
              contentName: link.textContent?.trim().slice(0, 200) || matchedFeature,
              valueVnd,
              skipDedupe: true,
              extra: { feature_route: matchedFeature },
            })
          }
        }
      }

      const wishlist = target.closest<HTMLElement>('[data-nano-wishlist="1"]')
      if (wishlist) {
        const featureRoute = findMatchedFeatureRoute(window.location.pathname || '/')
        if (featureRoute) {
          const { contentId, valueVnd } = nanoAiFeatureRemarketing(featureRoute)
          const label = (wishlist.textContent || wishlist.getAttribute('aria-label') || featureRoute).trim()
          fireNanoAiFacebookDynamicEvent({
            event: 'AddToWishlist',
            contentId,
            contentName: label.slice(0, 200) || featureRoute,
            valueVnd,
            dedupeKey: `wishlist_${contentId}`,
          })
        }
      }

      const control = target.closest<HTMLElement>('button, input[type="submit"]')
      rememberFeatureCartClick(control)

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
    document.addEventListener('keydown', rememberStudySendOnEnter, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('change', onChange, true)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', rememberStudySendOnEnter, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('change', onChange, true)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
