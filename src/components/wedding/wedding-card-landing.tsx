import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { WeddingLandingStickyCta } from '@/components/wedding/wedding-landing-sticky-cta'
import { WeddingLandingThemes } from '@/components/wedding/wedding-landing-themes'
import { WeddingReviewRail } from '@/components/wedding/wedding-review-rail'
import type { WeddingReview } from '@/lib/wedding/wedding-reviews'

type Copy = Dictionary['weddingCardAiLanding']

function CreateCta(props: { href: string; label: string; id?: string; className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`h-12 min-h-12 touch-manipulation rounded-full bg-rose-700 px-8 text-base text-white hover:bg-rose-800 active:scale-[0.99] ${props.className ?? ''}`}
    >
      <Link id={props.id} href={props.href}>
        {props.label}
      </Link>
    </Button>
  )
}

function SectionTitle(props: { children: string; id?: string }) {
  return (
    <h2 id={props.id} className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
      {props.children}
    </h2>
  )
}

export function WeddingCardLanding(props: {
  copy: Copy
  loginHref: string
  themes: { id: string; title: string; image: string; cover: string; occasionKey: string }[]
  locale: import('@/lib/i18n/config').WebLocale
  reviews: WeddingReview[]
  signedIn: boolean
}) {
  const { copy, loginHref } = props
  const guestPoints = [
    [copy.guestNameTitle, copy.guestNameBody],
    [copy.guestRsvpTitle, copy.guestRsvpBody],
    [copy.guestCountTitle, copy.guestCountBody],
  ] as const
  const features = [
    [copy.featureGuestTitle, copy.featureGuestBody],
    [copy.featureBgTitle, copy.featureBgBody],
    [copy.featureFrameTitle, copy.featureFrameBody],
    [copy.featureTextTitle, copy.featureTextBody],
    [copy.featureSidesTitle, copy.featureSidesBody],
    [copy.featurePlanTitle, copy.featurePlanBody],
    [copy.featureMusicTitle, copy.featureMusicBody],
    [copy.featureAlbumTitle, copy.featureAlbumBody],
    [copy.featureGiftTitle, copy.featureGiftBody],
  ] as const
  const steps = [
    [copy.step1Title, copy.step1Body],
    [copy.step2Title, copy.step2Body],
    [copy.step3Title, copy.step3Body],
  ] as const
  const prices = [
    [copy.priceTrialName, copy.priceTrialDetail, false],
    [copy.price100Name, copy.price100Detail, false],
    [copy.price200Name, copy.price200Detail, false],
    [copy.priceUnlimitedName, copy.priceUnlimitedDetail, true],
  ] as const
  const faqs = [
    [copy.faq1q, copy.faq1a],
    [copy.faq2q, copy.faq2a],
    [copy.faq3q, copy.faq3a],
    [copy.faq4q, copy.faq4a],
    [copy.faq5q, copy.faq5a],
    [copy.faq6q, copy.faq6a],
  ] as const

  return (
    <div className="min-w-0 pb-2">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">{copy.eyebrow}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">{copy.promise}</p>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-rose-800 sm:text-base">{copy.freeLine}</p>
        </div>
        <CreateCta id="wedding-landing-hero-cta" href={loginHref} label={copy.cta} className="w-full shrink-0 sm:w-auto" />
      </section>

      {props.themes.length > 0 ? (
        <section className="mt-6 rounded-3xl bg-rose-50/80 px-3 py-4 ring-1 ring-rose-100 sm:mt-8 sm:px-5 sm:py-5 lg:px-6 lg:py-6" aria-labelledby="wedding-landing-samples">
          <SectionTitle id="wedding-landing-samples">{copy.samplesTitle}</SectionTitle>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{copy.samplesHint}</p>
          <div className="mt-4">
            <WeddingLandingThemes
              locale={props.locale}
              themes={props.themes}
              moreLabel={copy.themesMore}
              lessLabel={copy.themesLess}
              openLabel={copy.themesOpen}
              variant="landing"
            />
          </div>
          <CreateCta href={loginHref} label={copy.cta} className="mt-4 w-full sm:w-auto" />
        </section>
      ) : null}

      <section className="mt-10 sm:mt-14">
        <SectionTitle>{copy.guestSectionTitle}</SectionTitle>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{copy.guestSectionLead}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {guestPoints.map(([title, body], index) => (
            <li
              key={title}
              className={
                index === guestPoints.length - 1
                  ? 'rounded-2xl bg-rose-700 px-4 py-4 text-white shadow-sm'
                  : 'rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm'
              }
            >
              <p className="font-semibold">{title}</p>
              <p className={index === guestPoints.length - 1 ? 'mt-1 text-sm leading-6 text-rose-50' : 'mt-1 text-sm leading-6 text-slate-600'}>
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 sm:mt-14">
        <SectionTitle>{copy.featuresTitle}</SectionTitle>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <li key={title} className="rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm">
              <p className="font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 sm:mt-14">
        <SectionTitle>{copy.stepsTitle}</SectionTitle>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-2xl bg-rose-50 px-4 py-4">
              <p className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-700 text-sm font-semibold text-white">{index + 1}</p>
              <p className="mt-2 font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 sm:mt-14">
        <SectionTitle>{copy.priceTitle}</SectionTitle>
        <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">{copy.priceLead}</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {prices.map(([name, detail, highlighted]) => (
            <li
              key={name}
              className={
                highlighted
                  ? 'flex min-h-[6.5rem] flex-col justify-center rounded-2xl bg-rose-700 px-3 py-4 text-white shadow-sm sm:px-4'
                  : 'flex min-h-[6.5rem] flex-col justify-center rounded-2xl border border-rose-100 bg-white px-3 py-4 shadow-sm sm:px-4'
              }
            >
              <p className={highlighted ? 'text-sm text-rose-100' : 'text-sm text-slate-500'}>{name}</p>
              <p className="mt-1 text-base font-bold leading-snug sm:text-lg">{detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.priceNote}</p>
        <CreateCta href={loginHref} label={copy.cta} className="mt-4 w-full sm:w-auto" />
      </section>

      <section className="mt-10 sm:mt-14">
        <SectionTitle>{copy.faqTitle}</SectionTitle>
        <div className="mt-4 space-y-2">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-2xl border border-rose-100 bg-white px-4 open:pb-3">
              <summary className="flex min-h-12 cursor-pointer items-center py-2 font-medium text-slate-950 touch-manipulation">
                {question}
              </summary>
              <p className="text-sm leading-6 text-slate-600 sm:text-base">{answer}</p>
            </details>
          ))}
        </div>
        <CreateCta href={loginHref} label={copy.cta} className="mt-5 w-full sm:w-auto" />
      </section>

      <WeddingReviewRail
        reviews={props.reviews}
        signedIn={props.signedIn}
        loginHref={loginHref}
        locale={props.locale}
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

      <WeddingLandingStickyCta href={loginHref} label={copy.cta} />
    </div>
  )
}
