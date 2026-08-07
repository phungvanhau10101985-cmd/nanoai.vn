'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react'

/**
 * M2.2 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — quản trị khuyến mãi/voucher.
 * Xem docs/188_BEHAVIOR_SPEC.md mục D — CRUD voucher, target category/sản phẩm, auto-grant config.
 */

type PromotionRow = {
  id: string
  code: string
  name: string
  description: string
  discountType: 'percent' | 'fixed_amount'
  discountPercent: number | null
  discountAmount: number | null
  maxDiscountAmount: number | null
  minSubtotal: number
  firstOrderOnly: boolean
  usageLimit: number | null
  perUserLimit: number
  usedCount: number
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  isPublicRedeemable: boolean
}

type FormState = {
  mode: 'create' | 'edit'
  promotionId: string | null
  code: string
  name: string
  description: string
  discountType: 'percent' | 'fixed_amount'
  discountValue: string
  maxDiscountAmount: string
  minSubtotal: string
  firstOrderOnly: boolean
  isPublicRedeemable: boolean
  usageLimit: string
  perUserLimit: string
  validFrom: string
  validTo: string
  isActive: boolean
}

function emptyForm(): FormState {
  return {
    mode: 'create',
    promotionId: null,
    code: '',
    name: '',
    description: '',
    discountType: 'percent',
    discountValue: '',
    maxDiscountAmount: '',
    minSubtotal: '',
    firstOrderOnly: false,
    isPublicRedeemable: true,
    usageLimit: '',
    perUserLimit: '1',
    validFrom: '',
    validTo: '',
    isActive: true,
  }
}

function rowToForm(row: PromotionRow): FormState {
  return {
    mode: 'edit',
    promotionId: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    discountType: row.discountType,
    discountValue: String(row.discountType === 'percent' ? row.discountPercent ?? '' : row.discountAmount ?? ''),
    maxDiscountAmount: row.maxDiscountAmount != null ? String(row.maxDiscountAmount) : '',
    minSubtotal: row.minSubtotal ? String(row.minSubtotal) : '',
    firstOrderOnly: row.firstOrderOnly,
    isPublicRedeemable: row.isPublicRedeemable,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : '',
    perUserLimit: String(row.perUserLimit),
    validFrom: row.validFrom ? row.validFrom.slice(0, 10) : '',
    validTo: row.validTo ? row.validTo.slice(0, 10) : '',
    isActive: row.isActive,
  }
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')}đ`
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerWebsitePromotionsPanel({ t, partnerId, sectionId, onToast }: Props) {
  const [rows, setRows] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}/promotions`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(basePath)
      const json = (await res.json().catch(() => null)) as { promotions?: PromotionRow[] } | null
      setRows(json?.promotions ?? [])
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    void load()
  }, [load])

  function errorText(code: string): string {
    if (code === 'duplicate_code') return t.promotionsErrorDuplicateCode
    if (code === 'invalid_discount' || code === 'invalid_code') return t.promotionsErrorInvalidDiscount
    return t.promotionsErrorGeneric
  }

  async function submitForm() {
    if (!form || saving) return
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        discountType: form.discountType,
        discountPercent: form.discountType === 'percent' ? Number(form.discountValue) || 0 : undefined,
        discountAmount: form.discountType === 'fixed_amount' ? Number(form.discountValue) || 0 : undefined,
        maxDiscountAmount: form.maxDiscountAmount.trim() ? Number(form.maxDiscountAmount) : null,
        minSubtotal: form.minSubtotal.trim() ? Number(form.minSubtotal) : 0,
        firstOrderOnly: form.firstOrderOnly,
        isPublicRedeemable: form.isPublicRedeemable,
        usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
        perUserLimit: Number(form.perUserLimit) || 1,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        isActive: form.isActive,
      }
      const res = await fetch(
        form.mode === 'create' ? basePath : `${basePath}/${encodeURIComponent(form.promotionId!)}`,
        {
          method: form.mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setFormError(errorText(json.error ?? ''))
        return
      }
      onToast?.(form.mode === 'create' ? t.promotionsCreateSuccess : t.promotionsUpdateSuccess)
      setForm(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deletePromotion(id: string) {
    if (!window.confirm(t.promotionsDeleteConfirm)) return
    const res = await fetch(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      onToast?.(t.promotionsDeleteSuccess)
      setRows((prev) => prev.filter((r) => r.id !== id))
    }
  }

  async function toggleActive(row: PromotionRow) {
    const res = await fetch(`${basePath}/${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !row.isActive }),
    })
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)))
    }
  }

  return (
    <Card id={sectionId}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t.promotionsTitle}
            </CardTitle>
            <CardDescription>{t.promotionsHint}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setForm(emptyForm())}>
            <Plus className="mr-1 h-4 w-4" />
            {t.promotionsAddNew}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> ...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t.promotionsEmpty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold">{row.code}</code>
                  <span className="text-sm font-medium">{row.name}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {row.discountType === 'percent'
                    ? `${row.discountPercent}%${row.maxDiscountAmount ? ` (tối đa ${formatVnd(row.maxDiscountAmount)})` : ''}`
                    : formatVnd(row.discountAmount ?? 0)}
                  {row.minSubtotal > 0 ? ` · min ${formatVnd(row.minSubtotal)}` : ''}
                  {' · '}
                  {t.promotionsUsedCount}: {row.usedCount}
                  {row.usageLimit != null ? `/${row.usageLimit}` : ''}
                  {!row.isPublicRedeemable ? ' · 🎁' : ''}
                  {row.firstOrderOnly ? ' · 1st order' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch checked={row.isActive} onCheckedChange={() => void toggleActive(row)} />
                <Button variant="ghost" size="sm" onClick={() => setForm(rowToForm(row))}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void deletePromotion(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.mode === 'create' ? t.promotionsAddNew : t.promotionsEdit}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div>
                <Label>{t.promotionsCode}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME10" />
                <p className="mt-1 text-xs text-gray-500">{t.promotionsCodeHint}</p>
              </div>
              <div>
                <Label>{t.promotionsName}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Mô tả</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.promotionsDiscountType}</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed_amount' })}
                  >
                    <option value="percent">{t.promotionsDiscountTypePercent}</option>
                    <option value="fixed_amount">{t.promotionsDiscountTypeFixed}</option>
                  </select>
                </div>
                <div>
                  <Label>{t.promotionsDiscountValue}</Label>
                  <Input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    placeholder={form.discountType === 'percent' ? '10' : '50000'}
                  />
                </div>
              </div>
              {form.discountType === 'percent' ? (
                <div>
                  <Label>{t.promotionsMaxDiscount}</Label>
                  <Input
                    type="number"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.promotionsMinSubtotal}</Label>
                  <Input type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
                </div>
                <div>
                  <Label>{t.promotionsPerUserLimit}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t.promotionsUsageLimit}</Label>
                <Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.promotionsValidFrom}</Label>
                  <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
                </div>
                <div>
                  <Label>{t.promotionsValidTo}</Label>
                  <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <span className="text-sm">{t.promotionsFirstOrderOnly}</span>
                <Switch checked={form.firstOrderOnly} onCheckedChange={(v) => setForm({ ...form, firstOrderOnly: v })} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <div>
                  <span className="text-sm">{t.promotionsPublicRedeemable}</span>
                  <p className="text-xs text-gray-500">{t.promotionsPublicRedeemableHint}</p>
                </div>
                <Switch checked={form.isPublicRedeemable} onCheckedChange={(v) => setForm({ ...form, isPublicRedeemable: v })} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <span className="text-sm">{t.promotionsActive}</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </label>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t.promotionsCancel}
            </Button>
            <Button onClick={() => void submitForm()} disabled={saving || !form?.code.trim() || !form?.name.trim()}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t.promotionsSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
