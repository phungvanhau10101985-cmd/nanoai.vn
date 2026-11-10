import Link from 'next/link'
import { JsonLd } from '@/components/seo-json-ld'
import { LanguageModeSwitch } from '@/components/hoc-ngoai-ngu/language-mode-switch'
import { LanguagePairSwitcher } from '@/components/hoc-ngoai-ngu/language-pair-switcher'
import { LanguageReviewRail } from '@/components/hoc-ngoai-ngu/language-review-rail'
import { languageLandingCopy, type LanguageLandingCopy } from '@/lib/hoc-ngoai-ngu/landing-copy'
import { chineseLandingCopy } from '@/lib/hoc-ngoai-ngu/chinese-landing-copy'
import { japaneseLandingCopy } from '@/lib/hoc-ngoai-ngu/japanese-landing-copy'
import { koreanLandingCopy } from '@/lib/hoc-ngoai-ngu/korean-landing-copy'
import { vietnameseLandingCopy } from '@/lib/hoc-ngoai-ngu/vietnamese-landing-copy'
import type { LanguageCoachReview, LanguageReviewPageKey } from '@/lib/hoc-ngoai-ngu/reviews'
import type { LanguagePairCode } from '@/lib/hoc-ngoai-ngu/samples'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { freeLiveTrialHeadline } from '@/lib/english-coach-free-lessons'
import type { WebLocale } from '@/lib/i18n/config'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { SITE_URL } from '@/lib/seo'

const LIVE_CREDITS = 3.5
const PRESET_CREDITS = 2

function money(locale: WebLocale, amount: number): string {
  const n = Math.round(amount).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')
  return locale === 'vi' ? `${n}đ` : `${n} VND`
}

const FOREIGN_NATIVE_CODES: LanguagePairCode[] = ['en', 'zh', 'ja', 'ko', 'th', 'hi']
const CHINESE_NATIVE_CODES: LanguagePairCode[] = ['vi', 'en', 'ja', 'ko', 'th', 'hi']
const JAPANESE_NATIVE_CODES: LanguagePairCode[] = ['vi', 'en', 'zh', 'ko', 'th', 'hi']
const KOREAN_NATIVE_CODES: LanguagePairCode[] = ['vi', 'en', 'zh', 'ja', 'th', 'hi']

type LandingVariant = 'languages' | 'vietnamese' | 'chinese' | 'japanese' | 'korean'

const LANDING_VARIANT: Record<LandingVariant, {
  copy: (locale: WebLocale, livePrice: string, presetPrice: string) => LanguageLandingCopy
  path: string
  pageKey: LanguageReviewPageKey
  initialNative: LanguagePairCode
  initialTarget: LanguagePairCode
  lockTarget: boolean
  nativeCodes?: LanguagePairCode[]
}> = {
  languages: {
    copy: languageLandingCopy,
    path: '/hoc-tieng-anh-ai',
    pageKey: 'hoc-ngoai-ngu',
    initialNative: 'vi',
    initialTarget: 'en',
    lockTarget: false,
  },
  vietnamese: {
    copy: vietnameseLandingCopy,
    path: '/hoc-tieng-viet',
    pageKey: 'hoc-tieng-viet',
    initialNative: 'en',
    initialTarget: 'vi',
    lockTarget: true,
    nativeCodes: FOREIGN_NATIVE_CODES,
  },
  chinese: {
    copy: chineseLandingCopy,
    path: '/hoc-tieng-trung',
    pageKey: 'hoc-tieng-trung',
    initialNative: 'vi',
    initialTarget: 'zh',
    lockTarget: true,
    nativeCodes: CHINESE_NATIVE_CODES,
  },
  japanese: {
    copy: japaneseLandingCopy,
    path: '/hoc-tieng-nhat',
    pageKey: 'hoc-tieng-nhat',
    initialNative: 'vi',
    initialTarget: 'ja',
    lockTarget: true,
    nativeCodes: JAPANESE_NATIVE_CODES,
  },
  korean: {
    copy: koreanLandingCopy,
    path: '/hoc-tieng-han',
    pageKey: 'hoc-tieng-han',
    initialNative: 'vi',
    initialTarget: 'ko',
    lockTarget: true,
    nativeCodes: KOREAN_NATIVE_CODES,
  },
}

export function LanguageLearningLanding({
  reviews,
  signedIn,
  variant = 'languages',
}: {
  reviews: LanguageCoachReview[]
  signedIn: boolean
  variant?: LandingVariant
}) {
  const locale = getCurrentWebLocale()
  const livePrice = `${LIVE_CREDITS.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} credit · ${money(locale, CREDIT_UNIT_PRICE_VND * LIVE_CREDITS)}`
  const presetPrice = `${PRESET_CREDITS.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} credit · ${money(locale, CREDIT_UNIT_PRICE_VND * PRESET_CREDITS)}`
  const setup = LANDING_VARIANT[variant]
  const copy = setup.copy(locale, livePrice, presetPrice)
  const pagePath = setup.path
  const pageUrl = `${SITE_URL}${pagePath}`
  const liveHref = copy.modes[0]?.href ?? '/hoc-tieng-anh-ai/luyen-noi'
  const ratingValue = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 5
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: copy.home, item: SITE_URL },
          ...(copy.parentHref && copy.parentLabel
            ? [{ '@type': 'ListItem', position: 2, name: copy.parentLabel, item: `${SITE_URL}${copy.parentHref}` }]
            : []),
          { '@type': 'ListItem', position: copy.parentHref ? 3 : 2, name: copy.h1, item: pageUrl },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: copy.h1,
        description: copy.lead,
        inLanguage: locale,
        isPartOf: { '@type': 'WebSite', name: 'NanoAI', url: SITE_URL },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['#gioi-thieu', '#thong-tin-dich-vu', '#cau-hoi'],
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: copy.h1,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        url: pageUrl,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue,
          reviewCount: reviews.length,
          bestRating: 5,
          worstRating: 1,
        },
        review: reviews.slice(0, 8).map((review) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: review.authorName },
          datePublished: review.createdAt.slice(0, 10),
          reviewBody: review.body,
          reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
        })),
        offers: [
          {
            '@type': 'Offer',
            name: copy.modes[0]?.name,
            price: CREDIT_UNIT_PRICE_VND * LIVE_CREDITS,
            priceCurrency: 'VND',
            description: copy.modes[0]?.detail,
            url: `${SITE_URL}${liveHref}`,
          },
          {
            '@type': 'Offer',
            name: copy.modes[1]?.name,
            price: CREDIT_UNIT_PRICE_VND * PRESET_CREDITS,
            priceCurrency: 'VND',
            description: copy.modes[1]?.detail,
            url: `${SITE_URL}${copy.modes[1]?.href ?? '/hoc-bai-hoc-co-san'}`,
          },
        ],
      },
      {
        '@type': 'HowTo',
        name: copy.stepsTitle,
        step: copy.steps.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.name,
          text: step.text,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: copy.faqs.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  }

  return (
    <article className="mx-auto mt-10 max-w-3xl px-4 pb-16 text-foreground">
      <JsonLd data={graph} />
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">{copy.home}</Link>
          </li>
          {copy.parentHref && copy.parentLabel ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={copy.parentHref} className="hover:text-foreground">{copy.parentLabel}</Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="font-medium text-foreground">{copy.h1}</li>
        </ol>
      </nav>

      <p className="mt-8 text-sm font-medium text-slate-600">{copy.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{copy.h1}</h1>
      <p className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-xl font-bold text-amber-950">
        {freeLiveTrialHeadline(locale)}
      </p>
      <p id="gioi-thieu" className="mt-4 text-base leading-7 text-muted-foreground">{copy.lead}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={liveHref} className="inline-flex h-11 items-center rounded-md bg-amber-500 px-5 text-sm font-semibold text-amber-950">
          {copy.cta}
        </Link>
        <a href="#cach-hoc" className="inline-flex h-11 items-center rounded-md border border-slate-300 px-5 text-sm font-semibold">
          {copy.ctaSecondary}
        </a>
        <Link href={copy.relatedHref} className="inline-flex h-11 items-center text-sm font-semibold underline">
          {copy.relatedLabel}
        </Link>
        {[
          [copy.secondRelatedHref, copy.secondRelatedLabel],
          [copy.thirdRelatedHref, copy.thirdRelatedLabel],
          [copy.fourthRelatedHref, copy.fourthRelatedLabel],
        ].map(([href, label]) => href && label ? (
          <Link key={href} href={href} className="inline-flex h-11 items-center text-sm font-semibold underline">
            {label}
          </Link>
        ) : null)}
      </div>

      <section className="mt-12" id="cach-hoc" aria-labelledby="cach-hoc-title">
        <h2 id="cach-hoc-title" className="text-2xl font-bold">{copy.modesTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.modesLead}</p>
        <div className="mt-4">
          <LanguageModeSwitch modes={copy.modes} />
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {copy.modes.map((mode) => (
            <li key={mode.id} className={mode.id === 'live' ? 'rounded-lg border-2 border-amber-400 bg-amber-50 p-4' : 'rounded-lg border border-slate-200 p-4'}>
              <p className="text-sm font-semibold">{mode.name}</p>
              <p className="mt-1 text-base font-bold">{mode.price}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{mode.detail}</p>
              <Link href={mode.href} className="mt-3 inline-flex text-sm font-semibold underline">{mode.action}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="mau-hoi-thoai">
        <h2 id="mau-hoi-thoai" className="text-2xl font-bold">{copy.sampleTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.sampleLead}</p>
        <div className="mt-4">
          <LanguagePairSwitcher
            nativeLabel={copy.switchNative}
            targetLabel={copy.switchTarget}
            labels={copy.langLabels}
            teacherLabel={copy.roleTeacher}
            learnerLabel={copy.roleLearner}
            fixLabel={copy.roleFix}
            glossLabel={copy.roleGloss}
            initialNative={setup.initialNative}
            initialTarget={setup.initialTarget}
            lockTarget={setup.lockTarget}
            nativeCodes={setup.nativeCodes}
          />
        </div>
      </section>

      <section className="mt-12" id="thong-tin-dich-vu" aria-labelledby="thong-tin-dich-vu-title">
        <h2 id="thong-tin-dich-vu-title" className="text-2xl font-bold">{copy.factsTitle}</h2>
        <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {copy.facts.map((fact) => (
            <div key={fact.term} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-sm font-semibold">{fact.term}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="cac-buoc">
        <h2 id="cac-buoc" className="text-2xl font-bold">{copy.stepsTitle}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">
          {copy.steps.map((step) => (
            <li key={step.name}>
              <span className="font-semibold">{step.name}. </span>
              {step.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" id="cau-hoi" aria-labelledby="cau-hoi-title">
        <h2 id="cau-hoi-title" className="text-2xl font-bold">{copy.faqTitle}</h2>
        <div className="mt-4 space-y-3">
          {copy.faqs.map((item) => (
            <details key={item.question} className="rounded-lg border border-slate-200 p-4" open>
              <summary className="cursor-pointer text-sm font-semibold">{item.question}</summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <LanguageReviewRail
        reviews={reviews}
        signedIn={signedIn}
        pageKey={setup.pageKey}
        loginNext={pagePath}
        copy={{
          title: copy.reviewTitle,
          lead: copy.reviewLead,
          placeholder: copy.reviewPlaceholder,
          send: copy.reviewSend,
          login: copy.reviewLogin,
          thanks: copy.reviewThanks,
          error: copy.reviewError,
        }}
      />

      <section className="mt-12 rounded-xl bg-slate-900 px-6 py-8 text-white">
        <p className="text-lg font-bold text-amber-200">{freeLiveTrialHeadline(locale)}</p>
        <h2 className="mt-2 text-2xl font-bold">{copy.closeTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">{copy.closeLead}</p>
        <Link href={liveHref} className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-semibold text-slate-900">
          {copy.cta}
        </Link>
      </section>
    </article>
  )
}
