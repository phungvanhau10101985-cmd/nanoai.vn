'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { omitWeddingAddressesFromSharedCopy } from '@/lib/wedding/wedding-shared-copy'
import type { WeddingPolishField } from '@/lib/wedding/wedding-text-polish-deepseek'
import { useWeddingCreditTopUp } from '@/components/wedding/wedding-credit-topup'
import { isWeddingInsufficientCredit } from '@/lib/wedding/wedding-credit-shortfall'
import { polishWeddingCardText } from '@/app/tao-thiep-moi-cuoi-ai/actions'

type Props = {
  field: WeddingPolishField
  value: string
  onChange: (value: string) => void
  locale: WebLocale
  groomName?: string
  brideName?: string
  weddingDate?: string
  occasionKey?: string | null
  omitAddresses?: Array<string | null | undefined>
}

/** Nút chuẩn hóa một đoạn chữ. Mỗi lần 0,1 credit. Khách xem không gắn nút này. */
export function WeddingAiPolishButton(props: Props) {
  const { toast } = useToast()
  const askCreditTopUp = useWeddingCreditTopUp()
  const [polishing, setPolishing] = useState(false)
  const copy = getDictionary(props.locale).weddingCardAiImage

  const polish = async () => {
    if (!props.value.trim()) {
      toast({ title: copy.previewPolishEmptyTitle, description: copy.previewPolishEmptyBody, variant: 'destructive' })
      return
    }
    setPolishing(true)
    const formData = new FormData()
    formData.append('field', props.field)
    formData.append('draft', props.value)
    formData.append('groomName', props.groomName || '')
    formData.append('brideName', props.brideName || '')
    formData.append('weddingDate', props.weddingDate || '')
    formData.append('occasionKey', props.occasionKey || '')
    const result = await polishWeddingCardText(formData)
    setPolishing(false)
    if ('error' in result && result.error) {
      if (isWeddingInsufficientCredit(result)) {
        askCreditTopUp?.()
        toast({ title: copy.creditShortTitle, description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: copy.previewPolishFailTitle, description: result.error, variant: 'destructive' })
      return
    }
    if ('text' in result && result.text) {
      props.onChange(omitWeddingAddressesFromSharedCopy(result.text, props.omitAddresses ?? []))
      toast({ title: copy.previewPolishDoneTitle, description: copy.previewPolishDoneBody })
    }
  }

  return (
    <button
      type="button"
      data-wedding-polish=""
      disabled={polishing}
      onClick={(event) => {
        event.stopPropagation()
        void polish()
      }}
      className="relative z-[90] inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white font-semibold text-stone-800 shadow-sm disabled:opacity-60"
      style={{
        fontSize: 'calc(13px / var(--wedding-stage-scale, 1))',
        lineHeight: 1.2,
        padding: 'calc(4px / var(--wedding-stage-scale, 1)) calc(10px / var(--wedding-stage-scale, 1))',
      }}
    >
      {polishing ? (
        <Loader2 className="shrink-0 animate-spin" style={{ width: 'calc(14px / var(--wedding-stage-scale, 1))', height: 'calc(14px / var(--wedding-stage-scale, 1))' }} />
      ) : (
        <Sparkles className="shrink-0" style={{ width: 'calc(14px / var(--wedding-stage-scale, 1))', height: 'calc(14px / var(--wedding-stage-scale, 1))' }} />
      )}
      {copy.previewPolishAi}
    </button>
  )
}
