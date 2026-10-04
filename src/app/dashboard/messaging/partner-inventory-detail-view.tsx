'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getPartnerInventoryDetail } from '@/app/dashboard/messaging/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { inventoryAdminWebHref } from '@/lib/messaging/inventory-admin-web-href'
import {
  buildInventoryDetailSections,
  type InventoryDetailCell,
} from '@/lib/messaging/inventory-admin-detail-fields'

type AiT = Dictionary['partnerMessagingAi']

function DetailCellValue({ cell, empty }: { cell: InventoryDetailCell; empty: string }) {
  if (cell.kind === 'empty') return <span className="text-muted-foreground">{empty}</span>
  if (cell.kind === 'bool' || cell.kind === 'text') return <span className="whitespace-pre-wrap break-words">{cell.text}</span>
  if (cell.kind === 'long' || cell.kind === 'json') {
    return (
      <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
        {cell.text}
      </pre>
    )
  }
  if (cell.kind === 'url') {
    return (
      <a href={cell.href} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 underline underline-offset-2 dark:text-blue-400">
        {cell.href}
      </a>
    )
  }
  if (cell.kind === 'images') {
    return (
      <ul className="flex flex-wrap gap-2">
        {cell.urls.map((url) => (
          <li key={url} className="w-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-24 w-24 rounded-md border border-border object-cover" />
            <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[10px] text-blue-600 underline dark:text-blue-400">
              {url}
            </a>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="space-y-2">
      {cell.items.map((item, index) => (
        <li key={`${item.name}-${item.img}-${index}`} className="flex items-center gap-2">
          {item.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.img} alt="" className="h-10 w-10 rounded border border-border object-cover" />
          ) : null}
          <span className="min-w-0 break-words text-sm">{item.name || item.img}</span>
        </li>
      ))}
    </ul>
  )
}

export function PartnerInventoryDetailPage({
  partnerId,
  inventoryId,
  partnerChatSlug,
  websitePublicUrl,
  locale,
  t,
  onBack,
}: {
  partnerId: string
  inventoryId: string
  partnerChatSlug: string
  websitePublicUrl?: string | null
  locale: WebLocale
  t: AiT
  onBack: () => void
}) {
  const [fields, setFields] = useState<Record<string, unknown> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFields(null)
    setFailed(false)
    void getPartnerInventoryDetail(partnerId, inventoryId)
      .then((res) => {
        if (cancelled) return
        if (!res || 'error' in res) {
          setFailed(true)
          return
        }
        setFields(res.fields)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [partnerId, inventoryId])

  const name = String(fields?.name ?? '').trim()
  const sku = String(fields?.sku ?? '').trim()
  const productId = String(fields?.remarketing_id || fields?.sku || fields?.id || inventoryId)
  const webHref =
    fields &&
    inventoryAdminWebHref(partnerChatSlug, websitePublicUrl, {
      id: inventoryId,
      name,
      product_url: typeof fields.product_url === 'string' ? fields.product_url : '',
    })
  const sections = fields ? buildInventoryDetailSections(fields, locale) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {t.inventoryDetailBack}
        </Button>
        {webHref ? (
          <a
            href={webHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            {t.inventoryViewWeb}
          </a>
        ) : null}
      </div>
      <div>
        <h3 className="text-base font-semibold">{t.inventoryDetailTitle}</h3>
        <p className="mt-1 text-sm text-foreground">{name || t.inventoryEmptyCell}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {productId}
          {sku && sku !== productId ? ` · ${sku}` : ''}
        </p>
      </div>
      {failed ? <p className="text-sm text-destructive">{t.inventoryDetailFailed}</p> : null}
      {!fields && !failed ? <p className="text-sm text-muted-foreground">{t.inventoryDetailLoading}</p> : null}
      {fields ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.inventoryDetailEmbeddingOmitted}</p>
      ) : null}
      {sections.map((section) => (
        <section key={section.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <h4 className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold">{section.title}</h4>
          <dl className="divide-y divide-border/70">
            {section.cells.map((cell) => (
              <div key={cell.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground">{cell.label}</dt>
                <dd className="min-w-0 text-sm">
                  <DetailCellValue cell={cell} empty={t.inventoryEmptyCell} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
