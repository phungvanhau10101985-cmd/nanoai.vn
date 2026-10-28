'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { useToast } from '@/hooks/use-toast'
import { uploadWeddingOrnamentImage } from '@/app/tao-thiep-moi-cuoi-ai/actions'
import { weddingOrnamentBlurPx, weddingOrnamentFadeAmount, weddingOrnamentFrameStyle, weddingOrnamentImageStyle, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { isWeddingOrnamentImageSrc, WEDDING_ORNAMENT_CATALOG } from '@/lib/wedding/wedding-background-ornament-store'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { pickOrnamentHit, rememberOrnamentPixels } from '@/lib/wedding/wedding-ornament-hit'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type WeddingOrnamentSurface = 'cover' | 'letter'

const BLUR_STEPS = [0, 2, 4, 8, 12]
const FADE_STEPS = [0, 0.25, 0.5, 0.75, 1]

function stepAmount(steps: readonly number[], current: number, direction: 1 | -1) {
  let nearest = 0
  let best = Number.POSITIVE_INFINITY
  steps.forEach((step, index) => {
    const gap = Math.abs(step - current)
    if (gap < best) {
      best = gap
      nearest = index
    }
  })
  return steps[Math.min(steps.length - 1, Math.max(0, nearest + direction))]
}

function wrapRotate(value: number) {
  let next = Math.round(value) % 360
  if (next > 180) next -= 360
  if (next < -180) next += 360
  return next
}

export function WeddingOrnamentAdminLayer(props: {
  ornaments: readonly WeddingBackgroundOrnament[]
  editable?: boolean
  className?: string
  zoomInLabel?: string
  zoomOutLabel?: string
  rotateLeftLabel?: string
  rotateRightLabel?: string
  blurLabel?: string
  fadeLabel?: string
  deleteLabel?: string
  frameLines?: boolean
  surface?: WeddingOrnamentSurface
  onChange?: (next: WeddingBackgroundOrnament[]) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [uiScale, setUiScale] = useState(1)
  const [compactFrame, setCompactFrame] = useState(() => typeof window !== 'undefined' && window.innerWidth < 800)
  const layerRef = useRef<HTMLDivElement>(null)
  const ornamentsRef = useRef(props.ornaments)
  const onChangeRef = useRef(props.onChange)
  const selectedRef = useRef<number | null>(null)
  ornamentsRef.current = props.ornaments
  onChangeRef.current = props.onChange

  const choose = (index: number | null) => {
    selectedRef.current = index
    setSelected(index)
  }

  useEffect(() => {
    if (!props.surface || !props.editable) return
    const item = selected == null ? null : props.ornaments[selected]
    window.parent.postMessage(
      {
        type: 'wedding-ornament-selection',
        surface: props.surface,
        index: selected,
        w: item?.w ?? null,
        rotate: item?.rotate ?? 0,
      },
      window.location.origin,
    )
  }, [props.editable, props.ornaments, props.surface, selected])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; scale?: number }
      if (data?.type !== 'wedding-ornament-ui-scale' || typeof data.scale !== 'number' || data.scale < 0.05) return
      setUiScale(data.scale)
    }
    const applyFrame = () => setCompactFrame(window.innerWidth < 800)
    applyFrame()
    window.parent.postMessage({ type: 'wedding-ornament-need-scale' }, window.location.origin)
    window.addEventListener('message', onMessage)
    window.addEventListener('resize', applyFrame)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('resize', applyFrame)
    }
  }, [])

  useEffect(() => {
    if (!props.surface || !props.editable) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; surface?: string; action?: string; src?: string; delta?: number }
      if (!data || data.type !== 'wedding-ornament-command' || data.surface !== props.surface) return
      const items = ornamentsRef.current
      const onChange = onChangeRef.current
      if (!onChange) return
      if (data.action === 'add' && typeof data.src === 'string') {
        onChange([...items, { src: data.src, x: 8, y: 8, w: 28 }])
        choose(items.length)
        return
      }
      const index = selectedRef.current
      if (index == null || !items[index]) return
      if (data.action === 'resize') {
        const w = Math.min(90, Math.max(8, Math.round((items[index].w + (Number(data.delta) || 0)) * 10) / 10))
        onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, w } : item)))
      } else if (data.action === 'rotate') {
        const rotate = wrapRotate((items[index].rotate ?? 0) + (Number(data.delta) || 0))
        onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, rotate } : item)))
      } else if (data.action === 'delete') {
        onChange(items.filter((_, itemIndex) => itemIndex !== index))
        choose(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [props.editable, props.surface])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !props.editable) return
    const remember = (img: HTMLImageElement) => {
      if (img.complete) rememberOrnamentPixels(img)
    }
    const images = [...layer.querySelectorAll<HTMLImageElement>('img[data-ornament-index]')]
    const onLoad = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) remember(event.currentTarget)
    }
    images.forEach((img) => {
      remember(img)
      img.addEventListener('load', onLoad)
    })
    return () => images.forEach((img) => img.removeEventListener('load', onLoad))
  }, [props.editable, props.ornaments])

  useEffect(() => {
    if (!props.editable) return
    const layer = layerRef.current
    const marked = layer?.closest('[data-wedding-stage]')
    const stage = marked ?? layer?.parentElement
    if (!layer || !(stage instanceof HTMLElement)) return
    if (marked) marked.setAttribute('data-ornament-editing', '')
    const startDrag = (index: number, event: PointerEvent) => {
      const items = ornamentsRef.current
      const item = items[index]
      const onChange = onChangeRef.current
      const bounds = layer.getBoundingClientRect()
      if (!item || !onChange || bounds.width < 1 || bounds.height < 1) return
      choose(index)
      const startX = event.clientX
      const startY = event.clientY
      const originX = item.x
      const originY = item.y
      const bottom = item.anchor === 'bottom'
      const move = (ev: PointerEvent) => {
        const dx = ((ev.clientX - startX) / bounds.width) * 100
        const dy = ((ev.clientY - startY) / bounds.height) * 100
        const current = ornamentsRef.current
        if (!current[index]) return
        onChangeRef.current?.(
          current.map((entry, itemIndex) =>
            itemIndex === index
              ? {
                  ...entry,
                  x: Math.round((originX + dx) * 10) / 10,
                  y: Math.round((originY + (bottom ? -dy : dy)) * 10) / 10,
                }
              : entry,
          ),
        )
      }
      const up = () => {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', up)
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', up)
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('button, input, textarea, select, a, [data-ornament-tools], [data-wedding-file-anchor], [data-stack-move], [data-wedding-frame-tools]')
      ) {
        return
      }
      const picked = pickOrnamentHit(layer, event.clientX, event.clientY)
      if (picked == null) return
      event.preventDefault()
      event.stopPropagation()
      startDrag(picked, event)
    }
    const onMove = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('button, input, textarea, select, a, [data-ornament-tools], [data-wedding-file-anchor]')
      ) {
        stage.style.cursor = ''
        return
      }
      stage.style.cursor = pickOrnamentHit(layer, event.clientX, event.clientY) == null ? '' : 'grab'
    }
    stage.addEventListener('pointerdown', onDown, true)
    stage.addEventListener('pointermove', onMove)
    return () => {
      if (marked) marked.removeAttribute('data-ornament-editing')
      stage.style.cursor = ''
      stage.removeEventListener('pointerdown', onDown, true)
      stage.removeEventListener('pointermove', onMove)
    }
  }, [props.editable])

  if (!props.editable) {
    return <WeddingBackgroundOrnamentLayer ornaments={props.ornaments} className={props.className} />
  }
  const update = (index: number, patch: Partial<WeddingBackgroundOrnament>) => {
    props.onChange?.(props.ornaments.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }
  const picked = selected == null ? null : props.ornaments[selected] ?? null
  const frameWidth = typeof window === 'undefined' ? (compactFrame ? 390 : 1440) : window.innerWidth
  const shownWidth = frameWidth * uiScale
  const target = compactFrame
    ? Math.min(34, Math.max(26, shownWidth * 0.085))
    : Math.min(40, Math.max(28, shownWidth * 0.062))
  const controlScale = Math.min(6, Math.max(0.4, target / 44 / Math.max(uiScale, 0.05)))
  return (
    <>
    <div ref={layerRef} className={cn('pointer-events-none absolute inset-0 overflow-visible', props.className)} style={{ zIndex: 36 }}>
      {props.ornaments.map((item, index) => {
        const active = selected === index
        return (
          <div
            key={`${item.src}-${index}`}
            data-ornament-hit=""
            className="pointer-events-none absolute"
            style={{
              ...weddingOrnamentFrameStyle(item),
              zIndex: active ? 2 : 1,
            }}
          >
            <img
              src={item.src}
              alt=""
              draggable={false}
              data-ornament-index={index}
              className={cn('pointer-events-none block w-full max-w-none select-none', active && 'cursor-grabbing')}
              style={{
                ...weddingOrnamentImageStyle(item),
                outline: props.frameLines === false ? 'none' : active ? '3px solid #e11d48' : '2px dashed rgba(225,29,72,0.85)',
                outlineOffset: props.frameLines === false ? 0 : 3,
              }}
            />
          </div>
        )
      })}
    </div>
    {picked && selected != null && props.frameLines !== false ? (
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 80 }}>
        <div
          className="pointer-events-none absolute"
          style={weddingOrnamentFrameStyle(picked)}
        >
          <img src={picked.src} alt="" draggable={false} className="invisible block w-full" />
          <div
            data-ornament-tools=""
            className="pointer-events-auto absolute left-1/2 top-full mt-1 flex w-max flex-col gap-1 rounded-xl border border-rose-200 bg-white/95 p-1 shadow-lg"
            style={{ transform: `translateX(-50%) scale(${controlScale})`, transformOrigin: 'top center' }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex gap-1">
              <button type="button" aria-label={props.zoomInLabel} className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-700 text-white" onClick={() => update(selected, { w: Math.min(90, Math.round((picked.w + 6) * 10) / 10) })}>
                <ZoomIn className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.zoomOutLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { w: Math.max(8, Math.round((picked.w - 6) * 10) / 10) })}>
                <ZoomOut className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.rotateLeftLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { rotate: wrapRotate((picked.rotate ?? 0) - 15) })}>
                <RotateCcw className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.rotateRightLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { rotate: wrapRotate((picked.rotate ?? 0) + 15) })}>
                <RotateCw className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label={props.deleteLabel}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700"
                onClick={() => {
                  props.onChange?.(props.ornaments.filter((_, itemIndex) => itemIndex !== selected))
                  choose(null)
                }}
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>
            <OrnamentEffectRow
              label={props.blurLabel || ''}
              value={`${weddingOrnamentBlurPx(picked.blur)}`}
              onDecrease={() => {
                const next = stepAmount(BLUR_STEPS, weddingOrnamentBlurPx(picked.blur), -1)
                update(selected, { blur: next || undefined })
              }}
              onIncrease={() => {
                const next = stepAmount(BLUR_STEPS, weddingOrnamentBlurPx(picked.blur), 1)
                update(selected, { blur: next || undefined })
              }}
            />
            <OrnamentEffectRow
              label={props.fadeLabel || ''}
              value={`${Math.round(weddingOrnamentFadeAmount(picked.fade) * 100)}%`}
              onDecrease={() => {
                const next = stepAmount(FADE_STEPS, weddingOrnamentFadeAmount(picked.fade), -1)
                update(selected, { fade: next || undefined })
              }}
              onIncrease={() => {
                const next = stepAmount(FADE_STEPS, weddingOrnamentFadeAmount(picked.fade), 1)
                update(selected, { fade: next || undefined })
              }}
            />
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

function OrnamentEffectRow(props: { label: string; value: string; onDecrease: () => void; onIncrease: () => void }) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-lg bg-stone-50 px-1 text-stone-800">
      <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium">{props.label}</span>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border bg-white text-base leading-none" aria-label={props.label} onClick={props.onDecrease}>
        −
      </button>
      <span className="w-9 text-center text-xs font-semibold tabular-nums">{props.value}</span>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border bg-white text-base leading-none" aria-label={props.label} onClick={props.onIncrease}>
        +
      </button>
    </div>
  )
}

function OrnamentPickerDialog(props: {
  locale: WebLocale
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (src: string) => void
  uploading?: boolean
  onUploadClick?: () => void
  link?: string
  onLinkChange?: (value: string) => void
  onAddLink?: () => void
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.ornamentAdminAdd}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {WEDDING_ORNAMENT_CATALOG.map((piece) => (
            <button
              key={piece.src}
              type="button"
              className="rounded-xl border bg-white p-2 text-center hover:border-rose-400"
              onClick={() => {
                props.onPick(piece.src)
                props.onOpenChange(false)
              }}
            >
              <img src={piece.src} alt="" className="mx-auto h-16 w-full object-contain" />
              <span className="mt-1 block text-[11px] leading-tight">{piece.label[props.locale] ?? piece.label.en}</span>
            </button>
          ))}
        </div>
        {props.onUploadClick || props.onAddLink ? (
          <div className="space-y-2 border-t pt-3">
            {props.onUploadClick ? (
              <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs" disabled={props.uploading} onClick={props.onUploadClick}>
                {tx.ornamentAdminUpload}
              </button>
            ) : null}
            {props.onAddLink && props.onLinkChange ? (
              <div className="flex gap-2">
                <input
                  value={props.link ?? ''}
                  onChange={(event) => props.onLinkChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      props.onAddLink?.()
                    }
                  }}
                  placeholder={tx.ornamentAdminPasteLink}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs"
                />
                <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs disabled:opacity-40" disabled={!props.link?.trim()} onClick={props.onAddLink}>
                  {tx.ornamentAdminAddLink}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function WeddingOrnamentAdminBar(props: {
  locale: WebLocale
  hint: string
  addLabel: string
  saveLabel: string
  resetLabel: string
  dirty?: boolean
  saving: boolean
  compact?: boolean
  onAdd: (src: string) => void
  onSave?: () => void
  onReset: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className={props.compact ? 'flex flex-wrap items-center gap-1' : 'mt-3 space-y-2 rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-2'} title={props.compact ? props.hint : undefined}>
      <p className={props.compact ? 'sr-only' : 'text-xs leading-relaxed text-rose-950'}>{props.hint}</p>
      <div className={props.compact ? 'contents' : 'flex flex-wrap gap-2'}>
        <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs" onClick={() => setPickerOpen(true)}>
          {props.addLabel}
        </button>
        <OrnamentPickerDialog locale={props.locale} open={pickerOpen} onOpenChange={setPickerOpen} onPick={props.onAdd} />
        <button type="button" disabled={props.saving} className="h-8 rounded-md border bg-white px-3 text-xs" onClick={props.onReset}>
          {props.resetLabel}
        </button>
      </div>
    </div>
  )
}

export function WeddingOrnamentPreviewTools(props: {
  locale: WebLocale
  surface: WeddingOrnamentSurface
  frame: HTMLIFrameElement | null
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setSaving(false)
    setSelected(null)
  }, [props.frame])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!props.frame || event.source !== props.frame.contentWindow) return
      const data = event.data as {
        type?: string
        surface?: string
        dirty?: boolean
        saving?: boolean
        index?: number | null
      }
      if (!data || data.surface !== props.surface) return
      if (data.type === 'wedding-ornament-state') {
        setSaving(Boolean(data.saving))
      }
      if (data.type === 'wedding-ornament-selection') {
        setSelected(typeof data.index === 'number' ? data.index : null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [props.frame, props.surface])

  const send = (command: { action: 'save' | 'reset' | 'delete' } | { action: 'add'; src: string } | { action: 'resize' | 'rotate'; delta: number }) => {
    props.frame?.contentWindow?.postMessage(
      { type: 'wedding-ornament-command', surface: props.surface, ...command },
      window.location.origin,
    )
  }

  const addSrc = (src: string) => {
    const value = src.trim()
    if (!isWeddingOrnamentImageSrc(value)) {
      toast({ title: tx.ornamentAdminFailed, description: tx.ornamentAdminPasteLink, variant: 'destructive' })
      return
    }
    send({ action: 'add', src: value })
    setLink('')
    setPickerOpen(false)
  }

  const uploadFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.set('file', file)
    const result = await uploadWeddingOrnamentImage(form)
    setUploading(false)
    if (!result || !('url' in result) || !result.url) {
      toast({ title: tx.ornamentAdminFailed, variant: 'destructive' })
      return
    }
    send({ action: 'add', src: result.url })
    setPickerOpen(false)
  }

  const noSelection = selected == null
  const toolClass = 'h-8 rounded-md border bg-white px-2.5 text-xs disabled:opacity-40'

  return (
    <div
      className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/70 p-2"
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/') && item.type !== 'image/svg+xml')
        if (file) {
          event.preventDefault()
          void uploadFile(file)
          return
        }
        const text = event.clipboardData.getData('text').trim()
        if (isWeddingOrnamentImageSrc(text)) {
          event.preventDefault()
          addSrc(text)
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolClass} onClick={() => setPickerOpen(true)}>
          {tx.ornamentAdminAdd}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            event.target.value = ''
            void uploadFile(file)
          }}
        />
        <OrnamentPickerDialog
          locale={props.locale}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={addSrc}
          uploading={uploading}
          onUploadClick={() => fileRef.current?.click()}
          link={link}
          onLinkChange={setLink}
          onAddLink={() => addSrc(link)}
        />
        <button type="button" className={cn(toolClass, 'text-rose-700')} disabled={noSelection} onClick={() => send({ action: 'delete' })}>
          {tx.ornamentAdminDelete}
        </button>
        <button type="button" className={toolClass} disabled={saving} onClick={() => send({ action: 'reset' })}>
          {tx.ornamentAdminReset}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-rose-950">{tx.ornamentAdminSelectFirst}</p>
    </div>
  )
}
