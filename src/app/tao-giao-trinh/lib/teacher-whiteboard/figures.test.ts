import assert from 'node:assert/strict'
import { test } from 'node:test'
import { balanceEquation, FIGURE_ITEMS, drawFigureLocal, figureClock, figureHandleAt, figureSimulates, freshFigureParams, lensImage, mirrorImage, mirrorRayError, mirrorScene, moveFigureTune, missingFormulaVariants, figureItem, litmusColor, litmusWord, phenolphthaleinColor, setWaveSources, toggleChemSwitch, toggleFigureRun, toggleTitrationValve, waveTankLayout, youngLayout } from './figures'

test('cân bằng phương trình phổ thông', () => {
  assert.equal(balanceEquation('H2 + O2 -> H2O'), '2H2 + O2 → 2H2O')
  assert.equal(balanceEquation('Fe + O2 -> Fe2O3'), '4Fe + 3O2 → 2Fe2O3')
  assert.equal(balanceEquation('CH4 + O2 -> CO2 + H2O'), 'CH4 + 2O2 → CO2 + 2H2O')
  assert.equal(balanceEquation('HCl + NaOH -> NaCl + H2O'), 'HCl + NaOH → NaCl + H2O')
  assert.equal(balanceEquation('C + O2 -> CO2'), 'C + O2 → CO2')
  assert.equal(balanceEquation('CaCO3 -> CaO + CO2'), 'CaCO3 → CaO + CO2')
  assert.equal(balanceEquation('Zn + HCl -> ZnCl2 + H2'), 'Zn + 2HCl → ZnCl2 + H2')
  assert.equal(balanceEquation('Na + H2O -> NaOH + H2'), '2Na + 2H2O → 2NaOH + H2')
  assert.equal(balanceEquation('Al + O2 -> Al2O3'), '4Al + 3O2 → 2Al2O3')
  assert.equal(balanceEquation('CuSO4 + Zn -> ZnSO4 + Cu'), 'CuSO4 + Zn → ZnSO4 + Cu')
  assert.equal(balanceEquation('không phải phương trình'), null)
})

test('mọi công thức có bản vẽ riêng', () => {
  assert.deepEqual(missingFormulaVariants(), [])
})

test('mọi loại sơ đồ có bản vẽ', () => {
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: () => () => undefined,
    set: () => true,
  })
  const subjects = new Set(FIGURE_ITEMS.map((item) => item.subject))
  assert.equal(subjects.size, 4)
  for (const item of FIGURE_ITEMS) {
    const params = freshFigureParams(item)
    drawFigureLocal(ctx, item.id, params, item.w, item.h)
    for (const variant of item.variants ?? []) {
      drawFigureLocal(ctx, item.id, { ...params, variant: variant.id, equation: variant.sample ?? params.equation }, item.w, item.h)
    }
  }
})

test('thấu kính kéo vật thì ảnh đổi theo công thức', () => {
  const at2f = lensImage(true, 2)
  assert.ok(Math.abs(at2f.dPrime - 2) < 1e-6)
  assert.ok(Math.abs(at2f.k + 1) < 1e-6)
  assert.equal(at2f.virtual, false)
  const inside = lensImage(true, 0.5)
  assert.equal(inside.virtual, true)
  assert.ok(inside.k > 1)
  const concave = lensImage(false, 2)
  assert.equal(concave.virtual, true)
  assert.ok(concave.k > 0 && concave.k < 1)
  const item = figureItem('ray')
  if (!item) throw new Error('thiếu thấu kính')
  const params = freshFigureParams(item)
  const handle = figureHandleAt('ray', params, item.w, item.h, { x: 70, y: 90 }, 18, 0)
  assert.equal(handle, 'object')
  const moved = moveFigureTune('ray', params, item.w, item.h, 'object', { x: 155, y: 70 }, 0)
  assert.ok(moved.tune[0] < 1.4)
  assert.equal(lensImage(true, moved.tune[0]).virtual, true)
})

test('gương kéo vật thì ảnh đổi theo công thức', () => {
  const atC = mirrorImage('concave', 2)
  assert.ok(Math.abs(atC.dPrime - 2) < 1e-6)
  assert.ok(Math.abs(atC.k + 1) < 1e-6)
  assert.equal(atC.virtual, false)
  const inside = mirrorImage('concave', 0.55)
  assert.equal(inside.virtual, true)
  assert.ok(inside.k > 1)
  const convex = mirrorImage('convex', 2)
  assert.equal(convex.virtual, true)
  assert.ok(convex.k > 0 && convex.k < 1)
  const plane = mirrorImage('plane', 1.4)
  assert.ok(Math.abs(plane.dPrime + 1.4) < 1e-6)
  assert.ok(Math.abs(plane.k - 1) < 1e-6)
  assert.equal(plane.virtual, true)
  assert.equal(mirrorImage('concave', 1).finite, false)
  for (const kind of ['concave', 'convex', 'plane'] as const) {
    const ratios = kind === 'concave' ? [0.55, 0.85, 1.4, 2, 2.4] : [0.8, 1.4, 2.2]
    for (const ratio of ratios) {
      const err = mirrorRayError(kind, ratio, 0.16)
      assert.ok(err < 1e-4, `${kind} d=${ratio} lệch ${err}`)
    }
  }
  const item = figureItem('mirror')
  if (!item) throw new Error('thiếu gương')
  assert.equal(figureSimulates('mirror', 'concave', true), true)
  const params = freshFigureParams(item)
  const scene = mirrorScene(item.w, item.h, 'concave')
  const handle = figureHandleAt('mirror', params, item.w, item.h, { x: scene.ox, y: scene.oy }, 12, 0)
  assert.equal(handle, 'object')
  const moved = moveFigureTune('mirror', params, item.w, item.h, 'object', { x: scene.mx - scene.unit * 0.6, y: scene.cy - 28 }, 0)
  assert.equal(mirrorImage('concave', moved.tune[0]).virtual, true)
  const planeMoved = moveFigureTune('mirror', { ...params, variant: 'plane' }, item.w, item.h, 'object', { x: scene.mx - scene.unit, y: scene.cy - 20 }, 0)
  assert.ok(Math.abs(mirrorImage('plane', planeMoved.tune[0]).k - 1) < 1e-6)
  const words: string[] = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, prop) => {
      if (prop === 'fillText') return (value: string) => { if (typeof value === 'string') words.push(value) }
      return () => undefined
    },
    set: () => true,
  })
  for (const variant of ['concave', 'convex', 'plane'] as const) {
    words.length = 0
    drawFigureLocal(ctx, 'mirror', { ...params, variant }, item.w, item.h, 0.4)
  }
  assert.ok(words.includes('Gương phẳng'))
  assert.ok(words.includes('ảnh ảo'))
  words.length = 0
  drawFigureLocal(ctx, 'mirror', { ...params, variant: 'concave' }, item.w, item.h, 0.2)
  assert.ok(words.includes('Gương cầu lõm'))
  assert.ok(words.includes('F'))
  assert.ok(words.includes('C'))
  assert.ok(words.includes('vật'))
  words.length = 0
  drawFigureLocal(ctx, 'mirror', { ...params, variant: 'convex' }, item.w, item.h, 0.2)
  assert.ok(words.includes('Gương cầu lồi'))
  assert.ok(words.includes('ảnh ảo'))
})

test('góc alpha mặt nghiêng nằm giữa đáy và mặt nghiêng', () => {
  const arcs: Array<[number, number, number, number, number, boolean]> = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, prop) => {
      if (prop === 'arc') {
        return (x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) => {
          arcs.push([x, y, r, a0, a1, ccw === true])
        }
      }
      return () => undefined
    },
    set: () => true,
  })
  const item = figureItem('force')
  if (!item) throw new Error('thiếu sơ đồ lực')
  drawFigureLocal(ctx, 'force', { ...freshFigureParams(item), variant: 'incline' }, item.w, item.h)
  const ang = Math.atan2(108, item.w - 28 - 36)
  const mark = arcs.find((arc) => Math.abs(arc[3] - Math.PI) < 1e-6)
  assert.ok(mark)
  assert.ok(Math.abs(mark[4] - (Math.PI + ang)) < 1e-6)
  assert.equal(mark[5], false)
})

test('phenolphtalein và giấy quỳ đổi đúng màu', () => {
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
  assert.equal(phenolphthaleinColor(10, 0), '#f8fafc')
  assert.equal(phenolphthaleinColor(0, 0), '#f8fafc')
  assert.equal(phenolphthaleinColor(5, 0), phenolphthaleinColor(5, 4))
  const pink = phenolphthaleinColor(0, 0.5)
  const deep = phenolphthaleinColor(0, 6)
  assert.notEqual(pink, '#f8fafc')
  assert.ok(channel(deep, 1) < channel(pink, 1))
  assert.equal(litmusColor(10, 0), '#dc2626')
  assert.equal(litmusColor(5, 0), '#dc2626')
  assert.equal(litmusColor(0, 0), '#7e22ce')
  assert.equal(litmusColor(0, 0.2), '#7e22ce')
  assert.equal(litmusColor(0, 6), '#1d4ed8')
  assert.ok(channel(litmusColor(0.4, 0), 2) > channel(litmusColor(10, 0), 2))
  assert.equal(litmusColor(5, 0), litmusColor(5, 4))
  assert.equal(litmusWord(10, 0), 'đỏ')
  assert.equal(litmusWord(5, 0), 'đỏ')
  assert.equal(litmusWord(0, 0), 'tím')
  assert.equal(litmusWord(0, 6), 'xanh')
})

test('đóng van thì dừng đúng lượng đã chảy', () => {
  const item = figureItem('titration')
  if (!item) throw new Error('thiếu chuẩn độ')
  const labels = (params: ReturnType<typeof freshFigureParams>, time: number) => {
    const words: string[] = []
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, prop) => {
        if (prop === 'fillText') return (value: string) => { if (typeof value === 'string') words.push(value) }
        return () => undefined
      },
      set: () => true,
    })
    drawFigureLocal(ctx, 'titration', params, item.w, item.h, time)
    return words
  }
  const running = { ...freshFigureParams(item), tune: [1, 0, 0], run: true }
  const midBase = labels(running, 8).find((word) => word.startsWith('bazơ '))
  assert.ok(midBase && midBase !== 'bazơ 16')
  const stopped = toggleTitrationValve(running, 8)
  assert.equal(stopped.tune[0], 0)
  const held = labels(stopped, 30)
  assert.ok(held.includes(midBase))
  assert.ok(!held.includes('bazơ 16'))
  const again = toggleTitrationValve(stopped, 30)
  assert.equal(again.tune[0], 1)
  assert.ok(labels(again, 30).includes(midBase))
  assert.notEqual(labels(again, 34).find((word) => word.startsWith('bazơ ')), midBase)
})

test('bảng tuần hoàn đủ 118 nguyên tố', () => {
  const item = figureItem('periodic')
  if (!item) throw new Error('thiếu bảng tuần hoàn')
  const spots: string[] = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, prop) => {
      if (prop === 'fillText') return (value: string) => { if (typeof value === 'string') spots.push(value) }
      return () => undefined
    },
    set: () => true,
  })
  drawFigureLocal(ctx, 'periodic', { ...freshFigureParams(item), label: 'Fe' }, item.w, item.h)
  const symbols = new Set(spots.filter((word) => /^[A-Z][a-z]?$/.test(word)))
  assert.ok(symbols.size >= 118)
  for (const symbol of ['H', 'He', 'C', 'Fe', 'La', 'Lu', 'U', 'Og']) assert.ok(symbols.has(symbol))
  assert.ok(spots.includes('118'))
  assert.ok(spots.includes('Hydro'))
  assert.ok(spots.includes('Sắt'))
  assert.ok(spots.includes('1,008'))
  assert.ok(spots.includes('55,85'))
  assert.ok(spots.includes('Oganesson'))
})

test('điện phân bấm nút nhấn đóng mở mạch', () => {
  const item = figureItem('chem-experiment')
  if (!item) throw new Error('thiếu điện phân')
  const params = freshFigureParams(item)
  const button = { x: item.w * 0.72, y: item.h * 0.24 }
  assert.equal(figureHandleAt('chem-experiment', params, item.w, item.h, button, 4), 'push')
  const words = (tune: number[]) => {
    const spots: string[] = []
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, prop) => {
        if (prop === 'fillText') return (value: string) => { if (typeof value === 'string') spots.push(value) }
        return () => undefined
      },
      set: () => true,
    })
    drawFigureLocal(ctx, 'chem-experiment', { ...params, tune }, item.w, item.h, 1)
    return spots
  }
  assert.ok(words([]).includes('nhả'))
  assert.ok(words([]).includes('H₂'))
  assert.ok(words([]).includes('nguồn'))
  assert.ok(words([]).includes('H₂SO₄ loãng'))
  assert.ok(words([]).includes('chỉ dẫn điện'))
  assert.ok(words([]).includes('không bị điện phân'))
  const off = toggleChemSwitch(params)
  assert.equal(off.tune[0], 0)
  assert.ok(words(off.tune).includes('nhấn'))
  assert.ok(words(off.tune).includes('mạch hở, không có khí'))
  assert.equal(toggleChemSwitch(off).tune[0], 1)
})

test('hết bazơ thì chạy lại từ đầu', () => {
  const item = figureItem('titration')
  if (!item) throw new Error('thiếu chuẩn độ')
  const labels = (time: number) => {
    const words: string[] = []
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, prop) => {
        if (prop === 'fillText') return (value: string) => { if (typeof value === 'string') words.push(value) }
        return () => undefined
      },
      set: () => true,
    })
    drawFigureLocal(ctx, 'titration', { ...freshFigureParams(item), tune: [1, 0, 0], run: true }, item.w, item.h, time)
    return words
  }
  assert.ok(labels(0).includes('bazơ 16'))
  assert.ok(labels(0).includes('axit 10'))
  assert.ok(!labels(8).includes('bazơ 16'))
  assert.ok(labels(16).includes('bazơ 16'))
  assert.ok(labels(16).includes('axit 10'))
  assert.ok(labels(16).includes('đỏ'))
})

test('nút van bấm được khi đang đóng và chữ ngược với trạng thái', () => {
  const item = figureItem('titration')
  if (!item) throw new Error('thiếu chuẩn độ')
  const closed = freshFigureParams(item)
  assert.equal(figureHandleAt('titration', closed, item.w, item.h, { x: item.w - 36, y: item.h * 0.4 }, 4), 'valve')
  const opened = toggleTitrationValve(closed, 3)
  assert.equal(opened.tune[0], 1)
  assert.equal(opened.tune[2], 3)
  const shut = toggleTitrationValve(opened, 8)
  assert.equal(shut.tune[0], 0)
})

test('van mở đang chạy thì giấy quỳ không kẹt một màu', () => {
  const item = figureItem('titration')
  if (!item) throw new Error('thiếu chuẩn độ')
  const paints = (time: number) => {
    const colors: string[] = []
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: () => () => undefined,
      set: (_target, prop, value) => {
        if (prop === 'fillStyle' && typeof value === 'string') colors.push(value)
        return true
      },
    })
    drawFigureLocal(ctx, 'titration', { ...freshFigureParams(item), tune: [1, 0, 0] }, item.w, item.h, time)
    return colors
  }
  const start = paints(0)
  const base = paints(15)
  assert.ok(start.includes('#dc2626'))
  assert.ok(start.includes('#f8fafc'))
  assert.ok(!base.includes('#dc2626'))
  assert.ok(base.some((color) => color !== '#e0f2fe' && color !== '#f8fafc'))
})

test('chuẩn độ không viết hai chữ cùng một chỗ', () => {
  const spots: Array<[string, number, number]> = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, prop) => {
      if (prop === 'fillText') {
        return (value: string, x: number, y: number) => {
          if (typeof value === 'string') spots.push([value, x, y])
        }
      }
      return () => undefined
    },
    set: () => true,
  })
  const item = figureItem('titration')
  if (!item) throw new Error('thiếu chuẩn độ')
  const assertApart = (marks: Array<[string, number, number]>) => {
    for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        const a = marks[i]
        const b = marks[j]
        assert.ok(Math.hypot(a[1] - b[1], a[2] - b[2]) > 18, `${a[0]} đè ${b[0]}`)
      }
    }
  }
  drawFigureLocal(ctx, 'titration', freshFigureParams(item), item.w, item.h, 1)
  assertApart(spots)
  assert.ok(spots.some((spot) => spot[0] === 'bazơ 16'))
  assert.ok(spots.some((spot) => spot[0] === 'axit 10'))
  assert.ok(spots.some((spot) => spot[0] === 'khoá kín, bazơ chưa chảy'))
  assert.ok(spots.some((spot) => spot[0] === 'mở'))
  assert.ok(spots.some((spot) => spot[0] === 'quỳ'))
  assert.ok(spots.some((spot) => spot[0] === 'đỏ'))
  assert.ok(spots.some((spot) => spot[0] === 'không màu'))
  spots.length = 0
  drawFigureLocal(ctx, 'titration', { ...freshFigureParams(item), tune: [1, 0, 0] }, item.w, item.h, 2)
  assertApart(spots)
  assert.ok(spots.some((spot) => spot[0] === 'đóng'))
  assert.ok(spots.some((spot) => spot[0] === 'bazơ chảy vào axit'))
  assert.ok(spots.some((spot) => spot[0].startsWith('axit ')))
})

test('thời gian âm vẫn vẽ được thí nghiệm', () => {
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: () => () => undefined,
    set: () => true,
  })
  assert.equal(figureClock({ run: true, shift: 12, clock: 4 }, 0), -12)
  for (const item of FIGURE_ITEMS) {
    const params = freshFigureParams(item)
    const stale = { ...params, run: true, shift: 12, clock: 4 }
    drawFigureLocal(ctx, item.id, stale, item.w, item.h, figureClock(stale, 0))
    drawFigureLocal(ctx, item.id, stale, 40, 24, Number.NaN)
    for (const variant of item.variants ?? []) {
      drawFigureLocal(
        ctx,
        item.id,
        { ...stale, variant: variant.id, equation: variant.sample ?? params.equation, tune: [] },
        item.w,
        item.h,
        -8,
      )
    }
  }
})

test('giao thoa sóng đổi một nguồn và khoảng cách hai đầu rung', () => {
  const item = figureItem('interfere')
  assert.ok(item)
  assert.equal(figureSimulates('interfere', '', true), true)
  const params = freshFigureParams(item)
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: () => () => undefined,
    set: () => true,
  })
  drawFigureLocal(ctx, 'interfere', params, item.w, item.h, 1.4)
  drawFigureLocal(ctx, 'interfere', setWaveSources(params, false), item.w, item.h, -2)
  assert.equal(setWaveSources(params, false).tune[1], 0)
  assert.equal(setWaveSources(params, true).tune[1], 1)
  const far = moveFigureTune('interfere', params, item.w, item.h, 's2', { x: item.w * 0.62, y: item.h * 0.4 }, 0)
  const near = moveFigureTune('interfere', params, item.w, item.h, 's2', { x: item.w * 0.4, y: item.h * 0.4 }, 0)
  assert.ok(far.tune[0] > near.tune[0])
  assert.equal(setWaveSources(far, false).tune[0], far.tune[0])
  const scene = waveTankLayout(item.w, item.h, params.tune)
  assert.equal(figureHandleAt('interfere', params, item.w, item.h, scene.s2, 16, 0), 's2')
  assert.equal(figureHandleAt('interfere', params, item.w, item.h, { x: scene.panelX + scene.panelW * 0.5, y: scene.oneY }, 18, 0), 'one')
  assert.equal(figureHandleAt('interfere', params, item.w, item.h, { x: scene.panelX + scene.panelW * 0.78, y: scene.twoY }, 18, 0), 'two')
  assert.equal(scene.both, true)
  assert.ok(scene.s2.x - scene.s1.x > scene.lambda)
})

test('thí nghiệm Young đổi d và L thì khoảng vân đổi', () => {
  const item = figureItem('young')
  assert.ok(item)
  assert.equal(figureSimulates('young', '', true), true)
  const params = freshFigureParams(item)
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: () => () => undefined,
    set: () => true,
  })
  drawFigureLocal(ctx, 'young', params, item.w, item.h, 1.2)
  drawFigureLocal(ctx, 'young', params, item.w, item.h, -3)
  const wide = moveFigureTune('young', params, item.w, item.h, 'slit', { x: item.w * 0.3, y: item.h * 0.75 }, 0)
  const narrow = moveFigureTune('young', params, item.w, item.h, 'slit', { x: item.w * 0.3, y: item.h * 0.5 }, 0)
  assert.ok(wide.tune[0] > narrow.tune[0])
  const far = moveFigureTune('young', params, item.w, item.h, 'screen', { x: item.w * 0.7, y: item.h * 0.4 }, 0)
  const near = moveFigureTune('young', params, item.w, item.h, 'screen', { x: item.w * 0.35, y: item.h * 0.4 }, 0)
  assert.ok(far.tune[1] > near.tune[1])
  assert.equal(moveFigureTune('young', wide, item.w, item.h, 'screen', { x: item.w * 0.7, y: item.h * 0.4 }, 0).tune[0], wide.tune[0])
  const scene = youngLayout(item.w, item.h, params.tune)
  assert.equal(figureHandleAt('young', params, item.w, item.h, scene.slitHandle, 16, 0), 'slit')
  assert.equal(figureHandleAt('young', params, item.w, item.h, { x: scene.screenX + 10, y: scene.midY }, 16, 0), 'screen')
  const bigD = youngLayout(item.w, item.h, [0.28, 0.55])
  const smallD = youngLayout(item.w, item.h, [0.08, 0.55])
  assert.ok(smallD.fringe > bigD.fringe)
  const longL = youngLayout(item.w, item.h, [0.18, 1])
  const shortL = youngLayout(item.w, item.h, [0.18, 0])
  assert.ok(longL.fringe > shortL.fringe)
  assert.ok(Math.abs(scene.fringe - scene.lambda * scene.L / scene.d) < 0.01)
})

test('bấm chạy rồi đứng im giữ đúng thời điểm', () => {
  const base = freshFigureParams(figureItem('experiment-phys')!)
  const playing = toggleFigureRun({ ...base, run: false, clock: 1.5, shift: 0 }, 4)
  assert.equal(playing.run, true)
  assert.equal(figureClock(playing, 4), 1.5)
  assert.equal(figureClock(playing, 6), 3.5)
  const paused = toggleFigureRun(playing, 6)
  assert.equal(paused.run, false)
  assert.equal(figureClock(paused, 20), 3.5)
})
