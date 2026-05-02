# Thử đồ & credits — tích hợp website đối tác

Tài liệu này bổ sung hướng dẫn cho đội kỹ thuật shop: **hai mô hình tính phí**, **API trả số dư**, **nạp credit**, và **đồng bộ tài khoản theo email**.  
Tham chiếu thêm: [MESSAGING_EMBED_PRODUCT_CONTEXT.md](../MESSAGING_EMBED_PRODUCT_CONTEXT.md) (chip ngữ cảnh sản phẩm), trang Bảng điều khiển → **Hướng dẫn API** (`/dashboard/api-integration`).

---

## Đã có gì trong hệ thống?

| Thành phần | Mô tả |
|------------|--------|
| `POST /api/v1/partner/try-on` | Thử đồ **server-side B2B**: `Authorization: Bearer <bí mật>`, multipart ảnh người + trang phục. Credits trừ vào **user billing** gắn với khóa (bảng `partner_try_on_clients`). |
| `POST /api/messaging/guest/{slug}/try-on` | Thử đồ trong **chat hosted / iframe**: credits trừ vào **phiên ví người dùng** (đăng nhập email NanoAI **hoặc** guest đã OTP + cookie/header). |
| `GET /api/account/credits` | Trả **số dư hiển thị** cho phiên ví hiện tại (cookie cùng origin NanoAI). |
| Luồng nạp tiền | `POST /api/account/payments` (tạo thanh toán / QR), sau khi webhook xác nhận → cộng credits vào **cùng user_id ví** đã resolve từ email / guest account. |

**Chưa có (tính đến thời điểm viết tài liệu):**

- API chỉ để **đọc số dư** bằng đúng **Partner try-on Bearer** (không gọi try-on). Shop có thể dùng `credits_remaining` từ **response** mỗi lần try-on B2B, hoặc xem số dư user billing trên dashboard NanoAI / liên hệ vận hành.
- `postMessage` từ iframe chat ra trang shop để **đồng bộ hiển thị số dư** trên domain shop — **chưa** có sẵn; khách xem/nạp credit trong UI NanoAI (iframe hoặc tab mới) là luồng được hỗ trợ đầy đủ.

---

## 1. Mô hình A — API B2B (`/api/v1/partner/try-on`)

**Ai trả tiền:** Tài khoản NanoAI **`billing_user_id`** được gắn khi NanoAI tạo bản ghi khóa (hash `SHA-256(UTF-8)` của bí mật). **Không** gắn ví từng khách cuối trên website shop.

**Request (rút gọn):** `multipart/form-data`

- `userImage` (bắt buộc)
- `garmentImage0`, `garmentImage1`, … hoặc `garmentCount` + `garmentImage{i}`
- Tuỳ chọn: `imageQuality` (`2K` \| `4K`), `gender` (`male` \| `female`), `customPrompt`

**Response thành công (JSON):**

```json
{
  "ok": true,
  "result_url": "https://…",
  "history_id": "uuid",
  "credits_remaining": 123.5
}
```

- **`credits_remaining`**: số dư credits **của billing user** sau lần trừ này — có thể dùng để **hiển thị tổng quota shop** trên backend nội bộ của đối tác nếu bạn cache/sync sau mỗi lần gọi.

**Lỗi thường gặp:**

- `401`: Bearer thiếu / sai / khóa không hoạt động.
- `402`: Message lỗi kiểu hết credits (nội dung có thể chứa “Không đủ credits”).
- `422`: Lỗi pipeline / ảnh không hợp lệ (không nhất thiết là hết credits).

**Bảo mật:** Chỉ gọi từ **backend shop**, không nhúng bí mật vào JS trình duyệt.

---

## 2. Mô hình B — Thử đồ trong chat (`/api/messaging/guest/{slug}/try-on`)

**Ai trả tiền:** User resolve qua `getUserForCreditAction` (cookie phiên NanoAI trên **domain host NanoAI**):

1. **Đăng nhập email** (JWT session), hoặc  
2. **Guest đã xác thực OTP** trong chat: cookie / header guest account, map sang **cùng một user ví** với email đó qua `nanoai_ensure_user_by_email`, hoặc  
3. **Dùng thử** (guest trial — giới hạn, xem `GET /api/account/credits`).

**Request:** Tương tự multipart; hỗ trợ thêm `garmentUrl{i}` (URL ảnh) trong chat.

**Response thành công (JSON):**

```json
{
  "ok": true,
  "resultUrl": "https://…",
  "historyId": "uuid",
  "deductedCredits": 1,
  "creditsRemaining": 42
}
```

Client chat gửi kèm `credentials: 'same-origin'` và header phiên khách (ví dụ `x-guest-session-id`, `x-guest-account-id`) như triển khai trong `partner-guest-chat-client.tsx`.

---

## 3. Đồng bộ tài khoản theo email

- Bảng `messaging_guest_accounts` lưu email đã xác thực OTP theo từng **partner**.
- Sau khi verify, hệ thống gọi logic tương đương **`nanoai_ensure_user_by_email(email)`** để có **`user_id`** ví trên Postgres.
- **Cùng một địa chỉ email** → **cùng một ví credits** dù khách:
  - chỉ OTP trong chat trên iframe, hoặc  
  - đăng nhập đầy đủ qua `/auth/login` trên NanoAI.

Nhờ vậy khách **nạp credit** sau khi đăng nhập email trên NanoAI vẫn **dùng được credits** khi quay lại chat (iframe) với cùng email đã xác thực trong luồng guest.

---

## 4. Hiển thị số dư credits trên web khách

### 4.1 Khách chỉ dùng iframe / trang hosted NanoAI (khuyến nghị)

- Giao diện chat đã có hiển thị số dư / nút nạp sau khi đăng nhập — **cùng origin** với API.
- Không cần shop đọc cookie NanoAI trên domain riêng.

### 4.2 Shop muốn hiển thị số dư trên **domain shop** (www.shop.com)

- Trình duyệt **không** gửi cookie NanoAI sang domain shop.
- Các hướng đi thực tế:
  - **UI trong iframe**: khách nhìn số dư trong khung chat (đã có).
  - **Mở tab NanoAI**: dùng `GET /api/account/credits` chỉ khi trang đang chạy **trên domain NanoAI** (sau khi đăng nhập).
  - **Tích hợp tùy chỉnh** (roadmap): bridge `postMessage` hoặc API riêng — **chưa** có sẵn trong repo hiện tại.

### 4.3 API `GET /api/account/credits`

- Gọi từ browser với `credentials: 'include'` trên **origin NanoAI**.
- Response ví dụ:

```json
{
  "balance": 15.5,
  "guestTrialRemaining": 0,
  "guestTrialBudget": 0,
  "isGuestTrial": false
}
```

- Khi `isGuestTrial: true`, `balance` có thể hiển thị `0` và phần dùng thử nằm ở `guestTrialRemaining` / `guestTrialBudget` (chi tiết theo `src/app/api/account/credits/route.ts`).

---

## 5. Nút “Nạp credit” trên website shop

Khách cần **phiên đăng nhập ví trên NanoAI** để nạp vào đúng user (cùng email như mục 3).

**Cách làm đơn giản — mở tab/focus NanoAI:**

| Mục đích | Ví dụ URL (thay `HOST` = domain NanoAI) |
|----------|----------------------------------------|
| Đăng nhập rồi vào dashboard (xem tổng credits) | `https://HOST/auth/login?next=/dashboard` |
| Mở chat shop để đăng nhập OTP + nạp trong UI chat | `https://HOST/messaging/p/{slug}` hoặc `…?embed=1` trong iframe |

Tham số `next` được sanitize server-side (`sanitizeLoginNext`) — chỉ dùng path nội bộ hợp lệ.

**Lưu ý:** Luồng tạo mã QR nạp tiền trong chat (`/api/account/payments`, v.v.) cũng yêu cầu **cùng cookie phiên ví** trên origin NanoAI — không thể gọi trực tiếp từ domain shop thuần tuý mà không có token/cookie chuyển giao (hiện không document SSO cross-domain).

---

## 6. Checklist cho đối tác

- [ ] Đã phân biệt rõ: **B2B try-on** (trừ ví shop) vs **try-on trong chat** (trừ ví khách).
- [ ] Không lộ **Partner Bearer** ra frontend.
- [ ] Nếu cần **số dư shop** realtime mà không gọi try-on: thống nhất với NanoAI (dashboard / hỗ trợ / endpoint tương lai).
- [ ] Nếu cần **số dư khách trên site shop**: ưu tiên **iframe chat** hoặc **deep link** đến NanoAI như mục 5.

---

## 7. File code tham chiếu (dev nội bộ)

- Partner try-on: `src/app/api/v1/partner/try-on/route.ts`
- Guest try-on: `src/app/api/messaging/guest/[slug]/try-on/route.ts`
- Credits: `src/app/api/account/credits/route.ts`
- Phiên ví: `src/lib/auth.ts` (`getWalletSessionUser`, `getUserForCreditAction`)
- Guest OTP / ví: `src/app/api/messaging/guest/[slug]/auth/email/*`
