import { describe, expect, it } from 'vitest'
import {
  buildGuestDisplayName,
  buildHostInviteLine,
  buildPersonalWeddingInvite,
  extractGivenName,
  formatGuestInviteLabel,
  resolveHostReferenceStyle,
} from './build-personal-wedding-invite'

describe('buildGuestDisplayName', () => {
  it('joins honorific and name', () => {
    expect(buildGuestDisplayName('Chú', 'Công')).toBe('Chú Công')
  })
})

describe('extractGivenName', () => {
  it('drops likely surname for two-part names', () => {
    expect(extractGivenName('Phùng Hậu')).toBe('Hậu')
  })

  it('keeps compound given names without known surname', () => {
    expect(extractGivenName('Lan Anh')).toBe('Lan Anh')
  })
})

describe('buildHostInviteLine', () => {
  it('uses given name for Bạn', () => {
    const style = resolveHostReferenceStyle('Bạn', 'groom')
    expect(
      buildHostInviteLine({ style, hostFullName: 'Phùng Hậu' }),
    ).toBe('Bạn Hậu')
  })

  it('uses Con and spouse for Ba/Mẹ', () => {
    const style = resolveHostReferenceStyle('Ba', 'groom')
    expect(
      buildHostInviteLine({
        style,
        hostFullName: 'Phùng Hậu',
        spouseFullName: 'Lan Anh',
      }),
    ).toBe('Con Hậu và Lan Anh')
  })

  it('uses Cháu and gia đình without naming parents', () => {
    const style = resolveHostReferenceStyle('Dượng', 'groom')
    expect(
      buildHostInviteLine({ style, hostFullName: 'Phùng Hậu' }),
    ).toBe('Cháu Phùng Hậu và gia đình')
  })
})

describe('formatGuestInviteLabel', () => {
  it('lowercases honorific in mid-sentence and strips Quý', () => {
    expect(formatGuestInviteLabel('Anh', 'Minh')).toBe('anh Minh')
    expect(formatGuestInviteLabel('Quý anh', 'Minh')).toBe('anh Minh')
    expect(formatGuestInviteLabel('Bà ngoại', 'Lan')).toBe('bà ngoại Lan')
  })
})

describe('buildPersonalWeddingInvite', () => {
  const base = {
    side: 'groom' as const,
    groomName: 'Phùng Hậu',
    brideName: 'Lan Anh',
    groomParents: 'Bà Yên',
    brideParents: 'Bác Hùng',
    weddingDateIso: '2026-09-10',
    receptionTime: '17:00',
    partyStartTime: '',
    address: 'Vật Lại',
    locale: 'vi' as const,
  }

  it('Bạn ↔ Bạn', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Bạn',
      guestName: 'Đông',
    })
    expect(text).toContain('Bạn Hậu mời bạn Đông')
  })

  it('Chú ↔ Cháu', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Chú',
      guestName: 'Công',
    })
    expect(text).toContain('Cháu Phùng Hậu và gia đình')
    expect(text).toContain('mời chú Công')
  })

  it('Ba ↔ Con (+ vợ/chồng)', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Ba',
      guestName: 'Tuấn',
    })
    expect(text).toContain('Con Hậu và Lan Anh mời ba Tuấn')
  })

  it('Mẹ ↔ Con on bride side', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      side: 'bride',
      guestHonorific: 'Mẹ',
      guestName: 'Hạnh',
    })
    expect(text).toContain('Con Lan Anh và Hậu mời mẹ Hạnh')
  })

  it('Anh ↔ Em', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Anh',
      guestName: 'Hưởng',
    })
    expect(text).toContain('Em Phùng Hậu và gia đình')
    expect(text).toContain('mời anh Hưởng')
    expect(text).toContain('vào lúc 17 giờ')
    expect(text).toContain('đến tham dự bữa cơm thân mật cùng gia đình.')
    expect(text).not.toContain('tại ')
  })

  it('Ông ↔ Cháu (kể cả khi nhập Quý ông)', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Quý ông',
      guestName: 'Thọ',
    })
    expect(text).toContain('Cháu Phùng Hậu và gia đình')
    expect(text).toContain('mời ông Thọ')
    expect(text).not.toContain('quý')
  })

  it('Anh ↔ Em (kể cả khi nhập Quý anh)', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Quý anh',
      guestName: 'Khoa',
    })
    expect(text).toContain('Em Phùng Hậu và gia đình')
    expect(text).toContain('mời anh Khoa')
    expect(text).not.toContain('quý')
  })

  it('Ông nội ↔ Cháu', () => {
    const text = buildPersonalWeddingInvite({
      ...base,
      guestHonorific: 'Ông nội',
      guestName: 'Phong',
    })
    expect(text).toContain('mời ông nội Phong')
  })

  it('Em ↔ Anh/Chị', () => {
    expect(
      buildPersonalWeddingInvite({ ...base, guestHonorific: 'Em', guestName: 'Vy' }),
    ).toContain('Anh Hậu mời em Vy')
    expect(
      buildPersonalWeddingInvite({
        ...base,
        side: 'bride',
        guestHonorific: 'Em',
        guestName: 'Vy',
      }),
    ).toContain('Chị Lan Anh mời em Vy')
  })

  it('returns empty when missing guest or child name', () => {
    expect(
      buildPersonalWeddingInvite({
        ...base,
        groomName: '',
        guestHonorific: 'Anh',
        guestName: 'Minh',
      }),
    ).toBe('')
  })
})
