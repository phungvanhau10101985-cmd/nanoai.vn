export type ApiKeysHubLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

export type ApiKeysHubStrings = {
  backAdmin: string
  backPartner: string
  pageTitle: string
  pageTitlePartner: string
  pageLead: string
  partnerPageLead: string
  openDashboard: string
  openMessagingSettings: string
  openIntegrations: string
  openCustomerCare: string
  ruleTitle: string
  ruleBody: string
  partnerRuleBody: string
  s1Title: string
  s1Lead: string
  embedTitle: string
  embedBody: string
  imageSearchTitle: string
  imageSearchBody: string
  s2Title: string
  s2Lead: string
  tryOnBody: string
  s3Title: string
  s3Lead: string
  envCronTitle: string
  envCronBody: string
  envInternalTitle: string
  envInternalBody: string
  s4Title: string
  s4Lead: string
  webhookBody: string
  partnerOpsNoteTitle: string
  partnerOpsNoteBody: string
  extendNote: string
  partnerExtendNote: string
  /** Hiện khi NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL chưa cấu hình — URL ví dụ có thể sai */
  partnerBaseUrlFallbackWarning: string
}

export const API_KEYS_HUB_COPY: Record<ApiKeysHubLocale, ApiKeysHubStrings> = {
  vi: {
    backAdmin: 'Về trang quản trị',
    backPartner: 'Về Bảng điều khiển',
    pageTitle: 'Khóa API & cổng tích hợp',
    pageTitlePartner: 'Hướng dẫn tích hợp API (website shop)',
    pageLead:
      'Trang gom cho dev vận hành NanoAI: cron, webhook nền tảng, và tham chiếu cổng đối tác. Đối tác tích hợp web riêng dùng Bảng điều khiển → Hướng dẫn API.',
    partnerPageLead:
      'Dành cho đội kỹ thuật shop: mã nhúng chat, API embed, tìm sản phẩm bằng ảnh, thử đồ B2B. Đăng nhập tài khoản NanoAI của cửa hàng. Phần «Hướng dẫn triển khai cho developer» bên dưới có endpoint, header, ví dụ curl/JSON.',
    openDashboard: 'Messaging (inbox)',
    openMessagingSettings: 'Cài đặt Messaging (kênh & AI)',
    openIntegrations: 'Thẻ & mã nhúng (admin)',
    openCustomerCare: 'Chăm sóc khách hàng (admin)',
    ruleTitle: 'Nguyên tắc bảo mật',
    ruleBody:
      'Khóa Bearer cho shop/B2B chỉ nên dùng trên backend khách hàng — không nhúng vào JS trình duyệt. Biến .env cron/chỉ dành cho máy chủ vận hành NanoAI.',
    partnerRuleBody:
      'Khóa API (Bearer, X-Embed-Key) chỉ dùng trên server backend của shop hoặc tích hợp phía máy chủ — không đưa vào JavaScript chạy trên trình duyệt người mua hàng.',
    s1Title: '1. Messaging — nhúng chat & tìm ảnh sản phẩm',
    s1Lead:
      'Khóa X-Embed-Key và Bearer (tìm ảnh): Bảng điều khiển shop → Tích hợp API (/dashboard/api-integration). Bật gợi ý theo ảnh và đồng bộ catalog Vision: Messaging → Cài đặt → AI.',
    embedTitle: 'Khóa nhúng chat (X-Embed-Key)',
    embedBody:
      'Hiển thị tại Bảng điều khiển → Tích hợp API. Dùng cho /api/messaging/embed/{slug} (kèm X-Session-Id), upload ảnh embed. Trang hosted /messaging/p/{slug} không cần header này cho khách cuối.',
    imageSearchTitle: 'API tìm sản phẩm bằng ảnh',
    imageSearchBody:
      'Tạo khóa và bật API tại Bảng điều khiển → Tích hợp API. POST multipart tới /api/messaging/partners/{partnerId}/image-search, field image hoặc file, header Authorization: Bearer <khóa>. Nên gọi từ backend shop.',
    s2Title: '2. API thử đồ ảo B2B (Partner try-on)',
    s2Lead: 'Một khóa Bearer ánh xạ tới tài khoản tín credits qua bảng cơ sở dữ liệu.',
    tryOnBody:
      'POST /api/v1/partner/try-on — multipart: userImage, garmentImage0…, tuỳ chọn imageQuality, gender. Authorization: Bearer <bí mật thô>. Bản ghi partner_try_on_clients do NanoAI/hỗ trợ kỹ thuật tạo: key_hash = SHA-256(chuỗi bí mật UTF-8), billing_user_id = user có credits. Chi tiết kỹ thuật: tài liệu đi kèm hợp đồng hoặc .env.example trong repo (Partner API – thử đồ ảo).',
    s3Title: '3. Khóa trên máy chủ (.env — vận hành NanoAI)',
    s3Lead:
      'Không tạo trong UI; chỉ admin/devops cấu hình trên VPS/hosting. Gọi từ cron hoặc dịch vụ nội bộ.',
    envCronTitle: 'Cron (Authorization: Bearer)',
    envCronBody:
      'MESSAGING_PARTNER_AI_CRON_SECRET → /api/cron/messaging-partner-ai. ADMIN_WORKSHEET_VERIFY_CRON_SECRET → /api/cron/worksheet-verify-batch. EXAM_ESSAY_IMAGES_CRON_SECRET → /api/cron/exam-essay-images-cleanup. MEETING_RECORDINGS_CRON_SECRET → /api/cron/meeting-recordings-cleanup. COACH_REVIEW_REMINDER_CRON_SECRET → /api/cron/coach-review-reminder.',
    envInternalTitle: 'API nội bộ / batch',
    envInternalBody: 'PROCESS_TRANSLATE_SECRET → /api/process-translate và /api/verify-translate-batch.',
    s4Title: '4. Webhook & nền tảng (Meta / Zalo — inbox NanoAI)',
    s4Lead: 'Token/secret cấu hình theo từng kênh; không phải Bearer thống nhất.',
    webhookBody:
      'Facebook Messenger: FACEBOOK_MESSENGER_VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET. Zalo OA: ZALO_OA_WEBHOOK_SECRET, ACCESS_TOKEN. Cấu hình inbox: trang Chăm sóc khách hàng (admin).',
    partnerOpsNoteTitle: 'Phần dành cho vận hành NanoAI',
    partnerOpsNoteBody:
      'Cron, biến .env trên máy chủ NanoAI và webhook hộp thư nội bộ không cần để bạn tích hợp website bán hàng. Nếu cần API thử đồ B2B, liên hệ NanoAI để được tạo khóa và gắn credits.',
    extendNote:
      'Khi phát triển cổng mới: cập nhật trang đối tác (/dashboard/api-integration), trang admin này và .env.example.',
    partnerExtendNote:
      'Khi NanoAI bổ sung API mới cho đối tác, nội dung trang này sẽ được cập nhật. Thắc mắc tích hợp vui lòng liên hệ hỗ trợ NanoAI.',
    partnerBaseUrlFallbackWarning:
      'Trên môi trường này chưa đặt NEXT_PUBLIC_APP_URL (hoặc NEXT_PUBLIC_BASE_URL): các URL ví dụ đang dùng placeholder. Trên production hãy cấu hình để hiển thị đúng domain NanoAI.',
  },
  en: {
    backAdmin: 'Back to admin',
    backPartner: 'Back to dashboard',
    pageTitle: 'API keys & integration endpoints',
    pageTitlePartner: 'API integration guide (your shop website)',
    pageLead:
      'Operator hub for NanoAI: cron, platform webhooks, and partner API reference. Shops integrating their own site should use Dashboard → API integration guide.',
    partnerPageLead:
      'For your engineering team: hosted/iframe chat, anonymous embed API, image product search, B2B try-on. Sign in with your shop NanoAI account. The «Developer implementation guide» below lists endpoints, headers, and curl/JSON examples.',
    openDashboard: 'Messaging (inbox)',
    openMessagingSettings: 'Messaging settings (channels & AI)',
    openIntegrations: 'Tags & embed codes (admin)',
    openCustomerCare: 'Customer care (admin)',
    ruleTitle: 'Security basics',
    ruleBody:
      'Shop/B2B Bearer keys belong on the customer backend only — never in browser JS. Cron .env variables are for NanoAI infrastructure only.',
    partnerRuleBody:
      'API keys (Bearer, X-Embed-Key) must be used on your shop backend or server-side integration — never in client-side JavaScript exposed to shoppers.',
    s1Title: '1. Messaging — embed chat & image search',
    s1Lead:
      'X-Embed-Key and image-search Bearer: shop Dashboard → API integration (/dashboard/api-integration). Vision image suggestions and catalog sync: Messaging → Settings → AI.',
    embedTitle: 'Chat embed key (X-Embed-Key)',
    embedBody:
      'Shown on Dashboard → API integration. Used for /api/messaging/embed/{slug} (with X-Session-Id) and embed image upload. Hosted /messaging/p/{slug} does not need this header for end users.',
    imageSearchTitle: 'Image product search API',
    imageSearchBody:
      'Generate the key and enable the API on Dashboard → API integration. POST multipart to /api/messaging/partners/{partnerId}/image-search, field image or file, header Authorization: Bearer <key>. Call from your shop backend.',
    s2Title: '2. B2B virtual try-on API',
    s2Lead: 'One Bearer secret maps to a billing user via a database row.',
    tryOnBody:
      'POST /api/v1/partner/try-on — multipart: userImage, garmentImage0…, optional imageQuality, gender. Authorization: Bearer <raw secret>. Rows in partner_try_on_clients are created by NanoAI/support: key_hash = SHA-256(UTF-8 secret), billing_user_id = user with credits. Technical details: contract docs or .env.example in repo (Partner try-on API).',
    s3Title: '3. Server secrets (.env — NanoAI ops)',
    s3Lead: 'Not created in UI; only admins set these on the host. Called from cron or internal services.',
    envCronTitle: 'Cron (Authorization: Bearer)',
    envCronBody:
      'MESSAGING_PARTNER_AI_CRON_SECRET → /api/cron/messaging-partner-ai. ADMIN_WORKSHEET_VERIFY_CRON_SECRET → /api/cron/worksheet-verify-batch. EXAM_ESSAY_IMAGES_CRON_SECRET → /api/cron/exam-essay-images-cleanup. MEETING_RECORDINGS_CRON_SECRET → /api/cron/meeting-recordings-cleanup. COACH_REVIEW_REMINDER_CRON_SECRET → /api/cron/coach-review-reminder.',
    envInternalTitle: 'Internal / batch APIs',
    envInternalBody: 'PROCESS_TRANSLATE_SECRET → /api/process-translate and /api/verify-translate-batch.',
    s4Title: '4. Webhooks & platforms (Meta / Zalo — NanoAI inbox)',
    s4Lead: 'Tokens per channel; not a single Bearer scheme.',
    webhookBody:
      'Facebook Messenger: FACEBOOK_MESSENGER_VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET. Zalo OA: ZALO_OA_WEBHOOK_SECRET, ACCESS_TOKEN. Inbox setup: Customer care (admin).',
    partnerOpsNoteTitle: 'NanoAI operations (not required for your site)',
    partnerOpsNoteBody:
      'Cron jobs, NanoAI server .env, and internal inbox webhooks are not needed to integrate your storefront. For B2B try-on, contact NanoAI to issue keys and link credits.',
    extendNote:
      'When adding new APIs: update the partner page (/dashboard/api-integration), this admin page, and .env.example.',
    partnerExtendNote:
      'When NanoAI adds partner APIs, this page will be updated. Contact NanoAI support for integration help.',
    partnerBaseUrlFallbackWarning:
      'NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_BASE_URL) is not set in this environment: example URLs use a placeholder. Set it in production so snippets show your real NanoAI domain.',
  },
  zh: {
    backAdmin: '返回管理页',
    backPartner: '返回控制台',
    pageTitle: 'API 密钥与集成入口',
    pageTitlePartner: 'API 集成说明（店铺网站）',
    pageLead:
      'NanoAI 运维侧汇总：cron、平台 Webhook、以及合作方接口索引。店铺集成自有网站请使用控制台 → API 集成说明。',
    partnerPageLead:
      '供店铺技术团队：托管/iframe 聊天、匿名嵌入 API、以图搜商品、B2B 试衣。请用店铺 NanoAI 账号登录。下方《开发者实施指南》含接口、请求头与 curl/JSON 示例。',
    openDashboard: 'Messaging（收件箱）',
    openMessagingSettings: 'Messaging 设置（渠道与 AI）',
    openIntegrations: '标签与嵌入代码（管理）',
    openCustomerCare: '客户关怀（管理）',
    ruleTitle: '安全原则',
    ruleBody:
      '店铺/B2B Bearer 密钥仅用于客户后端——不要写入浏览器 JS。Cron 用 .env 仅属于 NanoAI 服务器运维。',
    partnerRuleBody:
      'API 密钥（Bearer、X-Embed-Key）仅用于店铺后端或服务端集成——不要写入面向买家的前端 JavaScript。',
    s1Title: '1. Messaging — 嵌入聊天与以图搜商品',
    s1Lead:
      'X-Embed-Key 与以图搜 Bearer：店铺控制台 → API 集成说明（/dashboard/api-integration）。Vision 以图提示与目录同步：Messaging → 设置 → AI。',
    embedTitle: '聊天嵌入密钥（X-Embed-Key）',
    embedBody:
      '在 控制台 → API 集成说明 显示。用于 /api/messaging/embed/{slug}（配合 X-Session-Id）及嵌入图片上传。托管页 /messaging/p/{slug} 对终端用户不需要此请求头。',
    imageSearchTitle: '以图搜商品 API',
    imageSearchBody:
      '在 控制台 → API 集成说明 生成密钥并启用 API。multipart POST /api/messaging/partners/{partnerId}/image-search，字段 image 或 file，请求头 Authorization: Bearer <密钥>。建议从店铺后端调用。',
    s2Title: '2. B2B 虚拟试衣 API',
    s2Lead: '一个 Bearer 密钥通过数据库行映射到计费用户。',
    tryOnBody:
      'POST /api/v1/partner/try-on — multipart：userImage、garmentImage0…，可选 imageQuality、gender。Authorization: Bearer <原始密钥>。partner_try_on_clients 记录由 NanoAI/技术支持创建：key_hash = SHA-256(UTF-8 密钥)，billing_user_id = 有余额的用户。技术细节见合同文档或仓库 .env.example（Partner try-on）。',
    s3Title: '3. 服务器密钥（.env — NanoAI 运维）',
    s3Lead: '不在界面生成；仅管理员在主机上配置。由 cron 或内部服务调用。',
    envCronTitle: '定时任务（Authorization: Bearer）',
    envCronBody:
      'MESSAGING_PARTNER_AI_CRON_SECRET → /api/cron/messaging-partner-ai。ADMIN_WORKSHEET_VERIFY_CRON_SECRET → /api/cron/worksheet-verify-batch。EXAM_ESSAY_IMAGES_CRON_SECRET → /api/cron/exam-essay-images-cleanup。MEETING_RECORDINGS_CRON_SECRET → /api/cron/meeting-recordings-cleanup。COACH_REVIEW_REMINDER_CRON_SECRET → /api/cron/coach-review-reminder。',
    envInternalTitle: '内部 / 批量 API',
    envInternalBody: 'PROCESS_TRANSLATE_SECRET → /api/process-translate 与 /api/verify-translate-batch。',
    s4Title: '4. Webhook 与平台（Meta / Zalo — NanoAI 收件箱）',
    s4Lead: '按渠道配置 token/secret；不是统一 Bearer。',
    webhookBody:
      'Facebook Messenger：FACEBOOK_MESSENGER_VERIFY_TOKEN、PAGE_ACCESS_TOKEN、APP_SECRET。Zalo OA：ZALO_OA_WEBHOOK_SECRET、ACCESS_TOKEN。收件箱配置见客户关怀（管理）。',
    partnerOpsNoteTitle: 'NanoAI 运维相关（店铺集成通常不需要）',
    partnerOpsNoteBody:
      'Cron、NanoAI 服务器 .env 与内部收件箱 Webhook 不是您集成电商网站所必需的。如需 B2B 试衣 API，请联系 NanoAI 开通密钥并关联 credits。',
    extendNote:
      '新增 API 时：同步更新合作方页面（/dashboard/api-integration）、本管理页与 .env.example。',
    partnerExtendNote:
      'NanoAI 为合作方新增 API 时会更新本页。集成问题请联系 NanoAI 支持。',
    partnerBaseUrlFallbackWarning:
      '当前环境未设置 NEXT_PUBLIC_APP_URL（或 NEXT_PUBLIC_BASE_URL）：示例 URL 为占位符。请在生产环境配置以显示真实 NanoAI 域名。',
  },
  ja: {
    backAdmin: '管理ページへ戻る',
    backPartner: 'ダッシュボードへ戻る',
    pageTitle: 'API キーと連携エンドポイント',
    pageTitlePartner: 'API 連携ガイド（店舗サイト）',
    pageLead:
      'NanoAI 運用向け：cron、プラットフォーム Webhook、パートナー API 参照。自社サイト連携はダッシュボード → API 連携ガイドを使用。',
    partnerPageLead:
      '店舗開発向け：ホスト/iframe チャット、匿名埋め込み API、画像検索、B2B 試着。店舗の NanoAI アカウントでログイン。下の「開発者向け実装ガイド」にエンドポイント・ヘッダー・curl/JSON 例があります。',
    openDashboard: 'Messaging（受信箱）',
    openMessagingSettings: 'Messaging 設定（チャネル・AI）',
    openIntegrations: 'タグ・埋め込み（管理）',
    openCustomerCare: 'カスタマーケア（管理）',
    ruleTitle: 'セキュリティの原則',
    ruleBody:
      '店舗/B2B Bearer キーは顧客バックエンドのみ。.env の cron 用変数は NanoAI インフラ専用。',
    partnerRuleBody:
      'API キー（Bearer、X-Embed-Key）は店舗のバックエンドまたはサーバー側連携でのみ使用し、購入者向けブラウザの JavaScript には含めないでください。',
    s1Title: '1. Messaging — 埋め込みチャットと画像検索',
    s1Lead:
      'X-Embed-Key と画像検索用 Bearer：店舗ダッシュボード → API 連携ガイド（/dashboard/api-integration）。Vision の画像提案とカタログ同期：Messaging → 設定 → AI。',
    embedTitle: 'チャット埋め込みキー（X-Embed-Key）',
    embedBody:
      'ダッシュボード → API 連携ガイドに表示。/api/messaging/embed/{slug}（X-Session-Id と併用）と埋め込み画像アップロードに使用。ホスト型 /messaging/p/{slug} はエンドユーザーに不要。',
    imageSearchTitle: '画像で商品検索 API',
    imageSearchBody:
      'ダッシュボード → API 連携ガイドでキー生成と API 有効化。multipart POST /api/messaging/partners/{partnerId}/image-search、フィールド image または file、Authorization: Bearer <キー>。店舗バックエンドから呼び出し推奨。',
    s2Title: '2. B2B バーチャル試着 API',
    s2Lead: '1 つの Bearer 秘密が DB 行で課金ユーザーに紐づく。',
    tryOnBody:
      'POST /api/v1/partner/try-on — multipart: userImage, garmentImage0…、任意 imageQuality, gender。Authorization: Bearer <生の秘密>。partner_try_on_clients は NanoAI/サポートが作成：key_hash = SHA-256(UTF-8 秘密)、billing_user_id = クレジット保有ユーザー。詳細は契約資料またはリポジトリの .env.example（Partner try-on）。',
    s3Title: '3. サーバー秘密（.env — NanoAI 運用）',
    s3Lead: 'UI では作成しない。管理者のみホストに設定。cron または内部サービスから呼び出し。',
    envCronTitle: 'Cron（Authorization: Bearer）',
    envCronBody:
      'MESSAGING_PARTNER_AI_CRON_SECRET → /api/cron/messaging-partner-ai。ADMIN_WORKSHEET_VERIFY_CRON_SECRET → /api/cron/worksheet-verify-batch。EXAM_ESSAY_IMAGES_CRON_SECRET → /api/cron/exam-essay-images-cleanup。MEETING_RECORDINGS_CRON_SECRET → /api/cron/meeting-recordings-cleanup。COACH_REVIEW_REMINDER_CRON_SECRET → /api/cron/coach-review-reminder。',
    envInternalTitle: '内部 / バッチ API',
    envInternalBody: 'PROCESS_TRANSLATE_SECRET → /api/process-translate と /api/verify-translate-batch。',
    s4Title: '4. Webhook とプラットフォーム（Meta / Zalo — NanoAI 受信箱）',
    s4Lead: 'チャネルごとのトークン/秘密。',
    webhookBody:
      'Facebook Messenger: FACEBOOK_MESSENGER_VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET。Zalo OA: ZALO_OA_WEBHOOK_SECRET, ACCESS_TOKEN。受信箱はカスタマーケア（管理）。',
    partnerOpsNoteTitle: 'NanoAI 運用（店舗サイト連携には通常不要）',
    partnerOpsNoteBody:
      'cron、NanoAI サーバーの .env、内部受信箱の Webhook は EC サイト連携に必須ではありません。B2B 試着 API は NanoAI に連絡してキーとクレジットを紐づけてください。',
    extendNote:
      '新 API 追加時：パートナー用ページ（/dashboard/api-integration）、本管理ページ、.env.example を更新。',
    partnerExtendNote:
      'パートナー向け API が増えたら本ページを更新します。連携のご質問は NanoAI サポートへ。',
    partnerBaseUrlFallbackWarning:
      'この環境では NEXT_PUBLIC_APP_URL（または NEXT_PUBLIC_BASE_URL）が未設定のため、例の URL はプレースホルダーです。本番では設定して実際の NanoAI ドメインを表示してください。',
  },
  ko: {
    backAdmin: '관리로 돌아가기',
    backPartner: '대시보드로 돌아가기',
    pageTitle: 'API 키 및 연동 엔드포인트',
    pageTitlePartner: 'API 연동 안내(매장 웹사이트)',
    pageLead:
      'NanoAI 운영용: cron, 플랫폼 Webhook, 파트너 API 참고. 자사 사이트 연동은 대시보드 → API 연동 안내를 사용하세요.',
    partnerPageLead:
      '매장 개발팀용: 호스팅/iframe 채팅, 익명 임베드 API, 이미지 검색, B2B 피팅. 매장 NanoAI 계정으로 로그인. 아래 「개발자 구현 가이드」에 엔드포인트·헤더·curl/JSON 예시가 있습니다.',
    openDashboard: 'Messaging(수신함)',
    openMessagingSettings: 'Messaging 설정(채널·AI)',
    openIntegrations: '태그·임베드(관리)',
    openCustomerCare: '고객 케어(관리)',
    ruleTitle: '보안 원칙',
    ruleBody:
      '매장/B2B Bearer 키는 고객 백엔드에서만 사용. cron용 .env 변수는 NanoAI 인프라 전용.',
    partnerRuleBody:
      'API 키(Bearer, X-Embed-Key)는 매장 백엔드 또는 서버 연동에서만 사용하고, 구매자 브라우저 JavaScript에는 넣지 마세요.',
    s1Title: '1. Messaging — 임베드 채팅·이미지 검색',
    s1Lead:
      'X-Embed-Key·이미지 검색 Bearer: 매장 대시보드 → API 연동 안내(/dashboard/api-integration). Vision 이미지 제안·카탈로그 동기화: Messaging → 설정 → AI.',
    embedTitle: '채팅 임베드 키(X-Embed-Key)',
    embedBody:
      '대시보드 → API 연동 안내에 표시. /api/messaging/embed/{slug}(X-Session-Id) 및 임베드 이미지 업로드에 사용. 호스팅 /messaging/p/{slug}는 최종 사용자에게 불필요.',
    imageSearchTitle: '이미지 상품 검색 API',
    imageSearchBody:
      '대시보드 → API 연동 안내에서 키 생성·API 활성화. multipart POST /api/messaging/partners/{partnerId}/image-search, 필드 image 또는 file, Authorization: Bearer <키>. 매장 백엔드에서 호출 권장.',
    s2Title: '2. B2B 가상 피팅 API',
    s2Lead: 'Bearer 비밀이 DB 행을 통해 과금 사용자에 매핑됩니다.',
    tryOnBody:
      'POST /api/v1/partner/try-on — multipart: userImage, garmentImage0…, 선택 imageQuality, gender. Authorization: Bearer <평문 비밀>. partner_try_on_clients 행은 NanoAI/지원이 생성: key_hash = SHA-256(UTF-8 비밀), billing_user_id = 크레딧 보유 사용자. 자세한 내용은 계약서 또는 저장소 .env.example(Partner try-on).',
    s3Title: '3. 서버 비밀(.env — NanoAI 운영)',
    s3Lead: 'UI에서 생성하지 않음. 관리자만 호스트에 설정. cron 또는 내부 서비스에서 호출.',
    envCronTitle: 'Cron(Authorization: Bearer)',
    envCronBody:
      'MESSAGING_PARTNER_AI_CRON_SECRET → /api/cron/messaging-partner-ai. ADMIN_WORKSHEET_VERIFY_CRON_SECRET → /api/cron/worksheet-verify-batch. EXAM_ESSAY_IMAGES_CRON_SECRET → /api/cron/exam-essay-images-cleanup. MEETING_RECORDINGS_CRON_SECRET → /api/cron/meeting-recordings-cleanup. COACH_REVIEW_REMINDER_CRON_SECRET → /api/cron/coach-review-reminder.',
    envInternalTitle: '내부 / 배치 API',
    envInternalBody: 'PROCESS_TRANSLATE_SECRET → /api/process-translate 및 /api/verify-translate-batch.',
    s4Title: '4. Webhook 및 플랫폼(Meta / Zalo — NanoAI 수신함)',
    s4Lead: '채널별 토큰/비밀.',
    webhookBody:
      'Facebook Messenger: FACEBOOK_MESSENGER_VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET. Zalo OA: ZALO_OA_WEBHOOK_SECRET, ACCESS_TOKEN. 수신함 설정은 고객 케어(관리).',
    partnerOpsNoteTitle: 'NanoAI 운영(매장 사이트 연동에 보통 불필요)',
    partnerOpsNoteBody:
      'cron, NanoAI 서버 .env, 내부 수신함 Webhook은 쇼핑몰 사이트 연동에 필요하지 않습니다. B2B 피팅 API는 NanoAI에 문의해 키와 크레딧을 연결하세요.',
    extendNote:
      '새 API 추가 시: 파트너 페이지(/dashboard/api-integration), 본 관리 페이지, .env.example을 갱신하세요.',
    partnerExtendNote:
      '파트너용 API가 추가되면 이 페이지를 업데이트합니다. 연동 문의는 NanoAI 지원팀으로 연락하세요.',
    partnerBaseUrlFallbackWarning:
      '이 환경에 NEXT_PUBLIC_APP_URL(또는 NEXT_PUBLIC_BASE_URL)이 없어 예시 URL이 플레이스홀더입니다. 운영에서는 설정해 실제 NanoAI 도메인을 표시하세요.',
  },
}

export function resolveApiKeysHubBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '') ||
    'https://your-domain.com'
  )
}

/** true khi chưa cấu hình domain công khai — URL ví dụ trên trang hướng dẫn là placeholder */
export function isApiHubBaseUrlPlaceholder(baseUrl: string): boolean {
  return baseUrl === 'https://your-domain.com'
}

export type PartnerApiKeysManagerStrings = {
  cardTitle: string
  cardLead: string
  selectShop: string
  noShops: string
  partnerIdLabel: string
  embedTitle: string
  embedHint: string
  imageSearchTitle: string
  imageSearchHint: string
  show: string
  hide: string
  copy: string
  copied: string
  deleteKey: string
  deleteDialogTitle: string
  deleteDialogDescription: string
  deleteDialogCancel: string
  deleteDialogConfirm: string
  keyDeletedOk: string
  generate: string
  generating: string
  deleting: string
  enableApi: string
  enableApiHint: string
  keyPresent: string
  keyAbsent: string
  loadError: string
  saveAiFirstHint: string
  keyCreatedTitle: string
  keyCreatedDescription: string
  noEmbedKey: string
  copyFailed: string
}

export const PARTNER_API_KEYS_MANAGER_COPY: Record<ApiKeysHubLocale, PartnerApiKeysManagerStrings> = {
  vi: {
    cardTitle: 'Khóa API shop (Messaging)',
    cardLead:
      'X-Embed-Key dùng cho nhúng chat / API embed. Khóa Bearer riêng cho tìm sản phẩm bằng ảnh — chỉ hiện đầy đủ khi bạn bấm «Xem» hoặc vừa tạo mới.',
    selectShop: 'Chọn workspace (shop)',
    noShops: 'Chưa có workspace. Tạo shop tại Messaging → Cài đặt.',
    partnerIdLabel: 'Partner ID (cho dev)',
    embedTitle: 'X-Embed-Key (nhúng chat)',
    embedHint: 'Gửi header X-Embed-Key khi gọi API embed từ server backend shop.',
    imageSearchTitle: 'Khóa Bearer — tìm sản phẩm bằng ảnh',
    imageSearchHint: 'Authorization: Bearer … trên POST …/image-search. Lưu trên backend, không đưa vào JS trình duyệt khách.',
    show: 'Xem',
    hide: 'Ẩn',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    deleteKey: 'Xóa khóa',
    deleteDialogTitle: 'Xóa khóa API tìm ảnh?',
    deleteDialogDescription:
      'Backend shop đang dùng khóa này sẽ không còn gọi được API cho đến khi bạn tạo khóa mới.',
    deleteDialogCancel: 'Hủy',
    deleteDialogConfirm: 'Xóa',
    keyDeletedOk: 'Đã xóa khóa API tìm ảnh.',
    generate: 'Tạo / làm mới khóa',
    generating: 'Đang tạo…',
    deleting: 'Đang xóa…',
    enableApi: 'Bật API công khai (image-search)',
    enableApiHint: 'Tắt thì endpoint từ chối dù khóa còn trong DB.',
    keyPresent: 'Đã có khóa (đang ẩn).',
    keyAbsent: 'Chưa có khóa.',
    loadError: 'Không tải được khóa.',
    saveAiFirstHint: 'Vào Messaging → Cài đặt → AI, lưu cài đặt một lần trước khi tạo hoặc bật API.',
    keyCreatedTitle: 'Đã tạo khóa mới',
    keyCreatedDescription: 'Đã thử sao chép vào clipboard. Hãy lưu an toàn — sau khi ẩn trang chỉ hiện dạng che.',
    noEmbedKey: '(Chưa có embed key)',
    copyFailed: 'Không sao chép được.',
  },
  en: {
    cardTitle: 'Shop API keys (Messaging)',
    cardLead:
      'X-Embed-Key is for embed chat / embed API. The Bearer key for image product search is only shown in full when you click «Show» or right after you generate a new one.',
    selectShop: 'Select workspace (shop)',
    noShops: 'No workspace yet. Create a shop under Messaging → Settings.',
    partnerIdLabel: 'Partner ID (for developers)',
    embedTitle: 'X-Embed-Key (chat embed)',
    embedHint: 'Send the X-Embed-Key header when calling the embed API from your shop backend.',
    imageSearchTitle: 'Bearer key — image product search',
    imageSearchHint: 'Authorization: Bearer … on POST …/image-search. Keep on your server, not in shopper-facing JS.',
    show: 'Show',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied',
    deleteKey: 'Delete key',
    deleteDialogTitle: 'Delete image-search API key?',
    deleteDialogDescription:
      'Backends using this key will fail until you generate a new one.',
    deleteDialogCancel: 'Cancel',
    deleteDialogConfirm: 'Delete',
    keyDeletedOk: 'Image-search API key removed.',
    generate: 'Generate / rotate key',
    generating: 'Generating…',
    deleting: 'Deleting…',
    enableApi: 'Enable public image-search API',
    enableApiHint: 'When off, the endpoint rejects requests even if a secret exists.',
    keyPresent: 'A key exists (hidden).',
    keyAbsent: 'No key yet.',
    loadError: 'Could not load keys.',
    saveAiFirstHint: 'Open Messaging → Settings → AI and save settings once before generating or enabling the API.',
    keyCreatedTitle: 'New key created',
    keyCreatedDescription: 'Copied to clipboard if allowed. Store it safely — after hiding, only a masked value is shown.',
    noEmbedKey: '(No embed key)',
    copyFailed: 'Could not copy.',
  },
  zh: {
    cardTitle: '店铺 API 密钥（Messaging）',
    cardLead:
      'X-Embed-Key 用于嵌入聊天/嵌入 API。以图搜商品的 Bearer 密钥仅在您点击「显示」或刚生成后才会完整显示。',
    selectShop: '选择 workspace（店铺）',
    noShops: '尚无 workspace。请在 Messaging → 设置 中创建店铺。',
    partnerIdLabel: 'Partner ID（供开发）',
    embedTitle: 'X-Embed-Key（聊天嵌入）',
    embedHint: '从店铺后端调用嵌入 API 时发送 X-Embed-Key 请求头。',
    imageSearchTitle: 'Bearer 密钥 — 以图搜商品',
    imageSearchHint: 'POST …/image-search 使用 Authorization: Bearer …。放在服务器端，不要写入买家浏览器 JS。',
    show: '显示',
    hide: '隐藏',
    copy: '复制',
    copied: '已复制',
    deleteKey: '删除密钥',
    deleteDialogTitle: '删除以图搜商品 API 密钥？',
    deleteDialogDescription: '使用该密钥的后端将失败，直到您生成新密钥。',
    deleteDialogCancel: '取消',
    deleteDialogConfirm: '删除',
    keyDeletedOk: '已删除以图搜商品 API 密钥。',
    generate: '生成 / 轮换密钥',
    generating: '生成中…',
    deleting: '删除中…',
    enableApi: '启用公开 image-search API',
    enableApiHint: '关闭后即使数据库中有密钥，接口也会拒绝请求。',
    keyPresent: '已有密钥（已隐藏）。',
    keyAbsent: '尚未创建密钥。',
    loadError: '无法加载密钥。',
    saveAiFirstHint: '请先到 Messaging → 设置 → AI 保存一次配置，再生成或启用 API。',
    keyCreatedTitle: '已创建新密钥',
    keyCreatedDescription: '若允许已尝试复制到剪贴板。请妥善保存 — 隐藏后页面仅显示掩码。',
    noEmbedKey: '（无嵌入密钥）',
    copyFailed: '复制失败。',
  },
  ja: {
    cardTitle: '店舗 API キー（Messaging）',
    cardLead:
      'X-Embed-Key はチャット埋め込み/埋め込み API 用です。画像検索用 Bearer キーは「表示」を押した直後、または新規発行直後にのみ全文を表示します。',
    selectShop: 'ワークスペース（店舗）を選択',
    noShops: 'ワークスペースがありません。Messaging → 設定 で店舗を作成してください。',
    partnerIdLabel: 'Partner ID（開発者向け）',
    embedTitle: 'X-Embed-Key（チャット埋め込み）',
    embedHint: '埋め込み API を店舗バックエンドから呼ぶときに X-Embed-Key ヘッダーを付けます。',
    imageSearchTitle: 'Bearer キー — 画像で商品検索',
    imageSearchHint: 'POST …/image-search で Authorization: Bearer …。サーバー側に置き、購入者向け JS には含めないでください。',
    show: '表示',
    hide: '非表示',
    copy: 'コピー',
    copied: 'コピーしました',
    deleteKey: 'キーを削除',
    deleteDialogTitle: '画像検索 API キーを削除しますか？',
    deleteDialogDescription: 'このキーを使っているバックエンドは、新しいキーを発行するまで失敗します。',
    deleteDialogCancel: 'キャンセル',
    deleteDialogConfirm: '削除',
    keyDeletedOk: '画像検索 API キーを削除しました。',
    generate: 'キーを生成 / 再発行',
    generating: '生成中…',
    deleting: '削除中…',
    enableApi: '公開 image-search API を有効化',
    enableApiHint: 'オフのときは、DB に秘密があってもエンドポイントは拒否します。',
    keyPresent: 'キーあり（非表示）。',
    keyAbsent: 'キー未作成。',
    loadError: 'キーを読み込めませんでした。',
    saveAiFirstHint: '生成または有効化の前に、Messaging → 設定 → AI で一度保存してください。',
    keyCreatedTitle: '新しいキーを発行しました',
    keyCreatedDescription: '可能ならクリップボードにコピー済みです。安全に保管してください — 非表示にするとマスク表示のみになります。',
    noEmbedKey: '（埋め込みキーなし）',
    copyFailed: 'コピーできませんでした。',
  },
  ko: {
    cardTitle: '매장 API 키(Messaging)',
    cardLead:
      'X-Embed-Key는 채팅 임베드/임베드 API용입니다. 이미지 검색용 Bearer 키는 「보기」를 누르거나 방금 생성한 직후에만 전체가 표시됩니다.',
    selectShop: '워크스페이스(매장) 선택',
    noShops: '워크스페이스가 없습니다. Messaging → 설정에서 매장을 만드세요.',
    partnerIdLabel: 'Partner ID(개발용)',
    embedTitle: 'X-Embed-Key(채팅 임베드)',
    embedHint: '임베드 API를 매장 백엔드에서 호출할 때 X-Embed-Key 헤더를 보냅니다.',
    imageSearchTitle: 'Bearer 키 — 이미지 상품 검색',
    imageSearchHint: 'POST …/image-search에 Authorization: Bearer … 서버에만 두고 구매자 브라우저 JS에는 넣지 마세요.',
    show: '보기',
    hide: '숨기기',
    copy: '복사',
    copied: '복사됨',
    deleteKey: '키 삭제',
    deleteDialogTitle: '이미지 검색 API 키를 삭제할까요?',
    deleteDialogDescription: '이 키를 쓰는 백엔드는 새 키를 만들 때까지 실패합니다.',
    deleteDialogCancel: '취소',
    deleteDialogConfirm: '삭제',
    keyDeletedOk: '이미지 검색 API 키를 삭제했습니다.',
    generate: '키 생성 / 재발급',
    generating: '생성 중…',
    deleting: '삭제 중…',
    enableApi: '공개 image-search API 사용',
    enableApiHint: '끄면 DB에 비밀이 있어도 엔드포인트는 거부합니다.',
    keyPresent: '키 있음(숨김).',
    keyAbsent: '키 없음.',
    loadError: '키를 불러올 수 없습니다.',
    saveAiFirstHint: '생성 또는 사용 전에 Messaging → 설정 → AI에서 설정을 한 번 저장하세요.',
    keyCreatedTitle: '새 키가 생성되었습니다',
    keyCreatedDescription: '가능하면 클립보드에 복사했습니다. 안전히 보관하세요 — 숨기면 마스크만 표시됩니다.',
    noEmbedKey: '(임베드 키 없음)',
    copyFailed: '복사하지 못했습니다.',
  },
}
