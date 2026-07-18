/** Lead line — must appear first so the image model prioritizes flat print output. */
export const PACKAGING_FACE_FLAT_ARTWORK_LEAD = `OUTPUT = ONE FLAT 2D PRINT PANEL ONLY — orthographic head-on view, like a print-ready PNG artboard (Illustrator/InDesign export), NOT a product photograph.`

/** Minimum inset for readable content from panel trim edges (mm). Background may still full bleed. */
export const PACKAGING_FACE_SAFE_ZONE_MM = 10

export const PACKAGING_FACE_SAFE_ZONE_RULES = `SAFE ZONE (required for dieline fold alignment):
- Keep ALL readable text, logos, barcodes, icons, and important product info at least ${PACKAGING_FACE_SAFE_ZONE_MM}mm INSIDE every panel edge (trim line)
- Background colors, textures, gradients, and decorative graphics MUST still extend full bleed to all four edges
- Assume fold/crease lines exist exactly at panel edges — never place text blocks flush against bottom, top, left, or right edges`

/** Shared rules so packaging_face steps output flat pre-press artwork, not dieline/mockup. */
export const PACKAGING_FACE_FLAT_ARTWORK_RULES = `${PACKAGING_FACE_FLAT_ARTWORK_LEAD}

${PACKAGING_FACE_SAFE_ZONE_RULES}

FORBIDDEN — never output these (they belong ONLY to the separate box_mockup_3d step later):
- A 3D cardboard box standing on a table, floor, or studio surface
- Grey/neutral studio backdrop with a small box centered and empty margins on all sides
- Drop shadow, contact shadow, or cast shadow beneath a physical box
- Perspective, depth, angled view, or “product mockup” product photography framing
- White or coloured padding/frame around the design — the artwork must touch all four image edges

REQUIRED — flat print file before die-cutting:
- ONE rectangular panel for this face only — straight-on orthographic view (like opening a flat PDF in Illustrator)
- FULL BLEED (full viền): background, colour and artwork extend to all four edges with ZERO margin, frame, padding, or letterboxing
- The entire image canvas is 100% filled with printable design — edge to edge, corner to corner
- LANGUAGE LOCK: render every brand name, product name, slogan, ingredient, instruction, and other supplied print copy verbatim in its original language — never translate, transliterate, rewrite, spell-correct, or summarize it
- NO dieline / net / unfolded template: no multiple connected panels, glue tabs, tuck flaps, or sheet layout
- NO cut lines, fold/crease lines, registration marks, crop marks, or bleed guides drawn on the image
- NEVER draw dimension lines, arrows, rulers, or size text (mm, cm, L×W labels) on the artwork
- Product photos attached as reference must be flattened into 2D printed graphics on this panel — NOT a separate 3D bottle/box object on kraft paper
- Kraft or cardboard texture as a flat design background filling the entire rectangle edge-to-edge is OK (texture only — still flat print, not a photo of real cardboard with a box on it)
- 3D mockup and technical dieline PDF are separate later steps — generate flat full-bleed artwork only`
