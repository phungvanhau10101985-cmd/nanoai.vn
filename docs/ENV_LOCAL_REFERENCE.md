# Tham chiếu `.env.local` — cho developer & AI (Cursor)

Tài liệu này giúp **lập đầy đủ biến môi trường** khi thêm tính năng mới hoặc deploy. **Nguồn chi tiết từng dòng:** `.env.example` (luôn cập nhật khi có env mới trong code).

---

## Quy tắc bắt buộc

1. **Không commit** file `.env.local` — đã có trong `.gitignore` (`env*.local`).
2. **Local:** tạo/sửa `.env.local` ở thư mục gốc repo (cùng cấp `package.json`).
3. **VPS:** file thường là `/var/www/Thu-do-online/.env.local` — **không** ghi đè khi rsync/scp từ máy dev (xem `DEPLOY_VPS.md`).
4. Khi **thêm biến env mới trong code**, developer phải:
   - Thêm dòng **có comment** vào `.env.example`
   - Thêm mô tả ngắn vào **bảng dưới đây** (mục «Biến hay thiếu / mới») hoặc cập nhật `.env.example` là đủ nếu không cần checklist riêng

---

## Quy trình nhanh cho máy local

```bash
cp .env.example .env.local
# Mở .env.local, điền giá trị thật; xóa hoặc giữ dòng comment (#) tùy nhu cầu
```

Sau khi clone repo lần đầu: **bắt buộc** có `.env.local` thì `npm run dev` / build mới đủ key (Supabase, AI, v.v.).

---

## Biến theo nhóm (tóm tắt)

| Nhóm | Ví dụ biến | Local dev | VPS production |
|------|------------|-----------|----------------|
| App URL | `NEXT_PUBLIC_BASE_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://nanoai.vn` (domain thật) |
| Supabase | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ |
| Self-host / PM2 | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Tuỳ | **Nên có** khi `next start` + PM2 (tạo: `openssl rand -base64 32`) |
| DeepSeek / OpenAI | `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, … | Nếu dùng tính năng AI | ✓ |
| Google Vision / Warehouse | `VISION_CREDENTIALS_PATH`, `GOOGLE_CLOUD_PROJECT_ID`, `GCS_VISION_CATALOG_BUCKET`, `VISION_WAREHOUSE_*` | Nếu test Messaging + ảnh | ✓ cho shop có Vision |
| **Cron — AI inbox** | `MESSAGING_PARTNER_AI_CRON_SECRET` | Tuỳ (test cron local) | **Bắt buộc** nếu dùng crontab gọi `/api/cron/messaging-partner-ai` |
| **Cron — Vision catalog** | `VISION_CATALOG_SYNC_CRON_SECRET` | Tuỳ | **Bắt buộc** nếu cron `/api/cron/vision-catalog-sync` |
| **Cron — Vision enqueue nền** | `VISION_BG_SYNC_ENQUEUE_CRON_SECRET` | Tuỳ | Tuỳ; **không set** thì `/api/cron/vision-bg-sync-enqueue` dùng chung `VISION_CATALOG_SYNC_CRON_SECRET` (xếp hàng job 1 lần/ngày hoặc theo lịch) |
| **Cron — Vision reindex** | `VISION_WAREHOUSE_REINDEX_CRON_SECRET` | Tuỳ | Tuỳ; **không set** thì route dùng chung `VISION_CATALOG_SYNC_CRON_SECRET` |
| Wake không cron | `MESSAGING_PARTNER_AI_DEV_WAKE`, `MESSAGING_PARTNER_AI_INLINE_WAKE` | `DEV_WAKE=1` cho `next start` local | Chỉ 1 node; không thay cron production |
| Vision tinh chỉnh | `VISION_INCREMENTAL_BATCH_SIZE`, `VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST`, `VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS`, `VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS` | Tuỳ | Giảm 429 ImportAssets (mặc định 1 import/lượt + cooldown); tăng poll khi timeout |
| Khác | SePay, SMTP, VAPID, cron worksheet/exam… | Xem `.env.example` | Xem `.env.example` |

---

## Biến hay thiếu / dễ quên (Messaging + Vision)

Tạo secret dài (≥ 32 ký tự hex), ví dụ:

`openssl rand -hex 32`

| Biến | Endpoint / mục đích |
|------|---------------------|
| `MESSAGING_PARTNER_AI_CRON_SECRET` | `GET/POST /api/cron/messaging-partner-ai` — Header: `Authorization: Bearer <secret>` |
| `VISION_CATALOG_SYNC_CRON_SECRET` | `GET/POST /api/cron/vision-catalog-sync` — đồng bộ ảnh kho lên Vision Warehouse (nền) |
| `VISION_BG_SYNC_ENQUEUE_CRON_SECRET` | `GET/POST /api/cron/vision-bg-sync-enqueue` — xếp hàng job nền (vd. 1×/ngày); **optional**, fallback secret catalog |
| `VISION_WAREHOUSE_REINDEX_CRON_SECRET` | `GET/POST /api/cron/vision-warehouse-reindex` — analyze corpus + rebuild index; **optional** nếu dùng chung secret catalog |

**Trên VPS:** sau khi thêm vào `.env.local`, chạy `pm2 restart <app>` để Next đọc env.

**Crontab:** Bearer trong `curl` phải **trùng** giá trị trong `.env.local`. Có thể dùng script đọc `.env.local` (xem `DEPLOY_VPS.md` / hướng dẫn `nanoai-cron-install.sh`).

**Vision nền — bộ đôi khuyến nghị:** (1) `*/3 * * * *` gọi `/api/cron/vision-catalog-sync` để **chạy** job; (2) **một lần mỗi ngày** (vd. `15 3 * * *`) gọi `/api/cron/vision-bg-sync-enqueue` để **xếp hàng lại** (sau khi job cũ đã `done`/`error`). Hai URL khác nhau, có thể cùng secret `VISION_CATALOG_SYNC_CRON_SECRET`.

---

## Google Vision Warehouse (Image Warehouse)

Cần khi bật «Gợi ý theo ảnh» Messaging:

- `VISION_CREDENTIALS_PATH` — JSON service account (Vision AI + Storage)
- `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT_NUMBER` (Warehouse REST)
- `GCS_VISION_CATALOG_BUCKET`
- `VISION_WAREHOUSE_CORPUS_ID`, `VISION_WAREHOUSE_INDEX_ID`, `VISION_WAREHOUSE_INDEX_ENDPOINT_ID`

Chi tiết: `.env.example` mục Google AI / Vision và `VISION_API_SETUP.md` (nếu có).

**Lưu ý vận hành:** Google chỉ cho **một** `ImportAssets` chạy đồng thời / corpus — app dùng khóa DB (`vision_warehouse_runner`, migration `*_vision_warehouse_import_lock.sql`). Không cần biến env riêng cho khóa.

---

## Cho AI assistant (Cursor) khi sửa code

- Trước khi báo «xong»: nếu thêm `process.env.TEN_BIEN`, **bắt buộc** cập nhật `.env.example` (comment + ví dụ) và nhắc user thêm vào `.env.local` / VPS.
- Không hardcode secret trong repo; không ghi secret thật vào markdown trong git.
- Đa ngôn ngữ UI: dùng `dictionaries.ts`, không hardcode chuỗi user-facing trong env doc (file này là kỹ thuật, có thể tiếng Việt).

---

## Tài liệu liên quan

- `.env.example` — danh sách đầy đủ có comment
- `DEPLOY_VPS.md` — deploy, rsync exclude `.env.local`, cron mẫu
- `next.config.mjs` — biến `NEXT_PUBLIC_*` cần rebuild sau khi đổi
