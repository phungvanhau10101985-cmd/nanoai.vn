# SQL copy-paste (Postgres)

Các file `.sql` ở đây chạy **trực tiếp** trên database (bất kỳ host Postgres nào): **SQL Editor** của nhà cung cấp, **pgAdmin**, **`psql`**, v.v.

1. Kết nối tới đúng database (dev/test — không dùng trên production nếu chưa hiểu rủi ro).
2. Mở file `.sql` trong thư mục này, copy **toàn bộ** nội dung, dán vào client SQL.
3. Chạy (Run / `Ctrl+Enter` / `\i file.sql` tùy công cụ).

| File | Mục đích |
|------|----------|
| `xoa-giao-trinh-va-slide.sql` | Xóa giáo trình + slide + dữ liệu theo tiết (giữ dữ liệu user/lớp/credits). |
| `xoa-bai-tap-ai.sql` | Xóa câu hỏi + phiếu + job + … (**giữ** `worksheet_curricula`). |
| `reset-full-giao-trinh-va-slide-ai.sql` | Xóa **cả** giáo trình + slide + phiếu + câu + job (reset lớn). |
| `tao-ham-get-worksheet-ids-for-reverify.sql` | Tạo RPC `get_worksheet_ids_for_reverify` (tùy chọn). |

Bản tương đương trong repo (CLI / migration):  
`scripts/delete-worksheet-exercises-for-recreate.sql`, `scripts/reset-curriculum-worksheet-data.sql`.

**Lưu ý:** Tắt app local đang nối DB nếu gặp deadlock khi truncate.
