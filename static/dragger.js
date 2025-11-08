const draggable = document.getElementById('draggable');
const container = document.getElementById('container');
const boardImage = document.getElementById('board-image');

if (!draggable || !container) {
} else {
    draggable.setAttribute('draggable', 'false');
    draggable.addEventListener('dragstart', (e) => e.preventDefault());

    draggable.style.willChange = 'transform';
    draggable.style.transition = 'transform 90ms ease-out';
    ensureCardId(draggable);

    const initStateLoad = () => {
        updateBoardScaleVar();
        loadPersistedState();
    };
    if (boardImage && !boardImage.complete) {
        boardImage.addEventListener('load', initStateLoad, { once: true });
    } else {
        initStateLoad();
    }

    let isDragging = false;
    let pointerId = null;
    let startX = 0, startY = 0;
    let baseX = 0, baseY = 0;
    let isZoomOpen = false;
    let lastTapTime = 0;
    const TAP_DT = 300;
    const TAP_MOVE = 8;
    const CARD_STATE_ENDPOINT = '/api/card-positions';
    const handStrip = document.querySelector('#hand .strip');
    const deckContainer = document.getElementById('deck');
    const deckStack = deckContainer ? deckContainer.querySelector('.stack') : null;
    const deckCountLabel = deckContainer ? deckContainer.querySelector('.count') : null;
    const normalizedCache = new Map();
    let deckState = [];
    let latestState = null;
    let persistTimer = null;
    let zCounter = 10;

    function ensureCardId(el) {
        if (!el) return undefined;
        if (!el.dataset.cardId) {
            const rand = Math.random().toString(16).slice(2);
            const fallback = `card-${Date.now()}-${rand}`;
            if (window.crypto && window.crypto.randomUUID) {
                el.dataset.cardId = window.crypto.randomUUID();
            } else {
                el.dataset.cardId = fallback;
            }
        }
        return el.dataset.cardId;
    }

    function createClientId(prefix = 'card') {
        const rand = Math.random().toString(16).slice(2);
        const fallback = `${prefix}-${Date.now()}-${rand}`;
        if (window.crypto && window.crypto.randomUUID) {
            return `${prefix}-${window.crypto.randomUUID()}`;
        }
        return fallback;
    }

    function getBoardMetrics() {
        const contRect = container.getBoundingClientRect();
        const boardRect = boardImage ? boardImage.getBoundingClientRect() : contRect;
        const originX = Math.max(0, boardRect.left - contRect.left);
        const originY = Math.max(0, boardRect.top - contRect.top);
        const width = boardRect.width || contRect.width || 1;
        const height = boardRect.height || contRect.height || 1;
        return { originX, originY, width, height };
    }

    function updateBoardScaleVar() {
        const metrics = getBoardMetrics();
        const relativeHeight = metrics.height * 0.28;
        const bounded = Math.max(120, Math.min(relativeHeight, 460));
        document.documentElement.style.setProperty('--board-card-height', `${bounded}px`);
    }

    function updateCacheForElement(el) {
        if (!el) return null;
        const id = ensureCardId(el);
        const metrics = getBoardMetrics();
        const t = getTranslate(el);
        const normalizedX = (t.x - metrics.originX) / metrics.width;
        const normalizedY = (t.y - metrics.originY) / metrics.height;
        const rect = el.getBoundingClientRect();
        const ratio = metrics.height ? rect.height / metrics.height : null;
        const zIndex = parseInt(window.getComputedStyle(el).zIndex || '0', 10) || 0;
        const entry = {
            card_id: id,
            card_src: el.src,
            pos_x: normalizedX,
            pos_y: normalizedY,
            height_ratio: ratio,
            z_index: zIndex,
        };
        normalizedCache.set(id, entry);
        return entry;
    }

    function applyPositionFromCache(el, entry, metrics = getBoardMetrics()) {
        if (!el || !entry) return;
        if (typeof entry.height_ratio === 'number' && metrics.height) {
            const px = Math.max(48, entry.height_ratio * metrics.height);
            el.style.height = `${px}px`;
        }
        if (typeof entry.z_index === 'number') {
            el.style.zIndex = String(entry.z_index);
        }
        const targetX = metrics.originX + (entry.pos_x ?? 0) * metrics.width;
        const targetY = metrics.originY + (entry.pos_y ?? 0) * metrics.height;
        moveElementTo(el, targetX, targetY);
    }

    function applyNormalizedPositions() {
        const metrics = getBoardMetrics();
        normalizedCache.forEach((entry, id) => {
            const el = container.querySelector(`.board-card[data-card-id="${id}"]`);
            if (el) applyPositionFromCache(el, entry, metrics);
        });
    }

    function collectBoardState() {
        const cards = Array.from(container.querySelectorAll('.board-card'));
        const state = cards
            .map((el) => updateCacheForElement(el))
            .filter(Boolean);
        return state;
    }

    function collectHandState() {
        if (!handStrip) return [];
        const cards = Array.from(handStrip.querySelectorAll('.card'));
        return cards.map((el) => ({
            card_id: ensureCardId(el),
            card_src: el.src,
        }));
    }

    function renderDeck() {
        if (!deckStack) {
            if (deckCountLabel) deckCountLabel.textContent = '0';
            return;
        }
        deckStack.innerHTML = '';
        if (!Array.isArray(deckState) || deckState.length === 0) {
            if (deckCountLabel) deckCountLabel.textContent = '0';
            return;
        }
        const maxVisible = Math.min(deckState.length, 5);
        const visible = deckState.slice(0, maxVisible).reverse();
        visible.forEach((entry, idx) => {
            if (!entry || !entry.card_src) return;
            const img = document.createElement('img');
            img.className = 'deck-card';
            img.src = entry.card_src;
            img.alt = 'Deck card';
            img.dataset.cardId = entry.card_id;
            const offset = maxVisible - idx - 1;
            img.style.setProperty('--offset', offset);
            deckStack.appendChild(img);
        });
        if (deckCountLabel) deckCountLabel.textContent = String(deckState.length);
    }

    function setDeckState(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            deckState = [];
            renderDeck();
            return;
        }
        const sorted = [...entries]
            .filter((entry) => entry && entry.card_src)
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        deckState = sorted.map((entry) => ({
            card_id: entry.card_id || createClientId('deck'),
            card_src: entry.card_src,
        }));
        renderDeck();
    }

    function collectDeckState() {
        if (!Array.isArray(deckState)) return [];
        return deckState.map((entry, index) => ({
            card_id: entry.card_id || createClientId('deck'),
            card_src: entry.card_src,
            order_index: index,
        }));
    }

    renderDeck();

    function getStatePayload() {
        const board = collectBoardState();
        const hand = collectHandState();
        const deck = collectDeckState();
        latestState = { board, hand, deck };
        return latestState;
    }

    async function persistState(options = {}) {
        const payload = getStatePayload();
        try {
            if (options.keepalive && navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(CARD_STATE_ENDPOINT, blob);
                return;
            }
            await fetch(CARD_STATE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: !!options.keepalive,
                credentials: 'same-origin',
            });
        } catch (error) {
            console.warn('Persisting card layout failed', error);
        }
    }

    function schedulePersist(immediate = false) {
        if (persistTimer) clearTimeout(persistTimer);
        if (immediate) {
            persistState();
        } else {
            persistTimer = setTimeout(() => persistState(), 200);
        }
    }

    function rebuildHand(entries) {
        if (!handStrip) return;
        if (!Array.isArray(entries) || entries.length === 0) {
            handStrip.querySelectorAll('.card').forEach((el) => {
                ensureCardId(el);
            });
            setupHandCardZoom();
            return;
        }
        handStrip.innerHTML = '';
        entries.forEach((entry) => {
            if (!entry || !entry.card_src) return;
            const card = document.createElement('img');
            card.className = 'card';
            card.src = entry.card_src;
            card.alt = 'Card';
            if (entry.card_id) card.dataset.cardId = entry.card_id;
            handStrip.appendChild(card);
        });
        setupHandCardZoom();
    }

    function applyLoadedState(state) {
        if (!state) {
            setupHandCardZoom();
            return;
        }
        const boardEntries = Array.isArray(state.board) ? state.board : [];
        const handEntries = Array.isArray(state.hand) ? state.hand : [];
        const deckEntries = Array.isArray(state.deck) ? state.deck : [];
        const existing = new Map();
        Array.from(container.querySelectorAll('.board-card')).forEach((el) => {
            existing.set(ensureCardId(el), el);
        });
        const seen = new Set();
        boardEntries.forEach((entry) => {
            if (!entry || !entry.card_id || !entry.card_src) return;
            let el = existing.get(entry.card_id);
            if (!el) {
                el = createBoardCard(entry.card_src, { cardId: entry.card_id, skipPersist: true, fromState: true });
                existing.set(entry.card_id, el);
            } else if (el.src !== entry.card_src) {
                el.src = entry.card_src;
            }
            seen.add(entry.card_id);
        });
        existing.forEach((el, id) => {
            if (!seen.has(id) && id !== 'primary-card') {
                normalizedCache.delete(id);
                el.remove();
            }
        });
        normalizedCache.clear();
        boardEntries.forEach((entry) => {
            normalizedCache.set(entry.card_id, entry);
        });
        requestAnimationFrame(() => {
            updateBoardScaleVar();
            applyNormalizedPositions();
        });
        rebuildHand(handEntries);
        setDeckState(deckEntries);
        latestState = { board: boardEntries, hand: handEntries, deck: collectDeckState() };
    }

    async function loadPersistedState() {
        try {
            const response = await fetch(CARD_STATE_ENDPOINT, { credentials: 'same-origin' });
            if (!response.ok) return;
            const data = await response.json();
            applyLoadedState(data);
        } catch (error) {
            console.warn('Unable to load card layout', error);
        }
    }

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
        // Graveyard auto-snap: wenn im Friedhofsbereich losgelassen → dorthin legen
        const dRect = draggable.getBoundingClientRect();
        const centerX = t.x + dRect.width / 2;
        const centerY = t.y + dRect.height / 2;
        if (isPointInGraveyard(centerX, centerY)) {
            moveCardToGraveyard(draggable);
        } else {
            const snapped = snapTo(t.x, t.y);
            const { minX, minY, maxX, maxY } = getAllowedBounds();
            setTranslate(draggable, clamp(snapped.x, minX, maxX), clamp(snapped.y, minY, maxY));
        }

        isDragging = false;
        draggable.style.cursor = 'grab';
        try { draggable.releasePointerCapture(pointerId); } catch {}
        pointerId = null;
        // Persist new base
        const finalT = getTranslate(draggable);
        baseX = finalT.x; baseY = finalT.y;
        updateCacheForElement(draggable);
        schedulePersist();

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
        updateCacheForElement(draggable);
    }

    draggable.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', () => {
        // kurz warten, bis Layout stabil ist
        requestAnimationFrame(() => {
            updateBoardScaleVar();
            applyNormalizedPositions();
            clampIntoBounds();
        });
    });
    // initial sicherstellen, dass die Karte im Board liegt
    requestAnimationFrame(clampIntoBounds);

    window.addEventListener('beforeunload', () => {
        try {
            persistState({ keepalive: true });
        } catch (error) {
            console.warn('Unable to persist state on unload', error);
        }
    });

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Standard: eine Seite zurück, falls im Browserkontext; andernfalls auf Startseite
            if (window.history.length > 1) window.history.back();
            else window.location.href = '/';
        });
    }

    // ---------- Debug Grid Overlay ----------
    let gridOverlay = null;
    let gridVisible = false;
    let graveyardOverlay = null;
    let graveyardRect = null; // {x,y,w,h}

    function getGridSettings() {
        const contRect = container.getBoundingClientRect();
        const boardRect = boardImage ? boardImage.getBoundingClientRect() : contRect;
        const originX = Math.max(0, boardRect.left - contRect.left);
        const originY = Math.max(0, boardRect.top - contRect.top);
        const grid = Math.max(24, Math.min(64, Math.floor(boardRect.width / 24)));
        return { originX, originY, grid };
    }

    function ensureGridOverlay() {
        if (!gridOverlay) {
            gridOverlay = document.createElement('div');
            gridOverlay.id = 'grid-overlay';
            gridOverlay.style.position = 'absolute';
            gridOverlay.style.inset = '0';
            gridOverlay.style.pointerEvents = 'none';
            gridOverlay.style.zIndex = '3'; // über Karte (2), unter Back-Button
            container.appendChild(gridOverlay);
        }
        return gridOverlay;
    }

    function updateGridOverlay() {
        const ov = ensureGridOverlay();
        const { originX, originY, grid } = getGridSettings();
        const line = 'rgba(0, 200, 255, 0.35)';
        ov.style.backgroundImage = `
            linear-gradient(to right, ${line} 1px, transparent 1px),
            linear-gradient(to bottom, ${line} 1px, transparent 1px)
        `;
        ov.style.backgroundSize = `${grid}px ${grid}px, ${grid}px ${grid}px`;
        ov.style.backgroundPosition = `${originX}px ${originY}px, ${originX}px ${originY}px`;
        ov.style.display = gridVisible ? 'block' : 'none';
        // Optionale Snap-Punkte umranden
        Array.from(container.querySelectorAll('.snap-point')).forEach(el => {
            el.style.outline = gridVisible ? '2px dashed rgba(255, 100, 0, 0.8)' : '';
            el.style.outlineOffset = '-1px';
        });

        // Graveyard Zone aus Grid-Koordinaten 1:25 - 6:28 (r1:c1 - r2:c2)
        const r1 = 1, c1 = 25, r2 = 6, c2 = 28; // 1-basiert
        const x = originX + (c1 - 1) * grid;
        const y = originY + (r1 - 1) * grid;
        const w = (c2 - c1 + 1) * grid;
        const h = (r2 - r1 + 1) * grid;
        graveyardRect = { x, y, w, h };

        if (!graveyardOverlay) {
            graveyardOverlay = document.createElement('div');
            graveyardOverlay.id = 'graveyard-zone';
            Object.assign(graveyardOverlay.style, {
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: '3',
                borderRadius: '8px',
            });
            container.appendChild(graveyardOverlay);
        }
        Object.assign(graveyardOverlay.style, {
            left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
            outline: gridVisible ? '2px solid rgba(255,0,0,0.75)' : 'none',
            background: gridVisible ? 'rgba(255,0,0,0.06)' : 'transparent',
        });
    }

    function isPointInGraveyard(px, py) {
        if (!graveyardRect) return false;
        return px >= graveyardRect.x && px <= graveyardRect.x + graveyardRect.w &&
               py >= graveyardRect.y && py <= graveyardRect.y + graveyardRect.h;
    }

    function toggleGrid() {
        gridVisible = !gridVisible;
        updateGridOverlay();
    }

    // Button zum Umschalten (optional, zusätzlich zur Taste "g")
    const gridBtn = document.createElement('button');
    gridBtn.textContent = 'Grid';
    Object.assign(gridBtn.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '5',
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        fontSize: '14px',
        lineHeight: '1',
        cursor: 'pointer',
        userSelect: 'none',
    });
    gridBtn.addEventListener('click', toggleGrid);
    document.body.appendChild(gridBtn);

    // Keyboard toggle
    window.addEventListener('keydown', (ev) => {
        if (ev.key.toLowerCase() === 'g') toggleGrid();
    });

    // Overlay auf Resize neu ausrichten
    window.addEventListener('resize', () => {
        if (gridVisible) requestAnimationFrame(updateGridOverlay);
    else requestAnimationFrame(updateGridOverlay); // trotzdem Positionen aktualisieren
    });

    // initial vorbereiten
    updateGridOverlay();

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

    // ---------- Mehrere Board-Karten: Erzeugen, Draggen, Snap ----------
    function getAllowedBoundsFor(el) {
        const contRect = container.getBoundingClientRect();
        const boardRect = boardImage ? boardImage.getBoundingClientRect() : contRect;
        const elRect = el.getBoundingClientRect();
        const minX = Math.max(0, boardRect.left - contRect.left);
        const minY = Math.max(0, boardRect.top - contRect.top);
        const maxX = Math.min(contRect.width, boardRect.right - contRect.left) - elRect.width;
        const maxY = Math.min(contRect.height, boardRect.bottom - contRect.top) - elRect.height;
        return { minX, minY, maxX: Math.max(minX, maxX), maxY: Math.max(minY, maxY) };
    }

    function getSnapTargetsFor(el) {
        const rectC = container.getBoundingClientRect();
        const cardRect = el.getBoundingClientRect();
        const cardW = cardRect.width;
        const cardH = cardRect.height;
        const points = Array.from(container.querySelectorAll('.snap-point')).map((sp) => {
            const r = sp.getBoundingClientRect();
            const align = sp.dataset.snapAlign || 'center';
            if (align === 'topleft') {
                return { x: r.left - rectC.left, y: r.top - rectC.top, cx: r.left - rectC.left + r.width/2, cy: r.top - rectC.top + r.height/2 };
            }
            const tx = (r.left - rectC.left) + (r.width - cardW) / 2;
            const ty = (r.top - rectC.top) + (r.height - cardH) / 2;
            return { x: tx, y: ty, cx: tx + cardW/2, cy: ty + cardH/2 };
        });
        return points;
    }

    function snapToFor(el, x, y) {
        const points = getSnapTargetsFor(el);
        if (points.length > 0) {
            const rect = el.getBoundingClientRect();
            const cardCX = x + rect.width/2;
            const cardCY = y + rect.height/2;
            let best = null, bestD = Infinity;
            for (const p of points) {
                const cx = p.cx ?? (p.x + rect.width/2);
                const cy = p.cy ?? (p.y + rect.height/2);
                const dx = cx - cardCX; const dy = cy - cardCY; const d2 = dx*dx + dy*dy;
                if (d2 < bestD) { bestD = d2; best = p; }
            }
            return { x: best.x, y: best.y };
        }
        // fallback grid
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

    function moveElementTo(el, x, y) {
        const { minX, minY, maxX, maxY } = getAllowedBoundsFor(el);
        setTranslate(el, clamp(x, minX, maxX), clamp(y, minY, maxY));
    }

    function attachDragTo(el, options = {}) {
        ensureCardId(el);
        el.style.willChange = 'transform';
        el.style.transition = 'transform 90ms ease-out';
        el.style.cursor = 'grab';
        el.style.touchAction = 'none';

        let ppId = null, dragging = false, sx = 0, sy = 0, bx = 0, by = 0;
        function onDown(ev) {
            if (ppId !== null) return;
            ppId = ev.pointerId; el.setPointerCapture(ppId);
            dragging = true; const t = getTranslate(el); bx = t.x; by = t.y; sx = ev.clientX; sy = ev.clientY;
            el.style.cursor = 'grabbing';
            // bring to front
            zCounter += 1; el.style.zIndex = String(10 + zCounter);
        }
        function onMove(ev) {
            if (!dragging || ev.pointerId !== ppId) return; ev.preventDefault();
            const dx = ev.clientX - sx; const dy = ev.clientY - sy;
            const { minX, minY, maxX, maxY } = getAllowedBoundsFor(el);
            const nx = clamp(bx + dx, minX, maxX); const ny = clamp(by + dy, minY, maxY);
            setTranslate(el, nx, ny);
        }
        function onUp(ev) {
            if (ev.pointerId !== ppId) return;
            const t = getTranslate(el);
            const rect = el.getBoundingClientRect();
            const cx = t.x + rect.width/2;
            const cy = t.y + rect.height/2;
            if (isPointInGraveyard(cx, cy)) {
                moveCardToGraveyard(el);
            } else {
                const snapped = snapToFor(el, t.x, t.y);
                const { minX, minY, maxX, maxY } = getAllowedBoundsFor(el);
                setTranslate(el, clamp(snapped.x, minX, maxX), clamp(snapped.y, minY, maxY));
            }
            dragging = false; el.style.cursor = 'grab';
            try { el.releasePointerCapture(ppId); } catch {}
            ppId = null;
            const entry = updateCacheForElement(el);
            if (typeof options.onDrop === 'function') options.onDrop(entry);
            else schedulePersist();
        }
        el.addEventListener('pointerdown', onDown, { passive: false });
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    function createBoardCard(src, options = {}) {
        const { cardId, skipPersist = false, fromState = false } = options;
        const el = document.createElement('img');
        el.className = 'board-card';
        el.src = src; el.alt = 'Card';
        el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0';
        // gleiche Interaktionsverhinderung wie die initiale Karte
        el.setAttribute('draggable', 'false');
        el.addEventListener('dragstart', (e) => e.preventDefault());
        el.style.userSelect = 'none';
        el.style.webkitUserDrag = 'none';
        // gleiche Größe wie die initiale Karte (pixelgenau)
        try {
            const dcs = window.getComputedStyle(draggable);
            el.style.height = dcs.height;
            el.style.width = 'auto';
        } catch {}
        if (cardId) el.dataset.cardId = cardId;
        ensureCardId(el);
        zCounter += 1; el.style.zIndex = String(10 + zCounter);
        container.appendChild(el);
        attachDragTo(el);
        // initial position: center snapped after image has size
        const place = () => {
            const contRect = container.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const cx = (contRect.width - r.width) / 2;
            const cy = (contRect.height - r.height) / 2;
            const snapped = snapToFor(el, cx, cy);
            moveElementTo(el, snapped.x, snapped.y);
            const entry = updateCacheForElement(el);
            if (!skipPersist) {
                schedulePersist();
            } else if (entry) {
                normalizedCache.set(entry.card_id, entry);
            }
        };
        if (!fromState) {
            const queuePlacement = () => requestAnimationFrame(place);
            if (el.complete) queuePlacement();
            else el.addEventListener('load', queuePlacement, { once: true });
        }
        // dblclick zoom
        el.addEventListener('dblclick', (ev) => { ev.preventDefault(); openZoom(src); });
        return el;
    }

    // Helfer zum Bewegen der Board-Karte
    function moveCardToGraveyard(el) {
        if (!graveyardRect) updateGridOverlay();
        const padding = 6;
        const x = graveyardRect.x + padding + Math.random() * 6;
        const y = graveyardRect.y + padding + Math.random() * 6;
        moveElementTo(el, x, y);
        const entry = updateCacheForElement(el);
        if (entry) normalizedCache.set(entry.card_id, entry);
        schedulePersist();
    }

    // Handkarten: Play (single tap) / Zoom (double tap) / Graveyard (long press or right click)
    function setupHandCardZoom() {
        const cards = Array.from(document.querySelectorAll('#hand .card'));
        const lastTapMap = new WeakMap();
        const downPos = new WeakMap();
        const singleTapTimers = new WeakMap();
        const longPressTimers = new WeakMap();
        cards.forEach((el) => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            ensureCardId(el);
            // track down for move distance
            el.addEventListener('pointerdown', (ev) => {
                downPos.set(el, { x: ev.clientX, y: ev.clientY });
                // Long-Press -> Graveyard
                clearTimeout(longPressTimers.get(el));
                const lp = setTimeout(() => {
                    // nur auslösen, wenn seitdem kein großer Move kam
                    const d = downPos.get(el) || { x: ev.clientX, y: ev.clientY };
                    if (Math.hypot(d.x - ev.clientX, d.y - ev.clientY) < TAP_MOVE) {
                        const newCard = createBoardCard(el.src, { cardId: ensureCardId(el) });
                        moveCardToGraveyard(newCard);
                        // aus Hand entfernen
                        el.remove();
                        schedulePersist();
                    }
                }, 600);
                longPressTimers.set(el, lp);
            }, { passive: true });
            el.addEventListener('pointerup', (ev) => {
                clearTimeout(longPressTimers.get(el));
                const now = Date.now();
                const last = lastTapMap.get(el) || 0;
                const d = downPos.get(el) || { x: ev.clientX, y: ev.clientY };
                const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
                if (moved < TAP_MOVE) {
                    if (now - last < TAP_DT) {
                        // Double-Tap -> Zoom
                        openZoom(el.src);
                        // doppeltipp: anstehende single-tap Aktion abbrechen
                        const tId = singleTapTimers.get(el); if (tId) clearTimeout(tId);
                        lastTapMap.set(el, 0);
                    } else {
                        lastTapMap.set(el, now);
                        // Single-Tap verzögert ausführen (Play aufs Feld)
                        const tId = setTimeout(() => {
                            const newCard = createBoardCard(el.src, { cardId: ensureCardId(el) });
                            // wenn Snap-Punkte existieren, wurde createBoardCard bereits zentriert+gesnapped
                            // Karte aus der Hand entfernen
                            el.remove();
                            schedulePersist();
                        }, TAP_DT + 10);
                        singleTapTimers.set(el, tId);
                    }
                } else {
                    lastTapMap.set(el, 0);
                }
            });
            // Alt-/Ctrl-Klick -> sofort Friedhof (Desktop-Shortcut)
            el.addEventListener('click', (ev) => {
                if (ev.altKey || ev.ctrlKey) {
                    ev.preventDefault();
                    const tId = singleTapTimers.get(el); if (tId) clearTimeout(tId);
                    const newCard = createBoardCard(el.src, { cardId: ensureCardId(el) });
                    moveCardToGraveyard(newCard);
                    el.remove();
                    schedulePersist();
                }
            });
            // Kontextmenü (Rechtsklick) -> Graveyard
            el.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                const newCard = createBoardCard(el.src, { cardId: ensureCardId(el) });
                moveCardToGraveyard(newCard);
                el.remove();
                schedulePersist();
            });
            // Maus-Doppelklick (Desktop) separat für schnelle Zoom-Reaktion
            el.addEventListener('dblclick', (ev) => {
                ev.preventDefault();
                openZoom(el.src);
            });
        });
    }

    setupHandCardZoom();
}
