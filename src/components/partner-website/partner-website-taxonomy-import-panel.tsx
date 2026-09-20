'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { TaxonomyImportSummary } from '@/lib/partner-website/category/partner-category-taxonomy-import'
import { cn } from '@/lib/utils'
import { Download, Loader2, RefreshCw, Upload } from 'lucide-react'

type FormTreeNode = {
  db_id: string
  external_id: string | null
  level: number
  name: string
  slug: string
  children: FormTreeNode[]
}

type ClusterOption = {
  external_id: string
  slug: string
  name: string
  index_policy: string
}

type TaxonomyInfo = {
  categories: { cat1: number; cat2: number; cat3: number }
  clusters: number
  products: { total: number; linked_to_cat3: number }
}

type Props = {
  t: PartnerWebsiteCopy
  partnerId: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onImported: () => void
}

function fillCopy(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template)
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function StatUpsert({
  t,
  label,
  inserted,
  updated,
  hint,
}: {
  t: PartnerWebsiteCopy
  label: string
  inserted: number
  updated: number
  hint?: string
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-emerald-700">{fillCopy(t.taxonomyImportInserted, { n: inserted })}</span>
        <span className="font-semibold text-amber-800">{fillCopy(t.taxonomyImportUpdated, { n: updated })}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {fillCopy(t.taxonomyImportRows, { n: inserted + updated })}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function ImportResultBlock({
  t,
  result,
}: {
  t: PartnerWebsiteCopy
  result: TaxonomyImportSummary
}) {
  const totalErrors =
    result.errors.seo_clusters.length + result.errors.categories.length + result.errors.category_paths.length
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatUpsert
          t={t}
          label="Cat1"
          inserted={result.summary.categories['1'].inserted}
          updated={result.summary.categories['1'].updated}
        />
        <StatUpsert
          t={t}
          label="Cat2"
          inserted={result.summary.categories['2'].inserted}
          updated={result.summary.categories['2'].updated}
        />
        <StatUpsert
          t={t}
          label="Cat3"
          inserted={result.summary.categories['3'].inserted}
          updated={result.summary.categories['3'].updated}
        />
        <StatUpsert
          t={t}
          label="Cluster"
          inserted={result.summary.clusters.inserted}
          updated={result.summary.clusters.updated}
          hint={`${result.summary.clusters.in_database_after}`}
        />
      </div>
      <div className="text-xs text-muted-foreground">{fillCopy(t.taxonomyImportElapsed, { ms: result.elapsed_ms })}</div>
      {totalErrors > 0 ? (
        <details className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            {fillCopy(t.taxonomyImportErrorCount, { n: totalErrors })}
          </summary>
          {(['seo_clusters', 'categories', 'category_paths'] as const).map((k) => {
            const list = result.errors[k]
            if (!list.length) return null
            return (
              <div key={k} className="mt-2">
                <div className="font-medium">
                  {k} ({list.length}):
                </div>
                <ul className="ml-4 list-disc">
                  {list.slice(0, 50).map((m, i) => (
                    <li key={`${k}-${i}`}>{m}</li>
                  ))}
                  {list.length > 50 ? <li>… +{list.length - 50}</li> : null}
                </ul>
              </div>
            )
          })}
        </details>
      ) : (
        <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">{t.taxonomyImportNoErrors}</div>
      )}
    </div>
  )
}

export function PartnerWebsiteTaxonomyImportPanel({ t, partnerId, onToast, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState<TaxonomyInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<TaxonomyImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [formTree, setFormTree] = useState<FormTreeNode[]>([])
  const [clusters, setClusters] = useState<ClusterOption[]>([])
  const [formLoading, setFormLoading] = useState(false)

  const [cat1New, setCat1New] = useState(false)
  const [cat1ExistingId, setCat1ExistingId] = useState('')
  const [cat1Name, setCat1Name] = useState('')
  const [cat1Slug, setCat1Slug] = useState('')
  const [cat2New, setCat2New] = useState(true)
  const [cat2ExistingId, setCat2ExistingId] = useState('')
  const [cat2Name, setCat2Name] = useState('')
  const [cat2Slug, setCat2Slug] = useState('')
  const [cat3Name, setCat3Name] = useState('')
  const [cat3Slug, setCat3Slug] = useState('')
  const [cat3SeoIndex, setCat3SeoIndex] = useState<'index' | 'noindex'>('index')
  const [cat3SortOrder, setCat3SortOrder] = useState(0)
  const [clusterNew, setClusterNew] = useState(true)
  const [clusterExistingId, setClusterExistingId] = useState('')
  const [clusterName, setClusterName] = useState('')
  const [clusterSlug, setClusterSlug] = useState('')
  const [clusterIndexPolicy, setClusterIndexPolicy] = useState<'index' | 'noindex'>('index')
  const [isActive, setIsActive] = useState(true)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualResult, setManualResult] = useState<TaxonomyImportSummary | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)

  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/taxonomy`

  const reloadInfo = useCallback(async () => {
    if (!partnerId) return
    setLoadingInfo(true)
    try {
      const res = await fetch(`${base}/info`)
      const json = (await res.json()) as TaxonomyInfo & { error?: string }
      if (!res.ok) throw new Error(json.error || t.categoryErrorGeneric)
      setInfo(json)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.categoryErrorGeneric, 'destructive')
    } finally {
      setLoadingInfo(false)
    }
  }, [base, partnerId, onToast, t.categoryErrorGeneric])

  const loadFormRefs = useCallback(async () => {
    if (!partnerId) return
    setFormLoading(true)
    try {
      const [treeRes, clusterRes] = await Promise.all([fetch(`${base}/form-tree`), fetch(`${base}/clusters-list`)])
      const treeJson = (await treeRes.json()) as { tree?: FormTreeNode[] }
      const clusterJson = (await clusterRes.json()) as { clusters?: ClusterOption[] }
      setFormTree(Array.isArray(treeJson.tree) ? treeJson.tree : [])
      setClusters(Array.isArray(clusterJson.clusters) ? clusterJson.clusters : [])
    } catch {
      setFormTree([])
      setClusters([])
    } finally {
      setFormLoading(false)
    }
  }, [base, partnerId])

  useEffect(() => {
    void reloadInfo()
    void loadFormRefs()
  }, [reloadInfo, loadFormRefs])

  useEffect(() => {
    if (cat1New) {
      setCat2New(true)
      setCat2ExistingId('')
    }
  }, [cat1New])

  const cat1Options = useMemo(
    () => formTree.filter((n) => Boolean(n.external_id) && n.level === 1),
    [formTree]
  )
  const cat2Options = useMemo(() => {
    if (!cat1ExistingId) return []
    const n1 = formTree.find((x) => x.external_id === cat1ExistingId)
    return (n1?.children || []).filter((c) => Boolean(c.external_id) && c.level === 2)
  }, [formTree, cat1ExistingId])

  const handleImport = async (file: File) => {
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${base}/import`, { method: 'POST', body: fd })
      const json = (await res.json()) as TaxonomyImportSummary & { error?: string }
      if (!res.ok || json.ok !== true) throw new Error(json.error || t.categoryErrorGeneric)
      setImportResult(json)
      onToast(t.taxonomyImportNoErrors)
      void reloadInfo()
      void loadFormRefs()
      onImported()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.categoryErrorGeneric
      setImportError(msg)
      onToast(msg, 'destructive')
    } finally {
      setImporting(false)
    }
  }

  const handleManualSubmit = async () => {
    if (!cat3Name.trim()) {
      onToast(t.taxonomyImportNamePlaceholder, 'destructive')
      return
    }
    if (!cat1New && !cat1ExistingId) {
      onToast(t.taxonomyImportPickLevel, 'destructive')
      return
    }
    if (cat1New && !cat1Name.trim()) {
      onToast(t.taxonomyImportNamePlaceholder, 'destructive')
      return
    }
    if (!cat2New && !cat2ExistingId) {
      onToast(t.taxonomyImportPickLevel, 'destructive')
      return
    }
    if (cat2New && !cat2Name.trim()) {
      onToast(t.taxonomyImportNamePlaceholder, 'destructive')
      return
    }
    if (!clusterNew && !clusterExistingId) {
      onToast(t.taxonomyImportPickLevel, 'destructive')
      return
    }
    if (clusterNew && !clusterName.trim()) {
      onToast(t.taxonomyImportNamePlaceholder, 'destructive')
      return
    }

    setManualSubmitting(true)
    setManualError(null)
    setManualResult(null)
    try {
      const payload: Record<string, unknown> = {
        cat3Name: cat3Name.trim(),
        cat3Slug: cat3Slug.trim() || null,
        cat3SeoIndex,
        cat3SortOrder,
        isActive,
      }
      if (cat1New) {
        payload.cat1Name = cat1Name.trim()
        payload.cat1Slug = cat1Slug.trim() || null
      } else {
        payload.cat1ExistingExternalId = cat1ExistingId
      }
      if (cat2New) {
        payload.cat2Name = cat2Name.trim()
        payload.cat2Slug = cat2Slug.trim() || null
      } else {
        payload.cat2ExistingExternalId = cat2ExistingId
      }
      if (clusterNew) {
        payload.clusterName = clusterName.trim()
        payload.clusterSlug = clusterSlug.trim() || null
        payload.clusterIndexPolicy = clusterIndexPolicy
      } else {
        payload.clusterExistingExternalId = clusterExistingId
      }
      const res = await fetch(`${base}/manual-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as TaxonomyImportSummary & { error?: string }
      if (!res.ok || json.ok !== true) throw new Error(json.error || t.categoryErrorGeneric)
      setManualResult(json)
      onToast(t.taxonomyImportNoErrors)
      void reloadInfo()
      void loadFormRefs()
      onImported()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.categoryErrorGeneric
      setManualError(msg)
      onToast(msg, 'destructive')
    } finally {
      setManualSubmitting(false)
    }
  }

  return (
    <div className="mb-6 space-y-4 rounded-lg border border-border/70 bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold">{t.taxonomyImportTitle}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t.taxonomyImportHint}</p>
      </div>

      <section className="rounded-md border border-border/60 bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">{t.taxonomyImportStatus}</h4>
          <Button type="button" size="sm" variant="outline" disabled={loadingInfo} onClick={() => void reloadInfo()}>
            {loadingInfo ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            {t.taxonomyImportRefresh}
          </Button>
        </div>
        {info ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Cat1" value={info.categories.cat1} />
            <Stat label="Cat2" value={info.categories.cat2} />
            <Stat label="Cat3" value={info.categories.cat3} />
            <Stat label="SEO clusters" value={info.clusters} />
            <Stat
              label="Products"
              value={`${info.products.linked_to_cat3} / ${info.products.total}`}
              hint={t.taxonomyImportLinkedProducts}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-border/60 bg-background p-3">
        <h4 className="text-sm font-medium">1. {t.taxonomyImportDownload}</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" asChild>
            <a href={`${base}/sample`}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t.taxonomyImportDownload}
            </a>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={`${base}/sample?blank_template=true`}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {t.taxonomyImportDownloadBlank}
            </a>
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-border/60 bg-background p-3">
        <h4 className="text-sm font-medium">2. {t.taxonomyImportUploadTitle}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t.taxonomyImportUploadHint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
            {t.taxonomyImportUploadTitle}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleImport(file)
            }}
          />
        </div>
        {importing ? <p className="mt-2 text-sm text-muted-foreground">{t.taxonomyImportProcessing}</p> : null}
        {importError ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{importError}</div>
        ) : null}
        {importResult ? <ImportResultBlock t={t} result={importResult} /> : null}
      </section>

      <section className="rounded-md border border-border/60 bg-background p-3">
        <h4 className="text-sm font-medium">3. {t.taxonomyImportManualTitle}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t.taxonomyImportManualHint}</p>
        {formLoading ? <p className="mt-2 text-xs text-muted-foreground">{t.categoriesLoading}</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
            <h5 className="text-sm font-semibold">{t.taxonomyImportCat1}</h5>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cat1New}
                onChange={(e) => {
                  setCat1New(e.target.checked)
                  if (e.target.checked) setCat1ExistingId('')
                }}
              />
              {t.taxonomyImportCreateNew} {t.taxonomyImportCat1}
            </label>
            {!cat1New ? (
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={cat1ExistingId}
                onChange={(e) => {
                  setCat1ExistingId(e.target.value)
                  setCat2ExistingId('')
                }}
              >
                <option value="">{t.taxonomyImportPickLevel}</option>
                {cat1Options.map((n) => (
                  <option key={n.external_id!} value={n.external_id!}>
                    {n.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <Input placeholder={t.taxonomyImportNamePlaceholder} value={cat1Name} onChange={(e) => setCat1Name(e.target.value)} />
                <Input placeholder={t.taxonomyImportSlugPlaceholder} value={cat1Slug} onChange={(e) => setCat1Slug(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
            <h5 className="text-sm font-semibold">{t.taxonomyImportCat2}</h5>
            {!cat1New ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cat2New}
                  disabled={cat1New}
                  onChange={(e) => {
                    setCat2New(e.target.checked)
                    if (e.target.checked) setCat2ExistingId('')
                  }}
                />
                {t.taxonomyImportCreateNew} {t.taxonomyImportCat2}
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">{t.taxonomyImportCreateNew} {t.taxonomyImportCat1}</p>
            )}
            {!cat2New && !cat1New ? (
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={cat2ExistingId}
                onChange={(e) => setCat2ExistingId(e.target.value)}
                disabled={!cat1ExistingId}
              >
                <option value="">{t.taxonomyImportPickLevel}</option>
                {cat2Options.map((n) => (
                  <option key={n.external_id!} value={n.external_id!}>
                    {n.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <Input placeholder={t.taxonomyImportNamePlaceholder} value={cat2Name} onChange={(e) => setCat2Name(e.target.value)} />
                <Input placeholder={t.taxonomyImportSlugPlaceholder} value={cat2Slug} onChange={(e) => setCat2Slug(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3 lg:col-span-2">
            <h5 className="text-sm font-semibold">{t.taxonomyImportCat3}</h5>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder={t.taxonomyImportNamePlaceholder} value={cat3Name} onChange={(e) => setCat3Name(e.target.value)} />
              <Input placeholder={t.taxonomyImportSlugPlaceholder} value={cat3Slug} onChange={(e) => setCat3Slug(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">seo_index</span>
                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5"
                  value={cat3SeoIndex}
                  onChange={(e) => setCat3SeoIndex(e.target.value as 'index' | 'noindex')}
                >
                  <option value="index">index</option>
                  <option value="noindex">noindex</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">sort_order</span>
                <Input
                  type="number"
                  className="w-24"
                  value={cat3SortOrder}
                  onChange={(e) => setCat3SortOrder(Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label className={cn('flex items-center gap-2', 'pt-5')}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t.categoryActiveLabel}
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/40 p-3 lg:col-span-2">
            <h5 className="text-sm font-semibold">{t.taxonomyImportCluster}</h5>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clusterNew}
                onChange={(e) => {
                  setClusterNew(e.target.checked)
                  if (e.target.checked) setClusterExistingId('')
                }}
              />
              {t.taxonomyImportCreateCluster}
            </label>
            {!clusterNew ? (
              <select
                className="w-full max-w-xl rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={clusterExistingId}
                onChange={(e) => setClusterExistingId(e.target.value)}
              >
                <option value="">{t.taxonomyImportPickLevel}</option>
                {clusters.map((c) => (
                  <option key={c.external_id} value={c.external_id}>
                    {c.name} ({c.slug}) · {c.index_policy}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <Input
                  className="min-w-[10rem] flex-1"
                  placeholder={t.taxonomyImportNamePlaceholder}
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                />
                <Input
                  className="min-w-[10rem] flex-1"
                  placeholder={t.taxonomyImportSlugPlaceholder}
                  value={clusterSlug}
                  onChange={(e) => setClusterSlug(e.target.value)}
                />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">index_policy</span>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-2"
                    value={clusterIndexPolicy}
                    onChange={(e) => setClusterIndexPolicy(e.target.value as 'index' | 'noindex')}
                  >
                    <option value="index">index</option>
                    <option value="noindex">noindex</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={manualSubmitting} onClick={() => void handleManualSubmit()}>
            {manualSubmitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {t.taxonomyImportSaveBranch}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadFormRefs()}>
            {t.taxonomyImportReload}
          </Button>
        </div>
        {manualError ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{manualError}</div>
        ) : null}
        {manualResult ? <ImportResultBlock t={t} result={manualResult} /> : null}
      </section>
    </div>
  )
}
