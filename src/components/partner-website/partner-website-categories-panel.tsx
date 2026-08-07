'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, FolderTree, Loader2, Package, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'

/**
 * W4.4/W4.5/W4.6 — quản trị cây danh mục sản phẩm (CRUD từng node, kéo/xuống sắp xếp, gán sản phẩm).
 * Xem docs/188_BEHAVIOR_SPEC.md mục A.8 — cố ý KHÔNG copy hạn chế "bắt buộc tạo trọn nhánh" của 188.
 */

type CategoryNode = {
  id: string
  parentId: string | null
  name: string
  slug: string
  path: string
  depth: number
  sortOrder: number
  isActive: boolean
  imageUrl: string
  description: string
  seoTitle: string
  seoDescription: string
  seoIndex: boolean
  seoBody: string
  seoBodyGeneratedAt: string | null
  sizeGuideImageUrl?: string
  productCount?: number
  children: CategoryNode[]
}

type InventoryPickRow = {
  id: string
  name: string
  sku: string | null
  priceHint: string
  imageUrl: string
}

type FormState = {
  mode: 'create' | 'edit'
  categoryId: string | null
  parentId: string | null
  name: string
  slug: string
  imageUrl: string
  description: string
  seoTitle: string
  seoDescription: string
  seoIndex: boolean
  seoBody: string
  seoBodyGeneratedAt: string | null
  sizeGuideImageUrl: string
  isActive: boolean
}

function emptyForm(mode: 'create' | 'edit', parentId: string | null): FormState {
  return {
    mode,
    categoryId: null,
    parentId,
    name: '',
    slug: '',
    imageUrl: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
    seoIndex: true,
    seoBody: '',
    seoBodyGeneratedAt: null,
    sizeGuideImageUrl: '',
    isActive: true,
  }
}

function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (list: CategoryNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** Loại trừ chính node và toàn bộ hậu duệ (không cho chọn làm cha của chính nó — tránh cycle client-side). */
function selectableParents(tree: CategoryNode[], excludeId: string | null): CategoryNode[] {
  const flat = flattenTree(tree)
  if (!excludeId) return flat
  const excluded = flat.find((n) => n.id === excludeId)
  if (!excluded) return flat
  return flat.filter((n) => n.id !== excludeId && !n.path.startsWith(`${excluded.path}/`))
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerWebsiteCategoriesPanel({ locale, t, partnerId, sectionId = 'partner-website-categories', onToast }: Props) {
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [generatingSeo, setGeneratingSeo] = useState(false)

  const [assignCategoryId, setAssignCategoryId] = useState<string | null>(null)
  const [assignInventory, setAssignInventory] = useState<InventoryPickRow[]>([])
  const [assignSelected, setAssignSelected] = useState<string[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)

  const errorMessage = useCallback(
    (code: string | undefined) => {
      if (code === 'duplicate_slug' || code === 'duplicate_path') return t.categoryErrorDuplicateSlug
      if (code === 'max_depth') return t.categoryErrorMaxDepth
      return t.categoryErrorGeneric
    },
    [t.categoryErrorDuplicateSlug, t.categoryErrorMaxDepth, t.categoryErrorGeneric]
  )

  const loadTree = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/categories`)
      const json = (await res.json()) as { tree?: CategoryNode[]; error?: string }
      if (!res.ok) throw new Error(errorMessage(json.error))
      setTree(json.tree ?? [])
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [partnerId, onToast, errorMessage, t.categoryErrorGeneric])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const openCreate = (parentId: string | null) => setForm(emptyForm('create', parentId))
  const openEdit = (node: CategoryNode) =>
    setForm({
      mode: 'edit',
      categoryId: node.id,
      parentId: node.parentId,
      name: node.name,
      slug: node.slug,
      imageUrl: node.imageUrl,
      description: node.description,
      seoTitle: node.seoTitle,
      seoDescription: node.seoDescription,
      seoIndex: node.seoIndex,
      seoBody: node.seoBody,
      seoBodyGeneratedAt: node.seoBodyGeneratedAt,
      sizeGuideImageUrl: node.sizeGuideImageUrl || '',
      isActive: node.isActive,
    })

  const handleSave = async () => {
    if (!form) return
    if (form.name.trim().length < 1) {
      onToast(t.categoryErrorGeneric, 'destructive')
      return
    }
    setSaving(true)
    try {
      if (form.mode === 'create') {
        const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentId: form.parentId,
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            imageUrl: form.imageUrl.trim(),
            description: form.description.trim(),
            seoTitle: form.seoTitle.trim(),
            seoDescription: form.seoDescription.trim(),
            seoIndex: form.seoIndex,
          }),
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(errorMessage(json.error))
        onToast(t.categoryCreateSuccess)
      } else if (form.categoryId) {
        const res = await fetch(
          `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(form.categoryId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.trim(),
              slug: form.slug.trim() || undefined,
              parentId: form.parentId,
              imageUrl: form.imageUrl.trim(),
              description: form.description.trim(),
              seoTitle: form.seoTitle.trim(),
              seoDescription: form.seoDescription.trim(),
              seoIndex: form.seoIndex,
              seoBody: form.seoBody.trim(),
              sizeGuideImageUrl: form.sizeGuideImageUrl.trim(),
              isActive: form.isActive,
            }),
          }
        )
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(errorMessage(json.error))
        onToast(t.categoryUpdateSuccess)
      }
      setForm(null)
      await loadTree()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateSeo = async () => {
    if (!form || form.mode !== 'edit' || !form.categoryId) return
    setGeneratingSeo(true)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(form.categoryId)}/generate-seo`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
      )
      const json = (await res.json()) as { category?: CategoryNode; usedAi?: boolean; error?: string }
      if (!res.ok || !json.category) throw new Error(errorMessage(json.error))
      setForm({
        ...form,
        seoTitle: json.category.seoTitle,
        seoDescription: json.category.seoDescription,
        seoBody: json.category.seoBody,
        seoBodyGeneratedAt: json.category.seoBodyGeneratedAt,
      })
      onToast(json.usedAi ? t.categorySeoAutoGenerateSuccess : t.categorySeoAutoGenerateSuccessFallback)
      await loadTree()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categorySeoAutoGenerateError, 'destructive')
    } finally {
      setGeneratingSeo(false)
    }
  }

  const handleDelete = async (node: CategoryNode) => {
    const hasChildren = node.children.length > 0
    const confirmed = window.confirm(hasChildren ? t.categoryDeleteConfirmHasChildren : t.categoryDeleteConfirm)
    if (!confirmed) return
    setBusyId(node.id)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(node.id)}${hasChildren ? '?force=1' : ''}`,
        { method: 'DELETE' }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(errorMessage(json.error))
      onToast(t.categoryDeleteSuccess)
      await loadTree()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const handleReorder = async (node: CategoryNode, direction: 'up' | 'down') => {
    setBusyId(node.id)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(node.id)}/reorder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction }),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(errorMessage(json.error))
      await loadTree()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const openAssign = useCallback(
    async (categoryId: string) => {
      setAssignCategoryId(categoryId)
      setAssignLoading(true)
      try {
        const [invRes, assignedRes] = await Promise.all([
          fetch(
            `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/inventory-picker?page=0&pageSize=100`
          ),
          fetch(
            `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(categoryId)}/products`
          ),
        ])
        const invJson = (await invRes.json()) as { rows?: InventoryPickRow[]; error?: string }
        const assignedJson = (await assignedRes.json()) as { inventoryIds?: string[]; error?: string }
        if (!invRes.ok) throw new Error(errorMessage(invJson.error))
        if (!assignedRes.ok) throw new Error(errorMessage(assignedJson.error))
        setAssignInventory(invJson.rows ?? [])
        setAssignSelected(assignedJson.inventoryIds ?? [])
      } catch (e) {
        onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
        setAssignCategoryId(null)
      } finally {
        setAssignLoading(false)
      }
    },
    [partnerId, onToast, errorMessage, t.categoryErrorGeneric]
  )

  const toggleAssignProduct = (id: string) => {
    setAssignSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSaveAssign = async () => {
    if (!assignCategoryId) return
    setAssignSaving(true)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/categories/${encodeURIComponent(assignCategoryId)}/products`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventoryIds: assignSelected }),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(errorMessage(json.error))
      onToast(t.categoryAssignProductsSuccess)
      setAssignCategoryId(null)
      await loadTree()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setAssignSaving(false)
    }
  }

  const parentOptions = useMemo(
    () => selectableParents(tree, form?.mode === 'edit' ? form.categoryId : null),
    [tree, form]
  )

  const renderNode = (node: CategoryNode, siblings: CategoryNode[], index: number) => {
    const busy = busyId === node.id
    return (
      <li key={node.id} className="space-y-2">
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2.5"
          style={{ marginLeft: `${(node.depth - 1) * 20}px` }}
        >
          <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-medium', !node.isActive && 'text-muted-foreground line-through')}>
              {node.name}
            </p>
            <p className="text-xs text-muted-foreground">
              /{node.path} · {node.productCount ?? 0} {t.categoryProductCount}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={busy || index === 0}
              onClick={() => void handleReorder(node, 'up')}
              aria-label={t.categoryEdit}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={busy || index === siblings.length - 1}
              onClick={() => void handleReorder(node, 'down')}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => openCreate(node.id)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t.categoriesAddChild}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void openAssign(node.id)}>
              <Package className="mr-1 h-3.5 w-3.5" />
              {t.categoryAssignProducts}
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => openEdit(node)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={busy}
              onClick={() => void handleDelete(node)}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
            </Button>
          </div>
        </div>
        {node.children.length ? (
          <ul className="space-y-2">
            {node.children.map((child, i) => renderNode(child, node.children, i))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <Card id={sectionId} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t.categoriesTitle}</CardTitle>
            <CardDescription className="mt-1 text-xs">{t.categoriesHint}</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => openCreate(null)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t.categoriesAddRoot}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.categoriesLoading}
          </p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.categoriesEmpty}</p>
        ) : (
          <ul className="space-y-2">{tree.map((node, i) => renderNode(node, tree, i))}</ul>
        )}
      </CardContent>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.mode === 'create' ? t.categoriesAddRoot : t.categoryEdit}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">{t.categoryNameLabel}</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.categoryNamePlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug">{t.categorySlugLabel}</Label>
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={t.categorySlugHint}
                />
                <p className="text-[11px] text-muted-foreground">{t.categorySlugHint}</p>
              </div>
              {parentOptions.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cat-parent">{t.categoriesAddChild}</Label>
                  <select
                    id="cat-parent"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.parentId ?? ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {parentOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {'　'.repeat(Math.max(0, opt.depth - 1))}/{opt.path}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="cat-image">{t.categoryImageLabel}</Label>
                <Input
                  id="cat-image"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-size-guide">Size guide image URL</Label>
                <Input
                  id="cat-size-guide"
                  value={form.sizeGuideImageUrl}
                  onChange={(e) => setForm({ ...form, sizeGuideImageUrl: e.target.value })}
                  placeholder="https://… (PDP modal)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">{t.categoryDescriptionLabel}</Label>
                <Textarea
                  id="cat-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-seo-title">{t.categorySeoTitleLabel}</Label>
                  <Input
                    id="cat-seo-title"
                    value={form.seoTitle}
                    onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-seo-desc">{t.categorySeoDescriptionLabel}</Label>
                  <Input
                    id="cat-seo-desc"
                    value={form.seoDescription}
                    onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                <Label htmlFor="cat-seo-index" className="text-sm">
                  {t.categorySeoIndexLabel}
                </Label>
                <Switch
                  id="cat-seo-index"
                  checked={form.seoIndex}
                  onCheckedChange={(v) => setForm({ ...form, seoIndex: v })}
                />
              </div>
              {form.mode === 'edit' ? (
                <div className="space-y-1.5 rounded-lg border border-border/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="cat-seo-body">{t.categorySeoBodyLabel}</Label>
                    <div className="flex items-center gap-2">
                      {form.seoBodyGeneratedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <Sparkles className="h-3 w-3" />
                          {t.categorySeoGeneratedBadge}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={generatingSeo}
                        onClick={() => void handleGenerateSeo()}
                      >
                        {generatingSeo ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {generatingSeo ? t.categorySeoAutoGenerating : t.categorySeoAutoGenerate}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="cat-seo-body"
                    rows={5}
                    value={form.seoBody}
                    onChange={(e) => setForm({ ...form, seoBody: e.target.value, seoBodyGeneratedAt: null })}
                  />
                  <p className="text-[11px] text-muted-foreground">{t.categorySeoBodyHint}</p>
                </div>
              ) : null}
              {form.mode === 'edit' ? (
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <Label htmlFor="cat-active" className="text-sm">
                    {t.categoryActiveLabel}
                  </Label>
                  <Switch
                    id="cat-active"
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              {t.categoryCancel}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t.categorySave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignCategoryId)} onOpenChange={(open) => !open && setAssignCategoryId(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.categoryAssignProductsTitle}</DialogTitle>
          </DialogHeader>
          {assignLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.categoriesLoading}
            </p>
          ) : (
            <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
              {assignInventory.map((row) => {
                const checked = assignSelected.includes(row.id)
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => toggleAssignProduct(row.id)}
                    className={cn(
                      'flex gap-2 rounded-lg border p-2 text-left transition-colors',
                      checked ? 'border-primary bg-primary/5' : 'border-border/60 bg-background hover:bg-muted/40'
                    )}
                  >
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md bg-muted object-cover" />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-md bg-muted" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">{row.priceHint || row.sku || '—'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignCategoryId(null)}>
              {t.categoryCancel}
            </Button>
            <Button type="button" disabled={assignSaving} onClick={() => void handleSaveAssign()}>
              {assignSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t.categoryAssignProductsSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
