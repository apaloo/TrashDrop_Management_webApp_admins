#!/usr/bin/env node
/**
 * Build-time prerendering for the public marketing pages.
 *
 * Why this exists
 * ---------------
 * This is a Create React App SPA: the shipped index.html is an empty
 * <div id="root"></div> and every word of content is painted by JavaScript.
 * Google can render JS, but it defers it to a second pass that may lag by days
 * or weeks — and for a domain with no authority that often means the content is
 * never indexed at all.
 *
 * Worse, the per-page <title>, meta description and rel=canonical are written
 * by useEffect *after* React mounts. The HTML a crawler receives on first fetch
 * carries index.html's defaults, so every route looks like a duplicate of the
 * homepage until JS runs.
 *
 * This script loads each public route in a real browser, waits for React to
 * finish, and writes the resulting DOM — <head> mutations included — to a
 * static file. Netlify serves those files directly (the SPA rewrite uses
 * force=false, so static files win), and React takes over on load as usual.
 *
 * It is deliberately fail-soft: if no Chromium is available the build still
 * succeeds and simply ships the un-prerendered SPA, exactly as before.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const SHELL = path.join(BUILD, 'app-shell.html');
const PORT = Number(process.env.PRERENDER_PORT) || 45678;

/* Public routes only. Authenticated areas (/dashboard, /settings, …) and the
   auth screens are deliberately excluded: they have nothing to rank for and
   prerendering them would bake a signed-out snapshot into the HTML. */
const STATIC_ROUTES = [
  '/',
  '/how-it-works',
  '/users',
  '/collectors',
  '/illegal-dumping',
  '/accra',
  '/about',
  '/blog',
  '/faq',
];

/* Blog slugs are read from the source of truth so the two can't drift apart. */
function blogRoutes() {
  const src = path.join(ROOT, 'src', 'pages', 'BlogPage.js');
  if (!fs.existsSync(src)) return [];
  const text = fs.readFileSync(src, 'utf8');
  const slugs = [...text.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
  return [...new Set(slugs)].map(s => `/blog/${s}`);
}

/* ── Locate a Chromium we can drive ─────────────────────────────────────── */
function findChromium() {
  const explicit = [
    process.env.PRERENDER_CHROMIUM,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const p of explicit) if (fs.existsSync(p)) return p;

  // Playwright's browser cache, e.g. /opt/pw-browsers/chromium-1194/chrome-linux/chrome
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (cache && fs.existsSync(cache)) {
    for (const dir of fs.readdirSync(cache)) {
      if (!dir.startsWith('chromium')) continue;
      for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(cache, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }

  const system = [
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
  ];
  for (const p of system) if (fs.existsSync(p)) return p;

  // Last resort: let playwright-core resolve its own bundled download.
  try {
    const { chromium } = require('playwright-core');
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) { /* not installed or no bundled browser */ }

  return null;
}

/* ── Minimal static server over build/, SPA-falling back to the shell ───── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function startServer(shellHtml) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(BUILD, urlPath);
      if (!filePath.startsWith(BUILD)) { res.writeHead(403).end(); return; }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      // Any unmatched path renders through the pristine SPA shell.
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(shellHtml);
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

function outputPathFor(route) {
  return route === '/'
    ? path.join(BUILD, 'index.html')
    : path.join(BUILD, route.replace(/^\//, ''), 'index.html');
}

async function main() {
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
    console.warn('[prerender] no build/index.html — run the build first. Skipping.');
    return;
  }

  /* Write the SPA fallback FIRST, before anything that can bail out.
     netlify.toml rewrites every unmatched path to /app-shell.html, so this file
     must exist on every deploy — including deploys where prerendering is
     skipped. If it were only written on the success path, a missing browser
     would take down client-side routing for the whole site. */
  const indexHtml = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
  const indexIsPristine = /<div id="root">\s*<\/div>/.test(indexHtml);
  if (indexIsPristine) {
    fs.copyFileSync(path.join(BUILD, 'index.html'), SHELL);
    console.log('[prerender] wrote SPA fallback -> build/app-shell.html');
  } else if (fs.existsSync(SHELL)) {
    // Re-run over an already-prerendered build: index.html now holds the
    // homepage, so copying it would poison the fallback. Keep the existing one.
    console.log('[prerender] reusing existing build/app-shell.html');
  } else {
    console.warn(
      '[prerender] ABORT — build/index.html is already prerendered and there is\n' +
      '[prerender] no app-shell.html to fall back on. Run a clean build first:\n' +
      '[prerender]   rm -rf build && npm run build\n'
    );
    return;
  }

  const executablePath = findChromium();
  if (!executablePath) {
    console.warn(
      '\n[prerender] SKIPPED — no Chromium found.\n' +
      '[prerender] The site still builds and deploys, but the public pages will\n' +
      '[prerender] ship as an empty JS shell with no server-rendered content.\n' +
      '[prerender] To enable: npx playwright install chromium   (or set\n' +
      '[prerender] PRERENDER_CHROMIUM / CHROME_PATH to a Chrome binary).\n'
    );
    return;
  }

  let chromium;
  try {
    ({ chromium } = require('playwright-core'));
  } catch (_) {
    console.warn('[prerender] SKIPPED — playwright-core is not installed. Run: npm i -D playwright-core');
    return;
  }

  /* Preserve the untouched CRA shell before we overwrite index.html with the
     prerendered homepage. netlify.toml rewrites unmatched paths here, so that
     /login, /dashboard and genuinely-missing URLs still boot a clean SPA
     instead of being served the homepage's HTML (which would read as a soft
     404 to any crawler that doesn't execute JavaScript). */
  const shellHtml = fs.readFileSync(SHELL, 'utf8');

  const routes = [...STATIC_ROUTES, ...blogRoutes()];
  const server = await startServer(shellHtml);
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // Marketing pages need no backend; blocking it avoids long network waits.
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('supabase.co') || url.includes('/rest/v1/') || url.includes('/realtime/')) {
        return route.abort();
      }
      return route.continue();
    });

    for (const route of routes) {
      const url = `http://127.0.0.1:${PORT}${route}`;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 45000 });
        // Wait for React to paint real content into #root.
        await page.waitForFunction(
          () => {
            const r = document.getElementById('root');
            return r && r.querySelector('h1') && r.innerText.trim().length > 200;
          },
          { timeout: 30000 }
        );
        await page.waitForTimeout(600); // let head-mutating effects settle

        const html = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
        const meta = await page.evaluate(() => ({
          title: document.title,
          canonical: document.querySelector('link[rel="canonical"]')?.href || '(none)',
          h1: document.querySelectorAll('h1').length,
          chars: document.getElementById('root').innerText.trim().length,
        }));

        const out = outputPathFor(route);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, html, 'utf8');
        results.push({ route, ok: true, ...meta, bytes: Buffer.byteLength(html) });
      } catch (err) {
        results.push({ route, ok: false, error: err.message.split('\n')[0] });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  console.log(`\n[prerender] ${ok.length}/${results.length} routes prerendered`);
  for (const r of ok) {
    console.log(`  ✓ ${r.route.padEnd(50)} h1=${r.h1} ${String(r.chars).padStart(6)} chars  ${(r.bytes / 1024).toFixed(0).padStart(4)}KB  ${r.canonical}`);
  }
  for (const r of failed) console.log(`  ✗ ${r.route.padEnd(50)} ${r.error}`);

  // A partial prerender is still a better deploy than none, so never fail the
  // build here — but make a total failure loud.
  if (ok.length === 0) console.warn('[prerender] WARNING: nothing was prerendered; shipping the plain SPA.');
}

main().catch(err => {
  console.warn('[prerender] SKIPPED — unexpected error:', err.message);
});
