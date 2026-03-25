/** Replace `{key}` placeholders in a dictionary template string. */
export function fillI18nTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}
