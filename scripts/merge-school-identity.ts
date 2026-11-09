/**
 * Gom các trường cùng cấp và cùng tên riêng về một dòng.
 * Viết tắt và viết đủ (THPT / Trung học phổ thông) thành một school_id.
 *
 *   npx tsx scripts/merge-school-identity.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { mergeAllSchoolIdentities } from '../src/lib/db/schools-repo'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

mergeAllSchoolIdentities()
  .then((result) => {
    console.log(JSON.stringify(result))
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
