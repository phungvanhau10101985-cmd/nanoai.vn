'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listWorksheetQuestionProposals, voteWorksheetQuestion } from '@/app/tao-giao-trinh/actions'
import type { WorksheetQuestionProposal } from '@/lib/db/worksheet-question-review-pg'
import type { WebLocale } from '@/lib/i18n/config'

function line(locale: WebLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

export function WorksheetQuestionProposals({
  worksheetId,
  locale = 'vi',
}: {
  worksheetId: string
  locale?: WebLocale
}) {
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
      await voteWorksheetQuestion(questionId, choice)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!items.length) return null

  return (
    <div className="shrink-0 space-y-2 border-b border-amber-300/80 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-50">
      {items.map((item) => (
        <div key={item.questionId} className="space-y-2">
          <p className="text-sm font-medium">
            {item.authorIsMe
              ? line(
                  locale,
                  'Bạn đang dùng bản sửa của mình. Bản chung đổi khi 7 giáo viên khác đồng ý.',
                  'You are using your own edit. The shared question changes after 7 other teachers agree.',
                  '你正在使用自己的修改。另外 7 位老师同意后，共用题目才会改变。',
                  '自分の修正を使っています。共有問題は他の教師7人が同意してから変わります。',
                  '내 수정을 사용 중입니다. 다른 교사 7명이 동의하면 공유 문제가 바뀝니다.'
                )
              : line(
                  locale,
                  'Có đề xuất sửa câu này. Hãy đọc kỹ trước khi đồng ý.',
                  'This question has a proposed edit. Read it before you agree.',
                  '这道题有修改提议。同意前请先读完。',
                  'この問題に修正案があります。同意する前に読んでください。',
                  '이 문제에 수정 제안이 있습니다. 동의하기 전에 읽어 주세요.'
                )}
          </p>
          {item.preview ? <p className="text-sm leading-relaxed">{item.preview}</p> : null}
          <p className="text-xs">
            {line(
              locale,
              `${item.agreeCount}/7 giáo viên khác đồng ý · Sửa ${item.editCount} lần`,
              `${item.agreeCount}/7 other teachers agree · Edited ${item.editCount} time(s)`,
              `${item.agreeCount}/7 位其他老师同意 · 修改 ${item.editCount} 次`,
              `他の教師 ${item.agreeCount}/7 人が同意 · 修正 ${item.editCount} 回`,
              `다른 교사 ${item.agreeCount}/7명 동의 · 수정 ${item.editCount}회`
            )}
          </p>
          {!item.authorIsMe ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busyId === item.questionId}
                onClick={() => void vote(item.questionId, 'agree')}
              >
                {line(locale, 'Đồng ý', 'Agree', '同意', '同意する', '동의')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyId === item.questionId}
                onClick={() => void vote(item.questionId, 'reject')}
              >
                {line(locale, 'Không đồng ý', 'Disagree', '不同意', '同意しない', '동의하지 않음')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
