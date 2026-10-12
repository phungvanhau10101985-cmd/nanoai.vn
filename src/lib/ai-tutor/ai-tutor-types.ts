export type TutorShare = 'reused' | 'saved' | 'private'

export type TutorLabel = {
  key: string
  title: string
}

export type TutorAnswer = {
  topicKey: string
  title: string
  explanation: string
  practice: string
  labels: TutorLabel[]
  share: TutorShare
}

export type TutorThreadMessage = {
  id: string
  role: 'user' | 'tutor'
  body: string
  topicKey: string
  kind: 'question' | 'label' | 'answer'
  answer: TutorAnswer | null
  createdAt: string
}

export type TutorSessionSummary = {
  id: string
  preview: string
  updatedAt: string
  messageCount: number
}

export type TutorErrorCode = 'unauthorized' | 'missing_text' | 'ai_unavailable' | 'new_thread_failed'
