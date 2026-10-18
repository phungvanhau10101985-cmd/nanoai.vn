import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { getNanoAiCatalogVersionToken } from '@/lib/catalog/nanoai-facebook-catalog'
import { AdminIntegrationsClient } from './integrations-client'

export default function AdminIntegrationsPage() {
  const headerStore = headers()
  const publicOrigin = getPublicOriginFromAppRouterHeaders(headerStore)
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const defaultChatSlug = process.env.NEXT_PUBLIC_CHAT_WIDGET_SLUG || 'nanoai-ws-wdh5'
  const nanoaiEmbedCodeDefault = `<iframe src="${baseUrl.replace(/\/$/, '')}/messaging/p/${encodeURIComponent(defaultChatSlug)}?embed=1" title="Chat NanoAI" width="100%" height="560" style="border:0;border-radius:12px;max-width:100%" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
  const catalogVersionToken = getNanoAiCatalogVersionToken()
  const originBase = publicOrigin.replace(/\/$/, '')
  const facebookCatalogFeedUrl = `${originBase}/catalog/nanoai-facebook-feed.csv?v=${encodeURIComponent(catalogVersionToken)}`
  const tiktokCatalogFeedUrl = `${originBase}/catalog/nanoai-tiktok-feed.csv?v=${encodeURIComponent(catalogVersionToken)}`
  const googleMerchantFeedUrl = `${originBase}/catalog/nanoai-google-merchant-feed.tsv?v=${encodeURIComponent(catalogVersionToken)}`

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/admin">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {tr('Về trang quản trị', 'Back to admin', '返回管理页', '管理ページへ戻る', '관리로 돌아가기')}
          </Link>
        </Button>
      </div>

      <AdminIntegrationsClient
        title={tr('Tích hợp thẻ & mã nhúng', 'Tags & embed integrations', '标签与嵌入集成', 'タグ・埋め込み連携', '태그·임베드 연동')}
        description={tr(
          'Khu vực quản trị để cấu hình Google/Facebook và mã nhúng chat (NanoAI, Facebook, Zalo). Bạn có thể điền trực tiếp toàn bộ đoạn mã nhúng.',
          'Admin area to configure Google/Facebook tags and chat embed code (NanoAI, Facebook, Zalo). You can directly edit the full embed snippet.',
          '用于配置 Google/Facebook 标签及聊天嵌入代码（NanoAI、Facebook、Zalo）的管理区域。你可以直接编辑完整嵌入代码。',
          'Google/Facebook タグとチャット埋め込みコード（NanoAI / Facebook / Zalo）を設定する管理エリアです。埋め込みコード全体を直接編集できます。',
          'Google/Facebook 태그 및 채팅 임베드 코드(NanoAI/Facebook/Zalo)를 설정하는 관리자 영역입니다. 전체 임베드 코드를 직접 수정할 수 있습니다.'
        )}
        googleAnalyticsLabel={tr(
          'Google Analytics ID (GA4)',
          'Google Analytics ID (GA4)',
          'Google Analytics ID（GA4）',
          'Google Analytics ID（GA4）',
          'Google Analytics ID (GA4)'
        )}
        googleAnalyticsPlaceholder={tr(
          'Ví dụ: G-ABC123XYZ9',
          'Example: G-ABC123XYZ9',
          '例如：G-ABC123XYZ9',
          '例: G-ABC123XYZ9',
          '예: G-ABC123XYZ9'
        )}
        googleTagManagerLabel={tr(
          'Google Tag Manager Container ID',
          'Google Tag Manager Container ID',
          'Google Tag Manager 容器 ID',
          'Google Tag Manager コンテナ ID',
          'Google Tag Manager 컨테이너 ID'
        )}
        googleTagManagerPlaceholder={tr(
          'Ví dụ: GTM-XXXXXXX',
          'Example: GTM-XXXXXXX',
          '例如：GTM-XXXXXXX',
          '例: GTM-XXXXXXX',
          '예: GTM-XXXXXXX'
        )}
        googleAdsLabel={tr(
          'Google Ads ID (AW-)',
          'Google Ads ID (AW-)',
          'Google Ads ID（AW-）',
          'Google Ads ID（AW-）',
          'Google Ads ID (AW-)'
        )}
        googleAdsPlaceholder={tr(
          'Ví dụ: AW-123456789',
          'Example: AW-123456789',
          '例如：AW-123456789',
          '例: AW-123456789',
          '예: AW-123456789'
        )}
        tiktokPixelLabel={tr('TikTok Pixel ID', 'TikTok Pixel ID', 'TikTok Pixel ID', 'TikTok Pixel ID', 'TikTok Pixel ID')}
        tiktokPixelPlaceholder={tr(
          'Ví dụ: CXXXXXXXXXXXXXXX',
          'Example: CXXXXXXXXXXXXXXX',
          '例如：CXXXXXXXXXXXXXXX',
          '例: CXXXXXXXXXXXXXXX',
          '예: CXXXXXXXXXXXXXXX'
        )}
        googleAdsViewLabel={tr(
          'Google Ads — nhãn xem nội dung',
          'Google Ads — view content label',
          'Google Ads — 浏览内容转化标签',
          'Google Ads — コンテンツ表示ラベル',
          'Google Ads — 콘텐츠 조회 라벨'
        )}
        googleAdsViewPlaceholder={tr(
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj'
        )}
        googleAdsAddToCartLabel={tr(
          'Google Ads — nhãn thêm giỏ',
          'Google Ads — add to cart label',
          'Google Ads — 加入购物车转化标签',
          'Google Ads — カート追加ラベル',
          'Google Ads — 장바구니 라벨'
        )}
        googleAdsAddToCartPlaceholder={tr(
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj'
        )}
        googleAdsPurchaseLabel={tr(
          'Google Ads — nhãn mua hàng',
          'Google Ads — purchase label',
          'Google Ads — 购买转化标签',
          'Google Ads — 購入ラベル',
          'Google Ads — 구매 라벨'
        )}
        googleAdsPurchasePlaceholder={tr(
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj',
          'AW-123456789/AbCdEfGhIj'
        )}
        googleAdsLabelHint={tr(
          'Dán send_to (AW-…/nhãn) hoặc cả đoạn gtag conversion. Xem nội dung, thêm giỏ và mua hàng mỗi cái một nhãn.',
          'Paste send_to (AW-…/label) or the whole gtag conversion snippet. One label each for view, add to cart, and purchase.',
          '粘贴 send_to（AW-…/标签）或整段 gtag 转化代码。浏览、加购、购买各一个标签。',
          'send_to（AW-…/ラベル）または gtag コンバージョンのコードを貼り付けます。表示・カート・購入で各1つ。',
          'send_to(AW-…/라벨) 또는 gtag 전환 코드를 붙여 넣으세요. 조회, 장바구니, 구매마다 라벨 하나.'
        )}
        tiktokEventsTokenLabel={tr(
          'TikTok Events API token',
          'TikTok Events API token',
          'TikTok Events API token',
          'TikTok Events API token',
          'TikTok Events API 토큰'
        )}
        tiktokEventsTokenPlaceholder={tr(
          'Dán Access Token Events API',
          'Paste the Events API access token',
          '粘贴 Events API Access Token',
          'Events API の Access Token を貼り付け',
          'Events API Access Token 붙여넣기'
        )}
        tiktokEventsTokenHint={tr(
          'API chuyển đổi máy chủ. Dùng cùng TikTok Pixel ID. Để trống nếu chỉ dùng pixel trên trình duyệt.',
          'Server conversion API. Used with the TikTok Pixel ID. Leave empty to use the browser pixel only.',
          '服务器转化 API。与 TikTok Pixel ID 一起使用。仅用浏览器像素可留空。',
          'サーバー側のコンバージョン API。TikTok Pixel ID と併用します。ブラウザのピクセルのみなら空欄。',
          '서버 전환 API. TikTok Pixel ID와 함께 씁니다. 브라우저 픽셀만 쓰면 비워 두세요.'
        )}
        facebookPixelLabel={tr('Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel')}
        facebookPixelPlaceholder={tr(
          'Ví dụ: 123456789012345',
          'Example: 123456789012345',
          '例如：123456789012345',
          '例: 123456789012345',
          '예: 123456789012345'
        )}
        facebookCapiTokenLabel={tr(
          'Facebook Conversions API Access Token',
          'Facebook Conversions API Access Token',
          'Facebook Conversions API Access Token',
          'Facebook Conversions API Access Token',
          'Facebook Conversions API Access Token'
        )}
        facebookCapiTokenPlaceholder={tr(
          'Dán Access Token (CAPI) từ Meta Events Manager',
          'Paste Access Token (CAPI) from Meta Events Manager',
          '粘贴来自 Meta Events Manager 的 Access Token（CAPI）',
          'Meta Events Manager の Access Token（CAPI）を貼り付け',
          'Meta Events Manager에서 Access Token(CAPI) 붙여넣기'
        )}
        facebookDatasetIdLabel={tr(
          'Facebook Dataset ID',
          'Facebook Dataset ID',
          'Facebook Dataset ID',
          'Facebook Dataset ID',
          'Facebook Dataset ID'
        )}
        facebookDatasetIdPlaceholder={tr(
          'Ví dụ: 123456789012345',
          'Example: 123456789012345',
          '例如：123456789012345',
          '例: 123456789012345',
          '예: 123456789012345'
        )}
        facebookTestEventCodeLabel={tr(
          'Facebook Test Event Code',
          'Facebook Test Event Code',
          'Facebook Test Event Code',
          'Facebook Test Event Code',
          'Facebook Test Event Code'
        )}
        facebookTestEventCodePlaceholder={tr(
          'Ví dụ: TEST12345',
          'Example: TEST12345',
          '例如：TEST12345',
          '例: TEST12345',
          '예: TEST12345'
        )}
        facebookCatalogFeedLabel={tr(
          'Facebook Catalog Feed URL (CSV)',
          'Facebook Catalog Feed URL (CSV)',
          'Facebook 商品目录 Feed URL（CSV）',
          'Facebook カタログフィード URL（CSV）',
          'Facebook 카탈로그 피드 URL(CSV)'
        )}
        facebookCatalogFeedHint={tr(
          'Dán URL này vào Commerce Manager (Data sources) để tạo catalog toàn bộ tính năng NanoAI cho Dynamic Ads.',
          'Paste this URL into Commerce Manager (Data sources) to build a full NanoAI features catalog for Dynamic Ads.',
          '将此 URL 粘贴到 Commerce Manager（Data sources）以创建 NanoAI 全部功能目录用于动态广告。',
          'この URL を Commerce Manager（Data sources）に貼り付けると、NanoAI 全機能のカタログを Dynamic Ads 用に作成できます。',
          '이 URL을 Commerce Manager(Data sources)에 붙여 넣으면 NanoAI 전체 기능 카탈로그를 Dynamic Ads 용으로 만들 수 있습니다.'
        )}
        copyFacebookCatalogFeedButton={tr(
          'Sao chép URL feed',
          'Copy feed URL',
          '复制 Feed URL',
          'フィード URL をコピー',
          '피드 URL 복사'
        )}
        facebookCatalogFeedUrl={facebookCatalogFeedUrl}
        tiktokCatalogFeedLabel={tr(
          'TikTok Catalog Feed URL (CSV)',
          'TikTok Catalog Feed URL (CSV)',
          'TikTok 商品目录 Feed URL（CSV）',
          'TikTok カタログフィード URL（CSV）',
          'TikTok 카탈로그 피드 URL(CSV)'
        )}
        tiktokCatalogFeedHint={tr(
          'Dán URL này vào TikTok Ads Manager → Catalog → Data sources. Cột sku_id trùng id nội dung remarketing của mọi tính năng.',
          'Paste this URL into TikTok Ads Manager → Catalog → Data sources. The sku_id column matches the remarketing content id of every feature.',
          '将此 URL 粘贴到 TikTok Ads Manager → Catalog → Data sources。sku_id 列与每个功能的再营销内容 ID 一致。',
          'この URL を TikTok Ads Manager → Catalog → Data sources に貼り付けます。sku_id 列は各機能のリマーケティング用コンテンツ ID と一致します。',
          '이 URL을 TikTok Ads Manager → Catalog → Data sources에 붙여 넣으세요. sku_id 열은 모든 기능의 리마케팅 콘텐츠 ID와 같습니다.'
        )}
        tiktokCatalogFeedUrl={tiktokCatalogFeedUrl}
        googleMerchantFeedLabel={tr(
          'Google Merchant Center Feed URL (TSV)',
          'Google Merchant Center Feed URL (TSV)',
          'Google Merchant Center Feed URL（TSV）',
          'Google Merchant Center フィード URL（TSV）',
          'Google Merchant Center 피드 URL(TSV)'
        )}
        googleMerchantFeedHint={tr(
          'Dán vào Merchant Center → Nguồn cấp dữ liệu. Quốc gia Việt Nam, ngôn ngữ Tiếng Việt. Đủ cột quảng cáo mua sắm: id, title, description, link, image_link, availability, price, brand, condition, identifier_exists, google_product_category (313 Software), shipping. Cột id trùng content id.',
          'Paste into Merchant Center → Data sources. Country Vietnam, language Vietnamese. Includes Shopping columns: id, title, description, link, image_link, availability, price, brand, condition, identifier_exists, google_product_category (313 Software), shipping. The id column matches the content id.',
          '粘贴到 Merchant Center → 数据源。国家：越南，语言：越南语。包含购物广告必填列：id、title、description、link、image_link、availability、price、brand、condition、identifier_exists、google_product_category（313 Software）、shipping。id 列与内容 ID 一致。',
          'Merchant Center → データソースに貼り付けます。対象国ベトナム、言語ベトナム語。ショッピング広告の列（id、title、description、link、image_link、availability、price、brand、condition、identifier_exists、google_product_category（313 Software）、shipping）を含みます。id 列はコンテンツ ID と一致します。',
          'Merchant Center → 데이터 소스에 붙여 넣으세요. 국가 베트남, 언어 베트남어. 쇼핑 광고 열(id, title, description, link, image_link, availability, price, brand, condition, identifier_exists, google_product_category(313 Software), shipping)이 포함됩니다. id 열은 콘텐츠 ID와 같습니다.'
        )}
        googleMerchantFeedUrl={googleMerchantFeedUrl}
        webConsoleVerificationLabel={tr(
          'Thẻ xác minh Google Search Console',
          'Google Search Console verification tag',
          'Google Search Console 验证标签',
          'Google Search Console 検証タグ',
          'Google Search Console 인증 태그'
        )}
        webConsoleVerificationPlaceholder={tr(
          'Dán meta tag xác minh, ví dụ: <meta name="google-site-verification" content="..." />',
          'Paste verification meta tag, e.g. <meta name="google-site-verification" content="..." />',
          '粘贴验证 meta 标签，例如：<meta name="google-site-verification" content="..." />',
          '検証用 meta タグを貼り付け（例: <meta name="google-site-verification" content="..." />）',
          '인증 메타 태그를 붙여 넣으세요. 예: <meta name="google-site-verification" content="..." />'
        )}
        domainVerificationTitle={tr(
          'Danh sách thẻ xác minh tên miền (thêm nhiều)',
          'Domain verification tags list (multiple)',
          '域名验证标签列表（可添加多个）',
          'ドメイン検証タグ一覧（複数追加可）',
          '도메인 인증 태그 목록(여러 개 추가)'
        )}
        domainVerificationNameLabel={tr('Tên dịch vụ', 'Service name', '服务名称', 'サービス名', '서비스 이름')}
        domainVerificationCodeLabel={tr('Mã xác minh', 'Verification code/tag', '验证代码/标签', '検証コード/タグ', '인증 코드/태그')}
        domainVerificationNamePlaceholder={tr(
          'Ví dụ: Zalo OA, Google Merchant Center',
          'Example: Zalo OA, Google Merchant Center',
          '例如：Zalo OA、Google Merchant Center',
          '例: Zalo OA、Google Merchant Center',
          '예: Zalo OA, Google Merchant Center'
        )}
        domainVerificationCodePlaceholder={tr(
          'Dán thẻ/meta/script xác minh tại đây…',
          'Paste verification tag/meta/script here…',
          '在此粘贴验证标签/meta/script…',
          '検証用タグ/meta/script をここに貼り付け…',
          '인증 태그/meta/script를 여기에 붙여 넣으세요…'
        )}
        addDomainVerificationButton={tr(
          'Thêm thẻ xác minh',
          'Add verification tag',
          '添加验证标签',
          '検証タグを追加',
          '인증 태그 추가'
        )}
        removeDomainVerificationButton={tr(
          'Xóa',
          'Remove',
          '删除',
          '削除',
          '삭제'
        )}
        nanoaiEmbedCodeLabel={tr('Mã nhúng chat NanoAI', 'NanoAI chat embed code', 'NanoAI 聊天嵌入代码', 'NanoAI チャット埋め込みコード', 'NanoAI 채팅 임베드 코드')}
        nanoaiEmbedCodeHint={tr(
          'Dán iframe trang chat (`/messaging/p/…?embed=1`) hoặc script shop (`nanoai-chat-widget.js` + `data-chat-url`). Site mở trang chat — không nhúng file JS.',
          'Paste a chat iframe (`/messaging/p/…?embed=1`) or the shop script (`nanoai-chat-widget.js` + `data-chat-url`). The site opens the chat page — it does not embed the JS file.',
          '粘贴聊天 iframe（`/messaging/p/…?embed=1`）或店铺脚本（`nanoai-chat-widget.js` + `data-chat-url`）。站点会打开聊天页，而不是嵌入 JS 文件。',
          'チャット iframe（`/messaging/p/…?embed=1`）またはショップ用スクリプト（`nanoai-chat-widget.js` + `data-chat-url`）を貼り付けてください。サイトはチャットページを開き、JS ファイルは埋め込みません。',
          '채팅 iframe(`/messaging/p/…?embed=1`) 또는 샵 스크립트(`nanoai-chat-widget.js` + `data-chat-url`)를 붙여 넣으세요. 사이트는 채팅 페이지를 열며 JS 파일은 임베드하지 않습니다.'
        )}
        facebookChatEmbedCodeLabel={tr('Mã nhúng chat Facebook', 'Facebook chat embed code', 'Facebook 聊天嵌入代码', 'Facebook チャット埋め込みコード', 'Facebook 채팅 임베드 코드')}
        zaloChatEmbedCodeLabel={tr('Mã nhúng chat Zalo', 'Zalo chat embed code', 'Zalo 聊天嵌入代码', 'Zalo チャット埋め込みコード', 'Zalo 채팅 임베드 코드')}
        embedCodePlaceholder={tr(
          'Dán script/iframe/plugin code vào đây…',
          'Paste script/iframe/plugin code here…',
          '在此粘贴 script / iframe / 插件代码…',
          'script / iframe / プラグインコードをここに貼り付け…',
          'script / iframe / 플러그인 코드를 여기에 붙여 넣으세요…'
        )}
        copyNanoaiEmbedButton={tr('Sao chép mã chat NanoAI', 'Copy NanoAI chat code', '复制 NanoAI 聊天代码', 'NanoAI チャットコードをコピー', 'NanoAI 채팅 코드 복사')}
        copyFacebookChatEmbedButton={tr('Sao chép mã Facebook chat', 'Copy Facebook chat code', '复制 Facebook 聊天代码', 'Facebook チャットコードをコピー', 'Facebook 채팅 코드 복사')}
        copyZaloChatEmbedButton={tr('Sao chép mã Zalo chat', 'Copy Zalo chat code', '复制 Zalo 聊天代码', 'Zalo チャットコードをコピー', 'Zalo 채팅 코드 복사')}
        copiedToast={tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨')}
        nanoaiEmbedCodeDefault={nanoaiEmbedCodeDefault}
        saveButtonLabel={tr('Lưu cấu hình', 'Save configuration', '保存配置', '設定を保存', '설정 저장')}
        saveOkToast={tr('Đã lưu cấu hình tích hợp.', 'Integration configuration saved.', '集成配置已保存。', '連携設定を保存しました。', '연동 설정이 저장되었습니다.')}
        invalidGoogleAnalyticsToast={tr(
          'Google Analytics ID không hợp lệ. Đúng định dạng: G-XXXXXXXXXX',
          'Invalid Google Analytics ID. Expected format: G-XXXXXXXXXX',
          'Google Analytics ID 无效。正确格式：G-XXXXXXXXXX',
          'Google Analytics ID が無効です。形式: G-XXXXXXXXXX',
          'Google Analytics ID 형식이 올바르지 않습니다. 형식: G-XXXXXXXXXX'
        )}
        invalidGoogleTagManagerToast={tr(
          'Google Tag Manager ID không hợp lệ. Đúng định dạng: GTM-XXXXXXX',
          'Invalid Google Tag Manager ID. Expected format: GTM-XXXXXXX',
          'Google Tag Manager ID 无效。正确格式：GTM-XXXXXXX',
          'Google Tag Manager ID が無効です。形式: GTM-XXXXXXX',
          'Google Tag Manager ID 형식이 올바르지 않습니다. 형식: GTM-XXXXXXX'
        )}
        invalidGoogleAdsToast={tr(
          'Google Ads ID không hợp lệ. Đúng định dạng: AW-123456789',
          'Invalid Google Ads ID. Expected format: AW-123456789',
          'Google Ads ID 无效。正确格式：AW-123456789',
          'Google Ads ID が無効です。形式: AW-123456789',
          'Google Ads ID 형식이 올바르지 않습니다. 형식: AW-123456789'
        )}
        invalidTiktokPixelToast={tr(
          'TikTok Pixel ID không hợp lệ. Dùng mã pixel, ví dụ CXXXXXXXXXXXXXXX',
          'Invalid TikTok Pixel ID. Use the pixel code, for example CXXXXXXXXXXXXXXX',
          'TikTok Pixel ID 无效。请使用像素代码，例如 CXXXXXXXXXXXXXXX',
          'TikTok Pixel ID が無効です。ピクセルコード（例 CXXXXXXXXXXXXXXX）を入力してください',
          'TikTok Pixel ID 형식이 올바르지 않습니다. 픽셀 코드(예: CXXXXXXXXXXXXXXX)를 입력하세요'
        )}
      />
    </div>
  )
}

