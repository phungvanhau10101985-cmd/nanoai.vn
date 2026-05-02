# Thử đồ & credits — tích hợp website đối tác

Tài liệu này dành cho đội kỹ thuật shop: **tích hợp API thử đồ B2B lên backend web**, **hai mô hình tính phí**, **credits**, **nạp tiền**, và **đồng bộ tài khoản theo email**.  
Tham chiếu thêm: [MESSAGING_EMBED_PRODUCT_CONTEXT.md](../MESSAGING_EMBED_PRODUCT_CONTEXT.md) (nhúng chat + `data-ctx-*` sản phẩm), trang Bảng điều khiển → **Hướng dẫn API** (`/dashboard/api-integration`, mục E).

---

## Tích hợp API thử đồ lên website shop (`POST /api/v1/partner/try-on`) {#partner-try-on-web}

API **đủ thông tin** để tạo **một ảnh thử đồ** (ảnh người + một hoặc nhiều ảnh trang phục mẫu). Luồng chuẩn: **trình duyệt khách** → **backend cửa hàng** (PHP/Node/Python/…) → **NanoAI** — **không** gọi trực tiếp từ JS trình duyệt vì cần `Bearer` bí mật.

### Endpoint

- **URL:** `https://<HOST-NANOAI>/api/v1/partner/try-on`
- **Phương thức:** `POST`
- **Headers:**
  - `Authorization: Bearer <PARTNER_SECRET>` (bí mật do NanoAI cấp, gắn ví `billing_user_id`)
- **Body:** `multipart/form-data` (chỉ nhận **file**, không hỗ trợ `garmentUrl*` như API chat)
- **Thời gian xử lý:** có thể tới **~120 giây** — HTTP client nên đặt timeout **≥ 130s** (hoặc tách job bất đồng bộ ở phía shop nếu cần).

### Tham số form

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| `userImage` | **Có** | File ảnh: **một người** trong khung, làm mẫu để giữ mặt/tư thế/nền. Nên JPEG/PNG/WebP; kích thước hợp lý (vài MB). |
| `garmentImage0`, `garmentImage1`, … | Một trong hai cách | Ít nhất **một** ảnh trang phục (mẫu mặc sản phẩm). Thứ tự: `0` là chiếc đầu tiên. Tối đa **12** ảnh. |
| `garmentCount` | Không | Nếu set (số nguyên dương): chỉ đọc `garmentImage0` … `garmentImage{count-1}` trong phạm vi min(count, 12). Nếu **không** set: quét `garmentImage0` … `garmentImage11`, lấy các file không rỗng theo thứ tự. |
| `imageQuality` | Không | `2K` (mặc định) hoặc `4K`. **4K** tốn **~2,2×** credits so với 2K (xem dưới). |
| `gender` | Không | `male` (mặc định) hoặc `female` — gợi ý model về giới tính người trong ảnh. |
| `customPrompt` | Không | Ghi chú thêm (tiếng Việt hoặc khác); server **chuẩn hóa sang tiếng Anh** trước khi đưa vào prompt. Giữ ngắn, tránh PII nhạy cảm. |

**Lưu ý thứ tự:** Nhiều ảnh trang phục được hiểu là **nhiều lớp / nhiều mảnh** theo thứ tự gửi; thường shop chỉ cần **một** `garmentImage0` là ảnh sản phẩm trên PDP.

### Credits mỗi lần gọi (mô hình B2B)

- Giá cơ sở một lượt **một người** (`2K`): **1** credit (hằng số `tryOnCostMap.single` trong code).
- `4K`: **1 × 2,2 = 2,2** credits (làm tròn hiển thị theo hệ thống ví).
- Trừ vào **user billing** đã gắn với khóa partner (không phải ví từng khách cuối).

### Response thành công (`200`, JSON)

```json
{
  "ok": true,
  "result_url": "https://…",
  "history_id": "uuid",
  "credits_remaining": 123.5
}
```

| Trường | Ý nghĩa |
|--------|---------|
| `result_url` | URL **HTTPS** ảnh kết quả; có thể hiển thị cho khách hoặc tải về qua backend shop (tránh lộ `Bearer`). |
| `history_id` | ID bản ghi lịch sử phía NanoAI — hữu ích khi tra soát / hỗ trợ. |
| `credits_remaining` | Số dư credits **sau khi trừ** lượt này; có thể cache trên server shop để hiển thị quota nội bộ. |

### Lỗi (JSON thường có `ok: false` và `error`)

| HTTP | Tình huống |
|------|------------|
| `400` | Thiếu / sai `multipart` (thiếu `userImage`, không có garment, body không phải form). |
| `401` | Thiếu `Bearer`, sai secret, hoặc khóa không hoạt động. |
| `402` | **Hết credits** (thông báo thường chứa «Không đủ credits»). |
| `422` | Pipeline / ảnh không hợp lệ / lỗi Vision-Gemini (không chỉ hết tiền). |
| `500` | Lỗi máy chủ. |
| `503` | DB chưa cấu hình hoặc không tra cứu được khóa. |

### Ví dụ gọi API

**curl**

```bash
curl -sS -X POST "https://HOST/api/v1/partner/try-on" \
  -H "Authorization: Bearer YOUR_PARTNER_SECRET" \
  -F "userImage=@./customer.jpg" \
  -F "garmentImage0=@./product-front.jpg" \
  -F "garmentImage1=@./product-back.jpg" \
  -F "imageQuality=2K" \
  -F "gender=female" \
  -F "customPrompt=Giữ dáng áo sát người, không đổi độ dài váy"
```

**Node.js (undici `fetch` + `FormData`)**

```javascript
import { readFile } from 'node:fs/promises'

const host = 'https://HOST'
const secret = process.env.NANOAI_TRY_ON_SECRET

const fd = new FormData()
fd.append('userImage', new Blob([await readFile('customer.jpg')]), 'customer.jpg')
fd.append('garmentImage0', new Blob([await readFile('product.jpg')]), 'product.jpg')
fd.append('imageQuality', '2K')
fd.append('gender', 'female')

const res = await fetch(`${host}/api/v1/partner/try-on`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
  body: fd,
  signal: AbortSignal.timeout(130_000),
})
const json = await res.json()
if (!res.ok) throw new Error(json.error || res.statusText)
// json.result_url → trả về cho frontend hoặc proxy tải ảnh
```

**Python (`requests`)**

```python
import os, requests
r = requests.post(
    "https://HOST/api/v1/partner/try-on",
    headers={"Authorization": f"Bearer {os.environ['NANOAI_TRY_ON_SECRET']}"},
    files={
        "userImage": open("customer.jpg", "rb"),
        "garmentImage0": open("product.jpg", "rb"),
    },
    data={"imageQuality": "2K", "gender": "female"},
    timeout=130,
)
r.raise_for_status()
data = r.json()
assert data["ok"]
print(data["result_url"], data["credits_remaining"])
```

### Gợi ý tích hợp sản phẩm

1. **Ảnh người (`userImage`):** upload từ form; nhắc khách **một người**, mặt/nửa người rõ, ánh sáng tốt.
2. **Ảnh sản phẩm (`garmentImage*`):** lấy từ CDN/ảnh PDP (server shop tải file rồi forward dưới dạng part — API B2B **không** nhận URL trực tiếp).
3. **Bảo mật:** route shop chỉ nhận session khách; route đó mới gọi NanoAI bằng secret.
4. **Idempotency:** mỗi `POST` là **một** lượt tạo ảnh + **trừ credits**; lỗi mạng có thể cần kiểm tra `history_id` / log phía NanoAI trước khi gọi lại.

### Khác với thử đồ trong chat

- Chat: `POST /api/messaging/guest/{slug}/try-on` — cookie/phiên khách, có thêm `garmentUrl0`… (URL ảnh), tối đa **4** garment, không dùng `gender`/`customPrompt` như B2B.
- B2B: chỉ **file**, tới **12** garment, có `gender` + `customPrompt`.

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

**Tóm tắt:** Trừ credits vào **`billing_user_id`** gắn với khóa (hash SHA-256 của secret). **Chi tiết đầy đủ** (bảng tham số, ví dụ Node/Python, mã lỗi, kiến trúc, khác chat): xem mục **[Tích hợp API thử đồ lên website shop](#partner-try-on-web)** đầu tài liệu.

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

- [ ] Đã đọc mục **[Tích hợp API thử đồ lên website shop](#partner-try-on-web)** (tham số, timeout, ví dụ backend).
- [ ] Đã phân biệt rõ: **B2B try-on** (trừ ví shop) vs **try-on trong chat** (trừ ví khách).
- [ ] Không lộ **Partner Bearer** ra frontend.
- [ ] HTTP client backend đặt **timeout ≥ 130s** (hoặc job bất đồng bộ) cho `POST /api/v1/partner/try-on`.
- [ ] Nếu cần **số dư shop** realtime mà không gọi try-on: thống nhất với NanoAI (dashboard / hỗ trợ / endpoint tương lai).
- [ ] Nếu cần **số dư khách trên site shop**: ưu tiên **iframe chat** hoặc **deep link** đến NanoAI như mục 5.

---

## 7. File code tham chiếu (dev nội bộ)

- Partner try-on: `src/app/api/v1/partner/try-on/route.ts`
- Guest try-on: `src/app/api/messaging/guest/[slug]/try-on/route.ts`
- Credits: `src/app/api/account/credits/route.ts`
- Phiên ví: `src/lib/auth.ts` (`getWalletSessionUser`, `getUserForCreditAction`)
- Guest OTP / ví: `src/app/api/messaging/guest/[slug]/auth/email/*`
