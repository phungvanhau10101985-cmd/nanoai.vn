import { canonicalGradeLevelId, GRADE_LEVEL_GROUPS, gradeLevelLabel } from './curriculum-subjects'

/**
 * Đoạn phong cách ảnh theo đúng lớp và khối của giáo trình.
 * Prompt ảnh đang viết tiếng Anh; tên lớp giữ tiếng Việt để model thấy «Lớp 6».
 */
export function slideImageGradeStylePrompt(gradeLevelId: string): string {
  const id = canonicalGradeLevelId(gradeLevelId)
  if (!id || id === 'khac') return ''
  const labelVi = gradeLevelLabel(id, 'vi')
  const labelEn = gradeLevelLabel(id, 'en')
  if (!labelVi || labelVi === id) return ''
  const group = GRADE_LEVEL_GROUPS.find((item) => item.ids.includes(id))
  const bandVi = group?.labelVi ?? ''
  const bandEn = group?.labelEn ?? ''
  const look = gradeImageLook(id)
  if (!look) return ''
  const who = bandVi
    ? `${labelVi} (${labelEn}), khối ${bandVi} (${bandEn})`
    : `${labelVi} (${labelEn})`
  return `CLASSROOM AGE (mandatory): This picture is for ${who}. ${look} Keep the same facts and the same words. Only the drawing style follows this grade. Do not draw a younger or older classroom than this grade.`
}

function gradeImageLook(id: string): string {
  if (id.startsWith('nha-tre')) {
    return 'Picture-book simplicity for babies and toddlers. One or two huge familiar objects, soft warm colors, almost no writing beyond the required title. No charts, no school-age children, no laboratory equipment.'
  }
  if (id.startsWith('mau-giao')) {
    return 'Kindergarten picture for ages 3–6. Few large rounded shapes, bright calm colors, one scene a preschool child recognizes, very little text besides the required title and one short label. No dense diagrams and no teenage students.'
  }
  if (id === 'lop-1' || id === 'lop-2') {
    return 'Primary textbook picture for ages 6–8. Large concrete objects, big numerals, few labels, bright colors, lots of empty space. Children, if shown, look about 6–8. Not a baby book and not a middle-school diagram.'
  }
  if (id === 'lop-3' || id === 'lop-4' || id === 'lop-5') {
    return 'Primary textbook picture for ages 8–11. Colorful and still concrete, a simple diagram with a few large labels. Students, if shown, look about 8–11. Not preschool clipart and not a teenage science poster.'
  }
  if (id === 'lop-6' || id === 'lop-7' || id === 'lop-8' || id === 'lop-9') {
    return 'Middle-school diagram for ages 11–15. Clean lines, moderate detail, readable from the back of the room, little decoration. Students, if shown, look 11–15. Not a picture book and not a university figure.'
  }
  if (id === 'lop-10' || id === 'lop-11' || id === 'lop-12') {
    return 'High-school textbook figure for ages 15–18. Precise proportions, high contrast, little decoration. People, if shown, look 15–18. Not cute characters, not rounded baby shapes, not a primary-school poster.'
  }
  if (id === 'hoc-nghe' || id === 'trung-cap' || id === 'cao-dang') {
    return 'Vocational classroom for young adults. Clear tools or steps, realistic proportions, workshop or classroom light. Not a children\'s picture.'
  }
  if (id === 'dai-hoc' || id === 'cao-hoc' || id === 'tien-si') {
    return 'Academic figure. Sparse, precise, and serious. No schoolchildren and no playful decoration.'
  }
  return ''
}
