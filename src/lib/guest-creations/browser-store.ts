'use client'

import type { GuestCreationRefs } from '@/lib/guest-creations/extract-guest-creation'

const DB_NAME = 'nanoai-guest-creations'
const STORE = 'items'
const MAX_ITEMS = 200

export type GuestCreationRecord = {
  id: string
  createdAt: number
  route: string
  feature: string
  resultUrls: string[]
  refs: GuestCreationRefs
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function guestCreationRecordId(input: Pick<GuestCreationRecord, 'resultUrls' | 'refs' | 'route'>): string {
  const key = `${input.route}|${input.resultUrls.slice().sort().join('|')}|${JSON.stringify(input.refs)}`
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `g${(hash >>> 0).toString(16)}`
}

export async function saveGuestCreation(record: GuestCreationRecord): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    const all = await listGuestCreations()
    if (all.length <= MAX_ITEMS) return
    const extra = all.slice(MAX_ITEMS)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const row of extra) store.delete(row.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function listGuestCreations(): Promise<GuestCreationRecord[]> {
  const db = await openDb()
  try {
    const rows = await new Promise<GuestCreationRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result || []) as GuestCreationRecord[])
      req.onerror = () => reject(req.error)
    })
    return rows.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    db.close()
  }
}

export async function deleteGuestCreations(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of ids) store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
