import type { BoxFaceSlot, FaceSourceMode } from '@/lib/packaging/box-face-slots'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'

/** Sample from Desktop `box-mockup-400x200x200mm.html` — Vitamin C + B5 serum box. */
export const THIET_KE_BAO_BI_ARTICLE_MOCKUP: {
  dimensionsMm: BoxDimensionsMm
  faceSlots: Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url: string }>>
} = {
  dimensionsMm: { length: 400, width: 200, height: 200 },
  faceSlots: {
    top: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/uploads/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_upload_1784361331249_0.png',
    },
    front: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_packaging_face_1784361541064.png',
    },
    right: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_packaging_face_1784361636617.png',
    },
    bottom: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_packaging_face_1784361972899.png',
    },
    back: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_packaging_face_1784362526645.png',
    },
    left: {
      sourceMode: 'generate',
      url: 'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/studio_packaging_face_1784363133309.png',
    },
  },
}
