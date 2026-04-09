Thư mục **`migrations/`** không commit trong git: được tạo bởi `npm install` / `scripts/ensure-pg-migration-cli-link.mjs` (junction/symlink tới **`../db/migrations`**), vì một số CLI migration chỉ nhận đường dẫn cố định này.

Nguồn thật: **`db/migrations/`**.
