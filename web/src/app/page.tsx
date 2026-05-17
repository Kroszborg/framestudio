'use client';

import { useState, useEffect, useRef } from 'react';

const APK = 'https://github.com/Kroszborg/framestudio/releases/download/v1.0/framestudio.apk';

// ─── Logo ─────────────────────────────────────────────────────────────────────
function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="5" stroke="white" strokeWidth="1.5" />
      {[4, 9, 14, 19].map(x => (
        <rect key={`t${x}`} x={x} y={4} width={3} height={2.5} rx={0.5} fill="white" opacity={0.55} />
      ))}
      {[4, 9, 14, 19].map(x => (
        <rect key={`b${x}`} x={x} y={25.5} width={3} height={2.5} rx={0.5} fill="white" opacity={0.55} />
      ))}
      <rect x={4} y={9} width={24} height={14} rx={1.5} fill="#1A1A1A" />
      <path d="M13 12.5L20.5 16L13 19.5V12.5Z" fill="white" />
    </svg>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function DownloadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const MODES = ['VIDEO', 'PHOTO', 'AUDIO'] as const;

const CAPABILITIES = [
  {
    mode: 'VIDEO EDITOR',
    items: [
      '3-track timeline with magnetic snapping',
      'GPU color grading — 8 sliders, 24 filters',
      '14 transition types with smoothstep easing',
      '3D parallax camera from still photos',
      'Chroma key, speed ramp, video reverse',
    ],
  },
  {
    mode: 'PHOTO EDITOR',
    items: [
      'GPU shader color grading pipeline',
      'Non-destructive crop with aspect presets',
      'Ken Burns animated pan/zoom effect',
      'Text and sticker overlays with animations',
      'GPU-accurate export with all edits baked in',
    ],
  },
  {
    mode: 'AUDIO STUDIO',
    items: [
      'Per-clip volume, mute, and solo mixer',
      'Voice recording with instant clip creation',
      'Beat sync — tap BPM, snap to grid',
      'Volume keyframe automation envelope',
      'Export to device files, share anywhere',
    ],
  },
];

const FEATURES = [
  { n: '01', title: 'Multi-track Timeline', desc: '3 tracks: primary video, overlay, and audio. Trim, split, drag, reorder.' },
  { n: '02', title: 'GPU Color Grading', desc: '8 manual sliders, 24 filter presets, LUT import support.' },
  { n: '03', title: '3D Parallax Camera', desc: 'Animated depth layers from still photos — Dolly, Pan, Orbit, Drift.' },
  { n: '04', title: '14 Transition Types', desc: 'Fade, Dissolve, Slide, Zoom, Wipe, Glitch, Flash — smoothstep eased.' },
  { n: '05', title: 'Speed Ramp', desc: '0.1× to 4× with 5 curve presets including freeze frame.' },
  { n: '06', title: 'Ken Burns Effect', desc: 'Animated pan/zoom on still images with configurable start/end.' },
  { n: '07', title: 'Audio Mixer', desc: 'Per-clip volume, mute, solo, and keyframe automation envelope.' },
  { n: '08', title: 'Voice Recording', desc: 'Record directly in editor — tap mic, clip saved instantly to timeline.' },
  { n: '09', title: 'Beat Sync', desc: 'Tap to detect BPM, then snap all clips to beat grid in one tap.' },
  { n: '10', title: 'Text Overlays', desc: '16 fonts, 14 entry animations, shadow, outline, background fill.' },
  { n: '11', title: 'Sticker Overlays', desc: 'Import from gallery. Pinch to scale, two-finger rotate.' },
  { n: '12', title: 'Chroma Key', desc: 'Green screen removal with adjustable color key and threshold.' },
  { n: '13', title: 'Video Reverse', desc: 'Play any clip backwards — applied at export, no quality loss.' },
  { n: '14', title: 'Subtitle Import', desc: '.srt and .vtt files auto-converted to timed text overlays.' },
  { n: '15', title: 'Quality Enhancer', desc: 'Unsharp mask and 3D denoise baked into final export.' },
];

const STATS = [
  { value: '4K', label: 'Max Export' },
  { value: '24', label: 'Filter Presets' },
  { value: '3D', label: 'Parallax Camera' },
  { value: '14', label: 'Transitions' },
  { value: '0', label: 'Watermarks' },
];

const STEPS = [
  { n: '01', title: 'Download the APK', desc: 'Tap the download button. The file is approximately 95 MB and contains the full application.' },
  { n: '02', title: 'Enable unknown sources', desc: 'Settings → Apps → Special app access → Install unknown apps → enable for your browser.' },
  { n: '03', title: 'Open and install', desc: 'Find the file in your Downloads or notifications. Tap it and follow the install prompts.' },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  const [modeIdx, setModeIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setModeIdx(m => (m + 1) % 3), 2200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  function copyAdb() {
    navigator.clipboard?.writeText('adb install framestudio.apk').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mono: React.CSSProperties = { fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace' };

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#F0F0F0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>

      {/* ── Global styles ── */}
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: rgba(255,255,255,0.15); }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes modeFade { 0% { opacity: 0; transform: translateY(6px); } 15%,85% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-6px); } }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-2 { animation: fadeUp 0.6s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-3 { animation: fadeUp 0.6s 0.24s cubic-bezier(0.16,1,0.3,1) both; }
        .mode-text { animation: modeFade 2.2s ease-in-out infinite; }
        .cap-card:hover { background: #111 !important; }
        .feat-card:hover { background: #0F0F0F !important; }
        .btn-dl:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-ghost:hover { border-color: #555 !important; color: #fff !important; }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 56, display: 'flex', alignItems: 'center',
        padding: '0 24px',
        borderBottom: `1px solid ${scrolled ? '#1E1E1E' : 'transparent'}`,
        background: scrolled ? 'rgba(10,10,10,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'all 0.2s',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={26} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#F0F0F0' }}>FrameStudio</span>
        </a>
        <div style={{ display: 'flex', gap: 28, marginLeft: 36 }}>
          {[['#capabilities', 'Studio'], ['#features', 'Features'], ['#install', 'Install']].map(([h, l]) => (
            <a key={l} href={h} style={{ ...mono, fontSize: 12, color: '#555', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}
              onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
              onMouseOut={e => (e.currentTarget.style.color = '#555')}>{l}</a>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="https://www.kroszborg.co/" target="_blank" rel="noopener noreferrer"
            style={{ ...mono, fontSize: 12, color: '#444', textDecoration: 'none', letterSpacing: '0.04em' }}
            onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseOut={e => (e.currentTarget.style.color = '#444')}>Portfolio</a>
          <a href="https://x.com/kroszborgg" target="_blank" rel="noopener noreferrer"
            style={{ color: '#444', display: 'flex' }}
            onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseOut={e => (e.currentTarget.style.color = '#444')}><XIcon /></a>
          <a href={APK} download className="btn-dl" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#F0F0F0', color: '#0A0A0A', padding: '7px 14px',
            borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            transition: 'all 0.15s',
          }}><DownloadIcon size={13} /> Download APK</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 140, paddingBottom: 96, paddingLeft: 24, paddingRight: 24, maxWidth: 1100, margin: '0 auto' }}>
        {/* Mode badge */}
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {MODES.map((_, i) => (
              <div key={i} onClick={() => { setModeIdx(i); if (intervalRef.current) clearInterval(intervalRef.current); }}
                style={{
                  width: i === modeIdx ? 20 : 6, height: 6, borderRadius: 3,
                  background: i === modeIdx ? '#F0F0F0' : '#2A2A2A',
                  transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                  cursor: 'pointer',
                }} />
            ))}
          </div>
          <span style={{ ...mono, fontSize: 11, color: '#444', letterSpacing: '0.08em' }}>
            {MODES[modeIdx]} STUDIO
          </span>
        </div>

        {/* Headline */}
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 82px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.02, margin: 0, color: '#F0F0F0' }}>
            The complete
          </h1>
          <div style={{ position: 'relative', height: 'clamp(48px, 8.4vw, 98px)', overflow: 'hidden', marginBottom: 4 }}>
            {MODES.map((m, i) => (
              <h1 key={m} className={i === modeIdx ? 'mode-text' : ''} style={{
                position: 'absolute', top: 0, left: 0,
                fontSize: 'clamp(40px, 7vw, 82px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.02, margin: 0,
                color: i === modeIdx ? '#F0F0F0' : 'transparent',
                opacity: i === modeIdx ? 1 : 0,
                pointerEvents: 'none',
              }}>{m.charAt(0) + m.slice(1).toLowerCase()} studio</h1>
            ))}
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 82px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.02, margin: 0, color: '#333' }}>
            for Android.
          </h1>
        </div>

        <p className="fade-up-2" style={{ fontSize: 18, lineHeight: 1.65, color: '#666', maxWidth: 520, margin: '0 0 36px' }}>
          Edit video, retouch photos, and mix audio — all in one free app. No watermarks. No subscription. No account required.
        </p>

        <div className="fade-up-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 72 }}>
          <a href={APK} download className="btn-dl" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#F0F0F0', color: '#0A0A0A', padding: '13px 24px',
            borderRadius: 8, fontSize: 15, fontWeight: 800, textDecoration: 'none',
            transition: 'all 0.15s',
          }}>
            <DownloadIcon size={15} /> Download APK — Free
          </a>
          <a href="#install" className="btn-ghost" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: '1px solid #222', color: '#888', padding: '13px 22px',
            borderRadius: 8, fontSize: 15, fontWeight: 500, textDecoration: 'none',
            transition: 'all 0.15s',
          }}>
            How to install <ArrowRight />
          </a>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #1A1A1A', paddingTop: 32, flexWrap: 'wrap' as const }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              paddingRight: 32, marginRight: i < STATS.length - 1 ? 32 : 0,
              borderRight: i < STATS.length - 1 ? '1px solid #1A1A1A' : 'none',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#F0F0F0', lineHeight: 1 }}>{s.value}</div>
              <div style={{ ...mono, fontSize: 10, color: '#444', marginTop: 5, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three-mode capabilities ── */}
      <section id="capabilities" style={{ borderTop: '1px solid #141414', padding: '72px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 11, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>WHAT IT DOES</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#F0F0F0' }}>
            One app. Three studios.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1, background: '#141414', border: '1px solid #141414', borderRadius: 10, overflow: 'hidden' }}>
          {CAPABILITIES.map(cap => (
            <div key={cap.mode} className="cap-card" style={{
              background: '#0A0A0A', padding: '32px 28px',
              transition: 'background 0.15s',
            }}>
              <div style={{ ...mono, fontSize: 10, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 20 }}>{cap.mode}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                {cap.items.map(item => (
                  <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 1, height: 14, background: '#333', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section id="features" style={{ borderTop: '1px solid #141414', padding: '72px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 11, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>16 FEATURES</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#F0F0F0' }}>
            Built for creators who mean it.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 1, background: '#141414', border: '1px solid #141414', borderRadius: 10, overflow: 'hidden' }}>
          {FEATURES.map(f => (
            <div key={f.n} className="feat-card" style={{
              background: '#0A0A0A', padding: '22px 20px',
              transition: 'background 0.15s',
            }}>
              <div style={{ ...mono, fontSize: 11, color: '#2A2A2A', letterSpacing: '0.05em', marginBottom: 9 }}>{f.n}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0', letterSpacing: '-0.01em', marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Install ── */}
      <section id="install" style={{ borderTop: '1px solid #141414', padding: '72px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ ...mono, fontSize: 11, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>SIDELOAD GUIDE</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px', color: '#F0F0F0' }}>
              Install in three steps.
            </h2>
            <p style={{ fontSize: 14, color: '#555', margin: 0, lineHeight: 1.65 }}>
              No Google Play required. Works on any Android 8.0+ device.
            </p>
          </div>
          <div>
            {STEPS.map((s, i) => (
              <div key={s.n}>
                {i > 0 && <div style={{ height: 1, background: '#141414', margin: '0' }} />}
                <div style={{ display: 'flex', gap: 20, padding: '28px 0' }}>
                  <div style={{ ...mono, fontSize: 12, color: '#2A2A2A', paddingTop: 2, minWidth: 20 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0', letterSpacing: '-0.01em', marginBottom: 7 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{s.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ADB block */}
          <div style={{ marginTop: 36, border: '1px solid #1A1A1A', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid #141414', background: '#0D0D0D' }}>
              <span style={{ ...mono, fontSize: 10, color: '#333', letterSpacing: '0.08em' }}>ADB — DEVELOPER INSTALL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: '#080808' }}>
              <code style={{ ...mono, fontSize: 13, color: '#666' }}>adb install framestudio.apk</code>
              <button onClick={copyAdb} style={{
                ...mono, fontSize: 11, fontWeight: 600,
                background: copied ? 'rgba(74,222,128,0.1)' : '#141414',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : '#222'}`,
                color: copied ? '#4ade80' : '#555',
                padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
              }}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: '1px solid #141414', padding: '72px 24px', textAlign: 'center' as const }}>
        <div style={{
          maxWidth: 520, margin: '0 auto',
          border: '1px solid #1A1A1A', borderRadius: 14, padding: '52px 40px',
          background: '#0D0D0D',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <LogoMark size={44} />
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px', color: '#F0F0F0' }}>
            Start creating today.
          </h2>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 28px', lineHeight: 1.7 }}>
            Free forever. No account, no subscription, no watermarks. Edit video, photo, and audio from one app on your phone.
          </p>
          <a href={APK} download className="btn-dl" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#F0F0F0', color: '#0A0A0A', padding: '13px 28px',
            borderRadius: 8, fontSize: 15, fontWeight: 800, textDecoration: 'none',
            transition: 'all 0.15s', marginBottom: 18,
          }}>
            <DownloadIcon size={15} /> Download APK — Free
          </a>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' as const }}>
            {['Android 8.0+', '~95 MB', 'v1.0.0', 'No account'].map(t => (
              <span key={t} style={{ ...mono, fontSize: 11, color: '#333' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid #141414', padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap' as const, gap: 14,
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={18} />
          <span style={{ ...mono, fontSize: 11, color: '#333' }}>FrameStudio &copy; {new Date().getFullYear()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const }}>
          {[['#capabilities', 'Studio'], ['#features', 'Features'], ['#install', 'Install'], [APK, 'Download']].map(([h, l]) => (
            <a key={l} href={h} download={l === 'Download' ? true : undefined}
              style={{ ...mono, fontSize: 11, color: '#333', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
              onMouseOut={e => (e.currentTarget.style.color = '#333')}>{l}</a>
          ))}
          <span style={{ color: '#1E1E1E' }}>|</span>
          <a href="https://www.kroszborg.co/" target="_blank" rel="noopener noreferrer"
            style={{ ...mono, fontSize: 11, color: '#333', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseOut={e => (e.currentTarget.style.color = '#333')}>Built by kroszborg</a>
          <a href="https://x.com/kroszborgg" target="_blank" rel="noopener noreferrer"
            style={{ color: '#333', display: 'flex' }}
            onMouseOver={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseOut={e => (e.currentTarget.style.color = '#333')}><XIcon size={12} /></a>
        </div>
      </footer>
    </div>
  );
}
