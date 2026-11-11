'use client'

import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WeddingGuestPackSide, WeddingGuestSideQuotas } from '@/lib/wedding/wedding-guest-pack'
import { splitWeddingGuestBulkBatch, WEDDING_GUEST_BULK_MAX_CHARS } from '@/lib/wedding/wedding-guest-bulk-names'
import { addWeddingInvitedGuestsBulk } from './actions'

type Props = {
  cardId: string
  side: WeddingGuestPackSide
  disabled?: boolean
  onAdded?: () => void | Promise<void>
  onNeedPack?: (side: WeddingGuestPackSide, quotas: WeddingGuestSideQuotas | null) => void
}

export function WeddingSideGuestBulkBar({ cardId, side, disabled, onAdded, onNeedPack }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const sideLabel = side === 'bride' ? 'nhà gái' : 'nhà trai'
  const blocked = disabled || !cardId || saving
  const overLimit = text.length > WEDDING_GUEST_BULK_MAX_CHARS
  const maxLabel = WEDDING_GUEST_BULK_MAX_CHARS.toLocaleString('vi-VN')

  const submit = async () => {
    if (!cardId || saving) return
    const { batch, rest } = splitWeddingGuestBulkBatch(text)
    if (!batch.trim()) return
    setSaving(true)
    const result = await addWeddingInvitedGuestsBulk(cardId, side, batch)
    setSaving(false)
    if ('code' in result && result.code === 'guest_pack_limit') {
      onNeedPack?.(result.side === 'bride' ? 'bride' : side, result.quotas ?? null)
      toast({ title: 'Hết chỗ khách', description: result.error })
      return
    }
    if ('error' in result && result.error) {
      const bare = 'rejected' in result && Array.isArray(result.rejected) && result.rejected.length
        ? ` Chỗ chưa đủ danh xưng: ${result.rejected.slice(0, 4).join(', ')}.`
        : ''
      toast({ title: 'Chưa thêm được khách', description: `${result.error}${bare}`, variant: 'destructive' })
      return
    }
    if (!('created' in result)) return
    const leftover = rest.trim()
    const notes = [
      result.skippedDuplicate ? `Bỏ ${result.skippedDuplicate} khách đã có.` : '',
      result.rejected?.length ? `Bỏ ${result.rejected.length} chỗ thiếu danh xưng.` : '',
      result.held ? `${result.held} khách chưa thêm vì đã đủ gói.` : '',
      leftover ? 'Phần còn lại vẫn trong ô. Bấm Tạo danh sách lần nữa.' : '',
    ].filter(Boolean)
    toast({
      title: result.created ? `Đã thêm ${result.created} khách ${sideLabel}` : 'Không có khách mới',
      description: notes.join(' ') || 'Danh sách đã được chuẩn hóa.',
    })
    if (result.held) onNeedPack?.(side, null)
    if (result.created || leftover) {
      setText(leftover)
      if (!leftover && result.created) setOpen(false)
      if (result.created) await onAdded?.()
    }
  }

  return (
    <>
      <Button
        type="button"
        className="h-11 w-full bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600 sm:h-10 sm:w-auto"
        disabled={blocked}
        onClick={() => setOpen(true)}
      >
        <Users className="mr-2 h-4 w-4" />
        Thêm hàng loạt
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm khách {sideLabel} hàng loạt</DialogTitle>
            <DialogDescription>
              Viết thế nào cũng được: dính chữ, thiếu dấu, gõ telex, sai chính tả. AI tách thành danh xưng và tên,
              bỏ khách trùng. Mỗi lần tối đa {maxLabel} ký tự. Ví dụ bạn Hoa Bạn Mai Bạn Lương thành Bạn Hoa, Bạn
              Mai, Bạn Lương. Tên không có danh xưng như Viễn sẽ được bỏ.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder="Viết đầy đủ danh xưng và tên"
            disabled={saving}
            aria-describedby={`wedding-guest-bulk-limit-${side}`}
          />
          <div id={`wedding-guest-bulk-limit-${side}`} className="space-y-1">
            <p className={`text-right text-xs ${overLimit ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}>
              {text.length.toLocaleString('vi-VN')} / {maxLabel} ký tự
            </p>
            {overLimit ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                Đã quá {maxLabel} ký tự. Bấm Tạo danh sách cho phần này. Phần còn lại giữ trong ô để viết tiếp và tạo
                lần sau.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="button" disabled={saving || !text.trim()} onClick={() => void submit()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Tạo danh sách
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
