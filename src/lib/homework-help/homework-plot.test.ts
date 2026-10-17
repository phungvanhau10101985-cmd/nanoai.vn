import assert from 'node:assert/strict'
import test from 'node:test'
import { homeworkPlotFromStatement, type HomeworkPlotPoint } from '@/lib/homework-help/homework-plot'

function nearest(points: HomeworkPlotPoint[], x: number): number | null {
  let best: HomeworkPlotPoint | null = null
  for (const point of points) {
    if (!best || Math.abs(point.x - x) < Math.abs(best.x - x)) best = point
  }
  if (!best || Math.abs(best.x - x) > 0.2) return null
  return best.y
}

test('an equation to solve is not a graph', () => {
  assert.equal(homeworkPlotFromStatement('Giải phương trình 2x + 3 = 7'), null)
  assert.equal(homeworkPlotFromStatement('FeCO3 + 4HNO3 → Fe(NO3)3 + CO2 + 2H2O'), null)
  assert.equal(homeworkPlotFromStatement('Tính đạo hàm của hàm số y = x^2'), null)
  assert.equal(homeworkPlotFromStatement('HNO3 63% (1,44 g/ml)'), null)
})

test('a requested parabola is drawn from the formula, with the vertex on the curve', () => {
  const plot = homeworkPlotFromStatement('Vẽ đồ thị hàm số y = x^2 - 2x - 3')
  assert.ok(plot)
  assert.equal(plot.series.length, 1)
  assert.equal(plot.series[0]?.label, 'y = x^2 - 2x - 3')
  const points = plot.series[0]?.segments.flat() ?? []
  const atZero = nearest(points, 0)
  const atVertex = nearest(points, 1)
  assert.ok(atZero != null && Math.abs(atZero + 3) < 0.08)
  assert.ok(atVertex != null && Math.abs(atVertex + 4) < 0.08)
  assert.ok(plot.xMin < -1 && plot.xMax > 3)
})

test('unicode powers, a second line, a domain, and a circle stay on the axes', () => {
  const pair = homeworkPlotFromStatement('Tìm giao điểm của đồ thị y = x² và đường thẳng y = 2x − 1')
  assert.ok(pair)
  assert.equal(pair.series.length, 2)
  assert.equal(pair.series[1]?.label, 'y = 2x - 1')
  assert.ok(pair.yMax < 16 && pair.yMin > -12)

  const limited = homeworkPlotFromStatement('Vẽ đồ thị y = x^2 trên đoạn [-1; 5]')
  assert.ok(limited)
  const xs = limited.series[0]?.segments.flat().map((point) => point.x) ?? []
  assert.ok(xs.length > 10)
  assert.ok(xs.every((x) => x >= -1 - 1e-6 && x <= 5 + 1e-6))

  const circle = homeworkPlotFromStatement('Vẽ đường tròn (x - 1)^2 + (y + 2)^2 = 9')
  assert.ok(circle)
  assert.equal(circle.equalScale, true)
  assert.deepEqual(circle.series[0]?.circle, { h: 1, k: -2, r: 3 })

  const absolute = homeworkPlotFromStatement('Sketch the graph of y = |x - 1|')
  assert.ok(absolute)
  const left = nearest(absolute.series[0]?.segments.flat() ?? [], -1)
  assert.ok(left != null && Math.abs(left - 2) < 0.08)

  const named = homeworkPlotFromStatement('Sketch the graph of f(x) = 2x + 1')
  assert.equal(named?.series[0]?.label, 'f(x) = 2x + 1')
})
