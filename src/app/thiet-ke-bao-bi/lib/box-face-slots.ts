export type { FaceSizeKey } from './box-face-sizes'
export {
  type BoxFaceSlot,
  type BoxCreatedFace,
  type FaceSourceMode,
  BOX_FACE_SLOT_ORDER,
  BOX_FACE_COPY_SOURCE,
  getSizeKeyForSlot,
  getFaceIndexFromSlot,
  isSecondaryBoxFaceSlot,
  getBoxFaceSlotLabel,
  resolveBoxFaceUrl,
  getStyleReferenceSlotForGenerate,
  migrateLegacyBoxFaces,
  allBoxFaceSlotsFilled,
  getNextBoxFaceSlot,
  resolveDielineFaceUrls,
} from '@/lib/packaging/box-face-slots'
