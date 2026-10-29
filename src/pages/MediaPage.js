import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { TYPE, BTN } from '../theme/brand';
import { Section, H2, P, linkStyle } from '../components/PublicSections';
import { useSeo, faqJsonLd, organizationJsonLd } from '../utils/seo';

// For journalists and newsrooms: targets "illegal dumping data Ghana" / "waste data for journalists" searches.
export const MEDIA_SEO = {
  title: 'Illegal Dumping Data for Journalists & Media in Ghana | TrashDrop',
  description: 'Media accounts get national, read-only data on illegal dumping reports and cleanups in Ghana: photos, locations, status and cleanup times, with CSV download.',
  path: '/media/',
};

const DATA = [
  ['Where and what', 'Location, area, region and district, photos, waste type and size of each reported site.'],
  ['What happened next', 'Status, report and cleanup dates, how long the cleanup took, and cleanup photos.'],
  ['Who cleaned it up', 'Whether TrashDrop or a volunteer group cleared the site.'],
  ['No reporter details', 'Nothing that identifies the person who reported a site is shared.'],
];

const STEPS = [
  ['Sign up as Journalist / Media', 'Create an account with the Journalist / Media type, your media house and your press ID or accreditation number.'],
  ['Get approved', 'The TrashDrop team checks and approves Media accounts.'],
  ['Explore the reports', 'Filter by date range, region, district and status. The view opens on the last 90 days.'],
  ['Download the data', 'Download what you see as a CSV file, up to 5,000 reports at a time.'],
];

const FAQ = [
  { q: 'Who can get a Media account?', a: 'Journalists, editors, researchers and newsrooms reporting on waste and the environment in Ghana. Sign up with the Journalist / Media account type; the TrashDrop team approves each account.' },
  { q: 'What data can Media accounts see?', a: 'Illegal dumping reports across Ghana: location, area, region and district, photos, status, report and cleanup dates, size, how long the cleanup took, whether TrashDrop or a volunteer group cleaned it up, and cleanup photos.' },
  { q: 'Can I see who reported a site?', a: 'No. Reporter accounts and free-text descriptions, which can hold names and phone numbers, are never shown to Media accounts.' },
  { q: 'Can I change the data?', a: 'No. Media access is read-only.' },
  { q: 'How much can I download?', a: 'Each CSV download holds up to 5,000 reports for the filters you choose. Every download is recorded with your account.' },
  { q: 'Is there public data without an account?', a: 'Yes. The live illegal dumping map and environmental impact figures on the Partners page are open to everyone.' },
];

// Report photos from TrashDrop users for the hero's press wall (file in public/images/media, place)
const PRESS_PHOTOS = [
  ['chocked_bridge', 'Accra'], ['chocked_drainage_1', 'Drain'], ['ksi_central_market', 'Kumasi'],
  ['chocked_pavement_1', 'Pavement'], ['chocked_drainage_2', 'Drain'], ['chocked_pavement_3', 'Roadside'],
];

const CtaButtons = ({ dark }) => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <Link to="/signup?type=media" style={dark ? BTN.primaryOnDark : BTN.primary}>
      Request Media access
    </Link>
    <Link to="/partners/#map" style={dark ? BTN.ghostOnDark : BTN.tonal}>
      <i className="fas fa-map-marked-alt" aria-hidden="true"></i> See the live map
    </Link>
  </div>
);

const MediaPage = () => {
  useSeo({ ...MEDIA_SEO, jsonLd: [faqJsonLd(FAQ), organizationJsonLd()] });

  return (
    <PublicPageLayout>
      <style>{`
        .td-press-print { transition: transform 0.3s ease; }
        @media(max-width:900px) {
          .td-press-wall { width:100%!important; opacity:0.28; }
          .td-press-fade { background:linear-gradient(180deg, rgba(10,15,10,0.75) 0%, ${TD.ink} 100%)!important; }
        }
      `}</style>
      <section data-surface="dark" style={{ position:'relative', overflow:'hidden', background:TD.ink, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y)' }}>
        {/* Press wall: real reports from TrashDrop users, pinned like prints under a camera viewfinder */}
        <div className="td-press-wall" aria-hidden="true" style={{ position:'absolute', top:0, right:0, bottom:0, width:'58%' }}>
          <div style={{ position:'absolute', inset:'-40px -60px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:18, transform:'rotate(-6deg)', alignContent:'center' }}>
            {PRESS_PHOTOS.map(([file, place], i) => (
              <div key={file} className="td-press-print" style={{ background:'#f4f1ea', padding:'8px 8px 26px', borderRadius:3, boxShadow:'0 14px 30px rgba(0,0,0,0.55)', transform:`rotate(${[2,-3,4,-2,3,-4][i]}deg) translateY(${i % 2 ? 26 : 0}px)`, position:'relative' }}>
                <img src={`/images/media/${file}.jpg`} alt="" loading="eager" style={{ width:'100%', height:200, objectFit:'cover', display:'block', filter:'contrast(1.05) saturate(0.85)' }} />
                <span style={{ position:'absolute', left:10, bottom:7, fontFamily:"'Courier New', monospace", fontSize:13, fontWeight:700, letterSpacing:'0.5px', color:'#333', textTransform:'uppercase' }}>Report · {place}</span>
              </div>
            ))}
          </div>
          {/* Viewfinder corners and a recording dot */}
          {[{ top:120, left:40 }, { top:120, right:40 }, { bottom:40, left:40 }, { bottom:40, right:40 }].map((pos, i) => (
            <span key={i} style={{ position:'absolute', ...pos, width:34, height:34, borderColor:TD.lime, borderStyle:'solid', borderWidth:`${pos.top !== undefined ? 3 : 0}px ${pos.right !== undefined ? 3 : 0}px ${pos.bottom !== undefined ? 3 : 0}px ${pos.left !== undefined ? 3 : 0}px` }} />
          ))}
          <span style={{ position:'absolute', top:128, right:90, display:'inline-flex', alignItems:'center', gap:6, ...TYPE.eyebrow, color:'#fff', background:'rgba(10,15,10,0.7)', padding:'5px 10px', borderRadius:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 10px #ef4444' }} /> REC
          </span>
        </div>
        <div className="td-press-fade" aria-hidden="true" style={{ position:'absolute', inset:0, background:`linear-gradient(90deg, ${TD.ink} 0%, ${TD.ink} 38%, rgba(10,15,10,0.82) 55%, rgba(10,15,10,0.15) 100%)` }} />
        <div style={{ position:'relative', maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:640 }}>
            <nav aria-label="Breadcrumb" style={{ ...TYPE.small, color:TD.sageOnDark, marginBottom:20 }}>
              <Link to="/" style={{ color:TD.sageOnDark, textDecoration:'none' }}>Home</Link> / Environment / Media &amp; Journalists
            </nav>
            <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 20px' }}>
              Illegal Dumping Data for Journalists and Media in Ghana
            </h1>
            <P dark>
              Every illegal dumping report on TrashDrop starts with a resident’s photo. Media accounts get a national,
              read-only view of those reports and their cleanups, filtered the way your story needs, with a CSV download.
            </P>
            <div style={{ marginTop:28 }}><CtaButtons dark /></div>
          </div>
        </div>
      </section>

      <Section>
        <H2>What the data covers</H2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          {DATA.map(([t, d]) => (
            <div key={t} style={{ border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'20px', background:'#fff' }}>
              <h3 style={{ ...TYPE.body, fontWeight:600, color:TD.ink, margin:'0 0 4px' }}>{t}</h3>
              <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white">
        <H2>How Media access works</H2>
        <ol style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:14 }}>
          {STEPS.map(([t, d], i) => (
            <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ ...TYPE.small, fontWeight:700, color:'#fff', background:TD.forest, borderRadius:'50%', width:32, height:32, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
              <span style={{ ...TYPE.body, color:TD.sage }}>
                <strong style={{ color:TD.ink, fontWeight:600 }}>{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <H2>Public figures, no account needed</H2>
        <P>
          The <Link to="/partners/#map" style={linkStyle}>live illegal dumping map</Link> and
          the <Link to="/partners/#impact" style={linkStyle}>environmental impact figures</Link> are open to everyone.
          Read our <Link to="/blog/" style={linkStyle}>blog</Link> for pilots and project news,
          or see how <Link to="/volunteers/" style={linkStyle}>volunteer groups clean up reported sites</Link>.
        </P>
      </Section>

      <Section tone="white">
        <H2>Media access FAQ</H2>
        <FAQAccordion items={FAQ} surface="light" />
        <div style={{ marginTop:28 }}><CtaButtons /></div>
      </Section>
    </PublicPageLayout>
  );
};

export default MediaPage;
