# Chrome dùng chung khi tạo giao diện shop

Áp dụng **mọi giao diện shop sau**: template mới, Sửa nhanh, `/site/{slug}`, React shop, HTML visual — mọi ngành, mọi tenant. Không chỉ shop 188.

Landing chiến dịch (Ladipage) là sản phẩm riêng: không ép thanh đáy shop. Nếu LP tái dùng `pw-header` / `pw-footer` thì vẫn một khung, không nhân chrome theo từng LP.

Rule Cursor: `.cursor/rules/partner-website-shared-chrome.mdc`.

## Nguyên tắc

Cửa hàng là **một khung + nhiều trang giữa**, và **bốn máy độc lập về sắp xếp**.

| Khối | Cùng máy (mọi trang) | Khác máy (Desktop / Laptop / Tablet / Mobile) |
|---|---|---|
| Nút tính năng header / footer / thanh đáy | **Giống nhau** — copy từ trang chủ máy đó | **Cùng loại nút**; vị trí/kích thước **độc lập** |
| Sắp xếp logo, kéo thả phần tử | **Giống trang chủ máy đó** | **Không copy** — sửa desktop không đụng mobile |
| Phần giữa (hero, catalog, form…) | **Khác theo trang** | **Độc lập theo máy** |
| Thanh đáy | Hiện + dính đáy khi `<1280px` | Desktop `≥1280` ẩn |

Sửa header trang chủ **Desktop** → mọi trang Desktop copy y hệt. File `*.laptop.html` / `*.tablet.html` / `*.mobile.html` giữ layout riêng.

Sửa header trang chủ **Mobile** → mọi trang Mobile copy y hệt. Desktop không đổi.

## HTML bắt buộc

Sinh template hoặc AI shell phải ra đúng khung này. Phần giữa để trống hoặc điền section trang đó.

```html
<body data-pw-page="home">
  <header class="pw-header" data-pw-region="header">…</header>
  <main id="pw-main"><!-- chỉ nội dung trang này --></main>
  <footer class="pw-footer" data-pw-region="footer">…</footer>
  <nav class="pw-bottom-nav" data-pw-region="nav" aria-label="Mobile">…</nav>
</body>
```

React (trang platform chưa có HTML visual): `PartnerSiteShopShell` bọc `children` — cùng ý.

## Code nền tảng — tái sử dụng, không copy

| Việc | File |
|---|---|
| HTML header + thanh đáy | `src/lib/partner-website/shop/build-partner-site-header-html.ts` |
| HTML footer (template) | `renderFooter` trong `src/lib/partner-website/template/render-template-html.ts` |
| React chrome | `src/components/partner-website/shop/partner-site-shop-shell.tsx` |
| CSS thanh đáy / header sticky | `src/lib/partner-website/shop/partner-shop-chrome-layout-css.ts` |
| Đồng bộ khi Lưu Sửa nhanh | `syncSharedChromeAcrossProjectFiles` trong `src/lib/partner-website/shop/sync-shared-chrome.ts` |
| Overlay khi mở / xem trang | `withCanonicalSharedChrome` trong `src/lib/partner-website/visual-editor/visual-editor-pages.ts` |

Bốn bản file `*.html` / `*.laptop.html` / `*.tablet.html` / `*.mobile.html` **tách cả phần giữa lẫn layout chrome**. Engine chỉ copy chrome **trong cùng một máy** (`index.html` → `about.html`; `index.laptop.html` → `about.laptop.html`). Không dán header desktop lên file laptop/mobile.

## Breakpoint thanh đáy

- Hiện + `position: fixed; bottom: 0` khi `max-width: 1279px` (`VISUAL_DESKTOP_MIN_PX` = 1280).
- Ẩn khi `min-width: 1280px`.
- Preview Sửa nhanh: Mobile 390px, Tablet 768px, Laptop 1280px, Desktop ≥1440px. Mobile + Tablet phải thấy thanh đáy dính đáy khung.
- Template mới **không** ẩn thanh đáy ở `max-width: 899px` rồi quên tablet.

## Checklist trước khi báo xong giao diện mới

- [ ] Mọi trang **cùng máy** có cùng header / footer (cùng nút, logo, link của máy đó).
- [ ] Sửa sắp xếp logo Desktop **không** đổi vị trí logo Mobile (và ngược lại).
- [ ] Nút tính năng (giỏ, tài khoản, tìm, **Chat mua**) có trên cả bốn máy; vị trí từng máy độc lập.
- [ ] Chat mua = `data-pw-chrome-btn="chat"` + `data-nanoai-open-chat` + logo shop (`.pw-chrome-chat-logo`). Không có `.pw-fab-chat` / icon nhúng NanoAI.
- [ ] Mobile và tablet: thanh đáy dính đáy màn, cùng icon/link **của máy đó**.
- [ ] Desktop không hiện thanh đáy; header + footer vẫn khớp các trang khác.
- [ ] Chỉ `<main>` / vùng giữa khác theo trang.
- [ ] Class `pw-header` / `pw-footer` / `pw-bottom-nav` (hoặc `pw-shop-*`) — engine mới sync được.
- [ ] Không hardcode hex thương hiệu; màu từ `--pw-*`.
- [ ] Sửa nhanh Mobile = Xem `?pw-device=mobile`; Tablet = `pw-device=tablet`; Laptop = `pw-device=laptop`; Desktop = `pw-device=desktop`.

## Không làm

- Header riêng cho About, giỏ, tài khoản.
- Thanh đáy chỉ có trên home mobile, thiếu trên tablet / trang khác.
- `@media (max-width: 899px)` làm điểm ẩn/hiện thanh đáy (tablet 768–1279 sẽ mất thanh).
- Nhân đôi HTML chrome trong từng file trang **cùng một máy** rồi quên đồng bộ — Lưu Sửa nhanh đã gọi `syncSharedChromeAcrossProjectFiles` (chỉ trong cùng device).
- Copy nguyên header Desktop sang Mobile khi chỉ cần thêm nút tính năng còn thiếu.
