# Hướng dẫn loại bỏ hoàn toàn Supabase (sản phẩm & tên trong mã)

Mục tiêu: **không còn phụ thuộc dịch vụ Supabase Cloud**, không thêm code/SDK mới liên quan Supabase; chuẩn vận hành là **Postgres trực tiếp** (`DATABASE_URL`), **Bunny Storage** cho media, auth/email self-host hoặc JWT — cùng hướng với `src/lib/direct-pg-env-flags.ts` và các route dùng `pg`.

---

## 1. Phân biệt (tránh nhầm khi “dọn tên”)

| Khái niệm | Ý nghĩa trong repo này |
|-----------|-------------------------|
| **Thư mục `supabase/migrations/`** | Chủ yếu là **đường dẫn mà Supabase CLI** (`supabase db push`) mong đợi. Nguồn SQL canonical là `db/migrations/`; `postinstall` chạy `scripts/ensure-pg-migration-cli-link.mjs` để tạo junction/symlink `supabase/migrations` → `db/migrations`. Đổi tên folder `supabase/` chỉ nên làm **kèm** thay workflow migration (xem mục 4). |
| **Schema `auth.*` trên Postgres** (`auth.users`, `auth.instances`, …) | Là **schema PostgreSQL** (tương thích kiểu hosted cũ), **không** đồng nghĩa với “đang gọi API Supabase”. App có thể self-host DB hoàn toàn. |
| **Biến env `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`** | Trong code hiện tại thường là **alias kế thừa** cho origin/khóa HTTP (Storage REST cũ, session hosted cũ). Ưu tiên migrate sang tên trung tính trong `.env.example` (`NEXT_PUBLIC_LEGACY_HTTP_ORIGIN`, `NEXT_PUBLIC_STORAGE_LEGACY_*`, …) rồi **gỡ alias** khỏi `.env.local` / VPS. |

---

## 2. Checklist vận hành (không cần sửa code ngay)

1. **`.env.local` / VPS:** Không set các biến Supabase trừ khi vẫn cần **trỏ tới host cũ** cho URL ảnh/storage (`/storage/v1/object/...`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_DB_URL` (chỉ dùng trong vài script backup/migrate — thay bằng `DATABASE_URL` / `PG_DUMP_SOURCE_URL` khi có thể)

2. **Postgres:** Luôn dùng **`DATABASE_URL`** (hoặc biến tương đương đã thống nhất trong team) cho app và script; không bắt buộc connection string riêng của dashboard Supabase.

3. **Sau khi** đã chuyển hết media sang Bunny và không còn URL legacy: xóa hẳn các alias Supabase khỏi env; cấu hình ảnh remote trong `next.config.mjs` sẽ dựa vào `NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN` / Bunny (xem file đó và comment trong `.env.example`).

---

## 3. Checklist dọn mã (khi muốn “không còn dòng nào nhắc Supabase”)

Thực hiện **theo thứ tự** và kiểm tra build + staging sau mỗi nhóm.

1. **Runtime app:** Đảm bảo `package.json` → `dependencies` **không** có `@supabase/supabase-js`. (Nếu grep thấy trong `dependencies`, đó là nợ cần thay bằng `pg` / HTTP tới API nội bộ.)

2. **`src/lib/storage/storage-legacy-rest-config.ts`:** Khi không còn deploy nào dùng env tên cũ, có thể **xóa** fallback `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` — chỉ giữ `STORAGE_LEGACY_*` / `LEGACY_HTTP_*`. **Breaking:** mọi môi trường phải đã đổi tên biến.

3. **`next.config.mjs`:** Gỡ `hostnameFromEnvUrl('NEXT_PUBLIC_SUPABASE_URL')` khi không còn hostname legacy cho `images.remotePatterns`.

4. **`src/lib/direct-pg-env-flags.ts`:** Deprecate hoặc xóa `ZERO_SUPABASE` / `NEXT_PUBLIC_ZERO_SUPABASE` nếu không còn dùng.

5. **Chuỗi giao diện:** Ví dụ `login-client.tsx` — đổi copy “Supabase/Auth” thành mô tả trung tính: schema **auth trên Postgres** (`auth.instances`, …).

6. **Script:** `scripts/pg-backup-source.mjs` (`SUPABASE_DB_URL`), `scripts/legacy/*` — chỉnh comment/tên biến khi refactor; không bắt buộc một lần.

7. **Grep kiểm tra:** Từ thư mục gốc repo (bỏ qua `node_modules`):

   ```bash
   rg -i supabase --glob '!node_modules/**' --glob '!package-lock.json'
   ```

   Mục tiêu cuối: chỉ còn (nếu chưa refactor CLI) thư mục tên `supabase/` + doc này, hoặc **không còn** sau khi làm mục 4.

---

## 4. CLI `supabase` trong `devDependencies` và thư mục `supabase/`

- **`package.json`:** Script `db:migrate:push` / `db:push` gọi `supabase db push`; `db:sql:*` gọi `supabase db query`. Để **bỏ hẳn** binary Supabase:
  - Thay bằng quy trình apply SQL từ `db/migrations/` (vd. `psql "$DATABASE_URL" -f ...`, hoặc tool migration nội bộ).
  - Sau đó xóa `devDependency` `"supabase": "..."`.
  - **Quyết định** có giữ `scripts/ensure-pg-migration-cli-link.mjs` + folder `supabase/` hay không: nếu không còn CLI nào đọc `supabase/migrations`, có thể xóa symlink script và chỉ giữ `db/migrations/` (cần cập nhật `postinstall` và tài liệu deploy).

---

## 5. Quy tắc cho PR / AI assistant (tránh tái nhập Supabase)

- **Không** thêm package `@supabase/supabase-js` cho tính năng mới; dùng `pg`, API route server, hoặc client gọi API nội bộ.
- **Không** thêm biến env mới có prefix `SUPABASE_*`; dùng tên trung tính và cập nhật `.env.example` + `docs/ENV_LOCAL_REFERENCE.md`.
- Nếu tích hợp auth/storage: ưu tiên **Postgres + Bunny** và pattern đã có trong codebase.

---

## Tài liệu liên quan

- `docs/ENV_LOCAL_REFERENCE.md` — bảng biến env.
- `.env.example` — mục Storage legacy và alias (dòng comment “Alias cũ”).
