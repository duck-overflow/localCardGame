const draggable = document.getElementById('draggable');
const container = document.getElementById('container');
const boardImage = document.getElementById('board-image');

if (!draggable || !container) {
} else {
    draggable.setAttribute('draggable', 'false');
    draggable.addEventListener('dragstart', (e) => e.preventDefault());

    draggable.style.willChange = 'transform';
    draggable.style.transition = 'transform 90ms ease-out';

    let isDragging = false;
    let pointerId = null;
    let startX = 0, startY = 0;
    let baseX = 0, baseY = 0;
    let isZoomOpen = false;
    let lastTapTime = 0;
    const TAP_DT = 300;
    const TAP_MOVE = 8;

    function getTranslate(el) {
        const st = window.getComputedStyle(el);
        const m = st.transform || st.webkitTransform || 'none';
        if (m === 'none') return { x: 0, y: 0 };
        const values = m.match(/matrix\(([^)]+)\)/);
        if (values && values[1]) {
            const parts = values[1].split(',').map(parseFloat);
            // matrix(a, b, c, d, tx, ty)
            return { x: parts[4] || 0, y: parts[5] || 0 };
        }
        const values3d = m.match(/matrix3d\(([^)]+)\)/);
        if (values3d && values3d[1]) {
            const p = values3d[1].split(',').map(parseFloat);
            return { x: p[12] || 0, y: p[13] || 0 };
        }
        return { x: 0, y: 0 };
    }

    function setTranslate(el, x, y) {
        el.style.transform = `translate(${x}px, ${y}px)`;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function getSnapTargets() {
        // Elements with class 'snap-point' inside container (e.g. slots)
        // We convert them into TARGET TOP-LEFT positions that would center
        // the card over the snap element by default. This avoids a visual
        // offset when snapping into frames.
        const rectC = container.getBoundingClientRect();
        const cardRect = draggable.getBoundingClientRect();
        const cardW = cardRect.width;
        const cardH = cardRect.height;
        const points = Array.from(container.querySelectorAll('.snap-point')).map((el) => {
            const r = el.getBoundingClientRect();
            const align = el.dataset.snapAlign || 'center'; // 'center' | 'topleft'
            if (align === 'topleft') {
                // align card's top-left to element's top-left
                return { x: r.left - rectC.left, y: r.top - rectC.top, cx: r.left - rectC.left + r.width/2, cy: r.top - rectC.top + r.height/2 };
            }
            // Default: place card centered inside the snap element
            const tx = (r.left - rectC.left) + (r.width - cardW) / 2;
            const ty = (r.top - rectC.top) + (r.height - cardH) / 2;
            return { x: tx, y: ty, cx: tx + cardW/2, cy: ty + cardH/2 };
        });
        return points;
    }

    function snapTo(x, y) {
        const points = getSnapTargets();
        if (points.length > 0) {
            // Choose the snap whose CENTER is closest to the card center
            const cardW = draggable.getBoundingClientRect().width;
            const cardH = draggable.getBoundingClientRect().height;
            const cardCX = x + cardW / 2;
            const cardCY = y + cardH / 2;
            let best = null, bestD = Infinity;
            for (const p of points) {
                // Ensure cx/cy exist even for topleft alignment
                const cx = p.cx ?? (p.x + cardW/2);
                const cy = p.cy ?? (p.y + cardH/2);
                const dx = cx - cardCX;
                const dy = cy - cardCY;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestD) { bestD = d2; best = p; }
            }
            return { x: best.x, y: best.y };
        }
        // Fallback: dynamic grid snapping basierend auf Boardgröße
        // Anchor grid to the board's visible area so snapping doesn't drift
        const contRect = container.getBoundingClientRect();
        const boardRect = boardImage ? boardImage.getBoundingClientRect() : contRect;
        const originX = Math.max(0, boardRect.left - contRect.left);
        const originY = Math.max(0, boardRect.top - contRect.top);
        const grid = Math.max(24, Math.min(64, Math.floor(boardRect.width / 24)));
        return {
            x: Math.round((x - originX) / grid) * grid + originX,
            y: Math.round((y - originY) / grid) * grid + originY,
        };
    }

    function onPointerDown(e) {
    if (isZoomOpen) return; // ignore drags while zoom is open
        if (pointerId !== null) return; // ignore multi-pointer
        pointerId = e.pointerId;
        draggable.setPointerCapture(pointerId);
        isDragging = true;
        const t = getTranslate(draggable);
        baseX = t.x; baseY = t.y;
        startX = e.clientX; startY = e.clientY;
        draggable.style.cursor = 'grabbing';
    }

    function getAllowedBounds() {
        // Begrenze die Karte auf den sichtbaren Bereich des Board-Bildes
        const contRect = container.getBoundingClientRect();
        const boardRect = boardImage ? boardImage.getBoundingClientRect() : contRect;
        const elRect = draggable.getBoundingClientRect();
        const minX = Math.max(0, boardRect.left - contRect.left);
        const minY = Math.max(0, boardRect.top - contRect.top);
        const maxX = Math.min(contRect.width, boardRect.right - contRect.left) - elRect.width;
        const maxY = Math.min(contRect.height, boardRect.bottom - contRect.top) - elRect.height;
        return { minX, minY, maxX: Math.max(minX, maxX), maxY: Math.max(minY, maxY) };
    }

    function onPointerMove(e) {
        if (!isDragging || e.pointerId !== pointerId) return;
        // Prevent page scroll/zoom while dragging
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Clamp innerhalb des sichtbaren Board-Bildes
        const { minX, minY, maxX, maxY } = getAllowedBounds();
        const nx = clamp(baseX + dx, minX, maxX);
        const ny = clamp(baseY + dy, minY, maxY);
        setTranslate(draggable, nx, ny);
    }

    function onPointerUp(e) {
        if (e.pointerId !== pointerId) return;
    // Snap into place
        const t = getTranslate(draggable);
        const snapped = snapTo(t.x, t.y);
    const { minX, minY, maxX, maxY } = getAllowedBounds();
    setTranslate(draggable, clamp(snapped.x, minX, maxX), clamp(snapped.y, minY, maxY));

        isDragging = false;
        draggable.style.cursor = 'grab';
        try { draggable.releasePointerCapture(pointerId); } catch {}
        pointerId = null;
        // Persist new base
        const finalT = getTranslate(draggable);
        baseX = finalT.x; baseY = finalT.y;

        // Double-tap to zoom (use small move threshold to avoid triggering after drags)
        const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
        const now = Date.now();
        if (moved < TAP_MOVE) {
            if (now - lastTapTime < TAP_DT) {
                openZoom();
                lastTapTime = 0; // reset
            } else {
                lastTapTime = now;
            }
        } else {
            lastTapTime = 0;
        }
    }

    function clampIntoBounds() {
        const t = getTranslate(draggable);
        const { minX, minY, maxX, maxY } = getAllowedBounds();
        const nx = clamp(t.x, minX, maxX);
        const ny = clamp(t.y, minY, maxY);
        setTranslate(draggable, nx, ny);
        baseX = nx; baseY = ny;
    }

    draggable.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', () => {
        // kurz warten, bis Layout stabil ist
        requestAnimationFrame(clampIntoBounds);
    });
    // initial sicherstellen, dass die Karte im Board liegt
    requestAnimationFrame(clampIntoBounds);

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Standard: eine Seite zurück, falls im Browserkontext; andernfalls auf Startseite
            if (window.history.length > 1) window.history.back();
            else window.location.href = '/';
        });
    }

    // ---------- Zoom Overlay (dblclick / double-tap) ----------
    function ensureZoomOverlay() {
        let overlay = document.getElementById('zoom-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'zoom-overlay';
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'background:rgba(0,0,0,0.75)',
                'display:none',
                'align-items:center',
                'justify-content:center',
                'z-index:9999',
                'padding:4vh 3vw'
            ].join(';');
            const img = document.createElement('img');
            img.id = 'zoom-image';
            img.alt = 'Card zoom';
            img.style.cssText = [
                'max-width:92vw',
                'max-height:92vh',
                'height:92vh',
                'width:auto',
                'object-fit:contain',
                'border-radius:12px',
                'box-shadow:0 12px 40px rgba(0,0,0,0.55)'
            ].join(';');
            overlay.appendChild(img);
            document.body.appendChild(overlay);
            // Close interactions
            overlay.addEventListener('click', closeZoom);
            window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeZoom(); });
        }
        return overlay;
    }

    function openZoom(src) {
        const overlay = ensureZoomOverlay();
        const img = overlay.querySelector('#zoom-image');
        const finalSrc = src || (draggable ? draggable.src : '');
        if (img && finalSrc) img.src = finalSrc;
        overlay.style.display = 'flex';
        isZoomOpen = true;
    }

    function closeZoom() {
        const overlay = ensureZoomOverlay();
        overlay.style.display = 'none';
        isZoomOpen = false;
    }

    // Mouse dblclick support (board card)
    draggable.addEventListener('dblclick', (e) => {
        e.preventDefault();
        openZoom(draggable.src);
    });

    // Handkarten: dblclick / double-tap Zoom
    function setupHandCardZoom() {
        const cards = Array.from(document.querySelectorAll('#hand .card'));
        const lastTapMap = new WeakMap();
        const downPos = new WeakMap();
        cards.forEach((el) => {
            // dblclick (mouse)
            el.addEventListener('dblclick', (ev) => {
                ev.preventDefault();
                openZoom(el.src);
            });
            // track down for move distance
            el.addEventListener('pointerdown', (ev) => {
                downPos.set(el, { x: ev.clientX, y: ev.clientY });
            }, { passive: true });
            el.addEventListener('pointerup', (ev) => {
                const now = Date.now();
                const last = lastTapMap.get(el) || 0;
                const d = downPos.get(el) || { x: ev.clientX, y: ev.clientY };
                const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
                if (moved < TAP_MOVE) {
                    if (now - last < TAP_DT) {
                        openZoom(el.src);
                        lastTapMap.set(el, 0);
                    } else {
                        lastTapMap.set(el, now);
                    }
                } else {
                    lastTapMap.set(el, 0);
                }
            });
        });
    }

    setupHandCardZoom();
}
