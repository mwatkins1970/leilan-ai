# AUDIO.md

# Generative Audio System — Complete Technical Reference

*Last updated: 2026-05-27.*

This document is written for future Claude Code instances working on the Leilan.ai audio system. Read it in full before making any audio changes. It covers every audio subsystem on the site: the Three.js immersive soundscape, the CSS prism chamber audio engine, video-audio interaction, and the per-chamber sound design with all current parameter values.

---

## Overview: Where Audio Lives

Audio exists in two separate pages with independent AudioContext lifecycles:

1. **Immersive page** (`/immersive`) — `src/pages/immersive.astro`, lines ~2996–3249
   - Riley/Eno-inspired organ drone + shimmer + arpeggio pings
   - Rising tone during chamber ascent
   - Fades out as the camera descends into the chamber and the page navigates away

2. **CSS prism chambers** (`/prism/[id]`) — `public/scripts/prism.js`, lines ~4090–5700
   - Event-based generative ambience (7 chamber variants)
   - Video-audio fade interaction
   - Archway exit fade

There is no shared audio state between the two pages. Each creates and destroys its own AudioContext.

---

# Part 1: Immersive Soundscape

**File**: `src/pages/immersive.astro`, lines ~2996–3249.

### Architecture

```text
initImmersiveSoundscape() creates:
  Layer 1: Organ drone (stacked fifths C2–C4, triangle+sine, through 800Hz LP with 0.04Hz sweep LFO)
  Layer 2: Shimmer pairs (E4 detuned pair, B4, E5 detuned pair, through 1600Hz LP with 0.06Hz sweep LFO)
  Layer 3: Cascading arpeggio pings (Riley-esque, C major scale, 1.5–4s Poisson spacing, 2.8s decay)
  Layer 4: Sub-bass (C1 = 32.7Hz sine, 0.1Hz amplitude LFO)

All layers → feedback delay network (two cross-fed delays at 0.37s/0.53s, LP 2400Hz) → master (0.55) → fade → userVol → destination
```

### Signal Chain

```text
organ drone (5 voices, C2/G2/C3/G3/C4) → organLP (800Hz, Q=1.5) → master + wetSend
shimmer (5 voices, E4 pair/B4/E5 pair) → shimLP (1600Hz, Q=0.7) → master + wetSend
arp pings (one-shot sine, Poisson ~2.5s mean) → arpGain (0.07) → master + wetSend
sub-bass (C1 sine, 0.14 gain, 0.1Hz LFO) → master

wetSend (0.35) → delay1 (0.37s) ↔ delay2 (0.53s) [feedback 0.42/0.38] → reverbLP (2400Hz) → master
master (0.55) → fade → userVol → destination
```

### Lifecycle

1. `initImmersiveSoundscape()` is called 1.5s after page load (with user-gesture fallback for autoplay policy)
2. Fade-in: 6 seconds (linear ramp on `fade.gain` from 0→1)
3. **Rising tone** (`startRisingTone()`): Fired at the `highlight→rising` phase transition when the chamber starts visibly ascending
   - Three layers: C3→C5 sine, G3→G5 triangle (fifth above), C3→C5 detuned sine (shimmer)
   - Envelope: 4s ascent (pitch climb) → 3s plateau at C5 → 7s fade (total 14s)
   - Per-layer peak gains: 0.0675, 0.0375, 0.045 (75% of original mix)
   - Through 400→3000Hz LP that opens during ascent
   - Connected directly to `master` (bypasses wetSend)
   - Guarded by `_risingToneFired` flag (fires once per page load)
4. **Fade-out** (`fadeOutImmersiveSoundscape(1.5)`): Called at camera_move phase when s > 0.48
   - Cancels arpeggio scheduling
   - 1.5s linear ramp on `fade.gain` to 0
   - After fade completes (+50ms): stops all oscillators/LFOs, closes AudioContext
   - Simultaneous with the visual blackout overlay that fades in over 1.5s
   - Page navigates to the prism chamber URL when the blackout transition ends

### Key Variables

- `_imAudioCtx` — the immersive page's AudioContext (null after teardown)
- `_imDroneNodes` — `{ master, fade, allOscs, allLfos }`
- `_imStarted` — prevents double-init
- `_imArpId` — setTimeout ID for the next arpeggio ping
- `_risingToneFired` — prevents double-firing the rising tone

### AudioContext Unlock

Multiple user-gesture listeners (`pointerdown`, `keydown`, `mousemove`, `click`, `touchstart`) attempt to resume a suspended AudioContext. Listeners self-remove after success. Additional fallback at the 1.5s auto-start: if suspended, adds click/keydown listeners specifically for resume.

---

# Part 2: CSS Prism Chamber Audio

**File**: `public/scripts/prism.js`.

All audio code is in this single file (~5,900 lines total). The file is large — never read the whole thing; use line-range reads and grep for the function/symbol you need.

## Two-Tier System

**Tier 1: Event-Based Engine** (all 7 chambers now use this)
- Chambers with entries in `CHAMBER_PROFILES` (around lines 4090–4990)
- Sparse, stochastic event model with Poisson-distributed timing
- Shared convolution reverb bus (procedural impulse response)
- Low "vapour bed" with slow amplitude/filter LFOs
- Optional Shepard tone layer (Mythos only)
- Optional wash layer (OVS only)

**Tier 2: Legacy Stacked-Oscillator Drones** (vestigial, unused)
- `CHAMBER_DRONES` object (around lines 5520–5720)
- Still contains entries for main, research-lab, art-gallery, ovs-chapel, mythopoeic-archive
- These are NEVER reached because `initDrone()` checks `CHAMBER_PROFILES` first and all chambers have profiles
- Kept as fallback but can be safely removed in future cleanup

## Code Section Map

| Lines (approx.) | Section |
|---|---|
| 36–120 | Global audio init, chamber ID detection (`_prismId`), state variables |
| 2020–2027 | `_fadeAudioForVideo()` — video-audio interaction |
| 2029–2108 | `openWallVideo()` / `closeWallVideo()` — video overlay with audio fade |
| 1386–1415 | `fadeOutDrone()` — archway exit fade (2s, then full teardown) |
| 3716–4065 | Legacy voice synthesis functions (`_synthBell`, `_synthDroplet`, `_synthPageTurn`, etc.) |
| 4090–4990 | `CHAMBER_PROFILES` — all 7 event-based chamber configurations |
| 4995–5163 | Event-based voice spawners: `_spawnModalDroplet`, `_spawnReverseSwell`, `_spawnGlassBell`, Shepard engine |
| 5170–5245 | Shepard tone scheduling loop (`_createShepardEngine`) |
| 5250–5540 | Event engine: `_initEventEngine()` — density modulation, scheduler, Poisson timing, `tick()` loop |
| 5520–5720 | `CHAMBER_DRONES` — legacy fallback configs (unused, all chambers have CHAMBER_PROFILES entries) |
| 5730–5880 | `initDrone()` — entry point, AudioContext creation, browser autoplay handling |

## Chamber Detection & Startup

```javascript
const _prismId = location.pathname.match(/\/prism\/([^/?#]+)/)?.[1] || '';
```

`initDrone()` (around line 5730) runs 1.5s after page load:
1. Checks `CHAMBER_PROFILES[_prismId]` → uses `_initEventEngine()` if found
2. Else checks `CHAMBER_DRONES[_prismId]` → uses legacy drone if found
3. Else returns (no audio)

Browser autoplay: if AudioContext is suspended, click/keydown listeners resume it (self-removing).

## Audio Signal Chain (Event-Based Engine)

Built by `_initEventEngine()` (around line 5250):

```text
Per-event voices (droplet / bell / shimmer / wash / Shepard)
    → eventBus (gain 1.0)
        → convolution reverb (procedural IR) → dampingLP → wetGain → master
        → dryGain → master
        → delay taps (4–6 per chamber, irregular spacing + stereo pan) → reverb input

Low vapour bed (continuous, very quiet)
    → bedFilter (lowpass, LFO-swept cutoff)
    → bedAmp (dual-LFO amplitude modulation)
        → master
        → bedReverbSend → reverb input

Shepard tone (if configured)
    → layerGain → master
    → optional reverbSendGain → reverb input

master (per-chamber masterGain) → fade (0→1 ramp over fadeInSec) → userVol → destination
```

### Key Nodes (stored in `_droneNodes`)

| Field | What it is |
|---|---|
| `oscs` | Array of bed oscillators (need `.stop()` on teardown) |
| `filter` | Bed lowpass BiquadFilter |
| `master` | GainNode with `masterGain` value |
| `fade` | GainNode for fade-in/out (0→1 on start, ramped to 0 on exit/video) |
| `lfo` | Filter LFO oscillator |
| `filterLfo` | Amplitude LFO #1 oscillator |
| `extraLfos` | Array: amplitude LFO #2 + per-layer amplitude LFOs |
| `textureBus` | The eventBus GainNode |
| `textureStoppables` | Shepard oscillators (if any) |
| `textureTimers` | Array of all setTimeout/setInterval IDs (event scheduler + Shepard refill) |

### Teardown

`fadeOutDrone(duration)` (line 1386): Used when exiting via archway.
1. Ramps `fade.gain` to 0 over `duration` (currently 2s for archway exit)
2. Immediately clears all `textureTimers` (stops scheduling new events)
3. After fade + 50ms: stops all oscillators/LFOs, closes AudioContext, nulls `_droneNodes`

## Event Scheduler

The `tick()` function (around line 5465) implements a Poisson-process event scheduler:

1. Roll against `longPauseProbability` → if hit, schedule next tick 20–45s later and return
2. Roll against `clusterProbability` → if hit, fire 3–6 droplets over 0.1–4.5s
3. Otherwise fire a single droplet
4. Check bell gate + probability → maybe fire a bell accent
5. Check shimmer gate + probability → maybe fire a shimmer cluster
6. Check wash gate + probability → maybe fire a wash event (OVS only)
7. Compute next tick interval: exponential distribution with mean = 60/densityNow() seconds

`densityNow()` returns a sine-modulated value between `eventsPerMinMin` and `eventsPerMinMax`, cycling over `cyclePeriod` seconds. The sine phase is **randomised per visit** (`densityPhase0`), so arrival is never pinned to the trough.

**Warm start (added 2026-05-29).** For the first `introBoostSec` seconds (default 75), `densityNow()` holds density at or above `introTarget` (default: the midpoint of the breath), decaying linearly back to the natural sine. This guarantees every chamber feels alive on arrival, then relaxes into its natural sparse breath. Both are overridable per-chamber in the `density` block (`introBoostSec`, `introTarget`).

**No dead-air openings (added 2026-05-29).** `tick()` suppresses the `longPause` roll for the first `introGuardSec` seconds (default 30, overridable per-chamber), so a visit can never open with 20–45s of silence.

First tick fires at **0.4–1.0s** after engine init, and `initDrone()` now starts the engine **1.5s** after page load (was 2.5s) — so the first drip/chime lands within ~2s of entering a chamber.

## Voice Spawners

### `_spawnModalDroplet(ctx, dest, opts)` (~line 4995)
Creates N bandpass-filtered oscillators (one per `modalRatio`) with exponential decay envelope. Optional glissando (linear frequency ramp over the decay). Stereo-panned via StereoPanner.

### `_spawnGlassBell(ctx, dest, opts)` (~line 5105)
Similar to droplet but uses the bell's custom `partials` array (if provided) or falls back to `modalRatios`. Longer durations, softer attack. "Swelling glass" character.

### `_spawnReverseSwell(ctx, dest, opts)` (~line 5060)
Reversed envelope: slow attack (70% of duration), brief peak, quick decay. Each partial gets independent slow pitch wobble (0.045–0.135 Hz, ±0.5%) for the "smeared colour" quality. Used by OVS wash events.

### `_createShepardEngine(ctx, dest, reverbInput, opts)` (~line 5170)
Creates N oscillators phase-offset by 1/N of the period. Each voice sweeps logarithmically between fLow and fHigh, with a Hann window envelope (silent at endpoints, loudest at midpoint). A setInterval refill loop schedules frequency/gain ramps 30s ahead in 100ms steps.

- Direction `'up'`: phase 0 = fLow, phase 1 = fHigh (ascending illusion)
- Direction `'down'`: phase 0 = fHigh, phase 1 = fLow (descending illusion)

---

## Video-Audio Interaction

**File**: `public/scripts/prism.js`, lines ~2020–2108.

When a video is played inside a wall text frame, the chamber audio fades out so the video isn't competing with ambient sound.

### `_fadeAudioForVideo(out)` (line 2020)

```javascript
function _fadeAudioForVideo(out) {
    if (!_audioCtx || !_droneNodes || !_droneNodes.fade) return;
    const now = _audioCtx.currentTime;
    const g = _droneNodes.fade.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(out ? 0 : 1, now + (out ? 3 : 8));
}
```

- **Fade out**: 3 seconds (audio fully silent before video starts)
- **Fade in**: 8 seconds (slow, gentle return after video ends)
- Uses the same `_droneNodes.fade` gain node as the chamber fade-in and archway fade-out

### Flow

1. User clicks a `▶ video` button inside a wall text frame
2. `openWallVideo(wallNum)` is called:
   - Closes the text frame (`closeFrameOnWall`)
   - Calls `_fadeAudioForVideo(true)` immediately — 3s audio fade-out begins
   - Creates the video overlay with loading spinner
   - Video element starts loading (`preload: 'auto'`)
   - **Video playback is delayed**: the `canplay` handler waits until 2.7s after the button click before starting playback — this ensures the 3s audio fade is nearly complete (tiny 0.3s crossover) before the video sound begins
   - `video.ended` listener calls `_fadeAudioForVideo(false)` for auto-return
3. User dismisses via X button or clicks outside the video:
   - `closeWallVideo(wallNum)` pauses and removes the video element
   - Calls `_fadeAudioForVideo(false)` — 8s audio fade-in begins
   - The overlay fade-out transition removes the DOM element on `transitionend`

### Current Video Status

Only one video is currently wired: Crossbones (`/video/crossbones.mp4`) on Mythopoeic Archive wall 6. All other word-panel `▶ video` buttons are in the disabled placeholder state (`.wall-video-disabled`). When future videos are added, they will automatically get the same audio fade behavior — all videos go through `openWallVideo`/`closeWallVideo`.

---

## Archway Exit Audio

When the user clicks an archway door to leave a chamber:

1. `enterArchway(wallNum)` (line 1417) calls `fadeOutDrone(2.0)`
2. Audio fades to zero over 2 seconds
3. All event timers are cleared immediately (no new events fire during fade)
4. After fade + 50ms: oscillators stopped, AudioContext closed, nodes nulled
5. The archway zoom animation runs concurrently (3.2s total) and the page navigates away

---

# Part 3: Chamber Sound Design

## `CHAMBER_PROFILES` Entry Structure

Each profile is a plain JS object keyed by `_prismId`. All profiles live in the `CHAMBER_PROFILES` object (lines ~4090–4990). Follow the pattern of existing entries when adding or modifying.

```text
CHAMBER_PROFILES['chamber-id'] = {
    masterGain: <number>,              // overall volume (see Volume Normalization below)
    fadeInSec: <number>,               // seconds for initial 0→1 fade

    pitchPool: {
        droplet: [...Hz],              // frequencies for droplet events (weighted by repetition)
        shimmer: [...Hz],              // frequencies for shimmer pings (upper register)
    },
    modalRatios: [                     // bandpass partial stack for droplets
        { r: <ratio>, a: <amplitude>, q: <Q> },
        ...
    ],

    droplet: {
        gainMin, gainMax,              // per-event peak amplitude range
        decayMin, decayMax,            // seconds
        attackMin, attackMax,          // seconds
        glissProb?,                    // probability of pitch glissando (0–1)
        glissCents?,                   // ± cents range for glissando
    },
    stereoSpread?,                     // per-event pan range (default 1.6)

    density: {
        eventsPerMinMin,               // sine-modulated lower bound
        eventsPerMinMax,               // sine-modulated upper bound
        cyclePeriod,                   // seconds per full density sine cycle
        clusterProbability,            // chance per tick of 3–6 droplet burst
        longPauseProbability,          // chance per tick of 20–45s silence
    },

    bell?: {
        gain,                          // peak amplitude
        durMin, durMax,                // seconds
        intervalMin,                   // minimum seconds between bells (gate)
        triggerProb,                   // probability per tick
        fundamentals: [...Hz],         // pitch pool for bell events
        partials?: [{ r, a }],         // custom partial stack (else uses modalRatios)
    },

    shimmer?: {
        intervalMin,                   // minimum seconds between shimmers (gate)
        triggerProb,                   // probability per tick
        minCount, maxCount,            // number of pings per cluster
        gainPer,                       // gain per ping
        window,                        // seconds over which pings are scattered
    },

    wash?: {                           // OVS only — reverse-swell events
        gain, durMin, durMax,
        intervalMin, triggerProb,
        stereoSpread,
        fundamentals: [...Hz],
    },

    shepard?: {                        // Mythos only — Shepard tone
        fLow, fHigh,                   // Hz sweep range
        numVoices, period,             // voices and seconds per sweep
        direction,                     // 'up' or 'down'
        gain, reverbSend,
    },

    bed: {
        layers: [
            { freq, gain, type, ampLfo?: { rate, depth } },
            ...
        ],
        filter: { type, freq, Q },
        filterLfoRate,                 // Hz
        filterLfoDepth,                // Hz range
        ampLfoRate,                    // Hz (primary swell)
        ampLfoRate2?,                  // Hz (secondary swell, incommensurate)
        ampLfoDepth,                   // ±fraction of base gain
        ampLfoDepth2?,                 // ±fraction (secondary)
        reverbSend,                    // fraction of bed signal sent to reverb
    },

    reverb: {
        dur,                           // impulse response duration (seconds)
        decay,                         // exponential decay power
        wet,                           // wet gain multiplier
        damping,                       // lowpass cutoff on reverb tail (Hz)
    },
    dryLevel,                          // direct signal gain
    delayTaps: [                       // irregular early-reflection taps
        { time, gain, pan },
        ...
    ],
};
```

## Volume Normalization

All chambers were originally at `masterGain: 2.4`. They have been normalized to equalize perceived median volume across chambers, with the overall level reduced to 65% of original.

The normalization uses an energy proxy: `avg_density × avg_droplet_gain²` (proportional to perceived RMS power from events), then scales `masterGain` inversely by `√(energy_ratio)`.

**Current masterGain values (as of 2026-05-27):**

| Chamber | masterGain | Rationale |
|---|---|---|
| Central Shrine | 1.56 | Reference (2.4 × 0.65) |
| Art Gallery | 1.52 | Slightly denser than Shrine |
| Research Lab | 1.08 | High per-event gain + moderate density |
| OVS Chapel | 0.54 | Extreme density + wash events; dropped to 75% (was 0.72) — felt overwhelming |
| Scriptorium | 2.00 | Very sparse, quietest per-event gains |
| Mythos | 0.90 | Sparse events + Shepard tone; dropped to 75% (was 1.20) — felt overwhelming |
| ASCII Gallery | 2.00 | Sparse events, narrow stereo |

When adjusting a chamber's density or per-event gains significantly, recheck the relative volume balance. If a chamber sounds notably louder or quieter than its neighbours, adjust `masterGain` — it's the cleanest lever.

---

## Chamber 1: Central Shrine (`main`)

**Mood**: Warm, devotional, softly luminous, candlelit.
**Core image**: Small amber droplets falling into a deep stone basin beneath a shrine.
**CHAMBER_PROFILES location**: ~line 4096.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 1.56 |
| fadeInSec | 5 |
| **Pitch** | A minor pentatonic: A3–A5 (220–880 Hz), 11 tones |
| **Shimmer pitches** | E5, G5, A5, C6, E6 |
| **Modal ratios** | 1.000 (a=1.00, Q=16), 2.001 (a=0.46, Q=14), 2.756 (a=0.28, Q=12), 5.404 (a=0.12, Q=10) — "soft glass" |
| stereoSpread | 1.6 (default) |

**Droplet**: gain 0.38–0.65, decay 1.5–4.5s, attack 12–50ms. No glissando.

**Density**: 10–24 events/min, 180s cycle, 9% cluster, 3% long pause.

**Bell**: gain 0.162, dur 7.5–11s, gate 40s, prob 9%. Fundamentals: A2, D3, E3, G3. Uses default modalRatios (no custom partials).

**Shimmer**: gate 52s, prob 12%, 4–8 pings over 4s, gain 0.132/ping.

**Bed**: **A major triad (added 2026-05-29)** — was an open fifth (A+E, no third), which read cold/aloof; the added major third makes it warm and "sunlit". A2 root (110Hz, ampLfo 0.0088Hz ±0.013) + A2 detune (110.55Hz, slow beating) + **C#3 major third (138.59Hz, ampLfo 0.0151Hz ±0.011 — kept low/under the lowpass so it never clashes in-octave with the A-minor-pentatonic droplets)** + E3 fifth (164.81Hz, ampLfo 0.0119Hz ±0.010) + E3 ghost detune (165.30Hz, ampLfo 0.024Hz ±0.0028) + A3 octave glue (220Hz, triangle). The root/third/fifth amp LFOs are incommensurate (~114s/66s/84s) so the chord's internal balance drifts like shifting light. Filter: LP 700Hz Q=0.8, LFO 0.013Hz ±180Hz. Amp LFOs (whole-bed swell): 0.018Hz ±30% + 0.0072Hz ±12%. Reverb send: 0.30.

**Reverb**: 9.5s IR, decay exp 2.6, wet 1.6, damping 2400Hz. Dry: 0.32. 4 delay taps at 71–293ms.

---

## Chamber 2: Art Gallery (`art-gallery`)

**Mood**: Iridescent, prismatic, reflective, "light on glass".
**Core image**: Small tones refracting through a prism; bright surfaces glimpsed in darkness.
**CHAMBER_PROFILES location**: ~line 4236.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 1.52 |
| fadeInSec | 5 |
| **Pitch** | C major pentatonic + chromatic colour notes (F#4, Bb4, F#5, Bb5), weighted repeats |
| **Shimmer pitches** | E5, G5, A5, C6, D#6, E6, G6, A6 |
| **Modal ratios** | 1.000 (a=1.00, Q=18), 2.015 (a=0.48, Q=15), 2.832 (a=0.30, Q=13), 5.486 (a=0.14, Q=11) — glassier than Shrine |
| stereoSpread | 1.8 (widest per-event spread) |

**Droplet**: gain 0.30–0.52 (quieter per-event due to density), decay 0.8–3.5s, attack 8–38ms. Gliss: 25% prob, ±75¢.

**Density**: 18–38 events/min, 150s cycle, 12% cluster, 2% long pause (stays animated).

**Bell**: gain 0.130, dur 6–9.5s, gate 55s, prob 6%. Fundamentals: C3, G3, C4, G4. No custom partials.

**Shimmer**: gate 35s, prob 22% (3× Shrine — the defining feature), 5–11 pings over 3.5s, gain 0.108/ping.

**Bed**: C3 root (130.81Hz) + C3 detune (131.30Hz) + G3 fifth (196Hz) + C4 ghost (261.63Hz, triangle) + E4 drift (329.63Hz, ampLfo 0.021Hz ±0.0032) + G4 drift (392Hz, ampLfo 0.031Hz ±0.0028). Filter: LP 1100Hz Q=0.7 (brighter than Shrine). LFO 0.017Hz ±240Hz. Amp LFOs: 0.022Hz ±26% + 0.0085Hz ±10%. Reverb send: 0.28.

**Reverb**: 7.5s IR (shorter — smaller room), decay 2.3, wet 1.4, damping 4500Hz (less damped — upper-mids ring). Dry: 0.34. 5 delay taps at 59–349ms.

---

## Chamber 3: Research Lab (`research-lab`)

**Mood**: Cool, lucid, computational, glass-and-water, attentive.
**Core image**: Tiny data-droplets striking transparent surfaces inside a dark laboratory.
**CHAMBER_PROFILES location**: ~line 4351.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 1.08 |
| fadeInSec | 5 |
| **Pitch** | Whole-tone scale C4–Bb5 (no tonic — analytical neutrality), centre-weighted |
| **Shimmer pitches** | E5–Bb6, including rare Bb6 upper glint |
| **Modal ratios** | 1.000 (a=1.00, Q=22), 2.193 (a=0.46, Q=18), 3.589 (a=0.26, Q=15), 5.872 (a=0.12, Q=12) — metallic, clearly inharmonic |
| stereoSpread | 1.2 |

**Droplet**: gain 0.48–0.80 (highest per-event), decay 0.6–3.0s (shortest — "precise pings"), attack 5–30ms (sharpest). Gliss: 6% prob, ±25¢ ("data fuzz").

**Density**: 16–35 events/min, 200s cycle, 5% cluster, 5% long pause.

**Bell**: gain 0.168, dur 9–13s, gate 80s, prob 5% (rare). Fundamentals: C3, F3, G3, Bb3 (quartal). No custom partials.

**Shimmer**: gate 50s, prob 15%, 4–8 pings over 3.8s, gain 0.160/ping.

**Bed**: Deep bass — C2 root (65.41Hz) + C2 detune (65.65Hz) + F2 fourth (87.31Hz, triangle) + G2 fifth (98Hz) + E3 drift (164.81Hz, ampLfo 0.019Hz ±0.0059) + F#3 drift (185Hz, ampLfo 0.029Hz ±0.0047). Filter: LP 420Hz Q=0.6 (bass-dominant). LFO 0.015Hz ±140Hz. Amp LFOs: 0.014Hz ±28% + 0.0055Hz ±12%. Reverb send: 0.22 (less wet).

**Reverb**: 8.5s IR, decay 2.5, wet 1.3 (driest), damping 3000Hz. Dry: 0.36 (most direct). 6 delay taps at 61–401ms (widest stereo spread).

---

## Chamber 4: OVS Chapel (`ovs-chapel`)

**Mood**: Cold sacred transmission, remote, alien, green-lit, calm.
**Core image**: An oracle signal arriving through a resonant chamber; luminous droplets in black space.
**CHAMBER_PROFILES location**: ~line 4463.

This is the densest, most continuously active chamber — a luminous wash rather than sparse events.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 0.72 (lowest — compensates for extreme density) |
| fadeInSec | 6 |
| **Pitch** | Bb tonal field: root+fifth weighted, with C4/E4 colour notes |
| **Shimmer pitches** | F5, Bb5, C6, Eb6, F6, Bb6, E6 (rare tritone glint) |
| **Modal ratios** | 1.000 (a=1.00, Q=18), 2.001 (a=0.50, Q=16), 2.756 (a=0.32, Q=14), 5.404 (a=0.16, Q=12) |
| stereoSpread | 1.7 |

**Droplet**: gain 0.58–0.95 (highest), decay 2.5–6.5s, attack 40–200ms (slowest — blooming, no transient). Gliss: 65% prob, ±120¢ ("watercolour blur").

**Density**: 42–90 events/min (highest), 220s cycle, 15% cluster, 2% long pause (continuously painted).

**Bell**: gain 0.22, dur 7–11.5s, gate 18s (most frequent), prob 25%. Fundamentals: Bb2, F3, Bb3, F4. Custom near-harmonic partials: 1.000, 2.000, 3.005, 4.010, 6.011 — warm temple tone, not cold bell.

**Shimmer**: gate 12s (most frequent), prob 55%, 5–11 pings over 4.2s, gain 0.16/ping.

**Wash events** (OVS signature): gain 0.28, dur 8–14s, gate 12s, prob 55%, stereoSpread 1.6. Fundamentals: F3, Bb3, F4, Bb4, F5, C4, G4. Reverse-swell envelope with per-partial pitch wobble 0.045–0.135Hz ±0.5%. Multiple overlapping washes create continuous colour.

**Bed**: Bb2 root (116.54Hz) + Bb2 detune (117.03Hz) + F3 fifth (174.61Hz, triangle) + Bb3 octave (233.08Hz) + F4 drift (349.23Hz, ampLfo 0.014Hz ±0.005) + Bb4 drift (466.16Hz, ampLfo 0.023Hz ±0.004). Filter: LP 600Hz Q=0.7. LFO 0.011Hz ±160Hz. Amp LFOs: 0.012Hz ±32% + 0.0048Hz ±14%. Reverb send: 0.36 (highest).

**Reverb**: 12.5s IR, decay 2.8, wet 1.6, damping 2200Hz (cool glass). Dry: 0.24. 6 delay taps at 83–467ms.

---

## Chamber 5: Scriptorium (`gpt3-library`)

**Mood**: Airy, intimate, suspended, breathlike. The quietest chamber.
**Core image**: Words not spoken; tiny tones appearing like ink drops in water; vellum catching candlelight.
**CHAMBER_PROFILES location**: ~line 4790.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 2.00 (highest — compensates for very sparse, quiet events) |
| fadeInSec | 6 |
| **Pitch** | E minor pentatonic (E3–D5) with E/B weighting, rare C4 and F#4 colour |
| **Shimmer pitches** | E5, G5, B5, E6 |
| **Modal ratios** | 1.000 (a=1.00, Q=16), 2.001 (a=0.44, Q=14), 2.756 (a=0.26, Q=12), 5.404 (a=0.11, Q=10) — soft glass, slightly more damped than Shrine |
| stereoSpread | 0.8 (narrow — events feel "in the reader's head") |

**Droplet**: gain 0.30–0.50 (quietest), decay 2.0–6.0s (long blooming tails), attack 20–120ms (soft, never percussive). Gliss: 15% prob, ±40¢ ("ink blurring in water").

**Density**: 6–12 events/min (floor raised from 4 on 2026-05-29), 240s cycle (slowest breath), 4% cluster (rare), 8% long pause (frequent near-silence).

**Bell**: gain 0.12 (quietest bell), dur 8–13s, gate 70s, prob 6%. Fundamentals: E3, B3, E4, A3. Custom near-harmonic partials: 1.000, 2.000, 3.003, 4.008, 6.015 — warm, not glassy. "Distant dying note" not "struck bell".

**Shimmer**: gate 60s, prob 8%, 3–6 pings over 4.5s (wide, sparse — ink spots dissolving), gain 0.07/ping (very quiet).

No wash events. No Shepard tone.

**Bed**: E2 root (82.41Hz) + E2 detune (82.71Hz) + B2 fifth (123.47Hz) + E3 octave (164.81Hz, triangle) + A3 mid presence (220Hz, triangle, ampLfo 0.018Hz ±0.0022). Filter: LP 500Hz Q=0.7. LFO 0.010Hz ±120Hz. Amp LFOs: 0.009Hz ±24% + 0.0038Hz ±10% (slowest bed). Reverb send: 0.26.

**Reverb**: 11.0s IR, decay 2.7, wet 1.5, damping 2000Hz (strong — "soft stone cell"). Dry: 0.28 (events dissolve faster). 5 delay taps at 67–337ms (narrower stereo — smaller room).

**Character notes**: Let events feel meaningful because they are rare. Not sentimental piano ambience. Abstract, almost calligraphic. The chamber holds GPT-3 poetry — the audio should feel like "language sleeping", not "language being performed".

---

## Chamber 6: Mythopoeic Archive (`mythopoeic-archive`)

**Mood**: Deep, archaic, subterranean, pre-verbal, underworld-adjacent but not frightening.
**Core image**: Large dark resonant cave; distant tones reflected from unseen stone.
**CHAMBER_PROFILES location**: ~line 4617.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 1.20 |
| fadeInSec | 7 (slowest — the chamber arrives gradually) |
| **Pitch** | D-minor modal: D, F, A core with Eb (flat 2nd) and C (minor 7th) colour. D/A weighted. |
| **Shimmer pitches** | D5, F5, A5, D6 |
| **Modal ratios** | 1.000 (a=1.00, Q=18), 2.001 (a=0.48, Q=15), 2.756 (a=0.30, Q=13), 5.404 (a=0.14, Q=11) |
| stereoSpread | 1.0 (narrower — events placed in vastness) |

**Droplet**: gain 0.34–0.58, decay 3.0–8.0s (longest), attack 50–250ms (slowest — blooming). Gliss: 30% prob, ±60¢.

**Density**: 6–10 events/min (floor raised from 4 on 2026-05-29 — still sparsest), 240s cycle (slowest), 4% cluster, 10% long pause (most frequent silence).

**Bell**: gain 0.16, dur 10–16s (longest), gate 65s, prob 10%. Fundamentals: D2, A2, D3, A3 (deep). Custom "stone-coloured" partials: 1.000, 2.000, 2.953 (slightly flat 12th), 4.041 (slightly sharp 2× octave), 6.072 (slight detune). "Distant boom", not "struck bell".

**Shimmer**: gate 90s (longest), prob 5% (rarest — "archaic/subterranean doesn't sparkle"), 3–6 pings over 5s, gain 0.06/ping.

**Shepard tone** (defining feature): 5 voices, C2–C5 (4 octaves), 150s period, **direction: 'up'** (ascending illusion). Gain: 0.085 (subtle). Reverb send: 0.55 (strong wet — "cave" depth). The endless ascent should feel numinous and archaic, not sci-fi.

No wash events.

**Bed**: D2 sub (73.42Hz) + D2 detune (73.78Hz) + A2 fifth (110Hz, triangle) + D3 octave (146.83Hz) + F3 minor third (174.61Hz) + A3 drift (220Hz, ampLfo 0.011Hz ±0.004). Filter: LP 480Hz Q=0.7 (cool/dark). LFO 0.009Hz ±130Hz. Amp LFOs: 0.010Hz ±30% + 0.0042Hz ±14% (mythic patience). Reverb send: 0.32.

**Reverb**: 15.0s IR (longest/most cavernous), decay 3.0, wet 1.45, damping 1800Hz (most strongly damped — soft stone). Dry: 0.22 (most distant). 6 delay taps at 103–587ms (widest spacing).

**Critical warning**: The danger here is horror ambience. Avoid horror. No sudden stingers, no ominous bass pulses, no monster-cave rumble. It should feel old and deep, but hospitable.

---

## Chamber 7: ASCII Gallery (`ascii-gallery`)

**Mood**: Digital cloister, phosphor-ghost. Quiet, contained, dreaming-terminal, recursive.
**Core image**: Tiny ASCII characters falling through deep velvet darkness; a cursor blinking somewhere very far away; phosphor afterglow on a long-dead screen.
**CHAMBER_PROFILES location**: ~line 4893.

Related to Research Lab but more secret and stranger — a back room behind the scriptorium where the language is sleeping.

### Parameters

| Parameter | Value |
|---|---|
| masterGain | 2.00 |
| fadeInSec | 5 |
| **Pitch** | Quartal/fifth-based: D3, G3, A3, D4, E4, G4, A4, D5. D/G/A weighted. Very limited vocabulary. |
| **Shimmer pitches** | D5, G5, A5, D6 |
| **Modal ratios** | 1.000 (a=1.00, Q=20), 2.004 (a=0.42, Q=16), 3.003 (a=0.22, Q=14), 5.009 (a=0.10, Q=10) — metallic but soft, narrower than Research Lab |
| stereoSpread | 0.6 (narrowest — monophonic terminal feel) |

**Droplet**: gain 0.36–0.58, decay 1.2–4.0s (shorter than Scriptorium — "crisper"), attack 8–45ms (slightly sharper — more "digital"). Gliss: 8% prob, ±20¢ (very tight — "quantised" feel).

**Density**: 10–22 events/min, 180s cycle, 8% cluster, 4% long pause.

**Bell**: gain 0.14, dur 7–11s, gate 55s, prob 7%. Fundamentals: D3, G3, A3, D4. Custom near-harmonic partials: 1.000, 2.000, 2.998, 4.006 — very distant struck glass, not a bell.

**Shimmer**: gate 50s, prob 10%, 3–7 pings over 3.2s, gain 0.10/ping.

No wash events. No Shepard tone.

**Bed**: D2 root (73.42Hz) + D2 detune (73.72Hz, slow beating) + A2 fifth (110Hz) + D3 octave (146.83Hz, triangle) + G3 mid presence (196Hz, triangle, ampLfo 0.015Hz ±0.0022) + **phosphor hum** (100Hz sine, gain 0.004, ampLfo 0.006Hz ±0.0025). The phosphor hum is the ASCII Gallery's signature: an extremely quiet ~100Hz sine suggesting a dormant CRT transformer hum. It should be barely perceptible — felt more than heard. If it becomes noticeable as a "note", it's too loud.

Filter: LP 550Hz Q=0.6. LFO 0.012Hz ±110Hz. Amp LFOs: 0.013Hz ±26% + 0.005Hz ±11%. Reverb send: 0.24.

**Reverb**: 9.0s IR (shorter than Scriptorium — "smaller room"), decay 2.4, wet 1.35, damping 2800Hz (medium-strong — slightly brighter but not metallic). Dry: 0.32 (events are "closer"). 4 delay taps at 53–247ms (tight taps, narrow pans within ±0.4 — intimate, not cavernous).

**Character notes**: The reference is closer to an old terminal slowly breathing in an unlit room than to a synth or computer. Avoid bit-crusher caricature and arpeggiated "data cascades". Stylistically closer to Eno's Apollo/Shutov than to anything diegetic-tech. No bleeps, no typing sounds, no modem screech. The connection to the visual phosphor aesthetic should be tonal (cold, precise, slightly metallic droplets in a small quiet room), not literal (computer sound effects).

---

# Part 4: Aesthetic Brief (Shared Principles)

These principles apply across all chambers. Refer back to them when designing new chambers or adjusting existing ones.

### Event-Based Ambience, Not Sustained Drone

The soundworld is built from sparse-to-moderate generative events: short resonant droplets, soft struck-glass tones, muted bell partials, distant reversed swells, filtered granular sparkles, low breathlike washes, tiny pitch glints. Avoid holding several oscillator notes at medium volume for long periods. Continuous layers (bed) must be very low-level, soft-edged, slowly modulated, and textural.

### Frequency Profile

```text
sub/bass:    present but gentle, never booming
low mids:    warm body, 120–500 Hz
mids:        resonant tonal identity, 500–1500 Hz
upper mids:  occasional glints, not continuous
highs:       sparse, glassy, filtered
air band:    avoid constant hiss above 8 kHz
```

Use low-pass filtering generously. Shimmer should be selective: little points of light, not white-noise glitter.

### Transients

```text
droplet:         attack 5–250ms,  decay 0.6–8s, release 1–8s through reverb
shimmer cluster: attack 6–20ms,   decay 1–3s,   release 4–15s
bell/boom:       attack 0.5–2s,   decay 6–16s
wash swell:      attack 5–10s,    decay 2–5s
low breath bed:  attack 5–30s,    release 10–60s
```

### Tonality

Use limited pitch pools and slowly shifting modal centres. No big lush chords. Pitch as architecture, not tune.

### Reverb and Space

The reverb is central — the sound takes place in a large impossible chamber. Keep some direct droplet signal (via `dryLevel`) to preserve the "things falling into pools" sensation.

### Temporal Behaviour

Poisson-distributed timing. Short-term clustering allowed. Long gaps allowed. Density sine-modulated over 2.5–4 minute cycles. No hard quantization. Near-silence is a valid state.

### Anti-Spec

The audio must NOT sound like: stacked oscillator drone, meditation app pad, horror ambience, sci-fi engine hum, Tibetan bowl cliché, binaural beating, new age chord wash, wind noise loop, white-noise shimmer, modular synth demo, dark industrial rumble, Vangelis pad, "ominous temple" stock audio.

---

# Part 5: Practical Guide for Future Changes

### Adjusting a chamber's volume

Change `masterGain` in its `CHAMBER_PROFILES` entry. This is the cleanest lever. See the Volume Normalization table above for context on relative values.

### Making a chamber busier/sparser

Adjust `density.eventsPerMinMin` and `eventsPerMinMax`. The density sine-modulates between these values over `cyclePeriod` seconds. Also consider `clusterProbability` (burst frequency) and `longPauseProbability` (silence frequency).

### Changing a chamber's tonal character

Modify `pitchPool.droplet` (which pitches events use) and `modalRatios` (which partials ring for each event). Higher `q` values = longer ringing. More inharmonic ratios (e.g. 2.193 vs 2.001) = more metallic/glassy.

### Adding a new chamber

1. Add a `CHAMBER_PROFILES['chamber-id']` entry following the structure above
2. No need to touch `CHAMBER_DRONES` — `initDrone()` checks profiles first
3. If the chamber has a `_prismId` that doesn't match any profile, it will be silent

### Testing audio changes

1. Navigate to `/prism/[chamber-id]` in the dev server
2. Wait 2.5s for audio to initialize (+ browser autoplay unlock if needed)
3. Listen for at least 2 full density cycles (= 2 × cyclePeriod seconds) to hear the full range
4. Compare perceived volume against adjacent chambers
5. Check for harsh high-frequency content, horror vibes, or obvious looping

### The fade node

`_droneNodes.fade` is a GainNode used by three systems:
- **Initial fade-in**: 0→1 ramp over `fadeInSec` on chamber entry
- **Video fade**: 1→0 over 3s when video plays, 0→1 over 8s when video ends/dismissed
- **Archway exit**: 1→0 over 2s when leaving the chamber

These can overlap safely — each system calls `cancelScheduledValues` before setting its ramp, so the most recent ramp wins.

`fade` is followed by a separate `userVol` node (see below) before the destination, so the user's volume setting is fully independent of these automated ramps.

---

# Part 6: Global Volume Control

**Component**: `src/components/VolumeControl.astro` (added 2026-06-03). **Audio integration**: a `userVol` GainNode in each chain — `src/pages/immersive.astro` (~line 3117) and `public/scripts/prism.js` (~line 5277, in `_initEventEngine`).

A small mute-toggle + slider fixed top-centre, rendered on the immersive page and all prism chambers (not on the purely textual pages, which have no audio). Mute icon on the left, emerald (`#5eefa2`) slider beside it; ~1:8 aspect; resting opacity 0.78, full on hover.

### How it works

- **Dedicated gain node.** Each audio chain inserts `userVol` *after* `fade`, just before `destination` (`fade → userVol → destination`). Keeping it separate from `fade` means the slider never collides with the fade-in / video-duck / archway-exit ramps. The component never touches `master` (which carries the per-chamber `masterGain`) or `fade`.
- **Contract.** The widget owns two globals:
  - `window.__leilanVolume` — the current effective gain (0 when muted), set synchronously on page load so the audio chain can read it when it initialises ~1.5s later.
  - `window.__applyLeilanVolume(g)` — defined by each audio chain when it builds `userVol`; ramps `userVol.gain` via `setTargetAtTime(g, ctx.currentTime, 0.03)` (click-free). Wrapped in try/catch so a call against a closed context during teardown is harmless.
- **On init**, each chain sets `userVol.gain.value = window.__leilanVolume ?? 1`, so a setting chosen before audio started is honoured.
- **Persistence.** `localStorage` keys `leilan_vol` (0–1, default 0.8) and `leilan_muted` (`'1'`/`'0'`). The setting carries across the immersive page and every chamber.
- **UX.** Dragging the slider up from a muted state auto-unmutes. A `pointerdown` `stopPropagation` on the widget stops slider/button interaction from reaching the 3D scene (camera drag, candle lighting).
