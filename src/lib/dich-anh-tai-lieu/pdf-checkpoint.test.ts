import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { finishedPdfPages, pdfCheckpointLikePattern, pdfCheckpointObjectPath, planPdfCheckpoint, type CheckpointRow } from './pdf-checkpoint'
import { pdfPageNumberFromUrl } from './pdf-page-selection'

const HASH = 'ab'.repeat(16)

function row(partial: Partial<CheckpointRow> & Pick<CheckpointRow, 'page' | 'historyStatus' | 'jobStatus'>): CheckpointRow {
  return {
    historyId: partial.historyId ?? `h-${partial.page}`,
    jobId: partial.jobId === undefined ? `j-${partial.page}` : partial.jobId,
    batchId: partial.batchId ?? 'batch-1',
    page: partial.page,
    historyStatus: partial.historyStatus,
    jobStatus: partial.jobStatus,
    hasResult: partial.hasResult ?? false,
    createdAt: partial.createdAt ?? `2026-11-14T00:00:${String(partial.page).padStart(2, '0')}Z`,
    processingFresh: partial.processingFresh ?? false,
  }
}

describe('planPdfCheckpoint', () => {
  it('keeps a finished page and continues from the failed page', () => {
    const plan = planPdfCheckpoint(
      [1, 2, 3],
      [
        row({ page: 1, historyStatus: 'completed', jobStatus: 'completed', hasResult: true }),
        row({ page: 2, historyStatus: 'failed', jobStatus: 'failed' }),
        row({ page: 3, historyStatus: 'processing', jobStatus: 'paused' }),
      ]
    )
    assert.deepEqual(plan.skip, [1])
    assert.deepEqual(plan.requeue.map((item) => item.page), [2, 3])
    assert.deepEqual(plan.create, [])
    assert.equal(plan.batchId, 'batch-1')
  })

  it('does not redo a finished page when an older failed row exists', () => {
    const plan = planPdfCheckpoint(
      [4],
      [
        row({ page: 4, historyStatus: 'failed', jobStatus: 'failed', createdAt: '2026-11-14T00:00:01Z', historyId: 'old' }),
        row({
          page: 4,
          historyStatus: 'completed',
          jobStatus: 'completed',
          hasResult: true,
          createdAt: '2026-11-14T00:00:02Z',
          historyId: 'new',
        }),
      ]
    )
    assert.deepEqual(plan.skip, [4])
    assert.deepEqual(plan.requeue, [])
  })

  it('leaves a live page alone and requeues a stale one', () => {
    const plan = planPdfCheckpoint(
      [1, 2],
      [
        row({ page: 1, historyStatus: 'processing', jobStatus: 'processing', processingFresh: true }),
        row({ page: 2, historyStatus: 'processing', jobStatus: 'processing', processingFresh: false }),
      ]
    )
    assert.deepEqual(plan.keep, [1])
    assert.deepEqual(plan.requeue.map((item) => item.page), [2])
  })

  it('creates a page that has no saved row and reuses the latest batch', () => {
    const plan = planPdfCheckpoint(
      [1, 2],
      [row({ page: 1, historyStatus: 'completed', jobStatus: 'completed', hasResult: true, batchId: 'batch-old', createdAt: '2026-11-14T00:00:01Z' })]
    )
    assert.equal(plan.batchId, 'batch-old')
    assert.deepEqual(plan.create, [2])
  })

  it('reads the page number from the checkpoint path', () => {
    const path = pdfCheckpointObjectPath('user-1', HASH, 11)
    assert.equal(pdfPageNumberFromUrl(`https://cdn.example/${path}`), 12)
    assert.equal(pdfCheckpointLikePattern(HASH), `%/pdf-checkpoint/${HASH}/src_page_%`)
  })

  it('lists finished pages once', () => {
    assert.deepEqual(
      finishedPdfPages([
        { page: 2, historyStatus: 'completed', hasResult: true },
        { page: 2, historyStatus: 'completed', hasResult: true },
        { page: 3, historyStatus: 'failed', hasResult: false },
      ]),
      [2]
    )
  })
})
