# Chạy SQL trực tiếp trên Supabase (Dashboard)

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) → chọn project.
2. **SQL Editor** → **New query**.
3. Mở file `.sql` trong thư mục này, copy **toàn bộ** nội dung, dán vào editor.
4. Bấm **Run** (hoặc `Ctrl+Enter`).

| File | Mục đích |
|------|----------|
| `xoa-bai-tap-ai.sql` | Xóa câu hỏi + phiếu + job + … (**giữ** `worksheet_curricula`). |
| `reset-full-giao-trinh-va-slide-ai.sql` | Xóa **cả** giáo trình + slide + phiếu + câu + job (reset lớn). |
| `tao-ham-get-worksheet-ids-for-reverify.sql` | Tạo RPC `get_worksheet_ids_for_reverify` (tùy chọn). |

Bản tương đương trong repo (CLI / đồng bộ migration):  
`scripts/delete-worksheet-exercises-for-recreate.sql`, `scripts/reset-curriculum-worksheet-data.sql`.

**Lưu ý:** Tắt app local đang nối DB nếu gặp deadlock khi truncate.
