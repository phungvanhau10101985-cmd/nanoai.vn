import { fetchPartnerOrderLinesFromPg, type PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerRemarketingIdsByInventoryIdsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { catalogContentId } from '@/lib/messaging/catalog-content-id'

export type OrderCatalogContentItem = {
  content_id: string
  item_name: string
  value: number
  quantity: number
}

/** Content id từng dòng đơn = cột `id` feed (remarketing_id, không thì inventory id). */
export async function loadOrderCatalogContentItems(
  partnerId: string,
  order: Pick<PartnerOrderRow, 'id' | 'product_inventory_id' | 'product_name' | 'unit_price' | 'quantity'>
): Promise<OrderCatalogContentItem[]> {
  const lines = await fetchPartnerOrderLinesFromPg(order.id)
  const sources = lines.length
    ? lines.map((line) => ({
        inventoryId: line.product_inventory_id,
        name: line.product_name,
        value: line.unit_price,
        quantity: line.quantity,
      }))
    : [
        {
          inventoryId: order.product_inventory_id,
          name: order.product_name,
          value: order.unit_price,
          quantity: order.quantity,
        },
      ]
  const map = await fetchPartnerRemarketingIdsByInventoryIdsFromPg(
    partnerId,
    sources.map((source) => String(source.inventoryId || ''))
  )
  const out: OrderCatalogContentItem[] = []
  for (const source of sources) {
    const inventoryId = String(source.inventoryId || '').trim()
    const contentId = catalogContentId({
      remarketingId: inventoryId ? map.get(inventoryId) : '',
      inventoryId,
    })
    if (!contentId) continue
    out.push({
      content_id: contentId,
      item_name: String(source.name || '').trim() || contentId,
      value: Math.max(0, Math.round(Number(source.value) || 0)),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(source.quantity) || 1))),
    })
  }
  return out
}
