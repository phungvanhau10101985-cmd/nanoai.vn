# 188.com.vn — SSO chat NanoAI (ops / deploy)

Case study **188.com.vn**. Áp dụng tương tự cho shop đối tác khác đã **có sẵn code** ký token + CSR.

**Trang hướng dẫn NanoAI (mọi shop):** `/dashboard/messaging/partner-site-login`  
**Embed Key:** Messaging → Cài đặt hoặc trang trên (UUID workspace).

---

## Trả lời nhanh: 188 đã đủ để đăng nhập/tạo tài khoản từ web 188 chưa?

| Lớp | Trạng thái |
|-----|------------|
| **Code repo 188** (FastAPI + Next CSR) | ✅ Đã có — **không** cần implement lại từ đầu |
| **Production SSO chat hoạt động** | ❌ **Chưa** (hoặc chưa verify đúng) — khả năng cao thiếu `NANOAI_EMBED_KEY` trên VPS |
| **NanoAI nhận token + tạo guest account** | ✅ Sẵn sàng (`POST …/auth/partner-site`) — chờ 188 gửi token hợp lệ |

**Kết luận:** Về **mã nguồn** 188 đã đủ. Về **vận hành**, cần **deploy env + smoke test** trước khi coi là «đã đăng nhập từ web 188».

---

## Kiểm tra live HTML (09/07/2026)

View Source trang chủ/PDP **không** thấy `data-partner-customer-token` — **bình thường** với CSR: token gắn **sau login** qua JS (`setCustomer`), không nhất thiết có trong HTML tĩnh.

Verify đúng: DevTools **Network** hoặc Console **sau khi user đã login 188**.

---

## TICKET OPS — Bật SSO chat 188 (không phải ticket dev mới)

**Độ ưu tiên:** Cao  
**Giả định:** Backend `GET /api/v1/nanoai/customer-token` và frontend CSR **đã merge** trên repo 188.

### Checklist deploy / vận hành

- [ ] **NANOAI_EMBED_KEY** trên VPS 188 (env server, **không** commit public) — UUID từ NanoAI dashboard shop `188-com-vn-rl56`
- [ ] Restart API + web sau khi set env
- [ ] `GET /api/v1/nanoai/customer-token` khi **đã login** → `200` + `{"token":"...","expires_at":...}`
- [ ] Cùng request khi **chưa login** → `401`
- [ ] Thiếu embed key → `503` (frontend có thể `clearNanoAiPartnerCustomer()` im lặng → chat vẫn Guest)
- [ ] Sau login: `NanoAIMessagingGateway.setCustomer({ token })` chạy (hoặc `data-partner-customer-token` sau hydrate)
- [ ] Logout 188: `NanoAIMessagingGateway.clearCustomer()`
- [ ] Acceptance: inbox NanoAI `{Tên khách} · 188.com.vn` (không còn Guest khi user đã login)

### Không làm lại

- ❌ Viết lại API ký token (đã có FastAPI)
- ❌ Viết lại CSR sync (đã có)
- ❌ Dùng path `/api/nanoai/customer-token` — **sai**; đúng: **`/api/v1/nanoai/customer-token`**

---

## Verify (user đã login 188)

### curl

```bash
# Windows — cookie session sau login trên browser, hoặc Bearer nếu API dùng token
curl.exe -b cookies.txt "https://188.com.vn/api/v1/nanoai/customer-token"
```

| Response | Ý nghĩa |
|----------|---------|
| `200` + `token` | Backend OK — kiểm tra frontend `setCustomer` |
| `503` | Thiếu / sai **NANOAI_EMBED_KEY** trên server |
| `401` | Chưa login hoặc session hết hạn |
| `404` | Sai path (đang gọi `/api/nanoai/...` thay vì `/api/v1/nanoai/...`) |

### Browser (sau login)

```javascript
document.querySelector('script[src*="nanoai-chat-widget"]')?.getAttribute('data-partner-customer-token')
// CSR: thường rỗng trong HTML — xem Network request tới /api/v1/nanoai/customer-token

typeof window.NanoAIMessagingGateway?.setCustomer  // "function"
```

### NanoAI auth (debug)

```bash
curl -s -X POST "https://nanoai.vn/api/messaging/guest/188-com-vn-rl56/auth/partner-site" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"<token_từ_188>\"}"
# Kỳ vọng: {"ok":true,"accountId":"...","emailSessionIssued":...}
```

---

## Vì sao live vẫn «Guest · 188.com.vn»?

Thứ tự khả năng **cao → thấp**:

1. **NANOAI_EMBED_KEY chưa set VPS** → API `503` → frontend clear token im lặng → guest
2. **Test sai endpoint** — `/api/nanoai/...` thay vì `/api/v1/nanoai/...`
3. **Chỉ xem View Source** — token CSR không có trong HTML tĩnh
4. Build frontend cũ (ít khả năng nếu backend endpoint đã live)

---

## Spec token (tham chiếu — khớp NanoAI `verifyPartnerSiteCustomerToken`)

```
message = "{email_lowercase}|{exp_unix}"
sig     = HMAC-SHA256(embed_key, message) → hex 64 ký tự
token   = base64url(JSON { email, name?, phone?, exp, sig })
```

- TTL khuyến nghị **300s**, tối đa **900s**
- NanoAI verify: `src/lib/messaging/partner-site-customer-auth.ts`
- Smoke test NanoAI repo: `npm run test:partner-site-token`

---

## Luồng (đã implement phía 188 + NanoAI)

```
[188 FastAPI]  GET /api/v1/nanoai/customer-token (logged in)
      ↓
[188 Next CSR] setCustomer({ token }) / openConsult
      ↓
[Widget]       pc_token trên iframe
      ↓
[NanoAI]       POST /api/messaging/guest/{slug}/auth/partner-site
      ↓
[NanoAI]       Cookie guest_account + tên inbox
```

---

## FAQ

**Q: Chỉ nhúng widget đã đủ?**  
A: Không. Cần env + API token + CSR sync sau login.

**Q: Embed key đặt đâu?**  
A: **Server 188** (`NANOAI_EMBED_KEY`), không phải `.env` NanoAI VPS.

**Q: Gửi gì cho ops khi báo xong?**  
A: Screenshot curl `200`, screenshot inbox tên thật, giá trị env đã set (che key).

---

## Tóm tắt một dòng

> **188 đã có code — cần set `NANOAI_EMBED_KEY` trên VPS, verify `/api/v1/nanoai/customer-token`, rồi test inbox không còn Guest.**
