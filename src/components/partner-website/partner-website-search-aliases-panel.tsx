'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'

type AliasRow = {
  id: string
  keyword: string
  inventoryId: string | null
  categoryId: string | null
  createdAt: string
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerWebsiteSearchAliasesPanel({ t, partnerId, sectionId, onToast }: Props) {
  const [rows, setRows] = useState<AliasRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [inventoryId, setInventoryId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}/search-aliases`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(basePath)
      const json = (await res.json()) as { aliases?: AliasRow[]; error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.searchAliasesLoadError, 'destructive')
        return
      }
      setRows(json.aliases ?? [])
    } catch {
      onToast?.(t.searchAliasesLoadError, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [basePath, onToast, t.searchAliasesLoadError])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (saving) return
    const kw = keyword.trim()
    if (!kw) return
    if (!inventoryId.trim() && !categoryId.trim()) {
      onToast?.(t.searchAliasesTargetRequired, 'destructive')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          inventoryId: inventoryId.trim() || null,
          categoryId: categoryId.trim() || null,
        }),
      })
      const json = (await res.json()) as { alias?: AliasRow; error?: string }
      if (!res.ok || !json.alias) {
        onToast?.(
          json.error === 'duplicate_keyword' ? t.searchAliasesDuplicate : t.searchAliasesSaveError,
          'destructive'
        )
        return
      }
      setKeyword('')
      setInventoryId('')
      setCategoryId('')
      onToast?.(t.searchAliasesCreateSuccess)
      void load()
    } catch {
      onToast?.(t.searchAliasesSaveError, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        onToast?.(t.searchAliasesDeleteError, 'destructive')
        return
      }
      onToast?.(t.searchAliasesDeleteSuccess)
      void load()
    } catch {
      onToast?.(t.searchAliasesDeleteError, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t.searchAliasesPanelTitle}
        </CardTitle>
        <CardDescription className="text-xs">{t.searchAliasesPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">{t.searchAliasesKeyword}</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t.searchAliasesKeywordPlaceholder}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.searchAliasesInventoryId}</Label>
            <Input
              value={inventoryId}
              onChange={(e) => setInventoryId(e.target.value)}
              placeholder="uuid"
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.searchAliasesCategoryId}</Label>
            <Input
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="uuid"
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" className="h-9 w-full sm:w-auto" disabled={saving} onClick={() => void create()}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              {t.searchAliasesAdd}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            …
          </p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.searchAliasesEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.searchAliasesKeyword}</th>
                  <th className="px-3 py-2 font-medium">{t.searchAliasesInventoryId}</th>
                  <th className="px-3 py-2 font-medium">{t.searchAliasesCategoryId}</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.keyword}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.inventoryId ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.categoryId ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={saving}
                        onClick={() => void remove(row.id)}
                        aria-label={t.searchAliasesDelete}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
