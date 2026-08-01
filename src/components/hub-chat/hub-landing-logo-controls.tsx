'use client'

import { useRef } from 'react'
import { ImagePlus, Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<
  WebLocale,
  {
    logoLabel: string
    logoHint: string
    logoBriefPlaceholder: string
    logoBriefGuide: string
    logoUploadBtn: string
    logoRemoveBtn: string
    logoGenerateBtn: string
  }
> = {
  vi: {
    logoLabel: 'Logo header landing',
    logoHint: 'Bắt buộc trước khi tạo ảnh landing — AI đặt logo vào header trong **một ảnh dọc đầy đủ** (1:4).',
    logoBriefPlaceholder: 'Prompt tạo logo — wordmark, icon, màu, phong cách…',
    logoBriefGuide:
      'VD: Wordmark «Bloom Studio» · chữ sans-serif hiện đại · icon lá xanh cách điệu · nền trong, xanh #2D6A4F + cam #F97316. Để trống = dùng tên thương hiệu từ brief.',
    logoUploadBtn: 'Tải logo',
    logoRemoveBtn: 'Xóa logo',
    logoGenerateBtn: 'Tạo logo AI',
  },
  en: {
    logoLabel: 'Landing header logo',
    logoHint: 'Required before generating the landing — AI places the logo in the header of **one full vertical image** (1:4).',
    logoBriefPlaceholder: 'Logo generation prompt — wordmark, icon, colors, style…',
    logoBriefGuide:
      'e.g. Wordmark «Bloom Studio» · modern sans-serif · stylized leaf icon · transparent bg, green #2D6A4F + orange #F97316. Leave blank to use brand name from brief.',
    logoUploadBtn: 'Upload logo',
    logoRemoveBtn: 'Remove logo',
    logoGenerateBtn: 'Generate logo',
  },
  zh: {
    logoLabel: '落地页页眉 Logo',
    logoHint: '生成落地页图前必填 — AI 将 logo 放入 **一张完整纵向图**（1:4）的页眉。',
    logoBriefPlaceholder: 'Logo 生成提示 — 字标、图标、配色、风格…',
    logoBriefGuide:
      '例：字标「Bloom Studio」· 现代无衬线 · stylized 叶形图标 · 透明底，绿 #2D6A4F + 橙 #F97316。留空则使用简报中的品牌名。',
    logoUploadBtn: '上传 Logo',
    logoRemoveBtn: '删除 Logo',
    logoGenerateBtn: 'AI 生成 Logo',
  },
  ja: {
    logoLabel: 'ランディングヘッダーロゴ',
    logoHint: 'ランディング画像生成前に必須 — **縦1枚のフルLP**（1:4）のヘッダーにロゴを配置。',
    logoBriefPlaceholder: 'ロゴ生成プロンプト — ワードマーク、アイコン、配色、スタイル…',
    logoBriefGuide:
      '例：ワードマーク「Bloom Studio」· モダンサンセリフ · stylized 葉アイコン · 透過背景、緑 #2D6A4F + オレンジ #F97316。空欄 = ブリーフのブランド名。',
    logoUploadBtn: 'ロゴをアップロード',
    logoRemoveBtn: 'ロゴを削除',
    logoGenerateBtn: 'AI でロゴ生成',
  },
  ko: {
    logoLabel: '랜딩 헤더 로고',
    logoHint: '랜딩 이미지 생성 전 필수 — **세로 전체 LP 1장**(1:4) 헤더에 로고 배치.',
    logoBriefPlaceholder: '로고 생성 프롬프트 — 워드마크, 아이콘, 색상, 스타일…',
    logoBriefGuide:
      '예: 워드마크 «Bloom Studio» · 모던 산세리프 · stylized 잎 아이콘 · 투명 배경, 그린 #2D6A4F + 오렌지 #F97316. 비우면 brief의 브랜드명 사용.',
    logoUploadBtn: '로고 업로드',
    logoRemoveBtn: '로고 삭제',
    logoGenerateBtn: 'AI 로고 생성',
  },
}

export function HubLandingLogoControls({
  locale,
  logoUrl,
  logoBrief,
  busy,
  onLogoBriefChange,
  onUploadLogo,
  onRemoveLogo,
  onGenerateLogo,
}: {
  locale: WebLocale
  logoUrl?: string | null
  logoBrief: string
  busy: boolean
  onLogoBriefChange: (value: string) => void
  onUploadLogo?: (files: FileList) => void | Promise<void>
  onRemoveLogo?: () => void | Promise<void>
  onGenerateLogo?: (brief: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-indigo-200/70 bg-white/90 p-3 dark:border-indigo-900/40 dark:bg-slate-900/70">
      <div>
        <p className="text-xs font-medium text-foreground">{t.logoLabel}</p>
        <p className="text-[11px] text-muted-foreground">{t.logoHint}</p>
      </div>

      {logoUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            className="h-10 max-w-[140px] rounded border bg-white object-contain p-1"
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onRemoveLogo?.()}>
            {t.logoRemoveBtn}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={logoBrief}
            onChange={(e) => onLogoBriefChange(e.target.value)}
            placeholder={t.logoBriefPlaceholder}
            disabled={busy}
            className="h-9 text-sm"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">{t.logoBriefGuide}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files?.length) void onUploadLogo?.(files)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !onUploadLogo}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1 h-3.5 w-3.5" />}
            {t.logoUploadBtn}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !onGenerateLogo}
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => void onGenerateLogo?.(logoBrief.trim())}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {t.logoGenerateBtn}
          </Button>
        </div>
      </div>
    </div>
  )
}
