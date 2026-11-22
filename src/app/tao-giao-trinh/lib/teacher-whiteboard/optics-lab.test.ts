import assert from 'node:assert/strict'
import { test } from 'node:test'
import { figureHandleAt, figureItem, figureSimulates, freshFigureParams, moveFigureTune } from './figures'
import {
  criticalAngle,
  fiberGuided,
  fiberScene,
  gratingSin,
  hydrogenLinePos,
  loupeImage,
  microscopePower,
  moveOpticsTune,
  opticsHandles,
  prismAngleFromPoint,
  prismBend,
  prismHandle,
  prismRayDelta,
  slabScene,
  slabShift,
  slitSin,
  telescopeAngles,
  tirCast,
  tirScene,
} from './optics-lab'

test('phản xạ toàn phần đúng góc giới hạn', () => {
  const ic = criticalAngle(1.5, 1)
  assert.ok(Math.abs(ic - (Math.asin(1 / 1.5) * 180) / Math.PI) < 1e-6)
  const below = tirCast(1.5, 1, 30)
  assert.equal(below.mode, 'refract')
  assert.ok(below.r > 30)
  assert.equal(tirCast(1.5, 1, 55).mode, 'reflect')
  const scene = tirScene(400, 240)
  const back = moveOpticsTune('tir', 'boundary', undefined, 400, 240, 'ray', scene.x1, scene.y1)
  assert.ok(back)
  assert.ok(Math.abs(back[0] - scene.i) < 0.25)
  const steep = (55 * Math.PI) / 180
  const dragged = moveOpticsTune('tir', 'boundary', undefined, 400, 240, 'ray', scene.hx - Math.sin(steep) * 80, scene.hy + Math.cos(steep) * 80)
  assert.ok(dragged)
  assert.ok(Math.abs(dragged[0] - 55) < 0.4)
  assert.equal(tirCast(1.5, 1, dragged[0]).mode, 'reflect')
  const fiber = fiberScene(400, 240)
  assert.equal(fiber.guided, true)
  const same = moveOpticsTune('tir', 'fiber', undefined, 400, 240, 'ray', fiber.handle.x, fiber.handle.y)
  assert.ok(same && Math.abs(same[0] - fiber.phi) < 0.25)
  assert.equal(fiberGuided(12, 1.5, 1.4), true)
  assert.equal(fiberGuided(32, 1.5, 1.4), false)
})

test('bản mặt song song dịch tia và tia ló song song', () => {
  const i = (45 * Math.PI) / 180
  const r = Math.asin(Math.sin(i) / 1.5)
  const expect = (100 * Math.sin(i - r)) / Math.cos(r)
  assert.ok(Math.abs(slabShift(45, 1.5, 100) - expect) < 1e-6)
  assert.ok(slabShift(45, 1.5, 100) > 0)
  const scene = slabScene(400, 230)
  const back = moveOpticsTune('slab', '', undefined, 400, 230, 'ray', scene.x0, scene.y0)
  assert.ok(back && Math.abs(back[0] - scene.i) < 0.25)
  const wider = moveOpticsTune('slab', '', undefined, 400, 230, 'ray', scene.face1 - 40, scene.yHit - 70)
  assert.ok(wider && wider[0] > scene.i)
  assert.ok(slabShift(wider[0], 1.5, scene.thickness) > scene.shift)
})

test('lăng kính tím lệch hơn đỏ và khớp cách vẽ', () => {
  const red = prismBend(50, 1.5)
  const violet = prismBend(50, 1.64)
  assert.ok(red && violet && !red.tir && !violet.tir)
  assert.ok(violet.delta > red.delta)
  const drawnRed = prismRayDelta(50, 1.5)
  const drawnViolet = prismRayDelta(50, 1.64)
  assert.ok(drawnRed != null && drawnViolet != null)
  assert.ok(Math.abs(drawnRed - red.delta) < 0.5, `đỏ vẽ ${drawnRed} tính ${red.delta}`)
  assert.ok(Math.abs(drawnViolet - violet.delta) < 0.5, `tím vẽ ${drawnViolet} tính ${violet.delta}`)
  const handle = prismHandle(420, 260)
  assert.ok(Math.abs(prismAngleFromPoint(420, 260, handle.x, handle.y) - 50) < 0.3)
})

test('nhiễu xạ, kính và quang phổ hiđro', () => {
  assert.ok(slitSin(0.6, 0.3) > slitSin(0.6, 0.8))
  assert.ok(slitSin(0.65, 0.5) > slitSin(0.45, 0.5))
  const close = gratingSin(1, 0.5, 0.8)
  const wide = gratingSin(1, 0.5, 1.4)
  assert.ok(close != null && wide != null && close > wide)
  assert.equal(gratingSin(2, 0.7, 0.5), null)
  const micro = microscopePower(1.4)
  assert.ok(micro.kObj < 0 && micro.k < 0 && Math.abs(micro.k) > 1)
  assert.ok(Math.abs(telescopeAngles(5, 4).out - 20) < 1e-6)
  const loupe = loupeImage(0.62)
  assert.ok(loupe.dPrime < 0 && loupe.k > 1)
  assert.ok(Math.abs(hydrogenLinePos(656) - hydrogenLinePos(486)) > 0.4)
  assert.ok(Math.abs(hydrogenLinePos(656) - (656 - 400) / 300) < 1e-9)
  assert.ok(Math.abs(hydrogenLinePos(486) - hydrogenLinePos(486)) < 1e-12)
})

test('kéo núm quang học giữ đúng số khi thả tại chỗ', () => {
  const cases: Array<[string, string, number, number, number[] | undefined]> = [
    ['tir', 'boundary', 400, 240, undefined],
    ['tir', 'fiber', 400, 240, [18]],
    ['slab', '', 400, 230, [36]],
    ['eye', 'normal', 500, 280, [0.5]],
    ['eye', 'myopia', 500, 280, [1]],
    ['eye', 'myopia', 500, 280, [0]],
    ['eye', 'hyper', 500, 280, [0]],
    ['eye', 'loupe', 500, 280, [0.7, 0.1]],
    ['eye', 'micro', 500, 280, [1.55]],
    ['eye', 'tele', 500, 280, [5]],
    ['diffract', 'slit', 460, 260, [0.7, 0.48]],
    ['diffract', 'grating', 460, 260, [0.4, 0.62]],
  ]
  for (const [figure, variant, w, h, tune] of cases) {
    for (const handle of opticsHandles(figure, variant, tune, w, h)) {
      const next = moveOpticsTune(figure, variant, tune, w, h, handle.id, handle.x, handle.y)
      assert.ok(next, `${figure}/${variant}/${handle.id}`)
      const again = opticsHandles(figure, variant, next, w, h).find((item) => item.id === handle.id)
      assert.ok(again, `${figure} mất núm ${handle.id}`)
      assert.ok(Math.hypot(again.x - handle.x, again.y - handle.y) < 1.5, `${figure}/${variant}/${handle.id} lệch núm`)
    }
  }
})

test('bảng trắng gắn thí nghiệm quang học', () => {
  assert.equal(figureSimulates('tir', 'boundary', true), true)
  assert.equal(figureSimulates('slab', '', true), true)
  assert.equal(figureSimulates('eye', 'loupe', true), false)
  assert.equal(figureSimulates('diffract', 'slit', true), false)
  assert.equal(figureSimulates('spectrum', 'emission', true), false)
  for (const id of ['tir', 'slab', 'eye', 'diffract', 'spectrum']) {
    assert.ok(figureItem(id), id)
  }
  const tir = figureItem('tir')
  if (!tir) throw new Error('thiếu phản xạ toàn phần')
  const params = freshFigureParams(tir)
  const scene = tirScene(tir.w, tir.h)
  assert.equal(figureHandleAt('tir', params, tir.w, tir.h, { x: scene.x1, y: scene.y1 }, 12, 0), 'ray')
  const moved = moveFigureTune('tir', { ...params, variant: 'boundary' }, tir.w, tir.h, 'ray', { x: scene.hx - 20, y: scene.hy + 30 }, 0)
  assert.ok(moved.tune[0] > 20)
  const fiber = freshFigureParams(tir)
  fiber.variant = 'fiber'
  const leaked = moveFigureTune('tir', fiber, tir.w, tir.h, 'ray', { x: 90, y: 70 }, 0)
  assert.equal(fiberGuided(leaked.tune[0], 1.5, 1.4), false)
})
