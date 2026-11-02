'use server'

import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { confirmAdminPendingCreditDeposit } from '@/lib/db/admin-credit-deposit-stats-pg'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'

function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

/** Admin bấm «Xác nhận lại» — cộng credit một lần cho đơn nạp còn pending. */
export async function confirmAdminCreditDepositAction(
  paymentId: string
): Promise<{ ok: true } | { error: string }> {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error }
  const locale = getCurrentWebLocale()
  const role = await getProfileRoleWithFallback(authResult.user.id)
  if (role !== 'admin') {
    return {
      error: tr(locale, 'Không có quyền.', 'Permission denied.', '没有权限。', '権限がありません。', '권한이 없습니다.'),
    }
  }

  const result = await confirmAdminPendingCreditDeposit({
    paymentId,
    adminUserId: authResult.user.id,
  })
  if (!result.ok) {
    if (result.error === 'not_pending') {
      return {
        error: tr(
          locale,
          'Đơn này đã được xác nhận hoặc không còn chờ.',
          'This order was already confirmed or is no longer pending.',
          '此订单已确认或不再等待。',
          'この注文は確認済みか、保留ではありません。',
          '이 주문은 이미 확인되었거나 대기 중이 아닙니다.'
        ),
      }
    }
    if (result.error === 'not_found') {
      return {
        error: tr(locale, 'Không thấy đơn nạp.', 'Top-up order not found.', '找不到充值订单。', 'チャージ注文が見つかりません。', '충전 주문을 찾을 수 없습니다.'),
      }
    }
    if (result.error === 'invalid_id') {
      return {
        error: tr(locale, 'Mã đơn không hợp lệ.', 'Invalid order id.', '订单号无效。', '注文IDが無効です。', '주문 번호가 올바르지 않습니다.'),
      }
    }
    return {
      error: tr(locale, 'Không xác nhận được. Thử lại.', 'Could not confirm. Try again.', '无法确认，请重试。', '確認できません。もう一度お試しください。', '확인할 수 없습니다. 다시 시도하세요.'),
    }
  }

  const amountFmt = `${new Intl.NumberFormat('vi-VN').format(Math.round(result.amount))}₫`
  const balanceLabel = Number.isInteger(result.newBalance)
    ? String(result.newBalance)
    : result.newBalance.toFixed(1)
  try {
    await deliverUserNotificationPg({
      user_id: result.userId,
      type: 'payment_credits_added',
      title: 'Nạp credit thành công',
      body: `Giao dịch đã được xác nhận. Bạn được cộng ${result.creditsAdded} credit (số tiền ${amountFmt}). Số dư hiện tại khoảng ${balanceLabel} credit. Cảm ơn bạn đã sử dụng NanoAI.`,
      meta: {
        push_url: '/wallet',
        payment_id: paymentId,
        amount_vnd: result.amount,
        credits_added: result.creditsAdded,
        balance_after: result.newBalance,
        source: 'admin_manual',
        order_code: result.orderCode,
      },
    })
  } catch (notifyErr) {
    console.error('[confirmAdminCreditDepositAction] notify', notifyErr)
  }

  revalidatePath('/admin/credit-deposit-stats')
  return { ok: true }
}
