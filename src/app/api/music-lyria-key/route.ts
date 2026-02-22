import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'

export async function GET() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
  }

  return NextResponse.json({ apiKey })
}

