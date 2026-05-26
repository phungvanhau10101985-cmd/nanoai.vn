/** Chuẩn hóa tin khách trước khi tìm kho / nhận diện ý định — an toàn dùng cả client lẫn server. */
export function normalizeCustomerMessageForInventorySearch(raw: string): string {
  return raw.replace(/^📷\s*/u, '').replace(/\s+/g, ' ').trim()
}
