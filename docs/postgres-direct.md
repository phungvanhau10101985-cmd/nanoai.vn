# Postgres trực tiếp (schema `auth`, migration, app)

Ứng dụng dùng **`DATABASE_URL`** và thư viện **`pg`** — không dùng hosted client/SDK cho database.

## Migration

- Nguồn SQL: **`db/migrations/`** (file `.sql` theo thứ tự tên).
- Áp lên DB: `npm run db:push` hoặc `node scripts/pg-apply-migrations.mjs --apply`.
- Theo dõi đã chạy: bảng `public.app_applied_sql_migrations`.
- DB đã có schema từ trước (chưa có bảng tracking): một lần `node scripts/pg-apply-migrations.mjs --mark-all-applied`, sau đó chỉ `--apply` cho file mới.

Chi tiết: `db/README.md`.

## Schema đăng nhập

Email OTP/magic tạo user trong **`auth.users`**; trigger tạo **`public.profiles`**. Cần **`auth.instances` có ít nhất một dòng** — nếu báo *Thiếu cấu hình auth (auth.instances)* / `auth.instances_empty`:

1. Chạy: **`npm run pg:ensure-auth-compat`** (hoặc `node scripts/pg-ensure-auth-compat.mjs`) với `DATABASE_URL` đúng DB.
2. Hoặc áp migration **`db/migrations/20260409170000_auth_instances_seed_self_hosted.sql`** (`npm run db:push`).
3. Thủ công (psql): `insert into auth.instances (id) values (gen_random_uuid());` — nếu bảng đã có đủ cột / quyền.

## Quản trị

`public.profiles.role = 'admin'`. Gán nhanh: `npm run pg:set-admin -- --email=... --apply` (sau khi user đã đăng nhập ít nhất một lần).

## Env

Bảng đầy đủ: `.env.example`, `docs/ENV_LOCAL_REFERENCE.md`. Ảnh/storage legacy: `NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN`, Bunny, v.v.
