'use client'

import type { CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_ASPECT_RATIO_OPTIONS } from '@/lib/label-size-presets'
import {
  DEFAULT_PRODUCT_LABEL_SHAPE,
  DEFAULT_SEAL_STICKER_SHAPE,
  FLAT_STICKER_SHAPES,
  type FlatStickerShape,
} from '@/lib/packaging/product-label-step'

export type HubLabelAspectRatioPickerVariant = 'product_label' | 'seal_sticker'

const COPY: Record<
  WebLocale,
  Record<
    HubLabelAspectRatioPickerVariant,
    {
      ratioTitle: string
      shapeTitle: string
      hint: string
      shapes: Record<FlatStickerShape, string>
    }
  >
> = {
  vi: {
    product_label: {
      ratioTitle: 'Tỷ lệ khung nhãn dán',
      shapeTitle: 'Kiểu nhãn dán',
      hint: 'Chọn kiểu + tỷ lệ Gemini — nhập nội dung nhãn (tên SP, thành phần, HDSD…) ở ô chat bên dưới.',
      shapes: {
        round: 'Tròn',
        square: 'Vuông',
        rectangle: 'Chữ nhật',
        ellipse: 'Elip',
      },
    },
    seal_sticker: {
      ratioTitle: 'Tỷ lệ khung tem',
      shapeTitle: 'Kiểu tem niêm phong',
      hint: 'Chọn kiểu + tỷ lệ Gemini — nhập slogan/mô tả tem ở ô chat bên dưới. Logo đã duyệt sẽ được ghép tự động.',
      shapes: {
        round: 'Tròn',
        square: 'Vuông',
        rectangle: 'Chữ nhật',
        ellipse: 'Elip',
      },
    },
  },
  en: {
    product_label: {
      ratioTitle: 'Label aspect ratio',
      shapeTitle: 'Label shape',
      hint: 'Pick shape + Gemini ratio — enter label copy (product name, ingredients, usage…) in the chat box below.',
      shapes: {
        round: 'Round',
        square: 'Square',
        rectangle: 'Rectangle',
        ellipse: 'Ellipse',
      },
    },
    seal_sticker: {
      ratioTitle: 'Seal aspect ratio',
      shapeTitle: 'Seal shape',
      hint: 'Pick shape + Gemini ratio — describe the seal tagline in the chat box below. Approved logo is composited automatically.',
      shapes: {
        round: 'Round',
        square: 'Square',
        rectangle: 'Rectangle',
        ellipse: 'Ellipse',
      },
    },
  },
  zh: {
    product_label: {
      ratioTitle: '标签宽高比',
      shapeTitle: '标签形状',
      hint: '选择形状 + Gemini 比率 — 在下方聊天框输入标签内容（品名、成分、用法…）。',
      shapes: {
        round: '圆形',
        square: '方形',
        rectangle: '矩形',
        ellipse: '椭圆',
      },
    },
    seal_sticker: {
      ratioTitle: '封条宽高比',
      shapeTitle: '封条形状',
      hint: '选择形状 + Gemini 比率 — 在下方聊天框输入标语。已批准的 logo 会自动合成。',
      shapes: {
        round: '圆形',
        square: '方形',
        rectangle: '矩形',
        ellipse: '椭圆',
      },
    },
  },
  ja: {
    product_label: {
      ratioTitle: 'ラベルのアスペクト比',
      shapeTitle: 'ラベルの形',
      hint: '形状 + Gemini 比率を選択 — ラベル内容は下のチャット欄に入力。',
      shapes: {
        round: '円形',
        square: '正方形',
        rectangle: '長方形',
        ellipse: '楕円',
      },
    },
    seal_sticker: {
      ratioTitle: 'シールのアスペクト比',
      shapeTitle: '封緘シールの形',
      hint: '形状 + Gemini 比率を選択 — スローガンは下のチャット欄に入力。承認済みロゴは自動合成。',
      shapes: {
        round: '円形',
        square: '正方形',
        rectangle: '長方形',
        ellipse: '楕円',
      },
    },
  },
  ko: {
    product_label: {
      ratioTitle: '라벨 화면 비율',
      shapeTitle: '라벨 형태',
      hint: '형태 + Gemini 비율 선택 — 라벨 내용은 아래 채팅창에 입력하세요.',
      shapes: {
        round: '원형',
        square: '정사각형',
        rectangle: '직사각형',
        ellipse: '타원',
      },
    },
    seal_sticker: {
      ratioTitle: '스티커 화면 비율',
      shapeTitle: '봉인 스티커 형태',
      hint: '형태 + Gemini 비율 선택 — 슬로건은 아래 채팅창에 입력하세요. 승인된 로고는 자동 합성됩니다.',
      shapes: {
        round: '원형',
        square: '정사각형',
        rectangle: '직사각형',
        ellipse: '타원',
      },
    },
  },
}

function ratioPreviewStyle(ratio: string): CSSProperties {
  const [wRaw, hRaw] = ratio.split(':').map(Number)
  const w = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 1
  const h = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 1
  const max = 28
  if (w >= h) {
    return { width: max, height: Math.max(12, Math.round((max * h) / w)) }
  }
  return { width: Math.max(12, Math.round((max * w) / h)), height: max }
}

function shapePreviewStyle(shape: FlatStickerShape): CSSProperties {
  const base = { width: 28, height: 28 } as CSSProperties
  switch (shape) {
    case 'round':
      return { ...base, borderRadius: '9999px' }
    case 'square':
      return { ...base, borderRadius: 4 }
    case 'rectangle':
      return { width: 34, height: 22, borderRadius: 4 }
    case 'ellipse':
      return { width: 34, height: 22, borderRadius: '9999px' }
  }
}

export function HubLabelAspectRatioPicker({
  locale,
  variant = 'product_label',
  selectedRatio,
  selectedShape,
  busy,
  onSelectRatio,
  onSelectShape,
}: {
  locale: WebLocale
  variant?: HubLabelAspectRatioPickerVariant
  selectedRatio: string
  selectedShape: FlatStickerShape
  busy: boolean
  onSelectRatio: (ratio: string) => void | Promise<void>
  onSelectShape: (shape: FlatStickerShape) => void | Promise<void>
}) {
  const t = COPY[locale][variant]
  const defaultShape =
    variant === 'seal_sticker' ? DEFAULT_SEAL_STICKER_SHAPE : DEFAULT_PRODUCT_LABEL_SHAPE
  const activeShape = selectedShape || defaultShape

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{t.shapeTitle}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FLAT_STICKER_SHAPES.map((shape) => {
          const selected = shape === activeShape
          return (
            <Button
              key={shape}
              type="button"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              className={
                selected
                  ? 'h-auto min-h-11 justify-start gap-2 whitespace-normal bg-emerald-600 px-2.5 py-2 text-left text-xs hover:bg-emerald-700'
                  : 'h-auto min-h-11 justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-xs'
              }
              onClick={() => void onSelectShape(shape)}
            >
              <span
                aria-hidden
                className={`inline-block shrink-0 border ${selected ? 'border-emerald-100 bg-emerald-500/30' : 'border-emerald-300 bg-emerald-100/80 dark:border-emerald-700 dark:bg-emerald-900/40'}`}
                style={shapePreviewStyle(shape)}
              />
              {busy && selected ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
              <span className="font-medium">{t.shapes[shape]}</span>
            </Button>
          )
        })}
      </div>

      <p className="mt-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100">{t.ratioTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {GEMINI_ASPECT_RATIO_OPTIONS.map((option) => {
          const selected = option.value === selectedRatio
          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              disabled={busy}
              className={
                selected
                  ? 'h-auto min-h-11 justify-start gap-2 whitespace-normal bg-emerald-600 px-2.5 py-2 text-left text-xs hover:bg-emerald-700'
                  : 'h-auto min-h-11 justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-xs'
              }
              onClick={() => void onSelectRatio(option.value)}
            >
              <span
                aria-hidden
                className={`inline-block shrink-0 rounded-sm border ${selected ? 'border-emerald-100 bg-emerald-500/30' : 'border-emerald-300 bg-emerald-100/80 dark:border-emerald-700 dark:bg-emerald-900/40'}`}
                style={ratioPreviewStyle(option.value)}
              />
              {busy && selected ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
              <span className="font-medium">{option.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
