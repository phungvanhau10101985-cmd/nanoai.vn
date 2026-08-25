/**
 * W2.2 — gợi ý sửa nhanh website theo ngành (không hardcode fashion/cam).
 * Chip text = prompt gửi AI chat. Sửa nhanh thêm được thì gợi ý được — không lọc theo bảng module.
 */
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { WebLocale } from '@/lib/i18n/config'
import {
  type PartnerCapabilities,
  type PartnerIndustryKey,
} from '@/lib/partner-website/partner-capabilities'

export type PartnerWebsiteQuickEditItem = {
  id: string
  label: string
  prompt: string
}

export type PartnerWebsiteEditSuggestionsInput = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  industryKey?: PartnerIndustryKey
  capabilities?: PartnerCapabilities | null
  /** `built` = sau khi đã có site; khác → gợi ý ngắn hơn. */
  phase?: 'built' | 'other'
}

function industryNoun(locale: WebLocale, industryKey: PartnerIndustryKey): string {
  const key = industryKey ?? 'fashion'
  if (locale === 'vi') {
    if (key === 'hotel') return 'khách sạn / homestay'
    if (key === 'food') return 'quán ăn / F&B'
    if (key === 'other') return 'cửa hàng'
    return 'cửa hàng'
  }
  if (locale === 'zh') {
    if (key === 'hotel') return '酒店/民宿'
    if (key === 'food') return '餐饮店铺'
    if (key === 'other') return '店铺'
    return '店铺'
  }
  if (locale === 'ja') {
    if (key === 'hotel') return 'ホテル/宿泊'
    if (key === 'food') return '飲食店'
    if (key === 'other') return 'ショップ'
    return 'ショップ'
  }
  if (locale === 'ko') {
    if (key === 'hotel') return '호텔/숙소'
    if (key === 'food') return '음식점'
    if (key === 'other') return '스토어'
    return '스토어'
  }
  if (key === 'hotel') return 'hotel / stay'
  if (key === 'food') return 'food & beverage shop'
  if (key === 'other') return 'shop'
  return 'shop'
}

function promptsForLocale(
  locale: WebLocale,
  industryKey: PartnerIndustryKey
): Record<string, string> {
  const noun = industryNoun(locale, industryKey)
  if (locale === 'vi') {
    return {
      heroRewrite: `Viết lại tiêu đề và mô tả hero ngắn gọn, hấp dẫn hơn, phù hợp ${noun}. Giữ layout hiện tại.`,
      heroColor: 'Điều chỉnh màu nền hero và chữ cho tương phản rõ, dễ đọc; giữ layout hiện tại.',
      addFaq: 'Thêm section FAQ với 4–5 câu hỏi thường gặp phù hợp ngành nghề của shop.',
      chatCta: 'Thêm nút CTA nổi bật dẫn tới chat hỗ trợ ở hero và cuối trang.',
      bookingCta: 'Thêm nút CTA nổi bật dẫn tới đặt phòng / đặt chỗ ở hero và cuối trang.',
      mobile: 'Tối ưu responsive mobile: font, khoảng cách, nút bấm to hơn, menu gọn hơn.',
      footer: 'Cập nhật footer: thêm hotline, email, link mạng xã hội và copyright.',
    }
  }
  if (locale === 'zh') {
    return {
      heroRewrite: `重写主标题和描述，更简洁有吸引力，适合${noun}。保持现有布局。`,
      heroColor: '调整主视觉背景与文字对比度，清晰易读；保持布局。不必使用橙色。',
      addFaq: '添加 FAQ 区块，包含 4–5 个符合本行业的常见问题。',
      chatCta: '在首屏和页底添加醒目的聊天支持按钮。',
      bookingCta: '在首屏和页底添加醒目的预订按钮。',
      mobile: '优化移动端：字体、间距、更大按钮、更紧凑菜单。',
      footer: '更新页脚：电话、邮箱、社交链接和版权信息。',
    }
  }
  if (locale === 'ja') {
    return {
      heroRewrite: `ヒーローの見出しと説明を短く魅力的に書き直し、${noun}向けにする。レイアウトは維持。`,
      heroColor: 'ヒーローの背景と文字のコントラストを調整し読みやすく。レイアウト維持。オレンジ必須ではない。',
      addFaq: '業種に合うFAQを4〜5問追加する。',
      chatCta: 'ヒーローとページ下部に目立つチャットボタンを追加。',
      bookingCta: 'ヒーローとページ下部に目立つ予約ボタンを追加。',
      mobile: 'モバイル向けにフォント・余白・ボタンサイズ・メニューを最適化。',
      footer: 'フッターに電話、メール、SNSリンク、著作権表示を追加。',
    }
  }
  if (locale === 'ko') {
    return {
      heroRewrite: `히어로 제목과 설명을 더 짧고 매력적으로 다시 쓰고 ${noun}에 맞게 조정한다. 레이아웃 유지.`,
      heroColor: '히어로 배경과 글자 대비를 높여 가독성을 개선한다. 레이아웃 유지. 주황색 필수 아님.',
      addFaq: '업종에 맞는 FAQ 섹션 4–5개 질문을 추가한다.',
      chatCta: '히어로와 하단에 눈에 띄는 채팅 버튼을 추가한다.',
      bookingCta: '히어로와 하단에 눈에 띄는 예약 버튼을 추가한다.',
      mobile: '모바일 반응형: 글꼴, 간격, 버튼 크기, 메뉴 최적화.',
      footer: '푸터에 전화, 이메일, SNS 링크, 저작권 정보를 추가한다.',
    }
  }
  return {
    heroRewrite: `Rewrite the hero headline and subtext to be shorter and more compelling for a ${noun}. Keep the current layout.`,
    heroColor:
      'Adjust the hero background and text contrast for readability; keep the current layout. Do not require an orange theme.',
    addFaq: 'Add an FAQ section with 4–5 common questions relevant to this business.',
    chatCta: 'Add prominent support-chat CTA buttons in the hero and near the page bottom.',
    bookingCta: 'Add prominent booking CTA buttons in the hero and near the page bottom.',
    mobile: 'Optimize mobile responsive layout: typography, spacing, larger tap targets, tighter menu.',
    footer: 'Update the footer with phone, email, social links, and copyright.',
  }
}

/**
 * Danh sách chip gợi ý (string[]) — nguồn duy nhất cho journal / studio / chat.
 */
export function getPartnerWebsiteEditSuggestions(input: PartnerWebsiteEditSuggestionsInput): string[] {
  const industryKey = input.industryKey ?? 'fashion'
  const p = promptsForLocale(input.locale, industryKey)
  const phase = input.phase ?? 'built'

  const out: string[] = [p.heroRewrite!, p.heroColor!, p.addFaq!]

  if (phase === 'built') {
    out.push(input.t.quickEditHeroColor)
    out.push(input.t.quickEditHeroTitle)
  }

  if (industryKey === 'hotel') {
    out.push(p.bookingCta!)
  } else {
    out.push(p.chatCta!)
  }

  if (phase === 'built') {
    out.push(p.mobile!)
    out.push(p.footer!)
  }

  // Deduplicate while preserving order (label chips may overlap prompt chips).
  const seen = new Set<string>()
  return out.filter((s) => {
    const key = s.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** @deprecated Dùng getPartnerWebsiteEditSuggestions — giữ export để tương thích test/import cũ. */
export function getPartnerWebsiteQuickEdits(
  locale: WebLocale,
  t: PartnerWebsiteCopy,
  industryKey: PartnerIndustryKey = 'fashion',
  capabilities?: PartnerCapabilities | null
): PartnerWebsiteQuickEditItem[] {
  const suggestions = getPartnerWebsiteEditSuggestions({
    locale,
    t,
    industryKey,
    capabilities,
    phase: 'built',
  })
  return suggestions.map((prompt, i) => ({
    id: `suggest_${i}`,
    label: prompt,
    prompt,
  }))
}
