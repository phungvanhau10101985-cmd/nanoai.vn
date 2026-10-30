/**
 * Tạo 5 ảnh mẫu cho một nền thiệp: ảnh chung đầu thiệp, chân dung hai bên, 2 ảnh album.
 * Chạy: node scripts/generate-wedding-sample-photos.mjs toi-gian-nau
 * Model: gpt-image-2, quality medium. Không in khóa API.
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Real photograph, natural daylight, visible linen or silk weave and natural skin texture, shot on a full-frame camera at 85mm. Place the people in the vertical center of the frame, with a small even margin above the hair and below the body. Do not leave a large empty band above the heads or below the waist. No text, no letters, no watermark, no logo, no border, no frame. Not a cartoon, not an illustration, not watercolor, not a pencil sketch, not a vector, not anime, not CGI, not plastic skin, not a flat icon, not clipart.'

const THEMES = {
  'toi-gian-nau': {
    couple:
      'The groom is a Vietnamese man about 30 with short neat black hair, wearing a tailored warm-ivory suit jacket and a crisp white dress shirt, no tie, formal wedding attire. The bride is a Vietnamese woman about 28 with dark hair in a low soft bun, wearing a real white silk bridal wedding gown with a fitted bodice and a modest neckline, tiny pearl studs. It is a wedding dress, not a slip, not a cocktail dress, not a camisole. Color grade is tone-on-tone with the card: warm ivory, cream, beige and taupe. Soft cream wall, a hint of dried beige grass. No pink, no red gown, no gold foil.',
    shots: {
      cover: {
        size: '1024x1536',
        prompt:
          'Waist-up portrait of the couple standing close, calm smiles, looking at the camera. Her white bridal gown bodice is clearly visible. His white shirt and ivory suit jacket are clearly visible. Shallow depth of field. This photo sits at the top of a minimal beige wedding card.',
      },
      groom: {
        size: '1024x1536',
        prompt:
          'The same man from the reference, alone, waist-up portrait, facing the camera. Same face and hair. Tailored warm-ivory suit jacket and a crisp white dress shirt. Blurred cream wall. No other person.',
      },
      bride: {
        size: '1024x1536',
        prompt:
          'The same woman from the reference, alone, waist-up portrait, facing the camera. Same face and low bun. A real white silk bridal wedding gown, fitted bodice, modest neckline, pearl studs. Not a slip dress. Blurred cream wall. No other person.',
      },
      'album-1': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, walking slowly side by side in a bright cream room, holding hands, looking at each other. She wears the same white bridal wedding gown. He wears the same ivory suit jacket and white dress shirt. Dried beige botanicals in the soft background. Wide photograph for a wedding album.',
      },
      'album-2': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, seated close on a cream linen sofa, her head near his shoulder, a quiet smile. She wears the same white bridal wedding gown. He wears the same ivory suit jacket and white dress shirt. Warm ivory color grade. Wide photograph for a wedding album.',
      },
    },
  },
  'vuon-kinh-hong': {
    couple:
      'The groom is a Vietnamese man about 30 with short neat black hair, wearing a tailored pale blush-ivory suit jacket and a crisp white dress shirt, no tie, a single pale pink rose boutonniere, formal wedding attire. The bride is a Vietnamese woman about 28 with dark hair in a soft low twist, wearing a real white silk bridal wedding gown with a fitted bodice and a modest neckline, tiny pearl studs, a small pale pink garden rose by her ear. It is a white wedding dress, not a blush slip, not a cocktail dress. Color grade is tone-on-tone with a pink glass garden: white gown, blush, cream and soft sage. Soft daylight through glass, pale pink roses out of focus. No red gown, no gold foil.',
    shots: {
      cover: {
        size: '1024x1536',
        prompt:
          'Waist-up portrait of the couple standing close in a glass garden, calm smiles, looking at the camera. Her white bridal gown bodice is clearly visible. His white shirt and pale suit jacket are clearly visible. Pale pink roses behind them. This photo sits at the top of a blush wedding card.',
      },
      groom: {
        size: '1024x1536',
        prompt:
          'The same man from the reference, alone, waist-up portrait, facing the camera. Same face and hair. Pale blush-ivory suit jacket, crisp white dress shirt, pale pink boutonniere. Blurred glass garden. No other person.',
      },
      bride: {
        size: '1024x1536',
        prompt:
          'The same woman from the reference, alone, waist-up portrait, facing the camera. Same face and low twist. A real white silk bridal wedding gown, fitted bodice, modest neckline, pearl studs and a small pale pink rose. Not a slip dress. Blurred glass garden. No other person.',
      },
      'album-1': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, walking slowly side by side through a glass garden, holding hands, looking at each other. She wears the same white bridal wedding gown. He wears the same pale suit jacket and white dress shirt. Pale pink roses and green leaves. Wide photograph for a wedding album.',
      },
      'album-2': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, seated close on a cream bench among pale pink roses, her head near his shoulder, a quiet smile. She wears the same white bridal wedding gown. He wears the same pale suit jacket and white dress shirt. Wide photograph for a wedding album.',
      },
    },
  },
  'long-phung-do': {
    couple:
      'The groom is a Vietnamese man about 30 with short neat black hair, wearing a tailored charcoal suit jacket and a crisp white dress shirt, no tie, formal wedding attire. The bride is a Vietnamese woman about 28 with dark hair in a low elegant bun, wearing a real red silk bridal wedding gown with a fitted bodice, a modest neckline and a little gold thread at the waist. It is a red wedding dress, not a slip, not a cocktail dress, not a costume. Color grade is tone-on-tone with a red lacquer dragon-and-phoenix wedding card: deep red, warm gold light, charcoal and white. Soft red lacquer wall. No letters, no double-happiness mark, no painted dragon, no illustration.',
    shots: {
      cover: {
        size: '1024x1536',
        prompt:
          'Waist-up portrait of the couple standing close, calm smiles, looking at the camera. Her red silk bridal gown is clearly visible. His charcoal suit jacket and white dress shirt are clearly visible. The couple sits in the vertical center, with only a small margin of wall above the hair. This photo sits at the top of a deep red wedding card.',
      },
      groom: {
        size: '1024x1536',
        prompt:
          'The same man from the reference, alone, waist-up portrait, facing the camera. Same face and hair. Charcoal suit jacket and a crisp white dress shirt. He sits in the vertical center, with only a small margin above his hair. Blurred red lacquer wall. No other person.',
      },
      bride: {
        size: '1024x1536',
        prompt:
          'Delete the man from the reference. Keep only the woman, alone and centered, waist-up, facing the camera. Same face and low bun. A real red silk bridal wedding gown, fitted bodice, modest neckline, a little gold thread. She sits in the vertical center, with only a small margin above her hair. Not a slip dress. The man must not appear. Blurred red lacquer wall.',
      },
      'album-1': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, walking slowly side by side in a deep red lacquer hall, holding hands, looking at each other. She wears the same red silk bridal wedding gown. He wears the same charcoal suit jacket and white dress shirt. Warm gold light. Wide photograph for a wedding album.',
      },
      'album-2': {
        size: '1536x1024',
        prompt:
          'The same couple from the reference, seated close on a dark wood bench against a red lacquer wall, her head near his shoulder, a quiet smile. She wears the same red silk bridal wedding gown. He wears the same charcoal suit jacket and white dress shirt. Wide photograph for a wedding album.',
      },
    },
  },
}

function themeOf(spec) {
  const gown = spec.red
    ? 'a real red silk bridal wedding gown with a fitted bodice, a modest neckline and a little gold thread. It is a red wedding dress, not a slip, not a cocktail dress, not a costume'
    : 'a real white silk bridal wedding gown with a fitted bodice and a modest neckline, tiny pearl studs. It is a white wedding dress, not a slip, not a cocktail dress'
  const suit = `${spec.suit} and a crisp white dress shirt, no tie`
  return {
    couple: `The groom is a Vietnamese man about 30 with short neat black hair, wearing ${suit}, formal wedding attire. The bride is a Vietnamese woman about 28 with dark hair in a low elegant bun, wearing ${gown}. ${spec.scene} Leave clear space above their hair. No letters, no double-happiness mark, no painted dragon, no illustration.`,
    shots: {
      cover: {
        size: '1024x1536',
        prompt: `Waist-up portrait of the couple standing close, calm smiles, looking at the camera. Her bridal gown and his suit jacket and white shirt are clearly visible. Space above their hair. ${spec.place}`,
      },
      groom: {
        size: '1024x1536',
        prompt: `The same man from the reference, alone, waist-up portrait, facing the camera. Same face and hair. ${suit}. Space above his hair. No other person. ${spec.place}`,
      },
      bride: {
        size: '1024x1536',
        prompt: `Delete every man from the reference. Only the woman remains, alone and centered, waist-up, facing the camera. Same face and low bun. The same bridal gown. Space above her hair. The man must not appear anywhere. ${spec.place}`,
      },
      'album-1': {
        size: '1536x1024',
        prompt: `The same couple from the reference, walking slowly side by side, holding hands, looking at each other. Same clothes. ${spec.walk}`,
      },
      'album-2': {
        size: '1536x1024',
        prompt: `The same couple from the reference, seated close, her head near his shoulder, a quiet smile. Same clothes. ${spec.seat}`,
      },
    },
  }
}

Object.assign(THEMES, {
  'do-son': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is scarlet and warm gold, tone-on-tone with a scarlet Vietnamese wedding card.',
    place: 'Soft scarlet lacquer wall, a hint of gold lattice far behind, no text.',
    walk: 'They walk through a scarlet corridor with gold lattice screens. Wide wedding album photograph.',
    seat: 'They sit on a dark wood bench against a scarlet wall. Wide wedding album photograph.',
  }),
  'song-hy-do': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is deep red and warm gold, tone-on-tone with a double-happiness wedding card. Do not draw any character or seal.',
    place: 'Deep red silk backdrop and warm gold light. No letters, no seal, no symbol.',
    walk: 'They walk in a red and gold hall with silk drapes. No letters. Wide wedding album photograph.',
    seat: 'They sit close against deep red silk. No letters. Wide wedding album photograph.',
  }),
  'sen-vang': themeOf({
    red: false,
    suit: 'a tailored champagne silk suit jacket',
    scene: 'Color grade is ivory, cream and warm gold, tone-on-tone with a gold lotus wedding card. No red gown.',
    place: 'Soft gold daylight, pale lotus flowers and green leaves out of focus. No red.',
    walk: 'They walk beside a quiet lotus pond in warm gold light. Wide wedding album photograph.',
    seat: 'They sit on a cream bench among pale lotus blooms. Wide wedding album photograph.',
  }),
  'hong-ngoc-trai': themeOf({
    red: false,
    suit: 'a tailored pale blush suit jacket',
    scene: 'Color grade is pearl blush, cream and soft rose, tone-on-tone with a pearl wedding card. No red gown.',
    place: 'Soft pearl light, pale pink roses and a hint of pearls out of focus.',
    walk: 'They walk through a pearl-blush garden of pale roses. Wide wedding album photograph.',
    seat: 'They sit on a cream sofa among pale pink roses. Wide wedding album photograph.',
  }),
  'vuon-hong-troi': themeOf({
    red: false,
    suit: 'a tailored light sand suit jacket',
    scene: 'Color grade is sky blue, pale pink and cream, tone-on-tone with a rose garden under open sky. No red gown.',
    place: 'Open blue sky, pale pink garden roses, soft daylight.',
    walk: 'They walk through a rose garden under a pale blue sky. Wide wedding album photograph.',
    seat: 'They sit on a pale stone bench among pink roses and blue sky. Wide wedding album photograph.',
  }),
  'hoa-moc-xanh': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is sage green, cream and soft wood, tone-on-tone with a green wood-flower wedding card. No red gown.',
    place: 'Soft sage leaves, pale wood and white blossoms out of focus.',
    walk: 'They walk along a pale wood path under sage leaves and white flowers. Wide wedding album photograph.',
    seat: 'They sit on a light wood bench among sage leaves. Wide wedding album photograph.',
  }),
  'to-duyen-xanh': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is sage, cream and white, tone-on-tone with a calla-lily wedding card. No red gown.',
    place: 'White calla lilies and sage leaves in soft daylight.',
    walk: 'They walk through a garden of white calla lilies and sage leaves. Wide wedding album photograph.',
    seat: 'They sit close among white calla lilies. Wide wedding album photograph.',
  }),
  'do-dam': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is deep burgundy and cream, tone-on-tone with a dark burgundy minimal wedding card. The gown is deep burgundy silk, not bright scarlet.',
    place: 'A deep burgundy wall, quiet and almost plain, soft warm light.',
    walk: 'They walk through a quiet deep-burgundy hall with little ornament. Wide wedding album photograph.',
    seat: 'They sit on a dark bench against a deep burgundy wall. Wide wedding album photograph.',
  }),
  'ai-luxury': themeOf({
    red: false,
    suit: 'a tailored champagne suit jacket',
    scene: 'Color grade is champagne gold, ivory and a whisper of blush, an upscale hotel wedding. No red gown.',
    place: 'A bright hotel salon, champagne light, soft ivory drapes.',
    walk: 'They walk through a champagne hotel salon. Wide wedding album photograph.',
    seat: 'They sit on an ivory sofa in warm champagne light. Wide wedding album photograph.',
  }),
  'ai-minimal': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is warm white, sage and charcoal, a minimal wedding with lots of empty space. No red gown.',
    place: 'A plain warm-white wall, one soft sage stem far behind.',
    walk: 'They walk in a bright empty white room with one sage plant. Wide wedding album photograph.',
    seat: 'They sit on a white bench against a plain warm-white wall. Wide wedding album photograph.',
  }),
  'ai-traditional_vietnamese': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is scarlet and gold, a traditional Vietnamese wedding. A real lotus in a vase may sit far behind. No letters.',
    place: 'Scarlet wall, warm gold light, a real lotus bloom out of focus. No letters, no seal.',
    walk: 'They walk in a scarlet and gold courtyard with real lotus leaves. No letters. Wide wedding album photograph.',
    seat: 'They sit on dark wood against a scarlet wall, a real lotus nearby. No letters. Wide wedding album photograph.',
  }),
  'ai-floral': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is ivory, blush, peony pink and a little champagne. No red gown.',
    place: 'Soft peonies and pale lotus blooms, airy daylight.',
    walk: 'They walk through peonies and pale blossoms. Wide wedding album photograph.',
    seat: 'They sit among blush peonies. Wide wedding album photograph.',
  }),
  'ai-ethereal': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is ivory paper, pale blush and soft ink brown, lots of empty space, one flowering branch. No red gown.',
    place: 'An ivory wall and one pale flowering branch, lots of empty space.',
    walk: 'They walk past a single pale flowering branch on an ivory wall. Wide wedding album photograph.',
    seat: 'They sit with lots of ivory space and one soft branch behind them. Wide wedding album photograph.',
  }),
  'ai-vintage': themeOf({
    red: false,
    suit: 'a tailored warm taupe suit jacket',
    scene: 'Color grade is sepia, dusty rose and antique gold, like an aged photograph. No red gown.',
    place: 'Aged cream paper light, dusty roses, antique gold daylight.',
    walk: 'They walk through a sepia garden of dusty roses. Wide wedding album photograph.',
    seat: 'They sit on an antique cream sofa, sepia light. Wide wedding album photograph.',
  }),
  'ai-modern': themeOf({
    red: false,
    suit: 'a tailored black suit jacket',
    scene: 'Color grade is white, black and a thin line of metallic gold, a contemporary dark wedding. No red gown.',
    place: 'A dark charcoal wall, clean light, a thin warm gold highlight.',
    walk: 'They walk through a dark modern hall with one gold light. Wide wedding album photograph.',
    seat: 'They sit on a black bench against a charcoal wall. Wide wedding album photograph.',
  }),
  'kho-hong-buom': themeOf({
    red: false,
    suit: 'a tailored blush-ivory suit jacket',
    scene: 'Color grade is blush pink, cream and warm gold, tone-on-tone with a cream wedding card edged in pale roses and butterflies. No red gown.',
    place: 'Soft cream wall, pale pink roses and a few butterflies out of focus. No red.',
    walk: 'They walk through a cream garden of pale pink roses. Wide wedding album photograph.',
    seat: 'They sit on a cream bench among pale pink roses. Wide wedding album photograph.',
  }),
  'kho-sen-hong': themeOf({
    red: false,
    suit: 'a tailored champagne suit jacket',
    scene: 'Color grade is pink lotus, cream and warm gold, tone-on-tone with a lotus wedding card. No red gown.',
    place: 'Soft gold daylight, pink lotus flowers and green leaves out of focus. No red.',
    walk: 'They walk beside a quiet pond of pink lotus. Wide wedding album photograph.',
    seat: 'They sit on a cream bench among pink lotus blooms. Wide wedding album photograph.',
  }),
  'kho-hac-sen': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is deep red, blush and warm gold, tone-on-tone with a crane-and-lotus wedding card.',
    place: 'Warm gold light, red and pink lotus out of focus, a pale wall. No painted crane, no letters.',
    walk: 'They walk through a hall of red and pink lotus in warm gold light. No painted birds. Wide wedding album photograph.',
    seat: 'They sit close among red and pink lotus flowers. No painted birds. Wide wedding album photograph.',
  }),
  'kho-hac-do': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is scarlet, blush and antique gold, tone-on-tone with a red crane wedding card.',
    place: 'Scarlet silk and gold light, lotus blooms out of focus. No painted crane, no letters.',
    walk: 'They walk through a scarlet and gold hall with lotus. No painted birds. Wide wedding album photograph.',
    seat: 'They sit on a dark wood bench against scarlet silk. No painted birds. Wide wedding album photograph.',
  }),
  'kho-phung-do': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is lacquer red and warm gold, tone-on-tone with a phoenix wedding card.',
    place: 'Deep red lacquer wall and warm gold light. No painted phoenix, no letters.',
    walk: 'They walk through a red lacquer hall with gold light. No painted birds. Wide wedding album photograph.',
    seat: 'They sit close against a deep red lacquer wall. No painted birds. Wide wedding album photograph.',
  }),
  'kho-mau-don': themeOf({
    red: false,
    suit: 'a tailored ivory suit jacket',
    scene: 'Color grade is ivory, burgundy and warm gold, tone-on-tone with a peony wedding card. The bride stays in a white gown. No red gown.',
    place: 'Cream wall, burgundy and pale pink peonies out of focus. No red gown.',
    walk: 'They walk through a cream hall with burgundy peonies. She wears the white bridal gown. Wide wedding album photograph.',
    seat: 'They sit on a cream sofa among pale and burgundy peonies. She wears the white bridal gown. Wide wedding album photograph.',
  }),
  'kho-do-phap': themeOf({
    red: true,
    suit: 'a tailored charcoal suit jacket',
    scene: 'Color grade is bright scarlet and warm gold, tone-on-tone with a red firework wedding card.',
    place: 'Solid scarlet backdrop, soft gold light, a few red roses out of focus. No painted fireworks, no letters.',
    walk: 'They walk through a scarlet hall with red roses and warm gold light. No fireworks drawn in the photo. Wide wedding album photograph.',
    seat: 'They sit close against a scarlet wall with red roses. Wide wedding album photograph.',
  }),
})

function extOf(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png'
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'webp'
  return 'png'
}

async function callImage({ prompt, size, image }) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) throw new Error('Thiếu OPENAI_API_KEY')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 300000)
  try {
    let res
    if (!image) {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size,
          quality: 'medium',
        }),
        signal: ac.signal,
      })
    } else {
      const form = new FormData()
      form.set('model', 'gpt-image-2')
      form.set('prompt', prompt)
      form.set('n', '1')
      form.set('size', size)
      form.set('quality', 'medium')
      const mime = extOf(image) === 'jpg' ? 'image/jpeg' : 'image/png'
      form.append('image', new Blob([image], { type: mime }), `ref.${extOf(image)}`)
      res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: ac.signal,
      })
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 600)
      throw new Error(`HTTP ${res.status}: ${detail}`)
    }
    const json = await res.json()
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI không trả b64_json')
    return Buffer.from(b64, 'base64')
  } finally {
    clearTimeout(timer)
  }
}

function fullPrompt(theme, shotPrompt) {
  return `${shotPrompt} ${theme.couple} ${REAL}`
}

async function generateOne(id, only) {
  const theme = THEMES[id]
  if (!theme) {
    console.error(`Chưa có prompt cho "${id}". Có: ${Object.keys(THEMES).join(', ')}`)
    process.exit(1)
  }
  const dir = join('public', 'wedding', 'samples', id)
  mkdirSync(dir, { recursive: true })
  const names = ['cover', 'groom', 'bride', 'album-1', 'album-2']
  if (only && !names.includes(only)) {
    console.error(`Ảnh không hợp lệ "${only}". Có: ${names.join(', ')}`)
    process.exit(1)
  }
  const files = {}

  let coverBuf
  if (only && only !== 'cover') {
    coverBuf = readFileSync(join(dir, 'cover.png'))
  } else {
    console.log(`cover ${id}`)
    coverBuf = await callImage({
      prompt: fullPrompt(theme, theme.shots.cover.prompt),
      size: theme.shots.cover.size,
    })
    const coverExt = extOf(coverBuf)
    const coverName = `cover.${coverExt}`
    writeFileSync(join(dir, coverName), coverBuf)
    files.cover = `/wedding/samples/${id}/${coverName}`
    console.log(`saved ${files.cover} ${coverBuf.length}`)
  }

  const rest = only === 'cover' ? [] : only ? [only] : names.filter((name) => name !== 'cover')
  const made = await Promise.all(
    rest.map(async (name) => {
      console.log(`${name} ${id}`)
      const buf = await callImage({
        prompt: fullPrompt(theme, theme.shots[name].prompt),
        size: theme.shots[name].size,
        image: coverBuf,
      })
      const nameOnDisk = `${name}.${extOf(buf)}`
      writeFileSync(join(dir, nameOnDisk), buf)
      console.log(`saved /wedding/samples/${id}/${nameOnDisk} ${buf.length}`)
      return [name, `/wedding/samples/${id}/${nameOnDisk}`]
    }),
  )
  for (const [name, url] of made) files[name] = url
  console.log(JSON.stringify(files))
}

function isComplete(id) {
  const dir = join('public', 'wedding', 'samples', id)
  return ['cover', 'groom', 'bride', 'album-1', 'album-2'].every((name) => existsSync(join(dir, `${name}.png`)))
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--pending') {
    const pending = Object.keys(THEMES).filter((id) => !isComplete(id))
    console.log(`pending ${pending.length}: ${pending.join(', ')}`)
    for (const id of pending) {
      console.log(`\n=== ${id} ===`)
      await generateOne(id)
    }
    return
  }
  const shots = ['cover', 'groom', 'bride', 'album-1', 'album-2']
  if (args.length === 2 && shots.includes(args[1])) {
    await generateOne(args[0], args[1])
    return
  }
  for (const id of args) {
    console.log(`\n=== ${id} ===`)
    await generateOne(id)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
