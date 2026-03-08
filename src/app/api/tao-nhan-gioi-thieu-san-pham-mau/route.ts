import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** File Excel mẫu – cột A: key, cột B: giá trị. Import sẽ đọc và điền form. */
export async function GET() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['key', 'value', 'Ghi chú'],
    ['labelName', 'Nước lau sàn Sunlight', 'Tên nhãn dán'],
    ['brandName', 'Sunlight', 'Thương hiệu'],
    ['labelText', 'Công dụng: Lau sàn sạch bóng...', 'Nội dung ghi trên nhãn'],
    ['productName', 'Nước lau sàn đa năng', 'Tên sản phẩm'],
    ['productDescription', 'Công dụng, đặc điểm nổi bật', 'Mô tả ngắn'],
    ['ingredients', 'Nước, chất tẩy rửa...', 'Thành phần'],
    ['usageInstructions', 'Pha 1 nắp với 2 lít nước', 'Hướng dẫn sử dụng'],
    ['companyAddress', '123 Đường ABC, Quận 1, TP.HCM', 'Địa chỉ'],
    ['website', 'https://example.com', 'Website'],
    ['email', 'contact@example.com', 'Email'],
    ['hotline', '1900 1234', 'Hotline'],
    ['storageInstructions', 'Nơi khô ráo, thoáng mát', 'Bảo quản'],
    ['warningAllergy', 'Có thể chứa...', 'Cảnh báo dị ứng'],
    ['warningOther', 'Để xa tầm tay trẻ em', 'Cảnh báo khác'],
    ['volume', '500ml', 'Khối lượng'],
    ['registrationCode', 'ĐKSP-12345', 'Mã đăng ký'],
    ['countryOfOrigin', 'Việt Nam', 'Xuất xứ'],
    ['packagingProdDate', '01/2025', 'NSX'],
    ['packagingExpiryDate', '01/2027', 'HSD'],
    ['hasBarcode', '1', 'Có mã vạch (1=có, 0=không)'],
    ['hasQrCode', '0', 'Có QR code (1=có, 0=không)'],
    ['labelIcons', 'recycle,vegan,keep_sun', 'Icon: washing_care,recycle,plastic_pet,plastic_pp,vegan,cruelty_free,organic,fsc,compostable,gluten_free,halal,kosher,keep_dry,keep_sun,food_grade,fragile,child_safe'],
  ])
  ws['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Thông tin sản phẩm')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tao-nhan-mau.xlsx"',
    },
  })
}
