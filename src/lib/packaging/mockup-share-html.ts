import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'

const SLOT_ORDER: BoxFaceSlot[] = ['top', 'front', 'right', 'bottom', 'back', 'left']

const SLOT_LABEL: Record<BoxFaceSlot, string> = {
  top: 'Top',
  front: 'Front',
  right: 'Right',
  bottom: 'Bottom',
  back: 'Back',
  left: 'Left',
}

export function buildStandaloneMockupHtml(input: {
  dimensionsMm: BoxDimensionsMm
  faceUrls: Partial<Record<BoxFaceSlot, string>>
  title?: string
}): string {
  const payload = JSON.stringify({
    dimensionsMm: input.dimensionsMm,
    faceUrls: input.faceUrls,
  })
  const title = input.title ?? '3D Box Mockup'
  const facesHtml = SLOT_ORDER.map((slot) => {
    const url = input.faceUrls[slot]
    const label = SLOT_LABEL[slot]
    const img = url
      ? `<img src="${escapeAttr(url)}" alt="${escapeAttr(label)}" crossorigin="anonymous" draggable="false" />`
      : ''
    return `<div class="face face-${slot}" data-slot="${slot}" aria-label="${escapeAttr(label)}">${img}</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%); color: #334155; }
    .wrap { display: flex; flex-direction: column; min-height: 100%; max-width: 720px; margin: 0 auto; padding: 16px; gap: 12px; }
    h1 { font-size: 1rem; font-weight: 600; margin: 0; text-align: center; }
    .scene {
      position: relative; flex: 1; min-height: 320px; height: min(62vh, 520px);
      border-radius: 12px; overflow: hidden; cursor: grab; touch-action: none;
      background: linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
    .scene:active { cursor: grabbing; }
    .box {
      position: absolute; left: 50%; top: 50%; width: 0; height: 0;
      transform-style: preserve-3d; will-change: transform;
    }
    .face {
      position: absolute; overflow: hidden; border: 1px solid rgba(0,0,0,0.1);
      background: #c9b08a; backface-visibility: hidden; transform: translateZ(0);
    }
    .face img { width: 100%; height: 100%; object-fit: cover; object-position: center; user-select: none; pointer-events: none; display: block; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    .hint { font-size: 12px; margin: 0; opacity: 0.85; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
    button {
      font: inherit; font-size: 12px; padding: 6px 10px; border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.15); background: #fff; cursor: pointer;
    }
    button:hover { background: #f8fafc; }
    .dims { text-align: center; font-size: 11px; opacity: 0.7; margin: 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p class="dims" id="dims"></p>
    <div class="scene" id="scene" aria-label="Drag to rotate">
      <div class="box" id="box">
        ${facesHtml}
      </div>
    </div>
    <div class="toolbar">
      <p class="hint">Drag to rotate · Double-click to reset</p>
      <div class="actions">
        <button type="button" id="btnAuto">Auto rotate</button>
        <button type="button" id="btnReset">Reset view</button>
      </div>
    </div>
  </div>
  <script>
  (function () {
    var DATA = ${payload};
    var INITIAL = { x: -18, y: 28 };
    var scene = document.getElementById('scene');
    var box = document.getElementById('box');
    var btnAuto = document.getElementById('btnAuto');
    var btnReset = document.getElementById('btnReset');
    var dimsEl = document.getElementById('dims');
    var rotation = { x: INITIAL.x, y: INITIAL.y };
    var autoRotate = true;
    var drag = null;
    var raf = 0;
    var last = performance.now();

    var d = DATA.dimensionsMm;
    dimsEl.textContent = Math.round(d.length) + ' × ' + Math.round(d.width) + ' × ' + Math.round(d.height) + ' mm';

    function geometry() {
      var maxD = Math.max(d.length, d.width, d.height);
      var pxPerMm = maxD > 0 ? 210 / maxD : 1;
      var rect = scene.getBoundingClientRect();
      var l = d.length * pxPerMm, w = d.width * pxPerMm, h = d.height * pxPerMm;
      if (rect.width > 0 && rect.height > 0) {
        var bounds = projectedBounds(l, w, h, INITIAL.x, INITIAL.y);
        if (bounds.width > 0 && bounds.height > 0) {
          var fit = Math.min((rect.width * 0.9) / bounds.width, (rect.height * 0.9) / bounds.height);
          pxPerMm *= fit;
          l = d.length * pxPerMm; w = d.width * pxPerMm; h = d.height * pxPerMm;
        }
      }
      return { l: l, w: w, h: h, perspective: Math.max(520, Math.min(l * 2.8, 1400)) };
    }

    function projectedBounds(l, w, h, rx, ry) {
      var corners = [[-l/2,-h/2,-w/2],[l/2,-h/2,-w/2],[l/2,-h/2,w/2],[-l/2,-h/2,w/2],[-l/2,h/2,-w/2],[l/2,h/2,-w/2],[l/2,h/2,w/2],[-l/2,h/2,w/2]];
      var ryd = ry * Math.PI / 180, rxd = rx * Math.PI / 180;
      var cY = Math.cos(ryd), sY = Math.sin(ryd), cX = Math.cos(rxd), sX = Math.sin(rxd);
      var xs = [], ys = [];
      for (var i = 0; i < corners.length; i++) {
        var x = corners[i][0], y = corners[i][1], z = corners[i][2];
        var x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        var y1 = y * cX - z1 * sX;
        xs.push(x1); ys.push(y1);
      }
      return { width: Math.max.apply(null, xs) - Math.min.apply(null, xs), height: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
    }

    function layoutFaces() {
      var g = geometry();
      scene.style.perspective = g.perspective + 'px';
      var faces = [
        { slot: 'front', w: g.l, h: g.h, t: 'translateZ(' + (g.w / 2) + 'px)' },
        { slot: 'back', w: g.l, h: g.h, t: 'rotateY(180deg) translateZ(' + (g.w / 2) + 'px)' },
        { slot: 'right', w: g.w, h: g.h, t: 'rotateY(90deg) translateZ(' + (g.l / 2) + 'px)' },
        { slot: 'left', w: g.w, h: g.h, t: 'rotateY(-90deg) translateZ(' + (g.l / 2) + 'px)' },
        { slot: 'top', w: g.l, h: g.w, t: 'rotateX(90deg) translateZ(' + (g.h / 2) + 'px)' },
        { slot: 'bottom', w: g.l, h: g.w, t: 'rotateX(-90deg) translateZ(' + (g.h / 2) + 'px)' }
      ];
      for (var i = 0; i < faces.length; i++) {
        var el = box.querySelector('.face-' + faces[i].slot);
        if (!el) continue;
        el.style.width = faces[i].w + 'px';
        el.style.height = faces[i].h + 'px';
        el.style.marginLeft = (-faces[i].w / 2) + 'px';
        el.style.marginTop = (-faces[i].h / 2) + 'px';
        el.style.transform = faces[i].t;
      }
      applyRotation();
    }

    function applyRotation() {
      box.style.transform = 'rotateX(' + rotation.x + 'deg) rotateY(' + rotation.y + 'deg)';
    }

    function tick(now) {
      if (autoRotate) {
        var elapsed = Math.min(now - last, 50);
        rotation.y += elapsed * 0.018;
        applyRotation();
      }
      last = now;
      raf = requestAnimationFrame(tick);
    }

    scene.addEventListener('pointerdown', function (e) {
      autoRotate = false;
      btnAuto.textContent = 'Auto rotate';
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, rx: rotation.x, ry: rotation.y };
      scene.setPointerCapture(e.pointerId);
    });
    scene.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      rotation.x = Math.max(-80, Math.min(80, drag.rx - (e.clientY - drag.y) * 0.35));
      rotation.y = drag.ry + (e.clientX - drag.x) * 0.45;
      applyRotation();
    });
    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      drag = null;
      if (scene.hasPointerCapture(e.pointerId)) scene.releasePointerCapture(e.pointerId);
    }
    scene.addEventListener('pointerup', endDrag);
    scene.addEventListener('pointercancel', endDrag);
    scene.addEventListener('dblclick', function () {
      rotation = { x: INITIAL.x, y: INITIAL.y };
      applyRotation();
    });
    btnReset.addEventListener('click', function () {
      rotation = { x: INITIAL.x, y: INITIAL.y };
      applyRotation();
    });
    btnAuto.addEventListener('click', function () {
      autoRotate = !autoRotate;
      btnAuto.textContent = autoRotate ? 'Pause rotation' : 'Auto rotate';
    });
    window.addEventListener('resize', layoutFaces);
    layoutFaces();
    raf = requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadStandaloneMockupHtml(input: {
  dimensionsMm: BoxDimensionsMm
  faceUrls: Partial<Record<BoxFaceSlot, string>>
  filename: string
  title?: string
}): void {
  const html = buildStandaloneMockupHtml(input)
  downloadBlobFile(new Blob([html], { type: 'text/html;charset=utf-8' }), input.filename)
}
