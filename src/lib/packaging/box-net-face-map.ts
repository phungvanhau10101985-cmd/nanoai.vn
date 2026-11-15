import { BOX_FACE_SLOT_ORDER, type BoxFaceSlot, type FaceSourceMode } from '@/lib/packaging/box-face-slots'

export type BoxNetFaceMap = Partial<Record<BoxFaceSlot, BoxFaceSlot>>

type SlotEntry = { sourceMode: FaceSourceMode; url?: string }

export function normalizeBoxNetFaceMap(raw: unknown): BoxNetFaceMap {
  const out: BoxNetFaceMap = {}
  if (!raw || typeof raw !== 'object') return out
  const record = raw as Record<string, unknown>
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const value = record[slot]
    if (typeof value !== 'string' || value === slot) continue
    if (!BOX_FACE_SLOT_ORDER.includes(value as BoxFaceSlot)) continue
    out[slot] = value as BoxFaceSlot
  }
  return out
}

/** Đặt ảnh của mặt nguồn lên tấm được chọn. Mặt gốc giữ nguyên. */
export function applyBoxNetFaceMap<T extends SlotEntry>(
  faceSlots: Partial<Record<BoxFaceSlot, T>>,
  map: BoxNetFaceMap | undefined
): Partial<Record<BoxFaceSlot, T>> {
  if (!map || Object.keys(map).length === 0) return faceSlots
  const next: Partial<Record<BoxFaceSlot, T>> = { ...faceSlots }
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const source = map[slot]
    if (!source || source === slot) continue
    const from = faceSlots[source]
    if (!from?.url || from.sourceMode === 'empty') {
      next[slot] = { sourceMode: 'empty' } as T
      continue
    }
    next[slot] = { ...from, sourceMode: 'generate', url: from.url }
  }
  return next
}
