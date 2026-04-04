/**
 * Hằng số Vision Product Search — không import server/Node-only để dùng được từ Client Components.
 */

export const VISION_PRODUCT_CATEGORIES = [
  'general-v1',
  'apparel-v2',
  'homegoods-v2',
  'toys-v2',
  'packagedgoods-v1',
] as const

export type VisionProductCategory = (typeof VISION_PRODUCT_CATEGORIES)[number]

export const VISION_LOCATIONS = ['us-east1', 'europe-west1', 'asia-east1', 'asia-southeast1'] as const

/**
 * Legacy export — từng dùng cho full-replace sync.
 * Đồng bộ mới dùng VISION_INCREMENTAL_* bên dưới.
 */
export const VISION_CATALOG_SYNC_MAX_ITEMS = 400

/** Số dòng CSV (sản phẩm) mỗi lần gọi productSets:import trong một request HTTP. */
export const VISION_INCREMENTAL_BATCH_SIZE = 200

/** Tối đa số lần import liên tiếp trong một POST (tránh timeout). */
export const VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST = 12

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
