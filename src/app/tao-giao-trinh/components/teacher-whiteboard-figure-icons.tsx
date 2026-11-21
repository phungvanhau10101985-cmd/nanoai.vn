import type { ReactNode } from 'react'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Glyph({ children, tint }: { children: ReactNode; tint: string }) {
  return (
    <svg viewBox="0 0 24 24" className="mt-px h-5 w-5 shrink-0" style={{ color: tint }} aria-hidden>
      {children}
    </svg>
  )
}

function dot(cx: number, cy: number, r: number, fill: string) {
  return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill} stroke="none" />
}

export function FigureMenuIcon({ id }: { id: string }) {
  switch (id) {
    case 'spatial':
      return (
        <Glyph tint="#0369a1">
          <path d="M4 18 L12 21 L20 18 L12 15 Z" {...S} fill="#e0f2fe" />
          <path d="M12 15 V8 M4 18 L12 11 L20 18" {...S} />
          <path d="M8 13.5 Q12 8 16 13.5" {...S} />
        </Glyph>
      )
    case 'math-trig':
      return (
        <Glyph tint="#1d4ed8">
          <circle cx="12" cy="12" r="7" {...S} />
          <path d="M12 12 L17.2 8.2 M5 12 H19 M12 5 V19" {...S} />
          {dot(17.2, 8.2, 1.3, '#1d4ed8')}
        </Glyph>
      )
    case 'math-formula':
      return (
        <Glyph tint="#1e3a8a">
          <rect x="3.5" y="4" width="17" height="16" rx="2" {...S} fill="#eff6ff" />
          <path d="M7 15 L9.2 9 H11 L13.2 15 M8 13 H12.2" {...S} />
          <path d="M15 9.5 H18.2 M15 12.5 H18.2" {...S} />
        </Glyph>
      )
    case 'force':
      return (
        <Glyph tint="#b45309">
          <rect x="7" y="11" width="10" height="7" rx="1" {...S} fill="#ffedd5" />
          <path d="M4 18 H20 M12 11 V5 M12 5 L9.5 7.5 M12 5 L14.5 7.5 M17 14.5 H21 M21 14.5 L18.8 12.6 M21 14.5 L18.8 16.4" {...S} />
        </Glyph>
      )
    case 'circuit':
      return (
        <Glyph tint="#0369a1">
          <path d="M4 8 H8 V16 H4 M9 8 H15 L13 11 H17 L15 14 H9 M16 8 H20 V16 H16" {...S} />
          <path d="M5 10.5 V13.5 M6.4 12 H3.6" {...S} />
        </Glyph>
      )
    case 'ray':
      return (
        <Glyph tint="#7c3aed">
          <path d="M12 4 Q16 12 12 20 Q8 12 12 4" {...S} fill="#ede9fe" />
          <path d="M3 8 H9 M3 16 H9 M15 9.5 L21 7 M15 14.5 L21 17" {...S} />
        </Glyph>
      )
    case 'refraction':
      return (
        <Glyph tint="#0369a1">
          <path d="M3 14 H21" {...S} />
          <path d="M5 6 L12 14 L18 20" {...S} />
          {dot(12, 14, 1.4, '#0369a1')}
          <path d="M4 16 H20" {...S} stroke="#bae6fd" />
        </Glyph>
      )
    case 'field':
      return (
        <Glyph tint="#b91c1c">
          <rect x="4" y="8" width="7" height="8" rx="1" {...S} fill="#fee2e2" />
          <rect x="13" y="8" width="7" height="8" rx="1" {...S} fill="#dbeafe" />
          <path d="M6 6 Q12 3 18 6 M6 18 Q12 21 18 18" {...S} />
        </Glyph>
      )
    case 'phys-graph':
      return (
        <Glyph tint="#1d4ed8">
          <path d="M5 18 V5 M5 18 H20" {...S} />
          <path d="M6 15 L10 12 L14 13 L19 7" {...S} />
        </Glyph>
      )
    case 'wave':
      return (
        <Glyph tint="#0369a1">
          <path d="M3 12 Q6 6 9 12 T15 12 T21 12" {...S} />
          <path d="M3 17 H21" {...S} stroke="#bae6fd" />
        </Glyph>
      )
    case 'law-graph':
      return (
        <Glyph tint="#b45309">
          <path d="M5 18 V5 M5 18 H20" {...S} />
          <path d="M6 7 C10 7 11 16 19 17" {...S} />
        </Glyph>
      )
    case 'young':
      return (
        <Glyph tint="#6d28d9">
          <path d="M9 4 V9 M9 12 V15 M9 18 V20" {...S} />
          <path d="M4 8 L9 10.2 M4 16 L9 13.8" {...S} />
          <path d="M16 5 V19" {...S} strokeWidth={3} />
          <path d="M9.8 10.5 L16 7 M9.8 13.5 L16 17 M9.8 12 L16 12" {...S} />
        </Glyph>
      )
    case 'interfere':
      return (
        <Glyph tint="#0284c7">
          <path d="M3 16 Q8 13 12 16 T21 16" {...S} stroke="#7dd3fc" />
          {dot(8, 13, 1.5, '#0284c7')}
          {dot(16, 13, 1.5, '#0284c7')}
          <path d="M8 13 m-3.2 0 a3.2 2 0 1 0 6.4 0 M8 13 m-5.4 0 a5.4 3 0 1 0 10.8 0" {...S} />
          <path d="M16 13 m-3.2 0 a3.2 2 0 1 0 6.4 0" {...S} />
        </Glyph>
      )
    case 'experiment-phys':
      return (
        <Glyph tint="#c2410c">
          <path d="M4 18 H20 M5 18 C6 10 10 7 18 6" {...S} />
          {dot(18, 6, 1.7, '#c2410c')}
        </Glyph>
      )
    case 'formula-physics':
      return (
        <Glyph tint="#1e3a8a">
          <rect x="3.5" y="4" width="17" height="16" rx="2" {...S} fill="#eff6ff" />
          <path d="M7 15 V9 H10.2 M7 12 H9.6 M13 15 L15.2 9 H17.4" {...S} />
        </Glyph>
      )
    case 'constants':
      return (
        <Glyph tint="#334155">
          <rect x="4" y="4" width="16" height="16" rx="2" {...S} fill="#f8fafc" />
          <path d="M8 9 H16 M8 12 H16 M8 15 H13" {...S} />
        </Glyph>
      )
    case 'equation':
      return (
        <Glyph tint="#047857">
          <path d="M3 12 H8 M10 9 L14 12 L10 15 M16 12 H21" {...S} />
          {dot(6, 8.5, 1.2, '#047857')}
          {dot(18.5, 8.5, 1.2, '#059669')}
        </Glyph>
      )
    case 'structure':
      return (
        <Glyph tint="#0f766e">
          <path d="M8 15 L12 8 L16 15 M12 8 L12 16" {...S} />
          {dot(12, 8, 2.1, '#0f766e')}
          {dot(8, 15, 1.7, '#64748b')}
          {dot(16, 15, 1.7, '#64748b')}
          {dot(12, 17.2, 1.5, '#64748b')}
        </Glyph>
      )
    case 'atom':
      return (
        <Glyph tint="#b45309">
          <ellipse cx="12" cy="12" rx="8" ry="3.2" {...S} />
          <ellipse cx="12" cy="12" rx="3.2" ry="8" {...S} />
          {dot(12, 12, 2, '#b45309')}
          {dot(19.2, 12, 1.2, '#2563eb')}
        </Glyph>
      )
    case 'glass':
      return (
        <Glyph tint="#0369a1">
          <path d="M8 4 H16 L15 18 a3 3 0 0 1-6 0 Z" {...S} fill="#e0f2fe" />
          <path d="M9 12 H15" {...S} stroke="#38bdf8" />
        </Glyph>
      )
    case 'titration':
      return (
        <Glyph tint="#7c3aed">
          <path d="M9 3 H15 V8 L13 20 H11 L9 8 Z" {...S} fill="#f5f3ff" />
          <rect x="10.2" y="9" width="3.6" height="8" rx="0.4" fill="#a78bfa" stroke="none" />
          <path d="M10.2 13 H13.8" {...S} stroke="#ef4444" />
        </Glyph>
      )
    case 'chem-experiment':
      return (
        <Glyph tint="#047857">
          <path d="M7 9 H17 V16 a5 5 0 0 1-10 0 Z" {...S} fill="#ecfdf5" />
          <path d="M10 6 V11 M14 6 V11" {...S} />
          {dot(10, 14, 1, '#34d399')}
          {dot(14, 15.5, 1, '#34d399')}
        </Glyph>
      )
    case 'chem-scheme':
      return (
        <Glyph tint="#be123c">
          <path d="M4 14 H20" {...S} />
          <rect x="4" y="8" width="4" height="4" fill="#ef4444" stroke="none" />
          <rect x="8" y="8" width="4" height="4" fill="#facc15" stroke="none" />
          <rect x="12" y="8" width="4" height="4" fill="#4ade80" stroke="none" />
          <rect x="16" y="8" width="4" height="4" fill="#3b82f6" stroke="none" />
        </Glyph>
      )
    case 'periodic':
      return (
        <Glyph tint="#334155">
          <rect x="3" y="4" width="4" height="4" {...S} fill="#fee2e2" />
          <rect x="17" y="4" width="4" height="4" {...S} fill="#dbeafe" />
          <rect x="3" y="10" width="4" height="4" {...S} fill="#ffedd5" />
          <rect x="8" y="10" width="4" height="4" {...S} />
          <rect x="13" y="10" width="4" height="4" {...S} fill="#dcfce7" />
          <rect x="17" y="10" width="4" height="4" {...S} fill="#ede9fe" />
          <rect x="3" y="16" width="18" height="4" {...S} fill="#f1f5f9" />
        </Glyph>
      )
    case 'formula-chem':
      return (
        <Glyph tint="#047857">
          <rect x="3.5" y="4" width="17" height="16" rx="2" {...S} fill="#ecfdf5" />
          <path d="M8 10 H12 M7 15 H13 M10 8.5 V16.5 M16 10 V15" {...S} />
        </Glyph>
      )
    case 'cell':
      return (
        <Glyph tint="#15803d">
          <ellipse cx="12" cy="12" rx="8" ry="6.5" {...S} fill="#f0fdf4" />
          {dot(12, 12, 2.4, '#86efac')}
          <circle cx="12" cy="12" r="2.4" {...S} />
        </Glyph>
      )
    case 'division':
      return (
        <Glyph tint="#15803d">
          <circle cx="8" cy="12" r="4.2" {...S} fill="#f0fdf4" />
          <circle cx="16" cy="12" r="4.2" {...S} fill="#f0fdf4" />
          <path d="M11.2 12 H12.8" {...S} />
        </Glyph>
      )
    case 'genetic':
      return (
        <Glyph tint="#7c3aed">
          <path d="M9 4 C9 8 15 8 15 12 C15 16 9 16 9 20" {...S} />
          <path d="M15 4 C15 8 9 8 9 12 C9 16 15 16 15 20" {...S} />
          <path d="M9.4 8 H14.6 M9.4 12 H14.6 M9.4 16 H14.6" {...S} />
        </Glyph>
      )
    case 'pedigree':
      return (
        <Glyph tint="#334155">
          <rect x="4" y="4" width="5" height="5" {...S} />
          <circle cx="17" cy="6.5" r="2.5" {...S} />
          <path d="M6.5 9 V12 H17 V9 M11.5 12 V15" {...S} />
          <circle cx="8" cy="18" r="2.2" {...S} fill="#e2e8f0" />
          <rect x="14" y="15.8" width="4.4" height="4.4" {...S} fill="#334155" />
        </Glyph>
      )
    case 'punnett':
      return (
        <Glyph tint="#1d4ed8">
          <path d="M7 5 V19 M13 5 V19 M17 5 V19 M7 9 H17 M7 14 H17" {...S} />
        </Glyph>
      )
    case 'ecology':
      return (
        <Glyph tint="#15803d">
          {dot(12, 6, 2, '#86efac')}
          {dot(6, 16, 2, '#fdba74')}
          {dot(18, 16, 2, '#93c5fd')}
          <path d="M12 8 L7 14 M12 8 L17 14 M8 16 H16" {...S} />
        </Glyph>
      )
    case 'bio-graph':
      return (
        <Glyph tint="#15803d">
          <path d="M5 18 V5 M5 18 H20" {...S} />
          <path d="M6 16 C9 16 10 8 13 8 C16 8 17 7 19 6.5" {...S} />
        </Glyph>
      )
    case 'formula-bio':
      return (
        <Glyph tint="#166534">
          <rect x="3.5" y="4" width="17" height="16" rx="2" {...S} fill="#f0fdf4" />
          <path d="M7 15 V10 H10 M13 15 C15 15 16 13.5 16 12 C16 10.5 15 9 13 9" {...S} />
        </Glyph>
      )
    default:
      return (
        <Glyph tint="#64748b">
          <rect x="5" y="5" width="14" height="14" rx="2" {...S} />
        </Glyph>
      )
  }
}
