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
import { PARTNER_BUILTIN_PAGE_SLUGS, isBuiltinPageSlug } from '@/lib/partner-website/pages/partner-static-page-types'
import { visualEditSelectValueFromCmsSlug } from '@/lib/partner-website/pages/partner-info-page-visual'
import { Loader2, Pencil, Plus, Trash2, ExternalLink, FileText, MousePointerClick } from 'lucide-react'

/**
 * W3.3 + W3.4 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CMS trang tĩnh + SEO theo shop.
 */

type StaticPageRow = {
  id: string
  slug: string
  title: string
  content: string
  seoTitle: string
  seoDescription: string
  seoIndex: boolean
  isPublished: boolean
}

type FormState = {
  mode: 'create' | 'edit'
  pageId: string | null
  slug: string
  title: string
  content: string
  seoTitle: string
  seoDescription: string
  seoIndex: boolean
  isPublished: boolean
}

function emptyForm(): FormState {
  return { mode: 'create', pageId: null, slug: '', title: '', content: '', seoTitle: '', seoDescription: '', seoIndex: true, isPublished: true }
}

function rowToForm(row: StaticPageRow): FormState {
  return {
    mode: 'edit', pageId: row.id, slug: row.slug, title: row.title, content: row.content,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, seoIndex: row.seoIndex, isPublished: row.isPublished,
  }
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  siteSlug?: string
  sectionId?: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
  onOpenVisualEdit?: (pageSelect: string) => void
}

export function PartnerWebsiteStaticPagesPanel({ t, partnerId, siteSlug, sectionId, onToast, onOpenVisualEdit }: Props) {
  const [rows, setRows] = useState<StaticPageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}/static-pages`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(basePath)
      const json = (await res.json().catch(() => null)) as { pages?: StaticPageRow[] } | null
      setRows(json?.pages ?? [])
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    void load()
  }, [load])

  function errorText(code: string): string {
    if (code === 'duplicate_slug') return t.staticPageErrorDuplicateSlug
    if (code === 'invalid_slug') return t.staticPageErrorInvalidSlug
    return t.staticPageErrorGeneric
  }

  async function submitForm() {
    if (!form || saving) return
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        title: form.title.trim(),
        content: form.content,
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        seoIndex: form.seoIndex,
        isPublished: form.isPublished,
      }
      const res = await fetch(
        form.mode === 'create' ? basePath : `${basePath}/${encodeURIComponent(form.pageId!)}`,
        {
          method: form.mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form.mode === 'create' ? payload : { title: payload.title, content: payload.content, seoTitle: payload.seoTitle, seoDescription: payload.seoDescription, seoIndex: payload.seoIndex, isPublished: payload.isPublished }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setFormError(errorText(json.error ?? ''))
        return
      }
      onToast?.(form.mode === 'create' ? t.staticPageCreateSuccess : t.staticPageUpdateSuccess)
      setForm(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deletePage(id: string) {
    if (!window.confirm(t.staticPageDeleteConfirm)) return
    const res = await fetch(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      onToast?.(t.staticPageDeleteSuccess)
      setRows((prev) => prev.filter((r) => r.id !== id))
    }
  }

  async function toggleActive(row: StaticPageRow) {
    const res = await fetch(`${basePath}/${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !row.isPublished }),
    })
    if (res.ok) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isPublished: !r.isPublished } : r)))
  }

  function publicUrl(slug: string): string | null {
    if (!siteSlug) return null
    const path = isBuiltinPageSlug(slug) ? slug : `pages/${slug}`
    return `/site/${siteSlug}/${path}`
  }

  return (
    <Card id={sectionId}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.staticPagesTitle}
            </CardTitle>
            <CardDescription>{t.staticPagesHint}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setForm(emptyForm())}>
            <Plus className="mr-1 h-4 w-4" />
            {t.staticPagesAddNew}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> ...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t.staticPagesEmpty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold">/{row.slug}</code>
                  <span className="text-sm font-medium">{row.title}</span>
                  {isBuiltinPageSlug(row.slug) ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">override</span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onOpenVisualEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    title={t.visualEditOpenPage}
                    onClick={() => onOpenVisualEdit(visualEditSelectValueFromCmsSlug(row.slug))}
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    {t.visualEditOpenPage}
                  </Button>
                ) : null}
                {publicUrl(row.slug) ? (
                  <a href={publicUrl(row.slug)!} target="_blank" rel="noreferrer" title={t.staticPageViewPublic}>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-gray-700" />
                  </a>
                ) : null}
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  {t.staticPagePublishedLabel}
                  <Switch checked={row.isPublished} onCheckedChange={() => void toggleActive(row)} />
                </label>
                <Button variant="ghost" size="sm" onClick={() => setForm(rowToForm(row))}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void deletePage(row.id)}>
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
            <DialogTitle>{form?.mode === 'create' ? t.staticPagesAddNew : t.staticPageEdit}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div>
                <Label>{t.staticPageSlugLabel}</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="about, huong-dan-size, ..."
                  disabled={form.mode === 'edit'}
                  list="static-page-builtin-slugs"
                />
                <datalist id="static-page-builtin-slugs">
                  {PARTNER_BUILTIN_PAGE_SLUGS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-gray-500">
                  {isBuiltinPageSlug(form.slug.trim().toLowerCase()) ? t.staticPageSlugBuiltinHint : t.staticPageSlugHint}
                </p>
              </div>
              <div>
                <Label>{t.staticPageTitleLabel}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>{t.staticPageContentLabel}</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} />
                <p className="mt-1 text-xs text-gray-500">{t.staticPageContentHint}</p>
              </div>
              <div>
                <Label>{t.staticPageSeoTitleLabel}</Label>
                <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
              </div>
              <div>
                <Label>{t.staticPageSeoDescriptionLabel}</Label>
                <Textarea value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} rows={2} />
              </div>
              <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <span className="text-sm">{t.staticPageSeoIndexLabel}</span>
                <Switch checked={form.seoIndex} onCheckedChange={(v) => setForm({ ...form, seoIndex: v })} />
              </label>
              <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <span className="text-sm">{t.staticPagePublishedLabel}</span>
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
              </label>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t.staticPageCancel}
            </Button>
            <Button onClick={() => void submitForm()} disabled={saving || !form?.slug.trim() || !form?.title.trim()}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t.staticPageSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
