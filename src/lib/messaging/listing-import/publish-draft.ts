import {
  fetchInventoryIdByRemarketingFromPg,
  fetchListingImportDraftFromPg,
  updateListingImportDraftFromPg,
} from '@/lib/db/messaging-partner-listing-import-pg'
import { isListingDraftPublishReady, getListingDraftPublishBlockers } from '@/lib/messaging/listing-import/listing-draft-publish-validation'
import { productDataToInventoryExcelInsert } from '@/lib/messaging/listing-import/product-data-to-inventory'
import { upsertPartnerInventoryBatch } from '@/lib/messaging/partner-inventory-upsert-batch'

export async function publishListingImportDraft(input: {
  partnerId: string
  draftId: string
}): Promise<{
  success: true
  action: 'created' | 'updated'
  product_id: string
  inventory_id: string
}> {
  const draft = await fetchListingImportDraftFromPg(input.partnerId, input.draftId)
  if (!draft) {
    throw Object.assign(new Error('Không tìm thấy draft.'), { status: 404 })
  }
  const pd = (draft.product_data || {}) as Record<string, unknown>
  if (!isListingDraftPublishReady(pd)) {
    const blockers = getListingDraftPublishBlockers(pd)
    throw Object.assign(new Error(blockers[0] || 'Nháp chưa đủ dữ liệu để đăng.'), {
      status: 400,
      blockers,
    })
  }
  const row = productDataToInventoryExcelInsert(pd)
  if (!row) {
    throw Object.assign(new Error('product_data thiếu tên hoặc product_id.'), { status: 400 })
  }
  const existingId = await fetchInventoryIdByRemarketingFromPg(input.partnerId, row.remarketing_id)
  const upserted = await upsertPartnerInventoryBatch(input.partnerId, [row], { deferEmbeddings: true })
  if (!upserted.ok) {
    throw Object.assign(new Error(upserted.error), { status: 500 })
  }
  const inventoryId =
    (await fetchInventoryIdByRemarketingFromPg(input.partnerId, row.remarketing_id)) || existingId
  if (!inventoryId) {
    throw Object.assign(new Error('Đã ghi kho nhưng không đọc lại được id tồn kho.'), { status: 500 })
  }
  await updateListingImportDraftFromPg(input.partnerId, draft.id, {
    status: 'published',
    publishedInventoryId: inventoryId,
    message: 'Đã đăng lên kho.',
    finished: true,
  })
  return {
    success: true,
    action: existingId ? 'updated' : 'created',
    product_id: row.remarketing_id,
    inventory_id: inventoryId,
  }
}
