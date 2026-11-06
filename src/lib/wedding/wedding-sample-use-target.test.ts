import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_PENDING_SAMPLE_KEY,
  clearPendingWeddingSampleUse,
  readPendingWeddingSampleUse,
  weddingEditorReturnPath,
  weddingGuestSampleLoginPath,
  weddingSampleEditorPath,
  weddingSampleUseTarget,
  type WeddingSampleUseStorage,
} from './wedding-sample-use-target'

function memoryStorage(): WeddingSampleUseStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

test('a guest using a demo sample is sent to login and back to that sample', () => {
  const next = '/tao-thiep-moi-cuoi-ai?useSample=hong-ngoc-trai&askNames=1'
  const target = weddingSampleUseTarget({ sampleId: 'hong-ngoc-trai', signedIn: false, cardId: 'other-card' })
  assert.equal(target, `/auth/login?next=${encodeURIComponent(next)}`)
  assert.equal(weddingGuestSampleLoginPath('hong-ngoc-trai'), target)
})

test('a signed-in guest keeps the open card and opens the editor', () => {
  assert.equal(
    weddingSampleUseTarget({ sampleId: 'hong-ngoc-trai', signedIn: true, cardId: 'card-1' }),
    '/tao-thiep-moi-cuoi-ai?cardId=card-1&useSample=hong-ngoc-trai',
  )
})

test('a sample card id is not opened as a saved card', () => {
  const saved = '831ef781-2883-4ac9-8c79-d884348b4943'
  assert.equal(
    weddingSampleUseTarget({ sampleId: 'hong-ngoc-trai', signedIn: true, cardId: 'sample:vuon-kinh-hong' }),
    '/tao-thiep-moi-cuoi-ai?useSample=hong-ngoc-trai',
  )
  assert.equal(
    weddingEditorReturnPath('sample:vuon-kinh-hong', `?cardId=${saved}&occasion=wedding`),
    `/tao-thiep-moi-cuoi-ai?cardId=${saved}`,
  )
  assert.equal(weddingEditorReturnPath('sample:vuon-kinh-hong', '?cardId=sample:vuon-kinh-hong'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(weddingEditorReturnPath(saved), `/tao-thiep-moi-cuoi-ai?cardId=${saved}`)
})

test('an unknown sample does not build a login link', () => {
  assert.equal(weddingSampleEditorPath('not-a-sample'), null)
  assert.equal(weddingSampleUseTarget({ sampleId: 'not-a-sample', signedIn: false }), null)
})

test('the chosen sample survives after the query is removed', () => {
  const storage = memoryStorage()
  assert.deepEqual(readPendingWeddingSampleUse('?useSample=hong-ngoc-trai&askNames=1', storage), {
    id: 'hong-ngoc-trai',
    askNames: true,
  })
  assert.equal(storage.getItem(WEDDING_PENDING_SAMPLE_KEY), 'hong-ngoc-trai')
  assert.deepEqual(readPendingWeddingSampleUse('', storage), { id: 'hong-ngoc-trai', askNames: true })
  clearPendingWeddingSampleUse(storage)
  assert.deepEqual(readPendingWeddingSampleUse('', storage), { id: '', askNames: false })
})
