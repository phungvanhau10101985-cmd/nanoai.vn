'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  hexesClose,
  mergeShopThemeColors,
  resolveShopThemeColors,
  SHOP_AUX_BG_SWATCHES,
  SHOP_AUX_CART_SWATCHES,
  SHOP_MAIN_COLOR_SWATCHES,
  themeFromAuxBackgroundSwatch,
  themeFromAuxCartSwatch,
  themeFromMainSwatch,
  type ResolvedShopThemeColors,
  type ShopThemeColorRole,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

type RoleField = {
  key: ShopThemeColorRole
  label: string
}

function SwatchGrid({
  swatches,
  selectedHex,
  onPick,
  disabled,
}: {
  swatches: Array<{ id: string; hex: string }>
  selectedHex: string
  onPick: (hex: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {swatches.map((s) => {
        const on = hexesClose(s.hex, selectedHex)
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            title={s.hex}
            aria-label={s.hex}
            aria-pressed={on}
            onClick={() => onPick(s.hex)}
            className={cn(
              'h-7 w-full rounded-md border shadow-sm transition',
              on ? 'ring-2 ring-offset-1 ring-foreground/80' : 'border-border/80 hover:scale-[1.04]',
              disabled && 'opacity-50'
            )}
            style={{ background: s.hex }}
          />
        )
      })}
    </div>
  )
}

function RoleColorRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (hex: string) => void
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1">
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{label}</span>
      <input
        value={value}
        disabled={disabled}
        maxLength={7}
        onChange={(e) => onChange(e.target.value)}
        className="w-[4.6rem] rounded border border-border/70 bg-muted/30 px-1 py-0.5 font-mono text-[10px] uppercase"
      />
    </label>
  )
}

export function PartnerWebsiteThemeColorPicker({
  t,
  theme,
  disabled,
  onLiveChange,
  saving,
}: {
  t: PartnerWebsiteCopy
  theme: PartnerWebsiteTheme
  disabled?: boolean
  onLiveChange: (next: PartnerWebsiteTheme) => void
  saving?: boolean
}) {
  const resolved = useMemo(() => resolveShopThemeColors(theme), [theme])
  const mainFields: RoleField[] = [
    { key: 'primaryColor', label: t.themeColorPrimary },
    { key: 'accentColor', label: t.themeColorAccent },
    { key: 'buyButtonColor', label: t.themeColorBuy },
    { key: 'cartButtonColor', label: t.themeColorCart },
  ]
  const auxFields: RoleField[] = [
    { key: 'backgroundColor', label: t.themeColorBackground },
    { key: 'textColor', label: t.themeColorText },
    { key: 'mutedColor', label: t.themeColorMuted },
    { key: 'surfaceColor', label: t.themeColorSurface },
  ]

  function patchRole(key: ShopThemeColorRole, hex: string) {
    onLiveChange(mergeShopThemeColors(theme, { [key]: hex }))
  }

  return (
    <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-none text-violet-950 dark:text-violet-100">
            {t.themeColorTitle}
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t.themeColorHint}</p>
        </div>
        {saving ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t.themeColorSaving}
          </span>
        ) : null}
      </div>

      <div
        className="overflow-hidden rounded-md border bg-white shadow-sm"
        aria-hidden
      >
        <div className="h-2" style={{ background: resolved.primaryColor }} />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5" style={{ background: resolved.backgroundColor }}>
          <span className="text-[10px] font-bold" style={{ color: resolved.primaryColor }}>
            Aa
          </span>
          <div className="flex gap-1">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ background: resolved.cartButtonColor }}
            >
              {t.themeColorCart}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ background: resolved.buyButtonColor }}
            >
              {t.themeColorBuy}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold">{t.themeColorMainTitle}</p>
        <SwatchGrid
          swatches={SHOP_MAIN_COLOR_SWATCHES}
          selectedHex={resolved.primaryColor}
          disabled={disabled}
          onPick={(hex) => onLiveChange(themeFromMainSwatch(theme, hex))}
        />
        <div className="grid grid-cols-1 gap-1">
          {mainFields.map((f) => (
            <RoleColorRow
              key={f.key}
              label={f.label}
              value={resolved[f.key]}
              disabled={disabled}
              onChange={(hex) => patchRole(f.key, hex)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold">{t.themeColorAuxTitle}</p>
        <p className="text-[10px] text-muted-foreground">{t.themeColorAuxBgTitle}</p>
        <SwatchGrid
          swatches={SHOP_AUX_BG_SWATCHES}
          selectedHex={resolved.backgroundColor}
          disabled={disabled}
          onPick={(hex) => onLiveChange(themeFromAuxBackgroundSwatch(theme, hex))}
        />
        <p className="text-[10px] text-muted-foreground">{t.themeColorAuxCartTitle}</p>
        <SwatchGrid
          swatches={SHOP_AUX_CART_SWATCHES}
          selectedHex={resolved.cartButtonColor}
          disabled={disabled}
          onPick={(hex) => onLiveChange(themeFromAuxCartSwatch(theme, hex))}
        />
        <div className="grid grid-cols-1 gap-1">
          {auxFields.map((f) => (
            <RoleColorRow
              key={f.key}
              label={f.label}
              value={resolved[f.key]}
              disabled={disabled}
              onChange={(hex) => patchRole(f.key, hex)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export function useDebouncedThemeSave(
  partnerId: string,
  onSaved: (websiteTheme: PartnerWebsiteTheme) => void,
  onError: (message: string) => void
) {
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<PartnerWebsiteTheme | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function flush(theme: PartnerWebsiteTheme) {
    if (!partnerId) return
    setSaving(true)
    try {
      const colors: ResolvedShopThemeColors = resolveShopThemeColors(theme)
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_theme_colors', theme: colors }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: { theme?: PartnerWebsiteTheme }
        error?: string
      }
      if (!res.ok || !json.website?.theme) {
        onError(json.error || 'theme')
        return
      }
      onSaved(json.website.theme)
    } finally {
      setSaving(false)
    }
  }

  function schedule(theme: PartnerWebsiteTheme) {
    pendingRef.current = theme
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const next = pendingRef.current
      pendingRef.current = null
      if (next) void flush(next)
    }, 450)
  }

  return { saving, schedule, flush }
}
