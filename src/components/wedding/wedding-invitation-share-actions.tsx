'use client'

import { CalendarPlus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { bindWeddingButtonFill, type WeddingButtonColor } from '@/lib/wedding/wedding-button-colors'
import {
  buildWeddingGoogleCalendarUrl,
  buildZaloShareUrl,
  downloadWeddingIcsFile,
  type WeddingCalendarEventInput,
} from '@/lib/wedding/wedding-calendar-export'

type ShareTx = {
  addToGoogleCalendar: string
  downloadCalendarFile: string
  shareZalo: string
}

type Props = {
  calendar: WeddingCalendarEventInput
  shareUrl: string
  tx: ShareTx
  buttonClassName?: string
  buttonColor?: WeddingButtonColor
  className?: string
}

export function WeddingInvitationShareActions({
  calendar,
  shareUrl,
  tx,
  buttonClassName,
  buttonColor,
  className,
}: Props) {
  const googleUrl = buildWeddingGoogleCalendarUrl(calendar)
  const canExportCalendar = Boolean(googleUrl)
  const fill = buttonColor ? bindWeddingButtonFill(buttonColor) : null
  const buttonClass = cn(fill ? 'min-h-11 rounded-full border-2 font-semibold [&_svg]:text-current' : 'min-h-11 rounded-full', fill ? undefined : buttonClassName)

  if (!canExportCalendar && !shareUrl.trim()) return null

  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {googleUrl ? (
        <Button asChild variant="outline" size="sm" className={buttonClass} {...(fill ?? {})}>
          <a href={googleUrl} target="_blank" rel="noreferrer">
            <CalendarPlus className="mr-2 h-4 w-4" />
            {tx.addToGoogleCalendar}
          </a>
        </Button>
      ) : null}
      {canExportCalendar ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={buttonClass}
          {...(fill ?? {})}
          onClick={() => downloadWeddingIcsFile(calendar, 'wedding-invitation.ics')}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          {tx.downloadCalendarFile}
        </Button>
      ) : null}
      {shareUrl.trim() ? (
        <Button asChild variant="outline" size="sm" className={buttonClass} {...(fill ?? {})}>
          <a href={buildZaloShareUrl(shareUrl)} target="_blank" rel="noreferrer">
            <Share2 className="mr-2 h-4 w-4" />
            {tx.shareZalo}
          </a>
        </Button>
      ) : null}
    </div>
  )
}
