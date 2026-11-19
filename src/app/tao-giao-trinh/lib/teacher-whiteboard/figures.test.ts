import assert from 'node:assert/strict'
import { test } from 'node:test'
import { balanceEquation, FIGURE_ITEMS, drawFigureLocal, figureClock, figureHandleAt, freshFigureParams, lensImage, moveFigureTune, missingFormulaVariants, figureItem, litmusColor, litmusWord, phenolphthaleinColor, toggleChemSwitch, toggleFigureRun, toggleTitrationValve } from './figures'

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
