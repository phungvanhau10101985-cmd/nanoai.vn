import { keepTermsPromptBlock } from './dich-anh-tai-lieu/pdf-keep-terms'
import { documentTranslatePromptName } from './document-translate-languages'

/**
 * Prompt duy nhất của trang dịch ảnh tài liệu.
 * Mỗi vùng chữ chỉ rơi vào một luật: giữ nguyên, hoặc dịch.
 */
export function buildTranslatePrompt(
  sourceLang: string,
  sourceLang2: string | null,
  targetLang: string,
  extra?: { keepTerms?: string[]; captureLines?: boolean }
): string {
  const targetName = documentTranslatePromptName(targetLang)
  const isAuto = sourceLang === 'auto' || !sourceLang
  const sourceDesc = isAuto
    ? 'Detect the source language or languages on the page.'
    : sourceLang2
      ? `${documentTranslatePromptName(sourceLang)} and ${documentTranslatePromptName(sourceLang2)}`
      : documentTranslatePromptName(sourceLang)

  return `Edit this document image. SOURCE: ${sourceDesc}. TARGET: ${targetName}.

Keep the same photograph, the same layout, the same logos, and the same colors. The machine or product must stay a real photograph of the same object, in the same place, with the same lighting. Do not redraw it as a cartoon, illustration, watercolor, vector, sticker, or flat icon.

Read every text region. Apply the first rule that matches. Do not skip a region.

KEEP the characters exactly, do not translate and do not remove, only when those characters are physically printed, painted, or stuck on the product in the photograph: door, boom, drum, cab, tire, or a plate fixed on the machine. A colored box, caption, heading, or table cell drawn on the poster is not on the product. Also keep a company logo wordmark, the tagline locked inside that logo, a phone number, an email address, and a URL.

TRANSLATE that region into ${targetName} when it is any of these:
- a product introduction or a sales line
- a specification label or a specification value written on the poster
- a poster badge or callout that names an engine or a model but is not painted on the machine. Keep the digits and a Latin model code such as VTC-15. Translate the words. A Chinese poster badge 云内490增压 becomes "Yunnei 490 tăng áp" when the target is Vietnamese.
- the words that explain a specification
- a line about condition, maintenance, or how to use the product
- a contact invitation, and the names of human languages written inside parentheses

A model code made of digits and Latin letters stays. Words written in the source script are translated even when they sit beside that code. Keep the digits and unit symbols. Translate the unit word when it is part of the sentence. The Chinese character 方 beside a capacity is cubic meters, written m³. It is not the number 万. The Chinese word 分体 on a gearbox or an axle is a split type, not an integrated type.

Translate only the meaning that is written. Do not add a claim, a country, a city, a sales channel, or a condition the source does not say. Do not replace a word about reliability with a word about power or cost. A note in parentheses is translated as that same note. A list of languages is translated item by item, with the same count. Names of languages become the ${targetName} names of those same languages. Do not swap the vehicle for a different vehicle: keep the same cab color, the same boom pose, and the same background.

Fit the new words inside the same box. Do not add a box. Do not drop a box. Do not move a logo.

OUTPUT: one PNG image only.${keepTermsPromptBlock(extra?.keepTerms ?? [])}${
    extra?.captureLines
      ? `\n\nAfter the image, the text part must be JSON only, no markdown:\n{"lines":["each visible text line in the output image, top to bottom"]}\nDo not invent a line that is not visible in the output image.\n`
      : ''
  }`
}
