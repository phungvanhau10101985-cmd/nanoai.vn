/** Viết hoa chữ cái đầu mỗi tiếng trong tên riêng. «nguyễn châm» → «Nguyễn Châm». */
export function capitalizeInvitationPersonName(value: string): string {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed
    .split(/([\s\-'])/)
    .map((part) => {
      if (!part || /[\s\-']/.test(part)) return part
      const chars = Array.from(part)
      const first = chars[0].toLocaleUpperCase('vi-VN')
      const rest = chars.slice(1).join('').toLocaleLowerCase('vi-VN')
      return first + rest
    })
    .join('')
}
