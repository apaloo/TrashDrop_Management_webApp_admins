import fs from 'fs';
import path from 'path';

// Every page of the app must load when its address is opened directly (a link,
// a bookmark, a refresh). Netlify only sends the paths listed in netlify.toml to
// the app; anything else gets the static 404 page. Public marketing pages are
// pre-rendered files (scripts/prerender.js) and need no rewrite.
const root = path.join(__dirname, '../..');
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');
const prerender = fs.readFileSync(path.join(root, 'scripts/prerender.js'), 'utf8');

const rewrites = [...toml.matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "\/app-shell\.html"\s*status = 200/g)].map(m => m[1]);
const prerendered = [...prerender.slice(prerender.indexOf('const ROUTES = ['), prerender.indexOf('];', prerender.indexOf('const ROUTES = [')))
  .matchAll(/'(\/[^']*)'/g)].map(m => m[1]);
const routes = [...new Set([...app.matchAll(/<Route path="(\/[^"]*)"/g)].map(m => m[1]))];

// "/team" matches "/team"; "/performance/accounts/:id" matches "/performance/*"
const covered = (route) => rewrites.some(r => (r.endsWith('/*') ? route.startsWith(r.slice(0, -1)) : route === r));
const isPublic = (route) => prerendered.includes(route) || route === '/accra' || route.startsWith('/blog') || route === '/';

it('finds the rewrites, the pre-rendered pages and the app routes', () => {
  expect(rewrites).toEqual(expect.arrayContaining(['/login', '/dashboard', '/join/*']));
  expect(prerendered).toEqual(expect.arrayContaining(['/faq', '/volunteers']));
  expect(routes.length).toBeGreaterThan(30);
});

it('loads every app page when opened directly (no static 404)', () => {
  const missing = routes.filter(r => !isPublic(r) && !covered(r));
  expect(missing).toEqual([]);
});
