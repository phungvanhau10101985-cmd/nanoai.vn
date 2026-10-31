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

  const submit = async () => {
    if (!cardId || saving) return
    setSaving(true)
    const result = await addWeddingInvitedGuestsBulk(cardId, side, text)
    setSaving(false)
    if ('code' in result && result.code === 'guest_pack_limit') {
      onNeedPack?.(result.side === 'bride' ? 'bride' : side, result.quotas ?? null)
      toast({ title: 'Hết chỗ khách', description: result.error })
      return
    }
    if ('error' in result && result.error) {
      const bare = 'rejected' in result && Array.isArray(result.rejected) && result.rejected.length
        ? ` Dòng chưa đủ danh xưng: ${result.rejected.slice(0, 4).join(', ')}.`
        : ''
      toast({ title: 'Chưa thêm được khách', description: `${result.error}${bare}`, variant: 'destructive' })
      return
    }
    if (!('created' in result)) return
    const notes = [
      result.skippedDuplicate ? `Bỏ ${result.skippedDuplicate} khách đã có.` : '',
      result.rejected.length ? `Bỏ ${result.rejected.length} dòng thiếu danh xưng.` : '',
      result.held ? `${result.held} khách chưa thêm vì đã đủ gói.` : '',
    ].filter(Boolean)
    toast({
      title: result.created ? `Đã thêm ${result.created} khách ${sideLabel}` : 'Không có khách mới',
      description: notes.join(' ') || 'Danh sách đã được chuẩn hóa.',
    })
    if (result.held) onNeedPack?.(side, null)
    if (result.created) {
      setText('')
      setOpen(false)
      await onAdded?.()
    }
  }

  return (
    <>
      <div className="rounded-xl border border-dashed bg-background px-3 py-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Thêm nhiều khách {sideLabel} một lúc. Mỗi dòng một khách, ghi đủ danh xưng và tên.
          {!cardId ? ' Lưu thiệp trước khi thêm.' : ''}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 sm:h-9"
          disabled={blocked}
          onClick={() => setOpen(true)}
        >
          <Users className="mr-2 h-4 w-4" />
          Thêm khách mời hàng loạt
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm khách {sideLabel} hàng loạt</DialogTitle>
            <DialogDescription>
              Mỗi dòng một khách. Ghi đủ danh xưng và tên, ví dụ Cậu Viễn, Bạn Hưng. Không nhập tên cộc như Viễn.
              Bấm OK để chuẩn hóa tên, bỏ khách trùng và thêm khách mới vào danh sách.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder={'Cậu Viễn\nBạn Hưng\nAnh Minh'}
            disabled={saving}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="button" disabled={saving || !text.trim()} onClick={() => void submit()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
