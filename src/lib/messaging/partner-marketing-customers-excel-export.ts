import * as XLSX from 'xlsx'
import type { MarketingSegmentRecipientRow } from '@/lib/db/messaging-partner-marketing-campaigns-pg'

export type MarketingCustomerExportRow = {
  customerName: string
  email: string
  lastMessageAt: string
}

export function marketingSegmentRowsToExportRows(
  rows: MarketingSegmentRecipientRow[]
): MarketingCustomerExportRow[] {
  return rows
    .map((r) => ({
      customerName: r.customer_name?.trim() || '',
      email: r.customer_email?.trim() || '',
      lastMessageAt: r.last_message_at?.trim() || '',
    }))
    .filter((r) => r.email)
}

/** Tạo buffer .xlsx — một sheet «Khách chat». */
export function buildMarketingCustomerEmailsXlsxBuffer(rows: MarketingCustomerExportRow[]): Buffer {
  const header = ['Tên khách', 'Email', 'Chat gần nhất']
  const data = rows.map((r) => [
    r.customerName,
    r.email,
    r.lastMessageAt ? r.lastMessageAt.slice(0, 10) : '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Khach chat')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** CSV UTF-8 với BOM để Excel mở đúng tiếng Việt. */
export function buildMarketingCustomerEmailsCsvString(rows: MarketingCustomerExportRow[]): string {
  const escape = (v: string) => {
    const s = v.replace(/"/g, '""')
    return /[",\n\r]/.test(s) ? `"${s}"` : s
  }
  const lines = [
    ['Tên khách', 'Email', 'Chat gần nhất'].map(escape).join(','),
    ...rows.map((r) =>
      [r.customerName, r.email, r.lastMessageAt ? r.lastMessageAt.slice(0, 10) : ''].map(escape).join(',')
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}
