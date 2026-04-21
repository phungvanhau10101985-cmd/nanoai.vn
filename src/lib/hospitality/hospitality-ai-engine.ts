import { findHospitalityFaqMatchPg } from '@/lib/db/hospitality-pg'
import { buildHospitalityAiContext } from '@/lib/hospitality/hospitality-ai-context'
import { classifyHospitalityIntent } from '@/lib/hospitality/hospitality-intent'

function formatMoney(amount: number | null, currency: string): string {
  if (amount == null) return 'Lien he de nhan bao gia cu the'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

export async function generateHospitalityAutoReply(params: {
  partner_id: string
  conversation_id: string
  guest_text: string
}): Promise<{ text: string; intent: string }> {
  const intent = classifyHospitalityIntent(params.guest_text)
  const faq = await findHospitalityFaqMatchPg(params.partner_id, params.guest_text)
  if (faq) return { text: faq, intent }

  const ctx = await buildHospitalityAiContext({
    partner_id: params.partner_id,
    conversation_id: params.conversation_id,
  })

  if (intent === 'room_availability') {
    const roomList = ctx.room_types
      .slice(0, 5)
      .map((r, idx) => {
        const daily = formatMoney(r.base_daily_rate, r.currency)
        return `${idx + 1}. ${r.name} (${r.max_guests} khach) - ${daily}/ngay`
      })
      .join('\n')
    if (roomList) {
      return {
        intent,
        text:
          `Hien tai ben em dang co cac loai phong:\n${roomList}\n\nAnh/chị gui giup em ngay check-in/check-out va so khach, em kiem tra phong trong theo lich ngay.`,
      }
    }
    return {
      intent,
      text:
        'Em da nhan yeu cau kiem tra phong trong. Anh/chị gui them thoi gian check-in/check-out va so khach de em giu phong ngay.',
    }
  }

  if (intent === 'price_quote') {
    const firstRoom = ctx.room_types[0]
    if (!firstRoom) {
      return {
        intent,
        text: 'Hien tai em chua co du lieu gia phong. Anh/chị cho em xin khung gio muon o de em bao gia chinh xac.',
      }
    }
    const hourly = formatMoney(firstRoom.base_hourly_rate, firstRoom.currency)
    const daily = formatMoney(firstRoom.base_daily_rate, firstRoom.currency)
    return {
      intent,
      text: `Gia tham khao phong ${firstRoom.name}: theo gio ${hourly}, theo ngay ${daily}. Anh/chị gui them lich de em toi uu gia tot nhat.`,
    }
  }

  if (intent === 'payment_status' && ctx.booking_anchor) {
    return {
      intent,
      text: `Booking gan nhat (${ctx.booking_anchor.booking_id.slice(0, 8)}) hien dang o trang thai "${ctx.booking_anchor.status}". Em co the gui link thanh toan neu anh/chị can.`,
    }
  }

  if (intent === 'cancel_policy') {
    return {
      intent,
      text:
        'Chinh sach huy/doi lich duoc ap dung theo tung hang phong va thoi diem. Em co the kiem tra booking cu the de bao muc phi chinh xac cho anh/chị.',
    }
  }

  if (intent === 'booking') {
    return {
      intent,
      text: 'Em co the giu phong truoc 15 phut. Anh/chị gui so dien thoai va thoi gian o de em tao giu phong ngay.',
    }
  }

  return {
    intent,
    text: 'Em la tro ly dat phong. Anh/chị can tim phong trong, bao gia, giu phong hay thanh toan? Em ho tro ngay.',
  }
}
