# Cấu hình đăng nhập qua ngrok (mobile)

## Các thay đổi đã thực hiện

1. **Base URL động**: Google OAuth dùng URL từ request (host + protocol) thay vì `NEXT_PUBLIC_BASE_URL`, nên khi truy cập qua ngrok sẽ redirect đúng domain.
2. **Header ngrok**: Form đăng nhập gửi header `ngrok-skip-browser-warning` khi dùng domain ngrok để tránh trang cảnh báo chặn.

## Cấu hình OAuth / Redirect URL

Nơi bạn đăng ký **Google OAuth** và **Redirect URLs** (trùng với host trong `NEXT_PUBLIC_LEGACY_HTTP_ORIGIN` hoặc alias env cũ nếu session đi qua host đó):

1. **Authentication** → **URL Configuration** (menu tùy nhà cung cấp).
2. Thêm **Redirect URLs**:
   - `https://amia-canelike-exhibitively.ngrok-free.dev/**`
   - Hoặc dùng wildcard: `https://*.ngrok-free.dev/**`
3. **Site URL** (tùy chọn khi test): Có thể đặt `https://amia-canelike-exhibitively.ngrok-free.dev`.

## Biến môi trường

Khi chạy qua ngrok, không cần đổi `NEXT_PUBLIC_BASE_URL` vì app tự lấy URL từ request.

## Khắc phục khi đăng nhập thất bại

1. **"Server từ chối kết nối"**: Thường do ngrok chặn vì thiếu header. Đã xử lý cho form login.
2. **Redirect không chạy**: Kiểm tra host Auth đã có đúng redirect URL (và khớp domain ngrok hiện tại).
3. **Cookie không lưu**: Đảm bảo dùng HTTPS qua ngrok.
