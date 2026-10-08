'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { WeddingMusicLibraryRow } from '@/lib/db/wedding-cards-pg'

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
  onSelect: (audioUrl: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftUrl, setDraftUrl] = useState('')
  const [playingUrl, setPlayingUrl] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  if (!props.items.length) return null

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
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {props.items.map((item) => {
              const picked = draftUrl === item.audioUrl
              const playing = playingUrl === item.audioUrl
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2',
                    picked ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    className={cn('min-w-0 flex-1 text-left text-sm', picked && 'font-medium')}
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
                </div>
              )
            })}
          </div>
          {showCredit ? <p className="text-xs text-muted-foreground">{props.credit}</p> : null}
          {draftUrl ? (
            <DialogFooter>
              <Button type="button" onClick={confirmPick}>
                {props.okLabel}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
