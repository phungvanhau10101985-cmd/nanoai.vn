# Reset dữ liệu AI test

Script xóa dữ liệu do AI tạo ra để test lại, **giữ nguyên** dữ liệu quan trọng.

## Chọn script phù hợp

| Mục đích | File | Chạy |
|----------|------|------|
| **Chỉ giáo trình + phiếu + slide** | `scripts/reset-curriculum-worksheet-data.sql` | Supabase Dashboard → SQL Editor |
| **Toàn bộ AI** (exam, worksheet, language coach, music, try_on...) | `supabase/scripts/reset-ai-test-data.sql` | Supabase Dashboard → SQL Editor |
| **Chỉ language coach** | `npm run reset-db:language-coach` | Node.js (cần .env.local) |

## Cách chạy (SQL)

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Mở file tương ứng
3. Copy toàn bộ nội dung, paste vào SQL Editor, bấm **Run**

## Dữ liệu GIỮ LẠI (không bao giờ xóa)

| Bảng | Mô tả |
|------|-------|
| `auth.users` | Tài khoản đăng nhập |
| `profiles` | Hồ sơ người dùng |
| `credits` | Số dư credit |
| `transactions` | Lịch sử giao dịch nạp/rút |
| `worksheet_official_questions` | Câu hỏi đã up lên (ngân hàng Bộ GD, VNHSGE, SGK) |
| `worksheet_textbook_lessons` | Mục lục bài học chuẩn SGK (seed) |

## Dữ liệu BỊ XÓA

- **Bài thi**: `exam_sessions`, `exam_questions`, `exam_attempts`
- **Giáo trình & phiếu**: `worksheet_curricula`, `worksheet_worksheets`, slides, quiz
- **Học ngoại ngữ AI**: `language_coach_*` (live lessons, messages, cache, v.v.)
- **Khác**: `music_generations`, `try_on_history`, `translate_jobs`, `house_build_projects`, `api_usage_log`, `notifications`

## Lưu ý

- Chạy script **sau khi** đã apply đủ migrations.
- Nếu bảng nào chưa tồn tại, script sẽ báo lỗi – bỏ qua dòng đó hoặc tạo migration tương ứng trước.
