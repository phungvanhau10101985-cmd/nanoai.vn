### Kế hoạch triển khai tính năng Thử đồ nhóm (3 người)

**Mục tiêu:** Cho phép người dùng tải lên ảnh có 3 người, sau đó tải trang phục riêng cho "Người bên trái", "Người ở giữa", và "Người bên phải" để AI tạo ảnh kết quả.

---

#### **1. Phân tích và xây dựng Prompt cho 3 người**

-   Tôi sẽ tạo một cấu trúc prompt mới, chuyên dụng cho ảnh nhóm 3 người.
-   **Prompt sẽ chỉ định rõ ràng:**
    -   **Vị trí:** "Người mẫu 1 (Bên trái)", "Người mẫu 2 (Ở giữa)", "Người mẫu 3 (Bên phải)".
    -   **Nhiệm vụ**: Yêu cầu AI áp dụng đúng 4 sản phẩm cho người bên trái, 4 sản phẩm cho người ở giữa, và 4 sản phẩm cho người bên phải.
    -   **Quy tắc**: Vẫn giữ nguyên các quy tắc cốt lõi về việc **giữ 100% khuôn mặt, biểu cảm**, dáng người và hậu cảnh.

#### **2. Cập nhật Giao diện Trang Thử đồ**

-   **Thêm chế độ mới:** Nút chuyển đổi chế độ sẽ có thêm tùy chọn thứ ba: **"Ảnh nhóm (3 người)"**.
-   **Giao diện "Ảnh nhóm":**
    -   Khi chọn chế độ này, giao diện sẽ hiển thị **ba khu vực tải ảnh** riêng biệt, song song với nhau (trên desktop) hoặc xếp chồng (trên mobile).
    -   Mỗi khu vực sẽ được ghi rõ là "Trang phục cho người bên trái", "Trang phục cho người ở giữa", "Trang phục cho người bên phải" và giới hạn tải lên **tối đa 4 ảnh**.

#### **3. Cập nhật Logic Phía Người dùng (Client-side)**

-   Tôi sẽ mở rộng state management để quản lý thêm một mảng ảnh cho người ở giữa (`middleGarmentImages`).
-   Hàm `handleSubmit` sẽ được nâng cấp để đóng gói dữ liệu từ cả ba khu vực tải ảnh vào `FormData`, bao gồm số lượng ảnh của từng người (`leftGarmentCount`, `middleGarmentCount`, `rightGarmentCount`).

#### **4. Cập nhật Logic Phía Máy chủ (Server-side)**

-   Hàm `generateAiImage` sẽ được cập nhật để nhận diện chế độ "Ảnh nhóm".
-   Nó sẽ tự động gọi hàm `buildGroupPrompt` mới để tạo ra câu lệnh chi tiết dựa trên số lượng ảnh của mỗi người.
-   Thứ tự gửi ảnh đến AI sẽ được tuân thủ nghiêm ngặt: **Ảnh gốc -> (4) ảnh đồ người trái -> (4) ảnh đồ người giữa -> (4) ảnh đồ người phải**.

---

Kế hoạch này đảm bảo tính năng mới sẽ hoạt động chính xác và hiệu quả như các tính năng trước. Tôi sẽ bắt đầu thực hiện ngay. Bạn có đồng ý không?