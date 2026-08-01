export type DiffLine = {
  type: 'same' | 'add' | 'remove'
  text: string
  oldLineNo?: number
  newLineNo?: number
}

export type FileDiff = {
  path: string
  lines: DiffLine[]
  added: number
  removed: number
}

function lcsTable(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }
  return dp
}

export function diffLineArrays(oldLines: string[], newLines: string[]): DiffLine[] {
  const dp = lcsTable(oldLines, newLines)
  const stack: DiffLine[] = []
  let i = oldLines.length
  let j = newLines.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'same', text: oldLines[i - 1]!, oldLineNo: i, newLineNo: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: 'add', text: newLines[j - 1]!, newLineNo: j })
      j--
    } else if (i > 0) {
      stack.push({ type: 'remove', text: oldLines[i - 1]!, oldLineNo: i })
      i--
    }
  }

  return stack.reverse()
}

export function diffText(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) {
    return oldText.split('\n').map((text, idx) => ({
      type: 'same' as const,
      text,
      oldLineNo: idx + 1,
      newLineNo: idx + 1,
    }))
  }
  return diffLineArrays(oldText.split('\n'), newText.split('\n'))
}

export function buildFileDiff(path: string, before: string, after: string): FileDiff {
  const lines = diffText(before, after)
  return {
    path,
    lines,
    added: lines.filter((l) => l.type === 'add').length,
    removed: lines.filter((l) => l.type === 'remove').length,
  }
}

export function diffProjectByPath(
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>
): FileDiff[] {
  const paths = new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)])
  const diffs: FileDiff[] = []
  for (const path of paths) {
    const before = beforeFiles[path] ?? ''
    const after = afterFiles[path] ?? ''
    if (before === after) continue
    diffs.push(buildFileDiff(path, before, after))
  }
  return diffs.sort((a, b) => a.path.localeCompare(b.path))
}

export function formatDiffForDisplay(diff: FileDiff): string {
  return diff.lines
    .map((line) => {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
      const no =
        line.type === 'add'
          ? line.newLineNo
          : line.type === 'remove'
            ? line.oldLineNo
            : line.newLineNo ?? line.oldLineNo
      return `${prefix} ${String(no ?? '').padStart(4, ' ')} | ${line.text}`
    })
    .join('\n')
}
