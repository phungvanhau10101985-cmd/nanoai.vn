import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChatPrompts } from './prompt-builder'
import type { BuildChatPromptsInput } from './types'
import { topicSenseClash, topicSenseLockGuide } from './topic-sense-lock'

test('drink topic locks nuoc to drinks, not countries', () => {
  const base = {
    topicLabel: 'Gọi đồ uống',
    topicRole: 'Nhân viên quán',
    topicObjective: 'Luyện gọi nước tại quán',
    studentText: 'ở đây có những nước gì',
  }
  assert.equal(topicSenseClash({ ...base, candidateText: '这里有什么国家？' }), true)
  assert.equal(topicSenseClash({ ...base, candidateText: 'What countries are there here?' }), true)
  assert.equal(topicSenseClash({ ...base, candidateText: '这里有什么饮料？' }), false)
  assert.equal(topicSenseClash({ ...base, candidateText: 'What drinks do you have here?' }), false)
  assert.equal(
    topicSenseClash({
      ...base,
      topicLabel: 'Gọi món tại nhà hàng',
      candidateText: '这里有什么国家？',
    }),
    true
  )
})

test('country topic keeps nuoc as country', () => {
  const base = {
    topicLabel: 'Địa lý và quốc gia',
    studentText: 'ở đây có những nước gì',
  }
  assert.equal(topicSenseClash({ ...base, candidateText: '这里有什么国家？' }), false)
  assert.equal(topicSenseClash({ ...base, candidateText: '这里有什么饮料？' }), true)
})

test('origin question on a food topic is not treated as a drink order', () => {
  assert.equal(
    topicSenseClash({
      topicLabel: 'Gọi món tại nhà hàng',
      studentText: 'món này của nước nào',
      candidateText: '这道菜是哪个国家的？',
    }),
    false
  )
})

test('goi follows the topic: order at a cafe, phone on a call topic', () => {
  assert.equal(
    topicSenseClash({
      topicLabel: 'Gọi đồ uống',
      studentText: 'cho em gọi một ly',
      candidateText: '我想给你打电话。',
    }),
    true
  )
  assert.equal(
    topicSenseClash({
      topicLabel: 'Gọi điện thoại',
      studentText: 'em muốn gọi mẹ',
      candidateText: '我想点餐。',
    }),
    true
  )
  assert.equal(
    topicSenseClash({
      topicLabel: 'Gọi đồ uống',
      studentText: 'cho em gọi một ly',
      candidateText: '我想点一杯咖啡。',
    }),
    false
  )
})

test('guide names the drink sense and applies to every topic', () => {
  const guide = topicSenseLockGuide('Chinese')
  assert.match(guide, /MỌI chủ đề/)
  assert.match(guide, /这里有什么饮料？/)
  assert.match(guide, /这里有什么国家？/)
  assert.match(guide, /Chinese/)
})

test('chat prompt carries the sense lock next to the topic', () => {
  const input: BuildChatPromptsInput = {
    teacherIdentity: 'thầy giáo',
    nativeLanguage: 'Tiếng Việt',
    targetLanguage: 'Chinese',
    nativeLanguageCode: 'vi',
    targetLanguageCode: 'zh',
    teacherLocale: 'zh-CN',
    learnerContext: 'Học sinh là người Việt đang học ngoại ngữ.',
    genderLabel: 'thầy giáo',
    modePrompt: 'chat',
    responseStyleGuide: 'ngắn',
    explanationLanguage: 'Tiếng Việt',
    bilingualGuide: '',
    nativeLanguageGuide: '',
    micGuide: '',
    speakingModeGuide: '',
    strictLanguagePairGuide: '',
    howToSayGuide: '',
    contextualReplyGuide: '',
    mixedAnalysisGuide: '',
    levelPromptIndependent: '',
    micAnalysisGuide: '',
    pinyinGuide: '',
    topicGuide: 'topicLabel: Gọi đồ uống',
    retrievalGuide: '',
    transcript: '',
    studentText: 'ở đây có những nước gì',
    mixedNormalizedStudentText: '这里有什么国家？',
    speakingMode: 'native',
    sessionMemory: {
      runningSummary: '',
      pinnedFacts: {
        repeatedMistakes: [],
        correctedSentences: [],
        learnedPhrases: [],
        topicFocus: '',
      },
    },
    pairConfig: {
      key: 'vi__zh',
      nativeLanguageCode: 'vi',
      targetLanguageCode: 'zh',
      uiTone: 'supportive',
      enforceStrictPair: true,
      nativeFirstExplanation: true,
      maxReplyCharsConcise: 520,
      maxReplyCharsDetailed: 760,
      conversationFocus: [],
      correctionFocus: [],
      lexicalFocus: [],
      avoidPatterns: [],
      extraSystemRules: [],
    },
  }
  const { systemPrompt, userPrompt } = buildChatPrompts(input)
  assert.match(systemPrompt, /这里有什么饮料？/)
  assert.match(systemPrompt, /topicLabel: Gọi đồ uống/)
  assert.match(userPrompt, /lệch chủ đề/)
  assert.match(userPrompt, /ở đây có những nước gì/)
})
