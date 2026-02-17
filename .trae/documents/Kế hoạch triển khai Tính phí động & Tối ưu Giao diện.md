### Kế hoạch triển khai Tính phí động & Tối ưu Giao diện

**Mục tiêu:** Xây dựng hệ thống tính phí dựa trên chế độ thử đồ và loại bỏ các thành phần giao diện không cần thiết.

---

#### **1. Định nghĩa Cấu trúc Phí**

-   Tôi sẽ thiết lập một cấu trúc phí rõ ràng, dễ hiểu:
    -   **1 người**: 1 credit
    -   **2 người**: 2 credits
    -   **3 người**: 3 credits
    -   **4 người**: 4 credits
    -   **5 người**: 5 credits

#### **2. Cập nhật Giao diện Người dùng (`try-on-client-page.tsx`)**

-   **Loại bỏ nút "Giao diện"**: Tôi sẽ xóa bỏ hoàn toàn phần `DropdownMenu` dùng để chọn giao diện Nam/Nữ để làm gọn giao diện theo yêu cầu của bạn.
-   **Hiển thị chi phí động**:
    -   Nút "Thử Đồ / Phối Đồ" sẽ được cập nhật để hiển thị rõ chi phí cho lần tạo ảnh hiện tại.
    -   Ví dụ: **"Tạo ảnh (3 credits)"** khi đang ở chế độ 3 người.

#### **3. Cập nhật Logic Phía Máy chủ (`actions.ts`)**

-   **Tính toán chi phí động**:
    -   Hàm `generateAiImage` sẽ được sửa đổi để không dùng chi phí cố định nữa.
    -   Thay vào đó, nó sẽ tự động tính toán chi phí chính xác dựa trên `tryOnMode` (số người) được gửi từ client.
-   **Kiểm tra và Trừ phí**:
    -   Hệ thống sẽ kiểm tra xem người dùng có đủ số credit tương ứng với chế độ đã chọn hay không.
    -   Nếu đủ, hệ thống sẽ trừ đúng số credit đó sau khi ảnh được tạo thành công.

---

Kế hoạch này đảm bảo hệ thống tính phí sẽ hoạt động chính xác và giao diện người dùng sẽ trở nên tinh gọn hơn. Tôi sẽ bắt đầu thực hiện ngay. Bạn có đồng ý không?