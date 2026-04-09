/**
 * Trên client: user id từ GET /api/auth/me (JWT httpOnly).
 */
export async function getClientUserId(): Promise<string | null> {
  try {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (me.ok) {
      const j = (await me.json()) as { user?: { id: string } | null }
      if (j.user?.id) return j.user.id
    }
  } catch {
    /* ignore */
  }
  return null
}
