"use client"

import { createContext, useContext, useState } from 'react'
import { DepositCreditPopup } from './deposit-credit-popup'

type DepositCreditContextValue = {
  openPopup: () => void
}

const DepositCreditContext = createContext<DepositCreditContextValue | null>(null)

export function DepositCreditProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <DepositCreditContext.Provider value={{ openPopup: () => setOpen(true) }}>
      {children}
      <DepositCreditPopup open={open} onOpenChange={setOpen} />
    </DepositCreditContext.Provider>
  )
}

export function useDepositCredit() {
  const ctx = useContext(DepositCreditContext)
  return ctx
}
