import OpenCC from 'opencc-js'

let traditionalToSimplified: ((text: string) => string) | null = null

function converter(): (text: string) => string {
  if (!traditionalToSimplified) {
    traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })
  }
  return traditionalToSimplified
}

/** Buổi học tiếng Trung trong app này là zh-CN, trừ khi locale ghi rõ phồn thể. */
export function usesSimplifiedChinese(languageCode: string, locale = ''): boolean {
  const code = String(languageCode || '').trim().toLowerCase()
  const loc = String(locale || '').trim().toLowerCase()
  if (loc.startsWith('zh-tw') || loc.startsWith('zh-hk') || loc.includes('hant')) return false
  if (loc.startsWith('zh')) return true
  return code === 'zh' || code === 'zh-cn' || code === 'zh-hans'
}

export function toSimplifiedChinese(text: string): string {
  const value = String(text || '')
  if (!value || !/[\u4E00-\u9FFF]/u.test(value)) return value
  return converter()(value)
}

export function simplifyChineseDeep<T>(value: T): T {
  if (typeof value === 'string') return toSimplifiedChinese(value) as T
  if (Array.isArray(value)) return value.map((item) => simplifyChineseDeep(item)) as T
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = simplifyChineseDeep(item)
    }
    return next as T
  }
  return value
}
