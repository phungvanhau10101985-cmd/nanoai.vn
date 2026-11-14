import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isTransientGeminiError, withTransientGeminiRetry } from '@/lib/ai/gemini-transient'
import { parseLooseJson } from '@/lib/ai/loose-model-json'
import { parseFlashJson } from '@/lib/curriculum/infographic-flash-json'
import { readEssayDraft, readQuizDraft } from '@/lib/worksheet-job/model-draft'

const GUIDE = 'Nhớ cộng từng thành phần tọa độ của hai vectơ.'
const SOLUTION = 'Cộng hoành, tung và cao độ tương ứng. Kết quả là tọa độ vectơ tổng.'

describe('model json that previously failed', () => {
  it('reads a bare quiz array and LaTeX backslashes', () => {
    const raw = `[{"question":"Cho \\\\(\\\\vec{a}\\\\)","options":["(1; 2; 3)","(3; 2; 3)","(1; 8; 3)","(0; 1; 1)"],"correctIndex":0,"thinkingGuide":"${GUIDE}","solution":"${SOLUTION}"}]`
    const broken = raw.replace(/\\\\/g, '\\')
    assert.throws(() => JSON.parse(broken))
    const quiz = readQuizDraft(broken)
    assert.ok(quiz)
    assert.match(quiz.question, /vec/)
    assert.equal(quiz.options.length, 4)
    assert.equal(quiz.correctIndex, 0)
  })

  it('still reads the quizzes object', () => {
    const raw = JSON.stringify({
      quizzes: [
        {
          question: 'Câu chuẩn?',
          options: ['A1', 'B1', 'C1', 'D1'],
          correctIndex: 2,
          thinkingGuide: GUIDE,
          solution: SOLUTION,
        },
      ],
    })
    const quiz = readQuizDraft(raw)
    assert.equal(quiz?.correctIndex, 2)
    assert.equal(quiz?.question, 'Câu chuẩn?')
  })

  it('reads an essay that uses LaTeX escapes', () => {
    const broken = '{"problem":"Tính \\\\(\\\\vec{a}+\\\\vec{b}\\\\)","thinkingGuide":"Cộng từng thành phần.","solution":"Cộng hoành độ rồi tung độ."}'.replace(
      /\\\\/g,
      '\\'
    )
    assert.throws(() => JSON.parse(broken))
    const essay = readEssayDraft(broken)
    assert.match(essay?.problem || '', /vec/)
  })

  it('keeps valid JSON escapes', () => {
    const parsed = parseLooseJson('{"a":"line\\nnext","b":"\\\\vec"}') as { a: string; b: string }
    assert.equal(parsed.a, 'line\nnext')
    assert.equal(parsed.b, '\\vec')
  })

  it('parses a flash summary with a long mermaid hint', () => {
    const mermaid = `flowchart TD\n${'A-->B\n'.repeat(400)}`
    const parsed = parseFlashJson(JSON.stringify({ summary: 'Vectơ tổng', mermaid }))
    assert.equal(parsed.summary, 'Vectơ tổng')
    assert.ok(parsed.mermaid.length <= 2000)
    assert.ok(parsed.mermaid.length > 20)
  })
})

describe('transient Gemini errors', () => {
  it('retries 503 and fetch failed, not a bad draft', async () => {
    assert.equal(
      isTransientGeminiError(
        new Error(
          '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] The service is currently unavailable.'
        )
      ),
      true
    )
    assert.equal(isTransientGeminiError(new Error('fetch failed')), true)
    assert.equal(isTransientGeminiError(new Error('Bad escaped character in JSON at position 61')), false)

    let calls = 0
    const value = await withTransientGeminiRetry(
      async () => {
        calls += 1
        if (calls === 1) throw new Error('[503 Service Unavailable] The service is currently unavailable.')
        return 'ok'
      },
      { delayMs: 0 }
    )
    assert.equal(value, 'ok')
    assert.equal(calls, 2)

    let badCalls = 0
    await assert.rejects(
      () =>
        withTransientGeminiRetry(
          async () => {
            badCalls += 1
            throw new Error('Bad escaped character in JSON at position 61')
          },
          { attempts: 3, delayMs: 0 }
        )
    )
    assert.equal(badCalls, 1)
  })
})
