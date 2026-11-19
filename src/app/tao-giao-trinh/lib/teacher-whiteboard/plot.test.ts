import assert from 'node:assert/strict'
import test from 'node:test'
import { flattenExtremumParts, labelIntersections, labelPlotExtrema } from './extrema-label'
import { extremaMarkerColor, findPlotExtrema, formatAxisNumber, infinitySignLabel, parsePlotInput, plotRuns, samplePlot, sharedFrameLayout, visibleAxisSpan } from './plot'

test('gõ y=x^2 ra parabol', () => {
  const parsed = parsePlotInput('y=x^2')
  assert.ok(parsed)
  assert.equal(parsed?.axis, 'y')
  const pts = samplePlot(parsed!, -2, 2, 40)
  const mid = pts.find((p) => Math.abs(p.x) < 0.05)
  assert.ok(mid && Math.abs(mid.y) < 0.2)
  const far = pts[pts.length - 1]
  assert.ok(far && Math.abs(far.x - 2) < 0.05 && Math.abs(far.y - 4) < 0.2)
})

test('sin(x) và x=y^2', () => {
  const sin = parsePlotInput('y=sin(x)')
  assert.ok(sin)
  const spts = samplePlot(sin!, 0, Math.PI, 40)
  const peak = spts.reduce((best, p) => (p.y > best.y ? p : best), spts[0])
  assert.ok(peak.y > 0.9)
  const side = parsePlotInput('x=y^2')
  assert.equal(side?.axis, 'x')
  const xpts = samplePlot(side!, -2, 2, 20)
  assert.ok(xpts.some((p) => p.x >= 0))
})

test('biểu thức không hợp lệ', () => {
  assert.equal(parsePlotInput(''), null)
  assert.equal(parsePlotInput('@@@'), null)
})

test('y=x^2 có cực tiểu tại gốc', () => {
  const parsed = parsePlotInput('y=x^2')
  const pts = samplePlot(parsed!, -4, 4, 160)
  const ext = findPlotExtrema(pts, 'y')
  assert.equal(ext.length, 1)
  assert.equal(ext[0].kind, 'min')
  assert.ok(Math.abs(ext[0].x) < 0.12)
  assert.ok(Math.abs(ext[0].y) < 0.12)
})

test('sin(x) có cực đại và cực tiểu', () => {
  const parsed = parsePlotInput('y=sin(x)')
  const pts = samplePlot(parsed!, -3.2, 3.2, 200)
  const ext = findPlotExtrema(pts, 'y')
  assert.ok(ext.some((e) => e.kind === 'max' && Math.abs(e.x - Math.PI / 2) < 0.2 && e.y > 0.9))
  assert.ok(ext.some((e) => e.kind === 'min' && Math.abs(e.x + Math.PI / 2) < 0.2 && e.y < -0.9))
})

test('y=x^3 không đánh điểm uốn thành cực trị', () => {
  const parsed = parsePlotInput('y=x^3')
  const pts = samplePlot(parsed!, -3, 3, 160)
  const ext = findPlotExtrema(pts, 'y')
  assert.equal(ext.length, 0)
})

test('cực trị ghi tọa độ đúng, không kèm số gần đúng', () => {
  const parsed = parsePlotInput('y=x^3+2x^2-3x+1')
  assert.ok(parsed)
  const labels = labelPlotExtrema(parsed!, -4, 4, 'vi')
  assert.equal(labels.length, 2)
  const min = labels.find((item) => item.kind === 'min')
  const max = labels.find((item) => item.kind === 'max')
  assert.ok(min && max)
  const minText = flattenExtremumParts(min!.parts)
  const maxText = flattenExtremumParts(max!.parts)
  assert.match(minText, /\(x₂; y₂\) = \(/)
  assert.match(minText, /\(−2 \+ √13\)\/\(3\)/)
  assert.match(minText, /; /)
  assert.doesNotMatch(minText, /≈/)
  assert.match(minText, /điểm cực tiểu/)
  assert.match(maxText, /\(x₁; y₁\) = \(/)
  assert.match(maxText, /√13/)
  assert.match(maxText, /điểm cực đại/)
  assert.ok(Math.abs(min!.x - (-2 + Math.sqrt(13)) / 3) < 1e-9)
  assert.ok(Math.abs(min!.y - (((-2 + Math.sqrt(13)) / 3) ** 3 + 2 * ((-2 + Math.sqrt(13)) / 3) ** 2 - 3 * ((-2 + Math.sqrt(13)) / 3) + 1)) < 1e-8)
})

test('giao điểm bậc ba ghi dạng chính xác như cực trị', () => {
  const curve = parsePlotInput('y=x^3-3x+1')
  const axis = parsePlotInput('y=0')
  assert.ok(curve && axis)
  const hits = labelIntersections(curve!, axis!, -3, 3, 'vi')
  assert.equal(hits.length, 3)
  const text = hits.map((hit) => flattenExtremumParts(hit.parts)).join('\n')
  assert.match(text, /x₁/)
  assert.match(text, /cos\(/)
  assert.match(text, /giao điểm/)
  assert.doesNotMatch(text, /0\.\d{3}/)
})

test('cùng hệ trục nới khung để đủ hai giao của parabol và đường thẳng', () => {
  const curve = parsePlotInput('y=x^2')
  const line = parsePlotInput('y=x+5')
  assert.ok(curve && line)
  const layout = sharedFrameLayout(
    [
      { axis: 'y', expr: 'x^2', unit: 40 },
      { axis: 'y', expr: 'x+5', unit: 40 },
    ],
    1,
    420,
    360,
  )
  const hits = labelIntersections(curve, line, -layout.span, layout.span)
  assert.equal(hits.length, 2)
  assert.ok(hits.every((hit) => Math.abs(hit.x) <= layout.span && Math.abs(hit.y) <= layout.span))
  const ys = hits.map((hit) => hit.y).sort((a, b) => a - b)
  assert.ok(ys[0] < 4 && ys[1] > 7)
})

test('hai hàm cùng trục hiện tọa độ giao điểm', () => {
  const cubic = parsePlotInput('y=x^3')
  const quad = parsePlotInput('y=x^2+3x-2')
  assert.ok(cubic && quad)
  const hits = labelIntersections(cubic!, quad!, -8, 8)
  assert.equal(hits.length, 3)
  const texts = hits.map((hit) => flattenExtremumParts(hit.parts))
  assert.ok(texts.some((text) => text.includes('(x₃; y₃) = (2; 8)') && text.includes('giao điểm')))
  assert.ok(texts.some((text) => text.includes('√5')))
  assert.ok(hits.some((hit) => Math.abs(hit.x - 2) < 1e-9 && Math.abs(hit.y - 8) < 1e-9))
})

test('y=x^2 ghi cực tiểu tại (0; 0)', () => {
  const parsed = parsePlotInput('y=x^2')
  const labels = labelPlotExtrema(parsed!, -3, 3, 'vi')
  assert.equal(labels.length, 1)
  assert.equal(flattenExtremumParts(labels[0].parts), '(x₁; y₁) = (0; 0) (điểm cực tiểu)')
})

test('đường thẳng dừng trong khung và hai đầu vô cùng', () => {
  const parsed = parsePlotInput('y=2*x')
  const runs = plotRuns(parsed!, 8, 180)
  assert.equal(runs.length, 1)
  assert.equal(runs[0].infiniteStart, true)
  assert.equal(runs[0].infiniteEnd, true)
  for (const p of runs[0].points) {
    assert.ok(Math.abs(p.x) <= 8.001)
    assert.ok(Math.abs(p.y) <= 8.001)
  }
  const ys = runs[0].points.map((p) => p.y)
  assert.ok(Math.min(...ys) <= -7.5)
  assert.ok(Math.max(...ys) >= 7.5)
})

test('sqrt chỉ vô cùng ở đầu đi ra khỏi khung', () => {
  const parsed = parsePlotInput('y=sqrt(x)')
  const runs = plotRuns(parsed!, 8, 200)
  assert.ok(runs.length >= 1)
  assert.equal(runs[0].infiniteStart, false)
  assert.equal(runs[0].infiniteEnd, true)
  assert.ok(runs[0].points[0].x < 0.3)
  assert.ok(runs[0].points.every((p) => p.y <= 8.001 && p.x <= 8.001))
})

test('1/x không nối xuyên qua tiệm cận', () => {
  const parsed = parsePlotInput('y=1/x')
  const runs = plotRuns(parsed!, 8, 360)
  assert.ok(runs.length >= 2)
  for (const run of runs) {
    for (const p of run.points) {
      assert.ok(Math.abs(p.x) <= 8.001)
      assert.ok(Math.abs(p.y) <= 8.001)
    }
  }
})

test('vô cùng có dấu theo hướng nét', () => {
  assert.equal(infinitySignLabel(4, 1), '+∞')
  assert.equal(infinitySignLabel(-4, 1), '−∞')
  assert.equal(infinitySignLabel(1, 5), '+∞')
  assert.equal(infinitySignLabel(1, -5), '−∞')
})

test('khung trục co lại khi ô đơn vị lớn', () => {
  assert.equal(visibleAxisSpan(40, 900, 700), 8)
  assert.ok(visibleAxisSpan(80, 400, 360) < 8)
})

test('màu cực trị khác nét vẽ', () => {
  assert.notEqual(extremaMarkerColor('#111827'), '#111827')
  assert.notEqual(extremaMarkerColor('#ef4444'), '#ef4444')
  assert.equal(formatAxisNumber(0), '0')
  assert.equal(formatAxisNumber(2), '2')
})
