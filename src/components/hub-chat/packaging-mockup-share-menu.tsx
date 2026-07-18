'use client'

import { useCallback, useState } from 'react'
import { FileCode2, Link2, Loader2, Share2 } from 'lucide-react'
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
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxFaceSlot, FaceSourceMode } from '@/lib/packaging/box-face-slots'
import { mockupDownloadFilename, resolveMockupFaceUrlsForShare } from '@/lib/packaging/mockup-share-utils'
import { downloadStandaloneMockupHtml } from '@/lib/packaging/mockup-share-html'

type FaceSlots = Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>

const COPY: Record<
  WebLocale,
  {
    share: string
    dialogTitle: string
    dialogDescription: string
    copyLink: string
    downloadHtml: string
    linkCopied: string
    linkFailed: string
    htmlFailed: string
    exporting: string
    linkRecommended: string
    htmlNote: string
  }
> = {
  vi: {
    share: 'Chia sẻ',
    dialogTitle: 'Chia sẻ mockup 3D',
    dialogDescription: 'Gửi link hoặc file HTML — người nhận xoay hộp 3D thật trên trình duyệt.',
    copyLink: 'Sao chép link xem xoay (khuyên dùng)',
    downloadHtml: 'Tải file HTML',
    linkCopied: 'Đã sao chép link chia sẻ',
    linkFailed: 'Không tạo được link chia sẻ',
    htmlFailed: 'Không tải được file HTML',
    exporting: 'Đang tạo…',
    linkRecommended: 'Link mở viewer 3D giống bạn đang xem — chỉ cần trình duyệt, không cần đăng nhập.',
    htmlNote: 'File HTML: mở bằng Chrome/Edge/Safari. Cần mạng để tải ảnh các mặt.',
  },
  en: {
    share: 'Share',
    dialogTitle: 'Share 3D mockup',
    dialogDescription: 'Send a link or HTML file — recipients rotate the real 3D box in their browser.',
    copyLink: 'Copy interactive link (recommended)',
    downloadHtml: 'Download HTML file',
    linkCopied: 'Share link copied',
    linkFailed: 'Could not create share link',
    htmlFailed: 'Could not download HTML file',
    exporting: 'Creating…',
    linkRecommended: 'The link opens the same 3D viewer — any browser, no sign-in required.',
    htmlNote: 'HTML file: open in Chrome/Edge/Safari. Internet required to load face images.',
  },
  zh: {
    share: '分享',
    dialogTitle: '分享 3D mockup',
    dialogDescription: '发送链接或 HTML 文件 — 对方可在浏览器中旋转真实 3D 盒。',
    copyLink: '复制交互链接（推荐）',
    downloadHtml: '下载 HTML 文件',
    linkCopied: '已复制分享链接',
    linkFailed: '无法创建分享链接',
    htmlFailed: '无法下载 HTML 文件',
    exporting: '正在创建…',
    linkRecommended: '链接打开与您相同的 3D 查看器 — 任意浏览器，无需登录。',
    htmlNote: 'HTML 文件：用 Chrome/Edge/Safari 打开。需联网加载各面图片。',
  },
  ja: {
    share: '共有',
    dialogTitle: '3Dモックアップを共有',
    dialogDescription: 'リンクまたはHTMLファイルを送る — 受け取った人がブラウザで3D箱を回転できます。',
    copyLink: '回転リンクをコピー（推奨）',
    downloadHtml: 'HTMLファイルをダウンロード',
    linkCopied: '共有リンクをコピーしました',
    linkFailed: '共有リンクを作成できません',
    htmlFailed: 'HTMLファイルをダウンロードできません',
    exporting: '作成中…',
    linkRecommended: 'リンクは同じ3Dビューアを開きます — ブラウザのみ、ログイン不要。',
    htmlNote: 'HTML：Chrome/Edge/Safariで開く。各面画像の読み込みにネット接続が必要です。',
  },
  ko: {
    share: '공유',
    dialogTitle: '3D 목업 공유',
    dialogDescription: '링크 또는 HTML 파일 전송 — 받는 사람이 브라우저에서 3D 상자를 회전할 수 있습니다.',
    copyLink: '회전 링크 복사(권장)',
    downloadHtml: 'HTML 파일 다운로드',
    linkCopied: '공유 링크가 복사되었습니다',
    linkFailed: '공유 링크를 만들 수 없습니다',
    htmlFailed: 'HTML 파일을 다운로드할 수 없습니다',
    exporting: '만드는 중…',
    linkRecommended: '링크는 동일한 3D 뷰어를 엽니다 — 브라우저만 있으면 되며 로그인 불필요.',
    htmlNote: 'HTML: Chrome/Edge/Safari에서 열기. 각 면 이미지 로드에 인터넷 필요.',
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

export function PackagingMockupShareMenu({
  dimensionsMm,
  faceSlots,
  locale,
  overlayClassName,
  contentClassName,
}: {
  dimensionsMm: BoxDimensionsMm
  faceSlots: FaceSlots
  locale: WebLocale
  /** Use inside a high z-index parent (e.g. fullscreen mockup dialog). */
  overlayClassName?: string
  contentClassName?: string
}) {
  const text = COPY[locale]
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'link' | 'html' | null>(null)

  const baseFilename = mockupDownloadFilename(dimensionsMm)

  const createShareLink = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/packaging/mockup/share', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensionsMm, faceSlots, locale }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { shareUrl?: string }
    return data.shareUrl ?? null
  }, [dimensionsMm, faceSlots, locale])

  const onCopyLink = async () => {
    setBusy('link')
    try {
      const url = await createShareLink()
      if (!url) {
        toast({ title: text.linkFailed, variant: 'destructive' })
        return
      }
      const copied = await copyText(url)
      toast({
        title: copied ? text.linkCopied : text.linkFailed,
        description: copied ? url : undefined,
        variant: copied ? 'default' : 'destructive',
      })
    } catch {
      toast({ title: text.linkFailed, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const onDownloadHtml = () => {
    setBusy('html')
    try {
      const faceUrls = resolveMockupFaceUrlsForShare(faceSlots)
      downloadStandaloneMockupHtml({
        dimensionsMm,
        faceUrls,
        filename: `${baseFilename}.html`,
        title: text.dialogTitle,
      })
    } catch {
      toast({ title: text.htmlFailed, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

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
        <DialogContent className={contentClassName ?? 'max-w-md'} overlayClassName={overlayClassName}>
          <DialogHeader>
            <DialogTitle>{text.dialogTitle}</DialogTitle>
            <DialogDescription>{text.dialogDescription}</DialogDescription>
          </DialogHeader>
          <p className="text-[11px] font-medium text-violet-800 dark:text-violet-200">{text.linkRecommended}</p>
          <div className="grid gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void onCopyLink()}>
              {busy === 'link' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {busy === 'link' ? text.exporting : text.copyLink}
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={onDownloadHtml}>
              {busy === 'html' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode2 className="mr-2 h-4 w-4" />}
              {text.downloadHtml}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{text.htmlNote}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
