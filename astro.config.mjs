// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
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
