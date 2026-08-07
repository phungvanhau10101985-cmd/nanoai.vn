# Nâng cấp «Tạo web & landing» cho khách — theo mẫu 188.com.vn

Tài liệu sống (living checklist). **Nguồn sự thật** khi phân tích / triển khai sản phẩm tạo website cho khách.

Sản phẩm dashboard: **Tạo web & landing** = **hai phần bắt buộc cùng một sản phẩm**:

1. **Tạo web chính** — một shop site (catalog, PDP, giỏ, chat…)
2. **Tạo landing** — nhiều trang chiến dịch gắn sản phẩm (sau khi đã có web chính)

- **Mẫu tham chiếu:** `E:\python-code\188-com-vn` (storefront bán hàng hoàn chỉnh — đọc UX/chuyển đổi/SEO/tracking; **không** copy kiến trúc monobrand).
- **UI copy:** `src/lib/i18n/partner-website-copy.ts` (`pageTitle: Tạo web & landing`).
- **Cập nhật lần cuối:** 2026-08-05
- **Cách dùng mỗi phiên:** xem [Cách dùng tài liệu này](#cách-dùng-tài-liệu-này).

> File cũ `docs/PARTNER_LANDING_UPGRADE_188.md` đã gộp vào đây — dùng file này.

> **Đặc tả hành vi chi tiết từng bước** (188 hoạt động chính xác thế nào → NanoAI web nên làm gì, kèm danh sách lỗi/hạn chế của 188 KHÔNG nên copy): xem [`188_BEHAVIOR_SPEC.md`](./188_BEHAVIOR_SPEC.md). Bắt buộc đọc mục tương ứng trước khi code `W4.*`, `W5.*`, `W1.4`, `W1.5`, `M.*`, `S0.3`, `S0.4`.

---

## ⚠️ Mục tiêu: KHÔNG phải clone 100% 188

**188-com-vn là single-tenant, 1 ngôn ngữ (vi), 1 ngành, code tay cố định cho một business cụ thể.**
Thu-do-online là **multi-tenant SaaS**: mỗi khách một site, sinh bằng AI theo template, nhiều ngành (`fashion`/`hospitality`/…), bắt buộc đa ngôn ngữ (vi/en/zh/ja/ko).

→ Copy 100% là **sai mục tiêu và không khả thi**, vì sẽ:

- Phá multi-tenant (hardcode cho 1 kiểu shop/1 business logic của 188)
- Vi phạm rule cách ly ngành (`messaging-industry-architecture`) — không được lấy field/logic đặc thù 1 ngành làm mặc định chung
- Vi phạm rule đa ngôn ngữ (`multilingual-i18n`) — 188 hardcode tiếng Việt + VND
- Sai cơ chế vận hành: 188 code tay từng trang; sản phẩm này **AI sinh web/landing theo brief từng khách**

**Mục tiêu đúng:** đạt **chuẩn chất lượng chuyển đổi/kỹ thuật ngang 188** (UX bán hàng, SEO, tracking, trust…) trong khi vẫn giữ multi-tenant + đa ngôn ngữ + đa ngành + cơ chế AI-generate. 188 chỉ dùng để **tham chiếu hành vi/UX**, không phải nguồn để sao chép code/kiến trúc.

Mỗi ID trong checklist dưới đây đã được viết theo tinh thần "học chuẩn, không clone" — khi triển khai, luôn hỏi: *"Hành vi này áp dụng được cho mọi ngành, mọi ngôn ngữ, mọi tenant không?"* Nếu không, phải tổng quát hoá trước khi làm.

---

## Legend trạng thái

| Ký hiệu | Nghĩa |
|---------|--------|
| ✅ Done | Đã có và dùng được trên luồng chính |
| 🟡 Partial | Có nền tảng / một phần — chưa đủ chuẩn 188 hoặc chưa gắn đủ web+LP |
| ❌ Todo | Chưa có hoặc chưa dùng được cho merchant |
| 🚫 Out of scope | Không làm (ghi rõ lý do) |

Khi xong một hạng mục: đổi ❌/🟡 → ✅, ghi ngày + ghi chú ngắn ở cột **Ghi chú**.

---

## Kiến trúc sản phẩm (đừng trộn phạm vi)

| Phạm vi | ID prefix | Mục đích | Điều kiện | Route / UI | File lõi |
|---------|-----------|----------|-----------|------------|----------|
| **W — Web chính** | `W.*` | Một shop site từ mẫu cố định + chỉnh AI/visual | Workspace messaging | Dashboard website; public `/site/{slug}/…` | `src/lib/partner-website/*`, `src/components/partner-website/*`, `src/app/site/[slug]/` |
| **L — Landing** | `L.*` | Nhiều LP gắn 1–8 SP, AI build HTML | **Bắt buộc có web chính trước** | Panel landings; `/site/{slug}/lp/{landingSlug}` | `src/lib/partner-website/landing/*`, `partner-website-landings-panel.tsx` |
| **S — Shared** | `S.*` | Domain, SEO site-wide, pixel, analytics, chat kênh… | Áp dụng cả W và/hoặc L | Dashboard + storefront | tracking, custom domain, sitemap… |
| **H — Hub Studio** | `H.*` | Mockup/preview Hub (không thay W/L) | Hub chat | `/share/landing/{token}` | `src/lib/hub-chat/landing-*` |

**Quy tắc phiên làm việc**

1. Mỗi phiên chọn **một ID** (`W.x` / `L.x` / `S.x` / `H.x`).
2. Không sửa W khi task là L (và ngược lại), trừ ID `S.*` hoặc task ghi rõ “shared”.
3. Landing **không thay** web chính — copy sản phẩm đã chốt: *web thiết kế một lần; landing tạo nhiều lần*.
4. 188 chỉ là **chuẩn chất lượng bán hàng**, không phải template copy-paste.

```text
[Workspace messaging]
        │
        ▼
[W] Tạo web chính (template → preview → publish)
        │
        ├── catalog / PDP / cart / account / chat / lead
        │
        ▼
[L] Tạo landing (chọn SP → brief → AI build → publish)
        │
        └── /lp/{slug}  (hiện: CTA → PDP web chính)
```

---

## Snapshot hiện trạng

### Web chính (W) — đã có nền tảng mạnh

- ✅ Template presets (universal / fashion / hospitality) + capabilities
- ✅ Publish / preview / revisions / reset 7 ngày
- ✅ Visual editor + AI chat edit trên project home
- ✅ Platform shop: catalog, PDP (variant/gallery/video), cart, guest order, deposit QR
- ✅ Wishlist, recently viewed, related, try-on/consult hooks
- ✅ Lead form + panel leads
- ✅ Custom domain (CNAME, verify DNS, SSL worker)
- ✅ i18n UI vi/en/zh/ja/ko
- ✅ Browser pixels GA4 / Ads / Meta / TikTok trên shop

### ⚠️ Web chính — CHƯA có danh mục sản phẩm thật (gap lớn nhất hiện nay)

- ❌ **Không có data model category/danh mục** cho shop đối tác — bảng inventory chỉ có `partner_id`, không có `category_id`/cây danh mục
- ❌ "Danh mục" ở header/home hiện là **nhãn tĩnh hardcode** (Áo/Túi/Giày/Phụ kiện…) — tất cả đều dẫn về cùng 1 trang `/products` phẳng, không phản ánh tồn kho thật
- ❌ Query `collection` trong API chỉ là `ILIKE` từ khoá lên tên/SKU/mô tả — **không phải** quan hệ danh mục/sản phẩm thật
- ❌ Không có: trang danh mục con, breadcrumb theo cây, mega menu sinh từ dữ liệu thật, lọc theo danh mục, SEO/sitemap theo danh mục, admin CRUD danh mục
- 🟡 Giá hiện là text (`price_hint`) — chưa phải số có cấu trúc → chưa lọc theo khoảng giá được
- So với 188: category 3 cấp (`parent_id`/`level`/`full_slug`), mega menu, filter giá/size/màu, breadcrumb + CollectionPage JSON-LD, admin import/CRUD/reorder — xem nhóm **`W4.*`** bên dưới

### Landing (L) — đã có vòng đời, yếu phần bán hàng trên trang

- ✅ Create / build / preview / publish / unpublish / delete
- ✅ Gắn 1–8 inventory; AI mockup + HTML
- 🟡 CTA mua → modal chọn SP → **PDP** (chưa mua ngay trên LP)
- ❌ Editor sau build, SEO editable, funnel dashboard, offer/urgency trên LP
- ⏸️ **Tạm hoãn** theo quyết định 2026-08-05 — ưu tiên `W4.*` (đa danh mục) trước

### Shared / so với 188 — khoảng trống chung

- 🟡 Tracking/CAPI chưa đủ chuẩn ads + attribution LP
- ❌ Sitemap tenant (site + products + `/lp/*`)
- ❌ Reviews/Q&A/size guide mức 188
- ❌ Dashboard doanh thu / conversion merchant
- 🟡 Chat đa kênh (NanoAI mạnh; Zalo/FB chưa đủ)

---

## Checklist — Web chính (`W.*`)

### W0 — Nền tảng tạo web (baseline)

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| W0.1 | Studio/journal: brand + logo → chọn mẫu → apply template | ✅ Done | `partner-website-creation-journal-panel.tsx`, `shop-template-presets.ts` |
| W0.2 | Capabilities gắn catalog/cart/chat/lead/FAQ theo industry | ✅ Done | `partner-capabilities.ts` |
| W0.3 | Publish / unpublish / preview / revisions / restore / reset OTP | ✅ Done | `partner-website-dashboard-client.tsx` |
| W0.4 | Phân biệt trang template home vs trang platform (PDP/cart…) | ✅ Done | `partner-website-page-catalog.ts` |
| W0.5 | Landing chỉ mở sau khi web chính sẵn sàng | ✅ Done | `lpNeedWebsite`, landings panel |

### W1 — Commerce storefront (chuẩn 188)

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| W1.1 | Catalog + PDP gallery/video + variant màu/size/tồn + qty | ✅ Done | `partner-site-shop-product-client.tsx` |
| W1.2 | Cart + guest checkout + order + tracking cơ bản | ✅ Done | `partner-site-shop-cart-client.tsx`, `api/messaging/guest/[slug]/order` |
| W1.3 | Deposit / QR thanh toán theo policy shop | ✅ Done-MVP (2026-08-06) | Deposit/QR + COD/bank/ewallet (W1.7) trên checkout; khớp hiện trạng shop guest |
| W1.4 | Promo / voucher / giá sale / flash / bundle | ✅ Done-MVP (2026-08-06) | Voucher engine đầy đủ + **flash sale** (`sale_price_amount`/`sale_starts_at`/`sale_ends_at` trên inventory, PDP giá gạch, checkout backend tính lại). **Không làm**: bundle multi-SKU packs |
| W1.5 | Reviews + rating + verified purchase + Q&A + size guide | ✅ Done (2026-08-06) | Reviews/Q&A + size guide PDP: `size_guide_image_url` trên category, modal ảnh cạnh size; fallback `/size-guide` |
| W1.6 | Sticky Buy mobile + gallery swipe/zoom + urgency tồn | ✅ Done (2026-08-06) | Thanh mua nổi cố định đáy màn hình mobile (hiện khi khối nút mua chính cuộn khỏi viewport, dùng `IntersectionObserver`, nằm trên `pw-shop-bottom-nav`); vuốt ngang đổi ảnh + chạm phóng to (lightbox full-screen, double-tap toggle zoom, có nút prev/next + dots) dùng chung logic swipe; cảnh báo "Chỉ còn N sản phẩm" CHỈ hiện khi `1 <= stock_qty <= 5` — **cố ý không hiện/chặn mua khi = 0** vì đây là giá trị mặc định cho shop chưa từng cấu hình tồn kho (khác nếu hiểu nhầm "hết hàng" thật, sẽ chặn nhầm checkout hàng loạt shop khác). Test: `scripts/test-pdp-w1_6-mobile-ux.ts` (2 case: sản phẩm sắp hết hàng hiện đủ badge/sticky/gallery hint, sản phẩm chưa cấu hình tồn kho KHÔNG hiện cảnh báo sai) — pass; re-run W4 Phase5 + W1.5 Phase3 xác nhận không hồi quy JSON-LD/reviews trên PDP |
| W1.7 | Shipping rate / COD / e-wallet / refund / tax | 🟡 Partial (2026-08-06) | Đã có: phí ship cố định + miễn phí theo ngưỡng (merchant cấu hình, cột riêng `shipping_fee_amount` KHÔNG cộng vào `amount_after_discount` — không đổi cơ sở tính cọc/doanh thu/LTV đã dùng cho M2.1/S0.8); phương thức thanh toán rõ ràng cho khách (COD ngầm định khi không cọc / chuyển khoản / **ví điện tử QR thủ công** kiểu Momo-ZaloPay — giống cơ chế SePay QR, không tích hợp API cổng thật); hoàn tiền thủ công (`refund_status/refund_amount/refund_note`, admin đánh dấu + tự thông báo qua chat). **Chưa có**: tax/VAT (chủ động bỏ qua theo yêu cầu — đa số shop nhỏ không xuất VAT riêng), shipping theo khu vực/tỉnh thành (cần đổi địa chỉ text tự do sang có cấu trúc — để phiên sau nếu cần), tích hợp API cổng thanh toán thật (VNPay/Momo Business — cần tài khoản merchant thật) |

### W2 — Chỉnh sửa & mẫu

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| W2.1 | AI chat edit project + visual editor (text/ảnh/section bg) | ✅ Done | `partner-website-chat-panel.tsx`, `partner-website-visual-editor-toolbar.tsx` |
| W2.2 | Quick-edit prompts đa ngành (bớt hardcode fashion) | ✅ Done (2026-08-06) | `getPartnerWebsiteEditSuggestions` — chip theo `industry_key` + capabilities (hotel → CTA đặt chỗ, tắt FAQ nếu off); bỏ hardcode cam/thời trang; wire studio/chat/journal. Test: `scripts/test-w2_2-industry-quick-edits.ts` |
| W2.3 | Merchant edit nav / page tree / footer / theme tokens | ✅ Done-MVP (2026-08-06) | Theme color picker (5 token) + `nav_json`/`footer_json` jsonb (migration `20260806140000_*`); schema link platform `{ id, hrefKey, labelOverride?, visible, sortOrder }`; admin panel bật/tắt + lên/xuống; shell đọc JSON + fallback mặc định; PATCH `update_nav_footer` khoá 409 khi `useVisualHtml`. **Không làm**: free HTML / page-tree CMS đầy đủ |
| W2.4 | Section manager drag-reorder + undo block-level | ✅ Done-MVP (2026-08-06) | Reorder sections + **Hoàn tác thao tác gần nhất** = restore revision mới nhất (`undo_last` + `change_note` rõ trên `reorder_sections`/`update_theme_colors`). **Không làm**: undo block-level / op-stack diff từng block (Out of scope Phase 9) |
| W2.5 | Thư viện mẫu ngành phong phú hơn 3 presets | ✅ Done (2026-08-06) | 6 presets: commerce-blue, fashion-orange, hospitality-stay, **food-warm**, **commerce-minimal**, **soft-neutral**; `suggestedShopTemplatePresetForIndustry` (food → food-warm); capabilities vẫn filter section |
| W2.6 | Đồng bộ brand visual giữa home template và shell PDP/cart | ✅ Done-MVP (2026-08-06) | Shop shell ưu tiên `theme_json` tokens (đặc biệt sau color picker); hết lệch home ↔ shop khi merchant đổi màu qua dashboard |

### W4 — Đa danh mục (⭐ ưu tiên hiện tại — quyết định 2026-08-05)

Mục tiêu: shop đối tác có **cây danh mục thật** (nhiều cấp), menu/mega-menu sinh từ dữ liệu, trang danh mục có lọc/breadcrumb/SEO — chuẩn 188, nhưng **per-tenant** (mỗi shop tự cấu hình danh mục riêng, không hardcode 1 ngành).

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| W4.1 | **Data model danh mục** — bảng `partner_shop_categories` (partner_id, parent_id, slug, path, depth, sort_order, is_active, image, SEO fields, nhãn đa ngôn ngữ) | ✅ Done (2026-08-05) | — | `db/migrations/20260805200000_messaging_partner_categories.sql` (bảng `messaging_partner_categories`), types + slug/path helper: `src/lib/partner-website/category/partner-category-types.ts`, data-access: `src/lib/db/messaging-partner-categories-pg.ts`. Trigger chặn parent khác `partner_id`. Chưa có: update/move/reorder (→ `W4.4`) |
| W4.2 | **Gắn sản phẩm ↔ danh mục** — bảng nối `partner_shop_product_categories` (nhiều-nhiều, có "danh mục chính" để làm breadcrumb/canonical) | ✅ Done (2026-08-05) | W4.1 | Bảng `messaging_partner_inventory_categories` — unique partial index đảm bảo tối đa 1 `is_primary`/sản phẩm; trigger chặn inventory/category khác `partner_id`. Không đổi schema `inventory` hiện có |
| W4.3 | **Tương thích ngược** — shop chưa cấu hình danh mục vẫn chạy `/products` phẳng như cũ, không vỡ site đang publish | ✅ Done (2026-08-05) | W4.1, W4.2 | Xác nhận bằng smoke test `scripts/test-partner-categories-w4.mjs`: 2 bảng mới hoàn toàn additive, `messaging_partner_inventory` không có cột mới, shop chưa tạo category vẫn `hasAnyPartnerCategoriesFromPg=false`. Route `/api/site/[slug]/products` chưa đổi — không đọc bảng category |
| W4.4 | **Admin CRUD danh mục** — tạo/sửa/xoá/sắp xếp lên-xuống/di chuyển cha-con, bật/tắt hiển thị | ✅ Done (2026-08-05) | W4.1 | Panel: `partner-website-categories-panel.tsx` (trong dashboard Website, sau Capabilities, trước Landings). API: `api/messaging/partners/[partnerId]/categories/*`. Data layer: `movePartnerCategoryFromPg` (rebuild path/depth cả hậu duệ + chặn cycle), `reorderPartnerCategorySiblingFromPg`, `deletePartnerCategoryFromPg`. Sắp xếp dùng nút lên/xuống (chưa phải kéo-thả con trỏ thật — có thể nâng cấp UI sau) |
| W4.5 | **Gán sản phẩm vào danh mục** — gán từng SP + gán hàng loạt (bulk) trong dashboard | ✅ Done (2026-08-05) | W4.2, W4.4 | Modal "Gán sản phẩm" trong panel; API `categories/[categoryId]/products` (GET/PUT thay toàn bộ danh sách); `setCategoryProductsFromPg` tự đặt `is_primary=true` nếu SP chưa thuộc danh mục nào khác |
| W4.6 | **Banner/ảnh/SEO field cho từng danh mục** | ✅ Done (2026-08-05) | W4.4 | Có trong form tạo/sửa: `imageUrl`, `description`, `seoTitle`, `seoDescription`, `seoIndex` |
| W4.7 | **Route danh mục công khai** — `/site/{slug}/c/{...path}` (+ tương thích custom domain) | ✅ Done (2026-08-05) | W4.1, W4.3 | `src/app/site/[slug]/c/[...path]/page.tsx`. Path không tồn tại → `notFound()` (404 thật, khác 188 hiện thông báo trong trang) |
| W4.8 | **Mega menu / nav sinh từ cây danh mục thật** — bỏ nhãn hardcode ở header/home | ✅ Done (2026-08-05) | W4.7 | `partner-site-shop-shell.tsx` fetch `GET /api/site/{slug}/categories` (client-side effect); rỗng → fallback 5 nhãn cũ (W4.3, không phá site đang publish) |
| W4.9 | **Trang danh mục**: banner, thẻ danh mục con, breadcrumb, lưới sản phẩm, phân trang | ✅ Done (2026-08-05) | W4.7 | Breadcrumb + banner ảnh + tile danh mục con (luôn hiện trước lưới SP — cố ý khác 188, xem behavior spec A.4) + `PartnerSiteCategoryProductsClient` (load-more, sort=mới nhất mặc định). Sản phẩm hiển thị = gán trực tiếp, **chưa gộp nhánh con** |
| W4.10 | **Giá dạng số có cấu trúc** (amount + currency) thay `price_hint` text | ✅ Done (2026-08-05) | — | Cột `price_amount numeric`/`price_currency` (additive, nullable) — tự tính lại từ `price_hint` mỗi lần tạo/sửa/import (`computePriceAmountForWrite`, reuse `parseVndFromPriceHint`). Dòng cũ giữ `null` tới lần sửa kế tiếp — không backfill hàng loạt |
| W4.11 | **Lọc theo danh mục** — khoảng giá, sort; facet theo ngành qua adapter (fashion: size/màu — không rò rỉ sang ngành khác) | ✅ Done (2026-08-06) | W4.9, W4.10 | Giá/sort + facet fashion `size`/`color` từ options JSON (`partner-shop-industry-facets.ts`); ngành khác không hiện facet |
| W4.12 | **SEO danh mục** — meta/canonical/OG + BreadcrumbList/CollectionPage JSON-LD + tự động sinh nội dung SEO bằng AI | ✅ Done (2026-08-06) | W4.9 | JSON-LD dùng URL gốc chưa lọc (giống 188 mục A.5); title/description ưu tiên `seoTitle`/`seoDescription` merchant đặt; `noIndex` tôn trọng `category.seoIndex`. **2026-08-06**: (1) fix bug title dính `\| NanoAI` + OG image generic + canonical sai domain khi shop dùng custom domain — tách `buildPartnerSiteMetadata()` riêng cho mọi trang `/site/{slug}/*`; (2) thêm tính năng **tự động sinh SEO bằng AI** tương đương `category_seo_meta` của 188: cột `seo_body`/`seo_body_generated_at`/`seo_body_generated_locale`, nút "Tự động sinh bằng AI" trong admin (Gemini, sinh theo locale shop, có mẫu dự phòng khi chưa cấu hình AI), render đoạn văn SEO cuối trang danh mục công khai |
| W4.13 | **Danh mục trong sitemap tenant** | ✅ Done (2026-08-05) | W4.9, S0.5 | Gộp trong `S0.5` — xem route `sitemap.xml` |

### W3 — Trang & nội dung

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| W3.1 | Routes public: home, products, cart, account, orders, addresses, wishlist, sale, FAQ, contact, about, policy… | ✅ Done | `src/app/site/[slug]/` |
| W3.2 | Blog / lookbook / stores / size-guide / thank-you / payment pages trong catalog | ✅ Done (2026-08-06) | Route React + nội dung mặc định 5 ngôn ngữ + CMS override (builtin slug): `/payment`, `/thank-you?order=`, `/stores`, `/lookbook`, `/size-guide`, `/blog` (blog = landing tĩnh — multi-post để sau). Footer + sitemap + checkout redirect thank-you. Test: `scripts/test-w3_2-secondary-pages.ts` |
| W3.3 | Merchant SEO per page (title/desc/OG) cho trang platform | ✅ Done (2026-08-06) | Merchant tự nhập SEO title/description/index qua CMS (`W3.4`) cho cả 8 trang có sẵn lẫn trang tự do |
| W3.4 | CMS nội dung trang tĩnh (about/policy) đa ngôn ngữ theo shop | ✅ Done (2026-08-06) | Bảng `messaging_partner_static_pages` — ghi đè nội dung/SEO 8 trang có sẵn (slug trùng key) HOẶC tạo trang tự do mới tại `/site/{slug}/pages/{slug}`; không có override = fallback y hệt hành vi cũ (100% tương thích ngược). Nội dung 1 ngôn ngữ theo `locale` cố định của chính shop đó (không phải đa ngôn ngữ như UI platform) |

### W5 — Trang tài khoản khách hàng (Customer Account, so với 188 `/account`)

Nguồn đối chiếu: 188 `frontend/app/account/layout.tsx` + `page.tsx` — menu đầy đủ: Tài khoản, Chỉnh sửa hồ sơ, Giỏ hàng, Đơn hàng (+ shortcut trạng thái có badge số), Sản phẩm đã xem, Sổ địa chỉ, Ví Affiliate, Thành viên thân quen, Ví quà/Khuyến mãi, Trung tâm thông báo, Cài đặt app, Tài khoản ngân hàng, Yêu thích, Đổi mật khẩu.

Hiện tại (`partner-site-shop-account-client.tsx`): 1 trang, chuyển tab bằng state — có overview/cart/orders/wishlist/recently-viewed/addresses/edit-profile(chỉ tên+SĐT)/contact. **Chưa có**: đổi mật khẩu, trung tâm thông báo, ví quà/voucher, shortcut trạng thái đơn có badge, cài app, và các mục cần bật theo capability (affiliate, membership).

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| W5.1 | **Đổi mật khẩu / bảo mật tài khoản** | ✅ Done (2026-08-06) | — | Panel Security: email + OTP/Google note + sign-out device (clear guest session) + re-auth; không password |
| W5.2 | **Trung tâm thông báo** — cập nhật đơn hàng, khuyến mãi, tin nhắn shop | ✅ Done (2026-08-06) | — | Migration + PG helpers + `GET/PATCH /api/site/[slug]/notifications`; wire khi đổi status/shipping; UI tab list + mark all |
| W5.3 | **Shortcut trạng thái đơn hàng có badge số lượng** (chờ cọc/chờ nhận/đã nhận/đã đánh giá/đã huỷ) trên tab Đơn hàng | ✅ Done (2026-08-06) | — | Thanh chip cuộn ngang trên tab Đơn hàng; đếm client-side trên danh sách đã tải (giống 188). Map status NanoAI: `waiting_payment` ← `awaiting_payment`/`payment_checking`; `processing` ← đã thanh toán + đang xử lý/giao; `delivered` ← `shipping_status=delivered` chưa review; `reviewed` ← có review gắn `order_id` (`has_review` từ API); `cancelled` ← huỷ. Deep link `#orders?tab=<key>`. Test: `scripts/test-w5_3-order-status-shortcuts.ts` |
| W5.4 | **Ví quà / voucher wallet** cho khách hàng | ✅ Done (2026-08-06) | W1.4 | Tab "Ví quà" trong `/site/{slug}/account`, API `GET /api/site/{slug}/promotions/wallet`. Cải tiến so với 188: cho copy mã trực tiếp (188 chỉ điều hướng giỏ hàng) — xem docs/188_BEHAVIOR_SPEC.md mục D.4 |
| W5.5 | **Cài đặt app (PWA install prompt)** | ✅ Done (2026-08-06) | — | Dynamic `manifest.webmanifest` + minimal `sw.js`; register từ shop shell; tab install-app (beforeinstallprompt + iOS tip) |
| W5.6 | **Tách route riêng mỗi mục tài khoản** (thay vì chỉ đổi tab ẩn trong 1 trang) — hỗ trợ back button, deep link, SEO `noindex` riêng | ✅ Done (2026-08-06) | — | `/account` overview + `/account/[tab]`; hash legacy → router.replace; `partnerSiteAccountTabPath` |
| W5.7 | **Affiliate wallet + tài khoản ngân hàng** — chỉ bật khi shop kích hoạt chương trình affiliate | 🚫 Out of scope (mặc định) | Capability flag | Đặc thù mô hình kinh doanh 188 — **không** làm default cho mọi shop theo rule cách ly ngành; chỉ làm nếu có capability `affiliate_program` |
| W5.8 | **Membership / hạng thành viên thân quen** — chỉ bật khi shop có chương trình loyalty | 🚫 Out of scope (mặc định) | Capability flag | Tương tự W5.7 — capability-gated, không hardcode cho mọi ngành |

> W5.7/W5.8 đánh dấu 🚫 vì đây là **tính năng nghiệp vụ đặc thù của 188** (affiliate + loyalty riêng của họ), không phải chuẩn account tối thiểu. Chỉ triển khai nếu có yêu cầu bật capability tương ứng cho một shop cụ thể — tránh vi phạm rule cách ly ngành (không dùng field đặc thù 1 business làm mặc định chung).

---

## Checklist — Landing (`L.*`)

### L0 — Vòng đời landing (baseline)

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| L0.1 | Create draft: chọn 1–8 SP + title/slug/brief | ✅ Done | landings API + panel |
| L0.2 | Build AI: mockup + HTML/CSS/JS project | ✅ Done | `build-partner-landing-from-products.ts` |
| L0.3 | Preview / publish / unpublish / delete | ✅ Done | `…/landings/[landingId]`, public `lp/[landingSlug]` |
| L0.4 | Giữ web chính không đổi khi tạo/sửa LP | ✅ Done | Product rule đã chốt |

### L1 — Bán hàng trên landing (P0 cũ)

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| L1.1 | **Mua ngay trên LP** — sheet biến thể, Add cart / Buy Now, giữ UTM | ❌ Todo | Hiện `build-landing-buy-script.ts` → modal → PDP. Reuse W1.1/W1.2 |
| L1.2 | Offer / urgency trên LP (giá gạch, coupon, countdown, scarcity) | ❌ Todo | — |
| L1.3 | Trust trên LP (review summary, guarantee, FAQ gần CTA) | 🟡 Partial | AI có thể gen FAQ; thiếu review thật từ data |
| L1.4 | Form chiến dịch trên LP (UTM/product, thank-you, Lead event) | 🟡 Partial | Lead form thuộc web chính; LP chưa campaign-aware |
| L1.5 | Editor sau build (sửa text/ảnh/section, không bắt buộc rebuild) | ❌ Todo | Panel chỉ preview/rebuild/publish/delete |
| L1.6 | Đổi danh sách SP sau create + rebuild từ mockup cũ | ❌ Todo | DB có `inventoryIds`; UI chưa expose |

### L2 — SEO & đo lường riêng LP

| ID | Hạng mục | Trạng thái | Ghi chú / file neo |
|----|----------|------------|-------------------|
| L2.1 | SEO editable per LP (title/desc/OG/canonical + JSON-LD) | ❌ Todo | `lp/[landingSlug]/page.tsx` metadata cơ bản |
| L2.2 | Funnel per LP: view → click → cart → order/lead | ❌ Todo | Phụ thuộc S2.* |
| L2.3 | Share/affiliate link cho LP (`ref`, QR, attribution) | ❌ Todo | 188: `AffiliateShareBar` |

---

## Checklist — Shared (`S.*`) — dùng chung web + landing

| ID | Hạng mục | Trạng thái | Phạm vi | Ghi chú / file neo |
|----|----------|------------|---------|-------------------|
| S0.1 | Custom domain + DNS verify + SSL | ✅ Done-MVP (2026-08-06) | W (+L theo domain) | UX card domain: trạng thái DNS/SSL rõ + refresh/poll SSL + message lỗi DNS cụ thể; canonical/OG/sitemap dùng custom domain khi `ssl_active`. Không viết lại worker SSL |
| S0.2 | Browser pixels GA4 / Ads / Meta / TikTok (PDP/cart/purchase) | ✅ Done | W | `partner-site-shop-tracking.ts`, head snippets |
| S0.3 | Meta CAPI đầy đủ + event_id dedupe + fbp/fbc + retry/log | ✅ Done-MVP (2026-08-06) | W+L | CAPI + event_id dedupe + Advanced Matching + Purchase sau confirm + **outbox retry** (`messaging_partner_meta_capi_outbox`, cron `POST /api/cron/meta-capi-outbox`). **Chưa có**: TikTok Events API server-side (giữ browser `ttq`) |
| S0.4 | GTM container + dataLayer ecommerce | ✅ Done (2026-08-06) | W+L | Cột `gtm_container_id` theo từng partner (additive), merchant tự nhập qua dashboard (M3.1); bootstrap tự sinh script GTM trên trang shop; `window.dataLayer.push()` cho cả 4 event chuẩn (view_item/add_to_cart/begin_checkout/purchase), độc lập với gtag — hoạt động dù chưa cấu hình GTM container |
| S0.5 | Sitemap tenant: home + products + `/lp/*` + canonical domain | ✅ Done-MVP (2026-08-06) | W+L | Tenant sitemap + đăng ký slug published vào `src/app/sitemap.ts`. **Không** `/lp/*` (Landing hoãn) |
| S0.6 | Product JSON-LD (Offer, availability, rating, shipping/return) | ✅ Done (2026-08-06) | W (+L) | Product/Offer/AggregateRating/BreadcrumbList + `OfferShippingDetails` + `MerchantReturnPolicy` nhẹ từ phí ship cố định |
| S0.7 | Chat đa kênh: NanoAI + Zalo + Messenger/IG + phone | ✅ Done (2026-08-06) | W+L | NanoAI + public contact FABs (`contact_phone`/`contact_zalo_url`/`contact_messenger_url`/`contact_instagram_url`) |
| S0.8 | Dashboard merchant: đơn / doanh thu / conversion / UTM | ✅ Done (2026-08-06) | W+L | Trang mới `/dashboard/messaging/analytics` — doanh thu THẬT (đơn `paid_verified`+`delivered`, cùng công thức `amount_after_discount` đã dùng cho M2.1/W1.4), doanh thu theo ngày (biểu đồ recharts), doanh thu theo UTM source/campaign (join qua `visitor_personalization`), top sản phẩm bán chạy. Khách truy cập/tỉ lệ chuyển đổi ghi rõ là ƯỚC TÍNH (không có bảng đếm page-view riêng, dùng `visitor_personalization` làm proxy) |
| S0.9 | Consent / cookie banner gắn pixel ads | ✅ Done (2026-08-06) | W+L | Banner cookie theo từng shop (`localStorage` scoped theo `siteSlug` — tránh share consent nhầm giữa các shop khác nhau trên cùng domain platform); **chặn thật** mọi tracking (GA4/Ads/Meta/TikTok/GTM/CAPI/dataLayer) cho tới khi khách bấm "Đồng ý" — chặn ở cả tầng bootstrap lẫn từng hàm track riêng lẻ (PDP/cart gọi trực tiếp, không chỉ qua bootstrap) |
| S0.10 | Đa tiền tệ / hreflang / catalog dịch theo locale shop | ✅ Done-MVP (2026-08-06) | W | Cột `default_currency` (default VND) trên partners; tracking/GA4/Meta đọc currency từ partner; metadata `hreflang` self-tag theo `site.locale` (1 locale/shop). **Không làm**: FX đa tiền tệ / catalog đa locale URL |

---

## Checklist — Hub Studio (`H.*`) — phụ, không thay W/L

| ID | Hạng mục | Trạng thái | Ghi chú |
|----|----------|------------|---------|
| H.1 | Brief + logo + mockup `landing_full` + share preview 90 ngày | ✅ Done | Hub studio landing_page |
| H.2 | HTML builder/editor gắn UI + share htmlSource | 🟡 Partial | Code có, UI active chưa dùng |
| H.3 | Bridge Hub design → Partner Landing (L) | ❌ Todo | Tuỳ chọn sau L1/L0 ổn định |

---

## Checklist — Quản trị vận hành shop (`M.*`)

Nguồn đối chiếu: sidebar admin 188 (`/admin/*`). Đây là các màn **merchant tự vận hành shop** (không phải build web/landing) — bổ sung cho dashboard `partner-website` hiện tại. Đã lọc bỏ phần đặc thù nghiệp vụ/hạ tầng riêng của 188.

### M0 — Đã có sẵn (không cần làm lại)

| Mục 188 | Tương đương Thu-do-online |
|---------|---------------------------|
| Sản phẩm | ✅ Inventory panel trong `partner-messaging-settings-client.tsx` (`activeSection === 'inventory'`) |
| Quyền nhân viên | ✅ `partner-staff-permissions.ts`, `partnerStaffHasPerm` — bật quyền theo nhóm trong Cài đặt |
| Chat & MXH (một phần) | ✅ NanoAI chat widget; Zalo/Messenger còn thiếu (xem `S0.7`) |

### M1 — Bán hàng & sản phẩm (ưu tiên cao — vận hành cốt lõi)

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| M1.1 | **Dashboard đơn hàng thật** — xem/lọc/đổi trạng thái đơn (không chỉ lead) | ✅ Done (đã có từ trước) | — | Ghi chú cũ trong tài liệu này bị lỗi thời — `/dashboard/messaging/orders` (`partner-messaging-orders-client.tsx`, 1198 dòng) đã có đầy đủ: filter theo trạng thái thanh toán/vận chuyển/ngày, tab vòng đời đơn, đổi trạng thái, xác nhận cọc tay, timeline, export Excel |
| M1.2 | **Admin Hỏi đáp sản phẩm** — merchant trả lời Q&A khách hỏi | ✅ Done (2026-08-05) | W1.5 | `PartnerWebsiteReviewsQaPanel` (tab Hỏi đáp) — ẩn/hiện câu hỏi, trả lời với vai trò shop (tên mặc định = tên shop), xoá từng dòng (không có xoá hàng loạt, đúng hành vi 188) |
| M1.3 | **Admin Đánh giá sản phẩm** — duyệt/ẩn/trả lời review | ✅ Done (2026-08-05) | W1.5 | `PartnerWebsiteReviewsQaPanel` (tab Đánh giá) — inline auto-save debounce 700ms (nội dung/sao ẩn hiện/phản hồi shop), lọc theo rating, xoá từng dòng + xoá tất cả (bulk) |
| M1.4 | **Cấu hình vận chuyển** (carrier/mức phí) | ✅ Done-MVP (2026-08-06) | W1.7 | Phí cố định + ngưỡng miễn phí + nhãn `shipping_carrier_label` (hiển thị cart). **Không** API GHN/GHTK |

### M2 — Khách hàng & thanh toán

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| M2.1 | **Danh sách khách hàng (CRM nhẹ)** — ai đã mua, tổng chi tiêu, lịch sử đơn | ✅ Done (2026-08-05) | — | `PartnerWebsiteCustomersPanel` — gộp theo email chuẩn hoá, tổng chi tiêu CHỈ tính đơn `paid_verified`+`delivered`, search theo tên/SĐT/email, phân trang |
| M2.2 | **Admin khuyến mãi/voucher** — tạo/sửa mã giảm giá, điều kiện áp dụng | ✅ Done (2026-08-05) | W1.4 | `PartnerWebsitePromotionsPanel` — CRUD đầy đủ, bật/tắt nhanh, hiển thị used_count |
| M2.3 | **Cấu hình nạp tiền/QR** — nhập QR/tài khoản nhận cọc | ✅ Done (đã có sẵn, đính chính 2026-08-06) | W1.3 | `partner-messaging-settings-client.tsx` mục "Đơn hàng & thanh toán" — merchant tự nhập ngân hàng/STK/chủ TK, kiểu đặt cọc (%/số tiền cố định/không cọc), bắt buộc ảnh chứng từ, cấu hình đầy đủ SePay (bank code, STK, QR template, webhook token tự sinh, secret key) |
| M2.4 | Thành viên (điểm) / Affiliate & ví | 🚫 Out of scope (mặc định) | Capability flag | = `W5.7`/`W5.8` — chỉ bật theo capability |

### M3 — Website & nhúng

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| M3.1 | **Mã nhúng analytics tự phục vụ** — merchant tự nhập GA4/Meta/TikTok/GTM ID | ✅ Done (2026-08-06) | S0.4 | Đã có đủ 5 provider tự nhập ID trong dashboard settings (GA4, Meta Pixel+CAPI token, Google Ads, TikTok, **GTM mới thêm**). **Chưa có**: chế độ "HTML tự do" cho nhúng widget lạ ngoài 5 provider chuẩn |
| M3.2 | **Nút CTA nổi** (video/khuyến mãi floating button) | ✅ Done (2026-08-06) | — | `theme.floatingCta` `{ enabled, label, href, imageUrl? }`; panel dashboard + 1 FAB trên shop shell (offset không đè chat) |
| M3.3 | **API key & tích hợp bên thứ ba** (webhook ra ngoài, ERP) | ✅ Done-MVP (2026-08-06) | — | Surface outbound webhook + API key đã có (`messaging-partner-outbound-webhooks-pg`) vào dashboard settings. **Không làm**: connector ERP mới |
| M3.4 | **Từ khoá mapping / gợi ý tìm kiếm** | ✅ Done (2026-08-06) | W4.* | Migration `messaging_partner_search_aliases`; admin CRUD; site text search ưu tiên alias trước vector |

### M4 — Khác

| ID | Hạng mục | Trạng thái | Phụ thuộc | Ghi chú / file neo |
|----|----------|------------|-----------|-------------------|
| M4.1 | **Thông báo admin** — đơn mới/khách hỏi/review mới cho merchant | ✅ Done (2026-08-06) | — | `partner-admin-notifications.ts` — dùng chung hạ tầng `deliverUserNotificationPg` (in-app + email + web push) đã có sẵn, gửi cho chủ shop (`owner_user_id`). Chưa mở rộng cho nhân viên theo quyền |
| M4.2 | Email marketing hàng loạt | ℹ️ Xem sáng kiến riêng | — | Đã có `docs/MESSAGING_BULK_MARKETING_SAFE_IMPLEMENTATION.md` — không trùng lặp, không tạo ID mới ở đây |

### 🚫 Out of scope — đặc thù nghiệp vụ/hạ tầng riêng 188 (không làm)

| Mục 188 | Lý do loại |
|---------|-----------|
| Test & thử nghiệm | Công cụ dev nội bộ của 188 |
| Kiểm tra nguồn hàng, Parse HTML Taobao, Import Hibox | Chuỗi cung ứng dropship Trung Quốc riêng của 188 — không áp dụng multi-tenant |
| Cache tìm kiếm / Cache bộ lọc | Vấn đề hạ tầng/performance, xử lý ở tầng platform, không cần UI riêng cho merchant |
| Ảnh Bunny CDN | Cấu hình vendor CDN cụ thể của 188 |
| Backup VPS | Vận hành hạ tầng platform nội bộ, không phải tính năng merchant |

---

## Thứ tự triển khai đề xuất (Roadmap theo Phase)

> **Quyết định 2026-08-05:** tạm hoãn toàn bộ nhóm **Landing (`L.*`)**. Ưu tiên tuyệt đối: **`W4.*` — Đa danh mục** trước, xong mới quay lại nhóm bán hàng khác rồi mới tới Landing.

Nguyên tắc sắp xếp: **(1) giá trị bán hàng trước**, **(2) làm nền trước phần phụ thuộc**, **(3) rủi ro thấp trước rủi ro cao**, **(4) mỗi phiên chỉ 1 ID**.
Không bắt buộc làm hết 1 Phase mới sang Phase sau — nhưng **không nhảy cóc qua ID đang chặn** (xem cột Phụ thuộc).

### Phase 1 — ⭐ Đa danh mục: Nền dữ liệu (ưu tiên số 1 hiện tại)

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 1.1 | **W4.1** | Bảng category per-tenant — nền cho mọi thứ khác của W4 | — | M |
| 1.2 | **W4.2** | Bảng nối sản phẩm↔danh mục | W4.1 | M |
| 1.3 | **W4.3** | Tương thích ngược — không vỡ site đang publish | W4.1, W4.2 | S |

### Phase 2 — Đa danh mục: Admin quản lý

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 2.1 | **W4.4** | CRUD + sắp xếp/di chuyển danh mục trong dashboard | W4.1 | M |
| 2.2 | **W4.5** | Gán sản phẩm vào danh mục (đơn + bulk) | W4.2, W4.4 | M |
| 2.3 | **W4.6** | Banner/ảnh/SEO field từng danh mục | W4.4 | S |

### Phase 3 — Đa danh mục: Storefront

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 3.1 | **W4.7** | Route danh mục public theo tenant | W4.1, W4.3 | M |
| 3.2 | **W4.8** | Mega menu/nav sinh từ cây danh mục thật, bỏ hardcode | W4.7 | M |
| 3.3 | **W4.9** | Trang danh mục: banner, subcategory, breadcrumb, lưới SP | W4.7 | L |

### Phase 4 — Đa danh mục: Lọc & giá

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 4.1 | **W4.10** | Giá dạng số có cấu trúc — bắt buộc trước khi lọc giá | — | M |
| 4.2 | **W4.11** | Lọc theo danh mục (giá/sort/facet theo ngành) | W4.9, W4.10 | L |

### Phase 5 — Đa danh mục: SEO & sitemap

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 5.1 | **W4.12** | SEO danh mục (meta/canonical/OG + JSON-LD) | W4.9 | M |
| 5.2 | **S0.5** | Sitemap tenant (site/products/danh mục) | — | M |
| 5.3 | **W4.13** | Gộp danh mục vào sitemap tenant | W4.9, S0.5 | S |
| 5.4 | **S0.6** | Product JSON-LD (dùng chung cho PDP + danh mục) | S0.5 | M |

> ✅ **Hoàn tất Phase 1–5 (2026-08-05)** = có **web bán hàng đa danh mục chuẩn 188**, per-tenant, đa ngôn ngữ — CRUD danh mục nhiều cấp, route công khai + mega menu thật, lọc/sắp xếp theo giá, SEO JSON-LD + sitemap riêng theo shop. Toàn bộ đã test thật qua HTTP (dev server), không hồi quy qua từng phase. Đây là mốc bàn giao — **tiếp theo: Phase 6** (thuyết phục mua: reviews/Q&A, promo) hoặc mở lại Landing tuỳ ưu tiên.

### Phase 6 — Thuyết phục & thúc đẩy mua (web chính)

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 6.1 | **W1.5** | Reviews/Q&A/size guide — áp dụng được cho cả trang danh mục lẫn PDP | — | ✅ Done (trừ size guide) |
| 6.2 | **M1.2 / M1.3** | Admin trả lời Q&A + duyệt review — đi cùng data model vừa tạo ở W1.5 | W1.5 | ✅ Done |
| 6.3 | **M1.1** | Dashboard đơn hàng thật — vận hành cốt lõi, API đã có sẵn | — | ✅ Done (đã có từ trước) |
| 6.4 | **W1.4** | Promo/voucher/giá sale — có thể gắn theo danh mục (W4.*) | W4.1 | ✅ Done (trừ flash sale/bundle) |
| 6.5 | **M2.2** | Admin tạo/sửa voucher — đi cùng W1.4 | W1.4 | ✅ Done |
| 6.6 | **M2.1** | Danh sách khách hàng (CRM nhẹ) | — | ✅ Done |

### Phase 7 — Đo lường & quảng cáo

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 7.1 | **S0.3** | CAPI đầy đủ | — | M |
| 7.2 | **S0.4** | GTM + dataLayer | S0.3 | S |
| 7.3 | **S0.9** | Consent/cookie banner | S0.3 | S |

### Phase 8 — Vận hành & tăng trưởng

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 8.1 | **S0.8** | Dashboard doanh thu/conversion/UTM | S0.3, S0.4 | ✅ Done |
| 8.2 | **S0.7** | Chat đa kênh (Zalo/Messenger/phone) | — | M |
| 8.3 | **M4.1** | Thông báo admin (đơn mới/khách hỏi/review mới) | — | ✅ Done |
| 8.4 | **M3.1** | Mã nhúng analytics tự phục vụ cho merchant | S0.4 | M |
| 8.5 | **M1.4 / M2.3** | Cấu hình vận chuyển + nạp tiền/QR admin UI | W1.7, W1.3 | M2.3 ✅ Done (đã có sẵn). M1.4 chờ `W1.7` (chưa làm) |

### Phase 9 — Polish trải nghiệm web chính

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 9.1 | **W1.6** | Sticky Buy mobile + gallery swipe/zoom | — | ✅ Done (2026-08-06) |
| 9.2 | **W1.7** | Shipping/COD/e-wallet/tax nâng cao checkout | — | ✅ Phần lớn Done (2026-08-06), trừ tax + shipping theo khu vực |
| 9.3 | **W2.2 → W2.3 / W2.4** | Dọn quick-edit rồi mới mở section manager/theme editor | — | ✅ Done-MVP (2026-08-06): W2.2 + theme/nav/footer + reorder + undo-last. Block-level undo Out of scope |
| 9.4 | **W2.5 / W2.6** | Thư viện mẫu ngành + đồng bộ brand template↔shop shell | — | ✅ Done (2026-08-06): +3 presets; theme_json single-source shell |
| 9.5 | **W3.2 / W3.3 / W3.4** | Trang phụ, SEO per page, CMS nội dung tĩnh | W1.5 (size-guide) | ✅ W3.2/W3.3/W3.4 Done (2026-08-06). Blog multi-post + size-guide trên PDP (W1.5) vẫn để sau |
| 9.6 | **S0.1 / S0.10** | Domain tự động hoá hơn + đa tiền tệ/hreflang | — | ✅ Done-MVP (2026-08-06). FX / multi-locale catalog Out of scope |
| 9.7 | **W5.3** | Shortcut trạng thái đơn có badge — nhanh, tăng trải nghiệm rõ rệt | — | ✅ Done (2026-08-06) |
| 9.8 | **W5.6** | Tách route riêng mỗi mục account | — | ✅ Done (2026-08-06) |
| 9.9 | **W5.1 / W5.2 / W5.5** | Bảo mật (không password), thông báo, cài app | W5.6 | ✅ Done (2026-08-06). Password auth thật Out of scope |
| 9.10 | **W5.4** | Ví quà/voucher khách hàng | W1.4 | ✅ Done (2026-08-06) |
| 9.11 | **W5.7 / W5.8 / M2.4** | Affiliate wallet + membership — **chỉ làm khi có shop yêu cầu bật capability** | Capability flag | 🚫 Out of scope Phase 9 |
| 9.12 | **M3.2 / M3.3 / M3.4** | Nút CTA nổi, API tích hợp bên thứ ba, từ khoá mapping | W4.* | ✅ Done / Done-MVP (2026-08-06) |

### Phase 10 — ⏸️ Landing (mở lại sau khi Phase 1–5 xong)

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| 10.1 | **L1.6** | Sửa SP/rebuild từ mockup cũ — làm trước để đỡ rebuild toàn bộ | L0.* | S |
| 10.2 | **L1.1** | Mua ngay trên LP | W1.1, W1.2 | M |
| 10.3 | **L1.5** | Editor sau build | L1.1 | M |
| 10.4 | **L1.3** | Trust trên LP (dùng data từ W1.5) | W1.5 | S |
| 10.5 | **L1.2** | Offer/urgency trên LP (dùng engine giá từ W1.4) | W1.4 | M |
| 10.6 | **L2.1** | SEO editable per LP | S0.6 | M |
| 10.7 | **L2.2 / L2.3** | Funnel + affiliate riêng LP | S0.8 | M |
| 10.8 | **L1.4** | Form chiến dịch trên LP | S0.3 | S |

### Phase phụ — Hub Studio (không chặn W, làm khi rảnh, sau Landing)

| Thứ tự | ID | Vì sao | Phụ thuộc | Độ lớn |
|---|----|----|----|----|
| H.1 | **H.2** | Gắn HTML editor vào UI active + share htmlSource | — | M |
| H.2 | **H.3** | Bridge Hub design → Partner Landing | H.2, L1.5 | L |

### Tóm tắt thứ tự tổng (nhìn nhanh)

```
Phase 1 (⭐ ưu tiên):  W4.1 → W4.2 → W4.3
Phase 2:              W4.4 → W4.5 → W4.6
Phase 3:              W4.7 → W4.8 → W4.9
Phase 4:              W4.10 → W4.11
Phase 5:              W4.12 → S0.5 → W4.13 → S0.6
——— Mốc: web bán hàng đa danh mục hoàn chỉnh ———
Phase 6 (Done): W1.5 (trừ size guide) → M1.1 (đã có sẵn) → M1.2/M1.3 → W1.4 (trừ flash sale/bundle, cả 2 luồng checkout) → M2.2 → M2.1 → W5.4
——— Mốc: vận hành + thuyết phục mua cốt lõi hoàn chỉnh ———
Phase 7 (Done):       S0.3 → S0.4 → S0.9 → M3.1
Phase 8 (Done phần lớn): S0.8 → M4.1 → M2.3 (đã có sẵn) — còn S0.7 (chat đa kênh), M1.4 (chờ W1.7)
Phase 9 (Done-MVP 2026-08-06): W1.6 → W1.7 → W2.* → W3.2–4 → W5.1–6 → S0.1/S0.10 → M3.2–4 (W5.7/W5.8 🚫)
——— Mốc: mở lại Landing ———
Phase 10 (Landing):   L1.6 → L1.1 → L1.5 → L1.3 → L1.2 → L2.1 → L2.2/L2.3 → L1.4
Phụ:                  H.2 → H.3
```

---

## Cách dùng tài liệu này

### Trước khi code

1. Xác định task thuộc **W / L / S / H**.  
2. Chọn đúng **một ID** còn ❌ hoặc 🟡.  
3. Nêu trong chat: `Làm ID L1.1 — mục tiêu: … — không đụng W2.*`.  
4. Nếu làm L: không phá web chính. Nếu làm W: không phá luồng LP create→build→publish.  
5. Reuse code shop hiện có trước khi viết path mới.

### Khi báo hoàn tất

- [ ] Đổi trạng thái ID trong file này + dòng log  
- [ ] Web: template → preview → publish vẫn OK  
- [ ] Landing: create → build → preview → publish → `/lp/...` vẫn OK  
- [ ] Giữ hooks `data-nanoai-*` (buy/chat/inventory)  
- [ ] i18n đủ locale; industry isolation messaging  

### Khi tài liệu lệch code

Sửa tài liệu **cùng PR** với code.

---

## File / API tham chiếu nhanh

### Web chính (W)

| Vai trò | Path |
|---------|------|
| Dashboard | `src/app/dashboard/messaging/website/partner-website-dashboard-client.tsx` |
| Journal / tạo từ mẫu | `src/components/partner-website/partner-website-creation-journal-panel.tsx` |
| Studio flow | `src/lib/partner-website/partner-website-studio-flow.ts` |
| Templates | `src/lib/partner-website/template/shop-template-presets.ts` |
| Sections | `src/lib/partner-website/template/section-registry.ts` |
| Page catalog | `src/lib/partner-website/partner-website-page-catalog.ts` |
| Shop PDP/Cart | `src/components/partner-website/shop/partner-site-shop-*.tsx` |
| Copy UI | `src/lib/i18n/partner-website-copy.ts` |
| Custom domain | `src/app/dashboard/messaging/partner-custom-domain-settings-card.tsx` |

### Landing (L)

| Vai trò | Path |
|---------|------|
| Panel | `src/components/partner-website/partner-website-landings-panel.tsx` |
| Types | `src/lib/partner-website/landing/partner-landing-types.ts` |
| Build | `src/lib/partner-website/landing/build-partner-landing-from-products.ts` |
| Buy script | `src/lib/partner-website/landing/build-landing-buy-script.ts` |
| Public LP | `src/app/site/[slug]/lp/[landingSlug]/page.tsx` |
| API | `src/app/api/messaging/partner-website/[partnerId]/landings/` |

### Shared (S)

| Vai trò | Path |
|---------|------|
| Tracking | `src/lib/partner-website/shop/partner-site-shop-tracking.ts` |
| Head snippets | `src/lib/partner-website/shop/build-shop-tracking-head-snippets.ts` |
| Order + CAPI hook | `src/app/api/messaging/guest/[slug]/order/route.ts` |
| Sitemap platform | `src/app/sitemap.ts` |
| Leads | `src/components/partner-website/partner-website-leads-panel.tsx` |

### Mẫu 188 (đọc-only)

| Vai trò | Path trong 188 |
|---------|----------------|
| SEO product | `frontend/lib/product-seo.ts` |
| Embeds/pixel | `frontend/app/admin/embed-codes/` |
| CAPI | `frontend/app/api/facebook-capi/route.ts` |
| Reviews | `frontend/app/products/[slug]/components/ProductReviewSection/` |
| Affiliate | `frontend/components/affiliate/AffiliateShareBar.tsx` |

---

## Log phiên làm việc (append)

| Ngày | ID | Việc làm | Kết quả |
|------|-----|----------|---------|
| 2026-08-05 | — | Checklist chỉ Landing | Baseline LP |
| 2026-08-05 | — | Gộp phạm vi **Tạo web & landing** (W+L+S+H) | File này thay thế guide chỉ-LP |
| 2026-08-05 | — | Phát hiện gap: chưa có category/danh mục thật cho shop đối tác | Thêm nhóm `W4.*` (13 ID), roadmap Phase 1–5 |
| 2026-08-05 | — | Quyết định: **hoãn Landing (`L.*`)**, ưu tiên `W4.*` đa danh mục trước | Roadmap viết lại Phase 1–10 |
| 2026-08-05 | — | Đối chiếu trang `/account` 188 vs `partner-site-shop-account-client.tsx` | Thêm nhóm `W5.*` (8 ID), W5.7/W5.8 đánh dấu Out of scope mặc định (capability-gated) |
| 2026-08-05 | — | Đối chiếu sidebar admin 188 (`/admin/*`) | Thêm nhóm `M.*` (quản trị vận hành shop) — lọc bỏ phần đặc thù nguồn hàng/hạ tầng riêng 188 |
| 2026-08-05 | — | Viết đặc tả hành vi chi tiết từng bước (category, account, review/QA, voucher, CAPI/embed) | File mới `docs/188_BEHAVIOR_SPEC.md` — kèm 17 mục "không nên copy" |
| 2026-08-05 | **W4.1, W4.2, W4.3** | Tạo bảng `messaging_partner_categories` + `messaging_partner_inventory_categories`, trigger cách ly tenant, migration đã áp + test local pass | Phase 1 hoàn tất. Fix phụ: migration `20260805090000` thiếu `drop constraint if exists` (chặn toàn bộ pipeline) — đã vá tối thiểu để không ai bị kẹt |
| 2026-08-05 | **W4.4, W4.5, W4.6** | Admin CRUD + move (rebuild path/depth + chặn cycle) + reorder + gán sản phẩm hàng loạt + banner/SEO field; panel UI + 5 API routes + copy 5 ngôn ngữ; test `scripts/test-partner-categories-w4-phase2.ts` pass toàn bộ | Phase 2 hoàn tất. `tsc --noEmit` vẫn 293 lỗi pre-existing, không thêm lỗi mới |
| 2026-08-05 | **W4.7, W4.8, W4.9** | Route `/site/{slug}/c/{...path}` + API `categories`/`products?categoryId=` + mega menu thật trong shell + breadcrumb/banner/tile con/lưới SP; test e2e thật qua dev server (`scripts/test-partner-categories-w4-phase3.ts`) — 6/6 check pass, log server sạch | Phase 3 hoàn tất. Còn lại của W4: SEO danh mục (`W4.12`, Phase 5), lọc giá/facet (`W4.11`, Phase 4) |
| 2026-08-05 | **W4.10, W4.11** | Migration `price_amount`/`price_currency` (additive) + tự tính khi ghi (dashboard/import/upsert) + fallback 4 tầng cho DB cũ; lọc `minPrice/maxPrice` + sort theo giá qua API + UI; test e2e qua dev server (`scripts/test-partner-categories-w4-phase4.ts`) — 5/5 check pass, không hồi quy Phase 1-3 | Phase 4 hoàn tất (trừ facet ngành — để phiên sau, cần kiến trúc adapter riêng) |
| 2026-08-05 | **W4.12, S0.5, W4.13, S0.6** | JSON-LD BreadcrumbList+CollectionPage cho trang danh mục; JSON-LD Product+Offer cho PDP (dùng `price_amount`); route `sitemap.xml` riêng theo shop (home+danh mục+sản phẩm, tương thích custom domain); fix phụ: thiếu `c` và `sitemap.xml` trong `SHOP_PUBLIC_ROOT_SEGMENTS` (custom domain sẽ 404 các route mới nếu không thêm — phát hiện khi làm W4.12); test e2e (`scripts/test-partner-categories-w4-phase5.ts`) — 4/4 pass, không hồi quy Phase 1-4 | Phase 5 hoàn tất phần cốt lõi. Còn thiếu: `/lp/*` trong sitemap (chờ mở lại Landing), rating/review JSON-LD (chờ `W1.5`), đăng ký sitemap tenant vào robots/sitemap index gốc |
| 2026-08-05 | — (dọn nợ kỹ thuật, ngoài phạm vi W4) | Sửa toàn bộ 145 lỗi TS pre-existing (293 dòng output) không liên quan category: thiếu import `HubStudioSession`/`HubStudioMessagePayload` (hub-studio-generation-refs.ts, ~40 lỗi ăn theo), fixture test thiếu field `HubStudioSession`/`HubPackagingState` (9 file `*.test.ts`), 16 API route thiếu tham số `status` khi gọi `json*WithCors`, `messaging-partners-pg.ts` thiếu 3-5 field mới (`partner_capabilities`, `external_shop_origin`, `external_shop_login_path`, `google_ads_id`, `tiktok_pixel_id`) ở nhiều nhánh fallback, bug thật `wedding-reminder-email.ts` (biến `dateLabel` không tồn tại — email nhắc lịch cưới bị lỗi ngày), thiếu `vitest` devDependency (9 file), Lucide icon type, `BANNER_AD_PRESETS` bị widen type làm mất literal `id`, và ~10 lỗi rải rác khác | `tsc --noEmit` **0 lỗi**. Đã re-run test Phase 1+2 + lint các file sửa — không phát sinh regression |
| 2026-08-05 | **W1.5, M1.2, M1.3, S0.6** | Migration `messaging_partner_product_reviews/_review_votes/_questions/_question_answers` (+ cột `review_requires_approval`); verified purchase enforce THẬT ở backend (`checkDeliveredPurchaseFromPg`: `status=paid_verified` + `shipping_status=delivered`, `checkAnyPurchaseFromPg` cho Q&A: mọi đơn không huỷ); unique `(partner, inventory, guest_account/linked_user)` ở DB (không chỉ ẩn UI như 188); rating/histogram tính thật bằng `COUNT/AVG group by rating`; ảnh review hiện công khai; vote hữu ích toggle unique `(review_id, voter_key)` sàn 0; Q&A: hỏi không cần mua hàng, trả lời buyer giới hạn `QA_BUYER_ANSWER_LIMIT=2` (tổng quát hoá hardcode "2" của 188) + admin reply riêng không giới hạn; PDP thêm section reviews/Q&A công khai (`PartnerSiteProductReviewsQa`) + `AggregateRating` JSON-LD thật; admin panel `PartnerWebsiteReviewsQaPanel` (M1.2/M1.3) — inline auto-save debounce 700ms, lọc rating, xoá từng dòng + xoá tất cả (chỉ review, không có ở Q&A đúng hành vi 188); copy đủ 5 ngôn ngữ (dashboard + public site); test: `scripts/test-partner-reviews-w1_5-phase1.ts` (DB layer, 16 check), `-phase2.ts` (API công khai qua HTTP thật, 9 check), `-phase3.ts` (admin API + PDP JSON-LD qua HTTP thật, 7 check) — tất cả pass, log server sạch, re-run toàn bộ 5 phase W4 xác nhận không hồi quy | 🎯 Mốc "web bán hàng đa danh mục hoàn chỉnh" đã đạt (Phase 1-5 W4.* xong trước đó). Phase 6 (W1.5/M1.2/M1.3) hoàn tất phần cốt lõi. Còn thiếu: size guide (bảng size sản phẩm), M1.1 (dashboard đơn hàng thật), W1.4 (promo/voucher) |

| 2026-08-05 | **M1.1** (đính chính) | Phát hiện `M1.1` đã có sẵn từ trước (`/dashboard/messaging/orders`, 1198 dòng) — ghi chú "chưa có UI panel" trong tài liệu cũ bị lỗi thời | Không cần code mới, chỉ đính chính checklist |
| 2026-08-05 | **W1.4, M2.2** | Migration `messaging_partner_promotions/_promotion_grants/_promotion_usages` (+ 3 cột `promo_*` additive trên `messaging_partner_orders`); voucher engine vượt 188 (giảm %/số tiền cố định, target category/sản phẩm cụ thể qua eligible-subtotal, tự nhập mã redeem công khai `is_public_redeemable`, ví quà riêng cho voucher không public); validate luôn tính lại ở backend (`validatePromotionCodeFromPg` dùng chung cho API ước tính lẫn checkout thật — không tin số FE gửi, D.2); tích hợp vào `completeCartCheckout` — lớp giảm giá promo tách biệt hoàn toàn khỏi loyalty/birthday hiện có (không đổi ý nghĩa `total_discount_*` cũ); UI giỏ hàng nhập mã + hiển thị giảm giá/tổng cộng; admin panel `PartnerWebsitePromotionsPanel` (M2.2) CRUD đầy đủ; copy đủ 5 ngôn ngữ; test: `scripts/test-partner-promotions-w1_4-phase1.ts` (DB layer, 11 check), `-phase2.ts` (checkout thật qua HTTP + **regression an toàn**: checkout không mã xác nhận hoạt động y hệt trước đây, 4 check) — tất cả pass, log server sạch, re-run toàn bộ 10 bộ test (W4 5 phase + W1.5 3 phase + W1.4 2 phase) xác nhận không hồi quy | Phase 6 hoàn tất phần lớn (W1.5, M1.1, M1.2, M1.3, W1.4, M2.2 xong). Còn lại: `M2.1` (CRM nhẹ), size guide (`W1.5`), flash sale/bundle (`W1.4`), tích hợp promo vào checkout chat đơn lẻ, `W5.4` (UI ví quà công khai — data layer đã có) |

| 2026-08-05 | **M2.1** | `fetchPartnerCustomersForAdminFromPg` — gộp khách hàng theo email chuẩn hoá (nguồn duy nhất luôn có trên mọi đơn, khác `guest_account_id`/`linked_user_id` có thể null tuỳ kênh); tổng chi tiêu CHỈ tính đơn `paid_verified`+`delivered` (khớp công thức đã dùng cho loyalty), order_count tính mọi trạng thái; tên/SĐT lấy từ đơn gần nhất theo `created_at`; search theo tên/SĐT/email; panel `PartnerWebsiteCustomersPanel` (bảng + phân trang); test DB layer (3 check) + API qua HTTP thật (2 check, gồm cách ly quyền theo tenant) — tất cả pass; re-run toàn bộ 12 bộ test (5 W4 + 3 W1.5 + 2 W1.4 + 2 M2.1) xác nhận không hồi quy | 🎯 **Phase 6 hoàn tất phần lớn** (W1.5, M1.1, M1.2, M1.3, W1.4, M2.2, M2.1 xong). Còn lại nợ nhỏ: size guide (`W1.5`), flash sale/bundle (`W1.4`), tích hợp promo vào checkout chat đơn lẻ, `W5.4` (UI ví quà công khai). Sẵn sàng chuyển Phase 7 (tracking/pixel/CAPI) hoặc mở lại Landing |

| 2026-08-06 | **W1.4** (đóng nợ), **W5.4** | Tích hợp voucher vào luồng checkout AI chat đơn lẻ (`completeOrderCheckout`) — cùng nguyên tắc tách biệt lớp promo khỏi loyalty/birthday đã áp dụng cho cart checkout; `orderDiscountSummaryLine` hiện thêm dòng mã giảm giá trong tin nhắn xác nhận đơn cho khách. Ví quà công khai (`W5.4`): API `GET /api/site/{slug}/promotions/wallet` + tab "Ví quà" trong trang tài khoản khách (`partner-site-shop-account-client.tsx`) — copy mã trực tiếp (cải tiến so với 188 chỉ điều hướng giỏ hàng). Test: `-phase3.ts` (voucher chat checkout, 3 check gồm regression) + `-w5_4-wallet.ts` (2 check) — tất cả pass; re-run toàn bộ 14 bộ test (5 W4 + 3 W1.5 + 3 W1.4 + 2 M2.1 + 1 W5.4) xác nhận không hồi quy | 🎯 **Phase 6 hoàn tất** (trừ size guide `W1.5` và flash sale/bundle `W1.4` — chủ động để ngoài phạm vi "voucher/review nhẹ"). Sẵn sàng Phase 7 (tracking/pixel/CAPI) hoặc mở lại Landing |

| 2026-08-06 | **S0.3** (Phase 7 bắt đầu) | Mở rộng `sendMetaConversionsApiBatch` (event_name union thêm InitiateCheckout/Purchase, custom_data thêm contents/num_items/order_id, user_data thêm em/ph hash SHA-256); file mới `meta-capi-hash.ts` (hash email chuẩn hoá lowercase, SĐT chuẩn hoá về `84xxxxxxxxx` trước khi hash); sửa bug `runMetaPurchaseAfterOrderComplete` dùng `randomUUID()` cho Purchase event_id (phải dùng ID ổn định `Purchase_{orderId}` mới dedupe đúng — phát hiện khi implement E.4); hàm mới `sendPartnerMetaPurchaseCapiOnPaymentConfirmed` dùng chung cho 3 luồng xác nhận thanh toán (webhook SePay, admin thủ công, OCR biên lai); route mới `/api/site/{slug}/tracking/meta-capi` (proxy 2 lớp cho 4 event chuẩn shop, hỗ trợ `sendBeacon`); `partner-site-shop-tracking.ts` sinh + chia sẻ `event_id` giữa pixel (`fbq eventID`) và CAPI. Test: `scripts/test-tracking-s0_3-capi.ts` (6 check: hash email/SĐT, validate route, skip an toàn khi chưa cấu hình pixel, 404 site lạ) — pass; re-run 8 bộ test trọng điểm (W4, W1.5, W1.4×2, W5.4, M2.1) xác nhận không hồi quy, log server sạch | S0.3 done phần cốt lõi (event_id dedupe + Purchase server-side đúng thời điểm — đây là lỗi quan trọng nhất đã sửa). Còn: outbox/retry log, TikTok CAPI server-side. Phase 7 còn `S0.4` (GTM/dataLayer per-partner), `S0.9` (consent banner) |

| 2026-08-06 | **S0.4, M3.1, S0.9** (Phase 7 hoàn tất) | Migration `gtm_container_id` (additive) trên `messaging_partners` — theo đúng mẫu `google_ads_id`/`tiktok_pixel_id` (cập nhật `database.types.ts`, `isMissingPartnerProfileColumnError` fallback, toàn bộ nhánh legacy trong `messaging-partners-pg.ts`); hàm `updateMessagingPartnerGtmContainerForOwnerFromPg` + action `savePartnerMessagingGtmContainer` + UI card GTM trong dashboard settings (M3.1 — merchant tự nhập, không cần dev can thiệp); bootstrap tự sinh script GTM trên trang shop; `window.dataLayer.push()` chuẩn ecommerce (xoá `ecommerce` cũ trước khi push mới theo khuyến nghị Google) cho cả 4 event, hoạt động độc lập không cần GTM container ID. **S0.9**: file mới `partner-site-consent.ts` (lưu theo `siteSlug`, tránh share nhầm giữa các shop cùng domain platform) + `PartnerSiteCookieConsentBanner`; chặn THẬT mọi tracking (không chỉ ẩn banner) — cả ở bootstrap (`useTrackingConsentGranted`) lẫn từng hàm `trackPartnerSite*` riêng lẻ (phát hiện: PDP/cart gọi `ensureFbqPixelInitialized` trực tiếp, không qua bootstrap — nếu chỉ gate bootstrap thì vẫn lọt tracking khi chưa consent). Test: `scripts/test-tracking-s0_4-gtm.ts` (4 check: lưu/đọc/map/cách ly quyền) — pass; re-run 10 bộ test trọng điểm (W4×3, W1.5×2, W1.4×2, W5.4, M2.1, S0.3) xác nhận không hồi quy, log server sạch | 🎯 **Phase 7 hoàn tất** (S0.3/S0.4/S0.9/M3.1). Còn nợ nhỏ đã ghi chú: outbox/retry log CAPI, TikTok Events API server-side, chế độ HTML tự do cho embed lạ (M3.1). Sẵn sàng Phase 8 (dashboard doanh thu/UTM) hoặc mở lại Landing |

| 2026-08-06 | **S0.8** | `messaging-partner-revenue-analytics-pg.ts` — doanh thu THẬT (đơn `paid_verified`+`delivered`, cùng công thức `amount_after_discount` đã dùng cho M2.1/W1.4, không lệch số liệu giữa các dashboard); doanh thu theo ngày (Asia/Ho_Chi_Minh); doanh thu theo UTM source/campaign (join `messaging_partner_orders` → `customer_care_conversations` → `messaging_partner_visitor_personalization`, đúng thứ tự ưu tiên `guest_account_id → linked_user_id → external_thread_id` khớp `visitorAccountKeyFromThread`, đơn không khớp UTM nào gộp nhóm "Trực tiếp/Không rõ"); top sản phẩm bán chạy (UNION order_lines + fallback đơn cũ không có dòng nào trong `order_lines`). Trang mới `/dashboard/messaging/analytics` (biểu đồ `recharts`, bảng UTM/top sản phẩm) + nav link mới (cập nhật `analyticsLabel` bắt buộc ở toàn bộ nơi gọi `MessagingDashboardNavLinks`/`PartnerWebsiteDashboardShell`); "khách truy cập"/"tỉ lệ chuyển đổi" ghi rõ ƯỚC TÍNH (không nói dối số liệu chính xác tuyệt đối, đúng nguyên tắc từ `188_BEHAVIOR_SPEC.md`). Test: `scripts/test-revenue-analytics-s0_8.ts` (DB layer, 4 check) + `-phase2.ts` (API+trang qua HTTP thật, 3 check gồm cách ly quyền) — pass; re-run 6 bộ test trọng điểm xác nhận không hồi quy | 🎯 **Phase 8 mục S0.8 hoàn tất**. Còn lại trong Phase 8: `S0.7` (chat đa kênh), `M4.1` (thông báo admin), `M1.4/M2.3` (vận chuyển + nạp tiền QR) |

| 2026-08-06 | **M4.1**, **M2.3** (đính chính) | Phát hiện `M2.3` đã có sẵn từ trước (mục "Đơn hàng & thanh toán" trong dashboard settings — bank info, đặt cọc, SePay QR đầy đủ) — ghi chú cũ bị lỗi thời. `M4.1`: file mới `partner-admin-notifications.ts` dùng chung hạ tầng thông báo đã có (`deliverUserNotificationPg` — in-app + email + push); gửi cho chủ shop khi có đơn mới (wire vào cả `completeCartCheckout` và `completeOrderCheckout`), khách hỏi mới, review mới (wire vào 2 API route site công khai); không chặn luồng chính nếu gửi thông báo lỗi (fire-and-forget). Test: `scripts/test-partner-admin-notifications-m4_1.ts` (4 check: nội dung + push_url đúng, partner không tồn tại bỏ qua an toàn) — pass; re-run 5 bộ test trọng điểm (voucher×2, review, S0.8) xác nhận không hồi quy | 🎯 **Phase 8 hoàn tất toàn bộ** (S0.8, M4.1, M2.3 xong; M1.4 chờ `W1.7` chưa làm — ngoài phạm vi phiên này). Sẵn sàng Phase 9 (trang phụ/SEO/CMS) hoặc mở lại Landing (Phase 10) |

| 2026-08-06 | **W3.3, W3.4** | Bảng mới `messaging_partner_static_pages` — 1 bảng phục vụ 2 mục đích: (a) ghi đè nội dung/SEO của 8 trang có sẵn (about/contact/faq/sale/shipping/returns/privacy/terms) khi `slug` trùng key, (b) trang tự do mới khi `slug` khác — route mới `/site/{slug}/pages/{pageSlug}` (namespace riêng, không đụng route hệ thống hiện có, có validate slug tránh trùng `products/cart/account/...`); `render-partner-site-info-page.tsx` check DB override trước, fallback y hệt hành vi hardcode cũ nếu không có/chưa publish (an toàn tuyệt đối cho shop chưa dùng CMS); SEO per-page: merchant tự nhập title/description/`seo_index` (noindex khi tắt); thêm `pages` vào `SHOP_PUBLIC_ROOT_SEGMENTS` cho custom domain. Admin panel `PartnerWebsiteStaticPagesPanel` (CRUD, badge "override" cho 8 trang có sẵn, link xem trang công khai). Test: `scripts/test-static-pages-w3_4.ts` (DB layer, 8 check) + `-phase2.ts` (render + admin API qua HTTP thật, 5 check gồm regression trang chưa ghi đè) — pass; re-run 7 bộ test trọng điểm xác nhận không hồi quy | 🎯 **W3.3/W3.4 hoàn tất**. `W3.2` (blog/lookbook/stores/thank-you/payment) vẫn để sau — có thể tận dụng namespace `/pages/{slug}` vừa tạo cho các loại trang đơn giản (thank-you, lookbook dạng text), riêng blog cần model khác (nhiều bài, phân trang) |

| 2026-08-06 | **W4.12** (bổ sung), **S0.6** (bổ sung) | Đối chiếu SEO danh mục/PDP với 188 theo yêu cầu user, phát hiện 3 lỗi thật: (1) title mọi trang `/site/{slug}/*` bị dính `\| NanoAI` do dùng chung `buildMetadata()` platform — sai cho web đa tenant; (2) OG image dùng ảnh generic tự sinh `/og?title=...` thay vì ảnh sản phẩm/danh mục/logo shop thật; (3) canonical/OG url tính từ origin tĩnh platform, SAI domain khi shop dùng custom domain (lẽ ra phải theo header `x-partner-custom-domain`). Sửa bằng file mới `partner-site-seo-metadata.ts` (`buildPartnerSiteMetadata()`) dùng cho toàn bộ 12 trang `/site/{slug}/*` (home/danh mục/PDP/products/cart/orders/account/addresses/wishlist/recently-viewed/lp/pages). PDP thêm `BreadcrumbList` JSON-LD (thiếu so với 188, dùng danh mục chính `is_primary` của sản phẩm) + `brand`/`seller` trong `Offer`. **Tính năng mới**: tự động sinh nội dung SEO danh mục bằng AI (tương đương `category_seo_meta`+Gemini của 188) — migration thêm `seo_body`/`seo_body_generated_at`/`seo_body_generated_locale` (additive) trên `messaging_partner_categories`; service `partner-category-seo-ai.ts` (Gemini `gemini-2.5-flash`, sinh theo `locale` của shop — không hardcode tiếng Việt như 188, có validate độ dài chặn kết quả bị cắt cụt do ngân sách "thinking" token, fallback mẫu 5 ngôn ngữ khi chưa cấu hình `GOOGLE_API_KEY`); route `POST .../categories/{id}/generate-seo`; nút "Tự động sinh bằng AI" trong `PartnerWebsiteCategoriesPanel` (sửa tay sẽ tự xoá mốc "do AI sinh"); render đoạn văn cuối trang danh mục công khai khi có `seo_body`. Test: `scripts/test-category-seo-auto-w4_12.ts` (6 check: mặc định rỗng, sample product names, AI/fallback content, ghi+đọc lại, sửa tay xoá mốc AI) — pass; `tsc --noEmit` 0 lỗi toàn project (3 lần chạy) | 🎯 Vá xong lỗi SEO hệ thống ảnh hưởng MỌI shop (title/OG/canonical) + tính năng auto-SEO danh mục hoàn tất phần cốt lõi. Còn để sau (không phải lỗi, là tính năng bổ sung của 188): auto-link tên danh mục anh em trong đoạn văn AI sinh (188 có, NanoAI chưa làm — cần render HTML có anchor thay vì plain text) |

| 2026-08-06 | **W1.6** (Phase 9 bắt đầu) | Thêm `stockQty` vào `PartnerSiteShopProduct`/`inventoryRowToShopProduct` (chỉ hiển thị, không dùng để chặn checkout — hệ thống chưa có tracking tồn kho bắt buộc). PDP: (1) thanh "mua nổi" cố định đáy màn hình mobile, tự hiện khi cuộn qua khối nút mua chính (`IntersectionObserver`), đặt trên `pw-shop-bottom-nav` (z-index 49 < 50); (2) vuốt ngang đổi ảnh gallery (touch start/end tính `deltaX`, ngưỡng 40px) dùng chung cho ảnh chính lẫn lightbox; (3) lightbox toàn màn hình khi chạm ảnh chính — double-tap/click phóng to (`scale(2)`), nút đóng/prev/next, chấm chỉ vị trí; (4) badge cảnh báo "Chỉ còn N sản phẩm" chỉ hiện khi tồn kho 1-5 (KHÔNG hiện/chặn mua khi = 0, vì đa số shop hiện tại chưa từng nhập tồn kho nên mặc định 0 — hiện "hết hàng" nhầm sẽ chặn checkout hàng loạt, phát hiện khi audit dữ liệu `stock_qty` không được dùng ở bất kỳ luồng checkout nào). CSS mới trong `build-shop-theme-css.ts` (namespace `pw-shop-sticky-buy`/`pw-shop-lightbox`/`pw-shop-urgency-badge`), copy đủ 5 ngôn ngữ. Test: `scripts/test-pdp-w1_6-mobile-ux.ts` (2 case, gồm case an toàn "không hiện cảnh báo sai") — pass; re-run `test-partner-categories-w4-phase5.ts` (JSON-LD PDP) + `test-partner-reviews-w1_5-phase3.ts` (reviews/QA PDP) xác nhận không hồi quy; `tsc --noEmit` 0 lỗi | 🎯 **W1.6 hoàn tất**. Phase 9 còn: `W1.7` (shipping/COD/e-wallet/tax — lớn, cần thiết kế riêng), `W2.*` (page builder), `W3.2` (blog/lookbook/stores), `S0.1/S0.10` (domain automation/đa tiền tệ) |

| 2026-08-06 | **W1.7**, **M1.4** (bổ sung) | Khảo sát kỹ trước khi code: phát hiện hệ thống CHƯA có khái niệm `shipping_fee` ở đâu cả (không phải =0, là không tồn tại), địa chỉ giao hàng là text tự do (không tỉnh/huyện), và KHÔNG có tích hợp ví điện tử thật nào (chỉ SePay = QR chuyển khoản + webhook, không phải cổng ví). Theo lựa chọn scope của user (phí cố định+ngưỡng free-ship / ví điện tử kiểu QR thủ công / bỏ qua tax): migration thêm additive `shipping_fee_amount`/`shipping_free_threshold_amount`/`ewallet_*` trên `messaging_partner_payment_settings`, `payment_method`/`shipping_fee_amount`/`refund_*` trên `messaging_partner_orders`. Quyết định kiến trúc quan trọng nhất: `shipping_fee_amount` KHÔNG cộng vào `amount_after_discount` — cột đó vẫn giữ nguyên ý nghĩa "giá trị SP sau giảm" vì đang là cơ sở tính cọc VÀ doanh thu/LTV ở M2.1/S0.8 (đổi ý nghĩa sẽ làm sai lệch toàn bộ báo cáo đã có); phí ship chỉ cộng thêm lúc hiển thị tổng cuối. `payment_method` (cod/bank_transfer/ewallet) chỉ có ý nghĩa lựa chọn thật khi đơn CÓ cọc — không cọc thì luôn coi là COD (không đổi hành vi cũ). Ví điện tử dùng QR tĩnh merchant tự upload (giống SePay về UX, không phải API cổng thật — đúng lựa chọn "manual_qr" của user). Sửa xong 1 bug tiềm ẩn phát hiện khi audit: `ORDER_ROW_SELECT` và 3 SELECT khác thiếu `promo_id/promo_code/promo_discount_amount` (một số đường đọc đơn trả về promo rỗng dù đơn có promo thật — tiện thể vá cùng lúc vì đụng đúng chỗ). Wire đầy đủ: cả 2 luồng checkout (cart + AI chat đơn lẻ), UI chọn phương thức thanh toán + hiện phí ship/miễn ship trên trang giỏ hàng, hiển thị QR/thông tin ví điện tử trên xác nhận đơn VÀ order card trong chat widget, admin settings cấu hình phí ship/ví điện tử, admin flow hoàn tiền thủ công (đánh dấu + tự thông báo qua chat). Test: `scripts/test-w1_7-shipping-ewallet-refund.ts` (7 check: DB round-trip, phí ship dưới/đạt ngưỡng free, chọn ewallet đúng QR, **regression an toàn** shop chưa cấu hình hoạt động y hệt trước W1.7, hoàn tiền) — pass; re-run `test-partner-promotions-w1_4-phase2.ts` + `-phase3.ts` xác nhận không hồi quy voucher/checkout; `tsc --noEmit` 0 lỗi (nhiều lần chạy trong lúc code) | 🎯 **W1.7 hoàn tất phần cốt lõi** (shipping fee, payment method rõ ràng, ví điện tử QR thủ công, hoàn tiền). Còn lại chủ động để sau: tax/VAT (đa số shop nhỏ không cần), shipping theo khu vực (cần đổi địa chỉ có cấu trúc — phạm vi lớn hơn), API cổng thanh toán thật (cần tài khoản merchant thật từ user) |

| 2026-08-06 | **W2.3** (phần theme), **W2.4** (phần reorder) | Khảo sát kỹ trước khi code, phát hiện: (1) `partner-website-quick-edits.ts` (W2.2) là dead code, không nơi nào gọi; (2) backend đã có sẵn đầy đủ mô hình section có thứ tự + op `reorder`/`remove`/`add`/`update` (`apply-template-edits.ts`) — chỉ dùng qua AI chat, chưa có UI/API trực tiếp; (3) xung đột kiến trúc quan trọng: khi merchant dùng "Sửa nhanh" (WYSIWYG trên iframe), site set `theme.useVisualHtml=true` và **bỏ qua vĩnh viễn** cấu trúc `pages/sections` khi render — theo lựa chọn user, section manager + theme color picker phải **tự khoá + giải thích rõ** trong TH này thay vì cho sửa vô nghĩa. Đã làm: 2 action mới trên PATCH `/api/messaging/partner-website/{partnerId}` (`reorder_sections`, `update_theme_colors`) tái dùng thẳng `applyTemplateEditPayload`/`updatePartnerWebsiteDraftPg` có sẵn (không viết lại logic ghi DB); UI nút lên/xuống cho section (không thêm thư viện kéo-thả mới — dùng lại đúng pattern `PartnerWebsiteCategoriesPanel` đã có, rủi ro thấp hơn); UI color picker 5 token theme (`primaryColor/accentColor/backgroundColor/textColor/mutedColor`) — đổi màu áp dụng đồng thời cho trang chủ lẫn khung shop (cart/PDP/account) vì dùng chung `theme_json`. Test: `scripts/test-w2_3-w2_4-theme-sections.ts` (6 check: reorder đúng thứ tự, chặn id sai/mismatch, đổi màu đúng field không đụng field khác, chặn giá trị màu không hợp lệ, **khoá đúng 409 cả 2 action khi `useVisualHtml=true`**) — pass; `tsc --noEmit` 0 lỗi (nhiều lần trong lúc code) | 🎯 W2.3 (theme)/W2.4 (reorder) hoàn tất phần cốt lõi, chi phí thấp vì tận dụng tối đa hạ tầng có sẵn. Còn lại cho phiên sau: W2.2 (dọn dead code + chuẩn hoá quick-edit đa ngành), W2.3 nav/footer (cần thiết kế schema mới, phạm vi lớn hơn), W2.4 undo block-level (cần hạ tầng diff/snapshot từng thao tác, khác hẳn cơ chế "khôi phục toàn site" hiện có) |

| 2026-08-06 | **W5.3** | Shortcut trạng thái đơn có badge trên tab Đơn hàng: chip cuộn ngang (Tất cả / Chờ thanh toán / Chờ nhận / Đã nhận / Đã đánh giá / Đã huỷ), đếm client-side trên list đã fetch; API guest orders gắn `has_review` từ `messaging_partner_product_reviews.order_id`; deep link `#orders?tab=<key>`; copy 5 ngôn ngữ. Test: `scripts/test-w5_3-order-status-shortcuts.ts` | ✅ Done |

| 2026-08-06 | **W2.2**, **W3.2** | **W2.2**: tái sử dụng `partner-website-quick-edits.ts` → `getPartnerWebsiteEditSuggestions` theo `industry_key`+capabilities; bỏ prompt cam/fashion; wire studio/chat/journal + `industry_key` trên `fetchPartnerProfileForWebsitePg`. **W3.2**: 6 route React (`payment`/`thank-you`/`stores`/`lookbook`/`size-guide`/`blog`) + mặc định 5 locale + CMS builtin override; footer/sitemap; checkout redirect `/thank-you?order=`; blog multi-post để sau. Test: `test-w2_2-industry-quick-edits.ts`, `test-w3_2-secondary-pages.ts` | ✅ Done |

| 2026-08-06 | **W5.6 / W5.1 / W5.2 / W5.5** (Phase 9 Batch 2) | Route account thật: `/account` overview + `/account/[tab]` (noIndex); hash legacy → `router.replace`; `partnerSiteAccountTabPath`. Security (không password): OTP/Google note + sign-out device (`DELETE /session` + clear LS). Notifications: migration `20260806150000_*` + PG helpers + `GET/PATCH /api/site/{slug}/notifications`; fire-and-forget khi đổi status/shipping. PWA: `manifest.webmanifest` + minimal `sw.js`, đăng ký từ shop shell; tab install-app. Copy 5 locale. | ✅ Done |

| 2026-08-06 | **W2.3 / W2.4 / W2.5 / W2.6** (Phase 9 Batch 1) | Nav/footer: migration `nav_json`/`footer_json`, normalize schema, admin panel, shell fallback, PATCH `update_nav_footer` (409 nếu visual HTML). Undo-last: `change_note` trên reorder/theme + op `undo_last` restore revision mới nhất. Presets: +food-warm / commerce-minimal / soft-neutral (6 tổng). Brand sync: shell ưu tiên `theme_json`. | ✅ Done-MVP |

| 2026-08-06 | **S0.1 / S0.10 / M3.2 / M3.3 / M3.4** (Phase 9 Batch 3) | Domain card polish (DNS/SSL status + refresh). Currency `default_currency` + tracking đọc currency; hreflang self-tag theo locale. FAB `floatingCta` trong theme. Webhook/API key UI tái dùng outbound webhooks. Search aliases table + admin CRUD + prefer alias trong site search. Migrations `20260806140000`…`170000`. Test: `scripts/test-phase9-mvp-batch.ts`. | 🎯 **Phase 9 hoàn tất MVP** (W5.7/W5.8 vẫn 🚫) |

| 2026-08-06 | **Đóng Partial trừ Landing** | S0.7 contact FABs; W1.5 size guide PDP; S0.5 sitemap gốc; S0.6 shipping/return JSON-LD; M1.4 carrier label; W1.3 Done-MVP; W4.11 fashion facets; S0.3 Meta CAPI outbox + cron; W1.4 flash sale (không bundle). Migrations `20260806180000`…`220000`. Test: `scripts/test-close-partial-debts.ts`. | 🎯 Web chính Partial còn lại đóng MVP (Landing/Hub/tax-ship-tỉnh vẫn ngoài) |

<!-- Thêm dòng mới mỗi khi hoàn tất hoặc đổi phạm vi ID -->
