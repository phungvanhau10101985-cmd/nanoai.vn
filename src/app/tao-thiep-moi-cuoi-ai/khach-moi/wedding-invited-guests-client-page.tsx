'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, ExternalLink, FileUp, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { WeddingCard, WeddingInvitedGuest, WeddingInvitedGuestStatus, WeddingGuestStatusConfirmedBy } from '@/lib/db/wedding-cards-pg'
import {
  buildGuestDisplayName,
  buildPersonalWeddingInviteFromSideContext,
  WEDDING_GUEST_HONORIFIC_SUGGESTIONS,
} from '@/lib/wedding/build-personal-wedding-invite'
import { buildWeddingPersonalInviteUrl } from '@/lib/wedding/wedding-guest-invite-link'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import {
  appendWeddingSideInviteSettingsToFormData,
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  serializeWeddingSideInviteSettings,
  weddingSideInviteSettingsFromCard,
  type WeddingSideInviteSettings,
} from '@/lib/wedding/wedding-side-invite-settings'
import { WeddingSideInviteSettingsPanel } from './wedding-side-invite-settings-panel'
import {
  confirmWeddingInvitedGuestStatus,
  downloadWeddingGuestImportTemplate,
  importWeddingInvitedGuests,
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
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  personalInvite: string
  status: WeddingInvitedGuestStatus
  statusConfirmedBy: WeddingGuestStatusConfirmedBy
  statusDraft: WeddingInvitedGuestStatus | null
  guestCount: string
  adultCount: number
  childCount: number
  wishMessage: string
  notes: string
  isNew?: boolean
}

type SideSettings = WeddingSideInviteSettings

const STATUS_OPTIONS: { value: WeddingInvitedGuestStatus; label: string }[] = [
  { value: 'pending', label: 'Chưa' },
  { value: 'attending', label: 'Có đi' },
  { value: 'declined', label: 'Không đi' },
]

const STATUS_PILL: Record<WeddingInvitedGuestStatus, string> = {
  pending: 'bg-amber-100 text-amber-950',
  attending: 'bg-emerald-100 text-emerald-950',
  declined: 'bg-rose-100 text-rose-950',
}

const SIDE_LOOK = {
  groom: {
    side: 'groom_home' as const,
    panel: 'groom' as const,
    anchor: 'nha-trai',
    kicker: 'Nhà trai',
    title: 'Khách mời nhà trai',
    who: 'Chú rể',
    hint: 'Thiệp cá nhân nhà trai: ngày, giờ, địa chỉ, lịch trình. Lời mời tự sinh theo xưng hô và tên khách.',
    card: 'border-sky-200 bg-white shadow-md shadow-sky-100/80 ring-1 ring-sky-100',
    header: 'bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-700 text-white',
    muted: 'text-sky-100',
    chip: 'bg-white/15 text-white',
    stat: 'border-sky-100 bg-sky-50',
    statLabel: 'text-sky-800/75',
    statValue: 'text-sky-950',
    table: 'border-sky-200',
    th: 'border-sky-800 bg-sky-800 text-sky-50',
    td: 'border-sky-100',
    index: 'bg-sky-100 text-sky-900',
    zebra: 'bg-sky-50/70',
    base: 'bg-white',
    empty: 'border-sky-200 bg-sky-50/60 text-sky-950',
    add: 'bg-sky-800 text-white shadow-sm hover:bg-sky-900',
    jump: 'border-sky-300 bg-gradient-to-br from-sky-800 to-cyan-600 text-white shadow-sm',
  },
  bride: {
    side: 'bride_home' as const,
    panel: 'bride' as const,
    anchor: 'nha-gai',
    kicker: 'Nhà gái',
    title: 'Khách mời nhà gái',
    who: 'Cô dâu',
    hint: 'Thiệp cá nhân nhà gái: ngày, giờ, địa chỉ, lịch trình. Lời mời tự sinh theo xưng hô và tên khách.',
    card: 'border-rose-200 bg-white shadow-md shadow-rose-100/80 ring-1 ring-rose-100',
    header: 'bg-gradient-to-r from-rose-900 via-rose-800 to-rose-600 text-white',
    muted: 'text-rose-100',
    chip: 'bg-white/15 text-white',
    stat: 'border-rose-100 bg-rose-50',
    statLabel: 'text-rose-800/75',
    statValue: 'text-rose-950',
    table: 'border-rose-200',
    th: 'border-rose-800 bg-rose-800 text-rose-50',
    td: 'border-rose-100',
    index: 'bg-rose-100 text-rose-900',
    zebra: 'bg-rose-50/70',
    base: 'bg-white',
    empty: 'border-rose-200 bg-rose-50/60 text-rose-950',
    add: 'bg-rose-800 text-white shadow-sm hover:bg-rose-900',
    jump: 'border-rose-300 bg-gradient-to-br from-rose-800 to-rose-500 text-white shadow-sm',
  },
} as const

type SideLook = (typeof SIDE_LOOK)[keyof typeof SIDE_LOOK]

const cellInputClass =
  'h-8 min-w-0 rounded-none border-0 bg-transparent px-2 py-1 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm'
const cellSelectClass =
  'h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-1 py-1 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm'
const mobileLabelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500'
const mobileInputClass = 'h-11 rounded-lg border-stone-200 bg-white text-base shadow-none'

function guestToRow(g: WeddingInvitedGuest): GuestRow {
  return {
    clientKey: g.id,
    id: g.id,
    guestHonorific: g.guestHonorific,
    guestName: g.guestName,
    inviteVenue: g.inviteVenue,
    personalInvite: g.personalInvite,
    status: g.status,
    statusConfirmedBy: g.statusConfirmedBy,
    statusDraft: null,
    guestCount: String(g.guestCount),
    adultCount: g.adultCount,
    childCount: g.childCount,
    wishMessage: g.wishMessage,
    notes: g.notes,
  }
}

function buildInviteForRow(
  row: Pick<GuestRow, 'guestHonorific' | 'guestName'>,
  side: GuestSide,
  card: WeddingCard,
  sideSettings: SideSettings,
): string {
  if (!row.guestName.trim()) return ''
  const inviteSide = side === 'groom_home' ? 'groom' : 'bride'
  return buildPersonalWeddingInviteFromSideContext({
    side: inviteSide,
    card,
    sideSettings,
    guestHonorific: row.guestHonorific,
    guestName: row.guestName,
  })
}

function emptyRow(side: GuestSide): GuestRow {
  return {
    clientKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id: '',
    guestHonorific: '',
    guestName: '',
    inviteVenue: side,
    personalInvite: '',
    status: 'pending',
    statusConfirmedBy: '',
    statusDraft: null,
    guestCount: '1',
    adultCount: 0,
    childCount: 0,
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
    guestHonorific: row.guestHonorific,
    guestName: row.guestName,
    inviteVenue: fixedSide,
    personalInvite: row.personalInvite,
    status: row.status,
    statusConfirmedBy: row.statusConfirmedBy,
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
  const [focusSide, setFocusSide] = useState<'groom' | 'bride' | null>(null)
  const [importing, setImporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GuestRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const importFileRef = useRef<HTMLInputElement | null>(null)
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
    if (side === 'groom' || side === 'bride') {
      setFocusSide(side)
      document.getElementById(side === 'groom' ? 'nha-trai' : 'nha-gai')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      prev.map((row) => {
        if (row.clientKey !== clientKey) return row
        const next = { ...row, ...patch, inviteVenue: side }
        const currentCard = cardRef.current
        if (currentCard && (patch.guestHonorific !== undefined || patch.guestName !== undefined)) {
          next.personalInvite = buildInviteForRow(next, side, currentCard, sideSettingsRef.current)
        }
        return next
      }),
    )
  }

  const addRow = (side: GuestSide) => {
    setRows((prev) => [...prev, emptyRow(side)])
  }

  useEffect(() => {
    if (!card || loading) return
    setRows((prev) =>
      prev.map((row) => {
        if (!row.guestName.trim()) return row
        const side: GuestSide = row.inviteVenue === 'bride_home' ? 'bride_home' : 'groom_home'
        const personalInvite = buildInviteForRow(row, side, card, sideSettings)
        if (personalInvite === row.personalInvite) return row
        return { ...row, personalInvite }
      }),
    )
  }, [card, loading, sideSettings])

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
      formData.append('guestHonorific', row.guestHonorific)
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
            status: updated.statusConfirmedBy === 'guest' ? updated.status : current.status,
            statusConfirmedBy: updated.statusConfirmedBy,
            statusDraft: updated.statusConfirmedBy === 'guest' ? null : current.statusDraft,
            guestCount: updated.statusConfirmedBy === 'guest' ? updated.guestCount : current.guestCount,
            adultCount: updated.adultCount,
            childCount: updated.childCount,
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

  const askDeleteRow = (row: GuestRow) => {
    if (!card) return
    setDeleteTarget(row)
  }

  const confirmDeleteRow = async () => {
    const row = deleteTarget
    if (!card || !row || deleting) return
    if (row.isNew || !row.id) {
      setRows((prev) => prev.filter((item) => item.clientKey !== row.clientKey))
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('guestId', row.id)
    const result = await removeWeddingInvitedGuest(formData)
    setDeleting(false)
    if ('error' in result && result.error) {
      toast({ title: 'Xóa thất bại', description: result.error, variant: 'destructive' })
      return
    }
    setDeleteTarget(null)
    toast({ title: 'Đã xóa khách mời' })
    await load()
  }

  const downloadGuestTemplate = async () => {
    const result = await downloadWeddingGuestImportTemplate()
    if ('error' in result) {
      toast({ title: 'Không tải được file mẫu', description: result.error, variant: 'destructive' })
      return
    }
    const binary = atob(result.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mau-khach-moi-thiep-cuoi.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importGuestFile = async (file: File | null) => {
    if (!file || !card || importing) return
    setImporting(true)
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('file', file)
    const result = await importWeddingInvitedGuests(formData)
    setImporting(false)
    if (importFileRef.current) importFileRef.current.value = ''
    if ('error' in result && result.error) {
      toast({ title: 'Import thất bại', description: result.error, variant: 'destructive' })
      return
    }
    if (!('created' in result)) return
    const skippedNote = result.skipped ? ` Bỏ qua ${result.skipped} dòng.` : ''
    const detail = result.errors.length ? ` ${result.errors[0]}` : ''
    toast({
      title: `Đã thêm ${result.created} khách`,
      description: `${skippedNote}${detail}`.trim() || 'Khách đã vào đúng nhà trai / nhà gái theo cột Bên.',
    })
    await load()
  }

  const confirmStatus = async (row: GuestRow, fixedSide: GuestSide) => {
    if (!card) return
    const next = row.statusDraft
    if (!next || next === row.status) return
    if (row.statusConfirmedBy === 'guest') return
    if (!row.id || row.isNew) {
      toast({
        title: 'Chưa lưu khách',
        description: 'Nhập tên và đợi dòng được lưu, rồi bấm Xác nhận.',
        variant: 'destructive',
      })
      return
    }
    const key = rowKey(row)
    setSavingKey(key)
    const formData = new FormData()
    formData.append('cardId', card.id)
    formData.append('guestId', row.id)
    formData.append('status', next)
    const result = await confirmWeddingInvitedGuestStatus(formData)
    setSavingKey(null)
    if ('error' in result && result.error) {
      toast({ title: 'Không xác nhận được', description: result.error, variant: 'destructive' })
      if (result.error.includes('đã tự xác nhận')) await load()
      return
    }
    if ('guest' in result && result.guest) {
      const saved = guestToRow(result.guest)
      setRows((prev) =>
        prev.map((item) =>
          item.clientKey === row.clientKey
            ? { ...item, status: saved.status, statusConfirmedBy: saved.statusConfirmedBy, statusDraft: null, inviteVenue: fixedSide }
            : item,
        ),
      )
      const current = rowsRef.current.find((item) => item.clientKey === row.clientKey)
      if (current) {
        savedSnapshotsRef.current.set(
          key,
          serializeRow(
            { ...current, status: saved.status, statusConfirmedBy: saved.statusConfirmedBy, statusDraft: null, inviteVenue: fixedSide },
            fixedSide,
          ),
        )
      }
      toast({
        title: next === 'pending' ? 'Đã bỏ trạng thái' : 'Đã ghi trạng thái',
        description: next === 'pending' ? 'Khách vẫn chưa tự xác nhận.' : 'Đây là ghi giúp, chưa phải khách tự xác nhận.',
      })
    }
  }

  const copyLink = async (row: GuestRow, fixedSide: GuestSide) => {
    if (!publishUrl) {
      toast({ title: 'Chưa xuất bản thiệp', description: 'Xuất bản link thiệp trước khi copy link khách.', variant: 'destructive' })
      return
    }
    const link = buildWeddingPersonalInviteUrl(publishUrl, {
      guestName: buildGuestDisplayName(row.guestHonorific, row.guestName),
      inviteVenue: fixedSide,
    })
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Đã copy link thiệp cá nhân' })
    } catch {
      toast({ title: 'Không copy được', description: link, variant: 'destructive' })
    }
  }

  const thClass = 'whitespace-nowrap px-2 py-2.5 text-left text-[11px] font-semibold tracking-wide sm:text-xs'
  const tdClass = 'p-0 align-middle'

  const renderGuestTable = (sideRows: GuestRow[], look: SideLook) => {
    const side = look.side
    return (
    <>
      {loading ? (
        <div className={cn('flex items-center justify-center rounded-xl border py-16 text-sm', look.empty)}>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Đang tải…
        </div>
      ) : sideRows.length === 0 ? (
        <div className={cn('rounded-xl border border-dashed p-8 text-center text-sm', look.empty)}>
          Chưa có khách {look.kicker.toLowerCase()}. Bấm «Thêm khách» hoặc Import Excel phía trên.
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {sideRows.map((row, index) => {
            const key = rowKey(row)
            const personalUrl =
              publishUrl && row.guestName.trim()
                ? buildWeddingPersonalInviteUrl(publishUrl, {
                    guestName: buildGuestDisplayName(row.guestHonorific, row.guestName),
                    inviteVenue: side,
                  })
                : ''
            const saving = savingKey === key
            const displayName = [row.guestHonorific.trim(), row.guestName.trim()].filter(Boolean).join(' ') || 'Khách mới'
            const adultCount = row.adultCount + row.childCount > 0 ? row.adultCount : Number(row.guestCount) || 0

            return (
              <article
                key={key}
                className={cn(
                  'overflow-hidden rounded-2xl border shadow-sm',
                  look.table,
                  row.isNew ? 'bg-amber-50' : index % 2 === 1 ? look.zebra : 'bg-white',
                )}
              >
                <div className={cn('flex items-center gap-2 px-3 py-2', look.index)}>
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/80 text-xs font-semibold tabular-nums">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => askDeleteRow(row)}
                    title="Xóa khách"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0">
                      <span className={mobileLabelClass}>Xưng hô</span>
                      <Input
                        value={row.guestHonorific}
                        onChange={(e) => updateRowByKey(key, side, { guestHonorific: e.target.value })}
                        placeholder="Bạn, Anh…"
                        list="wedding-guest-honorific-suggestions"
                        className={mobileInputClass}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className={mobileLabelClass}>Tên</span>
                      <Input
                        value={row.guestName}
                        onChange={(e) => updateRowByKey(key, side, { guestName: e.target.value })}
                        placeholder="Tên khách"
                        className={mobileInputClass}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2">
                    <div className="min-w-0">
                      <p className={mobileLabelClass}>Trạng thái</p>
                      {row.statusConfirmedBy === 'guest' && row.status !== 'pending' ? (
                        <div>
                          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-sm font-medium', STATUS_PILL[row.status])}>
                            {STATUS_OPTIONS.find((opt) => opt.value === row.status)?.label}
                          </span>
                          <p className="mt-1 text-xs font-semibold text-emerald-800">Khách xác nhận</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={row.statusDraft ?? row.status}
                            onChange={(e) => {
                              const next = e.target.value as WeddingInvitedGuestStatus
                              updateRowByKey(key, side, { statusDraft: next === row.status ? null : next })
                            }}
                            className={cn(
                              'h-11 w-full rounded-full border border-stone-200 px-3 text-center text-sm font-medium',
                              STATUS_PILL[row.statusDraft ?? row.status],
                            )}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {row.statusDraft && row.statusDraft !== row.status ? (
                            <Button type="button" className="h-11 w-full" disabled={saving} onClick={() => void confirmStatus(row, side)}>
                              Xác nhận
                            </Button>
                          ) : row.statusConfirmedBy === 'host' && row.status !== 'pending' ? (
                            <p className="text-xs text-muted-foreground">Nhà ghi giúp</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={mobileLabelClass}>Số người</p>
                      {row.statusConfirmedBy === 'guest' ? (
                        <div className="flex h-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-2 text-center text-xs leading-tight text-stone-800">
                          {row.status === 'attending' ? (
                            <span>
                              {adultCount} lớn
                              <br />
                              {row.childCount} trẻ
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={40}
                          inputMode="numeric"
                          value={row.guestCount}
                          onChange={(e) => updateRowByKey(key, side, { guestCount: e.target.value })}
                          className={cn(mobileInputClass, 'text-center')}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={mobileLabelClass}>Lời mời</p>
                    <p className="break-words rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-700">
                      {row.personalInvite || '—'}
                    </p>
                  </div>
                  <label className="block">
                    <span className={mobileLabelClass}>Lời chúc</span>
                    <Input
                      value={row.wishMessage}
                      onChange={(e) => updateRowByKey(key, side, { wishMessage: e.target.value })}
                      placeholder="Lời chúc…"
                      className={mobileInputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={mobileLabelClass}>Ghi chú</span>
                    <Input
                      value={row.notes}
                      onChange={(e) => updateRowByKey(key, side, { notes: e.target.value })}
                      placeholder="Ghi chú…"
                      className={mobileInputClass}
                    />
                  </label>
                  {personalUrl ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="h-11" onClick={() => copyLink(row, side)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy link
                      </Button>
                      <Button asChild variant="outline" className="h-11">
                        <a href={personalUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Mở thiệp
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
        <div className={cn('hidden w-full overflow-x-auto rounded-xl border shadow-sm md:block', look.table)}>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[2.5rem]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[3.5rem]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[4.5rem]" />
              <col className="w-[2.5rem]" />
            </colgroup>
            <thead>
              <tr>
                <th className={cn(thClass, look.th, 'text-center')}>#</th>
                <th className={cn(thClass, look.th)}>Xưng hô</th>
                <th className={cn(thClass, look.th)}>Tên</th>
                <th className={cn(thClass, look.th)}>Trạng thái</th>
                <th className={cn(thClass, look.th, 'text-center')}>SL</th>
                <th className={cn(thClass, look.th)}>Lời mời</th>
                <th className={cn(thClass, look.th)}>Lời chúc</th>
                <th className={cn(thClass, look.th)}>Ghi chú</th>
                <th className={cn(thClass, look.th, 'text-center')}>Link</th>
                <th className={cn(thClass, look.th, 'text-center')} />
              </tr>
            </thead>
            <tbody>
              {sideRows.map((row, index) => {
                const key = rowKey(row)
                const personalUrl =
                  publishUrl && row.guestName.trim()
                    ? buildWeddingPersonalInviteUrl(publishUrl, {
                        guestName: buildGuestDisplayName(row.guestHonorific, row.guestName),
                        inviteVenue: side,
                      })
                    : ''
                const saving = savingKey === key
                const rowTone = row.isNew ? 'bg-amber-50' : index % 2 === 1 ? look.zebra : look.base

                return (
                  <tr key={key} className={rowTone}>
                    <td className={cn(tdClass, look.td, look.index, 'relative border text-center text-xs font-medium')}>
                      <span className={cn(saving && 'opacity-40')}>{index + 1}</span>
                      {saving ? (
                        <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin opacity-80" />
                      ) : null}
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      <Input
                        value={row.guestHonorific}
                        onChange={(e) => updateRowByKey(key, side, { guestHonorific: e.target.value })}
                        placeholder="Chú, Anh, Bạn, Ba…"
                        list="wedding-guest-honorific-suggestions"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      <Input
                        value={row.guestName}
                        onChange={(e) => updateRowByKey(key, side, { guestName: e.target.value })}
                        placeholder="Công"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      {row.statusConfirmedBy === 'guest' && row.status !== 'pending' ? (
                        <div className="px-1.5 py-1.5">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_PILL[row.status])}>
                            {STATUS_OPTIONS.find((opt) => opt.value === row.status)?.label}
                          </span>
                          <p className="mt-1 text-[10px] font-semibold leading-tight text-emerald-800">Khách xác nhận</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 px-1 py-1">
                          <select
                            value={row.statusDraft ?? row.status}
                            onChange={(e) => {
                              const next = e.target.value as WeddingInvitedGuestStatus
                              updateRowByKey(key, side, { statusDraft: next === row.status ? null : next })
                            }}
                            className={cn(
                              cellSelectClass,
                              'h-7 rounded-full px-2 text-center text-xs font-medium',
                              STATUS_PILL[row.statusDraft ?? row.status],
                            )}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {row.statusDraft && row.statusDraft !== row.status ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              disabled={saving}
                              onClick={() => void confirmStatus(row, side)}
                            >
                              Xác nhận
                            </Button>
                          ) : row.statusConfirmedBy === 'host' && row.status !== 'pending' ? (
                            <p className="px-0.5 text-[10px] leading-tight text-muted-foreground">Nhà ghi giúp</p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      {row.statusConfirmedBy === 'guest' ? (
                        <div className="px-1 py-1 text-center text-[11px] leading-tight text-stone-800">
                          {row.status === 'attending' ? (
                            <>
                              <div>{(row.adultCount + row.childCount > 0 ? row.adultCount : Number(row.guestCount) || 0)} lớn</div>
                              <div>{row.childCount} trẻ</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={40}
                          value={row.guestCount}
                          onChange={(e) => updateRowByKey(key, side, { guestCount: e.target.value })}
                          className={cn(cellInputClass, 'text-center')}
                        />
                      )}
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      <p
                        className="px-2 py-1.5 text-xs leading-snug text-muted-foreground"
                        title={row.personalInvite}
                      >
                        {row.personalInvite || '—'}
                      </p>
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      <Input
                        value={row.wishMessage}
                        onChange={(e) => updateRowByKey(key, side, { wishMessage: e.target.value })}
                        placeholder="Lời chúc…"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={cn(tdClass, 'border', look.td)}>
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRowByKey(key, side, { notes: e.target.value })}
                        placeholder="Ghi chú…"
                        className={cellInputClass}
                      />
                    </td>
                    <td className={cn(tdClass, 'border px-1', look.td)}>
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
                    <td className={cn(tdClass, 'border px-1', look.td)}>
                      <div className="flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => askDeleteRow(row)}
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
        </>
      )}

      {!loading ? (
        <Button type="button" size="sm" className={cn(look.add, 'h-11 w-full md:h-9 md:w-auto')} onClick={() => addRow(side)}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm khách {look.kicker.toLowerCase()}
        </Button>
      ) : null}
    </>
    )
  }

  const renderSideStats = (stats: ReturnType<typeof statsForRows>, look: SideLook) => (
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
      {(
        [
          ['Khách', stats.total, look.statValue],
          ['Có đi', stats.attending, 'text-emerald-700'],
          ['Chưa phản hồi', stats.pending, 'text-amber-800'],
          ['Không đi', stats.declined, 'text-rose-700'],
          ['Số người', stats.totalGuests, look.statValue],
        ] as const
      ).map(([label, value, valueClass]) => (
        <div key={label} className={cn('rounded-xl border px-3 py-2.5', look.stat)}>
          <p className={cn('text-xs', look.statLabel)}>{label}</p>
          <p className={cn('text-2xl font-semibold tabular-nums', valueClass)}>{value}</p>
        </div>
      ))}
    </div>
  )

  const renderSide = (
    look: SideLook,
    sideRows: GuestRow[],
    stats: ReturnType<typeof statsForRows>,
    personName: string,
  ) => {
    const focused = focusSide === (look.panel === 'groom' ? 'groom' : 'bride')
    return (
      <section
        id={look.anchor}
        className={cn(
          'scroll-mt-28 overflow-hidden rounded-2xl border',
          look.card,
          focused &&
            (look.panel === 'groom'
              ? 'ring-2 ring-sky-600 ring-offset-2'
              : 'ring-2 ring-rose-600 ring-offset-2'),
        )}
      >
        <header className={cn('flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-5', look.header)}>
          <div className="min-w-0">
            <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', look.muted)}>{look.kicker}</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
              <Users className="h-5 w-5 shrink-0" />
              {look.title}
            </h2>
            <p className={cn('mt-1 text-sm', look.muted)}>
              {look.who}: {personName || '…'}
            </p>
          </div>
          <p className={cn('rounded-full px-3 py-1 text-sm font-medium', look.chip)}>
            {stats.total} khách · {stats.totalGuests} người
          </p>
        </header>
        <div className="space-y-4 p-3 sm:p-5">
          <p className="text-sm text-muted-foreground">{look.hint}</p>
          <WeddingSideInviteSettingsPanel
            side={look.panel}
            card={card}
            settings={sideSettings}
            saving={savingSideSettings}
            onChange={setSideSettings}
          />
          {renderSideStats(stats, look)}
          {renderGuestTable(sideRows, look)}
        </div>
      </section>
    )
  }

  return (
    <>
      <Toaster />
      <datalist id="wedding-guest-honorific-suggestions">
        {WEDDING_GUEST_HONORIFIC_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <div className="w-full space-y-4 pb-2 sm:pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="#nha-trai"
            onClick={() => setFocusSide('groom')}
            className={cn('rounded-2xl border px-4 py-3 transition', SIDE_LOOK.groom.jump, focusSide === 'bride' && 'opacity-80')}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Nhà trai</p>
            <p className="mt-0.5 text-lg font-semibold">{card?.groomName || 'Khách mời nhà trai'}</p>
            <p className="text-sm text-white/85">{groomStats.total} khách · {groomStats.attending} có đi</p>
          </a>
          <a
            href="#nha-gai"
            onClick={() => setFocusSide('bride')}
            className={cn('rounded-2xl border px-4 py-3 transition', SIDE_LOOK.bride.jump, focusSide === 'groom' && 'opacity-80')}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">Nhà gái</p>
            <p className="mt-0.5 text-lg font-semibold">{card?.brideName || 'Khách mời nhà gái'}</p>
            <p className="text-sm text-white/85">{brideStats.total} khách · {brideStats.attending} có đi</p>
          </a>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Import Excel: cột <span className="font-medium text-foreground">Tên</span> và{' '}
            <span className="font-medium text-foreground">Bên</span> (Nhà trai / Nhà gái). Dòng mẫu trong file được bỏ qua.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => void downloadGuestTemplate()}>
              <Download className="mr-2 h-4 w-4" />
              Tải file mẫu
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              disabled={importing || loading || !card}
              onClick={() => importFileRef.current?.click()}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Import Excel
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                void importGuestFile(file)
              }}
            />
          </div>
        </div>

        {!publishUrl ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Chưa xuất bản link thiệp — vẫn thêm/sửa được; link cá nhân chỉ dùng sau khi xuất bản.
          </p>
        ) : (
          <p className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">
            Gửi link thiệp cá nhân qua <span className="font-medium">Facebook hoặc Zalo</span>: bấm Copy link
            rồi dán vào tin nhắn. Khách nhà trai và nhà gái nhận đúng địa chỉ, giờ tiệc của bên mình.
          </p>
        )}

        {renderSide(SIDE_LOOK.groom, groomRows, groomStats, card?.groomName ?? '')}
        {renderSide(SIDE_LOOK.bride, brideRows, brideStats, card?.brideName ?? '')}
      </div>
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!deleting) setDeleteTarget(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wedding-guest-delete-title"
            className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="wedding-guest-delete-title" className="text-base font-semibold">
              Xóa khách mời?
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Xóa «{buildGuestDisplayName(deleteTarget.guestHonorific, deleteTarget.guestName) || 'khách này'}» khỏi danh sách.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1"
                disabled={deleting}
                onClick={() => void confirmDeleteRow()}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
