/** Shared rules so packaging_face steps output flat pre-press artwork, not dieline/mockup. */
export const PACKAGING_FACE_FLAT_ARTWORK_RULES = `CRITICAL OUTPUT FORMAT — flat print artwork ONLY (pre-press file before die-cutting, NOT a physical box):
- ONE rectangular panel for this face only — orthographic straight-on view (like opening a flat PDF in Illustrator), NOT photographed in a studio, NOT standing on a table/floor.
- FULL BLEED (full viền): background, color and artwork extend to all four edges with ZERO white margin, frame, or padding.
- NO 3D box, NO perspective, NO depth, NO shadows cast on a surface, NO product mockup scene, NO photo of an assembled carton standing upright.
- NO dieline / net / unfolded template: no multiple connected panels, glue tabs, tuck flaps, or sheet layout.
- NO cut lines, NO fold/crease lines, NO registration marks, NO crop marks, NO bleed guides drawn on the image.
- NEVER draw dimension lines, arrows, rulers, or size text (mm, cm, "400mm", "225mm", L×W labels) on the artwork — physical size is metadata only, not printed on the design.
- Product photos attached as reference must be flattened into 2D printed graphics on this panel — NOT rendered as a separate 3D bottle/box object sitting on kraft paper.
- Kraft or cardboard texture as a flat design background that fills the entire rectangle edge-to-edge is OK (texture only — still a flat print file, not a photo of real cardboard with a box on it).
- 3D mockup and technical dieline PDF are separate later steps — generate flat full-bleed artwork only.`
