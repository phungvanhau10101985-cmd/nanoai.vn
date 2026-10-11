'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { deleteResolvedCustomerErrorsAction, setCustomerErrorResolvedAction } from './actions'

function useTr() {
  const locale = typeof document === 'undefined' ? 'vi' : readWebLocaleFromDocumentCookie()
  return (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
}

export function ErrorReportRowActions({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter()
  const tr = useTr()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setCustomerErrorResolvedAction([id], !resolved)
          if ('error' in res) window.alert(res.error)
          router.refresh()
        })
      }
    >
      {resolved
        ? tr('Mở lại', 'Reopen', '重新打开', '再オープン', '다시 열기')
        : tr('Đã xử lý', 'Mark resolved', '标记已处理', '対応済みにする', '처리 완료')}
    </Button>
  )
}

export function ErrorReportsBulkActions({ openIds, showDeleteResolved }: { openIds: string[]; showDeleteResolved: boolean }) {
  const router = useRouter()
  const tr = useTr()
  const [pending, startTransition] = useTransition()
  if (!openIds.length && !showDeleteResolved) return null
  return (
    <div className="flex flex-wrap gap-2">
      {openIds.length ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await setCustomerErrorResolvedAction(openIds, true)
              if ('error' in res) window.alert(res.error)
              router.refresh()
            })
          }
        >
          {tr(
            `Đánh dấu ${openIds.length} lỗi trên trang là đã xử lý`,
            `Mark ${openIds.length} errors on this page resolved`,
            `将本页 ${openIds.length} 个错误标记为已处理`,
            `このページの ${openIds.length} 件を対応済みにする`,
            `이 페이지의 오류 ${openIds.length}건 처리 완료`
          )}
        </Button>
      ) : null}
      {showDeleteResolved ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            const ok = window.confirm(
              tr(
                'Xóa vĩnh viễn mọi lỗi đã xử lý?',
                'Permanently delete all resolved errors?',
                '永久删除所有已处理的错误？',
                '対応済みのエラーをすべて完全に削除しますか？',
                '처리된 오류를 모두 영구 삭제할까요?'
              )
            )
            if (!ok) return
            startTransition(async () => {
              const res = await deleteResolvedCustomerErrorsAction()
              if ('error' in res) window.alert(res.error)
              router.refresh()
            })
          }}
        >
          {tr('Xóa lỗi đã xử lý', 'Delete resolved', '删除已处理', '対応済みを削除', '처리된 오류 삭제')}
        </Button>
      ) : null}
    </div>
  )
}
