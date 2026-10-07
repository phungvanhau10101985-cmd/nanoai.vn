'use client'

import { Loader2, MapPin, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WeddingTimelineEditor } from '@/components/wedding/wedding-timeline-editor'
import { parseWeddingTimeClockAndWeekday } from '@/lib/wedding/wedding-calendar-utils'
import type { WeddingSideInviteSettings } from '@/lib/wedding/wedding-side-invite-settings'

type Side = 'groom' | 'bride'

type Props = {
  side: Side
  card: WeddingCard | null
  settings: WeddingSideInviteSettings
  saving: boolean
  onChange: (next: WeddingSideInviteSettings) => void
  onParentsChange: (value: string) => void
}

function fieldKey(prefix: 'groomInvite' | 'brideInvite', name: string): keyof WeddingSideInviteSettings {
  return `${prefix}${name}` as keyof WeddingSideInviteSettings
}

export function WeddingSideInviteSettingsPanel({ side, card, settings, saving, onChange, onParentsChange }: Props) {
  const groom = side === 'groom'
  const sideLabel = groom ? 'nhà trai' : 'nhà gái'
  const prefix = groom ? 'groomInvite' : 'brideInvite'
  const tone = groom
    ? 'border-2 border-sky-600 bg-sky-200'
    : 'border-2 border-rose-600 bg-rose-200'
  const parents = groom ? card?.groomParents ?? '' : card?.brideParents ?? ''

  const patch = (field: keyof WeddingSideInviteSettings, value: string) => {
    onChange({ ...settings, [field]: value })
  }

  const dateKey = fieldKey(prefix, 'WeddingDate')
  const receptionKey = fieldKey(prefix, 'ReceptionTime')
  const partyKey = fieldKey(prefix, 'PartyStartTime')
  const addressKey = fieldKey(prefix, 'Address')
  const mapKey = fieldKey(prefix, 'MapUrl')
  const timelineKey = fieldKey(prefix, 'EventTimeline')
  const contactKey = fieldKey(prefix, 'Contact')

  const dateShown = settings[dateKey]
  const receptionShown = settings[receptionKey]
  const partyShown = settings[partyKey]
  const addressShown = settings[addressKey]
  const mapShown = settings[mapKey]
  const timelineShown = settings[timelineKey]

  return (
    <div className={cn('grid gap-3 rounded-xl border p-3 sm:grid-cols-2 sm:p-4', tone)}>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Chỉ điền thông tin riêng của {sideLabel}. Tên cô dâu chú rể, lời mời, dress code và lời cảm ơn nằm ở phần chung.
      </p>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Bố mẹ {sideLabel}</Label>
        <Input value={parents} onChange={(e) => onParentsChange(e.target.value)} className="text-sm" />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Ngày tiệc {sideLabel}</Label>
        <Input
          type="date"
          value={dateShown}
          onChange={(e) => patch(dateKey, e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Giờ đón khách</Label>
        <Input
          type="time"
          value={parseWeddingTimeClockAndWeekday(receptionShown).time || receptionShown}
          onChange={(e) => patch(receptionKey, e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Giờ khai tiệc</Label>
        <Input
          type="time"
          value={parseWeddingTimeClockAndWeekday(partyShown).time || partyShown}
          onChange={(e) => patch(partyKey, e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4" />
          Địa chỉ {sideLabel}
        </Label>
        <Textarea
          value={addressShown}
          onChange={(e) => patch(addressKey, e.target.value)}
          placeholder="Địa chỉ tiệc hoặc nhà"
          rows={2}
          className="min-h-[4rem] resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Google Maps {sideLabel}</Label>
        <Input
          value={mapShown}
          onChange={(e) => patch(mapKey, e.target.value)}
          placeholder="https://maps.google.com/…"
          className="text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <WeddingTimelineEditor
          label={`Lịch trình ${sideLabel}`}
          value={timelineShown}
          onChange={(value) => patch(timelineKey, value)}
          hint="Mỗi dòng một mốc: chọn giờ và nhập nội dung bên cạnh."
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Phone className="h-4 w-4" />
          Liên hệ {sideLabel}
        </Label>
        <Input
          value={settings[contactKey]}
          onChange={(e) => patch(contactKey, e.target.value)}
          placeholder="090x xxx xxx"
          className="text-sm"
        />
      </div>

      {saving ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang lưu…
        </p>
      ) : null}
    </div>
  )
}
