'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import {
  confirmWorksheetQuestionReview,
  getWorksheetQuestionReviewItem,
  saveWorksheetQuestionPersonalEdit,
} from '@/app/tao-giao-trinh/actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { WORKSHEET_REVIEW_AGREES } from '@/app/tao-giao-trinh/lib/worksheet-review-count'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

export type ExamReviewItem = {
  questionId: string
  type: string
  usingBlock: string
  otherBlock: string | null
  otherIsOriginal: boolean
  agreeCount: number
  rejectCount: number
  editCount: number
  authorIsMe: boolean
  pending: boolean
}

function showText(markdown: string) {
  return latexToReadable(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\[([^\]]+)\]\*\*/g, '[$1]')
    .replace(/\*\*/g, '')
    .trim()
}

function reviewTr(locale: string): Tr {
  return (vi, en, zh, ja, ko) => {
    if (locale === 'en') return en
    if (locale === 'zh') return zh
    if (locale === 'ja') return ja
    if (locale === 'ko') return ko
    return vi
  }
}

export function ExamCreateReviewGate({
  items,
  locale,
  createLabel,
  creatingLabel,
  creating,
  onCancel,
  onCreate,
}: {
  items: ExamReviewItem[]
  locale: string
  createLabel: string
  creatingLabel: string
  creating: boolean
  onCancel: () => void
  onCreate: () => void
}) {
  const tr = reviewTr(locale)
  const [rows, setRows] = useState(items)
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const doneCount = rows.filter((item) => handled.has(item.questionId)).length
  const ready = rows.length > 0 && doneCount === rows.length

  const confirm = async (item: ExamReviewItem, choice: 'agree' | 'reject') => {
    setBusyId(item.questionId)
    setError('')
    try {
      const result = await confirmWorksheetQuestionReview(item.questionId, choice)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      setHandled((prev) => new Set(prev).add(item.questionId))
      setEditingId((current) => (current === item.questionId ? null : current))
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async (item: ExamReviewItem) => {
    const next = draft.trim()
    if (next.length < 3) {
      setError(tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'))
      return
    }
    setBusyId(item.questionId)
    setError('')
    try {
      const saved = await saveWorksheetQuestionPersonalEdit(item.questionId, next)
      if (saved && 'error' in saved && saved.error) {
        setError(saved.error)
        return
      }
      const fresh = await getWorksheetQuestionReviewItem(item.questionId)
      if (fresh && !('error' in fresh)) {
        setRows((prev) => prev.map((row) => (row.questionId === item.questionId ? { ...row, ...fresh } : row)))
      }
      setEditingId(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-3 md:p-4">
      <div className="flex h-[min(92vh,920px)] w-full max-w-5xl flex-col rounded-xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {tr('Duyệt bài trước khi tạo bài thi', 'Review questions before creating the exam', '创建考试前先核对题目', '試験を作成する前に問題を確認', '시험을 만들기 전에 문항을 확인')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {tr(
                'Câu giáo viên này chưa duyệt phải xác nhận từng câu. Câu đã duyệt rồi thì bỏ qua. 7 lần đúng liên tiếp thì thay bản gốc bằng bản sửa. 7 lần sai liên tiếp thì giữ bản gốc và bỏ bản sửa.',
                'Confirm each question this teacher has not reviewed. Questions already reviewed are skipped. 7 correct votes in a row replace the original with the edit. 7 wrong votes in a row keep the original and drop the edit.',
                '这位老师尚未核对的题目必须逐题确认。已经核对过的题目会跳过。连续 7 次判对则用修改版替换原版。连续 7 次判错则保留原版并丢掉修改。',
                'この教師が未確認の問題は1問ずつ確認します。確認済みの問題は省きます。正しい票が7回続くと修正版が原本になります。誤りの票が7回続くと原本を残し修正版を捨てます。',
                '이 교사가 아직 확인하지 않은 문항은 하나씩 확인해야 합니다. 이미 확인한 문항은 건너뜁니다. 맞음이 7번 연속이면 수정본이 원본이 됩니다. 틀림이 7번 연속이면 원본을 유지하고 수정본을 버립니다.',
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={onCancel}
            className="shrink-0 rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {rows.map((item, index) => {
            const seen = handled.has(item.questionId)
            const editing = editingId === item.questionId
            const busy = busyId === item.questionId || creating
            const kind = item.type === 'quiz'
              ? tr('Trắc nghiệm', 'Quiz', '选择题', 'クイズ', '퀴즈')
              : tr('Tự luận', 'Essay', '主观题', '記述式', '서술형')
            return (
              <article key={item.questionId} className="rounded-lg border border-slate-700 bg-slate-950/70">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-3 py-2">
                  <p className="text-sm font-medium text-amber-200">{index + 1}/{rows.length}. {kind}</p>
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
                    className="min-h-64 w-full border-0 bg-transparent p-3 text-sm leading-relaxed text-slate-100 outline-none"
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
                      `${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} đúng liên tiếp · ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} sai liên tiếp · Sửa ${item.editCount} lần`,
                      `${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} correct in a row · ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} wrong in a row · Edited ${item.editCount} times`,
                      `连续判对 ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 连续判错 ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} · 修改 ${item.editCount} 次`,
                      `連続で正しい ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 連続で誤り ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} · 修正 ${item.editCount} 回`,
                      `연속 맞음 ${item.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 연속 틀림 ${item.rejectCount}/${WORKSHEET_REVIEW_AGREES} · 수정 ${item.editCount}회`,
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
                          disabled={busy || seen}
                          onClick={() => void confirm(item, 'agree')}
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {tr('Xác nhận đúng', 'Confirm correct', '确认正确', '正しいと確認', '맞다고 확인')}
                        </button>
                        {item.pending && !item.authorIsMe ? (
                          <button
                            type="button"
                            disabled={busy || seen}
                            onClick={() => void confirm(item, 'reject')}
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {tr('Không đồng ý', 'Disagree', '不同意', '同意しない', '동의하지 않음')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy || seen}
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
              ? tr('Đã duyệt hết câu chưa duyệt.', 'Every unchecked question is confirmed.', '未核对的题目已全部确认。', '未確認の問題をすべて確認しました。', '미확인 문항을 모두 확인했습니다.')
              : tr(
                  `Còn ${rows.length - doneCount} câu chưa xác nhận.`,
                  `${rows.length - doneCount} questions are not confirmed yet.`,
                  `还有 ${rows.length - doneCount} 题未确认。`,
                  `未確認が ${rows.length - doneCount} 問あります。`,
                  `아직 확인하지 않은 문항 ${rows.length - doneCount}개.`,
                )}
          </p>
          <button
            type="button"
            disabled={!ready || creating}
            onClick={onCreate}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? creatingLabel : createLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
