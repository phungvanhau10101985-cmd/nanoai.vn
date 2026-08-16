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
import { ThemeColorConfirmPicker } from '@/components/partner-website/partner-website-confirm-color-picker'

type RoleField = {
  key: ShopThemeColorRole
  label: string
}

function SwatchGrid({
  swatches,
  selectedHex,
  onPick,
  disabled,
  compact = false,
}: {
  swatches: Array<{ id: string; hex: string }>
  selectedHex: string
  onPick: (hex: string) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <div className={cn('grid grid-cols-6', compact ? 'gap-1' : 'gap-1.5')}>
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
              'w-full rounded-md border shadow-sm transition',
              compact ? 'h-5' : 'h-7',
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
  okLabel,
  compact = false,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (hex: string) => void
  okLabel: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-border/60 bg-background',
        compact ? 'gap-1.5 px-1.5 py-0.5' : 'gap-2 px-2 py-1'
      )}
    >
      <ThemeColorConfirmPicker
        value={value}
        disabled={disabled}
        compact={compact}
        okLabel={okLabel}
        onConfirm={onChange}
      />
      <span className={cn('min-w-0 flex-1 truncate font-medium', compact ? 'text-[10px]' : 'text-[11px]')}>
        {label}
      </span>
      {compact ? null : (
        <span className="w-[4.6rem] truncate rounded border border-border/70 bg-muted/30 px-1 py-0.5 text-center font-mono text-[10px] uppercase text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  )
}

export function PartnerWebsiteThemeColorPicker({
  t,
  theme,
  disabled,
  onLiveChange,
  saving,
  compact = false,
  layout = 'stack',
}: {
  t: PartnerWebsiteCopy
  theme: PartnerWebsiteTheme
  disabled?: boolean
  onLiveChange: (next: PartnerWebsiteTheme) => void
  saving?: boolean
  compact?: boolean
  layout?: 'stack' | 'bar'
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

  if (layout === 'bar') {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-violet-200/80 bg-violet-50/70 px-2 py-1 dark:border-violet-900/40 dark:bg-violet-950/30">
        <span className="shrink-0 text-[10px] font-semibold text-violet-950 dark:text-violet-100">
          {t.themeColorTitle}
        </span>
        {saving ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {SHOP_MAIN_COLOR_SWATCHES.map((s) => {
            const on = hexesClose(s.hex, resolved.primaryColor)
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                title={s.hex}
                aria-label={s.hex}
                aria-pressed={on}
                onClick={() => onLiveChange(themeFromMainSwatch(theme, s.hex))}
                className={cn(
                  'h-5 w-5 shrink-0 rounded-sm border shadow-sm',
                  on ? 'ring-2 ring-offset-1 ring-foreground/80' : 'border-border/70 hover:scale-110',
                  disabled && 'opacity-50'
                )}
                style={{ background: s.hex }}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {mainFields.map((f) => (
            <div key={f.key} className="inline-flex items-center gap-1" title={f.label}>
              <ThemeColorConfirmPicker
                value={resolved[f.key]}
                disabled={disabled}
                compact
                okLabel={t.themeColorOk}
                onConfirm={(hex) => patchRole(f.key, hex)}
              />
              <span className="hidden text-[10px] text-muted-foreground lg:inline">{f.label}</span>
            </div>
          ))}
        </div>
        <details className="relative">
          <summary className="cursor-pointer list-none text-[10px] font-medium text-violet-800 dark:text-violet-200 [&::-webkit-details-marker]:hidden">
            {t.themeColorAuxTitle} ▾
          </summary>
          <div className="absolute left-0 top-full z-20 mt-1 w-56 space-y-1.5 rounded-md border bg-background p-2 shadow-lg">
            <p className="text-[10px] text-muted-foreground">{t.themeColorAuxBgTitle}</p>
            <SwatchGrid
              swatches={SHOP_AUX_BG_SWATCHES}
              selectedHex={resolved.backgroundColor}
              disabled={disabled}
              compact
              onPick={(hex) => onLiveChange(themeFromAuxBackgroundSwatch(theme, hex))}
            />
            <p className="text-[10px] text-muted-foreground">{t.themeColorAuxCartTitle}</p>
            <SwatchGrid
              swatches={SHOP_AUX_CART_SWATCHES}
              selectedHex={resolved.cartButtonColor}
              disabled={disabled}
              compact
              onPick={(hex) => onLiveChange(themeFromAuxCartSwatch(theme, hex))}
            />
            <div className="grid grid-cols-1 gap-0.5">
              {auxFields.map((f) => (
                <RoleColorRow
                  key={f.key}
                  label={f.label}
                  value={resolved[f.key]}
                  disabled={disabled}
                  compact
                  okLabel={t.themeColorOk}
                  onChange={(hex) => patchRole(f.key, hex)}
                />
              ))}
            </div>
          </div>
        </details>
      </div>
    )
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-violet-200 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20',
        compact ? 'space-y-1.5 p-1.5' : 'space-y-2 p-2.5'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'font-semibold leading-none text-violet-950 dark:text-violet-100',
              compact ? 'text-[11px]' : 'text-[13px]'
            )}
          >
            {t.themeColorTitle}
          </p>
          {compact ? null : (
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t.themeColorHint}</p>
          )}
        </div>
        {saving ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t.themeColorSaving}
          </span>
        ) : null}
      </div>

      {compact ? null : (
        <div className="overflow-hidden rounded-md border bg-white shadow-sm" aria-hidden>
          <div className="h-2" style={{ background: resolved.primaryColor }} />
          <div
            className="flex items-center justify-between gap-2 px-2 py-1.5"
            style={{ background: resolved.backgroundColor }}
          >
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
      )}

      <div className={cn(compact ? 'space-y-1' : 'space-y-1.5')}>
        <p className={cn('font-semibold', compact ? 'text-[10px]' : 'text-[11px]')}>{t.themeColorMainTitle}</p>
        <SwatchGrid
          swatches={SHOP_MAIN_COLOR_SWATCHES}
          selectedHex={resolved.primaryColor}
          disabled={disabled}
          compact={compact}
          onPick={(hex) => onLiveChange(themeFromMainSwatch(theme, hex))}
        />
        <div className="grid grid-cols-1 gap-0.5">
          {mainFields.map((f) => (
            <RoleColorRow
              key={f.key}
              label={f.label}
              value={resolved[f.key]}
              disabled={disabled}
              compact={compact}
              okLabel={t.themeColorOk}
              onChange={(hex) => patchRole(f.key, hex)}
            />
          ))}
        </div>
      </div>

      {compact ? (
        <details className="space-y-1 rounded-md border border-violet-200/70 bg-background/60 px-1.5 py-1 dark:border-violet-900/40">
          <summary className="cursor-pointer text-[10px] font-semibold">{t.themeColorAuxTitle}</summary>
          <div className="mt-1 space-y-1">
            <p className="text-[10px] text-muted-foreground">{t.themeColorAuxBgTitle}</p>
            <SwatchGrid
              swatches={SHOP_AUX_BG_SWATCHES}
              selectedHex={resolved.backgroundColor}
              disabled={disabled}
              compact
              onPick={(hex) => onLiveChange(themeFromAuxBackgroundSwatch(theme, hex))}
            />
            <p className="text-[10px] text-muted-foreground">{t.themeColorAuxCartTitle}</p>
            <SwatchGrid
              swatches={SHOP_AUX_CART_SWATCHES}
              selectedHex={resolved.cartButtonColor}
              disabled={disabled}
              compact
              onPick={(hex) => onLiveChange(themeFromAuxCartSwatch(theme, hex))}
            />
            <div className="grid grid-cols-1 gap-0.5">
              {auxFields.map((f) => (
                <RoleColorRow
                  key={f.key}
                  label={f.label}
                  value={resolved[f.key]}
                  disabled={disabled}
                  compact
                  okLabel={t.themeColorOk}
                  onChange={(hex) => patchRole(f.key, hex)}
                />
              ))}
            </div>
          </div>
        </details>
      ) : (
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
                okLabel={t.themeColorOk}
                onChange={(hex) => patchRole(f.key, hex)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function useDebouncedThemeSave(
  partnerId: string,
  onSaved: (
    websiteTheme: PartnerWebsiteTheme,
    extras?: { htmlSource?: string | null; project?: unknown }
  ) => void,
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
        website?: {
          theme?: PartnerWebsiteTheme
          htmlSource?: string | null
          project?: unknown
        }
        error?: string
      }
      if (!res.ok || !json.website?.theme) {
        onError(json.error || 'theme')
        return
      }
      onSaved(json.website.theme, {
        htmlSource: json.website.htmlSource,
        project: json.website.project,
      })
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
