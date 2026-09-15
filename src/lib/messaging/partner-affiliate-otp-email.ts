import type { WebLocale } from '@/lib/i18n/config'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { partnerShopEmailBrandName, shopEmailSubject } from '@/lib/messaging/partner-shop-email-brand'
import { resolvePartnerShopEmailContext } from '@/lib/messaging/partner-shop-email-context'

function affiliateOtpCopy(
  locale: WebLocale,
  purpose: 'bank_account' | 'withdraw',
  expiresInMinutes: number
): { title: string; intro: string; expires: string } {
  const isBank = purpose === 'bank_account'
  const map: Record<WebLocale, { titleBank: string; titleWithdraw: string; introBank: string; introWithdraw: string; expires: string }> =
    {
      vi: {
        titleBank: 'Mã OTP tài khoản ngân hàng affiliate',
        titleWithdraw: 'Mã OTP rút tiền affiliate',
        introBank: 'Bạn đang thêm hoặc thay đổi tài khoản ngân hàng nhận tiền affiliate.',
        introWithdraw: 'Bạn đang gửi yêu cầu rút tiền ví affiliate.',
        expires: `Hết hạn sau ${expiresInMinutes} phút.`,
      },
      en: {
        titleBank: 'Affiliate bank account OTP',
        titleWithdraw: 'Affiliate withdrawal OTP',
        introBank: 'You are adding or changing the bank account for affiliate payouts.',
        introWithdraw: 'You are requesting an affiliate wallet withdrawal.',
        expires: `Expires in ${expiresInMinutes} minutes.`,
      },
      zh: {
        titleBank: '联盟银行账户验证码',
        titleWithdraw: '联盟提现验证码',
        introBank: '您正在添加或更改联盟收款银行账户。',
        introWithdraw: '您正在申请从联盟钱包提现。',
        expires: `${expiresInMinutes} 分钟后过期。`,
      },
      ja: {
        titleBank: 'アフィリエイト銀行口座OTP',
        titleWithdraw: 'アフィリエイト出金OTP',
        introBank: 'アフィリエイト受取用の銀行口座を追加または変更しています。',
        introWithdraw: 'アフィリエイトウォレットの出金を申請しています。',
        expires: `${expiresInMinutes}分で期限切れになります。`,
      },
      ko: {
        titleBank: '제휴 은행 계좌 OTP',
        titleWithdraw: '제휴 출금 OTP',
        introBank: '제휴 정산용 은행 계좌를 추가하거나 변경하고 있습니다.',
        introWithdraw: '제휴 지갑 출금을 요청하고 있습니다.',
        expires: `${expiresInMinutes}분 후 만료됩니다.`,
      },
    }
  const t = map[locale] ?? map.en
  return {
    title: isBank ? t.titleBank : t.titleWithdraw,
    intro: isBank ? t.introBank : t.introWithdraw,
    expires: t.expires,
  }
}

export async function sendPartnerAffiliateOtpEmail(input: {
  partnerId: string
  toEmail: string
  code: string
  expiresInMinutes: number
  purpose: 'bank_account' | 'withdraw'
}): Promise<boolean> {
  if (!isSmtpConfigured()) return false
  const ctx = await resolvePartnerShopEmailContext(input.partnerId)
  const shopName = partnerShopEmailBrandName({ display_name: ctx.shopDisplayName })
  const copy = affiliateOtpCopy(ctx.locale, input.purpose, input.expiresInMinutes)
  const text = `${copy.intro}\n\nOTP: ${input.code}\n${copy.expires}\n\n${shopName}`
  const html = `<p>${copy.intro}</p>
<p>OTP: <strong style="font-size:20px;letter-spacing:4px">${input.code}</strong></p>
<p>${copy.expires}</p>
<p>${shopName}</p>`
  const sent = await sendSmtpMail({
    to: input.toEmail,
    fromName: shopName,
    subject: shopEmailSubject(shopName, copy.title),
    text,
    html,
  })
  return Boolean(sent)
}
