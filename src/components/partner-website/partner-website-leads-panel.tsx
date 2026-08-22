'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteLeadRow } from '@/lib/db/partner-website-leads-pg'
import { Mail } from 'lucide-react'

export function PartnerWebsiteLeadsPanel({
  locale,
  partnerId,
  enabled = true,
  sectionId,
  embedded,
}: {
  locale: WebLocale
  partnerId: string
  enabled?: boolean
  sectionId?: string
  /** Render inside Khách hàng — no extra card chrome. */
  embedded?: boolean
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

  function statusLabel(status: PartnerWebsiteLeadRow['status']): string {
    if (status === 'new') return t.leadsStatusNew
    if (status === 'read') return t.leadsStatusRead
    return status
  }

  const body = (
    <div className="space-y-2">
      {loading ? <p className="text-xs text-muted-foreground">{t.leadsLoading}</p> : null}
      {!loading && leads.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.leadsEmpty}</p>
      ) : null}
      {leads.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">{t.leadsName}</th>
                <th className="py-2 pr-3">{t.customersPhone}</th>
                <th className="py-2 pr-3">{t.customersEmail}</th>
                <th className="py-2 pr-3">{t.leadsMessage}</th>
                <th className="py-2 pr-3">{t.leadsTime}</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-medium">{lead.name || '—'}</td>
                  <td className="py-2 pr-3">{lead.phone || '—'}</td>
                  <td className="py-2 pr-3 text-gray-500">{lead.email || '—'}</td>
                  <td className="py-2 pr-3 text-xs">{lead.message || '—'}</td>
                  <td className="py-2 pr-3 text-[11px] text-muted-foreground">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleString(locale) : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                        {statusLabel(lead.status)}
                      </Badge>
                      {lead.status === 'new' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => void markRead(lead.id)}
                        >
                          {t.leadsMarkRead}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )

  if (embedded) {
    return (
      <div id={sectionId} className="space-y-2 border-t border-border/60 pt-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" />
            {t.leadsPanelTitle}
            {leads.length > 0 ? ` (${leads.length})` : ''}
          </h3>
          <p className="text-xs text-muted-foreground">{t.leadsPanelHint}</p>
        </div>
        {body}
      </div>
    )
  }

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" />
          {t.leadsPanelTitle}
          {leads.length > 0 ? ` (${leads.length})` : ''}
        </CardTitle>
        <CardDescription className="text-xs">{t.leadsPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 pt-0">{body}</CardContent>
    </Card>
  )
}
