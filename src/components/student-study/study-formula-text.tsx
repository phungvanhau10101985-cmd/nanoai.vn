'use client'

import katex from 'katex'
import 'katex/contrib/mhchem'
import { segmentStudyFormula, type StudyFormulaPart } from '@/lib/homework-help/homework-formula-text'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderPart(part: StudyFormulaPart): string {
  if (part.kind === 'text') return escapeHtml(part.text)
  const tex = part.kind === 'chem' ? `\\ce{${part.tex}}` : part.tex
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore',
      output: 'html',
    })
  } catch {
    return escapeHtml(part.kind === 'chem' ? part.tex : part.tex)
  }
}

/** Chữ bài tập, công thức hóa và biểu thức toán theo kiểu sách giáo khoa. */
export function StudyFormulaText({ text, className = '' }: { text: string; className?: string }) {
  const html = segmentStudyFormula(text).map(renderPart).join('')
  return (
    <span
      className={`study-formula inline whitespace-pre-wrap align-middle [&_.katex]:text-[1.06em] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
