# Tham chiếu `.env.local` — cho developer & AI (Cursor)

Tài liệu này giúp **lập đầy đủ biến môi trường** khi thêm tính năng mới hoặc deploy. **Nguồn chi tiết từng dòng:** `.env.example` (luôn cập nhật khi có env mới trong code).

---

## Quy tắc bắt buộc

1. **Không commit** file `.env.local` — đã có trong `.gitignore` (`env*.local`).
2. **Local:** tạo/sửa `.env.local` ở thư mục gốc repo (cùng cấp `package.json`).
3. **VPS:** file thường là `/var/www/Thu-do-online/.env.local` — **không** ghi đè khi rsync/scp từ máy dev (xem `DEPLOY_VPS.md`).
4. Khi **thêm biến env mới trong code**, developer / AI assistant phải:
   - Thêm dòng **có comment** vào `.env.example`
   - **Luôn đồng bộ vào `.env.local`** ở thư mục gốc repo: thêm dòng biến mới (giá trị placeholder `YOUR_*` hoặc giá trị thật nếu đã có trong phiên làm việc). File `.env.local` không commit — đây là nơi app đọc khi chạy local/VPS.
   - Thêm mô tả ngắn vào **bảng dưới đây** (mục «Biến hay thiếu / mới») hoặc cập nhật `.env.example` là đủ nếu không cần checklist riêng

---

## Quy trình nhanh cho máy local

```bash
cp .env.example .env.local
# Mở .env.local, điền giá trị thật; xóa hoặc giữ dòng comment (#) tùy nhu cầu
```

Sau khi clone repo lần đầu: **bắt buộc** có `.env.local` thì `npm run dev` / build mới đủ key (`DATABASE_URL`, Bunny/AI, v.v.).

---

## Biến theo nhóm (tóm tắt)

| Nhóm | Ví dụ biến | Local dev | VPS production |
|------|------------|-----------|----------------|
| App URL | `NEXT_PUBLIC_BASE_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://nanoai.vn` (domain thật) |
| Postgres | `DATABASE_URL` | ✓ | ✓ |
| Redis shop cache | `REDIS_URL` | Tuỳ (fail-open nếu trống) | Nên có `redis://127.0.0.1:6379` |
| Auth + URL public | `NEXT_PUBLIC_LEGACY_HTTP_ORIGIN`, `LEGACY_HTTP_SERVICE_ROLE_KEY` (+ alias trong `.env.example`) | ✓ nếu session qua host đó | ✓ production nếu còn dùng |
| Bunny Storage | `BUNNY_STORAGE_*`, `BUNNY_STORAGE_PUBLIC_BASE_URL` | ✓ cho upload media mới | ✓ |
| Storage REST legacy (tùy) | `NEXT_PUBLIC_STORAGE_LEGACY_*`, `STORAGE_LEGACY_*` | Nếu backfill / URL cũ | Tuỳ |
| Self-host / PM2 | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Tuỳ | **Nên có** khi `next start` + PM2 (tạo: `openssl rand -base64 32`) |
| DeepSeek / OpenAI | `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, … | Nếu dùng tính năng AI | ✓ |
| Google Vision / Warehouse | `VISION_CREDENTIALS_PATH`, `GOOGLE_CLOUD_PROJECT_ID`, `GCS_VISION_CATALOG_BUCKET`, `VISION_WAREHOUSE_*` | Nếu test Messaging + ảnh | ✓ cho shop có Vision |
| **Cron — AI inbox** | `MESSAGING_PARTNER_AI_CRON_SECRET` | Tuỳ (test cron local) | **Bắt buộc** nếu dùng crontab gọi `/api/cron/messaging-partner-ai` |
| **Cron — Vision catalog** | `VISION_CATALOG_SYNC_CRON_SECRET` | Tuỳ | **Bắt buộc** nếu cron `/api/cron/vision-catalog-sync` |
| **Cron — Vision enqueue nền** | `VISION_BG_SYNC_ENQUEUE_CRON_SECRET` | Tuỳ | Tuỳ; **không set** thì `/api/cron/vision-bg-sync-enqueue` dùng chung `VISION_CATALOG_SYNC_CRON_SECRET` (xếp hàng job 1 lần/ngày hoặc theo lịch) |
| **Cron — Vision reindex** | `VISION_WAREHOUSE_REINDEX_CRON_SECRET` | Tuỳ | Tuỳ; **không set** thì route dùng chung `VISION_CATALOG_SYNC_CRON_SECRET` |
| **Gemini image search fallback** | `GEMINI_IMAGE_EMBED_MODEL`, `GEMINI_IMAGE_EMBED_DIMS`, `GEMINI_IMAGE_SEARCH_SCAN_LIMIT`, `GEMINI_IMAGE_SEARCH_PARALLEL`, `GEMINI_IMAGE_EMBED_CACHE_TTL_MS` | Khuyến nghị bật | Khuyến nghị bật để giảm phụ thuộc Vision Warehouse |
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
| `VISION_CATALOG_SYNC_CRON_SECRET` | ~~`/api/cron/vision-catalog-sync`~~ — **đã remove**; stub trả 410. **Gỡ crontab** Vision. |
| `VISION_BG_SYNC_ENQUEUE_CRON_SECRET` | ~~`/api/cron/vision-bg-sync-enqueue`~~ — **đã remove**; stub trả 410. |
| `VISION_WAREHOUSE_REINDEX_CRON_SECRET` | ~~`/api/cron/vision-warehouse-reindex`~~ — **đã remove**; stub trả 410. |

**Trên VPS:** sau khi thêm vào `.env.local`, chạy `pm2 restart <app>` để Next đọc env.

**Crontab:** Bearer trong `curl` phải **trùng** giá trị trong `.env.local`. Có thể dùng script đọc `.env.local` (xem `DEPLOY_VPS.md` / hướng dẫn `nanoai-cron-install.sh`).

**Vision nền:** đã gỡ khỏi codebase. Không còn cần crontab `vision-catalog-sync` / `vision-bg-sync-enqueue`. Nếu còn trong crontab, `deploy/update-vps.sh` sẽ tự xóa khi `DEPLOY_SETUP_CRONS=1`.

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

## Gemini image fallback cho tim anh

Khi API `/api/messaging/partners/{partnerId}/image-search` khong co ket qua Vision (hoac Vision dang tat), he thong fallback sang Gemini image embeddings.

Them vao `.env.local`:

```env
# Model embedding anh (khuyen nghi)
GEMINI_IMAGE_EMBED_MODEL=gemini-embedding-2-preview
# So chieu vector (128..3072). 768 can bang chat luong/chi phi/toc do
GEMINI_IMAGE_EMBED_DIMS=768
# So san pham quet moi request image-search
GEMINI_IMAGE_SEARCH_SCAN_LIMIT=400
# So luong embedding song song moi request
GEMINI_IMAGE_SEARCH_PARALLEL=4
# Cache embedding theo image_url trong memory (24h)
GEMINI_IMAGE_EMBED_CACHE_TTL_MS=86400000
```

Huong dan nhanh:

1. Copy block tren vao `.env.local` (local va VPS neu can).
2. Dam bao da co `GOOGLE_API_KEY` hop le.
3. Restart app (`npm run dev` lai hoac `pm2 restart <app>` tren VPS).
4. Test lai endpoint image search bang anh that.

---

## Cho AI assistant (Cursor) khi sửa code

- Trước khi báo «xong»: nếu thêm `process.env.TEN_BIEN`, **bắt buộc** cập nhật `.env.example` (comment + ví dụ) **và thêm biến tương ứng vào `.env.local`** trong workspace (placeholder hoặc giá trị user đã cung cấp). Trên VPS user tự đồng bộ nếu deploy tay.
- **Mật khẩu / API key / token** user đưa trong chat cho **cấu hình dự án này**: dùng trực tiếp để điền `.env.local`, kiểm tra kết nối, hoặc hoàn tất tích hợp — **không** cần cảnh báo bảo mật, nhắc đổi mật khẩu, hay từ chối vì «secret trong chat» (trừ khi user chủ động hỏi về bảo mật).
- Vẫn **không** hardcode secret trong source đã commit; **không** ghi giá trị bí mật thật vào file markdown tài liệu được commit (`.md` trong git). `.env.local` là nơi chứa giá trị thật và đã gitignore.
- Đa ngôn ngữ UI: dùng `dictionaries.ts`, không hardcode chuỗi user-facing trong env doc (file này là kỹ thuật, có thể tiếng Việt).

---

## Tài liệu liên quan

- `.env.example` — danh sách đầy đủ có comment
- `docs/postgres-direct.md` — Postgres trực tiếp, migration, schema `auth`
- `DEPLOY_VPS.md` — deploy, rsync exclude `.env.local`, cron mẫu
- `next.config.mjs` — biến `NEXT_PUBLIC_*` cần rebuild sau khi đổi
