// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    vite: {
        server: {
            // Allow the GitHub Codespaces forwarded host (and any subdomain of it)
            // through Vite's host check, otherwise the dev server returns a 403
            // that the Codespaces edge surfaces as a 404.
            allowedHosts: ['.app.github.dev'],
        },
    },
});
