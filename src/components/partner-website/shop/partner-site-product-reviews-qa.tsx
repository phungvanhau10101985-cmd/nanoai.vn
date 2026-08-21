'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  buildPartnerShopLoginHref,
  composePartnerShopReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import type { WebLocale } from '@/lib/i18n/config'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type ReviewRow = {
  id: string
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
  usefulCount: number
  merchantReply: string
  merchantReplyBy: string
  createdAt: string
}

type RatingSummary = {
  average: number
  total: number
  histogram: Record<'1' | '2' | '3' | '4' | '5', number>
}

type AnswerRow = {
  id: string
  answerType: 'buyer' | 'admin'
  responderName: string
  content: string
  isVerified: boolean
  createdAt: string
}

type QuestionRow = {
  id: string
  askerName: string
  content: string
  createdAt: string
  answers: AnswerRow[]
}

type Props = {
  siteSlug: string
  inventoryId: string
  locale: WebLocale
}

const STARS = [1, 2, 3, 4, 5] as const

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star`}
          style={{ fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: n <= value ? '#f59e0b' : '#d1d5db' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', letterSpacing: 1 }}>
      {STARS.map((n) => (n <= rating ? '★' : '☆')).join('')}
    </span>
  )
}

export function PartnerSiteProductReviewsQa({ siteSlug, inventoryId, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)

  function redirectToLogin(hash?: string) {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const search = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : ''
    const loc = composePartnerShopReturnLocation(pathname, search, hash ?? (typeof window !== 'undefined' ? window.location.hash : ''))
    window.location.assign(buildPartnerShopLoginHref(siteSlug, loc, { customDomain }))
  }

  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState('')

  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [askOpen, setAskOpen] = useState(false)
  const [askContent, setAskContent] = useState('')
  const [askSubmitting, setAskSubmitting] = useState(false)
  const [askMessage, setAskMessage] = useState('')
  const [answerOpenFor, setAnswerOpenFor] = useState<string | null>(null)
  const [answerContent, setAnswerContent] = useState('')
  const [answerSubmitting, setAnswerSubmitting] = useState(false)
  const [answerMessage, setAnswerMessage] = useState('')

  const basePath = `/api/site/${encodeURIComponent(siteSlug)}/products/${encodeURIComponent(inventoryId)}`

  const loadReviews = useCallback(
    async (page: number, append: boolean) => {
      const res = await fetch(`${basePath}/reviews?page=${page}&pageSize=10`, { credentials: 'same-origin' })
      captureFromResponse(res)
      const json = (await res.json().catch(() => null)) as {
        summary?: RatingSummary
        reviews?: ReviewRow[]
        total?: number
      } | null
      if (!json) return
      if (json.summary) setSummary(json.summary)
      setReviewsTotal(json.total ?? 0)
      setReviews((prev) => (append ? [...prev, ...(json.reviews ?? [])] : json.reviews ?? []))
    },
    [basePath, captureFromResponse]
  )

  const loadQuestions = useCallback(
    async (page: number, append: boolean) => {
      const res = await fetch(`${basePath}/questions?page=${page}&pageSize=10`, { credentials: 'same-origin' })
      captureFromResponse(res)
      const json = (await res.json().catch(() => null)) as { questions?: QuestionRow[]; total?: number } | null
      if (!json) return
      setQuestionsTotal(json.total ?? 0)
      setQuestions((prev) => (append ? [...prev, ...(json.questions ?? [])] : json.questions ?? []))
    },
    [basePath, captureFromResponse]
  )

  useEffect(() => {
    void loadReviews(1, false)
    void loadQuestions(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteSlug, inventoryId])

  function addImageUrl() {
    const url = imageUrlInput.trim()
    if (!/^https?:\/\//i.test(url)) return
    if (imageUrls.length >= 6) return
    setImageUrls((prev) => [...prev, url])
    setImageUrlInput('')
  }

  async function submitReview() {
    if (!ready || submitting || !content.trim()) return
    setSubmitting(true)
    setFormMessage('')
    try {
      const res = await fetch(`${basePath}/reviews`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ rating, title, content, imageUrls, locale }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 401 || json.error === 'login_required') {
        setFormMessage(t.reviewsSubmitLoginRequired)
        redirectToLogin()
        return
      } else if (json.error === 'already_reviewed') {
        setFormMessage(t.reviewsSubmitAlreadyReviewed)
      } else if (json.error === 'not_eligible') {
        setFormMessage(t.reviewsSubmitNotEligible)
      } else if (json.ok) {
        setFormMessage(t.reviewsSubmitSuccess)
        setContent('')
        setTitle('')
        setImageUrls([])
        setRating(5)
        setFormOpen(false)
        void loadReviews(1, false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleVote(reviewId: string) {
    const res = await fetch(`${basePath}/reviews/${encodeURIComponent(reviewId)}/vote`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => null)) as { ok?: boolean; voted?: boolean; usefulCount?: number } | null
    if (!json?.ok) return
    setVotedIds((prev) => {
      const next = new Set(prev)
      if (json.voted) next.add(reviewId)
      else next.delete(reviewId)
      return next
    })
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, usefulCount: json.usefulCount ?? r.usefulCount } : r))
    )
  }

  async function submitQuestion() {
    if (!ready || askSubmitting || !askContent.trim()) return
    setAskSubmitting(true)
    setAskMessage('')
    try {
      const res = await fetch(`${basePath}/questions`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content: askContent }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 401 || json.error === 'login_required') {
        setAskMessage(t.qaSubmitLoginRequired)
        redirectToLogin('#qa')
        return
      } else if (json.ok) {
        setAskMessage(t.qaSubmitSuccess)
        setAskContent('')
        setAskOpen(false)
        void loadQuestions(1, false)
      }
    } finally {
      setAskSubmitting(false)
    }
  }

  async function submitAnswer(questionId: string) {
    if (!ready || answerSubmitting || !answerContent.trim()) return
    setAnswerSubmitting(true)
    setAnswerMessage('')
    try {
      const res = await fetch(`${basePath}/questions/${encodeURIComponent(questionId)}/answers`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content: answerContent }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 401 || json.error === 'login_required') {
        setAnswerMessage(t.qaSubmitLoginRequired)
        redirectToLogin('#qa')
        return
      } else if (json.error === 'not_eligible') {
        setAnswerMessage(t.qaAnswerNotEligible)
      } else if (json.error === 'slot_full') {
        setAnswerMessage(t.qaAnswerSlotFull)
      } else if (json.ok) {
        setAnswerContent('')
        setAnswerOpenFor(null)
        void loadQuestions(1, false)
      }
    } finally {
      setAnswerSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 40, display: 'grid', gap: 40 }}>
      <section className="pw-shop-reviews" data-pw-region={PW_REGION.reviews}>
        <h2 data-pw-el={PW_EL.sectionTitle}>{t.reviewsTitle}</h2>
        {summary && summary.total > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.average}/5</span>
            <StarDisplay rating={Math.round(summary.average)} />
            <span className="pw-shop-muted">
              ({summary.total} {t.reviewsTotalSuffix})
            </span>
          </div>
        ) : null}

        {!formOpen ? (
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" style={{ marginTop: 16 }} onClick={() => setFormOpen(true)}>
            {t.reviewsWriteButton}
          </button>
        ) : (
          <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              {t.reviewsFormRatingLabel}
              <StarPicker value={rating} onChange={setRating} />
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.reviewsFormContentPlaceholder}
              rows={4}
              maxLength={4000}
            />
            <label style={{ display: 'grid', gap: 4 }}>
              {t.reviewsFormImagesLabel}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://..."
                  style={{ flex: 1 }}
                />
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={addImageUrl}>
                  +
                </button>
              </div>
              {imageUrls.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {imageUrls.map((url) => (
                    <img key={url} src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              ) : null}
            </label>
            {formMessage ? <p style={{ margin: 0 }}>{formMessage}</p> : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="pw-shop-btn" disabled={!ready || submitting || !content.trim()} onClick={() => void submitReview()}>
                {t.reviewsFormSubmit}
              </button>
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setFormOpen(false)}>
                {t.reviewsFormCancel}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
          {reviews.length === 0 ? <p className="pw-shop-muted">{t.reviewsEmpty}</p> : null}
          {reviews.map((r) => (
            <article key={r.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }} data-pw-el={PW_EL.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong data-pw-el={PW_EL.cardName}>{r.reviewerName}</strong>
                <span className="pw-shop-muted" style={{ fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
              <StarDisplay rating={r.rating} />
              {r.title ? <p style={{ fontWeight: 600, margin: '6px 0 2px' }}>{r.title}</p> : null}
              <p style={{ margin: '4px 0' }} data-pw-el={PW_EL.body}>{r.content}</p>
              {r.imageUrls.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                  {r.imageUrls.map((url) => (
                    <img key={url} src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              ) : null}
              {r.merchantReply ? (
                <div style={{ marginTop: 8, padding: 10, background: '#f9fafb', borderRadius: 8, fontSize: 14 }}>
                  <strong>
                    {t.reviewsMerchantReplyPrefix} {r.merchantReplyBy}:
                  </strong>{' '}
                  {r.merchantReply}
                </div>
              ) : null}
              <button
                type="button"
                className="pw-shop-btn pw-shop-btn-outline"
                style={{ marginTop: 8, fontSize: 13, padding: '4px 10px' }}
                onClick={() => void toggleVote(r.id)}
                aria-pressed={votedIds.has(r.id)}
              >
                👍 {t.reviewsUsefulLabel} ({r.usefulCount})
              </button>
            </article>
          ))}
          {reviews.length < reviewsTotal ? (
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => {
                const next = reviewsPage + 1
                setReviewsPage(next)
                void loadReviews(next, true)
              }}
            >
              {t.reviewsLoadMore}
            </button>
          ) : null}
        </div>
      </section>

      <section className="pw-shop-reviews" data-pw-region={PW_REGION.reviews}>
        <h2 data-pw-el={PW_EL.sectionTitle}>{t.qaTitle}</h2>
        {!askOpen ? (
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setAskOpen(true)}>
            {t.qaAskButton}
          </button>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 8, maxWidth: 480 }}>
            <textarea
              value={askContent}
              onChange={(e) => setAskContent(e.target.value)}
              placeholder={t.qaFormPlaceholder}
              rows={3}
              maxLength={1000}
            />
            {askMessage ? <p style={{ margin: 0 }}>{askMessage}</p> : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="pw-shop-btn" disabled={!ready || askSubmitting || !askContent.trim()} onClick={() => void submitQuestion()}>
                {t.qaFormSubmit}
              </button>
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setAskOpen(false)}>
                {t.reviewsFormCancel}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
          {questions.length === 0 ? <p className="pw-shop-muted">{t.qaEmpty}</p> : null}
          {questions.map((q) => (
            <article key={q.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }} data-pw-el={PW_EL.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong data-pw-el={PW_EL.cardName}>{q.askerName}</strong>
                <span className="pw-shop-muted" style={{ fontSize: 12 }}>
                  {new Date(q.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
              <p style={{ margin: '4px 0' }} data-pw-el={PW_EL.body}>{q.content}</p>
              <div style={{ display: 'grid', gap: 8, marginLeft: 16, marginTop: 8 }}>
                {q.answers.length === 0 ? <p className="pw-shop-muted" style={{ fontSize: 13 }}>{t.qaNoAnswersYet}</p> : null}
                {q.answers.map((a) => (
                  <div key={a.id} style={{ fontSize: 14 }}>
                    <strong>{a.responderName}</strong>{' '}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: a.answerType === 'admin' ? '#fef3c7' : '#dbeafe',
                        color: a.answerType === 'admin' ? '#92400e' : '#1e40af',
                      }}
                    >
                      {a.answerType === 'admin' ? t.qaAdminBadge : t.qaVerifiedBadge}
                    </span>
                    <p style={{ margin: '4px 0 0' }}>{a.content}</p>
                  </div>
                ))}
              </div>
              {answerOpenFor === q.id ? (
                <div style={{ marginTop: 10, marginLeft: 16, display: 'grid', gap: 8, maxWidth: 420 }}>
                  <textarea
                    value={answerContent}
                    onChange={(e) => setAnswerContent(e.target.value)}
                    placeholder={t.qaAnswerFormPlaceholder}
                    rows={2}
                    maxLength={2000}
                  />
                  {answerMessage ? <p style={{ margin: 0, fontSize: 13 }}>{answerMessage}</p> : null}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="pw-shop-btn"
                      disabled={!ready || answerSubmitting || !answerContent.trim()}
                      onClick={() => void submitAnswer(q.id)}
                    >
                      {t.qaAnswerSubmit}
                    </button>
                    <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setAnswerOpenFor(null)}>
                      {t.reviewsFormCancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="pw-shop-btn pw-shop-btn-outline"
                  style={{ marginTop: 8, marginLeft: 16, fontSize: 13, padding: '4px 10px' }}
                  onClick={() => {
                    setAnswerOpenFor(q.id)
                    setAnswerMessage('')
                  }}
                >
                  {t.qaAnswerButton}
                </button>
              )}
            </article>
          ))}
          {questions.length < questionsTotal ? (
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => {
                const next = questionsPage + 1
                setQuestionsPage(next)
                void loadQuestions(next, true)
              }}
            >
              {t.qaLoadMore}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
