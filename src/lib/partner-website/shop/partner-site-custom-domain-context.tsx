'use client'

import { createContext, useContext, type ReactNode } from 'react'

const PartnerSiteCustomDomainContext = createContext(false)

export function PartnerSiteCustomDomainProvider({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <PartnerSiteCustomDomainContext.Provider value={active}>
      {children}
    </PartnerSiteCustomDomainContext.Provider>
  )
}

export function usePartnerSiteCustomDomain(): boolean {
  return useContext(PartnerSiteCustomDomainContext)
}
