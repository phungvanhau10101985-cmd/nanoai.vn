# Nhúng chat & bắt context sản phẩm (SKU, ảnh, URL, `inventory_id`)

Trang chat hosted: `/messaging/p/{slug}?embed=1`.

Script nổi: `public/embed/nanoai-chat-widget.js` — khi khách mở khung chat, script **tự gắn query** lên URL iframe để trang chat đọc được **sản phẩm đang xem** và hiện chip **«Gửi mã SP đang xem»** (khách bấm để gửi ngữ cảnh vào hội thoại).

## 1. Luồng dữ liệu (tóm tắt)

1. Trang **shop** (parent) mở iframe `data-chat-url`.
2. Widget gọi `extractPageContext()` → object `{ sku?, imageUrl?, imageUrl2?, productUrl?, inventoryId? }`.
3. `buildChatUrlWithContext()` thêm vào URL iframe:
   - `ctx_sku`
   - `ctx_image`, `ctx_image_2`
   - `ctx_product_url`
   - `ctx_inventory` (UUID hàng trong kho partner)
   - `ctx_source=widget_page` (khi có ít nhất một trường trên)

4. Client chat (`partner-guest-chat-client.tsx`) đọc `URLSearchParams`, chuẩn hóa → chip gửi SP đang xem.

## 2. Cách A — Đặt `data-ctx-*` trên thẻ `<script>` NanoAI (khuyên dùng)

Server-render các thuộc tính động trên **cùng** thẻ script load widget (trang chi tiết SP):

```html
<script
  src="https://YOUR-NANOAI-HOST/embed/nanoai-chat-widget.js"
  data-chat-url="https://YOUR-NANOAI-HOST/messaging/p/ten-shop?embed=1"
  data-shop-name="Tên shop"
  data-logo-url="https://…/logo.png"
  data-ctx-sku="SKU-188-001"
  data-ctx-image="https://cdn…/thumb-san-pham.jpg"
  data-ctx-image-2="https://cdn…/anh-khac.jpg"
  data-ctx-product-url="https://188.com.vn/san-pham/abc"
  data-ctx-inventory="550e8400-e29b-41d4-a716-446655440000"
  defer
></script>
```

| Thuộc tính | Bắt buộc | Ghi chú |
|------------|----------|---------|
| `data-ctx-sku` | Không | SKU / mã SP hiển thị cho khách. |
| `data-ctx-image` | Không | URL ảnh đại diện (HTTPS). Tránh URL file video (.mp4 …). |
| `data-ctx-image-2` | Không | Ảnh phụ. |
| `data-ctx-product-url` | Không | Nếu không set, widget fallback `link[rel=canonical]` hoặc URL hiện tại. |
| `data-ctx-inventory` | Không | UUID đúng một dòng trong kho partner (đã sync Open Catalog / import). |

**Next.js / React:** render script trong layout trang SP, truyền `product.sku`, `product.images[0]` từ props.

**SPA:** SSR cho `data-ctx-*` là đơn giản nhất. Nếu chỉ CSR, có thể remount widget khi `productId` đổi (xóa root `#nanoai-chat-widget-v1` và inject script mới).

## 3. Cách B — Khớp selector DOM mặc định của widget

Nếu **không** set `data-ctx-*` (hoặc chỉ thiếu một phần), widget quét:

- **Mã SP:** `#copy-code-product` hoặc selector chứa `copy-code-product`.
- **Ảnh:** `img` trong `.image_list`, `.image-list`, hoặc class có `image_list` / `image-list`.

Theme không khớp → thêm `id`/`class` tương ứng trên HTML sản phẩm hoặc dùng Cách A.

## 4. Ẩn SKU — `#nanoai-ctx-sku`

```html
<span id="nanoai-ctx-sku" hidden>SKU-MY-DRESS-01</span>
```

Có thể dùng kết hợp với `data-ctx-image`, v.v.

## 5. Nút thử đồ nhúng (đặt mọi vị trí — PDP, block HTML, v.v.)

**Lấy mã có sẵn (đã điền slug shop):** Bảng điều khiển → **Hướng dẫn API** (`/dashboard/api-integration`) — mục **«A2 — Nút thử đồ nhúng»**: chọn shop, chỉnh nút / chữ hiển thị, bấm **Sao chép mã nhúng nút thử đồ**.

Tệp: `public/embed/nanoai-try-on-widget.js`. Cơ chế giống widget chat: có thể **nổi góc màn hình** hoặc **inline** ngay chỗ đặt `<script>`.

- URL iframe luôn gồm `embed=1` và **`open_try_on=1`** → trong chat hosted, panel **Thử đồ** mở sẵn (cùng luồng đăng nhập / credits / ảnh trang phục như trong chat).
- Ngữ cảnh SP: **cùng** các `data-ctx-*` và quét DOM như mục 2–3 (`#nanoai-ctx-sku`, `.image_list` …).

**Ví dụ — nút nổi (mặc định):**

```html
<script
  src="https://YOUR-NANOAI-HOST/embed/nanoai-try-on-widget.js"
  data-try-on-url="https://YOUR-NANOAI-HOST/messaging/p/ten-shop"
  data-shop-name="Tên shop"
  data-label="Thử đồ ngay"
  data-ctx-sku="SKU-188-001"
  data-ctx-image="https://cdn…/thumb.jpg"
  data-ctx-product-url="https://shop.example/p/abc"
  data-ctx-inventory="550e8400-e29b-41d4-a716-446655440000"
  data-ui-locale="vi"
  defer
></script>
```

**Ví dụ — nút inline (trong luồng nội dung trang SP):** thêm `data-mode="inline"`. Nút hiện **ngay sau** thẻ script; bấm mở khung iframe như widget nổi.

| Thuộc tính | Bắt buộc | Ghi chú |
|------------|----------|---------|
| `data-try-on-url` | Có | Base URL trang chat shop, ví dụ `https://HOST/messaging/p/slug` (không cần tự thêm `embed`/`open_try_on`). |
| `data-mode` | Không | `floating` (mặc định) hoặc `inline`. |
| `data-label` | Không | Chữ trên nút (mặc định «Thử đồ»). |
| `data-ui-locale` | Không | `vi` \| `en` \| `zh` \| `ja` \| `ko`. |
| `data-widget-id` | Không | Mặc định `nanoai-try-on-widget-v1` — đổi nếu nhúng **nhiều** widget / nhiều script. |
| `data-side`, `data-bottom`, `data-width`, `data-height`, … | Không | Tương tự widget chat (chỉ mode floating). |

Có thể **dùng song song** script chat và script thử đồ trên cùng trang (đặt `data-widget-id` khác nhau nếu cần). `postMessage` `NAVIGATE_TOP` từ iframe (mở SP trên tab shop) hoạt động giống widget chat.

## 6. Kiểm tra

Sau khi bấm mở chat, URL iframe (Network → document của iframe) nên chứa `ctx_sku` / `ctx_image` / … nếu context đã bắt được.

**Thử đồ:** bấm nút thử đồ → iframe request có `open_try_on=1` (tham số có thể bị xóa khỏi thanh địa chỉ ngay sau khi load để tránh mở lại khi refresh trong iframe).

---

Tệp widget: `public/embed/nanoai-chat-widget.js`  
Widget thử đồ: `public/embed/nanoai-try-on-widget.js`  
Đọc query phía chat: `src/app/messaging/p/[slug]/partner-guest-chat-client.tsx`

**Thử đồ, credits, nạp tiền & đồng bộ email (tích hợp web shop):** xem [docs/PARTNER_TRY_ON_CREDITS_INTEGRATION.md](docs/PARTNER_TRY_ON_CREDITS_INTEGRATION.md).
