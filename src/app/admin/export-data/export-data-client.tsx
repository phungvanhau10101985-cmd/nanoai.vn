'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, FileJson, FileSpreadsheet, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useStepUpOtp, fetchWithStepUp } from '@/components/auth/step-up-otp-provider'

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
  const [longCells, setLongCells] = useState<Array<{ table: string; id: string; column: string; length: number; preview: string }> | null>(null)
  const [checkingLong, setCheckingLong] = useState(false)
  const { toast } = useToast()
  const { ensureStepUp } = useStepUpOtp()

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

  async function handleCheckLongCells() {
    setCheckingLong(true)
    setLongCells(null)
    try {
      const res = await fetch('/api/admin/export-data/long-cells')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Lỗi kiểm tra')
      setLongCells(data.violations ?? [])
      toast({
        title: data.summary,
        variant: data.violations?.length ? 'destructive' : 'default',
      })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Lỗi kiểm tra', variant: 'destructive' })
    } finally {
      setCheckingLong(false)
    }
  }

  async function handleExport() {
    if (selected.size === 0) {
      toast({ title: 'Chọn ít nhất một bảng', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120000)
      const res = await fetchWithStepUp(
        '/api/admin/export-data',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables: [...selected], format }),
          signal: controller.signal,
        },
        ensureStepUp
      )
      clearTimeout(timeout)
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
      const msg = e instanceof Error ? e.message : 'Lỗi xuất dữ liệu'
      toast({
        title: 'Lỗi xuất dữ liệu',
        description: msg.includes('abort') ? 'Quá thời gian chờ. Thử xuất ít bảng hơn.' : msg,
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

      <Card>
        <CardHeader>
          <CardTitle>{tr(locale, 'Kiểm tra ô quá dài', 'Check long cells', '检查超长单元格', '長いセルをチェック', '긴 셀 확인')}</CardTitle>
          <CardDescription>
            {tr(locale, 'Excel giới hạn 32.767 ký tự/ô. Bấm để tìm ô vượt giới hạn (bảng worksheet_official_questions).', 'Excel limits 32,767 chars/cell. Click to find violations in worksheet_official_questions.', 'Excel 每单元格限制 32,767 字符。点击查找 worksheet_official_questions 中的违规。', 'Excelは1セル32,767文字まで。worksheet_official_questionsの違反を検索。', 'Excel 셀당 32,767자 제한. worksheet_official_questions 위반 검색.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={handleCheckLongCells} disabled={checkingLong}>
            {checkingLong ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {tr(locale, 'Tìm ô vượt giới hạn', 'Find cells over limit', '查找超限单元格', '制限超過セルを検索', '제한 초과 셀 찾기')}
          </Button>
          {longCells !== null && (
            <div className="rounded-md border p-3 text-sm">
              {longCells.length === 0 ? (
                <p className="text-muted-foreground">{tr(locale, 'Không có ô nào vượt 32.767 ký tự.', 'No cells exceed 32,767 characters.', '没有单元格超过 32,767 字符。', '32,767文字を超えるセルはありません。', '32,767자를 초과하는 셀이 없습니다.')}</p>
              ) : (
                <ul className="space-y-2">
                  {longCells.map((v, i) => (
                    <li key={i} className="border-b pb-2 last:border-0">
                      <span className="font-mono text-amber-600">{v.table}</span> id={v.id.slice(0, 8)}… cột <strong>{v.column}</strong>: {v.length.toLocaleString()} ký tự
                      <div className="mt-1 truncate text-muted-foreground">{v.preview}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {tr(locale, 'Định dạng:', 'Format:', '格式:', '形式:', '형식:')}
        </span>
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
        <Button
          size="lg"
          onClick={handleExport}
          disabled={loading || selected.size === 0}
          className="ml-2"
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
    </div>
  )
}
