'use client'

import { useEffect, useState } from 'react'
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
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
    }
  }, [])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteHistoryItem(id)
      if (result.error) {
        toast({
          title: tr("Lỗi", "Error", "错误", "エラー", "오류"),
          description: tr("Không thể xóa ảnh. Vui lòng thử lại.", "Cannot delete image. Please try again.", "无法删除图片，请重试。", "画像を削除できません。再試行してください。", "이미지를 삭제할 수 없습니다. 다시 시도해 주세요."),
          variant: "destructive",
        })
      } else {
        toast({
          title: tr("Thành công", "Success", "成功", "成功", "성공"),
          description: tr("Đã xóa ảnh khỏi lịch sử.", "Image removed from history.", "已从历史记录中删除图片。", "履歴から画像を削除しました。", "기록에서 이미지를 삭제했습니다."),
        })
      }
    } catch {
      toast({
        title: tr("Lỗi", "Error", "错误", "エラー", "오류"),
        description: tr("Đã xảy ra lỗi không mong muốn.", "Unexpected error occurred.", "发生了意外错误。", "予期しないエラーが発生しました。", "예기치 않은 오류가 발생했습니다."),
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
          {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr('Bạn có chắc chắn muốn xóa?', 'Are you sure you want to delete?', '确定要删除吗？', '本当に削除しますか？', '정말 삭제하시겠습니까?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr('Hành động này không thể hoàn tác. Ảnh này sẽ bị xóa vĩnh viễn khỏi lịch sử của bạn.', 'This action cannot be undone. This image will be permanently removed from your history.', '此操作无法撤销。该图片将从你的历史记录中永久删除。', 'この操作は元に戻せません。この画像は履歴から完全に削除されます。', '이 작업은 되돌릴 수 없습니다. 해당 이미지는 기록에서 영구 삭제됩니다.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
