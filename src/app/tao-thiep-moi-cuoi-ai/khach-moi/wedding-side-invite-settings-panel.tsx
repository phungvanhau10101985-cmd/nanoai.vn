'use client'

import { Loader2, MapPin, Phone } from 'lucide-react'
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
}

function sideMeta(side: Side, card: WeddingCard | null) {
  return side === 'groom'
    ? {
        sideLabel: 'nhà trai',
        hometown: card?.groomHometown,
        parents: card?.groomParents,
        prefix: 'groomInvite' as const,
      }
    : {
        sideLabel: 'nhà gái',
        hometown: card?.brideHometown,
        parents: card?.brideParents,
        prefix: 'brideInvite' as const,
      }
}

function fieldKey(prefix: 'groomInvite' | 'brideInvite', name: string): keyof WeddingSideInviteSettings {
  return `${prefix}${name}` as keyof WeddingSideInviteSettings
}

export function WeddingSideInviteSettingsPanel({ side, card, settings, saving, onChange }: Props) {
  const meta = sideMeta(side, card)
  const p = meta.prefix

  const patch = (field: keyof WeddingSideInviteSettings, value: string) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Ngày tiệc {meta.sideLabel}</Label>
        <Input
          type="date"
          value={settings[fieldKey(p, 'WeddingDate')]}
          onChange={(e) => patch(fieldKey(p, 'WeddingDate'), e.target.value)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {card?.weddingDate ? `Mặc định thiệp chính: ${card.weddingDate}` : 'Để trống dùng ngày cưới thiệp chính.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Giờ đón khách {meta.sideLabel}</Label>
        <Input
          type="time"
          value={parseWeddingTimeClockAndWeekday(settings[fieldKey(p, 'ReceptionTime')]).time}
          onChange={(e) => patch(fieldKey(p, 'ReceptionTime'), e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Giờ khai tiệc {meta.sideLabel}</Label>
        <Input
          type="time"
          value={parseWeddingTimeClockAndWeekday(settings[fieldKey(p, 'PartyStartTime')]).time}
          onChange={(e) => patch(fieldKey(p, 'PartyStartTime'), e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4" />
          Địa chỉ trên thiệp {meta.sideLabel}
        </Label>
        <Textarea
          value={settings[fieldKey(p, 'Address')]}
          onChange={(e) => patch(fieldKey(p, 'Address'), e.target.value)}
          placeholder={meta.hometown?.trim() || 'Nhập địa chỉ tiệc / nhà…'}
          rows={2}
          className="min-h-[4rem] resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Link Google Maps {meta.sideLabel}</Label>
        <Input
          value={settings[fieldKey(p, 'MapUrl')]}
          onChange={(e) => patch(fieldKey(p, 'MapUrl'), e.target.value)}
          placeholder="https://maps.google.com/…"
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Lời mời / kính mời {meta.sideLabel}</Label>
        <Textarea
          value={settings[fieldKey(p, 'Text')]}
          onChange={(e) => patch(fieldKey(p, 'Text'), e.target.value)}
          placeholder={card?.invitationText || 'Trân trọng kính mời…'}
          rows={3}
          className="resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Lời mời tiếng Anh (tuỳ chọn)</Label>
        <Textarea
          value={settings[fieldKey(p, 'TextEn')]}
          onChange={(e) => patch(fieldKey(p, 'TextEn'), e.target.value)}
          placeholder={card?.invitationTextEn || 'Cordially invite…'}
          rows={2}
          className="resize-y text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <WeddingTimelineEditor
          label={`Lịch trình chi tiết ${meta.sideLabel}`}
          value={settings[fieldKey(p, 'EventTimeline')]}
          onChange={(v) => patch(fieldKey(p, 'EventTimeline'), v)}
          hint="Mỗi dòng một mốc: chọn giờ và nhập nội dung bên cạnh (có thể thêm ghi chú sau dấu « - »)."
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Dress code / lưu ý {meta.sideLabel}</Label>
        <Textarea
          value={settings[fieldKey(p, 'DressCode')]}
          onChange={(e) => patch(fieldKey(p, 'DressCode'), e.target.value)}
          placeholder={card?.dressCode || 'Trang phục lịch sự…'}
          rows={2}
          className="resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Phone className="h-4 w-4" />
          Liên hệ / hotline {meta.sideLabel}
        </Label>
        <Input
          value={settings[fieldKey(p, 'Contact')]}
          onChange={(e) => patch(fieldKey(p, 'Contact'), e.target.value)}
          placeholder="090x xxx xxx · Zalo …"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Bố mẹ hiển thị trên thiệp cá nhân: {meta.parents?.trim() || '—'} (sửa ở «Nhập thông tin cưới»)
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Ảnh bìa / nền khối mời (URL)</Label>
        <Input
          value={settings[fieldKey(p, 'CoverImageUrl')]}
          onChange={(e) => patch(fieldKey(p, 'CoverImageUrl'), e.target.value)}
          placeholder="https://… (để trống dùng ảnh thiệp chính)"
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Lời mời riêng mặc định (khi thêm khách mới)</Label>
        <Textarea
          value={settings[fieldKey(p, 'DefaultPersonalMessage')]}
          onChange={(e) => patch(fieldKey(p, 'DefaultPersonalMessage'), e.target.value)}
          placeholder="Lời mời gợi ý điền sẵn vào cột «Lời mời riêng»…"
          rows={2}
          className="resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-sm">Lời cảm ơn cuối thiệp {meta.sideLabel}</Label>
        <Textarea
          value={settings[fieldKey(p, 'ThankYouText')]}
          onChange={(e) => patch(fieldKey(p, 'ThankYouText'), e.target.value)}
          placeholder={card?.thankYouText || 'Cảm ơn quý khách…'}
          rows={2}
          className="resize-y text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-2">
        QR mừng cưới dùng STK thiệp chính — khách {meta.sideLabel} chỉ thấy QR bên {meta.sideLabel} trên link cá nhân.
      </p>

      {saving ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang lưu cài đặt…
        </p>
      ) : null}
    </div>
  )
}
