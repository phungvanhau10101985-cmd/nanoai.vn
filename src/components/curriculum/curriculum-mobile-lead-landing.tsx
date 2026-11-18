'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { curriculumMobileZaloHref, CURRICULUM_MOBILE_ZALO_URL } from '@/lib/curriculum/curriculum-mobile-lead'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'

type Copy = Dictionary['curriculumMobileLead']

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

const FEATURES = [
  {
    src: '/curriculum/tom-tat-bai.webp',
    width: 1024,
    height: 500,
    title: 'summaryTitle',
    body: 'summaryBody',
    alt: 'summaryAlt',
  },
  {
    src: '/curriculum/thi-nghiem-phet.webp',
    width: 1024,
    height: 500,
    title: 'labTitle',
    body: 'labBody',
    alt: 'labAlt',
  },
  {
    src: '/curriculum/do-thi.webp',
    width: 1024,
    height: 487,
    title: 'chartTitle',
    body: 'chartBody',
    alt: 'chartAlt',
  },
  {
    src: '/curriculum/youtube.webp',
    width: 1024,
    height: 491,
    title: 'embedTitle',
    body: 'embedBody',
    alt: 'embedAlt',
  },
] as const

export function CurriculumMobileLeadLanding(props: {
  copy: Copy
  locale: string
  freeBodies: number
  creditVnd: string
}) {
  const { copy } = props
  const values = { freeBodies: String(props.freeBodies), creditVnd: props.creditVnd, percent: '90%' }
  const text = (template: string) => fill(template, values)
  const [titleBefore, titleAfter] = copy.title.split('{percent}')
  const zaloHref = curriculumMobileZaloHref(CURRICULUM_MOBILE_ZALO_URL)
  const zaloExternal = zaloHref.startsWith('http')
  const steps = [
    [copy.step1Title, copy.step1Body],
    [copy.step2Title, copy.step2Body],
    [copy.step3Title, copy.step3Body],
  ] as const
  const faqs = [
    [copy.faqPhoneQ, copy.faqPhoneA],
    [copy.faqSlideQ, copy.faqSlideA],
    [copy.faqBookQ, copy.faqBookA],
    [copy.faqStudentQ, copy.faqStudentA],
    [copy.faqSubjectQ, copy.faqSubjectA],
  ] as const

  const [status, setStatus] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') || '')
    const contact = String(data.get('contact') || '')
    const subject = String(data.get('subject') || '')
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/giao-trinh/mobile-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact,
          subject,
          locale: props.locale,
          company_website: String(data.get('company_website') || ''),
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; ignored?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        const code = json?.error
        setError(code === 'rate_limited' ? copy.errorRate : code === 'invalid' ? copy.errorInvalid : copy.errorSave)
        setStatus('form')
        return
      }
      if (!json.ignored) {
        const email = contact.includes('@') ? contact.trim() : ''
        const phone = email ? '' : contact.trim()
        fireMetaStandardEvent('Lead', {
          dedupeKey: `giao-trinh-mobile-lead:${contact.trim().toLowerCase()}`,
          customData: { content_name: 'giao-trinh-mobile-lead' },
          ...(email ? { customerEmail: email } : {}),
          ...(phone ? { customerPhone: phone } : {}),
        })
      }
      setStatus('done')
      document.getElementById('lead-success')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      setError(copy.errorSave)
      setStatus('form')
    }
  }

  return (
    <div className="bg-[#f6f4ff] text-[#111827]">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-40 pt-3">
        <p className="inline-flex rounded-full border border-[#fde68a] bg-[#fff7e6] px-2.5 py-1.5 text-xs font-semibold text-[#854d0e]">
          {copy.badge}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-[#5b3cc4]">{copy.eyebrow}</p>
        <h1 className="mt-2 text-[1.7rem] font-extrabold leading-[1.22] tracking-tight">
          {titleBefore}
          <span className="text-[#b45309]">90%</span>
          {titleAfter}
        </h1>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#4b5563]">{copy.promise}</p>
        <div className="mx-auto mt-3 aspect-[9/16] w-[min(54vw,210px)] overflow-hidden rounded-[20px] bg-[#0b1020] shadow-[0_16px_40px_rgba(28,15,80,0.22)]">
          <video
            controls
            playsInline
            preload="metadata"
            poster="/curriculum/demo-20s-poster.jpg"
            title={copy.videoTitle}
            className="h-full w-full object-cover"
          >
            <source src="/curriculum/demo-20s.mp4" type="video/mp4" />
          </video>
        </div>
        <p className="mt-3 rounded-2xl border border-[#f3d89a] bg-[#fff7e6] px-3.5 py-3 text-sm font-medium text-[#854d0e]">
          <strong className="font-bold">{copy.noteStrong}</strong> {copy.noteRest}
        </p>

        <section id="dang-ky" className="mt-6 rounded-[20px] border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
          <h2 className="text-[1.28rem] font-extrabold leading-snug tracking-tight">{copy.formTitle}</h2>
          <p className="mb-3.5 mt-1 text-[15.5px] text-[#4b5563]">{copy.formLead}</p>
          <div
            id="lead-success"
            role="status"
            className={status === 'done' ? 'rounded-2xl border border-[#a7f3d0] bg-[#ecfdf5] p-3.5 text-[15px] font-semibold text-[#047857]' : 'hidden'}
          >
            {copy.success}
          </div>
          {status !== 'done' ? (
            <form onSubmit={onSubmit} noValidate>
              <div className="hidden" aria-hidden="true">
                <input name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>
              <Field label={copy.nameLabel} id="lead-name">
                <input id="lead-name" name="name" type="text" autoComplete="name" required placeholder={copy.namePlaceholder} className={fieldClass} />
              </Field>
              <Field label={copy.contactLabel} id="lead-contact">
                <input id="lead-contact" name="contact" type="text" inputMode="email" autoComplete="tel" required placeholder={copy.contactPlaceholder} className={fieldClass} />
                <p className="mt-1 text-xs text-[#4b5563]">{copy.contactHint}</p>
              </Field>
              <Field label={copy.subjectLabel} id="lead-subject">
                <input id="lead-subject" name="subject" type="text" required placeholder={copy.subjectPlaceholder} className={fieldClass} />
              </Field>
              {error ? (
                <p role="alert" className="mb-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={status === 'sending'} className={buttonClass}>
                {status === 'sending' ? copy.submitting : copy.submit}
              </button>
            </form>
          ) : null}
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-[1.28rem] font-extrabold tracking-tight">{copy.featuresTitle}</h2>
          <div className="grid gap-3.5">
            {FEATURES.map((feature) => (
              <article key={feature.src} className="overflow-hidden rounded-[20px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
                <img src={feature.src} width={feature.width} height={feature.height} alt={copy[feature.alt]} className="h-auto w-full bg-[#0f172a]" />
                <div className="px-3.5 pb-3.5 pt-3">
                  <h3 className="text-base font-bold">{copy[feature.title]}</h3>
                  <p className="mt-1 text-sm text-[#4b5563]">{copy[feature.body]}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-[1.28rem] font-extrabold tracking-tight">{copy.stepsTitle}</h2>
          <ol className="grid gap-2.5">
            {steps.map(([title, body], index) => (
              <li key={title} className="grid grid-cols-[36px_1fr] gap-2.5 rounded-[14px] border border-[#e5e7eb] bg-white p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#5b3cc4] text-[15px] font-extrabold text-white">{index + 1}</span>
                <span>
                  <span className="block text-[15px] font-bold">{title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-[#4b5563]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-[1.28rem] font-extrabold tracking-tight">{copy.quotaTitle}</h2>
          <div className="rounded-[20px] border border-[#e5e7eb] bg-white p-4 text-[15px] leading-relaxed text-[#4b5563]">
            <p>
              <strong className="text-[#111827]">{text(copy.quotaFree)}</strong><span>{text(copy.quotaDetail)}</span>
            </p>
            <p className="mt-2">{text(copy.quotaCredit)}</p>
          </div>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-[1.28rem] font-extrabold tracking-tight">{copy.faqTitle}</h2>
          {faqs.map(([question, answer]) => (
            <details key={question} className="mb-2 rounded-xl border border-[#e5e7eb] bg-white px-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <span className="font-bold text-[#5b3cc4]" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-3.5 text-sm leading-relaxed text-[#4b5563]">{answer}</p>
            </details>
          ))}
        </section>

        <p className="px-2 pb-3 pt-4 text-center text-[13px] text-[#4b5563]">{copy.footer}</p>
      </div>

      <a
        href={zaloHref}
        id="zalo-btn"
        aria-label={copy.zaloLabel}
        {...(zaloExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="fixed left-3.5 z-[31] grid h-[52px] w-[52px] place-items-center rounded-full bg-[#0068ff] text-white shadow-[0_8px_20px_rgba(0,104,255,0.35)] bottom-[calc(9.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
      >
        <svg viewBox="0 0 48 48" className="h-7 w-7 fill-current" aria-hidden>
          <path d="M24 6c9.94 0 18 6.9 18 15.4 0 4.4-2.2 8.4-5.8 11.3.2 2.4 1.1 6.2 4.4 9-4.7-.3-8.1-2.4-10-3.8-2.1.5-4.3.8-6.6.8C14.06 39 6 32.1 6 21.4 6 12.9 14.06 6 24 6z" />
        </svg>
      </a>

      <div className="fixed inset-x-0 z-30 border-t border-[#e5e7eb] bg-white/95 px-4 py-2 backdrop-blur bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0">
        <div className="mx-auto w-full max-w-[430px]">
          <a href="#dang-ky" className={buttonClass}>
            {copy.stickyCta}
          </a>
        </div>
      </div>
    </div>
  )
}

const fieldClass =
  'h-12 w-full rounded-xl border border-[#d1d5db] bg-white px-3 text-base font-medium text-[#111827] outline-none focus:border-[#5b3cc4] focus:ring-2 focus:ring-[#5b3cc4]'

const buttonClass =
  'inline-flex h-[52px] w-full items-center justify-center rounded-full bg-[#111827] px-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(17,24,39,0.18)] disabled:opacity-70'

function Field(props: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label htmlFor={props.id} className="mb-1.5 block text-[13px] font-semibold">
        {props.label}
      </label>
      {props.children}
    </div>
  )
}
