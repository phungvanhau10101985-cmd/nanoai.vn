'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  buildVietQrCompactImageUrl,
  isBrideVietGiftReady,
  isGroomVietGiftReady,
  isLegacySingleGiftImage,
  isTwinVietGiftReady,
} from '@/lib/wedding/wedding-gift-vietqr'
import { fetchVietQRImage } from '@/app/tao-ma-vach/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { weddingGiftBoxLook, type WeddingGiftBoxLook } from '@/lib/wedding/wedding-gift-box-look'
import { cn } from '@/lib/utils'

type Tx = Dictionary['weddingGiftBox']

function GiftPhoto(props: { src: string; opening: boolean }) {
  return (
    <span className="relative block h-64 w-64 [perspective:1400px] sm:h-72 sm:w-72">
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-[16%] bottom-[7%] h-4 rounded-[100%] bg-black/25 blur-md transition-transform duration-700',
          props.opening && 'scale-x-125',
        )}
      />
      <span
        className={cn('relative block h-full w-full', !props.opening && 'animate-wedding-gift-wobble')}
        style={{
          transformOrigin: 'center 82%',
          transform: props.opening ? 'translateY(-28px) rotateX(-16deg) scale(1.05)' : 'translateY(0) rotateX(0deg) scale(1)',
          transition: 'transform 700ms cubic-bezier(0.22, 0.8, 0.28, 1), filter 700ms ease',
          filter: props.opening
            ? 'drop-shadow(0 22px 18px rgba(90, 55, 25, 0.28))'
            : 'drop-shadow(0 12px 12px rgba(70, 45, 25, 0.16))',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh hộp tĩnh trong public */}
        <img src={props.src} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
        <span
          className={cn('pointer-events-none absolute inset-[18%] rounded-full blur-xl transition-opacity duration-500', props.opening ? 'opacity-100' : 'opacity-0')}
          style={{ background: 'radial-gradient(circle, rgba(255,244,214,0.85), rgba(255,220,160,0.28) 55%, transparent 72%)' }}
          aria-hidden
        />
      </span>
    </span>
  )
}

async function downloadGiftQrPng(src: string, filename: string) {
  let href = src
  let revoke = false
  if (src.startsWith('https://img.vietqr.io/image')) {
    const result = await fetchVietQRImage(src)
    if (!result.dataUrl) return
    href = result.dataUrl
  } else {
    try {
      const res = await fetch(src)
      if (res.ok) {
        href = URL.createObjectURL(await res.blob())
        revoke = true
      }
    } catch {
      // Ảnh ngoài origin: trình duyệt mở link tải trực tiếp.
    }
  }
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noreferrer'
  link.click()
  if (revoke) URL.revokeObjectURL(href)
}

type Props = {
  card: WeddingCard
  tx: Tx
  className?: string
  sideFilter?: 'groom' | 'bride' | null
  seal?: string
  look?: WeddingGiftBoxLook
}

/** Hộp lì xì rung nhẹ; mở dialog hiển thị VietQR cô dâu / chú rể (hoặc ảnh QR cũ). */
export function WeddingGiftEnvelopeBlock({ card, tx, className, sideFilter = null, seal = '囍', look = weddingGiftBoxLook(null) }: Props) {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const openTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (openTimer.current != null) window.clearTimeout(openTimer.current)
    }
  }, [])

  const openBox = () => {
    if (open || opening) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setOpen(true)
      return
    }
    setOpening(true)
    openTimer.current = window.setTimeout(() => setOpen(true), 860)
  }

  const saveQr = (src: string, filename: string) => {
    if (downloading) return
    setDownloading(src)
    void downloadGiftQrPng(src, filename).finally(() => setDownloading(null))
  }
  const twin = isTwinVietGiftReady(card)
  const legacyOnly = !twin && isLegacySingleGiftImage(card)
  const showBride = !sideFilter || sideFilter === 'bride'
  const showGroom = !sideFilter || sideFilter === 'groom'
  const groomReady = isGroomVietGiftReady(card)
  const brideReady = isBrideVietGiftReady(card)
  const brideSrc =
    brideReady ?
      buildVietQrCompactImageUrl(card.brideGiftBankId, card.brideGiftAccountNo, {
        accountName: card.brideGiftAccountName,
      })
    : null
  const groomSrc =
    groomReady ?
      buildVietQrCompactImageUrl(card.groomGiftBankId, card.groomGiftAccountNo, {
        accountName: card.groomGiftAccountName,
      })
    : null

  return (
    <>
      <section
        className={cn(
          'mx-auto flex max-w-lg flex-col items-center px-4 py-10 text-center sm:py-12',
          className,
        )}
      >
        <h2 className="font-serif text-lg font-semibold tracking-wide" style={{ color: look.title }}>{tx.boxTitle}</h2>
        <button
          type="button"
          onClick={openBox}
          aria-label={tx.envelopeButtonAria}
          data-gift-look={look.id}
          data-gift-seal={seal}
          data-gift-opening={opening ? '1' : '0'}
          className="group relative mt-5 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:mt-6"
          style={{ ['--tw-ring-color' as string]: look.edge }}
        >
          <span
            className="pointer-events-none absolute inset-6 rounded-full opacity-70 blur-2xl transition group-hover:opacity-100"
            style={{ background: look.glow }}
            aria-hidden
          />
          <GiftPhoto src={look.photo} opening={opening} />
        </button>
        <p className="mt-4 text-sm" style={{ color: look.title, opacity: 0.72 }}>{tx.tapToOpen}</p>
      </section>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setOpening(false)
        }}
      >
        <DialogContent className="max-h-[92svh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#5c4033]">{tx.dialogTitle}</DialogTitle>
            <DialogDescription className="text-left">{tx.vietqrFooterNote}</DialogDescription>
          </DialogHeader>

          {(showBride && brideSrc) || (showGroom && groomSrc) ? (
            <div className={cn('grid gap-6', sideFilter || !(showBride && showGroom) ? 'grid-cols-1' : 'sm:grid-cols-2')}>
              {showBride && brideSrc ? (
                <div className="flex flex-col items-center rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
                  <p className="mb-3 font-semibold text-rose-950">{tx.brideSection}</p>
                  <div className="relative h-52 w-full max-w-[13rem] overflow-hidden rounded-lg bg-white p-2 shadow-inner">
                    <Image
                      src={brideSrc}
                      alt={tx.qrAltBride}
                      width={208}
                      height={208}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full max-w-[13rem]"
                    disabled={downloading === brideSrc}
                    onClick={() => saveQr(brideSrc, `vietqr-${card.brideGiftAccountNo || 'co-dau'}.png`)}
                  >
                    {tx.downloadQr}
                  </Button>
                  <p className="mt-2 max-w-[13rem] text-center text-sm text-muted-foreground">
                    {card.brideGiftAccountName}
                    <span className="mt-1 block font-mono text-xs text-slate-600">{card.brideGiftAccountNo}</span>
                  </p>
                </div>
              ) : null}
              {showGroom && groomSrc ? (
                <div className="flex flex-col items-center rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
                  <p className="mb-3 font-semibold text-rose-950">{tx.groomSection}</p>
                  <div className="relative h-52 w-full max-w-[13rem] overflow-hidden rounded-lg bg-white p-2 shadow-inner">
                    <Image
                      src={groomSrc}
                      alt={tx.qrAltGroom}
                      width={208}
                      height={208}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full max-w-[13rem]"
                    disabled={downloading === groomSrc}
                    onClick={() => saveQr(groomSrc, `vietqr-${card.groomGiftAccountNo || 'chu-re'}.png`)}
                  >
                    {tx.downloadQr}
                  </Button>
                  <p className="mt-2 max-w-[13rem] text-center text-sm text-muted-foreground">
                    {card.groomGiftAccountName}
                    <span className="mt-1 block font-mono text-xs text-slate-600">{card.groomGiftAccountNo}</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {legacyOnly && card.giftQrImageUrl.trim() && (
            <div className="flex flex-col items-center">
              <div className="relative max-h-72 w-full max-w-xs overflow-hidden rounded-xl border bg-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL tùy chỉnh chủ thiệp */}
                <img src={card.giftQrImageUrl} alt={tx.qrAltLegacy} className="mx-auto max-h-[17rem] w-auto object-contain" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full max-w-xs"
                disabled={downloading === card.giftQrImageUrl}
                onClick={() => saveQr(card.giftQrImageUrl.trim(), 'qr-mung-cuoi.png')}
              >
                {tx.downloadQr}
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tx.closeButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
