import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { applyChosenFoldToThread, isPackagingFaceReEdit, studioMessageOpensBoxFold } from '@/lib/packaging/hub-face-steps'

test('isPackagingFaceReEdit detects committed face artwork', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_left',
    processSteps: [],
    referenceImages: [{ screenKey: 'face_top', screenLabel: 'Top', url: 'https://x/top.png', approvedAt: 1 }],
    briefNotes: {},
    packaging: {
      version: 2,
      dimensionsMm: { length: 200, width: 120, height: 80 },
      faces: {},
      faceSlots: {
        left: { sourceMode: 'generate', url: 'https://x/left.png' },
      },
    },
  }
  assert.equal(isPackagingFaceReEdit(session, 'face_left'), true)
  assert.equal(isPackagingFaceReEdit(session, 'face_front'), false)
})

test('isPackagingFaceReEdit is false before first face commit', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_left',
    processSteps: [],
    referenceImages: [],
    briefNotes: {},
    packaging: {
      version: 2,
      dimensionsMm: { length: 200, width: 120, height: 80 },
      faces: {},
    },
  }
  assert.equal(isPackagingFaceReEdit(session, 'face_left'), false)
})

test('the fold button belongs on the message after the sixth face', () => {
  assert.equal(
    studioMessageOpensBoxFold({
      screenKey: 'face_left',
      showApproveReference: false,
      processSteps: [{ key: 'box_net_2d', status: 'in_progress' }],
    }),
    true
  )
  assert.equal(
    studioMessageOpensBoxFold(
      { screenKey: 'face_left', showApproveReference: false },
      'Đã lưu ảnh tham chiếu cho Mặt bên trái. Tiếp theo: Dàn 2D kiểu gấp'
    ),
    true
  )
  assert.equal(
    studioMessageOpensBoxFold({
      screenKey: 'face_left',
      showApproveReference: true,
      processSteps: [{ key: 'box_net_2d', status: 'in_progress' }],
    }),
    false
  )
  assert.equal(studioMessageOpensBoxFold({ screenKey: 'face_back' }, 'Dàn 2D kiểu gấp'), false)
  assert.equal(
    studioMessageOpensBoxFold(
      null,
      'Đã lưu ảnh tham chiếu cho Mặt bên trái (W×H) — 35×95 mm. Tiếp theo: Dàn 2D kiểu gấp — bạn muốn màn hình này trông như thế nào?'
    ),
    true
  )
  assert.equal(
    studioMessageOpensBoxFold(
      null,
      'Thiết kế hộp carton kỹ thuật từ Logo → dàn 2D chọn kiểu gấp → mockup 3D.'
    ),
    false
  )
})

test('conversation below the fold button follows the saved fold', () => {
  const lines = [
    {
      role: 'assistant',
      content: 'Mở đầu có dàn 2D và kiểu Nắp gài thẳng.',
      studio: null,
    },
    {
      role: 'assistant',
      content:
        'Đã lưu ảnh tham chiếu cho Mặt bên trái (W×H) — 35×95 mm. Tiếp theo: Dàn 2D kiểu gấp — bạn muốn màn hình này trông như thế nào?',
      studio: null,
    },
    {
      role: 'assistant',
      content: 'Đã chốt kiểu **Nắp gài thẳng**. Gõ **tạo mockup 3d**.',
      studio: null,
    },
    {
      role: 'user',
      content: 'Tạo dieline Nắp gài thẳng',
      studio: null,
    },
    {
      role: 'assistant',
      content: 'Đã tạo dieline.',
      studio: {
        screenKey: 'box_dieline_pdf',
        artifactKind: 'pdf' as const,
        artifactUrl: 'https://cdn.example/straight.pdf',
        dielineArtifacts: [
          {
            structure: 'straight_tuck' as const,
            url: 'https://cdn.example/straight.pdf',
            fileName: 'straight.pdf',
            label: 'Nắp gài thẳng',
            downloadLabel: 'Tải Dieline PDF',
          },
        ],
        boxProductionSummary: {
          netWidthMm: 155,
          netHeightMm: 190,
          bleedMm: 3,
        },
      },
    },
    {
      role: 'assistant',
      content: 'Đã lưu mockup.',
      studio: {
        screenKey: 'box_mockup_3d',
        imageUrl: 'https://cdn.example/old-mockup.png',
      },
    },
  ]
  const next = applyChosenFoldToThread(lines, {
    locale: 'vi',
    structure: 'telescope',
    structureVersion: 2,
    dimensionsMm: { length: 95, width: 35, height: 35 },
    mockupUrl: 'https://cdn.example/telescope-mockup.png',
    dielineUrl: 'https://cdn.example/telescope.pdf',
    dielineVariants: {
      telescope: { url: 'https://cdn.example/telescope.pdf', fileName: 'telescope.pdf' },
    },
  })
  assert.match(next[0]!.content, /Nắp gài thẳng/)
  assert.match(next[1]!.content, /Tiếp theo: Dàn 2D/)
  assert.match(next[2]!.content, /Hộp âm dương/)
  assert.doesNotMatch(next[2]!.content, /Nắp gài thẳng/)
  assert.match(next[3]!.content, /Hộp âm dương/)
  assert.equal(next[4]!.studio?.dielineArtifacts?.[0]?.url, 'https://cdn.example/telescope.pdf')
  assert.equal(next[4]!.studio?.dielineArtifacts?.[0]?.label, 'Hộp âm dương')
  assert.equal(next[4]!.studio?.artifactUrl, 'https://cdn.example/telescope.pdf')
  assert.ok((next[4]!.studio?.boxProductionSummary?.netWidthMm ?? 0) !== 155)
  assert.equal(next[5]!.studio?.imageUrl, 'https://cdn.example/telescope-mockup.png')
})
