"use client"

import Link from 'next/link'
import { useDepositCredit } from './deposit-credit-context'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PlusCircle } from 'lucide-react'

export function DepositCreditMenuItem() {
  const ctx = useDepositCredit()

  if (ctx?.openPopup) {
    return (
      <DropdownMenuItem onSelect={() => ctx.openPopup()} className="cursor-pointer">
        <PlusCircle className="mr-2 h-4 w-4" />
        Nạp credit
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem asChild>
      <Link href="/wallet" className="cursor-pointer">
        <PlusCircle className="mr-2 h-4 w-4" />
        Nạp credit
      </Link>
    </DropdownMenuItem>
  )
}
