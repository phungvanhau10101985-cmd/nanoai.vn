'use client'

import { useLayoutEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { composeDialogKeyboardFrame, revealComposeField } from '@/lib/wedding/compose-dialog-keyboard'
import { invitationComposeBrief } from '@/lib/wedding/invitation-compose'
import { invitationEditorCopy } from '@/lib/wedding/invitation-occasion'
import { appendWeddingComposeSuggestion } from '@/lib/wedding/wedding-sample-compose'

export function WeddingSampleComposeModal(props: {
  locale: WebLocale
  open: boolean
  occasionKey: string
  busy: boolean
  groomName: string
  brideName: string
  eventDate: string
  storyNotes: string
  nameError: boolean
  onGroomName: (value: string) => void
  onBrideName: (value: string) => void
  onEventDate: (value: string) => void
  onStoryNotes: (value: string) => void
  onDismiss: () => void
  onSkip: () => void
  onConfirm: () => void
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  const brief = invitationComposeBrief(props.occasionKey)
  const editor = invitationEditorCopy(props.occasionKey)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!props.open) return
    let stopped = false
    let attempts = 0
    let raf = 0
    let revealTimer = 0
    let detach = () => {}

    const attach = () => {
      if (stopped) return
      const content = contentRef.current
      const scroller = scrollerRef.current
      if (!content || !scroller) {
        attempts += 1
        if (attempts < 12) raf = window.requestAnimationFrame(attach)
        return
      }
      const mq = window.matchMedia('(max-width: 1023px)')
      let fullVisual = window.visualViewport?.height ?? window.innerHeight

      const pin = () => {
        const vv = window.visualViewport
        const visualHeight = vv?.height ?? window.innerHeight
        if (visualHeight > fullVisual) fullVisual = visualHeight
        const frame = composeDialogKeyboardFrame({
          mobile: mq.matches,
          layoutHeight: window.innerHeight,
          offsetTop: vv?.offsetTop ?? 0,
          visualHeight,
          keyboardOpen: fullVisual - visualHeight >= 80,
        })
        if (!frame) {
          content.style.top = ''
          content.style.height = ''
          content.style.maxHeight = ''
          content.style.transform = ''
          scroller.style.flex = ''
          scroller.style.minHeight = ''
          scroller.style.maxHeight = ''
          return
        }
        content.style.top = `${frame.top}px`
        content.style.height = `${frame.maxHeight}px`
        content.style.maxHeight = `${frame.maxHeight}px`
        content.style.transform = 'translateX(-50%)'
        scroller.style.flex = '1 1 auto'
        scroller.style.minHeight = '0px'
        scroller.style.maxHeight = 'none'
      }

      const onFocusIn = (event: FocusEvent) => {
        const target = event.target
        if (!(target instanceof HTMLElement) || !scroller.contains(target)) return
        const run = () => {
          pin()
          revealComposeField(target, scroller)
        }
        run()
        window.clearTimeout(revealTimer)
        revealTimer = window.setTimeout(run, 350)
      }

      pin()
      const vv = window.visualViewport
      vv?.addEventListener('resize', pin)
      vv?.addEventListener('scroll', pin)
      window.addEventListener('resize', pin)
      mq.addEventListener('change', pin)
      content.addEventListener('focusin', onFocusIn)
      detach = () => {
        window.clearTimeout(revealTimer)
        vv?.removeEventListener('resize', pin)
        vv?.removeEventListener('scroll', pin)
        window.removeEventListener('resize', pin)
        mq.removeEventListener('change', pin)
        content.removeEventListener('focusin', onFocusIn)
        content.style.top = ''
        content.style.height = ''
        content.style.maxHeight = ''
        content.style.transform = ''
        scroller.style.flex = ''
        scroller.style.minHeight = ''
        scroller.style.maxHeight = ''
      }
    }

    attach()
    return () => {
      stopped = true
      window.cancelAnimationFrame(raf)
      detach()
    }
  }, [props.open])

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && !props.busy) props.onDismiss()
      }}
    >
      <DialogContent
        ref={contentRef}
        overlayClassName="z-[260]"
        showCloseButton={!props.busy}
        data-keyboard-manual=""
        className="z-[260] flex max-h-[min(40rem,calc(100dvh-1rem))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          if (window.matchMedia('(max-width: 1023px)').matches) event.preventDefault()
        }}
      >
        <DialogHeader className="shrink-0 space-y-0 px-6 pb-2 pr-12 pt-6 text-left">
          <DialogTitle>{brief.title}</DialogTitle>
          <DialogDescription className="sr-only">{brief.hint}</DialogDescription>
        </DialogHeader>
        <div
          ref={scrollerRef}
          data-scroll-lock-scrollable=""
          className="max-h-[min(32rem,calc(100dvh-10.5rem))] touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain px-6 pb-3 [-webkit-overflow-scrolling:touch]"
          onTouchMove={(event) => event.stopPropagation()}
        >
          <p className="text-sm text-muted-foreground">{brief.hint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wedding-compose-groom">
                {editor.primaryName} <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="wedding-compose-groom"
                value={props.groomName}
                disabled={props.busy}
                autoComplete="name"
                onChange={(event) => props.onGroomName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wedding-compose-bride">
                {editor.secondaryName}
                {brief.requireSecondary ? <span className="text-rose-600"> *</span> : null}
              </Label>
              <Input
                id="wedding-compose-bride"
                value={props.brideName}
                disabled={props.busy}
                autoComplete="name"
                onChange={(event) => props.onBrideName(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wedding-compose-date">{brief.dateLabel}</Label>
            <Input
              id="wedding-compose-date"
              type="date"
              value={props.eventDate}
              disabled={props.busy}
              onChange={(event) => props.onEventDate(event.target.value)}
            />
          </div>
          {props.nameError ? <p className="text-sm text-rose-700">{brief.needNames}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="wedding-compose-story">{brief.notesLabel}</Label>
            <Textarea
              id="wedding-compose-story"
              value={props.storyNotes}
              disabled={props.busy}
              placeholder={brief.notesPlaceholder}
              className="min-h-28 text-base md:text-sm"
              onChange={(event) => props.onStoryNotes(event.target.value)}
            />
          </div>
          {brief.suggestions.length ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{tx.sampleComposeSuggestions}</p>
              <div className="flex flex-wrap gap-1.5">
                {brief.suggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={props.busy}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-900 disabled:opacity-50"
                    onClick={() => props.onStoryNotes(appendWeddingComposeSuggestion(props.storyNotes, item.line))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex shrink-0 gap-2 border-t border-border/70 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <Button type="button" variant="outline" className="flex-1" disabled={props.busy} onClick={props.onSkip}>
            {tx.sampleComposeCancel}
          </Button>
          <Button type="button" className="flex-[1.4]" disabled={props.busy} onClick={props.onConfirm}>
            {props.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {props.busy ? tx.sampleComposeWorking : tx.sampleComposeOk}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
