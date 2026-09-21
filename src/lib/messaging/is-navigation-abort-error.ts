/** `router.replace` / RSC refresh aborts Server Actions as AbortError or "Failed to fetch". */
export function isNavigationAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = 'message' in err ? String(err.message).toLowerCase() : ''
  return (
    name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('the user aborted') ||
    message.includes('failed to fetch')
  )
}
