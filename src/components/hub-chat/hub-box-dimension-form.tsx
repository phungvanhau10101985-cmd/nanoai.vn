'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { cmToMm, isPositiveBoxDimensionMm } from '@/lib/packaging/dimensions'
import {
  defaultTuckBoxProductionParams,
  validateTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'

const COPY: Record<
  WebLocale,
  {
    title: string
    length: string
    width: string
    height: string
    hint: string
    orientationHint: string
    lengthPlaceholder: string
    widthPlaceholder: string
    heightPlaceholder: string
    confirm: string
    invalidLength: string
    invalidWidth: string
    invalidHeight: string
    advanced: string
    bleed: string
    glueTab: string
    paper: string
    gap: string
    invalidProduction: string
  }
> = {
  vi: {
    title: 'Kích thước hộp (Dài × Rộng × Cao)',
    length: 'Dài (L)',
    width: 'Rộng (W)',
    height: 'Cao (H)',
    hint: 'Nhập dài × rộng × cao (cm) tự do — hộp mỏng vẫn OK.',
    orientationHint:
      'Dài × rộng × cao ảnh hưởng hướng chữ trên từng mặt. Mỗi mặt tạo ảnh với tỷ lệ gần kích thước thật nhất.',
    lengthPlaceholder: '50',
    widthPlaceholder: '30',
    heightPlaceholder: '3',
    confirm: 'Xác nhận kích thước',
    invalidLength: 'Nhập chiều dài (cm) lớn hơn 0.',
    invalidWidth: 'Nhập chiều rộng (cm) lớn hơn 0.',
    invalidHeight: 'Nhập chiều cao (cm) lớn hơn 0.',
    advanced: 'Thông số sản xuất',
    bleed: 'Bleed (mm)',
    glueTab: 'Tai dán (mm)',
    paper: 'Độ dày giấy (mm)',
    gap: 'Khe bù (mm)',
    invalidProduction: 'Thông số sản xuất nằm ngoài phạm vi an toàn.',
  },
  en: {
    title: 'Box size (L × W × H)',
    length: 'Length (L)',
    width: 'Width (W)',
    height: 'Height (H)',
    hint: 'Enter L × W × H (cm) freely — thin boxes are OK.',
    orientationHint:
      'L × W × H affects text orientation on each face. Each face image uses the closest ratio to your real size.',
    lengthPlaceholder: '50',
    widthPlaceholder: '30',
    heightPlaceholder: '3',
    confirm: 'Confirm dimensions',
    invalidLength: 'Enter length (cm) greater than 0.',
    invalidWidth: 'Enter width (cm) greater than 0.',
    invalidHeight: 'Enter height (cm) greater than 0.',
    advanced: 'Production parameters',
    bleed: 'Bleed (mm)',
    glueTab: 'Glue tab (mm)',
    paper: 'Paper thickness (mm)',
    gap: 'Compensation gap (mm)',
    invalidProduction: 'A production parameter is outside the safe range.',
  },
  zh: {
    title: '盒子尺寸（长 × 宽 × 高）',
    length: '长 (L)',
    width: '宽 (W)',
    height: '高 (H)',
    hint: '自由输入长×宽×高（cm）— 薄盒也可以。',
    orientationHint: '长宽高影响各面文字方向。各面生成最接近实际尺寸比例的图像。',
    lengthPlaceholder: '50',
    widthPlaceholder: '30',
    heightPlaceholder: '3',
    confirm: '确认尺寸',
    invalidLength: '长度（cm）须大于 0。',
    invalidWidth: '宽度（cm）须大于 0。',
    invalidHeight: '高度（cm）须大于 0。',
    advanced: '生产参数',
    bleed: '出血（mm）',
    glueTab: '粘口（mm）',
    paper: '纸张厚度（mm）',
    gap: '补偿间隙（mm）',
    invalidProduction: '生产参数超出安全范围。',
  },
  ja: {
    title: '箱サイズ（長さ × 幅 × 高さ）',
    length: '長さ (L)',
    width: '幅 (W)',
    height: '高さ (H)',
    hint: '長さ×幅×高さ（cm）を自由入力 — 薄い箱も可。',
    orientationHint:
      '長さ×幅×高さは各面の文字の向きに影響します。各面は実寸に最も近い比率で画像を生成します。',
    lengthPlaceholder: '50',
    widthPlaceholder: '30',
    heightPlaceholder: '3',
    confirm: 'サイズを確定',
    invalidLength: '長さ（cm）は 0 より大きく入力してください。',
    invalidWidth: '幅（cm）は 0 より大きく入力してください。',
    invalidHeight: '高さ（cm）は 0 より大きく入力してください。',
    advanced: '製造パラメータ',
    bleed: '塗り足し (mm)',
    glueTab: '糊しろ (mm)',
    paper: '紙厚 (mm)',
    gap: '補正ギャップ (mm)',
    invalidProduction: '製造パラメータが安全範囲外です。',
  },
  ko: {
    title: '상자 크기 (길이 × 너비 × 높이)',
    length: '길이 (L)',
    width: '너비 (W)',
    height: '높이 (H)',
    hint: '길이×너비×높이(cm) 자유 입력 — 얇은 상자도 가능.',
    orientationHint:
      '길이×너비×높이는 각 면의 글자 방향에 영향을 줍니다. 각 면은 실제 크기에 가장 가까운 비율로 이미지를 생성합니다.',
    lengthPlaceholder: '50',
    widthPlaceholder: '30',
    heightPlaceholder: '3',
    confirm: '크기 확인',
    invalidLength: '길이(cm)는 0보다 커야 합니다.',
    invalidWidth: '너비(cm)는 0보다 커야 합니다.',
    invalidHeight: '높이(cm)는 0보다 커야 합니다.',
    advanced: '생산 사양',
    bleed: '블리드 (mm)',
    glueTab: '접착 탭 (mm)',
    paper: '용지 두께 (mm)',
    gap: '보정 간격 (mm)',
    invalidProduction: '생산 사양이 안전 범위를 벗어났습니다.',
  },
}

function parseDimensionCm(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const cm = Number(normalized)
  if (!Number.isFinite(cm) || cm <= 0) return null
  const mm = cmToMm(cm)
  if (!isPositiveBoxDimensionMm(mm)) return null
  return mm
}

function parseMm(raw: string): number {
  return Number(raw.trim().replace(',', '.'))
}

export function HubBoxDimensionForm({
  locale,
  busy,
  initialDimensionsMm,
  initialProduction,
  onSubmit,
}: {
  locale: WebLocale
  busy: boolean
  initialDimensionsMm?: { length: number; width: number; height: number } | null
  initialProduction?: TuckBoxProductionParams
  onSubmit: (value: {
    dimensionsMm: { length: number; width: number; height: number }
    production: TuckBoxProductionParams
  }) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [length, setLength] = useState(
    initialDimensionsMm ? String(initialDimensionsMm.length / 10) : ''
  )
  const [width, setWidth] = useState(
    initialDimensionsMm ? String(initialDimensionsMm.width / 10) : ''
  )
  const [height, setHeight] = useState(
    initialDimensionsMm ? String(initialDimensionsMm.height / 10) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(Boolean(initialProduction))
  const [bleed, setBleed] = useState(String(initialProduction?.bleedMm ?? 3))
  const [glueTab, setGlueTab] = useState(String(initialProduction?.glueTabMm ?? 15))
  const [paper, setPaper] = useState(String(initialProduction?.paperThicknessMm ?? 0.4))
  const [gap, setGap] = useState(String(initialProduction?.compensationGapMm ?? 0.5))

  const lengthMm = useMemo(() => parseDimensionCm(length), [length])
  const widthMm = useMemo(() => parseDimensionCm(width), [width])
  const heightMm = useMemo(() => parseDimensionCm(height), [height])

  const handleConfirm = () => {
    if (lengthMm == null) {
      setError(t.invalidLength)
      return
    }
    if (widthMm == null) {
      setError(t.invalidWidth)
      return
    }
    if (heightMm == null) {
      setError(t.invalidHeight)
      return
    }
    const defaults = defaultTuckBoxProductionParams(heightMm)
    const production = {
      bleedMm: advanced ? parseMm(bleed) : defaults.bleedMm,
      glueTabMm: advanced ? parseMm(glueTab) : defaults.glueTabMm,
      paperThicknessMm: advanced ? parseMm(paper) : defaults.paperThicknessMm,
      compensationGapMm: advanced ? parseMm(gap) : defaults.compensationGapMm,
    }
    if (Object.keys(validateTuckBoxProductionParams(production)).length) {
      setError(t.invalidProduction)
      return
    }
    setError(null)
    void onSubmit({
      dimensionsMm: { length: lengthMm, width: widthMm, height: heightMm },
      production,
    })
  }

  const canConfirm = lengthMm != null && widthMm != null && heightMm != null && !busy

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-200/90">{t.orientationHint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.length}</span>
          <Input
            type="text"
            inputMode="decimal"
            value={length}
            onChange={(e) => {
              setLength(e.target.value)
              setError(null)
            }}
            placeholder={t.lengthPlaceholder}
            disabled={busy}
            className="h-9 bg-white text-sm dark:bg-slate-900"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.width}</span>
          <Input
            type="text"
            inputMode="decimal"
            value={width}
            onChange={(e) => {
              setWidth(e.target.value)
              setError(null)
            }}
            placeholder={t.widthPlaceholder}
            disabled={busy}
            className="h-9 bg-white text-sm dark:bg-slate-900"
          />
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
      <button
        type="button"
        className="mt-3 text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        onClick={() => {
          if (!advanced && heightMm) {
            const defaults = defaultTuckBoxProductionParams(heightMm)
            setGlueTab(String(defaults.glueTabMm))
          }
          setAdvanced((value) => !value)
        }}
      >
        {t.advanced}
      </button>
      {advanced ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {[
            [t.bleed, bleed, setBleed],
            [t.glueTab, glueTab, setGlueTab],
            [t.paper, paper, setPaper],
            [t.gap, gap, setGap],
          ].map(([label, value, setter]) => (
            <label key={String(label)} className="space-y-1">
              <span className="text-xs text-muted-foreground">{String(label)}</span>
              <Input
                type="text"
                inputMode="decimal"
                value={String(value)}
                onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                disabled={busy}
                className="h-8 bg-white text-sm dark:bg-slate-900"
              />
            </label>
          ))}
        </div>
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
