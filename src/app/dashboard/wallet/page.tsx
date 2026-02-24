import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import WalletClientPage from './wallet-client-page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export default async function WalletPage() {
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <WalletClientPage userId={user.id} />
      
      <Card>
        <CardHeader>
          <CardTitle>{tr('Lịch sử giao dịch', 'Transaction history', '交易记录', '取引履歴', '거래 내역')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Ngày', 'Date', '日期', '日付', '날짜')}</TableHead>
                  <TableHead>{tr('Mô tả', 'Description', '说明', '説明', '설명')}</TableHead>
                  <TableHead>{tr('Loại', 'Type', '类型', '種類', '유형')}</TableHead>
                  <TableHead className="text-right">{tr('Số tiền', 'Amount', '金额', '金額', '금액')}</TableHead>
                  <TableHead className="text-right">{tr('Trạng thái', 'Status', '状态', '状態', '상태')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'deposit' ? 'default' : 'secondary'}>
                          {tx.type === 'deposit' ? tr('Nạp tiền', 'Deposit', '充值', '入金', '충전') : tr('Sử dụng', 'Usage', '使用', '利用', '사용')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            tx.status === 'completed'
                              ? 'success'
                              : tx.status === 'pending'
                              ? 'warning'
                              : 'destructive'
                          }
                        >
                          {tx.status === 'completed' ? tr('Hoàn thành', 'Completed', '完成', '完了', '완료') : tx.status === 'pending' ? tr('Đang chờ', 'Pending', '处理中', '保留中', '대기 중') : tr('Thất bại', 'Failed', '失败', '失敗', '실패')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      {tr('Chưa có giao dịch nào.', 'No transactions yet.', '暂无交易记录。', '取引履歴はまだありません。', '거래 내역이 없습니다.')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
