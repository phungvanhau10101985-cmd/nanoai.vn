import type { ApiKeysHubLocale } from '@/lib/integration/api-keys-hub-copy'

/** Chuỗi giao diện — hướng dẫn tích hợp cho dev đối tác (/dashboard/api-integration). */
export type PartnerDevIntegrationStrings = {
  title: string
  hostedTitle: string
  hostedBody: string
  embedWidgetSettingsTitle: string
  embedWidgetSettingsBody: string
  embedPositionLabel: string
  embedPositionRight: string
  embedPositionLeft: string
  embedBottomOffsetLabel: string
  embedHorizontalOffsetLabel: string
  embedDesktopWidthLabel: string
  embedDesktopHeightLabel: string
  embedBorderRadiusLabel: string
  embedTitle: string
  embedBody: string
  embedSessionUuid: string
  embedHeadersLabel: string
  embedGetDesc: string
  embedPostDesc: string
  embedUploadDesc: string
  embedVisionPickDesc: string
  guestTitle: string
  guestBody: string
  guestVisionPickNote: string
  imageSearchTitle: string
  imageSearchBody: string
  /** Tiền điều kiện kho + lấy partnerId; hiển thị dưới imageSearchBody */
  imageSearchPrereq: string
  /** Nullable fields + 200 với mảng rỗng */
  imageSearchResponseEdgeCases: string
  /** Bảng mã HTTP lỗi (body { error }) */
  imageSearchHttpErrors: string
  imageSearchRateLimit: string
  /** Mục D — tìm theo chữ (JSON → vector → ANN), cùng Bearer */
  textSearchVectorBody: string
  /** Open Catalog — POST JSON kho kiểu marketplace (Shopee-like) → NanoAI */
  inventoryOpenTitle: string
  inventoryOpenBody: string
  inventoryOpenRateLimit: string
  tryOnTitle: string
  tryOnBody: string
  snippetNote: string
  codeLabelExampleServer: string
  codeLabelResponseShape: string
  /** Ví dụ phản hồi 200 với mảng rỗng (mục D) */
  codeLabelResponseEmpty: string
  codeLabelExample: string
  /** Nút sao chép đoạn <script> nhúng widget chat */
  copyHostedScriptButton: string
  copyHostedScriptToast: string
  copyHostedScriptError: string
  copyCodeButton: string
  copyCodeToast: string
  copyCodeError: string
  checklistTitle: string
  checklistBody: string
  /** Nhãn hiển thị cho mã slug (không phải placeholder {slug}) */
  shopIdentifierLabel: string
  /** Gợi ý: chọn shop → link & script đã điền sẵn */
  hostedAutoFilledNote: string
  noWorkspaceTitle: string
  noWorkspaceBody: string
  noWorkspaceCta: string
}

export const PARTNER_DEV_INTEGRATION_COPY: Record<ApiKeysHubLocale, PartnerDevIntegrationStrings> = {
  vi: {
    title: 'Hướng dẫn triển khai cho developer',
    hostedTitle: 'A — Chat trên NanoAI (iframe / liên kết)',
    hostedBody:
      'Khách đăng nhập Google trong trang NanoAI (cookie first-party). Tin đồng bộ với mục tin nhắn NanoAI của khách. Copy URL và đoạn iframe tại Bảng điều khiển → Tích hợp API (/dashboard/api-integration, mục chat hosted). Nên thêm ?embed=1 khi nhúng iframe để giao diện tối ưu trong khung. Đường dẫn công khai có dạng:',
    embedWidgetSettingsTitle: 'Cài đặt mã nhúng nổi',
    embedWidgetSettingsBody:
      'Góc (trái/phải) và khoảng cách đáy, cạnh áp dụng cho nút nổi trên cả mobile và desktop. Rộng/cao chỉ cho khung chat trên desktop; mã script bên dưới tự cập nhật.',
    embedPositionLabel: 'Góc hiển thị',
    embedPositionRight: 'Phải',
    embedPositionLeft: 'Trái',
    embedBottomOffsetLabel: 'Cách đáy (px)',
    embedHorizontalOffsetLabel: 'Cách cạnh trái/phải (px)',
    embedDesktopWidthLabel: 'Rộng desktop (px)',
    embedDesktopHeightLabel: 'Cao desktop (px)',
    embedBorderRadiusLabel: 'Bo góc (px)',
    embedTitle: 'B — API chat ẩn danh trên domain shop (CORS)',
    embedBody:
      'Gọi từ trình duyệt trên website shop; API cho phép CORS *. Không dùng Bearer.',
    embedSessionUuid:
      'X-Session-Id phải là UUID hợp lệ (RFC 4122, phiên bản 1–5), cố định theo từng trình duyệt (khuyến nghị localStorage) để không tách hội thoại.',
    embedHeadersLabel:
      'Mọi request (GET/POST/…) gửi đồng thời X-Embed-Key (sao chép từ Bảng điều khiển → Tích hợp API) và X-Session-Id đúng quy tắc ở trên.',
    embedGetDesc: 'GET — tải lịch sử tin của phiên (cùng slug + key + session).',
    embedPostDesc:
      'POST — gửi tin; Content-Type: application/json. Body có thể có text và/hoặc imageStoragePath (đường dẫn storage sau bước upload). Phản hồi có thể gồm visionPickRequired khi cần khách chọn sản phẩm từ Vision.',
    embedUploadDesc: 'POST …/image — multipart/form-data, field file (ảnh). Trả về path và publicUrl; dùng path làm imageStoragePath khi POST tin.',
    embedVisionPickDesc:
      'POST …/vision-pick — JSON { messageId, inventoryId } (khi POST tin trả về visionPickRequired: true). Cùng header X-Embed-Key và X-Session-Id.',
    guestTitle: 'C — API trang hosted /messaging/p/… (khách đã đăng nhập NanoAI)',
    guestBody:
      'Gọi same-origin với cookie phiên đăng nhập: GET/POST /api/messaging/guest/{slug} (JSON giống nhánh B). Upload ảnh: POST /api/messaging/guest/{slug}/image, multipart field file. Nếu bạn tự xây widget trên shop, thường chỉ cần nhánh B; nhánh C phục vụ trang chat chính thức trên domain NanoAI.',
    guestVisionPickNote:
      'Chọn sản phẩm Vision (khi POST tin trả visionPickRequired): POST …/vision-pick với cookie. Cùng route cũng chấp nhận X-Embed-Key + X-Session-Id cho tích hợp cross-origin nâng cao.',
    imageSearchTitle: 'D — API tìm sản phẩm công khai (ảnh & văn bản / vector)',
    imageSearchBody:
      'Chỉ gọi từ backend shop (không lộ Bearer). Một khóa bật tại Bảng điều khiển → Tích hợp API. Đồng bộ kho và embedding: Messaging → Cài đặt → AI. Ảnh: POST multipart tới `…/image-search` (field `image` hoặc `file` ≤ ~5 MB, tùy chọn `limit`, mặc định gợi ý 24 (cấu hình: PARTNER_PUBLIC_INVENTORY_SEARCH_DEFAULT_LIMIT)). Văn bản: POST JSON tới `…/text-search` — câu tìm được embed (Gemini) thành vector rồi ANN trên vector văn bản từng mặt hàng; xem đoạn dưới. Trả về: ok, products (cùng schema), error khi rỗng / lỗi mềm.',
    imageSearchPrereq:
      'Tiền điều kiện: kho sản phẩm (Open Catalog hoặc nhập kho) đã có bản ghi; pipeline đồng bộ/index theo cài đặt AI (nếu bật gợi ý theo vector). Trong URL, {partnerId} là UUID shop — tại Bảng điều khiển, chọn đúng shop: đoạn «URL mẫu» bên dưới tự điền theo shop đang chọn.',
    imageSearchResponseEdgeCases:
      'Trong từng phần tử products: product_url, score, price_hint và (đôi khi) sku có thể null; color_image_urls luôn là mảng (có thể rỗng) — lấy từ ảnh chi tiết / màu đã lưu trong kho. Phản hồi HTTP 200 vẫn có thể có products rỗng; khi đó xem thêm trường error — tích hợp cần xử lý cả mảng rỗng, không giả định luôn có sản phẩm.',
    imageSearchHttpErrors:
      'Lỗi (thường là { "error": "…" } — không cùng schema với thành công): 400 thiếu file / file không phải ảnh / vượt ~5 MB, hoặc (text) query quá ngắn. 401 thiếu hoặc sai Bearer. 403 shop tắt API tìm sản phẩm, hoặc shop không nhận traffic API. 404 shop không tồn tại, hoặc chưa có cài đặt AI. 415 (text) sai Content-Type. 429 vượt giới hạn tần suất (có Retry-After). 500 (text) lỗi tìm vector. 503 thiếu cấu hình DB, hoặc chưa tạo khóa API (thông điệp từ server).',
    imageSearchRateLimit:
      'Có giới hạn tần suất theo IP + shop (HTTP 429, có Retry-After). Nên cache và tránh gọi trực tiếp từ trình duyệt.',
    textSearchVectorBody:
      'Tìm theo chữ (vector): `POST` `…/text-search` — `Content-Type: application/json` (hoặc `application/x-www-form-urlencoded` với `q=` & `limit=`). Body JSON: `{ "q": "…" }` hoặc `query`. Tối thiểu 2 ký tự. `limit` 1…50, mặc định 24. Cần `GOOGLE_API_KEY` trên server và kho đã sync text embedding (cùng pipeline AI).',
    inventoryOpenTitle: 'F — Open Catalog: đồng bộ kho (JSON chuẩn marketplace / Shopee-like)',
    inventoryOpenBody:
      'Gọi từ **backend web shop** (không lộ Bearer). Dùng **cùng khóa** và bật API như mục D (`image_search_api_enabled`). **Không** cần Vision. `Content-Type: application/json`. Body: `items` (mảng lớn; giới hạn theo `PARTNER_INVENTORY_OPEN_SYNC_MAX_ITEMS` trên server). Mỗi phần tử nên có `item_sku` (hoặc `sku`), `item_name` (hoặc `name`); tuỳ chọn `description`, `stock_note`, `price` / `price_hint`, `image`: { `image_url_list`: [https…] } hoặc `image_url`, `item_url` / `product_url`, `consult_note`, `sort_order`, `item_status` (`NORMAL` = đang dùng, `UNLIST` / `DELETED` / `INACTIVE` = ẩn). Open Catalog chạy theo **full reconcile**: payload là nguồn sự thật, hàng còn trong NanoAI nhưng không còn trong payload sẽ bị xóa (và gỡ khỏi Vision ở lượt sync nền). Quy tắc khớp dòng giống nhập Excel: có SKU → cập nhật theo SKU; không SKU → theo tên.',
    inventoryOpenRateLimit:
      'Giới hạn theo IP + shop (429). Tuỳ chọn: PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_MAX và PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_WINDOW_MS; nếu không set thì dùng chung biến IMAGE_SEARCH_RATE_LIMIT_*.',
    tryOnTitle: 'E — API thử đồ ảo B2B',
    tryOnBody:
      'POST multipart: bắt buộc userImage; ít nhất một ảnh trang phục (garmentImage0 … hoặc garmentCount + garmentImage{i}). Tùy chọn: imageQuality 2K|4K, gender male|female, customPrompt. Authorization: Bearer <bí mật thô> do NanoAI cấp. Credits trừ theo tài khoản billing đã gắn trong hợp đồng.',
    snippetNote:
      'Các khối mã ví dụ (curl / JSON) dùng tiếng Anh để thống nhất giữa các đội ngũ.',
    codeLabelExampleServer: 'Ví dụ (backend shop)',
    codeLabelResponseShape: 'Cấu trúc phản hồi',
    codeLabelResponseEmpty: 'Ví dụ: không khớp (vẫn HTTP 200)',
    codeLabelExample: 'Ví dụ',
    copyHostedScriptButton: 'Sao chép mã nhúng script',
    copyHostedScriptToast: 'Đã sao chép mã nhúng script.',
    copyHostedScriptError: 'Không sao chép được. Hãy chọn và copy thủ công.',
    copyCodeButton: 'Sao chép',
    copyCodeToast: 'Đã sao chép mã.',
    copyCodeError: 'Không sao chép được. Hãy chọn và copy thủ công.',
    checklistTitle: 'Checklist trước khi production',
    checklistBody:
      '• Không đặt X-Embed-Key hay Bearer trong bundle JS công khai.\n• Nếu dùng D: đã tạo/bật khóa Bearer tại Bảng điều khiển → Tích hợp API; đã bật đồng bộ/gợi ý theo ảnh tại Messaging → Cài đặt → AI; xử lý cả phản hồi 200 với `products` rỗng.\n• Nếu dùng F: cùng khóa Bearer; gọi từ server shop; xử lý mã lỗi `code` trong JSON.\n• Đã test CORS từ domain thật của shop (nhánh B).\n• Xử lý 400 / 401 / 403 / 404 / 429 / 503 (D: file/ảnh/kích thước; thiếu/khóa API; shop thiết lập) và thông báo cho người dùng.',
    shopIdentifierLabel: 'Mã định danh chat (slug)',
    hostedAutoFilledNote:
      'Chọn đúng shop ở danh sách phía trên: đường link công khai và toàn bộ mã nhúng bên dưới đã được điền sẵn cho shop đó — bạn chỉ cần «Sao chép mã nhúng script» và dán vào website; không phải thay {slug} hay sửa URL tay.',
    noWorkspaceTitle: 'Chưa có shop nhắn tin',
    noWorkspaceBody:
      'Bạn cần tạo ít nhất một workspace (cửa hàng) trong Messaging. Sau khi tạo xong, quay lại trang này: chọn shop trong danh sách và sao chép mã — hệ thống tự gắn đúng mã định danh, không cần chỉnh sửa.',
    noWorkspaceCta: 'Tạo shop — Cài đặt Messaging',
  },
  en: {
    title: 'Developer implementation guide',
    hostedTitle: 'A — Chat on NanoAI (iframe / link)',
    hostedBody:
      'Shoppers sign in with Google on NanoAI (first-party cookies). Threads sync with NanoAI “My chats”. Copy the public URL and iframe snippet under Dashboard → API integration (hosted chat section, /dashboard/api-integration). Add ?embed=1 when embedding as an iframe for a compact layout. Public path pattern:',
    embedWidgetSettingsTitle: 'Floating embed settings',
    embedWidgetSettingsBody:
      'Corner, bottom, and horizontal offsets apply to the floating button on mobile and desktop. Width/height apply to the chat panel on desktop only. The script below updates automatically.',
    embedPositionLabel: 'Corner',
    embedPositionRight: 'Right',
    embedPositionLeft: 'Left',
    embedBottomOffsetLabel: 'Bottom offset (px)',
    embedHorizontalOffsetLabel: 'Left/Right offset (px)',
    embedDesktopWidthLabel: 'Desktop width (px)',
    embedDesktopHeightLabel: 'Desktop height (px)',
    embedBorderRadiusLabel: 'Border radius (px)',
    embedTitle: 'B — Anonymous chat API on your shop domain (CORS)',
    embedBody:
      'Call from the browser on your storefront; APIs send Access-Control-Allow-Origin: *. No Bearer.',
    embedSessionUuid:
      'X-Session-Id must be a valid RFC 4122 UUID (versions 1–5), stable per browser (localStorage recommended) so the thread stays continuous.',
    embedHeadersLabel:
      'Every GET/POST must include X-Embed-Key (copy from Dashboard → API integration) and the stable X-Session-Id described above.',
    embedGetDesc: 'GET — fetch message history for this session (same slug, key, session).',
    embedPostDesc:
      'POST — send a message; Content-Type: application/json. Body may include text and/or imageStoragePath (storage path returned from the image upload step). Response may include visionPickRequired when the shopper must pick a Vision product.',
    embedUploadDesc:
      'POST …/image — multipart/form-data, field file. Response includes path and publicUrl; use path as imageStoragePath in the message POST.',
    embedVisionPickDesc:
      'POST …/vision-pick — JSON { messageId, inventoryId } when the message POST returned visionPickRequired: true. Same X-Embed-Key and X-Session-Id headers.',
    guestTitle: 'C — Hosted page /messaging/p/… (logged-in NanoAI user)',
    guestBody:
      'Same-origin calls with the session cookie: GET/POST /api/messaging/guest/{slug} (same JSON shape as B). Image upload: POST /api/messaging/guest/{slug}/image, multipart field file. Custom shop widgets usually rely on B only; C matches the official NanoAI-hosted chat page.',
    guestVisionPickNote:
      'Vision pick (when a POST returns visionPickRequired): POST …/vision-pick with the session cookie on the hosted page. The same route also accepts X-Embed-Key + X-Session-Id for advanced cross-origin flows.',
    imageSearchTitle: 'D — Public product search API (image & text / vector)',
    imageSearchBody:
      'Call only from your shop backend (never expose the Bearer key). One key under Dashboard → API integration. Sync under Messaging → Settings → AI. Image: POST multipart to `…/image-search`. Text: POST JSON to `…/text-search` — query is embedded (Gemini) then ANN on per-item text vectors; see the block below. Response: ok, products (same schema), error when empty or soft failure.',
    imageSearchPrereq:
      'Prerequisites: inventory (Open Catalog or import) is populated, and the AI index/sync path is complete when image-vector search is enabled. The {partnerId} segment in the URL is the shop UUID—pick the correct workspace above: the example URL is auto-filled for the selected shop.',
    imageSearchResponseEdgeCases:
      'Each product may have product_url, score, price_hint, and sometimes sku set to null depending on your catalog. color_image_urls is always an array (may be empty)—extra image URLs from catalog detail/color fields. HTTP 200 can return ok: true with an empty products array; check the error field—handle empty results in your UI.',
    imageSearchHttpErrors:
      'Errors are usually { "error": "…" } (not the same shape as success): 400 bad file/image/size, or (text) query too short. 401 missing/invalid Bearer. 403 public product search disabled, or shop not accepting API traffic. 404 shop or AI settings missing. 415 (text) wrong Content-Type. 429 rate limit (Retry-After). 500 (text) vector search failure. 503 database or API key not configured.',
    imageSearchRateLimit:
      'Rate limited per IP + shop (HTTP 429 with Retry-After). Avoid calling from the browser; cache where possible.',
    textSearchVectorBody:
      'Text (vector) search: `POST` `…/text-search` — `Content-Type: application/json` (or `application/x-www-form-urlencoded` with `q=` and optional `limit=`). JSON: `{ "q": "…" }` or `query`. Min 2 characters. `limit` 1…50, default 24. Requires `GOOGLE_API_KEY` and catalog text-embedding sync.',
    inventoryOpenTitle: 'F — Open Catalog: inventory sync (marketplace-style / Shopee-like JSON)',
    inventoryOpenBody:
      'Call from your **shop backend** only (never expose the Bearer key). Uses the **same API key** as D (`image_search_api_enabled`). **Does not** require Vision. `Content-Type: application/json`. Body: large `items` array (server-limited by `PARTNER_INVENTORY_OPEN_SYNC_MAX_ITEMS`). Each item should include `item_sku` (or `sku`) and `item_name` (or `name`); optional `description`, `stock_note`, `price` / `price_hint`, `image`: { `image_url_list`: ["https://…"] } or `image_url`, `item_url` / `product_url`, `consult_note`, `sort_order`, `item_status` (`NORMAL` = active, `UNLIST` / `DELETED` / `INACTIVE` = hidden). Open Catalog runs in **full reconcile** mode: the payload is the source of truth; items still in NanoAI but missing from payload are deleted (and removed from Vision during background sync). Row matching follows Excel import rules: SKU first; without SKU, match by product name.',
    inventoryOpenRateLimit:
      'Rate limited per IP + shop (429). Optional env: PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_MAX and PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_WINDOW_MS; falls back to IMAGE_SEARCH_RATE_LIMIT_* when unset.',
    tryOnTitle: 'E — B2B virtual try-on API',
    tryOnBody:
      'POST multipart: userImage required; at least one garment (garmentImage0 … or garmentCount + garmentImage{i}). Optional: imageQuality 2K|4K, gender male|female, customPrompt. Authorization: Bearer <raw secret> issued by NanoAI. Credits bill the linked billing account per contract.',
    snippetNote: 'Example blocks (curl / JSON) are in English for consistency across teams.',
    codeLabelExampleServer: 'Example (shop backend)',
    codeLabelResponseShape: 'Response shape',
    codeLabelResponseEmpty: 'Example: no matches (HTTP 200)',
    codeLabelExample: 'Example',
    copyHostedScriptButton: 'Copy embed script',
    copyHostedScriptToast: 'Embed script copied.',
    copyHostedScriptError: 'Could not copy. Select the code and copy manually.',
    copyCodeButton: 'Copy',
    copyCodeToast: 'Code copied.',
    copyCodeError: 'Could not copy. Select the code and copy manually.',
    checklistTitle: 'Pre-production checklist',
    checklistBody:
      '• Do not ship X-Embed-Key or Bearer keys in public frontend bundles.\n• For D: create/enable the Bearer key on Dashboard → API integration; enable image/catalog sync under Messaging → Settings → AI; handle HTTP 200 with an empty `products` array.\n• For F: same Bearer key; call from the shop server; handle JSON `code` on errors.\n• Test CORS from your real shop domain (track B).\n• Handle 400 / 401 / 403 / 404 / 429 / 503 (D: file/image/size; API key; shop settings) with clear user messaging.',
    shopIdentifierLabel: 'Chat shop ID (slug)',
    hostedAutoFilledNote:
      'Pick your shop above: the public URL and embed script below are pre-filled for that workspace — use «Copy embed script» and paste on your site. No manual {slug} replacement.',
    noWorkspaceTitle: 'No messaging workspace yet',
    noWorkspaceBody:
      'Create a workspace under Messaging settings first. Then return here, select your shop, and copy the ready-made embed code — the correct slug is filled in automatically.',
    noWorkspaceCta: 'Create workspace — Messaging settings',
  },
  zh: {
    title: '开发者实施指南',
    hostedTitle: 'A — 在 NanoAI 上聊天（iframe / 链接）',
    hostedBody:
      '顾客在 NanoAI 页面使用 Google 登录（第一方 cookie）。会话与 NanoAI「我的聊天」同步。在 控制台 → API 集成说明（/dashboard/api-integration，托管聊天）复制公开 URL 与 iframe。iframe 嵌入时建议加 ?embed=1 以优化布局。公开路径形式：',
    embedWidgetSettingsTitle: '浮动嵌入设置',
    embedWidgetSettingsBody:
      '左右角与距底/侧边距对移动端与桌面端的浮动按钮均生效；宽高仅作用于桌面端聊天窗；下方脚本会自动更新。',
    embedPositionLabel: '显示角落',
    embedPositionRight: '右侧',
    embedPositionLeft: '左侧',
    embedBottomOffsetLabel: '距底部 (px)',
    embedHorizontalOffsetLabel: '距左/右边 (px)',
    embedDesktopWidthLabel: '桌面宽度 (px)',
    embedDesktopHeightLabel: '桌面高度 (px)',
    embedBorderRadiusLabel: '圆角 (px)',
    embedTitle: 'B — 店铺域名上的匿名聊天 API（CORS）',
    embedBody: '从店铺网站浏览器调用；接口返回 Access-Control-Allow-Origin: *。不使用 Bearer。',
    embedSessionUuid:
      'X-Session-Id 须为有效 RFC 4122 UUID（版本 1–5），按浏览器固定（建议 localStorage），以免会话被拆分。',
    embedHeadersLabel:
      '每个 GET/POST 须同时携带 X-Embed-Key（控制台 → API 集成说明页复制）与符合上文规则的 X-Session-Id。',
    embedGetDesc: 'GET — 获取该会话消息历史（同一 slug、密钥、session）。',
    embedPostDesc:
      'POST — 发送消息；Content-Type: application/json。Body 可含 text 和/或 imageStoragePath（上传接口返回的存储路径）。若需顾客从 Vision 选品，响应可能含 visionPickRequired。',
    embedUploadDesc: 'POST …/image — multipart/form-data，字段 file。响应含 path 与 publicUrl；将 path 作为 imageStoragePath 用于发消息。',
    embedVisionPickDesc:
      'POST …/vision-pick — JSON { messageId, inventoryId }（当发消息返回 visionPickRequired: true 时）。请求头仍为 X-Embed-Key 与 X-Session-Id。',
    guestTitle: 'C — 托管页 /messaging/p/…（已登录 NanoAI）',
    guestBody:
      '与站点同域并携带登录 cookie：GET/POST /api/messaging/guest/{slug}（JSON 与 B 相同）。上传图片：POST /api/messaging/guest/{slug}/image，multipart 字段 file。自研店铺挂件通常只用 B；C 对应 NanoAI 官方托管聊天页。',
    guestVisionPickNote:
      'Vision 选品（发消息返回 visionPickRequired 时）：POST …/vision-pick，托管页用 cookie。同一路由在高级场景下也支持 X-Embed-Key + X-Session-Id。',
    imageSearchTitle: 'D — 公开商品搜索 API（图 & 文 / 向量）',
    imageSearchBody:
      '仅从店铺后端调用。同一密钥。库存与嵌入在 Messaging → 设置 → AI。图：multipart `…/image-search`。文：见下段（Gemini 嵌入后 ANN）。返回 ok、products、error。',
    imageSearchPrereq:
      '前提：已有库存数据（Open Catalog 或导入）；若启用向量化/索引，需完成 AI 侧同步。URL 中 {partnerId} 为店铺 UUID — 在上方选择店铺后，下方示例 URL 自动填入该店铺.',
    imageSearchResponseEdgeCases:
      'products 各项中 product_url、score、price_hint、sku 可能为 null；color_image_urls 始终为数组（可为空），来自目录中已保存的细节/颜色图 URL。HTTP 200 仍可能出现 products: []，请同时查看 error 字段，前端需处理空结果。',
    imageSearchHttpErrors:
      '错误多为 { "error": "…" }：400 图/查询；401 Bearer；403/404；415 文搜 Content-Type；429；500 文搜向量；503 库/密钥。',
    imageSearchRateLimit: '按 IP + 店铺限频（HTTP 429，含 Retry-After）。勿在浏览器直连；可适当缓存。',
    textSearchVectorBody:
      '文搜（向量）：`POST` `…/text-search`，`Content-Type: application/json` 或 form 的 `q`、`limit`。JSON：`{ "q": "…" }`。至少 2 字。limit 1…50，默认 24。需 `GOOGLE_API_KEY` 与目录文本向量同步。',
    inventoryOpenTitle: 'F — Open Catalog：库存同步（类电商平台 / Shopee 风格 JSON）',
    inventoryOpenBody:
      '仅从**店铺后端**调用（勿暴露 Bearer）。与 D 使用**同一密钥**并启用公开 API（`image_search_api_enabled`）。**无需** Vision。`Content-Type: application/json`。Body：`items` 数组（每请求最多 500 条）。每条建议含 `item_sku`（或 `sku`）、`item_name`（或 `name`）；可选 `description`、`stock_note`、`price` / `price_hint`、`image`: { `image_url_list`: [https…] } 或 `image_url`、`item_url` / `product_url`、`consult_note`、`sort_order`、`item_status`（`NORMAL` 为在售，`UNLIST` / `DELETED` / `INACTIVE` 为隐藏）。行匹配规则与 Excel 导入一致：优先 SKU，无 SKU 按名称。',
    inventoryOpenRateLimit:
      '按 IP + 店铺限流（429）。可选环境变量 PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_MAX 与 WINDOW_MS；未设置时回退到 IMAGE_SEARCH_RATE_LIMIT_*。',
    tryOnTitle: 'E — B2B 虚拟试衣 API',
    tryOnBody:
      'POST multipart：必填 userImage；至少一件服装图 garmentImage0… 或 garmentCount + garmentImage{i}。可选 imageQuality 2K|4K、gender male|female、customPrompt。Authorization: Bearer <明文密钥> 由 NanoAI 提供。按合同从绑定计费账户扣 credits。',
    snippetNote: '示例代码块（curl / JSON）使用英文以便各团队统一。',
    codeLabelExampleServer: '示例（店铺后端）',
    codeLabelResponseShape: '响应结构',
    codeLabelResponseEmpty: '示例：无匹配（仍为 200）',
    codeLabelExample: '示例',
    copyHostedScriptButton: '复制嵌入脚本',
    copyHostedScriptToast: '已复制嵌入脚本。',
    copyHostedScriptError: '无法复制，请手动选择代码复制。',
    copyCodeButton: '复制',
    copyCodeToast: '代码已复制。',
    copyCodeError: '无法复制，请手动选择代码复制。',
    checklistTitle: '上线前检查',
    checklistBody:
      '• 勿将 X-Embed-Key 或 Bearer 打入公开前端包。\n• 使用 D 时：已在 API 集成说明页创建/启用 Bearer；已在 Messaging → 设置 → AI 同步目录/以图能力；处理 200 且 products 为空。\n• 使用 F 时：同一 Bearer；从店铺服务端调用；处理 JSON 中的 `code`。\n• 在真实店铺域名下测试 CORS（路径 B）。\n• 处理 400 / 401 / 403 / 404 / 429 / 503（文件、密钥、店铺设置等）。',
    shopIdentifierLabel: '聊天店铺标识 (slug)',
    hostedAutoFilledNote:
      '在上方选择店铺后：下方公开链接与嵌入脚本已自动填入该店铺，直接「复制嵌入脚本」粘贴到网站即可，无需手动替换 slug。',
    noWorkspaceTitle: '还没有消息店铺',
    noWorkspaceBody:
      '请先在 Messaging 中创建工作区。完成后回到本页，在列表中选择店铺并复制代码 — 系统会自动填入正确的标识。',
    noWorkspaceCta: '创建工作区 — Messaging 设置',
  },
  ja: {
    title: '開発者向け実装ガイド',
    hostedTitle: 'A — NanoAI 上のチャット（iframe / リンク）',
    hostedBody:
      '購入者は NanoAI 上で Google ログイン（ファーストパーティ cookie）。スレッドは NanoAI の「マイチャット」と同期。ダッシュボード → API 連携ガイド（/dashboard/api-integration、ホスト型チャット）で公開 URL と iframe をコピー。iframe 埋め込み時は ?embed=1 を付与するとレイアウトが最適化されます。公開パスの例:',
    embedWidgetSettingsTitle: 'フローティング埋め込み設定',
    embedWidgetSettingsBody:
      '左右位置・下端・左右オフセットはモバイル/デスクトップのフローティングボタンに適用。幅・高さはデスクトップのチャット枠のみ。下のスクリプトは自動更新されます。',
    embedPositionLabel: '表示位置',
    embedPositionRight: '右',
    embedPositionLeft: '左',
    embedBottomOffsetLabel: '下端オフセット (px)',
    embedHorizontalOffsetLabel: '左右オフセット (px)',
    embedDesktopWidthLabel: 'デスクトップ幅 (px)',
    embedDesktopHeightLabel: 'デスクトップ高さ (px)',
    embedBorderRadiusLabel: '角丸 (px)',
    embedTitle: 'B — 店舗ドメイン上の匿名チャット API（CORS）',
    embedBody: '店舗サイトのブラウザから呼び出し。Access-Control-Allow-Origin: *。Bearer は使いません。',
    embedSessionUuid:
      'X-Session-Id は有効な RFC 4122 UUID（バージョン 1–5）で、ブラウザごとに固定（localStorage 推奨）。',
    embedHeadersLabel:
      'すべての GET/POST に X-Embed-Key（ダッシュボード → API 連携ガイドでコピー）と、上で述べた X-Session-Id を付けます。',
    embedGetDesc: 'GET — このセッションのメッセージ履歴を取得（同一 slug・キー・session）。',
    embedPostDesc:
      'POST — メッセージ送信。Content-Type: application/json。body に text および/または imageStoragePath（アップロードで返るパス）。visionPickRequired が返る場合あり。',
    embedUploadDesc: 'POST …/image — multipart/form-data、フィールド file。レスポンスの path を imageStoragePath に使用。',
    embedVisionPickDesc:
      'POST …/vision-pick — JSON { messageId, inventoryId }（visionPickRequired 時）。X-Embed-Key / X-Session-Id は同じ。',
    guestTitle: 'C — ホストページ /messaging/p/…（NanoAI ログイン済み）',
    guestBody:
      '同一オリジン＋セッション cookie で GET/POST /api/messaging/guest/{slug}（JSON は B と同型）。画像: POST /api/messaging/guest/{slug}/image、multipart file。自前ウィジェットは通常 B のみ。C は公式ホストページ用。',
    guestVisionPickNote:
      'Vision 商品選択（POST が visionPickRequired を返したとき）: POST …/vision-pick、ホストページでは cookie。同一ルートは高度な連携向けに X-Embed-Key + X-Session-Id も受け付けます。',
    imageSearchTitle: 'D — 公開商品検索 API（画像・テキスト / ベクター）',
    imageSearchBody:
      '店舗バックエンドのみ。同一キー。Messaging → 設定 → AI。画像: multipart `…/image-search`。テキスト: 下記（埋め込み→ANN）。JSON: ok, products, error。',
    imageSearchPrereq:
      '前提: 在庫データ（Open Catalog 等）と AI 側 index 同期。URL の {partnerId} は店舗の UUID。上で店舗を選ぶと下の URL 例に自動挿入されます。',
    imageSearchResponseEdgeCases:
      '各 products の product_url / score / price_hint / sku は null の場合あり。color_image_urls は常に配列（空可）— 在庫の詳細・色用画像 URL。200 で products 空＋error 有り得る — 空配列を必ず扱うこと。',
    imageSearchHttpErrors:
      '多くは { "error" }: 400/401/403/404/415/429/500/503（画像·テキスト·Content-Type 等）。',
    imageSearchRateLimit: 'IP + 店舗ごとにレート制限（429, Retry-After）。ブラウザ直叩きは避け、キャッシュを検討。',
    textSearchVectorBody:
      'テキスト（ベクター）: `POST` `…/text-search`、Content-Type: application/json または `q`/`limit` フォーム。`{ "q": "…" }` 最低 2 文字。`GOOGLE_API_KEY` とテキスト埋め込み同期が必要。',
    inventoryOpenTitle: 'F — Open Catalog: 在庫同期（マーケットプレイス風 / Shopee 風 JSON）',
    inventoryOpenBody:
      '**店舗バックエンド**からのみ（Bearer を露出しない）。D と**同じ API キー**（`image_search_api_enabled`）。Vision **不要**。`Content-Type: application/json`。body は `items` 配列（1 リクエスト最大 500）。各要素に `item_sku`（または `sku`）、`item_name`（または `name`）；任意で `description`、`stock_note`、`price` / `price_hint`、`image`: { `image_url_list` } または `image_url`、`item_url` / `product_url`、`consult_note`、`sort_order`、`item_status`（`NORMAL`＝表示、`UNLIST` / `DELETED` / `INACTIVE`＝非表示）。行の突き合わせは Excel インポートと同じ（SKU 優先、なければ名前）。',
    inventoryOpenRateLimit:
      'IP + 店舗ごとに制限（429）。任意: PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_*、未設定時は IMAGE_SEARCH_RATE_LIMIT_* を使用。',
    tryOnTitle: 'E — B2B バーチャル試着 API',
    tryOnBody:
      'POST multipart: userImage 必須。衣装画像は garmentImage0… または garmentCount + garmentImage{i}。任意: imageQuality, gender, customPrompt。Authorization: Bearer <生秘密>。クレジットは契約に沿って課金ユーザーへ。',
    snippetNote: 'curl / JSON の例は英語表記で統一しています。',
    codeLabelExampleServer: '例（店舗バックエンド）',
    codeLabelResponseShape: 'レスポンスの形',
    codeLabelResponseEmpty: '例: 0 件 (HTTP 200)',
    codeLabelExample: '例',
    copyHostedScriptButton: '埋め込みスクリプトをコピー',
    copyHostedScriptToast: 'スクリプトをコピーしました。',
    copyHostedScriptError: 'コピーできませんでした。コードを選択して手動でコピーしてください。',
    copyCodeButton: 'コピー',
    copyCodeToast: 'コードをコピーしました。',
    copyCodeError: 'コピーできませんでした。コードを選択して手動でコピーしてください。',
    checklistTitle: '本番前チェックリスト',
    checklistBody:
      '• X-Embed-Key / Bearer を公開 JS に含めない。\n• D: API 連携で Bearer を作成・有効化し、Messaging → 設定 → AI で同期。200 で products が空のケースも処理。\n• F: 同じ Bearer、店舗サーバーから、エラーは JSON `code`。\n• 実ドメインで CORS（B）。\n• 400 / 401 / 403 / 404 / 429 / 503 をユーザー向けに。',
    shopIdentifierLabel: 'チャット店舗 ID（slug）',
    hostedAutoFilledNote:
      '上で店舗を選ぶと、下の公開 URL と埋め込みスクリプトがその店舗用に自動入力されます。「埋め込みスクリプトをコピー」してサイトに貼るだけで、slug の手入力は不要です。',
    noWorkspaceTitle: 'メッセージ店舗がまだありません',
    noWorkspaceBody:
      '先に Messaging でワークスペースを作成してください。作成後にこのページに戻り、リストから店舗を選んでコードをコピーします — 正しい slug が自動で入ります。',
    noWorkspaceCta: 'ワークスペースを作成 — Messaging 設定',
  },
  ko: {
    title: '개발자 구현 가이드',
    hostedTitle: 'A — NanoAI에서 채팅(iframe / 링크)',
    hostedBody:
      '고객이 NanoAI 페이지에서 Google 로그인(퍼스트파티 쿠키). 스레드는 NanoAI「내 채팅」과 동기화. 대시보드 → API 연동 안내(/dashboard/api-integration, 호스팅 채팅)에서 공개 URL과 iframe을 복사합니다. iframe 임베드 시 ?embed=1을 붙이면 레이아웃이 최적화됩니다. 공개 경로 예:',
    embedWidgetSettingsTitle: '플로팅 임베드 설정',
    embedWidgetSettingsBody:
      '좌/우·하단·좌우 간격은 모바일·데스크톱 플로팅 버튼에 적용됩니다. 너비/높이는 데스크톱 채팅 패널만 해당. 아래 스크립트는 자동 갱신됩니다.',
    embedPositionLabel: '위치',
    embedPositionRight: '오른쪽',
    embedPositionLeft: '왼쪽',
    embedBottomOffsetLabel: '하단 간격 (px)',
    embedHorizontalOffsetLabel: '좌/우 간격 (px)',
    embedDesktopWidthLabel: '데스크톱 너비 (px)',
    embedDesktopHeightLabel: '데스크톱 높이 (px)',
    embedBorderRadiusLabel: '모서리 둥글기 (px)',
    embedTitle: 'B — 매장 도메인 익명 채팅 API(CORS)',
    embedBody: '매장 사이트 브라우저에서 호출. Access-Control-Allow-Origin: *. Bearer 없음.',
    embedSessionUuid:
      'X-Session-Id는 유효한 RFC 4122 UUID(버전 1–5)이며 브라우저마다 고정(localStorage 권장).',
    embedHeadersLabel:
      '모든 GET/POST에 X-Embed-Key(대시보드 → API 연동 안내에서 복사)와 위 규칙에 맞는 X-Session-Id를 함께 보냅니다.',
    embedGetDesc: 'GET — 해당 세션 메시지 기록(slug·키·session 동일).',
    embedPostDesc:
      'POST — 메시지 전송. Content-Type: application/json. body에 text 및/또는 imageStoragePath(업로드 응답 path). visionPickRequired 응답 가능.',
    embedUploadDesc: 'POST …/image — multipart, 필드 file. 응답 path를 imageStoragePath로 사용.',
    embedVisionPickDesc:
      'POST …/vision-pick — JSON { messageId, inventoryId }(visionPickRequired 시). X-Embed-Key, X-Session-Id 동일.',
    guestTitle: 'C — 호스팅 페이지 /messaging/p/…(NanoAI 로그인)',
    guestBody:
      '동일 출처 + 세션 쿠키로 GET/POST /api/messaging/guest/{slug}(JSON은 B와 동일). 이미지: POST /api/messaging/guest/{slug}/image, multipart file. 자체 위젯은 보통 B만 사용. C는 공식 호스팅 채팅용.',
    guestVisionPickNote:
      'Vision 선택(POST가 visionPickRequired 반환 시): POST …/vision-pick, 호스팅 페이지는 쿠키. 동일 경로는 고급 교차 출처 흐름에서 X-Embed-Key + X-Session-Id도 허용합니다.',
    imageSearchTitle: 'D — 공개 상품 검색 API(이미지·텍스트/벡터)',
    imageSearchBody:
      '매장 백엔드 전용, 동일 키. Messaging → 설정 → AI. 이미지: multipart `…/image-search`. 텍스트: 아래(임베딩·ANN). JSON: ok, products, error.',
    imageSearchPrereq:
      '전제: 재고/카탤로그 데이터 및(필요 시) AI 인덱스 동기화. URL의 {partnerId}는 매장 UUID — 위에서 매장 선택 시 아래 예시 URL이 자동 반영.',
    imageSearchResponseEdgeCases:
      'product_url, score, price_hint, sku 는 null일 수 있음. color_image_urls 는 항상 배열(빈 배열 가능) — 카탤로그의 세부/색상 이미지 URL. 200 + 빈 products + error 가능 — 빈 배열 UI 처리.',
    imageSearchHttpErrors:
      '보통 { "error" }: 400/401/403/404/415/429/500/503 등.',
    imageSearchRateLimit: 'IP + 매장별 속도 제한(429, Retry-After). 브라우저 직접 호출 지양, 캐시 권장.',
    textSearchVectorBody:
      '텍스트(벡터): `POST` `…/text-search`, JSON `{ "q": "…" }` 또는 form. 최소 2자, limit 1~50, 기본 24. `GOOGLE_API_KEY` 및 텍스트 임베딩 동기화.',
    inventoryOpenTitle: 'F — Open Catalog: 재고 동기화(마켓플레이스형 / Shopee 스타일 JSON)',
    inventoryOpenBody:
      '**매장 백엔드**에서만 호출(Bearer 노출 금지). D와 **동일 키** 및 `image_search_api_enabled`. Vision **불필요**. `Content-Type: application/json`. body: `items` 배열(요청당 최대 500). 항목마다 `item_sku`(또는 `sku`), `item_name`(또는 `name`); 선택 `description`, `stock_note`, `price` / `price_hint`, `image`: { `image_url_list` } 또는 `image_url`, `item_url` / `product_url`, `consult_note`, `sort_order`, `item_status`(`NORMAL` 표시, `UNLIST`/`DELETED`/`INACTIVE` 숨김). 행 매칭은 Excel 가져오기와 동일(SKU 우선, 없으면 이름).',
    inventoryOpenRateLimit:
      'IP + 매장별 제한(429). 선택 환경변수 PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_*; 미설정 시 IMAGE_SEARCH_RATE_LIMIT_* 사용.',
    tryOnTitle: 'E — B2B 가상 피팅 API',
    tryOnBody:
      'POST multipart: userImage 필수. 의류 garmentImage0… 또는 garmentCount + garmentImage{i}. 선택: imageQuality, gender, customPrompt. Authorization: Bearer <평문 비밀>. 크레딧은 계약된 결제 계정에서 차감.',
    snippetNote: 'curl / JSON 예시는 팀 간 통일을 위해 영어로 표기합니다.',
    codeLabelExampleServer: '예시(매장 백엔드)',
    codeLabelResponseShape: '응답 형태',
    codeLabelResponseEmpty: '예: 0건 (HTTP 200)',
    codeLabelExample: '예시',
    copyHostedScriptButton: '임베드 스크립트 복사',
    copyHostedScriptToast: '임베드 스크립트를 복사했습니다.',
    copyHostedScriptError: '복사에 실패했습니다. 코드를 직접 선택해 복사하세요.',
    copyCodeButton: '복사',
    copyCodeToast: '코드를 복사했습니다.',
    copyCodeError: '복사에 실패했습니다. 코드를 직접 선택해 복사하세요.',
    checklistTitle: '프로덕션 체크리스트',
    checklistBody:
      '• X-Embed-Key / Bearer를 공개 프론트 번들에 넣지 않기.\n• D: Bearer 생성·활성화, Messaging → 설정 → AI 동기화, 200 + 빈 products 처리.\n• F: 동일 Bearer, 매장 서버, 오류 JSON `code`.\n• 실제 도메인 CORS(B).\n• 400 / 401 / 403 / 404 / 429 / 503 사용자 메시지.',
    shopIdentifierLabel: '채팅 매장 ID(slug)',
    hostedAutoFilledNote:
      '위에서 매장을 선택하면 아래 공개 URL과 임베드 스크립트가 해당 매장으로 채워집니다. «임베드 스크립트 복사» 후 사이트에 붙여 넣으면 되며 slug를 수동으로 바꿀 필요가 없습니다.',
    noWorkspaceTitle: '메시징 워크스페이스가 없습니다',
    noWorkspaceBody:
      '먼저 Messaging에서 워크스페이스를 만든 뒤 이 페이지로 돌아와 목록에서 매장을 선택하고 코드를 복사하세요 — 올바른 slug가 자동으로 들어갑니다.',
    noWorkspaceCta: '워크스페이스 만들기 — Messaging 설정',
  },
}
