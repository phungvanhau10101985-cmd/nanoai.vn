import type { WebLocale } from '@/lib/i18n/config'
import type { PackagingDiscoveryChoice } from '@/lib/packaging/packaging-discovery-choices'
import {
  DESIGN_SECTOR_KEYS,
  type DesignFormatKey,
  type DesignRenderStyleKey,
  type DesignSectorKey,
  designSectorLabel,
  formatsForSector,
  renderStylesForSector,
  resolveDesignSector,
} from '@/lib/design/design-sector-templates'

export const DESIGN_LANGUAGE_STEP_KEY = 'design_language'

export type DesignRecreateDiscoveryInputKind =
  | 'chat'
  | 'sector_picker'
  | 'format_picker'
  | 'render_style_picker'
  | 'notes_picker'
  | 'language_picker'
  | 'color_palette_picker'

export type DesignRecreateDesignInputKind =
  | 'chat'
  | 'concept_sheet_picker'
  | 'detail_panel_picker'
  | 'technical_flat_picker'

export type DesignBoardLanguageKey = 'vi' | 'en' | 'bilingual' | 'other'

const FORMAT_LABELS: Record<DesignFormatKey, Record<WebLocale, string>> = {
  concept_board: {
    vi: 'Bảng concept đầy đủ',
    en: 'Full concept board',
    zh: '完整概念板',
    ja: 'フルコンセプトボード',
    ko: '전체 컨셉 보드',
  },
  hero_illustration: {
    vi: 'Minh họa hero',
    en: 'Hero illustration',
    zh: '主图插画',
    ja: 'ヒーローイラスト',
    ko: '히어로 일러스트',
  },
  technical_flat: {
    vi: 'Bản vẽ kỹ thuật',
    en: 'Technical flat',
    zh: '技术平稿',
    ja: '技術フラット',
    ko: '기술 플랫',
  },
  mockup_3d: {
    vi: 'Mockup 3D',
    en: '3D mockup',
    zh: '3D mockup',
    ja: '3Dモックアップ',
    ko: '3D 목업',
  },
  material_board: {
    vi: 'Bảng chất liệu / màu',
    en: 'Material & color board',
    zh: '材质色板',
    ja: '素材・カラーボード',
    ko: '소재·컬러 보드',
  },
  detail_closeups: {
    vi: 'Panel chi tiết cận',
    en: 'Detail close-up panel',
    zh: '细节特写面板',
    ja: 'ディテールパネル',
    ko: '디테일 클로즈업',
  },
}

const RENDER_STYLE_LABELS: Record<DesignRenderStyleKey, Record<WebLocale, string>> = {
  fashion_concept_sheet: {
    vi: 'Bảng concept thời trang (màu nước + flat kỹ thuật)',
    en: 'Fashion concept sheet (watercolor + tech flats)',
    zh: '时尚概念板（水彩+技术平稿）',
    ja: 'ファッションコンセプト（水彩+技術フラット）',
    ko: '패션 컨셉 시트 (수채+기술 플랫)',
  },
  watercolor_illustration: {
    vi: 'Màu nước digital',
    en: 'Digital watercolor',
    zh: '数字水彩',
    ja: 'デジタル水彩',
    ko: '디지털 수채화',
  },
  pencil_sketch: {
    vi: 'Phác thảo chì',
    en: 'Pencil sketch',
    zh: '铅笔素描',
    ja: '鉛筆スケッチ',
    ko: '연필 스케치',
  },
  marker_fashion_sketch: {
    vi: 'Phác thảo marker thời trang',
    en: 'Fashion marker sketch',
    zh: '马克笔时装速写',
    ja: 'マーカーファッションスケッチ',
    ko: '마커 패션 스케치',
  },
  croquis_gesture: {
    vi: 'Croquis / phác thảo dáng',
    en: 'Croquis / gesture sketch',
    zh: '人体动态速写',
    ja: 'クロッキー / ジェスチャー',
    ko: '크로키 / 제스처 스케치',
  },
  ink_wash: {
    vi: 'Tuỳ bút / mực loang',
    en: 'Ink wash',
    zh: '水墨晕染',
    ja: 'インクウォッシュ',
    ko: '잉크 워시',
  },
  soft_pastel: {
    vi: 'Pastel mềm',
    en: 'Soft pastel',
    zh: '柔和粉彩',
    ja: 'ソフトパステル',
    ko: '소프트 파스텔',
  },
  gouache_matte: {
    vi: 'Gouache đục',
    en: 'Matte gouache',
    zh: '不透明水粉',
    ja: 'マットガッシュ',
    ko: '매트 구아슈',
  },
  realistic_photography: {
    vi: 'Ảnh chụp thật',
    en: 'Realistic photo',
    zh: '写实摄影',
    ja: 'リアル写真',
    ko: '실사 사진',
  },
  line_art: {
    vi: 'Nét vẽ kỹ thuật (line art)',
    en: 'Technical line art',
    zh: '技术线稿',
    ja: '技術線画',
    ko: '기술 라인아트',
  },
  flat_illustration: {
    vi: 'Minh họa flat',
    en: 'Flat illustration',
    zh: '扁平插画',
    ja: 'フラットイラスト',
    ko: '플랫 일러스트',
  },
  editorial_lookbook: {
    vi: 'Lookbook editorial',
    en: 'Editorial lookbook',
    zh: '编辑型 lookbook',
    ja: 'エディトリアルルックブック',
    ko: '에디토리얼 룩북',
  },
  technical_cad: {
    vi: 'CAD kỹ thuật',
    en: 'Technical CAD',
    zh: '技术 CAD',
    ja: '技術CAD',
    ko: '기술 CAD',
  },
}

const LANGUAGE_CHOICES: Array<{
  key: DesignBoardLanguageKey
  labels: Record<WebLocale, string>
  brief: Record<WebLocale, string>
}> = [
  {
    key: 'vi',
    labels: {
      vi: 'Tiếng Việt',
      en: 'Vietnamese',
      zh: '越南语',
      ja: 'ベトナム語',
      ko: '베트남어',
    },
    brief: {
      vi: 'Ngôn ngữ trên bản thiết kế: tiếng Việt',
      en: 'Board language: Vietnamese',
      zh: '设计板语言：越南语',
      ja: 'デザインボード言語：ベトナム語',
      ko: '디자인 보드 언어: 베트남어',
    },
  },
  {
    key: 'en',
    labels: {
      vi: 'Tiếng Anh',
      en: 'English',
      zh: '英语',
      ja: '英語',
      ko: '영어',
    },
    brief: {
      vi: 'Ngôn ngữ trên bản thiết kế: tiếng Anh',
      en: 'Board language: English',
      zh: '设计板语言：英语',
      ja: 'デザインボード言語：英語',
      ko: '디자인 보드 언어: 영어',
    },
  },
  {
    key: 'bilingual',
    labels: {
      vi: 'Song ngữ (VI + EN)',
      en: 'Bilingual (VI + EN)',
      zh: '双语（越+英）',
      ja: '二言語（越+英）',
      ko: '이중 언어 (베+영)',
    },
    brief: {
      vi: 'Ngôn ngữ trên bản thiết kế: song ngữ Việt + Anh',
      en: 'Board language: bilingual Vietnamese + English',
      zh: '设计板语言：越南语+英语双语',
      ja: 'デザインボード言語：ベトナム語+英語',
      ko: '디자인 보드 언어: 베트남어+영어',
    },
  },
  {
    key: 'other',
    labels: {
      vi: 'Khác',
      en: 'Other',
      zh: '其他',
      ja: 'その他',
      ko: '기타',
    },
    brief: {
      vi: 'Ngôn ngữ trên bản thiết kế: khác',
      en: 'Board language: other',
      zh: '设计板语言：其他',
      ja: 'デザインボード言語：その他',
      ko: '디자인 보드 언어: 기타',
    },
  },
]

function toChoice(
  key: string,
  labels: Record<WebLocale, string>,
  briefPrefix?: Partial<Record<WebLocale, string>>
): PackagingDiscoveryChoice {
  return {
    key,
    labels,
    brief: {
      vi: briefPrefix?.vi ? `${briefPrefix.vi}${labels.vi}` : labels.vi,
      en: briefPrefix?.en ? `${briefPrefix.en}${labels.en}` : labels.en,
      zh: briefPrefix?.zh ? `${briefPrefix.zh}${labels.zh}` : labels.zh,
      ja: briefPrefix?.ja ? `${briefPrefix.ja}${labels.ja}` : labels.ja,
      ko: briefPrefix?.ko ? `${briefPrefix.ko}${labels.ko}` : labels.ko,
    },
  }
}

export function getDesignRecreateDiscoveryInputKind(
  stepKey: string | null | undefined
): DesignRecreateDiscoveryInputKind {
  if (!stepKey) return 'chat'
  if (stepKey === 'design_sector') return 'sector_picker'
  if (stepKey === 'design_format') return 'format_picker'
  if (stepKey === 'render_style') return 'render_style_picker'
  if (stepKey === 'design_notes') return 'notes_picker'
  if (stepKey === DESIGN_LANGUAGE_STEP_KEY) return 'language_picker'
  if (stepKey === 'color_palette') return 'color_palette_picker'
  return 'chat'
}

export function designSectorChoices(): PackagingDiscoveryChoice[] {
  return DESIGN_SECTOR_KEYS.map((key) => {
    const labels = {
      vi: designSectorLabel(key, 'vi'),
      en: designSectorLabel(key, 'en'),
      zh: designSectorLabel(key, 'zh'),
      ja: designSectorLabel(key, 'ja'),
      ko: designSectorLabel(key, 'ko'),
    }
    return toChoice(key, labels, {
      vi: 'Mảng thiết kế: ',
      en: 'Design sector: ',
      zh: '设计领域：',
      ja: 'デザイン分野：',
      ko: '디자인 분야: ',
    })
  })
}

export function designFormatChoices(
  briefNotes: Record<string, string> | undefined
): PackagingDiscoveryChoice[] {
  const sector = resolveDesignSector(briefNotes)
  return formatsForSector(sector).map((key) =>
    toChoice(key, FORMAT_LABELS[key], {
      vi: 'Định dạng output: ',
      en: 'Output format: ',
      zh: '输出格式：',
      ja: '出力形式：',
      ko: '출력 형식: ',
    })
  )
}

export function designRenderStyleChoices(
  briefNotes: Record<string, string> | undefined
): PackagingDiscoveryChoice[] {
  const sector = resolveDesignSector(briefNotes)
  return renderStylesForSector(sector).map((key) =>
    toChoice(key, RENDER_STYLE_LABELS[key], {
      vi: 'Phong cách render: ',
      en: 'Render style: ',
      zh: '渲染风格：',
      ja: 'レンダースタイル：',
      ko: '렌더 스타일: ',
    })
  )
}

export function designLanguageChoices(): PackagingDiscoveryChoice[] {
  return LANGUAGE_CHOICES.map((c) => ({
    key: c.key,
    labels: c.labels,
    brief: c.brief,
  }))
}

/** Occasion / styling notes for design_notes brief step. */
export function designNotesChoices(): PackagingDiscoveryChoice[] {
  return [
    {
      key: 'office',
      labels: {
        vi: 'Công sở',
        en: 'Office / work',
        zh: '职场 / 通勤',
        ja: 'オフィス',
        ko: '오피스',
      },
      brief: {
        vi: 'Dịp công sở — lịch sự, tôn dáng, phối quần âu hoặc chân váy trung tính',
        en: 'Office occasion — polished silhouette, pair with tailored trousers or a neutral skirt',
        zh: '职场场合 — 得体显瘦，搭配西裤或中性半裙',
        ja: 'オフィス向け — きちんと見え、スラックスやニュートラルスカートと合わせる',
        ko: '오피스 용도 — 단정한 실루엣, 슬랙스나 뉴트럴 스커트와 매칭',
      },
    },
    {
      key: 'tet_holiday',
      labels: {
        vi: 'Dịp Tết / lễ',
        en: 'Tet / holiday',
        zh: '春节 / 节庆',
        ja: 'テト / 祝日',
        ko: '설날 / 명절',
      },
      brief: {
        vi: 'Dịp Tết — phối quần rộng lụa kem + túi da beige + giày cao gót',
        en: 'Tet holiday — wide cream silk trousers + beige leather bag + heels',
        zh: '春节场合 — 搭配米色阔腿丝裤 + 米色皮包 + 高跟鞋',
        ja: 'テト — クリームワイドシルクパンツ + ベージュバッグ + ヒール',
        ko: '설날 — 크림 와이드 실크 팬츠 + 베이지 가방 + 힐',
      },
    },
    {
      key: 'wedding_guest',
      labels: {
        vi: 'Đám cưới / tiệc',
        en: 'Wedding / party',
        zh: '婚礼 / 宴会',
        ja: '結婚式 / パーティー',
        ko: '웨딩 / 파티',
      },
      brief: {
        vi: 'Đám cưới / tiệc — sang trọng, nổi bật vừa đủ, phụ kiện ánh kim nhẹ',
        en: 'Wedding / party — elevated look, tasteful statement, light metallic accessories',
        zh: '婚礼/宴会 — 优雅得体、适度亮眼，轻金属配饰',
        ja: '結婚式/パーティー — 上品で程よく華やか、軽いメタルアクセサリー',
        ko: '웨딩/파티 — 우아하고 절제된 포인트, 라이트 메탈 액세서리',
      },
    },
    {
      key: 'casual_daily',
      labels: {
        vi: 'Thường ngày',
        en: 'Everyday casual',
        zh: '日常休闲',
        ja: 'デイリーカジュアル',
        ko: '데일리 캐주얼',
      },
      brief: {
        vi: 'Thường ngày — thoải mái, dễ phối jeans hoặc quần linen, giày bệt',
        en: 'Everyday casual — easy wear with jeans or linen trousers and flats',
        zh: '日常 — 舒适百搭，配牛仔裤或亚麻裤、平底鞋',
        ja: 'デイリー — ジーンズやリネンパンツ、フラット靴と合わせやすい',
        ko: '데일리 — 청바지·린넨 팬츠·플랫과 쉽게 매칭',
      },
    },
    {
      key: 'photoshoot',
      labels: {
        vi: 'Chụp ảnh / lookbook',
        en: 'Photoshoot / lookbook',
        zh: '拍摄 / lookbook',
        ja: '撮影 / ルックブック',
        ko: '촬영 / 룩북',
      },
      brief: {
        vi: 'Chụp ảnh lookbook — tạo dáng rõ silhouette, phụ kiện statement, nền sạch',
        en: 'Lookbook shoot — strong silhouette posing, statement accessories, clean backdrop',
        zh: 'Lookbook 拍摄 — 轮廓分明、配件有存在感、背景干净',
        ja: 'ルックブック撮影 — シルエット重視、ステートメント小物、清潔な背景',
        ko: '룩북 촬영 — 실루엣 강조, 포인트 액세서리, 깔끔한 배경',
      },
    },
    {
      key: 'silk_premium',
      labels: {
        vi: 'Chất liệu lụa cao cấp',
        en: 'Premium silk fabric',
        zh: '高级丝绸面料',
        ja: 'プレミアムシルク',
        ko: '프리미엄 실크',
      },
      brief: {
        vi: 'Ưu tiên chất liệu lụa / gấm mềm — rủ nhẹ, sang, ít nhăn khi mặc',
        en: 'Prefer soft silk / brocade — soft drape, elevated feel, low wrinkle when worn',
        zh: '优先真丝/软织锦 — 垂坠轻柔、高级感、穿着不易皱',
        ja: 'シルク/柔らかい錦を優先 — ドレープ感・高級感・シワになりにくい',
        ko: '실크·소프트 브로케이드 우선 — 드레이프감, 고급스러움, 착용 시 주름 적음',
      },
    },
    {
      key: 'skip_notes',
      labels: {
        vi: 'Không ghi chú thêm',
        en: 'No extra notes',
        zh: '无补充说明',
        ja: '追加メモなし',
        ko: '추가 메모 없음',
      },
      brief: {
        vi: 'Không có ghi chú thêm — để AI tự gợi ý phối đồ và cảm hứng từ ảnh mẫu',
        en: 'No extra notes — let AI suggest styling and inspiration from sample photos',
        zh: '无补充说明 — 由 AI 根据样品图建议搭配与灵感',
        ja: '追加メモなし — サンプル写真からAIがスタイリングとインスピレーションを提案',
        ko: '추가 메모 없음 — 샘플 사진 기반으로 AI가 스타일링·영감 제안',
      },
    },
  ]
}

/** Design-phase layout choices for concept / detail / technical steps (tap to generate). */
export function designConceptSheetChoices(): PackagingDiscoveryChoice[] {
  return [
    {
      key: 'full_board',
      labels: {
        vi: 'Bảng concept đầy đủ',
        en: 'Full concept board',
        zh: '完整概念板',
        ja: 'フルコンセプトボード',
        ko: '전체 컨셉 보드',
      },
      brief: {
        vi: 'Bảng concept đầy đủ: nhân vật trung tâm + 3 chi tiết cận + bản vẽ kỹ thuật + swatch chất liệu + phối đồ + bảng màu + đoạn text CẢM HỨNG (2–4 câu) + gắn logo đã duyệt',
        en: 'Full concept board: central character + 3 detail close-ups + technical flats + material swatch + styling + color palette + INSPIRATION text (2–4 sentences) + approved logo',
        zh: '完整概念板：中心人物 + 3细节特写 + 技术平稿 + 材质 + 搭配 + 色板 + 灵感文案（2–4句）+ 已批准 Logo',
        ja: 'フルコンセプト：中心人物 + 詳細3点 + 技術フラット + 素材 + スタイリング + 色板 + インスピレーション文 + 承認済みロゴ',
        ko: '전체 컨셉: 중심 인물 + 디테일 3 + 기술 플랫 + 소재 + 스타일링 + 색판 + 영감 문구 + 승인 로고',
      },
    },
    {
      key: 'hero_inspiration',
      labels: {
        vi: 'Nhân vật + chi tiết + cảm hứng',
        en: 'Hero + details + inspiration',
        zh: '人物 + 细节 + 灵感',
        ja: 'ヒーロー + 詳細 + インスピレーション',
        ko: '히어로 + 디테일 + 영감',
      },
      brief: {
        vi: 'Bảng concept nhấn nhân vật trung tâm + 3 chi tiết cận + đoạn text CẢM HỨNG (2–4 câu) + gắn logo đã duyệt',
        en: 'Concept board focused on hero + 3 detail close-ups + INSPIRATION text (2–4 sentences) + approved logo',
        zh: '概念板侧重人物 + 3细节 + 灵感文案（2–4句）+ 已批准 Logo',
        ja: 'ヒーロー中心 + 詳細3点 + インスピレーション文 + 承認済みロゴ',
        ko: '히어로 중심 + 디테일 3 + 영감 문구 + 승인 로고',
      },
    },
    {
      key: 'technical_material',
      labels: {
        vi: 'Kỹ thuật + chất liệu + màu',
        en: 'Technical + materials + colors',
        zh: '技术 + 材质 + 配色',
        ja: '技術 + 素材 + 配色',
        ko: '기술 + 소재 + 색상',
      },
      brief: {
        vi: 'Bảng concept nhấn bản vẽ kỹ thuật + swatch chất liệu + bảng màu + đoạn text CẢM HỨNG (2–4 câu) + gắn logo đã duyệt',
        en: 'Concept board focused on technical flats + material swatch + color palette + INSPIRATION text (2–4 sentences) + approved logo',
        zh: '概念板侧重技术平稿 + 材质色板 + 灵感文案（2–4句）+ 已批准 Logo',
        ja: '技術フラット + 素材スウォッチ + 配色 + インスピレーション文 + 承認済みロゴ',
        ko: '기술 플랫 + 소재 스와치 + 색판 + 영감 문구 + 승인 로고',
      },
    },
    {
      key: 'styling_board',
      labels: {
        vi: 'Phối đồ + màu + cảm hứng',
        en: 'Styling + colors + inspiration',
        zh: '搭配 + 配色 + 灵感',
        ja: 'スタイリング + 配色 + インスピレーション',
        ko: '스타일링 + 색상 + 영감',
      },
      brief: {
        vi: 'Bảng concept nhấn phối đồ gợi ý + bảng màu + đoạn text CẢM HỨNG (2–4 câu) + gắn logo đã duyệt',
        en: 'Concept board focused on styling coordination + color palette + INSPIRATION text (2–4 sentences) + approved logo',
        zh: '概念板侧重搭配建议 + 色板 + 灵感文案（2–4句）+ 已批准 Logo',
        ja: 'スタイリング提案 + 配色 + インスピレーション文 + 承認済みロゴ',
        ko: '스타일링 제안 + 색판 + 영감 문구 + 승인 로고',
      },
    },
  ]
}

export function designDetailPanelChoices(): PackagingDiscoveryChoice[] {
  return [
    {
      key: 'three_details',
      labels: {
        vi: '3 panel chi tiết cận',
        en: '3 detail close-up panels',
        zh: '3 个细节特写',
        ja: '詳細クローズアップ3枚',
        ko: '디테일 클로즈업 3패널',
      },
      brief: {
        vi: 'Panel 3 chi tiết cận: cổ/họa tiết/tay (hoặc chi tiết chính của sản phẩm) — layout vuông sạch + gắn logo đã duyệt nếu phù hợp',
        en: '3 detail close-up panels: collar/motif/sleeve (or key product details) — clean square layout + approved logo if suitable',
        zh: '3个细节特写：领口/纹样/袖口（或产品关键细节）— 简洁方形布局',
        ja: '詳細3パネル：襟/モチーフ/袖など — クリーンな正方形レイアウト',
        ko: '디테일 3패널: 칼라/모티프/소매 등 — 깔끔한 사각 레이아웃',
      },
    },
    {
      key: 'texture_focus',
      labels: {
        vi: 'Nhấn chất liệu / thêu',
        en: 'Texture / embroidery focus',
        zh: '材质/刺绣特写',
        ja: '素材・刺繍フォーカス',
        ko: '소재·자수 포커스',
      },
      brief: {
        vi: 'Panel chi tiết cận nhấn chất liệu vải và họa tiết thêu/đính — rõ texture + đoạn chú thích ngắn',
        en: 'Detail panels focused on fabric texture and embroidery/embellishment — clear texture + short captions',
        zh: '细节特写侧重面料纹理与刺绣 — 清晰质感 + 简短说明',
        ja: '生地テクスチャと刺繍を強調した詳細パネル',
        ko: '원단 텍스처와 자수 강조 디테일 패널',
      },
    },
  ]
}

export function designTechnicalFlatChoices(): PackagingDiscoveryChoice[] {
  return [
    {
      key: 'front_back_side',
      labels: {
        vi: 'Flat trước / sau / bên',
        en: 'Front / back / side flats',
        zh: '正 / 背 / 侧平稿',
        ja: '前・後・横フラット',
        ko: '앞·뒤·옆 플랫',
      },
      brief: {
        vi: 'Bản vẽ kỹ thuật phẳng: mặt trước, sau, bên — nét vẽ sạch trên nền trắng + chú thích ngắn cảm hứng thiết kế',
        en: 'Technical flat sketches: front, back, side — clean line art on white + short design-inspiration caption',
        zh: '技术平稿：正、背、侧 — 白底线稿 + 简短灵感说明',
        ja: '技術フラット：前・後・横 — 白地線画 + 短いインスピレーション文',
        ko: '기술 플랫: 앞·뒤·옆 — 흰 배경 라인 + 짧은 영감 문구',
      },
    },
    {
      key: 'construction_callouts',
      labels: {
        vi: 'Flat + ghi chú cấu trúc',
        en: 'Flats + construction notes',
        zh: '平稿 + 结构标注',
        ja: 'フラット + 構造メモ',
        ko: '플랫 + 구조 메모',
      },
      brief: {
        vi: 'Bản vẽ kỹ thuật với ghi chú cấu trúc (đường may, khóa, xếp ly…) — nền trắng sạch',
        en: 'Technical flats with construction callouts (seams, closures, pleats…) — clean white background',
        zh: '带结构标注的技术平稿（缝线、门襟、褶裥…）— 干净白底',
        ja: '構造注釈付き技術フラット（縫い目・開き・プリーツなど）',
        ko: '구조 콜아웃이 있는 기술 플랫 (시접·여밈·주름 등)',
      },
    },
  ]
}

export function getDesignRecreateDesignInputKind(
  stepKey: string | null | undefined
): DesignRecreateDesignInputKind {
  if (stepKey === 'concept_sheet') return 'concept_sheet_picker'
  if (stepKey === 'detail_panel') return 'detail_panel_picker'
  if (stepKey === 'technical_flat') return 'technical_flat_picker'
  return 'chat'
}

export function designRecreateDesignChoices(
  stepKey: string | null | undefined
): PackagingDiscoveryChoice[] {
  const kind = getDesignRecreateDesignInputKind(stepKey)
  if (kind === 'concept_sheet_picker') return designConceptSheetChoices()
  if (kind === 'detail_panel_picker') return designDetailPanelChoices()
  if (kind === 'technical_flat_picker') return designTechnicalFlatChoices()
  return []
}

export function findDesignRecreateDiscoveryChoice(
  stepKey: string,
  choiceKey: string,
  briefNotes?: Record<string, string>
): PackagingDiscoveryChoice | undefined {
  const key = choiceKey.trim()
  if (!key) return undefined
  if (stepKey === 'design_sector') {
    return designSectorChoices().find((c) => c.key === key)
  }
  if (stepKey === 'design_format') {
    return designFormatChoices(briefNotes).find((c) => c.key === key)
  }
  if (stepKey === 'render_style') {
    return designRenderStyleChoices(briefNotes).find((c) => c.key === key)
  }
  if (stepKey === 'design_notes') {
    return designNotesChoices().find((c) => c.key === key)
  }
  if (stepKey === DESIGN_LANGUAGE_STEP_KEY) {
    return designLanguageChoices().find((c) => c.key === key)
  }
  return undefined
}

export function resolveDesignBoardLanguageKey(
  briefNotes: Record<string, string> | undefined
): DesignBoardLanguageKey {
  const raw = briefNotes?.[DESIGN_LANGUAGE_STEP_KEY]?.trim().toLowerCase() ?? ''
  if (raw === 'vi' || raw === 'en' || raw === 'bilingual' || raw === 'other') return raw
  if (/song ngữ|bilingual|vi\s*\+\s*en|越.*英/i.test(raw)) return 'bilingual'
  if (/tiếng việt|vietnamese|越南/i.test(raw)) return 'vi'
  if (/tiếng anh|english|英语|英語/i.test(raw)) return 'en'
  if (raw) return 'other'
  return 'vi'
}

export function buildDesignBoardLanguagePromptBlock(
  briefNotes: Record<string, string> | undefined
): string {
  const key = resolveDesignBoardLanguageKey(briefNotes)
  const rules: Record<DesignBoardLanguageKey, string> = {
    vi: 'All labels, captions, titles, and inspiration text ON the design board must be in Vietnamese (unless the user quoted text in another language).',
    en: 'All labels, captions, titles, and inspiration text ON the design board must be in English (unless the user quoted text in another language).',
    bilingual:
      'Board text should be bilingual Vietnamese + English (e.g. Vietnamese primary with English subtitle, or paired labels).',
    other:
      'Follow the board language stated in the design_language brief note for all labels/captions/titles. User-quoted text stays verbatim.',
  }
  return `BOARD LANGUAGE (from discovery — key: ${key}):
${rules[key]}`
}

export function isDesignRecreateChoiceStep(stepKey: string | null | undefined): boolean {
  const kind = getDesignRecreateDiscoveryInputKind(stepKey)
  return (
    kind === 'sector_picker' ||
    kind === 'format_picker' ||
    kind === 'render_style_picker' ||
    kind === 'notes_picker' ||
    kind === 'language_picker'
  )
}

export function isDesignRecreateDesignChoiceStep(stepKey: string | null | undefined): boolean {
  return getDesignRecreateDesignInputKind(stepKey) !== 'chat'
}
