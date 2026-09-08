import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

const CROPS = [
  { name: 'الذرة',        nameEn: 'Sorghum',    price: '8,500',   unit: 'جنيه/قنطار', unitEn: 'SDG/Quintal', icon: '🌽', change: '+3.2%', up: true },
  { name: 'السمسم',       nameEn: 'Sesame',     price: '42,000',  unit: 'جنيه/قنطار', unitEn: 'SDG/Quintal', icon: '🌱', change: '+1.8%', up: true },
  { name: 'الكركدي',      nameEn: 'Hibiscus',   price: '28,000',  unit: 'جنيه/قنطار', unitEn: 'SDG/Quintal', icon: '🌺', change: '-0.5%', up: false },
  { name: 'الفول السوداني',nameEn: 'Groundnut', price: '15,200',  unit: 'جنيه/قنطار', unitEn: 'SDG/Quintal', icon: '🥜', change: '+2.1%', up: true },
  { name: 'القطن',        nameEn: 'Cotton',     price: '180,000', unit: 'جنيه/بالة',  unitEn: 'SDG/Bale',    icon: '🪴', change: '+0.9%', up: true },
  { name: 'الدخن',        nameEn: 'Millet',     price: '7,200',   unit: 'جنيه/قنطار', unitEn: 'SDG/Quintal', icon: '🌾', change: '-1.2%', up: false },
];

const PROJECTS_AR = [
  { title: 'مشروع تشجير النيل الأزرق', desc: 'زراعة 50,000 شجرة على ضفاف النيل الأزرق لمكافحة التصحر', icon: '🌳', progress: 68 },
  { title: 'مزارع الطاقة الشمسية الزراعية', desc: 'توليد الطاقة النظيفة لري المزارع في المناطق الجافة', icon: '☀️', progress: 45 },
  { title: 'بنوك البذور الوطنية', desc: 'حفظ وتوزيع البذور المحلية للحفاظ على التنوع البيولوجي', icon: '🌿', progress: 82 },
];
const PROJECTS_EN = [
  { title: 'Blue Nile Afforestation', desc: 'Planting 50,000 trees along the Blue Nile banks to combat desertification', icon: '🌳', progress: 68 },
  { title: 'Solar-Powered Farms', desc: 'Generating clean energy to irrigate farms in arid regions', icon: '☀️', progress: 45 },
  { title: 'National Seed Banks', desc: 'Preserving and distributing local seeds to maintain biodiversity', icon: '🌿', progress: 82 },
];

const STATS_AR = [['2,300+','شجرة مزروعة'],['450+','مزارع مسجل'],['15','ولاية'],['8','مشروع نشط']];
const STATS_EN = [['2,300+','Trees Planted'],['450+','Registered Farms'],['15','States'],['8','Active Projects']];

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
  const { isDark } = useTheme();
  const { t, isAr } = useLang();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const PROJECTS = isAr ? PROJECTS_AR : PROJECTS_EN;
  const STATS    = isAr ? STATS_AR    : STATS_EN;

  // Always dark-themed hero regardless of theme, but later sections respect theme
  return (
    <div style={{ background: isDark ? '#060E09' : '#F8FAF9', color: isDark ? '#E8F5EC' : '#0E1C12', fontFamily: "'IBM Plex Sans Arabic',Tahoma,sans-serif", direction: isAr ? 'rtl' : 'ltr', minHeight: '100vh' }}>

      {/* Grain overlay (hero only) */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")', pointerEvents: 'none', zIndex: 1 }} />

      {/* Shared Navbar */}
      <Navbar scrolled={scrolled} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', paddingTop: 80,
        background: 'linear-gradient(180deg,#060E09 0%,#0B3D22 100%)',
        color: '#E8F5EC',
      }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(44,198,101,.2) 0%,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'glow 4s ease-in-out infinite', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(44,198,101,.1)', border: '1px solid rgba(44,198,101,.3)', color: '#2CC665', padding: '6px 16px', borderRadius: 50, fontSize: 13, marginBottom: 24 }}>
            🌍 {t('hero.badge')}
          </div>

          <h1 style={{ fontFamily: "'Amiri',serif", fontSize: 'clamp(44px,8vw,80px)', lineHeight: 1.1, marginBottom: 20, textWrap: 'balance' }}>
            <span style={{ color: '#2CC665' }}>{t('hero.h1a')}</span> {t('hero.h1b')}
          </h1>

          <p style={{ fontSize: 'clamp(14px,2.5vw,18px)', color: 'rgba(232,245,233,.75)', lineHeight: 1.75, marginBottom: 36, maxWidth: 600, margin: '0 auto 36px' }}>
            {t('hero.sub')}
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth" style={{ background: 'linear-gradient(135deg,#2CC665,#1A9A48)', color: '#060E09', padding: '14px 32px', borderRadius: 50, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
              {t('hero.cta1')}
            </Link>
            <a href="#projects" style={{ border: '1px solid rgba(44,198,101,.4)', color: '#2CC665', padding: '14px 32px', borderRadius: 50, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
              {t('hero.cta2')}
            </a>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2CC665', animation: 'scrollAnim 1.5s ease-in-out infinite' }} />
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0, background: isDark ? '#0D1F12' : '#E8F5E9', borderTop: '1px solid rgba(44,198,101,.12)', borderBottom: '1px solid rgba(44,198,101,.12)' }}>
        {STATS.map(([v, l]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(16px,3vw,24px) clamp(20px,5vw,40px)', borderInlineEnd: '1px solid rgba(44,198,101,.1)' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#2CC665' }}>{v}</span>
            <span style={{ fontSize: 13, color: '#587A68', marginTop: 4 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* ── Crops ─────────────────────────────────────────────── */}
      <section id="crops" style={{ padding: 'clamp(48px,8vw,80px) 24px', background: isDark ? '#060E09' : '#F8FAF9' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 'clamp(28px,5vw,40px)', marginBottom: 12, color: isDark ? '#E8F5E9' : '#0B3D22' }}>
                {isAr ? 'أسعار المحاصيل' : 'Crop Prices'}
              </h2>
              <p style={{ fontSize: 15, color: '#587A68' }}>
                {isAr ? 'أسعار محدّثة يومياً من الأسواق السودانية الرئيسية' : 'Daily updated prices from major Sudanese markets'}
              </p>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
            {CROPS.map((c, i) => (
              <FadeIn key={c.name} delay={i * 0.06}>
                <div style={{
                  background: isDark ? '#0D1F12' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(44,198,101,.12)' : 'rgba(26,154,72,.12)'}`,
                  borderRadius: 16, padding: '24px 16px', textAlign: 'center',
                  transition: 'transform .2s,box-shadow .2s',
                  boxShadow: isDark ? 'none' : '0 2px 12px rgba(11,61,34,.06)',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: isDark ? '#E8F5EC' : '#0B3D22' }}>
                    {isAr ? c.name : c.nameEn}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#2CC665', marginBottom: 2 }}>{c.price}</div>
                  <div style={{ fontSize: 11, color: '#587A68', marginBottom: 8 }}>
                    {isAr ? c.unit : c.unitEn}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.up ? '#2CC665' : '#DC2626', background: c.up ? 'rgba(44,198,101,.1)' : 'rgba(220,38,38,.1)', padding: '3px 8px', borderRadius: 20 }}>
                    {c.change}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Projects ──────────────────────────────────────────── */}
      <section id="projects" style={{ padding: 'clamp(48px,8vw,80px) 24px', background: isDark ? '#0D1F12' : '#E8F5E9' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 'clamp(28px,5vw,40px)', marginBottom: 12, color: isDark ? '#E8F5E9' : '#0B3D22' }}>
                {isAr ? 'مشاريعنا الزراعية' : 'Our Agricultural Projects'}
              </h2>
              <p style={{ fontSize: 15, color: '#587A68' }}>
                {isAr ? 'مبادرات حقيقية تنمّي الأرض وتحافظ على البيئة' : 'Real initiatives that cultivate the land and protect the environment'}
              </p>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 24 }}>
            {PROJECTS.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.1}>
                <div style={{
                  background: isDark ? 'rgba(44,198,101,.04)' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(44,198,101,.1)' : 'rgba(26,154,72,.12)'}`,
                  borderRadius: 16, padding: 24,
                  boxShadow: isDark ? 'none' : '0 2px 12px rgba(11,61,34,.06)',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>{p.icon}</div>
                  <h3 style={{ fontFamily: "'Amiri',serif", fontSize: 20, marginBottom: 10, color: isDark ? '#E8F5E9' : '#0B3D22' }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: '#587A68', lineHeight: 1.7, marginBottom: 16 }}>{p.desc}</p>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#587A68' }}>
                      <span>{isAr ? 'التقدم' : 'Progress'}</span>
                      <span style={{ color: '#2CC665', fontWeight: 600 }}>{p.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: isDark ? 'rgba(44,198,101,.15)' : 'rgba(26,154,72,.12)', borderRadius: 3 }}>
                      <div style={{ width: `${p.progress}%`, height: '100%', background: 'linear-gradient(90deg,#1A9A48,#2CC665)', borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px,8vw,80px) 24px', textAlign: 'center', background: isDark ? '#060E09' : '#F8FAF9' }}>
        <FadeIn>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🌱</div>
            <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 'clamp(24px,4vw,36px)', marginBottom: 16, color: isDark ? '#E8F5E9' : '#0B3D22' }}>
              {isAr ? 'انضم لمجتمع المزارعين' : 'Join the Farming Community'}
            </h2>
            <p style={{ fontSize: 15, color: '#587A68', marginBottom: 32, lineHeight: 1.7 }}>
              {isAr
                ? 'سجّل الآن واحصل على وصول كامل لأسعار المحاصيل وأدوات إدارة المزارع.'
                : 'Register now for full access to crop prices and farm management tools.'}
            </p>
            <Link to="/auth" style={{ background: 'linear-gradient(135deg,#2CC665,#1A9A48)', color: '#060E09', padding: '14px 32px', borderRadius: 50, textDecoration: 'none', fontWeight: 700, fontSize: 16, display: 'inline-block' }}>
              {isAr ? 'إنشاء حساب مجاناً' : 'Create Free Account'}
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{ background: isDark ? '#030806' : '#0B3D22', padding: '48px 24px 32px', borderTop: `1px solid rgba(44,198,101,.1)` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Amiri',serif", fontSize: 20, color: '#2CC665', marginBottom: 8 }}>🌿 {isAr ? 'السودان الأخضر' : 'Green Sudan'}</div>
          <p style={{ fontSize: 13, color: '#587A68', marginBottom: 16 }}>
            {isAr ? 'منصة التنمية الزراعية المستدامة في السودان' : 'Sustainable Agricultural Development Platform in Sudan'}
          </p>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            {[['/', isAr ? 'الرئيسية' : 'Home'], ['/kalaklah', 'Kalaklah'], ['/auth', isAr ? 'دخول' : 'Login']].map(([h, l]) => (
              <a key={h} href={h} style={{ color: '#587A68', textDecoration: 'none', fontSize: 13 }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(88,122,104,.5)' }}>
            © {new Date().getFullYear()} {isAr ? 'السودان الأخضر. جميع الحقوق محفوظة.' : 'Green Sudan. All rights reserved.'}
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes glow { 0%,100%{opacity:.4} 50%{opacity:.7} }
        @keyframes scrollAnim { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(12px);opacity:0} }
      `}</style>
    </div>
  );
}
