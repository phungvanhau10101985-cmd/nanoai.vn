import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import { getStepAskExample, getStepAskPrompt } from '@/lib/hub-chat/hub-studio-presets'

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
  domain_name: [
    suggestion(
      { vi: 'vananh.fashion', en: 'vananh.fashion', zh: 'vananh.fashion', ja: 'vananh.fashion', ko: 'vananh.fashion' },
      {
        vi: 'vananh.fashion',
        en: 'vananh.fashion',
        zh: 'vananh.fashion',
        ja: 'vananh.fashion',
        ko: 'vananh.fashion',
      }
    ),
  ],
  industry_product: [
    suggestion(
      { vi: 'Thời trang nữ', en: 'Women fashion', zh: '女装', ja: 'レディース', ko: '여성 패션' },
      {
        vi: 'Thời trang nữ — váy, áo dài, phụ kiện',
        en: 'Women fashion — dresses, tops, accessories',
        zh: '女装 — 连衣裙、上衣、配饰',
        ja: 'レディースファッション — ワンピース、トップス、アクセ',
        ko: '여성 패션 — 원피스, 상의, 액세서리',
      }
    ),
  ],
  style_mood: PACKAGING_KIT_SUGGESTIONS.style_mood!,
  color_palette: PACKAGING_KIT_SUGGESTIONS.color_palette!,
  color_tone: [
    suggestion(
      { vi: 'Nâu gỗ + kem', en: 'Wood + cream', zh: '木棕 + 米白', ja: 'ウッド + クリーム', ko: '우드 + 크림' },
      {
        vi: 'Nâu gỗ + kem ấm, chữ đen',
        en: 'Warm wood brown + cream, black text',
        zh: '暖木棕 + 米白，黑字',
        ja: '暖かいウッドブラウン + クリーム、黒文字',
        ko: '따뜻한 우드 브라운 + 크림, 검은 글자',
      }
    ),
    suggestion(
      { vi: 'Đỏ + vàng', en: 'Red + gold', zh: '红 + 金', ja: '赤 + 金', ko: '빨강 + 금' },
      {
        vi: 'Đỏ đô + vàng gold trên nền tối',
        en: 'Burgundy + gold on dark background',
        zh: '酒红 + 金色，深色背景',
        ja: 'ワインレッド + ゴールド、ダーク背景',
        ko: '버건디 + 골드, 어두운 배경',
      }
    ),
  ],
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

const BAG_KIT_SUGGESTIONS: Record<string, StudioStepSuggestion[]> = {
  brand_name: COMMON_DISCOVERY_SUGGESTIONS.brand_name!,
  product_type: [
    suggestion(
      { vi: 'Túi giấy mua sắm', en: 'Paper shopping bag', zh: '纸购物袋', ja: '紙ショッパー', ko: '종이 쇼핑백' },
      {
        vi: 'Túi giấy mua sắm — cửa hàng thời trang / mỹ phẩm',
        en: 'Paper shopping bag — fashion or cosmetics retail',
        zh: '纸购物袋 — 时装/美妆零售',
        ja: '紙ショッパー — ファッション/コスメ小売',
        ko: '종이 쇼핑백 — 패션/뷰티 리테일',
      }
    ),
    suggestion(
      { vi: 'Túi quà tặng', en: 'Gift bag', zh: '礼品袋', ja: 'ギフトバッグ', ko: '선물 가방' },
      {
        vi: 'Túi quà tặng — sự kiện, lễ hội, quà doanh nghiệp',
        en: 'Gift bag — events, festivals, corporate gifts',
        zh: '礼品袋 — 活动、节日、企业礼品',
        ja: 'ギフトバッグ — イベント、記念品',
        ko: '선물 가방 — 이벤트, 기념품',
      }
    ),
  ],
  bag_size: [
    suggestion(
      { vi: '200×280×60 mm', en: '200×280×60 mm', zh: '200×280×60 mm', ja: '200×280×60 mm', ko: '200×280×60 mm' },
      {
        vi: '200 × 280 × 60 mm',
        en: '200 × 280 × 60 mm',
        zh: '200 × 280 × 60 mm',
        ja: '200 × 280 × 60 mm',
        ko: '200 × 280 × 60 mm',
      }
    ),
    suggestion(
      { vi: '24×32×8 cm', en: '24×32×8 cm', zh: '24×32×8 cm', ja: '24×32×8 cm', ko: '24×32×8 cm' },
      {
        vi: '24 × 32 × 8 cm',
        en: '24 × 32 × 8 cm',
        zh: '24 × 32 × 8 cm',
        ja: '24 × 32 × 8 cm',
        ko: '24 × 32 × 8 cm',
      }
    ),
  ],
  bag_panel_confirm: [
    suggestion(
      { vi: 'OK', en: 'OK', zh: 'OK', ja: 'OK', ko: 'OK' },
      { vi: 'OK', en: 'OK', zh: 'OK', ja: 'OK', ko: 'OK' }
    ),
  ],
  style_mood: COMMON_DISCOVERY_SUGGESTIONS.style_mood!,
  color_palette: COMMON_DISCOVERY_SUGGESTIONS.color_palette!,
  color_tone: COMMON_DISCOVERY_SUGGESTIONS.color_tone!,
  face_print_style: PACKAGING_KIT_SUGGESTIONS.face_print_style!,
  face_back: [
    suggestion(
      { vi: 'Logo + slogan', en: 'Logo + slogan', zh: 'Logo + 标语', ja: 'ロゴ + スローガン', ko: '로고 + 슬로건' },
      {
        vi: 'Logo thương hiệu giữa mặt sau, slogan ngắn phía dưới, nền kraft nhẹ',
        en: 'Brand logo centered on back, short slogan below, light kraft background',
        zh: '背面居中品牌 logo，下方短标语，浅牛皮纸底',
        ja: '背面中央にロゴ、下に短いスローガン、クラフト調背景',
        ko: '뒷면 중앙 로고, 아래 짧은 슬로건, 크라프트 톤 배경',
      }
    ),
    suggestion(
      { vi: 'Bỏ trống', en: 'Leave blank', zh: '留空', ja: '空白', ko: '비우기' },
      {
        vi: 'Bỏ trống mặt sau',
        en: 'Leave back face blank',
        zh: '背面留空',
        ja: '背面は空白',
        ko: '뒷면 비우기',
      }
    ),
  ],
  face_front: [
    suggestion(
      { vi: 'Logo nổi bật', en: 'Bold logo', zh: '醒目 logo', ja: '目立つロゴ', ko: '강조 로고' },
      {
        vi: 'Logo lớn giữa mặt trước, tên thương hiệu, màu chủ đạo từ palette',
        en: 'Large centered logo on front, brand name, colors from palette',
        zh: '正面大 logo 居中，品牌名，主色来自 palette',
        ja: '正面中央に大きなロゴ、ブランド名、パレット色',
        ko: '앞면 중앙 큰 로고, 브랜드명, 팔레트 색상',
      }
    ),
    suggestion(
      { vi: 'Giống mặt sau', en: 'Same as back', zh: '同背面', ja: '背面と同じ', ko: '뒷면과 동일' },
      {
        vi: 'Giống mặt sau',
        en: 'Same as back face',
        zh: '与背面相同',
        ja: '背面と同じ',
        ko: '뒷면과 동일',
      }
    ),
  ],
  bag_mockup_3d: [
    suggestion(
      { vi: 'Túi đứng', en: 'Standing bag', zh: '立式袋', ja: '立てた袋', ko: '세운 가방' },
      {
        vi: 'Túi giấy đứng trên nền studio trắng, bóng đổ nhẹ',
        en: 'Paper bag standing on white studio background, soft shadow',
        zh: '纸袋立在白色棚拍背景，轻阴影',
        ja: '白背景スタジオで立てた紙袋、ソフトシャドウ',
        ko: '흰 스튜디오 배경에 선 종이 가방, 부드러운 그림자',
      }
    ),
  ],
  bag_dieline_pdf: [
    suggestion(
      { vi: 'Xuất net in', en: 'Export print net', zh: '导出印刷展开图', ja: '展開図出力', ko: '전개도 출력' },
      {
        vi: 'Xuất file net in PDF — mặt trước/sau đã duyệt ghép lên panel',
        en: 'Export print-ready net PDF — approved front/back composited on panels',
        zh: '导出印刷用展开图 PDF — 已批准正背面合成到面板',
        ja: '印刷用展開図PDF — 承認済み正背面をパネルに合成',
        ko: '인쇄용 전개도 PDF — 승인된 앞/뒷면 패널 합성',
      }
    ),
  ],
}

const PRESET_STEP_SUGGESTIONS: Record<string, Record<string, StudioStepSuggestion[]>> = {
  packaging_kit: PACKAGING_KIT_SUGGESTIONS,
  bag_kit: BAG_KIT_SUGGESTIONS,
  mobile_shop: COMMON_DISCOVERY_SUGGESTIONS,
  brand_kit: COMMON_DISCOVERY_SUGGESTIONS,
  landing_page: {
    product_name: [
      suggestion(
        { vi: 'Thời trang', en: 'Fashion', zh: '时尚', ja: 'ファッション', ko: '패션' },
        {
          vi: 'Maison Élise — shop thời trang nữ + dịch vụ may đo & styling',
          en: 'Maison Élise — women\'s fashion shop + tailoring & styling',
          zh: 'Maison Élise — 女装店 + 定制与造型服务',
          ja: 'Maison Élise — レディースファッション + オーダー＆スタイリング',
          ko: 'Maison Élise — 여성 패션 샵 + 맞춤 & 스타일링',
        }
      ),
      suggestion(
        { vi: 'Mỹ phẩm & spa', en: 'Beauty & spa', zh: '美妆 & spa', ja: '美容 & spa', ko: '뷰티 & spa' },
        {
          vi: 'Glow Lab — mỹ phẩm organic + dịch vụ spa & tư vấn da',
          en: 'Glow Lab — organic cosmetics + spa & skincare consulting',
          zh: 'Glow Lab — 有机护肤 + spa 与皮肤咨询',
          ja: 'Glow Lab — オーガニックコスメ + spa＆スキンケア相談',
          ko: 'Glow Lab — 오가닉 화장품 + spa & 스킨케어 상담',
        }
      ),
      suggestion(
        { vi: 'F&B / nhà hàng', en: 'F&B / restaurant', zh: '餐饮', ja: '飲食', ko: 'F&B / 레스토랑' },
        {
          vi: 'Saigon Brew — cà phê specialty + giao đồ uống & đặt bàn online',
          en: 'Saigon Brew — specialty coffee + delivery & online table booking',
          zh: 'Saigon Brew — 精品咖啡 + 外送与在线订位',
          ja: 'Saigon Brew — スペシャルティコーヒー + デリバリー＆予約',
          ko: 'Saigon Brew — 스페셜티 커피 + 배달 & 온라인 예약',
        }
      ),
    ],
    value_prop: [
      suggestion(
        { vi: 'Mua sắm trọn gói', en: 'Complete shopping', zh: '一站式购物', ja: 'ワンストップ', ko: '원스톱 쇼핑' },
        {
          vi: 'Sản phẩm chất lượng, dịch vụ tận tâm, giao nhanh — trải nghiệm mua sắm trọn gói',
          en: 'Quality products, caring services, fast delivery — a complete shopping experience',
          zh: '优质产品、贴心服务、快速配送 — 一站式购物体验',
          ja: '良質な商品、丁寧なサービス、速配送 — ワンストップ体験',
          ko: '양질의 상품, 세심한 서비스, 빠른 배송 — 원스톱 쇼핑',
        }
      ),
      suggestion(
        { vi: 'Dịch vụ kèm theo', en: 'Bundled services', zh: '配套服务', ja: '付帯サービス', ko: '부가 서비스' },
        {
          vi: 'Mua online + tư vấn miễn phí + đặt lịch dịch vụ — một điểm đến cho mọi nhu cầu',
          en: 'Shop online + free consultation + service booking — one stop for every need',
          zh: '线上购物 + 免费咨询 + 服务预约 — 需求一站满足',
          ja: 'オンライン購入 + 無料相談 + サービス予約 — ニーズをワンストップ',
          ko: '온라인 쇼핑 + 무료 상담 + 서비스 예약 — 모든 니즈 원스톱',
        }
      ),
    ],
    target_audience: COMMON_DISCOVERY_SUGGESTIONS.target_audience!,
    style_mood: [
      suggestion(
        { vi: 'Hiện đại, sạch', en: 'Modern & clean', zh: '现代简洁', ja: 'モダン＆クリーン', ko: '모던 & 클린' },
        {
          vi: 'Hiện đại, sạch — ảnh sản phẩm lớn, typography rõ, CTA nổi bật',
          en: 'Modern & clean — large product photos, clear typography, prominent CTAs',
          zh: '现代简洁 — 大图产品、清晰字体、突出 CTA',
          ja: 'モダンでクリーン — 大きな商品写真、読みやすいタイポ、目立つCTA',
          ko: '모던 & 클린 — 큰 상품 사진, 명확한 타이포, 눈에 띄는 CTA',
        }
      ),
      suggestion(
        { vi: 'Cao cấp / ấm áp', en: 'Premium / warm', zh: '高端 / 温馨', ja: '高級 / 温かみ', ko: '프리미엄 / 따뜻' },
        {
          vi: 'Cao cấp — ảnh full-bleed, typography tinh tế, nền kem/be hoặc tối sang trọng',
          en: 'Premium — full-bleed imagery, refined typography, cream/beige or dark luxury bg',
          zh: '高端 — 全出血大图、精致字体、米/深色奢华背景',
          ja: '高級 — フルブリード、洗練タイポ、クリーム/ダークラグジュアリー',
          ko: '프리미엄 — 풀블리드, 세련된 타이포, 크림/다크 럭셔리 배경',
        }
      ),
    ],
    color_palette: PACKAGING_KIT_SUGGESTIONS.color_palette!,
    landing_full: [
      suggestion(
        { vi: 'Landing đầy đủ 1:4', en: 'Full landing 1:4', zh: '完整落地页 1:4', ja: 'フルLP 1:4', ko: '전체 랜딩 1:4' },
        {
          vi: 'Hero: «Mua sắm & trải nghiệm dịch vụ» · 3 cột ưu điểm · Gói Pro nổi bật · 2 review · FAQ 4 câu · CTA «Mua ngay» — logo header, ảnh dọc 1:4',
          en: 'Hero: «Shop products & book services» · 3-column benefits · Pro tier highlighted · 2 reviews · 4 FAQ · CTA «Shop now» — logo in header, tall 1:4 image',
          zh: '主视觉：「选购产品 & 预约服务」· 三列优势 · Pro 高亮 · 2 评价 · FAQ 4 项 · CTA「立即购买」— 页眉 logo，1:4 纵向图',
          ja: 'ヒーロー：「商品購入＆サービス予約」· 3カラム · Pro強調 · レビュー2 · FAQ4 · CTA「今すぐ購入」— ヘッダーロゴ、1:4縦',
          ko: '히어로: «상품 구매 & 서비스 예약» · 3열 혜택 · Pro 강조 · 후기 2 · FAQ 4 · CTA «지금 구매» — 헤더 로고, 1:4 세로',
        }
      ),
    ],
  },
  sale_banner: {
    domain_name: [
      suggestion(
        { vi: '188.com.vn', en: '188.com.vn', zh: '188.com.vn', ja: '188.com.vn', ko: '188.com.vn' },
        {
          vi: '188.com.vn',
          en: '188.com.vn',
          zh: '188.com.vn',
          ja: '188.com.vn',
          ko: '188.com.vn',
        }
      ),
    ],
    campaign_name: [
      suggestion(
        { vi: 'Khai trương', en: 'Grand opening', zh: '开业', ja: 'オープン', ko: '오픈' },
        {
          vi: 'Phong cách nam đẳng cấp — giày, túi, phụ kiện',
          en: 'Premium men\'s style — shoes, bags & accessories',
          zh: '高端男士风格 — 鞋包配饰',
          ja: '上質なメンズスタイル — 靴・バッグ・アクセサリー',
          ko: '프리미엄 남성 스타일 — 신발·가방·액세서리',
        }
      ),
    ],
    product_offer: [
      suggestion(
        { vi: 'Serum / spa', en: 'Serum / spa', zh: '精华 / 水疗', ja: 'セラム / スパ', ko: '세럼 / 스파' },
        {
          vi: 'Serum Vitamin C cao cấp — dưỡng sáng da, giảm thâm nám',
          en: 'Premium Vitamin C serum — brightening, anti-dark-spot',
          zh: '高端维生素C精华 — 提亮肤色、淡化色斑',
          ja: 'プレミアムビタミンCセラム — 美白・シミケア',
          ko: '프리미엄 비타민 C 세럼 — 미백·잡티 케어',
        }
      ),
    ],
    brand_style: [
      suggestion(
        { vi: 'Trẻ / sang', en: 'Youth / luxury', zh: '年轻 / 高端', ja: '若々 / 高級', ko: '젊은 / 럭셔리' },
        {
          vi: 'Trẻ trung, năng động — gradient tím hồng, typography bold',
          en: 'Youthful, energetic — purple-pink gradient, bold typography',
          zh: '年轻活力 — 紫粉渐变，粗体字体',
          ja: '若々しくエネルギッシュ — 紫ピンクグラデ、太字',
          ko: '젊고 역동적 — 보라·핑크 그라데이션, 볼드 타이포',
        }
      ),
    ],
    color_tone: COMMON_DISCOVERY_SUGGESTIONS.color_tone!,
    banner_style: [
      suggestion(
        {
          vi: 'Đời sống / sắp xếp phẳng',
          en: 'Lifestyle / flat lay',
          zh: '生活方式 / 平铺',
          ja: 'ライフスタイル / フラットレイ',
          ko: '라이프스타일 / 플랫레이',
        },
        {
          vi: 'Bối cảnh đời sống cao cấp — người mẫu mặc sản phẩm, ánh sáng studio mềm',
          en: 'Premium lifestyle — model wearing product, soft studio lighting',
          zh: '高端生活方式 — 模特穿着产品，柔和棚拍光',
          ja: '高級ライフスタイル — モデル着用、ソフトなスタジオ光',
          ko: '프리미엄 라이프스타일 — 모델 착용, 부드러운 스튜디오 조명',
        }
      ),
      suggestion(
        {
          vi: 'Sản phẩm / thuần chữ',
          en: 'Product / typography',
          zh: '产品 / 字体',
          ja: '商品 / タイポ',
          ko: '제품 / 타이포',
        },
        {
          vi: 'Sắp xếp phẳng sản phẩm trên nền tối giản — không người mẫu',
          en: 'Product flat lay on minimal background — no model',
          zh: '极简背景产品平铺 — 无模特',
          ja: 'ミニマル背景の商品フラットレイ — モデルなし',
          ko: '미니멀 배경 제품 플랫레이 — 모델 없음',
        }
      ),
    ],
    banner_model: [
      suggestion(
        { vi: 'Nữ · châu Á', en: 'Female · Asian', zh: '女 · 亚洲', ja: '女性 · アジア', ko: '여성 · 아시아' },
        {
          vi: 'Nữ, châu Á, da sáng — mặc vest công sở sang trọng',
          en: 'Female, Asian, light skin — wearing elegant office blazer',
          zh: '女性，亚洲，肤色较浅 — 穿优雅职场西装',
          ja: '女性、アジア系、明るい肌 — 上品なオフィスジャケット',
          ko: '여성, 아시아, 밝은 피부 — 우아한 오피스 재킷',
        }
      ),
      suggestion(
        { vi: 'Nam · châu Âu', en: 'Male · European', zh: '男 · 欧洲', ja: '男性 · 欧州', ko: '남성 · 유럽' },
        {
          vi: 'Nam, châu Âu, da trung bình — phong cách thể thao năng động',
          en: 'Male, European, medium skin — dynamic athletic look',
          zh: '男性，欧洲，中等肤色 — 动感运动风',
          ja: '男性、欧州系、中間的な肌 — ダイナミックなスポーティ',
          ko: '남성, 유럽, 중간 톤 피부 — 역동적인 스포티 룩',
        }
      ),
      suggestion(
        {
          vi: 'Không người mẫu',
          en: 'No model',
          zh: '无模特',
          ja: 'モデルなし',
          ko: '모델 없음',
        },
        {
          vi: 'Không cần người mẫu — chỉ sản phẩm và typography',
          en: 'No model needed — product and typography only',
          zh: '不需要模特 — 仅产品与字体',
          ja: 'モデル不要 — 商品とタイポのみ',
          ko: '모델 불필요 — 제품과 타이포만',
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
    banner_design: [
      suggestion(
        { vi: 'Headline + CTA', en: 'Headline + CTA', zh: '标题 + CTA', ja: '見出し + CTA', ko: '헤드라인 + CTA' },
        {
          vi: 'GIẢM 50% — MUA NGAY · ảnh sản phẩm bên phải, logo góc trên',
          en: '50% OFF — SHOP NOW · product image on the right, logo top corner',
          zh: '5折 — 立即购买 · 产品图在右，Logo 左上角',
          ja: '50%OFF — 今すぐ購入 · 商品画像右、ロゴ左上',
          ko: '50% 할인 — 지금 구매 · 제품 이미지 오른쪽, 로고 좌상단',
        }
      ),
    ],
  },
  food_menu: {
    venue_name: [
      suggestion(
        { vi: 'Phở Bò Hà Nội', en: 'Hanoi Beef Pho', zh: '河内牛肉粉', ja: 'ハノイ牛肉フォー', ko: '하노이 쇠고기 쌀국수' },
        {
          vi: 'Phở Bò Hà Nội — 123 Lê Lợi',
          en: 'Hanoi Beef Pho — 123 Le Loi St',
          zh: '河内牛肉粉 — 黎利路 123 号',
          ja: 'ハノイ牛肉フォー — 123 Le Loi通り',
          ko: '하노이 쇠고기 쌀국수 — 123 Le Loi',
        }
      ),
    ],
    menu_type: [
      suggestion(
        { vi: 'Treo tường A4', en: 'Wall A4', zh: '挂墙 A4', ja: '壁掛け A4', ko: '벽 A4' },
        {
          vi: 'Menu treo tường A4 dọc — in 2 mặt',
          en: 'Wall A4 portrait menu — double-sided print',
          zh: '挂墙 A4 竖版 — 双面印刷',
          ja: '壁掛け A4 縦 — 両面印刷',
          ko: '벽 A4 세로 — 양면 인쇄',
        }
      ),
      suggestion(
        { vi: 'Menu bàn tent', en: 'Table tent', zh: '桌牌', ja: 'テーブル tent', ko: '테이블 tent' },
        {
          vi: 'Menu bàn tent vuông — để trên bàn',
          en: 'Square table tent menu for dine-in tables',
          zh: '方形桌牌菜单 — 放餐桌上',
          ja: '正方形テーブル tent メニュー',
          ko: '정사각형 테이블 tent 메뉴',
        }
      ),
      suggestion(
        { vi: 'Menu digital', en: 'Digital screen', zh: '电子屏', ja: 'デジタル', ko: '디지털' },
        {
          vi: 'Menu digital trên màn hình TV / tablet tại quán',
          en: 'Digital menu on TV or tablet at the venue',
          zh: '店内 TV/平板电子菜单',
          ja: '店内TV/タブレットのデジタルメニュー',
          ko: '매장 TV/태블릿 디지털 메뉴',
        }
      ),
      suggestion(
        { vi: 'Menu cuốn', en: 'Booklet', zh: '册子', ja: '冊子', ko: '册子' },
        {
          vi: 'Menu cuốn nhiều trang — bìa cứng, cán màng',
          en: 'Multi-page booklet menu — hard cover, laminated',
          zh: '多页册子菜单 — 硬封覆膜',
          ja: '多ページ冊子メニュー — 硬表紙・ラミネート',
          ko: '다페이지 책자형 메뉴 — 하드커버 라미네이트',
        }
      ),
    ],
    food_illustration: [
      suggestion(
        { vi: 'Có ảnh món', en: 'With photos', zh: '有菜品图', ja: '写真あり', ko: '사진 있음' },
        {
          vi: 'Có — ảnh minh họa món bên cạnh tên món',
          en: 'Yes — appetizing dish photo beside each item name',
          zh: '有 — 菜名旁诱人菜品图',
          ja: 'あり — 料理名横に appetizing な写真',
          ko: '있음 — 메뉴명 옆에 음식 사진',
        }
      ),
      suggestion(
        { vi: 'Không ảnh', en: 'No photos', zh: '无图', ja: '写真なし', ko: '사진 없음' },
        {
          vi: 'Không — chỉ chữ, giá và trang trí typography',
          en: 'No — text, prices, and typography decoration only',
          zh: '无 — 仅文字、价格与排版装饰',
          ja: 'なし — 文字・価格・装飾のみ',
          ko: '없음 — 글자·가격·타이포 장식만',
        }
      ),
    ],
    menu_style: [
      suggestion(
        { vi: 'Truyền thống VN', en: 'Vietnamese classic', zh: '越南传统', ja: 'ベトナム伝統', ko: '베트남 전통' },
        {
          vi: 'Truyền thống Việt hiện đại — typography rõ, viền trang trí nhẹ',
          en: 'Modern Vietnamese — clear typography, light decorative border',
          zh: '现代越南风 — 清晰字体、轻装饰边框',
          ja: 'モダンベトナム — 読みやすい字体、軽い装飾枠',
          ko: '모던 베트남 — 선명한 타이포, 가벼운 장식 테두리',
        }
      ),
      suggestion(
        { vi: 'Cafe tối giản', en: 'Minimal café', zh: '极简咖啡', ja: 'ミニマルカフェ', ko: '미니멀 카페' },
        {
          vi: 'Tối giản sang — nền trắng, chữ serif, khoảng trắng rộng',
          en: 'Minimal luxury — white background, serif type, generous whitespace',
          zh: '极简高级 — 白底、衬线字、大留白',
          ja: 'ミニマルで上品 — 白背景、セリフ体、余白多め',
          ko: '미니멀 럭셔리 — 흰 배경, 세리프, 넉넉한 여백',
        }
      ),
    ],
    color_tone: COMMON_DISCOVERY_SUGGESTIONS.color_tone!,
    menu_design: [
      suggestion(
        { vi: '3 món mẫu', en: '3 sample dishes', zh: '3 道示例', ja: '3品サンプル', ko: '샘플 3메뉴' },
        {
          vi: '1. Phở bò tái — tô — 65000 · 2. Bún chả — phần — 55000 · 3. Cà phê sữa — ly — 25000',
          en: '1. Rare beef pho — bowl — 65000 · 2. Bun cha — portion — 55000 · 3. Milk coffee — cup — 25000',
          zh: '1. 生牛肉粉 — 碗 — 65000 · 2. 烤肉米线 — 份 — 55000 · 3. 奶咖啡 — 杯 — 25000',
          ja: '1. 生牛肉フォー — 杯 — 65000 · 2. ブンチャー — 人前 — 55000 · 3. ミルクコーヒー — 杯 — 25000',
          ko: '1. 생 쇠고기 쌀국수 — 그릇 — 65000 · 2. 분짜 — 인분 — 55000 · 3. 밀크 커피 — 잔 — 25000',
        }
      ),
    ],
  },
  design_recreate: {
    design_sector: [
      suggestion(
        { vi: 'Thời trang', en: 'Fashion', zh: '时尚', ja: 'ファッション', ko: '패션' },
        { vi: 'fashion', en: 'fashion', zh: 'fashion', ja: 'fashion', ko: 'fashion' }
      ),
      suggestion(
        { vi: 'Phụ kiện', en: 'Accessories', zh: '配饰', ja: 'アクセサリー', ko: '액세서리' },
        { vi: 'accessories', en: 'accessories', zh: 'accessories', ja: 'accessories', ko: 'accessories' }
      ),
      suggestion(
        { vi: 'Bao bì', en: 'Packaging', zh: '包装', ja: 'パッケージ', ko: '패키징' },
        { vi: 'packaging', en: 'packaging', zh: 'packaging', ja: 'packaging', ko: 'packaging' }
      ),
    ],
    design_format: [
      suggestion(
        { vi: 'Bảng concept đầy đủ', en: 'Full concept board', zh: '完整概念板', ja: 'フルコンセプトボード', ko: '전체 컨셉 보드' },
        { vi: 'concept_board', en: 'concept_board', zh: 'concept_board', ja: 'concept_board', ko: 'concept_board' }
      ),
      suggestion(
        { vi: 'Minh họa hero', en: 'Hero illustration', zh: '主图插画', ja: 'ヒーローイラスト', ko: '히어로 일러스트' },
        { vi: 'hero_illustration', en: 'hero_illustration', zh: 'hero_illustration', ja: 'hero_illustration', ko: 'hero_illustration' }
      ),
      suggestion(
        { vi: 'Bản vẽ kỹ thuật', en: 'Technical flat', zh: '技术平稿', ja: '技術フラット', ko: '기술 플랫' },
        { vi: 'technical_flat', en: 'technical_flat', zh: 'technical_flat', ja: 'technical_flat', ko: 'technical_flat' }
      ),
    ],
    render_style: [
      suggestion(
        {
          vi: 'Concept sheet thời trang',
          en: 'Fashion concept sheet',
          zh: '时尚概念板',
          ja: 'ファッションコンセプト',
          ko: '패션 컨셉 시트',
        },
        {
          vi: 'fashion_concept_sheet',
          en: 'fashion_concept_sheet',
          zh: 'fashion_concept_sheet',
          ja: 'fashion_concept_sheet',
          ko: 'fashion_concept_sheet',
        }
      ),
      suggestion(
        { vi: 'Phác thảo chì', en: 'Pencil sketch', zh: '铅笔素描', ja: '鉛筆スケッチ', ko: '연필 스케치' },
        { vi: 'pencil_sketch', en: 'pencil_sketch', zh: 'pencil_sketch', ja: 'pencil_sketch', ko: 'pencil_sketch' }
      ),
      suggestion(
        {
          vi: 'Phác thảo marker',
          en: 'Marker sketch',
          zh: '马克笔速写',
          ja: 'マーカー',
          ko: '마커 스케치',
        },
        {
          vi: 'marker_fashion_sketch',
          en: 'marker_fashion_sketch',
          zh: 'marker_fashion_sketch',
          ja: 'marker_fashion_sketch',
          ko: 'marker_fashion_sketch',
        }
      ),
      suggestion(
        { vi: 'Màu nước digital', en: 'Digital watercolor', zh: '数字水彩', ja: 'デジタル水彩', ko: '디지털 수채화' },
        {
          vi: 'watercolor_illustration',
          en: 'watercolor_illustration',
          zh: 'watercolor_illustration',
          ja: 'watercolor_illustration',
          ko: 'watercolor_illustration',
        }
      ),
    ],
    sample_upload: [
      suggestion(
        { vi: 'Đã tải ảnh', en: 'Photos uploaded', zh: '已上传图片', ja: '画像アップロード済み', ko: '사진 업로드 완료' },
        {
          vi: 'Đã tải 3 ảnh mẫu — trước, sau, chi tiết thêu',
          en: 'Uploaded 3 sample photos — front, back, embroidery detail',
          zh: '已上传3张样品 — 正面、背面、刺绣细节',
          ja: 'サンプル3枚アップロード — 正面・背面・刺繍詳細',
          ko: '샘플 3장 업로드 — 앞·뒤·자수 디테일',
        }
      ),
    ],
    color_palette: COMMON_DISCOVERY_SUGGESTIONS.color_palette!,
    design_notes: [
      suggestion(
        { vi: 'Dịp Tết', en: 'Tet holiday', zh: '春节', ja: 'テト', ko: '설날' },
        {
          vi: 'Dịp Tết — phối quần rộng lụa kem + túi da beige + giày cao gót',
          en: 'Tet holiday — wide cream silk trousers + beige leather bag + heels',
          zh: '春节 — 搭配米色阔腿丝裤 + 米色皮包 + 高跟鞋',
          ja: 'テト — クリームワイドシルクパンツ + ベージュバッグ + ヒール',
          ko: '설날 — 크림 와이드 실크 팬츠 + 베이지 가방 + 힐',
        }
      ),
    ],
    design_language: [
      suggestion(
        { vi: 'Tiếng Việt', en: 'Vietnamese', zh: '越南语', ja: 'ベトナム語', ko: '베트남어' },
        { vi: 'vi', en: 'vi', zh: 'vi', ja: 'vi', ko: 'vi' }
      ),
      suggestion(
        { vi: 'Tiếng Anh', en: 'English', zh: '英语', ja: '英語', ko: '영어' },
        { vi: 'en', en: 'en', zh: 'en', ja: 'en', ko: 'en' }
      ),
      suggestion(
        { vi: 'Song ngữ VI+EN', en: 'Bilingual VI+EN', zh: '双语越+英', ja: '二言語 越+英', ko: '이중언어 베+영' },
        { vi: 'bilingual', en: 'bilingual', zh: 'bilingual', ja: 'bilingual', ko: 'bilingual' }
      ),
    ],
    logo: [
      suggestion(
        { vi: 'Monogram vàng', en: 'Gold monogram', zh: '金色字母', ja: 'ゴールドモノグラム', ko: '골드 모노그램' },
        {
          vi: 'Logo monogram chữ cái vàng kim, nền trong suốt, nét thanh lịch',
          en: 'Gold lettermark monogram logo, transparent background, elegant lines',
          zh: '金色字母组合 Logo，透明背景，优雅线条',
          ja: 'ゴールドのレターマーク、透明背景、上品なライン',
          ko: '골드 레터마크 모노그램, 투명 배경, 우아한 라인',
        }
      ),
      suggestion(
        { vi: 'Đã có file logo', en: 'Have logo file', zh: '已有 Logo 文件', ja: 'ロゴファイルあり', ko: '로고 파일 있음' },
        {
          vi: 'Đã có file logo — sẽ bấm Tải logo',
          en: 'I already have a logo file — will tap Upload logo',
          zh: '已有 Logo 文件 — 将点击上传 Logo',
          ja: 'ロゴファイルあり — ロゴをアップロードします',
          ko: '로고 파일 있음 — 로고 업로드 예정',
        }
      ),
    ],
    concept_sheet: [
      suggestion(
        { vi: 'Concept board đầy đủ', en: 'Full concept board', zh: '完整概念板', ja: 'フルコンセプト', ko: '전체 컨셉' },
        {
          vi: 'Bảng concept đầy đủ — nhân vật + chi tiết + kỹ thuật + màu + phối đồ',
          en: 'Full concept board — character + details + technical + colors + styling',
          zh: '完整概念板 — 人物 + 细节 + 技术稿 + 配色 + 搭配',
          ja: 'フルコンセプト — 人物 + 詳細 + 技術 + 配色 + スタイリング',
          ko: '전체 컨셉 — 인물 + 디테일 + 기술 + 색상 + 스타일링',
        }
      ),
    ],
    detail_panel: [
      suggestion(
        { vi: 'Chi tiết cận', en: 'Detail close-ups', zh: '细节特写', ja: 'ディテール', ko: '디테일' },
        {
          vi: '3 panel chi tiết: cổ áo, thêu hoa, tay loe',
          en: '3 detail panels: collar, floral embroidery, bell sleeves',
          zh: '3 个细节：领口、花卉刺绣、喇叭袖',
          ja: '3詳細: 襟、花刺繍、ベルスリーブ',
          ko: '디테일 3패널: collar, 꽃 자수, 벨 슬리브',
        }
      ),
    ],
    technical_flat: [
      suggestion(
        { vi: 'Flat kỹ thuật', en: 'Technical flat', zh: '技术平稿', ja: '技術フラット', ko: '기술 플랫' },
        {
          vi: 'Bản vẽ phẳng: mặt trước, sau, bên — nét vẽ sạch',
          en: 'Flat sketches: front, back, side — clean line art',
          zh: '平稿：正、背、侧 — 干净线稿',
          ja: 'フラット: 前・後・横 — クリーン線画',
          ko: '플랫 스케치: 앞·뒤·옆 — 깔끔한 라인',
        }
      ),
    ],
  },
}

export type StudioStepSuggestionItem = {
  label: string
  message: string
}

/** Pull a short example from ask text, e.g. parentheses after the question. */
export function extractExampleFromAsk(ask: string): string | null {
  const trimmed = ask.trim()
  if (!trimmed) return null
  const parenMatches = [...trimmed.matchAll(/\(([^)]+)\)/g)]
  const lastParen = parenMatches.at(-1)?.[1]
  if (lastParen) {
    let inner = lastParen.replace(/…+$/u, '').trim()
    inner = inner.replace(/^(?:vd|ví dụ|e\.g\.|示例|例|예)[:：]\s*/iu, '').trim()
    if (inner.length >= 2) return inner
  }
  return null
}

export function getStudioStepSuggestions(
  presetId: string | null | undefined,
  stepKey: string | null | undefined,
  locale: WebLocale
): StudioStepSuggestionItem[] {
  if (!presetId || !stepKey) return []

  const presetMap = PRESET_STEP_SUGGESTIONS[presetId]
  const presetList = presetMap?.[stepKey]
  const list =
    (Array.isArray(presetList) && presetList.length > 0
      ? presetList
      : null) ??
    COMMON_DISCOVERY_SUGGESTIONS[stepKey] ??
    []
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
  if (!presetId || !stepKey) return fallback

  const suggestions = getStudioStepSuggestions(presetId, stepKey, locale)
  if (suggestions[0]?.message) {
    return formatStudioExampleLabel(locale, suggestions[0].message)
  }

  const askExample = getStepAskExample(locale, presetId, stepKey)
  if (askExample) {
    return formatStudioExampleLabel(locale, askExample)
  }

  const ask = getStepAskPrompt(locale, presetId, stepKey)
  const extracted = extractExampleFromAsk(ask)
  if (extracted) {
    return formatStudioExampleLabel(locale, extracted)
  }

  return fallback
}
