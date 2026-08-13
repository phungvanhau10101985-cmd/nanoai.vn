'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  getPartnerBirthdayPromoSettings,
  savePartnerBirthdayPromoSettings,
} from '@/app/dashboard/messaging/actions'
import { Cake, Loader2 } from 'lucide-react'

type TAi = Dictionary['partnerMessagingAi']

export function PartnerBirthdayPromoSettingsCard({
  partnerId,
  t,
  saveOkMessage,
}: {
  partnerId: string
  t: TAi
  saveOkMessage: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [bdayEnabled, setBdayEnabled] = useState(false)
  const [bdayDiscountPct, setBdayDiscountPct] = useState(10)
  const [bdayDaysMax, setBdayDaysMax] = useState(7)
  const [bdayDaysMin, setBdayDaysMin] = useState(1)
  const bdayPersistRef = useRef({
    enabled: false,
    discountPct: 10,
    daysMax: 7,
    daysMin: 1,
  })
  const bdayDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyFromServer = useCallback(
    (bs: {
      enabled?: boolean
      discount_percent?: number
      offer_days_before_max?: number
      offer_days_before_min?: number
    }) => {
      if (typeof bs.enabled === 'boolean') setBdayEnabled(bs.enabled)
      if (bs.discount_percent != null) {
        setBdayDiscountPct(Math.max(0, Math.min(100, Number(bs.discount_percent) || 10)))
      }
      if (bs.offer_days_before_max != null) {
        setBdayDaysMax(Math.max(1, Math.min(120, Number(bs.offer_days_before_max) || 7)))
      }
      if (bs.offer_days_before_min != null) {
        setBdayDaysMin(Math.max(1, Math.min(120, Number(bs.offer_days_before_min) || 1)))
      }
    },
    []
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPartnerBirthdayPromoSettings(partnerId)
      if (!('error' in res) && res.settings) {
        applyFromServer(res.settings)
      }
    } finally {
      setLoading(false)
    }
  }, [applyFromServer, partnerId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    bdayPersistRef.current = {
      enabled: bdayEnabled,
      discountPct: bdayDiscountPct,
      daysMax: bdayDaysMax,
      daysMin: bdayDaysMin,
    }
  }, [bdayEnabled, bdayDiscountPct, bdayDaysMax, bdayDaysMin])

  useEffect(() => {
    return () => {
      if (bdayDebounceTimerRef.current) clearTimeout(bdayDebounceTimerRef.current)
    }
  }, [])

  const flushSave = useCallback(
    (payload: {
      enabled: boolean
      discountPercent: number
      offerDaysBeforeMax: number
      offerDaysBeforeMin: number
    }) => {
      void (async () => {
        try {
          const res = await savePartnerBirthdayPromoSettings(partnerId, payload)
          if ('error' in res && res.error) {
            toast({ title: res.error, variant: 'destructive' })
            await load()
            return
          }
          const verify = await getPartnerBirthdayPromoSettings(partnerId)
          if (!('error' in verify) && verify.settings) applyFromServer(verify.settings)
          toast({ title: saveOkMessage })
        } catch (e) {
          toast({
            title: e instanceof Error ? e.message : t.birthdayPromoSaveFailed,
            variant: 'destructive',
          })
          await load()
        }
      })()
    },
    [applyFromServer, load, partnerId, saveOkMessage, t.birthdayPromoSaveFailed, toast]
  )

  const scheduleDebouncedSave = useCallback(() => {
    if (bdayDebounceTimerRef.current) clearTimeout(bdayDebounceTimerRef.current)
    bdayDebounceTimerRef.current = setTimeout(() => {
      bdayDebounceTimerRef.current = null
      const s = bdayPersistRef.current
      flushSave({
        enabled: s.enabled,
        discountPercent: s.discountPct,
        offerDaysBeforeMax: s.daysMax,
        offerDaysBeforeMin: s.daysMin,
      })
    }, 450)
  }, [flushSave])

  if (loading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          …
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-violet-200/80 bg-violet-50/40 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="h-4 w-4 text-violet-600" aria-hidden />
          {t.birthdayPromoSettingsTitle}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">{t.birthdayPromoSettingsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground max-w-xl">{t.birthdayPromoSettingsHint}</p>
          <Switch
            checked={bdayEnabled}
            onCheckedChange={(c) => {
              if (bdayDebounceTimerRef.current) {
                clearTimeout(bdayDebounceTimerRef.current)
                bdayDebounceTimerRef.current = null
              }
              setBdayEnabled(c)
              bdayPersistRef.current.enabled = c
              flushSave({
                enabled: c,
                discountPercent: bdayPersistRef.current.discountPct,
                offerDaysBeforeMax: bdayPersistRef.current.daysMax,
                offerDaysBeforeMin: bdayPersistRef.current.daysMin,
              })
            }}
            aria-label={t.birthdayEnableAria}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bday-pct-settings">{t.birthdayDiscountLabel}</Label>
            <Input
              id="bday-pct-settings"
              type="number"
              min={0}
              max={100}
              value={bdayDiscountPct}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)))
                setBdayDiscountPct(v)
                bdayPersistRef.current.discountPct = v
                scheduleDebouncedSave()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-max-settings">{t.birthdayDaysMaxLabel}</Label>
            <Input
              id="bday-max-settings"
              type="number"
              min={1}
              max={120}
              value={bdayDaysMax}
              onChange={(e) => {
                const v = Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 7)))
                setBdayDaysMax(v)
                bdayPersistRef.current.daysMax = v
                scheduleDebouncedSave()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-min-settings">{t.birthdayDaysMinLabel}</Label>
            <Input
              id="bday-min-settings"
              type="number"
              min={1}
              max={120}
              value={bdayDaysMin}
              onChange={(e) => {
                const v = Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 1)))
                setBdayDaysMin(v)
                bdayPersistRef.current.daysMin = v
                scheduleDebouncedSave()
              }}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{t.birthdayPromoAutoSaveHint}</p>
      </CardContent>
    </Card>
  )
}
