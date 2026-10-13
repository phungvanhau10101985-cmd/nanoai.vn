/** Safari iOS: `TypeError: Load failed`. Chrome: `Failed to fetch`. Firefox: `NetworkError…`. */
const NETWORK_FAULT =
  /^(load failed|failed to fetch|networkerror(?: when attempting to fetch resource)?\.?|the network connection was lost|the internet connection appears to be offline|network request failed|cancelled|canceled|aborted|abort)$/i

export function isClientNetworkFaultMessage(message: string): boolean {
  const text = message.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 180) return false
  return NETWORK_FAULT.test(text)
}

export function isClientNetworkFault(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error && typeof error.name === 'string' ? error.name : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  if (name === 'AbortError') return true
  return isClientNetworkFaultMessage(message)
}
