'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <>
      <div className="shrink-0 md:hidden">
        <Select
          value={currentLocale}
          onValueChange={(v) => setLocale(v as WebLocale)}
          disabled={pending}
        >
          <SelectTrigger
            aria-label="Language"
            className="h-7 w-fit min-w-0 max-w-[100%] gap-1 border-border/70 bg-card/60 px-2 py-0 text-[10px] shadow-none [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
            {WEB_LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale} className="text-xs">
                {LABELS[locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden shrink-0 items-center gap-1 overflow-x-auto rounded-md border border-border/70 bg-card/80 p-1 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
        {WEB_LOCALES.map((locale) => (
          <Button
            key={locale}
            type="button"
            variant={locale === currentLocale ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLocale(locale)}
            disabled={pending}
            className="h-7 shrink-0 px-2 text-xs"
          >
            {LABELS[locale]}
          </Button>
        ))}
      </div>
    </>
  )
}
