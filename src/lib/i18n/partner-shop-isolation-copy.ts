import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerIsolationItemId, PartnerIsolationState } from '@/lib/partner-website/shop/partner-shop-isolation'

export type PartnerIsolationCopy = {
  title: string
  description: string
  autoTitle: string
  ackTitle: string
  optionalTitle: string
  requiredProgress: string
  readyBanner: string
  notReadyBanner: string
  loadError: string
  saveError: string
  openItem: string
  markDone: string
  unmark: string
  states: Record<PartnerIsolationState, string>
  items: Record<PartnerIsolationItemId, { label: string; hint: string }>
}

const COPY: Record<WebLocale, PartnerIsolationCopy> = {
  vi: {
    title: 'Tách bạch shop',
    description:
      'Khi cài shop SaaS mới, hoàn tất checklist này để tên miền, pháp lý, quảng cáo và ảnh không trùng workspace khác.',
    autoTitle: 'Hệ thống đối chiếu',
    ackTitle: 'Tự xác nhận',
    optionalTitle: 'Kênh khác',
    requiredProgress: '{done}/{total} mục bắt buộc',
    readyBanner: 'Các mục bắt buộc đã riêng. Shop này không còn trùng dữ liệu đã kiểm với workspace khác.',
    notReadyBanner: 'Còn mục trống hoặc trùng workspace khác. Giữ shop này chưa chạy quảng cáo cho đến khi xong.',
    loadError: 'Chưa tải được checklist. Chạy migration isolation rồi tải lại trang.',
    saveError: 'Chưa lưu được xác nhận.',
    openItem: 'Mở mục này',
    markDone: 'Đã kiểm',
    unmark: 'Bỏ xác nhận',
    states: { ok: 'Riêng', missing: 'Chưa có', shared: 'Trùng shop khác', unused: 'Không dùng' },
    items: {
      brand: { label: 'Tên shop', hint: 'Tên hiển thị hoặc thương hiệu khác mọi workspace khác.' },
      domain: { label: 'Tên miền riêng', hint: 'Domain đã SSL, hostname không trùng shop khác.' },
      phone: { label: 'Số điện thoại', hint: 'SĐT trên site thuộc khách này, không dùng số của shop khác.' },
      bank: { label: 'Tài khoản nhận tiền', hint: 'STK ngân hàng hoặc SePay khác mọi shop khác.' },
      return_address: { label: 'Địa chỉ hoàn hàng', hint: 'Địa chỉ nhận hoàn trên Cài đặt vận chuyển, riêng shop này.' },
      google_ads: { label: 'Mã Google Ads AW-', hint: 'Mã chuyển đổi của đúng tài khoản Ads khách này.' },
      ga4: { label: 'GA4', hint: 'Mã đo GA4 riêng, không dán chung property với shop khác.' },
      gtm: { label: 'GTM', hint: 'Container GTM riêng của shop này.' },
      images: {
        label: 'Ảnh và logo',
        hint: 'Ảnh kho, logo, favicon, icon Chat mua nằm trên CDN của shop này. Không dùng link ảnh hoặc origin của workspace khác.',
      },
      meta_pixel: { label: 'Pixel Meta', hint: 'Để trống nếu không chạy Meta. Nếu điền thì ID phải khác mọi shop khác.' },
      tiktok_pixel: { label: 'Pixel TikTok', hint: 'Để trống nếu không chạy TikTok. Nếu điền thì ID phải khác mọi shop khác.' },
      ads_account: {
        label: 'Tài khoản Google Ads',
        hint: 'Tài khoản Ads (email Google) của khách này, không đăng nhập chung tài khoản shop khác.',
      },
      merchant_center: {
        label: 'Merchant Center',
        hint: 'Merchant Center xác minh bằng giấy tờ hộ kinh doanh / doanh nghiệp của đúng khách này.',
      },
      ads_billing: {
        label: 'Hồ sơ trả tiền quảng cáo',
        hint: 'Thẻ hoặc hồ sơ thanh toán Ads thuộc khách này, không dùng hồ sơ shop khác.',
      },
      search_console: {
        label: 'Search Console',
        hint: 'Property Search Console là đúng tên miền shop này.',
      },
      company_page: {
        label: 'Trang Thông tin đơn vị',
        hint: 'Thay đoạn mẫu. Ghi tên pháp lý, MST và địa chỉ của đúng khách này rồi xác nhận đã đọc lại trang.',
      },
    },
  },
  en: {
    title: 'Shop separation',
    description:
      'When setting up a new SaaS shop, finish this checklist so the domain, legal identity, ads, and images do not match another workspace.',
    autoTitle: 'Checked against other shops',
    ackTitle: 'Confirm yourself',
    optionalTitle: 'Other channels',
    requiredProgress: '{done}/{total} required',
    readyBanner: 'Required items are unique. This shop no longer shares the checked data with another workspace.',
    notReadyBanner: 'Some items are empty or shared with another workspace. Do not run ads until they are done.',
    loadError: 'Could not load the checklist. Apply the isolation migration, then reload.',
    saveError: 'Could not save the confirmation.',
    openItem: 'Open this',
    markDone: 'Checked',
    unmark: 'Undo',
    states: { ok: 'Separate', missing: 'Missing', shared: 'Shared with another shop', unused: 'Not used' },
    items: {
      brand: { label: 'Shop name', hint: 'Display or brand name differs from every other workspace.' },
      domain: { label: 'Custom domain', hint: 'SSL domain whose hostname is not used by another shop.' },
      phone: { label: 'Phone', hint: 'Public phone belongs to this customer, not another shop.' },
      bank: { label: 'Payout account', hint: 'Bank or SePay account number differs from every other shop.' },
      return_address: { label: 'Return address', hint: 'Return address in shipping settings belongs to this shop.' },
      google_ads: { label: 'Google Ads AW-', hint: 'Conversion id from this customer’s own Ads account.' },
      ga4: { label: 'GA4', hint: 'A GA4 property that is not reused from another shop.' },
      gtm: { label: 'GTM', hint: 'A GTM container that belongs to this shop.' },
      images: {
        label: 'Images and logo',
        hint: 'Catalog images, logo, favicon, and Chat icon use this shop’s CDN. Do not reuse another workspace’s image links or origin.',
      },
      meta_pixel: { label: 'Meta pixel', hint: 'Leave empty if Meta is off. If set, the id must differ from every other shop.' },
      tiktok_pixel: { label: 'TikTok pixel', hint: 'Leave empty if TikTok is off. If set, the id must differ from every other shop.' },
      ads_account: { label: 'Google Ads account', hint: 'This customer’s own Ads login, not another shop’s Google account.' },
      merchant_center: { label: 'Merchant Center', hint: 'Verified with this customer’s business registration documents.' },
      ads_billing: { label: 'Ads billing profile', hint: 'Ads payment profile belongs to this customer.' },
      search_console: { label: 'Search Console', hint: 'The Search Console property is this shop’s domain.' },
      company_page: {
        label: 'Company page',
        hint: 'Replace the template. Enter this customer’s legal name, tax id, and address, then confirm you re-read the page.',
      },
    },
  },
  zh: {
    title: '店铺隔离',
    description: '新建 SaaS 店铺时完成此清单，使域名、主体、广告和图片不与其他工作区重复。',
    autoTitle: '系统对照',
    ackTitle: '人工确认',
    optionalTitle: '其他渠道',
    requiredProgress: '必填 {done}/{total}',
    readyBanner: '必填项已独立。已核对的数据不再与其他工作区重复。',
    notReadyBanner: '仍有空项或与其他工作区重复。完成前不要投放广告。',
    loadError: '清单加载失败。请先执行 isolation 迁移再刷新。',
    saveError: '确认未能保存。',
    openItem: '打开此项',
    markDone: '已核对',
    unmark: '取消确认',
    states: { ok: '独立', missing: '未填写', shared: '与其他店重复', unused: '未使用' },
    items: {
      brand: { label: '店铺名称', hint: '显示名或品牌名与其他工作区都不同。' },
      domain: { label: '独立域名', hint: '已启用 SSL，主机名不与其他店重复。' },
      phone: { label: '电话', hint: '站上电话属于该客户，不是其他店的号码。' },
      bank: { label: '收款账户', hint: '银行或 SePay 账号与其他店都不同。' },
      return_address: { label: '退货地址', hint: '物流设置中的退货地址属于本店。' },
      google_ads: { label: 'Google Ads AW-', hint: '使用该客户自己的 Ads 转化 ID。' },
      ga4: { label: 'GA4', hint: '独立的 GA4 媒体资源，不与其他店共用。' },
      gtm: { label: 'GTM', hint: '本店自己的 GTM 容器。' },
      images: { label: '图片与 Logo', hint: '商品图、Logo、favicon、咨询图标使用本店 CDN，不引用其他工作区的图片或来源地址。' },
      meta_pixel: { label: 'Meta 像素', hint: '不用 Meta 可留空。若填写，ID 必须与其他店不同。' },
      tiktok_pixel: { label: 'TikTok 像素', hint: '不用 TikTok 可留空。若填写，ID 必须与其他店不同。' },
      ads_account: { label: 'Google Ads 账号', hint: '使用该客户自己的 Ads 登录，不共用其他店的 Google 账号。' },
      merchant_center: { label: 'Merchant Center', hint: '用该客户的营业执照 / 户照完成验证。' },
      ads_billing: { label: '广告付款资料', hint: '广告付款资料属于该客户。' },
      search_console: { label: 'Search Console', hint: '资源是本店域名。' },
      company_page: { label: '单位信息页', hint: '替换模板文案，写上该客户的法定名称、税号和地址，然后确认已复查页面。' },
    },
  },
  ja: {
    title: 'ショップ分離',
    description: '新しい SaaS ショップの設定時に、ドメイン・法的情報・広告・画像が他ワークスペースと重ならないよう確認します。',
    autoTitle: 'システム照合',
    ackTitle: '手動確認',
    optionalTitle: 'その他のチャネル',
    requiredProgress: '必須 {done}/{total}',
    readyBanner: '必須項目は独立しています。照合済みのデータは他ワークスペースと重なっていません。',
    notReadyBanner: '空欄または他ワークスペースと重複する項目があります。完了まで広告を出さないでください。',
    loadError: 'チェックリストを読み込めません。isolation のマイグレーション後に再読み込みしてください。',
    saveError: '確認を保存できませんでした。',
    openItem: '開く',
    markDone: '確認済み',
    unmark: '確認を外す',
    states: { ok: '独立', missing: '未入力', shared: '他店と重複', unused: '未使用' },
    items: {
      brand: { label: 'ショップ名', hint: '表示名またはブランド名が他のワークスペースと異なります。' },
      domain: { label: '独自ドメイン', hint: 'SSL 済みで、ホスト名が他店と重なりません。' },
      phone: { label: '電話番号', hint: 'サイト上の電話番号はこの顧客のもので、他店の番号ではありません。' },
      bank: { label: '入金口座', hint: '銀行または SePay の口座番号が他店と異なります。' },
      return_address: { label: '返送先', hint: '配送設定の返送先はこのショップのものです。' },
      google_ads: { label: 'Google Ads AW-', hint: 'この顧客自身の Ads アカウントのコンバージョン ID。' },
      ga4: { label: 'GA4', hint: '他店と共有しない GA4 プロパティ。' },
      gtm: { label: 'GTM', hint: 'このショップ専用の GTM コンテナ。' },
      images: { label: '画像とロゴ', hint: '商品画像、ロゴ、favicon、チャットアイコンはこの店の CDN。他ワークスペースの画像 URL やオリジンは使いません。' },
      meta_pixel: { label: 'Meta ピクセル', hint: '使わない場合は空欄。入力するなら他店と異なる ID。' },
      tiktok_pixel: { label: 'TikTok ピクセル', hint: '使わない場合は空欄。入力するなら他店と異なる ID。' },
      ads_account: { label: 'Google Ads アカウント', hint: 'この顧客自身の Ads ログイン。他店の Google アカウントは使いません。' },
      merchant_center: { label: 'Merchant Center', hint: 'この顧客の事業者登録書類で確認済み。' },
      ads_billing: { label: '広告の支払いプロファイル', hint: '広告の支払い情報はこの顧客のものです。' },
      search_console: { label: 'Search Console', hint: 'プロパティはこのショップのドメインです。' },
      company_page: { label: '事業者情報ページ', hint: 'ひな型を置き換え、この顧客の法的名称・税番号・住所を記入したあと、ページを読み直して確認します。' },
    },
  },
  ko: {
    title: '샵 분리',
    description: '새 SaaS 샵을 설정할 때 도메인, 법적 주체, 광고, 이미지가 다른 워크스페이스와 겹치지 않도록 이 체크리스트를 마칩니다.',
    autoTitle: '시스템 대조',
    ackTitle: '직접 확인',
    optionalTitle: '다른 채널',
    requiredProgress: '필수 {done}/{total}',
    readyBanner: '필수 항목이 분리되었습니다. 확인한 데이터는 다른 워크스페이스와 겹치지 않습니다.',
    notReadyBanner: '비어 있거나 다른 워크스페이스와 겹치는 항목이 있습니다. 마치기 전에는 광고를 켜지 마세요.',
    loadError: '체크리스트를 불러오지 못했습니다. isolation 마이그레이션 후 다시 불러오세요.',
    saveError: '확인을 저장하지 못했습니다.',
    openItem: '이 항목 열기',
    markDone: '확인함',
    unmark: '확인 취소',
    states: { ok: '분리됨', missing: '없음', shared: '다른 샵과 중복', unused: '사용 안 함' },
    items: {
      brand: { label: '샵 이름', hint: '표시 이름 또는 브랜드명이 다른 모든 워크스페이스와 다릅니다.' },
      domain: { label: '자체 도메인', hint: 'SSL이 켜져 있고 호스트명이 다른 샵과 겹치지 않습니다.' },
      phone: { label: '전화번호', hint: '사이트 전화번호는 이 고객의 것이며 다른 샵 번호가 아닙니다.' },
      bank: { label: '입금 계좌', hint: '은행 또는 SePay 계좌번호가 다른 샵과 다릅니다.' },
      return_address: { label: '반송 주소', hint: '배송 설정의 반품 주소는 이 샵의 것입니다.' },
      google_ads: { label: 'Google Ads AW-', hint: '이 고객 자신의 Ads 계정 전환 ID입니다.' },
      ga4: { label: 'GA4', hint: '다른 샵과 공유하지 않는 GA4 속성입니다.' },
      gtm: { label: 'GTM', hint: '이 샵 전용 GTM 컨테이너입니다.' },
      images: { label: '이미지와 로고', hint: '상품 이미지, 로고, 파비콘, 채팅 아이콘은 이 샵 CDN입니다. 다른 워크스페이스의 이미지 링크나 출처를 쓰지 않습니다.' },
      meta_pixel: { label: 'Meta 픽셀', hint: 'Meta를 쓰지 않으면 비웁니다. 입력하면 ID가 다른 샵과 달라야 합니다.' },
      tiktok_pixel: { label: 'TikTok 픽셀', hint: 'TikTok을 쓰지 않으면 비웁니다. 입력하면 ID가 다른 샵과 달라야 합니다.' },
      ads_account: { label: 'Google Ads 계정', hint: '이 고객 자신의 Ads 로그인입니다. 다른 샵 Google 계정을 쓰지 않습니다.' },
      merchant_center: { label: 'Merchant Center', hint: '이 고객의 사업자 서류로 인증합니다.' },
      ads_billing: { label: '광고 결제 프로필', hint: '광고 결제 정보는 이 고객의 것입니다.' },
      search_console: { label: 'Search Console', hint: '속성은 이 샵의 도메인입니다.' },
      company_page: { label: '사업자 정보 페이지', hint: '예시 문구를 바꾸고 이 고객의 법적 이름, 사업자번호, 주소를 적은 뒤 페이지를 다시 읽고 확인합니다.' },
    },
  },
}

export function partnerIsolationCopy(locale: WebLocale): PartnerIsolationCopy {
  return COPY[locale] ?? COPY.en
}
