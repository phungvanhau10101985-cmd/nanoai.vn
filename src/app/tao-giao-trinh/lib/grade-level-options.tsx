import { GRADE_LEVEL_GROUPS, gradeGroupLabel, gradeLevelLabel } from './curriculum-subjects'

const LEGACY_OTHER_OPTION: Record<string, string> = {
  vi: 'Khác (bản cũ, chọn lại cấp cụ thể)',
  en: 'Other (legacy, pick a specific level)',
  zh: '其他（旧数据，请改选具体级别）',
  ja: 'その他（旧データ。具体的な段階を選び直してください）',
  ko: '기타 (이전 데이터, 구체적 단계를 다시 선택)',
}

/** Các nhóm cấp độ. Mục «Khác» chỉ hiện khi giáo trình cũ đang mang mã đó. */
export function GradeLevelOptions({ locale, currentId }: { locale: string; currentId?: string }) {
  return (
    <>
      {currentId === 'khac' ? (
        <option value="khac">{LEGACY_OTHER_OPTION[locale] || LEGACY_OTHER_OPTION.vi}</option>
      ) : null}
      {GRADE_LEVEL_GROUPS.map((grp) => (
        <optgroup key={grp.labelVi} label={gradeGroupLabel(grp, locale)}>
          {grp.ids.map((id) => (
            <option key={id} value={id}>
              {gradeLevelLabel(id, locale)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
