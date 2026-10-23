'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Vẽ đồ thị bằng GeoGebra Apps API (div), không iframe trang /calculator.
 * Trang calculator trên iOS/iPadOS mở bàn phím toán phủ kín ô visual và không nhận lệnh `command`,
 * nên đồ thị không hiện. Tham số preventFocus + showKeyboardOnFocus chỉ có hiệu lực khi nhúng applet.
 */

type GeoAppName = 'classic' | 'graphing' | 'geometry' | '3d' | 'suite'

export type GeoGebraEmbedSpec = {
  appName: GeoAppName
  materialId: string | null
  commands: string[]
  /** Công thức cần vẽ: chỉ khung đồ thị, không bàn phím. */
  plotMode: boolean
}

type GgbApi = {
  evalCommand: (cmd: string) => boolean
  setPerspective?: (perspective: string) => void
}

type GgbApplet = {
  inject: (elementId: string) => void
  removeExistingApplet?: (parent: HTMLElement | null, showScreenshot: boolean) => void
  resize?: () => void
}

type GgbCtor = new (params: Record<string, unknown>, html5?: boolean) => GgbApplet

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

let ggbLoader: Promise<GgbCtor> | null = null

function loadGgbApplet(): Promise<GgbCtor> {
  const w = window as Window & { GGBApplet?: GgbCtor }
  if (typeof w.GGBApplet === 'function') return Promise.resolve(w.GGBApplet)
  if (!ggbLoader) {
    ggbLoader = new Promise((resolve, reject) => {
      const finish = () => {
        if (typeof w.GGBApplet === 'function') resolve(w.GGBApplet)
        else {
          ggbLoader = null
          reject(new Error('GGBApplet missing'))
        }
      }
      const existing = document.querySelector('script[data-ggb-deploy="1"]')
      if (existing) {
        if (typeof w.GGBApplet === 'function') {
          finish()
          return
        }
        existing.addEventListener('load', finish, { once: true })
        existing.addEventListener(
          'error',
          () => {
            ggbLoader = null
            reject(new Error('deployggb failed'))
          },
          { once: true }
        )
        return
      }
      const script = document.createElement('script')
      script.src = 'https://www.geogebra.org/apps/deployggb.js'
      script.async = true
      script.dataset.ggbDeploy = '1'
      script.onload = finish
      script.onerror = () => {
        ggbLoader = null
        reject(new Error('deployggb failed'))
      }
      document.head.appendChild(script)
    })
  }
  return ggbLoader
}

function splitGeoGebraCommands(command: string): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of command) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ';' && depth === 0) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

function normalizeGeoGebraCommand(cmd: string): string {
  return cmd
    .trim()
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/√([A-Za-z0-9.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/\|([^|]+)\|/g, 'abs($1)')
}

export function parseGeoGebraEmbed(rawInput: string): GeoGebraEmbedSpec {
  const raw = String(rawInput || '').trim()
  const axesOnly: GeoGebraEmbedSpec = { appName: 'classic', materialId: null, commands: [], plotMode: true }
  if (!raw) return axesOnly

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const host = url.hostname.toLowerCase()
      if (host !== 'geogebra.org' && !host.endsWith('.geogebra.org')) return axesOnly
      const command = url.searchParams.get('command')
      const path = url.pathname
      const idMatch = path.match(/\/(?:calculator|classic|graphing|geometry|3d|m)\/([A-Za-z0-9]+)\/?$/)
      const materialId = idMatch?.[1] ?? null
      if (command?.trim()) {
        return {
          appName: 'classic',
          materialId: null,
          commands: splitGeoGebraCommands(command).map(normalizeGeoGebraCommand).filter(Boolean),
          plotMode: true,
        }
      }
      if (materialId) {
        let appName: GeoAppName = 'classic'
        if (path.includes('/graphing/')) appName = 'graphing'
        else if (path.includes('/geometry/')) appName = 'geometry'
        else if (path.includes('/3d/')) appName = '3d'
        else if (path.includes('/calculator/')) appName = 'suite'
        return { appName, materialId, commands: [], plotMode: false }
      }
      return axesOnly
    } catch {
      return axesOnly
    }
  }

  if (/^[A-Za-z0-9]{5,16}$/.test(raw)) {
    return { appName: 'classic', materialId: raw, commands: [], plotMode: false }
  }

  return {
    appName: 'classic',
    materialId: null,
    commands: splitGeoGebraCommands(raw).map(normalizeGeoGebraCommand).filter(Boolean),
    plotMode: true,
  }
}

function textOf(tr: Tr | undefined, vi: string, en: string, zh: string, ja: string, ko: string): string {
  return typeof tr === 'function' ? tr(vi, en, zh, ja, ko) : vi
}

export function GeoGebraApplet({
  urlOrId,
  fill = false,
  height = 350,
  className = '',
  tr,
}: {
  urlOrId: string
  fill?: boolean
  height?: number
  className?: string
  tr?: Tr
}) {
  const reactId = useId().replace(/[^A-Za-z0-9]/g, '')
  const mountId = `ggbMount${reactId}`
  const scaleClass = `ggbHost${reactId}`
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const spec = useMemo(() => parseGeoGebraEmbed(urlOrId), [urlOrId])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'plot-failed'>('loading')

  useEffect(() => {
    const host = hostRef.current
    const mount = mountRef.current
    if (!host || !mount) return
    let cancelled = false
    let started = false
    let applet: GgbApplet | null = null
    setStatus('loading')

    const boot = async (w: number, h: number) => {
      try {
        const Ctor = await loadGgbApplet()
        if (cancelled) return
        const params: Record<string, unknown> = {
          id: mountId,
          appName: spec.appName,
          width: w,
          height: h,
          scaleContainerClass: scaleClass,
          allowUpscale: true,
          autoHeight: false,
          showToolBar: false,
          showMenuBar: false,
          showAlgebraInput: false,
          showResetIcon: false,
          showFullscreenButton: false,
          showZoomButtons: h >= 200,
          enableRightClick: false,
          enableShiftDragZoom: true,
          preventFocus: true,
          showKeyboardOnFocus: spec.plotMode ? false : 'auto',
          errorDialogsActive: false,
          playButton: false,
          borderColor: '#FFFFFF',
          appletOnLoad: (api: GgbApi) => {
            if (cancelled) return
            const runCommands = () => {
              let failed = 0
              for (const cmd of spec.commands) {
                let ok = false
                try {
                  ok = api.evalCommand(cmd) !== false
                } catch {
                  ok = false
                }
                if (!ok) failed += 1
              }
              return failed
            }
            const finish = (failed: number) => {
              if (cancelled) return
              if (spec.commands.length > 0 && failed === spec.commands.length) setStatus('plot-failed')
              else setStatus('ready')
              try {
                applet?.resize?.()
              } catch {
                /* khung vừa có số đo */
              }
            }
            const failed = runCommands()
            if (spec.commands.length > 0 && failed === spec.commands.length) {
              window.setTimeout(() => finish(runCommands()), 500)
              return
            }
            finish(failed)
          },
        }
        if (spec.materialId) params.material_id = spec.materialId
        if (spec.plotMode && !spec.materialId) params.perspective = 'G'
        applet = new Ctor(params, true)
        applet.inject(mountId)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    const onResize = () => {
      if (cancelled) return
      const w = Math.floor(host.clientWidth)
      const h = Math.floor(host.clientHeight)
      if (!started && w >= 48 && h >= 48) {
        started = true
        void boot(w, h)
        return
      }
      if (started) {
        try {
          applet?.resize?.()
        } catch {
          /* applet chưa inject */
        }
      }
    }

    const observer = new ResizeObserver(onResize)
    observer.observe(host)
    onResize()
    const giveUp = window.setTimeout(() => {
      if (!cancelled) setStatus((current) => (current === 'loading' ? 'error' : current))
    }, 25000)

    return () => {
      cancelled = true
      window.clearTimeout(giveUp)
      observer.disconnect()
      try {
        applet?.removeExistingApplet?.(mount, false)
      } catch {
        /* đã gỡ */
      }
      mount.replaceChildren()
    }
  }, [spec, mountId, scaleClass])

  const loadingLabel = textOf(tr, 'Đang vẽ đồ thị…', 'Drawing the graph…', '正在绘制图形…', 'グラフを描いています…', '그래프를 그리는 중…')
  const errorLabel = textOf(
    tr,
    'Không tải được GeoGebra trên thiết bị này.',
    'GeoGebra could not be loaded on this device.',
    '此设备无法加载 GeoGebra。',
    'この端末では GeoGebra を読み込めません。',
    '이 기기에서 GeoGebra를 불러올 수 없습니다.'
  )
  const plotFailedLabel = textOf(
    tr,
    'Công thức chưa vẽ được trên đồ thị.',
    'This formula could not be plotted.',
    '此公式无法绘制成图形。',
    'この式はグラフにできません。',
    '이 수식은 그래프로 그릴 수 없습니다.'
  )

  return (
    <div
      ref={hostRef}
      className={`${scaleClass} relative min-h-0 w-full overflow-hidden bg-white ${fill ? 'h-full min-h-[160px] flex-1' : ''} ${className}`.trim()}
      style={fill ? undefined : { height, minHeight: height }}
    >
      <div ref={mountRef} id={mountId} className="h-full w-full" />
      {status === 'loading' || status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 px-3 text-center text-sm text-white">
          {status === 'loading' ? loadingLabel : errorLabel}
        </div>
      ) : null}
      {status === 'plot-failed' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-xs text-white">
          {plotFailedLabel}
        </div>
      ) : null}
    </div>
  )
}
