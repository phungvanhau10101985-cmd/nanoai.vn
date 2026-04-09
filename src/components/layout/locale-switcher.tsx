'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  WEB_LOCALES,
  type WebLocale,
} from '@/lib/i18n/config'

type LocaleSwitcherProps = {
  currentLocale: WebLocale
}

const LABELS: Record<WebLocale, string> = {
  vi: 'VI',
  en: 'EN',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const setLocale = (locale: WebLocale) => {
    if (locale === currentLocale) return
    const maxAge = 31536000
    const tail = `; path=/; max-age=${maxAge}; samesite=lax`
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}${tail}`
    document.cookie = `${LOCALE_COOKIE_NAME_LEGACY}=${locale}${tail}`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="hidden md:flex items-center gap-1 rounded-md border p-1">
      {WEB_LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          variant={locale === currentLocale ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLocale(locale)}
          disabled={pending}
          className="h-7 px-2 text-xs"
        >
          {LABELS[locale]}
        </Button>
      ))}
    </div>
  )
}
