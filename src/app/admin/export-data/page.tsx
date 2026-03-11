import { ExportDataClient } from './export-data-client'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export default async function ExportDataPage() {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {tr('Xuất dữ liệu', 'Export data', '导出数据', 'データをエクスポート', '데이터 내보내기')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            'Chọn bảng cần xuất và định dạng. JSON phù hợp backup/restore; Excel dễ mở trong spreadsheet.',
            'Select tables and format. JSON for backup/restore; Excel for viewing in spreadsheet.',
            '选择要导出的表和格式。JSON适合备份/恢复；Excel便于在Excel中查看。',
            'テーブルと形式を選択。JSONはバックアップ/復元向け；Excelはスプレッドシートで閲覧。',
            '테이블과 형식 선택. JSON은 백업/복원용; Excel은 스프레드시트에서 보기 편함.'
          )}
        </p>
      </div>
      <ExportDataClient locale={uiLocale} />
    </div>
  )
}
