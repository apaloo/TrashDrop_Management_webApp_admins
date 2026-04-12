import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF } from '../components/PublicPageLayout';

export const BLOG_POSTS = [
  {
    slug:    'how-much-can-a-waste-collector-earn-accra',
    title:   'How Much Can a Waste Collector Earn in Accra?',
    date:    'Week 1',
    readTime:'10 min read',
    keyword: 'Earn money collecting waste Ghana',
    excerpt: 'Waste collection in Ghana is no longer an informal, cash-in-hand job. With TrashDrop, collectors in Accra are earning structured, transparent income — averaging ₵32.43 per pickup — paid directly to their mobile money wallet.',
    tag:     'Collectors',
    tagColor:'#a8e63d',
  },
  {
    slug:    'how-to-report-illegal-dumping-ghana',
    title:   'How to Report Illegal Dumping in Ghana',
    date:    'Week 1',
    readTime:'8 min read',
    keyword: 'Report illegal dumping Ghana',
    excerpt: 'Ghana generates over 12 million tonnes of solid waste annually, and a significant portion ends up at unauthorised dump sites. TrashDrop\'s illegal dumping report tool makes it possible to report in under two minutes and track the cleanup response in real time.',
    tag:     'Environment',
    tagColor:'#f87171',
  },
  {
    slug:    'complete-guide-waste-segregation-ghana',
    title:   'The Complete Guide to Waste Segregation in Ghana',
    date:    'Week 2',
    readTime:'12 min read',
    keyword: 'Waste segregation Ghana / Recycling Ghana',
    excerpt: 'Proper waste segregation reduces landfill pressure, increases recyclables, and on TrashDrop it directly increases your reward points and contributes 60% of recyclable material revenue to your collector\'s earnings.',
    tag:     'Recycling',
    tagColor:'#22c55e',
  },
  {
    slug:    'how-trashdrop-qr-bag-system-works',
    title:   'How the TrashDrop QR Bag System Works',
    date:    'Week 2',
    readTime:'9 min read',
    keyword: 'QR trash bag Ghana',
    excerpt: 'The TrashDrop QR Bag System is a free prepaid waste collection service. Buy official bags, scan to register, fill, and request a free pickup. Here is a complete walkthrough of every step.',
    tag:     'How It Works',
    tagColor:'#3b82f6',
  },
  {
    slug:    'comparing-waste-collection-options-accra-2026',
    title:   'Comparing Waste Collection Options in Accra — 2026',
    date:    'Week 3',
    readTime:'11 min read',
    keyword: 'Waste collection Accra',
    excerpt: 'Municipal collection, private haulage, informal waste pickers, and app-based platforms like TrashDrop — assessed on five criteria: reliability, price transparency, real-time tracking, payment options, and environmental accountability.',
    tag:     'Accra',
    tagColor:'#f5c842',
  },
  {
    slug:    'ghana-waste-management-laws-explained',
    title:   "Ghana's Waste Management Laws Explained",
    date:    'Week 3',
    readTime:'10 min read',
    keyword: 'Waste management law Ghana',
    excerpt: "Ghana has a comprehensive legal framework governing waste management — but most residents are unaware of their obligations or penalties for non-compliance. This guide covers Act 490, Act 917, and Act 851 in plain English.",
    tag:     'Legal',
    tagColor:'#a78bfa',
  },
  {
    slug:    'what-happens-to-waste-after-trashdrop-picks-it-up',
    title:   'What Happens to Waste After TrashDrop Picks It Up?',
    date:    'Week 4',
    readTime:'9 min read',
    keyword: 'Recycling Ghana / Waste disposal Accra',
    excerpt: "When a TrashDrop collector picks up your waste, that's the beginning of a carefully managed chain — from licensed recycling facilities to composting sites to authorised landfills. We trace the full journey.",
    tag:     'Environment',
    tagColor:'#f87171',
  },
  {
    slug:    'trashdrop-expands-kumasi',
    title:   'TrashDrop Expands to Kumasi: What You Need to Know',
    date:    'Week 4',
    readTime:'8 min read',
    keyword: 'Waste collection Kumasi',
    excerpt: "TrashDrop is now live in Kumasi, Ghana's second-largest city. Residents and businesses can now book verified waste collectors, report illegal dumping sites, and join the carter network — all through the same Progressive Web App.",
    tag:     'Expansion',
    tagColor:'#fb923c',
  },
];

const BlogPage = () => {
  useEffect(() => {
    document.title = 'Blog | TrashDrop — Waste Management in Ghana';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'Articles on waste collection, recycling, illegal dumping, and environmental action in Ghana. By TrashDrop — available at trashdrops.com.');
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 72px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.03, backgroundImage:`radial-gradient(${TD.lime} 1px,transparent 1px)`, backgroundSize:'36px 36px', pointerEvents:'none' }} />
        <div style={{ maxWidth:760, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase', display:'block', marginBottom:16 }}>TrashDrop Blog</span>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,60px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 20px' }}>
            Waste. Recycling. Ghana.
          </h1>
          <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.55)', margin:'0 auto', maxWidth:520 }}>
            Practical guides on waste collection, recycling, and environmental action across Ghana — from the TrashDrop team.
          </p>
        </div>
      </section>

      {/* ── Posts Grid ── */}
      <section style={{ background:TD.ink2, padding:'80px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:24 }}>
            {BLOG_POSTS.map((post, i) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} style={{ textDecoration:'none' }}>
                <article style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'32px 28px', height:'100%', transition:'all 0.25s', display:'flex', flexDirection:'column', boxSizing:'border-box' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}30`;e.currentTarget.style.background=`rgba(168,230,61,0.04)`;e.currentTarget.style.transform='translateY(-4px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.transform='translateY(0)';}}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                    <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'1.5px', color:post.tagColor, background:`${post.tagColor}15`, border:`1px solid ${post.tagColor}25`, borderRadius:99, padding:'4px 12px', textTransform:'uppercase' }}>{post.tag}</span>
                    <span style={{ ...FF.label, fontSize:11, color:TD.sage, fontWeight:600 }}>{post.readTime}</span>
                  </div>
                  <h2 style={{ ...FF.display, fontSize:'clamp(18px,2vw,22px)', color:'#f0f5f0', lineHeight:1.3, letterSpacing:'-0.3px', margin:'0 0 14px', flex:1 }}>{post.title}</h2>
                  <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.7, margin:'0 0 24px' }}>{post.excerpt}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ ...FF.label, fontSize:12, color:TD.lime, fontWeight:700 }}>Read article</span>
                    <i className="fas fa-arrow-right" style={{ color:TD.lime, fontSize:11 }}></i>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default BlogPage;
