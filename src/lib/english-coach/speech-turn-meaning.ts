/** Câu máy nghe được giữ nguyên. Nghĩa tiếng mẹ đẻ đi riêng, không ghép vào câu nói. */

export type SpeechTurnAnalysis = {
  targetTranscript: string
  nativeTranscript: string
  mergedTranscript: string
  inferredMeaning: string
  nativeMeaningFromLearner?: boolean
  pronunciationIssues: string[]
  pronunciationScore: number
  weakWords: string[]
  pronunciationAccuracy: number
  pronunciationFluency: number
  pronunciationProsody: number
  wordScores: Array<{
    word: string
    score: number
    issueType: string
  }>
}

export function applySpeechNativeMeaning<T extends SpeechTurnAnalysis>(
  analysis: T | null,
  input: { transcript: string; systemMeaning: string; learnerMeaning: string },
): { studentText: string; analysis: T & { inferredMeaning: string; nativeMeaningFromLearner: boolean } } {
  const studentText = String(input.transcript || '').trim()
  const learnerMeaning = String(input.learnerMeaning || '').trim()
  const systemMeaning = String(input.systemMeaning || '').trim()
  const heardMeaning = String(analysis?.inferredMeaning || '').trim()
  const inferredMeaning = learnerMeaning || systemMeaning || heardMeaning
  const base: SpeechTurnAnalysis = analysis || {
    targetTranscript: studentText,
    nativeTranscript: '',
    mergedTranscript: studentText,
    inferredMeaning: '',
    pronunciationIssues: [],
    pronunciationScore: 0,
    weakWords: [],
    pronunciationAccuracy: 0,
    pronunciationFluency: 0,
    pronunciationProsody: 0,
    wordScores: [],
  }
  return {
    studentText,
    analysis: {
      ...(base as T),
      inferredMeaning,
      nativeMeaningFromLearner: Boolean(learnerMeaning),
    },
  }
}
