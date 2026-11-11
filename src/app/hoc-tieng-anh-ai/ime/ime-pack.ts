// Dictionary text stays in public/ime so the production compile never parses it as JavaScript.
export async function loadImePack(fileName: string): Promise<string> {
  if (typeof window === 'undefined') {
    const { readFile } = await import(/* webpackIgnore: true */ 'node:fs/promises')
    const { join } = await import(/* webpackIgnore: true */ 'node:path')
    return readFile(join(process.cwd(), 'public', 'ime', fileName), 'utf8')
  }
  const response = await fetch(`/ime/${fileName}`)
  if (!response.ok) throw new Error(`Missing /ime/${fileName}`)
  return response.text()
}
