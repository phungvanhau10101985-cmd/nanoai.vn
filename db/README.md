# Postgres — migration SQL

- **`migrations/`**: file `.sql` theo thứ tự tên — áp lên **bất kỳ Postgres nào** qua `DATABASE_URL`.
- **Cùng một quy trình** cho **máy dev** và **server deploy**: chỉ khác giá trị `DATABASE_URL` (DB local vs DB production).

### Reset DB local sạch (khi schema lệch nặng)

Chỉ dùng trên **máy dev**; script chỉ cho phép host `127.0.0.1` / `localhost` / `::1`:

```bash
npm run db:recreate:local
```

Lệnh **drop + create** lại database trong `DATABASE_URL`, bootstrap tối thiểu `auth.users` + `storage`, chạy `pg:ensure-auth-compat`, rồi áp toàn bộ `db/migrations/`. **Không** chạy trên production.

---

## Quy trình chuẩn (local ổn = deploy ổn)

### 1. Biến môi trường

- **Local:** `DATABASE_URL` trong `.env.local` (hoặc export trong shell).
- **Deploy (VPS/PM2):** cùng tên biến trong `.env`, `ecosystem.config`, hoặc secret của CI — **một URL trỏ đúng Postgres của môi trường đó**.

Không commit chuỗi kết nối có mật khẩu vào git.

### 2. Mỗi lần cần schema mới (sau `git pull` có thêm file trong `db/migrations/`)

Chạy **trên đúng môi trường** (local hoặc server):

```bash
npm run db:migrate:status   # Chờ: 0 = đã khớp repo
npm run db:migrate:push     # hoặc: npm run db:sync — chạy hết file pending
```

- Lần đầu DB **trống**: `db:migrate:push` chạy từ `20240101000000_init.sql` trở đi theo thứ tự.
- Deploy: **sau khi pull code mới**, chạy `db:migrate:push` **trước** (hoặc ngay trước) `next build` / restart app — miễn là trước khi code mới **cần** bảng/cột mới.

Thứ tự khuyến nghị trên server:

1. `git pull`
2. `npm ci` hoặc `npm install`
3. **`npm run db:migrate:push`**
4. `npm run build`
5. `pm2 restart …` (hoặc lệnh start tương đương)

`restart-server.bat` (Windows local) đã gọi `db:migrate:push` trước khi bật dev — giữ đúng hướng đó.

**Cô lập với 188-com-vn:** `restart-server` / `scripts/restart-server-stop-dev.ps1` chỉ dừng LISTEN cổng Thu-do (mặc định **3000**) và ngrok forward đúng cổng đó. Không kill cổng **8001/3001**, không `taskkill ngrok*`, không đụng file `dev-clear-start.*` trong repo `188-com-vn`.

### 3. Môi trường mới hoàn toàn (Postgres rỗng)

1. Tạo database + user (hoặc dùng Docker Postgres).
2. Đặt `DATABASE_URL` trỏ vào DB đó.
3. Một lần: `npm run db:migrate:push` → bảng tracking `public.app_applied_sql_migrations` được tạo và mọi file `.sql` pending được áp lần lượt.

Đây là cách **sạch nhất**; local và production nên **cùng kiểu**: DB mới → chỉ `migrate:push`, **không** `--mark-all-applied`.

### 4. Tránh làm lệch tracking

| Việc | Khi nào |
|------|--------|
| `node scripts/pg-apply-migrations.mjs --mark-all-applied` | Chỉ khi bạn **chắc** schema DB đã giống hết các file migration (ví dụ vừa `pg_restore` từ bản full), và muốn “bắt kịp” bảng tracking **một lần**. Sai lầm → migration sau không chạy → thiếu bảng/cột. |
| Sửa tay DB rồi không ghi vào `migrations/` | Dễ lệch giữa máy; nên đưa thay đổi vào file SQL mới trong `db/migrations/`. |

### 5. Nếu DB local đã “vỡ” (đã từng chạy SQL tay / lệch init)

- **Ổn định lâu dài:** tạo Postgres **mới**, chỉ `DATABASE_URL` + `npm run db:migrate:push`.
- Hoặc restore **bản dump đầy đủ** từ môi trường đúng schema, rồi cân nhắc `--mark-all-applied` **một lần** (đọc cảnh báo trên).

---

## Bảng nền

`public.profiles`, `public.credits` và phần lớn nền tảng đến từ `20240101000000_init.sql`. File `20260412140000_ensure_public_profiles_and_credits.sql` bổ sung an toàn (`IF NOT EXISTS`) khi thiếu hai bảng này; vẫn nên coi **chuỗi migration đầy đủ** là nguồn sự thật.

---

## Lệnh tương đương

```bash
node scripts/pg-apply-migrations.mjs           # dry-run: liệt kê pending
node scripts/pg-apply-migrations.mjs --apply   # giống npm run db:migrate:push
```
