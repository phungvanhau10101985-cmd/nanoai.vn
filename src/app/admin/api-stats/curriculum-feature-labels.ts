import { CurriculumApiFeature } from '@/lib/curriculum-api-usage'

/** Nhãn mô tả bước xử lý (admin — báo cáo giáo trình). */
export const CURRICULUM_API_STATS_FEATURE_LABELS: Record<string, string> = {
  [CurriculumApiFeature.fromImage]: 'Tạo giáo trình từ ảnh SGK (vision Pro)',
  [CurriculumApiFeature.slidesFromMarkdown]: 'Sinh slide từ markdown giáo trình (Flash)',
  [CurriculumApiFeature.fromPaste]: 'Tạo giáo trình từ nội dung dán (+ ảnh nếu có)',
  [CurriculumApiFeature.analyzeSlidesGemini]: 'Phân tích giáo trình → slide (API analyze-slides, Gemini)',
  [CurriculumApiFeature.editCheckFull]: 'Kiểm tra sửa giáo trình — toàn bài (2× Flash)',
  [CurriculumApiFeature.editCheckRegion]: 'Kiểm tra sửa giáo trình — vùng so sánh (2× Flash)',
  [CurriculumApiFeature.createFromForm]: 'Tạo giáo trình từ form (chủ đề / SGK, Pro)',
  [CurriculumApiFeature.lessonTopicsExtract]: 'Trích chủ đề bài học (lesson_topics, Flash)',
  [CurriculumApiFeature.topicRerank]: 'Xếp hạng lại chủ đề trùng (topic rerank, Flash)',
  [CurriculumApiFeature.slideProposalVerify]: 'Duyệt đề xuất sửa slide (Pro)',
}

export function buildCurriculumFeatureLabelsForLogs(features: Iterable<string>): Record<string, string> {
  const out: Record<string, string> = { ...CURRICULUM_API_STATS_FEATURE_LABELS }
  for (const f of features) {
    if (!out[f]) out[f] = f.replace(/^curriculum-/, '').replace(/-/g, ' ')
  }
  return out
}
