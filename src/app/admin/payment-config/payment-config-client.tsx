'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStepUpOtp } from '@/components/auth/step-up-otp-provider'
import { isStepUpRequiredError } from '@/lib/auth/step-up-otp-shared'
import {
  deletePaymentConfigAction,
  listPaymentConfigsAction,
  savePaymentConfigAction,
  type PaymentConfigRow,
} from './actions'

const DEFAULT_QR =
  'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}'

function readUiLocaleFromCookie(): WebLocale {
  return readWebLocaleFromDocumentCookie()
}

export function PaymentConfigClient({ initialLocale }: { initialLocale: WebLocale }) {
  const router = useRouter()
  const [uiLocale, setUiLocale] = useState<WebLocale>(initialLocale)
  const [rows, setRows] = useState<PaymentConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PaymentConfigRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentConfigRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [bankAccount, setBankAccount] = useState('')
  const [bankId, setBankId] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [qrTemplateUrl, setQrTemplateUrl] = useState(DEFAULT_QR)
  const [isActive, setIsActive] = useState(true)

  const { toast } = useToast()
  const { runWithStepUp } = useStepUpOtp()

  const tr = useCallback((vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }, [uiLocale])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listPaymentConfigsAction()
    setLoading(false)
    if ('error' in res) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: res.error,
        variant: 'destructive',
      })
      return
    }
    setRows(res.data)
  }, [toast, tr])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const syncLocale = () => setUiLocale(readUiLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const openCreate = () => {
    setEditing(null)
    setBankAccount('')
    setBankId('')
    setBankName('')
    setAccountHolder('')
    setQrTemplateUrl(DEFAULT_QR)
    setIsActive(true)
    setDialogOpen(true)
  }

  const openEdit = (row: PaymentConfigRow) => {
    setEditing(row)
    setBankAccount(row.bank_account)
    setBankId(row.bank_id)
    setBankName(row.bank_name)
    setAccountHolder(row.account_holder_name || '')
    setQrTemplateUrl(row.qr_template_url || DEFAULT_QR)
    setIsActive(row.is_active !== false)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await runWithStepUp(() =>
      savePaymentConfigAction({
        id: editing?.id,
        bank_account: bankAccount,
        bank_id: bankId,
        bank_name: bankName,
        account_holder_name: accountHolder,
        qr_template_url: qrTemplateUrl,
        is_active: isActive,
      })
    )
    setSaving(false)
    if ('error' in res) {
      if (isStepUpRequiredError(res)) return
      if (res.error === 'bank_required') {
        toast({
          title: tr('Thiếu thông tin', 'Missing fields', '信息不完整', '未入力の項目', '정보 부족'),
          description: tr(
            'Nhập đủ số tài khoản, mã ngân hàng và tên ngân hàng.',
            'Enter account number, bank code, and bank name.',
            '请填写账号、银行代码和银行名称。',
            '口座番号・銀行コード・銀行名を入力してください。',
            '계좌번호, 은행 코드, 은행명을 입력하세요.'
          ),
          variant: 'destructive',
        })
      } else {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: res.error,
          variant: 'destructive',
        })
      }
      return
    }
    toast({
      title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
      description: tr(
        'Cấu hình thanh toán đã được cập nhật.',
        'Payment settings updated.',
        '支付配置已更新。',
        '支払い設定を更新しました。',
        '결제 설정이 업데이트되었습니다.'
      ),
    })
    setDialogOpen(false)
    await load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await runWithStepUp(() => deletePaymentConfigAction(deleteTarget.id))
    setDeleting(false)
    if ('error' in res) {
      if (isStepUpRequiredError(res)) return
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: res.error,
        variant: 'destructive',
      })
      return
    }
    toast({
      title: tr('Đã xóa', 'Deleted', '已删除', '削除しました', '삭제됨'),
      description: tr(
        'Đã xóa cấu hình ngân hàng.',
        'Bank configuration removed.',
        '已删除银行配置。',
        '銀行設定を削除しました。',
        '은행 설정을 삭제했습니다.'
      ),
    })
    setDeleteTarget(null)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tr('Cấu hình nạp tiền', 'Top-up payment config', '充值支付配置', '入金・支払い設定', '충전 결제 설정')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr(
              'Thiết lập số tài khoản nhận tiền và mã QR (SePay). Người dùng thấy cấu hình đang bật khi nạp Credits.',
              'Set receiving account and QR template (SePay). Users see active configs when topping up credits.',
              '设置收款账户与二维码模板（SePay）。用户充值时可见已启用的配置。',
              '受取口座とQRテンプレート（SePay）を設定。有効な設定がチャージ画面に表示されます。',
              '수금 계좌와 QR 템플릿(SePay)을 설정합니다. 충전 시 활성 구성이 표시됩니다.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {tr('Thêm cấu hình', 'Add config', '添加配置', '設定を追加', '구성 추가')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {tr('Về admin', 'Back to admin', '返回管理', '管理へ戻る', '관리로')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Danh sách tài khoản nhận', 'Receiving accounts', '收款账户', '受取口座', '수금 계좌')}</CardTitle>
          <CardDescription>
            {tr(
              'Cột số tài khoản phải khớp STK thực tế. Mã ngân hàng: MB, VCB, ... (theo SePay/VietQR).',
              'Account number must match the real account. Bank codes: MB, VCB, … (per SePay/VietQR).',
              '账号须与真实账户一致。银行代码：MB、VCB 等（按 SePay/VietQR）。',
              '口座番号は実口座と一致させてください。銀行コードは MB, VCB など（SePay/VietQR）。',
              '계좌번호는 실제와 일치해야 합니다. 은행 코드: MB, VCB 등(SePay/VietQR).'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {tr(
                'Chưa có cấu hình. Bấm «Thêm cấu hình» để nhập số tài khoản.',
                'No config yet. Click «Add config» to enter an account number.',
                '尚无配置。点击「添加配置」输入账号。',
                '設定がありません。「設定を追加」で口座を入力してください。',
                '구성이 없습니다. «구성 추가»로 계좌를 입력하세요.'
              )}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-left">
                    <th className="p-3 font-medium">{tr('Ngân hàng', 'Bank', '银行', '銀行', '은행')}</th>
                    <th className="p-3 font-medium">{tr('Số TK', 'Account No.', '账号', '口座番号', '계좌번호')}</th>
                    <th className="p-3 font-medium">{tr('Mã NH', 'Code', '代码', 'コード', '코드')}</th>
                    <th className="p-3 font-medium">{tr('Chủ TK', 'Holder', '户名', '名義', '예금주')}</th>
                    <th className="p-3 font-medium">{tr('Hoạt động', 'Active', '启用', '有効', '활성')}</th>
                    <th className="p-3 font-medium w-[120px]">{tr('Thao tác', 'Actions', '操作', '操作', '작업')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{row.bank_name}</td>
                      <td className="p-3 font-mono">{row.bank_account}</td>
                      <td className="p-3 font-mono">{row.bank_id}</td>
                      <td className="p-3 text-muted-foreground">{row.account_holder_name || '—'}</td>
                      <td className="p-3">
                        {row.is_active !== false ? (
                          <Badge>{tr('Bật', 'On', '开', 'オン', '켜짐')}</Badge>
                        ) : (
                          <Badge variant="secondary">{tr('Tắt', 'Off', '关', 'オフ', '꺼짐')}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? tr('Sửa cấu hình', 'Edit config', '编辑配置', '設定を編集', '구성 편집')
                : tr('Thêm cấu hình', 'Add config', '添加配置', '設定を追加', '구성 추가')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'Nhập số tài khoản nhận tiền và thông tin ngân hàng.',
                'Enter the receiving account and bank details.',
                '输入收款账户与银行信息。',
                '受取口座と銀行情報を入力してください。',
                '수금 계좌와 은행 정보를 입력하세요.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pc-bank-account">
                {tr('Số tài khoản', 'Account number', '银行账号', '口座番号', '계좌번호')} *
              </Label>
              <Input
                id="pc-bank-account"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="0123456789"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-bank-id">
                {tr('Mã ngân hàng', 'Bank code', '银行代码', '銀行コード', '은행 코드')} * (MB, VCB, …)
              </Label>
              <Input
                id="pc-bank-id"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                placeholder="MB"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-bank-name">
                {tr('Tên ngân hàng hiển thị', 'Display bank name', '显示银行名称', '表示名', '표시 은행명')} *
              </Label>
              <Input
                id="pc-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={tr('MB Bank', 'MB Bank', 'MB Bank', 'MB Bank', 'MB Bank')}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-holder">{tr('Chủ tài khoản', 'Account holder', '账户名', '口座名義', '예금주')}</Label>
              <Input
                id="pc-holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-qr">{tr('URL mẫu QR', 'QR template URL', '二维码模板 URL', 'QRテンプレURL', 'QR 템플릿 URL')}</Label>
              <Input
                id="pc-qr"
                value={qrTemplateUrl}
                onChange={(e) => setQrTemplateUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="pc-active"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="pc-active" className="font-normal cursor-pointer">
                {tr('Đang sử dụng (hiện khi nạp tiền)', 'Active (shown when topping up)', '启用（充值时显示）', '有効（チャージ時に表示）', '활성(충전 시 표시)')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Lưu', 'Save', '保存', '保存', '저장')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('Xóa cấu hình?', 'Delete config?', '删除配置？', '設定を削除？', '구성 삭제?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                'Hành động này không thể hoàn tác. Giao dịch đang chờ vẫn giữ trong bảng payments.',
                'This cannot be undone. Pending payments remain in the payments table.',
                '此操作无法撤销。待处理交易仍保留在 payments 表中。',
                '元に戻せません。保留中の支払いは payments に残ります。',
                '되돌릴 수 없습니다. 대기 중 결제는 payments에 남습니다.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Xóa', 'Delete', '删除', '削除', '삭제')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
