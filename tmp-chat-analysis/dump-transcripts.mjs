import { readFileSync, writeFileSync } from 'node:fs'

const csvPath = process.argv[2]
const outPath = process.argv[3]
const raw = readFileSync(csvPath, 'utf8')

function parseCsv(text) {
  const rows = []
  let i = 0
  const n = text.length
  const row = []
  let field = ''
  let inQuotes = false
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push([...row])
      row.length = 0
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows[0]
  return rows.slice(1).filter((r) => r[0]).map((r) => {
    const o = {}
    for (let k = 0; k < header.length; k++) o[header[k]] = r[k] ?? ''
    return o
  })
}

const rows = parseCsv(raw).sort((a, b) => String(a.inbound_at).localeCompare(String(b.inbound_at)))
const byConv = new Map()
for (const r of rows) {
  if (!byConv.has(r.conversation_id)) byConv.set(r.conversation_id, [])
  byConv.get(r.conversation_id).push(r)
}

let md = `# Chat transcripts 4 days (${rows.length} inbound pairs, ${byConv.size} convs)\n\n`
for (const [cid, arr] of byConv) {
  const h = arr[0]
  md += `\n## ${h.inbound_at.slice(0, 10)} · ${h.customer_name} · ${h.slug} · ${cid.slice(0, 8)}\n`
  for (const r of arr) {
    md += `\n- **${r.inbound_at} KH:** ${r.inbound_body}`
    if (r.has_image === 't') md += ' `[ảnh]`'
    if (r.page_sku) md += ` (sku ${r.page_sku})`
    md += `\n- **${r.outbound_at || '—'} ${r.human_reply === 't' ? 'NGƯỜI' : 'AI'}** (${r.route_intent || '-'} / ${r.pipeline_branch || '-'} / cards=${r.card_count}): ${r.outbound_body || '(không trả lời 20p)'}`
    if (r.card_names) md += `\n  - thẻ: ${r.card_names}`
  }
  md += '\n'
}
writeFileSync(outPath, md, 'utf8')
console.log('convs', byConv.size, 'pairs', rows.length, 'wrote', outPath)
