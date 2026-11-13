import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { alignReadingToCut, pairedReading, readingForCutSentence, readingStoredForShownText } from './coach-reading'

describe('alignReadingToCut', () => {
  const full = '今天天气很好。我们去公园。'
  const reading = 'jīn tiān tiān qì hěn hǎo wǒ men qù gōng yuán'

  it('cuts pinyin to the first sentence', () => {
    assert.equal(alignReadingToCut(full, reading, '今天天气很好。'), 'jīn tiān tiān qì hěn hǎo')
  })

  it('drops a removed word in the middle', () => {
    assert.equal(
      alignReadingToCut('我叫 Tom 的名字。', 'wǒ jiào Tom de míng zi', '我叫的名字。'),
      'wǒ jiào de míng zi'
    )
  })

  it('keeps the reading when the characters are the same', () => {
    assert.equal(alignReadingToCut('今天天气很好。', 'jīn tiān tiān qì hěn hǎo', '今天天气很好'), 'jīn tiān tiān qì hěn hǎo')
  })

  it('does not guess when the syllable count does not match', () => {
    assert.equal(alignReadingToCut(full, 'jīn tiān', '今天天气很好。'), '')
  })
})

describe('readingForCutSentence', () => {
  it('uses the cut of the longer intent reading for sentence 2', () => {
    const intent = '今天天气很好。我们去公园。'
    const reading = 'jīn tiān tiān qì hěn hǎo wǒ men qù gōng yuán'
    const sentence = '今天天气很好。'
    assert.equal(
      readingForCutSentence(sentence, reading, [{ text: intent, reading }]),
      'jīn tiān tiān qì hěn hǎo'
    )
  })

  it('cuts sentence 2 from the intent when another sentence only contains the same characters later', () => {
    assert.equal(
      readingForCutSentence('我行。', 'wǒ xíng hǎo de', [
        { text: '我银行。', reading: 'wǒ yín háng' },
        { text: '我行。好的。', reading: 'wǒ xíng hǎo de' },
      ]),
      'wǒ xíng'
    )
  })

  it('keeps a reading that already matches the sentence', () => {
    assert.equal(
      readingForCutSentence('今天天气很好。', 'jīn tiān tiān qì hěn hǎo', [
        { text: '今天天气很好。我们去公园。', reading: 'jīn tiān tiān qì hěn hǎo wǒ men qù gōng yuán' },
      ]),
      'jīn tiān tiān qì hěn hǎo'
    )
  })
})

describe('pairedReading', () => {
  it('pairs each English word and keeps the period outside', () => {
    const parts = pairedReading('I go to the stadium.', 'aɪ ɡoʊ tə ðə ˈsteɪdiəm')
    assert.deepEqual(parts, [
      { kind: 'pair', text: 'I', reading: 'aɪ' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'go', reading: 'ɡoʊ' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'to', reading: 'tə' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'the', reading: 'ðə' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'stadium', reading: 'ˈsteɪdiəm' },
      { kind: 'gap', text: '.' },
    ])
  })

  it('joins syllable pieces onto one English word', () => {
    const parts = pairedReading('stadium', 'ˈsteɪ di əm')
    assert.deepEqual(parts, [{ kind: 'pair', text: 'stadium', reading: 'ˈsteɪdiəm' }])
  })

  it('pairs each Chinese character', () => {
    const parts = pairedReading('登机口', 'dēng jī kǒu')
    assert.deepEqual(parts, [
      { kind: 'pair', text: '登', reading: 'dēng' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: '机', reading: 'jī' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: '口', reading: 'kǒu' },
    ])
  })

  it('pairs Japanese by character when each sound is separate', () => {
    const parts = pairedReading('私は', 'watashi wa')
    assert.deepEqual(parts, [
      { kind: 'pair', text: '私', reading: 'watashi' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'は', reading: 'wa' },
    ])
  })

  it('pairs a Hindi word run when the reading is one token per word', () => {
    const parts = pairedReading('मैं जाता', 'maĩ jātā')
    assert.deepEqual(parts, [
      { kind: 'pair', text: 'मैं', reading: 'maĩ' },
      { kind: 'gap', text: ' ' },
      { kind: 'pair', text: 'जाता', reading: 'jātā' },
    ])
  })
})

describe('readingStoredForShownText', () => {
  it('stores only the syllables of the characters still shown', () => {
    assert.equal(
      readingStoredForShownText(
        '今天天气很好。我们去公园。',
        '今天天气很好。',
        'jīn tiān tiān qì hěn hǎo wǒ men qù gōng yuán'
      ),
      'jīn tiān tiān qì hěn hǎo'
    )
  })
})
