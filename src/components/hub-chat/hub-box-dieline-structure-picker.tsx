'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import {
  BOX_DIELINE_STRUCTURE_KEYS,
  boxDielineStructureCopy,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { generateTuckEndBlankSvg } from '@/app/thiet-ke-bao-bi/lib/box-net-svg'

const COPY: Record<
  WebLocale,
  {
    confirmTitle: string
    generateTitle: string
    hint: string
    selected: string
    confirmAction: string
    generateAction: string
  }
> = {
  vi: {
    confirmTitle: 'Chọn kết cấu dieline để xác nhận',
    generateTitle: 'Chọn cách bế để tạo dieline',
    hint: 'Kích thước 6 mặt giữ nguyên; lựa chọn này quyết định cách nối mặt, đường cấn và tai dán.',
    selected: 'Đang chọn',
    confirmAction: 'Xác nhận kiểu này',
    generateAction: 'Tạo dieline theo kiểu này',
  },
  en: {
    confirmTitle: 'Choose a dieline structure to confirm',
    generateTitle: 'Choose a die-cut layout to generate',
    hint: 'All six face sizes stay unchanged; this controls panel connections, creases and glue tabs.',
    selected: 'Selected',
    confirmAction: 'Confirm this structure',
    generateAction: 'Generate this dieline',
  },
  zh: {
    confirmTitle: '选择要确认的刀模结构',
    generateTitle: '选择要生成的模切方式',
    hint: '六个面的尺寸保持不变；此选项决定面板连接、压痕线和粘口。',
    selected: '当前选择',
    confirmAction: '确认此结构',
    generateAction: '按此结构生成刀模',
  },
  ja: {
    confirmTitle: '確認する展開図の構造を選択',
    generateTitle: '作成する型抜き方式を選択',
    hint: '6面の寸法は変わりません。面の接続、折り線、糊しろの配置が変わります。',
    selected: '選択中',
    confirmAction: 'この構造を確定',
    generateAction: 'この構造で作成',
  },
  ko: {
    confirmTitle: '확인할 도면 구조 선택',
    generateTitle: '생성할 톰슨 방식 선택',
    hint: '6개 면의 크기는 유지되며 면 연결, 접는 선, 접착 날개 배치가 달라집니다.',
    selected: '선택됨',
    confirmAction: '이 구조 확인',
    generateAction: '이 구조로 도면 생성',
  },
}

export function HubBoxDielineStructurePicker({
  locale,
  busy,
  dimensionsMm,
  production,
  purpose = 'confirm',
  selectedStructure,
  onSelect,
}: {
  locale: WebLocale
  busy: boolean
  dimensionsMm: BoxDimensionsMm
  production?: TuckBoxProductionParams
  purpose?: 'confirm' | 'generate'
  selectedStructure?: BoxDielineStructure
  onSelect: (structure: BoxDielineStructure) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [draftStructure, setDraftStructure] = useState<BoxDielineStructure>(
    selectedStructure ?? 'straight_tuck'
  )
  useEffect(() => {
    setDraftStructure(selectedStructure ?? 'straight_tuck')
  }, [selectedStructure])
  const boxDimensions = {
    lengthMm: dimensionsMm.length,
    widthMm: dimensionsMm.width,
    heightMm: dimensionsMm.height,
  }
  const selectedCopy = boxDielineStructureCopy(draftStructure, locale)
  const selectedSvg = generateTuckEndBlankSvg(
    boxDimensions,
    production,
    locale,
    draftStructure
  )

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
        {purpose === 'generate' ? t.generateTitle : t.confirmTitle}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div
        className="mt-3 flex h-[280px] w-full items-center justify-center overflow-hidden rounded-md border border-emerald-200 bg-white p-1 sm:h-[320px] [&>svg]:block [&>svg]:!h-full [&>svg]:!min-h-0 [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: selectedSvg }}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {BOX_DIELINE_STRUCTURE_KEYS.map((structure) => {
          const copy = boxDielineStructureCopy(structure, locale)
          return (
            <Button
              key={structure}
              type="button"
              variant="outline"
              disabled={busy}
              className={`h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left text-xs ${
                draftStructure === structure
                  ? 'border-emerald-600 ring-2 ring-emerald-200'
                  : 'border-emerald-200'
              }`}
              onClick={() => setDraftStructure(structure)}
            >
              <span>
                <span className="block font-semibold">{copy.label}</span>
                {draftStructure === structure ? (
                  <span className="mt-0.5 block text-[10px] font-semibold text-emerald-700">
                    {t.selected}
                  </span>
                ) : null}
              </span>
            </Button>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{selectedCopy.description}</p>
      <Button
        type="button"
        disabled={busy}
        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
        onClick={() => void onSelect(draftStructure)}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {purpose === 'generate' ? t.generateAction : t.confirmAction}
      </Button>
    </div>
  )
}
