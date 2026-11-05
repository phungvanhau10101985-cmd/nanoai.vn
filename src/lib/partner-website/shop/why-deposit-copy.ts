import type { WebLocale } from '@/lib/i18n/config'

/** Tokens: `{shop}` `{code}` `{percent}` `{minAmount}` `{highOrderAmount}` `{highOrderPercent}`. `**…**` renders bold. */
export type WhyDepositCopy = {
  askButton: string
  pageTitle: string
  metaDescription: string
  leadOrder: string
  lead: string
  sectionWarehouseTitle: string
  sectionWarehouseP1: string
  sectionWarehouseP2: string
  sectionFeesTitle: string
  sectionFeesP1: string
  sectionFeesP2: string
  sectionHoldTitle: string
  sectionHoldP1: string
  sectionHoldP2: string
  sectionPartialTitle: string
  sectionPartialP1: string
  sectionPartialP2: string
  sectionPartialP3: string
  sectionKeepTitle: string
  sectionKeepP1: string
  sectionAfterTitle: string
  sectionAfterP1: string
  backToPay: string
  backToOrders: string
  zaloButton: string
  zaloHours: string
  zaloPasteHint: string
  zaloOpenedTitle: string
  zaloCopiedTitle: string
  zaloCopiedWithCode: string
  zaloCopiedPlain: string
  zaloMissingTitle: string
  howToBuy: string
  zaloMessageWithCode: string
  zaloMessagePlain: string
}

const vi: WhyDepositCopy = {
  askButton: 'Hỏi tại sao phải cọc?',
  pageTitle: 'Tại sao phải đặt cọc?',
  metaDescription:
    '{shop} có kho hàng ở nước ngoài, không mua hộ từ shop khác. Hàng vẫn cần đặt cọc vì đưa về Việt Nam tốn nhiều loại phí và để tránh hủy đơn giữa chừng.',
  leadOrder: 'Đơn #{code}.',
  lead: '{shop} có kho ở nước ngoài. Hàng xuất từ kho của shop, không mua hộ chỗ khác. Đưa về Việt Nam tốn nhiều loại phí nên cần cọc trước.',
  sectionWarehouseTitle: 'Hàng lấy từ kho của shop ở nước ngoài',
  sectionWarehouseP1:
    '{shop} nhập và giữ hàng tại kho riêng ở nước ngoài. Khi quý khách đặt, shop xuất đúng mẫu, đúng size từ kho của mình rồi chuyển về Việt Nam. Đơn không bị chuyển sang một shop khác để mua hộ.',
  sectionWarehouseP2:
    'Kho ở nước ngoài nên hàng chưa nằm sẵn tại Việt Nam để giao trong ngày. Shop chủ động nguồn hàng, quý khách vẫn nhận được mẫu shop đang bán.',
  sectionFeesTitle: 'Đưa về Việt Nam tốn nhiều loại phí',
  sectionFeesP1:
    'Từ kho đến tay quý khách còn cước vận chuyển quốc tế, phí thông quan, thuế và phí chuyển tiếp trong nước. Mỗi loại phí đều lớn, và shop phải chi trước khi hàng về tới Việt Nam.',
  sectionFeesP2:
    'Cọc là phần quý khách cùng chịu chi phí đường về. Phần còn lại trả khi nhận hàng, sau khi đã kiểm tra được hàng.',
  sectionHoldTitle: 'Cọc để giữ đơn, tránh hủy ngang',
  sectionHoldP1:
    'Hàng đã xuất kho và lên chuyến thì cước quốc tế cùng các loại phí không thu lại được. Mẫu đã tách theo size cũng khó bán lại cho người khác.',
  sectionHoldP2:
    'Cọc xác nhận quý khách giữ đơn. Shop chỉ chi phí vận chuyển cho đơn đã có chuyển khoản, nên đơn được xử lý thật, không bị hủy giữa chừng.',
  sectionPartialTitle: 'Quý khách chỉ cọc một phần',
  sectionPartialP1:
    'Mức mặc định là **{percent}% giá trị hàng**, tối thiểu **{minAmount}**. Phần còn lại và phí giao hàng trong nước, nếu có, trả khi nhận hàng.',
  sectionPartialP2:
    'Muốn trả hết thì chọn **cọc 100%** trên trang QR. Khoản đó gồm cả phí ship, không còn số phải trả lúc nhận.',
  sectionPartialP3:
    'Đơn từ **{highOrderAmount}** cọc **{highOrderPercent}%**, vì cước và các loại phí của đơn càng lớn.',
  sectionKeepTitle: 'Cọc vẫn được giữ đúng',
  sectionKeepP1:
    'Shop giao hàng có kiểm tra. Hàng không đúng mô tả hoặc lỗi sản xuất: gửi mẫu khác đúng mô tả hoặc hoàn tiền đặt cọc. Không vừa size: hỗ trợ đổi size 1 lần, không đổi mẫu.',
  sectionAfterTitle: 'Cọc xong shop xuất kho và chuyển về',
  sectionAfterP1:
    'Quét mã QR và ghi đúng nội dung chuyển khoản. Đúng nội dung thì shop xác nhận cọc tự động, xuất hàng từ kho nước ngoài và chuyển về Việt Nam.',
  backToPay: 'Quay lại thanh toán cọc',
  backToOrders: 'Xem đơn hàng của tôi',
  zaloButton: 'Nhắn Zalo cho shop',
  zaloHours: 'Giờ trả lời Zalo: 8h00–16h30, thứ Hai đến thứ Bảy.',
  zaloPasteHint: 'Bấm nút sẽ chép sẵn câu hỏi kèm mã đơn để dán vào chat.',
  zaloOpenedTitle: 'Đã mở Zalo',
  zaloCopiedTitle: 'Đã chép tin nhắn',
  zaloCopiedWithCode: 'Dán vào ô chat Zalo rồi gửi. Tin đã kèm mã đơn.',
  zaloCopiedPlain: 'Dán vào ô chat Zalo rồi gửi.',
  zaloMissingTitle: 'Shop chưa gắn Zalo',
  howToBuy: 'Xem hướng dẫn mua hàng',
  zaloMessageWithCode:
    'Em cần hỏi về đặt cọc đơn #{code}. Em đang xem trang thanh toán cọc trên {shop}.',
  zaloMessagePlain: 'Em cần hỏi về chính sách đặt cọc trên {shop}.',
}

const en: WhyDepositCopy = {
  askButton: 'Why is a deposit required?',
  pageTitle: 'Why is a deposit required?',
  metaDescription:
    '{shop} keeps stock in an overseas warehouse and does not buy from another shop on your behalf. A deposit is still required because bringing the goods to Vietnam costs several fees, and so the order is not cancelled halfway.',
  leadOrder: 'Order #{code}.',
  lead: '{shop} keeps stock overseas. Items ship from the shop’s own warehouse, not from another store buying on your behalf. Bringing them to Vietnam involves several fees, so a deposit is required first.',
  sectionWarehouseTitle: 'Items come from the shop’s overseas warehouse',
  sectionWarehouseP1:
    '{shop} imports and holds goods in its own warehouse abroad. When you order, the shop ships the exact style and size from that warehouse to Vietnam. The order is not passed to another shop to buy for you.',
  sectionWarehouseP2:
    'Because the warehouse is abroad, the item is not already in Vietnam for same-day delivery. The shop controls the source, and you still receive the item the shop is selling.',
  sectionFeesTitle: 'Getting the goods to Vietnam costs several fees',
  sectionFeesP1:
    'From the warehouse to you there is international freight, customs, tax, and domestic forwarding. Each fee is significant, and the shop pays them before the goods arrive in Vietnam.',
  sectionFeesP2:
    'The deposit is your share of that inbound cost. The rest is paid when you receive the goods, after you can check them.',
  sectionHoldTitle: 'A deposit holds the order and avoids a mid-way cancel',
  sectionHoldP1:
    'Once goods leave the warehouse and are on a shipment, international freight and the other fees cannot be recovered. A size that was already picked is also hard to resell.',
  sectionHoldP2:
    'The deposit confirms you are keeping the order. The shop only pays shipping for orders that already have a transfer, so the order is actually processed and not cancelled halfway.',
  sectionPartialTitle: 'You only deposit part of the total',
  sectionPartialP1:
    'The default is **{percent}% of the merchandise value**, with a minimum of **{minAmount}**. The rest, and any domestic delivery fee, is paid when you receive the goods.',
  sectionPartialP2:
    'To pay in full, choose **100% deposit** on the QR page. That amount includes shipping, so nothing is due on delivery.',
  sectionPartialP3:
    'Orders from **{highOrderAmount}** deposit **{highOrderPercent}%**, because freight and the other fees are larger on a bigger order.',
  sectionKeepTitle: 'The deposit is still protected',
  sectionKeepP1:
    'The shop delivers with a check. If the item does not match the description or has a manufacturing defect: a replacement that matches the description, or a refund of the deposit. If the size does not fit: one size exchange, not a style change.',
  sectionAfterTitle: 'After the deposit, the shop ships from the warehouse',
  sectionAfterP1:
    'Scan the QR code and enter the transfer note exactly. With the correct note, the shop confirms the deposit automatically, ships from the overseas warehouse, and brings the goods to Vietnam.',
  backToPay: 'Back to deposit payment',
  backToOrders: 'View my orders',
  zaloButton: 'Message the shop on Zalo',
  zaloHours: 'Zalo replies: 8:00–16:30, Monday to Saturday.',
  zaloPasteHint: 'The button copies a question that includes your order code so you can paste it into the chat.',
  zaloOpenedTitle: 'Zalo opened',
  zaloCopiedTitle: 'Message copied',
  zaloCopiedWithCode: 'Paste it into the Zalo chat and send. The message includes your order code.',
  zaloCopiedPlain: 'Paste it into the Zalo chat and send.',
  zaloMissingTitle: 'This shop has no Zalo link yet',
  howToBuy: 'See how to buy',
  zaloMessageWithCode:
    'I need to ask about the deposit for order #{code}. I am on the deposit payment page at {shop}.',
  zaloMessagePlain: 'I need to ask about the deposit policy at {shop}.',
}

const zh: WhyDepositCopy = {
  askButton: '为什么要付定金？',
  pageTitle: '为什么要付定金？',
  metaDescription:
    '{shop} 的货在海外仓库，不是代其他店铺购买。运回越南要承担多项费用，定金也用来避免订单中途取消。',
  leadOrder: '订单 #{code}。',
  lead: '{shop} 在海外有仓库。商品从店铺自己的仓库发出，不会转给别的店代购。运回越南要花多项费用，所以需要先付定金。',
  sectionWarehouseTitle: '商品来自店铺的海外仓库',
  sectionWarehouseP1:
    '{shop} 在海外自有仓库进货并存放。下单后，店铺从自己的仓库按正确款式和尺码发出，再运回越南。订单不会转给另一家店代购。',
  sectionWarehouseP2: '仓库在海外，所以货还没有在越南，不能当天送到。货源由店铺掌握，您收到的仍是店铺正在销售的商品。',
  sectionFeesTitle: '运回越南要承担多项费用',
  sectionFeesP1:
    '从仓库到您手里，还有国际运费、清关、税费和国内转运费。每一项都不小，而且店铺要在货到越南之前先垫付。',
  sectionFeesP2: '定金是您一起承担回程费用的部分。其余货款在收货、可以检查商品之后再付。',
  sectionHoldTitle: '定金用来留住订单，避免中途取消',
  sectionHoldP1: '货已出库并装运后，国际运费和其他费用收不回来。已经按尺码拣出的商品也很难再卖给别人。',
  sectionHoldP2: '定金表示您确认保留订单。店铺只为已经转账的订单支付运费，订单会真正处理，不会中途取消。',
  sectionPartialTitle: '您只需支付一部分定金',
  sectionPartialP1:
    '默认是货款的 **{percent}%**，最低 **{minAmount}**。其余金额以及境内运费（如有）在收货时支付。',
  sectionPartialP2: '想一次付清，请在二维码页面选择 **100% 定金**。该金额已含运费，收货时不用再付。',
  sectionPartialP3: '订单满 **{highOrderAmount}** 付 **{highOrderPercent}%** 定金，因为大单的运费和其他费用更高。',
  sectionKeepTitle: '定金仍然有保障',
  sectionKeepP1:
    '店铺发货时会核对。商品与描述不符或有生产缺陷：换发符合描述的商品，或退还定金。尺码不合：支持换尺码 1 次，不换款。',
  sectionAfterTitle: '付完定金后，店铺从仓库发货运回',
  sectionAfterP1: '请扫描二维码并准确填写转账备注。备注正确时，店铺会自动确认定金，从海外仓库发货并运回越南。',
  backToPay: '返回定金付款',
  backToOrders: '查看我的订单',
  zaloButton: '用 Zalo 联系店铺',
  zaloHours: 'Zalo 回复时间：8:00–16:30，周一至周六。',
  zaloPasteHint: '点击按钮会复制带订单号的问题，方便粘贴到聊天里。',
  zaloOpenedTitle: '已打开 Zalo',
  zaloCopiedTitle: '已复制消息',
  zaloCopiedWithCode: '粘贴到 Zalo 聊天后发送。消息里已包含订单号。',
  zaloCopiedPlain: '粘贴到 Zalo 聊天后发送。',
  zaloMissingTitle: '店铺还没有设置 Zalo',
  howToBuy: '查看购买指南',
  zaloMessageWithCode: '我想咨询订单 #{code} 的定金。我正在 {shop} 的定金付款页。',
  zaloMessagePlain: '我想咨询 {shop} 的定金政策。',
}

const ja: WhyDepositCopy = {
  askButton: 'なぜデポジットが必要ですか？',
  pageTitle: 'なぜデポジットが必要なのですか？',
  metaDescription:
    '{shop} は海外倉庫の在庫を扱い、他店への買い付け代行ではありません。ベトナムへ届ける費用がかかるため、また途中キャンセルを防ぐためにデポジットが必要です。',
  leadOrder: '注文 #{code}。',
  lead: '{shop} は海外に倉庫があります。商品はショップ自身の倉庫から出荷し、他店に買い付けを依頼しません。ベトナムへ届けるには複数の費用がかかるため、先にデポジットが必要です。',
  sectionWarehouseTitle: '商品はショップの海外倉庫から出荷します',
  sectionWarehouseP1:
    '{shop} は海外の自社倉庫で仕入れて保管しています。ご注文後、正しいデザインとサイズをその倉庫から出し、ベトナムへ送ります。別の店へ買い付け代行することはありません。',
  sectionWarehouseP2:
    '倉庫が海外にあるため、商品はまだベトナムになく、当日配送はできません。仕入れはショップが管理し、販売中の商品が届きます。',
  sectionFeesTitle: 'ベトナムへ届けるには複数の費用がかかります',
  sectionFeesP1:
    '倉庫からお客様まで、国際送料、通関、税金、国内転送料がかかります。どれも小さくなく、商品がベトナムに着く前にショップが先に支払います。',
  sectionFeesP2: 'デポジットは、その輸送費用を一緒に負担する分です。残りは、商品を確認できる受け取り時にお支払いください。',
  sectionHoldTitle: 'デポジットは注文を確保し、途中キャンセルを防ぎます',
  sectionHoldP1:
    '倉庫を出て輸送に乗った商品の国際送料やその他の費用は戻りません。サイズ別に取り分けた商品も、別のお客様へ売り直すのが難しくなります。',
  sectionHoldP2:
    'デポジットは注文を続ける確認です。ショップは入金済みの注文だけ送料を払うので、注文は実際に処理され、途中でキャンセルされません。',
  sectionPartialTitle: 'お支払いいただくのは代金の一部です',
  sectionPartialP1:
    '標準は商品代金の **{percent}%**、最低 **{minAmount}** です。残りと国内配送料がある場合は、受け取り時にお支払いください。',
  sectionPartialP2:
    '全額払う場合は、QRページで **デポジット 100%** を選びます。送料も含むため、受け取り時の支払いはありません。',
  sectionPartialP3:
    '**{highOrderAmount}** 以上の注文は **{highOrderPercent}%** です。注文が大きいほど送料などの費用も大きくなるためです。',
  sectionKeepTitle: 'デポジットは守られます',
  sectionKeepP1:
    'ショップは確認してから届けます。説明と違う、または製造不良の場合は、説明どおりの商品と交換するか、デポジットを返金します。サイズが合わない場合は、サイズ交換を1回まで対応します。デザインの変更はできません。',
  sectionAfterTitle: 'デポジット後に倉庫から出荷してベトナムへ送ります',
  sectionAfterP1:
    'QRを読み取り、振込内容を正確に記入してください。内容が正しければショップがデポジットを自動確認し、海外倉庫から出荷してベトナムへ送ります。',
  backToPay: 'デポジット支払いに戻る',
  backToOrders: '自分の注文を見る',
  zaloButton: 'Zaloでショップに連絡',
  zaloHours: 'Zaloの返信時間: 8:00–16:30、月曜から土曜。',
  zaloPasteHint: 'ボタンを押すと、注文番号入りの質問がコピーされ、チャットに貼れます。',
  zaloOpenedTitle: 'Zaloを開きました',
  zaloCopiedTitle: 'メッセージをコピーしました',
  zaloCopiedWithCode: 'Zaloのチャットに貼り付けて送信してください。注文番号が入っています。',
  zaloCopiedPlain: 'Zaloのチャットに貼り付けて送信してください。',
  zaloMissingTitle: 'ショップのZaloリンクがまだありません',
  howToBuy: '購入ガイドを見る',
  zaloMessageWithCode:
    '注文 #{code} のデポジットについて質問があります。{shop} のデポジット支払いページを見ています。',
  zaloMessagePlain: '{shop} のデポジット方針について質問があります。',
}

const ko: WhyDepositCopy = {
  askButton: '왜 보증금이 필요한가요?',
  pageTitle: '왜 보증금이 필요한가요?',
  metaDescription:
    '{shop}은 해외 창고 상품을 보내며 다른 가게에 구매 대행하지 않습니다. 베트남으로 가져오는 비용이 들고 주문이 중간에 취소되지 않도록 보증금이 필요합니다.',
  leadOrder: '주문 #{code}.',
  lead: '{shop}은 해외에 창고가 있습니다. 상품은 가게 창고에서 출고되며 다른 가게에 구매 대행하지 않습니다. 베트남으로 가져오려면 여러 비용이 들어 먼저 보증금이 필요합니다.',
  sectionWarehouseTitle: '상품은 가게의 해외 창고에서 나옵니다',
  sectionWarehouseP1:
    '{shop}은 해외 자체 창고에 상품을 입고해 보관합니다. 주문하면 그 창고에서 맞는 스타일과 사이즈를 출고해 베트남으로 보냅니다. 다른 가게에 구매 대행을 넘기지 않습니다.',
  sectionWarehouseP2:
    '창고가 해외에 있어 상품이 아직 베트남에 없으므로 당일 배송은 되지 않습니다. 상품 공급은 가게가 관리하며, 가게가 판매 중인 상품을 받습니다.',
  sectionFeesTitle: '베트남으로 가져오려면 여러 비용이 듭니다',
  sectionFeesP1:
    '창고에서 고객까지 국제 운송비, 통관, 세금, 국내 전달비가 있습니다. 각 비용이 크고, 상품이 베트남에 도착하기 전에 가게가 먼저 냅니다.',
  sectionFeesP2: '보증금은 그 입고 비용을 함께 부담하는 부분입니다. 나머지는 상품을 확인할 수 있는 수령 때 냅니다.',
  sectionHoldTitle: '보증금은 주문을 유지하고 중간 취소를 막습니다',
  sectionHoldP1:
    '상품이 창고를 떠나 운송에 올라가면 국제 운송비와 다른 비용은 돌려받지 못합니다. 사이즈별로 골라 둔 상품도 다른 사람에게 다시 팔기 어렵습니다.',
  sectionHoldP2:
    '보증금은 주문을 유지한다는 확인입니다. 가게는 입금된 주문만 운송비를 내므로 주문이 실제로 처리되고 중간에 취소되지 않습니다.',
  sectionPartialTitle: '상품 금액의 일부만 보증금으로 냅니다',
  sectionPartialP1:
    '기본은 상품 금액의 **{percent}%**, 최소 **{minAmount}** 입니다. 나머지와 국내 배송비가 있으면 수령 때 냅니다.',
  sectionPartialP2:
    '전액을 내려면 QR 페이지에서 **보증금 100%**를 고릅니다. 그 금액에 배송비가 포함되어 수령 때 낼 돈이 없습니다.',
  sectionPartialP3:
    '**{highOrderAmount}** 이상 주문은 **{highOrderPercent}%**입니다. 주문이 클수록 운송비와 다른 비용도 커지기 때문입니다.',
  sectionKeepTitle: '보증금은 그대로 보호됩니다',
  sectionKeepP1:
    '가게는 확인 후 배송합니다. 설명과 다르거나 제조 결함이면 설명과 같은 상품으로 바꾸거나 보증금을 환불합니다. 사이즈가 맞지 않으면 사이즈 교환 1회이며, 스타일 교환은 없습니다.',
  sectionAfterTitle: '보증금 후 창고에서 출고해 베트남으로 보냅니다',
  sectionAfterP1:
    'QR을 스캔하고 이체 내용을 정확히 적으세요. 내용이 맞으면 가게가 보증금을 자동 확인하고, 해외 창고에서 출고해 베트남으로 보냅니다.',
  backToPay: '보증금 결제로 돌아가기',
  backToOrders: '내 주문 보기',
  zaloButton: 'Zalo로 가게에 메시지',
  zaloHours: 'Zalo 답변 시간: 8:00–16:30, 월요일–토요일.',
  zaloPasteHint: '버튼을 누르면 주문 번호가 포함된 질문이 복사되어 채팅에 붙여 넣을 수 있습니다.',
  zaloOpenedTitle: 'Zalo를 열었습니다',
  zaloCopiedTitle: '메시지를 복사했습니다',
  zaloCopiedWithCode: 'Zalo 채팅에 붙여 넣고 보내세요. 메시지에 주문 번호가 있습니다.',
  zaloCopiedPlain: 'Zalo 채팅에 붙여 넣고 보내세요.',
  zaloMissingTitle: '가게에 Zalo 링크가 아직 없습니다',
  howToBuy: '구매 안내 보기',
  zaloMessageWithCode:
    '주문 #{code} 보증금에 대해 문의합니다. {shop} 보증금 결제 페이지를 보고 있습니다.',
  zaloMessagePlain: '{shop} 보증금 정책에 대해 문의합니다.',
}

const COPY: Record<WebLocale, WhyDepositCopy> = { vi, en, zh, ja, ko }

export function getWhyDepositCopy(locale: WebLocale): WhyDepositCopy {
  return COPY[locale] ?? COPY.en
}
