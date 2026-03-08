import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** File Excel mẫu Dove Kem Xả Serum – dữ liệu từ nhãn sản phẩm thực tế. Import vào Tạo nhãn giới thiệu sản phẩm. */
export async function GET() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['key', 'value', 'Ghi chú'],
    ['labelName', 'Dove Kem Xả Serum Ceramide Phục Hồi Hư Tổn', 'Tên nhãn dán'],
    ['brandName', 'Dove', 'Thương hiệu'],
    [
      'productName',
      'ceramide phục hồi hư tổn KEM XẢ SERUM',
      'Tên sản phẩm',
    ],
    [
      'productDescription',
      'CÔNG THỨC ĐỘC QUYỀN. 95% tóc là protein, các yếu tố bên ngoài gây mất protein. Phức hợp BIO-PROTEIN CARE™ với Ceramide của Dove bảo vệ, phục hồi và tái tạo cấu trúc tóc, cho tóc mượt và chắc khỏe gấp 10X* chỉ trong 1 phút. Dùng trọn bộ Dove (dầu gội, kem xả, mặt nạ, dầu dưỡng) để đạt kết quả tối ưu.',
      'Mô tả ngắn',
    ],
    [
      'labelText',
      'CÔNG THỨC ĐỘC QUYỀN\n\n95% tóc là protein. Các yếu tố bên ngoài gây mất protein. Phức hợp BIO-PROTEIN CARE™ với Ceramide của Dove bảo vệ, phục hồi và tái tạo cấu trúc tóc. Tóc mượt và chắc khỏe gấp 10X* chỉ trong 1 phút.\n\nDùng trọn bộ Dove (dầu gội, kem xả, mặt nạ, dầu dưỡng) để đạt kết quả tối ưu.\n\n*Không bao gồm nang tóc.',
      'Nội dung ghi trên nhãn',
    ],
    [
      'ingredients',
      'WATER, CETEARYL ALCOHOL, BEHENTRIMONIUM CHLORIDE, LACTIC ACID, GLYCERIN, DIMETHICONOL/SILSESQUIOXANE COPOLYMER, SODIUM GLUTAMATE, PERFUME, DIPROPYLENE GLYCOL, ISOHEXADECANE, SODIUM BENZOATE, DISODIUM EDTA, TRIDECETH-6, CETRIMONIUM CHLORIDE, PHENOXYETHANOL, PRUNUS ARMENIACA (APRICOT) KERNEL OIL, PEG-7 GLYCERYL COCOATE, CHENOPODIUM QUINOA SEED EXTRACT, HYDROLYZED CICER SEED EXTRACT, LENS ESCULENTA (LENTIL) SEED EXTRACT, PEG-60 HYDROGENATED CASTOR OIL, CERAMIDE NG, HYDROLYZED WHEAT PROTEIN, GLUCONOLACTONE, CITRIC ACID, CALCIUM GLUCONATE',
      'Thành phần',
    ],
    [
      'usageInstructions',
      'Sau khi gội sạch tóc, lấy một lượng kem xả vừa đủ ra lòng bàn tay, thoa đều lên thân và ngọn tóc, xoa bóp nhẹ nhàng và xả sạch với nước.',
      'Hướng dẫn sử dụng',
    ],
    [
      'companyAddress',
      'Lô A2-3, KCN Tây Bắc Củ Chi, xã Tân An Hội, huyện Củ Chi, TP. Hồ Chí Minh, Việt Nam',
      'Địa chỉ',
    ],
    ['website', 'https://www.dove.com', 'Website'],
    ['email', 'cskh@unilever.com', 'Email'],
    ['hotline', '1900 6610', 'Hotline'],
    [
      'storageInstructions',
      'Tránh nhiệt độ cao và ánh nắng trực tiếp.',
      'Bảo quản',
    ],
    [
      'warningAllergy',
      '',
      'Cảnh báo dị ứng',
    ],
    [
      'warningOther',
      'Để xa tầm tay trẻ em, tránh tiếp xúc với mắt. Nếu sản phẩm dính vào mắt, rửa kĩ với nước.',
      'Cảnh báo khác',
    ],
    ['volume', '610 g (622 ml)', 'Khối lượng tịnh'],
    ['registrationCode', '', 'Mã đăng ký'],
    ['countryOfOrigin', 'Việt Nam', 'Xuất xứ'],
    ['packagingProdDate', '181028', 'NSX / Số lô (xem trên bao bì)'],
    ['packagingExpiryDate', 'Xem trên bao bì', 'HSD'],
    ['hasBarcode', '1', 'Có mã vạch (1=có, 0=không)'],
    ['hasQrCode', '1', 'Có QR code (1=có, 0=không)'],
  ])
  ws['!cols'] = [{ wch: 22 }, { wch: 80 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Dove Kem Xả Serum')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="dove-kem-xa-serum-nhan-san-pham.xlsx"',
    },
  })
}
