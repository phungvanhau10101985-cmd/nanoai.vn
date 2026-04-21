import { enqueueHospitalityPmsSyncJobPg } from '@/lib/db/hospitality-pg'

export type PmsEntityType = 'room' | 'rate' | 'booking' | 'payment'

export type PmsSyncPayload = {
  entity_type: PmsEntityType
  entity_id: string
  payload: Record<string, unknown>
}

export type PmsConnector = {
  key: string
  push: (partnerId: string, data: PmsSyncPayload) => Promise<boolean>
  pull: (partnerId: string, entityType: PmsEntityType) => Promise<boolean>
}

const genericOtherConnector: PmsConnector = {
  key: 'other',
  async push(partnerId, data) {
    return enqueueHospitalityPmsSyncJobPg({
      partner_id: partnerId,
      connector_key: 'other',
      direction: 'push',
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      payload: data.payload,
    })
  },
  async pull(partnerId, entityType) {
    return enqueueHospitalityPmsSyncJobPg({
      partner_id: partnerId,
      connector_key: 'other',
      direction: 'pull',
      entity_type: entityType,
      payload: {},
    })
  },
}

const connectors = new Map<string, PmsConnector>([['other', genericOtherConnector]])

export function registerPmsConnector(connector: PmsConnector): void {
  connectors.set(connector.key, connector)
}

export function resolvePmsConnector(key: string | null | undefined): PmsConnector {
  const normalized = String(key ?? '').trim().toLowerCase()
  return connectors.get(normalized) ?? genericOtherConnector
}
