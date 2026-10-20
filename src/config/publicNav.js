/**
 * The public site menu, shared by the homepage header (HomePageNew.js) and the
 * header on every other public page (PublicPageLayout.js) through
 * components/PublicMenu.js, so every page shows the same menu.
 *
 * An entry is either a plain link ({ to, label }) or a dropdown
 * ({ label, groups }). A group has items and, optionally, a short title shown
 * above them (a link when it has `titleTo`). `to` values with a '#' scroll to that section.
 */
export const PUBLIC_NAV = [
  {
    label: 'Households',
    groups: [{
      items: [
        { to: '/how-it-works/',          label: 'How it works',                  icon: 'fa-route' },
        { to: '/how-it-works/#services', label: 'Two ways to drop your waste',   icon: 'fa-recycle' },
        { to: '/how-it-works/#pricing',  label: 'Smart waste. Fair price',       icon: 'fa-tags' },
        { to: '/#book-app',              label: 'Get started today — it’s free', icon: 'fa-qrcode' },
      ],
    }],
  },
  { to: '/collectors/', label: 'Earn as Carter' },
  {
    label: 'Environment',
    groups: [
      {
        title: 'Partners', titleTo: '/partners/',
        items: [
          { to: '/partners/#pathways', label: 'Local Authorities',   icon: 'fa-landmark' },
          { to: '/volunteers/',        label: 'Volunteers',          icon: 'fa-hands-helping' },
          { to: '/media/',             label: 'Media & Journalists', icon: 'fa-newspaper' },
        ],
      },
      {
        title: 'Take action',
        items: [
          { to: '/partners/#map',      label: 'Track. Report. Eliminate illegal dumping', icon: 'fa-map-marked-alt' },
          { to: '/partners/#impact',   label: 'Environmental impact',                      icon: 'fa-leaf' },
          { to: '/illegal-dumping/',   label: 'Report illegal dumping',                    icon: 'fa-camera' },
        ],
      },
    ],
  },
  { to: '/blog/', label: 'Blog' },
  {
    label: 'About us',
    groups: [{
      items: [
        { to: '/about/',          label: 'About TrashDrop',           icon: 'fa-info-circle' },
        { to: '/faq/',            label: 'FAQ',                       icon: 'fa-question-circle' },
      ],
    }],
  },
];
