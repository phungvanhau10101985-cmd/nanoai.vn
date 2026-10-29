'use client'

import { useState } from 'react'
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
import { weddingGiftBoxLook, type WeddingGiftBoxLook, type WeddingGiftBoxMark } from '@/lib/wedding/wedding-gift-box-look'
import { cn } from '@/lib/utils'

type Tx = Dictionary['weddingGiftBox']

function GiftMark(props: { mark: WeddingGiftBoxMark; seal: string }) {
  if (props.mark === 'double-happiness') {
    return <span className="select-none font-serif text-3xl font-bold drop-shadow-sm">{props.seal}</span>
  }
  const common = { viewBox: '0 0 32 32', className: 'h-10 w-10', 'aria-hidden': true as const }
  if (props.mark === 'leaf') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M7 23c3-9 9-15 18-17-3 9-8 15-16 18-1 0-2 0-2-1Z" />
        <path d="M9 21c5-5 9-9 13-13" stroke="#fbf8f3" strokeWidth="1.15" strokeLinecap="round" />
      </svg>
    )
  }
  if (props.mark === 'lotus') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M16 26c-1-6-1-12 0-18 1 6 1 12 0 18Z" />
        <path fill="currentColor" d="M16 24c-6-1-11-6-9-12 5 2 8 6 9 12Z" />
        <path fill="currentColor" d="M16 24c6-1 11-6 9-12-5 2-8 6-9 12Z" />
        <path fill="currentColor" d="M16 22c-3 0-7-4-6-9 3 1 5 4 6 9Z" opacity="0.85" />
        <path fill="currentColor" d="M16 22c3 0 7-4 6-9-3 1-5 4-6 9Z" opacity="0.85" />
      </svg>
    )
  }
  if (props.mark === 'rose') {
    return (
      <svg {...common}>
        <circle cx="16" cy="15" r="3" fill="currentColor" />
        <path fill="currentColor" d="M16 12c3-4 8-3 8 1-3 1-6 1-8 2-2-1-5-1-8-2 0-4 5-5 8-1Z" />
        <path fill="currentColor" d="M13 16c-4 2-5 7-2 9 2-3 3-6 5-8-1 0-2 0-3-1Z" />
        <path fill="currentColor" d="M19 16c4 2 5 7 2 9-2-3-3-6-5-8 1 0 2 0 3-1Z" />
        <path d="M16 20v7M16 24c-4 1-6 0-7-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common} fill="none">
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
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
  const [downloading, setDownloading] = useState<string | null>(null)

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
          onClick={() => setOpen(true)}
          aria-label={tx.envelopeButtonAria}
          data-gift-look={look.id}
          className="group relative mt-5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:mt-6"
          style={{ ['--tw-ring-color' as string]: look.edge }}
        >
          <span
            className="pointer-events-none absolute -inset-6 rounded-3xl opacity-80 blur-2xl transition group-hover:opacity-100"
            style={{ background: look.glow }}
            aria-hidden
          />
          {look.scatter !== 'none' ? (
            <>
              <span className="pointer-events-none absolute -left-8 top-4 h-10 w-10 rounded-full border-2 shadow-md [transform:rotate(-12deg)]" style={{ borderColor: look.coinEdge, backgroundImage: `linear-gradient(to bottom right, ${look.coinFrom}, ${look.coinTo})` }} aria-hidden />
              <span className="pointer-events-none absolute -right-6 bottom-8 h-9 w-9 rounded-full border-2 shadow-md [transform:rotate(18deg)]" style={{ borderColor: look.coinEdge, backgroundImage: `linear-gradient(to bottom right, ${look.coinFrom}, ${look.coinTo})` }} aria-hidden />
              <span className="pointer-events-none absolute left-2 -top-5 h-8 w-8 rounded-full border opacity-90 [transform:rotate(8deg)]" style={{ borderColor: look.coinEdge, backgroundImage: `linear-gradient(to bottom right, ${look.coinFrom}, ${look.coinTo})` }} aria-hidden />
            </>
          ) : null}

          <span
            className="relative flex h-48 w-36 flex-col items-center justify-center rounded-xl border-2 shadow-2xl animate-wedding-gift-wobble sm:h-52 sm:w-40 md:h-60 md:w-48"
            style={{ background: look.box, borderColor: look.edge, boxShadow: look.shadow }}
          >
            <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 border-l-2 border-t-2" style={{ borderColor: look.corner }} aria-hidden />
            <span className="pointer-events-none absolute right-1 top-1 h-5 w-5 border-r-2 border-t-2" style={{ borderColor: look.corner }} aria-hidden />
            <span className="pointer-events-none absolute bottom-1 left-1 h-5 w-5 border-b-2 border-l-2" style={{ borderColor: look.corner }} aria-hidden />
            <span className="pointer-events-none absolute bottom-1 right-1 h-5 w-5 border-b-2 border-r-2" style={{ borderColor: look.corner }} aria-hidden />
            <span
              className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-full border-[3px] shadow-inner"
              style={{ background: look.sealPlate, borderColor: look.sealEdge, color: look.sealInk }}
            >
              <GiftMark mark={look.mark} seal={seal} />
            </span>
          </span>
        </button>
        <p className="mt-4 text-sm" style={{ color: look.title, opacity: 0.72 }}>{tx.tapToOpen}</p>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
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
