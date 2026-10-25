'use client'

import { createContext, useContext, type ReactNode } from 'react'

const WeddingCreditTopUpContext = createContext<(() => void) | null>(null)

export function WeddingCreditTopUpProvider(props: { onShort: () => void; children: ReactNode }) {
  return <WeddingCreditTopUpContext.Provider value={props.onShort}>{props.children}</WeddingCreditTopUpContext.Provider>
}

export function useWeddingCreditTopUp() {
  return useContext(WeddingCreditTopUpContext)
}
