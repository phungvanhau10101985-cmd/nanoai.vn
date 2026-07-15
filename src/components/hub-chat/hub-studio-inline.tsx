'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Circle, Loader2, Maximize2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

type StudioLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  studio?: HubStudioMessagePayload | null
}

function imageFrameClass(aspect?: HubStudioMessagePayload['aspectHint']): string {
  if (aspect === 'square') return 'max-w-[200px]'
  if (aspect === 'landscape') return 'max-w-[280px]'
  return 'max-w-[220px]'
}

function imageDimensions(aspect?: HubStudioMessagePayload['aspectHint']): { width: number; height: number } {
  if (aspect === 'square') return { width: 200, height: 200 }
  if (aspect === 'landscape') return { width: 280, height: 158 }
  return { width: 220, height: 390 }
}

function StudioImageLightbox({
  src,
  alt,
  viewLargeLabel,
  aspectHint,
}: {
  src: string
  alt: string
  viewLargeLabel: string
  aspectHint?: HubStudioMessagePayload['aspectHint']
}) {
  const [open, setOpen] = useState(false)
  const resolvedSrc = rewriteLegacyBunnyCdnUrl(src)
  const dims = imageDimensions(aspectHint)

  return (
    <>
      <div
        className={`relative mx-auto overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm dark:border-violet-800 ${imageFrameClass(aspectHint)}`}
      >
        <Image
          src={resolvedSrc}
          alt={alt}
          width={dims.width}
          height={dims.height}
          className="h-auto w-full cursor-zoom-in object-contain"
          unoptimized
          onClick={() => setOpen(true)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <Maximize2 className="mr-1 h-3.5 w-3.5" />
        {viewLargeLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[2147483646] bg-black/90"
          className="!fixed !inset-0 !left-0 !top-0 z-[2147483647] !flex !h-[100dvh] !max-h-[100dvh] !min-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 items-center justify-center rounded-none border-0 bg-black/95 p-2 shadow-none sm:rounded-none"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 h-11 w-11 rounded-full border border-white/20 bg-white/20 text-white hover:bg-white/30"
            onClick={() => setOpen(false)}
            aria-label={viewLargeLabel}
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full CDN preview */}
          <img
            src={resolvedSrc}
            alt={alt}
            className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function HubStudioProcessRail({
  steps,
  labels,
}: {
  steps: HubStudioSession['processSteps']
  labels: { done: string; inProgress: string; pending: string }
}) {
  if (!steps.length) return null
  return (
    <ol className="flex flex-wrap gap-1.5">
      {steps.map((s) => (
        <li
          key={s.key}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
            s.status === 'done'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : s.status === 'in_progress'
                ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
                : 'border-slate-200 bg-white text-muted-foreground dark:border-slate-700 dark:bg-slate-900'
          }`}
        >
          {s.status === 'done' ? (
            <Check className="h-3 w-3" />
          ) : s.status === 'in_progress' ? (
            <Circle className="h-3 w-3 fill-current" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
          {s.label}
        </li>
      ))}
    </ol>
  )
}

export function HubStudioMessageBubble({
  line,
  hc,
  busy,
  onRegenerate,
  onApproveReference,
  onRemoveReference,
}: {
  line: StudioLine
  hc: {
    studioRegenerate: string
    studioUseReference: string
    studioContinue: string
    studioImageCredit: string
    studioMusicCredit: string
    studioViewLarge: string
    studioReferenceTitle: string
    studioReferenceCount: string
    studioReferenceRemove: string
  }
  busy: boolean
  onRegenerate: () => void
  onApproveReference: () => void
  onRemoveReference?: (screenKey: string) => void
}) {
  const st = line.studio
  const isAudio = st?.previewKind === 'audio' || Boolean(st?.audioUrl)

  return (
    <div
      className={`rounded-md px-2.5 py-2 text-sm ${
        line.role === 'user'
          ? 'ml-6 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
          : 'mr-6 bg-violet-50/80 text-slate-800 dark:bg-violet-950/30 dark:text-slate-100'
      }`}
    >
      <p className="whitespace-pre-wrap">{line.content}</p>
      {line.role === 'assistant' && st?.referencePreviews && st.referencePreviews.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
            {hc.studioReferenceTitle}
            {typeof st.referenceCount === 'number' && typeof st.referenceMax === 'number' ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {hc.studioReferenceCount
                  .replace('{count}', String(st.referenceCount))
                  .replace('{max}', String(st.referenceMax))}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {st.referencePreviews.map((ref) => (
              <div
                key={ref.screenKey || ref.url}
                className="relative w-[72px] overflow-hidden rounded-md border border-violet-200 bg-white dark:border-violet-800"
                title={ref.label}
              >
                {st.showReferenceRemove && ref.screenKey && onRemoveReference ? (
                  <button
                    type="button"
                    disabled={busy}
                    title={hc.studioReferenceRemove}
                    aria-label={hc.studioReferenceRemove}
                    className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 disabled:opacity-50"
                    onClick={() => onRemoveReference(ref.screenKey)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
                <Image src={ref.url} alt={ref.label} width={72} height={72} className="h-[72px] w-[72px] object-cover" unoptimized />
                <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">{ref.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {line.role === 'assistant' && st?.audioUrl ? (
        <div className="mt-2 space-y-2">
          {st.screenLabel ? (
            <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {st.screenLabel}
            </p>
          ) : null}
          <audio controls className="w-full max-w-sm" src={st.audioUrl} preload="metadata" />
          {st.imageCharged ? (
            <p className="text-[11px] text-muted-foreground">
              {hc.studioMusicCredit.replace('{n}', String(st.imageCharged))}
            </p>
          ) : null}
          {st.showRegenerate || st.showApproveReference ? (
            <div className="flex flex-wrap gap-1.5">
              {st.showRegenerate ? (
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={onRegenerate}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {hc.studioRegenerate}
                </Button>
              ) : null}
              {st.showApproveReference ? (
                <Button type="button" size="sm" className="h-8 bg-violet-600 text-xs hover:bg-violet-700" disabled={busy} onClick={onApproveReference}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {isAudio ? hc.studioContinue : hc.studioUseReference}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {line.role === 'assistant' && st?.imageUrl ? (
        <div className="mt-2 space-y-2">
          {st.screenLabel ? (
            <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {st.screenLabel}
            </p>
          ) : null}
          <StudioImageLightbox
            src={st.imageUrl}
            alt={st.screenLabel || 'Studio preview'}
            viewLargeLabel={hc.studioViewLarge}
            aspectHint={st.aspectHint}
          />
          {st.imageCharged ? (
            <p className="text-[11px] text-muted-foreground">
              {hc.studioImageCredit.replace('{n}', String(st.imageCharged))}
            </p>
          ) : null}
          {st.showRegenerate || st.showApproveReference ? (
            <div className="flex flex-wrap gap-1.5">
              {st.showRegenerate ? (
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={onRegenerate}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {hc.studioRegenerate}
                </Button>
              ) : null}
              {st.showApproveReference ? (
                <Button type="button" size="sm" className="h-8 bg-violet-600 text-xs hover:bg-violet-700" disabled={busy} onClick={onApproveReference}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {hc.studioUseReference}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function HubStudioThinking({ label }: { label: string }) {
  return (
    <div className="mr-6 flex items-center gap-2 rounded-md bg-violet-50/80 px-2.5 py-2 text-sm text-muted-foreground dark:bg-violet-950/30">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}
