### Kế hoạch tối ưu hóa giao diện Mobile

**Mục tiêu:** Giữ nguyên giao diện desktop, đồng thời xây dựng một trải nghiệm mobile trực quan, chuyên nghiệp và đẹp mắt cho toàn bộ trang web.

---

#### **1. Tối ưu hóa Header (Thanh điều hướng trên cùng)**

-   **Hiện tại:** Các mục điều hướng đang hiển thị dàn trải.
-   **Giải pháp:**
    -   Trên mobile, các mục điều hướng chính (`Bảng điều khiển`, `Thử đồ`, `Ví`...) sẽ được ẩn đi.
    -   Thay thế bằng một **biểu tượng menu (hamburger icon)**.
    -   Khi người dùng bấm vào biểu tượng này, một menu trượt (drawer/sheet) sẽ hiện ra từ bên cạnh, chứa tất cả các liên kết điều hướng một cách gọn gàng.

#### **2. Tối ưu hóa Trang Thử đồ (`/thu-do-online`)**

-   **Hiện tại:** Bố cục nhiều cột không phù hợp với màn hình hẹp.
-   **Giải pháp:**
    -   Chuyển đổi bố cục thành **một cột duy nhất** trên mobile.
    -   Các khu vực "Ảnh của bạn", "Ảnh sản phẩm" và "Tùy chọn" sẽ được **xếp chồng lên nhau theo chiều dọc**.
    -   Ở bước xem kết quả, ảnh "Trước" và "Sau" cũng sẽ được xếp dọc để dễ dàng cuộn và so sánh.
    -   Đảm bảo các nút bấm và vùng chọn ảnh đủ lớn để dễ dàng thao tác bằng tay.

#### **3. Tối ưu hóa Trang Bảng điều khiển (`/dashboard`)**

-   **Hiện tại:** Lưới các thẻ thông tin và lịch sử bị vỡ layout trên mobile.
-   **Giải pháp:**
    -   Các thẻ thống kê (`Tổng tín dụng`, `Thử đồ mới`) sẽ tự động xếp thành **một cột**.
    -   Lưới "Lịch sử gần đây" sẽ chuyển từ 4 cột (trên desktop) thành **2 cột** trên mobile để hiển thị ảnh rõ nét hơn.

#### **4. Tối ưu hóa Trang Lịch sử (`/dashboard/history`)**

-   **Hiện tại:** Lưới 3 cột hiển thị các ảnh kết quả.
-   **Giải pháp:**
    -   Trên mobile, lưới sẽ chuyển thành **một cột duy nhất**. Điều này giúp mỗi ảnh kết quả và các thông tin đi kèm (ngày tháng, nút tải, nút xóa) được hiển thị đầy đủ, rõ ràng và dễ tương tác hơn.

---

Tôi sẽ thực hiện tuần tự các bước trên để đảm bảo mọi trang đều được tối ưu một cách cẩn thận. Bạn có đồng ý với kế hoạch này không?