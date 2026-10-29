import React, { useEffect, useState } from 'react';

// Simplified screens of the household app, drawn in code (recommendation 9 of
// the design review, approved by the owner). Labels are the app's own; names
// and places are examples. No prices: those follow the protected pricing.

const CSS = `
.td-app-stage { position:relative; display:flex; justify-content:center; padding:24px 0; }
.td-app-blob { position:absolute; inset:16% -12px 0 -12px; border-radius:46% 54% 42% 58% / 52% 44% 56% 48%; background:rgba(182,238,105,0.45); }
.td-app-blob.orange { background:rgba(249,139,56,0.28); border-radius:58% 42% 55% 45% / 45% 58% 42% 55%; }
.td-phone { position:relative; width:236px; max-width:100%; aspect-ratio:9 / 19; border-radius:34px; background:#0a0f0a; padding:9px; box-shadow:0 18px 40px rgba(10,15,10,0.18); }
.td-app { height:100%; border-radius:26px; overflow:hidden; background:#fff; color:#0a0f0a; display:flex; flex-direction:column; font-size:13px; line-height:1.35; text-align:left; }
.td-app-bar { display:flex; align-items:center; gap:8px; padding:14px 14px 10px; font-weight:700; font-size:15px; border-bottom:1px solid #dfe4dc; }
.td-app-back { width:22px; height:22px; border-radius:50%; background:#f6f8f4; display:grid; place-items:center; color:#525c52; }
.td-app-body { flex:1; padding:12px 14px; display:flex; flex-direction:column; gap:10px; min-height:0; }
.td-app-btn { margin:0 14px 16px; height:40px; border-radius:999px; background:#1b6e35; color:#fff; font-weight:600; font-size:14px; display:grid; place-items:center; }
.td-app-label { font-size:13px; color:#525c52; }
.td-app-chips { display:flex; flex-wrap:wrap; gap:6px; }
.td-app-chip { font-size:13px; padding:5px 10px; border-radius:999px; border:1px solid #dfe4dc; }
.td-app-chip.on { background:#1b6e35; border-color:#1b6e35; color:#fff; font-weight:600; }
.td-app-bars { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:4px; }
.td-app-bars span { height:4px; border-radius:99px; background:#dfe4dc; }
.td-app-bars span.done { background:#1b6e35; }
.td-app-row { display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #dfe4dc; }
.td-app-row b { font-weight:600; }
.td-app-note { background:#e6f2e9; color:#1b6e35; border-radius:10px; padding:8px 10px; font-weight:500; }
.td-app-finder { position:relative; aspect-ratio:1; border-radius:14px; background:#1c241d; display:grid; place-items:center; }
.td-app-finder svg { width:52%; height:auto; }
.td-app-corner { position:absolute; width:22px; height:22px; border:0 solid #b6ee69; }
.td-app-map { position:relative; flex:1; background:#eef1ea; min-height:0; }
.td-app-map svg { position:absolute; inset:0; width:100%; height:100%; }
.td-app-sheet { background:#fff; border-radius:16px 16px 0 0; margin-top:-16px; position:relative; padding:12px 14px 14px; box-shadow:0 -6px 18px rgba(10,15,10,0.08); display:flex; flex-direction:column; gap:8px; }
.td-app-avatar { width:30px; height:30px; border-radius:50%; background:#1b6e35; color:#fff; display:grid; place-items:center; font-weight:700; }
.td-app-photos { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.td-app-photos div { aspect-ratio:1; border-radius:8px; background:linear-gradient(135deg,#8a7a5c,#5c6b4a); }
.td-app-photos div:nth-child(2) { background:linear-gradient(135deg,#6b5d45,#94866a); }
.td-app-photos div.add { background:#f6f8f4; border:1.5px dashed #dfe4dc; display:grid; place-items:center; color:#525c52; font-size:18px; }
.td-app-step { transition:opacity 0.3s ease; }
/* Text beside a phone; the phone drops below on narrow screens */
.td-with-phone { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:48px; align-items:center; }
@media (max-width:860px) { .td-with-phone { grid-template-columns:minmax(0,1fr); gap:8px; } }
`;

const CORNERS = [
  { top:12, left:12, borderTopWidth:3, borderLeftWidth:3, borderTopLeftRadius:6 },
  { top:12, right:12, borderTopWidth:3, borderRightWidth:3, borderTopRightRadius:6 },
  { bottom:12, left:12, borderBottomWidth:3, borderLeftWidth:3, borderBottomLeftRadius:6 },
  { bottom:12, right:12, borderBottomWidth:3, borderRightWidth:3, borderBottomRightRadius:6 },
];

// A phone on one soft shape. `label` describes the screen for screen readers.
export const PhoneOnShape = ({ tone = 'lime', label, children }) => (
  <div className="td-app-stage">
    <style>{CSS}</style>
    <div className={`td-app-blob${tone === 'orange' ? ' orange' : ''}`} aria-hidden="true" />
    <div className="td-phone" role="img" aria-label={label}>
      <div className="td-app" aria-hidden="true">{children}</div>
    </div>
  </div>
);

const Bar = ({ title }) => (
  <div className="td-app-bar"><span className="td-app-back">‹</span>{title}</div>
);
const Row = ({ label, value }) => (
  <div className="td-app-row"><span className="td-app-label">{label}</span><b>{value}</b></div>
);
const Bars = ({ total, done }) => (
  <div className="td-app-bars">
    {Array.from({ length: total }, (_, i) => <span key={i} className={i < done ? 'done' : ''} />)}
  </div>
);

export const QrScanScreen = () => (
  <PhoneOnShape label="Household app: scanning the QR code on a pack of TrashDrop bags; the batch is activated and 5 bags are added">
    <Bar title="Scan QR code" />
    <div className="td-app-body">
      <div className="td-app-finder">
        {CORNERS.map((c, i) => <span key={i} className="td-app-corner" style={c} />)}
        <svg viewBox="0 0 21 21">
          <rect width="21" height="21" fill="#fff" rx="1" />
          <g fill="#0a0f0a">
            <rect x="1" y="1" width="6" height="6" /><rect x="14" y="1" width="6" height="6" /><rect x="1" y="14" width="6" height="6" />
            <rect x="2" y="2" width="4" height="4" fill="#fff" /><rect x="15" y="2" width="4" height="4" fill="#fff" /><rect x="2" y="15" width="4" height="4" fill="#fff" />
            <rect x="3" y="3" width="2" height="2" /><rect x="16" y="3" width="2" height="2" /><rect x="3" y="16" width="2" height="2" />
            <rect x="9" y="2" width="2" height="2" /><rect x="9" y="6" width="3" height="1" /><rect x="8" y="9" width="2" height="2" />
            <rect x="12" y="9" width="3" height="2" /><rect x="2" y="9" width="3" height="1" /><rect x="16" y="9" width="2" height="3" />
            <rect x="9" y="13" width="2" height="3" /><rect x="13" y="14" width="2" height="2" /><rect x="16" y="15" width="3" height="2" />
            <rect x="12" y="18" width="4" height="2" /><rect x="18" y="18" width="2" height="2" />
          </g>
        </svg>
      </div>
      <div className="td-app-note">✓ Batch activated</div>
      <Row label="Total bags" value="5" />
      <Row label="Status" value="Ready for pickup" />
    </div>
    <div className="td-app-btn">Request pickup</div>
  </PhoneOnShape>
);

export const BookScreen = () => (
  <PhoneOnShape tone="orange" label="Household app: booking a Digital Bin pickup; General waste is selected and the price is shown before confirming">
    <Bar title="New Digital Bin" />
    <div className="td-app-body">
      <Bars total={4} done={3} />
      <span className="td-app-label">Step 3 of 4 · Digital Bin details</span>
      <b>What kind of waste?</b>
      <div className="td-app-chips">
        <span className="td-app-chip on">General waste</span><span className="td-app-chip">Recycling</span><span className="td-app-chip">Organic waste</span>
      </div>
      <Row label="Location" value="East Legon" />
      <Row label="Schedule" value="One-time" />
      <div className="td-app-note">You see the price before you confirm</div>
    </div>
    <div className="td-app-btn">Request Bin Pickup</div>
  </PhoneOnShape>
);

export const TrackScreen = () => (
  <PhoneOnShape label="Household app: following the collector live on the map; collector en route, arriving in 8 minutes">
    <div className="td-app-map">
      <svg viewBox="0 0 218 250" preserveAspectRatio="xMidYMid slice">
        <rect width="218" height="250" fill="#eef1ea" />
        <g stroke="#fff" strokeWidth="10" fill="none"><path d="M-10 70 H230" /><path d="M-10 170 H230" /><path d="M60 -10 V260" /><path d="M160 -10 V260" /></g>
        <rect x="78" y="88" width="64" height="64" rx="6" fill="#dfe8d6" />
        <path d="M60 220 V170 H160 V96" stroke="#1b6e35" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="214" r="9" fill="#1b6e35" stroke="#fff" strokeWidth="3" />
        <path d="M160 64 c-9 0 -15 7 -15 15 c0 11 15 24 15 24 s15 -13 15 -24 c0 -8 -6 -15 -15 -15z" fill="#f98b38" />
        <circle cx="160" cy="79" r="5" fill="#fff" />
      </svg>
    </div>
    <div className="td-app-sheet">
      <span className="td-app-label">Collector En Route</span>
      <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
        <strong style={{ fontSize:22, fontVariantNumeric:'tabular-nums' }}>8 min</strong><span className="td-app-label">· 1.2 km away</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span className="td-app-avatar">KA</span>
        <div><b>Kwame A.</b><br /><span style={{ fontWeight:600, color:'#1b6e35' }}>✓ Verified collector</span></div>
      </div>
      <Bars total={4} done={2} />
      <span className="td-app-label">Accepted · En Route · Arrived · Picked Up</span>
    </div>
  </PhoneOnShape>
);

const ReportForm = () => (
  <>
    <span className="td-app-label">Photos (taken with your camera)</span>
    <div className="td-app-photos"><div /><div /><div className="add">+</div></div>
    <span className="td-app-label">The type of waste</span>
    <div className="td-app-chips"><span className="td-app-chip on">Household waste</span><span className="td-app-chip">Recyclables</span></div>
    <span className="td-app-label">The size of the illegal dumping</span>
    <div className="td-app-chips"><span className="td-app-chip">Small (few bags)</span><span className="td-app-chip on">Medium</span><span className="td-app-chip">Large</span></div>
  </>
);

export const ReportScreen = () => (
  <PhoneOnShape tone="orange" label="Household app: reporting illegal dumping with two photos, household waste, medium size">
    <Bar title="Report dumping" />
    <div className="td-app-body"><ReportForm /></div>
    <div className="td-app-btn">Submit Report</div>
  </PhoneOnShape>
);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const REPORT_STEPS = ['Photos and details', 'Confirm the location', 'Review and submit'];

// The report flow, a step every 2.5 seconds (photos, location, submit). It
// stays on the first step when the device asks for reduced motion.
export const ReportFlowScreen = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const timer = setInterval(() => setStep(s => (s + 1) % REPORT_STEPS.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <PhoneOnShape tone="orange" label="Household app: reporting illegal dumping in three steps: photos and details, confirm the location, review and submit">
      <Bar title="Report dumping" />
      <div className="td-app-body">
        <Bars total={3} done={step + 1} />
        <span className="td-app-label">Step {step + 1} of 3 · {REPORT_STEPS[step]}</span>
        <div className="td-app-step" key={step} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {step === 0 && <ReportForm />}
          {step === 1 && (
            <>
              <div className="td-app-map" style={{ flex:'none', height:150, borderRadius:12, overflow:'hidden' }}>
                <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
                  <rect width="200" height="150" fill="#eef1ea" />
                  <g stroke="#fff" strokeWidth="9" fill="none"><path d="M-10 50 H210" /><path d="M-10 115 H210" /><path d="M70 -10 V160" /></g>
                  <path d="M120 52 c-9 0 -15 7 -15 15 c0 11 15 24 15 24 s15 -13 15 -24 c0 -8 -6 -15 -15 -15z" fill="#f98b38" />
                  <circle cx="120" cy="67" r="5" fill="#fff" />
                </svg>
              </div>
              <div className="td-app-note">✓ Location confirmed</div>
              <Row label="Area" value="Osu, Accra" />
            </>
          )}
          {step === 2 && (
            <>
              <div className="td-app-photos"><div /><div /></div>
              <Row label="Waste" value="Household waste" />
              <Row label="Size" value="Medium" />
              <Row label="Area" value="Osu, Accra" />
            </>
          )}
        </div>
      </div>
      <div className="td-app-btn">{step === 2 ? 'Submit Report' : 'Next'}</div>
    </PhoneOnShape>
  );
};
