import type { WebLocale } from '@/lib/i18n/config'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'

/** Gói học sinh: hỗ trợ chữa bài và gia sư, mọi cấp. Học ngoại ngữ tính riêng. */
export const STUDENT_STUDY_PACKAGE_ID = 'student' as const

export const STUDENT_STUDY_TRIAL_DAYS = 6

export const STUDENT_STUDY_CHARGE_TYPE = 'monthly_service_student'

export const STUDENT_STUDY_INCLUDES = [
  { id: 'homework_help', href: '/ho-tro-lam-bai' },
  { id: 'ai_tutor', href: '/gia-su-ai' },
] as const

export const STUDENT_STUDY_PLANS = [
  { id: 'month', days: 30, priceVnd: 39_000 },
  { id: 'quarter', days: 90, priceVnd: 99_000 },
  { id: 'year', days: 365, priceVnd: 360_000 },
] as const

export type StudentStudyPlanId = (typeof STUDENT_STUDY_PLANS)[number]['id']

const PLAN_BY_ID = new Map(STUDENT_STUDY_PLANS.map((plan) => [plan.id, plan]))

export function studentStudyPlanById(id: string): (typeof STUDENT_STUDY_PLANS)[number] | null {
  return PLAN_BY_ID.get(id as StudentStudyPlanId) ?? null
}

/** Credit trừ trong ví, khớp giá VND theo 6.000₫/credit. */
export function studentStudyPlanCredits(priceVnd: number): number {
  return Math.round((priceVnd / CREDIT_UNIT_PRICE_VND) * 100) / 100
}

const MS_PER_DAY = 86_400_000

export function studentStudyTrialEndsAt(
  userCreatedAtIso: string | null | undefined,
  now = new Date()
): Date | null {
  void now
  if (!userCreatedAtIso) return null
  const t = Date.parse(userCreatedAtIso)
  if (Number.isNaN(t)) return null
  return new Date(t + STUDENT_STUDY_TRIAL_DAYS * MS_PER_DAY)
}

export function isStudentStudyTrialActive(
  userCreatedAtIso: string | null | undefined,
  now = new Date()
): boolean {
  const end = studentStudyTrialEndsAt(userCreatedAtIso)
  if (!end) return false
  return now.getTime() < end.getTime()
}

export function studentStudyTrialDaysRemaining(
  userCreatedAtIso: string | null | undefined,
  now = new Date()
): number {
  const end = studentStudyTrialEndsAt(userCreatedAtIso)
  if (!end || now.getTime() >= end.getTime()) return 0
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY))
}

/** Gia hạn từ mốc muộn nhất còn hiệu lực (đã mua hoặc còn tuần dùng thử). */
export function nextStudentStudyAccessEnd(input: {
  paidEndsAt: Date | null
  trialEndsAt: Date | null
  days: number
  now?: Date
}): Date {
  const now = input.now ?? new Date()
  let baseMs = now.getTime()
  if (input.paidEndsAt && input.paidEndsAt.getTime() > baseMs) baseMs = input.paidEndsAt.getTime()
  if (input.trialEndsAt && input.trialEndsAt.getTime() > baseMs) baseMs = input.trialEndsAt.getTime()
  const truncated = Math.floor(baseMs / 1000) * 1000
  return new Date(truncated + input.days * MS_PER_DAY)
}

export function studentStudyPurchaseEventKey(userId: string, planId: StudentStudyPlanId, accessEndsAt: Date): string {
  const uid = String(userId || '').trim().toLowerCase()
  return `student_study:${uid}:${planId}:${accessEndsAt.toISOString()}`
}

export type StudentStudyPackageCopy = {
  title: string
  lead: string
  audience: string
  includesTitle: string
  homework: string
  tutor: string
  trialNote: string
  trialActive: string
  accessUntil: string
  excludesLanguage: string
  buying: string
  buySuccess: string
  buyAlready: string
  buyInsufficient: string
  planMonth: string
  planQuarter: string
  planYear: string
  priceLine: string
  gateTitle: string
  gateBody: string
  gateWallet: string
}

const COPY: Record<WebLocale, StudentStudyPackageCopy> = {
  vi: {
    title: 'Gói học sinh',
    lead: 'Hỗ trợ chữa bài và gia sư cho học sinh mọi cấp.',
    audience: 'Tiểu học, trung học và các cấp khác đều dùng được.',
    includesTitle: 'Trong gói',
    homework: 'Hỗ trợ chữa bài — chụp hoặc gõ đề, xem hướng làm, rồi đối chiếu bài của mình.',
    tutor: 'Gia sư — chat riêng, giải thích dễ hiểu và ví dụ thực tế.',
    trialNote: 'Học thử {days} ngày kể từ khi tạo tài khoản. Hết thử thì mua gói.',
    trialActive: 'Đang học thử — còn khoảng {days} ngày.',
    accessUntil: 'Gói dùng đến {datetime}.',
    excludesLanguage: 'Học ngoại ngữ AI không nằm trong gói này. Luyện nói trả theo từng buổi.',
    buying: 'Đang trừ credit…',
    buySuccess: 'Đã mở gói đến {datetime}.',
    buyAlready: 'Gói này đã được ghi cho mốc hết hạn đó.',
    buyInsufficient: 'Không đủ credit. Gói này cần {credits} credit ({price}₫).',
    planMonth: '1 tháng',
    planQuarter: '3 tháng',
    planYear: '1 năm',
    priceLine: '{price}₫ · trừ {credits} credit',
    gateTitle: 'Hết thời gian học thử',
    gateBody: 'Mua gói học sinh để tiếp tục dùng hỗ trợ chữa bài và gia sư.',
    gateWallet: 'Nạp credit',
  },
  en: {
    title: 'Student plan',
    lead: 'Homework help and a tutor for students at any grade.',
    audience: 'Primary, secondary, and other levels can all use it.',
    includesTitle: 'Included',
    homework: 'Homework help — photo or type a problem, see how to think it through, then check your work.',
    tutor: 'Tutor — a private chat with a plain explanation and a real-life example.',
    trialNote: '{days}-day trial from account creation. Buy a plan when it ends.',
    trialActive: 'Trial in progress — about {days} day(s) left.',
    accessUntil: 'Plan active until {datetime}.',
    excludesLanguage: 'AI language practice is not in this plan. It is billed per session.',
    buying: 'Charging credits…',
    buySuccess: 'Plan is active until {datetime}.',
    buyAlready: 'This plan was already recorded for that end date.',
    buyInsufficient: 'Not enough credits. This plan needs {credits} credits ({price}₫).',
    planMonth: '1 month',
    planQuarter: '3 months',
    planYear: '1 year',
    priceLine: '{price}₫ · {credits} credits',
    gateTitle: 'Your trial has ended',
    gateBody: 'Buy the student plan to keep using homework help and the tutor.',
    gateWallet: 'Top up credits',
  },
  zh: {
    title: '学生套餐',
    lead: '作业批改和家教，面向所有年级的学生。',
    audience: '小学、中学和其他学段都可以用。',
    includesTitle: '包含',
    homework: '作业辅导 — 拍照或输入题目，先看思路，再对照自己的解答。',
    tutor: '家教 — 单独聊天，用好懂的话和现实例子讲解。',
    trialNote: '自注册起可试用 {days} 天。结束后购买套餐。',
    trialActive: '试用中 — 大约还剩 {days} 天。',
    accessUntil: '套餐有效期至 {datetime}。',
    excludesLanguage: 'AI 外语练习不在此套餐内，按每次会话计费。',
    buying: '正在扣除积分…',
    buySuccess: '套餐有效期至 {datetime}。',
    buyAlready: '该到期时间的套餐已经记过。',
    buyInsufficient: '积分不足。此套餐需要 {credits} 积分（{price}₫）。',
    planMonth: '1 个月',
    planQuarter: '3 个月',
    planYear: '1 年',
    priceLine: '{price}₫ · 扣 {credits} 积分',
    gateTitle: '试用已结束',
    gateBody: '购买学生套餐后可继续使用作业辅导和家教。',
    gateWallet: '充值积分',
  },
  ja: {
    title: '生徒プラン',
    lead: '宿題の添削とチューター。すべての学年の生徒向けです。',
    audience: '小学校、中学・高校、その他の段階でも使えます。',
    includesTitle: '含まれるもの',
    homework: '宿題サポート — 問題を撮影または入力し、考え方を見てから自分の答案を照合。',
    tutor: 'チューター — 個別チャットで、わかりやすい説明と実例。',
    trialNote: '登録から {days} 日間お試し。終了後にプランを購入します。',
    trialActive: 'お試し中 — 残り約 {days} 日。',
    accessUntil: '{datetime} まで利用できます。',
    excludesLanguage: 'AI語学練習はこのプランに含まれません。回ごとの課金です。',
    buying: 'クレジットを差し引き中…',
    buySuccess: '{datetime} まで開通しました。',
    buyAlready: 'その終了日時のプランは記録済みです。',
    buyInsufficient: 'クレジットが足りません。このプランは {credits} クレジット（{price}₫）必要です。',
    planMonth: '1か月',
    planQuarter: '3か月',
    planYear: '1年',
    priceLine: '{price}₫ · {credits} クレジット',
    gateTitle: 'お試し期間が終わりました',
    gateBody: '宿題サポートとチューターを続けるには生徒プランを購入してください。',
    gateWallet: 'クレジットをチャージ',
  },
  ko: {
    title: '학생 요금제',
    lead: '숙제 첨삭과 튜터. 모든 학년의 학생용입니다.',
    audience: '초등, 중등, 그 밖의 과정도 쓸 수 있습니다.',
    includesTitle: '포함',
    homework: '숙제 도움 — 문제를 찍거나 입력하고, 풀이 방향을 본 뒤 내 답을 대조합니다.',
    tutor: '튜터 — 1:1 채팅, 쉬운 설명과 실제 예시.',
    trialNote: '가입일부터 {days}일 체험. 끝나면 요금제를 구매합니다.',
    trialActive: '체험 중 — 약 {days}일 남음.',
    accessUntil: '{datetime}까지 이용할 수 있습니다.',
    excludesLanguage: 'AI 외국어 연습은 이 요금제에 없습니다. 회차별로 결제합니다.',
    buying: '크레딧 차감 중…',
    buySuccess: '{datetime}까지 열렸습니다.',
    buyAlready: '그 만료 시각의 요금제는 이미 기록되었습니다.',
    buyInsufficient: '크레딧이 부족합니다. 이 요금제는 {credits} 크레딧({price}₫)이 필요합니다.',
    planMonth: '1개월',
    planQuarter: '3개월',
    planYear: '1년',
    priceLine: '{price}₫ · {credits} 크레딧',
    gateTitle: '체험 기간이 끝났습니다',
    gateBody: '숙제 도움과 튜터를 계속 쓰려면 학생 요금제를 구매하세요.',
    gateWallet: '크레딧 충전',
  },
}

export function studentStudyPackageCopy(locale: WebLocale): StudentStudyPackageCopy {
  return COPY[locale] ?? COPY.vi
}

export function studentStudyPlanLabel(locale: WebLocale, planId: StudentStudyPlanId): string {
  const copy = studentStudyPackageCopy(locale)
  if (planId === 'month') return copy.planMonth
  if (planId === 'quarter') return copy.planQuarter
  return copy.planYear
}
