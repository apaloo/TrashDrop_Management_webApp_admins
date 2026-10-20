import React from 'react';

/*
 * Vertical rhythm for public pages.
 *
 * Sections are padded 72–100px top and bottom, which suits desktop but leaves
 * long empty bands on a phone (/how-it-works/ was ~16,000px tall). At 640px
 * and below the larger paddings come down to 56px (the page's first section
 * keeps its extra top padding for the fixed header, and compact sections keep
 * their own). Rendered by PublicPageLayout and the homepage/partners styles, so
 * every public page follows one rule instead of per-section margins.
 */
export const SECTION_RHYTHM_CSS = `
  @media (max-width: 640px) {
      section[style*="padding: 72px"],
      section[style*="padding-top: 72px"],
      section[style*="padding: 80px"],
      section[style*="padding-top: 80px"],
      section[style*="padding: 88px"],
      section[style*="padding-top: 88px"],
      section[style*="padding: 96px"],
      section[style*="padding-top: 96px"],
      section[style*="padding: 100px"],
      section[style*="padding-top: 100px"] {
        padding-top: 56px !important;
        padding-bottom: 56px !important;
      }
  }
`;

const SectionRhythm = () => <style>{SECTION_RHYTHM_CSS}</style>;

export default SectionRhythm;
