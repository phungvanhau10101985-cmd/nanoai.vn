import type { WebLocale } from '@/lib/i18n/config'
import { normalizeWebLocale } from '@/lib/i18n/config'

export type PartnerPromoEmailKind = 'birthday' | 'cart_abandon' | 'comeback' | 'newsletter_welcome' | 'campaign'

type PromoCopy = {
    hello: string
    autoFooter: string
    unsubscribe: string
    unsubscribeCta: string
    orCopyLink: string
  regards: string
  birthday: {
    subject: string
    body: string
    cta: string
    nextLabel: string
  }
  cart: {
    subject: string
    intro: string
    codeLine: string
    cta: string
    wallet: string
    extraItems: string
  }
  comeback: {
    subject: string
    intro: string
    codeLine: string
    cta: string
    wallet: string
  }
  newsletter: {
    subject: string
    body: string
    cta: string
  }
  campaign: {
    cta: string
    receivedBecause: string
  }
}

const COPY: Record<WebLocale, PromoCopy> = {
  vi: {
    hello: 'Xin chào {name},',
    autoFooter: 'Tin nhắn tự động từ {shop}',
    unsubscribe: 'Không muốn nhận tin khuyến mãi?',
    unsubscribeCta: 'Ngừng nhận tin',
    orCopyLink: 'Hoặc sao chép liên kết:',
    regards: 'Trân trọng,',
    birthday: {
      subject: '{shop} - Ưu đãi sinh nhật {percent}% dành cho {name}',
      body: 'Tuần lễ sinh nhật của bạn đã bắt đầu. {shop} gửi tặng ưu đãi {percent}% tự động trên giá sản phẩm khi bạn đăng nhập và mua hàng trên web, không cần mã.',
      cta: 'Vào web xem giá ưu đãi',
      nextLabel: 'Sinh nhật sắp tới: {date}',
    },
    cart: {
      subject: 'Bạn còn sản phẩm trong giỏ — hoàn tất đơn tại {shop}',
      intro: 'Bạn còn sản phẩm trong giỏ hàng nhưng chưa hoàn tất đặt hàng.',
      codeLine:
        'Shop gửi thêm mã {code} — giảm {percent}% (tối đa {max}đ, hết hạn sau {days} ngày). Mã đã nằm trong ví khuyến mãi của bạn.',
      cta: 'Xem giỏ hàng & đặt hàng',
      wallet: 'Ví mã ưu đãi',
      extraItems: '... và {n} sản phẩm khác',
    },
    comeback: {
      subject: '{shop} nhớ bạn — mã giảm dành riêng cho bạn',
      intro: 'Bạn lâu chưa ghé {shop}. Shop gửi riêng cho bạn một mã ưu đãi để quay lại mua sắm.',
      codeLine:
        'Mã {code} — giảm {percent}% (tối đa {max}đ, hết hạn sau {days} ngày). Mã đã nằm trong ví khuyến mãi của bạn.',
      cta: 'Khám phá {shop}',
      wallet: 'Ví mã ưu đãi',
    },
    newsletter: {
      subject: '{shop} — Bạn đã đăng ký nhận tin thành công',
      body: 'Cảm ơn bạn đã đăng ký nhận tin từ {shop}. Shop sẽ gửi ưu đãi, sale và gợi ý sản phẩm mới qua email này.',
      cta: 'Khám phá {shop}',
    },
    campaign: {
      cta: 'Xem {shop}',
      receivedBecause: 'Bạn nhận email vì đã đăng ký nhận tin từ {shop}',
    },
  },
  en: {
    hello: 'Hello {name},',
    autoFooter: 'Automatic message from {shop}',
    unsubscribe: 'Don’t want promo emails?',
    unsubscribeCta: 'Unsubscribe',
    orCopyLink: 'Or copy this link:',
    regards: 'Best regards,',
    birthday: {
      subject: '{shop} — {percent}% birthday offer for {name}',
      body: 'Your birthday week has started. {shop} gives you {percent}% off automatically when you sign in and shop on the website — no code needed.',
      cta: 'See sale prices on the site',
      nextLabel: 'Upcoming birthday: {date}',
    },
    cart: {
      subject: 'Items are waiting in your cart at {shop}',
      intro: 'You still have items in your cart but have not checked out.',
      codeLine:
        'Here’s code {code} — {percent}% off (max {max}₫, expires in {days} days). It’s already in your gift wallet.',
      cta: 'View cart & checkout',
      wallet: 'Gift wallet',
      extraItems: '... and {n} more items',
    },
    comeback: {
      subject: '{shop} misses you — a discount just for you',
      intro: 'It’s been a while since you visited {shop}. Here’s a personal discount to come back.',
      codeLine:
        'Code {code} — {percent}% off (max {max}₫, expires in {days} days). It’s already in your gift wallet.',
      cta: 'Explore {shop}',
      wallet: 'Gift wallet',
    },
    newsletter: {
      subject: '{shop} — you’re subscribed',
      body: 'Thanks for subscribing to {shop}. We’ll send offers, sales and new-product picks to this email.',
      cta: 'Explore {shop}',
    },
    campaign: {
      cta: 'Visit {shop}',
      receivedBecause: 'You’re receiving this because you subscribed at {shop}',
    },
  },
  zh: {
    hello: '您好 {name}，',
    autoFooter: '来自 {shop} 的自动邮件',
    unsubscribe: '不想再收到促销邮件？',
    unsubscribeCta: '取消订阅',
    orCopyLink: '或复制链接：',
    regards: '此致，',
    birthday: {
      subject: '{shop} — {name} 的生日优惠 {percent}%',
      body: '您的生日周已开始。登录网站购物即可自动享受 {percent}% 优惠，无需优惠码。',
      cta: '打开网站查看优惠价',
      nextLabel: '即将到来的生日：{date}',
    },
    cart: {
      subject: '购物车里还有商品 — 在 {shop} 完成订单',
      intro: '您的购物车仍有商品，但尚未下单。',
      codeLine: '赠送优惠码 {code} — {percent}% 优惠（最高 {max}₫，{days} 天内有效），已放入礼品钱包。',
      cta: '查看购物车并下单',
      wallet: '礼品钱包',
      extraItems: '……另有 {n} 件商品',
    },
    comeback: {
      subject: '{shop} 想您了 — 专属优惠码',
      intro: '好久没来 {shop} 了。送您一张专属优惠码，欢迎回来。',
      codeLine: '优惠码 {code} — {percent}% 优惠（最高 {max}₫，{days} 天内有效），已放入礼品钱包。',
      cta: '逛逛 {shop}',
      wallet: '礼品钱包',
    },
    newsletter: {
      subject: '{shop} — 订阅成功',
      body: '感谢订阅 {shop}。我们将通过此邮箱发送优惠、促销和新品推荐。',
      cta: '逛逛 {shop}',
    },
    campaign: {
      cta: '访问 {shop}',
      receivedBecause: '您收到此邮件是因为已在 {shop} 订阅资讯',
    },
  },
  ja: {
    hello: '{name} 様',
    autoFooter: '{shop} からの自動メール',
    unsubscribe: 'セールメールを停止しますか？',
    unsubscribeCta: '配信停止',
    orCopyLink: 'またはリンクをコピー：',
    regards: '敬具',
    birthday: {
      subject: '{shop} — {name} 様の誕生日 {percent}% OFF',
      body: 'お誕生日週間が始まりました。ウェブにログインして購入すると、コードなしで自動的に {percent}% OFF になります。',
      cta: 'サイトでセール価格を見る',
      nextLabel: '次のお誕生日：{date}',
    },
    cart: {
      subject: 'カートに商品が残っています — {shop}',
      intro: 'カートに商品がありますが、まだご注文が完了していません。',
      codeLine:
        'コード {code} — {percent}% OFF（上限 {max}₫、{days} 日間有効）をギフトウォレットに入れました。',
      cta: 'カートを見て注文する',
      wallet: 'ギフトウォレット',
      extraItems: '…ほか {n} 点',
    },
    comeback: {
      subject: '{shop} がお待ちしています — 専用クーポン',
      intro: '{shop} にしばらくお越しでないようです。戻って来やすいよう専用クーポンをお送りします。',
      codeLine:
        'コード {code} — {percent}% OFF（上限 {max}₫、{days} 日間有効）。ギフトウォレットにあります。',
      cta: '{shop} を見る',
      wallet: 'ギフトウォレット',
    },
    newsletter: {
      subject: '{shop} — 配信登録が完了しました',
      body: '{shop} の配信にご登録いただきありがとうございます。セールや新商品のご案内をお送りします。',
      cta: '{shop} を見る',
    },
    campaign: {
      cta: '{shop} を見る',
      receivedBecause: '{shop} の配信に登録されているため、このメールをお送りしています',
    },
  },
  ko: {
    hello: '{name}님 안녕하세요,',
    autoFooter: '{shop}에서 보낸 자동 메일',
    unsubscribe: '프로모션 메일을 그만 받으시겠어요?',
    unsubscribeCta: '수신 거부',
    orCopyLink: '또는 링크 복사:',
    regards: '감사합니다,',
    birthday: {
      subject: '{shop} — {name}님 생일 {percent}% 혜택',
      body: '생일 주간이 시작되었습니다. 웹에 로그인하고 구매하면 코드 없이 자동으로 {percent}% 할인됩니다.',
      cta: '웹에서 할인가 보기',
      nextLabel: '다가오는 생일: {date}',
    },
    cart: {
      subject: '장바구니에 상품이 남아 있습니다 — {shop}',
      intro: '장바구니에 상품이 있지만 아직 주문을 완료하지 않았습니다.',
      codeLine:
        '코드 {code} — {percent}% 할인(최대 {max}₫, {days}일 유효)을 선물 지갑에 넣어 두었습니다.',
      cta: '장바구니 보고 주문하기',
      wallet: '선물 지갑',
      extraItems: '… 외 {n}개',
    },
    comeback: {
      subject: '{shop}가 기다리고 있어요 — 전용 할인 코드',
      intro: '{shop}에 오래 오지 않으셨네요. 다시 쇼핑하실 수 있도록 전용 코드를 보내 드립니다.',
      codeLine:
        '코드 {code} — {percent}% 할인(최대 {max}₫, {days}일 유효). 선물 지갑에 있습니다.',
      cta: '{shop} 둘러보기',
      wallet: '선물 지갑',
    },
    newsletter: {
      subject: '{shop} — 뉴스레터 구독이 완료되었습니다',
      body: '{shop} 뉴스레터를 구독해 주셔서 감사합니다. 혜택, 세일, 신상품 소식을 이 이메일로 보내 드립니다.',
      cta: '{shop} 둘러보기',
    },
    campaign: {
      cta: '{shop} 보기',
      receivedBecause: '{shop} 뉴스레터를 구독하셨기 때문에 이 메일을 받습니다',
    },
  },
}

export function fillPromoTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}

export const formatPromoCopy = fillPromoTemplate

export function partnerPromoEmailCopy(locale?: string | null) {
  const nested = COPY[normalizeWebLocale(locale) ?? 'vi']
  return {
    ...nested,
    birthdaySubject: nested.birthday.subject,
    birthdayBody: nested.birthday.body,
    birthdayCta: nested.birthday.cta,
    cartSubject: nested.cart.subject,
    cartCta: nested.cart.cta,
    comebackSubject: nested.comeback.subject,
    comebackCta: nested.comeback.cta,
    newsletterSubject: nested.newsletter.subject,
    newsletterCta: nested.newsletter.cta,
  }
}
