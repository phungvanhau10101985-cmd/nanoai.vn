'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { CalendarDays, Camera, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react'
import type { HospitalitySettingsDict } from '@/lib/i18n/hospitality-settings'

type PartnerOption = { id: string; display_name: string; slug: string }

type RoomTypeRow = {
  id: string
  code: string
  name: string
  description: string | null
  max_guests: number
  base_hourly_rate: number | null
  base_daily_rate: number | null
  currency: string
  is_active?: boolean
}

const ROOM_STATUS_TONES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  maintenance: 'secondary',
  inactive: 'outline',
}

type RoomRow = {
  id: string
  room_type_id: string
  room_code: string
  floor_label: string | null
  status: string
}

type RoomImageRow = {
  id: string
  room_id: string
  image_url: string
  sort_order: number
}

type AiSettings = {
  enabled: boolean
  tone_instructions: string
  policy_text: string
  default_locale: string
  auto_reply_enabled: boolean
}

type Report = {
  booking_count_30d: number
  confirmed_count_30d: number
  revenue_paid_30d: number
  pending_holds: number
}

type InteractionConversationRow = {
  id: string
  customer_name: string | null
  channel: string
  last_message_preview: string | null
  last_message_at: string | null
  created_at: string
}

type InteractionMessageRow = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
}

type InteractionBookingRow = {
  id: string
  customer_name: string
  checkin_at: string
  checkout_at: string
  total_amount: number
  currency: string
  status: string
}

type RoomScheduleSlot = {
  start_at: string
  end_at: string
  status: string
  source: string
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return '-'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function monthStartLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function monthEndLocalExclusive(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
}

function dayStartLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function dayEndLocalExclusive(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB
}

export function HospitalitySettingsClient({
  partners,
  initialPartnerId,
  t,
  appOrigin,
}: {
  partners: PartnerOption[]
  initialPartnerId: string
  t: HospitalitySettingsDict
  appOrigin: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [partnerId, setPartnerId] = useState(initialPartnerId || partners[0]?.id || '')
  const [status, setStatus] = useState('')
  const [embedCopiedKey, setEmbedCopiedKey] = useState<'url' | 'iframe' | ''>('')

  const selected = useMemo(() => partners.find((p) => p.id === partnerId) ?? null, [partners, partnerId])
  const embedUrl = useMemo(() => {
    if (!selected?.slug) return ''
    const base = String(appOrigin || '').trim().replace(/\/$/, '')
    if (!base) return ''
    return `${base}/hospitality/p/${encodeURIComponent(selected.slug)}?embed=1`
  }, [appOrigin, selected?.slug])
  const embedIframe = useMemo(() => {
    if (!embedUrl) return ''
    return `<iframe src="${embedUrl}" title="Hotel chat widget" width="100%" height="720" style="border:0;border-radius:12px;max-width:100%" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
  }, [embedUrl])

  const syncUrl = useCallback(
    (id: string) => {
      if (!id) return
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('partner', id)
      router.replace(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (partnerId) syncUrl(partnerId)
  }, [partnerId, syncUrl])

  const copyText = useCallback(async (text: string, key: 'url' | 'iframe') => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setEmbedCopiedKey(key)
      setStatus(t.copied)
      window.setTimeout(() => setEmbedCopiedKey((prev) => (prev === key ? '' : prev)), 1200)
    } catch {
      setStatus(t.copyFailed)
    }
  }, [t.copied, t.copyFailed])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t.choosePartnerTitle}</CardTitle>
          <CardDescription>{t.choosePartnerDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={t.choosePartnerPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name} · /{p.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>

      {selected ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.embedTitle}</CardTitle>
              <CardDescription>{t.embedDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>{t.embedHostedUrl}</Label>
                <div className="flex flex-wrap gap-2">
                  <Input value={embedUrl} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!embedUrl}
                    onClick={() => void copyText(embedUrl, 'url')}
                  >
                    {embedCopiedKey === 'url' ? t.copied : t.copy}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!embedUrl}
                    onClick={() => {
                      if (!embedUrl) return
                      window.open(embedUrl, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    {t.openEmbed}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t.embedIframeCode}</Label>
                <Textarea value={embedIframe} readOnly rows={4} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!embedIframe}
                  onClick={() => void copyText(embedIframe, 'iframe')}
                >
                  {embedCopiedKey === 'iframe' ? t.copied : t.copy}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="rooms" className="w-full">
            <TabsList className="w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="rooms">{t.tabRooms}</TabsTrigger>
            <TabsTrigger value="interaction">{t.tabInteraction}</TabsTrigger>
              <TabsTrigger value="ai">{t.tabAi}</TabsTrigger>
              <TabsTrigger value="report">{t.tabReport}</TabsTrigger>
            </TabsList>

            <TabsContent value="rooms" className="mt-4">
              <RoomsPanel partnerId={selected.id} setStatus={setStatus} t={t} />
            </TabsContent>

          <TabsContent value="interaction" className="mt-4">
            <InteractionPanel partnerId={selected.id} setStatus={setStatus} t={t} />
          </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <AiSettingsPanel partnerId={selected.id} setStatus={setStatus} t={t} />
            </TabsContent>

            <TabsContent value="report" className="mt-4">
              <ReportPanel partnerId={selected.id} setStatus={setStatus} t={t} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  )
}

const EMPTY_NEW_TYPE = {
  code: '',
  name: '',
  max_guests: 2,
  base_hourly_rate: '',
  base_daily_rate: '',
  currency: 'VND',
  description: '',
}

function RoomsPanel({
  partnerId,
  setStatus,
  t,
}: {
  partnerId: string
  setStatus: (s: string) => void
  t: HospitalitySettingsDict
}) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [images, setImages] = useState<RoomImageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [uploadingRoomId, setUploadingRoomId] = useState<string | null>(null)

  const loadRoomTypes = useCallback(async (): Promise<RoomTypeRow[]> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hospitality/partners/${partnerId}/room-types`, { credentials: 'same-origin' })
      const data = (await res.json()) as { items?: RoomTypeRow[]; error?: string }
      if (!res.ok) {
        setStatus(`${t.roomTypes}: ${data.error || 'unknown'}`)
        return []
      }
      const items = Array.isArray(data.items) ? data.items : []
      setRoomTypes(items)
      return items
    } finally {
      setLoading(false)
    }
  }, [partnerId, setStatus, t])

  const loadRooms = useCallback(async () => {
    const res = await fetch(`/api/hospitality/partners/${partnerId}/rooms`, { credentials: 'same-origin' })
    const data = (await res.json()) as { rooms?: RoomRow[]; error?: string }
    if (!res.ok) {
      setStatus(`${t.physicalRooms}: ${data.error || 'unknown'}`)
      return
    }
    setRooms(Array.isArray(data.rooms) ? data.rooms : [])
  }, [partnerId, setStatus, t])

  const loadImages = useCallback(async () => {
    const res = await fetch(`/api/hospitality/partners/${partnerId}/room-images`, { credentials: 'same-origin' })
    const data = (await res.json()) as { items?: RoomImageRow[]; error?: string }
    if (!res.ok) {
      setStatus(`${t.image}: ${data.error || 'unknown'}`)
      return
    }
    setImages(Array.isArray(data.items) ? data.items : [])
  }, [partnerId, setStatus, t])

  useEffect(() => {
    void loadRoomTypes()
    void loadRooms()
    void loadImages()
  }, [loadRoomTypes, loadRooms, loadImages])

  // Auto-select first available room type after load
  useEffect(() => {
    if (!selectedTypeId && roomTypes.length > 0) {
      setSelectedTypeId(roomTypes[0].id)
    }
    if (selectedTypeId && !roomTypes.some((rt) => rt.id === selectedTypeId)) {
      setSelectedTypeId(roomTypes[0]?.id ?? null)
    }
  }, [roomTypes, selectedTypeId])

  const uploadImagesForRoom = useCallback(
    async (roomId: string, files: File[]): Promise<number> => {
      let uploaded = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file || !/^image\//i.test(file.type)) continue
        const fd = new FormData()
        fd.set('file', file)
        fd.set('sort_order', String(i))
        try {
          const res = await fetch(
            `/api/hospitality/partners/${partnerId}/rooms/${roomId}/images`,
            { method: 'POST', credentials: 'same-origin', body: fd }
          )
          if (res.ok) uploaded += 1
          else {
            const data = (await res.json().catch(() => null)) as { error?: string } | null
            setStatus(`${t.image}: ${data?.error || 'unknown'}`)
          }
        } catch {
          setStatus(`${t.image}: failed`)
        }
      }
      return uploaded
    },
    [partnerId, setStatus, t]
  )

  const addImagesToRoom = useCallback(
    async (roomId: string, picked: File[]) => {
      if (!picked || picked.length === 0) return
      const files = picked.filter((f) => /^image\//i.test(f.type))
      if (files.length === 0) {
        setStatus('Only image files are accepted.')
        return
      }
      setUploadingRoomId(roomId)
      try {
        const n = await uploadImagesForRoom(roomId, files)
        if (n > 0) {
          setStatus(`${t.uploadedImages}: +${n}`)
          await loadImages()
        }
      } finally {
        setUploadingRoomId(null)
      }
    },
    [uploadImagesForRoom, loadImages, setStatus, t]
  )

  const removeImage = useCallback(
    async (imageId: string) => {
      const res = await fetch(`/api/hospitality/partners/${partnerId}/room-images/${imageId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setStatus(`${t.delete}: ${data?.error || 'unknown'}`)
        return
      }
      setImages((prev) => prev.filter((it) => it.id !== imageId))
    },
    [partnerId, setStatus, t]
  )

  const roomsByType = useMemo(() => {
    const grouped = new Map<string, RoomRow[]>()
    for (const r of rooms) {
      const arr = grouped.get(r.room_type_id) ?? []
      arr.push(r)
      grouped.set(r.room_type_id, arr)
    }
    return grouped
  }, [rooms])

  const imagesByRoom = useMemo(() => {
    const grouped = new Map<string, RoomImageRow[]>()
    for (const it of images) {
      const arr = grouped.get(it.room_id) ?? []
      arr.push(it)
      grouped.set(it.room_id, arr)
    }
    return grouped
  }, [images])

  const imageCountByType = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rooms) {
      const n = imagesByRoom.get(r.id)?.length ?? 0
      counts.set(r.room_type_id, (counts.get(r.room_type_id) ?? 0) + n)
    }
    return counts
  }, [rooms, imagesByRoom])

  const selectedType = useMemo(
    () => roomTypes.find((rt) => rt.id === selectedTypeId) ?? null,
    [roomTypes, selectedTypeId]
  )

  const stats = useMemo(() => {
    const totalActiveRooms = rooms.filter((r) => r.status === 'active').length
    return {
      typeCount: roomTypes.length,
      roomCount: rooms.length,
      activeRoomCount: totalActiveRooms,
      imageCount: images.length,
    }
  }, [roomTypes, rooms, images])

  async function handleCreateRoomType(payload: typeof EMPTY_NEW_TYPE): Promise<boolean> {
    const body = {
      code: payload.code.trim(),
      name: payload.name.trim(),
      description: payload.description.trim() || undefined,
      max_guests: Number(payload.max_guests || 2),
      base_hourly_rate: payload.base_hourly_rate ? Number(payload.base_hourly_rate) : null,
      base_daily_rate: payload.base_daily_rate ? Number(payload.base_daily_rate) : null,
      currency: payload.currency.trim().toUpperCase() || 'VND',
    }
    if (!body.code || !body.name) {
      setStatus(t.codeAndNameRequired)
      return false
    }
    const res = await fetch(`/api/hospitality/partners/${partnerId}/room-types`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.createRoomTypeFailed}: ${data.error || 'unknown'}`)
      return false
    }
    const created = data.room_type as RoomTypeRow | undefined
    setStatus(`${t.createdRoomType}: ${created?.name}`)
    await loadRoomTypes()
    if (created?.id) setSelectedTypeId(created.id)
    return true
  }

  async function handleUpdateRoomType(patch: Partial<RoomTypeRow>): Promise<boolean> {
    if (!selectedType) return false
    const res = await fetch(`/api/hospitality/partners/${partnerId}/room-types/${selectedType.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.updateFailed}: ${data.error || 'unknown'}`)
      return false
    }
    setStatus(t.savedRoomType)
    await loadRoomTypes()
    return true
  }

  async function handleDeleteRoomType() {
    if (!selectedType) return
    const res = await fetch(`/api/hospitality/partners/${partnerId}/room-types/${selectedType.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.deleteFailed}: ${data.error || 'unknown'}`)
      return
    }
    setStatus(`${t.deletedRoomType}: ${selectedType.name}`)
    setSelectedTypeId(null)
    await loadRoomTypes()
    await loadRooms()
    await loadImages()
  }

  async function handleCreateRoom(payload: { room_code: string; floor_label: string }): Promise<boolean> {
    if (!selectedType) return false
    const roomCode = payload.room_code.trim()
    if (!roomCode) {
      setStatus(t.roomCodeRequired)
      return false
    }
    const res = await fetch(`/api/hospitality/partners/${partnerId}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        room_type_id: selectedType.id,
        room_code: roomCode,
        floor_label: payload.floor_label.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.createRoomFailed}: ${data.error || 'unknown'}`)
      return false
    }
    setStatus(`${t.createdRoom}: ${data.room?.room_code}`)
    await loadRooms()
    return true
  }

  async function handleUpdateRoom(roomId: string, patch: { room_code?: string; floor_label?: string | null; status?: string }) {
    const res = await fetch(`/api/hospitality/partners/${partnerId}/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.updateRoomFailed}: ${data.error || 'unknown'}`)
      return
    }
    setStatus(t.updatedRoom)
    await loadRooms()
  }

  async function handleDeleteRoom(roomId: string) {
    const res = await fetch(`/api/hospitality/partners/${partnerId}/rooms/${roomId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(`${t.deleteRoomFailed}: ${data.error || 'unknown'}`)
      return
    }
    setStatus(t.deletedRoom)
    await loadRooms()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.roomTypes} value={stats.typeCount} hint={t.inSystem} />
        <StatCard label={t.physicalRooms} value={stats.roomCount} hint={`${stats.activeRoomCount} ${t.readySuffix}`} />
        <StatCard label={t.activeRooms} value={stats.activeRoomCount} hint={`${stats.roomCount - stats.activeRoomCount} ${t.pausedSuffix}`} />
        <StatCard label={t.uploadedImages} value={stats.imageCount} hint={t.forConsulting} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid gap-0 md:grid-cols-[320px_1fr]">
            <aside className="border-b md:border-b-0 md:border-r">
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div>
                  <p className="text-sm font-medium">{t.typeList}</p>
                  <p className="text-xs text-muted-foreground">
                    {loading ? t.loading : `${roomTypes.length} ${t.typeCountSuffix}`}
                  </p>
                </div>
                <CreateRoomTypeDialog onSubmit={handleCreateRoomType} t={t} />
              </div>
              <ul className="max-h-[520px] overflow-y-auto">
                {roomTypes.length === 0 ? (
                  <li className="p-4 text-sm text-muted-foreground">{t.noRoomType}</li>
                ) : (
                  roomTypes.map((rt) => {
                    const active = rt.id === selectedTypeId
                    const roomCount = roomsByType.get(rt.id)?.length ?? 0
                    const imgCount = imageCountByType.get(rt.id) ?? 0
                    return (
                      <li key={rt.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTypeId(rt.id)}
                          className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm transition ${
                            active ? 'bg-primary/10 font-medium' : 'hover:bg-muted/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{rt.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {rt.code} · {formatCurrency(rt.base_daily_rate, rt.currency)}/ngày
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-muted-foreground">
                            <span>{roomCount} {t.physicalRooms.toLowerCase()}</span>
                            <span>{imgCount} {t.image.toLowerCase()}</span>
                          </div>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </aside>

            <section className="p-4">
              {!selectedType ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">{t.emptySelectType}</p>
                  <CreateRoomTypeDialog onSubmit={handleCreateRoomType} asPrimary t={t} />
                </div>
              ) : (
                <RoomTypeDetail
                  key={selectedType.id}
                  partnerId={partnerId}
                  type={selectedType}
                  rooms={roomsByType.get(selectedType.id) ?? []}
                  imagesByRoom={imagesByRoom}
                  imageCount={imageCountByType.get(selectedType.id) ?? 0}
                  uploadingRoomId={uploadingRoomId}
                  onSave={handleUpdateRoomType}
                  onDelete={handleDeleteRoomType}
                  onAddImagesToRoom={addImagesToRoom}
                  onRemoveImage={removeImage}
                  onCreateRoom={handleCreateRoom}
                  onUpdateRoom={handleUpdateRoom}
                  onDeleteRoom={handleDeleteRoom}
                  t={t}
                />
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function CreateRoomTypeDialog({
  onSubmit,
  asPrimary,
  t,
}: {
  onSubmit: (payload: typeof EMPTY_NEW_TYPE) => Promise<boolean>
  asPrimary?: boolean
  t: HospitalitySettingsDict
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_NEW_TYPE)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => setForm(EMPTY_NEW_TYPE)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={asPrimary ? 'default' : 'outline'}>
          {t.createRoomType}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.roomTypeNewTitle}</DialogTitle>
          <DialogDescription>{t.roomTypeNewDesc}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{t.roomTypeCode}</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="STD" />
          </div>
          <div className="space-y-1">
            <Label>{t.roomTypeName}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard Room" />
          </div>
          <div className="space-y-1">
            <Label>{t.maxGuests}</Label>
            <Input
              type="number"
              min={1}
              value={form.max_guests}
              onChange={(e) => setForm({ ...form, max_guests: Number(e.target.value || 1) })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t.currency}</Label>
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>{t.hourlyRate}</Label>
            <Input
              type="number"
              min={0}
              value={form.base_hourly_rate}
              onChange={(e) => setForm({ ...form, base_hourly_rate: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label>{t.dailyRate}</Label>
            <Input
              type="number"
              min={0}
              value={form.base_daily_rate}
              onChange={(e) => setForm({ ...form, base_daily_rate: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>{t.description}</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Amenities, view, area..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button
            onClick={async () => {
              setSubmitting(true)
              try {
                const ok = await onSubmit(form)
                if (ok) {
                  reset()
                  setOpen(false)
                }
              } finally {
                setSubmitting(false)
              }
            }}
            disabled={submitting}
          >
            {submitting ? t.creating : t.createRoomType}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoomTypeDetail({
  partnerId,
  type,
  rooms,
  imagesByRoom,
  imageCount,
  uploadingRoomId,
  onSave,
  onDelete,
  onAddImagesToRoom,
  onRemoveImage,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
  t,
}: {
  partnerId: string
  type: RoomTypeRow
  rooms: RoomRow[]
  imagesByRoom: Map<string, RoomImageRow[]>
  imageCount: number
  uploadingRoomId: string | null
  onSave: (patch: Partial<RoomTypeRow>) => Promise<boolean>
  onDelete: () => Promise<void>
  onAddImagesToRoom: (roomId: string, files: File[]) => Promise<void>
  onRemoveImage: (imageId: string) => Promise<void>
  onCreateRoom: (payload: { room_code: string; floor_label: string }) => Promise<boolean>
  onUpdateRoom: (roomId: string, patch: { room_code?: string; floor_label?: string | null; status?: string }) => Promise<void>
  onDeleteRoom: (roomId: string) => Promise<void>
  t: HospitalitySettingsDict
}) {
  const [form, setForm] = useState(() => ({
    code: type.code,
    name: type.name,
    description: type.description ?? '',
    max_guests: type.max_guests,
    base_hourly_rate: type.base_hourly_rate == null ? '' : String(type.base_hourly_rate),
    base_daily_rate: type.base_daily_rate == null ? '' : String(type.base_daily_rate),
    currency: type.currency,
    is_active: type.is_active !== false,
  }))
  const [saving, setSaving] = useState(false)
  const [newRoom, setNewRoom] = useState({ room_code: '', floor_label: '' })

  useEffect(() => {
    setForm({
      code: type.code,
      name: type.name,
      description: type.description ?? '',
      max_guests: type.max_guests,
      base_hourly_rate: type.base_hourly_rate == null ? '' : String(type.base_hourly_rate),
      base_daily_rate: type.base_daily_rate == null ? '' : String(type.base_daily_rate),
      currency: type.currency,
      is_active: type.is_active !== false,
    })
  }, [type])

  async function save() {
    setSaving(true)
    try {
      await onSave({
        code: form.code.trim() || type.code,
        name: form.name.trim() || type.name,
        description: form.description.trim() ? form.description.trim() : null,
        max_guests: Math.max(1, Number(form.max_guests || 1)),
        base_hourly_rate: form.base_hourly_rate === '' ? null : Number(form.base_hourly_rate),
        base_daily_rate: form.base_daily_rate === '' ? null : Number(form.base_daily_rate),
        currency: form.currency.trim().toUpperCase() || 'VND',
        is_active: form.is_active,
      } as Partial<RoomTypeRow>)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{type.name}</h3>
            <Badge variant="outline">{type.code}</Badge>
            <Badge variant={form.is_active ? 'secondary' : 'outline'}>
              {form.is_active ? 'Visible' : 'Hidden'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {rooms.length} {t.physicalRooms.toLowerCase()} · {imageCount} {t.image.toLowerCase()} · {t.maxGuests.toLowerCase()} {type.max_guests}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? t.saving : t.saveChanges}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                {t.delete}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.roomTypeDeleteTitle} &quot;{type.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>{t.roomTypeDeleteDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onDelete()}>{t.deleteForever}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList>
          <TabsTrigger value="rooms">{t.roomsTab} ({rooms.length})</TabsTrigger>
          <TabsTrigger value="info">{t.infoTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t.roomTypeCode}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t.roomTypeName}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t.maxGuests}</Label>
              <Input
                type="number"
                min={1}
                value={form.max_guests}
                onChange={(e) => setForm({ ...form, max_guests: Number(e.target.value || 1) })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t.currency}</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t.hourlyRate}</Label>
              <Input
                type="number"
                min={0}
                value={form.base_hourly_rate}
                onChange={(e) => setForm({ ...form, base_hourly_rate: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>{t.dailyRate}</Label>
              <Input
                type="number"
                min={0}
                value={form.base_daily_rate}
                onChange={(e) => setForm({ ...form, base_daily_rate: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>{t.description}</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Amenities, view, area..."
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3 rounded-md border p-3">
              <Switch
                id="rt-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <div>
                <Label htmlFor="rt-active">Visible in guest consulting</Label>
                <p className="text-xs text-muted-foreground">Disable to hide this room type temporarily.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="mt-4 space-y-3">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.roomQuickAddTitle}</CardTitle>
              <CardDescription>{t.roomQuickAddDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label>{t.newRoomCode}</Label>
                  <Input
                    value={newRoom.room_code}
                    onChange={(e) => setNewRoom({ ...newRoom, room_code: e.target.value })}
                    placeholder="101"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t.floorOptional}</Label>
                  <Input
                    value={newRoom.floor_label}
                    onChange={(e) => setNewRoom({ ...newRoom, floor_label: e.target.value })}
                    placeholder="1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={async () => {
                      const ok = await onCreateRoom(newRoom)
                      if (ok) setNewRoom({ room_code: '', floor_label: '' })
                    }}
                    disabled={!newRoom.room_code.trim()}
                  >
                    {t.addRoom}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noRoomForType}</p>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t.roomCode}</th>
                    <th className="px-3 py-2 text-left">{t.floor}</th>
                    <th className="px-3 py-2 text-left">{t.image}</th>
                    <th className="px-3 py-2 text-left">{t.status}</th>
                    <th className="px-3 py-2 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <RoomTableRow
                      key={r.id}
                      partnerId={partnerId}
                      room={r}
                      images={imagesByRoom.get(r.id) ?? []}
                      uploading={uploadingRoomId === r.id}
                      onUpdate={(patch) => onUpdateRoom(r.id, patch)}
                      onDelete={() => onDeleteRoom(r.id)}
                      onAddImages={(files) => onAddImagesToRoom(r.id, files)}
                      onRemoveImage={onRemoveImage}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RoomTableRow({
  partnerId,
  room,
  images,
  uploading,
  onUpdate,
  onDelete,
  onAddImages,
  onRemoveImage,
  t,
}: {
  partnerId: string
  room: RoomRow
  images: RoomImageRow[]
  uploading: boolean
  onUpdate: (patch: { room_code?: string; floor_label?: string | null; status?: string }) => Promise<void>
  onDelete: () => Promise<void>
  onAddImages: (files: File[]) => Promise<void>
  onRemoveImage: (imageId: string) => Promise<void>
  t: HospitalitySettingsDict
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ room_code: room.room_code, floor_label: room.floor_label ?? '' })
  const [imagesOpen, setImagesOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleMonth, setScheduleMonth] = useState<Date>(() => monthStartLocal(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => dayStartLocal(new Date()))
  const [scheduleSlots, setScheduleSlots] = useState<RoomScheduleSlot[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)

  useEffect(() => {
    setForm({ room_code: room.room_code, floor_label: room.floor_label ?? '' })
  }, [room.room_code, room.floor_label])

  const firstImage = images[0]
  const parsedSchedule = useMemo(
    () =>
      scheduleSlots
        .map((s) => ({
          start: new Date(s.start_at).getTime(),
          end: new Date(s.end_at).getTime(),
          status: s.status,
        }))
        .filter((it) => Number.isFinite(it.start) && Number.isFinite(it.end) && it.end > it.start),
    [scheduleSlots]
  )

  useEffect(() => {
    if (!scheduleOpen) return
    const fromAt = monthStartLocal(scheduleMonth)
    const toAt = monthEndLocalExclusive(scheduleMonth)
    let cancelled = false
    async function loadSchedule() {
      setScheduleLoading(true)
      try {
        const qs = new URLSearchParams({
          from_at: fromAt.toISOString(),
          to_at: toAt.toISOString(),
        })
        const res = await fetch(
          `/api/hospitality/partners/${partnerId}/rooms/${room.id}/schedule?${qs.toString()}`,
          { credentials: 'same-origin' }
        )
        const data = (await res.json().catch(() => null)) as { items?: RoomScheduleSlot[] } | null
        if (!cancelled) {
          setScheduleSlots(Array.isArray(data?.items) ? data.items : [])
        }
      } finally {
        if (!cancelled) setScheduleLoading(false)
      }
    }
    void loadSchedule()
    return () => {
      cancelled = true
    }
  }, [scheduleOpen, scheduleMonth, partnerId, room.id])

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(scheduleMonth),
    [scheduleMonth]
  )

  const dayCells = useMemo(() => {
    const first = monthStartLocal(scheduleMonth)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - offset)
    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(start)
      d.setDate(start.getDate() + idx)
      return d
    })
  }, [scheduleMonth])

  const getDayState = useCallback(
    (d: Date): 'free' | 'partial' | 'full' => {
      const dayStart = dayStartLocal(d).getTime()
      const dayEnd = dayEndLocalExclusive(d).getTime()
      let occupiedMinutes = 0
      for (const slot of parsedSchedule) {
        if (!overlaps(slot.start, slot.end, dayStart, dayEnd)) continue
        const overlapStart = Math.max(slot.start, dayStart)
        const overlapEnd = Math.min(slot.end, dayEnd)
        occupiedMinutes += Math.max(0, (overlapEnd - overlapStart) / 60000)
      }
      if (occupiedMinutes <= 0) return 'free'
      if (occupiedMinutes >= 23 * 60) return 'full'
      return 'partial'
    },
    [parsedSchedule]
  )

  const hourlyRows = useMemo(() => {
    const start = dayStartLocal(selectedDay).getTime()
    return Array.from({ length: 24 }, (_, hour) => {
      const hourStart = start + hour * 3600_000
      const hourEnd = hourStart + 3600_000
      const busy = parsedSchedule.some((slot) => overlaps(slot.start, slot.end, hourStart, hourEnd))
      return {
        hour,
        busy,
      }
    })
  }, [parsedSchedule, selectedDay])

  return (
    <tr className="border-t align-middle">
      <td className="px-3 py-2">
        {editing ? (
          <Input
            className="h-8"
            value={form.room_code}
            onChange={(e) => setForm({ ...form, room_code: e.target.value })}
          />
        ) : (
          <span className="font-medium">{room.room_code}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <Input
            className="h-8"
            value={form.floor_label}
            onChange={(e) => setForm({ ...form, floor_label: e.target.value })}
            placeholder="—"
          />
        ) : (
          <span className="text-muted-foreground">{room.floor_label || '—'}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => setImagesOpen(true)}
          className="inline-flex items-center gap-2 rounded border px-1.5 py-1 text-xs hover:bg-muted"
          title={t.roomImageTitlePrefix}
        >
          {firstImage ? (
            <span className="relative block h-8 w-10 overflow-hidden rounded">
              <Image
                src={firstImage.image_url}
                alt={room.room_code}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <span className="flex h-8 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
              +
            </span>
          )}
          <span>{images.length > 0 ? `${images.length} ${t.image.toLowerCase()}` : t.addImage}</span>
        </button>

        <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t.roomImageTitlePrefix} {room.room_code}</DialogTitle>
              <DialogDescription>{t.roomImageDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-muted',
                    uploading && 'pointer-events-none opacity-60'
                  )}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  {uploading ? t.loading : t.chooseImage}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const input = e.currentTarget
                      const picked = input.files ? Array.from(input.files) : []
                      if (picked.length === 0) return
                      void onAddImages(picked).finally(() => {
                        input.value = ''
                      })
                    }}
                  />
                </label>
                <label
                  className={cn(
                    'md:hidden inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-muted',
                    uploading && 'pointer-events-none opacity-60'
                  )}
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  {t.takePhoto}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const input = e.currentTarget
                      const picked = input.files ? Array.from(input.files) : []
                      if (picked.length === 0) return
                      void onAddImages(picked).finally(() => {
                        input.value = ''
                      })
                    }}
                  />
                </label>
              </div>
              {images.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.noImageYet}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((img) => (
                    <div key={img.id} className="overflow-hidden rounded border bg-background">
                      <div className="relative aspect-[4/3]">
                        <Image
                          src={img.image_url}
                          alt={`${room.room_code}`}
                          fill
                          sizes="(max-width: 640px) 50vw, 33vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void onRemoveImage(img.id)}
                        className="w-full border-t px-2 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                      >
                        {t.delete}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <div className="flex w-full items-center justify-between gap-2">
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted',
                    uploading && 'pointer-events-none opacity-60'
                  )}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  {t.addImage}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const input = e.currentTarget
                      const picked = input.files ? Array.from(input.files) : []
                      if (picked.length === 0) return
                      void onAddImages(picked).finally(() => {
                        input.value = ''
                      })
                    }}
                  />
                </label>
                <Button onClick={() => setImagesOpen(false)} disabled={uploading}>
                  {uploading ? t.saving : t.save}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
      <td className="px-3 py-2">
        <Select value={room.status} onValueChange={(v) => void onUpdate({ status: v })}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue>
              <Badge variant={ROOM_STATUS_TONES[room.status] ?? 'outline'}>
                {(room.status === 'active' ? t.active : room.status === 'maintenance' ? t.maintenance : room.status === 'inactive' ? t.inactive : room.status)}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t.active}</SelectItem>
            <SelectItem value="maintenance">{t.maintenance}</SelectItem>
            <SelectItem value="inactive">{t.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex gap-1">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await onUpdate({
                    room_code: form.room_code.trim() || room.room_code,
                    floor_label: form.floor_label.trim() ? form.floor_label.trim() : null,
                  })
                  setEditing(false)
                }}
              >
                {t.save}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t.cancel}
              </Button>
            </>
          ) : (
            <>
              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => setScheduleOpen(true)}>
                    <CalendarDays className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {t.calendar}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl">
                  <DialogHeader>
                    <DialogTitle>{t.roomCalendarTitle} {room.room_code}</DialogTitle>
                    <DialogDescription>{t.calendarHint}</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {t.dayFree}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        {t.dayHourlyBooked}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        {t.dayFullBooked}
                      </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            >
                              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                              {t.prevMonth}
                            </Button>
                            <p className="text-sm font-medium capitalize">{monthLabel}</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            >
                              {t.nextMonth}
                              <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label) => (
                              <div key={label} className="py-1">
                                {label}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {dayCells.map((d) => {
                              const state = getDayState(d)
                              const sameMonth = d.getMonth() === scheduleMonth.getMonth()
                              const active = d.toDateString() === selectedDay.toDateString()
                              const tone =
                                state === 'free'
                                  ? 'bg-emerald-500/20 text-emerald-700 border-emerald-400'
                                  : state === 'full'
                                    ? 'bg-rose-500/20 text-rose-700 border-rose-400'
                                    : 'bg-amber-400/25 text-amber-800 border-amber-400'
                              return (
                                <button
                                  key={d.toISOString()}
                                  type="button"
                                  className={cn(
                                    'h-9 rounded border text-xs transition',
                                    tone,
                                    !sameMonth && 'opacity-35',
                                    active && 'ring-2 ring-primary'
                                  )}
                                  onClick={() => setSelectedDay(dayStartLocal(d))}
                                >
                                  {d.getDate()}
                                </button>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {t.hourTableTitle}:{' '}
                            {new Intl.DateTimeFormat('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            }).format(selectedDay)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {scheduleLoading ? (
                            <p className="text-sm text-muted-foreground">{t.loading}</p>
                          ) : (
                            <div className="max-h-[360px] space-y-1 overflow-auto pr-1">
                              {hourlyRows.map((row) => (
                                <div
                                  key={row.hour}
                                  className={cn(
                                    'grid grid-cols-[64px_1fr] items-center rounded border px-2 py-1.5 text-xs',
                                    row.busy
                                      ? 'border-rose-300 bg-rose-500/20 text-rose-700'
                                      : 'border-emerald-300 bg-emerald-500/20 text-emerald-700'
                                  )}
                                >
                                  <span>{String(row.hour).padStart(2, '0')}:00</span>
                                  <span className="font-medium">{row.busy ? t.hourBooked : t.hourFree}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {t.edit}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive">
                    {t.delete}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.roomDeleteTitle} &quot;{room.room_code}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>{t.roomDeleteDesc}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void onDelete()}>{t.delete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function InteractionPanel({
  partnerId,
  setStatus,
  t,
}: {
  partnerId: string
  setStatus: (s: string) => void
  t: HospitalitySettingsDict
}) {
  const [conversations, setConversations] = useState<InteractionConversationRow[]>([])
  const [bookings, setBookings] = useState<InteractionBookingRow[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [messages, setMessages] = useState<InteractionMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const loadConversationsAndBookings = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const [convRes, bookingRes] = await Promise.all([
        fetch(`/api/hospitality/partners/${partnerId}/conversations?limit=80`, {
          credentials: 'same-origin',
        }),
        fetch(`/api/hospitality/partners/${partnerId}/bookings?limit=30`, {
          credentials: 'same-origin',
        }),
      ])
      const convData = (await convRes.json().catch(() => null)) as
        | { conversations?: InteractionConversationRow[]; error?: string }
        | null
      const bookingData = (await bookingRes.json().catch(() => null)) as
        | { bookings?: InteractionBookingRow[]; error?: string }
        | null

      if (!convRes.ok) {
        setStatus(convData?.error || 'LOAD_CONVERSATIONS_FAILED')
      } else {
        const rows = Array.isArray(convData?.conversations) ? convData.conversations : []
        setConversations(rows)
        if (!selectedConversationId && rows[0]?.id) setSelectedConversationId(rows[0].id)
      }

      if (!bookingRes.ok) {
        setStatus(bookingData?.error || 'LOAD_BOOKINGS_FAILED')
      } else {
        setBookings(Array.isArray(bookingData?.bookings) ? bookingData.bookings : [])
      }
    } finally {
      setLoadingConversations(false)
    }
  }, [partnerId, selectedConversationId, setStatus])

  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    try {
      const res = await fetch(
        `/api/hospitality/partners/${partnerId}/conversations/${selectedConversationId}/messages`,
        { credentials: 'same-origin' }
      )
      const data = (await res.json().catch(() => null)) as
        | { messages?: InteractionMessageRow[]; error?: string }
        | null
      if (!res.ok) {
        setStatus(data?.error || 'LOAD_MESSAGES_FAILED')
        return
      }
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
    } finally {
      setLoadingMessages(false)
    }
  }, [partnerId, selectedConversationId, setStatus])

  useEffect(() => {
    void loadConversationsAndBookings()
  }, [loadConversationsAndBookings])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const sendMessage = useCallback(async () => {
    const text = draft.trim()
    if (!selectedConversationId || !text) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/hospitality/partners/${partnerId}/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ body: text }),
        }
      )
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setStatus(data?.error || 'SEND_FAILED')
        return
      }
      setDraft('')
      await loadMessages()
      await loadConversationsAndBookings()
    } finally {
      setSending(false)
    }
  }, [draft, selectedConversationId, partnerId, loadMessages, loadConversationsAndBookings, setStatus])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.interactionTitle}</CardTitle>
          <CardDescription>{t.interactionDesc}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t.conversations}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingConversations ? (
              <p className="text-sm text-muted-foreground">{t.loading}</p>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noConversations}</p>
            ) : (
              <div className="max-h-[520px] space-y-1 overflow-auto pr-1">
                {conversations.map((conv) => {
                  const active = conv.id === selectedConversationId
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={cn(
                        'w-full rounded border p-2 text-left text-xs transition',
                        active ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">
                          {conv.customer_name || `${t.customer} #${conv.id.slice(0, 8)}`}
                        </p>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          {conv.channel}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">
                        {conv.last_message_preview || '...'}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t.sendMessage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedConversationId ? (
              <p className="text-sm text-muted-foreground">{t.pickConversation}</p>
            ) : (
              <>
                <div className="max-h-[420px] space-y-2 overflow-auto rounded border p-2">
                  {loadingMessages ? (
                    <p className="text-sm text-muted-foreground">{t.loading}</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.noConversations}</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'max-w-[85%] rounded px-2.5 py-1.5 text-sm',
                          m.direction === 'inbound'
                            ? 'bg-muted text-foreground'
                            : 'ml-auto bg-primary/15 text-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body || '...'}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat('vi-VN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(m.created_at))}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void sendMessage()
                      }
                    }}
                  />
                  <Button type="button" onClick={() => void sendMessage()} disabled={sending || !draft.trim()}>
                    {sending ? t.sendingMessage : t.sendMessage}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t.bookings}</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noBookings}</p>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t.customer}</th>
                    <th className="px-3 py-2 text-left">{t.checkin}</th>
                    <th className="px-3 py-2 text-left">{t.checkout}</th>
                    <th className="px-3 py-2 text-left">{t.amount}</th>
                    <th className="px-3 py-2 text-left">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2">{b.customer_name || '—'}</td>
                      <td className="px-3 py-2">
                        {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                          new Date(b.checkin_at)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                          new Date(b.checkout_at)
                        )}
                      </td>
                      <td className="px-3 py-2">{formatCurrency(b.total_amount, b.currency)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{b.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AiSettingsPanel({
  partnerId,
  setStatus,
  t,
}: {
  partnerId: string
  setStatus: (s: string) => void
  t: HospitalitySettingsDict
}) {
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    tone_instructions: '',
    policy_text: '',
    default_locale: 'vi',
    auto_reply_enabled: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hospitality/partners/${partnerId}/ai-settings`, { credentials: 'same-origin' })
      const data = (await res.json()) as { settings?: Partial<AiSettings> | null; error?: string }
      if (!res.ok) {
        setStatus(`${t.aiTitle}: ${data.error || 'unknown'}`)
        return
      }
      const s = data.settings ?? {}
      setSettings({
        enabled: Boolean(s.enabled),
        tone_instructions: String(s.tone_instructions ?? ''),
        policy_text: String(s.policy_text ?? ''),
        default_locale: String(s.default_locale ?? 'vi'),
        auto_reply_enabled: Boolean(s.auto_reply_enabled),
      })
    } finally {
      setLoading(false)
    }
  }, [partnerId, setStatus, t])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/hospitality/partners/${partnerId}/ai-settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(`${t.saveSettings}: ${data.error || 'unknown'}`)
        return
      }
      setStatus(t.saveSettings)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t.aiTitle}</CardTitle>
        <CardDescription>{t.aiDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">{t.loading}</p> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          {t.enableAi}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.auto_reply_enabled}
            onChange={(e) => setSettings({ ...settings, auto_reply_enabled: e.target.checked })}
          />
          {t.autoReply}
        </label>
        <div className="space-y-1">
          <Label>{t.defaultLocale}</Label>
          <Input
            value={settings.default_locale}
            onChange={(e) => setSettings({ ...settings, default_locale: e.target.value })}
            placeholder="vi"
            className="max-w-[120px]"
          />
        </div>
        <div className="space-y-1">
          <Label>{t.toneGuide}</Label>
          <Textarea
            rows={3}
            value={settings.tone_instructions}
            onChange={(e) => setSettings({ ...settings, tone_instructions: e.target.value })}
            placeholder="Friendly replies, suggest room options by guest count..."
          />
        </div>
        <div className="space-y-1">
          <Label>{t.policy}</Label>
          <Textarea
            rows={4}
            value={settings.policy_text}
            onChange={(e) => setSettings({ ...settings, policy_text: e.target.value })}
            placeholder="Check-in from 14:00, check-out before 12:00, free cancellation within 24 hours..."
          />
        </div>
        <div>
          <Button onClick={save} disabled={saving}>
            {saving ? t.saving : t.saveSettings}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportPanel({
  partnerId,
  setStatus,
  t,
}: {
  partnerId: string
  setStatus: (s: string) => void
  t: HospitalitySettingsDict
}) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hospitality/partners/${partnerId}/reports`, { credentials: 'same-origin' })
      const data = (await res.json()) as { report?: Report; error?: string }
      if (!res.ok) {
        setStatus(`${t.reportTitle}: ${data.error || 'unknown'}`)
        return
      }
      setReport(data.report ?? null)
    } finally {
      setLoading(false)
    }
  }, [partnerId, setStatus, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">{t.reportTitle}</CardTitle>
          <CardDescription>{t.reportDesc}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? t.loading : t.reload}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm md:grid-cols-2">
        {report ? (
          <>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t.totalBookings}</p>
              <p className="text-2xl font-semibold">{report.booking_count_30d}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t.confirmedBookings}</p>
              <p className="text-2xl font-semibold">{report.confirmed_count_30d}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t.paidRevenue}</p>
              <p className="text-2xl font-semibold">{formatCurrency(report.revenue_paid_30d, 'VND')}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t.pendingHolds}</p>
              <p className="text-2xl font-semibold">{report.pending_holds}</p>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">{t.noData}</p>
        )}
      </CardContent>
    </Card>
  )
}
