'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { createMessagingWorkspaceProfile } from '@/app/dashboard/messaging/actions'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'
import type { Database } from '@/types/database.types'
import { Building2, Factory, Globe, Plus, Shirt, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']

function channelMeta(industryKey: string | null) {
  const key = String(industryKey || 'fashion')
  if (key === 'hotel') return { icon: Building2, label: 'Nhà nghỉ / khách sạn', tone: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (key === 'food') return { icon: UtensilsCrossed, label: 'Nhà hàng / ăn uống', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (key === 'other') return { icon: Factory, label: 'Kênh khác', tone: 'bg-slate-50 text-slate-700 border-slate-200' }
  return { icon: Shirt, label: 'Shop bán hàng', tone: 'bg-violet-50 text-violet-700 border-violet-200' }
}

function partnerEntryLink(partner: PartnerRow): string {
  const key = String(partner.industry_key || 'fashion')
  if (key === 'hotel') return `/dashboard/hospitality/settings?partner=${encodeURIComponent(partner.id)}`
  return `/dashboard/messaging/inbox?partner=${encodeURIComponent(partner.id)}`
}

export function BusinessChannelsHubClient({
  partners,
  websiteLinkLabel = 'Web / landing',
}: {
  partners: PartnerRow[]
  websiteLinkLabel?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [channelKind, setChannelKind] = useState<'fashion' | 'hotel' | 'food' | 'other'>('fashion')
  const [displayName, setDisplayName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [creating, setCreating] = useState(false)

  const sortedPartners = useMemo(
    () =>
      [...partners].sort((a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
      ),
    [partners]
  )

  const shortcuts = sortedPartners.slice(0, 8)

  async function submitCreateChannel() {
    const name = displayName.trim()
    const brand = brandName.trim() || name
    if (!name) {
      toast({ title: 'Vui lòng nhập tên kênh.', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await createMessagingWorkspaceProfile({
        displayName: name,
        brandName: brand,
        industryKey: channelKind,
        logoUrl: logoUrl.trim(),
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if (!('partner' in res) || !res.partner) return
      const created = res.partner as PartnerRow
      setCreateOpen(false)
      setDisplayName('')
      setBrandName('')
      setLogoUrl('')
      setChannelKind('fashion')
      router.push(partnerEntryLink(created))
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Kênh kinh doanh</CardTitle>
              <CardDescription>
                Mỗi kênh là một workspace riêng. Chọn kênh để vào quản lý chính, các kênh khác có lối tắt bên dưới.
              </CardDescription>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Tạo kênh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedPartners.map((partner) => {
          const meta = channelMeta(partner.industry_key)
          const Icon = meta.icon
          return (
            <div key={partner.id} className="text-left">
              <Card
                className="h-full cursor-pointer border-border/70 transition hover:border-primary/40 hover:shadow-sm"
                onClick={() => router.push(partnerEntryLink(partner))}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md border', meta.tone)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <Badge variant={partner.is_active === false ? 'outline' : 'secondary'}>
                      {partner.is_active === false ? 'Tạm dừng' : 'Đang hoạt động'}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-1 text-sm font-semibold">{partner.display_name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{meta.label}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">/{partner.slug}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(partnerWebsiteDashboardPath(partner.slug))
                      }}
                    >
                      <Globe className="mr-1 h-3.5 w-3.5" />
                      {websiteLinkLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lối tắt kênh</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {shortcuts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có kênh nào.</p>
          ) : (
            shortcuts.map((partner) => {
              const meta = channelMeta(partner.industry_key)
              const Icon = meta.icon
              return (
                <Button
                  key={partner.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => router.push(partnerEntryLink(partner))}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{partner.display_name}</span>
                </Button>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo kênh kinh doanh mới</DialogTitle>
            <DialogDescription>
              Bắt đầu với shop bán hàng hoặc khách sạn. Các loại kênh khác sẽ mở rộng sau.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { value: 'fashion', label: 'Shop' },
                  { value: 'hotel', label: 'Khách sạn' },
                  { value: 'food', label: 'Nhà hàng' },
                  { value: 'other', label: 'Khác' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannelKind(opt.value)}
                  className={cn(
                    'rounded border px-2 py-2 text-xs',
                    channelKind === opt.value
                      ? 'border-violet-500 bg-violet-50 text-violet-800'
                      : 'hover:bg-muted'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tên kênh hiển thị"
              maxLength={120}
            />
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Tên thương hiệu (không bắt buộc)"
              maxLength={120}
            />
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="Logo URL (không bắt buộc)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Hủy
            </Button>
            <Button onClick={() => void submitCreateChannel()} disabled={creating || !displayName.trim()}>
              {creating ? 'Đang tạo...' : 'Tạo kênh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

