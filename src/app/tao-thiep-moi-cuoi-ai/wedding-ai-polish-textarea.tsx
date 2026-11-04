'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { omitWeddingAddressesFromSharedCopy } from '@/lib/wedding/wedding-shared-copy'
import type { WeddingPolishField } from '@/lib/wedding/wedding-text-polish-deepseek'
import {
  WEDDING_TEXT_POLISH_CREDIT_LABEL,
  weddingPolishFieldCostsCredit,
} from '@/lib/wedding/wedding-text-polish-credit'
import { useWeddingCreditTopUp } from '@/components/wedding/wedding-credit-topup'
import { isWeddingInsufficientCredit } from '@/lib/wedding/wedding-credit-shortfall'
import { polishWeddingCardText } from './actions'

type Props = {
  label: string
  field: WeddingPolishField
  value: string
  onChange: (value: string) => void
  card?: Pick<WeddingCard, 'groomName' | 'brideName' | 'weddingDate' | 'occasionKey'> | null
  omitAddresses?: Array<string | null | undefined>
  weddingDateLabel?: string
  placeholder?: string
  className?: string
  hint?: string
}

export function WeddingAiPolishTextarea({
  label,
  field,
  value,
  onChange,
  card,
  omitAddresses,
  weddingDateLabel,
  placeholder,
  className,
  hint,
}: Props) {
  const { toast } = useToast()
  const askCreditTopUp = useWeddingCreditTopUp()
  const [polishing, setPolishing] = useState(false)
  const costsCredit = weddingPolishFieldCostsCredit(field)

  const polish = async () => {
    if (!value.trim()) {
      toast({
        title: 'Chưa có nội dung',
        description: `Gõ sơ ý của bạn rồi bấm «Chuẩn hóa AI · ${WEDDING_TEXT_POLISH_CREDIT_LABEL}» — AI sẽ viết lại cho hay và mượt hơn.`,
        variant: 'destructive',
      })
      return
    }
    setPolishing(true)
    const formData = new FormData()
    formData.append('field', field)
    formData.append('draft', value)
    formData.append('groomName', card?.groomName || '')
    formData.append('brideName', card?.brideName || '')
    formData.append('weddingDate', weddingDateLabel || card?.weddingDate || '')
    formData.append('occasionKey', card?.occasionKey || '')
    const result = await polishWeddingCardText(formData)
    setPolishing(false)
    if ('error' in result && result.error) {
      if (isWeddingInsufficientCredit(result)) {
        askCreditTopUp?.()
        return
      }
      toast({ title: 'Tối ưu thất bại', description: result.error, variant: 'destructive' })
      return
    }
    if ('text' in result && result.text) {
      onChange(omitWeddingAddressesFromSharedCopy(result.text, omitAddresses ?? []))
      const charged = 'charged' in result ? Number(result.charged) || 0 : 0
      toast({
        title: 'Đã tối ưu bằng AI',
        description:
          charged > 0
            ? `Đã trừ ${WEDDING_TEXT_POLISH_CREDIT_LABEL}. Bạn có thể chỉnh thêm hoặc bấm lại nếu chưa ưng ý.`
            : 'Bạn có thể chỉnh thêm hoặc bấm lại nếu chưa ưng ý.',
      })
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <Label className="min-w-[11rem] flex-1 text-sm leading-snug">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 max-w-full shrink-0 px-2.5 text-xs"
          disabled={polishing}
          onClick={() => void polish()}
          title={
            costsCredit
              ? `Chuẩn hóa cho hay hơn. Mỗi lần ${WEDDING_TEXT_POLISH_CREDIT_LABEL}.`
              : 'DeepSeek viết lại cho hay, mượt — giữ ý bạn đã nhập'
          }
        >
          {polishing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          {costsCredit ? `Chuẩn hóa AI · ${WEDDING_TEXT_POLISH_CREDIT_LABEL}` : 'Chuẩn hóa AI'}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className ? `w-full min-w-0 ${className}` : 'w-full min-w-0'}
        disabled={polishing}
      />
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
