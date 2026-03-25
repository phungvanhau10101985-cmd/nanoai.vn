"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useDepositCredit } from './deposit-credit-context'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PlusCircle } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

export function DepositCreditMenuItem() {
  const ctx = useDepositCredit()
  const [topUpLabel, setTopUpLabel] = useState(() => getDictionary(DEFAULT_WEB_LOCALE).menu.topUpCredits)

  useEffect(() => {
    setTopUpLabel(getDictionary(readWebLocaleFromDocumentCookie()).menu.topUpCredits)
  }, [])

  if (ctx?.openPopup) {
    return (
      <DropdownMenuItem onSelect={() => ctx.openPopup()} className="cursor-pointer">
        <PlusCircle className="mr-2 h-4 w-4" />
        {topUpLabel}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem asChild>
      <Link href="/wallet" className="cursor-pointer">
        <PlusCircle className="mr-2 h-4 w-4" />
        {topUpLabel}
      </Link>
    </DropdownMenuItem>
  )
}
