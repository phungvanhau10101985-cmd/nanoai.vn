# Thu-do-online (Next.js)

Ứng dụng web Next.js (nanoai.vn): Postgres qua **`DATABASE_URL`**, lưu trữ media qua **Bunny**; không còn SDK client npm `@supabase/supabase-js`. Một số biến env vẫn theo convention tên `NEXT_PUBLIC_SUPABASE_*` nếu bạn dùng cùng stack hosted — xem `.env.example` và `docs/ENV_LOCAL_REFERENCE.md`.

## Getting started

### 1. Prerequisites

- Node.js 18+
- npm
- Postgres có thể truy cập (URI dạng `postgresql://...`)
- Khóa dịch vụ AI tùy tính năng (ví dụ `GOOGLE_API_KEY` — xem `.env.example`)

### 2. Database

1. Áp dụng migration trong thứ tự thư mục `supabase/migrations/` lên database của bạn (bất kỳ Postgres nào), **hoặc** `npm run db:push` nếu dùng CLI migration đã link project (xem `package.json`).
2. Đặt **`DATABASE_URL`** trong `.env.local` (connection string có `sslmode=require` nếu host yêu cầu TLS).

### 3. Auth & redirect URL (Google OAuth)

Nếu đăng nhập Google đi qua host Auth bạn cấu hình (cùng origin với các biến `NEXT_PUBLIC_SUPABASE_*` nếu dùng): thêm **Authorized redirect URI** trỏ tới callback của app (ví dụ `https://your-domain/auth/callback` và `http://localhost:3000/auth/callback` cho local). Chi tiết: `DEPLOY_VPS.md`.

### 4. Storage (ảnh/video)

- Upload mới: cấu hình **Bunny** (`BUNNY_STORAGE_*`, `BUNNY_STORAGE_PUBLIC_BASE_URL`) — bắt buộc cho nhiều luồng media.
- URL/file cũ hoặc script backfill: có thể cần **Storage REST legacy** (`NEXT_PUBLIC_STORAGE_LEGACY_REST_*` / `STORAGE_LEGACY_*`, hoặc fallback trong `.env.example`).

### 5. Cài đặt và chạy

```bash
npm install
cp .env.example .env.local
# Điền DATABASE_URL, NEXT_PUBLIC_BASE_URL, Bunny, AI keys… — checklist đầy đủ: docs/ENV_LOCAL_REFERENCE.md
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### 6. Reset dữ liệu AI test

Để xóa dữ liệu do AI tạo (giáo trình, bài thi, phiếu bài tập, …) nhưng giữ tài khoản / credit / câu hỏi đã upload:

1. Mở `supabase/scripts/reset-ai-test-data.sql`
2. Chạy trên database của bạn (SQL client hoặc dashboard host Postgres)

Chi tiết: `docs/reset-ai-test-data.md`.

### 7. Tài liệu thêm

- **`docs/ENV_LOCAL_REFERENCE.md`** — biến môi trường, cron, Vision, deploy
- **`DEPLOY_VPS.md`** — deploy VPS, rsync, không ghi đè `.env.local`
