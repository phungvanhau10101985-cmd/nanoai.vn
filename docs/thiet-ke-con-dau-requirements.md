# Thiết kế con dấu – Thiết kế đầy đủ

## Tổng quan

Tính năng **Thiết kế con dấu** dùng AI tạo mẫu con dấu chuyên nghiệp, bao gồm: con dấu doanh nghiệp, chi nhánh, chức danh, con dấu trang trí. (Tem niêm phong, bảo hành, chính hãng dùng tính năng riêng: Tạo tem niêm phong, bảo hành.)

---

## 1. Loại con dấu (Stamp Type)

| Loại | Mã | Mô tả | Trường bắt buộc |
|------|-----|-------|-----------------|
| **Con dấu doanh nghiệp** | `doanh-nghiep` | Dấu chính công ty | Tên DN, MST |
| **Con dấu chi nhánh** | `chi-nhanh` | Dấu chi nhánh, VPĐD | Tên DN, MST, Tên chi nhánh |
| **Con dấu chức danh** | `chuc-danh` | Giám đốc, Kế toán trưởng... | Tên DN, MST, Chức danh, Họ tên người giữ chức danh |
| **Con dấu địa chỉ** | `dia-chi` | Dấu địa chỉ | Địa chỉ |
| **Dấu đã thu tiền** | `da-thu-tien` | Xác nhận đã thu tiền | Dòng chính (mặc định ĐÃ THU TIỀN) |
| **Con dấu trang trí** | `trang-tri` | Dấu tùy chỉnh, craft | Nội dung tùy ý |

**Lưu ý:** Tem niêm phong, bảo hành, chính hãng đã có sẵn tại `/tao-tem-niem-phong-bao-hanh`.

**Hình dạng:** Tròn, Vuông, Elip, Chữ nhật. Tỷ lệ khung hình tự động theo hình dạng (elip → 3:2, chữ nhật → 4:3), người dùng không chọn.

---

## 2. Trường dữ liệu theo từng loại

### Con dấu doanh nghiệp / Chi nhánh / Chức danh

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Tên doanh nghiệp | ✓ | CÔNG TY TNHH ABC |
| Mã số doanh nghiệp (MST) | ✓ | 0123456789 (10–13 số) |
| Tên chi nhánh | (chi nhánh) | CHI NHÁNH TP.HCM |
| Chức danh | (chức danh) | GIÁM ĐỐC, KẾ TOÁN TRƯỞNG |
| Họ tên người giữ chức danh | (chức danh) | NGUYỄN VĂN A |
| Địa chỉ / Tỉnh thành | | TP. Hồ Chí Minh |
| Logo | | Upload ảnh |

### Con dấu địa chỉ

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Địa chỉ | ✓ | Địa chỉ là nội dung chính |
| Tên công ty | | Tùy chọn |

### Dấu đã thu tiền

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Dòng chính | ✓ | Mặc định ĐÃ THU TIỀN |
| Nội dung phụ | | Ngày, số tiền (tùy chọn) |

### Con dấu trang trí

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Nội dung chính | ✓ | Text tùy ý |
| Nội dung phụ | | Dòng nhỏ bên dưới |

---

## 3. Tùy chọn chung (tất cả loại)

| Trường | Giá trị | Mặc định |
|--------|---------|----------|
| **Hình dạng** | Tròn, Vuông, Elip, Chữ nhật | Tròn |
| **Tỷ lệ (tự động)** | Tròn/Vuông: 1:1, Elip: 3:2, Chữ nhật: 4:3 | Theo hình dạng |
| **Màu sắc** | Đỏ, Xanh lá, Xanh dương, Đen, Vàng, Cam | Đỏ |
| **Kích thước (mm)** | 20, 22, 25, 30, 35, 40, 45 | 25 |
| **Logo** | Upload ảnh | - |
| **Tỷ lệ ảnh** | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4 | 1:1 |
| **Chất lượng** | 2K (1,5 credit), 4K (3 credit) | 2K |

---

## 4. Nội dung CẤM (con dấu pháp lý)

- Quốc huy, Quốc kỳ, Đảng kỳ
- Biểu tượng cơ quan nhà nước, đơn vị vũ trang
- Từ ngữ ảnh hưởng truyền thống, văn hóa, đạo đức

---

## 5. Luồng UI

1. Chọn **loại con dấu** (tab/button)
2. Form hiển thị theo loại (conditional fields)
3. Tùy chọn chung: hình dạng, màu, kích thước, logo
4. Chọn chất lượng 2K/4K
5. Bấm **Tạo con dấu** → AI generate → Hiển thị kết quả + tải PNG/PDF

---

## 6. File cấu trúc

```
src/app/thiet-ke-con-dau/
├── page.tsx
├── thiet-ke-con-dau-client-page.tsx
├── actions.ts
└── lib/
    └── stamp-types.ts
```

---

## Tham chiếu

- Nghị định 99/2016/NĐ-CP, Luật Doanh nghiệp 2020
- tao-tem-niem-phong-bao-hanh (reference implementation)
