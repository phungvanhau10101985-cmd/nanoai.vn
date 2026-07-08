# Đồng bộ tên khách hàng từ web 188 → Inbox NanoAI Messaging

Tài liệu này dành cho **đội kỹ thuật 188.com.vn**: cách truyền **email + tên khách đã đăng nhập** sang widget chat NanoAI để inbox shop hiển thị đúng tên (thay vì `Guest · 188.com.vn` cho mọi hội thoại).

**Phạm vi:** Chỉ liên quan luồng **chat nhắn tin / tư vấn** (widget `nanoai-chat-widget.js`). Không ảnh hưởng API thử đồ B2B hay backend catalog 188.

**Tham chiếu thêm trên NanoAI:** Bảng điều khiển → **Hướng dẫn API** (`/dashboard/api-integration`) → mục **Đăng nhập tự động — khách đã login web shop**.

---

## 1. Vấn đề cần giải quyết

| Trạng thái | Inbox shop NanoAI hiển thị |
|------------|----------------------------|
| Khách **chưa** login 188 | `Guest · 188.com.vn` — **đúng, giữ nguyên** |
| Khách **đã** login 188 nhưng **chưa** truyền token | `Guest · 188.com.vn` — **sai** |
| Khách đã login + truyền token có `name` | `Nguyễn Văn A · 188.com.vn` — **mục tiêu** |
| Token chỉ có `email`, không có `name` | `nguyenvana · 188.com.vn` (phần trước `@`) — chấp nhận được nhưng nên có `name` |

NanoAI **không đọc cookie/session login của 188**. Web 188 phải chủ động gửi **token khách đã ký trên server**.

---

## 2. Luồng tích hợp (tóm tắt)

```
[Server 188]  Ký token (email + name + exp + sig) bằng Embed Key
      ↓
[HTML/JS 188] Truyền token vào widget (data-partner-customer-token hoặc setCustomer)
      ↓
[Widget]      Mở iframe chat NanoAI, đính kèm token
      ↓
[Iframe]      POST /api/messaging/guest/{slug}/auth/partner-site  { "token": "..." }
      ↓
[NanoAI]      Lưu profile + gắn hội thoại + cập nhật tên inbox
```

**188 không cần gọi API `auth/partner-site` bằng tay** nếu dùng script widget chuẩn — iframe tự gọi khi mở chat.

---

## 3. Chuẩn bị

### 3.1. Embed Key (bắt buộc)

- Lấy từ NanoAI: **Messaging → Cài đặt** hoặc **Bảng điều khiển → Hướng dẫn API** (khối khóa workspace).
- Định dạng: UUID, ví dụ `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.
- Lưu biến môi trường **server** 188, ví dụ:
  - `NANOAI_EMBED_KEY=<uuid>`
- **Không** đặt embed key trong bundle JS public, không commit vào git công khai.

### 3.2. Slug shop trên NanoAI

- URL chat công khai dạng: `https://<HOST-NANOAI>/messaging/p/<slug>?embed=1`
- Ví dụ slug shop 188: `188-com-vn` (xác nhận trên dashboard NanoAI).

### 3.3. Script widget (đã nhúng trên 188)

```html
<script
  src="https://<HOST-NANOAI>/embed/nanoai-chat-widget.js"
  data-chat-url="https://<HOST-NANOAI>/messaging/p/<slug>?embed=1"
  defer
></script>
```

---

## 4. Định dạng token

Token = **base64url** của một JSON object.

### 4.1. Payload (trước khi encode)

```json
{
  "email": "khach@example.com",
  "name": "Nguyễn Văn A",
  "phone": "0901234567",
  "exp": 1730000300,
  "sig": "64-ký-tự-hex-hmac-sha256"
}
```

| Trường | Bắt buộc | Giới hạn | Ghi chú |
|--------|----------|----------|---------|
| `email` | **Có** | email hợp lệ, **chữ thường** | Khóa định danh tài khoản, merge hội thoại |
| `name` | **Khuyến nghị mạnh** | tối đa 180 ký tự | **Tên hiển thị inbox** — field 188 cần truyền |
| `phone` | Không | tối đa 40 ký tự | Prefill hồ sơ đặt hàng (tuỳ chọn) |
| `exp` | **Có** | Unix giây (UTC) | Thời điểm hết hạn; `exp - now` ≤ **900 giây** (15 phút) |
| `sig` | **Có** | hex 64 ký tự | Xem mục 4.2 |

**Quy tắc ký:**

```
message = "{email}|{exp}"     // email đã lowercase, exp là số nguyên
sig     = HMAC-SHA256(key=embed_key, message).hexdigest()
```

**Ví dụ:**

- `email = "user@188.com.vn"`
- `exp = 1730000300`
- `message = "user@188.com.vn|1730000300"`
- `sig = HMAC-SHA256(embed_key, message)` → chuỗi hex 64 ký tự

Sau đó: `token = base64url(JSON.stringify(payload))` (Node: `Buffer.toString('base64url')`; Python: `base64.urlsafe_b64encode(...).rstrip('=')`).

---

## 5. Code mẫu — ký token trên **server** 188

### 5.1. Python (FastAPI / backend 188)

```python
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

EMAIL_RE = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"  # hoặc dùng pydantic EmailStr


def sign_nanoai_partner_customer_token(
    email: str,
    *,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    embed_key: Optional[str] = None,
    ttl_sec: int = 300,
) -> str:
    key = (embed_key or os.environ["NANOAI_EMBED_KEY"]).strip()
    email_norm = email.strip().lower()
    if not email_norm or "@" not in email_norm:
        raise ValueError("Invalid email")

    exp = int(time.time()) + max(60, min(ttl_sec, 900))
    msg = f"{email_norm}|{exp}".encode()
    sig = hmac.new(key.encode(), msg, hashlib.sha256).hexdigest()

    payload: dict = {"email": email_norm, "exp": exp, "sig": sig}
    if name and name.strip():
        payload["name"] = name.strip()[:180]
    if phone and phone.strip():
        payload["phone"] = phone.strip()[:40]

    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


# Ví dụ endpoint nội bộ (chỉ cho user đã login 188):
#
# @router.get("/api/nanoai/customer-token")
# async def nanoai_customer_token(user: CurrentUser = Depends(require_login)):
#     token = sign_nanoai_partner_customer_token(
#         user.email,
#         name=user.display_name or user.full_name,  # ← BẮT BUỘC lấy tên thật từ DB 188
#         phone=user.phone,
#     )
#     return {"token": token}
```

### 5.2. PHP (nếu trang render SSR bằng PHP)

```php
function nanoai_partner_customer_token(
  string $email,
  string $embedKey,
  ?string $name = null,
  ?string $phone = null
): string {
  $email = strtolower(trim($email));
  $exp = time() + 300;
  $sig = hash_hmac('sha256', $email . '|' . $exp, $embedKey);
  $payload = ['email' => $email, 'exp' => $exp, 'sig' => $sig];
  if ($name) $payload['name'] = mb_substr(trim($name), 0, 180);
  if ($phone) $payload['phone'] = mb_substr(trim($phone), 0, 40);
  return rtrim(strtr(
    base64_encode(json_encode($payload, JSON_UNESCAPED_UNICODE)),
    '+/', '-_'
  ), '=');
}
```

### 5.3. Node.js (server shop)

```javascript
const crypto = require('crypto')

function buildNanoAiPartnerCustomerToken(input) {
  const email = String(input.email || '').trim().toLowerCase()
  const embedKey = process.env.NANOAI_EMBED_KEY
  const exp = Math.floor(Date.now() / 1000) + 300
  const sig = crypto.createHmac('sha256', embedKey).update(`${email}|${exp}`).digest('hex')
  const payload = { email, exp, sig }
  if (input.name) payload.name = String(input.name).slice(0, 180)
  if (input.phone) payload.phone = String(input.phone).slice(0, 40)
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}
```

---

## 6. Truyền token từ web 188 sang widget

Chọn **một** (hoặc kết hợp) theo kiến trúc trang 188.

### 6.1. SSR — khách đã login khi render HTML (khuyến nghị nếu có)

Server render token ngay trong thẻ script widget:

```html
<script
  src="https://<HOST-NANOAI>/embed/nanoai-chat-widget.js"
  data-chat-url="https://<HOST-NANOAI>/messaging/p/<slug>?embed=1"
  data-partner-customer-token="<?= htmlspecialchars($customerToken, ENT_QUOTES, 'UTF-8') ?>"
  defer
></script>
```

Chỉ set `data-partner-customer-token` khi user **đã đăng nhập**. Trang guest → **không** set attribute (chat ẩn danh).

### 6.2. SPA / sau khi login AJAX

Sau khi user login thành công, gọi API nội bộ 188 lấy token rồi set trước khi mở chat:

```javascript
async function syncNanoAiCustomerAfterLogin() {
  const res = await fetch('/api/nanoai/customer-token', { credentials: 'include' })
  if (!res.ok) return
  const { token } = await res.json()
  if (token && window.NanoAIMessagingGateway) {
    NanoAIMessagingGateway.setCustomer({ token })
  }
}

// Mở tư vấn sản phẩm (có thể kèm customerToken)
NanoAIMessagingGateway.openConsult({
  sku: 'B3630',
  imageUrl: 'https://cdn.188.com.vn/path/to/product.jpg',
  customerToken: tokenFromYourApi,
})
```

### 6.3. Logout 188

**Bắt buộc** xóa token phía widget — nếu không, chat vẫn coi như user cũ:

```javascript
if (window.NanoAIMessagingGateway) {
  NanoAIMessagingGateway.clearCustomer()
}
```

Gọi `clearCustomer()` trong handler logout của 188.

### 6.4. Thứ tự quan trọng (SPA)

1. User login 188 → server ký token mới.
2. `setCustomer({ token })` **trước** `openConsult` / bấm bubble chat.
3. Token hết hạn (~5 phút) → refresh token khi đổi trang hoặc trước khi mở chat lại.

---

## 7. API phía NanoAI (tham khảo — widget tự gọi)

```
POST https://<HOST-NANOAI>/api/messaging/guest/<slug>/auth/partner-site
Content-Type: application/json

{ "token": "<base64url payload>" }
```

**Response thành công (`200`):**

```json
{
  "ok": true,
  "accountId": "uuid-guest-account",
  "emailSessionIssued": false
}
```

Set cookie `guest_account_id` trên domain NanoAI (iframe xử lý).

**Lỗi thường gặp:**

| HTTP | `error` | Nguyên nhân |
|------|---------|-------------|
| 400 | `INVALID_TOKEN` | Body thiếu token |
| 401 | `INVALID_TOKEN` | Sai embed key, sai sig, email không hợp lệ |
| 401 | `TOKEN_EXPIRED` | `exp` đã qua |
| 404 | — | Sai slug shop |
| 429 | — | Quá nhiều request (rate limit) |

---

## 8. NanoAI lưu và hiển thị tên

Sau khi xác thực token thành công, NanoAI:

1. Tạo/cập nhật **guest account** theo `email`.
2. Lưu `name` (và `phone` nếu có) vào `messaging_partner_customer_profiles`.
3. Merge hội thoại ẩn danh (session cũ) vào tài khoản email.
4. Cập nhật **tên hiển thị inbox** cho các hội thoại của tài khoản đó.

**Thứ tự ưu tiên tên hiển thị:**

1. `name` trong token 188 (profile partner)
2. Tên tài khoản NanoAI (nếu email đã có user NanoAI)
3. Phần local-part của email (`user` từ `user@domain.com`)
4. `Guest` (chưa xác thực)

Định dạng inbox: **`{Tên khách} · {Tên shop}`** — ví dụ `Nguyễn Văn A · 188.com.vn`.

---

## 9. Checklist triển khai cho dev 188

- [ ] Có `NANOAI_EMBED_KEY` đúng workspace shop trên server (env, không lộ ra client).
- [ ] Hàm ký token chạy **chỉ trên server** (Python/PHP/Node backend 188).
- [ ] Token luôn có `email` (lowercase) và `name` = tên hiển thị thật trên 188 (họ tên / display name).
- [ ] `exp` trong khoảng **now + 60s … now + 900s**; khuyến nghị TTL **300s** (5 phút).
- [ ] Trang đã login: truyền token qua `data-partner-customer-token` **hoặc** `setCustomer({ token })`.
- [ ] Trang chưa login: **không** truyền token.
- [ ] Logout 188: gọi `NanoAIMessagingGateway.clearCustomer()`.
- [ ] Test PDP: bấm **Tư vấn nhắn tin** → inbox shop thấy đúng tên (không còn `Guest · 188.com.vn`).
- [ ] Test khách vãng lai: vẫn hiện `Guest · 188.com.vn`.
- [ ] Test đổi tên profile 188 → login lại → mở chat → inbox cập nhật tên mới.

---

## 10. Kịch bản test

### Test A — Khách đã login, có `name`

1. Login 188 bằng tài khoản có tên "Trần Thị B".
2. Mở trang SP, bấm tư vấn / mở chat widget.
3. Gửi 1 tin nhắn.
4. Vào **NanoAI → Messaging → Inbox** (shop 188): hội thoại hiển thị **`Trần Thị B · 188.com.vn`**.

### Test B — Chỉ có email, không `name`

1. Ký token thiếu field `name`.
2. Inbox hiển thị phần trước `@` của email — xác nhận team biết hành vi fallback.

### Test C — Logout

1. Login → mở chat → logout 188 (đã gọi `clearCustomer()`).
2. Mở chat lại: hội thoại mới phải là guest (hoặc session mới), không dính tài khoản cũ.

### Test D — Token hết hạn

1. Dùng token có `exp` cũ hoặc đợi > 5 phút không refresh.
2. Mở chat: xác thực thất bại → chat fallback ẩn danh; fix bằng ký token mới khi render/trước open chat.

---

## 11. FAQ

**Q: Có cần deploy lại backend 188 không?**  
A: Có — cần code server ký token + (tuỳ kiến trúc) endpoint hoặc SSR inject token. Chỉ sửa widget NanoAI phía 188 **không đủ** nếu chưa ký token.

**Q: Embed key khác Bearer API thử đồ?**  
A: Có. Embed key dùng cho widget/chat guest; Bearer partner secret dùng cho API B2B server-to-server.

**Q: Khách đã có tài khoản NanoAI cùng email?**  
A: NanoAI merge hội thoại theo email; tên ưu tiên từ token `name` / profile partner.

**Q: Cập nhật tên trên 188 sau khi đã chat?**  
A: Lần login + mở chat tiếp theo với token mới có `name` mới → NanoAI cập nhật profile và sync lại tên inbox.

**Q: Liên hệ khi lỗi tích hợp?**  
A: Gửi kèm: slug shop, thời điểm test, payload JSON **đã che sig** (chỉ cần xác nhận có `name`/`email`/`exp`), và response HTTP từ `auth/partner-site` nếu debug tay.

---

## 12. Tóm tắt một dòng cho PM

> **188 server ký token ngắn hạn (email + tên khách) bằng Embed Key NanoAI, rồi trang web truyền token vào widget chat — NanoAI tự đồng bộ tên lên inbox shop.**
