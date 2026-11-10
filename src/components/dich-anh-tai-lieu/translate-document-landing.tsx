import Link from 'next/link'
import { TranslateReviewRail } from '@/components/dich-anh-tai-lieu/translate-review-rail'
import type { TranslateReview } from '@/lib/dich-anh-tai-lieu/reviews'
import { JsonLd } from '@/components/seo-json-ld'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { DOCUMENT_TRANSLATE_GEMINI_CREDITS } from '@/lib/document-translate-pricing'
import { DOCUMENT_TRANSLATE_LANGUAGES } from '@/lib/document-translate-languages'
import { translateDocumentLandingCopy } from '@/lib/dich-anh-tai-lieu/landing-copy'
import type { WebLocale } from '@/lib/i18n/config'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { NANOAI_IMAGE_NAME } from '@/lib/ai/nanoai-image-names'
import { SITE_URL } from '@/lib/seo'

function money(locale: WebLocale, amount: number): string {
  const n = Math.round(amount).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')
  return locale === 'vi' ? `${n}đ` : `${n} VND`
}

export function TranslateDocumentLanding({
  reviews,
  signedIn,
}: {
  reviews: TranslateReview[]
  signedIn: boolean
}) {
  const locale = getCurrentWebLocale()
  const copy = translateDocumentLandingCopy(locale)
  const prices = {
    gptMedium: money(locale, CREDIT_UNIT_PRICE_VND),
    gptHigh: money(locale, CREDIT_UNIT_PRICE_VND * 2),
    gemini2k: money(locale, CREDIT_UNIT_PRICE_VND * DOCUMENT_TRANSLATE_GEMINI_CREDITS['2K']),
    gemini4k: money(locale, CREDIT_UNIT_PRICE_VND * DOCUMENT_TRANSLATE_GEMINI_CREDITS['4K']),
  }
  const modelRows = [
    { model: NANOAI_IMAGE_NAME.medium, credit: '1', price: prices.gptMedium, vnd: CREDIT_UNIT_PRICE_VND },
    { model: NANOAI_IMAGE_NAME.high, credit: '2', price: prices.gptHigh, vnd: CREDIT_UNIT_PRICE_VND * 2 },
    {
      model: NANOAI_IMAGE_NAME['2K'],
      credit: '1.5',
      price: prices.gemini2k,
      vnd: Math.round(CREDIT_UNIT_PRICE_VND * DOCUMENT_TRANSLATE_GEMINI_CREDITS['2K']),
    },
    {
      model: NANOAI_IMAGE_NAME['4K'],
      credit: '4',
      price: prices.gemini4k,
      vnd: CREDIT_UNIT_PRICE_VND * DOCUMENT_TRANSLATE_GEMINI_CREDITS['4K'],
    },
  ]
  const fits: Record<string, string> = {
    [NANOAI_IMAGE_NAME.medium]: locale === 'vi' ? 'Chữ trang tài liệu thông thường. Mức nên mở.' : locale === 'zh' ? '普通文档文字。建议先用。' : locale === 'ja' ? '普通の文書の文字。最初に使う段階。' : locale === 'ko' ? '일반 문서 글자. 먼저 쓰는 단계.' : 'Ordinary document text. The tier to start with.',
    [NANOAI_IMAGE_NAME.high]: locale === 'vi' ? 'Chữ nhỏ và bản vẽ dày. Cùng cỡ ảnh với NanoAI 2M.' : locale === 'zh' ? '小字和密图。画面尺寸与 NanoAI 2M 相同。' : locale === 'ja' ? '小さい文字と密な図面。画像サイズは NanoAI 2M と同じ。' : locale === 'ko' ? '작은 글자와 빽빽한 도면. 화면 크기는 NanoAI 2M과 같음.' : 'Small type and dense drawings. Same image size as NanoAI 2M.',
    [NANOAI_IMAGE_NAME['2K']]: locale === 'vi' ? 'Trang nét hơn, xem trên màn hình và in vừa.' : locale === 'zh' ? '页面更清晰，适合屏幕和普通打印。' : locale === 'ja' ? 'より鮮明。画面と小さめの印刷向け。' : locale === 'ko' ? '더 선명. 화면과 보통 인쇄용.' : 'Sharper page, for screen and modest print.',
    [NANOAI_IMAGE_NAME['4K']]: locale === 'vi' ? 'Nét nhất, để in lớn. Chữ không chắc hơn NanoAI 2M.' : locale === 'zh' ? '最清晰，适合大幅印刷。文字不一定比 NanoAI 2M 更准。' : locale === 'ja' ? '最も鮮明で大判印刷向け。文字は NanoAI 2M より正確とは限らない。' : locale === 'ko' ? '가장 선명하고 큰 인쇄용. 글자는 NanoAI 2M보다 더 정확하다고 보기 어렵습니다.' : 'Sharpest, for large print. Text is not more reliable than NanoAI 2M.',
  }
  const ctaHref = '/dich-anh-tai-lieu/xu-ly'
  const startButton = (
    <div className="mt-6">
      <Link href={ctaHref} className="inline-flex h-11 items-center rounded-md bg-slate-800 px-5 text-sm font-semibold text-white">
        {copy.cta}
      </Link>
    </div>
  )
  const pageUrl = `${SITE_URL}/dich-anh-tai-lieu`
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: copy.home, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: copy.h1, item: pageUrl },
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
      },
      {
        '@type': 'SoftwareApplication',
        name: 'NanoAI document image translation',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: pageUrl,
        offers: modelRows.map((row) => ({
          '@type': 'Offer',
          name: row.model,
          price: row.vnd,
          priceCurrency: 'VND',
          description: fits[row.model as keyof typeof fits],
          url: pageUrl,
        })),
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
          <li aria-hidden="true">/</li>
          <li className="font-medium text-foreground">{copy.h1}</li>
        </ol>
      </nav>

      <p className="mt-8 text-sm font-medium text-slate-600">{copy.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{copy.h1}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{copy.lead}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={ctaHref} className="inline-flex h-11 items-center rounded-md bg-slate-800 px-5 text-sm font-semibold text-white">
          {copy.cta}
        </Link>
        <a href="#bang-gia" className="inline-flex h-11 items-center rounded-md border border-slate-300 px-5 text-sm font-semibold">
          {copy.ctaSecondary}
        </a>
      </div>

      <section className="mt-12" aria-labelledby="mau-catalog">
        <h2 id="mau-catalog" className="text-2xl font-bold">{copy.sampleTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.sampleLead}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <figcaption className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{copy.sampleOriginal}</figcaption>
            <img
              src="/dich-anh-tai-lieu/xe-tron-be-tong-goc.png"
              alt={copy.sampleOriginalAlt}
              width={690}
              height={1024}
              className="h-auto w-full"
            />
          </figure>
          <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <figcaption className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{copy.sampleTranslated}</figcaption>
            <img
              src="/dich-anh-tai-lieu/xe-tron-be-tong-tieng-viet.webp"
              alt={copy.sampleTranslatedAlt}
              width={1024}
              height={1536}
              className="h-auto w-full"
            />
          </figure>
        </div>
        <div className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-2">
          <p>{copy.sampleKept}</p>
          <p>{copy.sampleChanged}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <figcaption className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{copy.sampleOriginal}</figcaption>
            <img
              src="/dich-anh-tai-lieu/bom-be-tong-goc.png"
              alt={copy.sample2OriginalAlt}
              width={409}
              height={488}
              className="h-auto w-full"
            />
          </figure>
          <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <figcaption className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{copy.sampleTranslated}</figcaption>
            <img
              src="/dich-anh-tai-lieu/bom-be-tong-tieng-viet.webp"
              alt={copy.sample2TranslatedAlt}
              width={1148}
              height={1370}
              className="h-auto w-full"
            />
          </figure>
        </div>
        <div className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-2">
          <p>{copy.sample2Kept}</p>
          <p>{copy.sample2Changed}</p>
        </div>
        {startButton}
      </section>

      <section className="mt-12" aria-labelledby="thong-tin-dich-vu">
        <h2 id="thong-tin-dich-vu" className="text-2xl font-bold">{copy.factsTitle}</h2>
        <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {copy.facts.map((fact) => (
            <div key={fact.term} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-sm font-semibold">{fact.term}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">{fact.detail}</dd>
            </div>
          ))}
        </dl>
        {startButton}
      </section>

      <section className="mt-12" id="bang-gia" aria-labelledby="bang-gia-title">
        <h2 id="bang-gia-title" className="text-2xl font-bold">{copy.modelsTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.modelsLead}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {modelRows.map((row) => (
            <li key={row.model} className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-semibold">{row.model}</p>
              <p className="mt-1 text-lg font-bold">{row.credit} credit · {row.price}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{fits[row.model as keyof typeof fits]}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{copy.modelsTitle}</caption>
            <thead>
              <tr className="border-b border-slate-300">
                <th scope="col" className="py-2 pr-3 font-semibold">{copy.colModel}</th>
                <th scope="col" className="py-2 pr-3 font-semibold">{copy.colPrice}</th>
                <th scope="col" className="py-2 font-semibold">{copy.colFit}</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((row) => (
                <tr key={row.model} className="border-b border-slate-200 align-top">
                  <th scope="row" className="py-3 pr-3 font-semibold">{row.model}</th>
                  <td className="py-3 pr-3 whitespace-nowrap">{row.credit} credit · {row.price}</td>
                  <td className="py-3 leading-6 text-muted-foreground">{fits[row.model as keyof typeof fits]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {startButton}
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

      <section className="mt-12" aria-labelledby="ngon-ngu">
        <h2 id="ngon-ngu" className="text-2xl font-bold">{copy.langTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.langLead}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {DOCUMENT_TRANSLATE_LANGUAGES.map((lang) => (
            <li key={lang.code} className="rounded-full border border-slate-200 px-3 py-1 text-sm">
              {lang.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cau-hoi">
        <h2 id="cau-hoi" className="text-2xl font-bold">{copy.faqTitle}</h2>
        <div className="mt-4 space-y-3">
          {copy.faqs.map((item) => (
            <details key={item.question} className="rounded-lg border border-slate-200 p-4" open>
              <summary className="cursor-pointer text-sm font-semibold">{item.question}</summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
        {startButton}
      </section>

      <TranslateReviewRail
        reviews={reviews}
        signedIn={signedIn}
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
        <h2 className="text-2xl font-bold">{copy.closeTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">{copy.closeLead}</p>
        <Link href={ctaHref} className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-semibold text-slate-900">
          {copy.cta}
        </Link>
      </section>
    </article>
  )
}
