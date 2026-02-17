"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDepositCredit } from './deposit-credit-context'
import { DepositCreditPopup } from './deposit-credit-popup'
import { PlusCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface DepositCreditButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onCreditsUpdated?: () => void
}

export function DepositCreditButton({ variant = 'default', size = 'sm', className, onCreditsUpdated }: DepositCreditButtonProps) {
  const ctx = useDepositCredit()
  const [localOpen, setLocalOpen] = useState(false)
  const pathname = usePathname()

  const openPopup = ctx?.openPopup ?? (() => setLocalOpen(true))

  const handleClick = () => {
    if (onCreditsUpdated) {
      window.addEventListener('credits-updated', onCreditsUpdated, { once: true })
    }
    openPopup()
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        type="button"
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Nạp credit
      </Button>
      {!ctx && (
        <DepositCreditPopup
          open={localOpen}
          onOpenChange={setLocalOpen}
          returnPath={pathname}
          onCreditsUpdated={onCreditsUpdated}
        />
      )}
    </>
  )
}
