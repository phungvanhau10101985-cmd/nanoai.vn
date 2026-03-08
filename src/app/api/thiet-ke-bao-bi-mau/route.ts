import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** File Excel mẫu – cột A: key, cột B: giá trị. Import sẽ đọc và điền form. */
export async function GET() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['key', 'value', 'Ghi chú'],
    ['brandName', 'ABC Company', 'Thương hiệu'],
    ['productName', 'Sản phẩm cao cấp', 'Tên sản phẩm'],
    ['companyAddress', '123 Đường XYZ, Quận 1, TP.HCM', 'Địa chỉ'],
    ['website', 'https://example.com', 'Website'],
    ['email', 'contact@example.com', 'Email'],
    ['hotline', '1900 1234', 'Hotline'],
    ['countryOfOrigin', 'Việt Nam', 'Xuất xứ'],
    ['storageInstructions', 'Nơi khô ráo, thoáng mát', 'Bảo quản'],
    ['warningAllergy', 'Có thể chứa...', 'Cảnh báo dị ứng'],
    ['volume', '500g', 'Khối lượng'],
    ['registrationCode', 'ĐKSP-12345', 'Mã đăng ký'],
    ['socialLinks', 'facebook.com/abc', 'Link mạng xã hội'],
    ['packagingQuantity', '1 hộp', 'Số lượng đóng gói'],
    ['packagingWeight', '500g', 'Trọng lượng'],
    ['packagingShipping', '', 'Thông tin vận chuyển'],
    ['packagingOther', '', 'Thông tin khác'],
    ['packagingBatchLot', 'Lô 001', 'Số lô'],
    ['packagingProdDate', '2025-01-15', 'Ngày sản xuất'],
    ['packagingExpiryDate', '2027-01-15', 'Hạn sử dụng'],
    ['manufacturerMessage', 'Sản phẩm của công ty ABC', 'Thông điệp nhà sản xuất'],
  ])
  ws['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Thông tin bao bì')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="thiet-ke-bao-bi-mau.xlsx"',
    },
  })
}
