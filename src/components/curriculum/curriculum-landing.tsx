import Link from 'next/link'
import { CURRICULUM_UI_CREDITS, formatCurriculumCredits } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'
import { HomeworkHelpLandingStickyCta } from '@/components/student-study/homework-help-landing-sticky-cta'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CURRICULUM_DAILY_FREE_BODIES } from '@/lib/curriculum-ai-charge-policy'

type Copy = Dictionary['curriculumLanding']

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

function Cta(props: { href: string; label: string; id?: string; className?: string; tone?: 'primary' | 'inverse' }) {
  const tone = props.tone === 'inverse' ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'
  return (
    <Link
      id={props.id}
      href={props.href}
      className={`inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-semibold ${tone} ${props.className ?? ''}`}
    >
      {props.label}
    </Link>
  )
}

export function CurriculumLanding(props: { copy: Copy; loginHref: string }) {
  const { copy, loginHref } = props
  const values = {
    freeBodies: String(CURRICULUM_DAILY_FREE_BODIES),
    image: formatCurriculumCredits(CURRICULUM_UI_CREDITS.createOrFromImage),
    slide: formatCurriculumCredits(CURRICULUM_UI_CREDITS.lessonSlideGenerate),
    infographic: formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideInfographic2K),
  }
  const text = (template: string) => fill(template, values)
  const flow = [copy.flowSubject, copy.flowSource, copy.flowCurriculum, copy.flowSlides, copy.flowWorksheet]
  const strengths = [
    [copy.strengthScreensTitle, copy.strengthScreensBody],
    [copy.strengthSlidesTitle, copy.strengthSlidesBody],
    [copy.strengthSummaryTitle, copy.strengthSummaryBody],
    [copy.strengthLabTitle, copy.strengthLabBody],
    [copy.strengthChartTitle, copy.strengthChartBody],
  ] as const
  const steps = [
    [copy.step1Title, copy.step1Body],
    [copy.step2Title, copy.step2Body],
    [copy.step3Title, copy.step3Body],
    [copy.step4Title, copy.step4Body],
  ] as const
  const prices = [
    [copy.priceFreeName, text(copy.priceFreeDetail), true],
    [copy.priceImageName, text(copy.priceImageDetail), false],
    [copy.priceSlideName, copy.priceSlideDetail, false],
    [copy.priceAgainName, text(copy.priceAgainDetail), false],
  ] as const
  const faqs = [
    [copy.faq1q, copy.faq1a],
    [copy.faq2q, copy.faq2a],
    [copy.faq3q, copy.faq3a],
    [copy.faq4q, copy.faq4a],
    [copy.faq5q, copy.faq5a],
  ] as const

  return (
    <div className="mx-auto max-w-5xl pb-4">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
        <div>
          <p className="text-sm font-semibold text-primary">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-tight">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{copy.promise}</p>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-foreground">{copy.teacherLine}</p>
          <Cta id="curriculum-landing-hero-cta" href={props.loginHref} label={copy.cta} className="mt-6 w-full sm:w-auto" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.ctaNote}</p>
        </div>
        <ol className="rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-6">
          {flow.map((label, index) => (
            <li key={label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                {index < flow.length - 1 ? <span className="w-px flex-1 bg-border" aria-hidden /> : null}
              </div>
              <p className="pb-5 pt-1 font-medium text-foreground">{label}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.contrastTitle}</h2>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{copy.contrastLead}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <article className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{copy.othersTitle}</p>
            <p className="mt-2 text-base leading-7 text-amber-950 dark:text-amber-50">{copy.othersBody}</p>
          </article>
          <article className="rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
            <p className="text-sm font-semibold opacity-80">{copy.oursTitle}</p>
            <p className="mt-2 text-base leading-7">{copy.oursBody}</p>
          </article>
        </div>
        <Cta href={loginHref} label={copy.cta} className="mt-5 w-full sm:w-auto" />
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.strengthsTitle}</h2>
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {strengths.map(([title, body], index) => (
            <li key={title} className="rounded-3xl border border-border bg-card px-5 py-5">
              <p className="text-sm font-semibold text-primary">{index + 1}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.stepsTitle}</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-3xl bg-muted/60 px-4 py-4">
              <p className="text-sm font-semibold text-primary">{index + 1}</p>
              <p className="mt-1 font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.priceTitle}</h2>
        <p className="mt-2 text-base leading-7 text-muted-foreground">{text(copy.priceLead)}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {prices.map(([name, detail, highlighted]) => (
            <li
              key={name}
              className={
                highlighted
                  ? 'rounded-3xl bg-primary px-4 py-4 text-primary-foreground'
                  : 'rounded-3xl border border-border bg-card px-4 py-4'
              }
            >
              <p className={highlighted ? 'text-sm opacity-80' : 'text-sm text-muted-foreground'}>{name}</p>
              <p className="mt-1 text-2xl font-bold">{detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{text(copy.priceNote)}</p>
        <Cta href={loginHref} label={copy.cta} className="mt-5 w-full sm:w-auto" />
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.faqTitle}</h2>
        <div className="mt-4 space-y-2">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-2xl border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer font-medium text-foreground">{question}</summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-3xl bg-foreground px-6 py-8 text-background sm:px-8">
        <h2 className="text-2xl font-bold tracking-tight">{copy.finalTitle}</h2>
        <p className="mt-2 max-w-xl text-base leading-7 opacity-80">{copy.finalBody}</p>
        <Cta href={loginHref} label={copy.cta} tone="inverse" className="mt-5 w-full sm:w-auto" />
      </section>

      <HomeworkHelpLandingStickyCta href={loginHref} label={copy.cta} heroId="curriculum-landing-hero-cta" />
    </div>
  )
}
