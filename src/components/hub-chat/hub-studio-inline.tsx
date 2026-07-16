'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Check, Circle, Crop, Download, FileText, Loader2, Maximize2, Pencil, RefreshCw, Sparkles, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { HubStudioFaceCropDialog, type HubStudioFaceCropLabels } from '@/components/hub-chat/hub-studio-face-crop-dialog'
import { formatMmSize, normalizeFaceSizeMm } from '@/lib/packaging/face-crop-size'
import { getPackagingFaceSizeForStep } from '@/lib/packaging/hub-face-steps'
import { resolvePackagingStepLabel } from '@/lib/packaging/packaging-face-labels'
import type { WebLocale } from '@/lib/i18n/config'

type StudioLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  studio?: HubStudioMessagePayload | null
  stepKey?: string
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
  currentStepKey,
  onNavigateStep,
}: {
  steps: HubStudioSession['processSteps']
  labels: { done: string; inProgress: string; pending: string; navigateHint?: string }
  currentStepKey?: string | null
  onNavigateStep?: (stepKey: string) => void
}) {
  if (!steps.length) return null
  return (
    <div className="space-y-1">
      {labels.navigateHint ? (
        <p className="text-[10px] text-muted-foreground">{labels.navigateHint}</p>
      ) : null}
      <ol className="flex flex-wrap gap-1.5">
      {steps.map((s) => {
        const isCurrent = currentStepKey === s.key
        const navigable =
          Boolean(onNavigateStep) && (s.status === 'done' || s.status === 'in_progress')
        const Tag = navigable ? 'button' : 'li'
        return (
        <Tag
          key={s.key}
          type={navigable ? 'button' : undefined}
          disabled={navigable ? isCurrent || false : undefined}
          onClick={navigable && !isCurrent ? () => onNavigateStep?.(s.key) : undefined}
          title={
            s.status === 'done'
              ? labels.done
              : s.status === 'in_progress'
                ? labels.inProgress
                : labels.pending
          }
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
            isCurrent
              ? 'ring-2 ring-violet-400 ring-offset-1 dark:ring-violet-600'
              : ''
          } ${
            s.status === 'done'
              ? navigable
                ? 'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : s.status === 'in_progress'
                ? navigable
                  ? 'cursor-pointer border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60'
                  : 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
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
        </Tag>
      )})}
      </ol>
    </div>
  )
}

export function HubStudioMessageBubble({
  line,
  hc,
  busy,
  onRegenerate,
  onApproveReference,
  onRemoveReference,
  onEditStep,
  editingLineId,
  onSaveEdit,
  onCancelEdit,
  uiLocale = 'vi',
  cropLabels,
  onCropImage,
  onRevertFaceEdit,
  studioSession,
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
    studioEditStep: string
    studioEditSave: string
    studioEditCancel: string
    studioEditCredit: string
    studioCropImage: string
    studioCropSizeDisplay: string
    studioCropTargetDisplay: string
    studioEditRevertOriginal: string
  }
  uiLocale?: WebLocale
  cropLabels?: HubStudioFaceCropLabels
  busy: boolean
  onRegenerate: () => void
  onApproveReference: () => void
  onCropImage?: (blob: Blob, printSizeMm: { widthMm: number; heightMm: number }) => void | Promise<void>
  onRevertFaceEdit?: () => void | Promise<void>
  onRemoveReference?: (screenKey: string) => void
  onEditStep?: (line: StudioLine) => void
  editingLineId?: string | null
  onSaveEdit?: (lineId: string, content: string, stepKey?: string) => void
  onCancelEdit?: () => void
  /** Live session — used to resolve box face mm when stored studio payload is incomplete. */
  studioSession?: HubStudioSession | null
}) {
  const st = line.studio
  const isAudio = st?.previewKind === 'audio' || Boolean(st?.audioUrl)
  const isEditing = editingLineId === line.id && line.role === 'user'
  const [draft, setDraft] = useState(line.content)
  const [cropOpen, setCropOpen] = useState(false)

  const resolvedFaceTargetMm = useMemo(() => {
    const fromPayload = normalizeFaceSizeMm(st?.faceTargetSizeMm)
    if (fromPayload) return fromPayload
    if (studioSession?.packaging?.dimensionsMm && st?.screenKey) {
      return getPackagingFaceSizeForStep(studioSession.packaging.dimensionsMm, st.screenKey)
    }
    return null
  }, [st?.faceTargetSizeMm, st?.screenKey, studioSession?.packaging?.dimensionsMm])

  const resolvedFaceEditedMm = useMemo(
    () => normalizeFaceSizeMm(st?.faceEditedSizeMm),
    [st?.faceEditedSizeMm]
  )

  const displayScreenLabel = useMemo(() => {
    if (!st?.screenKey) return st?.screenLabel ?? ''
    if (studioSession?.packaging?.dimensionsMm) {
      return resolvePackagingStepLabel(
        studioSession.processSteps,
        st.screenKey,
        uiLocale,
        studioSession.presetId,
        studioSession.packaging.dimensionsMm
      )
    }
    return st.screenLabel ?? ''
  }, [
    st?.screenKey,
    st?.screenLabel,
    studioSession?.packaging?.dimensionsMm,
    studioSession?.presetId,
    studioSession?.processSteps,
    uiLocale,
  ])

  const editBaseImageUrl = useMemo(() => {
    if (st?.faceOriginalUrl) return st.faceOriginalUrl
    const pending = studioSession?.pendingPreview
    if (pending?.screenKey === st?.screenKey && pending?.originalUrl) {
      return pending.originalUrl
    }
    return st?.imageUrl ?? ''
  }, [st?.faceOriginalUrl, st?.imageUrl, st?.screenKey, studioSession?.pendingPreview])

  const showRevert =
    Boolean(st?.showRevertFaceEdit) ||
    Boolean(
      (() => {
        const pending = studioSession?.pendingPreview
        return (
          pending?.originalUrl &&
          pending.url !== pending.originalUrl &&
          pending.screenKey === st?.screenKey
        )
      })()
    )

  useEffect(() => {
    if (isEditing) setDraft(line.content)
  }, [isEditing, line.content])

  if (line.role === 'user') {
    return (
      <div className="ml-6 max-w-full">
        {isEditing ? (
          <div className="rounded-md bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                disabled={busy}
                className="min-h-[72px] text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-violet-600 text-xs hover:bg-violet-700"
                  disabled={busy || draft.trim().length < 2}
                  title={hc.studioEditCredit}
                  onClick={() =>
                    onSaveEdit?.(line.id, draft.trim(), line.stepKey ?? line.studio?.stepKey)
                  }
                >
                  {hc.studioEditSave}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={onCancelEdit}
                >
                  {hc.studioEditCancel}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
            <span className="whitespace-pre-wrap break-words">{line.content}</span>
            {onEditStep ? (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-950/50"
                disabled={busy}
                title={hc.studioEditCredit}
                onClick={() => {
                  setDraft(line.content)
                  onEditStep(line)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                {hc.studioEditStep}
              </button>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mr-6 rounded-md bg-violet-50/80 px-2.5 py-2 text-sm text-slate-800 dark:bg-violet-950/30 dark:text-slate-100">
      <p className="whitespace-pre-wrap">{line.content}</p>
      {st?.boxWireframeSvg ? (
        <div
          className="mt-2 flex w-full max-w-[400px] justify-center overflow-hidden rounded-lg border border-violet-200 bg-white py-1.5 dark:border-violet-800 dark:bg-slate-900 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:min-h-[180px]"
          dangerouslySetInnerHTML={{ __html: st.boxWireframeSvg }}
        />
      ) : null}
      {st?.referencePreviews && st.referencePreviews.length > 0 ? (
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
      {st?.artifactUrl ? (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-100">
            <FileText className="h-4 w-4" />
            {st.artifactLabel || st.artifactFileName || 'File'}
          </p>
          {st.artifactNote ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{st.artifactNote}</p>
          ) : null}
          <Button asChild type="button" size="sm" variant="outline" className="mt-2 h-8 text-xs">
            <a
              href={st.artifactUrl}
              download={st.artifactFileName || undefined}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {st.artifactDownloadLabel || st.artifactFileName || 'Download'}
            </a>
          </Button>
        </div>
      ) : null}
      {st?.audioUrl ? (
        <div className="mt-2 space-y-2">
          {displayScreenLabel ? (
            <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {displayScreenLabel}
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
      {st?.imageUrl ? (
        <div className="mt-2 space-y-2">
          {displayScreenLabel ? (
            <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {displayScreenLabel}
            </p>
          ) : null}
          <StudioImageLightbox
            src={st.imageUrl}
            alt={displayScreenLabel || 'Studio preview'}
            viewLargeLabel={hc.studioViewLarge}
            aspectHint={st.aspectHint}
          />
          {st.imageCharged ? (
            <p className="text-[11px] text-muted-foreground">
              {hc.studioImageCredit.replace('{n}', String(st.imageCharged))}
            </p>
          ) : null}
          {resolvedFaceTargetMm || resolvedFaceEditedMm ? (
            <div className="rounded-md border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900/50">
              {resolvedFaceTargetMm ? (
                <p className="text-muted-foreground">
                  {hc.studioCropTargetDisplay.replace(
                    '{size}',
                    formatMmSize(uiLocale, resolvedFaceTargetMm.widthMm, resolvedFaceTargetMm.heightMm)
                  )}
                </p>
              ) : null}
              {resolvedFaceEditedMm ? (
                <p className="font-medium text-violet-900 dark:text-violet-100">
                  {hc.studioCropSizeDisplay.replace(
                    '{size}',
                    formatMmSize(uiLocale, resolvedFaceEditedMm.widthMm, resolvedFaceEditedMm.heightMm)
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          {st.showRegenerate || st.showApproveReference || st.showCropImage ? (
            <div className="flex flex-wrap gap-1.5">
              {st.showCropImage && st.imageUrl && resolvedFaceTargetMm && cropLabels && onCropImage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => setCropOpen(true)}
                >
                  <Crop className="mr-1 h-3.5 w-3.5" />
                  {hc.studioCropImage}
                </Button>
              ) : null}
              {showRevert && onRevertFaceEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => void onRevertFaceEdit()}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  {hc.studioEditRevertOriginal}
                </Button>
              ) : null}
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
          {st.showCropImage && editBaseImageUrl && resolvedFaceTargetMm && cropLabels && onCropImage ? (
            <HubStudioFaceCropDialog
              open={cropOpen}
              onOpenChange={setCropOpen}
              imageUrl={editBaseImageUrl}
              faceSizeMm={resolvedFaceTargetMm}
              locale={uiLocale}
              labels={cropLabels}
              busy={busy}
              onSave={async (blob, printSizeMm) => {
                await onCropImage(blob, printSizeMm)
                setCropOpen(false)
              }}
            />
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
