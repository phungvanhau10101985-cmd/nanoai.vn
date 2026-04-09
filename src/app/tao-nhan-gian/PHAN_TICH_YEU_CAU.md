# Phân tích yêu cầu – Tạo nhãn dán (Sticker) với Gemini

## 1. Luồng xử lý hiện tại

```
Người dùng nhập ý tưởng (tiếng Việt)
    → Bước 1: Gemini Flash 2.5 mở rộng ý tưởng thành mô tả chi tiết
    → Bước 2: Gemini 3 Pro Image tạo ảnh nhãn dán từ mô tả
    → Kết quả: PNG nền trong suốt, lưu storage (Bunny), trừ credits
```

## 2. Yêu cầu chức năng

| Yêu cầu | Mô tả |
|---------|-------|
| **Đầu vào** | Ý tưởng ngắn gọn (1–2 câu) về nhãn dán cần tạo |
| **Định dạng** | PNG nền trong suốt (alpha channel) để in sticker |
| **Bố cục** | Thiết kế sát mép khung (full-bleed), không để khoảng trống quanh |
| **Phong cách** | Đường nét rõ, cel-shading đơn giản, màu sắc tươi sáng |
| **Tỷ lệ** | 1:1, 4:3, 3:4, 16:9, 9:16 |
| **Chất lượng** | 2K (2 credit) hoặc 4K (4 credit) |

## 3. Phân tích prompt

### 3.1 Prompt mở rộng ý tưởng (Gemini Flash)

**Mục đích:** Chuyển ý tưởng ngắn → mô tả chi tiết để AI vẽ chính xác.

**Yêu cầu:**
- Nhận ý tưởng tiếng Việt
- Mở rộng: nhân vật, phong cách, màu sắc, chi tiết, bố cục
- Nhấn mạnh: thiết kế sát mép, không để khoảng trống
- Độ dài: 2–4 câu
- **Ngôn ngữ output:** Tiếng Việt (theo yêu cầu người dùng)

### 3.2 Prompt tạo ảnh (Gemini Image)

**Mục đích:** Vẽ nhãn dán theo mô tả.

**Yêu cầu bắt buộc:**
1. Nền trong suốt (PNG alpha)
2. Thiết kế sát mép khung (full-bleed)
3. Phong cách: đường nét rõ, cel-shading, màu tươi
4. Phù hợp in sticker/nhãn dán

**Ngôn ngữ:** Tiếng Việt – Gemini hỗ trợ đa ngôn ngữ.

## 4. Ví dụ ý tưởng → mô tả chi tiết

| Ý tưởng (input) | Mô tả mở rộng (output) |
|-----------------|------------------------|
| Gấu trúc kawaii đội mũ tre | Nhãn dán phong cách kawaii: gấu trúc dễ thương đội mũ tre nhỏ, đang ăn lá trúc xanh. Gấu trúc và lá trúc chạm sát mép khung. Đường nét đậm, tô màu cel-shading đơn giản, màu sắc tươi sáng. |
| Logo cafe ABC | Logo nhãn dán: cốc cà phê cách điệu kèm chữ ABC. Thiết kế minimalist, đường nét sạch. Cốc và chữ chạm mép khung. Màu nâu cà phê, kem, đen. |
| Mèo vẫy tay | Nhãn dán mèo dễ thương đang vẫy chân trước, biểu cảm vui. Phong cách cartoon, đường viền đậm. Mèo và bong bóng trang trí sát mép ảnh. Màu pastel. |
