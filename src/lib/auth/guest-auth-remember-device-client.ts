/** Tuỳ chọn «Giữ đăng nhập» — dùng chung NanoAI, chat widget, web shop. */
export const GUEST_AUTH_REMEMBER_DEVICE_STORAGE_KEY = 'app_guest_auth_remember_device'

export function readGuestAuthRememberDevicePreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(GUEST_AUTH_REMEMBER_DEVICE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

export function writeGuestAuthRememberDevicePreference(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GUEST_AUTH_REMEMBER_DEVICE_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}
