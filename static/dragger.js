// Pointer Events basiertes Dragging mit Snap-Punkten und mobilem Scroll-Schutz
const draggable = document.getElementById('draggable');
const container = document.getElementById('container');
const boardImage = document.getElementById('board-image');

if (!draggable || !container) {
    // nothing to do
} else {
    // Disable native image dragging and text selection behaviors
    draggable.setAttribute('draggable', 'false');
    draggable.addEventListener('dragstart', (e) => e.preventDefault());

    // Use transform translate for smoother performance
    draggable.style.willChange = 'transform';

    let isDragging = false;
    let pointerId = null;
    let startX = 0, startY = 0; // pointer start
    let baseX = 0, baseY = 0;   // element base translate at drag start

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
        // Optional: elements with class 'snap-point' inside container
        const rectC = container.getBoundingClientRect();
        const points = Array.from(container.querySelectorAll('.snap-point')).map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left - rectC.left, y: r.top - rectC.top };
        });
        return points;
    }

    function snapTo(x, y) {
        const points = getSnapTargets();
        if (points.length > 0) {
            // Snap to nearest point (align top-left of card to point)
            let best = null, bestD = Infinity;
            for (const p of points) {
                const dx = p.x - x;
                const dy = p.y - y;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestD) { bestD = d2; best = p; }
            }
            // Optional radius threshold can be applied here
            return { x: best.x, y: best.y };
        }
        // Fallback: grid snapping (e.g., 40px grid)
        const grid = 40;
        return {
            x: Math.round(x / grid) * grid,
            y: Math.round(y / grid) * grid,
        };
    }

    function onPointerDown(e) {
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
}
