import type { ApiKeysHubLocale } from '@/lib/integration/partner-dev-integration-copy'

export type PartnerSiteLoginGuideStrings = {
  pageTitle: string
  pageLead: string
  backMessagingSettings: string
  backApiIntegration: string
  selectShopHint: string
  hostedAutoFilledNote: string
  problemTitle: string
  problemBody: string
  inboxTableTitle: string
  inboxRowGuest: string
  inboxRowGuestOk: string
  inboxRowLoggedNoToken: string
  inboxRowLoggedNoTokenBad: string
  inboxRowWithToken: string
  inboxRowWithTokenGoal: string
  inboxRowEmailOnly: string
  flowTitle: string
  flowBody: string
  prepTitle: string
  prepEmbedKey: string
  prepSlug: string
  prepWidget: string
  tokenTitle: string
  tokenBody: string
  checklistTitle: string
  checklistBody: string
  /** Shop đã có code — checklist ops */
  opsNoteTitle: string
  opsNoteBody: string
  troubleshootTitle: string
  troubleshootBody: string
  apiPathLabel: string
  nanoaiTestCmd: string
  testTitle: string
  testBody: string
  nextJsTitle: string
  nextJsBody: string
  fullGuideNote: string
  noWorkspaceTitle: string
  noWorkspaceBody: string
  noWorkspaceCta: string
  copyCodeButton: string
  copyCodeToast: string
  copyCodeError: string
  codeLabelTokenPayload: string
  codeLabelSignTokenNode: string
  codeLabelSignTokenPython: string
  codeLabelSignTokenPhp: string
  codeLabelWidgetPassToken: string
  codeLabelExampleServer: string
  codeLabelNextJs: string
  codeLabelTest: string
  partnerSiteAuthEmbedKeyHint: string
}

export const PARTNER_SITE_LOGIN_GUIDE_COPY: Record<ApiKeysHubLocale, PartnerSiteLoginGuideStrings> = {
  vi: {
    pageTitle: 'Đăng nhập tự động — khách đã login web shop',
    pageLead:
      'Hướng dẫn cho shop nhúng widget chat NanoAI: khi khách **đã đăng nhập** trên website của bạn, chat mở sẵn tài khoản (email + tên inbox). Khách chưa login → chat ẩn danh. NanoAI **không** đọc cookie/session shop — bạn ký token ngắn hạn trên **server** và truyền vào widget.',
    backMessagingSettings: '← Cài đặt Messaging',
    backApiIntegration: 'Hướng dẫn API đầy đủ',
    selectShopHint: 'Chọn shop — slug, embed key và mã ví dụ bên dưới tự điền theo shop đang chọn.',
    hostedAutoFilledNote:
      'Mã ví dụ dùng đúng slug và URL host của shop đang chọn. Sao chép embed key vào biến môi trường **server** web shop (ví dụ NANOAI_EMBED_KEY), không đặt trong JS công khai.',
    problemTitle: 'Vì sao inbox vẫn hiện «Guest · Tên shop»?',
    problemBody:
      'Chỉ nhúng script widget **chưa đủ**. Nếu khách đã login web shop nhưng bạn **không** truyền token (`data-partner-customer-token` hoặc `setCustomer`), NanoAI coi như khách vãng lai.',
    inboxTableTitle: 'Trạng thái inbox sau khi khách nhắn tin',
    inboxRowGuest: 'Khách chưa login web shop',
    inboxRowGuestOk: 'Guest · {shop} — đúng',
    inboxRowLoggedNoToken: 'Đã login shop, chưa truyền token',
    inboxRowLoggedNoTokenBad: 'Guest · {shop} — cần tích hợp token',
    inboxRowWithToken: 'Đã login + truyền token có name',
    inboxRowWithTokenGoal: '{Tên khách} · {shop} — mục tiêu',
    inboxRowEmailOnly: 'Token chỉ có email, không name',
    flowTitle: 'Luồng tích hợp',
    flowBody:
      'Server shop ký token → trang shop truyền vào widget → iframe gọi POST …/auth/partner-site → NanoAI gắn guest account + cập nhật tên inbox. Bạn **không** cần gọi API auth tay nếu dùng script nhúng chuẩn.',
    prepTitle: 'Chuẩn bị',
    prepEmbedKey: 'Embed Key (UUID workspace): lấy tại Messaging → Cài đặt hoặc trang Hướng dẫn API.',
    prepSlug: 'Slug chat: URL dạng /messaging/p/{slug}?embed=1 — hiển thị bên dưới theo shop đang chọn.',
    prepWidget: 'Script widget: nanoai-chat-widget.js + data-chat-url (đã có trên nhiều shop; cần thêm token khi login).',
    tokenTitle: 'Định dạng token',
    tokenBody:
      'Token = base64url(JSON). Bắt buộc: email (lowercase), exp (Unix giây, TTL ≤ 900s), sig = HMAC-SHA256(embed_key, `email|exp`) hex 64 ký tự. Khuyến nghị: name (tên inbox), tuỳ chọn phone.',
    checklistTitle: 'Checklist ops / deploy (shop đã có code backend + CSR)',
    checklistBody:
      '• [ ] NANOAI_EMBED_KEY trên **VPS web shop** (không phải VPS NanoAI)\n• [ ] Restart API/web sau khi set env\n• [ ] GET /api/v1/nanoai/customer-token — login → 200 + token; chưa login → 401; thiếu key → 503\n• [ ] Sau login: setCustomer({ token }) hoặc data-partner-customer-token (CSR)\n• [ ] Logout: clearCustomer()\n• [ ] Inbox: {Tên} · {shop} — không Guest khi user đã login\n• [ ] Không test bằng View Source — dùng Network / Console sau login',
    opsNoteTitle: 'Shop đã implement code chưa?',
    opsNoteBody:
      'Nếu repo shop (ví dụ 188) **đã có** FastAPI ký token + Next CSR gọi setCustomer — **không** viết lại. Ticket này chỉ còn: set env, deploy, smoke test. NanoAI đã sẵn POST …/auth/partner-site.',
    troubleshootTitle: 'Vì sao vẫn Guest trên inbox?',
    troubleshootBody:
      '1) Thiếu NANOAI_EMBED_KEY → API 503 → frontend clear token im lặng.\n2) Sai path: /api/nanoai/... thay vì /api/v1/nanoai/customer-token.\n3) Chỉ xem HTML tĩnh — token CSR gắn sau login.\n4) Embed key sai UUID / sai workspace shop.',
    apiPathLabel: 'Path API token trên web shop (ví dụ 188)',
    nanoaiTestCmd: 'Smoke test spec token NanoAI (repo này)',
    testTitle: 'Kiểm thử nhanh',
    testBody:
      'curl (đã login): curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token\nConsole: document.querySelector(\'script[src*="nanoai-chat-widget"]\')?.getAttribute(\'data-partner-customer-token\')\nNanoAI: POST …/auth/partner-site với token từ shop.',
    nextJsTitle: 'Next.js / SPA (sau login)',
    nextJsBody: 'Gọi API token với credentials: include, rồi setCustomer trước khi mở chat.',
    fullGuideNote:
      'Xem thêm nhúng widget, tìm ảnh SP, Open Catalog tại trang Hướng dẫn API (/dashboard/api-integration). Tài liệu case study 188.com.vn: docs/PARTNER_SITE_CUSTOMER_NAME_SYNC_188.md trong repo NanoAI.',
    noWorkspaceTitle: 'Chưa có shop nhắn tin',
    noWorkspaceBody: 'Tạo workspace trong Messaging → Cài đặt, sau đó quay lại trang này.',
    noWorkspaceCta: 'Tạo shop — Cài đặt Messaging',
    copyCodeButton: 'Sao chép',
    copyCodeToast: 'Đã sao chép mã.',
    copyCodeError: 'Không sao chép được. Hãy chọn và copy thủ công.',
    codeLabelTokenPayload: 'Cấu trúc payload (trước base64url)',
    codeLabelSignTokenNode: 'Ký token — Node.js (server shop)',
    codeLabelSignTokenPython: 'Ký token — Python (server shop)',
    codeLabelSignTokenPhp: 'Ký token — PHP (server shop)',
    codeLabelWidgetPassToken: 'Truyền token vào widget',
    codeLabelExampleServer: 'API NanoAI (iframe tự gọi)',
    codeLabelNextJs: 'Frontend — sau login (SPA)',
    codeLabelTest: 'Script test (curl)',
    partnerSiteAuthEmbedKeyHint: 'Embed key shop đang chọn (đặt trên server — không commit git công khai):',
  },
  en: {
    pageTitle: 'Auto sign-in — shopper logged in on your shop site',
    pageLead:
      'For shops embedding the NanoAI chat widget: when a shopper is **logged in** on your website, chat opens with their account (email + inbox display name). Not logged in → anonymous chat. NanoAI does **not** read your shop session — sign a short-lived token on your **server** and pass it to the widget.',
    backMessagingSettings: '← Messaging settings',
    backApiIntegration: 'Full API integration guide',
    selectShopHint: 'Select a shop — slug, embed key, and examples below auto-fill for that workspace.',
    hostedAutoFilledNote:
      'Examples use the selected shop slug and host URL. Copy the embed key into a **server** env var (e.g. NANOAI_EMBED_KEY), never public client JS.',
    problemTitle: 'Why does inbox still show “Guest · Shop name”?',
    problemBody:
      'Embedding the widget script alone is **not enough**. If the shopper is logged in on your site but you do **not** pass a token (`data-partner-customer-token` or `setCustomer`), NanoAI treats them as anonymous.',
    inboxTableTitle: 'Inbox display after the shopper sends a message',
    inboxRowGuest: 'Not logged in on shop site',
    inboxRowGuestOk: 'Guest · {shop} — expected',
    inboxRowLoggedNoToken: 'Logged in on shop, no token passed',
    inboxRowLoggedNoTokenBad: 'Guest · {shop} — integrate token',
    inboxRowWithToken: 'Logged in + token with name',
    inboxRowWithTokenGoal: '{Customer name} · {shop} — goal',
    inboxRowEmailOnly: 'Token with email only, no name',
    flowTitle: 'Integration flow',
    flowBody:
      'Shop server signs token → storefront passes to widget → iframe POST …/auth/partner-site → NanoAI binds guest account and updates inbox name. No manual auth API call if you use the standard embed script.',
    prepTitle: 'Prerequisites',
    prepEmbedKey: 'Embed Key (workspace UUID): Messaging → Settings or API integration page.',
    prepSlug: 'Chat slug: /messaging/p/{slug}?embed=1 — shown below for the selected shop.',
    prepWidget: 'Widget script: nanoai-chat-widget.js + data-chat-url (many shops already have this; add token when logged in).',
    tokenTitle: 'Token format',
    tokenBody:
      'Token = base64url(JSON). Required: email (lowercase), exp (Unix seconds, TTL ≤ 900s), sig = HMAC-SHA256(embed_key, `email|exp`) 64-char hex. Recommended: name (inbox label), optional phone.',
    checklistTitle: 'Ops / deploy checklist (shop already has backend + CSR code)',
    checklistBody:
      '• [ ] NANOAI_EMBED_KEY on **shop web VPS** (not NanoAI VPS)\n• [ ] Restart API/web after setting env\n• [ ] GET /api/v1/nanoai/customer-token — logged in → 200 + token; not logged in → 401; missing key → 503\n• [ ] After login: setCustomer({ token }) or data-partner-customer-token (CSR)\n• [ ] Logout: clearCustomer()\n• [ ] Inbox: {name} · {shop} — not Guest when user is logged in\n• [ ] Do not verify via View Source — use Network / Console after login',
    opsNoteTitle: 'Already implemented on the shop repo?',
    opsNoteBody:
      'If the shop repo (e.g. 188) **already has** FastAPI token signing + Next CSR setCustomer — **do not** reimplement. Remaining work: env, deploy, smoke test. NanoAI already exposes POST …/auth/partner-site.',
    troubleshootTitle: 'Why is inbox still Guest?',
    troubleshootBody:
      '1) Missing NANOAI_EMBED_KEY → API 503 → frontend clears token silently.\n2) Wrong path: /api/nanoai/... instead of /api/v1/nanoai/customer-token.\n3) View Source only — CSR attaches token after login.\n4) Wrong embed key UUID / wrong workspace.',
    apiPathLabel: 'Shop token API path (e.g. 188)',
    nanoaiTestCmd: 'NanoAI token spec smoke test (this repo)',
    testTitle: 'Quick test',
    testBody:
      'curl (logged in): curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token\nConsole: document.querySelector(\'script[src*="nanoai-chat-widget"]\')?.getAttribute(\'data-partner-customer-token\')\nNanoAI: POST …/auth/partner-site with shop token.',
    nextJsTitle: 'Next.js / SPA (after login)',
    nextJsBody: 'Fetch token with credentials: include, then setCustomer before opening chat.',
    fullGuideNote:
      'Widget embed, image search, Open Catalog: /dashboard/api-integration. Case study 188.com.vn: docs/PARTNER_SITE_CUSTOMER_NAME_SYNC_188.md in the NanoAI repo.',
    noWorkspaceTitle: 'No messaging shop yet',
    noWorkspaceBody: 'Create a workspace under Messaging → Settings, then return here.',
    noWorkspaceCta: 'Create shop — Messaging settings',
    copyCodeButton: 'Copy',
    copyCodeToast: 'Code copied.',
    copyCodeError: 'Could not copy. Select and copy manually.',
    codeLabelTokenPayload: 'Payload shape (before base64url)',
    codeLabelSignTokenNode: 'Sign token — Node.js (shop server)',
    codeLabelSignTokenPython: 'Sign token — Python (shop server)',
    codeLabelSignTokenPhp: 'Sign token — PHP (shop server)',
    codeLabelWidgetPassToken: 'Pass token to widget',
    codeLabelExampleServer: 'NanoAI API (iframe calls automatically)',
    codeLabelNextJs: 'Frontend — after login (SPA)',
    codeLabelTest: 'Test script (curl)',
    partnerSiteAuthEmbedKeyHint: 'Embed key for selected shop (server env only — do not commit to public git):',
  },
  zh: {
    pageTitle: '自动登录 — 顾客已在店铺网站登录',
    pageLead:
      '嵌入 NanoAI 聊天 widget 的店铺：顾客在贵站**已登录**时，聊天以账户打开（邮箱 + 收件箱显示名）。未登录 → 匿名聊天。NanoAI**不会**读取店铺 session — 请在**服务端**签名短期 token 并传给 widget。',
    backMessagingSettings: '← Messaging 设置',
    backApiIntegration: '完整 API 集成说明',
    selectShopHint: '选择店铺 — 下方 slug、embed key 与示例将自动填充。',
    hostedAutoFilledNote: '示例使用所选店铺 slug 与主机 URL。将 embed key 放在**服务端**环境变量（如 NANOAI_EMBED_KEY），勿放入公开 JS。',
    problemTitle: '为何收件箱仍显示「Guest · 店铺名」？',
    problemBody: '仅嵌入 widget **不够**。顾客已在店铺登录但未传 token（`data-partner-customer-token` 或 `setCustomer`）时，NanoAI 视为匿名。',
    inboxTableTitle: '顾客发消息后收件箱显示',
    inboxRowGuest: '未在店铺网站登录',
    inboxRowGuestOk: 'Guest · {shop} — 正常',
    inboxRowLoggedNoToken: '已登录店铺，未传 token',
    inboxRowLoggedNoTokenBad: 'Guest · {shop} — 需集成 token',
    inboxRowWithToken: '已登录 + 带 name 的 token',
    inboxRowWithTokenGoal: '{顾客名} · {shop} — 目标',
    inboxRowEmailOnly: 'token 仅有 email，无 name',
    flowTitle: '集成流程',
    flowBody: '店铺服务端签名 token → 前台传给 widget → iframe POST …/auth/partner-site → NanoAI 绑定 guest 账户并更新收件箱名称。使用标准嵌入脚本时**无需**手动调 auth API。',
    prepTitle: '准备',
    prepEmbedKey: 'Embed Key（工作区 UUID）：Messaging → 设置或 API 集成页。',
    prepSlug: '聊天 slug：/messaging/p/{slug}?embed=1 — 见下方所选店铺。',
    prepWidget: 'Widget 脚本：nanoai-chat-widget.js + data-chat-url（许多店铺已有；登录时需加 token）。',
    tokenTitle: 'Token 格式',
    tokenBody: 'Token = base64url(JSON)。必填：email（小写）、exp（Unix 秒，TTL ≤ 900s）、sig = HMAC-SHA256(embed_key, `email|exp`) 64 位 hex。建议：name；可选 phone。',
    checklistTitle: '运维/部署清单（店铺已有后端+CSR代码）',
    checklistBody:
      '• [ ] 店铺 VPS 上 NANOAI_EMBED_KEY（非 NanoAI VPS）\n• [ ] 设置 env 后重启 API/web\n• [ ] GET /api/v1/nanoai/customer-token — 已登录→200+token；未登录→401；缺 key→503\n• [ ] 登录后 setCustomer 或 data-partner-customer-token\n• [ ] 登出 clearCustomer()\n• [ ] 收件箱显示真名非 Guest\n• [ ] 勿用 View Source 验证 — 用 Network/Console',
    opsNoteTitle: '店铺代码是否已实现？',
    opsNoteBody: '若店铺仓库（如 188）**已有** FastAPI+CSR — **勿**重写。仅需 env、部署、冒烟测试。',
    troubleshootTitle: '为何仍是 Guest？',
    troubleshootBody: '1) 缺 NANOAI_EMBED_KEY→503。2) 错误路径 /api/nanoai/...。3) 仅看静态 HTML。4) embed key 错误。',
    apiPathLabel: '店铺 token API 路径（如 188）',
    nanoaiTestCmd: 'NanoAI token 规范测试（本仓库）',
    testTitle: '快速测试',
    testBody: 'curl: curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token',
    nextJsTitle: 'Next.js / SPA（登录后）',
    nextJsBody: 'credentials: include 获取 token，打开聊天前 setCustomer。',
    fullGuideNote: '完整 widget、搜图、Open Catalog：/dashboard/api-integration。案例 188.com.vn：repo 内 docs/PARTNER_SITE_CUSTOMER_NAME_SYNC_188.md。',
    noWorkspaceTitle: '尚无消息店铺',
    noWorkspaceBody: '请在 Messaging → 设置 创建工作区后返回。',
    noWorkspaceCta: '创建店铺 — Messaging 设置',
    copyCodeButton: '复制',
    copyCodeToast: '已复制代码。',
    copyCodeError: '无法复制，请手动选择复制。',
    codeLabelTokenPayload: 'Payload 结构（base64url 前）',
    codeLabelSignTokenNode: '签名 — Node.js（店铺服务端）',
    codeLabelSignTokenPython: '签名 — Python（店铺服务端）',
    codeLabelSignTokenPhp: '签名 — PHP（店铺服务端）',
    codeLabelWidgetPassToken: '将 token 传给 widget',
    codeLabelExampleServer: 'NanoAI API（iframe 自动调用）',
    codeLabelNextJs: '前端 — 登录后（SPA）',
    codeLabelTest: '测试脚本（curl）',
    partnerSiteAuthEmbedKeyHint: '当前所选店铺 embed key（仅服务端环境变量，勿提交公开仓库）：',
  },
  ja: {
    pageTitle: '自動ログイン — 店舗サイトでログイン済みの購入者',
    pageLead:
      'NanoAI チャット widget を埋め込む店舗向け：購入者が貴店サイトで**ログイン済み**のとき、チャットはアカウント付きで開きます（メール + 受信箱表示名）。未ログイン → 匿名。NanoAI は店舗 session を**読みません** — **サーバー**で短期 token に署名し widget に渡してください。',
    backMessagingSettings: '← Messaging 設定',
    backApiIntegration: 'API 連携ガイド（全文）',
    selectShopHint: '店舗を選択 — slug・embed key・例は自動入力されます。',
    hostedAutoFilledNote: '例は選択店舗の slug とホスト URL を使用。embed key は**サーバー**環境変数（例 NANOAI_EMBED_KEY）に — 公開 JS に置かない。',
    problemTitle: '受信箱がまだ「Guest · 店舗名」の理由',
    problemBody: 'widget だけでは**不十分**です。店舗でログイン済みでも token（`data-partner-customer-token` または `setCustomer`）を渡さないと匿名扱いです。',
    inboxTableTitle: 'メッセージ送信後の受信箱表示',
    inboxRowGuest: '店舗サイト未ログイン',
    inboxRowGuestOk: 'Guest · {shop} — 正常',
    inboxRowLoggedNoToken: 'ログイン済み、token なし',
    inboxRowLoggedNoTokenBad: 'Guest · {shop} — token 連携が必要',
    inboxRowWithToken: 'ログイン + name 付き token',
    inboxRowWithTokenGoal: '{顧客名} · {shop} — 目標',
    inboxRowEmailOnly: 'email のみ、name なし',
    flowTitle: '連携フロー',
    flowBody: '店舗サーバーが token 署名 → フロントが widget に渡す → iframe が POST …/auth/partner-site → NanoAI が guest アカウントと受信箱名を更新。標準 embed なら auth API の手動呼び出し不要。',
    prepTitle: '準備',
    prepEmbedKey: 'Embed Key（ワークスペース UUID）：Messaging → 設定または API 連携ページ。',
    prepSlug: 'チャット slug：/messaging/p/{slug}?embed=1 — 選択店舗で下に表示。',
    prepWidget: 'Widget：nanoai-chat-widget.js + data-chat-url（多くの店舗は済み；ログイン時に token 追加）。',
    tokenTitle: 'Token 形式',
    tokenBody: 'Token = base64url(JSON)。必須：email（小文字）、exp（Unix 秒、TTL ≤ 900s）、sig = HMAC-SHA256(embed_key, `email|exp`) hex 64 文字。推奨：name；任意 phone。',
    checklistTitle: '運用/デプロイチェックリスト（店舗に既存コードあり）',
    checklistBody:
      '• [ ] 店舗 VPS に NANOAI_EMBED_KEY\n• [ ] env 設定後に再起動\n• [ ] GET /api/v1/nanoai/customer-token — ログイン→200；未ログイン→401；キー欠如→503\n• [ ] setCustomer / data-partner-customer-token\n• [ ] ログアウト clearCustomer()\n• [ ] 受信箱が実名表示',
    opsNoteTitle: '店舗側コードは既に実装済み？',
    opsNoteBody: '188 など **実装済み**なら再実装不要。env・デプロイ・テストのみ。',
    troubleshootTitle: 'まだ Guest の理由',
    troubleshootBody: '1) NANOAI_EMBED_KEY 未設定→503。2) パス誤り。3) View Source のみ。4) embed key 不一致。',
    apiPathLabel: '店舗 token API パス（188 例）',
    nanoaiTestCmd: 'NanoAI token スモークテスト',
    testTitle: '簡易テスト',
    testBody: 'curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token',
    nextJsTitle: 'Next.js / SPA（ログイン後）',
    nextJsBody: 'credentials: include で token 取得後、チャット前に setCustomer。',
    fullGuideNote: 'widget・画像検索・Open Catalog：/dashboard/api-integration。事例 188.com.vn：docs/PARTNER_SITE_CUSTOMER_NAME_SYNC_188.md。',
    noWorkspaceTitle: 'メッセージング店舗がありません',
    noWorkspaceBody: 'Messaging → 設定 でワークスペース作成後、再度お越しください。',
    noWorkspaceCta: '店舗作成 — Messaging 設定',
    copyCodeButton: 'コピー',
    copyCodeToast: 'コピーしました。',
    copyCodeError: 'コピーできません。手動でコピーしてください。',
    codeLabelTokenPayload: 'Payload（base64url 前）',
    codeLabelSignTokenNode: '署名 — Node.js（店舗サーバー）',
    codeLabelSignTokenPython: '署名 — Python（店舗サーバー）',
    codeLabelSignTokenPhp: '署名 — PHP（店舗サーバー）',
    codeLabelWidgetPassToken: 'widget に token を渡す',
    codeLabelExampleServer: 'NanoAI API（iframe が自動呼び出し）',
    codeLabelNextJs: 'フロント — ログイン後（SPA）',
    codeLabelTest: 'テスト（curl）',
    partnerSiteAuthEmbedKeyHint: '選択店舗の embed key（サーバー env のみ — 公開 git にコミットしない）:',
  },
  ko: {
    pageTitle: '자동 로그인 — 매장 사이트에 로그인한 고객',
    pageLead:
      'NanoAI 채팅 widget을 임베드한 매장: 고객이 귀사 사이트에**로그인**한 경우 채팅이 계정으로 열립니다(이메일 + 받은편지함 표시명). 미로그인 → 익명. NanoAI는 매장 session을**읽지 않습니다** — **서버**에서 단기 token에 서명해 widget에 전달하세요.',
    backMessagingSettings: '← Messaging 설정',
    backApiIntegration: '전체 API 연동 안내',
    selectShopHint: '매장 선택 — slug, embed key, 예시가 자동 채워집니다.',
    hostedAutoFilledNote: '예시는 선택 매장 slug와 호스트 URL을 사용합니다. embed key는**서버** 환경 변수(예 NANOAI_EMBED_KEY)에 — 공개 JS에 넣지 마세요.',
    problemTitle: '받은편지함이 여전히 «Guest · 매장명»인 이유',
    problemBody: 'widget만으로는**부족**합니다. 매장에 로그인했어도 token(`data-partner-customer-token` 또는 `setCustomer`)을 넘기지 않으면 익명 처리됩니다.',
    inboxTableTitle: '고객이 메시지 보낸 후 받은편지함',
    inboxRowGuest: '매장 사이트 미로그인',
    inboxRowGuestOk: 'Guest · {shop} — 정상',
    inboxRowLoggedNoToken: '로그인했으나 token 없음',
    inboxRowLoggedNoTokenBad: 'Guest · {shop} — token 연동 필요',
    inboxRowWithToken: '로그인 + name 포함 token',
    inboxRowWithTokenGoal: '{고객명} · {shop} — 목표',
    inboxRowEmailOnly: 'email만, name 없음',
    flowTitle: '연동 흐름',
    flowBody: '매장 서버 token 서명 → 프론트가 widget에 전달 → iframe POST …/auth/partner-site → NanoAI가 guest 계정·받은편지함 이름 갱신. 표준 embed 사용 시 auth API 수동 호출 불필요.',
    prepTitle: '준비',
    prepEmbedKey: 'Embed Key(워크스페이스 UUID): Messaging → 설정 또는 API 연동 페이지.',
    prepSlug: '채팅 slug: /messaging/p/{slug}?embed=1 — 선택 매장 기준 아래 표시.',
    prepWidget: 'Widget: nanoai-chat-widget.js + data-chat-url(많은 매장 완료; 로그인 시 token 추가).',
    tokenTitle: 'Token 형식',
    tokenBody: 'Token = base64url(JSON). 필수: email(소문자), exp(Unix 초, TTL ≤ 900s), sig = HMAC-SHA256(embed_key, `email|exp`) hex 64자. 권장: name; 선택 phone.',
    checklistTitle: '운영/배포 체크리스트(매장 코드 이미 있음)',
    checklistBody:
      '• [ ] 매장 VPS에 NANOAI_EMBED_KEY\n• [ ] env 설정 후 재시작\n• [ ] GET /api/v1/nanoai/customer-token — 로그인→200；미로그인→401；키 없음→503\n• [ ] setCustomer / data-partner-customer-token\n• [ ] 로그아웃 clearCustomer()\n• [ ] 받은편지함 실명 표시',
    opsNoteTitle: '매장 코드 이미 구현됨?',
    opsNoteBody: '188 등 **이미 구현**이면 재작성 불필요. env·배포·테스트만.',
    troubleshootTitle: '여전히 Guest인 이유',
    troubleshootBody: '1) NANOAI_EMBED_KEY 없음→503. 2) 잘못된 경로. 3) View Source만 확인. 4) embed key 불일치.',
    apiPathLabel: '매장 token API 경로(188 예)',
    nanoaiTestCmd: 'NanoAI token 스모크 테스트',
    testTitle: '빠른 테스트',
    testBody: 'curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token',
    nextJsTitle: 'Next.js / SPA(로그인 후)',
    nextJsBody: 'credentials: include로 token 후 setCustomer.',
    fullGuideNote: 'widget·이미지 검색·Open Catalog: /dashboard/api-integration. 사례 188.com.vn: docs/PARTNER_SITE_CUSTOMER_NAME_SYNC_188.md.',
    noWorkspaceTitle: '메시징 매장 없음',
    noWorkspaceBody: 'Messaging → 설정에서 워크스페이스 생성 후 다시 방문하세요.',
    noWorkspaceCta: '매장 만들기 — Messaging 설정',
    copyCodeButton: '복사',
    copyCodeToast: '복사됨.',
    copyCodeError: '복사할 수 없습니다. 수동으로 복사하세요.',
    codeLabelTokenPayload: 'Payload(base64url 전)',
    codeLabelSignTokenNode: '서명 — Node.js(매장 서버)',
    codeLabelSignTokenPython: '서명 — Python(매장 서버)',
    codeLabelSignTokenPhp: '서명 — PHP(매장 서버)',
    codeLabelWidgetPassToken: 'widget에 token 전달',
    codeLabelExampleServer: 'NanoAI API(iframe 자동 호출)',
    codeLabelNextJs: '프론트 — 로그인 후(SPA)',
    codeLabelTest: '테스트(curl)',
    partnerSiteAuthEmbedKeyHint: '선택 매장 embed key(서버 env만 — 공개 git 커밋 금지):',
  },
}
