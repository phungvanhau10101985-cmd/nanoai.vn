import type { WebLocale } from '@/lib/i18n/config'

export const DESIGN_RECREATE_MAX_UPLOAD = 4

export type DesignSectorKey =
  | 'fashion'
  | 'accessories'
  | 'packaging'
  | 'interior'
  | 'beauty'
  | 'other'

export type DesignFormatKey =
  | 'concept_board'
  | 'hero_illustration'
  | 'technical_flat'
  | 'mockup_3d'
  | 'material_board'
  | 'detail_closeups'

export type DesignRenderStyleKey =
  | 'realistic_photography'
  | 'fashion_concept_sheet'
  | 'watercolor_illustration'
  | 'pencil_sketch'
  | 'marker_fashion_sketch'
  | 'croquis_gesture'
  | 'ink_wash'
  | 'soft_pastel'
  | 'gouache_matte'
  | 'line_art'
  | 'flat_illustration'
  | 'editorial_lookbook'
  | 'technical_cad'

export const DESIGN_RENDER_STYLE_KEYS: DesignRenderStyleKey[] = [
  'fashion_concept_sheet',
  'watercolor_illustration',
  'pencil_sketch',
  'marker_fashion_sketch',
  'croquis_gesture',
  'ink_wash',
  'soft_pastel',
  'gouache_matte',
  'line_art',
  'flat_illustration',
  'editorial_lookbook',
  'technical_cad',
  'realistic_photography',
]

export type SectorTemplateSection = {
  key: string
  required: boolean
  gridArea: string
}

export const DESIGN_SECTOR_KEYS: DesignSectorKey[] = [
  'fashion',
  'accessories',
  'packaging',
  'interior',
  'beauty',
  'other',
]

export const SECTOR_TEMPLATES: Record<
  DesignSectorKey,
  {
    defaultFormat: DesignFormatKey
    defaultRenderStyle: DesignRenderStyleKey
    aspectRatio: string
    sections: SectorTemplateSection[]
  }
> = {
  fashion: {
    defaultFormat: 'concept_board',
    defaultRenderStyle: 'fashion_concept_sheet',
    aspectRatio: '3:4',
    sections: [
      { key: 'title', required: true, gridArea: 'top' },
      { key: 'hero_illustration', required: true, gridArea: 'center' },
      { key: 'detail_collar', required: true, gridArea: 'left-1' },
      { key: 'detail_embroidery', required: true, gridArea: 'left-2' },
      { key: 'detail_sleeves', required: true, gridArea: 'left-3' },
      { key: 'technical_front', required: true, gridArea: 'right-1' },
      { key: 'technical_back', required: true, gridArea: 'right-2' },
      { key: 'technical_side', required: true, gridArea: 'right-3' },
      { key: 'material_swatch', required: true, gridArea: 'bottom-left' },
      { key: 'styling_coordination', required: true, gridArea: 'bottom-center' },
      { key: 'color_palette', required: true, gridArea: 'bottom-right' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
  accessories: {
    defaultFormat: 'concept_board',
    defaultRenderStyle: 'watercolor_illustration',
    aspectRatio: '3:4',
    sections: [
      { key: 'title', required: true, gridArea: 'top' },
      { key: 'hero_product', required: true, gridArea: 'center' },
      { key: 'detail_hardware', required: true, gridArea: 'left-1' },
      { key: 'detail_material', required: true, gridArea: 'left-2' },
      { key: 'detail_stitching', required: true, gridArea: 'left-3' },
      { key: 'technical_front', required: true, gridArea: 'right-1' },
      { key: 'technical_back', required: true, gridArea: 'right-2' },
      { key: 'technical_side', required: true, gridArea: 'right-3' },
      { key: 'dimension_callout', required: true, gridArea: 'bottom-left' },
      { key: 'styling_coordination', required: true, gridArea: 'bottom-center' },
      { key: 'color_palette', required: true, gridArea: 'bottom-right' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
  packaging: {
    defaultFormat: 'mockup_3d',
    defaultRenderStyle: 'flat_illustration',
    aspectRatio: '1:1',
    sections: [
      { key: 'flat_artwork', required: true, gridArea: 'center' },
      { key: 'mockup_3d', required: true, gridArea: 'right' },
      { key: 'color_palette', required: true, gridArea: 'bottom-left' },
      { key: 'typography_hierarchy', required: true, gridArea: 'bottom-center' },
      { key: 'material_finish', required: true, gridArea: 'bottom-right' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
  interior: {
    defaultFormat: 'hero_illustration',
    defaultRenderStyle: 'realistic_photography',
    aspectRatio: '16:9',
    sections: [
      { key: 'room_render', required: true, gridArea: 'center' },
      { key: 'floor_plan', required: false, gridArea: 'left' },
      { key: 'material_board', required: true, gridArea: 'bottom-left' },
      { key: 'furniture_details', required: true, gridArea: 'bottom-right' },
      { key: 'color_palette', required: true, gridArea: 'bottom-right-extra' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
  beauty: {
    defaultFormat: 'concept_board',
    defaultRenderStyle: 'realistic_photography',
    aspectRatio: '3:4',
    sections: [
      { key: 'product_hero', required: true, gridArea: 'center' },
      { key: 'label_flat', required: true, gridArea: 'left' },
      { key: 'lifestyle_mockup', required: true, gridArea: 'right' },
      { key: 'texture_closeup', required: true, gridArea: 'bottom-left' },
      { key: 'color_palette', required: true, gridArea: 'bottom-right' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
  other: {
    defaultFormat: 'concept_board',
    defaultRenderStyle: 'watercolor_illustration',
    aspectRatio: '3:4',
    sections: [
      { key: 'hero_illustration', required: true, gridArea: 'center' },
      { key: 'detail_panels', required: true, gridArea: 'left' },
      { key: 'technical_views', required: false, gridArea: 'right' },
      { key: 'color_palette', required: true, gridArea: 'bottom' },
      { key: 'inspiration_text', required: true, gridArea: 'footer' },
    ],
  },
}

const SECTOR_FORMATS: Record<DesignSectorKey, DesignFormatKey[]> = {
  fashion: ['concept_board', 'hero_illustration', 'technical_flat', 'detail_closeups', 'material_board'],
  accessories: ['concept_board', 'hero_illustration', 'technical_flat', 'mockup_3d', 'detail_closeups'],
  packaging: ['mockup_3d', 'hero_illustration', 'material_board', 'technical_flat'],
  interior: ['hero_illustration', 'material_board', 'mockup_3d'],
  beauty: ['concept_board', 'hero_illustration', 'mockup_3d', 'material_board'],
  other: ['concept_board', 'hero_illustration', 'technical_flat', 'mockup_3d'],
}

const SECTOR_RENDER_STYLES: Record<DesignSectorKey, DesignRenderStyleKey[]> = {
  fashion: [
    'fashion_concept_sheet',
    'watercolor_illustration',
    'pencil_sketch',
    'marker_fashion_sketch',
    'croquis_gesture',
    'ink_wash',
    'soft_pastel',
    'gouache_matte',
    'line_art',
    'editorial_lookbook',
    'technical_cad',
    'realistic_photography',
  ],
  accessories: [
    'watercolor_illustration',
    'pencil_sketch',
    'marker_fashion_sketch',
    'soft_pastel',
    'line_art',
    'flat_illustration',
    'realistic_photography',
    'editorial_lookbook',
  ],
  packaging: [
    'flat_illustration',
    'line_art',
    'pencil_sketch',
    'gouache_matte',
    'watercolor_illustration',
    'realistic_photography',
  ],
  interior: [
    'realistic_photography',
    'watercolor_illustration',
    'pencil_sketch',
    'soft_pastel',
    'flat_illustration',
  ],
  beauty: [
    'realistic_photography',
    'soft_pastel',
    'watercolor_illustration',
    'gouache_matte',
    'flat_illustration',
    'editorial_lookbook',
  ],
  other: [
    'fashion_concept_sheet',
    'watercolor_illustration',
    'pencil_sketch',
    'marker_fashion_sketch',
    'soft_pastel',
    'line_art',
    'flat_illustration',
    'realistic_photography',
  ],
}

export function isDesignSectorKey(value: string): value is DesignSectorKey {
  return DESIGN_SECTOR_KEYS.includes(value as DesignSectorKey)
}

export function formatsForSector(sector: DesignSectorKey): DesignFormatKey[] {
  return SECTOR_FORMATS[sector]
}

export function renderStylesForSector(sector: DesignSectorKey): DesignRenderStyleKey[] {
  return SECTOR_RENDER_STYLES[sector]
}

export function resolveDesignSector(briefNotes: Record<string, string> | undefined): DesignSectorKey {
  const raw = briefNotes?.design_sector?.trim() ?? ''
  return parseDesignSectorKey(raw) ?? 'fashion'
}

export function resolveDesignFormat(
  briefNotes: Record<string, string> | undefined,
  sector?: DesignSectorKey
): DesignFormatKey {
  const parsed = parseDesignFormatKey(briefNotes?.design_format)
  if (parsed) return parsed
  const s = sector ?? resolveDesignSector(briefNotes)
  return SECTOR_TEMPLATES[s].defaultFormat
}

export function resolveDesignRenderStyle(
  briefNotes: Record<string, string> | undefined,
  sector?: DesignSectorKey
): DesignRenderStyleKey {
  const parsed = parseDesignRenderStyleKey(briefNotes?.render_style)
  if (parsed) return parsed
  const s = sector ?? resolveDesignSector(briefNotes)
  return SECTOR_TEMPLATES[s].defaultRenderStyle
}

export function parseDesignSectorKey(raw: string | undefined | null): DesignSectorKey | null {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (!trimmed) return null
  if (isDesignSectorKey(trimmed)) return trimmed
  if (/thời trang|thoi trang|fashion|may mặc|may mac|áo|ao dai|ao dài|trang phục|trang phuc|服装|ファッション|패션/i.test(raw ?? '')) {
    return 'fashion'
  }
  if (/phụ kiện|phu kien|accessories|túi|tui|giày|giay|trang sức|trang suc|配饰|アクセサリー|액세서리/i.test(raw ?? '')) {
    return 'accessories'
  }
  if (/bao bì|bao bi|packaging|hộp|hop|nhãn|nhan|label|包装|パッケージ|패키징/i.test(raw ?? '')) {
    return 'packaging'
  }
  if (/nội thất|noi that|interior|ngoại thất|ngoai that|phòng|phong|room|室内|インテリア|인테리어/i.test(raw ?? '')) {
    return 'interior'
  }
  if (/mỹ phẩm|my pham|beauty|skincare|cosmetic|化妆品|コスメ|뷰티/i.test(raw ?? '')) {
    return 'beauty'
  }
  return null
}

export function parseDesignFormatKey(raw: string | undefined | null): DesignFormatKey | null {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (!trimmed) return null
  const keys: DesignFormatKey[] = [
    'concept_board',
    'hero_illustration',
    'technical_flat',
    'mockup_3d',
    'material_board',
    'detail_closeups',
  ]
  if (keys.includes(trimmed as DesignFormatKey)) return trimmed as DesignFormatKey
  if (/concept|bảng concept|bang concept|concept board|概念板/i.test(raw ?? '')) return 'concept_board'
  if (/hero|minh họa chính|minh hoa chinh|主图/i.test(raw ?? '')) return 'hero_illustration'
  if (/technical|kỹ thuật|ky thuat|flat sketch|线稿/i.test(raw ?? '')) return 'technical_flat'
  if (/mockup|3d/i.test(raw ?? '')) return 'mockup_3d'
  if (/material|chất liệu|chat lieu|swatch|材质/i.test(raw ?? '')) return 'material_board'
  if (/detail|cận|close/i.test(raw ?? '')) return 'detail_closeups'
  return null
}

export function parseDesignRenderStyleKey(raw: string | undefined | null): DesignRenderStyleKey | null {
  const trimmed = String(raw ?? '').trim().toLowerCase()
  if (!trimmed) return null
  if (DESIGN_RENDER_STYLE_KEYS.includes(trimmed as DesignRenderStyleKey)) {
    return trimmed as DesignRenderStyleKey
  }
  if (/concept sheet|fashion concept|bảng thiết kế thời trang|bang thiet ke thoi trang|bảng concept thời trang/i.test(raw ?? '')) {
    return 'fashion_concept_sheet'
  }
  if (/marker|copic|phác thảo marker|phac thao marker/i.test(raw ?? '')) return 'marker_fashion_sketch'
  if (/croquis|gesture|phác thảo dáng|phac thao dang|figure sketch/i.test(raw ?? '')) return 'croquis_gesture'
  if (/ink.?wash|tuỳ bút|tuy but|mực loang|muc loang|sumi/i.test(raw ?? '')) return 'ink_wash'
  if (/pastel|phấn màu|phan mau/i.test(raw ?? '')) return 'soft_pastel'
  if (/gouache|đục|duc matte/i.test(raw ?? '')) return 'gouache_matte'
  if (/pencil|chì|chi graphite|phác thảo chì|phac thao chi|hand.?drawn sketch/i.test(raw ?? '')) {
    return 'pencil_sketch'
  }
  if (/realistic|ảnh thật|anh that|photo|写实|写真|실사/i.test(raw ?? '')) return 'realistic_photography'
  if (/watercolou?r|màu nước|mau nuoc|水彩|수채/i.test(raw ?? '')) return 'watercolor_illustration'
  if (/line.?art|nét vẽ kỹ thuật|net ve ky thuat|technical line|线稿|線画/i.test(raw ?? '')) return 'line_art'
  if (/flat|phẳng|phang|扁平|フラット/i.test(raw ?? '')) return 'flat_illustration'
  if (/editorial|lookbook/i.test(raw ?? '')) return 'editorial_lookbook'
  if (/cad|technical drawing|bản vẽ kỹ thuật|ban ve ky thuat/i.test(raw ?? '')) return 'technical_cad'
  if (/phác thảo|phac thao|sketch/i.test(raw ?? '')) return 'pencil_sketch'
  return null
}

export function designRenderStylePromptBlock(style: DesignRenderStyleKey): string {
  const blocks: Record<DesignRenderStyleKey, string> = {
    realistic_photography:
      'VISUAL STYLE — Realistic product/fashion photography: natural studio lighting, accurate shadows, photoreal materials.',
    fashion_concept_sheet:
      'VISUAL STYLE — Professional fashion design concept board (like a designer presentation sheet): soft digital watercolor full-body illustration + separate technical flat line drawings (front/back/side) + detail close-ups + material swatch + color palette chips + styling icons + a dedicated INSPIRATION / CẢM HỨNG text paragraph (2–4 sentences), elegant serif section titles, pastel palette, clean white/light background, professional lookbook-infographic layout.',
    watercolor_illustration:
      'VISUAL STYLE — Digital watercolor illustration: soft blended washes, delicate outlines, gentle feminine aesthetic, paper texture subtle.',
    pencil_sketch:
      'VISUAL STYLE — Hand pencil sketch / graphite fashion sketch: visible pencil strokes, soft shading, construction lines lightly visible, sketchbook paper feel, monochrome or lightly tinted.',
    marker_fashion_sketch:
      'VISUAL STYLE — Fashion marker sketch (Copic-style): bold confident outlines, marker color blocks with streak texture, quick professional atelier sketch look.',
    croquis_gesture:
      'VISUAL STYLE — Fashion croquis / gesture sketch: elongated figure proportions, loose energetic lines, minimal facial detail, focus on silhouette and drape movement.',
    ink_wash:
      'VISUAL STYLE — Ink wash / sumi-inspired fashion sketch: expressive black ink lines with gray washes, elegant negative space, artistic atelier presentation.',
    soft_pastel:
      'VISUAL STYLE — Soft pastel digital painting: powdery blended colors, dreamy edges, gentle highlights, romantic fashion illustration mood.',
    gouache_matte:
      'VISUAL STYLE — Matte gouache illustration: opaque flat-ish color fields with soft painterly edges, vintage fashion plate aesthetic, rich but muted pigments.',
    line_art:
      'VISUAL STYLE — Technical fashion line art: monochrome outlines, precise garment construction lines, minimal fill.',
    flat_illustration:
      'VISUAL STYLE — Modern flat illustration: minimal shadows, clean geometric shapes, simplified color blocks.',
    editorial_lookbook:
      'VISUAL STYLE — High-end editorial lookbook: magazine-quality composition, dramatic typography, premium fashion photography aesthetic.',
    technical_cad:
      'VISUAL STYLE — Technical CAD flat sketches: precise front/back/side garment diagrams, dimension lines, construction details.',
  }
  return blocks[style]
}

function sectionPromptLines(sections: SectorTemplateSection[]): string {
  return sections
    .filter((s) => s.required)
    .map((s, i) => {
      const label =
        s.key === 'title'
          ? 'design product title — real garment/product name inferred from sample photos (NOT the word Title/Tiêu đề)'
          : s.key.replace(/_/g, ' ')
      return `${i + 1}. ${label} (${s.gridArea})`
    })
    .join('\n')
}

/**
 * Board header title must name the actual product type from samples
 * (áo măng tô, áo khoác, blazer…), never the placeholder word "Title".
 */
export function buildDesignBoardTitlePrompt(): string {
  return `MANDATORY — DESIGN BOARD TITLE (header under logo):
- Write a short, specific PRODUCT DESIGN NAME based on what the sample product photos show (garment/product category + optional style cue).
- Examples (Vietnamese): "Áo măng tô", "Áo khoác dạ", "Blazer nữ", "Đầm lụa", "Túi xách da", "Giày cao gót".
- Examples (English): "Trench coat", "Wool overcoat", "Women's blazer", "Silk dress".
- Match the board language. Prefer 2–6 words. Elegant serif typography under the client logo.
- FORBIDDEN as the title text: "Tiêu đề", "Title", "TITLE", "Design title", "Product title", "Concept title", or any empty/generic placeholder.
- Infer from sample photos (silhouette, collar, length, category). Do NOT invent unrelated product types.`
}

/** Always required on design recreation images — short “inspiration / concept story” copy. */
export function buildDesignInspirationTextPrompt(): string {
  return `MANDATORY — DESIGN INSPIRATION TEXT (always include on the image):
- Reserve a clear text block titled like "CẢM HỨNG" / "INSPIRATION" / localized equivalent (match board language).
- Write 2–4 short sentences describing the design concept: mood, cultural/style reference, silhouette idea, and what makes the redesign special.
- Place it in a readable footer or side caption area (not covering the hero product). Use elegant, professional typography.
- Do NOT leave this section empty. Do NOT replace it with only icons or color chips.`
}

export function buildConceptBoardLayoutPrompt(sector: DesignSectorKey): string {
  const template = SECTOR_TEMPLATES[sector]
  return `MANDATORY LAYOUT — Design concept board (${sector}):
${sectionPromptLines(template.sections)}

Professional design sheet on clean white/light background. All required sections visible in ONE image. Labels in subtle caption typography. Do NOT copy brand logos or readable text from product sample photos. If a CLIENT LOGO image is attached, embed that exact logo on the board (header area above the product design name).

${buildDesignBoardTitlePrompt()}

${buildDesignInspirationTextPrompt()}`
}

export function buildDesignStepPromptBlock(
  sector: DesignSectorKey,
  format: DesignFormatKey,
  renderStyle: DesignRenderStyleKey,
  stepKey: string
): string {
  const styleBlock = designRenderStylePromptBlock(renderStyle)
  const inspiration = buildDesignInspirationTextPrompt()
  if (stepKey === 'concept_sheet') {
    if (format === 'concept_board' || sector === 'fashion') {
      return `${styleBlock}\n\n${buildConceptBoardLayoutPrompt(sector)}`
    }
    if (format === 'hero_illustration') {
      return `${styleBlock}\n\nOUTPUT: Single hero illustration of the recreated design — full product/outfit, elegant presentation.\n\n${buildDesignBoardTitlePrompt()}\n\n${inspiration}\nInclude a compact inspiration caption block on the image (footer or side).`
    }
    if (format === 'mockup_3d') {
      return `${styleBlock}\n\nOUTPUT: Photorealistic 3D product mockup on clean studio background — accurate materials and colors from brief.\n\n${buildDesignBoardTitlePrompt()}\n\n${inspiration}\nInclude a compact inspiration caption block on the image (footer or side).`
    }
    return `${styleBlock}\n\n${buildConceptBoardLayoutPrompt(sector)}`
  }
  if (stepKey === 'detail_panel') {
    return `${styleBlock}\n\nOUTPUT: Detail close-up panel set — 3 square detail views (texture, construction, embellishment). Clean layout on white background.\n\n${buildDesignBoardTitlePrompt()}\n\n${inspiration}\nAdd a short inspiration caption under or beside the panels.`
  }
  if (stepKey === 'technical_flat') {
    return `${styleBlock}\n\nOUTPUT: Technical flat sketches — front, back, and side views with clean line art. Minimal annotations. White background.\n\n${buildDesignBoardTitlePrompt()}\n\n${inspiration}\nAdd a short inspiration caption (design intent) near the flats.`
  }
  return `${styleBlock}\n\n${inspiration}`
}

export function designSectorLabel(sector: DesignSectorKey, locale: WebLocale): string {
  const labels: Record<WebLocale, Record<DesignSectorKey, string>> = {
    vi: {
      fashion: 'Thời trang / may mặc',
      accessories: 'Phụ kiện (túi, giày, trang sức)',
      packaging: 'Bao bì / nhãn sản phẩm',
      interior: 'Nội thất / không gian',
      beauty: 'Mỹ phẩm / skincare',
      other: 'Khác — AI tự nhận diện',
    },
    en: {
      fashion: 'Fashion / apparel',
      accessories: 'Accessories (bags, shoes, jewelry)',
      packaging: 'Packaging / product labels',
      interior: 'Interior / spatial design',
      beauty: 'Beauty / skincare',
      other: 'Other — AI auto-detect',
    },
    zh: {
      fashion: '时尚 / 服装',
      accessories: '配饰（包、鞋、珠宝）',
      packaging: '包装 / 产品标签',
      interior: '室内 / 空间设计',
      beauty: '美妆 / 护肤',
      other: '其他 — AI 自动识别',
    },
    ja: {
      fashion: 'ファッション / アパレル',
      accessories: 'アクセサリー（バッグ、靴、ジュエリー）',
      packaging: 'パッケージ / ラベル',
      interior: 'インテリア / 空間',
      beauty: 'ビューティー / スキンケア',
      other: 'その他 — AI自動判別',
    },
    ko: {
      fashion: '패션 / 의류',
      accessories: '액세서리 (가방, 신발, 주얼리)',
      packaging: '패키징 / 라벨',
      interior: '인테리어 / 공간',
      beauty: '뷰티 / 스킨케어',
      other: '기타 — AI 자동 감지',
    },
  }
  return labels[locale][sector]
}
