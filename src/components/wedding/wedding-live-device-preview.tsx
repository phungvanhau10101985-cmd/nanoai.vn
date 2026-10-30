'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { WeddingOrnamentPreviewTools } from '@/components/wedding/wedding-ornament-admin'

import { weddingDesignWidth, type WeddingDesignDevice } from '@/lib/wedding/wedding-design-viewport'
import {
  WEDDING_PREVIEW_LOOK_MESSAGE,
  WEDDING_PREVIEW_READY_MESSAGE,
  type WeddingPreviewLook,
} from '@/lib/wedding/wedding-preview-look'
import type { WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'

function DeviceFrame(props: {
  title: string
  src: string
  width: number
  onFrame?: (frame: HTMLIFrameElement | null) => void
  onLoad?: (frame: HTMLIFrameElement) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const onFrameRef = useRef(props.onFrame)
  const onLoadRef = useRef(props.onLoad)
  onFrameRef.current = props.onFrame
  onLoadRef.current = props.onLoad
  const setFrameNode = useCallback((node: HTMLIFrameElement | null) => {
    frameRef.current = node
    onFrameRef.current?.(node)
  }, [])
  const [scale, setScale] = useState(0.3)
  const [height, setHeight] = useState(1800)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => setScale(box.clientWidth / props.width)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [props.width])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const publish = () => frame.contentWindow?.postMessage({ type: 'wedding-ornament-ui-scale', scale }, window.location.origin)
    publish()
    frame.addEventListener('load', publish)
    const timer = window.setInterval(publish, 500)
    const onNeed = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return
      if (event.data?.type === 'wedding-ornament-need-scale') publish()
    }
    window.addEventListener('message', onNeed)
    return () => {
      frame.removeEventListener('load', publish)
      window.clearInterval(timer)
      window.removeEventListener('message', onNeed)
    }
  }, [scale])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const read = () => {
      const doc = frame.contentDocument
      const root = doc?.documentElement
      if (!doc || !root) return
      const cover = doc.querySelector('[data-cover-preview]')
      const letter = doc.querySelector('main')
      const target = cover instanceof HTMLElement ? cover : letter instanceof HTMLElement ? letter : null
      const height = target
        ? Math.ceil(target.getBoundingClientRect().height)
        : Math.max(root.scrollHeight, doc.body?.scrollHeight || 0)
      if (height > 240) setHeight((current) => (Math.abs(current - height) < 8 ? current : height))
    }
    read()
    frame.addEventListener('load', read)
    const timer = window.setInterval(read, 800)
    return () => {
      frame.removeEventListener('load', read)
      window.clearInterval(timer)
    }
  }, [props.src])

  return (
    <div>
      <div ref={boxRef} className="relative w-full overflow-hidden rounded-2xl border bg-white" style={{ height: Math.max(240, Math.round(height * scale)) }}>
        <iframe
          ref={setFrameNode}
          title={props.title}
          src={props.src}
          scrolling="no"
          className="absolute left-0 top-0 border-0 bg-white"
          style={{ width: props.width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onLoad={(event) => onLoadRef.current?.(event.currentTarget)}
        />
      </div>
    </div>
  )
}

export function WeddingLiveDevicePreviews(props: {
  slug: string
  guestName: string
  letterView: 'groom' | 'bride'
  editable: boolean
  locale: WebLocale
  desktopLabel: string
  mobileLabel: string
  coverLabel: string
  letterLabel: string
  hint: string
  refreshLabel: string
  /** Nền và giao diện cột trái đang chọn. Đổi thì cột phải áp ngay, không đợi tải lại trang. */
  look: WeddingPreviewLook
  lookToken: string
  showReset?: boolean
  onOrnamentsSaved?: (ornaments: WeddingBackgroundOrnament[] | null) => void
}) {
  const [revision, setRevision] = useState(0)
  const [device, setDevice] = useState<WeddingDesignDevice>('mobile')
  const [coverFrame, setCoverFrame] = useState<HTMLIFrameElement | null>(null)
  const [letterFrame, setLetterFrame] = useState<HTMLIFrameElement | null>(null)
  const lookRef = useRef(props.look)
  lookRef.current = props.look
  const postLook = useCallback((frame: HTMLIFrameElement | null) => {
    const win = frame?.contentWindow
    if (!win) return
    try {
      win.postMessage({ type: WEDDING_PREVIEW_LOOK_MESSAGE, ...lookRef.current }, window.location.origin)
    } catch {
      /* iframe chưa tới đúng origin thì lần sau gửi lại */
    }
  }, [])
  const venue = props.letterView === 'bride' ? 'bride_home' : 'groom_home'
  const query = new URLSearchParams({
    demo: '1',
    view: props.letterView,
    venue,
    guest: props.guestName,
    layout: 'full',
  })
  if (props.editable) query.set('ornamentEdit', '1')
  query.set('device', device)
  query.set('rev', String(revision))
  const width = weddingDesignWidth(device)
  const deviceLabel = device === 'desktop' ? props.desktopLabel : props.mobileLabel
  const coverQuery = new URLSearchParams(query)
  coverQuery.set('stack', 'cover')
  const letterQuery = new URLSearchParams(query)
  letterQuery.set('stack', 'letter')
  const coverSrc = `/thiep-moi-cuoi/${encodeURIComponent(props.slug)}?${coverQuery.toString()}`
  const letterSrc = `/thiep-moi-cuoi/${encodeURIComponent(props.slug)}?${letterQuery.toString()}`

  useEffect(() => {
    const send = () => {
      postLook(coverFrame)
      postLook(letterFrame)
    }
    send()
    // Trang thiệp trong khung tải chậm hơn lần gửi đầu. Gửi lại cho tới khi bộ nghe bên trong đã áp nền.
    const timers = [200, 700, 1500, 3000, 6000, 10000].map((ms) => window.setTimeout(send, ms))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [coverFrame, letterFrame, postLook, props.lookToken])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; device?: string; ornaments?: unknown; cleared?: boolean }
      if (data?.type === WEDDING_PREVIEW_READY_MESSAGE) {
        const source = event.source as Window | null
        let sourceFrame: Element | null = null
        try {
          sourceFrame = source?.frameElement ?? null
        } catch {
          sourceFrame = null
        }
        if (source === coverFrame?.contentWindow || sourceFrame === coverFrame) postLook(coverFrame)
        else if (source === letterFrame?.contentWindow || sourceFrame === letterFrame) postLook(letterFrame)
        else {
          postLook(coverFrame)
          postLook(letterFrame)
        }
        return
      }
      if (data?.type !== 'wedding-ornament-saved') return
      if (data.cleared) props.onOrnamentsSaved?.(null)
      else if (Array.isArray(data.ornaments)) props.onOrnamentsSaved?.(data.ornaments as WeddingBackgroundOrnament[])
      const fromCover = event.source === coverFrame?.contentWindow
      const fromLetter = event.source === letterFrame?.contentWindow
      if (!fromCover && !fromLetter) return
      const target = fromCover ? letterFrame : coverFrame
      target?.contentWindow?.postMessage(
        { type: 'wedding-ornament-apply', device: data.device, ornaments: data.ornaments, cleared: data.cleared },
        window.location.origin,
      )
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [coverFrame, letterFrame, postLook, props.onOrnamentsSaved])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label={props.desktopLabel}>
          {(['mobile', 'desktop'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={device === id}
              className={device === id ? 'h-8 rounded-md bg-neutral-900 px-3 text-xs font-semibold text-white' : 'h-8 rounded-md border bg-white px-3 text-xs'}
              onClick={() => setDevice(id)}
            >
              {id === 'desktop' ? props.desktopLabel : props.mobileLabel}
            </button>
          ))}
        </div>
        <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs" onClick={() => setRevision((value) => value + 1)}>
          {props.refreshLabel}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{props.hint}</p>
      <section className="space-y-2">
        <p className="text-sm font-semibold">{props.coverLabel}</p>
        {props.editable ? <WeddingOrnamentPreviewTools locale={props.locale} surface="cover" frame={coverFrame} showReset={props.showReset} /> : null}
        <DeviceFrame key={`cover-${device}`} title={`${props.coverLabel} · ${deviceLabel}`} src={coverSrc} width={width} onFrame={setCoverFrame} onLoad={postLook} />
      </section>
      <section className="space-y-2">
        <p className="text-sm font-semibold">{props.letterLabel}</p>
        {props.editable ? <WeddingOrnamentPreviewTools locale={props.locale} surface="letter" frame={letterFrame} showReset={props.showReset} /> : null}
        <DeviceFrame key={`letter-${device}`} title={`${props.letterLabel} · ${deviceLabel}`} src={letterSrc} width={width} onFrame={setLetterFrame} onLoad={postLook} />
      </section>
    </div>
  )
}
