'use client'

import { CalendarPlus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  className?: string
}

export function WeddingInvitationShareActions({
  calendar,
  shareUrl,
  tx,
  buttonClassName,
  className,
}: Props) {
  const googleUrl = buildWeddingGoogleCalendarUrl(calendar)
  const canExportCalendar = Boolean(googleUrl)

  if (!canExportCalendar && !shareUrl.trim()) return null

  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {googleUrl ? (
        <Button asChild variant="outline" size="sm" className={cn('min-h-11 rounded-full', buttonClassName)}>
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
          className={cn('min-h-11 rounded-full', buttonClassName)}
          onClick={() => downloadWeddingIcsFile(calendar, 'wedding-invitation.ics')}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          {tx.downloadCalendarFile}
        </Button>
      ) : null}
      {shareUrl.trim() ? (
        <Button asChild variant="outline" size="sm" className={cn('min-h-11 rounded-full', buttonClassName)}>
          <a href={buildZaloShareUrl(shareUrl)} target="_blank" rel="noreferrer">
            <Share2 className="mr-2 h-4 w-4" />
            {tx.shareZalo}
          </a>
        </Button>
      ) : null}
    </div>
  )
}
