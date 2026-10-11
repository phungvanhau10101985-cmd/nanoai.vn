/** Studio preset copy — 7 new seamless flows (English) */
export const NEW_PRESETS_EN = {
  packaging_kit: {
    title: 'Paper box design',
    kickoff:
      'Design a technical carton workflow: Logo → create all six faces one by one (top|front|right|bottom|back|left) → 3D mockup → Dieline PDF → label → seal → real barcode.',
    steps: {
      brand_name: 'Brief: Brand name',
      product_type: 'Brief: Product type',
      box_size: 'Brief: Box size',
      box_face_confirm: 'Brief: Confirm faces',
      style_mood: 'Brief: Style',
      color_palette: 'Brief: Colors',
      face_print_style: 'Brief: Visual art style',
      logo: 'Logo',
      box_flat: 'Flat box (dieline)',
      face_top: 'Top face (L×W)',
      body_strip: 'Continuous body (front|right|back|left)',
      face_front: 'Front face (L×H)',
      face_right: 'Right side (W×H)',
      face_bottom: 'Bottom face (L×W)',
      face_back: 'Back face (L×H)',
      face_left: 'Left side (W×H)',
      face_lxw: 'L×W face (top/bottom)',
      face_lxh: 'L×H face (front/back)',
      face_wxh: 'W×H face (sides)',
      box_dieline_pdf: 'Technical Dieline PDF',
      box_mockup_3d: '3D box mockup',
      product_label: 'Product label',
      seal_sticker: 'Seal sticker',
      barcode_label: 'Barcode label',
    },
    asks: {
      brand_name: '① Brand / product name?',
      product_type: '② What product is packaged? (cosmetics, food, gifts…)',
      box_size: '③ Box dimensions? Enter L × W × H (cm) freely — form below or chat. Each face image uses the closest ratio to real size.',
      box_face_confirm:
        '④ Confirm the bottom, front/back and side face sizes above — reply OK or re-enter L×W×H if the dimension order differs.',
      style_mood: '⑤ Style: organic / luxury / minimal / playful?',
      color_palette: '⑥ Print color palette?',
      face_print_style:
        '⑦ Choose one visual art style to apply consistently across all 6 box faces.',
      logo: 'Describe the logo to create for packaging (based on brief) — or tap **Upload logo** if you already have a file.',
      box_flat: 'Flat box: front/side layout, logo placement?',
      face_top:
        '⑧ Top L×W — **Upload face image** from device, describe print content, or **leave blank**. **Full bleed** artwork — no mm dimension labels on the image.',
      body_strip:
        '⑨ Create one continuous **front | right | back | left** body strip. Artwork must remain seamless across folds; do not draw cut/fold lines, tabs, or flaps.',
      face_front:
        '⑨ Front L×H — **Upload face image** or describe print content or **leave blank**. Output: **flat print file**, NOT a 3D box.',
      face_right:
        '⑩ Right W×H — **Upload face image** or describe print content or **leave blank**. Output: **flat print file**, NOT a 3D box.',
      face_bottom:
        '⑪ Bottom L×W — **Upload**, **leave blank**, **same as top**, or describe unique print content.',
      face_back:
        '⑫ Back L×H — **Upload**, **leave blank**, **same as front**, or describe unique print content.',
      face_left:
        '⑬ Left W×H — **Upload face image** or describe print content or **leave blank**. Output: **flat print file** full bleed, **NOT a 3D box**, NOT a product standing on kraft paper.',
      face_lxw:
        'L×W top/bottom face — enter **print content for this face only** (logo, product name, graphics…). An artwork image will be generated.',
      face_lxh:
        'L×H front/back face — enter **print content for this face** (product name, registration no., ingredients, claims…).',
      face_wxh:
        'W×H side faces — enter **print content for this face** (directions, warnings, secondary ingredients…).',
      box_dieline_pdf: 'Review production parameters, then export the 1:1 technical Dieline PDF.',
      box_mockup_3d:
        'Type **create mockup 3d** to approve the box before exporting the Dieline PDF.',
      product_label: 'Product label (B&W): pick shape + aspect ratio below + copy (name, ingredients, usage…). Logo only.',
      seal_sticker: 'Seal sticker: pick shape + aspect ratio below + tagline/description. Logo only — not box faces.',
      barcode_label: 'Real barcode: uses product name from brief; product code (e.g. SKU: 188-SRM-001). Default Code128 — or EAN-13/QR if specified.',
    },
  },

  bag_kit: {
    title: 'Paper bag design',
    kickoff:
      'Paper bag: Logo → **back & front** (same W×H) → **3D preview** → net PDF. Bag depth is structural only — not printed.',
    steps: {
      brand_name: 'Brief: Brand name',
      product_type: 'Brief: Product type',
      bag_size: 'Brief: Bag size',
      bag_panel_confirm: 'Brief: Confirm print panels',
      style_mood: 'Brief: Style',
      color_palette: 'Brief: Colors',
      face_print_style: 'Brief: Visual art style',
      logo: 'Logo',
      face_back: 'Back print (W×H)',
      face_front: 'Front print (W×H)',
      bag_mockup_3d: '3D bag preview',
      bag_dieline_pdf: 'Print-ready bag net PDF',
    },
    asks: {
      brand_name: '① Brand / product name?',
      product_type: '② What goes in the bag?',
      bag_size:
        '③ Size: **W × H × depth** (cm or mm). W×H = both print faces (equal). **Depth is not printed** — for net/3D only.',
      bag_panel_confirm:
        '④ Confirm: back & front same W×H; depth is structural — reply **OK** or re-enter size.',
      style_mood: '⑤ Style: organic / luxury / minimal / playful?',
      color_palette: '⑥ Print color palette?',
      face_print_style: '⑦ One visual style for **both print faces**.',
      logo: 'Describe the bag logo — or **Upload logo**.',
      face_back: '⑧ Back W×H — **Upload**, describe print, or **leave blank**. Full bleed.',
      face_front:
        '⑨ Front W×H (same as back) — **Upload**, **leave blank**, **same as back**, or unique content.',
      bag_mockup_3d: '3D preview: photoreal standing bag using approved front/back art and depth from brief.',
      bag_dieline_pdf: 'Review reference flat net, then export print PDF.',
    },
    askExamples: {
      brand_name: 'Morning Cafe — specialty coffee',
      product_type: 'Coffee beans & brewing accessories',
      bag_size: '200 × 280 × 60 mm',
      bag_panel_confirm: 'OK',
      style_mood: 'Minimal luxury — kraft + gold logo',
      color_tone: 'Kraft brown, black type, gold accent',
      face_print_style: 'Flat illustration — minimal line art',
    },
  },
  food_menu: {
    title: 'Restaurant menu design',
    kickoff:
      'Design a menu for restaurants, cafés, or drink shops. Answer style brief first — then enter dishes and generate the menu.',
    steps: {
      venue_name: 'Brief: Venue name',
      menu_type: 'Brief: Menu type',
      food_illustration: 'Brief: Dish photos',
      menu_style: 'Brief: Style',
      color_tone: 'Brief: Color tone',
      menu_design: 'Design menu',
      menu_a4_portrait: 'A4 portrait — print / wall menu',
      menu_a4_landscape: 'A4 landscape — large board / spread',
      menu_table_tent: 'Table tent — square',
      menu_board_vertical: 'Vertical board — screen / LED',
      menu_board_wide: 'Wide board — TV / display',
    },
    asks: {
      venue_name: '① Venue / brand name on the menu? (e.g. Hanoi Beef Pho, Morning Café)',
      menu_type:
        '② Menu type: wall A4, booklet, standing board, table tent, digital screen menu?',
      food_illustration:
        '③ Include dish photos on the menu? (Yes — photorealistic photos of each dish / No — text & decoration only)',
      menu_style:
        '④ Style: vintage / modern / minimal / traditional / rustic / luxury café?',
      color_tone: '⑤ Preferred color tone? (e.g. wood brown + cream, green + white)',
      menu_design:
        'Enter venue/brand name, upload logo, pick menu format, add dishes (no., name, unit, VND price) — then «Generate menu».',
    },
    askExamples: {
      venue_name: 'Hanoi Beef Pho — 123 Le Loi St',
      menu_type: 'Wall A4 portrait — double-sided print',
      food_illustration: 'Yes — photorealistic photo of each dish beside the name',
      menu_style: 'Modern Vietnamese — clear typography, light decorative border',
      color_tone: 'Warm wood brown + cream, black text',
      menu_design: 'Beef pho 65,000 VND · Bun cha 55,000 VND · Milk coffee 25,000 VND',
    },
  },

  catalog_photo_pack: {
    title: 'Sell photos from your own shots',
    kickoff:
      'Upload the product photos you took yourself (phone shots are fine). I ask about material and look, then build each photo in this chat for you to approve. At the end you get a name and category to copy onto Facebook or another site — nothing is published to a NanoAI shop.',
    uploadHint: 'Upload your own product photos (1–4 images)',
    steps: {
      material: 'Brief: Material',
      product_kind: 'Brief: Product type',
      shot_look: 'Brief: Photo look',
      color_main: 'Main color photo',
      gallery_2: 'Angle 2',
      gallery_3: 'Angle 3',
      detail_close: 'Detail close-up',
      material_card: 'Material card',
    },
    asks: {
      material: '① What is the material? (required — e.g. cotton, leather, silk)',
      product_kind: '② Product type and gender? (e.g. women t-shirt, men shoes, bag)',
      shot_look: '③ Look: studio / lifestyle / outdoor — with a model? (e.g. studio, product only)',
      color_main: 'Type **create** to build the main color photo from your upload. Add a note if you want (white background, brighter…).',
      gallery_2: 'Type **create** for angle 2. You can name the angle (side, back…).',
      gallery_3: 'Type **create** for angle 3.',
      detail_close: 'Type **create** for a close-up (button, stitch, logo…).',
      material_card: 'Type **create** for the material card. After you approve it, I send a name and category to copy.',
    },
  },
} as const
