/**
 * Hằng số Vision (Vertex AI Vision Warehouse) — không import server/Node-only để dùng được từ Client Components.
 */

export const VISION_PRODUCT_CATEGORIES = [
  'general-v1',
  'apparel-v2',
  'homegoods-v2',
  'toys-v2',
  'packagedgoods-v1',
] as const

export type VisionProductCategory = (typeof VISION_PRODUCT_CATEGORIES)[number]

/**
 * Vùng Image Warehouse (Vertex AI Vision): chỉ us-central1 và europe-west4.
 * @see https://cloud.google.com/vision-ai/docs/warehouse-supported-regions
 */
export const VISION_LOCATIONS = ['us-central1', 'europe-west4'] as const

export type VisionGcpLocation = (typeof VISION_LOCATIONS)[number]

/** Chuẩn hóa location (legacy Product Search / GCP khác → Warehouse). */
export function normalizeVisionProductSearchLocation(raw: string | null | undefined): VisionGcpLocation {
  const t = (raw ?? '').trim() || 'us-central1'
  if (t === 'europe-west4') return 'europe-west4'
  if (t === 'us-central1') return 'us-central1'
  if (t === 'europe-west1') return 'europe-west4'
  return 'us-central1'
}

/**
 * Legacy export — từng dùng cho full-replace sync.
 * Đồng bộ mới dùng VISION_INCREMENTAL_* bên dưới.
 */
export const VISION_CATALOG_SYNC_MAX_ITEMS = 400

/**
 * Số dòng tối đa mỗi lô import JSONL lên Warehouse trong một request.
 * Lô quá lớn khiến thao tác `assets:import` trên Google chạy lâu, dễ vượt timeout poll.
 */
export const VISION_INCREMENTAL_BATCH_SIZE = 50

/**
 * Chờ operation Vision Warehouse `assets:import` (JSONL). Có thể tăng bằng env `VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS`.
 */
export const VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS = 600_000

/**
 * Nghỉ sau mỗi lô `assets:import` thành công (trước lô tiếp theo hoặc trước khi nhả khóa DB),
 * giúp Google giải phóng slot “1 op / corpus”. Có thể chỉnh bằng env.
 */
export const VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS = 5_000

/**
 * Tối đa số lần gọi `assets:import` liên tiếp trong một lượt `runVisionCatalogSync`.
 * Google chỉ cho **1** ImportAssets đồng thời / corpus — sau khi poll xong, slot có thể chưa giải phóng ngay;
 * chạy nhiều lần liên tiếp trong cùng request dễ 429. Mặc định 1; có thể tăng bằng env (server-config).
 */
export const VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST = 1

/** Khi quét kho theo id, tối đa bao nhiêu dòng “bẩn” (import + xóa) xử lý mỗi POST. */
export const VISION_INCREMENTAL_MAX_DIRTY_PER_REQUEST =
  VISION_INCREMENTAL_BATCH_SIZE * VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST

/** Số dòng inventory tải mỗi vòng khi quét theo cursor (id). */
export const VISION_INCREMENTAL_SCAN_PAGE = 500

/** Giới số vòng quét trong một POST (500 * 400 = 200k dòng tối đa). */
export const VISION_INCREMENTAL_MAX_SCAN_PAGES = 400

/**
 * Chuỗi đồng bộ tự động trên trình duyệt (tab Messaging → AI, `partner-ai-settings-panel`).
 * Mỗi POST `/vision-catalog-sync` xử lý tối đa khoảng {@link VISION_INCREMENTAL_MAX_DIRTY_PER_REQUEST} hàng
 * “bẩn” mỗi lượt. Hết “segment” (số lượt hoặc thời gian bên dưới) thì **tự mở segment mới** — không cần bấm nút,
 * cho đến khi `hasMore` false hoặc chạm {@link VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS}.
 */
/** Giới hạn một segment: số lượt POST liên tiếp trước khi nghỉ rồi tự tiếp tục. */
export const VISION_SYNC_CLIENT_CHAIN_MAX_ROUNDS = 200

/** Giới hạn một segment: thời gian (ms) trước khi tự mở segment tiếp. */
export const VISION_SYNC_CLIENT_CHAIN_MAX_MS = 3 * 60 * 60 * 1000

/**
 * Tổng số lượt POST tối đa cả chuỗi (mọi segment) — phòng lỗi logic / vòng lặp; vượt quá vẫn cần can thiệp.
 * 5000 × ~2400 dòng ≈ phạm vi rất lớn.
 */
export const VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS = 5000

/** Nghỉ giữa hai segment khi tự động nối tiếp (ms). */
export const VISION_SYNC_CLIENT_CHAIN_SEGMENT_BREAK_MS = 2500

/**
 * Nghỉ giữa hai lượt POST liên tiếp — giảm burst, ổn định hơn với Vision/GCS và tab trình duyệt.
 */
export const VISION_SYNC_CLIENT_CHAIN_PAUSE_MS = 800

/**
 * Timeout một lượt fetch client (ms). Route server `maxDuration` 300s; thêm dư để tránh cắt sớm / treo vô hạn.
 */
export const VISION_SYNC_CLIENT_FETCH_TIMEOUT_MS = 330_000

/**
 * Chuỗi lưu trong `vision_bg_sync_report` (JSON) từ cron nền — Client map sang i18n qua `partnerMessagingAi`.
 * Đổi giá trị ở đây thì cập nhật map trong `partner-ai-settings-panel.tsx`.
 */
export const VISION_BG_SYNC_REPORT_MESSAGE = {
  completed: 'Catalog sync finished.',
  inProgress: 'In progress — cron will continue.',
  badCursor: 'Sync stopped: inconsistent cursor from server.',
} as const

/** Khớp `vision_bg_sync_error` khi có backlog nhưng thiếu cursor (cron). */
export const VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR = 'hasMore without lastScannedId' as const

/**
 * Giá trị lưu trong `vision_index_error` khi đã import/xóa trên Warehouse nhưng chờ cron
 * analyze + rebuild index. UI map sang `partnerMessagingAi.visionWarehouseReindexPending`.
 */
export const VISION_WAREHOUSE_REINDEX_PENDING_CODE = 'VISION_WAREHOUSE_REINDEX_PENDING' as const

/**
 * Lưu trong `vision_index_error` khi Google trả CORPUS_UNSUPPORTED_TYPE — corpus không phải Image (IMAGE) Warehouse.
 * UI map sang `partnerMessagingAi.visionWarehouseCorpusUnsupportedType`.
 */
export const VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE = 'VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE' as const

/** Phản hồi API assets:import / analyze khi corpus sai loại (video, legacy, v.v.). */
export function isVisionWarehouseCorpusUnsupportedTypeApiMessage(message: string): boolean {
  const m = message ?? ''
  if (!m) return false
  return m.includes('CORPUS_UNSUPPORTED_TYPE') || /not supported in this corpus/i.test(m)
}

/**
 * Chỉ bắt lỗi **legacy Vision Product Search** (Google bảo trì / hướng dẫn chuyển Warehouse).
 * Không dùng chữ "vision warehouse" đơn độc — tránh nhầm với lỗi cron/Warehouse của app (vd. "Vision Warehouse cron: ...").
 */
export function isVisionProductSearchMaintenanceError(message: string): boolean {
  const m = (message ?? '').toLowerCase()
  if (!m) return false
  if (!m.includes('product search')) return false
  return (
    m.includes('maintenance') ||
    m.includes('restricted') ||
    m.includes('deprecated') ||
    m.includes('not available') ||
    m.includes('no longer') ||
    m.includes('please use vision warehouse') ||
    m.includes('use vision warehouse instead') ||
    m.includes('sunset')
  )
}

/** Timeout một lần gọi Vision search trong request widget (tránh treo HTTP). */
export const VISION_SEARCH_REQUEST_TIMEOUT_MS = 12_000

/**
 * Khi Vision không có ứng viên: hẹn job AI ngay (0s) — fallback giống tin chỉ chữ,
 * không chờ reply_delay shop. Cron/INLINE_WAKE vẫn quyết định thời điểm chạy thực tế.
 */
export const VISION_MISS_AI_REPLY_DELAY_CAP_SECONDS = 0

/**
 * CDN thường dùng URL protocol-relative `//host/...` — coi như https cho Vision sync & fingerprint.
 * Dùng chung server + client (thống kê UI).
 */
export function normalizeVisionCatalogImageUrl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (t.startsWith('//')) return `https:${t}`
  return t
}

/** Ảnh có thể đưa lên Vision (sau chuẩn hoá có tiền tố http/https). */
export function isVisionCatalogImageUrlSyncable(raw: string | null | undefined): boolean {
  const n = normalizeVisionCatalogImageUrl(raw)
  return !!(n && /^https?:\/\//i.test(n))
}
