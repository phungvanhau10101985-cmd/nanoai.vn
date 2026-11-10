'use client'

import { Input } from '@/components/ui/input'
import { useVietQrBanks } from '@/hooks/use-vietqr-banks'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export type TutoringTuitionFieldValues = {
  amount: string
  days: string
  billingDay: string
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function TutoringTuitionFields({
  values,
  onChange,
  disabled,
  t,
  idPrefix,
}: {
  values: TutoringTuitionFieldValues
  onChange: (next: TutoringTuitionFieldValues) => void
  disabled?: boolean
  t: Dictionary['classes']
  idPrefix: string
}) {
  const banks = useVietQrBanks()
  const patch = (next: Partial<TutoringTuitionFieldValues>) => onChange({ ...values, ...next })

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-amount`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringTuitionAmountLabel}
        </label>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="numeric"
          value={values.amount}
          onChange={(e) => patch({ amount: e.target.value })}
          placeholder={t.tutoringTuitionAmountPlaceholder}
          disabled={disabled}
          className="w-full"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t.tutoringTuitionAmountHint}</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-days`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringDueAfterDaysLabel}
        </label>
        <Input
          id={`${idPrefix}-days`}
          inputMode="numeric"
          value={values.days}
          onChange={(e) => patch({ days: e.target.value })}
          placeholder="7"
          disabled={disabled}
          className="w-full"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t.tutoringDueAfterDaysHint}</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-billing-day`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringBillingDayLabel}
        </label>
        <Input
          id={`${idPrefix}-billing-day`}
          inputMode="numeric"
          value={values.billingDay}
          onChange={(e) => patch({ billingDay: e.target.value })}
          placeholder="4"
          disabled={disabled}
          className="w-full"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t.tutoringBillingDayHint}</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-bank`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringBankLabel}
        </label>
        <select
          id={`${idPrefix}-bank`}
          value={values.bankBin}
          disabled={disabled || banks.length === 0}
          onChange={(e) => {
            const bankBin = e.target.value
            const bank = banks.find((item) => item.bin === bankBin)
            patch({
              bankBin,
              bankName: bank?.shortName?.trim() || bank?.code?.trim() || '',
            })
          }}
          className={selectClass}
        >
          <option value="">{banks.length === 0 ? t.tutoringBankLoading : t.tutoringBankPlaceholder}</option>
          {values.bankBin && !banks.some((item) => item.bin === values.bankBin) ? (
            <option value={values.bankBin}>{values.bankName || values.bankBin}</option>
          ) : null}
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-account`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringAccountNoLabel}
        </label>
        <Input
          id={`${idPrefix}-account`}
          inputMode="numeric"
          value={values.accountNo}
          onChange={(e) => patch({ accountNo: e.target.value })}
          disabled={disabled}
          className="w-full"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-holder`} className="mb-2 block text-sm font-medium text-foreground">
          {t.tutoringAccountNameLabel}
        </label>
        <Input
          id={`${idPrefix}-holder`}
          value={values.accountName}
          onChange={(e) => patch({ accountName: e.target.value })}
          placeholder={t.tutoringAccountNamePlaceholder}
          maxLength={80}
          disabled={disabled}
          className="w-full"
          autoComplete="name"
        />
      </div>
    </div>
  )
}
