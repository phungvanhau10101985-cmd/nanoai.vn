'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Mic, MicOff, Send, Languages, Volume2 } from 'lucide-react'

type Accent = 'uk' | 'us'
type Gender = 'female' | 'male'
type VoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Autonoe' | 'Enceladus' | 'Sadachbia' | 'Orus' | 'Fenrir' | 'Iapetus'
type Mode = 'chat' | 'story'
type SpeakingLanguageMode = 'auto' | 'target' | 'native' | 'mixed'
type LearnerLevel = 0 | 1 | 2
type LanguageCode = 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko' | 'vi'
type NativeLanguageCode = 'vi' | 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko'
const NATIVE_LANGUAGE_PREF_KEY = 'english-coach-native-language'

type ChatMessage = {
  id: string
  role: 'teacher' | 'student'
  text: string
}
type HistorySession = {
  sessionId: string
  languageCode: string
  teacherLabel: string
  mode: string
  lastMessageAt: string
  lastTeacherText: string
  messageCount: number
}
type WordInsight = {
  meaning: string
  pronunciation: string
  exampleTarget: string
  exampleNative: string
}
type TodayWordItem = {
  id: string
  sessionId?: string
  word: string
  meaning: string
  pronunciation: string
  pronunciationAudioUrl?: string
}

type MixedSpeechAnalysis = {
  targetTranscript: string
  nativeTranscript: string
  mergedTranscript: string
  inferredMeaning: string
  pronunciationIssues: string[]
  pronunciationScore: number
  weakWords: string[]
}

type TopicOption = {
  id: string
  label: string
}

type TopicDifficulty = 'basic' | 'intermediate' | 'advanced'
type TopicDifficultyTag = TopicDifficulty | 'adaptive'
type TopicFilterMode = 'fit' | 'all'

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

type ReviewItem = {
  id: string
  word: string
  target_language: string
  native_language?: string | null
  meaning?: string | null
  pronunciation?: string | null
  due_at: string
  repetitions: number
  interval_days: number
}

type Correction = {
  original: string
  fixed: string
  explanationVi: string
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

const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'Tiếng Anh' },
  { code: 'zh', label: 'Tiếng Trung' },
  { code: 'hi', label: 'Tiếng Hindi (Ấn Độ)' },
  { code: 'th', label: 'Tiếng Thái' },
  { code: 'ja', label: 'Tiếng Nhật' },
  { code: 'ko', label: 'Tiếng Hàn' },
  { code: 'vi', label: 'Tiếng Việt (cho người nước ngoài)' },
]

const NATIVE_LANGUAGE_OPTIONS: Array<{ code: NativeLanguageCode; label: string; apiLabel: string }> = [
  { code: 'vi', label: 'Tiếng Việt', apiLabel: 'Vietnamese' },
  { code: 'en', label: 'English', apiLabel: 'English' },
  { code: 'zh', label: '中文 (Tiếng Trung)', apiLabel: 'Chinese (Mandarin)' },
  { code: 'hi', label: 'हिन्दी (Hindi)', apiLabel: 'Hindi' },
  { code: 'th', label: 'ไทย (Tiếng Thái)', apiLabel: 'Thai' },
  { code: 'ja', label: '日本語 (Tiếng Nhật)', apiLabel: 'Japanese' },
  { code: 'ko', label: '한국어 (Tiếng Hàn)', apiLabel: 'Korean' },
]

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

function difficultyLabel(d: TopicDifficultyTag): string {
  if (d === 'basic') return 'Cơ bản'
  if (d === 'intermediate') return 'Trung cấp'
  if (d === 'advanced') return 'Nâng cao'
  return 'Theo cấp độ'
}

function resolveTopicDifficulty(base: TopicDifficultyTag, learnerLevel: LearnerLevel): TopicDifficulty {
  if (base === 'adaptive') return learnerLevel === 0 ? 'basic' : learnerLevel === 1 ? 'intermediate' : 'advanced'
  if (learnerLevel === 0) return 'basic'
  if (learnerLevel === 1) return base === 'advanced' ? 'intermediate' : base
  return base === 'basic' ? 'intermediate' : base
}

function isTopicFitForLevel(base: TopicDifficultyTag, learnerLevel: LearnerLevel): boolean {
  if (base === 'adaptive') return true
  if (learnerLevel === 0) return base === 'basic'
  if (learnerLevel === 1) return base === 'basic' || base === 'intermediate'
  return base === 'intermediate' || base === 'advanced'
}

const GOAL_OPTIONS: Array<{ id: GoalType; label: string }> = [
  { id: 'communication', label: 'Giao tiếp tự tin hằng ngày' },
  { id: 'job', label: 'Phỏng vấn và môi trường công việc' },
  { id: 'travel', label: 'Du lịch và tình huống dịch vụ' },
  { id: 'exam', label: 'Luyện phản xạ chuẩn cho thi cử' },
]

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

function extractMainSentenceForReplay(text: string): string {
  const targetSentence = extractTargetSentenceForTokenization(text)
  if (targetSentence) return targetSentence

  const firstLine = String(text || '')
    .split('\n')
    .map((x) => x.trim())
    .find(Boolean) || ''
  if (!firstLine) return ''

  const firstSentence = firstLine.split(/(?<=[.!?。！？])\s+/u).find(Boolean) || firstLine
  return firstSentence.trim()
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

export default function HocTiengAnhAiClientPage() {
  const { toast } = useToast()
  const [sessionId, setSessionId] = useState<string>(createSessionId)
  const [languageCode, setLanguageCode] = useState<LanguageCode>('en')
  const [nativeLanguageCode, setNativeLanguageCode] = useState<NativeLanguageCode>('vi')
  const [teacherId, setTeacherId] = useState<string>('en-us-f')
  const [sessionTeacher, setSessionTeacher] = useState<TeacherProfile | null>(null)
  const [speakingLanguageMode, setSpeakingLanguageMode] = useState<SpeakingLanguageMode>('auto')
  const [showSpeakingAdvanced, setShowSpeakingAdvanced] = useState(false)
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel>(0)
  const [topicId, setTopicId] = useState<string>(TOPIC_OPTIONS[0].id)
  const [topicFilterMode, setTopicFilterMode] = useState<TopicFilterMode>('fit')
  const [customTopicDraft, setCustomTopicDraft] = useState('')
  const [customTopics, setCustomTopics] = useState<CustomTopicItem[]>([])
  const [customTopicBusy, setCustomTopicBusy] = useState(false)
  const [topicCurriculum, setTopicCurriculum] = useState<TopicCurriculum | null>(null)
  const [topicBusy, setTopicBusy] = useState(false)
  const [goalType, setGoalType] = useState<GoalType>('communication')
  const [goalBusy, setGoalBusy] = useState(false)
  const [activeGoal, setActiveGoal] = useState<LearningGoal | null>(null)
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressSnapshot | null>(null)
  const [dueReviewCount, setDueReviewCount] = useState(0)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewBusy, setReviewBusy] = useState(false)
  const [correctStreak, setCorrectStreak] = useState(0)
  const [showLevelUpSuggestion, setShowLevelUpSuggestion] = useState(false)
  const [mode, setMode] = useState<Mode>('chat')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [todayWordsBusy, setTodayWordsBusy] = useState(false)
  const [wordBusyKey, setWordBusyKey] = useState('')
  const [openedHistorySessionId, setOpenedHistorySessionId] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [pronunciationTips, setPronunciationTips] = useState<string[]>([])
  const [latestPronunciationScore, setLatestPronunciationScore] = useState<number | null>(null)
  const [latestWeakWords, setLatestWeakWords] = useState<string[]>([])
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [, setTeacherAudioByMessageId] = useState<Record<string, string>>({})
  const [todayWords, setTodayWords] = useState<TodayWordItem[]>([])
  const [wordInsightByKey, setWordInsightByKey] = useState<Record<string, WordInsight>>({})
  const [openedWordKey, setOpenedWordKey] = useState('')
  const [tokensByMessageId, setTokensByMessageId] = useState<Record<string, string[]>>({})
  const [tokenizingByMessageId, setTokenizingByMessageId] = useState<Record<string, boolean>>({})
  const lastMicSentTextRef = useRef('')
  const lastMicSentAtRef = useRef(0)
  const shouldCountNewSessionRef = useRef(true)
  const mixedRecorderRef = useRef<MediaRecorder | null>(null)
  const mixedChunksRef = useRef<BlobPart[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeLessonRef = useRef<HTMLDivElement | null>(null)
  const teacherAudioByMessageIdRef = useRef<Record<string, string>>({})
  const persistedMessageIdsRef = useRef<Record<string, true>>({})
  const createdAudioUrlsRef = useRef<string[]>([])

  const teacherOptions = useMemo(() => TEACHERS_BY_LANGUAGE[languageCode], [languageCode])
  const selectedTeacher = useMemo(
    () => teacherOptions.find((t) => t.id === teacherId) || teacherOptions[0],
    [teacherId, teacherOptions]
  )
  const activeTeacher = sessionTeacher || selectedTeacher
  const selectedVoice = activeTeacher.voiceName
  const teacherLabel = activeTeacher.label
  const selectedLanguageLabel = useMemo(
    () => LANGUAGE_OPTIONS.find((x) => x.code === languageCode)?.label || 'ngoại ngữ',
    [languageCode]
  )
  const selectedNativeLanguage = useMemo(
    () => NATIVE_LANGUAGE_OPTIONS.find((x) => x.code === nativeLanguageCode) || NATIVE_LANGUAGE_OPTIONS[0],
    [nativeLanguageCode]
  )
  const allTopicOptions = useMemo<TopicOption[]>(() => {
    const builtin = TOPIC_OPTIONS
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
  }, [customTopics])
  const selectedTopic = useMemo(
    () => allTopicOptions.find((x) => x.id === topicId) || allTopicOptions[0] || TOPIC_OPTIONS[0],
    [topicId, allTopicOptions]
  )
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
  const selectedTopicBaseDifficulty = useMemo<TopicDifficultyTag>(
    () => topicBaseDifficultyById[selectedTopic.id] || 'basic',
    [selectedTopic.id, topicBaseDifficultyById]
  )
  const selectedTopicDifficulty = useMemo<TopicDifficulty>(
    () => resolveTopicDifficulty(selectedTopicBaseDifficulty, learnerLevel),
    [selectedTopicBaseDifficulty, learnerLevel]
  )
  const recentCustomTopics = useMemo(() => customTopics.slice(0, 8), [customTopics])

  useEffect(() => {
    if (topicOptionsByFilter.some((x) => x.id === topicId)) return
    if (topicOptionsByFilter[0]) setTopicId(topicOptionsByFilter[0].id)
  }, [topicOptionsByFilter, topicId])
  const supportLanguage = selectedNativeLanguage.apiLabel
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

  const fetchCustomTopics = async () => {
    try {
      const query = new URLSearchParams({ limit: '30' })
      const res = await fetch(`/api/english-coach/topic-normalize?${query.toString()}`)
      const data = (await res.json().catch(() => ({}))) as { items?: CustomTopicItem[] }
      if (!res.ok) return
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
      toast({ title: 'Thiếu chủ đề', description: 'Bạn hãy nhập chủ đề muốn học trước.', variant: 'destructive' })
      return
    }
    setCustomTopicBusy(true)
    try {
      const res = await fetch('/api/english-coach/topic-normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTopic,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          learnerLevel,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as CustomTopicItem & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Không chuẩn hóa được chủ đề.')
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
        setTopicId(normalized.topicId)
      }
      setCustomTopicDraft('')
      toast({ title: 'Đã chọn chủ đề', description: 'AI đã chuẩn hóa, lưu và chọn chủ đề này để học.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi chủ đề tự tạo', description: msg, variant: 'destructive' })
    } finally {
      setCustomTopicBusy(false)
    }
  }

  const deleteCustomTopic = async (topicIdToDelete: string) => {
    if (!topicIdToDelete) return
    try {
      const res = await fetch('/api/english-coach/topic-normalize', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topicIdToDelete }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Không xóa được chủ đề.')
      setCustomTopics((prev) => prev.filter((x) => x.topicId !== topicIdToDelete))
      if (topicId === topicIdToDelete) {
        const fallback = TOPIC_OPTIONS[0]?.id || ''
        if (fallback) setTopicId(fallback)
      }
      toast({ title: 'Đã xóa chủ đề', description: 'Chủ đề tự tạo đã được xóa khỏi danh sách.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi xóa chủ đề', description: msg, variant: 'destructive' })
    }
  }

  const fetchTopicCurriculum = async () => {
    setTopicBusy(true)
    try {
      const res = await fetch('/api/english-coach/topic-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic.id,
          topicLabel: selectedTopic.label,
          topicDifficulty: selectedTopicDifficulty,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          learnerLevel,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as TopicCurriculum & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Không tạo được giáo trình theo chủ đề.')
      setTopicCurriculum({
        roleplayRole: String(data.roleplayRole || '').trim(),
        dailyQuest: String(data.dailyQuest || '').trim(),
        objective: String(data.objective || '').trim(),
        keywords: Array.isArray(data.keywords) ? data.keywords.map((x) => String(x || '').trim()).filter(Boolean) : [],
        starterSentences: Array.isArray(data.starterSentences) ? data.starterSentences.map((x) => String(x || '').trim()).filter(Boolean) : [],
        lessonSteps: Array.isArray(data.lessonSteps) ? data.lessonSteps.map((x) => String(x || '').trim()).filter(Boolean) : [],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi giáo trình chủ đề', description: msg, variant: 'destructive' })
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
      })
      const res = await fetch(`/api/english-coach/progress?${query.toString()}`, { method: 'GET' })
      const data = (await res.json().catch(() => ({}))) as {
        today?: ProgressSnapshot
        dueReviewCount?: number
        activeGoal?: LearningGoal | null
      }
      if (!res.ok) return
      setProgressSnapshot(data.today || null)
      setDueReviewCount(Number(data.dueReviewCount || 0))
      setActiveGoal(data.activeGoal || null)
      if (data.activeGoal?.goal_type) {
        const id = String(data.activeGoal.goal_type) as GoalType
        if (GOAL_OPTIONS.some((x) => x.id === id)) setGoalType(id)
      }
    } catch {
      // keep learning flow even if snapshot fetch fails
    }
  }

  const fetchReviewDue = async () => {
    setReviewBusy(true)
    try {
      const res = await fetch('/api/english-coach/review-due?limit=8')
      const data = (await res.json().catch(() => ({}))) as { items?: ReviewItem[] }
      if (!res.ok) return
      setReviewItems(Array.isArray(data.items) ? data.items : [])
    } finally {
      setReviewBusy(false)
    }
  }

  const saveLearningGoal = async () => {
    setGoalBusy(true)
    try {
      const selectedGoal = GOAL_OPTIONS.find((x) => x.id === goalType) || GOAL_OPTIONS[0]
      const res = await fetch('/api/english-coach/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType: selectedGoal.id,
          title: selectedGoal.label,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          targetDays: 30,
          targetDailyMinutes: 15,
          targetWeeklySessions: 5,
          targetPronunciationScore: 80,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { goal?: LearningGoal; error?: string }
      if (!res.ok) throw new Error(data.error || 'Không lưu được mục tiêu học.')
      setActiveGoal(data.goal || null)
      toast({ title: 'Đã lưu mục tiêu học', description: 'Lộ trình học đã được cập nhật.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi mục tiêu học', description: msg, variant: 'destructive' })
    } finally {
      setGoalBusy(false)
    }
  }

  const recordProgressTurn = async (hadCorrections: boolean, pronunciationScore?: number | null) => {
    try {
      const localDate = getLocalDateString()
      await fetch('/api/english-coach/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: activeTeacher.languageLabel,
          localDate,
          pronunciationScore: pronunciationScore ?? null,
          hadCorrections,
          newSession: shouldCountNewSessionRef.current,
        }),
      })
      shouldCountNewSessionRef.current = false
      void fetchLearningSnapshot()
    } catch {
      // keep learning flow even if progress save fails
    }
  }

  const markReviewDone = async (id: string, score: number) => {
    try {
      await fetch('/api/english-coach/review-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, score }),
      })
      await Promise.all([fetchReviewDue(), fetchLearningSnapshot()])
    } catch {
      // keep UI usable even if review update fails
    }
  }

  useEffect(() => {
    return () => {
      if (mixedRecorderRef.current && mixedRecorderRef.current.state !== 'inactive') {
        mixedRecorderRef.current.stop()
      }
      createdAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      createdAudioUrlsRef.current = []
    }
  }, [])

  const playAudioUrl = async (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    const audio = new Audio(url)
    audioRef.current = audio
    await audio.play()
  }

  const speakWithBrowserTts = async (text: string, locale?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      throw new Error('Thiết bị không hỗ trợ trình đọc giọng nói của trình duyệt.')
    }
    await new Promise<void>((resolve, reject) => {
      try {
        const utter = new SpeechSynthesisUtterance(text)
        if (locale) utter.lang = locale
        utter.rate = 1
        utter.pitch = 1
        utter.onend = () => resolve()
        utter.onerror = () => reject(new Error('Không phát được fallback speechSynthesis.'))
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utter)
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Không phát được fallback speechSynthesis.'))
      }
    })
  }

  const createTtsAudioData = async (text: string) => {
    const res = await fetch('/api/english-coach/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName: selectedVoice,
        locale: activeTeacher.locale,
        teacherGender: activeTeacher.gender,
        voiceStyle:
          activeTeacher.gender === 'male'
            ? `Speak with a clearly masculine native ${activeTeacher.languageLabel} teacher voice. Calm, warm, and natural.`
            : `Speak with a clearly feminine native ${activeTeacher.languageLabel} teacher voice. Calm, warm, and natural.`,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      audioBase64?: string
      mimeType?: string
      error?: string
      meta?: { model?: string; voice?: string }
      attempts?: Array<{ model?: string; voice?: string; ok?: boolean; reason?: string }>
      warnings?: string[]
      geminiErrorCode?: number
      geminiErrorMessage?: string
    }
    if (!res.ok || !data.audioBase64) {
      console.error('[TTS client] failed', {
        status: res.status,
        error: data.error || 'Không phát được giọng giáo viên.',
        meta: data.meta || null,
        attempts: data.attempts || [],
        warnings: data.warnings || [],
      })
      throw new Error(data.error || 'Không phát được giọng giáo viên.')
    }
    console.info('[TTS client] success', {
      status: res.status,
      engine: data.meta?.model || 'unknown',
      voice: data.meta?.voice || 'unknown',
      attempts: data.attempts || [],
      warnings: data.warnings || [],
    })
    const usingGoogleFallback = String(data.meta?.model || '') === 'google-cloud-tts'
    const geminiFailed = Array.isArray(data.attempts)
      && data.attempts.some((x) => String(x.model || '').includes('gemini') && !x.ok)
    if (usingGoogleFallback && geminiFailed) {
      console.warn('[TTS fallback] Gemini TTS lỗi, đã chuyển sang Google Cloud TTS.', data.attempts || [])
    }

    const bytes = base64ToBytes(data.audioBase64)
    const mime = String(data.mimeType || '').toLowerCase()
    const browserPlayable =
      mime.includes('audio/wav') ||
      mime.includes('audio/wave') ||
      mime.includes('audio/mp3') ||
      mime.includes('audio/mpeg') ||
      mime.includes('audio/ogg') ||
      mime.includes('audio/aac') ||
      mime.includes('audio/flac')

    const blob = browserPlayable
      ? new Blob([bytes], { type: data.mimeType || 'audio/wav' })
      : pcm16MonoToWavBlob(bytes, 24000)
    const blobType = browserPlayable ? data.mimeType || 'audio/wav' : 'audio/wav'

    const url = URL.createObjectURL(blob)
    createdAudioUrlsRef.current.push(url)
    return { url, blob, blobType }
  }

  const saveHistoryMessage = async ({
    role,
    text,
    audioUrl,
  }: {
    role: 'teacher' | 'student'
    text: string
    audioUrl?: string
  }) => {
    const res = await fetch('/api/english-coach/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        role,
        text,
        audioUrl: audioUrl || '',
        languageCode,
        targetLanguage: activeTeacher.languageLabel,
        teacherLabel: activeTeacher.label,
        teacherLocale: activeTeacher.locale,
        mode,
      }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error || 'Không lưu được lịch sử học.')
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return data.id || null
  }

  const uploadTeacherAudio = async (messageId: string, blob: Blob, blobType: string) => {
    const formData = new FormData()
    formData.append('audio', new File([blob], `${messageId}.wav`, { type: blobType || 'audio/wav' }))
    formData.append('sessionId', sessionId)
    formData.append('messageId', messageId)
    const res = await fetch('/api/english-coach/audio-upload', {
      method: 'POST',
      body: formData,
    })
    const data = (await res.json().catch(() => ({}))) as { audioUrl?: string; error?: string }
    if (!res.ok || !data.audioUrl) {
      throw new Error(data.error || 'Không upload được audio giáo viên.')
    }
    return data.audioUrl
  }

  const replayTeacherMessage = async (messageId: string, text: string) => {
    const cached = teacherAudioByMessageIdRef.current[messageId]
    if (!cached) {
      await speakWithBrowserTts(text, activeTeacher.locale)
      return
    }
    await playAudioUrl(cached)
  }

  const replayTeacherMainSentence = async (messageId: string, text: string) => {
    const mainSentence = extractMainSentenceForReplay(text)
    if (!mainSentence) {
      await replayTeacherMessage(messageId, text)
      return
    }
    const key = `${messageId}__main`
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    try {
      const generated = await createTtsAudioData(mainSentence)
      teacherAudioByMessageIdRef.current = {
        ...teacherAudioByMessageIdRef.current,
        [key]: generated.url,
      }
      setTeacherAudioByMessageId((prev) => ({ ...prev, [key]: generated.url }))
      await playAudioUrl(generated.url)
    } catch {
      await speakWithBrowserTts(mainSentence, activeTeacher.locale)
    }
  }

  const generateAndStoreTeacherAudio = async (messageId: string, text: string) => {
    let generated: { url: string; blob: Blob; blobType: string } | null = null
    try {
      generated = await createTtsAudioData(text)
    } catch {
      await speakWithBrowserTts(text, activeTeacher.locale)
      return
    }
    const { url, blob, blobType } = generated
    teacherAudioByMessageIdRef.current = {
      ...teacherAudioByMessageIdRef.current,
      [messageId]: url,
    }
    setTeacherAudioByMessageId((prev) => ({ ...prev, [messageId]: url }))
    await playAudioUrl(url)

    if (persistedMessageIdsRef.current[messageId]) return

    void (async () => {
      let uploadedAudioUrl = ''
      try {
        uploadedAudioUrl = await uploadTeacherAudio(messageId, blob, blobType)
        teacherAudioByMessageIdRef.current = {
          ...teacherAudioByMessageIdRef.current,
          [messageId]: uploadedAudioUrl,
        }
        setTeacherAudioByMessageId((prev) => ({ ...prev, [messageId]: uploadedAudioUrl }))
      } catch {
        // keep local blob URL for current session if upload fails
      }

      try {
        await saveHistoryMessage({ role: 'teacher', text, audioUrl: uploadedAudioUrl })
        persistedMessageIdsRef.current[messageId] = true
        const sessions = await fetch('/api/english-coach/history?limit=12')
        const data = (await sessions.json().catch(() => ({}))) as { sessions?: HistorySession[] }
        if (sessions.ok && Array.isArray(data.sessions)) {
          setHistorySessions(data.sessions)
        }
      } catch {
        // do not block learning flow when history save fails
      }
    })()
  }

  const extractClickableWord = (token: string) => {
    const cleaned = token
      .replace(/^[^a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+/u, '')
      .replace(/[^a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+$/u, '')
      .trim()
    return cleaned.length >= 2 ? cleaned : ''
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
      const res = await fetch('/api/english-coach/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence,
          targetLanguage: activeTeacher.languageLabel,
          targetLanguageCode: languageCode,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { tokens?: string[] }
      const tokens = Array.isArray(data.tokens)
        ? data.tokens
            .map((t) => extractClickableWord(String(t)))
            .filter((token) => isTokenInTargetLanguage(token, languageCode))
            .filter(Boolean)
            .slice(0, 24)
        : []
      setTokensByMessageId((prev) => ({
        ...prev,
        [messageId]: tokens.length > 0 ? tokens : basicTokenizeBySpace(sentence),
      }))
    } catch {
      setTokensByMessageId((prev) => ({ ...prev, [messageId]: basicTokenizeBySpace(sentence) }))
    } finally {
      setTokenizingByMessageId((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  const fetchWordInsight = async (messageId: string, word: string, sentence: string) => {
    const key = `${messageId}:${word.toLowerCase()}`
    setOpenedWordKey(key)
    const savedWord = findSessionWord(word)
    if (savedWord && (savedWord.meaning || savedWord.pronunciation)) {
      setWordInsightByKey((prev) => ({
        ...prev,
        [key]: {
          meaning: savedWord.meaning || '',
          pronunciation: savedWord.pronunciation || savedWord.word,
          exampleTarget: '',
          exampleNative: '',
        },
      }))
      return
    }
    if (wordInsightByKey[key]) {
      try {
        await saveDailyWord(word, wordInsightByKey[key])
        void fetchSessionWords()
      } catch {
        // ignore daily word save failure on cached click
      }
      return
    }

    setWordBusyKey(key)
    try {
      const res = await fetch('/api/english-coach/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          contextSentence: buildWordContextSnippet(sentence, word),
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as WordInsight & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Không phân tích được từ này.')
      const detail = {
        meaning: String(data.meaning || '').trim(),
        pronunciation: String(data.pronunciation || '').trim(),
        exampleTarget: String(data.exampleTarget || '').trim(),
        exampleNative: String(data.exampleNative || '').trim(),
      }
      setWordInsightByKey((prev) => ({
        ...prev,
        [key]: detail,
      }))
      await saveDailyWord(word, detail)
      void fetchSessionWords()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Không phân tích được từ', description: msg, variant: 'destructive' })
    } finally {
      setWordBusyKey('')
    }
  }

  const playWordPronunciation = async (word: string) => {
    const savedWord = findSessionWord(word)
    const savedAudioUrl = String(savedWord?.pronunciationAudioUrl || '').trim()
    if (savedAudioUrl) {
      await playAudioUrl(savedAudioUrl)
      return
    }

    try {
      const { url, blob, blobType } = await createTtsAudioData(word)
      await playAudioUrl(url)

      const safeWordId = toStorageSafeToken(word)
      const audioMessageId = `word_${safeWordId}_${Date.now().toString(36)}`
      const uploadedAudioUrl = await uploadTeacherAudio(audioMessageId, blob, blobType)
      await saveDailyWord(
        word,
        {
          meaning: savedWord?.meaning || '',
          pronunciation: savedWord?.pronunciation || word,
          exampleTarget: '',
          exampleNative: '',
        },
        uploadedAudioUrl
      )
      void fetchSessionWords()
    } catch (e) {
      try {
        await speakWithBrowserTts(word, activeTeacher.locale)
      } catch (inner) {
        const msg = inner instanceof Error ? inner.message : e instanceof Error ? e.message : 'Không phát âm được từ.'
        toast({ title: 'Lỗi phát âm từ', description: msg, variant: 'destructive' })
      }
    }
  }

  const fetchHistorySessions = async () => {
    const res = await fetch('/api/english-coach/history?limit=12')
    const data = (await res.json().catch(() => ({}))) as { sessions?: HistorySession[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'Không tải được lịch sử buổi học.')
    setHistorySessions(Array.isArray(data.sessions) ? data.sessions : [])
  }

  const fetchSessionWords = async (targetSessionId?: string) => {
    const sid = String(targetSessionId || sessionId || '').trim()
    if (!sid) {
      setTodayWords([])
      return
    }
    setTodayWordsBusy(true)
    try {
      const res = await fetch(`/api/english-coach/word-daily?sessionId=${encodeURIComponent(sid)}&limit=80`)
      const data = (await res.json().catch(() => ({}))) as { items?: TodayWordItem[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Không tải được từ mới buổi học.')
      setTodayWords(
        Array.isArray(data.items)
          ? data.items.map((item) => ({
              ...item,
              pronunciationAudioUrl: String(item.pronunciationAudioUrl || '').trim(),
            }))
          : []
      )
    } catch {
      // keep learning flow even if session words fail
    } finally {
      setTodayWordsBusy(false)
    }
  }

  const findSessionWord = (word: string) => {
    const targetWord = word.trim().toLowerCase()
    return todayWords.find((item) => item.word.trim().toLowerCase() === targetWord)
  }

  const saveDailyWord = async (
    word: string,
    detail: Partial<WordInsight>,
    pronunciationAudioUrl?: string
  ) => {
    const date = getLocalDateString()
    const res = await fetch('/api/english-coach/word-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        learnedDate: date,
        word,
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        meaning: String(detail.meaning || '').trim(),
        pronunciation: String(detail.pronunciation || '').trim(),
        pronunciationAudioUrl: pronunciationAudioUrl || '',
        exampleTarget: String(detail.exampleTarget || '').trim(),
        exampleNative: String(detail.exampleNative || '').trim(),
      }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error || 'Không lưu được từ mới.')
    }
    void fetchLearningSnapshot()
    void fetchReviewDue()
  }

  const loadHistorySession = async (targetSessionId: string) => {
    if (!targetSessionId) return
    setHistoryBusy(true)
    try {
      const res = await fetch(`/api/english-coach/history?sessionId=${encodeURIComponent(targetSessionId)}`)
      const data = (await res.json().catch(() => ({}))) as {
        items?: Array<{
          id: string
          role: 'teacher' | 'student'
          text: string
          audioUrl?: string
          languageCode?: string
          teacherLabel?: string
          mode?: string
        }>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Không tải được nội dung buổi học.')

      const items = Array.isArray(data.items) ? data.items : []
      setSessionId(targetSessionId)
      setMessages(items.map((x) => ({ id: x.id, role: x.role, text: x.text })))
      const firstMeta = items.find((x) => x.role === 'teacher') || items[0]
      const metaLanguage = String(firstMeta?.languageCode || '').trim() as LanguageCode
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
      setMode(firstMeta?.mode === 'story' ? 'story' : 'chat')
      setCorrections([])
      setPronunciationTips([])
      lastMicSentTextRef.current = ''
      lastMicSentAtRef.current = 0
      setCorrectStreak(0)
      setShowLevelUpSuggestion(false)
      setOpenedWordKey('')
      setWordBusyKey('')
      setWordInsightByKey({})
      setTokensByMessageId({})
      setTokenizingByMessageId({})
      const loadedAudioMap = items.reduce<Record<string, string>>((acc, item) => {
        if (item.role === 'teacher' && item.audioUrl) acc[item.id] = item.audioUrl
        return acc
      }, {})
      teacherAudioByMessageIdRef.current = loadedAudioMap
      setTeacherAudioByMessageId(loadedAudioMap)
      persistedMessageIdsRef.current = items.reduce<Record<string, true>>((acc, item) => {
        acc[item.id] = true
        return acc
      }, {})
      setOpenedHistorySessionId(targetSessionId)
      activeLessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void fetchSessionWords(targetSessionId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Không mở được buổi học', description: msg, variant: 'destructive' })
    } finally {
      setHistoryBusy(false)
    }
  }

  const startNewSession = () => {
    setSessionId(createSessionId())
    shouldCountNewSessionRef.current = true
    setSessionTeacher(null)
    setOpenedHistorySessionId('')
    lastMicSentTextRef.current = ''
    lastMicSentAtRef.current = 0
    setCorrectStreak(0)
    setShowLevelUpSuggestion(false)
    setMessages([])
    setCorrections([])
    setPronunciationTips([])
    setTodayWords([])
    setOpenedWordKey('')
    setWordBusyKey('')
    setWordInsightByKey({})
    setTokensByMessageId({})
    setTokenizingByMessageId({})
    teacherAudioByMessageIdRef.current = {}
    persistedMessageIdsRef.current = {}
    setTeacherAudioByMessageId({})
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
    void fetchCustomTopics()
  }, [activeTeacher.languageLabel, selectedNativeLanguage.apiLabel])

  useEffect(() => {
    const localUpdates: Record<string, string[]> = {}
    for (const message of messages) {
      if (message.role !== 'teacher') continue
      if (tokensByMessageId[message.id] || tokenizingByMessageId[message.id]) continue
      // Tokenize from the full teacher reply so learners can review
      // vocabulary across the whole explanation, not only one main sentence.
      const tokenSource = message.text
      const mustUseAi = false
      if (mustUseAi || shouldUseAiTokenize(tokenSource)) {
        void fetchMessageTokens(message.id, tokenSource)
      } else {
        localUpdates[message.id] = basicTokenizeBySpace(tokenSource)
      }
    }
    if (Object.keys(localUpdates).length > 0) {
      setTokensByMessageId((prev) => ({ ...prev, ...localUpdates }))
    }
  }, [messages, tokensByMessageId, tokenizingByMessageId])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NATIVE_LANGUAGE_PREF_KEY)
      if (saved && NATIVE_LANGUAGE_OPTIONS.some((x) => x.code === saved)) {
        setNativeLanguageCode(saved as NativeLanguageCode)
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
      localStorage.setItem(NATIVE_LANGUAGE_PREF_KEY, nativeLanguageCode)
    } catch {
      // ignore storage issues
    }
  }, [nativeLanguageCode])

  const handleSend = async (
    raw?: string,
    source: 'text' | 'mic' = 'text',
    micAnalysis?: MixedSpeechAnalysis
  ) => {
    const studentText = String(raw ?? draft).trim()
    if (!studentText || busy) return
    if (source === 'mic') {
      const now = Date.now()
      const duplicate =
        studentText === lastMicSentTextRef.current && now - lastMicSentAtRef.current < 3000
      if (duplicate) return
      lastMicSentTextRef.current = studentText
      lastMicSentAtRef.current = now
    }

    setBusy(true)
    const studentMessageId = appendMessage('student', studentText)
    setDraft('')
    void saveHistoryMessage({ role: 'student', text: studentText })
      .then(() => {
        persistedMessageIdsRef.current[studentMessageId] = true
      })
      .catch(() => {
        // keep conversation usable if history save fails
      })
    try {
      if (!sessionTeacher) {
        setSessionTeacher(selectedTeacher)
      }
      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }))
      const res = await fetch('/api/english-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentText,
          history,
          accent: activeTeacher.accent || 'us',
          gender: activeTeacher.gender,
          mode,
          targetLanguage: activeTeacher.languageLabel,
          targetLanguageCode: languageCode,
          teacherLabel: activeTeacher.label,
          teacherLocale: activeTeacher.locale,
          learnerType: languageCode === 'vi' ? 'foreign_learner' : 'vn_learner',
          supportLanguage,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          nativeLanguageCode,
          inputSource: source,
          studentInputLanguage: studentSpeakingLanguage,
          speakingMode: speakingLanguageMode,
          learnerLevel,
          topicId: selectedTopic.id,
          topicLabel: selectedTopic.label,
          topicDifficulty: selectedTopicDifficulty,
          topicRole: topicCurriculum?.roleplayRole || '',
          topicObjective: topicCurriculum?.objective || '',
          topicKeywords: topicCurriculum?.keywords || [],
          topicStarterSentences: topicCurriculum?.starterSentences || [],
          micAnalysis: source === 'mic' ? micAnalysis : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        corrections?: Correction[]
        pronunciationTips?: string[]
        error?: string
      }
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Không nhận được phản hồi từ giáo viên AI.')
      }

      const teacherMessageId = appendMessage('teacher', data.reply)
      const latestCorrections = Array.isArray(data.corrections) ? data.corrections : []
      setCorrections(latestCorrections)
      setPronunciationTips(Array.isArray(data.pronunciationTips) ? data.pronunciationTips : [])
      if (latestCorrections.length === 0) {
        setCorrectStreak((prev) => {
          const next = prev + 1
          if (learnerLevel < 2 && next >= 3) setShowLevelUpSuggestion(true)
          return next
        })
      } else {
        setCorrectStreak(0)
        setShowLevelUpSuggestion(false)
      }
      void recordProgressTurn(latestCorrections.length > 0, micAnalysis?.pronunciationScore ?? null)
      try {
        await generateAndStoreTeacherAudio(teacherMessageId, extractTeacherSpeechText(data.reply))
      } catch {
        toast({
          title: 'Không phát được âm thanh',
          description: 'Nội dung thầy/cô vẫn hiển thị, bạn có thể tiếp tục học bình thường.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi hội thoại', description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const startLesson = async () => {
    if (!sessionTeacher) {
      setSessionTeacher(selectedTeacher)
    }
    const openingByLanguage: Record<LanguageCode, { chat: string; story: string }> = {
      en: {
        chat: "Hello! I'm your teacher. Let's have a natural conversation. How are you today?",
        story: "Hello! Let's start with a gentle short story. Are you ready?",
      },
      zh: {
        chat: '你好！我是你的老师。我们来轻松对话吧，你今天怎么样？',
        story: '你好！我们来听一个轻松的小故事，好吗？',
      },
      hi: {
        chat: 'नमस्ते! मैं आपका शिक्षक हूँ। चलिए आज एक आसान बातचीत करते हैं।',
        story: 'नमस्ते! चलिए एक हल्की और छोटी कहानी से शुरू करते हैं।',
      },
      th: {
        chat: 'สวัสดีครับ/ค่ะ ฉันคือครูของคุณ เรามาคุยกันแบบสบาย ๆ กันนะ',
        story: 'สวัสดีครับ/ค่ะ เรามาเริ่มจากเรื่องสั้นเบา ๆ กันนะ',
      },
      ja: {
        chat: 'こんにちは。先生です。気軽に会話の練習をしましょう。',
        story: 'こんにちは。やさしい短い物語から始めましょう。',
      },
      ko: {
        chat: '안녕하세요. 선생님입니다. 편하게 대화 연습을 시작해 볼까요?',
        story: '안녕하세요. 부드러운 짧은 이야기로 시작해 볼게요.',
      },
      vi: {
        chat: 'Xin chào! Tôi là giáo viên tiếng Việt của bạn. Chúng ta cùng luyện nói tự nhiên nhé?',
        story: 'Xin chào! Chúng ta bắt đầu bằng một mẩu chuyện tiếng Việt nhẹ nhàng nhé.',
      },
    }
    const opening = mode === 'story' ? openingByLanguage[languageCode].story : openingByLanguage[languageCode].chat
    const teacherMessageId = appendMessage('teacher', opening)
    try {
      await generateAndStoreTeacherAudio(teacherMessageId, extractTeacherSpeechText(opening))
    } catch {
      // keep chat usable even when TTS fails
    }
  }

  const transcribeSpeechAudio = async (audioBlob: Blob): Promise<MixedSpeechAnalysis> => {
    const buffer = await audioBlob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const audioBase64 = btoa(binary)

    const res = await fetch('/api/english-coach/transcribe-mixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
        targetLanguage: activeTeacher.languageLabel,
        targetLanguageCode: languageCode,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        nativeLanguageCode,
        speakingMode: speakingLanguageMode,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      targetTranscript?: string
      nativeTranscript?: string
      mergedTranscript?: string
      inferredMeaning?: string
      pronunciationIssues?: string[]
      pronunciationScore?: number
      weakWords?: string[]
      error?: string
    }
    if (!res.ok || !data.mergedTranscript) {
      throw new Error(data.error || 'Không tách được câu nói trộn.')
    }
    return {
      targetTranscript: String(data.targetTranscript || '').trim(),
      nativeTranscript: String(data.nativeTranscript || '').trim(),
      mergedTranscript: String(data.mergedTranscript || '').trim(),
      inferredMeaning: String(data.inferredMeaning || '').trim(),
      pronunciationIssues: Array.isArray(data.pronunciationIssues)
        ? data.pronunciationIssues.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
        : [],
      pronunciationScore: Number.isFinite(Number(data.pronunciationScore))
        ? Math.min(100, Math.max(0, Math.round(Number(data.pronunciationScore))))
        : 0,
      weakWords: Array.isArray(data.weakWords)
        ? data.weakWords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
        : [],
    }
  }

  const startMixedRecording = async () => {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(media)
    mixedChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) mixedChunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      media.getTracks().forEach((track) => track.stop())
    }
    mixedRecorderRef.current = recorder
    recorder.start()
    setListening(true)
  }

  const stopMixedRecordingAndSend = async () => {
    const recorder = mixedRecorderRef.current
    if (!recorder) return
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

    const blob = new Blob(mixedChunksRef.current, { type: 'audio/webm' })
    mixedChunksRef.current = []
    if (blob.size === 0) {
      throw new Error('Không thu được âm thanh từ mic.')
    }
    const analysis = await transcribeSpeechAudio(blob)
    setLatestPronunciationScore(analysis.pronunciationScore || null)
    setLatestWeakWords(analysis.weakWords || [])
    const transcriptByMode =
      speakingLanguageMode === 'target'
        ? analysis.targetTranscript || analysis.mergedTranscript || analysis.nativeTranscript
        : speakingLanguageMode === 'native'
          ? analysis.nativeTranscript || analysis.mergedTranscript || analysis.targetTranscript
          : analysis.mergedTranscript || analysis.targetTranscript || analysis.nativeTranscript
    setDraft(transcriptByMode)
    await handleSend(transcriptByMode, 'mic', analysis)
  }

  const handleMic = () => {
    if (listening) {
      void stopMixedRecordingAndSend().catch((e) => {
        const msg = e instanceof Error ? e.message : 'Không xử lý được giọng nói.'
        setListening(false)
        toast({ title: 'Mic lỗi', description: msg, variant: 'destructive' })
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({
        title: 'Thiết bị chưa hỗ trợ',
        description: 'Trình duyệt này chưa hỗ trợ ghi âm microphone.',
        variant: 'destructive',
      })
      return
    }
    void startMixedRecording().catch((e) => {
      const msg = e instanceof Error ? e.message : 'Không bật được mic.'
      toast({ title: 'Mic lỗi', description: msg, variant: 'destructive' })
    })
  }

  return (
    <>
      <Toaster />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Languages className="h-6 w-6 text-indigo-600" />
            Học ngoại ngữ tương tác cùng giáo viên bản địa AI
          </h1>
          <p className="mt-1 text-muted-foreground">
            Chọn ngôn ngữ muốn học và chọn giáo viên bản địa tương ứng. Nói chuyện trực tiếp và được sửa lỗi phát âm/ngữ pháp ngay sau mỗi lượt.
          </p>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Thiết lập buổi học</CardTitle>
            <CardDescription>Chọn kiểu giáo viên và phong cách học trước khi bắt đầu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="space-y-1">
                <label className="text-sm font-medium">Ngôn ngữ học</label>
                <select
                  value={languageCode}
                  onChange={(e) => {
                    const code = e.target.value as LanguageCode
                    setLanguageCode(code)
                    const firstTeacher = TEACHERS_BY_LANGUAGE[code]?.[0]
                    if (firstTeacher) setTeacherId(firstTeacher.id)
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Ngôn ngữ mẹ đẻ</label>
                <select
                  value={nativeLanguageCode}
                  onChange={(e) => setNativeLanguageCode(e.target.value as NativeLanguageCode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {NATIVE_LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Giáo viên bản địa</label>
                <select
                  value={selectedTeacher.id}
                  onChange={(e) => setTeacherId(e.target.value)}
                  disabled={messages.length > 0}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </option>
                  ))}
                </select>
                {messages.length > 0 ? (
                  <p className="text-xs text-muted-foreground">Giáo viên được khóa trong buổi hiện tại. Bấm &quot;Buổi học mới&quot; để đổi.</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Chế độ học</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="chat">Hội thoại thường ngày</option>
                  <option value="story">Kể chuyện {selectedLanguageLabel} nhẹ nhàng</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Level học sinh</label>
                <select
                  value={learnerLevel}
                  onChange={(e) => setLearnerLevel(Number(e.target.value) as LearnerLevel)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>Level 0 - Giải thích nhiều bằng tiếng mẹ đẻ</option>
                  <option value={1}>Level 1 - Cân bằng tiếng mẹ đẻ và ngôn ngữ học</option>
                  <option value={2}>Level 2 - Dùng nhiều ngôn ngữ đang học</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">Chủ đề buổi học</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={topicFilterMode === 'fit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTopicFilterMode('fit')}
                  >
                    Phù hợp level hiện tại
                  </Button>
                  <Button
                    type="button"
                    variant={topicFilterMode === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTopicFilterMode('all')}
                  >
                    Xem tất cả
                  </Button>
                </div>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {topicOptionsByFilter.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {(() => {
                        const base = topicBaseDifficultyById[topic.id] || 'basic'
                        if (base === 'adaptive') return topic.label
                        return `${topic.label} [${difficultyLabel(base)}]`
                      })()}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customTopicDraft}
                    onChange={(e) => setCustomTopicDraft(e.target.value)}
                    placeholder="Ví dụ: Phỏng vấn xin việc ngành IT, giao tiếp ở sân bay, thuyết trình dự án..."
                    className="h-11 w-full text-base sm:flex-1 sm:min-w-[320px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void normalizeAndSaveCustomTopic()}
                    disabled={customTopicBusy}
                    className="h-11 px-4 sm:shrink-0"
                  >
                    {customTopicBusy ? 'Đang chọn chủ đề...' : 'Chọn chủ đề'}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Chủ đề sẽ được AI chuẩn hóa rồi tự lưu và chọn ngay để bắt đầu học.
                </p>
                {recentCustomTopics.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">Chủ đề tự tạo gần đây</p>
                    <div className="space-y-1.5">
                      {recentCustomTopics.map((topic) => (
                        <div key={topic.topicId} className="flex items-center gap-1.5">
                          <div
                            className={`rounded-md border px-2 py-1 text-xs ${
                              topicId === topic.topicId
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            {`${topic.topicLabel} [${difficultyLabel(topic.topicDifficulty)}]`}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setTopicId(topic.topicId)}
                          >
                            Chọn học
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                            onClick={() => void deleteCustomTopic(topic.topicId)}
                          >
                            Xóa
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border bg-emerald-50/50 p-3 space-y-2">
                <p className="text-sm font-semibold text-emerald-900">Goal Path (30 ngày)</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as GoalType)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {GOAL_OPTIONS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={() => void saveLearningGoal()} disabled={goalBusy}>
                    {goalBusy ? 'Đang lưu...' : 'Lưu mục tiêu'}
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  {activeGoal
                    ? `Đang theo mục tiêu: ${activeGoal.title} • ${activeGoal.target_days} ngày • ${activeGoal.target_daily_minutes} phút/ngày`
                    : 'Chưa có mục tiêu chủ động. Chọn mục tiêu để hệ thống theo dõi tiến độ sát hơn.'}
                </p>
              </div>
              <div className="rounded-md border bg-slate-50 p-3 space-y-1">
                <p className="text-sm font-semibold text-slate-900">Dashboard tiến độ hôm nay</p>
                <p className="text-sm text-slate-700">
                  Chuỗi học: <span className="font-semibold">{progressSnapshot?.streak_days ?? 0} ngày</span>
                </p>
                <p className="text-sm text-slate-700">
                  Lượt hội thoại: <span className="font-semibold">{progressSnapshot?.turns_count ?? 0}</span> •
                  Điểm phát âm TB: <span className="font-semibold">{progressSnapshot?.avg_pronunciation_score ?? 0}</span>
                </p>
                <p className="text-sm text-slate-700">
                  Từ mới hôm nay: <span className="font-semibold">{progressSnapshot?.new_words_count ?? 0}</span> •
                  Đến hạn ôn: <span className="font-semibold">{dueReviewCount}</span>
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-indigo-50/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-indigo-900">Giáo trình theo chủ đề</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchTopicCurriculum()} disabled={topicBusy}>
                  {topicBusy ? 'Đang tạo...' : 'Tạo/Lấy giáo trình chủ đề'}
                </Button>
              </div>
              <p className="mb-2 text-xs text-slate-600">
                Độ khó tự động theo level hiện tại: <span className="font-semibold">{difficultyLabel(selectedTopicDifficulty)}</span>
              </p>
              {!topicCurriculum ? (
                <p className="text-sm text-muted-foreground">
                  Chọn chủ đề và bấm &quot;Tạo/Lấy giáo trình chủ đề&quot;. Giáo trình sẽ được AI tạo và lưu DB để người học khác dùng lại.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Vai nhập vai:</span> {topicCurriculum.roleplayRole || 'Facilitator'}</p>
                  <p><span className="font-semibold">Nhiệm vụ hôm nay:</span> {topicCurriculum.dailyQuest}</p>
                  <p><span className="font-semibold">Mục tiêu:</span> {topicCurriculum.objective}</p>
                  <p><span className="font-semibold">Từ khóa:</span> {topicCurriculum.keywords.join(', ') || 'Chưa có'}</p>
                  <p><span className="font-semibold">Mẫu câu mở đầu:</span> {topicCurriculum.starterSentences.join(' | ') || 'Chưa có'}</p>
                </div>
              )}
            </div>
            {showLevelUpSuggestion && learnerLevel < 2 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-emerald-800">
                    Học sinh đang trả lời đúng liên tiếp {correctStreak} câu. Gợi ý tăng level để luyện thử thách hơn.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setLearnerLevel((prev) => (prev < 2 ? ((prev + 1) as LearnerLevel) : prev))
                      setShowLevelUpSuggestion(false)
                      setCorrectStreak(0)
                    }}
                  >
                    Tăng lên Level {learnerLevel + 1}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                Giáo viên đang chọn: <span className="font-semibold">{teacherLabel}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={startNewSession}>
                  Buổi học mới
                </Button>
                <Button type="button" variant="outline" onClick={startLesson}>
                  <Volume2 className="mr-2 h-4 w-4" /> Bắt đầu buổi học
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div ref={activeLessonRef} className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Hội thoại trực tiếp</CardTitle>
              <CardDescription>Nói qua mic hoặc gõ văn bản. Giáo viên sẽ phản hồi bằng giọng nói bản địa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-80 space-y-2 overflow-auto rounded-md border bg-slate-50 p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có hội thoại. Bấm &quot;Bắt đầu buổi học&quot; để bắt đầu.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md px-3 py-2 text-sm ${
                        m.role === 'teacher' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border'
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.role === 'teacher' ? 'Teacher' : 'Student'}
                      </p>
                      {m.role === 'teacher' ? (
                        <div className="space-y-2">
                          <p>{m.text}</p>
                          <div className="flex flex-wrap gap-1">
                            {(tokensByMessageId[m.id] || []).map((word, idx) => {
                              const key = `${m.id}:${word.toLowerCase()}`
                              return (
                                <Button
                                  key={`${m.id}-word-${idx}`}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => void fetchWordInsight(m.id, word, m.text)}
                                >
                                  {word}
                                  {openedWordKey === key ? ' •' : ''}
                                </Button>
                              )
                            })}
                          </div>
                          {tokenizingByMessageId[m.id] ? (
                            <p className="text-xs text-muted-foreground">AI đang tách từ theo ngôn ngữ...</p>
                          ) : (tokensByMessageId[m.id] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">Không có token phù hợp để bấm trong câu này.</p>
                          ) : null}
                          {openedWordKey.startsWith(`${m.id}:`) ? (
                            <div className="rounded-md border bg-white p-2 text-xs">
                              {wordBusyKey === openedWordKey ? (
                                <p className="text-muted-foreground">Đang phân tích từ...</p>
                              ) : wordInsightByKey[openedWordKey] ? (
                                <div className="space-y-1">
                                  <p><span className="font-semibold text-slate-800">Nghĩa:</span> {wordInsightByKey[openedWordKey].meaning}</p>
                                  <p><span className="font-semibold text-slate-800">Phát âm:</span> {wordInsightByKey[openedWordKey].pronunciation}</p>
                                  <p><span className="font-semibold text-slate-800">Ví dụ:</span> {wordInsightByKey[openedWordKey].exampleTarget}</p>
                                  <p><span className="font-semibold text-slate-800">Dịch:</span> {wordInsightByKey[openedWordKey].exampleNative}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void playWordPronunciation(openedWordKey.split(':').slice(1).join(':'))}
                                  >
                                    <Volume2 className="mr-2 h-4 w-4" />
                                    Phát âm từ này
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-muted-foreground">Bấm từ khác để xem nghĩa.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p>{m.text}</p>
                      )}
                      {m.role === 'teacher' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void replayTeacherMainSentence(m.id, m.text)}
                            disabled={busy}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            Nghe câu chính
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void replayTeacherMessage(m.id, m.text)}
                            disabled={busy}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            Nói lại câu này
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nhập câu hoặc bấm nút mic để nói..."
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSpeakingAdvanced((prev) => !prev)}
                  disabled={busy}
                >
                  {showSpeakingAdvanced ? 'Ẩn nâng cao' : 'Nâng cao'}
                </Button>
                {showSpeakingAdvanced ? (
                  <select
                    value={speakingLanguageMode}
                    onChange={(e) => setSpeakingLanguageMode(e.target.value as SpeakingLanguageMode)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:w-72"
                    disabled={busy}
                  >
                    <option value="auto">Tự động nhận diện (khuyên dùng)</option>
                    <option value="target">Bạn đang nói: {activeTeacher.languageLabel}</option>
                    <option value="native">Bạn đang nói: {selectedNativeLanguage.label}</option>
                    <option value="mixed">Bạn đang nói: Trộn {activeTeacher.languageLabel} + {selectedNativeLanguage.label}</option>
                  </select>
                ) : null}
                <Button type="button" variant={listening ? 'destructive' : 'outline'} onClick={handleMic} disabled={busy}>
                  {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {listening ? 'Dừng mic' : 'Nói'}
                </Button>
                <Button type="button" onClick={() => void handleSend()} disabled={busy || !draft.trim()}>
                  <Send className="mr-2 h-4 w-4" /> Gửi
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Sửa lỗi ngay</CardTitle>
              <CardDescription>Giáo viên sửa lỗi sai và gợi ý phát âm để bạn nói tự nhiên hơn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">Lỗi cần sửa</p>
                {corrections.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa có lỗi nào gần đây.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {corrections.map((c, idx) => (
                      <div key={`${c.original}-${idx}`} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p><span className="font-semibold text-red-600">Bạn nói:</span> {c.original}</p>
                        <p><span className="font-semibold text-emerald-700">Nên nói:</span> {c.fixed}</p>
                        <p className="text-muted-foreground">{c.explanationVi}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">Điểm phát âm gần nhất</p>
                {latestPronunciationScore == null ? (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa có điểm phát âm từ mic.</p>
                ) : (
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <span className="font-semibold text-indigo-700">{latestPronunciationScore}/100</span>
                      {' '}({latestPronunciationScore >= 85 ? 'Tốt' : latestPronunciationScore >= 70 ? 'Khá' : 'Cần cải thiện'})
                    </p>
                    {latestWeakWords.length > 0 ? (
                      <p className="text-muted-foreground">
                        Từ/cụm cần luyện thêm: {latestWeakWords.join(', ')}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Không phát hiện từ yếu rõ ràng trong lượt gần nhất.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">Mẹo phát âm</p>
                {pronunciationTips.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa có mẹo phát âm mới.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {pronunciationTips.map((tip, idx) => (
                      <li key={`${tip}-${idx}`}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Từ mới của buổi học này</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void fetchSessionWords()} disabled={todayWordsBusy}>
                    Làm mới
                  </Button>
                </div>
                {todayWordsBusy ? (
                  <p className="text-sm text-muted-foreground">Đang tải danh sách từ mới của buổi học...</p>
                ) : todayWords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có từ mới trong buổi này. Bấm vào từ trong câu teacher để lưu.</p>
                ) : (
                  <div className="space-y-2">
                    {todayWords.map((item) => (
                      <div key={item.id} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p><span className="font-semibold text-slate-800">{item.word}</span> - {item.meaning || 'Chưa có nghĩa'}</p>
                        <p className="text-muted-foreground">Phát âm: {item.pronunciation || item.word}</p>
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void playWordPronunciation(item.word)}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            Nghe lại từ này
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Ôn tập thông minh (SRS)</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void fetchReviewDue()} disabled={reviewBusy}>
                    Làm mới
                  </Button>
                </div>
                {reviewBusy ? (
                  <p className="text-sm text-muted-foreground">Đang tải danh sách từ đến hạn ôn...</p>
                ) : reviewItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có từ đến hạn ôn. Tiếp tục hội thoại để tích lũy từ mới.</p>
                ) : (
                  <div className="space-y-2">
                    {reviewItems.map((item) => (
                      <div key={item.id} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p className="font-semibold text-slate-800">{item.word}</p>
                        <p className="text-muted-foreground">{item.meaning || 'Chưa có nghĩa'}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => void markReviewDone(item.id, 2)}>
                            Khó
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void markReviewDone(item.id, 3)}>
                            Ổn
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void markReviewDone(item.id, 5)}>
                            Dễ
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Ôn lại buổi học cũ</CardTitle>
            <CardDescription>Lịch sử buổi học được đồng bộ để mở lại trên nhiều thiết bị.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                Danh sách buổi học đã lưu
                {openedHistorySessionId ? ' • Đang mở 1 buổi cũ' : ''}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => void fetchHistorySessions()}>
                Làm mới
              </Button>
            </div>
            {historySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có buổi học nào được lưu.</p>
            ) : (
              <div className="space-y-2">
                {historySessions.map((session) => (
                  <div key={session.sessionId} className="flex flex-col gap-2 rounded-md border bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{session.teacherLabel || 'Giáo viên AI'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.languageCode?.toUpperCase() || 'N/A'} • {session.mode === 'story' ? 'Kể chuyện' : 'Hội thoại'} • {session.messageCount} tin nhắn
                      </p>
                      <p className="truncate text-xs text-slate-600">{session.lastTeacherText || 'Không có bản xem trước.'}</p>
                    </div>
                    <Button
                      type="button"
                      variant={openedHistorySessionId === session.sessionId ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={historyBusy}
                      onClick={() => void loadHistorySession(session.sessionId)}
                    >
                      {openedHistorySessionId === session.sessionId ? 'Đang mở' : 'Mở buổi này'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

