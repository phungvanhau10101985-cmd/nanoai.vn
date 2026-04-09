# Postgres — migration SQL

- **`migrations/`**: file `.sql` theo thứ tự thời gian — áp lên **bất kỳ Postgres nào** (`DATABASE_URL`).
- **`scripts/`** (ở gốc repo): script SQL tiện ích (reset dữ liệu test, v.v.).

Áp migration: `npm run db:push` hoặc `node scripts/pg-apply-migrations.mjs --apply` (theo dõi bảng `public.app_applied_sql_migrations`). Xem pending: `npm run db:migrate:status`.

DB đã migrate bằng công cụ cũ trước khi có bảng tracking: `node scripts/pg-apply-migrations.mjs --mark-all-applied` (một lần), rồi chỉ dùng `--apply` cho file mới.
