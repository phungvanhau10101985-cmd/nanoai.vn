/**
 * Khóa map nội bộ (NanoAI / Open Catalog) ↔ đường dẫn trường JSON phía web khách (dot notation).
 * Giá trị mặc định phù hợp API kiểu 188 GET /api/v1/products/.
 */

export const INVENTORY_EXTERNAL_SYNC_MAP_KEYS = [
  'sku',
  'remarketing_id',
  'name',
  'description',
  'price',
  'stock_qty',
  'stock_note',
  /** JSON mảng [{ name, img }] — trên NanoAI thường ghi vào cột tồn/ghi chú (stock_note) khi đồng bộ. */
  'colors_json',
  'image',
  'slug',
  'video',
  'consult_note',
  'sort_order',
  'is_active',
] as const

export type InventoryExternalSyncMapKey = (typeof INVENTORY_EXTERNAL_SYNC_MAP_KEYS)[number]

/**
 * Trường map nội bộ được đưa vào đồng bộ vector kho (Gemini → pgvector):
 * - `image`: embed ảnh từ `image_url`
 * - `text`: ghép vào chuỗi embed văn bản (`name` + `price_hint` + `consult_note` sau khi đồng bộ kho)
 */
export const INVENTORY_EXTERNAL_SYNC_VECTOR_ROLE: Record<
  InventoryExternalSyncMapKey,
  'image' | 'text' | null
> = {
  sku: null,
  remarketing_id: null,
  name: 'text',
  description: null,
  price: 'text',
  stock_qty: null,
  stock_note: null,
  colors_json: null,
  image: 'image',
  slug: null,
  video: null,
  consult_note: 'text',
  sort_order: null,
  is_active: null,
}

/** Preset đường dẫn trường phía khách (REST product object). */
export const DEFAULT_188_INVENTORY_FIELD_MAPPING: Record<InventoryExternalSyncMapKey, string> = {
  sku: 'code',
  remarketing_id: 'product_id',
  name: 'name',
  description: 'description',
  price: 'price',
  stock_qty: 'available',
  stock_note: 'sizes',
  colors_json: 'colors',
  image: 'main_image',
  slug: 'slug',
  video: 'video_link',
  consult_note: 'product_info',
  sort_order: 'id',
  is_active: 'is_active',
}

/**
 * Giá trị mẫu cố định (API kiểu 188 GET /api/v1/products/) — hiển thị trên UI bảng khớp;
 * web khách cần trả đúng kiểu/shape tại trường JSON đã map, không phải copy nguyên văn.
 */
export const EXTERNAL_SYNC_FIELD_SAMPLE_188: Record<InventoryExternalSyncMapKey, string> = {
  sku: 'B3630',
  remarketing_id: 'A976167321349a188b3630',
  name: 'Giày Chelsea Boot Nam Da Mờ…',
  description: 'Đoạn mô tả sản phẩm (string, có thể dài, có "|" nối ý).',
  price: '1120000',
  stock_qty: '500',
  stock_note: '["37","38","39",…]',
  colors_json: '[{"name":"Đen","img":"https://img.alicdn.com/…jpg"}]',
  image: 'https://img.alicdn.com/…jpg',
  slug: 'https://188.com.vn/products/giay-…-a976167321349a188b3630',
  video: 'https://www.youtube.com/embed/Phx1BGK1Al8',
  consult_note: '{"product_info":{"sku":"B3630"}}',
  sort_order: '1',
  is_active: 'true',
}

export function normalizeExternalFieldMapping(raw: unknown): Record<string, string> {
  const allowed = new Set<string>(INVENTORY_EXTERNAL_SYNC_MAP_KEYS as unknown as string[])
  const cleaned: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    for (const k of allowed) {
      const v = o[k]
      if (v == null) continue
      const s = String(v).trim()
      if (!s) continue
      if (!/^[\w.[\]-]+$/.test(s) || s.length > 160) continue
      cleaned[k] = s
    }
  }
  return { ...DEFAULT_188_INVENTORY_FIELD_MAPPING, ...cleaned }
}
