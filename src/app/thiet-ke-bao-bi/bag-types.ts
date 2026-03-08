/** Loại túi khi tạo mockup 3D – mỗi loại có hình dạng khác nhau. */
export const BAG_TYPE_OPTIONS = [
  { value: 'stand-up-pouch', prompt: 'Stand-up pouch. Bottom gusset, can stand upright. Flexible packaging for snacks, coffee, etc.' },
  { value: 'flat-pouch', prompt: 'Flat pouch. Simple flat flexible pouch, no gusset. Lay flat when empty.' },
  { value: 'side-gusset', prompt: 'Side gusset bag. Has side gussets for depth. Common for food packaging.' },
  { value: 'paper-bag', prompt: 'Paper bag with handles. Kraft or white paper, open top with handles. Shopping bag style.' },
  { value: 'pillow-pouch', prompt: 'Pillow pouch. Horizontal pillow-style pouch, center seal. Common for chips, snacks.' },
  { value: 'zipper-pouch', prompt: 'Zipper pouch. Reclosable zipper at top. Stand-up or flat style with zipper closure.' },
  { value: 'three-side-seal', prompt: 'Three-side seal pouch. Envelope style, sealed on three sides. Common for small products, samples.' },
  { value: 'four-side-seal', prompt: 'Four-side seal pouch. Fully sealed on all four edges. Envelope or flat style.' },
  { value: 'doypack', prompt: 'Doypack. Stand-up pouch with bottom gusset, bottle-like shape. Popular for liquids, powders, snacks.' },
  { value: 'kraft-paper', prompt: 'Kraft paper bag. Brown kraft paper, eco-friendly look. Can have handles or be simple open-top.' },
  { value: 'mesh-bag', prompt: 'Mesh bag. Net/mesh material, breathable. Common for produce, onions, citrus.' },
  { value: 'vacuum-bag', prompt: 'Vacuum bag. Thin flexible film for vacuum-sealed food. Flat when sealed.' },
  { value: 'retort-pouch', prompt: 'Retort pouch. Heat-resistant flexible pouch for shelf-stable food. Stand-up or flat style.' },
  { value: 'window-pouch', prompt: 'Window pouch. Has a clear plastic window to show product inside. Stand-up or flat.' },
  { value: 'gusset-bottom', prompt: 'Gusset bottom bag. Stand-up with wide bottom gusset for stability.' },
  { value: 'flat-bottom', prompt: 'Flat bottom bag. Stand-up pouch with flat square bottom.' },
  { value: 'handle-bag', prompt: 'Handle bag. Bag with carry handles. Can be paper or plastic, shopping bag style.' },
  { value: 'drawstring', prompt: 'Drawstring bag. Bag with drawstring closure at top. Common for gifts, produce.' },
  { value: 'slider-pouch', prompt: 'Slider pouch. Reclosable with slider zipper. Stand-up or flat style.' },
  { value: 'spout-pouch', prompt: 'Spout pouch. Stand-up pouch with pour spout/cap. For liquids, milk, juice.' },
] as const

export type BagType = (typeof BAG_TYPE_OPTIONS)[number]['value']
