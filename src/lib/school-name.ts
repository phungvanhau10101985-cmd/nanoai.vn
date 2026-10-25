const GENERIC_SCHOOL_TOKENS = new Set([
  'truong', 'hoc', 'tieu', 'th', 'thcs', 'thpt', 'dai', 'cao', 'cap', 'co', 'so',
  'lien', 'quan', 'huyen', 'xa', 'phuong', 'thi', 'tp', 'thanh', 'pho', '3', '2', '1',
])

export function normalizeSchoolName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTokens(input: string): string[] {
  return normalizeSchoolName(input)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
}

export function toSearchTokens(input: string): string[] {
  const tokens = toTokens(input)
  const filtered = tokens.filter((token) => token.length >= 2 && !GENERIC_SCHOOL_TOKENS.has(token))
  return filtered.length > 0 ? filtered : tokens.filter((token) => token.length >= 2)
}

export function cleanSchoolLabel(input: string): string {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-(),./:&]/gu, '')
    .trim()
}

export function ensureSchoolPrefix(input: string): string {
  const cleaned = cleanSchoolLabel(input)
  if (!cleaned) return ''
  const lower = cleaned.toLowerCase()
  if (lower.includes('truong') || lower.includes('trường')) return cleaned
  return `Trường ${cleaned}`.replace(/\s+/g, ' ').trim()
}

/** Tên đề xuất phải chứa cụm giáo viên gõ, không phân biệt dấu. */
export function schoolSuggestionContainsQuery(name: string, query: string): boolean {
  const normalizedName = normalizeSchoolName(name)
  const normalizedQuery = normalizeSchoolName(query)
  if (!normalizedName || !normalizedQuery) return false
  return normalizedName.includes(normalizedQuery)
}

/** Chưa đủ 2 trường, hoặc 1 trường nhưng không đúng cụm giáo viên gõ, thì vẫn cần đề xuất thêm. */
export function shouldSuggestMoreSchools(names: string[], query: string): boolean {
  const normalizedQuery = normalizeSchoolName(query)
  if (normalizedQuery.length < 3) return false
  if (names.length >= 2) return false
  if (names.length === 1 && normalizeSchoolName(names[0] ?? '') === normalizedQuery) return false
  return true
}

/** Đủ 7 giáo viên chọn một tên thì giữ tên đó và bỏ tên kia. */
export const SCHOOL_NAME_VOTE_THRESHOLD = 7

export function resolveSchoolNameVote(
  originalVotes: number,
  editedVotes: number,
  justChose: 'original' | 'edited'
): 'original' | 'edited' | null {
  if (justChose === 'original' && originalVotes >= SCHOOL_NAME_VOTE_THRESHOLD) return 'original'
  if (justChose === 'edited' && editedVotes >= SCHOOL_NAME_VOTE_THRESHOLD) return 'edited'
  return null
}

export function filterSchoolSuggestions(names: string[], query: string, limit = 4): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of names) {
    const name = cleanSchoolLabel(raw)
    if (name.length < 3 || !schoolSuggestionContainsQuery(name, query)) continue
    const key = normalizeSchoolName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    kept.push(name)
    if (kept.length >= limit) break
  }
  return kept
}
