'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { WeddingMusicLibraryRow } from '@/lib/db/wedding-cards-pg'
import { findWeddingMusicInLibrary, weddingLibraryMusicFileError, weddingMusicLibraryMatchKey } from '@/lib/wedding/wedding-music-library'
import { deleteWeddingLibraryTrack, uploadWeddingLibraryTrack } from '@/app/tao-thiep-moi-cuoi-ai/actions'

export async function uploadWeddingLibraryMusicBatch(input: {
  files: File[]
  library: WeddingMusicLibraryRow[]
  onLibraryChange: (items: WeddingMusicLibraryRow[]) => void
  onProgress: (state: { current: number; total: number; name: string } | null) => void
  onFileProblem: (message: string, fileName: string) => void
  problemText: (code: string) => string
}) {
  let library = input.library
  const seen = new Set(library.map((item) => weddingMusicLibraryMatchKey(item.title)))
  let ok = 0
  let failed = 0
  let skipped = 0
  let lastUrl = ''
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index]
    const name = file.name.length > 48 ? `${file.name.slice(0, 45)}…` : file.name
    input.onProgress({ current: index + 1, total: input.files.length, name })
    const already = findWeddingMusicInLibrary(library, file.name)
    const matchKey = weddingMusicLibraryMatchKey(file.name)
    if (already || seen.has(matchKey)) {
      skipped += 1
      if (already) lastUrl = already.audioUrl
      seen.add(matchKey)
      continue
    }
    const problem = weddingLibraryMusicFileError(file)
    if (problem) {
      failed += 1
      input.onFileProblem(input.problemText(problem), file.name)
      continue
    }
    const body = new FormData()
    body.append('musicFile', file)
    body.append('musicTitle', file.name)
    const result = await uploadWeddingLibraryTrack(body)
    if ('error' in result && result.error) {
      failed += 1
      input.onFileProblem(input.problemText(result.error), file.name)
      continue
    }
    if (result.musicLibrary) {
      library = result.musicLibrary
      for (const item of library) seen.add(weddingMusicLibraryMatchKey(item.title))
      input.onLibraryChange(library)
    }
    if (result.audioUrl) lastUrl = result.audioUrl
    seen.add(matchKey)
    if ('already' in result && result.already) skipped += 1
    else if (result.audioUrl) ok += 1
  }
  input.onProgress(null)
  return { ok, failed, skipped, lastUrl }
}

function fillTemplate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

export function WeddingMusicLibraryPicker(props: {
  items: WeddingMusicLibraryRow[]
  selectedUrl: string
  credit: string
  chooseLabel: string
  chooseAgainLabel: string
  previewLabel: string
  stopPreviewLabel: string
  okLabel: string
  title: string
  uploadLabel: string
  uploadHint: string
  uploadProgress: string
  uploadSaved: string
  uploadPartial: string
  uploadSkipped: string
  uploadTooLarge: string
  uploadInvalidType: string
  uploadFailed: string
  deleteTrackLabel: string
  deleteTrackConfirm: string
  deleteDenied: string
  deleteFailed: string
  canDelete: boolean
  onSelect: (audioUrl: string) => void
  onLibraryChange: (items: WeddingMusicLibraryRow[]) => void
  onTrackRemoved: (audioUrl: string) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [draftUrl, setDraftUrl] = useState('')
  const [playingUrl, setPlayingUrl] = useState('')
  const [uploadState, setUploadState] = useState<{ current: number; total: number; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = () => setPlayingUrl('')
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.pause()
      audio.src = ''
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [])

  function stopPreview() {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setPlayingUrl('')
  }

  function closeModal() {
    if (uploadState) return
    stopPreview()
    setDraftUrl('')
    setOpen(false)
  }

  function togglePreview(url: string) {
    const audio = audioRef.current
    if (!audio || !url) return
    if (playingUrl === url && !audio.paused) {
      stopPreview()
      return
    }
    audio.pause()
    audio.src = url
    audio.currentTime = 0
    void audio.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(''))
  }

  function confirmPick() {
    if (!draftUrl) return
    props.onSelect(draftUrl)
    closeModal()
  }

  function errorText(code: string) {
    if (code === 'too_large') return props.uploadTooLarge
    if (code === 'invalid_type') return props.uploadInvalidType
    if (code === 'denied') return props.deleteDenied
    if (code === 'upload_failed') return props.uploadFailed
    if (code === 'missing') return props.deleteFailed
    return code
  }

  async function uploadFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (fileRef.current) fileRef.current.value = ''
    if (!files.length || uploadState) return
    const { ok, failed, skipped, lastUrl } = await uploadWeddingLibraryMusicBatch({
      files,
      library: props.items,
      onLibraryChange: props.onLibraryChange,
      onProgress: setUploadState,
      onFileProblem: (message, fileName) => {
        toast({ title: message, description: fileName, variant: 'destructive' })
      },
      problemText: errorText,
    })
    if (lastUrl) setDraftUrl(lastUrl)
    if (ok > 0 && failed === 0) {
      toast({ title: fillTemplate(props.uploadSaved, { count: ok }) })
    } else if (ok > 0) {
      toast({
        title: fillTemplate(props.uploadPartial, { ok, total: files.length, failed }),
        variant: 'destructive',
      })
    }
    if (skipped > 0) {
      toast({ title: fillTemplate(props.uploadSkipped, { count: skipped }) })
    }
  }

  async function removeTrack(item: WeddingMusicLibraryRow) {
    if (!props.canDelete || item.source !== 'upload' || deletingId || uploadState) return
    if (!window.confirm(props.deleteTrackConfirm)) return
    if (playingUrl === item.audioUrl) stopPreview()
    setDeletingId(item.id)
    const result = await deleteWeddingLibraryTrack(item.audioUrl)
    setDeletingId('')
    if ('error' in result && result.error) {
      toast({ title: errorText(result.error), variant: 'destructive' })
      return
    }
    if (result.musicLibrary) props.onLibraryChange(result.musicLibrary)
    if (draftUrl === item.audioUrl) setDraftUrl('')
    props.onTrackRemoved(item.audioUrl)
  }

  const selected = props.items.find((item) => item.audioUrl === props.selectedUrl)
  const showCredit = props.items.some((item) => item.credit)

  return (
    <>
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{selected.title}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {props.chooseAgainLabel}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          {props.chooseLabel}
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeModal()
          else setOpen(true)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label
              className={cn(
                'relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted',
                uploadState && 'pointer-events-none opacity-70',
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                multiple
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                style={{ touchAction: 'manipulation' }}
                disabled={Boolean(uploadState)}
                onChange={(event) => {
                  void uploadFiles(event.target.files)
                }}
              />
              {uploadState ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="pointer-events-none h-4 w-4" />}
              <span className="pointer-events-none">{props.uploadLabel}</span>
            </label>
            <p className="text-xs text-muted-foreground">
              {uploadState
                ? fillTemplate(props.uploadProgress, uploadState)
                : props.uploadHint}
            </p>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {props.items.map((item) => {
              const picked = draftUrl === item.audioUrl
              const playing = playingUrl === item.audioUrl
              const removing = deletingId === item.id
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
                    picked ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    className={cn('min-w-0 flex-1 truncate text-left text-sm', picked && 'font-medium')}
                    aria-pressed={picked}
                    onClick={() => setDraftUrl(item.audioUrl)}
                  >
                    {item.title}
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => togglePreview(item.audioUrl)}
                  >
                    {playing ? props.stopPreviewLabel : props.previewLabel}
                  </Button>
                  {props.canDelete && item.source === 'upload' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(removing || uploadState)}
                      aria-label={props.deleteTrackLabel}
                      onClick={() => {
                        void removeTrack(item)
                      }}
                    >
                      {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {props.deleteTrackLabel}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
          {showCredit ? <p className="text-xs text-muted-foreground">{props.credit}</p> : null}
          {draftUrl ? (
            <DialogFooter>
              <Button type="button" onClick={confirmPick} disabled={Boolean(uploadState)}>
                {props.okLabel}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
