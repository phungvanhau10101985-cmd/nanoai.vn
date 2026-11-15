import type { WebLocale } from '@/lib/i18n/config'

export type BoxDielineStructure =
  | 'straight_tuck'
  | 'reverse_tuck'
  | 'crash_lock'
  | 'snap_lock'
  | 'telescope'
  | 'magnetic'
  | 'sleeve_tray'
  | 'handle'
  | 'window'
  | 'tray'
  | 'hexagon'
  | 'octagon'
  | 'pillow'
  | 'tube'
  | 'bottle'
  | 'insert'
  | 'cross_fold'

export type BoxDielineGroupId = 'tuck' | 'lock' | 'rigid' | 'drawer' | 'special' | 'insert'

/** Bản lưu trước đây ghi straight_tuck cho kiểu thực ra là reverse tuck. */
export const DIELINE_STRUCTURE_VERSION = 2

export const BOX_DIELINE_GROUPS: { id: BoxDielineGroupId; structures: BoxDielineStructure[] }[] = [
  { id: 'tuck', structures: ['straight_tuck', 'reverse_tuck'] },
  { id: 'lock', structures: ['crash_lock', 'snap_lock'] },
  { id: 'rigid', structures: ['telescope', 'magnetic'] },
  { id: 'drawer', structures: ['sleeve_tray', 'handle', 'window'] },
  { id: 'special', structures: ['tray', 'hexagon', 'octagon', 'pillow', 'tube', 'bottle', 'cross_fold'] },
  { id: 'insert', structures: ['insert'] },
]

export const BOX_DIELINE_STRUCTURE_KEYS: BoxDielineStructure[] = BOX_DIELINE_GROUPS.flatMap(
  (group) => group.structures
)

export const DEFAULT_BOX_DIELINE_STRUCTURE: BoxDielineStructure = 'reverse_tuck'

const GROUP_LABEL: Record<WebLocale, Record<BoxDielineGroupId, string>> = {
  vi: {
    tuck: 'Hộp nắp gài',
    lock: 'Hộp đáy khóa',
    rigid: 'Hộp hai mảnh và hộp cứng',
    drawer: 'Ngăn kéo và tay xách',
    special: 'Hộp đặc thù',
    insert: 'Phụ kiện',
  },
  en: {
    tuck: 'Tuck-end boxes',
    lock: 'Lock-bottom boxes',
    rigid: 'Two-piece and rigid',
    drawer: 'Drawer and handle',
    special: 'Speciality',
    insert: 'Accessory',
  },
  zh: {
    tuck: '插舌盒',
    lock: '锁底盒',
    rigid: '两片与精装',
    drawer: '抽屉与提手',
    special: '异形盒',
    insert: '内衬',
  },
  ja: {
    tuck: '差し込み蓋',
    lock: 'ロック底',
    rigid: '身蓋・貼箱',
    drawer: '引き出し・取っ手',
    special: '特殊形状',
    insert: '中仕切り',
  },
  ko: {
    tuck: '꽂이 뚜껑',
    lock: '잠금 바닥',
    rigid: '2피스·싸바리',
    drawer: '서랍·손잡이',
    special: '특수 상자',
    insert: '속지',
  },
}

const COPY: Record<WebLocale, Record<BoxDielineStructure, { label: string; description: string }>> = {
  vi: {
    straight_tuck: {
      label: 'Nắp gài thẳng',
      description: 'Nắp và đáy gài cùng một phía (straight tuck end).',
    },
    reverse_tuck: {
      label: 'Nắp gài ngược',
      description: 'Nắp và đáy gài hai phía đối nhau (reverse tuck end).',
    },
    crash_lock: {
      label: 'Đáy khóa tự động',
      description: 'Crash lock / auto-bottom, chịu hàng nặng hơn đáy gài.',
    },
    snap_lock: {
      label: 'Đáy khóa 1-2-3',
      description: 'Ba bước gấp đáy rồi bật khóa (snap lock).',
    },
    telescope: {
      label: 'Hộp âm dương',
      description: 'Nắp rời và đáy rời, hợp hộp quà như hộp yến.',
    },
    magnetic: {
      label: 'Hộp nắp nam châm',
      description: 'Nắp gập dính liền, có vùng trống để dán nam châm.',
    },
    sleeve_tray: {
      label: 'Hộp kéo',
      description: 'Ống sleeve và khay trượt bên trong.',
    },
    handle: {
      label: 'Hộp có quai xách',
      description: 'Nắp gài ngược kèm quai xách có lỗ khoét.',
    },
    window: {
      label: 'Hộp có cửa sổ',
      description: 'Nắp gài ngược, cửa sổ mặt trước để dán film trong.',
    },
    tray: {
      label: 'Khay gấp',
      description: 'Hộp khay thành thấp, kiểu hộp bánh.',
    },
    hexagon: {
      label: 'Hộp lục giác',
      description: 'Ống 6 cạnh, kích thước L là khoảng cách hai mặt đối diện.',
    },
    octagon: {
      label: 'Hộp bát giác',
      description: 'Ống 8 cạnh, kích thước L là khoảng cách hai mặt đối diện.',
    },
    pillow: {
      label: 'Hộp gối',
      description: 'Một mảnh, hai đầu cong, dán một mép dài.',
    },
    tube: {
      label: 'Hộp nắp ống tròn',
      description: 'Thân ống theo chu vi và hai nắp tròn rời.',
    },
    bottle: {
      label: 'Hộp đựng chai',
      description: 'Nắp gài ngược, lỗ cổ chai trên nắp.',
    },
    insert: {
      label: 'Lót chia ô',
      description: 'Vách lồng nhau để giữ hũ, dùng kèm hộp yến.',
    },
    cross_fold: {
      label: 'Chữ thập — gấp tay',
      description: 'Các mặt xếp chữ thập, nhiều tai dán, sản lượng nhỏ.',
    },
  },
  en: {
    straight_tuck: {
      label: 'Straight tuck end',
      description: 'Lid and base tuck from the same side.',
    },
    reverse_tuck: {
      label: 'Reverse tuck end',
      description: 'Lid and base tuck from opposite sides.',
    },
    crash_lock: {
      label: 'Auto-lock bottom',
      description: 'Crash lock / auto-bottom for heavier fills.',
    },
    snap_lock: {
      label: '1-2-3 snap lock',
      description: 'Three-step bottom that snaps shut.',
    },
    telescope: {
      label: 'Telescope box',
      description: 'Separate lid and base. A usual gift box, including bird’s-nest packs.',
    },
    magnetic: {
      label: 'Magnetic lid',
      description: 'Hinged lid with an unprinted patch for the magnet.',
    },
    sleeve_tray: {
      label: 'Sleeve and tray',
      description: 'Outer sleeve with a sliding inner tray.',
    },
    handle: {
      label: 'Handle box',
      description: 'Reverse tuck with a carrying handle and hand hole.',
    },
    window: {
      label: 'Window box',
      description: 'Reverse tuck with a front window for a clear film.',
    },
    tray: {
      label: 'Tray',
      description: 'Open folding tray, as for cakes or a shallow base.',
    },
    hexagon: {
      label: 'Hexagon box',
      description: 'Six-side tube. L is the flat-to-flat width.',
    },
    octagon: {
      label: 'Octagon box',
      description: 'Eight-side tube. L is the flat-to-flat width.',
    },
    pillow: {
      label: 'Pillow box',
      description: 'One piece with curved ends and one long glue flap.',
    },
    tube: {
      label: 'Round tube',
      description: 'Wrapped tube plus two separate round lids.',
    },
    bottle: {
      label: 'Bottle box',
      description: 'Reverse tuck with a neck opening in the top.',
    },
    insert: {
      label: 'Cell insert',
      description: 'Interlocking dividers that hold jars inside a gift box.',
    },
    cross_fold: {
      label: 'Cross net — hand fold',
      description: 'Cross-arranged faces with several glue tabs for short runs.',
    },
  },
  zh: {
    straight_tuck: { label: '同向插舌', description: '盖和底从同一侧插入。' },
    reverse_tuck: { label: '反向插舌', description: '盖和底从相反两侧插入。' },
    crash_lock: { label: '自动锁底', description: '撞底 / 自动锁底，适合较重的内容物。' },
    snap_lock: { label: '1-2-3 锁底', description: '三步折底后扣合。' },
    telescope: { label: '天地盖', description: '盖和底分开，适合燕窝礼盒。' },
    magnetic: { label: '磁吸翻盖', description: '连体翻盖，留白处贴磁铁。' },
    sleeve_tray: { label: '抽屉盒', description: '外套筒加内抽盒。' },
    handle: { label: '手提盒', description: '反向插舌加提手孔。' },
    window: { label: '开窗盒', description: '反向插舌，正面开窗贴透明膜。' },
    tray: { label: '折边托盘', description: '浅盘，适合点心盒。' },
    hexagon: { label: '六角盒', description: '六边管。L 为对边距。' },
    octagon: { label: '八角盒', description: '八边管。L 为对边距。' },
    pillow: { label: '枕头盒', description: '单片，两端圆弧，一条长粘口。' },
    tube: { label: '圆管盒', description: '管身加两片圆盖。' },
    bottle: { label: '酒瓶盒', description: '反向插舌，顶面开瓶颈孔。' },
    insert: { label: '分格内衬', description: '交叉隔板，用来固定瓶子。' },
    cross_fold: { label: '十字手工盒', description: '十字排版，多个粘口，适合小批量。' },
  },
  ja: {
    straight_tuck: { label: 'ストレートタック', description: '蓋と底を同じ側から差し込みます。' },
    reverse_tuck: { label: 'リバースタック', description: '蓋と底を反対側から差し込みます。' },
    crash_lock: { label: 'クラッシュ底', description: '自動ロック底。重い中身向けです。' },
    snap_lock: { label: '1-2-3 スナップ底', description: '3工程で折って底を留めます。' },
    telescope: { label: '身蓋箱', description: '蓋と身が別。ギフトやツバメの巣の箱向け。' },
    magnetic: { label: 'マグネット蓋', description: '一体の観音蓋。磁石を貼る余白付き。' },
    sleeve_tray: { label: '引き出し箱', description: 'スリーブと中皿。' },
    handle: { label: '手提げ箱', description: 'リバースタックに持ち手穴。' },
    window: { label: '窓付き箱', description: '正面に窓。透明フィルムを貼ります。' },
    tray: { label: 'トレー', description: '浅い折りトレー。菓子箱向け。' },
    hexagon: { label: '六角箱', description: '六角筒。L は対面の幅です。' },
    octagon: { label: '八角箱', description: '八角筒。L は対面の幅です。' },
    pillow: { label: 'ピロー箱', description: '両端が曲線の一枚もの。' },
    tube: { label: '円筒箱', description: '胴と丸い蓋2枚。' },
    bottle: { label: 'ボトル箱', description: '天面にボトル首の穴。' },
    insert: { label: '仕切り', description: '瓶を固定する交差仕切り。' },
    cross_fold: { label: '十字・手折り', description: '十字配置で糊しろが複数。小ロット向け。' },
  },
  ko: {
    straight_tuck: { label: '스트레이트 턱', description: '뚜껑과 바닥이 같은 쪽에서 끼워집니다.' },
    reverse_tuck: { label: '리버스 턱', description: '뚜껑과 바닥이 반대쪽에서 끼워집니다.' },
    crash_lock: { label: '자동 잠금 바닥', description: '크래시 락. 무거운 내용물에 맞습니다.' },
    snap_lock: { label: '1-2-3 스냅 락', description: '세 번 접어 바닥을 잠급니다.' },
    telescope: { label: '뚜껑·몸 분리', description: '뚜껑과 바닥이 따로입니다. 선물·연와 상자에 맞습니다.' },
    magnetic: { label: '자석 뚜껑', description: '연결된 뚜껑. 자석을 붙일 여백이 있습니다.' },
    sleeve_tray: { label: '서랍 상자', description: '슬리브와 슬라이드 트레이.' },
    handle: { label: '손잡이 상자', description: '리버스 턱에 손잡이 구멍.' },
    window: { label: '창 상자', description: '앞면에 창. 투명 필름을 붙입니다.' },
    tray: { label: '트레이', description: '낮은 접이식 트레이. 과자 상자.' },
    hexagon: { label: '육각 상자', description: '6각 튜브. L은 맞변 거리입니다.' },
    octagon: { label: '팔각 상자', description: '8각 튜브. L은 맞변 거리입니다.' },
    pillow: { label: '필로우 상자', description: '양쪽이 곡선인 한 장짜리.' },
    tube: { label: '원통 상자', description: '몸통과 둥근 뚜껑 두 장.' },
    bottle: { label: '보틀 상자', description: '윗면에 병 목 구멍.' },
    insert: { label: '칸막이', description: '병을 고정하는 교차 칸막이.' },
    cross_fold: { label: '십자 수접기', description: '십자 배치와 여러 접착날개. 소량용.' },
  },
}

const SLUG: Record<BoxDielineStructure, string> = {
  straight_tuck: 'straight-tuck',
  reverse_tuck: 'reverse-tuck',
  crash_lock: 'crash-lock',
  snap_lock: 'snap-lock',
  telescope: 'telescope',
  magnetic: 'magnetic-lid',
  sleeve_tray: 'sleeve-tray',
  handle: 'handle',
  window: 'window',
  tray: 'tray',
  hexagon: 'hexagon',
  octagon: 'octagon',
  pillow: 'pillow',
  tube: 'tube',
  bottle: 'bottle',
  insert: 'insert',
  cross_fold: 'cross-fold',
}

export function boxDielineGroupLabel(groupId: BoxDielineGroupId, locale: WebLocale): string {
  return GROUP_LABEL[locale][groupId]
}

export function boxDielineStructureCopy(
  structure: BoxDielineStructure,
  locale: WebLocale
): { label: string; description: string } {
  return COPY[locale][structure]
}

export function boxDielineStructureSlug(structure: BoxDielineStructure): string {
  return SLUG[structure]
}

export function structureUsesBodyStrip(structure: BoxDielineStructure): boolean {
  return (
    structure === 'straight_tuck' ||
    structure === 'reverse_tuck' ||
    structure === 'crash_lock' ||
    structure === 'snap_lock' ||
    structure === 'window' ||
    structure === 'handle' ||
    structure === 'bottle'
  )
}

export function packagingDielineIsReady(
  packaging?: {
    dielineUrl?: string
    dielineVariants?: Partial<Record<BoxDielineStructure, { url: string; fileName?: string }>>
  } | null
): boolean {
  if (!packaging) return false
  if (packaging.dielineUrl) return true
  const variants = packaging.dielineVariants
  if (!variants) return false
  return Object.values(variants).some((item) => Boolean(item?.url))
}

export function parseBoxDielineStructure(raw: string | null | undefined): BoxDielineStructure | null {
  const value = String(raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (BOX_DIELINE_STRUCTURE_KEYS.includes(value.replace(/-/g, '_') as BoxDielineStructure)) {
    return value.replace(/-/g, '_') as BoxDielineStructure
  }
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) return null
  if (/crash|auto-?bottom|tự động|tu dong|自动锁|クラッシュ|크래시/.test(text)) return 'crash_lock'
  if (/snap|1-2-3|một hai ba|锁底|スナップ|스냅/.test(text)) return 'snap_lock'
  if (/âm dương|am duong|telescope|天地|身蓋|뚜껑·몸|gift lid/.test(text)) return 'telescope'
  if (/nam châm|nam cham|magnet|磁吸|マグネット|자석/.test(text)) return 'magnetic'
  if (/sleeve|ngăn kéo|ngan keo|抽屉|引き出し|서랍/.test(text)) return 'sleeve_tray'
  if (/quai|handle|手提|取っ手|손잡이/.test(text)) return 'handle'
  if (/cửa sổ|cua so|window|开窗|窓/.test(text)) return 'window'
  if (/lục giác|luc giac|hexagon|六角|육각/.test(text)) return 'hexagon'
  if (/bát giác|bat giac|octagon|八角|팔각/.test(text)) return 'octagon'
  if (/pillow|gối|goi|枕头|ピロー|필로우/.test(text)) return 'pillow'
  if (/ống tròn|ong tron|tube|圆管|円筒|원통/.test(text)) return 'tube'
  if (/chai|bottle|瓶颈|ボトル|보틀/.test(text)) return 'bottle'
  if (/insert|lót|lot trong|内衬|仕切り|칸막이|yến|yen/.test(text)) return 'insert'
  if (/khay|tray|托盘|トレー|트레이/.test(text)) return 'tray'
  if (/chữ thập|chu thap|cross(?:\s|-)?(?:net|fold)?|十字|수작업|십자/.test(text)) return 'cross_fold'
  if (/reverse|ngược|nguoc|反向|リバー|리버스/.test(text)) return 'reverse_tuck'
  if (/straight|thẳng|thang|同向|ストレート|스트레이트/.test(text)) return 'straight_tuck'
  if (/dải ngang|dai ngang|horizontal|sản xuất máy|machine/.test(text)) return 'reverse_tuck'
  return null
}

/**
 * Phiên cũ không có version: khóa `straight_tuck` là file reverse tuck bị đặt sai tên.
 * Version 2 trở đi, `straight_tuck` là nắp gài thẳng đúng nghĩa.
 */
export function resolveBoxDielineStructure(
  structure: string | null | undefined,
  version?: number | null
): BoxDielineStructure {
  const parsed = parseBoxDielineStructure(structure ?? '')
  if ((version ?? 1) < DIELINE_STRUCTURE_VERSION) {
    if (!parsed || parsed === 'straight_tuck') return 'reverse_tuck'
  }
  return parsed ?? DEFAULT_BOX_DIELINE_STRUCTURE
}
