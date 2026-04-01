import { spawn } from 'child_process'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import ffmpegStatic from 'ffmpeg-static'

function ffmpegPath(): string {
  const p = ffmpegStatic
  if (!p || typeof p !== 'string') {
    throw new Error('FFMPEG_NOT_AVAILABLE')
  }
  return p
}

/** Đường dẫn tuyệt đối tới từng MP4; thử `-c copy`, lỗi thì re-encode nhẹ. */
export async function concatMp4AbsolutePathsToFile(
  inputAbsolutePaths: string[],
  outputAbsolutePath: string
): Promise<void> {
  if (inputAbsolutePaths.length < 2) {
    throw new Error('Cần ít nhất 2 file MP4 để ghép.')
  }
  const ff = ffmpegPath()
  const workDir = await mkdtemp(join(tmpdir(), 'veo-concat-'))
  const listPath = join(workDir, 'concat-list.txt')
  const body = inputAbsolutePaths
    .map((p) => {
      const normalized = p.replace(/\\/g, '/')
      const escaped = normalized.replace(/'/g, `'\\''`)
      return `file '${escaped}'`
    })
    .join('\n')
  await writeFile(listPath, body, 'utf8')

  const run = (args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const proc = spawn(ff, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let err = ''
      proc.stderr?.on('data', (c) => {
        err += String(c)
      })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(err.trim().slice(-2000) || `ffmpeg exited with ${code}`))
      })
    })

  try {
    await run([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outputAbsolutePath,
    ])
  } catch {
    await run([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputAbsolutePath,
    ])
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
