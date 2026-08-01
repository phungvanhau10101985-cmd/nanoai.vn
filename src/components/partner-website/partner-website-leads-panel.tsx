'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteLeadRow } from '@/lib/db/partner-website-leads-pg'

export function PartnerWebsiteLeadsPanel({
  locale,
  partnerId,
  enabled,
  sectionId,
}: {
  locale: WebLocale
  partnerId: string
  enabled: boolean
  sectionId?: string
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [leads, setLeads] = useState<PartnerWebsiteLeadRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!partnerId || !enabled) return
    setLoading(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/leads`)
      const json = (await res.json()) as { leads?: PartnerWebsiteLeadRow[] }
      if (res.ok) setLeads(json.leads ?? [])
    } finally {
      setLoading(false)
    }
  }, [partnerId, enabled])

  useEffect(() => {
    void load()
  }, [load])

  async function markRead(leadId: string) {
    await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', leadId }),
    })
    void load()
  }

  if (!enabled) return null

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t.leadsPanelTitle}</CardTitle>
        <CardDescription className="text-xs">{t.leadsPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 pt-0">
        {loading ? <p className="text-xs text-muted-foreground">{t.leadsLoading}</p> : null}
        {!loading && leads.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.leadsEmpty}</p>
        ) : null}
        {leads.slice(0, 20).map((lead) => (
          <div key={lead.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{lead.name || '—'}</strong>
              <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>{lead.status}</Badge>
            </div>
            {lead.phone ? <p className="text-xs text-muted-foreground">{lead.phone}</p> : null}
            {lead.email ? <p className="text-xs text-muted-foreground">{lead.email}</p> : null}
            {lead.message ? <p className="mt-1 text-xs">{lead.message}</p> : null}
            <p className="mt-1 text-[10px] text-muted-foreground">{lead.createdAt}</p>
            {lead.status === 'new' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => void markRead(lead.id)}
              >
                {t.leadsMarkRead}
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
