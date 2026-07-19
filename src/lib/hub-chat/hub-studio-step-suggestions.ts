import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'

export type StudioStepSuggestion = {
  label: Record<WebLocale, string>
  message: Record<WebLocale, string>
}

function suggestion(
  label: Record<WebLocale, string>,
  message: Record<WebLocale, string>
): StudioStepSuggestion {
  return { label, message }
}

const PACKAGING_KIT_SUGGESTIONS: Record<string, StudioStepSuggestion[]> = {
  brand_name: [
    suggestion(
      { vi: 'Glow Lab', en: 'Glow Lab', zh: 'Glow Lab', ja: 'Glow Lab', ko: 'Glow Lab' },
      {
        vi: 'Glow Lab — thương hiệu mỹ phẩm organic',
        en: 'Glow Lab — organic cosmetics brand',
        zh: 'Glow Lab — 有机护肤品牌',
        ja: 'Glow Lab — オーガニックコスメブランド',
        ko: 'Glow Lab — 오가닉 화장품 브랜드',
      }
    ),
    suggestion(
      { vi: 'Serum ABC', en: 'Serum ABC', zh: 'Serum ABC', ja: 'Serum ABC', ko: 'Serum ABC' },
      {
        vi: 'Serum Vitamin C — thương hiệu Thiên Nhiên',
        en: 'Vitamin C Serum — Thien Nhien brand',
        zh: '维生素C精华 — 天然品牌',
        ja: 'ビタミンCセラム — 天然ブランド',
        ko: '비타민 C 세럼 — 천연 브랜드',
      }
    ),
    suggestion(
      { vi: 'Quà tặng cao cấp', en: 'Premium gift', zh: '高端礼盒', ja: '高級ギフト', ko: '프리미엄 선물' },
      {
        vi: 'Hộp quà tặng cao cấp Maison Éclat',
        en: 'Maison Éclat premium gift box',
        zh: 'Maison Éclat 高端礼盒',
        ja: 'Maison Éclat 高級ギフトボックス',
        ko: 'Maison Éclat 프리미엄 선물 상자',
      }
    ),
  ],
  product_type: [
    suggestion(
      { vi: 'Serum / dưỡng da', en: 'Serum / skincare', zh: '精华 / 护肤', ja: 'セラム / スキンケア', ko: '세럼 / 스킨케어' },
      {
        vi: 'Serum dưỡng da mặt, chai thủy tinh 30ml',
        en: 'Facial serum, 30ml glass bottle',
        zh: '面部精华，30ml 玻璃瓶',
        ja: 'フェイシャルセラム、30ml ガラス瓶',
        ko: '페이셜 세럼, 30ml 유리병',
      }
    ),
    suggestion(
      { vi: 'Mỹ phẩm organic', en: 'Organic cosmetics', zh: '有机化妆品', ja: 'オーガニックコスメ', ko: '오가닉 화장품' },
      {
        vi: 'Bộ mỹ phẩm organic: kem dưỡng + toner',
        en: 'Organic set: moisturizer + toner',
        zh: '有机套装：面霜 + 爽肤水',
        ja: 'オーガニックセット：クリーム + トナー',
        ko: '오가닉 세트: 크림 + 토너',
      }
    ),
    suggestion(
      { vi: 'Trà / thực phẩm', en: 'Tea / food', zh: '茶 / 食品', ja: '茶 / 食品', ko: '차 / 식품' },
      {
        vi: 'Hộp trà thảo mộc cao cấp, 20 gói',
        en: 'Premium herbal tea box, 20 sachets',
        zh: '高端草本茶盒，20 包',
        ja: '高級ハーブティー箱、20袋',
        ko: '프리미엄 허브티 상자, 20티백',
      }
    ),
  ],
  box_size: [
    suggestion(
      { vi: '50×30×10 cm', en: '50×30×10 cm', zh: '50×30×10 cm', ja: '50×30×10 cm', ko: '50×30×10 cm' },
      {
        vi: '50×30×10 cm',
        en: '50×30×10 cm',
        zh: '50×30×10 cm',
        ja: '50×30×10 cm',
        ko: '50×30×10 cm',
      }
    ),
    suggestion(
      { vi: '50×30×3 cm', en: '50×30×3 cm', zh: '50×30×3 cm', ja: '50×30×3 cm', ko: '50×30×3 cm' },
      {
        vi: '50×30×3 cm — hộp mỏng',
        en: '50×30×3 cm — thin box',
        zh: '50×30×3 cm — 扁盒',
        ja: '50×30×3 cm — 薄型箱',
        ko: '50×30×3 cm — 얇은 상자',
      }
    ),
    suggestion(
      { vi: '20×15×8 cm', en: '20×15×8 cm', zh: '20×15×8 cm', ja: '20×15×8 cm', ko: '20×15×8 cm' },
      {
        vi: '20×15×8 cm — hộp nhỏ',
        en: '20×15×8 cm — small box',
        zh: '20×15×8 cm — 小盒',
        ja: '20×15×8 cm — 小箱',
        ko: '20×15×8 cm — 소형 상자',
      }
    ),
    suggestion(
      { vi: '30×30×30 cm', en: '30×30×30 cm', zh: '30×30×30 cm', ja: '30×30×30 cm', ko: '30×30×30 cm' },
      {
        vi: '30×30×30 cm — hộp vuông',
        en: '30×30×30 cm — cube box',
        zh: '30×30×30 cm — 正方盒',
        ja: '30×30×30 cm — 立方体箱',
        ko: '30×30×30 cm — 정육면체 상자',
      }
    ),
  ],
  box_face_confirm: [
    suggestion(
      { vi: 'OK / xác nhận', en: 'OK / confirm', zh: 'OK / 确认', ja: 'OK / 確認', ko: 'OK / 확인' },
      {
        vi: 'OK, kích thước đúng',
        en: 'OK, dimensions look correct',
        zh: 'OK，尺寸正确',
        ja: 'OK、サイズ問題なし',
        ko: 'OK, 크기 맞음',
      }
    ),
    suggestion(
      { vi: 'Sửa kích thước', en: 'Adjust size', zh: '修改尺寸', ja: 'サイズ修正', ko: '크기 수정' },
      {
        vi: '50×30×10 cm',
        en: '50×30×10 cm',
        zh: '50×30×10 cm',
        ja: '50×30×10 cm',
        ko: '50×30×10 cm',
      }
    ),
  ],
  style_mood: [
    suggestion(
      { vi: 'Organic', en: 'Organic', zh: 'Organic', ja: 'Organic', ko: 'Organic' },
      {
        vi: 'Phong cách organic, tự nhiên, mềm mại',
        en: 'Organic, natural, soft style',
        zh: '有机自然、柔和风格',
        ja: 'オーガニックで自然な柔らかいスタイル',
        ko: '오가닉하고 자연스러운 부드러운 스타일',
      }
    ),
    suggestion(
      { vi: 'Luxury', en: 'Luxury', zh: 'Luxury', ja: 'Luxury', ko: 'Luxury' },
      {
        vi: 'Phong cách luxury, sang trọng, cao cấp',
        en: 'Luxury, premium, high-end style',
        zh: '奢华高端风格',
        ja: '高級感のあるラグジュアリースタイル',
        ko: '고급스러운 럭셔리 스타일',
      }
    ),
    suggestion(
      { vi: 'Minimal', en: 'Minimal', zh: 'Minimal', ja: 'Minimal', ko: 'Minimal' },
      {
        vi: 'Phong cách minimal, tối giản, sạch',
        en: 'Minimal, clean, simple style',
        zh: '极简干净风格',
        ja: 'ミニマルでクリーンなスタイル',
        ko: '미니멀하고 깔끔한 스타일',
      }
    ),
  ],
  color_palette: [
    suggestion(
      { vi: 'Hồng + trắng', en: 'Pink + white', zh: '粉 + 白', ja: 'ピンク + 白', ko: '핑크 + 화이트' },
      {
        vi: 'Hồng pastel và trắng',
        en: 'Pastel pink and white',
        zh: '粉 pastel 与白色',
        ja: 'パステルピンクと白',
        ko: '파스텔 핑크와 화이트',
      }
    ),
    suggestion(
      { vi: 'Đen + gold', en: 'Black + gold', zh: '黑 + 金', ja: '黒 + ゴールド', ko: '블랙 + 골드' },
      {
        vi: 'Đen và vàng gold',
        en: 'Black and gold',
        zh: '黑色与金色',
        ja: '黒とゴールド',
        ko: '블랙과 골드',
      }
    ),
    suggestion(
      { vi: 'Tông đất', en: 'Earth tones', zh: '大地色', ja: 'アースカラー', ko: '어스 톤' },
      {
        vi: 'Tông màu đất, carton, nâu be',
        en: 'Earth tones, kraft, beige brown',
        zh: '大地色、牛皮纸、米棕',
        ja: 'アースカラー、クラフト、ベージュブラウン',
        ko: '어스 톤, 크래프트, 베이지 브라운',
      }
    ),
  ],
  face_print_style: [
    suggestion(
      { vi: 'Ảnh thật', en: 'Realistic photo', zh: '真实摄影', ja: '実写', ko: '실사' },
      {
        vi: 'Phong cách ảnh chụp thật, commercial',
        en: 'Realistic photography, commercial look',
        zh: '真实摄影、商业感',
        ja: 'リアル写真、商用トーン',
        ko: '실사 촬영, 상업적 톤',
      }
    ),
    suggestion(
      { vi: 'Line art', en: 'Line art', zh: '线稿', ja: '線画', ko: '라인 아트' },
      {
        vi: 'Line art tối giản, nét mảnh',
        en: 'Minimal line art, thin strokes',
        zh: '极简线稿、细线条',
        ja: 'ミニマルな線画、細線',
        ko: '미니멀 라인 아트, 가는 선',
      }
    ),
  ],
  logo: [
    suggestion(
      { vi: 'Logo chữ + icon', en: 'Wordmark + icon', zh: '字标 + 图标', ja: '文字 + アイコン', ko: '워드마크 + 아이콘' },
      {
        vi: 'Logo chữ serif sang trọng kèm icon lá nhỏ, màu theo brief',
        en: 'Elegant serif wordmark with small leaf icon, colors from brief',
        zh: '优雅衬线字标配小叶图标，按简报配色',
        ja: 'ブリーフに沿った配色のセリフロゴ + 小さな葉アイコン',
        ko: '브리프 색상의 세리프 워드마크 + 작은 잎 아이콘',
      }
    ),
    suggestion(
      { vi: 'Logo tối giản', en: 'Minimal logo', zh: '极简 logo', ja: 'ミニマルロゴ', ko: '미니멀 로고' },
      {
        vi: 'Logo tối giản, chữ sans-serif, một màu chủ đạo',
        en: 'Minimal sans-serif logo, single primary color',
        zh: '极简 sans-serif logo，单一主色',
        ja: 'ミニマルなサンセリフロゴ、単色',
        ko: '미니멀 산세리프 로고, 단색',
      }
    ),
  ],
  face_top: [
    suggestion(
      { vi: 'Logo + tên SP', en: 'Logo + product name', zh: 'Logo + 品名', ja: 'ロゴ + 商品名', ko: '로고 + 제품명' },
      {
        vi: 'Mặt trên: logo căn giữa, tên sản phẩm bên dưới, nền đơn sắc',
        en: 'Top face: centered logo, product name below, solid background',
        zh: '顶面：居中 logo，下方品名，纯色底',
        ja: '天面：中央ロゴ、下に商品名、単色背景',
        ko: '윗면: 중앙 로고, 아래 제품명, 단색 배경',
      }
    ),
    suggestion(
      { vi: 'Bỏ trống', en: 'Leave blank', zh: '留空', ja: '空白', ko: '비우기' },
      {
        vi: 'Bỏ trống mặt trên',
        en: 'Leave top face blank',
        zh: '顶面留空',
        ja: '天面は空白',
        ko: '윗면 비우기',
      }
    ),
  ],
  face_front: [
    suggestion(
      { vi: 'Nhãn sản phẩm', en: 'Product label', zh: '产品标签', ja: '製品ラベル', ko: '제품 라벨' },
      {
        vi: 'Tên sản phẩm lớn, dung tích 30ml, thành phần chính, logo thương hiệu',
        en: 'Large product name, 30ml volume, key ingredients, brand logo',
        zh: '大号品名、30ml 容量、主要成分、品牌 logo',
        ja: '大きな商品名、30ml、主要成分、ブランドロゴ',
        ko: '큰 제품명, 30ml, 주요 성분, 브랜드 로고',
      }
    ),
    suggestion(
      { vi: 'Pattern / họa tiết', en: 'Pattern', zh: '图案', ja: 'パターン', ko: '패턴' },
      {
        vi: 'Họa tiết lá organic lặp lại, logo ở giữa',
        en: 'Repeating organic leaf pattern, centered logo',
        zh: '重复有机叶纹，居中 logo',
        ja: 'オーガニック葉の反復パターン、中央ロゴ',
        ko: '반복 오가닉 잎 패턴, 중앙 로고',
      }
    ),
  ],
  face_right: [
    suggestion(
      { vi: 'Thành phần', en: 'Ingredients', zh: '成分', ja: '成分', ko: '성분' },
      {
        vi: 'Danh sách thành phần INCI, barcode placeholder, text nhỏ',
        en: 'INCI ingredient list, barcode placeholder, small text',
        zh: 'INCI 成分表、条码占位、小字',
        ja: 'INCI成分表、バーコード枠、小さな文字',
        ko: 'INCI 성분 목록, 바코드 자리, 작은 글씨',
      }
    ),
    suggestion(
      { vi: 'Giống mặt trước', en: 'Same as front', zh: '同正面', ja: '正面と同じ', ko: '앞면과 동일' },
      {
        vi: 'Giống mặt trước',
        en: 'Same as front face',
        zh: '与正面相同',
        ja: '正面と同じ',
        ko: '앞면과 동일',
      }
    ),
  ],
  face_bottom: [
    suggestion(
      { vi: 'Giống mặt trên', en: 'Same as top', zh: '同顶面', ja: '天面と同じ', ko: '윗면과 동일' },
      {
        vi: 'Giống mặt trên',
        en: 'Same as top face',
        zh: '与顶面相同',
        ja: '天面と同じ',
        ko: '윗면과 동일',
      }
    ),
    suggestion(
      { vi: 'Mã vạch / QR', en: 'Barcode / QR', zh: '条码 / QR', ja: 'バーコード / QR', ko: '바코드 / QR' },
      {
        vi: 'Mã vạch + QR website thương hiệu',
        en: 'Barcode + brand website QR',
        zh: '条码 + 品牌网站 QR',
        ja: 'バーコード + ブランドサイトQR',
        ko: '바코드 + 브랜드 웹사이트 QR',
      }
    ),
  ],
  face_back: [
    suggestion(
      { vi: 'HDSD + cảnh báo', en: 'Usage + warnings', zh: '用法 + 警示', ja: '使用方法 + 注意', ko: '사용법 + 주의' },
      {
        vi: 'Hướng dẫn sử dụng, cảnh báo, địa chỉ nhà sản xuất',
        en: 'Usage instructions, warnings, manufacturer address',
        zh: '使用说明、警示、制造商地址',
        ja: '使用方法、注意事項、製造元住所',
        ko: '사용법, 주의사항, 제조사 주소',
      }
    ),
    suggestion(
      { vi: 'Giống mặt trước', en: 'Same as front', zh: '同正面', ja: '正面と同じ', ko: '앞면과 동일' },
      {
        vi: 'Giống mặt trước',
        en: 'Same as front face',
        zh: '与正面相同',
        ja: '正面と同じ',
        ko: '앞면과 동일',
      }
    ),
  ],
  face_left: [
    suggestion(
      { vi: 'Slogan / claim', en: 'Slogan / claim', zh: '标语', ja: 'スローガン', ko: '슬로건' },
      {
        vi: 'Slogan thương hiệu dọc, icon chứng nhận organic',
        en: 'Vertical brand slogan, organic certification icons',
        zh: '竖排品牌标语、有机认证图标',
        ja: '縦書きスローガン、オーガニック認証アイコン',
        ko: '세로 브랜드 슬로건, 오가닉 인증 아이콘',
      }
    ),
    suggestion(
      { vi: 'Bỏ trống', en: 'Leave blank', zh: '留空', ja: '空白', ko: '비우기' },
      {
        vi: 'Bỏ trống mặt trái',
        en: 'Leave left face blank',
        zh: '左面留空',
        ja: '左面は空白',
        ko: '왼쪽 면 비우기',
      }
    ),
  ],
  product_label: [
    suggestion(
      { vi: 'Nhãn mặt sau', en: 'Back label', zh: '背面标签', ja: '裏ラベル', ko: '뒷면 라벨' },
      {
        vi: 'Tên SP, thành phần, dung tích 30ml, HDSD ngắn, cảnh báo dị ứng',
        en: 'Product name, ingredients, 30ml volume, short usage, allergy warning',
        zh: '品名、成分、30ml、简短用法、过敏警告',
        ja: '商品名、成分、30ml、短い使用方法、アレルギー注意',
        ko: '제품명, 성분, 30ml, 짧은 사용법, 알레르기 주의',
      }
    ),
  ],
  seal_sticker: [
    suggestion(
      { vi: 'Tem tròn', en: 'Round seal', zh: '圆形封条', ja: '円形シール', ko: '원형 봉인' },
      {
        vi: 'Tem niêm phong tròn, logo monogram, viền vàng gold, slogan "Niêm phong"',
        en: 'Round tamper seal, monogram logo, gold border, tagline "Sealed"',
        zh: '圆形封条，字母 logo，金边，标语「密封」',
        ja: '円形封緘シール、モノグラム、ゴールド縁、「封印」',
        ko: '원형 봉인 스티커, 모노그램, 골드 테두리, "봉인" 슬로건',
      }
    ),
  ],
  barcode_label: [
    suggestion(
      { vi: 'EAN-13', en: 'EAN-13', zh: 'EAN-13', ja: 'EAN-13', ko: 'EAN-13' },
      {
        vi: 'Nhãn mã vạch EAN-13, mã 893xxxxxxxxx, tên SP ngắn',
        en: 'EAN-13 barcode label, code 893xxxxxxxxx, short product name',
        zh: 'EAN-13 条码标签，码 893xxxxxxxxx，短品名',
        ja: 'EAN-13バーコードラベル、コード893xxxxxxxxx',
        ko: 'EAN-13 바코드 라벨, 코드 893xxxxxxxxx',
      }
    ),
  ],
}

const COMMON_DISCOVERY_SUGGESTIONS: Record<string, StudioStepSuggestion[]> = {
  brand_name: PACKAGING_KIT_SUGGESTIONS.brand_name!,
  style_mood: PACKAGING_KIT_SUGGESTIONS.style_mood!,
  color_palette: PACKAGING_KIT_SUGGESTIONS.color_palette!,
  target_audience: [
    suggestion(
      { vi: 'Nữ 25–35', en: 'Women 25–35', zh: '女性 25–35', ja: '女性25–35歳', ko: '여성 25–35' },
      {
        vi: 'Nữ 25–35 tuổi, quan tâm skincare organic, thu nhập trung bình khá',
        en: 'Women 25–35, interested in organic skincare, upper-middle income',
        zh: '25–35 岁女性，关注有机护肤，中高收入',
        ja: '25–35歳女性、オーガニックスキンケア志向',
        ko: '25–35세 여성, 오가닉 스킨케어 관심',
      }
    ),
  ],
}

const PRESET_STEP_SUGGESTIONS: Record<string, Record<string, StudioStepSuggestion[]>> = {
  packaging_kit: PACKAGING_KIT_SUGGESTIONS,
  mobile_shop: COMMON_DISCOVERY_SUGGESTIONS,
  brand_kit: COMMON_DISCOVERY_SUGGESTIONS,
  landing_page: COMMON_DISCOVERY_SUGGESTIONS,
  sale_banner: {
    campaign_name: [
      suggestion(
        { vi: 'Khai trương', en: 'Grand opening', zh: '开业', ja: 'オープン', ko: '오픈' },
        {
          vi: 'Chiến dịch khai trương cửa hàng online',
          en: 'Online store grand opening campaign',
          zh: '网店开业活动',
          ja: 'オンラインストアオープンキャンペーン',
          ko: '온라인 스토어 오픈 캠페인',
        }
      ),
    ],
    discount_cta: [
      suggestion(
        { vi: 'Giảm 50%', en: '50% off', zh: '5折', ja: '50%OFF', ko: '50% 할인' },
        {
          vi: 'Giảm 50% — Mua ngay',
          en: '50% off — Shop now',
          zh: '5 折 — 立即购买',
          ja: '50%OFF — 今すぐ購入',
          ko: '50% 할인 — 지금 구매',
        }
      ),
    ],
  },
}

export type StudioStepSuggestionItem = {
  label: string
  message: string
}

export function getStudioStepSuggestions(
  presetId: string | null | undefined,
  stepKey: string | null | undefined,
  locale: WebLocale
): StudioStepSuggestionItem[] {
  if (!presetId || !stepKey) return []
  const presetMap = PRESET_STEP_SUGGESTIONS[presetId]
  const list = presetMap?.[stepKey] ?? COMMON_DISCOVERY_SUGGESTIONS[stepKey] ?? []
  return list.map((item) => ({
    label: formatStudioExampleLabel(locale, item.label[locale] ?? item.label.en),
    message: item.message[locale] ?? item.message.en,
  }))
}

export function getStudioStepInputPlaceholder(
  presetId: string | null | undefined,
  stepKey: string | null | undefined,
  locale: WebLocale,
  fallback: string
): string {
  const suggestions = getStudioStepSuggestions(presetId, stepKey, locale)
  if (suggestions[0]?.message) {
    return formatStudioExampleLabel(locale, suggestions[0].message)
  }
  return fallback
}
