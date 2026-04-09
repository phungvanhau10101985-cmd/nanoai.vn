'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LOCALE_COOKIE_NAME, WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'

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
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`
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
