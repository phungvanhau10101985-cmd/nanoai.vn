'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Copy, Link2, Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type ClassItem = { id: string; name: string; schoolName: string }

type AttachExamToClassDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceSessionId: string
  /** Khi mở từ trang một lớp: ẩn lớp hiện tại khỏi danh sách */
  excludeClassId?: string | null
  examTitle?: string | null
  tc: Dictionary['classes']
  onSuccess?: () => void
  /** Tuỳ chọn: ví dụ bài tập về nhà thay vì đề thi */
  copyOverrides?: {
    pickTitle?: string
    pickDescription?: string
    sessionLabel?: string
  }
}

export function AttachExamToClassDialog({
  open,
  onOpenChange,
  sourceSessionId,
  excludeClassId,
  examTitle,
  tc,
  onSuccess,
  copyOverrides,
}: AttachExamToClassDialogProps) {
  const { toast } = useToast()
  const pickTitle = copyOverrides?.pickTitle ?? tc.examAttachPickClassTitle
  const pickDescription = copyOverrides?.pickDescription ?? tc.examAttachPickClassDescription
  const sessionLabel = copyOverrides?.sessionLabel ?? tc.examAttachExamLabel
  const [step, setStep] = useState<'pick' | 'done'>('pick')
  const [reloadKey, setReloadKey] = useState(0)
  const [allClasses, setAllClasses] = useState<ClassItem[]>([])
  const [occupiedClassIds, setOccupiedClassIds] = useState<string[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    examUrl: string
    code: string
    className: string
    schoolName: string
    qrDataUrl: string | null
  } | null>(null)

  const loadingPick = loadingClasses || loadingMeta

  const choices = useMemo(() => {
    const ex = excludeClassId?.trim().toLowerCase()
    const occ = new Set(occupiedClassIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
    return allClasses.filter((c) => {
      const cid = c.id.trim().toLowerCase()
      if (ex && cid === ex) return false
      if (occ.has(cid)) return false
      return true
    })
  }, [allClasses, excludeClassId, occupiedClassIds])

  const othersExcludingPageClass = useMemo(() => {
    const ex = excludeClassId?.trim()
    if (!ex) return allClasses
    return allClasses.filter((c) => c.id !== ex)
  }, [allClasses, excludeClassId])

  type EmptyKind = 'no-classes' | 'no-other-class' | 'all-attached'
  const emptyKind: EmptyKind | null = useMemo(() => {
    if (loadingPick || choices.length > 0) return null
    if (allClasses.length === 0) return 'no-classes'
    if (othersExcludingPageClass.length === 0) return 'no-other-class'
    return 'all-attached'
  }, [loadingPick, choices.length, allClasses.length, othersExcludingPageClass.length])

  const showEmptyState = emptyKind !== null

  useEffect(() => {
    if (!open) {
      setStep('pick')
      setResult(null)
      setSelectedClassId('')
      setSubmitting(false)
      setAllClasses([])
      setOccupiedClassIds([])
      setReloadKey(0)
      return
    }
    setStep('pick')
    setResult(null)
    setSelectedClassId('')
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    const sid = sourceSessionId.trim()
    if (!sid) return

    let cancelled = false
    setLoadingClasses(true)
    setLoadingMeta(true)

    const mineP = fetch('/api/classes/mine', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { items?: Array<{ id: string; name: string; schoolName?: string }> }) => {
        if (cancelled) return
        const items = (data.items ?? []).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          schoolName: String(c.schoolName ?? ''),
        }))
        setAllClasses(items)
      })
      .catch(() => {
        if (!cancelled) setAllClasses([])
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false)
      })

    const metaP = fetch(`/api/exam-session/attach-meta?sourceSessionId=${encodeURIComponent(sid)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data: { occupiedClassIds?: string[] }) => {
        if (cancelled) return
        const raw = data.occupiedClassIds
        setOccupiedClassIds(Array.isArray(raw) ? raw.map((x) => String(x)) : [])
      })
      .catch(() => {
        if (!cancelled) setOccupiedClassIds([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })

    void Promise.all([mineP, metaP])

    return () => {
      cancelled = true
    }
  }, [open, sourceSessionId, excludeClassId, reloadKey])

  useEffect(() => {
    if (loadingPick || !open) return
    const first = choices[0]?.id ?? ''
    setSelectedClassId((prev) => {
      if (prev && choices.some((c) => c.id === prev)) return prev
      return first
    })
  }, [loadingPick, open, choices])

  const reloadLists = () => setReloadKey((k) => k + 1)

  const handleAttach = async () => {
    if (!selectedClassId) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/exam-session/attach-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSessionId: sourceSessionId.trim(), classId: selectedClassId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; examUrl?: string; code?: string; className?: string; schoolName?: string }
      if (res.status === 409) {
        throw new Error(tc.examAttachClassAlreadyHasExam)
      }
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' && data.error.trim() ? data.error : tc.examAttachFailed)
      }
      const examUrl = String(data.examUrl ?? '')
      if (!examUrl) throw new Error(tc.examAttachFailed)
      let qrDataUrl: string | null = null
      try {
        qrDataUrl = await QRCode.toDataURL(examUrl, { width: 220, margin: 2 })
      } catch {
        qrDataUrl = null
      }
      setResult({
        examUrl,
        code: String(data.code ?? ''),
        className: String(data.className ?? ''),
        schoolName: String(data.schoolName ?? ''),
        qrDataUrl,
      })
      setStep('done')
      onSuccess?.()
      toast({ title: tc.examShareDone })
    } catch (e) {
      const msg = e instanceof Error ? e.message : tc.examAttachFailed
      toast({ variant: 'destructive', title: tc.examAttachFailed, description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = () => {
    if (!result?.examUrl) return
    void navigator.clipboard.writeText(result.examUrl)
    toast({ title: tc.examStudentDoLinkCopied })
  }

  const classLine =
    result && (result.schoolName.trim() ? `${result.className} · ${result.schoolName}` : result.className)

  const createClassNewTabButton = (
    <Button type="button" variant="secondary" className="w-full sm:w-auto gap-1.5" asChild>
      <Link href="/lop/tao" target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {tc.examAttachOpenCreateClassNewTab}
      </Link>
    </Button>
  )

  const reloadButton = (
    <Button type="button" variant="outline" className="w-full sm:w-auto gap-1.5" onClick={reloadLists}>
      <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {tc.examAttachReloadClassList}
    </Button>
  )

  const emptyBody =
    emptyKind === 'no-classes'
      ? tc.examAttachNoClassesBody
      : emptyKind === 'no-other-class'
        ? tc.examAttachNoOtherClassesBody
        : emptyKind === 'all-attached'
          ? tc.examAttachAllClassesAlreadyAttachedBody
          : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        {step === 'pick' ? (
          <>
            <DialogHeader>
              <DialogTitle>{pickTitle}</DialogTitle>
              <DialogDescription>{pickDescription}</DialogDescription>
              <div className="space-y-1.5 pt-2">
                <Label className="text-muted-foreground">{sessionLabel}</Label>
                <p className="text-sm font-medium text-foreground">{examTitle?.trim() || '—'}</p>
              </div>
            </DialogHeader>

            {loadingPick ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                {tc.examAttachLoadingClasses}
              </div>
            ) : showEmptyState ? (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">{emptyBody}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {createClassNewTabButton}
                  {reloadButton}
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="attach-exam-class-select">{tc.examAttachSelectClassLabel}</Label>
                  <select
                    id="attach-exam-class-select"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">{tc.examAttachSelectClassPlaceholder}</option>
                    {choices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.schoolName.trim() ? `${c.name} · ${c.schoolName}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tc.examAttachNeedDifferentClassHint}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {reloadButton}
                  {createClassNewTabButton}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tc.examAttachClose}
              </Button>
              {!loadingPick && !showEmptyState ? (
                <Button type="button" disabled={!selectedClassId || submitting} onClick={() => void handleAttach()}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {tc.examAttachWorking}
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" aria-hidden />
                      {tc.examAttachSubmit}
                    </>
                  )}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{tc.examStudentShareDialogTitle}</DialogTitle>
              <div className="space-y-1.5 pt-1">
                <Label className="text-muted-foreground">{sessionLabel}</Label>
                <p className="text-sm font-medium text-foreground">{examTitle?.trim() || '—'}</p>
              </div>
              <DialogDescription>{tc.examStudentShareDialogDescription}</DialogDescription>
              {result ? (
                <p className="pt-1 text-sm font-medium text-foreground">
                  {tc.examAttachSuccessSummary.replace('{classLine}', classLine || '—')}
                </p>
              ) : null}
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex min-h-[220px] w-full max-w-[220px] items-center justify-center rounded-lg border border-border bg-muted/30 p-2">
                {result?.qrDataUrl ? (
                  <Image
                    src={result.qrDataUrl}
                    alt=""
                    width={220}
                    height={220}
                    className="h-[220px] w-[220px] rounded-md border border-border bg-white p-1"
                    unoptimized
                  />
                ) : (
                  <p className="px-2 text-center text-xs text-muted-foreground">{tc.examStudentShareUrlLabel}</p>
                )}
              </div>
              <div className="w-full space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tc.examStudentShareUrlLabel}</p>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 break-all rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                    {result?.examUrl ?? ''}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label={tc.examStudentDoLinkCopy}
                    disabled={!result?.examUrl}
                    onClick={copyLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep('pick')
                  setResult(null)
                  reloadLists()
                }}
              >
                {tc.examAttachPickAnotherClass}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {tc.examAttachClose}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
