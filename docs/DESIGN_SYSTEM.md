# TrashDrop design system

The rules for type, colour, spacing and focus on trashdrops.com (public
pages, sign-in and the dashboard). Approved by the owner on 29 Oct 2026.
Google Wallet is the reference for hierarchy and restraint only; the face,
colours and identity are TrashDrop's own.

Where the values live:

- `src/theme/tokens.css`: CSS custom properties (`--td-*`), loaded first by `src/index.js`
- `src/theme/brand.js`: the same colours and font roles (`TD`, `FF`) for inline styles. `PublicPageLayout` re-exports them for the pages.

Change a value in both files, never in a page.

## Typeface

**DM Sans** (SIL Open Font License) in weights 400, 500, 600 and 700, loaded
once from Google Fonts in `public/index.html`. Fallback:
`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

`FF.display`, `FF.body`, `FF.label` and `FF.data` keep their names so sections
read the same, but they are all DM Sans and differ in weight only (display 700,
data 700 with tabular figures). Google Sans is not used: it isn't licensed for
other companies' websites.

| Role | Size (desktop → phone) | Weight | Line height |
|---|---|---|---|
| Hero H1 | 56 → 36px (`--td-h1`) | 700 | 1.08–1.12 |
| Section H2 | 40 → 28px (`--td-h2`) | 700 | 1.12 |
| Subsection H3 | 26 → 22px (`--td-h3`) | 600 | 1.25 |
| Card title | 20 → 18px | 600 | 1.3 |
| Lead | 18px | 400 | 1.6 |
| Body | 16px | 400 | 1.6, at most ~68 characters per line |
| Nav, buttons | 15px | 500 / 600 | 1 |
| Small | 14px | 400–500 | 1.5 |
| Eyebrow, label | 13px, caps, +0.08em | 600 | 1.4 |

13px is the smallest text (pages still being brought into line are listed
in the PRs that change them). Emphasis inside headings is colour only (no italic).
Every page has one H1.

## Colour

| Token | Value | Use |
|---|---|---|
| `TD.lime` / `--td-brand` | `#B6EE69` | The logo's green. Fills and highlights with ink text (14.2:1), and text or buttons on dark surfaces. Never text on light surfaces (1.4:1). |
| `TD.forest` / `--td-action` | `#1B6E35` | Buttons and links on light surfaces; white text on it is 6.3:1. Hover `#155A2B`. |
| `TD.orange` / `--td-accent-orange` | `#F98B38` | The one secondary accent. Fills with ink text (8.1:1), text on dark. As text on light use `TD.orangeText` `#B4530E` (5.0:1). |
| `TD.ink` / `--td-ink` | `#0A0F0A` | Text on light; the hero, header and footer surfaces. |
| `--td-surface`, `TD.cream` | `#FFFFFF`, `#F6F8F4` | Page and alternating section backgrounds. |
| `TD.sage` / `--td-text-2` | `#525C52` | Secondary text on light (7.0:1). |
| `TD.sageOnDark` / `--td-text-2-on-dark` | `#A9B2A9` | Secondary text on dark (8.9:1). White text on dark is at least 68% opaque. |
| `--td-border`, `--td-border-strong` | `#DFE4DC`, `#8A8F9C` | Dividers; input borders (3.2:1). |
| Status | success `#15803D`, warning `#B45309`, error `#B91C1C`, info `#1D4ED8` | 5:1 or more on white. Always with a word or icon, never colour alone. |

Retired: `#A8E63D` (replaced by the logo green), gold `#F5C842` (replaced by
orange), and the Syne, DM Serif Display, Bebas Neue and Barlow Condensed faces.
`#8FD14F` and `#8FC638` are not in the logo and are not used.

Exceptions: the map's risk colours are data colours and keep their values,
always with a text label. MTN MoMo keeps MTN's yellow.

## Spacing, radius, focus

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 and 96px (`--td-space-1` to `--td-space-9`).
- **Sections:** `padding: var(--td-section-y) 24px`, which is 96px on desktop, 72px on tablets (900px and below) and 56px on phones (640px and below).
  - Strips (stats, marquees) use `--td-section-y-compact`: 48, 40 or 32px.
  - The first section adds the fixed header: `calc(var(--td-header-h) + var(--td-section-y))`.
- **Radius:** 8px for controls, 12px for cards, 20px for panels, and pills.
- **Focus:** every link and control shows a 3px focus ring, dark green on light surfaces and brand green in the header, footer and `[data-surface="dark"]`.
- **Motion:** content is readable at rest; nothing waits for a scroll to appear. Animations stop when the visitor's device asks for reduced motion.

## Dashboard

The signed-in dashboard uses the same tokens, approved by the owner on
29 Oct 2026:

- **Shell:** a dark ink sidebar (`--td-sidebar-bg`, like the website header) with
  white text and the current page in brand green; a white top bar; a pale
  `#F6F8F4` page with white cards. The values are the `--td-*` variables in
  `src/index.css`.
- **Dark mode** is off until the person turns it on with the moon button in
  the top bar; the choice is kept in this browser (`trashdrop_theme`). Only
  the dashboard's content area changes: the sidebar is dark in both modes,
  and the public site and sign-in are always light.
  - Colours: page `#0D120D`, cards `#151B15`, raised `#1C241C`, pale green
    `#17301F`, borders `#2B352B` / `#6F7A6F`, text `#EEF3EC` / `#B3BCB2`,
    links and green text `#8FD6A0`, focus ring brand green. They are the
    `[data-theme="dark"]` variables in `src/index.css`.
  - `src/theme/dark.css` gives each colour class the dashboard uses its dark
    value; status tints become deep fills with pale text. A new colour class
    needs a rule there: `src/theme/__tests__/darkMode.test.js` names any that
    are missing.
  - Charts take `chartColor(c, isDark)` and `applyChartTheme(ChartJS, isDark)`
    from `src/theme/chartTheme.js`; colours written inline (like the alert
    severities on the dashboard home) need a dark pair beside them.
  - Every dashboard page meets the same checks in both modes (axe 0, nothing
    under 13px).
- **Tailwind:** `text-xs` is 13px, and `green-600/700/800` are the dark green
  family (`#1B6E35`, `#155A2B`, `#114A23`), so green buttons, links and text
  pass contrast. The `td-*` colours in `tailwind.config.js` match `TD`.
