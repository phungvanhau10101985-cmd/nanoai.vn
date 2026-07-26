import { NAV_GROUPS } from '@/lib/nav-config'
import type { NavGroupKey, ToolKey } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'

export type HubChatMode = 'chat' | 'workflow' | 'pipeline' | 'studio'

export type HubWorkflowGroup = NavGroupKey | 'all'

export type HubToolCatalogEntry = {
  href: string
  labelKey: ToolKey
  groupKey: NavGroupKey
  label: string
  groupLabel: string
}

export const HUB_CHAT_CREDIT = 0.1

export const HUB_CHAT_MODELS = [
  {
    id: 'gemini-2.5-flash',
    label: { vi: 'Gemini 2.5 Flash', en: 'Gemini 2.5 Flash', zh: 'Gemini 2.5 Flash', ja: 'Gemini 2.5 Flash', ko: 'Gemini 2.5 Flash' },
  },
] as const

export function getHubChatFooterModelLabel(
  locale: WebLocale,
  _presetId?: string | null
): string {
  return HUB_CHAT_MODELS[0]!.label[locale]
}

export type HubChatModelId = (typeof HUB_CHAT_MODELS)[number]['id']

/** Workflow phổ biến — chip gợi ý trên thanh chat. */
export const HUB_CHAT_POPULAR: {
  href: string
  labelKey: ToolKey
  samplePrompt: Record<WebLocale, string>
}[] = [
  {
    href: '/thu-do-online/1-nguoi',
    labelKey: 'try_on_1',
    samplePrompt: {
      vi: 'Thử áo sơ mi trắng cho người mẫu nữ, phong cách công sở',
      en: 'Try a white blouse on a female model, office style',
      zh: '为女模特试穿白色衬衫，职场风格',
      ja: '女性モデルに白いブラウスを試着、オフィススタイル',
      ko: '여성 모델에게 흰 블라우스 피팅, 오피스 스타일',
    },
  },
  {
    href: '/lam-net-anh',
    labelKey: 'enhance_image',
    samplePrompt: {
      vi: 'Làm nét ảnh chân dung bị mờ, giữ màu da tự nhiên',
      en: 'Sharpen a blurry portrait while keeping natural skin tones',
      zh: '锐化模糊人像，保持自然肤色',
      ja: 'ぼけたポートレートをシャープ化、肌色は自然に',
      ko: '흐린 인물 사진 선명화, 자연스러운 피부톤 유지',
    },
  },
  {
    href: '/tao-giao-trinh',
    labelKey: 'create_curriculum',
    samplePrompt: {
      vi: 'Giáo trình Toán lớp 10: phương trình bậc hai, 3 tiết',
      en: 'Grade 10 math curriculum: quadratic equations, 3 lessons',
      zh: '高一数学教案：一元二次方程，3课时',
      ja: '高校1年数学：二次方程式、3コマ',
      ko: '고1 수학 교안: 이차방정식, 3차시',
    },
  },
  {
    href: '/tao-bai-hat-lyria-3',
    labelKey: 'lyria3_instrumental_song',
    samplePrompt: {
      vi: 'Bài pop Việt vui tươi về mùa hè, có lời tiếng Việt',
      en: 'Upbeat summer pop song with English lyrics',
      zh: '欢快的夏日流行歌，中文歌词',
      ja: '明るい夏のポップ曲、日本語の歌詞',
      ko: '밝은 여름 팝송, 한국어 가사',
    },
  },
]

export function buildHubToolCatalog(
  toolLabels: Record<string, string>,
  groupLabels: Record<string, string>
): HubToolCatalogEntry[] {
  const out: HubToolCatalogEntry[] = []
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      out.push({
        href: link.href,
        labelKey: link.labelKey,
        groupKey: group.titleKey,
        label: toolLabels[link.labelKey] ?? link.labelKey,
        groupLabel: groupLabels[group.titleKey] ?? group.titleKey,
      })
    }
  }
  return out
}

export function filterCatalogByGroup(
  catalog: HubToolCatalogEntry[],
  group: HubWorkflowGroup
): HubToolCatalogEntry[] {
  if (group === 'all') return catalog
  return catalog.filter((e) => e.groupKey === group)
}
