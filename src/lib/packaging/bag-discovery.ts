import type { WebLocale } from '@/lib/i18n/config'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { getBagStructuralGussetMm } from '@/lib/packaging/bag-dimensions'
import { generateBagNetSvg } from '@/lib/packaging/bag-net-svg'

export const BAG_SIZE_STEP_KEYS = new Set(['bag_size'])

export type BagDiscoveryInputKind =
  | 'chat'
  | 'bag_dimensions'
  | 'bag_panel_confirm'
  | 'print_language_picker'
  | 'style_mood_picker'
  | 'color_palette_picker'
  | 'face_print_style_picker'

export function getBagKitDiscoveryInputKind(
  stepKey: string | null | undefined,
  options?: { reenteringBagSize?: boolean }
): BagDiscoveryInputKind {
  if (!stepKey) return 'chat'
  if (stepKey === 'product_type') return 'print_language_picker'
  if (options?.reenteringBagSize && stepKey === 'bag_panel_confirm') return 'bag_dimensions'
  if (BAG_SIZE_STEP_KEYS.has(stepKey)) return 'bag_dimensions'
  if (stepKey === 'bag_panel_confirm') return 'bag_panel_confirm'
  if (stepKey === 'style_mood') return 'style_mood_picker'
  if (stepKey === 'color_palette') return 'color_palette_picker'
  if (stepKey === 'face_print_style') return 'face_print_style_picker'
  return 'chat'
}

export function buildBagPanelConfirmSummary(locale: WebLocale, dimensionsMm: BagDimensionsMm): string {
  const { width: W, height: H, gusset: D } = dimensionsMm
  const rows = {
    vi: [
      `**Xác nhận túi đựng** — R×C×dày = **${W} × ${H} × ${D} mm**`,
      '',
      '**Mặt in (2 mặt, cùng kích thước):**',
      `- Mặt sau: **${W} × ${H} mm**`,
      `- Mặt trước: **${W} × ${H} mm** (bằng mặt sau)`,
      '',
      `**Chiều dày túi: ${D} mm** — chỉ dùng cho net/ preview 3D, **không in** trên hông túi.`,
      '',
      'Net triển khai (tham khảo) hiển thị bên dưới. Trả lời **OK** để tiếp tục, hoặc nhập lại R×C×dày nếu sai.',
    ],
    en: [
      `**Confirm paper bag** — W×H×depth = **${W} × ${H} × ${D} mm**`,
      '',
      '**Print panels (2 faces, same size):**',
      `- Back: **${W} × ${H} mm**`,
      `- Front: **${W} × ${H} mm** (same as back)`,
      '',
      `**Bag depth: ${D} mm** — structural only for net / 3D preview, **not printed** on gussets.`,
      '',
      'Flat net wireframe shown below. Reply **OK** to continue, or re-enter W×H×depth if wrong.',
    ],
    zh: [
      `**确认纸袋** — 宽×高×厚度 = **${W} × ${H} × ${D} mm**`,
      '',
      `**印刷面（2面，同尺寸）**：背面 ${W}×${H} mm · 正面 ${W}×${H} mm`,
      '',
      `**袋厚 ${D} mm** — 仅用于展开图/3D预览，**不印刷**在侧折上。`,
      '',
      '回复 **OK** 继续，或重新输入尺寸。',
    ],
    ja: [
      `**袋の確認** — 幅×高さ×厚み = **${W} × ${H} × ${D} mm**`,
      '',
      `**印刷面（2面・同サイズ）**：背面 ${W}×${H} mm · 正面 ${W}×${H} mm`,
      '',
      `**袋の厚み ${D} mm** — 展開図/3Dプレビュー用。**ガセットには印刷しません。**`,
      '',
      '**OK** で続行、またはサイズを再入力。',
    ],
    ko: [
      `**가방 확인** — W×H×두께 = **${W} × ${H} × ${D} mm**`,
      '',
      `**인쇄면(2면, 동일 크기)**: 뒷면 ${W}×${H} mm · 앞면 ${W}×${H} mm`,
      '',
      `**가방 두께 ${D} mm** — 전개도/3D 미리보기용. **가셋에는 인쇄하지 않음.**`,
      '',
      '**OK** 로 계속하거나 크기를 다시 입력하세요.',
    ],
  } satisfies Record<WebLocale, string[]>
  return rows[locale].join('\n')
}

export function buildBagWireframeSvg(dimensionsMm: BagDimensionsMm): string {
  const gussetMm = getBagStructuralGussetMm(dimensionsMm)
  return generateBagNetSvg({
    widthMm: dimensionsMm.width,
    heightMm: dimensionsMm.height,
    gussetMm,
  })
}
