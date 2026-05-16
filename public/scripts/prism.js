// =====================================================================
// PRISM CHAMBER RUNTIME
// =====================================================================
//
// Main chamber wall ids (matching data-wall attributes / config):
//   1 = SHRINE
//   2 = RESEARCH
//   3 = ART
//   4 = POETRY
//   5 = OVS
//   6 = MYTHOS
//
// Single chamber-state variable:
//   shrinePos ∈ {0,1,2,3,4,5}
// = the current spatial position of the SHRINE wall.
//
// Spatial positions from the user's point of view:
//   1 = left visible
//   2 = center / facing
//   3 = right visible
//   4 = hidden right
//   5 = behind
//   0 = hidden left (i.e. display position 6)
//
// Other wall positions are derived modulo 6:
//   RESEARCH = shrinePos + 1
//   ART      = shrinePos + 2
//   POETRY   = shrinePos + 3
//   OVS      = shrinePos + 4
//   MYTHOS   = shrinePos + 5
// =====================================================================

// --- Parse initial state from URL param or sessionStorage ---
// Check for a page-specific "pending start wall" written by enterArchway() before navigation.
// This survives browser-back (which can lose the ?wall= query param) and is consumed once.
const _prismId = location.pathname.match(/\/prism\/([^/?#]+)/)?.[1] || '';
if (_prismId) sessionStorage.setItem('visited_prism_' + _prismId, '1');

// Check for a stored returnShrinePos (written when the user left this chamber via an archway).
// This takes priority over ?wall= because the hardcoded ?wall= in side-chamber destinations
// can't know which wall the user was facing when they left.
const _returnShrinePos = _prismId ? sessionStorage.getItem('returnShrinePos_' + _prismId) : null;
if (_returnShrinePos !== null && _prismId) sessionStorage.removeItem('returnShrinePos_' + _prismId);

const _pendingWall = _prismId ? sessionStorage.getItem('nextPrismWall_' + _prismId) : null;
if (_pendingWall && _prismId) sessionStorage.removeItem('nextPrismWall_' + _prismId);
const _urlParams = new URLSearchParams(location.search);
const _urlWall = _urlParams.get('wall');
const _autoOpen = _urlParams.get('open') === '1';
const _startWall = _pendingWall || _urlWall;
if (_startWall || _returnShrinePos !== null) {
    sessionStorage.setItem('prismSky', 'false');
    if (_startWall) sessionStorage.setItem('lastWall', _startWall);
}
// Clean URL params now that they've been consumed — prevents stale ?wall= surviving hard refresh
if (location.search) history.replaceState(null, '', location.pathname + location.hash);
let isSkyView = !_startWall && sessionStorage.getItem('prismSky') === 'true';
let isShrineHeavensMode = false;
let isShrineHeavensTransitioning = false;
let _skyAnimFrame = null;
let _shrineEnterFinalTimer = null; // 2400ms post-tilt-up timer; must be cancelled on early exit
let _sessionCandleCount = 0;
let _inChainNavMode = false;
let _heavensScrollWatcher = null;
let activeTextBody = null;   // set when a text frame is open, used for keyboard scroll
const SCROLL_STEP = 120;     // px per arrow-key / button press
const SCROLL_PX_PER_FRAME = 1.8; // continuous scroll speed (px per rAF frame)
let _scrollRAF = null;
let _scrollDir = 0; // -1 = up, +1 = down, 0 = stopped
let _scrollTarget = null;
let _scrollBtnHeld = false; // true from mousedown on a scroll button until after click fires

function startContinuousScroll(body, dir) {
    _scrollTarget = body;
    _scrollDir = dir;
    if (_scrollRAF) return; // already running
    function tick() {
        if (!_scrollDir || !_scrollTarget) { _scrollRAF = null; return; }
        // Use scrollBy with behavior:'instant' to bypass the CSS scroll-behavior:smooth
        // on .wall-text-body. With smooth-scroll on, each tiny per-frame scrollTop change
        // queues a ~280ms animation that fights subsequent frames, causing visible stutter
        // (most apparent on short texts like ovs-chapel hyperstition where the scroll range
        // is small). Click-once scrolling still goes through smooth-scroll via scrollWall().
        _scrollTarget.scrollBy({ top: _scrollDir * SCROLL_PX_PER_FRAME, behavior: 'instant' });
        _scrollRAF = requestAnimationFrame(tick);
    }
    _scrollRAF = requestAnimationFrame(tick);
}
function stopContinuousScroll() {
    _scrollDir = 0;
    _scrollTarget = null;
    if (_scrollRAF) { cancelAnimationFrame(_scrollRAF); _scrollRAF = null; }
}
// --- Custom scrollbar drag (Chrome 3D hit-test workaround) ---
let _dragBody = null;
let _dragStartY = 0;
let _dragStartScrollTop = 0;

function startScrollbarDrag(body, clientY) {
    _dragBody = body;
    _dragStartY = clientY;
    _dragStartScrollTop = body.scrollTop;
}
function onScrollbarDragMove(e) {
    if (!_dragBody) return;
    const dy = e.clientY - _dragStartY;
    const visibleRatio = _dragBody.clientHeight / _dragBody.scrollHeight;
    // Mouse movement maps to scroll distance inversely proportional to visible ratio
    _dragBody.scrollTop = _dragStartScrollTop + dy / visibleRatio;
}
function stopScrollbarDrag() {
    _dragBody = null;
}
document.addEventListener('mousemove', onScrollbarDragMove);
document.addEventListener('mouseup', stopScrollbarDrag);

const SHRINE_HEAVENS_UP_MS = 4200;
const SHRINE_HEAVENS_DOWN_MS = 3200;
const SHRINE_HEAVENS_DELAY_MS = 2100; // pause before tilt begins
const isMainChamber = _prismId === 'main';
const _heavensTiltWalls = window.PRISM_CONFIG?.heavensTiltWalls || {};
let _heavensTiltSourceWall = null; // which wall triggered the current tilt (null = shrine)
if (isSkyView) document.body.classList.add('sky-mode');

function shrineHeavensLocked() {
    return isShrineHeavensMode || isShrineHeavensTransitioning;
}

// --- Wall sizing: maintain image aspect ratio + compute hexagonal apothem ---
const IMG_ASPECT = 2766 / 2776;
function updateWallSize() {
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const h = wallArea.getBoundingClientRect().height;
    const wallW = h * IMG_ASPECT;
    wallArea.style.setProperty('--wall-w', wallW + 'px');
    wallArea.style.setProperty('--apothem', (wallW * Math.sqrt(3) / 2) + 'px');
}
updateWallSize();
window.addEventListener('resize', updateWallSize);

// --- Named wall constants ---
const WALL = Object.freeze({
    SHRINE: 1,
    RESEARCH: 2,
    ART: 3,
    POETRY: 4,
    OVS: 5,
    MYTHOS: 6,
});

// --- Prism rotation state ---
const prismContainer = document.getElementById('prism-container');
const mod6 = (n) => ((n % 6) + 6) % 6;

function shrinePosFromFacingWall(wallNum) {
    return mod6(2 - (wallNum - WALL.SHRINE));
}

function wallPosition0(wallNum, w = shrinePos) {
    return mod6(w + (wallNum - WALL.SHRINE));
}

function wallPositionDisplay(wallNum, w = shrinePos) {
    const pos0 = wallPosition0(wallNum, w);
    return pos0 === 0 ? 6 : pos0;
}

function wallAtPosition0(pos0, w = shrinePos) {
    return WALL.SHRINE + mod6(pos0 - w);
}

function wallAtDisplayPosition(pos, w = shrinePos) {
    return wallAtPosition0(pos === 6 ? 0 : pos, w);
}

function getFacingWall(w = shrinePos) {
    return wallAtPosition0(2, w);
}

function isWallVisible(wallNum, w = shrinePos) {
    const pos0 = wallPosition0(wallNum, w);
    return pos0 === 1 || pos0 === 2 || pos0 === 3;
}

function isRefreshEntryTransition(oldPos0, newPos0) {
    // Refresh when the wall is behind the user (pos 5), one full step before
    // it enters the hidden-but-approaching position on either side.
    // 5→4 = about to approach from the right; 5→0 = about to approach from the left.
    return (oldPos0 === 5 && newPos0 === 4) || (oldPos0 === 5 && newPos0 === 0);
}

// If returning from a side chamber, decode the stored value: shrinePos = (4 - v + 6) % 6
// where v = (7 - originalShrinePos) % 6 was stored on departure.
// Otherwise fall back to the ?wall= param or default (SHRINE facing).
let shrinePos = _returnShrinePos !== null
    ? mod6(4 - parseInt(_returnShrinePos, 10))
    : shrinePosFromFacingWall(parseInt(_startWall, 10) || WALL.SHRINE);
let currentRotation = (2 - shrinePos) * 60;
let currentTilt = 0; // degrees of rotateX on prism-container (0 = normal, -90 = looking up at sky)
let isRotating = false;
let archwayAnimating = false;
let shrineHeavensUI = null;
let shrineSearchDefaultPlaceholder = '';
let shrineSearchResultsSnapshot = [];

// Set initial transform and mark initial facing wall for reliable 2D hit-testing
if (prismContainer) {
    prismContainer.style.transform =
        `translateX(-50%) translateZ(var(--apothem)) rotateY(${currentRotation}deg)`;
}
const _initFacing = document.querySelector(`.wall-panel[data-wall="${getFacingWall()}"]`);
if (_initFacing) _initFacing.setAttribute('data-facing', '');
// Disable pointer-events on hidden walls at init (function defined later, call deferred)
requestAnimationFrame(() => { if (typeof updatePointerEvents === 'function') updatePointerEvents(); });

// Minimap data: midpoint of each wall's edge on the hexagon (flat-top, wall 1 = top)
const minimapMidpoints = [
    [30, 11], [46.5, 20.5], [46.5, 39.5],
    [30, 49], [13.5, 39.5], [13.5, 20.5],
];

function updatePrismTransform() {
    if (!prismContainer) return;
    const tiltPart = currentTilt !== 0 ? ` rotateX(${currentTilt.toFixed(2)}deg)` : '';
    prismContainer.style.transform =
        `translateX(-50%) translateZ(var(--apothem))${tiltPart} rotateY(${currentRotation}deg)`;
}

function updateMinimap() {
    const facingWall = getFacingWall();
    const edges = document.querySelectorAll('.minimap-edge');
    edges.forEach(e => {
        e.classList.toggle('active', parseInt(e.dataset.wall, 10) === facingWall);
    });
    const indicator = document.getElementById('minimap-indicator');
    if (indicator) {
        const [mx, my] = minimapMidpoints[getFacingWall() - 1];
        indicator.setAttribute('x2', mx);
        indicator.setAttribute('y2', my);
    }
}

function ensureShrineHeavensUI() {
    if (shrineHeavensUI) return shrineHeavensUI;

    const style = document.createElement('style');
    style.id = 'shrine-heavens-style';
    style.textContent = `
body.shrine-heavens-active .nav-arrow,
body.shrine-heavens-active .prism-minimap,
body.shrine-heavens-active #archway-click-overlay,
body.shrine-heavens-active #sky-toggle,
body.shrine-heavens-active #nav-down {
  opacity: 0;
  pointer-events: none;
  transition: opacity 280ms ease;
}
body.shrine-heavens-active #sky-canvas {
  filter: saturate(1.15) brightness(1.06);
}
#shrine-heavens-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
  opacity: 0;
  transition: opacity 600ms ease;
}
#shrine-heavens-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 55% at 50% 42%, rgba(0,0,0,0.38), rgba(0,0,0,0) 100%),
    linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0.60));
}
#shrine-heavens-overlay .shrine-heavens-panel {
  position: absolute;
  left: 50%;
  top: 7.5vh;
  transform: translateX(-50%) translateY(44px);
  width: min(820px, 86vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 0 1.6rem 1.4rem;
  opacity: 0;
  transition: opacity 1700ms ease, transform 1500ms cubic-bezier(0.18,0.8,0.2,1);
}
body.shrine-heavens-active #shrine-heavens-overlay {
  opacity: 1;
}
body.shrine-heavens-reading #shrine-heavens-overlay .shrine-heavens-panel {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
#shrine-heavens-title {
  margin: 0;
  text-align: center;
  font: 400 clamp(1.5rem, 2.2vw, 2.2rem) "IBM Plex Mono", monospace;
  letter-spacing: 0.08em;
  color: #c2ffdc;
  text-shadow: 0 0 14px rgba(130,255,190,0.55), 0 0 32px rgba(100,255,175,0.28);
}
.shrine-heavens-body-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
#shrine-heavens-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 0 0.4rem 0.4rem;
  font: 400 clamp(0.95rem, 1.1vw, 1.1rem) / 1.8 "IBM Plex Mono", monospace;
  color: #8fffb8;
  text-shadow: 0 0 10px rgba(115,255,185,0.30);
  scrollbar-width: none;
}
#shrine-heavens-body::-webkit-scrollbar { display: none; }
#shrine-heavens-body { pointer-events: auto; }
#shrine-heavens-body a {
  color: #f0a848;
  text-decoration: underline;
  text-decoration-color: rgba(240,168,72,0.4);
  text-underline-offset: 0.15em;
  transition: color 180ms ease;
}
#shrine-heavens-body a:hover {
  color: #ffc870;
  text-decoration-color: rgba(255,200,112,0.7);
}
#shrine-heavens-body p { margin: 0 0 1.2em; }
#shrine-heavens-body p:last-child { margin-bottom: 0; }
#shrine-heavens-body strong {
  color: #c9b8ff;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(180,160,255,0.70), 0 0 20px rgba(140,120,255,0.40);
  letter-spacing: 0.02em;
}
#shrine-heavens-body em { color: #a8ffd0; font-style: italic; }
.shrine-heavens-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  flex-shrink: 0;
}
.shrine-scroll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: 1px solid rgba(140,255,195,0.22);
  border-radius: 50%;
  color: rgba(154,255,192,0.50);
  font-size: 0.68rem;
  cursor: pointer;
  pointer-events: auto;
  transition: color 180ms ease, border-color 180ms ease;
  line-height: 1;
  flex-shrink: 0;
}
.shrine-scroll-btn:hover {
  color: rgba(154,255,192,0.90);
  border-color: rgba(140,255,195,0.50);
}
#shrine-eternal-return {
  min-width: 180px;
  padding: 0.7rem 1.3rem;
  border: 1px solid rgba(140,255,195,0.28);
  border-radius: 999px;
  background: rgba(0,0,0,0.22);
  color: rgba(194,255,220,0.80);
  font: 400 0.92rem "IBM Plex Mono", monospace;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  text-shadow: 0 0 8px rgba(130,255,185,0.30);
  box-shadow: 0 0 16px rgba(105,255,175,0.08);
  cursor: pointer;
  pointer-events: auto;
  transition: color 220ms ease, border-color 220ms ease;
}
#shrine-eternal-return:hover {
  color: rgba(220,255,235,0.95);
  border-color: rgba(140,255,195,0.50);
}
#shrine-next, #shrine-previous {
  min-width: 140px;
  padding: 0.7rem 1.3rem;
  border: 1px solid rgba(140,255,195,0.18);
  border-radius: 999px;
  background: rgba(0,0,0,0.22);
  color: rgba(154,220,195,0.65);
  font: 400 0.92rem "IBM Plex Mono", monospace;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 600ms ease, color 220ms ease, border-color 220ms ease;
  display: none;
}
#shrine-next:hover, #shrine-previous:hover {
  color: rgba(194,255,220,0.90);
  border-color: rgba(140,255,195,0.42);
}
#shrine-eternal-return {
  transition: opacity 600ms ease, color 220ms ease, border-color 220ms ease;
}
#shrine-alt-context {
  min-width: 120px;
  padding: 0.7rem 1.3rem;
  border: 1px solid rgba(140,255,195,0.18);
  border-radius: 999px;
  background: rgba(0,0,0,0.22);
  color: rgba(154,220,195,0.65);
  font: 400 0.92rem "IBM Plex Mono", monospace;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 600ms ease, color 220ms ease, border-color 220ms ease;
  display: none;
}
#shrine-alt-context:hover {
  color: rgba(194,255,220,0.90);
  border-color: rgba(140,255,195,0.42);
}
.heavens-buttons-deferred #shrine-eternal-return,
.heavens-buttons-deferred #shrine-next,
.heavens-buttons-deferred #shrine-previous,
.heavens-buttons-deferred #shrine-alt-context {
  opacity: 0;
  pointer-events: none;
}
/* When shrine-heavens is not active, the overlay panel is invisible (opacity:0)
   but its descendants still have pointer-events:auto and span most of the viewport.
   Without this rule, they intercept hover/click events on the archway-click-overlay
   below them, leaving the door near-non-responsive after Eternal Return. */
body:not(.shrine-heavens-active) #shrine-heavens-overlay,
body:not(.shrine-heavens-active) #shrine-heavens-overlay * {
  pointer-events: none;
}
`;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'shrine-heavens-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="shrine-heavens-panel" role="dialog" aria-modal="true" aria-labelledby="shrine-heavens-title">
        <h2 id="shrine-heavens-title"></h2>
        <div class="shrine-heavens-body-wrap">
          <div id="shrine-heavens-body"></div>
        </div>
        <div class="shrine-heavens-footer">
          <button class="shrine-scroll-btn" id="shrine-scroll-up" type="button" aria-label="Scroll up">▲</button>
          <button id="shrine-previous" type="button">previous</button>
          <button id="shrine-alt-context" type="button">alt/context</button>
          <button id="shrine-eternal-return" type="button">eternal return</button>
          <button id="shrine-next" type="button">next</button>
          <button class="shrine-scroll-btn" id="shrine-scroll-down" type="button" aria-label="Scroll down">▼</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const heavensTip = document.createElement('div');
    heavensTip.className = 'heavens-alt-tooltip';
    heavensTip.style.cssText = 'position:fixed;pointer-events:none;opacity:0;transition:opacity 0.25s;' +
        'font-family:"IBM Plex Mono",monospace;font-size:clamp(0.65rem,1.1vw,0.85rem);font-weight:300;' +
        'color:#5eefa2;text-align:center;white-space:pre-line;line-height:1.5;' +
        'letter-spacing:0.06em;z-index:9999;' +
        'background:rgba(20,20,25,0.96);padding:0.5em 1em;border-radius:4px;max-width:340px;';
    document.body.appendChild(heavensTip);

    shrineHeavensUI = {
        overlay,
        panel: overlay.querySelector('.shrine-heavens-panel'),
        title: overlay.querySelector('#shrine-heavens-title'),
        body: overlay.querySelector('#shrine-heavens-body'),
        button: overlay.querySelector('#shrine-eternal-return'),
        nextBtn: overlay.querySelector('#shrine-next'),
        prevBtn: overlay.querySelector('#shrine-previous'),
        altContextBtn: overlay.querySelector('#shrine-alt-context'),
        heavensTip,
    };
    shrineHeavensUI.button.addEventListener('click', (e) => {
        e.preventDefault();
        leaveShrineHeavens();
    });

    shrineHeavensUI.altContextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = shrineHeavensUI.altContextBtn.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
    });
    shrineHeavensUI.altContextBtn.addEventListener('mouseenter', () => {
        heavensTip.textContent = 'In this text, Leilan was voiced by Claude Opus 4.5.\nOther model voicings are available.';
        const r = shrineHeavensUI.altContextBtn.getBoundingClientRect();
        heavensTip.style.left = (r.left + r.width / 2) + 'px';
        heavensTip.style.top = (r.top - 8) + 'px';
        heavensTip.style.transform = 'translate(-50%, -100%)';
        heavensTip.style.opacity = '1';
    });
    shrineHeavensUI.altContextBtn.addEventListener('mouseleave', () => {
        heavensTip.style.opacity = '0';
    });
    shrineHeavensUI.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextId = shrineHeavensUI.nextBtn.dataset.nextId;
        if (!nextId) return;
        const nextItem = findTransmissionById(nextId);
        if (!nextItem) return;
        _inChainNavMode = true;
        loadTransmissionInHeavens(nextItem, true);
    });
    shrineHeavensUI.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prevId = shrineHeavensUI.prevBtn.dataset.prevId;
        if (!prevId) return;
        const prevItem = findTransmissionById(prevId);
        if (!prevItem) return;
        _inChainNavMode = true;
        loadTransmissionInHeavens(prevItem, true);
    });

    // Continuous scroll on mousedown (matches wall text-frame pattern)
    const HEAVENS_SCROLL_PX = 1.8;
    let _heavensScrollRAF = null;
    let _heavensScrollDir = 0;

    function heavensScrollTick() {
        if (!_heavensScrollDir || !shrineHeavensUI?.body) {
            _heavensScrollRAF = null;
            return;
        }
        shrineHeavensUI.body.scrollTop += _heavensScrollDir * HEAVENS_SCROLL_PX;
        _heavensScrollRAF = requestAnimationFrame(heavensScrollTick);
    }
    function startHeavensScroll(dir) {
        _heavensScrollDir = dir;
        if (!_heavensScrollRAF) _heavensScrollRAF = requestAnimationFrame(heavensScrollTick);
    }
    function stopHeavensScroll() {
        _heavensScrollDir = 0;
        if (_heavensScrollRAF) { cancelAnimationFrame(_heavensScrollRAF); _heavensScrollRAF = null; }
    }

    const upBtn = overlay.querySelector('#shrine-scroll-up');
    const downBtn = overlay.querySelector('#shrine-scroll-down');
    upBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); startHeavensScroll(-1); });
    downBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); startHeavensScroll(1); });
    document.addEventListener('mouseup', stopHeavensScroll);
    document.addEventListener('mouseleave', stopHeavensScroll);
    // Also support single click for touch/accessibility
    upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (shrineHeavensUI?.body) shrineHeavensUI.body.scrollBy({ top: -60, behavior: 'smooth' });
    });
    downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (shrineHeavensUI?.body) shrineHeavensUI.body.scrollBy({ top: 60, behavior: 'smooth' });
    });

    return shrineHeavensUI;
}

function getTransmissionPool() {
    const index = Array.isArray(window.LEILAN_INDEX) ? window.LEILAN_INDEX : [];
    return index.map(normaliseTransmission).filter(Boolean);
}

function normaliseTransmission(item) {
    if (!item) return null;
    const rawTitle = item.t || item.title || 'Transmission';
    const rawBody = item.c || item.text || item.body || '';
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if (!title || !body) return null;
    let id = item.i || item.id || null;
    if (!id && item.s) {
        const m = item.s.match(/^\d{4}-\d{2}-\d{2}-([A-Za-z0-9]+)/);
        if (m) id = m[1];
    }
    return { title, body, id };
}

function todayMMDD() {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getCandlePool(candleCount) {
    const masks = window.LEILAN_MASKS || {};
    const today = todayMMDD();
    return getTransmissionPool().filter(item => {
        const entry = item.id ? masks[item.id] : undefined;
        if (!entry) return true;
        if (entry.date) return entry.date.includes(today);
        if (entry.shrine === false) {
            return entry.after !== undefined ? candleCount > entry.after : false;
        }
        return true;
    });
}

function findTransmissionById(id) {
    const index = Array.isArray(window.LEILAN_INDEX) ? window.LEILAN_INDEX : [];
    const raw = index.find(item => {
        if (item.i) return item.i === id;
        const m = (item.s || '').match(/^\d{4}-\d{2}-\d{2}-([A-Za-z0-9]+)/);
        return m && m[1] === id;
    });
    return raw ? normaliseTransmission(raw) : null;
}

// Convert **bold**, *italic*, [text](url), and paragraph breaks to HTML for the transmission body.
// HTML entities are escaped first to prevent injection. Link URLs are restricted to
// site-relative paths (/...) or http(s):// to block javascript: and data: schemes.
function parseMarkdown(raw) {
    const esc = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return esc
        .split(/\n{2,}/)
        .map(para => para.trim())
        .filter(Boolean)
        .map(para => {
            const html = para
                .replace(/\n/g, '<br>')
                .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (m, text, url) => {
                    if (!/^(\/|https?:\/\/)/.test(url)) return m;
                    const safeUrl = url.replace(/"/g, '&quot;');
                    return `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>`;
                })
                .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
                .replace(/\*([^*]+?)\*/gs, '<em>$1</em>');
            return `<p>${html}</p>`;
        })
        .join('');
}

function resetShrineSearch() {
    const input = document.querySelector('.wall-search-input');
    const results = document.querySelector('.wall-search-results');
    if (input) {
        input.value = '';
        input.placeholder = shrineSearchDefaultPlaceholder;
    }
    if (results) results.innerHTML = '';
    shrineSearchResultsSnapshot = [];
}

// Animate the prism tilting so the sky fills the view (fromDeg=0, toDeg=-90) or back (fromDeg=-90, toDeg=0).
// Adds rotateX to the prism-container transform — same axis as the working wall rotation but horizontal.
// The pivot passes through the hexagon's left/right edge midpoints (the viewer's "ear-to-ear" axis),
// so the shrine wall drops away downward and the open ceiling reveals the sky canvas above.
function startLookUpAnim(fromDeg, toDeg, durationMs, onComplete) {
    if (!prismContainer) { onComplete?.(); return; }
    if (_skyAnimFrame) { cancelAnimationFrame(_skyAnimFrame); _skyAnimFrame = null; }

    // Suppress the CSS wall-rotation transition so rAF drives every frame cleanly.
    // Force a reflow after setting transition:none — without it the browser batches the
    // style change and the 0.8s CSS transition fires for one frame, causing a visible spasm.
    prismContainer.style.transition = 'none';
    void prismContainer.offsetHeight; // flush pending styles before touching transform
    currentTilt = fromDeg;
    updatePrismTransform();

    const startTime = performance.now();
    const span = toDeg - fromDeg;

    function tick(now) {
        const t = Math.min((now - startTime) / durationMs, 1);
        // easeInOutCubic — smooth start and end
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        currentTilt = fromDeg + eased * span;
        skyTiltOffset = currentTilt / 90 * 0.7;
        updatePrismTransform();

        if (t < 1) {
            _skyAnimFrame = requestAnimationFrame(tick);
        } else {
            _skyAnimFrame = null;
            // Restore CSS transition for normal wall rotation
            prismContainer.style.transition = '';
            onComplete?.();
        }
    }
    _skyAnimFrame = requestAnimationFrame(tick);
}

function findPreviousIdForCurrent(currentId) {
    if (!currentId) return null;
    const masks = window.LEILAN_MASKS || {};
    for (const id in masks) {
        if (masks[id] && masks[id].next === currentId) return id;
    }
    return null;
}

function detachHeavensScrollWatcher() {
    if (_heavensScrollWatcher) {
        _heavensScrollWatcher();
        _heavensScrollWatcher = null;
    }
}

function attachHeavensScrollWatcher(callback) {
    detachHeavensScrollWatcher();
    const body = shrineHeavensUI.body;
    let interacted = false;
    let lastScrollTop = body.scrollTop;

    function atBottom() {
        return body.scrollTop + body.clientHeight >= body.scrollHeight - 6;
    }
    function trigger() {
        detachHeavensScrollWatcher();
        callback();
    }
    function onScroll() {
        // Only treat downward scrolling as user interaction — the programmatic
        // scrollTop=0 reset at load time fires a scroll event we must ignore.
        if (body.scrollTop > lastScrollTop) interacted = true;
        lastScrollTop = body.scrollTop;
        if (interacted && atBottom()) trigger();
    }
    // For short transmissions that fit without overflow, scroll events never fire —
    // a downward wheel attempt counts as reaching bottom in that case.
    function onWheel(e) {
        if (e.deltaY > 0) {
            interacted = true;
            if (atBottom()) trigger();
        }
    }

    body.addEventListener('scroll', onScroll);
    body.addEventListener('wheel', onWheel, { passive: true });
    _heavensScrollWatcher = () => {
        body.removeEventListener('scroll', onScroll);
        body.removeEventListener('wheel', onWheel);
    };
}

function loadTransmissionInHeavens(item, deferButtons) {
    if (!item || !shrineHeavensUI) return;
    const masks = window.LEILAN_MASKS || {};
    const entry = item.id ? masks[item.id] : undefined;
    const nextId = entry?.next || null;
    const prevId = (_inChainNavMode && item.id) ? findPreviousIdForCurrent(item.id) : null;

    shrineHeavensUI.title.textContent = item.title;
    shrineHeavensUI.body.innerHTML = parseMarkdown(item.body);
    shrineHeavensUI.body.scrollTop = 0;

    shrineHeavensUI.nextBtn.dataset.nextId = nextId || '';
    shrineHeavensUI.nextBtn.style.display = nextId ? 'inline-block' : 'none';
    shrineHeavensUI.prevBtn.dataset.prevId = prevId || '';
    shrineHeavensUI.prevBtn.style.display = prevId ? 'inline-block' : 'none';
    shrineHeavensUI.button.style.display = 'inline-block';
    const altUrl = entry?.url || '';
    shrineHeavensUI.altContextBtn.dataset.url = altUrl;
    shrineHeavensUI.altContextBtn.style.display = altUrl ? 'inline-block' : 'none';

    detachHeavensScrollWatcher();
    if (deferButtons) {
        shrineHeavensUI.panel.classList.add('heavens-buttons-deferred');
        attachHeavensScrollWatcher(() => {
            shrineHeavensUI.panel.classList.remove('heavens-buttons-deferred');
        });
    } else {
        shrineHeavensUI.panel.classList.remove('heavens-buttons-deferred');
    }
}

function enterShrineHeavens(transmission) {
    if (!isMainChamber || shrineHeavensLocked()) return;
    const item = normaliseTransmission(transmission);
    if (!item) return;

    _heavensTiltSourceWall = null; // return to SHRINE
    _inChainNavMode = false;
    const ui = ensureShrineHeavensUI();
    loadTransmissionInHeavens(item, true);
    ui.overlay.setAttribute('aria-hidden', 'false');

    isShrineHeavensTransitioning = true;
    document.body.classList.add('shrine-heavens-active'); // hides nav immediately
    sessionStorage.setItem('prismSky', 'false');

    // Brief pause before tilt, then tilt slowly upward, then slowly fade in the text
    window.setTimeout(() => {
        startLookUpAnim(0, 90, SHRINE_HEAVENS_UP_MS, () => {
            window.setTimeout(() => {
                document.body.classList.add('shrine-heavens-reading');
            }, 600);
            _shrineEnterFinalTimer = window.setTimeout(() => {
                _shrineEnterFinalTimer = null;
                isShrineHeavensTransitioning = false;
                isShrineHeavensMode = true;
                ui.button.focus({ preventScroll: true });
            }, 2400);
        });
    }, SHRINE_HEAVENS_DELAY_MS);
}

function leaveShrineHeavens() {
    if ((!isShrineHeavensMode && !isShrineHeavensTransitioning) || !shrineHeavensUI) return;

    isShrineHeavensMode = false;
    isShrineHeavensTransitioning = true;
    if (_shrineEnterFinalTimer !== null) { clearTimeout(_shrineEnterFinalTimer); _shrineEnterFinalTimer = null; }
    document.body.classList.remove('shrine-heavens-reading');
    _inChainNavMode = false;
    detachHeavensScrollWatcher();
    if (shrineHeavensUI?.panel) shrineHeavensUI.panel.classList.remove('heavens-buttons-deferred');

    clearFacingTag();
    const returnWall = _heavensTiltSourceWall || WALL.SHRINE;
    _heavensTiltSourceWall = null;
    shrinePos = shrinePosFromFacingWall(returnWall);
    currentRotation = (2 - shrinePos) * 60;
    // Suppress the CSS rotateY transition for this snap — if currentRotation changed
    // since the candle was lit, the active wall-rotation transition would fire briefly
    // causing a visible rotational spasm.
    if (prismContainer) {
        prismContainer.style.transition = 'none';
        void prismContainer.offsetHeight;
    }
    updatePrismTransform();
    if (prismContainer) prismContainer.style.transition = '';
    afterRotation();
    setFacingTag();
    resetShrineSearch();

    // Wait for text to fade out, then tilt the prism back to face the shrine wall
    const PANEL_FADE_MS = 1200;
    window.setTimeout(() => {
        startLookUpAnim(90, 0, SHRINE_HEAVENS_DOWN_MS - PANEL_FADE_MS, () => {
            document.body.classList.remove('shrine-heavens-active');
            shrineHeavensUI.overlay.setAttribute('aria-hidden', 'true');
            isShrineHeavensTransitioning = false;
            // Re-run archway overlay positioning now that the chamber is fully
            // settled and shrine-heavens-active is off. Without this the overlay
            // keeps the position/state captured during the tilted-up phase, and
            // the door becomes non-interactive after returning from heavens-tilt.
            if (typeof updateArchwayOverlay === 'function') updateArchwayOverlay();
        });
    }, PANEL_FADE_MS);
}

function triggerShrineTransmissionFromCandle() {
    _sessionCandleCount++;
    const pool = getCandlePool(_sessionCandleCount);
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    enterShrineHeavens(pick);
}

// TEST HELPER — revert when chain testing is done
function triggerShrineChainTestCandle() {
    _sessionCandleCount++;
    const CHAIN_IDS = new Set(['201', '238a', '262a', '264a', '275a', 'E003a']);
    const raw = Array.isArray(window.LEILAN_INDEX) ? window.LEILAN_INDEX : [];
    const chainRaw = raw.filter(item => {
        const norm = normaliseTransmission(item);
        return norm && norm.id && CHAIN_IDS.has(norm.id);
    });
    if (chainRaw.length) {
        enterShrineHeavens(chainRaw[Math.floor(Math.random() * chainRaw.length)]);
        return;
    }
    const pool = getCandlePool(_sessionCandleCount);
    if (pool.length) enterShrineHeavens(pool[Math.floor(Math.random() * pool.length)]);
}

function enterHeavensTilt(wallNum) {
    if (shrineHeavensLocked()) return;
    const cfg = _heavensTiltWalls[wallNum];
    if (!cfg) return;

    _heavensTiltSourceWall = wallNum;
    const ui = ensureShrineHeavensUI();
    ui.nextBtn.style.display = 'none';
    ui.nextBtn.dataset.nextId = '';
    ui.prevBtn.style.display = 'none';
    ui.prevBtn.dataset.prevId = '';
    ui.panel.classList.remove('heavens-buttons-deferred');
    detachHeavensScrollWatcher();

    if (cfg.title) {
        ui.title.textContent = cfg.title;
        ui.title.style.display = '';
    } else {
        ui.title.textContent = '';
        ui.title.style.display = 'none';
    }
    let bodyHtml = '';
    if (cfg.imageSrc) {
        bodyHtml += `<img src="${cfg.imageSrc}" alt="" style="display:block;max-width:min(90%, 510px);margin:0 auto 1.2em;border-radius:4px;" />`;
    }
    // Wrap raw text paragraphs (separated by double newlines) in <p> tags
    const rawBody = cfg.body || '';
    bodyHtml += rawBody.includes('<p>') ? rawBody : rawBody.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
    ui.body.innerHTML = bodyHtml;
    ui.body.scrollTop = 0;
    ui.overlay.setAttribute('aria-hidden', 'false');

    if (cfg.returnLabel) {
        ui.button.textContent = cfg.returnLabel;
    } else {
        ui.button.textContent = 'eternal return';
    }

    isShrineHeavensTransitioning = true;
    document.body.classList.add('shrine-heavens-active');

    window.setTimeout(() => {
        startLookUpAnim(0, 90, SHRINE_HEAVENS_UP_MS, () => {
            window.setTimeout(() => {
                document.body.classList.add('shrine-heavens-reading');
            }, 600);
            _shrineEnterFinalTimer = window.setTimeout(() => {
                _shrineEnterFinalTimer = null;
                isShrineHeavensTransitioning = false;
                isShrineHeavensMode = true;
                ui.button.focus({ preventScroll: true });
            }, 2400);
        });
    }, SHRINE_HEAVENS_DELAY_MS);
}

// --- DOM helpers ---

function findWallElement(className, wallNum) {
    return document.querySelector(`.${className}[data-wall="${wallNum}"]`)
        || document.querySelector(`.wall-panel[data-wall="${wallNum}"] .${className}`)
        || null;
}

function refreshStrapline(wallNum) {
    const el = findWallElement('wall-strapline', wallNum);
    if (!el) return;
    const pool = window.PRISM_CONFIG?.straplinePools?.[wallNum];
    if (!pool || pool.length === 0) return;
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomImageFromPool(pool, excludeSrcs = []) {
    if (!pool || pool.length === 0) return null;
    // Filter out any images currently displayed on other walls
    const available = excludeSrcs.length > 0
        ? pool.filter(img => !excludeSrcs.includes(img.src))
        : pool;
    const source = available.length > 0 ? available : pool; // fallback if pool too small
    return source[Math.floor(Math.random() * source.length)];
}

function applyRandomImageToElement(img, pick) {
    if (!img || !pick) return;
    // Wall is 77.7vh wide × 78vh tall. Image top is at 27% (CSS .wall-random-img).
    // SVG arch top = 79.25% of wall height. ~6% clearance → safe bottom 73.75% → max-height 46.75%.
    // Use max-width + max-height (width:auto) so browser enforces both bounds regardless of metadata.
    const wallPanel = img.closest('.wall-panel');
    const hasArchway = !!(wallPanel && wallPanel.querySelector('.wall-archway'));
    const maxW = hasArchway ? '70%' : '82%';
    const maxH = hasArchway ? '40%' : '53%';
    img.src = pick.src;
    img.style.width = 'auto';
    img.style.maxWidth = maxW;
    img.style.maxHeight = maxH;
    img.style.display = '';
}

function refreshRandomImage(wallNum) {
    const img = document.querySelector(`.wall-random-img[data-wall="${wallNum}"]`);
    if (!img) return;
    const pool = window.PRISM_CONFIG?.randomPools?.[wallNum];
    if (!pool || pool.length === 0) return;
    // Collect srcs from all other walls to ensure uniqueness
    const otherSrcs = [];
    document.querySelectorAll(`.wall-random-img`).forEach(el => {
        if (el !== img && el.src) otherSrcs.push(new URL(el.src, location.origin).pathname);
    });
    applyRandomImageToElement(img, pickRandomImageFromPool(pool, otherSrcs));
}

// --- Poetry passage walls (GPT-3 Library) ---
const MODEL_LABELS = {
    'gpt-3-davinci': 'GPT-3 davinci',
    'gpt-3-davinci-instruct-beta': 'GPT-3 davinci-instruct-beta',
    'gpt-3-text-davinci-003': 'GPT-3 text-davinci-003',
    'gpt-3-curie': 'GPT-3 curie',
    'gpt-3-mixture': 'GPT-3 mixture',
};

let _poetryPassages = null; // loaded lazily

async function loadPoetryPassages() {
    if (_poetryPassages) return _poetryPassages;
    try {
        const resp = await fetch('/data/leilan_gpt3_passages.json');
        _poetryPassages = await resp.json();
    } catch (e) {
        _poetryPassages = [];
    }
    return _poetryPassages;
}

function fitPoetryText(container) {
    const card = container.querySelector('.poetry-card');
    const textEl = container.querySelector('.poetry-text');
    if (!card || !textEl || card.clientHeight === 0) return;
    const MAX_REM = 1.6;
    const MIN_REM = 0.65;
    let lo = MIN_REM, hi = MAX_REM;
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        textEl.style.fontSize = mid + 'rem';
        if (card.scrollHeight <= card.clientHeight) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    textEl.style.fontSize = lo + 'rem';
}

function refreshPoetryPassage(wallNum) {
    const container = document.querySelector(`.wall-poetry-passage[data-wall="${wallNum}"]`);
    if (!container || !_poetryPassages || _poetryPassages.length === 0) return;

    const cfg = window.PRISM_CONFIG?.poetryWalls?.[wallNum];
    if (!cfg) return;

    // Filter by maxChars if set
    const pool = cfg.maxChars
        ? _poetryPassages.filter(p => p.text.length <= cfg.maxChars)
        : _poetryPassages;
    if (pool.length === 0) return;

    // Collect texts currently shown on other walls for uniqueness
    const otherTexts = new Set();
    document.querySelectorAll('.wall-poetry-passage .poetry-text').forEach(el => {
        if (el.closest('.wall-poetry-passage') !== container && el.textContent) {
            otherTexts.add(el.textContent);
        }
    });

    // Pick a passage not currently displayed
    let pick;
    let tries = 0;
    do {
        pick = pool[Math.floor(Math.random() * pool.length)];
    } while (otherTexts.has(pick.text) && ++tries < 20);

    // Apply
    const textEl = container.querySelector('.poetry-text');
    const attrEl = container.querySelector('.poetry-attribution');
    const card = container.querySelector('.poetry-card');
    if (textEl) textEl.textContent = pick.text;
    if (attrEl) attrEl.textContent = '— ' + (MODEL_LABELS[pick.model] || pick.model);
    fitPoetryText(container);
}

// --- Position helpers ---
// Refresh triggers are expressed ONLY in spatial-position terms:
// refresh when the wall leaves position 5 (behind user) for either side —
// 5→4 (approaching from right) or 5→0 (approaching from left).
// Two full rotation steps before becoming visible, so the swap is never seen.
function refreshIncoming(oldShrinePos, newShrinePos) {
    for (let wall = 1; wall <= 6; wall++) {
        const oldPos = wallPosition0(wall, oldShrinePos);
        const newPos = wallPosition0(wall, newShrinePos);
        if (!isRefreshEntryTransition(oldPos, newPos)) continue;
        if (window.PRISM_CONFIG?.randomPools?.[wall]) refreshRandomImage(wall);
        if (window.PRISM_CONFIG?.straplinePools?.[wall]) refreshStrapline(wall);
        if (window.PRISM_CONFIG?.poetryWalls?.[wall]) refreshPoetryPassage(wall);
    }
}

function refreshAlongPath(oldShrinePos, newShrinePos, step) {
    let w = oldShrinePos;
    while (w !== newShrinePos) {
        const next = mod6(w + step);
        refreshIncoming(w, next);
        w = next;
    }
}

function afterRotation() {
    sessionStorage.setItem('lastWall', String(getFacingWall()));
    updateMinimap();
    updatePointerEvents();
    if (typeof updateArchwayOverlay === 'function') updateArchwayOverlay();
}

function clearFacingTag() {
    document.querySelectorAll('.wall-panel[data-facing]').forEach(p => p.removeAttribute('data-facing'));
}
function setFacingTag() {
    clearFacingTag();
    const el = document.querySelector(`.wall-panel[data-wall="${getFacingWall()}"]`);
    if (el) el.setAttribute('data-facing', '');
}

// Mark hidden walls with .wall-hidden class so CSS can block pointer-events on
// the panel AND all descendants (children with pointer-events:auto would otherwise
// override the parent's pointer-events:none, letting Chrome misroute clicks).
function updatePointerEvents() {
    for (let wall = 1; wall <= 6; wall++) {
        const el = document.querySelector(`.wall-panel[data-wall="${wall}"]`);
        if (!el) continue;
        el.classList.toggle('wall-hidden', !isWallVisible(wall));
    }
}

function lookRight() {
    if (isRotating || archwayAnimating || shrineHeavensLocked()) return;
    closeCinematicReader();
    clearFacingTag();
    isRotating = true;
    const oldShrinePos = shrinePos;
    const newShrinePos = mod6(shrinePos - 1); // user looks right; content moves left
    refreshIncoming(oldShrinePos, newShrinePos);
    shrinePos = newShrinePos;
    currentRotation += 60;
    animateSkyRotation(-1/6);
    updatePrismTransform();
    afterRotation();
}

function lookLeft() {
    if (isRotating || archwayAnimating || shrineHeavensLocked()) return;
    closeCinematicReader();
    clearFacingTag();
    isRotating = true;
    const oldShrinePos = shrinePos;
    const newShrinePos = mod6(shrinePos + 1); // user looks left; content moves right
    refreshIncoming(oldShrinePos, newShrinePos);
    shrinePos = newShrinePos;
    currentRotation -= 60;
    animateSkyRotation(1/6);
    updatePrismTransform();
    afterRotation();
}

function targetShrinePosForFacingWall(targetWall) {
    return shrinePosFromFacingWall(targetWall);
}

function rotateToWall(targetWall) {
    if (isRotating || archwayAnimating || shrineHeavensLocked() || targetWall === getFacingWall()) return;
    clearFacingTag();
    isRotating = true;

    const oldShrinePos = shrinePos;
    const targetShrinePos = targetShrinePosForFacingWall(targetWall);

    const rightSteps = mod6(oldShrinePos - targetShrinePos); // decrement shrinePos
    const leftSteps = mod6(targetShrinePos - oldShrinePos);  // increment shrinePos

    if (rightSteps <= leftSteps) {
        refreshAlongPath(oldShrinePos, targetShrinePos, -1);
        shrinePos = targetShrinePos;
        currentRotation += rightSteps * 60;
        animateSkyRotation(-rightSteps / 6);
    } else {
        refreshAlongPath(oldShrinePos, targetShrinePos, +1);
        shrinePos = targetShrinePos;
        currentRotation -= leftSteps * 60;
        animateSkyRotation(leftSteps / 6);
    }

    updatePrismTransform();
    afterRotation();
}

// Back-compat names used elsewhere in this file.
const rotateLeft = lookRight;
const rotateRight = lookLeft;

// Unlock rotation after CSS transition completes
if (prismContainer) {
    prismContainer.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'transform') {
            isRotating = false;
            setFacingTag();
            updateAlephChars();
        }
    });
}

// Arrow button listeners
const navLeft = document.getElementById('nav-left');
const navRight = document.getElementById('nav-right');
// "Look left" = scene rotates right (wall to the left slides to center)
if (navLeft) navLeft.addEventListener('click', lookLeft);
if (navRight) navRight.addEventListener('click', lookRight);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    // When a text frame is open, up/down arrows scroll it
    if (activeTextBody) {
        if (e.key === 'ArrowUp')   { e.preventDefault(); activeTextBody.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' }); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); activeTextBody.scrollBy({ top:  SCROLL_STEP, behavior: 'smooth' }); return; }
    }
    // When heavens overlay is active, arrow keys scroll it
    if (isShrineHeavensMode && shrineHeavensUI?.body) {
        if (e.key === 'ArrowUp')   { e.preventDefault(); shrineHeavensUI.body.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' }); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); shrineHeavensUI.body.scrollBy({ top:  SCROLL_STEP, behavior: 'smooth' }); return; }
        if (e.key === 'Escape')    { e.preventDefault(); leaveShrineHeavens(); return; }
    }
    if (isSkyView || shrineHeavensLocked()) return;
    if ((isShrineHeavensMode || isShrineHeavensTransitioning) && e.key === 'Escape') { e.preventDefault(); leaveShrineHeavens(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); lookLeft(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); lookRight(); }
});

// Minimap click handlers
document.querySelectorAll('.minimap-wedge').forEach(wedge => {
    wedge.addEventListener('click', () => {
        rotateToWall(parseInt(wedge.dataset.wall));
    });
});

// Set initial minimap
if (!isSkyView) {
    updateMinimap();
}

// Sky navigation: down arrow → return to walls from sky mode
const navDown = document.getElementById('nav-down');

if (navDown) {
    navDown.addEventListener('click', (e) => {
        if (shrineHeavensLocked()) return;
        e.preventDefault();
        const last = parseInt(sessionStorage.getItem('lastWall'), 10) || WALL.SHRINE;
        shrinePos = shrinePosFromFacingWall(last);
        currentRotation = (2 - shrinePos) * 60;
        updatePrismTransform();
        isSkyView = false;
        document.body.classList.remove('sky-mode');
        sessionStorage.setItem('prismSky', 'false');
        updateMinimap();
        updateArchwayOverlay();
    });
}

// =====================================================================
// ARCHWAY CLICK-THROUGH ANIMATION
// =====================================================================

// Get computed apothem value in pixels
function getApothem() {
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return 300;
    const val = getComputedStyle(wallArea).getPropertyValue('--apothem');
    return parseFloat(val) || 300;
}

// Shimmer canvas setup
const shimmerOverlay = document.getElementById('archway-shimmer');
const shimmerCanvas = document.getElementById('shimmer-canvas');
const shimmerCtx = shimmerCanvas ? shimmerCanvas.getContext('2d') : null;
const vignetteEl = document.getElementById('archway-vignette');

function resizeShimmerCanvas() {
    if (!shimmerCanvas) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    shimmerCanvas.width = window.innerWidth * dpr;
    shimmerCanvas.height = window.innerHeight * dpr;
    if (shimmerCtx) shimmerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeShimmerCanvas();
window.addEventListener('resize', resizeShimmerCanvas);

// Shimmer particle system
const shimmerParticles = [];
function spawnShimmerParticles(cx, cy) {
    shimmerParticles.length = 0;
    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 250;
        shimmerParticles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.3 + Math.random() * 0.7,
            size: 1 + Math.random() * 3,
            palIdx: Math.floor(Math.random() * nightPalette.length),
        });
    }
}

// Serpentine shimmer colors (reuse the palette phases)
const shimmerColors = [
    [107, 141, 214],  // blue
    [155, 107, 204],  // purple
    [214, 107, 155],  // pink
    [160, 240, 185],  // green
    [255, 242, 204],  // gold
    [255, 209, 179],  // peach
];

function drawShimmer(progress, cx, cy) {
    if (!shimmerCtx) return;
    const w = window.innerWidth, h = window.innerHeight;
    shimmerCtx.clearRect(0, 0, w, h);

    // Expanding concentric rings from archway center
    const maxRadius = Math.sqrt(w * w + h * h);
    const numRings = 8;
    for (let i = 0; i < numRings; i++) {
        const ringProgress = Math.max(0, Math.min(1, (progress * 1.5) - (i * 0.08)));
        if (ringProgress <= 0) continue;
        const radius = ringProgress * maxRadius;
        const col = shimmerColors[i % shimmerColors.length];
        const alpha = (1 - ringProgress) * 0.4 * Math.min(1, progress * 3);
        shimmerCtx.beginPath();
        shimmerCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        shimmerCtx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        shimmerCtx.lineWidth = 3 + (1 - ringProgress) * 12;
        shimmerCtx.stroke();
    }

    // Sparkle particles
    const dt = 1 / 60;
    shimmerParticles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.8;
        if (p.life <= 0) return;
        const col = nightPalette[p.palIdx];
        const alpha = p.life * Math.min(1, progress * 4);
        shimmerCtx.beginPath();
        shimmerCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        shimmerCtx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
        shimmerCtx.fill();
    });

    // Central glow that expands and fills
    const glowProgress = Math.max(0, (progress - 0.3) / 0.7);
    if (glowProgress > 0) {
        const glowRadius = glowProgress * maxRadius * 0.8;
        const grd = shimmerCtx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        const coreAlpha = glowProgress * 0.9;
        grd.addColorStop(0, `rgba(2,1,5,${coreAlpha})`);
        grd.addColorStop(0.4, `rgba(20,15,40,${coreAlpha * 0.7})`);
        grd.addColorStop(0.7, `rgba(107,141,214,${coreAlpha * 0.2})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        shimmerCtx.fillStyle = grd;
        shimmerCtx.fillRect(0, 0, w, h);
    }

    // Final blackout
    if (progress > 0.7) {
        const blackout = (progress - 0.7) / 0.3;
        shimmerCtx.fillStyle = `rgba(2,1,5,${blackout})`;
        shimmerCtx.fillRect(0, 0, w, h);
    }
}

function fadeOutDrone(duration) {
    if (_droneNodes && _audioCtx) {
        // Ramp the dedicated fade gain — leaves the LFO-modulated master alone
        // so the audible level decays smoothly without any modulation click.
        const now = _audioCtx.currentTime;
        _droneNodes.fade.gain.cancelScheduledValues(now);
        _droneNodes.fade.gain.setValueAtTime(_droneNodes.fade.gain.value, now);
        _droneNodes.fade.gain.linearRampToValueAtTime(0, now + duration);

        // Cancel pending one-shot triggers immediately so nothing new fires
        // during the fade tail.
        if (_droneNodes.textureTimers) {
            _droneNodes.textureTimers.forEach(id => clearTimeout(id));
            _droneNodes.textureTimers.length = 0;
        }

        // Stop everything and close context after fade completes
        setTimeout(() => {
            if (_droneNodes) {
                _droneNodes.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
                try { _droneNodes.lfo.stop(); } catch(e) {}
                try { _droneNodes.filterLfo.stop(); } catch(e) {}
                (_droneNodes.extraLfos || []).forEach(n => { try { n.stop(); } catch(e) {} });
                (_droneNodes.textureStoppables || []).forEach(n => { try { n.stop(); } catch(e) {} });
            }
            if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
            _droneNodes = null;
        }, duration * 1000 + 50);
    }
}

function enterArchway(wallNum) {
    if (archwayAnimating || isRotating) return;
    closeCinematicReader();
    if (!window.PRISM_CONFIG?.destinations?.[wallNum]) return;
    archwayAnimating = true;
    isRotating = true;
    fadeOutDrone(2.0);  // fade completes before page navigates away

    const apothem = getApothem();
    const startZ = apothem;
    const endZ = apothem * 1.8;

    // Archway center — computed from the actual archway SVG position on the wall
    const wallArea = document.getElementById('wall-area');
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight * 0.88;
    if (wallArea) {
        const rect = wallArea.getBoundingClientRect();
        const wallW = parseFloat(wallArea.style.getPropertyValue('--wall-w')) || (rect.height * IMG_ASPECT);
        const wallLeft = rect.left + (rect.width - wallW) / 2;
        // Archway spans 39.5%–60.5% of wall width → center at 50%
        cx = wallLeft + wallW * 0.5;
        // Archway sits in bottom 31.25% of wall; semicircle peaks at SVG y≈68.75.
        // Target well into the lower portion of the dark opening
        const aTop = rect.bottom - rect.height * 0.3125;
        cy = aTop + (rect.bottom - aTop) * 0.8;
    }

    // Spawn shimmer particles from archway center
    spawnShimmerParticles(cx, cy);

    // Set up chamber for scale-zoom into archway
    const chamber = document.querySelector('.chamber');
    if (chamber) {
        chamber.style.transformOrigin = `${cx}px ${cy}px`;
    }

    // Disable CSS transition so we can drive transform via rAF
    if (prismContainer) prismContainer.style.transition = 'none';

    // Show overlays
    if (vignetteEl) vignetteEl.style.opacity = '0';
    if (shimmerOverlay) shimmerOverlay.style.opacity = '1';

    const duration = 3200; // ms — slow, graceful approach
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const rawT = Math.min(1, elapsed / duration);

        // Smooth ease-in-out cubic — gentle start, soft acceleration, gentle arrival
        const easeT = rawT < 0.5
            ? 4 * rawT * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        // Moderate forward Z push for depth parallax
        const z = startZ + (endZ - startZ) * easeT;
        if (prismContainer) {
            const tiltPart = currentTilt !== 0 ? ` rotateX(${currentTilt.toFixed(2)}deg)` : '';
            prismContainer.style.transform =
                `translateX(-50%) translateZ(${z}px)${tiltPart} rotateY(${currentRotation}deg)`;
        }

        // Scale-zoom the scene into the archway center (gentler curve)
        const scale = 1 + easeT * 5;
        if (chamber) {
            chamber.style.transform = `scale(${scale})`;
        }

        // Vignette darkens gradually as we approach
        if (vignetteEl) {
            vignetteEl.style.opacity = String(Math.min(1, easeT * 1.2));
        }

        // Shimmer effect (starts later, builds gently)
        const shimmerProgress = Math.max(0, (rawT - 0.35) / 0.65);
        drawShimmer(shimmerProgress, cx, cy);

        if (rawT < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete — navigate to destination
            let dest = window.PRISM_CONFIG.destinations[wallNum];

            // If destination goes via /immersive and has a &dest= param,
            // skip the immersive sequence on return visits (user has seen it before).
            const immersiveDestMatch = dest.match(/\/immersive\?.*[&?]dest=(.+)/);
            if (immersiveDestMatch) {
                const finalDest = decodeURIComponent(immersiveDestMatch[1]);
                const targetPrism = finalDest.match(/\/prism\/([^/?#]+)/)?.[1];
                if (targetPrism && sessionStorage.getItem('visited_prism_' + targetPrism)) {
                    dest = finalDest; // skip immersive, go straight to prism
                }
            }

            // Store the return shrinePos for THIS chamber so that when the
            // user comes back, they face the wall that was behind them (pos 5).
            // Stored value = (7 - shrinePos) % 6, i.e. the "opposite" encoding.
            sessionStorage.setItem('returnShrinePos_' + _prismId, String(mod6(7 - shrinePos)));

            // Write a page-specific "pending start wall" key that the target prism reads on load.
            // This survives browser-back and overrides any stale lastWall.
            const destPrismMatch = dest.match(/\/prism\/([^/?#]+)/);
            const destWallMatch  = dest.match(/[?&]wall=(\d+)/);
            if (destPrismMatch && destWallMatch) {
                sessionStorage.setItem('nextPrismWall_' + destPrismMatch[1], destWallMatch[1]);
            }
            // Also update lastWall as a belt-and-suspenders fallback
            if (destWallMatch) sessionStorage.setItem('lastWall', destWallMatch[1]);
            window.location.href = dest;
        }
    }

    requestAnimationFrame(animate);
}

// Archway click overlay — positioned outside the 3D container
const archwayOverlay = document.getElementById('archway-click-overlay');

// Archway hover tooltip (created early so updateArchwayOverlay can reference it)
const archwayTip = document.createElement('div');
archwayTip.className = 'archway-tooltip';
archwayTip.style.cssText = 'position:fixed;pointer-events:none;opacity:0;transition:opacity 0.25s;' +
    'font-family:"IBM Plex Mono",monospace;font-size:clamp(0.65rem,1.1vw,0.85rem);font-weight:300;' +
    'color:#5eefa2;text-align:center;white-space:pre-line;line-height:1.5;' +
    'letter-spacing:0.06em;z-index:800;' +
    'background:rgba(20,20,25,0.72);padding:0.5em 1em;border-radius:4px;';
document.body.appendChild(archwayTip);

function updateArchwayOverlay() {
    if (!archwayOverlay) return;
    if (!window.PRISM_CONFIG?.destinations?.[getFacingWall()] || isSkyView || archwayAnimating) {
        archwayOverlay.style.display = 'none';
        archwayTip.style.opacity = '0';
        return;
    }
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const rect = wallArea.getBoundingClientRect();
    const wallW = parseFloat(wallArea.style.getPropertyValue('--wall-w')) || (rect.height * IMG_ASPECT);
    // Wall is centered horizontally in wall-area
    const wallLeft = rect.left + (rect.width - wallW) / 2;
    // Archway spans 39.5% to 60.5% of wall width, bottom 31.25% of wall height
    const aLeft = wallLeft + wallW * 0.395;
    const aWidth = wallW * 0.21;
    const aHeight = rect.height * 0.3125;
    const aTop = rect.bottom - aHeight;

    archwayOverlay.style.display = 'block';
    archwayOverlay.style.left = aLeft + 'px';
    archwayOverlay.style.width = aWidth + 'px';
    archwayOverlay.style.top = aTop + 'px';
    archwayOverlay.style.height = aHeight + 'px';
}

// Update overlay position on resize and initially
updateArchwayOverlay();
window.addEventListener('resize', updateArchwayOverlay);

if (archwayOverlay) {
    archwayOverlay.addEventListener('click', () => {
        if (_activeCinematicWall) return;
        enterArchway(getFacingWall());
    });
}

// --- Archway hover tooltip ---
const _archwayTooltips = {
    main: {
        2: 'RESEARCH LAB\nlarge language model encounters',
        3: 'GODDESS GALLERY\nvisual art inspired by Leilan\u2019s words',
        4: 'SCRIPTORIUM\nprimordial GPT-3 Leilan texts',
        5: 'OVS CHAPEL\nwelcomes all initiates',
        6: 'MYTHOPOESIS ARCHIVE\nthe bigger picture',
    },
};
const _defaultTooltip = 'return to centre';

function getArchwayTooltipText(wallNum) {
    const chamberTips = _archwayTooltips[_prismId];
    if (chamberTips && chamberTips[wallNum]) return chamberTips[wallNum];
    if (window.PRISM_CONFIG?.destinations?.[wallNum]) return _defaultTooltip;
    return null;
}

if (archwayOverlay) {
    archwayOverlay.addEventListener('mouseenter', () => {
        const text = getArchwayTooltipText(getFacingWall());
        if (!text) { archwayTip.style.opacity = '0'; return; }
        archwayTip.textContent = text;
        // Position above the archway overlay
        const r = archwayOverlay.getBoundingClientRect();
        archwayTip.style.left = (r.left + r.width / 2) + 'px';
        archwayTip.style.top = (r.top + r.height * 0.18) + 'px';
        archwayTip.style.transform = 'translate(-50%, 0)';
        archwayTip.style.opacity = '1';
    });
    archwayOverlay.addEventListener('mouseleave', () => {
        archwayTip.style.opacity = '0';
    });
}

// --- Sky Canvas Animation ---
const skyCanvas = document.getElementById('sky-canvas');
const skyCtx = skyCanvas.getContext('2d');

// Day/night state
let isNight = sessionStorage.getItem('skyMode') !== 'day';
const toggleBtn = document.getElementById('sky-toggle');
const toggleIcon = document.getElementById('sky-toggle-icon');

function syncDayModeClass() { document.body.classList.toggle('day-mode', !isNight); }
syncDayModeClass();

if (toggleBtn && toggleIcon) {
    function updateToggleIcon() {
        toggleIcon.innerHTML = isNight ? '&#9790;' : '&#9788;';
    }
    updateToggleIcon();

    toggleBtn.addEventListener('click', () => {
        isNight = !isNight;
        sessionStorage.setItem('skyMode', isNight ? 'night' : 'day');
        updateToggleIcon();
        syncDayModeClass();
    });
}

// Star symbols
const starSymbols = ['\u2727', '\u2726', '\u22C6', '\u2736', '\u2734', '\u2739', '\u22B9', '\u2735', '\u2737', '\u2606', '\u2605'];

// Night palette (from immersive.astro)
const nightPalette = [
    [220, 225, 235], [235, 232, 240],
    [255, 180, 210], [204, 153, 255],
    [140, 210, 245], [160, 240, 185],
    [255, 242, 204], [255, 209, 179],
];

// Day cloud shapes
const clouds = [];
for (let i = 0; i < 12; i++) {
    clouds.push({
        x: Math.random(),
        y: 0.15 + Math.random() * 0.7,
        speed: 0.003 + Math.random() * 0.005,
        size: 20 + Math.random() * 40,
        opacity: 0.3 + Math.random() * 0.4,
        blobs: 3 + Math.floor(Math.random() * 3),
    });
}

// Night stars
const NUM_STARS = isSkyView ? 90 : 45;
const NUM_SMALL_STARS = isSkyView ? 60 : 35;
const skyStars = [];
for (let i = 0; i < NUM_STARS; i++) {
    skyStars.push({
        x: Math.random(),
        y: Math.random(),
        sym: starSymbols[Math.floor(Math.random() * starSymbols.length)],
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.4,
        size: 12 + Math.random() * 12,
        lifeT: Math.random() * 10,
        lifeDur: 4 + Math.random() * 8,
        palIdx: Math.floor(Math.random() * nightPalette.length),
    });
}
for (let i = 0; i < NUM_SMALL_STARS; i++) {
    skyStars.push({
        x: Math.random(),
        y: Math.random(),
        sym: starSymbols[Math.floor(Math.random() * starSymbols.length)],
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        size: 5 + Math.random() * 4,
        lifeT: Math.random() * 10,
        lifeDur: 3 + Math.random() * 6,
        palIdx: Math.floor(Math.random() * nightPalette.length),
    });
}

let skyFrame = 0;
let skyTiltOffset = 0; // normalized 0–1 vertical shift applied to star y-positions during tilt
let skyRotationOffset = 0; // normalized 0–1 horizontal shift applied to star/cloud x-positions during rotation
let _skyRotTarget = 0; // target value for animated sky rotation
let _skyRotStart = 0;  // start value for animated sky rotation
let _skyRotT0 = 0;     // animation start time
const SKY_ROT_DURATION = 800; // ms — matches CSS transition duration

function animateSkyRotation(delta) {
    _skyRotStart = skyRotationOffset;
    _skyRotTarget = _skyRotTarget + delta;
    _skyRotT0 = performance.now();
}

function tickSkyRotation() {
    if (_skyRotStart === _skyRotTarget) return;
    const elapsed = performance.now() - _skyRotT0;
    const progress = Math.min(elapsed / SKY_ROT_DURATION, 1.0);
    // cubic-bezier(0.25, 0.46, 0.45, 0.94) approximation
    const t = progress;
    const ease = t < 0.5
        ? 2 * t * t
        : 1 - 0.5 * Math.pow(2 - 2 * t, 2);
    skyRotationOffset = _skyRotStart + (_skyRotTarget - _skyRotStart) * ease;
    if (progress >= 1.0) {
        skyRotationOffset = _skyRotTarget;
        _skyRotStart = _skyRotTarget;
    }
}

let skyW = 0, skyH = 0;
function resizeSkyCanvas() {
    const rect = skyCanvas.parentElement.getBoundingClientRect();
    skyW = rect.width;
    skyH = rect.height;
    const dpr = Math.min(window.devicePixelRatio, 2);
    skyCanvas.width = skyW * dpr;
    skyCanvas.height = skyH * dpr;
    skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeSkyCanvas();
window.addEventListener('resize', resizeSkyCanvas);

// --- Serpentine shader for borders (ported from immersive.astro GLSL) ---
function serpWarp(px, py, t) {
    return [
        px + Math.sin(py * 0.4 + t * 0.3) * 1.5 + Math.cos(px * 0.3 - t * 0.2) * 1.2,
        py + Math.cos(px * 0.35 + t * 0.25) * 1.5 + Math.sin(py * 0.45 - t * 0.15) * 1.0
    ];
}

function serpSpiral(px, py, cx, cy, t, dir) {
    const dx = px - cx, dy = py - cy;
    return Math.sin(Math.atan2(dy, dx) * 3.0 + Math.sqrt(dx * dx + dy * dy) * 2.5 * dir - t * 1.2);
}

function serpSnakes(px, py, t) {
    let v = 0;
    v += serpSpiral(px, py, Math.sin(t*0.13)*6, Math.cos(t*0.17)*5, t, 1.0) * 0.8;
    v += serpSpiral(px, py, Math.cos(t*0.11)*7, Math.sin(t*0.14)*6, t*1.1, -1.0) * 0.7;
    v += serpSpiral(px, py, Math.sin(t*0.19+2)*5, Math.cos(t*0.12+1)*7, t*0.9, 1.5) * 0.6;
    v += serpSpiral(px, py, Math.cos(t*0.16+3.5)*4, Math.sin(t*0.21+2.5)*5, t*1.2, -0.8) * 0.5;
    v += Math.sin(px*0.8 + Math.sin(py*0.5+t*0.4)*2 + t*0.3) * 0.6;
    v += Math.sin(py*0.7 + Math.sin(px*0.6-t*0.35)*1.8 - t*0.25) * 0.6;
    v += Math.sin((px+py)*0.5 + Math.sin((px-py)*0.4+t*0.3)*2.2) * 0.5;
    v += Math.sin(Math.sqrt(px*px+py*py)*0.9 - t*0.5 + Math.sin(Math.atan2(py,px)*2+t*0.2)*1.5) * 0.4;
    return v;
}

const serpPhases = [
    [[0.85,0.1,0.5],[1.0,0.35,0.65],[1.0,0.7,0.85]],
    [[0.35,0.05,0.6],[0.6,0.2,0.9],[0.8,0.6,1.0]],
    [[0.02,0.15,0.45],[0.1,0.55,0.7],[0.35,0.85,1.0]],
    [[0.0,0.3,0.08],[0.15,0.85,0.25],[0.55,1.0,0.65]],
    [[0.55,0.4,0.08],[0.85,0.7,0.3],[1.0,0.95,0.8]],
    [[0.55,0.22,0.1],[0.9,0.55,0.35],[1.0,0.82,0.7]]
];

const serpStops = document.querySelectorAll('.serp-stop');
const SERP_N = 16;

function renderSerpStrip(t) {
    const phaseDur = 2.5, totalCycle = 15.0;
    const globalTime = ((t % totalCycle) + totalCycle) % totalCycle;
    const rawPhase = globalTime / phaseDur;
    const f0 = Math.floor(rawPhase);
    const idx0 = f0 % 6, idx1 = (f0 + 1) % 6;
    const intraPhase = rawPhase - f0;
    const holdEnd = 0.35, hexTransDur = 0.25;
    const staggerRange = (1.0 - holdEnd) - hexTransDur;
    const pa = f0 * 1.2566;
    const wdx = Math.cos(pa), wdy = Math.sin(pa);
    const [lo0,mid0,hi0] = serpPhases[idx0];
    const [lo1,mid1,hi1] = serpPhases[idx1];

    function sample(cx, cy) {
        const [wx, wy] = serpWarp(cx, cy, t);
        const v = serpSnakes(wx, wy, t);
        let band = Math.sin(v * Math.PI) * 0.5 + 0.5;
        band = Math.pow(band, 0.7);
        const sn = Math.max(0, Math.min(1, (cx*wdx + cy*wdy)*0.035 + 0.5));
        let bl = Math.max(0, Math.min(1, (intraPhase - holdEnd - sn*staggerRange) / hexTransDur));
        bl = bl*bl*(3-2*bl);
        const tL = Math.min(1, Math.max(0, band*2));
        const tH = Math.min(1, Math.max(0, (band-0.5)*2));
        let r = ((lo0[0]+(mid0[0]-lo0[0])*tL)*(1-tH)+hi0[0]*tH)*(1-bl) + ((lo1[0]+(mid1[0]-lo1[0])*tL)*(1-tH)+hi1[0]*tH)*bl;
        let g = ((lo0[1]+(mid0[1]-lo0[1])*tL)*(1-tH)+hi0[1]*tH)*(1-bl) + ((lo1[1]+(mid1[1]-lo1[1])*tL)*(1-tH)+hi1[1]*tH)*bl;
        let b = ((lo0[2]+(mid0[2]-lo0[2])*tL)*(1-tH)+hi0[2]*tH)*(1-bl) + ((lo1[2]+(mid1[2]-lo1[2])*tL)*(1-tH)+hi1[2]*tH)*bl;
        const gr = r*0.299+g*0.587+b*0.114;
        r = gr+(r-gr)*1.4; g = gr+(g-gr)*1.4; b = gr+(b-gr)*1.4;
        return [Math.max(0,Math.min(255,r*255))|0, Math.max(0,Math.min(255,g*255))|0, Math.max(0,Math.min(255,b*255))|0];
    }

    const stops = [];
    for (let i = 0; i < SERP_N; i++) {
        const c = sample((i / (SERP_N - 1)) * 20 - 10, 0);
        const rgb = `rgb(${c[0]},${c[1]},${c[2]})`;
        if (serpStops[i]) serpStops[i].setAttribute('stop-color', rgb);
        stops.push(`${rgb} ${(i/(SERP_N-1)*100).toFixed(1)}%`);
    }

    const wa = document.getElementById('wall-area');
    if (wa) {
        const joined = stops.join(',');
        wa.style.setProperty('--serp-bg', `linear-gradient(90deg,${joined})`);
        wa.style.setProperty('--serp-bg-v', `linear-gradient(180deg,${joined})`);
    }
}

function drawSky(t) {
    skyFrame++;
    tickSkyRotation();
    const skyRotating = _skyRotStart !== _skyRotTarget;
    if (!skyRotating && skyFrame % 3 !== 0) { requestAnimationFrame(drawSky); return; }
    const dt = 3 / 60;
    const w = skyW, h = skyH;

    if (isNight) {
        skyCtx.fillStyle = '#000000';
        skyCtx.fillRect(0, 0, w, h);

        for (let i = 0; i < 200; i++) {
            const seed = i * 73.137 + skyFrame * 0.01;
            const nx = ((Math.sin(seed * 1.31) * 0.5 + 0.5) * w + Math.random() * 3) % w;
            const ny = ((Math.cos(seed * 0.97) * 0.5 + 0.5) * h + Math.random() * 3) % h;
            const pal = nightPalette[i % nightPalette.length];
            const a = 0.06 + Math.random() * 0.12;
            skyCtx.fillStyle = `rgba(${pal[0]},${pal[1]},${pal[2]},${a})`;
            skyCtx.fillRect(nx, ny, 1, 1);
        }

        skyCtx.textAlign = 'center';
        skyCtx.textBaseline = 'middle';
        skyStars.forEach(s => {
            s.lifeT += dt;
            const lifeFrac = s.lifeT / s.lifeDur;
            let lifeAlpha;
            if (lifeFrac < 0.1) {
                lifeAlpha = lifeFrac / 0.1;
            } else if (lifeFrac < 0.8) {
                lifeAlpha = 1.0;
            } else if (lifeFrac < 1.0) {
                lifeAlpha = 1.0 - (lifeFrac - 0.8) / 0.2;
            } else {
                s.x = Math.random();
                s.y = Math.random();
                s.sym = starSymbols[Math.floor(Math.random() * starSymbols.length)];
                s.palIdx = Math.floor(Math.random() * nightPalette.length);
                s.lifeDur = 4 + Math.random() * 8;
                s.lifeT = 0;
                lifeAlpha = 0;
            }
            const twinkle = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
            const drawAlpha = lifeAlpha * (0.3 + 0.7 * twinkle);
            if (drawAlpha < 0.03) return;
            const [cr, cg, cb] = nightPalette[s.palIdx];
            skyCtx.font = `400 ${s.size}px "IBM Plex Mono", monospace`;
            skyCtx.fillStyle = `rgba(${cr},${cg},${cb},${drawAlpha.toFixed(3)})`;
            const drawX = ((s.x + skyRotationOffset) % 1.0 + 1.0) % 1.0 * w;
            const drawY = ((s.y + skyTiltOffset) % 1.0 + 1.0) % 1.0 * h;
            skyCtx.fillText(s.sym, drawX, drawY);
        });
    } else {
        const tiltPx = skyTiltOffset * h;
        const grad = skyCtx.createLinearGradient(0, -tiltPx, 0, h - tiltPx);
        grad.addColorStop(0, '#5B9BD5');
        grad.addColorStop(0.6, '#87CEEB');
        grad.addColorStop(1, '#B0DEF5');
        skyCtx.fillStyle = grad;
        skyCtx.fillRect(0, 0, w, h);

        clouds.forEach(c => {
            c.x += c.speed * dt;
            if (c.x > 1.3) c.x = -0.3;
            skyCtx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
            const cx = ((c.x + skyRotationOffset) % 1.0 + 1.0) % 1.0 * w;
            const cy = ((c.y + skyTiltOffset) % 1.0 + 1.0) % 1.0 * h;
            for (let b = 0; b < c.blobs; b++) {
                const bx = cx + b * c.size * 0.6;
                const by = cy + Math.sin(b * 1.2) * c.size * 0.2;
                const br = c.size * (0.5 + Math.sin(b * 0.8) * 0.2);
                skyCtx.beginPath();
                skyCtx.arc(bx, by, br, 0, Math.PI * 2);
                skyCtx.fill();
            }
        });
    }

    if (!isSkyView && skyFrame % 6 === 0) renderSerpStrip(t * 0.0003);

    requestAnimationFrame(drawSky);
}
requestAnimationFrame(drawSky);

// --- Click handling: zone detection + direct function calls ---
// Chrome cannot reliably route clicks inside CSS preserve-3d containers.
// Instead of dispatching events into the 3D DOM, we detect which wall zone
// was clicked (left/center/right by X coordinate) and call functions directly.

// --- Direct business-logic functions (no DOM events) ---

function openWordOnWall(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const panel = wall.querySelector('.wall-word-panel');
    if (!panel) return;
    const wordEl = panel.querySelector('.wall-word');
    const frame = panel.querySelector('.wall-text-frame');
    if (!wordEl || !frame) return;
    if (frame.classList.contains('visible')) return;
    if (wordEl.style.display === 'none') return;
    if (wordEl.classList.contains('dissolving')) return;


    wordEl.classList.add('dissolving');
    let revealed = false;
    function revealFrame() {
        if (revealed) return;
        revealed = true;
        wordEl.style.display = 'none';
        frame.classList.add('visible');
        activeTextBody = frame.querySelector('.wall-text-body');
        // Hide archway overlay while text frame is open (it intercepts mousedown for scroll)
        if (archwayOverlay && wallNum === getFacingWall()) archwayOverlay.style.display = 'none';
    }
    wordEl.addEventListener('animationend', revealFrame, { once: true });
    setTimeout(revealFrame, 800);
}

function closeFrameOnWall(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const frame = wall.querySelector('.wall-text-frame.visible');
    if (!frame) return;
    const panel = frame.closest('.wall-word-panel');
    if (!panel) return;
    const wordEl = panel.querySelector('.wall-word');


    frame.classList.remove('visible');
    const body = frame.querySelector('.wall-text-body');
    if (activeTextBody === body) activeTextBody = null;
    if (wordEl) {
        wordEl.style.display = '';
        wordEl.classList.remove('dissolving');
    }
    // Restore archway overlay
    updateArchwayOverlay();
}

// --- Video overlay ---
function openWallVideo(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const videoBtn = wall.querySelector('.wall-video-btn[data-video-src]');
    const src = videoBtn?.dataset?.videoSrc;
    if (!src) return;

    // Close text frame
    closeFrameOnWall(wallNum);

    // Remove any existing overlay on this wall
    const existing = wall.querySelector('.wall-video-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'wall-video-overlay';
    overlay.innerHTML = `
        <button class="wall-video-close" type="button" aria-label="Close video">×</button>
        <div class="wall-video-loader">
            <div class="hourglass"></div>
            <div class="hourglass-label">loading</div>
        </div>
    `;
    wall.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('visible'));
    });

    // Create video element (hidden until loaded)
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.style.display = 'none';
    overlay.appendChild(video);

    // When enough data is buffered, swap loader for video
    video.addEventListener('canplay', () => {
        const loader = overlay.querySelector('.wall-video-loader');
        if (loader) loader.remove();
        video.style.display = '';
        video.play().catch(() => {}); // autoplay may be blocked
    }, { once: true });

    // Close button
    const closeBtn = overlay.querySelector('.wall-video-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeWallVideo(wallNum);
    });
}

function closeWallVideo(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const overlay = wall.querySelector('.wall-video-overlay');
    if (!overlay) return;
    const video = overlay.querySelector('video');
    if (video) { video.pause(); video.src = ''; }
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function scrollWall(wallNum, direction) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const frame = wall.querySelector('.wall-text-frame.visible');
    if (!frame) return;
    const body = frame.querySelector('.wall-text-body');
    if (!body) return;
    body.scrollBy({ top: (direction === 'up' ? -1 : 1) * SCROLL_STEP, behavior: 'smooth' });
}

// --- Zone detection: which wall number is at screen position X? ---
function wallFromScreenX(clientX) {
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return getFacingWall();
    const wr = wallArea.getBoundingClientRect();
    // --wall-w is declared as e.g. "77.7vh" — parseFloat gives 77.7 not pixels.
    // Resolve vh to pixels manually.
    const rawWallW = getComputedStyle(wallArea).getPropertyValue('--wall-w').trim();
    let wallW;
    if (rawWallW.endsWith('vh')) {
        wallW = parseFloat(rawWallW) * window.innerHeight / 100;
    } else {
        wallW = parseFloat(rawWallW) || wr.width * 0.5;
    }
    const centerX = wr.left + wr.width / 2;
    const facingLeft = centerX - wallW * 0.5;
    const facingRight = centerX + wallW * 0.5;

    if (clientX >= facingLeft && clientX <= facingRight) {
        return getFacingWall(); // center = facing wall
    } else if (clientX < facingLeft) {
        return wallAtPosition0(1); // left visible wall
    } else {
        return wallAtPosition0(3); // right visible wall
    }
}

// --- Debug helpers ---
window.__prismW = function () {
    return shrinePos;
};

window.__prismDebug = function () {
    return {
        prismId: _prismId,
        shrinePos,
        facingWall: getFacingWall(),
        currentRotation,
        walls: Object.fromEntries(
            [1,2,3,4,5,6].map(wall => [wall, {
                position0: wallPosition0(wall),
                position: wallPositionDisplay(wall),
                visible: isWallVisible(wall),
                destination: window.PRISM_CONFIG?.destinations?.[wall] || null,
            }])
        ),
    };
};

window.__prismPositionTable = function (w = shrinePos) {
    const rows = [];
    for (let wall = 1; wall <= 6; wall++) {
        rows.push({
            wall,
            position0: wallPosition0(wall, w),
            position: wallPositionDisplay(wall, w),
            isFacing: wall === getFacingWall(w),
        });
    }
    console.table(rows);
    return rows;
};

window.__refreshDebug = function (oldW, newW) {
    return {
        oldW,
        newW,
        artOld: wallPositionDisplay(WALL.ART, oldW),
        artNew: wallPositionDisplay(WALL.ART, newW),
        artRefresh: isRefreshEntryTransition(wallPosition0(WALL.ART, oldW), wallPosition0(WALL.ART, newW)),
        ovsOld: wallPositionDisplay(WALL.OVS, oldW),
        ovsNew: wallPositionDisplay(WALL.OVS, newW),
        ovsRefresh: isRefreshEntryTransition(wallPosition0(WALL.OVS, oldW), wallPosition0(WALL.OVS, newW)),
    };
};

// --- Capture-phase click handler: intercept ALL clicks in wall area ---
// Throttle to 350ms to swallow both clicks of a double-click (Chrome compositor bug
// causes wall hazing when two rapid scrollBy calls fire inside preserve-3d).
let _lastClickTime = 0;
document.addEventListener('click', (e) => {
    if (!e.isTrusted || isRotating || shrineHeavensLocked()) return;
    const _now = Date.now();
    if (_now - _lastClickTime < 350) return;
    _lastClickTime = _now;
    if (e.target.closest('.archway-click-overlay, .nav-arrow, .prism-minimap, .sky-toggle')) return;

    // Cinematic reader is position:fixed on <body> — handle its buttons before wall-area logic
    if (_activeCinematicWall) {
        const reader = document.body.querySelector('.cinematic-reader.visible');
        if (reader) {
            const rr = reader.getBoundingClientRect();
            if (e.clientX >= rr.left && e.clientX <= rr.right &&
                e.clientY >= rr.top  && e.clientY <= rr.bottom) {
                e.stopPropagation();
                e.preventDefault();
                // Check control buttons
                for (const btn of reader.querySelectorAll('.cinematic-btn')) {
                    const br = btn.getBoundingClientRect();
                    if (e.clientX >= br.left - 4 && e.clientX <= br.right + 4 &&
                        e.clientY >= br.top - 4  && e.clientY <= br.bottom + 4) {
                        handleCinematicBtn(btn.dataset.action);
                        return;
                    }
                }
                return; // click inside reader but not on a button — absorb it
            }
            // Click outside reader — close it
            closeCinematicReader();
            return;
        }
    }

    // Search result clicks — elementFromPoint is unreliable inside preserve-3d (Chrome
    // routes clicks to prism-container). Use manual bounding-rect hit-test instead;
    // facing-wall items are square-on to the viewer so their rects are accurate.
    {
        const resultsEl = document.querySelector('.wall-search-results');
        if (resultsEl) {
            for (const el of resultsEl.querySelectorAll('.wall-search-result')) {
                const r = el.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right &&
                    e.clientY >= r.top  && e.clientY <= r.bottom) {
                    const idx = parseInt(el.dataset.matchIndex || '', 10);
                    const item = Number.isFinite(idx) ? shrineSearchResultsSnapshot[idx] : null;
                    if (item) enterShrineHeavens(item);
                    return;
                }
            }
        }
    }

    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const wr = wallArea.getBoundingClientRect();
    if (e.clientX < wr.left || e.clientX > wr.right ||
        e.clientY < wr.top  || e.clientY > wr.bottom) return;

    // Stop Chrome's misrouted event from reaching any 3D element handler
    const wallNum = wallFromScreenX(e.clientX);
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) { e.stopPropagation(); e.preventDefault(); return; }

    // If a text frame is open, check if click is on native scrollbar — let browser handle it
    const _openFrame = wall.querySelector('.wall-text-frame.visible');
    if (_openFrame) {
        const _body = _openFrame.querySelector('.wall-text-body');
        if (_body && _body.scrollHeight > _body.clientHeight) {
            const br = _body.getBoundingClientRect();
            // Scrollbar occupies rightmost pixels; use generous 16px zone
            const scrollZoneLeft = br.right - 16;
            if (e.clientX >= scrollZoneLeft && e.clientX <= br.right &&
                e.clientY >= br.top && e.clientY <= br.bottom) {
                return; // native scrollbar — don't intercept
            }
        }
    }

    e.stopPropagation();
    e.preventDefault();

    // If a video overlay is showing, handle its close button
    const videoOverlay = wall.querySelector('.wall-video-overlay.visible');
    if (videoOverlay) {
        const vClose = videoOverlay.querySelector('.wall-video-close');
        if (vClose) {
            const r = vClose.getBoundingClientRect();
            if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 &&
                e.clientY >= r.top - 8  && e.clientY <= r.bottom + 8) {
                closeWallVideo(wallNum);
                return;
            }
        }
        // Click outside the video closes it
        const video = videoOverlay.querySelector('video');
        if (video) {
            const vr = video.getBoundingClientRect();
            if (e.clientX < vr.left || e.clientX > vr.right ||
                e.clientY < vr.top  || e.clientY > vr.bottom) {
                closeWallVideo(wallNum);
            }
        }
        return;
    }

    const wordEl = wall.querySelector('.wall-word');

    const relY = (e.clientY - wr.top) / wr.height;

    // If a text frame is open on this wall, handle close / scroll / links
    const frame = _openFrame;
    if (frame) {
        // Check close button via bounding-rect (works at all wall angles)
        const closeBtn = frame.querySelector('.wall-close-btn');
        if (closeBtn) {
            const r = closeBtn.getBoundingClientRect();
            // Generous hit zone: expand by 8px each side for angled walls
            if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 &&
                e.clientY >= r.top - 8  && e.clientY <= r.bottom + 8) {
                closeFrameOnWall(wallNum);
                return;
            }
        }
        // Check scroll buttons via bounding-rect
        // Guard: if mousedown already started continuous scroll, skip — click is the tail of that hold
        if (!_scrollBtnHeld) {
            const scrollUp = frame.querySelector('.wall-scroll-up');
            const scrollDown = frame.querySelector('.wall-scroll-down');
            if (scrollUp) {
                const r = scrollUp.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    scrollWall(wallNum, 'up');
                    return;
                }
            }
            if (scrollDown) {
                const r = scrollDown.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    scrollWall(wallNum, 'down');
                    return;
                }
            }
        }
        // Check video buttons via bounding-rect (there may be one at top and one at bottom)
        const videoBtns = frame.querySelectorAll('.wall-video-btn:not(.wall-video-disabled)');
        for (const videoBtn of videoBtns) {
            const r = videoBtn.getBoundingClientRect();
            if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                openWallVideo(wallNum);
                return;
            }
        }
        // Check if click landed on a hyperlink — open in new tab
        const body = frame.querySelector('.wall-text-body');
        if (body) {
            const links = body.querySelectorAll('a[href]');
            for (const a of links) {
                const r = a.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right &&
                    e.clientY >= r.top  && e.clientY <= r.bottom) {
                    window.open(a.href, '_blank', 'noopener');
                    return;
                }
            }
        }
        // Click outside the frame closes it
        const fr = frame.getBoundingClientRect();
        const insideFrame = e.clientX >= fr.left && e.clientX <= fr.right &&
                            e.clientY >= fr.top  && e.clientY <= fr.bottom;
        if (!insideFrame) {
            closeFrameOnWall(wallNum);
        }
        return;
    }

    // Cinematic reader open — handle its buttons, or click outside to close
    if (_activeCinematicWall === wallNum) {
        const reader = wall.querySelector('.cinematic-reader.visible');
        if (reader) {
            // Check cinematic control buttons
            for (const btn of reader.querySelectorAll('.cinematic-btn')) {
                const r = btn.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    handleCinematicBtn(btn.dataset.action);
                    return;
                }
            }
            // Click outside reader closes it
            const rr = reader.getBoundingClientRect();
            if (e.clientX < rr.left || e.clientX > rr.right ||
                e.clientY < rr.top  || e.clientY > rr.bottom) {
                closeCinematicReader();
            }
            return;
        }
    }

    // Aleph orb click → open cinematic reader (art gallery)
    if (window.PRISM_CONFIG?.isArtGallery) {
        const orb = wall.querySelector('.aleph-orb');
        if (orb && orb.style.display !== 'none') {
            const r = orb.getBoundingClientRect();
            if (e.clientX >= r.left - 6 && e.clientX <= r.right + 6 &&
                e.clientY >= r.top - 6  && e.clientY <= r.bottom + 6) {
                openCinematicReader(wallNum);
                return;
            }
        }
    }

    // No text frame open on this wall — try to open word.
    if (wordEl && wordEl.style.display !== 'none' && !wordEl.classList.contains('dissolving')) {
        openWordOnWall(wallNum);
        return;
    }

    // Heavens tilt — click the image on a wall with heavensTilt config (facing wall only)
    if (_heavensTiltWalls[wallNum] && wallNum === getFacingWall()) {
        const img = wall.querySelector('.wall-panel-img');
        if (img) {
            const ir = img.getBoundingClientRect();
            if (e.clientX >= ir.left && e.clientX <= ir.right &&
                e.clientY >= ir.top  && e.clientY <= ir.bottom) {
                enterHeavensTilt(wallNum);
                return;
            }
        }
    }

    // Shrine candles (main chamber)
    const candles = wall.querySelectorAll('.shrine-candle:not(.lit)');
    if (candles.length) {
        let closest = null, minDist = Infinity;
        candles.forEach(c => {
            const r = c.getBoundingClientRect();
            const d = Math.hypot(e.clientX - (r.left + r.right) / 2, e.clientY - (r.top + r.bottom) / 2);
            if (d < minDist) { minDist = d; closest = c; }
        });
        if (closest && minDist < 50) {
            closest.classList.add('lit');
            if (closest.dataset.testChain) {
                triggerShrineChainTestCandle();
            } else {
                triggerShrineTransmissionFromCandle();
            }
            return;
        }
    }

    // Search input
    const input = wall.querySelector('.wall-search-input');
    if (input) input.focus();
}, true); // capture phase

// --- Continuous scroll: mousedown starts, mouseup/mouseleave stops ---
document.addEventListener('mousedown', (e) => {
    if (!e.isTrusted || isRotating || shrineHeavensLocked()) return;
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const wr = wallArea.getBoundingClientRect();
    if (e.clientX < wr.left || e.clientX > wr.right ||
        e.clientY < wr.top  || e.clientY > wr.bottom) return;
    const wallNum = wallFromScreenX(e.clientX);
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    // Cinematic reader hold-to-speed for left/right buttons
    if (_activeCinematicWall === wallNum) {
        const reader = wall.querySelector('.cinematic-reader.visible');
        if (reader) {
            for (const btn of reader.querySelectorAll('.cinematic-btn')) {
                const action = btn.dataset.action;
                if (action !== 'left' && action !== 'right') continue;
                const r = btn.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    startCinematicHold(action);
                    e.preventDefault();
                    return;
                }
            }
        }
    }
    const frame = wall.querySelector('.wall-text-frame.visible');
    if (!frame) return;
    const body = frame.querySelector('.wall-text-body');
    if (!body) return;
    // Custom scrollbar drag (16px zone at right edge of text body)
    if (body.scrollHeight > body.clientHeight) {
        const _br = body.getBoundingClientRect();
        if (e.clientX >= _br.right - 16 && e.clientX <= _br.right &&
            e.clientY >= _br.top && e.clientY <= _br.bottom) {
            startScrollbarDrag(body, e.clientY);
            e.preventDefault();
            return;
        }
    }
    // Check scroll buttons via bounding-rect (Chrome won't route events to 3D children)
    const scrollUp = frame.querySelector('.wall-scroll-up');
    const scrollDown = frame.querySelector('.wall-scroll-down');
    if (scrollUp) {
        const r = scrollUp.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) {
            _scrollBtnHeld = true;
            startContinuousScroll(body, -1);
            return;
        }
    }
    if (scrollDown) {
        const r = scrollDown.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) {
            _scrollBtnHeld = true;
            startContinuousScroll(body, 1);
            return;
        }
    }
    // Skip if click is on the scrollbar track (rightmost ~12px of the body area)
    const bodyRect = body.getBoundingClientRect();
    if (e.clientX >= bodyRect.right - 12) return;
});
document.addEventListener('mouseup', () => {
    stopContinuousScroll();
    stopCinematicHold();
    // Reset _scrollBtnHeld after click fires (click always follows mouseup in the same queue)
    setTimeout(() => { _scrollBtnHeld = false; }, 0);
});
document.addEventListener('mouseleave', () => { stopContinuousScroll(); stopCinematicHold(); _scrollBtnHeld = false; });

// --- Wheel / trackpad scrolling for text frames + heavens overlay ---
let _wheelAccum = 0;
let _wheelRAF = null;
let _wheelTarget = null;
document.addEventListener('wheel', (e) => {
    // Heavens overlay scroll
    if (isShrineHeavensMode && shrineHeavensUI?.body) {
        _wheelAccum += e.deltaY;
        _wheelTarget = shrineHeavensUI.body;
        if (!_wheelRAF) {
            _wheelRAF = requestAnimationFrame(() => {
                if (_wheelTarget) _wheelTarget.scrollBy({ top: _wheelAccum, behavior: 'instant' });
                _wheelAccum = 0;
                _wheelRAF = null;
                _wheelTarget = null;
            });
        }
        e.preventDefault();
        return;
    }
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const wr = wallArea.getBoundingClientRect();
    if (e.clientX < wr.left || e.clientX > wr.right ||
        e.clientY < wr.top  || e.clientY > wr.bottom) return;
    const wallNum = wallFromScreenX(e.clientX);
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const frame = wall.querySelector('.wall-text-frame.visible');
    if (!frame) return;
    const body = frame.querySelector('.wall-text-body');
    if (!body) return;
    _wheelAccum += e.deltaY;
    _wheelTarget = body;
    if (!_wheelRAF) {
        _wheelRAF = requestAnimationFrame(() => {
            if (_wheelTarget) _wheelTarget.scrollBy({ top: _wheelAccum, behavior: 'instant' });
            _wheelAccum = 0;
            _wheelRAF = null;
            _wheelTarget = null;
        });
    }
    e.preventDefault();
}, { passive: false });

// --- Word panel: click word → shimmer/dissolve → reveal scrollable text frame ---
// These handlers exist as FALLBACK for browsers where capture-phase interception
// doesn't fire (e.g. Firefox, which handles 3D hit-testing correctly).
document.querySelectorAll('.wall-word').forEach(wordEl => {
    wordEl.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        const wallPanel = wordEl.closest('.wall-panel');
        if (wallPanel) {
            const wallNum = parseInt(wallPanel.dataset.wall, 10);
            if (!isWallVisible(wallNum)) return;
            openWordOnWall(parseInt(wallPanel.dataset.wall));
        }
    });
});

document.querySelectorAll('.wall-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        const wallPanel = btn.closest('.wall-panel');
        if (wallPanel) {
            const wallNum = parseInt(wallPanel.dataset.wall, 10);
            if (!isWallVisible(wallNum)) return;
            closeFrameOnWall(parseInt(wallPanel.dataset.wall));
        }
    });
});

document.querySelectorAll('.wall-text-frame').forEach(frame => {
    const upBtn = frame.querySelector('.wall-scroll-up');
    const downBtn = frame.querySelector('.wall-scroll-down');
    const wallPanel = frame.closest('.wall-panel');
    const wn = wallPanel ? parseInt(wallPanel.dataset.wall) : 0;
    if (upBtn) upBtn.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        if (!isWallVisible(wn)) return;
        if (_scrollBtnHeld) return;
        scrollWall(wn, 'up');
    });
    if (downBtn) downBtn.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        if (!isWallVisible(wn)) return;
        if (_scrollBtnHeld) return;
        scrollWall(wn, 'down');
    });
});

// --- Random image / strapline / poetry walls: initialise ambient content ---
for (let wall = 1; wall <= 6; wall++) {
    refreshRandomImage(wall);
    refreshStrapline(wall);
}

// Poetry passages need async fetch — load then populate
if (window.PRISM_CONFIG?.poetryWalls && Object.keys(window.PRISM_CONFIG.poetryWalls).length > 0) {
    loadPoetryPassages().then(() => {
        for (let wall = 1; wall <= 6; wall++) {
            refreshPoetryPassage(wall);
        }
    });
}

// --- Aleph Orb + Cinematic Reader (Art Gallery only) ---
let _activeCinematicWall = 0;  // wall number with open cinematic reader, 0 = none
let _cinematicScrollId = 0;    // rAF id for auto-scroll
let _cinematicSpeed = 0.4;     // px per frame (positive = upward scroll)
let _cinematicScrollY = 0;     // current translateY offset (negative = scrolled up)
let _cinematicPaused = false;
let _cinematicFontSize = 2.6;  // vh
const ALEPH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩאבגדהוזחטיכלמנסעפצקרשת';
const ALEPH_FONTS = ['Georgia', 'Garamond', 'Palatino', 'Times New Roman', 'Cormorant Garamond'];

function updateAlephChars() {
    if (!window.PRISM_CONFIG?.isArtGallery) return;
    const facingWall = getFacingWall();
    document.querySelectorAll('.aleph-char').forEach(el => {
        const wallNum = parseInt(el.closest('.wall-panel')?.dataset.wall, 10);
        if (wallNum === facingWall) {
            // Facing orb: show morphing character
            const ch = ALEPH_CHARS[Math.floor(Math.random() * ALEPH_CHARS.length)];
            const font = ALEPH_FONTS[Math.floor(Math.random() * ALEPH_FONTS.length)];
            const size = (1.8 + Math.random() * 1.4).toFixed(1);
            el.textContent = ch;
            el.style.fontFamily = `'${font}', serif`;
            el.style.fontSize = size + 'vh';
            el.style.opacity = '';
        } else {
            // Side orbs: just glow, no character
            el.textContent = '';
        }
    });
}

function initAlephOrbs() {
    if (!window.PRISM_CONFIG?.isArtGallery) return;
    // Orbs and cinematic readers are now in the Astro template.
    // Just start the character pulse animation.
    // Character pulse only on the facing wall's orb
    updateAlephChars();
    setInterval(updateAlephChars, 600);

    // Wire up cinematic control buttons (delegated click on each reader's controls)
    document.querySelectorAll('.cinematic-controls').forEach(controls => {
        controls.addEventListener('click', (e) => {
            const btn = e.target.closest('.cinematic-btn');
            if (!btn) return;
            e.stopPropagation();
            handleCinematicBtn(btn.dataset.action);
        });
    });

    // Hold-to-speed for left/right buttons
    document.querySelectorAll('.cinematic-btn[data-action="left"], .cinematic-btn[data-action="right"]').forEach(btn => {
        btn.addEventListener('mousedown', () => startCinematicHold(btn.dataset.action));
        btn.addEventListener('mouseup', stopCinematicHold);
        btn.addEventListener('mouseleave', stopCinematicHold);
    });
}

function getImageKeyFromSrc(src) {
    // /images/image_016a.jpeg → "016a"
    const m = src.match(/image_([^.]+)\./);
    return m ? m[1] : null;
}

function markdownToHtml(text) {
    // Convert *text* to <em>text</em>, split paragraphs
    return text
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .split(/\n\n+/)
        .map(p => `<p>${p.trim()}</p>`)
        .join('');
}

function openCinematicReader(wallNum) {
    if (_activeCinematicWall) closeCinematicReader();
    const panel = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!panel) return;
    const reader = panel.querySelector('.cinematic-reader');
    const img = panel.querySelector('.wall-random-img');
    if (!reader || !img) return;

    // Get captions for this image
    const key = getImageKeyFromSrc(img.src);
    const captions = key && window.IMAGE_CAPTIONS ? window.IMAGE_CAPTIONS[key] : null;
    if (!captions || !captions.length) return;

    // Pick a random caption
    const caption = captions[Math.floor(Math.random() * captions.length)];
    const textEl = reader.querySelector('.cinematic-text');
    textEl.innerHTML = markdownToHtml(caption);

    // Reset state
    _cinematicFontSize = 2.6;
    _cinematicSpeed = 0.4;
    _cinematicPaused = false;
    textEl.style.fontSize = _cinematicFontSize + 'vh';

    // Hide orb, move reader to body (escapes 3D transform context), show it
    const orb = panel.querySelector('.aleph-orb');
    if (orb) orb.style.display = 'none';
    document.body.appendChild(reader);
    reader.classList.add('visible');
    _activeCinematicWall = wallNum;

    // Start auto-scroll — first line visible at bottom, scrolls up (Star Wars)
    // Offset so first line sits at bottom of visible area (reader height minus control bar ~4vh)
    const scrollArea = reader.querySelector('.cinematic-scroll');
    const areaH = scrollArea ? scrollArea.offsetHeight : reader.offsetHeight;
    _cinematicScrollY = areaH * 0.85;
    textEl.style.transform = `rotateX(35deg) translateY(${_cinematicScrollY}px)`;
    startCinematicScroll(textEl);
}

function closeCinematicReader() {
    if (!_activeCinematicWall) return;
    const wallNum = _activeCinematicWall;
    _activeCinematicWall = 0;
    cancelAnimationFrame(_cinematicScrollId);
    const panel = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    const reader = document.body.querySelector('.cinematic-reader.visible');
    if (!reader) return;

    // Melt/shimmer dissolve effect
    reader.style.transition = 'opacity 0.6s ease, filter 0.6s ease, transform 0.6s ease';
    reader.style.filter = 'blur(6px) brightness(1.8)';
    reader.style.transform = 'translateX(-50%) scaleY(0.92)';
    reader.style.opacity = '0';

    setTimeout(() => {
        reader.classList.remove('visible');
        reader.style.transition = '';
        reader.style.filter = '';
        reader.style.transform = '';
        reader.style.opacity = '';
        if (panel) panel.appendChild(reader);
        if (panel) {
            const orb = panel.querySelector('.aleph-orb');
            if (orb) orb.style.display = '';
        }
    }, 650);
}

function startCinematicScroll(textEl) {
    cancelAnimationFrame(_cinematicScrollId);
    function tick() {
        if (_activeCinematicWall && !_cinematicPaused) {
            _cinematicScrollY -= _cinematicSpeed;
            // Wrap: if scrolled past the full text height, loop back to bottom
            const totalH = textEl.scrollHeight;
            const reader = textEl.closest('.cinematic-reader');
            const viewH = reader ? reader.offsetHeight : 300;
            if (_cinematicScrollY < -(totalH * 1.05)) _cinematicScrollY = viewH * 0.85;
            textEl.style.transform = `rotateX(35deg) translateY(${_cinematicScrollY}px)`;
        }
        _cinematicScrollId = requestAnimationFrame(tick);
    }
    _cinematicScrollId = requestAnimationFrame(tick);
}

function handleCinematicBtn(action) {
    const reader = document.querySelector('.cinematic-reader.visible');
    if (!reader) return;
    const textEl = reader.querySelector('.cinematic-text');

    switch (action) {
        case 'minus':
            _cinematicFontSize = Math.max(1.0, _cinematicFontSize - 0.2);
            textEl.style.fontSize = _cinematicFontSize + 'vh';
            break;
        case 'plus':
            _cinematicFontSize = Math.min(3.5, _cinematicFontSize + 0.2);
            textEl.style.fontSize = _cinematicFontSize + 'vh';
            break;
        case 'pause':
            _cinematicPaused = !_cinematicPaused;
            break;
        case 'left':
            _cinematicSpeed = -Math.abs(_cinematicSpeed || 0.4);
            _cinematicPaused = false;
            break;
        case 'right':
            _cinematicSpeed = Math.abs(_cinematicSpeed || 0.4);
            _cinematicPaused = false;
            break;
        case 'eject':
            closeCinematicReader();
            break;
    }
}

// Hold-to-speed-up for left/right buttons
let _cinematicHoldTimer = 0;
let _cinematicHoldAction = '';
function startCinematicHold(action) {
    _cinematicHoldAction = action;
    const baseSpeed = 0.4;
    let multiplier = 1;
    clearInterval(_cinematicHoldTimer);
    _cinematicHoldTimer = setInterval(() => {
        multiplier = Math.min(5, multiplier + 0.3);
        if (action === 'left') _cinematicSpeed = -baseSpeed * multiplier;
        if (action === 'right') _cinematicSpeed = baseSpeed * multiplier;
    }, 200);
}
function stopCinematicHold() {
    clearInterval(_cinematicHoldTimer);
    if (_cinematicHoldAction === 'left') _cinematicSpeed = -0.4;
    if (_cinematicHoldAction === 'right') _cinematicSpeed = 0.4;
    _cinematicHoldAction = '';
}

initAlephOrbs();

// Document-level delegation for cinematic buttons (reader is on <body>, outside wall-area)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cinematic-btn');
    if (!btn || !_activeCinematicWall) return;
    e.stopPropagation();
    handleCinematicBtn(btn.dataset.action);
});
document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.cinematic-btn[data-action="left"], .cinematic-btn[data-action="right"]');
    if (btn && _activeCinematicWall) startCinematicHold(btn.dataset.action);
});
document.addEventListener('mouseup', () => { if (_cinematicHoldAction) stopCinematicHold(); });

// --- Generative Ambient Drone Audio ---
// Each chamber has:
//   • A harmonic BED (layered oscillators + filter + amplitude/filter LFOs).
//   • A TEXTURE layer (filtered noise + scheduled one-shot events) that gives
//     the chamber its distinctive material — fabric, tape, stone, paper, glass.
// The texture bus is parallel to the bed: it joins at the fade node so it
// doesn't breathe with the bed's amplitude LFO, leaving the chamber's
// material constant while the harmony slowly inhales/exhales.

// === Texture synthesis helpers (module-level, take audioCtx) ====================

function _createNoiseBuffer(ctx, dur, color) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === 'pink') {
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886*b0 + w*0.0555179;
            b1 = 0.99332*b1 + w*0.0750759;
            b2 = 0.96900*b2 + w*0.1538520;
            b3 = 0.86650*b3 + w*0.3104856;
            b4 = 0.55000*b4 + w*0.5329522;
            b5 = -0.7616*b5 - w*0.0168980;
            data[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    } else {
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return buf;
}

// Procedural impulse response: decaying noise burst — fills the "room tail" role.
function _createImpulseResponse(ctx, dur, decay) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

// Long-running noise layer (e.g. breath, hiss, solar wind). Returns nodes for cleanup.
function _createNoiseLayer(ctx, parent, opts) {
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, opts.bufferDur || 8, opts.color || 'pink');
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter.type;
    filter.frequency.value = opts.filter.freq;
    filter.Q.value = opts.filter.Q || 1;
    const g = ctx.createGain();
    g.gain.value = opts.gain;
    src.connect(filter); filter.connect(g); g.connect(parent);
    src.start();
    const stoppables = [src];
    // Optional amplitude LFO (the breath effect)
    if (opts.ampLfo) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = opts.ampLfo.rate;
        const lg = ctx.createGain();
        lg.gain.value = opts.ampLfo.depth;
        lfo.connect(lg); lg.connect(g.gain);
        lfo.start();
        stoppables.push(lfo);
    }
    // Optional filter wow (tape machine, solar wind)
    if (opts.filterLfo) {
        const wow = ctx.createOscillator();
        wow.frequency.value = opts.filterLfo.rate;
        const wg = ctx.createGain();
        wg.gain.value = opts.filterLfo.depth;
        wow.connect(wg); wg.connect(filter.frequency);
        wow.start();
        stoppables.push(wow);
    }
    return stoppables;
}

// === One-shot synth functions ===================================================
// Each schedules its own oscillators/sources, sets envelope, calls stop() — no
// long-lived nodes returned. Always silent at attack so they don't click.

// Soft bell — long swell-in, no transient. Used by Central chamber.
function _synthBell(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.45);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    env.connect(parent);
    // Inharmonic bell partials
    const partials = spec.partials || [
        { r: 1.0,   a: 1.0  },
        { r: 2.756, a: 0.45 },
        { r: 5.404, a: 0.20 },
    ];
    partials.forEach(p => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = spec.freq * p.r;
        const g = ctx.createGain();
        g.gain.value = p.a;
        o.connect(g); g.connect(env);
        o.start(now); o.stop(now + dur + 0.2);
    });
}

// Bowl shimmer — UPPER PARTIALS ONLY (no fundamental). OVS Chapel.
function _synthBowlShimmer(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 4.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    env.connect(parent);
    // Inharmonic partials only — no fundamental
    [2.756, 5.404, 8.933, 13.34].forEach((r, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = spec.freq * r;
        const g = ctx.createGain();
        g.gain.value = 0.7 * Math.pow(0.6, i);
        o.connect(g); g.connect(env);
        o.start(now); o.stop(now + dur + 0.2);
    });
}

// Clock-like tick — short bandpassed noise burst. Research Lab.
function _synthTick(ctx, parent, spec) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, 0.06, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = (spec.freq || 3200) + (Math.random() - 0.5) * 600;
    f.Q.value = 12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(spec.gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + 0.08);
}

// Geiger pop burst — 3-5 rapid clicks at random intervals. Research Lab.
function _synthGeigerBurst(ctx, parent, spec) {
    const now = ctx.currentTime;
    const count = 3 + Math.floor(Math.random() * 3);
    let t = 0;
    for (let i = 0; i < count; i++) {
        const when = now + t;
        const src = ctx.createBufferSource();
        src.buffer = _createNoiseBuffer(ctx, 0.025, 'white');
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 1800; f.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(spec.gain * (0.6 + Math.random() * 0.4), when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.025);
        src.connect(f); f.connect(g); g.connect(parent);
        src.start(when); src.stop(when + 0.04);
        t += 0.05 + Math.random() * 0.18;
    }
}

// Low wood-on-stone knock — short low-mid filtered impulse. OVS Chapel / Art Gallery.
function _synthKnock(ctx, parent, spec) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, 0.18, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = spec.freq || 120;
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + 0.2);
}

// Damped footstep — Art Gallery. Slightly stereo-randomised via a tiny panner.
function _synthFootstep(ctx, parent, spec) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, 0.14, 'pink');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 350; f.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.8;
    src.connect(f); f.connect(g); g.connect(pan); pan.connect(parent);
    src.start(now); src.stop(now + 0.16);
}

// Brief crowd murmur — very faint low filtered noise, slow swell. Art Gallery.
function _synthCrowdMurmur(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 4;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, dur + 0.5, 'pink');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + dur + 0.1);
}

// Page turn — gentle filtered noise sweep, brief crescendo. Scriptorium.
function _synthPageTurn(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 1.4;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, dur + 0.3, 'pink');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.0;
    f.frequency.setValueAtTime(800, now);
    f.frequency.exponentialRampToValueAtTime(3200, now + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(900, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + dur + 0.1);
}

// Tiny scratch — used by the paper-bed scheduler. Scriptorium.
function _synthPaperScratch(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = 0.025 + Math.random() * 0.05;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, dur + 0.05, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3500 + Math.random() * 2500;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(spec.gain * (0.4 + Math.random() * 0.6), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + dur + 0.05);
}

// Upper-register glissando glimmer — falling-star quality. Mythopoeic Archive.
function _synthGlimmer(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 2.2;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const fStart = 1800 + Math.random() * 1400;
    const fEnd   = fStart * (0.55 + Math.random() * 0.25);
    o.frequency.setValueAtTime(fStart, now);
    o.frequency.exponentialRampToValueAtTime(fEnd, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(parent);
    o.start(now); o.stop(now + dur + 0.1);
}

// Sub-rumble — almost below hearing. Mythopoeic Archive.
function _synthRumble(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 6;
    const src = ctx.createBufferSource();
    src.buffer = _createNoiseBuffer(ctx, dur + 0.5, 'pink');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 60; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(spec.gain, now + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(parent);
    src.start(now); src.stop(now + dur + 0.1);
}

// Droplet — warm soft chime: slow swell-in (no transient), long round decay,
// gentle tremolo for the "rippling pool" quality. Pitch is picked randomly
// from a chamber-provided palette so successive droplets feel varied.
function _synthDroplet(ctx, parent, spec) {
    const now = ctx.currentTime;
    const dur = spec.dur || 5.5;
    const freqs = spec.freqs || [440];
    const freq = freqs[Math.floor(Math.random() * freqs.length)];

    // Warmth filter — keeps the sound rounded, no treble bite.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 2.8;
    lp.Q.value = 0.4;

    // Tremolo bus — multiplicative gentle wobble (the "ripples").
    const tremGain = ctx.createGain();
    tremGain.gain.value = 1.0;
    const trem = ctx.createOscillator();
    trem.type = 'sine';
    trem.frequency.value = 2.2 + Math.random() * 1.6;   // 2.2–3.8 Hz
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.18;                         // ±18% wobble
    trem.connect(tremDepth);
    tremDepth.connect(tremGain.gain);
    trem.start(now); trem.stop(now + dur + 0.2);

    // Main envelope — slow swell (no transient), very long decay.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(spec.gain, now + 0.40);   // 400 ms swell-in
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    lp.connect(tremGain);
    tremGain.connect(env);
    env.connect(parent);

    // Just three sine partials — fundamental + slight chorus + gentle 2nd harmonic.
    const partials = [
        { r: 1.0,    a: 1.0  },
        { r: 1.004,  a: 0.7  },   // chorus detune for "round" feel
        { r: 2.0,    a: 0.14 },   // soft 2nd harmonic
    ];
    partials.forEach(p => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * p.r;
        const g = ctx.createGain();
        g.gain.value = p.a;
        o.connect(g); g.connect(lp);
        o.start(now); o.stop(now + dur + 0.2);
    });
}

const _SYNTH_FNS = {
    bell:         _synthBell,
    bowlShimmer:  _synthBowlShimmer,
    tick:         _synthTick,
    geigerBurst:  _synthGeigerBurst,
    knock:        _synthKnock,
    footstep:     _synthFootstep,
    crowdMurmur:  _synthCrowdMurmur,
    pageTurn:     _synthPageTurn,
    paperScratch: _synthPaperScratch,
    glimmer:      _synthGlimmer,
    rumble:       _synthRumble,
    droplet:      _synthDroplet,
};

// Schedules a single one-shot recipe to fire at random intervals.
// Pushes its timer ID into the timers array on every reschedule for cleanup.
function _scheduleOneShot(ctx, parent, spec, timers) {
    function fire() {
        const fn = _SYNTH_FNS[spec.kind];
        if (fn) {
            try { fn(ctx, parent, spec); } catch (e) { /* swallow if context closed */ }
        }
        const dt = spec.intervalMin + Math.random() * (spec.intervalMax - spec.intervalMin);
        timers.push(setTimeout(fire, dt * 1000));
    }
    // First fire after random initial delay (0.4x → 1.0x of the min interval)
    const initial = spec.intervalMin * (0.4 + Math.random() * 0.6);
    timers.push(setTimeout(fire, initial * 1000));
}

// === Chamber recipes ============================================================
const CHAMBER_DRONES = {
    'main': {
        // VESPERS — temple at end of service. Bed + slow linen breath + soft bell.
        layers: [
            { type: 'sine',     freq: 55,    gain: 0.18 },   // A1 fundamental
            { type: 'sine',     freq: 82.5,  gain: 0.10 },   // E2 (perfect 5th)
            { type: 'triangle', freq: 110,   gain: 0.06 },   // A2 octave
            { type: 'sine',     freq: 165,   gain: 0.03 },   // E3 shimmer
        ],
        filter: { type: 'lowpass', freq: 400, Q: 1.2 },
        lfo: { rate: 0.07, depth: 0.35 },
        filterLfo: { rate: 0.04, depth: 150 },
        texture: {
            noise: {
                color: 'pink', gain: 0.022,
                filter: { type: 'bandpass', freq: 700, Q: 0.6 },
                ampLfo: { rate: 0.033, depth: 0.018 },       // ~30 s breath
            },
            oneShots: [
                { kind: 'bell', freq: 220, dur: 8.5, gain: 0.020,
                  intervalMin: 40, intervalMax: 90 },
                { kind: 'droplet', gain: 0.030,
                  freqs: [440, 659.3, 880],                   // A4, E5, A5
                  intervalMin: 50, intervalMax: 110 },
            ],
        },
    },
    'research-lab': {
        // COLDROOM — midnight server room / telegraph office. Steady electrical hum
        // underneath, thin distant hiss, irregular relay clicks. No periodic sweep.
        layers: [
            // Faint mains hum (60 Hz + 1st harmonic) sits under everything
            { type: 'sine',     freq: 60,    gain: 0.045 },
            { type: 'sine',     freq: 120,   gain: 0.020 },
            // Original detuned D2 pair (the beating)
            { type: 'sine',     freq: 73.4,  gain: 0.10 },
            { type: 'sine',     freq: 73.8,  gain: 0.10 },
            { type: 'triangle', freq: 146.8, gain: 0.05 },
            { type: 'sine',     freq: 220,   gain: 0.035 },
            { type: 'sawtooth', freq: 293.6, gain: 0.010 },
        ],
        filter: { type: 'bandpass', freq: 600, Q: 1.4 },     // was Q 2.5 — less resonant drone
        lfo: { rate: 0.12, depth: 0.3 },
        filterLfo: { rate: 0.08, depth: 200 },
        texture: {
            noise: {
                color: 'white', gain: 0.010,                 // halved
                filter: { type: 'lowpass', freq: 3200, Q: 0.5 },  // less hissy, more "appliance"
                // wow rate slowed dramatically (was 0.18 = 5.5 s wave period)
                filterLfo: { rate: 0.035, depth: 500 },
            },
            oneShots: [
                { kind: 'tick', freq: 2400, gain: 0.040,     // lower-pitched, more switch-like
                  intervalMin: 18, intervalMax: 38 },
                { kind: 'geigerBurst', gain: 0.012,          // rarer + quieter
                  intervalMin: 120, intervalMax: 300 },
            ],
        },
    },
    'art-gallery': {
        // SHUTOV — slow harmonic drift, no objects. C-major chord-cloud built from
        // sustained sines with per-layer ampLfos at incommensurate rates, so the
        // chord never quite repeats. No footsteps, no events.
        layers: [
            // Lower foundation (original detuned C2 + C3 + G3)
            { type: 'sine',     freq: 65.4,  gain: 0.13 },   // C2
            { type: 'sine',     freq: 65.7,  gain: 0.13 },   // C2 detuned (slow beating)
            { type: 'triangle', freq: 130.8, gain: 0.06 },   // C3
            { type: 'sine',     freq: 196,   gain: 0.04 },   // G3 (fifth)
            // Drifting upper-register voices — each fades in/out on its own clock
            { type: 'sine',     freq: 261.6, gain: 0.030,
              ampLfo: { rate: 0.018, depth: 0.022 } },       // C4
            { type: 'sine',     freq: 329.6, gain: 0.024,
              ampLfo: { rate: 0.013, depth: 0.020 } },       // E4
            { type: 'sine',     freq: 392.0, gain: 0.020,
              ampLfo: { rate: 0.011, depth: 0.018 } },       // G4
            { type: 'sine',     freq: 523.2, gain: 0.014,
              ampLfo: { rate: 0.008, depth: 0.012 } },       // C5 (slowest)
        ],
        filter: { type: 'lowpass', freq: 900, Q: 0.7 },      // opened up — let highs through
        lfo: { rate: 0.06, depth: 0.25 },
        filterLfo: { rate: 0.035, depth: 200 },
        texture: {
            // Single droplet as the only event — preserves the Shutov stillness.
            oneShots: [
                { kind: 'droplet', gain: 0.024,
                  freqs: [523.3, 659.3, 784.0],               // C5, E5, G5
                  intervalMin: 80, intervalMax: 160 },
            ],
        },
    },
    'gpt3-library': {
        // VELLUM — scriptorium at night. Deep bed + continuous paper bed + page turns.
        layers: [
            { type: 'sine',     freq: 36.7,  gain: 0.22 },
            { type: 'sine',     freq: 55,    gain: 0.13 },
            { type: 'triangle', freq: 73.4,  gain: 0.07 },
            { type: 'sine',     freq: 110,   gain: 0.040 },
        ],
        filter: { type: 'lowpass', freq: 380, Q: 1.4 },      // was 280 — let a bit more through
        lfo: { rate: 0.03, depth: 0.4 },
        filterLfo: { rate: 0.02, depth: 100 },
        texture: {
            oneShots: [
                // Rare page turn
                { kind: 'pageTurn', dur: 1.6, gain: 0.065,
                  intervalMin: 90, intervalMax: 180 },
                // Soft droplets drawn from the D fundamental
                { kind: 'droplet', gain: 0.030,
                  freqs: [440, 587.3, 880],                   // A4, D5, A5
                  intervalMin: 40, intervalMax: 95 },
            ],
        },
    },
    'ovs-chapel': {
        // CENSER — empty chapel after the rite. Bed + stone breath + bowl shimmer.
        layers: [
            { type: 'sine',     freq: 61.7,  gain: 0.15 },   // Bb1
            { type: 'sine',     freq: 92.5,  gain: 0.10 },   // F#2 (tritone)
            { type: 'triangle', freq: 123.5, gain: 0.07 },   // B2
            { type: 'sine',     freq: 185,   gain: 0.04 },   // F#3
            { type: 'sawtooth', freq: 247,   gain: 0.012 },  // B3 grit
            // Incense drift — chorused detuned harmonic, slow swell
            { type: 'sine',     freq: 246.4, gain: 0.018,
              ampLfo: { rate: 0.022, depth: 0.014 } },
            { type: 'sine',     freq: 247.6, gain: 0.018,
              ampLfo: { rate: 0.026, depth: 0.014 } },
        ],
        filter: { type: 'lowpass', freq: 450, Q: 1.8 },
        lfo: { rate: 0.05, depth: 0.3 },
        filterLfo: { rate: 0.045, depth: 180 },
        texture: {
            noise: {
                color: 'pink', gain: 0.024,
                filter: { type: 'bandpass', freq: 220, Q: 0.6 },
                ampLfo: { rate: 0.041, depth: 0.012 },       // stone-space breath
            },
            oneShots: [
                { kind: 'bowlShimmer', freq: 138.6, dur: 5.5, gain: 0.030,
                  intervalMin: 60, intervalMax: 120 },
                { kind: 'knock', freq: 105, gain: 0.05,
                  intervalMin: 180, intervalMax: 360 },
                { kind: 'droplet', gain: 0.026,
                  freqs: [466.2, 698.5, 932.3],               // Bb4, F5, Bb5
                  intervalMin: 70, intervalMax: 140 },
            ],
        },
    },
    'mythopoeic-archive': {
        // AETHER — cooler/airier sibling of art-gallery. E-major chord-cloud in
        // higher register, no rumble, no whispers. One very rare glimmer is
        // permitted as the chamber's only "event".
        layers: [
            // Anchored low end
            { type: 'sine',     freq: 41.2,  gain: 0.14 },   // E1 sub-bass
            { type: 'sine',     freq: 82.4,  gain: 0.07 },   // E2
            { type: 'triangle', freq: 164.8, gain: 0.04 },   // E3
            // Drifting upper voices — E-major-add9 family, each on its own clock
            { type: 'sine',     freq: 246.9, gain: 0.024,
              ampLfo: { rate: 0.017, depth: 0.020 } },       // B3
            { type: 'sine',     freq: 329.6, gain: 0.026,
              ampLfo: { rate: 0.012, depth: 0.022 } },       // E4
            { type: 'sine',     freq: 415.3, gain: 0.020,
              ampLfo: { rate: 0.009, depth: 0.018 } },       // G#4
            { type: 'sine',     freq: 494.4, gain: 0.018,
              ampLfo: { rate: 0.007, depth: 0.016 } },       // B4
            { type: 'sine',     freq: 659.2, gain: 0.012,
              ampLfo: { rate: 0.006, depth: 0.010 } },       // E5 (slowest)
        ],
        filter: { type: 'lowpass', freq: 1100, Q: 0.7 },     // opened — let upper voices through
        lfo: { rate: 0.05, depth: 0.22 },                    // gentler bed breath
        filterLfo: { rate: 0.04, depth: 200 },
        texture: {
            oneShots: [
                // Extremely rare glimmer
                { kind: 'glimmer', dur: 3.0, gain: 0.014,
                  intervalMin: 180, intervalMax: 360 },
                // Soft droplets — E-major-add9 pitches, very sparse
                { kind: 'droplet', gain: 0.022,
                  freqs: [493.9, 659.3, 830.6, 987.8],        // B4, E5, G#5, B5
                  intervalMin: 110, intervalMax: 220 },
            ],
        },
    },
};

let _audioCtx = null;
let _droneNodes = null;   // { oscs, gains, filter, masterGain, lfoGain, filterLfoGain }
let _droneStarted = false;

function initDrone() {
    if (_droneStarted) return;
    const config = CHAMBER_DRONES[_prismId];
    if (!config) return;
    _droneStarted = true;

    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Fade node: handles smooth in/out independent of the LFO-modulated master,
    // so envelope changes can never click against modulation.
    const fade = _audioCtx.createGain();
    fade.gain.value = 0;
    fade.connect(_audioCtx.destination);

    const master = _audioCtx.createGain();
    master.gain.value = 0.6;
    master.connect(fade);

    // Main filter
    const filter = _audioCtx.createBiquadFilter();
    filter.type = config.filter.type;
    filter.frequency.value = config.filter.freq;
    filter.Q.value = config.filter.Q;
    filter.connect(master);

    // Create oscillator layers (with optional per-layer amplitude LFO)
    const oscs = [];
    const gains = [];
    const extraLfos = [];   // per-layer ampLfo oscillators (need .stop() too)
    config.layers.forEach(layer => {
        const osc = _audioCtx.createOscillator();
        osc.type = layer.type;
        osc.frequency.value = layer.freq;

        const g = _audioCtx.createGain();
        g.gain.value = layer.gain;
        osc.connect(g);
        g.connect(filter);
        osc.start();
        oscs.push(osc);
        gains.push(g);

        if (layer.ampLfo) {
            const lfoX = _audioCtx.createOscillator();
            lfoX.type = 'sine';
            lfoX.frequency.value = layer.ampLfo.rate;
            const lgX = _audioCtx.createGain();
            lgX.gain.value = layer.ampLfo.depth;
            lfoX.connect(lgX); lgX.connect(g.gain);
            lfoX.start();
            extraLfos.push(lfoX);
        }
    });

    // Amplitude LFO — slow breathing on master volume
    const lfo = _audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.lfo.rate;
    const lfoGain = _audioCtx.createGain();
    lfoGain.gain.value = config.lfo.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();

    // Filter LFO — slow sweep of cutoff frequency
    const filterLfo = _audioCtx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = config.filterLfo.rate;
    const filterLfoGain = _audioCtx.createGain();
    filterLfoGain.gain.value = config.filterLfo.depth;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();

    // --- Texture bus: parallel to bed, joins at fade (skips bed's amp LFO) ----
    const textureStoppables = [];
    const textureTimers = [];
    let textureBus = null;
    if (config.texture) {
        textureBus = _audioCtx.createGain();
        textureBus.gain.value = 0.55;       // texture sits ~half master level
        textureBus.connect(fade);

        // Optional convolution reverb (Art Gallery): one-shots that opt in
        // route through this; the noise bed (if any) goes direct to textureBus.
        let reverbInput = null;
        if (config.texture.reverb) {
            const conv = _audioCtx.createConvolver();
            conv.buffer = _createImpulseResponse(
                _audioCtx, config.texture.reverb.dur, config.texture.reverb.decay
            );
            const wet = _audioCtx.createGain();
            wet.gain.value = config.texture.reverb.wet;
            conv.connect(wet); wet.connect(textureBus);
            reverbInput = conv;
        }

        // Continuous noise layer (breath / hiss / stone air / solar wind)
        if (config.texture.noise) {
            const noiseStoppables = _createNoiseLayer(
                _audioCtx, textureBus, config.texture.noise
            );
            noiseStoppables.forEach(n => textureStoppables.push(n));
        }

        // Scheduled one-shots — each spec gets its own timer chain
        if (config.texture.oneShots) {
            config.texture.oneShots.forEach(spec => {
                // Route through reverb only if the spec opted in AND we have a convolver.
                const target = (spec.reverb && reverbInput) ? reverbInput : textureBus;
                _scheduleOneShot(_audioCtx, target, spec, textureTimers);
            });
        }
    }

    _droneNodes = {
        oscs, gains, filter, master, fade, lfo, filterLfo,
        extraLfos, textureBus, textureStoppables, textureTimers,
    };

    // Fade in over 4 seconds via the dedicated fade node
    fade.gain.setValueAtTime(0, _audioCtx.currentTime);
    fade.gain.linearRampToValueAtTime(1, _audioCtx.currentTime + 4);
}

// Auto-start drone after 2.5s. AudioContext may be suspended (browser autoplay
// policy) — if so, resume on first user interaction.
setTimeout(() => {
    initDrone();
    if (_audioCtx && _audioCtx.state === 'suspended') {
        function resumeAudio() {
            if (_audioCtx && _audioCtx.state === 'suspended') {
                _audioCtx.resume();
            }
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
        }
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
    }
}, 2500);

// --- Reveal scene: opaque curtain hides everything while assets paint ---
// The scene renders normally behind a black curtain div (z-index:9999).
// Once all images, backgrounds, and fonts are loaded we wait two extra rAFs
// to guarantee the browser has fully composited everything, then fade the
// curtain out — the complete scene appears all at once.
if (prismContainer) prismContainer.style.transition = 'none';
{
    const _curtain = document.getElementById('scene-curtain');
    const _wa = document.getElementById('wall-area');
    const promises = [];

    // All <img> elements on the page
    document.querySelectorAll('img').forEach(img => {
        if (!img.complete) {
            promises.push(new Promise(r => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
            }));
        }
    });

    // CSS background-image on wall panels (chamber background JPEGs)
    if (_wa) _wa.querySelectorAll('.wall-panel').forEach(panel => {
        const bg = getComputedStyle(panel).backgroundImage;
        if (bg && bg !== 'none') {
            const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
            const preload = new Image();
            promises.push(new Promise(r => {
                preload.onload = r;
                preload.onerror = r;
                preload.src = url;
            }));
        }
    });

    // Web fonts
    if (document.fonts && document.fonts.ready) {
        promises.push(document.fonts.ready);
    }

    // Safety timeout — never stay blank longer than 5s
    const timeout = new Promise(r => setTimeout(r, 5000));

    function liftCurtain() {
        // Two rAFs: first ensures the browser has painted all loaded assets,
        // second ensures that paint is fully composited to the screen buffer.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (_wa) _wa.classList.add('prism-ready');
                if (prismContainer) prismContainer.style.transition = '';
                if (_curtain) {
                    _curtain.classList.add('lift');
                    _curtain.addEventListener('transitionend', () => _curtain.remove(), { once: true });
                }
                // Auto-open text frame (or heavens tilt) if ?open=1 was in the URL
                if (_autoOpen) {
                    const _fw = getFacingWall();
                    setTimeout(() => {
                        if (_heavensTiltWalls[_fw]) {
                            enterHeavensTilt(_fw);
                        } else {
                            openWordOnWall(_fw);
                        }
                    }, 350);
                }
            });
        });
    }

    Promise.race([Promise.all(promises), timeout]).then(liftCurtain);
}

// --- Shrine: candles with random burn heights, ~18% lit, click to light ---
(function initShrine() {
    const candles = Array.from(document.querySelectorAll('.shrine-candle'));
    if (!candles.length) return;

    // TEST: central candle in top row (row 2, position 4 of 9) always starts unlit
    //       and always picks a chained transmission — revert when done testing
    const TEST_CHAIN_CANDLE = 22;

    const LIT_COUNT = Math.max(1, Math.round(candles.length * 0.18));
    const litSet = new Set();
    while (litSet.size < LIT_COUNT) {
        const idx = Math.floor(Math.random() * candles.length);
        if (idx !== TEST_CHAIN_CANDLE) litSet.add(idx);
    }

    candles.forEach((candle, i) => {
        const isLit = litSet.has(i);
        // Unlit candles are full height (new); lit candles are partially burned down
        const burn = isLit ? 0.2 + Math.random() * 0.8 : 0;
        const bodyH = ((0.7 + (1 - burn) * 2.3) * 0.4).toFixed(2); // 0.28vh–1.2vh
        candle.querySelector('.candle-body').style.height = bodyH + 'vh';
        if (isLit) candle.classList.add('lit');
        if (i === TEST_CHAIN_CANDLE) candle.dataset.testChain = 'true';
    });
})();

// --- Search: tag-aware ranking over LEILAN_INDEX, with lazy-loaded tag index ---
let _transmissionTags = null;
async function loadTransmissionTags() {
    if (_transmissionTags) return _transmissionTags;
    try {
        const resp = await fetch('/data/transmission-tags.json');
        _transmissionTags = await resp.json();
    } catch (e) {
        _transmissionTags = {};
    }
    return _transmissionTags;
}

(function initSearch() {
    const input = document.querySelector('.wall-search-input');
    const results = document.querySelector('.wall-search-results');
    if (!input || !results) return;

    shrineSearchDefaultPlaceholder = input.placeholder || '';
    const index = getTransmissionPool();
    if (!index.length) return;

    // Preload tags in the background as soon as the shrine wall is present
    loadTransmissionTags();

    // Scroll buttons
    const resScrollUp   = document.querySelector('.results-scroll-up');
    const resScrollDown = document.querySelector('.results-scroll-down');
    if (resScrollUp)   resScrollUp.addEventListener('click',   () => results.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' }));
    if (resScrollDown) resScrollDown.addEventListener('click', () => results.scrollBy({ top:  SCROLL_STEP, behavior: 'smooth' }));

    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); results.scrollBy({ top:  SCROLL_STEP, behavior: 'smooth' }); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); results.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' }); }
        if (e.key === 'Escape' && shrineHeavensLocked()) { e.preventDefault(); leaveShrineHeavens(); }
    });

    let _hoveredDiv = null;
    let _hoveredSpan = null;

    function startScrollAnim(div, span) {
        const overflow = span.scrollWidth - div.clientWidth;
        if (overflow > 4) {
            const dur = Math.max(2.25, overflow / 33);
            span.style.animation = 'none';
            span.offsetWidth;
            // 3ch buffer at each end of the scroll cycle. The pre-animation state
            // is still translateX(0) (no --scroll-start applied), so titles render
            // flush left until the 0.3s hover delay elapses and the cycle begins.
            span.style.setProperty('--scroll-start', '3ch');
            span.style.setProperty('--scroll-dist', `calc(-${overflow}px - 3ch)`);
            span.style.animation = `scrollSearchText ${dur}s 0.3s linear infinite alternate`;
        }
        div.classList.add('hovered');
    }

    function stopScrollAnim(div, span) {
        span.style.animation = '';
        div.classList.remove('hovered');
    }

    document.addEventListener('mousemove', (e) => {
        const items = results.querySelectorAll('.wall-search-result');
        if (!items.length) {
            if (_hoveredDiv) { stopScrollAnim(_hoveredDiv, _hoveredSpan); _hoveredDiv = null; _hoveredSpan = null; }
            return;
        }
        let found = null, foundSpan = null;
        for (const item of items) {
            const r = item.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom) {
                found = item;
                foundSpan = item.querySelector('span');
                break;
            }
        }
        if (found === _hoveredDiv) return;
        if (_hoveredDiv) stopScrollAnim(_hoveredDiv, _hoveredSpan);
        if (found && foundSpan) startScrollAnim(found, foundSpan);
        _hoveredDiv = found;
        _hoveredSpan = foundSpan;
    });

    function scoreItem(item, terms, tags) {
        const titleLow = (item.t || item.title || '').toLowerCase();
        const bodyLow  = (item.c || item.body  || '').toLowerCase();
        const itemId   = item.i || item.id || '';
        const itemTags = (tags && tags[itemId]) ? tags[itemId].map(t => t.toLowerCase()) : [];
        const q = terms.join(' ');

        let score = 0;
        let anyMatch = false;

        for (const term of terms) {
            let termScore = 0;

            // --- Tag matches (highest weight) ---
            let exactTagMatch = false;
            let partialTagMatch = false;
            for (const tag of itemTags) {
                if (tag === term) { exactTagMatch = true; break; }
                if (tag.includes(term) || term.includes(tag)) partialTagMatch = true;
            }
            if (exactTagMatch)   { termScore += 12; anyMatch = true; }
            else if (partialTagMatch) { termScore += 6; anyMatch = true; }

            // --- Title matches ---
            if (titleLow.includes(term)) {
                let hits = 0, pos = titleLow.indexOf(term);
                while (pos !== -1) { hits++; pos = titleLow.indexOf(term, pos + 1); }
                termScore += hits * 4;
                anyMatch = true;
            }

            // --- Body matches (BM25-inspired, lower weight) ---
            if (bodyLow.includes(term)) {
                let hits = 0, pos = bodyLow.indexOf(term);
                while (pos !== -1) { hits++; pos = bodyLow.indexOf(term, pos + 1); }
                const dl = bodyLow.length || 1;
                const k1 = 1.5, b = 0.75, avgDl = 3000;
                const tf = hits;
                termScore += tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avgDl));
                anyMatch = true;
            }

            score += termScore;
        }

        // Bonus: exact full query in title
        if (titleLow.includes(q)) score += 5;
        // Bonus: exact full query matches a tag
        if (itemTags.some(t => t.includes(q))) score += 8;

        return anyMatch ? score : 0;
    }

    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            const q = input.value.trim().toLowerCase();
            results.innerHTML = '';
            _hoveredDiv = null;
            _hoveredSpan = null;
            shrineSearchResultsSnapshot = [];
            if (!q) return;

            const terms = q.split(/\s+/).filter(t => t.length > 1);
            if (!terms.length) return;

            const tags = await loadTransmissionTags();
            const scored = [];
            for (const item of index) {
                const s = scoreItem(item, terms, tags);
                if (s > 0) scored.push({ item, score: s });
            }

            scored.sort((a, b) => b.score - a.score);
            shrineSearchResultsSnapshot = scored.slice(0, 12).map(s => s.item);
            shrineSearchResultsSnapshot.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'wall-search-result';
                div.dataset.matchIndex = String(idx);
                const span = document.createElement('span');
                span.textContent = item.t || item.title;
                div.appendChild(span);
                results.appendChild(div);
            });
        }, 200);
    });

    results.addEventListener('click', (e) => {
        const itemEl = e.target.closest('.wall-search-result');
        if (!itemEl || shrineHeavensLocked()) return;
        const idx = parseInt(itemEl.dataset.matchIndex || '', 10);
        const item = Number.isFinite(idx) ? shrineSearchResultsSnapshot[idx] : null;
        if (!item) return;
        enterShrineHeavens(item);
    });
})();;