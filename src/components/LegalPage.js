import React, { useEffect } from 'react';
import PublicPageLayout from './PublicPageLayout';
import { Hero, Breadcrumb, Eyebrow, P, linkStyle } from './PublicSections';
import { TD, TYPE } from '../theme/brand';

// The Privacy Policy and the Terms of Service: a dark hero, a list of
// sections, then each section on a white page. `sections` is
// [{ id, title, body: JSX }]; ids are the in-page links (/privacy/#cookies).
export const LegalText = ({ children }) => (
  <div style={{ ...TYPE.body, color:TD.sage }} className="td-legal">{children}</div>
);

const LegalPage = ({ path, title, metaTitle, description, eyebrow, updated, intro, sections }) => {
  useEffect(() => {
    const url = `https://trashdrops.com${path}`;
    document.title = metaTitle;
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', description);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', url);
    return () => {
      const can = document.querySelector('link[rel="canonical"]'); if (can) can.href = 'https://trashdrops.com/';
      const ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.setAttribute('content', 'https://trashdrops.com/');
      const twU = document.querySelector('meta[name="twitter:url"]'); if (twU) twU.setAttribute('content', 'https://trashdrops.com/');
    };
  }, [path, metaTitle, description]);

  return (
    <PublicPageLayout>
      <style>{`
        .td-legal p { margin: 0 0 14px; }
        .td-legal ul { margin: 0 0 14px; padding-left: 22px; }
        .td-legal li { margin-bottom: 8px; }
        .td-legal strong { color: ${TD.ink}; font-weight: 600; }
        .td-legal a { color: ${TD.forest}; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
        .td-legal-section { scroll-margin-top: 96px; }
      `}</style>
      <Hero width={860}>
        <Breadcrumb trail={title} />
        <Eyebrow dark>{eyebrow}</Eyebrow>
        <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 20px' }}>{title}</h1>
        <P dark>Last updated: {updated}</P>
        <P dark>{intro}</P>
      </Hero>

      <section style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <nav aria-label="Contents" style={{ background:TD.cream, border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'20px 24px', marginBottom:40 }}>
            <h2 style={{ ...TYPE.card, color:TD.ink, margin:'0 0 12px' }}>Contents</h2>
            <ol style={{ margin:0, paddingLeft:22, columns:'2 240px', columnGap:32 }}>
              {sections.map(s => (
                <li key={s.id} style={{ ...TYPE.small, marginBottom:6 }}>
                  <a href={`#${s.id}`} style={linkStyle}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="td-legal-section" style={{ marginBottom:36 }}>
              <h2 style={{ ...TYPE.h3, color:TD.ink, margin:'0 0 14px' }}>{i + 1}. {s.title}</h2>
              <LegalText>{s.body}</LegalText>
            </section>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default LegalPage;
