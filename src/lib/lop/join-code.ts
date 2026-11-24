/** Mã lớp in trên bảng QR, học sinh gõ khi vào lớp. */
export function normalizeClassJoinCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}
