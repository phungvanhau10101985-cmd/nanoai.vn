'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  buildVietQrCompactImageUrl,
  isLegacySingleGiftImage,
  isTwinVietGiftReady,
} from '@/lib/wedding/wedding-gift-vietqr'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Tx = Dictionary['weddingGiftBox']

type Props = {
  card: WeddingCard
  tx: Tx
  className?: string
}

/** Hộp lì xì rung nhẹ; mở dialog hiển thị VietQR cô dâu / chú rể (hoặc ảnh QR cũ). */
export function WeddingGiftEnvelopeBlock({ card, tx, className }: Props) {
  const [open, setOpen] = useState(false)
  const twin = isTwinVietGiftReady(card)
  const legacyOnly = !twin && isLegacySingleGiftImage(card)
  const brideSrc =
    twin ?
      buildVietQrCompactImageUrl(card.brideGiftBankId, card.brideGiftAccountNo, {
        accountName: card.brideGiftAccountName,
      })
    : null
  const groomSrc =
    twin ?
      buildVietQrCompactImageUrl(card.groomGiftBankId, card.groomGiftAccountNo, {
        accountName: card.groomGiftAccountName,
      })
    : null

  return (
    <>
      <section
        className={cn(
          'mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center',
          className,
        )}
      >
        <h2 className="font-serif text-lg font-semibold tracking-wide text-[#5c4033]">{tx.boxTitle}</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tx.envelopeButtonAria}
          className="group relative mt-6 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded-2xl"
        >
          <span
            className="pointer-events-none absolute -inset-6 rounded-3xl opacity-80 blur-2xl transition group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(250,204,21,0.55) 0%, rgba(254,243,199,0.25) 45%, transparent 70%)',
            }}
            aria-hidden
          />
          {/* xu trang trí */}
          <span className="pointer-events-none absolute -left-8 top-4 h-10 w-10 rounded-full border-2 border-amber-600 bg-gradient-to-br from-amber-300 to-amber-500 shadow-md ring-2 ring-amber-800/20 [transform:rotate(-12deg)]" aria-hidden />
          <span className="pointer-events-none absolute -right-6 bottom-8 h-9 w-9 rounded-full border-2 border-amber-600 bg-gradient-to-br from-amber-300 to-amber-500 shadow-md ring-2 ring-amber-800/15 [transform:rotate(18deg)]" aria-hidden />
          <span className="pointer-events-none absolute left-2 -top-5 h-8 w-8 rounded-full border border-amber-700 bg-amber-400/90 opacity-90 [transform:rotate(8deg)]" aria-hidden />

          <span
            className="relative flex h-52 w-40 flex-col items-center justify-center rounded-xl border-2 border-amber-500/90 bg-gradient-to-b from-red-700 via-red-800 to-red-950 shadow-2xl animate-wedding-gift-wobble md:h-60 md:w-48"
            style={{ boxShadow: '0 12px 40px rgba(185, 28, 28, 0.35), inset 0 1px 0 rgba(254, 249, 231, 0.12)' }}
          >
            <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 border-l-2 border-t-2 border-amber-400/80" aria-hidden />
            <span className="pointer-events-none absolute right-1 top-1 h-5 w-5 border-r-2 border-t-2 border-amber-400/80" aria-hidden />
            <span className="pointer-events-none absolute bottom-1 left-1 h-5 w-5 border-b-2 border-l-2 border-amber-400/80" aria-hidden />
            <span className="pointer-events-none absolute bottom-1 right-1 h-5 w-5 border-b-2 border-r-2 border-amber-400/80" aria-hidden />
            <span className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-full border-[3px] border-amber-400 bg-gradient-to-br from-amber-200 via-amber-100 to-yellow-400 shadow-inner">
              <span className="select-none font-serif text-3xl font-bold text-red-800 drop-shadow-sm">囍</span>
            </span>
          </span>
        </button>
        <p className="mt-4 text-sm text-muted-foreground">{tx.tapToOpen}</p>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#5c4033]">{tx.dialogTitle}</DialogTitle>
            <DialogDescription className="text-left">{tx.vietqrFooterNote}</DialogDescription>
          </DialogHeader>

          {twin && brideSrc && groomSrc && (
            <div className="grid gap-6 sm:grid-cols-2">
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
                <p className="mt-2 max-w-[13rem] text-center text-sm text-muted-foreground">
                  {card.brideGiftAccountName}
                  <span className="mt-1 block font-mono text-xs text-slate-600">{card.brideGiftAccountNo}</span>
                </p>
              </div>
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
                <p className="mt-2 max-w-[13rem] text-center text-sm text-muted-foreground">
                  {card.groomGiftAccountName}
                  <span className="mt-1 block font-mono text-xs text-slate-600">{card.groomGiftAccountNo}</span>
                </p>
              </div>
            </div>
          )}

          {legacyOnly && card.giftQrImageUrl.trim() && (
            <div className="flex flex-col items-center">
              <div className="relative max-h-72 w-full max-w-xs overflow-hidden rounded-xl border bg-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL tùy chỉnh chủ thiệp */}
                <img src={card.giftQrImageUrl} alt={tx.qrAltLegacy} className="mx-auto max-h-[17rem] w-auto object-contain" />
              </div>
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
