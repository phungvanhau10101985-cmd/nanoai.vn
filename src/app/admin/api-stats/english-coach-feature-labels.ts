import { EnglishCoachApiFeature } from '@/lib/english-coach-api-usage'

/** Nhãn tiếng Việt cho cột “Chức năng” (admin api-stats + báo cáo riêng). */
export const ENGLISH_COACH_API_STATS_FEATURE_LABELS: Record<string, string> = {
  [EnglishCoachApiFeature.transcribeMixed]: 'Transcribe giọng (mixed)',
  [EnglishCoachApiFeature.tokenize]: 'Tách từ câu (tokenize)',
  [EnglishCoachApiFeature.chatRepeatMeaning]: 'Chat — dịch/giải thích câu nhắc lại',
  [EnglishCoachApiFeature.chatReflex]: 'Chat — chế độ phản xạ',
  [EnglishCoachApiFeature.chatReflexTransliterate]: 'Chat — romanize/pinyin (reflex)',
  [EnglishCoachApiFeature.chatMixedAnalysis]: 'Chat — phân tích mixed/auto',
  [EnglishCoachApiFeature.chatMain]: 'Chat — luồng chính (JSON giáo viên)',
  [EnglishCoachApiFeature.chatMainDeepSeek]: 'Chat — fallback DeepSeek (JSON chính)',
  [EnglishCoachApiFeature.chatMainOpenaiFallback]: 'Chat — fallback OpenAI (JSON chính)',
  [EnglishCoachApiFeature.chatRepairJson]: 'Chat — sửa JSON lỗi',
  [EnglishCoachApiFeature.chatStrictRetry]: 'Chat — retry JSON strict',
  [EnglishCoachApiFeature.chatRepairScript]: 'Chat — sửa script ngôn ngữ đích',
  [EnglishCoachApiFeature.chatForceHowToSay]: 'Chat — bổ sung “how to say”',
  [EnglishCoachApiFeature.chatRepairIntent]: 'Chat — sửa intentAnswer',
  [EnglishCoachApiFeature.chatRepairMainSentence]: 'Chat — sửa mainSentence (EN)',
  [EnglishCoachApiFeature.chatMainSentenceGate]: 'Chat — kiểm tra mainSentence',
  [EnglishCoachApiFeature.chatPinyin]: 'Chat — pinyin câu Trung',
  [EnglishCoachApiFeature.intentExplain]: 'Giải thích Ý 2 / Ý 3 (intent-explain)',
  [EnglishCoachApiFeature.transliterate]: 'Phiên âm Latin (transliterate)',
  [EnglishCoachApiFeature.placementLevel]: 'Chấm level nhanh (placement)',
  [EnglishCoachApiFeature.topicNormalize]: 'Chuẩn hóa chủ đề tự tạo',
  [EnglishCoachApiFeature.topicCurriculum]: 'Sinh giáo trình chủ đề',
  [EnglishCoachApiFeature.word]: 'Tra từ / giải nghĩa (word)',
  [EnglishCoachApiFeature.assessment]: 'Đánh giá CEFR (assessment)',
  [EnglishCoachApiFeature.writingEval]: 'Chấm bài viết micro-writing',
  [EnglishCoachApiFeature.fixWordExamples]: 'Admin — sửa ví dụ từ (fix-word-examples)',
  'english-coach-tts-openai': 'TTS — OpenAI (đọc câu)',
  'english-coach-tts-gemini': 'TTS — Gemini (đọc câu)',
}

const ENGLISH_COACH_FEATURE_PREFIX = 'english-coach-'

/** Nhãn cho `english-coach-live-*` / `english-coach-preset-*` (log mới). */
export function labelForEnglishCoachUsageFeature(feature: string): string {
  const m = feature.match(/^english-coach-(live|preset)-([\w-]+)$/)
  if (m) {
    const canonical = `${ENGLISH_COACH_FEATURE_PREFIX}${m[2]}`
    const base = ENGLISH_COACH_API_STATS_FEATURE_LABELS[canonical] || m[2]
    const tag = m[1] === 'live' ? 'Live' : 'Có sẵn'
    return `[${tag}] ${base}`
  }
  return ENGLISH_COACH_API_STATS_FEATURE_LABELS[feature] || feature
}

export function buildEnglishCoachFeatureLabelsForLogs(features: Iterable<string>): Record<string, string> {
  const out: Record<string, string> = { ...ENGLISH_COACH_API_STATS_FEATURE_LABELS }
  for (const f of features) {
    if (!out[f]) out[f] = labelForEnglishCoachUsageFeature(f)
  }
  return out
}
