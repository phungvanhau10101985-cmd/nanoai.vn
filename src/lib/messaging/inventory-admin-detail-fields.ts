import type { WebLocale } from '@/lib/i18n/config'

/** Vector payloads are stored but not shown — they are not readable product fields. */
export const INVENTORY_DETAIL_OMIT_KEYS = [
  'image_embedding_vec',
  'text_embedding_vec',
  'image_embedding_json',
  'text_embedding_json',
] as const

const OMIT = new Set<string>(INVENTORY_DETAIL_OMIT_KEYS)

type Copy = Record<WebLocale, string>

function copy(vi: string, en: string, zh: string, ja: string, ko: string): Copy {
  return { vi, en, zh, ja, ko }
}

const GROUP_TITLE: Record<string, Copy> = {
  identity: copy('Định danh', 'Identity', '标识', '識別', '식별'),
  price: copy('Giá', 'Price', '价格', '価格', '가격'),
  stock: copy('Kho', 'Stock', '库存', '在庫', '재고'),
  category: copy('Danh mục và thuộc tính', 'Categories and attributes', '分类和属性', 'カテゴリと属性', '카테고리와 속성'),
  stats: copy('Số liệu', 'Stats', '数据', '指標', '지표'),
  media: copy('Ảnh và video', 'Images and video', '图片和视频', '画像と動画', '이미지와 동영상'),
  content: copy('Nội dung', 'Content', '内容', '内容', '내용'),
  source: copy('Nguồn hàng', 'Source', '货源', '仕入れ', '공급'),
  i18n: copy('Bản địa hóa ảnh', 'Image localization', '图片本地化', '画像ローカライズ', '이미지 현지화'),
  system: copy('Hệ thống', 'System', '系统', 'システム', '시스템'),
  other: copy('Trường khác', 'Other fields', '其他字段', 'その他の項目', '기타 필드'),
}

const FIELD_LABEL: Record<string, Copy> = {
  id: copy('Id kho', 'Inventory id', '库存 ID', '在庫 ID', '재고 ID'),
  partner_id: copy('Workspace', 'Workspace', '工作区', 'ワークスペース', '워크스페이스'),
  remarketing_id: copy('Id sản phẩm', 'Product id', '商品 ID', '商品 ID', '상품 ID'),
  sku: copy('Mã sản phẩm', 'SKU', '商品编码', '商品コード', '상품 코드'),
  catalog_slug: copy('Slug', 'Slug', 'Slug', 'スラッグ', '슬러그'),
  name: copy('Tên', 'Name', '名称', '名前', '이름'),
  chinese_name: copy('Tên tiếng Trung', 'Chinese name', '中文名', '中国語名', '중국어 이름'),
  brand_name: copy('Thương hiệu', 'Brand', '品牌', 'ブランド', '브랜드'),
  origin: copy('Xuất xứ', 'Origin', '产地', '原産地', '원산지'),
  source_origin: copy('Xuất xứ nguồn', 'Source origin', '货源产地', '仕入れ原産地', '공급 원산지'),
  is_active: copy('Trạng thái', 'Status', '状态', '状態', '상태'),
  is_clearance: copy('Kho thanh lý', 'Clearance', '清仓', '清算在庫', '클리어런스'),
  sort_order: copy('Thứ tự', 'Sort order', '排序', '並び順', '정렬'),
  created_at: copy('Tạo lúc', 'Created at', '创建时间', '作成日時', '생성 시각'),
  updated_at: copy('Cập nhật lúc', 'Updated at', '更新时间', '更新日時', '수정 시각'),
  price_amount: copy('Giá', 'Price', '价格', '価格', '가격'),
  price_currency: copy('Tiền tệ', 'Currency', '货币', '通貨', '통화'),
  price_hint: copy('Giá (ghi chú)', 'Price note', '价格备注', '価格メモ', '가격 메모'),
  sale_price_amount: copy('Giá sale', 'Sale price', '促销价', 'セール価格', '세일 가격'),
  sale_starts_at: copy('Sale bắt đầu', 'Sale starts', '促销开始', 'セール開始', '세일 시작'),
  sale_ends_at: copy('Sale kết thúc', 'Sale ends', '促销结束', 'セール終了', '세일 종료'),
  price_low_hint: copy('Sp giá thấp hơn', 'Lower price hint', '更低价', 'より安い価格', '더 낮은 가격'),
  price_high_hint: copy('Sp giá cao hơn', 'Higher price hint', '更高价', 'より高い価格', '더 높은 가격'),
  cost_cny: copy('Giá gốc tiền tệ', 'Source currency cost', '原币成本', '原通貨原価', '원통화 원가'),
  cost_vnd: copy('Giá gốc tiền Việt', 'VND cost', '越南盾成本', 'ベトナムドン原価', '베트남동 원가'),
  deposit_required: copy('Cần đặt cọc', 'Deposit required', '需要订金', '内金が必要', '계약금 필요'),
  stock_qty: copy('Số lượng có thể mua', 'Available quantity', '可购数量', '購入可能数', '구매 가능 수량'),
  warehouse_reserved: copy('Đang giữ kho', 'Reserved', '已预留', '引当数', '예약 수량'),
  stock_note: copy('Màu (JSON / ghi chú)', 'Color note', '颜色备注', 'カラーメモ', '색상 메모'),
  category_l1: copy('Danh mục cấp 1', 'Category level 1', '一级分类', 'カテゴリ 1', '카테고리 1'),
  category_l2: copy('Danh mục cấp 2', 'Category level 2', '二级分类', 'カテゴリ 2', '카테고리 2'),
  category_l3: copy('Danh mục cấp 3', 'Category level 3', '三级分类', 'カテゴリ 3', '카테고리 3'),
  style: copy('Kiểu dáng', 'Style', '款式', 'スタイル', '스타일'),
  color_summary: copy('Màu sắc', 'Color', '颜色', '色', '색상'),
  occasion: copy('Dịp', 'Occasion', '场合', 'シーン', '상황'),
  material_note: copy('Chất liệu', 'Material', '材质', '素材', '소재'),
  weight: copy('Trọng lượng (g)', 'Weight (g)', '重量（克）', '重量（g）', '무게(g)'),
  features_json: copy('Tính năng', 'Features', '特点', '特徴', '특징'),
  sizes_json: copy('Size', 'Sizes', '尺码', 'サイズ', '사이즈'),
  colors_json: copy('Biến thể', 'Variants', '变体', 'バリエーション', '옵션'),
  likes_count: copy('Thích', 'Likes', '喜欢', 'いいね', '좋아요'),
  purchases_count: copy('Mua', 'Purchases', '购买', '購入', '구매'),
  reviews_count: copy('Lượt đánh giá', 'Reviews', '评价数', 'レビュー数', '리뷰 수'),
  questions_count: copy('Lượt hỏi', 'Questions', '提问数', '質問数', '질문 수'),
  rating_score: copy('Điểm đánh giá', 'Rating', '评分', '評価点', '평점'),
  rating_group_id: copy('Nhóm đánh giá', 'Review group', '评价组', 'レビューグループ', '리뷰 그룹'),
  question_group_id: copy('Nhóm câu hỏi', 'Question group', '问答组', '質問グループ', '질문 그룹'),
  image_url: copy('Ảnh đại diện', 'Main image', '主图', 'メイン画像', '대표 이미지'),
  gallery_urls: copy('Thư viện ảnh', 'Gallery', '图库', 'ギャラリー', '갤러리'),
  detail_image_urls: copy('Ảnh chi tiết', 'Detail images', '详情图', '詳細画像', '상세 이미지'),
  material_detail_image_url: copy('Ảnh chất liệu', 'Material image', '材质图', '素材画像', '소재 이미지'),
  real_use_image_url: copy('Ảnh thực tế', 'In-use image', '实拍图', '使用イメージ', '실사용 이미지'),
  real_use_image_url_2: copy('Ảnh thực tế 2', 'In-use image 2', '实拍图 2', '使用イメージ 2', '실사용 이미지 2'),
  product_video_url: copy('Link video', 'Video URL', '视频链接', '動画 URL', '동영상 URL'),
  product_url: copy('Link mặc định', 'Default link', '默认链接', '既定リンク', '기본 링크'),
  description: copy('Mô tả sản phẩm', 'Description', '商品描述', '商品説明', '상품 설명'),
  consult_note: copy('Ghi chú tư vấn', 'Consult note', '咨询备注', '相談メモ', '상담 메모'),
  product_info_json: copy('Thông tin sản phẩm', 'Product info', '商品信息', '商品情報', '상품 정보'),
  catalog_json: copy('Catalog JSON', 'Catalog JSON', '目录 JSON', 'カタログ JSON', '카탈로그 JSON'),
  product_studio_meta: copy('Product Studio', 'Product Studio', 'Product Studio', 'Product Studio', 'Product Studio'),
  image_consult_context: copy('Chữ trên ảnh (tư vấn)', 'Image consult text', '图片咨询文字', '画像の相談テキスト', '이미지 상담 문구'),
  source_shop_name: copy('Tên shop nguồn', 'Source shop', '货源店名', '仕入れ店名', '공급 상점'),
  source_shop_id: copy('Shop id', 'Shop id', '店铺 ID', 'ショップ ID', '상점 ID'),
  source_shop_name_chinese: copy('Shop Trung Quốc', 'Chinese shop name', '中国店铺名', '中国店舗名', '중국 상점명'),
  source_stock_status: copy('Trạng thái nguồn', 'Source stock status', '货源状态', '仕入れ在庫状態', '공급 재고 상태'),
  source_stock_checked_at: copy('Kiểm tra nguồn lúc', 'Source checked at', '货源检查时间', '仕入れ確認日時', '공급 확인 시각'),
  source_stock_next_check_at: copy('Lần kiểm tra kế', 'Next source check', '下次检查', '次回確認', '다음 확인'),
  source_stock_error: copy('Lỗi kiểm tra nguồn', 'Source check error', '货源检查错误', '仕入れ確認エラー', '공급 확인 오류'),
  source_stock_check_platform: copy('Nền kiểm tra', 'Check platform', '检查平台', '確認プラットフォーム', '확인 플랫폼'),
  admin_source_batch_scanned_at: copy('Quét batch lúc', 'Batch scanned at', '批量扫描时间', 'バッチスキャン日時', '배치 스캔 시각'),
  image_localization_status: copy('Ảnh i18n', 'Image i18n', '图片本地化', '画像 i18n', '이미지 i18n'),
  image_localization_language: copy('Ngôn ngữ ảnh', 'Image language', '图片语言', '画像の言語', '이미지 언어'),
  image_localized_at: copy('Bản địa hóa lúc', 'Localized at', '本地化时间', 'ローカライズ日時', '현지화 시각'),
  image_localization_error: copy('Lỗi bản địa hóa', 'Localization error', '本地化错误', 'ローカライズエラー', '현지화 오류'),
  image_embedding_model: copy('Model embedding ảnh', 'Image embedding model', '图片向量模型', '画像埋め込みモデル', '이미지 임베딩 모델'),
  image_embedding_dims: copy('Số chiều embedding ảnh', 'Image embedding dims', '图片向量维度', '画像埋め込み次元', '이미지 임베딩 차원'),
  image_embedding_fingerprint: copy('Fingerprint ảnh', 'Image fingerprint', '图片指纹', '画像フィンガープリント', '이미지 지문'),
  image_embedding_updated_at: copy('Embedding ảnh lúc', 'Image embedding at', '图片向量时间', '画像埋め込み日時', '이미지 임베딩 시각'),
  image_embedding_error: copy('Lỗi embedding ảnh', 'Image embedding error', '图片向量错误', '画像埋め込みエラー', '이미지 임베딩 오류'),
  text_embedding_model: copy('Model embedding chữ', 'Text embedding model', '文本向量模型', 'テキスト埋め込みモデル', '텍스트 임베딩 모델'),
  text_embedding_dims: copy('Số chiều embedding chữ', 'Text embedding dims', '文本向量维度', 'テキスト埋め込み次元', '텍스트 임베딩 차원'),
  text_embedding_fingerprint: copy('Fingerprint chữ', 'Text fingerprint', '文本指纹', 'テキストフィンガープリント', '텍스트 지문'),
  text_embedding_updated_at: copy('Embedding chữ lúc', 'Text embedding at', '文本向量时间', 'テキスト埋め込み日時', '텍스트 임베딩 시각'),
  text_embedding_error: copy('Lỗi embedding chữ', 'Text embedding error', '文本向量错误', 'テキスト埋め込みエラー', '텍스트 임베딩 오류'),
  vision_catalog_checksum: copy('Checksum vision', 'Vision checksum', '视觉校验', 'ビジョンチェックサム', '비전 체크섬'),
  vision_catalog_synced_at: copy('Đồng bộ vision lúc', 'Vision synced at', '视觉同步时间', 'ビジョン同期日時', '비전 동기화 시각'),
  vision_catalog_excluded: copy('Loại khỏi vision', 'Excluded from vision', '排除视觉', 'ビジョン対象外', '비전 제외'),
  consult_link_opening_text: copy('Lời mở chat tư vấn', 'Consult opening text', '咨询开场白', '相談の開始文', '상담 시작 문구'),
  consult_link_opening_input_fingerprint: copy('Fingerprint lời mở', 'Opening fingerprint', '开场白指纹', '開始文フィンガープリント', '시작 문구 지문'),
  product_studio_job_id: copy('Job Product Studio', 'Product Studio job', 'Product Studio 任务', 'Product Studio ジョブ', 'Product Studio 작업'),
  search_document: copy('Tài liệu tìm kiếm', 'Search document', '搜索文档', '検索ドキュメント', '검색 문서'),
}

const GROUP_KEYS: Array<{ id: string; keys: string[] }> = [
  {
    id: 'identity',
    keys: [
      'id',
      'remarketing_id',
      'sku',
      'catalog_slug',
      'name',
      'chinese_name',
      'brand_name',
      'origin',
      'source_origin',
      'is_active',
      'is_clearance',
      'sort_order',
      'partner_id',
      'created_at',
      'updated_at',
    ],
  },
  {
    id: 'price',
    keys: [
      'price_amount',
      'price_currency',
      'price_hint',
      'sale_price_amount',
      'sale_starts_at',
      'sale_ends_at',
      'price_low_hint',
      'price_high_hint',
      'cost_cny',
      'cost_vnd',
      'deposit_required',
    ],
  },
  { id: 'stock', keys: ['stock_qty', 'warehouse_reserved', 'stock_note'] },
  {
    id: 'category',
    keys: [
      'category_l1',
      'category_l2',
      'category_l3',
      'style',
      'color_summary',
      'occasion',
      'material_note',
      'weight',
      'features_json',
      'sizes_json',
      'colors_json',
    ],
  },
  {
    id: 'stats',
    keys: [
      'likes_count',
      'purchases_count',
      'reviews_count',
      'questions_count',
      'rating_score',
      'rating_group_id',
      'question_group_id',
    ],
  },
  {
    id: 'media',
    keys: [
      'image_url',
      'gallery_urls',
      'detail_image_urls',
      'material_detail_image_url',
      'real_use_image_url',
      'real_use_image_url_2',
      'product_video_url',
      'product_url',
    ],
  },
  {
    id: 'content',
    keys: ['description', 'consult_note', 'product_info_json', 'catalog_json', 'product_studio_meta', 'image_consult_context'],
  },
  {
    id: 'source',
    keys: [
      'source_shop_name',
      'source_shop_id',
      'source_shop_name_chinese',
      'source_stock_status',
      'source_stock_checked_at',
      'source_stock_next_check_at',
      'source_stock_error',
      'source_stock_check_platform',
      'admin_source_batch_scanned_at',
    ],
  },
  {
    id: 'i18n',
    keys: [
      'image_localization_status',
      'image_localization_language',
      'image_localized_at',
      'image_localization_error',
    ],
  },
  {
    id: 'system',
    keys: [
      'image_embedding_model',
      'image_embedding_dims',
      'image_embedding_fingerprint',
      'image_embedding_updated_at',
      'image_embedding_error',
      'text_embedding_model',
      'text_embedding_dims',
      'text_embedding_fingerprint',
      'text_embedding_updated_at',
      'text_embedding_error',
      'vision_catalog_checksum',
      'vision_catalog_synced_at',
      'vision_catalog_excluded',
      'consult_link_opening_text',
      'consult_link_opening_input_fingerprint',
      'product_studio_job_id',
      'search_document',
    ],
  },
]

const IMAGE_KEYS = new Set([
  'image_url',
  'gallery_urls',
  'detail_image_urls',
  'material_detail_image_url',
  'real_use_image_url',
  'real_use_image_url_2',
])
const LONG_KEYS = new Set([
  'description',
  'consult_note',
  'stock_note',
  'search_document',
  'consult_link_opening_text',
  'image_localization_error',
  'source_stock_error',
  'image_embedding_error',
  'text_embedding_error',
])
const JSON_KEYS = new Set([
  'features_json',
  'sizes_json',
  'product_info_json',
  'catalog_json',
  'product_studio_meta',
  'image_consult_context',
])

export const INVENTORY_DETAIL_BOOL = {
  yes: copy('Có', 'Yes', '是', 'あり', '예'),
  no: copy('Không', 'No', '否', 'なし', '아니요'),
  shown: copy('Hiển thị', 'Visible', '显示', '表示', '표시'),
  hidden: copy('Ẩn', 'Hidden', '隐藏', '非表示', '숨김'),
}

export type InventoryDetailCell =
  | { key: string; label: string; kind: 'empty' }
  | { key: string; label: string; kind: 'text'; text: string }
  | { key: string; label: string; kind: 'long'; text: string }
  | { key: string; label: string; kind: 'bool'; text: string }
  | { key: string; label: string; kind: 'url'; href: string }
  | { key: string; label: string; kind: 'images'; urls: string[] }
  | { key: string; label: string; kind: 'colors'; items: Array<{ name: string; img: string }> }
  | { key: string; label: string; kind: 'json'; text: string }

export type InventoryDetailSection = {
  id: string
  title: string
  cells: InventoryDetailCell[]
}

function pick(locale: WebLocale, row: Copy | undefined, fallback: string): string {
  if (!row) return fallback
  return row[locale] || row.vi || fallback
}

function labelFor(key: string, locale: WebLocale): string {
  return pick(locale, FIELD_LABEL[key], key)
}

function isBlank(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

function asUrlList(value: unknown): string[] {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter((item) => /^https?:\/\//i.test(item))
}

function asColorItems(value: unknown): Array<{ name: string; img: string }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ name: string; img: string }> = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ name: item.trim(), img: '' })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = String(row.name ?? row.label ?? '').trim()
    const img = String(row.img ?? row.image_url ?? '').trim()
    if (name || img) out.push({ name, img })
  }
  return out
}

function cellFor(key: string, value: unknown, locale: WebLocale): InventoryDetailCell {
  const label = labelFor(key, locale)
  if (isBlank(value)) return { key, label, kind: 'empty' }
  if (key === 'is_active' && typeof value === 'boolean') {
    return { key, label, kind: 'bool', text: pick(locale, value ? INVENTORY_DETAIL_BOOL.shown : INVENTORY_DETAIL_BOOL.hidden, '') }
  }
  if (typeof value === 'boolean') {
    return { key, label, kind: 'bool', text: pick(locale, value ? INVENTORY_DETAIL_BOOL.yes : INVENTORY_DETAIL_BOOL.no, '') }
  }
  if (key === 'colors_json') {
    const items = asColorItems(value)
    if (items.length === 0) return { key, label, kind: 'json', text: JSON.stringify(value, null, 2) }
    return { key, label, kind: 'colors', items }
  }
  if (IMAGE_KEYS.has(key)) {
    const urls = asUrlList(value)
    if (urls.length > 0) return { key, label, kind: 'images', urls }
  }
  if (key === 'product_url' || key === 'product_video_url') {
    const href = String(value).trim()
    if (/^https?:\/\//i.test(href)) return { key, label, kind: 'url', href }
  }
  if (JSON_KEYS.has(key) || (value && typeof value === 'object')) {
    try {
      return { key, label, kind: 'json', text: JSON.stringify(value, null, 2) }
    } catch {
      return { key, label, kind: 'text', text: String(value) }
    }
  }
  const text = String(value)
  if (LONG_KEYS.has(key) || text.length > 180) return { key, label, kind: 'long', text }
  return { key, label, kind: 'text', text }
}

export function buildInventoryDetailSections(
  fields: Record<string, unknown>,
  locale: WebLocale
): InventoryDetailSection[] {
  const seen = new Set<string>()
  const sections: InventoryDetailSection[] = []
  for (const group of GROUP_KEYS) {
    const cells: InventoryDetailCell[] = []
    for (const key of group.keys) {
      if (OMIT.has(key) || !Object.prototype.hasOwnProperty.call(fields, key)) continue
      seen.add(key)
      cells.push(cellFor(key, fields[key], locale))
    }
    if (cells.length > 0) {
      sections.push({ id: group.id, title: pick(locale, GROUP_TITLE[group.id], group.id), cells })
    }
  }
  const rest = Object.keys(fields)
    .filter((key) => !seen.has(key) && !OMIT.has(key))
    .sort()
  if (rest.length > 0) {
    sections.push({
      id: 'other',
      title: pick(locale, GROUP_TITLE.other, 'other'),
      cells: rest.map((key) => cellFor(key, fields[key], locale)),
    })
  }
  return sections
}

export function inventoryDetailShownKeys(fields: Record<string, unknown>): string[] {
  return buildInventoryDetailSections(fields, 'vi').flatMap((section) => section.cells.map((cell) => cell.key))
}
