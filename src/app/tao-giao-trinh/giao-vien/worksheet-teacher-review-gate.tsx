'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { confirmWorksheetQuestionReview, listWorksheetTeacherReview, saveWorksheetContent } from '@/app/tao-giao-trinh/actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { blockToContentJson } from '@/app/tao-giao-trinh/lib/markdown-to-questions'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown } from '@/app/tao-giao-trinh/lib/worksheet-parse-questions'
import { WORKSHEET_REVIEW_AGREES } from '@/app/tao-giao-trinh/lib/worksheet-review-count'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

type ReviewItem = {
  questionId: string
  index: number
  type: string
  usingBlock: string
  otherBlock: string | null
  otherIsOriginal: boolean
  agreeCount: number
  rejectCount: number
  editCount: number
  authorIsMe: boolean
  myVote: 'agree' | 'reject' | null
  pending: boolean
}

function showText(markdown: string) {
  return latexToReadable(markdown).replace(/^#{1,6}\s+/gm, '').trim()
}

export function WorksheetTeacherReviewGate({
  worksheetId,
  markdown,
  tr,
  onReloadSlides,
}: {
  worksheetId: string
  markdown: string
  tr: Tr
  onReloadSlides: () => Promise<void>
}) {
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [open, setOpen] = useState(false)
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const scrollToId = useRef<string | null>(null)

  const scrollNextIntoView = useCallback((questionId: string | null) => {
    if (!questionId) return
    const list = listRef.current
    const node = list?.querySelector(`[data-review-id="${questionId}"]`)
    if (!list || !(node instanceof HTMLElement)) return
    const top = list.scrollTop + node.getBoundingClientRect().top - list.getBoundingClientRect().top - 8
    list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [])

  const load = useCallback(async () => {
    const result = await listWorksheetTeacherReview(worksheetId)
    if (!result || 'error' in result) {
      setError(result && 'error' in result && result.error ? result.error : tr('Không tải được danh sách duyệt.', 'Could not load the review list.', '无法加载核对列表。', '確認一覧を読み込めません。', '검토 목록을 불러오지 못했습니다.'))
      setOpen(true)
      return
    }
    const next = (result.items ?? []) as ReviewItem[]
    setItems(next)
    if (next.length === 0) {
      setOpen(false)
      return
    }
    setHandled((prev) => {
      const still = new Set([...prev].filter((id) => next.some((item) => item.questionId === id)))
      return still
    })
    setOpen(true)
  }, [tr, worksheetId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const questionId = scrollToId.current
    if (!questionId || !items?.some((item) => item.questionId === questionId)) return
    scrollToId.current = null
    const frame = window.requestAnimationFrame(() => scrollNextIntoView(questionId))
    return () => window.cancelAnimationFrame(frame)
  }, [items, scrollNextIntoView])

  const mark = (questionId: string) => {
    setHandled((prev) => new Set(prev).add(questionId))
    setEditingId((current) => (current === questionId ? null : current))
  }

  const confirm = async (item: ReviewItem, choice: 'agree' | 'reject') => {
    setBusyId(item.questionId)
    setError('')
    try {
      const result = await confirmWorksheetQuestionReview(item.questionId, choice)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      mark(item.questionId)
      const index = items?.findIndex((row) => row.questionId === item.questionId) ?? -1
      const nextId = index >= 0 ? items?.[index + 1]?.questionId ?? null : null
      scrollToId.current = nextId
      scrollNextIntoView(nextId)
      await onReloadSlides()
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async (item: ReviewItem) => {
    const next = draft.trim()
    if (next.length < 3) {
      setError(tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'))
      return
    }
    const blocks = parseWorksheetIntoBlocks(markdown)
    const block = blocks[item.index]
    if (!block || !blockToContentJson({ ...block, content: next })) {
      setError(tr(
        'Chưa đọc được câu vừa sửa. Giữ đầu câu và phần lời giải.',
        'Could not read the edited question. Keep the question heading and the solution.',
        '无法读取修改后的题目。请保留题头和解答。',
        '修正した問題を読めません。見出しと解説を残してください。',
        '수정한 문항을 읽지 못했습니다. 문항 머리와 풀이를 남겨 주세요.'
      ))
      return
    }
    setBusyId(item.questionId)
    setError('')
    try {
      const fd = new FormData()
      fd.append('worksheetId', worksheetId)
      fd.append('contentMarkdown', replaceBlockInMarkdown(markdown, block, next))
      const saved = await saveWorksheetContent(fd)
      if (saved?.error) {
        setError(saved.error)
        return
      }
      await onReloadSlides()
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null
  if (!items?.length) {
    if (!error) return null
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-4">
        <div className="max-w-md rounded-xl border border-slate-600 bg-slate-900 p-4 text-slate-100">
          <p className="text-sm text-rose-300">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
          </button>
        </div>
      </div>
    )
  }
  const doneCount = items.filter((item) => handled.has(item.questionId)).length
  const ready = doneCount === items.length

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-3 md:p-4">
      <div className="flex h-[min(92vh,920px)] w-full max-w-3xl flex-col rounded-xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="shrink-0 border-b border-slate-700 px-4 py-3">
          <p className="text-sm font-semibold text-amber-300">
            {tr('Duyệt bài tập trước khi mở slide', 'Review the worksheet before opening slides', '打开幻灯片前先核对练习', 'スライドを開く前に問題を確認', '슬라이드를 열기 전에 문제를 확인')}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {tr(
              'Lần đầu phải xác nhận từng câu. Không bỏ qua. Câu mới tạo sau này cũng phải xác nhận. 7 lần đúng liên tiếp thì thay bản gốc bằng bản sửa. 7 lần sai liên tiếp thì giữ bản gốc và bỏ bản sửa.',
              'The first time, confirm every question. Skipping is not allowed. New questions must be confirmed too. 7 correct votes in a row replace the original with the edit. 7 wrong votes in a row keep the original and drop the edit.',
              '第一次必须逐题确认，不能跳过。以后新建的题目也要确认。连续 7 次判对则用修改版替换原版。连续 7 次判错则保留原版并丢掉修改。',
              '最初は全問を確認します。スキップはできません。後から追加された問題も確認が必要です。正しい票が7回続くと修正版が原本になります。誤りの票が7回続くと原本を残し修正版を捨てます。',
              '처음에는 문항마다 확인해야 합니다. 건너뛸 수 없습니다. 새로 만든 문항도 확인해야 합니다. 맞음이 7번 연속이면 수정본이 원본이 됩니다. 틀림이 7번 연속이면 원본을 유지하고 수정본을 버립니다.'
            )}
          </p>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {items.map((item, index) => {
            const seen = handled.has(item.questionId)
            const editing = editingId === item.questionId
            const busy = busyId === item.questionId
            const kind = item.type === 'quiz'
              ? tr('Trắc nghiệm', 'Quiz', '选择题', 'クイズ', '퀴즈')
              : tr('Tự luận', 'Essay', '主观题', '記述式', '서술형')
            return (
              <article key={item.questionId} data-review-id={item.questionId} className="rounded-lg border border-slate-700 bg-slate-950/70">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-3 py-2">
                  <p className="text-sm font-medium text-amber-200">{index + 1}/{items.length}. {kind}</p>
                  {seen ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-300">
                      <Check className="h-4 w-4" aria-hidden />
                      {tr('Đã xác nhận', 'Confirmed', '已确认', '確認済', '확인함')}
                    </span>
                  ) : null}
                </div>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-40 w-full border-0 bg-transparent p-3 text-sm leading-relaxed text-slate-100 outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="space-y-3 px-3 py-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {item.pending && item.otherIsOriginal
                          ? tr('Đang dùng bản sửa', 'Using the edit', '正在使用修改版', '修正版を使用中', '수정본 사용 중')
                          : tr('Đang dùng bản gốc', 'Using the original', '正在使用原版', '元の版を使用中', '원본 사용 중')}
                      </p>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{showText(item.usingBlock)}</pre>
                    </div>
                    {item.otherBlock ? (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {item.otherIsOriginal
                            ? tr('Bản gốc để đối chiếu', 'Original, for comparison', '原版，供对照', '照合用の元の版', '비교용 원본')
                            : tr('Bản sửa để đối chiếu', 'Edit, for comparison', '修改版，供对照', '照合用の修正版', '비교용 수정본')}
                        </p>
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{showText(item.otherBlock)}</pre>
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {tr(
                      `${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} đúng liên tiếp · ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} sai liên tiếp`,
                      `${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} correct in a row · ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} wrong in a row`,
                      `连续判对 ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 连续判错 ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES}`,
                      `連続で正しい ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 連続で誤り ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES}`,
                      `연속 맞음 ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 연속 틀림 ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES}`
                    )}
                    {' · '}
                    {tr(
                      `Sửa ${item.editCount} lần`,
                      `Edited ${item.editCount} times`,
                      `修改 ${item.editCount} 次`,
                      `修正 ${item.editCount} 回`,
                      `수정 ${item.editCount}회`
                    )}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    {editing ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(item)}
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {tr('Lưu', 'Save', '保存', '保存', '저장')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void confirm(item, 'agree')}
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {tr('Xác nhận đúng', 'Confirm correct', '确认正确', '正しいと確認', '맞다고 확인')}
                        </button>
                        {item.pending && !item.authorIsMe ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void confirm(item, 'reject')}
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {tr('Không đồng ý', 'Disagree', '不同意', '同意しない', '동의하지 않음')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDraft(item.usingBlock)
                            setEditingId(item.questionId)
                          }}
                          className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800"
                        >
                          {tr('Sửa', 'Edit', '修改', '修正', '수정')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400">
            {ready
              ? tr('Đã duyệt hết câu.', 'Every question is checked.', '题目已全部核对。', 'すべての問題を確認しました。', '모든 문항을 확인했습니다.')
              : tr(
                  `Còn ${items.length - doneCount} câu chưa xác nhận.`,
                  `${items.length - doneCount} questions are not confirmed yet.`,
                  `还有 ${items.length - doneCount} 题未确认。`,
                  `未確認が ${items.length - doneCount} 問あります。`,
                  `아직 확인하지 않은 문항 ${items.length - doneCount}개.`
                )}
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={() => setOpen(false)}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr('Mở slide', 'Open slides', '打开幻灯片', 'スライドを開く', '슬라이드 열기')}
          </button>
        </div>
      </div>
    </div>
  )
}
