/** CPU và RAM của cả máy. Việc ẩn chỉ lấy máy khi cả hai còn dưới 85%. */

import { cpus, freemem, loadavg, totalmem } from 'node:os'
import { readFileSync } from 'node:fs'

export const SHOP_HOST_CPU_LIMIT_PCT = 85
export const SHOP_HOST_RAM_LIMIT_PCT = 85

type CpuSnap = { idle: number; total: number }

let cpuPct: number | null = null
let lastSnap: CpuSnap | null = null
let timer: ReturnType<typeof setInterval> | null = null
let lastLogAt = 0
let lastBlocked = false

function readCpuSnap(): CpuSnap | null {
  try {
    const line = readFileSync('/proc/stat', 'utf8').split('\n')[0] || ''
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    if (parts.length >= 4 && parts.every((n) => Number.isFinite(n))) {
      const idle = parts[3] + (parts[4] || 0)
      const total = parts.reduce((sum, n) => sum + n, 0)
      if (total > 0) return { idle, total }
    }
  } catch {
    /* Windows và máy không có /proc */
  }
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    const times = cpu.times
    idle += times.idle
    total += times.user + times.nice + times.sys + times.idle + times.irq
  }
  if (total <= 0) return null
  return { idle, total }
}

function noteCpu(snap: CpuSnap | null) {
  if (!snap) return
  if (lastSnap && snap.total > lastSnap.total) {
    const idleDelta = snap.idle - lastSnap.idle
    const totalDelta = snap.total - lastSnap.total
    cpuPct = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100))
  }
  lastSnap = snap
}

/** Phần trăm RAM đã dùng theo MemAvailable. 85% nghĩa là còn 15% trống. */
export function shopHostRamUsedPct(): number | null {
  try {
    const text = readFileSync('/proc/meminfo', 'utf8')
    const total = Number(text.match(/^MemTotal:\s+(\d+)/m)?.[1] || 0)
    const available = Number(text.match(/^MemAvailable:\s+(\d+)/m)?.[1] || 0)
    if (total > 0 && available >= 0) {
      return Math.max(0, Math.min(100, (1 - available / total) * 100))
    }
  } catch {
    /* fallback */
  }
  const total = totalmem()
  const free = freemem()
  if (total <= 0) return null
  return Math.max(0, Math.min(100, (1 - free / total) * 100))
}

function sampleCpu() {
  noteCpu(readCpuSnap())
}

export async function primeShopHostPressure(): Promise<void> {
  sampleCpu()
  await new Promise((resolve) => setTimeout(resolve, 1000))
  sampleCpu()
  if (!timer) {
    timer = setInterval(sampleCpu, 5000)
    timer.unref?.()
  }
}

export function shopHostPressure(): {
  cpuPct: number | null
  ramPct: number | null
  blocked: boolean
} {
  if (!timer) {
    sampleCpu()
    timer = setInterval(sampleCpu, 5000)
    timer.unref?.()
  }
  const ramPct = shopHostRamUsedPct()
  let cpu = cpuPct
  if (cpu == null) {
    const cores = Math.max(1, cpus().length)
    const load = loadavg()[0]
    if (load > 0) cpu = Math.min(100, (load / cores) * 100)
  }
  const blocked =
    (cpu != null && cpu >= SHOP_HOST_CPU_LIMIT_PCT) ||
    (ramPct != null && ramPct >= SHOP_HOST_RAM_LIMIT_PCT)
  const now = Date.now()
  if (blocked !== lastBlocked || (blocked && now - lastLogAt > 60_000)) {
    lastBlocked = blocked
    lastLogAt = now
    const cpuText = cpu == null ? '?' : String(Math.round(cpu))
    const ramText = ramPct == null ? '?' : String(Math.round(ramPct))
    console.log(
      `[shop-cron] host ${blocked ? 'full' : 'ok'} cpu=${cpuText}% ram=${ramText}% limit=${SHOP_HOST_CPU_LIMIT_PCT}`
    )
  }
  return { cpuPct: cpu, ramPct, blocked }
}

export function shopHostBlocksBackground(): boolean {
  return shopHostPressure().blocked
}
