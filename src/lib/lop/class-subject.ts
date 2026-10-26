import { SUBJECTS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'

export type ClassSubjectId = (typeof SUBJECTS)[number]['id']

const SUBJECT_IDS = new Set<string>(SUBJECTS.map((s) => s.id))

export function isClassSubjectId(value: string): value is ClassSubjectId {
  return SUBJECT_IDS.has(value)
}

/** Môn chọn khi vào lớp. Không có mục «Khác». */
export function listedClassSubjects() {
  return SUBJECTS.filter((s) => s.id !== 'khac')
}

export function isListedClassSubjectId(value: string): boolean {
  return listedClassSubjects().some((s) => s.id === value)
}

/** Mã môn tự thêm, không trùng mã có sẵn. */
export function teachingSubjectSlug(label: string): string {
  const slug = foldLabel(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  const base = slug || 'mon'
  if (SUBJECT_IDS.has(base)) return `mon-${base}`.slice(0, 40)
  return base
}

export function classSubjectLabel(subjectId: string, locale: string): string {
  const found = SUBJECTS.find((s) => s.id === subjectId)
  if (!found) return subjectId
  return locale === 'vi' ? found.labelVi : found.labelEn
}

export function foldSubjectLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

function foldLabel(raw: string): string {
  return foldSubjectLabel(raw)
}

export type ClassSubjectMatch = { id: string; labelVi: string; labelEn: string }

/** Môn đã có khớp chữ cô đang gõ. «Toán» khớp «Toán học». */
export function matchingClassSubjects<T extends ClassSubjectMatch>(items: T[], query: string): T[] {
  const q = foldSubjectLabel(query)
  if (!q) return []
  const mapped = subjectIdFromFreeLabel(query)
  const scored = items
    .map((item) => {
      const vi = foldSubjectLabel(item.labelVi)
      const en = foldSubjectLabel(item.labelEn)
      let score = 0
      if (vi === q || en === q) score = 100
      else if (mapped !== 'khac' && item.id === mapped) score = 90
      else if (vi.startsWith(q) || en.startsWith(q)) score = 70
      else if (vi.includes(q) || en.includes(q)) score = 50
      return { item, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.labelVi.localeCompare(b.item.labelVi, 'vi'))
  return scored.map((row) => row.item)
}

/** Môn cô gõ trùng hẳn một môn đã có (đúng tên hoặc tên gần như Toán → Toán học). */
export function directExistingClassSubject<T extends ClassSubjectMatch>(items: T[], query: string): T | null {
  const q = foldSubjectLabel(query)
  if (!q) return null
  const exact = items.find((item) => foldSubjectLabel(item.labelVi) === q || foldSubjectLabel(item.labelEn) === q)
  if (exact) return exact
  const mapped = subjectIdFromFreeLabel(query)
  if (mapped === 'khac') return null
  return items.find((item) => item.id === mapped) ?? null
}

/** Map nhãn tự do (Toán, Ngữ văn, …) về mã môn. Không khớp thì `khac`. */
export function subjectIdFromFreeLabel(label: string): ClassSubjectId {
  const n = foldLabel(label)
  if (!n) return 'khac'
  if (/(^| )toan($| )/.test(n) || n.includes('toan hoc')) return 'toan'
  if (n.includes('ngu van') || n.includes('van hoc') || n === 'van') return 'ngu-van'
  if (n.includes('tieng anh') || n.includes('anh van')) return 'tieng-anh'
  if (n.includes('vat ly') || n.includes('vatli') || n === 'ly') return 'vat-ly'
  if (n.includes('hoa hoc') || n === 'hoa') return 'hoa-hoc'
  if (n.includes('sinh hoc') || n === 'sinh') return 'sinh-hoc'
  if (n.includes('lich su')) return 'lich-su'
  if (n.includes('dia ly') || n.includes('dialy')) return 'dia-ly'
  if (n.includes('giao duc cong dan') || n === 'gdcd') return 'gdcd'
  if (n.includes('tin hoc')) return 'tin-hoc'
  if (n.includes('cong nghe')) return 'cong-nghe'
  if (n.includes('am nhac')) return 'am-nhac'
  if (n.includes('my thuat')) return 'my-thuat'
  if (n.includes('the duc')) return 'the-duc'
  return 'khac'
}
