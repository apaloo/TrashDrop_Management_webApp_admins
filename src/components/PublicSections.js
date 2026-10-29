import React from 'react';
import { Link } from 'react-router-dom';
import { TD, TYPE } from '../theme/brand';

// Building blocks shared by the inner public pages: a dark hero, then light
// body sections (docs/DESIGN_SYSTEM.md).

export const H2 = ({ children, center }) => (
  <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 20px', textAlign: center ? 'center' : undefined }}>{children}</h2>
);

// Body copy: light sections by default, `dark` in the hero
export const P = ({ children, dark }) => (
  <p style={{ ...TYPE.body, color: dark ? TD.sageOnDark : TD.sage, margin:'0 0 16px', maxWidth:680 }}>{children}</p>
);

export const Section = ({ tone = 'cream', width = 860, children }) => (
  <section style={{ background: tone === 'white' ? '#fff' : TD.cream, padding:'var(--td-section-y) 24px' }}>
    <div style={{ maxWidth:width, margin:'0 auto' }}>{children}</div>
  </section>
);

// The page's first section; the fixed header sits over its top
export const Hero = ({ children, width = 860, center }) => (
  <section data-surface="dark" style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y)' }}>
    <div style={{ maxWidth:width, margin:'0 auto', textAlign: center ? 'center' : undefined }}>{children}</div>
  </section>
);

// A closing call to action on a dark surface
export const DarkCta = ({ title, children }) => (
  <section data-surface="dark" style={{ background:`linear-gradient(135deg,${TD.forestDk} 0%,${TD.ink} 100%)`, padding:'var(--td-section-y) 24px', textAlign:'center' }}>
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <h2 style={{ ...TYPE.h2, color:'#f0f5f0', margin:'0 0 16px' }}>{title}</h2>
      {children}
    </div>
  </section>
);

export const linkStyle = { color:TD.forest, fontWeight:600, textDecoration:'underline', textUnderlineOffset:3 };

// `trail` is the rest of the path after Home, already joined with " / "
export const Breadcrumb = ({ trail }) => (
  <nav aria-label="Breadcrumb" style={{ ...TYPE.small, color:TD.sageOnDark, marginBottom:20 }}>
    <Link to="/" style={{ color:TD.sageOnDark, textDecoration:'none' }}>Home</Link> / {trail}
  </nav>
);

export const Eyebrow = ({ children, dark, style }) => (
  <span style={{ ...TYPE.eyebrow, display:'block', color: dark ? TD.lime : TD.forest, marginBottom:12, ...style }}>{children}</span>
);

// Numbered steps: [title, detail] pairs
export const StepList = ({ steps }) => (
  <ol style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:16 }}>
    {steps.map(([t, d], i) => (
      <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
        <span aria-hidden="true" style={{ ...TYPE.small, fontWeight:700, color:'#fff', background:TD.forest, borderRadius:'50%', width:32, height:32, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
        <span style={{ ...TYPE.body, color:TD.sage }}>
          <strong style={{ color:TD.ink, fontWeight:600 }}>{t}.</strong> {d}
        </span>
      </li>
    ))}
  </ol>
);

export const cardStyle = { background:'#fff', border:'1px solid var(--td-border)', borderRadius:12, padding:'20px 22px' };

// Small cards: [title, detail] pairs
export const CardGrid = ({ items, min = 220 }) => (
  <div style={{ display:'grid', gridTemplateColumns:`repeat(auto-fit,minmax(min(${min}px,100%),1fr))`, gap:12 }}>
    {items.map(([t, d]) => (
      <div key={t} style={cardStyle}>
        <h3 style={{ ...TYPE.body, fontWeight:600, color:TD.ink, margin:'0 0 4px' }}>{t}</h3>
        <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{d}</p>
      </div>
    ))}
  </div>
);

// A pill-shaped link to another page, on light surfaces
export const ChipLink = ({ to, children }) => (
  <Link to={to} style={{ ...TYPE.small, fontWeight:600, color:TD.forest, textDecoration:'none', background:'#fff', border:'1px solid var(--td-border)', borderRadius:999, padding:'10px 18px', display:'inline-block' }}>
    {children}
  </Link>
);

// A blog post's tag. The tag colours are light, so on light surfaces they
// tint the pill behind ink text; on dark they colour the text itself.
export const TagPill = ({ tag, color, dark }) => (
  <span style={{ ...TYPE.eyebrow, color: dark ? color : TD.ink, background: dark ? `${color}1f` : `${color}33`, borderRadius:999, padding:'4px 12px' }}>{tag}</span>
);
