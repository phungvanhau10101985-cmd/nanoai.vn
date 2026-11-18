import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { BoxDielineStructure } from '@/lib/packaging/dieline-structure'
import type { TuckEndArtworkPanel, TuckEndLayoutData } from '@/lib/packaging/box-net-svg'

export type PanelRotation = 0 | 90 | 180 | 270

/**
 * Góc xoay hình trên file in.
 * 180° lật đúng với mặt nằm dưới bản lề.
 * 90° và 270° là góc ngược lại với góc gấp, để thành bên nằm ngang trên tờ
 * mà chữ vẫn đứng khi dựng, và mockup cộng hai góc ra 0.
 */
export function dielineArtworkRotation(
  structure: BoxDielineStructure,
  slot: BoxFaceSlot
): PanelRotation {
  const turn = foldTurnDegrees(structure, slot)
  if (turn === 90) return 270
  if (turn === 270) return 90
  return turn === 180 ? 180 : 0
}

/**
 * Góc mặt bị xoay khi gấp khỏi tờ trải, suy từ kiểu hộp chứ không từ ảnh.
 * Cộng với góc xoay trên dieline thì ra 0: mockup 3D đọc đúng.
 */
export function foldTurnDegrees(structure: BoxDielineStructure, slot: BoxFaceSlot): PanelRotation {
  const key = `${structure}:${slot}`
  const table: Record<string, PanelRotation> = {
    'reverse_tuck:bottom': 180,
    'straight_tuck:bottom': 180,
    'cross_fold:back': 180,
    'cross_fold:bottom': 180,
    'window:bottom': 180,
    'handle:bottom': 180,
    'bottle:bottom': 180,
    'hexagon:bottom': 180,
    'octagon:bottom': 180,
    'tray:front': 180,
    'tray:left': 90,
    'tray:right': 270,
    'telescope:front': 180,
    'telescope:left': 90,
    'telescope:right': 270,
    'magnetic:front': 180,
    'magnetic:left': 90,
    'magnetic:right': 270,
    'pillow:front': 270,
    'pillow:back': 90,
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
    return 90
  }
  if (slot === 'top' && front && near(panel.y + panel.h, front.y) && near(panel.x, front.x)) return 0
  if (slot === 'top' && back && near(panel.y + panel.h, back.y) && near(panel.x, back.x)) return 0
  if (slot === 'front' && (structure === 'tray' || structure === 'telescope' || structure === 'magnetic')) return 180
  if (slot === 'bottom' && (structure === 'tray' || structure === 'telescope' || structure === 'magnetic')) return 0
  if (slot === 'bottom' && back && near(panel.y, back.y + back.h) && near(panel.x, back.x)) return 180
  if (slot === 'bottom' && front && near(panel.y, front.y + front.h) && near(panel.x, front.x)) return 180
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
