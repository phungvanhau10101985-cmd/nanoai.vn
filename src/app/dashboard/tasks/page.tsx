import Link from 'next/link'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { ListTodo } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { buildTaskHubSnapshot } from './task-hub-snapshot'
import { TaskHubPoll } from './task-hub-poll'

export const metadata: Metadata = buildMetadata({
  title: 'Tasks & queue',
  description: 'Unified task and queue status for AI tools.',
  path: '/dashboard/tasks',
  noIndex: true,
})

export default async function DashboardTasksPage() {
  const { t, locale } = getServerDictionary()
  const th = t.taskHub
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  const initial = await buildTaskHubSnapshot(user.id)

  return (
    <div className="app-shell space-y-6 md:space-y-8">
      <Toaster />
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
              <ListTodo className="h-7 w-7 text-violet-600 shrink-0" />
              {th.pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">{th.pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">{t.menu.dashboard}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/history">{th.linkProcessedImages}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/history/translate">{th.linkTranslateHistory}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dich-anh-tai-lieu/tien-trinh">{th.linkTranslateProgress}</Link>
            </Button>
          </div>
        </div>
      </div>

      <TaskHubPoll locale={locale} initial={initial} />
    </div>
  )
}
