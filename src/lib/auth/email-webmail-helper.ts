/**
 * Trợ giúp xác định URL webmail tương ứng (Gmail, Outlook, Yahoo...) để khách mở kiểm tra hộp thư nhanh.
 */
export function getWebmailInfo(email: string): { url: string; isGmail: boolean } {
  const em = email.trim().toLowerCase()
  if (em.endsWith('@gmail.com') || em.endsWith('@googlemail.com')) {
    return { url: 'https://mail.google.com/', isGmail: true }
  }
  if (em.endsWith('@outlook.com') || em.endsWith('@hotmail.com') || em.endsWith('@live.com')) {
    return { url: 'https://outlook.live.com/mail/', isGmail: false }
  }
  if (em.endsWith('@yahoo.com') || em.endsWith('@ymail.com')) {
    return { url: 'https://mail.yahoo.com/', isGmail: false }
  }
  // Mặc định khách hay dùng Gmail cho việc login OTP
  return { url: 'https://mail.google.com/', isGmail: false }
}
