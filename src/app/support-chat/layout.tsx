import type { ReactNode } from 'react'

export default function SupportChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-violet-50/80 via-background to-background dark:from-violet-950/25 dark:via-background">
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-8 sm:py-12">
        {children}
      </main>
    </div>
  )
}
