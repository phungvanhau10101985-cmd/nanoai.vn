/**
 * Khung vỏ thiệp: WebP trong suốt, lỗ giữa để ảnh.
 * Chạy: node scripts/build-wedding-cover-frames.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'wedding', 'covers')
const W = 900
const H = 1200

function holePct(hole) {
  return {
    x: round((hole.x / W) * 100),
    y: round((hole.y / H) * 100),
    w: round((hole.w / W) * 100),
    h: round((hole.h / H) * 100),
  }
}

function round(n) {
  return Math.round(n * 100) / 100
}

function svg(hole, masked, extras = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <mask id="hole">
      <rect width="${W}" height="${H}" fill="#fff"/>
      <rect x="${hole.x}" y="${hole.y}" width="${hole.w}" height="${hole.h}" rx="26" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#hole)">${masked}</g>
  ${extras}
  ${ring(hole)}
</svg>`
}

function ring(hole, color = 'rgba(255,255,255,0.92)', sw = 10) {
  const p = 8
  return `<rect x="${hole.x - p}" y="${hole.y - p}" width="${hole.w + p * 2}" height="${hole.h + p * 2}" rx="32" fill="none" stroke="${color}" stroke-width="${sw}"/>`
}

function heart(cx, cy, s, fill, rot = 0) {
  const d = `M 0 ${s * 0.32} C 0 ${s * 0.02}, ${-s * 0.55} ${-s * 0.08}, ${-s * 0.55} ${-s * 0.36} C ${-s * 0.55} ${-s * 0.68}, ${-s * 0.12} ${-s * 0.72}, 0 ${-s * 0.4} C ${s * 0.12} ${-s * 0.72}, ${s * 0.55} ${-s * 0.68}, ${s * 0.55} ${-s * 0.36} C ${s * 0.55} ${-s * 0.08}, 0 ${s * 0.02}, 0 ${s * 0.32} Z`
  return `<path d="${d}" fill="${fill}" transform="translate(${cx} ${cy}) rotate(${rot})"/>`
}

function bud(cx, cy, rot, fill, rx = 9, ry = 16) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${rot} ${cx} ${cy})"/>`
}

function rose(cx, cy, r, fill) {
  return `<g transform="translate(${cx} ${cy})">
    <circle cx="${-r * 0.55}" cy="${r * 0.1}" r="${r * 0.62}" fill="${fill}"/>
    <circle cx="${r * 0.5}" cy="${-r * 0.05}" r="${r * 0.58}" fill="${fill}"/>
    <circle cx="0" cy="${r * 0.48}" r="${r * 0.55}" fill="${fill}"/>
    <circle r="${r * 0.5}" fill="${fill}"/>
    <circle r="${r * 0.22}" fill="#fff6f8"/>
  </g>`
}

function bouquet(cx, cy, rot, scale, petal, leafColor, heartColor) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale})">
    ${leaf(-36, 16, -48, leafColor, 30, 10)}
    ${leaf(30, 22, 36, leafColor, 26, 9)}
    ${leaf(6, 28, 8, leafColor, 18, 7)}
    ${bud(-22, -18, -28, petal, 8, 15)}
    ${bud(24, -8, 22, petal, 7, 13)}
    ${rose(0, 0, 26, petal)}
    ${heart(34, -24, 20, heartColor, 18)}
  </g>`
}

function leaf(cx, cy, rot, color, rx = 22, ry = 8) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" transform="rotate(${rot} ${cx} ${cy})"/>`
}

function lotus(cx, cy, s, petal, heart) {
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const px = cx + Math.cos(a) * s * 0.34
    const py = cy + Math.sin(a) * s * 0.2
    out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${s * 0.28}" ry="${s * 0.13}" fill="${petal}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`
  }
  return `<g>${out}<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.16}" ry="${s * 0.1}" fill="${heart}"/></g>`
}

function happiness(cx, cy, s, color) {
  const gw = s * 0.46
  const gap = s * 0.08
  const y0 = cy - s / 2
  const t = Math.max(8, s * 0.09)
  const one = (x) => {
    const bars = [
      [x, y0, gw, t],
      [x + gw / 2 - t / 2, y0, t, s * 0.46],
      [x + t, y0 + s * 0.18, gw - t * 2, t],
      [x + t, y0 + s * 0.34, gw - t * 2, t],
      [x, y0 + s * 0.48, gw, t],
      [x, y0 + s * 0.48, t, s * 0.52],
      [x + gw - t, y0 + s * 0.48, t, s * 0.52],
      [x, y0 + s - t, gw, t],
      [x + gw / 2 - t / 2, y0 + s * 0.48, t, s * 0.52],
    ]
    return bars
      .map(([bx, by, bw, bh]) => `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}"/>`)
      .join('')
  }
  return one(cx - gw - gap / 2) + one(cx + gap / 2)
}

const standard = { x: 130, y: 150, w: 640, h: 760 }

const frames = [
  {
    id: 'classic_red',
    file: 'classic-red.webp',
    hole: { x: 150, y: 210, w: 600, h: 700 },
    panel: '#fff8f0',
    ink: 'dark',
    svg: null,
  },
  {
    id: 'blush_floral',
    file: 'blush-floral.webp',
    hole: standard,
    panel: '#fff5f7',
    ink: 'dark',
  },
  {
    id: 'sage_garden',
    file: 'sage-garden.webp',
    hole: standard,
    panel: '#f4faf6',
    ink: 'dark',
  },
  {
    id: 'gold_luxury',
    file: 'gold-luxury.webp',
    hole: { x: 140, y: 160, w: 620, h: 740 },
    panel: '#fffaf2',
    ink: 'dark',
  },
  {
    id: 'night_modern',
    file: 'night-modern.webp',
    hole: { x: 120, y: 140, w: 660, h: 760 },
    panel: '#0f172a',
    ink: 'light',
  },
  {
    id: 'lotus_viet',
    file: 'lotus-viet.webp',
    hole: { x: 150, y: 200, w: 600, h: 700 },
    panel: '#fff6ea',
    ink: 'dark',
  },
  {
    id: 'envelope_wax',
    file: 'envelope-wax.webp',
    hole: { x: 210, y: 430, w: 480, h: 460 },
    panel: '#f3ead7',
    ink: 'dark',
  },
  {
    id: 'polaroid',
    file: 'polaroid.webp',
    hole: { x: 78, y: 70, w: 744, h: 900 },
    panel: '#ffffff',
    ink: 'dark',
  },
  {
    id: 'phoenix_pair',
    file: 'phoenix-pair.webp',
    hole: { x: 170, y: 180, w: 560, h: 720 },
    panel: '#fff7f4',
    ink: 'dark',
  },
  {
    id: 'calla',
    file: 'calla.webp',
    hole: { x: 90, y: 160, w: 520, h: 760 },
    panel: '#f7f7f5',
    ink: 'dark',
  },
  {
    id: 'dried_flowers',
    file: 'dried-flowers.webp',
    hole: standard,
    panel: '#f6efe6',
    ink: 'dark',
  },
  {
    id: 'crest_seal',
    file: 'crest-seal.webp',
    hole: { x: 160, y: 230, w: 580, h: 680 },
    panel: '#fffaf3',
    ink: 'dark',
  },
]

function sideVine(x, y0, y1, color, tilt = 1) {
  const parts = [`<path d="M ${x} ${y0} Q ${x + tilt * 22} ${(y0 + y1) / 2} ${x} ${y1}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`]
  const steps = 5
  for (let i = 0; i < steps; i += 1) {
    const t = (i + 0.5) / steps
    const y = y0 + (y1 - y0) * t
    const side = i % 2 === 0 ? -1 : 1
    parts.push(leaf(x + side * 16 * tilt, y, side * 50, color, 18, 7))
    if (i % 2 === 0) parts.push(bud(x + side * 8 * tilt, y - 10, side * 20, color, 6, 11))
  }
  return parts.join('')
}

function bodyFor(id) {
  if (id === 'classic_red') {
    return `
      <rect x="48" y="48" width="804" height="1104" rx="28" fill="#9f1239"/>
      <rect x="78" y="78" width="744" height="1044" rx="18" fill="none" stroke="#f6c453" stroke-width="8"/>
      ${happiness(450, 128, 108, '#f6c453')}
      ${heart(150, 150, 36, '#f6c453', -12)}
      ${heart(750, 150, 36, '#f6c453', 12)}
      ${heart(160, 1040, 34, '#fbbf24', 8)}
      ${heart(740, 1040, 34, '#fbbf24', -8)}
      ${lotus(210, 1088, 54, '#fb7185', '#f6c453')}
      ${lotus(690, 1088, 54, '#fda4af', '#fbbf24')}
      ${leaf(120, 980, -40, '#f6c453', 28, 9)}
      ${leaf(780, 980, 40, '#f6c453', 28, 9)}
      ${bud(250, 160, -20, '#fecdd3', 8, 16)}
      ${bud(650, 160, 20, '#fecdd3', 8, 16)}
    `
  }
  if (id === 'blush_floral') {
    return `
      <rect x="70" y="70" width="760" height="1060" rx="36" fill="none" stroke="#fecdd3" stroke-width="10"/>
      ${bouquet(130, 130, -8, 1.15, '#e11d48', '#059669', '#fb7185')}
      ${bouquet(770, 140, 12, 1.05, '#be185d', '#047857', '#fda4af')}
      ${bouquet(140, 1060, 16, 1.05, '#fb7185', '#059669', '#e11d48')}
      ${bouquet(770, 1070, -14, 1.1, '#e11d48', '#047857', '#fb7185')}
      ${sideVine(78, 280, 860, '#059669', 1)}
      ${sideVine(822, 280, 860, '#047857', -1)}
      ${heart(450, 1088, 28, '#e11d48')}
    `
  }
  if (id === 'sage_garden') {
    return `
      <rect x="64" y="64" width="772" height="1072" rx="28" fill="none" stroke="#047857" stroke-width="3"/>
      <rect x="84" y="84" width="732" height="1032" rx="20" fill="none" stroke="#a7f3d0" stroke-width="8"/>
      ${sideVine(70, 180, 1040, '#059669', 1)}
      ${sideVine(830, 180, 1040, '#065f46', -1)}
      ${leaf(160, 100, -30, '#047857', 40, 13)}
      ${leaf(220, 78, 18, '#065f46', 28, 9)}
      ${bud(250, 110, -16, '#6ee7b7', 8, 16)}
      ${leaf(740, 96, 36, '#047857', 38, 12)}
      ${leaf(680, 78, -12, '#065f46', 26, 8)}
      ${bud(650, 112, 20, '#6ee7b7', 8, 16)}
      ${leaf(180, 1100, 24, '#059669', 36, 12)}
      ${leaf(720, 1100, -28, '#047857', 36, 12)}
      ${bud(450, 1104, 0, '#a7f3d0', 10, 18)}
      ${heart(450, 1040, 22, '#047857')}
    `
  }
  if (id === 'gold_luxury') {
    return `
      <rect x="56" y="56" width="788" height="1088" rx="8" fill="none" stroke="#a16207" stroke-width="4"/>
      <rect x="76" y="76" width="748" height="1048" rx="4" fill="none" stroke="#fbbf24" stroke-width="10"/>
      <rect x="96" y="96" width="708" height="1008" fill="none" stroke="#a16207" stroke-width="2"/>
      <polygon points="70,70 130,70 70,130" fill="#fbbf24"/>
      <polygon points="830,70 770,70 830,130" fill="#fbbf24"/>
      <polygon points="70,1130 130,1130 70,1070" fill="#fbbf24"/>
      <polygon points="830,1130 770,1130 830,1070" fill="#fbbf24"/>
      ${heart(450, 112, 26, '#a16207')}
      ${heart(450, 1090, 26, '#a16207')}
      ${leaf(160, 120, -35, '#a16207', 32, 10)}
      ${leaf(740, 120, 35, '#a16207', 32, 10)}
      ${leaf(160, 1088, 30, '#fbbf24', 30, 10)}
      ${leaf(740, 1088, -30, '#fbbf24', 30, 10)}
      ${bud(200, 150, -18, '#fde68a', 7, 14)}
      ${bud(700, 150, 18, '#fde68a', 7, 14)}
      ${bud(190, 1040, 16, '#fde68a', 7, 14)}
      ${bud(710, 1040, -16, '#fde68a', 7, 14)}
      ${heart(120, 220, 18, '#fbbf24', -20)}
      ${heart(780, 220, 18, '#fbbf24', 20)}
    `
  }
  if (id === 'night_modern') {
    return `
      <rect x="40" y="40" width="820" height="1120" rx="36" fill="#0f172a"/>
      <rect x="70" y="70" width="760" height="1060" rx="24" fill="none" stroke="#fbbf24" stroke-width="3"/>
      ${heart(450, 108, 22, '#fbbf24')}
      ${bud(160, 120, -24, '#fbbf24', 5, 14)}
      ${bud(740, 120, 24, '#fbbf24', 5, 14)}
      ${bud(150, 1060, 18, '#fcd34d', 5, 14)}
      ${bud(750, 1060, -18, '#fcd34d', 5, 14)}
      <ellipse cx="120" cy="220" rx="10" ry="4" fill="#fbbf24" transform="rotate(-30 120 220)"/>
      <ellipse cx="780" cy="220" rx="10" ry="4" fill="#fbbf24" transform="rotate(30 780 220)"/>
      <ellipse cx="130" cy="980" rx="12" ry="4" fill="#fcd34d" transform="rotate(20 130 980)"/>
      <ellipse cx="770" cy="980" rx="12" ry="4" fill="#fcd34d" transform="rotate(-20 770 980)"/>
    `
  }
  if (id === 'lotus_viet') {
    return `
      <rect x="52" y="52" width="796" height="1096" rx="20" fill="#fff6ea"/>
      <rect x="72" y="72" width="756" height="1056" rx="12" fill="none" stroke="#b91c1c" stroke-width="8"/>
      <rect x="90" y="90" width="720" height="1020" fill="none" stroke="#f6c453" stroke-width="3"/>
      ${happiness(450, 118, 72, '#9f1239')}
      ${lotus(150, 160, 86, '#fb7185', '#fbbf24')}
      ${lotus(750, 160, 86, '#e11d48', '#f6c453')}
      ${lotus(150, 1060, 78, '#fb7185', '#fbbf24')}
      ${lotus(750, 1060, 78, '#e11d48', '#f6c453')}
      ${leaf(230, 120, -20, '#65a30d', 34, 11)}
      ${leaf(670, 120, 20, '#65a30d', 34, 11)}
      ${leaf(220, 1100, 24, '#84cc16', 32, 10)}
      ${leaf(680, 1100, -24, '#84cc16', 32, 10)}
      ${heart(450, 1088, 26, '#b91c1c')}
      ${bud(120, 280, -30, '#fda4af', 8, 16)}
      ${bud(780, 280, 30, '#fda4af', 8, 16)}
      ${bud(120, 920, 20, '#fb7185', 8, 16)}
      ${bud(780, 920, -20, '#fb7185', 8, 16)}
    `
  }
  if (id === 'envelope_wax') {
    return `
      <rect x="70" y="250" width="760" height="860" rx="18" fill="#f3ead7"/>
      <polygon points="70,270 450,640 830,270" fill="#e7d7bc"/>
      <polyline points="70,1080 450,760 830,1080" fill="none" stroke="#d6c4a8" stroke-width="3"/>
      <rect x="70" y="250" width="760" height="860" rx="18" fill="none" stroke="#c4b08a" stroke-width="4"/>
      ${leaf(120, 300, -40, '#a16207', 26, 8)}
      ${bud(160, 270, -18, '#b45309', 7, 14)}
      ${heart(200, 300, 16, '#9f1239', -12)}
      ${leaf(780, 300, 40, '#a16207', 26, 8)}
      ${bud(740, 270, 18, '#b45309', 7, 14)}
      ${heart(700, 300, 16, '#9f1239', 12)}
      ${leaf(140, 1040, 28, '#92400e', 30, 9)}
      ${leaf(760, 1040, -28, '#92400e', 30, 9)}
      ${heart(450, 1088, 22, '#9f1239')}
      ${bud(250, 1100, -10, '#d6c4a8', 8, 14)}
      ${bud(650, 1100, 10, '#d6c4a8', 8, 14)}
    `
  }
  if (id === 'polaroid') {
    return `
      <rect x="36" y="36" width="828" height="1128" rx="10" fill="#ffffff"/>
      <rect x="36" y="36" width="828" height="1128" rx="10" fill="none" stroke="#e7e5e4" stroke-width="2"/>
      ${heart(160, 1088, 22, '#fb7185', -8)}
      ${heart(740, 1088, 22, '#fb7185', 8)}
      ${leaf(210, 1104, -24, '#65a30d', 22, 8)}
      ${leaf(690, 1104, 24, '#65a30d', 22, 8)}
      ${bud(450, 1108, 0, '#fda4af', 8, 14)}
      ${rose(450, 1048, 16, '#fecdd3')}
    `
  }
  if (id === 'phoenix_pair') {
    const wing = (side) => {
      const edge = side < 0 ? 28 : 872
      const inward = -side
      const feathers = [0, 1, 2, 3]
        .map((i) => {
          const y = 240 + i * 90
          const len = 70 + (i % 2) * 24
          return `<ellipse cx="${edge + inward * (40 + i * 8)}" cy="${y}" rx="${len}" ry="16" fill="${i % 2 ? '#be123c' : '#9f1239'}" transform="rotate(${side * (28 + i * 6)} ${edge + inward * 40} ${y})"/>`
        })
        .join('')
      return `${feathers}
        <path d="M ${edge + inward * 20} 280 C ${edge + inward * 80} 340, ${edge + inward * 40} 520, ${edge + inward * 110} 700" fill="none" stroke="#f6c453" stroke-width="7" stroke-linecap="round"/>
        ${heart(edge + inward * 70, 200, 22, '#f6c453', side * 16)}`
    }
    return `
      ${wing(-1)}
      ${wing(1)}
      ${happiness(450, 1088, 92, '#9f1239')}
      ${leaf(300, 1100, -20, '#f6c453', 28, 9)}
      ${leaf(600, 1100, 20, '#f6c453', 28, 9)}
      ${bud(250, 1040, -16, '#fb7185', 7, 14)}
      ${bud(650, 1040, 16, '#fb7185', 7, 14)}
    `
  }
  if (id === 'calla') {
    return `
      <path d="M700 140 C 870 230, 890 560, 760 900 C 700 740, 650 500, 700 260 Z" fill="#f8fafc" stroke="#d6d3d1" stroke-width="3"/>
      <path d="M740 280 C 770 470, 758 690, 742 840" fill="none" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
      <path d="M760 180 C 820 150, 860 220, 800 280 C 760 250, 740 210, 760 180 Z" fill="#f8fafc" stroke="#e7e5e4" stroke-width="2"/>
      <path d="M748 880 C 770 1020, 700 1120, 620 1148" fill="none" stroke="#65a30d" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="590" cy="1140" rx="48" ry="16" fill="#84cc16" transform="rotate(-24 590 1140)"/>
      <ellipse cx="660" cy="1110" rx="36" ry="12" fill="#65a30d" transform="rotate(18 660 1110)"/>
      ${bud(640, 1040, -30, '#f8fafc', 12, 28)}
      ${leaf(560, 1160, -16, '#4d7c0f', 34, 11)}
      ${heart(120, 140, 26, '#e7e5e4', -10)}
      ${leaf(90, 200, -36, '#65a30d', 28, 9)}
      ${bud(150, 1080, 12, '#d6d3d1', 8, 16)}
      ${leaf(180, 1120, 20, '#84cc16', 26, 8)}
      <rect x="56" y="80" width="560" height="1040" rx="40" fill="none" stroke="#e7e5e4" stroke-width="8"/>
    `
  }
  if (id === 'dried_flowers') {
    const sprig = (x, y, rot) => `<g transform="rotate(${rot} ${x} ${y})">
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y - 160}" stroke="#92400e" stroke-width="3"/>
      <ellipse cx="${x - 22}" cy="${y - 70}" rx="18" ry="7" fill="#b45309" transform="rotate(-32 ${x - 22} ${y - 70})"/>
      <ellipse cx="${x + 18}" cy="${y - 110}" rx="16" ry="6" fill="#a8a29e" transform="rotate(28 ${x + 18} ${y - 110})"/>
      <ellipse cx="${x - 8}" cy="${y - 140}" rx="14" ry="6" fill="#d6c4a8" transform="rotate(-12 ${x - 8} ${y - 140})"/>
      <circle cx="${x + 6}" cy="${y - 168}" r="8" fill="#78716c"/>
      ${heart(x + 28, y - 48, 14, '#9f1239', 12)}
    </g>`
    return `
      <rect x="64" y="64" width="772" height="1072" rx="8" fill="none" stroke="#d6c4a8" stroke-width="6"/>
      ${sprig(150, 250, -8)}
      ${sprig(250, 200, 6)}
      ${sprig(750, 250, 10)}
      ${sprig(650, 200, -4)}
      ${sprig(170, 980, 172)}
      ${sprig(300, 1000, 186)}
      ${sprig(730, 980, 188)}
      ${sprig(600, 1000, 168)}
      ${bud(450, 1088, 0, '#a8a29e', 9, 18)}
      ${leaf(380, 1104, -20, '#92400e', 26, 8)}
      ${leaf(520, 1104, 20, '#92400e', 26, 8)}
      ${heart(450, 1148, 16, '#9f1239')}
    `
  }
  if (id === 'crest_seal') {
    return `
      <circle cx="450" cy="128" r="78" fill="none" stroke="#a16207" stroke-width="6"/>
      <circle cx="450" cy="128" r="58" fill="none" stroke="#fbbf24" stroke-width="3"/>
      ${heart(450, 128, 28, '#a16207')}
      ${leaf(360, 90, -40, '#65a30d', 36, 12)}
      ${leaf(540, 90, 40, '#65a30d', 36, 12)}
      ${leaf(340, 150, -70, '#84cc16', 28, 9)}
      ${leaf(560, 150, 70, '#84cc16', 28, 9)}
      ${bud(390, 60, -20, '#fde68a', 7, 14)}
      ${bud(510, 60, 20, '#fde68a', 7, 14)}
      <rect x="70" y="220" width="760" height="900" rx="16" fill="none" stroke="#a16207" stroke-width="4"/>
      <rect x="90" y="240" width="720" height="860" rx="10" fill="none" stroke="#fbbf24" stroke-width="8"/>
      ${heart(140, 280, 20, '#fbbf24', -16)}
      ${heart(760, 280, 20, '#fbbf24', 16)}
      ${leaf(120, 1040, 24, '#65a30d', 32, 10)}
      ${leaf(780, 1040, -24, '#65a30d', 32, 10)}
      ${rose(180, 1100, 18, '#f6c453')}
      ${rose(720, 1100, 18, '#f6c453')}
      ${heart(450, 1104, 24, '#a16207')}
    `
  }
  return ''
}

function extrasFor(id) {
  if (id === 'envelope_wax') {
    return `
      <circle cx="450" cy="430" r="58" fill="#9f1239"/>
      <circle cx="450" cy="430" r="40" fill="none" stroke="#f6c453" stroke-width="5"/>
      <circle cx="450" cy="430" r="9" fill="#f6c453"/>
    `
  }
  if (id === 'classic_red' || id === 'night_modern' || id === 'lotus_viet') {
    return ''
  }
  return ''
}

function ringColor(id) {
  if (id === 'night_modern') return 'rgba(251,191,36,0.9)'
  if (id === 'classic_red') return 'rgba(246,196,83,0.95)'
  if (id === 'polaroid') return 'rgba(255,255,255,1)'
  if (id === 'sage_garden') return 'rgba(4,120,87,0.85)'
  if (id === 'gold_luxury' || id === 'crest_seal') return 'rgba(161,98,7,0.9)'
  return 'rgba(255,255,255,0.94)'
}

mkdirSync(outDir, { recursive: true })

const assets = {}
for (const frame of frames) {
  const masked = bodyFor(frame.id)
  const picture = svg(frame.hole, masked, extrasFor(frame.id)).replace(
    ring(frame.hole),
    ring(frame.hole, ringColor(frame.id), frame.id === 'polaroid' ? 16 : 8),
  )
  const filePath = path.join(outDir, frame.file)
  const buf = await sharp(Buffer.from(picture)).webp({ lossless: true, effort: 4 }).toBuffer()
  writeFileSync(filePath, buf)
  assets[frame.id] = {
    src: `/wedding/covers/${frame.file}`,
    hole: holePct(frame.hole),
    panel: frame.panel,
    ink: frame.ink,
  }
  console.log(frame.file, buf.length)
}

const ts = `/** Sinh bởi scripts/build-wedding-cover-frames.mjs — đừng sửa tay. */
export type WeddingCoverFrameAsset = {
  src: string
  hole: { x: number; y: number; w: number; h: number }
  panel: string
  ink: 'dark' | 'light'
}

export const WEDDING_COVER_FRAME_ASSETS: Record<string, WeddingCoverFrameAsset> = ${JSON.stringify(assets, null, 2)}
`
writeFileSync(path.join(root, 'src', 'lib', 'wedding', 'wedding-cover-frame-assets.ts'), ts)
console.log('wrote', Object.keys(assets).length, 'frames')
