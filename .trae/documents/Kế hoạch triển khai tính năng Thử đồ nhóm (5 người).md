### Kế hoạch triển khai tính năng Thử đồ nhóm (5 người)

**Mục tiêu:** Cho phép người dùng tải lên ảnh có 5 người và trang phục riêng cho từng người, xác định theo thứ tự từ trái qua phải.

---

#### **1. Xây dựng Prompt cho 5 người**

-   Tôi sẽ tạo một cấu trúc prompt mới, chuyên dụng cho ảnh nhóm 5 người.
-   **Prompt sẽ chỉ định rõ ràng:**
    -   **Vị trí:** "Người mẫu 1 (Ngoài cùng bên trái)", "Người mẫu 2", "Người mẫu 3", "Người mẫu 4", "Người mẫu 5 (Ngoài cùng bên phải)".
    -   **Nhiệm vụ**: Yêu cầu AI áp dụng đúng các sản phẩm (tối đa 2) cho từng người theo đúng vị trí.
    -   **Quy tắc**: Tiếp tục nhấn mạnh việc **giữ nguyên 100% khuôn mặt, biểu cảm**, và các chi tiết khác.

#### **2. Cập nhật Giao diện Trang Thử đồ**

-   **Thêm chế độ mới:** Nút chuyển đổi chế độ sẽ có thêm tùy chọn thứ năm: **"Nhóm (5)"**.
-   **Giao diện "Nhóm (5)":**
    -   Khi chọn chế độ này, giao diện sẽ hiển thị **năm khu vực tải ảnh** riêng biệt.
    -   Mỗi khu vực sẽ được ghi rõ là "Người 1 (Trái)", "Người 2", "Người 3", "Người 4", "Người 5 (Phải)" và giới hạn tải lên **tối đa 2 ảnh**.

#### **3. Cập nhật Logic Phía Người dùng (Client-side)**

-   Tôi sẽ mở rộng state management để quản lý 5 mảng ảnh riêng biệt cho 5 người.
-   Hàm `handleSubmit` sẽ được nâng cấp để đóng gói dữ liệu từ cả năm khu vực tải ảnh, bao gồm số lượng ảnh của từng người.

#### **4. Cập nhật Logic Phía Máy chủ (Server-side)**

-   Hàm `generateAiImage` sẽ được cập nhật để nhận diện chế độ "Nhóm 5 người".
-   Nó sẽ tự động gọi hàm `buildFivePersonPrompt` mới để tạo ra câu lệnh chi tiết.
-   Thứ tự gửi ảnh đến AI sẽ được tuân thủ nghiêm ngặt: **Ảnh gốc -> (tối đa 2) ảnh đồ người 1 -> ... -> (tối đa 2) ảnh đồ người 5**.

---

Kế hoạch này đảm bảo tính năng mới sẽ được xây dựng một cách nhất quán và hiệu quả. Tôi sẽ bắt đầu thực hiện ngay. Bạn có đồng ý không?