import {
  invitationEditorCopy,
  invitationOccasionShape,
  normalizeInvitationOccasion,
  type InvitationOccasionKey,
} from '@/lib/wedding/invitation-occasion'

export type InvitationComposeSuggestion = { label: string; line: string }

export type InvitationComposeBrief = {
  occasionKey: InvitationOccasionKey
  title: string
  hint: string
  notesLabel: string
  notesPlaceholder: string
  needNames: string
  dateLabel: string
  requireSecondary: boolean
  suggestions: InvitationComposeSuggestion[]
  toneBrief: string
  introBrief: string
  quoteBrief: string
  storyBrief: string
  thanksBrief: string
  namesLine: string
}

function suggest(items: Array<[string, string]>): InvitationComposeSuggestion[] {
  return items.map(([label, line]) => ({ label, line }))
}

const SHARED_HINT =
  'Điền tên và vài dòng về buổi này. Có thể để trống phần ghi chú. Bấm OK, AI soạn lời mở đầu, câu quote, câu chuyện và lời cảm ơn đúng loại thiệp rồi điền vào thiệp. Lần soạn này miễn phí.'

const COUPLE_DATE: Record<'wedding' | 'engagement' | 'anniversary', string> = {
  wedding: 'Ngày cưới',
  engagement: 'Ngày đám hỏi',
  anniversary: 'Ngày kỷ niệm',
}

function couple(input: {
  occasionKey: 'wedding' | 'engagement' | 'anniversary'
  title: string
  needNames: string
  notesLabel: string
  notesPlaceholder: string
  suggestions: InvitationComposeSuggestion[]
  toneBrief: string
  introBrief: string
  quoteBrief: string
  storyBrief: string
  thanksBrief: string
  namesLine: string
}): InvitationComposeBrief {
  return {
    ...input,
    hint: SHARED_HINT,
    dateLabel: COUPLE_DATE[input.occasionKey],
    requireSecondary: true,
  }
}

function single(input: {
  occasionKey: InvitationOccasionKey
  title: string
  needNames: string
  notesLabel: string
  notesPlaceholder: string
  suggestions: InvitationComposeSuggestion[]
  toneBrief: string
  introBrief: string
  quoteBrief: string
  storyBrief: string
  thanksBrief: string
  namesLine: string
}): InvitationComposeBrief {
  const editor = invitationEditorCopy(input.occasionKey)
  return {
    ...input,
    hint: SHARED_HINT,
    dateLabel: editor.dateLabel || 'Ngày tổ chức',
    requireSecondary: false,
  }
}

const BRIEFS: Record<InvitationOccasionKey, InvitationComposeBrief> = {
  wedding: couple({
    occasionKey: 'wedding',
    title: 'Điền thông tin thiệp cưới',
    needNames: 'Điền đủ tên cô dâu và chú rể.',
    notesLabel: 'Câu chuyện tình yêu (tuỳ chọn)',
    notesPlaceholder: 'Vài dòng về hai người. Có thể để trống.',
    suggestions: suggest([
      ['Ngày gặp nhau', 'Ngày gặp nhau: '],
      ['Nơi gặp nhau', 'Nơi gặp nhau: '],
      ['Kỷ niệm đáng nhớ', 'Kỷ niệm đáng nhớ: '],
      ['Ngày cưới', 'Ngày cưới: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng thiệp cưới: thi vị, ấm, không khẩu hiệu, không sáo rỗng.',
    introBrief: 'coupleIntro: lời mở đầu giới thiệu cặp đôi / duyên hạnh ngộ, 2–4 câu.',
    quoteBrief: 'loveQuote: đúng một câu tình yêu ngắn, khoảng 8–14 từ, không ngoặc kép hai đầu.',
    storyBrief: 'storyText: hành trình yêu, 2–4 câu. Không bịa ngày gặp hay kỷ niệm nếu khách không ghi.',
    thanksBrief: 'thankYouText: lời cảm ơn ngày trọng đại, 1–2 câu. Có thể dùng tên hai người.',
    namesLine: 'Cặp đôi',
  }),
  engagement: couple({
    occasionKey: 'engagement',
    title: 'Điền thông tin thiệp đám hỏi',
    needNames: 'Điền đủ tên hai bên.',
    notesLabel: 'Vài dòng về lễ đám hỏi (tuỳ chọn)',
    notesPlaceholder: 'Hai gia đình, lễ vật, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Ngày đám hỏi', 'Ngày đám hỏi: '],
      ['Hai gia đình', 'Hai gia đình: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng thiệp đám hỏi: trang trọng, ấm, hai nhà, không viết như thiệp cưới thành hôn.',
    introBrief: 'coupleIntro: mở đầu lễ đám hỏi của hai người / hai nhà, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn về duyên hai nhà, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về lễ đám hỏi hoặc hai gia đình, 2–4 câu. Không bịa lễ vật hay quê nếu khách không ghi.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui lễ đám hỏi, 1–2 câu.',
    namesLine: 'Hai người',
  }),
  anniversary: couple({
    occasionKey: 'anniversary',
    title: 'Điền thông tin thiệp kỷ niệm',
    needNames: 'Điền đủ tên hai người.',
    notesLabel: 'Cột mốc muốn kể (tuỳ chọn)',
    notesPlaceholder: 'Số năm, kỷ niệm, hoặc điều muốn khách nhớ. Có thể để trống.',
    suggestions: suggest([
      ['Số năm bên nhau', 'Số năm bên nhau: '],
      ['Cột mốc', 'Cột mốc: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng ngày kỷ niệm: ấm, trưởng thành, không viết như đám cưới lần đầu.',
    introBrief: 'coupleIntro: mở đầu ngày kỷ niệm của hai người, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn về chặng đường đã đi cùng, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về cột mốc hai người muốn khách cùng nhớ, 2–4 câu. Không bịa số năm nếu khách không ghi.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui ngày kỷ niệm, 1–2 câu.',
    namesLine: 'Hai người',
  }),
  full_month: single({
    occasionKey: 'full_month',
    title: 'Điền thông tin thiệp đầy tháng',
    needNames: 'Điền tên bé.',
    notesLabel: 'Vài dòng về bé (tuỳ chọn)',
    notesPlaceholder: 'Ngày sinh, bố mẹ, hoặc lời muốn gửi. Có thể để trống.',
    suggestions: suggest([
      ['Ngày sinh', 'Ngày sinh: '],
      ['Bố mẹ', 'Bố mẹ: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng tiệc đầy tháng: ấm, nhẹ, nói về bé và gia đình. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ chào bé và mời khách dự đầy tháng, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn chúc bé, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về bé hoặc tiệc đầy tháng, 2–4 câu. Không bịa ngày sinh nếu khách không ghi.',
    thanksBrief: 'thankYouText: gia đình cảm ơn khách đến chung vui đầy tháng, 1–2 câu.',
    namesLine: 'Bé',
  }),
  first_birthday: single({
    occasionKey: 'first_birthday',
    title: 'Điền thông tin thiệp thôi nôi',
    needNames: 'Điền tên bé.',
    notesLabel: 'Vài dòng về thôi nôi (tuỳ chọn)',
    notesPlaceholder: 'Bố mẹ, điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Ngày thôi nôi', 'Ngày thôi nôi: '],
      ['Bố mẹ', 'Bố mẹ: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng tiệc thôi nôi: ấm, vui, nói về bé tròn một tuổi. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ mời khách dự thôi nôi, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn chúc bé, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về thôi nôi hoặc bé, 2–4 câu.',
    thanksBrief: 'thankYouText: gia đình cảm ơn khách đến chung vui thôi nôi, 1–2 câu.',
    namesLine: 'Bé',
  }),
  birthday: single({
    occasionKey: 'birthday',
    title: 'Điền thông tin thiệp sinh nhật',
    needNames: 'Điền tên người được mừng.',
    notesLabel: 'Vài dòng về buổi sinh nhật (tuỳ chọn)',
    notesPlaceholder: 'Tuổi, chủ đề tiệc, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Tuổi / cột mốc', 'Tuổi / cột mốc: '],
      ['Chủ đề tiệc', 'Chủ đề tiệc: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng tiệc sinh nhật: vui, ấm, rõ người được mừng. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ mời khách mừng sinh nhật, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu chúc ngắn, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về người được mừng hoặc buổi tiệc, 2–4 câu. Không bịa tuổi nếu khách không ghi.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui sinh nhật, 1–2 câu.',
    namesLine: 'Người được mừng',
  }),
  longevity: single({
    occasionKey: 'longevity',
    title: 'Điền thông tin thiệp mừng thọ',
    needNames: 'Điền tên người mừng thọ.',
    notesLabel: 'Vài dòng về lễ mừng thọ (tuỳ chọn)',
    notesPlaceholder: 'Tuổi thọ, con cháu, hoặc lời kính mong. Có thể để trống.',
    suggestions: suggest([
      ['Tuổi thọ', 'Tuổi thọ: '],
      ['Con cháu tổ chức', 'Con cháu tổ chức: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng lễ mừng thọ: kính cẩn, ấm, rõ người được mừng. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ kính mời đến lễ mừng thọ, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu chúc thọ ngắn, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về người mừng thọ hoặc gia đình, 2–4 câu. Không bịa tuổi nếu khách không ghi.',
    thanksBrief: 'thankYouText: gia đình cảm ơn khách đến chung vui lễ mừng thọ, 1–2 câu.',
    namesLine: 'Người mừng thọ',
  }),
  grand_opening: single({
    occasionKey: 'grand_opening',
    title: 'Điền thông tin thiệp khai trương',
    needNames: 'Điền tên cửa hàng hoặc thương hiệu.',
    notesLabel: 'Vài dòng về cửa hàng (tuỳ chọn)',
    notesPlaceholder: 'Ngành hàng, người đại diện, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Ngành hàng', 'Ngành hàng: '],
      ['Người đại diện', 'Người đại diện: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng lễ khai trương: trang trọng, rõ ràng, nói về cửa hàng. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: giới thiệu cửa hàng và mời khách dự khai trương, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu chúc hanh thông ngắn, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về cửa hàng hoặc ngày khai trương, 2–4 câu. Không bịa ngành hàng nếu khách không ghi.',
    thanksBrief: 'thankYouText: cảm ơn khách đến dự lễ khai trương, 1–2 câu.',
    namesLine: 'Cửa hàng',
  }),
  housewarming: single({
    occasionKey: 'housewarming',
    title: 'Điền thông tin thiệp tân gia',
    needNames: 'Điền tên chủ nhà.',
    notesLabel: 'Vài dòng về nhà mới (tuỳ chọn)',
    notesPlaceholder: 'Gia đình, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Gia đình', 'Gia đình: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng tiệc tân gia: thân mật, ấm, mời khách đến nhà mới. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ mời khách đến tiệc tân gia, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn về nhà mới / sum vầy, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về chủ nhà hoặc buổi tân gia, 2–4 câu.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui tiệc tân gia, 1–2 câu.',
    namesLine: 'Chủ nhà',
  }),
  gathering: single({
    occasionKey: 'gathering',
    title: 'Điền thông tin thiệp tất niên / liên hoan',
    needNames: 'Điền tên buổi tiệc.',
    notesLabel: 'Vài dòng về buổi tiệc (tuỳ chọn)',
    notesPlaceholder: 'Công ty, nhóm, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Đơn vị / nhóm', 'Đơn vị / nhóm: '],
      ['Chủ đề buổi tiệc', 'Chủ đề buổi tiệc: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng tiệc tất niên hoặc liên hoan: vui, rõ buổi họp mặt. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ mời đến buổi tiệc, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn về gặp gỡ / năm cũ năm mới, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về buổi tiệc hoặc nhóm tổ chức, 2–4 câu.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui buổi tiệc, 1–2 câu.',
    namesLine: 'Buổi tiệc',
  }),
  graduation: single({
    occasionKey: 'graduation',
    title: 'Điền thông tin thiệp tốt nghiệp',
    needNames: 'Điền tên tân cử nhân.',
    notesLabel: 'Vài dòng về lễ tốt nghiệp (tuỳ chọn)',
    notesPlaceholder: 'Trường, ngành, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Trường / ngành', 'Trường / ngành: '],
      ['Gia đình', 'Gia đình: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng lễ tốt nghiệp: vui, tự hào, rõ người tốt nghiệp. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: lời ngỏ mời khách mừng tốt nghiệp, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu chúc ngắn về chặng đường mới, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về tân cử nhân hoặc lễ tốt nghiệp, 2–4 câu. Không bịa trường nếu khách không ghi.',
    thanksBrief: 'thankYouText: cảm ơn khách đến chung vui lễ tốt nghiệp, 1–2 câu.',
    namesLine: 'Tân cử nhân',
  }),
  ceremony: single({
    occasionKey: 'ceremony',
    title: 'Điền thông tin thiệp sự kiện',
    needNames: 'Điền tên sự kiện.',
    notesLabel: 'Vài dòng về sự kiện (tuỳ chọn)',
    notesPlaceholder: 'Đơn vị tổ chức, chương trình, hoặc điều muốn khách biết. Có thể để trống.',
    suggestions: suggest([
      ['Đơn vị tổ chức', 'Đơn vị tổ chức: '],
      ['Chương trình', 'Chương trình: '],
      ['Điều muốn khách biết', 'Điều muốn khách biết: '],
    ]),
    toneBrief: 'Giọng thiệp sự kiện: trang trọng, rõ ràng, đúng hội nghị / khánh thành / khai giảng. Không viết như thiệp cưới.',
    introBrief: 'coupleIntro: giới thiệu sự kiện và lời mời, 2–4 câu.',
    quoteBrief: 'loveQuote: một câu ngắn về buổi lễ, 8–14 từ.',
    storyBrief: 'storyText: vài dòng về sự kiện hoặc ban tổ chức, 2–4 câu.',
    thanksBrief: 'thankYouText: ban tổ chức cảm ơn khách đến tham dự, 1–2 câu.',
    namesLine: 'Sự kiện',
  }),
}

export function invitationComposeBrief(raw: unknown): InvitationComposeBrief {
  return BRIEFS[normalizeInvitationOccasion(raw)]
}

export function invitationComposeRequiresSecondary(raw: unknown): boolean {
  return invitationOccasionShape(raw) === 'couple'
}

export function invitationComposeNamesReady(input: {
  occasionKey?: unknown
  primaryName?: string | null
  secondaryName?: string | null
}): boolean {
  const primary = (input.primaryName ?? '').trim()
  const secondary = (input.secondaryName ?? '').trim()
  if (!primary) return false
  return invitationComposeRequiresSecondary(input.occasionKey) ? Boolean(secondary) : true
}
