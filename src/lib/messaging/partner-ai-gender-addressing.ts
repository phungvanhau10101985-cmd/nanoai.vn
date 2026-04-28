import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'

function replaceStandaloneWord(text: string, fromWord: string, toWord: string): string {
  const re = new RegExp(`(^|[^\\p{L}])${fromWord}([^\\p{L}]|$)`, 'giu')
  return text.replace(re, (_m, left: string, right: string) => `${left}${toWord}${right}`)
}

/** Theo giới tính đã chọn của khách (nam → anh, nữ → chị). */
export function enforceConfiguredGenderAddressing(message: string, gender: GuestProfileGender | null): string {
  const body = message.trim()
  if (!body) return message
  if (gender !== 'male' && gender !== 'female') return message
  let out = body
  if (gender === 'male') {
    out = out.replace(/anh\s*\/\s*chị|chị\s*\/\s*anh/giu, 'anh')
    out = out.replace(/anh\s+chị|chị\s+anh/giu, 'anh')
    out = replaceStandaloneWord(out, 'chị', 'anh')
  } else {
    out = out.replace(/anh\s*\/\s*chị|chị\s*\/\s*anh/giu, 'chị')
    out = out.replace(/anh\s+chị|chị\s+anh/giu, 'chị')
    out = replaceStandaloneWord(out, 'anh', 'chị')
  }
  return out
}
