'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2, Plus } from 'lucide-react'
import {
  PRODUCT_STUDIO_PRODUCT_TYPES,
  STUDIO_MIN_COLOR_IMAGES,
  STUDIO_MIN_GALLERY_IMAGES,
  isWearableProductType,
  type ProductStudioProductType,
} from '@/lib/partner-website/product-studio/product-studio-types'
import { ProductStudioAiPanel } from '@/components/partner-website/product-studio/product-studio-ai-panel'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/** PS.3/PS.10 — Product Studio: wizard đăng thủ công giống 188 (Thuộc tính → Ảnh → Đăng) + tab AI. */

type StudioT = Dictionary['partnerMessagingAi']
type WizardStep = 1 | 2 | 3
type ColorDraft = { key: string; name: string; img: string; uploading: boolean }

function newColorRow(partial?: Partial<ColorDraft>): ColorDraft {
  return {
    key: partial?.key || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: partial?.name || '',
    img: partial?.img || '',
    uploading: partial?.uploading || false,
  }
}

function Thumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-xs text-white"
          aria-label="×"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

function SizeChipsInput({
  sizes,
  onChange,
  placeholder,
  disabled,
}: {
  sizes: string[]
  onChange: (next: string[]) => void
  placeholder: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  function commit() {
    const parts = draft.split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) {
      setDraft('')
      return
    }
    const seen = new Set(sizes.map((s) => s.toLowerCase()))
    const merged = [...sizes]
    for (const p of parts) {
      if (seen.has(p.toLowerCase())) continue
      seen.add(p.toLowerCase())
      merged.push(p)
    }
    onChange(merged)
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex min-h-9 flex-wrap gap-1.5">
        {sizes.map((sz) => (
          <span key={sz} className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm">
            {sz}
            {!disabled ? (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onChange(sizes.filter((x) => x !== sz))}>
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <Input
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Backspace' && !draft && sizes.length) onChange(sizes.slice(0, -1))
        }}
        onBlur={commit}
      />
    </div>
  )
}

function typeLabel(t: StudioT, pt: string): string {
  if (pt === 'apparel') return t.productStudioTypeApparel
  if (pt === 'shoes') return t.productStudioTypeShoes
  if (pt === 'accessory') return t.productStudioTypeAccessory
  if (pt === 'household') return t.productStudioTypeHousehold
  if (pt === 'food') return t.productStudioTypeFood
  return t.productStudioTypeOther
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
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')
  const [step, setStep] = useState<WizardStep>(1)
  const [formError, setFormError] = useState('')

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [material, setMaterial] = useState('')
  const [gender, setGender] = useState('female')
  const [productType, setProductType] = useState<ProductStudioProductType>('apparel')
  const [sizes, setSizes] = useState<string[]>([])
  const [noSize, setNoSize] = useState(false)
  const [colors, setColors] = useState<ColorDraft[]>([newColorRow()])
  const [mainImage, setMainImage] = useState('')
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [stockQty, setStockQty] = useState('500')

  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const colorImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const wearable = isWearableProductType(productType)
  const steps = [t.productStudioStepAttrs, t.productStudioStepImages, t.productStudioStepPublish]
  const validColors = colors.filter((c) => c.name.trim() && c.img.trim())

  function resetForm() {
    setName('')
    setPrice('')
    setMaterial('')
    setGender('female')
    setProductType('apparel')
    setSizes([])
    setNoSize(false)
    setColors([newColorRow()])
    setMainImage('')
    setGalleryUrls([])
    setNotes('')
    setStockQty('500')
    setStep(1)
    setFormError('')
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
    setUploading(true)
    try {
      const url = await uploadFile(file)
      if (url) setMainImage(url)
    } finally {
      setUploading(false)
    }
  }

  async function onPickGalleryImages(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? [])
    ev.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const url = await uploadFile(file)
        if (url) urls.push(url)
      }
      if (urls.length) setGalleryUrls((prev) => [...prev, ...urls])
    } finally {
      setUploading(false)
    }
  }

  async function onPickColorImage(key: string, ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setColors((prev) => prev.map((c) => (c.key === key ? { ...c, uploading: true } : c)))
    try {
      const url = await uploadFile(file)
      setColors((prev) => prev.map((c) => (c.key === key ? { ...c, img: url || c.img, uploading: false } : c)))
    } catch {
      setColors((prev) => prev.map((c) => (c.key === key ? { ...c, uploading: false } : c)))
    }
  }

  function validateStep(s: WizardStep): string {
    if (s === 1) {
      if (!name.trim()) return t.productStudioRequiredName
      if (!material.trim()) return t.productStudioRequiredMaterial
      const p = Number(price.replace(/[^\d.]/g, ''))
      if (!Number.isFinite(p) || p <= 0) return t.productStudioRequiredPrice
    }
    if (s === 2) {
      if (!noSize && sizes.length === 0) return t.productStudioRequiredSizes
      if (!mainImage.trim()) return t.productStudioRequiredImage
      if (validColors.length < STUDIO_MIN_COLOR_IMAGES) return t.productStudioRequiredColor
      if (galleryUrls.length < STUDIO_MIN_GALLERY_IMAGES) return t.productStudioRequiredGallery
      if (colors.some((c) => c.img.trim() && !c.name.trim())) return t.productStudioColorNameMissing
    }
    return ''
  }

  function goNext() {
    const err = validateStep(step)
    if (err) {
      setFormError(err)
      return
    }
    setFormError('')
    setStep((s) => (s === 1 ? 2 : 3))
  }

  async function onSubmit() {
    const err = validateStep(1) || validateStep(2)
    if (err) {
      setFormError(err)
      setStep(err === t.productStudioRequiredName || err === t.productStudioRequiredMaterial || err === t.productStudioRequiredPrice ? 1 : 2)
      return
    }

    setFormError('')
    setSubmitting(true)
    try {
      const payload = {
        mode: 'manual' as const,
        price: Number(price.replace(/[^\d.]/g, '')),
        material: material.trim(),
        productName: name.trim(),
        productType,
        gender: wearable ? gender : '',
        style: '',
        sizes: noSize ? [] : sizes,
        noSize,
        colors: validColors.map((c) => ({ name: c.name.trim(), img: c.img.trim() })),
        available: Math.max(0, Number(stockQty) || 500),
        notes: notes.trim(),
        mainImage: mainImage.trim(),
        gallery: galleryUrls,
        images: galleryUrls,
      }
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/product-studio/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(data.error || 'Failed')
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
        onClick={() => {
          resetForm()
          setOpen(true)
        }}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t.productStudioOpenButton}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
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
              <ol className="flex flex-wrap gap-2 text-xs">
                {steps.map((label, i) => (
                  <li
                    key={label}
                    className={`rounded-full border px-2.5 py-1 ${step === i + 1 ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground'}`}
                  >
                    {i + 1}. {label}
                  </li>
                ))}
              </ol>

              {formError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">{t.productStudioManualModeHint}</p>
                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldProductType} *</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_STUDIO_PRODUCT_TYPES.map((pt) => (
                        <Button
                          key={pt}
                          type="button"
                          size="sm"
                          variant={productType === pt ? 'default' : 'outline'}
                          onClick={() => setProductType(pt)}
                        >
                          {typeLabel(t, pt)}
                        </Button>
                      ))}
                    </div>
                    {!wearable ? <p className="text-xs text-muted-foreground">{t.productStudioNonWearableHint}</p> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldName} *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={500}
                      placeholder={t.productStudioNamePlaceholder}
                    />
                  </div>
                  {wearable ? (
                    <div className="space-y-1.5">
                      <Label>{t.productStudioFieldGender}</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">{t.productStudioGenderFemale}</SelectItem>
                          <SelectItem value="male">{t.productStudioGenderMale}</SelectItem>
                          <SelectItem value="unisex">{t.productStudioGenderUnisex}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldMaterial} *</Label>
                    <Input value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={200} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t.productStudioFieldPrice} *</Label>
                      <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.productStudioFieldStock}</Label>
                      <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldNotes}</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    <p className="text-xs text-muted-foreground">{t.productStudioManualAiDescHint}</p>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  {uploading ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t.productStudioUploading}
                    </p>
                  ) : null}
                  <div className="space-y-2 border-b pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t.productStudioFieldSizes}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant={noSize ? 'default' : 'outline'}
                        onClick={() => {
                          setNoSize((v) => !v)
                          if (!noSize) setSizes([])
                        }}
                      >
                        {t.productStudioFieldNoSize}
                      </Button>
                    </div>
                    {!noSize ? (
                      <SizeChipsInput sizes={sizes} onChange={setSizes} placeholder={t.productStudioSizeChipPlaceholder} disabled={uploading} />
                    ) : (
                      <p className="text-xs text-muted-foreground">{t.productStudioFieldNoSize}</p>
                    )}
                  </div>

                  <div className="space-y-3 border-b pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t.productStudioFieldColors}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.productStudioColorRowHint}</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setColors((prev) => [...prev, newColorRow()])}>
                        <Plus className="h-3.5 w-3.5" />
                        {t.productStudioAddColor}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {colors.map((c, idx) => (
                        <div key={c.key} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start">
                          <div className="w-6 shrink-0 pt-2 text-xs text-muted-foreground">{idx + 1}</div>
                          <div className="shrink-0">
                            {c.img ? (
                              <Thumb url={c.img} onRemove={() => setColors((prev) => prev.map((x) => (x.key === c.key ? { ...x, img: '' } : x)))} />
                            ) : (
                              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed bg-muted/40 px-1 text-center text-[11px] text-muted-foreground">
                                {t.productStudioImageEmpty}
                              </div>
                            )}
                            <input
                              ref={(el) => {
                                colorImageInputRefs.current[c.key] = el
                              }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void onPickColorImage(c.key, e)}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-2"
                              disabled={c.uploading || uploading}
                              onClick={() => colorImageInputRefs.current[c.key]?.click()}
                            >
                              {c.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.productStudioColorImage}
                            </Button>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <Label>{t.productStudioColorName}</Label>
                            <Input
                              value={c.name}
                              placeholder={t.productStudioColorNamePlaceholder}
                              onChange={(e) =>
                                setColors((prev) => prev.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start text-destructive sm:mt-8"
                            onClick={() =>
                              setColors((prev) => (prev.length <= 1 ? [newColorRow()] : prev.filter((x) => x.key !== c.key)))
                            }
                          >
                            {t.productStudioRemove}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldMainImage} *</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {mainImage ? <Thumb url={mainImage} onRemove={() => setMainImage('')} /> : null}
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
                        disabled={uploading}
                        onClick={() => mainImageInputRef.current?.click()}
                      >
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.productStudioUploadButton}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.productStudioFieldGalleryMin}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {galleryUrls.map((url) => (
                        <Thumb key={url} url={url} onRemove={() => setGalleryUrls((prev) => prev.filter((u) => u !== url))} />
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
                        disabled={uploading}
                        onClick={() => galleryInputRef.current?.click()}
                      >
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.productStudioUploadButton}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                    <p>
                      <span className="font-medium">{t.productStudioFieldName}:</span> {name.trim() || '—'}
                    </p>
                    <p>
                      <span className="font-medium">{t.productStudioFieldMaterial}:</span> {material.trim() || '—'}
                    </p>
                    <p>
                      <span className="font-medium">{t.productStudioFieldPrice}:</span> {price || '—'}
                    </p>
                    <p>
                      <span className="font-medium">{t.productStudioFieldColors}:</span>{' '}
                      {validColors.length ? validColors.map((c) => c.name).join(', ') : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.productStudioManualAiDescHint}</p>
                  </div>
                  <Button type="button" className="w-full sm:w-auto" disabled={submitting || uploading} onClick={() => void onSubmit()}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t.productStudioSubmitting}
                      </>
                    ) : (
                      t.productStudioStartPublish
                    )}
                  </Button>
                </div>
              ) : null}

              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 1 || submitting}
                  onClick={() => {
                    setFormError('')
                    setStep((s) => (s === 3 ? 2 : 1))
                  }}
                >
                  {t.productStudioBack}
                </Button>
                {step < 3 ? (
                  <Button type="button" disabled={submitting || uploading} onClick={() => goNext()}>
                    {t.productStudioNext}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                    {t.productStudioCancel}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
