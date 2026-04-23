'use client'

/**
 * Thay broadcast realtime hosted: đọc/ghi tín hiệu WebRTC qua Postgres (API + polling).
 * API: GET/POST /api/tao-giao-trinh/screen-live/[code]
 */

/** JSON từ API (WebRTC signaling) — dùng chung cho sharer/viewer. */
export type ScreenLiveSignalPayload = {
  from?: string
  viewerId?: string
  viewer_id?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

type BroadcastPayload = { payload?: ScreenLiveSignalPayload }

type BroadcastHandler = (msg: BroadcastPayload) => void | Promise<void>

const POLL_MS = 200
const FAIL_UNTIL_CHANNEL_ERROR = 8

export class ScreenLiveChannel {
  private readonly roomCode: string
  private readonly handlers = new Map<string, BroadcastHandler[]>()
  private lastId = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false
  private failStreak = 0
  private statusCallback: ((status: string) => void) | null = null

  constructor(roomCode: string) {
    this.roomCode = roomCode
  }

  on(_kind: 'broadcast', filter: { event: string }, handler: BroadcastHandler): this {
    const ev = filter.event
    const list = this.handlers.get(ev) ?? []
    list.push(handler)
    this.handlers.set(ev, list)
    return this
  }

  async send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<void> {
    const res = await fetch(this.apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
      body: JSON.stringify({ event: msg.event, payload: msg.payload }),
    })
    if (!res.ok) {
      this.failStreak++
      if (this.failStreak >= FAIL_UNTIL_CHANNEL_ERROR) {
        this.statusCallback?.('CHANNEL_ERROR')
      }
      throw new Error(await res.text())
    }
    this.failStreak = 0
  }

  subscribe(callback: (status: string) => void): void {
    this.statusCallback = callback
    this.stopped = false
    callback('SUBSCRIBED')
    this.startPoll()
  }

  unsubscribe(): void {
    this.stopped = true
    this.statusCallback = null
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.handlers.clear()
  }

  private apiUrl(): string {
    return `/api/tao-giao-trinh/screen-live/${encodeURIComponent(this.roomCode)}`
  }

  private startPoll(): void {
    if (this.pollTimer) return
    void this.tick()
    this.pollTimer = setInterval(() => void this.tick(), POLL_MS)
  }

  private async tick(): Promise<void> {
    if (this.stopped) return
    try {
      const res = await fetch(`${this.apiUrl()}?after=${this.lastId}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
      })
      if (!res.ok) {
        this.failStreak++
        if (this.failStreak >= FAIL_UNTIL_CHANNEL_ERROR) {
          this.statusCallback?.('CHANNEL_ERROR')
        }
        return
      }
      this.failStreak = 0
      const data = (await res.json()) as {
        signals?: Array<{ id: string; event: string; payload: unknown }>
      }
      for (const sig of data.signals ?? []) {
        const idNum = Number(sig.id)
        if (Number.isFinite(idNum) && idNum > this.lastId) {
          this.lastId = idNum
        }
        const list = this.handlers.get(sig.event)
        if (!list?.length) continue
        for (const h of list) {
          await Promise.resolve(
            h({ payload: sig.payload as ScreenLiveSignalPayload | undefined })
          )
        }
      }
    } catch {
      this.failStreak++
      if (this.failStreak >= FAIL_UNTIL_CHANNEL_ERROR) {
        this.statusCallback?.('CHANNEL_ERROR')
      }
    }
  }
}
