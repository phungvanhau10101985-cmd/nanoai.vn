'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import {
  defaultTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'
import {
  BOX_DIELINE_GROUPS,
  boxDielineGroupLabel,
  boxDielineStructureCopy,
  resolveBoxDielineStructure,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { generateTuckEndBlankSvg } from '@/lib/packaging/box-net-svg'
import { PAPER_STOCK_IDS, type PaperStockId } from '@/lib/packaging/paper-stock'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    paper: string
    glue: string
    safe: string
    notch: string
    cols: string
    rows: string
    jar: string
    action: string
    stocks: Record<PaperStockId, string>
  }
> = {
  vi: {
    title: 'Chọn kiểu hộp để xuất dieline',
    hint: 'Nắp và đáy cộng 2 lần độ dày giấy. Lưỡi gài và tai bụi hẹp 1 mm mỗi bên. Tai dán không in.',
    paper: 'Loại giấy',
    glue: 'Tai dán (12–20 mm)',
    safe: 'Vùng an toàn (3–5 mm)',
    notch: 'Khoét ngón tay',
    cols: 'Số cột lót',
    rows: 'Số hàng lót',
    jar: 'Đường kính hũ (mm, 0 = tự tính)',
    action: 'Tạo file in',
    stocks: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Độ dày tùy chỉnh',
    },
  },
  en: {
    title: 'Choose a carton style',
    hint: 'Lid and base gain 2× paper caliper. Tuck and dust flaps narrow 1 mm each side. Glue tabs stay unprinted.',
    paper: 'Paper',
    glue: 'Glue tab (12–20 mm)',
    safe: 'Safe zone (3–5 mm)',
    notch: 'Thumb notch',
    cols: 'Insert columns',
    rows: 'Insert rows',
    jar: 'Jar diameter (mm, 0 = auto)',
    action: 'Create the print file',
    stocks: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Custom thickness',
    },
  },
  zh: {
    title: '选择盒型并导出刀模',
    hint: '盖和底各加 2 倍纸厚。插舌和防尘襟片每边收 1 mm。粘口不印。',
    paper: '纸张',
    glue: '粘口（12–20 mm）',
    safe: '安全区（3–5 mm）',
    notch: '扣手孔',
    cols: '内衬列数',
    rows: '内衬行数',
    jar: '瓶径（mm，0 = 自动）',
    action: '生成印刷文件',
    stocks: {
      ivory_300: '象牙卡 300 gsm',
      ivory_350: '象牙卡 350 gsm',
      duplex_300: '双粉卡 300 gsm',
      duplex_350: '双粉卡 350 gsm',
      custom: '自定义厚度',
    },
  },
  ja: {
    title: '箱の型を選んで展開図を書き出す',
    hint: '蓋と底は紙厚の2倍を足します。差し込みと防塵フラップは左右1mmずつ狭めます。糊しろは印刷しません。',
    paper: '用紙',
    glue: '糊しろ（12–20 mm）',
    safe: '安全領域（3–5 mm）',
    notch: '指かけ穴',
    cols: '中仕切り列',
    rows: '中仕切り行',
    jar: '瓶の直径（mm、0 = 自動）',
    action: '印刷ファイルを作成',
    stocks: {
      ivory_300: 'アイボリー 300 gsm',
      ivory_350: 'アイボリー 350 gsm',
      duplex_300: 'デュプレックス 300 gsm',
      duplex_350: 'デュプレックス 350 gsm',
      custom: '厚さ指定',
    },
  },
  ko: {
    title: '상자 형식을 고르고 전개도를 만듭니다',
    hint: '뚜껑과 바닥은 종이 두께의 2배를 더합니다. 꽂이와 먼지덮개는 양쪽 1mm씩 좁힙니다. 접착면은 인쇄하지 않습니다.',
    paper: '용지',
    glue: '접착 탭 (12–20 mm)',
    safe: '안전 영역 (3–5 mm)',
    notch: '손가락 홈',
    cols: '속지 열',
    rows: '속지 행',
    jar: '병 지름 (mm, 0 = 자동)',
    action: '인쇄 파일 만들기',
    stocks: {
      ivory_300: '아이보리 300 gsm',
      ivory_350: '아이보리 350 gsm',
      duplex_300: '듀플렉스 300 gsm',
      duplex_350: '듀플렉스 350 gsm',
      custom: '두께 직접 입력',
    },
  },
}

export function HubBoxDielineStructurePicker({
  locale,
  busy,
  dimensionsMm,
  production,
  structureVersion,
  selectedStructure,
  onSelect,
}: {
  locale: WebLocale
  busy: boolean
  dimensionsMm: BoxDimensionsMm
  production?: TuckBoxProductionParams
  structureVersion?: number | null
  selectedStructure?: BoxDielineStructure
  onSelect: (structure: BoxDielineStructure, production: TuckBoxProductionParams) => void | Promise<void>
}) {
  const t = COPY[locale]
  const initial = resolveBoxDielineStructure(selectedStructure, structureVersion)
  const [draftStructure, setDraftStructure] = useState<BoxDielineStructure>(initial)
  const [stock, setStock] = useState<PaperStockId>(production?.paperStock ?? 'ivory_350')
  const [glue, setGlue] = useState(String(production?.glueTabMm ?? 15))
  const [safe, setSafe] = useState(String(production?.safeZoneMm ?? 4))
  const [notch, setNotch] = useState(production?.fingerNotch ?? true)
  const [cols, setCols] = useState(String(production?.insertCols ?? 2))
  const [rows, setRows] = useState(String(production?.insertRows ?? 3))
  const [jar, setJar] = useState(String(production?.jarDiameterMm ?? 0))
  useEffect(() => {
    setDraftStructure(resolveBoxDielineStructure(selectedStructure, structureVersion))
  }, [selectedStructure, structureVersion])

  const draftProduction = useMemo(() => {
    const base = defaultTuckBoxProductionParams(dimensionsMm.height)
    return {
      ...base,
      ...production,
      paperStock: stock,
      glueTabMm: Number(glue.replace(',', '.')),
      safeZoneMm: Number(safe.replace(',', '.')),
      fingerNotch: notch,
      lockDetails: true,
      insertCols: Number(cols),
      insertRows: Number(rows),
      jarDiameterMm: Number(jar.replace(',', '.')),
    }
  }, [cols, dimensionsMm.height, glue, jar, notch, production, rows, safe, stock])

  const boxDimensions = {
    lengthMm: dimensionsMm.length,
    widthMm: dimensionsMm.width,
    heightMm: dimensionsMm.height,
  }
  const selectedCopy = boxDielineStructureCopy(draftStructure, locale)
  const selectedSvg = generateTuckEndBlankSvg(boxDimensions, draftProduction, locale, draftStructure)

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
          onChange={(event) => setDraftStructure(event.target.value as BoxDielineStructure)}
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
      <div
        className="mt-3 flex h-[220px] w-full items-center justify-center overflow-hidden rounded-md border border-emerald-200 bg-white p-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: selectedSvg }}
      />
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
          <Input className="h-8 bg-white text-sm dark:bg-slate-900" value={glue} disabled={busy} onChange={(event) => setGlue(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t.safe}</span>
          <Input className="h-8 bg-white text-sm dark:bg-slate-900" value={safe} disabled={busy} onChange={(event) => setSafe(event.target.value)} />
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
        onClick={() => void onSelect(draftStructure, draftProduction)}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t.action}
      </Button>
    </div>
  )
}
