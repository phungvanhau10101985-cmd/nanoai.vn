export type PartnerInventoryEmbeddingErrorExportRow = {
  id: string
  sku: string | null
  name: string
  imageUrl: string
  imageError: string | null
  imageErrorAt: string | null
  textError: string | null
  textErrorAt: string | null
}

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildPartnerInventoryEmbeddingErrorsCsvString(
  rows: PartnerInventoryEmbeddingErrorExportRow[],
  headers: {
    sku: string
    name: string
    id: string
    imageUrl: string
    imageError: string
    imageErrorAt: string
    textError: string
    textErrorAt: string
  }
): string {
  const headerLine = [
    headers.sku,
    headers.name,
    headers.id,
    headers.imageUrl,
    headers.imageError,
    headers.imageErrorAt,
    headers.textError,
    headers.textErrorAt,
  ]
    .map((h) => csvEscapeCell(h))
    .join(',')

  const body = rows
    .map((row) =>
      [
        row.sku ?? '',
        row.name,
        row.id,
        row.imageUrl,
        row.imageError ?? '',
        row.imageErrorAt ?? '',
        row.textError ?? '',
        row.textErrorAt ?? '',
      ]
        .map((cell) => csvEscapeCell(String(cell)))
        .join(',')
    )
    .join('\n')

  return `\uFEFF${headerLine}\n${body}`
}
