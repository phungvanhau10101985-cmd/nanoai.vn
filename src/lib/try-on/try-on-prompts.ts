/** Prompt & cost cho thử đồ ảo — dùng chung UI và API partner. */

export const tryOnCostMap = {
  single: 1,
  couple: 1.2,
  group: 1.3,
  group4: 1.4,
  group5: 1.5,
} as const

export type TryOnMode = keyof typeof tryOnCostMap

export function buildSinglePersonPrompt(genderLabel: string, customPrompt: string, garmentCount: number): string {
  return `
    QUAN TRỌNG: Kết quả phải là MỘT ảnh toàn khung, cùng bố cục với ảnh đầu vào. TUYỆT ĐỐI không tạo lưới 2x2, không nhiều khung, không nhân bản ảnh.

    NHIỆM VỤ: Thử đồ AI cho 1 người.

    ẢNH ĐẦU VÀO (theo thứ tự):
    - Ảnh 1: ảnh khách hàng cần thử đồ (chỉ 1 người trong khung).
    - ${garmentCount} ảnh tiếp theo: ảnh mẫu mặc sản phẩm - áp toàn bộ trang phục này cho người trong Ảnh 1.
    - Giới tính người cần thử đồ: ${genderLabel}.

    HƯỚNG DẪN:
    1) Lấy TRANG PHỤC từ ảnh mẫu và mặc vào người trong Ảnh 1.
    2) Ảnh khách hàng: giữ nguyên gương mặt, cơ thể, tư thế, nền. Chỉ thay trang phục.
    3) Ảnh sản phẩm: bỏ qua người mẫu, chỉ dùng quần áo.
    4) Trang phục phải tự nhiên, đúng form, giữ chi tiết sản phẩm.

    ${customPrompt ? `YÊU CẦU BỔ SUNG CỦA KHÁCH: "${customPrompt}"` : ''}

    ĐỊNH DẠNG ĐẦU RA:
    - Trả về đúng MỘT ảnh với bố cục giống Ảnh 1.
    - Cấm: dạng lưới, collage, nhiều khung, nhiều bản sao.
  `
}

export function buildCouplePrompt(customPrompt: string, leftCount: number, rightCount: number): string {
  return `
    QUAN TRỌNG: Kết quả phải là MỘT ảnh toàn khung, cùng bố cục ảnh đầu vào. Không lưới 2x2, không nhiều khung, không nhân bản.

    NHIỆM VỤ: Thử đồ AI cho 2 người.

    ẢNH ĐẦU VÀO:
    - Ảnh 1: hai khách hàng, đứng từ trái sang phải.
    - ${leftCount} ảnh tiếp theo: đồ cho người bên trái.
    - ${rightCount} ảnh tiếp theo: đồ cho người bên phải.

    HƯỚNG DẪN:
    1) Áp đúng nhóm trang phục cho đúng người theo thứ tự trái -> phải.
    2) Giữ nguyên mặt, cơ thể, tư thế, vị trí và nền; chỉ thay trang phục.
    3) Bỏ qua người mẫu trong ảnh sản phẩm, chỉ lấy quần áo.
    4) Trang phục mặc vào phải tự nhiên, đúng form, giữ chi tiết.

    ${customPrompt ? `YÊU CẦU BỔ SUNG CỦA KHÁCH: "${customPrompt}"` : ''}

    ĐẦU RA: một ảnh duy nhất, toàn khung, cùng bố cục ảnh đầu vào.
  `
}

export function buildGroupPrompt(customPrompt: string, leftCount: number, middleCount: number, rightCount: number): string {
  return `
    QUAN TRỌNG: Kết quả phải là MỘT ảnh toàn khung, cùng bố cục ảnh đầu vào. Không lưới, không collage, không nhân bản.

    NHIỆM VỤ: Thử đồ AI cho 3 người.

    ẢNH ĐẦU VÀO:
    - Ảnh 1: ba khách hàng theo thứ tự trái - giữa - phải.
    - ${leftCount} ảnh tiếp: đồ cho người bên trái.
    - ${middleCount} ảnh tiếp: đồ cho người ở giữa.
    - ${rightCount} ảnh tiếp: đồ cho người bên phải.

    HƯỚNG DẪN:
    1) Áp đúng nhóm trang phục cho đúng người theo thứ tự.
    2) Giữ nguyên khuôn mặt, cơ thể, tư thế, vị trí, nền; chỉ thay trang phục.
    3) Bỏ qua người mẫu trong ảnh sản phẩm, chỉ lấy quần áo.
    4) Trang phục cần tự nhiên, đúng form, giữ chi tiết.

    ${customPrompt ? `YÊU CẦU BỔ SUNG CỦA KHÁCH: "${customPrompt}"` : ''}

    ĐẦU RA: một ảnh duy nhất, toàn khung, cùng bố cục ảnh đầu vào.
  `
}

export function buildFourPersonPrompt(
  customPrompt: string,
  p1Count: number,
  p2Count: number,
  p3Count: number,
  p4Count: number
): string {
  return `
    QUAN TRỌNG: Kết quả phải là MỘT ảnh toàn khung, cùng bố cục ảnh đầu vào. Không lưới 2x2, không nhiều khung.

    NHIỆM VỤ: Thử đồ AI cho 4 người.

    ẢNH ĐẦU VÀO:
    - Ảnh 1: bốn khách hàng, từ trái sang phải.
    - ${p1Count} ảnh tiếp: đồ cho người 1 (ngoài cùng bên trái).
    - ${p2Count} ảnh tiếp: đồ cho người 2.
    - ${p3Count} ảnh tiếp: đồ cho người 3.
    - ${p4Count} ảnh cuối: đồ cho người 4 (ngoài cùng bên phải).

    HƯỚNG DẪN:
    1) Áp đúng nhóm trang phục cho đúng người theo thứ tự.
    2) Giữ nguyên mặt, cơ thể, tư thế, vị trí và nền; chỉ thay trang phục.
    3) Bỏ qua người mẫu trong ảnh sản phẩm, chỉ dùng quần áo.
    4) Trang phục mặc vào phải tự nhiên, đúng form, rõ chi tiết.

    ${customPrompt ? `YÊU CẦU BỔ SUNG CỦA KHÁCH: "${customPrompt}"` : ''}

    ĐẦU RA: một ảnh duy nhất, toàn khung, cùng bố cục ảnh đầu vào.
  `
}

export function buildFivePersonPrompt(
  customPrompt: string,
  p1Count: number,
  p2Count: number,
  p3Count: number,
  p4Count: number,
  p5Count: number
): string {
  return `
    QUAN TRỌNG: Kết quả phải là MỘT ảnh toàn khung, cùng bố cục ảnh đầu vào. Không lưới, không collage, không nhiều bản sao.

    NHIỆM VỤ: Thử đồ AI cho 5 người.

    ẢNH ĐẦU VÀO:
    - Ảnh 1: năm khách hàng từ trái sang phải.
    - ${p1Count} ảnh tiếp: đồ cho người 1.
    - ${p2Count} ảnh tiếp: đồ cho người 2.
    - ${p3Count} ảnh tiếp: đồ cho người 3.
    - ${p4Count} ảnh tiếp: đồ cho người 4.
    - ${p5Count} ảnh cuối: đồ cho người 5.

    HƯỚNG DẪN:
    1) Áp đúng nhóm trang phục cho đúng người theo thứ tự.
    2) Giữ nguyên khuôn mặt, cơ thể, tư thế, vị trí, nền; chỉ thay trang phục.
    3) Bỏ qua người mẫu trong ảnh sản phẩm, chỉ lấy quần áo.
    4) Trang phục phải tự nhiên, đúng form, giữ chi tiết.

    ${customPrompt ? `YÊU CẦU BỔ SUNG CỦA KHÁCH: "${customPrompt}"` : ''}

    ĐẦU RA: một ảnh duy nhất, toàn khung, cùng bố cục ảnh đầu vào.
  `
}
