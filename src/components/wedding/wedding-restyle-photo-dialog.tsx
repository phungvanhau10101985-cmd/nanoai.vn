'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { WeddingCouplePhotoRestyleId } from '@/lib/wedding/restyle-wedding-couple-photo'

export type WeddingRestylePhotoReportItem = {
  id: string
  label: string
  url: string
  status: 'done' | 'failed' | 'skipped'
  creditText: string
}

export type WeddingRestylePhotoReport = {
  title: string
  summary: string
  outfitLabel: string
  outfitUrl: string
  placeLabel: string
  placeName: string
  close: string
  failed: string
  skipped: string
  items: readonly WeddingRestylePhotoReportItem[]
}

export function WeddingRestylePhotoDialog(props: {
  open: boolean
  busy: boolean
  progress: string
  seed: WeddingCouplePhotoRestyleId | null
  outfits: readonly { index: number; src: string; shared: boolean }[]
  places: readonly { id: string; label: string; region: 'vietnam' | 'world' }[]
  photos: readonly { id: WeddingCouplePhotoRestyleId; url: string; label: string }[]
  copy: {
    title: string
    outfit: string
    outfitHint: string
    shared: string
    sharedHint: string
    upload: string
    uploadHint: string
    uploadBusy: string
    uploadFailed: string
    outfitConfirm: string
    place: string
    placeHint: string
    vietnam: string
    world: string
    photos: string
    start: string
    credit: string
    empty: string
    needOutfit: string
  }
  creditEach: number
  report: WeddingRestylePhotoReport | null
  onOpenChange: (open: boolean) => void
  onPrepareOutfit: (file: File) => Promise<{ image: string } | { error: string }>
  onStart: (input: {
    outfitIndex: number
    placeId: string
    slots: WeddingCouplePhotoRestyleId[]
    outfitFile: File | null
    outfitPreview: string
  }) => void
}) {
  const [outfit, setOutfit] = useState(1)
  const [placeId, setPlaceId] = useState('')
  const [placeOpen, setPlaceOpen] = useState(false)
  const [picked, setPicked] = useState<WeddingCouplePhotoRestyleId[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState('')
  const [useUpload, setUseUpload] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [outfitZoom, setOutfitZoom] = useState<{ index: number; src: string } | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadToken = useRef(0)

  useEffect(() => {
    uploadToken.current += 1
    if (!props.open) return
    setOutfit(props.outfits[0]?.index ?? 1)
    setPlaceId(props.places[0]?.id || '')
    setPlaceOpen(false)
    const seeded = props.seed && props.photos.some((photo) => photo.id === props.seed) ? props.seed : null
    setPicked(seeded ? [seeded] : [])
    setUploadFile(null)
    setUploadPreview('')
    setUseUpload(false)
    setUploadBusy(false)
    setUploadError('')
    setOutfitZoom(null)
    // Chỉ đặt lại khi mở bảng, không khi danh sách ảnh đổi giữa chừng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.seed])

  const slots = props.photos.filter((photo) => picked.includes(photo.id)).map((photo) => photo.id)
  const credit = slots.length * props.creditEach
  const themeOutfits = props.outfits.filter((item) => !item.shared)
  const sharedOutfits = props.outfits.filter((item) => item.shared)
  const outfitReady = useUpload ? Boolean(uploadFile) : props.outfits.some((item) => item.index === outfit)
  const ready = !props.busy && !uploadBusy && outfitReady && slots.length > 0 && Boolean(placeId)

  const onUpload = async (file: File | undefined) => {
    if (!file || props.busy || uploadBusy) return
    const token = uploadToken.current + 1
    uploadToken.current = token
    setUploadBusy(true)
    setUploadError('')
    const prepared = await props.onPrepareOutfit(file)
    if (token !== uploadToken.current) return
    setUploadBusy(false)
    if (!('image' in prepared) || !prepared.image) {
      setUploadError(props.copy.uploadFailed)
      return
    }
    setUploadFile(file)
    setUploadPreview(prepared.image)
    setUseUpload(true)
  }

  return (
    <Dialog open={props.open} onOpenChange={(next) => { if (!props.busy) props.onOpenChange(next) }}>
      <DialogContent
        overlayClassName="z-[120]"
        className={cn(
          'z-[120] flex max-h-[min(92vh,860px)] max-w-none flex-col gap-3 overflow-y-auto p-4',
          props.report || outfitZoom ? 'w-[min(100%-1.5rem,36rem)]' : 'w-[min(100%-1.5rem,28rem)]',
        )}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-left text-base text-[#3f2a12]">
            {props.report ? props.report.title : props.copy.title}
          </DialogTitle>
        </DialogHeader>
        {props.report ? (
          <WeddingRestylePhotoReportView report={props.report} onClose={() => props.onOpenChange(false)} />
        ) : outfitZoom ? (
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outfitZoom.src} alt="" className="max-h-[min(70vh,640px)] w-full rounded-xl bg-[#f7f1e8] object-contain" />
            <button
              type="button"
              className="sticky bottom-0 inline-flex w-full items-center justify-center rounded-full bg-[#f0c14b] px-4 py-2 text-sm font-semibold text-[#3f2a12]"
              onClick={() => {
                setUseUpload(false)
                setOutfit(outfitZoom.index)
                setOutfitZoom(null)
              }}
            >
              {props.copy.outfitConfirm}
            </button>
          </div>
        ) : (
        <>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[#3f2a12]">{props.copy.outfit}</h3>
          <p className="text-xs leading-5 text-[#6b5344]">{props.copy.outfitHint}</p>
          <div className="space-y-1.5">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void onUpload(file)
              }}
            />
            <button
              type="button"
              disabled={props.busy || uploadBusy}
              className="rounded-full border border-[#c4a15a] bg-white px-3 py-1.5 text-xs font-semibold text-[#3f2a12] disabled:opacity-60"
              onClick={() => uploadInputRef.current?.click()}
            >
              {uploadBusy ? props.copy.uploadBusy : props.copy.upload}
            </button>
            <p className="text-xs leading-5 text-[#6b5344]">{props.copy.uploadHint}</p>
            {uploadError ? <p className="text-xs font-semibold text-[#8a5727]">{uploadError}</p> : null}
            {uploadPreview ? (
              <button
                type="button"
                disabled={props.busy}
                aria-pressed={useUpload}
                className={cn(
                  'block w-full overflow-hidden rounded-lg border bg-[#f7f1e8]',
                  useUpload ? 'border-[#c4a15a] ring-2 ring-[#c4a15a]' : 'border-[#e6d7c3]',
                )}
                onClick={() => setUseUpload(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadPreview} alt={props.copy.upload} className="max-h-40 w-full object-contain" />
              </button>
            ) : null}
          </div>
          {themeOutfits.length === 0 && sharedOutfits.length === 0 && !uploadPreview ? <p className="text-sm text-[#6b5344]">{props.copy.needOutfit}</p> : (
            <>
              {themeOutfits.length > 0 ? (
                <OutfitChoiceGrid
                  items={themeOutfits}
                  outfit={useUpload ? 0 : outfit}
                  busy={props.busy}
                  onPick={(index) => {
                    const item = themeOutfits.find((row) => row.index === index)
                    if (item) setOutfitZoom({ index: item.index, src: item.src })
                  }}
                />
              ) : null}
              {sharedOutfits.length > 0 ? (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-[#3f2a12]">{props.copy.shared}</h4>
                  <p className="text-xs leading-5 text-[#6b5344]">{props.copy.sharedHint}</p>
                  <OutfitChoiceGrid
                    items={sharedOutfits}
                    outfit={useUpload ? 0 : outfit}
                    busy={props.busy}
                    onPick={(index) => {
                      const item = sharedOutfits.find((row) => row.index === index)
                      if (item) setOutfitZoom({ index: item.index, src: item.src })
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[#3f2a12]">{props.copy.place}</h3>
          <button
            type="button"
            disabled={props.busy}
            aria-expanded={placeOpen}
            className="flex w-full items-center justify-between gap-2 rounded-full border border-[#e6d7c3] bg-white px-3 py-2 text-left text-sm font-semibold text-[#3f2a12] disabled:opacity-60"
            onClick={() => setPlaceOpen((open) => !open)}
          >
            <span className="min-w-0 truncate">{props.places.find((place) => place.id === placeId)?.label || props.copy.place}</span>
            <span className={cn('shrink-0 text-[10px] text-[#8a735c] transition', placeOpen && 'rotate-180')} aria-hidden>▼</span>
          </button>
          {placeOpen ? (
            <div className="space-y-2 rounded-xl border border-[#e6d7c3] bg-[#fffaf3] p-2">
              <p className="text-xs leading-5 text-[#6b5344]">{props.copy.placeHint}</p>
              {(['vietnam', 'world'] as const).map((region) => {
                const items = props.places.filter((place) => place.region === region)
                if (items.length === 0) return null
                return (
                  <div key={region} className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a735c]">
                      {region === 'vietnam' ? props.copy.vietnam : props.copy.world}
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                      {items.map((place) => {
                        const selected = placeId === place.id
                        return (
                          <button
                            key={place.id}
                            type="button"
                            disabled={props.busy}
                            aria-pressed={selected}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-semibold',
                              selected
                                ? 'border-[#c4a15a] bg-[#f0c14b] text-[#3f2a12]'
                                : 'border-[#e6d7c3] bg-white text-[#3f2a12]',
                            )}
                            onClick={() => {
                              setPlaceId(place.id)
                              setPlaceOpen(false)
                            }}
                          >
                            {place.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[#3f2a12]">{props.copy.photos}</h3>
          {props.photos.length === 0 ? <p className="text-sm text-[#6b5344]">{props.copy.empty}</p> : (
            <ul className="space-y-1.5">
              {props.photos.map((photo) => {
                const checked = picked.includes(photo.id)
                return (
                  <li key={photo.id}>
                    <label className="flex items-center gap-2 rounded-lg border border-[#e6d7c3] bg-white px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#8a5727]"
                        checked={checked}
                        disabled={props.busy}
                        onChange={() => {
                          setPicked((current) => (
                            current.includes(photo.id) ? current.filter((id) => id !== photo.id) : [...current, photo.id]
                          ))
                        }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="size-10 rounded object-cover" />
                      <span className="text-sm text-[#3f2a12]">{photo.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <button
          type="button"
          disabled={!ready}
          className="sticky bottom-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#f0c14b] px-4 py-2 text-sm font-semibold text-[#3f2a12] disabled:opacity-60"
          onClick={() => {
            if (!ready) return
            props.onStart({
              outfitIndex: outfit,
              placeId,
              slots,
              outfitFile: useUpload ? uploadFile : null,
              outfitPreview: useUpload ? uploadPreview : '',
            })
          }}
        >
          {props.busy && props.progress ? props.progress : props.copy.start.replace('{count}', String(slots.length))}
          {props.busy ? null : (
            <span className="rounded-full bg-[#3f2a12] px-1.5 py-px text-[10px] font-bold text-[#f0c14b]">
              {props.copy.credit.replace('{n}', String(credit))}
            </span>
          )}
        </button>
        </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OutfitChoiceGrid(props: {
  items: readonly { index: number; src: string }[]
  outfit: number
  busy: boolean
  onPick: (index: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {props.items.map((item) => {
        const selected = props.outfit === item.index
        return (
          <button
            key={item.src}
            type="button"
            disabled={props.busy}
            aria-pressed={selected}
            className={cn(
              'overflow-hidden rounded-lg border bg-[#f7f1e8]',
              selected ? 'border-[#c4a15a] ring-2 ring-[#c4a15a]' : 'border-[#e6d7c3]',
            )}
            onClick={() => props.onPick(item.index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt="" className="aspect-[3/2] w-full object-cover" />
          </button>
        )
      })}
    </div>
  )
}

function WeddingRestylePhotoReportView(props: {
  report: WeddingRestylePhotoReport
  onClose: () => void
}) {
  const [focusId, setFocusId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const focused = props.report.items.find((item) => item.id === focusId && item.status === 'done' && item.url)

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div ref={rootRef} className="space-y-3">
      <p className="text-sm leading-5 text-[#3f2a12]" aria-live="polite">{props.report.summary}</p>
      {props.report.placeName ? (
        <p className="text-xs leading-5 text-[#6b5344]">
          <span className="font-semibold text-[#3f2a12]">{props.report.placeLabel}: </span>
          {props.report.placeName}
        </p>
      ) : null}
      {props.report.outfitUrl ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.report.outfitUrl} alt="" className="h-14 w-20 rounded-md border border-[#e6d7c3] object-cover" />
          <span className="text-xs font-semibold text-[#3f2a12]">{props.report.outfitLabel}</span>
        </div>
      ) : null}
      {focused ? (
        <button type="button" className="block w-full" onClick={() => setFocusId(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={focused.url} alt={focused.label} className="max-h-[70vh] w-full rounded-xl bg-[#f7f1e8] object-contain" />
        </button>
      ) : null}
      <ul className="space-y-3">
        {props.report.items.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-xl border border-[#e6d7c3] bg-white">
            {item.status === 'done' && item.url ? (
              <button type="button" className="block w-full" onClick={() => setFocusId(item.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.label} className="max-h-80 w-full bg-[#f7f1e8] object-contain" />
              </button>
            ) : item.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={item.url} alt="" className="h-16 w-full object-cover opacity-60" />
            ) : null}
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="text-sm font-semibold text-[#3f2a12]">{item.label}</span>
              {item.status === 'done' && item.creditText ? (
                <span className="rounded-full bg-[#3f2a12] px-1.5 py-px text-[10px] font-bold text-[#f0c14b]">
                  {item.creditText}
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#8a5727]">
                  {item.status === 'failed' ? props.report.failed : props.report.skipped}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="sticky bottom-0 inline-flex w-full items-center justify-center rounded-full bg-[#f0c14b] px-4 py-2 text-sm font-semibold text-[#3f2a12]"
        onClick={props.onClose}
      >
        {props.report.close}
      </button>
    </div>
  )
}
