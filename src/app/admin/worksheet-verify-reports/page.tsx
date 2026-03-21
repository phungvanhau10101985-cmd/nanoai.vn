import { WorksheetVerifyReportsClient } from './worksheet-verify-reports-client'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Báo cáo verify phiếu bài tập',
  description: 'Quản trị: quét và verify hàng loạt câu chưa đóng verified_at.',
  path: '/admin/worksheet-verify-reports',
  noIndex: true,
  keywords: [
    'admin worksheet verify',
    'batch verify',
    'phiếu bài tập',
    'worksheet quality',
    '数据质量',
    '検証レポート',
    '검증 보고서',
  ],
})

export default function AdminWorksheetVerifyReportsPage() {
  const { t } = getServerDictionary()
  return <WorksheetVerifyReportsClient labels={t.adminWorksheetVerify} />
}
