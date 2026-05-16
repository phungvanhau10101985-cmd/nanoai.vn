import type { DataDeletionDoc, LegalPageDoc } from '@/lib/i18n/dictionary-legal-pages'

export function LegalPageDocument({ doc }: { doc: LegalPageDoc }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">{doc.lastUpdated}</p>
      {doc.sections.map((section, si) => (
        <section key={si} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
          {section.paragraphs.map((p, pi) => (
            <p key={pi} className="leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  )
}

export function DataDeletionDocument({ doc }: { doc: DataDeletionDoc }) {
  return (
    <>
      <p className="leading-relaxed text-muted-foreground">{doc.intro}</p>
      <h2 className="mt-8 text-xl font-semibold tracking-tight">{doc.stepsTitle}</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-muted-foreground">
        {doc.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="mt-8 leading-relaxed text-muted-foreground">{doc.outro}</p>
    </>
  )
}
