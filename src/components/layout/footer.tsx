import { getServerDictionary } from '@/lib/i18n/server'

export function Footer() {
  const { t } = getServerDictionary()

  return (
    <footer className="mt-10 border-t border-border/70 bg-background/75">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-3 py-6 sm:grid-cols-3 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:px-10 xl:py-10">
        <section>
          <h2 className="text-sm font-semibold">{t.footer.platformTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.footer.platformDescription}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold">{t.footer.policyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.footer.policyNotice}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t.footer.adDisclosure}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold">{t.footer.contactTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.footer.contactEmailLabel}:{' '}
            <a href={`mailto:${t.footer.contactEmailValue}`} className="underline underline-offset-2 hover:text-foreground">
              {t.footer.contactEmailValue}
            </a>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.footer.supportHours}</p>
        </section>
      </div>

      <div className="border-t border-border/60 px-3 py-3 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
        {t.footer.rights}
      </div>
    </footer>
  )
}
