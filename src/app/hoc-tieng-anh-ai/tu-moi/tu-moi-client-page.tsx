'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { createClient } from '@/lib/supabase/client'
import { getAllWords, deleteWordById } from '../services/english-coach-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, BookOpen, RefreshCw, ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

function localText(vi: string, en: string) {
  if (typeof window === 'undefined') return vi
  const locale = navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en'
  return locale === 'vi' ? vi : en
}

type WordItem = {
  id: string
  word: string
  targetLanguage?: string
  nativeLanguage?: string
  meaning?: string
  pronunciation?: string
  learnedDate?: string
  usageLevel?: 'high' | 'medium' | 'low'
}

export default function TuMoiClientPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [words, setWords] = useState<WordItem[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const next = sanitizeLoginNext(pathname || '/hoc-tieng-anh-ai/tu-moi')
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }
      setBusy(true)
      setError(null)
      try {
        const { ok, data } = await getAllWords(300)
        if (!ok) throw new Error((data as { error?: string })?.error || 'Failed to load')
        if (!mounted) return
        const items = Array.isArray((data as { items?: unknown[] })?.items)
          ? (data as { items: WordItem[] }).items
          : []
        setWords(items)
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Unknown error')
        setWords([])
      } finally {
        if (mounted) setBusy(false)
      }
    }
    void run()
    return () => { mounted = false }
  }, [router])

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      const { ok, data } = await getAllWords(300)
      if (!ok) throw new Error((data as { error?: string })?.error || 'Failed to load')
      const items = Array.isArray((data as { items?: unknown[] })?.items)
        ? (data as { items: WordItem[] }).items
        : []
      setWords(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  const usageLabel = (level?: string) => {
    if (level === 'high') return localText('Dùng nhiều', 'High use')
    if (level === 'low') return localText('Ít dùng', 'Low use')
    return localText('Dùng trung bình', 'Medium use')
  }

  const handleDelete = async (item: WordItem) => {
    if (deletingId) return
    setDeletingId(item.id)
    try {
      const { ok, data } = await deleteWordById(item.id)
      if (!ok) throw new Error((data as { error?: string })?.error || 'Failed to delete')
      setWords((prev) => prev.filter((w) => w.id !== item.id))
      toast({
        title: localText('Đã xóa từ', 'Word deleted'),
        description: localText(`Đã xóa "${item.word}" khỏi danh sách.`, `"${item.word}" has been removed.`),
      })
    } catch (e) {
      toast({
        title: localText('Không xóa được', 'Delete failed'),
        description: e instanceof Error ? e.message : localText('Lỗi không xác định.', 'Unknown error'),
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="app-shell space-y-6">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/hoc-tieng-anh-ai">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {localText('Danh sách từ mới của tôi', 'My new words list')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {localText('Tất cả từ bạn đã lưu từ các buổi học', 'All words you saved from lessons')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {localText('Làm mới', 'Refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            {localText('Từ mới', 'New words')} ({words.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {busy ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-destructive py-6">{error}</p>
          ) : words.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {localText(
                'Chưa có từ mới. Hãy học bài Live AI hoặc bài có sẵn, bấm vào từ trong câu để lưu.',
                'No words yet. Learn with Live AI or saved lessons, tap words in sentences to save them.'
              )}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {words.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border border-border/70 bg-slate-50/50 p-3 text-sm"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingId === item.id}
                    title={localText('Xóa từ này', 'Delete this word')}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                  <p className="pr-9 font-semibold text-blue-600 dark:text-blue-400">
                    {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
                  </p>
                  <p className="mt-1 text-muted-foreground line-clamp-2">
                    {item.meaning || localText('Chưa có nghĩa', 'No meaning yet')}
                  </p>
                  {item.pronunciation ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {localText('Phát âm:', 'Pronunciation:')} {item.pronunciation}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.usageLevel ? (
                      <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                        {usageLabel(item.usageLevel)}
                      </span>
                    ) : null}
                    {item.learnedDate ? (
                      <span className="text-xs text-slate-500">
                        {item.learnedDate}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
