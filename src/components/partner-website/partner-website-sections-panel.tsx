'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { getSectionRegistryEntry } from '@/lib/partner-website/template/section-registry'
import { ChevronDown, ChevronUp, FolderTree, Loader2 } from 'lucide-react'

/**
 * W2.4 — sắp xếp lại block trang chủ. Dùng nút lên/xuống (giống `PartnerWebsiteCategoriesPanel`)
 * thay vì kéo-thả — backend đã có sẵn op `reorder` (xem apply-template-edits.ts), chỉ thiếu UI;
 * nút lên/xuống đạt cùng mục tiêu với độ rủi ro/độ phức tạp thấp hơn nhiều so với thêm thư viện
 * drag-and-drop mới (dự án hiện chưa có lib nào cho việc này).
 *
 * Khoá khi `theme.useVisualHtml === true`: lúc đó trang render thẳng từ HTML thô do "Sửa nhanh"
 * lưu lại, cấu trúc `sections[]` bị bỏ qua hoàn toàn — sắp xếp ở đây sẽ không có tác dụng gì lên
 * trang thật, nên ẩn điều khiển + giải thích rõ thay vì cho sửa "ảo".
 */

function sectionLabel(locale: WebLocale, type: string): string {
  const entry = getSectionRegistryEntry(type)
  if (!entry) return type
  return entry.label[locale] ?? entry.label.en ?? type
}

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  sectionId?: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onWebsiteRefresh: (website: PartnerWebsiteRow) => void
}

export function PartnerWebsiteSectionsPanel({ locale, website, partnerId, sectionId, onToast, onWebsiteRefresh }: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!website || website.renderMode !== 'template') return null

  const home = website.pages.find((p) => p.slug === '/') ?? website.pages[0]
  const sections = home?.sections ?? []
  const isLocked = Boolean(website.theme.useVisualHtml)

  const move = async (index: number, direction: 'up' | 'down') => {
    if (!home || isLocked) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sections.length) return
    const reordered = [...sections]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex]!, reordered[index]!]
    const sectionIds = reordered.map((s) => s.id)
    const movedId = sections[index]!.id
    setBusyId(movedId)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder_sections', pageSlug: home.slug, sectionIds }),
      })
      const json = (await res.json()) as { website?: PartnerWebsiteRow; error?: string }
      if (!res.ok || !json.website) {
        onToast(t.sectionsSaveError, 'destructive')
        return
      }
      onWebsiteRefresh(json.website)
      onToast(t.sectionsSaveSuccess)
    } catch {
      onToast(t.sectionsSaveError, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t.sectionsPanelTitle}</CardTitle>
        <CardDescription className="text-xs">{t.sectionsPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t.templateModeBadge}</Badge>
          <Badge variant="outline">{website.templateId}</Badge>
        </div>
        {isLocked ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            {t.sectionsVisualHtmlLockedNote}
          </p>
        ) : null}
        <ul className="space-y-2">
          {sections.map((section, idx) => {
            const busy = busyId === section.id
            return (
              <li
                key={section.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">
                    <span className="text-muted-foreground">{idx + 1}.</span> {sectionLabel(locale, section.type)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <code className="mr-1 text-[10px] text-muted-foreground">{section.type}</code>
                  {!isLocked ? (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={busy || idx === 0}
                        onClick={() => void move(idx, 'up')}
                        aria-label={t.sectionsMoveUp}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={busy || idx === sections.length - 1}
                        onClick={() => void move(idx, 'down')}
                        aria-label={t.sectionsMoveDown}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t.sectionsPanelLockedNote}</p>
      </CardContent>
    </Card>
  )
}
