// Copies the web app into www/, which is what Capacitor bundles into the iOS and Android apps.
// The site itself still runs straight from the repo root (GitHub Pages is unaffected).
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', 'app.js', 'calc.js', 'native.js', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icons'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`, { recursive: true });
console.log(`Copied ${FILES.length} entries to www/`);
