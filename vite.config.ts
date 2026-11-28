import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const build = process.env.GITHUB_SHA?.slice(0, 12) || execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
    // GitHub Pages is hosted below /QNLBC-APP/. Capacitor loads the same
    // bundle from its own origin and needs relative asset paths.
    base: mode === 'android' ? './' : '/QNLBC-APP/',
    plugins: [react(), tailwindcss(), {
      name: 'qnlbc-production-security',
      apply: 'build',
      transformIndexHtml: { order: 'post', handler(html) {
        const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
          .filter(match => match[1].trim())
          // HTML parsing normalizes CRLF before the browser checks CSP hashes.
          .map(match => `'sha256-${createHash('sha256').update(match[1].replace(/\r\n?/g, '\n')).digest('base64')}'`);
        const policy = `base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' ${hashes.join(' ')}; worker-src 'self' blob:`;
        return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="strict-origin-when-cross-origin">`);
      } },
    }],
    define: {
      'import.meta.env.VITE_APP_BUILD': JSON.stringify(build),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Stable SDK/framework bundles stay cached across ordinary app updates.
          manualChunks(id) {
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-core';
            if (id.includes('/node_modules/@supabase/')) return 'supabase-sdk';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
