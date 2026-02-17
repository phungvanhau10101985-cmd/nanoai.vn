# Cấu hình Google Cloud Vision API (xóa mặt người mẫu)

Ứng dụng sử dụng **Google Cloud Vision API** để nhận diện khuôn mặt trong ảnh sản phẩm, sau đó cắt bỏ phần mặt (từ cổ lên) trước khi gửi cho AI thử đồ. Chỉ phần trang phục được giữ lại.

## Quy trình xử lý

1. Ghép tất cả ảnh sản phẩm theo thứ tự (người 1 → 2 → 3 → …).
2. Gửi từng ảnh lên **Vision API** để nhận diện khuôn mặt.
3. Lấy tọa độ bounding box / landmarks (cằm).
4. Cắt ảnh: bỏ phần từ cổ lên, chỉ giữ phần trang phục.
5. Gửi ảnh đã xử lý cho AI theo đúng thứ tự ban đầu.

## Cấu hình

### 1. Bật Vision API

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project (hoặc tạo mới)
3. Vào **APIs & Services** → **Library**
4. Tìm **Cloud Vision API** → **Enable**

### 2. Chọn một trong hai cách xác thực

**Cách A: Service account (khuyến nghị)**

1. Vào **APIs & Services** → **Credentials** → **Create Credentials** → **Service account**
2. Tạo service account, tải file JSON
3. Đặt file vào thư mục dự án: `gcp-credentials.json`
4. Thêm vào `.env.local`:

```env
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
```

**Cách B: API key**

1. Vào **APIs & Services** → **Credentials** → **Create Credentials** → **API key**
2. Thêm vào `.env.local`:

```env
GOOGLE_CLOUD_VISION_API_KEY=AIzaSy...your_api_key_here
```

## Khi không cấu hình

Nếu `GOOGLE_CLOUD_VISION_API_KEY` **không được cấu hình**:

- **Không cắt ảnh** – giữ nguyên ảnh gốc gửi cho AI.
- Lý do: ảnh sản phẩm có thể là người mẫu (có mặt), giày dép, flatlay (không mặt) – cắt mù 28% sẽ hỏng ảnh giày hoặc ảnh không có người.

## Chi phí Vision API

- [Bảng giá Cloud Vision API](https://cloud.google.com/vision/pricing)
- Face Detection: ~$1.50 / 1.000 ảnh
- Có thể dùng $300 free credits cho tài khoản mới
