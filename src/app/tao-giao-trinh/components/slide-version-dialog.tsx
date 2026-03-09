'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Users, User } from 'lucide-react'

export type SlideVersionChoice = 'original' | 'shared' | 'personal'

interface SlideVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasPersonal: boolean
  onChoose: (choice: SlideVersionChoice) => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}

export function SlideVersionDialog({ open, onOpenChange, hasPersonal, onChoose, tr }: SlideVersionDialogProps) {
  const handleChoose = (choice: SlideVersionChoice) => {
    onChoose(choice)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('Chọn phiên bản slide', 'Choose slide version', '选择幻灯片版本', 'スライドバージョンを選択', '슬라이드 버전 선택')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {hasPersonal ? (
            <>
              <Button
                variant="outline"
                className="h-auto py-4 justify-start gap-3"
                onClick={() => handleChoose('personal')}
              >
                <User className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{tr('Bản riêng', 'Personal version', '个人版本', '個人版', '개인 버전')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr('Bản bạn đã chỉnh sửa và lưu', 'Your edited and saved version', '您已编辑并保存的版本', '編集・保存したあなたの版', '편집·저장한 내 버전')}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 justify-start gap-3"
                onClick={() => handleChoose('shared')}
              >
                <Users className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{tr('Bản chung', 'Shared version', '共享版本', '共有版', '공유 버전')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr('Mọi giáo viên dùng chung, có lịch sử chỉnh sửa', 'Shared by all teachers, with edit history', '所有教师共用，有编辑历史', '全教師で共有、編集履歴あり', '모든 교사 공유, 편집 기록 있음')}
                  </div>
                </div>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-auto py-4 justify-start gap-3"
                onClick={() => handleChoose('original')}
              >
                <FileText className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{tr('Bản gốc', 'Original version', '原始版本', 'オリジナル版', '원본 버전')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr('Bản AI tạo, có thể sửa lưu thành bản riêng', 'AI-generated, can edit and save as personal', 'AI生成，可编辑保存为个人版', 'AI生成、編集して個人版として保存可', 'AI 생성, 편집 후 개인 버전으로 저장 가능')}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 justify-start gap-3"
                onClick={() => handleChoose('shared')}
              >
                <Users className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{tr('Bản chung', 'Shared version', '共享版本', '共有版', '공유 버전')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr('Mọi giáo viên dùng chung, ai cũng có thể xem và sửa', 'Shared by all, everyone can view and edit', '所有人共用，可查看和编辑', '全員共有、閲覧・編集可', '모두 공유, 열람·편집 가능')}
                  </div>
                </div>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
