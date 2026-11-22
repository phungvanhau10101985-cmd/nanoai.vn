import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agglutinates,
  elodeaBubbles,
  protoplast,
  REFLEX_PATH,
  reflexNeedsBrain,
  starchIodine,
} from './bench-bio'
import { daniellCell, distillState, gasCollect, reactionRate } from './bench-chem'
import {
  buoyancyState,
  meterCircuit,
  meterScene,
  radiationScene,
  rayCurvature,
  standingDisplacement,
  standingPipe,
  standingString,
  transformerCircuit,
} from './bench-physics'
import { figureItem, figureSimulates, freshFigureParams, moveFigureTune } from './figures'
import { schoolHandles } from './school-bench'

function kept(id: string, variant: string, handle: string, tune: number[] = []) {
  const item = figureItem(id)
  assert.ok(item)
  const params = { ...freshFigureParams(item), variant, tune }
  const knob = schoolHandles(id, variant, tune, item.w, item.h).find((entry) => entry.id === handle)
  assert.ok(knob)
  return moveFigureTune(id, params, item.w, item.h, handle, knob, 0).tune
}

test('sóng dừng đúng điều kiện biên và tần số', () => {
  for (let k = 1; k <= 6; k += 1) {
    const mode = standingString(1.2, k)
    assert.equal(mode.frequency, k * 10)
    assert.equal(mode.lambda, 2.4 / k)
    assert.equal(mode.nodes, k + 1)
    assert.equal(mode.antinodes, k)
    assert.ok(Math.abs(standingDisplacement('string', k, 0)) < 1e-9)
    assert.ok(Math.abs(standingDisplacement('string', k, 1)) < 1e-9)
    assert.ok(Math.abs(Math.abs(standingDisplacement('string', k, 0.5 / k)) - 1) < 1e-9)
  }
  assert.equal(standingPipe(0.5, 1).frequency, 170)
  assert.equal(standingPipe(0.5, 2).harmonic, 3)
  assert.equal(standingPipe(0.5, 2).frequency, 510)
  for (let mode = 1; mode <= 4; mode += 1) {
    const pipe = standingPipe(0.5, mode)
    assert.equal(pipe.harmonic % 2, 1)
    assert.equal(pipe.nodes, mode)
    assert.ok(Math.abs(standingDisplacement('pipe', mode, 0)) < 1e-9)
    assert.ok(Math.abs(Math.abs(standingDisplacement('pipe', mode, 1)) - 1) < 1e-9)
  }
  assert.equal(kept('standing', 'string', 'mode')[0], 3)
  assert.equal(kept('standing', 'pipe', 'mode')[0], 1)
  assert.equal(kept('standing', 'string', 'mode', [6])[0], 6)
})

test('mạch đo: ampe kế và vôn kế đổi theo biến trở', () => {
  const open = meterCircuit(0)
  assert.ok(Math.abs(open.current - 0.5) < 1e-9)
  assert.ok(Math.abs(open.voltage - 6) < 1e-9)
  const mid = meterCircuit(12)
  assert.ok(Math.abs(mid.current - 0.25) < 1e-9)
  assert.ok(Math.abs(mid.voltage - 3) < 1e-9)
  const shut = meterCircuit(18)
  assert.ok(Math.abs(shut.current - 0.2) < 1e-9)
  assert.ok(Math.abs(shut.voltage - 2.4) < 1e-9)
  const item = figureItem('meters')
  assert.ok(item)
  const zero = meterScene(item.w, item.h, [0])
  const dragged = moveFigureTune('meters', freshFigureParams(item), item.w, item.h, 'rheostat', { x: zero.handleX, y: zero.handleY }, 0).tune
  assert.ok(Math.abs(meterCircuit(dragged[0]).current - 0.5) < 1e-6)
  assert.ok(Math.abs(kept('meters', '', 'rheostat', [6])[0] - 6) < 1e-6)
})

test('tia phóng xạ: beta lệch mạnh và ngược chiều alpha', () => {
  for (const mag of [0.55, 1, 1.7]) {
    const alpha = rayCurvature('alpha', 1, mag)
    const beta = rayCurvature('beta', 1, mag)
    const gamma = rayCurvature('gamma', 1, mag)
    assert.ok(alpha.screenSign > 0)
    assert.equal(beta.screenSign, -alpha.screenSign)
    assert.ok(beta.radius < alpha.radius)
    assert.equal(gamma.screenSign, 0)
    assert.equal(rayCurvature('alpha', -1, mag).screenSign, -alpha.screenSign)
  }
  const item = figureItem('radiation')
  assert.ok(item)
  const down = radiationScene(item.w, item.h, [-1, 1.4])
  const flipped = moveFigureTune('radiation', freshFigureParams(item), item.w, item.h, 'direction', { x: down.dirX, y: down.dirY }, 0).tune
  assert.equal(flipped[0], -1)
  const strong = moveFigureTune('radiation', freshFigureParams(item), item.w, item.h, 'strength', { x: down.magX, y: down.magY }, 0).tune
  assert.ok(Math.abs(strong[1] - 1.4) < 1e-6)
})

test('máy biến áp giữ tỉ số và công suất', () => {
  for (const turns of [60, 120, 240, 480]) {
    const circuit = transformerCircuit(turns)
    assert.ok(Math.abs(circuit.voltage1 / circuit.voltage2 - circuit.turns1 / circuit.turns2) < 1e-9)
    assert.ok(Math.abs(circuit.current2 / circuit.current1 - circuit.turns1 / circuit.turns2) < 1e-9)
    assert.ok(Math.abs(circuit.power1 - circuit.power2) < 1e-9)
  }
  const stepDown = transformerCircuit(120)
  assert.ok(Math.abs(stepDown.voltage2 - 6) < 1e-9)
  assert.ok(Math.abs(stepDown.current2 - 0.125) < 1e-9)
  assert.ok(Math.abs(kept('transformer', '', 'turns', [120])[0] - 120) < 1e-6)
  assert.ok(Math.abs(kept('transformer', '', 'turns', [480])[0] - 480) < 1e-6)
  assert.ok(Math.abs(transformerCircuit(kept('transformer', '', 'turns', [480])[0]).voltage2 - 24) < 1e-6)
})

test('lực đẩy Acsimet: kim loại chìm, gỗ nổi thì dây chùng', () => {
  const metal = buoyancyState(2, 1)
  assert.ok(Math.abs(metal.weight - 2) < 1e-9)
  assert.ok(Math.abs(metal.buoyant - 1) < 1e-9)
  assert.ok(Math.abs(metal.tension - 1) < 1e-9)
  assert.equal(metal.slack, false)
  const half = buoyancyState(2, 0.5)
  assert.ok(Math.abs(half.tension - 1.5) < 1e-9)
  const wood = buoyancyState(0.6, 1)
  assert.ok(Math.abs(wood.fraction - 0.6) < 1e-9)
  assert.equal(wood.tension, 0)
  assert.equal(wood.slack, true)
  const held = buoyancyState(0.6, 0.3)
  assert.equal(held.slack, false)
  assert.ok(Math.abs(held.tension - 0.3) < 1e-9)
  assert.ok(Math.abs(kept('buoyancy', 'wood', 'depth', [1])[0] - 1) < 1e-6)
  assert.ok(Math.abs(kept('buoyancy', 'metal', 'depth', [0])[0]) < 1e-6)
})

test('chưng cất, thu khí và tốc độ phản ứng', () => {
  const cold = distillState(0.4)
  assert.equal(cold.boiling, false)
  assert.equal(cold.drops, false)
  assert.ok(cold.temperature < 100)
  const boil = distillState(0.8)
  assert.equal(boil.boiling, true)
  assert.equal(boil.temperature, 100)
  assert.equal(boil.distillate, 'nước')
  assert.equal(boil.residue, 'muối')
  assert.equal(gasCollect('H2').method, 'water')
  assert.equal(gasCollect('NH3').method, 'up')
  assert.notEqual(gasCollect('NH3').method, 'water')
  assert.equal(gasCollect('CO2').method, 'down')
  assert.ok(gasCollect('H2').mass < 29)
  assert.ok(gasCollect('NH3').mass < 29)
  assert.ok(gasCollect('CO2').mass > 29)
  assert.ok(Math.abs(reactionRate(8, 25).surface - 2) < 1e-9)
  assert.ok(Math.abs(reactionRate(1, 35).thermal - 2) < 1e-9)
  assert.ok(Math.abs(reactionRate(1, 35).rate - reactionRate(8, 25).rate) < 1e-9)
  const cell = daniellCell(true)
  assert.equal(cell.voltage, 1.1)
  assert.equal(cell.electrons, 'Zn → Cu')
  assert.equal(daniellCell(false).current, 0)
  assert.ok(Math.abs(kept('distill', '', 'flame', [0.2])[0] - 0.2) < 1e-6)
  assert.equal(distillState(kept('distill', '', 'flame', [0.2])[0]).boiling, false)
  assert.equal(kept('galvanic', '', 'switch', [0])[0], 0)
  assert.equal(kept('galvanic', '', 'switch', [1])[0], 1)
  assert.equal(kept('rate', '', 'pieces', [8, 25])[0], 8)
  assert.ok(Math.abs(kept('rate', '', 'temp', [1, 35])[1] - 35) < 1e-6)
})

test('co nguyên sinh, quang hợp, nhóm máu và cung phản xạ', () => {
  assert.equal(protoplast(1).plasmolyzed, false)
  assert.equal(protoplast(0.4).volume, 1)
  assert.equal(protoplast(2).plasmolyzed, true)
  assert.ok(Math.abs(protoplast(2).volume - 0.5) < 1e-9)
  assert.equal(protoplast(3).volume, 0.42)
  assert.equal(starchIodine(true).name, 'vàng nâu')
  assert.equal(starchIodine(false).name, 'xanh đen')
  assert.equal(elodeaBubbles(0), 0)
  assert.ok(elodeaBubbles(1) < 2 * elodeaBubbles(0.5))
  assert.ok(elodeaBubbles(0.7) > elodeaBubbles(0.35))
  for (const serum of ['A', 'B'] as const) {
    assert.equal(agglutinates('O', serum), false)
    assert.equal(agglutinates('AB', serum), true)
  }
  assert.equal(agglutinates('A', 'A'), true)
  assert.equal(agglutinates('A', 'B'), false)
  assert.equal(agglutinates('B', 'A'), false)
  assert.equal(agglutinates('B', 'B'), true)
  assert.deepEqual([...REFLEX_PATH], ['receptor', 'sensory', 'spinal', 'motor', 'muscle'])
  assert.equal(reflexNeedsBrain(), false)
  assert.equal((REFLEX_PATH as readonly string[]).includes('brain'), false)
  const fresh = kept('osmosis', '', 'salt', [0.4])[0]
  assert.ok(Math.abs(fresh - 0.4) < 1e-6)
  assert.equal(protoplast(fresh).plasmolyzed, false)
  const salty = kept('osmosis', '', 'salt', [2])[0]
  assert.ok(salty > 1)
  assert.equal(protoplast(salty).plasmolyzed, true)
  assert.ok(Math.abs(kept('photo', 'elodea', 'light', [0])[0]) < 1e-6)
  assert.equal(elodeaBubbles(kept('photo', 'elodea', 'light', [0])[0]), 0)
})

test('bàn thí nghiệm chỉ chạy khi có thứ đang chuyển động', () => {
  assert.equal(figureSimulates('standing', 'string', true), true)
  assert.equal(figureSimulates('meters', '', true), true)
  assert.equal(figureSimulates('distill', '', true), true)
  assert.equal(figureSimulates('reflex', '', true), true)
  assert.equal(figureSimulates('photo', 'elodea', true), true)
  assert.equal(figureSimulates('buoyancy', 'wood', true), false)
  assert.equal(figureSimulates('osmosis', '', true), false)
  assert.equal(figureSimulates('slide', 'mitosis', true), false)
  assert.equal(figureSimulates('blood', 'O', true), false)
  assert.equal(figureSimulates('standing', 'string', false), false)
})
