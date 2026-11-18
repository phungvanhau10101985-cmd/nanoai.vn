'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, Minus, Plus } from 'lucide-react'
import { PackagingBoxMockup3D } from '@/components/hub-chat/packaging-box-mockup-3d'
import type { WebLocale } from '@/lib/i18n/config'
import { saveHubThreadId } from '@/lib/hub-chat/hub-chat-prefill'
import {
  BOX_FACE_SLOT_ORDER,
  getBoxFaceSlotDimensionsMm,
  getBoxFaceSlotLabel,
  resolveMockupSlotUrl,
  type BoxFaceSlot,
  type FaceSourceMode,
} from '@/lib/packaging/box-face-slots'
import { getBoxDielineLayoutData, type TuckEndLayoutData } from '@/lib/packaging/box-net-svg'
import { dielineDisplayBounds } from '@/lib/packaging/dieline-sheet-bounds'
import { applyBoxNetFaceMap, type BoxNetFaceMap } from '@/lib/packaging/box-net-face-map'
import {
  BOX_DIELINE_GROUPS,
  boxDielineGroupLabel,
  boxDielineStructureCopy,
  resolveBoxDielineStructure,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { PAPER_STOCK_IDS, type PaperStockId } from '@/lib/packaging/paper-stock'
import {
  defaultTuckBoxProductionParams,
  normalizeTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'

type FaceSlots = Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>

type LoadedBox = {
  dimensions: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  structure: BoxDielineStructure
  production?: TuckBoxProductionParams
  faceMap: BoxNetFaceMap
}

type Copy = {
  title: string
  back: string
  save: string
  saving: string
  saved: string
  faces: string
  pickPanel: string
  armed: string
  cut: string
  fold: string
  open: string
  close: string
  outside: string
  inside: string
  color: string
  colorHint: string
  paper: string
  glue: string
  notch: string
  cols: string
  rows: string
  jar: string
  neck: string
  sheet: string
  note: string
  loading: string
  login: string
  loginAction: string
  missing: string
  notFound: string
  wrong: string
  saveFailed: string
  downloadMockup: string
  downloadDieline: string
  downloading: string
  downloadFailed: string
  paperNames: Record<PaperStockId, string>
}

const COPY: Record<WebLocale, Copy> = {
  vi: {
    title: 'Dàn trang hộp',
    back: 'Về chat',
    save: 'Lưu',
    saving: 'Đang lưu',
    saved: 'Đã lưu.',
    faces: 'Ảnh 6 mặt',
    pickPanel: 'Bấm một tấm trên tờ trải, rồi bấm ảnh bên trái để đặt ảnh đó.',
    armed: 'Đã chọn ảnh. Bấm một tấm trên tờ trải để đặt ảnh.',
    cut: 'Cắt',
    fold: 'Gấp',
    open: 'Mở',
    close: 'Đóng',
    outside: 'Mặt ngoài',
    inside: 'Mặt trong',
    color: 'Màu bìa',
    colorHint: 'Chỉ tô chỗ chưa có ảnh. Không đổi file in.',
    paper: 'Giấy',
    glue: 'Tai dán (mm)',
    notch: 'Khoét ngón tay',
    cols: 'Cột khay',
    rows: 'Hàng khay',
    jar: 'Đường kính hũ (mm)',
    neck: 'Đường kính nắp chai (mm)',
    sheet: 'Tờ',
    note: 'Chọn kiểu gấp thì tờ trải đổi ngay. Khung bên phải dựng theo kiểu: lục giác, bát giác, ống tròn, khay, gối và âm dương không còn là hộp chữ nhật.',
    loading: 'Đang mở tờ trải…',
    login: 'Cần đăng nhập để mở tờ trải của hội thoại này.',
    loginAction: 'Đăng nhập',
    missing: 'Hội thoại này chưa có kích thước hộp.',
    notFound: 'Không thấy hội thoại này.',
    wrong: 'Hội thoại này không phải thiết kế hộp.',
    saveFailed: 'Chưa lưu được.',
    downloadMockup: 'Tải mockup',
    downloadDieline: 'Tải dieline',
    downloading: 'Đang tải',
    downloadFailed: 'Chưa tải được.',
    paperNames: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Giấy khác',
    },
  },
  en: {
    title: 'Box layout',
    back: 'Back to chat',
    save: 'Save',
    saving: 'Saving',
    saved: 'Saved.',
    faces: 'Six faces',
    pickPanel: 'Click a panel on the net, then click a photo on the left to place it.',
    armed: 'Photo selected. Click a panel on the net to place it.',
    cut: 'Cut',
    fold: 'Crease',
    open: 'Open',
    close: 'Close',
    outside: 'Outside',
    inside: 'Inside',
    color: 'Board color',
    colorHint: 'Tints only empty board. It does not change the print file.',
    paper: 'Paper',
    glue: 'Glue tab (mm)',
    notch: 'Finger notch',
    cols: 'Tray columns',
    rows: 'Tray rows',
    jar: 'Jar diameter (mm)',
    neck: 'Cap diameter (mm)',
    sheet: 'Sheet',
    note: 'Choosing a fold relayouts the net immediately. The preview follows the style: hexagon, octagon, tube, tray, pillow and telescope are no longer a plain rectangle.',
    loading: 'Opening the layout…',
    login: 'Sign in to open this conversation’s box layout.',
    loginAction: 'Sign in',
    missing: 'This conversation has no box size yet.',
    notFound: 'This conversation was not found.',
    wrong: 'This conversation is not a box design.',
    saveFailed: 'Could not save.',
    downloadMockup: 'Download mockup',
    downloadDieline: 'Download dieline',
    downloading: 'Downloading',
    downloadFailed: 'Could not download.',
    paperNames: {
      ivory_300: 'Ivory 300 gsm',
      ivory_350: 'Ivory 350 gsm',
      duplex_300: 'Duplex 300 gsm',
      duplex_350: 'Duplex 350 gsm',
      custom: 'Other paper',
    },
  },
  zh: {
    title: '盒型展开',
    back: '返回聊天',
    save: '保存',
    saving: '正在保存',
    saved: '已保存。',
    faces: '六个面',
    pickPanel: '先点展开上的一块，再点左侧图片放到那一块。',
    armed: '已选图片。点展开上的一块即可放下。',
    cut: '刀线',
    fold: '折线',
    open: '打开',
    close: '关闭',
    outside: '外面',
    inside: '里面',
    color: '纸板色',
    colorHint: '只给没有图的纸板着色，不改印刷文件。',
    paper: '纸张',
    glue: '糊口（mm）',
    notch: '抠手',
    cols: '内托列',
    rows: '内托行',
    jar: '罐径（mm）',
    neck: '瓶盖直径（mm）',
    sheet: '纸张',
    note: '选择盒型后展开图立即重排。右侧预览跟随盒型：六边形、八边形、圆管、托盘、枕头盒和天地盖不再是普通长方体。',
    loading: '正在打开展开图…',
    login: '请登录后打开此对话的盒型展开。',
    loginAction: '登录',
    missing: '此对话还没有盒子尺寸。',
    notFound: '找不到此对话。',
    wrong: '此对话不是盒子设计。',
    saveFailed: '未能保存。',
    downloadMockup: '下载样机',
    downloadDieline: '下载刀模',
    downloading: '正在下载',
    downloadFailed: '未能下载。',
    paperNames: {
      ivory_300: '象牙卡 300 gsm',
      ivory_350: '象牙卡 350 gsm',
      duplex_300: '双粉卡 300 gsm',
      duplex_350: '双粉卡 350 gsm',
      custom: '其他纸',
    },
  },
  ja: {
    title: '箱の展開',
    back: 'チャットへ戻る',
    save: '保存',
    saving: '保存中',
    saved: '保存しました。',
    faces: '6面',
    pickPanel: '展開のパネルを押してから、左の画像を押すとその面に置きます。',
    armed: '画像を選びました。展開のパネルを押して置いてください。',
    cut: 'カット',
    fold: '折り',
    open: '開く',
    close: '閉じる',
    outside: '外側',
    inside: '内側',
    color: '台紙の色',
    colorHint: '画像のない台紙だけを塗ります。印刷ファイルは変わりません。',
    paper: '用紙',
    glue: '糊代（mm）',
    notch: '指かけ',
    cols: '中仕切り列',
    rows: '中仕切り行',
    jar: '瓶の直径（mm）',
    neck: 'キャップ径（mm）',
    sheet: '用紙',
    note: '折り方を選ぶと展開がすぐ変わります。右側の見本も形に従います。六角形、八角形、丸筒、トレー、ピロー、かぶせ箱は普通の直方体ではありません。',
    loading: '展開を開いています…',
    login: 'この会話の展開を開くにはログインしてください。',
    loginAction: 'ログイン',
    missing: 'この会話には箱のサイズがありません。',
    notFound: 'この会話が見つかりません。',
    wrong: 'この会話は箱のデザインではありません。',
    saveFailed: '保存できませんでした。',
    downloadMockup: 'モックアップを保存',
    downloadDieline: 'ダイラインを保存',
    downloading: '保存中',
    downloadFailed: 'ダウンロードできませんでした。',
    paperNames: {
      ivory_300: 'アイボリー 300 gsm',
      ivory_350: 'アイボリー 350 gsm',
      duplex_300: 'デュプレックス 300 gsm',
      duplex_350: 'デュプレックス 350 gsm',
      custom: 'その他の紙',
    },
  },
  ko: {
    title: '박스 전개',
    back: '채팅으로',
    save: '저장',
    saving: '저장 중',
    saved: '저장했습니다.',
    faces: '6면',
    pickPanel: '전개의 면을 누른 뒤 왼쪽 사진을 누르면 그 면에 놓입니다.',
    armed: '사진을 골랐습니다. 전개의 면을 눌러 놓으세요.',
    cut: '컷',
    fold: '접힘',
    open: '열기',
    close: '닫기',
    outside: '바깥',
    inside: '안쪽',
    color: '보드 색',
    colorHint: '사진이 없는 보드만 칠합니다. 인쇄 파일은 바꾸지 않습니다.',
    paper: '용지',
    glue: '풀칠 폭 (mm)',
    notch: '손가락 홈',
    cols: '트레이 열',
    rows: '트레이 행',
    jar: '병 지름 (mm)',
    neck: '마개 지름 (mm)',
    sheet: '전지',
    note: '접기 방식을 고르면 전개가 바로 바뀝니다. 오른쪽 미리보기도 구조를 따릅니다. 육각, 팔각, 원통, 트레이, 필로우, 뚜껑 분리형은 평범한 직육면체가 아닙니다.',
    loading: '전개를 여는 중…',
    login: '이 대화의 전개를 열려면 로그인하세요.',
    loginAction: '로그인',
    missing: '이 대화에는 상자 크기가 없습니다.',
    notFound: '이 대화를 찾을 수 없습니다.',
    wrong: '이 대화는 상자 디자인이 아닙니다.',
    saveFailed: '저장하지 못했습니다.',
    downloadMockup: '목업 받기',
    downloadDieline: '다이라인 받기',
    downloading: '받는 중',
    downloadFailed: '받지 못했습니다.',
    paperNames: {
      ivory_300: '아이보리 300 gsm',
      ivory_350: '아이보리 350 gsm',
      duplex_300: '듀플렉스 300 gsm',
      duplex_350: '듀플렉스 350 gsm',
      custom: '다른 용지',
    },
  },
}

const BOARD_COLORS = ['#f7f4ee', '#e7e2d8', '#d9d3c7', '#c4a574', '#8d6e63', '#5d4037', '#1f2937']

function mmText(value: number, locale: WebLocale): string {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return locale === 'vi' ? text.replace('.', ',') : text
}

const AXIS = 32
const LABEL_PAD = 20

function mmTicks(spanMm: number): number[] {
  const ticks: number[] = []
  const last = Math.max(0, Math.ceil(spanMm / 10) * 10)
  for (let mm = 0; mm <= last; mm += 10) ticks.push(mm)
  return ticks
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  const quoted = header?.match(/filename="([^"]+)"/)
  return quoted?.[1] || fallback
}

function placeOriginAtTopLeft(layout: TuckEndLayoutData): TuckEndLayoutData {
  const extent = dielineDisplayBounds(layout)
  if (!Number.isFinite(extent.minX) || !Number.isFinite(extent.minY)) return layout
  const minX = extent.minX
  const minY = extent.minY
  const dx = (value: number, origin: number) => Math.round((value - origin) * 100) / 100
  return {
    ...layout,
    bounds: { widthMm: extent.widthMm, heightMm: extent.heightMm },
    panels: layout.panels.map((panel) => ({ ...panel, x: dx(panel.x, minX), y: dx(panel.y, minY) })),
    cutSegments: layout.cutSegments.map(([x1, y1, x2, y2]) => [
      dx(x1, minX),
      dx(y1, minY),
      dx(x2, minX),
      dx(y2, minY),
    ]),
    foldSegments: layout.foldSegments.map(([x1, y1, x2, y2]) => [
      dx(x1, minX),
      dx(y1, minY),
      dx(x2, minX),
      dx(y2, minY),
    ]),
    glueRects: layout.glueRects?.map((rect) => ({ ...rect, x: dx(rect.x, minX), y: dx(rect.y, minY) })),
    knockouts: layout.knockouts?.map((hole) => ({ ...hole, x: dx(hole.x, minX), y: dx(hole.y, minY) })),
    fingerNotches: layout.fingerNotches?.map((mark) => ({
      ...mark,
      cx: dx(mark.cx, minX),
      cy: dx(mark.cy, minY),
    })),
  }
}

function StudioFrame({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[2147483001] flex flex-col bg-[#2a2a2a] text-white">
      <style>{`[data-nanoai-widget-root]{display:none !important}`}</style>
      {children}
    </div>,
    document.body
  )
}

function StudioMessage({
  locale,
  threadId,
  text,
  actionHref,
  actionLabel,
}: {
  locale: WebLocale
  threadId?: string
  text: string
  actionHref?: string
  actionLabel?: string
}) {
  const router = useRouter()
  const t = COPY[locale]
  return (
    <StudioFrame>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-sm text-white/80">{text}</p>
        <div className="flex gap-2">
          {threadId ? (
            <button
              type="button"
              className="rounded-md border border-white/20 px-3 py-2 text-sm"
              onClick={() => {
                saveHubThreadId(threadId)
                router.push('/')
              }}
            >
              {t.back}
            </button>
          ) : null}
          {actionHref && actionLabel ? (
            <a href={actionHref} className="rounded-md bg-[#2dd4bf] px-3 py-2 text-sm font-semibold text-black">
              {actionLabel}
            </a>
          ) : null}
        </div>
      </div>
    </StudioFrame>
  )
}

export function BoxFoldStudioPage({ threadId, locale }: { threadId: string; locale: WebLocale }) {
  const t = COPY[locale]
  const [loaded, setLoaded] = useState<LoadedBox | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'login' | 'missing' | 'notFound' | 'wrong' | 'error'>('loading')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch(`/api/hub-chat?threadId=${encodeURIComponent(threadId)}`, {
          credentials: 'same-origin',
        })
        const data = (await res.json().catch(() => ({}))) as {
          thread?: {
            session?: {
              presetId?: string
              packaging?: {
                dimensionsMm?: { length: number; width: number; height: number } | null
                faceSlots?: FaceSlots
                dielineStructure?: string
                dielineStructureVersion?: number
                production?: TuckBoxProductionParams
                netFaceMap?: BoxNetFaceMap
              }
            } | null
          }
        }
        if (cancel) return
        if (res.status === 401) {
          setPhase('login')
          return
        }
        if (res.status === 404) {
          setPhase('notFound')
          return
        }
        const session = data.thread?.session
        if (!res.ok || !session) {
          setPhase('error')
          return
        }
        if (session.presetId !== 'packaging_kit') {
          setPhase('wrong')
          return
        }
        const dimensions = session.packaging?.dimensionsMm
        if (!dimensions?.length || !dimensions.width || !dimensions.height) {
          setPhase('missing')
          return
        }
        setLoaded({
          dimensions,
          faceSlots: session.packaging?.faceSlots ?? {},
          structure: resolveBoxDielineStructure(
            session.packaging?.dielineStructure,
            session.packaging?.dielineStructureVersion
          ),
          production: session.packaging?.production,
          faceMap: session.packaging?.netFaceMap ?? {},
        })
        setPhase('ready')
      } catch {
        if (!cancel) setPhase('error')
      }
    })()
    return () => {
      cancel = true
    }
  }, [threadId])

  if (phase === 'loading' || (phase === 'ready' && !loaded)) {
    return (
      <StudioFrame>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      </StudioFrame>
    )
  }
  if (phase === 'login') {
    return (
      <StudioMessage
        locale={locale}
        threadId={threadId}
        text={t.login}
        actionHref={`/auth/login?next=${encodeURIComponent(`/thiet-ke-hop/${threadId}`)}`}
        actionLabel={t.loginAction}
      />
    )
  }
  if (phase === 'missing') return <StudioMessage locale={locale} threadId={threadId} text={t.missing} />
  if (phase === 'notFound') return <StudioMessage locale={locale} threadId={threadId} text={t.notFound} />
  if (phase === 'wrong') return <StudioMessage locale={locale} threadId={threadId} text={t.wrong} />
  if (!loaded) return <StudioMessage locale={locale} threadId={threadId} text={t.saveFailed} />

  return <BoxFoldEditor threadId={threadId} locale={locale} loaded={loaded} />
}

function BoxFoldEditor({
  threadId,
  locale,
  loaded,
}: {
  threadId: string
  locale: WebLocale
  loaded: LoadedBox
}) {
  const t = COPY[locale]
  const router = useRouter()
  const clipPrefix = useId().replace(/:/g, '')
  const [structure, setStructure] = useState<BoxDielineStructure>(loaded.structure)
  const [stock, setStock] = useState<PaperStockId>(loaded.production?.paperStock ?? 'ivory_350')
  const [glue, setGlue] = useState(String(loaded.production?.glueTabMm ?? 15))
  const [notch, setNotch] = useState(loaded.production?.fingerNotch ?? true)
  const [cols, setCols] = useState(String(loaded.production?.insertCols ?? 2))
  const [rows, setRows] = useState(String(loaded.production?.insertRows ?? 3))
  const [jar, setJar] = useState(String(loaded.production?.jarDiameterMm ?? 0))
  const [neck, setNeck] = useState(String(loaded.production?.neckDiameterMm ?? 0))
  const [faceMap, setFaceMap] = useState<BoxNetFaceMap>(loaded.faceMap)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [armed, setArmed] = useState<BoxFaceSlot | null>(null)
  const [zoom, setZoom] = useState(1)
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = useState(0)
  const [lid, setLid] = useState(0)
  const [side, setSide] = useState<'outside' | 'inside'>('outside')
  const [boardColor, setBoardColor] = useState(BOARD_COLORS[1])
  const [saving, setSaving] = useState(false)
  const [downloadKind, setDownloadKind] = useState<'mockup' | 'dieline' | null>(null)
  const [notice, setNotice] = useState('')
  const axisRefs = useRef<{
    h: HTMLDivElement | null
    v: HTMLDivElement | null
    origin: HTMLElement | null
    px: number
  }>({ h: null, v: null, origin: null, px: 1 })

  const production = useMemo(
    () =>
      normalizeTuckBoxProductionParams(
        {
          ...defaultTuckBoxProductionParams(loaded.dimensions.height),
          ...loaded.production,
          paperStock: stock,
          glueTabMm: Number(glue.replace(',', '.')),
          fingerNotch: notch,
          insertCols: Number(cols),
          insertRows: Number(rows),
          jarDiameterMm: Number(jar.replace(',', '.')),
          neckDiameterMm: Number(neck.replace(',', '.')),
        },
        loaded.dimensions.height
      ),
    [cols, glue, jar, loaded.dimensions.height, loaded.production, neck, notch, rows, stock]
  )

  const layout = useMemo(() => {
    try {
      return getBoxDielineLayoutData(
        structure,
        {
          lengthMm: loaded.dimensions.length,
          widthMm: loaded.dimensions.width,
          heightMm: loaded.dimensions.height,
        },
        production
      )
    } catch {
      return null
    }
  }, [loaded.dimensions.height, loaded.dimensions.length, loaded.dimensions.width, production, structure])

  const sheet = useMemo(() => (layout ? placeOriginAtTopLeft(layout) : null), [layout])
  const selected = sheet && selectedIndex != null ? sheet.panels[selectedIndex] : undefined
  const selectedCopy = boxDielineStructureCopy(structure, locale)
  const mappedSlots = useMemo(
    () => applyBoxNetFaceMap(loaded.faceSlots, faceMap),
    [faceMap, loaded.faceSlots]
  )
  const stocks = stock === 'custom' ? PAPER_STOCK_IDS : PAPER_STOCK_IDS.filter((id) => id !== 'custom')
  const labelPad = LABEL_PAD
  const sheetPx = sheet ? Math.max(280, stageWidth || 880) * zoom : 0
  const sheetSpanW = sheet ? sheet.bounds.widthMm + labelPad : 1
  const sheetSpanH = sheet ? sheet.bounds.heightMm + labelPad : 1
  const pxPerMm = sheetPx / sheetSpanW
  const sheetPy = sheetPx * (sheetSpanH / sheetSpanW)
  axisRefs.current.px = pxPerMm || 1
  const syncAxisLock = useCallback((left: number, top: number) => {
    const axis = axisRefs.current
    if (axis.h) axis.h.style.transform = `translate3d(${-left}px,0,0)`
    if (axis.v) axis.v.style.transform = `translate3d(0,${-top}px,0)`
    if (axis.origin) axis.origin.textContent = left < 1 && top < 1 ? '0' : ''
  }, [])
  useEffect(() => {
    if (!stageEl) return
    const update = () => setStageWidth(stageEl.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stageEl)
    return () => observer.disconnect()
  }, [stageEl])
  useEffect(() => {
    if (!stageEl) return
    syncAxisLock(stageEl.scrollLeft, stageEl.scrollTop)
  }, [sheetPx, stageEl, syncAxisLock])
  const setZoomClamped = (next: number) => {
    setZoom(Math.min(4, Math.max(0.35, Math.round(next * 100) / 100)))
  }
  const onStageWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setZoomClamped(zoom + (event.deltaY < 0 ? 0.15 : -0.15))
  }
  const viewBox = sheet ? `0 0 ${sheetSpanW} ${sheetSpanH}` : '0 0 100 100'

  const assign = (target: BoxFaceSlot, source: BoxFaceSlot) => {
    setFaceMap((current) => {
      const next = { ...current }
      if (source === target) delete next[target]
      else next[target] = source
      return next
    })
  }

  const onPanel = (index: number) => {
    const panel = layout?.panels[index]
    if (panel && armed) {
      assign(panel.slot, armed)
      setArmed(null)
    }
    setSelectedIndex(index)
  }

  const onThumb = (slot: BoxFaceSlot) => {
    if (selected) assign(selected.slot, slot)
    else setArmed(slot)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setNotice('')
    try {
      const res = await fetch('/api/hub-chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'studio',
          action: 'confirm_box_net',
          threadId,
          locale,
          presetId: 'packaging_kit',
          message: selectedCopy.label,
          boxDielineStructure: structure,
          boxProduction: production,
          boxNetFaceMap: faceMap,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; reply?: string }
      if (!res.ok || data.ok === false) {
        setNotice(data.error || t.saveFailed)
        return
      }
      setNotice(String(data.reply ?? t.saved).replace(/\*\*/g, ''))
    } catch {
      setNotice(t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const goChat = () => {
    saveHubThreadId(threadId)
    router.push('/')
  }

  const download = async (kind: 'mockup' | 'dieline') => {
    if (downloadKind) return
    setDownloadKind(kind)
    setNotice('')
    try {
      const res = await fetch('/api/packaging/box-fold-export', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          kind,
          structure,
          production,
          faceMap,
        }),
      })
      if (!res.ok) {
        setNotice(t.downloadFailed)
        return
      }
      const blob = await res.blob()
      const fallback = kind === 'mockup' ? 'box-mockup.png' : 'box-dieline.pdf'
      const name = fileNameFromDisposition(res.headers.get('Content-Disposition'), fallback)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setNotice(t.downloadFailed)
    } finally {
      setDownloadKind(null)
    }
  }

  const downloadButtonClass =
    'inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 disabled:opacity-50'

  return (
    <StudioFrame>
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2">
        <button type="button" className="rounded-md border border-white/15 px-3 py-1.5 text-xs" onClick={goChat}>
          {t.back}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold">{t.title}</h1>
          <p className="truncate text-[11px] text-white/60">{selectedCopy.description}</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-[#2dd4bf] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? t.saving : t.save}
        </button>
      </header>

      <div
        className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 px-3 py-2"
        title={t.note}
      >
        {BOX_DIELINE_GROUPS.flatMap((group) =>
          group.structures.map((item) => (
            <button
              key={item}
              type="button"
              title={`${boxDielineGroupLabel(group.id, locale)} — ${boxDielineStructureCopy(item, locale).description}`}
              className={
                item === structure
                  ? 'rounded-full bg-[#2dd4bf] px-2.5 py-1 text-[11px] font-semibold text-black'
                  : 'rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20'
              }
              onClick={() => {
                setStructure(item)
                setSelectedIndex(null)
              }}
            >
              {boxDielineStructureCopy(item, locale).label}
            </button>
          ))
        )}
      </div>
      <p className="shrink-0 truncate px-3 pb-1 text-[11px] text-white/50" title={t.note}>
        {t.note}
      </p>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-[34vh] shrink-0 overflow-auto border-white/10 bg-[#161616] p-3 lg:max-h-none lg:w-[220px] lg:border-r">
          <p className="text-xs font-semibold">{t.faces}</p>
          <p className="mt-1 text-[11px] leading-snug text-white/55">{armed ? t.armed : t.pickPanel}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {BOX_FACE_SLOT_ORDER.map((slot) => {
              const url = resolveMockupSlotUrl(slot, loaded.faceSlots)
              const [faceW, faceH] = getBoxFaceSlotDimensionsMm(slot, loaded.dimensions)
              const active =
                armed === slot || (selected ? (faceMap[selected.slot] ?? selected.slot) === slot : false)
              return (
                <button
                  key={slot}
                  type="button"
                  className={
                    active
                      ? 'overflow-hidden rounded-md border-2 border-[#2dd4bf] bg-black text-left'
                      : 'overflow-hidden rounded-md border border-white/10 bg-black text-left'
                  }
                  onClick={() => onThumb(slot)}
                >
                  <span
                    className="flex items-center justify-center bg-[#111]"
                    style={{ aspectRatio: `${Math.max(faceW, 1)} / ${Math.max(faceH, 1)}` }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </span>
                  <span className="block truncate px-1 py-1 text-[10px] text-white/80">
                    {getBoxFaceSlotLabel(slot, locale)}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex min-h-[46vh] min-w-0 flex-1 flex-col bg-[#3a3a3a] lg:min-h-0">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-rose-500" />
              {t.cut}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t border-dashed border-violet-400" />
              {t.fold}
            </span>
            {sheet ? (
              <span>
                {t.sheet} {mmText(sheet.bounds.widthMm, locale)} × {mmText(sheet.bounds.heightMm, locale)} mm
              </span>
            ) : null}
            <span>
              {mmText(loaded.dimensions.length, locale)} × {mmText(loaded.dimensions.width, locale)} ×{' '}
              {mmText(loaded.dimensions.height, locale)} mm
            </span>
          </div>
          {sheet ? (
          <div
            className="grid min-h-0 flex-1"
            style={{ gridTemplateColumns: `${AXIS}px minmax(0, 1fr)`, gridTemplateRows: `${AXIS}px minmax(0, 1fr)` }}
          >
            <div className="relative border-b border-r border-neutral-300 bg-[#3a3a3a]">
              <span
                ref={(node) => {
                  axisRefs.current.origin = node
                }}
                className="absolute bottom-0.5 right-1 text-[10px] leading-none text-neutral-200"
              >
                0
              </span>
            </div>
            <div className="relative overflow-hidden border-b border-neutral-300 bg-[#3a3a3a]">
              <div
                ref={(node) => {
                  axisRefs.current.h = node
                }}
                className="absolute inset-y-0 left-0"
                style={{ width: sheetPx }}
              >
                {mmTicks(sheet.bounds.widthMm).map((mm) =>
                  mm === 0 ? null : (
                    <div key={`hx-${mm}`} className="absolute bottom-0" style={{ left: mm * pxPerMm }}>
                      <span
                        className="absolute bottom-0 left-0 block w-px bg-neutral-200"
                        style={{ height: mm % 50 === 0 ? 12 : 6 }}
                      />
                      {mm % 50 === 0 ? (
                        <span className="absolute bottom-3 left-1 whitespace-nowrap text-[10px] leading-none text-neutral-200">
                          {mm}
                        </span>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="relative overflow-hidden border-r border-neutral-300 bg-[#3a3a3a]">
              <div
                ref={(node) => {
                  axisRefs.current.v = node
                }}
                className="absolute inset-x-0 top-0"
                style={{ height: sheetPy }}
              >
                {mmTicks(sheet.bounds.heightMm).map((mm) =>
                  mm === 0 ? null : (
                    <div key={`vy-${mm}`} className="absolute right-0" style={{ top: mm * pxPerMm }}>
                      <span
                        className="absolute right-0 top-0 block h-px bg-neutral-200"
                        style={{ width: mm % 50 === 0 ? 12 : 6 }}
                      />
                      {mm % 50 === 0 ? (
                        <span className="absolute right-3.5 top-0 -translate-y-1/2 text-[10px] leading-none text-neutral-200">
                          {mm}
                        </span>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            </div>
            <div
              ref={setStageEl}
              className="min-h-0 overflow-auto"
              onWheel={onStageWheel}
              onScroll={(event) => syncAxisLock(event.currentTarget.scrollLeft, event.currentTarget.scrollTop)}
            >
              <svg
                viewBox={viewBox}
                role="img"
                aria-label={t.title}
                className="block max-w-none"
                style={{ width: sheetPx, height: sheetPy }}
              >
                  <rect x={0} y={0} width={sheet.bounds.widthMm} height={sheet.bounds.heightMm} fill="#f8fafc" />
                  {sheet.panels.map((panel, index) => {
                    const source = faceMap[panel.slot] ?? panel.slot
                    const url = resolveMockupSlotUrl(source, loaded.faceSlots)
                    const cx = panel.x + panel.w / 2
                    const cy = panel.y + panel.h / 2
                    const rotation = panel.rotation ?? 0
                    const clipId = `${clipPrefix}-p-${index}`
                    const fontSize = Math.max(4.5, Math.min(9, Math.min(panel.w, panel.h) * 0.16))
                    return (
                      <g key={`${panel.slot}-${index}`} className="cursor-pointer" onClick={() => onPanel(index)}>
                        <clipPath id={clipId}>
                          <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} />
                        </clipPath>
                        <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} fill="#e2e8f0" />
                        {url ? (
                          <image
                            href={url}
                            x={panel.x}
                            y={panel.y}
                            width={panel.w}
                            height={panel.h}
                            preserveAspectRatio="xMidYMid meet"
                            clipPath={`url(#${clipId})`}
                            transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}
                          />
                        ) : null}
                        <text
                          x={panel.x + 1.2}
                          y={panel.y + fontSize}
                          fontSize={fontSize}
                          fill="#0f172a"
                          stroke="#ffffff"
                          strokeWidth={fontSize * 0.18}
                          paintOrder="stroke"
                        >
                          {mmText(panel.x, locale)}, {mmText(panel.y, locale)}
                        </text>
                        <text
                          x={cx}
                          y={panel.y + panel.h - 1.4}
                          textAnchor="middle"
                          fontSize={Math.max(2.8, fontSize * 0.85)}
                          fill="#0f172a"
                          stroke="#ffffff"
                          strokeWidth={fontSize * 0.16}
                          paintOrder="stroke"
                        >
                          {mmText(panel.w, locale)}×{mmText(panel.h, locale)}
                        </text>
                        {selectedIndex === index ? (
                          <rect
                            x={panel.x}
                            y={panel.y}
                            width={panel.w}
                            height={panel.h}
                            fill="none"
                            stroke="#0f766e"
                            strokeWidth={1.2}
                          />
                        ) : null}
                      </g>
                    )
                  })}
                  {sheet.glueRects?.map((rect, index) => (
                    <rect
                      key={`glue-${index}`}
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      fill="#ffffff"
                      pointerEvents="none"
                    />
                  ))}
                  {sheet.knockouts?.map((hole, index) =>
                    hole.shape === 'ellipse' ? (
                      <ellipse
                        key={`hole-${index}`}
                        cx={hole.x + hole.w / 2}
                        cy={hole.y + hole.h / 2}
                        rx={hole.w / 2}
                        ry={hole.h / 2}
                        fill="#ffffff"
                        pointerEvents="none"
                      />
                    ) : (
                      <rect
                        key={`hole-${index}`}
                        x={hole.x}
                        y={hole.y}
                        width={hole.w}
                        height={hole.h}
                        fill="#ffffff"
                        pointerEvents="none"
                      />
                    )
                  )}
                  {sheet.fingerNotches?.map((mark, index) => (
                    <circle
                      key={`notch-${index}`}
                      cx={mark.cx}
                      cy={mark.cy}
                      r={mark.r}
                      fill="#ffffff"
                      pointerEvents="none"
                    />
                  ))}
                  {sheet.foldSegments.map(([x1, y1, x2, y2], index) => (
                    <line
                      key={`fold-${index}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#7c3aed"
                      strokeWidth={0.55}
                      strokeDasharray="2.2 1.3"
                      pointerEvents="none"
                    />
                  ))}
                  {sheet.cutSegments.map(([x1, y1, x2, y2], index) => (
                    <line
                      key={`cut-${index}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#e11d48"
                      strokeWidth={0.7}
                      pointerEvents="none"
                    />
                  ))}
                  <line
                    x1={0}
                    y1={sheet.bounds.heightMm + 8}
                    x2={sheet.bounds.widthMm}
                    y2={sheet.bounds.heightMm + 8}
                    stroke="#334155"
                    strokeWidth={0.4}
                  />
                  <text
                    x={sheet.bounds.widthMm / 2}
                    y={sheet.bounds.heightMm + 16}
                    textAnchor="middle"
                    fontSize={4}
                    fill="#1e293b"
                  >
                    {mmText(sheet.bounds.widthMm, locale)} mm
                  </text>
                  <line
                    x1={sheet.bounds.widthMm + 8}
                    y1={0}
                    x2={sheet.bounds.widthMm + 8}
                    y2={sheet.bounds.heightMm}
                    stroke="#334155"
                    strokeWidth={0.4}
                  />
                  <text
                    x={sheet.bounds.widthMm + 14}
                    y={sheet.bounds.heightMm / 2}
                    textAnchor="middle"
                    fontSize={4}
                    fill="#1e293b"
                    transform={`rotate(-90 ${sheet.bounds.widthMm + 14} ${sheet.bounds.heightMm / 2})`}
                  >
                    {mmText(sheet.bounds.heightMm, locale)} mm
                  </text>
                </svg>
            </div>
          </div>
          ) : (
            <p className="p-3 text-sm text-white/70">{t.saveFailed}</p>
          )}
          <div className="flex items-center justify-center gap-2 border-t border-white/10 py-2 text-xs">
            <button
              type="button"
              className="rounded-md border border-white/15 p-1"
              onClick={() => setZoomClamped(zoom - 0.25)}
              aria-label="-"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="rounded-md border border-white/15 p-1"
              onClick={() => setZoomClamped(zoom + 0.25)}
              aria-label="+"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        <aside className="max-h-[72vh] shrink-0 overflow-auto border-white/10 bg-[#1c1c1c] p-3 lg:max-h-none lg:w-[340px] lg:border-l">
          <PackagingBoxMockup3D
            appearance="studio"
            showShareMenu={false}
            locale={locale}
            dimensionsMm={loaded.dimensions}
            faceSlots={mappedSlots}
            structure={structure}
            lidOpen={lid / 100}
            viewPreset={side}
            boardColor={boardColor}
            toolbarExtra={
              <>
                <button
                  type="button"
                  className={downloadButtonClass}
                  disabled={downloadKind !== null}
                  onClick={() => void download('mockup')}
                >
                  {downloadKind === 'mockup' ? t.downloading : t.downloadMockup}
                </button>
                <button
                  type="button"
                  className={downloadButtonClass}
                  title={selectedCopy.label}
                  disabled={downloadKind !== null}
                  onClick={() => void download('dieline')}
                >
                  {downloadKind === 'dieline' ? t.downloading : t.downloadDieline}
                </button>
              </>
            }
            footer={
              <div className="mt-3 space-y-3 text-xs text-slate-700">
                <label className="block">
                  <span className="flex justify-between">
                    <span>{t.close}</span>
                    <span>{t.open}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={lid}
                    className="mt-1 w-full"
                    onChange={(event) => setLid(Number(event.target.value))}
                  />
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-200 p-1">
                  {(['outside', 'inside'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={
                        side === item
                          ? 'rounded-full bg-white py-1 font-semibold text-slate-900'
                          : 'rounded-full py-1 text-slate-600'
                      }
                      onClick={() => {
                        setSide(item)
                        setLid(item === 'inside' ? 80 : 0)
                      }}
                    >
                      {item === 'outside' ? t.outside : t.inside}
                    </button>
                  ))}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{t.color}</p>
                  <p className="text-[11px] text-slate-500">{t.colorHint}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={color}
                        className={
                          boardColor === color
                            ? 'h-6 w-6 rounded-full ring-2 ring-teal-600 ring-offset-2'
                            : 'h-6 w-6 rounded-full ring-1 ring-black/10'
                        }
                        style={{ backgroundColor: color }}
                        onClick={() => setBoardColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            }
          />

          <div className="mt-3 space-y-2 text-xs">
            <label className="block text-white/70">
              {t.paper}
              <select
                className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                value={stock}
                onChange={(event) => setStock(event.target.value as PaperStockId)}
              >
                {stocks.map((id) => (
                  <option key={id} value={id}>
                    {t.paperNames[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-white/70">
              {t.glue}
              <input
                className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                inputMode="decimal"
                value={glue}
                onChange={(event) => setGlue(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-white/80">
              <input type="checkbox" checked={notch} onChange={(event) => setNotch(event.target.checked)} />
              {t.notch}
            </label>
            {structure === 'insert' ? (
              <div className="grid grid-cols-3 gap-2">
                <label className="text-white/70">
                  {t.cols}
                  <input
                    className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                    value={cols}
                    onChange={(event) => setCols(event.target.value)}
                  />
                </label>
                <label className="text-white/70">
                  {t.rows}
                  <input
                    className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                    value={rows}
                    onChange={(event) => setRows(event.target.value)}
                  />
                </label>
                <label className="text-white/70">
                  {t.jar}
                  <input
                    className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                    value={jar}
                    onChange={(event) => setJar(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {structure === 'bottle' ? (
              <label className="block text-white/70">
                {t.neck}
                <input
                  className="mt-1 h-8 w-full rounded-md bg-white px-2 text-sm text-slate-900"
                  inputMode="decimal"
                  value={neck}
                  onChange={(event) => setNeck(event.target.value)}
                />
              </label>
            ) : null}
            {notice ? <p className="text-[11px] leading-snug text-[#99f6e4]">{notice}</p> : null}
          </div>
        </aside>
      </div>
    </StudioFrame>
  )
}
