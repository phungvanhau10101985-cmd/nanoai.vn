'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { updateUserCredit } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function EditCreditDialog({ userId, currentBalance }: { userId: string; currentBalance: number }) {
  const [open, setOpen] = useState(false)
  const [newBalance, setNewBalance] = useState(currentBalance)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    setIsLoading(true)
    const result = await updateUserCredit(userId, newBalance)
    setIsLoading(false)

    if (result.error) {
      toast({ title: 'Lỗi', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Thành công', description: 'Đã cập nhật số dư tín dụng.' })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Chỉnh sửa</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tín dụng</DialogTitle>
          <DialogDescription>
            Nhập số dư tín dụng mới cho người dùng. Nhấn lưu để áp dụng.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="balance" className="text-right">
              Số dư mới
            </Label>
            <Input
              id="balance"
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
