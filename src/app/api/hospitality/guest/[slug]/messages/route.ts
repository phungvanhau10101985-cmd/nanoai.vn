import { NextRequest } from 'next/server'
import {
  getHospitalityGuestThread,
  postHospitalityGuestThread,
} from '@/features/hospitality/guest-chat/hospitality-guest-thread'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  return getHospitalityGuestThread(request, slug)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  return postHospitalityGuestThread(request, slug)
}
