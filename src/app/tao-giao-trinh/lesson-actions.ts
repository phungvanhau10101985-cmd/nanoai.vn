'use server'

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
