/**
 * Tách nền ảnh bằng rembg (Python).
 * Thử nhiều cách gọi: rembg, python -m rembg, py -m rembg (Windows).
 * Fallback ảnh Gemini gốc nếu rembg lỗi/không cài.
 *
 * Cài: pip install "rembg[cpu,cli]"
 * Env: REMBG_PYTHON=python|py|python3 để override
 */
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const REMBG_TIMEOUT = 120_000 // 2 phút cho ảnh 4K

/**
 * Tách nền bằng rembg. Fallback ảnh gốc nếu rembg lỗi/không cài.
 */
export async function stripBackground(inputBuffer: Buffer): Promise<Buffer> {
  const useRembg = process.env.STICKER_USE_REMBG !== 'false'

  if (useRembg) {
    try {
      const result = await runRembg(inputBuffer)
      if (result && result.length > 0) return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[remove-background] rembg lỗi, dùng ảnh gốc:', msg)
    }
  }

  return inputBuffer
}

function runRembg(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const id = `rembg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const inputPath = path.join(tmpDir, `${id}_in.png`)
  const outputPath = path.join(tmpDir, `${id}_out.png`)

  const attempts: { cmd: string; args: string[] }[] = []

  // rembg 2.x: CLI ở rembg.cli (không còn rembg.__main__)
  const rembgModule = 'rembg.cli'
  const override = process.env.REMBG_PYTHON
  if (override) {
    attempts.push({ cmd: override, args: ['-m', rembgModule, 'i', inputPath, outputPath] })
  } else {
    attempts.push({ cmd: 'rembg', args: ['i', inputPath, outputPath] })
    attempts.push({ cmd: 'python', args: ['-m', rembgModule, 'i', inputPath, outputPath] })
    if (process.platform === 'win32') {
      attempts.push({ cmd: 'py', args: ['-m', rembgModule, 'i', inputPath, outputPath] })
    }
    attempts.push({ cmd: 'python3', args: ['-m', rembgModule, 'i', inputPath, outputPath] })
  }

  return (async () => {
    await fs.writeFile(inputPath, inputBuffer)
    let lastError: Error | null = null

    for (const { cmd, args } of attempts) {
      try {
        const result = await runWithCmd(cmd, args, outputPath)
        return result
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
      }
    }

    throw lastError || new Error('rembg failed')
  })().finally(() => {
    fs.unlink(inputPath).catch(() => {})
    fs.unlink(outputPath).catch(() => {})
  })
}

function runWithCmd(cmd: string, args: string[], outputPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // Tránh DEP0190: không dùng shell=true với args tách rời.
      shell: false,
    })

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`rembg timeout (${REMBG_TIMEOUT / 1000}s)`))
    }, REMBG_TIMEOUT)

    let stderr = ''
    proc.stderr?.on('data', (c) => { stderr += c.toString() })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`${cmd} spawn error: ${err.message}`))
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        waitForOutputFile(outputPath)
          .then(() => fs.readFile(outputPath))
          .then(resolve)
          .catch((e) => reject(new Error(`read output: ${e instanceof Error ? e.message : e}`)))
      } else {
        reject(new Error(stderr.trim() || `rembg exited ${code}`))
      }
    })
  })
}

async function waitForOutputFile(outputPath: string): Promise<void> {
  const timeoutMs = 2000
  const intervalMs = 100
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const stat = await fs.stat(outputPath)
      if (stat.size > 0) return
    } catch {
      // rembg có thể trả code 0 trước khi flush file; thử lại vài lần ngắn.
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
