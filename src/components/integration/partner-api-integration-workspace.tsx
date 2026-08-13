'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PartnerApiKeysManager } from '@/components/integration/partner-api-keys-manager'
import { PartnerDevIntegrationGuide } from '@/components/integration/partner-dev-integration-guide'
import { PARTNER_API_KEYS_MANAGER_COPY } from '@/lib/integration/api-keys-hub-copy'
import type { ApiKeysHubLocale } from '@/lib/integration/api-keys-hub-copy'
import { PARTNER_DEV_INTEGRATION_COPY } from '@/lib/integration/partner-dev-integration-copy'

function resolveInitialPartnerId(
  partners: Array<{ id: string }>,
  preferred: string | null | undefined
): string {
  if (preferred && partners.some((p) => p.id === preferred)) return preferred
  return partners[0]?.id ?? ''
}

type Partner = { id: string; display_name: string | null; slug: string; logo_url: string | null; embed_key?: string }

type Props = {
  partners: Partner[]
  initialSelectedPartnerId: string | null
  baseUrl: string
  locale: ApiKeysHubLocale
  /** Giữ thứ tự: khóa API → quy tắc → hướng dẫn */
  betweenKeysAndGuide?: ReactNode
  /** Ẩn ô chọn shop khi workspace đã chọn ở trang cha. */
  hidePartnerPicker?: boolean
  /** Nhúng trong Cài đặt: không nhảy trang khi mở hướng dẫn đăng nhập shop. */
  embedded?: boolean
}

export function PartnerApiIntegrationWorkspace({
  partners,
  initialSelectedPartnerId,
  baseUrl,
  locale,
  betweenKeysAndGuide,
  hidePartnerPicker = false,
  embedded = false,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [partnerId, setPartnerIdState] = useState(() =>
    resolveInitialPartnerId(partners, initialSelectedPartnerId)
  )

  const setPartnerId = useCallback(
    (id: string) => {
      const nextId = id.trim()
      if (!nextId || !partners.some((p) => p.id === nextId)) return
      setPartnerIdState(nextId)
      const next = new URLSearchParams(searchParams.toString())
      next.set('partner', nextId)
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      router.replace(`${pathname}?${next.toString()}${hash}`, { scroll: false })
    },
    [partners, pathname, router, searchParams]
  )

  useEffect(() => {
    const urlPid = searchParams.get('partner')?.trim() ?? ''
    if (urlPid && partners.some((p) => p.id === urlPid) && urlPid !== partnerId) {
      setPartnerIdState(urlPid)
    }
  }, [searchParams, partners, partnerId])

  useEffect(() => {
    if (!partnerId && partners[0]?.id) setPartnerIdState(partners[0].id)
    if (partnerId && !partners.some((p) => p.id === partnerId) && partners[0]?.id) {
      setPartnerIdState(partners[0].id)
    }
  }, [partners, partnerId])

  const tKeys = PARTNER_API_KEYS_MANAGER_COPY[locale]
  const tGuide = PARTNER_DEV_INTEGRATION_COPY[locale]

  if (partners.length === 0) {
    return (
      <>
        <PartnerApiKeysManager partners={[]} t={tKeys} hidePartnerPicker={hidePartnerPicker} />
        {betweenKeysAndGuide}
        <PartnerDevIntegrationGuide baseUrl={baseUrl} t={tGuide} partners={[]} embedded={embedded} />
      </>
    )
  }

  return (
    <>
      <PartnerApiKeysManager
        partners={partners}
        t={tKeys}
        partnerId={partnerId}
        onPartnerIdChange={setPartnerId}
        hidePartnerPicker={hidePartnerPicker}
      />
      {betweenKeysAndGuide}
      <PartnerDevIntegrationGuide
        baseUrl={baseUrl}
        t={tGuide}
        partners={partners}
        selectedPartnerId={partnerId}
        embedded={embedded}
      />
    </>
  )
}
