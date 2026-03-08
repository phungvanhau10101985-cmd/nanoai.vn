'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseCurriculumToSlides } from '../lib/curriculum-to-slides'
import { latexToReadable } from '../lib/latex-to-readable'

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
]

function markdownToHtml(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = html.split(/\n/)
  const out: string[] = []
  let inList = false
  for (const line of lines) {
    const bullet = line.match(/^[\-\*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        out.push('<ul class="list-disc pl-8 space-y-2 my-4">')
        inList = true
      }
      out.push(`<li>${bullet[1]}</li>`)
    } else {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (line.trim()) {
        out.push(`<p class="my-2">${line}</p>`)
      }
    }
  }
  if (inList) out.push('</ul>')
  return out.join('') || '<p></p>'
}

interface GammaSlideViewerProps {
  curriculumMarkdown: string
  topic: string
  onClose: () => void
}

export function GammaSlideViewer({ curriculumMarkdown, topic, onClose }: GammaSlideViewerProps) {
  const [slides, setSlides] = useState<Array<{ title: string; content: string }>>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const readable = latexToReadable(curriculumMarkdown)
    const parsed = parseCurriculumToSlides(readable)
    const withTitle = topic
      ? [{ title: topic, content: '' }, ...parsed]
      : parsed
    setSlides(withTitle)
    setCurrentIndex(0)
  }, [curriculumMarkdown, topic])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1))
  }, [slides.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      }
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goNext, goPrev])

  const handlePrint = () => {
    window.print()
  }

  if (slides.length === 0) return null

  const slide = slides[currentIndex]
  const gradient = GRADIENTS[currentIndex % GRADIENTS.length]

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header - ẩn khi in */}
      <div className="flex items-center justify-between px-6 py-4 text-white/90 print:hidden">
        <span className="text-sm font-medium">
          {currentIndex + 1} / {slides.length}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrev} disabled={currentIndex === 0} className="text-white hover:bg-white/20">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goNext} disabled={currentIndex === slides.length - 1} className="text-white hover:bg-white/20">
            <ChevronRight className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePrint} className="text-white hover:bg-white/20">
            <Printer className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Slide - ẩn khi in (dùng bản in tất cả slide bên dưới) */}
      <div
        className="flex-1 flex items-center justify-center p-12 md:p-20 print:hidden"
        style={{ background: gradient }}
      >
        <div className="w-full max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-8">
            {slide.title}
          </h1>
          {slide.content && (
            <div
              className="text-xl md:text-2xl text-white/95 leading-relaxed [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:space-y-2 [&_p]:my-2"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(slide.content),
              }}
            />
          )}
        </div>
      </div>

      {/* Bản in: tất cả slide (chỉ hiện khi Print) */}
      <div className="hidden print:block">
        {slides.map((s, i) => (
          <div
            key={i}
            className="min-h-[100vh] flex flex-col justify-center p-16"
            style={{
              background: GRADIENTS[i % GRADIENTS.length],
              pageBreakAfter: i < slides.length - 1 ? 'always' : 'auto',
            }}
          >
            <h1 className="text-5xl font-bold text-white mb-8">{s.title}</h1>
            {s.content && (
              <div
                className="text-2xl text-white/95 leading-relaxed [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:space-y-2"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(s.content) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
