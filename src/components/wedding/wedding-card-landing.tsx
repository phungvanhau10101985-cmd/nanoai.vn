import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { WeddingLandingStickyCta } from '@/components/wedding/wedding-landing-sticky-cta'
import { WeddingLandingThemes } from '@/components/wedding/wedding-landing-themes'

type Copy = Dictionary['weddingCardAiLanding']

function CreateCta(props: { href: string; label: string; id?: string; className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`h-12 rounded-full bg-rose-700 px-8 text-base text-white hover:bg-rose-800 ${props.className ?? ''}`}
    >
      <Link id={props.id} href={props.href}>
        {props.label}
      </Link>
    </Button>
  )
}

export function WeddingCardLanding(props: {
  copy: Copy
  loginHref: string
  plates: string[]
  themes: { id: string; title: string; image: string }[]
}) {
  const { copy, loginHref, plates } = props
  const hero = plates[0] ?? ''
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
    <div className="pb-4">
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
        <div>
          <p className="text-sm font-medium text-rose-600">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">{copy.promise}</p>
          <CreateCta id="wedding-landing-hero-cta" href={loginHref} label={copy.cta} className="mt-5 w-full sm:w-auto" />
        </div>
        {hero ? (
          <img
            src={hero}
            alt={copy.sampleAlt}
            className="mx-auto max-h-[46vh] w-auto max-w-full rounded-[1.75rem] bg-[#fffaf2] object-contain shadow-lg ring-1 ring-rose-100 lg:max-h-[78vh]"
          />
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-950">{copy.guestSectionTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{copy.guestSectionLead}</p>
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

      {props.themes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-950">{copy.samplesTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{copy.samplesHint}</p>
          <div className="mt-4">
            <WeddingLandingThemes
              themes={props.themes}
              moreLabel={copy.themesMore}
              lessLabel={copy.themesLess}
              openLabel={copy.themesOpen}
            />
          </div>
          <CreateCta href={loginHref} label={copy.cta} className="mt-4 w-full sm:w-auto" />
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-950">{copy.featuresTitle}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <li key={title} className="rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm">
              <p className="font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-950">{copy.stepsTitle}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-2xl bg-rose-50 px-4 py-4">
              <p className="text-sm font-semibold text-rose-700">{index + 1}</p>
              <p className="mt-1 font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-950">{copy.priceTitle}</h2>
        <p className="mt-1 text-sm text-slate-600">{copy.priceLead}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {prices.map(([name, detail, highlighted]) => (
            <li
              key={name}
              className={
                highlighted
                  ? 'rounded-2xl bg-rose-700 px-4 py-4 text-white shadow-sm'
                  : 'rounded-2xl border border-rose-100 bg-white px-4 py-4 shadow-sm'
              }
            >
              <p className={highlighted ? 'text-sm text-rose-100' : 'text-sm text-slate-500'}>{name}</p>
              <p className="mt-1 text-lg font-bold">{detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.priceNote}</p>
        <CreateCta href={loginHref} label={copy.cta} className="mt-4 w-full sm:w-auto" />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-950">{copy.faqTitle}</h2>
        <div className="mt-4 space-y-2">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-2xl border border-rose-100 bg-white px-4 py-3">
              <summary className="cursor-pointer font-medium text-slate-950">{question}</summary>
              <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
        <CreateCta href={loginHref} label={copy.cta} className="mt-5 w-full sm:w-auto" />
      </section>

      <WeddingLandingStickyCta href={loginHref} label={copy.cta} />
    </div>
  )
}
