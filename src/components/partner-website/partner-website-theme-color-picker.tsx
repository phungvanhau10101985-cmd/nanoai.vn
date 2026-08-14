'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  hexesClose,
  isHexColor,
  mergeShopThemeColors,
  normalizeHexColor,
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

type Hsv = { h: number; s: number; v: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHexColor(hex, '#000000')
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360 / 60
  const c = v * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hh < 1) {
    rp = c
    gp = x
  } else if (hh < 2) {
    rp = x
    gp = c
  } else if (hh < 3) {
    gp = c
    bp = x
  } else if (hh < 4) {
    gp = x
    bp = c
  } else if (hh < 5) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 }
}

function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsv(r, g, b)
}

function hsvToHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(r, g, b)
}

function ThemeColorConfirmPicker({
  value,
  disabled,
  compact = false,
  okLabel,
  onConfirm,
}: {
  value: string
  disabled?: boolean
  compact?: boolean
  okLabel: string
  onConfirm: (hex: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const validDraft = isHexColor(draft) ? normalizeHexColor(draft, value) : normalizeHexColor(value, '#000000')
  const hsv = hexToHsv(validDraft)
  const rgb = hexToRgb(validDraft)

  function openPicker() {
    if (disabled) return
    setDraft(normalizeHexColor(value, value))
    setOpen(true)
  }

  function closeWithoutSave() {
    setOpen(false)
    setDraft(value)
  }

  function confirm() {
    const next = normalizeHexColor(draft, value)
    onConfirm(next)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeWithoutSave()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithoutSave()
      if (e.key === 'Enter') confirm()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, draft, value])

  function applyHsv(next: Hsv) {
    setDraft(hsvToHex(next))
  }

  function bindDrag(
    el: HTMLDivElement | null,
    read: (rect: DOMRect, x: number, y: number) => void
  ) {
    if (!el) return
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      read(rect, ev.clientX, ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={value}
        aria-expanded={open}
        onClick={() => (open ? closeWithoutSave() : openPicker())}
        className={cn(
          'cursor-pointer rounded border border-border shadow-sm',
          compact ? 'h-5 w-6' : 'h-7 w-8',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        style={{ background: value }}
      />
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-[16.5rem] rounded-md border bg-background p-2 shadow-lg">
          <div
            ref={svRef}
            className="relative h-28 w-full cursor-crosshair overflow-hidden rounded-sm border"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              const apply = (rect: DOMRect, x: number, y: number) => {
                applyHsv({
                  h: hsv.h,
                  s: clamp((x - rect.left) / rect.width, 0, 1),
                  v: clamp(1 - (y - rect.top) / rect.height, 0, 1),
                })
              }
              apply(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY)
              bindDrag(svRef.current, apply)
            }}
          >
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: draft }}
            />
          </div>
          <div
            ref={hueRef}
            className="relative mt-2 h-3 w-full cursor-pointer rounded-sm border"
            style={{
              background:
                'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              const apply = (rect: DOMRect, x: number) => {
                applyHsv({
                  h: clamp(((x - rect.left) / rect.width) * 360, 0, 359.9),
                  s: hsv.s,
                  v: hsv.v,
                })
              }
              apply(e.currentTarget.getBoundingClientRect(), e.clientX)
              bindDrag(hueRef.current, (rect, x) => apply(rect, x))
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
            />
          </div>
          <div className="mt-2 flex items-end gap-1">
            <label className="min-w-0 flex-1">
              <span className="block text-[9px] text-muted-foreground">HEX</span>
              <input
                value={draft}
                maxLength={7}
                onChange={(e) => {
                  const raw = e.target.value
                  setDraft(raw)
                  if (isHexColor(raw)) setDraft(normalizeHexColor(raw, draft))
                }}
                className="h-7 w-full rounded border border-border/70 bg-muted/30 px-1 font-mono text-[10px] uppercase"
              />
            </label>
            {(
              [
                ['R', rgb.r],
                ['G', rgb.g],
                ['B', rgb.b],
              ] as const
            ).map(([ch, n]) => (
              <label key={ch} className="w-9">
                <span className="block text-[9px] text-muted-foreground">{ch}</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={n}
                  onChange={(e) => {
                    const next = clamp(Number(e.target.value) || 0, 0, 255)
                    const cur = hexToRgb(validDraft)
                    const rgbNext = { ...cur, [ch.toLowerCase()]: next }
                    setDraft(rgbToHex(rgbNext.r, rgbNext.g, rgbNext.b))
                  }}
                  className="h-7 w-full rounded border border-border/70 bg-muted/30 px-0.5 text-center font-mono text-[10px]"
                />
              </label>
            ))}
            <button
              type="button"
              className="h-7 shrink-0 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
              onClick={confirm}
            >
              {okLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
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
        <input
          value={value}
          disabled={disabled}
          maxLength={7}
          onChange={(e) => {
            const raw = e.target.value
            if (isHexColor(raw)) onChange(normalizeHexColor(raw, value))
          }}
          className="w-[4.6rem] rounded border border-border/70 bg-muted/30 px-1 py-0.5 font-mono text-[10px] uppercase"
        />
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
