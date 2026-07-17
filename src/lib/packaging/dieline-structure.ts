import type { WebLocale } from '@/lib/i18n/config'

export type BoxDielineStructure = 'straight_tuck' | 'cross_fold'

export const BOX_DIELINE_STRUCTURE_KEYS: BoxDielineStructure[] = [
  'straight_tuck',
  'cross_fold',
]

export const DEFAULT_BOX_DIELINE_STRUCTURE: BoxDielineStructure = 'straight_tuck'

const COPY: Record<
  WebLocale,
  Record<BoxDielineStructure, { label: string; description: string }>
> = {
  vi: {
    straight_tuck: {
      label: 'Dải ngang — sản xuất máy',
      description: 'Một tai dán, nắp gài; phù hợp bế và dán máy số lượng lớn.',
    },
    cross_fold: {
      label: 'Chữ thập — gấp thủ công',
      description: 'Các mặt xếp dạng chữ thập, có nhiều tai dán; phù hợp sản lượng nhỏ.',
    },
  },
  en: {
    straight_tuck: {
      label: 'Horizontal strip — machine production',
      description: 'One glue seam with tuck closures; suited to high-volume die-cutting and gluing.',
    },
    cross_fold: {
      label: 'Cross net — hand folding',
      description: 'Cross-arranged faces with multiple glue tabs; suited to small production runs.',
    },
  },
  zh: {
    straight_tuck: {
      label: '横向排版 — 机器生产',
      description: '单粘口与插舌结构，适合大批量模切和机器糊盒。',
    },
    cross_fold: {
      label: '十字排版 — 手工折叠',
      description: '各面呈十字排列并带多个粘口，适合小批量制作。',
    },
  },
  ja: {
    straight_tuck: {
      label: '横一列 — 機械生産',
      description: '1か所の糊しろと差し込み蓋。大量の型抜き・機械貼りに適します。',
    },
    cross_fold: {
      label: '十字型 — 手折り',
      description: '面を十字に配置し複数の糊しろを使用。小ロット向けです。',
    },
  },
  ko: {
    straight_tuck: {
      label: '가로 스트립 — 기계 생산',
      description: '접착부 1개와 끼움 덮개로 대량 톰슨·기계 접착에 적합합니다.',
    },
    cross_fold: {
      label: '십자형 — 수작업 접기',
      description: '면을 십자형으로 배치하고 접착 날개를 여러 개 사용해 소량 생산에 적합합니다.',
    },
  },
}

export function boxDielineStructureCopy(
  structure: BoxDielineStructure,
  locale: WebLocale
): { label: string; description: string } {
  return COPY[locale][structure]
}

export function parseBoxDielineStructure(
  raw: string | null | undefined
): BoxDielineStructure | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (BOX_DIELINE_STRUCTURE_KEYS.includes(value as BoxDielineStructure)) {
    return value as BoxDielineStructure
  }
  if (/chữ thập|chu thap|cross(?: net| fold)?|手工|十字|수작업|십자/.test(value)) {
    return 'cross_fold'
  }
  if (/dải ngang|dai ngang|horizontal|straight.?tuck|sản xuất máy|machine|横向|機械|기계/.test(value)) {
    return 'straight_tuck'
  }
  return null
}
