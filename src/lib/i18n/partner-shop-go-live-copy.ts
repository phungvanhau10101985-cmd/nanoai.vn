import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerGoLiveItemId } from '@/lib/partner-website/shop/partner-shop-go-live'

export type PartnerGoLiveCopy = {
  title: string
  description: string
  requiredTitle: string
  optionalTitle: string
  requiredProgress: string
  readyBanner: string
  notReadyBanner: string
  openItem: string
  done: string
  todo: string
  items: Record<PartnerGoLiveItemId, { label: string; hint: string }>
}

const COPY: Record<WebLocale, PartnerGoLiveCopy> = {
  vi: {
    title: 'Checklist mở bán',
    description: 'Hoàn tất các mục bắt buộc trước khi nhận đơn trên web shop. Mục tùy chọn giúp shop trông đủ và chạy ads.',
    requiredTitle: 'Bắt buộc',
    optionalTitle: 'Nên làm thêm',
    requiredProgress: '{done}/{total} mục bắt buộc',
    readyBanner: 'Đã đủ điều kiện mở bán trên web.',
    notReadyBanner: 'Còn mục bắt buộc chưa xong — khách chưa nên đặt hàng.',
    openItem: 'Mở mục này',
    done: 'Xong',
    todo: 'Chưa xong',
    items: {
      brand: { label: 'Tên shop', hint: 'Tên hiển thị / thương hiệu trên Quản trị.' },
      website: { label: 'Đăng website', hint: 'Xuất bản web shop để khách mở được trang.' },
      products: { label: 'Có sản phẩm', hint: 'Ít nhất 1 sản phẩm trong kho hàng.' },
      payment: {
        label: 'Thanh toán',
        hint: 'COD (không cọc) hoặc số tài khoản / SePay để nhận tiền.',
      },
      shipping: {
        label: 'Phí vận chuyển',
        hint: 'Đặt phí đồng giá (0 = miễn phí). Tỉnh chưa cài riêng dùng mức này.',
      },
      logo: { label: 'Logo', hint: 'Logo header / Chat mua trong Thương hiệu & logo.' },
      slogan: { label: 'Slogan', hint: 'Câu slogan trên thanh trên và chân trang.' },
      domain: { label: 'Tên miền riêng', hint: 'Gắn domain và SSL active (không bắt buộc).' },
      ads: { label: 'Pixel quảng cáo', hint: 'Meta / GA4 / TikTok / GTM để chạy ads.' },
      contact: { label: 'Zalo / điện thoại', hint: 'Khách liên hệ được ngoài Chat mua.' },
      return_address: { label: 'Địa chỉ hoàn hàng', hint: 'Địa chỉ nhận hàng hoàn trên Cài đặt vận chuyển.' },
      sepay_hmac: { label: 'SePay HMAC', hint: 'Dán khóa whsec_ nếu đã bật chữ ký webhook.' },
    },
  },
  en: {
    title: 'Go-live checklist',
    description: 'Finish required items before taking orders. Optional items help the shop look complete and run ads.',
    requiredTitle: 'Required',
    optionalTitle: 'Recommended',
    requiredProgress: '{done}/{total} required',
    readyBanner: 'Ready to sell on the website.',
    notReadyBanner: 'Required items are still open — customers should not check out yet.',
    openItem: 'Open this',
    done: 'Done',
    todo: 'To do',
    items: {
      brand: { label: 'Shop name', hint: 'Display / brand name in admin.' },
      website: { label: 'Publish website', hint: 'Publish the shop so customers can open it.' },
      products: { label: 'Products in stock', hint: 'At least one product in inventory.' },
      payment: { label: 'Payments', hint: 'COD (no deposit) or a bank / SePay account.' },
      shipping: {
        label: 'Shipping fee',
        hint: 'Set the flat fee (0 = free). Provinces without a custom rate use this fee.',
      },
      logo: { label: 'Logo', hint: 'Header / Chat logo in Brand & logos.' },
      slogan: { label: 'Slogan', hint: 'Tagline on the top bar and footer.' },
      domain: { label: 'Custom domain', hint: 'Attach a domain with active SSL (optional).' },
      ads: { label: 'Ad pixels', hint: 'Meta / GA4 / TikTok / GTM.' },
      contact: { label: 'Zalo / phone', hint: 'A way to reach you besides Chat.' },
      return_address: { label: 'Return address', hint: 'Shop return address in shipping settings.' },
      sepay_hmac: { label: 'SePay HMAC', hint: 'Paste the whsec_ key if webhook signing is on.' },
    },
  },
  zh: {
    title: '开售清单',
    description: '先完成必填项再接单。可选项让店铺更完整并便于投放广告。',
    requiredTitle: '必填',
    optionalTitle: '建议完成',
    requiredProgress: '必填 {done}/{total}',
    readyBanner: '已可在网站开售。',
    notReadyBanner: '仍有必填项未完成 — 暂不建议顾客下单。',
    openItem: '打开此项',
    done: '已完成',
    todo: '未完成',
    items: {
      brand: { label: '店铺名称', hint: '后台显示名 / 品牌名。' },
      website: { label: '发布网站', hint: '发布店铺网站供顾客访问。' },
      products: { label: '有商品', hint: '库存中至少 1 件商品。' },
      payment: { label: '收款', hint: '货到付款（无定金）或银行 / SePay 账户。' },
      shipping: { label: '运费', hint: '设置统一运费（0 = 包邮）。未单独设置的省份使用该费用。' },
      logo: { label: 'Logo', hint: '页头 / 咨询聊天 Logo。' },
      slogan: { label: '口号', hint: '顶栏与页脚标语。' },
      domain: { label: '独立域名', hint: '绑定域名且 SSL 生效（可选）。' },
      ads: { label: '广告像素', hint: 'Meta / GA4 / TikTok / GTM。' },
      contact: { label: 'Zalo / 电话', hint: '除咨询聊天外的联系方式。' },
      return_address: { label: '退货地址', hint: '物流设置中的退货地址。' },
      sepay_hmac: { label: 'SePay HMAC', hint: '若已开启 webhook 签名，请粘贴 whsec_。' },
    },
  },
  ja: {
    title: '公開前チェックリスト',
    description: '受注の前に必須項目を完了してください。任意項目は見た目と広告に役立ちます。',
    requiredTitle: '必須',
    optionalTitle: '推奨',
    requiredProgress: '必須 {done}/{total}',
    readyBanner: 'サイトで販売を開始できます。',
    notReadyBanner: '必須項目が残っています。まだ注文を受けないでください。',
    openItem: '開く',
    done: '完了',
    todo: '未完了',
    items: {
      brand: { label: 'ショップ名', hint: '管理画面の表示名 / ブランド名。' },
      website: { label: 'サイト公開', hint: '店舗サイトを公開します。' },
      products: { label: '商品あり', hint: '在庫に商品が 1 件以上。' },
      payment: { label: '支払い', hint: '代引き（デポジットなし）または銀行 / SePay。' },
      shipping: { label: '送料', hint: '一律送料（0 = 無料）。未設定の省は一律料金です。' },
      logo: { label: 'ロゴ', hint: 'ヘッダー / チャットのロゴ。' },
      slogan: { label: 'スローガン', hint: 'トップバーとフッターのキャッチ。' },
      domain: { label: '独自ドメイン', hint: 'SSL 有効なドメイン（任意）。' },
      ads: { label: '広告ピクセル', hint: 'Meta / GA4 / TikTok / GTM。' },
      contact: { label: 'Zalo / 電話', hint: 'チャット以外の連絡先。' },
      return_address: { label: '返送先', hint: '配送設定の返送先住所。' },
      sepay_hmac: { label: 'SePay HMAC', hint: 'Webhook 署名を使う場合は whsec_ を保存。' },
    },
  },
  ko: {
    title: '판매 시작 체크리스트',
    description: '주문을 받기 전에 필수 항목을 마치세요. 선택 항목은 매장 완성도와 광고에 도움이 됩니다.',
    requiredTitle: '필수',
    optionalTitle: '권장',
    requiredProgress: '필수 {done}/{total}',
    readyBanner: '웹에서 판매할 준비가 되었습니다.',
    notReadyBanner: '필수 항목이 남아 있습니다. 아직 주문을 받지 마세요.',
    openItem: '이 항목 열기',
    done: '완료',
    todo: '미완료',
    items: {
      brand: { label: '샵 이름', hint: '관리 화면의 표시 이름 / 브랜드명.' },
      website: { label: '웹사이트 게시', hint: '고객이 열 수 있도록 샵을 게시합니다.' },
      products: { label: '상품 있음', hint: '재고에 상품이 1개 이상.' },
      payment: { label: '결제', hint: '착불(보증금 없음) 또는 계좌 / SePay.' },
      shipping: { label: '배송비', hint: '기본 배송비(0 = 무료). 별도 설정 없는 성은 이 금액을 씁니다.' },
      logo: { label: '로고', hint: '헤더 / 채팅 로고.' },
      slogan: { label: '슬로건', hint: '상단 바와 푸터 문구.' },
      domain: { label: '자체 도메인', hint: 'SSL이 켜진 도메인(선택).' },
      ads: { label: '광고 픽셀', hint: 'Meta / GA4 / TikTok / GTM.' },
      contact: { label: 'Zalo / 전화', hint: '채팅 외 연락 수단.' },
      return_address: { label: '반송 주소', hint: '배송 설정의 반품 주소.' },
      sepay_hmac: { label: 'SePay HMAC', hint: '웹훅 서명을 쓰면 whsec_를 저장하세요.' },
    },
  },
}

export function partnerGoLiveCopy(locale: WebLocale): PartnerGoLiveCopy {
  return COPY[locale] ?? COPY.en
}
