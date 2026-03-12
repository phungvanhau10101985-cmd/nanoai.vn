# Tư vấn: Bản đồ + Chuột ảo đồng thời trên giao diện học sinh

## Vấn đề hiện tại

- **Chế độ Chỉ điểm**: Chuột ảo hoạt động, nhưng học sinh có thể không thấy bản đồ (embed) – hoặc bản đồ bị che.
- **Chế độ Tương tác**: Bản đồ tương tác được, nhưng giáo viên phải chuyển sang cửa sổ học sinh để zoom/pan – mất chuột ảo.

→ Mong muốn: **Học sinh vừa thấy bản đồ, vừa thấy chuột ảo** – giáo viên chỉ cần làm việc ở cửa sổ giáo viên.

---

## Kiến trúc hiện tại

| Thành phần | Giáo viên | Học sinh |
|------------|-----------|----------|
| Bản đồ/embed | ContentEmbed (iframe) | ContentEmbed (iframe) |
| Lớp phủ bắt chuột | `pointer-events: auto` khi Chỉ điểm | Không có (chỉ xem) |
| Chuột ảo | Gửi tọa độ qua postMessage | Hiển thị SVG cursor (z-120, pointer-events-none) |

**Lý thuyết**: Overlay giáo viên trong suốt → bản đồ vẫn hiện. Chuột ảo học sinh có `pointer-events-none` → không chặn, nổi trên bản đồ. Cả hai nên hiển thị cùng lúc.

---

## Giải pháp đề xuất

### 1. Đảm bảo học sinh luôn nhận embed (đã làm)

- `getBaseSlides` dùng `aiSlides` khi có → `visualCells` với `visualEmbed` được truyền.
- Nếu vẫn thấy ảnh thay vì bản đồ: kiểm tra `curriculum-data` gửi đủ `visualCells`, `visualEmbed`.

### 2. Chế độ mặc định: Chỉ điểm (point)

- Mặc định `visualPointerMode = 'point'` → giáo viên luôn dùng chuột ảo.
- Overlay không có background → bản đồ vẫn hiện phía dưới.
- Học sinh: bản đồ (iframe) + cursor (SVG) cùng hiển thị.

### 3. Cải tiến UX: Gợi ý rõ chế độ

- Tooltip: "Chỉ điểm: Học sinh thấy bản đồ + con trỏ của bạn. Tương tác: Bạn có thể zoom/pan bản đồ trực tiếp (chuyển sang cửa sổ học sinh nếu cần)."

### 4. Giải pháp nâng cao (nếu cần)

| Cách | Mô tả | Ưu | Nhược |
|------|-------|-----|-------|
| **Screen share** | Giáo viên share tab qua getDisplayMedia | Bản đồ + chuột thật, đơn giản | Cần WebRTC, bandwidth |
| **Ảnh tĩnh + cursor** | Chụp ảnh bản đồ định kỳ, overlay cursor | Không phụ thuộc iframe | Bản đồ không realtime, phức tạp |
| **PiP** | Picture-in-Picture: bản đồ nhỏ, cursor overlay lớn | Tách rõ hai lớp | UX có thể lạ |

---

## Khuyến nghị

1. **Ngắn hạn**: Giữ kiến trúc hiện tại, đảm bảo:
   - Overlay giáo viên **trong suốt** (không background).
   - Học sinh nhận đúng `visualEmbed`/`visualCells` → hiển thị ContentEmbed.
   - Chuột ảo dùng `relX/relY` khi cell là embed (không có `img`) – đã xử lý bằng `rect`.

2. **Dài hạn**: Nếu vẫn không ổn, cân nhắc Screen Share (tab) cho trường hợp bản đồ tương tác phức tạp.
