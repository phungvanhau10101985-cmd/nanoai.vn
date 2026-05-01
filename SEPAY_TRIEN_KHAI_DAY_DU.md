# SePay — hướng dẫn triển khai đầy đủ (portable sang dự án khác)

Tài liệu này mô tả **cách dự án Thu-do-online** tích hợp SePay (Việt Nam): cấu hình, luồng dữ liệu, và bảng cơ sở dữ liệu. Bạn có thể đối chiếu để **áp vào Next.js/backend khác** hoặc bất kỳ stack có HTTP webhook + Postgres.

**Tham chiếu chính thức SePay**: [docs.sepay.vn](https://docs.sepay.vn) — luôn đối chiếu payload/signature phiên bản mới của SePay sau khi đọc tài liệu này.

---

## Mục lục

1. [Tổng quan hai luồng](#1-tổng-quan-hai-luồng)
2. [Cấu hình đầy đủ (checklist)](#2-cấu-hình-đầy-đủ-checklist)
3. [Biến môi trường `.env`](#3-biến-môi-trường-env)
4. [Database: bảng và ý nghĩa](#4-database-bảng-và-ý-nghĩa)
5. [Luồng nạp Credit (QR ví nội bộ)](#5-luồng-nạp-credit-qr-ví-nội-bộ)
6. [Webhook: URL, thứ tự xử lý, map trường](#6-webhook-url-thứ-tự-xử-lý-map-trường)
7. [Xác thực chữ ký (`SEPAY_SECRET_KEY`)](#7-xác-thực-chữ-ký-sepay_secret_key)
8. [Luồng Messaging / đặt đơn (multi-tenant webhook)](#8-luồng-messaging--đặt-đơn-multi-tenant-webhook)
9. [QR SePay và template](#9-qr-sepay-và-template)
10. [Đưa vào dự án khác — checklist](#10-đưa-vào-dự-khác--checklist)
11. [Test local và ngrok](#11-test-local-và-ngrok)

---

## 1. Tổng quan hai luồng

| Luồng | Mục đích | Webhook URL (ví dụ) | Sau khi khớp |
|-------|-----------|---------------------|---------------|
| **A. Nạp Credit** | User nạp tiền vào ví credit trên web | `POST https://<domain>/api/sepay-webhook` | `payments` → `completed`, cộng `credits`, thông báo user |
| **B. Đơn Messaging (widget)** | Shop nhận cọc/CK qua QR đơn hàng chat | `POST https://<domain>/api/sepay-webhook?partner=<partnerId>&token=<shopWebhookToken>` | Cập nhật trạng thái đơn partner, có thể gửi tin hệ thống vào chat |

Cùng **một route handler** trong code hiện tại nhưng phân nhánh theo có/không query `partner` + `token`.

---

## 2. Cấu hình đầy đủ (checklist)

### 2.1. SePay Dashboard

- Đăng nhập dashboard SePay (`sepay.vn`).
- **Webhook / IPN** trỏ tới một trong hai kiểu URL (tùy dùng luồng A hoặc B — có thể tạo 2 endpoint hoặc 1 endpoint có query cố định cho shop):
  - **Luồng A (nạp credit)**:  
    `https://<YOUR_DOMAIN>/api/sepay-webhook`
  - **Luồng B (đơn theo shop)**:  
    `https://<YOUR_DOMAIN>/api/sepay-webhook?partner=<UUID_PARTNER>&token=<TOKEN>`
- Sao chép **Merchant ID**, **Secret Key** (test/prod) vào `.env` server — xem [mục 3](#3-biến-môi-trường-env).

### 2.2. Máy chủ ứng dụng

- **HTTPS** công khai (SePay gọi từ internet).
- **Postgres** bật; `DATABASE_URL` đúng.
- Route `POST /api/sepay-webhook` (hoặc tương đương) **không bị CDN cache** động sai (POST thường không cache).

### 2.3. Ngân hàng nhận (luồng A)

- Có ít nhất một dòng **active** trong `public.payment_configs` (TK, mã NH SePay `bank_id`, template QR).
- Chỉnh qua UI admin trong Thu-do-online: **`/admin/payment-config`** (hoặc SQL trực tiếp).

### 2.4. Messaging / shop (luồng B)

- Bảng **`messaging_partner_payment_settings`** (sau migration) có: `sepay_enabled`, `sepay_bank_code`, `sepay_account_number`, `sepay_webhook_token`, `sepay_qr_template`, `sepay_secret_key` (tuỳ chọn).
- Webhook URL của SePay (hoặc kênh tương ứng) **khớp** `partner` + `token` mà backend kiểm tra.

---

## 3. Biến môi trường `.env`

Ví dụ chuẩn (copy từ `.env.example` dự án):

```env
# Server — webhook verify + (tuỳ) API merchant
SEPAY_MERCHANT_ID=SP-LIVE-XXXXXXXX
SEPAY_SECRET_KEY=spsk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SEPAY_API_URL=https://api.sepay.vn
SEPAY_REQUIRE_SIGNATURE=true

# Client (Next.js) — cách sinh «nội dung CK» hiển thị trên màn /dashboard/deposit
NEXT_PUBLIC_SEPAY_CONTENT_PREFIX=DH
NEXT_PUBLIC_SEPAY_CONTENT_SUFFIX_MIN_LENGTH=1
NEXT_PUBLIC_SEPAY_CONTENT_SUFFIX_MAX_LENGTH=10
```

| Biến | Phạm vi | Ý nghĩa |
|------|---------|--------|
| `SEPAY_MERCHANT_ID` | Server | Identifier merchant trên SePay (theo Dashboard). |
| `SEPAY_SECRET_KEY` | Server | Shared secret để kiểm tra HMAC chữ ký webhook (khớp Dashboard). |
| `SEPAY_API_URL` | Server | URL API SePay, mặc định `https://api.sepay.vn`. |
| `SEPAY_REQUIRE_SIGNATURE` | Server | `"true"` + đã có `SEPAY_SECRET_KEY` → nếu thiếu/sai signature thì webhook trả **401** (luồng A/B tuỳ nhánh — xem code). |
| `NEXT_PUBLIC_*` | Trình duyệt | Gói **`SEVQR <PREFIX><digits>`** trong nội dung QR nạp credit (frontend). Prefix chỉ `[A-Z0-9]`, độ dài suffix bị clamp 1–10. |

**Lưu ý**: `SEPAY_MERCHANT_ID` / `SEPAY_API_URL` có thể dùng cho tích hợp chủ động gọi API SePay — luồng webhook hiện tại chủ yếu dựa vào IPN và DB.

---

## 4. Database: bảng và ý nghĩa

### 4.1. `public.payment_configs`

Migration: `db/migrations/20260418120000_create_public_payment_configs.sql`.

Cột chính:

| Cột | Mô tả |
|-----|------|
| `bank_account` | STK nhận |
| `bank_id` | **Mã ngân hàng theo định dạng SePay** (ví dụ `MB`, `VCB`) — dùng trong URL QR |
| `bank_name` | Tên hiển thị |
| `account_holder_name` | (Tuỳ) chủ TK |
| `qr_template_url` | Template có placeholder `{bank_acc}`, `{bank_id}`, `{amount}`, `{content}`; mặc định có dạng `https://qr.sepay.vn/img?acc=…` |
| `is_active` | Chỉ bản active mới được `GET /api/payment-configs` trả ra |

### 4.2. `public.payments`

Migration: `db/migrations/20260418130000_create_public_payments.sql`.

| Cột | Mô tả |
|-----|------|
| `user_id` | Ai nạp (luồng A) |
| `amount` | **Số tiền VND** của lần CK (khớp chính xác với webhook) |
| `credits_added` | Số credit dự định cộng (client + server có thể dùng cùng công thức hiển thị; webhook trong code Thu-do-online tính lại credits từ `amount` và `CREDIT_UNIT_PRICE_VND`) |
| `transaction_content` | Nội dung CK mong đợi (chuẩn hóa UPPERCASE khi khớp) |
| `status` | `pending` → webhook đúng → `completed` |
| `qr_url` | URL ảnh QR đã hiển thị |
| `transaction_id` | ID từ SePay sau khi xử lý (idempotent) |
| `sepay_data` | Raw JSON webhook (audit) |

**Logic khớp** (Thu-do-online): một dòng `pending` có **`upper(trim(transaction_content))`** = nội dung SePay normalize và **`amount`** = `amount_in` webhook (exact numeric equality trong query repo).

Repo: `sepayFindPendingPaymentMatch(normalizedContentUpper, amountIn)` trong  
`src/lib/db/payments-repo.ts`.

### 4.3. Messaging — `messaging_partner_payment_settings`

Migration ví dụ:  
`db/migrations/20260410183000_messaging_payment_settings_sepay.sql`,  
`db/migrations/20260417093000_messaging_payment_settings_sepay_secret_key.sql`.

Cột SePay điển hình:

- `sepay_enabled`
- `sepay_bank_code`, `sepay_account_number`
- `sepay_qr_template` ∈ `''`, `compact`, `qronly`
- `sepay_webhook_token` — bắt buộc khớp query `token` trên webhook (luồng B)
- `sepay_secret_key` — tuỳ shop để verify HMAC riêng, fallback `.env`

---

## 5. Luồng nạp Credit (QR ví nội bộ)

Tệp frontend: `src/app/dashboard/deposit/deposit-client.tsx`.

1. **`GET /api/payment-configs`** → danh sách TK `is_active=true`.
2. User chọn tiền, ngân hàng → client sinh **`transaction_content`** dạng:  
   `SEVQR <PREFIX><digits>`  
   trong đó PREFIX từ `NEXT_PUBLIC_SEPAY_CONTENT_PREFIX` (sanitize A–Z 0–9, tối đa 5 ký tự), phần số pad theo chiều dài suffix.
3. Client dựng **URL QR**: `buildSePayQrImgUrl` hoặc thay trong `qr_template_url` của DB (`{bank_acc}` …).

Tệp: `src/lib/sepay-qr.ts` — QR chính là  
`https://qr.sepay.vn/img?acc=&bank=&amount=&des=` (+ `template` nếu cần).

4. **`POST /api/account/payments`** (`src/app/api/account/payments/route.ts`) với JSON:
   - `amount`, `credits_added`, `transaction_content`, `bank_account`, `bank_name`, `qr_url`  
   → insert **`payments`** status `pending`.

5. User **CK đúng số tiền + đúng nội dung**.

6. SePay gửi **`POST /api/sepay-webhook`** (luồng A, không query `partner`).

7. Server tìm `pending` khớp nội dung + số tiền → `addCreditsToUser` → `sepayMarkPaymentCompleted` → thông báo.

**Giá 1 credit (VND)** trong code Thu-do-online: **`CREDIT_UNIT_PRICE_VND = 6000`** (`src/lib/credit-unit-price.ts`). Credits cộng: `floor(amountIn / CREDIT_UNIT_PRICE_VND)` (đúng trong `sepay-webhook`).

---

## 6. Webhook: URL, thứ tự xử lý, map trường

Implement: **`src/app/api/sepay-webhook/route.ts`** (Next.js Route Handler).

### 6.1. Entry

- **`POST`**: nhận `Content-Type` `application/json` **hoặc** `application/x-www-form-urlencoded` (`URLSearchParams`).
- Body được đọc dạng **text thô (`request.text()`** để verify HMAC khớp với payload gốc.

### 6.2. Chuẩn hóa các trường (tóm tắt)

Logic code:

- **`amount_in`**: từ `amount`, `amount_in`, `total_amount`, `transferAmount`, …
- **Nội dung CK**: từ `transaction_content`, `content`, `description` — **`extractTransferContent()`** cố nhận dạng `SEVQR ...`; hoặc từ `code` normalized thành `SEVQR ...`
- **`transaction_id`**: idempotency, tránh xử lý trùng
- **`transaction_status`** / **`status`**: chỉ xử lý khi không có hoặc `success` / `completed`

### 6.3. Thứ tự nhánh (quan trọng)

1. Parse body, validate có `amount` > 0 và có **`transaction_content` / code** normalize được.
2. Nếu có **`transaction_id`** đã tồn tại và payment `completed` → trả thành công (duplicate).
3. Gọi `sepayFindPendingPaymentMatch` (luôn có cho luồng A).
4. Nếu URL có **`?partner=...&token=...`**:
   - Tìm đơn partner **theo partner + payment_reference** khớp nội dung normalized.
   - Verify **token** cố định của shop với DB.
   - Verify **signature**: ưu tiên `order.sepay_secret_key` rỗng thì dùng `SEPAY_SECRET_KEY` env.
   - So khớp STK nhận / số tiền đơn → cập nhật đơn, insert message chat, enqueue sheet, email… **`return`** (không chạy cộng credit ví).
5. Ngược lại (luồng A): verify signature **global**, tìm lại **`pending`** nếu có, `addCreditsToUser`, `sepayMarkPaymentCompleted`, notify.

---

## 7. Xác thực chữ ký (`SEPAY_SECRET_KEY`)

Implement: **`verifySePaySignature(rawBody, secretKey, signature)`** trong route — HMAC SHA-256 của **chuỗi body thô** `rawBody`:

- Digest so sánh với **`hex`** (lowercase không phân biệt)  
  hoặc **`base64`** (chuỗi signature truyền lên).

Header tìm theo thứ tự:

```text
x-sepay-signature, signature, Hoặc trường body.signature (tuỳ payload)
```

Nếu **`SEPAY_SECRET_KEY` có nhưng không có signature** và `SEPAY_REQUIRE_SIGNATURE=true` → **401**.

**Lưu ý mang sang stack khác**: phải dùng **cùng chuỗi byte UTF-8** mà SePay ký — thường là body JSON string nguyên bản không re-format.

---

## 8. Luồng Messaging / đặt đơn (multi-tenant webhook)

- Webhook có query: **`partner`** = UUID partner trong DB và **`token`** = `sepay_webhook_token` lưu cùng partner.
- `sepay_secret_key` tại shop được dùng verify HMAC nếu set; không thì dùng global env.
- **Không** tạo bản `payments` nạp credit cho luồng này trong đoạn xử lý hiện tại — chỉ cập nhật **đơn** và messaging.

Để port sang project khác: tách một **middleware** “resolve tenant token” riêng, rồi gọi service domain “mark order paid”.

---

## 9. QR SePay và template

- **Official pattern ảnh QR**: có trong comment `src/lib/sepay-qr.ts` và hàm `buildSePayQrImgUrl`.
- **`qr_template_url`**: cho phép tùy biến host/path miễn sau khi replace placeholder vẫn parse được `URL` và set lại đủ query `acc`, `bank`, `amount`, `des` (fallback về helper nếu lỗi).

---

## 10. Đưa vào dự khác — checklist

- [ ] Tạo bảng tương đương `payment_configs` + `payments` (hoặc gộp tên khác nhưng giữ **khóa khớp**: `(normalized_content + amount)` trên pending).
- [ ] một **GET public** chỉ expose config bank + template (không lộ secrets).
- [ ] **POST** tạo yêu cầu CK `pending`, lưu `transaction_content`, `amount` chính xác user sẽ ck.
- [ ] **`POST webhook`**: đọc `rawBody` → verify sig → normalize fields → match pending → atomic “mark paid + credits” trong transaction DB nếu cần.
- [ ] `transaction_id` idempotent.
- [ ] Logs + `sepay_data` JSON để dispute.
- [ ] Prod: **`SEPAY_REQUIRE_SIGNATURE=true`** sau khi test xong.
- [ ] Đặt **`CREDIT_UNIT_PRICE_VND`** (hoặc tương đương) nhất quán giữa UI và webhook.

---

## 11. Test local và ngrok

- SePay **không** gửi được tới `http://localhost:3000`; bắt buộc **tunnel HTTPS** (`ngrok`, Cloudflare Tunnel, …).
- Dự án có thêm **`SEPAY_WEBHOOK_NGROK_GUIDE.md`** và **`test-ngrok-webhook.ps1`**.
- **Smoke test webhook**:  
  `GET https://<base>/api/sepay-webhook` → JSON báo endpoint chạy (implementation Thu-do-online).

Payload test thủ công phải:

- **`amount`** khớp số đã post khi tạo `pending`;
- **`description`/`transaction_content`/…** chứa cùng nội dung đã lưu (sau uppercase trim như code);
- **`status`** `success` / `completed`;
- **`transaction_id`** unique mỗi lần thử full flow.

---

## Bảng đối chiếu file trong Thu-do-online

| File | Việc |
|------|------|
| `src/app/api/sepay-webhook/route.ts` | Webhook POST/GET |
| `src/lib/db/payments-repo.ts` | Query payment configs, pending match, hoàn thành |
| `src/app/api/account/payments/route.ts` | Tạo pending |
| `src/app/api/payment-configs/route.ts` | Public list active configs |
| `src/lib/sepay-qr.ts` | Build URL QR |
| `src/app/dashboard/deposit/deposit-client.tsx` | UX + sinh `SEVQR …` |
| `src/app/admin/payment-config/*` | CRUD configs |
| `.env.example` | Mẫu env |
| `db/migrations/*payment*` | Schema |

---

*Tài liệu được căn chỉnh theo mã nguồn tại nhánh chứa file này; khi fork cho dự án khác, giữ khớp **hợp đồng** SePay và **tính nhất quán** giữa số tiền / nội dung CK và hàng chờ webhook.*
