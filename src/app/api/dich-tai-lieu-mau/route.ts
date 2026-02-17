import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** Trả về file Excel mẫu – cột A: Link ảnh */
export async function GET() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Link ảnh'],
    ['https://example.com/your-image-1.png'],
    ['https://example.com/your-image-2.png'],
  ])
  ws['!cols'] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách ảnh')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="dich-tai-lieu-mau.xlsx"',
    },
  })
}
