# Báo cáo bảo mật dự án

- Ngày kiểm tra: 14/07/2026
- Phạm vi: toàn bộ mã nguồn trong repository
- Phương pháp: static audit, chưa khai thác trực tiếp production
- Tình trạng tổng thể: **Chưa production-hardened**
- Cập nhật trạng thái gần nhất: 14/07/2026

## Quy ước trạng thái

- `CHƯA FIX`: Lỗ hổng vẫn tồn tại trong code hiện tại.
- `ĐANG FIX`: Đã bắt đầu xử lý nhưng chưa kiểm tra hoàn tất.
- `ĐÃ FIX - CHƯA VERIFY`: Đã sửa code nhưng chưa kiểm thử bảo mật.
- `ĐÃ VERIFY`: Đã sửa và kiểm tra lại.
- `PHỤ THUỘC CẤU HÌNH`: Chỉ khai thác được khi môi trường triển khai thiếu hoặc sai cấu hình.

## Critical

### SEC-001 — Chiếm tài khoản chỉ bằng email

- Mức độ: **Critical**
- Trạng thái: **ĐÃ FIX - CHƯA VERIFY**
- Vị trí:
  - `src/app/api/auth/email/request/route.ts:66-146`
  - `src/lib/auth/email-trusted-device.ts:128-142`
  - `src/lib/auth/email-trusted-device.ts:194-301`
- Mô tả: Email từng xác thực OTP hoặc có trusted-device đang hoạt động có thể được cấp session mới mà không cần OTP mới và không cần chứng minh đang giữ secret của thiết bị.
- Ảnh hưởng: Chiếm toàn bộ tài khoản người dùng hoặc quản trị viên.
- Yêu cầu khắc phục:
  - Xóa fallback đăng nhập dựa trên email từng xác thực.
  - Xóa trusted-email cookie dạng hash có thể tự tính.
  - Xóa fallback tìm trusted-device chỉ bằng email/browser signal.
  - Chỉ chấp nhận random device secret hợp lệ hoặc OTP/magic link mới.
  - Thu hồi session và trusted-device cũ sau khi triển khai bản vá.
- Thay đổi ngày 14/07/2026:
  - Đã xóa nhánh tự đăng nhập chỉ vì email từng xác thực OTP.
  - Đã xóa trusted-email cookie dạng hash khỏi luồng xác thực.
  - Đã xóa fallback theo browser ID, IP/User-Agent và email.
  - Tự đăng nhập hiện chỉ xảy ra khi request giữ trusted-device cookie gồm ID và random secret hợp lệ, chưa hết hạn và chưa bị thu hồi.
  - Thiết bị/trình duyệt không có cookie hợp lệ sẽ chuyển sang gửi OTP.
  - Đã tôn trọng lựa chọn `rememberDevice` khi xác thực OTP hoặc magic link.
- Còn phải xác minh:
  - Test trình duyệt đã tin cậy tự đăng nhập thành công.
  - Test trình duyệt ẩn danh và thiết bị khác bắt buộc OTP.
  - Thu hồi trusted-device/session cũ trên production nếu cần.

### SEC-002 — Giả mạo webhook SePay

- Mức độ: **Critical**
- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/api/sepay-webhook/route.ts:198-220`
  - `src/app/api/sepay-webhook/route.ts:338-375`
  - `src/app/api/account/payments/route.ts:23-77`
- Mô tả:
  - Nhánh BYOK hoàn tất thanh toán trước bước xác minh chữ ký.
  - Nhánh cộng credit có thể tiếp tục khi thiếu chữ ký nếu cấu hình không bắt buộc.
  - Người dùng có thể tạo pending payment và biết nội dung chuyển khoản của chính họ, sau đó gửi HTTP request giả làm webhook SePay.
- Ảnh hưởng: Kích hoạt gói BYOK hoặc cộng credit khi chưa chuyển tiền thật.
- Yêu cầu khắc phục:
  - Xác minh chữ ký trên raw body ngay đầu endpoint.
  - Thiếu secret hoặc chữ ký phải fail closed.
  - Chỉ tìm payment và cập nhật dữ liệu sau khi xác thực webhook.
  - Không nhận số tiền, credit và mã giao dịch tùy ý từ client; tạo chúng phía server.

### SEC-003 — Sửa worksheet trái phép kết hợp Stored XSS

- Mức độ: **Critical**
- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/tao-giao-trinh/actions.ts:1667-1720`
  - `src/app/phieu-bai-tap/[id]/lam-bai/lam-bai-client.tsx:16-33`
  - `src/app/phieu-bai-tap/[id]/lam-bai/lam-bai-client.tsx:102-133`
- Mô tả: Action lưu worksheet xác thực người dùng nhưng chưa kiểm tra quyền sở hữu/cộng tác. Nội dung HTML sau đó được render bằng `dangerouslySetInnerHTML` mà chưa escape hoặc sanitize.
- Ảnh hưởng: Sửa dữ liệu người khác và chạy JavaScript trong phiên của học sinh.
- Yêu cầu khắc phục:
  - Kiểm tra owner/collaborator trong chính câu query update.
  - Escape hoặc sanitize markdown bằng allowlist nghiêm ngặt.
  - Không cho raw HTML chạy trong worksheet.

## High

### SEC-004 — Public SSRF qua API tải ảnh

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/api/fetch-image/route.ts:8-26`
  - `src/lib/fetch-image-1688.ts:106-140`
- Ảnh hưởng: Truy cập mạng nội bộ, metadata service, dò cổng và làm đầy bộ nhớ.
- Khắc phục: Allowlist hostname; kiểm tra DNS/IP và từng redirect; chặn private/reserved IPv4/IPv6; giới hạn timeout và kích thước.

### SEC-005 — Next.js nằm trong dải ảnh hưởng CVE-2026-44578

- Trạng thái: **PHỤ THUỘC CẤU HÌNH — CHƯA FIX**
- Vị trí:
  - `package.json:92`
  - `package-lock.json:12329-12334`
  - `ecosystem.config.cjs:6-15`
- Điều kiện: Triển khai self-hosted bằng Node.js/`next start`.
- Ảnh hưởng: SSRF không cần đăng nhập thông qua WebSocket upgrade.
- Khắc phục: Nâng lên phiên bản Next.js được hỗ trợ và đã vá, tối thiểu `15.5.16` hoặc `16.2.5`, ưu tiên latest stable.

### SEC-006 — Guest UUID được dùng như bearer credential

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/lib/auth.ts:144-200`
  - `src/lib/messaging/guest-account-session.ts:13-43`
- Ảnh hưởng: Nếu UUID bị lộ, người khác có thể mạo danh guest account và wallet user tương ứng.
- Khắc phục: Dùng opaque token hoặc signed token có secret, audience, expiry và khả năng thu hồi.

### SEC-007 — Race condition cộng credit nhiều lần

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/api/sepay-webhook/route.ts:179-196`
  - `src/app/api/sepay-webhook/route.ts:357-375`
  - `src/lib/db/payments-repo.ts:141-189`
- Ảnh hưởng: Nhiều webhook đồng thời có thể cùng cộng credit cho một giao dịch.
- Khắc phục: Claim payment pending và cộng credit trong một transaction; unique provider transaction ID; idempotency key.

### SEC-008 — Giá đơn hàng tin dữ liệu product card từ client/LLM

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/api/messaging/guest/[slug]/order/route.ts:33-47`
  - `src/app/api/messaging/guest/[slug]/order/route.ts:118-127`
  - `src/lib/messaging/guest-chat-ordering.ts:464-492`
  - `src/lib/messaging/guest-chat-ordering.ts:697-714`
- Ảnh hưởng: Tạo đơn giả hoặc đơn có giá thấp hơn giá inventory.
- Khắc phục: Chỉ nhận inventory ID thuộc partner và nạp toàn bộ thông tin giá/sản phẩm từ DB.

### SEC-009 — IDOR làm lộ worksheet và đáp án curriculum

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/api/worksheet/[id]/route.ts:12-63`
  - `src/app/api/worksheet/curriculum-questions-catalog/route.ts:136-155`
  - `src/app/api/worksheet/curriculum-questions-catalog/route.ts:211-302`
- Ảnh hưởng: Lộ nội dung riêng, đáp án đúng, giải thích và lời giải tự luận.
- Khắc phục: Kiểm tra owner/enrollment/share trong query và trả DTO dành riêng cho học sinh.

### SEC-010 — Endpoint AI trả phí có thể bị gọi ẩn danh

- Trạng thái: **CHƯA FIX**
- Vị trí đại diện:
  - `src/app/api/curriculum-from-paste/route.ts`
  - `src/app/api/slide-generate-quiz/route.ts`
  - `src/app/api/slide-verify-quiz/route.ts`
  - `src/app/api/english-coach/tts/route.ts`
- Ảnh hưởng: Lạm dụng chi phí API, hết quota và gây gián đoạn dịch vụ.
- Khắc phục: Bắt buộc xác thực trước model call; distributed rate limit; quota/credit atomic.

### SEC-011 — Điểm worksheet do client gửi lên

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/app/phieu-bai-tap/[id]/lam-bai/lam-bai-client.tsx:55-78`
  - `src/app/phieu-bai-tap/[id]/lam-bai/actions.ts:15-61`
- Ảnh hưởng: Học sinh có thể gửi `quizScore` và `quizTotal` tùy ý.
- Khắc phục: Server tự tính điểm từ đáp án lưu trong DB và câu trả lời được nộp.

### SEC-012 — Magic-link có thể dùng Host header không tin cậy

- Trạng thái: **PHỤ THUỘC CẤU HÌNH — CHƯA FIX**
- Vị trí:
  - `src/lib/auth/public-app-url.ts:22-55`
  - `src/app/api/auth/email/request/route.ts:184-192`
- Điều kiện: `APP_URL` không được cấu hình và proxy cho phép client điều khiển Host/X-Forwarded-Host.
- Ảnh hưởng: Link đăng nhập có thể trỏ sang domain của kẻ tấn công.
- Khắc phục: Bắt buộc canonical origin và từ chối host không nằm trong allowlist.

## Medium

### SEC-013 — Translation worker fail open

- Trạng thái: **PHỤ THUỘC CẤU HÌNH — CHƯA FIX**
- Vị trí: `src/app/api/process-translate/route.ts:44-68`
- Điều kiện: Thiếu `PROCESS_TRANSLATE_SECRET`.
- Khắc phục: Thiếu secret trả `503`; mọi request phải có internal credential hợp lệ.

### SEC-014 — Facebook webhook fail open

- Trạng thái: **PHỤ THUỘC CẤU HÌNH — CHƯA FIX**
- Vị trí: `src/app/api/integrations/facebook/messenger/webhook/route.ts:43-53`
- Điều kiện: Thiếu `FACEBOOK_MESSENGER_APP_SECRET`.
- Khắc phục: Fail closed và luôn xác minh `X-Hub-Signature-256`.

### SEC-015 — Session mặc định khoảng 10 năm

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `src/lib/auth/email-session-max-age.ts:5-13`
  - `src/lib/auth/email-session-token.ts:13-32`
  - `src/app/auth/signout/route.ts:10-18`
- Ảnh hưởng: Token bị đánh cắp tồn tại quá lâu và logout không thu hồi JWT phía server.
- Khắc phục: Access token ngắn hạn, rotating refresh token và server-side revocation.

### SEC-016 — Giả User-Agent crawler để nhận dev identity

- Trạng thái: **CHƯA FIX**
- Vị trí: `src/lib/auth.ts:68-76,122-130`
- Khắc phục: Không tạo application identity cho crawler; chỉ render dữ liệu public dành cho SEO.

### SEC-017 — Upload được buffer trước khi giới hạn kích thước

- Trạng thái: **CHƯA FIX**
- Vị trí đại diện:
  - `src/app/api/messaging/guest/[slug]/image/route.ts:32-54`
  - `src/app/api/english-coach/audio-upload/route.ts:7-25`
- Ảnh hưởng: Tốn heap, crash process và lạm dụng storage.
- Khắc phục: Giới hạn tại reverse proxy; kiểm tra `File.size`; stream với hard byte limit.

### SEC-018 — `xlsx@0.18.5` có lỗ hổng đã biết

- Trạng thái: **CHƯA FIX**
- Vị trí:
  - `package-lock.json:16863-16868`
  - `src/lib/messaging/partner-inventory-excel.ts:378-388`
- Ảnh hưởng: Prototype pollution và ReDoS khi xử lý workbook độc hại.
- Khắc phục: Thay bằng bản SheetJS đã vá và parse trong worker giới hạn tài nguyên.

### SEC-019 — Rate limit theo IP chỉ lưu trong process

- Trạng thái: **CHƯA FIX**
- Vị trí: `src/lib/api/simple-ip-rate-limit.ts:8-46`
- Ảnh hưởng: Dễ bypass trên nhiều process/server và bằng forwarding header giả.
- Khắc phục: Dùng Redis/Postgres atomic limiter và chỉ tin IP do proxy tin cậy cung cấp.

### SEC-020 — Thiếu CSP và HSTS toàn cục

- Trạng thái: **CHƯA FIX**
- Vị trí: `next.config.mjs:125-144`
- Khắc phục: Thêm nonce-based CSP, HSTS production và giới hạn `frame-ancestors`.

## Low

### SEC-021 — Log toàn bộ webhook thanh toán

- Trạng thái: **CHƯA FIX**
- Vị trí: `src/app/api/sepay-webhook/route.ts:99-116,147-155`
- Ảnh hưởng: Header, chữ ký, thông tin ngân hàng và payload có thể tồn tại trong log.
- Khắc phục: Redact dữ liệu nhạy cảm; chỉ log event ID và trạng thái.

### SEC-022 — Public debug health endpoint

- Trạng thái: **CHƯA FIX**
- Vị trí: `src/app/api/debug/health/route.ts:8-55`
- Ảnh hưởng: Lộ thông tin triển khai, proxy, kết nối DB và lỗi backend.
- Khắc phục: Tắt trên production hoặc yêu cầu quyền monitoring/admin.

## Thứ tự xử lý đề xuất

### Trong 24 giờ

1. Fix `SEC-001` và thu hồi session/trusted-device cũ.
2. Fix `SEC-002`; bắt buộc chữ ký SePay trước mọi xử lý.
3. Tạm vô hiệu hóa API `/api/fetch-image` nếu chưa thể fix ngay.

### Trong 1–3 ngày

1. Fix `SEC-003`, `SEC-006`, `SEC-007`.
2. Fix quyền truy cập worksheet/curriculum.
3. Không tin giá hoặc product card từ client/LLM.

### Trong 1–2 tuần

1. Nâng Next.js và thư viện `xlsx`.
2. Bảo vệ toàn bộ endpoint AI bằng auth/quota/rate limit.
3. Rút ngắn session, bổ sung revocation, CSP, HSTS và upload limits.

## Hạn chế của lần kiểm tra

- Chưa pentest hoặc gửi payload vào production.
- Chưa kiểm tra cấu hình thực tế trên VPS, reverse proxy và firewall.
- `npm audit` chưa hoàn tất vì máy local không xác minh được certificate của npm registry.
- Chưa xác minh secret đã từng tồn tại trong Git history.

## Nhật ký cập nhật

| Ngày | Nội dung | Trạng thái |
|---|---|---|
| 14/07/2026 | Sửa SEC-001: chỉ trusted-device cookie có random secret hợp lệ mới được tự đăng nhập | `ĐÃ FIX - CHƯA VERIFY` |
| 14/07/2026 | Tạo báo cáo sau static audit toàn repository | Tất cả finding đang `CHƯA FIX` hoặc phụ thuộc cấu hình |
