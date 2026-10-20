import type { LegalPageDoc } from '@/lib/i18n/dictionary-legal-pages'

export type MerchantCenterPages = {
  shipping: LegalPageDoc
  payment: LegalPageDoc
  contact: LegalPageDoc
}

const vi: MerchantCenterPages = {
  shipping: {
    pageTitle: 'Chính sách giao hàng',
    metaDescription:
      'NanoAI giao dịch vụ công nghệ thông tin trong ngày thanh toán. Phí giao 0 VND, xử lý 0 ngày, vận chuyển 0 ngày, từ Việt Nam.',
    lastUpdated: 'Cập nhật lần cuối: 19/10/2026',
    sections: [
      {
        heading: '1. Tóm tắt',
        paragraphs: [
          'Phí giao hàng: 0 VND.',
          'Thời gian xử lý: 0 ngày.',
          'Thời gian vận chuyển: 0 ngày.',
          'Dịch vụ được giao trong ngày thanh toán, từ Việt Nam tới khách tại Việt Nam.',
          'Không có kiện hàng và không dùng hãng vận chuyển.',
        ],
      },
      {
        heading: '2. Phạm vi',
        paragraphs: [
          'NanoAI bán dịch vụ công nghệ thông tin trên https://nanoai.vn. Không bán hàng hóa vật lý.',
          'Trang này là trang giao hàng riêng. Khách đọc được mà không cần đăng nhập.',
        ],
      },
      {
        heading: '3. Nơi giao và nơi xuất phát',
        paragraphs: [
          'Dịch vụ được cung cấp từ Việt Nam.',
          'Khách nhận dịch vụ trên tài khoản nanoai.vn. Không có kho hàng vật lý và không có địa chỉ kho để nhận kiện.',
        ],
      },
      {
        heading: '4. Thời gian giao',
        paragraphs: [
          'Thời gian xử lý là 0 ngày làm việc: dịch vụ được cấp khi thanh toán được ghi nhận.',
          'Thời gian vận chuyển là 0 ngày: không có chặng vận chuyển vì không có hàng hóa.',
          'Mốc giao là ngày thanh toán.',
        ],
      },
      {
        heading: '5. Phí giao',
        paragraphs: [
          'Phí giao hàng là 0 VND với mọi dịch vụ trên website.',
          'Không có phí theo tỉnh, không có phí tối thiểu và không phát sinh phí giao sau khi khách đã thấy số tiền trên màn hình thanh toán.',
        ],
      },
    ],
  },
  payment: {
    pageTitle: 'Chính sách thanh toán',
    metaDescription:
      'NanoAI thu tiền bằng chuyển khoản ngân hàng VND. Số tiền hiển thị đầy đủ trước khi khách xác nhận. Không cộng phí ẩn.',
    lastUpdated: 'Cập nhật lần cuối: 19/10/2026',
    sections: [
      {
        heading: '1. Cách thanh toán',
        paragraphs: [
          'Khách thanh toán bằng chuyển khoản ngân hàng bằng đồng Việt Nam (VND), theo mã QR và nội dung chuyển khoản trên màn hình thanh toán của nanoai.vn.',
          'Đây là cách thanh toán thông thường. Khách thấy số tiền, ngân hàng nhận và nội dung chuyển khoản trước khi chuyển.',
        ],
      },
      {
        heading: '2. Số tiền trước khi mua',
        paragraphs: [
          'Toàn bộ số tiền khách phải trả được hiển thị trên màn hình thanh toán trước khi khách xác nhận.',
          'NanoAI không cộng thêm phí sau khi khách đã thấy số tiền đó. Phí giao hàng là 0 VND.',
        ],
      },
      {
        heading: '3. Sau khi thanh toán',
        paragraphs: [
          'Khi khoản chuyển được ghi nhận, dịch vụ hoặc số dư tín dụng tương ứng được cộng trên tài khoản.',
          'Khoản đã thanh toán không được trả lại và không được hoàn tiền, theo https://nanoai.vn/chinh-sach-doi-tra. Giao dịch vụ theo https://nanoai.vn/chinh-sach-giao-hang.',
        ],
      },
      {
        heading: '4. Bảo mật thanh toán',
        paragraphs: [
          'Trang thanh toán chạy trên HTTPS. NanoAI không yêu cầu khách gửi mật khẩu ngân hàng hay mã thẻ trên biểu mẫu của website.',
        ],
      },
    ],
  },
  contact: {
    pageTitle: 'Liên hệ',
    metaDescription:
      'Liên hệ NanoAI qua support@nanoai.vn hoặc chat hỗ trợ. Giờ hỗ trợ 08:30–17:30, thứ Hai đến thứ Bảy, giờ Việt Nam.',
    lastUpdated: 'Cập nhật lần cuối: 19/10/2026',
    sections: [
      {
        heading: '1. Đơn vị',
        paragraphs: [
          'NanoAI vận hành website https://nanoai.vn và cung cấp dịch vụ công nghệ thông tin cho khách tại Việt Nam.',
        ],
      },
      {
        heading: '2. Email',
        paragraphs: [
          'Email hỗ trợ: support@nanoai.vn. Khách gửi được mà không cần đăng nhập.',
        ],
      },
      {
        heading: '3. Chat hỗ trợ',
        paragraphs: [
          'Chat trên website: https://nanoai.vn/support-chat.',
        ],
      },
      {
        heading: '4. Giờ hỗ trợ',
        paragraphs: [
          'Giờ hỗ trợ: 08:30–17:30, thứ Hai đến thứ Bảy, giờ Việt Nam.',
        ],
      },
      {
        heading: '5. Chính sách liên quan',
        paragraphs: [
          'Đổi trả: https://nanoai.vn/chinh-sach-doi-tra. Giao hàng: https://nanoai.vn/chinh-sach-giao-hang. Thanh toán: https://nanoai.vn/chinh-sach-thanh-toan. Bảo mật: https://nanoai.vn/privacy. Điều khoản: https://nanoai.vn/terms.',
        ],
      },
    ],
  },
}

const en: MerchantCenterPages = {
  shipping: {
    pageTitle: 'Shipping and delivery',
    metaDescription:
      'NanoAI delivers IT services on the payment date. Delivery fee 0 VND, handling time 0 days, transit time 0 days, from Vietnam.',
    lastUpdated: 'Last updated: 19 October 2026',
    sections: [
      {
        heading: '1. Summary',
        paragraphs: [
          'Delivery fee: 0 VND.',
          'Handling time: 0 days.',
          'Transit time: 0 days.',
          'The service is delivered on the payment date, from Vietnam to customers in Vietnam.',
          'There is no parcel and no carrier.',
        ],
      },
      {
        heading: '2. Scope',
        paragraphs: [
          'NanoAI sells information-technology services on https://nanoai.vn. It does not sell physical goods.',
          'This is a standalone delivery page. Anyone can read it without signing in.',
        ],
      },
      {
        heading: '3. Origin and destination',
        paragraphs: [
          'Services are provided from Vietnam.',
          'Customers receive the service on their nanoai.vn account. There is no physical warehouse and no parcel pickup address.',
        ],
      },
      {
        heading: '4. Delivery time',
        paragraphs: [
          'Handling time is 0 business days: the service is granted when the payment is recorded.',
          'Transit time is 0 days: there is no shipping leg because there is no physical item.',
          'The delivery date is the payment date.',
        ],
      },
      {
        heading: '5. Delivery fee',
        paragraphs: [
          'The delivery fee is 0 VND for every service on the website.',
          'There is no fee by province, no minimum-order shipping fee, and no delivery fee added after the amount is shown on the payment screen.',
        ],
      },
    ],
  },
  payment: {
    pageTitle: 'Payment policy',
    metaDescription:
      'NanoAI collects payment by bank transfer in VND. The full amount is shown before the customer confirms. No hidden fees are added.',
    lastUpdated: 'Last updated: 19 October 2026',
    sections: [
      {
        heading: '1. How to pay',
        paragraphs: [
          'Customers pay by bank transfer in Vietnamese dong (VND), using the QR code and transfer reference shown on the nanoai.vn payment screen.',
          'This is a standard payment method. The amount, receiving bank, and transfer reference are visible before the customer pays.',
        ],
      },
      {
        heading: '2. Price before purchase',
        paragraphs: [
          'The full amount due is shown on the payment screen before the customer confirms.',
          'NanoAI does not add a fee after that amount is shown. The delivery fee is 0 VND.',
        ],
      },
      {
        heading: '3. After payment',
        paragraphs: [
          'When the transfer is recorded, the service or the matching credit balance is added to the account.',
          'Paid amounts are not returnable and are not refundable, under https://nanoai.vn/chinh-sach-doi-tra. Delivery follows https://nanoai.vn/chinh-sach-giao-hang.',
        ],
      },
      {
        heading: '4. Payment security',
        paragraphs: [
          'The payment page uses HTTPS. NanoAI does not ask customers to submit a bank password or card number on a website form.',
        ],
      },
    ],
  },
  contact: {
    pageTitle: 'Contact',
    metaDescription:
      'Contact NanoAI at support@nanoai.vn or by support chat. Support hours 08:30–17:30, Monday to Saturday, Vietnam time.',
    lastUpdated: 'Last updated: 19 October 2026',
    sections: [
      {
        heading: '1. Business',
        paragraphs: [
          'NanoAI operates https://nanoai.vn and provides information-technology services to customers in Vietnam.',
        ],
      },
      {
        heading: '2. Email',
        paragraphs: [
          'Support email: support@nanoai.vn. Customers can write without signing in.',
        ],
      },
      {
        heading: '3. Support chat',
        paragraphs: ['Website chat: https://nanoai.vn/support-chat.'],
      },
      {
        heading: '4. Support hours',
        paragraphs: ['Support hours: 08:30–17:30, Monday to Saturday, Vietnam time.'],
      },
      {
        heading: '5. Related policies',
        paragraphs: [
          'Returns: https://nanoai.vn/chinh-sach-doi-tra. Delivery: https://nanoai.vn/chinh-sach-giao-hang. Payment: https://nanoai.vn/chinh-sach-thanh-toan. Privacy: https://nanoai.vn/privacy. Terms: https://nanoai.vn/terms.',
        ],
      },
    ],
  },
}

const zh: MerchantCenterPages = {
  shipping: {
    pageTitle: '配送政策',
    metaDescription: 'NanoAI 在付款当日交付信息技术服务。运费 0 VND，处理 0 天，运输 0 天，从越南发出。',
    lastUpdated: '最近更新：2026年10月19日',
    sections: [
      {
        heading: '1. 摘要',
        paragraphs: [
          '运费：0 VND。',
          '处理时间：0 天。',
          '运输时间：0 天。',
          '服务在付款当日从越南交付给越南客户。',
          '没有包裹，也不使用承运商。',
        ],
      },
      {
        heading: '2. 范围',
        paragraphs: [
          'NanoAI 在 https://nanoai.vn 销售信息技术服务，不销售实物。',
          '这是独立的配送页面，无需登录即可阅读。',
        ],
      },
      {
        heading: '3. 发出地与收货地',
        paragraphs: [
          '服务从越南提供。',
          '客户在 nanoai.vn 账户中接收服务。没有实体仓库，也没有包裹领取地址。',
        ],
      },
      {
        heading: '4. 交付时间',
        paragraphs: [
          '处理时间为 0 个工作日：付款入账后即开通服务。',
          '运输时间为 0 天：没有实物，因此没有运输路段。',
          '交付日即付款日。',
        ],
      },
      {
        heading: '5. 运费',
        paragraphs: [
          '网站上每项服务的运费都是 0 VND。',
          '不按省份收费，没有最低订单运费，付款页面显示金额后也不会再加运费。',
        ],
      },
    ],
  },
  payment: {
    pageTitle: '付款政策',
    metaDescription: 'NanoAI 以越南盾银行转账收款。确认前显示全部金额，不另加隐藏费用。',
    lastUpdated: '最近更新：2026年10月19日',
    sections: [
      {
        heading: '1. 付款方式',
        paragraphs: [
          '客户使用越南盾（VND）银行转账，并按 nanoai.vn 付款页面上的二维码和转账附言付款。',
          '这是常规付款方式。转账前可以看到金额、收款银行和转账附言。',
        ],
      },
      {
        heading: '2. 购买前的金额',
        paragraphs: [
          '客户确认前，应付总额显示在付款页面上。',
          '显示该金额后，NanoAI 不再加收费用。运费为 0 VND。',
        ],
      },
      {
        heading: '3. 付款之后',
        paragraphs: [
          '转账入账后，相应服务或积分余额记入账户。',
          '已付款项不退货、不退款，见 https://nanoai.vn/chinh-sach-doi-tra。交付见 https://nanoai.vn/chinh-sach-giao-hang。',
        ],
      },
      {
        heading: '4. 付款安全',
        paragraphs: ['付款页面使用 HTTPS。NanoAI 不要求客户在网站表单中提交银行密码或卡号。'],
      },
    ],
  },
  contact: {
    pageTitle: '联系我们',
    metaDescription: '通过 support@nanoai.vn 或在线客服联系 NanoAI。服务时间 08:30–17:30，周一至周六，越南时间。',
    lastUpdated: '最近更新：2026年10月19日',
    sections: [
      {
        heading: '1. 主体',
        paragraphs: ['NanoAI 运营 https://nanoai.vn，向越南客户提供信息技术服务。'],
      },
      {
        heading: '2. 邮箱',
        paragraphs: ['支持邮箱：support@nanoai.vn。无需登录即可发送。'],
      },
      {
        heading: '3. 在线客服',
        paragraphs: ['网站客服：https://nanoai.vn/support-chat。'],
      },
      {
        heading: '4. 服务时间',
        paragraphs: ['服务时间：08:30–17:30，周一至周六，越南时间。'],
      },
      {
        heading: '5. 相关政策',
        paragraphs: [
          '退换：https://nanoai.vn/chinh-sach-doi-tra。配送：https://nanoai.vn/chinh-sach-giao-hang。付款：https://nanoai.vn/chinh-sach-thanh-toan。隐私：https://nanoai.vn/privacy。条款：https://nanoai.vn/terms。',
        ],
      },
    ],
  },
}

const ja: MerchantCenterPages = {
  shipping: {
    pageTitle: '配送ポリシー',
    metaDescription:
      'NanoAI は支払日に IT サービスを提供します。配送料 0 VND、処理 0 日、輸送 0 日、ベトナムから提供します。',
    lastUpdated: '最終更新: 2026年10月19日',
    sections: [
      {
        heading: '1. 概要',
        paragraphs: [
          '配送料: 0 VND。',
          '処理日数: 0 日。',
          '輸送日数: 0 日。',
          'サービスは支払日に、ベトナムからベトナムのお客様へ提供されます。',
          '荷物はなく、配送業者も使いません。',
        ],
      },
      {
        heading: '2. 対象',
        paragraphs: [
          'NanoAI は https://nanoai.vn で IT サービスを販売します。物理的な商品は販売しません。',
          'これは独立した配送ページです。ログインなしで読めます。',
        ],
      },
      {
        heading: '3. 提供元と提供先',
        paragraphs: [
          'サービスはベトナムから提供します。',
          'お客様は nanoai.vn のアカウントで受け取ります。物理倉庫や荷物の受取住所はありません。',
        ],
      },
      {
        heading: '4. 提供までの時間',
        paragraphs: [
          '処理日数は 0 営業日です。入金が記録された時点でサービスを付与します。',
          '輸送日数は 0 日です。物理的な商品がないため輸送区間はありません。',
          '提供日は支払日です。',
        ],
      },
      {
        heading: '5. 配送料',
        paragraphs: [
          'ウェブサイト上のすべてのサービスの配送料は 0 VND です。',
          '地域別料金、最低注文の送料はなく、支払い画面に金額を表示した後で配送料を足すこともありません。',
        ],
      },
    ],
  },
  payment: {
    pageTitle: '支払いポリシー',
    metaDescription:
      'NanoAI は VND の銀行振込で受け取ります。確定前に全額を表示し、隠れた手数料は加えません。',
    lastUpdated: '最終更新: 2026年10月19日',
    sections: [
      {
        heading: '1. 支払い方法',
        paragraphs: [
          'お客様はベトナムドン（VND）の銀行振込で、nanoai.vn の支払い画面に表示される QR と振込内容に従って支払います。',
          'これは通常の支払い方法です。振込前に金額、受取銀行、振込内容が表示されます。',
        ],
      },
      {
        heading: '2. 購入前の金額',
        paragraphs: [
          '支払う全額は、お客様が確定する前に支払い画面へ表示されます。',
          'その金額を表示した後、NanoAI は手数料を足しません。配送料は 0 VND です。',
        ],
      },
      {
        heading: '3. 支払い後',
        paragraphs: [
          '振込が記録されると、サービスまたは対応するクレジット残高がアカウントに追加されます。',
          '支払い済みの金額は返品も返金もできません。https://nanoai.vn/chinh-sach-doi-tra に従います。提供は https://nanoai.vn/chinh-sach-giao-hang に従います。',
        ],
      },
      {
        heading: '4. 支払いの安全',
        paragraphs: [
          '支払いページは HTTPS です。NanoAI はウェブサイトのフォームで銀行のパスワードやカード番号の入力を求めません。',
        ],
      },
    ],
  },
  contact: {
    pageTitle: 'お問い合わせ',
    metaDescription:
      'NanoAI への連絡は support@nanoai.vn またはサポートチャットです。対応時間は 08:30–17:30、月曜から土曜、ベトナム時間です。',
    lastUpdated: '最終更新: 2026年10月19日',
    sections: [
      {
        heading: '1. 事業者',
        paragraphs: ['NanoAI は https://nanoai.vn を運営し、ベトナムのお客様に IT サービスを提供します。'],
      },
      {
        heading: '2. メール',
        paragraphs: ['サポートメール: support@nanoai.vn。ログインなしで送信できます。'],
      },
      {
        heading: '3. チャット',
        paragraphs: ['ウェブサイトのチャット: https://nanoai.vn/support-chat。'],
      },
      {
        heading: '4. 対応時間',
        paragraphs: ['対応時間: 08:30–17:30、月曜から土曜、ベトナム時間。'],
      },
      {
        heading: '5. 関連ポリシー',
        paragraphs: [
          '返品: https://nanoai.vn/chinh-sach-doi-tra。配送: https://nanoai.vn/chinh-sach-giao-hang。支払い: https://nanoai.vn/chinh-sach-thanh-toan。プライバシー: https://nanoai.vn/privacy。利用規約: https://nanoai.vn/terms。',
        ],
      },
    ],
  },
}

const ko: MerchantCenterPages = {
  shipping: {
    pageTitle: '배송 정책',
    metaDescription:
      'NanoAI는 결제일에 IT 서비스를 제공합니다. 배송비 0 VND, 처리 0일, 운송 0일, 베트남에서 제공합니다.',
    lastUpdated: '최종 업데이트: 2026년 10월 19일',
    sections: [
      {
        heading: '1. 요약',
        paragraphs: [
          '배송비: 0 VND.',
          '처리 시간: 0일.',
          '운송 시간: 0일.',
          '서비스는 결제일에 베트남에서 베트남 고객에게 제공됩니다.',
          '소포도 없고 택배사도 사용하지 않습니다.',
        ],
      },
      {
        heading: '2. 범위',
        paragraphs: [
          'NanoAI는 https://nanoai.vn 에서 IT 서비스를 판매합니다. 실물 상품은 판매하지 않습니다.',
          '별도의 배송 페이지입니다. 로그인 없이 읽을 수 있습니다.',
        ],
      },
      {
        heading: '3. 출발지와 도착지',
        paragraphs: [
          '서비스는 베트남에서 제공합니다.',
          '고객은 nanoai.vn 계정에서 받습니다. 실물 창고나 소포 수령 주소는 없습니다.',
        ],
      },
      {
        heading: '4. 제공 시간',
        paragraphs: [
          '처리 시간은 영업일 0일입니다. 결제가 기록되면 서비스를 부여합니다.',
          '운송 시간은 0일입니다. 실물이 없으므로 운송 구간이 없습니다.',
          '제공일은 결제일입니다.',
        ],
      },
      {
        heading: '5. 배송비',
        paragraphs: [
          '웹사이트의 모든 서비스 배송비는 0 VND입니다.',
          '지역별 요금, 최소 주문 배송비가 없고, 결제 화면에 금액을 보여 준 뒤 배송비를 더하지 않습니다.',
        ],
      },
    ],
  },
  payment: {
    pageTitle: '결제 정책',
    metaDescription:
      'NanoAI는 VND 계좌이체로 받습니다. 확인 전에 전액을 표시하며, 숨은 수수료를 더하지 않습니다.',
    lastUpdated: '최종 업데이트: 2026년 10월 19일',
    sections: [
      {
        heading: '1. 결제 방법',
        paragraphs: [
          '고객은 베트남 동(VND) 계좌이체로, nanoai.vn 결제 화면의 QR과 이체 내용을 따라 결제합니다.',
          '일반적인 결제 방법입니다. 이체 전에 금액, 수취 은행, 이체 내용이 보입니다.',
        ],
      },
      {
        heading: '2. 구매 전 금액',
        paragraphs: [
          '내야 할 전액은 고객이 확인하기 전에 결제 화면에 표시됩니다.',
          '그 금액을 보여 준 뒤 NanoAI는 수수료를 더하지 않습니다. 배송비는 0 VND입니다.',
        ],
      },
      {
        heading: '3. 결제 후',
        paragraphs: [
          '이체가 기록되면 서비스 또는 해당 크레딧 잔액이 계정에 추가됩니다.',
          '결제된 금액은 반품과 환불이 없습니다. https://nanoai.vn/chinh-sach-doi-tra 를 따릅니다. 제공은 https://nanoai.vn/chinh-sach-giao-hang 를 따릅니다.',
        ],
      },
      {
        heading: '4. 결제 보안',
        paragraphs: [
          '결제 페이지는 HTTPS입니다. NanoAI는 웹사이트 양식에 은행 비밀번호나 카드 번호를 입력하라고 하지 않습니다.',
        ],
      },
    ],
  },
  contact: {
    pageTitle: '문의',
    metaDescription:
      'NanoAI 문의는 support@nanoai.vn 또는 지원 채팅입니다. 지원 시간 08:30–17:30, 월요일–토요일, 베트남 시간.',
    lastUpdated: '최종 업데이트: 2026년 10월 19일',
    sections: [
      {
        heading: '1. 사업자',
        paragraphs: ['NanoAI는 https://nanoai.vn 을 운영하며 베트남 고객에게 IT 서비스를 제공합니다.'],
      },
      {
        heading: '2. 이메일',
        paragraphs: ['지원 이메일: support@nanoai.vn. 로그인 없이 보낼 수 있습니다.'],
      },
      {
        heading: '3. 채팅',
        paragraphs: ['웹사이트 채팅: https://nanoai.vn/support-chat.'],
      },
      {
        heading: '4. 지원 시간',
        paragraphs: ['지원 시간: 08:30–17:30, 월요일–토요일, 베트남 시간.'],
      },
      {
        heading: '5. 관련 정책',
        paragraphs: [
          '반품: https://nanoai.vn/chinh-sach-doi-tra. 배송: https://nanoai.vn/chinh-sach-giao-hang. 결제: https://nanoai.vn/chinh-sach-thanh-toan. 개인정보: https://nanoai.vn/privacy. 약관: https://nanoai.vn/terms.',
        ],
      },
    ],
  },
}

export const MERCHANT_CENTER_PAGES: Record<'vi' | 'en' | 'zh' | 'ja' | 'ko', MerchantCenterPages> = {
  vi,
  en,
  zh,
  ja,
  ko,
}
