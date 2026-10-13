'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { setHomeworkUnsolvedResolvedAction } from './actions'

function useTr() {
  const locale = typeof document === 'undefined' ? 'vi' : readWebLocaleFromDocumentCookie()
  return (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
}

export function HomeworkUnsolvedRowActions({ id, resolved }: { id: string; resolved: boolean }) {
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
          const res = await setHomeworkUnsolvedResolvedAction([id], !resolved)
          if ('error' in res) window.alert(res.error)
          router.refresh()
        })
      }
    >
      {resolved
        ? tr('Mở lại', 'Reopen', '重新打开', '再オープン', '다시 열기')
        : tr('Đã xem', 'Mark seen', '标记已看', '確認済み', '확인함')}
    </Button>
  )
}
