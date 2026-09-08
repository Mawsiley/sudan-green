import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const CROPS = [
  { name: 'الذرة', price: '8,500', unit: 'جنيه/قنطار', icon: '🌽', change: '+3.2%', up: true },
  { name: 'السمسم', price: '42,000', unit: 'جنيه/قنطار', icon: '🌱', change: '+1.8%', up: true },
  { name: 'الكركدي', price: '28,000', unit: 'جنيه/قنطار', icon: '🌺', change: '-0.5%', up: false },
  { name: 'الفول السوداني', price: '15,200', unit: 'جنيه/قنطار', icon: '🥜', change: '+2.1%', up: true },
  { name: 'القطن', price: '180,000', unit: 'جنيه/بالة', icon: '🪴', change: '+0.9%', up: true },
  { name: 'الدخن', price: '7,200', unit: 'جنيه/قنطار', icon: '🌾', change: '-1.2%', up: false },
];

const PROJECTS = [
  { title: 'مشروع تشجير النيل الأزرق', desc: 'زراعة 50,000 شجرة على ضفاف النيل الأزرق لمكافحة التصحر', icon: '🌳', progress: 68 },
  { title: 'مزارع الطاقة الشمسية الزراعية', desc: 'توليد الطاقة النظيفة لري المزارع في المناطق الجافة', icon: '☀️', progress: 45 },
  { title: 'بنوك البذور الوطنية', desc: 'حفظ وتوزيع البذور المحلية للحفاظ على التنوع البيولوجي', icon: '🌿', progress: 82 },
];

function useOnScreen(ref) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return vis;
}

function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null);
  const vis = useOnScreen(ref);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(24px)', transition: `opacity .6s ${delay}s, transform .6s ${delay}s` }}>
      {children}
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{ background: '#060E09', color: '#E8F5E9', fontFamily: "'IBM Plex Sans Arabic',Tahoma,sans-serif", direction: 'rtl' }}>
      {/* Grain overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")', pointerEvents: 'none', zIndex: 1 }} />

      {/* Nav */}
      <nav style={{ ...SH.nav, background: scrolled ? 'rgba(6,14,9,.95)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none' }}>
        <div style={SH.navInner}>
          <div style={SH.brand}>🌿 <span style={{ fontFamily: "'Amiri',serif" }}>السودان الأخضر</span></div>
          <div style={SH.navLinks}>
            <a href="#crops" style={SH.navLink}>الأسعار</a>
            <a href="#projects" style={SH.navLink}>المشاريع</a>
            <a href="/kalaklah" style={SH.navLink}>كلاكلة</a>
            <Link to="/auth" style={SH.navCta}>دخول / تسجيل</Link>
          </div>
          <button style={SH.menuBtn} onClick={() => setMenuOpen(o => !o)}>☰</button>
        </div>
        {menuOpen && (
          <div style={SH.mobileMenu}>
            {['#crops', '#projects', '/kalaklah', '/auth'].map((h, i) => (
              <a key={h} href={h} style={SH.mobileLink} onClick={() => setMenuOpen(false)}>
                {['الأسعار', 'المشاريع', 'كلاكلة', 'دخول'][i]}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section style={SH.hero}>
        <div style={SH.heroGlow} />
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div style={SH.badge}>🌍 منصة التنمية الزراعية</div>
          <h1 style={SH.heroTitle}>
            <span style={{ color: '#2CC665' }}>السودان</span> الأخضر
          </h1>
          <p style={SH.heroSub}>
            منصة متكاملة لمتابعة أسعار المحاصيل وإدارة المشاريع الزراعية ودعم مبادرات التشجير في السودان
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth" style={SH.heroPrimary}>ابدأ الآن</Link>
            <a href="#projects" style={SH.heroSecondary}>تعرف على المشاريع</a>
          </div>
        </div>
        <div style={SH.heroScroll}>
          <div style={SH.scrollDot} />
        </div>
      </section>

      {/* Stats bar */}
      <div style={SH.statsBar}>
        {[['2,300+', 'شجرة مزروعة'], ['450+', 'مزارع مسجل'], ['15', 'ولاية'], ['8', 'مشروع نشط']].map(([v, l]) => (
          <div key={l} style={SH.statItem}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#2CC665' }}>{v}</span>
            <span style={{ fontSize: 13, color: '#587A68', marginTop: 4 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Crops */}
      <section id="crops" style={SH.section}>
        <div style={SH.container}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={SH.sectionTitle}>أسعار المحاصيل</h2>
              <p style={SH.sectionSub}>أسعار محدّثة يومياً من الأسواق السودانية الرئيسية</p>
            </div>
          </FadeIn>
          <div style={SH.cropsGrid}>
            {CROPS.map((c, i) => (
              <FadeIn key={c.name} delay={i * 0.06}>
                <div style={SH.cropCard}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#2CC665', marginBottom: 2 }}>{c.price}</div>
                  <div style={{ fontSize: 11, color: '#587A68', marginBottom: 8 }}>{c.unit}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.up ? '#2CC665' : '#DC2626', background: c.up ? 'rgba(44,198,101,.1)' : 'rgba(220,38,38,.1)', padding: '3px 8px', borderRadius: 20 }}>
                    {c.change}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" style={{ ...SH.section, background: '#0D1F12' }}>
        <div style={SH.container}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={SH.sectionTitle}>مشاريعنا الزراعية</h2>
              <p style={SH.sectionSub}>مبادرات حقيقية تنمّي الأرض وتحافظ على البيئة</p>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 24 }}>
            {PROJECTS.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.1}>
                <div style={SH.projCard}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>{p.icon}</div>
                  <h3 style={{ fontFamily: "'Amiri',serif", fontSize: 20, marginBottom: 10, color: '#E8F5E9' }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: '#587A68', lineHeight: 1.7, marginBottom: 16 }}>{p.desc}</p>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#587A68' }}>
                      <span>التقدم</span><span style={{ color: '#2CC665', fontWeight: 600 }}>{p.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(44,198,101,.15)', borderRadius: 3 }}>
                      <div style={{ width: `${p.progress}%`, height: '100%', background: 'linear-gradient(90deg,#1A9A48,#2CC665)', borderRadius: 3, transition: 'width 1s' }} />
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...SH.section, textAlign: 'center', padding: '80px 24px' }}>
        <FadeIn>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🌱</div>
            <h2 style={{ ...SH.sectionTitle, marginBottom: 16 }}>انضم لمجتمع المزارعين</h2>
            <p style={{ fontSize: 15, color: '#587A68', marginBottom: 32, lineHeight: 1.7 }}>
              سجّل الآن واحصل على وصول كامل لأسعار المحاصيل وأدوات إدارة المزارع ومبادرات التشجير.
            </p>
            <Link to="/auth" style={SH.heroPrimary}>إنشاء حساب مجاناً</Link>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer style={SH.footer}>
        <div style={SH.footerInner}>
          <div style={{ fontFamily: "'Amiri',serif", fontSize: 20, color: '#2CC665', marginBottom: 8 }}>🌿 السودان الأخضر</div>
          <p style={{ fontSize: 13, color: '#587A68', marginBottom: 16 }}>منصة التنمية الزراعية المستدامة في السودان</p>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['/', 'الرئيسية'], ['/kalaklah', 'كلاكلة'], ['/auth', 'دخول']].map(([h, l]) => (
              <a key={h} href={h} style={{ color: '#587A68', textDecoration: 'none', fontSize: 13, transition: 'color .2s' }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#334', marginTop: 24 }}>© {new Date().getFullYear()} السودان الأخضر. جميع الحقوق محفوظة.</p>
        </div>
      </footer>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glow { 0%,100%{opacity:.4} 50%{opacity:.7} }
        @keyframes scrollAnim { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(12px);opacity:0} }
      `}</style>
    </div>
  );
}

const SH = {
  nav: { position: 'fixed', top: 0, width: '100%', zIndex: 100, transition: 'background .3s,backdrop-filter .3s' },
  navInner: { maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center' },
  brand: { fontWeight: 700, fontSize: 18, color: '#2CC665', marginLeft: 'auto' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 24, marginRight: 40 },
  navLink: { color: 'rgba(232,245,233,.7)', textDecoration: 'none', fontSize: 14, transition: 'color .2s' },
  navCta: { background: 'linear-gradient(135deg,#1A9A48,#0B3D22)', color: '#fff', padding: '9px 20px', borderRadius: 50, textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  menuBtn: { display: 'none', background: 'none', border: 'none', color: '#E8F5E9', fontSize: 22, cursor: 'pointer', marginLeft: 0 },
  mobileMenu: { background: 'rgba(13,31,18,.97)', padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  mobileLink: { color: '#E8F5E9', textDecoration: 'none', padding: '10px 0', fontSize: 15, borderBottom: '1px solid rgba(255,255,255,.06)' },
  hero: { position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingTop: 80 },
  heroGlow: { position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(44,198,101,.2) 0%,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'glow 4s ease-in-out infinite', pointerEvents: 'none' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(44,198,101,.1)', border: '1px solid rgba(44,198,101,.3)', color: '#2CC665', padding: '6px 16px', borderRadius: 50, fontSize: 13, marginBottom: 24 },
  heroTitle: { fontFamily: "'Amiri',serif", fontSize: 72, lineHeight: 1.1, marginBottom: 20 },
  heroSub: { fontSize: 18, color: 'rgba(232,245,233,.7)', lineHeight: 1.7, marginBottom: 36, maxWidth: 600 },
  heroPrimary: { background: 'linear-gradient(135deg,#2CC665,#1A9A48)', color: '#060E09', padding: '14px 32px', borderRadius: 50, textDecoration: 'none', fontWeight: 700, fontSize: 16, transition: 'transform .2s' },
  heroSecondary: { border: '1px solid rgba(44,198,101,.4)', color: '#2CC665', padding: '14px 32px', borderRadius: 50, textDecoration: 'none', fontWeight: 600, fontSize: 16, transition: 'border-color .2s' },
  heroScroll: { position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' },
  scrollDot: { width: 6, height: 6, borderRadius: '50%', background: '#2CC665', animation: 'scrollAnim 1.5s ease-in-out infinite' },
  statsBar: { display: 'flex', justifyContent: 'center', gap: 0, background: '#0D1F12', borderTop: '1px solid rgba(44,198,101,.1)', borderBottom: '1px solid rgba(44,198,101,.1)' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 40px', borderLeft: '1px solid rgba(44,198,101,.1)' },
  section: { padding: '80px 24px' },
  container: { maxWidth: 1100, margin: '0 auto' },
  sectionTitle: { fontFamily: "'Amiri',serif", fontSize: 40, marginBottom: 12, color: '#E8F5E9' },
  sectionSub: { fontSize: 15, color: '#587A68' },
  cropsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 },
  cropCard: { background: '#0D1F12', border: '1px solid rgba(44,198,101,.12)', borderRadius: 16, padding: '24px 16px', textAlign: 'center', transition: 'transform .2s,border-color .2s', cursor: 'default' },
  projCard: { background: 'rgba(44,198,101,.04)', border: '1px solid rgba(44,198,101,.1)', borderRadius: 16, padding: 24, transition: 'transform .2s,border-color .2s' },
  footer: { background: '#030806', padding: '48px 24px 32px', borderTop: '1px solid rgba(44,198,101,.1)' },
  footerInner: { textAlign: 'center' },
};
