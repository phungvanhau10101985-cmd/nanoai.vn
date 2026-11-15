'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import {
  BOX_FACE_SLOT_ORDER,
  getBoxFaceSlotLabel,
  resolveMockupSlotUrl,
  type BoxFaceSlot,
  type FaceSourceMode,
} from '@/lib/packaging/box-face-slots'
import { getBoxDielineLayoutData } from '@/lib/packaging/box-net-svg'
import {
  BOX_DIELINE_GROUPS,
  boxDielineGroupLabel,
  boxDielineStructureCopy,
  resolveBoxDielineStructure,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import type { BoxNetFaceMap } from '@/lib/packaging/box-net-face-map'
import { PAPER_STOCK_IDS, type PaperStockId } from '@/lib/packaging/paper-stock'
import {
  defaultTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'

type FaceSlots = Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    cut: string
    fold: string
    paper: string
    glue: string
    notch: string
    cols: string
    rows: string
    jar: string
    pick: string
    empty: string
    coord: string
    sheet: string
    action: string
    stocks: Record<PaperStockId, string>
    size: Record<'length' | 'width' | 'height' | 'glue', string>
  }
> = {
  vi: {
    title: 'Dàn 2D — chọn kiểu gấp',
    hint: 'Nét liền là cắt, nét đứt là gấp. Số góc trên là tọa độ mm. Bấm một tấm rồi chọn ảnh mặt khác. Tai dán để trắng.',
    cut: 'Cắt',
    fold: 'Gấp',
    paper: 'Loại giấy',
    glue: 'Tai dán (12–20 mm)',
    notch: 'Khoét ngón tay',
    cols: 'Số cột lót',
    rows: 'Số hàng lót',
    jar: 'Đường kính hũ (mm, 0 = tự tính)',
    pick: 'Đổi ảnh cho tấm đang chọn',
    empty: 'Trống',
    coord: 'Tọa độ',
    sheet: 'Khổ tờ',
    action: 'Tiếp',
    stocks: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Độ dày tùy chỉnh',
    },
    size: { length: 'Dài', width: 'Rộng', height: 'Cao', glue: 'Tai dán' },
  },
  en: {
    title: '2D layout — choose the fold',
    hint: 'Solid lines cut, dashed lines crease. The corner numbers are millimetre coordinates. Click a panel, then pick another face. Glue tabs stay blank.',
    cut: 'Cut',
    fold: 'Crease',
    paper: 'Paper',
    glue: 'Glue tab (12–20 mm)',
    notch: 'Thumb notch',
    cols: 'Insert columns',
    rows: 'Insert rows',
    jar: 'Jar diameter (mm, 0 = auto)',
    pick: 'Swap artwork on the selected panel',
    empty: 'Blank',
    coord: 'Coordinates',
    sheet: 'Sheet',
    action: 'Continue',
    stocks: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Custom thickness',
    },
    size: { length: 'Length', width: 'Width', height: 'Height', glue: 'Glue tab' },
  },
  zh: {
    title: '二维展开 — 选择盒型',
    hint: '实线是刀线，虚线是折线。角上的数字是毫米坐标。点一块再选别的面。粘口留白。',
    cut: '刀线',
    fold: '折线',
    paper: '纸张',
    glue: '粘口（12–20 mm）',
    notch: '扣手孔',
    cols: '内衬列数',
    rows: '内衬行数',
    jar: '瓶径（mm，0 = 自动）',
    pick: '更换所选面板的图',
    empty: '空白',
    coord: '坐标',
    sheet: '纸张尺寸',
    action: '继续',
    stocks: {
      ivory_300: '象牙卡 300 gsm',
      ivory_350: '象牙卡 350 gsm',
      duplex_300: '双粉卡 300 gsm',
      duplex_350: '双粉卡 350 gsm',
      custom: '自定义厚度',
    },
    size: { length: '长', width: '宽', height: '高', glue: '粘口' },
  },
  ja: {
    title: '2D展開 — 折り方を選ぶ',
    hint: '実線はカット、破線は折りです。角の数字は mm 座標です。パネルをクリックして別の面の画像を選びます。糊しろは白のままです。',
    cut: 'カット',
    fold: '折り',
    paper: '用紙',
    glue: '糊しろ（12–20 mm）',
    notch: '指かけ穴',
    cols: '中仕切り列',
    rows: '中仕切り行',
    jar: '瓶の直径（mm、0 = 自動）',
    pick: '選択中のパネルの画像を入れ替え',
    empty: '空白',
    coord: '座標',
    sheet: 'シート',
    action: '次へ',
    stocks: {
      ivory_300: 'アイボリー 300 gsm',
      ivory_350: 'アイボリー 350 gsm',
      duplex_300: 'デュプレックス 300 gsm',
      duplex_350: 'デュプレックス 350 gsm',
      custom: '厚さ指定',
    },
    size: { length: '長さ', width: '幅', height: '高さ', glue: '糊しろ' },
  },
  ko: {
    title: '2D 전개 — 접기 방식 선택',
    hint: '실선은 컷, 점선은 접힘입니다. 모서리 숫자는 mm 좌표입니다. 면을 누른 뒤 다른 면 이미지를 고릅니다. 접착면은 비웁니다.',
    cut: '컷',
    fold: '접힘',
    paper: '용지',
    glue: '접착 탭 (12–20 mm)',
    notch: '손가락 홈',
    cols: '속지 열',
    rows: '속지 행',
    jar: '병 지름 (mm, 0 = 자동)',
    pick: '선택한 면의 이미지 바꾸기',
    empty: '비움',
    coord: '좌표',
    sheet: '시트',
    action: '다음',
    stocks: {
      ivory_300: '아이보리 300 gsm',
      ivory_350: '아이보리 350 gsm',
      duplex_300: '듀플렉스 300 gsm',
      duplex_350: '듀플렉스 350 gsm',
      custom: '두께 직접 입력',
    },
    size: { length: '길이', width: '너비', height: '높이', glue: '접착 탭' },
  },
}

function mmText(value: number, locale: WebLocale): string {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return locale === 'vi' ? text.replace('.', ',') : text
}

export function HubBoxNetBoard({
  locale,
  busy,
  dimensionsMm,
  production,
  structureVersion,
  selectedStructure,
  faceSlots,
  faceMap,
  onConfirm,
}: {
  locale: WebLocale
  busy: boolean
  dimensionsMm: BoxDimensionsMm
  production?: TuckBoxProductionParams
  structureVersion?: number | null
  selectedStructure?: BoxDielineStructure
  faceSlots: FaceSlots
  faceMap?: BoxNetFaceMap
  onConfirm: (
    structure: BoxDielineStructure,
    production: TuckBoxProductionParams,
    faceMap: BoxNetFaceMap
  ) => void | Promise<void>
}) {
  const t = COPY[locale]
  const clipPrefix = useId().replace(/:/g, '')
  const initial = resolveBoxDielineStructure(selectedStructure, structureVersion)
  const [draftStructure, setDraftStructure] = useState<BoxDielineStructure>(initial)
  const [stock, setStock] = useState<PaperStockId>(production?.paperStock ?? 'ivory_350')
  const [glue, setGlue] = useState(String(production?.glueTabMm ?? 15))
  const [notch, setNotch] = useState(production?.fingerNotch ?? true)
  const [cols, setCols] = useState(String(production?.insertCols ?? 2))
  const [rows, setRows] = useState(String(production?.insertRows ?? 3))
  const [jar, setJar] = useState(String(production?.jarDiameterMm ?? 0))
  const [draftMap, setDraftMap] = useState<BoxNetFaceMap>(faceMap ?? {})
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    setDraftStructure(resolveBoxDielineStructure(selectedStructure, structureVersion))
  }, [selectedStructure, structureVersion])
  useEffect(() => {
    setDraftMap(faceMap ?? {})
  }, [faceMap])

  const draftProduction = useMemo(() => {
    const base = defaultTuckBoxProductionParams(dimensionsMm.height)
    return {
      ...base,
      ...production,
      paperStock: stock,
      glueTabMm: Number(glue.replace(',', '.')),
      fingerNotch: notch,
      lockDetails: true,
      insertCols: Number(cols),
      insertRows: Number(rows),
      jarDiameterMm: Number(jar.replace(',', '.')),
    }
  }, [cols, dimensionsMm.height, glue, jar, notch, production, rows, stock])

  const layout = useMemo(
    () =>
      getBoxDielineLayoutData(
        draftStructure,
        {
          lengthMm: dimensionsMm.length,
          widthMm: dimensionsMm.width,
          heightMm: dimensionsMm.height,
        },
        draftProduction
      ),
    [dimensionsMm.height, dimensionsMm.length, dimensionsMm.width, draftProduction, draftStructure]
  )
  const selected = selectedIndex != null ? layout.panels[selectedIndex] : undefined
  const margin = 28
  const viewBox = `${-margin} ${-margin} ${layout.bounds.widthMm + margin * 2} ${layout.bounds.heightMm + margin * 2}`
  const selectedCopy = boxDielineStructureCopy(draftStructure, locale)

  const assignFace = (source: BoxFaceSlot) => {
    if (!selected) return
    setDraftMap((current) => {
      const next = { ...current }
      if (source === selected.slot) delete next[selected.slot]
      else next[selected.slot] = source
      return next
    })
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium">{selectedCopy.label}</span>
        <select
          className="h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-sm dark:bg-slate-900"
          value={draftStructure}
          disabled={busy}
          onChange={(event) => {
            setDraftStructure(event.target.value as BoxDielineStructure)
            setSelectedIndex(null)
          }}
        >
          {BOX_DIELINE_GROUPS.map((group) => (
            <optgroup key={group.id} label={boxDielineGroupLabel(group.id, locale)}>
              {group.structures.map((structure) => (
                <option key={structure} value={structure}>
                  {boxDielineStructureCopy(structure, locale).label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">{selectedCopy.description}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-rose-600" />
          {t.cut}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t border-dashed border-violet-600" />
          {t.fold}
        </span>
        <span>
          {t.size.length} {mmText(dimensionsMm.length, locale)} mm · {t.size.width}{' '}
          {mmText(dimensionsMm.width, locale)} mm · {t.size.height} {mmText(dimensionsMm.height, locale)} mm ·{' '}
          {t.size.glue} {mmText(layout.glueTabMm, locale)} mm
        </span>
      </div>
      <div className="mt-3 max-h-[440px] overflow-auto rounded-md border border-emerald-200 bg-white p-2 dark:bg-slate-950">
        <svg viewBox={viewBox} className="h-auto w-full" role="img">
          <rect
            x={0}
            y={0}
            width={layout.bounds.widthMm}
            height={layout.bounds.heightMm}
            fill="#f8fafc"
          />
          {layout.panels.map((panel, index) => {
            const source = draftMap[panel.slot] ?? panel.slot
            const url = resolveMockupSlotUrl(source, faceSlots)
            const cx = panel.x + panel.w / 2
            const cy = panel.y + panel.h / 2
            const rotation = panel.rotation ?? 0
            const clipId = `${clipPrefix}-panel-${index}`
            const fontSize = Math.max(7, Math.min(12, Math.min(panel.w, panel.h) * 0.16))
            return (
              <g key={`${panel.slot}-${index}`} onClick={() => setSelectedIndex(index)} className="cursor-pointer">
                <clipPath id={clipId}>
                  <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} />
                </clipPath>
                <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} fill="#e2e8f0" />
                {url ? (
                  <image
                    href={url}
                    x={panel.x}
                    y={panel.y}
                    width={panel.w}
                    height={panel.h}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${clipId})`}
                    transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}
                  />
                ) : null}
                <text
                  x={panel.x + 1.5}
                  y={panel.y + fontSize}
                  fontSize={fontSize}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={fontSize * 0.18}
                  paintOrder="stroke"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {mmText(panel.x, locale)}, {mmText(panel.y, locale)}
                </text>
                <text
                  x={cx}
                  y={panel.y + panel.h - 2}
                  textAnchor="middle"
                  fontSize={Math.max(6, fontSize * 0.85)}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={fontSize * 0.16}
                  paintOrder="stroke"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {mmText(panel.w, locale)}×{mmText(panel.h, locale)}
                </text>
                {selectedIndex === index ? (
                  <rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.w}
                    height={panel.h}
                    fill="none"
                    stroke="#059669"
                    strokeWidth={1.4}
                  />
                ) : null}
              </g>
            )
          })}
          {layout.glueRects?.map((rect, index) => (
            <rect key={`glue-${index}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#ffffff" pointerEvents="none" />
          ))}
          {layout.knockouts?.map((hole, index) =>
            hole.shape === 'ellipse' ? (
              <ellipse
                key={`hole-${index}`}
                cx={hole.x + hole.w / 2}
                cy={hole.y + hole.h / 2}
                rx={hole.w / 2}
                ry={hole.h / 2}
                fill="#ffffff"
                pointerEvents="none"
              />
            ) : (
              <rect key={`hole-${index}`} x={hole.x} y={hole.y} width={hole.w} height={hole.h} fill="#ffffff" pointerEvents="none" />
            )
          )}
          {layout.fingerNotches?.map((notchMark, index) => (
            <circle key={`notch-${index}`} cx={notchMark.cx} cy={notchMark.cy} r={notchMark.r} fill="#ffffff" pointerEvents="none" />
          ))}
          {layout.foldSegments.map(([x1, y1, x2, y2], index) => (
            <line
              key={`fold-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#7c3aed"
              strokeWidth={0.55}
              strokeDasharray="2.2 1.3"
              pointerEvents="none"
            />
          ))}
          {layout.cutSegments.map(([x1, y1, x2, y2], index) => (
            <line
              key={`cut-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#e11d48"
              strokeWidth={0.7}
              pointerEvents="none"
            />
          ))}
          <line
            x1={0}
            y1={layout.bounds.heightMm + 8}
            x2={layout.bounds.widthMm}
            y2={layout.bounds.heightMm + 8}
            stroke="#475569"
            strokeWidth={0.45}
          />
          <line
            x1={0}
            y1={layout.bounds.heightMm + 5}
            x2={0}
            y2={layout.bounds.heightMm + 11}
            stroke="#475569"
            strokeWidth={0.45}
          />
          <line
            x1={layout.bounds.widthMm}
            y1={layout.bounds.heightMm + 5}
            x2={layout.bounds.widthMm}
            y2={layout.bounds.heightMm + 11}
            stroke="#475569"
            strokeWidth={0.45}
          />
          <text
            x={layout.bounds.widthMm / 2}
            y={layout.bounds.heightMm + 18}
            textAnchor="middle"
            fontSize={8}
            fill="#334155"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {t.sheet} {mmText(layout.bounds.widthMm, locale)} mm
          </text>
          <line x1={-8} y1={0} x2={-8} y2={layout.bounds.heightMm} stroke="#475569" strokeWidth={0.45} />
          <line x1={-11} y1={0} x2={-5} y2={0} stroke="#475569" strokeWidth={0.45} />
          <line
            x1={-11}
            y1={layout.bounds.heightMm}
            x2={-5}
            y2={layout.bounds.heightMm}
            stroke="#475569"
            strokeWidth={0.45}
          />
          <text
            x={-14}
            y={layout.bounds.heightMm / 2}
            textAnchor="middle"
            fontSize={8}
            fill="#334155"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            transform={`rotate(-90 -14 ${layout.bounds.heightMm / 2})`}
          >
            {mmText(layout.bounds.heightMm, locale)} mm
          </text>
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t.coord}: {selected ? `${mmText(selected.x, locale)}, ${mmText(selected.y, locale)} mm` : '—'}
        {selected ? ` · ${getBoxFaceSlotLabel(selected.slot, locale)}` : ''}
      </p>
      <p className="mt-2 text-xs font-medium">{t.pick}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {BOX_FACE_SLOT_ORDER.map((slot) => {
          const url = resolveMockupSlotUrl(slot, faceSlots)
          const active = selected ? (draftMap[selected.slot] ?? selected.slot) === slot : false
          return (
            <button
              key={slot}
              type="button"
              disabled={busy || !selected}
              onClick={() => assignFace(slot)}
              className={`w-[72px] overflow-hidden rounded-md border bg-white text-left disabled:opacity-50 dark:bg-slate-900 ${
                active ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
              }`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={getBoxFaceSlotLabel(slot, locale)} className="h-12 w-full object-cover" />
              ) : (
                <span className="flex h-12 items-center justify-center text-[10px] text-muted-foreground">{t.empty}</span>
              )}
              <span className="block truncate px-1 py-0.5 text-[10px]">{getBoxFaceSlotLabel(slot, locale)}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t.paper}</span>
          <select
            className="h-8 w-full rounded-md border bg-white px-2 text-sm dark:bg-slate-900"
            value={stock}
            disabled={busy}
            onChange={(event) => setStock(event.target.value as PaperStockId)}
          >
            {PAPER_STOCK_IDS.map((id) => (
              <option key={id} value={id}>
                {t.stocks[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t.glue}</span>
          <Input
            className="h-8 bg-white text-sm dark:bg-slate-900"
            value={glue}
            disabled={busy}
            onChange={(event) => setGlue(event.target.value)}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-xs">
          <input type="checkbox" checked={notch} disabled={busy} onChange={(event) => setNotch(event.target.checked)} />
          {t.notch}
        </label>
      </div>
      {draftStructure === 'insert' ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t.cols}</span>
            <Input className="h-8 bg-white text-sm" value={cols} disabled={busy} onChange={(event) => setCols(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t.rows}</span>
            <Input className="h-8 bg-white text-sm" value={rows} disabled={busy} onChange={(event) => setRows(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t.jar}</span>
            <Input className="h-8 bg-white text-sm" value={jar} disabled={busy} onChange={(event) => setJar(event.target.value)} />
          </label>
        </div>
      ) : null}
      <Button
        type="button"
        disabled={busy}
        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
        onClick={() => void onConfirm(draftStructure, draftProduction, draftMap)}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t.action}
      </Button>
    </div>
  )
}
