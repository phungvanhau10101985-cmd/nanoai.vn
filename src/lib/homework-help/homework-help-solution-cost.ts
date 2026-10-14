/** Ngoài gói học sinh. Cùng học sinh, cùng câu, chỉ trừ một lần. */
export const HOMEWORK_SOLUTION_CREDIT_COST = 0.5

export const HOMEWORK_SOLUTION_CHARGE_TYPE = 'homework_help_solution'

export function homeworkSolutionEventKey(userId: string, locale: string, fingerprint: string): string {
  return `homework-solution:${userId}:${locale}:${fingerprint}`
}
