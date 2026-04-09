# Worksheet Background Jobs – Chạy ngầm khi đóng trình duyệt

## Tổng quan

Tạo bài từ SGK, tạo câu trắc nghiệm/tự luận từng bước chạy **ngầm trên server**. User có thể đóng tab, trình duyệt hoặc tắt máy – job vẫn tiếp tục chạy.

## Kiến trúc

```
Client → POST /api/worksheet-submit-job → Trả jobId ngay
                ↓
         worksheet_jobs (DB)
                ↓
         Worker (npm run worker) → Xử lý → Cập nhật result
                ↓
         Client poll GET /api/worksheet-job-status?jobId=xxx
```

## Các loại job

| Type | Mô tả |
|------|-------|
| `parse_sgk` | Tách câu từ ảnh SGK |
| `step_by_step_quiz` | Tạo câu trắc nghiệm từng câu |
| `step_by_step_essay` | Tạo bài tự luận từng câu |

## Chạy Worker trên VPS

```bash
# Cài đặt
npm install

# Chạy thủ công
npm run worker

# PM2 (khuyến nghị – tự restart khi crash)
pm2 start "npm run worker" --name worksheet-worker
pm2 save
pm2 startup
```

## Biến môi trường

- `DATABASE_URL` — Postgres (bảng `worksheet_jobs`, v.v.)
- `GOOGLE_API_KEY` — Gemini khi job cần gọi AI

Đặt trong `.env.local` hoặc `.env` (worker tự load). Không còn PostgREST / SDK JS client cũ cho bảng này.

## Khôi phục khi quay lại trang

Khi user đóng trang rồi quay lại, client tự kiểm tra `localStorage` và tiếp tục poll job đang chạy. Kết quả hiển thị khi job hoàn thành.

## File liên quan

- `supabase/migrations/20260325000000_create_worksheet_jobs.sql`
- `src/app/api/worksheet-submit-job/route.ts`
- `src/app/api/worksheet-job-status/route.ts`
- `scripts/worksheet-job-worker.ts`
- `src/lib/worksheet-job/parse-sgk-handler.ts`
- `src/lib/worksheet-job/step-by-step-handler.ts`
