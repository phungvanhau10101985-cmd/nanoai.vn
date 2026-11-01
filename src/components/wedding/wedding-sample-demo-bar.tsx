'use client'

import { useEffect, useRef } from 'react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

/** Gắn src sau khi khung đã vào trang. Iframe trong hộp thoại có transform dễ kẹt about:blank nếu src có từ lúc tạo. */
export function WeddingSampleDemoFrame(props: { sampleId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    const src = `/thiep-mau/${encodeURIComponent(props.sampleId)}?embed=1`
    frame.src = src
    const timer = window.setTimeout(() => {
      try {
        if (frame.contentWindow?.location.href === 'about:blank') frame.contentWindow.location.replace(src)
      } catch {
        /* khung khác origin thì src đã đủ */
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [props.sampleId])
  return <iframe ref={ref} title={props.title} className="min-h-0 w-full flex-1 border-0 bg-[#fffaf2]" />
}

function editorHref(extra: Record<string, string>) {
  const params = new URLSearchParams()
  const cardId = new URLSearchParams(window.location.search).get('cardId')?.trim() || ''
  if (cardId) params.set('cardId', cardId)
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  const query = params.toString()
  return query ? `/tao-thiep-moi-cuoi-ai?${query}` : '/tao-thiep-moi-cuoi-ai'
}

export function WeddingSampleDemoBar(props: { sampleId: string; embed: boolean }) {
  const tx = getDictionary(readWebLocaleFromDocumentCookie()).weddingCardAiImage
  const exit = () => {
    if (props.embed && window.parent !== window) {
      window.parent.postMessage({ type: 'wedding-sample-exit' }, window.location.origin)
      return
    }
    window.location.assign(editorHref({ openSamples: '1' }))
  }
  const useSample = () => {
    if (props.embed && window.parent !== window) {
      window.parent.postMessage({ type: 'wedding-sample-use', id: props.sampleId }, window.location.origin)
      return
    }
    window.location.assign(editorHref({ useSample: props.sampleId }))
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/95 p-1 shadow-lg">
        <button
          type="button"
          className="h-8 rounded-full px-3 text-xs font-semibold text-neutral-700"
          onClick={exit}
        >
          {tx.sampleCardExit}
        </button>
        <button
          type="button"
          className="h-8 rounded-full bg-rose-700 px-3.5 text-xs font-semibold text-white"
          onClick={useSample}
        >
          {tx.sampleCardUse}
        </button>
      </div>
    </div>
  )
}
