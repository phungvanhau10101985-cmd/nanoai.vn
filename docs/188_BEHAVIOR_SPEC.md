# Đặc tả hành vi chi tiết — 188.com.vn → NanoAI Web (Thu-do-online)

Tài liệu con của [`PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md`](./PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md). File này mô tả **chính xác từng bước hành vi** của 188 (đọc code trực tiếp) để implement tương đương cho NanoAI web — **không copy mù quáng**: mỗi mục có ghi chú "→ Áp dụng cho NanoAI web" nêu rõ chỗ nào giữ nguyên logic, chỗ nào phải tổng quát hoá cho multi-tenant/đa ngôn ngữ, và chỗ nào **cố ý không copy** vì đó là lỗi/hạn chế của 188.

**Cách dùng:** khi làm 1 ID trong checklist chính (`W4.*`, `W5.*`, `M.*`, `W1.4`, `W1.5`, `S0.3`, `S0.4`), mở đúng mục tương ứng ở đây để lấy spec hành vi chi tiết trước khi code.

---

## A. Danh mục sản phẩm (`W4.*`)

### A.1 Data model 188 (tham chiếu, không copy nguyên schema)

`categories` — cây tự tham chiếu 3 cấp:

```
id, external_id (unique, dùng cho upsert import),
parent_id (FK self, ON DELETE SET NULL),
level (1/2/3, không có check constraint DB),
name, slug, full_slug (unique, "l1/l2/l3"),
description, image, size_guide_image_url,
sort_order, is_active, seo_index,
seo_cluster_id (FK → seo_clusters),
created_at, updated_at
```

⚠️ **Phát hiện quan trọng — KHÔNG copy:** 188 có **2 nguồn dữ liệu category song song**:
1. Cây "product-derived" (suy ra từ field text trên sản phẩm) — dùng cho navigation, `/danh-muc`, SEO thực tế.
2. Bảng `categories` (taxonomy-v2) — chỉ dùng cho FK/SEO cluster/mapping, **không phải nguồn** mà storefront/nav thực sự đọc.

Hệ quả lỗi ở 188: category `is_active=false` trong bảng taxonomy **không ẩn được** category khỏi storefront (vì storefront đọc từ tree suy ra từ sản phẩm, không đọc `is_active`). Category con có cha `is_active=false` bị "mồ côi" và biến mất khỏi `/tree-v2` một cách âm thầm.

**→ Áp dụng cho NanoAI web:** dùng **một nguồn duy nhất** — bảng `partner_shop_categories` (đã định nghĩa ở `W4.1`) là nguồn thật cho cả admin, storefront, nav, SEO. Không suy category từ text sản phẩm. `is_active=false` phải ẩn category **và toàn bộ con cháu** khỏi mọi nơi hiển thị (nav, route, sitemap) — kiểm tra ancestor chain khi query, không chỉ lọc từng row rời rạc.

### A.2 API cây danh mục — hành vi chính xác

188 có nhiều endpoint cho cùng mục đích (dư thừa, không copy hết):
- `GET /categories/from-products` — cây dùng cho nav thực tế, cache in-process, lỗi transient trả `503 Retry-After:5`, lỗi khác trả `[]` (im lặng) để không sập SSR.
- `GET /categories/from-products/catalog-tiles?limit=120` — tile L2/L3 cho trang `/danh-muc` rỗng, cache TTL ≥60s.
- `GET /categories/from-products/by-path?level1&level2&level3` — resolve path → `{level, name, full_name, breadcrumb_names, product_count}`, 404 nếu không khớp.
- `GET /categories/from-products/seo-data` — thêm `images` (tối đa 4, ưu tiên ảnh lưu sẵn, fallback ảnh sản phẩm rating cao), `seo_description`, `seo_body` — **không generate AI lúc request**, chỉ đọc field đã lưu sẵn.
- `GET /tree-v2` — cây từ bảng `categories`, sort `level ASC, sort_order ASC, id ASC`, cache 60s.

**→ Áp dụng cho NanoAI web:** gộp thành **một** endpoint per-tenant `GET /api/site/{slug}/categories/tree` trả cây đầy đủ (không tách "product-derived" vs "taxonomy"), cache theo `partner_id` (Redis/in-memory TTL ~60s, invalidate khi admin CRUD). Endpoint resolve path: `GET /api/site/{slug}/categories/resolve?path=a/b/c` trả `{category, breadcrumb: [...], productCount}`. SEO data (images/description/body) là field lưu sẵn trên category, không generate lúc render — nhưng **cho phép merchant bấm nút "AI viết mô tả SEO"** ở admin (tách biệt khỏi request công khai).

### A.3 Mega-menu / Navigation — hành vi chính xác

1. Load cây: ưu tiên `initialCategoryTree` từ server layout → nếu không có, đọc cache trình duyệt → nếu cache rỗng/hỏng, fetch client. Cache cũ hiển thị ngay, refresh nền.
2. Thanh L1: pills cuộn ngang, mỗi pill có link riêng (click text = điều hướng) và nút chevron riêng (click chevron = mở/đóng mega-menu, không điều hướng).
3. Hover vào pill (desktop) mở mega-menu ngay dưới đúng vị trí pill, rộng 280–720px.
4. Trong mega-menu: L2 là card lưới responsive (2/3/4/5 cột theo màn hình), L3 là link nhỏ lồng trong card L2.
5. Rời khỏi panel → đóng. Click ngoài → đóng tất cả.
6. Dropdown "Danh mục" riêng (2 cột: trái là danh sách L1 cuộn, phải là L2/L3 của L1 đang hover) — mở bằng hover/click, đóng trễ 150ms khi rời hover để không giật khi di chuột vào panel.
7. **Không có UI mobile riêng biệt** (không phải drawer/accordion) — cùng 1 component, chỉ khác cách tương tác (tap thay hover).
8. Prefetch link khi hover/focus.

**→ Áp dụng cho NanoAI web:** giữ nguyên cơ chế hover-mega-menu + dropdown "Danh mục" cho desktop (đã chứng minh UX tốt), nhưng **phải làm thêm UI mobile riêng** (drawer/accordion thật) vì 188 cũng thiếu — không copy khiếm khuyết này. Toàn bộ label/route sinh từ cây category của **shop cụ thể**, không hardcode nhãn.

### A.4 Trang danh mục `/danh-muc/[...slug]` (→ NanoAI: `/site/{slug}/c/{...path}`)

**Resolve path:**
- 0 segment → trang catalog tile (xem A.6).
- 1–3 segment → resolve qua API path; nếu không khớp → hiển thị "Danh mục không tồn tại" **trong trang** (không phải HTTP 404 route) kèm link về home.
- ⚠️ Nếu segment cuối có SEO-cluster mapping → redirect ngay sang `/c/{cluster}`, **bỏ qua toàn bộ query string hiện tại**. Đây là hành vi 188-specific (chống trùng lặp nội dung khi nhiều category trỏ cùng 1 cluster nội dung) — **NanoAI web không cần cơ chế cluster này** trừ khi sau này có yêu cầu multi-category → 1 trang SEO chung.

**Query sản phẩm:**
```
GET /products/?limit=96&skip=(page-1)*96&is_active=true
  &category=<L1 name>&subcategory=<L2>&sub_subcategory=<L3>
  &sort=<random|newest|oldest|views_desc>
  [&min_price&max_price&size&color&style_tag]
```
- **Page size cố định 96**, phân trang kiểu số trang (không load-more/infinite-scroll).
- ⚠️ **Sort mặc định = random** (không phải mới nhất!) khi không có filter nào. Ngay khi có bất kỳ filter (giá/size/màu/sort) → chuyển sang deterministic, không `sort` thì fallback `newest`.
- Random giữ seed `r` trong URL, chỉ giữ khi phân trang **không kèm filter khác**.

**Danh mục có con vs lá:** 188 **không hiển thị tile danh mục con** khi vào 1 category có con — nó hiển thị thẳng sản phẩm của toàn bộ nhánh con gộp lại. Việc khám phá danh mục con chỉ có ở nav và trang catalog gốc.

**→ Áp dụng cho NanoAI web (W4.14+ — UX/cấu trúc khớp 188, không copy lỗi):**
- **Phân trang số** + page size 48 (cùng kiểu 188, payload nhẹ hơn 96 cho SaaS đa shop).
- Sort UI giống 188: **Ngẫu nhiên / Mới nhất / Cũ nhất / Xem nhiều** (+ giá tăng/giảm). Mặc định **mới nhất** — không random mặc định. Query `sort` + `page` + `min_price`/`max_price`/`size`/`color` trên URL.
- **Gộp SP cả nhánh con** (L1 hiện hàng L2/L3) — khớp 188 listing.
- **Vẫn hiện tile danh mục con** trước lưới (cải hơn 188).
- Mega menu «Danh mục» **2 cột L1 | L2/L3**, đóng trễ 150ms — HTML + React cùng engine.
- Hub `/c` (tương đương `/danh-muc` bare) — tile L1 + L2/L3.
- Bỏ SEO-cluster-redirect. Tôn trọng `seo_index`. Canonical whitelist gồm cả facet đang lọc.

### A.5 SEO danh mục — quy tắc canonical chính xác

- Canonical trang gốc: `{SITE_URL}/danh-muc/{path-segments-thô}` — dùng **segment thô từ URL**, không phải slug đã chuẩn hoá từ DB.
- Canonical trang có filter: **chỉ đưa vào 6 tham số** `color, max_price, min_price, page, size, sort` theo đúng thứ tự alphabet, bỏ `page=1`, bỏ mọi tham số khác kể cả `r` (random seed).
- ⚠️ **Bug 188 không nên copy:** `style_tag` ảnh hưởng sản phẩm hiển thị nhưng **không** được đưa vào canonical/title — nghĩa là 2 URL nội dung khác nhau nhưng canonical giống nhau → có thể gây lẫn lộn Google Search Console.
- JSON-LD (BreadcrumbList + CollectionPage) luôn dùng **URL gốc chưa lọc**, kể cả khi trang đang có filter/phân trang.
- Category không resolve được → `noindex, follow`, không canonical.
- Toàn bộ category resolve được đều index (kể cả L3) — **không tự động noindex theo cấp**, khác với comment "L3 thường noindex" trong data — layout thực tế bỏ qua field `seo_index` của category.

**→ Áp dụng cho NanoAI web:**
- Copy đúng: dùng whitelist tham số cố định cho canonical filter (`min_price, max_price, sort, page` — bỏ facet theo ngành như size/color khỏi canonical để tránh explosion trang trùng nội dung do quá nhiều biến thể).
- **Sửa bug**: nếu có facet đặc thù ngành (vd `size` cho fashion) ảnh hưởng nội dung hiển thị, phải đưa vào canonical nhất quán — không bỏ sót như 188.
- **Tôn trọng `category.seo_index`** thật sự (field `W4.1` đã có) — cho phép merchant tự đặt category nào noindex, không hardcode index toàn bộ như 188.
- JSON-LD dùng URL gốc chưa lọc — giữ nguyên quy tắc này, hợp lý.

### A.6 Trang catalog gốc `/danh-muc` (bare, không path)

1. SSR fetch tối đa 120 tile (L2/L3 only, không có tile L1).
2. Nếu tile rỗng → fallback dựng tile từ cây (không có ảnh/đếm sản phẩm).
3. Lưới: mobile 2 cột, desktop 5 cột, cuộn dọc thủ công trong khung chiều cao cố định.
4. Mỗi tile: ảnh (fallback gradient nếu không có ảnh) + badge đếm sản phẩm (chỉ hiện nếu >0) + tên.
5. Trạng thái rỗng: "Chưa có danh mục để hiển thị." — trạng thái lỗi: panel lỗi + nút thử lại.

**→ Áp dụng cho NanoAI web:** giữ nguyên ý tưởng lưới tile L2/L3 khám phá nhanh, nhưng **thêm cả tile L1** làm điểm vào đầu tiên (188 bỏ qua L1 ở đây, gây khó điều hướng cho shop có nhiều L1). Responsive tương tự (2 cột mobile / nhiều cột desktop) nhưng để CSS grid tự nhiên thay vì chiều cao khung cố định cuộn thủ công (188 làm vậy vì lý do UI riêng, không cần thiết cho mọi ngành).

### A.7 Bộ lọc danh mục (`CategoryProductFilters`)

- Hiện filter bar khi: có sản phẩm HOẶC URL có tham số non-page.
- Facet load riêng qua `GET /products/listing-facets` (không phải endpoint category-facets khác đang tồn tại song song — dư thừa, 188 dùng nhầm endpoint).
- Chọn size/màu/style/sort → `router.push` ngay (không cần nút Áp dụng), luôn xoá `page` về 1.
- Giá chỉ áp dụng khi blur input hoặc Enter (tránh gọi API liên tục khi gõ).
- Validate ngược từ facet trả về: bỏ chọn nếu giá trị đã chọn không còn nằm trong facet hiện tại (vd đổi category thì size cũ không hợp lệ).
- "Xóa bộ lọc" → về path gốc, xoá sạch query.

**→ Áp dụng cho NanoAI web:** giữ toàn bộ hành vi UX này — rất hợp lý (debounce giá bằng blur/Enter, auto reset page, validate ngược). Chỉ khác: **facet theo ngành qua adapter** (không hardcode size/color/style — dùng danh sách facet do industry capability cung cấp, đã note ở `W4.11`), dùng **một** endpoint facet duy nhất (sửa lỗi trùng lặp endpoint của 188).

### A.8 Admin quản lý danh mục (188 `/admin/taxonomy` → `M`/`W4.4`)

Hành vi thật của 188 (nhiều hạn chế cần **KHÔNG** copy):
- Tạo thủ công: bắt buộc tạo **trọn nhánh L1→L2→L3** cùng lúc + gắn SEO cluster bắt buộc cho L3. Không có form sửa/xoá/kích hoạt lại 1 category đã tồn tại ngoài import Excel.
- Import Excel 4 sheet (`categories`, `category_paths`, `seo_clusters`, `meta`) là cách chính để tạo/sửa hàng loạt — **additive/upsert-only**, không xoá record bị thiếu trong file mới.
- **Không có kéo-thả sắp xếp** — chỉ có field `sort_order` nhập tay qua Excel hoặc form tạo nhánh mới.
- Gán sản phẩm vào category **không phải** thao tác CRUD trực tiếp — nó xảy ra ngầm lúc import sản phẩm (khớp theo `full_slug` → slug → tên hiển thị) hoặc qua công cụ "quét sai lệch + AI đề xuất phân loại lại" (DeepSeek-assisted), áp từng sản phẩm một, có dry-run.

**→ Áp dụng cho NanoAI web — làm TỐT HƠN 188 ở đây (đây là điểm yếu rõ rệt của 188):**
- Cho phép **CRUD từng category độc lập** (tạo 1 node bất kỳ ở bất kỳ cấp, sửa, xoá, kích hoạt/tắt) — không bắt buộc tạo trọn nhánh.
- **Kéo-thả sắp xếp thật** trong dashboard (cập nhật `sort_order` qua UI, không cần Excel).
- **Gán sản phẩm vào category là thao tác CRUD trực tiếp** trong admin (chọn category cho từng SP + gán hàng loạt) — không phụ thuộc AI reclassify hay import Excel.
- SEO cluster: bỏ khái niệm này (đặc thù chống trùng SEO của 188 với catalog khổng lồ) — mỗi category chỉ cần SEO field riêng của nó (`W4.6`, `W4.12`).
- Vẫn giữ ý tưởng "quét sai lệch + AI đề xuất" như tính năng **bổ sung** (không bắt buộc), hữu ích khi shop có nhiều sản phẩm chưa phân loại.

---

## B. Trang tài khoản khách hàng (`W5.*`)

### B.1 Layout & auth guard

- Chờ `isAuthReady` → nếu chưa đăng nhập, redirect `/auth/login?redirect=<path hiện tại>`, render `null` trong lúc chờ.
- Mỗi lần đổi route trong `/account/*` → gọi lại `GET /auth/me` để refresh quyền (đặc biệt cờ admin liên kết).
- Desktop: sidebar cố định trái, active state = **so khớp path chính xác** (không match theo prefix).
- Mobile: **không có sidebar** — mỗi trang con tự vẽ UI riêng; có banner admin riêng nếu có quyền.

**→ Áp dụng cho NanoAI web:** giữ nguyên nguyên tắc (auth guard trước khi render, active state theo path chính xác), nhưng bắt buộc có **route riêng thật** cho mỗi mục (`W5.6`) thay vì tab ẩn hiện tại. Guest session hiện tại của shop (`usePartnerSiteGuestSession`) đóng vai trò auth — giữ nguyên cơ chế, chỉ đổi cấu trúc route.

### B.2 Trang tổng quan + shortcut trạng thái đơn (`W5.3`)

Hành vi chính xác 188:
1. Load đồng thời: `GET /orders/?limit=200`, `GET /auth/me`, `GET /promotions/welcome`.
2. **Đếm badge hoàn toàn tính ở client** trên tối đa 200 đơn tải về (không phải endpoint đếm riêng theo trạng thái):
   - `all`: tất cả
   - `waiting_deposit`: đúng status này
   - `waiting_receive`: gộp `deposit_paid + confirmed + processing + shipping`
   - `delivered`: đúng status
   - `completed`: đúng status (nghĩa là "đã đánh giá", không phải "đã hoàn tất giao hàng")
3. Click shortcut → điều hướng `/account/orders?tab=<key>` (trừ "Tất cả" → không có `tab`).
4. Badge "Ví quà" = đếm số voucher `eligible === true` từ `/promotions/welcome`.

**→ Áp dụng cho NanoAI web:** copy đúng mô hình **đếm client-side** trên 1 lần fetch (đơn giản, đủ dùng khi số đơn không quá lớn) — nhưng đặt **giới hạn theo cấu hình** (không hardcode `limit=200`), và cân nhắc chuyển sang đếm server-side (aggregate query) nếu shop có nhiều đơn để tránh tải dữ liệu thừa. Tên trạng thái gộp (`waiting_receive` = nhiều status con) là ý hay để đơn giản hoá UI cho khách — giữ nguyên cách gộp này, nhưng đặt tên rõ nghĩa hơn (vd `processing_group`) và tổng quát cho mọi ngành (không chỉ fashion).

### B.3 Order status machine — chính xác từng bước

```
(checkout)
  ├─ cần cọc  → waiting_deposit
  └─ không cần cọc → confirmed

waiting_deposit
  ├─ cọc 30% xác nhận → deposit_paid
  └─ cọc 100% xác nhận → confirmed

confirmed → processing → shipping   (admin cập nhật thủ công theo tiến độ)

shipping → delivered
  (chỉ khi timeline vận đơn cho phép khách xác nhận VÀ khách bấm "Đã nhận hàng")

delivered → completed
  (khi khách gửi đánh giá — nhưng "completed" là 1 field/status riêng ở backend/admin,
   không tự động set chỉ vì submit review ở trang danh sách)

cancelled: terminal — BE cho phép huỷ từ mọi trạng thái TRỪ delivered/completed/returned;
           UI khách chỉ lộ nút huỷ ở waiting_deposit.

returned: shop xác nhận đơn bị trả về (chỉ hiện trong filter danh sách, không nằm trong shortcut trang tổng quan)
```

Actions theo trạng thái:
- `waiting_deposit`: nút Thanh toán cọc + Huỷ đơn (lý do optional, mặc định "Khách hàng hủy").
- `deposit_paid/confirmed/processing/shipping/delivered/completed`: nút Theo dõi vận đơn.
- Xác nhận đã nhận: chỉ hiện khi BE trả `can_confirm_received=true` (yêu cầu đúng chủ đơn + status `shipping` + shipment ở trạng thái `awaiting_confirm`) — mở modal xác nhận pháp lý trước khi gọi API.
- Đánh giá: chỉ hiện ở `delivered`/`completed`; đơn 1 sản phẩm mở modal inline, đơn nhiều sản phẩm điều hướng sang trang review riêng.

**→ Áp dụng cho NanoAI web:** đây là state machine tốt, đáng copy gần như nguyên vẹn — rõ ràng, đủ chặt (điều kiện `can_confirm_received` phía server, không tin client). Điều chỉnh: **`requires_deposit` là field theo shop** (không phải mọi shop đều có cọc — nhiều ngành bán lẻ thường không cần), nên khi tắt cọc thì bỏ qua nhánh `waiting_deposit/deposit_paid` hoàn toàn — đơn đi thẳng `confirmed → processing → shipping → delivered → completed`.

### B.4 Đổi mật khẩu — ⚠️ 188 THỰC RA CHƯA LÀM

Phát hiện quan trọng: `/account/change-password` **không tồn tại implementation** ở 188 — link trong sidebar dẫn tới route không có trang thật; bản mobile chỉ hiện toast "Tính năng đang phát triển."

**→ Áp dụng cho NanoAI web (`W5.1`):** đây là chỗ NanoAI web nên **làm đầy đủ, không copy khoảng trống này**. Flow tối thiểu: xác thực OTP/email hiện có (vì guest-session không có mật khẩu truyền thống) hoặc nếu có tài khoản email/password thật thì yêu cầu nhập mật khẩu cũ + mật khẩu mới + xác nhận, invalidat session khác sau khi đổi.

### B.5 Trung tâm thông báo (`W5.2`)

- Fetch 1 lần `GET /notifications/?skip=0&limit=100` — **không phân trang UI** (chỉ 100 đầu).
- Server tự xoá thông báo hết hạn (`expires_at`) mỗi lần đọc danh sách.
- Click thông báo chưa đọc → gọi `PUT /notifications/{id}/read` ngay, cập nhật local.
- Nút "Đánh dấu tất cả đã đọc" chỉ hiện khi có ít nhất 1 unread → `PUT /notifications/read-all`.
- Loại thông báo không lọc/hiển thị riêng theo type (dù có `system/order/promotion/affiliate`).

**→ Áp dụng cho NanoAI web:** copy hành vi tương tác (click=đọc ngay, mark-all khi có unread), nhưng **thêm phân trang/load-more thật** (188 giới hạn cứng 100 là thiếu sót) và **hiển thị icon/nhóm theo type** để khách dễ quét. Nguồn thông báo tối thiểu ban đầu: cập nhật đơn hàng (đổi status), trả lời Q&A, có review mới từ merchant.

### B.6 Ví quà / Voucher wallet (`W5.4`) — xem chi tiết đầy đủ ở mục D

### B.7 Cài đặt app / PWA (`W5.5`)

- Phát hiện đã cài qua `display-mode: standalone` hoặc `navigator.standalone` (iOS).
- Android/Chrome: bắt sự kiện `beforeinstallprompt`, chặn prompt mặc định, lưu lại; bấm nút mới gọi `prompt()` thật + đợi `userChoice`. Nếu trình duyệt không bắn event này (Safari desktop, Firefox…) → hiển thị hướng dẫn thủ công qua menu trình duyệt.
- iOS: không có `beforeinstallprompt` — luôn hướng dẫn Share → "Thêm vào MH chính", ghi chú push notification cần iOS 16.4+ và mở từ icon home.

**→ Áp dụng cho NanoAI web:** copy nguyên hành vi này — đây là cách chuẩn xử lý PWA install đa nền tảng, không có gì đặc thù 188 cần chỉnh. Chỉ cần thay tên app/logo theo từng shop (manifest.json động theo tenant).

### B.8 Sản phẩm đã xem / Yêu thích

- Đã xem: `GET /user-behavior/products/viewed?limit=24`, không xoá được, không phân trang. Ghi nhận: trang sản phẩm gom sự kiện xem, gửi batch sau 2.5s (giảm số request). Hoạt động cả cho khách chưa đăng nhập (session guest), gộp vào tài khoản sau khi login.
- Yêu thích: `GET /user-behavior/products/favorites` (mặc định tối đa 50, không phân trang UI). Toggle tim ở PDP gọi `POST/DELETE` tương ứng ngay lập tức (optimistic sau khi API thành công, không phải optimistic trước).

**→ Áp dụng cho NanoAI web:** Thu-do-online đã có "recently viewed"/"favorites" tương tự trong shop hiện tại — giữ pattern batch-flush 2.5s cho view event (giảm tải ghi DB) và cơ chế merge guest→account sau login. Nên **thêm phân trang thật** thay vì giới hạn cứng.

---

## C. Đánh giá & Hỏi đáp sản phẩm (`W1.5`, `M1.2`, `M1.3`)

### C.1 Review — hành vi chính xác + các lỗ hổng KHÔNG nên copy

Điều kiện được review: đăng nhập + có **đơn hàng chứa đúng sản phẩm đó ở trạng thái `delivered` hoặc `completed`**.

Submit:
```json
POST /product-reviews/submit
{ "product_id": 123, "star": 1-5, "title"?: "...", "content": "bắt buộc", "images"?: ["url"] }
```
- Sao ngoài 1-5 bị clamp về khoảng hợp lệ.
- Title rỗng → tự sinh 1 trong 5 mẫu theo số sao.
- Sau khi review thành công → đơn liên quan chuyển `completed`.

⚠️ **Lỗ hổng 188 — không copy:**
1. **Không tính rating trung bình/histogram từ review thật** — hiển thị `rating_point/rating_total` là field import sẵn, tách biệt hoàn toàn khỏi review thực tế. Nghĩa là hiển thị "4.8 sao (1200 đánh giá)" nhưng số đó **không đến từ** các review khách viết.
2. **Ảnh review có lưu trong DB nhưng KHÔNG hiển thị ở UI công khai** — chỉ admin xem được trong preview.
3. **Không giới hạn 1 review/khách/sản phẩm ở backend** — chỉ chặn ở UI (ẩn nút nếu đã review), có thể lách qua API.
4. Không có sắp xếp/lọc do khách chọn — thứ tự cố định: review của chính khách đang xem → review thật → review import → theo lượt hữu ích → theo ngày.

**→ Áp dụng cho NanoAI web (làm đúng, không copy lỗi):**
- **Tính rating trung bình + histogram thật** từ bảng review (COUNT/AVG theo group by star) — hiển thị đúng số liệu thực, không dùng field ảo.
- **Hiển thị ảnh review thật** trên PDP/danh mục — đây là yếu tố trust quan trọng cho `W1.5`/`L1.3`.
- **Enforce unique (product_id, user_id) ở backend**, không chỉ ẩn UI.
- Giữ nguyên: điều kiện phải mua hàng thật mới được review (verified purchase tự nhiên, không cần badge riêng vì 100% review là verified) — **đây là điểm hay của 188**, nên giữ.
- Vote hữu ích: giữ cơ chế toggle unique `(review_id, user_id)`, tăng/giảm `useful`, sàn 0.
- Merchant reply: hiển thị nếu có `reply_content`, tên mặc định = tên shop nếu admin không nhập tên riêng.

### C.2 Q&A — hành vi chính xác

- Hỏi: chỉ cần đăng nhập (**không cần mua hàng**) — hiện công khai ngay, không có trạng thái duyệt.
- Trả lời: **tối đa 2 khách mua hàng** được trả lời công khai (2 "slot" cố định) + 1 câu trả lời admin riêng biệt hiển thị song song. Điều kiện trả lời của khách: đăng nhập + có đơn hàng (không huỷ) chứa sản phẩm đó.
- Badge "verified" cho câu trả lời của khách nếu slot đó có `user_id`.
- Thông báo email khi có trả lời mới (trừ chính người trả lời), debounce trả lời admin 2 phút để gộp nhiều chỉnh sửa liên tiếp thành 1 email.

**→ Áp dụng cho NanoAI web:** giữ nguyên ý tưởng "khách mua hàng khác được trả lời, giới hạn số lượng" — tạo tính xác thực xã hội, đơn giản để implement (không cần workflow duyệt phức tạp). Có thể tổng quát số slot buyer-reply thành 1 config thay vì hardcode 2. Không bắt buộc phải mua hàng mới được **hỏi** (giữ nguyên — hạ rào cản để có nhiều câu hỏi hơn, tăng nội dung SEO tự nhiên cho trang sản phẩm).

### C.3 Admin duyệt/quản lý (`M1.2`, `M1.3`)

- Không có trạng thái "chờ duyệt" — chỉ có `is_active` bật/tắt (ẩn khỏi công khai).
- **Inline auto-save** sau ~0.7s khi merchant sửa trực tiếp trong bảng (không cần nút Lưu riêng) — cho mọi field kể cả nội dung/sao/trả lời.
- Review: phân trang 10/dòng, lọc theo nhóm rating; có xoá từng dòng + xoá tất cả (bulk).
- Q&A: phân trang 10/dòng, lọc theo nhóm; chỉ xoá từng dòng (không có xoá hàng loạt); admin có thể trả lời/sửa trả lời buyer trực tiếp mà không bị ràng buộc điều kiện "phải có đơn hàng" như khách thường.

**→ Áp dụng cho NanoAI web:** copy đúng mô hình **inline auto-save debounce** — trải nghiệm quản lý nhanh, phù hợp cho merchant không rành kỹ thuật. Nên **thêm trạng thái pending/approved thật** thay vì chỉ ẩn/hiện nếu sau này cần kiểm duyệt trước khi hiện công khai (188 không có, nhưng NanoAI web có thể cấu hình theo shop: "tự động hiện" hoặc "cần duyệt trước").

---

## D. Khuyến mãi / Voucher / Ví quà (`W1.4`, `M2.2`, `W5.4`)

### D.1 Loại voucher 188 hỗ trợ (chỉ 1 loại — hạn chế cần vượt qua)

Field: `code, name, description, discount_percent, max_discount_amount, first_order_only, stack_with_birthday, stack_with_loyalty, is_active, valid_from, valid_to, usage_limit?, per_user_limit, eligible_within_days?, requires_wallet_grant, grant_valid_days?, auto_grant_trigger`.

⚠️ **Hạn chế 188 — nên vượt qua ở NanoAI web:**
- **Chỉ có giảm theo %** (không có giảm số tiền cố định, không có free-ship voucher, không target theo sản phẩm/category cụ thể).
- **Không có endpoint tự nhập mã để redeem** — voucher chỉ vào ví qua auto-grant hệ thống hoặc admin gán tay, khách không tự "áp mã" một mã bất kỳ họ có.
- `stack_with_birthday`/`stack_with_loyalty` là field tồn tại trên DB nhưng **logic runtime không thực sự stack** — birthday/voucher loại trừ lẫn nhau, loyalty luôn tính riêng. Config bị treo, gây hiểu nhầm khi đọc code.

**→ Áp dụng cho NanoAI web (`W1.4`):**
- Hỗ trợ **cả 2 loại**: giảm % (có cap tối đa) và giảm số tiền cố định. Free-ship là 1 loại policy riêng (ngưỡng đơn tối thiểu).
- Cho phép **target theo category/sản phẩm cụ thể** (liên kết `W4.*` — ví dụ voucher chỉ áp cho 1 danh mục).
- **Có endpoint tự nhập mã redeem công khai** (ngoài auto-grant), vì đây là cách phổ biến merchant chạy campaign quảng cáo ("Nhập mã ABC giảm 10%").
- Field stacking phải **thực sự phản ánh đúng logic runtime** — không để field DB nói dối hành vi thật.

### D.2 Validate & áp dụng tại checkout — hành vi chính xác (đáng copy)

```json
POST /promotions/validate
{ "code": "WELCOME188", "subtotal": 500000 }
→ 200: { valid:true, code, discount_percent, max_discount_amount, estimated_discount, message }
→ 400: mã không hợp lệ/hết hiệu lực/chưa tới ngày/hết hạn/chưa có wallet-grant/đã dùng/không phải đơn đầu/vượt giới hạn dùng theo user hoặc global
```

Flow đầy đủ:
1. Cart tải voucher trong ví: `GET /promotions/my-vouchers?subtotal=<tổng tiền hàng thường>`.
2. Khách chọn voucher đủ điều kiện → FE gọi `/promotions/validate` để lấy số tiền giảm ước tính hiển thị ngay.
3. FE **chỉ giữ** `code + percent + cap` trong state — không tự tính tiền giảm cuối cùng để hiển thị "chốt".
4. Submit đơn hàng kèm `promo_code` — **backend tính lại toàn bộ từ đầu**, không tin số FE gửi.
5. Sau khi tạo đơn thành công: đánh dấu grant `used`, ghi `PromotionUsage(promotion_id, user_id, order_id, grant_id, discount_amount)`.
6. Voucher **chỉ áp dụng cho hàng thường**, loại trừ hàng thanh lý/giảm giá sẵn (tránh chồng giảm giá kép).
7. Free-ship là ngưỡng độc lập theo tổng đơn (≥500k), không đi qua hệ voucher.

**→ Áp dụng cho NanoAI web:** copy đúng nguyên tắc **"backend luôn tính lại, không tin client"** — đây là nguyên tắc bảo mật quan trọng nhất trong toàn bộ hệ voucher, bắt buộc giữ. Giữ nguyên chuỗi field ghi nhận sử dụng (`PromotionUsage` tương đương) để sau này làm báo cáo hiệu quả voucher (`S0.8`).

### D.3 Auto-grant vào ví — baseline bắt buộc của Sale Parity

| Trigger | Mã mẫu | Mức | Hạn dùng |
|---|---|---|---|
| Đăng ký tài khoản | WELCOME | 10%, cap X | 7 ngày |
| Đơn đầu tiên giao thành công | THANKYOU | 5%, cap X | 14 ngày |
| Khách cũ quay lại (không mua lâu) | COMEBACK | 10%, cap X | 5 ngày |
| Bỏ giỏ hàng | CARTSAVE | 5%, cap X | 3 ngày |

**→ Áp dụng cho NanoAI web:** seed đúng mức/hạn 188 cho mọi shop và vẫn cho merchant sửa cấu hình theo `M2.2`. Tên mã/copy lấy brand tenant, không hardcode chữ `188`.

### D.4 Ví quà hiển thị (`PromotionWalletPanel` → `W5.4`)

- Field hiển thị mỗi voucher: nguồn gốc (signup/first-order/comeback/admin-gift/...), mới hay không, đủ điều kiện dùng hay không (+ lý do nếu không), tên/mô tả, %/cap, mã cá nhân (copy được), hạn dùng.
- CTA "đủ điều kiện" chỉ **điều hướng sang giỏ hàng** — không tự áp voucher ngay tại trang ví.

**→ Áp dụng cho NanoAI web:** giữ nguyên cách trình bày (rất rõ ràng, đủ thông tin quyết định) — chỉ cải thiện: cho phép **copy mã và tự áp trực tiếp** nếu muốn dùng ở nơi khác (landing/app khác), không chỉ điều hướng giỏ hàng.

### D.5 Contract Sale Parity 188 áp cho mọi tenant

- Sale ngày trùng tháng: ngày `min(tháng, ngày cuối tháng)`, tháng lẻ 6%, tháng chẵn 8%, teaser T-3..T-1 và active theo timezone shop.
- Sinh nhật: 10% trong T-7..T0; email đúng T-7 và unique theo partner + khách + năm sinh nhật.
- Auto-grant: welcome 10%/cap 200k/7 ngày; first delivered 5%/cap 100k/14 ngày; comeback 10%/cap 100k/5 ngày; cart abandon 5%/cap 80k/3 ngày.
- Cart abandon: idle 24 giờ, cooldown 7 ngày. Comeback: 30 ngày không mua, cooldown 30 ngày. Cart abandon thắng comeback.
- Voucher XOR sinh nhật; loyalty tính trên phần còn lại. Tổng site sale/Google + voucher hoặc sinh nhật + loyalty không vượt 15% giá list.
- Hàng clearance chỉ dùng giá clearance, không nhận voucher/sinh nhật/loyalty. Shipping tính sau giảm.
- Google Automated Discount khóa giá 48 giờ. Affiliate và mọi grant/usage chạy idempotent theo tenant/order.

---

## E. Tracking / Pixel / CAPI / Nhúng mã (`S0.3`, `S0.4`, `M3.1`)

### E.1 Nguyên tắc dedupe Pixel ↔ CAPI (bắt buộc copy — đây là chuẩn kỹ thuật đúng)

- Mỗi sự kiện sinh **1 `event_id`**, dùng chung cho cả bắn pixel trình duyệt (`fbq('track', name, data, {eventID})`) và gửi CAPI (`event_id` trong payload). Meta tự dedupe 2 nguồn nhờ trùng ID.
- Hầu hết event: `"{eventName}_{uuid random}"`.
- ⚠️ **Purchase dùng ID ổn định theo đơn**: `Purchase_{orderId}` — để nếu cả browser lẫn server (sau xác nhận cọc) cùng gửi Purchase cho 1 đơn, Meta vẫn dedupe đúng dù 2 lần gửi tách biệt về thời điểm.
- Server **không có bảng "đã gửi chưa"** nội bộ — hoàn toàn dựa vào Meta tự dedupe theo `event_id`. Nghĩa là gọi trùng lịch trình vẫn an toàn (không tạo double count) nhưng tốn quota gọi API.

**→ Áp dụng cho NanoAI web (`S0.3`):** copy chính xác pattern này. Áp dụng cho **mọi platform có CAPI-like** (Meta, TikTok Events API nếu dùng): `event_id = "{EventName}_{orderId}"` cho Purchase, UUID ngẫu nhiên cho các event khác. Cân nhắc **thêm bảng outbox nội bộ** (idempotency log) để tránh gọi lại không cần thiết — cải thiện so với 188 (giảm tải API call, dễ debug/audit).

### E.2 Bảng sự kiện theo bước mua hàng (chuẩn tối thiểu phải có)

| Bước | Meta | TikTok | Google Ads/GA4 |
|---|---|---|---|
| Xem trang | `PageView` (chỉ pixel, không CAPI) | `ttq.page()` | `page_view` + `ecomm_pagetype` |
| Xem SP (PDP) | `ViewContent` (pixel+CAPI) | `ViewContent` | `view_item` |
| Thêm giỏ | `AddToCart` (pixel+CAPI) | `AddToCart` | `add_to_cart` |
| Bắt đầu thanh toán | *(188 bỏ qua ở Meta!)* | `InitiateCheckout` | `begin_checkout` |
| Đơn cần cọc | custom `OrderAwaitingDeposit` | `PlaceAnOrder` | — |
| Đơn COD hoàn tất | `Purchase` | `CompletePayment` | `purchase` |
| Cọc được xác nhận | `Purchase` (server-side, sau webhook/admin) | — | — |

⚠️ **Thiếu sót 188 — nên bổ sung:** Meta **không bắn `InitiateCheckout`** khi khách vào trang giỏ hàng đã đăng nhập — đây là 1 event chuẩn ecommerce bị bỏ sót, ảnh hưởng chất lượng tối ưu quảng cáo Meta.

**→ Áp dụng cho NanoAI web:** implement đủ **5 event chuẩn Meta**: ViewContent, AddToCart, InitiateCheckout (bổ sung, đừng copy thiếu sót này), Purchase, và Lead (cho form). Payload sản phẩm giữ cấu trúc `content_ids/contents[{id,quantity,item_price}]` — đây là chuẩn Meta, không đổi.

### E.3 CAPI proxy — luồng chính xác (kiến trúc đáng copy)

```
Browser → POST /api/facebook-capi (Next.js route, secret nội bộ)
  → điền event_source_url/event_time/action_source nếu thiếu
  → điền fbp/fbc từ cookie
  → Next route thêm client_ip_address (x-forwarded-for) + client_user_agent
  → forward → Backend (kiểm bearer secret khớp)
     → validate độ dài field
     → POST tới Graph API Meta thật (timeout 30s, không retry)
  ← trả nguyên trạng thái/response về browser
```
- Thiếu secret ở production → `503`. Ở dev → `204` (không chặn phát triển).
- Browser tự retry fetch 1 lần (ViewContent 2 lần), sau đó fallback `navigator.sendBeacon` nếu vẫn lỗi (đảm bảo gửi được khi rời trang).

**→ Áp dụng cho NanoAI web:** copy kiến trúc proxy 2 lớp này (browser → app route nội bộ → backend → Meta) — lý do: giữ access token/secret Meta **không lộ ra client**, tách biệt theo từng shop (`pixel_id` + `access_token` theo `partner_id`, không phải 1 cặp global như 188 vì multi-tenant). Thêm `sendBeacon` fallback khi rời trang — quan trọng để không mất event Purchase khi khách đóng tab ngay sau khi mua.

### E.4 Server-side Purchase sau xác nhận cọc — điều kiện chính xác

Trigger khi: webhook thanh toán tự động xác nhận, HOẶC admin đổi status `waiting_deposit → deposit_paid/confirmed`, HOẶC admin xác nhận cọc thủ công.

Điều kiện gửi:
- Đơn có yêu cầu cọc.
- Status thuộc nhóm đã xác nhận trở lên (`deposit_paid...completed`).
- Số tiền cọc > 0.
- Đơn có ít nhất 1 sản phẩm với ID hợp lệ.

Payload có `user_data.em`/`ph` là **SHA-256 của email/SĐT đã chuẩn hoá** (SĐT chuẩn hoá về định dạng quốc gia trước khi hash) — đây là bước bắt buộc theo chuẩn Meta CAPI để khớp định danh người dùng nâng cao (Advanced Matching).

**→ Áp dụng cho NanoAI web:** copy chính xác: **luôn hash SHA-256** email/SĐT trước khi gửi CAPI, không gửi plaintext. Trigger tương tự (sau xác nhận thanh toán/cọc) nhưng viết thành **1 hàm dùng chung** gọi được từ mọi luồng thanh toán (webhook, admin thủ công, COD ngay khi tạo đơn) — 188 tách rời COD (chỉ browser) và cọc (server) hơi thiếu nhất quán; NanoAI web nên **luôn có bản server-side cho mọi phương thức thanh toán**, không chỉ riêng cọc.

### E.5 Hệ thống nhúng mã admin (`M3.1`) — mô hình đáng copy

Nguyên tắc: **merchant chỉ nhập ID** (không phải paste cả đoạn script) cho các platform đã biết:
- `GA4`: nhập `G-XXXX` → hệ thống tự sinh script chuẩn.
- `GTM`: nhập `GTM-XXXX` → tự sinh bootstrap + noscript iframe.
- `Google Ads`: chỉ nhận đúng định dạng `AW-\d+`.
- `Meta Pixel`: chỉ cần Pixel ID số → tự sinh fbq bootstrap.
- `TikTok Pixel`: chỉ cần Pixel ID.
- Trường hợp cần **HTML tự do** (nhúng widget lạ, mã nhà cung cấp khác): cho phép bật "chế độ HTML đầy đủ" — nhưng validate/parse lại thành DOM node thật (không `dangerouslySetInnerHTML` thô) để script con bên trong thực sự chạy được.
- Vị trí chèn chuẩn hoá còn 3 loại: `head`, `body_open`, `body_close`.
- Giao hàng công khai: cache 60–120s, injection ở client bằng `useLayoutEffect` (trước khi các effect khác chạy) để đảm bảo tracking function đã tồn tại kịp lúc các trang con gọi.
- Phát sự kiện `"embeds-ready"` sau khi chèn xong — các hàm tracking khác (fire event ViewContent...) nên **đợi sự kiện này** (hoặc poll tối đa ~20s) trước khi gọi `fbq`/`ttq`/`gtag`, tránh lỗi "function not defined" do race condition.

**→ Áp dụng cho NanoAI web (`M3.1`, `S0.4`):** copy toàn bộ mô hình này — chuẩn hoá "chỉ nhập ID" là trải nghiệm merchant tốt nhất (không cần biết code). Bắt buộc thêm so với 188: **secret/token (Meta CAPI token, v.v.) phải theo từng `partner_id`** (188 dùng 1 bộ global vì single-tenant). Thêm bước **sanitize HTML tự do nghiêm ngặt hơn** (whitelist tag/attribute) vì đây là input do merchant thứ ba nhập vào hệ thống multi-tenant — rủi ro XSS cao hơn hẳn so với 1 admin duy nhất tin cậy như 188.

### E.6 Contract ID sản phẩm xuyên suốt các nền tảng (bắt buộc copy nguyên tắc)

188 dùng **đúng 1 giá trị** (`product.product_id`) làm định danh xuyên suốt: Meta `content_ids`, TikTok `content_id`, Google `item_id`/`ecomm_prodid`, và cột `id` trong feed Merchant Center TSV. Nhờ vậy tag sự kiện và feed sản phẩm luôn khớp nhau để chạy remarketing động.

**→ Áp dụng cho NanoAI web:** bắt buộc chọn **1 định danh duy nhất** (khuyến nghị: `inventory.id` hiện có) và dùng thống nhất cho: sự kiện pixel/CAPI, feed Merchant Center (khi làm), data attribute `data-nanoai-inventory` đã có trên landing. Sai lệch định danh giữa các nơi là nguyên nhân phổ biến khiến remarketing động không hoạt động — đây là lỗi âm thầm, khó phát hiện nếu không kiểm tra kỹ từ đầu.

---

## Tổng hợp: những gì KHÔNG nên copy từ 188 (danh sách nhanh)

| # | Vấn đề ở 188 | Quyết định cho NanoAI web |
|---|---|---|
| 1 | 2 nguồn category song song (product-derived vs taxonomy) gây `is_active` không ăn khớp | Một nguồn duy nhất, `is_active` ẩn cả cây con |
| 2 | Sort mặc định = random trên trang danh mục | Mặc định = mới nhất, random là tuỳ chọn |
| 3 | Không hiện tile danh mục con khi vào category có con | Hiện tile con trước khi liệt kê sản phẩm |
| 4 | `style_tag` ảnh hưởng nội dung nhưng không vào canonical | Mọi facet ảnh hưởng nội dung đều phải nhất quán trong canonical |
| 5 | Category `seo_index` bị bỏ qua ở tầng render | Tôn trọng field này thật sự |
| 6 | Admin category bắt buộc tạo trọn nhánh, không CRUD từng node, không kéo-thả | CRUD từng node độc lập + kéo-thả sắp xếp thật |
| 7 | Gán sản phẩm↔category không phải thao tác trực tiếp | CRUD gán trực tiếp trong admin |
| 8 | `/account/change-password` chưa implement (link chết) | Làm đầy đủ |
| 9 | Giới hạn cứng 100/200/24/50 item không phân trang ở nhiều màn account | Phân trang thật |
| 10 | Rating trung bình hiển thị không đến từ review thật | Tính thật từ dữ liệu review |
| 11 | Ảnh review có lưu nhưng không hiển thị công khai | Hiển thị ảnh review |
| 12 | Không enforce 1 review/user/product ở backend | Enforce unique constraint thật |
| 13 | Voucher chỉ có %, không có số tiền cố định/target category, không tự nhập mã redeem | Hỗ trợ đủ loại + redeem công khai |
| 14 | Field `stack_with_*` tồn tại nhưng logic không dùng đúng như tên | Logic phải khớp đúng field cấu hình |
| 15 | Thiếu `InitiateCheckout` cho Meta ở trang giỏ hàng | Bắn đủ 5 event chuẩn |
| 16 | 1 bộ secret/pixel global (chấp nhận được vì single-tenant) | Theo từng `partner_id` (bắt buộc vì multi-tenant) |
| 17 | HTML nhúng tự do không sanitize nghiêm | Sanitize chặt hơn vì nhiều merchant khác nhau nhập vào |

---

## Liên kết ngược tới checklist chính

| Mục ở đây | ID trong checklist chính |
|---|---|
| A. Danh mục | `W4.1`–`W4.13` |
| B. Tài khoản khách hàng | `W5.1`–`W5.8` |
| C. Review & Q&A | `W1.5`, `M1.2`, `M1.3` |
| D. Khuyến mãi/Voucher | `W1.4`, `M2.2`, `W5.4` |
| E. Tracking/CAPI/Nhúng mã | `S0.3`, `S0.4`, `M3.1` |
