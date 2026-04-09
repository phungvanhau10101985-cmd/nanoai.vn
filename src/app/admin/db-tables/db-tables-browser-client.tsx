'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, ChevronLeft, ChevronRight, Database } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type TableInfo = { schema: string; name: string; rowEstimate: number | null }

function tr(locale: string, vi: string, en: string) {
  return locale === 'en' ? en : vi
}

function cellPreview(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

export function DbTablesBrowserClient({ locale = 'vi' }: { locale?: string }) {
  const { toast } = useToast()
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [filter, setFilter] = useState('')
  const [schema, setSchema] = useState('public')
  const [table, setTable] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [loadingRows, setLoadingRows] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [rowCount, setRowCount] = useState(0)

  const loadTables = useCallback(() => {
    setLoadingList(true)
    fetch('/api/admin/db-tables')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Request failed')
        if (Array.isArray(data.tables)) setTables(data.tables)
        else throw new Error('Invalid response')
      })
      .catch((e) => {
        toast({
          title: tr(locale, 'Không tải được danh sách bảng', 'Failed to load table list'),
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        })
      })
      .finally(() => setLoadingList(false))
  }, [locale, toast])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  const filteredTables = useMemo(() => {
    if (!tables) return []
    const q = filter.trim().toLowerCase()
    if (!q) return tables
    return tables.filter(
      (t) =>
        `${t.schema}.${t.name}`.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.schema.toLowerCase().includes(q)
    )
  }, [tables, filter])

  const loadRows = useCallback(
    async (sch: string, tbl: string, p: number) => {
      if (!sch || !tbl) return
      setLoadingRows(true)
      try {
        const u = new URL('/api/admin/db-tables', window.location.origin)
        u.searchParams.set('schema', sch)
        u.searchParams.set('table', tbl)
        u.searchParams.set('page', String(p))
        u.searchParams.set('limit', String(limit))
        const res = await fetch(u.toString())
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Lỗi tải dữ liệu')
        setColumns(Array.isArray(data.columns) ? data.columns : [])
        setRows(Array.isArray(data.rows) ? data.rows : [])
        setRowCount(typeof data.rowCount === 'number' ? data.rowCount : 0)
      } catch (e) {
        toast({
          title: tr(locale, 'Lỗi đọc bảng', 'Failed to read table'),
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        })
        setColumns([])
        setRows([])
        setRowCount(0)
      } finally {
        setLoadingRows(false)
      }
    },
    [limit, locale, toast]
  )

  const pickTable = (sch: string, tbl: string) => {
    setSchema(sch)
    setTable(tbl)
    setPage(1)
    void loadRows(sch, tbl, 1)
  }

  const goPage = (next: number) => {
    const p = Math.max(1, next)
    setPage(p)
    void loadRows(schema, table, p)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" aria-hidden />
            {tr(locale, 'Danh sách bảng (public, auth)', 'Tables (public, auth)')}
          </CardTitle>
          <CardDescription>
            {tr(
              locale,
              'Chọn một bảng để xem dữ liệu phân trang (chỉ đọc). Ước lượng số dòng có thể lệch thực tế.',
              'Pick a table for paginated read-only preview. Row estimates may be approximate.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder={tr(locale, 'Lọc theo tên bảng hoặc schema...', 'Filter by table or schema...')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-md"
          />
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[min(40vh,320px)] overflow-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="p-2 font-medium">schema</th>
                    <th className="p-2 font-medium">table</th>
                    <th className="p-2 font-medium">~rows</th>
                    <th className="p-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.map((t) => (
                    <tr
                      key={`${t.schema}.${t.name}`}
                      className={
                        t.schema === schema && t.name === table
                          ? 'bg-primary/10'
                          : 'hover:bg-muted/40'
                      }
                    >
                      <td className="p-2 font-mono">{t.schema}</td>
                      <td className="p-2 font-mono">{t.name}</td>
                      <td className="p-2 text-muted-foreground">
                        {t.rowEstimate != null ? Math.round(t.rowEstimate).toLocaleString() : '—'}
                      </td>
                      <td className="p-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => pickTable(t.schema, t.name)}>
                          {tr(locale, 'Xem', 'View')}
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

      {table ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base font-mono">
                {schema}.{table}
              </CardTitle>
              <CardDescription>
                {tr(locale, 'Trang', 'Page')} {page} — {rowCount}{' '}
                {tr(locale, 'dòng trong trang (tối đa', 'rows this page (max')}{' '}
                {limit})
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingRows || page <= 1}
                onClick={() => goPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <span className="min-w-[2rem] text-center text-sm tabular-nums">{page}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingRows || rowCount < limit}
                onClick={() => goPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRows ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/40 odd:bg-muted/20">
                        {columns.map((c) => (
                          <td key={c} className="max-w-[min(28rem,40vw)] truncate px-2 py-1 font-mono" title={cellPreview(row[c])}>
                            {cellPreview(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
