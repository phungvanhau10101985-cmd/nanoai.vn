'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Download, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import {
  exportMyMessagingOrdersExcel,
  listMyMessagingOrderEvents,
  listMyMessagingOrders,
  updateMyMessagingOrderShipping,
  updateMyMessagingOrderStatus,
} from '@/app/dashboard/messaging/actions'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type OrderStatus = 'awaiting_payment' | 'payment_checking' | 'paid_verified' | 'pending_manual_review' | 'cancelled'

type OrderRow = {
  id: string
  partner_id: string
  partner_display_name: string
  status: OrderStatus
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  product_name: string
  product_image_url: string
  product_url: string
  quantity: number
  subtotal_amount: number
  required_amount: number
  paid_amount: number
  payment_reference: string
  payment_qr_url: string
  verified_note: string
  shipping_status: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'returned' | 'cancelled'
  locked_at: string | null
  created_at: string
  latest_proof_image_url: string | null
  latest_proof_status: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  latest_proof_reason: string | null
}

type OrderEventRow = {
  id: string
  order_id: string
  event_type: string
  title: string
  detail: string
  source: string
  created_by: string
  created_at: string
}

function money(v: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(v || 0)))}đ`
}

function statusLabel(s: OrderStatus): string {
  if (s === 'awaiting_payment') return 'Cho thanh toan'
  if (s === 'payment_checking') return 'Dang doi chieu'
  if (s === 'paid_verified') return 'Da xac nhan'
  if (s === 'pending_manual_review') return 'Can duyet tay'
  return 'Da huy'
}

function shippingLabel(s: OrderRow['shipping_status']): string {
  if (s === 'pending') return 'Cho xac nhan'
  if (s === 'confirmed') return 'Da xac nhan don'
  if (s === 'packing') return 'Dang dong goi'
  if (s === 'shipping') return 'Dang giao hang'
  if (s === 'delivered') return 'Da giao thanh cong'
  if (s === 'returned') return 'Hoan/tra hang'
  return 'Da huy'
}

function proofLabel(s: OrderRow['latest_proof_status']): string {
  if (s === 'verified') return 'Proof: khop'
  if (s === 'manual_review') return 'Proof: can duyet tay'
  if (s === 'failed') return 'Proof: khong khop'
  if (s === 'pending') return 'Proof: cho xu ly'
  return 'Proof: chua co'
}

export function PartnerMessagingOrdersClient({ initialPartners }: { initialPartners: PartnerRow[] }) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({})
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, OrderEventRow[]>>({})

  const loadOrders = () => {
    startTransition(async () => {
      const res = await listMyMessagingOrders({
        partnerId: selectedPartnerId === 'all' ? '' : selectedPartnerId,
        status: selectedStatus === 'all' ? '' : selectedStatus,
        limit: 200,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res) setRows((res.rows ?? []) as unknown as OrderRow[])
    })
  }

  const exportExcel = () => {
    startTransition(async () => {
      const res = await exportMyMessagingOrdersExcel({
        partnerId: selectedPartnerId === 'all' ? '' : selectedPartnerId,
        status: selectedStatus === 'all' ? '' : selectedStatus,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if (!('ok' in res) || !res.ok) return
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: `Đã tải ${res.count.toLocaleString('vi-VN')} đơn (${res.filename}).` })
    })
  }

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId, selectedStatus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.payment_reference.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').toLowerCase().includes(q)
      )
    })
  }, [rows, query])

  const setStatus = (orderId: string, status: OrderStatus) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderStatus({ orderId, status, verifiedNote: note })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Da cap nhat trang thai don.' })
      loadOrders()
    })
  }

  const setShipping = (orderId: string, shippingStatus: OrderRow['shipping_status']) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderShipping({
        orderId,
        shippingStatus,
        note,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Da cap nhat giao hang va thong bao ve chat.' })
      loadOrders()
      if (selectedOrderId === orderId) {
        const evt = await listMyMessagingOrderEvents({ orderId, limit: 60 })
        if ('rows' in evt) {
          setEventsByOrder((prev) => ({ ...prev, [orderId]: (evt.rows ?? []) as unknown as OrderEventRow[] }))
        }
      }
    })
  }

  useEffect(() => {
    const oid = selectedOrderId
    if (!oid || eventsByOrder[oid]) return
    startTransition(async () => {
      const res = await listMyMessagingOrderEvents({ orderId: oid, limit: 60 })
      if ('rows' in res) {
        setEventsByOrder((prev) => ({ ...prev, [oid]: (res.rows ?? []) as unknown as OrderEventRow[] }))
      }
    })
  }, [eventsByOrder, selectedOrderId])

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue placeholder="Tat ca workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tat ca workspace</SelectItem>
              {initialPartners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Tat ca trang thai" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tat ca trang thai</SelectItem>
              <SelectItem value="awaiting_payment">Cho thanh toan</SelectItem>
              <SelectItem value="pending_manual_review">Can duyet tay</SelectItem>
              <SelectItem value="paid_verified">Da xac nhan</SelectItem>
              <SelectItem value="cancelled">Da huy</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tim theo ma don / ten KH / sdt / san pham"
            className="h-9 min-w-[260px] flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={() => exportExcel()}
            disabled={pending}
            title="Xuat tat ca don khop bo loc workspace + trang thai (khong theo o tim kiem nhanh)."
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Xuất Excel
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={loadOrders} disabled={pending}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Tai lai
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="py-8 text-sm text-muted-foreground">Chua co don hang nao.</CardContent>
          </Card>
        ) : null}
        {filtered.map((r) => (
          <Card key={r.id} className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span>{r.payment_reference || r.id.slice(0, 8)}</span>
                <Badge variant="secondary">{statusLabel(r.status)}</Badge>
                <Badge variant="outline">{proofLabel(r.latest_proof_status)}</Badge>
                <Badge variant="outline">{shippingLabel(r.shipping_status)}</Badge>
                {r.locked_at ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Da khoa don</Badge> : null}
                <span className="text-xs font-normal text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <strong>Workspace:</strong> {r.partner_display_name || r.partner_id}
                </p>
                <p>
                  <strong>Khach:</strong> {r.customer_name || '—'} | {r.customer_phone || '—'}
                </p>
                <p>
                  <strong>Email:</strong> {r.customer_email || '—'}
                </p>
                <p>
                  <strong>Dia chi:</strong> {r.shipping_address || '—'}
                </p>
                <p>
                  <strong>San pham:</strong> {r.product_name}
                </p>
                <p>
                  <strong>Tien:</strong> Tong {money(r.subtotal_amount)} | Can thanh toan {money(r.required_amount)} | Da ghi nhan {money(r.paid_amount)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.product_url ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={r.product_url} target="_blank" rel="noopener noreferrer">
                      Mo san pham
                    </a>
                  </Button>
                ) : null}
                {r.latest_proof_image_url ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={r.latest_proof_image_url} target="_blank" rel="noopener noreferrer">
                      Mo anh chung tu
                    </a>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/dashboard/messaging">Mo inbox</Link>
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={noteByOrder[r.id] ?? r.verified_note ?? ''}
                  onChange={(e) => setNoteByOrder((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Ghi chu xac nhan / ly do (tu chon)"
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={() => setStatus(r.id, 'paid_verified')} disabled={pending}>
                  Xac nhan da thanh toan
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setStatus(r.id, 'pending_manual_review')} disabled={pending}>
                  Danh dau can duyet tay
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setStatus(r.id, 'cancelled')} disabled={pending}>
                  Huy don
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <Select
                  value={r.shipping_status}
                  onValueChange={(v) =>
                    setShipping(
                      r.id,
                      v === 'pending' ||
                        v === 'confirmed' ||
                        v === 'packing' ||
                        v === 'shipping' ||
                        v === 'delivered' ||
                        v === 'returned' ||
                        v === 'cancelled'
                        ? (v as OrderRow['shipping_status'])
                        : 'pending'
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Cho xac nhan</SelectItem>
                    <SelectItem value="confirmed">Da xac nhan don</SelectItem>
                    <SelectItem value="packing">Dang dong goi</SelectItem>
                    <SelectItem value="shipping">Dang giao hang</SelectItem>
                    <SelectItem value="delivered">Da giao thanh cong</SelectItem>
                    <SelectItem value="returned">Hoan/tra hang</SelectItem>
                    <SelectItem value="cancelled">Da huy</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedOrderId(r.id)}>
                  Xem timeline
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/dashboard/messaging">Mo chat</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>

        <Card className="h-fit border-border/70 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedOrderId ? (
              <p className="text-sm text-muted-foreground">Chon 1 don ben trai de xem lich su su kien.</p>
            ) : (eventsByOrder[selectedOrderId] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Chua co su kien.</p>
            ) : (
              <div className="space-y-2">
                {(eventsByOrder[selectedOrderId] ?? []).map((e) => (
                  <div key={e.id} className="rounded-md border border-border/60 p-2">
                    <p className="text-xs font-semibold">{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">{e.detail}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()} • {e.source}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
