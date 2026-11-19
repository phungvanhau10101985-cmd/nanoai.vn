import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeWhiteboardObject } from './model'
import { nearestMarkedPoint } from './triangle-line'
import { placeMeasuredSolid, placeSolid, solidFromMeasures, solidMeasureError, solidMesh } from './solid'
import { SOLID_KINDS } from './types'

test('mỗi khối có cạnh hợp lệ và đặt đúng tâm', () => {
  for (const kind of SOLID_KINDS) {
    const mesh = solidMesh(kind, 80)
    assert.ok(mesh.points.length >= 4, kind)
    assert.ok(mesh.edges.length >= 4 && mesh.edges.length % 2 === 0, kind)
    assert.ok(mesh.hidden > 0 && mesh.hidden * 2 <= mesh.edges.length, kind)
    assert.ok(mesh.corners.length === new Set(mesh.corners).size, kind)
    for (const index of mesh.corners) assert.ok(index >= 0 && index < mesh.points.length, kind)
    for (let i = 0; i < mesh.edges.length; i += 1) {
      assert.ok(mesh.edges[i] >= 0 && mesh.edges[i] < mesh.points.length, kind)
    }
    const placed = placeSolid(kind, { x: 40, y: 70 }, 4)
    let x = 0
    let y = 0
    for (const p of placed.points) {
      x += p.x
      y += p.y
    }
    assert.ok(Math.abs(x / placed.points.length - 40) < 1e-6, kind)
    assert.ok(Math.abs(y / placed.points.length - 70) < 1e-6, kind)
    const kept = sanitizeWhiteboardObject({
      kind: 'shape',
      id: 's',
      shape: 'solid',
      color: '#111827',
      size: 2,
      points: placed.points,
      solid: kind,
      solidEdges: placed.edges,
      solidHidden: placed.hidden,
      solidCorners: placed.corners,
    })
    assert.equal(kept && kept.kind === 'shape' ? kept.shape : '', 'solid')
    if (kept && kept.kind === 'shape') {
      assert.deepEqual([...(kept.solidCorners ?? [])].sort((a, b) => a - b), [...mesh.corners].sort((a, b) => a - b))
    }
  }
  const cube = solidMesh('cube', 80)
  assert.equal(cube.corners.length, 8)
  assert.equal(cube.edges.length / 2, 12)
  assert.equal(cube.hidden, 3)
  assert.equal(solidMesh('cylinder', 80).corners.length, 4)
  assert.equal(solidMesh('cone', 80).corners.length, 3)
  assert.equal(solidMesh('sphere', 80).corners.length, 0)
  const cubeAt = placeSolid('cube', { x: 0, y: 0 }, 4)
  const corner = cubeAt.points[cubeAt.corners[0]]
  const hit = nearestMarkedPoint([
    {
      kind: 'shape',
      id: 'cube',
      shape: 'solid',
      color: '#111827',
      size: 2,
      points: cubeAt.points,
      solid: 'cube',
      solidEdges: cubeAt.edges,
      solidHidden: cubeAt.hidden,
      solidCorners: cubeAt.corners,
    },
  ], { x: corner.x + 6, y: corner.y - 4 }, 18)
  assert.ok(hit)
  assert.ok(Math.hypot(hit!.x - corner.x, hit!.y - corner.y) < 1e-6)
})

test('khối chỉ dựng khi đủ kích thước và đúng số đo', () => {
  const g = 32
  const edge = (mesh: { points: { x: number; y: number }[] }, i: number, j: number) =>
    Math.hypot(mesh.points[i].x - mesh.points[j].x, mesh.points[i].y - mesh.points[j].y)
  assert.equal(solidFromMeasures('cube', {}), null)
  assert.equal(solidMeasureError('box', { a: g, b: g }), 'missing')
  assert.equal(solidFromMeasures('tri-prism', { a: 100, b: 20, c: 20, h: 40 }), null)
  const cube = solidFromMeasures('cube', { a: 4 * g })
  assert.ok(cube)
  assert.equal(cube!.corners.length, 8)
  assert.equal(cube!.edges.length / 2, 12)
  assert.equal(cube!.hidden, 3)
  assert.ok(Math.abs(edge(cube!, 0, 1) - 4 * g) < 1e-6)
  assert.ok(Math.abs(edge(cube!, 1, 2) - 4 * g) < 1e-6)
  const box = solidFromMeasures('box', { a: 6 * g, b: 3 * g, c: 2 * g })
  assert.ok(box)
  assert.ok(Math.abs(edge(box!, 0, 1) - 6 * g) < 1e-6)
  assert.ok(Math.abs(edge(box!, 1, 2) - 3 * g) < 1e-6)
  const prism = solidFromMeasures('tri-prism', { a: 3 * g, b: 4 * g, c: 5 * g, h: 2 * g })
  assert.ok(prism)
  assert.ok(Math.abs(edge(prism!, 0, 1) - 3 * g) < 1e-6)
  assert.ok(Math.abs(edge(prism!, 1, 2) - 4 * g) < 1e-6)
  assert.ok(Math.abs(edge(prism!, 2, 0) - 5 * g) < 1e-6)
  const cyl = solidFromMeasures('cylinder', { a: 6 * g, h: 4 * g })
  assert.ok(cyl)
  assert.equal(cyl!.corners.length, 4)
  assert.equal(cyl!.hidden, 8)
  const [right, left, topRight] = cyl!.corners
  assert.ok(Math.abs(edge(cyl!, right, left) - 6 * g) < 1e-6)
  assert.ok(Math.abs(edge(cyl!, right, topRight) - 4 * g) < 1e-6)
  const cone = solidFromMeasures('cone', { a: 4 * g, h: 5 * g })
  assert.equal(cone && cone.corners.length, 3)
  assert.equal(cone && cone.hidden, 8)
  const sphere = solidFromMeasures('sphere', { a: 5 * g })
  assert.equal(sphere && sphere.corners.length, 0)
  assert.ok(sphere && sphere.hidden > 0)
  const samples: { kind: (typeof SOLID_KINDS)[number]; measures: Parameters<typeof solidFromMeasures>[1] }[] = [
    { kind: 'cube', measures: { a: 4 * g } },
    { kind: 'box', measures: { a: 5 * g, b: 3 * g, c: 2 * g } },
    { kind: 'oblique-box', measures: { a: 5 * g, b: 3 * g, c: 2 * g, s: g } },
    { kind: 'tri-prism', measures: { a: 3 * g, b: 4 * g, c: 5 * g, h: 2 * g } },
    { kind: 'hex-prism', measures: { a: 2 * g, h: 3 * g } },
    { kind: 'tetra', measures: { a: 4 * g } },
    { kind: 'square-pyramid', measures: { a: 4 * g, h: 3 * g } },
    { kind: 'hex-pyramid', measures: { a: 2 * g, h: 3 * g } },
    { kind: 'frustum', measures: { a: 4 * g, b: 2 * g, h: 3 * g } },
    { kind: 'cylinder', measures: { a: 4 * g, h: 3 * g } },
    { kind: 'cone', measures: { a: 4 * g, h: 3 * g } },
    { kind: 'cone-frustum', measures: { a: 4 * g, b: 2 * g, h: 3 * g } },
    { kind: 'octa', measures: { a: 4 * g } },
    { kind: 'sphere', measures: { a: 4 * g } },
  ]
  for (const sample of samples) {
    const mesh = solidFromMeasures(sample.kind, sample.measures)
    assert.ok(mesh, sample.kind)
    assert.ok(mesh!.hidden > 0, sample.kind)
    assert.equal(mesh!.corners.length, solidMesh(sample.kind, 80).corners.length, sample.kind)
    const placed = placeMeasuredSolid(sample.kind, { x: 15, y: -8 }, sample.measures)
    assert.ok(placed)
    let x = 0
    let y = 0
    for (const p of placed!.points) {
      x += p.x
      y += p.y
    }
    assert.ok(Math.abs(x / placed!.points.length - 15) < 1e-6, sample.kind)
    assert.ok(Math.abs(y / placed!.points.length + 8) < 1e-6, sample.kind)
  }
})
