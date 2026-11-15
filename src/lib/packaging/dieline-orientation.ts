import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { BoxDielineStructure } from '@/lib/packaging/dieline-structure'
import type { TuckEndArtworkPanel, TuckEndLayoutData } from '@/lib/packaging/box-net-svg'

export type PanelRotation = 0 | 90 | 180 | 270

/**
 * Góc xoay hình trên dieline để sau khi gấp mặt đọc đúng.
 * 180° nghĩa là nắp (hoặc mặt sau chữ thập) phải xoay trên file in.
 */
export function dielineArtworkRotation(
  structure: BoxDielineStructure,
  slot: BoxFaceSlot
): PanelRotation {
  const turn = foldTurnDegrees(structure, slot)
  if (turn === 90 || turn === 180 || turn === 270) return turn
  return 0
}

/**
 * Góc mặt bị xoay khi gấp khỏi tờ trải, suy từ kiểu hộp chứ không từ ảnh.
 * Cộng với góc xoay trên dieline thì ra 0: mockup 3D đọc đúng.
 */
export function foldTurnDegrees(structure: BoxDielineStructure, slot: BoxFaceSlot): PanelRotation {
  const key = `${structure}:${slot}`
  const table: Record<string, PanelRotation> = {
    'reverse_tuck:top': 180,
    'reverse_tuck:bottom': 180,
    'straight_tuck:top': 180,
    'straight_tuck:bottom': 0,
    'cross_fold:top': 180,
    'cross_fold:back': 180,
    'cross_fold:bottom': 0,
    'crash_lock:top': 180,
    'snap_lock:top': 180,
    'window:top': 180,
    'window:bottom': 180,
    'handle:top': 180,
    'handle:bottom': 180,
    'bottle:top': 180,
    'bottle:bottom': 180,
    'hexagon:top': 180,
    'hexagon:bottom': 180,
    'octagon:top': 180,
    'octagon:bottom': 180,
    'telescope:top': 180,
    'magnetic:top': 180,
    'magnetic:bottom': 180,
    'pillow:back': 180,
  }
  return table[key] ?? 0
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1.25
}

/** Đo chiều gấp từ vị trí tấm trên tờ trải. Không đoán được thì trả null. */
export function measuredFoldTurn(
  layout: Pick<TuckEndLayoutData, 'panels'>,
  structure: BoxDielineStructure,
  panel: TuckEndArtworkPanel
): PanelRotation | null {
  const slot = panel.slot
  const front = layout.panels.find((item) => item.slot === 'front')
  const back = layout.panels.find((item) => item.slot === 'back')
  if (slot === 'back' && structure === 'cross_fold') return 180
  if (
    slot === 'back' &&
    structure === 'pillow' &&
    front &&
    near(panel.y, front.y + front.h) &&
    near(panel.x, front.x)
  ) {
    return 180
  }
  if (slot === 'top' && front && near(panel.y + panel.h, front.y) && near(panel.x, front.x)) return 180
  if (slot === 'top' && back && near(panel.y + panel.h, back.y) && near(panel.x, back.x)) return 180
  if (slot === 'bottom' && structure === 'tray') return 0
  if (slot === 'bottom' && back && near(panel.y, back.y + back.h) && near(panel.x, back.x)) return 180
  if (slot === 'bottom' && front && near(panel.y, front.y + front.h) && near(panel.x, front.x)) return 0
  if (slot === 'bottom' && structure === 'cross_fold' && front && near(panel.y, front.y + front.h)) return 0
  return null
}

export function layoutFoldOrientationOk(
  structure: BoxDielineStructure,
  layout: Pick<TuckEndLayoutData, 'panels'>
): boolean {
  return layout.panels.every((panel) => {
    const measured = measuredFoldTurn(layout, structure, panel)
    const rotation = panel.rotation ?? 0
    if ((panel.rotation ?? 0) !== dielineArtworkRotation(structure, panel.slot)) return false
    if (measured == null) return true
    return (measured + rotation) % 360 === 0
  })
}
