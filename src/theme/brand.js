/**
 * TrashDrop brand tokens for inline styles. The CSS custom properties in
 * src/theme/tokens.css hold the same values; keep the two in step.
 *
 * Colours stay plain hex strings because the pages append alpha to them
 * (`${TD.lime}40`), which a var() can't take.
 *
 *   lime     brand green, from the logo. Fills and highlights with ink text,
 *            text and buttons on dark surfaces. Never text on light surfaces.
 *   forest   action colour on light surfaces (white text on it: 6.3:1)
 *   orange   the one secondary accent. Fills with ink text, text on dark.
 *            On light surfaces use orangeText.
 *   ink      text on light surfaces; the dark hero, header and footer
 */
export const TD = {
  lime:       '#b6ee69',
  forest:     '#1b6e35',
  forestDk:   '#0f4020',
  ink:        '#0a0f0a',
  ink2:       '#111a13',
  sage:       '#525c52', // secondary text on light surfaces (7.0:1 on white)
  sageOnDark: '#a9b2a9', // secondary text on dark surfaces (8.9:1 on ink)
  cream:      '#f6f8f4',
  orange:     '#f98b38',
  orangeText: '#b4530e', // orange as text on light surfaces (5.0:1 on white)
};

/** One typeface, DM Sans, in four weights (400, 500, 600, 700) */
export const FONT = "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// The roles keep their names so sections read the same; they share the face
// and differ in weight only
export const FF = {
  display: { fontFamily: FONT, fontWeight: 700, lineHeight: 1.12 },
  body:    { fontFamily: FONT },
  label:   { fontFamily: FONT },
  data:    { fontFamily: FONT, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
};
