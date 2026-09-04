import type { WebLocale } from '@/lib/i18n/config'

export type BirthGenderPromptCopy = {
  title: string
  lead: string
  leadNamed: string
  dobLegend: string
  day: string
  month: string
  year: string
  monthLabels: string[]
  gender: string
  male: string
  female: string
  needDob: string
  invalidDob: string
  futureDob: string
  needGender: string
  saveFailed: string
  defer: string
  save: string
  close: string
  savedTitle: string
  savedBody: string
}

export const BIRTH_GENDER_PROMPT_COPY: Record<WebLocale, BirthGenderPromptCopy> = {
  vi: {
    title: 'Nhận ưu đãi sinh nhật',
    lead: 'Cập nhật ngày sinh và giới tính để shop gửi chương trình sale và gợi ý phù hợp dịp sinh nhật của bạn.',
    leadNamed:
      'Cập nhật ngày sinh và giới tính để {shop} gửi chương trình sale và gợi ý phù hợp dịp sinh nhật của bạn.',
    dobLegend: 'Ngày sinh',
    day: 'Ngày',
    month: 'Tháng',
    year: 'Năm',
    monthLabels: Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`),
    gender: 'Giới tính',
    male: 'Nam',
    female: 'Nữ',
    needDob: 'Vui lòng chọn đủ ngày, tháng và năm sinh.',
    invalidDob: 'Ngày sinh không hợp lệ (kiểm tra ngày/tháng/năm).',
    futureDob: 'Ngày sinh không được sau hôm nay.',
    needGender: 'Vui lòng chọn giới tính.',
    saveFailed: 'Không lưu được. Vui lòng thử lại.',
    defer: 'Để sau',
    save: 'Lưu thông tin',
    close: 'Đóng',
    savedTitle: 'Đã lưu thông tin',
    savedBody: 'Chúng tôi sẽ gửi ưu đãi phù hợp dịp sinh nhật của bạn.',
  },
  en: {
    title: 'Get your birthday offer',
    lead: 'Add your date of birth and gender so the shop can send birthday sales and matching picks.',
    leadNamed:
      'Add your date of birth and gender so {shop} can send birthday sales and matching picks.',
    dobLegend: 'Date of birth',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    monthLabels: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    needDob: 'Please select day, month, and year of birth.',
    invalidDob: 'That date of birth is not valid. Check day, month, and year.',
    futureDob: 'Date of birth cannot be later than today.',
    needGender: 'Please select a gender.',
    saveFailed: 'Could not save. Please try again.',
    defer: 'Later',
    save: 'Save',
    close: 'Close',
    savedTitle: 'Details saved',
    savedBody: 'We will send matching offers around your birthday.',
  },
  zh: {
    title: '领取生日优惠',
    lead: '填写出生日期和性别，店铺即可在生日时发送促销与个性化推荐。',
    leadNamed: '填写出生日期和性别，{shop} 即可在生日时发送促销与个性化推荐。',
    dobLegend: '出生日期',
    day: '日',
    month: '月',
    year: '年',
    monthLabels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
    gender: '性别',
    male: '男',
    female: '女',
    needDob: '请选择完整的出生年、月、日。',
    invalidDob: '出生日期无效，请检查年/月/日。',
    futureDob: '出生日期不能晚于今天。',
    needGender: '请选择性别。',
    saveFailed: '保存失败，请重试。',
    defer: '以后再说',
    save: '保存资料',
    close: '关闭',
    savedTitle: '已保存',
    savedBody: '我们会在生日期间发送适合你的优惠。',
  },
  ja: {
    title: '誕生日特典を受け取る',
    lead: '生年月日と性別を登録すると、ショップが誕生日セールとおすすめをお届けします。',
    leadNamed: '生年月日と性別を登録すると、{shop} が誕生日セールとおすすめをお届けします。',
    dobLegend: '生年月日',
    day: '日',
    month: '月',
    year: '年',
    monthLabels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
    gender: '性別',
    male: '男性',
    female: '女性',
    needDob: '生年月日を日・月・年すべて選んでください。',
    invalidDob: '生年月日が正しくありません。日・月・年を確認してください。',
    futureDob: '生年月日は今日より後にできません。',
    needGender: '性別を選んでください。',
    saveFailed: '保存できませんでした。もう一度お試しください。',
    defer: 'あとで',
    save: '保存する',
    close: '閉じる',
    savedTitle: '保存しました',
    savedBody: 'お誕生日に合わせて特典をお届けします。',
  },
  ko: {
    title: '생일 혜택 받기',
    lead: '생년월일과 성별을 입력하면 쇼핑몰이 생일 세일과 맞춤 추천을 보냅니다.',
    leadNamed: '생년월일과 성별을 입력하면 {shop}이(가) 생일 세일과 맞춤 추천을 보냅니다.',
    dobLegend: '생년월일',
    day: '일',
    month: '월',
    year: '년',
    monthLabels: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
    gender: '성별',
    male: '남성',
    female: '여성',
    needDob: '생년월일의 일, 월, 년을 모두 선택하세요.',
    invalidDob: '생년월일이 올바르지 않습니다. 일/월/년을 확인하세요.',
    futureDob: '생년월일은 오늘 이후일 수 없습니다.',
    needGender: '성별을 선택하세요.',
    saveFailed: '저장하지 못했습니다. 다시 시도하세요.',
    defer: '나중에',
    save: '정보 저장',
    close: '닫기',
    savedTitle: '저장했습니다',
    savedBody: '생일에 맞춰 혜택을 보내 드립니다.',
  },
}

export function birthGenderPromptLead(locale: WebLocale, shopTitle?: string | null): string {
  const copy = BIRTH_GENDER_PROMPT_COPY[locale]
  const shop = String(shopTitle || '').trim()
  return shop ? copy.leadNamed.replace(/\{shop\}/g, shop) : copy.lead
}

/**
 * Popup 188 `BirthGenderSalePromptModal`:
 * mobile sheet đáy; ≥640px card giữa màn.
 * Nút lưu / giới tính đang chọn = `--pw-buy`, không hex cam.
 */
export const PW_BIRTH_GENDER_PROMPT_CSS = `
[data-pw-birth-gender-prompt]{position:fixed;inset:0;z-index:100060;display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box}
[data-pw-birth-gender-prompt] .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
[data-pw-birth-gender-prompt][hidden]{display:none!important}
[data-pw-birth-gender-backdrop]{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,.45);border:0;padding:0;cursor:pointer}
[data-pw-birth-gender-card]{position:relative;z-index:1;width:100%;max-height:90vh;overflow:auto;border-radius:16px 16px 0 0;background:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);border:1px solid #f3f4f6;padding:16px;box-sizing:border-box}
[data-pw-birth-gender-title]{margin:0;font:700 18px/1.3 system-ui,sans-serif;color:#111827}
[data-pw-birth-gender-lead]{margin:4px 0 0;font:400 14px/1.45 system-ui,sans-serif;color:#4b5563}
[data-pw-birth-gender-form]{margin-top:16px;display:grid;gap:12px}
[data-pw-birth-gender-legend],[data-pw-birth-gender-label]{display:block;margin:0 0 6px;font:500 12px/1.3 system-ui,sans-serif;color:#374151}
[data-pw-birth-gender-dob]{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
[data-pw-birth-gender-dob] select{width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font:400 14px/1.3 system-ui,sans-serif;color:#111827;background:#fff;box-sizing:border-box}
[data-pw-birth-gender-dob] select:focus{outline:none;border-color:var(--pw-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--pw-primary) 30%,transparent)}
[data-pw-birth-gender-genders]{display:flex;flex-wrap:wrap;gap:8px}
[data-pw-birth-gender-gender]{padding:6px 12px;border-radius:8px;font:500 14px/1.3 system-ui,sans-serif;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer}
[data-pw-birth-gender-gender]:hover{border-color:color-mix(in srgb,var(--pw-buy) 50%,#e5e7eb)}
[data-pw-birth-gender-gender][aria-pressed="true"]{background:var(--pw-buy);color:#fff;border-color:var(--pw-buy)}
[data-pw-birth-gender-error]{margin:0;font:400 14px/1.4 system-ui,sans-serif;color:#dc2626}
[data-pw-birth-gender-actions]{display:flex;flex-direction:column-reverse;gap:8px;padding-top:4px}
[data-pw-birth-gender-save],[data-pw-birth-gender-defer]{width:100%;display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:8px;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;box-sizing:border-box}
[data-pw-birth-gender-save]{background:var(--pw-buy);color:#fff;border:none}
[data-pw-birth-gender-save]:hover{filter:brightness(.92)}
[data-pw-birth-gender-save]:disabled{opacity:.6;cursor:not-allowed}
[data-pw-birth-gender-defer]{background:#fff;color:var(--pw-text,#1f2937);border:1px solid var(--pw-border,#e5e7eb)}
[data-pw-birth-gender-toast]{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100070;max-width:min(28rem,calc(100vw - 24px));background:#111827;color:#fff;border-radius:10px;padding:10px 14px;font:500 13px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}
[data-pw-birth-gender-toast] strong{display:block;font-weight:700}
@media (min-width:640px){
  [data-pw-birth-gender-prompt]{align-items:center;padding:16px}
  [data-pw-birth-gender-card]{max-width:28rem;border-radius:16px;padding:20px}
  [data-pw-birth-gender-actions]{flex-direction:row}
  [data-pw-birth-gender-save],[data-pw-birth-gender-defer]{flex:1}
}
`
