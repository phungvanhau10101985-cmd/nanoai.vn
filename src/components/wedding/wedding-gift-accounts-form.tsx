'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { VietQrBankItem } from '@/hooks/use-vietqr-banks'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Image from 'next/image'
import { buildVietQrCompactImageUrl, isInvitationGiftReady } from '@/lib/wedding/wedding-gift-vietqr'
import { WEDDING_EDIT_SIDE } from '@/lib/wedding/wedding-side-edit-color'
import { cn } from '@/lib/utils'

type Tx = Dictionary['weddingGiftBox']

type Props = {
  card: WeddingCard
  banks: VietQrBankItem[]
  tx: Tx
  update: <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => void
  hideSecondary?: boolean
  primaryTitle?: string
  secondaryTitle?: string
  hint?: string
}

export function WeddingGiftAccountsForm({ card, banks, tx, update, hideSecondary, primaryTitle, secondaryTitle, hint }: Props) {
  const groomQr = buildVietQrCompactImageUrl(card.groomGiftBankId, card.groomGiftAccountNo, {
    accountName: card.groomGiftAccountName,
  })
  const brideQr = buildVietQrCompactImageUrl(card.brideGiftBankId, card.brideGiftAccountNo, {
    accountName: card.brideGiftAccountName,
  })
  const previewOk = isInvitationGiftReady(card)
  const groomTitle = primaryTitle || tx.groomSection
  const brideTitle = secondaryTitle || tx.brideSection

  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-4">
      <p className="text-sm text-muted-foreground">{hint || tx.editorHint}</p>
      <div className={hideSecondary ? 'grid gap-6' : 'grid gap-6 md:grid-cols-2'}>
        <div className={cn('space-y-3 rounded-xl border border-dashed p-3', WEDDING_EDIT_SIDE.groom.panelBorder, WEDDING_EDIT_SIDE.groom.wash)}>
          <p className={cn('font-semibold', WEDDING_EDIT_SIDE.groom.label)}>{groomTitle}</p>
          <div className="space-y-1">
            <Label className={cn('text-xs', WEDDING_EDIT_SIDE.groom.label)}>{tx.bankSelectPlaceholder}</Label>
            <select
              className={cn('flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2', WEDDING_EDIT_SIDE.groom.fieldBorder)}
              value={card.groomGiftBankId}
              onChange={(e) => update('groomGiftBankId', e.target.value)}
            >
              <option value="">{tx.bankSelectPlaceholder}</option>
              {banks.map((b) => (
                <option key={`g-${b.code}`} value={b.code}>
                  {(b.shortName || b.name) + ` (${b.code})`}
                </option>
              ))}
            </select>
          </div>
          <Field
            label={tx.accountNumber}
            value={card.groomGiftAccountNo}
            onChange={(v) => update('groomGiftAccountNo', v)}
            side="groom"
          />
          <Field
            label={tx.accountHolder}
            value={card.groomGiftAccountName}
            onChange={(v) => update('groomGiftAccountName', v)}
            side="groom"
          />
        </div>
        {hideSecondary ? null : (
        <div className={cn('space-y-3 rounded-xl border border-dashed p-3', WEDDING_EDIT_SIDE.bride.panelBorder, WEDDING_EDIT_SIDE.bride.wash)}>
          <p className={cn('font-semibold', WEDDING_EDIT_SIDE.bride.label)}>{brideTitle}</p>
          <div className="space-y-1">
            <Label className={cn('text-xs', WEDDING_EDIT_SIDE.bride.label)}>{tx.bankSelectPlaceholder}</Label>
            <select
              className={cn('flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2', WEDDING_EDIT_SIDE.bride.fieldBorder)}
              value={card.brideGiftBankId}
              onChange={(e) => update('brideGiftBankId', e.target.value)}
            >
              <option value="">{tx.bankSelectPlaceholder}</option>
              {banks.map((b) => (
                <option key={`b-${b.code}`} value={b.code}>
                  {(b.shortName || b.name) + ` (${b.code})`}
                </option>
              ))}
            </select>
          </div>
          <Field
            label={tx.accountNumber}
            value={card.brideGiftAccountNo}
            onChange={(v) => update('brideGiftAccountNo', v)}
            side="bride"
          />
          <Field
            label={tx.accountHolder}
            value={card.brideGiftAccountName}
            onChange={(v) => update('brideGiftAccountName', v)}
            side="bride"
          />
        </div>
        )}
      </div>
      {previewOk && groomQr && (hideSecondary || brideQr) ? (
        hideSecondary ? (
          <div className="border-t border-rose-100 pt-4 text-center">
            <div className={cn('text-xs font-semibold', WEDDING_EDIT_SIDE.groom.label)}>{groomTitle}</div>
            <div className="relative mx-auto mt-2 flex w-fit justify-center rounded-lg bg-white p-2 shadow-inner">
              <Image src={groomQr} alt="" width={120} height={120} className="h-28 w-28 object-contain" unoptimized />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3 border-t border-rose-100 pt-4">
          <div className={cn('text-center text-xs font-semibold', WEDDING_EDIT_SIDE.groom.label)}>{groomTitle}</div>
          <div className={cn('text-center text-xs font-semibold', WEDDING_EDIT_SIDE.bride.label)}>{brideTitle}</div>
          <div className="relative flex justify-center rounded-lg bg-white p-2 shadow-inner">
            <Image src={groomQr} alt="" width={120} height={120} className="h-28 w-28 object-contain" unoptimized />
          </div>
          <div className="relative flex justify-center rounded-lg bg-white p-2 shadow-inner">
            <Image src={brideQr || ''} alt="" width={120} height={120} className="h-28 w-28 object-contain" unoptimized />
          </div>
        </div>
        )
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, side }: { label: string; value: string; onChange: (v: string) => void; side: 'groom' | 'bride' }) {
  const tone = WEDDING_EDIT_SIDE[side]
  return (
    <div className="space-y-1">
      <Label className={cn('text-xs', tone.label)}>{label}</Label>
      <Input className={cn('border-dashed text-sm', tone.fieldBorder)} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
