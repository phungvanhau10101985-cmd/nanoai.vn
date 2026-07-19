'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  MAX_PACKAGING_BARCODE_ENTRIES,
  normalizeBarcodeDataFields,
  type PackagingBarcodeFormEntry,
} from '@/lib/packaging/packaging-barcode-form'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    label: string
    content: string
    addRow: string
    removeRow: string
    generate: string
    empty: string
    labelPlaceholder: string
    contentPlaceholder: string
  }
> = {
  vi: {
    title: 'Dữ liệu sản phẩm → 1 mã QR',
    hint: 'Thêm các trường thông tin — hệ thống gộp vào một QR duy nhất. Quét mã sẽ hiển thị toàn bộ nội dung bạn đã điền.',
    label: 'Tên trường (tuỳ chọn)',
    content: 'Nội dung',
    addRow: 'Thêm trường',
    removeRow: 'Xóa',
    generate: 'Tạo mã QR',
    empty: 'Nhập ít nhất một trường dữ liệu hợp lệ.',
    labelPlaceholder: 'Website, SKU, SĐT…',
    contentPlaceholder: 'Giá trị hiển thị khi quét QR',
  },
  en: {
    title: 'Product data → one QR code',
    hint: 'Add information fields — they are combined into a single QR. Scanning shows everything you entered.',
    label: 'Field name (optional)',
    content: 'Value',
    addRow: 'Add field',
    removeRow: 'Remove',
    generate: 'Generate QR code',
    empty: 'Enter at least one valid data field.',
    labelPlaceholder: 'Website, SKU, phone…',
    contentPlaceholder: 'Value shown when the QR is scanned',
  },
  zh: {
    title: '产品数据 → 一个 QR',
    hint: '添加信息字段 — 合并为一个 QR。扫描即可显示您填写的全部内容。',
    label: '字段名（可选）',
    content: '内容',
    addRow: '添加字段',
    removeRow: '删除',
    generate: '生成 QR 码',
    empty: '请至少填写一条有效数据。',
    labelPlaceholder: '网站、SKU、电话…',
    contentPlaceholder: '扫描 QR 时显示的值',
  },
  ja: {
    title: '製品データ → QR 1つ',
    hint: '情報フィールドを追加 — 1つのQRにまとめます。スキャンですべての入力内容が表示されます。',
    label: '項目名（任意）',
    content: '内容',
    addRow: '項目を追加',
    removeRow: '削除',
    generate: 'QRコードを作成',
    empty: '有効なデータを1件以上入力してください。',
    labelPlaceholder: 'Webサイト、SKU、電話…',
    contentPlaceholder: 'QRスキャン時に表示される値',
  },
  ko: {
    title: '제품 데이터 → QR 1개',
    hint: '정보 필드를 추가하면 하나의 QR로 합쳐집니다. 스캔 시 입력한 모든 내용이 표시됩니다.',
    label: '필드 이름(선택)',
    content: '내용',
    addRow: '필드 추가',
    removeRow: '삭제',
    generate: 'QR 코드 생성',
    empty: '유효한 데이터를 최소 1개 입력하세요.',
    labelPlaceholder: '웹사이트, SKU, 전화…',
    contentPlaceholder: 'QR 스캔 시 표시되는 값',
  },
}

function emptyRow(): PackagingBarcodeFormEntry {
  return { content: '', label: '' }
}

export function HubBarcodeLabelForm({
  locale,
  busy,
  initialEntries,
  onSubmit,
}: {
  locale: WebLocale
  busy: boolean
  initialEntries: PackagingBarcodeFormEntry[]
  onSubmit: (entries: PackagingBarcodeFormEntry[]) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [rows, setRows] = useState<PackagingBarcodeFormEntry[]>(
    initialEntries.length ? initialEntries : [emptyRow()]
  )
  const [error, setError] = useState<string | null>(null)

  const normalizedCount = useMemo(() => normalizeBarcodeDataFields(rows).length, [rows])

  const updateRow = (index: number, patch: Partial<PackagingBarcodeFormEntry>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    if (rows.length >= MAX_PACKAGING_BARCODE_ENTRIES) return
    setRows((prev) => [...prev, emptyRow()])
  }

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const handleGenerate = () => {
    const normalized = normalizeBarcodeDataFields(rows)
    if (!normalized.length) {
      setError(t.empty)
      return
    }
    setError(null)
    void onSubmit(
      rows
        .filter((row) => String(row.content ?? '').trim())
        .slice(0, MAX_PACKAGING_BARCODE_ENTRIES)
        .map((row) => ({
          label: row.label?.trim() || undefined,
          content: row.content.trim(),
        }))
    )
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-md border border-violet-100 bg-white/70 p-2.5 dark:border-violet-900 dark:bg-violet-950/40"
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto] sm:items-end">
              <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                {t.label}
                <Input
                  value={row.label ?? ''}
                  disabled={busy}
                  placeholder={formatStudioExampleLabel(locale, t.labelPlaceholder)}
                  className="h-9 text-sm"
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                {t.content}
                <Input
                  value={row.content}
                  disabled={busy}
                  placeholder={formatStudioExampleLabel(locale, t.contentPlaceholder)}
                  className="h-9 text-sm"
                  onChange={(e) => updateRow(index, { content: e.target.value })}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 shrink-0 text-xs text-muted-foreground"
                disabled={busy || rows.length <= 1}
                onClick={() => removeRow(index)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t.removeRow}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-xs"
          disabled={busy || rows.length >= MAX_PACKAGING_BARCODE_ENTRIES}
          onClick={addRow}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t.addRow}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 bg-violet-600 text-xs hover:bg-violet-700"
          disabled={busy || normalizedCount < 1}
          onClick={handleGenerate}
        >
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          {t.generate}
        </Button>
      </div>
    </div>
  )
}
