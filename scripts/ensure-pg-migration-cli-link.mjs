/**
 * Một số CLI migration đọc cố định `supabase/migrations/`. Nguồn thật trong repo là `db/migrations/`.
 * Script tạo junction (Windows) hoặc symlink (Unix) để trùng đường dẫn kỳ vọng của CLI.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const canonical = path.join(root, 'db', 'migrations')
/** Thư mục tên cố định mà CLI tìm (không đổi được tên folder phía CLI). */
const cliLayoutDir = path.join(root, 'supabase')
const linkPath = path.join(cliLayoutDir, 'migrations')

function pathsEqual(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b)
  } catch {
    return false
  }
}

if (!fs.existsSync(canonical)) {
  console.warn('[ensure-pg-migration-cli-link] Bỏ qua: chưa có db/migrations')
  process.exit(0)
}

fs.mkdirSync(cliLayoutDir, { recursive: true })

if (fs.existsSync(linkPath)) {
  const stat = fs.lstatSync(linkPath)
  if (stat.isSymbolicLink() || (process.platform === 'win32' && stat.isDirectory())) {
    if (pathsEqual(linkPath, canonical)) {
      process.exit(0)
    }
  }
  fs.rmSync(linkPath, { recursive: true, force: true })
}

const rel = path.relative(path.dirname(linkPath), canonical)
if (process.platform === 'win32') {
  fs.symlinkSync(rel, linkPath, 'junction')
} else {
  fs.symlinkSync(rel, linkPath, 'dir')
}
