'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { buildPartnerShopLoginHrefFromParts } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import type { WebLocale } from '@/lib/i18n/config'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  PW_PDP_HELPFUL_THUMB_ICON,
  PW_PDP_REVIEW_QA_CSS,
  PW_PDP_REVIEW_QA_ICON,
  PW_PDP_REVIEW_STAR_ICON,
} from '@/lib/partner-website/shop/partner-site-pdp-review-qa'
import {
  qaPublicBuyerReplyCount,
  qaSlotShowsVerifiedPurchaserBadge,
  reviewShowsVerifiedBadge,
  splitQaReplySlots,
  type PartnerQuestionAnswerRow,
} from '@/lib/partner-website/reviews/partner-review-types'
import {
  shopCardDisplaySrc,
  shopPdpDisplaySrc,
} from '@/lib/partner-website/shop/inventory-shop-detail'

type ReviewRow = {
  id: string
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
  usefulCount: number
  userHasVoted?: boolean
  merchantReply: string
  merchantReplyBy: string
  merchantReplyAt?: string | null
  isImported?: boolean
  guestAccountId?: string | null
  linkedUserId?: string | null
  createdAt: string
}

type AnswerRow = {
  id: string
  answerType: 'buyer' | 'admin'
  replySlot?: 'admin' | 'user_one' | 'user_two' | null
  responderName: string
  content: string
  isVerified: boolean
  isActive?: boolean
  guestAccountId?: string | null
  linkedUserId?: string | null
  createdAt: string
}

type QuestionRow = {
  id: string
  askerName: string
  content: string
  usefulCount?: number
  userHasVoted?: boolean
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
const SUMMARY_PAGE_SIZE = 1
const MODAL_PAGE_SIZE = 20

function stars(n: number) {
  return STARS.map((i) => (i <= Math.round(n) ? '★' : '☆')).join('')
}

function fmtDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Verified({ label }: { label: string }) {
  return (
    <span className="pw-pdp-verified" title={label} role="img" aria-label={label}>
      <svg className="pw-pdp-verified-icon" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#16a34a"
          d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8.05 11.01.13.04.26.06.4.06.14 0 .27-.02.4-.06 4.64-1.25 8.05-5.96 8.05-11.01V5l-8-3z"
        />
        <path
          fill="#22c55e"
          d="M12 3.54 5.5 6.02v4.78c0 4.14 2.86 8.18 6.5 9.85 3.64-1.67 6.5-5.71 6.5-9.85V6.02L12 3.54z"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.2 11.9 11.4 14.1 15.9 8.6"
        />
      </svg>
      <span>{label}</span>
    </span>
  )
}

function HelpfulBtn({
  voted,
  label,
  onClick,
}: {
  voted?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className={voted ? 'is-on' : undefined} onClick={onClick} title={label}>
      <span dangerouslySetInnerHTML={{ __html: PW_PDP_HELPFUL_THUMB_ICON }} />
      {label}
    </button>
  )
}

function EmptyState({ kind, label }: { kind: 'review' | 'qa'; label: string }) {
  return (
    <div className="pw-pdp-rq-empty">
      <span
        className={`pw-pdp-rq-empty-icon ${kind === 'review' ? 'pw-pdp-rq-icon-review' : 'pw-pdp-rq-icon-qa'}`}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: kind === 'review' ? PW_PDP_REVIEW_STAR_ICON : PW_PDP_REVIEW_QA_ICON }}
      />
      <p className="pw-shop-muted">{label}</p>
    </div>
  )
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
  const [reviewsPage, setReviewsPage] = useState(1)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [listBusy, setListBusy] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'reviews' | 'qa' | 'write' | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [qaBody, setQaBody] = useState('')
  const [msg, setMsg] = useState('')
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)

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

  const loadSummary = useCallback(async () => {
    const [r, q] = await Promise.all([
      fetch(`${api}/reviews?page=1&pageSize=${SUMMARY_PAGE_SIZE}`, { credentials: 'same-origin' }).then((x) => x.json()),
      fetch(`${api}/questions?page=1&pageSize=${SUMMARY_PAGE_SIZE}`, { credentials: 'same-origin' }).then((x) => x.json()),
    ])
    setReviews(r.reviews ?? [])
    setReviewsTotal(Number(r.total ?? 0))
    setReviewsPage(1)
    if (r.hasReviewed === true) setHasReviewed(true)
    if (typeof r.canReview === 'boolean') setCanReview(r.canReview)
    setQuestions(q.questions ?? [])
    setQuestionsTotal(Number(q.total ?? 0))
    setQuestionsPage(1)
  }, [api])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const loadReviewsPage = useCallback(async (page: number, append: boolean) => {
    setListBusy(true)
    try {
      const r = await fetch(`${api}/reviews?page=${page}&pageSize=${MODAL_PAGE_SIZE}`, {
        credentials: 'same-origin',
      }).then((x) => x.json())
      const rows = (r.reviews ?? []) as ReviewRow[]
      setReviews((prev) => (append ? [...prev, ...rows] : rows))
      setReviewsTotal(Number(r.total ?? 0))
      setReviewsPage(page)
      if (r.hasReviewed === true) setHasReviewed(true)
      if (typeof r.canReview === 'boolean') setCanReview(r.canReview)
    } finally {
      setListBusy(false)
    }
  }, [api])

  const loadQuestionsPage = useCallback(async (page: number, append: boolean) => {
    setListBusy(true)
    try {
      const highlight =
        typeof window !== 'undefined' ? window.location.hash.match(/^#question-(.+)$/)?.[1] : ''
      const q = await fetch(
        `${api}/questions?page=${page}&pageSize=${MODAL_PAGE_SIZE}${
          highlight ? `&highlight=${encodeURIComponent(highlight)}` : ''
        }`,
        { credentials: 'same-origin' }
      ).then((x) => x.json())
      const rows = (q.questions ?? []) as QuestionRow[]
      setQuestions((prev) => (append ? [...prev, ...rows] : rows))
      setQuestionsTotal(Number(q.total ?? 0))
      setQuestionsPage(page)
    } finally {
      setListBusy(false)
    }
  }, [api])

  const closeModal = useCallback(() => {
    setModal(null)
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (/^#(reviews|qa|review-|question-)/.test(hash)) {
      const { pathname, search } = window.location
      window.history.replaceState(null, '', `${pathname}${search || ''}`)
    }
  }, [])

  useEffect(() => {
    if (modal === 'reviews' || modal === 'write') void loadReviewsPage(1, false)
    if (modal === 'qa') void loadQuestionsPage(1, false)
  }, [modal, loadQuestionsPage, loadReviewsPage])

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

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, closeModal])

  useEffect(() => {
    if (modal !== 'qa') return
    const match = window.location.hash.match(/^#question-(.+)$/)
    if (!match) return
    const t = window.setTimeout(() => {
      document.getElementById(`question-${match[1]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => window.clearTimeout(t)
  }, [modal, questions])

  const displayReviewTotal = catalogReviewsCount && catalogReviewsCount > 0 ? catalogReviewsCount : reviewsTotal
  const displayScore = catalogRatingScore && catalogRatingScore > 0 ? catalogRatingScore : 0
  const displayQaTotal = catalogQuestionsCount && catalogQuestionsCount > 0 ? catalogQuestionsCount : questionsTotal
  const sampleReview = reviews[0] ?? null
  const sampleQa = questions[0] ?? null
  const starLabels = [t.reviewsStarLabel1, t.reviewsStarLabel2, t.reviewsStarLabel3, t.reviewsStarLabel4, t.reviewsStarLabel5]

  async function voteReview(id: string) {
    if (!isAuthenticated) {
      setNotice(t.reviewsVoteLoginRequired)
      return
    }
    const res = await fetch(`${api}/reviews/${encodeURIComponent(id)}/vote`, { method: 'POST', credentials: 'same-origin' })
    const j = await res.json().catch(() => null)
    if (res.status === 401 || j?.error === 'login_required') {
      setNotice(t.reviewsVoteLoginRequired)
      return
    }
    if (j?.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, usefulCount: j.usefulCount, userHasVoted: Boolean(j.voted) } : r))
      )
    }
  }

  async function voteQuestion(id: string) {
    if (!isAuthenticated) {
      setNotice(t.reviewsVoteLoginRequired)
      return
    }
    const res = await fetch(`${api}/questions/${encodeURIComponent(id)}/vote`, { method: 'POST', credentials: 'same-origin' })
    const j = await res.json().catch(() => null)
    if (res.status === 401 || j?.error === 'login_required') {
      setNotice(t.reviewsVoteLoginRequired)
      return
    }
    if (j?.ok) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, usefulCount: j.usefulCount, userHasVoted: Boolean(j.voted) } : q))
      )
    }
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
      setNotice(t.reviewsSubmitLoginRequired)
      return
    }
    if (j?.error === 'already_reviewed') {
      setMsg(t.reviewsSubmitAlreadyReviewed)
      setHasReviewed(true)
      return
    }
    if (j?.error === 'not_eligible') {
      setModal('write')
      setMsg('')
      return
    }
    if (j?.ok) {
      setNotice(t.reviewsSubmitSuccess)
      setReviewBody('')
      setHasReviewed(true)
      setModal('reviews')
      await loadReviewsPage(1, false)
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
      setNotice(t.qaSubmitLoginRequired)
      return
    }
    if (j?.ok) {
      setQaBody('')
      await loadQuestionsPage(1, false)
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
      setNotice(t.qaReplyLoginRequired)
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
      setReplyingId(null)
      await loadQuestionsPage(1, false)
    }
  }

  function openWrite() {
    if (hasReviewed) {
      setModal('reviews')
      return
    }
    setModal('write')
  }

  function openQaToReply(qid: string) {
    if (!isAuthenticated) {
      setNotice(t.qaReplyLoginRequired)
      return
    }
    setReplyingId(qid)
    setModal('qa')
    if (typeof window !== 'undefined') {
      const { pathname, search } = window.location
      window.history.replaceState(null, '', `${pathname}${search || ''}#question-${qid}`)
    }
  }

  function strip() {
    return (
      <div className="pw-pdp-rq-strip">
        {productImage ? (
          <img
            src={shopCardDisplaySrc(productImage) || productImage}
            data-pw-full-src={shopPdpDisplaySrc(productImage) || undefined}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div>
          <strong>{productName}</strong>
          {productPrice ? <p className="pw-shop-price" style={{ margin: 0 }}>{productPrice}</p> : null}
        </div>
      </div>
    )
  }

  function reviewBlock(r: ReviewRow, opts?: { sample?: boolean }) {
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
        {!opts?.sample && r.imageUrls?.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {r.imageUrls.map((u) => (
              <img
                key={u}
                src={shopCardDisplaySrc(u) || u}
                data-pw-full-src={shopPdpDisplaySrc(u) || undefined}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
              />
            ))}
          </div>
        ) : null}
        {r.merchantReply ? (
          <div className="pw-pdp-rq-reply">
            <strong>{r.merchantReplyBy || 'Shop'}</strong> · {fmtDate(r.merchantReplyAt || r.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{r.merchantReply}</p>
          </div>
        ) : null}
        <div className="pw-pdp-helpful">
          {r.usefulCount > 0 ? (
            <span>{t.reviewsHelpfulCount.replace('{n}', String(r.usefulCount))}</span>
          ) : null}
          <HelpfulBtn voted={r.userHasVoted} label={t.reviewsUsefulLabel} onClick={() => void voteReview(r.id)} />
        </div>
      </article>
    )
  }

  function questionBlock(q: QuestionRow, opts?: { sample?: boolean }) {
    const slots = splitQaReplySlots(q.answers as PartnerQuestionAnswerRow[])
    const buyerCount = qaPublicBuyerReplyCount(slots)
    const canReply = buyerCount < 2
    return (
      <article key={q.id} id={`question-${q.id}`} className="pw-pdp-rq-item" data-pw-el={PW_EL.card}>
        <p style={{ margin: 0 }}>
          <strong data-pw-el={PW_EL.cardName}>{q.askerName}</strong> {t.qaAskedPrefix}{' '}
          <span data-pw-el={PW_EL.body}>{q.content}</span>
        </p>
        <div className="pw-shop-muted" style={{ fontSize: 12 }}>{fmtDate(q.createdAt)}</div>
        {slots.admin?.content?.trim() ? (
          <div className="pw-pdp-rq-reply">
            <strong>{slots.admin.responderName || 'Shop'}</strong> · {fmtDate(slots.admin.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{slots.admin.content}</p>
          </div>
        ) : null}
        {slots.userOne?.content?.trim() ? (
          <div className="pw-pdp-rq-reply buyer">
            <strong>{slots.userOne.responderName}</strong>
            {qaSlotShowsVerifiedPurchaserBadge(slots, 1, q.isImported) ? <Verified label={t.qaVerifiedBadge} /> : null}{' '}
            {t.qaBuyerReplied} · {fmtDate(slots.userOne.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{slots.userOne.content}</p>
          </div>
        ) : null}
        {slots.userTwo?.content?.trim() ? (
          <div className="pw-pdp-rq-reply buyer">
            <strong>{slots.userTwo.responderName}</strong>
            {qaSlotShowsVerifiedPurchaserBadge(slots, 2, q.isImported) ? <Verified label={t.qaVerifiedBadge} /> : null}{' '}
            {t.qaBuyerReplied} · {fmtDate(slots.userTwo.createdAt)}
            <p style={{ margin: '4px 0 0' }}>{slots.userTwo.content}</p>
          </div>
        ) : null}
        {canReply ? (
          opts?.sample ? (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="pw-pdp-qa-reply-link" onClick={() => openQaToReply(q.id)}>
                {t.qaReplyBuyerOnly}
              </button>
            </div>
          ) : isAuthenticated ? (
            <div style={{ marginTop: 8 }}>
              {replyingId === q.id ? (
                <div className="pw-pdp-qa-answer-form">
                  <textarea
                    rows={2}
                    placeholder={t.qaAnswerFormPlaceholder}
                    value={answerDrafts[q.id] ?? ''}
                    onChange={(e) => setAnswerDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
                  />
                  <div className="pw-pdp-qa-answer-actions">
                    <button type="button" className="pw-shop-btn" onClick={() => void submitAnswer(q.id)}>
                      {t.qaAnswerSubmit}
                    </button>
                    <button
                      type="button"
                      className="pw-shop-btn pw-shop-btn-outline"
                      onClick={() => {
                        setReplyingId(null)
                        setAnswerDrafts((p) => ({ ...p, [q.id]: '' }))
                      }}
                    >
                      {t.qaReplyCancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="pw-pdp-qa-reply-link" onClick={() => setReplyingId(q.id)}>
                  {t.qaReplyBuyerOnly}
                </button>
              )}
            </div>
          ) : null
        ) : null}
        <div className="pw-pdp-helpful">
          {(q.usefulCount || 0) > 0 ? (
            <span>{t.qaHelpfulCount.replace('{n}', String(q.usefulCount || 0))}</span>
          ) : null}
          <HelpfulBtn voted={q.userHasVoted} label={t.reviewsUsefulLabel} onClick={() => void voteQuestion(q.id)} />
        </div>
      </article>
    )
  }

  return (
    <>
      <style>{PW_PDP_REVIEW_QA_CSS}</style>
      <div className="pw-pdp-rq-grid" data-pw-region={PW_REGION.reviews} data-pw-bg-role="reviews" data-pw-pdp-slot="reviews-qa">
        <section className="pw-pdp-rq-card" id="pw-pdp-reviews">
          <div className="pw-pdp-rq-head">
            <div className="pw-pdp-rq-head-row">
              <span
                className="pw-pdp-rq-icon pw-pdp-rq-icon-review"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: PW_PDP_REVIEW_STAR_ICON }}
              />
              <div>
                <h3 className="pw-pdp-rq-head-title" data-pw-el={PW_EL.sectionTitle}>
                  {t.reviewsFromCustomers}
                </h3>
                <p className="pw-pdp-rq-head-sub">
                  {displayReviewTotal} {t.reviewsTotalSuffix}
                </p>
              </div>
            </div>
            <span className="pw-pdp-rq-badge">{(displayScore || 0).toFixed(1)}/5 ★</span>
          </div>
          <div className="pw-pdp-rq-body">
            <div className="pw-pdp-rq-sample">
              {sampleReview ? (
                <div className="pw-pdp-rq-sample-box">{reviewBlock(sampleReview, { sample: true })}</div>
              ) : (
                <EmptyState kind="review" label={t.reviewsEmpty} />
              )}
            </div>
            <div className="pw-pdp-rq-ctas">
              <button type="button" className="pw-shop-btn" onClick={() => setModal('reviews')}>
                {sampleReview ? t.reviewsSeeAll : t.reviewsSeeMore}
              </button>
              {!hasReviewed ? (
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={openWrite}>
                  {t.reviewsWriteButton}
                </button>
              ) : (
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setModal('reviews')}>
                  {t.reviewsSeeMore}
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="pw-pdp-rq-card" id="pw-pdp-qa">
          <div className="pw-pdp-rq-head">
            <div className="pw-pdp-rq-head-row">
              <span
                className="pw-pdp-rq-icon pw-pdp-rq-icon-qa"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: PW_PDP_REVIEW_QA_ICON }}
              />
              <div>
                <h3 className="pw-pdp-rq-head-title">{t.qaTitle}</h3>
                <p className="pw-pdp-rq-head-sub">
                  {displayQaTotal} {t.qaCountSuffix}
                </p>
              </div>
            </div>
          </div>
          <div className="pw-pdp-rq-body">
            <div className="pw-pdp-rq-sample">
              {sampleQa ? (
                <div className="pw-pdp-rq-sample-box">{questionBlock(sampleQa, { sample: true })}</div>
              ) : (
                <EmptyState kind="qa" label={t.qaEmpty} />
              )}
            </div>
            <div className="pw-pdp-rq-ctas">
              <button type="button" className="pw-shop-btn" onClick={() => setModal('qa')}>
                {sampleQa ? t.qaSeeMore : t.qaSeeList}
              </button>
            </div>
          </div>
        </section>
      </div>

      {modal === 'write' ? (
        <div className="pw-pdp-rq-modal" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="pw-pdp-rq-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pw-pdp-rq-dialog-head">
              <strong>{t.reviewsTitle}</strong>
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={closeModal}>
                ×
              </button>
            </div>
            {!canReview ? (
              <div className="pw-pdp-rq-need-buy">
                <p>{t.reviewsPurchaseRequired}</p>
                <button type="button" className="pw-shop-btn" onClick={closeModal}>
                  {t.reviewsPurchaseRequiredClose}
                </button>
              </div>
            ) : (
              <div data-pw-pdp-slot="review-form" style={{ display: 'grid', gap: 8 }}>
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
            )}
          </div>
        </div>
      ) : null}

      {modal === 'reviews' ? (
        <div className="pw-pdp-rq-modal" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="pw-pdp-rq-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pw-pdp-rq-dialog-head">
              <strong>{t.reviewsTitle}</strong>
              <div>
                {!hasReviewed ? (
                  <button type="button" className="pw-shop-btn" onClick={openWrite}>
                    {t.reviewsWriteButton}
                  </button>
                ) : null}
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={closeModal}>
                  ×
                </button>
              </div>
            </div>
            {strip()}
            <div className="pw-pdp-rq-list">{reviews.map((r) => reviewBlock(r))}</div>
            {reviews.length < reviewsTotal ? (
              <button
                type="button"
                className="pw-shop-btn pw-shop-btn-outline"
                disabled={listBusy}
                onClick={() => void loadReviewsPage(reviewsPage + 1, true)}
              >
                {t.loadMore}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {modal === 'qa' ? (
        <div className="pw-pdp-rq-modal" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="pw-pdp-rq-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pw-pdp-rq-dialog-head">
              <strong>{t.qaModalTitle}</strong>
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={closeModal}>
                ×
              </button>
            </div>
            {strip()}
            {isAuthenticated ? (
              <div className="pw-pdp-qa-ask-form">
                <p className="pw-pdp-qa-ask-title">{t.qaAskTitle}</p>
                <textarea rows={3} placeholder={t.qaFormPlaceholder} value={qaBody} onChange={(e) => setQaBody(e.target.value)} />
                <button type="button" className="pw-shop-btn" onClick={() => void submitQuestion()}>
                  {t.qaFormSubmit}
                </button>
              </div>
            ) : (
              <div className="pw-pdp-qa-login-banner">
                <p>{t.qaLoginBanner}</p>
                <a href={loginHref} className="pw-shop-btn">
                  {t.qaLoginToAsk}
                </a>
              </div>
            )}
            {msg ? <p>{msg}</p> : null}
            <div className="pw-pdp-rq-list">{questions.length ? questions.map((q) => questionBlock(q)) : <p className="pw-shop-muted">{t.qaEmptyHint}</p>}</div>
            {questions.length < questionsTotal ? (
              <button
                type="button"
                className="pw-shop-btn pw-shop-btn-outline"
                disabled={listBusy}
                onClick={() => void loadQuestionsPage(questionsPage + 1, true)}
              >
                {t.loadMore}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {notice ? (
        <div id="pw-pdp-rq-toast" className="pw-pdp-rq-toast" role="status">
          {notice}
        </div>
      ) : null}
    </>
  )
}
