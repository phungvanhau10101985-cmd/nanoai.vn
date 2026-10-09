import { normalizeGuestNameKey } from './wedding-guest-invite-link'

type AttendanceStatus = 'pending' | 'attending' | 'declined'

export type WeddingAttendanceBucket = {
  guestsAttending: number
  peopleAttending: number
  guestsDeclined: number
  peopleDeclined: number
  guestsPending: number
}

export type WeddingAttendanceSummary = {
  total: WeddingAttendanceBucket
  groom: WeddingAttendanceBucket
  bride: WeddingAttendanceBucket
  outside: WeddingAttendanceBucket
}

export type WeddingAttendanceGuestSource = {
  guestHonorific: string
  guestName: string
  inviteVenue: string
  status: AttendanceStatus
  guestCount: number
  adultCount: number
  childCount: number
}

export type WeddingAttendanceRsvpSource = {
  guestName: string
  attending: boolean
  guestCount: number
  adultCount: number
  childCount: number
  message?: string
  createdAt?: string
}

type AttendancePerson = {
  side: 'groom' | 'bride' | 'outside'
  status: AttendanceStatus
  guestCount: number
  adultCount: number
  childCount: number
}

export function emptyWeddingAttendanceBucket(): WeddingAttendanceBucket {
  return {
    guestsAttending: 0,
    peopleAttending: 0,
    guestsDeclined: 0,
    peopleDeclined: 0,
    guestsPending: 0,
  }
}

/** Số người của một khách đã trả lời. Chưa phản hồi = 0. Báo không đi mà mất số thì tính 1 người. */
export function weddingResponseHeadcount(input: {
  status: AttendanceStatus
  guestCount: number
  adultCount: number
  childCount: number
}): number {
  if (input.status === 'pending') return 0
  const party = Math.max(0, input.adultCount) + Math.max(0, input.childCount)
  if (party > 0) return party
  const count = Math.max(0, input.guestCount)
  if (count > 0) return count
  return 1
}

function addPerson(bucket: WeddingAttendanceBucket, person: AttendancePerson) {
  const heads = weddingResponseHeadcount(person)
  if (person.status === 'attending') {
    bucket.guestsAttending += 1
    bucket.peopleAttending += heads
  } else if (person.status === 'declined') {
    bucket.guestsDeclined += 1
    bucket.peopleDeclined += heads
  } else {
    bucket.guestsPending += 1
  }
}

function addBuckets(target: WeddingAttendanceBucket, source: WeddingAttendanceBucket) {
  target.guestsAttending += source.guestsAttending
  target.peopleAttending += source.peopleAttending
  target.guestsDeclined += source.guestsDeclined
  target.peopleDeclined += source.peopleDeclined
  target.guestsPending += source.guestsPending
}

export function buildAttendancePeople(
  guests: WeddingAttendanceGuestSource[],
  rsvps: WeddingAttendanceRsvpSource[],
): AttendancePerson[] {
  const keys = new Set<string>()
  const people: AttendancePerson[] = []
  for (const guest of guests) {
    const name = guest.guestName.trim()
    if (!name) continue
    const display = [guest.guestHonorific.trim(), name].filter(Boolean).join(' ')
    const displayKey = normalizeGuestNameKey(display)
    const nameKey = normalizeGuestNameKey(name)
    if (displayKey) keys.add(displayKey)
    if (nameKey) keys.add(nameKey)
    people.push({
      side: guest.inviteVenue === 'bride_home' ? 'bride' : 'groom',
      status: guest.status,
      guestCount: guest.guestCount,
      adultCount: guest.adultCount,
      childCount: guest.childCount,
    })
  }
  for (const rsvp of rsvps) {
    const key = normalizeGuestNameKey(rsvp.guestName)
    if (!key || keys.has(key)) continue
    people.push({
      side: 'outside',
      status: rsvp.attending ? 'attending' : 'declined',
      guestCount: rsvp.guestCount,
      adultCount: rsvp.adultCount,
      childCount: rsvp.childCount,
    })
  }
  return people
}

export function summarizeWeddingAttendance(people: AttendancePerson[]): WeddingAttendanceSummary {
  const groom = emptyWeddingAttendanceBucket()
  const bride = emptyWeddingAttendanceBucket()
  const outside = emptyWeddingAttendanceBucket()
  for (const person of people) {
    const bucket = person.side === 'bride' ? bride : person.side === 'outside' ? outside : groom
    addPerson(bucket, person)
  }
  const total = emptyWeddingAttendanceBucket()
  addBuckets(total, groom)
  addBuckets(total, bride)
  addBuckets(total, outside)
  return { total, groom, bride, outside }
}

export function summarizeWeddingAttendanceSources(
  guests: WeddingAttendanceGuestSource[],
  rsvps: WeddingAttendanceRsvpSource[],
): WeddingAttendanceSummary {
  return summarizeWeddingAttendance(buildAttendancePeople(guests, rsvps))
}

export function findOutsideRsvps(
  guests: WeddingAttendanceGuestSource[],
  rsvps: WeddingAttendanceRsvpSource[],
): WeddingAttendanceRsvpSource[] {
  const keys = new Set<string>()
  for (const guest of guests) {
    const name = guest.guestName.trim()
    if (!name) continue
    const key = normalizeGuestNameKey(name)
    if (key) keys.add(key)
    const full = normalizeGuestNameKey([guest.guestHonorific, name].filter(Boolean).join(' '))
    if (full) keys.add(full)
  }
  const outside: WeddingAttendanceRsvpSource[] = []
  const seenOutside = new Set<string>()
  for (const rsvp of rsvps) {
    const key = normalizeGuestNameKey(rsvp.guestName)
    if (!key || keys.has(key) || seenOutside.has(key)) continue
    seenOutside.add(key)
    outside.push(rsvp)
  }
  return outside
}

/** Một thư mỗi ngày, chỉ khi số người đi tăng. Nhiều khách trong ngày vẫn một lần gửi. */
export function planDailyAttendanceMail(input: {
  enabled: boolean
  baselineSet: boolean
  lastPeople: number
  currentPeople: number
  hasRecipient: boolean
  alreadySentToday: boolean
}): { send: boolean; nextBaseline: number; setBaseline: boolean; lowerBaseline: boolean } {
  const quiet = { send: false, nextBaseline: input.lastPeople, setBaseline: false, lowerBaseline: false }
  if (!input.enabled || !input.hasRecipient || input.alreadySentToday) return quiet
  if (!input.baselineSet) {
    return { send: false, nextBaseline: input.currentPeople, setBaseline: true, lowerBaseline: false }
  }
  if (input.currentPeople > input.lastPeople) {
    return { send: true, nextBaseline: input.currentPeople, setBaseline: false, lowerBaseline: false }
  }
  if (input.currentPeople < input.lastPeople) {
    return { send: false, nextBaseline: input.currentPeople, setBaseline: false, lowerBaseline: true }
  }
  return quiet
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

export function weddingNotifyRecipients(groomEmail: string, brideEmail: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [groomEmail, brideEmail]) {
    const email = raw.trim().toLowerCase()
    if (!email || seen.has(email) || !EMAIL_RE.test(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}
