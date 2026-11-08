/**
 * Mức hoàn thiện thiệp = 10 mục bằng nhau.
 * Cùng điều kiện dùng cho thống kê admin (SQL) và nhãn «thiếu».
 * Placeholder `card.` được đổi thành alias bảng khi dựng câu SQL.
 */

export const WEDDING_CARD_COMPLETION_CHECKS = [
  {
    key: 'names',
    sql: `nullif(btrim(card.groom_name), '') is not null and (
      card.occasion_key not in ('wedding', 'engagement', 'anniversary')
      or nullif(btrim(card.bride_name), '') is not null
    )`,
  },
  {
    key: 'date',
    sql: `card.wedding_date is not null
      or card.groom_invite_wedding_date is not null
      or card.bride_invite_wedding_date is not null`,
  },
  {
    key: 'time',
    sql: `nullif(btrim(card.wedding_time), '') is not null
      or nullif(btrim(card.party_start_time), '') is not null
      or nullif(btrim(card.groom_invite_reception_time), '') is not null
      or nullif(btrim(card.bride_invite_reception_time), '') is not null
      or nullif(btrim(card.groom_invite_party_start_time), '') is not null
      or nullif(btrim(card.bride_invite_party_start_time), '') is not null`,
  },
  {
    key: 'venue',
    sql: `nullif(btrim(card.venue), '') is not null
      or nullif(btrim(card.groom_invite_address), '') is not null
      or nullif(btrim(card.bride_invite_address), '') is not null`,
  },
  {
    key: 'invitation',
    sql: `nullif(btrim(card.invitation_text), '') is not null
      or nullif(btrim(card.groom_invite_text), '') is not null
      or nullif(btrim(card.bride_invite_text), '') is not null`,
  },
  {
    key: 'photo',
    sql: `card.master_image_id is not null
      or nullif(btrim(card.groom_image_url), '') is not null
      or nullif(btrim(card.bride_image_url), '') is not null
      or nullif(btrim(coalesce(card.section_config->>'coverPhotoUrl', '')), '') is not null`,
  },
  {
    key: 'music',
    sql: `nullif(btrim(card.music_url), '') is not null`,
  },
  {
    key: 'album',
    sql: `coalesce(cardinality(card.album_image_urls), 0) > 0`,
  },
  {
    key: 'closing',
    sql: `nullif(btrim(card.story_text), '') is not null
      or nullif(btrim(card.thank_you_text), '') is not null
      or nullif(btrim(card.couple_intro), '') is not null`,
  },
  {
    key: 'published',
    sql: `card.is_published`,
  },
] as const

export type WeddingCardCompletionKey = (typeof WEDDING_CARD_COMPLETION_CHECKS)[number]['key']

const CHECK_COUNT = WEDDING_CARD_COMPLETION_CHECKS.length

function scoped(sql: string, tableAlias: string): string {
  return sql.replaceAll('card.', `${tableAlias}.`)
}

/** Số mục đã có (0–10) trên một dòng `wedding_cards`. */
export function weddingCardCompletionScoreSql(tableAlias = 'c'): string {
  const parts = WEDDING_CARD_COMPLETION_CHECKS.map(
    (check) => `case when ${scoped(check.sql, tableAlias)} then 1 else 0 end`,
  )
  return `(${parts.join(' + ')})`
}

/** Mảng key còn thiếu. Phần trăm = (10 − số key) × 10. */
export function weddingCardCompletionMissingSql(tableAlias = 'c'): string {
  const parts = WEDDING_CARD_COMPLETION_CHECKS.map(
    (check) => `case when ${scoped(check.sql, tableAlias)} then null else '${check.key}' end`,
  )
  return `array_remove(array[${parts.join(', ')}]::text[], null)`
}

export function weddingCardCompletionPercent(doneCount: number): number {
  if (!Number.isFinite(doneCount)) return 0
  const done = Math.max(0, Math.min(CHECK_COUNT, doneCount))
  return Math.round((done / CHECK_COUNT) * 100)
}

export function isWeddingCardCompletionKey(value: string): value is WeddingCardCompletionKey {
  return WEDDING_CARD_COMPLETION_CHECKS.some((check) => check.key === value)
}
