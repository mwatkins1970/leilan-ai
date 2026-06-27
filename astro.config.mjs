// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    // Canonical production host — drives canonical URLs, the sitemap, and absolute
    // OG image URLs. Keep in sync with the domain Netlify serves at launch.
    site: 'https://leilan.ai',
    integrations: [
        sitemap({
            // The experiential routes are noindex,follow — keep them out of the
            // sitemap so search engines index the clean field-note layer instead.
            filter: (page) => !page.includes('/immersive') && !page.includes('/prism/'),
        }),
    ],
    vite: {
        server: {
            // Allow any host through Vite's dev-server host check. Needed for the
            // GitHub Codespaces forwarded host AND any external tunnel (cloudflared,
            // localtunnel) used to preview when Codespaces forwarding misbehaves.
            // Dev-server only; has no effect on the production build.
            allowedHosts: ['.app.github.dev', '.trycloudflare.com'],
        },
    },
});
