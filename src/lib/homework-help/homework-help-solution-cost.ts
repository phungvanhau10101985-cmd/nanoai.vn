/** Ma sát mở bài giải. Cùng học sinh, cùng câu, cùng ngôn ngữ chỉ trừ một lần. */
export const HOMEWORK_SOLUTION_CREDIT_COST = 1

export const HOMEWORK_SOLUTION_CHARGE_TYPE = 'homework_help_solution'

export function homeworkSolutionEventKey(userId: string, locale: string, fingerprint: string): string {
  return `homework-solution:${userId}:${locale}:${fingerprint}`
}
