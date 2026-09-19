import { NextResponse } from 'next/server'
import { buildStandardTaxonomyTemplateBytes } from '@/lib/partner-website/category/partner-category-taxonomy-import'
import { requireTaxonomyPartner } from '../_shared'

export async function GET(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  // 188 `?blank_template=true` bỏ dump đầy đủ. SaaS không gắn dump một shop —
  // cả hai URL trả cùng mẫu 4 sheet (đủ cột + vài dòng ví dụ).
  const _blank = new URL(req.url).searchParams.get('blank_template')
  void _blank
  const buf = buildStandardTaxonomyTemplateBytes()
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="taxonomy_import.xlsx"',
    },
  })
}
