'use client'

import { useCallback, useState } from 'react'
import { Link2, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'

const COPY: Record<
  WebLocale,
  {
    share: string
    dialogTitle: string
    dialogDescription: string
    copyLink: string
    linkCopied: string
    linkFailed: string
    exporting: string
    linkRecommended: string
    imageNote: string
  }
> = {
  vi: {
    share: 'Chia sẻ preview',
    dialogTitle: 'Chia sẻ preview landing (một ảnh dọc)',
    dialogDescription:
      'Tạo link xem trước ảnh landing đầy đủ — một ảnh dọc 1:4 (Hero → CTA).',
    copyLink: 'Sao chép link xem trước',
    linkCopied: 'Đã sao chép link preview',
    linkFailed: 'Không tạo được link',
    exporting: 'Đang tạo…',
    linkRecommended:
      'Link mở ảnh landing mockup đầy đủ — gửi khách hàng xem bố cục (không phải site thật).',
    imageNote: 'Chỉ preview ảnh thiết kế — không có form, domain hay code website.',
  },
  en: {
    share: 'Share preview',
    dialogTitle: 'Share landing preview (single full image)',
    dialogDescription:
      'Create a link to preview the full landing mockup — one tall 1:4 image (Hero → CTA).',
    copyLink: 'Copy preview link',
    linkCopied: 'Preview link copied',
    linkFailed: 'Could not create link',
    exporting: 'Creating…',
    linkRecommended:
      'The link opens the full landing mockup image — share layout with clients (not a live site).',
    imageNote: 'Design image preview only — no forms, domain, or website code.',
  },
  zh: {
    share: '分享预览',
    dialogTitle: '分享落地页预览（单张完整图）',
    dialogDescription: '创建链接查看完整落地页 mockup — 一张 1:4 纵向图（主视觉 → CTA）。',
    copyLink: '复制预览链接',
    linkCopied: '已复制预览链接',
    linkFailed: '无法创建链接',
    exporting: '正在创建…',
    linkRecommended: '链接打开完整落地页 mockup — 与客户分享布局（非真实网站）。',
    imageNote: '仅为设计图预览 — 无表单、域名或网站代码。',
  },
  ja: {
    share: 'プレビュー共有',
    dialogTitle: 'ランディングプレビュー共有（縦1枚）',
    dialogDescription:
      'フルランディング mockup のプレビューリンク — 1:4 縦1枚（ヒーロー → CTA）。',
    copyLink: 'プレビューリンクをコピー',
    linkCopied: 'プレビューリンクをコピーしました',
    linkFailed: 'リンクを作成できません',
    exporting: '作成中…',
    linkRecommended:
      'リンクでフルLP mockup を開きます — クライアントとレイアウト共有（本物のサイトではありません）。',
    imageNote: 'デザイン画像のプレビューのみ — フォーム・ドメイン・コードはありません。',
  },
  ko: {
    share: '미리보기 공유',
    dialogTitle: '랜딩 미리보기 공유(전체 이미지 1장)',
    dialogDescription:
      '전체 랜딩 mockup 미리보기 링크 — 1:4 세로 1장(히어로 → CTA).',
    copyLink: '미리보기 링크 복사',
    linkCopied: '미리보기 링크가 복사되었습니다',
    linkFailed: '링크를 만들 수 없습니다',
    exporting: '만드는 중…',
    linkRecommended:
      '링크에서 전체 랜딩 mockup 이미지를 엽니다 — 고객과 레이아웃 공유(실제 사이트 아님).',
    imageNote: '디자인 이미지 미리보기만 — 폼, 도메인, 웹 코드 없음.',
  },
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function HubLandingShareMenu({
  locale,
  title,
  logoUrl,
  sections,
  threadId,
  onPublished,
}: {
  locale: WebLocale
  title: string
  logoUrl?: string | null
  sections: LandingPageSection[]
  threadId?: string | null
  onPublished?: (shareUrl: string) => void
}) {
  const text = COPY[locale]
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const createShareLink = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/hub-landing/share', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, logoUrl, sections, threadId, locale }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { shareUrl?: string }
    return data.shareUrl ?? null
  }, [locale, logoUrl, sections, threadId, title])

  const onCopyLink = async () => {
    setBusy(true)
    try {
      const url = await createShareLink()
      if (!url) {
        toast({ title: text.linkFailed, variant: 'destructive' })
        return
      }
      onPublished?.(url)
      const copied = await copyText(url)
      toast({
        title: copied ? text.linkCopied : text.linkFailed,
        description: copied ? url : undefined,
        variant: copied ? 'default' : 'destructive',
      })
    } catch {
      toast({ title: text.linkFailed, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (!sections.length) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <Share2 className="mr-1 h-3.5 w-3.5" />
        {text.share}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{text.dialogTitle}</DialogTitle>
            <DialogDescription>{text.dialogDescription}</DialogDescription>
          </DialogHeader>
          <p className="text-[11px] font-medium text-indigo-800 dark:text-indigo-200">
            {text.linkRecommended}
          </p>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void onCopyLink()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            {busy ? text.exporting : text.copyLink}
          </Button>
          <p className="text-[11px] text-muted-foreground">{text.imageNote}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
