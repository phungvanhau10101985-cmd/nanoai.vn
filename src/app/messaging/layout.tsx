import type { ReactNode } from 'react'

export default function MessagingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-violet-50/80 via-background to-background dark:from-violet-950/25 dark:via-background">
      <main className="flex flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-1 justify-end">
          <div className="w-full max-w-2xl">{children}</div>
        </div>
      </main>
    </div>
  )
}
