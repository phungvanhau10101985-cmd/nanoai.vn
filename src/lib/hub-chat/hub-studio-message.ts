/** Studio chat accepts short replies like dimension option numbers `1`–`9`. */
export function isValidHubStudioMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (trimmed.length >= 2) return true
  return /^[#]?[1-9]$/.test(trimmed)
}
