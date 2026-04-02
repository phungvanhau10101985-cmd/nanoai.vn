/**
 * Slug không mở trang guest /api/messaging/guest (vd. inbox nội bộ nền tảng).
 */
/** Tránh trùng đường dẫn với hub `/messaging/my-chats` (slug shop không nên là my-chats). */
export const RESERVED_MESSAGING_GUEST_SLUGS = new Set(['nanoai', 'my-chats'])

export function isReservedMessagingGuestSlug(slug: string): boolean {
  return RESERVED_MESSAGING_GUEST_SLUGS.has(slug)
}
