'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function createClass(formData: FormData) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const name = formData.get('name')?.toString()?.trim()
  if (!name) return { error: 'Vui lòng nhập tên lớp.' }

  let joinCode = generateJoinCode()
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('join_code', joinCode)
      .maybeSingle()
    if (!existing) break
    joinCode = generateJoinCode()
    attempts++
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: user.id, name, join_code: joinCode })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/lop')
  return { success: true, classId: data.id, joinCode }
}

export async function joinClass(joinCode: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const code = joinCode?.trim().toUpperCase()
  if (!code) return { error: 'Vui lòng nhập mã tham gia.' }

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id')
    .eq('join_code', code)
    .single()

  if (clsErr || !cls) return { error: 'Mã không hợp lệ.' }

  const { data: existing } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', cls.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'Bạn đã trong lớp này.' }

  const { error: insertErr } = await supabase
    .from('class_members')
    .insert({ class_id: cls.id, user_id: user.id })

  if (insertErr) return { error: insertErr.message }
  revalidatePath('/lop')
  revalidatePath(`/lop/${cls.id}`)
  return { success: true, classId: cls.id }
}

export async function assignWorksheetToClass(classId: string, worksheetId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .single()

  if (clsErr || !cls || cls.teacher_id !== result.user.id) return { error: 'Không có quyền.' }

  const { error } = await supabase.from('class_worksheets').upsert(
    { class_id: classId, worksheet_id: worksheetId },
    { onConflict: 'class_id,worksheet_id' }
  )
  if (error) return { error: error.message }
  revalidatePath(`/lop/${classId}`)
  return { success: true }
}

export async function removeWorksheetFromClass(classId: string, worksheetId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }

  const { data: cls } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== result.user.id) return { error: 'Không có quyền.' }

  const { error } = await supabase
    .from('class_worksheets')
    .delete()
    .eq('class_id', classId)
    .eq('worksheet_id', worksheetId)
  if (error) return { error: error.message }
  revalidatePath(`/lop/${classId}`)
  return { success: true }
}
