'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { WeddingCard, WeddingInvitedGuest, WeddingInvitedGuestStatus } from '@/lib/db/wedding-cards-pg'
import { buildWeddingPersonalInviteUrl } from '@/lib/wedding/wedding-guest-invite-link'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import {
  appendWeddingSideInviteSettingsToFormData,
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  pickSideInviteSettings,
  serializeWeddingSideInviteSettings,
  weddingSideInviteSettingsFromCard,
  type WeddingSideInviteSettings,
} from '@/lib/wedding/wedding-side-invite-settings'
import { WeddingSideInviteSettingsPanel } from './wedding-side-invite-settings-panel'
import {
  loadWeddingInvitedGuestsPage,
  removeWeddingInvitedGuest,
  saveWeddingInvitedGuest,
  saveWeddingSideInviteSettings,
} from './actions'
import { useSetCreationToolBackHandler } from '@/components/navigation/creation-tool-shell-back'

const AUTO_SAVE_DEBOUNCE_MS = 800
type GuestSide = 'groom_home' | 'bride_home'

type GuestRow = {
  clientKey: string
  id: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  personalInvite: string
  status: WeddingInvitedGuestStatus
  guestCount: string
  wishMessage: string
  notes: string
  isNew?: boolean
}

type SideSettings = WeddingSideInviteSettings

const STATUS_OPTIONS: { value: WeddingInvitedGuestStatus; label: string }[] = [
  { value: 'pending', label: 'Chưa PH' },
  { value: 'attending', label: 'Có đi' },
  { value: 'declined', label: 'Không đi' },
]

const cellInputClass =
  'h-8 min-w-0 rounded-none border-0 bg-transparent px-2 py-1 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm'
const cellSelectClass =
  'h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-1 py-1 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm'

function guestToRow(g: WeddingInvitedGuest): GuestRow {
  return {
    clientKey: g.id,
    id: g.id,
    guestName: g.guestName,
    inviteVenue: g.inviteVenue,
    personalInvite: g.personalInvite,
    status: g.status,
    guestCount: String(g.guestCount),
    wishMessage: g.wishMessage,
    notes: g.notes,
  }
}

function emptyRow(side: GuestSide, defaultPersonalInvite = ''): GuestRow {
  return {
    clientKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id: '',
    guestName: '',
    inviteVenue: side,
    personalInvite: defaultPersonalInvite,
    status: 'pending',
    guestCount: '1',
    wishMessage: '',
    notes: '',
    isNew: true,
  }
}

function rowKey(row: GuestRow) {
  return row.clientKey
}

function serializeRow(row: GuestRow, fixedSide: GuestSide): string {
  return JSON.stringify({
    guestName: row.guestName,
    inviteVenue: fixedSide,
    personalInvite: row.personalInvite,
    status: row.status,
    guestCount: row.guestCount,
    wishMessage: row.wishMessage,
    notes: row.notes,
  })
}

function serializeSideSettings(settings: SideSettings): string {
  return serializeWeddingSideInviteSettings(settings)
}

function sideSettingsFromCard(card: WeddingCard): SideSettings {
  return weddingSideInviteSettingsFromCard(card)
}

function rowBelongsToSide(row: GuestRow, side: GuestSide): boolean {
  if (side === 'bride_home') return row.inviteVenue === 'bride_home'
  return row.inviteVenue !== 'bride_home'
}

function statsForRows(rows: GuestRow[]) {
  const attending = rows.filter((r) => r.status === 'attending').length
  const declined = rows.filter((r) => r.status === 'declined').length
  const pending = rows.filter((r) => r.status === 'pending').length
  const totalGuests = rows.reduce((sum, r) => sum + (Number(r.guestCount) || 0), 0)
  return { attending, declined, pending, totalGuests, total: rows.length }
}

export default function WeddingInvitedGuestsClientPage({ cardId }: { cardId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState<WeddingCard | null>(null)
  const [rows, setRows] = useState<GuestRow[]>([])
  const [sideSettings, setSideSettings] = useState<SideSettings>(EMPTY_WEDDING_SIDE_INVITE_SETTINGS)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savingSideSettings, setSavingSideSettings] = useState(false)
  const [origin, setOrigin] = useState('')
  const savedSnapshotsRef = useRef<Map<string, string>>(new Map())
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const sideSettingsSnapshotRef = useRef('')
  const sideSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowsRef = useRef<GuestRow[]>([])
  const cardRef = useRef<WeddingCard | null>(null)
  const sideSettingsRef = useRef<SideSettings>(sideSettings)
  cardRef.current = card
  rowsRef.current = rows
  sideSettingsRef.current = sideSettings

  const backToEditor = useCallback(() => {
    router.push(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(cardId)}`)
  }, [cardId, router])

  useSetCreationToolBackHandler(backToEditor)

  const syncSavedSnapshots = useCallback((guests: GuestRow[]) => {
    savedSnapshotsRef.current.clear()
    guests.forEach((row) => {
      if (!row.guestName.trim()) return
      const side: GuestSide = row.inviteVenue === 'bride_home' ? 'bride_home' : 'groom_home'
      savedSnapshotsRef.current.set(rowKey(row), serializeRow(row, side))
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await loadWeddingInvitedGuestsPage(cardId)
    setLoading(false)
    if ('error' in result && result.error) {
      toast({ title: 'Không tải được danh sách', description: result.error, variant: 'destructive' })
      return
    }
    if ('card' in result && result.card) {
      setCard(result.card)
      const settings = sideSettingsFromCard(result.card)
      setSideSettings(settings)
      sideSettingsSnapshotRef.current = serializeSideSettings(settings)
      const nextRows = result.guests.map(guestToRow)
      setRows(nextRows)
      syncSavedSnapshots(nextRows)
    }
  }, [cardId, syncSavedSnapshots, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams(window.location.search)
    const side = params.get('side')
    if (side === 'groom') {
      document.getElementById('nha-trai')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (side === 'bride') {
      document.getElementById('nha-gai')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  const publishUrl = useMemo(() => {
    if (!card?.isPublished || !card.slug || !origin) return ''
    return `${origin}/thiep-moi-cuoi/${card.slug}`
  }, [card?.isPublished, card?.slug, origin])

  const groomRows = useMemo(() => rows.filter((row) => rowBelongsToSide(row, 'groom_home')), [rows])
  const brideRows = useMemo(() => rows.filter((row) => rowBelongsToSide(row, 'bride_home')), [rows])
  const groomStats = useMemo(() => statsForRows(groomRows), [groomRows])
  const brideStats = useMemo(() => statsForRows(brideRows), [brideRows])

  const updateRowByKey = (clientKey: string, side: GuestSide, patch: Partial<GuestRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.clientKey === clientKey ? { ...row, ...patch, inviteVenue: side } : row,
      ),
    )
  }

  const addRow = (side: GuestSide) => {
    const sideKey = side === 'groom_home' ? 'groom' : 'bride'
    const defaultPersonal = pickSideInviteSettings(sideSettingsRef.current, sideKey).defaultPersonalMessage
    setRows((prev) => [...prev, emptyRow(side, defaultPersonal)])
  }

  const persistSideSettings = useCallback(async () => {
    const currentCard = cardRef.current
    const settings = sideSettingsRef.current
    if (!currentCard) return
    const snap = serializeSideSettings(settings)
    if (sideSettingsSnapshotRef.current === snap) return
    setSavingSideSettings(true)
    const formData = new FormData()
    formData.append('cardId', currentCard.id)
    appendWeddingSideInviteSettingsToFormData(formData, settings)
    const result = await saveWeddingSideInviteSettings(formData)
    setSavingSideSettings(false)
    if ('error' in result && result.error) {
      toast({ title: 'Lưu cài đặt thất bại', description: result.error, variant: 'destructive' })
      return
    }
    if ('card' in result && result.card) {
      setCard(result.card)
      sideSettingsSnapshotRef.current = snap
    }
  }, [toast])

  useEffect(() => {
    if (!card || loading) return
    const snap = serializeSideSettings(sideSettings)
    if (sideSettingsSnapshotRef.current === snap) return
    if (sideSettingsTimerRef.current) clearTimeout(sideSettingsTimerRef.current)
    sideSettingsTimerRef.current = setTimeout(() => {
      void persistSideSettings()
    }, AUTO_SAVE_DEBOUNCE_MS)
  }, [card, loading, persistSideSettings, sideSettings])

  const persistRowByKey = useCallback(
    async (clientKey: string, fixedSide: GuestSide) => {
      const currentCard = cardRef.current
      const index = rowsRef.current.findIndex((row) => row.clientKey === clientKey)
      const row = index >= 0 ? rowsRef.current[index] : null
      if (!currentCard || !row?.guestName.trim()) return
      const key = rowKey(row)
      setSavingKey(key)
      const formData = new FormData()
      formData.append('cardId', currentCard.id)
      if (row.id && !row.isNew) formData.append('guestId', row.id)
      formData.append('guestName', row.guestName)
      formData.append('inviteVenue', fixedSide)
      formData.append('personalInvite', row.personalInvite)
      formData.append('status', row.status)
      formData.append('guestCount', row.guestCount)
      formData.append('wishMessage', row.wishMessage)
      formData.append('notes', row.notes)
      const result = await saveWeddingInvitedGuest(formData)
      setSavingKey(null)
      if ('error' in result && result.error) {
        toast({ title: 'Lưu thất bại', description: result.error, variant: 'destructive' })
        return
      }
      if ('guest' in result && result.guest) {
        const updated = guestToRow(result.guest)
        setRows((prev) => {
          const current = prev[index]
          if (!current || current.clientKey !== row.clientKey) return prev
          const merged: GuestRow = {
            ...current,
            id: updated.id,
            inviteVenue: fixedSide,
            isNew: undefined,
          }
          savedSnapshotsRef.current.set(key, serializeRow(merged, fixedSide))
          return prev.map((r, i) => (i === index ? merged : r))
        })
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!card || loading) return
    rows.forEach((row) => {
      const key = rowKey(row)
      if (!row.guestName.trim()) return
      const fixedSide: GuestSide = row.inviteVenue === 'bride_home' ? 'bride_home' : 'groom_home'
      const snap = serializeRow(row, fixedSide)
      if (savedSnapshotsRef.current.get(key) === snap) return
      const prevTimer = saveTimersRef.current.get(key)
      if (prevTimer) clearTimeout(prevTimer)
      saveTimersRef.current.set(
        key,
        setTimeout(() => {
          void persistRowByKey(key, fixedSide)
        }, AUTO_SAVE_DEBOUNCE_MS),
      )
    })
  }, [card, loading, persistRowByKey, rows])

  useEffect(() => {
    const timers = saveTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      if (sideSettingsTimerRef.current) clearTimeout(sideSettingsTimerRef.current)
    }
  }, [])

  const deleteRow = async (row: GuestRow) => {
    if (!card) return
    const index = rows.findIndex((item) => item.clientKey === row.clientKey)
    if (index < 0) return
    if (row.isNew || !row.id) {
      setRows((prev) => prev.filter((item) => item.clientKey !== row.clientKey))
      return
    }
    if (!window.confirm(`Xóa khách «${row.guestName}» khỏi danh sách?`)) return
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('guestId', row.id)
    const result = await removeWeddingInvitedGuest(formData)
    if ('error' in result && result.error) {
      toast({ title: 'Xóa thất bại', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Đã xóa khách mời' })
    await load()
  }

  const copyLink = async (row: GuestRow, fixedSide: GuestSide) => {
    if (!publishUrl) {
      toast({ title: 'Chưa xuất bản thiệp', description: 'Xuất bản link thiệp trước khi copy link khách.', variant: 'destructive' })
      return
    }
    const link = buildWeddingPersonalInviteUrl(publishUrl, {
      guestName: row.guestName,
      inviteVenue: fixedSide,
    })
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Đã copy link thiệp cá nhân' })
    } catch {
      toast({ title: 'Không copy được', description: link, variant: 'destructive' })
    }
  }

  const thClass =
    'whitespace-nowrap border border-border bg-muted/80 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs'
  const tdClass = 'border border-border p-0 align-middle'

  const renderGuestTable = (sideRows: GuestRow[], side: GuestSide, sideLabel: string) => (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Đang tải…
        </div>
      ) : sideRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Chưa có khách mời {sideLabel.toLowerCase()}. Bấm «Thêm khách» để thêm dòng mới.
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border shadow-sm">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[2.5rem]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[3.5rem]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[4.5rem]" />
              <col className="w-[2.5rem]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={cn(thClass, 'text-center')}>#</th>
                <th className={thClass}>Tên khách mời *</th>
                <th className={thClass}>Trạng thái</th>
                <th className={cn(thClass, 'text-center')}>SL</th>
                <th className={thClass}>Lời mời riêng</th>
                <th className={thClass}>Lời chúc</th>
                <th className={thClass}>Ghi chú</th>
                <th className={cn(thClass, 'text-center')}>Link</th>
                <th className={cn(thClass, 'text-center')} />
              </tr>
            </thead>
            <tbody>
              {sideRows.map((row, index) => {
                const key = rowKey(row)
                const personalUrl =
                  publishUrl && row.guestName.trim()
                    ? buildWeddingPersonalInviteUrl(publishUrl, {
                        guestName: row.guestName,
                        inviteVenue: side,
                      })
                    : ''
                const saving = savingKey === key
                const statusClass =
                  row.status === 'attending'
                    ? 'bg-emerald-50/80'
                    : row.status === 'declined'
                      ? 'bg-rose-50/60'
                      : index % 2 === 1
                        ? 'bg-muted/20'
                        : 'bg-background'

                return (
                  <tr key={key} className={cn(statusClass, row.isNew && 'bg-amber-50/50')}>
                    <td className={cn(tdClass, 'relative bg-muted/30 text-center text-xs text-muted-foreground')}>
                      <span className={cn(saving && 'opacity-40')}>{index + 1}</span>
                      {saving ? (
                        <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin opacity-80" />
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      <Input
                        value={row.guestName}
                        onChange={(e) => updateRowByKey(key, side, { guestName: e.target.value })}
                        placeholder="Anh Chị Minh"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        value={row.status}
                        onChange={(e) =>
                          updateRowByKey(key, side, { status: e.target.value as WeddingInvitedGuestStatus })
                        }
                        className={cellSelectClass}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={row.guestCount}
                        onChange={(e) => updateRowByKey(key, side, { guestCount: e.target.value })}
                        className={cn(cellInputClass, 'text-center')}
                      />
                    </td>
                    <td className={tdClass}>
                      <Input
                        value={row.personalInvite}
                        onChange={(e) => updateRowByKey(key, side, { personalInvite: e.target.value })}
                        placeholder="Lời mời…"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <Input
                        value={row.wishMessage}
                        onChange={(e) => updateRowByKey(key, side, { wishMessage: e.target.value })}
                        placeholder="Lời chúc…"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRowByKey(key, side, { notes: e.target.value })}
                        placeholder="Ghi chú…"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={cn(tdClass, 'px-1')}>
                      {personalUrl ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => copyLink(row, side)}
                            title="Copy link thiệp"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Mở thiệp">
                            <a href={personalUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <span className="block px-2 text-center text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(tdClass, 'px-1')}>
                      <div className="flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteRow(row)}
                          title="Xóa dòng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addRow(side)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm khách
          </Button>
        </div>
      ) : null}
    </>
  )

  const renderSideStats = (stats: ReturnType<typeof statsForRows>) => (
    <div className="grid gap-2 text-sm sm:grid-cols-4">
      <div className="rounded-xl border p-3">
        <p className="text-muted-foreground">Tổng khách</p>
        <p className="text-2xl font-semibold">{stats.total}</p>
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-muted-foreground">Có đi</p>
        <p className="text-2xl font-semibold text-emerald-700">{stats.attending}</p>
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-muted-foreground">Không đi</p>
        <p className="text-2xl font-semibold text-rose-700">{stats.declined}</p>
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-muted-foreground">Tổng người</p>
        <p className="text-2xl font-semibold">{stats.totalGuests}</p>
      </div>
    </div>
  )

  return (
    <>
      <Toaster />
      <div className="w-full space-y-4 pb-2 sm:pb-4">
        {!publishUrl ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Chưa xuất bản link thiệp — vẫn thêm/sửa được; link cá nhân chỉ dùng sau khi xuất bản.
          </p>
        ) : (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            Gửi link thiệp cá nhân qua <span className="font-medium">Facebook hoặc Zalo</span>: bấm Copy ở cột Link
            trong bảng rồi dán vào tin nhắn. Khách nhà trai/gái nhận đúng địa chỉ và giờ tiệc của bên tương ứng.
          </p>
        )}

        <Card id="nha-trai" className="scroll-mt-24 border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Danh sách khách mời nhà trai
            </CardTitle>
            <CardDescription>
              Cài đặt thiệp cá nhân nhà trai (ngày, giờ, địa chỉ, lời mời, lịch trình, dress code, liên hệ, ảnh bìa…).
              Khách trong bảng luôn là mời nhà trai.
              {card ? (
                <>
                  {' '}
                  · Nhà {card.groomName || '…'}
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeddingSideInviteSettingsPanel
              side="groom"
              card={card}
              settings={sideSettings}
              saving={savingSideSettings}
              onChange={setSideSettings}
            />
            {renderSideStats(groomStats)}
            {renderGuestTable(groomRows, 'groom_home', 'nhà trai')}
          </CardContent>
        </Card>

        <Card id="nha-gai" className="scroll-mt-24 border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Danh sách khách mời nhà gái
            </CardTitle>
            <CardDescription>
              Cài đặt thiệp cá nhân nhà gái (ngày, giờ, địa chỉ, lời mời, lịch trình, dress code, liên hệ, ảnh bìa…).
              Khách trong bảng luôn là mời nhà gái.
              {card ? (
                <>
                  {' '}
                  · Nhà {card.brideName || '…'}
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeddingSideInviteSettingsPanel
              side="bride"
              card={card}
              settings={sideSettings}
              saving={savingSideSettings}
              onChange={setSideSettings}
            />
            {renderSideStats(brideStats)}
            {renderGuestTable(brideRows, 'bride_home', 'nhà gái')}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
