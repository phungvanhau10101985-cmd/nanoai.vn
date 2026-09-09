export type EmsSyncStatus =
  | 'matched'
  | 'in_progress'
  | 'mismatch'
  | 'unlinked'
  | 'order_not_found'
  | 'ems_not_found'
  | 'parse_error'
  | 'pending'

export type EmsPhase =
  | 'posted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cod_collected'
  | 'cod_settled'
  | 'unknown'

export type OpsBucketKey =
  | 'total'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'pending'
  | 'has_cod'
  | 'cod_in_transit_unpaid'
  | 'cod_delivered_unpaid'
  | 'cod_paid'
  | 'cod_received_in_period'
  | 'cod_returned_unpaid'
  | 'cod_pending_unpaid'
  | 'freight_unsettled'
  | 'shop_linked'
  | 'shop_return_received'
  | 'shop_shipping'

export type ReceivedOpsBucketKey = 'cod_received_in_period' | 'shop_return_received'

export type TimelineGranularity = 'year' | 'month' | 'week' | 'day'
export type TimelinePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month'

export type PartnerEmsRecord = {
  id: string
  partner_id: string
  reference_code: string
  product_code: string | null
  recipient_label: string | null
  order_code: string | null
  order_id: string | null
  excel_row_number: number | null
  order_status: string | null
  shop_return_received_at: string | null
  current_step_key: string | null
  tracking_number_saved: string | null
  ems_tracking_code: string | null
  ems_reference_code: string | null
  ems_status: string | null
  ems_phase: string | null
  sync_status: EmsSyncStatus
  sync_message: string | null
  ems_error: string | null
  cod_amount: number | null
  cod_paid_amount: number | null
  cod_paid_date: string | null
  cod_settlement_status: string | null
  cod_settlement_message: string | null
  freight_amount: number | null
  freight_settled_at: string | null
  freight_settlement_status: string | null
  freight_settlement_message: string | null
  freight_high_fee_warning: string | null
  import_source_filename: string | null
  created_at: string
  updated_at: string
  shop_order_status?: string | null
  shop_customer_phone?: string | null
  shop_customer_name?: string | null
  return_to_shop_label?: string | null
}

export type PartnerEmsListRow = PartnerEmsRecord & {
  row_number?: number | null
  import_action?: 'created' | 'updated' | null
}

export type EmsImportSummary = {
  total_rows: number
  matched: number
  in_progress: number
  mismatch: number
  unlinked: number
  order_not_found: number
  ems_not_found: number
  parse_error: number
  total_cod_amount: number
  breakdown: Array<{ key: string; count: number; cod_total: number }>
}

export type EmsTrackingEvent = {
  status_code: number | null
  description: string
  address: string | null
  traced_at: string | null
}

export type EmsTrackingPayload = {
  available: boolean
  tracking_code?: string | null
  reference_code?: string | null
  current_status?: number | null
  current_status_description?: string | null
  events: EmsTrackingEvent[]
  error?: string | null
}
