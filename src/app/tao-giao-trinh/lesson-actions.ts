'use server'

import { getUserForCreditAction } from '@/lib/auth'
import { fetchSlideReviewStatsPg, recordSlideReviewPg, type SlideReviewStat } from '@/lib/db/slide-content-review-pg'
import { updateReviewedCurriculumLessonPg } from '@/lib/db/tao-giao-trinh-curriculum-pg'
import {
  ensureCurriculumLessonSlidesPrepared as ensureCurriculumLessonSlidesPreparedCore,
  getCurriculumLessonMeta as getCurriculumLessonMetaCore,
  getCurriculumSlidesByLessonCached as getCurriculumSlidesByLessonCachedCore,
  getCurriculumSlidesByLesson as getCurriculumSlidesByLessonCore,
  saveCurriculumLessonInfographic as saveCurriculumLessonInfographicCore,
} from './actions'

type CurriculumSlideModeForLesson = 'shared' | 'original' | 'personal'

export async function getCurriculumLessonMetaAction(
  curriculumId: string,
  mode: CurriculumSlideModeForLesson
) {
  return getCurriculumLessonMetaCore(curriculumId, mode)
}

export async function getCurriculumSlidesByLessonAction(
  curriculumId: string,
  mode: CurriculumSlideModeForLesson,
  lessonNo: number
) {
  return getCurriculumSlidesByLessonCore(curriculumId, mode, lessonNo)
}

export async function ensureCurriculumLessonSlidesPreparedAction(
  curriculumId: string,
  lessonNo: number
) {
  return ensureCurriculumLessonSlidesPreparedCore(curriculumId, lessonNo)
}

export async function getCurriculumSlidesByLessonCachedAction(
  curriculumId: string,
  mode: CurriculumSlideModeForLesson,
  lessonNo: number
) {
  return getCurriculumSlidesByLessonCachedCore(curriculumId, mode, lessonNo)
}

export async function getSlideReviewStatsAction(input: {
  curriculumId: string
  lessonNo: number
  slideTexts: string[]
}): Promise<{ stats: SlideReviewStat[] } | { error: string }> {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  if (!input.curriculumId || !Number.isFinite(input.lessonNo) || input.lessonNo < 1) {
    return { error: 'Thiếu giáo trình hoặc tiết học.' }
  }
  const stats = await fetchSlideReviewStatsPg({
    curriculumId: input.curriculumId,
    lessonNo: input.lessonNo,
    slideTexts: input.slideTexts.slice(0, 80),
    userId: auth.user.id,
  })
  if (!stats) return { error: 'Không đọc được lượt duyệt slide.' }
  return { stats }
}

export async function recordSlideReviewAction(input: {
  curriculumId: string
  lessonNo: number
  slideIndex: number
  slideText: string
  action: 'confirm' | 'edit' | 'agree' | 'reject'
  slideTexts: string[]
}): Promise<{ stats: SlideReviewStat[] } | { error: string }> {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  if (!input.curriculumId || !Number.isFinite(input.lessonNo) || input.lessonNo < 1) {
    return { error: 'Thiếu giáo trình hoặc tiết học.' }
  }
  if (!Number.isFinite(input.slideIndex) || input.slideIndex < 0 || input.slideIndex > 79) {
    return { error: 'Slide không hợp lệ.' }
  }
  if (!['confirm', 'edit', 'agree', 'reject'].includes(input.action)) return { error: 'Thao tác không hợp lệ.' }
  const stats = await recordSlideReviewPg({
    curriculumId: input.curriculumId,
    lessonNo: input.lessonNo,
    slideIndex: input.slideIndex,
    slideText: String(input.slideText || '').slice(0, 20000),
    userId: auth.user.id,
    action: input.action,
    slideTexts: input.slideTexts.slice(0, 80),
  })
  if (!stats) return { error: 'Không lưu được lượt duyệt slide.' }
  return { stats }
}

export async function saveReviewedLessonMarkdownAction(input: {
  curriculumId: string
  lessonNo: number
  lessonMarkdown: string
  fullMarkdown?: string | null
}) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  return updateReviewedCurriculumLessonPg({
    curriculumId: input.curriculumId,
    userId: auth.user.id,
    lessonNo: input.lessonNo,
    lessonMarkdown: input.lessonMarkdown,
    fullMarkdown: input.fullMarkdown,
  })
}

export async function saveCurriculumLessonInfographicAction(
  curriculumId: string,
  mode: CurriculumSlideModeForLesson,
  lessonNo: number,
  infographic: {
    summary: string
    mermaid: string
    imageUrl: string
    generatedAt: string
  }
) {
  return saveCurriculumLessonInfographicCore({ curriculumId, mode, lessonNo, infographic })
}
