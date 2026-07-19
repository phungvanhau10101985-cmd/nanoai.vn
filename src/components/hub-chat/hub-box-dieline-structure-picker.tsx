'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import {
  BOX_DIELINE_STRUCTURE_KEYS,
  boxDielineStructureCopy,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { generateTuckEndBlankSvg } from '@/lib/packaging/box-net-svg'

const COPY: Record<
  WebLocale,
  {
    confirmTitle: string
    generateTitle: string
    hint: string
    generateHint: string
    selected: string
    confirmAction: string
    generateAction: string
  }
> = {
  vi: {
    confirmTitle: 'Chọn kết cấu dieline để xác nhận',
    generateTitle: 'Tạo Dieline PDF (2 kiểu)',
    hint: 'Kích thước 6 mặt giữ nguyên; lựa chọn này quyết định cách nối mặt, đường cấn và tai dán.',
    generateHint:
      'Hệ thống tạo sẵn cả Dải ngang và Chữ thập — xem trước từng kiểu rồi bấm tạo; sau đó tải file phù hợp với xưởng in.',
    selected: 'Đang xem trước',
    confirmAction: 'Xác nhận kiểu này',
    generateAction: 'Tạo 2 file Dieline PDF',
  },
  en: {
    confirmTitle: 'Choose a dieline structure to confirm',
    generateTitle: 'Generate Dieline PDF (both layouts)',
    hint: 'All six face sizes stay unchanged; this controls panel connections, creases and glue tabs.',
    generateHint:
      'Both the horizontal strip and cross net are exported — preview each layout, then generate and download the file your printer needs.',
    selected: 'Previewing',
    confirmAction: 'Confirm this structure',
    generateAction: 'Generate both Dieline PDFs',
  },
  zh: {
    confirmTitle: '选择要确认的刀模结构',
    generateTitle: '生成 Dieline PDF（2 种排版）',
    hint: '六个面的尺寸保持不变；此选项决定面板连接、压痕线和粘口。',
    generateHint: '系统将同时导出横向排版与十字排版 — 可先预览，再生成并下载适合印厂的文件。',
    selected: '预览中',
    confirmAction: '确认此结构',
    generateAction: '生成 2 个 Dieline PDF',
  },
  ja: {
    confirmTitle: '確認する展開図の構造を選択',
    generateTitle: 'Dieline PDFを作成（2方式）',
    hint: '6面の寸法は変わりません。面の接続、折り線、糊しろの配置が変わります。',
    generateHint:
      '横一列と十字型の両方を書き出します — プレビュー後に作成し、印刷会社向けのファイルをダウンロードしてください。',
    selected: 'プレビュー中',
    confirmAction: 'この構造を確定',
    generateAction: '2種類のDieline PDFを作成',
  },
  ko: {
    confirmTitle: '확인할 도면 구조 선택',
    generateTitle: 'Dieline PDF 생성(2가지)',
    hint: '6개 면의 크기는 유지되며 면 연결, 접는 선, 접착 날개 배치가 달라집니다.',
    generateHint:
      '가로 스트립과 십자형을 모두 내보냅니다 — 미리본 뒤 생성하고 인쇄소에 맞는 파일을 다운로드하세요.',
    selected: '미리보기',
    confirmAction: '이 구조 확인',
    generateAction: 'Dieline PDF 2종 생성',
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
      <p className="mt-1 text-xs text-muted-foreground">
        {purpose === 'generate' ? t.generateHint : t.hint}
      </p>
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
                <span className="block font-semibold">
                  {formatStudioExampleLabel(locale, copy.label)}
                </span>
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
