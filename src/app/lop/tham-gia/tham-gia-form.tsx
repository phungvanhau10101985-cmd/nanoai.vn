'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { joinClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function ThamGiaForm({ t }: { t: Dictionary['classes'] }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    const res = await joinClass(code.trim())
    setLoading(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    if (res.success && res.classId) {
      toast({ description: t.join })
      router.push(`/lop/${res.classId}`)
    }
  }

  return (
    <>
      <Toaster />
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{t.joinClassRoleHint}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
            {t.enterCode}
          </label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: ABC123"
            maxLength={12}
            required
            disabled={loading}
            className="w-full font-mono tracking-wider"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '...' : t.join}
        </Button>
      </form>
    </>
  )
}
