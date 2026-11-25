import { canonicalGradeLevelId } from '../curriculum-subjects'

export const FIGURE_BANDS = [
  'mn', 'p12', 'p3', 'p45',
  'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12',
  'voc', 'uni',
] as const

export type FigureBand = (typeof FIGURE_BANDS)[number]

export type FigureScope = 'band' | 'stage' | 'all'

const G = (...bands: FigureBand[]) => bands

const ITEM_GRADES: Record<string, FigureBand[]> = {
  'math-trig': G('g10', 'g11'),
  spatial: G('uni'),
  'math-geometry': G('g8', 'g9'),
  circuit: G('g7', 'g8', 'g11', 'voc'),
  force: G('g6', 'g10', 'voc'),
  ray: G('g8', 'g9', 'g11'),
  mirror: G('g7', 'g11'),
  'phys-graph': G('g10'),
  wave: G('g11'),
  refraction: G('g7', 'g9', 'g11'),
  tir: G('g11'),
  slab: G('g11'),
  eye: G('g9', 'g11'),
  diffract: G('g12'),
  spectrum: G('g12'),
  standing: G('g11'),
  meters: G('g8', 'g11', 'voc'),
  radiation: G('g12'),
  transformer: G('g9', 'g11'),
  buoyancy: G('g8', 'voc'),
  photoelectric: G('g12'),
  interfere: G('g11', 'g12'),
  young: G('g12'),
  'experiment-phys': G('g10'),
  constants: G('g10', 'g11', 'g12'),
  equation: G('g8', 'g9', 'g10'),
  structure: G('g8', 'g10', 'g11'),
  glass: G('g6', 'g8', 'g10', 'voc'),
  atom: G('g8', 'g10'),
  periodic: G('g8', 'g10', 'voc'),
  titration: G('g8'),
  'chem-experiment': G('g8', 'g9'),
  distill: G('g6', 'g8', 'voc'),
  gaslab: G('g9'),
  filter: G('g6', 'g8', 'voc'),
  galvanic: G('g12'),
  rate: G('g10'),
  'bio-graph': G('g12'),
  ecology: G('g8', 'g11', 'g12'),
  division: G('g9', 'g12'),
  cell: G('g6', 'g10'),
  pedigree: G('g9', 'g12'),
  osmosis: G('g10', 'g11'),
  photo: G('g7', 'g11'),
  slide: G('g6', 'g10'),
  blood: G('g8', 'g11'),
  reflex: G('g7', 'g11'),
  'count-set': G('mn', 'p12'),
  'base-ten': G('p12'),
  'bar-model': G('p12', 'p3'),
  'fraction-disc': G('p3', 'p45'),
  'measure-units': G('p3'),
  'percent-bar': G('p45'),
  'bar-chart': G('p45', 'g6'),
  'mirror-symmetry': G('p45'),
  venn: G('g6'),
  congruence: G('g7'),
  proportion: G('g7'),
  'algebra-tile': G('g8'),
  thales: G('g8'),
  similar: G('g8'),
  'pythagoras-fig': G('g8', 'g9'),
  'circle-angles': G('g9'),
  chance: G('g9', 'g10'),
  'vector-add': G('g10'),
  'half-plane': G('g10'),
  'sequence-line': G('g11'),
  'tangent-graph': G('g11', 'g12'),
  'space-line-plane': G('g11'),
  'cross-section': G('g11'),
  asymptote: G('g12'),
  'variation-table': G('g12'),
  'integral-area': G('g12'),
  projection: G('voc'),
  'complex-plane': G('uni'),
  'slope-field': G('uni'),
  'polar-curve': G('uni'),
  'measure-lab': G('g6'),
  states: G('g6'),
  shadow: G('g6'),
  'energy-flow': G('g6'),
  'simple-machine': G('g7', 'g9'),
  communicating: G('g7'),
  'phase-temp': G('g8'),
  electromagnet: G('g8'),
  'home-wire': G('g9'),
  'circular-motion': G('g10'),
  collision: G('g10'),
  torque: G('g10'),
  hooke: G('g10'),
  'sound-wave': G('g11'),
  capacitor: G('g11'),
  solenoid: G('g11'),
  induction: G('g11'),
  'ac-circuit': G('g12'),
  nuclear: G('g12'),
  'thermo-path': G('g12'),
  diode: G('uni'),
  separate: G('g6', 'g8'),
  'compound-class': G('g8'),
  'ion-test': G('g9'),
  rust: G('g9'),
  shells: G('g10'),
  redox: G('g10'),
  lechatelier: G('g10'),
  'titration-curve': G('g11'),
  'electrolysis-solution': G('g11', 'g12'),
  isomer: G('g11'),
  hydrocarbon: G('g11'),
  'org-reaction': G('g11'),
  biomolecule: G('g12'),
  'electro-series': G('g12'),
  industry: G('g12'),
  'kinetics-plot': G('uni'),
  kingdoms: G('g6'),
  'flowering-plant': G('g6'),
  pollination: G('g7'),
  'sex-chromosome': G('g8'),
  'carbon-cycle': G('g8', 'g12'),
  microbe: G('g10'),
  organelles: G('g10'),
  enzyme: G('g10'),
  transpiration: G('g11'),
  crossover: G('g12'),
  mutation: G('g12'),
  selection: G('g12'),
  succession: G('g12'),
  'pcr-gel': G('g12'),
  ferment: G('voc'),
  'central-dogma': G('uni'),
}

const VARIANT_GRADES: Record<string, Record<string, FigureBand[]>> = {
  'math-graph': {
    parabola: G('g9'),
    line: G('g9'),
    sine: G('g10'),
  },
  field: {
    electric: G('g11'),
    magnet: G('g6', 'g11'),
    wire: G('g11'),
  },
  'law-graph': {
    decay: G('g12'),
    gas: G('g12'),
    motion: G('g7', 'g10'),
  },
  'chem-scheme': {
    energy: G('g10'),
    ph: G('g8', 'g11'),
    activity: G('g9', 'g10'),
  },
  genetic: {
    dna: G('g9', 'g10'),
    codon: G('g12'),
  },
  punnett: {
    mono: G('g9', 'g12'),
    test: G('g9', 'g12'),
    dihybrid: G('g12'),
  },
  'number-line': {
    ten: G('p12'),
    hundred: G('p12'),
    fraction: G('p45'),
    decimal: G('p45'),
    integer: G('g6'),
  },
  clock: {
    hour: G('p12'),
    half: G('p12'),
    minute: G('p3'),
  },
  'line-pair': {
    perpendicular: G('p45'),
    transversal: G('g7'),
  },
  'stats-chart': {
    histogram: G('g10'),
    box: G('g10'),
    binomial: G('g12'),
    normal: G('g12'),
  },
  'body-system': {
    digest: G('g6'),
    circulation: G('g6'),
    heart: G('g11'),
    alveoli: G('g11'),
    nephron: G('g11'),
    synapse: G('g11'),
    hormone: G('g11'),
    immune: G('g11'),
  },
  'photo-resp': {
    photo: G('g7'),
    resp: G('g7'),
    'light-dark': G('g10'),
    aerobic: G('g10'),
  },
  'math-formula': {
    pythagoras: G('g8', 'g9'),
    'square-sum': G('g8'),
    'square-diff': G('g8'),
    'diff-squares': G('g8'),
    'cube-sum': G('g8'),
    linear: G('g8', 'g9'),
    quadratic: G('g9'),
    vieta: G('g9'),
    identity: G('g10', 'g11'),
    'sin-sum': G('g10', 'g11'),
    tan: G('g10', 'g11'),
    area: G('p45'),
    'tri-area': G('p45'),
    'tri-sin': G('g10'),
    trapezoid: G('p45'),
    rect: G('p3', 'p45'),
    sphere: G('g9', 'g12'),
    cylinder: G('g9', 'g12'),
    cone: G('g9', 'g12'),
    distance: G('g10'),
    slope: G('g10'),
    'circle-eq': G('g10'),
    arith: G('g11'),
    geom: G('g11'),
    'sum-arith': G('g11'),
    log: G('g12'),
    deriv: G('g11', 'g12'),
    integral: G('g12'),
    choose: G('g10'),
    prob: G('g10'),
  },
  'formula-physics': {
    velocity: G('g7', 'g10'),
    accel: G('g10'),
    motion: G('g10'),
    newton: G('g10'),
    weight: G('g8', 'g10'),
    momentum: G('g10'),
    work: G('g8', 'g10'),
    power: G('g8', 'g10'),
    kinetic: G('g8', 'g10'),
    potential: G('g8', 'g10'),
    friction: G('g8', 'g10'),
    density: G('g6'),
    pressure: G('g8'),
    ohm: G('g8', 'g9', 'g11'),
    series: G('g8', 'g9', 'g11'),
    parallel: G('g8', 'g9', 'g11'),
    current: G('g8', 'g9', 'g11'),
    joule: G('g8', 'g9', 'g11'),
    'electric-power': G('g9'),
    heat: G('g8'),
    wave: G('g11'),
    frequency: G('g11'),
    period: G('g10'),
    lens: G('g11'),
    snell: G('g11'),
    coulomb: G('g11'),
    gas: G('g12'),
    energy: G('g12'),
    efficiency: G('g9', 'g10'),
  },
  'formula-chem': {
    mole: G('g10'),
    count: G('g10'),
    volume: G('g10'),
    conc: G('g10'),
    percent: G('g10'),
    convert: G('g10'),
    dilute: G('g10'),
    density: G('g10'),
    yield: G('g10'),
    element: G('g10'),
    ph: G('g11'),
    poh: G('g11'),
    'ph-sum': G('g11'),
    kw: G('g11'),
    ka: G('g11'),
    buffer: G('g11'),
    rate: G('g10'),
    kc: G('g10'),
    gas: G('g10', 'g12'),
    electro: G('g12'),
    alpha: G('g11'),
    titrate: G('g11'),
  },
  'formula-bio': {
    hardy: G('g12'),
    growth: G('g12'),
  },
}

export function figureBandOf(id: string): FigureBand | null {
  const key = canonicalGradeLevelId(String(id || '').trim())
  if (!key) return null
  if (key.startsWith('nha-tre') || key.startsWith('mau-giao')) return 'mn'
  if (key === 'hoc-nghe' || key === 'trung-cap' || key === 'cao-dang') return 'voc'
  if (key === 'dai-hoc' || key === 'cao-hoc' || key === 'tien-si') return 'uni'
  const lop = /^lop-(\d+)$/.exec(key)
  if (!lop) return null
  const n = Number(lop[1])
  if (n <= 2) return 'p12'
  if (n === 3) return 'p3'
  if (n <= 5) return 'p45'
  if (n >= 6 && n <= 12) return `g${n}` as FigureBand
  return null
}

export function figureStageOf(band: FigureBand): FigureBand[] {
  if (band === 'mn') return ['mn']
  if (band === 'p12' || band === 'p3' || band === 'p45') return ['p12', 'p3', 'p45']
  if (band === 'g6' || band === 'g7' || band === 'g8' || band === 'g9') return ['g6', 'g7', 'g8', 'g9']
  if (band === 'g10' || band === 'g11' || band === 'g12') return ['g10', 'g11', 'g12']
  if (band === 'voc') return ['g8', 'g9', 'g10', 'g11', 'g12', 'voc']
  return ['g10', 'g11', 'g12', 'uni']
}

export function defaultFigureScope(band: FigureBand | null): FigureScope {
  if (!band) return 'all'
  if (band === 'voc' || band === 'uni') return 'stage'
  return 'band'
}

export function figureShown(grades: readonly FigureBand[] | undefined, band: FigureBand | null, scope: FigureScope) {
  if (scope === 'all' || band == null) return true
  if (!grades?.length) return false
  if (scope === 'band') return grades.includes(band)
  const stage = new Set(figureStageOf(band))
  return grades.some((grade) => stage.has(grade))
}

type Graded = {
  id: string
  grades?: FigureBand[]
  menu?: boolean
  variants?: { id: string; menu?: boolean; grades?: FigureBand[] }[]
}

export function stampFigureGrades<T extends Graded>(items: T[]): T[] {
  for (const item of items) {
    const variants = item.variants ?? []
    if (variants.length) {
      const set = new Set<FigureBand>()
      for (const variant of variants) {
        const grades = VARIANT_GRADES[item.id]?.[variant.id] ?? ITEM_GRADES[item.id] ?? []
        variant.grades = grades
        for (const grade of grades) set.add(grade)
      }
      item.grades = [...set]
    } else {
      item.grades = ITEM_GRADES[item.id] ?? []
    }
  }
  return items
}

export function missingGradeAssignments(items: readonly Graded[]) {
  const missing: string[] = []
  for (const item of items) {
    if (!item.grades?.length) missing.push(item.id)
    for (const variant of item.variants ?? []) {
      if (!variant.grades?.length) missing.push(`${item.id}:${variant.id}`)
    }
  }
  return missing
}

export function figureItemVisible(item: Graded, band: FigureBand | null, scope: FigureScope) {
  if (item.menu === false) return false
  const variants = (item.variants ?? []).filter((entry) => entry.menu !== false)
  if (!variants.length) return figureShown(item.grades, band, scope)
  return variants.some((entry) => figureShown(entry.grades ?? item.grades, band, scope))
}
