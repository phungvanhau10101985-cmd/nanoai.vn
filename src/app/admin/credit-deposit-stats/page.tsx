import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import {
  fetchAdminCreditDepositAggregateInRange,
  fetchAdminCreditDepositByPeriodInRange,
  fetchAdminCreditDepositRowsInRange,
  fetchAdminPendingCreditDeposits,
  type CreditDepositBucket,
} from '@/lib/db/admin-credit-deposit-stats-pg'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { ConfirmCreditDepositButton } from './confirm-deposit-button'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê nạp credit',
  description: 'Mã đơn nạp chờ xác nhận và thống kê nạp credit theo ngày, tháng, năm.',
  path: '/admin/credit-deposit-stats',
  noIndex: true,
})

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatVnd(n: number, locale: string) {
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US').format(
    Math.round(n)
  )
}

function formatCredits(n: number, locale: string) {
  if (!Number.isFinite(n)) return '0'
  const maxFrac = n % 1 !== 0 ? 2 : 0
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(n)
}

function parseBucket(raw: string | undefined): CreditDepositBucket {
  if (raw === 'month' || raw === 'year') return raw
  return 'day'
}

export default async function AdminCreditDepositStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string; bucket?: string }
}) {
  const uiLocale = getCurrentWebLocale()
  const localeTag = uiLocale === 'en' ? 'en-US' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'vi-VN'

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const fromParam = searchParams?.from?.trim()
  const toParam = searchParams?.to?.trim()
  const fromDate = fromParam || toYMD(thirtyDaysAgo)
  const toDate = toParam || toYMD(today)
  const bucket = parseBucket(searchParams?.bucket)

  const fromIso = fromDate + 'T00:00:00+07:00'
  const toIso = toDate + 'T23:59:59.999+07:00'

  const [aggResult, rowsResult, periodResult, pendingResult] = await Promise.all([
    fetchAdminCreditDepositAggregateInRange(fromIso, toIso),
    fetchAdminCreditDepositRowsInRange(fromIso, toIso, 500),
    fetchAdminCreditDepositByPeriodInRange(fromIso, toIso, bucket),
    fetchAdminPendingCreditDeposits(200),
  ])

  const aggErr = aggResult.error || rowsResult.error || periodResult.error || pendingResult.error
  const agg = aggResult.data

  const bucketHref = (next: CreditDepositBucket) => {
    const p = new URLSearchParams()
    p.set('from', fromDate)
    p.set('to', toDate)
    p.set('bucket', next)
    return `/admin/credit-deposit-stats?${p.toString()}`
  }

  const confirmLabels = {
    confirm: tr('Xác nhận', 'Confirm', '确认', '確認', '확인'),
    confirmAgain: tr('Xác nhận lại', 'Confirm again', '再次确认', 'もう一度確認', '다시 확인'),
    cancel: tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소'),
    title: tr('Xác nhận đơn nạp credit', 'Confirm credit top-up', '确认充值订单', 'チャージ注文を確認', '충전 주문 확인'),
    success: tr('Đã cộng credit.', 'Credits added.', '已发放积分。', 'クレジットを付与しました。', '크레딧을 지급했습니다.'),
    errorTitle: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thống kê lịch sử nạp credit', 'Credit top-up statistics', '充值积分统计', 'クレジットチャージ統計', '크레딧 충전 통계')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Đơn chờ xác nhận nằm trên cùng — bấm Xác nhận rồi Xác nhận lại mới cộng credit. Thống kê bên dưới chỉ tính đơn đã xong (giờ Việt Nam).',
            'Pending orders are at the top — click Confirm, then Confirm again, before credits are added. Stats below count completed orders only (Vietnam time).',
            '待确认订单在最上方 — 先点确认，再点再次确认，才会发放积分。下方统计只计已完成订单（越南时间）。',
            '確認待ちは上部です。確認のあと「もう一度確認」を押してからクレジットが付与されます。下の統計は完了分のみ（ベトナム時間）。',
            '확인 대기 주문은 위에 있습니다. 확인 후 다시 확인을 눌러야 크레딧이 지급됩니다. 아래 통계는 완료 건만 (베트남 시간).'
          )}
        </p>
        <p className="mt-1 text-sm">
          <Link href="/admin/credit-spend-stats" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {tr('Thống kê trừ credit theo tính năng', 'Credit spend by feature', '按功能的积分消耗', '機能別クレジット消費', '기능별 크레딧 사용')}
          </Link>
        </p>
      </div>

      <ApiStatsDateFilter
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/credit-deposit-stats"
        extraQuery={{ bucket }}
      />

      {aggErr ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              {tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {aggErr}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {tr('Danh sách mã đơn nạp credit', 'Credit top-up order codes', '充值订单号', 'チャージ注文番号', '충전 주문번호')}
              </CardTitle>
              <CardDescription>
                {tr(
                  'Đơn còn chờ. Bấm Xác nhận để mở hộp thoại, rồi bấm Xác nhận lại — credit chỉ được cộng sau lần thứ hai. Danh sách này không theo bộ lọc ngày.',
                  'Still pending. Click Confirm to open the dialog, then Confirm again — credits are added only on the second click. This list ignores the date filter.',
                  '仍在等待。先点确认打开对话框，再点再次确认 — 积分只在第二次点击后发放。此列表不受日期筛选影响。',
                  'まだ保留です。確認でダイアログを開き、もう一度確認を押すとクレジットが付与されます。この一覧は日付フィルタの対象外です。',
                  '아직 대기 중입니다. 확인으로 창을 연 뒤 다시 확인을 눌러야 크레딧이 지급됩니다. 이 목록은 날짜 필터와 무관합니다.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {pendingResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr(
                    'Không có đơn nạp đang chờ.',
                    'No pending top-up orders.',
                    '没有待确认的充值订单。',
                    '確認待ちのチャージはありません。',
                    '확인 대기 중인 충전 주문이 없습니다.'
                  )}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{tr('Tạo lúc', 'Created', '创建时间', '作成', '생성')}</TableHead>
                      <TableHead>{tr('Email', 'Email', '邮箱', 'メール', '이메일')}</TableHead>
                      <TableHead>{tr('Tên hiển thị', 'Display name', '显示名称', '表示名', '표시 이름')}</TableHead>
                      <TableHead className="min-w-[140px]">{tr('Mã đơn', 'Order code', '订单号', '注文番号', '주문번호')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Tiền (VND)', 'Amount (VND)', '金额', '金額', '금액')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Credits', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                      <TableHead className="whitespace-nowrap">{tr('Thao tác', 'Action', '操作', '操作', '작업')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingResult.rows.map((row) => {
                      const at = row.created_at || ''
                      const atLabel =
                        at && !Number.isNaN(Date.parse(at))
                          ? new Date(at).toLocaleString(uiLocale === 'vi' ? 'vi-VN' : localeTag)
                          : '—'
                      const orderCode = row.transaction_content?.trim() || '—'
                      const creditsToGrant =
                        row.credits_added > 0 ? row.credits_added : Math.floor(row.amount / CREDIT_UNIT_PRICE_VND)
                      const body = tr(
                        `Mã đơn ${orderCode}. Cộng ${formatCredits(creditsToGrant, uiLocale)} credit (${formatVnd(row.amount, uiLocale)} VND) cho ${row.email || row.full_name || 'khách'}. Bấm Xác nhận lại để cộng credit. Lần này không hoàn tác.`,
                        `Order ${orderCode}. Add ${formatCredits(creditsToGrant, uiLocale)} credits (${formatVnd(row.amount, uiLocale)} VND) for ${row.email || row.full_name || 'the customer'}. Click Confirm again to add the credits. This cannot be undone.`,
                        `订单 ${orderCode}。向 ${row.email || row.full_name || '客户'} 发放 ${formatCredits(creditsToGrant, uiLocale)} 积分（${formatVnd(row.amount, uiLocale)} VND）。点击再次确认后才会发放，且无法撤销。`,
                        `注文 ${orderCode}。${row.email || row.full_name || 'お客様'} に ${formatCredits(creditsToGrant, uiLocale)} クレジット（${formatVnd(row.amount, uiLocale)} VND）を付与します。もう一度確認を押すと付与され、取り消せません。`,
                        `주문 ${orderCode}. ${row.email || row.full_name || '고객'}에게 크레딧 ${formatCredits(creditsToGrant, uiLocale)}개(${formatVnd(row.amount, uiLocale)} VND)를 지급합니다. 다시 확인을 눌러야 지급되며 되돌릴 수 없습니다.`
                      )
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs">{atLabel}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs" title={row.email ?? ''}>
                            {row.email ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-xs" title={row.full_name ?? ''}>
                            {row.full_name ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate font-mono text-xs" title={orderCode}>
                            {orderCode}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatVnd(row.amount, uiLocale)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatCredits(creditsToGrant, uiLocale)}</TableCell>
                          <TableCell>
                            <ConfirmCreditDepositButton
                              paymentId={row.id}
                              labels={{ ...confirmLabels, body }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Giao dịch đã xong', 'Completed payments', '已完成笔数', '完了取引数', '완료 건수')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.completedCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Khách (distinct)', 'Distinct users', '独立用户数', 'ユニークユーザー', '고유 사용자')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{agg?.distinctUsers ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Tổng tiền nạp (VND)', 'Total amount (VND)', '充值总额（VND）', '入金合計（VND）', '총 입금액(VND)')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatVnd(agg?.sumAmountVnd ?? 0, uiLocale)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Tổng credit cộng', 'Total credits added', '发放的积分总和', '付与クレジット合計', '충전된 크레딧 합계')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatCredits(agg?.sumCreditsAdded ?? 0, uiLocale)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    {tr('Theo ngày / tháng / năm', 'By day / month / year', '按日 / 月 / 年', '日 / 月 / 年', '일 / 월 / 년')}
                  </CardTitle>
                  <CardDescription>
                    {tr(
                      'Gom đơn nạp đã xong trong khoảng đã chọn.',
                      'Group completed top-ups in the selected range.',
                      '按所选范围汇总已完成充值。',
                      '選択期間の完了チャージを集計。',
                      '선택한 기간의 완료된 충전을 집계합니다.'
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['day', 'month', 'year'] as const).map((b) => (
                    <Button key={b} asChild size="sm" variant={bucket === b ? 'default' : 'outline'}>
                      <Link href={bucketHref(b)}>
                        {b === 'day'
                          ? tr('Ngày', 'Day', '日', '日', '일')
                          : b === 'month'
                            ? tr('Tháng', 'Month', '月', '月', '월')
                            : tr('Năm', 'Year', '年', '年', '년')}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {periodResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr('Không có dữ liệu trong khoảng này.', 'No data in this range.', '此范围内无数据。', 'この期間にデータがありません。', '이 구간에 데이터가 없습니다.')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {bucket === 'year'
                          ? tr('Năm', 'Year', '年', '年', '년')
                          : bucket === 'month'
                            ? tr('Tháng', 'Month', '月', '月', '월')
                            : tr('Ngày', 'Day', '日期', '日', '일')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Đơn đã xong', 'Completed', '已完成', '完了', '완료')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Khách', 'Users', '用户', 'ユーザー', '사용자')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Tiền (VND)', 'Amount (VND)', '金额', '金額', '금액')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Credits', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodResult.rows.map((row) => (
                      <TableRow key={row.periodKey}>
                        <TableCell className="whitespace-nowrap tabular-nums text-xs">{row.periodKey}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{row.completedCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{row.distinctUsers}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{formatVnd(row.sumAmountVnd, uiLocale)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{formatCredits(row.sumCreditsAdded, uiLocale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr('Chi tiết giao dịch đã xong', 'Completed transactions', '已完成交易', '完了した取引', '완료된 거래')}</CardTitle>
              <CardDescription>
                {tr(
                  'Tối đa 500 bản ghi mới nhất trong khoảng đã chọn.',
                  'Up to 500 most recent rows in the selected range.',
                  '所选范围内最多 500 条最新记录。',
                  '選択した期間で最大500件まで。',
                  '선택 구간에서 최신 500건까지.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rowsResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr('Không có dữ liệu trong khoảng này.', 'No data in this range.', '此范围内无数据。', 'この期間にデータがありません。', '이 구간에 데이터가 없습니다.')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        {tr('Hoàn thành', 'Completed', '完成时间', '完了', '완료')}
                      </TableHead>
                      <TableHead>{tr('Email', 'Email', '邮箱', 'メール', '이메일')}</TableHead>
                      <TableHead>{tr('Tên hiển thị', 'Display name', '显示名称', '表示名', '표시 이름')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {tr('Tiền (VND)', 'Amount (VND)', '金额', '金額', '금액')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">{tr('Credits', 'Credits', '积分', 'クレジット', '크레딧')}</TableHead>
                      <TableHead className="min-w-[120px]">{tr('Mã GD', 'Txn ID', '交易号', '取引ID', '거래 ID')}</TableHead>
                      <TableHead>{tr('Mã đơn', 'Order code', '订单号', '注文番号', '주문번호')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsResult.rows.map((row) => {
                      const at = row.completed_at || row.created_at || ''
                      const atLabel =
                        at && !Number.isNaN(Date.parse(at))
                          ? new Date(at).toLocaleString(uiLocale === 'vi' ? 'vi-VN' : localeTag)
                          : '—'
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs">{atLabel}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs" title={row.email ?? ''}>
                            {row.email ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-xs" title={row.full_name ?? ''}>
                            {row.full_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatVnd(row.amount, uiLocale)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatCredits(row.credits_added, uiLocale)}</TableCell>
                          <TableCell className="max-w-[140px] truncate font-mono text-xs" title={row.transaction_id ?? ''}>
                            {row.transaction_id ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs" title={row.transaction_content ?? ''}>
                            {row.transaction_content ?? '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
