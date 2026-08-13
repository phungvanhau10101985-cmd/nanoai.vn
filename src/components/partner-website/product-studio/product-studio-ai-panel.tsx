'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, ThumbsUp, Upload, X } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  PRODUCT_STUDIO_PRODUCT_TYPES,
  PRODUCT_STUDIO_SHOT_STYLES,
  STUDIO_MIN_COLOR_IMAGES,
  STUDIO_MIN_GALLERY_IMAGES,
  STUDIO_MIN_MATERIAL_IMAGES,
  STUDIO_REF_PICKER_MAX,
  collectStudioSelectableImages,
  firstApprovedColor,
  isWearableProductType,
  studioCanPublish,
  studioColorCount,
  type ProductStudioJobRow,
  type ProductStudioProductType,
  type ProductStudioRefPoolItem,
  type ProductStudioSlotKind,
} from '@/lib/partner-website/product-studio/product-studio-types'

type T = Dictionary['partnerMessagingAi']
type WizardStep = 1 | 2 | 3
type PublishSelectionKind = 'gallery' | 'detail'

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const

function Thumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
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

function StudioRefPicker({
  items,
  selectedUrls,
  onChange,
  disabled,
  lockedUrls = [],
}: {
  items: ProductStudioRefPoolItem[]
  selectedUrls: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  lockedUrls?: string[]
}) {
  const locked = new Set(lockedUrls.filter(Boolean))
  if (!items.length) return <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">—</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const checked = selectedUrls.includes(item.url) || locked.has(item.url)
        const order = selectedUrls.indexOf(item.url)
        return (
          <button
            key={item.id || item.url}
            type="button"
            disabled={disabled || locked.has(item.url)}
            onClick={() => {
              if (locked.has(item.url)) return
              if (checked) onChange(selectedUrls.filter((u) => u !== item.url))
              else onChange([...selectedUrls.filter((u) => !locked.has(u)), item.url].slice(-STUDIO_REF_PICKER_MAX))
            }}
            className={`relative overflow-hidden rounded-lg border text-left ${checked ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" className="h-16 w-16 object-cover" />
            {checked ? (
              <span className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {order >= 0 ? order + 1 : '•'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function typeLabel(t: T, pt: string): string {
  if (pt === 'apparel') return t.productStudioTypeApparel
  if (pt === 'shoes') return t.productStudioTypeShoes
  if (pt === 'accessory') return t.productStudioTypeAccessory
  if (pt === 'household') return t.productStudioTypeHousehold
  if (pt === 'food') return t.productStudioTypeFood
  return t.productStudioTypeOther
}

function shotLabel(t: T, s: string): string {
  if (s === 'lifestyle') return t.productStudioShotLifestyle
  if (s === 'outdoor') return t.productStudioShotOutdoor
  return t.productStudioShotStudio
}

export function ProductStudioAiPanel({
  partnerId,
  t,
  onPublished,
}: {
  partnerId: string
  t: T
  onPublished: () => void
}) {
  const { toast } = useToast()
  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/product-studio`

  const [step, setStep] = useState<WizardStep>(1)
  const [job, setJob] = useState<ProductStudioJobRow | null>(null)
  const [sessions, setSessions] = useState<ProductStudioJobRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [studioBusy, setStudioBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')

  const [productType, setProductType] = useState<ProductStudioProductType>('apparel')
  const [gender, setGender] = useState('female')
  const [material, setMaterial] = useState('')
  const [price, setPrice] = useState('')
  const [available, setAvailable] = useState('500')
  const [noSize, setNoSize] = useState(false)
  const [sizes, setSizes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [modelPresence, setModelPresence] = useState<'none' | 'model'>('none')
  const [modelGender, setModelGender] = useState('')
  const [modelAgeGroup, setModelAgeGroup] = useState('')
  const [modelEthnicity, setModelEthnicity] = useState('')
  const [shotStyle, setShotStyle] = useState('studio')
  const [aspectRatio, setAspectRatio] = useState('1:1')

  const [formKind, setFormKind] = useState<ProductStudioSlotKind>('color')
  const [formPrompt, setFormPrompt] = useState('')
  const [formRefUrls, setFormRefUrls] = useState<string[]>([])
  const [formAttachUrl, setFormAttachUrl] = useState('')
  const attachInputRef = useRef<HTMLInputElement>(null)

  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectionKind, setSelectionKind] = useState<PublishSelectionKind>('gallery')
  const [selectionUrls, setSelectionUrls] = useState<string[]>([])
  const [galleryConfirmed, setGalleryConfirmed] = useState(false)

  const wearable = isWearableProductType(productType)
  const studio = job?.studio
  const currentSlot = studio?.currentSlot
  const pendingColorIndex = studio ? studioColorCount(studio) : 0
  const firstColor = studio ? firstApprovedColor(studio) : null
  const canPublish = studio ? studioCanPublish(studio) : false
  const awaitingApproval = job?.status === 'ready_for_review' && Boolean(currentSlot)
  const generating = job?.status === 'generating' || job?.status === 'publishing'

  const loadSessions = useCallback(async () => {
    const res = await fetch(`${base}/jobs?active=true`)
    const data = (await res.json().catch(() => ({}))) as { jobs?: ProductStudioJobRow[] }
    setSessions((data.jobs || []).filter((j) => j.mode === 'ai' && j.status !== 'done'))
  }, [base])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  async function uploadRef(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('purpose', 'ref')
    const res = await fetch(`${base}/upload-image`, { method: 'POST', body: fd })
    const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
    if (!res.ok || !data.publicUrl) {
      toast({ title: data.error || t.productStudioNeedAttach, variant: 'destructive' })
      return null
    }
    return data.publicUrl
  }

  function validateAttrs(): string {
    if (!material.trim()) return t.productStudioRequiredMaterial
    const p = Number(price.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(p) || p <= 0) return t.productStudioRequiredPrice
    return ''
  }

  function validateSettings(): string {
    if (!noSize && sizes.length === 0) return t.productStudioRequiredSizes
    if (wearable && modelPresence === 'model' && (!modelGender || !modelAgeGroup || !modelEthnicity)) {
      return t.productStudioRequiredModelFields
    }
    return ''
  }

  function goNext() {
    const err = step === 1 ? validateAttrs() : step === 2 ? validateSettings() : ''
    if (err) {
      setFormError(err)
      return
    }
    setFormError('')
    if (step === 2) {
      if (job && job.status !== 'failed' && job.status !== 'done') {
        setStep(3)
        return
      }
      void startAiStudio()
      return
    }
    setStep((s) => (s === 1 ? 2 : 3))
  }

  async function startAiStudio() {
    const err = validateAttrs() || validateSettings()
    if (err) {
      setFormError(err)
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const payload = {
        mode: 'ai' as const,
        price: Number(price.replace(/[^\d.]/g, '')),
        material: material.trim(),
        productName: '',
        productType,
        gender: wearable ? gender : '',
        style: '',
        sizes: noSize ? [] : sizes,
        noSize,
        colors: [],
        available: Math.max(0, Number(available) || 500),
        notes: notes.trim(),
        refImageUrls: [],
        aspectRatio,
        modelPresence: wearable ? modelPresence : ('none' as const),
        modelGender: wearable && modelPresence === 'model' ? modelGender : '',
        modelAgeGroup: wearable && modelPresence === 'model' ? modelAgeGroup : '',
        modelEthnicity: wearable && modelPresence === 'model' ? modelEthnicity : '',
        shotStyle,
      }
      const res = await fetch(`${base}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'create_failed')
      setJob(data.job)
      setStep(3)
      setFormKind('color')
      setFormAttachUrl('')
      setFormRefUrls([])
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function resumeJob(jobId: string) {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`)
    const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
    if (!res.ok || !data.job) {
      toast({ title: data.error || 'Error', variant: 'destructive' })
      return
    }
    setJob(data.job)
    setProductType(data.job.payload.productType)
    setGender(data.job.payload.gender || 'female')
    setMaterial(data.job.payload.material)
    setPrice(String(data.job.payload.price || ''))
    setAvailable(String(data.job.payload.available || 500))
    setNoSize(data.job.payload.noSize)
    setSizes(data.job.payload.sizes || [])
    setNotes(data.job.payload.notes || '')
    setModelPresence(data.job.payload.modelPresence === 'model' ? 'model' : 'none')
    setModelGender(data.job.payload.modelGender || '')
    setModelAgeGroup(data.job.payload.modelAgeGroup || '')
    setModelEthnicity(data.job.payload.modelEthnicity || '')
    setShotStyle(data.job.payload.shotStyle || 'studio')
    setAspectRatio(data.job.payload.aspectRatio || '1:1')
    setFormKind(data.job.studio.phase || 'color')
    setStep(3)
  }

  async function deleteSession(jobId: string) {
    await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
    await loadSessions()
    if (job?.id === jobId) {
      setJob(null)
      setStep(1)
    }
  }

  async function submitGenerate() {
    if (!job) return
    if (job.status === 'ready_for_review') {
      await regenerate()
      return
    }
    if (formKind === 'color' && !formAttachUrl.trim()) {
      setFormError(t.productStudioNeedAttach)
      return
    }
    if (formKind !== 'color' && formRefUrls.length === 0 && !formAttachUrl.trim()) {
      setFormError(t.productStudioNeedRefs)
      return
    }
    setFormError('')
    setStudioBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(job.id)}/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: formKind,
          prompt: formKind === 'color' ? formPrompt : '',
          refUrls: formRefUrls,
          attachUrl: formAttachUrl,
          aspectRatio: formKind === 'material' ? '4:3' : aspectRatio,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'generate_failed')
      setJob(data.job)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setStudioBusy(false)
    }
  }

  async function approve() {
    if (!job) return
    setStudioBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(job.id)}/images/approve`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'approve_failed')
      setJob(data.job)
      setFormAttachUrl('')
      if (formKind === 'color') {
        setFormRefUrls([])
        setFormPrompt(data.job.studio.colorUserPrompt || formPrompt)
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setStudioBusy(false)
    }
  }

  async function regenerate() {
    if (!job) return
    setStudioBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(job.id)}/images/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formPrompt,
          refUrls: formRefUrls,
          attachUrl: formAttachUrl.trim() || undefined,
          aspectRatio,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'regenerate_failed')
      setJob(data.job)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setStudioBusy(false)
    }
  }

  async function confirmSelection() {
    if (!job) return
    if (selectionKind === 'gallery' && selectionUrls.length < STUDIO_MIN_GALLERY_IMAGES) {
      setFormError(t.productStudioGalleryMinHint)
      return
    }
    setStudioBusy(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(job.id)}/images/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: selectionKind, urls: selectionUrls }),
      })
      const data = (await res.json().catch(() => ({}))) as { job?: ProductStudioJobRow; error?: string }
      if (!res.ok || !data.job) throw new Error(data.error || 'select_failed')
      setJob(data.job)
      if (selectionKind === 'gallery') {
        setGalleryConfirmed(true)
        setSelectionKind('detail')
        setSelectionUrls([])
      } else {
        setSelectorOpen(false)
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setStudioBusy(false)
    }
  }

  async function onPublish() {
    if (!job) return
    if (!galleryConfirmed) {
      setSelectorOpen(true)
      setSelectionKind('gallery')
      setSelectionUrls(job.studio.gallery)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${base}/jobs/${encodeURIComponent(job.id)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'publish_failed')
      toast({ title: t.productStudioSuccess })
      onPublished()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const refPickerItems = useMemo(() => studio?.refPool || [], [studio])
  const selectable = useMemo(() => (studio ? collectStudioSelectableImages(studio) : []), [studio])

  const steps = [t.productStudioStepAttrs, t.productStudioStepStudioSettings, t.productStudioStepStudio]

  return (
    <div className="space-y-4 pt-2">
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

      {step === 1 && sessions.length > 0 && !job ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium">{t.productStudioResumeTitle}</p>
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5">
              <span className="truncate text-xs">
                {s.visionProductName || s.payload.material || s.id.slice(0, 8)} · {s.status}
              </span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => void resumeJob(s.id)}>
                  {t.productStudioResumeContinue}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void deleteSession(s.id)}>
                  {t.productStudioResumeDelete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {formError ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p> : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t.productStudioAiModeHint}</p>
          <div className="space-y-1.5">
            <Label>{t.productStudioFieldProductType}</Label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_STUDIO_PRODUCT_TYPES.map((pt) => (
                <Button
                  key={pt}
                  type="button"
                  size="sm"
                  variant={productType === pt ? 'default' : 'outline'}
                  onClick={() => {
                    setProductType(pt)
                    if (!isWearableProductType(pt)) {
                      setModelPresence('none')
                      setModelGender('')
                      setModelAgeGroup('')
                      setModelEthnicity('')
                    }
                  }}
                >
                  {typeLabel(t, pt)}
                </Button>
              ))}
            </div>
            {!wearable ? <p className="text-xs text-muted-foreground">{t.productStudioNonWearableHint}</p> : null}
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
            <Label>{t.productStudioFieldMaterial}</Label>
            <Input value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.productStudioFieldPrice}</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.productStudioFieldStock}</Label>
              <Input value={available} onChange={(e) => setAvailable(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
            {t.productStudioNoUploadHere}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.productStudioFieldSizes}</Label>
              <Button type="button" size="sm" variant={noSize ? 'default' : 'outline'} onClick={() => { setNoSize((v) => !v); if (!noSize) setSizes([]) }}>
                {t.productStudioFieldNoSize}
              </Button>
            </div>
            {!noSize ? <SizeChipsInput sizes={sizes} onChange={setSizes} placeholder={t.productStudioSizeChipPlaceholder} /> : null}
          </div>
          {wearable ? (
            <>
              <div className="space-y-1.5">
                <Label>{t.productStudioModelPresenceLabel}</Label>
                <Select
                  value={modelPresence}
                  onValueChange={(v) => {
                    const next = v === 'model' ? 'model' : 'none'
                    setModelPresence(next)
                    if (next === 'none') {
                      setModelGender('')
                      setModelAgeGroup('')
                      setModelEthnicity('')
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.productStudioModelNone}</SelectItem>
                    <SelectItem value="model">{t.productStudioModelYes}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modelPresence === 'model' ? (
                <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t.productStudioModelGender}</Label>
                    <Select value={modelGender} onValueChange={setModelGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">{t.productStudioGenderFemale}</SelectItem>
                        <SelectItem value="male">{t.productStudioGenderMale}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.productStudioModelAge}</Label>
                    <Select value={modelAgeGroup} onValueChange={setModelAgeGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baby">{t.productStudioModelAgeBaby}</SelectItem>
                        <SelectItem value="child">{t.productStudioModelAgeChild}</SelectItem>
                        <SelectItem value="teen">{t.productStudioModelAgeTeen}</SelectItem>
                        <SelectItem value="adult">{t.productStudioModelAgeAdult}</SelectItem>
                        <SelectItem value="middle_aged">{t.productStudioModelAgeMiddle}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t.productStudioModelEthnicity}</Label>
                    <Select value={modelEthnicity} onValueChange={setModelEthnicity}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asian">{t.productStudioModelEthnicityAsian}</SelectItem>
                        <SelectItem value="western">{t.productStudioModelEthnicityWestern}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t.productStudioNonWearableHint}</p>
          )}
          <div className="space-y-1.5">
            <Label>{t.productStudioShotStyleLabel}</Label>
            <Select value={shotStyle} onValueChange={setShotStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STUDIO_SHOT_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {shotLabel(t, s)}
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
            <Label>{t.productStudioFieldNotes}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <input
            ref={attachInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setUploading(true)
              const url = await uploadRef(file)
              if (url) setFormAttachUrl(url)
              setUploading(false)
            }}
          />
          {generating ? (
            <div className="flex h-40 items-center justify-center rounded-lg border">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {awaitingApproval && currentSlot ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {currentSlot.kind}
                {currentSlot.name ? ` — ${currentSlot.name}` : ''}
              </p>
              {currentSlot.candidateUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentSlot.candidateUrl} alt="" className="mx-auto max-h-72 rounded-md border object-contain" />
              ) : (
                <p className="text-sm text-destructive">{currentSlot.error || job?.errorMessage}</p>
              )}
              {currentSlot.kind === 'color' ? (
                <div className="space-y-2">
                  {pendingColorIndex >= 1 && firstColor?.img ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">{t.productStudioFaceLockLabel}</p>
                      <Thumb url={firstColor.img} />
                    </div>
                  ) : null}
                  {formAttachUrl ? <Thumb url={formAttachUrl} onRemove={() => setFormAttachUrl('')} /> : null}
                  <Button type="button" size="sm" variant="secondary" disabled={studioBusy || uploading} onClick={() => attachInputRef.current?.click()}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {t.productStudioSampleImage}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <StudioRefPicker items={refPickerItems} selectedUrls={formRefUrls} onChange={setFormRefUrls} disabled={studioBusy} />
                  {formAttachUrl ? <Thumb url={formAttachUrl} onRemove={() => setFormAttachUrl('')} /> : null}
                  <Button type="button" size="sm" variant="secondary" disabled={studioBusy || uploading} onClick={() => attachInputRef.current?.click()}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {t.productStudioSampleImage}
                  </Button>
                </div>
              )}
              {formKind === 'color' && pendingColorIndex < 1 ? (
                <Textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} rows={2} placeholder={t.productStudioPromptColorPlaceholder} />
              ) : null}
              <div className="flex gap-2">
                <Button type="button" disabled={studioBusy || !currentSlot.candidateUrl} onClick={() => void approve()}>
                  <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                  {t.productStudioApproveContinue}
                </Button>
                <Button type="button" variant="outline" disabled={studioBusy} onClick={() => void regenerate()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {t.productStudioRegenerate}
                </Button>
              </div>
            </div>
          ) : null}

          {job && !generating && !awaitingApproval ? (
            <div className="space-y-3">
              {job.visionProductName ? (
                <p className="text-sm">
                  <span className="font-medium">{t.productStudioSeoName}:</span> {job.visionProductName}
                </p>
              ) : null}
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t.productStudioShotLocked}: {shotLabel(t, job.payload.shotStyle || 'studio')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['color', t.productStudioTabColor],
                    ['gallery', t.productStudioTabGallery],
                    ['material', t.productStudioTabMaterial],
                    ['detail', t.productStudioTabDetail],
                  ] as const
                ).map(([k, label]) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={formKind === k ? 'default' : 'outline'}
                    onClick={() => {
                      setFormKind(k)
                      setFormPrompt(k === 'color' ? studio?.colorUserPrompt || '' : '')
                      setFormAttachUrl('')
                      const last = studio?.lastRefUrls?.[k] || []
                      setFormRefUrls(last.length ? last : (studio?.refPool || []).map((p) => p.url).slice(0, STUDIO_REF_PICKER_MAX))
                    }}
                  >
                    {label}
                    {k === 'detail' ? <span className="ml-1 opacity-70">({t.productStudioTabDetailOptional})</span> : null}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{t.productStudioSwitchTabHint}</p>
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs dark:border-sky-900 dark:bg-sky-950">
                {formKind === 'color'
                  ? pendingColorIndex === 0
                    ? t.productStudioColorFirstHint
                    : t.productStudioColorNextHint
                  : formKind === 'gallery'
                    ? t.productStudioGalleryHint
                    : formKind === 'detail'
                      ? t.productStudioDetailHint
                      : t.productStudioMaterialHint}
              </p>
              {formKind === 'color' && pendingColorIndex >= 1 && firstColor?.img ? (
                <div>
                  <p className="mb-1 text-sm font-medium">{t.productStudioFaceLockLabel}</p>
                  <Thumb url={firstColor.img} />
                </div>
              ) : null}
              {formKind === 'color' ? (
                <div>
                  <Label>{pendingColorIndex >= 1 ? t.productStudioSampleImageNew : t.productStudioSampleImage}</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {formAttachUrl ? <Thumb url={formAttachUrl} onRemove={() => setFormAttachUrl('')} /> : null}
                    <Button type="button" size="sm" variant="secondary" disabled={uploading || studioBusy} onClick={() => attachInputRef.current?.click()}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {t.productStudioUploadButton}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>{t.productStudioPickRefs}</Label>
                  <div className="mt-2 space-y-2">
                    <StudioRefPicker items={refPickerItems} selectedUrls={formRefUrls} onChange={setFormRefUrls} disabled={studioBusy} />
                    {formAttachUrl ? <Thumb url={formAttachUrl} onRemove={() => setFormAttachUrl('')} /> : null}
                    <Button type="button" size="sm" variant="secondary" disabled={uploading || studioBusy} onClick={() => attachInputRef.current?.click()}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {t.productStudioUploadButton}
                    </Button>
                  </div>
                </div>
              )}
              {formKind === 'color' && pendingColorIndex < 1 ? (
                <Textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} rows={2} placeholder={t.productStudioPromptColorPlaceholder} />
              ) : null}
              <Button type="button" disabled={studioBusy || uploading} onClick={() => void submitGenerate()}>
                {studioBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t.productStudioGenerate}
              </Button>
            </div>
          ) : null}

          {job && job.status !== 'done' ? (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">{t.productStudioProgressTitle}</p>
              <ul className="space-y-1 text-sm">
                <li className={studio && studioColorCount(studio) >= STUDIO_MIN_COLOR_IMAGES ? 'text-emerald-700' : ''}>
                  {t.productStudioProgressColor}: {studio ? studioColorCount(studio) : 0}/{STUDIO_MIN_COLOR_IMAGES}
                </li>
                <li className={studio && studio.gallery.length >= STUDIO_MIN_GALLERY_IMAGES ? 'text-emerald-700' : ''}>
                  {t.productStudioProgressGallery}: {studio?.gallery.length || 0}/{STUDIO_MIN_GALLERY_IMAGES}
                </li>
                <li className={studio?.materialImage ? 'text-emerald-700' : ''}>
                  {t.productStudioProgressMaterial}: {studio?.materialImage ? 1 : 0}/{STUDIO_MIN_MATERIAL_IMAGES}
                </li>
                <li className="text-muted-foreground">
                  {t.productStudioProgressDetail}: {studio?.detail.length || 0} ({t.productStudioTabDetailOptional})
                </li>
              </ul>
              {studio?.refPool.length ? (
                <div className="flex flex-wrap gap-2">
                  {studio.refPool.map((item) => (
                    <div key={item.id || item.url} className="text-center">
                      <Thumb url={item.url} />
                      <div className="mt-0.5 max-w-[5rem] truncate text-[10px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {selectorOpen && selectable.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950">
                  <p className="text-sm font-medium">
                    {selectionKind === 'gallery' ? t.productStudioSelectGalleryStep : t.productStudioSelectDetailStep}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {selectable.map((item) => {
                      const order = selectionUrls.indexOf(item.url)
                      const selected = order >= 0
                      return (
                        <button
                          key={item.url}
                          type="button"
                          onClick={() =>
                            setSelectionUrls((prev) => (selected ? prev.filter((u) => u !== item.url) : [...prev, item.url]))
                          }
                          className={`relative overflow-hidden rounded-lg border ${selected ? 'border-primary ring-2 ring-primary/30' : ''}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                          {selected ? (
                            <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              {order + 1}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectionKind === 'gallery' ? t.productStudioGalleryMinHint : t.productStudioDetailOptionalHint}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={studioBusy} onClick={() => void confirmSelection()}>
                      {selectionKind === 'detail' && selectionUrls.length === 0 ? t.productStudioSkipDetail : t.productStudioConfirmSelection}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelectorOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{t.productStudioMinPublishHint}</p>
              <Button type="button" className="w-full" disabled={submitting || studioBusy || !canPublish} onClick={() => void onPublish()}>
                {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t.productStudioSubmit}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {step < 3 ? (
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" disabled={step === 1 || submitting} onClick={() => { setFormError(''); setStep((s) => (s === 2 ? 1 : 2)) }}>
            {t.productStudioBack}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void goNext()}>
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {step === 2 ? t.productStudioStartStudio : t.productStudioNext}
          </Button>
        </div>
      ) : (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={submitting || studioBusy}
            onClick={() => {
              setFormError('')
              setStep(2)
            }}
          >
            {t.productStudioBack}
          </Button>
        </div>
      )}
    </div>
  )
}
