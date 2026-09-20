/** Mã lỗi khi tắt công tắc tự tạo L1/L2/L3. */
export const CATEGORY_AUTO_CREATE_DISABLED = 'CATEGORY_AUTO_CREATE_DISABLED'

/**
 * Báo khi tắt tự tạo **và** sản phẩm không khớp nhánh đã có trên cây.
 * Cào/đăng vẫn chạy nếu danh mục đã import. Dùng được ở client (không import Postgres).
 */
export const CATEGORY_AUTO_CREATE_DISABLED_MESSAGE =
  'Đã tắt chế độ tự tạo danh mục cấp 1/2/3. Cào/đăng vẫn dùng nhánh đã có trên cây. Sản phẩm này chưa khớp danh mục đã import. Muốn tự tạo nhánh mới thì vào Quản trị → Danh mục, bật «Tự tạo danh mục khi cào / đăng sản phẩm».'
