import type { Database, Json } from '@/types/database.types'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import { sendFacebookMessengerImageUrl, sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { buildPartnerMediaPayload, partnerMediaPayloadToJson } from '@/lib/messaging/guest-chat-image'
import type { PartnerMaterialDetailFollowup } from '@/lib/messaging/partner-inventory-material-detail-image'
import type { PartnerRealUseImageFollowup } from '@/lib/messaging/partner-inventory-real-use-image'
import { getFacebookSendToken, getZaloSendToken } from '@/lib/messaging/partner-channels-db'
import { splitAutomatedReplyIntoChunks } from '@/lib/messaging/partner-ai-split-reply'
import { maybeEmailCustomerOfflineShopReply } from '@/lib/messaging/partner-reply-offline-customer-email'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Khoảng cách giữa các bong bóng khi AI chia tin (ms). Env: MESSAGING_AI_SPLIT_GAP_MS */
function messagingAiSplitGapMs(): number {
  const raw = process.env.MESSAGING_AI_SPLIT_GAP_MS?.trim()
  if (!raw) return 2200
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(20000, Math.max(250, n)) : 2200
}

type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']
type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']

function mergeAutomatedOutboundPayload(rawPayload: Json, realUseFollowup: PartnerRealUseImageFollowup | null | undefined): Json {
  const follow = realUseFollowup
  const inv = follow?.inventoryId?.trim()
  const url = follow?.publicUrl?.trim()
  if (!follow || !inv || !url) {
    return rawPayload
  }
  const base =
    rawPayload !== null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? ({ ...(rawPayload as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>)
  base.partner_ai_image_followup = {
    kind: 'real_use' as const,
    inventory_id: inv,
    slot: follow.slot,
  }
  return base as Json
}

function applyDisclosure(body: string, settings: SettingsRow): string {
  if (!settings.append_ai_disclosure) return body.trim()
  const s = settings.disclosure_suffix?.trim()
  if (!s) return body.trim()
  // Legacy default disclosure text should never be shown to end-users.
  if (/automated message from the shop[’']s ai assistant/i.test(s)) return body.trim()
  return `${body.trim()}\n\n${s}`
}

/** Chỉ bản tin cuối mang đủ payload (vd. thẻ SP); các bản trước bỏ `ai_product_cards` để UI không lặp. */
function rawPayloadForSplitChunk(full: Json, isLast: boolean): Json {
  if (isLast) return full
  if (full !== null && typeof full === 'object' && !Array.isArray(full)) {
    const o = { ...(full as Record<string, unknown>) }
    delete o.ai_product_cards
    o.ai_reply_continuation = true
    return o as Json
  }
  return { ai_reply_continuation: true } as Json
}

/**
 * Gửi tin outbound tự động (FAQ/AI): lưu DB, đẩy FB/Zalo nếu cần. sender_admin_id = null.
 * Nội dung dài được chia thành nhiều tin ngắt ý (widget/FB/Zalo + DB).
 */
export async function deliverAutomatedPartnerMessage(params: {
  conversation: ConvRow
  settings: SettingsRow
  body: string
  rawPayload: Json
  materialDetailFollowup?: PartnerMaterialDetailFollowup | null
  realUseFollowup?: PartnerRealUseImageFollowup | null
}): Promise<{ error?: string }> {
  const { conversation, settings, body, rawPayload, materialDetailFollowup, realUseFollowup } = params
  const base = body.trim()
  if (!base) return { error: 'Empty body' }

  const split = splitAutomatedReplyIntoChunks(base)
  if (split.length === 0) return { error: 'Empty body' }

  const withDisclosure = split.map((chunk, i) =>
    i === split.length - 1 ? applyDisclosure(chunk, settings) : chunk.trim()
  )
  const textParts = withDisclosure.map((t) => t.trim()).filter(Boolean)
  if (textParts.length === 0) return { error: 'Empty body' }

  const imageFollowup: PartnerMaterialDetailFollowup | PartnerRealUseImageFollowup | null =
    realUseFollowup?.publicUrl ? realUseFollowup : materialDetailFollowup?.publicUrl ? materialDetailFollowup : null
  const imageKind: 'real_use' | 'material' | null = realUseFollowup?.publicUrl
    ? 'real_use'
    : materialDetailFollowup?.publicUrl
      ? 'material'
      : null

  let outboundTexts = textParts
  if (conversation.channel === 'zalo' && imageFollowup?.publicUrl) {
    const zaloLine =
      imageKind === 'real_use'
        ? `📷 Em gửi ảnh đời thường góc tự nhiên để mình xem sản phẩm chân thực ạ: ${imageFollowup.publicUrl}`
        : `📷 Chi tiết chất liệu & màu sắc (từ ảnh sản phẩm chính): ${imageFollowup.publicUrl}`
    const last = outboundTexts[outboundTexts.length - 1]
    outboundTexts = [...outboundTexts.slice(0, -1), `${last}\n\n${zaloLine}`]
  }

  const externalId = conversation.external_thread_id
  const gapMs = messagingAiSplitGapMs()

  if (conversation.channel === 'facebook') {
    let pageToken: string | null = null
    const pageId = conversation.channel_external_ref
    if (pageId) {
      const r = await getFacebookSendToken(conversation.partner_id, pageId)
      if (r.error) return { error: r.error }
      pageToken = r.token ?? null
    }
    if (!pageToken) return { error: 'Facebook Page token missing.' }
    for (let fi = 0; fi < outboundTexts.length; fi++) {
      if (fi > 0) await sleep(gapMs)
      const part = outboundTexts[fi]
      const sent = await sendFacebookMessengerText(externalId, part, pageToken)
      if ('error' in sent) return { error: sent.error }
    }
    if (imageFollowup?.publicUrl) {
      const imgSent = await sendFacebookMessengerImageUrl(externalId, imageFollowup.publicUrl, pageToken)
      if ('error' in imgSent) return { error: imgSent.error }
    }
  } else if (conversation.channel === 'zalo') {
    const r = await getZaloSendToken(conversation.partner_id)
    if (r.error) return { error: r.error }
    const tok = r.token ?? null
    if (!tok) return { error: 'Zalo OA token missing.' }
    for (let zi = 0; zi < outboundTexts.length; zi++) {
      if (zi > 0) await sleep(gapMs)
      const part = outboundTexts[zi]
      const sent = await sendZaloOaText(externalId, part, tok)
      if ('error' in sent) return { error: sent.error }
    }
  }

  const n = outboundTexts.length
  for (let i = 0; i < n; i++) {
    if (i > 0) await sleep(gapMs)
    const isLast = i === n - 1
    const payload = mergeAutomatedOutboundPayload(
      rawPayloadForSplitChunk(rawPayload, isLast),
      isLast ? realUseFollowup : undefined
    )
    const ins = await insertMessage({
      conversationId: conversation.id,
      direction: 'outbound',
      body: outboundTexts[i],
      rawPayload: payload,
      senderAdminId: null,
    })
    if ('error' in ins) return { error: ins.error }
  }

  if (
    imageFollowup?.publicUrl &&
    (conversation.channel === 'widget' || conversation.channel === 'internal')
  ) {
    await sleep(gapMs)
    const storagePath =
      imageFollowup.storagePath?.trim() ||
      (imageKind === 'real_use'
        ? `real-use-cached/${conversation.partner_id}/${conversation.id}`
        : `material-detail-cached/${conversation.partner_id}/${conversation.id}`)
    const p = buildPartnerMediaPayload(
      imageFollowup.publicUrl,
      storagePath,
      imageFollowup.mime?.trim() || 'image/png'
    )
    const caption =
      imageKind === 'real_use'
        ? '📷 Em gửi ảnh đời thường góc tự nhiên để mình xem sản phẩm chân thực ạ'
        : '📷 Chi tiết chất liệu & màu sắc (từ ảnh sản phẩm chính).'
    const ins2 = await insertMessage({
      conversationId: conversation.id,
      direction: 'outbound',
      body: caption,
      rawPayload: partnerMediaPayloadToJson(p),
      senderAdminId: null,
    })
    if ('error' in ins2) return { error: ins2.error }
  }

  if (conversation.channel === 'widget' && outboundTexts.length > 0) {
    void maybeEmailCustomerOfflineShopReply({
      conversation,
      replyBody: outboundTexts[outboundTexts.length - 1] ?? base,
    })
  }

  return {}
}
