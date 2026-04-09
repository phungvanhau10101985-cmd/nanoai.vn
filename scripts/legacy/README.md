# Script tham khảo / một lần (lịch sử)

Các file ở đây phục vụ **migration source** khi gỡ SDK/hosted client cũ — không nằm trong quy trình build hay deploy.

| File | Mục đích |
|------|----------|
| `migrate-service-role-clients.mjs` | One-off cũ: pattern thay import `service-role` / `createClient` (module hosted cũ đã gỡ). |
| `cleanup-orphan-legacy-sdk-imports.mjs` | Xóa import orphan từ package npm cũ (regex theo tên module). |

Chạy từ thư mục gốc repo: `node scripts/legacy/<file>.mjs`.
