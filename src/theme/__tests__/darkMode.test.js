/**
 * Dark mode coverage: every colour class the dashboard uses that would be
 * unreadable on the dark surfaces has a rule in src/theme/dark.css.
 * (Public pages and sign-in are light only and are not scanned.)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');
const DARK_CSS = fs.readFileSync(path.join(SRC, 'theme', 'dark.css'), 'utf8');

// Light-only files: the public site, sign-in and their tests
const LIGHT_ONLY = /(^|\/)(landing|public|auth|__tests__|tests)\/|PublicSections|HomePageNew|SignUp|Login|ForgotPassword|ResetPassword|JoinInvite|Sidebar\.js$/;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.jsx?$/.test(e.name) ? [p] : [];
});

const TINTS = '(red|amber|yellow|blue|orange|purple|green|teal|indigo|sky|emerald)';
// Classes drawn for a light page: pale fills, dark text, light borders
const NEEDS_DARK = new RegExp([
  'bg-white',
  'bg-td-(cream|tonal)',
  'text-td-(ink|sage|forest|error|border)',
  'border-td-(border|border-strong|forest|error)',
  'divide-(td-border|gray-(100|200))',
  'bg-gray-(50|100|200|300|400)',
  'text-gray-(600|700|800|900)',
  'border-gray-(100|200|300)',
  `bg-${TINTS}-(50|100)`,
  `text-${TINTS}-(600|700|800|900)`,
  `border-${TINTS}-(100|200|300)`,
].map((c) => `(?:hover:|group-hover:)?(?:${c})`).join('|'), 'g');

const used = new Map();
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  if (LIGHT_ONLY.test(rel) || rel.startsWith('theme')) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(["'`])([^"'`\n]*)\1/g)) {
    for (const cls of m[2].split(/\s+/)) {
      if (new RegExp(`^(?:${NEEDS_DARK.source})$`).test(cls)) {
        if (!used.has(cls)) used.set(cls, rel);
      }
    }
  }
}

const selectorFor = (cls) => `.${cls.replace(/:/g, '\\:')}`;

describe('dashboard dark mode', () => {
  it('finds the dashboard colour classes to check', () => {
    expect(used.size).toBeGreaterThan(40);
  });

  it('has a dark rule for each of them', () => {
    const missing = [...used].filter(([cls]) => !DARK_CSS.includes(selectorFor(cls)))
      .map(([cls, file]) => `${cls} (${file})`);
    expect(missing).toEqual([]);
  });
});

describe('dark chart colours', () => {
  const { CHART } = require('../brand');
  const { chartColor, CHART_DARK } = require('../chartTheme');

  it('maps each chart colour to its dark shade, and leaves light mode alone', () => {
    Object.keys(CHART).forEach((k) => {
      expect(chartColor(CHART[k], true)).toBe(CHART_DARK[k]);
      expect(chartColor(CHART[k], false)).toBe(CHART[k]);
    });
    expect(chartColor('#123456', true)).toBe('#123456');
  });
});
