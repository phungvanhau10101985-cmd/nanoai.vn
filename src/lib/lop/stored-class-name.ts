/** Chữ cái trong tên lớp lưu DB đều hoa. Số và khoảng trắng giữ nguyên. */
export function storedClassName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLocaleUpperCase('vi-VN')
}

/** Hoa chữ cái ngay trên ô gõ. Không cắt khoảng trắng cuối, để còn gõ tiếp. */
export function upperClassNameLetters(raw: string): string {
  return raw.toLocaleUpperCase('vi-VN')
}
