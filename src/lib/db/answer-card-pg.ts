import { randomBytes } from 'node:crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { teacherCanTeachInClassPg } from '@/lib/db/classes-pg'
import { classSubjectLabel } from '@/lib/lop/class-subject'
import {
  answerCardSeatCode,
  answerCardShortName,
  isAnswerCardPhoneToken,
  isAnswerChoice,
  letterForSameOption,
  scanQuestionFromParts,
  scanQuestionFromWorksheetContent,
  scanQuestionInDisplayedOrder,
  type AnswerChoice,
  type ScanQuestion,
} from '@/lib/lop/answer-card'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ANSWER_CARD_SHOT_RETENTION_DAYS = 7

export class AnswerCardSchemaError extends Error {
  constructor() {
    super('answer-card-schema')
    this.name = 'AnswerCardSchemaError'
  }
}

function isSchemaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '42P01'
}

function throwSchema(error: unknown): never {
  if (isSchemaError(error)) throw new AnswerCardSchemaError()
  throw error
}

function newCardToken(): string {
  const n = 10_000_000 + (randomBytes(4).readUInt32BE(0) % 90_000_000)
  return String(n)
}

function newPhoneToken(): string {
  return randomBytes(18).toString('base64url')
}

export type AnswerCardStudent = {
  userId: string
  cardNo: number
  name: string
  token: string
  studentCode?: string
  loginCode?: string
}

export type AnswerCardSource = {
  kind: 'exam' | 'worksheet'
  id: string
  title: string
  label: 'exam' | 'homework' | 'worksheet'
  mcqCount: number
  subjectId: string
  code?: string
}

export type AnswerCardRoundSummary = {
  id: string
  title: string
  status: 'live' | 'closed'
  questionCount: number
  createdAt: string
  subjectId: string
}

export type AnswerCardRosterEntry = {
  userId: string
  cardNo: number
  name: string
  shortName: string
}

export type AnswerCardRoundView = {
  id: string
  classId: string
  className: string
  title: string
  status: 'live' | 'closed'
  questionIndex: number
  questionCount: number
  showResults: boolean
  showSummary: boolean
  revealedQuestionIndex: number | null
  revealedAt: string | null
  phoneSeenAt: string | null
  openPaperAt: string | null
  examCode: string | null
  phoneConnected: boolean
  phonePath: string
  sourceKind: 'exam' | 'worksheet'
  questions: ScanQuestion[]
  roster: AnswerCardRosterEntry[]
  picks: Array<{ questionIndex: number; userId: string; choice: AnswerChoice }>
  /** Đã nộp bài trên máy. Không có lựa chọn vẫn là đã làm và được 0, không phải chưa làm. */
  submittedUserIds: string[]
  shots: AnswerCardShot[]
}

export type AnswerCardShot = {
  id: string
  questionIndex: number
  takenAt: string
  examTitle: string
  subjectName: string
}

export type AnswerCardClassSummary = {
  className: string
  title: string
  questionCount: number
  students: Array<{
    cardNo: number
    name: string
    marks: Array<'correct' | 'wrong' | 'miss'>
    points: number
    total: number
    attempted: boolean
  }>
}

export type AnswerCardPhoneView = {
  status: 'live' | 'closed'
  className: string
  schoolName: string
  title: string
  subjectName: string
  questionIndex: number
  questionCount: number
  saved: number
  total: number
  showSummary: boolean
  summary: AnswerCardClassSummary | null
  roster: Array<{ token: string; cardNo: number; shortName: string }>
}

type StudentRow = { userId: string; name: string }

async function listClassStudents(classId: string): Promise<StudentRow[]> {
  const rows = await pgQuery<{ user_id: string; member_display_name: string | null }>(
    `select m.user_id::text, m.member_display_name
     from public.class_members m
     join public.classes c on c.id = m.class_id
     where m.class_id = $1::uuid
       and m.user_id <> c.teacher_id
       and not exists (
         select 1 from public.class_subjects s
         where s.class_id = m.class_id and s.teacher_id = m.user_id
       )
     order by m.member_display_name asc nulls last, m.user_id`,
    [classId]
  )
  return rows.map((row) => ({
    userId: row.user_id,
    name: String(row.member_display_name ?? '').replace(/\s+/g, ' ').trim() || '—',
  }))
}

export async function listClassAnswerCardsPg(classId: string): Promise<AnswerCardStudent[] | null> {
  if (!isPgConfigured() || !UUID_RE.test(classId)) return null
  try {
    const [students, rows] = await Promise.all([
      listClassStudents(classId),
      pgQuery<{ user_id: string; card_no: number; card_token: string }>(
        `select user_id::text, card_no, card_token
         from public.class_answer_cards
         where class_id = $1::uuid`,
        [classId]
      ),
    ])
    const byUser = new Map(rows.map((row) => [row.user_id, row]))
    return students.flatMap((student) => {
      const card = byUser.get(student.userId)
      if (!card) return []
      return [{ userId: student.userId, cardNo: card.card_no, name: student.name, token: card.card_token }]
    })
  } catch (error) {
    throwSchema(error)
  }
}

export async function ensureClassAnswerCardsPg(classId: string): Promise<AnswerCardStudent[] | null> {
  if (!isPgConfigured() || !UUID_RE.test(classId)) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const existing = await client.query<{ user_id: string; card_no: number; card_token: string }>(
      `select user_id::text, card_no, card_token
       from public.class_answer_cards
       where class_id = $1::uuid`,
      [classId]
    )
    const byUser = new Map(existing.rows.map((row) => [row.user_id, row]))
    let nextNo = existing.rows.reduce((max, row) => Math.max(max, row.card_no), 0)
    const students = await listClassStudents(classId)
    for (const student of students) {
      if (byUser.has(student.userId)) continue
      nextNo += 1
      let inserted = false
      for (let attempt = 0; attempt < 4 && !inserted; attempt += 1) {
        const token = newCardToken()
        try {
          await client.query(
            `insert into public.class_answer_cards (class_id, user_id, card_no, card_token)
             values ($1::uuid, $2::uuid, $3, $4)`,
            [classId, student.userId, nextNo, token]
          )
          byUser.set(student.userId, { user_id: student.userId, card_no: nextNo, card_token: token })
          inserted = true
        } catch (error) {
          const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : ''
          if (code !== '23505') throw error
        }
      }
      if (!inserted) throw new Error('answer-card-token')
    }
    await client.query('commit')
    return students.map((student) => {
      const card = byUser.get(student.userId)
      return {
        userId: student.userId,
        cardNo: card?.card_no ?? 0,
        name: student.name,
        token: card?.card_token ?? '',
      }
    }).filter((card) => card.cardNo > 0 && card.token)
  } catch (error) {
    try { await client.query('rollback') } catch { /* already closed */ }
    if (isSchemaError(error)) throw new AnswerCardSchemaError()
    console.error('[answer-card-pg] ensureClassAnswerCardsPg', error)
    return null
  } finally {
    client.release()
  }
}

function questionsFromExamRows(
  rows: Array<{ question_text: string | null; options: unknown; correct_index: unknown; ord: number | null }>
): ScanQuestion[] {
  const ordered = [...rows].sort((a, b) => Number(a.ord ?? 0) - Number(b.ord ?? 0))
  const questions: ScanQuestion[] = []
  for (const row of ordered) {
    const question = scanQuestionFromParts(row.question_text, row.options, row.correct_index)
    if (question) questions.push(question)
  }
  return questions
}

export async function listAnswerCardSourcesPg(
  classId: string,
  teacherId: string,
  subjectId: string | null
): Promise<AnswerCardSource[] | null> {
  if (!isPgConfigured()) return null
  try {
    const exams = await pgQuery<{
      session_id: string
      code: string | null
      title: string | null
      is_practice_homework: boolean | null
      subject_id: string | null
      question_text: string | null
      options: unknown
      correct_index: unknown
      ord: number | null
    }>(
      `with sessions as (
         select id, code, title, is_practice_homework, subject_id, created_at
         from public.exam_sessions
         where class_id = $1::uuid
           and teacher_id = $2::uuid
           and ($3::text is null or subject_id = $3)
         order by created_at desc
         limit 40
       )
       select s.id::text as session_id, s.code, s.title, s.is_practice_homework, s.subject_id,
              q.question_text, q.options, q.correct_index, q."order" as ord
       from sessions s
       join public.exam_questions q on q.session_id = s.id
       order by s.created_at desc, q."order" asc`,
      [classId, teacherId, subjectId]
    )
    const examGroups = new Map<string, AnswerCardSource & { rows: typeof exams }>()
    for (const row of exams) {
      let group = examGroups.get(row.session_id)
      if (!group) {
        group = {
          kind: 'exam',
          id: row.session_id,
          title: String(row.title ?? '').trim() || 'Bài thi',
          label: row.is_practice_homework ? 'homework' : 'exam',
          code: String(row.code ?? '').trim().toUpperCase(),
          mcqCount: 0,
          subjectId: String(row.subject_id ?? ''),
          rows: [],
        }
        examGroups.set(row.session_id, group)
      }
      group.rows.push(row)
    }
    const sources: AnswerCardSource[] = []
    for (const group of examGroups.values()) {
      const mcqCount = questionsFromExamRows(group.rows).length
      if (mcqCount < 1) continue
      sources.push({
        kind: 'exam',
        id: group.id,
        title: group.title,
        label: group.label,
        code: group.code,
        mcqCount,
        subjectId: group.subjectId,
      })
    }

    const sheets = await pgQuery<{ id: string; topic: string | null; subject_id: string | null; question_ids: string[] | null }>(
      `select w.id::text, w.topic, w.subject_id, w.question_ids
       from public.class_worksheets cw
       join public.worksheet_worksheets w on w.id = cw.worksheet_id
       where cw.class_id = $1::uuid
         and ($2::text is null or w.subject_id = $2)
       order by cw.assigned_at desc
       limit 40`,
      [classId, subjectId]
    )
    const questionIds = [...new Set(sheets.flatMap((sheet) => sheet.question_ids ?? []).filter(Boolean))]
    const questionRows = questionIds.length
      ? await pgQuery<{ id: string; type: string; content_json: unknown }>(
          `select id::text, type::text, content_json
           from public.worksheet_questions
           where id = any($1::uuid[])`,
          [questionIds]
        )
      : []
    const questionById = new Map(questionRows.map((row) => [row.id, row]))
    for (const sheet of sheets) {
      let mcqCount = 0
      for (const id of sheet.question_ids ?? []) {
        const row = questionById.get(id)
        if (!row || row.type === 'essay') continue
        if (scanQuestionFromWorksheetContent(row.content_json)) mcqCount += 1
      }
      if (mcqCount < 1) continue
      sources.push({
        kind: 'worksheet',
        id: sheet.id,
        title: String(sheet.topic ?? '').trim() || 'Phiếu bài tập',
        label: 'worksheet',
        mcqCount,
        subjectId: String(sheet.subject_id ?? ''),
      })
    }
    return sources
  } catch (error) {
    throwSchema(error)
  }
}

export async function listAnswerCardRoundsPg(
  classId: string,
  teacherId: string,
  subjectId: string | null
): Promise<AnswerCardRoundSummary[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      title: string
      status: string
      question_count: number
      created_at: Date | string
      subject_id: string | null
    }>(
      `select id::text, title, status, question_count, created_at, subject_id
       from public.answer_card_rounds
       where class_id = $1::uuid
         and teacher_id = $2::uuid
         and ($3::text is null or subject_id = $3)
       order by created_at desc
       limit 30`,
      [classId, teacherId, subjectId]
    )
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status === 'closed' ? 'closed' : 'live',
      questionCount: row.question_count,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      subjectId: String(row.subject_id ?? ''),
    }))
  } catch (error) {
    throwSchema(error)
  }
}

async function loadExamQuestions(classId: string, teacherId: string, sessionId: string): Promise<{
  title: string
  subjectId: string
  questions: ScanQuestion[]
} | null> {
  const rows = await pgQuery<{
    title: string | null
    subject_id: string | null
    question_text: string | null
    options: unknown
    correct_index: unknown
    ord: number | null
  }>(
    `select s.title, s.subject_id, q.question_text, q.options, q.correct_index, q."order" as ord
     from public.exam_sessions s
     join public.exam_questions q on q.session_id = s.id
     where s.id = $1::uuid
       and s.class_id = $2::uuid
       and s.teacher_id = $3::uuid
     order by q."order" asc`,
    [sessionId, classId, teacherId]
  )
  if (rows.length === 0) return null
  const questions = questionsFromExamRows(rows)
  if (questions.length === 0) return { title: '', subjectId: '', questions: [] }
  return {
    title: String(rows[0]?.title ?? '').trim() || 'Bài thi',
    subjectId: String(rows[0]?.subject_id ?? ''),
    questions,
  }
}

async function loadWorksheetQuestions(classId: string, worksheetId: string): Promise<{
  title: string
  subjectId: string
  questions: ScanQuestion[]
} | null> {
  const sheet = await pgQueryOne<{ topic: string | null; subject_id: string | null; question_ids: string[] | null }>(
    `select w.topic, w.subject_id, w.question_ids
     from public.class_worksheets cw
     join public.worksheet_worksheets w on w.id = cw.worksheet_id
     where cw.class_id = $1::uuid and w.id = $2::uuid
     limit 1`,
    [classId, worksheetId]
  )
  if (!sheet) return null
  const ids = (sheet.question_ids ?? []).filter(Boolean)
  if (ids.length === 0) return { title: '', subjectId: '', questions: [] }
  const rows = await pgQuery<{ id: string; type: string; content_json: unknown }>(
    `select id::text, type::text, content_json
     from public.worksheet_questions
     where id = any($1::uuid[])`,
    [ids]
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  const questions: ScanQuestion[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row || row.type === 'essay') continue
    const question = scanQuestionFromWorksheetContent(row.content_json)
    if (question) questions.push(question)
  }
  return {
    title: String(sheet.topic ?? '').trim() || 'Phiếu bài tập',
    subjectId: String(sheet.subject_id ?? ''),
    questions,
  }
}

function parseChoiceList(value: unknown): string[] {
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item ?? ''))
}

function choiceOrderKey(questions: ScanQuestion[]): string {
  return questions
    .map((question) => `${question.correct}\u0000${question.prompt}\u0000${question.choices.join('\u0001')}`)
    .join('\u0002')
}

async function closeLiveRound(roundId: string): Promise<void> {
  await pgQuery(
    `update public.answer_card_rounds
     set status = 'closed', closed_at = timezone('utc'::text, now())
     where id = $1::uuid and status = 'live'`,
    [roundId]
  )
}

async function reuseLiveRound(
  classId: string,
  teacherId: string,
  sourceKind: 'exam' | 'worksheet',
  sourceId: string,
  match: { choiceKey: string } | { firstPrompt: string | null },
  expectedCount: number
): Promise<AnswerCardRoundView | null> {
  const existing = await pgQueryOne<{ id: string }>(
    `select id::text as id
     from public.answer_card_rounds
     where class_id = $1::uuid
       and teacher_id = $2::uuid
       and source_kind = $3
       and source_id = $4::uuid
       and status = 'live'
     order by created_at desc
     limit 1`,
    [classId, teacherId, sourceKind, sourceId]
  )
  if (!existing?.id) return null
  if ('choiceKey' in match) {
    const rows = await pgQuery<{
      question_index: number
      prompt: string
      choices: unknown
      correct_choice: string
    }>(
      `select question_index, prompt, choices, correct_choice
       from public.answer_card_questions
       where round_id = $1::uuid
       order by question_index asc`,
      [existing.id]
    )
    const stored: ScanQuestion[] = []
    for (const row of rows) {
      const correct = asChoice(row.correct_choice)
      const choices = parseChoiceList(row.choices)
      if (!correct || choices.length < 2) continue
      stored.push({ prompt: row.prompt, choices, correct })
    }
    const sameOrder = stored.length === expectedCount && choiceOrderKey(stored) === match.choiceKey
    if (!sameOrder) {
      await closeLiveRound(existing.id)
      return null
    }
    return loadAnswerCardRoundForTeacherPg(existing.id, teacherId)
  }
  const first = await pgQueryOne<{ prompt: string; n: string }>(
    `select q.prompt,
            (select count(*) from public.answer_card_questions c where c.round_id = $1::uuid)::text as n
     from public.answer_card_questions q
     where q.round_id = $1::uuid and q.question_index = 0`,
    [existing.id]
  )
  const samePaper = Number(first?.n ?? 0) === expectedCount
    && (match.firstPrompt == null || (first?.prompt ?? '') === match.firstPrompt)
  if (!samePaper) {
    await closeLiveRound(existing.id)
    return null
  }
  return loadAnswerCardRoundForTeacherPg(existing.id, teacherId)
}

export type DisplayedExamChoices = { id: string; choices: string[] }

/** Đáp án đúng theo thứ tự đang chiếu, không tin chữ cái do trình duyệt gửi. */
export async function alignDisplayedExamScanQuestions(
  classId: string,
  teacherId: string,
  sessionId: string,
  displayed: DisplayedExamChoices[],
): Promise<ScanQuestion[] | 'mismatch' | null> {
  if (!UUID_RE.test(classId) || !UUID_RE.test(sessionId)) return null
  const rows = await pgQuery<{
    id: string
    question_text: string | null
    options: unknown
    correct_index: unknown
  }>(
    `select q.id::text, q.question_text, q.options, q.correct_index
     from public.exam_sessions s
     join public.exam_questions q on q.session_id = s.id
     where s.id = $1::uuid
       and s.class_id = $2::uuid
       and s.teacher_id = $3::uuid
     order by q."order" asc`,
    [sessionId, classId, teacherId]
  )
  if (rows.length === 0) return null
  const canonical = new Map<string, ScanQuestion>()
  for (const row of rows) {
    const question = scanQuestionFromParts(row.question_text, row.options, row.correct_index)
    if (question) canonical.set(row.id, question)
  }
  if (displayed.length !== canonical.size) return 'mismatch'
  const seen = new Set<string>()
  const aligned: ScanQuestion[] = []
  for (const item of displayed) {
    if (seen.has(item.id)) return 'mismatch'
    seen.add(item.id)
    const question = canonical.get(item.id)
    if (!question) return 'mismatch'
    const next = scanQuestionInDisplayedOrder(question, item.choices)
    if (!next) return 'mismatch'
    aligned.push(next)
  }
  return aligned
}

export async function createAnswerCardRoundPg(input: {
  classId: string
  teacherId: string
  sourceKind: 'exam' | 'worksheet'
  sourceId: string
  questions?: ScanQuestion[]
  displayedChoices?: DisplayedExamChoices[]
}): Promise<AnswerCardRoundView | 'no_mcq' | 'not_found' | 'mismatch' | null> {
  if (!isPgConfigured()) return null
  if (!UUID_RE.test(input.classId) || !UUID_RE.test(input.sourceId)) return 'not_found'
  const displayed = input.sourceKind === 'exam' ? (input.displayedChoices ?? []) : []
  const inline = displayed.length > 0 ? [] : (input.questions ?? []).slice(0, 40)
  let loaded: { title: string; subjectId: string; questions: ScanQuestion[] } | null
  if (displayed.length > 0) {
    const aligned = await alignDisplayedExamScanQuestions(
      input.classId,
      input.teacherId,
      input.sourceId,
      displayed,
    )
    if (aligned === 'mismatch') return 'mismatch'
    if (!aligned) return 'not_found'
    if (aligned.length === 0) return 'no_mcq'
    const exam = await loadExamQuestions(input.classId, input.teacherId, input.sourceId)
    if (!exam) return 'not_found'
    loaded = { title: exam.title, subjectId: exam.subjectId, questions: aligned }
  } else {
    loaded = inline.length > 0
      ? {
          title: inline[0]?.prompt.slice(0, 80) || 'Trắc nghiệm',
          subjectId: '',
          questions: inline,
        }
      : input.sourceKind === 'exam'
        ? await loadExamQuestions(input.classId, input.teacherId, input.sourceId)
        : await loadWorksheetQuestions(input.classId, input.sourceId)
  }
  if (!loaded) return 'not_found'
  if (loaded.questions.length === 0) return 'no_mcq'
  const reused = await reuseLiveRound(
    input.classId,
    input.teacherId,
    input.sourceKind,
    input.sourceId,
    displayed.length > 0
      ? { choiceKey: choiceOrderKey(loaded.questions) }
      : { firstPrompt: inline.length > 0 ? (loaded.questions[0]?.prompt ?? '') : null },
    loaded.questions.length
  )
  if (reused) return reused
  const questions = loaded.questions.slice(0, 200)
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    let roundId = ''
    let phoneToken = ''
    for (let attempt = 0; attempt < 4; attempt += 1) {
      phoneToken = newPhoneToken()
      try {
        const inserted = await client.query<{ id: string }>(
          `insert into public.answer_card_rounds
             (class_id, teacher_id, subject_id, title, source_kind, source_id, phone_token, question_count)
           values ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8)
           returning id::text`,
          [
            input.classId,
            input.teacherId,
            loaded.subjectId || null,
            loaded.title.slice(0, 180),
            input.sourceKind,
            input.sourceId,
            phoneToken,
            questions.length,
          ]
        )
        roundId = inserted.rows[0]?.id ?? ''
        break
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : ''
        if (code !== '23505') throw error
      }
    }
    if (!roundId) throw new Error('answer-card-round')
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index]
      if (!question) continue
      await client.query(
        `insert into public.answer_card_questions (round_id, question_index, prompt, choices, correct_choice)
         values ($1::uuid, $2, $3, $4::jsonb, $5)`,
        [roundId, index, question.prompt, JSON.stringify(question.choices), question.correct]
      )
    }
    await client.query('commit')
    return loadAnswerCardRoundForTeacherPg(roundId, input.teacherId)
  } catch (error) {
    try { await client.query('rollback') } catch { /* already closed */ }
    throwSchema(error)
  } finally {
    client.release()
  }
}

function asChoice(value: string): AnswerChoice | null {
  return isAnswerChoice(value) ? value : null
}

type SubmittedMcqPapers = {
  userIds: string[]
  mcqCount: number
  choicesByUser: Map<string, Array<AnswerChoice | null>>
}

function choiceFromStoredAnswer(
  questionId: string,
  options: unknown,
  answers: Record<string, unknown>,
  perms: Record<string, number[]> | null,
): AnswerChoice | null {
  const optionCount = Array.isArray(options) ? options.length : 0
  if (optionCount < 2) return null
  const raw = answers[questionId]
  const display = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isInteger(display)) return null
  const perm = perms?.[questionId]
  let original = display
  if (perm && perm.length === optionCount) {
    if (display < 0 || display >= perm.length) return null
    original = perm[display] ?? display
  }
  if (original < 0 || original >= optionCount) return null
  const letter = 'ABCD'[original]
  return letter && isAnswerChoice(letter) ? letter : null
}

/** Bài đã nộp trên máy. Câu trắc nghiệm theo thứ tự đề, cùng thứ tự thẻ quét. */
async function loadSubmittedMcqPapers(sessionId: string): Promise<SubmittedMcqPapers | null> {
  if (!UUID_RE.test(sessionId)) return null
  const questions = await pgQuery<{ id: string; question_text: string | null; options: unknown; correct_index: unknown }>(
    `select id::text, question_text, options, correct_index
     from public.exam_questions
     where session_id = $1::uuid
     order by "order" asc`,
    [sessionId],
  )
  const mcq = questions.filter((row) => scanQuestionFromParts(row.question_text, row.options, row.correct_index))
  const attempts = await pgQuery<{ user_id: string | null; answers: unknown; layout_snapshot: unknown }>(
    `select user_id::text, answers, layout_snapshot
     from public.exam_attempts
     where session_id = $1::uuid and submitted_at is not null`,
    [sessionId],
  )
  const choicesByUser = new Map<string, Array<AnswerChoice | null>>()
  const userIds: string[] = []
  for (const attempt of attempts) {
    const userId = attempt.user_id ? String(attempt.user_id) : ''
    if (!userId) continue
    userIds.push(userId)
    const answers = attempt.answers && typeof attempt.answers === 'object'
      ? attempt.answers as Record<string, unknown>
      : {}
    const snapshot = attempt.layout_snapshot && typeof attempt.layout_snapshot === 'object'
      ? attempt.layout_snapshot as { optionPerms?: unknown }
      : null
    const perms = snapshot?.optionPerms && typeof snapshot.optionPerms === 'object'
      ? snapshot.optionPerms as Record<string, number[]>
      : null
    choicesByUser.set(userId, mcq.map((row) => choiceFromStoredAnswer(row.id, row.options, answers, perms)))
  }
  return { userIds, mcqCount: mcq.length, choicesByUser }
}

type MergedAnswerRow = {
  userId: string
  cardNo: number
  name: string
  shortName: string
  attempted: boolean
  choices: Array<AnswerChoice | null>
}

async function loadOriginalScanQuestions(sessionId: string): Promise<ScanQuestion[]> {
  const rows = await pgQuery<{ question_text: string | null; options: unknown; correct_index: unknown }>(
    `select question_text, options, correct_index
     from public.exam_questions
     where session_id = $1::uuid
     order by "order" asc`,
    [sessionId],
  )
  const questions: ScanQuestion[] = []
  for (const row of rows) {
    const question = scanQuestionFromParts(row.question_text, row.options, row.correct_index)
    if (question) questions.push(question)
  }
  return questions
}

/** Một bảng: quét thẻ và nộp trên máy. Chữ cái đưa về thứ tự `targetQuestions`. */
async function loadMergedAnswerRows(
  classId: string,
  sessionId: string,
  targetQuestions: ScanQuestion[],
): Promise<{ submittedUserIds: string[]; students: MergedAnswerRow[] } | null> {
  if (!UUID_RE.test(classId) || !UUID_RE.test(sessionId)) return null
  const questionCount = targetQuestions.length
  const [papers, originalQuestions] = await Promise.all([
    loadSubmittedMcqPapers(sessionId),
    loadOriginalScanQuestions(sessionId),
  ])
  const useOnline = Boolean(
    papers
    && papers.mcqCount === questionCount
    && originalQuestions.length === questionCount,
  )
  const scanRows = await pgQuery<{
    question_index: number
    user_id: string
    choice: string
    round_choices: unknown
  }>(
    `select p.question_index, p.user_id::text, p.choice, q.choices as round_choices
     from public.answer_card_picks p
     join public.answer_card_rounds r on r.id = p.round_id
     join public.answer_card_questions q
       on q.round_id = p.round_id and q.question_index = p.question_index
     where r.class_id = $1::uuid
       and r.source_kind = 'exam'
       and r.source_id = $2::uuid
     order by r.created_at asc, p.question_index asc`,
    [classId, sessionId],
  )
  const scanByUser = new Map<string, Map<number, AnswerChoice>>()
  for (const row of scanRows) {
    if (row.question_index < 0 || row.question_index >= questionCount) continue
    if (!isAnswerChoice(row.choice)) continue
    const target = targetQuestions[row.question_index]
    if (!target) continue
    const roundChoices = parseChoiceList(row.round_choices)
    const fromChoices = roundChoices.length >= 2
      ? roundChoices
      : (originalQuestions[row.question_index]?.choices ?? [])
    const letter = letterForSameOption(row.choice, fromChoices, target.choices)
    if (!letter) continue
    const choices = scanByUser.get(row.user_id) ?? new Map<number, AnswerChoice>()
    choices.set(row.question_index, letter)
    scanByUser.set(row.user_id, choices)
  }
  const [members, cards] = await Promise.all([
    listClassStudents(classId),
    listClassAnswerCardsPg(classId),
  ])
  const cardByUser = new Map((cards ?? []).map((card) => [card.userId, card]))
  const submitted = new Set(papers?.userIds ?? [])
  const students: MergedAnswerRow[] = members.map((member, index) => {
    const card = cardByUser.get(member.userId)
    const scan = scanByUser.get(member.userId)
    const online = useOnline ? papers?.choicesByUser.get(member.userId) : undefined
    const choices = Array.from({ length: questionCount }, (_, questionIndex) => {
      const scanned = scan?.get(questionIndex)
      if (scanned) return scanned
      const onlineLetter = online?.[questionIndex]
      const target = targetQuestions[questionIndex]
      const source = originalQuestions[questionIndex]
      if (!onlineLetter || !target || !source) return null
      return letterForSameOption(onlineLetter, source.choices, target.choices)
    })
    const attempted = submitted.has(member.userId) || choices.some((choice) => choice != null)
    return {
      userId: member.userId,
      cardNo: card?.cardNo ?? index + 1,
      name: card?.name || member.name,
      shortName: answerCardShortName(card?.name || member.name),
      attempted,
      choices,
    }
  })
  return { submittedUserIds: papers?.userIds ?? [], students }
}

function picksFromMergedRows(students: MergedAnswerRow[]): AnswerCardRoundView['picks'] {
  const picks: AnswerCardRoundView['picks'] = []
  for (const student of students) {
    student.choices.forEach((choice, questionIndex) => {
      if (!choice) return
      picks.push({ questionIndex, userId: student.userId, choice })
    })
  }
  return picks
}

export async function loadAnswerCardRoundForTeacherPg(
  roundId: string,
  teacherId: string
): Promise<AnswerCardRoundView | null> {
  if (!isPgConfigured() || !UUID_RE.test(roundId)) return null
  try {
    const round = await pgQueryOne<{
      id: string
      class_id: string
      class_name: string | null
      title: string
      status: string
      question_index: number
      question_count: number
      show_results: boolean
      show_summary: boolean
      revealed_question_index: number | null
      revealed_at: string | null
      phone_seen_at: string | null
      open_paper_at: string | null
      exam_code: string | null
      phone_token: string
      phone_connected: boolean
      source_kind: string
      source_id: string | null
    }>(
      `select r.id::text, r.class_id::text, c.name as class_name, r.title, r.status,
              r.question_index, r.question_count, r.show_results, r.show_summary,
              r.revealed_question_index, r.revealed_at, r.phone_seen_at, r.open_paper_at,
              r.phone_token, r.source_kind, r.source_id::text as source_id, es.code as exam_code,
              (r.phone_seen_at is not null and r.phone_seen_at > now() - interval '8 seconds') as phone_connected
       from public.answer_card_rounds r
       join public.classes c on c.id = r.class_id
       left join public.exam_sessions es on r.source_kind = 'exam' and es.id = r.source_id
       where r.id = $1::uuid and r.teacher_id = $2::uuid
       limit 1`,
      [roundId, teacherId]
    )
    if (!round) return null
    const [questionRows, pickRows, cards] = await Promise.all([
      pgQuery<{ question_index: number; prompt: string; choices: unknown; correct_choice: string }>(
        `select question_index, prompt, choices, correct_choice
         from public.answer_card_questions
         where round_id = $1::uuid
         order by question_index asc`,
        [roundId]
      ),
      pgQuery<{ question_index: number; user_id: string; choice: string }>(
        `select question_index, user_id::text, choice
         from public.answer_card_picks
         where round_id = $1::uuid`,
        [roundId]
      ),
      listClassAnswerCardsPg(round.class_id),
    ])
    const questions: ScanQuestion[] = []
    for (const row of questionRows) {
      const correct = asChoice(row.correct_choice)
      const choices = Array.isArray(row.choices) ? row.choices.map((item) => String(item ?? '')) : []
      if (!correct || choices.length < 2) continue
      questions.push({ prompt: row.prompt, choices, correct })
    }
    const picks: AnswerCardRoundView['picks'] = []
    for (const row of pickRows) {
      const choice = asChoice(row.choice)
      if (!choice) continue
      picks.push({ questionIndex: row.question_index, userId: row.user_id, choice })
    }
    let submittedUserIds: string[] = []
    let roster = (cards ?? []).map((card) => ({
      userId: card.userId,
      cardNo: card.cardNo,
      name: card.name,
      shortName: answerCardShortName(card.name),
    }))
    if (round.source_kind === 'exam' && round.source_id) {
      const merged = await loadMergedAnswerRows(round.class_id, round.source_id, questions)
      if (merged) {
        submittedUserIds = merged.submittedUserIds
        picks.splice(0, picks.length, ...picksFromMergedRows(merged.students))
        roster = merged.students.map((student) => ({
          userId: student.userId,
          cardNo: student.cardNo,
          name: student.name,
          shortName: student.shortName,
        }))
      }
    }
    const closed = round.status === 'closed'
    return {
      id: round.id,
      classId: round.class_id,
      className: String(round.class_name ?? ''),
      title: round.title,
      status: closed ? 'closed' : 'live',
      questionIndex: round.question_index,
      questionCount: round.question_count,
      showResults: closed ? true : round.show_results,
      showSummary: Boolean(round.show_summary),
      revealedQuestionIndex: Number.isInteger(Number(round.revealed_question_index))
        ? Number(round.revealed_question_index)
        : null,
      revealedAt: round.revealed_at ? new Date(round.revealed_at).toISOString() : null,
      phoneSeenAt: round.phone_seen_at ? new Date(round.phone_seen_at).toISOString() : null,
      openPaperAt: round.open_paper_at ? new Date(round.open_paper_at).toISOString() : null,
      examCode: round.exam_code ? String(round.exam_code) : null,
      phoneConnected: Boolean(round.phone_connected),
      phonePath: `/lop/quet-the/${round.phone_token}`,
      sourceKind: round.source_kind === 'exam' ? 'exam' : 'worksheet',
      questions,
      roster,
      picks,
      submittedUserIds,
      shots: await listAnswerCardShotsPg(round.id),
    }
  } catch (error) {
    throwSchema(error)
  }
}

export async function patchAnswerCardRoundPg(
  roundId: string,
  teacherId: string,
  action: 'show' | 'hide' | 'next' | 'prev' | 'end' | 'focus' | 'review',
  questionIndex?: number
): Promise<AnswerCardRoundView | null> {
  if (!isPgConfigured() || !UUID_RE.test(roundId)) return null
  try {
    if (action === 'focus' || action === 'review') {
      const index = Number.isInteger(questionIndex) ? Number(questionIndex) : -1
      if (index < 0) return null
      if (action === 'review') {
        await pgQuery(
          `update public.answer_card_rounds
           set revealed_question_index = least(greatest($3::int, 0), question_count - 1),
               revealed_at = now(),
               show_summary = false,
               show_results = true
           where id = $1::uuid and teacher_id = $2::uuid`,
          [roundId, teacherId, index]
        )
      } else {
        await pgQuery(
          `update public.answer_card_rounds
           set question_index = least(greatest($3::int, 0), question_count - 1),
               show_results = (status = 'closed')
           where id = $1::uuid and teacher_id = $2::uuid`,
          [roundId, teacherId, index]
        )
      }
    } else if (action === 'show') {
      await pgQuery(
        `update public.answer_card_rounds set show_results = true where id = $1::uuid and teacher_id = $2::uuid`,
        [roundId, teacherId]
      )
    } else if (action === 'hide') {
      await pgQuery(
        `update public.answer_card_rounds
         set show_results = false
         where id = $1::uuid and teacher_id = $2::uuid and status = 'live'`,
        [roundId, teacherId]
      )
    } else if (action === 'next' || action === 'prev') {
      await pgQuery(
        `update public.answer_card_rounds
         set question_index = least(
               greatest(question_index + $3, 0),
               question_count - 1
             ),
             show_results = false,
             show_summary = false
         where id = $1::uuid and teacher_id = $2::uuid`,
        [roundId, teacherId, action === 'next' ? 1 : -1]
      )
    } else if (action === 'end') {
      await pgQuery(
        `update public.answer_card_rounds
         set status = 'closed', show_results = true, closed_at = coalesce(closed_at, now())
         where id = $1::uuid and teacher_id = $2::uuid`,
        [roundId, teacherId]
      )
    }
    return loadAnswerCardRoundForTeacherPg(roundId, teacherId)
  } catch (error) {
    throwSchema(error)
  }
}

/** Điện thoại mở mã của một câu trên slide thì buổi quét nhảy tới câu đó. */
export async function focusAnswerCardByPhoneTokenPg(token: string, questionIndex: number): Promise<boolean> {
  if (!isPgConfigured() || !isAnswerCardPhoneToken(token) || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return false
  }
  try {
    const updated = await pgQuery<{ id: string }>(
      `update public.answer_card_rounds
       set question_index = least(greatest($2::int, 0), question_count - 1),
           show_results = (status = 'closed'),
           show_summary = false
       where phone_token = $1
       returning id::text`,
      [token, questionIndex]
    )
    return updated.length > 0
  } catch (error) {
    throwSchema(error)
  }
}

async function loadPhoneRound(token: string): Promise<{
  id: string
  classId: string
  schoolId: string | null
  className: string
  schoolName: string
  title: string
  subjectName: string
  status: 'live' | 'closed'
  questionIndex: number
  questionCount: number
  showSummary: boolean
} | null> {
  const row = await pgQueryOne<{
    id: string
    class_id: string
    school_id: string | null
    class_name: string | null
    school_name: string | null
    title: string
    subject_id: string | null
    status: string
    question_index: number
    question_count: number
    show_summary: boolean
  }>(
    `select r.id::text, r.class_id::text, c.school_id::text, c.name as class_name, sch.name as school_name,
            r.title, r.subject_id, r.status, r.question_index, r.question_count, r.show_summary
     from public.answer_card_rounds r
     join public.classes c on c.id = r.class_id
     left join public.schools sch on sch.id = c.school_id
     where r.phone_token = $1
     limit 1`,
    [token]
  )
  if (!row) return null
  return {
    id: row.id,
    classId: row.class_id,
    schoolId: row.school_id,
    className: String(row.class_name ?? ''),
    schoolName: String(row.school_name ?? ''),
    title: row.title,
    subjectName: await subjectNamePg(String(row.subject_id ?? '')),
    status: row.status === 'closed' ? 'closed' : 'live',
    questionIndex: row.question_index,
    questionCount: row.question_count,
    showSummary: Boolean(row.show_summary),
  }
}

async function listScanCardsPg(classId: string, schoolId: string | null): Promise<AnswerCardStudent[] | null> {
  const [students, rows] = await Promise.all([
    listClassStudents(classId),
    pgQuery<{ user_id: string; card_no: number; card_token: string }>(
      `select a.user_id::text, a.card_no, a.card_token
       from public.class_answer_cards a
       join public.classes c on c.id = a.class_id
       where c.id = $1::uuid
         and c.school_id is not distinct from $2::uuid`,
      [classId, schoolId]
    ),
  ])
  const byUser = new Map(rows.map((row) => [row.user_id, row]))
  return students.flatMap((student) => {
    const card = byUser.get(student.userId)
    if (!card || !answerCardSeatCode(card.card_no)) return []
    return [{ userId: student.userId, cardNo: card.card_no, name: student.name, token: card.card_token }]
  })
}

export async function loadAnswerCardPhoneViewPg(token: string): Promise<AnswerCardPhoneView | null> {
  if (!isPgConfigured()) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    await pgQuery(
      `update public.answer_card_rounds set phone_seen_at = now() where id = $1::uuid`,
      [round.id]
    )
    const [cards, savedRow] = await Promise.all([
      listScanCardsPg(round.classId, round.schoolId),
      pgQueryOne<{ n: number }>(
        `select count(*)::int as n
         from public.answer_card_picks
         where round_id = $1::uuid and question_index = $2`,
        [round.id, round.questionIndex]
      ),
    ])
    return {
      status: round.status,
      className: round.className,
      schoolName: round.schoolName,
      title: round.title,
      subjectName: round.subjectName,
      questionIndex: round.questionIndex,
      questionCount: round.questionCount,
      saved: savedRow?.n ?? 0,
      total: cards?.length ?? 0,
      showSummary: round.showSummary,
      summary: round.showSummary ? await loadAnswerCardClassSummaryPg(round.id) : null,
      roster: (cards ?? []).flatMap((card) => {
        const seat = answerCardSeatCode(card.cardNo)
        if (!seat) return []
        return [{ token: seat, cardNo: card.cardNo, shortName: answerCardShortName(card.name) }]
      }),
    }
  } catch (error) {
    throwSchema(error)
  }
}

async function loadAnswerCardClassSummaryPg(roundId: string): Promise<AnswerCardClassSummary | null> {
  const round = await pgQueryOne<{
    class_name: string | null
    title: string
    question_count: number
    class_id: string
    source_kind: string
    source_id: string | null
  }>(
    `select c.name as class_name, r.title, r.question_count, r.class_id::text,
            r.source_kind, r.source_id::text as source_id
     from public.answer_card_rounds r
     join public.classes c on c.id = r.class_id
     where r.id = $1::uuid
     limit 1`,
    [roundId]
  )
  if (!round) return null
  const [questions, picks, cards] = await Promise.all([
    pgQuery<{ question_index: number; prompt: string; choices: unknown; correct_choice: string }>(
      `select question_index, prompt, choices, correct_choice
       from public.answer_card_questions
       where round_id = $1::uuid
       order by question_index asc`,
      [roundId]
    ),
    pgQuery<{ question_index: number; user_id: string; choice: string }>(
      `select question_index, user_id::text, choice
       from public.answer_card_picks
       where round_id = $1::uuid`,
      [roundId]
    ),
    listClassAnswerCardsPg(round.class_id),
  ])
  const total = questions.length
  let studentRows = (cards ?? []).map((card) => {
    const choices = new Map<number, string>()
    for (const pick of picks) {
      if (pick.user_id !== card.userId) continue
      choices.set(pick.question_index, pick.choice)
    }
    const attempted = choices.size > 0
    const marks = questions.map((question) => {
      const choice = choices.get(question.question_index)
      if (!choice) return 'miss' as const
      return choice === question.correct_choice ? 'correct' as const : 'wrong' as const
    })
    return {
      cardNo: card.cardNo,
      name: card.name,
      marks,
      points: attempted ? marks.filter((mark) => mark === 'correct').length : 0,
      total,
      attempted,
    }
  })
  const targetQuestions: ScanQuestion[] = []
  for (const row of questions) {
    const correct = asChoice(row.correct_choice)
    const choices = parseChoiceList(row.choices)
    if (!correct || choices.length < 2) continue
    targetQuestions.push({ prompt: row.prompt, choices, correct })
  }
  if (round.source_kind === 'exam' && round.source_id && targetQuestions.length === questions.length) {
    const merged = await loadMergedAnswerRows(round.class_id, round.source_id, targetQuestions)
    if (merged) {
      studentRows = merged.students.map((student) => {
        const marks = questions.map((question, index) => {
          const choice = student.choices[question.question_index] ?? student.choices[index]
          if (!choice) return 'miss' as const
          return choice === question.correct_choice ? 'correct' as const : 'wrong' as const
        })
        return {
          cardNo: student.cardNo,
          name: student.name,
          marks,
          points: student.attempted ? marks.filter((mark) => mark === 'correct').length : 0,
          total,
          attempted: student.attempted,
        }
      })
    }
  }
  const students = studentRows.sort((a, b) => Number(b.attempted) - Number(a.attempted) || b.points - a.points || a.cardNo - b.cardNo)
  return {
    className: String(round.class_name ?? ''),
    title: round.title,
    questionCount: round.question_count,
    students,
  }
}

async function questionScorePg(roundId: string, questionIndex: number): Promise<{ correct: number; wrong: number }> {
  const rows = await pgQuery<{ choice: string | null; correct_choice: string }>(
    `select p.choice, q.correct_choice
     from public.answer_card_questions q
     left join public.answer_card_picks p
       on p.round_id = q.round_id and p.question_index = q.question_index
     where q.round_id = $1::uuid and q.question_index = $2`,
    [roundId, questionIndex]
  )
  let correct = 0
  let wrong = 0
  for (const row of rows) {
    if (!row.choice) continue
    if (row.choice === row.correct_choice) correct += 1
    else wrong += 1
  }
  return { correct, wrong }
}

export async function saveAnswerCardPicksPg(
  token: string,
  picks: Array<{ token: string; choice: AnswerChoice }>,
  questionIndex?: number,
  replace = false
): Promise<{ saved: number; total: number; changed: number; correct: number; wrong: number; status: 'live' | 'closed' } | 'closed' | null> {
  if (!isPgConfigured()) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    const cards = await listScanCardsPg(round.classId, round.schoolId)
    if (Number.isInteger(questionIndex) && questionIndex !== round.questionIndex) {
      return { saved: 0, total: cards?.length ?? 0, changed: 0, correct: 0, wrong: 0, status: 'live' }
    }
    const bySeat = new Map<string, string>()
    for (const card of cards ?? []) {
      const seat = answerCardSeatCode(card.cardNo)
      if (seat) bySeat.set(seat, card.userId)
    }
    const unique = new Map<string, AnswerChoice>()
    for (const pick of picks.slice(0, 99)) {
      const userId = bySeat.get(pick.token)
      if (!userId || !isAnswerChoice(pick.choice)) continue
      unique.set(userId, pick.choice)
    }
    const userIds = [...unique.keys()]
    let changed = 0
    if (replace && userIds.length > 0) {
      await pgQuery(
        `delete from public.answer_card_picks
         where round_id = $1::uuid and question_index = $2
           and not (user_id = any($3::uuid[]))`,
        [round.id, round.questionIndex, userIds]
      )
    }
    if (userIds.length > 0) {
      const previous = await pgQuery<{ user_id: string; choice: string }>(
        `select user_id::text, choice
         from public.answer_card_picks
         where round_id = $1::uuid and question_index = $2 and user_id = any($3::uuid[])`,
        [round.id, round.questionIndex, userIds]
      )
      const previousChoice = new Map(previous.map((row) => [row.user_id, row.choice]))
      for (const [userId, choice] of unique) {
        if (previousChoice.get(userId) !== choice) changed += 1
      }
      await pgQuery(
        `insert into public.answer_card_picks (round_id, question_index, user_id, choice)
         select $1::uuid, $2, t.user_id, t.choice
         from unnest($3::uuid[], $4::text[]) as t(user_id, choice)
         on conflict (round_id, question_index, user_id)
         do update set choice = excluded.choice, updated_at = now()`,
        [round.id, round.questionIndex, userIds, userIds.map((id) => unique.get(id))]
      )
    }
    const savedRow = await pgQueryOne<{ n: number }>(
      `select count(*)::int as n
       from public.answer_card_picks
       where round_id = $1::uuid and question_index = $2`,
      [round.id, round.questionIndex]
    )
    const saved = savedRow?.n ?? 0
    const total = cards?.length ?? 0
    const score = await questionScorePg(round.id, round.questionIndex)
    if (saved > 0) {
      await pgQuery(
        `update public.answer_card_rounds
         set phone_seen_at = now(),
             show_results = true,
             show_summary = false,
             revealed_question_index = $2,
             revealed_at = now()
         where id = $1::uuid`,
        [round.id, round.questionIndex]
      )
    } else {
      await pgQuery(
        `update public.answer_card_rounds
         set phone_seen_at = now()
         where id = $1::uuid`,
        [round.id]
      )
    }
    return {
      saved,
      total,
      changed,
      correct: score.correct,
      wrong: score.wrong,
      status: 'live',
    }
  } catch (error) {
    throwSchema(error)
  }
}

export async function revealAnswerCardQuestionPg(
  token: string,
  questionIndex: number,
  step: 'next' | 'stay'
): Promise<AnswerCardPhoneView | 'closed' | null> {
  if (!isPgConfigured() || !isAnswerCardPhoneToken(token)) return null
  if (!Number.isInteger(questionIndex) || questionIndex < 0) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    await pgQuery(
      `update public.answer_card_rounds
       set revealed_question_index = least(greatest($2::int, 0), question_count - 1),
           revealed_at = now(),
           show_results = true,
           show_summary = false,
           question_index = case
             when $3::boolean then least(question_index + 1, question_count - 1)
             else question_index
           end,
           phone_seen_at = now()
       where id = $1::uuid and status = 'live'`,
      [round.id, questionIndex, step === 'next']
    )
    return loadAnswerCardPhoneViewPg(token)
  } catch (error) {
    throwSchema(error)
  }
}

export async function stepAnswerCardPhonePg(
  token: string,
  action: 'next' | 'prev'
): Promise<AnswerCardPhoneView | 'closed' | null> {
  if (!isPgConfigured()) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    await pgQuery(
      `update public.answer_card_rounds
       set question_index = least(greatest(question_index + $2, 0), question_count - 1),
           show_summary = false,
           phone_seen_at = now()
       where id = $1::uuid and status = 'live'`,
      [round.id, action === 'next' ? 1 : -1]
    )
    return loadAnswerCardPhoneViewPg(token)
  } catch (error) {
    throwSchema(error)
  }
}

export async function publishAnswerCardSummaryPg(token: string): Promise<AnswerCardPhoneView | 'closed' | null> {
  if (!isPgConfigured() || !isAnswerCardPhoneToken(token)) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    await pgQuery(
      `update public.answer_card_rounds
       set show_summary = true, phone_seen_at = now()
       where id = $1::uuid and status = 'live'`,
      [round.id]
    )
    return loadAnswerCardPhoneViewPg(token)
  } catch (error) {
    throwSchema(error)
  }
}

export async function openAnswerCardPaperPg(token: string): Promise<AnswerCardPhoneView | 'closed' | null> {
  if (!isPgConfigured() || !isAnswerCardPhoneToken(token)) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    await pgQuery(
      `update public.answer_card_rounds
       set open_paper_at = now(), phone_seen_at = now()
       where id = $1::uuid and status = 'live'`,
      [round.id]
    )
    return loadAnswerCardPhoneViewPg(token)
  } catch (error) {
    throwSchema(error)
  }
}

export async function teacherMayScanClassPg(classId: string, teacherId: string): Promise<boolean | null> {
  return teacherCanTeachInClassPg(classId, teacherId)
}

async function subjectNamePg(subjectId: string): Promise<string> {
  const id = subjectId.trim()
  if (!id) return ''
  const known = classSubjectLabel(id, 'vi')
  if (known !== id) return known
  try {
    const row = await pgQueryOne<{ label: string | null }>(
      `select label from public.teaching_subjects where id = $1 limit 1`,
      [id]
    )
    return String(row?.label ?? '').trim() || id
  } catch {
    return id
  }
}

const SHOT_EXPIRED_SQL = `taken_at < now() - ($1::int * interval '1 day')`
let lastShotPurgeAt = 0

export async function purgeExpiredAnswerCardShotsPg(): Promise<number> {
  if (!isPgConfigured()) return 0
  const rows = await pgQuery<{ id: string }>(
    `delete from public.answer_card_shots
     where ${SHOT_EXPIRED_SQL}
     returning id::text`,
    [ANSWER_CARD_SHOT_RETENTION_DAYS]
  )
  return rows.length
}

function purgeExpiredAnswerCardShotsSoon() {
  const now = Date.now()
  if (now - lastShotPurgeAt < 15 * 60 * 1000) return
  lastShotPurgeAt = now
  void purgeExpiredAnswerCardShotsPg().catch((error) => {
    lastShotPurgeAt = 0
    console.error('[answer-card-shots] purge', error)
  })
}

function armLocalAnswerCardShotPurge() {
  if (process.env.NODE_ENV === 'production' || process.env.NANOAI_SHOP_CRON_WORKER === '1') return
  const holder = globalThis as typeof globalThis & { __answerCardShotPurge?: ReturnType<typeof setInterval> }
  if (holder.__answerCardShotPurge) return
  purgeExpiredAnswerCardShotsSoon()
  const timer = setInterval(() => purgeExpiredAnswerCardShotsSoon(), 60 * 60 * 1000)
  timer.unref?.()
  holder.__answerCardShotPurge = timer
}

async function listAnswerCardShotsPg(roundId: string): Promise<AnswerCardShot[]> {
  armLocalAnswerCardShotPurge()
  purgeExpiredAnswerCardShotsSoon()
  const rows = await pgQuery<{
    id: string
    question_index: number
    taken_at: Date | string
    exam_title: string
    subject_name: string
  }>(
    `select id::text, question_index, taken_at, exam_title, subject_name
     from public.answer_card_shots
     where round_id = $1::uuid
       and taken_at >= now() - ($2::int * interval '1 day')
     order by taken_at desc
     limit 80`,
    [roundId, ANSWER_CARD_SHOT_RETENTION_DAYS]
  )
  return rows.map((row) => ({
    id: row.id,
    questionIndex: row.question_index,
    takenAt: row.taken_at instanceof Date ? row.taken_at.toISOString() : String(row.taken_at),
    examTitle: row.exam_title,
    subjectName: row.subject_name,
  }))
}

export async function saveAnswerCardShotPg(
  token: string,
  image: Buffer,
  questionIndex?: number
): Promise<{ id: string; takenAt: string } | null> {
  if (!isPgConfigured() || !isAnswerCardPhoneToken(token)) return null
  if (image.length < 32 || image.length > 2_000_000 || image[0] !== 0xff || image[1] !== 0xd8) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    const index = Number.isInteger(questionIndex) ? Number(questionIndex) : round.questionIndex
    if (index < 0 || index >= round.questionCount) return null
    const inserted = await pgQueryOne<{ id: string; taken_at: Date | string }>(
      `insert into public.answer_card_shots (round_id, question_index, exam_title, subject_name, image)
       values ($1::uuid, $2, $3, $4, $5)
       returning id::text, taken_at`,
      [round.id, index, round.title.slice(0, 180), round.subjectName.slice(0, 120), image]
    )
    if (!inserted) return null
    await purgeExpiredAnswerCardShotsPg().catch((error) => {
      console.error('[answer-card-shots] purge', error)
    })
    await pgQuery(
      `delete from public.answer_card_shots
       where id in (
         select id from public.answer_card_shots
         where round_id = $1::uuid
         order by taken_at desc
         offset 80
       )`,
      [round.id]
    )
    return {
      id: inserted.id,
      takenAt: inserted.taken_at instanceof Date ? inserted.taken_at.toISOString() : String(inserted.taken_at),
    }
  } catch (error) {
    throwSchema(error)
  }
}

export async function findAnswerCardShotClassPg(roundId: string, shotId: string): Promise<string | null> {
  if (!isPgConfigured() || !UUID_RE.test(roundId) || !UUID_RE.test(shotId)) return null
  try {
    const row = await pgQueryOne<{ class_id: string }>(
      `select r.class_id::text
       from public.answer_card_shots s
       join public.answer_card_rounds r on r.id = s.round_id
       where s.id = $1::uuid and r.id = $2::uuid
         and s.taken_at >= now() - ($3::int * interval '1 day')
       limit 1`,
      [shotId, roundId, ANSWER_CARD_SHOT_RETENTION_DAYS]
    )
    return row?.class_id ?? null
  } catch (error) {
    throwSchema(error)
  }
}

export async function loadAnswerCardShotImagePg(
  roundId: string,
  teacherId: string,
  shotId: string
): Promise<{ classId: string; image: Buffer } | null> {
  if (!isPgConfigured() || !UUID_RE.test(roundId) || !UUID_RE.test(shotId)) return null
  try {
    const row = await pgQueryOne<{ class_id: string; image: Buffer | Uint8Array | string }>(
      `select r.class_id::text, s.image
       from public.answer_card_shots s
       join public.answer_card_rounds r on r.id = s.round_id
       where s.id = $1::uuid and r.id = $2::uuid and r.teacher_id = $3::uuid
         and s.taken_at >= now() - ($4::int * interval '1 day')
       limit 1`,
      [shotId, roundId, teacherId, ANSWER_CARD_SHOT_RETENTION_DAYS]
    )
    if (!row?.image) return null
    const image = Buffer.isBuffer(row.image) ? row.image : Buffer.from(row.image)
    return { classId: row.class_id, image }
  } catch (error) {
    throwSchema(error)
  }
}

export type ClassScoreboard = {
  className: string
  title: string
  questions: Array<{ correct: AnswerChoice; prompt: string; choices: string[] }>
  students: Array<{
    userId: string
    cardNo: number
    name: string
    attempted: boolean
    choices: Array<AnswerChoice | null>
    points: number
  }>
}

/** Bảng điểm một bài: nộp trên máy hoặc quét thẻ. Chưa có cả hai thì chưa làm. */
export async function loadClassScoreboardPg(
  classId: string,
  sessionId: string,
  teacherId: string,
): Promise<ClassScoreboard | null> {
  if (!isPgConfigured() || !UUID_RE.test(classId) || !UUID_RE.test(sessionId)) return null
  const allowed = await teacherCanTeachInClassPg(classId, teacherId)
  if (!allowed) return null
  const session = await pgQueryOne<{ title: string | null; class_name: string | null }>(
    `select s.title, c.name as class_name
     from public.exam_sessions s
     join public.classes c on c.id = s.class_id
     where s.id = $1::uuid and s.class_id = $2::uuid
     limit 1`,
    [sessionId, classId],
  )
  if (!session) return null
  const questionRows = await pgQuery<{ id: string; question_text: string | null; options: unknown; correct_index: unknown }>(
    `select id::text, question_text, options, correct_index
     from public.exam_questions
     where session_id = $1::uuid
     order by "order" asc`,
    [sessionId],
  )
  const questions = questionRows.flatMap((row) => {
    const question = scanQuestionFromParts(row.question_text, row.options, row.correct_index)
    return question ? [{ correct: question.correct, prompt: question.prompt, choices: question.choices }] : []
  })
  const merged = await loadMergedAnswerRows(classId, sessionId, questions)
  const students = (merged?.students ?? []).map((student) => ({
    userId: student.userId,
    cardNo: student.cardNo,
    name: student.name,
    attempted: student.attempted,
    choices: student.choices,
    points: student.attempted
      ? student.choices.filter((choice, index) => choice != null && choice === questions[index]?.correct).length
      : 0,
  }))
  return {
    className: String(session.class_name ?? ''),
    title: String(session.title ?? '').trim() || 'Bài',
    questions,
    students,
  }
}
