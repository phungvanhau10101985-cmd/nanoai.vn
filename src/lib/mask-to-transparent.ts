import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const PY_TIMEOUT_MS = 90_000

export async function buildTransparentPngFromMask(
  originalBuffer: Buffer,
  maskBuffer: Buffer
): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const id = `mask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const inputPath = path.join(tmpDir, `${id}_input.png`)
  const maskPath = path.join(tmpDir, `${id}_mask.png`)
  const outputPath = path.join(tmpDir, `${id}_out.png`)

  await fs.writeFile(inputPath, originalBuffer)
  await fs.writeFile(maskPath, maskBuffer)

  const pythonCode = [
    'from PIL import Image, ImageOps, ImageFilter',
    'import sys',
    'inp, msk, out = sys.argv[1], sys.argv[2], sys.argv[3]',
    "img = Image.open(inp).convert('RGBA')",
    "mask = Image.open(msk).convert('L')",
    'if mask.size != img.size:',
    '    mask = mask.resize(img.size, Image.Resampling.LANCZOS)',
    '# Normalize mask: foreground should be white.',
    'mask = ImageOps.autocontrast(mask)',
    'mask = mask.filter(ImageFilter.GaussianBlur(radius=0.8))',
    'img.putalpha(mask)',
    "img.save(out, format='PNG')",
  ].join('; ')

  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: process.env.MASK_PYTHON || 'python', args: ['-c', pythonCode, inputPath, maskPath, outputPath] },
    { cmd: 'python3', args: ['-c', pythonCode, inputPath, maskPath, outputPath] },
  ]
  if (process.platform === 'win32') {
    attempts.push({ cmd: 'py', args: ['-c', pythonCode, inputPath, maskPath, outputPath] })
  }

  try {
    let lastErr: Error | null = null
    for (const attempt of attempts) {
      try {
        await runPython(attempt.cmd, attempt.args)
        return await fs.readFile(outputPath)
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
      }
    }
    throw lastErr || new Error('Python masking failed')
  } finally {
    fs.unlink(inputPath).catch(() => {})
    fs.unlink(maskPath).catch(() => {})
    fs.unlink(outputPath).catch(() => {})
  }
}

function runPython(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false })
    let stderr = ''
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Python timeout (${PY_TIMEOUT_MS / 1000}s)`))
    }, PY_TIMEOUT_MS)

    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`${cmd} spawn error: ${err.message}`))
    })
    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${cmd} exited ${code}`))
    })
  })
}
