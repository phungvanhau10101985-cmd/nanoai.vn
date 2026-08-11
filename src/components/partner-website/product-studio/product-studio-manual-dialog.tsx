'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { PRODUCT_STUDIO_PRODUCT_TYPES } from '@/lib/partner-website/product-studio/product-studio-types'
import { ProductStudioAiPanel } from '@/components/partner-website/product-studio/product-studio-ai-panel'

/** PS.3/PS.4-PS.6/PS.10 — Product Studio: wizard đăng sản phẩm thủ công + AI (Studio slot pipeline). */

type StudioT = {
  productStudioOpenButton: string
  productStudioTitle: string
  productStudioManualTab: string
  productStudioAiTab: string
  productStudioFieldName: string
  productStudioFieldPrice: string
  productStudioFieldMaterial: string
  productStudioFieldStyle: string
  productStudioFieldGender: string
  productStudioFieldProductType: string
  productStudioFieldSizes: string
  productStudioFieldNoSize: string
  productStudioFieldColors: string
  productStudioAddColor: string
  productStudioColorName: string
  productStudioColorImage: string
  productStudioFieldMainImage: string
  productStudioFieldGallery: string
  productStudioFieldDescription: string
  productStudioFieldNotes: string
  productStudioFieldStock: string
  productStudioUploadButton: string
  productStudioUploading: string
  productStudioSubmit: string
  productStudioSubmitting: string
  productStudioSuccess: string
  productStudioCancel: string
  productStudioRemove: string
  productStudioRequiredName: string
  productStudioRequiredImage: string
  productStudioRequiredPrice: string
  productStudioAiComingSoon: string
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

type ColorDraft = { name: string; img: string; uploading: boolean }

function emptyColor(): ColorDraft {
  return { name: '', img: '', uploading: false }
}

export function ProductStudioManualDialog({
  partnerId,
  t,
  onPublished,
}: {
  partnerId: string
  t: StudioT
  onPublished: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [material, setMaterial] = useState('')
  const [style, setStyle] = useState('')
  const [gender, setGender] = useState('')
  const [productType, setProductType] = useState<string>('apparel')
  const [sizesText, setSizesText] = useState('')
  const [noSize, setNoSize] = useState(false)
  const [colors, setColors] = useState<ColorDraft[]>([emptyColor()])
  const [mainImage, setMainImage] = useState('')
  const [mainImageUploading, setMainImageUploading] = useState(false)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [stockQty, setStockQty] = useState('500')

  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const colorImageInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  function resetForm() {
    setName('')
    setPrice('')
    setMaterial('')
    setStyle('')
    setGender('')
    setProductType('apparel')
    setSizesText('')
    setNoSize(false)
    setColors([emptyColor()])
    setMainImage('')
    setGalleryUrls([])
    setDescription('')
    setNotes('')
    setStockQty('500')
  }

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('purpose', 'catalog')
    const res = await fetch(
      `/api/messaging/partners/${encodeURIComponent(partnerId)}/product-studio/upload-image`,
      { method: 'POST', body: fd }
    )
    const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
    if (!res.ok || !data.publicUrl) {
      toast({ title: data.error || 'Upload failed', variant: 'destructive' })
      return null
    }
    return data.publicUrl
  }

  async function onPickMainImage(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setMainImageUploading(true)
    try {
      const url = await uploadFile(file)
      if (url) setMainImage(url)
    } finally {
      setMainImageUploading(false)
    }
  }

  async function onPickGalleryImages(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? [])
    ev.target.value = ''
    if (!files.length) return
    setGalleryUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const url = await uploadFile(file)
        if (url) urls.push(url)
      }
      if (urls.length) setGalleryUrls((prev) => [...prev, ...urls])
    } finally {
      setGalleryUploading(false)
    }
  }

  async function onPickColorImage(idx: number, ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, uploading: true } : c)))
    try {
      const url = await uploadFile(file)
      if (url) {
        setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, img: url, uploading: false } : c)))
      } else {
        setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, uploading: false } : c)))
      }
    } catch {
      setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, uploading: false } : c)))
    }
  }

  function removeGalleryImage(url: string) {
    setGalleryUrls((prev) => prev.filter((u) => u !== url))
  }

  async function onSubmit() {
    const validColors = colors.filter((c) => c.name.trim() && c.img.trim())
    const effectiveMainImage = mainImage.trim() || validColors[0]?.img || ''
    if (!name.trim()) {
      toast({ title: t.productStudioRequiredName, variant: 'destructive' })
      return
    }
    if (!effectiveMainImage) {
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
        mode: 'manual' as const,
        price: priceNum,
        material,
        productName: name,
        description,
        productType,
        gender,
        style,
        sizes: noSize ? [] : sizesText.split(',').map((s) => s.trim()).filter(Boolean),
        noSize,
        colors: validColors.map((c) => ({ name: c.name.trim(), img: c.img.trim() })),
        available: Number(stockQty) || 0,
        notes,
        mainImage: effectiveMainImage,
        gallery: galleryUrls,
      }
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/product-studio/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: data.error || 'Failed', variant: 'destructive' })
        return
      }
      toast({ title: t.productStudioSuccess })
      resetForm()
      setOpen(false)
      onPublished()
    } finally {
      setSubmitting(false)
    }
}

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t.productStudioOpenButton}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.productStudioTitle}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'ai')}>
            <TabsList>
              <TabsTrigger value="manual">{t.productStudioManualTab}</TabsTrigger>
              <TabsTrigger value="ai">{t.productStudioAiTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="ai">
              <ProductStudioAiPanel
                partnerId={partnerId}
                t={t}
                onPublished={() => {
                  setOpen(false)
                  onPublished()
                }}
              />
            </TabsContent>
            <TabsContent value="manual" className="space-y-4 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldName}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldPrice}</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldMaterial}</Label>
                  <Input value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldStyle}</Label>
                  <Input value={style} onChange={(e) => setStyle(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldGender}</Label>
                  <Input value={gender} onChange={(e) => setGender(e.target.value)} maxLength={100} />
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
                {!noSize ? (
                  <Input
                    value={sizesText}
                    onChange={(e) => setSizesText(e.target.value)}
                    placeholder="S, M, L, XL"
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{t.productStudioFieldColors}</Label>
                {colors.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      placeholder={t.productStudioColorName}
                      onChange={(e) =>
                        setColors((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                      }
                      className="max-w-[160px]"
                    />
                    {c.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.img} alt={c.name} className="h-10 w-10 rounded-md border object-cover" />
                    ) : null}
                    <input
                      ref={(el) => {
                        colorImageInputRefs.current[idx] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onPickColorImage(idx, e)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={c.uploading}
                      onClick={() => colorImageInputRefs.current[idx]?.click()}
                    >
                      {c.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {t.productStudioColorImage}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setColors((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setColors((prev) => [...prev, emptyColor()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.productStudioAddColor}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldMainImage}</Label>
                  <div className="flex items-center gap-2">
                    {mainImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImage} alt="" className="h-12 w-12 rounded-md border object-cover" />
                    ) : null}
                    <input
                      ref={mainImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onPickMainImage(e)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={mainImageUploading}
                      onClick={() => mainImageInputRef.current?.click()}
                    >
                      {mainImageUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {t.productStudioUploadButton}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.productStudioFieldGallery}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {galleryUrls.map((url) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-12 w-12 rounded-md border object-cover" />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                          onClick={() => removeGalleryImage(url)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void onPickGalleryImages(e)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={galleryUploading}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      {galleryUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {t.productStudioUploadButton}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t.productStudioFieldDescription}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.productStudioFieldNotes}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </TabsContent>
          </Tabs>

          {activeTab === 'manual' ? (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                {t.productStudioCancel}
              </Button>
              <Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t.productStudioSubmitting}
                  </>
                ) : (
                  t.productStudioSubmit
                )}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
