'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  STUDIO_BRAND_COLORS,
  normalizeStudioHexColor,
  resolveStudioBrandColor,
  type StudioColorRole,
  type StudioColorSelection,
} from '@/lib/hub-chat/studio-color-palette'
import {
  packagingPrintColorLabel,
  type PackagingPrintColor,
} from '@/lib/packaging/packaging-discovery-choices'
import { cn } from '@/lib/utils'

const COPY: Record<
  WebLocale,
  {
    selectHint: string
    roleHint: string
    selectedTitle: string
    primary: string
    secondary: string
    selectedCount: string
    confirm: string
    customHint: string
    customLabel: string
    customPlaceholder: string
    addCustom: string
    invalidHex: string
    duplicateHex: string
    needPrimary: string
  }
> = {
  vi: {
    selectHint: 'Chọn màu — sau đó gán Màu chính hoặc Màu phụ cho từng màu.',
    roleHint: 'Màu chính hiển thị nhiều trên giao diện; màu phụ dùng ít hơn (icon, viền, nhấn phụ).',
    selectedTitle: 'Màu đã chọn — gán vai trò',
    primary: 'Chính',
    secondary: 'Phụ',
    selectedCount: '{primary} chính · {secondary} phụ',
    confirm: 'Xác nhận bảng màu',
    customHint: 'Hoặc thêm mã HEX tùy chỉnh (vd: #FF5733) rồi bấm Thêm.',
    customLabel: 'Màu tùy chỉnh (HEX)',
    customPlaceholder: '#FF5733',
    addCustom: 'Thêm',
    invalidHex: 'Mã HEX không hợp lệ (vd: #FF5733)',
    duplicateHex: 'Màu này đã được chọn',
    needPrimary: 'Cần ít nhất 1 màu chính',
  },
  en: {
    selectHint: 'Pick colors — then assign Primary or Secondary role to each.',
    roleHint: 'Primary colors dominate the UI; secondary colors appear less (borders, icons, subtle accents).',
    selectedTitle: 'Selected — assign role',
    primary: 'Primary',
    secondary: 'Secondary',
    selectedCount: '{primary} primary · {secondary} secondary',
    confirm: 'Confirm palette',
    customHint: 'Or add a custom HEX code (e.g. #FF5733) and tap Add.',
    customLabel: 'Custom color (HEX)',
    customPlaceholder: '#FF5733',
    addCustom: 'Add',
    invalidHex: 'Invalid HEX code (e.g. #FF5733)',
    duplicateHex: 'This color is already selected',
    needPrimary: 'At least one primary color is required',
  },
  zh: {
    selectHint: '选择颜色 — 然后为每种颜色指定主色或辅色。',
    roleHint: '主色在界面中占主导；辅色较少出现（边框、图标、点缀）。',
    selectedTitle: '已选 — 指定角色',
    primary: '主色',
    secondary: '辅色',
    selectedCount: '{primary} 主 · {secondary} 辅',
    confirm: '确认配色',
    customHint: '或添加自定义 HEX（如 #FF5733）后点击添加。',
    customLabel: '自定义颜色 (HEX)',
    customPlaceholder: '#FF5733',
    addCustom: '添加',
    invalidHex: 'HEX 码无效（如 #FF5733）',
    duplicateHex: '该颜色已选择',
    needPrimary: '至少需要 1 个主色',
  },
  ja: {
    selectHint: '色を選択 — 各色にメイン/サブを割り当てます。',
    roleHint: 'メインカラーは UI の大部分、サブカラーは控えめ（枠線・アイコン等）。',
    selectedTitle: '選択済み — 役割を設定',
    primary: 'メイン',
    secondary: 'サブ',
    selectedCount: 'メイン {primary} · サブ {secondary}',
    confirm: '配色を確定',
    customHint: 'またはカスタム HEX（例 #FF5733）を追加してください。',
    customLabel: 'カスタム色 (HEX)',
    customPlaceholder: '#FF5733',
    addCustom: '追加',
    invalidHex: '無効な HEX コード（例 #FF5733）',
    duplicateHex: 'この色は既に選択されています',
    needPrimary: 'メインカラーを1色以上選択してください',
  },
  ko: {
    selectHint: '색 선택 — 각 색에 주색/보조색 역할을 지정하세요.',
    roleHint: '주색은 UI에서 많이, 보조색은 적게(테두리·아이콘·포인트) 사용됩니다.',
    selectedTitle: '선택됨 — 역할 지정',
    primary: '주색',
    secondary: '보조',
    selectedCount: '주 {primary} · 보조 {secondary}',
    confirm: '색상 확정',
    customHint: '또는 사용자 HEX(예: #FF5733)를 추가하세요.',
    customLabel: '사용자 색상 (HEX)',
    customPlaceholder: '#FF5733',
    addCustom: '추가',
    invalidHex: '잘못된 HEX 코드(예: #FF5733)',
    duplicateHex: '이미 선택된 색상입니다',
    needPrimary: '주색을 최소 1개 선택하세요',
  },
}

function ColorSwatchButton({
  color,
  locale,
  selected,
  busy,
  onToggle,
}: {
  color: PackagingPrintColor
  locale: WebLocale
  selected: boolean
  busy: boolean
  onToggle: (key: string) => void
}) {
  const label = formatStudioExampleLabel(locale, packagingPrintColorLabel(color, locale))
  const lightSwatch =
    color.key === 'white' ||
    color.key === 'cream' ||
    color.key === 'yellow' ||
    color.key === 'beige'

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={selected}
      aria-label={`${label} ${color.hex}`}
      onClick={() => onToggle(color.key)}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-50',
        selected
          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-400 dark:border-violet-500 dark:bg-violet-950/40'
          : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900/40'
      )}
    >
      <span
        className={cn(
          'relative h-7 w-7 shrink-0 rounded-full border',
          lightSwatch ? 'border-slate-300' : 'border-transparent'
        )}
        style={{ backgroundColor: color.hex }}
      >
        {selected ? (
          <Check
            className={cn(
              'absolute inset-0 m-auto h-3.5 w-3.5',
              lightSwatch ? 'text-violet-700' : 'text-white drop-shadow-sm'
            )}
          />
        ) : null}
      </span>
      <span className="min-w-0 leading-snug">
        <span className="block truncate">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{color.hex}</span>
      </span>
    </button>
  )
}

function RoleToggle({
  role,
  busy,
  labels,
  onChange,
}: {
  role: StudioColorRole
  busy: boolean
  labels: { primary: string; secondary: string }
  onChange: (role: StudioColorRole) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        disabled={busy}
        aria-pressed={role === 'primary'}
        onClick={() => onChange('primary')}
        className={cn(
          'px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
          role === 'primary'
            ? 'bg-violet-600 text-white'
            : 'bg-white text-muted-foreground hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800'
        )}
      >
        {labels.primary}
      </button>
      <button
        type="button"
        disabled={busy}
        aria-pressed={role === 'secondary'}
        onClick={() => onChange('secondary')}
        className={cn(
          'border-l border-slate-200 px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 dark:border-slate-700',
          role === 'secondary'
            ? 'bg-slate-600 text-white'
            : 'bg-white text-muted-foreground hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800'
        )}
      >
        {labels.secondary}
      </button>
    </div>
  )
}

export function HubColorPalettePicker({
  locale,
  title,
  hint,
  busy,
  onConfirm,
}: {
  locale: WebLocale
  title: string
  hint: string
  busy: boolean
  onConfirm: (selection: StudioColorSelection[]) => void | Promise<void>
}) {
  const t = COPY[locale]
  const [selected, setSelected] = useState<StudioColorSelection[]>([])
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  const selectedKeys = useMemo(() => selected.map((item) => item.key), [selected])
  const primaryCount = selected.filter((item) => item.role === 'primary').length
  const secondaryCount = selected.filter((item) => item.role === 'secondary').length
  const canConfirm = selected.length > 0 && primaryCount > 0

  const defaultRoleForNewColor = useCallback((): StudioColorRole => {
    return primaryCount === 0 ? 'primary' : 'secondary'
  }, [primaryCount])

  const toggleColor = useCallback(
    (key: string) => {
      setSelected((prev) => {
        if (prev.some((item) => item.key === key)) {
          return prev.filter((item) => item.key !== key)
        }
        const hasPrimary = prev.some((item) => item.role === 'primary')
        return [...prev, { key, role: hasPrimary ? 'secondary' : 'primary' }]
      })
    },
    []
  )

  const setColorRole = useCallback((key: string, role: StudioColorRole) => {
    setSelected((prev) => prev.map((item) => (item.key === key ? { ...item, role } : item)))
  }, [])

  const addCustomColor = useCallback(() => {
    const hex = normalizeStudioHexColor(customInput)
    if (!hex) {
      setCustomError(t.invalidHex)
      return
    }
    const customKey = `custom:${hex}`
    if (selectedKeys.includes(customKey)) {
      setCustomError(t.duplicateHex)
      return
    }
    const presetDup = STUDIO_BRAND_COLORS.some(
      (c) => c.hex.toUpperCase() === hex && selectedKeys.includes(c.key)
    )
    if (presetDup) {
      setCustomError(t.duplicateHex)
      return
    }
    setCustomError(null)
    setSelected((prev) => [...prev, { key: customKey, role: defaultRoleForNewColor() }])
    setCustomInput('')
  }, [customInput, defaultRoleForNewColor, selectedKeys, t.duplicateHex, t.invalidHex])

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{t.selectHint}</p>
      <p className="mt-1 text-[11px] text-violet-800/80 dark:text-violet-200/80">{t.roleHint}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_BRAND_COLORS.map((color) => (
          <ColorSwatchButton
            key={color.key}
            color={color}
            locale={locale}
            selected={selectedKeys.includes(color.key)}
            busy={busy}
            onToggle={toggleColor}
          />
        ))}
      </div>

      {selected.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-lg border border-violet-200/80 bg-white/70 p-2.5 dark:border-violet-800/60 dark:bg-slate-950/30">
          <p className="text-[11px] font-semibold text-violet-900 dark:text-violet-100">{t.selectedTitle}</p>
          {selected.map((item) => {
            const color = resolveStudioBrandColor(item.key)
            if (!color) return null
            const label = formatStudioExampleLabel(locale, packagingPrintColorLabel(color, locale))
            const lightSwatch =
              color.key === 'white' ||
              color.key === 'cream' ||
              color.key === 'yellow' ||
              color.key === 'beige'
            return (
              <div
                key={item.key}
                className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-full border',
                      lightSwatch ? 'border-slate-300' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="min-w-0 text-xs">
                    <span className="block truncate font-medium">{label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{color.hex}</span>
                  </span>
                </div>
                <RoleToggle
                  role={item.role}
                  busy={busy}
                  labels={{ primary: t.primary, secondary: t.secondary }}
                  onChange={(role) => setColorRole(item.key, role)}
                />
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="mt-3 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">{t.customLabel}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value)
              setCustomError(null)
            }}
            placeholder={t.customPlaceholder}
            disabled={busy}
            className="h-9 font-mono text-sm sm:max-w-[160px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomColor()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !customInput.trim()}
            onClick={addCustomColor}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t.addCustom}
          </Button>
        </div>
        {customError ? <p className="text-[11px] text-red-600 dark:text-red-400">{customError}</p> : null}
        <p className="text-[11px] text-muted-foreground">{t.customHint}</p>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.length > 0
            ? t.selectedCount
                .replace('{primary}', String(primaryCount))
                .replace('{secondary}', String(secondaryCount))
            : t.selectHint}
        </p>
        <Button
          type="button"
          size="sm"
          className="bg-violet-600 hover:bg-violet-700"
          disabled={busy || !canConfirm}
          onClick={() => void onConfirm(selected)}
        >
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          {t.confirm}
        </Button>
      </div>
      {selected.length > 0 && primaryCount === 0 ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{t.needPrimary}</p>
      ) : null}
    </div>
  )
}
