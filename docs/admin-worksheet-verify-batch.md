# Admin – verify hàng loạt phiếu bài tập

## Mục đích

- Tìm các **phiếu** (`worksheet_worksheets`) còn ít nhất một câu trong `question_ids` có `verified_at IS NULL`.
- Chạy cùng luồng AI như `/api/worksheet-verify-background` (Gemini Flash, v.v.) **theo từng phiếu**.
- Lưu **báo cáo** vào bảng `worksheet_verify_batch_reports` và xem tại **`/admin/worksheet-verify-reports`**.

## Triển khai DB

```bash
npm run db:migrate:push
```

Migration: `db/migrations/20260327000000_worksheet_verify_batch_reports.sql` (bảng + RPC `get_worksheet_ids_pending_verify` – chỉ `service_role` gọi được).

## Cấu hình

- **`LEGACY_HTTP_SERVICE_ROLE_KEY`** (hoặc alias trong `.env.example`): bắt buộc cho API admin batch; **cũng nên có** cho `/api/worksheet-verify-background` vì bảng `worksheet_questions` chỉ có RLS UPDATE cho `user_id = auth.uid()` — verify phiếu của người khác hoặc ghi `verified_at` ổn định cần service role trên server.
- **`GOOGLE_API_KEY`**: bắt buộc cho bước gọi Gemini khi verify.
- **`ADMIN_WORKSHEET_VERIFY_CRON_SECRET`** (tùy chọn): bí mật cho cron tự động.

## API

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/admin/worksheet-verify-batch` | Admin: danh sách báo cáo (80 bản gần nhất). |
| `GET /api/admin/worksheet-verify-batch?id=<uuid>` | Admin: một báo cáo kèm `details` + `progress`. |
| `POST /api/admin/worksheet-verify-batch` body `{"action":"start"}` | Tạo báo cáo mới + hàng đợi phiếu pending. |
| `POST ...` body `{"action":"step","reportId":"...","batchSize":1}` | Xử lý thêm `batchSize` phiếu (mặc định nên 1 để tránh timeout). |
| `GET /api/cron/worksheet-verify-batch?batchSize=2` + header `Authorization: Bearer <secret>` | Tiếp tục lô đang `running` hoặc tạo lô mới nếu có pending. |

## Giao diện admin

- **Quản trị → Chất lượng verify phiếu bài tập** (`/admin/worksheet-verify-reports`).
- **Bắt đầu quét mới**: tạo báo cáo rồi tự gọi `step` lặp lại đến khi `completed` (có nút dừng sau bước hiện tại).

## Lưu ý

- Mỗi câu chỉ verify một lần (đã có `verified_at` thì bỏ qua) – giữ nguyên behavior cũ.
- Câu không nằm trong `question_ids` của phiếu nào **không** nằm trong hàng đợi quét theo phiếu.
