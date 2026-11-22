import { randomBytes } from 'node:crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { teacherCanTeachInClassPg } from '@/lib/db/classes-pg'
import {
  answerCardSeatCode,
  answerCardShortName,
  isAnswerChoice,
  scanQuestionFromParts,
  scanQuestionFromWorksheetContent,
  type AnswerChoice,
  type ScanQuestion,
} from '@/lib/lop/answer-card'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  phoneConnected: boolean
  phonePath: string
  sourceKind: 'exam' | 'worksheet'
  questions: ScanQuestion[]
  roster: AnswerCardRosterEntry[]
  picks: Array<{ questionIndex: number; userId: string; choice: AnswerChoice }>
}

export type AnswerCardPhoneView = {
  status: 'live' | 'closed'
  className: string
  schoolName: string
  title: string
  questionIndex: number
  questionCount: number
  saved: number
  total: number
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
      title: string | null
      is_practice_homework: boolean | null
      subject_id: string | null
      question_text: string | null
      options: unknown
      correct_index: unknown
      ord: number | null
    }>(
      `with sessions as (
         select id, title, is_practice_homework, subject_id, created_at
         from public.exam_sessions
         where class_id = $1::uuid
           and teacher_id = $2::uuid
           and ($3::text is null or subject_id = $3)
         order by created_at desc
         limit 40
       )
       select s.id::text as session_id, s.title, s.is_practice_homework, s.subject_id,
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

async function reuseLiveRound(
  classId: string,
  teacherId: string,
  sourceKind: 'exam' | 'worksheet',
  sourceId: string,
  firstPrompt: string | null,
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
  const first = await pgQueryOne<{ prompt: string; n: string }>(
    `select q.prompt,
            (select count(*) from public.answer_card_questions c where c.round_id = $1::uuid)::text as n
     from public.answer_card_questions q
     where q.round_id = $1::uuid and q.question_index = 0`,
    [existing.id]
  )
  const samePaper = Number(first?.n ?? 0) === expectedCount
    && (firstPrompt == null || (first?.prompt ?? '') === firstPrompt)
  if (!samePaper) {
    await pgQuery(
      `update public.answer_card_rounds
       set status = 'closed', closed_at = timezone('utc'::text, now())
       where id = $1::uuid and status = 'live'`,
      [existing.id]
    )
    return null
  }
  return loadAnswerCardRoundForTeacherPg(existing.id, teacherId)
}

export async function createAnswerCardRoundPg(input: {
  classId: string
  teacherId: string
  sourceKind: 'exam' | 'worksheet'
  sourceId: string
  questions?: ScanQuestion[]
}): Promise<AnswerCardRoundView | 'no_mcq' | 'not_found' | null> {
  if (!isPgConfigured()) return null
  if (!UUID_RE.test(input.classId) || !UUID_RE.test(input.sourceId)) return 'not_found'
  const inline = (input.questions ?? []).slice(0, 40)
  const loaded = inline.length > 0
    ? {
        title: inline[0]?.prompt.slice(0, 80) || 'Trắc nghiệm',
        subjectId: '',
        questions: inline,
      }
    : input.sourceKind === 'exam'
      ? await loadExamQuestions(input.classId, input.teacherId, input.sourceId)
      : await loadWorksheetQuestions(input.classId, input.sourceId)
  if (!loaded) return 'not_found'
  if (loaded.questions.length === 0) return 'no_mcq'
  const reused = await reuseLiveRound(
    input.classId,
    input.teacherId,
    input.sourceKind,
    input.sourceId,
    inline.length > 0 ? (loaded.questions[0]?.prompt ?? '') : null,
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
      phone_token: string
      phone_connected: boolean
      source_kind: string
    }>(
      `select r.id::text, r.class_id::text, c.name as class_name, r.title, r.status,
              r.question_index, r.question_count, r.show_results, r.phone_token, r.source_kind,
              (r.phone_seen_at is not null and r.phone_seen_at > now() - interval '8 seconds') as phone_connected
       from public.answer_card_rounds r
       join public.classes c on c.id = r.class_id
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
    const roster = (cards ?? []).map((card) => ({
      userId: card.userId,
      cardNo: card.cardNo,
      name: card.name,
      shortName: answerCardShortName(card.name),
    }))
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
      phoneConnected: Boolean(round.phone_connected),
      phonePath: `/lop/quet-the/${round.phone_token}`,
      sourceKind: round.source_kind === 'exam' ? 'exam' : 'worksheet',
      questions,
      roster,
      picks,
    }
  } catch (error) {
    throwSchema(error)
  }
}

export async function patchAnswerCardRoundPg(
  roundId: string,
  teacherId: string,
  action: 'show' | 'hide' | 'next' | 'prev' | 'end' | 'focus',
  questionIndex?: number
): Promise<AnswerCardRoundView | null> {
  if (!isPgConfigured() || !UUID_RE.test(roundId)) return null
  try {
    if (action === 'focus') {
      const index = Number.isInteger(questionIndex) ? Number(questionIndex) : -1
      if (index < 0) return null
      await pgQuery(
        `update public.answer_card_rounds
         set question_index = least(greatest($3::int, 0), question_count - 1),
             show_results = (status = 'closed')
         where id = $1::uuid and teacher_id = $2::uuid`,
        [roundId, teacherId, index]
      )
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
             show_results = false
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

async function loadPhoneRound(token: string): Promise<{
  id: string
  classId: string
  schoolId: string | null
  className: string
  schoolName: string
  title: string
  status: 'live' | 'closed'
  questionIndex: number
  questionCount: number
} | null> {
  const row = await pgQueryOne<{
    id: string
    class_id: string
    school_id: string | null
    class_name: string | null
    school_name: string | null
    title: string
    status: string
    question_index: number
    question_count: number
  }>(
    `select r.id::text, r.class_id::text, c.school_id::text, c.name as class_name, sch.name as school_name,
            r.title, r.status, r.question_index, r.question_count
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
    status: row.status === 'closed' ? 'closed' : 'live',
    questionIndex: row.question_index,
    questionCount: row.question_count,
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
      questionIndex: round.questionIndex,
      questionCount: round.questionCount,
      saved: savedRow?.n ?? 0,
      total: cards?.length ?? 0,
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

export async function saveAnswerCardPicksPg(
  token: string,
  picks: Array<{ token: string; choice: AnswerChoice }>,
  questionIndex?: number
): Promise<{ saved: number; total: number; changed: number; status: 'live' | 'closed' } | 'closed' | null> {
  if (!isPgConfigured()) return null
  try {
    const round = await loadPhoneRound(token)
    if (!round) return null
    if (round.status === 'closed') return 'closed'
    const cards = await listScanCardsPg(round.classId, round.schoolId)
    if (Number.isInteger(questionIndex) && questionIndex !== round.questionIndex) {
      return { saved: 0, total: cards?.length ?? 0, changed: 0, status: 'live' }
    }
    const bySeat = new Map<string, string>()
    for (const card of cards ?? []) {
      const seat = answerCardSeatCode(card.cardNo)
      if (seat) bySeat.set(seat, card.userId)
    }
    const unique = new Map<string, AnswerChoice>()
    for (const pick of picks.slice(0, 40)) {
      const userId = bySeat.get(pick.token)
      if (!userId || !isAnswerChoice(pick.choice)) continue
      unique.set(userId, pick.choice)
    }
    const userIds = [...unique.keys()]
    let changed = 0
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
    const complete = total > 0 && saved >= total
    await pgQuery(
      `update public.answer_card_rounds
       set phone_seen_at = now(),
           show_results = case when $2::boolean then true else show_results end
       where id = $1::uuid`,
      [round.id, complete]
    )
    return {
      saved,
      total,
      changed,
      status: 'live',
    }
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
           show_results = false,
           phone_seen_at = now()
       where id = $1::uuid and status = 'live'`,
      [round.id, action === 'next' ? 1 : -1]
    )
    return loadAnswerCardPhoneViewPg(token)
  } catch (error) {
    throwSchema(error)
  }
}

export async function teacherMayScanClassPg(classId: string, teacherId: string): Promise<boolean | null> {
  return teacherCanTeachInClassPg(classId, teacherId)
}
