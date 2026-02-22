'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const FEATURE_ROUTES = [
  '/thu-do-online',
  '/phuc-dung-anh',
  '/lam-net-anh',
  '/lam-dep-anh',
  '/ghep-anh',
  '/tao-banner',
  '/tao-anh-the',
  '/thiet-ke-logo',
  '/ke-chuyen-bang-hinh-anh',
  '/tao-nhan-gian',
  '/che-anh',
  '/xoa-vat-the',
  '/thay-nen-san-pham',
  '/tao-anh-3d',
  '/tao-mo-hinh-3d-tu-anh',
  '/thiet-ke-noi-ngoai-that',
  '/xay-nha-tu-dat-nen',
  '/tao-anh-chain-dung',
  '/mo-rong-khung-hinh',
  '/hoan-doi-khuon-mat',
  '/dich-anh-tai-lieu',
]

function track(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params)
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const pagePath = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`
    track('page_view', {
      page_path: pagePath,
      page_title: document.title,
    })
  }, [pathname, searchParams])

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
          const matchedFeature = FEATURE_ROUTES.find((route) => url.pathname.startsWith(route))
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
