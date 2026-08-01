'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  collectPartnerWebsiteReferenceUrls,
  PartnerWebsiteAssetPanel,
} from '@/components/partner-website/partner-website-asset-panel'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteChatMessage } from '@/lib/partner-website/partner-website-ai-generator'
import type { PartnerWebsiteAgentStep } from '@/lib/partner-website/partner-website-agent-loop'
import type { FileDiff } from '@/lib/partner-website/partner-website-line-diff'
import { Badge } from '@/components/ui/badge'
import {
  DEFAULT_PARTNER_WEBSITE_MODEL_ID,
  PARTNER_WEBSITE_MODELS,
  partnerWebsiteModelLabel,
  type PartnerWebsiteModelId,
} from '@/lib/partner-website/partner-website-models'

export type PartnerWebsiteChatPanelHandle = {
  sendMessage: (message: string) => Promise<void>
}

export type PartnerWebsiteChatPanelProps = {
  locale: WebLocale
  partnerId: string
  partnerTitle: string
  website: PartnerWebsiteRow | null
  logoUrl: string
  onLogoUrlChange: (url: string) => void
  refUrlsText: string
  onRefUrlsTextChange: (text: string) => void
  uploadedRefUrls: string[]
  onUploadedRefUrlsChange: (urls: string[]) => void
  disabled?: boolean
  onError: (message: string) => void
  onWebsiteUpdated: (payload: {
    website: PartnerWebsiteRow
    publicUrl: string | null
    assistantMessage: string
    source?: string
    editMode?: string
    editedFiles?: string[]
    agentSteps?: PartnerWebsiteAgentStep[]
    fileDiffs?: FileDiff[]
  }) => void
  onBusyChange?: (busy: boolean) => void
}

type ChatLine = PartnerWebsiteChatMessage & {
  id: string
  agentSteps?: PartnerWebsiteAgentStep[]
  editedFiles?: string[]
}

function newLine(role: PartnerWebsiteChatMessage['role'], content: string): ChatLine {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content }
}

export const PartnerWebsiteChatPanel = forwardRef<
  PartnerWebsiteChatPanelHandle,
  PartnerWebsiteChatPanelProps
>(function PartnerWebsiteChatPanel(
  {
  locale,
  partnerId,
  partnerTitle,
  website,
  logoUrl,
  onLogoUrlChange,
  refUrlsText,
  onRefUrlsTextChange,
  uploadedRefUrls,
  onUploadedRefUrlsChange,
  disabled,
  onError,
  onWebsiteUpdated,
  onBusyChange,
  },
  ref
) {
  const t = getPartnerWebsiteCopy(locale)
  const [modelId, setModelId] = useState<PartnerWebsiteModelId>(DEFAULT_PARTNER_WEBSITE_MODEL_ID)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [lines, setLines] = useState<ChatLine[]>(() => [
    newLine('assistant', website ? t.chatWelcomeExisting : t.chatWelcome),
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const partnerSeedRef = useRef(`${partnerId}:${Boolean(website)}`)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines, busy])

  useEffect(() => {
    const seed = `${partnerId}:${Boolean(website)}`
    if (partnerSeedRef.current === seed) return
    partnerSeedRef.current = seed
    setLines([newLine('assistant', website ? t.chatWelcomeExisting : t.chatWelcome)])
    setInput('')
  }, [partnerId, website, t.chatWelcome, t.chatWelcomeExisting])

  const suggestions = website
    ? [t.chatSuggestEditHero, t.chatSuggestEditColor, t.quickEditAddFaq]
    : [t.chatSuggestEditHero, t.chatSuggestEditColor]

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim()
      if (!partnerId || busy) return
      if (message.length < 2) {
        onError(t.chatMessageTooShort)
        return
      }

      const userLine = newLine('user', message)
      const history = [...lines, userLine]
      setLines(history)
      setInput('')
      setBusy(true)

      try {
        const referenceImageUrls = collectPartnerWebsiteReferenceUrls({
          refUrlsText,
          uploadedRefUrls,
        })
        const res = await fetch('/api/messaging/partner-website/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId,
            message,
            modelId,
            messages: lines.map(({ role, content }) => ({ role, content })),
            title: partnerTitle,
            logoUrl: logoUrl.trim() || null,
            referenceImageUrls,
            locale,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          website?: PartnerWebsiteRow
          publicUrl?: string | null
          assistantMessage?: string
          source?: string
          editMode?: string
          editedFiles?: string[]
          agentSteps?: PartnerWebsiteAgentStep[]
          fileDiffs?: FileDiff[]
          error?: string
        }
        if (!res.ok || !json.website) {
          onError(json.error || t.errorGeneric)
          setLines((prev) => [
            ...prev,
            newLine(
              'assistant',
              json.error || t.errorGeneric
            ),
          ])
          return
        }

        const reply =
          json.assistantMessage?.trim() ||
          (locale === 'vi' ? 'Đã cập nhật website.' : 'Website updated.')
        setLines((prev) => [
          ...prev,
          {
            ...newLine('assistant', reply),
            agentSteps: json.agentSteps,
            editedFiles: json.editedFiles,
          },
        ])
        onWebsiteUpdated({
          website: json.website,
          publicUrl: json.publicUrl ?? null,
          assistantMessage: reply,
          source: json.source,
          editMode: json.editMode,
          editedFiles: json.editedFiles,
          agentSteps: json.agentSteps,
          fileDiffs: json.fileDiffs,
        })
      } catch {
        onError(t.errorGeneric)
        setLines((prev) => [...prev, newLine('assistant', t.errorGeneric)])
      } finally {
        setBusy(false)
      }
    },
    [
      partnerId,
      busy,
      lines,
      refUrlsText,
      uploadedRefUrls,
      modelId,
      partnerTitle,
      logoUrl,
      locale,
      onError,
      onWebsiteUpdated,
      t.chatMessageTooShort,
      t.errorGeneric,
    ]
  )

  useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage])

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 space-y-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t.chatSectionTitle}
          </CardTitle>
          <CardDescription>{t.chatSectionHint}</CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-fit px-2 text-xs"
          onClick={() => setShowAssets((v) => !v)}
        >
          {showAssets ? t.chatAssetsHide : t.chatAssetsToggle}
        </Button>
        {showAssets ? (
          <PartnerWebsiteAssetPanel
            locale={locale}
            partnerId={partnerId}
            logoUrl={logoUrl}
            onLogoUrlChange={onLogoUrlChange}
            refUrlsText={refUrlsText}
            onRefUrlsTextChange={onRefUrlsTextChange}
            uploadedRefUrls={uploadedRefUrls}
            onUploadedRefUrlsChange={onUploadedRefUrlsChange}
            disabled={busy || disabled || !partnerId}
            onError={onError}
          />
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-0">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3"
        >
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                line.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto bg-background border shadow-sm'
              )}
            >
              {line.content}
              {line.role === 'assistant' && line.agentSteps?.length ? (
                <div className="mt-2 space-y-1.5 border-t pt-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{t.agentStepsTitle}</p>
                  {line.agentSteps.map((step, idx) => (
                    <div key={`${step.kind}-${idx}`} className="flex flex-wrap items-start gap-1.5">
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] uppercase">
                        {step.kind}
                      </Badge>
                      <span className="min-w-0 flex-1">{step.message}</span>
                    </div>
                  ))}
                  {line.editedFiles?.length ? (
                    <p className="text-[11px]">
                      {line.editedFiles.length} {t.fileChanged}: {line.editedFiles.join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="mr-auto flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.chatThinking}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((chip) => (
            <Button
              key={chip}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={busy || disabled}
              onClick={() => void sendMessage(chip)}
            >
              {chip}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chatInputPlaceholder}
            rows={3}
            disabled={busy || disabled}
            className="min-h-[72px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-2 py-1.5">
            <Select
              value={modelId}
              onValueChange={(value) => setModelId(value as PartnerWebsiteModelId)}
              disabled={busy || disabled}
            >
              <SelectTrigger
                className="h-8 w-auto max-w-[min(100%,220px)] border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0"
                aria-label={t.chatModelLabel}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {PARTNER_WEBSITE_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {partnerWebsiteModelLabel(locale, model.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-3"
              disabled={busy || disabled || !input.trim()}
              onClick={() => void sendMessage(input)}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {t.chatSend}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
