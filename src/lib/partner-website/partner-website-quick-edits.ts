import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { WebLocale } from '@/lib/i18n/config'

export type PartnerWebsiteQuickEditItem = {
  id: string
  label: string
  prompt: string
}

function quickEditPrompts(locale: WebLocale): Record<string, string> {
  if (locale === 'vi') {
    return {
      heroColor: 'Đổi màu nền hero sang tông cam đậm hơn, chữ trắng dễ đọc, giữ layout hiện tại.',
      heroTitle: 'Viết lại tiêu đề và mô tả hero ngắn gọn, hấp dẫn hơn, phù hợp shop thời trang.',
      addFaq: 'Thêm section FAQ với 4–5 câu hỏi thường gặp về sản phẩm và giao hàng.',
      chatCta: 'Thêm nút CTA nổi bật dẫn tới chat mua hàng ở hero và cuối trang.',
      mobile: 'Tối ưu responsive mobile: font, khoảng cách, nút bấm to hơn, menu gọn hơn.',
      footer: 'Cập nhật footer: thêm hotline, email, link mạng xã hội và copyright.',
    }
  }
  if (locale === 'zh') {
    return {
      heroColor: '将主视觉背景改为更鲜明的橙色调，白色文字清晰可读，保持现有布局。',
      heroTitle: '重写主标题和描述，更简洁有吸引力，适合时尚店铺。',
      addFaq: '添加 FAQ 区块，包含 4–5 个常见问题。',
      chatCta: '在首屏和页底添加醒目的聊天购买按钮。',
      mobile: '优化移动端：字体、间距、更大按钮、更紧凑菜单。',
      footer: '更新页脚：电话、邮箱、社交链接和版权信息。',
    }
  }
  if (locale === 'ja') {
    return {
      heroColor: 'ヒーロー背景をより濃いオレンジに変更し、白文字を読みやすく。レイアウトは維持。',
      heroTitle: 'ヒーローの見出しと説明を短く魅力的に書き直す。',
      addFaq: 'FAQセクションを4〜5問追加する。',
      chatCta: 'ヒーローとページ下部に目立つチャット購入ボタンを追加。',
      mobile: 'モバイル向けにフォント・余白・ボタンサイズ・メニューを最適化。',
      footer: 'フッターに電話、メール、SNSリンク、著作権表示を追加。',
    }
  }
  if (locale === 'ko') {
    return {
      heroColor: '히어로 배경을 더 진한 오렌지로 바꾸고 흰 글씨 가독성을 높인다. 레이아웃 유지.',
      heroTitle: '히어로 제목과 설명을 더 짧고 매력적으로 다시 쓴다.',
      addFaq: 'FAQ 섹션 4–5개 질문을 추가한다.',
      chatCta: '히어로와 하단에 눈에 띄는 채팅 구매 버튼을 추가한다.',
      mobile: '모바일 반응형: 글꼴, 간격, 버튼 크기, 메뉴 최적화.',
      footer: '푸터에 전화, 이메일, SNS 링크, 저작권 정보를 추가한다.',
    }
  }
  return {
    heroColor: 'Change the hero background to a richer orange tone with readable white text; keep the current layout.',
    heroTitle: 'Rewrite the hero headline and subtext to be shorter and more compelling for a fashion shop.',
    addFaq: 'Add an FAQ section with 4–5 common product and shipping questions.',
    chatCta: 'Add prominent shop chat CTA buttons in the hero and near the page bottom.',
    mobile: 'Optimize mobile responsive layout: typography, spacing, larger tap targets, tighter menu.',
    footer: 'Update the footer with phone, email, social links, and copyright.',
  }
}

export function getPartnerWebsiteQuickEdits(
  locale: WebLocale,
  t: PartnerWebsiteCopy
): PartnerWebsiteQuickEditItem[] {
  const p = quickEditPrompts(locale)
  return [
    { id: 'heroColor', label: t.quickEditHeroColor, prompt: p.heroColor! },
    { id: 'heroTitle', label: t.quickEditHeroTitle, prompt: p.heroTitle! },
    { id: 'addFaq', label: t.quickEditAddFaq, prompt: p.addFaq! },
    { id: 'chatCta', label: t.quickEditChatCta, prompt: p.chatCta! },
    { id: 'mobile', label: t.quickEditMobile, prompt: p.mobile! },
    { id: 'footer', label: t.quickEditFooter, prompt: p.footer! },
  ]
}
