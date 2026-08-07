'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { Loader2, MessageCircleQuestion, Star, Trash2 } from 'lucide-react'

/**
 * M1.2/M1.3 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — quản trị đánh giá + hỏi đáp sản phẩm.
 * Xem docs/188_BEHAVIOR_SPEC.md mục C.3 — inline auto-save debounce ~0.7s, review có xoá hàng loạt
 * (Q&A thì không, theo đúng hành vi 188).
 */

const AUTOSAVE_DEBOUNCE_MS = 700

type ReviewRow = {
  id: string
  inventoryId: string
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
  isActive: boolean
  usefulCount: number
  merchantReply: string
  merchantReplyBy: string
  createdAt: string
}

type AnswerRow = {
  id: string
  answerType: 'buyer' | 'admin'
  responderName: string
  content: string
  isVerified: boolean
  isActive: boolean
}

type QuestionRow = {
  id: string
  inventoryId: string
  askerName: string
  content: string
  isActive: boolean
  createdAt: string
  answers: AnswerRow[]
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

function useDebouncedSave() {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  return useCallback((key: string, fn: () => void) => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key)
        fn()
      }, AUTOSAVE_DEBOUNCE_MS)
    )
  }, [])
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: '#f59e0b' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= rating ? '#f59e0b' : 'none'} />
      ))}
    </span>
  )
}

export function PartnerWebsiteReviewsQaPanel({ t, partnerId, sectionId, onToast }: Props) {
  const [tab, setTab] = useState<'reviews' | 'qa'>('reviews')
  const [loading, setLoading] = useState(true)

  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [ratingFilter, setRatingFilter] = useState(0)
  const [savingReviewIds, setSavingReviewIds] = useState<Set<string>>(new Set())

  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [savingQuestionIds, setSavingQuestionIds] = useState<Set<string>>(new Set())
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyBusy, setReplyBusy] = useState<Set<string>>(new Set())

  const debounced = useDebouncedSave()
  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}`

  const loadReviews = useCallback(
    async (page: number, rating: number) => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (rating) qs.set('rating', String(rating))
      const res = await fetch(`${basePath}/reviews?${qs.toString()}`)
      const json = (await res.json().catch(() => null)) as { reviews?: ReviewRow[]; total?: number } | null
      if (json) {
        setReviews(json.reviews ?? [])
        setReviewsTotal(json.total ?? 0)
      }
    },
    [basePath]
  )

  const loadQuestions = useCallback(
    async (page: number) => {
      const res = await fetch(`${basePath}/questions?page=${page}&pageSize=10`)
      const json = (await res.json().catch(() => null)) as { questions?: QuestionRow[]; total?: number } | null
      if (json) {
        setQuestions(json.questions ?? [])
        setQuestionsTotal(json.total ?? 0)
      }
    },
    [basePath]
  )

  useEffect(() => {
    setLoading(true)
    void Promise.all([loadReviews(1, ratingFilter), loadQuestions(1)]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  function markSaving(setFn: typeof setSavingReviewIds, id: string, on: boolean) {
    setFn((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function patchReviewLocal(id: string, patch: Partial<ReviewRow>) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function saveReviewPatch(id: string, body: Record<string, unknown>) {
    markSaving(setSavingReviewIds, id, true)
    try {
      const res = await fetch(`${basePath}/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onToast?.(t.reviewsAdminSaved)
    } finally {
      markSaving(setSavingReviewIds, id, false)
    }
  }

  function onReviewFieldChange(id: string, field: 'title' | 'content' | 'merchantReply', value: string) {
    patchReviewLocal(id, { [field]: value } as Partial<ReviewRow>)
    debounced(`review:${id}:${field}`, () => void saveReviewPatch(id, { [field]: value }))
  }

  async function onReviewActiveToggle(id: string, isActive: boolean) {
    patchReviewLocal(id, { isActive })
    await saveReviewPatch(id, { isActive })
  }

  async function deleteReview(id: string) {
    if (!window.confirm(t.reviewsAdminDeleteConfirm)) return
    const res = await fetch(`${basePath}/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== id))
      setReviewsTotal((prev) => Math.max(0, prev - 1))
    }
  }

  async function deleteAllReviews() {
    if (!window.confirm(t.reviewsAdminDeleteAllConfirm)) return
    const res = await fetch(`${basePath}/reviews`, { method: 'DELETE' })
    if (res.ok) {
      setReviews([])
      setReviewsTotal(0)
      onToast?.(t.reviewsAdminSaved)
    }
  }

  function patchQuestionLocal(id: string, patch: Partial<QuestionRow>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  async function saveQuestionPatch(id: string, body: Record<string, unknown>) {
    markSaving(setSavingQuestionIds, id, true)
    try {
      const res = await fetch(`${basePath}/questions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onToast?.(t.reviewsAdminSaved)
    } finally {
      markSaving(setSavingQuestionIds, id, false)
    }
  }

  function onQuestionContentChange(id: string, value: string) {
    patchQuestionLocal(id, { content: value })
    debounced(`question:${id}:content`, () => void saveQuestionPatch(id, { content: value }))
  }

  async function onQuestionActiveToggle(id: string, isActive: boolean) {
    patchQuestionLocal(id, { isActive })
    await saveQuestionPatch(id, { isActive })
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm(t.qaAdminDeleteConfirm)) return
    const res = await fetch(`${basePath}/questions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      setQuestionsTotal((prev) => Math.max(0, prev - 1))
    }
  }

  async function submitAdminAnswer(questionId: string) {
    const content = (replyDrafts[questionId] ?? '').trim()
    if (!content) return
    setReplyBusy((prev) => new Set(prev).add(questionId))
    try {
      const res = await fetch(`${basePath}/questions/${encodeURIComponent(questionId)}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; answer?: AnswerRow } | null
      if (json?.ok && json.answer) {
        patchQuestionLocal(questionId, {
          answers: [json.answer, ...(questions.find((q) => q.id === questionId)?.answers ?? [])],
        })
        setReplyDrafts((prev) => ({ ...prev, [questionId]: '' }))
      }
    } finally {
      setReplyBusy((prev) => {
        const next = new Set(prev)
        next.delete(questionId)
        return next
      })
    }
  }

  async function deleteAnswer(questionId: string, answerId: string) {
    const res = await fetch(
      `${basePath}/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      patchQuestionLocal(questionId, {
        answers: (questions.find((q) => q.id === questionId)?.answers ?? []).filter((a) => a.id !== answerId),
      })
    }
  }

  return (
    <Card id={sectionId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5" />
          {t.reviewsAdminTitle}
        </CardTitle>
        <CardDescription>{t.reviewsAdminHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'reviews' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab('reviews')}
          >
            {t.reviewsAdminTitle} ({reviewsTotal})
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'qa' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab('qa')}
          >
            {t.qaAdminTitle} ({questionsTotal})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> ...
          </div>
        ) : tab === 'reviews' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={ratingFilter}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setRatingFilter(v)
                  setReviewsPage(1)
                  void loadReviews(1, v)
                }}
              >
                <option value={0}>{t.reviewsAdminFilterAll}</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ★
                  </option>
                ))}
              </select>
              {reviews.length > 0 ? (
                <Button variant="destructive" size="sm" onClick={() => void deleteAllReviews()}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t.reviewsAdminDeleteAll}
                </Button>
              ) : null}
            </div>

            {reviews.length === 0 ? (
              <p className="text-sm text-gray-500">{t.reviewsAdminEmpty}</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{r.reviewerName}</strong>
                      <StarRow rating={r.rating} />
                      {savingReviewIds.has(r.id) ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" /> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        {t.reviewsAdminActiveLabel}
                        <Switch checked={r.isActive} onCheckedChange={(v) => void onReviewActiveToggle(r.id, v)} />
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => void deleteReview(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={r.content}
                    onChange={(e) => onReviewFieldChange(r.id, 'content', e.target.value)}
                    rows={2}
                  />
                  {r.imageUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {r.imageUrls.map((url) => (
                        <img key={url} src={url} alt="" className="h-14 w-14 rounded object-cover" />
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500">{t.reviewsAdminReplyLabel}</p>
                    <Textarea
                      value={r.merchantReply}
                      onChange={(e) => onReviewFieldChange(r.id, 'merchantReply', e.target.value)}
                      placeholder={t.reviewsAdminReplyPlaceholder}
                      rows={2}
                    />
                  </div>
                </div>
              ))
            )}

            {reviews.length < reviewsTotal ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = reviewsPage + 1
                  setReviewsPage(next)
                  void (async () => {
                    const qs = new URLSearchParams({ page: String(next), pageSize: '10' })
                    if (ratingFilter) qs.set('rating', String(ratingFilter))
                    const res = await fetch(`${basePath}/reviews?${qs.toString()}`)
                    const json = (await res.json().catch(() => null)) as { reviews?: ReviewRow[] } | null
                    if (json?.reviews) setReviews((prev) => [...prev, ...json.reviews!])
                  })()
                }}
              >
                +10
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {questions.length === 0 ? (
              <p className="text-sm text-gray-500">{t.qaAdminEmpty}</p>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{q.askerName}</strong>
                      {savingQuestionIds.has(q.id) ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" /> : null}
                    </div>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      {t.qaAdminActiveLabel}
                      <Switch checked={q.isActive} onCheckedChange={(v) => void onQuestionActiveToggle(q.id, v)} />
                    </label>
                  </div>
                  <Textarea
                    value={q.content}
                    onChange={(e) => onQuestionContentChange(q.id, e.target.value)}
                    rows={2}
                  />
                  <div className="ml-3 space-y-2 border-l-2 border-gray-100 pl-3">
                    {q.answers.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <strong>{a.responderName}</strong>{' '}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ${a.answerType === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}
                          >
                            {a.answerType}
                          </span>
                          <p className="mt-1">{a.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteAnswer(q.id, a.id)}
                          aria-label="delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Textarea
                        value={replyDrafts[q.id] ?? ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={t.qaAdminReplyPlaceholder}
                        rows={1}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={replyBusy.has(q.id) || !(replyDrafts[q.id] ?? '').trim()}
                        onClick={() => void submitAdminAnswer(q.id)}
                      >
                        {t.qaAdminReplyButton}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => void deleteQuestion(q.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {questions.length < questionsTotal ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = questionsPage + 1
                  setQuestionsPage(next)
                  void (async () => {
                    const res = await fetch(`${basePath}/questions?page=${next}&pageSize=10`)
                    const json = (await res.json().catch(() => null)) as { questions?: QuestionRow[] } | null
                    if (json?.questions) setQuestions((prev) => [...prev, ...json.questions!])
                  })()
                }}
              >
                +10
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
