/**
 * Ảnh không mã — đọc chữ trước (OCR); vector: ≥ 86% khóa mẫu, dưới 86% thì 36 thẻ.
 * Chạy: npx tsx scripts/test-partner-ai-photo-item-consult.ts
 */
import assert from 'node:assert/strict'
import {
  captionLooksLikeConsultThisPhotoItem,
  findLatestLockedVisionTop,
  inboundTextLooksLikeAskSkuOfThisPhotoItem,
  inboundTextLooksLikeConsultThisPhotoItem,
  lockedVisionTopFromRaw,
  PHOTO_ITEM_LOCK_MIN_SCORE,
  shouldLockTopVisionMatch,
  visionAutoLockedFromRaw,
} from '../src/lib/messaging/partner-ai-photo-item-consult'
import { rawPayloadHasInboundProductPageContext } from '../src/lib/messaging/partner-ai-llm'

function main() {
  assert.equal(PHOTO_ITEM_LOCK_MIN_SCORE, 0.86)
  assert.equal(captionLooksLikeConsultThisPhotoItem('aao thun det kim màu đen .,măc mua hè nóng ko'), true)
  assert.equal(inboundTextLooksLikeConsultThisPhotoItem('áo mình chọn trên mùa hè mặc nóng ko'), true)
  assert.equal(captionLooksLikeConsultThisPhotoItem('xin chao 188'), false)
  assert.equal(inboundTextLooksLikeAskSkuOfThisPhotoItem('Mã sp mẫu này'), true)
  assert.equal(inboundTextLooksLikeAskSkuOfThisPhotoItem('Ma san pham mau nay'), true)
  assert.equal(inboundTextLooksLikeConsultThisPhotoItem('Mã sp mẫu này'), true)
  assert.equal(inboundTextLooksLikeAskSkuOfThisPhotoItem('DH493 gửi chưa'), false)

  /** Tung le: 0.91 ≥ 86% → khóa, không cần gap với #2. */
  assert.equal(shouldLockTopVisionMatch({ topScore: 0.91 }), true)
  assert.equal(shouldLockTopVisionMatch({ topScore: 0.86 }), true)
  assert.equal(shouldLockTopVisionMatch({ topScore: 0.859 }), false)
  assert.equal(shouldLockTopVisionMatch({ topScore: 0.8 }), false)
  assert.equal(shouldLockTopVisionMatch({ topScore: null }), false)

  const lockedPayload = {
    vision_auto_selected: true,
    vision_selected_inventory_id: '12bb6781-cc53-4532-be92-203b8bd7c4a2',
    page_context: {
      sku: 'B6632',
      inventory_id: '12bb6781-cc53-4532-be92-203b8bd7c4a2',
      source: 'image_visual_lock',
    },
  }
  assert.equal(visionAutoLockedFromRaw(lockedPayload), true)
  assert.equal(lockedVisionTopFromRaw(lockedPayload)?.sku, 'B6632')
  assert.equal(rawPayloadHasInboundProductPageContext(lockedPayload), true)

  const pick36 = {
    vision_pick_required: true,
    vision_candidates: [
      { inventoryId: '12bb6781-cc53-4532-be92-203b8bd7c4a2', sku: 'B6632', score: 0.8 },
    ],
  }
  assert.equal(visionAutoLockedFromRaw(pick36), false)
  assert.equal(
    findLatestLockedVisionTop([{ raw_payload: pick36 }, { raw_payload: lockedPayload }])?.sku,
    'B6632'
  )
  assert.equal(findLatestLockedVisionTop([{ raw_payload: pick36 }]), null)

  const nearestLegacy = {
    page_context: {
      sku: 'B6632',
      inventory_id: '12bb6781-cc53-4532-be92-203b8bd7c4a2',
      source: 'image_nearest_visual',
    },
  }
  assert.equal(rawPayloadHasInboundProductPageContext(nearestLegacy), false)

  console.log('OK partner-ai-photo-item-consult')
}

main()
