'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Users, ChevronDown } from 'lucide-react'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
const tryOnLinks = [
  { href: '/thu-do-online/1-nguoi', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ 1 người', 'Try-on 1 person', '单人试衣', '1人試着', '1인 가상피팅'), icon: User },
  { href: '/thu-do-online/2-nguoi', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ 2 người', 'Try-on 2 people', '2人试衣', '2人試着', '2인 가상피팅'), icon: Users },
  { href: '/thu-do-online/3-nguoi', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ 3 người', 'Try-on 3 people', '3人试衣', '3人試着', '3인 가상피팅'), icon: Users },
  { href: '/thu-do-online/4-nguoi', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ 4 người', 'Try-on 4 people', '4人试衣', '4人試着', '4인 가상피팅'), icon: Users },
  { href: '/thu-do-online/5-nguoi', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ 5 người', 'Try-on 5 people', '5人试衣', '5人試着', '5인 가상피팅'), icon: Users },
]

export function TryOnNavDropdown() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const pathname = usePathname()
  const router = useRouter()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
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

  const handleChooseMode = (href: string) => {
    if (pathname === href) {
      router.push(href + '?reset=1')
    } else {
      router.push(href)
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:scale-[1.02] outline-none data-[state=open]:ring-2 data-[state=open]:ring-primary/30">
        <span>{tr('Thử đồ / Phối đồ', 'Try-on / Outfit', '试衣 / 搭配', '試着 / コーデ', '가상피팅 / 코디')}</span>
        <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {tryOnLinks.map((item) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.href} asChild>
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleChooseMode(item.href)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label(tr)}</span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
