'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  buildWeddingGoogleCalendarUrl,
  buildZaloShareUrl,
  downloadWeddingIcsFile,
  type WeddingCalendarEventInput,
} from '@/lib/wedding/wedding-calendar-export'
import { weddingCard3dCopy, type WeddingCard3dCopy } from '@/lib/wedding/wedding-card-3d-copy'

const COVER = '/wedding/samples/vuon-kinh-hong/cover.png'
const GROOM = '/wedding/samples/vuon-kinh-hong/groom.png'
const BRIDE = '/wedding/samples/vuon-kinh-hong/bride.png'
const ALBUM = ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'] as const
const WASH = '/wedding/backgrounds/vuon-kinh-hong-wash.jpg'
const GROOM_MAP = 'https://www.google.com/maps/search/?api=1&query=12%20phố%20Huế%20Hai%20Bà%20Trưng%20Hà%20Nội'
const BRIDE_MAP = 'https://www.google.com/maps/search/?api=1&query=8%20Lạch%20Tray%20Ngô%20Quyền%20Hải%20Phòng'

const PAPER = '#fffaf6'
const INK = '#3a2a2e'
const MUTED = '#6b4a52'
const ROSE = '#9d4e63'
const LINE = 'rgba(168, 112, 104, 0.55)'

const PAGES = ['cover', 'invite', 'families', 'couple', 'album', 'groom', 'bride', 'program', 'story', 'gift', 'rsvp', 'reminder', 'thanks'] as const
type PageId = (typeof PAGES)[number]

const JUMPS: { id: PageId; key: 'navInvite' | 'navEvent' | 'navStory' | 'navGift' | 'navRsvp' }[] = [
  { id: 'invite', key: 'navInvite' },
  { id: 'groom', key: 'navEvent' },
  { id: 'story', key: 'navStory' },
  { id: 'gift', key: 'navGift' },
  { id: 'rsvp', key: 'navRsvp' },
]

type Props = { locale: WebLocale }

type RsvpChoice = 'yes' | 'no' | ''

export function WeddingCard3dPreview(props: Props) {
  const copy = weddingCard3dCopy(props.locale)
  const rootRef = useRef<HTMLDivElement>(null)
  const rigRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<HTMLDivElement>(null)
  const reduceRef = useRef(false)
  const pose = useRef({ pitch: 12, yaw: -18, user: false })
  const drag = useRef({ on: false, x: 0, y: 0, x0: 0, y0: 0, moved: 0, pointer: -1 })
  const pageRef = useRef(0)
  const angleRef = useRef(0)
  const dirRef = useRef<'next' | 'prev' | null>(null)
  const busy = useRef(false)
  const autoRef = useRef(false)
  const autoTimer = useRef(0)
  const cancelRig = useRef(() => {})
  const liveTransform = useRef<string | null>(null)
  const REST_POSE = 'translateZ(10px) rotateY(0deg)'
  const turnRef = useRef({ next: () => {}, prev: () => {}, jump: (_index: number) => {}, open: () => {}, stop: () => {} })
  const [page, setPage] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [sweepId, setSweepId] = useState(0)
  const [leafPage, setLeafPage] = useState(0)
  const [underPage, setUnderPage] = useState(1)
  const [angle, setAngle] = useState(0)
  const [animateLeaf, setAnimateLeaf] = useState(true)
  const [photo, setPhoto] = useState<string | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [guestName, setGuestName] = useState('Anh Thanh')
  const [choice, setChoice] = useState<RsvpChoice>('')
  const [wish, setWish] = useState('')
  const [rsvpNote, setRsvpNote] = useState('')
  const [email, setEmail] = useState('')
  const [daysBefore, setDaysBefore] = useState('3')
  const [reminderNote, setReminderNote] = useState('')
  const countdown = useCountdown('2026-12-20T17:00:00+07:00')

  function paint() {
    const rig = rigRef.current
    if (!rig) return
    rig.style.transform = `rotateX(${pose.current.pitch}deg) rotateY(${pose.current.yaw}deg)`
  }

  function finishTurn(apply: () => void) {
    window.setTimeout(() => {
      if (!dirRef.current) return
      apply()
    }, reduceRef.current ? 0 : 860)
  }

  function stopShow() {
    autoRef.current = false
    setAutoPlay(false)
    window.clearTimeout(autoTimer.current)
    cancelRig.current()
    pose.current.user = false
  }

  function queueAuto() {
    window.clearTimeout(autoTimer.current)
    if (!autoRef.current) return
    if (pageRef.current >= PAGES.length - 1) {
      stopShow()
      return
    }
    const hold = pageRef.current === 1 ? 1600 : 1250
    autoTimer.current = window.setTimeout(() => {
      if (autoRef.current) goNext(true)
    }, reduceRef.current ? 0 : hold)
  }

  function settleNext() {
    if (dirRef.current !== 'next') return
    const next = pageRef.current + 1
    pageRef.current = next
    dirRef.current = null
    angleRef.current = 0
    busy.current = false
    liveTransform.current = REST_POSE
    if (leafRef.current) leafRef.current.style.transform = REST_POSE
    setAnimateLeaf(false)
    setAngle(0)
    setPage(next)
    setLeafPage(next)
    setUnderPage(Math.min(PAGES.length - 1, next + 1))
    if (autoRef.current) queueAuto()
  }

  function goNext(fromAuto = false) {
    if (!fromAuto) stopShow()
    if (busy.current || pageRef.current >= PAGES.length - 1) return
    if (reduceRef.current) {
      const next = pageRef.current + 1
      pageRef.current = next
      setPage(next)
      setLeafPage(next)
      setUnderPage(Math.min(PAGES.length - 1, next + 1))
      if (fromAuto) queueAuto()
      return
    }
    busy.current = true
    dirRef.current = 'next'
    setUnderPage(pageRef.current + 1)
    setLeafPage(pageRef.current)
    setAnimateLeaf(false)
    setSweepId((id) => id + 1)
  }

  function goPrev() {
    stopShow()
    if (busy.current || pageRef.current <= 0) return
    if (reduceRef.current) {
      jump(pageRef.current - 1)
      return
    }
    busy.current = true
    dirRef.current = 'prev'
    const prev = pageRef.current - 1
    setAnimateLeaf(false)
    setUnderPage(pageRef.current)
    setLeafPage(prev)
    angleRef.current = -180
    setAngle(-180)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimateLeaf(true)
        angleRef.current = 0
        setAngle(0)
      })
    })
    finishTurn(() => {
      if (dirRef.current !== 'prev') return
      const prev = Math.max(0, pageRef.current - 1)
      pageRef.current = prev
      dirRef.current = null
      setPage(prev)
      setUnderPage(Math.min(PAGES.length - 1, prev + 1))
      busy.current = false
    })
  }

  function easeRig(pitch: number, yaw: number, done: () => void) {
    cancelRig.current()
    const fromP = pose.current.pitch
    const fromY = pose.current.yaw
    const t0 = performance.now()
    let raf = 0
    let dead = false
    cancelRig.current = () => {
      dead = true
      cancelAnimationFrame(raf)
    }
    const step = (now: number) => {
      if (dead) return
      const t = Math.min(1, (now - t0) / 620)
      const k = 1 - (1 - t) ** 3
      pose.current.pitch = fromP + (pitch - fromP) * k
      pose.current.yaw = fromY + (yaw - fromY) * k
      paint()
      if (t < 1) raf = requestAnimationFrame(step)
      else done()
    }
    raf = requestAnimationFrame(step)
  }

  function startShow() {
    if (busy.current || autoRef.current) return
    autoRef.current = true
    setAutoPlay(true)
    pose.current.user = true
    easeRig(12, -8, () => {
      if (!autoRef.current) return
      if (pageRef.current === 0) goNext(true)
      else queueAuto()
    })
  }

  function jump(index: number) {
    stopShow()
    if (busy.current || index === pageRef.current || index < 0 || index >= PAGES.length) return
    dirRef.current = null
    pageRef.current = index
    angleRef.current = 0
    setAnimateLeaf(false)
    setAngle(0)
    setPage(index)
    setLeafPage(index)
    setUnderPage(Math.min(PAGES.length - 1, index + 1))
    requestAnimationFrame(() => setAnimateLeaf(true))
  }

  turnRef.current = { next: () => goNext(false), prev: goPrev, jump, open: startShow, stop: stopShow }

  function onLeafEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== 'transform' || event.target !== leafRef.current) return
    if (dirRef.current === 'next' && angleRef.current === -180) {
      settleNext()
      return
    }
    if (dirRef.current === 'prev' && angleRef.current === 0) {
      const prev = Math.max(0, pageRef.current - 1)
      pageRef.current = prev
      dirRef.current = null
      setPage(prev)
      setUnderPage(Math.min(PAGES.length - 1, prev + 1))
      busy.current = false
    }
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const fit = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const footer = 176
      const h = Math.max(360, vh - footer - 10)
      const w = Math.min(vw - 16, 540, h / 1.38)
      const cardH = Math.min(h, w * 1.58)
      root.style.setProperty('--card-w', `${w}px`)
      root.style.setProperty('--card-h', `${cardH}px`)
      paint()
    }
    fit()
    window.addEventListener('resize', fit)

    let raf = 0
    const loop = (now: number) => {
      if (!pose.current.user && !drag.current.on && !reduceRef.current) {
        const opened = pageRef.current > 0
        pose.current.pitch = (opened ? 7 : 14) + Math.sin(now / 2600) * (opened ? 1.2 : 2)
        pose.current.yaw = (opened ? -12 : -24) + Math.sin(now / 2100) * (opened ? 3 : 5)
        paint()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      cancelRig.current()
      window.clearTimeout(autoTimer.current)
      window.removeEventListener('resize', fit)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useLayoutEffect(() => {
    const leaf = leafRef.current
    if (!leaf || liveTransform.current == null) return
    leaf.style.transform = liveTransform.current
    if (dirRef.current !== 'next') liveTransform.current = null
  })

  useEffect(() => {
    if (sweepId === 0 || dirRef.current !== 'next') return
    let dead = false
    const ms = pageRef.current === 0 ? 1320 : 880
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      if (dead) return
      const t = Math.min(1, (now - t0) / ms)
      const k = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
      const lift = Math.sin(Math.PI * t)
      const pose = `translateZ(${14 + lift * 72}px) rotateX(${lift * 18}deg) rotateY(${-180 * k}deg)`
      liveTransform.current = pose
      const leaf = leafRef.current
      if (leaf) leaf.style.transform = pose
      if (t < 1) raf = requestAnimationFrame(step)
      else settleNext()
    }
    raf = requestAnimationFrame(step)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
    }
  }, [sweepId])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (autoRef.current) stopShow()
    if ((event.target as HTMLElement).closest('a, button, input, textarea, label, select')) return
    drag.current = { on: true, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, moved: 0, pointer: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.on || drag.current.pointer !== event.pointerId) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    drag.current.moved += Math.abs(dx) + Math.abs(dy)
    const totalX = event.clientX - drag.current.x0
    const totalY = event.clientY - drag.current.y0
    if (Math.abs(totalX) <= Math.abs(totalY)) return
    pose.current.user = true
    pose.current.yaw += dx * 0.22
    pose.current.pitch = Math.max(-18, Math.min(22, pose.current.pitch - dy * 0.12))
    paint()
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.on || drag.current.pointer !== event.pointerId) return
    const totalX = event.clientX - drag.current.x0
    const totalY = event.clientY - drag.current.y0
    drag.current.on = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (Math.abs(totalX) > 64 && Math.abs(totalX) > Math.abs(totalY) * 1.25) {
      pose.current.user = false
      if (totalX < 0) goNext()
      else goPrev()
    }
  }

  function calendarInput(side: 'groom' | 'bride'): WeddingCalendarEventInput {
    const groomSide = side === 'groom'
    return {
      title: `${copy.groom} & ${copy.bride}`,
      description: copy.invite,
      location: groomSide ? copy.groomAddress : copy.brideAddress,
      weddingDateIso: groomSide ? '2026-12-20' : '2026-12-19',
      weddingTimeText: groomSide ? '17:00' : '10:30',
      partyStartTime: groomSide ? '18:00' : '11:30',
      url: typeof window === 'undefined' ? 'https://nanoai.vn/thiep-3d' : window.location.href,
    }
  }

  async function copyAccount(account: string) {
    try {
      await navigator.clipboard.writeText(account)
      setCopied(account)
    } catch {
      setCopied('')
    }
  }

  function submitRsvp() {
    if (!guestName.trim()) {
      setRsvpNote(copy.needName)
      return
    }
    if (!choice) {
      setRsvpNote(copy.needChoice)
      return
    }
    setRsvpNote(choice === 'yes' ? copy.submittedYes : copy.submittedNo)
  }

  function saveReminder() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setReminderNote(copy.needEmail)
      return
    }
    setReminderNote(copy.reminderSaved)
  }

  const pageLabel = copy.pageOf.replace('{n}', String(page + 1)).replace('{total}', String(PAGES.length))
  const shared = { copy, countdown, giftOpen, setGiftOpen, copied, copyAccount, photo, setPhoto, guestName, setGuestName, choice, setChoice, wish, setWish, rsvpNote, submitRsvp, email, setEmail, daysBefore, setDaysBefore, reminderNote, saveReminder, calendarInput }

  return (
    <div
      ref={rootRef}
      className="wedding-font-soft fixed inset-0 flex flex-col"
      style={{
        backgroundColor: '#f6e4e6',
        backgroundImage: `radial-gradient(ellipse at center, rgba(255,250,248,0.55), rgba(196,120,136,0.28)), url(${WASH})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: INK,
      }}
    >
      <style>{FACE_CSS}</style>
      <div
        className="relative min-h-0 flex-1"
        style={{ perspective: '1100px', perspectiveOrigin: '50% 42%' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div ref={rigRef} className="card3d-rig" style={{ width: 'var(--card-w)', height: 'var(--card-h)' }}>
            <div aria-hidden className="card3d-floor" />
            <div className="card3d-book" data-card="">
              <div className="card3d-sheet" style={{ pointerEvents: 'none' }}>
                <article className="card3d-face" style={paperStyle}>{renderPage(PAGES[underPage], shared)}</article>
              </div>
              <div
                ref={leafRef}
                className={animateLeaf ? 'card3d-leaf is-animated' : 'card3d-leaf'}
                style={{ transform: `translateZ(10px) rotateY(${angle}deg)` }}
                onTransitionEnd={onLeafEnd}
              >
                <article className="card3d-face" style={paperStyle}>{renderPage(PAGES[leafPage], shared)}</article>
                <article className="card3d-face card3d-back" style={{ ...paperStyle, transform: 'rotateY(180deg)' }} />
                <PaperRim />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {page === 0 && !autoPlay ? (
          <button type="button" className="card3d-open" onClick={() => turnRef.current.open()}>{copy.openCard}</button>
        ) : null}
        {autoPlay ? (
          <button type="button" className="card3d-open" onClick={() => turnRef.current.stop()}>{copy.stopShow}</button>
        ) : null}
        <p className="text-center text-[13px]" style={{ color: MUTED }}>{autoPlay ? copy.autoHint : page === 0 ? copy.closedHint : copy.hint}</p>
        <div className="mx-auto flex w-full max-w-xl items-center gap-2">
          <button type="button" className="card3d-nav" disabled={page === 0} onClick={() => turnRef.current.prev()}>{copy.prev}</button>
          <p className="min-w-14 text-center text-sm tabular-nums" style={{ color: INK }}>{pageLabel}</p>
          <button type="button" className="card3d-nav" disabled={page === PAGES.length - 1} onClick={() => turnRef.current.next()}>{copy.next}</button>
        </div>
        <div className="mx-auto flex w-full max-w-xl gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {JUMPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="card3d-chip"
              aria-current={PAGES[page] === item.id ? 'page' : undefined}
              onClick={() => turnRef.current.jump(PAGES.indexOf(item.id))}
            >
              {copy[item.key]}
            </button>
          ))}
        </div>
      </div>
      {photo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4" onClick={() => setPhoto(null)}>
          <button type="button" className="card3d-nav absolute right-4 top-4" onClick={() => setPhoto(null)}>{copy.closePhoto}</button>
          <img src={photo} alt={copy.albumAlt} className="max-h-[82vh] max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  )
}

type PageShared = {
  copy: WeddingCard3dCopy
  countdown: { days: number; hours: number; minutes: number }
  giftOpen: boolean
  setGiftOpen: (open: boolean) => void
  copied: string
  copyAccount: (account: string) => void
  photo: string | null
  setPhoto: (src: string | null) => void
  guestName: string
  setGuestName: (value: string) => void
  choice: RsvpChoice
  setChoice: (value: RsvpChoice) => void
  wish: string
  setWish: (value: string) => void
  rsvpNote: string
  submitRsvp: () => void
  email: string
  setEmail: (value: string) => void
  daysBefore: string
  setDaysBefore: (value: string) => void
  reminderNote: string
  saveReminder: () => void
  calendarInput: (side: 'groom' | 'bride') => WeddingCalendarEventInput
}

function renderPage(id: PageId, shared: PageShared): ReactNode {
  const { copy } = shared
  if (id === 'cover') return <CoverFace copy={copy} />
  if (id === 'invite') return <InvitePage shared={shared} />
  if (id === 'families') return <FamiliesPage copy={copy} />
  if (id === 'couple') return <CouplePage copy={copy} />
  if (id === 'album') return <AlbumPage shared={shared} />
  if (id === 'groom' || id === 'bride') return <HousePage side={id} shared={shared} />
  if (id === 'program') return <ProgramPage copy={copy} />
  if (id === 'story') return <StoryPage copy={copy} />
  if (id === 'gift') return <GiftPage shared={shared} />
  if (id === 'rsvp') return <RsvpPage shared={shared} />
  if (id === 'reminder') return <ReminderPage shared={shared} />
  return <ThanksPage copy={copy} />
}

function CoverFace(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="flex h-full flex-col px-[6%] pb-[5%] pt-[6%]">
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ boxShadow: `inset 0 0 0 1px ${LINE}` }}>
        <img src={COVER} alt={copy.coverAlt} className="h-full w-full object-cover" style={{ objectPosition: 'center 18%' }} draggable={false} />
      </div>
      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.32em]" style={{ color: ROSE }}>{copy.kicker}</p>
      <p className="mt-1 text-center font-serif text-[1.65rem] leading-tight">{copy.groom}</p>
      <p className="text-center font-serif text-lg" style={{ color: ROSE }}>&</p>
      <p className="text-center font-serif text-[1.65rem] leading-tight">{copy.bride}</p>
      <p className="mt-1 text-center text-sm tracking-[0.16em]" style={{ color: MUTED }}>{copy.date}</p>
    </div>
  )
}

function InvitePage(props: { shared: PageShared }) {
  const { copy, countdown } = props.shared
  return (
    <div className="card3d-page text-center">
      <Kicker>{copy.kicker}</Kicker>
      <p className="mt-4 font-serif text-2xl leading-snug">{copy.guest}</p>
      <p className="mt-3 text-[15px] leading-7" style={{ color: MUTED }}>{copy.invite}</p>
      <p className="mt-4 font-serif text-[15px] italic leading-7" style={{ color: ROSE }}>{copy.quote}</p>
      <div className="my-4 h-px w-10 self-center" style={{ background: LINE }} />
      <p className="font-serif text-xl">{copy.date}</p>
      <p className="mt-3 text-sm uppercase tracking-[0.18em]" style={{ color: ROSE }}>{copy.countdown}</p>
      <p className="mt-1 font-serif text-lg">{countdown.days} {copy.days} · {countdown.hours} {copy.hours} · {countdown.minutes} {copy.minutes}</p>
    </div>
  )
}

function FamiliesPage(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="card3d-page">
      <Kicker>{copy.families}</Kicker>
      <FamilyBlock label={copy.groomFamily} parents={copy.groomParents} homeLabel={copy.hometown} home={copy.groomHome} />
      <FamilyBlock label={copy.brideFamily} parents={copy.brideParents} homeLabel={copy.hometown} home={copy.brideHome} />
    </div>
  )
}

function FamilyBlock(props: { label: string; parents: string; homeLabel: string; home: string }) {
  return (
    <div className="mt-4 rounded-2xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.72)' }}>
      <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: ROSE }}>{props.label}</p>
      <p className="mt-2 font-serif text-lg leading-snug">{props.parents}</p>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>{props.homeLabel}: {props.home}</p>
    </div>
  )
}

function CouplePage(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="card3d-page">
      <Kicker>{copy.couple}</Kicker>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Portrait src={GROOM} alt={copy.groomAlt} name={copy.groom} role={copy.groomRole} />
        <Portrait src={BRIDE} alt={copy.brideAlt} name={copy.bride} role={copy.brideRole} />
      </div>
      <p className="mt-4 text-center text-[11px] uppercase tracking-[0.22em]" style={{ color: ROSE }}>{copy.introTitle}</p>
      <p className="mt-2 text-center text-[15px] leading-7" style={{ color: MUTED }}>{copy.intro}</p>
    </div>
  )
}

function Portrait(props: { src: string; alt: string; name: string; role: string }) {
  return (
    <figure>
      <div className="aspect-[3/4] overflow-hidden" style={{ boxShadow: `inset 0 0 0 1px ${LINE}` }}>
        <img src={props.src} alt={props.alt} className="h-full w-full object-cover object-top" draggable={false} />
      </div>
      <figcaption className="mt-2 text-center">
        <span className="block text-[11px] uppercase tracking-[0.16em]" style={{ color: ROSE }}>{props.role}</span>
        <span className="mt-1 block font-serif text-sm">{props.name}</span>
      </figcaption>
    </figure>
  )
}

function AlbumPage(props: { shared: PageShared }) {
  const { copy, setPhoto } = props.shared
  return (
    <div className="card3d-page">
      <Kicker>{copy.album}</Kicker>
      <div className="mt-3 grid gap-3">
        {ALBUM.map((src) => (
          <button key={src} type="button" className="overflow-hidden text-left" style={{ boxShadow: `inset 0 0 0 1px ${LINE}` }} onClick={() => setPhoto(src)}>
            <img src={src} alt={copy.albumAlt} className="aspect-[4/3] w-full object-cover" draggable={false} />
            <span className="block px-2 py-2 text-center text-sm font-semibold" style={{ color: ROSE }}>{copy.viewPhoto}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HousePage(props: { side: 'groom' | 'bride'; shared: PageShared }) {
  const { copy, calendarInput } = props.shared
  const groomSide = props.side === 'groom'
  const input = calendarInput(props.side)
  const google = buildWeddingGoogleCalendarUrl(input)
  const zalo = buildZaloShareUrl(typeof window === 'undefined' ? 'https://nanoai.vn/thiep-3d' : window.location.href)
  return (
    <div className="card3d-page text-center">
      <Kicker>{groomSide ? copy.groomFamily : copy.brideFamily}</Kicker>
      <p className="mt-3 font-serif text-2xl">{groomSide ? copy.date : copy.brideDate}</p>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>{groomSide ? copy.groomTime : copy.brideTime}</p>
      <p className="text-sm" style={{ color: MUTED }}>{groomSide ? copy.groomParty : copy.brideParty}</p>
      <p className="mt-3 text-[15px] leading-6">{groomSide ? copy.groomAddress : copy.brideAddress}</p>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>{copy.contact}: {groomSide ? '0900 000 001' : '0900 000 002'}</p>
      <div className="mt-4 grid gap-2">
        <CardLink href={groomSide ? GROOM_MAP : BRIDE_MAP}>{copy.openMaps}</CardLink>
        {google ? <CardLink href={google}>{copy.addCalendar}</CardLink> : null}
        <CardButton onClick={() => downloadWeddingIcsFile(input, 'thiep-cuoi.ics')}>{copy.downloadCalendar}</CardButton>
        <CardLink href={zalo}>{copy.shareZalo}</CardLink>
      </div>
    </div>
  )
}

function Timeline(props: { items: WeddingCard3dCopy['timeline'] }) {
  return (
    <ol className="mt-3 space-y-2">
      {props.items.map((item) => (
        <li key={`${item.time}-${item.label}`} className="flex gap-3">
          <span className="w-16 shrink-0 font-serif text-sm" style={{ color: ROSE }}>{item.time}</span>
          <span className="text-[15px] leading-6">{item.label}</span>
        </li>
      ))}
    </ol>
  )
}

function ProgramPage(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="card3d-page">
      <Kicker>{copy.program}</Kicker>
      <p className="mt-4 text-center text-[11px] uppercase tracking-[0.18em]" style={{ color: ROSE }}>{copy.groomFamily}</p>
      <Timeline items={copy.timeline} />
      <p className="mt-4 text-center text-[11px] uppercase tracking-[0.18em]" style={{ color: ROSE }}>{copy.brideFamily}</p>
      <Timeline items={copy.brideTimeline} />
      <div className="mt-5 rounded-2xl px-3 py-3 text-center" style={{ background: 'rgba(255,255,255,0.72)' }}>
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: ROSE }}>{copy.dress}</p>
        <p className="mt-2 text-sm leading-6">{copy.dressText}</p>
      </div>
    </div>
  )
}

function StoryPage(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="card3d-page text-center">
      <Kicker>{copy.storyTitle}</Kicker>
      <p className="mt-4 font-serif text-[17px] leading-8">{copy.story}</p>
    </div>
  )
}

function GiftPage(props: { shared: PageShared }) {
  const { copy, giftOpen, setGiftOpen, copied, copyAccount } = props.shared
  return (
    <div className="card3d-page text-center">
      <Kicker>{copy.gift}</Kicker>
      <p className="mt-3 text-sm leading-6" style={{ color: MUTED }}>{copy.groom} & {copy.bride}</p>
      {!giftOpen ? <CardButton onClick={() => setGiftOpen(true)}>{copy.openGift}</CardButton> : (
        <div className="mt-4 grid gap-3 text-left">
          <AccountBlock copy={copy} title={copy.groomFamily} name="NGUYEN VAN MINH" account="0123456789" copied={copied === '0123456789'} onCopy={() => copyAccount('0123456789')} />
          <AccountBlock copy={copy} title={copy.brideFamily} name="TRAN THI LAN" account="9876543210" copied={copied === '9876543210'} onCopy={() => copyAccount('9876543210')} />
        </div>
      )}
    </div>
  )
}

function AccountBlock(props: { copy: WeddingCard3dCopy; title: string; name: string; account: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.72)' }}>
      <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: ROSE }}>{props.title}</p>
      <p className="mt-1 text-sm">{props.copy.bank}</p>
      <p className="font-serif text-lg">{props.account}</p>
      <p className="text-sm" style={{ color: MUTED }}>{props.name}</p>
      <CardButton onClick={props.onCopy}>{props.copied ? props.copy.copied : props.copy.copyAccount}</CardButton>
    </div>
  )
}

function RsvpPage(props: { shared: PageShared }) {
  const { copy, guestName, setGuestName, choice, setChoice, wish, setWish, rsvpNote, submitRsvp } = props.shared
  return (
    <form className="card3d-page" onSubmit={(event) => { event.preventDefault(); submitRsvp() }}>
      <Kicker>{copy.rsvp}</Kicker>
      <label className="mt-4 block text-sm font-semibold">{copy.guestName}
        <input className="card3d-field" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="card3d-choice" aria-pressed={choice === 'yes'} onClick={() => setChoice('yes')}>{copy.attendYes}</button>
        <button type="button" className="card3d-choice is-quiet" aria-pressed={choice === 'no'} onClick={() => setChoice('no')}>{copy.attendNo}</button>
      </div>
      <label className="mt-3 block text-sm font-semibold">{copy.wish}
        <textarea className="card3d-field min-h-24" value={wish} placeholder={copy.wishPlaceholder} onChange={(event) => setWish(event.target.value)} />
      </label>
      <CardButton onClick={submitRsvp}>{copy.submit}</CardButton>
      {rsvpNote ? <p className="mt-2 text-center text-sm" style={{ color: ROSE }}>{rsvpNote}</p> : null}
    </form>
  )
}

function ReminderPage(props: { shared: PageShared }) {
  const { copy, email, setEmail, daysBefore, setDaysBefore, reminderNote, saveReminder } = props.shared
  return (
    <form className="card3d-page" onSubmit={(event) => { event.preventDefault(); saveReminder() }}>
      <Kicker>{copy.reminder}</Kicker>
      <p className="mt-3 text-sm leading-6" style={{ color: MUTED }}>{copy.reminderHint}</p>
      <label className="mt-3 block text-sm font-semibold">{copy.email}
        <input className="card3d-field" type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="mt-3 block text-sm font-semibold">{copy.daysBefore}
        <input className="card3d-field" inputMode="numeric" value={daysBefore} onChange={(event) => setDaysBefore(event.target.value)} />
      </label>
      <CardButton onClick={saveReminder}>{copy.saveReminder}</CardButton>
      {reminderNote ? <p className="mt-2 text-center text-sm" style={{ color: ROSE }}>{reminderNote}</p> : null}
    </form>
  )
}

function ThanksPage(props: { copy: WeddingCard3dCopy }) {
  const { copy } = props
  return (
    <div className="card3d-page flex flex-col items-center justify-center text-center">
      <Kicker>{copy.thanksTitle}</Kicker>
      <p className="mt-4 font-serif text-2xl" style={{ color: ROSE }}>{copy.groom}</p>
      <p className="font-serif text-lg" style={{ color: ROSE }}>&</p>
      <p className="font-serif text-2xl" style={{ color: ROSE }}>{copy.bride}</p>
      <p className="mt-4 text-[15px] leading-7">{copy.thanks}</p>
      <p className="mt-4 text-sm tracking-[0.14em]" style={{ color: MUTED }}>{copy.date}</p>
    </div>
  )
}

function Kicker(props: { children: ReactNode }) {
  return <p className="text-center text-[11px] uppercase tracking-[0.28em]" style={{ color: ROSE }}>{props.children}</p>
}

function CardButton(props: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="card3d-action" onClick={props.onClick}>{props.children}</button>
}

function CardLink(props: { href: string; children: ReactNode }) {
  return <a className="card3d-action" href={props.href} target="_blank" rel="noreferrer">{props.children}</a>
}

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])
  const diff = Math.max(0, new Date(iso).getTime() - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  }
}

const paperStyle: CSSProperties = {
  backgroundColor: '#f7e4e8',
  backgroundImage: `url(${WASH})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  boxShadow: 'inset 0 0 0 1px rgba(255,250,246,0.85), inset 0 0 0 2px rgba(168, 112, 104, 0.32)',
}

function PaperRim() {
  const edge = 'linear-gradient(90deg, #e7d4c8, #fffaf6 42%, #d9c2b4)'
  return (
    <>
      <div className="card3d-rim card3d-rim-left" style={{ background: edge }} />
      <div className="card3d-rim card3d-rim-right" style={{ background: edge }} />
      <div className="card3d-rim card3d-rim-top" style={{ background: 'linear-gradient(#fffaf6, #e6d3c7)' }} />
      <div className="card3d-rim card3d-rim-bottom" style={{ background: 'linear-gradient(#e6d3c7, #fffaf6)' }} />
    </>
  )
}

const FACE_CSS = `
.card3d-rig, .card3d-book, .card3d-sheet, .card3d-leaf {
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
}
.card3d-book, .card3d-sheet, .card3d-leaf { position: absolute; inset: 0; }
.card3d-leaf { transform-origin: left center; }
.card3d-leaf.is-animated { transition: transform 720ms cubic-bezier(0.22, 1, 0.36, 1); }
.card3d-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.card3d-face:first-child { transform: translateZ(0.4px); }
.card3d-back { background-color: #f7e4e8; }
.card3d-page {
  height: 100%;
  overflow: auto;
  padding: 1.15rem 1rem 1.35rem;
  touch-action: pan-y;
  overscroll-behavior: contain;
  font-size: 16px;
}
.card3d-action {
  margin-top: 0.55rem;
  display: flex;
  min-height: 44px;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: ${ROSE};
  color: #fffaf6;
  padding: 0 0.8rem;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}
.card3d-open {
  display: flex;
  min-height: 48px;
  width: min(100%, 36rem);
  margin: 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: ${ROSE};
  color: #fffaf6;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 12px 28px rgba(157, 78, 99, 0.34);
}
.card3d-nav, .card3d-chip {
  min-height: 44px;
  border-radius: 999px;
  background: ${PAPER};
  color: ${ROSE};
  padding: 0 0.9rem;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(90, 40, 52, 0.12);
}
.card3d-nav { flex: 1; }
.card3d-nav:disabled { opacity: 0.38; }
.card3d-chip { flex: 0 0 auto; }
.card3d-chip[aria-current='page'] { background: ${ROSE}; color: #fffaf6; }
.card3d-field {
  margin-top: 0.35rem;
  display: block;
  width: 100%;
  min-height: 44px;
  border-radius: 0.9rem;
  border: 1px solid rgba(168, 112, 104, 0.45);
  background: #fff;
  padding: 0.55rem 0.75rem;
  font-size: 16px;
  color: ${INK};
}
.card3d-choice {
  min-height: 44px;
  border-radius: 999px;
  background: ${ROSE};
  color: #fffaf6;
  font-size: 14px;
  font-weight: 700;
}
.card3d-choice.is-quiet { background: #fff; color: ${INK}; box-shadow: inset 0 0 0 1px rgba(168, 112, 104, 0.45); }
.card3d-choice[aria-pressed='true'] { box-shadow: 0 0 0 2px #fff, 0 0 0 4px ${ROSE}; }
.card3d-floor {
  position: absolute;
  left: -8%;
  top: 97%;
  width: 116%;
  height: 18%;
  background: radial-gradient(ellipse at center, rgba(74, 32, 42, 0.32), transparent 70%);
  transform: rotateX(72deg);
  transform-origin: center top;
  pointer-events: none;
}
.card3d-rim { position: absolute; pointer-events: none; }
.card3d-rim-left, .card3d-rim-right { top: 0; width: 10px; height: 100%; }
.card3d-rim-left { left: 0; transform-origin: left center; transform: rotateY(-90deg); }
.card3d-rim-right { right: 0; transform-origin: right center; transform: rotateY(90deg); }
.card3d-rim-top, .card3d-rim-bottom { left: 0; width: 100%; height: 10px; }
.card3d-rim-top { top: 0; transform-origin: center top; transform: rotateX(90deg); }
.card3d-rim-bottom { bottom: 0; transform-origin: center bottom; transform: rotateX(-90deg); }
@media (prefers-reduced-motion: reduce) {
  .card3d-leaf.is-animated { transition: none; }
}
`
