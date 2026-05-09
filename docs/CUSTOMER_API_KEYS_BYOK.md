# API key riêng của khách (BYOK)

Tính năng này cho phép người dùng lưu Gemini API key riêng. Key được mã hóa bằng AES-256-GCM trước khi lưu vào `public.user_ai_api_keys`.

## Biến môi trường

```env
CUSTOMER_API_KEY_ENCRYPTION_SECRET=chuoi-random-dai-toi-thieu-32-ky-tu
```

Không đổi secret này sau khi đã có key trong DB, nếu không các key cũ sẽ không giải mã được.

## Migration

Local Windows CMD:

```cmd
node scripts/pg-run-sql-file.mjs db/migrations/20260509173000_create_user_ai_api_keys.sql --apply
node scripts/pg-run-sql-file.mjs db/migrations/20260509185000_create_user_ai_api_key_billing.sql --apply
```

Server VPS:

```bash
git pull
node scripts/pg-run-sql-file.mjs db/migrations/20260509173000_create_user_ai_api_keys.sql --apply
node scripts/pg-run-sql-file.mjs db/migrations/20260509185000_create_user_ai_api_key_billing.sql --apply
npm run build
pm2 restart all
```

## Luồng dùng key

1. Người dùng mở `/dashboard/customer-api-keys`.
2. Dán Gemini API key.
3. Server kiểm tra key với Google Generative Language API.
4. Server mã hóa key và lưu DB.
5. Các luồng Gemini có `userId` gọi `resolveGoogleApiKeyForUser(userId)`.
6. Nếu key khách bật và hợp lệ, dùng key khách; nếu không có, fallback `GOOGLE_API_KEY` server.

## Billing BYOK

- Gói: Basic `199.000đ/tháng`, Pro `299.000đ/tháng`, Business `699.000đ/tháng`.
- Tháng đầu giảm `30%` nếu user chưa từng dùng ưu đãi.
- Payment BYOK lưu riêng trong `public.user_ai_api_key_plan_payments`, không dùng bảng nạp credit để tránh cộng nhầm credit.
- SePay webhook khớp nội dung chuyển khoản dạng `BYOK XXXXX`, mark payment completed rồi kích hoạt/gia hạn `public.user_ai_api_key_subscriptions`.
- Resolver chỉ ưu tiên key khách khi subscription BYOK đang `active` và còn hạn; hết hạn thì fallback key server.
- Admin xem tại `/admin/customer-api-keys`.

## Bảo mật

- Không trả full key về client.
- Không log key.
- Chỉ hiển thị `key_hint`.
- User có thể tắt hoặc xóa key bất kỳ lúc nào.
