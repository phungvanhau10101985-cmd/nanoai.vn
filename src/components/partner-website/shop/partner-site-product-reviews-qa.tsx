'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { buildPartnerShopLoginHrefFromParts } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import type { WebLocale } from '@/lib/i18n/config'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_PDP_REVIEW_QA_CSS } from '@/lib/partner-website/shop/partner-site-pdp-review-qa'
import {
  qaBuyerAnswerShowsVerifiedBadge,
  reviewShowsVerifiedBadge,
} from '@/lib/partner-website/reviews/partner-review-types'

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
  isImported?: boolean
  guestAccountId?: string | null
  linkedUserId?: string | null
  createdAt: string
}

type AnswerRow = {
  id: string
  answerType: 'buyer' | 'admin'
  responderName: string
  content: string
  isVerified: boolean
  guestAccountId?: string | null
  linkedUserId?: string | null
  createdAt: string
}

type QuestionRow = {
  id: string
  askerName: string
  content: string
  usefulCount?: number
  isImported?: boolean
  createdAt: string
  answers: AnswerRow[]
}

type Props = {
  siteSlug: string
  inventoryId: string
  locale: WebLocale
  productName?: string
  productImage?: string
  productPrice?: string
  catalogReviewsCount?: number
  catalogRatingScore?: number
  catalogQuestionsCount?: number
}

const STARS = [1, 2, 3, 4, 5] as const

function stars(n: number) {
  return STARS.map((i) => (i <= Math.round(n) ? '★' : '☆')).join('')
}

function fmtDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Verified({ label }: { label: string }) {
  return <span className="pw-pdp-verified">✓ {label}</span>
}

export function PartnerSiteProductReviewsQa({
  siteSlug,
  inventoryId,
  locale,
  productName,
  productImage,
  productPrice,
  catalogReviewsCount,
  catalogRatingScore,
  catalogQuestionsCount,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { isAuthenticated } = usePartnerSiteGuestSession(siteSlug)
  const onCustomDomain = usePartnerSiteCustomDomain()
  const api = `/api/site/${encodeURIComponent(siteSlug)}/products/${encodeURIComponent(inventoryId)}`

  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [modal, setModal] = useState<'reviews' | 'qa' | 'write' | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [qaBody, setQaBody] = useState('')
  const [msg, setMsg] = useState('')
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})

  const loginHref = useMemo(() => {
    if (typeof window === 'undefined') return '#'
    return buildPartnerShopLoginHrefFromParts(
      siteSlug,
      window.location.pathname,
      new URLSearchParams(window.location.search),
      window.location.hash || '#reviews',
      { customDomain: onCustomDomain }
    )
  }, [siteSlug, onCustomDomain])

  const load = useCallback(async () => {
    const [r, q] = await Promise.all([
      fetch(`${api}/reviews?page=1&pageSize=100`, { credentials: 'same-origin' }).then((x) => x.json()),
      fetch(`${api}/questions?page=1&pageSize=100`, { credentials: 'same-origin' }).then((x) => x.json()),
    ])
    setReviews(r.reviews ?? [])
    setReviewsTotal(Number(r.total ?? 0))
    if (r.hasReviewed === true) setHasReviewed(true)
    setQuestions(q.questions ?? [])
    setQuestionsTotal(Number(q.total ?? 0))
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash
      if (h === '#reviews' || h.startsWith('#review-')) setModal('reviews')
      if (h === '#qa' || h.startsWith('#question-')) setModal('qa')
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const displayReviewTotal = catalogReviewsCount && catalogReviewsCount > 0 ? catalogReviewsCount : reviewsTotal
  const displayScore = catalogRatingScore && catalogRatingScore > 0 ? catalogRatingScore : 0
  const displayQaTotal = catalogQuestionsCount && catalogQuestionsCount > 0 ? catalogQuestionsCount : questionsTotal
  const sampleReview = reviews[0] ?? null
  const sampleQa = questions[0] ?? null
  const starLabels = [t.reviewsStarLabel1, t.reviewsStarLabel2, t.reviewsStarLabel3, t.reviewsStarLabel4, t.reviewsStarLabel5]

  function goLogin() {
    window.location.href = loginHref
  }

  async function voteReview(id: string) {
    const res = await fetch(`${api}/reviews/${encodeURIComponent(id)}/vote`, { method: 'POST', credentials: 'same-origin' })
    const j = await res.json().catch(() => null)
    if (j?.ok) setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, usefulCount: j.usefulCount } : r)))
  }

  async function voteQuestion(id: string) {
    const res = await fetch(`${api}/questions/${encodeURIComponent(id)}/vote`, { method: 'POST', credentials: 'same-origin' })
    const j = await res.json().catch(() => null)
    if (j?.ok) setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, usefulCount: j.usefulCount } : q)))
  }

  async function submitReview() {
    const content = reviewBody.trim()
    if (!content) return
    const res = await fetch(`${api}/reviews`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, content, locale }),
    })
    const j = await res.json().catch(() => null)
    if (res.status === 401 || j?.error === 'login_required') {
      setMsg(t.reviewsSubmitLoginRequired)
      goLogin()
      return
    }
    if (j?.error === 'already_reviewed') {
      setMsg(t.reviewsSubmitAlreadyReviewed)
      setHasReviewed(true)
      return
    }
    if (j?.error === 'not_eligible') {
      setMsg(t.reviewsSubmitNotEligible)
      return
    }
    if (j?.ok) {
      setMsg(t.reviewsSubmitSuccess)
      setReviewBody('')
      setHasReviewed(true)
      setModal('reviews')
      await load()
    }
  }

  async function submitQuestion() {
    const content = qaBody.trim()
    if (!content) return
    const res = await fetch(`${api}/questions`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const j = await res.json().catch(() => null)
    if (res.status === 401 || j?.error === 'login_required') {
      setMsg(t.qaSubmitLoginRequired)
      goLogin()
      return
    }
    if (j?.ok) {
      setQaBody('')
      await load()
    }
  }

  async function submitAnswer(qid: string) {
    const content = (answerDrafts[qid] ?? '').trim()
    if (!content) return
    const res = await fetch(`${api}/questions/${encodeURIComponent(qid)}/answers`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const j = await res.json().catch(() => null)
    if (res.status === 401 || j?.error === 'login_required') {
      goLogin()
      return
    }
    if (j?.error === 'not_eligible') {
      setMsg(t.qaAnswerNotEligible)
      return
    }
    if (j?.error === 'slot_full') {
      setMsg(t.qaAnswerSlotFull)
      return
    }
    if (j?.ok) {
      setAnswerDrafts((p) => ({ ...p, [qid]: '' }))
      await load()
    }
  }

  function strip() {
    return (
      <div className="pw-pdp-rq-strip">
        {productImage ? <img src={productImage} alt="" /> : null}
        <div>
          <strong>{productName}</strong>
          {productPrice ? <p className="pw-shop-price" style={{ margin: 0 }}>{productPrice}</p> : null}
        </div>
      </div>
    )
  }

  function reviewBlock(r: ReviewRow) {
    const verified = reviewShowsVerifiedBadge({
      isImported: Boolean(r.isImported),
      guestAccountId: r.guestAccountId ?? null,
      linkedUserId: r.linkedUserId ?? null,
      content: r.content,
    })
    return (
      <article key={r.id} id={`review-${r.id}`} className="pw-pdp-rq-item" data-pw-el={PW_EL.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <strong data-pw-el={PW_EL.cardName}>{r.reviewerName}</strong>
            {verified ? <Verified label={t.qaVerifiedBadge} /> : null}
            <div className="pw-shop-muted" style={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</div>
          </div>
          <span className="pw-pdp-star">{stars(r.rating)}</span>
        </div>
        {r.title ? <p className="pw-pdp-rq-title">{r.title}</p> : null}
        <p data-pw-el={PW_EL.body} style={{ margin: '6px 0' }}>{r.content}</p>
        {r.imageUrls?.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {r.imageUrls.map((u) => (
              <img key={u} src={u} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        ) : null}
        {r.merchantReply ? (
          <div className="pw-pdp-rq-reply">
            <strong>{r.merchantReplyBy || 'Shop'}</strong> · {fmtDate(r.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{r.merchantReply}</p>
          </div>
        ) : null}
        <div className="pw-pdp-helpful">
          <span>{t.reviewsHelpfulCount.replace('{n}', String(r.usefulCount || 0))}</span>
          <button type="button" onClick={() => void voteReview(r.id)}>
            👍 {t.reviewsUsefulLabel}
          </button>
        </div>
      </article>
    )
  }

  function questionBlock(q: QuestionRow) {
    const admin = q.answers.find((a) => a.answerType === 'admin')
    const buyers = q.answers.filter((a) => a.answerType === 'buyer').slice(0, 2)
    return (
      <article key={q.id} id={`question-${q.id}`} className="pw-pdp-rq-item" data-pw-el={PW_EL.card}>
        <p style={{ margin: 0 }}>
          <strong data-pw-el={PW_EL.cardName}>{q.askerName}</strong> {t.qaAskedPrefix}{' '}
          <span data-pw-el={PW_EL.body}>{q.content}</span>
        </p>
        <div className="pw-shop-muted" style={{ fontSize: 12 }}>{fmtDate(q.createdAt)}</div>
        {admin ? (
          <div className="pw-pdp-rq-reply">
            <strong>{admin.responderName || 'Shop'}</strong> · {fmtDate(admin.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{admin.content}</p>
          </div>
        ) : null}
        {buyers.map((a) => (
          <div key={a.id} className="pw-pdp-rq-reply buyer">
            <strong>{a.responderName}</strong>
            {qaBuyerAnswerShowsVerifiedBadge({
              ...a,
              guestAccountId: a.guestAccountId ?? null,
              linkedUserId: a.linkedUserId ?? null,
            }) ? <Verified label={t.qaVerifiedBadge} /> : null} {t.qaBuyerReplied} ·{' '}
            {fmtDate(a.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{a.content}</p>
          </div>
        ))}
        {buyers.length < 2 ? (
          <div style={{ marginTop: 8 }}>
            <textarea
              rows={2}
              placeholder={t.qaAnswerFormPlaceholder}
              value={answerDrafts[q.id] ?? ''}
              onChange={(e) => setAnswerDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
            />
            <button type="button" className="pw-shop-btn" style={{ marginTop: 6 }} onClick={() => void submitAnswer(q.id)}>
              {t.qaAnswerSubmit}
            </button>
          </div>
        ) : null}
        <div className="pw-pdp-helpful">
          <span>{t.reviewsHelpfulCount.replace('{n}', String(q.usefulCount || 0))}</span>
          <button type="button" onClick={() => void voteQuestion(q.id)}>
            👍 {t.reviewsUsefulLabel}
          </button>
        </div>
      </article>
    )
  }

  return (
    <>
      <style>{PW_PDP_REVIEW_QA_CSS}</style>
      <div className="pw-pdp-rq-grid" data-pw-region={PW_REGION.reviews} data-pw-bg-role="reviews">
        <section className="pw-pdp-rq-card" id="pw-pdp-reviews">
          <div className="pw-pdp-rq-head">
            <div>
              <h3 className="pw-pdp-rq-head-title" data-pw-el={PW_EL.sectionTitle}>
                {t.reviewsFromCustomers}
              </h3>
              <p className="pw-pdp-rq-head-sub">
                {displayReviewTotal} {t.reviewsTotalSuffix}
              </p>
            </div>
            {displayScore > 0 ? <span className="pw-pdp-rq-badge">{displayScore}/5 ★</span> : null}
          </div>
          <div className="pw-pdp-rq-sample">
            {sampleReview ? reviewBlock(sampleReview) : <p className="pw-shop-muted">{t.reviewsEmpty}</p>}
          </div>
          <div className="pw-pdp-rq-ctas">
            <button type="button" className="pw-shop-btn" onClick={() => setModal('reviews')}>
              {t.reviewsSeeAll}
            </button>
            {!hasReviewed ? (
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setModal('write')}>
                {t.reviewsWriteButton}
              </button>
            ) : null}
          </div>
        </section>
        <section className="pw-pdp-rq-card" id="pw-pdp-qa">
          <div className="pw-pdp-rq-head">
            <div>
              <h3 className="pw-pdp-rq-head-title">{t.qaTitle}</h3>
              <p className="pw-pdp-rq-head-sub">
                {displayQaTotal} {t.qaCountSuffix}
              </p>
            </div>
          </div>
          <div className="pw-pdp-rq-sample">
            {sampleQa ? questionBlock(sampleQa) : <p className="pw-shop-muted">{t.qaEmpty}</p>}
          </div>
          <div className="pw-pdp-rq-ctas">
            <button type="button" className="pw-shop-btn" onClick={() => setModal('qa')}>
              {t.qaSeeMore}
            </button>
          </div>
        </section>
      </div>

      {modal === 'reviews' || modal === 'write' ? (
        <div className="pw-pdp-rq-modal" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
          <div className="pw-pdp-rq-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pw-pdp-rq-dialog-head">
              <strong>{t.reviewsTitle}</strong>
              <div>
                {!hasReviewed ? (
                  <button type="button" className="pw-shop-btn" onClick={() => setModal('write')}>
                    {t.reviewsWriteButton}
                  </button>
                ) : null}
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setModal(null)}>
                  ×
                </button>
              </div>
            </div>
            {strip()}
            {modal === 'write' ? (
              <div data-pw-pdp-slot="review-form" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                <p style={{ margin: 0 }}>{t.reviewsFormRatingLabel}</p>
                <div>
                  {STARS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      style={{ fontSize: 22, background: 'none', border: 'none', color: n <= rating ? '#f59e0b' : '#d1d5db' }}
                    >
                      ★
                    </button>
                  ))}
                  <span className="pw-shop-muted" style={{ marginLeft: 8 }}>{starLabels[rating - 1]}</span>
                </div>
                <textarea
                  rows={3}
                  placeholder={t.reviewsFormContentPlaceholder}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                />
                {msg ? <p>{msg}</p> : null}
                <button type="button" className="pw-shop-btn" onClick={() => void submitReview()}>
                  {t.reviewsFormSubmit}
                </button>
              </div>
            ) : null}
            <div className="pw-pdp-rq-list">{reviews.map(reviewBlock)}</div>
          </div>
        </div>
      ) : null}

      {modal === 'qa' ? (
        <div className="pw-pdp-rq-modal" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
          <div className="pw-pdp-rq-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pw-pdp-rq-dialog-head">
              <strong>{t.qaModalTitle}</strong>
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            {strip()}
            {isAuthenticated ? (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                <textarea rows={3} placeholder={t.qaFormPlaceholder} value={qaBody} onChange={(e) => setQaBody(e.target.value)} />
                <button type="button" className="pw-shop-btn" onClick={() => void submitQuestion()}>
                  {t.qaFormSubmit}
                </button>
              </div>
            ) : (
              <p>
                <a href={loginHref}>{t.qaLoginToAsk}</a>
              </p>
            )}
            {msg ? <p>{msg}</p> : null}
            <div className="pw-pdp-rq-list">{questions.map(questionBlock)}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}
