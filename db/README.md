# Postgres — migration SQL

- **`migrations/`**: file `.sql` theo thứ tự thời gian — áp lên **bất kỳ Postgres nào** (`DATABASE_URL`), không gắn với một nhà cung cấp cụ thể.
- **`scripts/`**: script SQL tiện ích (reset dữ liệu test, v.v.).

Áp migration: `psql` từng file theo thứ tự, hoặc `npm run db:migrate:push` (sau `npm install` có script tạo liên kết tới thư mục mà CLI kỳ vọng — xem `scripts/ensure-pg-migration-cli-link.mjs`).
