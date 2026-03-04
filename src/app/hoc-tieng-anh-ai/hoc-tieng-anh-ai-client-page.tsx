'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mic, MicOff, Minus, Plus, Send, Languages, Volume2, Play, RotateCcw, Trash2, Navigation } from 'lucide-react'
import { WordPracticeOverlay } from './components/word-practice-overlay'
import { PreLessonReviewOverlay } from './components/pre-lesson-review-overlay'
import { QuickStartModal } from './components/quick-start-modal'
import { HistoryPanel } from './components/history-panel'
import { TodayWordsPanel } from './components/today-words-panel'
import { ReviewItemsPanel } from './components/review-items-panel'
import { createCoachTranslator } from './i18n'
import { toLanguagePairKey } from './i18n/pairs'
import {
  analyzeWord,
  chatWithCoach,
  cleanupIncompleteWords,
  createSessionFromRandomCompletedLesson,
  checkCompletedLessonMatch,
  chargeEnglishCoachCredits,
  createTopicCurriculum,
  explainIntent,
  generateTts,
  deleteHistorySession,
  endHistorySession,
  getHistorySession,
  getHistorySessions,
  getPreviousLessonWords,
  getReviewDue,
  getSessionWords,
  getTtsCache,
  listCustomTopics,
  markReviewDue,
  normalizeCustomTopic,
  recordProgress,
  rescheduleReviewWords,
  runCefrAssessment,
  saveWordDaily,
  saveHistoryMessage as saveHistoryMessageApi,
  updateMessageTranslation as updateMessageTranslationApi,
  updateMiniStageSnapshot as updateMiniStageSnapshotApi,
  saveLearningGoal as saveLearningGoalApi,
  snapshotCompletedLessonSession,
  tokenizeSentence,
  transliterateText,
  transcribeMixed,
  uploadAudio,
  runPlacementLevel,
} from './services/english-coach-api'

type Accent = 'uk' | 'us'
type Gender = 'female' | 'male'
type VoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Autonoe' | 'Enceladus' | 'Sadachbia' | 'Orus' | 'Fenrir' | 'Iapetus'
type Mode = 'chat' | 'listen_speak' | 'roleplay_short'
type SpeakingLanguageMode = 'auto' | 'target' | 'native' | 'mixed'
type ResponseStyle = 'detailed' | 'concise'
type LearnerLevel = 0 | 1 | 2 | 3 | 4
type LanguageCode = 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko' | 'vi'
type NativeLanguageCode = 'vi' | 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko'
type UiLocale = NativeLanguageCode
const NATIVE_LANGUAGE_PREF_KEY = 'english-coach-native-language'
const LESSON_SETUP_PREF_KEY = 'english-coach-lesson-setup'
const LEARNER_PROFILE_PROMPT_DISMISSED_KEY = 'english-coach-learner-profile-prompt-dismissed-v1'
const LIVE_SESSION_BASE_TURN_LIMIT = 10
const LIVE_SESSION_EXTRA_TURN_STEP = 5
const LIVE_SESSION_PRICE_CREDITS = 2.5
const LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS = LIVE_SESSION_PRICE_CREDITS / 2
const PRESET_SESSION_PRICE_CREDITS = 1
const LESSON_TIMELINE_TARGET_TURNS = LIVE_SESSION_BASE_TURN_LIMIT
const FIXED_TTS_VOICE_BY_GENDER: Record<Gender, VoiceName> = {
  female: 'Kore',
  male: 'Orus',
}
const CROSS_PAGE_START_STORAGE_KEY = 'english-coach-cross-page-start-v1'
const SESSION_NAV_LOCK_MS = 500

function computeTimelineCompletedSteps(stepCount: number, studentTurnCount: number): number {
  const safeStepCount = Math.max(0, Math.floor(Number(stepCount || 0) || 0))
  if (safeStepCount <= 0) return 0
  const safeTurns = Math.max(0, Math.floor(Number(studentTurnCount || 0) || 0))
  const completed = Math.floor((safeTurns * safeStepCount) / LESSON_TIMELINE_TARGET_TURNS)
  return Math.min(completed, safeStepCount)
}

type LearningMode = 'review' | 'reflex'
type MiniStage = 'idle' | 'writing' | 'speaking' | 'listening' | 'done'

type ChatMessage = {
  id: string
  role: 'teacher' | 'student'
  text: string
}
type HistorySession = {
  sessionId: string
  languageCode: string
  targetLanguage?: string
  nativeLanguage?: string
  teacherLabel: string
  mode: string
  lastMessageAt: string
  lastTeacherText: string
  messageCount: number
  learningMode?: 'review' | 'reflex'
  topicId?: string
  topicLabel?: string
  isPresetReplaySession?: boolean
}
type WordInsight = {
  meaning: string
  pronunciation: string
  exampleTarget: string
  exampleNative: string
  senses: Array<{
    gloss: string
    exampleTarget: string
    exampleNative: string
  }>
  usageLevel: 'high' | 'medium' | 'low'
  importanceScore: number
  contextSensitive: boolean
  meaningItems: Array<{
    text: string
    pinyin?: string
  }>
  exampleItems: Array<{
    targetText: string
    targetPinyin?: string
    nativeText: string
  }>
}
type TodayWordItem = {
  id: string
  sessionId?: string
  word: string
  targetLanguage?: string
  meaning: string
  pronunciation: string
  pronunciationAudioUrl?: string
  usageLevel?: 'high' | 'medium' | 'low'
  importanceScore?: number
  contextSensitive?: boolean
  exampleTarget?: string
  exampleNative?: string
  senses?: Array<{
    gloss: string
    exampleTarget: string
    exampleNative: string
  }>
  meaningItems?: Array<{
    text: string
    pinyin?: string
  }>
  exampleItems?: Array<{
    targetText: string
    targetPinyin?: string
    nativeText: string
  }>
}

type MixedSpeechAnalysis = {
  targetTranscript: string
  nativeTranscript: string
  mergedTranscript: string
  inferredMeaning: string
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

type TopicOption = {
  id: string
  label: string
}

type TopicDifficulty = 'basic' | 'intermediate' | 'advanced'
type TopicDifficultyTag = TopicDifficulty | 'adaptive'
type TopicFilterMode = 'fit' | 'all'
type TopicSourceMode = 'builtin' | 'custom'

type CustomTopicItem = {
  topicId: string
  topicLabel: string
  topicDifficulty: TopicDifficulty
}

type TopicCurriculum = {
  roleplayRole: string
  dailyQuest: string
  objective: string
  keywords: string[]
  starterSentences: string[]
  lessonSteps: string[]
  openingLine: string
  openingQuestion: string
}

type GoalType = 'communication' | 'job' | 'travel' | 'exam'

type LearningGoal = {
  goal_type: string
  title: string
  target_days: number
  target_daily_minutes: number
  target_weekly_sessions: number
  target_pronunciation_score: number
}

type ProgressSnapshot = {
  turns_count: number
  sessions_count: number
  corrected_turns: number
  avg_pronunciation_score: number
  new_words_count: number
  streak_days: number
}

type PlacementQuickResult = {
  recommendedLevel: LearnerLevel
  confidence: number
  reason: string
}

type AssessmentItem = {
  cefr_level: string
  learner_level: number
  overall_score: number
  confidence: number
  taken_at: string
  summary: string
}

type WeeklySnapshot = {
  turns: number
  sessions: number
  activeDays: number
  targetSessions: number
  completionPercent: number
}

type LevelRecommendation = {
  suggestedLevel: number
  direction: 'up' | 'down'
  reason: string
  confidence: number
  basedOn: string[]
}
type QuickStartStage = 'idle' | 'confirm_topic' | 'create_curriculum' | 'start_lesson'

type ReviewItem = {
  id: string
  word: string
  targetLanguage?: string
  target_language?: string
  nativeLanguage?: string | null
  native_language?: string | null
  meaning?: string | null
  pronunciation?: string | null
  usageLevel?: 'high' | 'medium' | 'low'
  importanceScore?: number
  contextSensitive?: boolean
  meaningItems?: Array<{ text: string; pinyin?: string }>
  exampleItems?: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>
  exampleTarget?: string
  exampleNative?: string
  pronunciationAudioUrl?: string
  due_at?: string
  dueAt?: string
  repetitions?: number
  interval_days?: number
  intervalDays?: number
}

type WordPracticeProgress = {
  targetWord: string
  normalizedTarget: string
  attemptsTotal: number
  correctCount: number
  draft: string
  unlocked: boolean
  feedback: string
  expectedMeaning: string
  awaitingMeaningChoice: boolean
  meaningOptions: string[]
}

type Correction = {
  original: string
  fixed: string
  explanationVi: string
}

type WritingTaskType = 'copy'

type WritingTask = {
  messageId: string
  taskType: WritingTaskType
  instruction: string
  referenceSentence: string
  requiredSentences: string[]
  currentIndex: number
  teacherText: string
  completed: boolean
}

type WritingEvalResult = {
  score: number
  passed: boolean
  correctedText: string
  feedback: string
  shortHint: string
}

type TeacherProfile = {
  id: string
  label: string
  languageLabel: string
  locale: string
  voiceName: VoiceName
  accent?: Accent
  gender: Gender
}

const LANGUAGE_CODES: LanguageCode[] = ['en', 'zh', 'hi', 'th', 'ja', 'ko', 'vi']
const LANGUAGE_LABELS: Record<UiLocale, Record<LanguageCode, string>> = {
  vi: {
    en: 'Tiếng Anh',
    zh: 'Tiếng Trung',
    hi: 'Tiếng Hindi (Ấn Độ)',
    th: 'Tiếng Thái',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    vi: 'Tiếng Việt (cho người nước ngoài)',
  },
  en: { en: 'English', zh: 'Chinese (Mandarin)', hi: 'Hindi', th: 'Thai', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese (for foreigners)' },
  zh: { en: '英语', zh: '中文（普通话）', hi: '印地语', th: '泰语', ja: '日语', ko: '韩语', vi: '越南语（面向外国学习者）' },
  ja: { en: '英語', zh: '中国語（普通話）', hi: 'ヒンディー語', th: 'タイ語', ja: '日本語', ko: '韓国語', vi: 'ベトナム語（外国人学習者向け）' },
  ko: { en: '영어', zh: '중국어(표준어)', hi: '힌디어', th: '태국어', ja: '일본어', ko: '한국어', vi: '베트남어(외국인 학습자용)' },
  th: { en: 'อังกฤษ', zh: 'จีน (แมนดาริน)', hi: 'ฮินดี', th: 'ไทย', ja: 'ญี่ปุ่น', ko: 'เกาหลี', vi: 'เวียดนาม (สำหรับผู้เรียนต่างชาติ)' },
  hi: { en: 'अंग्रेज़ी', zh: 'चीनी (मंदारिन)', hi: 'हिंदी', th: 'थाई', ja: 'जापानी', ko: 'कोरियाई', vi: 'वियतनामी (विदेशी शिक्षार्थियों के लिए)' },
}

const TEACHER_LABELS: Record<string, Record<UiLocale, string>> = {
  'en-us-f': { vi: 'Cô giáo người Mỹ (US)', en: 'US English Teacher (Female)', zh: '美式英语老师（女）', ja: '米国英語教師（女性）', ko: '미국 영어 교사(여성)', th: 'ครูอังกฤษอเมริกัน (หญิง)', hi: 'अमेरिकी अंग्रेज़ी शिक्षिका' },
  'en-us-m': { vi: 'Thầy giáo người Mỹ (US)', en: 'US English Teacher (Male)', zh: '美式英语老师（男）', ja: '米国英語教師（男性）', ko: '미국 영어 교사(남성)', th: 'ครูอังกฤษอเมริกัน (ชาย)', hi: 'अमेरिकी अंग्रेज़ी शिक्षक' },
  'en-uk-f': { vi: 'Cô giáo người Anh (UK)', en: 'UK English Teacher (Female)', zh: '英式英语老师（女）', ja: '英国英語教師（女性）', ko: '영국 영어 교사(여성)', th: 'ครูอังกฤษสหราชอาณาจักร (หญิง)', hi: 'ब्रिटिश अंग्रेज़ी शिक्षिका' },
  'en-uk-m': { vi: 'Thầy giáo người Anh (UK)', en: 'UK English Teacher (Male)', zh: '英式英语老师（男）', ja: '英国英語教師（男性）', ko: '영국 영어 교사(남성)', th: 'ครูอังกฤษสหราชอาณาจักร (ชาย)', hi: 'ब्रिटिश अंग्रेज़ी शिक्षक' },
  'zh-cn-f': { vi: 'Cô giáo người Trung Quốc', en: 'Chinese Teacher (Female)', zh: '中文老师（女）', ja: '中国語教師（女性）', ko: '중국어 교사(여성)', th: 'ครูภาษาจีน (หญิง)', hi: 'चीनी भाषा शिक्षिका' },
  'zh-cn-m': { vi: 'Thầy giáo người Trung Quốc', en: 'Chinese Teacher (Male)', zh: '中文老师（男）', ja: '中国語教師（男性）', ko: '중국어 교사(남성)', th: 'ครูภาษาจีน (ชาย)', hi: 'चीनी भाषा शिक्षक' },
  'hi-in-f': { vi: 'Cô giáo người Ấn Độ', en: 'Hindi Teacher (Female)', zh: '印地语老师（女）', ja: 'ヒンディー語教師（女性）', ko: '힌디어 교사(여성)', th: 'ครูภาษาฮินดี (หญิง)', hi: 'हिंदी शिक्षिका' },
  'hi-in-m': { vi: 'Thầy giáo người Ấn Độ', en: 'Hindi Teacher (Male)', zh: '印地语老师（男）', ja: 'ヒンディー語教師（男性）', ko: '힌디어 교사(남성)', th: 'ครูภาษาฮินดี (ชาย)', hi: 'हिंदी शिक्षक' },
  'th-th-f': { vi: 'Cô giáo người Thái', en: 'Thai Teacher (Female)', zh: '泰语老师（女）', ja: 'タイ語教師（女性）', ko: '태국어 교사(여성)', th: 'ครูภาษาไทย (หญิง)', hi: 'थाई भाषा शिक्षिका' },
  'th-th-m': { vi: 'Thầy giáo người Thái', en: 'Thai Teacher (Male)', zh: '泰语老师（男）', ja: 'タイ語教師（男性）', ko: '태국어 교사(남성)', th: 'ครูภาษาไทย (ชาย)', hi: 'थाई भाषा शिक्षक' },
  'ja-jp-f': { vi: 'Cô giáo người Nhật', en: 'Japanese Teacher (Female)', zh: '日语老师（女）', ja: '日本語教師（女性）', ko: '일본어 교사(여성)', th: 'ครูภาษาญี่ปุ่น (หญิง)', hi: 'जापानी भाषा शिक्षिका' },
  'ja-jp-m': { vi: 'Thầy giáo người Nhật', en: 'Japanese Teacher (Male)', zh: '日语老师（男）', ja: '日本語教師（男性）', ko: '일본어 교사(남성)', th: 'ครูภาษาญี่ปุ่น (ชาย)', hi: 'जापानी भाषा शिक्षक' },
  'ko-kr-f': { vi: 'Cô giáo người Hàn', en: 'Korean Teacher (Female)', zh: '韩语老师（女）', ja: '韓国語教師（女性）', ko: '한국어 교사(여성)', th: 'ครูภาษาเกาหลี (หญิง)', hi: 'कोरियाई भाषा शिक्षिका' },
  'ko-kr-m': { vi: 'Thầy giáo người Hàn', en: 'Korean Teacher (Male)', zh: '韩语老师（男）', ja: '韓国語教師（男性）', ko: '한국어 교사(남성)', th: 'ครูภาษาเกาหลี (ชาย)', hi: 'कोरियाई भाषा शिक्षक' },
  'vi-vn-f': { vi: 'Cô giáo người Việt', en: 'Vietnamese Teacher (Female)', zh: '越南语老师（女）', ja: 'ベトナム語教師（女性）', ko: '베트남어 교사(여성)', th: 'ครูภาษาเวียดนาม (หญิง)', hi: 'वियतनामी भाषा शिक्षिका' },
  'vi-vn-m': { vi: 'Thầy giáo người Việt', en: 'Vietnamese Teacher (Male)', zh: '越南语老师（男）', ja: 'ベトナム語教師（男性）', ko: '베트남어 교사(남성)', th: 'ครูภาษาเวียดนาม (ชาย)', hi: 'वियतनामी भाषा शिक्षक' },
}

const NATIVE_LANGUAGE_CODES: NativeLanguageCode[] = ['vi', 'en', 'zh', 'hi', 'th', 'ja', 'ko']
const NATIVE_LANGUAGE_API_LABELS: Record<NativeLanguageCode, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese (Mandarin)',
  hi: 'Hindi',
  th: 'Thai',
  ja: 'Japanese',
  ko: 'Korean',
}
const NATIVE_LANGUAGE_LABELS: Record<UiLocale, Record<NativeLanguageCode, string>> = {
  vi: { vi: 'Tiếng Việt', en: 'Tiếng Anh', zh: 'Tiếng Trung', hi: 'Tiếng Hindi', th: 'Tiếng Thái', ja: 'Tiếng Nhật', ko: 'Tiếng Hàn' },
  en: { vi: 'Vietnamese', en: 'English', zh: 'Chinese (Mandarin)', hi: 'Hindi', th: 'Thai', ja: 'Japanese', ko: 'Korean' },
  zh: { vi: '越南语', en: '英语', zh: '中文（普通话）', hi: '印地语', th: '泰语', ja: '日语', ko: '韩语' },
  ja: { vi: 'ベトナム語', en: '英語', zh: '中国語（普通話）', hi: 'ヒンディー語', th: 'タイ語', ja: '日本語', ko: '韓国語' },
  ko: { vi: '베트남어', en: '영어', zh: '중국어(표준어)', hi: '힌디어', th: '태국어', ja: '일본어', ko: '한국어' },
  th: { vi: 'ภาษาเวียดนาม', en: 'อังกฤษ', zh: 'จีน (แมนดาริน)', hi: 'ฮินดี', th: 'ไทย', ja: 'ญี่ปุ่น', ko: 'เกาหลี' },
  hi: { vi: 'वियतनामी', en: 'अंग्रेज़ी', zh: 'चीनी (मंदारिन)', hi: 'हिंदी', th: 'थाई', ja: 'जापानी', ko: 'कोरियाई' },
}

const REPEAT_PROMPT_BY_LANGUAGE: Record<LanguageCode, string> = {
  en: 'Please repeat this sentence: ...',
  zh: '请重复这句话：...',
  hi: 'कृपया यह वाक्य दोहराएँ: ...',
  th: 'ช่วยพูดประโยคนี้อีกครั้ง: ...',
  ja: 'この文をもう一度言ってください：...',
  ko: '이 문장을 다시 말해 주세요: ...',
  vi: 'Vui lòng lặp lại câu này: ...',
}

const EXPLAIN_PROMPT_BY_LANGUAGE: Record<LanguageCode, string> = {
  en: 'Please explain this sentence: ...',
  zh: '请解释这句话：...',
  hi: 'कृपया इस वाक्य का अर्थ समझाएँ: ...',
  th: 'ช่วยอธิบายประโยคนี้: ...',
  ja: 'この文を説明してください：...',
  ko: '이 문장을 설명해 주세요: ...',
  vi: 'Vui lòng giải thích câu này: ...',
}

const COACH_NATIVE_UI_TEXT: Record<NativeLanguageCode, {
  setupTitle: string
  setupDesc: string
  learningLanguage: string
  nativeLanguage: string
  nativeTeacher: string
  learningMode: string
  learnerLevel: string
  lessonTopic: string
  chatTitle: string
  chatDesc: string
  fixTitle: string
  fixDesc: string
  historyTitle: string
  historyDesc: string
  inputPlaceholder: string
  customTopicPlaceholder: string
  micHintPrefix: string
  micErrorTitle: string
}> = {
  vi: {
    setupTitle: 'Thiết lập buổi học',
    setupDesc: 'Chọn kiểu giáo viên và phong cách học trước khi bắt đầu.',
    learningLanguage: 'Ngôn ngữ học',
    nativeLanguage: 'Ngôn ngữ mẹ đẻ',
    nativeTeacher: 'Giáo viên bản địa',
    learningMode: 'Chế độ học',
    learnerLevel: 'Level học sinh',
    lessonTopic: 'Chủ đề buổi học',
    chatTitle: 'Hội thoại trực tiếp',
    chatDesc: 'Nói qua mic hoặc gõ văn bản. Giáo viên sẽ phản hồi bằng giọng nói bản địa.',
    fixTitle: 'Sửa lỗi ngay',
    fixDesc: 'Giáo viên sửa lỗi sai và gợi ý phát âm để bạn nói tự nhiên hơn.',
    historyTitle: 'Ôn lại buổi học cũ',
    historyDesc: 'Lịch sử buổi học được đồng bộ để mở lại trên nhiều thiết bị.',
    inputPlaceholder: 'Viết câu vào đây...',
    customTopicPlaceholder: 'Ví dụ: Phỏng vấn xin việc ngành IT, giao tiếp ở sân bay, thuyết trình dự án...',
    micHintPrefix: 'Nếu chưa nghe rõ/chưa hiểu, hãy nói kèm câu đó theo',
    micErrorTitle: 'Mic lỗi',
  },
  en: {
    setupTitle: 'Lesson setup',
    setupDesc: 'Choose teacher style and learning mode before starting.',
    learningLanguage: 'Learning language',
    nativeLanguage: 'Native language',
    nativeTeacher: 'Native teacher',
    learningMode: 'Learning mode',
    learnerLevel: 'Learner level',
    lessonTopic: 'Lesson topic',
    chatTitle: 'Live conversation',
    chatDesc: 'Speak by mic or type text. The teacher replies with native voice.',
    fixTitle: 'Instant correction',
    fixDesc: 'Teacher corrects mistakes and gives pronunciation guidance.',
    historyTitle: 'Review previous lessons',
    historyDesc: 'Lesson history is synced so you can reopen on other devices.',
    inputPlaceholder: 'Write your sentence here...',
    customTopicPlaceholder: 'Example: IT interview, airport communication, project presentation...',
    micHintPrefix: 'If you do not hear/understand clearly, include the sentence in',
    micErrorTitle: 'Microphone error',
  },
  zh: {
    setupTitle: '课程设置',
    setupDesc: '开始前先选择教师风格和学习模式。',
    learningLanguage: '学习语言',
    nativeLanguage: '母语',
    nativeTeacher: '母语教师',
    learningMode: '学习模式',
    learnerLevel: '学习等级',
    lessonTopic: '课程主题',
    chatTitle: '实时对话',
    chatDesc: '可用麦克风说话或输入文本，教师将用母语语音回复。',
    fixTitle: '即时纠错',
    fixDesc: '教师会纠正错误并给出发音建议。',
    historyTitle: '复习历史课程',
    historyDesc: '学习记录已同步，可在多设备打开。',
    inputPlaceholder: '输入句子或点击麦克风说话...',
    customTopicPlaceholder: '例如：IT 面试、机场交流、项目演示...',
    micHintPrefix: '如果没听清/没理解，请连同句子一起说（',
    micErrorTitle: '麦克风错误',
  },
  ja: {
    setupTitle: 'レッスン設定',
    setupDesc: '開始前に先生スタイルと学習モードを選択します。',
    learningLanguage: '学習言語',
    nativeLanguage: '母語',
    nativeTeacher: 'ネイティブ教師',
    learningMode: '学習モード',
    learnerLevel: '学習レベル',
    lessonTopic: 'レッスントピック',
    chatTitle: 'ライブ会話',
    chatDesc: 'マイクまたは入力で会話。教師がネイティブ音声で返答します。',
    fixTitle: 'すぐに修正',
    fixDesc: '誤りを修正し、発音のコツを提示します。',
    historyTitle: '過去レッスンを復習',
    historyDesc: '学習履歴は同期され、他デバイスでも開けます。',
    inputPlaceholder: '文を入力、またはマイクで話してください...',
    customTopicPlaceholder: '例: IT面接、空港での会話、プロジェクト発表...',
    micHintPrefix: '聞き取れない/わからない場合は文を添えて（',
    micErrorTitle: 'マイクエラー',
  },
  ko: {
    setupTitle: '수업 설정',
    setupDesc: '시작 전에 선생님 스타일과 학습 모드를 선택하세요.',
    learningLanguage: '학습 언어',
    nativeLanguage: '모국어',
    nativeTeacher: '원어민 교사',
    learningMode: '학습 모드',
    learnerLevel: '학습 레벨',
    lessonTopic: '수업 주제',
    chatTitle: '실시간 대화',
    chatDesc: '마이크로 말하거나 텍스트 입력. 교사가 원어민 음성으로 답합니다.',
    fixTitle: '즉시 교정',
    fixDesc: '교사가 오류를 교정하고 발음 팁을 제공합니다.',
    historyTitle: '이전 수업 복습',
    historyDesc: '학습 기록이 동기화되어 다른 기기에서도 열 수 있습니다.',
    inputPlaceholder: '문장을 입력하거나 마이크로 말해보세요...',
    customTopicPlaceholder: '예: IT 면접, 공항 의사소통, 프로젝트 발표...',
    micHintPrefix: '잘 안 들리거나 이해가 안 되면 문장을 함께 말하세요(',
    micErrorTitle: '마이크 오류',
  },
  th: {
    setupTitle: 'ตั้งค่าบทเรียน',
    setupDesc: 'เลือกสไตล์ครูและโหมดการเรียนก่อนเริ่ม',
    learningLanguage: 'ภาษาเป้าหมาย',
    nativeLanguage: 'ภาษาแม่',
    nativeTeacher: 'ครูเจ้าของภาษา',
    learningMode: 'โหมดการเรียน',
    learnerLevel: 'ระดับผู้เรียน',
    lessonTopic: 'หัวข้อบทเรียน',
    chatTitle: 'สนทนาแบบสด',
    chatDesc: 'พูดผ่านไมค์หรือพิมพ์ข้อความ ครูจะตอบด้วยเสียงเจ้าของภาษา',
    fixTitle: 'แก้ไขทันที',
    fixDesc: 'ครูช่วยแก้ข้อผิดพลาดและแนะนำการออกเสียง',
    historyTitle: 'ทบทวนบทเรียนเก่า',
    historyDesc: 'ประวัติบทเรียนซิงก์ข้ามอุปกรณ์',
    inputPlaceholder: 'พิมพ์ประโยคหรือกดไมค์เพื่อพูด...',
    customTopicPlaceholder: 'ตัวอย่าง: สัมภาษณ์งาน IT, สื่อสารที่สนามบิน, พรีเซนต์โปรเจกต์...',
    micHintPrefix: 'ถ้าได้ยินไม่ชัด/ไม่เข้าใจ ให้พูดพร้อมประโยคใน',
    micErrorTitle: 'ไมค์มีปัญหา',
  },
  hi: {
    setupTitle: 'पाठ सेटअप',
    setupDesc: 'शुरू करने से पहले शिक्षक शैली और सीखने का मोड चुनें।',
    learningLanguage: 'सीखने की भाषा',
    nativeLanguage: 'मातृभाषा',
    nativeTeacher: 'मूल-भाषी शिक्षक',
    learningMode: 'सीखने का मोड',
    learnerLevel: 'सीखने का स्तर',
    lessonTopic: 'पाठ का विषय',
    chatTitle: 'लाइव बातचीत',
    chatDesc: 'माइक से बोलें या टेक्स्ट टाइप करें। शिक्षक मूल आवाज़ में जवाब देंगे।',
    fixTitle: 'तुरंत सुधार',
    fixDesc: 'शिक्षक गलतियाँ सुधारते हैं और उच्चारण सुझाव देते हैं।',
    historyTitle: 'पुराने पाठ दोहराएँ',
    historyDesc: 'पाठ इतिहास सिंक होकर कई डिवाइस पर खुलता है।',
    inputPlaceholder: 'वाक्य लिखें या माइक दबाकर बोलें...',
    customTopicPlaceholder: 'उदाहरण: IT इंटरव्यू, एयरपोर्ट बातचीत, प्रोजेक्ट प्रेज़ेंटेशन...',
    micHintPrefix: 'अगर स्पष्ट न सुनें/समझें, तो वाक्य सहित कहें (',
    micErrorTitle: 'माइक त्रुटि',
  },
}

const TOPIC_OPTIONS: TopicOption[] = [
  { id: 'solo-teacher', label: 'Solo: Hội thoại trực tiếp với thầy/cô' },
  { id: 'kids-basic', label: 'Thiếu nhi: Chào hỏi và giới thiệu bản thân' },
  { id: 'kids-school', label: 'Thiếu nhi: Ở lớp học và bạn bè' },
  { id: 'kids-family', label: 'Thiếu nhi: Gia đình và hoạt động mỗi ngày' },
  { id: 'teens-social', label: 'Tuổi teen: Trò chuyện mạng xã hội văn minh' },
  { id: 'teens-hobbies', label: 'Tuổi teen: Sở thích, game, âm nhạc, phim ảnh' },
  { id: 'teens-confidence', label: 'Tuổi teen: Tự tin thuyết trình ngắn' },
  { id: 'student-campus', label: 'Sinh viên: Giao tiếp trong trường học' },
  { id: 'student-groupwork', label: 'Sinh viên: Làm việc nhóm và thảo luận' },
  { id: 'student-study-abroad', label: 'Sinh viên: Chuẩn bị du học' },
  { id: 'job-interview', label: 'Phỏng vấn xin việc' },
  { id: 'work-meeting', label: 'Người đi làm: Họp và cập nhật công việc' },
  { id: 'work-email-speaking', label: 'Người đi làm: Giao tiếp công sở chuyên nghiệp' },
  { id: 'work-customer-support', label: 'Người đi làm: Chăm sóc khách hàng' },
  { id: 'work-negotiation', label: 'Người đi làm: Đàm phán và thương lượng' },
  { id: 'startup-pitch', label: 'Người đi làm: Pitch ý tưởng sản phẩm' },
  { id: 'coffee-shop', label: 'Gọi đồ tại quán cà phê' },
  { id: 'airport', label: 'Tình huống tại sân bay' },
  { id: 'hotel-checkin', label: 'Du lịch: Check-in khách sạn' },
  { id: 'restaurant-ordering', label: 'Du lịch: Gọi món ở nhà hàng' },
  { id: 'shopping-mall', label: 'Du lịch: Mua sắm và hỏi giá' },
  { id: 'taxi-direction', label: 'Du lịch: Đi taxi và chỉ đường' },
  { id: 'doctor-pharmacy', label: 'Du lịch: Khám bệnh, mua thuốc cơ bản' },
  { id: 'immigration-customs', label: 'Du lịch: Hải quan và nhập cảnh' },
  { id: 'store-customer-service', label: 'Nhân viên cửa hàng - chăm sóc khách' },
  { id: 'daily-hobbies', label: 'Nói về sở thích hằng ngày' },
  { id: 'daily-routine', label: 'Đời sống: Sinh hoạt hằng ngày' },
  { id: 'daily-food-health', label: 'Đời sống: Ăn uống và sức khỏe' },
  { id: 'daily-parenting', label: 'Phụ huynh: Trao đổi chuyện học của con' },
  { id: 'daily-home-neighbor', label: 'Đời sống: Hàng xóm và khu dân cư' },
  { id: 'finance-basic', label: 'Tài chính cá nhân: Chi tiêu và tiết kiệm' },
  { id: 'online-learning', label: 'Học online: Hỏi đáp và phản hồi bài học' },
  { id: 'public-speaking', label: 'Kỹ năng: Nói trước đám đông' },
  { id: 'storytelling-fun', label: 'Sáng tạo: Kể chuyện vui theo tình huống' },
  { id: 'senior-travel', label: 'Người lớn tuổi: Du lịch nhẹ nhàng' },
  { id: 'senior-health-chat', label: 'Người lớn tuổi: Trò chuyện sức khỏe thường ngày' },
  { id: 'culture-festivals', label: 'Văn hóa: Lễ hội và phong tục' },
  { id: 'news-discussion', label: 'Tin tức: Thảo luận chủ đề thời sự an toàn' },
]

const TOPIC_LABELS_EN: Record<string, string> = {
  'solo-teacher': 'Solo: Live conversation with teacher',
  'kids-basic': 'Kids: Greetings and self-introduction',
  'kids-school': 'Kids: Classroom and friends',
  'kids-family': 'Kids: Family and daily activities',
  'teens-social': 'Teens: Healthy social media conversations',
  'teens-hobbies': 'Teens: Hobbies, games, music, and movies',
  'teens-confidence': 'Teens: Build confidence in short presentations',
  'student-campus': 'Students: Communication on campus',
  'student-groupwork': 'Students: Group work and discussion',
  'student-study-abroad': 'Students: Study abroad preparation',
  'job-interview': 'Job interview practice',
  'work-meeting': 'Work: Meetings and work updates',
  'work-email-speaking': 'Work: Professional workplace communication',
  'work-customer-support': 'Work: Customer support communication',
  'work-negotiation': 'Work: Negotiation and persuasion',
  'startup-pitch': 'Work: Product idea pitch',
  'coffee-shop': 'Ordering at a coffee shop',
  'airport': 'Airport situations',
  'hotel-checkin': 'Travel: Hotel check-in',
  'restaurant-ordering': 'Travel: Ordering at restaurants',
  'shopping-mall': 'Travel: Shopping and asking prices',
  'taxi-direction': 'Travel: Taxi and directions',
  'doctor-pharmacy': 'Travel: Basic doctor and pharmacy situations',
  'immigration-customs': 'Travel: Immigration and customs',
  'store-customer-service': 'Store staff: Customer care',
  'daily-hobbies': 'Daily life: Talking about hobbies',
  'daily-routine': 'Daily life: Daily routines',
  'daily-food-health': 'Daily life: Food and health',
  'daily-parenting': 'Parenting: Talking about children learning',
  'daily-home-neighbor': 'Daily life: Neighborhood conversations',
  'finance-basic': 'Personal finance: Spending and saving',
  'online-learning': 'Online learning: Q&A and lesson feedback',
  'public-speaking': 'Skills: Public speaking',
  'storytelling-fun': 'Creative: Fun situational storytelling',
  'senior-travel': 'Seniors: Gentle travel conversations',
  'senior-health-chat': 'Seniors: Daily health conversations',
  'culture-festivals': 'Culture: Festivals and customs',
  'news-discussion': 'News: Safe current-affairs discussion',
}

const TOPIC_LABELS_BY_LOCALE: Record<UiLocale, Record<string, string>> = {
  vi: {},
  en: TOPIC_LABELS_EN,
  zh: {
    'solo-teacher': '单人模式：与老师实时对话',
    'kids-basic': '儿童：问候与自我介绍',
    'kids-school': '儿童：课堂与朋友',
    'kids-family': '儿童：家庭与日常活动',
    'teens-social': '青少年：健康社交媒体对话',
    'teens-hobbies': '青少年：兴趣、游戏、音乐和电影',
    'teens-confidence': '青少年：提升简短演讲自信',
    'student-campus': '学生：校园沟通',
    'student-groupwork': '学生：小组合作与讨论',
    'student-study-abroad': '学生：留学准备',
    'job-interview': '求职面试练习',
    'work-meeting': '职场：会议与工作更新',
    'work-email-speaking': '职场：专业沟通表达',
    'work-customer-support': '职场：客户支持沟通',
    'work-negotiation': '职场：谈判与说服',
    'startup-pitch': '职场：产品想法路演',
    'coffee-shop': '咖啡店点单',
    'airport': '机场场景',
    'hotel-checkin': '旅行：酒店入住',
    'restaurant-ordering': '旅行：餐厅点餐',
    'shopping-mall': '旅行：购物与询价',
    'taxi-direction': '旅行：打车与问路',
    'doctor-pharmacy': '旅行：基础就医与药店场景',
    'immigration-customs': '旅行：入境与海关',
    'store-customer-service': '门店员工：客户服务',
    'daily-hobbies': '日常：聊兴趣爱好',
    'daily-routine': '日常：日常作息',
    'daily-food-health': '日常：饮食与健康',
    'daily-parenting': '育儿：孩子学习交流',
    'daily-home-neighbor': '日常：邻里交流',
    'finance-basic': '个人财务：消费与储蓄',
    'online-learning': '在线学习：问答与课程反馈',
    'public-speaking': '技能：公众演讲',
    'storytelling-fun': '创意：趣味情景故事',
    'senior-travel': '长者：轻松旅行对话',
    'senior-health-chat': '长者：日常健康交流',
    'culture-festivals': '文化：节日与习俗',
    'news-discussion': '新闻：安全时事讨论',
  },
  ja: {
    'solo-teacher': 'ソロ：先生とライブ会話',
    'kids-basic': '子ども：あいさつと自己紹介',
    'kids-school': '子ども：教室と友だち',
    'kids-family': '子ども：家族と日常活動',
    'teens-social': 'ティーン：健全なSNS会話',
    'teens-hobbies': 'ティーン：趣味・ゲーム・音楽・映画',
    'teens-confidence': 'ティーン：短い発表の自信をつける',
    'student-campus': '学生：キャンパスでのコミュニケーション',
    'student-groupwork': '学生：グループワークと議論',
    'student-study-abroad': '学生：留学準備',
    'job-interview': '就職面接の練習',
    'work-meeting': '仕事：会議と業務報告',
    'work-email-speaking': '仕事：職場での丁寧なコミュニケーション',
    'work-customer-support': '仕事：カスタマーサポート会話',
    'work-negotiation': '仕事：交渉と説得',
    'startup-pitch': '仕事：プロダクト提案ピッチ',
    'coffee-shop': 'カフェでの注文',
    'airport': '空港での場面',
    'hotel-checkin': '旅行：ホテルチェックイン',
    'restaurant-ordering': '旅行：レストランで注文',
    'shopping-mall': '旅行：買い物と価格確認',
    'taxi-direction': '旅行：タクシーと道案内',
    'doctor-pharmacy': '旅行：病院・薬局の基本場面',
    'immigration-customs': '旅行：入国審査と税関',
    'store-customer-service': '店舗スタッフ：接客対応',
    'daily-hobbies': '日常：趣味について話す',
    'daily-routine': '日常：毎日のルーティン',
    'daily-food-health': '日常：食事と健康',
    'daily-parenting': '子育て：子どもの学習について話す',
    'daily-home-neighbor': '日常：近所との会話',
    'finance-basic': '個人家計：支出と貯蓄',
    'online-learning': 'オンライン学習：Q&Aと授業フィードバック',
    'public-speaking': 'スキル：人前で話す',
    'storytelling-fun': '創造：楽しいシチュエーション物語',
    'senior-travel': 'シニア：ゆったり旅行会話',
    'senior-health-chat': 'シニア：日常の健康会話',
    'culture-festivals': '文化：祭りと習慣',
    'news-discussion': 'ニュース：安全な時事ディスカッション',
  },
  ko: {
    'solo-teacher': '솔로: 선생님과 실시간 대화',
    'kids-basic': '어린이: 인사와 자기소개',
    'kids-school': '어린이: 교실과 친구',
    'kids-family': '어린이: 가족과 일상 활동',
    'teens-social': '청소년: 건강한 SNS 대화',
    'teens-hobbies': '청소년: 취미, 게임, 음악, 영화',
    'teens-confidence': '청소년: 짧은 발표 자신감 키우기',
    'student-campus': '학생: 캠퍼스 커뮤니케이션',
    'student-groupwork': '학생: 팀 과제와 토론',
    'student-study-abroad': '학생: 유학 준비',
    'job-interview': '취업 면접 연습',
    'work-meeting': '직장: 회의와 업무 업데이트',
    'work-email-speaking': '직장: 전문적인 커뮤니케이션',
    'work-customer-support': '직장: 고객 지원 대화',
    'work-negotiation': '직장: 협상과 설득',
    'startup-pitch': '직장: 제품 아이디어 피치',
    'coffee-shop': '카페에서 주문하기',
    'airport': '공항 상황',
    'hotel-checkin': '여행: 호텔 체크인',
    'restaurant-ordering': '여행: 식당 주문',
    'shopping-mall': '여행: 쇼핑과 가격 묻기',
    'taxi-direction': '여행: 택시와 길 안내',
    'doctor-pharmacy': '여행: 병원·약국 기본 상황',
    'immigration-customs': '여행: 입국심사와 세관',
    'store-customer-service': '매장 직원: 고객 응대',
    'daily-hobbies': '일상: 취미 이야기',
    'daily-routine': '일상: 하루 루틴',
    'daily-food-health': '일상: 음식과 건강',
    'daily-parenting': '양육: 자녀 학습 대화',
    'daily-home-neighbor': '일상: 이웃과 대화',
    'finance-basic': '개인 재정: 지출과 저축',
    'online-learning': '온라인 학습: 질의응답과 수업 피드백',
    'public-speaking': '스킬: 대중 앞 말하기',
    'storytelling-fun': '창의: 상황별 재미있는 스토리텔링',
    'senior-travel': '시니어: 편안한 여행 대화',
    'senior-health-chat': '시니어: 일상 건강 대화',
    'culture-festivals': '문화: 축제와 관습',
    'news-discussion': '뉴스: 안전한 시사 토론',
  },
  th: {
    'solo-teacher': 'เดี่ยว: สนทนาสดกับครู',
    'kids-basic': 'เด็ก: ทักทายและแนะนำตัว',
    'kids-school': 'เด็ก: ห้องเรียนและเพื่อน',
    'kids-family': 'เด็ก: ครอบครัวและกิจกรรมประจำวัน',
    'teens-social': 'วัยรุ่น: คุยโซเชียลอย่างสร้างสรรค์',
    'teens-hobbies': 'วัยรุ่น: งานอดิเรก เกม เพลง และภาพยนตร์',
    'teens-confidence': 'วัยรุ่น: เสริมความมั่นใจในการพูดสั้น ๆ',
    'student-campus': 'นักศึกษา: การสื่อสารในมหาวิทยาลัย',
    'student-groupwork': 'นักศึกษา: งานกลุ่มและการอภิปราย',
    'student-study-abroad': 'นักศึกษา: เตรียมตัวเรียนต่อต่างประเทศ',
    'job-interview': 'ฝึกสัมภาษณ์งาน',
    'work-meeting': 'งาน: ประชุมและอัปเดตงาน',
    'work-email-speaking': 'งาน: การสื่อสารเชิงมืออาชีพในที่ทำงาน',
    'work-customer-support': 'งาน: การสื่อสารงานบริการลูกค้า',
    'work-negotiation': 'งาน: การเจรจาและโน้มน้าว',
    'startup-pitch': 'งาน: พิชชิ่งไอเดียโปรดักต์',
    'coffee-shop': 'สั่งเครื่องดื่มที่ร้านกาแฟ',
    'airport': 'สถานการณ์ที่สนามบิน',
    'hotel-checkin': 'ท่องเที่ยว: เช็กอินโรงแรม',
    'restaurant-ordering': 'ท่องเที่ยว: สั่งอาหารที่ร้าน',
    'shopping-mall': 'ท่องเที่ยว: ช้อปปิ้งและถามราคา',
    'taxi-direction': 'ท่องเที่ยว: เรียกแท็กซี่และถามทาง',
    'doctor-pharmacy': 'ท่องเที่ยว: สถานการณ์พื้นฐานที่คลินิก/ร้านยา',
    'immigration-customs': 'ท่องเที่ยว: ตม. และศุลกากร',
    'store-customer-service': 'พนักงานร้านค้า: ดูแลลูกค้า',
    'daily-hobbies': 'ชีวิตประจำวัน: พูดคุยเรื่องงานอดิเรก',
    'daily-routine': 'ชีวิตประจำวัน: กิจวัตรประจำวัน',
    'daily-food-health': 'ชีวิตประจำวัน: อาหารและสุขภาพ',
    'daily-parenting': 'ผู้ปกครอง: คุยเรื่องการเรียนของลูก',
    'daily-home-neighbor': 'ชีวิตประจำวัน: เพื่อนบ้านและชุมชน',
    'finance-basic': 'การเงินส่วนบุคคล: ใช้จ่ายและออมเงิน',
    'online-learning': 'เรียนออนไลน์: Q&A และฟีดแบ็กบทเรียน',
    'public-speaking': 'ทักษะ: พูดต่อหน้าสาธารณะ',
    'storytelling-fun': 'สร้างสรรค์: เล่าเรื่องสนุกตามสถานการณ์',
    'senior-travel': 'ผู้สูงอายุ: บทสนทนาเดินทางแบบสบาย ๆ',
    'senior-health-chat': 'ผู้สูงอายุ: สนทนาสุขภาพประจำวัน',
    'culture-festivals': 'วัฒนธรรม: เทศกาลและธรรมเนียม',
    'news-discussion': 'ข่าวสาร: ถกประเด็นปัจจุบันอย่างปลอดภัย',
  },
  hi: {
    'solo-teacher': 'सोलो: शिक्षक के साथ लाइव बातचीत',
    'kids-basic': 'बच्चे: अभिवादन और परिचय',
    'kids-school': 'बच्चे: कक्षा और दोस्त',
    'kids-family': 'बच्चे: परिवार और दैनिक गतिविधियाँ',
    'teens-social': 'किशोर: स्वस्थ सोशल मीडिया वार्तालाप',
    'teens-hobbies': 'किशोर: शौक, गेम, संगीत और फिल्में',
    'teens-confidence': 'किशोर: छोटे प्रेज़ेंटेशन में आत्मविश्वास',
    'student-campus': 'छात्र: कैंपस संचार',
    'student-groupwork': 'छात्र: समूह कार्य और चर्चा',
    'student-study-abroad': 'छात्र: विदेश अध्ययन की तैयारी',
    'job-interview': 'नौकरी इंटरव्यू अभ्यास',
    'work-meeting': 'कार्य: मीटिंग और कार्य अपडेट',
    'work-email-speaking': 'कार्य: पेशेवर कार्यस्थल संचार',
    'work-customer-support': 'कार्य: ग्राहक सहायता संवाद',
    'work-negotiation': 'कार्य: बातचीत और मनाना',
    'startup-pitch': 'कार्य: प्रोडक्ट आइडिया पिच',
    'coffee-shop': 'कैफे में ऑर्डर करना',
    'airport': 'एयरपोर्ट स्थितियाँ',
    'hotel-checkin': 'यात्रा: होटल चेक-इन',
    'restaurant-ordering': 'यात्रा: रेस्टोरेंट में ऑर्डर',
    'shopping-mall': 'यात्रा: खरीदारी और कीमत पूछना',
    'taxi-direction': 'यात्रा: टैक्सी और दिशा पूछना',
    'doctor-pharmacy': 'यात्रा: डॉक्टर/फार्मेसी की बुनियादी स्थितियाँ',
    'immigration-customs': 'यात्रा: इमिग्रेशन और कस्टम्स',
    'store-customer-service': 'स्टोर स्टाफ: ग्राहक सेवा',
    'daily-hobbies': 'दैनिक जीवन: शौक पर बातचीत',
    'daily-routine': 'दैनिक जीवन: रोज़मर्रा की दिनचर्या',
    'daily-food-health': 'दैनिक जीवन: भोजन और स्वास्थ्य',
    'daily-parenting': 'पालन-पोषण: बच्चों की पढ़ाई पर बात',
    'daily-home-neighbor': 'दैनिक जीवन: पड़ोस की बातचीत',
    'finance-basic': 'व्यक्तिगत वित्त: खर्च और बचत',
    'online-learning': 'ऑनलाइन लर्निंग: प्रश्नोत्तर और पाठ प्रतिक्रिया',
    'public-speaking': 'कौशल: सार्वजनिक भाषण',
    'storytelling-fun': 'रचनात्मक: मजेदार परिस्थिति-आधारित कहानी',
    'senior-travel': 'वरिष्ठ: सहज यात्रा वार्तालाप',
    'senior-health-chat': 'वरिष्ठ: दैनिक स्वास्थ्य वार्तालाप',
    'culture-festivals': 'संस्कृति: त्योहार और परंपराएँ',
    'news-discussion': 'समाचार: सुरक्षित समसामयिक चर्चा',
  },
}

const TOPIC_DIFFICULTY_BY_ID: Record<string, TopicDifficultyTag> = {
  'solo-teacher': 'adaptive',
  'kids-basic': 'basic',
  'kids-school': 'basic',
  'kids-family': 'basic',
  'teens-social': 'basic',
  'teens-hobbies': 'basic',
  'teens-confidence': 'intermediate',
  'student-campus': 'basic',
  'student-groupwork': 'intermediate',
  'student-study-abroad': 'intermediate',
  'job-interview': 'intermediate',
  'work-meeting': 'intermediate',
  'work-email-speaking': 'intermediate',
  'work-customer-support': 'intermediate',
  'work-negotiation': 'advanced',
  'startup-pitch': 'advanced',
  'coffee-shop': 'basic',
  'airport': 'basic',
  'hotel-checkin': 'basic',
  'restaurant-ordering': 'basic',
  'shopping-mall': 'basic',
  'taxi-direction': 'basic',
  'doctor-pharmacy': 'intermediate',
  'immigration-customs': 'intermediate',
  'store-customer-service': 'intermediate',
  'daily-hobbies': 'basic',
  'daily-routine': 'basic',
  'daily-food-health': 'basic',
  'daily-parenting': 'intermediate',
  'daily-home-neighbor': 'basic',
  'finance-basic': 'intermediate',
  'online-learning': 'basic',
  'public-speaking': 'advanced',
  'storytelling-fun': 'intermediate',
  'senior-travel': 'basic',
  'senior-health-chat': 'basic',
  'culture-festivals': 'intermediate',
  'news-discussion': 'advanced',
}

function resolveTopicDifficulty(base: TopicDifficultyTag, learnerLevel: LearnerLevel): TopicDifficulty {
  if (base === 'adaptive') {
    if (learnerLevel <= 1) return 'basic'
    if (learnerLevel <= 3) return 'intermediate'
    return 'advanced'
  }
  if (learnerLevel === 0) return 'basic'
  if (learnerLevel === 1) return base === 'advanced' ? 'intermediate' : base
  if (learnerLevel === 2) return base
  if (learnerLevel === 3) return base === 'basic' ? 'intermediate' : base
  return base === 'basic' ? 'intermediate' : 'advanced'
}

function isTopicFitForLevel(base: TopicDifficultyTag, learnerLevel: LearnerLevel): boolean {
  if (base === 'adaptive') return true
  if (learnerLevel === 0) return base === 'basic'
  if (learnerLevel === 1) return base === 'basic'
  if (learnerLevel === 2) return base === 'basic' || base === 'intermediate'
  if (learnerLevel === 3) return base === 'intermediate' || base === 'advanced'
  return base === 'advanced'
}

const GOAL_OPTION_KEYS: GoalType[] = ['communication', 'job', 'travel', 'exam']

const GOAL_OPTION_LABELS: Record<UiLocale, Record<GoalType, string>> = {
  vi: {
    communication: 'Giao tiếp tự tin hằng ngày',
    job: 'Phỏng vấn và môi trường công việc',
    travel: 'Du lịch và tình huống dịch vụ',
    exam: 'Luyện phản xạ chuẩn cho thi cử',
  },
  en: {
    communication: 'Confident daily communication',
    job: 'Interview and workplace communication',
    travel: 'Travel and service situations',
    exam: 'Quick response practice for exams',
  },
  zh: {
    communication: '日常自信交流',
    job: '面试与职场沟通',
    travel: '旅行与服务场景',
    exam: '考试反应训练',
  },
  ja: {
    communication: '日常で自信を持って会話',
    job: '面接と職場コミュニケーション',
    travel: '旅行とサービス場面',
    exam: '試験向け反応トレーニング',
  },
  ko: {
    communication: '일상 자신감 회화',
    job: '면접 및 직장 커뮤니케이션',
    travel: '여행 및 서비스 상황',
    exam: '시험 대비 반응 훈련',
  },
  th: {
    communication: 'สื่อสารประจำวันอย่างมั่นใจ',
    job: 'สัมภาษณ์งานและการสื่อสารในที่ทำงาน',
    travel: 'สถานการณ์ท่องเที่ยวและบริการ',
    exam: 'ฝึกตอบสนองเพื่อการสอบ',
  },
  hi: {
    communication: 'दैनिक आत्मविश्वासी संवाद',
    job: 'इंटरव्यू और कार्यस्थल संचार',
    travel: 'यात्रा और सेवा स्थितियाँ',
    exam: 'परीक्षा हेतु त्वरित प्रतिक्रिया अभ्यास',
  },
}

const LOCAL_TEXT_TRANSLATIONS: Record<string, Partial<Record<UiLocale, string>>> = {
  "Today's progress dashboard": {
    zh: '今日学习进度面板',
    ja: '本日の学習ダッシュボード',
    ko: '오늘의 학습 대시보드',
    th: 'แดชบอร์ดความคืบหน้าวันนี้',
    hi: 'आज की प्रगति डैशबोर्ड',
  },
  "Today's mission:": {
    zh: '今日任务：',
    ja: '今日のミッション：',
    ko: '오늘의 미션:',
    th: 'ภารกิจวันนี้:',
    hi: 'आज का मिशन:',
  },
  'Teacher': {
    zh: '教师',
    ja: '先生',
    ko: '선생님',
    th: 'ครู',
    hi: 'शिक्षक',
  },
  'Student': {
    zh: '学员',
    ja: '学習者',
    ko: '학습자',
    th: 'ผู้เรียน',
    hi: 'शिक्षार्थी',
  },
  'Selected teacher:': {
    zh: '所选教师：',
    ja: '選択中の教師：',
    ko: '선택된 선생님:',
    th: 'ครูที่เลือก:',
    hi: 'चुनी गई शिक्षक:',
  },
  'Play word pronunciation': {
    zh: '播放单词读音',
    ja: '単語の発音を再生',
    ko: '단어 발음 재생',
    th: 'เล่นเสียงคำนี้',
    hi: 'शब्द का उच्चारण चलाएँ',
  },
  'Listen word:': {
    zh: '听读音：',
    ja: '単語を聞く：',
    ko: '발음 듣기:',
    th: 'ฟังคำ:',
    hi: 'शब्द सुनें:',
  },
  'Start lesson': {
    zh: '开始学习',
    ja: 'レッスン開始',
    ko: '수업 시작',
    th: 'เริ่มบทเรียน',
    hi: 'पाठ शुरू करें',
  },
  'New lesson': {
    zh: '新课时',
    ja: '新しいレッスン',
    ko: '새 수업',
    th: 'บทเรียนใหม่',
    hi: 'नया पाठ',
  },
  'Send': {
    zh: '发送',
    ja: '送信',
    ko: '전송',
    th: 'ส่ง',
    hi: 'भेजें',
  },
  'Speak': {
    zh: '开始说话',
    ja: '話す',
    ko: '말하기 시작',
    th: 'เริ่มพูด',
    hi: 'बोलना शुरू करें',
  },
  'Stop mic': {
    zh: '停止麦克风',
    ja: 'マイクを停止',
    ko: '마이크 중지',
    th: 'หยุดไมโครโฟน',
    hi: 'माइक बंद करें',
  },
  'or': {
    zh: '或',
    ja: 'または',
    ko: '또는',
    th: 'หรือ',
    hi: 'या',
  },
  'Required new-word practice': {
    zh: '必修新词练习',
    ja: '必須の新出単語練習',
    ko: '필수 새 단어 연습',
    th: 'แบบฝึกคำศัพท์ใหม่ที่ต้องทำ',
    hi: 'अनिवार्य नए शब्द का अभ्यास',
  },
  'Listen and type the word correctly 3 times, then choose the correct meaning each round.': {
    zh: '先把单词听并正确输入 3 次，然后每轮选择正确释义。',
    ja: '単語を3回正しく聞いて入力し、その後各ラウンドで正しい意味を選びます。',
    ko: '단어를 3번 정확히 듣고 입력한 뒤, 각 라운드에서 올바른 뜻을 선택하세요.',
    th: 'ฟังและพิมพ์คำให้ถูกต้อง 3 ครั้ง จากนั้นเลือกความหมายที่ถูกต้องในแต่ละรอบ',
    hi: 'शब्द को 3 बार सही सुनकर टाइप करें, फिर हर राउंड में सही अर्थ चुनें।',
  },
  'Current word:': {
    zh: '当前练习词：',
    ja: '現在の練習単語：',
    ko: '현재 연습 단어:',
    th: 'คำที่กำลังฝึก:',
    hi: 'वर्तमान शब्द:',
  },
  'You are doing great! Complete 3/3 and you can continue right away.': {
    zh: '你做得很好！完成 3/3 后即可立即继续学习。',
    ja: 'とても順調です！3/3 を完了するとすぐに学習を続けられます。',
    ko: '아주 잘하고 있어요! 3/3을 완료하면 바로 학습을 계속할 수 있어요.',
    th: 'คุณทำได้ดีมาก! ทำครบ 3/3 แล้วจะไปต่อได้ทันที',
    hi: 'आप बहुत अच्छा कर रहे हैं! 3/3 पूरा होते ही आप तुरंत आगे बढ़ सकते हैं।',
  },
  'Progress:': {
    zh: '进度：',
    ja: '進捗：',
    ko: '진행도:',
    th: 'ความคืบหน้า:',
    hi: 'प्रगति:',
  },
  'Replay new word': {
    zh: '重听新词',
    ja: '新出単語をもう一度聞く',
    ko: '새 단어 다시 듣기',
    th: 'ฟังคำใหม่อีกครั้ง',
    hi: 'नया शब्द फिर से सुनें',
  },
  'Type the exact word:': {
    zh: '请准确输入该单词：',
    ja: '単語を正確に入力してください：',
    ko: '정확한 단어를 입력하세요:',
    th: 'พิมพ์คำให้ตรงตามนี้:',
    hi: 'शब्द को बिल्कुल सही टाइप करें:',
  },
  'Type the new word...': {
    zh: '请输入新词...',
    ja: '新しい単語を入力...',
    ko: '새 단어를 입력하세요...',
    th: 'พิมพ์คำใหม่...',
    hi: 'नया शब्द टाइप करें...',
  },
  'Choose the correct meaning:': {
    zh: '请选择正确释义：',
    ja: '正しい意味を選択してください：',
    ko: '올바른 의미를 선택하세요:',
    th: 'เลือกความหมายที่ถูกต้อง:',
    hi: 'सही अर्थ चुनें:',
  },
  'Play opening sentence': {
    zh: '播放开场句',
    ja: '冒頭文を再生',
    ko: '시작 문장 듣기',
    th: 'เล่นประโยคเปิด',
    hi: 'शुरुआती वाक्य सुनें',
  },
  'Translate opening line': {
    zh: '翻译开场句',
    ja: '冒頭文を翻訳',
    ko: '시작 문장 번역',
    th: 'แปลประโยคเปิด',
    hi: 'शुरुआती वाक्य का अनुवाद',
  },
  'Hide opening translation': {
    zh: '隐藏开场翻译',
    ja: '冒頭文の翻訳を閉じる',
    ko: '시작 문장 번역 숨기기',
    th: 'ซ่อนการแปลประโยคเปิด',
    hi: 'शुरुआती अनुवाद छिपाएं',
  },
}

const TEACHERS_BY_LANGUAGE: Record<LanguageCode, TeacherProfile[]> = {
  en: [
    {
      id: 'en-us-f',
      label: 'Cô giáo người Mỹ (US)',
      languageLabel: 'English',
      locale: 'en-US',
      voiceName: 'Puck',
      accent: 'us',
      gender: 'female',
    },
    {
      id: 'en-us-m',
      label: 'Thầy giáo người Mỹ (US)',
      languageLabel: 'English',
      locale: 'en-US',
      voiceName: 'Orus',
      accent: 'us',
      gender: 'male',
    },
    {
      id: 'en-uk-f',
      label: 'Cô giáo người Anh (UK)',
      languageLabel: 'English',
      locale: 'en-GB',
      voiceName: 'Kore',
      accent: 'uk',
      gender: 'female',
    },
    {
      id: 'en-uk-m',
      label: 'Thầy giáo người Anh (UK)',
      languageLabel: 'English',
      locale: 'en-GB',
      voiceName: 'Fenrir',
      accent: 'uk',
      gender: 'male',
    },
  ],
  zh: [
    {
      id: 'zh-cn-f',
      label: 'Cô giáo người Trung Quốc',
      languageLabel: 'Chinese (Mandarin)',
      locale: 'zh-CN',
      voiceName: 'Kore',
      gender: 'female',
    },
    {
      id: 'zh-cn-m',
      label: 'Thầy giáo người Trung Quốc',
      languageLabel: 'Chinese (Mandarin)',
      locale: 'zh-CN',
      voiceName: 'Orus',
      gender: 'male',
    },
  ],
  hi: [
    {
      id: 'hi-in-f',
      label: 'Cô giáo người Ấn Độ',
      languageLabel: 'Hindi',
      locale: 'hi-IN',
      voiceName: 'Autonoe',
      gender: 'female',
    },
    {
      id: 'hi-in-m',
      label: 'Thầy giáo người Ấn Độ',
      languageLabel: 'Hindi',
      locale: 'hi-IN',
      voiceName: 'Iapetus',
      gender: 'male',
    },
  ],
  th: [
    {
      id: 'th-th-f',
      label: 'Cô giáo người Thái',
      languageLabel: 'Thai',
      locale: 'th-TH',
      voiceName: 'Puck',
      gender: 'female',
    },
    {
      id: 'th-th-m',
      label: 'Thầy giáo người Thái',
      languageLabel: 'Thai',
      locale: 'th-TH',
      voiceName: 'Orus',
      gender: 'male',
    },
  ],
  ja: [
    {
      id: 'ja-jp-f',
      label: 'Cô giáo người Nhật',
      languageLabel: 'Japanese',
      locale: 'ja-JP',
      voiceName: 'Kore',
      gender: 'female',
    },
    {
      id: 'ja-jp-m',
      label: 'Thầy giáo người Nhật',
      languageLabel: 'Japanese',
      locale: 'ja-JP',
      voiceName: 'Fenrir',
      gender: 'male',
    },
  ],
  ko: [
    {
      id: 'ko-kr-f',
      label: 'Cô giáo người Hàn',
      languageLabel: 'Korean',
      locale: 'ko-KR',
      voiceName: 'Puck',
      gender: 'female',
    },
    {
      id: 'ko-kr-m',
      label: 'Thầy giáo người Hàn',
      languageLabel: 'Korean',
      locale: 'ko-KR',
      voiceName: 'Orus',
      gender: 'male',
    },
  ],
  vi: [
    {
      id: 'vi-vn-f',
      label: 'Cô giáo người Việt',
      languageLabel: 'Vietnamese',
      locale: 'vi-VN',
      voiceName: 'Autonoe',
      gender: 'female',
    },
    {
      id: 'vi-vn-m',
      label: 'Thầy giáo người Việt',
      languageLabel: 'Vietnamese',
      locale: 'vi-VN',
      voiceName: 'Orus',
      gender: 'male',
    },
  ],
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function pcm16MonoToWavBlob(pcm: Uint8Array, sampleRate = 24000): Blob {
  const channels = 1
  const bitsPerSample = 16
  const blockAlign = channels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, 44).set(pcm)

  return new Blob([buffer], { type: 'audio/wav' })
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function detectNativeLanguageFromBrowser(): NativeLanguageCode {
  if (typeof navigator === 'undefined') return 'vi'
  const locale = String(navigator.language || '').toLowerCase()
  if (locale.startsWith('vi')) return 'vi'
  if (locale.startsWith('en')) return 'en'
  if (locale.startsWith('zh')) return 'zh'
  if (locale.startsWith('hi')) return 'hi'
  if (locale.startsWith('th')) return 'th'
  if (locale.startsWith('ja')) return 'ja'
  if (locale.startsWith('ko')) return 'ko'
  return 'vi'
}

function getWebLocaleFromCookie(): UiLocale | null {
  if (typeof document === 'undefined') return null
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (!cookieValue) return null
  if (cookieValue === 'vi' || cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') {
    return cookieValue
  }
  return null
}

function getLocalDateString(): string {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

function toStorageSafeToken(input: string): string {
  const normalized = String(input || '').trim().normalize('NFKD')
  const ascii = normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  if (ascii) return ascii.slice(0, 40)

  const codepointHex = Array.from(normalized)
    .map((char) => (char.codePointAt(0) || 0).toString(16))
    .join('')
  return (codepointHex || 'token').slice(0, 40)
}

function sanitizeWordMeaningItems(input: unknown): Array<{ text: string; pinyin?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      text: String((row as { text?: unknown })?.text || '').trim(),
      pinyin: String((row as { pinyin?: unknown })?.pinyin || '').trim(),
    }))
    .filter((row) => row.text)
    .slice(0, 8)
}

function sanitizeWordExampleItems(input: unknown): Array<{ targetText: string; targetPinyin?: string; nativeText: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      targetText: String((row as { targetText?: unknown })?.targetText || '').trim(),
      targetPinyin: String((row as { targetPinyin?: unknown })?.targetPinyin || '').trim(),
      nativeText: String((row as { nativeText?: unknown })?.nativeText || '').trim(),
    }))
    .filter((row) => row.targetText && row.nativeText)
    .slice(0, 6)
}

function sanitizeWordSenses(input: unknown): Array<{ gloss: string; exampleTarget: string; exampleNative: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      gloss: String((row as { gloss?: unknown })?.gloss || '').trim(),
      exampleTarget: String((row as { exampleTarget?: unknown })?.exampleTarget || '').trim(),
      exampleNative: String((row as { exampleNative?: unknown })?.exampleNative || '').trim(),
    }))
    .filter((row) => row.gloss || (row.exampleTarget && row.exampleNative))
    .slice(0, 5)
}

function normalizeWordUsageLevel(input: unknown): 'high' | 'medium' | 'low' {
  const normalized = String(input || '').trim().toLowerCase()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized
  return 'medium'
}

function normalizeWordImportanceScore(input: unknown): number {
  const n = Number(input)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

function normalizeWordContextSensitive(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  const normalized = String(input || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

/** Từ mới hiển thị chữ đầu viết hoa (e.g. conversation → Conversation) */
function capitalizeWordForDisplay(word: string): string {
  const s = String(word || '').trim()
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildWordInsightFromAny(data: {
  meaning?: unknown
  pronunciation?: unknown
  exampleTarget?: unknown
  exampleNative?: unknown
  senses?: unknown
  meaningItems?: unknown
  exampleItems?: unknown
  usageLevel?: unknown
  importanceScore?: unknown
  contextSensitive?: unknown
}): WordInsight {
  const meaning = String(data.meaning || '').trim()
  const pronunciation = String(data.pronunciation || '').trim()
  const exampleTarget = String(data.exampleTarget || '').trim()
  const exampleNative = String(data.exampleNative || '').trim()
  const sensesRaw = sanitizeWordSenses(data.senses)
  const exampleItemsRaw = sanitizeWordExampleItems(data.exampleItems)
  const senseExamples = sensesRaw
    .map((s) => ({
      targetText: String(s.exampleTarget || '').trim(),
      targetPinyin: '',
      nativeText: String(s.exampleNative || '').trim(),
    }))
    .filter((s) => s.targetText && s.nativeText)
  return {
    meaning,
    pronunciation,
    exampleTarget,
    exampleNative,
    senses: sensesRaw,
    usageLevel: normalizeWordUsageLevel(data.usageLevel),
    importanceScore: normalizeWordImportanceScore(data.importanceScore),
    contextSensitive: normalizeWordContextSensitive(data.contextSensitive),
    meaningItems: [],
    exampleItems: exampleItemsRaw.length > 0
      ? exampleItemsRaw
      : senseExamples.length > 0
        ? senseExamples
      : (exampleTarget && exampleNative
          ? [{ targetText: exampleTarget, targetPinyin: pronunciation || undefined, nativeText: exampleNative }]
          : []),
  }
}

function extractTargetSentenceForTokenization(text: string): string {
  const stripTrailingBilingualSections = (input: string) => {
    const markers = [
      'Dịch nhanh',
      'Giải thích',
      'Câu tự nhiên',
      'Câu chuẩn',
      'Câu hoàn chỉnh',
      'Natural sentence',
      'Correct sentence',
      'Quick translation',
      'Explanation',
      'Translation',
    ]
    let out = input.trim()
    for (const marker of markers) {
      const idx = out.toLowerCase().indexOf(marker.toLowerCase())
      if (idx > 0) {
        out = out.slice(0, idx).trim()
      }
    }
    return out.replace(/[\s:：-]+$/g, '').trim()
  }

  const patterns = [
    /Nên nói\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Better\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu hoàn chỉnh\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu tự nhiên\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu chuẩn\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu (hoàn chỉnh|tự nhiên|chuẩn)\s*(là)?\s*[:：]\s*([^\n]+)/i,
    /(Natural sentence|Correct sentence)\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = stripTrailingBilingualSections(
      String(match?.[3] || match?.[2] || match?.[1] || '')
    )
      .replace(/^\*+|\*+$/g, '')
      .trim()
    if (candidate) return candidate
  }
  return ''
}

function extractTeacherSpeechText(text: string): string {
  // Read the full teacher answer instead of only first line/short snippet.
  return String(text || '').trim()
}

function sanitizeLearnerReadingSentence(text: string): string {
  return String(text || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function personalizeLearnerNameInSentence(
  sentence: string,
  learnerDisplayName: string,
  targetLanguageCode: LanguageCode
): string {
  const base = sanitizeLearnerReadingSentence(sentence)
  const learnerName = String(learnerDisplayName || '').trim()
  if (!base || !learnerName) return base
  if (new RegExp(`\\b${escapeRegExp(learnerName)}\\b`, 'i').test(base)) return base

  let next = base
  if (targetLanguageCode === 'en') {
    // Covers: "my name is X", "my name's X", and typo variant "my name X".
    next = next.replace(/\b(my name(?:\s+is|'s)?\s+)([^,.!?;\n]+)/i, `$1${learnerName}`)
    // Covers: "I'm X", "I am X" when X is likely a proper name.
    next = next.replace(
      /\b(i am|i'm)\s+([A-ZÀ-ỹ][\wÀ-ỹ'.-]*(?:\s+[A-ZÀ-ỹ][\wÀ-ỹ'.-]*){0,2})(?=[,.!?;]|$)/i,
      `$1 ${learnerName}`
    )
  } else if (targetLanguageCode === 'vi') {
    next = next.replace(
      /\b(tên\s+(?:tôi|mình|em|anh|chị)\s+là\s+)([^,.!?;\n]+)/i,
      `$1${learnerName}`
    )
  }
  return sanitizeLearnerReadingSentence(next)
}

/** Chế độ phản xạ: chỉ lấy câu tiếng cần học cho TTS, bỏ phần dịch nghĩa (Câu của bạn nói đúng là: ..., Dịch nhanh, v.v.). */
function extractTargetLanguageOnlyForReflexTts(text: string, targetLanguageCode: string): string {
  let s = String(text || '').trim()
  if (!s) return s
  // Bỏ phần Dịch nhanh / Quick translation / Pinyin – chỉ giữ nội dung chính
  const translationMarkers = [
    /\n\s*(?:Dịch nhanh|Quick translation|แปลเร็ว|クイック訳|빠른 번역|快速翻译|त्वरित अनुवाद)\s*\([^)]+\)\s*[:：]?\s*[\s\S]*/i,
    /\n\s*Pinyin\s*[:：]\s*[\s\S]*/i,
  ]
  for (const re of translationMarkers) {
    s = s.replace(re, '').trim()
  }
  // Bỏ tiền tố "Câu của bạn nói đúng là: " / "Your correct sentence is: "
  s = s.replace(/^Câu của bạn nói đúng là\s*[:：]?\s*/i, '').trim()
  s = s.replace(/^Your correct sentence is\s*[:：]?\s*/i, '').trim()
  s = s.replace(/^Your sentence is correct\s*[:：]?\s*/i, '').trim()
  // Bỏ "[Vietnamese] tiếng Anh nói là: " / "[...] nói là: "
  s = s.replace(/^.+?tiếng\s+Anh\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?tiếng\s+Trung\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?tiếng\s+Nhật\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?tiếng\s+Hàn\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?tiếng\s+Thái\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?tiếng\s+Hindi\s+nói\s+là\s*[:：]\s*/i, '').trim()
  s = s.replace(/^.+?nói\s+là\s*[:：]\s*/i, '').trim()
  return s.trim()
}

/** Kiểm tra văn bản đã chứa pinyin/phiên âm (từ AI) thì không cần hiển thị thêm. */
function hasEmbeddedPinyin(text: string): boolean {
  const s = String(text || '').trim()
  if (!s) return false
  return (
    /\bPinyin\s*:/i.test(s) ||
    /\bPhiên âm\s*(Latin)?\s*:/i.test(s) ||
    /\bRomaji\s*:/i.test(s) ||
    /\bRomanization\s*:/i.test(s)
  )
}

/** Bỏ phần pinyin trong ngoặc (Wǒ xǐhuān Hànyǔ) hoặc （...）. Dùng trước khi cắt câu. */
function stripPinyinInParentheses(text: string): string {
  return String(text || '')
    .trim()
    .replace(/\s*[（(][^）)]*[A-Za-z\u00C0-\u024F\u0100-\u017F][^）)]*[）)]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bỏ phiên âm Latin (pinyin, romaji, v.v.) trước khi gửi TTS – tránh đọc 2 lần. Áp dụng đa ngôn ngữ. */
function stripPhoneticForTts(text: string, targetCode: LanguageCode): string {
  const s = String(text || '').trim()
  if (!s) return s
  if (targetCode === 'en' || targetCode === 'vi') return s
  let result = stripPinyinInParentheses(s)
  const hasNonLatin = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/u.test(result)
  if (!hasNonLatin) return result
  result = result.replace(/^[A-Za-z\u00C0-\u024F\u0100-\u017F][A-Za-z\u00C0-\u024F\u0100-\u017F\s,.!?;:'"\-]*\s*/u, '')
  result = result.replace(/\s+[A-Za-z\u00C0-\u024F\u0100-\u017F][A-Za-z\u00C0-\u024F\u0100-\u017F\s,.!?;:'"\-]*/gu, ' ')
  return result.replace(/\s+/g, ' ').trim()
}

/** Bỏ phiên âm + thêm chấm câu nếu thiếu. Dùng cho hiển thị Ý 2, Ý 3 (giống nhau). */
function sanitizeForDisplay(text: string, targetCode: LanguageCode): string {
  return sanitizeSentenceForCopy(stripPhoneticForTts(text, targetCode), targetCode)
}

function sanitizeIdeaContent(text: string): string {
  const raw = String(text || '').trim()
  if (!raw) return ''
  return raw
    .replace(/^\s*(Ý|Y)\s*[123]\s*[-:]\s*/i, '')
    .replace(/^\s*Idea\s*[123]\s*[-:]\s*/i, '')
    .replace(/^\s*(Bạn nói|You said)\s*[:：]\s*/i, '')
    .trim()
}

function composeTeacherMessageText(correctionNote: string, mainSentence: string, intentAnswer: string): string {
  return [correctionNote, mainSentence, intentAnswer]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Tách văn bản thành các đoạn ngắn theo dấu chấm câu (。？.?!！). Dùng cho copyTargets bài viết mini. */
function splitBySentencePunctuation(text: string): string[] {
  const s = stripPinyinInParentheses(text)
  if (!s) return []
  const segments = s.split(/([。？.?!！]+)/u)
  const result: string[] = []
  let buf = ''
  for (let i = 0; i < segments.length; i++) {
    buf += segments[i]
    if (/[。？.?!！]/u.test(segments[i])) {
      const t = buf.trim()
      if (t) result.push(t)
      buf = ''
    }
  }
  if (buf.trim()) result.push(buf.trim())
  return result
}

/** Lấy đoạn đầu tiên (đến dấu chấm câu đầu: 。？.?!！). Đã bỏ pinyin trong ngoặc. */
function takeFirstSentenceOnly(text: string): string {
  const segments = splitBySentencePunctuation(text)
  return segments[0] || stripPinyinInParentheses(String(text || '').trim())
}

function normalizeCopyText(text: string, targetCode?: LanguageCode): string {
  const base = String(text || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (targetCode === 'zh' || targetCode === 'ja' || targetCode === 'ko' || targetCode === 'th' || targetCode === 'hi') {
    return base.replace(/\s+/g, '')
  }
  return base
}

function pickAsciiPunctuation(cluster: string): string {
  if (cluster.includes('?')) return '?'
  if (cluster.includes('!')) return '!'
  if (cluster.includes('.')) return '.'
  if (cluster.includes(',')) return ','
  if (cluster.includes(';')) return ';'
  if (cluster.includes(':')) return ':'
  return ''
}

function pickCjkPunctuation(cluster: string): string {
  if (cluster.includes('？')) return '？'
  if (cluster.includes('！')) return '！'
  if (cluster.includes('。')) return '。'
  if (cluster.includes('，')) return '，'
  if (cluster.includes('；')) return '；'
  if (cluster.includes('：')) return '：'
  if (cluster.includes('、')) return '、'
  return ''
}

function sanitizeRomanizedText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,.;:!?]{2,}/g, (m) => pickAsciiPunctuation(m))
    .replace(/([,.;:!?])([A-Za-z\u00C0-\u024F])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeSentenceForCopy(text: string, targetCode: LanguageCode): string {
  const raw = String(text || '').trim()
  if (!raw) return ''
  if (targetCode !== 'zh' && targetCode !== 'ja' && targetCode !== 'ko' && targetCode !== 'th' && targetCode !== 'hi') {
    return sanitizeRomanizedText(raw)
  }

  const hasTargetScript =
    targetCode === 'zh'
      ? /[\u4E00-\u9FFF]/u.test(raw)
      : targetCode === 'ja'
        ? /[\u3040-\u30FF\u4E00-\u9FFF]/u.test(raw)
        : targetCode === 'ko'
          ? /[\uAC00-\uD7AF]/u.test(raw)
          : targetCode === 'th'
            ? /[\u0E00-\u0E7F]/u.test(raw)
            : targetCode === 'hi'
              ? /[\u0900-\u097F]/u.test(raw)
              : false
  if (!hasTargetScript) return raw

  const stripped = stripPinyinInParentheses(raw)
  const withoutLatin = stripped
    .replace(/[A-Za-z\u00C0-\u024F]+/g, ' ')
    .replace(/,/g, '，')
    .replace(/\./g, '。')
    .replace(/\?/g, '？')
    .replace(/!/g, '！')
    .replace(/;/g, '；')
    .replace(/:/g, '：')
    .replace(/\s+([，。！？、；：,.!?])/g, '$1')
    .replace(/([，。！？、；：、]){2,}/g, (m) => pickCjkPunctuation(m))
    .replace(/([，。！？、；：、])\s+([\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F])/g, '$1$2')
    .replace(/^[\s)\](\}）】」』》〉、，。！？；：:;,.!?'"`-]+/u, '')
    .replace(/([\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F])\s+([\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F])/g, '$1$2')
    .replace(/^[，。！？、；：]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const result = withoutLatin || stripped
  if (targetCode === 'zh' && result && !/[。？！.?!]$/u.test(result)) {
    return result + '。'
  }
  return result
}

function buildWordContextSnippet(sentence: string, word: string): string {
  const text = String(sentence || '').trim()
  const needle = String(word || '').trim()
  if (!text || !needle) return text

  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const idx = lowerText.indexOf(lowerNeedle)
  if (idx < 0) return text.slice(0, 260)

  const start = Math.max(0, idx - 100)
  const end = Math.min(text.length, idx + needle.length + 100)
  return text.slice(start, end).trim()
}

function isTokenInTargetLanguage(token: string, targetCode: LanguageCode): boolean {
  const t = token.trim()
  if (!t) return false
  if (targetCode === 'en') return /^[A-Za-z][A-Za-z'’-]*$/.test(t)
  if (targetCode === 'vi') return /[a-zA-Z\u00C0-\u024F]/u.test(t)
  if (targetCode === 'zh') return /[\u4E00-\u9FFF]/u.test(t)
  if (targetCode === 'ja') return /[\u3040-\u30FF\u4E00-\u9FFF]/u.test(t)
  if (targetCode === 'ko') return /[\uAC00-\uD7AF]/u.test(t)
  if (targetCode === 'th') return /[\u0E00-\u0E7F]/u.test(t)
  if (targetCode === 'hi') return /[\u0900-\u097F]/u.test(t)
  return true
}

function isSentenceInTargetLanguage(text: string, targetCode: LanguageCode): boolean {
  const source = String(text || '').trim()
  if (!source) return false
  if (targetCode === 'zh') return /[\u4E00-\u9FFF]/u.test(source)
  if (targetCode === 'ja') return /[\u3040-\u30FF\u4E00-\u9FFF]/u.test(source)
  if (targetCode === 'ko') return /[\uAC00-\uD7AF]/u.test(source)
  if (targetCode === 'th') return /[\u0E00-\u0E7F]/u.test(source)
  if (targetCode === 'hi') return /[\u0900-\u097F]/u.test(source)

  const words = source
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (words.length === 0) return false
  const targetWords = words.filter((w) => isTokenInTargetLanguage(w, targetCode)).length
  const ratio = targetWords / words.length
  return ratio >= 0.8
}

function normalizedToken(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function displayListeningWord(text: string): string {
  const t = String(text || '').trim()
  if (!t) return ''
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}

function shuffleListeningWords(words: string[]): string[] {
  const out = [...words]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function ensureListeningVisibleHasCorrectOption(
  visible: string[],
  remaining: string[],
  allOptions: string[],
  expectedKeywords: string[]
): { visible: string[]; remaining: string[] } {
  const expected = new Set(
    expectedKeywords
      .map((x) => normalizedToken(x))
      .filter(Boolean)
  )
  const visibleSafe = visible.map((x) => String(x || '').trim()).filter(Boolean)
  const remainingSafe = remaining.map((x) => String(x || '').trim()).filter(Boolean)
  const allSafe = allOptions.map((x) => String(x || '').trim()).filter(Boolean)
  if (expected.size === 0 || visibleSafe.length === 0) return { visible: visibleSafe, remaining: remainingSafe }

  const isExpected = (x: string) => expected.has(normalizedToken(x))
  const uniquePush = (arr: string[], value: string) => {
    const t = String(value || '').trim()
    if (!t) return
    if (!arr.includes(t)) arr.push(t)
  }

  const expectedPool = Array.from(
    new Set(
      [...remainingSafe, ...allSafe]
        .map((x) => String(x || '').trim())
        .filter((x) => isExpected(x))
    )
  )
  const wrongPool = Array.from(
    new Set(
      [...remainingSafe, ...allSafe]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .filter((x) => !isExpected(x))
    )
  )

  let nextVisible = [...visibleSafe]
  let currentCorrect = nextVisible.filter((x) => isExpected(x)).length

  // Rule 1: always keep at least 1 correct option visible.
  if (currentCorrect < 1 && expectedPool.length > 0) {
    const replacement = expectedPool.find((x) => !nextVisible.includes(x)) || expectedPool[0]
    const replaceIdx = nextVisible.findIndex((x) => !isExpected(x))
    if (replaceIdx >= 0) nextVisible[replaceIdx] = replacement
    else nextVisible[nextVisible.length - 1] = replacement
    currentCorrect = nextVisible.filter((x) => isExpected(x)).length
  }

  // Rule 2: keep exactly 1 correct option visible at a time.
  if (currentCorrect > 1) {
    for (let i = 0; i < nextVisible.length; i++) {
      if (currentCorrect <= 1) break
      if (!isExpected(nextVisible[i])) continue
      const replacement = wrongPool.find((x) => !nextVisible.includes(x))
      if (!replacement) break
      nextVisible[i] = replacement
      currentCorrect = nextVisible.filter((x) => isExpected(x)).length
    }
  }

  // Keep visible size stable and rebuild remaining without duplicates.
  const finalVisible: string[] = []
  for (const x of nextVisible) uniquePush(finalVisible, x)
  const nextRemaining: string[] = []
  for (const x of [...remainingSafe, ...allSafe]) {
    const t = String(x || '').trim()
    if (!t || finalVisible.includes(t)) continue
    uniquePush(nextRemaining, t)
  }

  return { visible: finalVisible, remaining: nextRemaining }
}

type HocTiengAnhAiClientPageProps = {
  pageMode?: 'live' | 'saved'
}

export default function HocTiengAnhAiClientPage({ pageMode = 'live' }: HocTiengAnhAiClientPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isSavedStandalonePage = pageMode === 'saved'
  const { toast } = useToast()
  const [sessionId, setSessionId] = useState<string>(createSessionId)
  const [languageCode, setLanguageCode] = useState<LanguageCode>('en')
  const [nativeLanguageCode, setNativeLanguageCode] = useState<NativeLanguageCode>('vi')
  const [teacherId, setTeacherId] = useState<string>('en-us-f')
  const [sessionTeacher, setSessionTeacher] = useState<TeacherProfile | null>(null)
  const [speakingLanguageMode] = useState<SpeakingLanguageMode>('auto')
  const [startingLesson, setStartingLesson] = useState(false)
  const [quickStartBusy, setQuickStartBusy] = useState(false)
  const [quickStartStage, setQuickStartStage] = useState<QuickStartStage>('idle')
  const [quickStartModalOpen, setQuickStartModalOpen] = useState(false)
  const [setupCollapsed, setSetupCollapsed] = useState(true)
  const [compactMode, setCompactMode] = useState(false)
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel>(0)
  const [topicId, setTopicId] = useState<string>(TOPIC_OPTIONS[0].id)
  const [pendingTopicId, setPendingTopicId] = useState<string>(TOPIC_OPTIONS[0].id)
  const [confirmedTopicId, setConfirmedTopicId] = useState('')
  const [topicFilterMode, setTopicFilterMode] = useState<TopicFilterMode>('fit')
  const [topicSourceMode, setTopicSourceMode] = useState<TopicSourceMode>('builtin')
  const [customTopicDraft, setCustomTopicDraft] = useState('')
  const [customTopics, setCustomTopics] = useState<CustomTopicItem[]>([])
  const [customTopicBusy, setCustomTopicBusy] = useState(false)
  const [learnerDisplayName, setLearnerDisplayName] = useState('')
  const [learnerProfilePromptOpen, setLearnerProfilePromptOpen] = useState(false)
  const [learnerProfileBusy, setLearnerProfileBusy] = useState(false)
  const [learnerProfileNameDraft, setLearnerProfileNameDraft] = useState('')
  const [learnerProfileJobDraft, setLearnerProfileJobDraft] = useState('')
  const [learnerProfileCityDraft, setLearnerProfileCityDraft] = useState('')
  const [learnerProfileAgeDraft, setLearnerProfileAgeDraft] = useState('')
  const [learnerProfileGenderDraft, setLearnerProfileGenderDraft] = useState('')
  const [topicCurriculum, setTopicCurriculum] = useState<TopicCurriculum | null>(null)
  const [hasCurriculumReady, setHasCurriculumReady] = useState(false)
  const [topicBusy, setTopicBusy] = useState(false)
  const [goalType, setGoalType] = useState<GoalType>('communication')
  const [goalBusy, setGoalBusy] = useState(false)
  const [activeGoal, setActiveGoal] = useState<LearningGoal | null>(null)
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressSnapshot | null>(null)
  const [dueReviewCount, setDueReviewCount] = useState(0)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewBusy, setReviewBusy] = useState(false)
  const [levelRecommendation, setLevelRecommendation] = useState<LevelRecommendation | null>(null)
  const [placementSamples, setPlacementSamples] = useState<string[]>(['', '', ''])
  const [placementBusy, setPlacementBusy] = useState(false)
  const [placementResult, setPlacementResult] = useState<PlacementQuickResult | null>(null)
  const [assessmentBusy, setAssessmentBusy] = useState(false)
  const [assessmentBaseline, setAssessmentBaseline] = useState<AssessmentItem | null>(null)
  const [assessmentCheckpoint, setAssessmentCheckpoint] = useState<AssessmentItem | null>(null)
  const [assessmentDeltaOverall, setAssessmentDeltaOverall] = useState<number | null>(null)
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot | null>(null)
  const [learningBadges, setLearningBadges] = useState<string[]>([])
  const [reviewFocusWords, setReviewFocusWords] = useState<string[]>([])
  const [reviewFocusNote, setReviewFocusNote] = useState('')
  const [showPreLessonReview, setShowPreLessonReview] = useState(false)
  const [preLessonWords, setPreLessonWords] = useState<TodayWordItem[]>([])
  const [preLessonPassed, setPreLessonPassed] = useState(false)
  const [preLessonCurriculum, setPreLessonCurriculum] = useState<TopicCurriculum | null>(null)
  const [preLessonTopic, setPreLessonTopic] = useState<TopicOption | null>(null)
  const [lessonStartChoiceOpen, setLessonStartChoiceOpen] = useState(false)
  const [lessonStartChoiceBusy, setLessonStartChoiceBusy] = useState(false)
  const [lessonStartPresetAvailable, setLessonStartPresetAvailable] = useState(true)
  const [lessonStartPlan, setLessonStartPlan] = useState<{ curriculum: TopicCurriculum | null; topic: TopicOption } | null>(null)
  const [matchedSessionChoiceOpen, setMatchedSessionChoiceOpen] = useState(false)
  const [matchedSessionChoiceBusy, setMatchedSessionChoiceBusy] = useState(false)
  const [matchedSessionPlan, setMatchedSessionPlan] = useState<{ curriculum: TopicCurriculum | null; topic: TopicOption } | null>(null)
  const [matchedHistorySessions, setMatchedHistorySessions] = useState<HistorySession[]>([])
  const [preLessonExerciseIndex, setPreLessonExerciseIndex] = useState(0)
  const [preLessonWordIndex, setPreLessonWordIndex] = useState(0)
  const [preLessonResults, setPreLessonResults] = useState<Record<string, { cloze: boolean; listen: boolean; recall: boolean }>>({})
  const [preLessonRetryWords, setPreLessonRetryWords] = useState<TodayWordItem[] | null>(null)
  const [preLessonInput, setPreLessonInput] = useState('')
  const [preLessonRecallDirection, setPreLessonRecallDirection] = useState<'word' | 'meaning'>('word')
  const [preLessonContinueBusy, setPreLessonContinueBusy] = useState(false)
  const [learningMode, setLearningMode] = useState<LearningMode>('review')

  const onPreLessonClozeSubmit = useCallback(
    (word: string, correct: boolean) => {
      if (!correct) {
        const words = preLessonRetryWords ?? preLessonWords
        const item = words.find((w) => w.word === word)
        if (item?.targetLanguage) {
          void rescheduleReviewWords({ words: [{ word, targetLanguage: item.targetLanguage }] })
        }
      }
      setPreLessonResults((prev) => ({
        ...prev,
        [word]: { ...prev[word], cloze: correct, listen: prev[word]?.listen ?? false, recall: prev[word]?.recall ?? false },
      }))
      setPreLessonInput('')
      if (preLessonWordIndex < (preLessonRetryWords ?? preLessonWords).length - 1) {
        setPreLessonWordIndex((i) => i + 1)
      } else {
        setPreLessonWordIndex(0)
        setPreLessonExerciseIndex(1)
      }
    },
    [preLessonWordIndex, preLessonRetryWords, preLessonWords]
  )

  const onPreLessonListenSubmit = useCallback(
    (word: string, correct: boolean) => {
      if (!correct) {
        const words = preLessonRetryWords ?? preLessonWords
        const item = words.find((w) => w.word === word)
        if (item?.targetLanguage) {
          void rescheduleReviewWords({ words: [{ word, targetLanguage: item.targetLanguage }] })
        }
      }
      setPreLessonResults((prev) => ({
        ...prev,
        [word]: { ...prev[word], cloze: prev[word]?.cloze ?? false, listen: correct, recall: prev[word]?.recall ?? false },
      }))
      setPreLessonInput('')
      if (preLessonWordIndex < (preLessonRetryWords ?? preLessonWords).length - 1) {
        setPreLessonWordIndex((i) => i + 1)
      } else {
        setPreLessonWordIndex(0)
        setPreLessonExerciseIndex(2)
      }
    },
    [preLessonWordIndex, preLessonRetryWords, preLessonWords]
  )

  const [mode, setMode] = useState<Mode>('chat')
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('detailed')
  const [writingTask, setWritingTask] = useState<WritingTask | null>(null)
  const [writingDraft, setWritingDraft] = useState('')
  const [writingBusy, setWritingBusy] = useState(false)
  const [writingEvalResult, setWritingEvalResult] = useState<WritingEvalResult | null>(null)
  const [writingInputStatus, setWritingInputStatus] = useState<'idle' | 'partial' | 'incorrect' | 'matched'>('idle')
  const [writingRomanizationByKey, setWritingRomanizationByKey] = useState<Record<string, string>>({})
  const [writingRomanizationBusyByKey, setWritingRomanizationBusyByKey] = useState<Record<string, boolean>>({})
  const [listening, setListening] = useState(false)
  const [recordingPending, setRecordingPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [awaitingTeacherReply, setAwaitingTeacherReply] = useState(false)
  const [reviewDrillStage, setReviewDrillStage] = useState<'idle' | 'writing' | 'speaking' | 'listening'>('idle')
  const [reviewSpeakingTargetSentence, setReviewSpeakingTargetSentence] = useState('')
  const [speakingDrillPhase, setSpeakingDrillPhase] = useState<'idle' | 'playing' | 'recording' | 'afterRecord'>('idle')
  const [speakingDrillCycleCount, setSpeakingDrillCycleCount] = useState(0)
  const [speakingDrillBlob, setSpeakingDrillBlob] = useState<Blob | null>(null)
  const [reviewListeningPopupOpen, setReviewListeningPopupOpen] = useState(false)
  const [reviewListeningPrompt, setReviewListeningPrompt] = useState('')
  const [reviewListeningOptions, setReviewListeningOptions] = useState<string[]>([])
  const [reviewListeningSelected, setReviewListeningSelected] = useState<string[]>([])
  const [reviewListeningVisibleOptions, setReviewListeningVisibleOptions] = useState<string[]>([])
  const [reviewListeningRemainingOptions, setReviewListeningRemainingOptions] = useState<string[]>([])
  const [reviewListeningExpectedKeywords, setReviewListeningExpectedKeywords] = useState<string[]>([])
  const [reviewListeningRequiredCount, setReviewListeningRequiredCount] = useState(3)
  const [reviewListeningResultByWord, setReviewListeningResultByWord] = useState<Record<string, 'correct' | 'wrong'>>({})
  const [reviewListeningSubmitBusy, setReviewListeningSubmitBusy] = useState(false)
  const [reviewMiniPackCompleted, setReviewMiniPackCompleted] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [todayWordsBusy, setTodayWordsBusy] = useState(false)
  const [wordBusyKey, setWordBusyKey] = useState('')
  const wordAnalyzingKeysRef = useRef<Set<string>>(new Set())
  const wordPlayingRef = useRef<Set<string>>(new Set())
  const textSnippetPlayingRef = useRef<Set<string>>(new Set())
  const [openedHistorySessionId, setOpenedHistorySessionId] = useState('')
  const [isCurrentPresetSession, setIsCurrentPresetSession] = useState(false)
  const [presetReplayExpectedSentence, setPresetReplayExpectedSentence] = useState('')
  const isPresetPageSession = isSavedStandalonePage && isCurrentPresetSession
  const [liveSessionExtraTurnUnlocks, setLiveSessionExtraTurnUnlocks] = useState(0)
  const [liveUnlockBusy, setLiveUnlockBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [correctionsByMessageId, setCorrectionsByMessageId] = useState<Record<string, Correction[]>>({})
  const [pronunciationTips, setPronunciationTips] = useState<string[]>([])
  const [latestPronunciationScore, setLatestPronunciationScore] = useState<number | null>(null)
  const [latestWeakWords, setLatestWeakWords] = useState<string[]>([])
  const [latestPronunciationBreakdown, setLatestPronunciationBreakdown] = useState<{
    accuracy: number | null
    fluency: number | null
    prosody: number | null
  }>({ accuracy: null, fluency: null, prosody: null })
  const [latestWordScores, setLatestWordScores] = useState<Array<{ word: string; score: number; issueType: string }>>([])
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [learnedHistorySessions, setLearnedHistorySessions] = useState<HistorySession[]>([])
  const [teacherAudioByMessageId, setTeacherAudioByMessageId] = useState<Record<string, string>>({})
  const [ttsLoadingByKey, setTtsLoadingByKey] = useState<Record<string, boolean>>({})
  const [todayWords, setTodayWords] = useState<TodayWordItem[]>([])
  const [wordPractice, setWordPractice] = useState<WordPracticeProgress | null>(null)
  const [practiceInputStatus, setPracticeInputStatus] = useState<'idle' | 'partial' | 'correct' | 'incorrect'>('idle')
  const [sessionEntryStudentTurnBaseline, setSessionEntryStudentTurnBaseline] = useState(0)
  const liveSessionStudentTurnCount = useMemo(
    () => messages.filter((m) => m.role === 'student').length,
    [messages]
  )
  const liveSessionTurnLimit = LIVE_SESSION_BASE_TURN_LIMIT + liveSessionExtraTurnUnlocks * LIVE_SESSION_EXTRA_TURN_STEP
  const liveSessionTurnLimitReached =
    !isPresetPageSession
    && liveSessionStudentTurnCount >= liveSessionTurnLimit

  useEffect(() => {
    if (!wordPractice || wordPractice.unlocked) return
    // Lock active practice flow: block Escape so learner cannot dismiss by keyboard shortcuts.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [wordPractice])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 639px)').matches) {
      setCompactMode(true)
    }
  }, [])

  const onWordPracticeCorrect = (targetWord: string) => {
    const normalizedTarget = normalizeWordPracticeText(targetWord)
    setWordPractice((prev) => {
      if (!prev || prev.normalizedTarget !== normalizedTarget || prev.unlocked) return prev
      
      const expectedMeaning = String(prev.expectedMeaning || '').trim()
      const options = buildMeaningOptions(expectedMeaning)
      
      if (options.length > 0) {
        // Nếu có phần chọn nghĩa, chuyển sang trạng thái chờ chọn nghĩa
        return {
          ...prev,
          draft: '', // Xóa input sau khi gõ đúng chữ
          feedback: localText('Đúng chữ rồi! Chọn nghĩa đúng để tính 1 lượt.', 'Word is correct! Choose the correct meaning to count this round.'),
          awaitingMeaningChoice: true,
          meaningOptions: options,
        }
      } else {
        // Nếu không có phần chọn nghĩa, tính là đúng luôn
        const nextCorrectCount = prev.correctCount + 1
        const unlocked = nextCorrectCount >= 3

        // Tự động chuyển câu hỏi
        if (unlocked) {
          setTimeout(() => {
            setWordPractice(null) // Đóng bài luyện tập từ hiện tại
          }, 1500)
        } else {
          // Nếu chưa đủ 3 lần, có thể thêm logic chuyển sang từ khác nếu muốn
        }

        return {
          ...prev,
          attemptsTotal: prev.attemptsTotal + 1,
          correctCount: nextCorrectCount,
          unlocked,
          feedback: unlocked
            ? localText('Đã hoàn thành 3/3. Tự động chuyển...', 'Completed 3/3. Moving on...')
            : localText(`Đúng rồi! Hiện tại ${nextCorrectCount}/3.`, `Correct! Current progress ${nextCorrectCount}/3.`),
          awaitingMeaningChoice: false,
          meaningOptions: [],
          draft: '',
        }
      }
    })
  }

  useEffect(() => {
    if (!wordPractice || wordPractice.awaitingMeaningChoice) {
      setPracticeInputStatus('idle')
      return
    }

    const normalizedDraft = normalizeWordPracticeText(wordPractice.draft)
    if (!normalizedDraft) {
      setPracticeInputStatus('idle')
      return
    }

    if (normalizedDraft === wordPractice.normalizedTarget) {
      setPracticeInputStatus('correct')
      setTimeout(() => {
        onWordPracticeCorrect(wordPractice.targetWord)
        setPracticeInputStatus('idle')
      }, 300) // Đợi 300ms để người dùng thấy màu xanh
    } else if (wordPractice.normalizedTarget.startsWith(normalizedDraft)) {
      // Đúng nhưng chưa đủ → màu dễ chịu, không đỏ
      setPracticeInputStatus('partial')
    } else {
      setPracticeInputStatus('incorrect')
    }
  }, [wordPractice])

  const [wordInsightByKey, setWordInsightByKey] = useState<Record<string, WordInsight>>({})
  const [openedWordKey, setOpenedWordKey] = useState('')
  const [tokensByMessageId, setTokensByMessageId] = useState<Record<string, string[]>>({})
  const [tokensWithUsageByMessageId, setTokensWithUsageByMessageId] = useState<
    Record<string, Array<{ word: string; usageLevel: 'high' | 'medium' | 'low' }>>
  >({})
  const [tokenizingByMessageId, setTokenizingByMessageId] = useState<Record<string, boolean>>({})
  const [mainSentenceByMessageId, setMainSentenceByMessageId] = useState<Record<string, string>>({})
  const [correctionNoteByMessageId, setCorrectionNoteByMessageId] = useState<Record<string, string>>({})
  const [intentAnswerByMessageId, setIntentAnswerByMessageId] = useState<Record<string, string>>({})
  const [studentAudioByMessageId, setStudentAudioByMessageId] = useState<Record<string, string>>({})
  const [teacherSpeakTextByMessageId, setTeacherSpeakTextByMessageId] = useState<Record<string, string>>({})
  const [intentExplainByMessageId, setIntentExplainByMessageId] = useState<Record<string, string>>({})
  const [intentExplainBusyByMessageId, setIntentExplainBusyByMessageId] = useState<Record<string, boolean>>({})
  const [mainSentenceExplainByMessageId, setMainSentenceExplainByMessageId] = useState<Record<string, string>>({})
  const [mainSentenceExplainBusyByMessageId, setMainSentenceExplainBusyByMessageId] = useState<Record<string, boolean>>({})
  const [openingTranslateByMessageId, setOpeningTranslateByMessageId] = useState<Record<string, string>>({})
  const [openingTranslateBusyByMessageId, setOpeningTranslateBusyByMessageId] = useState<Record<string, boolean>>({})
  const supabase = useMemo(() => createClient(), [])
  const lastMicSentTextRef = useRef('')
  const lastMicSentAtRef = useRef(0)
  const routeOpenSessionHandledRef = useRef('')
  const loadHistoryRequestSeqRef = useRef(0)
  const crossPageStartHandledRef = useRef('')
  const sessionNavLockUntilRef = useRef(0)
  const writingAutoAdvanceSignatureRef = useRef('')
  const shouldCountNewSessionRef = useRef(true)
  const mixedRecorderRef = useRef<MediaRecorder | null>(null)
  const mixedChunksRef = useRef<BlobPart[]>([])
  const pendingRecordingBlobRef = useRef<Blob | null>(null)
  const recordingMimeTypeRef = useRef<string>('')
  const micStreamRef = useRef<MediaStream | null>(null)
  const micSilenceStopTimerRef = useRef<number | null>(null)
  const micMaxDurationTimerRef = useRef<number | null>(null)
  const autoStoppingMicRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<Promise<void>>(Promise.resolve())
  const playbackSpeedRef = useRef(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const activeLessonRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const speakActionsRef = useRef<HTMLDivElement | null>(null)
  const writingTaskRef = useRef<HTMLDivElement | null>(null)
  const miniSpeakingBlockRef = useRef<HTMLDivElement | null>(null)
  const miniListeningBlockRef = useRef<HTMLDivElement | null>(null)
  const recordingForDrillRef = useRef(false)
  const onDrillRecordingCompleteRef = useRef<((blob: Blob) => void) | null>(null)
  const writingInputRef = useRef<HTMLInputElement | null>(null)
  const wasMiniWritingBlockedRef = useRef(false)
  const teacherAudioByMessageIdRef = useRef<Record<string, string>>({})
  const studentAudioByMessageIdRef = useRef<Record<string, string>>({})
  const wordSenseAudioByKeyRef = useRef<Record<string, string>>({})
  const wordSenseAutoPlayedByKeyRef = useRef<Record<string, true>>({})
  const persistedMessageIdsRef = useRef<Record<string, true>>({})
  const createdAudioUrlsRef = useRef<string[]>([])
  const lastAutoScrollTokenMessageIdRef = useRef('')
  const lessonCompletedToastShownForSessionRef = useRef<string | null>(null)
  const lessonAutoSnapshotBusyRef = useRef(false)
  const lessonAutoSnapshotMessageCountBySessionRef = useRef<Record<string, number>>({})
  const miniStageSyncKeyRef = useRef('')
  const latestMiniStageRef = useRef<MiniStage>('idle')
  const uiLocale: UiLocale = nativeLanguageCode
  const t = useMemo(() => createCoachTranslator(uiLocale), [uiLocale])
  const localText = useCallback((vi: string, en: string) => {
    if (uiLocale === 'vi') return vi
    const translated = t(en)
    if (translated !== en) return translated
    return LOCAL_TEXT_TRANSLATIONS[en]?.[uiLocale] || en
  }, [t, uiLocale])
  const supportsLatinTransliteration = languageCode === 'zh' || languageCode === 'ja' || languageCode === 'ko' || languageCode === 'th' || languageCode === 'hi'
  const isCjkTargetLanguage = (tl: string | undefined) => /chinese|zh|mandarin|japanese|ja|korean|ko|thai|th|hindi|hi/i.test(String(tl || ''))
  const targetLangToCode = (tl: string | undefined): 'zh' | 'ja' | 'ko' | 'th' | 'hi' | '' => {
    const s = String(tl || '').toLowerCase()
    if (/chinese|zh|mandarin/.test(s)) return 'zh'
    if (/japanese|ja/.test(s)) return 'ja'
    if (/korean|ko/.test(s)) return 'ko'
    if (/thai|th/.test(s)) return 'th'
    if (/hindi|hi/.test(s)) return 'hi'
    return ''
  }
  /** Ngôn ngữ gốc của từ – lấy từ targetLanguage trong DB. Ôn bài cũ không dùng ngôn ngữ phiên học. */
  const targetLangToLanguageCode = (tl: string | undefined, word?: string): LanguageCode => {
    const s = String(tl || '').toLowerCase()
    if (/chinese|zh|mandarin/.test(s)) return 'zh'
    if (/japanese|ja/.test(s)) return 'ja'
    if (/korean|ko/.test(s)) return 'ko'
    if (/thai|th/.test(s)) return 'th'
    if (/hindi|hi/.test(s)) return 'hi'
    if (/english|en/.test(s)) return 'en'
    if (/vietnamese|vi/.test(s)) return 'vi'
    if (word) {
      const w = String(word).trim()
      if (/[\u3040-\u30FF]/.test(w)) return 'ja'
      if (/[\uAC00-\uD7AF]/.test(w)) return 'ko'
      if (/[\u4E00-\u9FFF]/.test(w)) return 'zh'
      if (/[\u0E00-\u0E7F]/.test(w)) return 'th'
      if (/[\u0900-\u097F]/.test(w)) return 'hi'
    }
    return languageCode
  }
  const toWritingRomanizationKey = (text: string, lang?: string) => {
    const code = (lang ? targetLangToCode(lang) : '') || languageCode
    return `${code}::${String(text || '').trim()}`
  }

  const requestTransliteration = async (text: string, langCode?: string) => {
    const code = langCode || languageCode
    if (code !== 'zh' && code !== 'ja' && code !== 'ko' && code !== 'th' && code !== 'hi') return ''
    const sourceText = String(text || '').trim()
    if (!sourceText) return ''
    try {
      const { ok, data } = await transliterateText({ text: sourceText, languageCode: code })
      if (!ok) return ''
      return sanitizeRomanizedText(String(data.transliteration || '').trim())
    } catch {
      return ''
    }
  }

  const ensureWritingRomanization = async (text: string, targetLang?: string) => {
    const code = targetLang ? targetLangToCode(targetLang) : languageCode
    if (code !== 'zh' && code !== 'ja' && code !== 'ko' && code !== 'th' && code !== 'hi') return
    const sourceText = String(text || '').trim()
    if (!sourceText) return
    const key = toWritingRomanizationKey(sourceText, targetLang)
    if (writingRomanizationByKey[key] || writingRomanizationBusyByKey[key]) return

    setWritingRomanizationBusyByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const transliteration = await requestTransliteration(sourceText, code)
      if (transliteration) {
        setWritingRomanizationByKey((prev) => ({ ...prev, [key]: sanitizeRomanizedText(transliteration) }))
      }
    } finally {
      setWritingRomanizationBusyByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const normalizeWordPracticeText = (text: string): string => String(text || '').trim().toLowerCase()
  const normalizeMeaningPracticeText = (text: string): string =>
    String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:'"()\-_/\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const shuffleTextArray = (items: string[]): string[] => {
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }
  const buildMeaningOptions = (expectedMeaningRaw: string): string[] => {
    const expectedMeaning = String(expectedMeaningRaw || '').trim()
    if (!expectedMeaning) return []
    const expectedNormalized = normalizeMeaningPracticeText(expectedMeaning)
    const pool = [
      ...todayWords.map((x) => String(x.meaning || '').trim()),
      ...reviewItems.map((x) => String(x.meaning || '').trim()),
      localText('Mô tả hành động diễn ra rất nhanh, tức thời.', 'Describes an action that happens instantly.'),
      localText('Nói về thời tiết hoặc điều kiện khí hậu.', 'Talks about weather or climate conditions.'),
      localText('Diễn tả cảm xúc chung chung, không cụ thể chủ đề.', 'Expresses a general emotion without specific context.'),
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((x) => normalizeMeaningPracticeText(x) !== expectedNormalized)
    const uniqueWrong = Array.from(new Set(pool))
    const selectedWrong = shuffleTextArray(uniqueWrong).slice(0, 2)
    return shuffleTextArray([expectedMeaning, ...selectedWrong])
  }
  const startWordPractice = (word: string, expectedMeaning?: string, opts?: { forceSwitch?: boolean }) => {
    const normalizedTarget = normalizeWordPracticeText(word)
    if (!normalizedTarget) return
    const normalizedExpectedMeaning = String(expectedMeaning || '').trim()
    const forceSwitch = Boolean(opts?.forceSwitch)
    setWordPractice((prev) => {
      if (prev && !prev.unlocked && prev.normalizedTarget && prev.normalizedTarget !== normalizedTarget && !forceSwitch) {
        return prev
      }
      if (prev && prev.normalizedTarget === normalizedTarget && !prev.unlocked) {
        return prev
      }
      return {
        targetWord: word,
        normalizedTarget,
        attemptsTotal: 0,
        correctCount: 0,
        draft: '',
        unlocked: false,
        feedback: '',
        expectedMeaning: normalizedExpectedMeaning,
        awaitingMeaningChoice: false,
        meaningOptions: [],
      }
    })
  }
  const onWordPracticeDraftChange = (targetWord: string, nextDraft: string) => {
    const normalizedTarget = normalizeWordPracticeText(targetWord)
    setWordPractice((prev) => {
      if (!prev || prev.normalizedTarget !== normalizedTarget || prev.unlocked) return prev
      if (prev.awaitingMeaningChoice) return prev
      
      const normalizedDraft = normalizeWordPracticeText(nextDraft)
      if (normalizedDraft && !normalizedTarget.startsWith(normalizedDraft)) {
        setPracticeInputStatus('incorrect')
        return {
          ...prev,
          draft: nextDraft,
          feedback: localText('Sai chính tả từ mới, kiểm tra lại ngay.', 'Wrong spelling for this word, please correct it now.'),
        }
      }

      return { ...prev, draft: nextDraft, feedback: '' }
    })
  }
  const onWordPracticeMeaningSelect = (targetWord: string, selectedMeaning: string) => {
    const normalizedTarget = normalizeWordPracticeText(targetWord)
    setWordPractice((prev) => {
      if (!prev || prev.normalizedTarget !== normalizedTarget || prev.unlocked || !prev.awaitingMeaningChoice) return prev
      const expectedNorm = normalizeMeaningPracticeText(prev.expectedMeaning)
      const selectedNorm = normalizeMeaningPracticeText(selectedMeaning)
      if (!expectedNorm || !selectedNorm) return prev
      if (selectedNorm !== expectedNorm) {
        return {
          ...prev,
          feedback: localText('Sai nghĩa rồi, chọn lại nhé.', 'Wrong meaning, please choose again.'),
        }
      }
      const nextCorrectCount = prev.correctCount + 1
      const unlocked = nextCorrectCount >= 3
      if (unlocked) {
        setTimeout(() => {
          setWordPractice(null)
        }, 700)
      }
      return {
        ...prev,
        attemptsTotal: prev.attemptsTotal + 1,
        correctCount: nextCorrectCount,
        unlocked,
        feedback: unlocked
          ? localText('Đã hoàn thành 3/3. Đã mở khóa thao tác khác.', 'Completed 3/3. Other actions are now unlocked.')
          : localText(`Đúng rồi! Hiện tại ${nextCorrectCount}/3.`, `Correct! Current progress ${nextCorrectCount}/3.`),
        awaitingMeaningChoice: false,
        meaningOptions: [],
        draft: '',
      }
    })
  }
  const teacherOptions = useMemo(
    () =>
      TEACHERS_BY_LANGUAGE[languageCode].map((teacher) => ({
        ...teacher,
        label: TEACHER_LABELS[teacher.id]?.[uiLocale] || TEACHER_LABELS[teacher.id]?.en || teacher.label,
      })),
    [languageCode, uiLocale]
  )
  const selectedTeacher = useMemo(
    () => teacherOptions.find((t) => t.id === teacherId) || teacherOptions[0],
    [teacherId, teacherOptions]
  )
  const activeTeacher = sessionTeacher || selectedTeacher
  const selectedVoice = FIXED_TTS_VOICE_BY_GENDER[activeTeacher.gender === 'female' ? 'female' : 'male']
  const teacherLabel = activeTeacher.label
  const teacherRoleLabel = useMemo(() => {
    if (uiLocale === 'vi') return activeTeacher.gender === 'male' ? 'Thầy' : 'Cô'
    return t('Teacher')
  }, [uiLocale, activeTeacher.gender, t])
  const selectedTeacherLabel = useMemo(() => {
    if (uiLocale === 'vi') return activeTeacher.gender === 'male' ? 'Thầy đang chọn:' : 'Cô đang chọn:'
    return LOCAL_TEXT_TRANSLATIONS['Selected teacher:']?.[uiLocale] || 'Selected teacher:'
  }, [uiLocale, activeTeacher.gender])
  const languageOptions = useMemo<Array<{ code: LanguageCode; label: string }>>(
    () => LANGUAGE_CODES.map((code) => ({ code, label: LANGUAGE_LABELS[uiLocale][code] })),
    [uiLocale]
  )
  const nativeLanguageOptions = useMemo<Array<{ code: NativeLanguageCode; label: string; apiLabel: string }>>(
    () =>
      NATIVE_LANGUAGE_CODES.map((code) => ({
        code,
        label: NATIVE_LANGUAGE_LABELS[uiLocale][code],
        apiLabel: NATIVE_LANGUAGE_API_LABELS[code],
      })),
    [uiLocale]
  )
  const topicOptionsLocalized = useMemo<TopicOption[]>(
    () =>
      TOPIC_OPTIONS.map((topic) => ({
        id: topic.id,
        label: TOPIC_LABELS_BY_LOCALE[uiLocale][topic.id] || topic.label,
      })),
    [uiLocale]
  )
  const selectedLanguageLabel = useMemo(
    () => languageOptions.find((x) => x.code === languageCode)?.label || localText('ngoại ngữ', 'target language'),
    [languageCode, languageOptions, localText]
  )
  const selectedNativeLanguage = useMemo(
    () => nativeLanguageOptions.find((x) => x.code === nativeLanguageCode) || nativeLanguageOptions[0],
    [nativeLanguageCode, nativeLanguageOptions]
  )
  const micLanguageHint = useMemo(() => {
    const nativeLabel = selectedNativeLanguage?.label || localText('tiếng mẹ đẻ', 'native language')
    if (uiLocale === 'zh') {
      return `你可以说${nativeLabel}或学习语言；建议优先说学习语言，进步更快。`
    }
    if (uiLocale === 'ja') {
      return `${nativeLabel}でも学習中の言語でも話せます。上達を早めるため、学習中の言語を優先してください。`
    }
    if (uiLocale === 'ko') {
      return `${nativeLabel} 또는 학습 언어로 말할 수 있어요. 더 빨리 늘려면 학습 언어를 우선 사용하세요.`
    }
    if (uiLocale === 'th') {
      return `คุณสามารถพูด${nativeLabel}หรือภาษาที่กำลังเรียนได้ แต่แนะนำให้ใช้ภาษาที่กำลังเรียนเพื่อพัฒนาได้เร็วกว่า`
    }
    if (uiLocale === 'hi') {
      return `आप ${nativeLabel} या सीखी जा रही भाषा बोल सकते हैं; तेज प्रगति के लिए सीखी जा रही भाषा को प्राथमिकता दें।`
    }
    if (uiLocale === 'vi') {
      return `Bạn có thể nói ${nativeLabel} hoặc ngôn ngữ đang học; nên ưu tiên ngôn ngữ đang học để tiến bộ nhanh hơn.`
    }
    return `You can speak ${nativeLabel} or the target language; prefer the target language to improve faster.`
  }, [localText, selectedNativeLanguage?.label, uiLocale])
  const coachUiText = useMemo(
    () => COACH_NATIVE_UI_TEXT[nativeLanguageCode] || COACH_NATIVE_UI_TEXT.vi,
    [nativeLanguageCode]
  )
  const difficultyLabelUi = (d: TopicDifficultyTag) => {
    if (d === 'basic') return localText('Cơ bản', 'Basic')
    if (d === 'intermediate') return localText('Trung cấp', 'Intermediate')
    if (d === 'advanced') return localText('Nâng cao', 'Advanced')
    return localText('Theo cấp độ', 'Adaptive')
  }
  const modeLabelUi = (value: Mode) => {
    if (value === 'listen_speak') return localText('Luyện nghe nói phản xạ', 'Listen & Speak Reflex')
    if (value === 'roleplay_short') return localText('Nhập vai tình huống ngắn', 'Short Roleplay')
    return localText('Hội thoại thường ngày', 'Daily Conversation')
  }
  const levelLabelUi = (value: LearnerLevel) => {
    if (value === 0) return localText('Level 0 - Mới bắt đầu, đi thật chậm', 'Level 0 - Absolute beginner, very guided')
    if (value === 1) return localText('Level 1 - Cơ bản, câu cực ngắn', 'Level 1 - Beginner, very short sentences')
    if (value === 2) return localText('Level 2 - Sơ trung cấp, cân bằng giải thích', 'Level 2 - Elementary, balanced support')
    if (value === 3) return localText('Level 3 - Trung cấp, ưu tiên phản xạ', 'Level 3 - Intermediate, stronger target usage')
    return localText('Level 4 - Nâng cao, hội thoại thực chiến', 'Level 4 - Advanced, mostly target language')
  }
  const unknownErrorText = localText('Lỗi không xác định.', 'Unknown error.')
  const unknownErrorMsg = (e: unknown) => (e instanceof Error ? e.message : unknownErrorText)
  const goalOptions = useMemo(
    () => GOAL_OPTION_KEYS.map((id) => ({ id, label: GOAL_OPTION_LABELS[uiLocale][id] })),
    [uiLocale]
  )
  const goalLabelById = useMemo<Record<GoalType, string>>(
    () =>
      goalOptions.reduce<Record<GoalType, string>>((acc, item) => {
        acc[item.id] = item.label
        return acc
      }, {} as Record<GoalType, string>),
    [goalOptions]
  )
  const activeGoalType = useMemo<GoalType>(
    () => (GOAL_OPTION_KEYS.includes(activeGoal?.goal_type as GoalType) ? (activeGoal?.goal_type as GoalType) : goalType),
    [activeGoal?.goal_type, goalType]
  )
  const repeatPromptInTarget = useMemo(
    () => REPEAT_PROMPT_BY_LANGUAGE[languageCode] || REPEAT_PROMPT_BY_LANGUAGE.en,
    [languageCode]
  )
  const explainPromptInTarget = useMemo(
    () => EXPLAIN_PROMPT_BY_LANGUAGE[languageCode] || EXPLAIN_PROMPT_BY_LANGUAGE.en,
    [languageCode]
  )
  const repeatPromptInNative = useMemo(
    () => REPEAT_PROMPT_BY_LANGUAGE[nativeLanguageCode as LanguageCode] || REPEAT_PROMPT_BY_LANGUAGE.vi,
    [nativeLanguageCode]
  )
  const explainPromptInNative = useMemo(
    () => EXPLAIN_PROMPT_BY_LANGUAGE[nativeLanguageCode as LanguageCode] || EXPLAIN_PROMPT_BY_LANGUAGE.vi,
    [nativeLanguageCode]
  )
  const allTopicOptions = useMemo<TopicOption[]>(() => {
    const builtin = topicOptionsLocalized
    const custom = customTopics
      .map((x) => ({ id: x.topicId, label: x.topicLabel }))
      .filter((x) => x.id && x.label)
    const seen: Record<string, true> = {}
    const merged: TopicOption[] = []
    for (const item of [...builtin, ...custom]) {
      if (seen[item.id]) continue
      seen[item.id] = true
      merged.push(item)
    }
    return merged
  }, [customTopics, topicOptionsLocalized])
  const selectedTopic = useMemo(
    () => allTopicOptions.find((x) => x.id === topicId) || allTopicOptions[0] || topicOptionsLocalized[0] || TOPIC_OPTIONS[0],
    [topicId, allTopicOptions]
  )
  const isTopicConfirmedForLesson = Boolean(topicId) && confirmedTopicId === topicId
  const isLessonReadyToStart = isTopicConfirmedForLesson && hasCurriculumReady
  const canShowDirectConversation = isLessonReadyToStart || messages.length > 0 || Boolean(openedHistorySessionId)
  const hasStudentTurnsInCurrentSession = liveSessionStudentTurnCount > sessionEntryStudentTurnBaseline
  const isMiniDrillBlocking =
    learningMode === 'review'
    && reviewDrillStage !== 'idle'
    && (isPresetPageSession ? hasStudentTurnsInCurrentSession : true)
  const isMiniWritingBlocking =
    learningMode === 'review' && Boolean(writingTask) && !Boolean(writingTask?.completed)
  const latestMainSentenceForLearner = useMemo(() => {
    const personalize = (raw: string) =>
      personalizeLearnerNameInSentence(raw, learnerDisplayName, languageCode)
    if (isPresetPageSession) {
      const teacherById = new Map(
        messages
          .filter((m) => m.role === 'teacher')
          .map((m) => [m.id, m] as const)
      )
      const writingMessageId = String(writingTask?.messageId || '').trim()
      if (writingMessageId && teacherById.has(writingMessageId)) {
        const selectedTeacher = teacherById.get(writingMessageId)!
        const idea2 = personalize(String(mainSentenceByMessageId[writingMessageId] || '').trim())
        if (idea2) {
          return { messageId: writingMessageId, sentence: idea2, teacherText: selectedTeacher.text }
        }
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role !== 'teacher') continue
        const idea2 = personalize(String(mainSentenceByMessageId[m.id] || '').trim())
        if (idea2) {
          return { messageId: m.id, sentence: idea2, teacherText: m.text }
        }
      }
      const presetExpected = personalize(String(presetReplayExpectedSentence || '').trim())
      if (presetExpected) {
        return { messageId: 'preset-replay-next', sentence: presetExpected, teacherText: presetExpected }
      }
      return null
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role !== 'teacher') continue
      const sentence = String(mainSentenceByMessageId[m.id] || '').trim()
      if (sentence) {
        return { messageId: m.id, sentence, teacherText: m.text }
      }
    }
    return null
  }, [
    messages,
    mainSentenceByMessageId,
    isPresetPageSession,
    presetReplayExpectedSentence,
    writingTask?.messageId,
    learnerDisplayName,
    languageCode,
  ])

  useEffect(() => {
    latestMiniStageRef.current = reviewMiniPackCompleted ? 'done' : reviewDrillStage
  }, [reviewDrillStage, reviewMiniPackCompleted])

  useEffect(() => {
    if (!sessionId || learningMode !== 'review' || historyBusy) return
    const stage: MiniStage = reviewMiniPackCompleted ? 'done' : reviewDrillStage
    const key = `${sessionId}:${stage}`
    if (miniStageSyncKeyRef.current === key) return
    miniStageSyncKeyRef.current = key
    void updateMiniStageSnapshotApi({ sessionId, stage })
      .then((res) => {
        if (!res.ok && miniStageSyncKeyRef.current === key) {
          miniStageSyncKeyRef.current = ''
        }
      })
      .catch(() => {
        if (miniStageSyncKeyRef.current === key) miniStageSyncKeyRef.current = ''
      })
  }, [sessionId, learningMode, historyBusy, reviewDrillStage, reviewMiniPackCompleted])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPageHide = () => {
      if (!sessionId || learningMode !== 'review') return
      const stage = latestMiniStageRef.current
      void fetch('/api/english-coach/history/mini-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stage }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [sessionId, learningMode])

  const getWritingTaskProgressStorageKey = useCallback((sid: string) => `nanoai_writing_task_progress:${sid}`, [])

  const redirectToMiniDrill = useCallback(() => {
    if (reviewDrillStage === 'writing') {
      writingTaskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        writingInputRef.current?.focus()
      }, 180)
    } else if (reviewDrillStage === 'speaking') {
      miniSpeakingBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (reviewDrillStage === 'listening') {
      miniListeningBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [reviewDrillStage])

  const redirectToMiniWriting = useCallback(() => {
    writingTaskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => {
      writingInputRef.current?.focus()
    }, 180)
  }, [])

  const persistWritingTaskSnapshot = useCallback(
    async (task: WritingTask, retries = 2) => {
      if (!task || !sessionId) return
      const json = JSON.stringify({
        messageId: task.messageId,
        requiredSentences: task.requiredSentences,
        currentIndex: task.currentIndex,
        completed: task.completed,
        teacherText: task.teacherText,
        instruction: task.instruction,
        referenceSentence: task.referenceSentence,
        taskType: task.taskType,
      })
      const isDbId = Boolean(openedHistorySessionId && sessionId === openedHistorySessionId)
      const res = await updateMessageTranslationApi({
        messageId: task.messageId,
        ...(isDbId ? {} : { sessionId, clientMessageId: task.messageId }),
        writingTaskJson: json,
      })
      if (!res.ok && retries > 0) {
        window.setTimeout(() => {
          void persistWritingTaskSnapshot(task, retries - 1)
        }, 700)
      }
    },
    [openedHistorySessionId, sessionId]
  )

  useEffect(() => {
    if (wasMiniWritingBlockedRef.current && !isMiniDrillBlocking) {
      requestAnimationFrame(() => {
        speakActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
    wasMiniWritingBlockedRef.current = isMiniDrillBlocking
  }, [isMiniDrillBlocking])
  const customTopicDifficultyById = useMemo<Record<string, TopicDifficulty>>(
    () =>
      customTopics.reduce<Record<string, TopicDifficulty>>((acc, item) => {
        acc[item.topicId] = item.topicDifficulty
        return acc
      }, {}),
    [customTopics]
  )
  const topicBaseDifficultyById = useMemo<Record<string, TopicDifficultyTag>>(
    () => ({ ...TOPIC_DIFFICULTY_BY_ID, ...customTopicDifficultyById }),
    [customTopicDifficultyById]
  )
  const topicOptionsByFilter = useMemo(
    () => allTopicOptions.filter((topic) => {
      if (topicFilterMode === 'all') return true
      const baseDifficulty = topicBaseDifficultyById[topic.id] || 'basic'
      return isTopicFitForLevel(baseDifficulty, learnerLevel)
    }),
    [topicFilterMode, learnerLevel, allTopicOptions, topicBaseDifficultyById]
  )
  const builtInTopicOptions = useMemo(
    () => topicOptionsByFilter.filter((topic) => !customTopics.some((x) => x.topicId === topic.id)),
    [topicOptionsByFilter, customTopics]
  )
  const customTopicOptions = useMemo(
    () => topicOptionsByFilter.filter((topic) => customTopics.some((x) => x.topicId === topic.id)),
    [topicOptionsByFilter, customTopics]
  )
  const currentTopicOptions = topicSourceMode === 'custom' ? customTopicOptions : builtInTopicOptions
  const selectedTopicBaseDifficulty = useMemo<TopicDifficultyTag>(
    () => topicBaseDifficultyById[selectedTopic.id] || 'basic',
    [selectedTopic.id, topicBaseDifficultyById]
  )
  const selectedTopicDifficulty = useMemo<TopicDifficulty>(
    () => resolveTopicDifficulty(selectedTopicBaseDifficulty, learnerLevel),
    [selectedTopicBaseDifficulty, learnerLevel]
  )
  useEffect(() => {
    if (topicOptionsByFilter.some((x) => x.id === topicId)) return
    if (topicOptionsByFilter[0]) setTopicId(topicOptionsByFilter[0].id)
  }, [topicOptionsByFilter, topicId])

  useEffect(() => {
    if (topicId) setPendingTopicId(topicId)
  }, [topicId])

  useEffect(() => {
    if (topicSourceMode === 'custom' && customTopicOptions.length === 0) {
      setTopicSourceMode('builtin')
    }
  }, [topicSourceMode, customTopicOptions.length])

  useEffect(() => {
    if (currentTopicOptions.some((x) => x.id === pendingTopicId)) return
    if (currentTopicOptions[0]) setPendingTopicId(currentTopicOptions[0].id)
  }, [currentTopicOptions, pendingTopicId])

  useEffect(() => {
    setTopicCurriculum(null)
    setHasCurriculumReady(false)
  }, [topicId, learnerLevel, activeTeacher.languageLabel, selectedNativeLanguage.apiLabel])
  const supportLanguage = selectedNativeLanguage.apiLabel
  const quickStartStageLabel = useMemo(() => {
    if (quickStartStage === 'confirm_topic') return localText('Đang chọn chủ đề...', 'Selecting topic...')
    if (quickStartStage === 'create_curriculum') return localText('Đang tạo giáo trình...', 'Creating curriculum...')
    if (quickStartStage === 'start_lesson') return localText('Đang mở buổi học...', 'Starting lesson...')
    return localText('Bắt đầu nhanh', 'Quick start')
  }, [quickStartStage, uiLocale])
  const showSetupPanel = !setupCollapsed
  const studentSpeakingLanguage =
    speakingLanguageMode === 'auto'
      ? `${activeTeacher.languageLabel} + ${selectedNativeLanguage.apiLabel}`
      : speakingLanguageMode === 'target'
      ? activeTeacher.languageLabel
      : speakingLanguageMode === 'native'
        ? selectedNativeLanguage.apiLabel
        : `${activeTeacher.languageLabel} + ${selectedNativeLanguage.apiLabel}`

  const appendMessage = (role: 'teacher' | 'student', text: string, fixedId?: string) => {
    const id = fixedId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setMessages((prev) => [...prev, { id, role, text }])
    return id
  }

  const updateMessageText = (messageId: string, text: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text } : m)))
  }

  const confirmTopicForLearning = (nextTopicId: string, opts?: { silent?: boolean }) => {
    const trimmed = String(nextTopicId || '').trim()
    if (!trimmed) return false
    const isSameTopic = trimmed === topicId
    const hadExistingLesson = messages.length > 0 || Boolean(openedHistorySessionId)
    setTopicId(trimmed)
    setPendingTopicId(trimmed)
    setConfirmedTopicId(trimmed)
    if (hadExistingLesson) {
      startNewSession()
    }
    if (!opts?.silent) {
      const selected = allTopicOptions.find((x) => x.id === trimmed)
      toast({
        title: isSameTopic
          ? localText('Chủ đề này đã được chọn', 'This topic is already selected')
          : localText('Đã chọn chủ đề để học', 'Topic selected for learning'),
        description: selected
          ? `${selected.label}${hadExistingLesson ? localText(' • Đã tạo buổi học mới, xóa buổi cũ.', ' • New lesson created, previous one cleared.') : ''}`
          : localText('Bạn có thể bắt đầu buổi học với chủ đề này.', 'You can start learning with this topic.'),
      })
    }
    return true
  }

  const fetchCustomTopics = async () => {
    try {
      const { ok, data } = await listCustomTopics({
        limit: 30,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        learnerLevel,
      })
      if (!ok) return
      const normalizedItems = Array.isArray(data.items)
        ? data.items
            .map((x) => ({
              topicId: String(x.topicId || '').trim(),
              topicLabel: String(x.topicLabel || '').trim(),
              topicDifficulty:
                x.topicDifficulty === 'advanced'
                  ? 'advanced'
                  : x.topicDifficulty === 'intermediate'
                    ? 'intermediate'
                    : 'basic',
            }))
            .filter((x) => x.topicId && x.topicLabel)
        : []
      const dedupById = normalizedItems.reduce<CustomTopicItem[]>((acc, item) => {
        if (acc.some((x) => x.topicId === item.topicId)) return acc
        acc.push(item)
        return acc
      }, [])
      setCustomTopics(dedupById)
    } catch {
      // keep page usable if custom topic load fails
    }
  }

  const normalizeAndSaveCustomTopic = async () => {
    const rawTopic = customTopicDraft.trim()
    if (!rawTopic) {
      toast({
        title: localText('Thiếu chủ đề', 'Missing topic'),
        description: localText('Bạn hãy nhập chủ đề muốn học trước.', 'Please enter a topic before continuing.'),
        variant: 'destructive',
      })
      return
    }
    setCustomTopicBusy(true)
    try {
      const { ok, data } = await normalizeCustomTopic({
        rawTopic,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        learnerLevel,
      })
      if (!ok) throw new Error(data.error || localText('Không chuẩn hóa được chủ đề.', 'Failed to normalize topic.'))
      const normalized: CustomTopicItem = {
        topicId: String(data.topicId || '').trim(),
        topicLabel: String(data.topicLabel || '').trim(),
        topicDifficulty:
          data.topicDifficulty === 'advanced'
            ? 'advanced'
            : data.topicDifficulty === 'intermediate'
              ? 'intermediate'
              : 'basic',
      }
      if (normalized.topicId && normalized.topicLabel) {
        setCustomTopics((prev) => {
          const next = [normalized, ...prev.filter((x) => x.topicId !== normalized.topicId)]
          return next.slice(0, 30)
        })
        setTopicSourceMode('custom')
        setTopicId(normalized.topicId)
        setPendingTopicId(normalized.topicId)
        setConfirmedTopicId('')
      }
      setCustomTopicDraft('')
      toast({
        title: localText('Đã tạo chủ đề', 'Topic created'),
        description: localText(
          'AI đã chuẩn hóa và lưu chủ đề. Bạn có thể bấm "Tạo bài học" ngay trong popup.',
          'Topic normalized and saved. You can click "Create lesson" directly in the popup.'
        ),
      })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi chủ đề tự tạo', 'Custom topic error'), description: msg, variant: 'destructive' })
    } finally {
      setCustomTopicBusy(false)
    }
  }

  const fetchTopicCurriculum = async (opts?: { skipConfirm?: boolean; topicId?: string; topicLabelOverride?: string; silent?: boolean }) => {
    const topicIdToUse = String(opts?.topicId || topicId || '').trim()
    const topicToUse = allTopicOptions.find((x) => x.id === topicIdToUse) || selectedTopic || (topicIdToUse ? { id: topicIdToUse, label: String(opts?.topicLabelOverride || '').trim() || topicIdToUse } : null)
    const topicLabelToUse = String(opts?.topicLabelOverride || topicToUse?.label || '').trim() || topicToUse?.label || topicIdToUse
    const topicDifficultyToUse = resolveTopicDifficulty(topicBaseDifficultyById[topicToUse?.id] || 'basic', learnerLevel)
    if (!opts?.skipConfirm && confirmedTopicId !== topicIdToUse) {
      toast({
        title: localText('Cần chọn chủ đề trước', 'Select topic first'),
        description: localText(
          'Hãy bấm "Học chủ đề này" để xác nhận chủ đề rồi mới tạo giáo trình.',
          'Please click "Learn this topic" to confirm the topic before creating curriculum.'
        ),
        variant: 'destructive',
      })
      return null
    }
    setTopicBusy(true)
    setHasCurriculumReady(false)
    try {
      const { ok, data } = await createTopicCurriculum({
        topicId: topicIdToUse || topicToUse?.id,
        topicLabel: topicLabelToUse || topicToUse?.label,
        topicDifficulty: topicDifficultyToUse,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        learnerLevel,
      })
      if (!ok) throw new Error(data.error || localText('Không tạo được giáo trình theo chủ đề.', 'Failed to generate topic curriculum.'))
      const nextCurriculum: TopicCurriculum = {
        roleplayRole: String(data.roleplayRole || '').trim(),
        dailyQuest: String(data.dailyQuest || '').trim(),
        objective: String(data.objective || '').trim(),
        keywords: Array.isArray(data.keywords) ? data.keywords.map((x) => String(x || '').trim()).filter(Boolean) : [],
        starterSentences: Array.isArray(data.starterSentences) ? data.starterSentences.map((x) => String(x || '').trim()).filter(Boolean) : [],
        lessonSteps: Array.isArray(data.lessonSteps) ? data.lessonSteps.map((x) => String(x || '').trim()).filter(Boolean) : [],
        openingLine: String(data.openingLine || '').trim(),
        openingQuestion: String(data.openingQuestion || '').trim(),
      }
      setTopicCurriculum(nextCurriculum)
      setHasCurriculumReady(true)
      const hadExistingLesson = !opts?.silent && (messages.length > 0 || Boolean(openedHistorySessionId))
      if (hadExistingLesson) {
        startNewSession()
        toast({
          title: localText('Đã tạo buổi học mới', 'New lesson created'),
          description: localText(
            'Giáo trình đã được tạo lại. Buổi học cũ đã được xóa khỏi màn hình để tránh lặp lời chào.',
            'Curriculum has been refreshed. Previous lesson was cleared to avoid duplicated greetings.'
          ),
        })
      }
      return nextCurriculum
    } catch (e) {
      if (!opts?.silent) {
        const msg = unknownErrorMsg(e)
        toast({ title: localText('Lỗi giáo trình chủ đề', 'Curriculum error'), description: msg, variant: 'destructive' })
      }
      return null
    } finally {
      setTopicBusy(false)
    }
  }

  const fetchLearningSnapshot = async () => {
    try {
      const localDate = getLocalDateString()
      const query = new URLSearchParams({
        date: localDate,
        targetLanguage: activeTeacher.languageLabel,
        currentLevel: String(learnerLevel),
      })
      const res = await fetch(`/api/english-coach/progress?${query.toString()}`, { method: 'GET' })
      const data = (await res.json().catch(() => ({}))) as {
        today?: ProgressSnapshot
        dueReviewCount?: number
        activeGoal?: LearningGoal | null
        weekly?: WeeklySnapshot
        badges?: string[]
        assessment?: {
          baseline?: AssessmentItem | null
          checkpoint?: AssessmentItem | null
          deltaOverall?: number | null
        }
        personalizedReview?: {
          focusWords?: string[]
          note?: string
        }
        levelRecommendation?: LevelRecommendation | null
      }
      if (!res.ok) return
      setProgressSnapshot(data.today || null)
      setDueReviewCount(Number(data.dueReviewCount || 0))
      setActiveGoal(data.activeGoal || null)
      setWeeklySnapshot(data.weekly || null)
      setLearningBadges(Array.isArray(data.badges) ? data.badges.map((x) => String(x || '').trim()).filter(Boolean) : [])
      setAssessmentBaseline(data.assessment?.baseline || null)
      setAssessmentCheckpoint(data.assessment?.checkpoint || null)
      setAssessmentDeltaOverall(
        Number.isFinite(Number(data.assessment?.deltaOverall)) ? Number(data.assessment?.deltaOverall) : null
      )
      const words = Array.isArray(data.personalizedReview?.focusWords)
        ? data.personalizedReview!.focusWords!.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5)
        : []
      setReviewFocusWords(words)
      setReviewFocusNote(String(data.personalizedReview?.note || '').trim())
      setLevelRecommendation(data.levelRecommendation || null)
      if (data.activeGoal?.goal_type) {
        const id = String(data.activeGoal.goal_type) as GoalType
        if (GOAL_OPTION_KEYS.includes(id)) setGoalType(id)
      }
    } catch {
      // keep learning flow even if snapshot fetch fails
    }
  }

  const fetchReviewDue = async () => {
    await cleanupIncompleteWordsSilent()
    setReviewBusy(true)
    try {
      const { ok, data } = await getReviewDue(8)
      if (!ok) return
      const raw = Array.isArray(data.items) ? data.items : []
      const normalized = raw.map((item) => {
        const meaning = String(item.meaning || '').trim()
        const pronunciation = String(item.pronunciation || '').trim()
        const senses = sanitizeWordSenses((item as { senses?: unknown }).senses)
        const exampleItems = sanitizeWordExampleItems(item.exampleItems)
        const exampleTarget = String(item.exampleTarget || '').trim()
        const exampleNative = String(item.exampleNative || '').trim()
        const senseExamples = senses
          .map((s) => ({ targetText: String(s.exampleTarget || '').trim(), nativeText: String(s.exampleNative || '').trim() }))
          .filter((s) => s.targetText && s.nativeText)
        return {
          ...item,
          meaning,
          pronunciation,
          senses,
          usageLevel: normalizeWordUsageLevel(item.usageLevel),
          importanceScore: normalizeWordImportanceScore(item.importanceScore),
          contextSensitive: normalizeWordContextSensitive(item.contextSensitive),
          meaningItems: [],
          exampleItems: exampleItems.length > 0 ? exampleItems : (senseExamples.length > 0 ? senseExamples : (exampleTarget && exampleNative ? [{ targetText: exampleTarget, nativeText: exampleNative }] : [])),
          exampleTarget,
          exampleNative,
        }
      })
      setReviewItems(normalized)
      normalized.forEach((item) => {
        if (!isCjkTargetLanguage(item.targetLanguage)) return
        const examples = item.exampleItems ?? (item.exampleTarget && item.exampleNative ? [{ targetText: item.exampleTarget, nativeText: item.exampleNative, targetPinyin: undefined }] : [])
        examples.forEach((ex) => {
          const exampleText = String(ex.targetText || '').trim()
          const hasPinyin = String(ex.targetPinyin || '').trim()
          if (exampleText && !hasPinyin) void ensureWritingRomanization(exampleText, item.targetLanguage)
        })
      })
    } finally {
      setReviewBusy(false)
    }
  }

  const saveLearningGoal = async () => {
    setGoalBusy(true)
    try {
      const selectedGoalId = GOAL_OPTION_KEYS.includes(goalType) ? goalType : GOAL_OPTION_KEYS[0]
      const selectedGoalLabel = GOAL_OPTION_LABELS[uiLocale][selectedGoalId]
      const { ok, data } = await saveLearningGoalApi({
        goalType: selectedGoalId,
        title: selectedGoalLabel,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        targetDays: 30,
        targetDailyMinutes: 15,
        targetWeeklySessions: 5,
        targetPronunciationScore: 80,
      })
      const payload = data as { goal?: LearningGoal | null; error?: string }
      if (!ok) throw new Error(payload.error || localText('Không lưu được mục tiêu học.', 'Failed to save learning goal.'))
      setActiveGoal(payload.goal || null)
      toast({
        title: localText('Đã lưu mục tiêu học', 'Learning goal saved'),
        description: localText('Lộ trình học đã được cập nhật.', 'Your learning plan has been updated.'),
      })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi mục tiêu học', 'Learning goal error'), description: msg, variant: 'destructive' })
    } finally {
      setGoalBusy(false)
    }
  }

  const recordProgressTurn = async (
    hadCorrections: boolean,
    pronunciationScore?: number | null,
    diagnostics?: MixedSpeechAnalysis | null,
    inputSource: 'text' | 'mic' = 'text'
  ) => {
    try {
      const localDate = getLocalDateString()
      await recordProgress({
          sessionId,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          localDate,
          pronunciationScore: pronunciationScore ?? null,
          hadCorrections,
          newSession: shouldCountNewSessionRef.current,
          inputSource,
          speakingMode: speakingLanguageMode,
          diagnostics: diagnostics
            ? {
                targetTranscript: diagnostics.targetTranscript,
                nativeTranscript: diagnostics.nativeTranscript,
                mergedTranscript: diagnostics.mergedTranscript,
                inferredMeaning: diagnostics.inferredMeaning,
                weakWords: diagnostics.weakWords,
                pronunciationAccuracy: diagnostics.pronunciationAccuracy,
                pronunciationFluency: diagnostics.pronunciationFluency,
                pronunciationProsody: diagnostics.pronunciationProsody,
                wordScores: diagnostics.wordScores,
              }
            : undefined,
      })
      shouldCountNewSessionRef.current = false
      void fetchLearningSnapshot()
    } catch {
      // keep learning flow even if progress save fails
    }
  }

  const markReviewDone = async (id: string, score: number) => {
    try {
      await markReviewDue({ id, score })
      await Promise.all([fetchReviewDue(), fetchLearningSnapshot()])
    } catch {
      // keep UI usable even if review update fails
    }
  }

  const runPlacementQuickTest = async () => {
    const samples = placementSamples.map((x) => String(x || '').trim()).filter(Boolean)
    if (samples.length < 2) {
      toast({
        title: localText('Thiếu dữ liệu test', 'Not enough test data'),
        description: localText('Hãy nhập ít nhất 2 câu trước khi chấm level tự động.', 'Please provide at least 2 sentences for auto level placement.'),
        variant: 'destructive',
      })
      return
    }
    setPlacementBusy(true)
    try {
      const { ok, data } = await runPlacementLevel({
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        samples,
      })
      if (!ok) throw new Error(data.error || localText('Không chấm được level tự động.', 'Failed to run auto placement.'))
      const raw = Number(data.recommendedLevel)
      const recommendedLevel: LearnerLevel =
        raw === 4 ? 4 : raw === 3 ? 3 : raw === 2 ? 2 : raw === 1 ? 1 : 0
      setLearnerLevel(recommendedLevel)
      setPlacementResult({
        recommendedLevel,
        confidence: Number.isFinite(Number(data.confidence)) ? Math.min(100, Math.max(0, Math.round(Number(data.confidence)))) : 60,
        reason: String(data.reason || '').trim() || localText('Đã gợi ý level dựa trên câu mẫu.', 'Level recommended from your sample sentences.'),
      })
      toast({
        title: localText('Đã gợi ý level tự động', 'Auto level recommendation complete'),
        description: localText(
          `Hệ thống đề xuất ${levelLabelUi(recommendedLevel)}. Bạn vẫn có thể đổi thủ công.`,
          `System recommends ${levelLabelUi(recommendedLevel)}. You can still change it manually.`
        ),
      })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi test đầu vào', 'Placement test error'), description: msg, variant: 'destructive' })
    } finally {
      setPlacementBusy(false)
    }
  }

  const runCefrAssessmentAction = async (
    assessmentType: 'baseline' | 'checkpoint',
    options?: { onSuccess?: () => void }
  ) => {
    const samples = placementSamples.map((x) => String(x || '').trim()).filter(Boolean)
    if (samples.length < 2) {
      toast({
        title: localText('Thiếu dữ liệu test', 'Not enough test data'),
        description: localText('Hãy nhập ít nhất 2 câu trước khi chạy đánh giá CEFR.', 'Please provide at least 2 sentences for CEFR assessment.'),
        variant: 'destructive',
      })
      return
    }
    setAssessmentBusy(true)
    try {
      const { ok, data } = await runCefrAssessment({
        assessmentType,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        samples,
      })
      if (!ok || !data.assessment) {
        throw new Error(data.error || localText('Không chạy được đánh giá CEFR.', 'Failed to run CEFR assessment.'))
      }
      const levelRaw = Number(data.assessment.learner_level)
      const nextLevel: LearnerLevel =
        levelRaw === 4 ? 4 : levelRaw === 3 ? 3 : levelRaw === 2 ? 2 : levelRaw === 1 ? 1 : 0
      setLearnerLevel(nextLevel)
      setPlacementResult({
        recommendedLevel: nextLevel,
        confidence: Number(data.assessment.confidence || 60),
        reason: String(data.assessment.summary || '').trim(),
      })
      toast({
        title: assessmentType === 'baseline' ? localText('Đã lưu baseline CEFR', 'CEFR baseline saved') : localText('Đã lưu checkpoint CEFR', 'CEFR checkpoint saved'),
        description: localText(
          `Kết quả: ${String(data.assessment.cefr_level)} • Điểm tổng ${Number(data.assessment.overall_score || 0)}`,
          `Result: ${String(data.assessment.cefr_level)} • Overall ${Number(data.assessment.overall_score || 0)}`
        ),
      })
      options?.onSuccess?.()
      void fetchLearningSnapshot()
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi đánh giá CEFR', 'CEFR assessment error'), description: msg, variant: 'destructive' })
    } finally {
      setAssessmentBusy(false)
    }
  }

  const handleOpenQuickStartSetup = () => {
    setQuickStartModalOpen(true)
  }

  const buildWritingTask = (messageId: string, teacherText: string, copySentences: string[]): WritingTask => {
    const requiredSentences = Array.from(
      new Set(
        copySentences
          .map((x) => sanitizeSentenceForCopy(String(x || '').trim(), languageCode))
          .filter(Boolean)
      )
    )
    const firstSentence = requiredSentences[0] || ''
    return {
      messageId,
      taskType: 'copy',
      instruction: localText(
        'Hãy gõ lại y nguyên từng câu theo thứ tự. Chỉ khi gõ đúng mới mở lượt nói tiếp theo.',
        'Type each sentence exactly in order. The next speaking turn unlocks only after exact copy.'
      ),
      referenceSentence: firstSentence,
      requiredSentences,
      currentIndex: 0,
      teacherText,
      completed: false,
    }
  }

  const evaluateWritingTask = async () => {
    if (!writingTask) return
    const learnerText = String(writingDraft || '').trim()
    if (!learnerText) {
      toast({
        title: localText('Thiếu câu viết', 'Missing writing input'),
        description: localText('Hãy viết câu trả lời trước khi chấm.', 'Please write your response before evaluation.'),
        variant: 'destructive',
      })
      return
    }
    setWritingBusy(true)
    try {
      const expected = String(
        writingTask.requiredSentences[Math.min(writingTask.currentIndex, Math.max(0, writingTask.requiredSentences.length - 1))] || ''
      ).trim()
      const matched = normalizeCopyText(learnerText, languageCode) === normalizeCopyText(expected, languageCode)
      if (!matched) {
        setWritingInputStatus('incorrect')
        setWritingEvalResult({
          score: 20,
          passed: false,
          correctedText: expected,
          feedback: localText(
            'Chưa đúng y nguyên câu tham chiếu. Hãy gõ lại đúng từ, đúng thứ tự và đúng dấu câu.',
            'Not an exact copy yet. Please type the reference sentence with exact words, order, and punctuation.'
          ),
          shortHint: localText('Nhấn vào câu tham chiếu và chép lại y nguyên.', 'Copy the reference sentence exactly.'),
        })
        return
      }

      const nextIndex = writingTask.currentIndex + 1
      const isDone = nextIndex >= writingTask.requiredSentences.length
      setWritingInputStatus('matched')
      setWritingEvalResult({
        score: 100,
        passed: isDone,
        correctedText: '',
        feedback: isDone
          ? localText('Đúng hoàn toàn. Đã mở khóa lượt nói tiếp theo.', 'Perfect copy. Next speaking turn is unlocked.')
          : localText('Đúng câu này. Tiếp tục gõ câu kế tiếp.', 'This sentence is correct. Continue with the next one.'),
        shortHint: isDone
          ? localText('Đã mở Mini 2/3: luyện nói.', 'Mini 2/3 speaking is now unlocked.')
          : localText('Gõ tiếp câu số 2 để mở khóa.', 'Type sentence #2 to unlock.'),
      })
      setWritingDraft('')
      setWritingTask((prev) => {
        if (!prev) return prev
        const nextTask = isDone
          ? { ...prev, completed: true }
          : {
          ...prev,
          currentIndex: nextIndex,
          referenceSentence: prev.requiredSentences[nextIndex] || prev.referenceSentence,
        }
        void persistWritingTaskSnapshot(nextTask, 2)
        return nextTask
      })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi bài viết', 'Writing task error'), description: msg, variant: 'destructive' })
    } finally {
      setWritingBusy(false)
    }
  }

  useEffect(() => {
    if (!writingTask || writingTask.completed) {
      setWritingInputStatus('idle')
      writingAutoAdvanceSignatureRef.current = ''
      return
    }

    const expected = String(
      writingTask.requiredSentences[Math.min(writingTask.currentIndex, Math.max(0, writingTask.requiredSentences.length - 1))] || ''
    ).trim()
    const draftNow = String(writingDraft || '').trim()
    if (!draftNow) {
      setWritingInputStatus('idle')
      return
    }

    const normalizedExpected = normalizeCopyText(expected, languageCode)
    const normalizedDraft = normalizeCopyText(draftNow, languageCode)
    const isExactMatch = normalizedDraft === normalizedExpected
    const isPrefix = normalizedExpected.startsWith(normalizedDraft)

    if (!isExactMatch && !isPrefix) {
      setWritingInputStatus('incorrect')
      return
    }

    if (!isExactMatch) {
      setWritingInputStatus('partial')
      return
    }

    setWritingInputStatus('matched')
    const signature = `${writingTask.messageId}:${writingTask.currentIndex}:${languageCode}:${normalizedExpected}`
    if (writingAutoAdvanceSignatureRef.current === signature) return
    writingAutoAdvanceSignatureRef.current = signature

    const timer = window.setTimeout(() => {
      setWritingTask((prev) => {
        if (!prev || prev.completed) return prev
        const prevExpected = String(
          prev.requiredSentences[Math.min(prev.currentIndex, Math.max(0, prev.requiredSentences.length - 1))] || ''
        ).trim()
        const prevSignature = `${prev.messageId}:${prev.currentIndex}:${languageCode}:${normalizeCopyText(prevExpected, languageCode)}`
        if (prevSignature !== signature) return prev

        const nextIndex = prev.currentIndex + 1
        const isDone = nextIndex >= prev.requiredSentences.length
        setWritingEvalResult({
          score: 100,
          passed: isDone,
          correctedText: '',
          feedback: isDone
            ? localText('Đúng hoàn toàn. Đã mở khóa lượt nói tiếp theo.', 'Perfect copy. Next speaking turn is unlocked.')
            : localText('Đúng câu này. Tiếp tục gõ câu kế tiếp.', 'This sentence is correct. Continue with the next one.'),
          shortHint: isDone
            ? localText('Đã mở Mini 2/3: luyện nói.', 'Mini 2/3 speaking is now unlocked.')
            : localText('Gõ tiếp câu số 2 để mở khóa.', 'Type sentence #2 to unlock.'),
        })
        setWritingDraft('')
        setWritingInputStatus('idle')
        const nextTask = isDone
          ? { ...prev, completed: true }
          : {
          ...prev,
          currentIndex: nextIndex,
          referenceSentence: prev.requiredSentences[nextIndex] || prev.referenceSentence,
        }
        void persistWritingTaskSnapshot(nextTask, 2)
        return nextTask
      })
    }, 220)

    return () => window.clearTimeout(timer)
  }, [writingTask, writingDraft, localText, languageCode])

  useEffect(() => {
    if (!writingTask || !sessionId) return
    void persistWritingTaskSnapshot(writingTask, 2)
  }, [writingTask, sessionId, persistWritingTaskSnapshot])

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionId) return
    const key = getWritingTaskProgressStorageKey(sessionId)
    if (!writingTask) {
      window.localStorage.removeItem(key)
      return
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          messageId: writingTask.messageId,
          requiredSentences: writingTask.requiredSentences,
          currentIndex: writingTask.currentIndex,
          completed: writingTask.completed,
          teacherText: writingTask.teacherText,
          instruction: writingTask.instruction,
          referenceSentence: writingTask.referenceSentence,
          taskType: writingTask.taskType,
        })
      )
    } catch {
      // ignore localStorage failures
    }
  }, [writingTask, sessionId, getWritingTaskProgressStorageKey])

  useEffect(() => {
    return () => {
      if (mixedRecorderRef.current && mixedRecorderRef.current.state !== 'inactive') {
        mixedRecorderRef.current.stop()
      }
      if (micSilenceStopTimerRef.current != null) {
        window.clearTimeout(micSilenceStopTimerRef.current)
        micSilenceStopTimerRef.current = null
      }
      if (micMaxDurationTimerRef.current != null) {
        window.clearTimeout(micMaxDurationTimerRef.current)
        micMaxDurationTimerRef.current = null
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
        micStreamRef.current = null
      }
      createdAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      createdAudioUrlsRef.current = []
    }
  }, [])

  const playAudioUrl = async (url: string): Promise<void> => {
    const run = async () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      const audio = new Audio(url)
      audio.playbackRate = playbackSpeedRef.current
      audioRef.current = audio
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const done = (err?: unknown) => {
          if (settled) return
          settled = true
          if (err) reject(err)
          else resolve()
        }
        audio.onended = () => done()
        audio.onerror = (e) => done(e)
        void audio.play().then(() => {
          // normal path: resolved by onended/onerror
        }).catch((e) => {
          done(e)
        })
      })
    }
    audioQueueRef.current = audioQueueRef.current
      .catch(() => {
        // recover queue chain after unexpected failure
      })
      .then(run)
    await audioQueueRef.current
  }

  const replayStudentMessageAudio = async (messageId: string) => {
    const fromRef = String(studentAudioByMessageIdRef.current[messageId] || '').trim()
    const fromState = String(studentAudioByMessageId[messageId] || '').trim()
    const url = fromRef || fromState
    if (!url) return
    await playAudioUrl(url)
  }

  const createTtsAudioData = async (
    text: string,
    opts?: { locale?: string; languageLabel?: string; forceEngine?: 'auto' | 'gemini-only' | 'openai-only'; skipCache?: boolean }
  ) => {
    const normalizedText = String(text || '').trim()
    if (!normalizedText) {
      throw new Error(localText('Thiếu văn bản để tạo âm thanh.', 'Missing text to generate audio.'))
    }
    const localeToUse = String(opts?.locale || activeTeacher.locale || '').trim() || 'en-US'
    const labelToUse = String(opts?.languageLabel || activeTeacher.languageLabel || '').trim() || 'English'
    if (!opts?.skipCache) {
      const { ok: cacheOk, data: cacheData } = await getTtsCache({
        text: normalizedText,
        voiceName: selectedVoice,
        locale: localeToUse,
      })
      const cachePayload = cacheData as {
        found?: boolean
        audioBase64?: string
        mimeType?: string
      }
      if (cacheOk && cachePayload.found && cachePayload.audioBase64) {
        const bytes = base64ToBytes(String(cachePayload.audioBase64 || ''))
        const mime = String(cachePayload.mimeType || '').toLowerCase()
        const browserPlayable =
          mime.includes('audio/wav') ||
          mime.includes('audio/wave') ||
          mime.includes('audio/mp3') ||
          mime.includes('audio/mpeg') ||
          mime.includes('audio/ogg') ||
          mime.includes('audio/aac') ||
          mime.includes('audio/flac')
        const blob = browserPlayable
          ? new Blob([bytes], { type: cachePayload.mimeType || 'audio/wav' })
          : pcm16MonoToWavBlob(bytes, 24000)
        const blobType = browserPlayable ? cachePayload.mimeType || 'audio/wav' : 'audio/wav'
        const url = URL.createObjectURL(blob)
        createdAudioUrlsRef.current.push(url)
        return { url, blob, blobType }
      }
    }
    const { ok, status, data } = await generateTts({
      text: normalizedText,
      voiceName: selectedVoice,
      locale: localeToUse,
      teacherGender: activeTeacher.gender,
      forceEngine: opts?.forceEngine || 'auto',
      skipCache: opts?.skipCache,
      targetLanguage: activeTeacher.languageLabel,
      nativeLanguage: selectedNativeLanguage.apiLabel,
      voiceStyle:
        activeTeacher.gender === 'male'
          ? `Speak with a clearly masculine native ${labelToUse} teacher voice. Calm, warm, and natural.`
          : `Speak with a clearly feminine native ${labelToUse} teacher voice. Calm, warm, and natural.`,
    })
    const payload = data as {
      audioBase64?: string
      mimeType?: string
      error?: string
      meta?: { model?: string; voice?: string }
      attempts?: Array<{ model?: string; voice?: string; ok?: boolean; reason?: string }>
      warnings?: string[]
      geminiErrorCode?: number
      geminiErrorMessage?: string
    }
    if (!ok || !payload.audioBase64) {
      console.error('[TTS client] failed', {
        status,
        error: payload.error || localText('Không phát được giọng giáo viên.', 'Unable to generate teacher voice.'),
        meta: payload.meta || null,
        attempts: payload.attempts || [],
        warnings: payload.warnings || [],
      })
      throw new Error(payload.error || localText('Không phát được giọng giáo viên.', 'Unable to generate teacher voice.'))
    }
    console.info('[TTS client] success', {
      status,
      engine: payload.meta?.model || 'unknown',
      voice: payload.meta?.voice || 'unknown',
      attempts: payload.attempts || [],
      warnings: payload.warnings || [],
    })
    const geminiFailed = Array.isArray(payload.attempts)
      && payload.attempts.some((x) => String(x.model || '').includes('gemini') && !x.ok)
    if (geminiFailed) {
      console.warn(
        uiLocale === 'vi' ? '[TTS] Gemini TTS gặp lỗi ở một số attempt.' : '[TTS] Gemini TTS had failed attempts.',
        payload.attempts || []
      )
    }

    const bytes = base64ToBytes(payload.audioBase64)
    const mime = String(payload.mimeType || '').toLowerCase()
    const browserPlayable =
      mime.includes('audio/wav') ||
      mime.includes('audio/wave') ||
      mime.includes('audio/mp3') ||
      mime.includes('audio/mpeg') ||
      mime.includes('audio/ogg') ||
      mime.includes('audio/aac') ||
      mime.includes('audio/flac')

    const blob = browserPlayable
      ? new Blob([bytes], { type: payload.mimeType || 'audio/wav' })
      : pcm16MonoToWavBlob(bytes, 24000)
    const blobType = browserPlayable ? payload.mimeType || 'audio/wav' : 'audio/wav'

    const url = URL.createObjectURL(blob)
    createdAudioUrlsRef.current.push(url)
    return { url, blob, blobType }
  }

  const createConsistentTeacherTtsAudioData = async (
    text: string,
    opts?: { locale?: string; languageLabel?: string; skipCache?: boolean }
  ) => {
    try {
      return await createTtsAudioData(text, {
        locale: opts?.locale || activeTeacher.locale,
        languageLabel: opts?.languageLabel || activeTeacher.languageLabel,
        forceEngine: 'openai-only',
        skipCache: opts?.skipCache,
      })
    } catch {
      // Fallback engine keeps feature resilient when OpenAI-only is unavailable.
      return await createTtsAudioData(text, {
        locale: opts?.locale || activeTeacher.locale,
        languageLabel: opts?.languageLabel || activeTeacher.languageLabel,
        forceEngine: 'auto',
        skipCache: opts?.skipCache,
      })
    }
  }

  const tryLoadCachedTtsAudio = async (text: string) => {
    const normalized = String(text || '').trim()
    if (!normalized) return null
    const { ok, data } = await getTtsCache({
      text: normalized,
      voiceName: selectedVoice,
      locale: activeTeacher.locale,
    })
    const payload = data as {
      found?: boolean
      audioBase64?: string
      mimeType?: string
    }
    if (!ok || !payload.found || !payload.audioBase64) return null
    const bytes = base64ToBytes(String(payload.audioBase64 || ''))
    const mime = String(payload.mimeType || '').toLowerCase()
    const browserPlayable =
      mime.includes('audio/wav') ||
      mime.includes('audio/wave') ||
      mime.includes('audio/mp3') ||
      mime.includes('audio/mpeg') ||
      mime.includes('audio/ogg') ||
      mime.includes('audio/aac') ||
      mime.includes('audio/flac')
    const blob = browserPlayable
      ? new Blob([bytes], { type: payload.mimeType || 'audio/wav' })
      : pcm16MonoToWavBlob(bytes, 24000)
    const blobType = browserPlayable ? payload.mimeType || 'audio/wav' : 'audio/wav'
    const url = URL.createObjectURL(blob)
    createdAudioUrlsRef.current.push(url)
    return { url, blob, blobType }
  }

  const playBestEffortTts = async (text: string, opts?: { skipCache?: boolean }) => {
    const single = await createTtsAudioData(String(text || '').trim(), {
      locale: activeTeacher.locale,
      languageLabel: activeTeacher.languageLabel,
      forceEngine: 'auto',
      skipCache: opts?.skipCache,
    })
    try {
      await playAudioUrl(single.url)
    } catch {
      // iOS Safari may block async autoplay; keep audio URL so user can replay manually.
    }
    return [single]
  }

  const saveHistoryMessage = async ({
    role,
    text,
    audioUrl,
    clientMessageId,
    mainSentence,
    correctionNote,
    intentAnswer,
    tokensJson,
    aiPayloadJson,
    topicId: topicIdOverride,
    topicLabel: topicLabelOverride,
  }: {
    role: 'teacher' | 'student'
    text: string
    audioUrl?: string
    clientMessageId?: string
    mainSentence?: string
    correctionNote?: string
    intentAnswer?: string
    tokensJson?: string
    aiPayloadJson?: string
    topicId?: string
    topicLabel?: string
  }) => {
    const { ok, data } = await saveHistoryMessageApi({
      sessionId,
      role,
      text,
      audioUrl: audioUrl || '',
      clientMessageId: clientMessageId || '',
      languageCode,
      targetLanguage: activeTeacher.languageLabel,
      teacherLabel: activeTeacher.label,
      teacherLocale: activeTeacher.locale,
      mode,
      mainSentence: mainSentence || '',
      correctionNote: correctionNote || '',
      intentAnswer: intentAnswer || '',
      tokensJson: tokensJson || '',
      aiPayloadJson: aiPayloadJson || '',
      nativeLanguage: selectedNativeLanguage.apiLabel,
      learningMode,
      topicId: topicIdOverride || selectedTopic.id,
      topicLabel: topicLabelOverride || selectedTopic.label,
    })
    if (!ok) {
      throw new Error(data.error || localText('Không lưu được lịch sử học.', 'Failed to save lesson history.'))
    }
    return data.id || null
  }

  const uploadTeacherAudio = async (messageId: string, blob: Blob, blobType: string) => {
    const formData = new FormData()
    formData.append('audio', new File([blob], `${messageId}.wav`, { type: blobType || 'audio/wav' }))
    formData.append('sessionId', sessionId)
    formData.append('messageId', messageId)
    const { ok, data } = await uploadAudio(formData)
    if (!ok || !data.audioUrl) {
      throw new Error(data.error || localText('Không upload được audio giáo viên.', 'Failed to upload teacher audio.'))
    }
    return data.audioUrl
  }

  const uploadStudentAudio = async (messageId: string, blob: Blob, blobType: string) => {
    const formData = new FormData()
    formData.append('audio', new File([blob], `${messageId}.webm`, { type: blobType || 'audio/webm' }))
    formData.append('sessionId', sessionId)
    formData.append('messageId', messageId)
    const { ok, data } = await uploadAudio(formData)
    if (!ok || !data.audioUrl) {
      throw new Error(data.error || localText('Không upload được ghi âm học viên.', 'Failed to upload student recording.'))
    }
    return data.audioUrl
  }

  const replayTeacherMessage = async (messageId: string, text: string) => {
    const key = `${messageId}__full`
    if (ttsLoadingByKey[key]) return
    if (listening) {
      try {
        await stopMixedRecording()
      } catch {
        // continue replay flow even if mic stop fails
      }
    }

    const correctionNote = String(correctionNoteByMessageId[messageId] || '').trim()
    const mainSentence = String(mainSentenceByMessageId[messageId] || '').trim()
    const intentAnswer = String(intentAnswerByMessageId[messageId] || '').trim()
    const segments = (
      learningMode === 'reflex'
        ? [{ key: `${messageId}__main`, text: String(mainSentence || text || '').trim() }]
        : [
          { key: `${messageId}__correction_note`, text: correctionNote },
          { key: `${messageId}__main`, text: mainSentence },
          { key: `${messageId}__intent_answer`, text: intentAnswer },
        ]
    )
      .map((seg) => ({ key: seg.key, text: stripPhoneticForTts(String(seg.text || '').trim(), languageCode) }))
      .filter((seg) => Boolean(seg.text))

    if (segments.length === 0) {
      let raw = String(teacherSpeakTextByMessageId[messageId] || text || '').trim()
      if (learningMode === 'reflex' && !teacherSpeakTextByMessageId[messageId]) {
        raw = extractTargetLanguageOnlyForReflexTts(raw, languageCode)
      }
      const textToSpeak = stripPhoneticForTts(raw, languageCode)
      const cached = teacherAudioByMessageIdRef.current[messageId]
      if (cached) {
        await playAudioUrl(cached)
        return
      }
      if (busy) {
        const cachedDb = await tryLoadCachedTtsAudio(textToSpeak)
        if (!cachedDb) return
        teacherAudioByMessageIdRef.current = {
          ...teacherAudioByMessageIdRef.current,
          [messageId]: cachedDb.url,
        }
        setTeacherAudioByMessageId((prev) => ({ ...prev, [messageId]: cachedDb.url }))
        await playAudioUrl(cachedDb.url)
        return
      }
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
      try {
        const generated = await playBestEffortTts(textToSpeak)
        teacherAudioByMessageIdRef.current = {
          ...teacherAudioByMessageIdRef.current,
          [messageId]: generated[0]?.url || '',
        }
        setTeacherAudioByMessageId((prev) => ({ ...prev, [messageId]: generated[0]?.url || '' }))
      } finally {
        setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
      }
      return
    }

    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const urls: string[] = []
      const nextCache: Record<string, string> = {}
      for (const seg of segments) {
        let url = String(teacherAudioByMessageIdRef.current[seg.key] || '').trim()
        if (!url) {
          const cachedDb = await tryLoadCachedTtsAudio(seg.text)
          if (cachedDb?.url) url = cachedDb.url
        }
        if (!url && !busy) {
          const single = await createConsistentTeacherTtsAudioData(seg.text, {
            locale: activeTeacher.locale,
            languageLabel: activeTeacher.languageLabel,
          })
          url = String(single?.url || '').trim()
        }
        if (!url) continue
        nextCache[seg.key] = url
        urls.push(url)
      }
      if (Object.keys(nextCache).length > 0) {
        teacherAudioByMessageIdRef.current = {
          ...teacherAudioByMessageIdRef.current,
          ...nextCache,
          [messageId]: urls[0] || teacherAudioByMessageIdRef.current[messageId] || '',
        }
        setTeacherAudioByMessageId((prev) => ({
          ...prev,
          ...nextCache,
          [messageId]: urls[0] || prev[messageId] || '',
        }))
      }
      for (const url of urls) {
        await playAudioUrl(url)
      }
    } finally {
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const replayStudentMessage = async (messageId: string) => {
    const audioUrl = String(studentAudioByMessageId[messageId] || '').trim()
    if (!audioUrl) {
      toast({
        title: localText('Chưa có ghi âm', 'No recording available'),
        description: localText('Tin nhắn này không có audio để phát lại.', 'This message has no audio to replay.'),
        variant: 'destructive',
      })
      return
    }
    await playAudioUrl(audioUrl)
  }

  const replayTeacherCorrectionNote = async (messageId: string) => {
    const correctionNote = String(correctionNoteByMessageId[messageId] || '').trim()
    if (!correctionNote) return
    const textForTts = stripPhoneticForTts(correctionNote, languageCode)
    const key = `${messageId}__correction_note`
    if (ttsLoadingByKey[key]) return
    if (listening) {
      try {
        await stopMixedRecording()
      } catch {
        // continue replay flow even if mic stop fails
      }
    }
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy) return
    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const generated = await playBestEffortTts(textForTts)
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: generated[0]?.url || '',
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: generated[0]?.url || '' }))
    } finally {
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const replayTeacherIntentAnswer = async (messageId: string) => {
    const intentAnswer = String(intentAnswerByMessageId[messageId] || '').trim()
    if (!intentAnswer) return
    const textForTts = stripPhoneticForTts(intentAnswer, languageCode)
    const key = `${messageId}__intent_answer`
    if (ttsLoadingByKey[key]) return
    if (listening) {
      try {
        await stopMixedRecording()
      } catch {
        // continue replay flow even if mic stop fails
      }
    }
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy || listening) {
      const cachedDb = await tryLoadCachedTtsAudio(textForTts)
      if (!cachedDb) return
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: cachedDb.url,
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: cachedDb.url }))
      await playAudioUrl(cachedDb.url)
      return
    }
    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const generated = await playBestEffortTts(textForTts)
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: generated[0]?.url || '',
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: generated[0]?.url || '' }))
    } finally {
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const explainIntentAnswer = async (messageId: string) => {
    const intentAnswer = String(intentAnswerByMessageId[messageId] || '').trim()
    if (!intentAnswer) return
    if (intentExplainBusyByMessageId[messageId]) return
    if (intentExplainByMessageId[messageId]) {
      setIntentExplainByMessageId((prev) => ({ ...prev, [messageId]: '' }))
      return
    }
    setIntentExplainBusyByMessageId((prev) => ({ ...prev, [messageId]: true }))
    try {
      const teacherIndex = messages.findIndex((m) => m.id === messageId)
      const previousStudentText =
        teacherIndex > 0
          ? String(
              messages
                .slice(0, teacherIndex)
                .reverse()
                .find((m) => m.role === 'student')
                ?.text || ''
            ).trim()
          : ''
      const correctedSentence = String(mainSentenceByMessageId[messageId] || '').trim()
      const correctionNote = String(correctionNoteByMessageId[messageId] || '').trim()

      const { ok, data } = await explainIntent({
        studentText: previousStudentText,
        intentAnswer,
        correctedSentence,
        correctionNote,
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        topicLabel: selectedTopic.label,
      })
      if (!ok) throw new Error(data.error || localText('Không giải thích được câu trả lời.', 'Unable to explain this reply.'))
      const meaning = String(data.explanation || '').trim()
      if (!meaning) throw new Error(localText('Không có nội dung giải thích.', 'No explanation content.'))
      const transliteration = await requestTransliteration(intentAnswer)
      const combined = transliteration
        ? `${meaning}\n${localText('Phiên âm Latin:', 'Latin transliteration:')} ${transliteration}`
        : meaning
      setIntentExplainByMessageId((prev) => ({ ...prev, [messageId]: combined }))
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)
      void updateMessageTranslationApi({
        messageId,
        ...(isDbId ? {} : { sessionId, clientMessageId: messageId }),
        translation: combined,
      }).catch(() => {})
    } catch (e) {
      toast({
        title: localText('Không giải thích được', 'Cannot explain now'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setIntentExplainBusyByMessageId((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  const explainMainSentence = async (messageId: string) => {
    const correctedSentence = String(mainSentenceByMessageId[messageId] || '').trim()
    if (!correctedSentence) return
    if (mainSentenceExplainBusyByMessageId[messageId]) return
    if (mainSentenceExplainByMessageId[messageId]) {
      setMainSentenceExplainByMessageId((prev) => ({ ...prev, [messageId]: '' }))
      return
    }
    setMainSentenceExplainBusyByMessageId((prev) => ({ ...prev, [messageId]: true }))
    try {
      const teacherIndex = messages.findIndex((m) => m.id === messageId)
      const previousStudentText =
        teacherIndex > 0
          ? String(
              messages
                .slice(0, teacherIndex)
                .reverse()
                .find((m) => m.role === 'student')
                ?.text || ''
            ).trim()
          : ''
      const intentAnswer = String(intentAnswerByMessageId[messageId] || '').trim()
      const correctionNote = String(correctionNoteByMessageId[messageId] || '').trim()

      const { ok, data } = await explainIntent({
        studentText: previousStudentText,
        intentAnswer,
        correctedSentence,
        correctionNote,
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        topicLabel: selectedTopic.label,
        explainType: 'idea2',
      })
      if (!ok) throw new Error(data.error || localText('Không giải thích được câu sửa.', 'Unable to explain corrected sentence.'))
      const meaning = String(data.explanation || '').trim()
      if (!meaning) throw new Error(localText('Không có nội dung giải thích.', 'No explanation content.'))
      const transliteration = await requestTransliteration(correctedSentence)
      const combined = transliteration
        ? `${meaning}\n${localText('Phiên âm Latin:', 'Latin transliteration:')} ${transliteration}`
        : meaning
      setMainSentenceExplainByMessageId((prev) => ({ ...prev, [messageId]: combined }))
    } catch (e) {
      toast({
        title: localText('Không giải thích được', 'Cannot explain now'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setMainSentenceExplainBusyByMessageId((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  const translateOpeningMessage = async (messageId: string, teacherText: string) => {
    const sourceText = String(teacherText || '').trim()
    if (!sourceText) return
    if (openingTranslateBusyByMessageId[messageId]) return
    if (openingTranslateByMessageId[messageId]) {
      setOpeningTranslateByMessageId((prev) => ({ ...prev, [messageId]: '' }))
      return
    }
    setOpeningTranslateBusyByMessageId((prev) => ({ ...prev, [messageId]: true }))
    try {
      const { ok, data } = await explainIntent({
        studentText: '',
        intentAnswer: sourceText,
        correctedSentence: '',
        correctionNote: '',
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        topicLabel: selectedTopic.label,
      })
      if (!ok) throw new Error(data.error || localText('Không dịch được câu mở đầu.', 'Unable to translate opening line.'))
      const meaning = String(data.explanation || '').trim()
      if (!meaning) throw new Error(localText('Không có nội dung dịch.', 'No translation content.'))
      const transliteration = await requestTransliteration(sourceText)
      const combined = transliteration
        ? `${meaning}\n${localText('Phiên âm Latin:', 'Latin transliteration:')} ${transliteration}`
        : meaning
      setOpeningTranslateByMessageId((prev) => ({ ...prev, [messageId]: combined }))
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)
      void updateMessageTranslationApi({
        messageId,
        ...(isDbId ? {} : { sessionId, clientMessageId: messageId }),
        translation: combined,
      }).catch(() => {})
    } catch (e) {
      toast({
        title: localText('Không dịch được', 'Cannot translate now'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setOpeningTranslateBusyByMessageId((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  const replayTeacherMainSentence = async (messageId: string, text: string) => {
    const mainSentence = String(mainSentenceByMessageId[messageId] || '').trim()
    if (!mainSentence) {
      await replayTeacherMessage(messageId, text)
      return
    }
    const textForTts = stripPhoneticForTts(mainSentence, languageCode)
    const key = `${messageId}__main`
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy) {
      const cachedDb = await tryLoadCachedTtsAudio(textForTts)
      if (!cachedDb) return
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: cachedDb.url,
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: cachedDb.url }))
      await playAudioUrl(cachedDb.url)
      return
    }
    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const generated = await playBestEffortTts(textForTts)
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: generated[0]?.url || '',
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: generated[0]?.url || '' }))
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Không phát được âm thanh', 'Audio playback failed'), description: msg, variant: 'destructive' })
    } finally {
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const correctionAudioKey = (text: string) => {
    const normalized = String(text || '').trim()
    if (!normalized) return ''
    const encoded = typeof window !== 'undefined'
      ? window.btoa(unescape(encodeURIComponent(normalized))).slice(0, 48)
      : normalized.slice(0, 48)
    return `correction__${encoded}`
  }

  const replayCorrectionSentence = async (text: string) => {
    const normalized = stripPhoneticForTts(String(text || '').trim(), languageCode)
    if (!normalized) return
    const key = correctionAudioKey(normalized)
    if (!key) return
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy || listening) {
      const cachedDb = await tryLoadCachedTtsAudio(normalized)
      if (!cachedDb) return
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: cachedDb.url,
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: cachedDb.url }))
      await playAudioUrl(cachedDb.url)
      return
    }
    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const generated = await playBestEffortTts(normalized)
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: generated[0]?.url || '',
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: generated[0]?.url || '' }))
    } finally {
      setTtsLoadingByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const hasCachedTeacherAudio = (key: string) => {
    const fromRef = String(teacherAudioByMessageIdRef.current[key] || '').trim()
    const fromState = String(teacherAudioByMessageId[key] || '').trim()
    if (fromRef || fromState) return true
    if (!key.includes('__')) {
      const segKeys = [`${key}__correction_note`, `${key}__main`, `${key}__intent_answer`]
      return segKeys.some((k) => {
        const r = String(teacherAudioByMessageIdRef.current[k] || '').trim()
        const s = String(teacherAudioByMessageId[k] || '').trim()
        return Boolean(r || s)
      })
    }
    return false
  }

  const isReplayButtonDisabled = (key: string, hasCached: boolean) => {
    if (ttsLoadingByKey[key]) return true
    if (busy && !hasCached) return true
    return false
  }

  const generateAndStoreTeacherAudio = async (
    messageId: string,
    text: string,
    opts?: { mainSentence?: string; correctionNote?: string; intentAnswer?: string; delayBeforePlayMs?: number }
  ) => {
    const delayMs = Number(opts?.delayBeforePlayMs || 0)
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
    const segments = (
      learningMode === 'reflex'
        ? [{ key: `${messageId}__main`, text: String(opts?.mainSentence || text || '').trim() }]
        : [
          { key: `${messageId}__correction_note`, text: String(opts?.correctionNote || '').trim() },
          { key: `${messageId}__main`, text: String(opts?.mainSentence || '').trim() },
          { key: `${messageId}__intent_answer`, text: String(opts?.intentAnswer || '').trim() },
        ]
    )
      .map((seg) => ({ key: seg.key, text: stripPhoneticForTts(seg.text, languageCode) }))
      .filter((seg) => Boolean(seg.text))

    if (segments.length === 0) {
      const fallback = stripPhoneticForTts(String(text || '').trim(), languageCode)
      if (!fallback) throw new Error(localText('Không tạo được âm thanh.', 'Unable to create audio.'))
      segments.push({ key: `${messageId}__main`, text: fallback })
    }

    const nextCache: Record<string, string> = {}
    let firstPart: { url: string; blob: Blob; blobType: string } | null = null
    for (const seg of segments) {
      const existing = String(teacherAudioByMessageIdRef.current[seg.key] || '').trim()
      if (existing) {
        nextCache[seg.key] = existing
        continue
      }
      const cachedDb = await tryLoadCachedTtsAudio(seg.text)
      if (cachedDb?.url) {
        nextCache[seg.key] = cachedDb.url
        if (!firstPart) firstPart = cachedDb
        continue
      }
      try {
        const single = await createConsistentTeacherTtsAudioData(seg.text, {
          locale: activeTeacher.locale,
          languageLabel: activeTeacher.languageLabel,
        })
        if (single?.url) {
          nextCache[seg.key] = single.url
          if (!firstPart) firstPart = single
        }
      } catch {
        // Keep flow resilient; missing segment can still be generated on-demand when replaying.
      }
    }

    const orderedUrls = segments
      .map((seg) => String(nextCache[seg.key] || teacherAudioByMessageIdRef.current[seg.key] || '').trim())
      .filter(Boolean)
    if (orderedUrls.length === 0) {
      throw new Error(localText('Không tạo được âm thanh.', 'Unable to create audio.'))
    }

    teacherAudioByMessageIdRef.current = {
      ...teacherAudioByMessageIdRef.current,
      ...nextCache,
      [messageId]: orderedUrls[0] || '',
    }
    setTeacherAudioByMessageId((prev) => ({
      ...prev,
      ...nextCache,
      [messageId]: orderedUrls[0] || prev[messageId] || '',
    }))

    for (const url of orderedUrls) {
      await playAudioUrl(url)
    }

    void (async () => {
      let uploadedAudioUrl = ''
      try {
        if (firstPart) {
          uploadedAudioUrl = await uploadTeacherAudio(messageId, firstPart.blob, firstPart.blobType)
        }
        teacherAudioByMessageIdRef.current = {
          ...teacherAudioByMessageIdRef.current,
          [messageId]: uploadedAudioUrl || teacherAudioByMessageIdRef.current[messageId] || '',
        }
        setTeacherAudioByMessageId((prev) => ({
          ...prev,
          [messageId]: uploadedAudioUrl || prev[messageId] || '',
        }))
      } catch {
        // keep local blob URL for current session if upload fails
      }

      // Cập nhật audio_url vào tin nhắn đã lưu (message đã được lưu ngay khi chat trả về)
      try {
        const isDbId = Boolean(openedHistorySessionId && sessionId === openedHistorySessionId)
        await updateMessageTranslationApi({
          messageId,
          ...(isDbId ? {} : { sessionId, clientMessageId: messageId }),
          audioUrl: uploadedAudioUrl,
        })
        persistedMessageIdsRef.current[messageId] = true
        const { ok, data } = await getHistorySessions(12)
        if (ok && Array.isArray(data.sessions)) {
          setHistorySessions(data.sessions as HistorySession[])
        }
      } catch {
        // do not block learning flow when history update fails
      }
    })()
  }

  const extractClickableWord = (token: string) => {
    const cleaned = token
      .replace(/^[^a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+/u, '')
      .replace(/[^a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+$/u, '')
      .trim()
    const allowSingleChar = languageCode === 'zh' || languageCode === 'ja' || languageCode === 'ko' || languageCode === 'th' || languageCode === 'hi'
    return cleaned.length >= (allowSingleChar ? 1 : 2) ? cleaned : ''
  }

  const basicTokenizeBySpace = (sentence: string) => {
    return sentence
      .split(/\s+/)
      .map((token) => extractClickableWord(token))
      .filter((token) => isTokenInTargetLanguage(token, languageCode))
      .filter(Boolean)
      .slice(0, 24)
  }

  const shouldUseAiTokenize = (sentence: string) => {
    const trimmed = sentence.trim()
    if (!trimmed) return false
    const hasCjkThaiChars = /[\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F]/u.test(trimmed)
    if (hasCjkThaiChars) return true
    const longestTokenLen = trimmed
      .split(/\s+/)
      .reduce((max, t) => Math.max(max, t.length), 0)
    return longestTokenLen > 16
  }

  const fetchMessageTokens = async (messageId: string, sentence: string) => {
    setTokenizingByMessageId((prev) => ({ ...prev, [messageId]: true }))
    try {
      const { data } = await tokenizeSentence({
        sentence,
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
      })
      const rawWithUsage = Array.isArray((data as { tokensWithUsage?: unknown }).tokensWithUsage)
        ? (data as { tokensWithUsage: Array<{ word: string; usageLevel?: string }> }).tokensWithUsage
        : []
      const rawTokens = Array.isArray(data.tokens) ? (data.tokens as string[]) : []
      const withUsage = rawWithUsage
        .map((t) => ({
          word: extractClickableWord(String(t.word || '')),
          usageLevel: (['high', 'medium', 'low'].includes(String(t.usageLevel || '').toLowerCase())
            ? String(t.usageLevel).toLowerCase()
            : 'medium') as 'high' | 'medium' | 'low',
        }))
        .filter((t) => t.word && isTokenInTargetLanguage(t.word, languageCode))
        .slice(0, 24)
      const tokens =
        withUsage.length > 0
          ? withUsage.map((t) => t.word)
          : rawTokens
              .map((t) => extractClickableWord(String(t)))
              .filter((token) => isTokenInTargetLanguage(token, languageCode))
              .filter(Boolean)
              .slice(0, 24)
      const finalTokens = tokens.length > 0 ? tokens : basicTokenizeBySpace(sentence)
      const finalWithUsage =
        withUsage.length > 0
          ? withUsage
          : finalTokens.map((w) => ({ word: w, usageLevel: 'medium' as const }))
      setTokensByMessageId((prev) => ({ ...prev, [messageId]: finalTokens }))
      setTokensWithUsageByMessageId((prev) => ({ ...prev, [messageId]: finalWithUsage }))
      const tokensJson = JSON.stringify(finalWithUsage)
      const isDbId = Boolean(openedHistorySessionId && sessionId === openedHistorySessionId)
      void updateMessageTranslationApi({
        messageId,
        ...(isDbId ? {} : { sessionId, clientMessageId: messageId }),
        tokensJson,
      }).catch(() => {})
    } catch {
      const fallback = basicTokenizeBySpace(sentence)
      const fallbackWithUsage = fallback.map((w) => ({ word: w, usageLevel: 'medium' as const }))
      setTokensByMessageId((prev) => ({ ...prev, [messageId]: fallback }))
      setTokensWithUsageByMessageId((prev) => ({ ...prev, [messageId]: fallbackWithUsage }))
      const tokensJson = JSON.stringify(fallbackWithUsage)
      const isDbId = Boolean(openedHistorySessionId && sessionId === openedHistorySessionId)
      void updateMessageTranslationApi({
        messageId,
        ...(isDbId ? {} : { sessionId, clientMessageId: messageId }),
        tokensJson,
      }).catch(() => {})
    } finally {
      setTokenizingByMessageId((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  const fetchWordInsight = async (messageId: string, word: string, sentence: string) => {
    const key = `${messageId}:${word.toLowerCase()}`
    if (wordAnalyzingKeysRef.current.has(key)) return
    delete wordSenseAutoPlayedByKeyRef.current[key]
    setOpenedWordKey(key)
    const savedWord = findSessionWord(word)
    const savedSenses = sanitizeWordSenses((savedWord as { senses?: unknown } | undefined)?.senses)
    if (savedWord && (savedWord.meaning || savedWord.pronunciation || savedSenses.length > 0)) {
      if (supportsLatinTransliteration) {
        const examples = sanitizeWordExampleItems(savedWord.exampleItems)
        const fallback = savedWord.exampleTarget && savedWord.exampleNative
          ? [{ targetText: savedWord.exampleTarget, nativeText: savedWord.exampleNative, targetPinyin: undefined }]
          : []
        const all = examples.length > 0 ? examples : fallback
        all.forEach((ex) => {
          const t = String(ex.targetText || '').trim()
          const hasPinyin = String(ex.targetPinyin || '').trim()
          if (t && !hasPinyin) void ensureWritingRomanization(t)
        })
      }
      setWordInsightByKey((prev) => ({
        ...prev,
        [key]: {
          meaning: savedWord.meaning || savedSenses[0]?.gloss || '',
          pronunciation: savedWord.pronunciation || savedWord.word,
          exampleTarget: String(savedWord.exampleTarget || '').trim(),
          exampleNative: String(savedWord.exampleNative || '').trim(),
          senses: savedSenses,
          usageLevel: normalizeWordUsageLevel(savedWord.usageLevel),
          importanceScore: normalizeWordImportanceScore(savedWord.importanceScore),
          contextSensitive: normalizeWordContextSensitive(savedWord.contextSensitive),
          meaningItems: [],
          exampleItems: sanitizeWordExampleItems(savedWord.exampleItems),
        },
      }))
      void (async () => {
        void playWordPronunciation(word).catch(() => {})
        await autoPlayWordSenseAllFirstTime(key, word, savedSenses)
      })()
      return
    }
    if (wordInsightByKey[key]) {
      try {
        await saveDailyWord(word, wordInsightByKey[key])
        void fetchSessionWords()
      } catch {
        // ignore daily word save failure on cached click
      }
      const cached = wordInsightByKey[key]
      void (async () => {
        void playWordPronunciation(word).catch(() => {})
        await autoPlayWordSenseAllFirstTime(key, word, sanitizeWordSenses(cached.senses))
      })()
      return
    }

    wordAnalyzingKeysRef.current.add(key)
    setWordBusyKey(key)
    // Phát âm từ NGAY khi bấm (user gesture còn hiệu lực) – tránh iOS/Android chặn audio sau async dài
    const wordPlayPromise = playWordPronunciation(word)
    try {
      const { ok, data } = await analyzeWord({
        word,
        contextSentence: buildWordContextSnippet(sentence, word),
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
      })
      const payload = data as WordInsight & { error?: string }
      if (!ok) throw new Error(payload.error || localText('Không phân tích được từ này.', 'Failed to analyze this word.'))
      let detail = buildWordInsightFromAny(payload)
      if (supportsLatinTransliteration) {
        const items = detail.exampleItems.length > 0
          ? detail.exampleItems
          : (detail.exampleTarget && detail.exampleNative
              ? [{ targetText: detail.exampleTarget, nativeText: detail.exampleNative, targetPinyin: undefined }]
              : [])
        const withPinyin = await Promise.all(
          items.map(async (item) => {
            const hasPinyin = String(item.targetPinyin || '').trim()
            if (hasPinyin) return item
            const romanized = await requestTransliteration(item.targetText)
            return { ...item, targetPinyin: romanized || item.targetPinyin }
          })
        )
        detail = { ...detail, exampleItems: withPinyin }
        items.forEach((ex) => {
          const t = String(ex.targetText || '').trim()
          if (t) void ensureWritingRomanization(t)
        })
      }
      setWordInsightByKey((prev) => ({
        ...prev,
        [key]: detail,
      }))
      const audioUrl = String((payload as { pronunciationAudioUrl?: string }).pronunciationAudioUrl || '').trim()
      await saveDailyWord(word, detail, audioUrl || undefined)
      void fetchSessionWords()
      void wordPlayPromise.catch(() => {})
      void autoPlayWordSenseAllFirstTime(key, word, sanitizeWordSenses(detail.senses))
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Không phân tích được từ', 'Word analysis failed'), description: msg, variant: 'destructive' })
    } finally {
      wordAnalyzingKeysRef.current.delete(key)
      setWordBusyKey('')
    }
  }

  const playWordPronunciation = async (
    word: string,
    options?: {
      pronunciationAudioUrl?: string
      forceRegenerate?: boolean
      wordDetailForSave?: Partial<WordInsight> & { sessionId?: string }
      /** Gọi khi lưu xong âm mới (sau regenerate) – dùng để cập nhật overlay */
      onSaved?: (savedWord: string, pronunciationAudioUrl: string) => void
    }
  ) => {
    const playKey = String(word || '').trim().toLowerCase()
    if (!playKey) return
    if (wordPlayingRef.current.has(playKey)) return
    wordPlayingRef.current.add(playKey)

    const preloadedAudioUrl = typeof options === 'string' ? options : options?.pronunciationAudioUrl
    const forceRegenerate = typeof options === 'object' && options?.forceRegenerate
    const wordDetailForSave = typeof options === 'object' ? options?.wordDetailForSave : undefined
    const onSaved = typeof options === 'object' ? options?.onSaved : undefined

    try {
      const savedWord = findSessionWord(word)
      const savedAudioUrl = String(
        preloadedAudioUrl || savedWord?.pronunciationAudioUrl || ''
      ).trim()

      if (savedAudioUrl && !forceRegenerate) {
        try {
          await playAudioUrl(savedAudioUrl)
          return
        } catch {
          // URL hết hạn hoặc lỗi – fallback sang TTS và lưu lại
        }
      }

      const generatedParts = await playBestEffortTts(word, { skipCache: forceRegenerate })
      const firstPart = generatedParts[0]
      if (!firstPart) throw new Error(localText('Không tạo được âm thanh.', 'Unable to create audio.'))

      const safeWordId = toStorageSafeToken(word)
      const audioMessageId = `word_${safeWordId}_${Date.now().toString(36)}`
      const uploadedAudioUrl = await uploadTeacherAudio(audioMessageId, firstPart.blob, firstPart.blobType)
      const detail = wordDetailForSave ?? savedWord
      const detailSessionId = detail && 'sessionId' in detail ? (detail as { sessionId?: string }).sessionId : undefined
      await saveDailyWord(
        word,
        {
          meaning: detail?.meaning || '',
          pronunciation: detail?.pronunciation || word,
          exampleTarget: String(detail?.exampleTarget || '').trim(),
          exampleNative: String(detail?.exampleNative || '').trim(),
          usageLevel: normalizeWordUsageLevel(detail?.usageLevel),
          importanceScore: normalizeWordImportanceScore(detail?.importanceScore),
          contextSensitive: normalizeWordContextSensitive(detail?.contextSensitive),
          meaningItems: [],
          exampleItems: sanitizeWordExampleItems(detail?.exampleItems),
        },
        uploadedAudioUrl,
        detailSessionId
      )
      onSaved?.(word, uploadedAudioUrl)
      void fetchSessionWords()
    } catch (e) {
      const msg = e instanceof Error ? e.message : localText('Không phát âm được từ.', 'Unable to pronounce this word.')
      toast({ title: localText('Lỗi phát âm từ', 'Word pronunciation error'), description: msg, variant: 'destructive' })
    } finally {
      wordPlayingRef.current.delete(playKey)
    }
  }

  const getNativeTtsLocale = (): string => {
    const code = String(nativeLanguageCode || 'vi').toLowerCase()
    const map: Record<string, string> = {
      vi: 'vi-VN',
      en: 'en-US',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      th: 'th-TH',
      hi: 'hi-IN',
    }
    return map[code] || 'vi-VN'
  }

  const playMeaningInNativeLanguage = async (meaningText: string) => {
    const text = String(meaningText || '').trim().slice(0, 500)
    if (!text) return
    try {
      const nativeLabel = selectedNativeLanguage?.apiLabel || 'Vietnamese'
      const single = await createTtsAudioData(text, {
        locale: getNativeTtsLocale(),
        languageLabel: nativeLabel,
        forceEngine: 'auto',
      })
      await playAudioUrl(single.url)
    } catch {
      // ignore TTS errors for meaning
    }
  }

  const getWordSenseSegmentAudioUrl = async (text: string): Promise<string> => {
    const normalized = String(text || '').trim()
    if (!normalized) return ''
    const locale = getNativeTtsLocale()
    const voice = String(selectedVoice || '').trim()
    const gender = String(activeTeacher.gender || '').trim()
    const cacheKey = `${locale}::${voice}::${gender}::${normalized}`
    const cachedUrl = String(wordSenseAudioByKeyRef.current[cacheKey] || '').trim()
    if (cachedUrl) return cachedUrl
    const nativeLabel = selectedNativeLanguage?.apiLabel || 'Vietnamese'
    const single = await createTtsAudioData(normalized, {
      locale,
      languageLabel: nativeLabel,
      forceEngine: 'auto',
    })
    const url = String(single.url || '').trim()
    if (url) wordSenseAudioByKeyRef.current[cacheKey] = url
    return url
  }

  const getWordSenseConnectors = (): { meansIntro: string; singleSenseIntro: string; orSenseLabel: string } => {
    const code = String(nativeLanguageCode || 'vi').toLowerCase()
    if (code === 'vi') {
      return { meansIntro: 'có nghĩa là', singleSenseIntro: 'trong trường hợp này nghĩa là', orSenseLabel: 'hoặc cũng có nghĩa là' }
    }
    if (code === 'en') {
      return { meansIntro: 'means', singleSenseIntro: 'in this case, it means', orSenseLabel: 'or another meaning is' }
    }
    if (code === 'zh') {
      return { meansIntro: '意思是', singleSenseIntro: '在这里的意思是', orSenseLabel: '或者另一层意思是' }
    }
    if (code === 'ja') {
      return { meansIntro: 'の意味は', singleSenseIntro: 'この場合の意味は', orSenseLabel: 'または別の意味は' }
    }
    if (code === 'ko') {
      return { meansIntro: '의 뜻은', singleSenseIntro: '이 경우의 뜻은', orSenseLabel: '또 다른 의미는' }
    }
    if (code === 'th') {
      return { meansIntro: 'หมายความว่า', singleSenseIntro: 'ในกรณีนี้แปลว่า', orSenseLabel: 'หรืออีกความหมายคือ' }
    }
    if (code === 'hi') {
      return { meansIntro: 'का मतलब है', singleSenseIntro: 'इस मामले में मतलब है', orSenseLabel: 'या दूसरा अर्थ है' }
    }
    return { meansIntro: 'có nghĩa là', singleSenseIntro: 'trong trường hợp này nghĩa là', orSenseLabel: 'hoặc nghĩa là' }
  }

  const playWordSenseGloss = async (word: string, text: string) => {
    const normalizedWord = String(word || '').trim()
    const normalizedGloss = String(text || '').trim()
    if (!normalizedWord || !normalizedGloss) return
    const c = getWordSenseConnectors()
    const segments = [normalizedWord, c.singleSenseIntro, normalizedGloss]
    for (const segment of segments) {
      const url = await getWordSenseSegmentAudioUrl(segment)
      if (!url) continue
      await playAudioUrl(url)
    }
  }

  const playWordSenseExampleTarget = async (text: string) => {
    const normalized = String(text || '').trim()
    if (!normalized) return
    await playWordTextSnippet(normalized)
  }

  const playWordSenseAll = async (
    word: string,
    senses: Array<{ gloss: string; exampleTarget: string; exampleNative: string }>
  ) => {
    const normalizedWord = String(word || '').trim()
    const validGlosses = senses.map((s) => String(s.gloss || '').trim()).filter(Boolean)
    if (!normalizedWord || validGlosses.length === 0) return
    const c = getWordSenseConnectors()
    const segments: string[] = [normalizedWord, c.meansIntro, validGlosses[0]]
    for (let i = 1; i < validGlosses.length; i += 1) {
      segments.push(c.orSenseLabel, validGlosses[i])
    }
    const urls: string[] = []
    for (const segment of segments) {
      const url = await getWordSenseSegmentAudioUrl(segment)
      if (url) urls.push(url)
    }
    for (const url of urls) {
      await playAudioUrl(url)
    }
  }

  const autoPlayWordSenseAllFirstTime = async (
    key: string,
    word: string,
    senses: Array<{ gloss: string; exampleTarget: string; exampleNative: string }>
  ) => {
    if (!key || wordSenseAutoPlayedByKeyRef.current[key]) return
    const validSenseItems = sanitizeWordSenses(senses)
    if (validSenseItems.length === 0) return
    try {
      // Let React paint the word detail panel before starting autoplay.
      await new Promise<void>((resolve) => {
        if (typeof window === 'undefined') {
          resolve()
          return
        }
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.setTimeout(resolve, 80)
          })
        })
      })
      await playWordSenseAll(word, validSenseItems)
      wordSenseAutoPlayedByKeyRef.current[key] = true
    } catch {
      delete wordSenseAutoPlayedByKeyRef.current[key]
    }
  }

  const playWordTextSnippet = async (text: string) => {
    const normalized = String(text || '').trim()
    if (!normalized) return
    let speakText = normalized
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .filter((line) => !/^(pinyin|phiên âm latin|translation|dịch)\s*:/i.test(line))
      .join(' ')
      .trim()
    speakText = stripPhoneticForTts(speakText, languageCode)
    if (!speakText) return
    if (textSnippetPlayingRef.current.has(speakText)) return
    textSnippetPlayingRef.current.add(speakText)
    try {
      await playBestEffortTts(speakText)
    } catch (e) {
      const msg = e instanceof Error ? e.message : localText('Không phát được câu này.', 'Unable to play this sentence.')
      toast({ title: localText('Lỗi phát âm thanh', 'Audio playback error'), description: msg, variant: 'destructive' })
    } finally {
      textSnippetPlayingRef.current.delete(speakText)
    }
  }

  const extractPronunciationWordFromTip = (tip: string): string => {
    const text = String(tip || '').trim()
    if (!text) return ''

    const quotedMatches = Array.from(text.matchAll(/["“”'‘’]([^"“”'‘’]{1,40})["“”'‘’]/g))
    for (const match of quotedMatches) {
      const quoted = String(match[1] || '').trim()
      if (!quoted || /\s/.test(quoted)) continue
      const word = extractClickableWord(quoted)
      if (word && isTokenInTargetLanguage(word, languageCode)) return word
    }

    const fallbackMatch = text.match(/\btừ\s+([A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+)/iu)
    const fallbackWord = extractClickableWord(String(fallbackMatch?.[1] || ''))
    return fallbackWord && isTokenInTargetLanguage(fallbackWord, languageCode) ? fallbackWord : ''
  }

  const fetchHistorySessions = async () => {
    const [activeRes, learnedRes] = await Promise.all([
      getHistorySessions(12, 'active'),
      getHistorySessions(20, 'learned'),
    ])
    if (!activeRes.ok) {
      throw new Error(activeRes.data.error || localText('Không tải được lịch sử buổi học.', 'Failed to load lesson history.'))
    }
    if (!learnedRes.ok) {
      throw new Error(learnedRes.data.error || localText('Không tải được danh sách đã học.', 'Failed to load learned lessons.'))
    }
    setHistorySessions(Array.isArray(activeRes.data.sessions) ? activeRes.data.sessions as HistorySession[] : [])
    setLearnedHistorySessions(Array.isArray(learnedRes.data.sessions) ? learnedRes.data.sessions as HistorySession[] : [])
  }

  const deleteSession = async (targetSessionId: string) => {
    const { ok, data } = await deleteHistorySession(targetSessionId)
    if (!ok) {
      toast({ title: localText('Không xóa được buổi học.', 'Failed to delete lesson.'), variant: 'destructive' })
      return
    }
    setHistorySessions((prev) => prev.filter((s) => s.sessionId !== targetSessionId))
    if (sessionId === targetSessionId || openedHistorySessionId === targetSessionId) {
      setSessionId('')
      setOpenedHistorySessionId('')
      setMessages([])
      setWritingTask(null)
      setReviewMiniPackCompleted(false)
      setWritingDraft('')
      setWritingEvalResult(null)
      setCorrectionsByMessageId({})
      setMainSentenceByMessageId({})
      setCorrectionNoteByMessageId({})
      setIntentAnswerByMessageId({})
      studentAudioByMessageIdRef.current = {}
      setStudentAudioByMessageId({})
      setTokensByMessageId({})
      setTokensWithUsageByMessageId({})
      setOpeningTranslateByMessageId({})
      setIntentExplainByMessageId({})
    }
    toast({ title: localText('Đã xóa buổi học.', 'Lesson deleted.') })
    void fetchHistorySessions()
  }

  const fetchPreviousLessonWords = async (): Promise<TodayWordItem[]> => {
    const { ok, data } = await getPreviousLessonWords(50)
    if (!ok) throw new Error(data.error || localText('Không tải được từ buổi trước.', 'Failed to load previous words.'))
    const raw = Array.isArray(data.items) ? data.items : []
    const normalized = raw.map((item) => {
      const meaning = String(item.meaning || '').trim()
      const pronunciation = String(item.pronunciation || '').trim()
      const exampleTarget = String(item.exampleTarget || '').trim()
      const exampleNative = String(item.exampleNative || '').trim()
      const senses = sanitizeWordSenses((item as { senses?: unknown }).senses)
      const exampleItems = sanitizeWordExampleItems((item as { exampleItems?: unknown }).exampleItems)
      const senseExamples = senses
        .map((s) => ({ targetText: String(s.exampleTarget || '').trim(), nativeText: String(s.exampleNative || '').trim() }))
        .filter((s) => s.targetText && s.nativeText)
      return {
        ...item,
        meaning,
        pronunciation,
        exampleTarget,
        exampleNative,
        senses,
        usageLevel: normalizeWordUsageLevel((item as { usageLevel?: unknown }).usageLevel),
        importanceScore: normalizeWordImportanceScore((item as { importanceScore?: unknown }).importanceScore),
        contextSensitive: normalizeWordContextSensitive((item as { contextSensitive?: unknown }).contextSensitive),
        pronunciationAudioUrl: String(item.pronunciationAudioUrl || '').trim(),
        meaningItems: [],
        exampleItems: exampleItems.length > 0 ? exampleItems : (
          senseExamples.length > 0
            ? senseExamples
            :
          exampleTarget && exampleNative
            ? [{ targetText: exampleTarget, nativeText: exampleNative }]
            : []
        ),
      }
    })
    const filtered = normalized.filter((item) => item.meaning.length > 0)
    const uniqueByWord = new Map<string, TodayWordItem>()
    for (const item of filtered) {
      const key = `${String(item.word || '').trim().toLowerCase()}::${String(item.targetLanguage || '').trim().toLowerCase()}`
      if (!key || uniqueByWord.has(key)) continue
      uniqueByWord.set(key, item)
    }
    void cleanupIncompleteWordsSilent()
    return Array.from(uniqueByWord.values())
  }

  const cleanupIncompleteWordsSilent = async () => {
    try {
      const { ok, data } = await cleanupIncompleteWords()
      if (!ok) return
      if ((data.deleted ?? 0) > 0) {
        void fetchSessionWords()
      }
    } catch {
      // silent
    }
  }

  const fetchSessionWords = async (targetSessionId?: string) => {
    const sid = String(targetSessionId || sessionId || '').trim()
    if (!sid) {
      setTodayWords([])
      return
    }
    setTodayWordsBusy(true)
    try {
      const { ok, data } = await getSessionWords(sid, 80)
      if (!ok) throw new Error(data.error || localText('Không tải được từ mới buổi học.', 'Failed to load lesson vocabulary.'))
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((item) => {
            const meaning = String(item.meaning || '').trim()
            const pronunciation = String(item.pronunciation || '').trim()
            const exampleTarget = String(item.exampleTarget || '').trim()
            const exampleNative = String(item.exampleNative || '').trim()
            const senses = sanitizeWordSenses((item as { senses?: unknown }).senses)
            const exampleItems = sanitizeWordExampleItems((item as { exampleItems?: unknown }).exampleItems)
            const senseExamples = senses
              .map((s) => ({ targetText: String(s.exampleTarget || '').trim(), nativeText: String(s.exampleNative || '').trim() }))
              .filter((s) => s.targetText && s.nativeText)
            return {
              ...item,
              meaning,
              pronunciation,
              exampleTarget,
              exampleNative,
              senses,
              usageLevel: normalizeWordUsageLevel((item as { usageLevel?: unknown }).usageLevel),
              importanceScore: normalizeWordImportanceScore((item as { importanceScore?: unknown }).importanceScore),
              contextSensitive: normalizeWordContextSensitive((item as { contextSensitive?: unknown }).contextSensitive),
              pronunciationAudioUrl: String(item.pronunciationAudioUrl || '').trim(),
              meaningItems: [],
              exampleItems: exampleItems.length > 0 ? exampleItems : (
                senseExamples.length > 0
                  ? senseExamples
                  :
                exampleTarget && exampleNative
                  ? [{ targetText: exampleTarget, nativeText: exampleNative }]
                  : []
              ),
            }
          })
        : []
      setTodayWords(normalizedItems)
      void cleanupIncompleteWordsSilent()
      normalizedItems.forEach((item) => {
        if (!isCjkTargetLanguage(item.targetLanguage)) return
        const examples = item.exampleItems ?? (item.exampleTarget && item.exampleNative ? [{ targetText: item.exampleTarget, nativeText: item.exampleNative, targetPinyin: undefined }] : [])
        examples.forEach((ex) => {
          const exampleText = String(ex.targetText || '').trim()
          const hasPinyin = String(ex.targetPinyin || '').trim()
          if (exampleText && !hasPinyin) void ensureWritingRomanization(exampleText, item.targetLanguage)
        })
      })
    } catch {
      // keep learning flow even if session words fail
    } finally {
      setTodayWordsBusy(false)
    }
  }

  const findSessionWord = (word: string) => {
    const targetWord = extractClickableWord(String(word || '').trim()).toLowerCase() || String(word || '').trim().toLowerCase()
    return todayWords.find((item) => {
      const candidate = extractClickableWord(String(item.word || '').trim()).toLowerCase() || String(item.word || '').trim().toLowerCase()
      return candidate === targetWord
    })
  }

  const saveDailyWord = async (
    word: string,
    detail: Partial<WordInsight>,
    pronunciationAudioUrl?: string,
    sessionIdOverride?: string
  ) => {
    if (learningMode === 'reflex') return
    const meaning = String(detail.meaning || '').trim()
    if (!meaning) {
      return
    }
    const date = getLocalDateString()
    const sid = sessionIdOverride || sessionId
    if (!sid) return
    const { ok, data } = await saveWordDaily({
        sessionId: sid,
        learnedDate: date,
        word,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        meaning: String(detail.meaning || '').trim(),
        pronunciation: String(detail.pronunciation || '').trim(),
        pronunciationAudioUrl: pronunciationAudioUrl || '',
        exampleTarget: String(detail.exampleTarget || '').trim(),
        exampleNative: String(detail.exampleNative || '').trim(),
        usageLevel: normalizeWordUsageLevel((detail as { usageLevel?: unknown }).usageLevel),
        importanceScore: normalizeWordImportanceScore((detail as { importanceScore?: unknown }).importanceScore),
        contextSensitive: normalizeWordContextSensitive((detail as { contextSensitive?: unknown }).contextSensitive),
        senses: sanitizeWordSenses((detail as { senses?: unknown }).senses),
        meaningItems: [],
        exampleItems: sanitizeWordExampleItems((detail as { exampleItems?: unknown }).exampleItems),
    })
    if (!ok) {
      throw new Error(data.error || localText('Không lưu được từ mới.', 'Failed to save new word.'))
    }
    void fetchLearningSnapshot()
    void fetchReviewDue()
  }

  const loadHistorySession = async (targetSessionId: string) => {
    if (!targetSessionId) return
    if (openedHistorySessionId === targetSessionId && !historyBusy) {
      scrollToSpeakActions()
      return
    }
    const requestSeq = loadHistoryRequestSeqRef.current + 1
    loadHistoryRequestSeqRef.current = requestSeq
    setHistoryBusy(true)
    setReviewDrillStage('idle')
    setReviewMiniPackCompleted(false)
    setReviewListeningPopupOpen(false)
    setReviewListeningPrompt('')
    setReviewListeningOptions([])
    setReviewListeningVisibleOptions([])
    setReviewListeningRemainingOptions([])
    setReviewListeningExpectedKeywords([])
    setReviewListeningRequiredCount(3)
    setReviewListeningResultByWord({})
    setReviewListeningSelected([])
    let presetOpeningToReplay: { messageId: string; text: string } | null = null
    try {
      const { ok, data } = await getHistorySession(targetSessionId)
      if (loadHistoryRequestSeqRef.current !== requestSeq) return
      const payload = data as {
        items?: Array<{
          id: string
          role: 'teacher' | 'student'
          text: string
          audioUrl?: string
          translation?: string
          languageCode?: string
          teacherLabel?: string
          mode?: string
          mainSentence?: string | null
          correctionNote?: string | null
          intentAnswer?: string | null
          tokensJson?: string | null
          writingTaskJson?: string | null
          aiPayloadJson?: string | null
        }>
        learningMode?: 'review' | 'reflex'
        topicId?: string
        topicLabel?: string
        reviewDrill?: {
          speaking?: {
            targetSentence?: string
            minSimilarity?: number
            minPronunciationScore?: number
            attempt?: number
          }
          listening?: {
            prompt?: string
            expectedKeywords?: string[]
            options?: string[]
            minMatchedKeywords?: number
            attempt?: number
          }
        }
        miniStageSnapshot?: {
          stage?: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
          updatedAt?: string
        }
        presetReplay?: {
          active?: boolean
          sourceLessonId?: string
          nextTurnIndex?: number
          totalTurns?: number
          expectedStudentText?: string
        }
        presetReplaySession?: boolean
        presetReplaySourceLessonId?: string
        error?: string
      }
      if (!ok) throw new Error(payload.error || localText('Không tải được nội dung buổi học.', 'Failed to load lesson content.'))
      if (loadHistoryRequestSeqRef.current !== requestSeq) return

      const items = Array.isArray(payload.items) ? payload.items : []
      const loadedLearningMode: 'review' | 'reflex' =
        payload.learningMode === 'reflex' ? 'reflex' : 'review'
      if (payload.learningMode === 'reflex' || payload.learningMode === 'review') {
        setLearningMode(payload.learningMode)
      }
      setSessionId(targetSessionId)
      setMessages(items.map((x) => ({ id: x.id, role: x.role, text: x.text })))
      const loadedStudentTurns = items.filter((x) => x.role === 'student').length
      setSessionEntryStudentTurnBaseline(loadedStudentTurns)
      const inferredExtraUnlocks =
        loadedStudentTurns > LIVE_SESSION_BASE_TURN_LIMIT
          ? Math.ceil((loadedStudentTurns - LIVE_SESSION_BASE_TURN_LIMIT) / LIVE_SESSION_EXTRA_TURN_STEP)
          : 0
      setLiveSessionExtraTurnUnlocks(Math.max(0, inferredExtraUnlocks))
      const presetSessionLoaded = Boolean(payload.presetReplaySession)
      setIsCurrentPresetSession(presetSessionLoaded)
      const presetExpected = sanitizeLearnerReadingSentence(String(payload.presetReplay?.expectedStudentText || '').trim())
      setPresetReplayExpectedSentence(presetSessionLoaded ? presetExpected : '')
      if (!presetSessionLoaded) {
        await syncSessionCreditStatus(targetSessionId)
      }
      setCorrectionsByMessageId({})
      const firstTeacherIdx = items.findIndex((x) => x.role === 'teacher')
      const openingTrans: Record<string, string> = {}
      const intentTrans: Record<string, string> = {}
      items.forEach((item, idx) => {
        const trans = String((item as { translation?: string }).translation || '').trim()
        if (!trans || item.role !== 'teacher') return
        if (idx === firstTeacherIdx) openingTrans[item.id] = trans
        else intentTrans[item.id] = trans
      })
      setOpeningTranslateByMessageId(openingTrans)
      setIntentExplainByMessageId(intentTrans)
      const firstMetaForLang = items.find((x) => x.role === 'teacher') || items[0]
      const langForSanitize = String(firstMetaForLang?.languageCode || '').trim() as LanguageCode
      const mainSentenceMap: Record<string, string> = {}
      const correctionNoteMap: Record<string, string> = {}
      const intentAnswerMap: Record<string, string> = {}
      const correctionsMap: Record<string, Correction[]> = {}
      const tokensMap: Record<string, string[]> = {}
      const tokensWithUsageMap: Record<string, Array<{ word: string; usageLevel: 'high' | 'medium' | 'low' }>> = {}
      items.forEach((item) => {
        if (item.role !== 'teacher') return
        const msRaw = String((item as { mainSentence?: string | null }).mainSentence || '').trim()
        const ms = msRaw ? sanitizeForDisplay(msRaw, langForSanitize || 'zh') : ''
        if (ms) mainSentenceMap[item.id] = ms
        const cn = sanitizeIdeaContent(String((item as { correctionNote?: string | null }).correctionNote || '').trim())
        if (cn) correctionNoteMap[item.id] = cn
        const iaRaw = String((item as { intentAnswer?: string | null }).intentAnswer || '').trim()
        const ia = iaRaw ? sanitizeForDisplay(sanitizeIdeaContent(iaRaw), langForSanitize || 'zh') : ''
        if (ia) intentAnswerMap[item.id] = ia
        const aiPayloadJsonRaw = String((item as { aiPayloadJson?: string | null }).aiPayloadJson || '').trim()
        if (aiPayloadJsonRaw) {
          try {
            const parsed = JSON.parse(aiPayloadJsonRaw) as { corrections?: unknown[] }
            const parsedCorrections = Array.isArray(parsed.corrections)
              ? parsed.corrections
                  .map((c) => {
                    const row = c as { original?: unknown; fixed?: unknown; explanationVi?: unknown }
                    return {
                      original: sanitizeIdeaContent(String(row.original || '').trim()),
                      fixed: sanitizeIdeaContent(String(row.fixed || '').trim()),
                      explanationVi: sanitizeIdeaContent(String(row.explanationVi || '').trim()),
                    }
                  })
                  .filter((c) => c.original || c.fixed || c.explanationVi)
              : []
            if (parsedCorrections.length > 0) {
              correctionsMap[item.id] = parsedCorrections
            }
          } catch {
            // ignore invalid aiPayloadJson
          }
        }
        const tj = String((item as { tokensJson?: string | null }).tokensJson || '').trim()
        if (tj) {
          try {
            const parsed = JSON.parse(tj) as Array<{ word?: string; usageLevel?: string }>
            if (Array.isArray(parsed)) {
              const withUsage = parsed
                .map((t) => ({
                  word: String(t.word || '').trim(),
                  usageLevel: (['high', 'medium', 'low'].includes(String(t.usageLevel || '').toLowerCase())
                    ? String(t.usageLevel).toLowerCase()
                    : 'medium') as 'high' | 'medium' | 'low',
                }))
                .filter((t) => t.word)
              if (withUsage.length > 0) {
                tokensMap[item.id] = withUsage.map((t) => t.word)
                tokensWithUsageMap[item.id] = withUsage
              }
            }
          } catch {
            // ignore invalid tokensJson
          }
        }
      })
      setMainSentenceByMessageId(mainSentenceMap)
      setCorrectionNoteByMessageId(correctionNoteMap)
      setIntentAnswerByMessageId(intentAnswerMap)
      setCorrectionsByMessageId(correctionsMap)
      setTokensByMessageId(tokensMap)
      setTokensWithUsageByMessageId(tokensWithUsageMap)
      const preloadRomanization: Record<string, string> = {}
      items.forEach((item) => {
        if (item.role !== 'teacher') return
        const lang = String((item as { languageCode?: string }).languageCode || '').trim().toLowerCase()
        const msRaw = String((item as { mainSentence?: string | null }).mainSentence || '').trim()
        const ms = msRaw ? sanitizeForDisplay(msRaw, (langForSanitize || lang) as LanguageCode) : ''
        const cn = sanitizeIdeaContent(String((item as { correctionNote?: string | null }).correctionNote || '').trim())
        const iaRaw = String((item as { intentAnswer?: string | null }).intentAnswer || '').trim()
        const ia = iaRaw ? sanitizeForDisplay(sanitizeIdeaContent(iaRaw), (langForSanitize || lang) as LanguageCode) : ''
        const mst = (item as { mainSentenceTransliteration?: string | null }).mainSentenceTransliteration
        const cnt = (item as { correctionNoteTransliteration?: string | null }).correctionNoteTransliteration
        const iat = (item as { intentAnswerTransliteration?: string | null }).intentAnswerTransliteration
        if (ms && mst) preloadRomanization[`${lang}::${ms}`] = sanitizeRomanizedText(String(mst).trim())
        if (cn && cnt) preloadRomanization[`${lang}::${cn}`] = sanitizeRomanizedText(String(cnt).trim())
        if (ia && iat) preloadRomanization[`${lang}::${ia}`] = sanitizeRomanizedText(String(iat).trim())
      })
      const wtTrans = (payload as { writingTaskTransliterations?: Record<string, string> }).writingTaskTransliterations
      const lastTeacherForTrans = items.filter((x) => x.role === 'teacher').pop()
      if (lastTeacherForTrans && wtTrans && Object.keys(wtTrans).length > 0) {
        const lang = String((lastTeacherForTrans as { languageCode?: string }).languageCode || '').trim().toLowerCase()
        for (const [sentence, transliteration] of Object.entries(wtTrans)) {
          const t = String(sentence || '').trim()
          if (t && transliteration) preloadRomanization[`${lang}::${t}`] = sanitizeRomanizedText(String(transliteration).trim())
        }
      }
      if (Object.keys(preloadRomanization).length > 0) {
        setWritingRomanizationByKey((prev) => ({ ...prev, ...preloadRomanization }))
      }
      const lastTeacherItem = [...items].reverse().find((x) => x.role === 'teacher')
      const firstMeta = items.find((x) => x.role === 'teacher') || items[0]
      const metaLanguage = String(firstMeta?.languageCode || '').trim() as LanguageCode
      const restoreLanguageCode = metaLanguage || languageCode
      const wtj = lastTeacherItem ? String((lastTeacherItem as { writingTaskJson?: string | null }).writingTaskJson || '').trim() : ''
      let writingRestored = false
      let writingCompletedRestored = false
      if (loadedLearningMode === 'reflex') {
        setWritingTask(null)
        setWritingDraft('')
        setWritingEvalResult(null)
      } else if (lastTeacherItem && wtj) {
        try {
          const parsed = JSON.parse(wtj) as { messageId?: string; requiredSentences?: string[]; currentIndex?: number; completed?: boolean; teacherText?: string; instruction?: string; referenceSentence?: string; taskType?: string }
          if (parsed && Array.isArray(parsed.requiredSentences) && parsed.requiredSentences.length > 0) {
            const isCompleted = Boolean(parsed.completed)
            const sanitized = parsed.requiredSentences.map((s: string) => sanitizeSentenceForCopy(String(s || '').trim(), metaLanguage || 'zh')).filter(Boolean)
            const finalSentences = sanitized.length > 0 ? sanitized : parsed.requiredSentences
            const refIdx = Math.max(0, Math.min(parsed.currentIndex ?? 0, finalSentences.length - 1))
            setWritingTask({
              messageId: parsed.messageId || lastTeacherItem.id,
              taskType: (parsed.taskType as WritingTaskType) || 'copy',
              instruction: parsed.instruction || localText('Hãy gõ lại y nguyên từng câu theo thứ tự. Chỉ khi gõ đúng mới mở lượt nói tiếp theo.', 'Type each sentence exactly in order. The next speaking turn unlocks only after exact copy.'),
              referenceSentence: finalSentences[refIdx] || finalSentences[0] || '',
              requiredSentences: finalSentences,
              currentIndex: isCompleted ? Math.max(0, finalSentences.length - 1) : Math.max(0, Math.min(parsed.currentIndex ?? 0, finalSentences.length - 1)),
              teacherText: parsed.teacherText || lastTeacherItem.text,
              completed: isCompleted,
            })
            setWritingDraft('')
            setWritingEvalResult(null)
            writingRestored = true
            writingCompletedRestored = isCompleted
          }
        } catch {
          // ignore invalid writing_task_json
        }
      }
      if (loadedLearningMode !== 'reflex' && lastTeacherItem) {
        try {
          const key = getWritingTaskProgressStorageKey(targetSessionId)
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
          if (raw) {
            const localTask = JSON.parse(raw) as {
              messageId?: string
              requiredSentences?: string[]
              currentIndex?: number
              completed?: boolean
              teacherText?: string
              instruction?: string
              referenceSentence?: string
              taskType?: string
            }
            const sameMessage = String(localTask.messageId || '') === String(lastTeacherItem.id || '')
            const hasSentences = Array.isArray(localTask.requiredSentences) && localTask.requiredSentences.length > 0
            if (sameMessage && hasSentences) {
              const localIndex = Math.max(0, Math.min(Number(localTask.currentIndex || 0), localTask.requiredSentences!.length - 1))
              const localCompleted = Boolean(localTask.completed)
              writingRestored = true
              writingCompletedRestored = writingCompletedRestored || localCompleted
              setWritingTask((prev) => {
                if (!prev || prev.messageId !== String(lastTeacherItem.id || '')) {
                  return {
                    messageId: String(localTask.messageId || lastTeacherItem.id || ''),
                    taskType: (localTask.taskType as WritingTaskType) || 'copy',
                    instruction: String(localTask.instruction || localText('Hãy gõ lại y nguyên từng câu theo thứ tự. Chỉ khi gõ đúng mới mở lượt nói tiếp theo.', 'Type each sentence exactly in order. The next speaking turn unlocks only after exact copy.')),
                    referenceSentence: String(localTask.referenceSentence || localTask.requiredSentences![localIndex] || ''),
                    requiredSentences: localTask.requiredSentences!,
                    currentIndex: localCompleted ? Math.max(0, localTask.requiredSentences!.length - 1) : localIndex,
                    teacherText: String(localTask.teacherText || lastTeacherItem.text || ''),
                    completed: localCompleted,
                  }
                }
                if (localCompleted && !prev.completed) return { ...prev, completed: true, currentIndex: Math.max(prev.currentIndex, prev.requiredSentences.length - 1) }
                if (!localCompleted && localIndex > prev.currentIndex) {
                  return {
                    ...prev,
                    currentIndex: localIndex,
                    referenceSentence: prev.requiredSentences[localIndex] || prev.referenceSentence,
                  }
                }
                return prev
              })
            }
          }
        } catch {
          // ignore invalid local progress backup
        }
      }
      if (loadedLearningMode !== 'reflex' && !writingRestored) {
        setWritingTask(null)
        setWritingDraft('')
        setWritingEvalResult(null)
      }
      if (loadedLearningMode !== 'reflex') {
        const activeReviewDrill = payload.reviewDrill
        const activeSpeaking = activeReviewDrill?.speaking
        const activeListening = activeReviewDrill?.listening
        const activeSpeakingTarget = String(activeSpeaking?.targetSentence || '').trim()
        const speakingTargetValid = activeSpeakingTarget
          ? isSentenceInTargetLanguage(activeSpeakingTarget, restoreLanguageCode as LanguageCode)
          : false
        const stageSnapshot = String(payload.miniStageSnapshot?.stage || '').trim().toLowerCase()
        const snapshotStage =
          stageSnapshot === 'writing'
          || stageSnapshot === 'speaking'
          || stageSnapshot === 'listening'
          || stageSnapshot === 'done'
          || stageSnapshot === 'idle'
            ? stageSnapshot
            : ''
        const shouldForceWritingFirstForPreset = presetSessionLoaded && !writingCompletedRestored

        // Fallback: if speaking drill exists but writing task snapshot is missing,
        // rebuild writing mini task from speaking target to keep 1->2->3 flow.
        if (!writingRestored && !writingCompletedRestored) {
          const speakingTarget = activeSpeakingTarget
          if (speakingTarget) {
            const syntheticTeacherText = String(lastTeacherItem?.text || speakingTarget).trim()
            const syntheticMessageId = String(lastTeacherItem?.id || '').trim()
            if (syntheticMessageId) {
              const rebuiltTask = buildWritingTask(syntheticMessageId, syntheticTeacherText, [speakingTarget])
              setWritingTask(rebuiltTask)
              setWritingDraft('')
              setWritingEvalResult(null)
              writingRestored = true
              writingCompletedRestored = false
              void persistWritingTaskSnapshot(rebuiltTask, 2)
            }
          }
        }

        if (snapshotStage === 'done') {
          setReviewDrillStage('idle')
          setReviewMiniPackCompleted(true)
          setWritingTask((prev) => {
            if (!prev) return prev
            const lastIndex = Math.max(0, prev.requiredSentences.length - 1)
            return {
              ...prev,
              completed: true,
              currentIndex: lastIndex,
              referenceSentence: prev.requiredSentences[lastIndex] || prev.referenceSentence,
            }
          })
          setWritingDraft('')
          setWritingEvalResult(null)
        } else if (snapshotStage === 'idle') {
          setReviewDrillStage('idle')
          setReviewMiniPackCompleted(writingRestored && writingCompletedRestored)
        } else if (snapshotStage === 'listening' && activeListening) {
          const promptForListening = String(activeListening.prompt || '').trim()
          let optsWords = Array.isArray(activeListening.options)
            ? activeListening.options.map((x) => String(x || '').trim()).filter(Boolean)
            : []
          if (optsWords.length === 0 && promptForListening) {
            optsWords = promptForListening
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .split(/\s+/)
              .map((x) => x.trim())
              .filter((x) => x.length >= 2)
              .slice(0, 16)
          }
          const expectedKeywords = Array.isArray(activeListening.expectedKeywords)
            ? activeListening.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean)
            : []
          const requiredCountRaw = Number(activeListening.minMatchedKeywords || 3)
          const requiredCount = Number.isFinite(requiredCountRaw)
            ? Math.max(1, Math.min(3, Math.floor(requiredCountRaw)))
            : 3
          const uniqueOptions = Array.from(new Set(optsWords))
          const visibleLimit = Math.min(8, Math.max(requiredCount + 2, 5))
          const seeded = ensureListeningVisibleHasCorrectOption(
            uniqueOptions.slice(0, visibleLimit),
            uniqueOptions.slice(visibleLimit),
            uniqueOptions,
            expectedKeywords
          )
          setReviewDrillStage('listening')
          setReviewListeningPrompt(promptForListening)
          setReviewListeningOptions(uniqueOptions)
          setReviewListeningVisibleOptions(seeded.visible)
          setReviewListeningRemainingOptions(seeded.remaining)
          setReviewListeningExpectedKeywords(expectedKeywords)
          setReviewListeningRequiredCount(requiredCount)
          setReviewListeningResultByWord({})
          setReviewListeningSelected([])
          setReviewListeningPopupOpen(true)
          setReviewMiniPackCompleted(false)
        } else if (snapshotStage === 'speaking' && activeSpeaking && speakingTargetValid) {
          if (shouldForceWritingFirstForPreset && writingRestored) {
            setReviewDrillStage('writing')
            setReviewMiniPackCompleted(false)
          } else {
            setReviewDrillStage('speaking')
            setReviewSpeakingTargetSentence(activeSpeakingTarget)
            setSpeakingDrillPhase('idle')
            setSpeakingDrillCycleCount(0)
            setSpeakingDrillBlob(null)
            setReviewMiniPackCompleted(false)
          }
        } else if (snapshotStage === 'writing' && writingRestored && !writingCompletedRestored) {
          setReviewDrillStage('writing')
          setReviewMiniPackCompleted(false)
        } else if (snapshotStage === 'writing' && writingCompletedRestored && activeSpeaking && speakingTargetValid) {
          setReviewDrillStage('speaking')
          setReviewSpeakingTargetSentence(activeSpeakingTarget)
          setSpeakingDrillPhase('idle')
          setSpeakingDrillCycleCount(0)
          setSpeakingDrillBlob(null)
          setReviewMiniPackCompleted(false)
        } else if (writingRestored && !writingCompletedRestored) {
          setReviewDrillStage('writing')
          setReviewMiniPackCompleted(false)
        } else if (activeSpeaking && speakingTargetValid) {
          if (shouldForceWritingFirstForPreset && writingRestored) {
            setReviewDrillStage('writing')
            setReviewMiniPackCompleted(false)
          } else {
            setReviewDrillStage('speaking')
            setReviewSpeakingTargetSentence(activeSpeakingTarget)
            setSpeakingDrillPhase('idle')
            setSpeakingDrillCycleCount(0)
            setSpeakingDrillBlob(null)
            setReviewMiniPackCompleted(false)
          }
        } else if (activeSpeaking && activeSpeakingTarget && !speakingTargetValid) {
          setReviewDrillStage('idle')
          setReviewMiniPackCompleted(true)
          setWritingTask(null)
          setReviewSpeakingTargetSentence('')
        } else if (activeListening) {
          const promptForListening = String(activeListening.prompt || '').trim()
          let optsWords = Array.isArray(activeListening.options)
            ? activeListening.options.map((x) => String(x || '').trim()).filter(Boolean)
            : []
          if (optsWords.length === 0 && promptForListening) {
            optsWords = promptForListening
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .split(/\s+/)
              .map((x) => x.trim())
              .filter((x) => x.length >= 2)
              .slice(0, 16)
          }
          const expectedKeywords = Array.isArray(activeListening.expectedKeywords)
            ? activeListening.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean)
            : []
          const requiredCountRaw = Number(activeListening.minMatchedKeywords || 3)
          const requiredCount = Number.isFinite(requiredCountRaw)
            ? Math.max(1, Math.min(3, Math.floor(requiredCountRaw)))
            : 3
          const uniqueOptions = Array.from(new Set(optsWords))
          const visibleLimit = Math.min(8, Math.max(requiredCount + 2, 5))
          const seeded = ensureListeningVisibleHasCorrectOption(
            uniqueOptions.slice(0, visibleLimit),
            uniqueOptions.slice(visibleLimit),
            uniqueOptions,
            expectedKeywords
          )
          setReviewDrillStage('listening')
          setReviewListeningPrompt(promptForListening)
          setReviewListeningOptions(uniqueOptions)
          setReviewListeningVisibleOptions(seeded.visible)
          setReviewListeningRemainingOptions(seeded.remaining)
          setReviewListeningExpectedKeywords(expectedKeywords)
          setReviewListeningRequiredCount(requiredCount)
          setReviewListeningResultByWord({})
          setReviewListeningSelected([])
          setReviewListeningPopupOpen(true)
          setReviewMiniPackCompleted(false)
        } else {
          setReviewDrillStage('idle')
          setReviewMiniPackCompleted(writingRestored && writingCompletedRestored)
        }
      }
      if (metaLanguage && TEACHERS_BY_LANGUAGE[metaLanguage]) {
        setLanguageCode(metaLanguage)
        const matchedByLabel = TEACHERS_BY_LANGUAGE[metaLanguage].find((t) => t.label === String(firstMeta?.teacherLabel || ''))
        const fallbackTeacher = matchedByLabel || TEACHERS_BY_LANGUAGE[metaLanguage][0]
        if (fallbackTeacher) {
          setTeacherId(fallbackTeacher.id)
          setSessionTeacher(fallbackTeacher)
        } else {
          setSessionTeacher(null)
        }
      } else {
        setSessionTeacher(null)
      }
      setMode(
        firstMeta?.mode === 'listen_speak'
          ? 'listen_speak'
          : firstMeta?.mode === 'roleplay_short'
            ? 'roleplay_short'
            : 'chat'
      )
      setCorrections([])
      setPronunciationTips([])
      lastMicSentTextRef.current = ''
      lastMicSentAtRef.current = 0
      setOpenedWordKey('')
      setWordBusyKey('')
      setWordInsightByKey({})
      wordSenseAutoPlayedByKeyRef.current = {}
      setTokenizingByMessageId({})
      const loadedAudioMap = items.reduce<Record<string, string>>((acc, item) => {
        if (item.role === 'teacher' && item.audioUrl) acc[item.id] = item.audioUrl
        return acc
      }, {})
      const loadedStudentAudioMap = items.reduce<Record<string, string>>((acc, item) => {
        if (item.role === 'student' && item.audioUrl) acc[item.id] = item.audioUrl
        return acc
      }, {})
      teacherAudioByMessageIdRef.current = loadedAudioMap
      setTeacherAudioByMessageId(loadedAudioMap)
      studentAudioByMessageIdRef.current = loadedStudentAudioMap
      setStudentAudioByMessageId(loadedStudentAudioMap)
      persistedMessageIdsRef.current = items.reduce<Record<string, true>>((acc, item) => {
        acc[item.id] = true
        return acc
      }, {})
      setOpenedHistorySessionId(targetSessionId)
      // Lock routing state to the exact opened session to avoid URL-effect reopening an older session.
      routeOpenSessionHandledRef.current = targetSessionId
      const basePath = isSavedStandalonePage ? '/hoc-bai-hoc-co-san' : '/hoc-tieng-anh-ai'
      const currentSessionIdInUrl = String(searchParams.get('sessionId') || '').trim()
      const shouldReplaceUrl = pathname !== basePath || currentSessionIdInUrl !== targetSessionId
      if (shouldReplaceUrl) {
        router.replace(`${basePath}?sessionId=${encodeURIComponent(targetSessionId)}`)
      }
      // After opening a session, jump user directly to the main action area (Speak / Input).
      requestAnimationFrame(() => {
        scrollToSpeakActions()
      })
      window.setTimeout(() => {
        scrollToSpeakActions()
      }, 120)
      void fetchSessionWords(targetSessionId)
      const sessionTopicId = String(payload.topicId || '').trim()
      const sessionTopicLabel = String(payload.topicLabel || '').trim()
      if (sessionTopicId && sessionTopicLabel && items.length > 0) {
        // Lock topic state to the loaded session so next turns do not fall back to default "solo-teacher".
        setTopicId(sessionTopicId)
        setPendingTopicId(sessionTopicId)
        setConfirmedTopicId(sessionTopicId)
        if (!allTopicOptions.some((x) => x.id === sessionTopicId)) {
          setCustomTopics((prev) => {
            if (prev.some((x) => x.topicId === sessionTopicId)) return prev
            return [
              {
                topicId: sessionTopicId,
                topicLabel: sessionTopicLabel,
                topicDifficulty: 'basic',
              },
              ...prev,
            ].slice(0, 30)
          })
          setTopicSourceMode('custom')
        }
        void fetchTopicCurriculum({ skipConfirm: true, topicId: sessionTopicId, topicLabelOverride: sessionTopicLabel, silent: true }).then((curriculum) => {
          if (curriculum) setTopicCurriculum(curriculum)
        })
      }
      if (Boolean(payload.presetReplaySession)) {
        const firstTeacher = items.find((x) => x.role === 'teacher')
        if (firstTeacher) {
          presetOpeningToReplay = { messageId: firstTeacher.id, text: firstTeacher.text }
        }
      }
    } catch (e) {
      if (loadHistoryRequestSeqRef.current !== requestSeq) return
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Không mở được buổi học', 'Cannot open session'), description: msg, variant: 'destructive' })
    } finally {
      if (loadHistoryRequestSeqRef.current !== requestSeq) return
      setHistoryBusy(false)
      if (presetOpeningToReplay) {
        window.setTimeout(() => {
          void replayTeacherMessage(presetOpeningToReplay!.messageId, presetOpeningToReplay!.text)
        }, 320)
      }
    }
  }

  const openSessionByRoute = useCallback((targetSessionId: string, isPresetReplaySession?: boolean) => {
    const sid = String(targetSessionId || '').trim()
    if (!sid) return
    const now = Date.now()
    if (now < sessionNavLockUntilRef.current) return
    sessionNavLockUntilRef.current = now + SESSION_NAV_LOCK_MS
    const targetPath = isPresetReplaySession ? '/hoc-bai-hoc-co-san' : '/hoc-tieng-anh-ai'
    const currentPath = String(pathname || '').trim()
    const currentSessionIdInUrl = String(searchParams.get('sessionId') || '').trim()
    const sameUrlTarget = currentPath === targetPath && currentSessionIdInUrl === sid

    routeOpenSessionHandledRef.current = ''
    if (sameUrlTarget) {
      void loadHistorySession(sid)
      return
    }
    router.replace(`${targetPath}?sessionId=${encodeURIComponent(sid)}`)
  }, [pathname, searchParams, router, loadHistorySession])

  useEffect(() => {
    const targetSessionId = String(searchParams.get('sessionId') || '').trim()
    if (!targetSessionId) return
    if (routeOpenSessionHandledRef.current === targetSessionId) return
    if (openedHistorySessionId === targetSessionId) {
      routeOpenSessionHandledRef.current = targetSessionId
      return
    }
    if (historyBusy) return
    routeOpenSessionHandledRef.current = targetSessionId
    void loadHistorySession(targetSessionId)
  }, [searchParams, openedHistorySessionId, historyBusy])

  useEffect(() => {
    if (isSavedStandalonePage) return
    const autoStartFlag = String(searchParams.get('autoStart') || '').trim().toLowerCase()
    if (autoStartFlag !== 'live') return
    if (crossPageStartHandledRef.current === autoStartFlag) return
    crossPageStartHandledRef.current = autoStartFlag

    let pendingTopicId = ''
    let pendingTopicLabel = ''
    try {
      const raw = window.sessionStorage.getItem(CROSS_PAGE_START_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { action?: string; topicId?: string; topicLabel?: string }
        if (String(parsed.action || '').trim() === 'start_live') {
          pendingTopicId = String(parsed.topicId || '').trim()
          pendingTopicLabel = String(parsed.topicLabel || '').trim()
        }
      }
      window.sessionStorage.removeItem(CROSS_PAGE_START_STORAGE_KEY)
    } catch {
      // ignore sessionStorage failures
    }

    const topicFromPending =
      (pendingTopicId && allTopicOptions.find((x) => String(x.id || '').trim() === pendingTopicId))
      || (pendingTopicLabel
        ? allTopicOptions.find((x) => String(x.label || '').trim() === pendingTopicLabel)
        : undefined)
      || selectedTopic

    void startLiveLessonFromChoice({
      curriculum: null,
      topic: topicFromPending,
    }).finally(() => {
      router.replace('/hoc-tieng-anh-ai')
    })
  }, [searchParams, isSavedStandalonePage, allTopicOptions, selectedTopic, router])

  const endLessonAndStartNew = async () => {
    const currentSessionId = sessionId
    if (currentSessionId) {
      const curriculum = topicCurriculum || preLessonCurriculum
      const steps = curriculum?.lessonSteps ?? []
      const studentTurnCount = messages.filter((m) => m.role === 'student').length
      const completedCount = computeTimelineCompletedSteps(steps.length, studentTurnCount)
      const qualityPassed = steps.length > 0 && completedCount >= steps.length
      await endHistorySession(currentSessionId, {
        qualityPassed,
        completionReason: qualityPassed ? 'timeline_completed' : 'not_qualified_auto_deleted',
      })
      setHistorySessions((prev) => prev.filter((s) => s.sessionId !== currentSessionId))
    }
    startNewSession()
    void fetchHistorySessions()
    toast({
      title: localText('Đã kết thúc buổi học', 'Lesson ended'),
      description: localText('Bạn có thể chọn chủ đề khác để bắt đầu bài mới.', 'You can choose another topic to start a new lesson.'),
    })
  }

  const startNewSession = () => {
    if (startingLesson || busy || historyBusy) return
    lessonCompletedToastShownForSessionRef.current = null
    setWordPractice(null)
    setSessionId(createSessionId())
    shouldCountNewSessionRef.current = true
    setSessionTeacher(null)
    setIsCurrentPresetSession(false)
    setPresetReplayExpectedSentence('')
    setSessionEntryStudentTurnBaseline(0)
    setLiveSessionExtraTurnUnlocks(0)
    setOpenedHistorySessionId('')
    lastMicSentTextRef.current = ''
    lastMicSentAtRef.current = 0
    pendingRecordingBlobRef.current = null
    setRecordingPending(false)
    setListening(false)
    setReviewMiniPackCompleted(false)
    setReviewDrillStage('idle')
    setReviewListeningPopupOpen(false)
    setReviewListeningPrompt('')
    setReviewListeningOptions([])
    setReviewListeningVisibleOptions([])
    setReviewListeningRemainingOptions([])
    setReviewListeningExpectedKeywords([])
    setReviewListeningRequiredCount(3)
    setReviewListeningResultByWord({})
    setReviewListeningSelected([])
    setReviewSpeakingTargetSentence('')
    setSpeakingDrillPhase('idle')
    setSpeakingDrillCycleCount(0)
    setSpeakingDrillBlob(null)
    setMessages([])
    setCorrections([])
    setCorrectionsByMessageId({})
    setPronunciationTips([])
    setTodayWords([])
    setOpenedWordKey('')
    setWordBusyKey('')
    setWordInsightByKey({})
    wordSenseAutoPlayedByKeyRef.current = {}
    setTokensByMessageId({})
    setTokensWithUsageByMessageId({})
    setTokenizingByMessageId({})
    setMainSentenceByMessageId({})
    setCorrectionNoteByMessageId({})
    setIntentAnswerByMessageId({})
    studentAudioByMessageIdRef.current = {}
    setStudentAudioByMessageId({})
    setTeacherSpeakTextByMessageId({})
    setIntentExplainByMessageId({})
    setIntentExplainBusyByMessageId({})
    setOpeningTranslateByMessageId({})
    setOpeningTranslateBusyByMessageId({})
    setLatestPronunciationScore(null)
    setLatestWeakWords([])
    setLatestPronunciationBreakdown({ accuracy: null, fluency: null, prosody: null })
    setLatestWordScores([])
    setWritingTask(null)
    setWritingDraft('')
    setWritingEvalResult(null)
    setWritingRomanizationByKey({})
    setWritingRomanizationBusyByKey({})
    lastAutoScrollTokenMessageIdRef.current = ''
    teacherAudioByMessageIdRef.current = {}
    persistedMessageIdsRef.current = {}
    setTeacherAudioByMessageId({})
    setTtsLoadingByKey({})
  }

  useEffect(() => {
    void fetchHistorySessions().catch(() => {
      // allow feature to continue even if history cannot load
    })
    void fetchSessionWords().catch(() => {
      // allow feature to continue even if daily words cannot load
    })
    void fetchLearningSnapshot()
    void fetchReviewDue()
    void fetchCustomTopics()
  }, [])

  useEffect(() => {
    if (!supportsLatinTransliteration) return
    const reference = String(writingTask?.referenceSentence || '').trim()
    const required = Array.isArray(writingTask?.requiredSentences)
      ? writingTask!.requiredSentences!.map((x) => String(x || '').trim()).filter(Boolean)
      : []
    const corrected = String(writingEvalResult?.correctedText || '').trim()
    if (reference) void ensureWritingRomanization(reference)
    required.forEach((x) => void ensureWritingRomanization(x))
    if (corrected) void ensureWritingRomanization(corrected)
  }, [supportsLatinTransliteration, writingTask?.referenceSentence, writingTask?.requiredSentences, writingEvalResult?.correctedText, languageCode])

  useEffect(() => {
    const curriculum = topicCurriculum || preLessonCurriculum
    const steps = curriculum?.lessonSteps ?? []
    if (steps.length === 0 || !sessionId) return
    const studentTurnCount = messages.filter((m) => m.role === 'student').length
    const completedCount = computeTimelineCompletedSteps(steps.length, studentTurnCount)
    if (completedCount >= steps.length && lessonCompletedToastShownForSessionRef.current !== sessionId) {
      lessonCompletedToastShownForSessionRef.current = sessionId
      toast({
        title: localText('Đã hoàn thành các bước trong giáo trình', 'Curriculum steps completed'),
        description: localText(
          'Có thể tiếp tục luyện hoặc bắt đầu bài mới.',
          'You can continue practicing or start a new lesson.'
        ),
      })
    }
    if (completedCount < steps.length) return
    const messageCount = messages.length
    const lastSavedMessageCount = lessonAutoSnapshotMessageCountBySessionRef.current[sessionId] ?? 0
    if (messageCount <= lastSavedMessageCount || lessonAutoSnapshotBusyRef.current) return
    lessonAutoSnapshotBusyRef.current = true
    void snapshotCompletedLessonSession(sessionId)
      .then(({ ok }) => {
        if (ok) lessonAutoSnapshotMessageCountBySessionRef.current[sessionId] = messageCount
      })
      .finally(() => {
        lessonAutoSnapshotBusyRef.current = false
      })
  }, [messages, topicCurriculum, preLessonCurriculum, sessionId, toast])

  useEffect(() => {
    const collectExamples = (items: Array<{ targetLanguage?: string; exampleItems?: Array<{ targetText?: string; targetPinyin?: string }>; exampleTarget?: string; exampleNative?: string }>) => {
      const out: Array<{ text: string; targetLang: string }> = []
      for (const item of items) {
        if (!isCjkTargetLanguage(item.targetLanguage)) continue
        const examples = item.exampleItems ?? (item.exampleTarget && item.exampleNative ? [{ targetText: item.exampleTarget, nativeText: item.exampleNative, targetPinyin: undefined }] : [])
        for (const ex of examples) {
          const t = String(ex.targetText || '').trim()
          const hasPinyin = String(ex.targetPinyin || '').trim()
          if (t && !hasPinyin) out.push({ text: t, targetLang: item.targetLanguage || '' })
        }
      }
      return out
    }
    const pairs = [...collectExamples(reviewItems), ...collectExamples(todayWords)]
    pairs.forEach(({ text, targetLang }) => void ensureWritingRomanization(text, targetLang))
  }, [reviewItems, todayWords, languageCode])

  useEffect(() => {
    const loadLearnerName = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const profile = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        const profileName = String((profile.data as { full_name?: string } | null)?.full_name || '').trim()
        const userMeta = user.user_metadata as {
          full_name?: string
          name?: string
          coach_job?: string
          coach_city?: string
          coach_age?: number | string
          coach_gender?: string
        } | undefined
        const metaName = String(userMeta?.full_name || userMeta?.name || '').trim()
        const metaJob = String(userMeta?.coach_job || '').trim()
        const metaCity = String(userMeta?.coach_city || '').trim()
        const metaAge = String(userMeta?.coach_age || '').trim()
        const metaGender = String(userMeta?.coach_gender || '').trim().toLowerCase()
        const resolvedName = profileName || metaName || ''
        setLearnerDisplayName(resolvedName)
        setLearnerProfileNameDraft(resolvedName)
        setLearnerProfileJobDraft(metaJob)
        setLearnerProfileCityDraft(metaCity)
        setLearnerProfileAgeDraft(metaAge)
        setLearnerProfileGenderDraft(
          metaGender === 'male' || metaGender === 'female' || metaGender === 'other' ? metaGender : ''
        )
        if (typeof window !== 'undefined') {
          const dismissed = window.localStorage.getItem(LEARNER_PROFILE_PROMPT_DISMISSED_KEY) === '1'
          const missingProfileInfo = !resolvedName || !metaJob || !metaCity || !metaAge || !metaGender
          if (!dismissed && missingProfileInfo) {
            setLearnerProfilePromptOpen(true)
          }
        }
      } catch {
        // keep page usable when profile lookup fails
      }
    }
    void loadLearnerName()
  }, [supabase])

  const submitLearnerProfilePrompt = async () => {
    if (learnerProfileBusy) return
    const fullName = String(learnerProfileNameDraft || '').trim()
    const coachJob = String(learnerProfileJobDraft || '').trim()
    const coachCity = String(learnerProfileCityDraft || '').trim()
    const ageRaw = String(learnerProfileAgeDraft || '').trim()
    const coachAge = Number.isFinite(Number(ageRaw)) ? Math.max(1, Math.min(120, Math.round(Number(ageRaw)))) : 0
    const coachGender = String(learnerProfileGenderDraft || '').trim().toLowerCase()
    if (!fullName) {
      toast({
        title: localText('Thiếu tên hiển thị', 'Display name is required'),
        description: localText('Vui lòng nhập tên để cá nhân hóa bài học.', 'Please enter your name to personalize lessons.'),
        variant: 'destructive',
      })
      return
    }
    if (!coachAge) {
      toast({
        title: localText('Thiếu tuổi', 'Age is required'),
        description: localText('Vui lòng nhập tuổi hợp lệ.', 'Please enter a valid age.'),
        variant: 'destructive',
      })
      return
    }
    if (!['male', 'female', 'other'].includes(coachGender)) {
      toast({
        title: localText('Thiếu giới tính', 'Gender is required'),
        description: localText('Vui lòng chọn giới tính để cá nhân hóa.', 'Please select your gender for personalization.'),
        variant: 'destructive',
      })
      return
    }
    setLearnerProfileBusy(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          name: fullName,
          coach_job: coachJob,
          coach_city: coachCity,
          coach_age: coachAge,
          coach_gender: coachGender,
        },
      })
      if (authErr) throw authErr
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', (await supabase.auth.getUser()).data.user?.id || '')
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LEARNER_PROFILE_PROMPT_DISMISSED_KEY, '1')
      }
      setLearnerDisplayName(fullName)
      setLearnerProfilePromptOpen(false)
      toast({
        title: localText('Đã lưu thông tin cá nhân hóa', 'Profile info saved'),
        description: localText('Bài học có sẵn sẽ cá nhân hóa theo tài khoản của bạn.', 'Saved lessons will be personalized to your account.'),
      })
    } catch (e) {
      toast({
        title: localText('Không lưu được thông tin', 'Cannot save profile info'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setLearnerProfileBusy(false)
    }
  }

  const skipLearnerProfilePrompt = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LEARNER_PROFILE_PROMPT_DISMISSED_KEY, '1')
    }
    setLearnerProfilePromptOpen(false)
  }

  useEffect(() => {
    void fetchCustomTopics()
  }, [activeTeacher.languageLabel, selectedNativeLanguage.apiLabel, learnerLevel])

  useEffect(() => {
    if (learningMode === 'reflex') return
    const localUpdates: Record<string, string[]> = {}
    for (const message of messages) {
      if (message.role !== 'teacher') continue
      if (tokensByMessageId[message.id] || tokenizingByMessageId[message.id]) continue
      // Gom ý 2 (câu sửa hoàn chỉnh) và ý 3 (trả lời ngữ cảnh) để tách từ trong một lần gọi AI.
      // Đảm bảo từ mới được trích từ đúng nội dung học viên cần luyện.
      const idea2 = String(mainSentenceByMessageId[message.id] || '').trim()
      const idea3 = String(intentAnswerByMessageId[message.id] || '').trim()
      const tokenSource = [idea2, idea3].filter(Boolean).join('\n') || message.text
      // Always use AI tokenization for accuracy across mixed/target scripts.
      const mustUseAi = true
      if (mustUseAi || shouldUseAiTokenize(tokenSource)) {
        void fetchMessageTokens(message.id, tokenSource)
      } else {
        const fallback = basicTokenizeBySpace(tokenSource)
        localUpdates[message.id] = fallback
        setTokensWithUsageByMessageId((prev) => ({
          ...prev,
          [message.id]: fallback.map((w) => ({ word: w, usageLevel: 'medium' as const })),
        }))
      }
    }
    if (Object.keys(localUpdates).length > 0) {
      setTokensByMessageId((prev) => ({ ...prev, ...localUpdates }))
    }
  }, [learningMode, messages, tokensByMessageId, tokenizingByMessageId, mainSentenceByMessageId, intentAnswerByMessageId])

  useEffect(() => {
    const latestTeacherWithTokens = [...messages]
      .reverse()
      .find((m) => m.role === 'teacher' && (tokensByMessageId[m.id] || []).length > 0)
    if (!latestTeacherWithTokens) return
    if (lastAutoScrollTokenMessageIdRef.current === latestTeacherWithTokens.id) return
    lastAutoScrollTokenMessageIdRef.current = latestTeacherWithTokens.id
    const el = chatScrollRef.current
    if (!el) return
    window.requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [messages, tokensByMessageId])

  useEffect(() => {
    if (!busy) return
    const el = chatScrollRef.current
    if (!el) return
    window.requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [busy])

  useEffect(() => {
    try {
      const webLocale = getWebLocaleFromCookie()
      const saved = localStorage.getItem(NATIVE_LANGUAGE_PREF_KEY)
      if (saved && NATIVE_LANGUAGE_CODES.includes(saved as NativeLanguageCode)) {
        setNativeLanguageCode(saved as NativeLanguageCode)
        return
      }
      if (webLocale && NATIVE_LANGUAGE_CODES.includes(webLocale as NativeLanguageCode)) {
        setNativeLanguageCode(webLocale as NativeLanguageCode)
        localStorage.setItem(NATIVE_LANGUAGE_PREF_KEY, webLocale)
        return
      }
      const detected = detectNativeLanguageFromBrowser()
      setNativeLanguageCode(detected)
      localStorage.setItem(NATIVE_LANGUAGE_PREF_KEY, detected)
    } catch {
      // ignore storage issues and keep fallback value
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LESSON_SETUP_PREF_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        languageCode?: string
        teacherId?: string
        learnerLevel?: number
        topicSourceMode?: string
        pendingTopicId?: string
        learningMode?: string
      }
      if (parsed.languageCode && LANGUAGE_CODES.includes(parsed.languageCode as LanguageCode)) {
        setLanguageCode(parsed.languageCode as LanguageCode)
        const teachers = TEACHERS_BY_LANGUAGE[parsed.languageCode as LanguageCode]
        if (teachers?.some((t) => t.id === parsed.teacherId)) {
          setTeacherId(parsed.teacherId!)
        } else if (teachers?.[0]) {
          setTeacherId(teachers[0].id)
        }
      }
      if (typeof parsed.learnerLevel === 'number' && parsed.learnerLevel >= 0 && parsed.learnerLevel <= 4) {
        setLearnerLevel(parsed.learnerLevel as LearnerLevel)
      }
      if (parsed.topicSourceMode === 'builtin' || parsed.topicSourceMode === 'custom') {
        setTopicSourceMode(parsed.topicSourceMode)
      }
      if (typeof parsed.pendingTopicId === 'string' && parsed.pendingTopicId.trim()) {
        const tid = parsed.pendingTopicId.trim()
        setPendingTopicId(tid)
        setTopicId(tid)
      }
      if (parsed.learningMode === 'reflex' || parsed.learningMode === 'review') {
        setLearningMode(parsed.learningMode as LearningMode)
      }
    } catch {
      // ignore storage issues
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(NATIVE_LANGUAGE_PREF_KEY, nativeLanguageCode)
    } catch {
      // ignore storage issues
    }
  }, [nativeLanguageCode])

  useEffect(() => {
    try {
      localStorage.setItem(LESSON_SETUP_PREF_KEY, JSON.stringify({
        languageCode,
        teacherId,
        learnerLevel,
        topicSourceMode,
        pendingTopicId,
        topicId,
        learningMode,
      }))
    } catch {
      // ignore storage issues
    }
  }, [languageCode, teacherId, learnerLevel, topicSourceMode, pendingTopicId, topicId, learningMode])

  const handleSend = async (
    raw?: string,
    source: 'text' | 'mic' = 'text',
    micAnalysis?: MixedSpeechAnalysis,
    opts?: {
      existingStudentMessageId?: string
      studentAudioUrl?: string
      silentDrill?: boolean
      drillType?: 'listening'
      drillSelectedWords?: string[]
      drillSpeaking?: boolean
    }
  ) => {
    const studentText = String(raw ?? draft).trim()
    if (!studentText) return
    if (busy && !opts?.existingStudentMessageId) return
    if (isMiniDrillBlocking && !opts?.silentDrill && !opts?.drillSpeaking) {
      redirectToMiniDrill()
      return
    }
    if (source === 'mic') {
      const now = Date.now()
      const duplicate =
        studentText === lastMicSentTextRef.current && now - lastMicSentAtRef.current < 3000
      if (duplicate) return
      lastMicSentTextRef.current = studentText
      lastMicSentAtRef.current = now
    }

    const hadExistingMessage = Boolean(opts?.existingStudentMessageId)
    const isFromDrill = opts?.silentDrill || opts?.drillSpeaking || opts?.drillType === 'listening'
    const isPresetReplayTurnSubmission =
      isPresetPageSession
      && source === 'mic'
      && !isFromDrill
      && !hadExistingMessage
    if (isPresetPageSession && !isFromDrill && source === 'text') {
      toast({
        title: localText('Bài học có sẵn dùng ghi âm', 'Saved lesson uses voice recording'),
        description: localText(
          'Bấm "Nói" rồi "Gửi" để lưu câu đọc của bạn. Không gửi text ở bước này.',
          'Tap "Speak" then "Send" to submit your reading. Text send is disabled at this step.'
        ),
        variant: 'destructive',
      })
      return
    }
    if (!hadExistingMessage && !isFromDrill && liveSessionTurnLimitReached) {
      toast({
        title: localText('Đã chạm giới hạn lượt hỏi', 'Turn limit reached'),
        description: localText(
          `Buổi live hiện tại đã dùng ${liveSessionTurnLimit}/${liveSessionTurnLimit} lượt. Bấm mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit) để tiếp tục.`,
          `This live lesson has reached ${liveSessionTurnLimit}/${liveSessionTurnLimit} turns. Unlock ${LIVE_SESSION_EXTRA_TURN_STEP} more turns (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credits) to continue.`
        ),
        variant: 'destructive',
      })
      return
    }
    const shouldAppendStudentMessage = !isFromDrill
    if (!hadExistingMessage) {
      setBusy(true)
      setAwaitingTeacherReply(true)
    }
    const studentMessageId = hadExistingMessage
      ? opts!.existingStudentMessageId!
      : shouldAppendStudentMessage
        ? appendMessage('student', studentText)
        : ''
    if (hadExistingMessage && studentMessageId) {
      updateMessageText(studentMessageId, studentText)
    }
    if (!isFromDrill) setDraft('')
    if (shouldAppendStudentMessage && studentMessageId) {
      void saveHistoryMessage({ role: 'student', text: studentText, audioUrl: opts?.studentAudioUrl || '' })
        .then(() => {
          persistedMessageIdsRef.current[studentMessageId] = true
        })
        .catch(() => {
          // keep conversation usable if history save fails
        })
    }
    try {
      if (!sessionTeacher) {
        setSessionTeacher(selectedTeacher)
      }
      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }))
      const languagePairKey = toLanguagePairKey(nativeLanguageCode, languageCode)
      const { ok, data } = await chatWithCoach({
        sessionId,
        studentText,
        history,
        learningMode,
        accent: activeTeacher.accent || 'us',
        gender: activeTeacher.gender,
        mode: learningMode === 'reflex' ? 'listen_speak' : mode,
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
        teacherLabel: activeTeacher.label,
        teacherLocale: activeTeacher.locale,
        learnerType: languageCode === 'vi' ? 'foreign_learner' : 'vn_learner',
        supportLanguage,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        nativeLanguageCode,
        languagePairKey,
        inputSource: source,
        studentInputLanguage: studentSpeakingLanguage,
        speakingMode: speakingLanguageMode,
        responseStyle,
        learnerLevel,
        topicId: selectedTopic.id,
        topicLabel: selectedTopic.label,
        topicDifficulty: selectedTopicDifficulty,
        topicRole: topicCurriculum?.roleplayRole || '',
        topicObjective: topicCurriculum?.objective || '',
        topicKeywords: topicCurriculum?.keywords || [],
        topicStarterSentences: topicCurriculum?.starterSentences || [],
        micAnalysis: source === 'mic' ? micAnalysis : undefined,
        drillType: opts?.drillType,
        drillSelectedWords: opts?.drillSelectedWords || [],
        drillSpeaking: isPresetReplayTurnSubmission ? true : (opts?.drillSpeaking ?? false),
      })
      const payload = data as {
        corrections?: Correction[]
        pronunciationTips?: string[]
        correctionNote?: string
        intentAnswer?: string
        mainSentence?: string
        reviewDrill?: {
          type?: 'speaking' | 'listening' | 'done'
          prompt?: string
          options?: string[]
          expectedKeywords?: string[]
          minMatchedKeywords?: number
          targetSentence?: string
          minSimilarity?: number
          minPronunciationScore?: number
        }
        startMiniPack?: boolean
        error?: string
      }
      if (!ok) {
        throw new Error(payload.error || localText('Không nhận được phản hồi từ giáo viên AI.', 'No response received from AI teacher.'))
      }
      if (!isFromDrill) {
        const randomThinkingDelayMs = 2000 + Math.floor(Math.random() * 2001)
        await new Promise((resolve) => setTimeout(resolve, randomThinkingDelayMs))
      }

      let mustStayWritingStage = false
      let currentTeacherMessageId = ''
      let currentTeacherText = ''
      let currentWritingCopyTargets: string[] = []
      if (!isFromDrill) {
        const latestCorrections = Array.isArray(payload.corrections)
          ? payload.corrections
            .map((c) => ({
              original: sanitizeIdeaContent(String(c?.original || '').trim()),
              fixed: sanitizeIdeaContent(String(c?.fixed || '').trim()),
              explanationVi: sanitizeIdeaContent(String(c?.explanationVi || '').trim()),
            }))
            .filter((c) => c.original || c.fixed || c.explanationVi)
          : []
        const correctionNote = sanitizeIdeaContent(String(payload.correctionNote || '').trim())
        const rawIntentAnswer = String(payload.intentAnswer || '').trim()
        const intentAnswer = rawIntentAnswer ? sanitizeForDisplay(sanitizeIdeaContent(rawIntentAnswer), languageCode) : ''
        const correctedMainSentence = sanitizeIdeaContent(String(latestCorrections[0]?.fixed || '').trim())
        const apiMainSentence = sanitizeIdeaContent(String(payload.mainSentence || '').trim())
        const fullSentenceCandidate = [apiMainSentence, correctedMainSentence]
          .map((x) => String(x || '').trim())
          .find((x) => x.split(/\s+/).filter(Boolean).length >= 4)
        const rawMainSentence = fullSentenceCandidate || apiMainSentence || correctedMainSentence
        const mainSentence = rawMainSentence ? sanitizeForDisplay(rawMainSentence, languageCode) : ''
        const teacherText = composeTeacherMessageText(correctionNote, mainSentence, intentAnswer)
        if (!teacherText) {
          throw new Error(localText('Không nhận được nội dung phản hồi hợp lệ từ AI.', 'No valid AI response content received.'))
        }
        const teacherMessageId = appendMessage('teacher', teacherText)
        currentTeacherMessageId = teacherMessageId
        currentTeacherText = teacherText
        if (latestCorrections.length > 0) {
          setCorrectionsByMessageId((prev) => ({ ...prev, [teacherMessageId]: latestCorrections }))
        }
        if (mainSentence) {
          setMainSentenceByMessageId((prev) => ({ ...prev, [teacherMessageId]: mainSentence }))
        }
        if (correctionNote) {
          setCorrectionNoteByMessageId((prev) => ({ ...prev, [teacherMessageId]: correctionNote }))
        }
        if (intentAnswer) {
          setIntentAnswerByMessageId((prev) => ({ ...prev, [teacherMessageId]: intentAnswer }))
        }
        const aiPayloadJson = (() => {
          try {
            return JSON.stringify({
              corrections: latestCorrections,
              pronunciationTips: Array.isArray(payload.pronunciationTips) ? payload.pronunciationTips : [],
              correctionNote,
              mainSentence,
              intentAnswer,
              reviewDrill: payload.reviewDrill || null,
              startMiniPack: Boolean(payload.startMiniPack),
              source,
              micAnalysis: source === 'mic' ? (micAnalysis || null) : null,
            })
          } catch {
            return ''
          }
        })()
        void saveHistoryMessage({
          role: 'teacher',
          text: teacherText,
          audioUrl: '',
          clientMessageId: teacherMessageId,
          mainSentence,
          correctionNote,
          intentAnswer,
          aiPayloadJson,
        }).then(() => {
          persistedMessageIdsRef.current[teacherMessageId] = true
        }).catch(() => {})
        const speakParts =
          learningMode === 'reflex'
            ? [mainSentence]
                .map((x) => extractTargetLanguageOnlyForReflexTts(String(x || '').trim(), languageCode))
                .map((x) => stripPhoneticForTts(x, languageCode))
                .filter(Boolean)
            : [correctionNote, mainSentence, intentAnswer].map((x) => stripPhoneticForTts(String(x || '').trim(), languageCode)).filter(Boolean)
        const fallbackRaw =
          learningMode === 'reflex'
            ? extractTargetLanguageOnlyForReflexTts(extractTeacherSpeechText(teacherText), languageCode)
            : extractTeacherSpeechText(teacherText)
        const speakText = speakParts.join('. ').trim() || stripPhoneticForTts(fallbackRaw, languageCode)
        setTeacherSpeakTextByMessageId((prev) => ({ ...prev, [teacherMessageId]: speakText }))
        const firstFromMain = takeFirstSentenceOnly(String(mainSentence || '').trim())
        const firstFromIntent = takeFirstSentenceOnly(String(rawIntentAnswer || extractTeacherSpeechText(teacherText)).trim())
        const speakingTargetFromPayloadRaw = String(payload.reviewDrill?.targetSentence || '').trim()
        const speakingTargetFromPayload = speakingTargetFromPayloadRaw && isSentenceInTargetLanguage(speakingTargetFromPayloadRaw, languageCode)
          ? speakingTargetFromPayloadRaw
          : ''
        const intentSentence = String(firstFromIntent || '').trim()
        const mainSentenceForWriting = String(firstFromMain || '').trim()
        const normalizedSeen = new Set<string>()
        const copyTargets: string[] = []
        const pushIfDistinct = (value: string) => {
          const next = String(value || '').trim()
          if (!next) return
          const norm = normalizeCopyText(next, languageCode)
          if (!norm || normalizedSeen.has(norm)) return
          normalizedSeen.add(norm)
          copyTargets.push(next)
        }
        // Rule: writing mini should have max 2 sentences (Y2 + Y3).
        pushIfDistinct(mainSentenceForWriting)
        pushIfDistinct(intentSentence)
        // Fallback: only fill missing slot(s), never create a 3rd sentence.
        if (copyTargets.length < 2) pushIfDistinct(String(speakingTargetFromPayload || '').trim())
        if (copyTargets.length > 2) copyTargets.splice(2)
        currentWritingCopyTargets = copyTargets
        if (learningMode === 'review' && payload.startMiniPack && !reviewMiniPackCompleted) {
          mustStayWritingStage = true
          setReviewMiniPackCompleted(false)
          setReviewDrillStage('writing')
          const nextTask = buildWritingTask(teacherMessageId, teacherText, copyTargets)
          setWritingTask(nextTask)
          const speakingTarget = String(speakingTargetFromPayload || copyTargets[0] || '').trim()
          if (speakingTarget) setReviewSpeakingTargetSentence(speakingTarget)
          void persistWritingTaskSnapshot(nextTask, 2)
        }
        setWritingDraft('')
        setWritingEvalResult(null)
        setCorrections(latestCorrections)
        setPronunciationTips(Array.isArray(payload.pronunciationTips) ? payload.pronunciationTips : [])
        void recordProgressTurn(
          latestCorrections.length > 0,
          micAnalysis?.pronunciationScore ?? null,
          micAnalysis || null,
          source
        )
        try {
          await generateAndStoreTeacherAudio(teacherMessageId, speakText, {
            mainSentence,
            correctionNote,
            intentAnswer,
            delayBeforePlayMs: opts?.drillSpeaking ? 1800 : undefined,
          })
        } catch {
          toast({
            title: localText('Không phát được âm thanh', 'Audio playback failed'),
            description: localText(
              'Nội dung thầy/cô vẫn hiển thị, bạn có thể tiếp tục học bình thường.',
              'Teacher text is still shown. You can continue learning normally.'
            ),
            variant: 'destructive',
          })
        }
      }

      if (payload.reviewDrill?.type === 'speaking') {
        const hasPendingWriting = Boolean(writingTask && !writingTask.completed)
        const speakingTarget = String(payload.reviewDrill.targetSentence || '').trim()
        const speakingTargetValid = speakingTarget ? isSentenceInTargetLanguage(speakingTarget, languageCode) : false
        const fallbackSpeakingTarget = String(
          speakingTarget
          || writingTask?.referenceSentence
          || writingTask?.requiredSentences?.[0]
          || ''
        ).trim()
        const finalSpeakingTarget = fallbackSpeakingTarget && isSentenceInTargetLanguage(fallbackSpeakingTarget, languageCode)
          ? fallbackSpeakingTarget
          : ''
        if (speakingTarget && !speakingTargetValid) {
          // Invalid speaking target (native language) => skip mini pack and resume normal chat.
          setReviewDrillStage('idle')
          setReviewMiniPackCompleted(true)
          setReviewListeningPopupOpen(false)
          setReviewListeningPrompt('')
          setReviewListeningOptions([])
          setReviewListeningVisibleOptions([])
          setReviewListeningRemainingOptions([])
          setReviewListeningExpectedKeywords([])
          setReviewListeningRequiredCount(3)
          setReviewListeningResultByWord({})
          setReviewListeningSelected([])
          setSpeakingDrillPhase('idle')
          setSpeakingDrillCycleCount(0)
          setSpeakingDrillBlob(null)
          setWritingTask(null)
          setReviewSpeakingTargetSentence('')
          setWritingDraft('')
          setWritingEvalResult(null)
          return
        }
        const shouldCreateWritingFallback =
          learningMode === 'review'
          && !isFromDrill
          && !mustStayWritingStage
          && Boolean(finalSpeakingTarget)
          && Boolean(currentTeacherMessageId)
          && (
            !writingTask
            || writingTask.completed
            || String(writingTask.messageId || '').trim() !== String(currentTeacherMessageId || '').trim()
          )
        if (shouldCreateWritingFallback) {
          const fallbackTeacherText = String(currentTeacherText || finalSpeakingTarget).trim()
          const rebuiltTargets = currentWritingCopyTargets.length > 0
            ? currentWritingCopyTargets
            : [finalSpeakingTarget]
          const rebuiltTask = buildWritingTask(currentTeacherMessageId, fallbackTeacherText, rebuiltTargets)
          setWritingTask(rebuiltTask)
          setWritingDraft('')
          setWritingEvalResult(null)
          setReviewMiniPackCompleted(false)
          setReviewDrillStage('writing')
          setReviewSpeakingTargetSentence(finalSpeakingTarget)
          void persistWritingTaskSnapshot(rebuiltTask, 2)
        }
        if (mustStayWritingStage || hasPendingWriting || shouldCreateWritingFallback) {
          setReviewDrillStage('writing')
        } else {
          setReviewDrillStage('speaking')
        }
        if (finalSpeakingTarget) {
          setReviewSpeakingTargetSentence(finalSpeakingTarget)
        }
        if (isFromDrill && payload.correctionNote) {
          toast({ title: payload.correctionNote, variant: 'default' })
        }
      } else if (payload.reviewDrill?.type === 'listening') {
        setReviewDrillStage('listening')
        setSpeakingDrillPhase('idle')
        setSpeakingDrillCycleCount(0)
        setSpeakingDrillBlob(null)
        let optsWords = Array.isArray(payload.reviewDrill.options)
          ? payload.reviewDrill.options.map((x) => String(x || '').trim()).filter(Boolean)
          : []
        if (optsWords.length === 0) {
          const promptForFallback = String(
            payload.reviewDrill.prompt || payload.intentAnswer || payload.mainSentence || ''
          ).trim()
          optsWords = promptForFallback
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .map((x) => x.trim())
            .filter((x) => x.length >= 2)
            .slice(0, 10)
        }
        const promptForListening = String(
          payload.reviewDrill.prompt || payload.intentAnswer || payload.mainSentence || ''
        ).trim()
        const expectedKeywords = Array.isArray(payload.reviewDrill.expectedKeywords)
          ? payload.reviewDrill.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean)
          : []
        const requiredCountRaw = Number(payload.reviewDrill.minMatchedKeywords || 3)
        const requiredCount = Number.isFinite(requiredCountRaw)
          ? Math.max(1, Math.min(3, Math.floor(requiredCountRaw)))
          : 3
        const uniqueOptions = Array.from(new Set(optsWords))
        const visibleLimit = Math.min(8, Math.max(requiredCount + 2, 5))
        const seeded = ensureListeningVisibleHasCorrectOption(
          uniqueOptions.slice(0, visibleLimit),
          uniqueOptions.slice(visibleLimit),
          uniqueOptions,
          expectedKeywords
        )
        setReviewListeningPrompt(promptForListening)
        setReviewListeningOptions(uniqueOptions)
        setReviewListeningVisibleOptions(seeded.visible)
        setReviewListeningRemainingOptions(seeded.remaining)
        setReviewListeningExpectedKeywords(expectedKeywords)
        setReviewListeningRequiredCount(requiredCount)
        setReviewListeningResultByWord({})
        setReviewListeningSelected([])
        setReviewListeningPopupOpen(true)
        if (isFromDrill && payload.correctionNote) {
          toast({ title: payload.correctionNote, variant: 'default' })
        }
      } else if (payload.reviewDrill?.type === 'done') {
        setReviewDrillStage('idle')
        setReviewMiniPackCompleted(true)
        setReviewListeningPopupOpen(false)
        setReviewListeningPrompt('')
        setReviewListeningOptions([])
        setReviewListeningVisibleOptions([])
        setReviewListeningRemainingOptions([])
        setReviewListeningExpectedKeywords([])
        setReviewListeningRequiredCount(3)
        setReviewListeningResultByWord({})
        setReviewListeningSelected([])
        setSpeakingDrillPhase('idle')
        setSpeakingDrillCycleCount(0)
        setSpeakingDrillBlob(null)
        setWritingTask(null)
        setReviewSpeakingTargetSentence('')
        setWritingDraft('')
      } else if (!payload.reviewDrill?.type && !isFromDrill) {
        setReviewDrillStage('idle')
      }
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi hội thoại', 'Conversation error'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
      setAwaitingTeacherReply(false)
    }
  }

  const submitReviewListeningDrill = async (pickedOverride?: string[]) => {
    if (reviewListeningSubmitBusy) return
    const picked = (pickedOverride || reviewListeningSelected).map((x) => String(x || '').trim()).filter(Boolean)
    if (picked.length !== reviewListeningRequiredCount) {
      toast({
        title: localText('Chưa đủ từ đúng', 'Not enough correct words yet'),
        description: localText(
          `Hãy tìm đủ ${reviewListeningRequiredCount} từ nghe đúng để hoàn thành.`,
          `Find ${reviewListeningRequiredCount} correct words to complete.`
        ),
        variant: 'destructive',
      })
      return
    }
    setReviewListeningSubmitBusy(true)
    try {
      await handleSend(picked.join(' '), 'text', undefined, {
        silentDrill: true,
        drillType: 'listening',
        drillSelectedWords: picked,
      })
    } finally {
      setReviewListeningSubmitBusy(false)
    }
  }

  useEffect(() => {
    if (reviewDrillStage !== 'listening') return
    if (!reviewListeningPopupOpen) return
    if (reviewListeningSubmitBusy) return
    if (reviewListeningSelected.length < reviewListeningRequiredCount) return
    void submitReviewListeningDrill(reviewListeningSelected)
  }, [
    reviewDrillStage,
    reviewListeningPopupOpen,
    reviewListeningSubmitBusy,
    reviewListeningSelected,
    reviewListeningRequiredCount,
  ])

  useEffect(() => {
    if (reviewDrillStage !== 'listening') return
    if (!reviewListeningPopupOpen) return
    const next = ensureListeningVisibleHasCorrectOption(
      reviewListeningVisibleOptions,
      reviewListeningRemainingOptions,
      reviewListeningOptions,
      reviewListeningExpectedKeywords
    )
    const sameVisible =
      next.visible.length === reviewListeningVisibleOptions.length
      && next.visible.every((x, i) => x === reviewListeningVisibleOptions[i])
    const sameRemaining =
      next.remaining.length === reviewListeningRemainingOptions.length
      && next.remaining.every((x, i) => x === reviewListeningRemainingOptions[i])
    if (!sameVisible) setReviewListeningVisibleOptions(next.visible)
    if (!sameRemaining) setReviewListeningRemainingOptions(next.remaining)
  }, [
    reviewDrillStage,
    reviewListeningPopupOpen,
    reviewListeningVisibleOptions,
    reviewListeningRemainingOptions,
    reviewListeningOptions,
    reviewListeningExpectedKeywords,
  ])

  useEffect(() => {
    if (reviewDrillStage !== 'listening') return
    if (!reviewListeningPopupOpen) return
    const textToPlay = String(reviewListeningPrompt || '').trim()
    if (!textToPlay) return
    const timer = window.setTimeout(() => {
      void replayCorrectionSentence(textToPlay)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [reviewDrillStage, reviewListeningPopupOpen, reviewListeningPrompt])

  useEffect(() => {
    if (reviewDrillStage !== 'speaking' && reviewDrillStage !== 'writing') return
    if (String(reviewSpeakingTargetSentence || '').trim()) return
    const fallbackTarget = String(
      writingTask?.referenceSentence
      || writingTask?.requiredSentences?.[0]
      || ''
    ).trim()
    if (fallbackTarget && isSentenceInTargetLanguage(fallbackTarget, languageCode)) {
      setReviewSpeakingTargetSentence(fallbackTarget)
    }
  }, [
    reviewDrillStage,
    reviewSpeakingTargetSentence,
    writingTask?.referenceSentence,
    writingTask?.requiredSentences,
    languageCode,
  ])

  useEffect(() => {
    if (learningMode !== 'review') return
    if (reviewDrillStage !== 'writing') return
    if (!writingTask?.completed) return
    const speakingTarget = String(
      reviewSpeakingTargetSentence
      || writingTask.referenceSentence
      || writingTask.requiredSentences?.[0]
      || ''
    ).trim()
    if (!speakingTarget || !isSentenceInTargetLanguage(speakingTarget, languageCode)) return
    setReviewSpeakingTargetSentence(speakingTarget)
    setReviewDrillStage('speaking')
  }, [
    learningMode,
    reviewDrillStage,
    writingTask?.completed,
    writingTask?.referenceSentence,
    writingTask?.requiredSentences,
    reviewSpeakingTargetSentence,
    languageCode,
  ])

  const onReviewListeningWordTap = (word: string) => {
    if (reviewListeningSubmitBusy) return
    const normalizedWord = String(word || '').trim().toLowerCase()
    if (!normalizedWord) return
    const expected = new Set(reviewListeningExpectedKeywords.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean))
    const isCorrect = expected.has(normalizedWord)
    setReviewListeningResultByWord((prev) => ({ ...prev, [word]: isCorrect ? 'correct' : 'wrong' }))

    if (isCorrect && !reviewListeningSelected.includes(word)) {
      const nextPicked = [...reviewListeningSelected, word].slice(0, reviewListeningRequiredCount)
      setReviewListeningSelected(nextPicked)
    }

    window.setTimeout(() => {
      let replacement = ''
      setReviewListeningRemainingOptions((prev) => {
        if (prev.length === 0) return prev
        replacement = String(prev[0] || '').trim()
        return prev.slice(1)
      })
      setReviewListeningVisibleOptions((prev) => {
        if (!replacement) {
          const currentSet = new Set(prev)
          replacement =
            reviewListeningOptions.find((x) => {
              const t = String(x || '').trim()
              return t && t !== word && !currentSet.has(t)
            }) || ''
        }
        const next = replacement ? prev.map((x) => (x === word ? replacement : x)) : [...prev]
        return shuffleListeningWords(next)
      })
      setReviewListeningResultByWord((prev) => {
        const next = { ...prev }
        delete next[word]
        if (replacement) delete next[replacement]
        return next
      })
    }, 320)
  }

  const startDrillListenAndRecord = async () => {
    if (learningMode === 'review' && reviewDrillStage === 'writing' && Boolean(writingTask) && !writingTask.completed) {
      redirectToMiniWriting()
      return
    }
    if (!reviewSpeakingTargetSentence) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({
        title: localText('Thiết bị chưa hỗ trợ', 'Device not supported'),
        description: localText('Trình duyệt này chưa hỗ trợ ghi âm microphone.', 'This browser does not support microphone recording.'),
        variant: 'destructive',
      })
      return
    }
    setSpeakingDrillPhase('playing')
    try {
      await replayCorrectionSentence(reviewSpeakingTargetSentence)
    } catch {
      setSpeakingDrillPhase('idle')
      return
    }
    recordingForDrillRef.current = true
    onDrillRecordingCompleteRef.current = (blob: Blob) => {
      setSpeakingDrillBlob(blob)
      setSpeakingDrillPhase('afterRecord')
    }
    setSpeakingDrillPhase('recording')
    try {
      await startMixedRecording()
    } catch (e) {
      recordingForDrillRef.current = false
      onDrillRecordingCompleteRef.current = null
      setSpeakingDrillPhase('idle')
      const msg = unknownErrorMsg(e)
      toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
    }
  }

  const startDrillSpeakingRecording = async () => {
    if (learningMode === 'review' && reviewDrillStage === 'writing' && Boolean(writingTask) && !writingTask.completed) {
      redirectToMiniWriting()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({
        title: localText('Thiết bị chưa hỗ trợ', 'Device not supported'),
        description: localText('Trình duyệt này chưa hỗ trợ ghi âm microphone.', 'This browser does not support microphone recording.'),
        variant: 'destructive',
      })
      return
    }
    recordingForDrillRef.current = true
    onDrillRecordingCompleteRef.current = (blob: Blob) => {
      setSpeakingDrillBlob(blob)
      setSpeakingDrillPhase('afterRecord')
    }
    setSpeakingDrillPhase('recording')
    try {
      await startMixedRecording()
    } catch (e) {
      recordingForDrillRef.current = false
      onDrillRecordingCompleteRef.current = null
      setSpeakingDrillPhase('afterRecord')
      const msg = unknownErrorMsg(e)
      toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
    }
  }

  const playSpeakingDrillBlob = async () => {
    if (learningMode === 'review' && reviewDrillStage === 'writing' && Boolean(writingTask) && !writingTask.completed) {
      redirectToMiniWriting()
      return
    }
    if (!speakingDrillBlob) {
      if (reviewSpeakingTargetSentence) {
        await replayCorrectionSentence(reviewSpeakingTargetSentence)
      }
      return
    }
    const url = URL.createObjectURL(speakingDrillBlob)
    const audio = new Audio(url)
    audio.playbackRate = playbackSpeedRef.current
    audio.onended = () => URL.revokeObjectURL(url)
    audio.onerror = () => URL.revokeObjectURL(url)
    void audio.play().catch(() => URL.revokeObjectURL(url))
  }

  const submitSpeakingDrillCycle = async () => {
    if (learningMode === 'review' && reviewDrillStage === 'writing' && Boolean(writingTask) && !writingTask.completed) {
      redirectToMiniWriting()
      return
    }
    const nextCount = speakingDrillCycleCount + 1
    setSpeakingDrillCycleCount(nextCount)
    setSpeakingDrillBlob(null)
    if (nextCount < 3) {
      void startDrillListenAndRecord()
      return
    }
    setSpeakingDrillPhase('idle')
    setBusy(true)
    setAwaitingTeacherReply(true)
    try {
      await handleSend(reviewSpeakingTargetSentence, 'text', undefined, {
        silentDrill: true,
        drillSpeaking: true,
      })
      chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi hội thoại', 'Conversation error'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
      setAwaitingTeacherReply(false)
    }
  }

  const startLesson = async (opts?: { skipPrerequisiteCheck?: boolean; curriculumOverride?: TopicCurriculum | null; topicOverride?: TopicOption | null }) => {
    if (startingLesson) return
    if (!opts?.skipPrerequisiteCheck && !isTopicConfirmedForLesson) {
      toast({
        title: localText('Cần chọn chủ đề trước', 'Select topic first'),
        description: localText(
          'Bước 1: bấm "Học chủ đề này". Bước 2: bấm "Tạo/Lấy giáo trình chủ đề".',
          'Step 1: click "Learn this topic". Step 2: click "Create/Get curriculum".'
        ),
        variant: 'destructive',
      })
      return
    }
    const curriculumToUse = opts?.curriculumOverride || topicCurriculum
    const topicToUse = opts?.topicOverride || selectedTopic
    if (opts?.curriculumOverride) {
      setTopicCurriculum(opts.curriculumOverride)
    }
    if (!opts?.skipPrerequisiteCheck && !hasCurriculumReady) {
      toast({
        title: localText('Cần tạo giáo trình trước', 'Create curriculum first'),
        description: localText(
          'Hãy bấm "Tạo/Lấy giáo trình chủ đề" để xem tổng quan buổi học rồi mới bắt đầu.',
          'Please click "Create/Get curriculum" first to review the lesson overview before starting.'
        ),
        variant: 'destructive',
      })
      return
    }
    setStartingLesson(true)
    if (!sessionTeacher) {
      setSessionTeacher(selectedTeacher)
    }
    const curriculumStarter = curriculumToUse?.starterSentences.find((x) => String(x || '').trim())
    const curriculumStarterText = String(curriculumStarter || '').trim()
    const curriculumOpeningLine = String(curriculumToUse?.openingLine || '').trim()
    const curriculumOpeningQuestion = String(curriculumToUse?.openingQuestion || '').trim()
    const greetingPatternByLanguage: Record<LanguageCode, RegExp> = {
      en: /^(hello|hi|good\s+(morning|afternoon|evening))\b/i,
      zh: /^(你好|您好|嗨)/u,
      hi: /^(नमस्ते|हैलो)/u,
      th: /^(สวัสดี|หวัดดี)/u,
      ja: /^(こんにちは|おはよう|こんばんは|やあ)/u,
      ko: /^(안녕하세요|안녕|반갑습니다)/u,
      vi: /^(xin\s+chào|chào\s+bạn|chào)/i,
    }
    const hasGreetingStarter = greetingPatternByLanguage[languageCode].test(curriculumStarterText)
    const starterToUse = hasGreetingStarter ? '' : curriculumStarterText
    const curriculumRole = String(curriculumToUse?.roleplayRole || '').trim()
    const learnerNameByLanguage: Record<LanguageCode, string> = {
      en: learnerDisplayName || 'there',
      zh: learnerDisplayName || '同学',
      hi: learnerDisplayName || 'दोस्त',
      th: learnerDisplayName || 'เพื่อน',
      ja: learnerDisplayName || 'さん',
      ko: learnerDisplayName || '학습자님',
      vi: learnerDisplayName || 'em',
    }
    const defaultRoleByMode: Record<Mode, Record<LanguageCode, string>> = {
      chat: {
        en: 'friendly language coach',
        zh: '友好语言教练',
        hi: 'दोस्ताना भाषा कोच',
        th: 'โค้ชภาษาที่เป็นมิตร',
        ja: 'やさしい語学コーチ',
        ko: '친절한 언어 코치',
        vi: 'người hướng dẫn thân thiện',
      },
      listen_speak: {
        en: 'listen-and-speak reflex coach',
        zh: '听说反应教练',
        hi: 'लिसन-स्पीक रिफ्लेक्स कोच',
        th: 'โค้ชฟัง-พูดฝึกการตอบสนอง',
        ja: '聞く・話す反応トレーナー',
        ko: '듣기-말하기 반응 코치',
        vi: 'huấn luyện viên nghe-nói phản xạ',
      },
      roleplay_short: {
        en: 'roleplay partner',
        zh: '情景对话搭档',
        hi: 'रोलप्ले साथी',
        th: 'คู่ฝึกบทบาทสมมติ',
        ja: 'ロールプレイの相手役',
        ko: '롤플레이 파트너',
        vi: 'người vào vai đồng hành',
      },
    }
    const roleToUse = curriculumRole || defaultRoleByMode[mode][languageCode]
    const topicPromptByLanguage: Record<LanguageCode, string> = {
      en: starterToUse || `Please say one sentence about today's topic: "${topicToUse.label}".`,
      zh: starterToUse || `请先用一句话说说今天的主题：「${topicToUse.label}」。`,
      hi: starterToUse || `आज के विषय "${topicToUse.label}" पर एक वाक्य बोलिए।`,
      th: starterToUse || `ลองพูด 1 ประโยคเกี่ยวกับหัวข้อวันนี้ "${topicToUse.label}"`,
      ja: starterToUse || `今日のトピック「${topicToUse.label}」について、まず一文で話してみてください。`,
      ko: starterToUse || `오늘의 주제 "${topicToUse.label}"에 대해 한 문장으로 말해 보세요.`,
      vi: starterToUse || `Em hãy nói 1 câu về chủ đề hôm nay: "${topicToUse.label}".`,
    }
    const openingByLanguage: Record<LanguageCode, string> = {
      en: `Hello ${learnerNameByLanguage.en}! Today we will learn topic: "${topicToUse.label}". I am your teacher and I will play role: ${roleToUse}. ${topicPromptByLanguage.en}`,
      zh: `你好，${learnerNameByLanguage.zh}！今天我们学习主题：「${topicToUse.label}」。我是你的老师，今天会扮演角色：${roleToUse}。${topicPromptByLanguage.zh}`,
      hi: `नमस्ते ${learnerNameByLanguage.hi}! आज हम इस विषय पर सीखेंगे: "${topicToUse.label}"। मैं आपका शिक्षक हूँ और आज भूमिका निभाऊँगा/निभाऊँगी: ${roleToUse}।${topicPromptByLanguage.hi}`,
      th: `สวัสดี ${learnerNameByLanguage.th}! วันนี้เราจะเรียนหัวข้อ: "${topicToUse.label}" ฉันเป็นครูของคุณและจะรับบทเป็น: ${roleToUse} ${topicPromptByLanguage.th}`,
      ja: `こんにちは、${learnerNameByLanguage.ja}。今日は「${topicToUse.label}」を学びます。私は先生として、今日の役は「${roleToUse}」です。${topicPromptByLanguage.ja}`,
      ko: `안녕하세요, ${learnerNameByLanguage.ko}! 오늘은 "${topicToUse.label}" 주제를 배웁니다. 저는 선생님이며 오늘의 역할은 "${roleToUse}"입니다. ${topicPromptByLanguage.ko}`,
      vi: `Xin chào ${learnerNameByLanguage.vi}! Hôm nay chúng ta học chủ đề: "${topicToUse.label}". Thầy/cô là giáo viên và hôm nay vào vai: ${roleToUse}. ${topicPromptByLanguage.vi}`,
    }
    const aiOpening = [curriculumOpeningLine, curriculumOpeningQuestion].filter(Boolean).join(' ')
    const openingCore = aiOpening || openingByLanguage[languageCode]
    const opening = `${curriculumRole ? `[${curriculumRole}] ` : ''}${openingCore}`
    const teacherMessageId = appendMessage('teacher', opening)
    void saveHistoryMessage({
      role: 'teacher',
      text: opening,
      audioUrl: '',
      clientMessageId: teacherMessageId,
    }).then(() => { persistedMessageIdsRef.current[teacherMessageId] = true }).catch(() => {})
    try {
      await generateAndStoreTeacherAudio(teacherMessageId, extractTeacherSpeechText(opening))
    } catch {
      // keep chat usable even when TTS fails
    } finally {
      setStartingLesson(false)
    }
  }

  const runQuickStartFlow = async () => {
    if (quickStartBusy || topicBusy || startingLesson || busy) return
    const topicIdToUse = String(pendingTopicId || topicId || '').trim()
    if (!topicIdToUse) {
      toast({
        title: localText('Thiếu chủ đề học', 'Missing lesson topic'),
        description: localText('Hãy chọn chủ đề trước khi bắt đầu nhanh.', 'Please choose a topic before quick start.'),
        variant: 'destructive',
      })
      return
    }
    const topicToUse = allTopicOptions.find((x) => x.id === topicIdToUse) || selectedTopic
    const hadExistingLesson = messages.length > 0 || Boolean(openedHistorySessionId)

    setQuickStartBusy(true)
    try {
      if (hadExistingLesson) {
        startNewSession()
      }
      setQuickStartStage('confirm_topic')
      const confirmed = confirmTopicForLearning(topicIdToUse, { silent: true })
      if (!confirmed) {
        throw new Error(localText('Không xác nhận được chủ đề học.', 'Failed to confirm lesson topic.'))
      }

      setQuickStartStage('create_curriculum')
      const curriculum = await fetchTopicCurriculum({ skipConfirm: true, topicId: topicIdToUse })
      if (!curriculum) {
        throw new Error(localText('Không tạo được giáo trình chủ đề.', 'Failed to create topic curriculum.'))
      }

      const previousWords = await fetchPreviousLessonWords()
      if (learningMode === 'review' && previousWords.length > 0) {
        setPreLessonWords(previousWords)
        setPreLessonPassed(false)
        setPreLessonCurriculum(curriculum)
        setPreLessonTopic(topicToUse)
        setPreLessonExerciseIndex(0)
        setPreLessonWordIndex(0)
        setPreLessonResults({})
        setPreLessonRetryWords(null)
        setPreLessonInput('')
        setPreLessonRecallDirection('word')
        setWordPractice(null)
        setQuickStartModalOpen(false)
        setShowPreLessonReview(true)
        setQuickStartBusy(false)
        setQuickStartStage('idle')
        toast({
          title: localText('Ôn bài cũ', 'Review previous lesson'),
          description: localText(
            `Có ${previousWords.length} từ bài trước cần ôn. Hoàn thành để mở bài mới.`,
            `You have ${previousWords.length} words from previous lesson to review. Complete to unlock new lesson.`
          ),
        })
        return
      }

      setQuickStartModalOpen(false)
      const plan = { curriculum, topic: topicToUse }
      const hasPreset = await hasStrictPresetMatch(plan)
      if (hasPreset) {
        openLessonStartChoice(curriculum, topicToUse)
        toast({
          title: localText('Chọn hình thức học', 'Choose lesson type'),
          description: hadExistingLesson
            ? localText('Đã sẵn sàng. Chọn học live hoặc học bài có sẵn để bắt đầu.', 'Ready. Choose live lesson or saved lesson to continue.')
            : localText('Chọn học live hoặc học bài có sẵn để bắt đầu.', 'Choose live lesson or saved lesson to begin.'),
        })
      } else {
        setLessonStartPlan(plan)
        await startLiveLessonFromChoice(plan)
      }
    } catch (e) {
      toast({
        title: localText('Bắt đầu nhanh chưa thành công', 'Quick start failed'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setQuickStartBusy(false)
      setQuickStartStage('idle')
    }
  }

  const clearPreLessonGate = () => {
    setShowPreLessonReview(false)
    setPreLessonCurriculum(null)
    setPreLessonTopic(null)
    setPreLessonWords([])
    setPreLessonPassed(false)
    setPreLessonResults({})
    setPreLessonRetryWords(null)
    setPreLessonInput('')
  }

  const normalizeMatchText = (value: string) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const findMatchingHistorySessions = useCallback((plan: { curriculum: TopicCurriculum | null; topic: TopicOption }) => {
    const normalizedTopic = normalizeMatchText(plan.topic.label)
    const topicIdToMatch = String(plan.topic.id || '').trim().toLowerCase()
    const modeToUse = learningMode === 'reflex' ? 'listen_speak' : mode
    const targetLanguageToMatch = String(activeTeacher.languageLabel || '').trim().toLowerCase()
    const nativeLanguageToMatch = String(selectedNativeLanguage.apiLabel || '').trim().toLowerCase()
    const teacherLabelToMatch = String(activeTeacher.label || '').trim().toLowerCase()
    const languageCodeToMatch = String(languageCode || '').trim().toLowerCase()
    return historySessions
      .filter((s) => {
        if (String(s.learningMode || 'review') !== String(learningMode)) return false
        if (String(s.mode || '') !== String(modeToUse)) return false
        if (String(s.languageCode || '').trim().toLowerCase() !== languageCodeToMatch) return false

        const sessionTargetLanguage = String(s.targetLanguage || '').trim().toLowerCase()
        if (targetLanguageToMatch && sessionTargetLanguage && sessionTargetLanguage !== targetLanguageToMatch) return false

        const sessionNativeLanguage = String(s.nativeLanguage || '').trim().toLowerCase()
        if (nativeLanguageToMatch && sessionNativeLanguage && sessionNativeLanguage !== nativeLanguageToMatch) return false

        const sessionTeacherLabel = String(s.teacherLabel || '').trim().toLowerCase()
        if (teacherLabelToMatch && sessionTeacherLabel && sessionTeacherLabel !== teacherLabelToMatch) return false

        const sessionTopicId = String(s.topicId || '').trim().toLowerCase()
        if (topicIdToMatch && sessionTopicId) return sessionTopicId === topicIdToMatch

        const topic = normalizeMatchText(String(s.topicLabel || ''))
        if (!normalizedTopic || !topic) return false
        return topic === normalizedTopic
      })
      .sort((a, b) => (String(a.lastMessageAt || '') < String(b.lastMessageAt || '') ? 1 : -1))
  }, [
    historySessions,
    learningMode,
    mode,
    languageCode,
    activeTeacher.languageLabel,
    activeTeacher.label,
    selectedNativeLanguage.apiLabel,
  ])

  const openLessonStartChoice = (
    curriculum: TopicCurriculum | null,
    topic: TopicOption,
    opts?: { presetAvailable?: boolean }
  ) => {
    setLessonStartPresetAvailable(opts?.presetAvailable !== false)
    setLessonStartPlan({ curriculum, topic })
    setLessonStartChoiceOpen(true)
  }

  const hasStrictPresetMatch = async (plan: { curriculum: TopicCurriculum | null; topic: TopicOption }) => {
    const { ok, data } = await checkCompletedLessonMatch({
      targetLanguage: activeTeacher.languageLabel,
      nativeLanguage: selectedNativeLanguage.apiLabel,
      learnerLevel,
      topicId: plan.topic.id,
      topicLabel: plan.topic.label,
      mode: learningMode === 'reflex' ? 'listen_speak' : mode,
      learningMode,
      teacherLabel: activeTeacher.label,
      teacherLocale: activeTeacher.ttsLocale,
      languageCode,
    })
    if (!ok) throw new Error(data.error || localText('Không kiểm tra được bài học có sẵn.', 'Cannot check saved lesson match.'))
    return Boolean(data.found)
  }

  const notifyCreditsUpdated = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('credits-updated'))
  }, [])

  const syncSessionCreditStatus = useCallback(async (targetSessionId: string) => {
    const sid = String(targetSessionId || '').trim()
    if (!sid) return
    const { ok, data } = await chargeEnglishCoachCredits({
      action: 'status',
      sessionId: sid,
    })
    if (!ok) return
    const unlockCount = Math.max(0, Math.floor(Number(data.liveUnlockCount || 0) || 0))
    setLiveSessionExtraTurnUnlocks(unlockCount)
  }, [])

  const startLiveLessonFromChoice = async (planArg?: { curriculum: TopicCurriculum | null; topic: TopicOption }) => {
    const plan = planArg || lessonStartPlan || matchedSessionPlan
    if (!plan) return
    if (isSavedStandalonePage) {
      try {
        window.sessionStorage.setItem(
          CROSS_PAGE_START_STORAGE_KEY,
          JSON.stringify({
            action: 'start_live',
            topicId: String(plan.topic.id || '').trim(),
            topicLabel: String(plan.topic.label || '').trim(),
            ts: Date.now(),
          })
        )
      } catch {
        // ignore sessionStorage failures
      }
      router.replace('/hoc-tieng-anh-ai?autoStart=live')
      return
    }
    let curriculumToUse = plan.curriculum
    if (!curriculumToUse) {
      curriculumToUse = await fetchTopicCurriculum({ skipConfirm: true, topicId: plan.topic.id, silent: true })
    }
    setMatchedSessionChoiceOpen(false)
    setMatchedSessionPlan(null)
    setMatchedHistorySessions([])
    setLessonStartChoiceOpen(false)
    setLessonStartPresetAvailable(true)
    setLessonStartPlan(null)
    const sessionIdForCharge = String(sessionId || '').trim()
    if (!sessionIdForCharge) {
      throw new Error(localText('Thiếu sessionId để mở buổi live.', 'Missing sessionId to open live lesson.'))
    }
    const liveCharge = await chargeEnglishCoachCredits({
      action: 'charge_live_start',
      sessionId: sessionIdForCharge,
    })
    if (!liveCharge.ok) {
      throw new Error(String(liveCharge.data.error || localText('Không thể trừ credit cho buổi live.', 'Unable to charge credits for live lesson.')))
    }
    notifyCreditsUpdated()
    const chargedNow = Boolean(liveCharge.data.charged)
    const liveBalance = Number(liveCharge.data.newBalance || 0)
    toast({
      title: chargedNow
        ? localText('Đã trừ credit mở buổi live', 'Live lesson credits charged')
        : localText('Buổi live đã được trừ credit trước đó', 'Live lesson already charged earlier'),
      description: chargedNow
        ? localText(
            `Đã trừ ${LIVE_SESSION_PRICE_CREDITS} credit. Số dư còn lại: ${liveBalance.toFixed(2)}.`,
            `${LIVE_SESSION_PRICE_CREDITS} credits deducted. Remaining balance: ${liveBalance.toFixed(2)}.`
          )
        : localText(
            `Không trừ thêm. Số dư hiện tại: ${liveBalance.toFixed(2)}.`,
            `No extra deduction. Current balance: ${liveBalance.toFixed(2)}.`
          ),
    })
    const unlockCount = Math.max(0, Math.floor(Number(liveCharge.data.liveUnlockCount || 0) || 0))
    setLiveSessionExtraTurnUnlocks(unlockCount)
    setIsCurrentPresetSession(false)
    setPresetReplayExpectedSentence('')
    await startLesson({
      skipPrerequisiteCheck: true,
      curriculumOverride: curriculumToUse,
      topicOverride: plan.topic,
    })
    if (isSavedStandalonePage) {
      router.replace(`/hoc-tieng-anh-ai?sessionId=${encodeURIComponent(sessionIdForCharge)}`)
    }
    setSetupCollapsed(true)
    jumpToConversationStart()
    toast({
      title: localText('Đã mở bài mới', 'New lesson unlocked'),
      description: localText('Chúc bạn học tốt!', 'Happy learning!'),
    })
  }

  const startPresetLessonFromChoice = async (planArg?: { curriculum: TopicCurriculum | null; topic: TopicOption }) => {
    if (!lessonStartPresetAvailable) return
    const plan = planArg || lessonStartPlan
    if (!plan) return
    setLessonStartChoiceBusy(true)
    try {
      const { ok, data } = await createSessionFromRandomCompletedLesson({
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        learnerLevel,
        topicId: plan.topic.id,
        topicLabel: plan.topic.label,
        mode: learningMode === 'reflex' ? 'listen_speak' : mode,
        learningMode,
        teacherLabel: activeTeacher.label,
        teacherLocale: activeTeacher.ttsLocale,
        languageCode,
      })
      if (!ok) {
        throw new Error(data.error || localText('Không lấy được bài học có sẵn.', 'Unable to load a saved lesson.'))
      }
      if (!data.found || !data.sessionId) {
        toast({
          title: localText('Không còn bài phù hợp', 'No matching saved lesson now'),
          description: localText(
            'Danh sách bài có sẵn vừa thay đổi. Bạn chọn học live hoặc đóng để kiểm tra lại.',
            'Saved lessons changed. Choose live lesson or close and check again.'
          ),
          variant: 'destructive',
        })
        return
      }
      const presetSessionId = String(data.sessionId || '').trim()
      const presetCharge = await chargeEnglishCoachCredits({
        action: 'charge_preset_start',
        sessionId: presetSessionId,
      })
      if (!presetCharge.ok) {
        throw new Error(String(presetCharge.data.error || localText('Không thể trừ credit cho bài có sẵn.', 'Unable to charge credits for saved lesson.')))
      }
      notifyCreditsUpdated()
      const chargedNow = Boolean(presetCharge.data.charged)
      const presetBalance = Number(presetCharge.data.newBalance || 0)
      toast({
        title: chargedNow
          ? localText('Đã trừ credit mở bài có sẵn', 'Saved lesson credits charged')
          : localText('Bài có sẵn đã được trừ credit trước đó', 'Saved lesson already charged earlier'),
        description: chargedNow
          ? localText(
              `Đã trừ ${PRESET_SESSION_PRICE_CREDITS} credit. Số dư còn lại: ${presetBalance.toFixed(2)}.`,
              `${PRESET_SESSION_PRICE_CREDITS} credits deducted. Remaining balance: ${presetBalance.toFixed(2)}.`
            )
          : localText(
              `Không trừ thêm. Số dư hiện tại: ${presetBalance.toFixed(2)}.`,
              `No extra deduction. Current balance: ${presetBalance.toFixed(2)}.`
            ),
      })
      setLessonStartChoiceOpen(false)
      setLessonStartPresetAvailable(true)
      setLessonStartPlan(null)
      if (!isSavedStandalonePage) {
        router.replace(`/hoc-bai-hoc-co-san?sessionId=${encodeURIComponent(presetSessionId)}`)
        return
      }
      await loadHistorySession(presetSessionId)
      setSetupCollapsed(true)
      jumpToConversationStart()
      toast({
        title: localText('Đã mở bài học có sẵn', 'Saved lesson loaded'),
        description: localText('Bạn đang học một bài đã hoàn thành phù hợp cài đặt hiện tại.', 'You are now studying a saved lesson matching your setup.'),
      })
    } catch (e) {
      toast({
        title: localText('Không mở được bài có sẵn', 'Cannot load saved lesson'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    } finally {
      setLessonStartChoiceBusy(false)
    }
  }

  const startLiveAfterPreReview = async () => {
    if (preLessonContinueBusy) return
    const curriculum = preLessonCurriculum
    const topic = preLessonTopic
    if (!curriculum || !topic) return
    const plan = { curriculum, topic }
    setPreLessonContinueBusy(true)
    try {
      clearPreLessonGate()
      const hasPreset = await hasStrictPresetMatch(plan)
      openLessonStartChoice(curriculum, topic, { presetAvailable: hasPreset })
      toast({
        title: localText('Chọn hình thức học', 'Choose lesson type'),
        description: hasPreset
          ? localText(
              'Có bài học có sẵn khớp cài đặt hiện tại. Bạn có thể học live với AI hoặc học bài có sẵn.',
              'A saved lesson matches your current setup. You can start a live AI lesson or study the saved lesson.'
            )
          : localText(
              'Chưa có bài có sẵn khớp cài đặt hiện tại. Bạn vẫn có thể học live với AI ngay.',
              'No saved lesson matches your current setup yet. You can start a live AI lesson now.'
            ),
      })
      // Legacy in-progress matching popup is intentionally skipped here.
      // After pre-review, flow is standardized to Live AI vs Saved preset choice.
      setMatchedHistorySessions([])
      setMatchedSessionPlan(null)
      setMatchedSessionChoiceOpen(false)
    } finally {
      setPreLessonContinueBusy(false)
    }
  }

  const openMatchedHistorySession = async (targetSessionId: string) => {
    if (!targetSessionId) return
    setMatchedSessionChoiceBusy(true)
    try {
      setMatchedSessionChoiceOpen(false)
      setMatchedSessionPlan(null)
      await loadHistorySession(targetSessionId)
      setSetupCollapsed(true)
      toast({
        title: localText('Đã mở buổi học đang lưu', 'In-progress lesson loaded'),
        description: localText('Bạn có thể tiếp tục từ buổi học phù hợp này.', 'You can continue from this matched lesson.'),
      })
    } finally {
      setMatchedSessionChoiceBusy(false)
    }
  }

  const handleStartLessonClick = async () => {
    if (!isLessonReadyToStart || startingLesson) return
    setWordPractice(null)
    try {
      const previousWords = await fetchPreviousLessonWords()
      if (learningMode === 'review' && previousWords.length > 0) {
        setPreLessonWords(previousWords)
        setPreLessonPassed(false)
        setPreLessonCurriculum(topicCurriculum)
        setPreLessonTopic(selectedTopic)
        setPreLessonExerciseIndex(0)
        setPreLessonWordIndex(0)
        setPreLessonResults({})
        setPreLessonRetryWords(null)
        setPreLessonInput('')
        setPreLessonRecallDirection('word')
        setWordPractice(null)
        setShowPreLessonReview(true)
        toast({
          title: localText('Ôn bài cũ', 'Review previous lesson'),
          description: localText(
            `Có ${previousWords.length} từ bài trước cần ôn. Hoàn thành để mở bài mới.`,
            `You have ${previousWords.length} words from previous lesson to review. Complete to unlock new lesson.`
          ),
        })
        return
      }
      const plan = { curriculum: topicCurriculum, topic: selectedTopic }
      const hasPreset = await hasStrictPresetMatch(plan)
      if (hasPreset) {
        openLessonStartChoice(topicCurriculum, selectedTopic)
      } else {
        setLessonStartPlan(plan)
        await startLiveLessonFromChoice(plan)
      }
    } catch (e) {
      toast({
        title: localText('Lỗi', 'Error'),
        description: unknownErrorMsg(e),
        variant: 'destructive',
      })
    }
  }

  const transcribeSpeechAudio = async (audioBlob: Blob): Promise<MixedSpeechAnalysis> => {
    const buffer = await audioBlob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const audioBase64 = btoa(binary)

    const { ok, data } = await transcribeMixed({
      audioBase64,
      mimeType: audioBlob.type || 'audio/webm',
      targetLanguage: activeTeacher.languageLabel,
      targetLanguageCode: languageCode,
      nativeLanguage: selectedNativeLanguage.apiLabel,
      nativeLanguageCode,
      speakingMode: speakingLanguageMode,
    })
    const payload = data as {
      targetTranscript?: string
      nativeTranscript?: string
      mergedTranscript?: string
      inferredMeaning?: string
      pronunciationIssues?: string[]
      pronunciationScore?: number
      weakWords?: string[]
      pronunciationAccuracy?: number
      pronunciationFluency?: number
      pronunciationProsody?: number
      wordScores?: Array<{ word?: string; score?: number; issueType?: string }>
      error?: string
    }
    if (!ok || !payload.mergedTranscript) {
      throw new Error(payload.error || localText('Không tách được câu nói trộn.', 'Failed to split mixed speech transcript.'))
    }
    return {
      targetTranscript: String(payload.targetTranscript || '').trim(),
      nativeTranscript: String(payload.nativeTranscript || '').trim(),
      mergedTranscript: String(payload.mergedTranscript || '').trim(),
      inferredMeaning: String(payload.inferredMeaning || '').trim(),
      pronunciationIssues: Array.isArray(payload.pronunciationIssues)
        ? payload.pronunciationIssues.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
        : [],
      pronunciationScore: Number.isFinite(Number(payload.pronunciationScore))
        ? Math.min(100, Math.max(0, Math.round(Number(payload.pronunciationScore))))
        : 0,
      weakWords: Array.isArray(payload.weakWords)
        ? payload.weakWords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
        : [],
      pronunciationAccuracy: Number.isFinite(Number(payload.pronunciationAccuracy))
        ? Math.min(100, Math.max(0, Math.round(Number(payload.pronunciationAccuracy))))
        : 0,
      pronunciationFluency: Number.isFinite(Number(payload.pronunciationFluency))
        ? Math.min(100, Math.max(0, Math.round(Number(payload.pronunciationFluency))))
        : 0,
      pronunciationProsody: Number.isFinite(Number(payload.pronunciationProsody))
        ? Math.min(100, Math.max(0, Math.round(Number(payload.pronunciationProsody))))
        : 0,
      wordScores: Array.isArray(payload.wordScores)
        ? payload.wordScores
          .map((x) => ({
            word: String(x?.word || '').trim(),
            score: Number.isFinite(Number(x?.score)) ? Math.min(100, Math.max(0, Math.round(Number(x?.score)))) : 0,
            issueType: String(x?.issueType || '').trim() || 'unclear',
          }))
          .filter((x) => x.word)
          .slice(0, 12)
        : [],
    }
  }

  const startMixedRecording = async () => {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true })
    micStreamRef.current = media
    const preferredMimeTypes = [
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ]
    const supportedMimeType = preferredMimeTypes.find((mime) =>
      typeof MediaRecorder !== 'undefined'
      && typeof MediaRecorder.isTypeSupported === 'function'
      && MediaRecorder.isTypeSupported(mime)
    )
    const recorder = supportedMimeType
      ? new MediaRecorder(media, { mimeType: supportedMimeType })
      : new MediaRecorder(media)
    recordingMimeTypeRef.current = recorder.mimeType || supportedMimeType || ''
    mixedChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) mixedChunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      media.getTracks().forEach((track) => track.stop())
      if (micStreamRef.current === media) micStreamRef.current = null
      if (micSilenceStopTimerRef.current != null) {
        window.clearTimeout(micSilenceStopTimerRef.current)
        micSilenceStopTimerRef.current = null
      }
      if (micMaxDurationTimerRef.current != null) {
        window.clearTimeout(micMaxDurationTimerRef.current)
        micMaxDurationTimerRef.current = null
      }
    }
    mixedRecorderRef.current = recorder
    autoStoppingMicRef.current = false
    recorder.start(800)

    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let sourceNode: MediaStreamAudioSourceNode | null = null
    let rafId = 0
    let lastVoiceAt = Date.now()
    const SILENCE_MS = 1600
    const MAX_RECORD_MS = 20000
    const RMS_THRESHOLD = 0.018

    const cleanupAudioDetect = () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (sourceNode) sourceNode.disconnect()
      if (analyser) analyser.disconnect()
      if (audioContext) {
        void audioContext.close().catch(() => {
          // ignore close error
        })
      }
    }

    try {
      audioContext = new AudioContext()
      sourceNode = audioContext.createMediaStreamSource(media)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      sourceNode.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)

      const watchSilence = () => {
        if (!mixedRecorderRef.current || mixedRecorderRef.current.state !== 'recording') {
          cleanupAudioDetect()
          return
        }
        analyser!.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128
          sum += centered * centered
        }
        const rms = Math.sqrt(sum / data.length)
        if (rms > RMS_THRESHOLD) {
          lastVoiceAt = Date.now()
        } else if (Date.now() - lastVoiceAt > SILENCE_MS && !autoStoppingMicRef.current) {
          autoStoppingMicRef.current = true
          void stopMixedRecording().catch((e) => {
            const msg = unknownErrorMsg(e)
            setListening(false)
            setRecordingPending(false)
            toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
          })
          cleanupAudioDetect()
          return
        }
        rafId = requestAnimationFrame(watchSilence)
      }
      rafId = requestAnimationFrame(watchSilence)
    } catch {
      // fallback: keep manual stop if analyzer is unavailable
    }

    micMaxDurationTimerRef.current = window.setTimeout(() => {
      if (!autoStoppingMicRef.current && mixedRecorderRef.current?.state === 'recording') {
        autoStoppingMicRef.current = true
        void stopMixedRecording().catch((e) => {
          const msg = unknownErrorMsg(e)
          setListening(false)
          setRecordingPending(false)
          toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
        })
      }
      cleanupAudioDetect()
    }, MAX_RECORD_MS)
    setListening(true)
  }

  const stopMixedRecording = async () => {
    const recorder = mixedRecorderRef.current
    if (!recorder) return
    if (micSilenceStopTimerRef.current != null) {
      window.clearTimeout(micSilenceStopTimerRef.current)
      micSilenceStopTimerRef.current = null
    }
    if (micMaxDurationTimerRef.current != null) {
      window.clearTimeout(micMaxDurationTimerRef.current)
      micMaxDurationTimerRef.current = null
    }
    await new Promise<void>((resolve) => {
      const done = () => {
        recorder.removeEventListener('stop', done)
        resolve()
      }
      recorder.addEventListener('stop', done)
      recorder.stop()
    })
    mixedRecorderRef.current = null
    setListening(false)

    const preferredMimeType = String(recordingMimeTypeRef.current || '').trim()
    const chunkMimeType = String(mixedChunksRef.current[0]?.type || '').trim()
    const finalMimeType = preferredMimeType || chunkMimeType || 'audio/webm'
    const blob = new Blob(mixedChunksRef.current, { type: finalMimeType })
    mixedChunksRef.current = []
    recordingMimeTypeRef.current = ''
    if (blob.size === 0) {
      throw new Error(localText('Không thu được âm thanh từ mic.', 'No audio captured from microphone.'))
    }
    if (recordingForDrillRef.current) {
      recordingForDrillRef.current = false
      const cb = onDrillRecordingCompleteRef.current
      onDrillRecordingCompleteRef.current = null
      if (cb) cb(blob)
      return
    }
    pendingRecordingBlobRef.current = blob
    setRecordingPending(true)
  }

  const sendPendingRecording = async () => {
    if (isMiniDrillBlocking) {
      redirectToMiniDrill()
      return
    }
    if (liveSessionTurnLimitReached) {
      toast({
        title: localText('Đã chạm giới hạn lượt hỏi', 'Turn limit reached'),
        description: localText(
          `Buổi live hiện tại đã dùng ${liveSessionTurnLimit}/${liveSessionTurnLimit} lượt. Bấm mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit) để tiếp tục.`,
          `This live lesson has reached ${liveSessionTurnLimit}/${liveSessionTurnLimit} turns. Unlock ${LIVE_SESSION_EXTRA_TURN_STEP} more turns (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credits) to continue.`
        ),
        variant: 'destructive',
      })
      return
    }
    const blob = pendingRecordingBlobRef.current
    if (!blob) return
    if (isPresetPageSession && !isMiniDrillBlocking && !latestMainSentenceForLearner) {
      toast({
        title: localText('Đã hoàn thành bài học có sẵn', 'Saved lesson completed'),
        description: localText('Bạn đã đọc hết các câu của bài học này.', 'You have completed all reading lines in this saved lesson.'),
      })
      pendingRecordingBlobRef.current = null
      setRecordingPending(false)
      return
    }
    const isPresetDirectReadFlow =
      isPresetPageSession
      && !isMiniDrillBlocking
      && Boolean(String(latestMainSentenceForLearner?.sentence || '').trim())
    pendingRecordingBlobRef.current = null
    setRecordingPending(false)
    setBusy(true)
    setAwaitingTeacherReply(true)
    const placeholderText = isPresetDirectReadFlow
      ? localText('Đang gửi câu đọc...', 'Submitting your reading...')
      : localText('Đang chuyển giọng nói thành chữ...', 'Converting speech to text...')
    const studentMessageId = appendMessage('student', placeholderText)
    const localAudioUrl = URL.createObjectURL(blob)
    createdAudioUrlsRef.current.push(localAudioUrl)
    studentAudioByMessageIdRef.current = {
      ...studentAudioByMessageIdRef.current,
      [studentMessageId]: localAudioUrl,
    }
    setStudentAudioByMessageId((prev) => ({ ...prev, [studentMessageId]: localAudioUrl }))
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    try {
      let analysis: MixedSpeechAnalysis | undefined
      let transcript = ''
      if (isPresetDirectReadFlow) {
        transcript = String(latestMainSentenceForLearner?.sentence || '').trim()
        setDraft(transcript)
      } else {
        analysis = await transcribeSpeechAudio(blob)
        setLatestPronunciationScore(analysis.pronunciationScore || null)
        setLatestWeakWords(analysis.weakWords || [])
        setLatestPronunciationBreakdown({
          accuracy: analysis.pronunciationAccuracy || null,
          fluency: analysis.pronunciationFluency || null,
          prosody: analysis.pronunciationProsody || null,
        })
        setLatestWordScores(analysis.wordScores || [])
        const transcriptByMode =
          speakingLanguageMode === 'target'
            ? analysis.targetTranscript || analysis.mergedTranscript || analysis.nativeTranscript
            : speakingLanguageMode === 'native'
              ? analysis.nativeTranscript || analysis.mergedTranscript || analysis.targetTranscript
              : analysis.mergedTranscript || analysis.targetTranscript || analysis.nativeTranscript
        setDraft(transcriptByMode)
        transcript = String(transcriptByMode || '').trim()
      }
      updateMessageText(studentMessageId, transcript || placeholderText)
      if (!transcript) {
        setBusy(false)
        setAwaitingTeacherReply(false)
        updateMessageText(studentMessageId, localText('Không nhận được chữ từ giọng nói.', 'Could not convert speech to text.'))
        toast({ title: coachUiText.micErrorTitle, description: localText('Không chuyển được giọng nói thành chữ.', 'Could not convert speech to text.'), variant: 'destructive' })
        return
      }
      let uploadedStudentAudioUrl = ''
      try {
        uploadedStudentAudioUrl = await uploadStudentAudio(studentMessageId, blob, blob.type || 'audio/webm')
        if (uploadedStudentAudioUrl) {
          studentAudioByMessageIdRef.current = {
            ...studentAudioByMessageIdRef.current,
            [studentMessageId]: uploadedStudentAudioUrl,
          }
          setStudentAudioByMessageId((prev) => ({ ...prev, [studentMessageId]: uploadedStudentAudioUrl }))
        }
      } catch {
        // keep local object URL for in-session replay if upload fails
      }
      if (isPresetDirectReadFlow) {
        void saveHistoryMessage({
          role: 'student',
          text: transcript,
          audioUrl: uploadedStudentAudioUrl || localAudioUrl,
          clientMessageId: studentMessageId,
        }).then(() => {
          persistedMessageIdsRef.current[studentMessageId] = true
        }).catch(() => {})
        setBusy(false)
        setAwaitingTeacherReply(false)
        return
      }
      await handleSend(transcript, 'mic', analysis, {
        existingStudentMessageId: studentMessageId,
        studentAudioUrl: uploadedStudentAudioUrl || localAudioUrl,
      })
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
      setBusy(false)
      setAwaitingTeacherReply(false)
      updateMessageText(studentMessageId, localText('Lỗi khi chuyển giọng nói.', 'Error converting speech.'))
    }
  }

  const handlePlaybackRecording = () => {
    const blob = pendingRecordingBlobRef.current
    if (!blob) return
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.onplaying = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.playbackRate = playbackSpeedRef.current
    audioRef.current = audio
    let didStartPlaying = false
    let didFinish = false
    audio.onplaying = () => {
      didStartPlaying = true
    }
    audio.onended = () => {
      didFinish = true
      URL.revokeObjectURL(url)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      if (didStartPlaying || didFinish) return
      toast({
        title: localText('Không phát được ghi âm', 'Unable to play recording'),
        description: localText(
          'Thiết bị hiện tại không hỗ trợ định dạng ghi âm này. Hãy bấm "Nói lại" để thử lại.',
          'This device does not support the recorded audio format. Please tap "Record again" and try once more.'
        ),
        variant: 'destructive',
      })
    }
    void audio.play().catch(() => {
      URL.revokeObjectURL(url)
      if (didStartPlaying || didFinish) return
      toast({
        title: localText('Không phát được ghi âm', 'Unable to play recording'),
        description: localText(
          'iPhone có thể đã chặn phát âm thanh. Hãy bấm lại "Nghe lại" hoặc "Nói lại".',
          'iPhone may have blocked audio playback. Please tap "Play back" again or "Record again".'
        ),
        variant: 'destructive',
      })
    })
  }

  const handleRecordAgain = () => {
    pendingRecordingBlobRef.current = null
    setRecordingPending(false)
    void startMixedRecording().catch((e) => {
      const msg = e instanceof Error ? e.message : localText('Không bật được mic.', 'Unable to start microphone.')
      toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
    })
  }

  const handleMic = () => {
    if (listening) {
      void stopMixedRecording().catch((e) => {
        const msg = unknownErrorMsg(e)
        setListening(false)
        setRecordingPending(false)
        toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
      })
      return
    }
    if (isMiniDrillBlocking) {
      redirectToMiniDrill()
      return
    }
    if (liveSessionTurnLimitReached) {
      toast({
        title: localText('Đã chạm giới hạn lượt hỏi', 'Turn limit reached'),
        description: localText(
          `Buổi live hiện tại đã dùng ${liveSessionTurnLimit}/${liveSessionTurnLimit} lượt. Bấm mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit) để tiếp tục.`,
          `This live lesson has reached ${liveSessionTurnLimit}/${liveSessionTurnLimit} turns. Unlock ${LIVE_SESSION_EXTRA_TURN_STEP} more turns (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credits) to continue.`
        ),
        variant: 'destructive',
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({
        title: localText('Thiết bị chưa hỗ trợ', 'Device not supported'),
        description: localText(
          'Trình duyệt này chưa hỗ trợ ghi âm microphone.',
          'This browser does not support microphone recording.'
        ),
        variant: 'destructive',
      })
      return
    }
    void startMixedRecording().catch((e) => {
      const msg = e instanceof Error ? e.message : localText('Không bật được mic.', 'Unable to start microphone.')
      toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
    })
  }

  const jumpToConversationStart = useCallback(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      activeLessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
    window.setTimeout(() => {
      activeLessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [])

  const scrollToSpeakActions = useCallback(() => {
    const target = speakActionsRef.current
    if (!target || typeof window === 'undefined') return
    const chatScroller = chatScrollRef.current
    if (chatScroller) {
      const supportsSmooth = typeof chatScroller.scrollTo === 'function'
      if (supportsSmooth) {
        chatScroller.scrollTo({ top: chatScroller.scrollHeight, behavior: 'smooth' })
      } else {
        chatScroller.scrollTop = chatScroller.scrollHeight
      }
    }
    const mobileBottomNav = document.querySelector('nav.safe-area-pb') as HTMLElement | null
    const navHeight = mobileBottomNav ? mobileBottomNav.getBoundingClientRect().height : 0
    const marginAboveNav = 10
    const rect = target.getBoundingClientRect()
    const desiredTop = Math.max(0, window.innerHeight - navHeight - marginAboveNav - rect.height)
    const nextTop = window.scrollY + rect.top - desiredTop
    window.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [])

  return (
    <>
      <Toaster />
      <div className="mx-auto w-full min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
        <div className="min-w-0 rounded-2xl border border-border/70 bg-card/80 px-3 py-4 text-center shadow-sm backdrop-blur-sm sm:px-5 sm:py-5">
          <h1 className="flex flex-wrap items-center justify-center gap-2 break-words text-xl font-bold text-foreground sm:text-2xl lg:text-3xl">
            <Languages className="h-6 w-6 shrink-0 text-indigo-600" />
            <span className="min-w-0">{localText('Học ngoại ngữ tương tác cùng giáo viên bản địa AI', 'Interactive language learning with native AI teachers')}</span>
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 sm:hidden">
            <Button
              type="button"
              size="sm"
              variant={compactMode ? 'default' : 'outline'}
              onClick={() => setCompactMode((prev) => !prev)}
              className="min-h-[40px] rounded-lg px-3 text-xs"
            >
              {compactMode
                ? localText('Chế độ gọn: Bật', 'Compact mode: On')
                : localText('Chế độ gọn: Tắt', 'Compact mode: Off')}
            </Button>
          </div>
          {!compactMode ? (
            <p className="mx-auto mt-2 max-w-4xl min-w-0 break-words text-sm text-muted-foreground sm:text-base">
              {localText(
                'Chọn ngôn ngữ muốn học và chọn giáo viên bản địa tương ứng. Nói chuyện trực tiếp và được sửa lỗi phát âm/ngữ pháp ngay sau mỗi lượt.',
                'Choose your target language and matching native teacher. Talk live and get instant pronunciation/grammar corrections each turn.'
              )}
            </p>
          ) : null}
        </div>

        <Card className="section-surface min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="break-words">{coachUiText.setupTitle}</CardTitle>
            {!compactMode ? <CardDescription className="break-words">{coachUiText.setupDesc}</CardDescription> : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={handleOpenQuickStartSetup}
                disabled={quickStartBusy || topicBusy || startingLesson || busy}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {quickStartStageLabel}
              </Button>
            </div>
            {historySessions.length > 0 ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  {localText('Danh sách buổi học đang dở (mới → cũ)', 'In-progress lessons (newest → oldest)')}
                </p>
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {historySessions.map((s) => (
                    <div key={s.sessionId} className="flex min-w-0 items-center gap-1 sm:gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openSessionByRoute(s.sessionId, Boolean(s.isPresetReplaySession))}
                        disabled={historyBusy}
                        className="min-h-[44px] min-w-0 flex-1 justify-start overflow-visible text-left sm:flex-none sm:w-auto sm:max-w-[min(78vw,52rem)]"
                      >
                        <span className="block min-w-0 whitespace-normal break-words text-left">
                          {s.topicLabel || localText('Buổi học', 'Lesson')}
                          {` • ${s.isPresetReplaySession ? localText('Bài có sẵn', 'Saved lesson') : localText('Live AI', 'Live AI')}`}
                          {s.learningMode === 'reflex'
                            ? ` • ${localText('Phản xạ', 'Reflex')}`
                            : s.learningMode === 'review'
                              ? ` • ${localText('Ôn tập', 'Review')}`
                              : ''}
                          {' • '}
                          {s.messageCount} {localText('lượt', 'turns')}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          void deleteSession(s.sessionId)
                        }}
                        disabled={historyBusy}
                        title={localText('Xóa buổi học', 'Delete lesson')}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className={`min-w-0 space-y-4 px-0 sm:px-1 ${showSetupPanel ? '' : 'hidden'}`}>
            <div className="min-w-0 rounded-xl border border-border/70 bg-slate-50/80 p-3 sm:p-4">
              <p className="break-words text-sm font-semibold text-slate-900">
                {localText('Chẩn đoán level tự động (khuyến nghị)', 'Auto placement test (recommended)')}
              </p>
              {!compactMode ? (
                <p className="mt-1 break-words text-xs text-slate-600">
                  {localText(
                    'Nhập 2-3 câu bạn tự nói bằng ngôn ngữ đang học. Hệ thống sẽ gợi ý level, sau đó bạn vẫn chỉnh tay được.',
                    'Enter 2-3 sentences in your target language. The system recommends a level; you can still change it manually.'
                  )}
                </p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {placementSamples.map((value, idx) => (
                  <Input
                    key={`placement-sample-${idx}`}
                    value={value}
                    onChange={(e) => {
                      const next = [...placementSamples]
                      next[idx] = e.target.value
                      setPlacementSamples(next)
                    }}
                    placeholder={localText(`Câu mẫu ${idx + 1}`, `Sample sentence ${idx + 1}`)}
                    disabled={placementBusy}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runPlacementQuickTest()}
                  disabled={placementBusy}
                >
                  {placementBusy
                    ? localText('Đang phân tích...', 'Analyzing...')
                    : localText('Gợi ý level tự động', 'Recommend level automatically')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runCefrAssessmentAction('baseline')}
                  disabled={assessmentBusy}
                >
                  {assessmentBusy
                    ? localText('Đang lưu baseline...', 'Saving baseline...')
                    : localText('Lưu baseline CEFR', 'Save CEFR baseline')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runCefrAssessmentAction('checkpoint')}
                  disabled={assessmentBusy}
                >
                  {assessmentBusy
                    ? localText('Đang chạy checkpoint...', 'Running checkpoint...')
                    : localText('Chạy checkpoint CEFR', 'Run CEFR checkpoint')}
                </Button>
                {placementResult ? (
                  <p className="break-words text-xs text-slate-700">
                    {localText('Kết quả:', 'Result:')} <span className="font-semibold">{levelLabelUi(placementResult.recommendedLevel)}</span>
                    {' • '}
                    {localText('Độ tin cậy', 'Confidence')} {placementResult.confidence}%
                    {!compactMode ? (
                      <>
                        {' • '}
                        {placementResult.reason}
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {localText('Bạn có thể bỏ qua bước này và tự chọn level bên dưới.', 'You can skip this and choose level manually below.')}
                  </p>
                )}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
              <div className="space-y-1 xl:col-span-2">
                <label className="text-sm font-medium">{coachUiText.learningLanguage}</label>
                <select
                  value={languageCode}
                  onChange={(e) => {
                    const code = e.target.value as LanguageCode
                    setLanguageCode(code)
                    const firstTeacher = TEACHERS_BY_LANGUAGE[code]?.[0]
                    if (firstTeacher) setTeacherId(firstTeacher.id)
                  }}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 xl:col-span-2">
                <label className="text-sm font-medium">{coachUiText.nativeLanguage}</label>
                <select
                  value={nativeLanguageCode}
                  onChange={(e) => setNativeLanguageCode(e.target.value as NativeLanguageCode)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {nativeLanguageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 xl:col-span-2">
                <label className="text-sm font-medium">{coachUiText.nativeTeacher}</label>
                <select
                  value={selectedTeacher.id}
                  onChange={(e) => setTeacherId(e.target.value)}
                  disabled={messages.length > 0}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </option>
                  ))}
                </select>
                {messages.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {localText(
                      'Giáo viên được khóa trong buổi hiện tại. Bấm "Buổi học mới" để đổi.',
                      'Teacher is locked for this session. Click "New lesson" to change.'
                    )}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 xl:col-span-2">
                <label className="text-sm font-medium">{coachUiText.learningMode}</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="chat">{modeLabelUi('chat')}</option>
                  <option value="listen_speak">{modeLabelUi('listen_speak')}</option>
                  <option value="roleplay_short">{modeLabelUi('roleplay_short')}</option>
                </select>
              </div>
              <div className="space-y-1 xl:col-span-2">
                <label className="text-sm font-medium">{coachUiText.learnerLevel}</label>
                <select
                  value={learnerLevel}
                  onChange={(e) => setLearnerLevel(Number(e.target.value) as LearnerLevel)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>{levelLabelUi(0)}</option>
                  <option value={1}>{levelLabelUi(1)}</option>
                  <option value={2}>{levelLabelUi(2)}</option>
                  <option value={3}>{levelLabelUi(3)}</option>
                  <option value={4}>{levelLabelUi(4)}</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2 xl:col-span-4">
                <label className="text-sm font-medium">{coachUiText.lessonTopic}</label>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">{localText('Chủ đề có sẵn', 'Built-in topics')}</p>
                    <select
                      value={builtInTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                      onChange={(e) => {
                        const value = String(e.target.value || '').trim()
                        if (!value) return
                        setTopicSourceMode('builtin')
                        setPendingTopicId(value)
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-sm ${
                        topicSourceMode === 'builtin'
                          ? 'border-slate-900 bg-slate-50 text-slate-900'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">{localText('Chọn chủ đề có sẵn...', 'Select built-in topic...')}</option>
                      {builtInTopicOptions.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {(() => {
                            const base = topicBaseDifficultyById[topic.id] || 'basic'
                            if (base === 'adaptive') return topic.label
                            return `${topic.label} [${difficultyLabelUi(base)}]`
                          })()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">{localText('Chủ đề mới tạo', 'Custom topics')}</p>
                    <select
                      value={customTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                      onChange={(e) => {
                        const value = String(e.target.value || '').trim()
                        if (!value) return
                        setTopicSourceMode('custom')
                        setPendingTopicId(value)
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-sm ${
                        topicSourceMode === 'custom'
                          ? 'border-slate-900 bg-slate-50 text-slate-900'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">
                        {customTopicOptions.length > 0
                          ? localText('Chọn chủ đề mới tạo...', 'Select custom topic...')
                          : localText('Chưa có chủ đề mới tạo', 'No custom topic yet')}
                      </option>
                      {customTopicOptions.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {(() => {
                            const base = topicBaseDifficultyById[topic.id] || 'basic'
                            if (base === 'adaptive') return topic.label
                            return `${topic.label} [${difficultyLabelUi(base)}]`
                          })()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={topicFilterMode}
                    onChange={(e) => setTopicFilterMode(e.target.value as TopicFilterMode)}
                    className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="fit">{localText('Phù hợp level', 'Match level')}</option>
                    <option value="all">{localText('Tất cả', 'All')}</option>
                  </select>
                </div>
                {!compactMode ? (
                  <p className="text-xs text-slate-500">
                    {localText(
                      'Bấm chọn ở 1 trong 2 ô chủ đề bên trên, sau đó bấm 1 nút xác nhận chung ở cụm hành động bên dưới.',
                      'Pick a topic from one of the two topic boxes above, then use the single confirm button in the action block below.'
                    )}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customTopicDraft}
                    onChange={(e) => setCustomTopicDraft(e.target.value)}
                    placeholder={coachUiText.customTopicPlaceholder}
                    className="h-11 min-w-0 w-full rounded-xl text-base sm:min-w-0 sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void normalizeAndSaveCustomTopic()}
                    disabled={customTopicBusy}
                    className="h-11 rounded-xl px-4 sm:shrink-0"
                  >
                    {customTopicBusy ? localText('Đang tạo chủ đề mới...', 'Creating topic...') : localText('Tạo chủ đề mới', 'Create topic')}
                  </Button>
                </div>
                {!compactMode ? (
                  <p className="text-xs text-slate-500">
                    {localText(
                      'Nhập ý tưởng để AI chuẩn hóa thành chủ đề mới, tự lưu và tự chọn để bắt đầu học.',
                      'Enter an idea for AI to normalize into a new topic, save it, and auto-select it for learning.'
                    )}
                  </p>
                ) : null}
                {!compactMode && customTopicOptions.length === 0 && topicSourceMode === 'custom' ? (
                  <p className="text-xs text-slate-500">
                    {localText(
                      'Chưa có chủ đề mới tạo cho cặp ngôn ngữ/level hiện tại. Bạn có thể tạo mới ở ô bên trên.',
                      'No custom topic found for current language pair/level. You can create one above.'
                    )}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-md border bg-emerald-50/50 p-3 space-y-2">
                <p className="break-words text-sm font-semibold text-emerald-900">{localText('Goal Path (30 ngày)', 'Goal Path (30 days)')}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as GoalType)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                  {goalOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={() => void saveLearningGoal()} disabled={goalBusy}>
                    {goalBusy ? localText('Đang lưu...', 'Saving...') : localText('Lưu mục tiêu', 'Save goal')}
                  </Button>
                </div>
                <p className="break-words text-xs text-slate-600">
                  {activeGoal
                    ? localText(
                        `Đang theo mục tiêu: ${goalLabelById[activeGoalType]} • ${activeGoal.target_days} ngày • ${activeGoal.target_daily_minutes} phút/ngày`,
                        `Current goal: ${goalLabelById[activeGoalType]} • ${activeGoal.target_days} days • ${activeGoal.target_daily_minutes} min/day`
                      )
                    : localText(
                        'Chưa có mục tiêu chủ động. Chọn mục tiêu để hệ thống theo dõi tiến độ sát hơn.',
                        'No active goal yet. Choose one for closer progress tracking.'
                      )}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-border/70 bg-slate-50/80 p-3 space-y-1">
                <p className="break-words text-sm font-semibold text-slate-900">{localText('Dashboard tiến độ hôm nay', "Today's progress dashboard")}</p>
                <p className="break-words text-sm text-slate-700">
                  {localText('Chuỗi học:', 'Streak:')} <span className="font-semibold">{progressSnapshot?.streak_days ?? 0} {localText('ngày', 'days')}</span>
                </p>
                <p className="break-words text-sm text-slate-700">
                  {localText('Lượt hội thoại:', 'Turns:')} <span className="font-semibold">{progressSnapshot?.turns_count ?? 0}</span> •
                  {localText('Điểm phát âm TB:', 'Avg pronunciation:')} <span className="font-semibold">{progressSnapshot?.avg_pronunciation_score ?? 0}</span>
                </p>
                <p className="break-words text-sm text-slate-700">
                  {localText('Từ mới hôm nay:', 'New words today:')} <span className="font-semibold">{progressSnapshot?.new_words_count ?? 0}</span> •
                  {localText('Đến hạn ôn:', 'Due for review:')} <span className="font-semibold">{dueReviewCount}</span>
                </p>
                {weeklySnapshot ? (
                  <p className="break-words text-sm text-slate-700">
                    {localText('Tiến độ tuần:', 'Weekly progress:')}{' '}
                    <span className="font-semibold">
                      {weeklySnapshot.sessions}/{weeklySnapshot.targetSessions}
                    </span>{' '}
                    {localText('buổi', 'sessions')} • {weeklySnapshot.completionPercent}%
                  </p>
                ) : null}
                <p className="break-words text-sm text-slate-700">
                  {localText('CEFR baseline/checkpoint:', 'CEFR baseline/checkpoint:')}{' '}
                  <span className="font-semibold">
                    {assessmentBaseline?.cefr_level || '-'} / {assessmentCheckpoint?.cefr_level || '-'}
                  </span>
                  {assessmentDeltaOverall !== null
                    ? ` • ${localText('Chênh lệch điểm', 'Score delta')} ${assessmentDeltaOverall >= 0 ? '+' : ''}${assessmentDeltaOverall}`
                    : ''}
                </p>
                {learningBadges.length > 0 ? (
                  <p className="text-xs text-slate-600">
                    {localText('Badge tuần:', 'Weekly badges:')} {learningBadges.join(' • ')}
                  </p>
                ) : null}
                {reviewFocusWords.length > 0 || reviewFocusNote ? (
                  <p className="text-xs text-slate-600">
                    {localText('Ôn cá nhân hóa:', 'Personalized review:')}{' '}
                    {reviewFocusWords.length > 0 ? reviewFocusWords.join(', ') : reviewFocusNote}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-3 sm:p-4">
              <div className="mb-3 flex min-w-0 flex-wrap items-center gap-4">
                <div className="min-w-0">
                  <p className="mb-1 break-words text-xs font-medium text-slate-700">{localText('Chế độ học', 'Learning mode')}</p>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="learningModeSetup"
                        value="review"
                        checked={learningMode === 'review'}
                        onChange={() => setLearningMode('review')}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-sm">{localText('Ôn tập', 'Review')}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="learningModeSetup"
                        value="reflex"
                        checked={learningMode === 'reflex'}
                        onChange={() => setLearningMode('reflex')}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-sm">{localText('Phản xạ', 'Reflex')}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={`shrink-0 rounded-full border px-3 py-1.5 break-words text-xs font-semibold ${
                    isTopicConfirmedForLesson ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {isTopicConfirmedForLesson ? '✅' : '⏳'} {localText('B1: Chọn chủ đề', 'S1: Select topic')}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1.5 break-words text-xs font-semibold ${
                    hasCurriculumReady ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {hasCurriculumReady ? '✅' : '⏳'} {localText('B2: Tạo giáo trình', 'S2: Create curriculum')}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1.5 break-words text-xs font-semibold ${
                    isLessonReadyToStart ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {isLessonReadyToStart ? '✅' : '⏳'} {localText('B3: Bắt đầu bài học', 'S3: Start lesson')}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  type="button"
                  onClick={() => void handleStartLessonClick()}
                  disabled={quickStartBusy || !isLessonReadyToStart || startingLesson}
                  className="min-h-[44px] w-full"
                >
                  <Volume2 className="mr-2 h-4 w-4" /> {localText('Bắt đầu buổi học', 'Start lesson')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={startNewSession}
                  disabled={quickStartBusy || messages.length === 0 || startingLesson || busy || historyBusy}
                  className="min-h-[44px] w-full"
                >
                  {localText('Buổi học mới', 'New lesson')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!pendingTopicId) return
                    confirmTopicForLearning(pendingTopicId)
                  }}
                  disabled={quickStartBusy || !pendingTopicId}
                  className="min-h-[44px] w-full"
                >
                  {localText('Xác nhận chủ đề đã chọn', 'Confirm selected topic')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchTopicCurriculum()}
                  disabled={quickStartBusy || topicBusy || !isTopicConfirmedForLesson}
                  className="min-h-[44px] w-full"
                >
                  {topicBusy ? localText('Đang tạo...', 'Generating...') : localText('Tạo/Lấy giáo trình', 'Create/Get curriculum')}
                </Button>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-indigo-900">{localText('Giáo trình theo chủ đề', 'Topic curriculum')}</p>
              </div>
              {!compactMode ? (
                <p className="mb-2 text-xs text-slate-600">
                  {localText('Độ khó tự động theo level hiện tại:', 'Auto difficulty for current level:')} <span className="font-semibold">{difficultyLabelUi(selectedTopicDifficulty)}</span>
                </p>
              ) : null}
              {!topicCurriculum ? (
                <p className="text-sm text-muted-foreground">
                  {localText(
                    'Chọn chủ đề và bấm "Tạo/Lấy giáo trình chủ đề". Giáo trình sẽ được AI tạo và lưu DB để người học khác dùng lại.',
                    'Choose a topic and click "Create/Get curriculum". AI will generate and cache it so others can reuse it.'
                  )}
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">{localText('Vai nhập vai:', 'Role:')}</span> {topicCurriculum.roleplayRole || 'Facilitator'}</p>
                  <p><span className="font-semibold">{localText('Nhiệm vụ hôm nay:', "Today's mission:")}</span> {topicCurriculum.dailyQuest}</p>
                  <p><span className="font-semibold">{localText('Mục tiêu:', 'Objective:')}</span> {topicCurriculum.objective}</p>
                  <p><span className="font-semibold">{localText('Từ khóa:', 'Keywords:')}</span> {topicCurriculum.keywords.join(', ') || localText('Chưa có', 'N/A')}</p>
                  <p><span className="font-semibold">{localText('Mẫu câu mở đầu:', 'Starter sentences:')}</span> {topicCurriculum.starterSentences.join(' | ') || localText('Chưa có', 'N/A')}</p>
                </div>
              )}
            </div>
            {levelRecommendation && levelRecommendation.suggestedLevel !== learnerLevel ? (
              <div
                className={`rounded-xl border p-3 ${
                  levelRecommendation.direction === 'up'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={`min-w-0 break-words text-sm ${
                      levelRecommendation.direction === 'up' ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    {levelRecommendation.reason}{' '}
                    {localText('Độ tin cậy', 'Confidence')}: {levelRecommendation.confidence}%.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const nextLevel = Math.min(4, Math.max(0, Number(levelRecommendation.suggestedLevel))) as LearnerLevel
                      setLearnerLevel(nextLevel)
                      setLevelRecommendation(null)
                      toast({
                        title: localText('Đã áp dụng level đề xuất', 'Recommended level applied'),
                        description: localText(
                          `Level hiện tại: ${levelLabelUi(nextLevel)}`,
                          `Current level: ${levelLabelUi(nextLevel)}`
                        ),
                      })
                    }}
                  >
                    {localText(
                      `Áp dụng ${levelLabelUi(levelRecommendation.suggestedLevel as LearnerLevel)}`,
                      `Apply ${levelLabelUi(levelRecommendation.suggestedLevel as LearnerLevel)}`
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="min-w-0 rounded-xl border border-border/70 bg-slate-50/80 p-3">
              <p className="break-words text-sm text-slate-700">
                {selectedTeacherLabel} <span className="font-semibold">{teacherLabel}</span>
              </p>
            </div>
            {!isTopicConfirmedForLesson ? (
              <p className="text-xs text-amber-700">
                {localText(
                  'Bạn cần bấm "Học chủ đề này" trước khi tạo giáo trình.',
                  'Please click "Learn this topic" before creating curriculum.'
                )}
              </p>
            ) : !hasCurriculumReady ? (
              <p className="text-xs text-amber-700">
                {localText(
                  'Bạn cần bấm "Tạo/Lấy giáo trình chủ đề" trước khi bắt đầu buổi học.',
                  'Please click "Create/Get curriculum" before starting the lesson.'
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canShowDirectConversation ? (
        <div ref={activeLessonRef} className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="section-surface min-w-0">
            <CardHeader className="flex min-w-0 flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words">{coachUiText.chatTitle}</CardTitle>
                {!compactMode ? <CardDescription className="break-words">{coachUiText.chatDesc}</CardDescription> : null}
              </div>
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void endLessonAndStartNew()}
                  disabled={startingLesson || busy || historyBusy}
                  className="shrink-0 text-xs"
                >
                  {localText('Kết thúc buổi học', 'End lesson')}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 px-0 pb-20 sm:px-1 sm:pb-24">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                {(() => {
                  const curriculum = topicCurriculum || preLessonCurriculum
                  const steps = curriculum?.lessonSteps ?? []
                  const studentTurnCount = messages.filter((m) => m.role === 'student').length
                  const completedCount = computeTimelineCompletedSteps(steps.length, studentTurnCount)
                  const hasSteps = steps.length > 0
                  const showTimeline = messages.length > 0
                  return showTimeline ? (
                    <>
                    {hasSteps ? (
                      <>
                      {/* Mobile: timeline nằm ngang, scroll ngang */}
                      <div className="min-w-0 shrink-0 sm:w-36 sm:max-h-[40vh] sm:max-h-none">
                        <p className="mb-2 text-xs font-semibold text-slate-600">
                          {localText('Tiến độ buổi học', 'Lesson progress')}
                        </p>
                        <div className="flex flex-row gap-0 overflow-x-auto pb-2 scroll-smooth sm:flex-col sm:overflow-visible sm:gap-0 sm:pb-0">
                          {steps.map((step, i) => {
                            const isCompleted = i < completedCount
                            const isCurrent = i === completedCount
                            return (
                              <div
                                key={i}
                                className="relative flex min-w-[72px] shrink-0 flex-col items-center gap-0 cursor-help sm:min-w-0 sm:flex-row sm:items-start sm:gap-2"
                                title={step}
                              >
                                <div className="flex flex-row items-center sm:flex-col sm:items-center">
                                  <div
                                    className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                                      isCompleted
                                        ? 'border-emerald-500 bg-emerald-500'
                                        : isCurrent
                                          ? 'border-indigo-500 bg-indigo-400 ring-2 ring-indigo-200'
                                          : 'border-slate-300 bg-slate-100'
                                    }`}
                                  />
                                  {i < steps.length - 1 ? (
                                    <div
                                      className={`h-0.5 w-4 shrink-0 sm:h-5 sm:w-0.5 ${
                                        isCompleted ? 'bg-emerald-300' : 'bg-slate-200'
                                      }`}
                                    />
                                  ) : null}
                                </div>
                                <div
                                  className={`mt-0.5 w-[72px] truncate text-center text-[10px] sm:mt-1.5 sm:w-auto sm:flex-1 sm:truncate-none sm:text-left sm:text-xs ${
                                    isCompleted ? 'text-slate-600' : isCurrent ? 'font-medium text-indigo-700' : 'text-slate-400'
                                  }`}
                                >
                                  {step.slice(0, 50)}
                                  {step.length > 50 ? '…' : ''}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {completedCount}/{steps.length} {localText('bước', 'steps')} • {studentTurnCount}/{LESSON_TIMELINE_TARGET_TURNS} {localText('lượt hỏi', 'question turns')}
                        </p>
                      </div>
                      </>
                    ) : (
                      <div className="shrink-0 w-28 sm:w-32">
                        <p className="mb-2 text-xs font-semibold text-slate-600">
                          {localText('Tiến độ buổi học', 'Lesson progress')}
                        </p>
                        <p className="text-xs text-slate-600">
                          {studentTurnCount}/{LESSON_TIMELINE_TARGET_TURNS} {localText('lượt hỏi', 'question turns')}
                        </p>
                      </div>
                    )}
                    </>
                  ) : null
                })()}
              <div ref={chatScrollRef} className="relative left-1/2 right-1/2 w-[calc(100vw-0.4rem)] -translate-x-1/2 max-h-[64vh] min-w-0 flex-1 space-y-2.5 overflow-auto rounded-xl border border-border/70 bg-slate-50/90 p-3 pb-14 scroll-pb-14 sm:static sm:left-auto sm:right-auto sm:w-auto sm:translate-x-0 sm:max-h-[34rem] sm:p-3.5 sm:pb-20 sm:scroll-pb-20">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    {historySessions.length > 0 ? (
                      <div className="min-w-0 rounded-md border border-indigo-200 bg-indigo-50 p-3">
                        <p className="mb-2 break-words text-sm font-medium text-indigo-900">
                          {historySessions.length === 1
                            ? localText('Bạn có buổi học đã lưu. Bấm để tiếp tục học.', 'You have a saved lesson. Tap to continue.')
                            : localText('Bạn có nhiều buổi học dở. Chọn buổi để tiếp tục:', 'You have multiple lessons in progress. Choose one to continue:')}
                        </p>
                        {historySessions.length === 1 ? (
                          <div className="flex min-w-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const s = historySessions[0]
                              if (s?.sessionId) openSessionByRoute(s.sessionId, Boolean(s.isPresetReplaySession))
                            }}
                            disabled={historyBusy}
                            className="min-h-[44px] min-w-0 flex-1 justify-start overflow-visible text-left sm:flex-none sm:w-auto sm:max-w-[min(78vw,52rem)]"
                          >
                            <span className="block min-w-0 break-words text-left whitespace-normal">
                              {localText('Tiếp tục buổi học', 'Continue lesson')}
                              {historySessions[0]?.topicLabel ? `: ${historySessions[0].topicLabel}` : ''}
                              {historySessions[0]?.learningMode === 'reflex'
                                ? ` (${localText('Phản xạ', 'Reflex')})`
                                : historySessions[0]?.learningMode === 'review'
                                  ? ` (${localText('Ôn tập', 'Review')})`
                                  : ''}
                            </span>
                          </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                const s = historySessions[0]
                                if (s?.sessionId) void deleteSession(s.sessionId)
                              }}
                              disabled={historyBusy}
                              title={localText('Xóa buổi học', 'Delete lesson')}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="min-w-0 space-y-2">
                            {historySessions.slice(0, 5).map((s) => (
                              <div key={s.sessionId} className="flex min-w-0 items-center gap-1 sm:gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openSessionByRoute(s.sessionId, Boolean(s.isPresetReplaySession))}
                                  disabled={historyBusy}
                                  className="min-h-[44px] min-w-0 flex-1 justify-start overflow-visible text-left sm:flex-none sm:w-auto sm:max-w-[min(78vw,52rem)]"
                                >
                                  <span className="block min-w-0 break-words text-left whitespace-normal">
                                    {s.topicLabel ? (
                                      <>
                                        <span className="font-medium">{s.topicLabel}</span>
                                        {' • '}
                                        {s.isPresetReplaySession ? localText('Bài có sẵn', 'Saved lesson') : localText('Live AI', 'Live AI')}
                                        {' • '}
                                        {s.teacherLabel || localText('Buổi học', 'Lesson')} • {s.messageCount} {localText('lượt', 'turns')}
                                      </>
                                    ) : (
                                      <>
                                        {s.isPresetReplaySession ? localText('Bài có sẵn', 'Saved lesson') : localText('Live AI', 'Live AI')}
                                        {' • '}
                                        {s.teacherLabel || localText('Buổi học', 'Lesson')} • {s.messageCount} {localText('lượt', 'turns')}
                                      </>
                                    )}
                                    {s.learningMode === 'reflex'
                                      ? ` • ${localText('Phản xạ', 'Reflex')}`
                                      : s.learningMode === 'review'
                                        ? ` • ${localText('Ôn tập', 'Review')}`
                                        : ''}
                                  </span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void deleteSession(s.sessionId)
                                  }}
                                  disabled={historyBusy}
                                  title={localText('Xóa buổi học', 'Delete lesson')}
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {localText('Chưa có hội thoại. Bấm "Bắt đầu buổi học" để bắt đầu.', 'No conversation yet. Click "Start lesson" to begin.')}
                    </p>
                  </div>
                ) : (
                  <>
                  {messages.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`min-w-0 break-words rounded-md px-3 py-2 text-sm ${
                        m.role === 'teacher' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border'
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.role === 'teacher' ? teacherRoleLabel : localText('Học sinh', 'Student')}
                      </p>
                      {m.role === 'teacher' ? (
                        <div className="space-y-2">
                          {(() => {
                            if (learningMode === 'reflex') return <p className="whitespace-pre-wrap break-words">{m.text}</p>
                            const correctionNote = String(correctionNoteByMessageId[m.id] || '').trim()
                            const correctedSentence = String(mainSentenceByMessageId[m.id] || '').trim()
                            const intentAnswer = String(intentAnswerByMessageId[m.id] || '').trim()
                            const correctionItems = correctionsByMessageId[m.id] || []
                            const hasStructured = Boolean(correctionNote || correctedSentence || intentAnswer || correctionItems.length > 0)
                            if (!hasStructured) return <p className="break-words">{m.text}</p>
                            const skipPinyin2 = correctedSentence && hasEmbeddedPinyin(correctedSentence)
                            const skipPinyin3 = intentAnswer && hasEmbeddedPinyin(intentAnswer)
                            if (supportsLatinTransliteration && correctedSentence && !skipPinyin2) void ensureWritingRomanization(correctedSentence)
                            if (supportsLatinTransliteration && intentAnswer && !skipPinyin3) void ensureWritingRomanization(intentAnswer)
                            const pinyin2 = !skipPinyin2 && correctedSentence ? sanitizeRomanizedText(String(writingRomanizationByKey[toWritingRomanizationKey(correctedSentence)] || '').trim()) : ''
                            const pinyin3 = !skipPinyin3 && intentAnswer ? sanitizeRomanizedText(String(writingRomanizationByKey[toWritingRomanizationKey(intentAnswer)] || '').trim()) : ''
                            const busy2 = !skipPinyin2 && correctedSentence ? Boolean(writingRomanizationBusyByKey[toWritingRomanizationKey(correctedSentence)]) : false
                            const busy3 = !skipPinyin3 && intentAnswer ? Boolean(writingRomanizationBusyByKey[toWritingRomanizationKey(intentAnswer)]) : false
                            return (
                              <div className="space-y-1 break-words text-xs">
                                <p>
                                  <span className="font-semibold text-rose-700">{localText('Ý 1 - Sửa lỗi:', 'Idea 1 - Error fix:')}</span>{' '}
                                  {correctionNote || localText('Không có lỗi lớn cần sửa.', 'No major correction needed.')}
                                </p>
                                {correctionItems.length > 0 ? (
                                  <div className="ml-1 rounded-md border border-rose-100 bg-rose-50/40 p-2 text-[11px]">
                                    <p className="font-semibold text-rose-800">{localText('Lỗi cần sửa', 'Corrections needed')}</p>
                                    <div className="mt-1 space-y-1.5">
                                      {correctionItems.map((item, itemIdx) => (
                                        <div key={`${item.original}-${item.fixed}-${itemIdx}`} className="space-y-0.5 text-slate-700">
                                          <p><span className="font-semibold text-rose-700">{localText('Bạn nói:', 'You said:')}</span> {item.original || '-'}</p>
                                          <p><span className="font-semibold text-emerald-700">{localText('Nên nói:', 'Better:')}</span> {item.fixed || '-'}</p>
                                          {item.explanationVi ? (
                                            <p className="text-slate-500">{item.explanationVi}</p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                <div>
                                  <p>
                                    <span className="font-semibold text-emerald-700">{localText('Ý 2 - Câu sửa hoàn chỉnh:', 'Idea 2 - Corrected full sentence:')}</span>{' '}
                                    {correctedSentence || localText('Chưa có câu chuẩn.', 'No corrected sentence yet.')}
                                  </p>
                                  {(pinyin2 || busy2) ? (
                                    <p className="mt-0.5 text-slate-500">
                                      {localText('Phiên âm Latin:', 'Latin transliteration:')}{' '}
                                      {busy2 ? localText('đang tải...', 'loading...') : pinyin2}
                                    </p>
                                  ) : null}
                                </div>
                                <div>
                                  <p>
                                    <span className="font-semibold text-indigo-700">{localText('Ý 3 - Trả lời tự nhiên:', 'Idea 3 - Natural contextual reply:')}</span>{' '}
                                    {intentAnswer || localText('Chưa có phần trả lời ngữ cảnh riêng.', 'No separate contextual reply yet.')}
                                  </p>
                                  {(pinyin3 || busy3) ? (
                                    <p className="mt-0.5 text-slate-500">
                                      {localText('Phiên âm Latin:', 'Latin transliteration:')}{' '}
                                      {busy3 ? localText('đang tải...', 'loading...') : pinyin3}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {correctedSentence ? (
                                    <div className="space-y-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="min-h-[44px] px-3 text-xs"
                                        onClick={() => void explainMainSentence(m.id)}
                                        disabled={Boolean(mainSentenceExplainBusyByMessageId[m.id])}
                                      >
                                        {mainSentenceExplainBusyByMessageId[m.id]
                                          ? localText('Đang dịch...', 'Translating...')
                                          : mainSentenceExplainByMessageId[m.id]
                                            ? localText('Ẩn dịch ý 2', 'Hide idea 2 translation')
                                            : localText('Dịch ý 2', 'Translate idea 2')}
                                      </Button>
                                      {mainSentenceExplainByMessageId[m.id] ? (
                                        <p className="text-slate-600">
                                          <span className="font-semibold">{localText('Dịch ý 2:', 'Idea 2 translation:')}</span>{' '}
                                          {mainSentenceExplainByMessageId[m.id]}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {intentAnswer ? (
                                    <div className="space-y-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="min-h-[44px] px-3 text-xs"
                                        onClick={() => void explainIntentAnswer(m.id)}
                                        disabled={Boolean(intentExplainBusyByMessageId[m.id])}
                                      >
                                        {intentExplainBusyByMessageId[m.id]
                                          ? localText('Đang dịch...', 'Translating...')
                                          : intentExplainByMessageId[m.id]
                                            ? localText('Ẩn dịch ý 3', 'Hide idea 3 translation')
                                            : localText('Dịch ý 3', 'Translate idea 3')}
                                      </Button>
                                      {intentExplainByMessageId[m.id] ? (
                                        <p className="text-slate-600">
                                          <span className="font-semibold">{localText('Dịch ý 3:', 'Idea 3 translation:')}</span>{' '}
                                          {intentExplainByMessageId[m.id]}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })()}
                          {learningMode !== 'reflex' ? (
                          <>
                          <div className="flex flex-wrap gap-1">
                            {(tokensByMessageId[m.id] || []).map((word, idx) => {
                              const key = `${m.id}:${word.toLowerCase()}`
                              const withUsage = tokensWithUsageByMessageId[m.id]
                              const usageFromTokenize = withUsage?.[idx]?.usageLevel ?? withUsage?.find((t) => t.word.toLowerCase() === word.toLowerCase())?.usageLevel
                              const insight = wordInsightByKey[key]
                              const saved = findSessionWord(word)
                              const usageLevel = usageFromTokenize ?? insight?.usageLevel ?? saved?.usageLevel
                              const tokenBadgeClass =
                                usageLevel === 'high'
                                  ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  : usageLevel === 'low'
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : usageLevel === 'medium'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'border-slate-200 hover:bg-slate-50'
                              const sentenceForWordContext =
                                [String(mainSentenceByMessageId[m.id] || '').trim(), String(intentAnswerByMessageId[m.id] || '').trim()]
                                  .filter(Boolean)
                                  .join('\n') || m.text
                              return (
                                <Button
                                  key={`${m.id}-word-${idx}`}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={`min-h-[44px] rounded-md border px-3 text-xs font-medium transition-colors ${tokenBadgeClass}`}
                                  onClick={() => void fetchWordInsight(m.id, word, sentenceForWordContext)}
                                >
                                  {capitalizeWordForDisplay(word)}
                                  {usageLevel ? (
                                    <span
                                      className={`ml-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                                        usageLevel === 'high'
                                          ? 'bg-blue-500'
                                          : usageLevel === 'low'
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                      }`}
                                      title={
                                        usageLevel === 'high'
                                          ? localText('Dùng nhiều', 'High use')
                                          : usageLevel === 'low'
                                            ? localText('Ít dùng', 'Low use')
                                            : localText('Dùng trung bình', 'Medium use')
                                      }
                                    />
                                  ) : null}
                                  {openedWordKey === key ? ' •' : ''}
                                </Button>
                              )
                            })}
                          </div>
                          {tokenizingByMessageId[m.id] ? (
                            <p className="text-xs text-muted-foreground">{localText('AI đang tách từ theo ngôn ngữ...', 'AI is tokenizing words by language...')}</p>
                          ) : (tokensByMessageId[m.id] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">{localText('Không có token phù hợp để bấm trong câu này.', 'No tappable tokens found in this sentence.')}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {localText('Màu hiển thị ngay sau khi tách từ. Xanh dương = dùng nhiều, xanh lá = trung bình, vàng = ít dùng. Bấm từ để xem nghĩa chi tiết.', 'Colors show right after tokenization. Blue = high use, green = medium, yellow = low. Tap for full meaning.')}
                            </p>
                          )}
                          {openedWordKey.startsWith(`${m.id}:`) ? (
                            <div className="rounded-xl border border-border/70 bg-white p-2 text-xs">
                              {wordInsightByKey[openedWordKey] ? (
                                <div className="space-y-1">
                                  {((wordInsightByKey[openedWordKey].senses ?? []).length === 0) ? (
                                    <p>
                                      <span className="font-semibold text-slate-800">
                                        {capitalizeWordForDisplay(openedWordKey.split(':').slice(1).join(':')) || localText('Từ này', 'This word')} {localText('nghĩa là:', 'means:')}
                                      </span>{' '}
                                      {wordInsightByKey[openedWordKey].meaning}
                                    </p>
                                  ) : (
                                    <p className="font-semibold text-slate-800">
                                      {capitalizeWordForDisplay(openedWordKey.split(':').slice(1).join(':')) || localText('Từ này', 'This word')}
                                    </p>
                                  )}
                                  <p><span className="font-semibold text-slate-800">{localText('Phát âm:', 'Pronunciation:')}</span> {wordInsightByKey[openedWordKey].pronunciation}</p>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span
                                      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                        wordInsightByKey[openedWordKey].usageLevel === 'high'
                                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                                          : wordInsightByKey[openedWordKey].usageLevel === 'low'
                                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                                            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                      }`}
                                    >
                                      {wordInsightByKey[openedWordKey].usageLevel === 'high'
                                        ? localText('Dùng nhiều', 'High use')
                                        : wordInsightByKey[openedWordKey].usageLevel === 'low'
                                          ? localText('Ít dùng', 'Low use')
                                          : localText('Dùng trung bình', 'Medium use')}
                                    </span>
                                    <span className="inline-flex rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      {localText('Ưu tiên:', 'Priority:')} {wordInsightByKey[openedWordKey].importanceScore}
                                    </span>
                                    {wordInsightByKey[openedWordKey].contextSensitive ? (
                                      <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                        {localText('Phụ thuộc ngữ cảnh', 'Context-sensitive')}
                                      </span>
                                    ) : null}
                                  </div>
                                  {(() => {
                                    const insight = wordInsightByKey[openedWordKey]
                                    const senses =
                                      (insight.senses ?? []).length > 0
                                        ? insight.senses
                                        : (((insight.exampleItems ?? []).length > 0
                                            ? insight.exampleItems
                                            : insight.exampleTarget && insight.exampleNative
                                              ? [{ targetText: insight.exampleTarget, nativeText: insight.exampleNative, targetPinyin: undefined }]
                                              : []
                                          ).map((ex) => ({
                                            gloss: '',
                                            exampleTarget: String(ex.targetText || '').trim(),
                                            exampleNative: String(ex.nativeText || '').trim(),
                                          })))
                                    if (senses.length === 0) return null
                                    return (
                                      <div className="space-y-1.5">
                                        {senses.map((sense, idx) => {
                                          const gloss = String(sense.gloss || '').trim()
                                          const exampleText = String(sense.exampleTarget || '').trim()
                                          const exampleNative = String(sense.exampleNative || '').trim()
                                          const storedPinyin = sanitizeRomanizedText(String((sense as { targetPinyin?: string }).targetPinyin || '').trim())
                                          const fallbackKey = toWritingRomanizationKey(exampleText)
                                          const fallbackPinyin = sanitizeRomanizedText(String(writingRomanizationByKey[fallbackKey] || '').trim())
                                          const busyPinyin = Boolean(writingRomanizationBusyByKey[fallbackKey])
                                          const pinyin = storedPinyin || fallbackPinyin
                                          return (
                                            <div key={`sense-${idx}`} className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5">
                                              <p className="font-semibold text-slate-800">
                                                {localText(`Nghĩa ${idx + 1}`, `Sense ${idx + 1}`)}
                                              </p>
                                              {gloss ? (
                                                <p className="mt-0.5">
                                                  <span className="font-semibold text-slate-700">{localText('Giải nghĩa:', 'Gloss:')}</span> {gloss}
                                                </p>
                                              ) : null}
                                              {exampleText ? (
                                                <p className="mt-0.5">
                                                  <span className="font-semibold text-slate-700">{localText('Ví dụ:', 'Example:')}</span> {exampleText}
                                                </p>
                                              ) : null}
                                              {supportsLatinTransliteration && exampleText && (pinyin || busyPinyin) ? (
                                                pinyin ? (
                                                  <p className="text-muted-foreground">
                                                    <span className="font-semibold text-slate-800">{localText('Pinyin:', 'Pinyin:')}</span> {pinyin}
                                                  </p>
                                                ) : (
                                                  <p className="text-muted-foreground">
                                                    <span className="font-semibold text-slate-800">{localText('Pinyin:', 'Pinyin:')}</span> {localText('Đang tạo...', 'Generating...')}
                                                  </p>
                                                )
                                              ) : null}
                                              {exampleNative ? (
                                                <p className="mt-0.5 text-muted-foreground">
                                                  <span className="font-semibold text-slate-800">{localText('Dịch:', 'Translation:')}</span> {exampleNative}
                                                </p>
                                              ) : null}
                                              <div className="mt-1 flex flex-wrap gap-1.5">
                                                {gloss ? (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-[11px]"
                                                    onClick={() => void playWordSenseGloss(openedWordKey.split(':').slice(1).join(':'), gloss)}
                                                  >
                                                    <Volume2 className="mr-1 h-3.5 w-3.5" />
                                                    {localText('Nghe nghĩa này', 'Play this meaning')}
                                                  </Button>
                                                ) : null}
                                                {exampleText ? (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-[11px]"
                                                    onClick={() => void playWordSenseExampleTarget(exampleText)}
                                                  >
                                                    <Volume2 className="mr-1 h-3.5 w-3.5" />
                                                    {localText('Nghe ví dụ', 'Play example')}
                                                  </Button>
                                                ) : null}
                                              </div>
                                            </div>
                                          )
                                        })}
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => void playWordSenseAll(openedWordKey.split(':').slice(1).join(':'), senses)}
                                        >
                                          <Volume2 className="mr-2 h-4 w-4" />
                                          {localText('Nghe toàn bộ giải nghĩa', 'Play full meaning')}
                                        </Button>
                                      </div>
                                    )
                                  })()}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const targetWord = openedWordKey.split(':').slice(1).join(':')
                                      startWordPractice(targetWord, wordInsightByKey[openedWordKey].meaning, { forceSwitch: true })
                                      void playWordPronunciation(targetWord)
                                    }}
                                  >
                                    <Volume2 className="mr-2 h-4 w-4" />
                                    {localText('Phát âm từ này', 'Play word pronunciation')}
                                  </Button>
                                </div>
                              ) : wordBusyKey === openedWordKey ? (
                                <p className="text-muted-foreground">{localText('Đang phân tích từ...', 'Analyzing word...')}</p>
                              ) : (
                                <p className="text-muted-foreground">{localText('Bấm từ khác để xem nghĩa.', 'Tap another word to view meaning.')}</p>
                              )}
                            </div>
                          ) : null}
                          </>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p>{m.text}</p>
                          {studentAudioByMessageId[m.id] ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void replayStudentMessageAudio(m.id)}
                            >
                              <Volume2 className="mr-2 h-4 w-4" />
                              {localText('Nghe lại câu học viên', 'Play student audio')}
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {m.role === 'teacher' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {learningMode === 'reflex' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void replayTeacherMessage(m.id, m.text)}
                              disabled={isReplayButtonDisabled(`${m.id}__full`, hasCachedTeacherAudio(m.id))}
                            >
                              <Volume2 className="mr-2 h-4 w-4" />
                              {localText('Nghe lại', 'Play again')}
                            </Button>
                          ) : idx === 0 ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void replayTeacherMessage(m.id, m.text)}
                                disabled={isReplayButtonDisabled(`${m.id}__full`, hasCachedTeacherAudio(m.id))}
                              >
                                <Volume2 className="mr-2 h-4 w-4" />
                                {localText('Nghe câu mở đầu', 'Play opening sentence')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void translateOpeningMessage(m.id, m.text)}
                                disabled={Boolean(openingTranslateBusyByMessageId[m.id])}
                              >
                                {openingTranslateBusyByMessageId[m.id]
                                  ? localText('Đang dịch...', 'Translating...')
                                  : openingTranslateByMessageId[m.id]
                                    ? localText('Ẩn dịch câu đầu bài', 'Hide opening translation')
                                    : localText('Dịch câu đầu bài', 'Translate opening line')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void replayTeacherCorrectionNote(m.id)}
                                disabled={isReplayButtonDisabled(`${m.id}__correction_note`, hasCachedTeacherAudio(`${m.id}__correction_note`))}
                              >
                                <Volume2 className="mr-2 h-4 w-4" />
                                {localText('Nghe ý 1', 'Play idea 1')}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void replayTeacherMainSentence(m.id, m.text)}
                                disabled={isReplayButtonDisabled(`${m.id}__main`, hasCachedTeacherAudio(`${m.id}__main`))}
                              >
                                <Volume2 className="mr-2 h-4 w-4" />
                                {localText('Nghe ý 2', 'Play idea 2')}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void replayTeacherIntentAnswer(m.id)}
                                disabled={isReplayButtonDisabled(`${m.id}__intent_answer`, hasCachedTeacherAudio(`${m.id}__intent_answer`))}
                              >
                                <Volume2 className="mr-2 h-4 w-4" />
                                {localText('Nghe ý 3', 'Play idea 3')}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void replayTeacherMessage(m.id, m.text)}
                                disabled={isReplayButtonDisabled(`${m.id}__full`, hasCachedTeacherAudio(m.id))}
                              >
                                <Volume2 className="mr-2 h-4 w-4" />
                                {localText('Nghe ý 1,2,3', 'Play ideas 1, 2, 3')}
                              </Button>
                            </>
                          )}
                        </div>
                      ) : String(studentAudioByMessageId[m.id] || '').trim() ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void replayStudentMessage(m.id)}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe lại học viên', 'Play student recording')}
                          </Button>
                        </div>
                      ) : null}
                      {m.role === 'teacher' && learningMode !== 'reflex' && openingTranslateByMessageId[m.id] ? (
                        <p className="mt-2 text-xs text-slate-600">
                          <span className="font-semibold">{localText('Dịch ngữ cảnh:', 'Context translation:')}</span>{' '}
                          {openingTranslateByMessageId[m.id]}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {busy && (messages.length === 0 || messages[messages.length - 1]?.role !== 'teacher') ? (
                      <div className="min-w-0 rounded-md border border-indigo-200 bg-indigo-50/80 px-3 py-3 text-sm animate-pulse">
                      <p className="mb-1.5 break-words text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        {localText('Teacher', 'Teacher')}
                      </p>
                      <div className="flex min-w-0 items-center gap-2 text-indigo-700">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        <p className="min-w-0 break-words text-xs">
                          {localText(
                            'Thầy/cô đang suy nghĩ và chuẩn bị giảng giải cho bạn...',
                            'Teacher is thinking and preparing an explanation for you...'
                          )}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  </>
                )}
              </div>
              </div>

              <div ref={speakActionsRef} className="min-w-0 space-y-2">
                {learningMode === 'review' &&
                !isPresetPageSession &&
                reviewDrillStage !== 'writing' &&
                reviewDrillStage !== 'speaking' &&
                reviewDrillStage !== 'listening' &&
                (reviewDrillStage !== 'idle' || (writingTask && !writingTask.completed)) ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold">
                      {localText('Nhóm mini ôn tập (làm lần lượt):', 'Mini review pack (complete in order):')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2.5 sm:gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          writingTask?.completed
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : reviewDrillStage === 'writing'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {localText('1) Viết', '1) Writing')} -{' '}
                        {writingTask?.completed
                          ? localText('xong', 'done')
                          : reviewDrillStage === 'writing'
                            ? localText('đang làm', 'in progress')
                            : localText('chờ', 'pending')}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          reviewMiniPackCompleted || reviewDrillStage === 'listening'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : reviewDrillStage === 'speaking'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {localText('2) Nói', '2) Speaking')} -{' '}
                        {reviewMiniPackCompleted || reviewDrillStage === 'listening'
                          ? localText('xong', 'done')
                          : reviewDrillStage === 'speaking'
                            ? localText('đang làm', 'in progress')
                            : localText('chờ', 'pending')}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          reviewMiniPackCompleted
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : reviewDrillStage === 'listening'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {localText('3) Nghe', '3) Listening')} -{' '}
                        {reviewMiniPackCompleted
                          ? localText('xong', 'done')
                          : reviewDrillStage === 'listening'
                            ? localText('đang làm', 'in progress')
                            : localText('chờ', 'pending')}
                      </span>
                    </div>
                  </div>
                ) : null}
                {isMiniDrillBlocking &&
                reviewDrillStage !== 'writing' &&
                reviewDrillStage !== 'speaking' &&
                reviewDrillStage !== 'listening' ? (
                  <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                    {reviewDrillStage === 'writing'
                      ? localText('Mini 1/3: Viết lại câu mục tiêu', 'Mini 1/3: Rewrite the target sentence')
                      : reviewDrillStage === 'speaking'
                        ? localText('Mini 2/3: Nói lại câu sửa để luyện phát âm', 'Mini 2/3: Repeat the corrected sentence')
                        : localText('Mini 3/3: Chọn từ bạn nghe thấy', 'Mini 3/3: Pick words you heard')}
                  </div>
                ) : null}
                {!isMiniDrillBlocking && isPresetPageSession && latestMainSentenceForLearner ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
                    <p className="font-semibold">{localText('Câu nói chính để bạn đọc mic', 'Main sentence for microphone practice')}</p>
                    <p className="mt-1 break-words text-sm font-medium text-emerald-900">
                      {latestMainSentenceForLearner.sentence}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      {localText(
                        'Bấm "Nói" để đọc theo câu này, sau đó bấm "Gửi".',
                        'Tap "Speak" to read this sentence, then tap "Send".'
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void replayTeacherMainSentence(latestMainSentenceForLearner.messageId, latestMainSentenceForLearner.teacherText)}
                        disabled={isReplayButtonDisabled(`${latestMainSentenceForLearner.messageId}__main`, hasCachedTeacherAudio(`${latestMainSentenceForLearner.messageId}__main`))}
                      >
                        <Volume2 className="mr-2 h-4 w-4" />
                        {localText('Nghe đọc chuẩn', 'Play standard reading')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft(latestMainSentenceForLearner.sentence)}
                        disabled={busy || recordingPending}
                      >
                        {localText('Dùng câu này', 'Use this sentence')}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {!isMiniDrillBlocking && isPresetPageSession && !latestMainSentenceForLearner ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
                    <p className="font-semibold">{localText('Đã hoàn thành câu đọc chính', 'Main reading lines completed')}</p>
                    <p className="mt-1">
                      {localText('Bạn đã đọc hết các câu của bài học có sẵn này.', 'You finished all reading lines of this saved lesson.')}
                    </p>
                  </div>
                ) : null}
                <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-border/70 bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/85">
                  <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                    <Input
                      value={draft}
                      onFocus={(e) => {
                        if (!isMiniDrillBlocking) return
                        e.currentTarget.blur()
                        redirectToMiniDrill()
                      }}
                      onChange={(e) => {
                        if (isMiniDrillBlocking) {
                          redirectToMiniDrill()
                          return
                        }
                        setDraft(e.target.value)
                      }}
                      placeholder={coachUiText.inputPlaceholder}
                      disabled={busy || reviewListeningPopupOpen || isMiniDrillBlocking || liveSessionTurnLimitReached}
                      className="min-w-0 sm:flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (isMiniDrillBlocking) {
                          redirectToMiniDrill()
                          return
                        }
                        void handleSend()
                      }}
                      disabled={busy || reviewListeningPopupOpen || isMiniDrillBlocking || liveSessionTurnLimitReached || !draft.trim()}
                      className="min-h-[46px] rounded-xl px-3.5 text-sm font-semibold"
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      {localText('Gửi', 'Send')}
                    </Button>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2">
                  {recordingPending ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handlePlaybackRecording}
                        disabled={busy}
                        className="min-h-[46px] px-3.5 text-sm font-semibold"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {localText('Nghe lại', 'Play back')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRecordAgain}
                        disabled={busy}
                        className="min-h-[46px] px-3.5 text-sm font-semibold"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {localText('Nói lại', 'Record again')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (isMiniDrillBlocking) {
                            redirectToMiniDrill()
                            return
                          }
                          void sendPendingRecording()
                        }}
                        disabled={busy || awaitingTeacherReply || liveSessionTurnLimitReached}
                        className="min-h-[46px] px-3.5 text-sm font-semibold"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {localText('Gửi', 'Send')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant={listening ? 'destructive' : 'outline'}
                        onClick={handleMic}
                        disabled={busy || awaitingTeacherReply || isMiniDrillBlocking || liveSessionTurnLimitReached}
                        className="min-h-[46px] px-3.5 text-sm font-semibold"
                      >
                        {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                        {listening ? localText('Dừng mic', 'Stop mic') : localText('Nói', 'Speak')}
                      </Button>
                      <div
                        className="ml-auto flex shrink-0 flex-col items-center gap-0.5"
                        title={localText('Tốc độ giọng nói', 'Voice playback speed')}
                      >
                        <span className="text-[10px] text-slate-500">
                          {localText('Tốc độ giọng nói', 'Voice speed')}
                        </span>
                        <div className="flex items-center rounded-md border border-slate-200 bg-slate-50">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 min-w-8 p-0 shrink-0"
                            disabled={playbackSpeed <= 0.75}
                            onClick={() => {
                              const speeds = [0.75, 1, 1.25, 1.5]
                              const i = speeds.indexOf(playbackSpeed)
                              if (i <= 0) return
                              const next = speeds[i - 1]
                              playbackSpeedRef.current = next
                              setPlaybackSpeed(next)
                              if (audioRef.current && !audioRef.current.paused) {
                                audioRef.current.playbackRate = next
                              }
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="min-w-[2.25rem] text-center text-xs font-medium text-slate-600">
                            {playbackSpeed}x
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 min-w-8 p-0 shrink-0"
                            disabled={playbackSpeed >= 1.5}
                            onClick={() => {
                              const speeds = [0.75, 1, 1.25, 1.5]
                              const i = speeds.indexOf(playbackSpeed)
                              if (i >= speeds.length - 1) return
                              const next = speeds[i + 1]
                              playbackSpeedRef.current = next
                              setPlaybackSpeed(next)
                              if (audioRef.current && !audioRef.current.paused) {
                                audioRef.current.playbackRate = next
                              }
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                </div>
                {!isPresetPageSession ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                    <p>
                      {localText('Lượt hỏi buổi live:', 'Live lesson turns:')}{' '}
                      <span className="font-semibold">{liveSessionStudentTurnCount}/{liveSessionTurnLimit}</span>
                      {' • '}
                      {localText('Giá buổi 10 lượt:', 'Price per 10-turn lesson:')}{' '}
                      <span className="font-semibold">{LIVE_SESSION_PRICE_CREDITS} credit</span>
                      {localText(', đã thanh toán.', ', paid.')}
                    </p>
                    {liveSessionTurnLimitReached ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-rose-700">
                          {localText(
                            'Đã hết lượt hỏi của gói hiện tại.',
                            'You reached the turn limit for the current pack.'
                          )}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (liveUnlockBusy) return
                            const sid = String(sessionId || '').trim()
                            if (!sid) return
                            setLiveUnlockBusy(true)
                            void chargeEnglishCoachCredits({
                              action: 'charge_live_unlock',
                              sessionId: sid,
                            }).then(({ ok, data }) => {
                              if (!ok) {
                                toast({
                                  title: localText('Không mở thêm được lượt', 'Unable to unlock extra turns'),
                                  description: String(data.error || localText('Không thể trừ credit để mở thêm lượt.', 'Unable to charge credits for extra turns.')),
                                  variant: 'destructive',
                                })
                                return
                              }
                              notifyCreditsUpdated()
                              const unlockCount = Math.max(0, Math.floor(Number(data.liveUnlockCount || 0) || 0))
                              setLiveSessionExtraTurnUnlocks(unlockCount)
                              const newBalance = Number(data.newBalance || 0)
                              toast({
                                title: localText('Đã mở thêm lượt hỏi', 'Extra turns unlocked'),
                                description: localText(
                                  `Đã trừ ${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit, mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt. Số dư còn lại: ${newBalance.toFixed(2)}.`,
                                  `${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credits deducted and ${LIVE_SESSION_EXTRA_TURN_STEP} extra turns unlocked. Remaining balance: ${newBalance.toFixed(2)}.`
                                ),
                              })
                            }).finally(() => {
                              setLiveUnlockBusy(false)
                            })
                          }}
                          disabled={liveUnlockBusy}
                          className="h-8"
                        >
                          {localText(
                            `Mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit)`,
                            `Unlock ${LIVE_SESSION_EXTRA_TURN_STEP} turns (${LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credits)`
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    {localText(
                      `Bài học có sẵn: ${PRESET_SESSION_PRICE_CREDITS} credit/buổi (không mở thêm lượt, học hết buổi hiện tại).`,
                      `Saved lesson: ${PRESET_SESSION_PRICE_CREDITS} credit per lesson (no extra turn unlock, finish current lesson).`
                    )}
                  </div>
                )}
                {isMiniDrillBlocking || (busy && (messages.length === 0 || messages[messages.length - 1]?.role !== 'teacher')) || recordingPending ? (
                  <p className="text-xs text-slate-500">
                    {isMiniDrillBlocking
                      ? localText(
                          'Hãy hoàn thành đủ 3 bài ôn tập mini (viết, nói, nghe) trước khi tiếp tục nói hoặc gửi.',
                          'Complete all 3 mini review drills (write, speak, listen) before continuing to speak or send.'
                        )
                      : busy && (messages.length === 0 || messages[messages.length - 1]?.role !== 'teacher')
                        ? localText('Thầy/cô đang suy nghĩ và chuẩn bị giảng giải cho bạn...', 'Teacher is thinking and preparing an explanation for you...')
                        : localText('Đã ghi âm xong. Nghe lại, gửi hoặc nói lại.', 'Recording done. Play back, send, or record again.')}
                  </p>
                ) : null}
              </div>
              {learningMode === 'review' && reviewDrillStage === 'writing' && writingTask && !writingTask.completed ? (
                <div
                  ref={writingTaskRef}
                  className={`min-w-0 rounded-md border p-2.5 ${
                    !writingTask.completed
                      ? 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-200'
                      : 'bg-slate-50/70'
                  }`}
                >
                  {!isPresetPageSession ? (
                    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-semibold">
                        {localText('Nhóm mini ôn tập (làm lần lượt):', 'Mini review pack (complete in order):')}
                      </p>
                      <div className="flex flex-wrap gap-2.5 sm:gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            writingTask?.completed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'writing'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('1) Viết', '1) Writing')} -{' '}
                          {writingTask?.completed
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'writing'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted || reviewDrillStage === 'listening'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'speaking'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('2) Nói', '2) Speaking')} -{' '}
                          {reviewMiniPackCompleted || reviewDrillStage === 'listening'
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'speaking'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'listening'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('3) Nghe', '3) Listening')} -{' '}
                          {reviewMiniPackCompleted
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'listening'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                      </div>
                      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                        {localText('Mini 1/3: Viết lại câu mục tiêu', 'Mini 1/3: Rewrite the target sentence')}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {writingInputStatus === 'incorrect' ? (
                      <p className="text-xs text-rose-700">
                        {localText(
                          'Bạn đang gõ sai so với câu tham chiếu. Hãy chỉnh lại ngay ở vị trí đang đỏ.',
                          'Your typing does not match the reference sentence. Please correct it now.'
                        )}
                      </p>
                    ) : writingInputStatus === 'partial' ? (
                      <p className="text-xs text-sky-700">
                        {localText('Đúng rồi, tiếp tục gõ cho đủ câu.', 'Correct so far, keep typing to complete the sentence.')}
                      </p>
                    ) : writingInputStatus === 'matched' ? (
                      <p className="text-xs text-emerald-700">
                        {localText('Đúng rồi, đang chuyển sang câu tiếp theo...', 'Correct, moving to the next sentence...')}
                      </p>
                    ) : null}
                    <div className="space-y-1 rounded-md border border-slate-200 bg-white p-2.5">
                      <p className="text-sm font-semibold text-slate-800">{localText('Bài viết mini bắt buộc', 'Required mini-writing task')}</p>
                      <p className="text-xs text-muted-foreground break-words">{writingTask.instruction}</p>
                      <p className="text-xs text-slate-600">
                        {localText(
                          `Tiến độ: câu ${Math.min(writingTask.currentIndex + 1, Math.max(1, writingTask.requiredSentences.length))}/${Math.max(1, writingTask.requiredSentences.length)}.`,
                          `Progress: sentence ${Math.min(writingTask.currentIndex + 1, Math.max(1, writingTask.requiredSentences.length))}/${Math.max(1, writingTask.requiredSentences.length)}.`
                        )}
                      </p>
                      {writingTask.requiredSentences.length > 0 ? (
                        <div className="text-xs text-slate-700">
                          <p className="font-semibold">{localText('Câu cần gõ y nguyên:', 'Sentences to copy exactly:')}</p>
                          <div className="mt-1 space-y-1">
                            {writingTask.requiredSentences.map((sentence, idx) => {
                              const key = toWritingRomanizationKey(sentence || '')
                              const romanized = sanitizeRomanizedText(String(writingRomanizationByKey[key] || ''))
                              const busyKey = writingRomanizationBusyByKey[key]
                              const isCurrent = idx === writingTask.currentIndex && !writingTask.completed
                              return (
                                <div
                                  key={`required-sentence-${idx}`}
                                  className={`rounded border px-2 py-1 ${
                                    isCurrent ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <p className="leading-6 break-words [overflow-wrap:anywhere]">
                                    <span className="font-semibold">{localText('Câu', 'Sentence')} {idx + 1}:</span>{' '}
                                    <span className={isCurrent ? 'font-medium text-emerald-900' : 'text-slate-800'}>
                                      {sentence}
                                    </span>
                                  </p>
                                  {supportsLatinTransliteration && (romanized || busyKey) ? (
                                    <p className="mt-0.5 text-muted-foreground">
                                      <span className="font-semibold">{localText('Phiên âm Latin:', 'Latin transliteration:')}</span>{' '}
                                      {romanized || localText('Đang tạo...', 'Generating...')}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-amber-200 bg-white p-2.5">
                      <p className="mb-2 text-xs font-semibold text-slate-700">
                        {localText('Nhập câu của bạn', 'Type your sentence')}
                      </p>
                      <div className="flex min-w-0 items-center gap-2">
                        <Input
                          ref={writingInputRef}
                          value={writingDraft}
                          onChange={(e) => {
                            setWritingDraft(e.target.value)
                            if (writingEvalResult && !writingTask?.completed) {
                              setWritingEvalResult(null)
                            }
                          }}
                          placeholder={localText('Viết câu của bạn tại đây...', 'Write your sentence here...')}
                          disabled={writingBusy}
                          className={`min-w-0 flex-1 ${
                            writingInputStatus === 'matched'
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                              : writingInputStatus === 'incorrect'
                                ? 'border-rose-400 bg-rose-50 text-rose-800'
                                : writingInputStatus === 'partial'
                                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                                  : ''
                          }`}
                        />
                        <Button type="button" size="sm" onClick={() => void evaluateWritingTask()} disabled={writingBusy || !writingDraft.trim()}>
                          {writingBusy ? localText('Đang gửi...', 'Sending...') : localText('Gửi', 'Send')}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2">
                      {!writingTask.completed ? (
                        <p className="text-xs text-amber-700">
                          {localText(
                            'Bạn cần hoàn thành đủ 3 bài mini (viết, nói, nghe) để mở khóa lượt nói/gửi tiếp theo.',
                            'Complete all 3 mini drills (write, speak, listen) to unlock the next speak/send turn.'
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700">{localText('Đã hoàn thành mini viết. Tiếp tục Mini 2/3 (luyện nói), rồi Mini 3/3 (luyện nghe).', 'Writing mini is completed. Continue Mini 2/3 (speaking), then Mini 3/3 (listening).')}</p>
                      )}
                    </div>
                    {writingEvalResult ? (
                      <div className="rounded-xl border border-border/70 bg-white p-2 text-xs">
                        <p>
                          <span className="font-semibold">{localText('Điểm:', 'Score:')}</span> {writingEvalResult.score}/100
                          {' • '}
                          <span className={writingEvalResult.passed ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                            {writingEvalResult.passed ? localText('Đạt', 'Passed') : localText('Chưa đạt', 'Not passed')}
                          </span>
                        </p>
                        <p className="mt-1"><span className="font-semibold">{localText('Gợi ý nhanh:', 'Quick hint:')}</span> {writingEvalResult.shortHint}</p>
                        <p className="mt-1 text-muted-foreground">{writingEvalResult.feedback}</p>
                        {writingEvalResult.correctedText ? (
                          <div className="mt-1">
                            <p><span className="font-semibold">{localText('Câu sửa gợi ý:', 'Suggested correction:')}</span> {writingEvalResult.correctedText}</p>
                            {supportsLatinTransliteration ? (
                              (() => {
                                const key = toWritingRomanizationKey(writingEvalResult.correctedText || '')
                                const romanized = sanitizeRomanizedText(String(writingRomanizationByKey[key] || ''))
                                const busyKey = writingRomanizationBusyByKey[key]
                                if (!romanized && !busyKey) return null
                                return (
                                  <p className="mt-0.5 text-muted-foreground">
                                    <span className="font-semibold">{localText('Phiên âm Latin:', 'Latin transliteration:')}</span>{' '}
                                    {romanized || localText('Đang tạo...', 'Generating...')}
                                  </p>
                                )
                              })()
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {learningMode === 'review' && reviewDrillStage === 'speaking' && (!isPresetPageSession || hasStudentTurnsInCurrentSession) ? (
                <div ref={miniSpeakingBlockRef} className="min-w-0 rounded-md border border-indigo-200 bg-indigo-50/60 p-2.5">
                  {!isPresetPageSession ? (
                    <div className="mb-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-semibold">
                        {localText('Nhóm mini ôn tập (làm lần lượt):', 'Mini review pack (complete in order):')}
                      </p>
                      <div className="flex flex-wrap gap-2.5 sm:gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            writingTask?.completed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'writing'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('1) Viết', '1) Writing')} -{' '}
                          {writingTask?.completed
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'writing'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted || reviewDrillStage === 'listening'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'speaking'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('2) Nói', '2) Speaking')} -{' '}
                          {reviewMiniPackCompleted || reviewDrillStage === 'listening'
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'speaking'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'listening'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('3) Nghe', '3) Listening')} -{' '}
                          {reviewMiniPackCompleted
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'listening'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                      </div>
                      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                        {localText('Mini 2/3: Nói lại câu sửa để luyện phát âm', 'Mini 2/3: Repeat the corrected sentence')}
                      </div>
                    </div>
                  ) : null}
                  <p className="text-sm font-semibold text-indigo-800">
                    {localText('Mini 2/3: Luyện phát âm', 'Mini 2/3: Pronunciation practice')}
                  </p>
                  {reviewSpeakingTargetSentence ? (
                    <p className="mt-2 rounded border border-indigo-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-800">
                      {reviewSpeakingTargetSentence}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-indigo-700">
                    {localText(
                      'Em hãy thực hiện nghe và nói câu trên 3 lần.',
                      'Listen and repeat the sentence above 3 times.'
                    )}
                  </p>
                  <p className="mt-1 text-xs font-medium text-indigo-600">
                    {localText('Tiến độ:', 'Progress:')} {speakingDrillCycleCount}/3
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {speakingDrillPhase === 'idle' ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => void startDrillListenAndRecord()}
                        disabled={!reviewSpeakingTargetSentence}
                        className="min-h-[36px]"
                      >
                        <Volume2 className="mr-2 h-4 w-4" />
                        {localText('Luyện phát âm câu mục tiêu', 'Practice target sentence pronunciation')}
                      </Button>
                    ) : speakingDrillPhase === 'playing' ? (
                      <p className="flex items-center gap-2 text-sm text-indigo-700">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                        {localText('Đang phát câu mục tiêu...', 'Playing target sentence...')}
                      </p>
                    ) : speakingDrillPhase === 'recording' ? (
                      <p className="flex items-center gap-2 text-sm text-indigo-700">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                        {localText('Đang ghi âm... (tự động dừng khi im lặng)', 'Recording... (auto-stops when silent)')}
                      </p>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={playSpeakingDrillBlob}
                          disabled={!speakingDrillBlob && !reviewSpeakingTargetSentence}
                          className="min-h-[36px]"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          {localText('Nghe lại', 'Play back')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void startDrillSpeakingRecording()}
                          className="min-h-[36px]"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {localText('Nói lại', 'Record again')}
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => void submitSpeakingDrillCycle()}
                          disabled={busy}
                          className="min-h-[36px]"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {localText('Gửi', 'Submit')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
              {learningMode === 'review' && reviewDrillStage === 'listening' && (!isPresetPageSession || hasStudentTurnsInCurrentSession) && reviewListeningVisibleOptions.length > 0 && !reviewListeningPopupOpen ? (
                <div ref={miniListeningBlockRef} className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5">
                  {!isPresetPageSession ? (
                    <div className="mb-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-semibold">
                        {localText('Nhóm mini ôn tập (làm lần lượt):', 'Mini review pack (complete in order):')}
                      </p>
                      <div className="flex flex-wrap gap-2.5 sm:gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            writingTask?.completed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'writing'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('1) Viết', '1) Writing')} -{' '}
                          {writingTask?.completed
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'writing'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted || reviewDrillStage === 'listening'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'speaking'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('2) Nói', '2) Speaking')} -{' '}
                          {reviewMiniPackCompleted || reviewDrillStage === 'listening'
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'speaking'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            reviewMiniPackCompleted
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : reviewDrillStage === 'listening'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {localText('3) Nghe', '3) Listening')} -{' '}
                          {reviewMiniPackCompleted
                            ? localText('xong', 'done')
                            : reviewDrillStage === 'listening'
                              ? localText('đang làm', 'in progress')
                              : localText('chờ', 'pending')}
                        </span>
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {localText('Mini 3/3: Chọn từ bạn nghe thấy', 'Mini 3/3: Pick words you heard')}
                      </div>
                    </div>
                  ) : null}
                  <p className="text-sm font-semibold text-emerald-800">
                    {localText('Mini 3/3: Chọn từ bạn nghe thấy', 'Mini 3/3: Pick words you heard')}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {localText(
                      'Nghe lại câu của giáo viên và chọn các từ bạn nghe thấy.',
                      'Listen to the teacher line again and pick words you heard.'
                    )}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {localText('Đúng:', 'Correct:')} {reviewListeningSelected.length}/{reviewListeningRequiredCount}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reviewListeningVisibleOptions.map((word) => {
                      const status = reviewListeningResultByWord[word]
                      const variant = status === 'correct' ? 'default' : status === 'wrong' ? 'destructive' : 'outline'
                      return (
                        <Button
                          key={word}
                          type="button"
                          variant={variant}
                          size="sm"
                          onClick={() => onReviewListeningWordTap(word)}
                          disabled={reviewListeningSubmitBusy || Boolean(status)}
                          className="h-auto min-h-[36px] whitespace-normal"
                        >
                          {displayListeningWord(word)}
                        </Button>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void replayCorrectionSentence(reviewListeningPrompt)}
                      disabled={reviewListeningSubmitBusy}
                      className="min-h-[36px]"
                    >
                      {localText('Nghe lại câu', 'Play line again')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="section-surface min-w-0 xl:sticky xl:top-[5.5rem] xl:h-fit">
            <CardHeader className="min-w-0">
              <CardTitle className="break-words">{coachUiText.fixTitle}</CardTitle>
              {!compactMode ? <CardDescription className="break-words">{coachUiText.fixDesc}</CardDescription> : null}
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              <div className="min-w-0 rounded-xl border border-border/70 p-3">
                <p className="break-words text-sm font-semibold text-slate-800">{localText('Lỗi cần sửa', 'Corrections needed')}</p>
                {corrections.length === 0 ? (
                  <p className="mt-1 break-words text-sm text-muted-foreground">{localText('Chưa có lỗi nào gần đây.', 'No recent errors.')}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {corrections.map((c, idx) => (
                      <div key={`${c.original}-${idx}`} className="min-w-0 rounded-xl border border-border/70 bg-slate-50/80 p-2.5 break-words text-xs">
                        <p><span className="font-semibold text-red-600">{localText('Bạn nói:', 'You said:')}</span> {c.original}</p>
                        <p><span className="font-semibold text-emerald-700">{localText('Nên nói:', 'Better:')}</span> {c.fixed}</p>
                        <p className="break-words text-muted-foreground">{c.explanationVi}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-border/70 p-3">
                <p className="break-words text-sm font-semibold text-slate-800">{localText('Điểm phát âm gần nhất', 'Latest pronunciation score')}</p>
                {latestPronunciationScore == null ? (
                  <p className="mt-1 break-words text-sm text-muted-foreground">{localText('Chưa có điểm phát âm từ mic.', 'No pronunciation score from mic yet.')}</p>
                ) : (
                  <div className="mt-2 space-y-1 break-words text-sm">
                    <p>
                      <span className="font-semibold text-indigo-700">{latestPronunciationScore}/100</span>
                      {' '}({latestPronunciationScore >= 85 ? localText('Tốt', 'Good') : latestPronunciationScore >= 70 ? localText('Khá', 'Fair') : localText('Cần cải thiện', 'Needs improvement')})
                    </p>
                    <p className="text-muted-foreground">
                      {localText('Độ chính xác:', 'Accuracy:')} {latestPronunciationBreakdown.accuracy == null ? 'N/A' : `${latestPronunciationBreakdown.accuracy}/100`}
                      {' • '}
                      {localText('Độ trôi chảy:', 'Fluency:')} {latestPronunciationBreakdown.fluency == null ? 'N/A' : `${latestPronunciationBreakdown.fluency}/100`}
                      {' • '}
                      {localText('Ngữ điệu:', 'Prosody:')} {latestPronunciationBreakdown.prosody == null ? 'N/A' : `${latestPronunciationBreakdown.prosody}/100`}
                    </p>
                    {latestWeakWords.length > 0 ? (
                      <p className="text-muted-foreground">
                        {localText('Từ/cụm cần luyện thêm:', 'Words/phrases to practice:')} {latestWeakWords.join(', ')}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">{localText('Không phát hiện từ yếu rõ ràng trong lượt gần nhất.', 'No clearly weak words detected in the latest turn.')}</p>
                    )}
                    {latestWordScores.length > 0 ? (
                      <p className="text-muted-foreground">
                        {localText('Chấm theo từ:', 'Word-level scores:')}{' '}
                        {latestWordScores.slice(0, 6).map((item) => `${item.word} ${item.score}`).join(' • ')}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-border/70 p-3">
                <p className="break-words text-sm font-semibold text-slate-800">{localText('Mẹo phát âm', 'Pronunciation tips')}</p>
                {pronunciationTips.length === 0 ? (
                  <p className="mt-1 break-words text-sm text-muted-foreground">{localText('Chưa có mẹo phát âm mới.', 'No new pronunciation tips yet.')}</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {pronunciationTips.map((tip, idx) => {
                      const tipWord = extractPronunciationWordFromTip(tip)
                      return (
                        <li key={`${tip}-${idx}`} className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-start gap-2">
                            <p className="min-w-0 flex-1 break-words">{tip}</p>
                            {tipWord ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => void playWordPronunciation(tipWord)}
                              >
                                <Volume2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {learningMode === 'review' ? (
                <>
                  <TodayWordsPanel
                    localText={localText}
                    todayWordsBusy={todayWordsBusy}
                    todayWords={todayWords}
                    writingRomanizationByKey={writingRomanizationByKey}
                    writingRomanizationBusyByKey={writingRomanizationBusyByKey}
                    toWritingRomanizationKey={toWritingRomanizationKey}
                    isCjkTargetLanguage={isCjkTargetLanguage}
                    onRefreshTodayWords={() => void fetchSessionWords()}
                    onStartWordPractice={startWordPractice}
                    onPlayWordTextSnippet={(text) => void playWordTextSnippet(text)}
                    onPlayWordPronunciation={(word) => void playWordPronunciation(word)}
                    onRegenerateWordPronunciation={(word) =>
                      void playWordPronunciation(word, {
                        forceRegenerate: true,
                        wordDetailForSave: findSessionWord(word),
                      })
                    }
                  />
                  <ReviewItemsPanel
                    localText={localText}
                    reviewBusy={reviewBusy}
                    reviewItems={reviewItems}
                    writingRomanizationByKey={writingRomanizationByKey}
                    writingRomanizationBusyByKey={writingRomanizationBusyByKey}
                    toWritingRomanizationKey={toWritingRomanizationKey}
                    isCjkTargetLanguage={isCjkTargetLanguage}
                    onRefreshReviewItems={() => void fetchReviewDue()}
                    onStartWordPractice={startWordPractice}
                    onPlayWordTextSnippet={(text) => void playWordTextSnippet(text)}
                    onPlayWordPronunciation={(word) => void playWordPronunciation(word)}
                    onRegenerateWordPronunciation={(word) =>
                      void playWordPronunciation(word, {
                        forceRegenerate: true,
                        wordDetailForSave: findSessionWord(word),
                      })
                    }
                    onMarkReviewDone={(id, quality) => void markReviewDone(id, quality)}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
        ) : (
          <Card className="section-surface min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="break-words">{coachUiText.chatTitle}</CardTitle>
              <CardDescription className="break-words">
                {localText(
                  'Phần hội thoại sẽ hiện sau khi bạn chọn lớp học: xác nhận chủ đề và tạo giáo trình.',
                  'The conversation area will appear after you select a class: confirm topic and generate curriculum.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {localText(
                  'Hoàn thành B1 và B2 ở phần thiết lập phía trên, sau đó bấm "Bắt đầu buổi học".',
                  'Complete S1 and S2 in setup above, then click "Start lesson".'
                )}
              </p>
            </CardContent>
          </Card>
        )}

        <HistoryPanel
          title={coachUiText.historyTitle}
          description={coachUiText.historyDesc}
          sessions={historySessions}
          openedHistorySessionId={openedHistorySessionId}
          historyBusy={historyBusy}
          localText={localText}
          onRefresh={() => void fetchHistorySessions()}
          onOpenSession={(sessionId, isPresetReplaySession) => openSessionByRoute(sessionId, isPresetReplaySession)}
          onDeleteSession={(sid) => void deleteSession(sid)}
        />
        <HistoryPanel
          title={localText('Danh sách bài học đã học', 'Learned lesson list')}
          description={localText(
            'Mở lại để ôn tập. Buổi live có thể mua thêm lượt để học tiếp; bài có sẵn chỉ mở lại để xem và ôn.',
            'Open again for review. Live lessons can buy extra turns to continue; saved lessons are review-only.'
          )}
          sessions={learnedHistorySessions}
          openedHistorySessionId={openedHistorySessionId}
          historyBusy={historyBusy}
          localText={localText}
          onRefresh={() => void fetchHistorySessions()}
          onOpenSession={(sessionId, isPresetReplaySession) => openSessionByRoute(sessionId, isPresetReplaySession)}
        />
      </div>
      <WordPracticeOverlay
        wordPractice={wordPractice}
        practiceInputStatus={practiceInputStatus}
        t={t}
        onWordPracticeDraftChange={onWordPracticeDraftChange}
        onWordPracticeMeaningSelect={onWordPracticeMeaningSelect}
        onPlayWordPronunciation={(word) => void playWordPronunciation(word)}
        onRegenerateWordPronunciation={(word) =>
          void playWordPronunciation(word, {
            forceRegenerate: true,
            wordDetailForSave: findSessionWord(word),
          })
        }
      />
      {showPreLessonReview ? (
        <PreLessonReviewOverlay
          words={preLessonRetryWords ?? preLessonWords}
          exerciseIndex={preLessonExerciseIndex}
          wordIndex={preLessonWordIndex}
          results={preLessonResults}
          input={preLessonInput}
          recallDirection={preLessonRecallDirection}
          passed={preLessonPassed}
          languageCode={languageCode}
          targetLangToLanguageCode={targetLangToLanguageCode}
          onInputChange={setPreLessonInput}
          onRecallDirectionChange={setPreLessonRecallDirection}
          onClozeSubmit={onPreLessonClozeSubmit}
          onListenSubmit={onPreLessonListenSubmit}
          onRecallSubmit={(word, correct) => {
            if (!correct) {
              const words = preLessonRetryWords ?? preLessonWords
              const item = words.find((w) => w.word === word)
              if (item?.targetLanguage) {
                void rescheduleReviewWords({ words: [{ word, targetLanguage: item.targetLanguage }] })
              }
            }
            const words = preLessonRetryWords ?? preLessonWords
            const isLast = preLessonWordIndex >= words.length - 1
            setPreLessonResults((prev) => {
              const newResults = {
                ...prev,
                [word]: { ...prev[word], cloze: prev[word]?.cloze ?? false, listen: prev[word]?.listen ?? false, recall: correct },
              }
              if (!isLast) return newResults
              const total = words.length * 3
              const correctCount = words.reduce((acc, w) => {
                const r = newResults[w.word] ?? { cloze: false, listen: false, recall: false }
                return acc + (r.cloze ? 1 : 0) + (r.listen ? 1 : 0) + (r.recall ? 1 : 0)
              }, 0)
              const pct = total > 0 ? (correctCount / total) * 100 : 0
              const failedWords = words.filter((w) => {
                const r = newResults[w.word] ?? { cloze: false, listen: false, recall: false }
                return !r.cloze || !r.listen || !r.recall
              })
              if (pct >= 80 && failedWords.length === 0) {
                setTimeout(() => setPreLessonPassed(true), 0)
              } else if (failedWords.length > 0) {
                setTimeout(() => {
                  setPreLessonRetryWords(failedWords)
                  setPreLessonExerciseIndex(0)
                  setPreLessonWordIndex(0)
                  setPreLessonResults({})
                  setPreLessonInput('')
                }, 0)
              }
              return newResults
            })
            setPreLessonInput('')
            if (isLast) {
              setPreLessonWordIndex(0)
            } else {
              setPreLessonWordIndex((i) => i + 1)
            }
          }}
          onContinueAfterPass={() => void startLiveAfterPreReview()}
          continueAfterPassBusy={preLessonContinueBusy}
          onPlayWord={(word, pronunciationAudioUrl, wordItem) =>
            void playWordPronunciation(word, {
              pronunciationAudioUrl,
              wordDetailForSave: wordItem
                ? {
                    meaning: wordItem.meaning,
                    pronunciation: wordItem.pronunciation,
                    exampleTarget: wordItem.exampleTarget,
                    exampleNative: wordItem.exampleNative,
                    meaningItems: [],
                    exampleItems: wordItem.exampleItems,
                    usageLevel: wordItem.usageLevel,
                    importanceScore: wordItem.importanceScore,
                    contextSensitive: wordItem.contextSensitive,
                    sessionId: wordItem.sessionId,
                  }
                : undefined,
            })
          }
          onRegenerateWordAudio={(word, wordItem) =>
            void playWordPronunciation(word, {
              forceRegenerate: true,
              wordDetailForSave: {
                meaning: wordItem.meaning,
                pronunciation: wordItem.pronunciation,
                exampleTarget: wordItem.exampleTarget,
                exampleNative: wordItem.exampleNative,
                meaningItems: [],
                exampleItems: wordItem.exampleItems,
                usageLevel: wordItem.usageLevel,
                importanceScore: wordItem.importanceScore,
                contextSensitive: wordItem.contextSensitive,
                sessionId: wordItem.sessionId,
              },
              onSaved: (w, url) => {
                const key = (x: TodayWordItem) => x.word.trim().toLowerCase() === w.trim().toLowerCase()
                setPreLessonWords((prev) => prev.map((x) => (key(x) ? { ...x, pronunciationAudioUrl: url } : x)))
                setPreLessonRetryWords((prev) =>
                  prev ? prev.map((x) => (key(x) ? { ...x, pronunciationAudioUrl: url } : x)) : null
                )
              },
            })
          }
          onClose={() => {
            clearPreLessonGate()
          }}
          localText={localText}
        />
      ) : null}
      <Button
        type="button"
        onClick={scrollToSpeakActions}
        className="fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] right-2 z-40 h-12 w-12 rounded-full p-0 shadow-lg sm:hidden"
        aria-label={localText('Đi tới nút nói', 'Go to speak button')}
        title={localText('Đi tới nút nói', 'Go to speak button')}
      >
        <Navigation className="h-5 w-5" />
      </Button>
      {matchedSessionChoiceOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {localText('Có buổi học đang lưu phù hợp', 'Matching in-progress lessons found')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {localText(
                'Chọn một buổi để tiếp tục, hoặc bấm học live mới để tạo giáo trình và mở đầu mới theo cài đặt hiện tại.',
                'Pick one lesson to continue, or start a new live lesson with fresh curriculum and opening from current settings.'
              )}
            </p>
            <div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-md border border-slate-200 p-2">
              {matchedHistorySessions.map((s) => (
                <div key={s.sessionId} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 p-2">
                  <div className="min-w-0 flex-1 text-sm text-slate-700">
                    <p className="break-words font-medium text-slate-900">
                      {s.topicLabel || localText('Buổi học', 'Lesson')}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      {s.isPresetReplaySession ? localText('Bài có sẵn', 'Saved lesson') : localText('Live AI', 'Live AI')} •{' '}
                      {(s.teacherLabel || localText('Giáo viên AI', 'AI teacher'))} • {s.messageCount} {localText('lượt', 'turns')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void openMatchedHistorySession(s.sessionId)}
                    disabled={matchedSessionChoiceBusy}
                    className="min-h-[40px]"
                  >
                    {localText('Tiếp tục', 'Continue')}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => void startLiveLessonFromChoice(matchedSessionPlan || undefined)}
                disabled={matchedSessionChoiceBusy}
                className="min-h-[44px]"
              >
                {localText('Học live mới với AI', 'Start new live lesson')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMatchedSessionChoiceOpen(false)
                  setMatchedSessionPlan(null)
                  setMatchedHistorySessions([])
                }}
                disabled={matchedSessionChoiceBusy}
                className="min-h-[44px]"
              >
                {localText('Đóng', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {lessonStartChoiceOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {localText('Chọn hình thức học', 'Choose lesson type')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {isSavedStandalonePage
                ? localText(
                    'Bạn đang ở trang bài học có sẵn. Có thể học live trực tiếp hoặc mở một bài có sẵn phù hợp cài đặt hiện tại.',
                    'You are on the saved lesson page. You can start a live lesson or open a saved lesson matching your setup.'
                  )
                : localText(
                    'Bạn muốn học live trực tiếp với AI hay học một bài có sẵn phù hợp đúng cài đặt hiện tại?',
                    'Do you want a live AI lesson or a saved lesson matching your current settings?'
                  )}
            </p>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 space-y-1">
              <p>
                {localText('Học live với AI:', 'Live AI lesson:')} <span className="font-semibold">{LIVE_SESSION_PRICE_CREDITS} credit</span>{' '}
                {localText(`/ ${LIVE_SESSION_BASE_TURN_LIMIT} lượt hỏi`, `/ ${LIVE_SESSION_BASE_TURN_LIMIT} turns`)}
              </p>
              <p>
                {localText('Mở thêm lượt live:', 'Unlock extra live turns:')} <span className="font-semibold">{LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS} credit</span>{' '}
                {localText(`/ ${LIVE_SESSION_EXTRA_TURN_STEP} lượt`, `/ ${LIVE_SESSION_EXTRA_TURN_STEP} turns`)}
              </p>
              <p>
                {localText('Học bài có sẵn:', 'Saved lesson:')} <span className="font-semibold">{PRESET_SESSION_PRICE_CREDITS} credit</span>{' '}
                {localText('/ buổi', '/ lesson')}
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => void startLiveLessonFromChoice()}
                disabled={lessonStartChoiceBusy}
                className="min-h-[44px]"
              >
                {localText('Học live trực tiếp', 'Start live lesson')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void startPresetLessonFromChoice()}
                disabled={lessonStartChoiceBusy || !lessonStartPresetAvailable}
                className="min-h-[44px]"
              >
                {!lessonStartPresetAvailable
                  ? localText('Chưa có bài có sẵn phù hợp', 'No matching saved lesson')
                  : lessonStartChoiceBusy
                    ? localText('Đang mở...', 'Loading...')
                    : localText('Học bài có sẵn', 'Study saved lesson')}
              </Button>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setLessonStartChoiceOpen(false)
                  setLessonStartPresetAvailable(true)
                  setLessonStartPlan(null)
                }}
                disabled={lessonStartChoiceBusy}
                className="min-h-[40px]"
              >
                {localText('Đóng', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {reviewListeningPopupOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 backdrop-blur-sm p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {localText('Luyện nghe nhanh', 'Quick listening drill')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {localText(
                'Nghe lại câu audio và chọn đúng 3 từ bạn nghe thấy.',
                'Replay the audio and pick exactly 3 words you heard.'
              )}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {localText('Đúng:', 'Correct:')} {reviewListeningSelected.length}/{reviewListeningRequiredCount}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewListeningVisibleOptions.map((word) => {
                const status = reviewListeningResultByWord[word]
                const variant = status === 'correct' ? 'default' : status === 'wrong' ? 'destructive' : 'outline'
                return (
                  <Button
                    key={word}
                    type="button"
                    variant={variant}
                    size="sm"
                    onClick={() => onReviewListeningWordTap(word)}
                    disabled={reviewListeningSubmitBusy || Boolean(status)}
                    className="h-auto min-h-[36px] whitespace-normal"
                  >
                    {displayListeningWord(word)}
                  </Button>
                )
              })}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void replayCorrectionSentence(reviewListeningPrompt)
                }}
                disabled={reviewListeningSubmitBusy}
                className="min-h-[44px]"
              >
                {localText('Nghe lại câu', 'Play line again')}
              </Button>
              <div
                className="inline-flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-2"
                title={localText('Tốc độ giọng nói', 'Voice playback speed')}
              >
                <span className="text-[11px] text-slate-500">
                  {localText('Tốc độ giọng nói', 'Voice speed')}
                </span>
                <div className="flex items-center rounded-md border border-slate-200 bg-white">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 min-w-8 p-0 shrink-0"
                    disabled={playbackSpeed <= 0.75}
                    onClick={() => {
                      const speeds = [0.75, 1, 1.25, 1.5]
                      const i = speeds.indexOf(playbackSpeed)
                      if (i <= 0) return
                      const next = speeds[i - 1]
                      playbackSpeedRef.current = next
                      setPlaybackSpeed(next)
                      if (audioRef.current && !audioRef.current.paused) {
                        audioRef.current.playbackRate = next
                      }
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[2.25rem] text-center text-xs font-medium text-slate-600">
                    {playbackSpeed}x
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 min-w-8 p-0 shrink-0"
                    disabled={playbackSpeed >= 1.5}
                    onClick={() => {
                      const speeds = [0.75, 1, 1.25, 1.5]
                      const i = speeds.indexOf(playbackSpeed)
                      if (i >= speeds.length - 1) return
                      const next = speeds[i + 1]
                      playbackSpeedRef.current = next
                      setPlaybackSpeed(next)
                      if (audioRef.current && !audioRef.current.paused) {
                        audioRef.current.playbackRate = next
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {learnerProfilePromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {localText('Thông tin cá nhân hóa học viên', 'Learner personalization info')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {localText(
                'Điền nhanh để hệ thống cá nhân hóa bài học có sẵn đúng theo tài khoản của bạn.',
                'Fill these fields to personalize saved lessons to your account.'
              )}
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">{localText('Tên hiển thị', 'Display name')}</p>
                <Input
                  value={learnerProfileNameDraft}
                  onChange={(e) => setLearnerProfileNameDraft(e.target.value)}
                  placeholder={localText('Ví dụ: Minh Anh', 'Example: Alex')}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">{localText('Nghề nghiệp (tuỳ chọn)', 'Job title (optional)')}</p>
                <Input
                  value={learnerProfileJobDraft}
                  onChange={(e) => setLearnerProfileJobDraft(e.target.value)}
                  placeholder={localText('Ví dụ: Kỹ sư phần mềm', 'Example: Software engineer')}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">{localText('Thành phố (tuỳ chọn)', 'City (optional)')}</p>
                <Input
                  value={learnerProfileCityDraft}
                  onChange={(e) => setLearnerProfileCityDraft(e.target.value)}
                  placeholder={localText('Ví dụ: Hà Nội', 'Example: Ho Chi Minh City')}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">{localText('Tuổi', 'Age')}</p>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={learnerProfileAgeDraft}
                  onChange={(e) => setLearnerProfileAgeDraft(e.target.value)}
                  placeholder={localText('Ví dụ: 25', 'Example: 25')}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">{localText('Giới tính', 'Gender')}</p>
                <select
                  value={learnerProfileGenderDraft}
                  onChange={(e) => setLearnerProfileGenderDraft(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{localText('Chọn giới tính', 'Select gender')}</option>
                  <option value="male">{localText('Nam', 'Male')}</option>
                  <option value="female">{localText('Nữ', 'Female')}</option>
                  <option value="other">{localText('Khác', 'Other')}</option>
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => void submitLearnerProfilePrompt()}
                disabled={learnerProfileBusy}
                className="min-h-[44px]"
              >
                {learnerProfileBusy ? localText('Đang lưu...', 'Saving...') : localText('Lưu thông tin', 'Save info')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={skipLearnerProfilePrompt}
                disabled={learnerProfileBusy}
                className="min-h-[44px]"
              >
                {localText('Để sau', 'Later')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <QuickStartModal
        open={quickStartModalOpen}
        quickStartBusy={quickStartBusy}
        quickStartStageLabel={quickStartStageLabel}
        localText={localText}
        learningLanguageLabel={coachUiText.learningLanguage}
        nativeLanguageLabel={coachUiText.nativeLanguage}
        nativeTeacherLabel={coachUiText.nativeTeacher}
        learnerLevelLabel={coachUiText.learnerLevel}
        customTopicPlaceholder={coachUiText.customTopicPlaceholder}
        languageCode={languageCode}
        languageOptions={languageOptions.map((x) => ({ value: x.code, label: x.label }))}
        onLanguageChange={(code) => {
          const nextCode = code as LanguageCode
          setLanguageCode(nextCode)
          const firstTeacher = TEACHERS_BY_LANGUAGE[nextCode]?.[0]
          if (firstTeacher) setTeacherId(firstTeacher.id)
        }}
        nativeLanguageCode={nativeLanguageCode}
        nativeLanguageOptions={nativeLanguageOptions.map((x) => ({ value: x.code, label: x.label }))}
        onNativeLanguageChange={(code) => setNativeLanguageCode(code as NativeLanguageCode)}
        selectedTeacherId={selectedTeacher.id}
        teacherOptions={teacherOptions.map((x) => ({ value: x.id, label: x.label }))}
        onTeacherChange={(id) => setTeacherId(id)}
        learnerLevel={learnerLevel}
        learnerLevelOptions={[
          { value: '0', label: levelLabelUi(0) },
          { value: '1', label: levelLabelUi(1) },
          { value: '2', label: levelLabelUi(2) },
          { value: '3', label: levelLabelUi(3) },
          { value: '4', label: levelLabelUi(4) },
        ]}
        onLearnerLevelChange={(value) => setLearnerLevel(value as LearnerLevel)}
        learningMode={learningMode}
        onLearningModeChange={setLearningMode}
        pendingTopicId={pendingTopicId}
        topicSourceMode={topicSourceMode}
        builtInTopicOptions={builtInTopicOptions}
        customTopicOptions={customTopicOptions}
        onPickBuiltInTopic={(topicId) => {
          setTopicSourceMode('builtin')
          setPendingTopicId(topicId)
        }}
        onPickCustomTopic={(topicId) => {
          setTopicSourceMode('custom')
          setPendingTopicId(topicId)
        }}
        customTopicDraft={customTopicDraft}
        customTopicBusy={customTopicBusy}
        onCustomTopicDraftChange={setCustomTopicDraft}
        onCreateCustomTopic={() => void normalizeAndSaveCustomTopic()}
        onClose={() => setQuickStartModalOpen(false)}
        onCreateLesson={() => void runQuickStartFlow()}
      />
    </>
  )
}

