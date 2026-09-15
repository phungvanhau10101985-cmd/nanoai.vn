import type { WebLocale } from '@/lib/i18n/config'

export const PARTNER_AFFILIATE_REF_COOKIE = 'pw_affiliate_ref'
export const PARTNER_AFFILIATE_ATTR_DONE_KEY = 'pw_affiliate_attr_done'

export type PartnerAffiliateApplicationStatus = 'pending' | 'approved' | 'rejected'

export type PartnerSiteAffiliateMeView = {
  affiliate_enabled: boolean
  affiliate_status: 'none' | PartnerAffiliateApplicationStatus
  referral_code: string
  referral_link: string
  commission_percent: number
  min_withdrawal: number
  commission_policy: string | null
  balance: number
  pending_balance: number
  bank_account: {
    bank_name: string
    bank_account: string
    account_holder: string
  } | null
}

export type PartnerAffiliateCommissionStatus = 'pending' | 'confirmed' | 'cancelled' | 'awaiting_deposit'

export function partnerAffiliateCookieName(siteSlug: string): string {
  const slug = siteSlug.trim().toLowerCase()
  return slug ? `${PARTNER_AFFILIATE_REF_COOKIE}:${slug}` : PARTNER_AFFILIATE_REF_COOKIE
}

export function partnerAffiliateAttrDoneKey(siteSlug: string): string {
  const slug = siteSlug.trim().toLowerCase()
  return slug ? `${PARTNER_AFFILIATE_ATTR_DONE_KEY}:${slug}` : PARTNER_AFFILIATE_ATTR_DONE_KEY
}

export function normalizeAffiliateReferralCode(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
}

export function readReferralCodeFromSearch(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search
  try {
    const params = new URLSearchParams(raw)
    return normalizeAffiliateReferralCode(params.get('ref') || params.get('affiliate') || '')
  } catch {
    return ''
  }
}

export function appendReferralToUrl(url: string, referralCode: string, origin?: string): string {
  const code = normalizeAffiliateReferralCode(referralCode)
  const trimmed = (url || '').trim()
  if (!code || !trimmed) return trimmed
  const base = (origin || '').replace(/\/$/, '') || 'https://example.invalid'
  try {
    const parsed =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? new URL(trimmed)
        : new URL(trimmed, `${base}/`)
    parsed.searchParams.set('ref', code)
    return parsed.toString()
  } catch {
    const joiner = trimmed.includes('?') ? '&' : '?'
    return `${trimmed}${joiner}ref=${encodeURIComponent(code)}`
  }
}

export function captureReferralCookieMaxAgeSeconds(days: number): number {
  const n = Math.max(1, Math.min(365, Math.round(Number(days) || 30)))
  return n * 86400
}

export function persistAffiliateReferralCookie(siteSlug: string, code: string, maxAgeDays = 30): void {
  if (typeof document === 'undefined') return
  const normalized = normalizeAffiliateReferralCode(code)
  if (!normalized) return
  document.cookie = `${partnerAffiliateCookieName(siteSlug)}=${encodeURIComponent(normalized)}; path=/; max-age=${captureReferralCookieMaxAgeSeconds(maxAgeDays)}; SameSite=Lax`
}

export function clearStoredAffiliateReferralCookie(siteSlug: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${partnerAffiliateCookieName(siteSlug)}=; path=/; max-age=0; SameSite=Lax`
}

export function readStoredAffiliateReferralCode(siteSlug: string): string {
  if (typeof document === 'undefined') return ''
  const name = partnerAffiliateCookieName(siteSlug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  if (!match) return ''
  try {
    return normalizeAffiliateReferralCode(decodeURIComponent(match[1] || ''))
  } catch {
    return ''
  }
}

function affiliateCaptureHasAccount(authHeaders?: Record<string, string>): boolean {
  if (!authHeaders) return false
  return Object.keys(authHeaders).some((key) => /account/i.test(key) && Boolean(authHeaders[key]?.trim()))
}

/** Cookie from `?ref=` always. POST first-touch only after login, like 188 AppShell. */
export function capturePartnerAffiliateReferralOnClient(input: {
  siteSlug: string
  authHeaders?: Record<string, string>
  maxAgeDays?: number
}): void {
  if (typeof window === 'undefined') return
  const fromUrl = readReferralCodeFromSearch(window.location.search)
  if (fromUrl) persistAffiliateReferralCookie(input.siteSlug, fromUrl, input.maxAgeDays)
  const code = fromUrl || readStoredAffiliateReferralCode(input.siteSlug)
  if (!code) return
  if (!affiliateCaptureHasAccount(input.authHeaders)) return
  const doneKey = partnerAffiliateAttrDoneKey(input.siteSlug)
  try {
    if (sessionStorage.getItem(doneKey) === '1') return
  } catch {
    /* continue */
  }
  void fetch(`/api/site/${encodeURIComponent(input.siteSlug.trim())}/affiliate`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(input.authHeaders || {}) },
    body: JSON.stringify({ referralCode: code }),
  })
    .then((res) => {
      if (!res.ok) return
      clearStoredAffiliateReferralCookie(input.siteSlug)
      try {
        sessionStorage.setItem(doneKey, '1')
      } catch {
        /* noop */
      }
    })
    .catch(() => {})
}

/** 188: first-touch on profile, then checkout `?ref=` / cookie last-touch wins. */
export function pickAffiliateReferrerProfileId(input: {
  buyerProfileId?: string | null
  firstTouchProfileId?: string | null
  lastTouchFromCode?: string | null
  lastTouchFromVisit?: string | null
}): string | null {
  const buyer = String(input.buyerProfileId || '').trim()
  let referrer = String(input.firstTouchProfileId || '').trim() || null
  const fromCode = String(input.lastTouchFromCode || '').trim() || null
  const fromVisit = String(input.lastTouchFromVisit || '').trim() || null
  if (fromCode) referrer = fromCode
  else if (!referrer) referrer = fromVisit
  if (!referrer || (buyer && referrer === buyer)) return null
  return referrer
}

export function partnerAffiliateShareHrefs(link: string): { facebook: string; zalo: string; telegram: string } {
  const encoded = encodeURIComponent(link.trim())
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    zalo: `https://zalo.me/share?url=${encoded}`,
    telegram: `https://t.me/share/url?url=${encoded}`,
  }
}

export function affiliateCommissionBase(input: {
  amountAfterDiscount: number
  walletAmountUsed?: number
}): number {
  const base = Math.max(0, Math.round(Number(input.amountAfterDiscount) || 0))
  const wallet = Math.max(0, Math.round(Number(input.walletAmountUsed) || 0))
  return Math.max(0, base - wallet)
}

export function affiliateCommissionAmount(base: number, percent: number): number {
  const b = Math.max(0, Math.round(Number(base) || 0))
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  if (b <= 0 || p <= 0) return 0
  return Math.max(0, Math.round((b * p) / 100))
}

export function applyAffiliateWalletToPayable(input: {
  amountAfterDiscount: number
  shippingFeeAmount: number
  requiredAmount: number
  walletBalance: number
  requestedAmount: number
}): {
  walletUsed: number
  amountAfterDiscount: number
  shippingFeeAmount: number
  requiredAmount: number
  payableTotal: number
} {
  const merchandise = Math.max(0, Math.round(Number(input.amountAfterDiscount) || 0))
  const shipping = Math.max(0, Math.round(Number(input.shippingFeeAmount) || 0))
  const oldPayable = merchandise + shipping
  const oldRequired = Math.max(0, Math.round(Number(input.requiredAmount) || 0))
  const available = Math.max(0, Math.round(Number(input.walletBalance) || 0))
  const requested = Math.max(0, Math.round(Number(input.requestedAmount) || 0))
  const walletUsed = Math.min(requested, available, oldPayable)
  const payableTotal = Math.max(0, oldPayable - walletUsed)
  let requiredAmount = oldRequired
  if (oldRequired > 0 && oldPayable > 0) {
    requiredAmount = Math.round((oldRequired * payableTotal) / oldPayable)
    requiredAmount = Math.max(0, Math.min(oldRequired, payableTotal, requiredAmount))
  } else if (oldRequired > 0) {
    requiredAmount = Math.min(oldRequired, payableTotal)
  }
  return {
    walletUsed,
    amountAfterDiscount: merchandise,
    shippingFeeAmount: shipping,
    requiredAmount,
    payableTotal,
  }
}

/** Split VN/TQ: apply remaining wallet to each plan in order, like 188 sequential spend. */
export function applyAffiliateWalletToSplitPlans(input: {
  plans: Array<{
    amountAfterDiscount: number
    shippingFeeAmount: number
    requiredAmount: number
  }>
  walletBalance: number
  requestedAmount: number
}): {
  walletUsed: number
  requiredAmount: number
  payableTotal: number
  plans: Array<{
    walletUsed: number
    amountAfterDiscount: number
    shippingFeeAmount: number
    requiredAmount: number
    payableTotal: number
  }>
} {
  let remaining = Math.min(
    Math.max(0, Math.round(Number(input.walletBalance) || 0)),
    Math.max(0, Math.round(Number(input.requestedAmount) || 0))
  )
  const plans = input.plans.map((plan) => {
    const applied = applyAffiliateWalletToPayable({
      amountAfterDiscount: plan.amountAfterDiscount,
      shippingFeeAmount: plan.shippingFeeAmount,
      requiredAmount: plan.requiredAmount,
      walletBalance: remaining,
      requestedAmount: remaining,
    })
    remaining -= applied.walletUsed
    return applied
  })
  return {
    walletUsed: plans.reduce((sum, plan) => sum + plan.walletUsed, 0),
    requiredAmount: plans.reduce((sum, plan) => sum + plan.requiredAmount, 0),
    payableTotal: plans.reduce((sum, plan) => sum + plan.payableTotal, 0),
    plans,
  }
}

export function shouldGrantAffiliateCommissionOnCheckout(input: {
  requiredAmount: number
  paidAmount?: number
}): boolean {
  const required = Math.max(0, Math.round(Number(input.requiredAmount) || 0))
  if (required <= 0) return true
  const paid = Math.max(0, Math.round(Number(input.paidAmount) || 0))
  return paid >= required
}

export function normalizePartnerSiteAffiliateTab(tab: string): 'affiliate' | 'affiliate-bank' | null {
  const n = tab.trim().toLowerCase()
  if (
    n === 'affiliate' ||
    n === 'vi-dien-tu' ||
    n === 'vi-affiliate' ||
    n === 'ctv'
  ) {
    return 'affiliate'
  }
  if (
    n === 'affiliate-bank' ||
    n === 'tai-khoan-ngan-hang' ||
    n === 'bank-account'
  ) {
    return 'affiliate-bank'
  }
  return null
}

export function mapAffiliateCommissionUiStatus(input: {
  commissionStatus?: string | null
  orderStatus?: string | null
  shippingStatus?: string | null
  requiredAmount?: number
  paidAmount?: number
}): PartnerAffiliateCommissionStatus {
  const comm = String(input.commissionStatus || '').trim().toLowerCase()
  const order = String(input.orderStatus || '').trim().toLowerCase()
  const ship = String(input.shippingStatus || '').trim().toLowerCase()
  if (comm === 'cancelled' || comm === 'reversed' || order === 'cancelled' || ship === 'returned') {
    return 'cancelled'
  }
  if (comm === 'confirmed' && (ship === 'delivered' || ship === 'completed')) return 'confirmed'
  if (comm === 'confirmed') return 'confirmed'
  const required = Math.max(0, Math.round(Number(input.requiredAmount) || 0))
  const paid = Math.max(0, Math.round(Number(input.paidAmount) || 0))
  if (!comm && required > 0 && paid < required && order === 'awaiting_payment') return 'awaiting_deposit'
  return 'pending'
}

export function affiliateCommissionStatusLabel(
  locale: WebLocale,
  status: PartnerAffiliateCommissionStatus,
  shippingStatus?: string | null
): string {
  const ship = String(shippingStatus || '').trim().toLowerCase()
  if (status === 'cancelled' && ship === 'returned') {
    if (locale === 'en') return 'Cancelled — returned'
    if (locale === 'zh') return '已取消 — 退货'
    if (locale === 'ja') return '取消 — 返品'
    if (locale === 'ko') return '취소 — 반품'
    return 'Hủy — đơn hoàn'
  }
  const map: Record<WebLocale, Record<PartnerAffiliateCommissionStatus, string>> = {
    vi: {
      pending: 'Chờ giao hàng',
      confirmed: 'Đã cộng — rút được',
      cancelled: 'Đã hủy',
      awaiting_deposit: 'Chờ khách đặt cọc',
    },
    en: {
      pending: 'Awaiting delivery',
      confirmed: 'Credited — withdrawable',
      cancelled: 'Cancelled',
      awaiting_deposit: 'Awaiting deposit',
    },
    zh: {
      pending: '待发货',
      confirmed: '已入账 — 可提现',
      cancelled: '已取消',
      awaiting_deposit: '待客户订金',
    },
    ja: {
      pending: '配送待ち',
      confirmed: '加算済み — 出金可',
      cancelled: '取消',
      awaiting_deposit: 'デポジット待ち',
    },
    ko: {
      pending: '배송 대기',
      confirmed: '적립됨 — 출금 가능',
      cancelled: '취소됨',
      awaiting_deposit: '보증금 대기',
    },
  }
  return (map[locale] ?? map.en)[status]
}

export function maskAffiliateBuyerLabel(input: { phone?: string | null; orderCode?: string | null }): string {
  const phone = String(input.phone || '').replace(/\D/g, '')
  if (phone.length >= 4) return `Khách ***${phone.slice(-4)}`
  const code = String(input.orderCode || '').trim()
  return code ? `#${code}` : 'Khách ẩn danh'
}

export function affiliateProductSummary(names: string[], maxLen = 80): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean)
  if (!cleaned.length) return '—'
  let text = cleaned[0]
  if (cleaned.length > 1) text = `${text} (+${cleaned.length - 1} SP)`
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`
}

/** 188 AppShell: first-touch POST only after email / Google login, not a minted guest UUID. */
export function affiliateHasLoggedInIdentity(identity: {
  linkedUserId?: string | null
  emailNormalized?: string | null
}): boolean {
  return Boolean(String(identity.linkedUserId || '').trim() || String(identity.emailNormalized || '').trim())
}

export function affiliateApiErrorMessage(locale: WebLocale, code: string): string {
  const key = code.trim().toUpperCase()
  const map: Record<WebLocale, Record<string, string>> = {
    vi: {
      AUTH_REQUIRED: 'Vui lòng đăng nhập.',
      NOT_APPROVED: 'Tài khoản chưa được duyệt CTV.',
      EMAIL_REQUIRED: 'Cần email để gửi OTP.',
      OTP_INVALID: 'Mã OTP không đúng hoặc đã hết hạn.',
      OTP_SEND_FAILED: 'Không gửi được OTP. Thử lại sau.',
      BANK_REQUIRED: 'Hãy lưu tài khoản ngân hàng trước.',
      BELOW_MINIMUM: 'Số tiền thấp hơn mức rút tối thiểu.',
      INSUFFICIENT_BALANCE: 'Số dư ví không đủ.',
      ALREADY_APPROVED: 'Tài khoản đã được duyệt CTV.',
      SOCIAL_LINK_REQUIRED: 'Nhập ít nhất một link mạng xã hội.',
      SOCIAL_LINK_INVALID: 'Link phải bắt đầu bằng http:// hoặc https://.',
      SOCIAL_LINK_TOO_LONG: 'Link mạng xã hội quá dài.',
    },
    en: {
      AUTH_REQUIRED: 'Please sign in.',
      NOT_APPROVED: 'Affiliate application is not approved yet.',
      EMAIL_REQUIRED: 'An email is required to send OTP.',
      OTP_INVALID: 'OTP is invalid or expired.',
      OTP_SEND_FAILED: 'Could not send OTP. Try again later.',
      BANK_REQUIRED: 'Save a bank account first.',
      BELOW_MINIMUM: 'Amount is below the minimum withdrawal.',
      INSUFFICIENT_BALANCE: 'Wallet balance is not enough.',
      ALREADY_APPROVED: 'This account is already an approved affiliate.',
      SOCIAL_LINK_REQUIRED: 'Enter at least one social link.',
      SOCIAL_LINK_INVALID: 'Links must start with http:// or https://.',
      SOCIAL_LINK_TOO_LONG: 'A social link is too long.',
    },
    zh: {
      AUTH_REQUIRED: '请先登录。',
      NOT_APPROVED: '联盟申请尚未通过。',
      EMAIL_REQUIRED: '需要邮箱才能发送验证码。',
      OTP_INVALID: '验证码无效或已过期。',
      OTP_SEND_FAILED: '无法发送验证码，请稍后重试。',
      BANK_REQUIRED: '请先保存银行账户。',
      BELOW_MINIMUM: '金额低于最低提现额。',
      INSUFFICIENT_BALANCE: '钱包余额不足。',
      ALREADY_APPROVED: '该账户已是认证联盟。',
      SOCIAL_LINK_REQUIRED: '请至少填写一个社交链接。',
      SOCIAL_LINK_INVALID: '链接必须以 http:// 或 https:// 开头。',
      SOCIAL_LINK_TOO_LONG: '社交链接过长。',
    },
    ja: {
      AUTH_REQUIRED: 'ログインしてください。',
      NOT_APPROVED: 'アフィリエイトはまだ承認されていません。',
      EMAIL_REQUIRED: 'OTP送信にはメールが必要です。',
      OTP_INVALID: 'OTPが無効または期限切れです。',
      OTP_SEND_FAILED: 'OTPを送信できませんでした。',
      BANK_REQUIRED: '先に銀行口座を保存してください。',
      BELOW_MINIMUM: '出金下限を下回っています。',
      INSUFFICIENT_BALANCE: 'ウォレット残高が不足しています。',
      ALREADY_APPROVED: 'すでに承認済みです。',
      SOCIAL_LINK_REQUIRED: 'SNSリンクを1つ以上入力してください。',
      SOCIAL_LINK_INVALID: 'リンクは http:// または https:// で始めてください。',
      SOCIAL_LINK_TOO_LONG: 'SNSリンクが長すぎます。',
    },
    ko: {
      AUTH_REQUIRED: '로그인해 주세요.',
      NOT_APPROVED: '제휴 신청이 아직 승인되지 않았습니다.',
      EMAIL_REQUIRED: 'OTP 발송에 이메일이 필요합니다.',
      OTP_INVALID: 'OTP가 올바르지 않거나 만료되었습니다.',
      OTP_SEND_FAILED: 'OTP를 보내지 못했습니다.',
      BANK_REQUIRED: '먼저 은행 계좌를 저장하세요.',
      BELOW_MINIMUM: '최소 출금 금액보다 작습니다.',
      INSUFFICIENT_BALANCE: '지갑 잔액이 부족합니다.',
      ALREADY_APPROVED: '이미 승인된 제휴 계정입니다.',
      SOCIAL_LINK_REQUIRED: '소셜 링크를 하나 이상 입력하세요.',
      SOCIAL_LINK_INVALID: '링크는 http:// 또는 https://로 시작해야 합니다.',
      SOCIAL_LINK_TOO_LONG: '소셜 링크가 너무 깁니다.',
    },
  }
  return (map[locale] ?? map.en)[key] || code
}

export function cleanAffiliateSocialLinks(links: unknown): string[] {
  const source = Array.isArray(links) ? links : typeof links === 'string' ? links.split(/\n+/) : []
  const cleaned: string[] = []
  for (const raw of source) {
    const link = String(raw || '').trim()
    if (!link) continue
    if (link.length > 500) throw new Error('SOCIAL_LINK_TOO_LONG')
    if (!/^https?:\/\//i.test(link)) throw new Error('SOCIAL_LINK_INVALID')
    if (!cleaned.includes(link)) cleaned.push(link)
  }
  if (!cleaned.length) throw new Error('SOCIAL_LINK_REQUIRED')
  return cleaned.slice(0, 10)
}

export function formatAffiliateMoney(amount: number): string {
  const n = Math.max(0, Math.round(Number(amount) || 0))
  return `${new Intl.NumberFormat('vi-VN').format(n)}đ`
}
