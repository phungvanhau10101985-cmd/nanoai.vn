/** Icon lịch trình là ảnh chụp, chọn theo chủ đề của từng mốc. */

export type WeddingTimelineIconKind =
  | 'welcome'
  | 'ceremony'
  | 'guests'
  | 'music'
  | 'photo'
  | 'banquet'
  | 'cake'

const ICON_SRC: Record<WeddingTimelineIconKind, string> = {
  welcome: '/wedding/timeline-icons/timeline-welcome.png',
  ceremony: '/wedding/timeline-icons/timeline-ceremony.png',
  guests: '/wedding/timeline-icons/timeline-guests.png',
  music: '/wedding/timeline-icons/timeline-music.png',
  photo: '/wedding/timeline-icons/timeline-photo.png',
  banquet: '/wedding/timeline-icons/timeline-banquet.png',
  cake: '/wedding/timeline-icons/timeline-cake.png',
}

const NEEDLES: ReadonlyArray<{ kind: WeddingTimelineIconKind; text: string }> = [
  { kind: 'welcome', text: 'don khach' },
  { kind: 'welcome', text: 'don tiep' },
  { kind: 'welcome', text: 'chao don' },
  { kind: 'welcome', text: 'tung hoa' },
  { kind: 'welcome', text: 'welcome' },
  { kind: 'welcome', text: '迎接' },
  { kind: 'welcome', text: 'お迎え' },
  { kind: 'welcome', text: '환영' },
  { kind: 'ceremony', text: 'lam le' },
  { kind: 'ceremony', text: 'nghi thuc' },
  { kind: 'ceremony', text: 'thanh hon' },
  { kind: 'ceremony', text: 'trao nhan' },
  { kind: 'ceremony', text: 'le cuoi' },
  { kind: 'ceremony', text: 'le vu quy' },
  { kind: 'ceremony', text: 'ruoc dau' },
  { kind: 'ceremony', text: 'chao hoi' },
  { kind: 'ceremony', text: 'chuc phuc' },
  { kind: 'ceremony', text: 'ceremony' },
  { kind: 'ceremony', text: 'wedding vow' },
  { kind: 'ceremony', text: '仪式' },
  { kind: 'ceremony', text: '挙式' },
  { kind: 'ceremony', text: '예식' },
  { kind: 'guests', text: 'quan khach' },
  { kind: 'guests', text: 'khach moi' },
  { kind: 'guests', text: 'nang ly' },
  { kind: 'guests', text: 'champagne' },
  { kind: 'guests', text: 'toast' },
  { kind: 'guests', text: '来宾' },
  { kind: 'guests', text: 'ゲスト' },
  { kind: 'guests', text: '하객' },
  { kind: 'music', text: 'am nhac' },
  { kind: 'music', text: 'giao luu' },
  { kind: 'music', text: 'khieu vu' },
  { kind: 'music', text: 'ban nhac' },
  { kind: 'music', text: 'ca hat' },
  { kind: 'music', text: 'phat bieu' },
  { kind: 'music', text: 'nhac' },
  { kind: 'music', text: 'music' },
  { kind: 'music', text: 'dance' },
  { kind: 'music', text: '音乐' },
  { kind: 'music', text: 'ダンス' },
  { kind: 'music', text: '음악' },
  { kind: 'photo', text: 'chup anh' },
  { kind: 'photo', text: 'chup hinh' },
  { kind: 'photo', text: 'may anh' },
  { kind: 'photo', text: 'luu niem' },
  { kind: 'photo', text: 'photograph' },
  { kind: 'photo', text: 'photo' },
  { kind: 'photo', text: 'camera' },
  { kind: 'photo', text: '拍照' },
  { kind: 'photo', text: '写真' },
  { kind: 'photo', text: '사진' },
  { kind: 'banquet', text: 'khai tiec' },
  { kind: 'banquet', text: 'khai vi' },
  { kind: 'banquet', text: 'dung bua' },
  { kind: 'banquet', text: 'tiec cuoi' },
  { kind: 'banquet', text: 'banquet' },
  { kind: 'banquet', text: 'dinner' },
  { kind: 'banquet', text: 'tiec' },
  { kind: 'banquet', text: '宴会' },
  { kind: 'banquet', text: '食事' },
  { kind: 'banquet', text: '만찬' },
  { kind: 'cake', text: 'cat banh' },
  { kind: 'cake', text: 'banh cuoi' },
  { kind: 'cake', text: 'banh kem' },
  { kind: 'cake', text: 'wedding cake' },
  { kind: 'cake', text: 'cake' },
  { kind: 'cake', text: 'banh' },
  { kind: 'cake', text: '蛋糕' },
  { kind: 'cake', text: 'ケーキ' },
  { kind: 'cake', text: '케이크' },
]

export function foldWeddingTimelineLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
}

function earliestKind(folded: string): WeddingTimelineIconKind | null {
  let bestAt = Number.POSITIVE_INFINITY
  let bestLength = -1
  let bestKind: WeddingTimelineIconKind | null = null
  for (const needle of NEEDLES) {
    const at = folded.indexOf(needle.text)
    if (at < 0) continue
    if (at < bestAt || (at === bestAt && needle.text.length > bestLength)) {
      bestAt = at
      bestLength = needle.text.length
      bestKind = needle.kind
    }
  }
  return bestKind
}

/** Ưu tiên cụm trước dấu gạch. Không khớp thì dùng bó hoa chụp, không quay lại icon vẽ. */
export function weddingTimelineIconKind(label: string): WeddingTimelineIconKind {
  const folded = foldWeddingTimelineLabel(label)
  const title = foldWeddingTimelineLabel(label.split(/\s+-\s+/)[0] || label)
  return earliestKind(title) ?? earliestKind(folded) ?? 'welcome'
}

export function weddingTimelineIconSrc(kind: WeddingTimelineIconKind): string {
  return ICON_SRC[kind]
}
