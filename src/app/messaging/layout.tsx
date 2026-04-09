import type { ReactNode } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getServerDictionary } from '@/lib/i18n/server'
import { CREATION_SIDEBAR_POPULAR_LINKS } from '@/lib/creation-tool-sidebar-config'
import { getUserOrBypass } from '@/lib/auth'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'

export default async function MessagingLayout({ children }: { children: ReactNode }) {
  const headerStore = headers()
  const pathWithQuery = headerStore.get('x-nanoai-login-next') || ''
  const [pathname = ''] = pathWithQuery.split('?')
  /** Khớp root layout: mọi /messaging/p/* = shell chat toàn màn, không sidebar «Tin nhắn». */
  const isEmbeddedGuestChat = pathname.startsWith('/messaging/p/')

  if (isEmbeddedGuestChat) {
    return <div className="h-[100dvh] overflow-hidden bg-background">{children}</div>
  }
  const { t } = getServerDictionary()
  const currentSlug = pathname.startsWith('/messaging/p/') ? decodeURIComponent(pathname.replace('/messaging/p/', '')) : ''

  const user = await getUserOrBypass()
  let chatItems: Array<{ conversationId: string; shopName: string; slug: string; lastMessageAt: string | null }> = []
  if (user?.id) {
    const { items } = await listWidgetChatsForLinkedUser(user.id)
    chatItems = items
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-violet-50/80 via-background to-background dark:from-violet-950/25 dark:via-background">
      <main className="flex flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-[1420px] flex-1 gap-4 xl:grid-cols-[230px_270px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-2 rounded-2xl border border-border/60 bg-background/85 p-3 shadow-sm backdrop-blur-sm">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.creationSidebar.popularTitle}
              </p>
              {CREATION_SIDEBAR_POPULAR_LINKS.slice(0, 8).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-sm font-medium transition-colors hover:border-violet-300 hover:bg-violet-50/60 dark:hover:bg-violet-900/20"
                >
                  {t.tool[item.labelKey]}
                </Link>
              ))}
            </div>
          </aside>

          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-2 rounded-2xl border border-border/60 bg-background/85 p-3 shadow-sm backdrop-blur-sm">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.messagingMyChats.pageTitle}
              </p>
              {chatItems.length === 0 ? (
                <p className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
                  {t.messagingMyChats.emptyList}
                </p>
              ) : (
                chatItems.map((item) => {
                  const active = item.slug === currentSlug
                  return (
                    <Link
                      key={item.conversationId}
                      href={`/messaging/p/${encodeURIComponent(item.slug)}`}
                      className={`block rounded-lg border px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'border-violet-400/80 bg-violet-100/70 font-semibold text-violet-900 dark:bg-violet-900/30 dark:text-violet-100'
                          : 'border-border/60 bg-card/70 font-medium hover:border-violet-300 hover:bg-violet-50/60 dark:hover:bg-violet-900/20'
                      }`}
                    >
                      <div className="truncate">{item.shopName}</div>
                      {item.lastMessageAt ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(item.lastMessageAt).toLocaleString()}
                        </div>
                      ) : null}
                    </Link>
                  )
                })
              )}
            </div>
          </aside>
          <div className="w-full min-w-0 max-w-[780px] xl:justify-self-end">{children}</div>
        </div>
      </main>
    </div>
  )
}
