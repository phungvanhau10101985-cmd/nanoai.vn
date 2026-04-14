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
    <div className="flex max-w-[min(100%,13.5rem)] shrink-0 items-center gap-0.5 overflow-x-auto rounded-md border border-border/70 bg-card/60 p-0.5 [scrollbar-width:none] sm:max-w-none sm:gap-1 sm:p-1 md:bg-card/80 [&::-webkit-scrollbar]:hidden">
      {WEB_LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          variant={locale === currentLocale ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLocale(locale)}
          disabled={pending}
          className="h-7 shrink-0 px-1.5 text-[10px] sm:px-2 sm:text-xs"
        >
          {LABELS[locale]}
        </Button>
      ))}
    </div>
  )
}
