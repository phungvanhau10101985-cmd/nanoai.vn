'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Handshake, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'

type TabKey = 'applications' | 'commissions' | 'withdrawals'

type ApplicationRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  socialLinks: string[]
  note: string | null
  adminNote: string | null
  submittedAt: string
  emailNormalized: string | null
}

type CommissionRow = {
  id: string
  order_id: string
  order_code: string | null
  commission_amount: number
  commission_percent: number
  status: string
  created_at: string
  email_normalized: string | null
}

type WithdrawalRow = {
  id: string
  amount: number
  bank_name: string
  bank_account: string
  account_holder: string
  status: string
  admin_note: string | null
  created_at: string
  email_normalized?: string | null
}

const COPY: Record<WebLocale, string[]> = {
  vi: [
    'Duyệt affiliate',
    'Đăng ký CTV',
    'Hoa hồng',
    'Rút tiền',
    'Chờ duyệt',
    'Tất cả',
    'Duyệt',
    'Từ chối',
    'Ghi chú từ chối',
    'Không có dữ liệu.',
    'Đã cập nhật.',
    'Không cập nhật được.',
  ],
  en: [
    'Affiliate review',
    'Applications',
    'Commissions',
    'Withdrawals',
    'Pending',
    'All',
    'Approve',
    'Reject',
    'Reject note',
    'No rows yet.',
    'Updated.',
    'Could not update.',
  ],
  zh: [
    '联盟审核',
    '申请',
    '佣金',
    '提现',
    '待审',
    '全部',
    '通过',
    '拒绝',
    '拒绝备注',
    '暂无数据。',
    '已更新。',
    '无法更新。',
  ],
  ja: [
    'アフィリエイト審査',
    '申請',
    '手数料',
    '出金',
    '承認待ち',
    'すべて',
    '承認',
    '却下',
    '却下メモ',
    'データがありません。',
    '更新しました。',
    '更新できませんでした。',
  ],
  ko: [
    '제휴 검토',
    '신청',
    '수수료',
    '출금',
    '대기',
    '전체',
    '승인',
    '거절',
    '거절 메모',
    '데이터가 없습니다.',
    '업데이트했습니다.',
    '업데이트하지 못했습니다.',
  ],
}

function fmt(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0))}đ`
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN')
}

export function PartnerAffiliateOpsCard(props: {
  partnerId: string
  locale: WebLocale
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}) {
  const t = COPY[props.locale] ?? COPY.en
  const api = useMemo(
    () => `/api/messaging/partners/${encodeURIComponent(props.partnerId)}/affiliate`,
    [props.partnerId]
  )
  const [tab, setTab] = useState<TabKey>('applications')
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = filter === 'all' ? '' : filter
      const query = new URLSearchParams({ kind: tab, limit: '100' })
      if (status) query.set('status', status)
      const res = await fetch(`${api}?${query.toString()}`)
      const json = (await res.json().catch(() => null)) as {
        applications?: ApplicationRow[]
        commissions?: CommissionRow[]
        withdrawals?: WithdrawalRow[]
      } | null
      if (tab === 'applications') setApplications(json?.applications ?? [])
      if (tab === 'commissions') setCommissions(json?.commissions ?? [])
      if (tab === 'withdrawals') setWithdrawals(json?.withdrawals ?? [])
    } finally {
      setLoading(false)
    }
  }, [api, filter, tab])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(body: Record<string, unknown>, id: string) {
    setBusyId(id)
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      props.onToast?.(res.ok ? t[10] : t[11], res.ok ? 'default' : 'destructive')
      if (res.ok) {
        setRejectId(null)
        setRejectNote('')
        await load()
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="h-5 w-5" />
          {t[0]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['applications', 'commissions', 'withdrawals'] as const).map((key, index) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => {
                setTab(key)
                setFilter(key === 'commissions' ? 'all' : 'pending')
              }}
            >
              {t[index + 1]}
            </Button>
          ))}
          <select
            className="ml-auto rounded-md border border-gray-200 px-2 py-1 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="pending">{t[4]}</option>
            <option value="all">{t[5]}</option>
            {tab === 'applications' ? (
              <>
                <option value="approved">{t[6]}</option>
                <option value="rejected">{t[7]}</option>
              </>
            ) : null}
            {tab === 'commissions' ? (
              <>
                <option value="confirmed">{t[6]}</option>
                <option value="cancelled">{t[7]}</option>
              </>
            ) : null}
            {tab === 'withdrawals' ? <option value="approved">{t[6]}</option> : null}
          </select>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : tab === 'applications' ? (
          applications.length === 0 ? (
            <p className="text-sm text-gray-500">{t[9]}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody className="divide-y">
                  {applications.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{row.emailNormalized || row.id.slice(0, 8)}</div>
                        <div className="text-xs text-gray-500">{fmtDate(row.submittedAt)}</div>
                        <div className="text-xs break-all">{row.socialLinks.join(', ')}</div>
                        {row.note ? <div className="text-xs text-gray-600">{row.note}</div> : null}
                      </td>
                      <td className="py-2 whitespace-nowrap">{row.status}</td>
                      <td className="py-2 text-right">
                        {row.status === 'pending' ? (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                disabled={busyId === row.id}
                                onClick={() => void postAction({ action: 'approve', applicationId: row.id }, row.id)}
                              >
                                {t[6]}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === row.id}
                                onClick={() => setRejectId(row.id)}
                              >
                                {t[7]}
                              </Button>
                            </div>
                            {rejectId === row.id ? (
                              <div className="w-56 space-y-1 text-left">
                                <Label>{t[8]}</Label>
                                <Textarea rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busyId === row.id}
                                  onClick={() =>
                                    void postAction(
                                      { action: 'reject', applicationId: row.id, adminNote: rejectNote },
                                      row.id
                                    )
                                  }
                                >
                                  {t[7]}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'commissions' ? (
          commissions.length === 0 ? (
            <p className="text-sm text-gray-500">{t[9]}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody className="divide-y">
                  {commissions.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2">
                        {row.order_code || row.order_id.slice(0, 8)} · {row.email_normalized || '—'}
                      </td>
                      <td className="py-2">{fmt(row.commission_amount)} ({row.commission_percent}%)</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{fmtDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : withdrawals.length === 0 ? (
          <p className="text-sm text-gray-500">{t[9]}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody className="divide-y">
                {withdrawals.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2">
                      <div>{row.email_normalized || row.id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-500">
                        {row.bank_name} · {row.bank_account} · {row.account_holder}
                      </div>
                    </td>
                    <td className="py-2">{fmt(row.amount)}</td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2 text-right">
                      {row.status === 'pending' ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={busyId === row.id}
                              onClick={() =>
                                void postAction({ action: 'approve_withdrawal', withdrawalId: row.id }, row.id)
                              }
                            >
                              {t[6]}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectId(row.id)}>
                              {t[7]}
                            </Button>
                          </div>
                          {rejectId === row.id ? (
                            <div className="w-56 space-y-1 text-left">
                              <Label>{t[8]}</Label>
                              <Textarea rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busyId === row.id}
                                onClick={() =>
                                  void postAction(
                                    {
                                      action: 'reject_withdrawal',
                                      withdrawalId: row.id,
                                      adminNote: rejectNote,
                                    },
                                    row.id
                                  )
                                }
                              >
                                {t[7]}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
