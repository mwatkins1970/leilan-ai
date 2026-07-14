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
const FRAME_MELT_MS = 420;   // matches the .melting animation in prism.css
// The shrine search-results box only overflows by a little, so the 120px
// SCROLL_STEP would jump the whole list in one press. Its arrows step by one
// result row instead, for gradual scrolling.
function resultsRowStep(resultsEl) {
    const row = resultsEl && resultsEl.querySelector('.wall-search-result');
    return row ? Math.max(1, Math.round(row.getBoundingClientRect().height)) : 40;
}
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
// The prism's on-screen width is roughly COVER_K × viewport height. When the
// viewport is wider than that (wide/short landscape shapes), scale the whole
// scene up so it still covers the full width — cropping a little at the top —
// rather than letting the background sky show at the left/right edges.
//
// This "cover" zoom exists ONLY for wide/short LANDSCAPE PHONES, where edge sky
// looks broken. Both landscape phones and wide desktop monitors have a ratio
// above COVER_K, but only phones are short — so gate the zoom to short
// viewports. On laptops/desktops it would otherwise crop the sky off the tops
// of the ceiling wedges, so there cover stays 1 (original framing, sky above
// the wedges preserved).
const COVER_K = 1.78;
const COVER_MAX_VIEWPORT_H = 560; // px; above this we treat it as a laptop/desktop, not a landscape phone
// Hard ceiling on the zoom: even on a wide/short landscape phone, never zoom so
// far that the night sky above the ceiling wedges is cropped away — a sliver of
// sky must always show. Filling the very last edge of width is less important
// than keeping the open-air-cathedral framing. Tunable: raise it to fill more
// width (less sky), lower it to guarantee more sky.
const COVER_MAX = 1.06;
// Half-width of the visible 3-wall front, as a fraction of viewport-height × cover.
// COVER_K/2 is where the prism "just fills" the width, i.e. the outer wall corners —
// so the pillarbox edge sits there. Tune up to nudge the black edges inward.
const PILLAR_EDGE_K = COVER_K / 2;

// Pillarbox "static fuzz" — plain black bars read as dead letterboxing beside
// the (always-lit) chamber walls, so both modes carry an animated grain: day a
// pale paper-grain (`--pillar-noise`, base #e6edf3-ish), night a dark
// dead-channel static (`--pillar-noise-night`, near-black with sparse brighter
// flecks). Three 96px tiles per palette are generated once and cycled ~9fps,
// but only while the bars actually exist (_pillarBarW > 0, set by
// updateWallSize) and the tab is visible; only the active mode's property is
// written each tick. Reduced motion gets a single static frame.
let _pillarBarW = 0;
(function initPillarNoise() {
    const makeFrames = (base, spread, fleckChance, fleckDelta) => {
        const frames = [];
        for (let f = 0; f < 3; f++) {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 96;
            const ctx = cv.getContext('2d');
            const img = ctx.createImageData(96, 96);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const v = base + Math.random() * spread - spread / 2;
                const fleck = Math.random() < fleckChance ? fleckDelta : 0;
                d[i]     = v + fleck - 6;
                d[i + 1] = v + fleck + 1;
                d[i + 2] = v + fleck + 8;                   // faint blue cast
                d[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
            frames.push(`url(${cv.toDataURL()})`);
        }
        return frames;
    };
    const dayFrames = makeFrames(225, 26, 0.02, -38);   // pale paper-grain
    const nightFrames = makeFrames(58, 44, 0.05, 85);   // dim-grey TV static, bright flecks
    document.documentElement.style.setProperty('--pillar-noise', dayFrames[0]);
    document.documentElement.style.setProperty('--pillar-noise-night', nightFrames[0]);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let fi = 0;
    setInterval(() => {
        if (document.hidden || _pillarBarW <= 0) return;
        fi = (fi + 1) % 3;
        const isDay = document.body.classList.contains('day-mode');
        document.documentElement.style.setProperty(
            isDay ? '--pillar-noise' : '--pillar-noise-night',
            isDay ? dayFrames[fi] : nightFrames[fi]);
    }, 110);
})();

function updateWallSize() {
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    // offsetHeight, NOT getBoundingClientRect().height: the rect includes the
    // --chamber-cover scale this function itself applies, so measuring it on a
    // resize (with cover > 1) inflated --wall-w by the cover factor — walls
    // grew ~6% after any resize on wide/short viewports, silently shifting
    // the archway geometry that other code derives from wall proportions.
    const h = wallArea.offsetHeight;
    const wallW = h * IMG_ASPECT;
    wallArea.style.setProperty('--wall-w', wallW + 'px');
    wallArea.style.setProperty('--apothem', (wallW * Math.sqrt(3) / 2) + 'px');
    const coverRaw = window.innerHeight <= COVER_MAX_VIEWPORT_H
        ? Math.max(1, (window.innerWidth / window.innerHeight) / COVER_K)
        : 1;
    const cover = Math.min(coverRaw, COVER_MAX);
    wallArea.style.setProperty('--chamber-cover', cover.toFixed(4));

    // Pillarbox: only needed on the wide/short (landscape-phone) case, where the
    // zoom got CAPPED (coverRaw > COVER_MAX) so the prism can't fill the width and
    // the outer-wall artefact shows at the edges. On normal desktop cover is 1, the
    // prism sits at its natural size and the edges are just sky — so NO bars there.
    const capped = coverRaw > COVER_MAX;
    const sceneHalfW = PILLAR_EDGE_K * window.innerHeight * cover;
    const barW = capped ? Math.max(0, window.innerWidth / 2 - sceneHalfW) : 0;
    _pillarBarW = barW;   // gates the day-mode static-fuzz animation
    const pl = document.getElementById('pillar-left');
    const pr = document.getElementById('pillar-right');
    if (pl) pl.style.width = barW + 'px';
    if (pr) pr.style.width = barW + 'px';
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

// Rear rim CAP culling (2026-07-14). The horizontal .rim-wedge-bottom /
// .rim-vertex-bottom caps face DOWNWARD: the same front faces the heavens
// tilt legitimately shows from below are what ghost above the rooflines at
// wide aspect ratios when they belong to walls behind the viewer (sighted
// through the backface-culled rear walls). No backface-visibility rule can
// split those two views — the distinction is which wall, not which face —
// so the caps of walls at hidden positions get .rim-caps-culled here, and
// everything is un-culled while a heavens tilt runs (the ceiling ring needs
// all six). An earlier pass that hid whole rim sections left that ring
// gap-toothed; caps-only + tilt gating is the surviving approach.
function updateRimCapCulling(unionWithShrinePos = null) {
    if (document.body.classList.contains('shrine-heavens-active')) return;
    const hidden = n => !isWallVisible(n)
        || (unionWithShrinePos !== null && !isWallVisible(n, unionWithShrinePos));
    document.querySelectorAll('.rim-section[data-rim-wall]').forEach(el => {
        el.classList.toggle('rim-caps-culled', hidden(parseInt(el.dataset.rimWall, 10)));
    });
    // Vertex k bridges walls k and k+1 — its cap shows only when both do.
    document.querySelectorAll('.rim-vertex[data-rim-vertex]').forEach(el => {
        const k = parseInt(el.dataset.rimVertex, 10);
        el.classList.toggle('rim-caps-culled', hidden(k) || hidden(k === 6 ? 1 : k + 1));
    });
}
function uncullRimCaps() {
    document.querySelectorAll('.rim-caps-culled').forEach(el => el.classList.remove('rim-caps-culled'));
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
requestAnimationFrame(() => {
    if (typeof updatePointerEvents === 'function') updatePointerEvents();
    if (typeof updateRimCapCulling === 'function') updateRimCapCulling();
});

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
  margin: 0 auto;
  max-width: clamp(20rem, 46vw, 42rem);   /* fits the sky opening; matches the body */
  text-align: center;
  font: 400 clamp(1.5rem, 2.2vw, 2.2rem) "IBM Plex Mono", monospace;
  letter-spacing: 0.08em;
  color: #c2ffdc;
  text-shadow: 0 0 14px rgba(130,255,190,0.55), 0 0 32px rgba(100,255,175,0.28);
}
.shrine-heavens-body-wrap {
  flex: 0 1 auto;          /* hug the text; don't grow to fill (that left a gap above the footer) */
  min-height: 0;
  display: flex;
  flex-direction: column;
}
#shrine-heavens-body {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 66vh;        /* show a good amount, then scroll — keeps the footer under the text */
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 0 0.4rem 0.4rem;
  max-width: clamp(20rem, 46vw, 42rem);   /* scales with viewport; matches the title */
  margin-left: auto;
  margin-right: auto;
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
  flex-wrap: wrap;          /* buttons stack rather than overflow on a narrow (portrait) screen */
}
/* The two scroll arrows sit together on their own centred row (both orientations),
   one button-diameter apart. Own row because flex-basis:100%. */
.shrine-scroll-pair {
  flex-basis: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;              /* one button-radius between ▲ and ▼ */
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
  /* Take the hidden buttons OUT OF FLOW so they reserve no vertical space while
     deferred — otherwise their invisible row leaves a dead gap between the text
     and the ▲▼ scroll pair. They pop (and fade) back into flow on reveal. */
  position: absolute;
}
/* When shrine-heavens is not active, the overlay panel is invisible (opacity:0)
   but its descendants still have pointer-events:auto and span most of the viewport.
   Without this rule, they intercept hover/click events on the archway-click-overlay
   below them, leaving the door near-non-responsive after Eternal Return. */
body:not(.shrine-heavens-active) #shrine-heavens-overlay,
body:not(.shrine-heavens-active) #shrine-heavens-overlay * {
  pointer-events: none;
}
/* While a transmission is open, let the reader be read in portrait too —
   suppress the rotate-to-landscape gate. "Eternal return" removes
   .shrine-heavens-reading (before the tilt-down), so the gate reappears in
   portrait and the user is asked to turn the phone back to landscape. */
body.shrine-heavens-reading #portrait-gate[data-cinematic] { display: none !important; }
/* Portrait phone reading: keep the title compact so more body text shows, give
   the body the freed space, compact the buttons, and gather the ▲▼ scroll
   controls onto a single row at the very bottom — otherwise the wrapping footer
   drops them into opposite corners with a dead gap between. */
@media (max-width: 900px) and (orientation: portrait) {
  #shrine-heavens-overlay .shrine-heavens-panel {
    top: 4vh;
    max-height: 92vh;
    gap: 0.7rem;
    padding: 0 1rem 1rem;
  }
  #shrine-heavens-title {
    max-width: 100%;
    font-size: clamp(1.1rem, 5vw, 1.5rem);
    letter-spacing: 0.04em;
  }
  #shrine-heavens-body { max-width: 100%; max-height: 60vh; }
  .shrine-heavens-footer { gap: 0.5rem 0.7rem; }
  #shrine-eternal-return { min-width: 0; padding: 0.5rem 1.1rem; }
  #shrine-next, #shrine-previous, #shrine-alt-context { min-width: 0; padding: 0.5rem 0.9rem; }
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
          <button id="shrine-previous" type="button">previous</button>
          <button id="shrine-alt-context" type="button">alt/context</button>
          <button id="shrine-eternal-return" type="button">eternal return</button>
          <button id="shrine-next" type="button">next</button>
          <div class="shrine-scroll-pair">
            <button class="shrine-scroll-btn" id="shrine-scroll-up" type="button" aria-label="Scroll up">▲</button>
            <button class="shrine-scroll-btn" id="shrine-scroll-down" type="button" aria-label="Scroll down">▼</button>
          </div>
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
// NOTE (2026-07-13): do NOT "fix" this to a true eye-point pivot (tried via rotateX on
// #world-tilt with transform-origin z at the perspective distance, reverted same day):
// a rigid head-tilt swings the rear rim/wall-top geometry — never designed to be seen —
// into view overhead at full tilt. The wall-plane hinge keeps it below the frame.
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
        uncullRimCaps(); // the tilt's ceiling ring shows all six rims' caps
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
            updateRimCapCulling(); // chamber level again — re-cull rear caps
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
        bodyHtml += `<a id="shrine-heavens-img-link" href="${cfg.imageSrc}" target="_blank" rel="noopener noreferrer" style="display:block;margin:0 auto 1.2em;width:fit-content;"><img src="${cfg.imageSrc}" alt="" style="display:block;max-width:min(90%, 510px);margin:0 auto;border-radius:4px;cursor:zoom-in;" /></a>`;
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
        uncullRimCaps(); // the tilt's ceiling ring shows all six rims' caps
        startLookUpAnim(0, 90, SHRINE_HEAVENS_UP_MS, () => {
            window.setTimeout(() => {
                document.body.classList.add('shrine-heavens-reading');
            }, 600);
            _shrineEnterFinalTimer = window.setTimeout(() => {
                _shrineEnterFinalTimer = null;
                isShrineHeavensTransitioning = false;
                isShrineHeavensMode = true;
                ui.button.focus({ preventScroll: true });
                // Only expose the hover tooltip once the horoscope is fully revealed
                const imgLink = document.getElementById('shrine-heavens-img-link');
                if (imgLink) imgLink.title = 'Open full-size in a new tab';
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
    if (typeof _maybeRefreshLectern === 'function') _maybeRefreshLectern();
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
    hideArchwayTip();
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
    updateRimCapCulling(oldShrinePos); // union-cull while the rotation runs
}

function lookLeft() {
    if (isRotating || archwayAnimating || shrineHeavensLocked()) return;
    closeCinematicReader();
    hideArchwayTip();
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
    updateRimCapCulling(oldShrinePos); // union-cull while the rotation runs
}

function targetShrinePosForFacingWall(targetWall) {
    return shrinePosFromFacingWall(targetWall);
}

function rotateToWall(targetWall) {
    if (isRotating || archwayAnimating || shrineHeavensLocked() || targetWall === getFacingWall()) return;
    hideArchwayTip();
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
    updateRimCapCulling(oldShrinePos); // union-cull while the rotation runs
}

// Back-compat names used elsewhere in this file.
const rotateLeft = lookRight;
const rotateRight = lookLeft;

// Sync the sky-rotation clock to the walls' ACTUAL transition start. The CSS
// transition begins when the browser commits the style change — up to a frame
// or two after animateSkyRotation() ran — so seeding _skyRotT0 there made the
// stars run ahead of the walls by that gap on every rotation.
if (prismContainer) {
    prismContainer.addEventListener('transitionstart', (e) => {
        if (e.target !== prismContainer || e.propertyName !== 'transform') return;
        if (!_skyRotWaiting) return;
        _skyRotWaiting = false;
        _skyRotT0 = e.timeStamp || performance.now();
    });
}

// Unlock rotation after CSS transition completes
if (prismContainer) {
    prismContainer.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'transform') {
            isRotating = false;
            setFacingTag();
            updateRimCapCulling(); // rotation settled — exact cull set
            updateAlephChars();
            if (archwayOverlay && archwayOverlay.matches(':hover')) {
                showArchwayTip();
            }
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

    // ASCII gallery: the lectern stands directly in the camera's path. Fade it
    // out at the start of the zoom so the user doesn't appear to walk through
    // a solid post. 600ms covers the first ~20% of the 3200ms zoom.
    if (_prismId === 'ascii-gallery') {
        const lectern = document.querySelector('.ascii-lectern');
        if (lectern) lectern.classList.add('ascii-lectern-fading');
    }

    const apothem = getApothem();
    const startZ = apothem;
    const endZ = apothem * 1.8;

    // Archway center — anchor to the ACTUAL archway click-overlay rect (the
    // element the user just clicked, positioned over the real door by
    // updateArchwayOverlay). Re-deriving from wall-area percentages (the old
    // way, kept as fallback) silently disagrees with the rendered door
    // whenever an assumption drifts — e.g. the pre-fix updateWallSize
    // inflation, or any future transform on the wall stack — and the rings
    // then radiate from a point that isn't the door.
    const wallArea = document.getElementById('wall-area');
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight * 0.88;
    const _ov = document.getElementById('archway-click-overlay');
    if (_ov && _ov.style.display !== 'none') {
        const r = _ov.getBoundingClientRect();
        cx = r.left + r.width / 2;
        // Target well into the lower portion of the dark opening
        cy = r.top + r.height * 0.8;
    } else if (wallArea) {
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

    // The door MOVES during the zoom: the prism-container translateZ dolly
    // magnifies about the PERSPECTIVE origin (mid wall-area), not about the
    // door — so the door slides down/outward from its click-time position
    // while the chamber scale stays anchored on (cx, cy). Rings drawn at the
    // static point visibly drift off the door (worst on short viewports,
    // where the door sits far from the perspective origin). Fix: re-anchor
    // the ring centre to the door's LIVE rect each frame. The archway SVG
    // spans its wall panel; the drawn door's dark opening bottom-centre sits
    // at (centre, bottom − 6.25% of panel height) — same fractions as the
    // static formula.
    const _archEl = document.querySelector(`.wall-panel[data-wall="${wallNum}"] .wall-archway`);
    function liveDoorCentre() {
        if (!_archEl) return { x: cx, y: cy };
        const r = _archEl.getBoundingClientRect();
        if (!r.width) return { x: cx, y: cy };
        return { x: r.left + r.width / 2, y: r.bottom - r.height * 0.0625 };
    }

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

        // Shimmer effect (starts later, builds gently) — centred on the
        // door's live position, which the translateZ dolly moves each frame.
        const shimmerProgress = Math.max(0, (rawT - 0.35) / 0.65);
        const dc = liveDoorCentre();
        drawShimmer(shimmerProgress, dc.x, dc.y);

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

            // Sub-chamber returns: force the destination's returnShrinePos so
            // the user faces away from the door they just came through, even
            // when this sub-chamber was entered via a direct URL (no prior
            // orb-click left a stored value). For ASCII gallery → Scriptorium,
            // the connecting door is Scriptorium's wall 1, so we want wall 4
            // facing on return — that's shrinePos=5, which decodes back from
            // stored value '5' via shrinePos = mod6(4 - 5).
            if (_prismId === 'ascii-gallery') {
                const destPrism = (dest.match(/\/prism\/([^/?#]+)/) || [])[1];
                if (destPrism === 'gpt3-library') {
                    sessionStorage.setItem('returnShrinePos_gpt3-library', '5');
                }
            }

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
    // ASCII gallery: the wall-4 archway is concealed until the lectern is melted.
    // Until then the click-overlay must not respond, even though the destination
    // mapping exists in PRISM_CONFIG.
    if (_prismId === 'ascii-gallery' && !_lecternMelted) {
        archwayOverlay.style.display = 'none';
        archwayTip.style.opacity = '0';
        return;
    }
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const rect = wallArea.getBoundingClientRect();
    // rect is SCALED by --chamber-cover; --wall-w is layout px. Multiply by
    // cover so the overlay tracks the door's true on-screen size (it was ~6%
    // narrow on cover-zoomed wide/short viewports — and the archway rings now
    // anchor to this rect, so it must be exact).
    const cover = parseFloat(wallArea.style.getPropertyValue('--chamber-cover')) || 1;
    const wallW = (parseFloat(wallArea.style.getPropertyValue('--wall-w')) || (wallArea.offsetHeight * IMG_ASPECT)) * cover;
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
    'gpt3-library': {
        1: 'ASCII ART GALLERY\nworks by Leilan2.0',
    },
    'ascii-gallery': {
        4: 'return to Scriptorium',
    },
};
const _defaultTooltip = 'return to centre';

function getArchwayTooltipText(wallNum) {
    const chamberTips = _archwayTooltips[_prismId];
    if (chamberTips && chamberTips[wallNum]) return chamberTips[wallNum];
    if (window.PRISM_CONFIG?.destinations?.[wallNum]) return _defaultTooltip;
    return null;
}

function showArchwayTip() {
    if (!archwayOverlay) return;
    const text = getArchwayTooltipText(getFacingWall());
    if (!text) { archwayTip.style.opacity = '0'; return; }
    archwayTip.textContent = text;
    const r = archwayOverlay.getBoundingClientRect();
    archwayTip.style.left = (r.left + r.width / 2) + 'px';
    archwayTip.style.top = (r.top + r.height * 0.18) + 'px';
    archwayTip.style.transform = 'translate(-50%, 0)';
    archwayTip.style.opacity = '1';
}

function hideArchwayTip() { archwayTip.style.opacity = '0'; }

if (archwayOverlay) {
    archwayOverlay.addEventListener('mouseenter', showArchwayTip);
    archwayOverlay.addEventListener('mouseleave', hideArchwayTip);
}

// --- Sky Canvas Animation ---
const skyCanvas = document.getElementById('sky-canvas');
const skyCtx = skyCanvas.getContext('2d');

// Day/night state — true celestial time: if the visitor hasn't chosen a sky yet
// this session, default to their actual local time of day (day 07:00–18:59) and
// store it so every page agrees. The ☀/☾ toggle still overrides at any time.
if (!sessionStorage.getItem('skyMode')) {
    const _hr = new Date().getHours();
    sessionStorage.setItem('skyMode', (_hr >= 7 && _hr < 19) ? 'day' : 'night');
}
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

// Each cloud's puff is a fixed shape — 3–5 overlapping soft radial gradients
// (opaque centre → transparent edge, matching immersive.astro) that only ever
// translate. Rebuilding those gradients per blob per frame was the day sky's
// main per-frame cost, so render each cloud once to a sprite and blit.
// Sprite anchor = blob 0's centre, offset by (_padX, _padY) from the top-left.
function cloudSprite(c) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (c._sprite && c._dpr === dpr) return c._sprite;
    const s = c.size;
    const padX = s * 0.7, padY = s * 0.9;
    const wpx = padX + (c.blobs - 1) * s * 0.6 + s * 0.7;
    const hpx = padY * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(wpx * dpr);
    cv.height = Math.ceil(hpx * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let b = 0; b < c.blobs; b++) {
        const bx = padX + b * s * 0.6;
        const by = padY + Math.sin(b * 1.2) * s * 0.2;
        const br = s * (0.5 + Math.sin(b * 0.8) * 0.2);
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0,   `rgba(255, 255, 255, ${c.opacity})`);
        grad.addColorStop(0.4, `rgba(255, 255, 255, ${(c.opacity * 0.65).toFixed(3)})`);
        grad.addColorStop(1,    'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
    }
    c._sprite = cv; c._dpr = dpr; c._padX = padX; c._padY = padY;
    return cv;
}

// Night stars — a FIXED FIRMAMENT: positions/symbols come from a seeded PRNG,
// so every visit (and every chamber) shows the same constellation. Stars never
// blink out or respawn; they only twinkle in brightness (see drawSky).
function _mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const _starRand = _mulberry32(0x1E11A2); // the sanctuary's firmament seed
const NUM_STARS = isSkyView ? 90 : 45;
const NUM_SMALL_STARS = isSkyView ? 60 : 35;
const skyStars = [];
for (let i = 0; i < NUM_STARS; i++) {
    skyStars.push({
        x: _starRand(),
        y: _starRand(),
        sym: starSymbols[Math.floor(_starRand() * starSymbols.length)],
        phase: _starRand() * Math.PI * 2,
        speed: 0.2 + _starRand() * 0.4,
        size: 12 + _starRand() * 12,
        palIdx: Math.floor(_starRand() * nightPalette.length),
    });
}
for (let i = 0; i < NUM_SMALL_STARS; i++) {
    skyStars.push({
        x: _starRand(),
        y: _starRand(),
        sym: starSymbols[Math.floor(_starRand() * starSymbols.length)],
        phase: _starRand() * Math.PI * 2,
        speed: 0.3 + _starRand() * 0.5,
        size: 5 + _starRand() * 4,
        palIdx: Math.floor(_starRand() * nightPalette.length),
    });
}
// Precompute each star's canvas state strings once — building a font string and
// an rgba() template per star per frame was measurable main-thread cost in
// drawSky, and every ms there is a potential stutter while the walls rotate.
skyStars.forEach(s => {
    s.font = `400 ${s.size}px "IBM Plex Mono", monospace`;
    const [cr, cg, cb] = nightPalette[s.palIdx];
    s.colPre = `rgba(${cr},${cg},${cb},`;
});

// --- Real lunar phase: the night-sky moon shows the moon's ACTUAL current
// phase, so the cathedral's sky agrees with the one outside the visitor's
// window. Age is days since a known new moon (2000-01-06 18:14 UTC) folded
// onto the synodic month; 0 = new, 0.5 = full.
const _SYNODIC_DAYS = 29.530588853;
function moonAge01() {
    const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
    return ((days / _SYNODIC_DAYS) % 1 + 1) % 1;
}

// Draw a phased moon. The lit shape is built as the waxing form (lit limb on
// the right: right semicircle + terminator half-ellipse whose x-radius is
// |cos(2π·age)|·r, bulging toward the lit side for a crescent and away for a
// gibbous) and mirrored horizontally for waning.
function drawMoon(ctx, cx, cy, r, age) {
    const ill = (1 - Math.cos(age * Math.PI * 2)) / 2;   // 0 new → 1 full
    // Halo, brightening with illumination
    const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3.2);
    halo.addColorStop(0, `rgba(236,232,215,${(0.05 + 0.15 * ill).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(236,232,215,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2); ctx.fill();
    // Opaque backing disc: the moon is a solid body — it occludes any stars
    // behind it (they'd otherwise show through the translucent earthshine).
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // Earthshine disc (the dark part is faintly there, as in life)
    ctx.fillStyle = 'rgba(205,210,225,0.10)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (ill > 0.01) {
        const k = Math.cos(age * Math.PI * 2);   // +1 new … −1 full
        ctx.save();
        ctx.translate(cx, cy);
        if (age >= 0.5) ctx.scale(-1, 1);        // waning: mirror the waxing form
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);                          // lit limb
        ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);  // terminator
        ctx.closePath();
        ctx.fillStyle = 'rgba(238,234,220,0.92)';
        ctx.fill();
        // A few soft maria, clipped to the disc
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(150,148,140,0.14)';
        [[0.30, -0.25, 0.17], [-0.10, 0.18, 0.23], [0.42, 0.32, 0.11], [-0.32, -0.38, 0.13]]
            .forEach(([mx, my, mr]) => {
                ctx.beginPath(); ctx.arc(mx * r, my * r, mr * r, 0, Math.PI * 2); ctx.fill();
            });
        ctx.restore();
    }
}

// Offscreen moon sprite: drawMoon builds 2–3 radial gradients + clipped arcs,
// which is too expensive to repeat every frame during a rotation/tilt. The
// moon only changes with radius (resize) or phase (daily), so render it once
// to a small canvas and blit. Sprite side covers the halo (r × 3.2, both ways).
let _moonSprite = null, _moonSpriteR = 0, _moonSpriteAge = -1, _moonSpriteDpr = 0;
function moonSprite(r, age) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const ageKey = Math.round(age * 1000); // phase moves ~0.034/day — plenty
    if (!_moonSprite || Math.abs(r - _moonSpriteR) > 0.25 ||
        ageKey !== _moonSpriteAge || dpr !== _moonSpriteDpr) {
        const side = Math.ceil(r * 3.2 * 2) + 4;
        _moonSprite = document.createElement('canvas');
        _moonSprite.width = side * dpr;
        _moonSprite.height = side * dpr;
        const mctx = _moonSprite.getContext('2d');
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawMoon(mctx, side / 2, side / 2, r, age);
        _moonSpriteR = r; _moonSpriteAge = ageKey; _moonSpriteDpr = dpr;
    }
    return _moonSprite;
}

// --- Shooting stars: brief meteor streaks in the night sky, one every ~16–44s.
// They spawn in the top ~3–13% of the viewport on shallow trajectories, so they
// stay inside the sliver of sky visible above the ceiling wedges in normal
// (non-tilted) chamber view as well as in the wide heavens-tilt sky.
// (A Comet ZTF cameo lived here briefly — cut for realism: a true comet hangs
// near-motionless night to night. It may return someday as a fixed apparition.)
const _meteors = [];
let _nextMeteorAtMs = 0;

let skyFrame = 0;
let skyTiltOffset = 0; // normalized 0–1 vertical shift applied to star y-positions during tilt
let skyRotationOffset = 0; // normalized 0–1 horizontal shift applied to star/cloud x-positions during rotation
let _skyRotTarget = 0; // target value for animated sky rotation
let _skyRotStart = 0;  // start value for animated sky rotation
let _skyRotT0 = 0;     // animation start time
let _skyRotWaiting = false; // true between animateSkyRotation() and the walls' transitionstart
const SKY_ROT_DURATION = 800; // ms — matches CSS transition duration

function animateSkyRotation(delta) {
    _skyRotStart = skyRotationOffset;
    _skyRotTarget = _skyRotTarget + delta;
    // Fallback clock only: the CSS transition on .prism-container doesn't start
    // until the browser commits the style change, up to a frame or two after
    // this call. The transitionstart listener below re-seeds _skyRotT0 at the
    // true start; until it fires, tickSkyRotation holds the sky still.
    _skyRotT0 = performance.now();
    _skyRotWaiting = true;
}

// Exact cubic-bezier(0.25, 0.46, 0.45, 0.94) — the chamber walls' CSS rotation
// curve. The old piecewise-quadratic approximation started slow where the real
// bezier starts fast, so the stars visibly lagged the walls at the beginning of
// every rotation. Newton–Raphson solve of x(t) = progress, then evaluate y(t).
function _rotBezier(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const p1x = 0.25, p1y = 0.46, p2x = 0.45, p2y = 0.94;
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    let t = x;
    for (let i = 0; i < 5; i++) {
        const xt = ((ax * t + bx) * t + cx) * t - x;
        const dxdt = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(xt) < 1e-4 || dxdt === 0) break;
        t -= xt / dxdt;
    }
    return ((ay * t + by) * t + cy) * t;
}

function tickSkyRotation() {
    if (_skyRotStart === _skyRotTarget) return;
    if (_skyRotWaiting) {
        // Hold at the start value until the walls' transition actually begins
        // (transitionstart re-seeds _skyRotT0). If the event never arrives
        // (shouldn't happen — the transition is always in the stylesheet during
        // rotations), fall back to the animateSkyRotation clock after 120ms.
        if (performance.now() - _skyRotT0 < 120) return;
        _skyRotWaiting = false;
    }
    const elapsed = performance.now() - _skyRotT0;
    const progress = Math.min(elapsed / SKY_ROT_DURATION, 1.0);
    const ease = _rotBezier(progress);
    skyRotationOffset = _skyRotStart + (_skyRotTarget - _skyRotStart) * ease;
    if (progress >= 1.0) {
        skyRotationOffset = _skyRotTarget;
        _skyRotStart = _skyRotTarget;
    }
}

// --- Dust motes: a handful of slow-drifting luminous specks in the chamber
// air. Screen-space overlay canvas above the walls (#mote-canvas, z-index 2,
// pointer-events none — styled in prism.css), appended to <body> so chamber
// transforms (archway walk-through zoom) don't scale it. Drawn from the same
// rAF as drawSky at the same cadence. Skipped under prefers-reduced-motion
// and in the ASCII gallery (whose phosphor-digital air stays dustless).
const _motesOn = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    && document.querySelector('.chamber')?.dataset.prismId !== 'ascii-gallery';
let _moteCtx = null, _moteW = 0, _moteH = 0;
const _motes = [];
(function initMotes() {
    if (!_motesOn) return;
    const cv = document.createElement('canvas');
    cv.id = 'mote-canvas';
    document.body.appendChild(cv);
    function sizeMotes() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        _moteW = window.innerWidth; _moteH = window.innerHeight;
        cv.width = _moteW * dpr; cv.height = _moteH * dpr;
        _moteCtx = cv.getContext('2d');
        _moteCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    sizeMotes();
    window.addEventListener('resize', sizeMotes);
    const n = Math.max(14, Math.min(34, Math.round(_moteW * _moteH / 36000)));
    for (let i = 0; i < n; i++) {
        _motes.push({
            x: Math.random() * _moteW,
            y: Math.random() * _moteH,
            vx: (Math.random() - 0.5) * 16,       // lateral drift
            vy: -3 - Math.random() * 9,           // upward drift (candle-warmed air)
            wP: Math.random() * Math.PI * 2,      // sway phase
            wS: 0.3 + Math.random() * 0.7,        // sway speed
            s: 1 + Math.random() * 1.4,           // hard pinprick, px
            aP: Math.random() * Math.PI * 2,      // glint phase
            aS: 0.3 + Math.random() * 0.8,        // glint cycle speed
            a: 0.35 + Math.random() * 0.35,       // glint peak alpha
        });
    }
})();

// Real dust: tiny hard pinpricks tumbling on air currents, near-invisible until
// a facet catches the light for a moment. Baseline alpha is very low; a sharp
// pow() envelope gives each mote a brief glint every ~6–20s, so somewhere in
// the chamber something faintly catches the light every second or two.
function drawMotes(t, dt) {
    if (!_moteCtx || !_motes.length) return;
    const ctx = _moteCtx;
    ctx.clearRect(0, 0, _moteW, _moteH);
    const ts = t * 0.001;
    const mg = 12; // wrap margin
    for (const m of _motes) {
        // Drift + sway, with a touch of Brownian jitter so paths tumble
        m.vx += (Math.random() - 0.5) * 30 * dt;
        m.vy += (Math.random() - 0.5) * 30 * dt;
        m.vx = Math.max(-22, Math.min(22, m.vx));
        m.vy = Math.max(-18, Math.min(6, m.vy));
        m.x += (m.vx + Math.sin(ts * m.wS + m.wP) * 7) * dt;
        m.y += (m.vy + Math.cos(ts * m.wS * 0.8 + m.wP) * 4) * dt;
        if (m.x < -mg) m.x = _moteW + mg; else if (m.x > _moteW + mg) m.x = -mg;
        if (m.y < -mg) m.y = _moteH + mg; else if (m.y > _moteH + mg) m.y = -mg;
        const glint = Math.pow(Math.max(0, Math.sin(ts * m.aS + m.aP)), 10);
        const alpha = m.a * (0.28 + 0.9 * glint);
        ctx.globalAlpha = Math.min(0.85, alpha);
        ctx.fillStyle = 'rgb(255, 249, 235)';
        // The dust belongs to the chamber, not the screen: pan with the same
        // rotation/tilt offsets as the star field (under pure rotation about
        // the viewer, near and far content shifts equally in angle), wrapping
        // at the viewport like the stars do.
        const drawX = ((m.x + skyRotationOffset * _moteW) % _moteW + _moteW) % _moteW;
        const drawY = ((m.y + skyTiltOffset * _moteH) % _moteH + _moteH) % _moteH;
        ctx.fillRect(drawX, drawY, m.s, m.s);
    }
    ctx.globalAlpha = 1;
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

let _lastSkyDrawT = 0;
function drawSky(t) {
    skyFrame++;
    tickSkyRotation();
    // Render every frame while the sky is MOVING — either a wall rotation
    // (skyRotationOffset animating) or a heavens tilt (_skyAnimFrame drives
    // skyTiltOffset in the same rAF as the chamber transform). Otherwise
    // throttle to every 3rd frame. The old check ignored tilts, so stars
    // repainted at 20fps while the walls moved at 60 — visible lag.
    const skyRotating = _skyRotStart !== _skyRotTarget;
    const skyMoving = skyRotating || _skyAnimFrame !== null;
    if (!skyMoving && skyFrame % 3 !== 0) { requestAnimationFrame(drawSky); return; }
    // Real elapsed time since the last DRAWN frame (skipped frames accumulate),
    // so meteor/cloud speeds are correct at both 20fps and 60fps.
    const dt = _lastSkyDrawT ? Math.min(0.1, (t - _lastSkyDrawT) / 1000) : 1 / 60;
    _lastSkyDrawT = t;
    const w = skyW, h = skyH;

    if (isNight) {
        skyCtx.fillStyle = '#000000';
        skyCtx.fillRect(0, 0, w, h);

        // Film-grain noise: skipped while the sky is moving — 200 fillRects of
        // random static are invisible during motion but cost real main-thread
        // time exactly when the walls' compositor transition needs it least.
        if (!skyMoving) {
            for (let i = 0; i < 200; i++) {
                const seed = i * 73.137 + skyFrame * 0.01;
                const nx = ((Math.sin(seed * 1.31) * 0.5 + 0.5) * w + Math.random() * 3) % w;
                const ny = ((Math.cos(seed * 0.97) * 0.5 + 0.5) * h + Math.random() * 3) % h;
                const pal = nightPalette[i % nightPalette.length];
                const a = 0.06 + Math.random() * 0.12;
                skyCtx.fillStyle = `rgba(${pal[0]},${pal[1]},${pal[2]},${a})`;
                skyCtx.fillRect(nx, ny, 1, 1);
            }
        }

        skyCtx.textAlign = 'center';
        skyCtx.textBaseline = 'middle';
        skyStars.forEach(s => {
            // Fixed firmament: stars hold their positions permanently and only
            // twinkle — brightness breathes between 45% and 100%, never vanishing.
            const twinkle = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
            const drawAlpha = 0.45 + 0.55 * twinkle;
            skyCtx.font = s.font;
            skyCtx.fillStyle = s.colPre + drawAlpha.toFixed(3) + ')';
            const drawX = ((s.x + skyRotationOffset) % 1.0 + 1.0) % 1.0 * w;
            const drawY = ((s.y + skyTiltOffset) % 1.0 + 1.0) % 1.0 * h;
            skyCtx.fillText(s.sym, drawX, drawY);
        });

        // Moon — real current phase; wraps with chamber rotation like the stars.
        // Rest position (0.62, 0.075) floats it in the deep sky pocket above the
        // facing wall, inside the band visible over the ceiling wedges in normal
        // chamber view (the roofline rises toward the sides); heavens-tilt shifts
        // it down with the rest of the firmament, rotation slides it around.
        {
            const mx = ((0.62 + skyRotationOffset) % 1.0 + 1.0) % 1.0 * w;
            const my = ((0.075 + skyTiltOffset) % 1.0 + 1.0) % 1.0 * h;
            const r = Math.max(15, Math.min(w, h) * 0.034);
            const sprite = moonSprite(r, moonAge01());
            const side = sprite.width / _moonSpriteDpr;
            skyCtx.drawImage(sprite, mx - side / 2, my - side / 2, side, side);
        }

        // Shooting stars — spawned high (top 3–13% of the viewport) on shallow
        // trajectories, so they play out inside the thin band of sky visible
        // above the ceiling wedges in normal chamber view, not just in the big
        // heavens-tilt sky.
        if (!_nextMeteorAtMs) _nextMeteorAtMs = t + 8000 + Math.random() * 20000;
        if (t >= _nextMeteorAtMs) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const ang = 0.25 + Math.random() * 0.35;                    // radians below horizontal
            const speed = (0.55 + Math.random() * 0.5) * Math.max(w, 480);
            _meteors.push({
                x: (0.1 + Math.random() * 0.8) * w,
                y: (0.03 + Math.random() * 0.10) * h,
                vx: Math.cos(ang) * speed * dir,
                vy: Math.sin(ang) * speed * 0.5,
                life: 0,
                dur: 0.7 + Math.random() * 0.5,
                len: 70 + Math.random() * 90,
            });
            _nextMeteorAtMs = t + 16000 + Math.random() * 28000;
        }
        for (let i = _meteors.length - 1; i >= 0; i--) {
            const m = _meteors[i];
            m.life += dt;
            if (m.life >= m.dur) { _meteors.splice(i, 1); continue; }
            m.x += m.vx * dt; m.y += m.vy * dt;
            const p = m.life / m.dur;
            const env = Math.min(p / 0.15, 1) * Math.min((1 - p) / 0.3, 1);
            const sp = Math.hypot(m.vx, m.vy);
            const tailX = m.x - (m.vx / sp) * m.len, tailY = m.y - (m.vy / sp) * m.len;
            const mg = skyCtx.createLinearGradient(m.x, m.y, tailX, tailY);
            mg.addColorStop(0, `rgba(255,252,240,${(0.85 * env).toFixed(3)})`);
            mg.addColorStop(0.25, `rgba(210,220,255,${(0.35 * env).toFixed(3)})`);
            mg.addColorStop(1, 'rgba(210,220,255,0)');
            skyCtx.strokeStyle = mg;
            skyCtx.lineWidth = 1.6;
            skyCtx.lineCap = 'round';
            skyCtx.beginPath(); skyCtx.moveTo(m.x, m.y); skyCtx.lineTo(tailX, tailY); skyCtx.stroke();
            skyCtx.fillStyle = `rgba(255,255,250,${(0.9 * env).toFixed(3)})`;
            skyCtx.beginPath(); skyCtx.arc(m.x, m.y, 1.4, 0, Math.PI * 2); skyCtx.fill();
        }

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
            const cx = ((c.x + skyRotationOffset) % 1.0 + 1.0) % 1.0 * w;
            const cy = ((c.y + skyTiltOffset) % 1.0 + 1.0) % 1.0 * h;
            const sprite = cloudSprite(c);
            skyCtx.drawImage(sprite, cx - c._padX, cy - c._padY,
                sprite.width / c._dpr, sprite.height / c._dpr);
        });
    }

    // Suspend the serpentine-border repaint while the sky moves: it writes CSS
    // custom properties on #wall-area (style invalidation on the very tree the
    // compositor is transitioning) and rebuilds an SVG gradient — a guaranteed
    // main-thread hit right when the walls are gliding. It resumes on arrival;
    // an 800ms pause in the border shimmer is imperceptible.
    if (!isSkyView && !skyMoving && skyFrame % 6 === 0) renderSerpStrip(t * 0.0003);

    if (_motesOn) drawMotes(t, dt);

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
        // Hide archway overlay while text frame is open (it otherwise intercepts
        // mousedown for scroll) — EXCEPT on a door wall (e.g. Research Lab's rescue
        // wall, which is both a word-panel and the door back to the central chamber).
        // There the overlay is the door's only live hit-target and must stay on top
        // of the open frame; otherwise the door goes dead (no "return to centre"
        // tooltip) and clicks in the door zone fall through to the wall text's links.
        const _wallHasDoor = !!window.PRISM_CONFIG?.destinations?.[wallNum];
        if (archwayOverlay && wallNum === getFacingWall() && !_wallHasDoor) {
            archwayOverlay.style.display = 'none';
        }
        updateWallPortraitReader();   // sync the portrait reader if already in portrait
    }
    wordEl.addEventListener('animationend', revealFrame, { once: true });
    setTimeout(revealFrame, 800);
}

function closeFrameOnWall(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const frame = wall.querySelector('.wall-text-frame.visible');
    if (!frame) return;
    if (frame.classList.contains('melting')) return;   // melt already underway
    const panel = frame.closest('.wall-word-panel');
    if (!panel) return;
    const wordEl = panel.querySelector('.wall-word');

    // Melt away rather than vanish: .melting fades the frame (opacity only —
    // its base transform differs per chamber, see the wordDissolve slide bug)
    // while the contents sag downward. The word returns once the melt ends.
    const body = frame.querySelector('.wall-text-body');
    if (activeTextBody === body) activeTextBody = null;
    frame.classList.add('melting');
    setTimeout(() => {
        frame.classList.remove('visible', 'melting');
        if (wordEl) {
            wordEl.style.display = '';
            wordEl.classList.remove('dissolving');
        }
    }, FRAME_MELT_MS);
    // Restore archway overlay
    updateArchwayOverlay();
    updateWallPortraitReader();   // drop the portrait reader if its frame just closed
}

// --- Portrait fullscreen wall reader ---------------------------------------
// When a wall textbox is open on the facing wall and the phone is turned to
// portrait, clone that frame into #wall-portrait-reader so the text fills the
// screen (scroll only). Turning back to landscape returns to the chamber, still
// facing that wall with the textbox open. Mirrors the shrine-heavens portrait read.
let _wallPortraitActive = false;
const _wallPortraitMQ = window.matchMedia('(max-width: 900px) and (orientation: portrait)');

function _openFacingFrame() {
    const w = getFacingWall();
    const wall = document.querySelector(`.wall-panel[data-wall="${w}"]`);
    const frame = wall && wall.querySelector('.wall-text-frame.visible');
    return frame || null;
}

function _buildRotateHint() {
    // "rotate to exit" foot note — echoes the OrientationGate's emerald phone glyph.
    const hint = document.createElement('div');
    hint.className = 'wpr-exit-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="wpr-exit-phone"><span class="wpr-exit-phone-dot"></span></span>' +
                     '<span class="wpr-exit-label">rotate to exit</span>';
    return hint;
}

function enterWallPortrait(frame) {
    const overlay = document.getElementById('wall-portrait-reader');
    if (!overlay || !frame) return;
    const clone = frame.cloneNode(true);
    clone.classList.add('visible');   // fire the chamber's .visible styling on the clone
    // Strip the controls that don't belong in portrait (scroll is the only text
    // affordance), but KEEP an enabled video button so a reader can also watch the
    // wall's video. Any disabled/placeholder video button is removed.
    clone.querySelectorAll('.wall-close-btn, .wall-scroll-up, .wall-scroll-down, .wall-video-btn.wall-video-disabled')
        .forEach(el => el.remove());
    // cloneNode drops event listeners, and the chamber's capture-phase click
    // router only covers the walls — so wire the kept video button directly, and
    // mount the video over this fullscreen reader (not the hidden wall behind it).
    const vbtn = clone.querySelector('.wall-video-btn[data-video-src]');
    if (vbtn) {
        vbtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openWallVideo(getFacingWall(), overlay);
        });
    }
    // Foot note: rotate back to landscape to leave (sits below the scrolling body).
    clone.appendChild(_buildRotateHint());
    overlay.replaceChildren(clone);
    const body = clone.querySelector('.wall-text-body');
    if (body) body.scrollTop = 0;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wall-portrait-reading');
    _wallPortraitActive = true;
}

function exitWallPortrait() {
    const overlay = document.getElementById('wall-portrait-reader');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.replaceChildren();
    }
    document.body.classList.remove('wall-portrait-reading');
    _wallPortraitActive = false;
}

function updateWallPortraitReader() {
    if (!document.getElementById('wall-portrait-reader')) return;  // chamber has no word panels
    if (_wallPortraitMQ.matches) {
        const frame = _openFacingFrame();
        if (frame && !_wallPortraitActive) enterWallPortrait(frame);
        else if (!frame && _wallPortraitActive) exitWallPortrait();
    } else if (_wallPortraitActive) {
        exitWallPortrait();
    }
}

_wallPortraitMQ.addEventListener('change', updateWallPortraitReader);
// Some phones settle matchMedia a beat after orientationchange fires.
window.addEventListener('orientationchange', () => setTimeout(updateWallPortraitReader, 140));

// --- Video overlay ---
function _fadeAudioForVideo(out) {
    if (!_audioCtx || !_droneNodes || !_droneNodes.fade) return;
    const now = _audioCtx.currentTime;
    const g = _droneNodes.fade.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(out ? 0 : 1, now + (out ? 3 : 8));
}

// Diagonal opposing-arrows icons: expand (arrows to opposite corners) / collapse
// (arrows to centre). Inline SVG so they render identically everywhere.
const _VIDEO_FS_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
const _VIDEO_FS_COLLAPSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 9h-6V3"/><path d="M3 15h6v6"/><path d="M15 9l6-6"/><path d="M9 15l-6 6"/></svg>';

// Toggle fullscreen for a video overlay. Fullscreens the overlay (so our own
// controls stay visible); falls back to native <video> fullscreen on iOS.
function toggleVideoFullscreen(overlay) {
    if (!overlay) return;
    const video = overlay.querySelector('video');
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    } else if (overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => {});
    } else if (overlay.webkitRequestFullscreen) {
        overlay.webkitRequestFullscreen();
    } else if (video && video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
    }
}

function openWallVideo(wallNum, mount) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    if (!wall) return;
    const videoBtn = wall.querySelector('.wall-video-btn[data-video-src]');
    const src = videoBtn?.dataset?.videoSrc;
    if (!src) return;

    // Where the video overlay mounts. Default = the wall panel (landscape). When
    // called from the portrait fullscreen reader, mount is that reader overlay, so
    // the video plays over it instead of on the hidden wall behind it.
    const host = mount || wall;

    // Close the wall's text frame only in the normal (wall) case. In portrait we
    // leave it open — closing it would tear the portrait reader down mid-open, and
    // we want it still open when the user rotates back to landscape.
    if (!mount) closeFrameOnWall(wallNum);

    // Remove any existing overlay on the host
    const existing = host.querySelector('.wall-video-overlay');
    if (existing) existing.remove();

    // Fade chamber audio out before video plays
    _fadeAudioForVideo(true);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'wall-video-overlay';
    overlay.innerHTML = `
        <button class="wall-video-fs" type="button" aria-label="Fullscreen" title="Fullscreen"></button>
        <button class="wall-video-close" type="button" aria-label="Close video">×</button>
        <div class="wall-video-loader">
            <div class="hourglass"></div>
            <div class="hourglass-label">loading</div>
        </div>
    `;
    host.appendChild(overlay);

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

    // Wait for audio fade-out to nearly finish, then start video
    const openedAt = performance.now();
    video.addEventListener('canplay', () => {
        const elapsed = performance.now() - openedAt;
        const remaining = Math.max(0, 2700 - elapsed);
        setTimeout(() => {
            const loader = overlay.querySelector('.wall-video-loader');
            if (loader) loader.remove();
            video.style.display = '';
            video.play().catch(() => {});
        }, remaining);
    }, { once: true });

    // Fade audio back in when video ends naturally
    video.addEventListener('ended', () => {
        _fadeAudioForVideo(false);
    }, { once: true });

    // Close button
    const closeBtn = overlay.querySelector('.wall-video-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeVideoOverlay(overlay);
    });

    // Fullscreen toggle (upper-left). Fullscreens the whole overlay so our own
    // ×/⛶ controls stay visible (and the ⛶ becomes the "return to the wall"
    // affordance); falls back to native video fullscreen on iOS, which can only
    // fullscreen the <video> itself.
    // Fullscreen toggle (the capture-phase router also routes clicks here for the
    // wall overlay; this direct listener covers the portrait-reader overlay, which
    // the router doesn't reach).
    const fsBtn = overlay.querySelector('.wall-video-fs');
    fsBtn.innerHTML = _VIDEO_FS_EXPAND;
    fsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoFullscreen(overlay);
    });
    // Reflect state on the icon; self-cleans once the overlay is gone.
    const onFsChange = () => {
        if (!document.body.contains(overlay)) {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
            return;
        }
        const on = (document.fullscreenElement || document.webkitFullscreenElement) === overlay;
        fsBtn.innerHTML = on ? _VIDEO_FS_COLLAPSE : _VIDEO_FS_EXPAND;
        fsBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
        fsBtn.setAttribute('aria-label', fsBtn.title);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
}

// Close a specific video overlay wherever it's mounted (wall panel or the
// portrait reader). The close button keeps a direct reference to its overlay,
// so this works regardless of where the video was opened.
function closeVideoOverlay(overlay) {
    if (!overlay) return;
    // If we're closing while this overlay is fullscreen, drop out of fullscreen first.
    if ((document.fullscreenElement || document.webkitFullscreenElement) === overlay) {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
    const video = overlay.querySelector('video');
    if (video) { video.pause(); video.src = ''; }
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    // Fade chamber audio back in
    _fadeAudioForVideo(false);
}

function closeWallVideo(wallNum) {
    const wall = document.querySelector(`.wall-panel[data-wall="${wallNum}"]`);
    closeVideoOverlay(wall && wall.querySelector('.wall-video-overlay'));
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

// The frame controls (×, ▲, ▼) sit at a frame's right edge and can straddle the
// X-zone boundary used by wallFromScreenX — so a cursor on a button's right half
// would route to the wrong wall and miss. Hit-test every visible frame's controls
// by their own rect (facing wall first for rect accuracy), independent of zone, so
// the whole button is responsive. Returns { wallNum, frame, action } or null.
function hitFrameControl(x, y) {
    const facing = String(getFacingWall());
    const frames = [...document.querySelectorAll('.wall-text-frame.visible')];
    frames.sort((a, b) => {
        const af = a.closest('.wall-panel')?.dataset.wall === facing ? 0 : 1;
        const bf = b.closest('.wall-panel')?.dataset.wall === facing ? 0 : 1;
        return af - bf;
    });
    const M = 8; // generous margin so the whole button (and a little beyond) responds
    for (const frame of frames) {
        const panel = frame.closest('.wall-panel');
        if (!panel) continue;
        const wallNum = parseInt(panel.dataset.wall, 10);
        for (const [sel, action] of [['.wall-close-btn', 'close'],
                                     ['.wall-scroll-up', 'up'],
                                     ['.wall-scroll-down', 'down']]) {
            const btn = frame.querySelector(sel);
            if (!btn) continue;
            const r = btn.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (x >= r.left - M && x <= r.right + M && y >= r.top - M && y <= r.bottom + M) {
                return { wallNum, frame, action };
            }
        }
    }
    return null;
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
    // Portrait fullscreen reader: let native handling (link taps, scroll) through —
    // the 3D wall router must not hijack clicks inside the overlay.
    if (e.target.closest && e.target.closest('#wall-portrait-reader')) return;
    const _now = Date.now();
    if (_now - _lastClickTime < 350) return;
    _lastClickTime = _now;
    if (e.target.closest('.archway-click-overlay, .nav-arrow, .prism-minimap, .sky-toggle')) return;

    // Lectern zoom mode: click outside the artwork → close; inside → reset idle
    // timer. Clicks landing on the zoom controls (slider, +/-, close X) are
    // handled by their own listeners — let them through without intercepting
    // so the slider's mouse-drag works normally.
    if (_lecternZoomed && !_lecternZoomTransitioning) {
        if (e.target.closest && e.target.closest('.lectern-zoom-controls')) {
            _startLecternIdleTimer();
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        const overlay = document.getElementById('lectern-zoom-overlay');
        const img = overlay?.querySelector('.lectern-zoom-img');
        if (img) {
            const r = img.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right &&
                           e.clientY >= r.top  && e.clientY <= r.bottom;
            if (!inside) leaveLecternZoom();
            else _startLecternIdleTimer();
        } else {
            leaveLecternZoom();
        }
        return;
    }

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
            // The ▲/▼ arrows overlap the top/bottom of the scroll viewport. Hit-test
            // them first: when the list overflows, a clipped off-screen item keeps a
            // real bounding rect beneath the arrow, so otherwise the arrow opens a
            // (seemingly random) transmission instead of scrolling.
            const arrows = [
                [document.querySelector('.results-scroll-up'), -1],
                [document.querySelector('.results-scroll-down'), 1],
            ];
            for (const [btn, dir] of arrows) {
                if (!btn) continue;
                const r = btn.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    e.stopPropagation();
                    e.preventDefault();
                    // Skip the per-row click scroll when this click is the tail of a
                    // press-and-hold (mousedown already started continuous scrolling).
                    if (!_scrollBtnHeld) resultsEl.scrollBy({ top: dir * resultsRowStep(resultsEl), behavior: 'smooth' });
                    return;
                }
            }
            // Only items inside the visible viewport are clickable — overflowing items
            // are clipped on screen but keep real (off-screen) bounding rects.
            const vp = resultsEl.getBoundingClientRect();
            if (e.clientX >= vp.left && e.clientX <= vp.right &&
                e.clientY >= vp.top  && e.clientY <= vp.bottom) {
                for (const el of resultsEl.querySelectorAll('.wall-search-result')) {
                    const r = el.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right &&
                        e.clientY >= r.top  && e.clientY <= r.bottom) {
                        e.stopPropagation();
                        e.preventDefault();
                        const idx = parseInt(el.dataset.matchIndex || '', 10);
                        const item = Number.isFinite(idx) ? shrineSearchResultsSnapshot[idx] : null;
                        if (item) enterShrineHeavens(item);
                        return;
                    }
                }
            }
        }
    }

    // ASCII portal orb (Scriptorium wall 1) — manual hit-test for the same reason.
    if (typeof hitTestAsciiOrb === 'function' && hitTestAsciiOrb(e.clientX, e.clientY)) {
        e.stopPropagation();
        e.preventDefault();
        triggerAsciiPortal();
        return;
    }

    // ASCII gallery lectern close-button — must check before the book itself,
    // since the X sits inside the book element's bounding rect when projected.
    if (typeof hitTestLecternClose === 'function' && hitTestLecternClose(e.clientX, e.clientY)) {
        e.stopPropagation();
        e.preventDefault();
        meltLectern();
        return;
    }

    // ASCII gallery lectern (centred in chamber) — manual hit-test on the book element.
    if (typeof hitTestLectern === 'function' && hitTestLectern(e.clientX, e.clientY)) {
        e.stopPropagation();
        e.preventDefault();
        triggerLecternZoom();
        return;
    }

    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const wr = wallArea.getBoundingClientRect();
    if (e.clientX < wr.left || e.clientX > wr.right ||
        e.clientY < wr.top  || e.clientY > wr.bottom) return;

    // Frame controls first, by their own rect (zone-independent) — fixes ×/▲/▼
    // near the wall-zone boundary being unresponsive on one side.
    if (!document.querySelector('.wall-video-overlay.visible')) {
        const ctrl = hitFrameControl(e.clientX, e.clientY);
        if (ctrl) {
            e.stopPropagation();
            e.preventDefault();
            if (ctrl.action === 'close') { closeFrameOnWall(ctrl.wallNum); return; }
            // up/down: skip the per-row step if this click tails a press-and-hold
            if (!_scrollBtnHeld) scrollWall(ctrl.wallNum, ctrl.action);
            return;
        }
    }

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
        // Fullscreen toggle (upper-left) — must be checked BEFORE the outside-video
        // close below, since the ⛶ sits in the dark margin outside the video and
        // would otherwise be read as "click outside → close". stopPropagation keeps
        // the button's own listener from also firing (which would toggle twice).
        const vFs = videoOverlay.querySelector('.wall-video-fs');
        if (vFs) {
            const r = vFs.getBoundingClientRect();
            if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 &&
                e.clientY >= r.top - 8  && e.clientY <= r.bottom + 8) {
                e.stopPropagation();
                toggleVideoFullscreen(videoOverlay);
                return;
            }
        }
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
            // Remember this candle across visits (index among ALL shrine candles,
            // not just the unlit ones this handler queried).
            rememberShrineCandle(
                Array.from(wall.querySelectorAll('.shrine-candle')).indexOf(closest)
            );
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
    if (e.target.closest && e.target.closest('#wall-portrait-reader')) return;
    const wallArea = document.getElementById('wall-area');
    if (!wallArea) return;
    const wr = wallArea.getBoundingClientRect();
    if (e.clientX < wr.left || e.clientX > wr.right ||
        e.clientY < wr.top  || e.clientY > wr.bottom) return;
    // Shrine search-results ▲/▼ arrows: press-and-hold for continuous scroll.
    // (Chrome won't route events to these 3D children, so hit-test by rect.)
    {
        const resultsEl = document.querySelector('.wall-search-results');
        if (resultsEl) {
            for (const [btn, dir] of [[document.querySelector('.results-scroll-up'), -1],
                                      [document.querySelector('.results-scroll-down'), 1]]) {
                if (!btn) continue;
                const r = btn.getBoundingClientRect();
                if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 &&
                    e.clientY >= r.top - 4  && e.clientY <= r.bottom + 4) {
                    e.preventDefault();
                    _scrollBtnHeld = true;
                    startContinuousScroll(resultsEl, dir);
                    return;
                }
            }
        }
    }
    // Text-frame ▲/▼ press-and-hold — hit-test by the button's own rect (facing
    // wall first) so the whole button responds regardless of X-zone.
    if (!document.querySelector('.wall-video-overlay.visible')) {
        const ctrl = hitFrameControl(e.clientX, e.clientY);
        if (ctrl && (ctrl.action === 'up' || ctrl.action === 'down')) {
            const body = ctrl.frame.querySelector('.wall-text-body');
            if (body) {
                e.preventDefault();
                _scrollBtnHeld = true;
                startContinuousScroll(body, ctrl.action === 'up' ? -1 : 1);
                return;
            }
        }
        if (ctrl && ctrl.action === 'close') return; // close handled on click; don't start a drag
    }
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

// --- ASCII Portal Orb (Scriptorium wall 1) ---
// A larger sibling of the aleph orb, churning compound "ASCII molecules" inside.
// Clicking it fades out the poetry and reveals an archway portal to the ASCII gallery.
// 100+ compound glyph clusters — mandalas, lattices, sigils, snowflakes, atoms.
const ASCII_ORB_MOLECULES = [
    // -- mandalas (cross-and-star symmetries) --
    ['   ✧   ', '  ╱│╲  ', ' ─◈◉◈─ ', '  ╲│╱  ', '   ✧   '],
    ['  ⊹∘⊹  ', '  ╲│╱  ', ' ─ ◉ ─ ', '  ╱│╲  ', '  ⊹∘⊹  '],
    ['  ✦✦✦  ', ' ✧╱│╲✧ ', ' ─◈◉◈─ ', ' ✧╲│╱✧ ', '  ✦✦✦  '],
    ['  ⋆⋆⋆  ', ' ⋆╲│╱⋆ ', ' ──⊙── ', ' ⋆╱│╲⋆ ', '  ⋆⋆⋆  '],
    ['   ❋   ', '  ╲│╱  ', '  ─⊙─  ', '  ╱│╲  ', '   ❋   '],
    ['  ✶ ✶  ', ' ╲ │ ╱ ', ' ─◉◉◉─ ', ' ╱ │ ╲ ', '  ✶ ✶  '],
    ['  ✷✷✷  ', ' ✷◇◇◇✷ ', ' ◇⊛◉⊛◇ ', ' ✷◇◇◇✷ ', '  ✷✷✷  '],
    ['  ✸ ✸  ', '  ╱╳╲  ', ' ─⊕◉⊕─ ', '  ╲╳╱  ', '  ✸ ✸  '],
    ['   ⊹   ', '  ╲│╱  ', ' ⋆─◉─⋆ ', '  ╱│╲  ', '   ⊹   '],
    ['  ⊹⊹⊹  ', ' ⊹ ◈ ⊹ ', '⊹◈ ◉ ◈⊹', ' ⊹ ◈ ⊹ ', '  ⊹⊹⊹  '],

    // -- hexagons & benzene --
    ['  ⬡ ⬡  ', ' ⬡ ◉ ⬡ ', ' ⬡ ⊙ ⬡ ', ' ⬡ ◉ ⬡ ', '  ⬡ ⬡  '],
    ['   ⬢   ', '  ⬢⬢⬢  ', ' ⬢ ✦ ⬢ ', '  ⬢⬢⬢  ', '   ⬢   '],
    ['  ⌬⌬⌬  ', ' ⌬◉ ◉⌬ ', '⌬◉ ⊹ ◉⌬', ' ⌬◉ ◉⌬ ', '  ⌬⌬⌬  '],
    ['  ⌬ ⌬  ', ' ─⌬◉⌬─ ', ' ⌬⊕⊙⊕⌬ ', ' ─⌬◉⌬─ ', '  ⌬ ⌬  '],
    ['  ⬣⬣⬣  ', ' ⬣ ◈ ⬣ ', ' ⬣ ✦ ⬣ ', ' ⬣ ◈ ⬣ ', '  ⬣⬣⬣  '],
    ['  ╱⬡╲  ', ' ⬡ ⬡ ⬡ ', ' ─⬡◉⬡─ ', ' ⬡ ⬡ ⬡ ', '  ╲⬡╱  '],
    ['   ⬡   ', '  ╱ ╲  ', ' ─⬡◉⬡─ ', '  ╲ ╱  ', '   ⬡   '],
    ['  ⬢◉⬢  ', ' ⬢◉ ◉⬢ ', ' ◉◉◉◉◉ ', ' ⬢◉ ◉⬢ ', '  ⬢◉⬢  '],
    ['  ⌬─⌬  ', ' │ ◉ │ ', ' ⌬─⊙─⌬ ', ' │ ◉ │ ', '  ⌬─⌬  '],
    ['  ⊛⬡⊛  ', ' ⬡◈◉◈⬡ ', ' ⊛⬡◉⬡⊛ ', ' ⬡◈◉◈⬡ ', '  ⊛⬡⊛  '],

    // -- crosses, lattices, framed grids --
    [' ╳ │ ╳ ', ' ─◈⋆◈─ ', ' ╳ ◉ ╳ ', ' ─◈⋆◈─ ', ' ╳ │ ╳ '],
    [' ┌─┬─┐ ', ' │ │ │ ', ' ├─◉─┤ ', ' │ │ │ ', ' └─┴─┘ '],
    [' ╔═╦═╗ ', ' ╠═╬═╣ ', ' ║ ✦ ║ ', ' ╠═╬═╣ ', ' ╚═╩═╝ '],
    [' ┏━┳━┓ ', ' ┣━╋━┫ ', ' ┃ ◉ ┃ ', ' ┣━╋━┫ ', ' ┗━┻━┛ '],
    [' ╱─┬─╲ ', ' │ ⊙ │ ', ' ├─◉─┤ ', ' │ ⊙ │ ', ' ╲─┴─╱ '],
    ['  ╋╋╋  ', '  ╋⊕╋  ', '  ╋◉╋  ', '  ╋⊕╋  ', '  ╋╋╋  '],
    [' ╳ ─ ╳ ', ' ─ ╳ ─ ', ' ╳ ◉ ╳ ', ' ─ ╳ ─ ', ' ╳ ─ ╳ '],
    [' │ │ │ ', ' ─◈─◈─ ', ' │ ◉ │ ', ' ─◈─◈─ ', ' │ │ │ '],
    [' ●─●─● ', ' │   │ ', ' ●─◉─● ', ' │   │ ', ' ●─●─● '],
    [' ╔═══╗ ', ' ║◇◉◇║ ', ' ║─⊙─║ ', ' ║◇◉◇║ ', ' ╚═══╝ '],

    // -- snowflakes --
    ['   ❅   ', '  ❅❅❅  ', ' ❅❅❉❅❅ ', '  ❅❅❅  ', '   ❅   '],
    ['   ❆   ', '  ╲│╱  ', '  ─❉─  ', '  ╱│╲  ', '   ❆   '],
    ['  ❅ ❅  ', ' ❅╱│╲❅ ', ' ─❉◉❉─ ', ' ❅╲│╱❅ ', '  ❅ ❅  '],
    ['  ❄ ❄  ', ' ╲ │ ╱ ', '  ─❄─  ', ' ╱ │ ╲ ', '  ❄ ❄  '],
    ['  ❉❉❉  ', ' ❉╳│╳❉ ', ' ─❅◉❅─ ', ' ❉╳│╳❉ ', '  ❉❉❉  '],
    ['   ❇   ', ' ╲ ❇ ╱ ', ' ❇ ❄ ❇ ', ' ╱ ❇ ╲ ', '   ❇   '],
    ['  ❄═❄  ', ' ║◈◉◈║ ', ' ❄═◉═❄ ', ' ║◈◉◈║ ', '  ❄═❄  '],
    [' ✶ ❅ ✶ ', '  ╲│╱  ', ' ❅─❉─❅ ', '  ╱│╲  ', ' ✶ ❅ ✶ '],
    ['   ❊   ', '  ❅❄❅  ', ' ❅❄❉❄❅ ', '  ❅❄❅  ', '   ❊   '],
    ['  ❁ ❁  ', ' ─❉◉❉─ ', '  ╱│╲  ', ' ─❄─❄─ ', '  ❁ ❁  '],

    // -- atoms / orbits / rings --
    ['  ╭─╮  ', ' ╱ ◉ ╲ ', ' │ ⊙ │ ', ' ╲ ◉ ╱ ', '  ╰─╯  '],
    [' ○ ╱─╲ ', '  │ ◉ │  ', ' ○ ╲─╱ '],
    ['  ⊕⊕⊕  ', ' ─◉◉◉─ ', ' ⊕ ⊙ ⊕ ', ' ─◉◉◉─ ', '  ⊕⊕⊕  '],
    ['  ⊗ ⊗  ', '   │   ', '  ─⊕─  ', '   │   ', '  ⊗ ⊗  '],
    ['  ⊚⊚⊚  ', ' ⊚ ◉ ⊚ ', ' ⊚ ⊙ ⊚ ', ' ⊚ ◉ ⊚ ', '  ⊚⊚⊚  '],
    ['  ⊛⊛⊛  ', ' ⊛◇◉◇⊛ ', ' ⊛ ⊙ ⊛ ', ' ⊛◇◉◇⊛ ', '  ⊛⊛⊛  '],
    ['   ⊘   ', '  ╱│╲  ', ' ─◉⊘◉─ ', '  ╲│╱  ', '   ⊘   '],
    ['  ⊜─⊜  ', ' ╲ │ ╱ ', ' ⊜─◉─⊜ ', ' ╱ │ ╲ ', '  ⊜─⊜  '],
    ['   ⊙   ', '  ○ ○  ', ' ○ ⊕ ○ ', '  ○ ○  ', '   ⊙   '],
    ['  ⊕ ⊕  ', ' ⊕ │ ⊕ ', '  ─◉─  ', ' ⊕ │ ⊕ ', '  ⊕ ⊕  '],

    // -- triangles / pyramids --
    ['   △   ', '  △ △  ', ' △ △ △ ', '  △ △  ', '   △   '],
    ['   ▲   ', '  ▲▲▲  ', ' ▲ ✦ ▲ ', '  ▲▲▲  ', '   ▲   '],
    ['   ▽   ', '  ▽▽▽  ', ' ▽ ◉ ▽ ', '  ▽▽▽  ', '   ▽   '],
    [' △ ▽ △ ', ' ▽ ◉ ▽ ', ' △ ◉ △ ', ' ▽ ◉ ▽ ', ' △ ▽ △ '],
    ['  ◁◇▷  ', ' ◁ ◇ ▷ ', ' ◁◇⊙◇▷ ', ' ◁ ◇ ▷ ', '  ◁◇▷  '],
    [' ◇ ◆ ◇ ', ' ◆ ◇ ◆ ', ' ◇ ⊙ ◇ ', ' ◆ ◇ ◆ ', ' ◇ ◆ ◇ '],
    [' ▲ ▼ ▲ ', ' ▼ ◉ ▼ ', ' ▲ ⊙ ▲ ', ' ▼ ◉ ▼ ', ' ▲ ▼ ▲ '],
    ['  ▴▴▴  ', ' ▸ ◈ ◂ ', ' ◈ ✦ ◈ ', ' ▸ ◈ ◂ ', '  ▾▾▾  '],
    ['   ▴   ', '  ▴▴▴  ', ' ▴ ✶ ▴ ', '  ▾▾▾  ', '   ▾   '],
    [' ◁◇◇◇▷ ', ' ◇ ◉ ◇ ', ' ◁◇⊙◇▷ ', ' ◇ ◉ ◇ ', ' ◁◇◇◇▷ '],

    // -- waves / spirals / curls --
    ['  ∮∮∮  ', ' ∮ ⊙ ∮ ', ' ∮ ⊙ ∮ ', ' ∮ ⊙ ∮ ', '  ∮∮∮  '],
    ['  ∾∾∾  ', ' ∾ ◉ ∾ ', ' ∾ ⊕ ∾ ', ' ∾ ◉ ∾ ', '  ∾∾∾  '],
    ['  ∽∽∽  ', ' ∽ ⊛ ∽ ', ' ∽⊛◉⊛∽ ', ' ∽ ⊛ ∽ ', '  ∽∽∽  '],
    ['  ∝∝∝  ', ' ∝ ⊙ ∝ ', ' ∝ ⊕ ∝ ', ' ∝ ⊙ ∝ ', '  ∝∝∝  '],
    [' φ φ φ ', '  ─◉─  ', ' φ ⊕ φ ', '  ─◉─  ', ' φ φ φ '],
    [' ψ ψ ψ ', ' ψ ◉ ψ ', '─ψ ◉ ψ─', ' ψ ◉ ψ ', ' ψ ψ ψ '],
    [' Ω Ω Ω ', ' Ω ◉ Ω ', '  ─⊕─  ', ' Ω ◉ Ω ', ' Ω Ω Ω '],
    ['  ∿∿∿  ', '  ╲│╱  ', '  ─⊙─  ', '  ╱│╲  ', '  ∿∿∿  '],
    ['  ≋≋≋  ', ' ≋ ◉ ≋ ', ' ≋ ⊕ ≋ ', ' ≋ ◉ ≋ ', '  ≋≋≋  '],
    ['  ⌇⌇⌇  ', ' ⌇ ⊙ ⌇ ', ' ⌇ ◉ ⌇ ', ' ⌇ ⊙ ⌇ ', '  ⌇⌇⌇  '],

    // -- eyes / talismans / heraldic --
    ['  ─◉─  ', ' ─ ⊙ ─ ', ' ◉ ⊕ ◉ ', ' ─ ⊙ ─ ', '  ─◉─  '],
    [' ╲◇╱ ',   ' ─◉─ ',   ' ╱◇╲ '],
    [' ⊙ ◉ ⊙ ', ' ─◉⊕◉─ ', ' ⊙ ◉ ⊙ '],
    ['   ✿   ', '  ⊕◉⊕  ', ' ─⊙─⊙─ ', '  ⊕◉⊕  ', '   ✿   '],
    ['  ☼ ☼  ', ' ☼ ⊙ ☼ ', '  ─◉─  ', ' ☼ ⊙ ☼ ', '  ☼ ☼  '],
    ['   ☉   ', '  ╱│╲  ', ' ◉─⊙─◉ ', '  ╲│╱  ', '   ☉   '],
    ['  ☽ ☾  ', ' ╲ │ ╱ ', '  ─⊙─  ', ' ╱ │ ╲ ', '  ☽ ☾  '],
    ['   ✝   ', '  ─◉─  ', ' ╱✦│✦╲ ', '  ─◉─  ', '   ✝   '],
    [' ☥ ─ ☥ ', '─◉ ⊙ ◉─', ' ☥ ─ ☥ '],
    ['  ▽◉▽  ', ' ◇│◇│◇ ', ' ─⊙─⊙─ ', ' ◇│◇│◇ ', '  ▽◉▽  '],

    // -- floral --
    ['   ❀   ', '  ❀ ❀  ', ' ❀ ⊙ ❀ ', '  ❀ ❀  ', '   ❀   '],
    ['  ❁ ❁  ', ' ❁ ◉ ❁ ', ' ❁ ⊕ ❁ ', ' ❁ ◉ ❁ ', '  ❁ ❁  '],
    ['   ✿   ', '  ╲│╱  ', ' ✿ ⊙ ✿ ', '  ╱│╲  ', '   ✿   '],
    ['  ❃ ❃  ', ' ╲ ❃ ╱ ', ' ❉ ◉ ❉ ', ' ╱ ❃ ╲ ', '  ❃ ❃  '],
    ['  ✾ ✾  ', ' ✾ ◉ ✾ ', '  ─⊕─  ', ' ✾ ◉ ✾ ', '  ✾ ✾  '],
    ['  ❊❊❊  ', ' ❊ ◈ ❊ ', ' ❊◈◉◈❊ ', ' ❊ ◈ ❊ ', '  ❊❊❊  '],
    ['  ❀╳❀  ', ' ❀◉◉◉❀ ', ' ╳ ⊕ ╳ ', ' ❀◉◉◉❀ ', '  ❀╳❀  '],
    ['  ✺ ✺  ', ' ✺ ⊙ ✺ ', ' ✺ ⊕ ✺ ', ' ✺ ⊙ ✺ ', '  ✺ ✺  '],
    ['   ❅   ', '  ✿✿✿  ', ' ✿ ⊙ ✿ ', '  ✿✿✿  ', '   ❅   '],
    ['  ❇ ❇  ', ' ❀◇◉◇❀ ', ' ─❉◉❉─ ', ' ❀◇◉◇❀ ', '  ❇ ❇  '],

    // -- constellations & sparse scatter --
    [' · · · ', ' ⋆ ◉ ⋆ ', ' · ⊙ · ', ' ⋆ ◉ ⋆ ', ' · · · '],
    [' ∘ ⋆ ∘ ', ' ⋆ ⊙ ⋆ ', ' ∘⋆⋆⋆∘ ', ' ⋆ ⊙ ⋆ ', ' ∘ ⋆ ∘ '],
    [' ✦ ✧ ✦ ', ' ✧ ◉ ✧ ', '  ⊙   ', ' ✧ ◉ ✧ ', ' ✦ ✧ ✦ '],
    ['  ∴∵∴  ', ' ∵ ◉ ∵ ', '  ⊙    ', ' ∵ ◉ ∵ ', '  ∴∵∴  '],
    ['  ⁘⁙⁜  ', ' ⁘ ⊙ ⁘ ', '  ⁙⁜⁙  ', ' ⁘ ⊙ ⁘ ', '  ⁘⁙⁜  '],
    ['  ∷∷∷  ', ' ∷ ◉ ∷ ', '  ─⊕─  ', ' ∷ ◉ ∷ ', '  ∷∷∷  '],
    ['  ⋮⋮⋮  ', ' ⋮ ⊙ ⋮ ', ' ⋯ ⊕ ⋯ ', ' ⋮ ⊙ ⋮ ', '  ⋮⋮⋮  '],
    [' ⊹ ⊹ ⊹ ', ' ⊹ ⊙ ⊹ ', ' ─⊹◉⊹─ ', ' ⊹ ⊙ ⊹ ', ' ⊹ ⊹ ⊹ '],
    ['  ⋆ ⋆  ', ' ⋆ ⊙ ⋆ ', ' ⋆ ⊕ ⋆ ', ' ⋆ ⊙ ⋆ ', '  ⋆ ⋆  '],
    [' · ⋆ · ', ' ⋆ · ⋆ ', ' · ⊙ · ', ' ⋆ · ⋆ ', ' · ⋆ · '],

    // -- knots / weaves --
    [' ╳ ╳ ╳ ', ' ◇ ◉ ◇ ', ' ╲╳╳╳╱ ', ' ◇ ◉ ◇ ', ' ╳ ╳ ╳ '],
    ['  ╲╱╲  ', '   ╳   ', '  ╱╲╱  ', '   ⊙   ', '  ╲╱╲  '],
    [' ╱╲╱╲ ',  ' ╲╱╲╱ ',  '  ⊕◉⊕  ', ' ╱╲╱╲ ',  ' ╲╱╲╱ '],
    ['  ⊛─⊛  ', ' ⊛   ⊛ ', '  ─◉─  ', ' ⊛   ⊛ ', '  ⊛─⊛  '],
    ['  ⊕═⊕  ', ' ║◉◉◉║ ', ' ⊕═⊙═⊕ ', ' ║◉◉◉║ ', '  ⊕═⊕  '],
    [' ★ ⊕ ★ ', ' ⊕ ⊙ ⊕ ', ' ★ ◉ ★ ', ' ⊕ ⊙ ⊕ ', ' ★ ⊕ ★ '],
    [' ✦═╦═✦ ', ' ╠═◉═╣ ', ' ✦═╩═✦ '],
    ['  ◐◑◐  ', ' ◑ ⊙ ◑ ', '  ◐◉◐  ', ' ◑ ⊙ ◑ ', '  ◐◑◐  '],
    ['  ◓◒◓  ', ' ◒ ◉ ◒ ', ' ─⊙─⊙─ ', ' ◒ ◉ ◒ ', '  ◓◒◓  '],
    [' ⊕━⊕━⊕ ', '  ┃◉┃  ', ' ⊕━⊙━⊕ ', '  ┃◉┃  ', ' ⊕━⊕━⊕ '],

    // -- chiral / asymmetric drifts --
    ['  ◉    ', ' ╲│    ', '  ─⊙─  ', '    │╲ ', '    ◉  '],
    ['    ⋆  ', '  ╱⊙   ', ' ─◉─   ', '  ╲⊙   ', '    ⋆  '],
    [' ✦     ', '  ╲    ', '   ◉   ', '    ╲  ', '     ✦ '],
    [' ★     ', '   ╱   ', '   ◉   ', '   ╱   ', '     ★ '],
    ['  ─◉─  ', ' ◇ ⊙ ◇ ', ' ⊕ ◉ ⊕ ', ' ◇ ⊙ ◇ ', '  ─◉─  '],
    ['     ❅ ', '   ◈   ', '  ─◉─  ', '   ◈   ', ' ❅     '],
    [' ⊹     ', '   ⊙   ', '  ─◉─  ', '   ⊙   ', '     ⊹ '],
    ['  ─◉   ', '    ⊙  ', '  ⊕    ', '    ⊙  ', '   ◉─  '],

    // -- ASCII-art alphabet/sigil constructs (leaning hard into @#$%^&*()) --
    ['  @@@  ', ' @***@ ', ' *#@#* ', ' @***@ ', '  @@@  '],
    ['  #_#  ', ' /***\\ ', ' *#@#* ', ' \\***/ ', '  #_#  '],
    ['  +++  ', ' +*#*+ ', ' #*@*# ', ' +*#*+ ', '  +++  '],
    ['  /^\\  ', ' [***] ', ' {@#@} ', ' [***] ', '  \\v/  '],
    ['  $$$  ', ' (***) ', ' *#@#* ', ' (***) ', '  $$$  '],
    ['  !?!  ', ' /***\\ ', ' *#@#* ', ' \\***/ ', '  !?!  '],
    ['  o-o  ', ' |***| ', ' @-#-@ ', ' |***| ', '  o-o  '],
    ['  ___  ', ' /***\\ ', '|*#@#*|', ' \\___/ ', '       '],
    ['  ===  ', ' ##*## ', ' #*@*# ', ' ##*## ', '  ===  '],
    ['  ^^^  ', ' /***\\ ', ' *@*@* ', ' \\***/ ', '  vvv  '],

    // -- compass / runic --
    ['   N   ', '  \\|/  ', ' W-+-E ', '  /|\\  ', '   S   '],
    ['  /+\\  ', ' (***) ', ' #*@*# ', ' (***) ', '  \\+/  '],
    ['  ###  ', '  /|\\  ', ' #-@-# ', '  \\|/  ', '  ###  '],
    ['  XXX  ', ' X***X ', ' X*@*X ', ' X***X ', '  XXX  '],
    [' *0*0* ', '  ***  ', '  0@0  ', '  ***  ', ' *0*0* '],

    // -- circuit / lattice --
    ['  +-+  ', ' |***| ', ' +*@*+ ', ' |***| ', '  +-+  '],
    ['  [_]  ', ' /|||\\ ', '<-*@*->', ' \\|||/ ', '  [_]  '],
    [' ___|_ ', '|*****|', '|*#@#*|', '|*****|', ' _|___ '],
    [' .*.*. ', ' .#@#. ', ' .*.*. ', ' .#@#. ', ' .*.*. '],
    ['  /=\\  ', ' #|||# ', ' ##@## ', ' #|||# ', '  \\=/  '],

    // -- punctuation drifts --
    ['  ..:  ', ' .***. ', ' :*@*: ', ' .***. ', '  :..  '],
    [' ~~~~~ ', ' ~*#*~ ', ' #*@*# ', ' ~*#*~ ', ' ~~~~~ '],
    ['   ;   ', '  :;:  ', ' ;:@:; ', '  :;:  ', '   ;   '],
    ['  ;-;  ', ' ;***; ', ' ;*@*; ', ' ;***; ', '  ;-;  '],
    ['  !!!  ', ' !***! ', ' !*@*! ', ' !***! ', '  !!!  '],

    // -- numeric / alphabet constructs --
    ['   8   ', '  808  ', ' 80@08 ', '  808  ', '   8   '],
    ['  010  ', ' 01*10 ', ' 1*@*1 ', ' 01*10 ', '  010  '],
    ['  ABC  ', ' A***C ', ' A*@*C ', ' A***C ', '  ABC  '],
    [' 7 5 3 ', ' 5***3 ', ' 3*@*5 ', ' 5***3 ', ' 7 5 3 '],
    ['  H-H  ', ' H***H ', ' H*@*H ', ' H***H ', '  H-H  '],

    // -- glitchy / dense ASCII --
    ['#######', '#*#*#*#', '#*#@#*#', '#*#*#*#', '#######'],
    [' /\\/\\/ ', ' \\/\\/\\ ', ' /\\@/\\ ', ' \\/\\/\\ ', ' /\\/\\/ '],
    ['  ?!?  ', ' ?***? ', ' !*@*! ', ' ?***? ', '  ?!?  '],
    ['  <>< ',  ' >*<*> ', ' <*@*> ', ' >*<*> ', '  ><>  '],
    ['  ($)  ', ' $***$ ', ' $*@*$ ', ' $***$ ', '  ($)  '],
];

let _asciiPortalOpened = false;
function triggerAsciiPortal() {
    if (_asciiPortalOpened) return;
    const orb = document.querySelector('.ascii-orb');
    if (!orb) return;
    _asciiPortalOpened = true;
    const wallPanel = orb.closest('.wall-panel');
    if (wallPanel) wallPanel.classList.add('ascii-portal-open');
    // Register the destination so the existing archway overlay picks it up
    window.PRISM_CONFIG = window.PRISM_CONFIG || {};
    window.PRISM_CONFIG.destinations = window.PRISM_CONFIG.destinations || {};
    window.PRISM_CONFIG.destinations[1] =
        '/immersive?from=ascii-gallery&dest=/prism/ascii-gallery';
    // Activate the click overlay immediately so the door responds as soon as
    // it starts fading into view — the user shouldn't have to wait for the
    // (now 5.4s) opacity transition to finish before they can click through.
    updateArchwayOverlay();
}

// Used by the document-level click handler to detect orb clicks (Chrome's
// preserve-3d hit-test bug means we can't reliably attach listeners to the orb).
function hitTestAsciiOrb(clientX, clientY) {
    if (_prismId !== 'gpt3-library') return false;
    if (_asciiPortalOpened) return false;
    if (getFacingWall() !== 1) return false;
    const orb = document.querySelector('.ascii-orb');
    if (!orb) return false;
    const r = orb.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right ||
        clientY < r.top  || clientY > r.bottom) return false;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const radius = Math.min(r.right - r.left, r.bottom - r.top) / 2;
    const dx = clientX - cx, dy = clientY - cy;
    return (dx * dx + dy * dy) <= (radius * radius);
}

function initAsciiOrb() {
    const orb = document.querySelector('.ascii-orb');
    if (!orb) return;
    const glyphsEl = orb.querySelector('.ascii-orb-glyphs');
    if (!glyphsEl) return;

    let idx = Math.floor(Math.random() * ASCII_ORB_MOLECULES.length);
    function render() {
        glyphsEl.style.opacity = '0';
        setTimeout(() => {
            // Pick a random new molecule each step (not sequential) so the
            // alphanumeric / @#$%-heavy entries surface immediately rather
            // than appearing only after walking through the array in order.
            // Avoid repeating the current one back-to-back.
            let next = Math.floor(Math.random() * ASCII_ORB_MOLECULES.length);
            if (next === idx) next = (next + 1) % ASCII_ORB_MOLECULES.length;
            idx = next;
            glyphsEl.textContent = ASCII_ORB_MOLECULES[idx].join('\n');
            glyphsEl.style.opacity = '';
        }, 220);
    }
    glyphsEl.textContent = ASCII_ORB_MOLECULES[idx].join('\n');
    // ~3x faster cycle than before (was 2400ms) so the variety reads quickly.
    setInterval(render, 800);
}

if (_prismId === 'gpt3-library') {
    initAsciiOrb();
}

// --- ASCII Gallery: per-wall ASCII swarm player + lectern page ---
// Loads pre-rendered animations from /data/ascii-swarms.json (one per wall,
// each a different algorithm — boids, sonar, matrix-rain, Conway, noise
// bands, glitch scan). Each wall starts at a random frame offset so the
// chamber looks different on every visit. Brightness is implicit in the
// character glyph itself — no per-cell opacity, just textContent diffs —
// which makes playback nearly free (no JS simulation hogging the main
// thread, so the prism rotation stays smooth).
function initAsciiSwarmPlayer() {
    const overlays = Array.from(document.querySelectorAll('.ascii-wall-overlay'));
    if (overlays.length === 0) return;
    fetch('/data/ascii-swarms.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(setup)
        .catch(err => console.warn('[ascii-swarm] failed to load', err));

    function setup(payload) {
        const { fps, w, h, frameSize, walls: wallData } = payload;
        const N = w * h;
        if (frameSize !== N) {
            console.warn('[ascii-swarm] frameSize mismatch', frameSize, 'expected', N);
            return;
        }

        // Build the grid DOM once per overlay; cache cell refs + last char.
        const players = [];
        for (const overlay of overlays) {
            const grid = document.createElement('div');
            grid.className = 'ascii-swarm-grid';
            const cells = new Array(N);
            const lastChar = new Array(N);
            for (let i = 0; i < N; i++) {
                const span = document.createElement('span');
                span.className = 'ascii-swarm-cell';
                grid.appendChild(span);
                cells[i] = span;
                lastChar[i] = '\0'; // sentinel — every first paint writes
            }
            overlay.appendChild(grid);

            // Each wall pulls from a different algorithm, cycling through the
            // six available animations (wall 1 → boids, wall 2 → sonar, etc.).
            const wallIdx = parseInt(overlay.dataset.wall, 10) || 1;
            const wd = wallData[(wallIdx - 1) % wallData.length];
            const startOffset = Math.floor(Math.random() * wd.frames);
            players.push({ cells, lastChar, wd, frame: startOffset });
        }

        const tickMs = Math.max(40, Math.round(1000 / fps));
        setInterval(() => {
            for (const p of players) {
                const off = (p.frame % p.wd.frames) * N;
                const slice = p.wd.data;
                const cells = p.cells, last = p.lastChar;
                // Per-cell diff — only touch DOM when char changed. With most
                // cells empty for most frames, this keeps the write count low.
                for (let i = 0; i < N; i++) {
                    const c = slice.charCodeAt(off + i);
                    if (last[i] !== c) {
                        last[i] = c;
                        // ' ' (32) renders empty; everything else as-is.
                        cells[i].textContent = c === 32 ? '' : String.fromCharCode(c);
                    }
                }
                p.frame++;
            }
        }, tickMs);
    }
}

// ASCII art pool: 46 WebP images in /public/ascii_art/ named ASCII_001.webp … ASCII_046.webp.
// The lectern displays one at a time on its open book. Selection only changes when
// the user can't see the book (rotated to face wall 1, the back-of-lectern side), or
// after returning from a zoomed full-screen view — so the image never changes mid-view.
//
// Sampling rules live in /data/ASCII_chains.json. Some pieces form ordered chains
// (e.g. once 017 appears, 018→019→020 must follow before random sampling resumes).
// Two obscure pieces (035, 045) are gated: they cannot appear until at least five
// other slots (chain-starts or standalones) have already been shown. Each chain
// counts as one "slot" for the gate threshold.
const ASCII_ART_POOL_SIZE = 46;
let _currentLecternArt = null; // numeric index 1..ASCII_ART_POOL_SIZE
let _asciiChainData = null;    // loaded from /data/ASCII_chains.json
let _lecternChainQueue = [];   // remaining pieces in active chain (FIFO)
let _lecternSlotStarts = 0;    // count of chain-starts + standalones shown so far
let _lecternLastSlotKey = null; // identifier of the previous slot, to avoid back-to-back repeats
let _lecternZoomed = false;
let _lecternZoomTransitioning = false;
let _lecternIdleTimer = null;
let _lecternMelting = false;
let _lecternMelted = false;
const LECTERN_MELT_MS = 1800; // must match @keyframes lectern-melt duration
// User-driven zoom on the full-screen ASCII art (1.0 = natural fit, 5.0 = 500%).
// Reset on every triggerLecternZoom so the chamber always returns to 100% on exit.
let _userZoom = 1;
const USER_ZOOM_MIN = 1;
const USER_ZOOM_MAX = 5;
// Psychedelic melt: the whole chamber dissolves through colour-cycling,
// blur, and saturation before the ASCII art emerges on its own. Long enough
// to feel ceremonious — not instantaneous.
const LECTERN_ZOOM_MS = 2800;
const LECTERN_AUTO_DRIFT_MS = 24000;

function _lecternArtPath(idx) {
    return `/ascii_art/ASCII_${String(idx).padStart(3, '0')}.webp`;
}

async function _loadAsciiChainData() {
    if (_asciiChainData) return _asciiChainData;
    try {
        const r = await fetch('/data/ASCII_chains.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        _asciiChainData = await r.json();
    } catch (err) {
        console.warn('[ascii-chains] failed to load, falling back to uniform 1..46', err);
        const standalones = [];
        for (let i = 1; i <= ASCII_ART_POOL_SIZE; i++) standalones.push(i);
        _asciiChainData = { poolSize: ASCII_ART_POOL_SIZE, gateThreshold: 0, chains: [], standalones, gated: [] };
    }
    return _asciiChainData;
}

function pickLecternArt() {
    // No-op if chain data hasn't loaded yet; the current image stays put.
    // initAsciiLecternPage awaits the load before the first pick, and by the
    // time the user can rotate to trigger another refresh the data is in.
    if (!_asciiChainData) return;

    // Mid-chain: emit the next piece in order. Slot start count is NOT incremented
    // for chain continuations — only for new slot openings.
    if (_lecternChainQueue.length > 0) {
        _currentLecternArt = _lecternChainQueue.shift();
        return;
    }

    const { chains, standalones, gated, gateThreshold } = _asciiChainData;
    const gateOpen = _lecternSlotStarts >= gateThreshold;
    const gatedSet = new Set(gated);

    // Build the candidate slot list. Each chain is one slot keyed by its head;
    // each standalone is its own slot. Gated heads (035, 045) are excluded
    // until the threshold of prior slot-starts is met.
    const slots = [];
    chains.forEach((chain, i) => {
        const head = chain[0];
        if (!gateOpen && gatedSet.has(head)) return;
        slots.push({ kind: 'chain', key: 'c' + i, chain });
    });
    standalones.forEach(piece => {
        if (!gateOpen && gatedSet.has(piece)) return;
        slots.push({ kind: 'standalone', key: 's' + piece, piece });
    });

    if (slots.length === 0) return; // defensive — should never happen with valid config

    // Avoid immediately repeating the slot we just finished.
    const eligible = slots.filter(s => s.key !== _lecternLastSlotKey);
    const pool = eligible.length > 0 ? eligible : slots;
    const slot = pool[Math.floor(Math.random() * pool.length)];

    if (slot.kind === 'chain') {
        _currentLecternArt = slot.chain[0];
        _lecternChainQueue = slot.chain.slice(1);
    } else {
        _currentLecternArt = slot.piece;
        _lecternChainQueue = [];
    }
    _lecternLastSlotKey = slot.key;
    _lecternSlotStarts += 1;
}

// Active layer index for the crossfade (0 or 1). The lectern has two
// .ascii-lectern-page <img> elements stacked at the same position; one is
// visible (opacity 1) and the other is hidden (opacity 0). Refreshing
// loads the new src into the hidden layer, then swaps opacities so the
// CSS transition cross-fades between them — no src-change flash.
let _lecternFrontLayer = 0;

function refreshLecternArt() {
    pickLecternArt();
    const imgs = document.querySelectorAll('.ascii-lectern-page');
    if (imgs.length === 0) return;
    const path = _lecternArtPath(_currentLecternArt);
    // Fallback: if there's only one <img> for any reason, snap it.
    if (imgs.length === 1) {
        imgs[0].src = path;
        imgs[0].style.opacity = '1';
        return;
    }
    const nextLayer = 1 - _lecternFrontLayer;
    const fadeIn  = imgs[nextLayer];
    const fadeOut = imgs[_lecternFrontLayer];
    fadeIn.src = path;
    // Defer the opacity swap one frame to make sure the new src has been
    // committed before the transition starts — otherwise Chrome can paint
    // the in-flight image at low opacity before the swap registers.
    requestAnimationFrame(() => {
        fadeIn.style.opacity = '1';
        fadeOut.style.opacity = '0';
    });
    _lecternFrontLayer = nextLayer;
}

// Called from afterRotation. Fires only on the ASCII gallery, and only when the
// user has rotated to face wall 1 — at that point the book is on the far side of
// the lectern (slab is rotateY(180deg) so its readable face points away from wall 1),
// so swapping the image is invisible. By the time the user rotates back around to
// face the book, the fresh image is already in place.
function _maybeRefreshLectern() {
    if (_prismId !== 'ascii-gallery') return;
    if (_lecternZoomed || _lecternZoomTransitioning) return;
    if (getFacingWall() === 1) refreshLecternArt();
}

async function initAsciiLecternPage() {
    await _loadAsciiChainData();
    pickLecternArt();
    const imgs = document.querySelectorAll('.ascii-lectern-page');
    if (imgs.length === 0) return;
    const path = _lecternArtPath(_currentLecternArt);
    // Initial load: snap the front layer to visible without the 900ms fade
    // so the lectern doesn't appear empty as the scene curtain lifts.
    const front = imgs[0];
    if (front) {
        front.style.transition = 'none';
        front.src = path;
        front.style.opacity = '1';
        // Flush the no-transition state before restoring it, so subsequent
        // opacity changes (driven by refreshLecternArt) animate normally.
        void front.offsetHeight;
        front.style.transition = '';
    }
    _lecternFrontLayer = 0;
}

// Zoom hit-test: the book is most visible from facing walls 3, 4, 5 (away from
// the back-of-slab side). The same Chrome preserve-3d hit-routing bug as the
// orb applies, so we do a manual screen-rect test against the book element.
function hitTestLectern(clientX, clientY) {
    if (_prismId !== 'ascii-gallery') return false;
    if (_lecternZoomed || _lecternZoomTransitioning) return false;
    if (_lecternMelted || _lecternMelting) return false;
    if (isRotating || archwayAnimating) return false;
    const facing = getFacingWall();
    if (facing !== 3 && facing !== 4 && facing !== 5) return false;
    const book = document.querySelector('.ascii-lectern-book');
    if (!book) return false;
    const r = book.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right &&
           clientY >= r.top  && clientY <= r.bottom;
}

// Close-button hit-test: button is a 3D child of the lectern, so its
// projected bounding rect can be oversized along one axis under perspective.
// Use a circular zone derived from the SMALLER rect dimension so an
// oversized projection in one direction can't steal clicks from the book.
// Allowed from the same wall set as visibility: 3, 4, 5 (front-facing).
function hitTestLecternClose(clientX, clientY) {
    if (_prismId !== 'ascii-gallery') return false;
    if (_lecternMelted || _lecternMelting) return false;
    if (_lecternZoomed || _lecternZoomTransitioning) return false;
    if (isRotating || archwayAnimating) return false;
    const facing = getFacingWall();
    if (facing !== 3 && facing !== 4 && facing !== 5) return false;
    const btn = document.querySelector('.lectern-close-btn');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const radius = Math.min(r.width, r.height) / 2 + 4;
    const dx = clientX - cx, dy = clientY - cy;
    return (dx * dx + dy * dy) <= (radius * radius);
}

function meltLectern() {
    if (_lecternMelted || _lecternMelting) return;
    if (_prismId !== 'ascii-gallery') return;
    const lectern = document.querySelector('.ascii-lectern');
    if (!lectern) return;
    _lecternMelting = true;
    lectern.classList.add('lectern-melting');
    window.setTimeout(() => {
        _lecternMelting = false;
        _lecternMelted = true;
        lectern.classList.add('lectern-gone');
        document.body.classList.add('lectern-melted');
        // Archway-click-overlay was gated off; refresh its position now that
        // the destination on wall 4 is reachable.
        if (typeof updateArchwayOverlay === 'function') updateArchwayOverlay();
    }, LECTERN_MELT_MS);
}

function ensureLecternZoomOverlay() {
    let overlay = document.getElementById('lectern-zoom-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lectern-zoom-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    // The conic-gradient psychedelic swirl is a ::before pseudo on the overlay (CSS).
    const stage = document.createElement('div');
    stage.className = 'lectern-zoom-stage';
    const img = document.createElement('img');
    img.className = 'lectern-zoom-img';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    stage.appendChild(img);

    // Controls bar at the bottom: zoom slider (with -/+ buttons) and close X.
    const controls = document.createElement('div');
    controls.className = 'lectern-zoom-controls';
    controls.innerHTML = `
        <button class="zoom-btn" type="button" data-zoom-action="out" aria-label="Zoom out">-</button>
        <input class="zoom-slider" type="range" min="100" max="500" value="100" step="5" aria-label="Zoom level" />
        <button class="zoom-btn" type="button" data-zoom-action="in" aria-label="Zoom in">+</button>
        <button class="lectern-close-fullscreen-btn" type="button" aria-label="Close">X</button>
    `;
    stage.appendChild(controls);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    _setupZoomControls(overlay, img);
    _setupBrowserZoomInterception(overlay);
    _setupDragPan(img);
    return overlay;
}

function setUserZoom(value) {
    _userZoom = Math.max(USER_ZOOM_MIN, Math.min(USER_ZOOM_MAX, value));
    const overlay = document.getElementById('lectern-zoom-overlay');
    if (!overlay) return;
    const img = overlay.querySelector('.lectern-zoom-img');
    if (img) {
        img.style.setProperty('--user-zoom', _userZoom.toFixed(3));
        _updateCursor(img);
    }
    const slider = overlay.querySelector('.zoom-slider');
    const sliderVal = Math.round(_userZoom * 100);
    if (slider && parseInt(slider.value, 10) !== sliderVal) {
        slider.value = String(sliderVal);
    }
    // Zoom changed → pan bounds change too. Re-clamp; if zoom <= 1, pan is forced to 0.
    if (_userZoom <= 1) _resetPan();
    else _applyPan();
}

function _setupZoomControls(overlay, img) {
    const slider = overlay.querySelector('.zoom-slider');
    const closeBtn = overlay.querySelector('.lectern-close-fullscreen-btn');
    const zoomBtns = overlay.querySelectorAll('.zoom-btn');
    if (slider) {
        slider.addEventListener('input', (e) => {
            setUserZoom(parseInt(e.target.value, 10) / 100);
            _startLecternIdleTimer();
        });
    }
    zoomBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dir = btn.dataset.zoomAction === 'in' ? +0.2 : -0.2;
            setUserZoom(_userZoom + dir);
            _startLecternIdleTimer();
        });
    });
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            leaveLecternZoom();
        });
    }
}

// Browser-level zoom (Ctrl+wheel, trackpad pinch on Mac, iOS gesture events)
// would zoom the WHOLE PAGE and persist after the overlay closes — leaving
// the chamber rendered at the wrong scale. Intercept these on the overlay
// and route them into our own image-only zoom instead, so the page chrome
// always returns to 100%.
function _setupBrowserZoomInterception(overlay) {
    overlay.addEventListener('wheel', (e) => {
        if (!_lecternZoomed && !_lecternZoomTransitioning) return;
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? +0.12 : -0.12;
            setUserZoom(_userZoom + delta);
            _startLecternIdleTimer();
        }
    }, { passive: false });

    // Safari/iOS: trackpad pinch and touch pinch fire gesture* events.
    let _gestureStartZoom = 1;
    overlay.addEventListener('gesturestart', (e) => {
        e.preventDefault();
        _gestureStartZoom = _userZoom;
    });
    overlay.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        setUserZoom(_gestureStartZoom * e.scale);
        _startLecternIdleTimer();
    });
    overlay.addEventListener('gestureend', (e) => { e.preventDefault(); });
}

// Click-and-drag pan for the full-screen ASCII art. Only active when
// zoomed in (user-zoom > 1) — at natural fit there's nothing to pan to.
// _panX / _panY are screen-pixel offsets applied via the --pan-x / --pan-y
// CSS variables, clamped so the user can't drag the image entirely off
// the viewport.
let _panX = 0;
let _panY = 0;
let _isPanning = false;
let _panStart = { x: 0, y: 0, panX: 0, panY: 0 };

function _getNaturalImgSize() {
    const overlay = document.getElementById('lectern-zoom-overlay');
    if (!overlay) return { w: 0, h: 0 };
    const img = overlay.querySelector('.lectern-zoom-img');
    if (!img || !img.complete || img.naturalWidth === 0) return { w: 0, h: 0 };
    // Current rect is scaled by --user-zoom and translated by --pan-x/--pan-y;
    // dividing by the zoom recovers the un-scaled rendered footprint.
    const rect = img.getBoundingClientRect();
    return { w: rect.width / _userZoom, h: rect.height / _userZoom };
}

function _clampPan() {
    const { w, h } = _getNaturalImgSize();
    if (w === 0) return;
    const scaledW = w * _userZoom;
    const scaledH = h * _userZoom;
    const maxPanX = Math.max(0, (scaledW - window.innerWidth) / 2);
    const maxPanY = Math.max(0, (scaledH - window.innerHeight) / 2);
    if (_panX >  maxPanX) _panX =  maxPanX;
    if (_panX < -maxPanX) _panX = -maxPanX;
    if (_panY >  maxPanY) _panY =  maxPanY;
    if (_panY < -maxPanY) _panY = -maxPanY;
}

function _applyPan() {
    _clampPan();
    const overlay = document.getElementById('lectern-zoom-overlay');
    if (!overlay) return;
    const img = overlay.querySelector('.lectern-zoom-img');
    if (!img) return;
    img.style.setProperty('--pan-x', _panX.toFixed(1) + 'px');
    img.style.setProperty('--pan-y', _panY.toFixed(1) + 'px');
}

function _resetPan() {
    _panX = 0;
    _panY = 0;
    _applyPan();
}

function _updateCursor(img) {
    if (_isPanning) img.style.cursor = 'grabbing';
    else if (_userZoom > 1) img.style.cursor = 'grab';
    else img.style.cursor = 'default';
}

function _setupDragPan(img) {
    function start(clientX, clientY) {
        if (_userZoom <= 1) return;
        _isPanning = true;
        _panStart.x = clientX;
        _panStart.y = clientY;
        _panStart.panX = _panX;
        _panStart.panY = _panY;
        // Suppress the 220ms transition during active drag, otherwise the
        // image lags behind the cursor. Restored on drag end.
        img.style.transition = 'none';
        _updateCursor(img);
    }
    function move(clientX, clientY) {
        if (!_isPanning) return;
        _panX = _panStart.panX + (clientX - _panStart.x);
        _panY = _panStart.panY + (clientY - _panStart.y);
        _applyPan();
        if (_lecternZoomed) _startLecternIdleTimer();
    }
    function end() {
        if (!_isPanning) return;
        _isPanning = false;
        img.style.transition = '';
        _updateCursor(img);
    }

    img.addEventListener('mousedown', (e) => {
        e.preventDefault(); // suppress native image-drag (ghost-drag image)
        start(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => { if (_isPanning) move(e.clientX, e.clientY); });
    document.addEventListener('mouseup', end);
    document.addEventListener('mouseleave', end);

    img.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        start(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
        if (!_isPanning || e.touches.length !== 1) return;
        move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);

    window.addEventListener('resize', () => { _applyPan(); });
}

function triggerLecternZoom() {
    if (_lecternZoomed || _lecternZoomTransitioning) return;
    if (_currentLecternArt == null) return;
    _lecternZoomTransitioning = true;
    const overlay = ensureLecternZoomOverlay();
    const fullImg = overlay.querySelector('.lectern-zoom-img');
    fullImg.src = _lecternArtPath(_currentLecternArt);
    // Fresh viewing: snap user zoom back to 100% and pan to centre so each
    // open starts clean.
    _resetPan();
    setUserZoom(1);
    document.body.classList.add('lectern-zooming');
    document.body.classList.add('lectern-zoomed');
    window.setTimeout(() => {
        _lecternZoomTransitioning = false;
        _lecternZoomed = true;
        document.body.classList.remove('lectern-zooming');
        _startLecternIdleTimer();
    }, LECTERN_ZOOM_MS);
}

function leaveLecternZoom() {
    if (!_lecternZoomed && !_lecternZoomTransitioning) return;
    _cancelLecternIdleTimer();
    _lecternZoomed = false;
    _lecternZoomTransitioning = true;
    // Snap zoom back to 100% and pan to centre before the warp-out begins so
    // the chamber, once re-revealed behind the receding overlay, is at its
    // natural scale and position.
    _resetPan();
    setUserZoom(1);
    document.body.classList.add('lectern-unzooming');
    document.body.classList.remove('lectern-zoomed');
    window.setTimeout(() => {
        _lecternZoomTransitioning = false;
        document.body.classList.remove('lectern-unzooming');
        refreshLecternArt();
    }, LECTERN_ZOOM_MS);
}

function _startLecternIdleTimer() {
    _cancelLecternIdleTimer();
    _lecternIdleTimer = window.setTimeout(leaveLecternZoom, LECTERN_AUTO_DRIFT_MS);
}
function _cancelLecternIdleTimer() {
    if (_lecternIdleTimer !== null) {
        clearTimeout(_lecternIdleTimer);
        _lecternIdleTimer = null;
    }
}

if (_prismId === 'ascii-gallery') {
    initAsciiSwarmPlayer();
    initAsciiLecternPage();
}

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

// === Event-based ambient engine (Shutov Assembly mode) ==========================
// A sparser, event-driven alternative to CHAMBER_DRONES. Built around modal
// droplet voices, a damped chamber reverb bus, irregular delay taps, and a
// near-silent low vapour bed. Per AUDIO.md.
//
// Chambers opt in via CHAMBER_PROFILES. initDrone() dispatches here first;
// chambers without a profile fall through to the legacy CHAMBER_DRONES bed.

const CHAMBER_PROFILES = {

    // -----------------------------------------------------------------------
    // Central / Shrine chamber — warm, votive, candlelit.
    // Pitch field: A minor pentatonic + suspended fourths.
    // -----------------------------------------------------------------------
    'main': {
        // Pitch pool (Hz). Droplets pick uniformly from `droplet`, shimmers
        // and accents from `shimmer`, slow bell tones from `bell.fundamentals`.
        pitchPool: {
            droplet: [
                220.00,  // A3
                261.63,  // C4
                293.66,  // D4
                329.63,  // E4
                392.00,  // G4
                440.00,  // A4
                523.25,  // C5
                587.33,  // D5
                659.26,  // E5
                783.99,  // G5
                880.00,  // A5
            ],
            shimmer: [
                659.26, 783.99, 880.00, 1046.50, 1318.51,
            ],
        },
        // Slightly inharmonic modal partials — "soft glass" rather than "bright bell"
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 16 },
            { r: 2.001,  a: 0.46, q: 14 },
            { r: 2.756,  a: 0.28, q: 12 },
            { r: 5.404,  a: 0.12, q: 10 },
        ],
        droplet: {
            // Per-event peak gain & decay (heard before reverb)
            gainMin: 0.38, gainMax: 0.65,
            decayMin: 1.5,  decayMax: 4.5,
            attackMin: 0.012, attackMax: 0.05,
        },
        density: {
            // Slow modulation of events/minute via a sine over cyclePeriod
            eventsPerMinMin: 10,
            eventsPerMinMax: 24,
            cyclePeriod: 180,           // 3-minute density breath
            clusterProbability: 0.09,   // chance per scheduled event of a 3-6 droplet cluster
            longPauseProbability: 0.03, // chance per scheduled event of a 20-45s pause
        },
        bell: {
            // Slow swelling glass bell — accent, not metronome
            gain: 0.162,
            durMin: 7.5, durMax: 11,
            // Min seconds between bells (gate)
            intervalMin: 40,
            // Per-event probability of triggering a bell on top of a droplet
            triggerProb: 0.09,
            fundamentals: [110.00, 146.83, 164.81, 196.00],  // A2, D3, E3, G3
        },
        shimmer: {
            // Cluster of 4–8 quiet upper pings within a ~4s window
            intervalMin: 52,
            triggerProb: 0.12,
            minCount: 4, maxCount: 8,
            gainPer: 0.132,
            window: 4.0,
        },
        bed: {
            // Quiet, slowly modulated low vapour bed. Detuned voices a fifth
            // apart, sitting in the laptop-speaker sweet spot (110–330 Hz so
            // the fundamental is actually reproducible). Permitted by
            // AUDIO.md as "low-level, soft-edged, slowly modulated".
            // A major triad (A2–C#3–E3): the bed was an open fifth (A+E, no
            // third) which read cold/aloof. The added major third turns it warm
            // and "sunlit". Root, third and fifth each carry an independent slow
            // amp LFO at incommensurate rates, so the chord's internal balance
            // keeps drifting like shifting light — none ever fully drops out.
            layers: [
                // Root — A2
                { freq: 110.00, gain: 0.024, type: 'sine',
                  ampLfo: { rate: 0.0088, depth: 0.013 } },        // ~114 s
                { freq: 110.55, gain: 0.018, type: 'sine' },       // A2 detune (slow beating)
                // Major third — C#3. Kept low and under the 700 Hz lowpass so it
                // never clashes in-octave with the A-minor-pentatonic droplets.
                { freq: 138.59, gain: 0.018, type: 'sine',
                  ampLfo: { rate: 0.0151, depth: 0.011 } },        // ~66 s
                // Fifth — E3
                { freq: 164.81, gain: 0.017, type: 'sine',
                  ampLfo: { rate: 0.0119, depth: 0.010 } },        // ~84 s
                // E3 ghost detune — beats softly against the E3 fifth.
                { freq: 165.30, gain: 0.0018, type: 'sine',
                  ampLfo: { rate: 0.024, depth: 0.0028 } },        // ~42 s, ±0.0028 swing
                { freq: 220.00, gain: 0.010, type: 'triangle' },   // A3 octave glue
            ],
            filter: { type: 'lowpass', freq: 700, Q: 0.8 },
            // Filter LFO: very slow cutoff sweep
            filterLfoRate: 0.013,   // ~77s sweep
            filterLfoDepth: 180,
            // Amp LFO: a real audible swell on the bed amplitude. Two slow
            // sines summed (incommensurate periods, ~55 s and ~83 s) give an
            // unpredictable wave-like envelope that never quite repeats.
            ampLfoRate: 0.018,          // ~55 s primary period
            ampLfoRate2: 0.0072,        // ~138 s slow tide (irrational against rate1)
            ampLfoDepth: 0.30,          // ±30% swing — audible "wave" without spiking
            ampLfoDepth2: 0.12,         // smaller secondary swing
            // Send a touch of the bed into the reverb so it has chamber-presence
            reverbSend: 0.30,
        },
        reverb: {
            // Long damped tail — the chamber itself
            dur: 9.5,
            decay: 2.6,           // exponent on (1-i/len)
            wet: 1.6,             // pushed up — the equal-power normalized convolver
                                  //  attenuates a lot; the chamber should bloom.
            damping: 2400,        // lowpass on tail
        },
        dryLevel: 0.32,           // direct event signal preserves "droplet attack"
        delayTaps: [
            // Irregular early-reflection-like taps that feed the reverb input
            { time: 0.071, gain: 0.22, pan: -0.55 },
            { time: 0.137, gain: 0.16, pan:  0.62 },
            { time: 0.211, gain: 0.11, pan: -0.32 },
            { time: 0.293, gain: 0.07, pan:  0.40 },
        ],
        masterGain: 1.56,
        fadeInSec: 5,
    },

    // -----------------------------------------------------------------------
    // Art Gallery — iridescent, reflective, "light on glass".
    // Per AUDIO.md §4: more shimmer, brighter palette, gentle pitch glissandi,
    // pentatonic + chromatic colour notes, shorter less-damped reverb.
    // -----------------------------------------------------------------------
    'art-gallery': {
        pitchPool: {
            // C major pentatonic across two octaves + four chromatic colour notes
            // (F#4, Bb4, F#5, Bb5) that show up only ~30% of the time via list weight.
            droplet: [
                261.63, 293.66, 329.63, 392.00, 440.00,   // C4 D4 E4 G4 A4
                523.25, 587.33, 659.26, 783.99, 880.00,   // C5 D5 E5 G5 A5
                261.63, 329.63, 392.00, 523.25, 659.26,   // repeats weight the pentatonic
                369.99, 466.16,                            // F#4 Bb4 colour notes
                739.99, 932.33,                            // F#5 Bb5 colour notes
            ],
            shimmer: [
                659.26, 783.99, 880.00,
                1046.50, 1244.51, 1318.51, 1567.98, 1760.00,   // C6 D#6 E6 G6 A6
            ],
        },
        // Slightly more inharmonic than Shrine — feels glassier, less "bell-like"
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 18 },
            { r: 2.015,  a: 0.48, q: 15 },
            { r: 2.832,  a: 0.30, q: 13 },
            { r: 5.486,  a: 0.14, q: 11 },
        ],
        droplet: {
            // Slightly quieter than Shrine per-event (Art is denser, so peaks
            // need to be softer to avoid pile-up), faster decays = more "glint".
            gainMin: 0.30, gainMax: 0.52,
            decayMin: 0.8, decayMax: 3.5,
            attackMin: 0.008, attackMax: 0.038,
            // Gentle pitch refraction on ~25% of droplets
            glissProb: 0.25,
            glissCents: 75,             // ±75¢ — under a semitone; "shimmer", not "wail"
        },
        stereoSpread: 1.8,              // wider than Shrine's 1.6 — more stereo sparkle
        density: {
            eventsPerMinMin: 18,
            eventsPerMinMax: 38,
            cyclePeriod: 150,           // 2½-minute density breath (faster than Shrine)
            clusterProbability: 0.12,
            longPauseProbability: 0.02, // very rare in Art — chamber stays animated
        },
        bell: {
            // Brighter, slightly rarer bell — C/G colour, not the votive A
            gain: 0.130,
            durMin: 6.0, durMax: 9.5,
            intervalMin: 55,
            triggerProb: 0.06,
            fundamentals: [130.81, 196.00, 261.63, 392.00],   // C3, G3, C4, G4
        },
        shimmer: {
            // The defining feature of the Art chamber — shimmer-medium-high.
            intervalMin: 35,
            triggerProb: 0.22,          // ~3× the Shrine rate
            minCount: 5, maxCount: 11,
            gainPer: 0.108,
            window: 3.5,
        },
        bed: {
            // Lighter chord-cloud, drifting upper voices on independent slow LFOs
            // so no single tone stays present. C-Lydian-ish field.
            layers: [
                { freq: 130.81, gain: 0.020, type: 'sine' },     // C3 root
                { freq: 131.30, gain: 0.017, type: 'sine' },     // C3 detune (slow beating)
                { freq: 196.00, gain: 0.013, type: 'sine' },     // G3 fifth
                { freq: 261.63, gain: 0.008, type: 'triangle' }, // C4 ghost
                // Two upper "drifting" voices — each has its own deep LFO at
                // incommensurate rates so they fade in/out independently. No
                // single voice dominates because they're each quiet AND
                // randomly absent. (Per AUDIO.md §4 "drifting upper voices".)
                { freq: 329.63, gain: 0.0020, type: 'sine',
                  ampLfo: { rate: 0.021, depth: 0.0032 } },      // ~48 s, ±0.0032 swing — E4
                { freq: 392.00, gain: 0.0017, type: 'sine',
                  ampLfo: { rate: 0.031, depth: 0.0028 } },      // ~32 s, ±0.0028 swing — G4
            ],
            filter: { type: 'lowpass', freq: 1100, Q: 0.7 },   // brighter than Shrine
            filterLfoRate: 0.017,       // ~59 s sweep
            filterLfoDepth: 240,
            // Audible wave swell, slightly gentler than Shrine — Art is busier
            ampLfoRate: 0.022,
            ampLfoRate2: 0.0085,
            ampLfoDepth: 0.26,
            ampLfoDepth2: 0.10,
            reverbSend: 0.28,
        },
        reverb: {
            // Shorter and brighter than Shrine — feels like a smaller, more
            // reflective space (a gallery, not a temple). Less damped to let
            // upper-mids ring.
            dur: 7.5,
            decay: 2.3,
            wet: 1.4,
            damping: 4500,
        },
        dryLevel: 0.34,                 // slightly more direct than Shrine — events crisper
        delayTaps: [
            // Slightly wider stereo spread and one more tap than Shrine
            { time: 0.059, gain: 0.22, pan: -0.70 },
            { time: 0.103, gain: 0.18, pan:  0.72 },
            { time: 0.181, gain: 0.13, pan: -0.40 },
            { time: 0.241, gain: 0.10, pan:  0.45 },
            { time: 0.349, gain: 0.06, pan: -0.18 },
        ],
        masterGain: 1.52,
        fadeInSec: 5,
    },

    // -----------------------------------------------------------------------
    // Research Lab — cool, lucid, computational, "glass-and-water" / "data
    // droplets striking transparent surfaces". Per AUDIO.md §2.
    // Distinguished from the Shrine and Art Gallery by:
    //   • Whole-tone + quartal pitch field (no tonic, no major/minor colour)
    //   • Metallic / inharmonic modal ratios (struck glass, not soft bell)
    //   • Faster, shorter "precise pings"; subtle per-event stereo, wide overall
    //   • Very low bed level, slightly drier reverb than Shrine/Art
    // -----------------------------------------------------------------------
    'research-lab': {
        pitchPool: {
            // Whole-tone scale (C D E F# G# Bb), spanning two octaves.
            // No tonic, no consonant triads — reads as neutral/analytic.
            droplet: [
                261.63, 293.66, 329.63, 369.99, 415.30, 466.16,   // C4 D4 E4 F#4 G#4 Bb4
                523.25, 587.33, 659.26, 739.99, 830.61, 932.33,   // C5 D5 E5 F#5 G#5 Bb5
                // Repeat the middle-octave pitches to weight the "centre" of the field
                329.63, 369.99, 415.30, 466.16,
                587.33, 659.26, 739.99,
            ],
            shimmer: [
                659.26, 739.99, 830.61, 932.33,                   // E5 F#5 G#5 Bb5
                1046.50, 1174.66, 1318.51, 1479.98, 1661.22,      // C6 D6 E6 F#6 G#6
                1864.66,                                          // Bb6 (rare upper glint)
            ],
        },
        // Metallic modal ratios — pushed clearly further inharmonic than Shrine
        // (1, 2.001, 2.756, 5.404) and Art (1, 2.015, 2.832, 5.486). These
        // ratios are closer to the modes of a thin metal bar / fine struck
        // glass than to a bell. Higher Qs let each partial ring out cleanly.
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 22 },
            { r: 2.193,  a: 0.46, q: 18 },
            { r: 3.589,  a: 0.26, q: 15 },
            { r: 5.872,  a: 0.12, q: 12 },
        ],
        droplet: {
            // Faster, shorter — "precise pings" rather than blooming droplets.
            gainMin: 0.48, gainMax: 0.80,
            decayMin: 0.6, decayMax: 3.0,
            attackMin: 0.005, attackMax: 0.030,
            // Rare, very narrow gliss — reads as faint "data jitter", not refraction
            glissProb: 0.06,
            glissCents: 25,
        },
        // Subtle per-event stereo — events feel placed, not splashed.
        // The overall stereo image is widened by wider delay taps below.
        stereoSpread: 1.2,
        density: {
            eventsPerMinMin: 16,
            eventsPerMinMax: 35,
            cyclePeriod: 200,             // slower breath cycle — analytic patience
            clusterProbability: 0.05,     // rare — events are mostly separated
            longPauseProbability: 0.05,   // occasional pause for thinking
        },
        bell: {
            // "Occasional distant low tone" — these are the rare deep, slow
            // tones that the AUDIO.md brief asks for. Quartal fundamentals,
            // long durations, very rare triggering, lower gain than other
            // chambers so they read as distant rather than present.
            gain: 0.168,
            durMin: 9.0, durMax: 13.0,
            intervalMin: 80,
            triggerProb: 0.05,
            fundamentals: [130.81, 174.61, 196.00, 233.08],   // C3 F3 G3 Bb3 (quartal)
        },
        shimmer: {
            // Medium — between Shrine's low and Art's high. Whole-tone clusters.
            intervalMin: 50,
            triggerProb: 0.15,
            minCount: 4, maxCount: 8,
            gainPer: 0.160,
            window: 3.8,
        },
        bed: {
            // Very low bedLevel per AUDIO.md. Quartal stack (C/F/G — fourths
            // and fifths) with no third, so the bed has no major/minor colour.
            // Two drifting upper voices on independent slow LFOs add a faint
            // "computational shimmer" without ever fixing on a single tone.
            layers: [
                // Bed dropped a full octave into the sub-bass / low-bass register
                // to give the chamber genuine low-end weight. Bass voices are
                // boosted ~2× to compensate for laptop-speaker rolloff below
                // ~120 Hz. One triangle voice (F2) adds a touch of harmonic
                // content so the bass remains audible even on small speakers.
                { freq:  65.41, gain: 0.028, type: 'sine' },     // C2 root
                { freq:  65.65, gain: 0.024, type: 'sine' },     // C2 detune (very slow beating)
                { freq:  87.31, gain: 0.020, type: 'triangle' }, // F2 fourth (triangle for warmth)
                { freq:  98.00, gain: 0.015, type: 'sine' },     // G2 fifth
                // Drifting mid voices — also dropped an octave (E3 / F#3) so
                // they no longer sit above the bed as a "top tone"; instead
                // they fill the mid-bass and beat softly against the
                // fundamentals. Whole-tone interval between them keeps the
                // bed neutral.
                { freq: 164.81, gain: 0.0035, type: 'sine',
                  ampLfo: { rate: 0.019, depth: 0.0059 } },      // ~53 s, E3
                { freq: 185.00, gain: 0.0029, type: 'sine',
                  ampLfo: { rate: 0.029, depth: 0.0047 } },      // ~34 s, F#3
            ],
            filter: { type: 'lowpass', freq: 420, Q: 0.6 },     // rolls off mids — bass dominant
            filterLfoRate: 0.015,         // ~67 s sweep
            filterLfoDepth: 140,           // gentler sweep at the lower cutoff
            // Slightly slower waves than Shrine/Art — the Research bed is
            // more "patient", less actively swelling
            ampLfoRate: 0.014,
            ampLfoRate2: 0.0055,
            ampLfoDepth: 0.28,
            ampLfoDepth2: 0.12,
            reverbSend: 0.22,             // less wet than Art (0.28) — drier feel
        },
        reverb: {
            // Medium hall, medium-strong damping. Shorter than Shrine, more
            // damped than Art — a "different room", neither temple nor gallery.
            dur: 8.5,
            decay: 2.5,
            wet: 1.3,
            damping: 3000,
        },
        dryLevel: 0.36,                   // slightly drier than Shrine/Art — "more separated"
        delayTaps: [
            // Wider per-tap stereo spread than the other chambers — even though
            // each event is panned narrowly, the chamber response paints a
            // broad stereo image. ("subtle but wide" per AUDIO.md.)
            { time: 0.043, gain: 0.20, pan: -0.85 },
            { time: 0.097, gain: 0.16, pan:  0.85 },
            { time: 0.157, gain: 0.12, pan: -0.55 },
            { time: 0.227, gain: 0.09, pan:  0.55 },
            { time: 0.317, gain: 0.06, pan: -0.20 },
            { time: 0.401, gain: 0.04, pan:  0.20 },
        ],
        masterGain: 1.08,
        fadeInSec: 5,
    },

    // -----------------------------------------------------------------------
    // OVS Chapel — cool, glassy, "shimmering hazes and washes of sound,
    // smeared colours". Per AUDIO.md §6 (remote, sacred, alien, but calm).
    // Distinguished from the other chambers by:
    //   • Bb tonal field with austere root+fifth + occasional tritone/2nd colour
    //   • Long blooming droplets (slow attacks 40-200ms, decays 2.5-6.5s)
    //   • Heavy use of the new "wash" event (slow swell-in + pitch-smeared partials)
    //   • Very high glissProb on droplets (50%) for the "smeared" feel
    //   • Longest reverb of any chamber (12.5s) with cool damping
    //   • Wide, slow stereo motion
    // -----------------------------------------------------------------------
    'ovs-chapel': {
        pitchPool: {
            // Bb tonal field: root, fifth, with rare second/tritone colour.
            // Repeated Bb and F pitches weight the field toward austere
            // root+fifth; C (second) and E (tritone) appear ~15% of the time.
            droplet: [
                233.08, 349.23, 466.16, 698.46, 932.33,     // Bb3 F4 Bb4 F5 Bb5
                233.08, 349.23, 466.16, 698.46,              // weight Bb/F further
                174.61, 116.54,                              // F3 Bb2 (lower)
                // Occasional colour notes
                261.63, 329.63,                              // C4 E4 (second / tritone)
                523.25, 659.26,                              // C5 E5
            ],
            shimmer: [
                698.46, 932.33,                              // F5 Bb5
                1046.50, 1244.51, 1396.91, 1864.66,          // C6 Eb6 F6 Bb6
                1318.51,                                     // E6 — rare tritone glint
            ],
        },
        // Soft-glass modal ratios — similar to Shrine but with a touch more
        // resonance on the upper partials so they ring icily into the long reverb.
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 18 },
            { r: 2.001,  a: 0.50, q: 16 },
            { r: 2.756,  a: 0.32, q: 14 },
            { r: 5.404,  a: 0.16, q: 12 },
        ],
        droplet: {
            // Blooming droplets — slow attacks, long decays. Each is a
            // small luminous event that fades into the long reverb tail.
            gainMin: 0.58, gainMax: 0.95,
            decayMin: 2.5, decayMax: 6.5,
            attackMin: 0.04, attackMax: 0.20,
            // Heavy "smear": ~65% of droplets carry a pitch sweep up to
            // ±120¢ (just over a semitone) — reads as "colour shifting",
            // the watercolour blur of the chamber.
            glissProb: 0.65,
            glissCents: 120,
        },
        stereoSpread: 1.7,              // wider — more stereo wash
        density: {
            eventsPerMinMin: 42,
            eventsPerMinMax: 90,
            cyclePeriod: 220,           // slow breath cycle preserved
            clusterProbability: 0.15,
            longPauseProbability: 0.02, // rare — chamber continuously painted
        },
        bell: {
            // Warm bells — near-harmonic partial stack (1 / 2 / 3 / 4 / 6 with
            // tiny detunes) gives a clearly-pitched, rounded resonance instead
            // of the cold inharmonic bell timbre. Read as warm temple tones
            // blooming through the chamber alongside the cooler washes.
            gain: 0.22,
            durMin: 7.0, durMax: 11.5,
            intervalMin: 18,
            triggerProb: 0.25,
            fundamentals: [116.54, 174.61, 233.08, 349.23],   // Bb2, F3, Bb3, F4
            partials: [
                { r: 1.000, a: 1.00 },
                { r: 2.000, a: 0.60 },                        // pure octave
                { r: 3.005, a: 0.32 },                        // ~12th, slight detune
                { r: 4.010, a: 0.20 },                        // ~2× octave
                { r: 6.011, a: 0.10 },                        // ~2 octaves + 5th
            ],
        },
        shimmer: {
            // Now arrives every ~12 s — small clusters of upper-register glints
            // contributing to the watercolour feel.
            intervalMin: 12,
            triggerProb: 0.55,
            minCount: 5, maxCount: 11,
            gainPer: 0.16,
            window: 4.2,
        },
        // Wash events — the defining OVS feature. Slow swell-in, brief peak,
        // quick decay, with per-partial pitch wobble for the "smeared colour"
        // quality. Tripled rate so multiple washes overlap continuously and
        // blend like wet watercolour layers.
        wash: {
            gain: 0.28,
            durMin: 8.0, durMax: 14.0,
            intervalMin: 12,
            triggerProb: 0.55,
            stereoSpread: 1.6,
            fundamentals: [
                174.61, 233.08, 349.23,                      // F3, Bb3, F4
                466.16, 698.46,                              // Bb4, F5
                261.63, 392.00,                              // C4, G4 (second-colour)
            ],
        },
        bed: {
            // Bb-tonal bed: root + fifth foundation, plus two drifting mid
            // voices on independent slow LFOs. Slightly more present than
            // Research Lab's bed (lowBedLevel: "low-medium" per AUDIO.md)
            // — provides the "low-mid resonant base".
            layers: [
                { freq: 116.54, gain: 0.022, type: 'sine' },     // Bb2 root
                { freq: 117.03, gain: 0.019, type: 'sine' },     // Bb2 detune (slow beating)
                { freq: 174.61, gain: 0.015, type: 'triangle' }, // F3 fifth (triangle = warmth)
                { freq: 233.08, gain: 0.010, type: 'sine' },     // Bb3 octave
                // Drifting upper voices — F4 and Bb4 with deep slow LFOs.
                // Wider LFO depths than other chambers so these come and go
                // dramatically — they create the "haze" feel as they bloom
                // briefly in and out.
                { freq: 349.23, gain: 0.0030, type: 'sine',
                  ampLfo: { rate: 0.014, depth: 0.0050 } },      // ~71 s, F4
                { freq: 466.16, gain: 0.0024, type: 'sine',
                  ampLfo: { rate: 0.023, depth: 0.0040 } },      // ~43 s, Bb4
            ],
            filter: { type: 'lowpass', freq: 600, Q: 0.7 },     // cool — rolls off treble
            filterLfoRate: 0.011,         // ~91 s sweep — very slow
            filterLfoDepth: 160,
            // Wide slow wave swell — slower than other chambers (sacred patience).
            ampLfoRate: 0.012,            // ~83 s
            ampLfoRate2: 0.0048,          // ~208 s slow tide
            ampLfoDepth: 0.32,            // slightly bigger swing than Research
            ampLfoDepth2: 0.14,
            reverbSend: 0.36,             // more wet on the bed — adds to "wash"
        },
        reverb: {
            // Longest reverb of any chamber — 12.5 s tail. Cool damping
            // (2200 Hz) — slightly more damped than Shrine for the "cold
            // glass" feel rather than "warm temple".
            dur: 12.5,
            decay: 2.8,
            wet: 1.6,
            damping: 2200,
        },
        dryLevel: 0.24,                   // lower than other chambers — events feel washy/blurred
        delayTaps: [
            // Slow wide stereo — 6 taps spread out, with longer pre-delays
            // than Research, giving the chamber a wider, deeper feel.
            { time: 0.083, gain: 0.20, pan: -0.80 },
            { time: 0.139, gain: 0.16, pan:  0.82 },
            { time: 0.211, gain: 0.13, pan: -0.50 },
            { time: 0.287, gain: 0.10, pan:  0.55 },
            { time: 0.379, gain: 0.07, pan: -0.25 },
            { time: 0.467, gain: 0.05, pan:  0.30 },
        ],
        masterGain: 0.54,                 // dropped to 75% (was 0.72) — density felt overwhelming
        fadeInSec: 6,                     // slightly longer fade than other chambers
    },

    // -----------------------------------------------------------------------
    // Mythopoeic Archive — ancient, cavernous, mythic, "underworld-adjacent
    // but not frightening". Per AUDIO.md §3 (avoid horror; old and deep but
    // hospitable). Defining features:
    //   • Descending Shepard tone as a "slow-falling-into-the-deep" presence
    //   • D-minor modal field — root, fifth, minor third, flattened second
    //   • Sparsest event density of any chamber (3-9 events/min per spec)
    //   • Long blooming droplets, long decays
    //   • Longest reverb (15 s), strongly damped — cavernous stone acoustic
    //   • Very rare shimmer; "distant boom" via low warm bells
    // -----------------------------------------------------------------------
    'mythopoeic-archive': {
        pitchPool: {
            // D-minor modal pool — D, F, A core, with Eb (flattened second)
            // and C (minor 7th) as ancient/Phrygian colour notes.
            // Repeats weight the field toward D and A (root and fifth).
            droplet: [
                146.83, 174.61, 220.00, 293.66,          // D3 F3 A3 D4
                349.23, 440.00,                          // F4 A4
                146.83, 220.00, 293.66, 440.00,          // weight D and A
                311.13, 261.63,                          // Eb4 (flat 2nd), C4 (m7)
                587.33,                                  // D5 — rare upper
                174.61,                                  // F3 minor third (extra weight)
            ],
            shimmer: [
                587.33, 698.46, 880.00, 1174.66,         // D5 F5 A5 D6 — sparse upper
            ],
        },
        // Standard soft-glass modal ratios — same family as Shrine. We don't
        // want metallic resonances in a "stone" chamber; soft glass droplets
        // through massive reverb is the right reading.
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 18 },
            { r: 2.001,  a: 0.48, q: 15 },
            { r: 2.756,  a: 0.30, q: 13 },
            { r: 5.404,  a: 0.14, q: 11 },
        ],
        droplet: {
            // Long blooming events — slowest attacks and longest decays of
            // any chamber so far.
            gainMin: 0.34, gainMax: 0.58,
            decayMin: 3.0, decayMax: 8.0,
            attackMin: 0.05, attackMax: 0.25,
            // Moderate smear — events blur into the long reverb naturally
            glissProb: 0.30,
            glissCents: 60,
        },
        stereoSpread: 1.0,                 // narrower per-event — events feel placed in vastness
        density: {
            // Sparsest chamber per AUDIO.md. Lots of silence, but a low floor
            // raised slightly (4→6) so steady-state gaps don't overstay.
            eventsPerMinMin: 6,
            eventsPerMinMax: 10,
            cyclePeriod: 240,              // slowest density breath of any chamber
            clusterProbability: 0.04,
            longPauseProbability: 0.10,    // frequent moments of pure reverb tail
        },
        bell: {
            // "Distant boom" tones — low D2/A2/D3 fundamentals with a warm
            // near-harmonic stack but slightly more inharmonic at the upper
            // partials than OVS, so they read as "stone" rather than "glass".
            gain: 0.16,
            durMin: 10.0, durMax: 16.0,
            intervalMin: 65,
            triggerProb: 0.10,
            fundamentals: [73.42, 110.00, 146.83, 220.00],   // D2 A2 D3 A3
            partials: [
                { r: 1.000, a: 1.00 },
                { r: 2.000, a: 0.55 },                       // pure octave
                { r: 2.953, a: 0.32 },                       // slightly flat 12th (stone character)
                { r: 4.041, a: 0.20 },                       // slightly sharp 2× oct
                { r: 6.072, a: 0.10 },                       // ~2 octaves + 5th (slight detune)
            ],
        },
        shimmer: {
            // Very rare per AUDIO.md ("shimmerProbability: very low")
            intervalMin: 90,
            triggerProb: 0.05,
            minCount: 3, maxCount: 6,
            gainPer: 0.06,
            window: 5.0,                   // wide window — pings drift apart
        },
        // ---- The Shepard ascending tone — Mythos's defining feature ----
        // 5 voices each sweeping from C2 up to C5 (4 octaves) over 150 s,
        // phase-offset by 1/5 of the cycle. Always ascending — an endless
        // rising illusion, archaic and numinous.
        // Heavy reverb send for "cave" depth.
        shepard: {
            fLow: 65.41,                   // C2
            fHigh: 1046.50,                // C5 (4 octaves of sweep range)
            numVoices: 5,
            period: 150,                   // 150 s per full sweep
            direction: 'up',
            gain: 0.085,                   // subtle — part of the bed character
            reverbSend: 0.55,              // strong wet — adds to "cave" feel
        },
        bed: {
            // D-minor low-mid bed. Quietly present — the Shepard provides the
            // most movement, the bed gives a hospitable harmonic ground.
            layers: [
                { freq:  73.42, gain: 0.022, type: 'sine' },     // D2 sub
                { freq:  73.78, gain: 0.018, type: 'sine' },     // D2 detune (slow beating)
                { freq: 110.00, gain: 0.015, type: 'triangle' }, // A2 fifth (triangle = body)
                { freq: 146.83, gain: 0.011, type: 'sine' },     // D3 octave
                { freq: 174.61, gain: 0.007, type: 'sine' },     // F3 minor third
                // Single drifting upper voice — A3 with deep slow LFO so the
                // bed has a faint inhalation of upper colour without a
                // dominant top tone.
                { freq: 220.00, gain: 0.0026, type: 'sine',
                  ampLfo: { rate: 0.011, depth: 0.0040 } },      // ~91 s, A3
            ],
            filter: { type: 'lowpass', freq: 480, Q: 0.7 },     // cool/dark — strong damping
            filterLfoRate: 0.009,                                // ~111 s sweep — very slow
            filterLfoDepth: 130,
            // Slowest wave swell of any chamber — mythic patience
            ampLfoRate: 0.010,                                   // ~100 s
            ampLfoRate2: 0.0042,                                 // ~238 s slow tide
            ampLfoDepth: 0.30,
            ampLfoDepth2: 0.14,
            reverbSend: 0.32,
        },
        reverb: {
            // Longest reverb of any chamber — 15 s tail. Strongly damped at
            // 1800 Hz so the chamber reads as a cavern of soft stone (not
            // a polished hall and not a glass chapel).
            dur: 15.0,
            decay: 3.0,
            wet: 1.45,
            damping: 1800,
        },
        dryLevel: 0.22,                    // distant events — mostly heard through the chamber
        delayTaps: [
            // Very wide and slow — taps land far apart, suggesting a huge space
            { time: 0.103, gain: 0.20, pan: -0.85 },
            { time: 0.181, gain: 0.16, pan:  0.85 },
            { time: 0.271, gain: 0.13, pan: -0.55 },
            { time: 0.367, gain: 0.10, pan:  0.55 },
            { time: 0.479, gain: 0.07, pan: -0.25 },
            { time: 0.587, gain: 0.05, pan:  0.30 },
        ],
        masterGain: 0.90,                   // dropped to 75% (was 1.20) — density felt overwhelming
        fadeInSec: 7,                       // slowest fade — chamber arrives gradually
    },

    // -----------------------------------------------------------------------
    // Scriptorium / GPT-3 Library — airy, intimate, suspended, breathlike.
    // The quietest chamber. Sparse ink-drop events with long reverb tails.
    // E minor pentatonic pitch field; no wash, no Shepard.
    // "Language sleeping, not language being performed."
    // -----------------------------------------------------------------------
    'gpt3-library': {
        pitchPool: {
            droplet: [
                164.81,  // E3
                196.00,  // G3
                220.00,  // A3
                246.94,  // B3
                293.66,  // D4
                329.63,  // E4
                392.00,  // G4
                440.00,  // A4
                493.88,  // B4
                587.33,  // D5
                164.81, 220.00, 329.63, 493.88,  // weight E and B
                261.63,  // C4 — rare colour
                369.99,  // F#4 — rare colour
            ],
            shimmer: [
                659.26, 783.99, 987.77, 1318.51,  // E5 G5 B5 E6
            ],
        },
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 16 },
            { r: 2.001,  a: 0.44, q: 14 },
            { r: 2.756,  a: 0.26, q: 12 },
            { r: 5.404,  a: 0.11, q: 10 },
        ],
        droplet: {
            gainMin: 0.30, gainMax: 0.50,
            decayMin: 2.0,  decayMax: 6.0,
            attackMin: 0.02, attackMax: 0.12,
            glissProb: 0.15,
            glissCents: 40,
        },
        stereoSpread: 0.8,
        density: {
            eventsPerMinMin: 6,            // raised from 4 — keeps gaps from overstaying
            eventsPerMinMax: 12,
            cyclePeriod: 240,
            clusterProbability: 0.04,
            longPauseProbability: 0.08,
        },
        bell: {
            gain: 0.12,
            durMin: 8.0, durMax: 13.0,
            intervalMin: 70,
            triggerProb: 0.06,
            fundamentals: [164.81, 246.94, 329.63, 220.00],  // E3 B3 E4 A3
            partials: [
                { r: 1.000, a: 1.00 },
                { r: 2.000, a: 0.50 },
                { r: 3.003, a: 0.28 },
                { r: 4.008, a: 0.16 },
                { r: 6.015, a: 0.08 },
            ],
        },
        shimmer: {
            intervalMin: 60,
            triggerProb: 0.08,
            minCount: 3, maxCount: 6,
            gainPer: 0.07,
            window: 4.5,
        },
        bed: {
            layers: [
                { freq:  82.41, gain: 0.018, type: 'sine' },     // E2 root
                { freq:  82.71, gain: 0.015, type: 'sine' },     // E2 detune (slow beating)
                { freq: 123.47, gain: 0.012, type: 'sine' },     // B2 fifth
                { freq: 164.81, gain: 0.008, type: 'triangle' }, // E3 octave
                { freq: 220.00, gain: 0.0020, type: 'triangle',
                  ampLfo: { rate: 0.018, depth: 0.0022 } },      // A3 mid presence
            ],
            filter: { type: 'lowpass', freq: 500, Q: 0.7 },
            filterLfoRate: 0.010,
            filterLfoDepth: 120,
            ampLfoRate: 0.009,
            ampLfoRate2: 0.0038,
            ampLfoDepth: 0.24,
            ampLfoDepth2: 0.10,
            reverbSend: 0.26,
        },
        reverb: {
            dur: 11.0,
            decay: 2.7,
            wet: 1.5,
            damping: 2000,
        },
        dryLevel: 0.28,
        delayTaps: [
            { time: 0.067, gain: 0.20, pan: -0.45 },
            { time: 0.131, gain: 0.15, pan:  0.50 },
            { time: 0.209, gain: 0.11, pan: -0.30 },
            { time: 0.277, gain: 0.08, pan:  0.35 },
            { time: 0.337, gain: 0.05, pan: -0.20 },
        ],
        masterGain: 2.00,
        fadeInSec: 6,
    },

    // -----------------------------------------------------------------------
    // ASCII Gallery — digital cloister, phosphor-ghost.
    // Quartal/fifth-based pitch vocabulary (D, G, A, D, E). Metallic-but-soft
    // modal ratios, narrow stereo, faint phosphor hum in the bed.
    // Related to Research Lab but more secret and stranger.
    // -----------------------------------------------------------------------
    'ascii-gallery': {
        pitchPool: {
            droplet: [
                146.83,  // D3
                196.00,  // G3
                220.00,  // A3
                293.66,  // D4
                329.63,  // E4
                392.00,  // G4
                440.00,  // A4
                587.33,  // D5
                146.83, 293.66, 196.00, 220.00,  // weight D, G, A
            ],
            shimmer: [
                587.33, 783.99, 880.00, 1174.66,  // D5 G5 A5 D6
            ],
        },
        modalRatios: [
            { r: 1.000,  a: 1.00, q: 20 },
            { r: 2.004,  a: 0.42, q: 16 },
            { r: 3.003,  a: 0.22, q: 14 },
            { r: 5.009,  a: 0.10, q: 10 },
        ],
        droplet: {
            gainMin: 0.36, gainMax: 0.58,
            decayMin: 1.2,  decayMax: 4.0,
            attackMin: 0.008, attackMax: 0.045,
            glissProb: 0.08,
            glissCents: 20,
        },
        stereoSpread: 0.6,
        density: {
            eventsPerMinMin: 10,
            eventsPerMinMax: 22,
            cyclePeriod: 180,
            clusterProbability: 0.08,
            longPauseProbability: 0.04,
        },
        bell: {
            gain: 0.14,
            durMin: 7.0, durMax: 11.0,
            intervalMin: 55,
            triggerProb: 0.07,
            fundamentals: [146.83, 196.00, 220.00, 293.66],  // D3 G3 A3 D4
            partials: [
                { r: 1.000, a: 1.00 },
                { r: 2.000, a: 0.48 },
                { r: 2.998, a: 0.26 },
                { r: 4.006, a: 0.14 },
            ],
        },
        shimmer: {
            intervalMin: 50,
            triggerProb: 0.10,
            minCount: 3, maxCount: 7,
            gainPer: 0.10,
            window: 3.2,
        },
        bed: {
            layers: [
                { freq:  73.42, gain: 0.018, type: 'sine' },     // D2 root
                { freq:  73.72, gain: 0.015, type: 'sine' },     // D2 detune (slow beating)
                { freq: 110.00, gain: 0.012, type: 'sine' },     // A2 fifth
                { freq: 146.83, gain: 0.008, type: 'triangle' }, // D3 octave
                { freq: 196.00, gain: 0.0020, type: 'triangle',
                  ampLfo: { rate: 0.015, depth: 0.0022 } },      // G3 mid presence
                // Phosphor hum — extremely quiet ~100 Hz sine suggesting a
                // dormant CRT transformer. Felt more than heard.
                { freq: 100.00, gain: 0.004, type: 'sine',
                  ampLfo: { rate: 0.006, depth: 0.0025 } },
            ],
            filter: { type: 'lowpass', freq: 550, Q: 0.6 },
            filterLfoRate: 0.012,
            filterLfoDepth: 110,
            ampLfoRate: 0.013,
            ampLfoRate2: 0.005,
            ampLfoDepth: 0.26,
            ampLfoDepth2: 0.11,
            reverbSend: 0.24,
        },
        reverb: {
            dur: 9.0,
            decay: 2.4,
            wet: 1.35,
            damping: 2800,
        },
        dryLevel: 0.32,
        delayTaps: [
            { time: 0.053, gain: 0.20, pan: -0.35 },
            { time: 0.109, gain: 0.15, pan:  0.40 },
            { time: 0.173, gain: 0.11, pan: -0.25 },
            { time: 0.247, gain: 0.07, pan:  0.30 },
        ],
        masterGain: 2.00,
        fadeInSec: 5,
    },

};

// Procedural exponential-decay impulse response, stereo-decorrelated, with
// a soft early-reflection cluster for chamber geometry.
function _createChamberIR(ctx, dur, decay) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, len, sr);
    // Early reflection times (in samples) — irregular, ~6–80 ms
    const earlies = [0.006, 0.013, 0.023, 0.031, 0.041, 0.058, 0.072, 0.089]
        .map(t => Math.floor(t * sr));
    for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        // Diffuse exponential tail
        for (let i = 0; i < len; i++) {
            // Slight per-channel decay difference = stereo width
            const env = Math.pow(1 - i / len, decay + (ch === 0 ? 0 : -0.07));
            data[i] = (Math.random() * 2 - 1) * env;
        }
        // Pepper in a few stronger early reflections (slightly offset per channel)
        earlies.forEach((idx, k) => {
            const off = ch === 0 ? 0 : Math.floor(0.0018 * sr);
            const i = idx + off;
            if (i < len) data[i] += (Math.random() * 2 - 1) * (0.35 - k * 0.025);
        });
    }
    return buf;
}

// Modal droplet voice — short sine excitation through a bank of resonant
// bandpass filters at slightly inharmonic ratios. Per AUDIO.md Module 1.
// Returns nothing; cleans up its own scheduled nodes via stop().
//
// Optional `glissCents`: if non-zero, every modal filter's centre frequency
// sweeps from start to end over the first ~60% of the droplet, giving a
// "pitch refraction" effect (used by the Art Gallery for prismatic shimmer).
function _spawnModalDroplet(ctx, dest, opts) {
    const now = ctx.currentTime;

    // Per-event panner
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan;
    pan.connect(dest);

    // Master per-event envelope (slow swell-in, long exponential tail)
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(opts.peak, now + opts.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
    env.connect(pan);

    // Glissando setup — sweep filter freqs from startMul..endMul over ~60% of dur.
    const gliss = opts.glissCents || 0;
    const endMul = gliss !== 0 ? Math.pow(2, gliss / 1200) : 1;
    const sweepDur = opts.dur * 0.6;

    // Short sine excitation — a 40 ms ping that drives the modal bank.
    // If glissando is active, the excitation also sweeps so the early-phase
    // colour follows the modal centres.
    const exc = ctx.createOscillator();
    exc.type = 'sine';
    exc.frequency.setValueAtTime(opts.freq, now);
    if (gliss !== 0) {
        exc.frequency.exponentialRampToValueAtTime(opts.freq * endMul, now + sweepDur);
    }
    const excGain = ctx.createGain();
    excGain.gain.setValueAtTime(0.0001, now);
    excGain.gain.exponentialRampToValueAtTime(1.0, now + 0.003);
    excGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    exc.connect(excGain);

    // Modal filter bank — each partial = resonant bandpass at ratio*freq.
    // Sweep each filter's centre frequency in parallel if glissCents is set.
    opts.ratios.forEach(p => {
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        const f0 = opts.freq * p.r;
        f.frequency.setValueAtTime(f0, now);
        if (gliss !== 0) {
            f.frequency.exponentialRampToValueAtTime(f0 * endMul, now + sweepDur);
        }
        f.Q.value = p.q;
        const g = ctx.createGain();
        g.gain.value = p.a;
        excGain.connect(f); f.connect(g); g.connect(env);
    });

    exc.start(now); exc.stop(now + 0.08);
}

// Reverse-swell "wash" — slow exponential swell-in over ~85% of duration,
// brief peak, then a fast tail-off. Each modal partial has its own slow
// pitch LFO (±0.5%) so the whole swell smears in tone as it rises, like
// a coloured haze drifting in and out. Used by the OVS Chapel for the
// "smeared washes of sound" character.
function _spawnReverseSwell(ctx, dest, opts) {
    const now = ctx.currentTime;
    const dur = opts.dur;

    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan;
    pan.connect(dest);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(opts.peak, now + dur * 0.85);
    env.gain.setValueAtTime(opts.peak, now + dur * 0.92);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    env.connect(pan);

    // Slightly inharmonic partials — give the swell a luminous-glass colour
    const partials = [
        { r: 1.000, a: 1.00 },
        { r: 1.498, a: 0.58 },   // not quite a perfect fifth — alien colour
        { r: 2.005, a: 0.36 },
        { r: 2.793, a: 0.20 },
        { r: 4.213, a: 0.10 },
    ];
    partials.forEach(p => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const baseF = opts.freq * p.r;
        o.frequency.value = baseF;

        // Per-partial slow pitch wobble — the smear. Each partial gets its
        // own incommensurate rate so the partials drift relative to one another.
        const wobLfo = ctx.createOscillator();
        wobLfo.type = 'sine';
        wobLfo.frequency.value = 0.045 + Math.random() * 0.09;   // 0.045–0.135 Hz
        const wobGain = ctx.createGain();
        wobGain.gain.value = baseF * 0.005;                       // ±0.5% pitch swing
        wobLfo.connect(wobGain); wobGain.connect(o.frequency);

        const g = ctx.createGain();
        g.gain.value = p.a;
        o.connect(g); g.connect(env);
        o.start(now); o.stop(now + dur + 0.2);
        wobLfo.start(now); wobLfo.stop(now + dur + 0.2);
    });
}

// Slow glass bell — direct sum of slightly inharmonic sine partials with
// a long swell-in (no transient) and a long decay. Soft accent only.
function _spawnGlassBell(ctx, dest, opts) {
    const now = ctx.currentTime;
    const dur = opts.dur;

    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan;
    pan.connect(dest);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(opts.peak, now + dur * 0.42);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    env.connect(pan);

    // Default partial set is the cool/glass bell (inharmonic). Chambers can
    // override via opts.partials — e.g. a near-harmonic stack for "warm bell"
    // tones (OVS Chapel uses both: the cold inharmonic set isn't currently
    // employed by anything else, but the option is open).
    const partials = opts.partials || [
        { r: 1.000, a: 1.00 },
        { r: 2.003, a: 0.50 },
        { r: 2.756, a: 0.32 },
        { r: 5.404, a: 0.14 },
    ];
    partials.forEach(p => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = opts.freq * p.r;
        const g = ctx.createGain();
        g.gain.value = p.a;
        o.connect(g); g.connect(env);
        o.start(now); o.stop(now + dur + 0.2);
    });
}

// Shepard tone — the auditory illusion of a continuously ascending or
// descending pitch. N sine voices, each sweeping exponentially across
// the same frequency range (fLow → fHigh), phase-offset by 1/N of the
// cycle period. Each voice's gain follows a Hann window across its
// cycle — silent at the endpoints, full in the middle — so the
// wraparound jump (where freq returns to the cycle start) happens
// inaudibly. The Mythos chamber uses a single descending Shepard tone
// as a deep mythic-presence layer in its bed.
//
// Implementation: pre-schedules ~30s of linearRamp events at 100ms
// granularity, with a setInterval refilling the schedule every ~15s.
// Reuses the existing textureTimers cleanup path (clearTimeout works
// on setInterval IDs in browsers).
function _createShepardEngine(ctx, dest, reverbInput, opts) {
    const layerGain = ctx.createGain();
    layerGain.gain.value = opts.gain;
    layerGain.connect(dest);

    // Optional parallel reverb send
    let reverbSendGain = null;
    if (reverbInput && opts.reverbSend) {
        reverbSendGain = ctx.createGain();
        reverbSendGain.gain.value = opts.reverbSend;
        layerGain.connect(reverbSendGain);
        reverbSendGain.connect(reverbInput);
    }

    const N = opts.numVoices;
    const T = opts.period;
    const direction = opts.direction || 'down';
    const fLow = opts.fLow;
    const fHigh = opts.fHigh;
    const STEP = 0.1;          // 100 ms ramp granularity
    const AHEAD = 30;          // schedule 30 s in advance

    const voices = [];
    for (let i = 0; i < N; i++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        o.connect(g); g.connect(layerGain);
        o.start();
        voices.push({ o, g, phaseOffset: i / N });
    }

    function freqAtPhase(phase) {
        // Direction='down': at phase 0, freq = fHigh; at phase 1, freq = fLow.
        // Direction='up':   at phase 0, freq = fLow;  at phase 1, freq = fHigh.
        return direction === 'down'
            ? fHigh * Math.pow(fLow / fHigh, phase)
            : fLow  * Math.pow(fHigh / fLow, phase);
    }
    function envAtPhase(phase) {
        // Hann window — 0 at endpoints, 1 at midpoint
        return Math.max(0.0001, 0.5 * (1 - Math.cos(2 * Math.PI * phase)));
    }

    let lastScheduledTime = 0;
    function scheduleAhead() {
        const ctxNow = ctx.currentTime;
        const startT = Math.max(lastScheduledTime, ctxNow);
        const endT = ctxNow + AHEAD;

        const firstPass = (lastScheduledTime === 0);
        voices.forEach(v => {
            if (firstPass) {
                const phase = ((startT / T) + v.phaseOffset) % 1;
                v.o.frequency.setValueAtTime(freqAtPhase(phase), startT);
                v.g.gain.setValueAtTime(envAtPhase(phase), startT);
            }
            for (let t = startT + STEP; t <= endT; t += STEP) {
                const phase = ((t / T) + v.phaseOffset) % 1;
                v.o.frequency.linearRampToValueAtTime(freqAtPhase(phase), t);
                v.g.gain.linearRampToValueAtTime(envAtPhase(phase), t);
            }
        });
        lastScheduledTime = endT;
    }

    scheduleAhead();
    const refillId = setInterval(scheduleAhead, (AHEAD * 1000) / 2);

    return {
        stoppables: voices.map(v => v.o),
        intervals: [refillId],
    };
}

function _initEventEngine(prismId) {
    const cfg = CHAMBER_PROFILES[prismId];
    if (!cfg) return false;

    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;

    // Master fade (smooth in/out independent of any modulation)
    const fade = ctx.createGain();
    fade.gain.value = 0;
    // User volume (top-centre slider) — dedicated node, independent of the
    // fade-in / video / archway ramps that operate on `fade`.
    const userVol = ctx.createGain();
    userVol.gain.value = (window.__leilanVolume ?? 1);
    fade.connect(userVol);
    userVol.connect(ctx.destination);
    window.__applyLeilanVolume = (g) => {
        try { userVol.gain.setTargetAtTime(g, ctx.currentTime, 0.03); } catch (e) {}
    };

    const master = ctx.createGain();
    master.gain.value = cfg.masterGain;
    master.connect(fade);

    // ---- Shared chamber reverb bus ---------------------------------------
    const conv = ctx.createConvolver();
    conv.buffer = _createChamberIR(ctx, cfg.reverb.dur, cfg.reverb.decay);
    const reverbDamp = ctx.createBiquadFilter();
    reverbDamp.type = 'lowpass';
    reverbDamp.frequency.value = cfg.reverb.damping;
    const wetGain = ctx.createGain();
    wetGain.gain.value = cfg.reverb.wet;
    conv.connect(reverbDamp); reverbDamp.connect(wetGain); wetGain.connect(master);

    // Dry bus — small direct signal so droplets retain attack identity
    const dryGain = ctx.createGain();
    dryGain.gain.value = cfg.dryLevel;
    dryGain.connect(master);

    // Event submix: all per-event voices route here; eventBus feeds both
    // dry bus and reverb input, plus a few irregular delay taps.
    const eventBus = ctx.createGain();
    eventBus.gain.value = 1.0;
    eventBus.connect(conv);
    eventBus.connect(dryGain);

    // Irregular delay taps (early-reflection feel from a different geometry)
    cfg.delayTaps.forEach(t => {
        const d = ctx.createDelay(2.0);
        d.delayTime.value = t.time;
        const g = ctx.createGain();
        g.gain.value = t.gain;
        const p = ctx.createStereoPanner();
        p.pan.value = t.pan;
        eventBus.connect(d); d.connect(g); g.connect(p); p.connect(conv);
    });

    // ---- Low vapour bed --------------------------------------------------
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = cfg.bed.filter.type;
    bedFilter.frequency.value = cfg.bed.filter.freq;
    bedFilter.Q.value = cfg.bed.filter.Q;

    // Dedicated amplitude node on the bed — the LFOs modulate this so the
    // drone audibly swells in and out like a slow wave.
    const bedAmp = ctx.createGain();
    bedAmp.gain.value = 1.0;
    bedFilter.connect(bedAmp);
    bedAmp.connect(master);

    // Touch of bed into reverb so it shares chamber presence
    const bedReverbSend = ctx.createGain();
    bedReverbSend.gain.value = cfg.bed.reverbSend;
    bedAmp.connect(bedReverbSend); bedReverbSend.connect(conv);

    const bedOscs = [];
    const bedLayerLfos = [];   // per-layer ampLfo oscillators (need .stop() on teardown)
    cfg.bed.layers.forEach(L => {
        const o = ctx.createOscillator();
        o.type = L.type;
        o.frequency.value = L.freq;
        const g = ctx.createGain();
        g.gain.value = L.gain;
        o.connect(g); g.connect(bedFilter);
        o.start();
        bedOscs.push(o);

        // Optional per-layer ampLfo: independent slow swell on this layer's gain.
        // Used so individual bed voices (e.g. the high glimmer) can come and go
        // independently of the shared bedAmp wave.
        if (L.ampLfo) {
            const llfo = ctx.createOscillator();
            llfo.type = 'sine';
            llfo.frequency.value = L.ampLfo.rate;
            const llfoGain = ctx.createGain();
            llfoGain.gain.value = L.ampLfo.depth;
            llfo.connect(llfoGain); llfoGain.connect(g.gain);
            llfo.start();
            bedLayerLfos.push(llfo);
        }
    });

    // Bed filter LFO (slow cutoff sweep)
    const fLfo = ctx.createOscillator();
    fLfo.type = 'sine';
    fLfo.frequency.value = cfg.bed.filterLfoRate;
    const fLfoGain = ctx.createGain();
    fLfoGain.gain.value = cfg.bed.filterLfoDepth;
    fLfo.connect(fLfoGain); fLfoGain.connect(bedFilter.frequency);
    fLfo.start();

    // Bed amp LFOs — two slow sines at incommensurate rates sum into bedAmp.gain.
    // The base gain is 1.0, so total swing is ~(1 - depth1 - depth2) .. (1 + depth1 + depth2).
    const aLfo = ctx.createOscillator();
    aLfo.type = 'sine';
    aLfo.frequency.value = cfg.bed.ampLfoRate;
    const aLfoGain = ctx.createGain();
    aLfoGain.gain.value = cfg.bed.ampLfoDepth;
    aLfo.connect(aLfoGain); aLfoGain.connect(bedAmp.gain);
    aLfo.start();

    const aLfo2 = ctx.createOscillator();
    aLfo2.type = 'sine';
    aLfo2.frequency.value = cfg.bed.ampLfoRate2 || 0.0072;
    const aLfo2Gain = ctx.createGain();
    aLfo2Gain.gain.value = cfg.bed.ampLfoDepth2 || 0.0;
    aLfo2.connect(aLfo2Gain); aLfo2Gain.connect(bedAmp.gain);
    aLfo2.start();

    // ---- Optional Shepard tone layer (Mythos chamber uses this) --------
    // Routed directly to master + reverb (bypasses bedFilter, since its
    // upper voices need to be heard intact).
    let shepardStoppables = [];
    let shepardIntervals = [];
    if (cfg.shepard) {
        const sh = _createShepardEngine(ctx, master, conv, cfg.shepard);
        shepardStoppables = sh.stoppables;
        shepardIntervals = sh.intervals;
    }

    // ---- Event scheduler -------------------------------------------------
    const timers = [];
    const startTime = ctx.currentTime;

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // Randomise where in the density breath each visit begins, so arrival is
    // never pinned to the same point of the cycle (the un-offset sine starts at
    // its trough — the quietest possible moment to walk in on).
    const densityPhase0 = Math.random() * 2 * Math.PI;
    // Warm start: for the first introBoostSec, hold density at/above introTarget
    // (default: the midpoint of the breath) so the chamber feels alive on
    // arrival, then relaxes into its natural sparse breath.
    const introBoostSec = cfg.density.introBoostSec ?? 75;
    const introTarget = cfg.density.introTarget
        ?? (cfg.density.eventsPerMinMin
            + 0.5 * (cfg.density.eventsPerMinMax - cfg.density.eventsPerMinMin));

    function densityNow() {
        const t = ctx.currentTime - startTime;
        const phase = densityPhase0 + (t / cfg.density.cyclePeriod) * 2 * Math.PI;
        const x = 0.5 - 0.5 * Math.cos(phase);   // 0..1
        let d = cfg.density.eventsPerMinMin
              + x * (cfg.density.eventsPerMinMax - cfg.density.eventsPerMinMin);
        const warm = Math.max(0, 1 - t / introBoostSec);   // 1 → 0 over introBoostSec
        if (warm > 0) {
            const floor = cfg.density.eventsPerMinMin
                        + warm * (introTarget - cfg.density.eventsPerMinMin);
            if (floor > d) d = floor;
        }
        return d;
    }

    function fireDroplet(pitchArr) {
        if (!_audioCtx || _audioCtx.state === 'closed') return;
        const freq = pick(pitchArr || cfg.pitchPool.droplet);
        const peak = cfg.droplet.gainMin
                   + Math.random() * (cfg.droplet.gainMax - cfg.droplet.gainMin);
        const dur = cfg.droplet.decayMin
                  + Math.random() * (cfg.droplet.decayMax - cfg.droplet.decayMin);
        const attack = cfg.droplet.attackMin
                     + Math.random() * (cfg.droplet.attackMax - cfg.droplet.attackMin);
        let glissCents = 0;
        if (cfg.droplet.glissProb && Math.random() < cfg.droplet.glissProb) {
            const range = cfg.droplet.glissCents || 50;
            glissCents = (Math.random() - 0.5) * 2 * range;   // ±range cents
        }
        _spawnModalDroplet(_audioCtx, eventBus, {
            freq, ratios: cfg.modalRatios, peak, attack, dur,
            pan: (Math.random() - 0.5) * (cfg.stereoSpread || 1.6),
            glissCents,
        });
    }

    function fireCluster() {
        const count = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            timers.push(setTimeout(() => fireDroplet(), 100 + Math.random() * 4500));
        }
    }

    function fireShimmer() {
        const sh = cfg.shimmer;
        const n = sh.minCount + Math.floor(Math.random() * (sh.maxCount - sh.minCount + 1));
        for (let i = 0; i < n; i++) {
            const when = Math.random() * sh.window * 1000;
            timers.push(setTimeout(() => {
                if (!_audioCtx || _audioCtx.state === 'closed') return;
                const freq = pick(cfg.pitchPool.shimmer);
                _spawnModalDroplet(_audioCtx, eventBus, {
                    freq, ratios: cfg.modalRatios, peak: sh.gainPer,
                    attack: 0.006 + Math.random() * 0.02,
                    dur: 1.0 + Math.random() * 1.8,
                    pan: (Math.random() - 0.5) * 1.8,
                });
            }, when));
        }
    }

    function fireBell() {
        const f = pick(cfg.bell.fundamentals);
        const dur = cfg.bell.durMin + Math.random() * (cfg.bell.durMax - cfg.bell.durMin);
        _spawnGlassBell(_audioCtx, eventBus, {
            freq: f, peak: cfg.bell.gain, dur,
            pan: (Math.random() - 0.5) * 0.8,
            partials: cfg.bell.partials,
        });
    }

    function fireWash() {
        const f = pick(cfg.wash.fundamentals);
        const dur = cfg.wash.durMin + Math.random() * (cfg.wash.durMax - cfg.wash.durMin);
        _spawnReverseSwell(_audioCtx, eventBus, {
            freq: f, peak: cfg.wash.gain, dur,
            pan: (Math.random() - 0.5) * (cfg.wash.stereoSpread || 1.2),
        });
    }

    let lastBellAt = 0;
    let lastShimmerAt = 0;
    let lastWashAt = 0;

    function tick() {
        if (!_audioCtx || _audioCtx.state === 'closed') return;
        const now = _audioCtx.currentTime;

        // 1. Decide the body of this event
        const r = Math.random();
        // Suppress long pauses during the opening window — no dead-air arrivals.
        const introGuardSec = cfg.density.introGuardSec ?? 30;
        const sinceStart = now - startTime;
        if (sinceStart > introGuardSec && r < cfg.density.longPauseProbability) {
            // Long quiet pause — just schedule the next tick further out
            const wait = 20 + Math.random() * 25;   // 20–45s
            timers.push(setTimeout(tick, wait * 1000));
            return;
        }
        if (r < cfg.density.longPauseProbability + cfg.density.clusterProbability) {
            fireCluster();
        } else {
            fireDroplet();
        }

        // 2. Maybe layer a bell accent
        if (cfg.bell && now - lastBellAt > cfg.bell.intervalMin
            && Math.random() < cfg.bell.triggerProb) {
            fireBell();
            lastBellAt = now;
        }

        // 3. Maybe layer a shimmer cluster
        if (cfg.shimmer && now - lastShimmerAt > cfg.shimmer.intervalMin
            && Math.random() < cfg.shimmer.triggerProb) {
            fireShimmer();
            lastShimmerAt = now;
        }

        // 3b. Maybe layer a reverse-swell wash (OVS-style "smeared colour")
        if (cfg.wash && now - lastWashAt > cfg.wash.intervalMin
            && Math.random() < cfg.wash.triggerProb) {
            fireWash();
            lastWashAt = now;
        }

        // 4. Schedule next event using a Poisson-style exponential inter-arrival
        const d = densityNow();
        const mean = 60 / d;
        const u = Math.max(0.001, Math.random());
        const interval = -Math.log(u) * mean;
        timers.push(setTimeout(tick, interval * 1000));
    }
    // First event after a brief settle (0.4–1.0 s) — land a drip/chime soon
    timers.push(setTimeout(tick, 400 + Math.random() * 600));

    // Populate _droneNodes in the shape the legacy teardown expects.
    // `oscs`/`lfo`/`filterLfo`/`extraLfos`/`textureStoppables` get .stop()
    // wrapped in try/catch; `textureTimers` gets clearTimeout()'d.
    // Merge Shepard refill-intervals into the same timers array the scheduler
    // pushes to at runtime — so cleanup catches everything via one reference.
    shepardIntervals.forEach(id => timers.push(id));

    _droneNodes = {
        oscs: bedOscs,
        gains: [],
        filter: bedFilter,
        master,
        fade,
        lfo: fLfo,
        filterLfo: aLfo,
        extraLfos: [aLfo2, ...bedLayerLfos],
        textureBus: eventBus,
        // Shepard oscillators get stopped alongside texture nodes; Shepard
        // setInterval IDs share the textureTimers cleanup (clearTimeout
        // works on setInterval IDs in browsers).
        textureStoppables: shepardStoppables,
        textureTimers: timers,
    };

    // Fade in
    fade.gain.setValueAtTime(0, ctx.currentTime);
    fade.gain.linearRampToValueAtTime(1, ctx.currentTime + cfg.fadeInSec);

    return true;
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

    // Chambers with a CHAMBER_PROFILES entry use the new event-based engine.
    // Everything else falls through to the legacy stacked-oscillator path.
    if (CHAMBER_PROFILES[_prismId]) {
        _droneStarted = true;
        if (_initEventEngine(_prismId)) return;
        // Engine failed for some reason — leak _droneStarted=true so we don't retry.
        return;
    }

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

// Auto-start drone after 1.5s. AudioContext may be suspended (browser autoplay
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
}, 1500);

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

    // All <img> elements on the page. Wait on decode() — download AND decode to a
    // paint-ready bitmap — not just the load event. Otherwise a large background
    // (e.g. a moiré WebP) finishes downloading, the curtain lifts after two frames,
    // and the bitmap paints a beat later: the piecemeal "black wall, then moiré"
    // reveal. decode() holds the curtain until the image can actually be painted.
    document.querySelectorAll('img').forEach(img => {
        if (img.decode) {
            promises.push(img.decode().catch(() => {}));
        } else if (!img.complete) {
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
            preload.src = url;
            // decode() = paint-ready (see the <img> note above); fall back to load.
            promises.push(preload.decode
                ? preload.decode().catch(() => {})
                : new Promise(r => { preload.onload = r; preload.onerror = r; }));
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

// --- Tab-return curtain: coming back to a long-backgrounded tab, Chrome has
// usually evicted the decoded wall bitmaps and their GPU layers. The sky
// canvas (JS-painted) reappears instantly while the walls re-rasterise —
// walls visibly "rebuild" over sky. Fix: cover the scene SYNCHRONOUSLY inside
// the visibilitychange handler, so the tab's first paint after unhide is the
// curtain rather than the ragged scene; re-decode the chamber imagery behind
// it; lift with a quick fade. Short absences skip the curtain entirely —
// eviction is unlikely and a flash would be worse. Also covers back/forward-
// cache restores (they fire the same visible transition).
//
// IMPORTANT (2026-07-14, round 2): img.decode() alone is NOT a sufficient
// lift condition here. On tab return the ENCODED image data is usually still
// in memory cache, so decode() resolves in ~a frame — but what got evicted is
// the rasterised GPU textures of the big composited 3D wall layers, and the
// compositor takes several hundred ms to rebuild those. The load-time curtain
// never hit this because fresh downloads gave raster ample time. So the
// curtain now ALSO holds a minimum visible time (RETURN_CURTAIN_MIN_MS) —
// long enough for re-raster to finish under cover, short enough to read as a
// deliberate re-entry beat rather than a wait.
{
    const RETURN_MIN_HIDDEN_MS = 10000;
    const RETURN_CURTAIN_MIN_MS = 600;   // covers compositor re-raster/upload
    let _hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            _hiddenAt = performance.now();
            return;
        }
        if (!_hiddenAt || performance.now() - _hiddenAt < RETURN_MIN_HIDDEN_MS) return;
        _hiddenAt = 0;
        if (document.getElementById('return-curtain')) return;
        const shownAt = performance.now();
        const c = document.createElement('div');
        c.className = 'scene-curtain';
        c.id = 'return-curtain';
        c.setAttribute('aria-hidden', 'true');
        c.style.transition = 'opacity 0.25s ease-out';
        document.body.appendChild(c);
        const proms = [];
        document.querySelectorAll('.chamber img').forEach(img => {
            if (img.decode) proms.push(img.decode().catch(() => {}));
        });
        Promise.race([
            Promise.all(proms),
            new Promise(r => setTimeout(r, 1500)),   // never hold the room hostage
        ]).then(() => {
            // Hold until the minimum curtain time has elapsed (raster cover),
            // then two rAFs so the rebuilt frame is composited beneath the
            // curtain before it lifts.
            const wait = Math.max(0, RETURN_CURTAIN_MIN_MS - (performance.now() - shownAt));
            setTimeout(() => {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    c.style.opacity = '0';
                    c.addEventListener('transitionend', () => c.remove(), { once: true });
                    setTimeout(() => c.remove(), 600);   // safety net
                }));
            }, wait);
        });
    });
}

// --- Shrine: candles with random burn heights, ~18% lit, click to light ---
// --- Candle persistence: candles the visitor has lit stay lit across return
// visits (localStorage). The shrine accumulates a relationship with its pilgrim —
// the ambient ~18% randomly-lit candles still reshuffle each visit ("other
// visitors' candles"), but YOURS are always burning when you come back.
function _persistedShrineCandles() {
    try { return new Set(JSON.parse(localStorage.getItem('shrineLitCandles') || '[]')); }
    catch (e) { return new Set(); }
}
function rememberShrineCandle(idx) {
    try {
        const s = _persistedShrineCandles();
        s.add(idx);
        localStorage.setItem('shrineLitCandles', JSON.stringify([...s]));
    } catch (e) { /* private-mode etc. — the candle still lights this visit */ }
}

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
    // Candles this visitor lit on previous visits burn again (even the test-chain
    // candle, if they once lit it themselves) — but only the MOST RECENT few.
    // The persisted set grows monotonically (every candle ever clicked), so
    // without a cap a devoted pilgrim arrives to a shrine already ablaze; the
    // arrival should stay intimate — a few of "your" candles among the ambient.
    const PERSISTED_RELIT_MAX = 5;
    [..._persistedShrineCandles()].slice(-PERSISTED_RELIT_MAX).forEach(idx => {
        if (idx >= 0 && idx < candles.length) litSet.add(idx);
    });

    candles.forEach((candle, i) => {
        const isLit = litSet.has(i);
        // Unlit candles are full height (new); lit candles are partially burned down
        const burn = isLit ? 0.2 + Math.random() * 0.8 : 0;
        const bodyH = ((0.7 + (1 - burn) * 2.3) * 0.4).toFixed(2); // 0.28vh–1.2vh
        candle.querySelector('.candle-body').style.height = bodyH + 'vh';
        if (isLit) candle.classList.add('lit');
        if (i === TEST_CHAIN_CANDLE) candle.dataset.testChain = 'true';
        // Wall-glow breathing rhythm: every candle gets its own duration/phase
        // (set on lit and unlit alike, so candles lit by click later inherit one).
        candle.style.setProperty('--glow-dur', (2.4 + Math.random() * 2.4).toFixed(2) + 's');
        candle.style.setProperty('--glow-delay', (-Math.random() * 4).toFixed(2) + 's');
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
    if (resScrollUp)   resScrollUp.addEventListener('click',   () => results.scrollBy({ top: -resultsRowStep(results), behavior: 'smooth' }));
    if (resScrollDown) resScrollDown.addEventListener('click', () => results.scrollBy({ top:  resultsRowStep(results), behavior: 'smooth' }));

    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); results.scrollBy({ top:  resultsRowStep(results), behavior: 'smooth' }); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); results.scrollBy({ top: -resultsRowStep(results), behavior: 'smooth' }); }
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