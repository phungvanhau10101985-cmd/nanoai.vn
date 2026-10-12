export const HUB_HISTORY_OPEN_THREAD_EVENT = 'nanoai:hub-history-open-thread'
export const HUB_HISTORY_THREAD_DELETED_EVENT = 'nanoai:hub-history-thread-deleted'

export type HubHistoryThreadDetail = { threadId: string }

export function dispatchHubHistoryOpenThread(threadId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<HubHistoryThreadDetail>(HUB_HISTORY_OPEN_THREAD_EVENT, { detail: { threadId } }))
}

export function dispatchHubHistoryThreadDeleted(threadId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<HubHistoryThreadDetail>(HUB_HISTORY_THREAD_DELETED_EVENT, { detail: { threadId } })
  )
}
