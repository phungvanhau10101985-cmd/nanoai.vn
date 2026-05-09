import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { pgListAdminCustomerApiKeys } from '@/lib/db/admin-customer-api-keys-pg'

function planFromKeyStatus(status: string, enabled: boolean): string {
  if (!enabled) return 'Tạm tắt'
  if (status === 'valid') return 'BYOK active'
  if (status === 'invalid') return 'Cần kiểm tra'
  return 'Chưa xác nhận'
}

function formatVnd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${Math.round(value).toLocaleString('vi-VN')}đ`
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : 'vi-VN'
  return new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function AdminCustomerApiKeysPage() {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const { rows, stats, error } = await pgListAdminCustomerApiKeys()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thành viên dùng API key riêng', 'Members using BYOK API keys', '使用自带 API 密钥的成员', 'BYOK API キー利用者', 'BYOK API 키 사용자')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Theo dõi ai đã lưu Gemini API key riêng, trạng thái key và lỗi kiểm tra gần nhất.',
            'Track who saved a Gemini API key, its status, and the latest validation error.',
            '查看谁保存了 Gemini API 密钥、密钥状态和最近验证错误。',
            'Gemini API キーを保存したユーザー、状態、直近の検証エラーを確認します。',
            'Gemini API 키 저장 사용자, 상태, 최근 검증 오류를 확인합니다.'
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Tổng', 'Total', '总数', '合計', '전체')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Đang bật', 'Enabled', '已启用', '有効', '사용')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.enabled}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Hợp lệ', 'Valid', '有效', '有効', '유효')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{stats.valid}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Lỗi key', 'Invalid', '无效', '無効', '무효')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{stats.invalid}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="mt-6">
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('Thành viên', 'Member', '成员', 'メンバー', '회원')}</TableHead>
                <TableHead>{tr('Gói key', 'Key status', '密钥状态', 'キー状態', '키 상태')}</TableHead>
                <TableHead>{tr('Gói trả phí', 'Paid plan', '付费套餐', '有料プラン', '유료 요금제')}</TableHead>
                <TableHead>{tr('Provider', 'Provider', '服务商', 'プロバイダー', '제공업체')}</TableHead>
                <TableHead>{tr('Key', 'Key', '密钥', 'キー', '키')}</TableHead>
                <TableHead>{tr('Kiểm tra gần nhất', 'Last checked', '最近检查', '最終確認', '마지막 확인')}</TableHead>
                <TableHead>{tr('Hết hạn', 'Expires', '到期', '期限', '만료')}</TableHead>
                <TableHead>{tr('Lỗi gần nhất', 'Last error', '最近错误', '直近エラー', '최근 오류')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {tr('Chưa có thành viên nào lưu API key riêng.', 'No member has saved a BYOK API key yet.', '尚无成员保存自带 API 密钥。', 'BYOK API キーを保存したメンバーはまだいません。', '아직 BYOK API 키를 저장한 회원이 없습니다.')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.user_id}-${row.provider}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{row.full_name || row.email || row.user_id}</div>
                        <div className="text-xs text-muted-foreground">{row.email || row.user_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={row.is_enabled ? 'default' : 'secondary'}>{planFromKeyStatus(row.status, row.is_enabled)}</Badge>
                        <Badge variant={row.status === 'valid' ? 'success' : row.status === 'invalid' ? 'destructive' : 'secondary'}>{row.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={row.subscription_status === 'active' ? 'success' : 'secondary'}>
                          {row.subscription_plan_id ? row.subscription_plan_id.toUpperCase() : '-'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{row.subscription_status || '-'} · {formatVnd(row.latest_payment_amount)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{row.key_hint || '-'}</TableCell>
                    <TableCell>{formatDate(row.last_checked_at, uiLocale)}</TableCell>
                    <TableCell>{formatDate(row.current_period_end, uiLocale)}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={row.last_error || ''}>
                      {row.last_error || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
