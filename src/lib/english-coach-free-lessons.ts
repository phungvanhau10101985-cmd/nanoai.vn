import type { LanguageLandingCopy } from '@/lib/hoc-ngoai-ngu/landing-copy'

/** Số buổi live đầu mỗi tài khoản được mở, không trừ credit. */
export const FREE_LIVE_LESSON_LIMIT = 2

const LIVE_FACT_TERMS = new Set(['Buổi live', 'Live session', '直播课', 'ライブ', '라이브'])

export function nextLiveStartKind(input: { alreadyStarted: boolean; freeUsed: number }): 'already' | 'free' | 'paid' {
  if (input.alreadyStarted) return 'already'
  if (input.freeUsed < FREE_LIVE_LESSON_LIMIT) return 'free'
  return 'paid'
}

/** Hết suất miễn phí thì không mở trang giới thiệu nữa. */
export function shouldLeaveLanguageLanding(freeUsed: number): boolean {
  return Math.max(0, Math.floor(Number(freeUsed) || 0)) >= FREE_LIVE_LESSON_LIMIT
}

function localeKey(locale: string): 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'th' | 'hi' {
  const code = String(locale || '').trim().toLowerCase()
  if (code === 'vi' || code === 'zh' || code === 'ja' || code === 'ko' || code === 'th' || code === 'hi') return code
  return 'en'
}

function paidCreditLabel(locale: string, paidCredits: number): string {
  const amount = Number.isFinite(paidCredits) ? paidCredits : 3.5
  const text = localeKey(locale) === 'vi' ? String(amount).replace('.', ',') : String(amount)
  if (localeKey(locale) === 'zh') return `${text} 积分`
  if (localeKey(locale) === 'ja') return `${text} クレジット`
  if (localeKey(locale) === 'ko') return `${text} 크레딧`
  if (localeKey(locale) === 'th') return `${text} เครดิต`
  if (localeKey(locale) === 'hi') return `${text} क्रेडिट`
  if (localeKey(locale) === 'vi') return `${text} credit`
  return `${text} credits`
}

export function freeLiveChoiceLabel(
  locale: string,
  remaining: number,
  loginRequired: boolean,
  paidCredits = 3.5
): string {
  const left = Math.max(0, Math.floor(remaining))
  const code = localeKey(locale)
  if (loginRequired) {
    if (code === 'vi') return 'Đăng nhập để học 2 buổi miễn phí'
    if (code === 'zh') return '登录后可免费上 2 节'
    if (code === 'ja') return 'ログインで最初の2回が無料'
    if (code === 'ko') return '로그인하면 2회 무료'
    if (code === 'th') return 'เข้าสู่ระบบเพื่อเรียนฟรี 2 ครั้ง'
    if (code === 'hi') return 'लॉग इन करें, 2 मुफ़्त पाठ'
    return 'Sign in for 2 free lessons'
  }
  if (left > 0) {
    if (code === 'vi') return `Miễn phí, còn ${left} buổi`
    if (code === 'zh') return `免费，还剩 ${left} 节`
    if (code === 'ja') return `無料、残り ${left} 回`
    if (code === 'ko') return `무료, ${left}회 남음`
    if (code === 'th') return `ฟรี เหลือ ${left} ครั้ง`
    if (code === 'hi') return `मुफ़्त, ${left} बाकी`
    return `Free, ${left} left`
  }
  return paidCreditLabel(locale, paidCredits)
}

export function freeLiveThisLessonLabel(locale: string): string {
  const code = localeKey(locale)
  if (code === 'vi') return 'Buổi này miễn phí.'
  if (code === 'zh') return '这节课免费。'
  if (code === 'ja') return 'この回は無料です。'
  if (code === 'ko') return '이번 수업은 무료입니다.'
  if (code === 'th') return 'ครั้งนี้ฟรี'
  if (code === 'hi') return 'यह पाठ मुफ़्त है।'
  return 'This lesson is free.'
}

export function freeLiveLoginMessage(locale: string): string {
  const code = localeKey(locale)
  if (code === 'vi') return 'Đăng nhập để học 2 buổi live miễn phí. Mỗi buổi có 10 lượt nói.'
  if (code === 'zh') return '请登录。前两节直播免费，每节 10 轮。'
  if (code === 'ja') return 'ログインすると、ライブの最初の2回が無料です。1回につき10ターンです。'
  if (code === 'ko') return '로그인하면 라이브 처음 2회가 무료입니다. 한 번에 10턴입니다.'
  if (code === 'th') return 'เข้าสู่ระบบเพื่อเรียนไลฟ์ฟรี 2 ครั้ง ครั้งละ 10 เทิร์น'
  if (code === 'hi') return 'लॉग इन करें। पहले 2 लाइव पाठ मुफ़्त हैं, हर पाठ में 10 बारी।'
  return 'Sign in for 2 free live lessons. Each lesson includes 10 speaking turns.'
}

export function freeLiveStartToast(
  locale: string,
  input: { already: boolean; remaining: number; balance: number }
): { title: string; description: string } {
  const left = Math.max(0, Math.floor(input.remaining))
  const balance = Number.isFinite(input.balance) ? input.balance.toFixed(2) : '0.00'
  const code = localeKey(locale)
  if (code === 'vi') {
    return {
      title: input.already ? 'Buổi live miễn phí đã mở trước đó' : 'Đã mở buổi live miễn phí',
      description: `Không trừ credit. Còn ${left} buổi miễn phí. Số dư ${balance}.`,
    }
  }
  if (code === 'zh') {
    return {
      title: input.already ? '这节免费直播已经开过' : '已打开免费直播课',
      description: `未扣积分。还剩 ${left} 节免费课。余额 ${balance}。`,
    }
  }
  if (code === 'ja') {
    return {
      title: input.already ? 'この無料ライブは開いてあります' : '無料ライブを開きました',
      description: `クレジットは引きません。無料は残り ${left} 回。残高 ${balance}。`,
    }
  }
  if (code === 'ko') {
    return {
      title: input.already ? '이 무료 라이브는 이미 열려 있습니다' : '무료 라이브를 열었습니다',
      description: `크레딧을 빼지 않습니다. 무료 ${left}회 남음. 잔액 ${balance}.`,
    }
  }
  if (code === 'th') {
    return {
      title: input.already ? 'ไลฟ์ฟรีนี้เปิดไว้แล้ว' : 'เปิดไลฟ์ฟรีแล้ว',
      description: `ไม่หักเครดิต เหลือฟรี ${left} ครั้ง ยอดคงเหลือ ${balance}`,
    }
  }
  if (code === 'hi') {
    return {
      title: input.already ? 'यह मुफ़्त लाइव पहले खुल चुका है' : 'मुफ़्त लाइव खुल गया',
      description: `क्रेडिट नहीं कटा। ${left} मुफ़्त पाठ बचे हैं। शेष ${balance}.`,
    }
  }
  return {
    title: input.already ? 'This free live lesson was already opened' : 'Free live lesson opened',
    description: `No credits deducted. ${left} free lesson(s) left. Balance ${balance}.`,
  }
}

function isLivePriceQuestion(question: string): boolean {
  return /giá bao nhiêu|how much is one live|多少钱|いくら|얼마/i.test(question)
}

/** Câu khách phải thấy ngay trên trang giới thiệu. */
export function freeLiveTrialHeadline(locale: string): string {
  const code = localeKey(locale)
  if (code === 'vi') return 'Học thử miễn phí 2 bài live'
  if (code === 'zh') return '免费试学 2 节直播'
  if (code === 'ja') return 'ライブ2回を無料で試す'
  if (code === 'ko') return '라이브 2회 무료 체험'
  if (code === 'th') return 'ลองเรียนไลฟ์ฟรี 2 บท'
  if (code === 'hi') return '2 लाइव पाठ मुफ़्त आज़माएँ'
  return 'Try 2 live lessons free'
}

function freeLiveNote(locale: string): string {
  const code = localeKey(locale)
  if (code === 'vi') return 'Học thử miễn phí 2 bài live, mỗi bài 10 lượt.'
  if (code === 'zh') return '免费试学 2 节直播，每节 10 轮。'
  if (code === 'ja') return 'ライブ2回を無料で試せます。1回10ターンです。'
  if (code === 'ko') return '라이브 2회 무료 체험, 한 번에 10턴입니다.'
  return 'Try 2 live lessons free, 10 turns each.'
}

/** Gắn câu miễn phí lên trang giới thiệu sau khi đã điền giá buổi trả phí. */
export function patchFreeLiveOffer(copy: LanguageLandingCopy, locale: string): LanguageLandingCopy {
  const note = freeLiveNote(locale)
  const headline = freeLiveTrialHeadline(locale)
  const lead = copy.lead.includes(note) ? copy.lead : `${copy.lead} ${note}`
  return {
    ...copy,
    lead,
    cta: headline,
    facts: copy.facts.map((fact) =>
      LIVE_FACT_TERMS.has(fact.term) && !fact.detail.includes(note)
        ? { ...fact, detail: `${note} ${fact.detail}` }
        : fact
    ),
    modes: copy.modes.map((mode) =>
      mode.id === 'live'
        ? {
            ...mode,
            price: headline,
            detail: mode.detail.includes(note) ? mode.detail : `${note} ${mode.detail}`,
            action: headline,
          }
        : mode
    ),
    faqs: copy.faqs.map((item) =>
      isLivePriceQuestion(item.question) && !item.answer.startsWith(note)
        ? { ...item, answer: `${note} ${item.answer}` }
        : item
    ),
  }
}
