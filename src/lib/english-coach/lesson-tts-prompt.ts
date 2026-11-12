export type LessonSpeechDelivery = 'explain' | 'model' | 'reply'

export type LessonTtsPromptInput = {
  voiceStyle?: string
  voiceName: string
  teacherGender?: string
  locale: string
  targetLanguage?: string
  nativeLanguage?: string
  /** Ngôn ngữ của clip tiếng mẹ đẻ. Trống khi clip là tiếng đang học. */
  readingLanguage?: string
  /** Cách nhấn của ý. Trống khi không phải ba ý của lượt thầy. */
  delivery?: LessonSpeechDelivery | ''
  text: string
}

/** Ý 1 giải thích, ý 2 đọc mẫu, ý 3 hỏi lại. Cùng một thầy. */
export function lessonSpeechDeliveryForKey(segmentKey: string): LessonSpeechDelivery {
  const key = String(segmentKey || '')
  if (key.includes('__intent_answer')) return 'reply'
  if (key.includes('__main')) return 'model'
  return 'explain'
}

function deliveryCue(delivery: string): string {
  if (delivery === 'explain') {
    return `Delivery of this clip: coaching explanation.
Keep the selected teacher voice. Do not switch speaker.
Speak as a teacher explaining a correction: warm, patient, a little slower than chat.
Emphasize the word being corrected. This is not a sentence for the learner to repeat, and it is not a question.`
  }
  if (delivery === 'model') {
    return `Delivery of this clip: model sentence for the learner to repeat.
Keep the selected teacher voice. Do not switch speaker.
Speak clearly and steadily, a little slowly, with each word distinct.
Pause lightly at punctuation. Do not chat, do not explain grammar, and do not use a questioning tone.`
  }
  if (delivery === 'reply') {
    return `Delivery of this clip: the teacher answering and continuing the conversation.
Keep the selected teacher voice. Do not switch speaker.
Speak like a real reply to the learner: warmer and more lively than a dictation.
If the line asks a question, finish with a clear rising question intonation.
Do not sound like a textbook reading or a grammar explanation.`
  }
  return ''
}

/** Một thầy của tiếng đang học đọc mọi clip. Clip tiếng mẹ đẻ không đổi sang người khác. */
export function buildLessonTtsPrompt(input: LessonTtsPromptInput): string {
  const voiceStyle = String(input.voiceStyle || '').trim()
  const voiceName = String(input.voiceName || '').trim()
  const teacherGender = String(input.teacherGender || '').trim() || 'unspecified'
  const locale = String(input.locale || '').trim() || 'en-US'
  const targetLanguage = String(input.targetLanguage || '').trim() || 'target language'
  const nativeLanguage = String(input.nativeLanguage || '').trim() || 'native language'
  const readingLanguage = String(input.readingLanguage || '').trim()
  const text = String(input.text || '').trim()
  const delivery = String(input.delivery || '').trim()
  const cue = deliveryCue(delivery)
  const pacingRule = delivery
    ? 'Follow the delivery above. Do not flatten this clip into one neutral reading.'
    : 'Keep teacher-like pacing and natural punctuation pauses.'
  const styleLine = [voiceStyle, cue].filter(Boolean).join('\n')
  const styleBlock = styleLine ? `${styleLine}\n` : ''
  if (readingLanguage) {
    return `${styleBlock}You are the selected teacher of this lesson. Keep this same voice for every clip. Do not switch to another speaker.
Teacher profile:
- Selected voice: ${voiceName}
- Selected gender: ${teacherGender}
- Selected locale/accent: ${locale}
- Target learning language: ${targetLanguage}
- This clip is written in the learner's language: ${readingLanguage}

Reading rules (strict):
1) Read EXACTLY the provided text in original order.
2) Do not translate, explain, paraphrase, summarize, or add/remove any words.
3) You are the ${targetLanguage} teacher speaking ${readingLanguage}. Keep the same teacher voice and accent. Do not become a different native speaker of ${readingLanguage}.
4) Pronounce the words clearly enough for the learner to understand.
5) ${pacingRule}

Text:
${text}`
  }
  return `${styleBlock}You are the selected teacher voice for this lesson.
Teacher profile:
- Selected voice: ${voiceName}
- Selected gender: ${teacherGender}
- Selected locale/accent: ${locale}

Language pair lock (must follow exactly):
- Target learning language: ${targetLanguage}
- Learner native language: ${nativeLanguage}
- Only read text within this selected pair. Do not introduce any third language.

Reading rules (strict):
1) Read EXACTLY the provided text in original order.
2) Do not translate, explain, paraphrase, summarize, or add/remove any words.
3) ${pacingRule}
4) Keep pronunciation consistent with selected locale/accent ${locale}.
5) If both target + native language appear, read both exactly as written, in sequence, with this same teacher voice.

Text:
${text}`
}
