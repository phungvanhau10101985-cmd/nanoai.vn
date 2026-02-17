'use server'

import { createZipFromResults } from '@/app/dich-anh-tai-lieu/actions'
import { revalidatePath } from 'next/cache'

export async function createZipFromHistory(
  entries: Array<{ resultUrl: string; name: string }>
): Promise<{ zipUrl: string } | { error: string }> {
  const result = await createZipFromResults(entries)
  if (result && 'zipUrl' in result) {
    revalidatePath('/dashboard/history/translate')
  }
  return result
}
