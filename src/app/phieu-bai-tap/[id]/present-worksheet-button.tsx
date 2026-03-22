'use client'

import { Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

export function PresentWorksheetButton({
  worksheetId,
  locale = 'vi',
  className,
}: {
  worksheetId: string
  locale?: WebLocale
  className?: string
}) {
  const dict = getDictionary(locale)
  const label = dict.classes.presentWorksheet

  const handleClick = () => {
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    window.open(
      `/giao-trinh/giao-vien?worksheetId=${encodeURIComponent(worksheetId)}&t=${Date.now()}`,
      `giao-vien-worksheet-${worksheetId}`,
      `width=${sw},height=${sh},scrollbars=yes,left=0,top=0`
    )
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={handleClick}
      className={cn(
        'gap-2 bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
        className
      )}
    >
      <Presentation className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  )
}
