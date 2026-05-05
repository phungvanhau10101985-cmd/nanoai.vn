'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { VietQrBankItem } from '@/hooks/use-vietqr-banks'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Image from 'next/image'
import { buildVietQrCompactImageUrl, isTwinVietGiftReady } from '@/lib/wedding/wedding-gift-vietqr'

type Tx = Dictionary['weddingGiftBox']

type Props = {
  card: WeddingCard
  banks: VietQrBankItem[]
  tx: Tx
  update: <K extends keyof WeddingCard>(key: K, value: WeddingCard[K]) => void
}

export function WeddingGiftAccountsForm({ card, banks, tx, update }: Props) {
  const groomQr = buildVietQrCompactImageUrl(card.groomGiftBankId, card.groomGiftAccountNo, {
    accountName: card.groomGiftAccountName,
  })
  const brideQr = buildVietQrCompactImageUrl(card.brideGiftBankId, card.brideGiftAccountNo, {
    accountName: card.brideGiftAccountName,
  })
  const previewOk = isTwinVietGiftReady(card)

  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-4">
      <p className="text-sm text-muted-foreground">{tx.editorHint}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="font-semibold text-rose-900">{tx.groomSection}</p>
          <div className="space-y-1">
            <Label className="text-xs">{tx.bankSelectPlaceholder}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          />
          <Field
            label={tx.accountHolder}
            value={card.groomGiftAccountName}
            onChange={(v) => update('groomGiftAccountName', v)}
          />
        </div>
        <div className="space-y-3">
          <p className="font-semibold text-rose-900">{tx.brideSection}</p>
          <div className="space-y-1">
            <Label className="text-xs">{tx.bankSelectPlaceholder}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          />
          <Field
            label={tx.accountHolder}
            value={card.brideGiftAccountName}
            onChange={(v) => update('brideGiftAccountName', v)}
          />
        </div>
      </div>
      {previewOk && groomQr && brideQr && (
        <div className="grid grid-cols-2 gap-3 border-t border-rose-100 pt-4">
          <div className="text-center text-xs text-muted-foreground">{tx.groomSection}</div>
          <div className="text-center text-xs text-muted-foreground">{tx.brideSection}</div>
          <div className="relative flex justify-center rounded-lg bg-white p-2 shadow-inner">
            <Image src={groomQr} alt="" width={120} height={120} className="h-28 w-28 object-contain" unoptimized />
          </div>
          <div className="relative flex justify-center rounded-lg bg-white p-2 shadow-inner">
            <Image src={brideQr} alt="" width={120} height={120} className="h-28 w-28 object-contain" unoptimized />
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
