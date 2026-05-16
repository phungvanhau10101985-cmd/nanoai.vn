'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getPartnerInventoryExternalSyncSettings,
  runPartnerExternalCatalogSyncNow,
  savePartnerInventoryExternalSyncSettings,
} from '@/app/dashboard/messaging/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  DEFAULT_188_INVENTORY_FIELD_MAPPING,
  EXTERNAL_SYNC_FIELD_SAMPLE_188,
  INVENTORY_EXTERNAL_SYNC_MAP_KEYS,
  INVENTORY_EXTERNAL_SYNC_VECTOR_ROLE,
} from '@/lib/messaging/partner-inventory-external-sync-defaults'
import type {
  ExternalCatalogSyncErrorCode,
  ExternalCatalogSyncOutcome,
} from '@/lib/messaging/partner-inventory-external-catalog-sync'

type AiT = Dictionary['partnerMessagingAi']

function fillInventoryPlaceholders(s: string, vars: Record<string, string | number>) {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

function messageForExternalCatalogSyncOutcome(t: AiT, outcome: ExternalCatalogSyncOutcome): string {
  if (outcome.ok) {
    return fillInventoryPlaceholders(t.inventoryExternalSyncRunSuccess, {
      fetched: outcome.fetched,
      inserted: outcome.inserted,
      updated: outcome.updated,
      deleted: outcome.deleted,
    })
  }
  const d = outcome.detail?.trim() ?? ''
  const detailOrDash = d || '—'
  switch (outcome.code) {
    case 'NO_PARTNER_ID':
      return t.inventoryExternalSyncErrNoPartnerId
    case 'MISSING_LIST_URL':
      return t.inventoryExternalSyncErrMissingListUrl
    case 'INVALID_LIST_URL':
      return t.inventoryExternalSyncErrInvalidListUrl
    case 'NOT_JSON_OBJECT':
      return t.inventoryExternalSyncErrNotJsonObject
    case 'NO_PRODUCTS_ARRAY':
      return t.inventoryExternalSyncErrNoProductsArray
    case 'FETCH_TIMEOUT':
      return t.inventoryExternalSyncErrFetchTimeout
    case 'FETCH_FAILED':
      return fillInventoryPlaceholders(t.inventoryExternalSyncErrFetchFailed, { detail: detailOrDash })
    case 'NO_VALID_ROWS':
      return t.inventoryExternalSyncErrNoValidRows
    case 'LIST_INVENTORY_FAILED':
      return fillInventoryPlaceholders(t.inventoryExternalSyncErrListInventoryFailed, {
        detail: detailOrDash,
      })
    case 'UPSERT_FAILED':
      return fillInventoryPlaceholders(t.inventoryExternalSyncErrUpsertFailed, { detail: detailOrDash })
    default:
      return outcome.code
  }
}

function messageFromStoredCatalogSyncError(t: AiT, raw: string | null): string {
  if (!raw?.trim()) return ''
  const nl = raw.indexOf('\n')
  const head = (nl === -1 ? raw : raw.slice(0, nl)).trim()
  const detail = nl === -1 ? undefined : raw.slice(nl + 1).trim() || undefined
  const o = (code: ExternalCatalogSyncErrorCode): ExternalCatalogSyncOutcome => ({
    ok: false,
    code,
    detail,
  })
  switch (head) {
    case 'NO_PARTNER_ID':
      return messageForExternalCatalogSyncOutcome(t, o('NO_PARTNER_ID'))
    case 'MISSING_LIST_URL':
      return messageForExternalCatalogSyncOutcome(t, o('MISSING_LIST_URL'))
    case 'INVALID_LIST_URL':
      return messageForExternalCatalogSyncOutcome(t, o('INVALID_LIST_URL'))
    case 'NOT_JSON_OBJECT':
      return messageForExternalCatalogSyncOutcome(t, o('NOT_JSON_OBJECT'))
    case 'NO_PRODUCTS_ARRAY':
      return messageForExternalCatalogSyncOutcome(t, o('NO_PRODUCTS_ARRAY'))
    case 'FETCH_TIMEOUT':
      return messageForExternalCatalogSyncOutcome(t, o('FETCH_TIMEOUT'))
    case 'FETCH_FAILED':
      return messageForExternalCatalogSyncOutcome(t, o('FETCH_FAILED'))
    case 'NO_VALID_ROWS':
      return messageForExternalCatalogSyncOutcome(t, o('NO_VALID_ROWS'))
    case 'LIST_INVENTORY_FAILED':
      return messageForExternalCatalogSyncOutcome(t, o('LIST_INVENTORY_FAILED'))
    case 'UPSERT_FAILED':
      return messageForExternalCatalogSyncOutcome(t, o('UPSERT_FAILED'))
    default:
      return raw.trim()
  }
}

function normalizeTimeInputValue(raw: string): string {
  const value = raw.trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '03:00'
}

function formatVietnamDateTime(raw: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(raw))
}

export function PartnerInventoryExternalSyncCard({
  partnerId,
  t,
  toast,
}: {
  partnerId: string
  t: AiT
  toast: (opts: { title: string; description?: string; variant?: 'destructive' }) => void
}) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [listUrl, setListUrl] = useState('')
  const [fields, setFields] = useState<Record<string, string>>(() => ({
    ...DEFAULT_188_INVENTORY_FIELD_MAPPING,
  }))
  const [updatedAt, setUpdatedAt] = useState('')
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [syncTimeVn, setSyncTimeVn] = useState('03:00')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [syncRunning, setSyncRunning] = useState(false)

  /** Tránh phụ thuộc toast/t trong useCallback — parent hay tạo reference mới → effect load chạy lặp → ô input nhấp nháy. */
  const tRef = useRef(t)
  const toastRef = useRef(toast)
  tRef.current = t
  toastRef.current = toast

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPartnerInventoryExternalSyncSettings(partnerId)
      if ('error' in res) {
        toastRef.current({
          title: tRef.current.inventoryExternalSyncLoadError,
          description: res.error,
          variant: 'destructive',
        })
        return
      }
      const s = res.settings
      setListUrl(s.products_list_url)
      setFields({ ...s.field_mapping })
      setUpdatedAt(s.updated_at)
      setAutoSyncEnabled(s.catalog_auto_sync_enabled)
      setSyncTimeVn(normalizeTimeInputValue(s.catalog_auto_sync_time_vn))
      setLastSyncAt(s.catalog_last_sync_at)
      setLastSyncError(s.catalog_last_sync_error)
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    void load()
  }, [load])

  function rowTitle(key: string): string {
    switch (key) {
      case 'sku':
        return t.inventorySku
      case 'remarketing_id':
        return t.inventoryExternalSyncRowRemarketing
      case 'name':
        return t.inventoryName
      case 'description':
        return t.inventoryDesc
      case 'price':
        return t.inventoryPrice
      case 'stock_qty':
        return t.inventoryExternalSyncRowStockQty
      case 'stock_note':
        return t.inventoryStock
      case 'colors_json':
        return t.inventoryExternalSyncRowColorsJson
      case 'image':
        return t.inventoryImageUrl
      case 'slug':
        return t.inventoryExternalSyncRowSlug
      case 'video':
        return t.inventoryProductVideoUrl
      case 'consult_note':
        return t.inventoryConsultNote
      case 'sort_order':
        return t.inventorySort
      case 'is_active':
        return t.inventoryExternalSyncRowIsActive
      default:
        return key
    }
  }

  const apply188Preset = () => {
    setFields({ ...DEFAULT_188_INVENTORY_FIELD_MAPPING })
  }

  const save = () => {
    startTransition(async () => {
      const res = await savePartnerInventoryExternalSyncSettings(partnerId, {
        siteOrigin: '',
        productPathTemplate: '',
        productsListUrl: listUrl,
        fieldMapping: fields,
        catalogAutoSyncEnabled: autoSyncEnabled,
        catalogAutoSyncIntervalMinutes: 1440,
        catalogAutoSyncTimeVn: syncTimeVn,
      })
      if ('error' in res) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.inventoryExternalSyncSaved })
      await load()
    })
  }

  const runSyncNow = () => {
    if (syncRunning || pending) return
    void (async () => {
      setSyncRunning(true)
      try {
        const res = await runPartnerExternalCatalogSyncNow(partnerId)
        if ('error' in res) {
          toastRef.current({ title: res.error, variant: 'destructive' })
          return
        }
        const msg = messageForExternalCatalogSyncOutcome(tRef.current, res.outcome)
        if (res.outcome.ok) {
          toastRef.current({
            title: msg,
          })
        } else {
          toastRef.current({ title: msg, variant: 'destructive' })
        }
        await load()
      } finally {
        setSyncRunning(false)
      }
    })()
  }

  const disabled = loading || pending
  const syncDisabled = disabled || syncRunning

  const lastSuccessLabel =
    lastSyncAt && !Number.isNaN(Date.parse(lastSyncAt))
      ? fillInventoryPlaceholders(t.inventoryExternalSyncLastSuccess, {
          time: formatVietnamDateTime(lastSyncAt),
        })
      : t.inventoryExternalSyncNeverSynced

  const lastErrorTranslated = messageFromStoredCatalogSyncError(t, lastSyncError)

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{t.inventoryExternalSyncTitle}</h3>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.inventoryExternalSyncIntro}</p>
        <p className="text-[11px] leading-relaxed border-l-2 border-emerald-600/35 pl-2 text-foreground/90">
          {t.inventoryExternalSyncReconcileHint}
        </p>
        <p className="text-[11px]">
          <Link href="/dashboard/api-integration" className="text-primary underline-offset-2 hover:underline">
            {t.inventoryOpenApiLink}
          </Link>
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t.inventoryExternalSyncListUrlLabel}</Label>
        <Input
          value={listUrl}
          onChange={(e) => setListUrl(e.target.value)}
          placeholder="https://…/api/v1/products/"
          disabled={disabled}
          className="font-mono text-xs h-8"
        />
        <p className="text-[10px] text-muted-foreground">{t.inventoryExternalSyncListUrlHint}</p>
      </div>

      <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={`ext-sync-auto-${partnerId}`}
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
              disabled={disabled}
              aria-label={t.inventoryExternalSyncAutoLabel}
            />
            <Label htmlFor={`ext-sync-auto-${partnerId}`} className="text-xs cursor-pointer">
              {t.inventoryExternalSyncAutoLabel}
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
              {t.inventoryExternalSyncIntervalLabel}
            </Label>
            <Input
              type="time"
              value={syncTimeVn}
              onChange={(e) => setSyncTimeVn(normalizeTimeInputValue(e.target.value))}
              disabled={disabled}
              className="h-8 w-20 text-xs tabular-nums"
              aria-label={t.inventoryExternalSyncIntervalLabel}
            />
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={runSyncNow}
            disabled={syncDisabled}
            className="h-8"
          >
            {syncRunning ? t.inventoryExternalSyncRunPending : t.inventoryExternalSyncRunNow}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">{t.inventoryExternalSyncAutoHint}</p>
        <p className="text-[10px] text-muted-foreground">{t.inventoryExternalSyncIntervalHint}</p>
        <p className="text-[10px] text-muted-foreground border-l-2 border-emerald-600/25 pl-2">
          {t.inventoryExternalSyncRemarketingSnapshotHint}
        </p>
        <p className="text-[10px] text-foreground/85 tabular-nums">{lastSuccessLabel}</p>
        {lastErrorTranslated ? (
          <p className="text-[10px] text-destructive/95 leading-snug">
            <span className="font-medium">{t.inventoryExternalSyncLastErrorLabel}: </span>
            {lastErrorTranslated}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-border/60 bg-background/80">
        <table className="w-full min-w-[920px] text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-2 py-2 text-left font-medium w-[20%]">{t.inventoryExternalSyncColNano}</th>
              <th className="px-2 py-2 text-left font-medium w-[11%] whitespace-nowrap">
                {t.inventoryExternalSyncVectorCol}
              </th>
              <th className="px-2 py-2 text-left font-medium w-[24%]">{t.inventoryExternalSyncColCustomer}</th>
              <th className="px-2 py-2 text-left font-medium w-[45%]">{t.inventoryExternalSyncColSample}</th>
            </tr>
          </thead>
          <tbody>
            {INVENTORY_EXTERNAL_SYNC_MAP_KEYS.map((key) => {
              const role = INVENTORY_EXTERNAL_SYNC_VECTOR_ROLE[key]
              return (
                <tr key={key} className="border-b border-border/40 last:border-0">
                  <td className="px-2 py-2 align-middle text-muted-foreground">{rowTitle(key)}</td>
                  <td className="px-2 py-2 align-middle">
                    {role === 'image' ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium px-1.5 py-0 h-5 border-violet-500/40 text-violet-700 dark:text-violet-300"
                      >
                        {t.inventoryExternalSyncVectorImage}
                      </Badge>
                    ) : role === 'text' ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium px-1.5 py-0 h-5 border-sky-500/40 text-sky-800 dark:text-sky-200"
                      >
                        {t.inventoryExternalSyncVectorText}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50 tabular-nums">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      value={fields[key] ?? ''}
                      onChange={(e) =>
                        setFields((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={disabled}
                      className="font-mono text-[11px] h-8"
                      aria-label={`${rowTitle(key)} — ${t.inventoryExternalSyncColCustomer}`}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <pre className="font-mono text-[10px] leading-snug whitespace-pre-wrap break-words text-muted-foreground m-0 bg-muted/30 rounded px-1.5 py-1 border border-border/50">
                      {EXTERNAL_SYNC_FIELD_SAMPLE_188[key]}
                    </pre>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {t.inventoryExternalSyncColCustomerHint} {t.inventoryExternalSyncSampleHint}{' '}
        {t.inventoryExternalSyncVectorFootnote}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={apply188Preset} disabled={disabled}>
          {t.inventoryExternalSyncPreset188}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={disabled}>
          {pending ? '…' : t.inventoryExternalSyncSave}
        </Button>
        {updatedAt ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">{updatedAt}</span>
        ) : null}
      </div>
    </div>
  )
}
