# AUDIO.md

# Generative Audio Brief for the Prism Chambers

This document describes the desired ambient audio aesthetic for a six-chamber virtual prism/temple/shrine space.

The reference MP3s are not to be reproduced, sampled, quoted, or closely imitated. They are aesthetic pointers only. The aim is to define a behavioural and textural field for a generative audio system.

---

## Core Direction

The target is **not “ambient drone”** in the usual browser-demo sense.

The desired sound is closer to:

- **sonic raindrops gently falling into sonic pools**
- **shimmering resonant droplets**
- **small bell-like particles in a large dark room**
- **low luminous vapour, not a sustained siren**
- **occasional tones appearing, blooming, dissolving**
- **a pool of reverb with small objects touching its surface**
- **less “drone generator”, more “ritual hydrophone / glass gamelan / distant memory of chimes”**

The sound should feel alive but not busy. It should have no obvious loop point, no beat, no sense of “music track starting”, and no constant note demanding attention.

The most important conceptual shift is:

> Make the chamber audible through occasional resonant events, rather than filling the chamber with continuous sound.

---

## Shared Sonic Fingerprint

Across all chambers, use these principles.

---

### 1. Event-Based Ambience, Not Sustained Drone

The soundworld should be built from sparse-to-moderate generative events:

- short resonant droplets
- soft struck-glass tones
- muted bell partials
- distant reversed swells
- filtered granular sparkles
- low, breathlike washes that move slowly
- tiny pitch glints that appear briefly then vanish

Avoid holding several oscillator notes at medium volume for long periods. Continuous layers may exist, but they must be **very low-level, soft-edged, slowly modulated, and textural**, not melodically assertive.

A good architecture would be:

```text
quiet moving bed
+ sparse modal droplets
+ occasional shimmer clusters
+ very slow spectral movement
+ large reverb/delay space
+ no beat grid
+ no strong melodic phrase
```

The listener should feel that the sound is *happening in the room*, not that a soundtrack has been imposed on them.

---

### 2. Frequency Profile

The reference material lives mostly in the **low, low-mid, and midrange**, with delicate upper shimmer but very little harsh high-frequency fizz.

Guidelines:

```text
sub / bass: present but gentle, never booming
low mids: warm body, 120–500 Hz
mids: resonant tonal identity, 500–1500 Hz
upper mids: occasional glints, not continuous
highs: sparse, glassy, filtered
air band: avoid constant hiss above 8 kHz
```

Use low-pass filtering generously. A lot of browser generative audio becomes irritating because the highs are too bright, too synthetic, or too constantly active.

The shimmer should be **selective**: little points of light, not a layer of white-noise glitter.

---

### 3. Transients: Soft Droplets, Not Percussion

The “raindrops” should not sound like drums. They are more like:

- plucked glass
- tiny mallet on ceramic
- water drops in a resonant cistern
- muted vibraphone fragments
- short sine/FM pings through modal resonators
- soft clicks turned into tone by reverb

Each event should have a softened attack, or a very small attack followed by a bloom. Avoid sharp clicky transients unless they are buried in reverb.

Suggested envelope families:

```text
droplet:
attack: 5–40 ms
decay: 0.4–3.5 s
sustain: 0
release: 1–5 s through reverb

shimmer cluster:
attack: 80–800 ms
decay: 2–8 s
release: 4–15 s

low breath bed:
attack: 5–30 s
release: 10–60 s
```

---

### 4. Tonality: Pitch-Centred, But Not Harmonic-Progressive

The references are often tonal or quasi-tonal, but they do not feel like normal chord progressions. Use **limited pitch pools** and slowly shifting modal centres.

Avoid Western “ambient pad chord progression” behaviour. No big lush synth chords changing every 8 bars.

Instead:

```text
one chamber = one tonal gravity field
few notes recur, but irregularly
intervals: fifths, fourths, minor thirds, major seconds
occasional dissonant partials, but not horror-film clusters
micro-detuning: subtle
no melody line
```

Good pitch-set types:

```text
suspended pentatonic
minor pentatonic without blues gestures
quartal / fifth-based sets
whole-tone fragments
gamelan-like inharmonic partial sets
low root + upper glints
two or three stable pitch centres, slowly crossfaded
```

Use pitch as **architecture**, not tune.

---

### 5. Reverb and Space

The reverb is central. The sound should feel like it takes place in a large impossible chamber.

Use:

```text
large hall / cave / plate hybrid
long decay: 6–18 s
high damping: fairly strong
pre-delay: 20–120 ms
wet: high, but not washing out all detail
early reflections: soft, irregular
stereo width: broad and slow-moving
```

But avoid the classic mistake where everything becomes a smeared pad. Keep some direct droplet signal, very quiet, to preserve the “things falling into pools” sensation.

A useful model:

```text
dry event: tiny, close, low volume
early reflection: gives chamber geometry
long tail: turns event into glowing vapour
delay taps: irregular, faint, stereo-scattered
```

---

### 6. Temporal Behaviour

The system should breathe. It must not be regular enough to sound like a sequencer, and not random enough to feel chaotic.

Suggested timing model:

```text
events generated by Poisson / weighted random process
short-term clustering allowed
long gaps allowed
density slowly modulated over 1–4 minute cycles
no hard quantization
no metronomic pulse
no obvious looping
```

Event rates should be chamber-specific, but broadly:

```text
low density: 3–8 events per minute
medium density: 8–20 events per minute
shimmer density: clusters of 4–12 micro-events, then silence
```

Let the user sometimes sit in near-silence with only a faint bed and reverb tail.

---

## Negative Prompt / Anti-Spec

The audio must **not** sound like:

```text
stacked oscillator drone
meditation app pad
horror ambience
sci-fi engine hum
Tibetan bowl cliché
constant binaural beating
new age chord wash
wind noise loop
white-noise shimmer
modular synth demo
dark industrial rumble
Vangelis pad
“ominous temple” stock audio
```

Avoid:

```text
continuous loud drones
strong LFO wobble
obvious looping samples
strong beats
arpeggios
melodies
bright metallic harshness
excessive bass rumble
high-frequency hiss
rapid pitch modulation
constant unresolved dissonance
```

The sound should be numinous, not threatening; mysterious, not edgy; spacious, not empty; alive, not busy.

---

# Suggested Web Audio Implementation Model

A good browser implementation could use a small number of synthesis modules rather than sample playback.

---

## Core Modules

```text
1. Modal droplet voice
   - short excitation impulse/noise burst/sine ping
   - passed into bank of resonant bandpass filters
   - modal ratios slightly inharmonic
   - long exponential decay
   - stereo panned randomly
   - sent heavily to reverb

2. Glass FM voice
   - sine carrier + low-index FM modulator
   - short attack, medium decay
   - random pitch from chamber pitch pool
   - filtered above 4–7 kHz
   - optional reverse-envelope swell

3. Low vapour bed
   - filtered noise or wavetable partials
   - extremely quiet
   - slow filter movement
   - no clear pulse
   - mono-compatible but with slow stereo decorrelation

4. Shimmer spray
   - rare cluster of tiny high-mid pings
   - each event very quiet
   - strong reverb
   - high damping
   - random pitch offsets
   - should happen like light catching dust, not like a synth sparkle preset

5. Reverb/delay environment
   - shared per chamber
   - long decay
   - damped highs
   - irregular stereo delay taps
```

---

## Pseudocode Behaviour

```text
Every chamber has:
- pitchPool
- modalRatios
- eventDensity
- shimmerProbability
- lowBedLevel
- brightness
- reverbDecay
- stereoWidth
- temperature: warm / cold / neutral
- activityCurve: very slow modulation of density and brightness

Main loop:
- schedule droplets using non-quantized random intervals
- sometimes create clusters
- sometimes create long gaps
- slowly alter filter cutoff, reverb send, stereo pan
- never restart all layers simultaneously
- never expose loop seams
```

---

# Seven Chamber Variants

These are tuned to the same reference family. They can be assigned to the seven prism chambers (Central Shrine, plus six side chambers — Research Lab, Mythopoeic Archive, Art Gallery, Scriptorium/GPT-3 Library, OVS Chapel, and the secret ASCII Art Gallery off the back of the Scriptorium) and refined.

---

## 1. Shrine Chamber — Warm, Devotional, Softly Luminous

```text
Mood:
warm, intimate, votive, candlelit, protective

Core image:
small amber droplets falling into a deep stone basin beneath a shrine

Pitch:
rooted, consonant, minor-pentatonic or suspended
intervals: root, fifth, minor third, second, occasional fourth
avoid: major triumphant colour

Texture:
soft bell droplets
low warm undertone
occasional breathlike swell
very gentle shimmer, not icy

Parameters:
eventDensity: 6–14 events/minute
lowBedLevel: low-medium
brightness: low-medium
reverbDecay: 9–14 s
highDamping: strong
dropletDecay: 1.5–5 s
shimmerProbability: low
stereoMotion: slow

Implementation notes:
Use sine/FM pings with softened attack, routed through a warm resonator bank.
Let a quiet low fifth appear and disappear over long periods.
Do not make it ecclesiastical organ music; keep it abstract and pre-liturgical.
```

---

## 2. Research Lab — Colder, Crystalline, Analytic, But Not Sterile

```text
Mood:
cool, lucid, computational, glass-and-water, attentive

Core image:
tiny data-droplets striking transparent surfaces inside a dark laboratory

Pitch:
sparser, more neutral
use fourths/fifths/whole-tone fragments
slightly more inharmonicity than Shrine

Texture:
small precise pings
faint digital frost
thin resonant trails
occasional distant low tone

Parameters:
eventDensity: 10–22 events/minute
lowBedLevel: very low
brightness: medium
reverbDecay: 6–11 s
highDamping: medium-strong
dropletDecay: 0.6–3 s
shimmerProbability: medium
stereoMotion: subtle but wide

Implementation notes:
More separated events, less warmth.
Use modal filter banks with slightly metallic ratios.
Avoid making it sound like a computer terminal, UI bleeps, or sci-fi machinery.
It should be contemplative analysis, not “tech ambience”.
```

---

## 3. Mythos Chamber — Deep, Archaic, Subterranean, Gently Uncanny

```text
Mood:
ancient, cavernous, mythic, pre-verbal, underworld-adjacent but not frightening

Core image:
large dark resonant cave; distant tones reflected from unseen stone

Pitch:
low root emphasis
fifths, flattened seconds, minor thirds
occasional ambiguous/dissonant upper partials
slow tonal drift

Texture:
more low-mid body
fewer high droplets
longer reverb tails
occasional distant boom, very soft

Parameters:
eventDensity: 3–9 events/minute
lowBedLevel: medium
brightness: low
reverbDecay: 12–20 s
highDamping: strong
dropletDecay: 3–8 s
shimmerProbability: very low
stereoMotion: very slow

Implementation notes:
The danger here is horror ambience. Avoid horror.
No sudden stingers, no ominous bass pulses, no monster-cave rumble.
It should feel old and deep, but hospitable.
```

---

## 4. Art / Gallery Chamber — Iridescent, Visual, Prismatic

```text
Mood:
colour-shifting, reflective, gently animated, like light on glass

Core image:
small tones refracting through a prism; bright surfaces glimpsed in darkness

Pitch:
more varied than Shrine
pentatonic plus occasional chromatic colour notes
no strong melody
allow gentle pitch glissandi or detuned duplicate partials

Texture:
more shimmer clusters
more stereo sparkle
slightly brighter upper mids
soft granular “glints”

Parameters:
eventDensity: 12–26 events/minute
lowBedLevel: low
brightness: medium-high, but filtered
reverbDecay: 8–13 s
highDamping: medium
dropletDecay: 0.8–4 s
shimmerProbability: medium-high
stereoMotion: medium

Implementation notes:
This is where the “sonic shimmer” can be most explicit.
But avoid constant glitter. Shimmer should arrive in small optical events.
Think: reflections moving across a wall, not fairy dust.
```

---

## 5. Poetry Chamber — Airy, Intimate, Suspended, Breathlike

```text
Mood:
fragile, lyrical, hushed, close to silence, mentally spacious

Core image:
words not spoken; tiny tones appearing like ink drops in water

Pitch:
small pitch vocabulary
minor seconds can appear, but gently
soft unresolved intervals
avoid functional harmony

Texture:
quieter than other chambers
more silence
small close droplets with long tails
faint breath/noise layer
less bass than Mythos/Shrine

Parameters:
eventDensity: 4–12 events/minute
lowBedLevel: very low
brightness: low-medium
reverbDecay: 10–16 s
highDamping: strong
dropletDecay: 2–6 s
shimmerProbability: low-medium
stereoMotion: slow

Implementation notes:
Let events feel meaningful because they are rare.
Do not make it sentimental piano ambience.
No obvious “poetic” melody. Keep it abstract, almost calligraphic.
```

---

## 6. OVS / Chapel Chamber — Cold Sacred Transmission, Numinous Signal

```text
Mood:
remote, sacred, alien, green-lit, transmission-like, but calm

Core image:
an oracle signal arriving through a resonant chamber; luminous droplets in black space

Pitch:
more austere
root + fifth + tritone/second colour very occasionally
slight inharmonic resonances
rare high glints

Texture:
low-mid resonant base
cold glass droplets
distant reverse swells
occasional shimmer veil
more stereo width and depth

Parameters:
eventDensity: 6–16 events/minute
lowBedLevel: low-medium
brightness: medium-low
reverbDecay: 12–18 s
highDamping: medium-strong
dropletDecay: 2–7 s
shimmerProbability: medium
stereoMotion: wide, slow

Implementation notes:
This may be the strangest chamber, but it should not be alarming.
Avoid “haunted AI server room”.
The vibe is oracle, not menace; signal, not machinery.
```

---

## 7. ASCII Gallery — Digital Cloister, Phosphor-Ghost, Soft-Terminal

```text
Mood:
quiet, contained, dreaming-terminal, recursive, semi-digital,
related to Research Lab but more secret and stranger —
a back room behind the scriptorium where the language is sleeping

Core image:
tiny ASCII characters falling through deep velvet darkness;
a cursor blinking somewhere very far away;
phosphor afterglow on a long-dead screen

Pitch:
quartal / fifth-based, with one or two slightly detuned partials
to give a soft "off-grid" quality
smaller pitch vocabulary than other chambers — repetition without phrasing

Texture:
thin glassy droplets, very gentle "bit-flavoured" glints
faint phosphor hum below hearing
extremely sparse low events
no continuous high-frequency hiss
no UI bleep, no modem squeal, no cinematic "hacker" tropes

Parameters:
eventDensity: 5–12 events/minute
lowBedLevel: very low
brightness: medium-low
reverbDecay: 8–12 s
highDamping: medium-strong
dropletDecay: 1.2–4 s
shimmerProbability: low-medium
stereoMotion: subtle, narrow

Implementation notes:
The reference is closer to an old terminal slowly breathing in an
unlit room than to a synth or to a computer. A few of the glass-drop
pings should feel weirdly readable — as if the silence itself were
typing — without any actual melody appearing. Avoid bit-crusher
caricature and arpeggiated "data cascades"; subtlety is the whole
game. Stylistically closer to Eno's Apollo / Shutov than to anything
diegetic-tech.
```

---

# Compact Master Prompt for the Coding Assistant

```text
Build a generative Web Audio ambient system for a six-chamber virtual prism/temple environment. The target is not conventional drone ambience. Avoid stacked continuous oscillator drones, ominous hums, meditation-pad clichés, horror ambience, bright hiss, and insistent unresolved tones.

The desired sound is sparse, spacious, resonant, and event-based: “sonic raindrops gently falling into sonic pools”, “glass droplets in a large dark chamber”, “soft bell particles suspended in long reverb”, “faint luminous vapour with occasional shimmer”. Each chamber should feel alive but not busy, calm but not bland, mysterious but not threatening.

Use a shared architecture:
- very quiet moving low/mid bed, heavily filtered, non-insistent
- stochastic modal droplet events generated at irregular intervals
- occasional shimmer clusters made of tiny quiet high-mid pings
- large damped chamber reverb with irregular stereo delay taps
- slow modulation of density, brightness, panning, and filter cutoff over multi-minute timescales
- no beat grid, no melody, no chord progression, no obvious loop point

Implement droplets as short sine/FM/noise excitations through resonant bandpass/modal filter banks. Use softened attacks, exponential decays, long reverb tails, random stereo placement, and pitch pools per chamber. Keep most energy in low/low-mid/mid frequencies; use upper shimmer sparingly and avoid continuous >8kHz fizz.

Each chamber should have its own parameter profile: Shrine warm/devotional; Research Lab cool/crystalline/analytic; Mythos deep/archaic/subterranean; Art prismatic/iridescent; Poetry sparse/breathlike/intimate; OVS Chapel cold-sacred/oracular/transmission-like. These should be variations within one coherent sonic family, not six unrelated tracks.

The engine should generate a living ambience indefinitely. It should sometimes become nearly silent. It should never feel like a looped soundtrack or a synth demo. The user should experience the sound as part of the virtual architecture itself.
```

---

# Implementation Priorities

If development time is limited, prioritise these behaviours:

1. **Sparse modal droplets** over continuous drones.
2. **Long damped reverb** over dry oscillator tones.
3. **Irregular timing** over sequenced patterns.
4. **Subtle pitch pools** over chord progressions.
5. **Occasional shimmer** over constant high-frequency sparkle.
6. **Near-silence as a valid state** over continuous activity.

The audio should invite the user to stay in the chamber, not push them out of it.
