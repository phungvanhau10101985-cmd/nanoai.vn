'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

export function ExportDataClient({ locale = 'vi' }: { locale?: string }) {
  const [tables, setTables] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<'json' | 'xlsx'>('json')
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/admin/export-data')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.tables)) {
          setTables(data.tables)
          setSelected(new Set(data.tables))
        }
      })
      .catch(() => toast({ title: 'Lỗi tải danh sách bảng', variant: 'destructive' }))
      .finally(() => setLoadingTables(false))
  }, [toast])

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(tables) : new Set())
  }

  const toggle = (table: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(table)
      else next.delete(table)
      return next
    })
  }

  async function handleExport() {
    if (selected.size === 0) {
      toast({ title: 'Chọn ít nhất một bảng', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/export-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: [...selected], format }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Lỗi xuất dữ liệu')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `db-export-${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : 'json'}`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: 'Đã xuất dữ liệu',
        description: `File ${format.toUpperCase()} đã được tải xuống (${selected.size} bảng).`,
        duration: 2000,
      })
    } catch (e) {
      toast({
        title: 'Lỗi xuất dữ liệu',
        description: e instanceof Error ? e.message : 'Lỗi xuất dữ liệu',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loadingTables) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr(locale, 'Định dạng xuất', 'Export format', '导出格式', 'エクスポート形式', '내보내기 형식')}</CardTitle>
          <CardDescription>
            {tr(locale, 'JSON: backup/restore, giữ nguyên kiểu dữ liệu. Excel: mở Excel/Google Sheets, xem dễ.', 'JSON: backup/restore, preserves types. Excel: open in Excel/Sheets.', 'JSON: 备份/恢复，保留类型。Excel: 在 Excel/Sheets 中打开。', 'JSON: バックアップ/復元向け。Excel: Excel/Sheetsで開く。', 'JSON: 백업/복원. Excel: Excel/Sheets에서 열기.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant={format === 'json' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('json')}
          >
            <FileJson className="mr-2 h-4 w-4" />
            JSON
          </Button>
          <Button
            variant={format === 'xlsx' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('xlsx')}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{tr(locale, 'Chọn bảng', 'Select tables', '选择表', 'テーブル選択', '테이블 선택')}</CardTitle>
              <CardDescription>{selected.size} / {tables.length} {tr(locale, 'bảng đã chọn', 'tables selected', '表已选', 'テーブル選択済み', '테이블 선택됨')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                {tr(locale, 'Chọn tất cả', 'Select all', '全选', 'すべて選択', '전체 선택')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                {tr(locale, 'Bỏ chọn tất cả', 'Deselect all', '取消全选', 'すべて解除', '전체 해제')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {tables.map((table) => (
              <label
                key={table}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(table)}
                  onChange={(e) => toggle(table, e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm font-mono">{table}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        onClick={handleExport}
        disabled={loading || selected.size === 0}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tr(locale, 'Đang xuất...', 'Exporting...', '导出中...', 'エクスポート中...', '내보내는 중...')}
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {tr(locale, `Xuất ${selected.size} bảng`, `Export ${selected.size} tables`, `导出 ${selected.size} 表`, `${selected.size} テーブルをエクスポート`, `${selected.size} 테이블 내보내기`)} ({format.toUpperCase()})
          </>
        )}
      </Button>
    </div>
  )
}
