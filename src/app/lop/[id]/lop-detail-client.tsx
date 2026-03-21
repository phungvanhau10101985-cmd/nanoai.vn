'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Copy } from 'lucide-react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Member = { userId: string; name: string }
type Worksheet = { id: string; topic: string }
type Submission = { id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }

export default function LopDetailClient({
  cls,
  isTeacher,
  members,
  worksheets,
  initialSubmissions,
  t,
}: {
  cls: { id: string; name: string; join_code: string }
  isTeacher: boolean
  members: Member[]
  worksheets: Worksheet[]
  initialSubmissions: Submission[]
  t: Dictionary['classes']
}) {
  const [copied, setCopied] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const { toast } = useToast()

  useEffect(() => {
    if (!isTeacher) return
    const poll = () => {
      fetch(`/api/lop/${cls.id}/submissions`)
        .then((r) => r.json())
        .then((data) => {
          if (data.items) setSubmissions(data.items)
        })
        .catch(() => {})
    }
    const id = setInterval(poll, 8000)
    return () => clearInterval(id)
  }, [isTeacher, cls.id])

  function copyCode() {
    navigator.clipboard.writeText(cls.join_code)
    setCopied(true)
    toast({ description: t.copied })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Toaster />
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{cls.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.joinCode}:</span>
          <code className="px-2 py-1 rounded bg-muted font-mono text-sm tracking-wider">{cls.join_code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode} className="h-8 w-8">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.students}</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noStudents}</p>
        ) : (
          <ul className="rounded-xl border border-input divide-y divide-input">
            {members.map((m) => (
              <li key={m.userId} className="px-4 py-2 text-sm">
                {m.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.worksheets}</h2>
        {worksheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noWorksheets}</p>
        ) : (
          <ul className="space-y-2">
            {worksheets.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/phieu-bai-tap/${w.id}/lam-bai?classId=${cls.id}`}
                  className="block rounded-lg border border-input bg-card px-4 py-3 hover:bg-accent/50 text-sm font-medium"
                >
                  {w.topic}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isTeacher && (
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/lop/${cls.id}/gan-phieu`}>{t.assignWorksheet}</Link>
          </Button>
        )}
      </section>

      {isTeacher && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.submissions}</h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSubmissions}</p>
          ) : (
            <ul className="rounded-xl border border-input divide-y divide-input">
              {submissions.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{s.studentName}</span>
                    <span className="text-muted-foreground text-sm ml-2">– {s.worksheetTopic}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {s.quizScore}/{s.quizTotal} • {new Date(s.submittedAt).toLocaleString('vi-VN')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
