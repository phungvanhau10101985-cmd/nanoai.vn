'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listWorksheetQuestionProposals, voteWorksheetQuestion } from '@/app/tao-giao-trinh/actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { diffTextSpans, type TextSpan } from '@/app/tao-giao-trinh/lib/text-span-diff'
import type { WorksheetQuestionProposal } from '@/lib/db/worksheet-question-review-pg'
import type { WebLocale } from '@/lib/i18n/config'

function readableQuestion(markdown: string): string {
  return latexToReadable(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim()
}

function DiffSpans({ spans, tone }: { spans: TextSpan[]; tone: 'original' | 'edit' }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {spans.map((span, index) =>
        span.changed ? (
          <span
            key={index}
            className={
              tone === 'original'
                ? 'rounded-sm bg-green-400 px-0.5 text-green-950'
                : 'rounded-sm bg-yellow-300 px-0.5 text-yellow-950'
            }
          >
            {span.text}
          </span>
        ) : (
          <span key={index}>{span.text}</span>
        )
      )}
    </p>
  )
}

function line(locale: WebLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

export function useWorksheetQuestionProposals(worksheetId: string, onChanged?: () => void) {
  const [items, setItems] = useState<WorksheetQuestionProposal[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const id = worksheetId.trim()
    if (!id) {
      setItems([])
      return
    }
    const result = await listWorksheetQuestionProposals(id)
    setItems('proposals' in result && Array.isArray(result.proposals) ? result.proposals : [])
  }, [worksheetId])

  useEffect(() => {
    void load()
  }, [load])

  const vote = async (questionId: string, choice: 'agree' | 'reject') => {
    setBusyId(questionId)
    try {
      const result = await voteWorksheetQuestion(questionId, choice)
      await load()
      if (result && 'success' in result && result.success) onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  return { items, vote, busyId }
}

export function WorksheetQuestionCompare({
  item,
  locale,
  busy,
  onVote,
}: {
  item: WorksheetQuestionProposal
  locale: WebLocale
  busy: boolean
  onVote: (choice: 'agree' | 'reject') => void
}) {
  const originalText = readableQuestion(item.originalBlock || item.originalPreview)
  const editedText = readableQuestion(item.editedBlock || item.preview)
  const compared = diffTextSpans(originalText, editedText)
  return (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {item.authorIsMe
              ? line(
                  locale,
                  'Bạn đang dùng bản vừa sửa. Người sau xem được cả bản gốc và bản sửa. 7 người duyệt thì lấy bản sửa làm gốc. 7 người không duyệt thì giữ gốc và bỏ bản sửa. Có người sửa mới thì đếm lại.',
                  'You are using your edit. Later people can read both versions. 7 approvals replace the original. 7 rejections keep the original and drop the edit. A new edit starts the count over.',
                  '你正在使用刚改的版本。后面的人可以同时看原版和修改版。7 人通过则用修改版替换原版。7 人不通过则保留原版并丢掉修改。有人再改就重新计数。',
                  '自分の修正版を使用中です。後の人は元の版と修正版の両方を読めます。7人が承認すると修正版が原本になります。7人が不承認なら原本を残し修正版を捨てます。誰かが直すと数え直します。',
                  '방금 수정한 버전을 사용 중입니다. 다음 사람은 원본과 수정본을 함께 볼 수 있습니다. 7명이 승인하면 수정본이 원본이 됩니다. 7명이 거절하면 원본을 유지하고 수정본을 버립니다. 누군가 다시 수정하면 다시 셉니다.'
                )
              : item.myVote === 'agree'
                ? line(
                    locale,
                    'Bạn đã duyệt. Đang dùng bản sửa. Đủ 7 người duyệt thì bản sửa thành bản gốc. Đủ 7 người không duyệt thì bỏ bản sửa.',
                    'You approved. You are using the edit. After 7 approvals it becomes the original. After 7 rejections the edit is dropped.',
                    '你已通过，正在使用修改版。满 7 人通过后，修改版成为原版。满 7 人不通过则丢掉修改。',
                    '承認済みで、修正版を使用中です。7人が承認すると原本になります。7人が不承認なら修正版は捨てられます。',
                    '승인했습니다. 수정본을 사용 중입니다. 7명이 승인하면 원본이 됩니다. 7명이 거절하면 수정본을 버립니다.'
                  )
                : item.myVote === 'reject'
                  ? line(
                      locale,
                      'Bạn không duyệt. Bạn vẫn dùng bản gốc. Duyệt thì chuyển sang dùng bản sửa.',
                      'You did not approve. You still use the original. Approve to switch to the edit.',
                      '你未通过，仍使用原版。通过后就改用修改版。',
                      '承認していません。元の版のままです。承認すると修正版に切り替わります。',
                      '승인하지 않았습니다. 원본을 그대로 씁니다. 승인하면 수정본으로 바꿉니다.'
                    )
                  : line(
                      locale,
                      'Có bản sửa của người trước. Đọc cả bản gốc và bản sửa. Duyệt thì dùng ngay bản sửa. Không duyệt thì giữ bản gốc.',
                      'Someone edited this. Read both the original and the edit. Approve to use the edit now. Decline to keep the original.',
                      '有人改过。请同时看原版和修改版。通过就立即使用修改版。不通过则保留原版。',
                      '前の人の修正があります。元の版と修正版の両方を読んでください。承認すると修正版をすぐ使います。承認しないと元の版のままです。',
                      '앞사람이 수정했습니다. 원본과 수정본을 함께 읽으세요. 승인하면 수정본을 바로 씁니다. 승인하지 않으면 원본을 유지합니다.'
                    )}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={`rounded-md border p-2 ${item.authorIsMe || item.myVote === 'agree' ? 'border-amber-300/80 bg-white/70 dark:border-amber-700/60 dark:bg-amber-950/30' : 'border-emerald-500/70 bg-emerald-50/80 dark:border-emerald-600/60 dark:bg-emerald-950/30'}`}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                {item.authorIsMe || item.myVote === 'agree'
                  ? line(locale, 'Bản gốc để đối chiếu', 'Original, for comparison', '原版，供对照', '照合用の元の版', '비교용 원본')
                  : line(locale, 'Đang dùng bản gốc', 'Using the original', '正在使用原版', '元の版を使用中', '원본 사용 중')}
              </p>
              {originalText ? (
                <DiffSpans spans={compared.original} tone="original" />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{line(locale, '(Chưa có bản gốc)', '(No original)', '（没有原版）', '（元の版なし）', '(원본 없음)')}</p>
              )}
            </div>
            <div className={`rounded-md border p-2 ${item.authorIsMe || item.myVote === 'agree' ? 'border-emerald-500/70 bg-emerald-50/80 dark:border-emerald-600/60 dark:bg-emerald-950/30' : 'border-amber-300/80 bg-white/70 dark:border-amber-700/60 dark:bg-amber-950/30'}`}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                {item.authorIsMe || item.myVote === 'agree'
                  ? line(locale, 'Đang dùng bản sửa', 'Using the edit', '正在使用修改版', '修正版を使用中', '수정본 사용 중')
                  : line(locale, 'Bản sửa để đối chiếu', 'Edit, for comparison', '修改版，供对照', '照合用の修正版', '비교용 수정본')}
              </p>
              <DiffSpans spans={compared.edited} tone="edit" />
            </div>
          </div>
          <p className="text-xs">
            {line(
              locale,
              `${item.agreeCount}/7 người đã duyệt · ${item.rejectCount}/7 người không duyệt · Sửa ${item.editCount} lần`,
              `${item.agreeCount}/7 approved · ${item.rejectCount}/7 rejected · Edited ${item.editCount} time(s)`,
              `${item.agreeCount}/7 人已通过 · ${item.rejectCount}/7 人未通过 · 修改 ${item.editCount} 次`,
              `${item.agreeCount}/7人が承認 · ${item.rejectCount}/7人が不承認 · 修正 ${item.editCount} 回`,
              `${item.agreeCount}/7명 승인 · ${item.rejectCount}/7명 거절 · 수정 ${item.editCount}회`
            )}
          </p>
          {!item.authorIsMe ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || item.myVote === 'agree'}
                onClick={() => onVote('agree')}
              >
                {item.myVote === 'agree'
                  ? line(locale, 'Đã xác nhận', 'Confirmed', '已确认', '確認済み', '확인함')
                  : line(locale, 'Xác nhận sửa đúng', 'Confirm this edit', '确认修改正确', '修正は正しい', '수정이 맞음')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || item.myVote === 'reject'}
                onClick={() => onVote('reject')}
              >
                {item.myVote === 'reject'
                  ? line(locale, 'Đã không duyệt', 'Declined', '已不通过', '不承認', '승인 안 함')
                  : line(locale, 'Không duyệt', 'Do not approve', '不通过', '承認しない', '승인하지 않음')}
              </Button>
            </div>
          ) : null}
        </div>
  )
}

export function WorksheetQuestionProposals({
  worksheetId,
  locale = 'vi',
  onChanged,
}: {
  worksheetId: string
  locale?: WebLocale
  /** Gọi sau khi xác nhận hoặc không duyệt, để trang nạp lại lời giải người này đang dùng. */
  onChanged?: () => void
}) {
  const { items, vote, busyId } = useWorksheetQuestionProposals(worksheetId, onChanged)
  if (!items.length) return null

  return (
    <div className="sticky top-0 z-[70] shrink-0 space-y-2 border-b border-amber-300/80 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-50">
      {items.map((item) => (
        <WorksheetQuestionCompare
          key={item.questionId}
          item={item}
          locale={locale}
          busy={busyId === item.questionId}
          onVote={(choice) => void vote(item.questionId, choice)}
        />
      ))}
    </div>
  )
}
