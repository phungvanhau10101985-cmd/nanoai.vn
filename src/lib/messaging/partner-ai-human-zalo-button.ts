/** Tin shop kèm nút mở thẳng Zalo cá nhân. Không import mail hay DB — file này chạy trên trình duyệt. */
export const HUMAN_ZALO_HANDOFF_SOURCE = 'human_zalo_handoff'

export type HumanZaloOpenButton = {
  href: string
  buttonLabel: string
}

export function humanZaloButtonFromPayload(raw: unknown): HumanZaloOpenButton | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (String(record.source ?? '') !== HUMAN_ZALO_HANDOFF_SOURCE) return null
  const block = record.zalo_personal_open
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null
  const row = block as Record<string, unknown>
  const href = String(row.href ?? '').trim()
  const buttonLabel = String(row.button_label ?? row.buttonLabel ?? '').trim()
  if (!/^https:\/\/zalo\.me\/\d{9,20}\/?$/i.test(href) || !buttonLabel) return null
  return { href, buttonLabel }
}
