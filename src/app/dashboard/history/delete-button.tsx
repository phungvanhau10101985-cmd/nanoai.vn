'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteHistoryItem } from './actions'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DeleteHistoryButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteHistoryItem(id)
      if (result.error) {
        toast({
          title: "Lỗi",
          description: "Không thể xóa ảnh. Vui lòng thử lại.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Thành công",
          description: "Đã xóa ảnh khỏi lịch sử.",
        })
      }
    } catch {
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting}>
          {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Xóa
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Ảnh này sẽ bị xóa vĩnh viễn khỏi lịch sử của bạn.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
