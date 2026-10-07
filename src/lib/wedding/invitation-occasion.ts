/** Một engine thiệp cho mọi dịp. `wedding` giữ nguyên chữ và luồng hai nhà. */

export const INVITATION_OCCASION_KEYS = [
  'wedding',
  'engagement',
  'full_month',
  'first_birthday',
  'birthday',
  'longevity',
  'grand_opening',
  'housewarming',
  'gathering',
  'graduation',
  'anniversary',
  'ceremony',
] as const

export const INVITATION_OCCASION_GROUPS = [
  { id: 'union', title: 'Cưới & hỏi', keys: ['wedding', 'engagement'] },
  {
    id: 'family',
    title: 'Gia đình',
    keys: ['full_month', 'first_birthday', 'birthday', 'longevity', 'anniversary', 'housewarming'],
  },
  { id: 'event', title: 'Sự kiện', keys: ['grand_opening', 'gathering', 'graduation', 'ceremony'] },
] as const satisfies ReadonlyArray<{ id: string; title: string; keys: readonly InvitationOccasionKey[] }>

export type InvitationOccasionKey = (typeof INVITATION_OCCASION_KEYS)[number]
export type InvitationOccasionShape = 'couple' | 'single'

const KEY_SET = new Set<string>(INVITATION_OCCASION_KEYS)

export function normalizeInvitationOccasion(raw: unknown): InvitationOccasionKey {
  const key = String(raw ?? '').trim()
  return KEY_SET.has(key) ? (key as InvitationOccasionKey) : 'wedding'
}

export function invitationOccasionShape(raw: unknown): InvitationOccasionShape {
  const key = normalizeInvitationOccasion(raw)
  return key === 'wedding' || key === 'engagement' || key === 'anniversary' ? 'couple' : 'single'
}

export type InvitationEditorCopy = {
  label: string
  blurb: string
  stepTitle: string
  primaryName: string
  secondaryName: string
  primaryPhoto: string
  secondaryPhoto: string
  primaryRole: string
  secondaryRole: string
  venueTitle: string
  venueNote: string
  primaryFamily: string
  secondaryFamily: string
  guestPrimary: string
  guestSecondary: string
  letterPrimary: string
  letterSecondary: string
  placeNounPrimary?: string
  placeNounSecondary?: string
  parentsLabel?: string
  dateLabel?: string
  panelHint?: string
  albumLabel: string
  introLabel: string
  introPlaceholder: string
  quoteLabel: string
  quotePlaceholder: string
  storyLabel: string
  storyPlaceholder: string
  thanksPlaceholder: string
  portraitHint: string
  sharedHint: string
  previewInviteFallback: string
  previewEyebrow: string
}

const WEDDING_EDITOR: InvitationEditorCopy = {
  label: 'Thiệp cưới',
  blurb: 'Hai nhà, hai chân dung, hai QR mừng cưới.',
  stepTitle: '2. Nhập thông tin cưới',
  primaryName: 'Tên chú rể',
  secondaryName: 'Tên cô dâu',
  primaryPhoto: 'Ảnh chú rể',
  secondaryPhoto: 'Ảnh cô dâu',
  primaryRole: 'Chú rể',
  secondaryRole: 'Cô dâu',
  venueTitle: 'Nhà trai và nhà gái',
  venueNote: 'Mỗi nhà điền một lần. Trang khách mời dùng cùng các ô này.',
  primaryFamily: 'Nhà trai',
  secondaryFamily: 'Nhà gái',
  guestPrimary: 'Khách mời nhà trai',
  guestSecondary: 'Khách mời nhà gái',
  letterPrimary: 'Nhà trai',
  letterSecondary: 'Nhà gái',
  albumLabel: 'Album ảnh cô dâu chú rể',
  introLabel: 'Intro cặp đôi / câu chuyện mở đầu',
  introPlaceholder: 'Một đoạn mở đầu tinh tế về cô dâu chú rể, gia đình hoặc lời nhắn riêng...',
  quoteLabel: 'Quote tình yêu',
  quotePlaceholder: 'Ví dụ: Và rồi chúng ta chọn cùng nhau đi hết những ngày bình yên...',
  storyLabel: 'Câu chuyện / album ngắn',
  storyPlaceholder: 'Một đoạn ngắn về hành trình yêu thương, lời nhắn gửi hoặc album/story...',
  thanksPlaceholder: '{couple} xin chân thành cảm ơn quý khách đã đến chung vui trong ngày trọng đại của chúng tôi.',
  portraitHint: 'Ảnh chân dung hiện trên trang nội dung thiệp, phía trên câu chuyện mở đầu. Nên dùng ảnh dọc, mặt nhìn rõ.',
  sharedHint:
    'Phần này dùng cho cả nhà trai và nhà gái. Ngày tiệc, giờ, địa chỉ, bản đồ và lịch trình điền ở đúng nhà bên dưới. Lời mời tiếng Việt tự viết theo xưng hô và tên từng khách.',
  previewInviteFallback: 'Trân trọng kính mời quý khách đến dự lễ thành hôn của chúng tôi.',
  previewEyebrow: 'Wedding Invitation',
}

type SingleEditorInput = {
  label: string
  blurb: string
  stepTitle: string
  primaryName: string
  secondaryName: string
  primaryPhoto: string
  secondaryPhoto: string
  primaryRole: string
  secondaryRole: string
  parentsLabel: string
  dateLabel: string
  albumLabel: string
  introPlaceholder: string
  thanksPlaceholder: string
  previewInviteFallback: string
  previewEyebrow: string
}

function singleEditor(input: SingleEditorInput): InvitationEditorCopy {
  return {
    ...input,
    venueTitle: 'Địa điểm tổ chức',
    venueNote: 'Điền một lần. Trang khách mời dùng cùng các ô này.',
    primaryFamily: 'Địa điểm',
    secondaryFamily: '',
    guestPrimary: 'Khách mời',
    guestSecondary: 'Khách mời',
    letterPrimary: 'Xem thiệp',
    letterSecondary: 'Xem thiệp',
    placeNounPrimary: 'buổi tiệc',
    parentsLabel: input.parentsLabel,
    dateLabel: input.dateLabel,
    panelHint: 'Điền ngày, giờ, địa chỉ và lịch trình của buổi này.',
    introLabel: 'Lời ngỏ',
    quoteLabel: 'Câu quote',
    quotePlaceholder: 'Một câu ngắn khách đọc khi mở thiệp...',
    storyLabel: 'Câu chuyện ngắn',
    storyPlaceholder: 'Vài dòng về buổi tiệc, người được mừng hoặc lời nhắn gửi...',
    portraitHint: 'Ảnh chân dung hiện trên trang nội dung. Nên dùng ảnh dọc, mặt nhìn rõ. Ảnh thứ hai là tuỳ chọn.',
    sharedHint: 'Ngày, giờ, địa chỉ, bản đồ và lịch trình điền ở mục địa điểm bên dưới.',
  }
}

const EDITOR: Record<InvitationOccasionKey, InvitationEditorCopy> = {
  wedding: WEDDING_EDITOR,
  engagement: {
    ...WEDDING_EDITOR,
    label: 'Đám hỏi',
    blurb: 'Lễ đám hỏi hai nhà. Vẫn hai tên, hai ảnh và hai QR.',
    stepTitle: '2. Nhập thông tin đám hỏi',
    albumLabel: 'Album ảnh đám hỏi',
    introLabel: 'Câu chuyện mở đầu',
    introPlaceholder: 'Một đoạn mở đầu về hai gia đình và lễ đám hỏi...',
    thanksPlaceholder: '{couple} xin cảm ơn quý khách đã đến chung vui lễ đám hỏi.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự lễ đám hỏi của chúng tôi.',
    previewEyebrow: 'Engagement',
  },
  anniversary: {
    ...WEDDING_EDITOR,
    label: 'Kỷ niệm',
    blurb: 'Kỷ niệm hai người. Hai tên, hai ảnh, hai QR. Địa điểm phụ là tuỳ chọn.',
    stepTitle: '2. Nhập thông tin kỷ niệm',
    primaryName: 'Tên người thứ nhất',
    secondaryName: 'Tên người thứ hai',
    primaryPhoto: 'Ảnh người thứ nhất',
    secondaryPhoto: 'Ảnh người thứ hai',
    primaryRole: '',
    secondaryRole: '',
    venueTitle: 'Hai địa điểm',
    venueNote: 'Địa điểm chính điền ở bên thứ nhất. Bên thứ hai chỉ khi có tiệc riêng.',
    primaryFamily: 'Bên thứ nhất',
    secondaryFamily: 'Bên thứ hai',
    guestPrimary: 'Khách mời bên thứ nhất',
    guestSecondary: 'Khách mời bên thứ hai',
    letterPrimary: 'Bên thứ nhất',
    letterSecondary: 'Bên thứ hai',
    placeNounPrimary: 'bên thứ nhất',
    placeNounSecondary: 'bên thứ hai',
    albumLabel: 'Album ảnh kỷ niệm',
    introLabel: 'Câu chuyện mở đầu',
    introPlaceholder: 'Vài dòng về cột mốc hai người muốn khách cùng nhớ...',
    quoteLabel: 'Câu quote',
    storyLabel: 'Câu chuyện ngắn',
    storyPlaceholder: 'Một đoạn ngắn về chặng đường đã đi cùng nhau...',
    thanksPlaceholder: '{couple} xin cảm ơn quý khách đã đến chung vui ngày kỷ niệm.',
    portraitHint: 'Hai ảnh chân dung hiện trên trang nội dung. Nên dùng ảnh dọc.',
    sharedHint: 'Ngày, giờ và địa chỉ điền ở đúng bên bên dưới.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự ngày kỷ niệm của chúng tôi.',
    previewEyebrow: 'Anniversary',
  },
  full_month: singleEditor({
    label: 'Đầy tháng',
    blurb: 'Tiệc đầy tháng của bé. Một địa điểm, một QR. Tên bố mẹ là tuỳ chọn.',
    stepTitle: '2. Nhập thông tin đầy tháng',
    primaryName: 'Tên bé',
    secondaryName: 'Bố hoặc mẹ (tuỳ chọn)',
    primaryPhoto: 'Ảnh bé',
    secondaryPhoto: 'Ảnh bố mẹ (tuỳ chọn)',
    primaryRole: 'Bé',
    secondaryRole: 'Bố mẹ',
    parentsLabel: 'Bố mẹ',
    dateLabel: 'Ngày đầy tháng',
    albumLabel: 'Album ảnh bé',
    introPlaceholder: 'Vài dòng chào bé và cảm ơn khách đến dự tiệc đầy tháng...',
    thanksPlaceholder: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc đầy tháng của bé.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự tiệc đầy tháng của bé.',
    previewEyebrow: 'Full Month',
  }),
  first_birthday: singleEditor({
    label: 'Thôi nôi',
    blurb: 'Tiệc thôi nôi. Một địa điểm, một QR. Tên bố mẹ là tuỳ chọn.',
    stepTitle: '2. Nhập thông tin thôi nôi',
    primaryName: 'Tên bé',
    secondaryName: 'Bố hoặc mẹ (tuỳ chọn)',
    primaryPhoto: 'Ảnh bé',
    secondaryPhoto: 'Ảnh bố mẹ (tuỳ chọn)',
    primaryRole: 'Bé',
    secondaryRole: 'Bố mẹ',
    parentsLabel: 'Bố mẹ',
    dateLabel: 'Ngày thôi nôi',
    albumLabel: 'Album ảnh bé',
    introPlaceholder: 'Vài dòng về thôi nôi và lời mời gia đình...',
    thanksPlaceholder: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc thôi nôi.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự tiệc thôi nôi của bé.',
    previewEyebrow: 'First Birthday',
  }),
  birthday: singleEditor({
    label: 'Sinh nhật',
    blurb: 'Mừng sinh nhật một người. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin sinh nhật',
    primaryName: 'Người được mừng',
    secondaryName: 'Người tổ chức (tuỳ chọn)',
    primaryPhoto: 'Ảnh người được mừng',
    secondaryPhoto: 'Ảnh thêm (tuỳ chọn)',
    primaryRole: 'Sinh nhật',
    secondaryRole: '',
    parentsLabel: 'Gia đình (tuỳ chọn)',
    dateLabel: 'Ngày sinh nhật',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng mời khách đến mừng sinh nhật...',
    thanksPlaceholder: 'Xin cảm ơn quý khách đã đến chung vui ngày sinh nhật.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự tiệc sinh nhật.',
    previewEyebrow: 'Birthday',
  }),
  longevity: singleEditor({
    label: 'Mừng thọ',
    blurb: 'Mừng thọ. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin mừng thọ',
    primaryName: 'Người mừng thọ',
    secondaryName: 'Con cháu (tuỳ chọn)',
    primaryPhoto: 'Ảnh người mừng thọ',
    secondaryPhoto: 'Ảnh gia đình (tuỳ chọn)',
    primaryRole: 'Mừng thọ',
    secondaryRole: 'Gia đình',
    parentsLabel: 'Gia đình',
    dateLabel: 'Ngày mừng thọ',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng kính mời đến mừng thọ...',
    thanksPlaceholder: 'Gia đình xin cảm ơn quý khách đã đến chung vui lễ mừng thọ.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự lễ mừng thọ.',
    previewEyebrow: 'Longevity',
  }),
  grand_opening: singleEditor({
    label: 'Khai trương',
    blurb: 'Khai trương cửa hàng. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin khai trương',
    primaryName: 'Tên cửa hàng',
    secondaryName: 'Người đại diện (tuỳ chọn)',
    primaryPhoto: 'Ảnh cửa hàng',
    secondaryPhoto: 'Ảnh người đại diện (tuỳ chọn)',
    primaryRole: 'Khai trương',
    secondaryRole: 'Đại diện',
    parentsLabel: 'Người đại diện (tuỳ chọn)',
    dateLabel: 'Ngày khai trương',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng mời khách đến dự khai trương...',
    thanksPlaceholder: 'Xin cảm ơn quý khách đã đến chung vui ngày khai trương.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự lễ khai trương.',
    previewEyebrow: 'Grand Opening',
  }),
  housewarming: singleEditor({
    label: 'Tân gia',
    blurb: 'Tiệc tân gia. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin tân gia',
    primaryName: 'Chủ nhà',
    secondaryName: 'Người đồng hành (tuỳ chọn)',
    primaryPhoto: 'Ảnh chủ nhà',
    secondaryPhoto: 'Ảnh nhà (tuỳ chọn)',
    primaryRole: 'Tân gia',
    secondaryRole: '',
    parentsLabel: 'Gia đình (tuỳ chọn)',
    dateLabel: 'Ngày tân gia',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng mời khách đến chơi nhà mới...',
    thanksPlaceholder: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc tân gia.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự tiệc tân gia.',
    previewEyebrow: 'Housewarming',
  }),
  gathering: singleEditor({
    label: 'Tất niên / liên hoan',
    blurb: 'Tiệc tất niên hoặc liên hoan. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin buổi tiệc',
    primaryName: 'Tên buổi tiệc',
    secondaryName: 'Người tổ chức (tuỳ chọn)',
    primaryPhoto: 'Ảnh buổi tiệc',
    secondaryPhoto: 'Ảnh thêm (tuỳ chọn)',
    primaryRole: 'Buổi tiệc',
    secondaryRole: '',
    parentsLabel: 'Ban tổ chức (tuỳ chọn)',
    dateLabel: 'Ngày tổ chức',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng mời mọi người đến liên hoan...',
    thanksPlaceholder: 'Xin cảm ơn quý khách đã đến chung vui buổi tiệc.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự buổi tiệc.',
    previewEyebrow: 'Gathering',
  }),
  graduation: singleEditor({
    label: 'Tốt nghiệp',
    blurb: 'Lễ tốt nghiệp. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin tốt nghiệp',
    primaryName: 'Tân cử nhân',
    secondaryName: 'Gia đình (tuỳ chọn)',
    primaryPhoto: 'Ảnh tân cử nhân',
    secondaryPhoto: 'Ảnh gia đình (tuỳ chọn)',
    primaryRole: 'Tốt nghiệp',
    secondaryRole: 'Gia đình',
    parentsLabel: 'Gia đình',
    dateLabel: 'Ngày tốt nghiệp',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng mời khách đến mừng tốt nghiệp...',
    thanksPlaceholder: 'Xin cảm ơn quý khách đã đến chung vui lễ tốt nghiệp.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự lễ tốt nghiệp.',
    previewEyebrow: 'Graduation',
  }),
  ceremony: singleEditor({
    label: 'Hội nghị / khánh thành / khai giảng',
    blurb: 'Sự kiện một ban tổ chức. Một địa điểm, một QR.',
    stepTitle: '2. Nhập thông tin sự kiện',
    primaryName: 'Tên sự kiện',
    secondaryName: 'Đơn vị tổ chức (tuỳ chọn)',
    primaryPhoto: 'Ảnh sự kiện',
    secondaryPhoto: 'Ảnh thêm (tuỳ chọn)',
    primaryRole: 'Sự kiện',
    secondaryRole: 'Ban tổ chức',
    parentsLabel: 'Ban tổ chức (tuỳ chọn)',
    dateLabel: 'Ngày diễn ra',
    albumLabel: 'Album ảnh',
    introPlaceholder: 'Vài dòng giới thiệu sự kiện và lời mời...',
    thanksPlaceholder: 'Ban tổ chức xin cảm ơn quý khách đã đến tham dự.',
    previewInviteFallback: 'Trân trọng kính mời quý khách đến dự sự kiện.',
    previewEyebrow: 'Ceremony',
  }),
}

export function invitationEditorCopy(raw: unknown): InvitationEditorCopy {
  return EDITOR[normalizeInvitationOccasion(raw)]
}

/** Cùng hình (hai người hoặc một người) thì không cần hỏi. Khác hình thì nói rõ tên và địa điểm sẽ được đọc lại. */
export function invitationOccasionShapeChangeNote(from: unknown, to: unknown): string | null {
  const fromKey = normalizeInvitationOccasion(from)
  const toKey = normalizeInvitationOccasion(to)
  const fromShape = invitationOccasionShape(fromKey)
  const toShape = invitationOccasionShape(toKey)
  if (fromShape === toShape) return null
  const fromCopy = invitationEditorCopy(fromKey)
  const toCopy = invitationEditorCopy(toKey)
  if (fromShape === 'couple') {
    return `«${fromCopy.primaryName}» giữ làm «${toCopy.primaryName}». «${fromCopy.secondaryName}» chuyển thành «${toCopy.secondaryName}». Địa điểm thứ hai vẫn được lưu, form chỉ hiện một địa điểm.`
  }
  return `«${fromCopy.primaryName}» giữ làm «${toCopy.primaryName}». «${fromCopy.secondaryName}» hiện lại thành «${toCopy.secondaryName}». Địa điểm thứ hai hiện lại trên form.`
}

type Five = readonly [string, string, string, string, string]

function at(pack: Five, locale: string): string {
  if (locale === 'en') return pack[1]
  if (locale === 'zh') return pack[2]
  if (locale === 'ja') return pack[3]
  if (locale === 'ko') return pack[4]
  return pack[0]
}

type PublicBits = {
  eyebrow: Five
  dateFallback: Five
  timeFallback: Five
  defaultInvitation: Five
  defaultCoupleIntro: Five
  familiesIntro: Five
  primaryFamily: Five
  secondaryFamily: Five
  primaryRole: Five
  secondaryRole: Five
  letterAsk: Five
  coupleIntroTitle: Five
  defaultTimeline: Five
  dressCodeTitle: Five
  storyTitle: Five
  albumTitle: Five
  albumAlt: Five
  wishPlaceholder: Five
  wishPresetList: Five
  venueGroom: Five
  venueBride: Five
  calendarSection: Five
  calendarIntro: Five
  countdownPast: Five
  giftBox: Five
  giftDialog: Five
  giftAria: Five
  mapTitle: Five
  seal: string
}

const NEUTRAL_WISH: Five = [
  'Chúc buổi tiệc thật vui và đáng nhớ.\nChúc mọi điều tốt đẹp sẽ đến với gia đình.\nCảm ơn lời mời. Hẹn gặp trong buổi tiệc.',
  'Wishing you a joyful and memorable gathering.\nMay good things come to your family.\nThank you for the invitation. See you there.',
  '祝聚会欢乐、值得纪念。\n祝家人诸事顺遂。\n谢谢邀请，聚会见。',
  '楽しく思い出に残る会になりますように。\nご家族に良いことが訪れますように。\nご招待ありがとうございます。会場でお会いしましょう。',
  '즐겁고 기억에 남는 자리가 되길 바랍니다.\n가족에게 좋은 일이 가득하길.\n초대해 주셔서 감사합니다. 행사에서 뵙겠습니다.',
]

const BABY_WISH: Five = [
  'Chúc bé mau lớn, khỏe mạnh và hay cười.\nChúc gia đình luôn bình an, đủ đầy.\nCảm ơn lời mời. Hẹn gặp bé trong ngày vui.',
  'Wishing the baby health, laughter, and a bright childhood.\nMay the family stay peaceful and full.\nThank you for the invitation.',
  '祝宝宝健康长大、常带笑容。\n祝家人平安富足。\n谢谢邀请。',
  '赤ちゃんが健やかに育ち、よく笑いますように。\nご家族が平安でありますように。\nご招待ありがとうございます。',
  '아기가 건강하게 자라고 자주 웃길 바랍니다.\n가족 모두 평안하길.\n초대해 주셔서 감사합니다.',
]

const BIRTHDAY_WISH: Five = [
  'Chúc mừng sinh nhật. Mong một tuổi mới thật vui.\nChúc sức khỏe, bình an và đủ điều như ý.\nCảm ơn lời mời. Hẹn gặp ở bữa tiệc.',
  'Happy birthday. Wishing you a joyful new year of life.\nHealth, peace, and everything you hope for.\nThank you for the invitation.',
  '生日快乐。祝新的一岁愉快。\n祝健康、平安、心想事成。\n谢谢邀请。',
  'お誕生日おめでとうございます。新しい一年が楽しくありますように。\n健康と平安をお祈りします。\nご招待ありがとうございます。',
  '생일 축하합니다. 새로운 한 해가 즐겁길.\n건강과 평안을 바랍니다.\n초대해 주셔서 감사합니다.',
]

const LONGEVITY_WISH: Five = [
  'Kính chúc sức khỏe, an khang và sống lâu.\nChúc gia đình sum vầy, con cháu hiếu thảo.\nCảm ơn lời mời. Hẹn gặp trong lễ mừng thọ.',
  'Wishing you health, peace, and many more years.\nMay the family stay close.\nThank you for the invitation.',
  '敬祝健康、安康、长寿。\n祝家人团圆。\n谢谢邀请。',
  'ご健康とご長寿をお祈りします。\nご家族が揃いますように。\nご招待ありがとうございます。',
  '건강과 장수를 기원합니다.\n가족이 함께하길.\n초대해 주셔서 감사합니다.',
]

const OPENING_WISH: Five = [
  'Chúc khai trương hanh thông, khách đông, việc thuận.\nChúc cửa hàng ngày càng vững.\nCảm ơn lời mời. Hẹn gặp ngày khai trương.',
  'Wishing you a smooth opening and steady success.\nMay the shop grow well.\nThank you for the invitation.',
  '祝开业顺利、客源兴旺。\n祝店铺越来越稳。\n谢谢邀请。',
  'ご開業が順調でありますように。\nお店がますます堅実でありますように。\nご招待ありがとうございます。',
  '개업이 순조롭고 손님이 많길 바랍니다.\n가게가 든든히 자라길.\n초대해 주셔서 감사합니다.',
]

const TIME: Five = ['Giờ tổ chức', 'Event time', '活动时间', '開始時刻', '행사 시간']
const FAMILIES: Five = ['Gia đình', 'Family', '家庭', 'ご家族', '가족']
const INTRO_TITLE: Five = ['Lời ngỏ', 'A note', '致辞', 'ごあいさつ', '인사말']
const TIMELINE: Five = [
  'Đón khách và cùng chung vui trong buổi tiệc.',
  'Welcome guests and celebrate together.',
  '迎宾并一起庆祝。',
  'お客様をお迎えし、一緒にお祝いします。',
  '손님을 맞이하고 함께 축하합니다.',
]
const DRESS: Five = ['Trang phục', 'Attire', '着装', '服装', '복장']
const STORY: Five = ['Câu chuyện', 'Story', '故事', 'ストーリー', '이야기']
const ALBUM_ALT: Five = ['Ảnh album', 'Album photo', '相册照片', 'アルバム写真', '앨범 사진']
const VENUE: Five = ['Địa điểm tổ chức', 'Venue', '举办地点', '会場', '장소']
const COUNTDOWN: Five = [
  'Đã đến ngày — hẹn gặp bạn tại buổi tiệc!',
  'The day is here — see you at the gathering!',
  '日子到了——宴会上见！',
  '当日になりました。会場でお会いしましょう。',
  '날이 되었습니다. 자리에서 뵙겠습니다!',
]
const GIFT_BOX: Five = ['Hộp mừng', 'Gift box', '贺礼', 'お祝い', '축하 봉투']
const GIFT_DIALOG: Five = [
  'Mừng — quét VietQR',
  'Gift — scan VietQR',
  '贺礼 — 扫描 VietQR',
  'お祝い — VietQRを読み取る',
  '축하 — VietQR 스캔',
]
const GIFT_ARIA: Five = [
  'Mở hộp mừng, xem mã quét',
  'Open the gift box and view the QR code',
  '打开贺礼，查看二维码',
  'お祝いを開き、QRコードを見る',
  '축하 봉투를 열고 QR 코드를 보기',
]
const MAP: Five = [
  'Bản đồ địa điểm',
  'Venue map',
  '地点地图',
  '会場の地図',
  '장소 지도',
]
const COUPLE_INTRO: Five = [
  'Cảm ơn bạn đã hiện diện trong ngày đặc biệt này.',
  'Thank you for being here on this special day.',
  '感谢你出席这个特别的日子。',
  '特別な日にお越しくださりありがとうございます。',
  '특별한 날에 함께해 주셔서 감사합니다.',
]
const LETTER: Five = ['Xem thiệp', 'View invitation', '查看请柬', '招待状を見る', '청첩장 보기']

function party(input: {
  eyebrow: Five
  date: Five
  invitation: Five
  role: Five
  secondaryRole: Five
  album: Five
  wishPlaceholder: Five
  wishes: Five
  calendar: Five
  calendarIntro: Five
  seal?: string
  families?: Five
  primaryFamily?: Five
  secondaryFamily?: Five
  venueGroom?: Five
  venueBride?: Five
}): PublicBits {
  return {
    eyebrow: input.eyebrow,
    dateFallback: input.date,
    timeFallback: TIME,
    defaultInvitation: input.invitation,
    defaultCoupleIntro: COUPLE_INTRO,
    familiesIntro: input.families ?? FAMILIES,
    primaryFamily: input.primaryFamily ?? FAMILIES,
    secondaryFamily: input.secondaryFamily ?? FAMILIES,
    primaryRole: input.role,
    secondaryRole: input.secondaryRole,
    letterAsk: LETTER,
    coupleIntroTitle: INTRO_TITLE,
    defaultTimeline: TIMELINE,
    dressCodeTitle: DRESS,
    storyTitle: STORY,
    albumTitle: input.album,
    albumAlt: ALBUM_ALT,
    wishPlaceholder: input.wishPlaceholder,
    wishPresetList: input.wishes,
    venueGroom: input.venueGroom ?? VENUE,
    venueBride: input.venueBride ?? VENUE,
    calendarSection: input.calendar,
    calendarIntro: input.calendarIntro,
    countdownPast: COUNTDOWN,
    giftBox: GIFT_BOX,
    giftDialog: GIFT_DIALOG,
    giftAria: GIFT_ARIA,
    mapTitle: MAP,
    seal: input.seal ?? '✦',
  }
}

const PUBLIC: Record<Exclude<InvitationOccasionKey, 'wedding'>, PublicBits> = {
  engagement: party({
    eyebrow: ['Đám hỏi', 'Engagement', '订婚', '結納', '약혼'],
    date: ['Ngày đám hỏi', 'Engagement day', '订婚日', '結納の日', '약혼일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự lễ đám hỏi của {couple}.',
      'You are cordially invited to the engagement celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的订婚宴。',
      '{couple} の結納にご招待いたします。',
      '{couple}의 약혼 잔치에 정중히 초대합니다.',
    ],
    role: ['Chú rể', 'Groom', '新郎', '新郎', '신랑'],
    secondaryRole: ['Cô dâu', 'Bride', '新娘', '新婦', '신부'],
    album: ['Album ảnh đám hỏi', 'Engagement album', '订婚相册', '結納アルバム', '약혼 앨범'],
    wishPlaceholder: [
      'Gửi lời chúc đến hai bạn...',
      'Send a wish to the couple...',
      '送上对两位的祝福...',
      'お二人へのお祝いを書いてください...',
      '두 분께 축하 메시지를 남겨 주세요...',
    ],
    wishes: [
      'Chúc hai gia đình sum vầy, lễ đám hỏi thật trọn vẹn.\nChúc hai bạn thuận hòa, sớm thành gia thất.\nCảm ơn lời mời. Hẹn gặp trong ngày vui.',
      'Wishing both families a complete engagement day.\nMay you stay in step with each other.\nThank you for the invitation.',
      '祝两家团圆，订婚宴圆满。\n祝两位和顺，早日成家。\n谢谢邀请。',
      '両家が揃い、結納が満ちますように。\nお二人が穏やかでありますように。\nご招待ありがとうございます。',
      '양가가 모여 약혼이 가득하길.\n두 분이 화목하길.\n초대해 주셔서 감사합니다.',
    ],
    calendar: ['THÔNG TIN ĐÁM HỎI', 'ENGAGEMENT', '订婚信息', '結納のご案内', '약혼 안내'],
    calendarIntro: [
      'LỄ ĐÁM HỎI SẼ DIỄN RA VÀO LÚC:',
      'THE ENGAGEMENT BEGINS AT:',
      '订婚宴开始时间：',
      '結納の開始時刻：',
      '약혼 잔치 시작:',
    ],
    families: ['Gia đình hai bên', 'Both families', '双方家庭', '両家', '양가'],
    primaryFamily: ['Nhà trai', "Groom's family", '男方', '新郎側', '신랑 측'],
    secondaryFamily: ['Nhà gái', "Bride's family", '女方', '新婦側', '신부 측'],
    venueGroom: ['Đến tại nhà trai', "Groom's home", '前往男方', '新郎宅へ', '신랑 집'],
    venueBride: ['Đến tại nhà gái', "Bride's home", '前往女方', '新婦宅へ', '신부 집'],
    seal: '囍',
  }),
  full_month: party({
    eyebrow: ['Đầy tháng', 'Full moon', '满月', 'お宮参り・満月', '백일'],
    date: ['Ngày đầy tháng', 'Full-moon day', '满月日', '満月の日', '백일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự tiệc đầy tháng của {couple}.',
      'You are cordially invited to the full-moon celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的满月宴。',
      '{couple} の満月祝いにご招待いたします。',
      '{couple}의 백일잔치에 정중히 초대합니다.',
    ],
    role: ['Bé', 'Baby', '宝宝', '赤ちゃん', '아기'],
    secondaryRole: ['Bố mẹ', 'Parents', '父母', 'ご両親', '부모님'],
    album: ['Album ảnh bé', 'Baby album', '宝宝相册', '赤ちゃんのアルバム', '아기 앨범'],
    wishPlaceholder: ['Gửi lời chúc đến bé và gia đình...', 'A wish for the baby and family...', '送给宝宝和家人的祝福...', '赤ちゃんとご家族へのお祝い...', '아기와 가족에게 축하를...'],
    wishes: BABY_WISH,
    calendar: ['THÔNG TIN ĐẦY THÁNG', 'FULL MOON', '满月信息', '満月のご案内', '백일 안내'],
    calendarIntro: ['TIỆC ĐẦY THÁNG SẼ DIỄN RA VÀO LÚC:', 'THE CELEBRATION BEGINS AT:', '满月宴开始时间：', '満月祝いの開始時刻：', '백일잔치 시작:'],
  }),
  first_birthday: party({
    eyebrow: ['Thôi nôi', 'First birthday', '周岁', '一歳の誕生日', '돌잔치'],
    date: ['Ngày thôi nôi', 'First birthday', '周岁日', '一歳の誕生日', '돌잔치'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự tiệc thôi nôi của {couple}.',
      'You are cordially invited to the first-birthday celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的周岁宴。',
      '{couple} の一歳の誕生日にご招待いたします。',
      '{couple}의 돌잔치에 정중히 초대합니다.',
    ],
    role: ['Bé', 'Baby', '宝宝', '赤ちゃん', '아기'],
    secondaryRole: ['Bố mẹ', 'Parents', '父母', 'ご両親', '부모님'],
    album: ['Album ảnh bé', 'Baby album', '宝宝相册', '赤ちゃんのアルバム', '아기 앨범'],
    wishPlaceholder: ['Gửi lời chúc thôi nôi...', 'A first-birthday wish...', '周岁祝福...', '一歳のお祝い...', '돌잔치 축하...'],
    wishes: BABY_WISH,
    calendar: ['THÔNG TIN THÔI NÔI', 'FIRST BIRTHDAY', '周岁信息', '一歳のご案内', '돌잔치 안내'],
    calendarIntro: ['TIỆC THÔI NÔI SẼ DIỄN RA VÀO LÚC:', 'THE CELEBRATION BEGINS AT:', '周岁宴开始时间：', 'お祝いの開始時刻：', '돌잔치 시작:'],
  }),
  birthday: party({
    eyebrow: ['Sinh nhật', 'Birthday', '生日', '誕生日', '생일'],
    date: ['Ngày sinh nhật', 'Birthday', '生日', '誕生日', '생일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự tiệc sinh nhật của {couple}.',
      'You are cordially invited to the birthday celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的生日宴。',
      '{couple} の誕生日祝いにご招待いたします。',
      '{couple}의 생일 파티에 정중히 초대합니다.',
    ],
    role: ['Sinh nhật', 'Birthday', '生日', '誕生日', '생일'],
    secondaryRole: ['', '', '', '', ''],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc sinh nhật...', 'Send a birthday wish...', '送上生日祝福...', '誕生日のお祝いを...', '생일 축하를...'],
    wishes: BIRTHDAY_WISH,
    calendar: ['THÔNG TIN SINH NHẬT', 'BIRTHDAY', '生日信息', '誕生日のご案内', '생일 안내'],
    calendarIntro: ['TIỆC SINH NHẬT SẼ DIỄN RA VÀO LÚC:', 'THE PARTY BEGINS AT:', '生日宴开始时间：', 'パーティーの開始時刻：', '생일 파티 시작:'],
  }),
  longevity: party({
    eyebrow: ['Mừng thọ', 'Longevity', '寿宴', '長寿祝い', '수연'],
    date: ['Ngày mừng thọ', 'Celebration day', '寿宴日', 'お祝いの日', '수연일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự lễ mừng thọ của {couple}.',
      'You are cordially invited to the longevity celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的寿宴。',
      '{couple} の長寿祝いにご招待いたします。',
      '{couple}의 수연에 정중히 초대합니다.',
    ],
    role: ['Mừng thọ', 'Honoree', '寿星', 'お祝いされる方', '주인공'],
    secondaryRole: ['Gia đình', 'Family', '家人', 'ご家族', '가족'],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Kính gửi lời chúc mừng thọ...', 'A longevity wish...', '敬送寿宴祝福...', '長寿のお祝いを...', '수연 축하를...'],
    wishes: LONGEVITY_WISH,
    calendar: ['THÔNG TIN MỪNG THỌ', 'LONGEVITY', '寿宴信息', '長寿祝いのご案内', '수연 안내'],
    calendarIntro: ['LỄ MỪNG THỌ SẼ DIỄN RA VÀO LÚC:', 'THE CELEBRATION BEGINS AT:', '寿宴开始时间：', 'お祝いの開始時刻：', '수연 시작:'],
    seal: '壽',
  }),
  grand_opening: party({
    eyebrow: ['Khai trương', 'Grand opening', '开业', '開店', '개업'],
    date: ['Ngày khai trương', 'Opening day', '开业日', '開店日', '개업일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự lễ khai trương {couple}.',
      'You are cordially invited to the grand opening of {couple}.',
      '诚挚邀请您参加 {couple} 的开业典礼。',
      '{couple} の開店祝いにご招待いたします。',
      '{couple} 개업식에 정중히 초대합니다.',
    ],
    role: ['Khai trương', 'Opening', '开业', '開店', '개업'],
    secondaryRole: ['Đại diện', 'Host', '代表', '代表', '대표'],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc khai trương...', 'An opening wish...', '开业祝福...', '開店のお祝いを...', '개업 축하를...'],
    wishes: OPENING_WISH,
    calendar: ['THÔNG TIN KHAI TRƯƠNG', 'GRAND OPENING', '开业信息', '開店のご案内', '개업 안내'],
    calendarIntro: ['LỄ KHAI TRƯƠNG SẼ DIỄN RA VÀO LÚC:', 'THE OPENING BEGINS AT:', '开业开始时间：', '開店祝いの開始時刻：', '개업식 시작:'],
  }),
  housewarming: party({
    eyebrow: ['Tân gia', 'Housewarming', '乔迁', '新居祝い', '집들이'],
    date: ['Ngày tân gia', 'Housewarming day', '乔迁日', '新居祝いの日', '집들이'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự tiệc tân gia của {couple}.',
      'You are cordially invited to the housewarming of {couple}.',
      '诚挚邀请您参加 {couple} 的乔迁宴。',
      '{couple} の新居祝いにご招待いたします。',
      '{couple}의 집들이에 정중히 초대합니다.',
    ],
    role: ['Tân gia', 'Host', '主人', 'ご主人', '주인'],
    secondaryRole: ['', '', '', '', ''],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc tân gia...', 'A housewarming wish...', '乔迁祝福...', '新居のお祝いを...', '집들이 축하를...'],
    wishes: NEUTRAL_WISH,
    calendar: ['THÔNG TIN TÂN GIA', 'HOUSEWARMING', '乔迁信息', '新居祝いのご案内', '집들이 안내'],
    calendarIntro: ['TIỆC TÂN GIA SẼ DIỄN RA VÀO LÚC:', 'THE GATHERING BEGINS AT:', '乔迁宴开始时间：', '新居祝いの開始時刻：', '집들이 시작:'],
  }),
  gathering: party({
    eyebrow: ['Tất niên / liên hoan', 'Gathering', '聚会', '宴会', '모임'],
    date: ['Ngày tổ chức', 'Event day', '举办日', '開催日', '행사일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự {couple}.',
      'You are cordially invited to {couple}.',
      '诚挚邀请您参加 {couple}。',
      '{couple} にご招待いたします。',
      '{couple}에 정중히 초대합니다.',
    ],
    role: ['Buổi tiệc', 'Gathering', '聚会', '宴会', '모임'],
    secondaryRole: ['', '', '', '', ''],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc buổi tiệc...', 'A wish for the gathering...', '聚会祝福...', '宴会へのお祝いを...', '모임 축하를...'],
    wishes: NEUTRAL_WISH,
    calendar: ['THÔNG TIN BUỔI TIỆC', 'GATHERING', '聚会信息', '宴会のご案内', '모임 안내'],
    calendarIntro: ['BUỔI TIỆC SẼ DIỄN RA VÀO LÚC:', 'THE GATHERING BEGINS AT:', '聚会开始时间：', '宴会の開始時刻：', '모임 시작:'],
  }),
  graduation: party({
    eyebrow: ['Tốt nghiệp', 'Graduation', '毕业', '卒業', '졸업'],
    date: ['Ngày tốt nghiệp', 'Graduation day', '毕业日', '卒業の日', '졸업일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự lễ tốt nghiệp của {couple}.',
      'You are cordially invited to the graduation celebration of {couple}.',
      '诚挚邀请您参加 {couple} 的毕业礼。',
      '{couple} の卒業祝いにご招待いたします。',
      '{couple}의 졸업식에 정중히 초대합니다.',
    ],
    role: ['Tốt nghiệp', 'Graduate', '毕业生', '卒業生', '졸업생'],
    secondaryRole: ['Gia đình', 'Family', '家人', 'ご家族', '가족'],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc tốt nghiệp...', 'A graduation wish...', '毕业祝福...', '卒業のお祝いを...', '졸업 축하를...'],
    wishes: NEUTRAL_WISH,
    calendar: ['THÔNG TIN TỐT NGHIỆP', 'GRADUATION', '毕业信息', '卒業のご案内', '졸업 안내'],
    calendarIntro: ['LỄ TỐT NGHIỆP SẼ DIỄN RA VÀO LÚC:', 'THE CELEBRATION BEGINS AT:', '毕业礼开始时间：', '卒業祝いの開始時刻：', '졸업식 시작:'],
  }),
  anniversary: party({
    eyebrow: ['Kỷ niệm', 'Anniversary', '纪念日', '記念日', '기념일'],
    date: ['Ngày kỷ niệm', 'Anniversary', '纪念日', '記念日', '기념일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự ngày kỷ niệm của {couple}.',
      'You are cordially invited to the anniversary of {couple}.',
      '诚挚邀请您参加 {couple} 的纪念日。',
      '{couple} の記念日にご招待いたします。',
      '{couple}의 기념일에 정중히 초대합니다.',
    ],
    role: ['', '', '', '', ''],
    secondaryRole: ['', '', '', '', ''],
    album: ['Album ảnh kỷ niệm', 'Anniversary album', '纪念相册', '記念アルバム', '기념 앨범'],
    wishPlaceholder: ['Gửi lời chúc kỷ niệm...', 'An anniversary wish...', '纪念日祝福...', '記念日のお祝いを...', '기념일 축하를...'],
    wishes: NEUTRAL_WISH,
    calendar: ['THÔNG TIN KỶ NIỆM', 'ANNIVERSARY', '纪念日信息', '記念日のご案内', '기념일 안내'],
    calendarIntro: ['NGÀY KỶ NIỆM SẼ DIỄN RA VÀO LÚC:', 'THE ANNIVERSARY BEGINS AT:', '纪念日开始时间：', '記念日の開始時刻：', '기념일 시작:'],
    families: ['Hai bên', 'Both sides', '双方', '双方', '양측'],
    primaryFamily: ['Bên thứ nhất', 'First side', '第一方', '一方', '첫 번째'],
    secondaryFamily: ['Bên thứ hai', 'Second side', '第二方', 'もう一方', '두 번째'],
    venueGroom: ['Bên thứ nhất', 'First side', '第一方', '一方', '첫 번째'],
    venueBride: ['Bên thứ hai', 'Second side', '第二方', 'もう一方', '두 번째'],
  }),
  ceremony: party({
    eyebrow: ['Sự kiện', 'Ceremony', '典礼', '式典', '행사'],
    date: ['Ngày diễn ra', 'Event day', '举办日', '開催日', '행사일'],
    invitation: [
      'Trân trọng kính mời quý khách đến dự {couple}.',
      'You are cordially invited to {couple}.',
      '诚挚邀请您参加 {couple}。',
      '{couple} にご招待いたします。',
      '{couple}에 정중히 초대합니다.',
    ],
    role: ['Sự kiện', 'Event', '活动', '式典', '행사'],
    secondaryRole: ['Ban tổ chức', 'Hosts', '主办方', '主催', '주최'],
    album: ['Album ảnh', 'Photo album', '相册', 'アルバム', '앨범'],
    wishPlaceholder: ['Gửi lời chúc sự kiện...', 'A wish for the event...', '活动祝福...', '式典へのメッセージ...', '행사 메시지를...'],
    wishes: NEUTRAL_WISH,
    calendar: ['THÔNG TIN SỰ KIỆN', 'EVENT', '活动信息', '式典のご案内', '행사 안내'],
    calendarIntro: ['SỰ KIỆN SẼ DIỄN RA VÀO LÚC:', 'THE EVENT BEGINS AT:', '活动开始时间：', '式典の開始時刻：', '행사 시작:'],
  }),
}

export type InvitationSeoCopy = {
  title: string
  eventNoun: string
}

const SEO: Record<InvitationOccasionKey, InvitationSeoCopy> = {
  wedding: { title: 'Thiệp mời cưới', eventNoun: 'lễ cưới' },
  engagement: { title: 'Thiệp mời đám hỏi', eventNoun: 'lễ đám hỏi' },
  full_month: { title: 'Thiệp mời đầy tháng', eventNoun: 'tiệc đầy tháng' },
  first_birthday: { title: 'Thiệp mời thôi nôi', eventNoun: 'tiệc thôi nôi' },
  birthday: { title: 'Thiệp mời sinh nhật', eventNoun: 'tiệc sinh nhật' },
  longevity: { title: 'Thiệp mời mừng thọ', eventNoun: 'lễ mừng thọ' },
  grand_opening: { title: 'Thiệp mời khai trương', eventNoun: 'lễ khai trương' },
  housewarming: { title: 'Thiệp mời tân gia', eventNoun: 'tiệc tân gia' },
  gathering: { title: 'Thiệp mời tiệc', eventNoun: 'buổi tiệc' },
  graduation: { title: 'Thiệp mời tốt nghiệp', eventNoun: 'lễ tốt nghiệp' },
  anniversary: { title: 'Thiệp mời kỷ niệm', eventNoun: 'ngày kỷ niệm' },
  ceremony: { title: 'Thiệp mời sự kiện', eventNoun: 'sự kiện' },
}

export function invitationSeoCopy(raw: unknown): InvitationSeoCopy {
  return SEO[normalizeInvitationOccasion(raw)]
}

export function invitationSeal(raw: unknown): string {
  const key = normalizeInvitationOccasion(raw)
  if (key === 'wedding' || key === 'engagement') return '囍'
  if (key === 'longevity') return '壽'
  return PUBLIC[key].seal
}

function bitsOf(raw: unknown): PublicBits | null {
  const key = normalizeInvitationOccasion(raw)
  if (key === 'wedding') return null
  return PUBLIC[key]
}

export function applyInvitationOccasionPublicCopy<T extends object>(tx: T, occasionKey: unknown, locale: string): T {
  const bits = bitsOf(occasionKey)
  if (!bits) return tx
  return {
    ...tx,
    weddingInvitation: at(bits.eyebrow, locale),
    dateFallback: at(bits.dateFallback, locale),
    timeFallback: at(bits.timeFallback, locale),
    defaultInvitation: at(bits.defaultInvitation, locale),
    defaultCoupleIntro: at(bits.defaultCoupleIntro, locale),
    familiesIntro: at(bits.familiesIntro, locale),
    groomFamily: at(bits.primaryFamily, locale),
    brideFamily: at(bits.secondaryFamily, locale),
    groomRole: at(bits.primaryRole, locale),
    brideRole: at(bits.secondaryRole, locale),
    letterViewAsk: at(bits.letterAsk, locale),
    coupleIntroTitle: at(bits.coupleIntroTitle, locale),
    defaultTimeline: at(bits.defaultTimeline, locale),
    dressCodeTitle: at(bits.dressCodeTitle, locale),
    storyTitle: at(bits.storyTitle, locale),
    albumTitle: at(bits.albumTitle, locale),
    albumAlt: at(bits.albumAlt, locale),
    wishPlaceholder: at(bits.wishPlaceholder, locale),
    wishPresetList: at(bits.wishPresetList, locale),
    guestInviteVenueGroom: at(bits.venueGroom, locale),
    guestInviteVenueBride: at(bits.venueBride, locale),
  }
}

export function applyInvitationCalendarCopy<T extends object>(tx: T, occasionKey: unknown, locale: string): T {
  const bits = bitsOf(occasionKey)
  if (!bits) return tx
  return {
    ...tx,
    sectionTitle: at(bits.calendarSection, locale),
    introLine: at(bits.calendarIntro, locale),
    countdownPast: at(bits.countdownPast, locale),
  }
}

export function applyInvitationGiftCopy<T extends object>(tx: T, occasionKey: unknown, locale: string): T {
  const bits = bitsOf(occasionKey)
  if (!bits) return tx
  return {
    ...tx,
    boxTitle: at(bits.giftBox, locale),
    dialogTitle: at(bits.giftDialog, locale),
    envelopeButtonAria: at(bits.giftAria, locale),
    groomSection: at(bits.primaryRole, locale) || at(bits.eyebrow, locale),
    brideSection: at(bits.secondaryRole, locale),
  }
}

export function applyInvitationMusicCopy<T extends object>(tx: T, occasionKey: unknown, locale: string): T {
  const bits = bitsOf(occasionKey)
  if (!bits) return tx
  return { ...tx, publicMapEmbedTitle: at(bits.mapTitle, locale) }
}

export const WEDDING_GIFT_BLOCKED_MESSAGE =
  'Đã bật QR mừng cưới: nhập đủ thông tin VietQR cho cả chú rể và cô dâu (ngân hàng, STK, tên chủ TK), hoặc nhập URL ảnh QR.'

export function invitationGiftBlockedMessage(raw: unknown): string {
  if (invitationOccasionShape(raw) === 'single') {
    return 'Đã bật QR mừng: nhập đủ thông tin VietQR (ngân hàng, STK, tên chủ TK), hoặc nhập URL ảnh QR.'
  }
  return WEDDING_GIFT_BLOCKED_MESSAGE
}
