/** Câu trên ô gõ khác câu mô hình đang giữ thì đó là câu học sinh vừa viết lại. */
export function committedFieldText(domValue: string, composed: string): {
  replacedByKeyboard: boolean
  text: string
} {
  if (domValue && domValue !== composed) {
    return { replacedByKeyboard: true, text: domValue }
  }
  return { replacedByKeyboard: false, text: composed }
}

export function clampCaret(caret: number, length: number): number {
  if (!Number.isFinite(caret)) return length
  return Math.max(0, Math.min(length, Math.trunc(caret)))
}

/** Ghép chữ đang gõ dở vào đúng chỗ con trỏ, không phải lúc nào cũng ở cuối. */
export function composeAtCaret(base: string, composition: string, caret: number): string {
  const index = clampCaret(caret, base.length)
  return `${base.slice(0, index)}${composition}${base.slice(index)}`
}

export function spliceImeStep(
  base: string,
  caret: number,
  step: { commit: string; replace: number }
): { base: string; caret: number } {
  const index = clampCaret(caret, base.length)
  const start = Math.max(0, index - Math.max(0, step.replace))
  const nextBase = `${base.slice(0, start)}${step.commit}${base.slice(index)}`
  return { base: nextBase, caret: start + step.commit.length }
}

export type TextEdit = { at: number; removed: string; inserted: string }

export function textEdit(before: string, after: string): TextEdit {
  let start = 0
  const limit = Math.min(before.length, after.length)
  while (start < limit && before[start] === after[start]) start += 1
  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1
    afterEnd -= 1
  }
  return {
    at: start,
    removed: before.slice(start, beforeEnd),
    inserted: after.slice(start, afterEnd),
  }
}

export type ImeEditPlan =
  | { kind: 'noop' }
  | { kind: 'clear' }
  | { kind: 'feed-at'; caret: number; text: string }
  | { kind: 'feed'; text: string }
  | { kind: 'backspace'; times: number }
  | { kind: 'rebuild-composition'; text: string }
  | { kind: 'delete-range'; start: number; end: number }
  | { kind: 'replace-range'; start: number; end: number; inserted: string }
  | { kind: 'delete-committed'; start: number; end: number; caret: number }
  | { kind: 'commit-then-insert'; insertAt: number; afterAnchor: boolean; text: string }
  | { kind: 'raw'; text: string; caret: number }

/**
 * Khi chưa có chữ đang gõ dở, chỗ sửa lấy từ chính chuỗi mới (không tin con trỏ cũ).
 * Khi đang gõ dở, chữ mới nằm giữa phần đã chốt trái và phải thì nạp vào bộ gõ tại con trỏ.
 */
export function planImeEdit(args: { base: string; composition: string; caret: number; next: string }): ImeEditPlan {
  const caret = clampCaret(args.caret, args.base.length)
  const shown = composeAtCaret(args.base, args.composition, caret)
  if (args.next === shown) return { kind: 'noop' }
  if (!args.next) return { kind: 'clear' }

  if (!args.composition) {
    const edit = textEdit(args.base, args.next)
    if (!edit.removed && edit.inserted) return { kind: 'feed-at', caret: edit.at, text: edit.inserted }
    if (!edit.inserted) return { kind: 'delete-range', start: edit.at, end: edit.at + edit.removed.length }
    return { kind: 'replace-range', start: edit.at, end: edit.at + edit.removed.length, inserted: edit.inserted }
  }

  const left = args.base.slice(0, caret)
  const right = args.base.slice(caret)
  if (args.next.startsWith(left) && args.next.endsWith(right) && args.next.length >= left.length + right.length) {
    const middle = args.next.slice(left.length, args.next.length - right.length)
    if (middle === args.composition) return { kind: 'noop' }
    if (middle.startsWith(args.composition)) {
      const extra = middle.slice(args.composition.length)
      return extra ? { kind: 'feed', text: extra } : { kind: 'noop' }
    }
    if (args.composition.startsWith(middle)) {
      const times = args.composition.length - middle.length
      return times > 0 ? { kind: 'backspace', times } : { kind: 'noop' }
    }
    return { kind: 'rebuild-composition', text: middle }
  }

  const edit = textEdit(shown, args.next)
  const compStart = caret
  const compEnd = caret + args.composition.length
  const editEnd = edit.at + edit.removed.length
  const overlaps = edit.at < compEnd && editEnd > compStart
  if (!overlaps && !edit.inserted && edit.removed) {
    const baseAt = edit.at >= compEnd ? edit.at - args.composition.length : edit.at
    const removed = edit.removed.length
    return {
      kind: 'delete-committed',
      start: baseAt,
      end: baseAt + removed,
      caret: baseAt < caret ? Math.max(0, caret - removed) : caret,
    }
  }
  if (!overlaps && edit.inserted) {
    const insertAt = edit.at >= compEnd ? edit.at - args.composition.length : edit.at
    return { kind: 'commit-then-insert', insertAt, afterAnchor: edit.at >= compEnd, text: edit.inserted }
  }
  return { kind: 'raw', text: args.next, caret: args.next.length }
}
