/**
 * Ảnh khách cho demo từng loại thiệp một người.
 * Chạy: node scripts/generate-occasion-demo-photos.mjs day-thang-sen
 * Nhiều id: node scripts/generate-occasion-demo-photos.mjs --pending
 * Ảnh là ảnh chụp, lưu PNG. Không in khóa API.
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Real photograph, natural daylight or warm practical light, visible fabric weave and natural skin texture, shot on a full-frame camera. Place the subject in the vertical center, with a small even margin above the hair. No text, no letters, no watermark, no logo, no border, no frame, no magenta fringe. Not a cartoon, not an illustration, not watercolor, not a pencil sketch, not a vector, not anime, not CGI, not plastic skin, not a flat icon, not clipart.'

const PLACE = {
  'sen-vang': 'Soft gold daylight, pale lotus flowers and green leaves far behind, cream and warm gold. No red gown.',
  'hong-ngoc-trai': 'Pearl daylight, pale pink roses out of focus, cream and blush. No red gown.',
  'hoa-moc-xanh': 'Soft sage leaves and pale wood, white blossoms out of focus, cream and green. No red gown.',
  'vuon-hong-troi': 'Open garden, pale pink roses and a light blue sky, natural daylight. No red gown.',
  'toi-gian-nau': 'Warm cream wall, a little dried beige grass, ivory and taupe. No pink overload, no red gown.',
  'hoa-dao': 'Real peach blossoms and soft pink daylight, cream wall. No red gown.',
  'tre-viet': 'Real bamboo leaves and a pale wooden porch, green and cream daylight. No red gown.',
  'vuon-kinh-hong': 'Glass garden, pale pink roses, soft daylight, blush and cream. No red gown.',
  'que-nghe-an': 'A real countryside yard, areca leaves and warm earth, cream and green. No red gown.',
  'lua-ao-dai': 'Ivory silk curtain and warm wood, cream daylight. No red gown.',
  'dem-vang': 'Evening interior, warm gold lamps, dark wood, black and champagne. No cartoon sparkles.',
  bien: 'A real quiet shore, pale blue water and sand, white and sea-blue daylight. No red gown.',
  'cho-ben-thanh': 'A real market street in warm daylight, marigolds and earth red far behind, no readable signs.',
  'phong-bi-thu': 'Cream wall and real burgundy peonies out of focus. No letters on paper.',
  'song-hy-do': 'Deep red silk backdrop and warm gold light. No letters, no seal, no double-happiness mark.',
  'do-son': 'Soft scarlet lacquer wall, a hint of gold lattice far behind, no text.',
  'chua-mot-cot': 'A quiet temple yard, pale lotus and old stone, cream daylight. No statue close to the lens, no text.',
  'van-mieu': 'Old brick and apricot blossoms, warm cream daylight. No readable plaque.',
  'long-phung-do': 'Deep red lacquer wall and warm gold light. No painted dragon, no letters.',
  'duong-lam': 'A real laterite old house and a bodhi leaf, warm earth daylight. No text.',
  'lang-bac': 'A quiet lake edge, pale lotus and green leaves, soft daylight. No monument close-up, no text.',
  'vinh-ha-long': 'A calm bay, pale limestone far away, blue water and cream light. No text.',
}

const LOOK = {
  'day-thang-sen': 'sen-vang',
  'day-thang-ngoc': 'hong-ngoc-trai',
  'day-thang-moc': 'hoa-moc-xanh',
  'day-thang-troi': 'vuon-hong-troi',
  'day-thang-nau': 'toi-gian-nau',
  'thoi-noi-dao': 'hoa-dao',
  'thoi-noi-tre': 'tre-viet',
  'thoi-noi-vuon': 'vuon-kinh-hong',
  'thoi-noi-que': 'que-nghe-an',
  'thoi-noi-lua': 'lua-ao-dai',
  'sinh-nhat-hong': 'vuon-hong-troi',
  'sinh-nhat-kinh': 'vuon-kinh-hong',
  'sinh-nhat-son': 'do-son',
  'sinh-nhat-tre': 'tre-viet',
  'sinh-nhat-dem': 'dem-vang',
  'sinh-nhat-bien': 'bien',
  'sinh-nhat-lua': 'lua-ao-dai',
  'sinh-nhat-cho': 'cho-ben-thanh',
  'sinh-nhat-hoa': 'phong-bi-thu',
  'mung-tho-hy': 'song-hy-do',
  'mung-tho-son': 'do-son',
  'mung-tho-chua': 'chua-mot-cot',
  'mung-tho-van': 'van-mieu',
  'mung-tho-long': 'long-phung-do',
  'khai-truong-son': 'do-son',
  'khai-truong-dem': 'dem-vang',
  'khai-truong-cho': 'cho-ben-thanh',
  'khai-truong-hy': 'song-hy-do',
  'khai-truong-sen': 'sen-vang',
  'tan-gia-duong': 'duong-lam',
  'tan-gia-que': 'que-nghe-an',
  'tan-gia-tre': 'tre-viet',
  'tan-gia-lua': 'lua-ao-dai',
  'tan-gia-nau': 'toi-gian-nau',
  'lien-hoan-bien': 'bien',
  'lien-hoan-troi': 'vuon-hong-troi',
  'lien-hoan-dem': 'dem-vang',
  'lien-hoan-moc': 'hoa-moc-xanh',
  'lien-hoan-tre': 'tre-viet',
  'tot-nghiep-van': 'van-mieu',
  'tot-nghiep-lang': 'lang-bac',
  'tot-nghiep-chua': 'chua-mot-cot',
  'tot-nghiep-moc': 'hoa-moc-xanh',
  'tot-nghiep-nau': 'toi-gian-nau',
  'su-kien-halong': 'vinh-ha-long',
  'su-kien-chua': 'chua-mot-cot',
  'su-kien-long': 'long-phung-do',
  'su-kien-dem': 'dem-vang',
  'su-kien-van': 'van-mieu',
}

function kindOf(id) {
  if (id.startsWith('day-thang-')) return 'baby'
  if (id.startsWith('thoi-noi-')) return 'toddler'
  if (id === 'sinh-nhat-son' || id === 'sinh-nhat-tre') return 'birthday-man'
  if (id.startsWith('sinh-nhat-')) return 'birthday'
  if (id.startsWith('mung-tho-')) return 'elder'
  if (id.startsWith('khai-truong-')) return 'shop'
  if (id.startsWith('tan-gia-')) return 'home'
  if (id.startsWith('lien-hoan-')) return 'party'
  if (id.startsWith('tot-nghiep-')) return 'grad'
  return 'event'
}

function themeOf(id) {
  const place = PLACE[LOOK[id]]
  if (!place) throw new Error(`Thiếu bối cảnh cho ${id}`)
  const kind = kindOf(id)
  const who = {
    baby: {
      primary: 'A Vietnamese baby about 4 weeks old, fine hair, real skin, a soft cotton outfit in the colors of the room.',
      secondary: 'A Vietnamese mother about 30, natural skin, hair tied back, a linen or silk top, not a wedding gown, not a costume.',
      cover: 'The mother holds the baby at chest height. Both are calm and look at the camera. The baby is fully visible, not cropped at the chin.',
      walk: 'Wide photograph: the mother sits with the baby near a window, a small cream blanket, quiet room.',
      seat: 'Wide photograph: the baby lies on a cream linen blanket, awake, the mother sits beside, one hand near the baby, not covering the face.',
    },
    toddler: {
      primary: 'A Vietnamese toddler about 12 months, round face, real skin, a soft cotton outfit, able to sit.',
      secondary: 'A Vietnamese father about 32, short black hair, a simple linen shirt, not a suit costume.',
      cover: 'The father kneels beside the seated toddler. Both look at the camera. The child is fully in frame.',
      walk: 'Wide photograph: the toddler stands holding the father hand in the setting, both in daylight.',
      seat: 'Wide photograph: the toddler sits on a low wooden stool, a small cake with no readable letters, the father beside.',
    },
    birthday: {
      primary: 'A Vietnamese woman from Hanoi, about 28, clearly East Asian: black hair, dark brown eyes, warm light skin, a soft natural face. Not Caucasian, not blonde, not blue eyes, not a European model. Real skin texture, a silk blouse in blush or cream. Not a bridal gown, not a costume.',
      secondary: 'Do not add a second person.',
      cover: 'Waist-up portrait of this Vietnamese woman alone. Black hair, dark brown eyes, East Asian features. A small real cake with unlit candles and no letters sits lower in the frame. She looks at the camera. No other person. Not a blonde woman.',
      walk: 'Wide photograph: the same Vietnamese woman, black hair and dark eyes, walks alone through the setting, same clothes. No other person anywhere in the frame. Not a European woman.',
      seat: 'Wide photograph: the same Vietnamese woman, black hair and dark eyes, sits alone at a table, a cake with no readable writing. Empty chairs. No other person. Not a blonde woman.',
    },
    'birthday-man': {
      primary: 'A Vietnamese man about 32, East Asian features, short black hair, clean-shaven, real skin texture, a tailored charcoal jacket over a white shirt with no tie. Masculine. Not a groom, not a boutonniere, not a costume.',
      secondary: 'Do not add a second person.',
      cover: 'Waist-up portrait of the man alone, facing the camera, a small real cake with unlit candles and no letters lower in the frame. No other person.',
      walk: 'Wide photograph: the same man walks alone through the setting, same clothes, one hand in a pocket. No other person anywhere in the frame.',
      seat: 'Wide photograph: the same man sits alone at a wooden table, a small cake with no readable writing, warm light. The other chairs are empty. No other person.',
    },
    elder: {
      primary: 'A Vietnamese elder about 78, silver hair, real wrinkles, a silk ao dai or a dark formal tunic. Dignified, not a costume, not a cartoon sage.',
      secondary: 'Their adult child, a Vietnamese person about 48, formal but simple clothes, standing a little behind.',
      cover: 'Waist-up portrait of the elder seated, looking at the camera, the adult child beside, both calm.',
      walk: 'Wide photograph: the family walks slowly in the setting, the elder in front.',
      seat: 'Wide photograph: the elder sits at a wooden table with tea, the adult child beside, no readable text on cups.',
    },
    shop: {
      primary: 'A Vietnamese shop owner about 34, smart shirt or ao dai, standing inside a real small shop. Not a model on a runway.',
      secondary: 'The same shop seen from the counter, a second Vietnamese colleague about 30 in a simple apron or shirt.',
      cover: 'The owner stands at the open shop door, waist-up, looking at the camera. Shelves behind are real, signs have no readable letters.',
      walk: 'Wide photograph: the owner walks a customer through the shop, real products, no logos, no readable labels.',
      seat: 'Wide photograph: tea on the counter, the owner and colleague behind it, warm practical light.',
    },
    home: {
      primary: 'A Vietnamese host about 36 in a real home, linen clothes, not a wedding gown.',
      secondary: 'Their partner, a Vietnamese person about 34, simple clothes, same house.',
      cover: 'Waist-up portrait of the host at the front door, looking at the camera, a real wooden door behind.',
      walk: 'Wide photograph: the two people walk through a real living room with a wooden table.',
      seat: 'Wide photograph: they sit at the dining table, a home-cooked meal, no readable packaging.',
    },
    party: {
      primary: 'A Vietnamese host about 40 at a real dinner, smart casual clothes.',
      secondary: 'A Vietnamese guest about 35 seated beside, similar formality.',
      cover: 'Waist-up portrait of the host at the head of a round table, looking at the camera, dishes without logos.',
      walk: 'Wide photograph: guests walk into the room, the host greets one person, natural faces.',
      seat: 'Wide photograph: a round table mid-meal, real food, people talking, no banners, no readable text.',
    },
    grad: {
      primary: 'A Vietnamese graduate about 22 in a real black graduation gown and a mortarboard, natural skin, the gown is cloth not a costume illustration.',
      secondary: 'A Vietnamese parent about 50 in formal simple clothes, standing beside.',
      cover: 'Waist-up portrait of the graduate, cap on, looking at the camera, the parent slightly behind. No school name, no letters.',
      walk: 'Wide photograph: the graduate and parent walk outdoors in the setting, the gown moves like real cloth.',
      seat: 'Wide photograph: they sit at a family table after the ceremony, the cap rests on the table, no readable diploma.',
    },
    event: {
      primary: 'A Vietnamese host about 40 in a tailored dark jacket and white shirt, at a real hall, not on a stage with a logo.',
      secondary: 'A Vietnamese colleague about 35 in similar formal clothes.',
      cover: 'Waist-up portrait of the host in the hall, looking at the camera, empty chairs soft behind, no banner text.',
      walk: 'Wide photograph: the host walks a guest down the aisle of a quiet hall.',
      seat: 'Wide photograph: two people sit at a long table with water glasses, papers turned face down so no letters show.',
    },
  }[kind]
  if (id === 'sinh-nhat-tre') {
    who.primary = 'A Vietnamese man about 32, East Asian features, short black hair, clean-shaven, real skin texture, a heavy olive linen shirt with the sleeves rolled once. Masculine and calm. Not a costume, not a groom.'
  }
  return {
    place,
    shots: {
      cover: { size: '1024x1536', prompt: `${who.cover} ${place}` },
      groom: { size: '1024x1536', prompt: `${who.primary} Alone, waist-up, facing the camera. ${place} No other person.` },
      bride: { size: '1024x1536', prompt: `${who.secondary} Alone, waist-up, facing the camera. ${place} The other person must not appear.` },
      'album-1': { size: '1536x1024', prompt: `${who.walk} ${place}` },
      'album-2': { size: '1536x1024', prompt: `${who.seat} ${place}` },
    },
  }
}

async function callImage({ prompt, size, image }) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) throw new Error('Thiếu OPENAI_API_KEY')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 180000)
  try {
    let res
    if (!image) {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size, quality: 'medium' }),
        signal: ac.signal,
      })
    } else {
      const form = new FormData()
      form.set('model', 'gpt-image-2')
      form.set('prompt', prompt)
      form.set('n', '1')
      form.set('size', size)
      form.set('quality', 'medium')
      form.append('image', new Blob([image], { type: 'image/png' }), 'ref.png')
      res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: ac.signal,
      })
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400)
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

async function savePng(dir, name, buf) {
  const png = await sharp(buf).rotate().png().toBuffer()
  const file = join(dir, `${name}.png`)
  writeFileSync(file, png)
  console.log(`saved ${file} ${png.length}`)
  return png
}

function shotNames(id) {
  if (String(id).startsWith('sinh-nhat-')) return ['cover', 'groom', 'album-1', 'album-2']
  return ['cover', 'groom', 'bride', 'album-1', 'album-2']
}

function isComplete(id) {
  const dir = join('public', 'wedding', 'samples', id)
  return shotNames(id).every((name) => existsSync(join(dir, `${name}.png`)))
}

async function generateShots(id, names) {
  const theme = themeOf(id)
  const dir = join('public', 'wedding', 'samples', id)
  const coverPath = join(dir, 'cover.png')
  if (!existsSync(coverPath)) throw new Error(`Thiếu ảnh bìa ${id}`)
  const cover = await sharp(coverPath).png().toBuffer()
  await Promise.all(names.map(async (name) => {
    const shot = theme.shots[name]
    if (!shot) throw new Error(`Không có ảnh ${name}`)
    console.log(`${name} ${id}`)
    const raw = await callImage({
      prompt: `${shot.prompt} ${REAL}`,
      size: shot.size,
      image: cover,
    })
    await savePng(dir, name, raw)
  }))
}

async function generateOne(id) {
  if (isComplete(id)) {
    console.log(`skip ${id}`)
    return
  }
  const theme = themeOf(id)
  const dir = join('public', 'wedding', 'samples', id)
  mkdirSync(dir, { recursive: true })
  console.log(`cover ${id}`)
  const coverRaw = await callImage({ prompt: `${theme.shots.cover.prompt} ${REAL}`, size: theme.shots.cover.size })
  const cover = await savePng(dir, 'cover', coverRaw)
  await sharp(cover).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 62 }).toFile(join('public', 'wedding', 'sample-thumbs', `${id}.webp`))
  const rest = shotNames(id).filter((name) => name !== 'cover')
  await Promise.all(rest.map(async (name) => {
    console.log(`${name} ${id}`)
    const raw = await callImage({
      prompt: `${theme.shots[name].prompt} ${REAL}`,
      size: theme.shots[name].size,
      image: cover,
    })
    await savePng(dir, name, raw)
  }))
}

async function main() {
  mkdirSync(join('public', 'wedding', 'sample-thumbs'), { recursive: true })
  mkdirSync(join('public', 'wedding', 'sample-scroll'), { recursive: true })
  const args = process.argv.slice(2)
  let onlyShots = null
  const rest = []
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--shots') {
      onlyShots = String(args[i + 1] || '').split(',').map((name) => name.trim()).filter(Boolean)
      i += 1
      continue
    }
    rest.push(args[i])
  }
  const ids = rest[0] === '--pending' ? Object.keys(LOOK).filter((id) => !isComplete(id)) : rest
  if (ids.length === 0) {
    console.log('nothing to do')
    return
  }
  for (const id of ids) {
    if (!LOOK[id]) {
      console.error(`Không có mẫu ${id}`)
      process.exit(1)
    }
    console.log(`\n=== ${id} ===`)
    let last
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (onlyShots) await generateShots(id, onlyShots)
        else await generateOne(id)
        last = null
        break
      } catch (error) {
        last = error
        console.error(`retry ${attempt} ${id}: ${error instanceof Error ? error.message : String(error)}`)
        await new Promise((resolve) => setTimeout(resolve, 4000 * attempt))
      }
    }
    if (last) throw last
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
