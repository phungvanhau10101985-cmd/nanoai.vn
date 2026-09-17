import { DEFAULT_WEB_LOCALE, type WebLocale, normalizeWebLocale } from '@/lib/i18n/config'

export type CustomerInAppCopy = { title: string; body: string }

export type CustomerInAppEvent =
  | { kind: 'deposit_confirmed'; orderCode: string; paidLabel: string; remaining: number; remainingLabel: string }
  | { kind: 'cancelled'; orderCode: string; byCustomer?: boolean }
  | { kind: 'proof_received'; orderCode: string }
  | { kind: 'shipper_confirmed'; orderCode: string; shopName: string; tracking?: string }
  | { kind: 'shipping'; orderCode: string; tracking?: string }
  | { kind: 'delivered_ems'; orderCode: string; shopName: string }
  | { kind: 'delivered_customer'; orderCode: string; shopName: string }
  | { kind: 'tracking_assigned'; orderCode: string; tracking: string }
  | { kind: 'ems_phase'; orderCode: string; phase: string; emsDetail?: string }
  | { kind: 'refunded'; orderCode: string; amountLabel: string }
  | { kind: 'deposit_reminder'; orderCode: string; hours: 2 | 20 }
  | { kind: 'promo_grant'; promotionName: string; code: string; days: number; percent: number; maxLabel: string }

/** Cùng thứ tự pha EMS như 188 `ems_shipment_notify._PHASE_RANK`. */
export const EMS_PHASE_RANK: Record<string, number> = {
  unknown: 0,
  posted: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  cod_collected: 5,
  cod_settled: 6,
}

function locOf(locale: string | null | undefined): WebLocale {
  return normalizeWebLocale(locale ?? '') ?? DEFAULT_WEB_LOCALE
}

function codeOf(orderCode: string, loc: WebLocale): string {
  const c = orderCode.trim()
  if (c) return c
  return loc === 'vi' ? 'đơn' : 'order'
}

function shopOf(shopName: string): string {
  return shopName.trim() || 'Shop'
}

function reviewHint(loc: WebLocale, shop: string): string {
  const s = shopOf(shop)
  if (loc === 'zh') {
    return `收货后请在订单页点「已收货」。若满意，欢迎评价，帮助 ${s} 改进商品与服务。`
  }
  if (loc === 'ja') {
    return `商品を受け取ったら注文ページで「受取済み」を押してください。ご満足いただけましたらレビューにご協力ください。${s} の品質向上につながります。`
  }
  if (loc === 'ko') {
    return `상품을 받으신 뒤 주문 페이지에서 «수령 확인»을 눌러 주세요. 만족하셨다면 리뷰를 남겨 ${s} 서비스 개선에 도움을 주세요.`
  }
  if (loc === 'en') {
    return `After you receive everything, tap «Received» on the order page. If you are happy with it, a short review helps ${s} improve products and service.`
  }
  return `Sau khi nhận đủ hàng, vui lòng bấm «Đã nhận hàng» trên trang đơn. Nếu bạn hài lòng, rất mong bạn dành chút thời gian đánh giá — ý kiến của bạn giúp ${s} nâng cao chất lượng sản phẩm và dịch vụ.`
}

const EMS_PHASE_LABEL: Record<WebLocale, Record<string, string>> = {
  vi: {
    posted: 'EMS đã nhận bưu gửi',
    in_transit: 'Hàng đang vận chuyển',
    out_for_delivery: 'Bưu tá đang giao hàng',
    delivered: 'Đã giao hàng thành công',
    cod_collected: 'EMS đã thu tiền COD',
    cod_settled: 'EMS đã hoàn tất COD',
  },
  en: {
    posted: 'EMS accepted the parcel',
    in_transit: 'Package in transit',
    out_for_delivery: 'Courier is delivering',
    delivered: 'Delivered successfully',
    cod_collected: 'EMS collected COD',
    cod_settled: 'EMS completed COD',
  },
  zh: {
    posted: 'EMS 已收寄',
    in_transit: '包裹运输中',
    out_for_delivery: '快递员正在派送',
    delivered: '已成功送达',
    cod_collected: 'EMS 已收取货到付款',
    cod_settled: 'EMS 已完成货到付款',
  },
  ja: {
    posted: 'EMSが荷物を受領',
    in_transit: '配送中',
    out_for_delivery: '配達中',
    delivered: '配達完了',
    cod_collected: 'EMSが代引きを受領',
    cod_settled: 'EMSの代引き完了',
  },
  ko: {
    posted: 'EMS가 화물을 접수함',
    in_transit: '배송 중',
    out_for_delivery: '택배원이 배송 중',
    delivered: '배송 완료',
    cod_collected: 'EMS가 착불 수금',
    cod_settled: 'EMS 착불 정산 완료',
  },
}

export function emsPhaseInAppLabel(locale: WebLocale, phase: string): string | null {
  const loc = EMS_PHASE_LABEL[locale] ? locale : DEFAULT_WEB_LOCALE
  const key = phase.trim().toLowerCase()
  return EMS_PHASE_LABEL[loc][key] || EMS_PHASE_LABEL[DEFAULT_WEB_LOCALE][key] || null
}

/** Copy in-app + Web Push — cùng mặt 188 (tên shop, không chữ NanoAI / 188.com.vn). */
export function formatCustomerInAppCopy(
  locale: string | null | undefined,
  event: CustomerInAppEvent
): CustomerInAppCopy {
  const loc = locOf(locale)
  switch (event.kind) {
    case 'deposit_confirmed': {
      const code = codeOf(event.orderCode, loc)
      const paidFull = event.remaining <= 0
      if (loc === 'zh') {
        return {
          title: '已收到定金',
          body: paidFull
            ? `订单 ${code}：已确认付款 ${event.paidLabel}。已付清。`
            : `订单 ${code}：已确认定金 ${event.paidLabel}。货到应付 ${event.remainingLabel}。`,
        }
      }
      if (loc === 'ja') {
        return {
          title: 'デポジットを受領しました',
          body: paidFull
            ? `ご注文 ${code}：支払い ${event.paidLabel} を確認しました。完済です。`
            : `ご注文 ${code}：デポジット ${event.paidLabel} を確認しました。受取時 ${event.remainingLabel}。`,
        }
      }
      if (loc === 'ko') {
        return {
          title: '계약금을 받았습니다',
          body: paidFull
            ? `주문 ${code}: ${event.paidLabel} 결제를 확인했습니다. 완납입니다.`
            : `주문 ${code}: 계약금 ${event.paidLabel}을(를) 확인했습니다. 수령 시 ${event.remainingLabel}.`,
        }
      }
      if (loc === 'en') {
        return {
          title: 'Deposit received',
          body: paidFull
            ? `Order ${code}: payment of ${event.paidLabel} confirmed. Paid in full.`
            : `Order ${code}: deposit of ${event.paidLabel} confirmed. ${event.remainingLabel} due on delivery.`,
        }
      }
      return {
        title: 'Đã nhận đặt cọc',
        body: paidFull
          ? `Đơn ${code}: xác nhận thanh toán ${event.paidLabel}. Đã thanh toán đủ.`
          : `Đơn ${code}: xác nhận thanh toán cọc ${event.paidLabel}. Còn thu khi nhận hàng ${event.remainingLabel}.`,
      }
    }
    case 'cancelled': {
      const code = codeOf(event.orderCode, loc)
      if (loc === 'zh') {
        return {
          title: '订单已取消',
          body: event.byCustomer ? `您已取消订单 ${code}。` : `订单 ${code} 已取消。`,
        }
      }
      if (loc === 'ja') {
        return {
          title: '注文がキャンセルされました',
          body: event.byCustomer
            ? `ご注文 ${code} をキャンセルしました。`
            : `ご注文 ${code} はキャンセルされました。`,
        }
      }
      if (loc === 'ko') {
        return {
          title: '주문이 취소되었습니다',
          body: event.byCustomer ? `주문 ${code}을(를) 취소했습니다.` : `주문 ${code}이(가) 취소되었습니다.`,
        }
      }
      if (loc === 'en') {
        return {
          title: 'Order cancelled',
          body: event.byCustomer ? `You cancelled order ${code}.` : `Order ${code} has been cancelled.`,
        }
      }
      return {
        title: 'Đơn hàng đã hủy',
        body: event.byCustomer ? `Bạn đã hủy đơn ${code}.` : `Đơn ${code} đã được hủy.`,
      }
    }
    case 'proof_received': {
      const code = codeOf(event.orderCode, loc)
      if (loc === 'zh') return { title: '已收到付款凭证', body: `订单 ${code}：店铺正在核对凭证。` }
      if (loc === 'ja') return { title: '証明書を受領しました', body: `ご注文 ${code}：店舗が証明書を確認しています。` }
      if (loc === 'ko') return { title: '결제 증빙을 받았습니다', body: `주문 ${code}: 샵이 증빙을 확인하고 있습니다.` }
      if (loc === 'en') return { title: 'Payment proof received', body: `Order ${code}: the shop is reviewing your transfer proof.` }
      return { title: 'Đã nhận chứng từ thanh toán', body: `Đơn ${code}: shop đang kiểm tra chứng từ của bạn.` }
    }
    case 'shipper_confirmed': {
      const code = codeOf(event.orderCode, loc)
      const shop = shopOf(event.shopName)
      const tracking = event.tracking?.trim()
      const trackingHint =
        tracking == null || tracking === ''
          ? ''
          : loc === 'zh'
            ? ` 运单号：${tracking}。`
            : loc === 'ja'
              ? ` 追跡番号: ${tracking}。`
              : loc === 'ko'
                ? ` 운송장: ${tracking}.`
                : loc === 'en'
                  ? ` Tracking number: ${tracking}.`
                  : ` Mã vận đơn: ${tracking}.`
      const hint = reviewHint(loc, shop)
      if (loc === 'zh') {
        return { title: '商品正在配送', body: `${shop} 已打包并交给快递配送订单 ${code}。${trackingHint} ${hint}`.replace(/\s+/g, ' ').trim() }
      }
      if (loc === 'ja') {
        return { title: '配送中です', body: `${shop} がご注文 ${code} を発送しました。${trackingHint} ${hint}`.replace(/\s+/g, ' ').trim() }
      }
      if (loc === 'ko') {
        return { title: '상품이 배송 중입니다', body: `${shop}이(가) 주문 ${code}을(를) 택배사에 넘겼습니다.${trackingHint} ${hint}`.replace(/\s+/g, ' ').trim() }
      }
      if (loc === 'en') {
        return {
          title: 'Your order is on the way',
          body: `${shop} packed and handed order ${code} to the courier.${trackingHint} ${hint}`.replace(/\s+/g, ' ').trim(),
        }
      }
      return {
        title: 'Hàng đang được giao',
        body: `${shop} đã đóng hàng và gửi shipper giao đơn ${code} đến bạn.${trackingHint} ${hint}`.replace(/\s+/g, ' ').trim(),
      }
    }
    case 'shipping': {
      const code = codeOf(event.orderCode, loc)
      const tracking = event.tracking?.trim()
      const extra =
        tracking == null || tracking === ''
          ? ''
          : loc === 'zh'
            ? ` 运单号：${tracking}。`
            : loc === 'ja'
              ? ` 追跡番号: ${tracking}。`
              : loc === 'ko'
                ? ` 운송장: ${tracking}.`
                : loc === 'en'
                  ? ` EMS: ${tracking}.`
                  : ` Mã EMS: ${tracking}.`
      if (loc === 'zh') return { title: '订单正在配送', body: `订单 ${code} 已改为配送中。${extra}`.trim() }
      if (loc === 'ja') return { title: '配送中の注文', body: `ご注文 ${code} は配送中になりました。${extra}`.trim() }
      if (loc === 'ko') return { title: '주문이 배송 중입니다', body: `주문 ${code}이(가) 배송 중으로 변경되었습니다.${extra}`.trim() }
      if (loc === 'en') return { title: 'Order is shipping', body: `Order ${code} is now out for delivery.${extra}`.trim() }
      return { title: 'Đơn đang giao hàng', body: `Đơn ${code} đã chuyển sang trạng thái đang giao hàng.${extra}`.trim() }
    }
    case 'delivered_ems': {
      const code = codeOf(event.orderCode, loc)
      const shop = shopOf(event.shopName)
      if (loc === 'zh') {
        return { title: '已成功送达', body: `订单 ${code} 已送达。若满意，欢迎评价，帮助 ${shop} 改进服务。` }
      }
      if (loc === 'ja') {
        return { title: '配達完了', body: `ご注文 ${code} の配達が完了しました。ご満足でしたらレビューにご協力ください。` }
      }
      if (loc === 'ko') {
        return { title: '배송이 완료되었습니다', body: `주문 ${code}이(가) 배송 완료되었습니다. 만족하셨다면 리뷰를 남겨 주세요.` }
      }
      if (loc === 'en') {
        return {
          title: 'Delivered successfully',
          body: `Order ${code} was delivered. If you are happy with it, a short review helps ${shop} improve.`,
        }
      }
      return {
        title: 'Đã giao hàng thành công',
        body: `Đơn ${code} đã được giao thành công. Nếu hài lòng, mong bạn đánh giá sản phẩm — ý kiến của bạn giúp ${shop} cải thiện dịch vụ.`,
      }
    }
    case 'delivered_customer': {
      const code = codeOf(event.orderCode, loc)
      const shop = shopOf(event.shopName)
      if (loc === 'zh') {
        return { title: '感谢您确认收货', body: `订单 ${code} 已确认收货。若满意，欢迎评价，帮助 ${shop} 改进。` }
      }
      if (loc === 'ja') {
        return { title: '受取のご確認ありがとうございます', body: `ご注文 ${code} の受取を確認しました。レビューにご協力ください。` }
      }
      if (loc === 'ko') {
        return { title: '수령 확인해 주셔서 감사합니다', body: `주문 ${code} 수령을 확인했습니다. 만족하셨다면 리뷰를 남겨 주세요.` }
      }
      if (loc === 'en') {
        return {
          title: 'Thanks for confirming delivery',
          body: `Order ${code} is marked received. If you are happy with it, a short review helps ${shop} improve.`,
        }
      }
      return {
        title: 'Cảm ơn bạn đã nhận hàng',
        body: `Đơn ${code} đã được xác nhận nhận hàng. Nếu hài lòng, rất mong bạn đánh giá sản phẩm — ý kiến của bạn giúp ${shop} cải thiện chất lượng và dịch vụ mỗi ngày.`,
      }
    }
    case 'tracking_assigned': {
      const code = codeOf(event.orderCode, loc)
      if (loc === 'zh') return { title: '物流更新', body: `订单 ${code} 已有 EMS 运单号。 运单号：${event.tracking}。` }
      if (loc === 'ja') return { title: '配送の更新', body: `ご注文 ${code} にEMS追跡番号が付きました。 追跡番号: ${event.tracking}。` }
      if (loc === 'ko') return { title: '배송 업데이트', body: `주문 ${code}에 EMS 운송장이 생겼습니다. 운송장: ${event.tracking}.` }
      if (loc === 'en') return { title: 'Shipping update', body: `Order ${code} now has an EMS tracking number. Tracking number: ${event.tracking}.` }
      return { title: 'Cập nhật vận chuyển', body: `Đơn ${code} đã có mã vận đơn EMS. Mã vận đơn: ${event.tracking}.` }
    }
    case 'ems_phase': {
      const code = codeOf(event.orderCode, loc)
      const label = emsPhaseInAppLabel(loc, event.phase) || event.phase
      const detail = event.emsDetail?.trim()
      const extra = detail ? ` ${detail}` : ''
      const line =
        loc === 'zh'
          ? `订单 ${code}: ${label}.${extra}`
          : loc === 'ja'
            ? `ご注文 ${code}: ${label}.${extra}`
            : loc === 'ko'
              ? `주문 ${code}: ${label}.${extra}`
              : loc === 'en'
                ? `Order ${code}: ${label}.${extra}`
                : `Đơn ${code}: ${label}.${extra}`
      return { title: label, body: line.trim() }
    }
    case 'refunded': {
      const code = codeOf(event.orderCode, loc)
      if (loc === 'zh') return { title: '已退款', body: `订单 ${code} 已退款 ${event.amountLabel}。` }
      if (loc === 'ja') return { title: '返金完了', body: `ご注文 ${code} に ${event.amountLabel} を返金しました。` }
      if (loc === 'ko') return { title: '환불 완료', body: `주문 ${code}에 ${event.amountLabel}을(를) 환불했습니다.` }
      if (loc === 'en') return { title: 'Refund issued', body: `Order ${code} was refunded ${event.amountLabel}.` }
      return { title: 'Shop đã hoàn tiền', body: `Đơn ${code}: shop đã hoàn ${event.amountLabel}.` }
    }
    case 'deposit_reminder': {
      const code = codeOf(event.orderCode, loc)
      if (loc === 'zh') {
        return { title: `${event.hours} 小时后提醒定金`, body: `订单 ${code} 仍待支付定金。这是 ${event.hours} 小时后的提醒。` }
      }
      if (loc === 'ja') {
        return { title: `${event.hours}時間後のデポジット案内`, body: `ご注文 ${code} はデポジット待ちです。` }
      }
      if (loc === 'ko') {
        return { title: `${event.hours}시간 후 계약금 안내`, body: `주문 ${code}이(가) 계약금을 기다리고 있습니다.` }
      }
      if (loc === 'en') {
        return {
          title: `Deposit reminder after ${event.hours} hours`,
          body: `Order ${code} is still awaiting a deposit. This is the ${event.hours}-hour reminder.`,
        }
      }
      return {
        title: `Nhắc đặt cọc sau ${event.hours} giờ`,
        body: `Đơn ${code} đang chờ đặt cọc. Đây là lời nhắc sau ${event.hours} giờ.`,
      }
    }
    case 'promo_grant': {
      if (loc === 'zh') {
        return {
          title: `您收到礼物：${event.promotionName}`,
          body: `优惠码 ${event.code} — 减 ${event.percent}%（最高 ${event.maxLabel}）。${event.days} 天后到期。请到「优惠钱包」查看。`,
        }
      }
      if (loc === 'ja') {
        return {
          title: `特典を受け取りました: ${event.promotionName}`,
          body: `コード ${event.code} — ${event.percent}% OFF（上限 ${event.maxLabel}）。${event.days}日で期限切れ。ウォレットで確認できます。`,
        }
      }
      if (loc === 'ko') {
        return {
          title: `선물을 받았습니다: ${event.promotionName}`,
          body: `코드 ${event.code} — ${event.percent}% 할인(최대 ${event.maxLabel}). ${event.days}일 후 만료. 지갑에서 확인하세요.`,
        }
      }
      if (loc === 'en') {
        return {
          title: `You received a gift: ${event.promotionName}`,
          body: `Code ${event.code} — ${event.percent}% off (max ${event.maxLabel}). Expires in ${event.days} days. See Promotions.`,
        }
      }
      return {
        title: `Bạn nhận quà: ${event.promotionName}`,
        body: `Mã ${event.code} — giảm ${event.percent}% (tối đa ${event.maxLabel}). Hết hạn sau ${event.days} ngày. Xem tại mục Khuyến mãi.`,
      }
    }
    default: {
      const neverEvent: never = event
      return { title: 'Thông báo', body: String(neverEvent) }
    }
  }
}
