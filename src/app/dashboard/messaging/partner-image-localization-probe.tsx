'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { imageLocalizationClient } from '@/lib/messaging/image-localization/image-localization-client'
import type { ImageLocLanguage, ImageLocProbe, ImageLocProbeEngine } from '@/lib/messaging/image-localization/image-localization-types'

type Copy = Dictionary['partnerMessagingAi']

type GalleryItem = {
  probeId: string
  role: 'original' | 'result'
  url: string
}

function daysLeft(iso: string): number {
  const end = new Date(iso).getTime()
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000))
}

function engineLabel(t: Copy, engine: ImageLocProbeEngine | null, status: ImageLocProbe['status']): string {
  if (status === 'running') return t.imageLocProbeRunningBadge
  if (status === 'error') return t.imageLocProbeError
  if (engine === 'ai') return t.imageLocProbeEngineAi
  if (engine === 'local') return t.imageLocProbeEngineLocal
  if (engine === 'delete') return t.imageLocProbeEngineDelete
  if (engine === 'keep') return t.imageLocProbeEngineKeep
  return t.imageLocProbeRunningBadge
}

function engineClass(engine: ImageLocProbeEngine | null, status: ImageLocProbe['status']): string {
  if (status === 'error') return 'bg-red-100 text-red-800'
  if (status === 'running') return 'bg-sky-100 text-sky-900'
  if (engine === 'ai') return 'bg-violet-100 text-violet-900'
  if (engine === 'delete') return 'bg-amber-100 text-amber-950'
  if (engine === 'keep') return 'bg-emerald-100 text-emerald-900'
  return 'bg-slate-100 text-slate-800'
}

export function PartnerImageLocalizationProbe({
  partnerId,
  language,
  t,
}: {
  partnerId: string
  language: ImageLocLanguage
  t: Copy
}) {
  const [probes, setProbes] = useState<ImageLocProbe[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [apparel, setApparel] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    const data = await imageLocalizationClient.listProbes(partnerId)
    setProbes(data.items)
    return data.items
  }, [partnerId])

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [load])

  const running = probes.some((probe) => probe.status === 'running')
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      void load().catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(id)
  }, [running, load])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const gallery = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = []
    for (const probe of probes) {
      for (const image of probe.images) items.push({ probeId: probe.id, role: image.role, url: image.url })
    }
    return items
  }, [probes])

  const active =
    probes.find((probe) => probe.id === selectedId) ||
    probes.find((probe) => probe.status === 'running') ||
    probes[0] ||
    null

  useEffect(() => {
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [active?.log.length, active?.id])

  const pickFile = (next: File | null) => {
    setError(null)
    if (preview) URL.revokeObjectURL(preview)
    if (!next) {
      setFile(null)
      setPreview(null)
      return
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(next.type) && !/\.(png|jpe?g|webp)$/i.test(next.name)) {
      setError(t.imageLocProbeDropHint)
      return
    }
    if (next.size > 8 * 1024 * 1024) {
      setError(t.imageLocProbeDropHint)
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  const run = async () => {
    if (!file) {
      setError(t.imageLocProbeNeedFile)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const probe = await imageLocalizationClient.startProbe(partnerId, file, language, apparel)
      setSelectedId(probe.id)
      setFolderOpen(true)
      pickFile(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await imageLocalizationClient.deleteProbe(partnerId, id)
      if (selectedId === id) setSelectedId(null)
      setGalleryIndex(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (galleryIndex == null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGalleryIndex(null)
      if (event.key === 'ArrowRight') setGalleryIndex((index) => (index == null ? index : (index + 1) % gallery.length))
      if (event.key === 'ArrowLeft') {
        setGalleryIndex((index) => (index == null ? index : (index - 1 + gallery.length) % gallery.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [galleryIndex, gallery.length])

  const openAll = () => {
    if (!gallery.length) {
      setFolderOpen(true)
      return
    }
    setFolderOpen(true)
    setGalleryIndex(0)
    setSelectedId(gallery[0].probeId)
  }

  const current = galleryIndex == null ? null : gallery[galleryIndex]
  const currentProbe = current ? probes.find((probe) => probe.id === current.probeId) : null
  const imageCount = gallery.length

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-sky-950">{t.imageLocProbeTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-sky-950/80">{t.imageLocProbeHint}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <button
            type="button"
            className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-center ${
              dragOver ? 'border-sky-500 bg-white' : 'border-sky-300 bg-white/80'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              pickFile(event.dataTransfer.files?.[0] || null)
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-28 max-w-full rounded object-contain" />
            ) : (
              <>
                <span className="text-sm font-medium text-sky-950">{t.imageLocProbeDrop}</span>
                <span className="text-xs text-muted-foreground">{t.imageLocProbeDropHint}</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              pickFile(event.target.files?.[0] || null)
              event.currentTarget.value = ''
            }}
          />
          {file ? (
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-border bg-white px-2 py-1 text-xs" onClick={() => inputRef.current?.click()}>
                {t.imageLocProbeReplace}
              </button>
              <button type="button" className="rounded-md border border-border bg-white px-2 py-1 text-xs" onClick={() => pickFile(null)}>
                {t.imageLocProbeClear}
              </button>
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-xs leading-snug">
            <input type="checkbox" className="mt-0.5" checked={apparel} disabled={busy} onChange={(event) => setApparel(event.target.checked)} />
            <span>
              <span className="font-medium">{t.imageLocProbeApparel}</span>
              <span className="mt-0.5 block text-muted-foreground">{t.imageLocProbeApparelHint}</span>
            </span>
          </label>
          <button
            type="button"
            className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
            disabled={busy || running || !file}
            onClick={() => void run()}
          >
            {busy || running ? t.imageLocProbeRunning : t.imageLocProbeRun}
          </button>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
        </div>

        <div className="flex min-h-52 flex-col rounded-lg border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <h4 className="text-xs font-semibold">{t.imageLocProbeLog}</h4>
            {active ? (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${engineClass(active.engine, active.status)}`}>
                {engineLabel(t, active.engine, active.status)}
              </span>
            ) : null}
            {active?.model ? <span className="text-[11px] text-muted-foreground">{active.model}</span> : null}
          </div>
          <div ref={logRef} className="max-h-64 flex-1 space-y-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
            {active ? (
              active.log.length ? (
                active.log.map((line, index) => (
                  <p key={`${line.at}:${index}`}>
                    <span className="text-muted-foreground">{line.at ? line.at.slice(11, 19) : ''}</span> {line.text}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground">{t.imageLocProbeRunning}</p>
              )
            ) : (
              <p className="text-muted-foreground">{t.imageLocProbeEmpty}</p>
            )}
          </div>
          {active?.message ? <p className="border-t border-border px-3 py-2 text-xs leading-snug">{active.message}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setFolderOpen((open) => !open)}>
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-sky-100 text-sky-800">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7.5h6l2 2H21v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.imageLocProbeFolder}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t.imageLocProbeCount.replace('{n}', String(imageCount))} · {t.imageLocProbeExpires}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
            disabled={!imageCount}
            onClick={openAll}
          >
            {t.imageLocProbeOpenAll}
          </button>
          {folderOpen ? (
            <button type="button" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => setFolderOpen(false)}>
              {t.imageLocProbeCollapse}
            </button>
          ) : null}
        </div>
        {folderOpen ? (
          imageCount === 0 ? (
            <p className="border-t border-border px-3 py-4 text-xs text-muted-foreground">{t.imageLocProbeEmpty}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-3 lg:grid-cols-4">
              {probes.map((probe) => (
                <article key={probe.id} className={`rounded-lg border p-2 ${selectedId === probe.id ? 'border-sky-400' : 'border-border'}`}>
                  <div className="flex gap-1">
                    {probe.images.length ? (
                      probe.images.map((image) => {
                        const index = gallery.findIndex((item) => item.probeId === probe.id && item.url === image.url && item.role === image.role)
                        return (
                          <button
                            key={`${image.role}:${image.url}`}
                            type="button"
                            className="min-w-0 flex-1"
                            onClick={() => {
                              setSelectedId(probe.id)
                              if (index >= 0) setGalleryIndex(index)
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" className="aspect-[3/4] w-full rounded bg-slate-100 object-contain" />
                            <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                              {image.role === 'result' ? t.imageLocProbeResult : t.imageLocProbeOriginal}
                            </span>
                          </button>
                        )
                      })
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
                        {t.imageLocProbeRunningBadge}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${engineClass(probe.engine, probe.status)}`}>
                        {engineLabel(t, probe.engine, probe.status)}
                      </span>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {t.imageLocProbeDaysLeft.replace('{n}', String(daysLeft(probe.expires_at)))}
                      </p>
                    </div>
                    <button type="button" className="shrink-0 text-[10px] text-red-700 hover:underline" onClick={() => void remove(probe.id)}>
                      {t.imageLocProbeDeleteNow}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : null}
      </div>

      {current && currentProbe ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl lg:flex-row">
            <div className="relative flex min-h-64 flex-1 items-center justify-center bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt="" className="max-h-[78vh] max-w-full object-contain" />
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm"
                onClick={() => setGalleryIndex((index) => (index == null ? index : (index - 1 + gallery.length) % gallery.length))}
              >
                {t.imageLocProbePrev}
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm"
                onClick={() => setGalleryIndex((index) => (index == null ? index : (index + 1) % gallery.length))}
              >
                {t.imageLocProbeNext}
              </button>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 p-3 lg:w-80">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {current.role === 'result' ? t.imageLocProbeResult : t.imageLocProbeOriginal}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.imageLocProbeCounter.replace('{i}', String((galleryIndex || 0) + 1)).replace('{n}', String(gallery.length))}
                  </p>
                </div>
                <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => setGalleryIndex(null)}>
                  {t.imageLocProbeClose}
                </button>
              </div>
              <span className={`w-fit rounded px-1.5 py-0.5 text-[11px] font-medium ${engineClass(currentProbe.engine, currentProbe.status)}`}>
                {engineLabel(t, currentProbe.engine, currentProbe.status)}
              </span>
              {currentProbe.model ? (
                <p className="text-xs leading-snug">
                  <span className="font-medium">{t.imageLocProbeModel}: </span>
                  {currentProbe.model}
                </p>
              ) : null}
              {currentProbe.classify_reason ? <p className="text-xs leading-snug text-muted-foreground">{currentProbe.classify_reason}</p> : null}
              {currentProbe.message ? <p className="text-xs leading-snug">{currentProbe.message}</p> : null}
              <div className="max-h-48 overflow-auto rounded border border-border bg-slate-50 p-2 font-mono text-[11px] leading-relaxed">
                {currentProbe.log.map((line, index) => (
                  <p key={`${line.at}:${index}`}>{line.text}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
