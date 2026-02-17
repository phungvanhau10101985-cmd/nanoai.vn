### Kế hoạch triển khai tính năng Thử đồ đôi

**Mục tiêu:** Cho phép người dùng tải lên ảnh có 2 người, sau đó tải trang phục riêng cho "Người bên trái" và "Người bên phải" để AI tạo ảnh kết quả.

---

#### **1. Cập nhật giao diện Trang Thử đồ (`/thu-do-online`)**

-   **Chế độ chọn:** Thêm một nút chuyển đổi (toggle/switch) để người dùng chọn giữa chế độ "Một người" và "Ảnh đôi".
-   **Giao diện "Ảnh đôi":**
    -   Khi chọn chế độ "Ảnh đôi", khu vực tải ảnh sản phẩm sẽ được tách thành hai cột riêng biệt:
        -   **Cột "Trang phục cho người bên trái"**: Cho phép tải lên tối đa 6 ảnh.
        -   **Cột "Trang phục cho người bên phải"**: Cho phép tải lên tối đa 6 ảnh.
    -   Mỗi cột sẽ có nút "Chọn ảnh" và khu vực hiển thị các ảnh đã tải lên tương ứng.
    -   Giao diện trên mobile sẽ được tối ưu để các cột này hiển thị hợp lý, có thể là xếp chồng hoặc dùng tab.

#### **2. Cập nhật State Management (Quản lý trạng thái)**

-   **`try-on-client-page.tsx`**:
    -   Thêm state để quản lý chế độ đang chọn (`tryOnMode`: 'single' | 'couple').
    -   Thay vì một mảng `garmentImages`, sẽ có hai mảng riêng biệt: `leftGarmentImages` và `rightGarmentImages`.
    -   Cập nhật các hàm xử lý (thêm/xóa ảnh) để làm việc với hai mảng này.

#### **3. Cập nhật Logic gửi dữ liệu (Client-side)**

-   **`handleSubmit` function**:
    -   Hàm này sẽ kiểm tra chế độ đang được chọn.
    -   Nếu là 'couple', nó sẽ đóng gói dữ liệu từ cả hai mảng `leftGarmentImages` và `rightGarmentImages` vào `FormData`.
    -   Các ảnh sẽ được đặt tên rõ ràng để server có thể phân biệt, ví dụ: `leftGarmentImage0`, `rightGarmentImage0`,...
    -   Gửi thêm số lượng ảnh của mỗi bên: `leftGarmentCount` và `rightGarmentCount`.

#### **4. Cập nhật Logic xử lý (Server-side)**

-   **`actions.ts`**:
    -   Hàm `generateAiImage` sẽ được sửa đổi để nhận diện và xử lý dữ liệu cho ảnh đôi.
    -   Nó sẽ đọc `leftGarmentCount` và `rightGarmentCount` để biết cần xử lý bao nhiêu ảnh cho mỗi người.
    -   **Xây dựng Prompt động**: Dựa trên số lượng ảnh của mỗi bên, hàm sẽ tự động xây dựng câu lệnh (prompt) chính xác theo cấu trúc đã phân tích ở trên, chỉ định rõ trang phục nào dành cho người bên trái và trang phục nào cho người bên phải.
    -   Gửi prompt hoàn chỉnh cùng tất cả hình ảnh (ảnh gốc + ảnh sản phẩm 2 bên) đến AI.

---

Đây là một kế hoạch toàn diện để xây dựng tính năng phức tạp này. Tôi sẽ bắt đầu thực hiện từ bước cập nhật giao diện. Bạn có đồng ý không?