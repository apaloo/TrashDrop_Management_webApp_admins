/**
 * Sitemap <lastmod> from git history.
 *
 * Each pre-rendered route lists the source files its content comes from. The
 * route's <lastmod> is the date (UTC) of the last commit that touched any of
 * them, so the sitemap only moves when a page really changed.
 *
 * prerender.js applies this to build/sitemap.xml on every build. Run
 * `node scripts/sitemap-lastmod.js` to write the same dates into
 * public/sitemap.xml.
 *
 * Without usable git history (no git, or a shallow clone that can't be
 * deepened) the dates already in the file are kept.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { blogPostRoutes } = require('./blog-slugs');

const ROOT = path.resolve(__dirname, '..');

// The menu every public page shows
const MENU = ['src/components/PublicMenu.js', 'src/config/publicNav.js'];
// Header, footer and SEO tags shared by every PublicPageLayout page
const PUBLIC_LAYOUT = ['src/components/PublicPageLayout.js', 'src/utils/seo.js', ...MENU];
// The homepage sections, which /partners reuses
const HOME = [
  'src/pages/HomePageNew.js',
  'src/config/homepage.js',
  'src/components/landing',
  'src/services/publicDumpingReportsService.js',
  'src/pages/cityContent.js',
  'src/utils/seo.js',
  'public/images/home',
  'public/images/cities',
  'public/images/book-in-app-qr.png',
  ...MENU,
];
const CITY = ['src/pages/CityWasteCollectionPage.js', 'src/pages/cityContent.js', ...PUBLIC_LAYOUT];
// A post's text lives in BlogPostPage.js, its card and dates in BlogPage.js
const BLOG_POST = ['src/pages/blog/BlogPostPage.js', 'src/pages/BlogPage.js', 'public/images/blog', ...PUBLIC_LAYOUT];

// Keep in step with ROUTES in prerender.js (the build fails if a route is missing here)
const ROUTE_SOURCES = {
  '/': HOME,
  '/partners': [...HOME, 'src/pages/PartnersPage.js'],
  '/faq': ['src/pages/FAQPage.js', ...PUBLIC_LAYOUT],
  // Also shows the homepage's steps, services and pricing sections
  '/how-it-works': ['src/pages/HowItWorksPage.js', ...HOME, ...PUBLIC_LAYOUT],
  '/users': ['src/pages/UsersPage.js', ...PUBLIC_LAYOUT],
  '/collectors': ['src/pages/CollectorsPage.js', ...PUBLIC_LAYOUT],
  '/illegal-dumping': ['src/pages/IllegalDumpingPublicPage.js', ...PUBLIC_LAYOUT],
  '/about': ['src/pages/AboutPage.js', ...PUBLIC_LAYOUT],
  '/blog': ['src/pages/BlogPage.js', 'public/images/blog', ...PUBLIC_LAYOUT],
  '/waste-collection-accra': CITY,
  '/waste-collection-kumasi': CITY,
  '/waste-collection-takoradi': CITY,
  '/waste-collection-tamale': CITY,
  '/waste-pickup': ['src/pages/WastePickupPage.js', ...PUBLIC_LAYOUT],
  '/volunteers': ['src/pages/VolunteersPage.js', ...PUBLIC_LAYOUT],
  '/media': ['src/pages/MediaPage.js', ...PUBLIC_LAYOUT],
  ...Object.fromEntries(blogPostRoutes().map(route => [route, BLOG_POST])),
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Full history is needed: in a shallow clone every older file looks changed at the clone boundary
let historyOk;
function hasHistory() {
  if (historyOk !== undefined) return historyOk;
  try {
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
      try { git(['fetch', '--unshallow', '--quiet']); } catch (e) { /* stays shallow */ }
    }
    historyOk = git(['rev-parse', '--is-shallow-repository']) === 'false';
  } catch (e) {
    historyOk = false;
  }
  return historyOk;
}

/** 'YYYY-MM-DD' of the last commit touching the route's sources, or null when unknown */
function lastmodFor(route) {
  const files = ROUTE_SOURCES[route];
  if (!files || !hasHistory()) return null;
  try {
    return git(['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d', '--', ...files]) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Rewrites the <lastmod> of each <url> in the sitemap at `file` (inserting one
 * after <loc> if missing). Returns { changed, kept } lists for logging.
 */
function applyLastmod(file, site) {
  const xml = fs.readFileSync(file, 'utf8');
  const changed = [];
  const kept = [];
  const out = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block, inner) => {
    const loc = (inner.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    if (!loc) return block;
    const route = loc.replace(site, '').replace(/(.)\/$/, '$1') || '/';
    const date = lastmodFor(route);
    if (!date) { kept.push(route); return block; }
    const updated = /<lastmod>[^<]*<\/lastmod>/.test(inner)
      ? inner.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`)
      : inner.replace(/(<loc>[^<]+<\/loc>)/, `$1\n    <lastmod>${date}</lastmod>`);
    if (updated !== inner) changed.push(`${route} ${date}`);
    return `<url>${updated}</url>`;
  });
  fs.writeFileSync(file, out);
  return { changed, kept };
}

module.exports = { ROUTE_SOURCES, lastmodFor, applyLastmod };

if (require.main === module) {
  const { changed, kept } = applyLastmod(path.join(ROOT, 'public', 'sitemap.xml'), 'https://trashdrops.com');
  console.log(changed.length ? `Updated: ${changed.join(', ')}` : 'No changes');
  if (kept.length) console.log(`Kept existing date (no git history): ${kept.join(', ')}`);
}
