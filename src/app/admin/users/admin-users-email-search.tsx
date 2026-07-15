'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, X } from 'lucide-react'
import { buildAdminUsersHref, parseAdminUsersSort } from './admin-users-query'

export function AdminUsersEmailSearch({ defaultEmail }: { defaultEmail: string }) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sort, dir } = parseAdminUsersSort({
    sort: searchParams.get('sort') ?? undefined,
    dir: searchParams.get('dir') ?? undefined,
  })
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value.trim()
    router.push(
      buildAdminUsersHref({
        email,
        sort,
        dir,
      })
    )
  }

  const handleClear = () => {
    router.push(buildAdminUsersHref({ sort, dir }))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1 space-y-1.5 sm:max-w-md">
        <Label htmlFor="admin-users-email" className="text-xs">
          {tr('Tìm theo email', 'Search by email', '按邮箱搜索', 'メールで検索', '이메일로 검색')}
        </Label>
        <Input
          id="admin-users-email"
          name="email"
          type="search"
          defaultValue={defaultEmail}
          placeholder={tr('Nhập email...', 'Enter email...', '输入邮箱...', 'メールアドレスを入力...', '이메일 입력...')}
          autoComplete="off"
          className="h-9"
        />
      </div>
      <Button type="submit" size="sm" className="h-9 gap-1.5">
        <Search className="h-4 w-4" />
        {tr('Tìm kiếm', 'Search', '搜索', '検索', '검색')}
      </Button>
      {defaultEmail ? (
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleClear}>
          <X className="h-4 w-4" />
          {tr('Xóa lọc', 'Clear', '清除', 'クリア', '초기화')}
        </Button>
      ) : null}
    </form>
  )
}
