### Kế hoạch triển khai tính năng Thử đồ nhóm (4 người)

**Mục tiêu:** Cho phép người dùng tải lên ảnh có 4 người, sau đó tải trang phục riêng cho từng người, được xác định theo thứ tự từ trái qua phải.

---

#### **1. Xây dựng Prompt cho 4 người**

-   Tôi sẽ tạo một cấu trúc prompt mới, chuyên dụng cho ảnh nhóm 4 người.
-   **Prompt sẽ chỉ định rõ ràng:**
    -   **Vị trí:** "Người mẫu 1 (Ngoài cùng bên trái)", "Người mẫu 2 (Trái-giữa)", "Người mẫu 3 (Phải-giữa)", "Người mẫu 4 (Ngoài cùng bên phải)".
    -   **Nhiệm vụ**: Yêu cầu AI áp dụng đúng các sản phẩm (tối đa 3) cho từng người theo đúng vị trí.
    -   **Quy tắc**: Tiếp tục nhấn mạnh việc **giữ nguyên 100% khuôn mặt, biểu cảm**, dáng người và hậu cảnh.

#### **2. Cập nhật Giao diện Trang Thử đồ**

-   **Thêm chế độ mới:** Nút chuyển đổi chế độ sẽ có thêm tùy chọn thứ tư: **"Nhóm (4 người)"**.
-   **Giao diện "Nhóm (4 người)":**
    -   Khi chọn chế độ này, giao diện sẽ hiển thị **bốn khu vực tải ảnh** riêng biệt.
    -   Mỗi khu vực sẽ được ghi rõ là "Người 1 (Trái)", "Người 2", "Người 3", "Người 4 (Phải)" và giới hạn tải lên **tối đa 3 ảnh**.

#### **3. Cập nhật Logic Phía Người dùng (Client-side)**

-   Tôi sẽ mở rộng state management để quản lý 4 mảng ảnh riêng biệt cho 4 người.
-   Hàm `handleSubmit` sẽ được nâng cấp để đóng gói dữ liệu từ cả bốn khu vực tải ảnh, bao gồm số lượng ảnh của từng người.

#### **4. Cập nhật Logic Phía Máy chủ (Server-side)**

-   Hàm `generateAiImage` sẽ được cập nhật để nhận diện chế độ "Nhóm 4 người".
-   Nó sẽ tự động gọi hàm `buildFourPersonPrompt` mới để tạo ra câu lệnh chi tiết.
-   Thứ tự gửi ảnh đến AI sẽ được tuân thủ nghiêm ngặt: **Ảnh gốc -> (tối đa 3) ảnh đồ người 1 -> (tối đa 3) ảnh đồ người 2 -> (tối đa 3) ảnh đồ người 3 -> (tối đa 3) ảnh đồ người 4**.

---

Kế hoạch này đảm bảo tính năng mới sẽ được xây dựng một cách nhất quán và hiệu quả. Tôi sẽ bắt đầu thực hiện ngay. Bạn có đồng ý không?