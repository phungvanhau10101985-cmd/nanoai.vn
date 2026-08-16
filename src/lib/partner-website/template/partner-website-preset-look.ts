import type { ShopTemplatePresetId } from '@/lib/partner-website/template/shop-template-presets'
import { isShopTemplatePresetId } from '@/lib/partner-website/template/shop-template-presets'

export type PresetLookSwitchPlan =
  | { action: 'restore'; snapshotOutgoing: true }
  | { action: 'generate'; snapshotOutgoing: boolean }

/**
 * When switching shop looks:
 * - Leaving A for B snapshots A, then restores B if that look was saved.
 * - Re-applying the same look generates a fresh template (explicit reset).
 * - First apply (no current preset) generates without a snapshot.
 */
export function planPresetLookSwitch(input: {
  currentPresetId: string | null | undefined
  targetPresetId: string
  hasSavedTargetLook: boolean
}): PresetLookSwitchPlan {
  const current = isShopTemplatePresetId(input.currentPresetId) ? input.currentPresetId : null
  const target = isShopTemplatePresetId(input.targetPresetId) ? input.targetPresetId : null
  if (!target) {
    return { action: 'generate', snapshotOutgoing: Boolean(current) }
  }
  const switching = Boolean(current && current !== target)
  if (switching && input.hasSavedTargetLook) {
    return { action: 'restore', snapshotOutgoing: true }
  }
  return { action: 'generate', snapshotOutgoing: switching }
}

export function presetIdFromTemplateId(templateId: string | null | undefined): ShopTemplatePresetId | null {
  return isShopTemplatePresetId(templateId) ? templateId : null
}
