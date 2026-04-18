import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { addCreditsToUser } from '@/lib/db/credits-balance'
import { isPgConfigured } from '@/lib/db/pool'
import {
  sepayFindPaymentByTransactionId,
  sepayFindPendingPaymentMatch,
  sepayMarkPaymentCompleted,
} from '@/lib/db/payments-repo'
import {
  fetchPartnerOrderByIdForPartnerFromPg,
  fetchPartnerOrderByPaymentReferenceFromPg,
  fetchPartnerPaymentSettingsFromPg,
  updatePartnerOrderPaymentVerificationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import {
  emailCustomerOrderPaymentManualReview,
  emailCustomerOrderPaymentVerified,
} from '@/lib/messaging/partner-order-customer-email'
import { insertMessagePg } from '@/lib/db/customer-care-pg'
import { insertPartnerOrderEventFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { queuePartnerOrderGoogleSheetsSync } from '@/lib/messaging/partner-order-google-sheets-sync'

type SePayBody = Record<string, string | number | boolean | null | undefined>

const toStringValue = (value: SePayBody[string]): string | undefined => {
  if (value === null || value === undefined) return undefined
  return String(value).trim()
}

const toNumberValue = (value: SePayBody[string]): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const extractTransferContent = (raw?: string) => {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const sevqrMatch = trimmed.match(/SEVQR\s+[A-Z0-9]+/i)
  if (sevqrMatch) {
    return sevqrMatch[0].replace(/\s+/g, ' ').trim().toUpperCase()
  }

  return trimmed.replace(/\s+/g, ' ').trim()
}

const normalizeSePayCode = (code?: string) => {
  if (!code) return undefined
  const cleanedCode = code.trim().toUpperCase()
  if (!cleanedCode) return undefined
  if (cleanedCode.startsWith('SEVQR ')) return cleanedCode
  return `SEVQR ${cleanedCode}`
}

const parseBody = (rawBody: string, contentType: string): SePayBody => {
  if (!rawBody) return {}

  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody) as SePayBody
  }

  const params = new URLSearchParams(rawBody)
  return Object.fromEntries(params.entries())
}

const signaturesEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

const verifySePaySignature = (rawBody: string, secretKey: string, signature: string) => {
  const expectedHex = createHmac('sha256', secretKey).update(rawBody).digest('hex')
  const expectedBase64 = createHmac('sha256', secretKey).update(rawBody).digest('base64')
  const normalizedSignature = signature.trim()

  return (
    signaturesEqual(normalizedSignature.toLowerCase(), expectedHex.toLowerCase()) ||
    signaturesEqual(normalizedSignature, expectedBase64)
  )
}

function formatVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n)))}đ`
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const rawBody = await request.text()
    let body: SePayBody = {}

    try {
      body = parseBody(rawBody, contentType)
    } catch (parseError) {
      console.error('Invalid SePay payload:', parseError)
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
    }

    console.log('SePay IPN received:', {
      contentType,
      headers: Object.fromEntries(request.headers.entries()),
      body: JSON.stringify(body, null, 2)
    })

    // Xác thực IPN từ SePay (nếu có signature)
    const signature =
      request.headers.get('x-sepay-signature') ||
      request.headers.get('signature') ||
      toStringValue(body.signature)

    const status = toStringValue(body.status || body.transaction_status)?.toLowerCase()
    if (status && status !== 'success' && status !== 'completed') {
      console.log(`Transaction status is not success: ${status}`)
      return NextResponse.json({
        success: false,
        message: `Transaction status is ${status}, not processing`
      })
    }

    const amountIn = toNumberValue(
      body.amount || body.amount_in || body.total_amount || body.transferAmount || body.transfer_amount
    )
    const transactionContentRaw = toStringValue(
      body.transaction_content || body.content || body.description
    )
    const transactionCode = toStringValue(body.code)
    const transactionContent = extractTransferContent(transactionContentRaw) || normalizeSePayCode(transactionCode)
    const transactionId = toStringValue(
      body.transaction_id || body.order_id || body.payment_id || body.referenceCode || body.id
    )
    const bankAccount = toStringValue(body.bank_account || body.account_number || body.accountNumber)
    const bankName = toStringValue(body.bank_name || body.bank || body.gateway)

    console.log('SePay IPN data:', {
      amountIn,
      transactionContent,
      transactionId,
      bankAccount,
      bankName,
      status,
      fullBody: body
    })

    if (!amountIn || amountIn <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!transactionContent) {
      return NextResponse.json({ error: 'Invalid transaction content' }, { status: 400 })
    }
    const normalizedContent = transactionContent.trim().toUpperCase()

    const amountFmt = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amountIn)

    if (!isPgConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình DATABASE_URL (Postgres). Không thể xử lý thanh toán.' },
        { status: 503 }
      )
    }

    if (transactionId) {
      const existing = await sepayFindPaymentByTransactionId(transactionId)
      if (existing?.status === 'completed') {
        return NextResponse.json({
          success: true,
          message: 'Payment already processed',
          data: { paymentId: existing.id },
        })
      }
    }

    const pending = await sepayFindPendingPaymentMatch(normalizedContent, amountIn)
    // Multi-tenant shop order webhook mode:
    // ?partner=<partnerId>&token=<shopToken>
    // If shop order matched, process order payment directly (independent from wallet top-up flow).
    const url = new URL(request.url)
    const partnerId = (url.searchParams.get('partner') || '').trim()
    const token = (url.searchParams.get('token') || '').trim()
    if (partnerId && token) {
      const order = await fetchPartnerOrderByPaymentReferenceFromPg(partnerId, normalizedContent)
      if (!order) {
        return NextResponse.json({ error: 'Order not found for partner webhook.' }, { status: 404 })
      }
      const secretKey = (order.sepay_secret_key ?? '').trim() || (process.env.SEPAY_SECRET_KEY ?? '').trim()
      if (secretKey && signature) {
        const isValidSignature = verifySePaySignature(rawBody, secretKey, signature)
        if (!isValidSignature) {
          console.error('Invalid SePay signature (partner mode)')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      } else if (secretKey) {
        const requireSignature = process.env.SEPAY_REQUIRE_SIGNATURE === 'true'
        if (requireSignature) {
          return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
        }
        console.warn('No signature received; continuing because SEPAY_REQUIRE_SIGNATURE=false')
      }
      const cfgToken = (order.sepay_webhook_token ?? '').trim()
      if (!cfgToken || cfgToken !== token) {
        return NextResponse.json({ error: 'Invalid partner webhook token.' }, { status: 401 })
      }
      const partnerRows = await fetchMessagingPartnersByIdsFromPg([partnerId])
      const shopBrand = (partnerRows?.[0]?.display_name ?? '').trim() || 'Shop'
      const expectedAccount = String(order.expected_account_number ?? '').replace(/[^\d]/g, '')
      const receivedAccount = String(bankAccount ?? '').replace(/[^\d]/g, '')
      const accountMatched = expectedAccount ? receivedAccount.includes(expectedAccount) : true
      const amountMatched = amountIn >= Math.round(order.required_amount)
      const nextStatus = accountMatched && amountMatched ? 'paid_verified' : 'pending_manual_review'
      await updatePartnerOrderPaymentVerificationFromPg({
        orderId: order.id,
        status: nextStatus,
        paidAmount: amountIn,
        verifiedNote:
          nextStatus === 'paid_verified'
            ? 'Webhook doi chieu thanh cong.'
            : `Webhook can duyet tay (accountMatched=${String(accountMatched)}, amountMatched=${String(amountMatched)}).`,
      })
      const refreshed = await fetchPartnerOrderByIdForPartnerFromPg(partnerId, order.id)
      const subtotal = Math.round(refreshed?.subtotal_amount ?? 0)
      const paidRounded = Math.round(refreshed?.paid_amount ?? amountIn)
      const remainingOnDelivery = Math.max(0, subtotal - paidRounded)
      const refMemo = (refreshed?.payment_reference ?? order.payment_reference).trim()
      const chatBody =
        refreshed
          ? nextStatus === 'paid_verified'
            ? `${shopBrand} đã xác nhận thanh toán cho đơn ${refMemo}. Đã nhận: ${formatVnd(amountIn)}. Thanh toán khi nhận hàng: ${formatVnd(remainingOnDelivery)} (tổng đơn ${formatVnd(subtotal)}). Cảm ơn bạn đã đặt hàng!`
            : `${shopBrand} đã nhận ${formatVnd(amountIn)}; đơn ${refMemo} đang chờ kiểm tra thêm. Thanh toán khi nhận hàng (ước tính): ${formatVnd(remainingOnDelivery)} (tổng đơn ${formatVnd(subtotal)}). Cảm ơn bạn đã đặt hàng — shop sẽ cập nhật ngay khi đối chiếu xong.`
          : nextStatus === 'paid_verified'
            ? `${shopBrand} da xac nhan thanh toan thanh cong cho don ${order.payment_reference}. Cam on ban da dat hang!`
            : `${shopBrand} da nhan giao dich, don ${order.payment_reference} dang can duyet tay them. Cam on ban — shop se cap nhat sau khi doi chieu.`
      await insertMessagePg({
        conversationId: order.conversation_id,
        direction: 'outbound',
        body: chatBody,
        rawPayload: {
          source: 'system_order',
          order_id: order.id,
          order_status: nextStatus,
          payment_webhook_source: 'sepay',
          payment_amount_detected: amountIn,
          payment_subtotal: subtotal,
          payment_remaining_on_delivery: remainingOnDelivery,
          payment_receiver_detected: receivedAccount,
        },
      })
      await insertPartnerOrderEventFromPg({
        orderId: order.id,
        eventType: 'sepay_webhook_received',
        title: 'Nhan webhook thanh toan',
        detail: `Webhook da vao. So tien ${amountIn}. Ket qua ${nextStatus}.`,
        source: 'system',
        metadata: {
          transaction_id: transactionId ?? '',
          transaction_content: normalizedContent,
          bank_account: receivedAccount,
          account_matched: accountMatched,
          amount_matched: amountMatched,
        },
      })
      try {
        const paySettings = await fetchPartnerPaymentSettingsFromPg(partnerId)
        if (refreshed && paySettings) {
          if (nextStatus === 'paid_verified') {
            await emailCustomerOrderPaymentVerified({
              order: refreshed,
              shopNotifyEmail: paySettings.notify_email || '',
            })
          } else {
            await emailCustomerOrderPaymentManualReview({
              order: refreshed,
              shopNotifyEmail: paySettings.notify_email || '',
            })
          }
        }
      } catch (e) {
        console.warn('[sepay-webhook partner order] email', e)
      }
      queuePartnerOrderGoogleSheetsSync(partnerId, order.id)
      return NextResponse.json({
        success: true,
        message: 'Partner order webhook processed',
        data: {
          orderId: order.id,
          status: nextStatus,
        },
      })
    }
    const secretKey = (process.env.SEPAY_SECRET_KEY ?? '').trim()
    if (secretKey && signature) {
      const isValidSignature = verifySePaySignature(rawBody, secretKey, signature)
      if (!isValidSignature) {
        console.error('Invalid SePay signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else if (secretKey) {
      const requireSignature = process.env.SEPAY_REQUIRE_SIGNATURE === 'true'
      if (requireSignature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }
      console.warn('No signature received; continuing because SEPAY_REQUIRE_SIGNATURE=false')
    }
    if (!pending) {
      console.warn('No pending payment found for content:', normalizedContent)
      return NextResponse.json({ error: 'Pending payment not found' }, { status: 404 })
    }

    const paymentId = pending.id
    const userId = pending.user_id
    const creditsToAdd = Math.floor(amountIn / CREDIT_UNIT_PRICE_VND)
    const added = await addCreditsToUser(userId, creditsToAdd)
    if (!added.ok) {
      console.error('Error adding credits:', added.error)
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
    }
    const newBalance = added.newBalance

    const upd = await sepayMarkPaymentCompleted({
      paymentId,
      transactionId: transactionId || null,
      normalizedContent,
      bankAccount: bankAccount ?? null,
      bankName: bankName ?? null,
      sepayData: body as Record<string, unknown>,
    })
    if (!upd.ok) {
      console.error('Error updating payment:', upd.error)
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
    }

    console.log(`Payment completed: User ${userId} received ${creditsToAdd} credits (${amountIn} VND)`)

    try {
      await deliverUserNotificationPg({
        user_id: userId,
        type: 'payment_credits_added',
        title: 'Nạp credit thành công',
        body: `Giao dịch đã được xác nhận. Bạn được cộng ${creditsToAdd} credit (số tiền ${amountFmt}). Số dư hiện tại khoảng ${Number.isInteger(newBalance) ? newBalance : newBalance.toFixed(1)} credit. Cảm ơn bạn đã sử dụng NanoAI.`,
        meta: {
          push_url: '/wallet',
          payment_id: paymentId,
          amount_vnd: amountIn,
          credits_added: creditsToAdd,
          balance_after: newBalance,
        },
      })
    } catch (notifyErr) {
      const m = notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
      console.error('[sepay-webhook] notification/email:', m)
    }

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        userId,
        amountIn,
        creditsAdded: creditsToAdd,
        paymentId,
      },
    })

  } catch (error: unknown) {
    console.error('SePay webhook error:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SePay Webhook endpoint is running',
    instructions: 'Send POST request with SePay webhook data',
    example: {
      amount_in: 6000,
      transaction_content: 'NAPabc123de',
      transaction_id: 'sepay_123456',
      bank_account: '0123456789',
      bank_name: 'MB Bank'
    }
  })
}