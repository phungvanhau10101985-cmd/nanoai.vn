/** Chuẩn hóa / kiểm tra ISBN-10 / ISBN-13 (dùng chung API + server actions + client). */

export function normalizeBookIsbn(raw: string | undefined | null): string {
  return String(raw || '')
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase()
    .trim()
}

export function isValidBookIsbn(isbn: string): boolean {
  return /^[0-9]{9}[0-9X]$/.test(isbn) || /^[0-9]{13}$/.test(isbn)
}
