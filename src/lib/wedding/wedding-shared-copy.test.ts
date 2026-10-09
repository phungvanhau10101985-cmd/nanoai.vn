import { describe, expect, it } from 'vitest'
import { buildWeddingPolishUserPrompt } from './wedding-text-polish-deepseek'
import {
  omitWeddingAddressesFromSharedCopy,
  stripSharedWeddingCopy,
} from './wedding-shared-copy'

const GROOM_ADDRESS = 'Số 12, thôn Đông, xã Yên Bình, huyện Yên Phong, Bắc Ninh'

describe('omitWeddingAddressesFromSharedCopy', () => {
  it('drops the party address and keeps the wedding date', () => {
    const text = `Kính mời quý khách đến dự tại ${GROOM_ADDRESS} vào ngày 10/10/2026.`
    expect(omitWeddingAddressesFromSharedCopy(text, [GROOM_ADDRESS])).toBe(
      'Kính mời quý khách đến dự vào ngày 10/10/2026.',
    )
  })

  it('leaves dress code and story text that never named a place', () => {
    const text = 'Kính mong quý khách ưu tiên gam màu tươi sáng, không mặc màu đen.'
    expect(omitWeddingAddressesFromSharedCopy(text, [GROOM_ADDRESS])).toBe(text)
  })

  it('does not cut a short family label out of a sentence', () => {
    const text = 'Gia đình nhà trai trân trọng kính mời.'
    expect(omitWeddingAddressesFromSharedCopy(text, ['Nhà trai'])).toBe(text)
  })
})

describe('buildWeddingPolishUserPrompt', () => {
  it('keeps the wedding date and does not hand the model a venue', () => {
    const prompt = buildWeddingPolishUserPrompt({
      field: 'storyText',
      draft: 'Hai người gặp nhau.',
      groomName: 'Phùng Hậu',
      brideName: 'Diệu Lan',
      weddingDate: '10/10/2026',
    })
    expect(prompt).toContain('Ngày cưới: 10/10/2026')
    expect(prompt).not.toContain('Địa điểm:')
    expect(prompt).toContain('Không viết địa chỉ')
  })
})

describe('stripSharedWeddingCopy', () => {
  it('clears the address from shared prose and leaves the venue fields', () => {
    const card = {
      venue: GROOM_ADDRESS,
      groomHometown: '',
      brideHometown: '',
      groomInviteAddress: GROOM_ADDRESS,
      brideInviteAddress: 'Số 8, thôn Tây, xã Yên Bình',
      coupleIntro: `Duyên lành đưa hai người gặp nhau tại ${GROOM_ADDRESS}.`,
      loveQuote: 'Ánh mắt ấy là bến đỗ.',
      dressCode: 'Tông kem, be.',
      storyText: 'Những ngày thanh xuân êm đềm.',
      thankYouText: 'Xin cảm ơn quý khách.',
      invitationText: '',
      invitationTextEn: '',
    }
    const next = stripSharedWeddingCopy(card)
    expect(next.coupleIntro).toBe('Duyên lành đưa hai người gặp nhau.')
    expect(next.groomInviteAddress).toBe(GROOM_ADDRESS)
    expect(next.brideInviteAddress).toBe('Số 8, thôn Tây, xã Yên Bình')
    expect(next.loveQuote).toBe(card.loveQuote)
  })
})
