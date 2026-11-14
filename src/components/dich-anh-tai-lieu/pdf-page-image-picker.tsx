'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPdfThumbBatch } from '@/app/dich-anh-tai-lieu/actions'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

const THUMB_BATCH = 8

function tr(uiLocale: UiLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (uiLocale === 'en') return en
  if (uiLocale === 'zh') return zh
  if (uiLocale === 'ja') return ja
  if (uiLocale === 'ko') return ko
  return vi
}

function seedThumbs(initialThumbs: string[]): Record<number, string> {
  const next: Record<number, string> = {}
  initialThumbs.forEach((src, index) => {
    if (src) next[index + 1] = src
  })
  return next
}

function useSharedPdfThumbs(initialThumbs: string[], file: File, fileHash: string, locale: UiLocale, onHash: (hash: string) => void) {
  const [thumbs, setThumbs] = useState<Record<number, string>>(() => seedThumbs(initialThumbs))
  const [thumbError, setThumbError] = useState<string | null>(null)
  const thumbsRef = useRef(thumbs)
  const hashRef = useRef(fileHash)
  const fileRef = useRef(file)
  const pendingRef = useRef(new Set<number>())
  const inflightRef = useRef(false)
  const queueRef = useRef<number[]>([])
  fileRef.current = file
  thumbsRef.current = thumbs

  useEffect(() => {
    if (fileHash) hashRef.current = fileHash
  }, [fileHash])

  const flush = useCallback(async () => {
    if (inflightRef.current) return
    const need = queueRef.current.filter((page) => !thumbsRef.current[page] && !pendingRef.current.has(page)).slice(0, THUMB_BATCH)
    const needSet = new Set(need)
    queueRef.current = queueRef.current.filter((page) => !needSet.has(page))
    if (need.length === 0) return
    inflightRef.current = true
    need.forEach((page) => pendingRef.current.add(page))
    try {
      const send = async (includeFile: boolean) => {
        const fd = new FormData()
        fd.append('pages', need.join(','))
        if (!includeFile && hashRef.current) fd.append('hash', hashRef.current)
        else if (fileRef.current) fd.append('pdfFile', fileRef.current)
        return getPdfThumbBatch(fd)
      }
      let res = await send(false)
      if ('code' in res && res.code === 'missing' && fileRef.current) res = await send(true)
      if ('error' in res) {
        setThumbError(
          res.code === 'missing'
            ? tr(locale, 'Hết phiên xem ảnh. Chọn lại file PDF.', 'The preview session ended. Choose the PDF again.', '预览已结束。请重新选择 PDF。', 'プレビューの期限が切れました。PDFを選び直してください。', '미리보기가 끝났습니다. PDF를 다시 선택하세요.')
            : res.error
        )
        return
      }
      if (res.hash) {
        hashRef.current = res.hash
        onHash(res.hash)
      }
      setThumbs((prev) => {
        const next = { ...prev }
        for (const item of res.thumbs) next[item.page] = item.src
        return next
      })
      setThumbError(null)
    } catch {
      setThumbError(tr(locale, 'Không tải được ảnh trang.', 'Could not load page images.', '无法加载页面图片。', 'ページ画像を読み込めませんでした。', '페이지 이미지를 불러오지 못했습니다.'))
    } finally {
      need.forEach((page) => pendingRef.current.delete(page))
      inflightRef.current = false
      if (queueRef.current.length > 0) void flush()
    }
  }, [locale, onHash])

  const requestThumb = useCallback((page: number) => {
    if (!page || thumbsRef.current[page] || pendingRef.current.has(page) || queueRef.current.includes(page)) return
    queueRef.current.push(page)
    void flush()
  }, [flush])

  return { thumbs, requestThumb, thumbError }
}

export function PdfPageSelect({
  file,
  fileHash,
  pageCount,
  selectedPages,
  initialThumbs,
  pageKinds,
  locale,
  onConfirm,
  onHash,
  onToggle,
}: {
  file: File
  fileHash: string
  pageCount: number
  selectedPages: number[]
  initialThumbs: string[]
  pageKinds: Array<'text' | 'scan'>
  locale: UiLocale
  onConfirm: (pages: number[]) => void
  onHash: (hash: string) => void
  onToggle: (page: number) => void
}) {
  const { thumbs, requestThumb, thumbError } = useSharedPdfThumbs(initialThumbs, file, fileHash, locale, onHash)
  const pageLabel = tr(locale, 'Trang', 'Page', '页', 'ページ', '페이지')
  const [stripNode, setStripNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!stripNode) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          requestThumb(Number((entry.target as HTMLElement).dataset.page))
        }
      },
      { root: stripNode, rootMargin: '240px' }
    )
    stripNode.querySelectorAll('[data-page]').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [stripNode, selectedPages, thumbs, requestThumb])

  return (
    <>
      {selectedPages.length > 0 && (
        <div ref={setStripNode} className="max-h-80 overflow-auto pr-1">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {selectedPages.map((page) => {
              const src = thumbs[page]
              const kind = pageKinds[page - 1]
              return (
                <button
                  key={page}
                  type="button"
                  data-page={page}
                  aria-pressed
                  aria-label={`${pageLabel} ${page}`}
                  onClick={() => onToggle(page)}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-slate-100 ring-2 ring-slate-700"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh trang PDF vừa tách, data URL
                    <img src={src} alt={`${pageLabel} ${page}`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">{page}</span>
                  )}
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{page}</span>
                  {kind && (
                    <span className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 py-0.5 text-[10px] text-slate-800">
                      {kind === 'text'
                        ? tr(locale, 'Có chữ', 'Text', '有文字', '文字', '글자')
                        : tr(locale, 'Ảnh', 'Image', '图片', '画像', '이미지')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {thumbError && <p className="text-xs text-red-600">{thumbError}</p>}
      <PdfPageImagePicker
        pageCount={pageCount}
        selectedPages={selectedPages}
        thumbs={thumbs}
        requestThumb={requestThumb}
        locale={locale}
        onConfirm={onConfirm}
      />
    </>
  )
}

function PdfPageImagePicker({
  pageCount,
  selectedPages,
  thumbs,
  requestThumb,
  locale,
  onConfirm,
}: {
  pageCount: number
  selectedPages: number[]
  thumbs: Record<number, string>
  requestThumb: (page: number) => void
  locale: UiLocale
  onConfirm: (pages: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null)
  const pageLabel = tr(locale, 'Trang', 'Page', '页', 'ページ', '페이지')

  useEffect(() => {
    if (!open || !scrollNode) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          requestThumb(Number((entry.target as HTMLElement).dataset.page))
        }
      },
      { root: scrollNode, rootMargin: '400px' }
    )
    scrollNode.querySelectorAll('[data-page]').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [open, scrollNode, pageCount, thumbs, requestThumb])

  const draftSet = new Set(draft)
  const toggle = (page: number) => {
    setDraft((prev) => (prev.includes(page) ? prev.filter((item) => item !== page) : [...prev, page].sort((a, b) => a - b)))
    setError(null)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          setDraft(selectedPages)
          setError(null)
          setOpen(true)
        }}
      >
        {tr(locale, 'Chọn trang bằng ảnh', 'Choose pages by image', '按图片选择页面', '画像でページを選ぶ', '이미지로 페이지 선택')} ({selectedPages.length}/{pageCount})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-10 text-left">
            <DialogTitle>{tr(locale, 'Chọn trang', 'Choose pages', '选择页面', 'ページを選ぶ', '페이지 선택')}</DialogTitle>
            <DialogDescription>
              {tr(
                locale,
                'Lăn để xem ảnh từng trang. Bấm ảnh để chọn hoặc bỏ, rồi bấm Xác nhận. Các trang không cần liền nhau.',
                'Scroll to see each page. Click an image to keep or skip it, then confirm. The pages do not have to be consecutive.',
                '滚动查看每一页。点击图片保留或跳过，然后确认。页面不必连续。',
                'スクロールして各ページを見ます。画像を押して残すか外し、確認を押します。連続していなくて構いません。',
                '스크롤해서 각 페이지를 봅니다. 이미지를 눌러 남기거나 빼고 확인을 누릅니다. 페이지가 이어질 필요는 없습니다.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div ref={setScrollNode} className="min-h-0 flex-1 overflow-auto pr-1">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {Array.from({ length: pageCount }, (_, index) => {
                const page = index + 1
                const selected = draftSet.has(page)
                const src = thumbs[page]
                return (
                  <button
                    key={page}
                    type="button"
                    data-page={page}
                    aria-pressed={selected}
                    aria-label={`${pageLabel} ${page}`}
                    onClick={() => toggle(page)}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border bg-slate-100 ${selected ? 'ring-2 ring-slate-700' : 'opacity-60'}`}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ảnh trang PDF vừa tách, data URL
                      <img src={src} alt={`${pageLabel} ${page}`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">{page}</span>
                    )}
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{page}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {error && <p className="shrink-0 text-xs text-red-600">{error}</p>}
          <DialogFooter className="shrink-0 gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(Array.from({ length: pageCount }, (_, index) => index + 1))
                  setError(null)
                }}
              >
                {tr(locale, 'Chọn tất cả', 'Select all', '全选', 'すべて選択', '모두 선택')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft([])
                  setError(tr(locale, 'Chọn ít nhất một trang.', 'Select at least one page.', '至少选择一页。', '1ページ以上選んでください。', '페이지를 하나 이상 선택하세요.'))
                }}
              >
                {tr(locale, 'Bỏ chọn', 'Clear', '取消选择', '選択解除', '선택 해제')}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (draft.length === 0) {
                  setError(tr(locale, 'Chọn ít nhất một trang.', 'Select at least one page.', '至少选择一页。', '1ページ以上選んでください。', '페이지를 하나 이상 선택하세요.'))
                  return
                }
                onConfirm(draft)
                setOpen(false)
              }}
            >
              {tr(locale, 'Xác nhận', 'Confirm', '确认', '確認', '확인')} ({draft.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
