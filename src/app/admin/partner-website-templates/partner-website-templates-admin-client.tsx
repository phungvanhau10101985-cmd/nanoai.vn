'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePlatformConfig } from '@/lib/db/partner-website-platform-settings-pg'
import type { SectionRegistryEntry } from '@/lib/partner-website/template/section-registry'

type Props = {
  locale: WebLocale
}

const COPY: Record<
  WebLocale,
  {
    title: string
    description: string
    templatesTitle: string
    sectionsTitle: string
    enabled: string
    platformLocked: string
    save: string
    saving: string
    saved: string
    adminOnly: string
  }
> = {
  vi: {
    title: 'Landing template (platform)',
    description:
      'Quản trị NanoAI — bật/tắt block giao diện khách được dùng. Logic backend/chat do code platform, khách không sửa.',
    templatesTitle: 'Template',
    sectionsTitle: 'Section registry',
    enabled: 'Bật cho khách',
    platformLocked: 'Platform lock',
    save: 'Lưu cấu hình',
    saving: 'Đang lưu…',
    saved: 'Đã lưu cấu hình section.',
    adminOnly: 'Chỉ admin NanoAI.',
  },
  en: {
    title: 'Landing templates (platform)',
    description:
      'NanoAI admin — enable UI blocks tenants may use. Chat/backend logic is platform code; tenants cannot edit it.',
    templatesTitle: 'Templates',
    sectionsTitle: 'Section registry',
    enabled: 'Enabled for tenants',
    platformLocked: 'Platform locked',
    save: 'Save config',
    saving: 'Saving…',
    saved: 'Section config saved.',
    adminOnly: 'NanoAI admin only.',
  },
  zh: {
    title: '落地页模板（平台）',
    description: 'NanoAI 管理 — 启用租户可用的 UI 区块。聊天/后端逻辑由平台代码控制。',
    templatesTitle: '模板',
    sectionsTitle: 'Section 注册表',
    enabled: '对租户启用',
    platformLocked: '平台锁定',
    save: '保存配置',
    saving: '保存中…',
    saved: '已保存。',
    adminOnly: '仅 NanoAI 管理员。',
  },
  ja: {
    title: 'LPテンプレート（プラットフォーム）',
    description: 'NanoAI管理 — テナントが使えるUIブロック。チャット/バックエンドはプラットフォームコード。',
    templatesTitle: 'テンプレート',
    sectionsTitle: 'セクションレジストリ',
    enabled: 'テナント向け有効',
    platformLocked: 'プラットフォーム固定',
    save: '設定を保存',
    saving: '保存中…',
    saved: '保存しました。',
    adminOnly: 'NanoAI管理者のみ。',
  },
  ko: {
    title: '랜딩 템플릿 (플랫폼)',
    description: 'NanoAI 관리 — 테넌트가 쓸 UI 블록 활성화. 채팅/백엔드는 플랫폼 코드.',
    templatesTitle: '템플릿',
    sectionsTitle: '섹션 레지스트리',
    enabled: '테넌트 사용',
    platformLocked: '플랫폼 잠금',
    save: '설정 저장',
    saving: '저장 중…',
    saved: '저장됨.',
    adminOnly: 'NanoAI 관리자 전용.',
  },
}

function labelFor(locale: WebLocale, map: Record<string, string>): string {
  return map[locale] ?? map.en ?? Object.values(map)[0] ?? ''
}

export function PartnerWebsiteTemplatesAdminClient({ locale }: Props) {
  const t = COPY[locale] ?? COPY.en
  const { toast } = useToast()
  const [config, setConfig] = useState<PartnerWebsitePlatformConfig | null>(null)
  const [sections, setSections] = useState<SectionRegistryEntry[]>([])
  const [templates, setTemplates] = useState<Record<string, { label: Record<string, string>; description: Record<string, string> }>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/partner-website-templates')
      const json = (await res.json()) as {
        config?: PartnerWebsitePlatformConfig
        sections?: SectionRegistryEntry[]
        templates?: typeof templates
        error?: string
      }
      if (!res.ok) {
        toast({ title: json.error || t.adminOnly, variant: 'destructive' })
        return
      }
      setConfig(json.config ?? null)
      setSections(json.sections ?? [])
      setTemplates(json.templates ?? {})
    } finally {
      setLoading(false)
    }
  }, [t.adminOnly, toast])

  useEffect(() => {
    void load()
  }, [load])

  function toggleSection(type: string, checked: boolean) {
    if (!config) return
    const set = new Set(config.enabledSectionTypes)
    if (checked) set.add(type)
    else set.delete(type)
    setConfig({ ...config, enabledSectionTypes: [...set] })
  }

  async function save() {
    if (!config) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/partner-website-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast({ title: json.error || 'Error', variant: 'destructive' })
        return
      }
      toast({ title: t.saved })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.templatesTitle}</CardTitle>
          <CardDescription>{config?.defaultTemplateId ?? 'landing-v1'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(templates).map(([id, def]) => (
            <div key={id} className="rounded-md border p-3">
              <p className="font-medium">{labelFor(locale, def.label)}</p>
              <p className="text-sm text-muted-foreground">{labelFor(locale, def.description)}</p>
              <Badge variant="secondary" className="mt-2">
                {id}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.sectionsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sections.map((section) => (
            <div key={section.type} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
              <Checkbox
                id={`sec-${section.type}`}
                checked={config?.enabledSectionTypes.includes(section.type) ?? false}
                onCheckedChange={(v) => toggleSection(section.type, v === true)}
              />
              <label htmlFor={`sec-${section.type}`} className="min-w-0 flex-1 cursor-pointer">
                <p className="font-medium">
                  {labelFor(locale, section.label)}{' '}
                  <code className="text-xs text-muted-foreground">{section.type}</code>
                </p>
                <p className="text-sm text-muted-foreground">{labelFor(locale, section.description)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.enabled}: {section.editableFields.join(', ')}
                </p>
              </label>
              {section.platformLocked ? (
                <Badge variant="outline">{t.platformLocked}</Badge>
              ) : null}
            </div>
          ))}
          <Button type="button" disabled={busy || !config} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
