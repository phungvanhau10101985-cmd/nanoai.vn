/**
 * Câu hỏi khách thường hỏi khi mua — soạn sẵn phía nền tảng.
 * Chuỗi từ khóa dùng cho khớp tin nhắn (đa ngôn ngữ, tách bởi partner-ai-faq parseTriggerKeywords).
 */
export const PARTNER_FAQ_PRESET_KEYS = [
  'stock',
  'shipping',
  'price',
  'size_fit',
  'payment',
  'return_policy',
  'order_track',
  'warranty',
  'authentic',
  'promo',
] as const

export type PartnerFaqPresetKey = (typeof PARTNER_FAQ_PRESET_KEYS)[number]

const KEYWORD_BLOBS: Record<PartnerFaqPresetKey, string> = {
  stock:
    'còn hàng,hết hàng,còn không,còn size,available,in stock,out of stock,有货,没货,库存,在庫,在庫あり,재고,품절',
  shipping:
    'giao hàng,ship,phí ship,vận chuyển,bao lâu nhận,thời gian giao,delivery,shipping,freight,送货,邮费,运费,配送,発送,送料,배송,배송비',
  price:
    'giá,bao nhiêu tiền,giá bao nhiêu,giá sao,how much,price,cost,多少钱,什么价,价格,値段,いくら,価格,가격,얼마',
  size_fit:
    'size,cỡ,mặc vừa,chọn size,bảng size,sizing,尺码,尺寸,大小,サイズ,合う,사이즈,핏',
  payment:
    'thanh toán,cod,chuyển khoản,trả tiền,payment,pay by,card,付款,支付,怎么付,支払い,決済,결제,입금',
  return_policy:
    'đổi trả,hoàn tiền,trả hàng,refund,return policy,退货,退款,返品,返金,환불,교환',
  order_track:
    'theo dõi đơn,mã vận đơn,tracking,đơn hàng của tôi,order status,订单,物流,追跡,주문,배송조회',
  warranty:
    'bảo hành,warranty,guarantee,保修,质保,保証,보증',
  authentic:
    'chính hàng,chính hãng,hàng thật,fake,authentic,genuine,正品,假货,本物,正規品,정품,가품',
  promo:
    'khuyến mãi,mã giảm giá,voucher,coupon,code giảm,promo,sale off,优惠,折扣,优惠券,割引,クーポン,할인,쿠폰',
}

export function isPartnerFaqPresetKey(s: string): s is PartnerFaqPresetKey {
  return (PARTNER_FAQ_PRESET_KEYS as readonly string[]).includes(s)
}

export function presetKeywordBlob(key: PartnerFaqPresetKey): string {
  return KEYWORD_BLOBS[key]
}

export function presetSortOrder(key: PartnerFaqPresetKey): number {
  return PARTNER_FAQ_PRESET_KEYS.indexOf(key)
}

/** Server trả về trong `error` — client map sang chuỗi đã dịch (không export từ file `use server`). */
export const PARTNER_FAQ_PRESET_ANSWER_REQUIRED = 'PRESET_ANSWER_REQUIRED' as const

/** FAQ tuỳ chỉnh: bật “Đang dùng” thì cần ít nhất một từ khóa khớp (≥2 ký tự). */
export const PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED = 'CUSTOM_FAQ_KEYWORDS_REQUIRED' as const
