/** Mã lỗi khi tắt công tắc tự tạo L1/L2/L3. */
export const CATEGORY_AUTO_CREATE_DISABLED = 'CATEGORY_AUTO_CREATE_DISABLED'

/**
 * Báo lỗi ngay cho merchant: không cào, không tạo SP mới, hướng dẫn bật lại công tắc.
 * Dùng được ở client (không import Postgres).
 */
export const CATEGORY_AUTO_CREATE_DISABLED_MESSAGE =
  'Đã tắt chế độ tự tạo danh mục cấp 1/2/3. Không cào 1688/Taobao/Tmall và không tạo sản phẩm mới. Muốn tiếp tục thì vào Quản trị → Danh mục, bật «Tự tạo danh mục khi cào / đăng sản phẩm».'
