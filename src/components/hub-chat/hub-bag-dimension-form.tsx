'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { cmToMm } from '@/lib/packaging/dimensions'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'

const COPY: Record<
  WebLocale,
  {
    title: string
    width: string
    height: string
    gusset: string
    hint: string
    confirm: string
    invalidWidth: string
    invalidHeight: string
    invalidGusset: string
  }
> = {
  vi: {
    title: 'Kích thước túi (Rộng × Cao × Dày)',
    width: 'Rộng (R)',
    height: 'Cao (C)',
    gusset: 'Dày (D)',
    hint: 'Nhập R × C × dày (cm). R×C là 2 mặt in bằng nhau; **dày không in** — chỉ cho net/3D.',
    confirm: 'Xác nhận kích thước',
    invalidWidth: 'Nhập chiều rộng (cm) lớn hơn 0.',
    invalidHeight: 'Nhập chiều cao (cm) lớn hơn 0.',
    invalidGusset: 'Gusset (cm) phải > 0 và < chiều cao.',
  },
  en: {
    title: 'Bag size (W × H × depth)',
    width: 'Width (W)',
    height: 'Height (H)',
    gusset: 'Depth (D)',
    hint: 'Enter W × H × depth (cm). W×H = both print faces; **depth is not printed** — for net/3D only.',
    confirm: 'Confirm dimensions',
    invalidWidth: 'Enter width (cm) greater than 0.',
    invalidHeight: 'Enter height (cm) greater than 0.',
    invalidGusset: 'Gusset (cm) must be > 0 and less than height.',
  },
  zh: {
    title: '纸袋尺寸（宽 × 高 × 侧折）',
    width: '宽 (W)',
    height: '高 (H)',
    gusset: '侧折 (G)',
    hint: '输入 W×H×G（cm）— 侧折须小于高度。',
    confirm: '确认尺寸',
    invalidWidth: '宽度（cm）须大于 0。',
    invalidHeight: '高度（cm）须大于 0。',
    invalidGusset: '侧折（cm）须 > 0 且小于高度。',
  },
  ja: {
    title: '袋サイズ（幅 × 高さ × ガセット）',
    width: '幅 (W)',
    height: '高さ (H)',
    gusset: 'ガセット (G)',
    hint: 'W×H×G（cm）を入力 — ガセットは高さより小さく。',
    confirm: 'サイズを確定',
    invalidWidth: '幅（cm）は 0 より大きく。',
    invalidHeight: '高さ（cm）は 0 より大きく。',
    invalidGusset: 'ガセット（cm）は 0 より大きく高さより小さく。',
  },
  ko: {
    title: '가방 크기 (W × H × G)',
    width: '너비 (W)',
    height: '높이 (H)',
    gusset: '가셋 (G)',
    hint: 'W×H×G(cm) 입력 — 가셋은 높이보다 작아야 합니다.',
    confirm: '크기 확인',
    invalidWidth: '너비(cm)는 0보다 커야 합니다.',
    invalidHeight: '높이(cm)는 0보다 커야 합니다.',
    invalidGusset: '가셋(cm)는 0보다 크고 높이보다 작아야 합니다.',
  },
}

function parseCm(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const cm = Number(normalized)
  if (!Number.isFinite(cm) || cm <= 0) return null
  return cmToMm(cm)
}

export function HubBagDimensionForm({
  locale,
  busy,
  initialDimensionsMm,
  onSubmit,
}: {
  locale: WebLocale
  busy: boolean
  initialDimensionsMm?: BagDimensionsMm | null
  onSubmit: (value: { dimensionsMm: BagDimensionsMm }) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [width, setWidth] = useState(initialDimensionsMm ? String(initialDimensionsMm.width / 10) : '20')
  const [height, setHeight] = useState(initialDimensionsMm ? String(initialDimensionsMm.height / 10) : '28')
  const [gusset, setGusset] = useState(initialDimensionsMm ? String(initialDimensionsMm.gusset / 10) : '6')
  const [error, setError] = useState<string | null>(null)

  const widthMm = useMemo(() => parseCm(width), [width])
  const heightMm = useMemo(() => parseCm(height), [height])
  const gussetMm = useMemo(() => parseCm(gusset), [gusset])

  const handleConfirm = () => {
    if (widthMm == null) {
      setError(t.invalidWidth)
      return
    }
    if (heightMm == null) {
      setError(t.invalidHeight)
      return
    }
    if (gussetMm == null || gussetMm >= heightMm) {
      setError(t.invalidGusset)
      return
    }
    setError(null)
    void onSubmit({ dimensionsMm: { width: widthMm, height: heightMm, gusset: gussetMm } })
  }

  const canConfirm = widthMm != null && heightMm != null && gussetMm != null && gussetMm < heightMm && !busy

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">{t.width}</span>
          <Input value={width} onChange={(e) => { setWidth(e.target.value); setError(null) }} disabled={busy} className="h-9" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">{t.height}</span>
          <Input value={height} onChange={(e) => { setHeight(e.target.value); setError(null) }} disabled={busy} className="h-9" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">{t.gusset}</span>
          <Input value={gusset} onChange={(e) => { setGusset(e.target.value); setError(null) }} disabled={busy} className="h-9" />
        </label>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <Button type="button" className="mt-3 w-full" disabled={!canConfirm} onClick={handleConfirm}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.confirm}
      </Button>
    </div>
  )
}
