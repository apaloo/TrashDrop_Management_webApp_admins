/**
 * The public site menu, shared by the homepage header (HomePageNew.js) and the
 * header on every other public page (PublicPageLayout.js), so the two can't
 * drift apart. `more: true` links move into the "More" menu below 1280px so
 * the desktop bar stays on one line.
 */
export const PUBLIC_NAV = [
  { to: '/how-it-works/',     label: 'How It Works' },
  { to: '/users/',            label: 'For Households' },
  { to: '/collectors/',       label: 'Earn as Carter', more: true },
  { to: '/illegal-dumping/',  label: 'Report Dumping' },
  { to: '/blog/',             label: 'Blog', more: true },
  { to: '/about/',            label: 'About', more: true },
  { to: '/partners/',         label: 'Partners' },
];
