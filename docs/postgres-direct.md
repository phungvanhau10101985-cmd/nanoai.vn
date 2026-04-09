# Postgres trực tiếp (schema `auth`, migration, app)

Ứng dụng dùng **`DATABASE_URL`** và thư viện **`pg`** — không dùng hosted client/SDK cho database.

## Migration

- Nguồn SQL: **`db/migrations/`** (file `.sql` theo thứ tự tên).
- Áp lên DB: `npm run db:push` hoặc `node scripts/pg-apply-migrations.mjs --apply`.
- Theo dõi đã chạy: bảng `public.app_applied_sql_migrations`.
- DB đã có schema từ trước (chưa có bảng tracking): một lần `node scripts/pg-apply-migrations.mjs --mark-all-applied`, sau đó chỉ `--apply` cho file mới.

Chi tiết: `db/README.md`.

## Schema đăng nhập

Email OTP/magic tạo user trong **`auth.users`**; trigger tạo **`public.profiles`**. Cần bảng **`auth.instances`** (ít nhất một dòng) — xem `scripts/pg-ensure-auth-compat.mjs` nếu thiếu.

## Quản trị

`public.profiles.role = 'admin'`. Gán nhanh: `npm run pg:set-admin -- --email=... --apply` (sau khi user đã đăng nhập ít nhất một lần).

## Env

Bảng đầy đủ: `.env.example`, `docs/ENV_LOCAL_REFERENCE.md`. Ảnh/storage legacy: `NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN`, Bunny, v.v.
