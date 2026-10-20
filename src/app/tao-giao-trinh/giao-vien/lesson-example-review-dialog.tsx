'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import {
  CURRICULUM_MATH_TEACHER_OK,
  curriculumMarkdownForStudents,
  judgeCurriculumExercise,
  judgeKnowledgeBlock,
  listPresentationSlideReviews,
  replaceCurriculumExercise,
  type CurriculumExerciseReview,
  type CurriculumReviewSlide,
} from '@/app/tao-giao-trinh/lib/curriculum-math-check'
import { getSlideReviewStatsAction, recordSlideReviewAction } from '@/app/tao-giao-trinh/lesson-actions'
import type { SlideReviewStat } from '@/lib/db/slide-content-review-pg'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

type Props = {
  markdown: string
  slides?: CurriculumReviewSlide[]
  subjectId: string
  curriculumId?: string | null
  lessonNo?: number | null
  tr: Tr
  onCancel: () => void
  onEdit: (before: string, after: string) => void
  onPass: (nextMarkdown: string) => void
}

export function patchSlidesWithReviewedExercise<T extends {
  title: string
  content?: string
  teacherNotes?: string
  imageUrl?: string
  visualEmbed?: string
  visualCells?: unknown
  blocks?: Array<{ header?: string; content?: string }>
}>(slides: T[], before: string, after: string): T[] {
  const oldStudent = curriculumMarkdownForStudents(before).replace(/\s+/g, ' ').trim()
  const nextStudent = curriculumMarkdownForStudents(after).trim()
  if (!nextStudent) return slides
  const needle = oldStudent.slice(0, 48)
  let found = false
  const next = slides.map((slide) => {
    let slideFound = false
    const blocks = (slide.blocks ?? []).map((block) => {
      const text = String(block.content || '').replace(/\s+/g, ' ')
      if (needle && text.includes(needle)) {
        found = true
        slideFound = true
        return { ...block, content: nextStudent }
      }
      return block
    })
    const raw = String(slide.content || '')
    const contentHit = Boolean(needle && raw.replace(/\s+/g, ' ').includes(needle))
    if (contentHit) {
      found = true
      slideFound = true
    }
    if (!slideFound) return slide
    return {
      ...slide,
      blocks: blocks.length > 0 ? blocks : [{ header: 'Ví dụ', content: nextStudent }],
      content: contentHit ? nextStudent : raw,
    }
  })
  if (found || !needle || slides.length === 0) return next
  return [
    ...next,
    {
      ...slides[0],
      title: 'Ví dụ đã sửa',
      blocks: [{ header: 'Ví dụ', content: nextStudent }],
      content: nextStudent,
      teacherNotes: '',
      imageUrl: undefined,
      visualEmbed: undefined,
      visualCells: undefined,
    },
  ]
}

function shownSlideText(text: string): string {
  return curriculumMarkdownForStudents(text).trim() || text.trim()
}

export function LessonExampleReviewDialog({ markdown, slides, subjectId, curriculumId, lessonNo, tr, onCancel, onEdit, onPass }: Props) {
  const initial = useMemo(
    () => listPresentationSlideReviews(slides, { subjectId }),
    [slides, subjectId]
  )
  const [items, setItems] = useState<CurriculumExerciseReview[]>(initial)
  const [source, setSource] = useState(markdown)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [stats, setStats] = useState<SlideReviewStat[]>([])
  const total = items.length
  const slideTexts = items.map((row) => shownSlideText(row.text))

  useEffect(() => {
    if (!curriculumId || !lessonNo || slideTexts.length === 0) return
    let cancelled = false
    void getSlideReviewStatsAction({ curriculumId, lessonNo, slideTexts }).then((result) => {
      if (cancelled || !('stats' in result)) return
      setStats(result.stats)
    })
    return () => {
      cancelled = true
    }
    // Chỉ đọc một lần khi mở bảng. Lượt xác nhận sau cập nhật stats tại chỗ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumId, lessonNo])
  const pending = items.filter((row) => row.status !== 'pass').length

  const acceptEdit = (index: number, before: string, after: string, verdict: CurriculumExerciseReview) => {
    const nextSource = replaceCurriculumExercise(source, before, after)
    const nextItems = items.map((row, i) => (i === index ? { ...verdict, text: after.trim() } : row))
    setSource(nextSource)
    setItems(nextItems)
    setDraft(after.trim())
    setEditingIndex(verdict.status === 'pass' ? null : index)
    if (verdict.status === 'pass' && before.trim() !== after.trim()) onEdit(before, after)
    const nextTexts = nextItems.map((row) => shownSlideText(row.text))
    const changed = shownSlideText(before) !== shownSlideText(after)
    if (changed) void remember(index, 'edit', shownSlideText(after), nextTexts)
    else if (verdict.status === 'pass') void remember(index, 'confirm', shownSlideText(after), nextTexts)
  }

  const remember = (index: number, action: 'confirm' | 'edit' | 'agree' | 'reject', slideText: string, texts: string[]) => {
    if (!curriculumId || !lessonNo) return
    void recordSlideReviewAction({
      curriculumId,
      lessonNo,
      slideIndex: index,
      slideText,
      action,
      slideTexts: texts,
    }).then((result) => {
      if ('stats' in result) setStats(result.stats)
    })
  }

  const confirmSlide = (index: number, withTeacherOk: boolean) => {
    const item = items[index]
    if (!item) return
    const shown = curriculumMarkdownForStudents(item.text).trim() || item.text
    const body = withTeacherOk && !shown.includes(CURRICULUM_MATH_TEACHER_OK)
      ? `${shown.trim()}\n${CURRICULUM_MATH_TEACHER_OK}`
      : shown
    const verdict = judgeKnowledgeBlock(body, { subjectId })
    const exercise = judgeCurriculumExercise(body, { subjectId })
    const next = exercise.status === 'wrong' ? exercise : verdict.status === 'wrong' ? verdict : exercise.status === 'pass' && verdict.status === 'unverified' ? verdict : exercise
    if (next.status === 'pass') next.message = 'seen'
    acceptEdit(index, item.text, next.text || body, next)
  }

  const recheck = (index: number, withTeacherOk = false) => {
    const item = items[index]
    if (!item) return
    const body = withTeacherOk && !draft.includes(CURRICULUM_MATH_TEACHER_OK)
      ? `${draft.trim()}\n${CURRICULUM_MATH_TEACHER_OK}`
      : draft
    const verdict = judgeKnowledgeBlock(body, { subjectId })
    const exercise = judgeCurriculumExercise(body, { subjectId })
    const next = exercise.status === 'wrong' ? exercise : verdict.status === 'wrong' ? verdict : exercise.status === 'pass' && verdict.status === 'unverified' ? verdict : exercise
    acceptEdit(index, item.text, next.text || body, next)
  }

  const confirmRead = (index: number) => {
    const item = items[index]
    if (!item || item.status !== 'pass') return
    const nextItems = items.map((row, i) => (i === index ? { ...row, status: 'pass' as const, message: 'seen' } : row))
    setItems(nextItems)
    remember(index, 'confirm', shownSlideText(item.text), nextItems.map((row) => shownSlideText(row.text)))
  }

  if (total === 0) return null
  const seenCount = items.filter((row) => row.status === 'pass' && row.message === 'seen').length
  const ready = pending === 0 && seenCount === total

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 md:p-4">
      <div className="flex h-[min(92vh,920px)] w-full max-w-3xl flex-col rounded-xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {tr('Duyệt slide', 'Review slides', '核对幻灯片', 'スライドを確認', '슬라이드 확인')}
            </p>
            <p className="text-xs text-slate-400">
              {tr(
                `${total} slide. Lăn lên xuống để đọc các slide liền nhau. Xong hết mới mở cửa sổ học sinh.`,
                `${total} slides. Scroll to read the neighboring slides. The student window opens after every slide is checked.`,
                `共 ${total} 张。上下滚动阅读相邻幻灯片。全部看完才打开学生窗口。`,
                `${total}枚。上下にスクロールして前後のスライドを読む。全部確認してから生徒画面を開く。`,
                `슬라이드 ${total}장. 위아래로 스크롤해 앞뒤 슬라이드를 읽습니다. 모두 확인한 뒤 학생 창이 열립니다.`
              )}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-800">
            {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-3">
          {items.map((item, index) => {
            const title = String(slides?.[index]?.title || '').trim() || tr('Slide', 'Slide', '幻灯片', 'スライド', '슬라이드')
            const shown = curriculumMarkdownForStudents(item.text).trim() || item.text
            const editing = editingIndex === index
            const passed = item.status === 'pass'
            const seen = passed && item.message === 'seen'
            const stat = stats[index] ?? { confirmCount: 0, editCount: 0, warn: false, proposalText: null, proposalAuthorIsMe: false, myVote: null }
            return (
              <article key={`${index}-${title}`} className="rounded-lg border border-slate-700 bg-slate-950/70">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-3 py-2">
                  <p className="text-sm font-medium text-amber-200">
                    {index + 1}/{total}. {title}
                  </p>
                  {seen ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-300">
                      <Check className="h-4 w-4" aria-hidden />
                      {tr('Đã xem', 'Seen', '已看', '確認済', '확인함')}
                    </span>
                  ) : passed ? (
                    <span className="shrink-0 text-xs text-slate-400">{tr('Chưa xác nhận', 'Not confirmed', '未确认', '未確認', '미확인')}</span>
                  ) : (
                    <span className={`shrink-0 text-xs font-medium ${item.status === 'wrong' ? 'text-rose-300' : 'text-amber-200'}`}>
                      {item.status === 'wrong'
                        ? tr('Sai, cần sửa', 'Wrong, needs a fix', '错误，需要修改', '誤り。修正が必要', '틀림. 수정 필요')
                        : tr('Chưa kiểm được', 'Not checked yet', '尚未验算', 'まだ検算できない', '아직 검산 불가')}
                    </span>
                  )}
                </div>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-36 w-full border-0 bg-transparent p-3 text-sm leading-relaxed text-slate-100 outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-slate-200">{shown}</pre>
                )}
                {!passed && item.message ? (
                  <p className="px-3 pb-2 text-xs text-amber-200/90">{item.message}</p>
                ) : null}
                {stat.warn && stat.proposalAuthorIsMe ? (
                  <p className="mx-3 mb-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm text-violet-100">
                    {tr(
                      'Bạn đang dùng bản bạn vừa sửa. Sai thì bạn tự chịu. Bản chung chỉ đổi khi đủ 7 giáo viên khác đồng ý.',
                      'You are using your own edit. If it is wrong, that is on you. The shared slide changes only after 7 other teachers agree.',
                      '你正在使用自己的修改。若有误由你承担。要有 7 位其他教师同意，共享幻灯片才会更换。',
                      '自分の修正版を使用中です。誤りは自分の責任です。共有版は他の教員7人が同意してから変わります。',
                      '본인 수정본을 사용 중입니다. 틀리면 본인 책임입니다. 다른 교사 7명이 동의한 뒤에만 공유본이 바뀝니다.'
                    )}
                  </p>
                ) : null}
                {stat.warn && stat.proposalText && !stat.proposalAuthorIsMe ? (
                  <div className="mx-3 mb-2 rounded-md border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
                    <p>
                      {tr(
                        'Chú ý: có đề xuất sửa. Hãy đọc kỹ rồi đồng ý hoặc không. Bạn cũng có thể tự sửa.',
                        'Note: there is an edit proposal. Read it, then agree or disagree. You can also edit it yourself.',
                        '注意：有一条修改提议。请仔细阅读后同意或反对。你也可以自己修改。',
                        '注意：修正案があります。読んで同意か反対を。自分で修正もできます。',
                        '주의: 수정 제안이 있습니다. 읽고 동의하거나 반대하세요. 직접 수정할 수도 있습니다.'
                      )}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-slate-100">{stat.proposalText}</pre>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    {tr(
                      `${stat.confirmCount}/7 giáo viên khác đồng ý`,
                      `${stat.confirmCount}/7 other teachers agreed`,
                      `${stat.confirmCount}/7 位其他教师同意`,
                      `他の教員 ${stat.confirmCount}/7 人が同意`,
                      `다른 교사 ${stat.confirmCount}/7명 동의`
                    )}
                    {' · '}
                    {tr(
                      `Sửa ${stat.editCount} lần`,
                      `Edited ${stat.editCount} times`,
                      `修改 ${stat.editCount} 次`,
                      `修正 ${stat.editCount} 回`,
                      `수정 ${stat.editCount}회`
                    )}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                  {stat.warn && stat.proposalText && !stat.proposalAuthorIsMe ? (
                    <>
                      <button
                        type="button"
                        disabled={stat.myVote === 'agree'}
                        onClick={() => remember(index, 'agree', stat.proposalText || '', slideTexts)}
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {stat.myVote === 'agree'
                          ? tr('Bạn đã đồng ý', 'You agreed', '你已同意', '同意済み', '동의함')
                          : tr('Đồng ý đề xuất', 'Agree', '同意提议', '提案に同意', '제안에 동의')}
                      </button>
                      <button
                        type="button"
                        disabled={stat.myVote === 'reject'}
                        onClick={() => remember(index, 'reject', stat.proposalText || '', slideTexts)}
                        className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                      >
                        {stat.myVote === 'reject'
                          ? tr('Bạn không đồng ý', 'You disagreed', '你已反对', '反対済み', '반대함')
                          : tr('Không đồng ý', 'Disagree', '不同意', '同意しない', '동의하지 않음')}
                      </button>
                    </>
                  ) : null}
                  {editing ? (
                    <>
                      {item.status !== 'wrong' ? (
                        <button
                          type="button"
                          onClick={() => recheck(index, true)}
                          className="rounded-md border border-amber-500/70 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/10"
                        >
                          {tr('Xác nhận nội dung này đúng', 'Confirm this content', '确认这段内容正确', 'この内容は正しい', '이 내용이 맞음')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => recheck(index, false)}
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                      >
                        {tr('Kiểm lại', 'Check again', '重新验算', '再検算', '다시 검산')}
                      </button>
                    </>
                  ) : passed && !seen ? (
                    <button
                      type="button"
                      onClick={() => confirmRead(index)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      {tr('Nội dung đúng', 'Content is correct', '内容正确', '内容は正しい', '내용이 맞음')}
                    </button>
                  ) : !passed ? (
                    <>
                      {item.status === 'unverified' ? (
                        <button
                          type="button"
                          onClick={() => confirmSlide(index, true)}
                          className="rounded-md border border-amber-500/70 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/10"
                        >
                          {tr('Xác nhận nội dung này đúng', 'Confirm this content', '确认这段内容正确', 'この内容は正しい', '이 내용이 맞음')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(shown)
                          setEditingIndex(index)
                        }}
                        className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800"
                      >
                        {tr('Sửa', 'Edit', '修改', '修正', '수정')}
                      </button>
                    </>
                  ) : null}
                  {passed && !editing ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(shown)
                        setEditingIndex(index)
                      }}
                      className="rounded-md border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800"
                    >
                      {tr('Sửa', 'Edit', '修改', '修正', '수정')}
                    </button>
                  ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400">
            {ready
              ? tr('Đã duyệt hết slide.', 'Every slide is checked.', '幻灯片已全部核对。', '全スライドを確認しました。', '모든 슬라이드를 확인했습니다.')
              : tr(
                  `Còn ${total - seenCount} slide chưa xác nhận.`,
                  `${total - seenCount} slides are not confirmed yet.`,
                  `还有 ${total - seenCount} 张未确认。`,
                  `未確認が ${total - seenCount} 枚あります。`,
                  `아직 확인하지 않은 슬라이드 ${total - seenCount}장.`
                )}
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onPass(source)}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr('Mở giao diện học sinh', 'Open student view', '打开学生界面', '生徒画面を開く', '학생 화면 열기')}
          </button>
        </div>
      </div>
    </div>
  )
}
