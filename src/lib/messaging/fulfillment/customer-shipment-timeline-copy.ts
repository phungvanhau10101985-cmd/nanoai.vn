import type { WebLocale } from '@/lib/i18n/config'

/** Mặt lịch trình khách = 188 tracking. Tên shop thay cho 188.com.vn. */

export type ShipmentTimelineVariant = 'china_import' | 'vn_domestic'

const CHINA_STEP_KEYS = new Set([
  'tq_preparing',
  'tq_warehouse',
  'international_shipping',
  'at_customs',
  'domestic_shipping',
])

const VN_STEP_KEYS = new Set(['vn_picking', 'vn_packed'])

type TimelinePack = {
  headingChina: string
  headingVietnam: string
  processing: string
  footerChina: string
  footerVietnam: string
  confirmedDeposit: string
  confirmed: string
  tqPreparing: string
  tqWarehouse: string
  international: string
  customs: string
  domestic: string
  awaitingChina: string
  vnPicking: string
  vnPacked: string
  awaitingVietnam: string
  hintCustoms: string
  hintDomestic: string
  hintAwaiting: string
  hintVnPicking: string
  hintVnPacked: string
}

const PACKS: Record<WebLocale, TimelinePack> = {
  vi: {
    headingChina: 'Lịch trình Trung Quốc → Việt Nam',
    headingVietnam: 'Đóng gói & giao hàng tại Việt Nam',
    processing: 'Đang xử lý',
    footerChina:
      '{shop} trực tiếp vận hành đơn hàng từ Trung Quốc về Việt Nam và luôn ưu tiên xử lý nhanh nhất có thể. Mọi cập nhật mới sẽ hiển thị ngay tại đây.',
    footerVietnam:
      'Đơn hàng có sẵn tại Việt Nam đang được {shop} soạn, đóng gói và bàn giao cho đơn vị vận chuyển. Mọi cập nhật mới sẽ hiển thị tại đây.',
    confirmedDeposit: 'Đã đặt cọc — {shop} đã xác nhận đơn',
    confirmed: '{shop} đã xác nhận đơn hàng',
    tqPreparing: '{shop} TQ đang chuẩn bị & đóng gói hàng',
    tqWarehouse: 'Hàng đã về kho {shop} TQ',
    international: '{shop} đang vận chuyển quốc tế (TQ → VN)',
    customs: '{shop} đang làm thủ tục tại cửa khẩu',
    domestic: '{shop} đã thông quan — hàng về shop để đóng gói',
    awaitingChina: '{shop} đã đóng hàng & gửi shipper — chờ bạn xác nhận nhận hàng',
    vnPicking: '{shop} đang lấy và kiểm tra hàng tại kho Việt Nam',
    vnPacked: 'Hàng đã được kiểm tra — đang đóng gói để bàn giao shipper',
    awaitingVietnam: '{shop} đã gửi shipper — chờ bạn xác nhận nhận hàng',
    hintCustoms:
      '{shop} đang chủ động làm thủ tục tại cửa khẩu để chuyển hàng về cho bạn sớm nhất. Có bước tiếp theo, shop sẽ cập nhật ngay trên lịch trình này.',
    hintDomestic:
      'Hàng đã thông quan và đang được chuyển về {shop}. Nhân viên shop sẽ đóng gói và gửi cho shipper giao tới bạn.',
    hintAwaiting: '{shop} đã đóng hàng và gửi cho shipper. Vui lòng bấm «Đã nhận hàng» khi bạn nhận đủ hàng.',
    hintVnPicking: 'Nhân viên kho đang lấy đúng sản phẩm, size, màu và kiểm tra tình trạng hàng.',
    hintVnPacked: 'Hàng đang được đóng gói tại kho Việt Nam để bàn giao cho đơn vị vận chuyển.',
  },
  en: {
    headingChina: 'China → Vietnam timeline',
    headingVietnam: 'Packing and delivery in Vietnam',
    processing: 'In progress',
    footerChina:
      '{shop} handles this order from China to Vietnam and prioritizes the fastest route. New updates appear here.',
    footerVietnam:
      'This in-stock Vietnam order is being picked, packed, and handed to the carrier by {shop}. New updates appear here.',
    confirmedDeposit: 'Deposit received — {shop} confirmed the order',
    confirmed: '{shop} confirmed the order',
    tqPreparing: '{shop} China is preparing and packing the goods',
    tqWarehouse: 'Goods arrived at the {shop} China warehouse',
    international: '{shop} is shipping internationally (China → Vietnam)',
    customs: '{shop} is clearing customs',
    domestic: '{shop} cleared customs — goods are heading to the shop for packing',
    awaitingChina: '{shop} packed the order and handed it to the carrier — waiting for you to confirm delivery',
    vnPicking: '{shop} is picking and checking the goods in the Vietnam warehouse',
    vnPacked: 'Goods checked — packing for carrier handover',
    awaitingVietnam: '{shop} handed the parcel to the carrier — waiting for you to confirm delivery',
    hintCustoms:
      '{shop} is clearing customs so the goods can reach you sooner. The next step will show on this timeline.',
    hintDomestic:
      'Customs is done and the goods are on the way to {shop}. The shop will pack them and hand them to the carrier.',
    hintAwaiting: '{shop} packed the order and handed it to the carrier. Tap “I received the order” when everything arrives.',
    hintVnPicking: 'Warehouse staff are picking the right product, size, and color and checking condition.',
    hintVnPacked: 'The goods are being packed in Vietnam for carrier handover.',
  },
  zh: {
    headingChina: '中国 → 越南进度',
    headingVietnam: '越南打包与配送',
    processing: '处理中',
    footerChina: '{shop} 直接处理从中国到越南的订单，并尽量加快。新进度会显示在这里。',
    footerVietnam: '越南现货订单正在由 {shop} 拣货、打包并交给承运商。新进度会显示在这里。',
    confirmedDeposit: '已付定金 — {shop} 已确认订单',
    confirmed: '{shop} 已确认订单',
    tqPreparing: '{shop} 中国仓正在备货并打包',
    tqWarehouse: '货物已到达 {shop} 中国仓',
    international: '{shop} 正在国际运输（中国 → 越南）',
    customs: '{shop} 正在办理清关',
    domestic: '{shop} 已清关 — 货物正运回店铺打包',
    awaitingChina: '{shop} 已打包并交给承运商 — 等待您确认收货',
    vnPicking: '{shop} 正在越南仓拣货并检查',
    vnPacked: '已检查 — 正在打包交给承运商',
    awaitingVietnam: '{shop} 已交给承运商 — 等待您确认收货',
    hintCustoms: '{shop} 正在办理清关，以便尽快把货送到您手上。下一步会更新在这条进度上。',
    hintDomestic: '已清关，货物正在运往 {shop}。店铺会打包并交给承运商配送。',
    hintAwaiting: '{shop} 已打包并交给承运商。收到全部货物后请点「已收货」。',
    hintVnPicking: '仓库正在拣对商品、尺码、颜色并检查状态。',
    hintVnPacked: '货物正在越南仓打包，准备交给承运商。',
  },
  ja: {
    headingChina: '中国 → ベトナムの進捗',
    headingVietnam: 'ベトナムでの梱包と配送',
    processing: '処理中',
    footerChina: '{shop} が中国からベトナムまでの注文を直接扱い、できるだけ早く進めます。更新はこの画面に表示されます。',
    footerVietnam: 'ベトナム在庫の注文を {shop} がピッキング、梱包し、配送業者へ引き渡します。更新はこの画面に表示されます。',
    confirmedDeposit: 'デポジット受領 — {shop} が注文を確認しました',
    confirmed: '{shop} が注文を確認しました',
    tqPreparing: '{shop} 中国が商品を準備・梱包しています',
    tqWarehouse: '商品が {shop} 中国倉庫に到着しました',
    international: '{shop} が国際配送中です（中国 → ベトナム）',
    customs: '{shop} が通関手続き中です',
    domestic: '{shop} は通関済み — 店舗へ戻り梱包します',
    awaitingChina: '{shop} が梱包して配送業者へ渡しました — 受取確認をお待ちしています',
    vnPicking: '{shop} がベトナム倉庫でピッキングと検品をしています',
    vnPacked: '検品済み — 配送業者へ渡すため梱包中',
    awaitingVietnam: '{shop} が配送業者へ渡しました — 受取確認をお待ちしています',
    hintCustoms: '{shop} が通関を進めています。次のステップはこの進捗に表示されます。',
    hintDomestic: '通関済みで、商品は {shop} へ向かっています。店舗が梱包して配送業者へ渡します。',
    hintAwaiting: '{shop} が梱包して配送業者へ渡しました。すべて届いたら「受け取り済み」を押してください。',
    hintVnPicking: '倉庫が正しい商品・サイズ・色を取り、状態を確認しています。',
    hintVnPacked: 'ベトナム倉庫で配送業者へ渡すため梱包しています。',
  },
  ko: {
    headingChina: '중국 → 베트남 진행',
    headingVietnam: '베트남 포장 및 배송',
    processing: '처리 중',
    footerChina: '{shop}이 중국에서 베트남까지 주문을 직접 처리하며 가장 빠르게 진행합니다. 새 업데이트는 여기에 표시됩니다.',
    footerVietnam: '베트남 재고 주문은 {shop}이 피킹·포장 후 택배사에 인계합니다. 새 업데이트는 여기에 표시됩니다.',
    confirmedDeposit: '보증금 수령 — {shop}이 주문을 확인했습니다',
    confirmed: '{shop}이 주문을 확인했습니다',
    tqPreparing: '{shop} 중국이 상품을 준비하고 포장 중입니다',
    tqWarehouse: '상품이 {shop} 중국 창고에 도착했습니다',
    international: '{shop}이 국제 배송 중입니다 (중국 → 베트남)',
    customs: '{shop}이 통관 절차를 진행 중입니다',
    domestic: '{shop} 통관 완료 — 매장으로 이동해 포장합니다',
    awaitingChina: '{shop}이 포장해 택배사에 인계했습니다 — 수령 확인을 기다립니다',
    vnPicking: '{shop}이 베트남 창고에서 피킹·검수 중입니다',
    vnPacked: '검수 완료 — 택배사 인계를 위해 포장 중',
    awaitingVietnam: '{shop}이 택배사에 인계했습니다 — 수령 확인을 기다립니다',
    hintCustoms: '{shop}이 통관을 진행 중입니다. 다음 단계는 이 진행 상황에 표시됩니다.',
    hintDomestic: '통관이 끝났고 상품이 {shop}으로 이동 중입니다. 매장이 포장해 택배사에 전달합니다.',
    hintAwaiting: '{shop}이 포장해 택배사에 전달했습니다. 모두 받으시면 「수령 완료」를 눌러 주세요.',
    hintVnPicking: '창고에서 상품·사이즈·색상을 맞춰 상태를 확인하고 있습니다.',
    hintVnPacked: '베트남 창고에서 택배사 인계를 위해 포장 중입니다.',
  },
}

function packOf(locale: WebLocale): TimelinePack {
  return PACKS[locale] || PACKS.vi
}

function withShop(template: string, shopName: string): string {
  const shop = shopName.trim() || 'Shop'
  return template.replaceAll('{shop}', shop)
}

export function shipmentTimelineVariantFromSteps(stepKeys: Array<string | null | undefined>): ShipmentTimelineVariant | null {
  const keys = stepKeys.map((key) => String(key || ''))
  if (keys.some((key) => CHINA_STEP_KEYS.has(key))) return 'china_import'
  if (keys.some((key) => VN_STEP_KEYS.has(key))) return 'vn_domestic'
  return null
}

export function publicShipmentTimelineHeading(input: {
  locale: WebLocale
  variant: ShipmentTimelineVariant
}): string {
  const pack = packOf(input.locale)
  return input.variant === 'china_import' ? pack.headingChina : pack.headingVietnam
}

export function publicShipmentTimelineFooter(input: {
  locale: WebLocale
  shopName: string
  variant: ShipmentTimelineVariant
}): string {
  const pack = packOf(input.locale)
  const template = input.variant === 'china_import' ? pack.footerChina : pack.footerVietnam
  return withShop(template, input.shopName)
}

export function publicShipmentProcessingLabel(locale: WebLocale): string {
  return packOf(locale).processing
}

export function publicShipmentStepTitle(input: {
  locale: WebLocale
  shopName: string
  stepKey: string
  variant: ShipmentTimelineVariant
  depositFlow: boolean
}): string {
  const pack = packOf(input.locale)
  const shop = input.shopName
  const china = input.variant === 'china_import'
  const titles: Record<string, string> = {
    confirmed: input.depositFlow ? pack.confirmedDeposit : pack.confirmed,
    tq_preparing: pack.tqPreparing,
    tq_warehouse: pack.tqWarehouse,
    international_shipping: pack.international,
    at_customs: pack.customs,
    domestic_shipping: pack.domestic,
    vn_picking: pack.vnPicking,
    vn_packed: pack.vnPacked,
    awaiting_confirm: china ? pack.awaitingChina : pack.awaitingVietnam,
  }
  const template = titles[input.stepKey]
  return template ? withShop(template, shop) : ''
}

export function publicShipmentStepHint(input: {
  locale: WebLocale
  shopName: string
  stepKey: string
}): string {
  const pack = packOf(input.locale)
  const hints: Record<string, string> = {
    at_customs: pack.hintCustoms,
    domestic_shipping: pack.hintDomestic,
    awaiting_confirm: pack.hintAwaiting,
    vn_picking: pack.hintVnPicking,
    vn_packed: pack.hintVnPacked,
  }
  const template = hints[input.stepKey]
  return template ? withShop(template, input.shopName) : ''
}
