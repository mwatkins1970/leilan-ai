// Pre-renders six 20×20 ASCII swarm animations for the ASCII Gallery walls.
// Output: public/data/ascii-swarms.json (one entry per wall).
//
// Each wall has its own algorithm (boids / sonar / matrix-rain / game-of-life /
// noise-bands / glitch-scan). The runtime player in prism.js loads the JSON
// once and steps through each wall's frame string at the chosen FPS, starting
// each wall at a random offset so it never looks the same twice.
//
// Run: node scripts/gen-ascii-swarms.mjs
//
// Each cell stores a single character; brightness is implicit in the
// character's natural visual weight (space=off, .=faint, *=mid, @=bright).
// No per-cell opacity needed at runtime — keeps the player nearly free.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dirname}/../public/data/ascii-swarms.json`;

const W = 20, H = 20, N = W * H;
const FPS = 10;
const FRAMES = 600;       // 60 seconds per wall at 10 fps
const SEED_BASE = 0xDEADBEEF;

// ----- Deterministic RNG (mulberry32) so generations are reproducible -----
function rng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ----- Energy → character mapping (brightness encoded by char glyph weight) -----
// Each tier offers 2-3 glyphs; we pick deterministically by cell index so the
// same energy doesn't always render the same character (more organic feel).
const TIERS = [
    { max: 0.08, chars: ' '            },
    { max: 0.18, chars: '.,`'           },
    { max: 0.30, chars: ':;'            },
    { max: 0.42, chars: '+~-'           },
    { max: 0.54, chars: '*=/'           },
    { max: 0.66, chars: 'oxc'           },
    { max: 0.78, chars: '#%&'           },
    { max: 0.90, chars: '$8'            },
    { max: 2.00, chars: '@M'            },
];
function encode(energy) {
    let s = '';
    for (let i = 0; i < energy.length; i++) {
        const e = energy[i];
        let chosen = ' ';
        for (const tier of TIERS) {
            if (e < tier.max) {
                chosen = tier.chars[i % tier.chars.length];
                break;
            }
        }
        s += chosen;
    }
    return s;
}

// =====================================================================
// 1. BOIDS — flocking agents leave glowing trails on a diffusion field
// =====================================================================
function genBoids() {
    const r = rng(SEED_BASE ^ 1);
    let energy = new Float32Array(N);
    let next   = new Float32Array(N);
    const NUM = 8;
    const agents = [];
    for (let i = 0; i < NUM; i++) {
        const a = r() * Math.PI * 2;
        agents.push({ x: r() * W, y: r() * H, vx: Math.cos(a) * 0.45, vy: Math.sin(a) * 0.45 });
    }
    for (let i = 0; i < 6; i++) energy[(r() * N) | 0] = 1.2;

    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        // diffuse + decay
        for (let y = 0; y < H; y++) {
            const yU = ((y - 1 + H) % H) * W, yD = ((y + 1) % H) * W, yC = y * W;
            for (let x = 0; x < W; x++) {
                const xL = (x - 1 + W) % W, xR = (x + 1) % W;
                const i = yC + x;
                next[i] = (
                    energy[i] * 0.50 +
                    (energy[yU + x] + energy[yD + x] + energy[yC + xL] + energy[yC + xR]) * 0.105 +
                    (energy[yU + xL] + energy[yU + xR] + energy[yD + xL] + energy[yD + xR]) * 0.022
                ) * 0.91;
            }
        }
        [energy, next] = [next, energy];

        // flocking
        const perc2 = 25;
        for (let i = 0; i < agents.length; i++) {
            const a = agents[i];
            let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, count = 0;
            for (let j = 0; j < agents.length; j++) {
                if (i === j) continue;
                const b = agents[j];
                let dx = b.x - a.x, dy = b.y - a.y;
                if (dx >  W * 0.5) dx -= W; else if (dx < -W * 0.5) dx += W;
                if (dy >  H * 0.5) dy -= H; else if (dy < -H * 0.5) dy += H;
                const d2 = dx * dx + dy * dy;
                if (d2 > 0 && d2 < perc2) {
                    ax += b.vx; ay += b.vy;
                    cx += dx; cy += dy;
                    if (d2 < 4) { const d = Math.sqrt(d2); sx -= dx / d; sy -= dy / d; }
                    count++;
                }
            }
            if (count > 0) {
                ax /= count; ay /= count; cx /= count; cy /= count;
                a.vx += (ax - a.vx) * 0.08 + cx * 0.010 + sx * 0.09;
                a.vy += (ay - a.vy) * 0.08 + cy * 0.010 + sy * 0.09;
            }
            a.vx += (r() - 0.5) * 0.06;
            a.vy += (r() - 0.5) * 0.06;
            const sp2 = a.vx * a.vx + a.vy * a.vy;
            const maxSp = 0.55;
            if (sp2 > maxSp * maxSp) { const sp = Math.sqrt(sp2); a.vx = a.vx / sp * maxSp; a.vy = a.vy / sp * maxSp; }
            a.x = (a.x + a.vx + W) % W;
            a.y = (a.y + a.vy + H) % H;
            const ei = ((a.y | 0) * W + (a.x | 0));
            energy[ei] = Math.min(1.5, energy[ei] + 0.95);
        }
        if (r() < 0.18) energy[(r() * N) | 0] = Math.min(1.5, energy[(r() * N) | 0] + 1.0);
        out[f] = encode(energy);
    }
    return out;
}

// =====================================================================
// 2. SONAR — concentric rings expand from random epicenters and interfere
// =====================================================================
function genSonar() {
    const r = rng(SEED_BASE ^ 2);
    let energy = new Float32Array(N);
    const rings = [];
    const MAX_R = Math.max(W, H) * 0.95;

    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        // decay
        for (let i = 0; i < N; i++) energy[i] *= 0.78;
        // spawn
        if (rings.length < 4 && (f % 22 === 0 || r() < 0.04)) {
            rings.push({ cx: r() * W, cy: r() * H, rad: 0, life: 1.0 });
        }
        // advance + draw
        for (let i = rings.length - 1; i >= 0; i--) {
            const ring = rings[i];
            ring.rad += 0.55;
            ring.life = 1 - ring.rad / MAX_R;
            if (ring.life <= 0) { rings.splice(i, 1); continue; }
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    let dx = x - ring.cx, dy = y - ring.cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const diff = Math.abs(dist - ring.rad);
                    if (diff < 1.4) {
                        const intensity = ring.life * (1 - diff / 1.4);
                        const ei = y * W + x;
                        if (energy[ei] < intensity * 1.2) energy[ei] = intensity * 1.2;
                    }
                }
            }
        }
        out[f] = encode(energy);
    }
    return out;
}

// =====================================================================
// 3. MATRIX RAIN — vertical falling streams, bright heads, decaying tails
// =====================================================================
function genMatrixRain() {
    const r = rng(SEED_BASE ^ 3);
    let energy = new Float32Array(N);
    const drops = [];
    function spawn() {
        drops.push({
            col: (r() * W) | 0,
            head: -r() * 6,
            len: 5 + ((r() * 10) | 0),
            speed: 0.4 + r() * 0.6,
        });
    }
    for (let i = 0; i < (W * 0.4) | 0; i++) spawn();

    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        // fade background slightly (gives smooth tails)
        for (let i = 0; i < N; i++) energy[i] *= 0.72;
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.head += d.speed;
            if (d.head - d.len > H + 2) { drops.splice(i, 1); continue; }
            for (let t = 0; t < d.len; t++) {
                const y = (d.head - t) | 0;
                if (y < 0 || y >= H) continue;
                const ei = y * W + d.col;
                const intensity = t === 0 ? 1.1 : Math.max(0, (1 - t / d.len) * 0.85);
                if (energy[ei] < intensity) energy[ei] = intensity;
            }
        }
        if (drops.length < W * 0.55 && r() < 0.35) spawn();
        out[f] = encode(energy);
    }
    return out;
}

// =====================================================================
// 4. GAME OF LIFE — Conway's rules, age maps to brightness, periodic reseed
// =====================================================================
function genGameOfLife() {
    const r = rng(SEED_BASE ^ 4);
    let state = new Uint8Array(N);
    let next  = new Uint8Array(N);
    function seed() {
        for (let i = 0; i < N; i++) state[i] = r() < 0.38 ? 1 : 0;
    }
    seed();
    let stableCount = 0;
    let prevPopulation = -1;

    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        let population = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
                if (state[ny * W + nx] > 0) count++;
            }
            const alive = state[y * W + x] > 0;
            if (alive && (count === 2 || count === 3)) {
                next[y * W + x] = Math.min(60, state[y * W + x] + 1);
                population++;
            } else if (!alive && count === 3) {
                next[y * W + x] = 1;
                population++;
            } else {
                next[y * W + x] = 0;
            }
        }
        if (population === prevPopulation) stableCount++; else stableCount = 0;
        prevPopulation = population;
        if (stableCount > 6 || population < 5) {
            // reseed — inject random cells to break stagnation
            for (let i = 0; i < N; i++) if (r() < 0.20) next[i] = 1;
            stableCount = 0;
        }
        [state, next] = [next, state];

        // map age → energy (newborns brightest, ancients fading)
        const energy = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const a = state[i];
            if (a === 0) continue;
            if (a === 1) energy[i] = 1.05;
            else if (a === 2) energy[i] = 0.85;
            else energy[i] = Math.max(0.20, 0.85 - (a - 2) * 0.04);
        }
        out[f] = encode(energy);
    }
    return out;
}

// =====================================================================
// 5. NOISE BANDS — drifting interference patterns from layered sinusoids
// =====================================================================
function genNoiseBands() {
    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        const energy = new Float32Array(N);
        const t = f * 0.05;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                // Three layered sinusoids at different scales + a slow drift
                const v = (
                    Math.sin(x * 0.32 + t * 0.7) * 0.40 +
                    Math.sin(y * 0.27 - t * 0.5) * 0.30 +
                    Math.sin((x + y) * 0.18 + t * 1.2) * 0.25 +
                    Math.sin(x * 0.61 - y * 0.41 + t * 0.3) * 0.20
                );
                const threshold = -0.15 + Math.sin(t * 0.21) * 0.18;
                const e = v - threshold;
                if (e > 0.05) energy[y * W + x] = Math.min(1.2, e * 1.4);
            }
        }
        out[f] = encode(energy);
    }
    return out;
}

// =====================================================================
// 6. GLITCH SCAN — horizontal scanlines sweep with vertical glitch columns
// =====================================================================
function genGlitchScan() {
    const r = rng(SEED_BASE ^ 6);
    let energy = new Float32Array(N);
    let scanY = 0;
    let scanSpeed = 0.35;
    let glitchColumns = []; // { col, life }
    const out = new Array(FRAMES);
    for (let f = 0; f < FRAMES; f++) {
        // decay residual
        for (let i = 0; i < N; i++) energy[i] *= 0.62;

        // advance scanline
        scanY += scanSpeed;
        if (scanY >= H + 3) { scanY = -3; scanSpeed = 0.25 + r() * 0.45; }

        // draw scanline band
        const scanCenter = scanY;
        for (let dy = -2; dy <= 2; dy++) {
            const y = (scanCenter + dy) | 0;
            if (y < 0 || y >= H) continue;
            const proximity = 1 - Math.abs(dy) * 0.4;
            for (let x = 0; x < W; x++) {
                if (r() < 0.65 * proximity) {
                    const ei = y * W + x;
                    const v = proximity * (0.6 + r() * 0.5);
                    if (energy[ei] < v) energy[ei] = v;
                }
            }
        }

        // sporadic vertical glitch columns
        if (r() < 0.08 && glitchColumns.length < 3) {
            glitchColumns.push({ col: (r() * W) | 0, life: 3 + (r() * 5) | 0 });
        }
        for (let i = glitchColumns.length - 1; i >= 0; i--) {
            const g = glitchColumns[i];
            for (let y = 0; y < H; y++) {
                if (r() < 0.55) {
                    const ei = y * W + g.col;
                    const v = 0.55 + r() * 0.45;
                    if (energy[ei] < v) energy[ei] = v;
                }
            }
            g.life--;
            if (g.life <= 0) glitchColumns.splice(i, 1);
        }

        // rare horizontal "tear" — full row briefly bright
        if (r() < 0.012) {
            const y = (r() * H) | 0;
            for (let x = 0; x < W; x++) {
                const v = 0.7 + r() * 0.4;
                const ei = y * W + x;
                if (energy[ei] < v) energy[ei] = v;
            }
        }

        out[f] = encode(energy);
    }
    return out;
}

// ----- assemble -----
const walls = [
    { name: 'boids',         frames: genBoids() },
    { name: 'sonar',         frames: genSonar() },
    { name: 'matrix-rain',   frames: genMatrixRain() },
    { name: 'game-of-life',  frames: genGameOfLife() },
    { name: 'noise-bands',   frames: genNoiseBands() },
    { name: 'glitch-scan',   frames: genGlitchScan() },
];

// Concatenate frames per wall into a single string (each frame is exactly W*H
// chars). At runtime the player slices substr(i * frameSize, frameSize).
const payload = {
    fps: FPS,
    w: W,
    h: H,
    frameSize: N,
    walls: walls.map(w => ({ name: w.name, frames: w.frames.length, data: w.frames.join('') })),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));

const sizeBytes = JSON.stringify(payload).length;
console.log(`Wrote ${OUT}`);
console.log(`  walls=${walls.length}  fps=${FPS}  frames=${FRAMES}  grid=${W}×${H}`);
console.log(`  size=${(sizeBytes / 1024).toFixed(1)} KB  (raw — gzip on Netlify will shrink)`);
for (const w of walls) {
    const sample = w.frames[0].substring(0, 40);
    console.log(`  ${w.name.padEnd(14)} ${w.frames.length}f  sample=[${sample.replace(/ /g, '·')}…]`);
}
