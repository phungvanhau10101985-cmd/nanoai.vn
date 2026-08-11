'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, ThumbsUp, Upload } from 'lucide-react'
import {
  PRODUCT_STUDIO_PRODUCT_TYPES,
  PRODUCT_STUDIO_SHOT_STYLES,
  type ProductStudioJobRow,
} from '@/lib/partner-website/product-studio/product-studio-types'

/** PS.4-PS.6 — mode AI: upload ảnh tham chiếu + thuộc tính -> Studio slot pipeline -> đặt tên AI -> đăng. */

type AiT = {
  productStudioFieldName: string
  productStudioFieldPrice: string
  productStudioFieldMaterial: string
  productStudioFieldStyle: string
  productStudioFieldGender: string
  productStudioFieldProductType: string
  productStudioFieldSizes: string
  productStudioFieldNoSize: string
  productStudioFieldStock: string
  productStudioFieldNotes: string
  productStudioUploadButton: string
  productStudioSubmit: string
  productStudioSubmitting: string
  productStudioSuccess: string
  productStudioRequiredImage: string
  productStudioRequiredPrice: string
  productStudioRefImagesLabel: string
  productStudioColorNamesLabel: string
  productStudioModelPresenceLabel: string
  productStudioShotStyleLabel: string
  productStudioAspectRatioLabel: string
  productStudioGalleryCountLabel: string
  productStudioDetailCountLabel: string
  productStudioStartStudio: string
  productStudioApprove: string
  productStudioRegenerate: string
  productStudioStudioDone: string
  productStudioSuggestName: string
  productStudioSuggestedName: string
}

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export function ProductStudioAiPanel({
  partnerId,
  t,
  onPublished,
}: {
  partnerId: string
  t: AiT
  onPublished: () => void
}) {
  const { toast } = useToast()
  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/product-studio`

  const [step, setStep] = useState<'form' | 'studio'>('form')
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ProductStudioJobRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [slotBusy, setSlotBusy] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [material, setMaterial] = useState('')
  const [style, setStyle] = useState('')
  const [gender, setGender] = useState('')
  const [productType, setProductType] = useState<string>('apparel')
  const [sizesText, setSizesText] = useState('')
  const [noSize, setNoSize] = useState(false)
  const [colorNamesText, setColorNamesText] = useState('')
  const [stockQty, setStockQty] = useState('500')
  const [notes, setNotes] = useState('')
  const [refUrls, setRefUrls] = useState<string[]>([])
  const [refUploading, setRefUploading] = useState(false)
  const [modelPresence, setModelPresence] = useState(false)
  const [modelGender, setModelGender] = useState('female')
  const [modelAgeGroup, setModelAgeGroup] = useState('adult')
  const [modelEthnicity, setModelEthnicity] = useState('asian')
  const [shotStyle, setShotStyle] = useState<string>('studio')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [galleryCount, setGalleryCount] = useState('5')
  const [detailCount, setDetailCount] = useState('3')
  const [customPrompt, setCustomPrompt] = useState('')
  const [namingBusy, setNamingBusy] = useState(false)

  const refInputRef = useRef<HTMLInputElement>(null)

  async function uploadRefFile(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('purpose', 'ref')
    const res = await fetch(`${base}/upload-image`, { method: 'POST', body: fd })
    const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
    if (!res.ok || !data.publicUrl) {
      toast({ title: data.error || 'Upload failed', variant: 'destructive' })
      return null
    }
    return data.publicUrl
  }

  async function onPickRefImages(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []).slice(0, 3 - refUrls.length)
    ev.target.value = ''
    if (!files.length) return
    setRefUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const url = await uploadRefFile(file)
        if (url) urls.push(url)
      }
      if (urls.length) setRefUrls((prev) => [...prev, ...urls].slice(0, 3))
    } finally {
      setRefUploading(false)
    }
  }

  async function generateNextSlot(currentJobId: string) {
    setSlotBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(currentJobId)}/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'Generate failed')
      setJob(data.job)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSlotBusy(false)
    }
  }

  async function onStartStudio() {
    if (refUrls.length < 1) {
      toast({ title: t.productStudioRequiredImage, variant: 'destructive' })
      return
    }
    const priceNum = Number(price.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast({ title: t.productStudioRequiredPrice, variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        mode: 'ai' as const,
        price: priceNum,
        material,
        productName: name,
        productType,
        gender,
        style,
        sizes: noSize ? [] : sizesText.split(',').map((s) => s.trim()).filter(Boolean),
        noSize,
        colors: colorNamesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((n) => ({ name: n, img: '' })),
        available: Number(stockQty) || 0,
        notes,
        refImageUrls: refUrls,
        galleryCount: Number(galleryCount) || 5,
        detailCount: Number(detailCount) || 3,
        aspectRatio,
        modelPresence: modelPresence ? ('model' as const) : ('none' as const),
        modelGender: modelPresence ? modelGender : '',
        modelAgeGroup: modelPresence ? modelAgeGroup : '',
        modelEthnicity: modelPresence ? modelEthnicity : '',
        shotStyle: shotStyle as 'studio' | 'lifestyle' | 'outdoor',
      }
      const res = await fetch(`${base}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string }
      if (!res.ok || !data.jobId) throw new Error(data.error || 'Create job failed')
      setJobId(data.jobId)
      setStep('studio')
      await generateNextSlot(data.jobId)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function onApprove() {
    if (!jobId) return
    setSlotBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}/images/approve`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; done?: boolean; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'Approve failed')
      setJob(data.job)
      if (!data.done) await generateNextSlot(jobId)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSlotBusy(false)
    }
  }

  async function onRegenerate() {
    if (!jobId) return
    setSlotBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}/images/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: customPrompt.trim() || undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'Regenerate failed')
      setJob(data.job)
      setCustomPrompt('')
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSlotBusy(false)
    }
  }

  async function onSuggestName() {
    if (!jobId) return
    setNamingBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}/vision-name`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string }
      if (!res.ok || !data.name) throw new Error(data.error || 'Naming failed')
      setName(data.name)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setNamingBusy(false)
    }
  }

  async function onPublish() {
    if (!jobId) return
    if (!name.trim()) {
      toast({ title: t.productStudioRequiredImage, variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      // Đồng bộ tên cuối cùng (có thể merchant sửa sau khi AI đề xuất) trước khi publish.
      await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' })
      const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      toast({ title: t.productStudioSuccess })
      onPublished()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const currentSlot = job?.studio.currentSlot
  const studioDone = job ? !currentSlot && job.status === 'ready_for_review' && job.studio.colors.length > 0 : false

  if (step === 'form') {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>{t.productStudioRefImagesLabel}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {refUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-14 w-14 rounded-md border object-cover" />
            ))}
            <input ref={refInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onPickRefImages(e)} />
            <Button type="button" variant="secondary" size="sm" disabled={refUploading || refUrls.length >= 3} onClick={() => refInputRef.current?.click()}>
              {refUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t.productStudioUploadButton}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="(để trống — AI đặt tên)" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldPrice}</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldMaterial}</Label>
            <Input value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldStyle}</Label>
            <Input value={style} onChange={(e) => setStyle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldGender}</Label>
            <Input value={gender} onChange={(e) => setGender(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldProductType}</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STUDIO_PRODUCT_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt}>
                    {pt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioColorNamesLabel}</Label>
            <Input value={colorNamesText} onChange={(e) => setColorNamesText(e.target.value)} placeholder="Trắng, Đen" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldStock}</Label>
            <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>{t.productStudioFieldSizes}</Label>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={noSize} onCheckedChange={setNoSize} />
              {t.productStudioFieldNoSize}
            </div>
          </div>
          {!noSize ? <Input value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="S, M, L, XL" /> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.productStudioShotStyleLabel}</Label>
            <Select value={shotStyle} onValueChange={setShotStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STUDIO_SHOT_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioAspectRatioLabel}</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioGalleryCountLabel}</Label>
            <Input value={galleryCount} onChange={(e) => setGalleryCount(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.productStudioDetailCountLabel}</Label>
            <Input value={detailCount} onChange={(e) => setDetailCount(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={modelPresence} onCheckedChange={setModelPresence} />
          <Label className="!m-0">{t.productStudioModelPresenceLabel}</Label>
        </div>
        {modelPresence ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={modelGender} onValueChange={setModelGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">female</SelectItem>
                <SelectItem value="male">male</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modelAgeGroup} onValueChange={setModelAgeGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="child">child</SelectItem>
                <SelectItem value="teen">teen</SelectItem>
                <SelectItem value="adult">adult</SelectItem>
                <SelectItem value="middle_aged">middle_aged</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modelEthnicity} onValueChange={setModelEthnicity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asian">asian</SelectItem>
                <SelectItem value="western">western</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>{t.productStudioFieldNotes}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button type="button" onClick={() => void onStartStudio()} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t.productStudioStartStudio}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2">
      {currentSlot ? (
        <div className="space-y-3 rounded-lg border p-4 text-center">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {currentSlot.kind}
            {currentSlot.name ? ` — ${currentSlot.name}` : ''}
          </p>
          {slotBusy ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentSlot.candidateUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSlot.candidateUrl} alt="" className="mx-auto max-h-72 rounded-md border object-contain" />
          ) : currentSlot.error ? (
            <p className="text-sm text-destructive">{currentSlot.error}</p>
          ) : null}
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Sửa yêu cầu cho AI (tuỳ chọn)…"
            rows={2}
            className="text-xs"
          />
          <div className="flex justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={slotBusy} onClick={() => void onRegenerate()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t.productStudioRegenerate}
            </Button>
            <Button type="button" size="sm" disabled={slotBusy || !currentSlot.candidateUrl} onClick={() => void onApprove()}>
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
              {t.productStudioApprove}
            </Button>
          </div>
        </div>
      ) : null}

      {studioDone ? (
        <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm font-medium">{t.productStudioStudioDone}</p>
          <div className="flex items-center justify-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.productStudioSuggestedName} className="max-w-xs" />
            <Button type="button" variant="secondary" size="sm" disabled={namingBusy} onClick={() => void onSuggestName()}>
              {namingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t.productStudioSuggestName}
            </Button>
          </div>
          <Button type="button" onClick={() => void onPublish()} disabled={submitting || !name.trim()} className="w-full">
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {t.productStudioSubmit}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
