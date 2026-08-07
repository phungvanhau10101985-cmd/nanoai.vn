'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import type { AppUser } from '@/lib/auth/app-user'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  generatePartnerWebsiteResetOtp6,
  hashPartnerWebsiteResetOtp,
  isPartnerWebsiteResetOtpCooldownActiveFromPg,
  replacePartnerWebsiteResetOtpFromPg,
  verifyPartnerWebsiteResetOtpAndDeleteFromPg,
  fetchPartnerWebsiteResetTrashInfoFromPg,
  restorePartnerWebsiteFromResetTrashPg,
  PARTNER_WEBSITE_RESET_TRASH_DAYS,
  type PartnerWebsiteResetTrashInfo,
} from '@/lib/db/partner-website-reset-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { sendSmtpMail, isSmtpConfigured } from '@/lib/email/smtp'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireOwner(
  partnerId: string
): Promise<{ error: string } | { user: AppUser }> {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error as string }
  const user = auth.user
  if (!UUID_RE.test(partnerId)) return { error: 'Invalid workspace.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
      [partnerId, user.id]
    )
    if (!row) return { error: 'Forbidden.' }
  } catch {
    return { error: 'Forbidden.' }
  }
  return { user }
}

export async function requestPartnerWebsiteResetOtp(
  partnerId: string
): Promise<{ error: string } | { ok: true; debugOtp?: string }> {
  const gate = await requireOwner(partnerId)
  if ('error' in gate) return { error: gate.error }
  const { user } = gate

  const email = user.email?.trim()
  if (!email) {
    return { error: 'Tài khoản chưa có email — không gửi được OTP.' }
  }

  const otp = generatePartnerWebsiteResetOtp6()

  if (!isSmtpConfigured()) {
    if (process.env.EMAIL_AUTH_DEBUG_OTP === '1') {
      console.info('[requestPartnerWebsiteResetOtp] debug OTP (no SMTP):', otp)
      return { ok: true as const, debugOtp: otp }
    }
    return { error: 'Máy chủ chưa cấu hình gửi email (SMTP).' }
  }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  if (!existing) {
    return { error: 'Chưa có website để reset.' }
  }

  if (await isPartnerWebsiteResetOtpCooldownActiveFromPg(partnerId)) {
    return { error: 'Vui lòng đợi vài chục giây trước khi gửi lại mã.' }
  }

  const otpHash = hashPartnerWebsiteResetOtp(partnerId, user.id, otp)
  const saved = await replacePartnerWebsiteResetOtpFromPg({
    partnerId,
    ownerUserId: user.id,
    otpHash,
  })
  if (!saved) return { error: 'Không lưu được mã xác nhận.' }

  const sent = await sendSmtpMail({
    to: email,
    subject: 'Mã OTP reset website shop',
    text: `Mã OTP reset website: ${otp}\n\nMã có hiệu lực 10 phút. Sau khi xác nhận, web hiện tại sẽ được đưa vào thùng lưu ${PARTNER_WEBSITE_RESET_TRASH_DAYS} ngày — bạn có thể khôi phục trong thời gian này. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Mã OTP reset website: <b>${otp}</b></p>
<p>Mã có hiệu lực <b>10 phút</b>. Sau khi xác nhận, web hiện tại sẽ được <b>lưu tạm ${PARTNER_WEBSITE_RESET_TRASH_DAYS} ngày</b> để có thể khôi phục.</p>
<p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
  })

  if (!sent.ok) {
    if (process.env.EMAIL_AUTH_DEBUG_OTP === '1') {
      console.info('[requestPartnerWebsiteResetOtp] debug OTP (SMTP failed):', otp, sent.error)
      return { ok: true as const, debugOtp: otp }
    }
    try {
      await pgQuery(`delete from public.messaging_partner_website_reset_otps where partner_id = $1::uuid`, [
        partnerId,
      ])
    } catch (e) {
      console.warn('[requestPartnerWebsiteResetOtp] rollback otp', e)
    }
    return { error: 'Không gửi được email. Kiểm tra SMTP hoặc thử lại sau.' }
  }

  const debugOtpEnabled = process.env.EMAIL_AUTH_DEBUG_OTP === '1'
  return { ok: true as const, ...(debugOtpEnabled ? { debugOtp: otp } : {}) }
}

export async function confirmPartnerWebsiteResetWithOtp(
  partnerId: string,
  otpRaw: string
): Promise<{ error: string } | { ok: true }> {
  const gate = await requireOwner(partnerId)
  if ('error' in gate) return { error: gate.error }
  const { user } = gate

  const deleted = await verifyPartnerWebsiteResetOtpAndDeleteFromPg({
    partnerId,
    ownerUserId: user.id,
    otp: otpRaw,
  })
  if (!deleted) {
    return { error: 'Mã OTP không đúng hoặc đã hết hạn.' }
  }

  revalidatePath('/dashboard/messaging/website')
  revalidatePath('/dashboard/messaging/p')
  return { ok: true as const }
}

export async function getPartnerWebsiteResetTrashStatus(
  partnerId: string
): Promise<{ trash: PartnerWebsiteResetTrashInfo | null } | { error: string }> {
  const gate = await requireOwner(partnerId)
  if ('error' in gate) return { error: gate.error }
  const trash = await fetchPartnerWebsiteResetTrashInfoFromPg(partnerId)
  return { trash }
}

export async function restorePartnerWebsiteFromResetTrash(partnerId: string): Promise<
  | { ok: true; website: PartnerWebsiteRow; publicUrl: string | null }
  | { error: string }
> {
  const gate = await requireOwner(partnerId)
  if ('error' in gate) return { error: gate.error }
  const { user } = gate

  const result = await restorePartnerWebsiteFromResetTrashPg({
    partnerId,
    ownerUserId: user.id,
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/dashboard/messaging/website')
  revalidatePath('/dashboard/messaging/p')

  const publicUrl = await resolvePartnerWebsitePublicUrl({
    partnerId,
    siteSlug: result.website.siteSlug,
    isPublished: result.website.isPublished,
  })

  return { ok: true, website: result.website, publicUrl }
}
