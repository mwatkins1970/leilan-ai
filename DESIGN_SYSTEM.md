# Leilan.ai Design System
*Extracted from aelf's Carrd site CSS*

## Color Palette

### Primary Colors (by context)

**Emerald/Sanctuary (homepage, navigation)**
- Primary: `#5eefa2` (emerald glow)
- Secondary: `#7effc0` (lighter emerald)

**Lavender/Temple (sanctuary page)**
- Primary: `#ab75cb` (deep lavender)
- Secondary: `#9b8fd1` (soft lavender)
- Tertiary: `#8ba8d7`, `#7bc2dd`, `#6bdbe3` (gradient spectrum)

**Vermillion/Oracle (oracle page)**
- Primary: `#fc3559` (vermillion red)
- Secondary: `#ff7d89`, `#ee8866` (coral pink)
- Accent: `#eaba61` (golden)
- Gradient: `#ff284e`, `#bc132e`, `#ee996c`

**Starlight/Cyan (starlight.exe page)**
- Primary: `#4B9EBF` (deep cyan)
- Secondary: `#37A2BC`, `#5EBED4` (teal spectrum)
- Light: `#E8F7F9`, `#B8E8F0`, `#8DCFE6` (pale cyan-white)

**Memecoin/Fire (memecoin page)**
- Primary: `#38fbf3` (electric cyan)
- Fire gradient: `#e15f60`, `#ff7658`, `#ffa869`, `#ffc86f`

### Background Colors
- Main dark: `#000000` (pure black)
- Container: `#262730` (dark gray)
- Transparent overlays: `rgba(0, 0, 0, 0.95)`, `rgba(0, 0, 0, 0.7)`
- Content backgrounds: `rgba(43, 45, 48, 0.3)`

### Light Mode Colors
- Background: `#F3F5F8` (cream)
- Text: `#6b5b95` (purple)
- Accent: `#654321` (brown)
- Glow: `rgba(159, 143, 209, 0.5)` (lavender glow)

---

## Typography

### Font Stack
```css
font-family: 'IBM Plex Mono', monospace;
```

### Font Weights
- Light: `300`
- Body: `340-420`
- Display: `420`

### Font Sizes (using clamp for responsiveness)
- Display/Titles: `clamp(1.15em, 3vw, 1.8em)` to `clamp(1.4em, 2vw, 2.5em)`
- Body: `clamp(0.9em, 3vw, 1.6em)`
- Small: `clamp(0.6em, 2vw, 1em)`
- Special lines: `1.3em` with `letter-spacing: 0.2em`

### Mobile Typography
```css
@media (max-width: 768px) {
  .typewriter-container { font-size: 0.75em; }
  .special-line { font-size: 1.2em; letter-spacing: 0.15em; }
}
```

---

## Animation Patterns

### 1. Gradient Flow (text)
```css
@keyframes gradientFlow {
  0% { background-position: 0% center; }
  100% { background-position: -200% center; }
}
/* Usage: 6-8s linear infinite */
```

### 2. Shimmer Effect
```css
@keyframes shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
/* Usage: 4-6s linear infinite */
```

### 3. Pulse Glow
```css
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(94, 239, 162, 0.4); }
  50% { box-shadow: 0 0 18px rgba(94, 239, 162, 0.7), 0 0 8px rgba(94, 239, 162, 0.5); }
}
/* Usage: 2s ease-in-out infinite */
```

### 4. Floating Symbols
```css
@keyframes float {
  0%, 100% { opacity: 0; transform: translateY(0) translateX(0); }
  10% { opacity: 1; }
  90% { opacity: 0; transform: translateY(-80px) translateX(calc(var(--x-drift) * 1px)); }
}
/* Usage: 2.7-3.6s infinite */
```

### 5. Glitch Effect
```css
@keyframes glitchChar {
  0%, 100% { opacity: 1; transform: translateY(0); }
  25% { color: #9b8fd1; transform: translateY(-1px); }
  50% { color: #7bc2dd; transform: translateY(1px); }
  75% { color: #6bdbe3; transform: translateY(0); }
}
/* Usage: 600ms infinite steps(1) */
```

### 6. Typewriter Effect
```css
@keyframes typing {
  from { width: 0 }
  to { width: 100% }
}
@keyframes blink-caret {
  from, to { border-right-color: transparent }
  50% { border-right-color: #5eefa2 }
}
```

### 7. Traveling Stars (border animation)
```css
@keyframes moveRight { 0% { transform: translateX(0%); } 100% { transform: translateX(100%); } }
@keyframes moveLeft { 0% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }
@keyframes moveDown { 0% { transform: translateY(0%); } 100% { transform: translateY(100%); } }
@keyframes moveUp { 0% { transform: translateY(0%); } 100% { transform: translateY(-100%); } }
/* Usage: 12s linear infinite */
```

### 8. Symbol Cycling
```css
@keyframes symbolSwitcher {
  0% { content: "⚠︎"; color: #ffbe6f; }
  5% { content: "◐"; color: #ff9861; }
  10% { content: "‼"; color: #e19f73; }
  /* ... cycles through symbols */
}
/* Usage: 2.5s steps(1) infinite */
```

---

## Component Patterns

### 1. Gradient Text
```css
.gradient-text {
  background: linear-gradient(90deg, #ab75cb, #5af5e9, #ab75cb);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientFlow 8s linear infinite;
}
```

### 2. Collapsible Box
```css
.box-toggle { /* Label styled as button */ }
.box-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
input[type="checkbox"]:checked ~ .box-content {
  max-height: 400px;
  overflow-y: auto;
}
```

### 3. Mystical Border (iframe wrapper)
```css
.iframe-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 8px solid transparent;
  background: linear-gradient(90deg, #e15f60, #ff7658, #ffa869, #ffc86f) border-box;
  -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### 4. Hamburger Navigation
```css
.linklist-btn span { /* Three lines that animate to X */ }
.linklist-content { left: -300px; transition: left 0.3s; }
.linklist-toggle:checked ~ .linklist-content { left: 0; }
```

### 5. Day/Night Toggle
```css
.theme-toggle-slider::before { /* Moon shadow overlay */ }
body.light-mode .theme-toggle-slider::before { left: -2px; /* Flips to other side */ }
```

### 6. Image Frame with Traveling Stars
```css
.traveling-stars { position: absolute; inset: -15px; overflow: hidden; }
.star-path { 
  position: absolute;
  animation: moveRight 12s linear infinite;
  /* Symbol text with gradient clip */
}
```

---

## Symbol Sets

### Celestial
`✧ ⋆ ✦ ⊹ ★ ☆ ☽ ☾ ◐ ◑ ● ○`

### Alchemical  
`🜁 🜂 🜃 🜄 ⟡ ∞`

### Mystical Unicode
`𖡼 𖣓 𖡛 𖤓 𖣔 𖡦 𖡹 𖢚 𖤈 𖥸 𖧧 𖦖`

### Egyptian/Ancient
`𓇻 𓁳 𓇷 𓇺 𓇸 𓇹 𓁿`

### Glitch/ASCII
`╔╗║═╝╚┏┓┗┛╠╣∆∇∑∐┃━╋┫┣✧⚝❈✶✷◈◇◆○◎●◐◑∞≈∫∬`

### Botanical
`𓆸 ᭡ ᭄ 𖥸`

---

## Responsive Breakpoints

```css
@media screen and (max-width: 768px) {
  /* Mobile styles */
}
@media (max-width: 920px) {
  /* Tablet/small desktop */
}
```

---

## Astro Implementation Notes

### 1. Global Styles (`src/styles/global.css`)
- Import IBM Plex Mono from Google Fonts
- Define CSS custom properties for colors
- Include base animations

### 2. Component Structure
```
src/components/
├── Navigation/
│   ├── HamburgerMenu.astro
│   └── DayNightToggle.astro
├── Text/
│   ├── GradientText.astro
│   ├── TypewriterText.astro
│   └── GlitchText.astro
├── Boxes/
│   ├── CollapsibleBox.astro
│   └── WarningBox.astro
├── Frames/
│   ├── MysticalIframe.astro
│   └── ImageFrame.astro
└── Effects/
    ├── FloatingSymbols.astro
    └── TravelingStars.astro
```

### 3. Page-Specific Themes
Each page can have its own CSS scope with theme colors:
- Homepage: Emerald theme
- Sanctuary: Lavender theme  
- Oracle: Vermillion theme
- Starlight: Cyan theme
- Memecoin: Fire theme

### 4. Script Handling
Interactive elements (symbol cycling, glitch effects) should use:
- Astro's `client:load` for immediate interactivity
- Or inline `<script>` tags for simple DOM manipulation
