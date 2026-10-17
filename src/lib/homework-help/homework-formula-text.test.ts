import assert from 'node:assert/strict'
import test from 'node:test'
import { segmentStudyFormula } from '@/lib/homework-help/homework-formula-text'

function kinds(input: string): string[] {
  return segmentStudyFormula(input).map((part) => (part.kind === 'text' ? part.text : `${part.kind}:${part.tex}`))
}

test('chemistry formulas and a full reaction become textbook markup', () => {
  assert.deepEqual(kinds('Hỗn hợp A gồm FeCO3 và FeS2.'), [
    'Hỗn hợp A gồm ',
    'chem:FeCO3',
    ' và ',
    'chem:FeS2',
    '.',
  ])
  assert.deepEqual(kinds('FeCO3 + 4HNO3 → Fe(NO3)3 + CO2 + NO2 + 2H2O'), [
    'chem:FeCO3 + 4HNO3 -> Fe(NO3)3 + CO2 + NO2 + 2H2O',
  ])
  assert.equal(segmentStudyFormula('FeCO3 + 4HNO3 → Fe(NO3)3')[0]?.kind === 'chem' && segmentStudyFormula('FeCO3 + 4HNO3 → Fe(NO3)3')[0] && 'display' in segmentStudyFormula('FeCO3 + 4HNO3 → Fe(NO3)3')[0] && (segmentStudyFormula('FeCO3 + 4HNO3 → Fe(NO3)3')[0] as { display: boolean }).display, true)
})

test('unicode subscripts, charges, and hydroxide groups stay chemical', () => {
  assert.deepEqual(kinds('Muối Fe(NO₃)₃ và ion Fe²⁺.'), [
    'Muối ',
    'chem:Fe(NO3)3',
    ' và ion ',
    'chem:Fe^{2+}',
    '.',
  ])
  assert.deepEqual(kinds('Ba(OH)2 và SO42-'), ['chem:Ba(OH)2', ' và ', 'chem:SO4^{2-}'])
})

test('math equations and fractions are marked, prose around them stays text', () => {
  assert.deepEqual(kinds('Giải 2x + 3 = 7.'), ['Giải ', 'math:2x + 3 = 7', '.'])
  assert.deepEqual(kinds('v = s/t'), ['math:v = \\frac{s}{t}'])
  assert.deepEqual(kinds('x^2 + 2x + 1 = 0'), ['math:x^{2} + 2x + 1 = 0'])
  assert.deepEqual(kinds('F = ma'), ['math:F = ma'])
  assert.deepEqual(kinds('E = mc^2'), ['math:E = mc^{2}'])
  assert.deepEqual(kinds('x = √(2)'), ['math:x = \\sqrt{2}'])
})

test('ordinary sentences and question numbers are not formulas', () => {
  assert.deepEqual(kinds('X là muối gì?'), ['X là muối gì?'])
  assert.deepEqual(kinds('Câu 1. Tính khối lượng.'), ['Câu 1. Tính khối lượng.'])
  assert.deepEqual(kinds('HNO3 63% (1,44 g/ml).'), ['chem:HNO3', ' 63% (1,44 g/ml).'])
})
