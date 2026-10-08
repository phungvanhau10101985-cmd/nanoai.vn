import type { WebLocale } from '@/lib/i18n/config'
import { proposeProductStudioCategoryPath } from '@/lib/partner-website/category/partner-category-taxonomy-propose'
import { buildProductStudioSlotPrompt } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import type {
  ProductStudioJobPayload,
  ProductStudioModelPresence,
  ProductStudioProductType,
  ProductStudioShotStyle,
  ProductStudioSlotKind,
} from '@/lib/partner-website/product-studio/product-studio-types'
import { nameProductFromReferenceImage } from '@/lib/partner-website/product-studio/product-studio-vision-naming'

const STEP_KIND: Record<string, ProductStudioSlotKind> = {
  color_main: 'color',
  gallery_2: 'gallery',
  gallery_3: 'gallery',
  detail_close: 'detail',
  material_card: 'material',
}

function note(notes: Record<string, string>, key: string): string {
  return String(notes[key] ?? '').trim()
}

function parseProductType(text: string): ProductStudioProductType {
  const t = text.toLowerCase()
  if (/giày|giay|dép|dep|sandal|boot|sneaker|shoes|鞋|靴|シューズ|신발/.test(t)) return 'shoes'
  if (/túi|tui|ví |bag|wallet|backpack|包|バッグ|가방/.test(t)) return 'accessory'
  if (/áo|ao|quần|quan|váy|vay|đầm|dam|shirt|dress|hoodie|衣|服|シャツ|옷/.test(t)) return 'apparel'
  if (/đồ ăn|do an|food|thực phẩm|thuc pham/.test(t)) return 'food'
  if (/nhà|nha|household|gia dụng|gia dung/.test(t)) return 'household'
  return 'other'
}

function parseGender(text: string): string {
  const t = text.toLowerCase()
  if (/nữ|nu\b|women|female|女|レディ|여성/.test(t)) return 'female'
  if (/nam\b|men|male|男|メンズ|남성/.test(t)) return 'male'
  return 'unisex'
}

function parseShotStyle(text: string): ProductStudioShotStyle {
  const t = text.toLowerCase()
  if (/outdoor|ngoài trời|ngoai troi|ngoai|户外|屋外|야외/.test(t)) return 'outdoor'
  if (/lifestyle|đời|doi song|street|街拍|日常|일상/.test(t)) return 'lifestyle'
  return 'studio'
}

function parseModelPresence(text: string): ProductStudioModelPresence {
  const t = text.toLowerCase()
  if (/không người|khong nguoi|chỉ sản phẩm|chi san pham|product only|no model|无人|モデルなし|모델 없/.test(t)) {
    return 'none'
  }
  if (/người mẫu|nguoi mau|có người|co nguoi|model|模特|モデル|모델/.test(t)) return 'model'
  return 'none'
}

export function catalogPhotoPayloadFromBrief(notes: Record<string, string>): ProductStudioJobPayload {
  const kind = `${note(notes, 'product_kind')} ${note(notes, 'shot_look')}`
  return {
    mode: 'ai',
    price: 0,
    material: note(notes, 'material') || 'as in the sample photo',
    productName: note(notes, 'product_kind'),
    productType: parseProductType(kind),
    gender: parseGender(kind),
    style: '',
    sizes: [],
    noSize: true,
    colors: [],
    available: 0,
    notes: note(notes, 'shot_look'),
    shotStyle: parseShotStyle(note(notes, 'shot_look')),
    modelPresence: parseModelPresence(note(notes, 'shot_look')),
    refImageUrls: [],
  }
}

/** Prompt ảnh catalog — cùng engine Product Studio AI, không đăng shop. */
export function catalogPhotoSlotPrompt(input: {
  briefNotes: Record<string, string>
  stepKey: string
  customNote?: string
  locale: WebLocale
}): string | null {
  const kind = STEP_KIND[input.stepKey]
  if (!kind) return null
  const noteText = String(input.customNote ?? '').trim()
  const custom = noteText.length >= 2 && noteText.length <= 280 ? noteText : undefined
  return buildProductStudioSlotPrompt(
    catalogPhotoPayloadFromBrief(input.briefNotes),
    kind,
    kind === 'color' ? undefined : undefined,
    custom,
    { colorIndex: 0, locale: input.locale }
  )
}

const PACK_LABELS: Record<WebLocale, { name: string; category: string; hint: string; fallback: string }> = {
  vi: {
    name: 'Tên sản phẩm',
    category: 'Loại',
    hint: 'Copy hai dòng trên khi đăng Facebook hoặc web khác. Ảnh đã duyệt nằm trong cuộc chat này.',
    fallback: 'Chưa đặt được tên từ ảnh — dùng mô tả loại hàng bạn đã gửi.',
  },
  en: {
    name: 'Product name',
    category: 'Category',
    hint: 'Copy the two lines above when posting on Facebook or another site. Approved photos stay in this chat.',
    fallback: 'Could not name the photo — use the product type you already sent.',
  },
  zh: {
    name: '商品名',
    category: '分类',
    hint: '发布到 Facebook 或其他网站时复制上面两行。已确认的图片留在这段对话里。',
    fallback: '未能从照片起名 — 请用你已发送的商品类型。',
  },
  ja: {
    name: '商品名',
    category: 'カテゴリ',
    hint: 'Facebook や他サイトに投稿するとき、上の2行をコピーしてください。承認した画像はこのチャットに残ります。',
    fallback: '写真から名前を付けられませんでした — 送った商品タイプを使ってください。',
  },
  ko: {
    name: '상품명',
    category: '분류',
    hint: 'Facebook이나 다른 사이트에 올릴 때 위 두 줄을 복사하세요. 승인한 사진은 이 채팅에 남습니다.',
    fallback: '사진으로 이름을 짓지 못했습니다 — 보내신 상품 유형을 사용하세요.',
  },
}

/** Sau ảnh cuối: tên + loại để copy. Không ghi kho, không tạo danh mục shop. */
export async function appendCatalogPhotoPackReply(input: {
  userId: string
  briefNotes: Record<string, string>
  imageUrl: string
  locale: WebLocale
  reply: string
}): Promise<string> {
  const labels = PACK_LABELS[input.locale] ?? PACK_LABELS.vi
  const payload = catalogPhotoPayloadFromBrief(input.briefNotes)
  let name = payload.productName
  const imageUrl = input.imageUrl.trim()
  if (imageUrl) {
    const named = await nameProductFromReferenceImage(input.userId, imageUrl, payload, input.locale)
    if (named?.name?.trim()) name = named.name.trim()
  }
  if (!name) name = labels.fallback
  const proposed = await proposeProductStudioCategoryPath(payload, name, []).catch(() => null)
  const category = [proposed?.l1?.name, proposed?.l2?.name, proposed?.l3?.name].filter(Boolean).join(' / ')
  const lines = [`**${labels.name}:** ${name}`]
  if (category) lines.push(`**${labels.category}:** ${category}`)
  lines.push('', labels.hint)
  return `${input.reply}\n\n${lines.join('\n')}`
}
