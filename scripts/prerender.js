/**
 * Post-build pre-rendering for the public marketing pages.
 *
 * CRA ships one empty shell (<div id="root"></div>) for every URL, so crawlers
 * that don't execute JS see no content and the same <title> everywhere. This
 * script serves ./build locally, loads each public route in headless Chrome,
 * and writes the rendered HTML to build/<route>/index.html so every page ships
 * real markup with its own <title>, meta description and canonical.
 *
 * The untouched shell is kept as build/app-shell.html; netlify.toml points the
 * SPA fallback at it so non-prerendered routes (dashboard etc.) don't flash the
 * homepage markup.
 *
 * Runs automatically as `postbuild`. Set PRERENDER_SKIP=1 to bypass.
 * Set PUPPETEER_EXECUTABLE_PATH to use a system Chrome/Chromium instead of the
 * bundled @sparticuz/chromium binary.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const SITE = 'https://trashdrops.com';
const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const SHELL_NAME = 'app-shell.html';
const BLOG_SHELL_NAME = 'blog-shell.html';

// Keep in sync with public/sitemap.xml and the shell rewrites in netlify.toml
const ROUTES = [
  '/',
  '/faq',
  '/how-it-works',
  '/users',
  '/collectors',
  '/illegal-dumping',
  '/about',
  '/blog',
  '/waste-collection-accra',
  '/waste-collection-kumasi',
  '/waste-collection-takoradi',
  '/waste-collection-tamale',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.map': 'application/json',
};

function startServer(shellHtml) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(BUILD_DIR, urlPath);
    if (filePath.startsWith(BUILD_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    // SPA fallback: always the original shell, never an already-prerendered page
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(shellHtml);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function renderRoute(browser, origin, route, shellJsonLdCount) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Only load our own bundle; skip Supabase, fonts, analytics etc. so the
  // build is deterministic and has no side effects. Public pages are static.
  // Lets components skip live-data fetches that can't succeed during the snapshot
  await page.evaluateOnNewDocument(() => { window.__PRERENDER__ = true; });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith(origin) || req.url().startsWith('data:')) req.continue();
    else req.abort();
  });

  await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#root h1', { timeout: 30000 });
  // Let page effects (title, canonical, JSON-LD) settle
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

  const html = await page.evaluate(shellCount => {
    // Social tags follow the page's own title/description, so link previews
    // and non-JS crawlers never see the homepage's tags on another page
    const setContent = (sel, value) => { const el = document.querySelector(sel); if (el && value) el.setAttribute('content', value); };
    const desc = (document.querySelector('meta[name="description"]') || {}).content;
    const canon = (document.querySelector('link[rel="canonical"]') || {}).href;
    setContent('meta[property="og:title"]', document.title);
    setContent('meta[name="twitter:title"]', document.title);
    setContent('meta[property="og:description"]', desc);
    setContent('meta[name="twitter:description"]', desc);
    setContent('meta[property="og:url"]', canon);
    setContent('meta[name="twitter:url"]', canon);
    // Tag JSON-LD the page injected at runtime (appended after the shell's own)
    // so src/index.js can drop it before the page re-adds it — avoids duplicates.
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el, i) => {
      if (i >= shellCount) el.setAttribute('data-prerendered', '');
    });
    // webpack re-requests lazy chunks itself; pre-existing tags can confuse its loader
    document.querySelectorAll('script[data-webpack]').forEach(el => el.remove());
    return '<!DOCTYPE html>' + document.documentElement.outerHTML;
  }, shellJsonLdCount);

  const meta = await page.evaluate(() => ({
    title: document.title,
    h1: (document.querySelector('#root h1') || {}).textContent || '',
    h1Count: document.querySelectorAll('h1').length,
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
    description: (document.querySelector('meta[name="description"]') || {}).content || '',
  }));

  await page.close();
  return { html, meta, errors };
}

async function main() {
  if (process.env.PRERENDER_SKIP === '1') {
    console.log('[prerender] PRERENDER_SKIP=1 — skipping');
    return;
  }

  const indexPath = path.join(BUILD_DIR, 'index.html');
  const shellHtml = fs.readFileSync(indexPath, 'utf8');
  // App routes (login, dashboard...) get a shell that is noindex before any JS
  // runs; blog posts get an indexable copy. See the rewrites in netlify.toml.
  const robotsMeta = /<meta name="robots" content="index, follow"\s*\/?>/;
  if (!robotsMeta.test(shellHtml)) throw new Error('robots meta not found in build/index.html');
  fs.writeFileSync(path.join(BUILD_DIR, SHELL_NAME), shellHtml.replace(robotsMeta, '<meta name="robots" content="noindex"/>'));
  fs.writeFileSync(path.join(BUILD_DIR, BLOG_SHELL_NAME), shellHtml);

  // Required lazily so `npm run build` still works without them when skipped.
  // @sparticuz/chromium ships the browser inside the npm package, so the build
  // doesn't depend on a Chrome download at install time.
  const puppeteer = require('puppeteer-core');
  const chromium = require('@sparticuz/chromium');
  const server = await startServer(shellHtml);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath(),
    args: process.env.PUPPETEER_EXECUTABLE_PATH
      ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      : chromium.args,
  });

  const shellJsonLdCount = (shellHtml.match(/application\/ld\+json/g) || []).length;
  const problems = [];
  const titles = new Map();
  const descriptions = new Map();
  try {
    for (const route of ROUTES) {
      const { html, meta, errors } = await renderRoute(browser, origin, route, shellJsonLdCount);
      const expectedCanonical = SITE + (route === '/' ? '/' : route);

      if (!meta.h1.trim()) problems.push(`${route}: no <h1> rendered`);
      if (meta.canonical !== expectedCanonical) problems.push(`${route}: canonical is "${meta.canonical}", expected "${expectedCanonical}"`);
      if (meta.h1Count !== 1) problems.push(`${route}: ${meta.h1Count} <h1> elements, expected 1`);
      if (titles.has(meta.title)) problems.push(`${route}: <title> duplicates ${titles.get(meta.title)}`);
      titles.set(meta.title, route);
      if (!meta.description) problems.push(`${route}: no meta description`);
      if (descriptions.has(meta.description)) problems.push(`${route}: meta description duplicates ${descriptions.get(meta.description)}`);
      descriptions.set(meta.description, route);
      errors.forEach(e => console.warn(`[prerender] ${route} page error: ${e}`));

      const outFile = route === '/' ? indexPath : path.join(BUILD_DIR, route, 'index.html');
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html);
      console.log(`[prerender] ${route} -> ${path.relative(BUILD_DIR, outFile)} | ${meta.title}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (problems.length) {
    console.error('[prerender] Failed checks:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[prerender] ' + (err.stack || err));
  process.exit(1);
});
