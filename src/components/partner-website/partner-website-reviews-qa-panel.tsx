'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { partnerSiteStorefrontProductHref } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  qaPublicBuyerReplyCount,
  splitQaReplySlots,
} from '@/lib/partner-website/reviews/partner-review-types'

const PAGE_SIZE = 10
const AUTOSAVE_DEBOUNCE_MS = 700
const COL_WIDTHS_STORAGE_KEY = 'pw_admin_product_questions_column_widths'

const QA_COLUMN_KEYS = [
  'stt',
  'view',
  'user_name',
  'content',
  'group',
  'is_active',
  'useful',
  'reply_admin_name',
  'reply_admin_content',
  'reply_user_one_name',
  'reply_user_one_content',
  'reply_user_two_name',
  'reply_user_two_content',
  'actions',
  'created_at',
  'product_id',
  'updated_at',
  'reply_admin_at',
  'reply_user_one_id',
  'reply_user_one_at',
  'reply_user_two_id',
  'reply_user_two_at',
  'reply_count',
] as const

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  stt: 44,
  view: 88,
  user_name: 110,
  content: 140,
  group: 52,
  is_active: 88,
  useful: 88,
  reply_admin_name: 120,
  reply_admin_content: 150,
  reply_user_one_name: 90,
  reply_user_one_content: 110,
  reply_user_two_name: 90,
  reply_user_two_content: 110,
  actions: 72,
  created_at: 115,
  product_id: 56,
  updated_at: 115,
  reply_admin_at: 115,
  reply_user_one_id: 72,
  reply_user_one_at: 115,
  reply_user_two_id: 72,
  reply_user_two_at: 115,
  reply_count: 78,
}

type ReviewRow = {
  id: string
  inventoryId: string | null
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
  isActive: boolean
  usefulCount: number
  merchantReply: string
  merchantReplyBy: string
  isImported: boolean
  importGroup: number
  createdAt: string
}

type ReviewEdit = Partial<
  Pick<
    ReviewRow,
    | 'reviewerName'
    | 'rating'
    | 'title'
    | 'content'
    | 'importGroup'
    | 'usefulCount'
    | 'merchantReplyBy'
    | 'merchantReply'
    | 'isActive'
  >
>

type AnswerRow = {
  id: string
  answerType: 'buyer' | 'admin'
  replySlot?: 'admin' | 'user_one' | 'user_two' | null
  responderName: string
  content: string
  isVerified: boolean
  isActive: boolean
  guestAccountId?: string | null
  linkedUserId?: string | null
  createdAt?: string
  updatedAt?: string
}

type QuestionRow = {
  id: string
  inventoryId: string | null
  askerName: string
  content: string
  isActive: boolean
  usefulCount: number
  isImported: boolean
  importGroup: number
  createdAt: string
  updatedAt?: string
  answers: AnswerRow[]
}

type QuestionEdit = {
  importGroup?: number
  isActive?: boolean
  usefulCount?: number
  replyAdminName?: string
  replyAdminContent?: string
  replyUserOneName?: string
  replyUserOneContent?: string
  replyUserTwoName?: string
  replyUserTwoContent?: string
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  siteSlug?: string | null
  sectionId?: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

function fillCount(template: string, n: number) {
  return template.replace('{n}', String(n))
}

function fillId(template: string, id: string) {
  return template.replace('{id}', id)
}

function formatDate(s: string | null | undefined, locale: WebLocale) {
  if (!s) return '—'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString(locale)
  } catch {
    return s
  }
}

function shortId(id: string | null | undefined) {
  const v = String(id || '').trim()
  if (!v) return '—'
  return v.slice(0, 8)
}

function loadColumnWidths(): Record<string, number> {
  if (typeof window === 'undefined') return { ...DEFAULT_COLUMN_WIDTHS }
  try {
    const s = localStorage.getItem(COL_WIDTHS_STORAGE_KEY)
    if (!s) return { ...DEFAULT_COLUMN_WIDTHS }
    const parsed = JSON.parse(s) as Record<string, number>
    return { ...DEFAULT_COLUMN_WIDTHS, ...parsed }
  } catch {
    return { ...DEFAULT_COLUMN_WIDTHS }
  }
}

function saveColumnWidths(widths: Record<string, number>) {
  try {
    localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths))
  } catch {
    /* ignore */
  }
}

function useDebouncedSave() {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const schedule = useCallback((key: string, fn: () => void) => {
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
  const flush = useCallback((key: string, fn: () => void) => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.delete(key)
    fn()
  }, [])
  return { schedule, flush }
}

function slotDrafts(q: QuestionRow, edit?: QuestionEdit) {
  const slots = splitQaReplySlots(q.answers)
  return {
    replyAdminName: edit?.replyAdminName ?? slots.admin?.responderName ?? '',
    replyAdminContent: edit?.replyAdminContent ?? slots.admin?.content ?? '',
    replyUserOneName: edit?.replyUserOneName ?? slots.userOne?.responderName ?? '',
    replyUserOneContent: edit?.replyUserOneContent ?? slots.userOne?.content ?? '',
    replyUserTwoName: edit?.replyUserTwoName ?? slots.userTwo?.responderName ?? '',
    replyUserTwoContent: edit?.replyUserTwoContent ?? slots.userTwo?.content ?? '',
  }
}

export function PartnerWebsiteReviewsQaPanel({
  locale,
  t,
  partnerId,
  siteSlug,
  sectionId,
  onToast,
}: Props) {
  const [tab, setTab] = useState<'reviews' | 'qa'>('reviews')

  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewSearchInput, setReviewSearchInput] = useState('')
  const [reviewGroup, setReviewGroup] = useState('')
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewEdit, setReviewEdit] = useState<Record<string, ReviewEdit>>({})
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null)
  const [savedReviewId, setSavedReviewId] = useState<string | null>(null)
  const [importingReviews, setImportingReviews] = useState(false)
  const [deletingAllReviews, setDeletingAllReviews] = useState(false)
  const [viewReview, setViewReview] = useState<ReviewRow | null>(null)

  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [questionSearchInput, setQuestionSearchInput] = useState('')
  const [questionGroup, setQuestionGroup] = useState('')
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [questionEdit, setQuestionEdit] = useState<Record<string, QuestionEdit>>({})
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null)
  const [savedQuestionId, setSavedQuestionId] = useState<string | null>(null)
  const [importingQuestions, setImportingQuestions] = useState(false)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS)

  const reviewFileRef = useRef<HTMLInputElement>(null)
  const questionFileRef = useRef<HTMLInputElement>(null)
  const reviewEditRef = useRef<Record<string, ReviewEdit>>({})
  const questionEditRef = useRef<Record<string, QuestionEdit>>({})
  const reviewsRef = useRef<ReviewRow[]>([])
  const questionsRef = useRef<QuestionRow[]>([])
  const composingReviewRef = useRef<Record<string, boolean>>({})
  const composingQuestionRef = useRef<Record<string, boolean>>({})
  const savingReviewIdsRef = useRef<Set<string>>(new Set())
  const savingQuestionIdsRef = useRef<Set<string>>(new Set())
  const pendingReviewResaveRef = useRef<Set<string>>(new Set())
  const pendingQuestionResaveRef = useRef<Set<string>>(new Set())
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null)
  const { schedule, flush } = useDebouncedSave()
  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}`

  useEffect(() => {
    setColumnWidths(loadColumnWidths())
  }, [])

  useEffect(() => {
    reviewEditRef.current = reviewEdit
  }, [reviewEdit])
  useEffect(() => {
    questionEditRef.current = questionEdit
  }, [questionEdit])
  useEffect(() => {
    reviewsRef.current = reviews
  }, [reviews])
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const loadReviews = useCallback(
    async (page: number, group: string, options?: { silent?: boolean }) => {
      if (!options?.silent) setReviewsLoading(true)
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
        if (group.trim()) qs.set('importGroup', group.trim())
        const res = await fetch(`${basePath}/reviews?${qs.toString()}`)
        const json = (await res.json().catch(() => null)) as { reviews?: ReviewRow[]; total?: number } | null
        if (!res.ok || !json) {
          onToast?.(t.reviewsAdminLoadFailed, 'destructive')
          return
        }
        setReviews(json.reviews ?? [])
        setReviewsTotal(json.total ?? 0)
      } finally {
        if (!options?.silent) setReviewsLoading(false)
      }
    },
    [basePath, onToast, t.reviewsAdminLoadFailed]
  )

  const loadQuestions = useCallback(
    async (page: number, group: string, options?: { silent?: boolean }) => {
      if (!options?.silent) setQuestionsLoading(true)
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
        if (group.trim()) qs.set('importGroup', group.trim())
        const res = await fetch(`${basePath}/questions?${qs.toString()}`)
        const json = (await res.json().catch(() => null)) as { questions?: QuestionRow[]; total?: number } | null
        if (!res.ok || !json) {
          onToast?.(t.reviewsAdminLoadFailed, 'destructive')
          return
        }
        setQuestions(json.questions ?? [])
        setQuestionsTotal(json.total ?? 0)
      } finally {
        if (!options?.silent) setQuestionsLoading(false)
      }
    },
    [basePath, onToast, t.reviewsAdminLoadFailed]
  )

  useEffect(() => {
    void loadReviews(reviewsPage, reviewGroup)
  }, [loadReviews, reviewsPage, reviewGroup])

  useEffect(() => {
    void loadQuestions(questionsPage, questionGroup)
  }, [loadQuestions, questionsPage, questionGroup])

  function productHref(inventoryId: string | null, hash: string) {
    if (!siteSlug || !inventoryId) return ''
    const path = partnerSiteStorefrontProductHref(siteSlug, { inventoryId })
    return path ? `${path}${hash}` : ''
  }

  function getReviewVal<K extends keyof ReviewEdit>(r: ReviewRow, key: K): ReviewEdit[K] {
    const e = reviewEditRef.current[r.id] ?? reviewEdit[r.id]
    if (e && key in e) return e[key]
    return r[key] as ReviewEdit[K]
  }

  function buildReviewPayload(r: ReviewRow, e?: ReviewEdit) {
    const edit = e ?? reviewEditRef.current[r.id] ?? reviewEdit[r.id]
    return {
      reviewerName: edit?.reviewerName !== undefined ? edit.reviewerName : r.reviewerName,
      rating: Math.max(1, Math.min(5, Number(edit?.rating ?? r.rating ?? 5) || 5)),
      title: edit?.title !== undefined ? edit.title : r.title,
      content: edit?.content !== undefined ? edit.content : r.content,
      importGroup: Math.max(0, Number(edit?.importGroup ?? r.importGroup ?? 0) || 0),
      usefulCount: Math.max(0, Number(edit?.usefulCount ?? r.usefulCount ?? 0) || 0),
      merchantReplyBy: edit?.merchantReplyBy !== undefined ? edit.merchantReplyBy : r.merchantReplyBy,
      merchantReply: edit?.merchantReply !== undefined ? edit.merchantReply : r.merchantReply,
      isActive: edit?.isActive !== undefined ? Boolean(edit.isActive) : r.isActive,
    }
  }

  function reviewDirty(r: ReviewRow, payload: ReturnType<typeof buildReviewPayload>) {
    return (
      payload.reviewerName !== (r.reviewerName ?? '') ||
      payload.rating !== (r.rating ?? 5) ||
      payload.title !== (r.title ?? '') ||
      payload.content !== (r.content ?? '') ||
      payload.importGroup !== (r.importGroup ?? 0) ||
      payload.usefulCount !== (r.usefulCount ?? 0) ||
      payload.merchantReplyBy !== (r.merchantReplyBy ?? '') ||
      payload.merchantReply !== (r.merchantReply ?? '') ||
      payload.isActive !== r.isActive
    )
  }

  const saveReviewRow = useCallback(
    async (r: ReviewRow) => {
      if (savingReviewIdsRef.current.has(r.id)) {
        pendingReviewResaveRef.current.add(r.id)
        return
      }
      const edit = reviewEditRef.current[r.id]
      const payload = buildReviewPayload(r, edit)
      if (!reviewDirty(r, payload)) return
      savingReviewIdsRef.current.add(r.id)
      setSavingReviewId(r.id)
      try {
        const res = await fetch(`${basePath}/reviews/${encodeURIComponent(r.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json().catch(() => null)) as { review?: ReviewRow } | null
        if (!res.ok) {
          onToast?.(t.reviewsAdminSaveFailed, 'destructive')
          return
        }
        const updated = json?.review ?? { ...r, ...payload }
        setReviews((prev) => prev.map((item) => (item.id === r.id ? { ...item, ...updated } : item)))
        setReviewEdit((prev) => {
          const next = { ...prev }
          delete next[r.id]
          reviewEditRef.current = next
          return next
        })
        setSavedReviewId(r.id)
        setTimeout(() => setSavedReviewId((cur) => (cur === r.id ? null : cur)), 1500)
      } finally {
        savingReviewIdsRef.current.delete(r.id)
        setSavingReviewId((cur) => (cur === r.id ? null : cur))
        if (pendingReviewResaveRef.current.has(r.id)) {
          pendingReviewResaveRef.current.delete(r.id)
          const latest = reviewsRef.current.find((item) => item.id === r.id)
          if (latest) void saveReviewRow(latest)
        }
      }
    },
    [basePath, onToast, t.reviewsAdminSaveFailed]
  )

  const triggerReviewSave = useCallback(
    (r: ReviewRow) => {
      if (composingReviewRef.current[r.id]) return
      schedule(r.id, () => {
        const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
        void saveReviewRow(latest)
      })
    },
    [saveReviewRow, schedule]
  )

  const setReviewVal = useCallback(
    (r: ReviewRow, key: keyof ReviewEdit, value: ReviewEdit[typeof key]) => {
      const nextEdit = { ...reviewEditRef.current[r.id], [key]: value }
      const next = { ...reviewEditRef.current, [r.id]: nextEdit }
      reviewEditRef.current = next
      setReviewEdit(next)
      triggerReviewSave(r)
    },
    [triggerReviewSave]
  )

  function getQuestionVal<K extends keyof QuestionEdit>(q: QuestionRow, key: K): QuestionEdit[K] {
    const e = questionEditRef.current[q.id] ?? questionEdit[q.id]
    if (e && key in e) return e[key]
    const drafts = slotDrafts(q, e)
    if (key in drafts) return drafts[key as keyof typeof drafts] as QuestionEdit[K]
    if (key === 'importGroup') return q.importGroup as QuestionEdit[K]
    if (key === 'isActive') return q.isActive as QuestionEdit[K]
    if (key === 'usefulCount') return q.usefulCount as QuestionEdit[K]
    return undefined
  }

  function buildQuestionPayload(q: QuestionRow, e?: QuestionEdit) {
    const edit = e ?? questionEditRef.current[q.id] ?? questionEdit[q.id]
    const drafts = slotDrafts(q, edit)
    return {
      importGroup: Math.max(0, Number(edit?.importGroup ?? q.importGroup ?? 0) || 0),
      isActive: edit?.isActive !== undefined ? Boolean(edit.isActive) : q.isActive,
      usefulCount: Math.max(0, Number(edit?.usefulCount ?? q.usefulCount ?? 0) || 0),
      ...drafts,
    }
  }

  function questionDirty(q: QuestionRow, payload: ReturnType<typeof buildQuestionPayload>) {
    const drafts = slotDrafts(q)
    return (
      payload.importGroup !== (q.importGroup ?? 0) ||
      payload.isActive !== q.isActive ||
      payload.usefulCount !== (q.usefulCount ?? 0) ||
      payload.replyAdminName !== drafts.replyAdminName ||
      payload.replyAdminContent !== drafts.replyAdminContent ||
      payload.replyUserOneName !== drafts.replyUserOneName ||
      payload.replyUserOneContent !== drafts.replyUserOneContent ||
      payload.replyUserTwoName !== drafts.replyUserTwoName ||
      payload.replyUserTwoContent !== drafts.replyUserTwoContent
    )
  }

  const saveQuestionRow = useCallback(
    async (q: QuestionRow) => {
      if (savingQuestionIdsRef.current.has(q.id)) {
        pendingQuestionResaveRef.current.add(q.id)
        return
      }
      const edit = questionEditRef.current[q.id]
      const payload = buildQuestionPayload(q, edit)
      if (!questionDirty(q, payload)) return
      savingQuestionIdsRef.current.add(q.id)
      setSavingQuestionId(q.id)
      try {
        const res = await fetch(`${basePath}/questions/${encodeURIComponent(q.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json().catch(() => null)) as {
          question?: QuestionRow
          answers?: AnswerRow[]
        } | null
        if (!res.ok) {
          onToast?.(t.reviewsAdminSaveFailed, 'destructive')
          return
        }
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === q.id
              ? {
                  ...item,
                  ...(json?.question ?? {}),
                  importGroup: payload.importGroup,
                  isActive: payload.isActive,
                  usefulCount: payload.usefulCount,
                  answers: json?.answers ?? item.answers,
                }
              : item
          )
        )
        setQuestionEdit((prev) => {
          const next = { ...prev }
          delete next[q.id]
          questionEditRef.current = next
          return next
        })
        setSavedQuestionId(q.id)
        setTimeout(() => setSavedQuestionId((cur) => (cur === q.id ? null : cur)), 1500)
      } finally {
        savingQuestionIdsRef.current.delete(q.id)
        setSavingQuestionId((cur) => (cur === q.id ? null : cur))
        if (pendingQuestionResaveRef.current.has(q.id)) {
          pendingQuestionResaveRef.current.delete(q.id)
          const latest = questionsRef.current.find((item) => item.id === q.id)
          if (latest) void saveQuestionRow(latest)
        }
      }
    },
    [basePath, onToast, t.reviewsAdminSaveFailed]
  )

  const triggerQuestionSave = useCallback(
    (q: QuestionRow) => {
      if (composingQuestionRef.current[q.id]) return
      schedule(`q:${q.id}`, () => {
        const latest = questionsRef.current.find((item) => item.id === q.id) ?? q
        void saveQuestionRow(latest)
      })
    },
    [saveQuestionRow, schedule]
  )

  const setQuestionVal = useCallback(
    (q: QuestionRow, key: keyof QuestionEdit, value: QuestionEdit[typeof key]) => {
      const nextEdit = { ...questionEditRef.current[q.id], [key]: value }
      const next = { ...questionEditRef.current, [q.id]: nextEdit }
      questionEditRef.current = next
      setQuestionEdit(next)
      triggerQuestionSave(q)
    },
    [triggerQuestionSave]
  )

  async function deleteReview(id: string) {
    if (!window.confirm(t.reviewsAdminDeleteConfirm)) return
    const res = await fetch(`${basePath}/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      onToast?.(t.reviewsAdminDeleteFailed, 'destructive')
      return
    }
    setReviewEdit((prev) => {
      const next = { ...prev }
      delete next[id]
      reviewEditRef.current = next
      return next
    })
    onToast?.(t.reviewsAdminDeleted)
    await loadReviews(reviewsPage, reviewGroup, { silent: true })
  }

  async function deleteAllReviews() {
    if (reviewsTotal <= 0) return
    if (!window.confirm(fillCount(t.reviewsAdminDeleteAllConfirmCount, reviewsTotal))) return
    setDeletingAllReviews(true)
    try {
      const res = await fetch(`${basePath}/reviews`, { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as { deleted?: number } | null
      if (!res.ok) {
        onToast?.(t.reviewsAdminDeleteFailed, 'destructive')
        return
      }
      onToast?.(fillCount(t.reviewsAdminDeletedCount, json?.deleted ?? reviewsTotal))
      setReviewsPage(1)
      setReviewEdit({})
      reviewEditRef.current = {}
      await loadReviews(1, reviewGroup)
    } finally {
      setDeletingAllReviews(false)
    }
  }

  async function importReviews(file: File) {
    setImportingReviews(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch(`${basePath}/reviews/import`, { method: 'POST', body: form })
      const json = (await res.json().catch(() => null)) as { created?: number } | null
      if (res.ok) {
        onToast?.(fillCount(t.reviewsAdminImportOk, json?.created ?? 0))
        setReviewsPage(1)
        await loadReviews(1, reviewGroup)
      } else {
        onToast?.(t.reviewsAdminImportFail, 'destructive')
      }
    } finally {
      setImportingReviews(false)
    }
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm(t.qaAdminDeleteConfirm)) return
    const res = await fetch(`${basePath}/questions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      onToast?.(t.reviewsAdminDeleteFailed, 'destructive')
      return
    }
    onToast?.(t.reviewsAdminDeleted)
    await loadQuestions(questionsPage, questionGroup, { silent: true })
  }

  async function importQuestions(file: File) {
    setImportingQuestions(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch(`${basePath}/questions/import`, { method: 'POST', body: form })
      const json = (await res.json().catch(() => null)) as { created?: number } | null
      if (res.ok) {
        onToast?.(fillCount(t.qaAdminImportOk, json?.created ?? 0))
        setQuestionsPage(1)
        await loadQuestions(1, questionGroup)
      } else {
        onToast?.(t.qaAdminImportFail, 'destructive')
      }
    } finally {
      setImportingQuestions(false)
    }
  }

  const startResize = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.preventDefault()
      const startW = columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 100
      resizeRef.current = { key, startX: e.clientX, startW }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return
        const delta = ev.clientX - resizeRef.current.startX
        const newW = Math.max(40, resizeRef.current.startW + delta)
        setColumnWidths((prev) => {
          const next = { ...prev, [resizeRef.current!.key]: newW }
          saveColumnWidths(next)
          return next
        })
      }
      const onUp = () => {
        resizeRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [columnWidths]
  )

  const getColWidth = useCallback(
    (key: string) => columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 100,
    [columnWidths]
  )

  const reviewPages = Math.max(1, Math.ceil(reviewsTotal / PAGE_SIZE))
  const questionPages = Math.max(1, Math.ceil(questionsTotal / PAGE_SIZE))
  const previewPath = siteSlug ? partnerWebsitePublicPath(siteSlug) : null
  const inputClass = 'rounded border border-gray-300 px-2 py-1 text-xs w-full min-w-0'
  const numClass = 'rounded border border-gray-300 px-1 py-0.5 text-xs'

  const qaHeaders: Array<[string, string]> = [
    ['stt', t.reviewsAdminColStt],
    ['view', t.qaAdminColView],
    ['user_name', t.qaAdminColAsker],
    ['content', t.qaAdminColAskContent],
    ['group', t.reviewsAdminGroupLabel],
    ['is_active', t.reviewsAdminColActive],
    ['useful', t.qaAdminColUsefulCount],
    ['reply_admin_name', t.qaAdminColAdminName],
    ['reply_admin_content', t.qaAdminColAdminContent],
    ['reply_user_one_name', t.qaAdminColUserOneName],
    ['reply_user_one_content', t.qaAdminColUserOneContent],
    ['reply_user_two_name', t.qaAdminColUserTwoName],
    ['reply_user_two_content', t.qaAdminColUserTwoContent],
    ['actions', t.qaAdminColStatusDelete],
    ['created_at', t.qaAdminColAskedAt],
    ['product_id', t.qaAdminColProductId],
    ['updated_at', t.qaAdminColUpdatedAt],
    ['reply_admin_at', t.qaAdminColAdminRepliedAt],
    ['reply_user_one_id', t.qaAdminColUserOneId],
    ['reply_user_one_at', t.qaAdminColUserOneAt],
    ['reply_user_two_id', t.qaAdminColUserTwoId],
    ['reply_user_two_at', t.qaAdminColUserTwoAt],
    ['reply_count', t.qaAdminColReplyCount],
  ]

  return (
    <div id={sectionId} className="p-1 sm:p-2">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          className={tab === 'reviews' ? 'font-semibold text-gray-900' : 'text-blue-600 hover:underline'}
          onClick={() => setTab('reviews')}
        >
          {t.reviewsAdminPageTitle} ({reviewsTotal})
        </button>
        <span className="text-gray-400">|</span>
        <button
          type="button"
          className={tab === 'qa' ? 'font-semibold text-gray-900' : 'text-blue-600 hover:underline'}
          onClick={() => setTab('qa')}
        >
          {t.qaAdminPageTitle} ({questionsTotal})
        </button>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {tab === 'reviews' ? t.reviewsAdminPageTitle : t.qaAdminPageTitle}
      </h1>

      {tab === 'reviews' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {previewPath ? (
              <>
                <a href={previewPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {t.reviewsAdminViewWebsite}
                </a>
                <span className="text-gray-400">|</span>
              </>
            ) : null}
            <a href={`${basePath}/reviews/sample`} className="text-blue-600 hover:underline">
              {t.reviewsAdminDownloadSample}
            </a>
            <span className="text-gray-400">|</span>
            <button
              type="button"
              onClick={() => reviewFileRef.current?.click()}
              disabled={importingReviews}
              className="text-blue-600 hover:underline disabled:opacity-70"
            >
              {importingReviews ? t.reviewsAdminImporting : t.reviewsAdminImport}
            </button>
            <input
              ref={reviewFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importReviews(file)
              }}
            />
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {t.reviewsAdminAutosaveHint}
          </div>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>{t.reviewsAdminDisplayLogicLabel}</strong> {t.reviewsAdminDisplayLogic}
          </div>

          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setReviewsPage(1)
                setReviewGroup(reviewSearchInput.trim())
              }}
              className="flex flex-wrap items-end gap-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.reviewsAdminSearchGroupLabel}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={reviewSearchInput}
                  onChange={(e) => setReviewSearchInput(e.target.value)}
                  placeholder={t.reviewsAdminSearchGroupExample}
                  className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                  aria-label={t.reviewsAdminSearchGroupLabel}
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {t.reviewsAdminSearch}
              </button>
              {reviewGroup.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setReviewSearchInput('')
                    setReviewGroup('')
                    setReviewsPage(1)
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t.reviewsAdminClearFilter}
                </button>
              ) : null}
            </form>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600">{fillCount(t.reviewsAdminTotalRecords, reviewsTotal)}</span>
            <button
              type="button"
              onClick={() => void deleteAllReviews()}
              disabled={deletingAllReviews || reviewsTotal <= 0}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingAllReviews ? t.reviewsAdminDeleting : t.reviewsAdminDeleteAll}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {reviewsLoading ? (
              <div className="p-12 text-center text-gray-500">{t.reviewsAdminLoading}</div>
            ) : reviews.length === 0 ? (
              <div className="p-12 text-center text-gray-500">{t.reviewsAdminEmpty}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="w-10 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColStt}</th>
                      <th className="w-20 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColType}</th>
                      <th className="w-24 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColShowAt}</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminNameLabel}</th>
                      <th className="w-14 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminStarLabel}</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminTitleField}</th>
                      <th className="min-w-[120px] px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminContentCol}</th>
                      <th className="w-14 px-2 py-2 text-left font-semibold text-gray-700" title={t.reviewsAdminImportHint}>
                        {t.reviewsAdminGroupLabel}
                      </th>
                      <th className="w-16 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminUsefulLabel}</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColReply}</th>
                      <th className="w-20 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColActive}</th>
                      <th className="whitespace-nowrap px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColTime}</th>
                      <th className="w-24 px-2 py-2 text-left font-semibold text-gray-700">{t.reviewsAdminColActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r, idx) => {
                      const href = productHref(r.inventoryId, `#review-${r.id}`)
                      return (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-2 py-2">{(reviewsPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                r.isImported ? 'bg-slate-200 text-slate-700' : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {r.isImported ? t.reviewsAdminTypeImport : t.reviewsAdminTypeCustomer}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs">
                            {r.isImported ? (
                              <span>{fillCount(t.reviewsAdminShowGroup, r.importGroup ?? 0)}</span>
                            ) : r.inventoryId ? (
                              href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {fillId(t.reviewsAdminShowProduct, shortId(r.inventoryId))}
                                </a>
                              ) : (
                                <span>{fillId(t.reviewsAdminShowProduct, shortId(r.inventoryId))}</span>
                              )
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={String(getReviewVal(r, 'reviewerName') ?? '')}
                              onChange={(e) => setReviewVal(r, 'reviewerName', e.target.value)}
                              onCompositionStart={() => {
                                composingReviewRef.current[r.id] = true
                              }}
                              onCompositionEnd={() => {
                                composingReviewRef.current[r.id] = false
                                triggerReviewSave(r)
                              }}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={inputClass}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={Number(getReviewVal(r, 'rating') ?? 5)}
                              onChange={(e) =>
                                setReviewVal(r, 'rating', Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 5)))
                              }
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={`${numClass} w-12`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={String(getReviewVal(r, 'title') ?? '')}
                              onChange={(e) => setReviewVal(r, 'title', e.target.value)}
                              onCompositionStart={() => {
                                composingReviewRef.current[r.id] = true
                              }}
                              onCompositionEnd={() => {
                                composingReviewRef.current[r.id] = false
                                triggerReviewSave(r)
                              }}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={inputClass}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={String(getReviewVal(r, 'content') ?? '')}
                              onChange={(e) => setReviewVal(r, 'content', e.target.value)}
                              onCompositionStart={() => {
                                composingReviewRef.current[r.id] = true
                              }}
                              onCompositionEnd={() => {
                                composingReviewRef.current[r.id] = false
                                triggerReviewSave(r)
                              }}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={inputClass}
                              placeholder={t.reviewsAdminContentCol}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              value={Math.max(0, Number(getReviewVal(r, 'importGroup') ?? 0) || 0)}
                              onChange={(e) => setReviewVal(r, 'importGroup', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={`${numClass} w-14`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              value={Math.max(0, Number(getReviewVal(r, 'usefulCount') ?? 0) || 0)}
                              onChange={(e) => setReviewVal(r, 'usefulCount', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={`${numClass} w-16`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={String(getReviewVal(r, 'merchantReplyBy') ?? '')}
                                onChange={(e) => setReviewVal(r, 'merchantReplyBy', e.target.value)}
                                onCompositionStart={() => {
                                  composingReviewRef.current[r.id] = true
                                }}
                                onCompositionEnd={() => {
                                  composingReviewRef.current[r.id] = false
                                  triggerReviewSave(r)
                                }}
                                onBlur={() =>
                                  flush(r.id, () => {
                                    const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                    void saveReviewRow(latest)
                                  })
                                }
                                className="w-full rounded border border-gray-300 px-2 py-0.5 text-xs"
                                placeholder={t.reviewsAdminNameLabel}
                              />
                              <input
                                type="text"
                                value={String(getReviewVal(r, 'merchantReply') ?? '')}
                                onChange={(e) => setReviewVal(r, 'merchantReply', e.target.value)}
                                onCompositionStart={() => {
                                  composingReviewRef.current[r.id] = true
                                }}
                                onCompositionEnd={() => {
                                  composingReviewRef.current[r.id] = false
                                  triggerReviewSave(r)
                                }}
                                onBlur={() =>
                                  flush(r.id, () => {
                                    const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                    void saveReviewRow(latest)
                                  })
                                }
                                className="w-full rounded border border-gray-300 px-2 py-0.5 text-xs"
                                placeholder={t.reviewsAdminContentCol}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={getReviewVal(r, 'isActive') ? '1' : '0'}
                              onChange={(e) => setReviewVal(r, 'isActive', e.target.value === '1')}
                              onBlur={() =>
                                flush(r.id, () => {
                                  const latest = reviewsRef.current.find((item) => item.id === r.id) ?? r
                                  void saveReviewRow(latest)
                                })
                              }
                              className={numClass}
                            >
                              <option value="1">{t.reviewsAdminActiveShow}</option>
                              <option value="0">{t.reviewsAdminActiveHide}</option>
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-600">
                            {formatDate(r.createdAt, locale)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {href ? (
                              <button
                                type="button"
                                onClick={() => setViewReview(r)}
                                className="mr-1 text-xs text-blue-600 hover:underline"
                              >
                                {t.reviewsAdminViewReview}
                              </button>
                            ) : null}
                            <span className="mr-1 text-xs text-gray-500" aria-live="polite">
                              {savingReviewId === r.id
                                ? t.reviewsAdminSaving
                                : savedReviewId === r.id
                                  ? t.reviewsAdminSaved
                                  : reviewEdit[r.id]
                                    ? t.reviewsAdminWaitingSave
                                    : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => void deleteReview(r.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              {t.qaAdminDelete}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {reviewsTotal > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-gray-100 p-3">
                <span className="text-sm text-gray-600">{fillCount(t.reviewsAdminTotalRecords, reviewsTotal)}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={reviewsPage <= 1}
                    onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    «
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {reviewsPage} / {reviewPages}
                  </span>
                  <button
                    type="button"
                    disabled={reviewsPage >= reviewPages}
                    onClick={() => setReviewsPage((p) => Math.min(reviewPages, p + 1))}
                    className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    »
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {previewPath ? (
              <>
                <a href={previewPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {t.reviewsAdminViewWebsite}
                </a>
                <span className="text-gray-400">|</span>
              </>
            ) : null}
            <span className="text-gray-600">{t.qaAdminAddInTable}</span>
            <span className="text-gray-400">|</span>
            <a href={`${basePath}/questions/sample`} className="text-blue-600 hover:underline">
              {t.qaAdminDownloadSample}
            </a>
            <span className="text-gray-400">|</span>
            <button
              type="button"
              onClick={() => questionFileRef.current?.click()}
              disabled={importingQuestions}
              className="text-blue-600 hover:underline disabled:opacity-70"
            >
              {importingQuestions ? t.reviewsAdminImporting : t.qaAdminImport}
            </button>
            <input
              ref={questionFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importQuestions(file)
              }}
            />
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {t.reviewsAdminAutosaveHint}
          </div>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t.qaAdminLogicHint}
          </div>

          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setQuestionsPage(1)
                setQuestionGroup(questionSearchInput.trim())
              }}
              className="flex flex-wrap items-end gap-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t.qaAdminSearchGroupLabel}</label>
                <input
                  type="text"
                  value={questionSearchInput}
                  onChange={(e) => setQuestionSearchInput(e.target.value)}
                  placeholder={t.qaAdminSearchGroupPlaceholder}
                  className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {t.reviewsAdminSearch}
              </button>
            </form>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600">{fillCount(t.reviewsAdminTotalRecords, questionsTotal)}</span>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS })
                  saveColumnWidths(DEFAULT_COLUMN_WIDTHS)
                  onToast?.(t.qaAdminResetColWidthsOk)
                }}
                className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                title={t.qaAdminResetColWidths}
              >
                {t.qaAdminResetColWidths}
              </button>
              <span className="text-gray-600">{t.qaAdminShowCount}</span>
              <select value={PAGE_SIZE} className="rounded border border-gray-300 px-2 py-1" disabled>
                <option value={10}>10</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {questionsLoading ? (
              <div className="p-12 text-center text-gray-500">{t.reviewsAdminLoading}</div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center text-gray-500">{t.qaAdminEmpty}</div>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full table-fixed text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    {QA_COLUMN_KEYS.map((key) => (
                      <col key={key} style={{ width: getColWidth(key), minWidth: getColWidth(key) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {qaHeaders.map(([key, label]) => (
                        <th
                          key={key}
                          className="group relative px-2 py-2 text-left align-bottom font-semibold text-gray-700"
                          style={{
                            width: getColWidth(key),
                            minWidth: getColWidth(key),
                            maxWidth: getColWidth(key),
                          }}
                        >
                          <span className="block break-words leading-tight" style={{ lineHeight: 1.25 }}>
                            {label}
                          </span>
                          <span
                            role="separator"
                            aria-label={t.qaAdminResizeCol}
                            onMouseDown={startResize(key)}
                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent transition-colors group-hover:bg-gray-300 hover:bg-blue-400 active:bg-blue-500"
                            title={t.qaAdminResizeCol}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, idx) => {
                      const href = q.isImported ? '' : productHref(q.inventoryId, `#question-${q.id}`)
                      const slots = splitQaReplySlots(q.answers)
                      const replyCount = qaPublicBuyerReplyCount(slots)
                      const flushQ = () =>
                        flush(`q:${q.id}`, () => {
                          const latest = questionsRef.current.find((item) => item.id === q.id) ?? q
                          void saveQuestionRow(latest)
                        })
                      return (
                        <tr key={q.id} className="border-b border-gray-100 align-top hover:bg-gray-50/50">
                          <td className="overflow-hidden px-2 py-2">{(questionsPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {t.qaAdminViewQuestion}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="overflow-hidden px-2 py-2">{q.askerName || '—'}</td>
                          <td className="overflow-hidden break-words px-2 py-2">{q.content || '—'}</td>
                          <td className="overflow-hidden px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              value={Math.max(0, Number(getQuestionVal(q, 'importGroup') ?? 0) || 0)}
                              onChange={(e) =>
                                setQuestionVal(q, 'importGroup', Math.max(0, parseInt(e.target.value, 10) || 0))
                              }
                              onBlur={flushQ}
                              className={`${numClass} w-full max-w-[48px]`}
                            />
                          </td>
                          <td className="overflow-hidden px-2 py-2">
                            <select
                              value={getQuestionVal(q, 'isActive') ? '1' : '0'}
                              onChange={(e) => setQuestionVal(q, 'isActive', e.target.value === '1')}
                              onBlur={flushQ}
                              className={`${numClass} w-full max-w-[90px]`}
                            >
                              <option value="1">{t.reviewsAdminActiveShow}</option>
                              <option value="0">{t.reviewsAdminActiveHide}</option>
                            </select>
                          </td>
                          <td className="overflow-hidden px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              value={Math.max(0, Number(getQuestionVal(q, 'usefulCount') ?? 0) || 0)}
                              onChange={(e) =>
                                setQuestionVal(q, 'usefulCount', Math.max(0, parseInt(e.target.value, 10) || 0))
                              }
                              onBlur={flushQ}
                              className={`${numClass} w-full max-w-[72px]`}
                              aria-label={t.qaAdminColUsefulCount}
                            />
                          </td>
                          {(
                            [
                              ['replyAdminName', t.qaAdminAdminName],
                              ['replyAdminContent', t.qaAdminAdminContent],
                              ['replyUserOneName', t.qaAdminUserOneName],
                              ['replyUserOneContent', t.qaAdminUserOneContent],
                              ['replyUserTwoName', t.qaAdminUserTwoName],
                              ['replyUserTwoContent', t.qaAdminUserTwoContent],
                            ] as const
                          ).map(([key, placeholder]) => (
                            <td key={key} className="overflow-hidden px-2 py-2">
                              <input
                                type="text"
                                value={String(getQuestionVal(q, key) ?? '')}
                                onChange={(e) => setQuestionVal(q, key, e.target.value)}
                                onCompositionStart={() => {
                                  composingQuestionRef.current[q.id] = true
                                }}
                                onCompositionEnd={() => {
                                  composingQuestionRef.current[q.id] = false
                                  triggerQuestionSave(q)
                                }}
                                onBlur={flushQ}
                                className={inputClass}
                                placeholder={placeholder}
                              />
                            </td>
                          ))}
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2">
                            <span className="mr-2 text-xs text-gray-500" aria-live="polite">
                              {savingQuestionId === q.id
                                ? t.reviewsAdminSaving
                                : savedQuestionId === q.id
                                  ? t.reviewsAdminSaved
                                  : questionEdit[q.id]
                                    ? t.reviewsAdminWaitingSave
                                    : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => void deleteQuestion(q.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              {t.qaAdminDelete}
                            </button>
                          </td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2 text-gray-600">
                            {formatDate(q.createdAt, locale)}
                          </td>
                          <td className="overflow-hidden px-2 py-2">{q.inventoryId ? shortId(q.inventoryId) : '—'}</td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2 text-gray-600">
                            {formatDate(q.updatedAt, locale)}
                          </td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2 text-gray-600">
                            {formatDate(slots.admin?.createdAt, locale)}
                          </td>
                          <td className="overflow-hidden px-2 py-2">
                            {shortId(slots.userOne?.guestAccountId || slots.userOne?.linkedUserId || slots.userOne?.id)}
                          </td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2 text-gray-600">
                            {formatDate(slots.userOne?.createdAt, locale)}
                          </td>
                          <td className="overflow-hidden px-2 py-2">
                            {shortId(slots.userTwo?.guestAccountId || slots.userTwo?.linkedUserId || slots.userTwo?.id)}
                          </td>
                          <td className="overflow-hidden whitespace-nowrap px-2 py-2 text-gray-600">
                            {formatDate(slots.userTwo?.createdAt, locale)}
                          </td>
                          <td className="overflow-hidden px-2 py-2">{fillCount(t.qaAdminReplyCountLocked, replyCount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {questionsTotal > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-gray-100 p-3">
                <span className="text-sm text-gray-600">{fillCount(t.reviewsAdminTotalRecords, questionsTotal)}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={questionsPage <= 1}
                    onClick={() => setQuestionsPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    «
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {questionsPage} / {questionPages}
                  </span>
                  <button
                    type="button"
                    disabled={questionsPage >= questionPages}
                    onClick={() => setQuestionsPage((p) => Math.min(questionPages, p + 1))}
                    className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    »
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {viewReview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewReview(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{t.reviewsAdminViewReview}</h2>
              <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setViewReview(null)}>
                ×
              </button>
            </div>
            <p className="text-sm font-medium text-gray-900">{viewReview.reviewerName}</p>
            <p className="text-sm text-amber-600">{viewReview.rating} ★</p>
            {viewReview.title ? <p className="mt-2 text-sm font-semibold text-gray-800">{viewReview.title}</p> : null}
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{viewReview.content}</p>
            {viewReview.merchantReply ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-800">{viewReview.merchantReplyBy || t.reviewsAdminReplyLabel}</p>
                <p className="mt-1 text-gray-700">{viewReview.merchantReply}</p>
              </div>
            ) : null}
            {productHref(viewReview.inventoryId, `#review-${viewReview.id}`) ? (
              <a
                href={productHref(viewReview.inventoryId, `#review-${viewReview.id}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-blue-600 hover:underline"
              >
                {t.reviewsAdminViewReview}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
