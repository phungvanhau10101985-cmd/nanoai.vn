'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { submitDocumentTranslateReview } from '@/app/dich-anh-tai-lieu/review-actions'
import type { TranslateReview } from '@/lib/dich-anh-tai-lieu/reviews'

export function TranslateReviewRail({
  reviews,
  signedIn,
  copy,
}: {
  reviews: TranslateReview[]
  signedIn: boolean
  copy: {
    title: string
    lead: string
    placeholder: string
    send: string
    login: string
    thanks: string
    error: string
  }
}) {
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData()
    data.set('rating', String(rating))
    data.set('body', body)
    startTransition(async () => {
      const result = await submitDocumentTranslateReview(data)
      if (result.ok) {
        setBody('')
        setMessage(copy.thanks)
        return
      }
      setMessage(result.error === 'login' ? copy.login : copy.error)
    })
  }

  return (
    <section className="mt-12" aria-labelledby="danh-gia">
      <h2 id="danh-gia" className="text-2xl font-bold">{copy.title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.lead}</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {reviews.map((review) => (
          <article key={review.id} className="w-72 shrink-0 snap-start rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold">{review.authorName}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
            <p className="mt-1 text-sm text-amber-600" aria-label={`${review.rating} / 5`}>
              {'★'.repeat(review.rating)}
              <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>
          </article>
        ))}
      </div>
      {signedIn ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex gap-1" role="radiogroup" aria-label="5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
                className={value <= rating ? 'text-xl text-amber-600' : 'text-xl text-slate-300'}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            name="body"
            required
            minLength={12}
            maxLength={600}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={copy.placeholder}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {copy.send}
          </button>
          {message ? <p className="text-sm">{message}</p> : null}
        </form>
      ) : (
        <p className="mt-4 text-sm">
          <Link href="/auth/login?next=%2Fdich-anh-tai-lieu" className="font-semibold underline">{copy.login}</Link>
        </p>
      )}
    </section>
  )
}
