'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { Mic, MicOff, Send, Languages, Volume2, X } from 'lucide-react'

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
type QuickStartStage = 'idle' | 'confirm_topic' | 'create_curriculum' | 'start_lesson'

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

type WritingTaskType = 'copy' | 'guided_rewrite' | 'rewrite' | 'context_response' | 'advanced_response'

type WritingTask = {
  messageId: string
  taskType: WritingTaskType
  instruction: string
  referenceSentence: string
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

function extractFirstShortSentence(text: string): string {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''
  const first = normalized.split(/(?<=[.!?。！？])\s+/u).find(Boolean)?.trim() || normalized
  if (first.length <= 160) return first
  return `${first.slice(0, 157).trimEnd()}...`
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

function writingTaskTypeByLevel(level: LearnerLevel): WritingTaskType {
  if (level === 0) return 'copy'
  if (level === 1) return 'guided_rewrite'
  if (level === 2) return 'rewrite'
  if (level === 3) return 'context_response'
  return 'advanced_response'
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
  const [speakingLanguageMode] = useState<SpeakingLanguageMode>('auto')
  const [startingLesson, setStartingLesson] = useState(false)
  const [quickStartBusy, setQuickStartBusy] = useState(false)
  const [quickStartStage, setQuickStartStage] = useState<QuickStartStage>('idle')
  const [quickStartModalOpen, setQuickStartModalOpen] = useState(false)
  const [setupCollapsed, setSetupCollapsed] = useState(true)
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
  const [correctStreak, setCorrectStreak] = useState(0)
  const [showLevelUpSuggestion, setShowLevelUpSuggestion] = useState(false)
  const [placementSamples, setPlacementSamples] = useState<string[]>(['', '', ''])
  const [placementBusy, setPlacementBusy] = useState(false)
  const [placementResult, setPlacementResult] = useState<PlacementQuickResult | null>(null)
  const [mode, setMode] = useState<Mode>('chat')
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('detailed')
  const [writingTask, setWritingTask] = useState<WritingTask | null>(null)
  const [writingDraft, setWritingDraft] = useState('')
  const [writingBusy, setWritingBusy] = useState(false)
  const [writingEvalResult, setWritingEvalResult] = useState<WritingEvalResult | null>(null)
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
  const [latestPronunciationBreakdown, setLatestPronunciationBreakdown] = useState<{
    accuracy: number | null
    fluency: number | null
    prosody: number | null
  }>({ accuracy: null, fluency: null, prosody: null })
  const [latestWordScores, setLatestWordScores] = useState<Array<{ word: string; score: number; issueType: string }>>([])
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [teacherAudioByMessageId, setTeacherAudioByMessageId] = useState<Record<string, string>>({})
  const [ttsLoadingByKey, setTtsLoadingByKey] = useState<Record<string, boolean>>({})
  const [todayWords, setTodayWords] = useState<TodayWordItem[]>([])
  const [wordInsightByKey, setWordInsightByKey] = useState<Record<string, WordInsight>>({})
  const [openedWordKey, setOpenedWordKey] = useState('')
  const [tokensByMessageId, setTokensByMessageId] = useState<Record<string, string[]>>({})
  const [tokenizingByMessageId, setTokenizingByMessageId] = useState<Record<string, boolean>>({})
  const [mainSentenceByMessageId, setMainSentenceByMessageId] = useState<Record<string, string>>({})
  const [correctionNoteByMessageId, setCorrectionNoteByMessageId] = useState<Record<string, string>>({})
  const [intentAnswerByMessageId, setIntentAnswerByMessageId] = useState<Record<string, string>>({})
  const [teacherSpeakTextByMessageId, setTeacherSpeakTextByMessageId] = useState<Record<string, string>>({})
  const [intentExplainByMessageId, setIntentExplainByMessageId] = useState<Record<string, string>>({})
  const [intentExplainBusyByMessageId, setIntentExplainBusyByMessageId] = useState<Record<string, boolean>>({})
  const [openingTranslateByMessageId, setOpeningTranslateByMessageId] = useState<Record<string, string>>({})
  const [openingTranslateBusyByMessageId, setOpeningTranslateBusyByMessageId] = useState<Record<string, boolean>>({})
  const supabase = useMemo(() => createClient(), [])
  const lastMicSentTextRef = useRef('')
  const lastMicSentAtRef = useRef(0)
  const shouldCountNewSessionRef = useRef(true)
  const mixedRecorderRef = useRef<MediaRecorder | null>(null)
  const mixedChunksRef = useRef<BlobPart[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const micSilenceStopTimerRef = useRef<number | null>(null)
  const micMaxDurationTimerRef = useRef<number | null>(null)
  const autoStoppingMicRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<Promise<void>>(Promise.resolve())
  const activeLessonRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const teacherAudioByMessageIdRef = useRef<Record<string, string>>({})
  const persistedMessageIdsRef = useRef<Record<string, true>>({})
  const createdAudioUrlsRef = useRef<string[]>([])
  const lastAutoScrollTokenMessageIdRef = useRef('')
  const uiLocale: UiLocale = nativeLanguageCode
  const localText = (vi: string, en: string) => {
    if (uiLocale === 'vi') return vi
    if (uiLocale === 'en') return en
    return LOCAL_TEXT_TRANSLATIONS[en]?.[uiLocale] || en
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
  const selectedVoice = activeTeacher.voiceName
  const teacherLabel = activeTeacher.label
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
  const recentCustomTopics = useMemo(() => customTopics.slice(0, 8), [customTopics])

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
      const query = new URLSearchParams({
        limit: '30',
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        learnerLevel: String(learnerLevel),
      })
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
      toast({
        title: localText('Thiếu chủ đề', 'Missing topic'),
        description: localText('Bạn hãy nhập chủ đề muốn học trước.', 'Please enter a topic before continuing.'),
        variant: 'destructive',
      })
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
      if (!res.ok) throw new Error(data.error || localText('Không chuẩn hóa được chủ đề.', 'Failed to normalize topic.'))
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

  const fetchTopicCurriculum = async (opts?: { skipConfirm?: boolean; topicId?: string }) => {
    const topicIdToUse = String(opts?.topicId || topicId || '').trim()
    const topicToUse = allTopicOptions.find((x) => x.id === topicIdToUse) || selectedTopic
    const topicDifficultyToUse = resolveTopicDifficulty(topicBaseDifficultyById[topicToUse.id] || 'basic', learnerLevel)
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
      const res = await fetch('/api/english-coach/topic-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topicToUse.id,
          topicLabel: topicToUse.label,
          topicDifficulty: topicDifficultyToUse,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          learnerLevel,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as TopicCurriculum & { error?: string }
      if (!res.ok) throw new Error(data.error || localText('Không tạo được giáo trình theo chủ đề.', 'Failed to generate topic curriculum.'))
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
      const hadExistingLesson = messages.length > 0 || Boolean(openedHistorySessionId)
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
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi giáo trình chủ đề', 'Curriculum error'), description: msg, variant: 'destructive' })
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
        if (GOAL_OPTION_KEYS.includes(id)) setGoalType(id)
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
      const selectedGoalId = GOAL_OPTION_KEYS.includes(goalType) ? goalType : GOAL_OPTION_KEYS[0]
      const selectedGoalLabel = GOAL_OPTION_LABELS[uiLocale][selectedGoalId]
      const res = await fetch('/api/english-coach/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType: selectedGoalId,
          title: selectedGoalLabel,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          targetDays: 30,
          targetDailyMinutes: 15,
          targetWeeklySessions: 5,
          targetPronunciationScore: 80,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { goal?: LearningGoal; error?: string }
      if (!res.ok) throw new Error(data.error || localText('Không lưu được mục tiêu học.', 'Failed to save learning goal.'))
      setActiveGoal(data.goal || null)
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
      await fetch('/api/english-coach/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      const res = await fetch('/api/english-coach/placement-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          samples,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        recommendedLevel?: number
        confidence?: number
        reason?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error || localText('Không chấm được level tự động.', 'Failed to run auto placement.'))
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

  const buildWritingTask = (messageId: string, teacherText: string, mainSentence: string): WritingTask => {
    const taskType = writingTaskTypeByLevel(learnerLevel)
    const instruction =
      taskType === 'copy'
        ? localText('Chép lại đúng câu chuẩn (không thêm bớt).', 'Copy the correct sentence exactly.')
        : taskType === 'guided_rewrite'
          ? localText('Viết lại và thay 1 từ/cụm theo ý của bạn.', 'Rewrite and change one word/phrase with your own idea.')
          : taskType === 'rewrite'
            ? localText('Viết lại cùng nghĩa bằng 1 câu khác ngắn gọn.', 'Rewrite with the same meaning in one short sentence.')
            : taskType === 'context_response'
              ? localText('Viết phản hồi theo ngữ cảnh bằng 1-2 câu.', 'Write a context response in 1-2 sentences.')
              : localText('Viết phản hồi tự nhiên hơn (1-3 câu), đúng ngữ cảnh.', 'Write a more natural response (1-3 sentences) in context.')
    return {
      messageId,
      taskType,
      instruction,
      referenceSentence: mainSentence,
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
      const res = await fetch('/api/english-coach/writing-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerText,
          referenceSentence: writingTask.referenceSentence,
          teacherText: writingTask.teacherText,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          learnerLevel,
          taskType: writingTask.taskType,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as WritingEvalResult & { error?: string }
      if (!res.ok) throw new Error(data.error || localText('Không chấm được bài viết.', 'Failed to evaluate writing task.'))
      const result: WritingEvalResult = {
        score: Number.isFinite(Number(data.score)) ? Math.min(100, Math.max(0, Math.round(Number(data.score)))) : 0,
        passed: Boolean(data.passed),
        correctedText: String(data.correctedText || '').trim(),
        feedback: String(data.feedback || '').trim(),
        shortHint: String(data.shortHint || '').trim(),
      }
      setWritingEvalResult(result)
      if (result.passed) {
        setWritingTask((prev) => (prev ? { ...prev, completed: true } : prev))
      }
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi bài viết', 'Writing task error'), description: msg, variant: 'destructive' })
    } finally {
      setWritingBusy(false)
    }
  }

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

  const playAudioUrl = async (url: string) => {
    const run = async () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      const audio = new Audio(url)
      audioRef.current = audio
      await audio.play().catch(() => {
        // keep queue alive when autoplay/playback fails
      })
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
      })
    }
    audioQueueRef.current = audioQueueRef.current
      .catch(() => {
        // recover queue chain after unexpected failure
      })
      .then(run)
    await audioQueueRef.current
  }

  const createTtsAudioData = async (
    text: string,
    opts?: { locale?: string; languageLabel?: string; forceEngine?: 'auto' | 'gemini-only' }
  ) => {
    const localeToUse = String(opts?.locale || activeTeacher.locale || '').trim() || 'en-US'
    const labelToUse = String(opts?.languageLabel || activeTeacher.languageLabel || '').trim() || 'English'
    const res = await fetch('/api/english-coach/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName: selectedVoice,
        locale: localeToUse,
        teacherGender: activeTeacher.gender,
        forceEngine: opts?.forceEngine || 'auto',
        targetLanguage: activeTeacher.languageLabel,
        nativeLanguage: selectedNativeLanguage.apiLabel,
        voiceStyle:
          activeTeacher.gender === 'male'
            ? `Speak with a clearly masculine native ${labelToUse} teacher voice. Calm, warm, and natural.`
            : `Speak with a clearly feminine native ${labelToUse} teacher voice. Calm, warm, and natural.`,
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
        error: data.error || localText('Không phát được giọng giáo viên.', 'Unable to generate teacher voice.'),
        meta: data.meta || null,
        attempts: data.attempts || [],
        warnings: data.warnings || [],
      })
      throw new Error(data.error || localText('Không phát được giọng giáo viên.', 'Unable to generate teacher voice.'))
    }
    console.info('[TTS client] success', {
      status: res.status,
      engine: data.meta?.model || 'unknown',
      voice: data.meta?.voice || 'unknown',
      attempts: data.attempts || [],
      warnings: data.warnings || [],
    })
    const geminiFailed = Array.isArray(data.attempts)
      && data.attempts.some((x) => String(x.model || '').includes('gemini') && !x.ok)
    if (geminiFailed) {
      console.warn(
        uiLocale === 'vi' ? '[TTS] Gemini TTS gặp lỗi ở một số attempt.' : '[TTS] Gemini TTS had failed attempts.',
        data.attempts || []
      )
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

  const tryLoadCachedTtsAudio = async (text: string) => {
    const normalized = String(text || '').trim()
    if (!normalized) return null
    const res = await fetch('/api/english-coach/tts-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: normalized,
        voiceName: activeTeacher.voiceName,
        locale: activeTeacher.locale,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      found?: boolean
      audioBase64?: string
      mimeType?: string
    }
    if (!res.ok || !data.found || !data.audioBase64) return null
    const bytes = base64ToBytes(String(data.audioBase64 || ''))
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

  const splitTtsSegments = (rawText: string): Array<{ text: string; locale: string; languageLabel: string }> => {
    const raw = String(rawText || '').trim()
    if (!raw) return []
    const chunks = raw
      .split(/\n+|(?<=[.!?。！？])\s+/u)
      .map((x) => x.trim())
      .filter(Boolean)
    const localeByLanguageCode: Record<LanguageCode, string> = {
      en: 'en-US',
      zh: 'zh-CN',
      hi: 'hi-IN',
      th: 'th-TH',
      ja: 'ja-JP',
      ko: 'ko-KR',
      vi: 'vi-VN',
    }
    const labelByLanguageCode: Record<LanguageCode, string> = {
      en: 'English',
      zh: 'Chinese',
      hi: 'Hindi',
      th: 'Thai',
      ja: 'Japanese',
      ko: 'Korean',
      vi: 'Vietnamese',
    }
    const targetLocale = localeByLanguageCode[languageCode] || activeTeacher.locale
    const targetLabel = labelByLanguageCode[languageCode] || activeTeacher.languageLabel
    const nativeLocale = localeByLanguageCode[nativeLanguageCode as LanguageCode] || 'vi-VN'
    const nativeLabel = labelByLanguageCode[nativeLanguageCode as LanguageCode] || selectedNativeLanguage.apiLabel

    const detectLocaleAndLabel = (segment: string): { locale: string; languageLabel: string } => {
      const hasThai = /[\u0E00-\u0E7F]/u.test(segment)
      const hasJapanese = /[\u3040-\u30FF]/u.test(segment)
      const hasKorean = /[\uAC00-\uD7AF]/u.test(segment)
      const hasChinese = /[\u4E00-\u9FFF]/u.test(segment)
      const hasHindi = /[\u0900-\u097F]/u.test(segment)
      const hasVietnameseMarked = /[ăâêôơưđĂÂÊÔƠƯĐ]/u.test(segment)
      const hasLatinLetters = /[A-Za-z]/.test(segment)
      const hasTargetScript = isTokenInTargetLanguage(segment, languageCode)
      const hasNativeScript = isTokenInTargetLanguage(segment, nativeLanguageCode as LanguageCode)

      // Strictly stay within selected language pair.
      if (hasTargetScript && !hasNativeScript) return { locale: targetLocale, languageLabel: targetLabel }
      if (hasNativeScript && !hasTargetScript) return { locale: nativeLocale, languageLabel: nativeLabel }

      // If mixed in same segment, prefer target language voice for learning flow.
      if (hasTargetScript && hasNativeScript) return { locale: targetLocale, languageLabel: targetLabel }

      // Fallback by script family, then default to selected target.
      if (hasThai || hasJapanese || hasKorean || hasChinese || hasHindi || hasVietnameseMarked || hasLatinLetters) {
        return { locale: targetLocale, languageLabel: targetLabel }
      }
      return { locale: targetLocale, languageLabel: targetLabel }
    }

    const out = chunks.map((segment) => {
      const lang = detectLocaleAndLabel(segment)
      return { text: segment, ...lang }
    })
    return out.length > 0 ? out : [{ text: raw, locale: targetLocale, languageLabel: targetLabel }]
  }

  const createTtsSegmentAudios = async (text: string) => {
    const segments = splitTtsSegments(text)
    const audioList: Array<{ url: string; blob: Blob; blobType: string }> = []
    for (const segment of segments) {
      const part = await createTtsAudioData(segment.text, {
        locale: segment.locale,
        languageLabel: segment.languageLabel,
        forceEngine: 'auto',
      })
      audioList.push(part)
    }
    return audioList
  }

  const playTtsSegments = async (text: string) => {
    const audioList = await createTtsSegmentAudios(text)
    const urls = audioList.map((x) => x.url)
    for (const url of urls) {
      await playAudioUrl(url)
    }
    return audioList
  }

  const playBestEffortTts = async (text: string) => {
    const single = await createTtsAudioData(String(text || '').trim(), {
      locale: activeTeacher.locale,
      languageLabel: activeTeacher.languageLabel,
      forceEngine: 'auto',
    })
    await playAudioUrl(single.url)
    return [single]
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
      throw new Error(data.error || localText('Không lưu được lịch sử học.', 'Failed to save lesson history.'))
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
      throw new Error(data.error || localText('Không upload được audio giáo viên.', 'Failed to upload teacher audio.'))
    }
    return data.audioUrl
  }

  const replayTeacherMessage = async (messageId: string, text: string) => {
    const key = `${messageId}__full`
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[messageId]
    const textToSpeak = String(teacherSpeakTextByMessageId[messageId] || text || '').trim()
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
  }

  const replayTeacherCorrectionNote = async (messageId: string) => {
    const correctionNote = String(correctionNoteByMessageId[messageId] || '').trim()
    if (!correctionNote) return
    const key = `${messageId}__correction_note`
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy || listening) return
    setTtsLoadingByKey((prev) => ({ ...prev, [key]: true }))
    try {
      const generated = await playBestEffortTts(correctionNote)
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
    const key = `${messageId}__intent_answer`
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy || listening) {
      const cachedDb = await tryLoadCachedTtsAudio(intentAnswer)
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
      const generated = await playBestEffortTts(intentAnswer)
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

      const res = await fetch('/api/english-coach/intent-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentText: previousStudentText,
          intentAnswer,
          correctedSentence,
          correctionNote,
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          topicLabel: selectedTopic.label,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { explanation?: string; error?: string }
      if (!res.ok) throw new Error(data.error || localText('Không giải thích được câu trả lời.', 'Unable to explain this reply.'))
      const meaning = String(data.explanation || '').trim()
      if (!meaning) throw new Error(localText('Không có nội dung giải thích.', 'No explanation content.'))
      setIntentExplainByMessageId((prev) => ({ ...prev, [messageId]: meaning }))
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
      const res = await fetch('/api/english-coach/intent-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentText: '',
          intentAnswer: sourceText,
          correctedSentence: '',
          correctionNote: '',
          targetLanguage: activeTeacher.languageLabel,
          nativeLanguage: selectedNativeLanguage.apiLabel,
          topicLabel: selectedTopic.label,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { explanation?: string; error?: string }
      if (!res.ok) throw new Error(data.error || localText('Không dịch được câu mở đầu.', 'Unable to translate opening line.'))
      const meaning = String(data.explanation || '').trim()
      if (!meaning) throw new Error(localText('Không có nội dung dịch.', 'No translation content.'))
      setOpeningTranslateByMessageId((prev) => ({ ...prev, [messageId]: meaning }))
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
    const key = `${messageId}__main`
    if (ttsLoadingByKey[key]) return
    const cached = teacherAudioByMessageIdRef.current[key]
    if (cached) {
      await playAudioUrl(cached)
      return
    }
    if (busy) {
      const cachedDb = await tryLoadCachedTtsAudio(mainSentence)
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
      const generated = await playBestEffortTts(mainSentence)
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
    const normalized = String(text || '').trim()
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
    return Boolean(fromRef || fromState)
  }

  const isReplayButtonDisabled = (key: string, hasCached: boolean) => {
    if (listening) return true
    if (ttsLoadingByKey[key]) return true
    if (busy && !hasCached) return true
    return false
  }

  const generateAndStoreTeacherAudio = async (messageId: string, text: string) => {
    let generated: { url: string; blob: Blob; blobType: string } | null = null
    try {
      const segmented = await playBestEffortTts(text)
      generated = segmented[0] || null
    } catch (e) {
      throw new Error(unknownErrorMsg(e))
    }
    if (!generated) {
      throw new Error(localText('Không tạo được âm thanh.', 'Unable to create audio.'))
    }
    const { url, blob, blobType } = generated
    teacherAudioByMessageIdRef.current = {
      ...teacherAudioByMessageIdRef.current,
      [messageId]: url,
    }
    setTeacherAudioByMessageId((prev) => ({ ...prev, [messageId]: url }))

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
      if (!res.ok) throw new Error(data.error || localText('Không phân tích được từ này.', 'Failed to analyze this word.'))
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
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Không phân tích được từ', 'Word analysis failed'), description: msg, variant: 'destructive' })
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
      const generatedParts = await playBestEffortTts(word)
      const firstPart = generatedParts[0]
      if (!firstPart) throw new Error(localText('Không tạo được âm thanh.', 'Unable to create audio.'))

      const safeWordId = toStorageSafeToken(word)
      const audioMessageId = `word_${safeWordId}_${Date.now().toString(36)}`
      const uploadedAudioUrl = await uploadTeacherAudio(audioMessageId, firstPart.blob, firstPart.blobType)
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
      const msg = e instanceof Error ? e.message : localText('Không phát âm được từ.', 'Unable to pronounce this word.')
      toast({ title: localText('Lỗi phát âm từ', 'Word pronunciation error'), description: msg, variant: 'destructive' })
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
    const res = await fetch('/api/english-coach/history?limit=12')
    const data = (await res.json().catch(() => ({}))) as { sessions?: HistorySession[]; error?: string }
    if (!res.ok) throw new Error(data.error || localText('Không tải được lịch sử buổi học.', 'Failed to load lesson history.'))
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
      if (!res.ok) throw new Error(data.error || localText('Không tải được từ mới buổi học.', 'Failed to load lesson vocabulary.'))
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
      throw new Error(data.error || localText('Không lưu được từ mới.', 'Failed to save new word.'))
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
      if (!res.ok) throw new Error(data.error || localText('Không tải được nội dung buổi học.', 'Failed to load lesson content.'))

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
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Không mở được buổi học', 'Cannot open session'), description: msg, variant: 'destructive' })
    } finally {
      setHistoryBusy(false)
    }
  }

  const startNewSession = () => {
    if (startingLesson || busy || historyBusy) return
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
    setMainSentenceByMessageId({})
    setCorrectionNoteByMessageId({})
    setIntentAnswerByMessageId({})
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
    const loadLearnerName = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const profile = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        const profileName = String((profile.data as { full_name?: string } | null)?.full_name || '').trim()
        const metaName = String((user.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name || (user.user_metadata as { name?: string } | undefined)?.name || '').trim()
        setLearnerDisplayName(profileName || metaName || '')
      } catch {
        // keep page usable when profile lookup fails
      }
    }
    void loadLearnerName()
  }, [supabase])

  useEffect(() => {
    void fetchCustomTopics()
  }, [activeTeacher.languageLabel, selectedNativeLanguage.apiLabel, learnerLevel])

  useEffect(() => {
    const localUpdates: Record<string, string[]> = {}
    for (const message of messages) {
      if (message.role !== 'teacher') continue
      if (tokensByMessageId[message.id] || tokenizingByMessageId[message.id]) continue
      // Include idea-3 contextual reply explicitly so vocabulary extraction
      // always covers the natural conversation part learners need to practice.
      const idea3 = String(intentAnswerByMessageId[message.id] || '').trim()
      const tokenSource = [message.text, idea3].filter(Boolean).join('\n')
      // Always use AI tokenization for accuracy across mixed/target scripts.
      const mustUseAi = true
      if (mustUseAi || shouldUseAiTokenize(tokenSource)) {
        void fetchMessageTokens(message.id, tokenSource)
      } else {
        localUpdates[message.id] = basicTokenizeBySpace(tokenSource)
      }
    }
    if (Object.keys(localUpdates).length > 0) {
      setTokensByMessageId((prev) => ({ ...prev, ...localUpdates }))
    }
  }, [messages, tokensByMessageId, tokenizingByMessageId, intentAnswerByMessageId])

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
          sessionId,
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
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        corrections?: Correction[]
        pronunciationTips?: string[]
        correctionNote?: string
        intentAnswer?: string
        correctedSentence?: string
        mainSentence?: string
        error?: string
      }
      if (!res.ok || !data.reply) {
        throw new Error(data.error || localText('Không nhận được phản hồi từ giáo viên AI.', 'No response received from AI teacher.'))
      }

      const teacherMessageId = appendMessage('teacher', data.reply)
      const latestCorrections = Array.isArray(data.corrections) ? data.corrections : []
      const correctedMainSentence = String(latestCorrections[0]?.fixed || '').trim()
      const extractedMainSentence = extractTargetSentenceForTokenization(String(data.reply || ''))
      const correctedSentence = String(data.correctedSentence || '').trim()
      const apiMainSentence = String(data.mainSentence || '').trim()
      const fullSentenceCandidate = [correctedSentence, apiMainSentence, extractedMainSentence, correctedMainSentence]
        .map((x) => String(x || '').trim())
        .find((x) => x.split(/\s+/).filter(Boolean).length >= 4)
      const mainSentence = fullSentenceCandidate || apiMainSentence || extractedMainSentence || correctedMainSentence
      if (mainSentence) {
        setMainSentenceByMessageId((prev) => ({ ...prev, [teacherMessageId]: mainSentence }))
      }
      const correctionNote = String(data.correctionNote || '').trim()
      if (correctionNote) {
        setCorrectionNoteByMessageId((prev) => ({ ...prev, [teacherMessageId]: correctionNote }))
      }
      const intentAnswer = String(data.intentAnswer || '').trim()
      if (intentAnswer) {
        setIntentAnswerByMessageId((prev) => ({ ...prev, [teacherMessageId]: intentAnswer }))
      }
      const speakParts = [correctionNote, mainSentence, intentAnswer]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
      const speakText = speakParts.join('. ').trim() || extractTeacherSpeechText(data.reply)
      setTeacherSpeakTextByMessageId((prev) => ({ ...prev, [teacherMessageId]: speakText }))
      setWritingTask(buildWritingTask(teacherMessageId, data.reply, mainSentence || extractTeacherSpeechText(data.reply)))
      setWritingDraft('')
      setWritingEvalResult(null)
      setCorrections(latestCorrections)
      setPronunciationTips(Array.isArray(data.pronunciationTips) ? data.pronunciationTips : [])
      if (latestCorrections.length === 0) {
        setCorrectStreak((prev) => {
          const next = prev + 1
          if (learnerLevel < 4 && next >= 3) setShowLevelUpSuggestion(true)
          return next
        })
      } else {
        setCorrectStreak(0)
        setShowLevelUpSuggestion(false)
      }
      void recordProgressTurn(
        latestCorrections.length > 0,
        micAnalysis?.pronunciationScore ?? null,
        micAnalysis || null,
        source
      )
      try {
        await generateAndStoreTeacherAudio(teacherMessageId, speakText)
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
    } catch (e) {
      const msg = unknownErrorMsg(e)
      toast({ title: localText('Lỗi hội thoại', 'Conversation error'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
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

      // Close modal first so learner sees clean lesson screen
      // before first opening audio starts.
      setQuickStartModalOpen(false)
      await new Promise((resolve) => setTimeout(resolve, 60))

      setQuickStartStage('start_lesson')
      await startLesson({
        skipPrerequisiteCheck: true,
        curriculumOverride: curriculum,
        topicOverride: topicToUse,
      })
      setSetupCollapsed(true)
      toast({
        title: localText('Đã tạo bài học mới', 'New lesson created'),
        description: hadExistingLesson
          ? localText('Buổi học cũ đã được thay bằng buổi học mới từ Bắt đầu nhanh.', 'Previous lesson has been replaced by a new quick-start lesson.')
          : localText('Buổi học mới đã sẵn sàng.', 'Your new lesson is ready.'),
      })
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
      pronunciationAccuracy?: number
      pronunciationFluency?: number
      pronunciationProsody?: number
      wordScores?: Array<{ word?: string; score?: number; issueType?: string }>
      error?: string
    }
    if (!res.ok || !data.mergedTranscript) {
      throw new Error(data.error || localText('Không tách được câu nói trộn.', 'Failed to split mixed speech transcript.'))
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
      pronunciationAccuracy: Number.isFinite(Number(data.pronunciationAccuracy))
        ? Math.min(100, Math.max(0, Math.round(Number(data.pronunciationAccuracy))))
        : 0,
      pronunciationFluency: Number.isFinite(Number(data.pronunciationFluency))
        ? Math.min(100, Math.max(0, Math.round(Number(data.pronunciationFluency))))
        : 0,
      pronunciationProsody: Number.isFinite(Number(data.pronunciationProsody))
        ? Math.min(100, Math.max(0, Math.round(Number(data.pronunciationProsody))))
        : 0,
      wordScores: Array.isArray(data.wordScores)
        ? data.wordScores
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
    const recorder = new MediaRecorder(media)
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
          void stopMixedRecordingAndSend().catch((e) => {
            const msg = unknownErrorMsg(e)
            setListening(false)
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
        void stopMixedRecordingAndSend().catch((e) => {
          const msg = unknownErrorMsg(e)
          setListening(false)
          toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
        })
      }
      cleanupAudioDetect()
    }, MAX_RECORD_MS)
    setListening(true)
  }

  const stopMixedRecordingAndSend = async () => {
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

    const blob = new Blob(mixedChunksRef.current, { type: 'audio/webm' })
    mixedChunksRef.current = []
    if (blob.size === 0) {
      throw new Error(localText('Không thu được âm thanh từ mic.', 'No audio captured from microphone.'))
    }
    const analysis = await transcribeSpeechAudio(blob)
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
    await handleSend(transcriptByMode, 'mic', analysis)
  }

  const handleMic = () => {
    if (writingTask && !writingTask.completed) {
      toast({
        title: localText('Hoàn thành bài viết trước', 'Complete writing task first'),
        description: localText(
          'Hãy hoàn thành bài viết mini của lượt trước để mở khóa mic.',
          'Please finish the mini writing task from the previous turn before using the mic.'
        ),
        variant: 'destructive',
      })
      return
    }
    if (listening) {
      void stopMixedRecordingAndSend().catch((e) => {
        const msg = unknownErrorMsg(e)
        setListening(false)
          toast({ title: coachUiText.micErrorTitle, description: msg, variant: 'destructive' })
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

  return (
    <>
      <Toaster />
      <div className="mx-auto w-full space-y-6 overflow-x-hidden sm:max-w-5xl lg:max-w-7xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Languages className="h-6 w-6 text-indigo-600" />
            {localText('Học ngoại ngữ tương tác cùng giáo viên bản địa AI', 'Interactive language learning with native AI teachers')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {localText(
              'Chọn ngôn ngữ muốn học và chọn giáo viên bản địa tương ứng. Nói chuyện trực tiếp và được sửa lỗi phát âm/ngữ pháp ngay sau mỗi lượt.',
              'Choose your target language and matching native teacher. Talk live and get instant pronunciation/grammar corrections each turn.'
            )}
          </p>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{coachUiText.setupTitle}</CardTitle>
            <CardDescription>{coachUiText.setupDesc}</CardDescription>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={() => setQuickStartModalOpen(true)}
                disabled={quickStartBusy || topicBusy || startingLesson || busy}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {quickStartStageLabel}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={`space-y-4 ${showSetupPanel ? '' : 'hidden'}`}>
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">
                {localText('Chẩn đoán level tự động (khuyến nghị)', 'Auto placement test (recommended)')}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {localText(
                  'Nhập 2-3 câu bạn tự nói bằng ngôn ngữ đang học. Hệ thống sẽ gợi ý level, sau đó bạn vẫn chỉnh tay được.',
                  'Enter 2-3 sentences in your target language. The system recommends a level; you can still change it manually.'
                )}
              </p>
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
                {placementResult ? (
                  <p className="text-xs text-slate-700">
                    {localText('Kết quả:', 'Result:')} <span className="font-semibold">{levelLabelUi(placementResult.recommendedLevel)}</span>
                    {' • '}
                    {localText('Độ tin cậy', 'Confidence')} {placementResult.confidence}%
                    {' • '}
                    {placementResult.reason}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {localText('Bạn có thể bỏ qua bước này và tự chọn level bên dưới.', 'You can skip this and choose level manually below.')}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <label className="text-sm font-medium">{coachUiText.learningLanguage}</label>
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
                  {languageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{coachUiText.nativeLanguage}</label>
                <select
                  value={nativeLanguageCode}
                  onChange={(e) => setNativeLanguageCode(e.target.value as NativeLanguageCode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {nativeLanguageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{coachUiText.nativeTeacher}</label>
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
                  <p className="text-xs text-muted-foreground">
                    {localText(
                      'Giáo viên được khóa trong buổi hiện tại. Bấm "Buổi học mới" để đổi.',
                      'Teacher is locked for this session. Click "New lesson" to change.'
                    )}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{coachUiText.learningMode}</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="chat">{modeLabelUi('chat')}</option>
                  <option value="listen_speak">{modeLabelUi('listen_speak')}</option>
                  <option value="roleplay_short">{modeLabelUi('roleplay_short')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{coachUiText.learnerLevel}</label>
                <select
                  value={learnerLevel}
                  onChange={(e) => setLearnerLevel(Number(e.target.value) as LearnerLevel)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>{levelLabelUi(0)}</option>
                  <option value={1}>{levelLabelUi(1)}</option>
                  <option value={2}>{levelLabelUi(2)}</option>
                  <option value={3}>{levelLabelUi(3)}</option>
                  <option value={4}>{levelLabelUi(4)}</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2 lg:col-span-2">
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
                <p className="text-xs text-slate-500">
                  {localText(
                    'Bấm chọn ở 1 trong 2 ô chủ đề bên trên, sau đó bấm 1 nút xác nhận chung ở cụm hành động bên dưới.',
                    'Pick a topic from one of the two topic boxes above, then use the single confirm button in the action block below.'
                  )}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customTopicDraft}
                    onChange={(e) => setCustomTopicDraft(e.target.value)}
                    placeholder={coachUiText.customTopicPlaceholder}
                    className="h-11 w-full text-base sm:flex-1 sm:min-w-[320px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void normalizeAndSaveCustomTopic()}
                    disabled={customTopicBusy}
                    className="h-11 px-4 sm:shrink-0"
                  >
                    {customTopicBusy ? localText('Đang tạo chủ đề mới...', 'Creating topic...') : localText('Tạo chủ đề mới', 'Create topic')}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  {localText(
                    'Nhập ý tưởng để AI chuẩn hóa thành chủ đề mới, tự lưu và tự chọn để bắt đầu học.',
                    'Enter an idea for AI to normalize into a new topic, save it, and auto-select it for learning.'
                  )}
                </p>
                {customTopicOptions.length === 0 && topicSourceMode === 'custom' ? (
                  <p className="text-xs text-slate-500">
                    {localText(
                      'Chưa có chủ đề mới tạo cho cặp ngôn ngữ/level hiện tại. Bạn có thể tạo mới ở ô bên trên.',
                      'No custom topic found for current language pair/level. You can create one above.'
                    )}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-emerald-50/50 p-3 space-y-2">
                <p className="text-sm font-semibold text-emerald-900">{localText('Goal Path (30 ngày)', 'Goal Path (30 days)')}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as GoalType)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                <p className="text-xs text-slate-600">
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
              <div className="rounded-md border bg-slate-50 p-3 space-y-1">
                <p className="text-sm font-semibold text-slate-900">{localText('Dashboard tiến độ hôm nay', "Today's progress dashboard")}</p>
                <p className="text-sm text-slate-700">
                  {localText('Chuỗi học:', 'Streak:')} <span className="font-semibold">{progressSnapshot?.streak_days ?? 0} {localText('ngày', 'days')}</span>
                </p>
                <p className="text-sm text-slate-700">
                  {localText('Lượt hội thoại:', 'Turns:')} <span className="font-semibold">{progressSnapshot?.turns_count ?? 0}</span> •
                  {localText('Điểm phát âm TB:', 'Avg pronunciation:')} <span className="font-semibold">{progressSnapshot?.avg_pronunciation_score ?? 0}</span>
                </p>
                <p className="text-sm text-slate-700">
                  {localText('Từ mới hôm nay:', 'New words today:')} <span className="font-semibold">{progressSnapshot?.new_words_count ?? 0}</span> •
                  {localText('Đến hạn ôn:', 'Due for review:')} <span className="font-semibold">{dueReviewCount}</span>
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-indigo-50/50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    isTopicConfirmedForLesson ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {isTopicConfirmedForLesson ? '✅' : '⏳'} {localText('B1: Chọn chủ đề', 'S1: Select topic')}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    hasCurriculumReady ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {hasCurriculumReady ? '✅' : '⏳'} {localText('B2: Tạo giáo trình', 'S2: Create curriculum')}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    isLessonReadyToStart ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {isLessonReadyToStart ? '✅' : '⏳'} {localText('B3: Bắt đầu bài học', 'S3: Start lesson')}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={startLesson}
                  disabled={quickStartBusy || !isLessonReadyToStart || startingLesson}
                  className="min-h-[44px] w-full"
                >
                  <Volume2 className="mr-2 h-4 w-4" /> {localText('Bắt đầu buổi học', 'Start lesson')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startNewSession}
                  disabled={quickStartBusy || messages.length === 0 || startingLesson || busy || historyBusy}
                  className="min-h-[44px] w-full"
                >
                  {localText('Buổi học mới', 'New lesson')}
                </Button>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-indigo-900">{localText('Giáo trình theo chủ đề', 'Topic curriculum')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchTopicCurriculum()}
                  disabled={quickStartBusy || topicBusy || !isTopicConfirmedForLesson}
                  className="min-h-[44px]"
                >
                  {topicBusy ? localText('Đang tạo...', 'Generating...') : localText('Tạo/Lấy giáo trình chủ đề', 'Create/Get curriculum')}
                </Button>
              </div>
              <p className="mb-2 text-xs text-slate-600">
                {localText('Độ khó tự động theo level hiện tại:', 'Auto difficulty for current level:')} <span className="font-semibold">{difficultyLabelUi(selectedTopicDifficulty)}</span>
              </p>
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
            {showLevelUpSuggestion && learnerLevel < 4 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-emerald-800">
                    {localText(
                      `Học sinh đang trả lời đúng liên tiếp ${correctStreak} câu. Gợi ý tăng level để luyện thử thách hơn.`,
                      `Learner answered correctly ${correctStreak} times in a row. Consider leveling up for more challenge.`
                    )}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setLearnerLevel((prev) => (prev < 4 ? ((prev + 1) as LearnerLevel) : prev))
                      setShowLevelUpSuggestion(false)
                      setCorrectStreak(0)
                    }}
                  >
                    {localText(`Tăng lên Level ${learnerLevel + 1}`, `Level up to ${learnerLevel + 1}`)}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                {localText('Giáo viên đang chọn:', 'Selected teacher:')} <span className="font-semibold">{teacherLabel}</span>
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

        <div ref={activeLessonRef} className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{coachUiText.chatTitle}</CardTitle>
              <CardDescription>{coachUiText.chatDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-2 pb-3 sm:px-6 sm:pb-6">
              <div ref={chatScrollRef} className="max-h-[60vh] space-y-2 overflow-auto rounded-md border bg-slate-50 p-2 sm:max-h-80 sm:p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {localText('Chưa có hội thoại. Bấm "Bắt đầu buổi học" để bắt đầu.', 'No conversation yet. Click "Start lesson" to begin.')}
                  </p>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`rounded-md px-3 py-2 text-sm ${
                        m.role === 'teacher' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border'
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.role === 'teacher' ? localText('Teacher', 'Teacher') : localText('Student', 'Student')}
                      </p>
                      {m.role === 'teacher' ? (
                        <div className="space-y-2">
                          {(() => {
                            const correctionNote = String(correctionNoteByMessageId[m.id] || '').trim()
                            const correctedSentence = String(mainSentenceByMessageId[m.id] || '').trim()
                            const intentAnswer = String(intentAnswerByMessageId[m.id] || '').trim()
                            const hasStructured = Boolean(correctionNote || correctedSentence || intentAnswer)
                            if (!hasStructured) return <p>{m.text}</p>
                            return (
                              <div className="space-y-1 text-xs">
                                <p>
                                  <span className="font-semibold text-rose-700">{localText('Ý 1 - Sửa lỗi:', 'Idea 1 - Error fix:')}</span>{' '}
                                  {correctionNote || localText('Không có lỗi lớn cần sửa.', 'No major correction needed.')}
                                </p>
                                <p>
                                  <span className="font-semibold text-emerald-700">{localText('Ý 2 - Câu sửa hoàn chỉnh:', 'Idea 2 - Corrected full sentence:')}</span>{' '}
                                  {correctedSentence || localText('Chưa có câu chuẩn.', 'No corrected sentence yet.')}
                                </p>
                                <p>
                                  <span className="font-semibold text-indigo-700">{localText('Ý 3 - Trả lời tự nhiên:', 'Idea 3 - Natural contextual reply:')}</span>{' '}
                                  {intentAnswer || localText('Chưa có phần trả lời ngữ cảnh riêng.', 'No separate contextual reply yet.')}
                                </p>
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
                            )
                          })()}
                          <div className="flex flex-wrap gap-1">
                            {(tokensByMessageId[m.id] || []).map((word, idx) => {
                              const key = `${m.id}:${word.toLowerCase()}`
                              return (
                                <Button
                                  key={`${m.id}-word-${idx}`}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[44px] px-3 text-xs"
                                  onClick={() => void fetchWordInsight(m.id, word, m.text)}
                                >
                                  {word}
                                  {openedWordKey === key ? ' •' : ''}
                                </Button>
                              )
                            })}
                          </div>
                          {tokenizingByMessageId[m.id] ? (
                            <p className="text-xs text-muted-foreground">{localText('AI đang tách từ theo ngôn ngữ...', 'AI is tokenizing words by language...')}</p>
                          ) : (tokensByMessageId[m.id] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">{localText('Không có token phù hợp để bấm trong câu này.', 'No tappable tokens found in this sentence.')}</p>
                          ) : null}
                          {openedWordKey.startsWith(`${m.id}:`) ? (
                            <div className="rounded-md border bg-white p-2 text-xs">
                              {wordBusyKey === openedWordKey ? (
                                <p className="text-muted-foreground">{localText('Đang phân tích từ...', 'Analyzing word...')}</p>
                              ) : wordInsightByKey[openedWordKey] ? (
                                <div className="space-y-1">
                                  <p>
                                    <span className="font-semibold text-slate-800">
                                      {openedWordKey.split(':').slice(1).join(':') || localText('Từ này', 'This word')} {localText('nghĩa là:', 'means:')}
                                    </span>{' '}
                                    {wordInsightByKey[openedWordKey].meaning}
                                  </p>
                                  <p><span className="font-semibold text-slate-800">{localText('Phát âm:', 'Pronunciation:')}</span> {wordInsightByKey[openedWordKey].pronunciation}</p>
                                  <p><span className="font-semibold text-slate-800">{localText('Ví dụ:', 'Example:')}</span> {wordInsightByKey[openedWordKey].exampleTarget}</p>
                                  <p><span className="font-semibold text-slate-800">{localText('Dịch:', 'Translation:')}</span> {wordInsightByKey[openedWordKey].exampleNative}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void playWordPronunciation(openedWordKey.split(':').slice(1).join(':'))}
                                  >
                                    <Volume2 className="mr-2 h-4 w-4" />
                                    {localText('Phát âm từ này', 'Play word pronunciation')}
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-muted-foreground">{localText('Bấm từ khác để xem nghĩa.', 'Tap another word to view meaning.')}</p>
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
                            disabled={isReplayButtonDisabled(`${m.id}__main`, hasCachedTeacherAudio(`${m.id}__main`))}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe câu chính', 'Play main sentence')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void replayTeacherCorrectionNote(m.id)}
                            disabled={isReplayButtonDisabled(`${m.id}__correction_note`, hasCachedTeacherAudio(`${m.id}__correction_note`))}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe sửa lỗi', 'Play error fix')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
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
                            {localText('Nói lại câu này', 'Repeat this sentence')}
                          </Button>
                          {idx === 0 ? (
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
                                  ? localText('Ẩn dịch câu mở đầu', 'Hide opening translation')
                                  : localText('Dịch câu mở đầu', 'Translate opening line')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {m.role === 'teacher' && openingTranslateByMessageId[m.id] ? (
                        <p className="mt-2 text-xs text-slate-600">
                          <span className="font-semibold">{localText('Dịch ngữ cảnh:', 'Context translation:')}</span>{' '}
                          {openingTranslateByMessageId[m.id]}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1 sm:flex-1">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={coachUiText.inputPlaceholder}
                    disabled={busy}
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSend()}
                    disabled={busy || !draft.trim() || (Boolean(writingTask) && !writingTask?.completed)}
                    className="h-9 px-2"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 rounded-md border px-1 py-1 overflow-x-auto whitespace-nowrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={responseStyle === 'detailed' ? 'default' : 'ghost'}
                    onClick={() => setResponseStyle('detailed')}
                    disabled={busy}
                    className="min-h-[44px] px-3 text-xs"
                  >
                    {localText('Chi tiết', 'Detailed')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={responseStyle === 'concise' ? 'default' : 'ghost'}
                    onClick={() => setResponseStyle('concise')}
                    disabled={busy}
                    className="min-h-[44px] px-3 text-xs"
                  >
                    {localText('Ngắn gọn', 'Concise')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? 'destructive' : 'outline'}
                    onClick={handleMic}
                    disabled={busy || (Boolean(writingTask) && !writingTask?.completed)}
                    className="min-h-[44px] px-3 text-xs"
                  >
                    {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {listening ? localText('Dừng mic', 'Stop mic') : localText('Nói', 'Speak')}
                  </Button>
                </div>
              </div>
              {writingTask ? (
                <div className="rounded-md border bg-slate-50/70 p-2.5">
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={writingDraft}
                        onChange={(e) => setWritingDraft(e.target.value)}
                        placeholder={localText('Viết câu của bạn tại đây...', 'Write your sentence here...')}
                        disabled={writingBusy}
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={() => void evaluateWritingTask()} disabled={writingBusy || !writingDraft.trim()}>
                        {writingBusy ? localText('Đang gửi...', 'Sending...') : localText('Gửi', 'Send')}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800">{localText('Bài viết mini bắt buộc', 'Required mini-writing task')}</p>
                      <p className="text-xs text-muted-foreground">{writingTask.instruction}</p>
                      {writingTask.referenceSentence ? (
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{localText('Câu tham chiếu:', 'Reference sentence:')}</span> {writingTask.referenceSentence}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!writingTask.completed ? (
                        <p className="text-xs text-amber-700">
                          {localText(
                            'Bạn cần hoàn thành bài viết này để mở khóa lượt nói/gửi tiếp theo.',
                            'Complete this writing task to unlock the next speak/send turn.'
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700">{localText('Đã hoàn thành. Bạn có thể tiếp tục hội thoại.', 'Completed. You can continue the conversation.')}</p>
                      )}
                    </div>
                    {writingEvalResult ? (
                      <div className="rounded-md border bg-white p-2 text-xs">
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
                          <p className="mt-1"><span className="font-semibold">{localText('Câu sửa gợi ý:', 'Suggested correction:')}</span> {writingEvalResult.correctedText}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-slate-500">
                {coachUiText.micHintPrefix} {selectedNativeLanguage.label} / {selectedLanguageLabel}:{' '}
                &quot;{repeatPromptInNative}&quot; / &quot;{explainPromptInNative}&quot;{' '}
                {localText('hoặc', 'or')} &quot;{repeatPromptInTarget}&quot; / &quot;{explainPromptInTarget}&quot;{' '}
                {localText(
                  'để thầy/cô giải thích đúng câu em đang vướng.',
                  'so the teacher can explain exactly the sentence you are stuck on.'
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{coachUiText.fixTitle}</CardTitle>
              <CardDescription>{coachUiText.fixDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">{localText('Lỗi cần sửa', 'Corrections needed')}</p>
                {corrections.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">{localText('Chưa có lỗi nào gần đây.', 'No recent errors.')}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {corrections.map((c, idx) => (
                      <div key={`${c.original}-${idx}`} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p><span className="font-semibold text-red-600">{localText('Bạn nói:', 'You said:')}</span> {c.original}</p>
                        <p><span className="font-semibold text-emerald-700">{localText('Nên nói:', 'Better:')}</span> {c.fixed}</p>
                        <p className="text-muted-foreground">{c.explanationVi}</p>
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void replayCorrectionSentence(c.fixed)}
                            disabled={isReplayButtonDisabled(correctionAudioKey(c.fixed), hasCachedTeacherAudio(correctionAudioKey(c.fixed)))}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe câu đúng', 'Play corrected sentence')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">{localText('Điểm phát âm gần nhất', 'Latest pronunciation score')}</p>
                {latestPronunciationScore == null ? (
                  <p className="mt-1 text-sm text-muted-foreground">{localText('Chưa có điểm phát âm từ mic.', 'No pronunciation score from mic yet.')}</p>
                ) : (
                  <div className="mt-2 space-y-1 text-sm">
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
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold text-slate-800">{localText('Mẹo phát âm', 'Pronunciation tips')}</p>
                {pronunciationTips.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">{localText('Chưa có mẹo phát âm mới.', 'No new pronunciation tips yet.')}</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {pronunciationTips.map((tip, idx) => {
                      const tipWord = extractPronunciationWordFromTip(tip)
                      return (
                        <li key={`${tip}-${idx}`} className="space-y-1">
                          <p>{tip}</p>
                          {tipWord ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void playWordPronunciation(tipWord)}
                            >
                              <Volume2 className="mr-2 h-4 w-4" />
                              {localText('Nghe từ:', 'Listen word:')} {tipWord}
                            </Button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{localText('Từ mới của buổi học này', 'New words in this lesson')}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void fetchSessionWords()} disabled={todayWordsBusy}>
                    {localText('Làm mới', 'Refresh')}
                  </Button>
                </div>
                {todayWordsBusy ? (
                  <p className="text-sm text-muted-foreground">{localText('Đang tải danh sách từ mới của buổi học...', 'Loading new words for this lesson...')}</p>
                ) : todayWords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{localText('Chưa có từ mới trong buổi này. Bấm vào từ trong câu teacher để lưu.', 'No new words yet. Tap words in teacher sentences to save them.')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {todayWords.map((item) => (
                      <div key={item.id} className="rounded-md border bg-slate-50 p-1.5 text-xs leading-snug">
                        <p><span className="font-semibold text-slate-800">{item.word}</span> - {item.meaning || localText('Chưa có nghĩa', 'No meaning yet')}</p>
                        <p className="text-muted-foreground">{localText('Phát âm:', 'Pronunciation:')} {item.pronunciation || item.word}</p>
                        <div className="mt-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => void playWordPronunciation(item.word)}
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe lại từ này', 'Replay this word')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{localText('Ôn tập thông minh (SRS)', 'Smart review (SRS)')}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void fetchReviewDue()} disabled={reviewBusy}>
                    {localText('Làm mới', 'Refresh')}
                  </Button>
                </div>
                {reviewBusy ? (
                  <p className="text-sm text-muted-foreground">{localText('Đang tải danh sách từ đến hạn ôn...', 'Loading words due for review...')}</p>
                ) : reviewItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{localText('Chưa có từ đến hạn ôn. Tiếp tục hội thoại để tích lũy từ mới.', 'No words due yet. Keep chatting to build vocabulary.')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {reviewItems.map((item) => (
                      <div key={item.id} className="rounded-md border bg-slate-50 p-1.5 text-xs leading-snug">
                        <p className="font-semibold text-slate-800">{item.word}</p>
                        <p className="text-muted-foreground">{localText('Phát âm:', 'Pronunciation:')} {item.pronunciation || item.word}</p>
                        <p className="text-muted-foreground">{item.meaning || localText('Chưa có nghĩa', 'No meaning yet')}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void playWordPronunciation(item.word)}>
                            <Volume2 className="mr-2 h-4 w-4" />
                            {localText('Nghe lại từ này', 'Replay this word')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void markReviewDone(item.id, 2)}>
                            {localText('Khó', 'Hard')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void markReviewDone(item.id, 3)}>
                            {localText('Ổn', 'Okay')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void markReviewDone(item.id, 5)}>
                            {localText('Dễ', 'Easy')}
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
            <CardTitle>{coachUiText.historyTitle}</CardTitle>
            <CardDescription>{coachUiText.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {localText('Danh sách buổi học đã lưu', 'Saved lesson list')}
                {openedHistorySessionId ? localText(' • Đang mở 1 buổi cũ', ' • Opening one past lesson') : ''}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => void fetchHistorySessions()}>
                {localText('Làm mới', 'Refresh')}
              </Button>
            </div>
            {historySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{localText('Chưa có buổi học nào được lưu.', 'No saved lessons yet.')}</p>
            ) : (
              <div className="space-y-2">
                {historySessions.map((session) => (
                  <div key={session.sessionId} className="flex flex-col gap-2 rounded-md border bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{session.teacherLabel || localText('Giáo viên AI', 'AI teacher')}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.languageCode?.toUpperCase() || 'N/A'} • {
                          session.mode === 'listen_speak'
                            ? localText('Luyện nghe nói', 'Listen & Speak')
                            : session.mode === 'roleplay_short'
                              ? localText('Nhập vai ngắn', 'Short roleplay')
                              : localText('Hội thoại', 'Conversation')
                        } • {session.messageCount} {localText('tin nhắn', 'messages')}
                      </p>
                      <p className="truncate text-xs text-slate-600">{session.lastTeacherText || localText('Không có bản xem trước.', 'No preview available.')}</p>
                    </div>
                    <Button
                      type="button"
                      variant={openedHistorySessionId === session.sessionId ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={historyBusy}
                      onClick={() => void loadHistorySession(session.sessionId)}
                    >
                      {openedHistorySessionId === session.sessionId ? localText('Đang mở', 'Opened') : localText('Mở buổi này', 'Open this lesson')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {quickStartModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-6 sm:pt-10">
          <div className="relative flex w-full max-w-3xl max-h-[calc(100vh-4.5rem)] flex-col rounded-lg border bg-white shadow-xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuickStartModalOpen(false)}
              disabled={quickStartBusy}
              aria-label={localText('Đóng popup', 'Close popup')}
              className="absolute right-2 top-2 z-10 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b px-4 py-3">
              <p className="text-base font-semibold text-slate-900">
                {localText('Bắt đầu nhanh - Cài đặt bài học', 'Quick start - Lesson setup')}
              </p>
              <p className="text-xs text-slate-600">
                {localText(
                  'Chọn nhanh các tùy chọn dưới đây, rồi bấm "Tạo bài học" để tạo giáo trình và mở buổi học luôn.',
                  'Pick your settings below, then click "Create lesson" to generate curriculum and start immediately.'
                )}
              </p>
            </div>
            <div className="overflow-auto px-4 py-3">
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{coachUiText.learningLanguage}</label>
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
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{coachUiText.nativeLanguage}</label>
                  <select
                    value={nativeLanguageCode}
                    onChange={(e) => setNativeLanguageCode(e.target.value as NativeLanguageCode)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {nativeLanguageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{coachUiText.nativeTeacher}</label>
                  <select
                    value={selectedTeacher.id}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {teacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{coachUiText.learnerLevel}</label>
                  <select
                    value={learnerLevel}
                    onChange={(e) => setLearnerLevel(Number(e.target.value) as LearnerLevel)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={0}>{levelLabelUi(0)}</option>
                    <option value={1}>{levelLabelUi(1)}</option>
                    <option value={2}>{levelLabelUi(2)}</option>
                    <option value={3}>{levelLabelUi(3)}</option>
                    <option value={4}>{levelLabelUi(4)}</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 grid gap-3 grid-cols-1 md:grid-cols-2">
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
                      <option key={topic.id} value={topic.id}>{topic.label}</option>
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
                      <option key={topic.id} value={topic.id}>{topic.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-md border bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">{localText('Tạo chủ đề mới ngay trong popup', 'Create a new topic in this popup')}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customTopicDraft}
                    onChange={(e) => setCustomTopicDraft(e.target.value)}
                    placeholder={coachUiText.customTopicPlaceholder}
                    className="h-11 w-full text-base sm:flex-1"
                    disabled={customTopicBusy || quickStartBusy}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void normalizeAndSaveCustomTopic()}
                    disabled={customTopicBusy || quickStartBusy}
                    className="h-11 px-4 sm:shrink-0"
                  >
                    {customTopicBusy ? localText('Đang tạo chủ đề mới...', 'Creating topic...') : localText('Tạo chủ đề mới', 'Create topic')}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={() => void runQuickStartFlow()}
                disabled={quickStartBusy}
                className="min-h-[44px]"
              >
                {quickStartBusy ? quickStartStageLabel : localText('Tạo bài học', 'Create lesson')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

