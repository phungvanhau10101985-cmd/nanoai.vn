import { DbTablesBrowserClient } from './db-tables-browser-client'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export default async function AdminDbTablesPage() {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string) => (uiLocale === 'en' ? en : vi)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {tr('Duyệt bảng dữ liệu', 'Browse database tables')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            'Xem danh sách mọi bảng trong schema public và auth, xem nội dung theo trang (chỉ đọc). Thao tác sửa/xóa dùng công cụ chuyên dụng hoặc SQL trên server.',
            'List all base tables in public and auth schemas, paginated read-only preview. For edits use dedicated tools or SQL on the server.'
          )}
        </p>
      </div>
      <DbTablesBrowserClient locale={uiLocale} />
    </div>
  )
}
