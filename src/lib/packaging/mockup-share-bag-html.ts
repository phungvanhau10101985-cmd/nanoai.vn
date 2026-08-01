import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import type { BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'
import {
  downloadBlobFile,
  escapeAttr,
  escapeHtml,
} from '@/lib/packaging/mockup-share-html'

const BAG_FACE_ORDER: BagFaceSlot[] = ['front', 'back']

const BAG_SLOT_LABEL: Record<BagFaceSlot, string> = {
  front: 'Front',
  back: 'Back',
}

export function buildStandaloneBagMockupHtml(input: {
  dimensionsMm: BagDimensionsMm
  faceUrls: Partial<Record<BagFaceSlot, string>>
  title?: string
}): string {
  const payload = JSON.stringify({
    dimensionsMm: input.dimensionsMm,
    faceUrls: input.faceUrls,
  })
  const title = input.title ?? '3D Bag Mockup'
  const printableFacesHtml = BAG_FACE_ORDER.map((slot) => {
    const url = input.faceUrls[slot]
    const label = BAG_SLOT_LABEL[slot]
    const img = url
      ? `<img src="${escapeAttr(url)}" alt="${escapeAttr(label)}" crossorigin="anonymous" draggable="false" />`
      : ''
    return `<div class="face face-${slot}" data-slot="${slot}" aria-label="${escapeAttr(label)}">${img}</div>`
  }).join('\n')
  const structuralFacesHtml = [
    ['left-gusset', 'Gusset'],
    ['right-gusset', 'Gusset'],
    ['bottom', 'Bottom'],
  ]
    .map(
      ([id, label]) =>
        `<div class="face face-${id}" data-slot="${id}" aria-label="${escapeAttr(label)}"></div>`
    )
    .join('\n')

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
    .bag {
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
      <div class="bag" id="bag">
        ${printableFacesHtml}
        ${structuralFacesHtml}
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
    var bag = document.getElementById('bag');
    var btnAuto = document.getElementById('btnAuto');
    var btnReset = document.getElementById('btnReset');
    var dimsEl = document.getElementById('dims');
    var rotation = { x: INITIAL.x, y: INITIAL.y };
    var autoRotate = true;
    var drag = null;
    var raf = 0;
    var last = performance.now();

    var d = DATA.dimensionsMm;
    dimsEl.textContent = Math.round(d.width) + ' × ' + Math.round(d.height) + ' × ' + Math.round(d.gusset) + ' mm';

    function geometry() {
      var maxD = Math.max(d.width, d.gusset, d.height);
      var pxPerMm = maxD > 0 ? 210 / maxD : 1;
      var rect = scene.getBoundingClientRect();
      var w = d.width * pxPerMm, g = d.gusset * pxPerMm, h = d.height * pxPerMm;
      if (rect.width > 0 && rect.height > 0) {
        var bounds = projectedBounds(w, g, h, INITIAL.x, INITIAL.y);
        if (bounds.width > 0 && bounds.height > 0) {
          var fit = Math.min((rect.width * 0.9) / bounds.width, (rect.height * 0.9) / bounds.height);
          pxPerMm *= fit;
          w = d.width * pxPerMm; g = d.gusset * pxPerMm; h = d.height * pxPerMm;
        }
      }
      return { w: w, g: g, h: h, perspective: Math.max(520, Math.min(w * 2.8, 1400)) };
    }

    function projectedBounds(w, g, h, rx, ry) {
      var corners = [[-w/2,-h/2,-g/2],[w/2,-h/2,-g/2],[w/2,-h/2,g/2],[-w/2,-h/2,g/2],[-w/2,h/2,-g/2],[w/2,h/2,-g/2],[w/2,h/2,g/2],[-w/2,h/2,g/2]];
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
      var geo = geometry();
      scene.style.perspective = geo.perspective + 'px';
      var faces = [
        { slot: 'front', w: geo.w, h: geo.h, t: 'translateZ(' + (geo.g / 2) + 'px)' },
        { slot: 'back', w: geo.w, h: geo.h, t: 'rotateY(180deg) translateZ(' + (geo.g / 2) + 'px)' },
        { slot: 'left-gusset', w: geo.g, h: geo.h, t: 'rotateY(-90deg) translateZ(' + (geo.w / 2) + 'px)' },
        { slot: 'right-gusset', w: geo.g, h: geo.h, t: 'rotateY(90deg) translateZ(' + (geo.w / 2) + 'px)' },
        { slot: 'bottom', w: geo.w, h: geo.g, t: 'rotateX(-90deg) translateZ(' + (geo.h / 2) + 'px)' }
      ];
      for (var i = 0; i < faces.length; i++) {
        var el = bag.querySelector('.face-' + faces[i].slot);
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
      bag.style.transform = 'rotateX(' + rotation.x + 'deg) rotateY(' + rotation.y + 'deg)';
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

export function downloadStandaloneBagMockupHtml(input: {
  dimensionsMm: BagDimensionsMm
  faceUrls: Partial<Record<BagFaceSlot, string>>
  filename: string
  title?: string
}): void {
  const html = buildStandaloneBagMockupHtml(input)
  downloadBlobFile(new Blob([html], { type: 'text/html;charset=utf-8' }), input.filename)
}
