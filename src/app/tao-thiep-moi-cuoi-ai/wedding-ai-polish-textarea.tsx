'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { WeddingPolishField } from '@/lib/wedding/wedding-text-polish-deepseek'
import { polishWeddingCardText } from './actions'

type Props = {
  label: string
  field: WeddingPolishField
  value: string
  onChange: (value: string) => void
  card: WeddingCard
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
  weddingDateLabel,
  placeholder,
  className,
  hint,
}: Props) {
  const { toast } = useToast()
  const [polishing, setPolishing] = useState(false)

  const polish = async () => {
    if (!value.trim()) {
      toast({
        title: 'Chưa có nội dung',
        description: 'Gõ sơ ý của bạn rồi bấm «Tối ưu AI» — AI sẽ viết lại cho hay và mượt hơn.',
        variant: 'destructive',
      })
      return
    }
    setPolishing(true)
    const formData = new FormData()
    formData.append('field', field)
    formData.append('draft', value)
    formData.append('groomName', card.groomName)
    formData.append('brideName', card.brideName)
    formData.append('weddingDate', weddingDateLabel || card.weddingDate || '')
    formData.append('venue', card.venue)
    const result = await polishWeddingCardText(formData)
    setPolishing(false)
    if ('error' in result && result.error) {
      toast({ title: 'Tối ưu thất bại', description: result.error, variant: 'destructive' })
      return
    }
    if ('text' in result && result.text) {
      onChange(result.text)
      toast({ title: 'Đã tối ưu bằng AI', description: 'Bạn có thể chỉnh thêm hoặc bấm lại nếu chưa ưng ý.' })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Label className="leading-snug">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={polishing}
          onClick={() => void polish()}
          title="DeepSeek viết lại cho hay, mượt — giữ ý bạn đã nhập"
        >
          {polishing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          Tối ưu AI
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={polishing}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
