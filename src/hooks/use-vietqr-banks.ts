'use client'

import { useEffect, useState } from 'react'

const POPULAR_BANKS = [
  'VCB',
  'BIDV',
  'ICB',
  'VBA',
  'TCB',
  'MB',
  'VPB',
  'ACB',
  'TPB',
  'HDB',
  'STB',
  'MSB',
  'SCB',
  'OCB',
  'EIB',
  'VIB',
  'SHB',
]

export type VietQrBankItem = {
  id: number
  name: string
  code: string
  shortName: string
  bin: string
}

export function useVietQrBanks() {
  const [banks, setBanks] = useState<VietQrBankItem[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('https://api.vietqr.io/v2/banks')
      .then((r) => r.json())
      .then((d: { data?: (VietQrBankItem & { transferSupported?: number })[] }) => {
        if (!d?.data || cancelled) return
        const list = d.data.filter((b) => b.transferSupported === 1)
        const sorted = [...list].sort((a, b) => {
          const ai = POPULAR_BANKS.indexOf(a.code)
          const bi = POPULAR_BANKS.indexOf(b.code)
          if (ai >= 0 && bi >= 0) return ai - bi
          if (ai >= 0) return -1
          if (bi >= 0) return 1
          return (a.name || '').localeCompare(b.name || '')
        })
        setBanks(sorted)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return banks
}
