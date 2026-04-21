'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type AvailabilityRow = {
  room_type_id: string
  room_type_name: string
  available_rooms: number
  base_hourly_rate: number | null
  base_daily_rate: number | null
  currency: string
}

type RoomTypeRow = {
  id: string
  partner_id: string
  code: string
  name: string
  description: string | null
  max_guests: number
  base_hourly_rate: number | null
  base_daily_rate: number | null
  currency: string
  amenities: unknown
}

type BookingRow = {
  id: string
  room_type_id: string
  customer_name: string
  customer_phone: string | null
  checkin_at: string
  checkout_at: string
  total_amount: number
  paid_amount: number
  currency: string
  status: string
  created_at: string
}

type HospitalityMsg = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
}

type Panel = 'bookings' | 'rooms' | null

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return '-'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

export function GuestHospitalityClient({
  slug,
  shopDisplayName,
}: {
  slug: string
  shopDisplayName: string
}) {
  const [messages, setMessages] = useState<HospitalityMsg[]>([])
  const [draft, setDraft] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [panel, setPanel] = useState<Panel>(null)

  // "Phòng đã đặt"
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)

  // "Phòng quan tâm & trong khu vực"
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [checkinAt, setCheckinAt] = useState('')
  const [checkoutAt, setCheckoutAt] = useState('')
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('')

  const threadRef = useRef<HTMLDivElement | null>(null)

  const interestedRoomTypeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const m of messages) {
      try {
        const anyM = m as unknown as { raw_payload?: { page_context?: { room_type_id?: string } } }
        const rid = anyM.raw_payload?.page_context?.room_type_id
        if (typeof rid === 'string' && rid) ids.add(rid)
      } catch {
        // ignore
      }
    }
    if (selectedRoomTypeId) ids.add(selectedRoomTypeId)
    return ids
  }, [messages, selectedRoomTypeId])

  async function loadThread() {
    setLoadingThread(true)
    try {
      const res = await fetch(`/api/hospitality/guest/${slug}/messages`, { credentials: 'same-origin' })
      const data = (await res.json()) as { messages?: HospitalityMsg[]; error?: string }
      if (!res.ok) {
        setStatus(`Không tải được hội thoại: ${data.error || 'unknown'}`)
        return
      }
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      setStatus('Không tải được hội thoại: lỗi mạng')
    } finally {
      setLoadingThread(false)
    }
  }

  useEffect(() => {
    void loadThread()
    const id = window.setInterval(() => void loadThread(), 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function loadBookings() {
    setLoadingBookings(true)
    try {
      const res = await fetch(`/api/hospitality/guest/${slug}/my-bookings`, { credentials: 'same-origin' })
      const data = (await res.json()) as { bookings?: BookingRow[]; error?: string }
      if (!res.ok) {
        setStatus(`Không tải được danh sách phòng đã đặt: ${data.error || 'unknown'}`)
        return
      }
      setBookings(Array.isArray(data.bookings) ? data.bookings : [])
    } catch {
      setStatus('Không tải được danh sách phòng đã đặt: lỗi mạng')
    } finally {
      setLoadingBookings(false)
    }
  }

  async function loadRoomTypes() {
    setLoadingRooms(true)
    try {
      const res = await fetch(`/api/hospitality/guest/${slug}/room-types`, { credentials: 'same-origin' })
      const data = (await res.json()) as { items?: RoomTypeRow[]; error?: string }
      if (!res.ok) {
        setStatus(`Không tải được phòng trong khu vực: ${data.error || 'unknown'}`)
        return
      }
      setRoomTypes(Array.isArray(data.items) ? data.items : [])
    } catch {
      setStatus('Không tải được phòng trong khu vực: lỗi mạng')
    } finally {
      setLoadingRooms(false)
    }
  }

  async function checkAvailability() {
    if (!checkinAt || !checkoutAt) {
      setStatus('Chọn ngày nhận và trả phòng trước.')
      return
    }
    setStatus('Đang kiểm tra phòng trống...')
    const params = new URLSearchParams({ checkin_at: checkinAt, checkout_at: checkoutAt })
    const res = await fetch(`/api/hospitality/guest/${slug}/availability?${params.toString()}`)
    const data = (await res.json()) as { items?: AvailabilityRow[]; error?: string }
    if (!res.ok) {
      setStatus(`Không tải được phòng trống: ${data.error || 'unknown'}`)
      return
    }
    const list = Array.isArray(data.items) ? data.items : []
    setAvailability(list)
    setStatus(`Tìm thấy ${list.length} loại phòng trống.`)
  }

  async function sendMessage() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await fetch(`/api/hospitality/guest/${slug}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text,
          pageContext: {
            inventoryId: selectedRoomTypeId || undefined,
            source: 'hospitality_guest_chat',
            checkinAt: checkinAt || undefined,
            checkoutAt: checkoutAt || undefined,
          },
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setStatus(`Gửi thất bại: ${data.error || 'unknown'}`)
        return
      }
      setDraft('')
      await loadThread()
    } catch {
      setStatus('Gửi thất bại: lỗi mạng')
    } finally {
      setSending(false)
    }
  }

  function openBookings() {
    setPanel(panel === 'bookings' ? null : 'bookings')
    if (panel !== 'bookings') void loadBookings()
  }

  function openRooms() {
    setPanel(panel === 'rooms' ? null : 'rooms')
    if (panel !== 'rooms' && roomTypes.length === 0) void loadRoomTypes()
  }

  const interestedRoomTypes = roomTypes.filter((r) => interestedRoomTypeIds.has(r.id))
  const otherRoomTypes = roomTypes.filter((r) => !interestedRoomTypeIds.has(r.id))

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-0 rounded-xl border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-base font-semibold">{shopDisplayName}</p>
          <p className="text-xs text-muted-foreground">Trợ lý đặt phòng · Khách sạn</p>
        </div>
        <Button variant="outline" size="sm" onClick={openBookings}>
          Phòng đã đặt
        </Button>
      </div>

      {panel === 'bookings' ? (
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Phòng bạn đã đặt</p>
            <Button variant="ghost" size="sm" onClick={() => setPanel(null)}>
              Đóng
            </Button>
          </div>
          {loadingBookings ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn chưa có đặt phòng nào từ cuộc trò chuyện này.</p>
          ) : (
            <ul className="space-y-2">
              {bookings.map((b) => (
                <li key={b.id} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.customer_name}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nhận: {formatDateTime(b.checkin_at)} · Trả: {formatDateTime(b.checkout_at)}
                  </p>
                  <p className="text-xs">
                    Tổng: {formatCurrency(b.total_amount, b.currency)} · Đã thanh toán: {formatCurrency(b.paid_amount, b.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {panel === 'rooms' ? (
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Phòng quan tâm & phòng trong khu vực</p>
            <Button variant="ghost" size="sm" onClick={() => setPanel(null)}>
              Đóng
            </Button>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <Input
              type="datetime-local"
              value={checkinAt}
              onChange={(e) => setCheckinAt(e.target.value)}
              placeholder="Nhận phòng"
            />
            <Input
              type="datetime-local"
              value={checkoutAt}
              onChange={(e) => setCheckoutAt(e.target.value)}
              placeholder="Trả phòng"
            />
            <Button variant="outline" onClick={checkAvailability}>
              Kiểm tra phòng trống
            </Button>
          </div>

          {availability.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Phòng trống cho khung giờ đã chọn</p>
              <ul className="space-y-1">
                {availability.map((a) => (
                  <li
                    key={a.room_type_id}
                    className={`cursor-pointer rounded-md border p-2 text-sm ${
                      selectedRoomTypeId === a.room_type_id ? 'border-violet-500 bg-violet-50' : 'bg-background'
                    }`}
                    onClick={() => setSelectedRoomTypeId(a.room_type_id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.room_type_name}</span>
                      <span className="text-xs text-muted-foreground">Còn {a.available_rooms} phòng</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Theo giờ: {formatCurrency(a.base_hourly_rate, a.currency)} · Theo ngày:{' '}
                      {formatCurrency(a.base_daily_rate, a.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {loadingRooms ? (
            <p className="text-sm text-muted-foreground">Đang tải phòng...</p>
          ) : (
            <>
              {interestedRoomTypes.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Phòng bạn đang quan tâm</p>
                  <ul className="space-y-1">
                    {interestedRoomTypes.map((r) => (
                      <li key={r.id} className="rounded-md border bg-violet-50 p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-muted-foreground">Tối đa {r.max_guests} khách</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Theo giờ: {formatCurrency(r.base_hourly_rate, r.currency)} · Theo ngày:{' '}
                          {formatCurrency(r.base_daily_rate, r.currency)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Các phòng khác trong khu vực</p>
                {otherRoomTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có phòng nào khác.</p>
                ) : (
                  <ul className="space-y-1">
                    {otherRoomTypes.map((r) => (
                      <li key={r.id} className="rounded-md border bg-background p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-muted-foreground">Tối đa {r.max_guests} khách</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Theo giờ: {formatCurrency(r.base_hourly_rate, r.currency)} · Theo ngày:{' '}
                          {formatCurrency(r.base_daily_rate, r.currency)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      <div ref={threadRef} className="h-[60vh] min-h-[360px] overflow-y-auto bg-muted/10 px-4 py-3">
        {loadingThread && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Đang tải hội thoại...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tin nhắn.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`mb-2 max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.direction === 'inbound'
                  ? 'ml-auto bg-violet-600 text-white'
                  : 'mr-auto border bg-background text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.direction === 'inbound' ? 'text-white/70' : 'text-muted-foreground'}`}>
                {formatDateTime(m.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="border-t px-4 py-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nhập tin nhắn cho lễ tân..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendMessage()
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={openRooms}>
            Phòng quan tâm & trong khu vực
          </Button>
          <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
            {sending ? 'Đang gửi...' : 'Gửi'}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Enter để gửi · Shift+Enter xuống dòng{status ? ` · ${status}` : ''}
        </p>
      </div>
    </div>
  )
}
