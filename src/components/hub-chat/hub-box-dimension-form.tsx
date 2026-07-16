'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WebLocale } from '@/lib/i18n/config'
import { cmToMm, isPositiveBoxDimensionMm } from '@/lib/packaging/dimensions'
import {
  formatMmAsCm,
  getWidthOptionsForLengthLxwOnly,
} from '@/lib/packaging/gemini-dimension-wizard'

const COPY: Record<
  WebLocale,
  {
    title: string
    length: string
    width: string
    height: string
    hint: string
    widthPlaceholder: string
    heightPlaceholder: string
    noWidthOptions: string
    confirm: string
    invalidLength: string
    invalidWidth: string
    invalidHeight: string
  }
> = {
  vi: {
    title: 'Kích thước hộp (Dài × Rộng × Cao)',
    length: 'Dài (L)',
    width: 'Rộng (W)',
    height: 'Cao (H)',
    hint: 'Dài & rộng chọn theo tỷ lệ Gemini cho mặt đáy/nắp (L×W). Cao nhập tự do — hộp mỏng vẫn OK.',
    widthPlaceholder: 'Chọn rộng',
    heightPlaceholder: '3',
    noWidthOptions: 'Không có rộng phù hợp — thử chiều dài khác.',
    confirm: 'Xác nhận kích thước',
    invalidLength: 'Nhập chiều dài (cm) lớn hơn 0.',
    invalidWidth: 'Chọn rộng trong danh sách.',
    invalidHeight: 'Nhập chiều cao (cm) lớn hơn 0.',
  },
  en: {
    title: 'Box size (L × W × H)',
    length: 'Length (L)',
    width: 'Width (W)',
    height: 'Height (H)',
    hint: 'Length & width follow Gemini ratios for the top/bottom face (L×W). Height is free — thin boxes are OK.',
    widthPlaceholder: 'Select width',
    heightPlaceholder: '3',
    noWidthOptions: 'No matching width — try a different length.',
    confirm: 'Confirm dimensions',
    invalidLength: 'Enter length (cm) greater than 0.',
    invalidWidth: 'Pick a width from the list.',
    invalidHeight: 'Enter height (cm) greater than 0.',
  },
  zh: {
    title: '盒子尺寸（长 × 宽 × 高）',
    length: '长 (L)',
    width: '宽 (W)',
    height: '高 (H)',
    hint: '长宽按 Gemini 比例（底/顶面 L×W）。高度自由输入 — 薄盒也可以。',
    widthPlaceholder: '选择宽度',
    heightPlaceholder: '3',
    noWidthOptions: '无匹配宽度 — 请尝试其他长度。',
    confirm: '确认尺寸',
    invalidLength: '长度（cm）须大于 0。',
    invalidWidth: '请从列表选择宽度。',
    invalidHeight: '高度（cm）须大于 0。',
  },
  ja: {
    title: '箱サイズ（長さ × 幅 × 高さ）',
    length: '長さ (L)',
    width: '幅 (W)',
    height: '高さ (H)',
    hint: '長さ・幅は底/天面 (L×W) の Gemini 比率から選択。高さは自由入力 — 薄い箱も可。',
    widthPlaceholder: '幅を選択',
    heightPlaceholder: '3',
    noWidthOptions: '一致する幅がありません — 別の長さを試してください。',
    confirm: 'サイズを確定',
    invalidLength: '長さ（cm）は 0 より大きく入力してください。',
    invalidWidth: 'リストから幅を選択してください。',
    invalidHeight: '高さ（cm）は 0 より大きく入力してください。',
  },
  ko: {
    title: '상자 크기 (길이 × 너비 × 높이)',
    length: '길이 (L)',
    width: '너비 (W)',
    height: '높이 (H)',
    hint: '길이·너비는 바닥/뚜껑 면(L×W) Gemini 비율에서 선택. 높이는 자유 입력 — 얇은 상자도 가능.',
    widthPlaceholder: '너비 선택',
    heightPlaceholder: '3',
    noWidthOptions: '맞는 너비 없음 — 다른 길이를 시도하세요.',
    confirm: '크기 확인',
    invalidLength: '길이(cm)는 0보다 커야 합니다.',
    invalidWidth: '목록에서 너비를 선택하세요.',
    invalidHeight: '높이(cm)는 0보다 커야 합니다.',
  },
}

function parseLengthCm(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const cm = Number(normalized)
  if (!Number.isFinite(cm) || cm <= 0) return null
  const mm = cmToMm(cm)
  if (!isPositiveBoxDimensionMm(mm)) return null
  return mm
}

function parseHeightCm(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const cm = Number(normalized)
  if (!Number.isFinite(cm) || cm <= 0) return null
  const mm = cmToMm(cm)
  if (!isPositiveBoxDimensionMm(mm)) return null
  return mm
}

export function HubBoxDimensionForm({
  locale,
  busy,
  onSubmit,
}: {
  locale: WebLocale
  busy: boolean
  onSubmit: (message: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [length, setLength] = useState('')
  const [widthKey, setWidthKey] = useState('')
  const [height, setHeight] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lengthMm = useMemo(() => parseLengthCm(length), [length])
  const widthOptions = useMemo(
    () => (lengthMm != null ? getWidthOptionsForLengthLxwOnly(lengthMm) : []),
    [lengthMm]
  )
  const selectedWidth = useMemo(
    () => widthOptions.find((o) => String(o.widthMm) === widthKey) ?? null,
    [widthKey, widthOptions]
  )

  const handleLengthChange = (value: string) => {
    setLength(value)
    setWidthKey('')
    setError(null)
  }

  const handleConfirm = () => {
    if (lengthMm == null) {
      setError(t.invalidLength)
      return
    }
    if (!selectedWidth) {
      setError(t.invalidWidth)
      return
    }
    const heightMm = parseHeightCm(height)
    if (heightMm == null) {
      setError(t.invalidHeight)
      return
    }
    setError(null)
    const l = formatMmAsCm(lengthMm, locale)
    const w = formatMmAsCm(selectedWidth.widthMm, locale)
    const h = formatMmAsCm(heightMm, locale)
    void onSubmit(`${l}×${w}×${h} cm`)
  }

  const canConfirm =
    lengthMm != null && selectedWidth != null && parseHeightCm(height) != null && !busy

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.length}</span>
          <Input
            type="text"
            inputMode="decimal"
            value={length}
            onChange={(e) => handleLengthChange(e.target.value)}
            placeholder="50"
            disabled={busy}
            className="h-9 bg-white text-sm dark:bg-slate-900"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.width}</span>
          <Select
            value={widthKey}
            onValueChange={(v) => {
              setWidthKey(v)
              setError(null)
            }}
            disabled={busy || lengthMm == null || widthOptions.length === 0}
          >
            <SelectTrigger className="h-9 bg-white text-sm dark:bg-slate-900">
              <SelectValue placeholder={t.widthPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {widthOptions.map((o) => (
                <SelectItem key={o.widthMm} value={String(o.widthMm)}>
                  {formatMmAsCm(o.widthMm, locale)} cm — L×W {o.geminiLxw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.height}</span>
          <Input
            type="text"
            inputMode="decimal"
            value={height}
            onChange={(e) => {
              setHeight(e.target.value)
              setError(null)
            }}
            placeholder={t.heightPlaceholder}
            disabled={busy}
            className="h-9 bg-white text-sm dark:bg-slate-900"
          />
        </label>
      </div>
      {lengthMm != null && widthOptions.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t.noWidthOptions}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      <Button
        type="button"
        className="mt-3 h-9 w-full bg-violet-600 text-sm hover:bg-violet-700 sm:w-auto"
        disabled={!canConfirm}
        onClick={handleConfirm}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t.confirm}
      </Button>
    </div>
  )
}
