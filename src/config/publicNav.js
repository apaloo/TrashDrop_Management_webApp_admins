/**
 * The public site menu, shared by the homepage header (HomePageNew.js) and the
 * header on every other public page (PublicPageLayout.js) through
 * components/PublicMenu.js, so every page shows the same menu.
 *
 * An entry is either a plain link ({ to, label }) or a dropdown
 * ({ label, groups }). A group has items and, optionally, a short title or a
 * tagline shown above them. `to` values with a '#' scroll to that section.
 */
export const PUBLIC_NAV = [
  {
    label: 'Households',
    groups: [{
      tagline: 'Bin full? Request pickup.',
      items: [
        { to: '/how-it-works/', label: 'How it works',                  icon: 'fa-route' },
        { to: '/#services',     label: 'Two ways to drop your waste',   icon: 'fa-recycle' },
        { to: '/#pricing',      label: 'Smart waste. Fair price',       icon: 'fa-tags' },
        { to: '/signup',        label: 'Get started today — it’s free', icon: 'fa-arrow-right' },
      ],
    }],
  },
  { to: '/collectors/', label: 'Earn as Carter' },
  {
    label: 'Environment',
    groups: [
      {
        title: 'Who it’s for',
        items: [
          { to: '/partners/#pathways', label: 'Local Authorities',   icon: 'fa-landmark' },
          { to: '/volunteers/',        label: 'Volunteers',          icon: 'fa-hands-helping' },
          { to: '/media/',             label: 'Media & Journalists', icon: 'fa-newspaper' },
        ],
      },
      {
        tagline: 'Trash walk is a health walk — one photo, cleaner community.',
        items: [
          { to: '/partners/',          label: 'Partners',                                  icon: 'fa-handshake' },
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
        { to: '/#service-areas',  label: 'Waste collection near you', icon: 'fa-map-marker-alt' },
        { to: '/faq/',            label: 'FAQ',                       icon: 'fa-question-circle' },
      ],
    }],
  },
];
