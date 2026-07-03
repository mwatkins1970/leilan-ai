# Wall Video Buttons — current state & how to reinstate

*Last updated: 2026-07-03.*

## Current behaviour

The `▶ video` button on a word-panel wall renders **only when that wall's config
has a `videoSrc`**, and playback is **click-to-load** (nothing fetched until the
click). Videos are **hosted on Cloudflare R2, not locally** — `public/video/` is
gone. Wired so far: Research Lab **GPT-3** (`research-gpt3.mp4`) and Mythopoeic
Archive **Crossbones** (`crossbones2.mp4`), both on the `leilan-website-video`
R2 bucket. See CLAUDE.md → *Video System* for the R2 / rclone workflow.

The playback overlay (`openWallVideo` in `prism.js`) has a **×** close (upper-
right), a **fullscreen toggle** (diagonal-arrows SVG, upper-left; fullscreens the
overlay, iOS falls back to native video fullscreen), fills up to 92%×94% of the
wall, and also works from the **portrait fullscreen reader**.

Previously every word-panel wall rendered a *disabled placeholder* video button
(dim, `cursor: not-allowed`, `.wall-video-disabled`). Those placeholders have
been removed — they advertised a feature that wasn't there. The full machinery
(overlay, audio-duck, loader spinner — see `AUDIO.md` "Video-Audio Interaction")
is untouched and still drives Crossbones; nothing was deleted from `prism.js`
or the CSS.

## To add a video to a wall (the normal case)

Compress + upload the clip to R2 (see CLAUDE.md → *Video System*), then give that
wall a `videoSrc` in `src/data/prisms.ts` pointing at the R2 public URL, e.g.:

```ts
{
    archway: false,
    videoSrc: 'https://pub-5a2d69eb071c44f6bcc6eb73b02d9328.r2.dev/your-clip.mp4',
    content: { type: 'word-panel', label: '…', text: wallText('….html') },
},
```

The button appears automatically (enabled/glowing), and `openWallVideo` /
`closeWallVideo` handle playback + the audio fade with no further wiring.

`hideVideo: true` on a wall keeps the button hidden even if a `videoSrc` is
present (currently set on the OVS Handbook and data walls). Drop that flag if you
later want their video to surface.

## To bring back the disabled placeholder button on every word wall

If you ever want the old "coming soon" placeholders back, restore the original
render block in `src/pages/prism/[id].astro` (it sat just after the
`.wall-scroll-up` button inside `.wall-text-frame`):

```astro
{!wall.hideVideo && (
<button class={`wall-video-btn${wall.videoSrc ? '' : ' wall-video-disabled'}`}
    type="button"
    data-video-src={wall.videoSrc || ''}
    disabled={!wall.videoSrc}>
    <span class="wall-video-icon">▶</span> video
</button>
)}
```

The supporting CSS (`.wall-video-btn`, `.wall-video-btn:not(.wall-video-disabled)`,
plus the OVS-chapel override at `[data-prism-id="ovs-chapel"] .wall-video-btn.wall-video-disabled`)
is still present in `src/styles/prism.css` (~line 873), so the placeholder
styling will work immediately on restore. The `.wall-video-disabled` rules are
otherwise dormant while the current `videoSrc`-gated markup is in place.
