'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function TaoLopForm({ t }: { t: Dictionary['classes'] }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ classId: string; joinCode: string } | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const formData = new FormData()
    formData.set('name', name.trim())
    const res = await createClass(formData)
    setLoading(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    if (res.success && res.classId && res.joinCode) {
      setResult({ classId: res.classId, joinCode: res.joinCode })
      toast({ description: t.created })
    }
  }

  function copyCode() {
    if (!result?.joinCode) return
    navigator.clipboard.writeText(result.joinCode)
    toast({ description: t.copied })
  }

  if (result) {
    return (
      <>
        <Toaster />
        <div className="rounded-xl border border-input bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t.created}</p>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t.joinCode}</label>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-muted font-mono text-lg tracking-wider">
                {result.joinCode}
              </code>
              <Button variant="outline" size="sm" onClick={copyCode}>
                {t.copyCode}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button asChild>
              <a href={`/lop/${result.classId}`}>{t.backToList}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/lop">{t.myClasses}</a>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
            {t.className}
          </label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Toán 10A1"
            required
            disabled={loading}
            className="w-full"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '...' : t.createClass}
        </Button>
      </form>
    </>
  )
}
