'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  EMPTY_WEDDING_SIDE_INVITE_SETTINGS,
  ownSidePartyFields,
  serializeWeddingSideInviteSettings,
  weddingSideInviteSettingsFromCard,
  type WeddingSideInviteSettings,
} from '@/lib/wedding/wedding-side-invite-settings'
import { WeddingSideGuestBulkBar } from './wedding-side-guest-bulk-bar'
import { WeddingGuestPackPanel } from './wedding-guest-pack-panel'
import {
  weddingGuestRowShowsInviteLink,
  type WeddingGuestPackSide,
  type WeddingGuestSideQuotas,
} from '@/lib/wedding/wedding-guest-pack'
import {
  weddingResponseHeadcount,
  type WeddingAttendanceRsvpSource,
} from '@/lib/wedding/wedding-attendance-summary'
import { invitationEditorCopy, invitationOccasionShape } from '@/lib/wedding/invitation-occasion'
import {
  confirmWeddingInvitedGuestStatus,
  loadWeddingInvitedGuestsPage,
  removeWeddingInvitedGuest,
  saveWeddingAttendanceNotifySettings,
  saveWeddingInvitedGuest,
} from './actions'
import { goToPreviousPage } from '@/components/navigation/browser-back-control'
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
    hint: 'Lời mời tự sinh theo xưng hô và tên khách, dùng thông tin nhà trai đã điền lúc tạo thiệp.',
    card: 'border-blue-200 bg-white shadow-md shadow-blue-100/80 ring-1 ring-blue-100',
    header: 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white',
    muted: 'text-blue-100',
    chip: 'bg-white/15 text-white',
    stat: 'border-blue-100 bg-blue-50',
    statLabel: 'text-blue-800/75',
    statValue: 'text-blue-950',
    table: 'border-blue-200',
    th: 'border-blue-800 bg-blue-800 text-blue-50',
    td: 'border-blue-100',
    index: 'bg-blue-100 text-blue-900',
    zebra: 'bg-blue-50/70',
    base: 'bg-white',
    empty: 'border-blue-200 bg-blue-50/60 text-blue-950',
    add: 'bg-blue-800 text-white shadow-sm hover:bg-blue-900',
    jump: 'border-blue-300 bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm',
  },
  bride: {
    side: 'bride_home' as const,
    panel: 'bride' as const,
    anchor: 'nha-gai',
    kicker: 'Nhà gái',
    title: 'Khách mời nhà gái',
    who: 'Cô dâu',
    hint: 'Lời mời tự sinh theo xưng hô và tên khách, dùng thông tin nhà gái đã điền lúc tạo thiệp.',
    card: 'border-pink-200 bg-white shadow-md shadow-pink-100/80 ring-1 ring-pink-100',
    header: 'bg-gradient-to-r from-pink-900 via-pink-800 to-pink-600 text-white',
    muted: 'text-pink-100',
    chip: 'bg-white/15 text-white',
    stat: 'border-pink-100 bg-pink-50',
    statLabel: 'text-pink-800/75',
    statValue: 'text-pink-950',
    table: 'border-pink-200',
    th: 'border-pink-800 bg-pink-800 text-pink-50',
    td: 'border-pink-100',
    index: 'bg-pink-100 text-pink-900',
    zebra: 'bg-pink-50/70',
    base: 'bg-white',
    empty: 'border-pink-200 bg-pink-50/60 text-pink-950',
    add: 'bg-pink-800 text-white shadow-sm hover:bg-pink-900',
    jump: 'border-pink-300 bg-gradient-to-br from-pink-800 to-pink-500 text-white shadow-sm',
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

function serializeSideBundle(
  settings: SideSettings,
  parents: { groomParents?: string; brideParents?: string; sectionConfig?: string } | null,
): string {
  return JSON.stringify({
    settings: serializeWeddingSideInviteSettings(settings),
    groomParents: parents?.groomParents ?? '',
    brideParents: parents?.brideParents ?? '',
    sectionConfig: parents?.sectionConfig ?? '',
  })
}

function sideSettingsFromCard(card: WeddingCard): SideSettings {
  return weddingSideInviteSettingsFromCard(card)
}

function rowBelongsToSide(row: GuestRow, side: GuestSide): boolean {
  if (side === 'bride_home') return row.inviteVenue === 'bride_home'
  return row.inviteVenue !== 'bride_home'
}

function statsForRows(rows: GuestRow[]) {
  const attendingRows = rows.filter((r) => r.status === 'attending')
  const declinedRows = rows.filter((r) => r.status === 'declined')
  const pendingRows = rows.filter((r) => r.status === 'pending')

  const attending = attendingRows.length
  const declined = declinedRows.length
  const pending = pendingRows.length

  const attendingPeople = attendingRows.reduce(
    (sum, r) =>
      sum +
      weddingResponseHeadcount({
        status: r.status,
        guestCount: Number(r.guestCount) || 0,
        adultCount: r.adultCount,
        childCount: r.childCount,
      }),
    0,
  )

  const declinedPeople = declinedRows.reduce(
    (sum, r) =>
      sum +
      weddingResponseHeadcount({
        status: r.status,
        guestCount: Number(r.guestCount) || 0,
        adultCount: r.adultCount,
        childCount: r.childCount,
      }),
    0,
  )

  return { attending, attendingPeople, declined, declinedPeople, pending, total: rows.length }
}

export default function WeddingInvitedGuestsClientPage({ cardId }: { cardId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState<WeddingCard | null>(null)
  const [rows, setRows] = useState<GuestRow[]>([])
  const [sideSettings, setSideSettings] = useState<SideSettings>(EMPTY_WEDDING_SIDE_INVITE_SETTINGS)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [focusSide, setFocusSide] = useState<'groom' | 'bride' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GuestRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [quotas, setQuotas] = useState<WeddingGuestSideQuotas | null>(null)
  const [packSide, setPackSide] = useState<WeddingGuestPackSide | null>(null)
  const [outsideRsvps, setOutsideRsvps] = useState<WeddingAttendanceRsvpSource[]>([])
  const [groomEmail, setGroomEmail] = useState('')
  const [brideEmail, setBrideEmail] = useState('')
  const [sendNotify, setSendNotify] = useState(false)
  const [notifySaving, setNotifySaving] = useState(false)
  const [notifySavedNote, setNotifySavedNote] = useState('')
  const savedNotifySnapshotRef = useRef('')
  const notifySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedSnapshotsRef = useRef<Map<string, string>>(new Map())
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const sideSettingsSnapshotRef = useRef('')
  const rowsRef = useRef<GuestRow[]>([])
  const cardRef = useRef<WeddingCard | null>(null)
  const sideSettingsRef = useRef<SideSettings>(sideSettings)
  cardRef.current = card
  rowsRef.current = rows
  sideSettingsRef.current = sideSettings

  const singleOccasion = useMemo(() => invitationOccasionShape(card?.occasionKey) === 'single', [card?.occasionKey])
  const occasionCopy = useMemo(() => invitationEditorCopy(card?.occasionKey), [card?.occasionKey])

  const backToEditor = useCallback(() => {
    goToPreviousPage(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(cardId)}`)
  }, [cardId])

  useSetCreationToolBackHandler(backToEditor)

  const syncSavedSnapshots = useCallback((guests: GuestRow[]) => {
    savedSnapshotsRef.current.clear()
    guests.forEach((row) => {
      if (!row.guestName.trim()) return
      const side: GuestSide = row.inviteVenue === 'bride_home' ? 'bride_home' : 'groom_home'
      savedSnapshotsRef.current.set(rowKey(row), serializeRow(row, side))
    })
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const result = await loadWeddingInvitedGuestsPage(cardId)
    if (!silent) setLoading(false)
    if ('error' in result && result.error) {
      toast({ title: 'Không tải được danh sách', description: result.error, variant: 'destructive' })
      return
    }
    if ('card' in result && result.card) {
      const owned = ownSidePartyFields(result.card)
      setCard(owned)
      const settings = sideSettingsFromCard(owned)
      setSideSettings(settings)
      sideSettingsSnapshotRef.current = serializeSideBundle(sideSettingsFromCard(result.card), result.card)
      const nextRows = result.guests.map(guestToRow)
      setRows(nextRows)
      syncSavedSnapshots(nextRows)
      if ('quotas' in result) setQuotas(result.quotas ?? null)
      if ('outsideRsvps' in result && result.outsideRsvps) {
        setOutsideRsvps(result.outsideRsvps)
      }
      if ('notifySettings' in result && result.notifySettings) {
        setGroomEmail(result.notifySettings.groomEmail || '')
        setBrideEmail(result.notifySettings.brideEmail || '')
        setSendNotify(result.notifySettings.notify)
        savedNotifySnapshotRef.current = `${result.notifySettings.groomEmail?.trim() || ''}\n${result.notifySettings.brideEmail?.trim() || ''}\n${result.notifySettings.notify ? '1' : '0'}`
      }
    }
  }, [cardId, syncSavedSnapshots, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refreshFromSharedCard = () => {
      if (document.visibilityState === 'hidden') return
      if (serializeSideBundle(sideSettingsRef.current, cardRef.current) !== sideSettingsSnapshotRef.current) return
      if (saveTimersRef.current.size > 0) return
      void load(true)
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshFromSharedCard()
    }
    document.addEventListener('visibilitychange', refreshFromSharedCard)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', refreshFromSharedCard)
      window.removeEventListener('pageshow', onPageShow)
    }
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
    const pack = side === 'bride_home' ? 'bride' : 'groom'
    const quota = quotas?.[pack]
    const count = rowsRef.current.filter((row) => rowBelongsToSide(row, side)).length
    if (quota?.packId && quota.guestCap != null && count >= quota.guestCap) {
      setPackSide(pack)
      return
    }
    setRows((prev) => [...prev, emptyRow(side)])
  }

  const persistNotify = useCallback(
    async (next: { groom: string; bride: string; notify: boolean }) => {
      const snap = `${next.groom.trim()}\n${next.bride.trim()}\n${next.notify ? '1' : '0'}`
      if (savedNotifySnapshotRef.current === snap) return
      setNotifySaving(true)
      const form = new FormData()
      form.set('cardId', cardId)
      form.set('groomEmail', next.groom.trim())
      form.set('brideEmail', !singleOccasion ? next.bride.trim() : '')
      form.set('notify', next.notify ? 'true' : 'false')
      const result = await saveWeddingAttendanceNotifySettings(form)
      setNotifySaving(false)
      if ('error' in result && result.error) {
        setNotifySavedNote('')
        toast({ title: 'Chưa lưu email thông báo', description: result.error, variant: 'destructive' })
        return
      }
      savedNotifySnapshotRef.current = snap
      setNotifySavedNote('Đã lưu tự động')
    },
    [cardId, singleOccasion, toast],
  )

  useEffect(() => {
    const groomTrim = groomEmail.trim()
    const brideTrim = singleOccasion ? '' : brideEmail.trim()
    const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
    if (!emailOk(groomTrim) || !emailOk(brideTrim)) return
    if (sendNotify && !groomTrim && !brideTrim) return
    const snap = `${groomTrim}\n${brideTrim}\n${sendNotify ? '1' : '0'}`
    if (savedNotifySnapshotRef.current === snap) return
    if (notifySaveTimerRef.current) clearTimeout(notifySaveTimerRef.current)
    notifySaveTimerRef.current = setTimeout(() => {
      notifySaveTimerRef.current = null
      void persistNotify({ groom: groomTrim, bride: brideTrim, notify: sendNotify })
    }, 800)
    return () => {
      if (notifySaveTimerRef.current) {
        clearTimeout(notifySaveTimerRef.current)
        notifySaveTimerRef.current = null
      }
    }
  }, [brideEmail, groomEmail, persistNotify, sendNotify, singleOccasion])

  const notifyDraftRef = useRef({ groom: groomEmail, bride: brideEmail, notify: sendNotify })
  notifyDraftRef.current = { groom: groomEmail, bride: brideEmail, notify: sendNotify }
  useEffect(() => {
    const flush = () => {
      if (notifySaveTimerRef.current) {
        clearTimeout(notifySaveTimerRef.current)
        notifySaveTimerRef.current = null
      }
      const next = notifyDraftRef.current
      const groomTrim = next.groom.trim()
      const brideTrim = singleOccasion ? '' : next.bride.trim()
      const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
      if (!emailOk(groomTrim) || !emailOk(brideTrim)) return
      if (next.notify && !groomTrim && !brideTrim) return
      void persistNotify({ groom: groomTrim, bride: brideTrim, notify: next.notify })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [persistNotify, singleOccasion])

  const addOutsideToSide = async (rsvp: WeddingAttendanceRsvpSource, targetSide: GuestSide) => {
    if (!card) return
    const sidePack: WeddingGuestPackSide = targetSide === 'bride_home' ? 'bride' : 'groom'
    const quota = quotas?.[sidePack]
    const sideCount = targetSide === 'bride_home' ? brideRows.length : groomRows.length
    if (quota?.packId && quota.guestCap != null && sideCount >= quota.guestCap) {
      setPackSide(sidePack)
      toast({
        title: 'Cần nâng gói khách mời',
        description: `Bên ${targetSide === 'bride_home' ? 'nhà gái' : 'nhà trai'} đã đạt giới hạn ${quota?.guestCap ?? 0} khách.`,
      })
      return
    }

    const form = new FormData()
    form.set('cardId', card.id)
    form.set('guestName', rsvp.guestName)
    form.set('guestHonorific', '')
    form.set('inviteVenue', targetSide)
    form.set('personalInvite', '')
    form.set('status', rsvp.attending ? 'attending' : 'declined')
    form.set('statusConfirmedBy', 'guest')
    form.set('guestCount', String(rsvp.guestCount || 1))
    form.set('adultCount', String(rsvp.adultCount || 0))
    form.set('childCount', String(rsvp.childCount || 0))
    form.set('wishMessage', rsvp.message || '')
    form.set('notes', 'Gửi xác nhận qua link thiệp công khai')

    const res = await saveWeddingInvitedGuest(form)
    if ('error' in res && res.error) {
      toast({ title: 'Lỗi', description: res.error, variant: 'destructive' })
      return
    }
    toast({
      title: 'Đã thêm vào danh sách',
      description: `Đã đưa ${rsvp.guestName} vào danh sách khách ${targetSide === 'bride_home' ? (occasionCopy.secondaryFamily || 'nhà gái') : (occasionCopy.primaryFamily || 'nhà trai')}.`,
    })
    void load(true)
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
      if ('code' in result && result.code === 'guest_pack_limit') {
        if (result.quotas) setQuotas(result.quotas)
        setPackSide(result.side === 'bride' ? 'bride' : fixedSide === 'bride_home' ? 'bride' : 'groom')
        toast({ title: 'Hết chỗ khách', description: result.error })
        return
      }
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

  const thClass = 'px-2 py-2.5 text-left text-[11px] font-semibold tracking-wide sm:text-xs'
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
          Chưa có khách {look.kicker.toLowerCase()}. Bấm «Thêm hàng loạt» phía trên hoặc «Thêm khách» phía dưới.
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {sideRows.map((row, index) => {
            const key = rowKey(row)
            const linkOpen = weddingGuestRowShowsInviteLink(index, quotas?.[look.panel]?.packId ?? null)
            const personalUrl =
              linkOpen && publishUrl && row.guestName.trim()
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
                  ) : !linkOpen ? (
                    <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setPackSide(look.panel)}>
                      Mua gói để mở link
                    </Button>
                  ) : null}
                  <details className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-stone-800">Lời mời, lời chúc, ghi chú</summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className={mobileLabelClass}>Lời mời</p>
                        <p className="break-words text-sm leading-relaxed text-stone-700">{row.personalInvite || '—'}</p>
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
                    </div>
                  </details>
                </div>
              </article>
            )
          })}
        </div>
        <div className={cn('hidden w-full overflow-hidden rounded-xl border shadow-sm md:block', look.table)}>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[17%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={cn(thClass, look.th, 'text-center')}>#</th>
                <th className={cn(thClass, look.th)}>Xưng hô</th>
                <th className={cn(thClass, look.th)}>Tên</th>
                <th className={cn(thClass, look.th)}>Trạng thái</th>
                <th className={cn(thClass, look.th, 'text-center')}>Người</th>
                <th className={cn(thClass, look.th)}>Lời chúc</th>
                <th className={cn(thClass, look.th)}>Ghi chú</th>
                <th className={cn(thClass, look.th, 'text-center')}>Link</th>
                <th className={cn(thClass, look.th, 'text-center')} />
              </tr>
            </thead>
            <tbody>
              {sideRows.map((row, index) => {
                const key = rowKey(row)
                const linkOpen = weddingGuestRowShowsInviteLink(index, quotas?.[look.panel]?.packId ?? null)
                const personalUrl =
                  linkOpen && publishUrl && row.guestName.trim()
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
                      {row.personalInvite ? (
                        <p className="truncate px-2 pb-1 text-[11px] leading-4 text-muted-foreground" title={row.personalInvite}>
                          {row.personalInvite}
                        </p>
                      ) : null}
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
                            className="h-8 w-8 shrink-0"
                            onClick={() => copyLink(row, side)}
                            title="Copy link thiệp"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Mở thiệp">
                            <a href={personalUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : !linkOpen ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 w-full px-0.5 text-[11px] font-semibold leading-tight"
                          onClick={() => setPackSide(look.panel)}
                          title="Mua gói để hiện link thiệp"
                        >
                          Mua gói
                        </Button>
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
                          className="h-8 w-8 text-destructive hover:text-destructive"
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
    </>
    )
  }

  const renderSide = (
    look: SideLook,
    sideRows: GuestRow[],
    stats: ReturnType<typeof statsForRows>,
    personName: string,
  ) => {
    const isBride = look.panel === 'bride'
    const sideKicker = isBride ? occasionCopy.secondaryFamily || look.kicker : occasionCopy.primaryFamily || look.kicker
    const sideTitle = isBride ? occasionCopy.guestSecondary || look.title : occasionCopy.guestPrimary || look.title
    const sideWho = isBride ? occasionCopy.secondaryRole || look.who : occasionCopy.primaryRole || look.who
    const focused = focusSide === (look.panel === 'groom' ? 'groom' : 'bride')
    const guestCap = quotas?.[look.panel]?.guestCap
    const addLabel =
      quotas?.[look.panel]?.packId && guestCap != null && sideRows.length >= guestCap
        ? `Nâng gói ${sideKicker.toLowerCase()}`
        : `Thêm khách ${sideKicker.toLowerCase()}`
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
        <header className={cn('px-4 py-3 sm:px-5', look.header)}>
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', look.muted)}>{sideKicker}</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold sm:text-xl">
            <Users className="h-5 w-5 shrink-0" />
            {sideTitle}
          </h2>
          <p className={cn('text-sm', look.muted)}>
            {sideWho}: {personName || '…'}
          </p>
        </header>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-stone-700">
              <span className="font-semibold tabular-nums">{stats.total}</span> khách
              <span className="mx-1.5 text-stone-300">·</span>
              <span className="font-semibold tabular-nums text-emerald-800">{stats.attending}</span> có đi ({stats.attendingPeople} người)
              <span className="mx-1.5 text-stone-300">·</span>
              <span className="font-semibold tabular-nums text-rose-800">{stats.declined}</span> không đi
              <span className="mx-1.5 text-stone-300">·</span>
              <span className="font-semibold tabular-nums text-amber-800">{stats.pending}</span> chưa trả lời
            </p>
            {!loading ? (
              <WeddingSideGuestBulkBar
                cardId={card?.id ?? ''}
                side={look.panel}
                disabled={loading || !card}
                onAdded={load}
                onNeedPack={(side, nextQuotas) => {
                  if (nextQuotas) setQuotas(nextQuotas)
                  setPackSide(side)
                }}
              />
            ) : null}
          </div>
          <WeddingGuestPackPanel
            cardId={card?.id ?? cardId}
            side={look.panel}
            quota={quotas?.[look.panel] ?? null}
            open={packSide === look.panel}
            onOpenChange={(open) => setPackSide(open ? look.panel : null)}
            onPaid={(next) => {
              if (next) setQuotas(next)
              void load(true)
            }}
          />
          {renderGuestTable(sideRows, look)}
          {!loading ? (
            <Button type="button" className={cn(look.add, 'h-11 w-full sm:w-auto')} onClick={() => addRow(look.side)}>
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Button>
          ) : null}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Quản lý khách mời & kết quả tham dự
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
              Quản lý danh sách khách, gửi thiệp cá nhân và theo dõi kết quả khách đi / không đi của từng nhà.
            </p>
          </div>
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={backToEditor}>
            Quay lại sửa thiệp
          </Button>
        </div>
        {!publishUrl ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Chưa xuất bản link thiệp — vẫn thêm/sửa được; link cá nhân chỉ dùng sau khi xuất bản.
          </p>
        ) : null}

        {renderSide(SIDE_LOOK.groom, groomRows, groomStats, card?.groomName ?? '')}
        {!singleOccasion ? renderSide(SIDE_LOOK.bride, brideRows, brideStats, card?.brideName ?? '') : null}

        {outsideRsvps.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-800 px-4 py-3 text-white sm:px-5">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <UserPlus className="h-4 w-4" />
                  Khách phản hồi ngoài danh sách mời ({outsideRsvps.length})
                </h3>
                <p className="mt-0.5 text-xs text-violet-200">
                  Khách gửi xác nhận qua link thiệp công khai chưa nằm trong danh sách khách nhà trai hay nhà gái.
                </p>
              </div>
            </header>
            <div className="divide-y divide-violet-100 p-3 sm:p-5">
              {outsideRsvps.map((rsvp, idx) => (
                <div key={`${rsvp.guestName}-${idx}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between first:pt-1 last:pb-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">{rsvp.guestName}</span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          rsvp.attending ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                        )}
                      >
                        {rsvp.attending ? (
                          <>
                            Có đi • {rsvp.adultCount + rsvp.childCount > 0 ? `${rsvp.adultCount} lớn, ${rsvp.childCount} trẻ` : `${rsvp.guestCount || 1} người`}
                          </>
                        ) : (
                          'Không đi'
                        )}
                      </span>
                      {rsvp.createdAt ? (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(rsvp.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      ) : null}
                    </div>
                    {rsvp.message ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-stone-600 italic">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                        «{rsvp.message}»
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                    <span className="text-xs text-muted-foreground mr-1">Thêm vào:</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-sky-300 bg-sky-50 text-xs font-medium text-sky-900 hover:bg-sky-100"
                      onClick={() => void addOutsideToSide(rsvp, 'groom_home')}
                    >
                      {occasionCopy.primaryFamily || 'Nhà trai'}
                    </Button>
                    {!singleOccasion ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-rose-300 bg-rose-50 text-xs font-medium text-rose-900 hover:bg-rose-100"
                        onClick={() => void addOutsideToSide(rsvp, 'bride_home')}
                      >
                        {occasionCopy.secondaryFamily || 'Nhà gái'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!singleOccasion ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/90 p-3 sm:p-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">Tổng hợp cả hai nhà</span>
              <span className="text-xs text-muted-foreground">
                Tổng cộng {groomStats.total + brideStats.total} khách mời
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center xl:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">Tổng khách mời</p>
                <p className="mt-0.5 text-2xl font-bold text-stone-900">{groomStats.total + brideStats.total}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 shadow-sm">
                <p className="text-xs font-medium text-emerald-800">Có đi ({groomStats.attendingPeople + brideStats.attendingPeople} người)</p>
                <p className="mt-0.5 text-2xl font-bold text-emerald-700">{groomStats.attending + brideStats.attending} khách</p>
              </div>
              <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-2.5 shadow-sm">
                <p className="text-xs font-medium text-rose-800">Không đi</p>
                <p className="mt-0.5 text-2xl font-bold text-rose-700">{groomStats.declined + brideStats.declined} khách</p>
              </div>
              <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-2.5 shadow-sm">
                <p className="text-xs font-medium text-amber-800">Chưa phản hồi</p>
                <p className="mt-0.5 text-2xl font-bold text-amber-700">{groomStats.pending + brideStats.pending} khách</p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div>
              <h3 className="text-base font-semibold text-stone-900">Email nhận thông báo khi có người xác nhận đi</h3>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                Thư cập nhật số khách đi, số người đi và số người không đi của từng nhà. Mỗi ngày tối đa một thư khi có người mới xác nhận đi.
              </p>
            </div>
          </div>

          <div className={cn('grid gap-3', !singleOccasion && 'sm:grid-cols-2')}>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-stone-700">Email {occasionCopy.primaryRole.toLowerCase()}</span>
              <Input
                type="email"
                autoComplete="email"
                value={groomEmail}
                placeholder="email@example.com"
                onChange={(event) => setGroomEmail(event.target.value)}
              />
            </label>
            {!singleOccasion ? (
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-stone-700">Email {occasionCopy.secondaryRole.toLowerCase()}</span>
                <Input
                  type="email"
                  autoComplete="email"
                  value={brideEmail}
                  placeholder="email@example.com"
                  onChange={(event) => setBrideEmail(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="flex items-start gap-3 text-sm">
            <Checkbox
              id="rsvp-notify-daily-increase"
              checked={sendNotify}
              onCheckedChange={(value) => setSendNotify(value === true)}
              className="mt-0.5"
            />
            <label htmlFor="rsvp-notify-daily-increase" className="cursor-pointer">
              <span className="font-medium text-stone-800">Gửi email khi số người đi tăng — mỗi ngày một thư</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Nhiều khách xác nhận trong cùng một ngày vẫn gộp làm một thư. Ngày không có thêm người đi thì không gửi.
              </span>
            </label>
          </div>

          {notifySaving || notifySavedNote ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {notifySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {notifySaving ? 'Đang lưu…' : notifySavedNote}
            </p>
          ) : null}
        </section>
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
