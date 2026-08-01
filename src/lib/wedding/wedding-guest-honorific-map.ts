import type { GuestInviteSide } from '@/lib/wedding/wedding-guest-invite-location'

export type HonorificCategory =
  | 'parent'
  | 'elder'
  | 'older_sibling'
  | 'younger'
  | 'peer'

export type HostReferenceStyle = {
  category: HonorificCategory
  pronoun: string
  useGivenName: boolean
  includeFamily: boolean
  includeSpouse: boolean
}

/** Gợi ý xưng hô khách — hiển thị trên form nhập liệu. */
export const WEDDING_GUEST_HONORIFIC_SUGGESTIONS = [
  'Ba',
  'Mẹ',
  'Bố',
  'Chú',
  'Bác',
  'Cô',
  'Dì',
  'Cậu',
  'Mợ',
  'Thím',
  'Dượng',
  'Ông',
  'Bà',
  'Cụ',
  'Ông nội',
  'Bà nội',
  'Ông ngoại',
  'Bà ngoại',
  'Thầy',
  'Cô giáo',
  'Anh',
  'Chị',
  'Anh rể',
  'Chị dâu',
  'Em',
  'Em trai',
  'Em gái',
  'Bạn',
] as const

const PHRASE_TO_CATEGORY: ReadonlyArray<readonly [string, HonorificCategory]> = [
  ['ông nội', 'elder'],
  ['bà nội', 'elder'],
  ['ông ngoại', 'elder'],
  ['bà ngoại', 'elder'],
  ['cụ nội', 'elder'],
  ['cụ ngoại', 'elder'],
  ['cô giáo', 'elder'],
  ['bố mẹ', 'parent'],
  ['anh rể', 'older_sibling'],
  ['chị dâu', 'older_sibling'],
  ['em trai', 'younger'],
  ['em gái', 'younger'],
  ['em rể', 'younger'],
  ['em dâu', 'younger'],
  ['giám đốc', 'older_sibling'],
]

const WORD_TO_CATEGORY: Readonly<Record<string, HonorificCategory>> = {
  bố: 'parent',
  ba: 'parent',
  cha: 'parent',
  mẹ: 'parent',
  ma: 'parent',
  má: 'parent',
  chú: 'elder',
  cô: 'elder',
  bác: 'elder',
  dì: 'elder',
  ông: 'elder',
  bà: 'elder',
  cụ: 'elder',
  cậu: 'elder',
  mợ: 'elder',
  thím: 'elder',
  dượng: 'elder',
  thầy: 'elder',
  anh: 'older_sibling',
  chị: 'older_sibling',
  em: 'younger',
  bạn: 'peer',
  ngài: 'elder',
  sếp: 'older_sibling',
}

/** Bỏ tiền tố «Quý» — lời mời thân mật, không dùng quý anh/quý chị… */
export function stripQuyHonorificPrefix(honorific: string): string {
  return honorific.trim().replace(/^quý\s+/iu, '')
}

export function normalizeHonorificText(honorific: string): string {
  return stripQuyHonorificPrefix(honorific).toLocaleLowerCase('vi').replace(/\s+/g, ' ')
}

/** Phân loại xưng hô khách (ưu tiên cụm dài: «Ông nội», «Anh rể»…). */
export function classifyGuestHonorific(honorific: string): HonorificCategory {
  const normalized = normalizeHonorificText(honorific)
  if (!normalized) return 'elder'

  for (const [phrase, category] of PHRASE_TO_CATEGORY) {
    if (normalized === phrase || normalized.startsWith(`${phrase} `)) return category
  }

  const firstWord = normalized.split(' ')[0] ?? ''
  return WORD_TO_CATEGORY[firstWord] ?? 'elder'
}

export function resolveHostReferenceStyle(
  guestHonorific: string,
  side: GuestInviteSide,
): HostReferenceStyle {
  const category = classifyGuestHonorific(guestHonorific)

  switch (category) {
    case 'parent':
      return {
        category,
        pronoun: 'Con',
        useGivenName: true,
        includeFamily: false,
        includeSpouse: true,
      }
    case 'peer':
      return {
        category,
        pronoun: 'Bạn',
        useGivenName: true,
        includeFamily: false,
        includeSpouse: false,
      }
    case 'younger':
      return {
        category,
        pronoun: side === 'bride' ? 'Chị' : 'Anh',
        useGivenName: true,
        includeFamily: false,
        includeSpouse: false,
      }
    case 'older_sibling':
      return {
        category,
        pronoun: 'Em',
        useGivenName: false,
        includeFamily: true,
        includeSpouse: false,
      }
    case 'elder':
    default:
      return {
        category,
        pronoun: 'Cháu',
        useGivenName: false,
        includeFamily: true,
        includeSpouse: false,
      }
  }
}
