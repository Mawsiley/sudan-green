import { useState, useEffect } from 'react';
import { apiCall } from '../api';

const T = {
  ar: {
    nav: 'الصفحة الرئيسية',
    heroTitle: 'كلاكلة خضراء',
    heroSub: 'مبادرة تطوعية لتشجير وتجميل حي كلاكلة',
    statsLabel: ['متطوع', 'شجرة مزروعة', 'منطقة خضراء', 'مشروع'],
    aboutTitle: 'عن المبادرة',
    aboutText: 'مبادرة كلاكلة الخضراء هي حركة تطوعية مجتمعية تهدف إلى تحويل حي كلاكلة في الخرطوم إلى بيئة خضراء مستدامة من خلال زراعة الأشجار وتنظيف الأماكن العامة وتوعية السكان بأهمية البيئة.',
    featuresTitle: 'ما نقدمه',
    features: ['زراعة أشجار', 'تنظيف شوارع', 'توعية بيئية', 'مشاريع مجتمعية'],
    phasesTitle: 'مراحل المبادرة',
    phases: [
      { title: 'التخطيط', desc: 'رسم خارطة الحي وتحديد المناطق المستهدفة' },
      { title: 'التطوع', desc: 'تجنيد المتطوعين وتدريبهم على الزراعة' },
      { title: 'التنفيذ', desc: 'زراعة الأشجار وتجميل الأماكن العامة' },
      { title: 'المتابعة', desc: 'الرعاية المستمرة وقياس الأثر البيئي' },
    ],
    volunteerTitle: 'انضم إلينا',
    volunteerBtn: 'تسجيل التطوع',
    nameLabel: 'الاسم الكامل',
    phoneLabel: 'رقم الهاتف',
    skillLabel: 'المهارة',
    skills: ['زراعة', 'تصوير', 'تنظيم', 'توعية', 'نقل', 'أخرى'],
    successMsg: 'شكراً! سنتواصل معك قريباً.',
    lang: 'EN',
  },
  en: {
    nav: 'Home',
    heroTitle: 'Green Kalaklah',
    heroSub: 'A volunteer initiative to green and beautify the Kalaklah neighborhood',
    statsLabel: ['Volunteer', 'Tree Planted', 'Green Area', 'Project'],
    aboutTitle: 'About the Initiative',
    aboutText: 'Green Kalaklah is a community volunteer movement aiming to transform the Kalaklah neighborhood in Khartoum into a sustainable green environment through tree planting, public area cleanup, and environmental awareness.',
    featuresTitle: 'What We Do',
    features: ['Tree Planting', 'Street Cleanup', 'Environmental Awareness', 'Community Projects'],
    phasesTitle: 'Initiative Phases',
    phases: [
      { title: 'Planning', desc: 'Mapping the neighborhood and identifying target areas' },
      { title: 'Volunteering', desc: 'Recruiting and training volunteers on planting' },
      { title: 'Execution', desc: 'Planting trees and beautifying public spaces' },
      { title: 'Follow-up', desc: 'Continuous care and measuring environmental impact' },
    ],
    volunteerTitle: 'Join Us',
    volunteerBtn: 'Register as Volunteer',
    nameLabel: 'Full Name',
    phoneLabel: 'Phone Number',
    skillLabel: 'Skill',
    skills: ['Planting', 'Photography', 'Organizing', 'Awareness', 'Transport', 'Other'],
    successMsg: 'Thank you! We will contact you soon.',
    lang: 'عر',
  },
};

const STATS = [
  { value: '450+', key: 0 },
  { value: '2,300+', key: 1 },
  { value: '12', key: 2 },
  { value: '8', key: 3 },
];

export default function Kalaklah() {
  const [lang, setLang] = useState('ar');
  const [dark, setDark] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', skill: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [apiModal, setApiModal] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('sg_api_url') || '');
  const t = T[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const bg = dark ? '#060E09' : '#F8FAF9';
  const fg = dark ? '#E8F5E9' : '#0E1C12';
  const cardBg = dark ? '#0D1F12' : '#fff';

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setLoading(true);
    try {
      await apiCall('volunteerRegister', form);
      setSent(true);
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div style={{ background: bg, color: fg, minHeight: '100vh', fontFamily: "'IBM Plex Sans Arabic',Tahoma,sans-serif", direction: dir, transition: 'background .3s,color .3s' }}>
      {/* Nav */}
      <nav style={{ ...S.nav, background: dark ? 'rgba(6,14,9,.9)' : 'rgba(255,255,255,.9)' }}>
        <div style={S.navInner}>
          <a href="/" style={{ ...S.logo, color: '#1A9A48' }}>🌿 السودان الأخضر</a>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...S.iconBtn, color: fg }} onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}>{t.lang}</button>
            <button style={{ ...S.iconBtn, color: fg }} onClick={() => setDark(d => !d)}>{dark ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...S.hero, background: 'linear-gradient(160deg,#0B3D22 0%,#1A9A48 60%,#2CC665 100%)' }}>
        <div style={S.leaves}>
          {['🍃', '🌿', '🍃', '🌱', '🍀', '🌿'].map((l, i) => (
            <span key={i} style={{ ...S.leaf, top: `${10 + i * 14}%`, left: `${5 + i * 16}%`, animationDelay: `${i * 0.8}s`, fontSize: `${20 + i * 4}px` }}>{l}</span>
          ))}
        </div>
        <h1 style={S.heroTitle}>{t.heroTitle}</h1>
        <p style={S.heroSub}>{t.heroSub}</p>
        <a href="#volunteer" style={{ ...S.heroCta }}>
          {t.volunteerBtn}
        </a>
      </section>

      {/* Stats */}
      <section style={S.statsSection}>
        <div style={S.statsGrid}>
          {STATS.map((s, i) => (
            <div key={i} style={{ ...S.statCard, background: cardBg }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#1A9A48', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#587A68' }}>{t.statsLabel[s.key]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section style={{ ...S.section, background: dark ? '#0D1F12' : '#F0F9F2' }}>
        <div style={S.container}>
          <h2 style={{ ...S.sectionTitle, color: '#1A9A48' }}>{t.aboutTitle}</h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, maxWidth: 700, margin: '0 auto', color: fg, opacity: 0.85 }}>{t.aboutText}</p>
        </div>
      </section>

      {/* Features */}
      <section style={S.section}>
        <div style={S.container}>
          <h2 style={{ ...S.sectionTitle, color: fg }}>{t.featuresTitle}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
            {t.features.map((f, i) => (
              <div key={i} style={{ ...S.featCard, background: cardBg }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{['🌳', '🧹', '📢', '🤝'][i]}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: fg }}>{f}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phases */}
      <section style={{ ...S.section, background: dark ? '#0D1F12' : '#F0F9F2' }}>
        <div style={S.container}>
          <h2 style={{ ...S.sectionTitle, color: '#1A9A48' }}>{t.phasesTitle}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20 }}>
            {t.phases.map((p, i) => (
              <div key={i} style={{ ...S.phaseCard, background: cardBg }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1A9A48', marginBottom: 8 }}>0{i + 1}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: fg }}>{p.title}</h3>
                <p style={{ fontSize: 13, color: '#587A68', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Volunteer Form */}
      <section id="volunteer" style={S.section}>
        <div style={{ ...S.container, maxWidth: 480 }}>
          <h2 style={{ ...S.sectionTitle, color: fg }}>{t.volunteerTitle}</h2>
          {sent ? (
            <div className="alert-toast alert-success" style={{ position: 'static', transform: 'none', animation: 'none', marginBottom: 0 }}>
              {t.successMsg}
            </div>
          ) : (
            <form onSubmit={submit} style={{ background: cardBg, borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
              <div className="field">
                <label style={{ color: fg }}>{t.nameLabel}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="field">
                <label style={{ color: fg }}>{t.phoneLabel}</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
              <div className="field">
                <label style={{ color: fg }}>{t.skillLabel}</label>
                <select value={form.skill} onChange={e => setForm(f => ({ ...f, skill: e.target.value }))}>
                  <option value="">—</option>
                  {t.skills.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? '...' : t.volunteerBtn}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer style={{ ...S.footer, background: dark ? '#060E09' : '#0B3D22' }}>
        <p>🌿 كلاكلة الخضراء — من أجل سودان أكثر خضرة</p>
      </footer>

      {/* API URL Modal */}
      {apiModal && (
        <div className="modal-overlay show">
          <div className="modal">
            <div className="modal-header">
              <h3>رابط API</h3>
              <button className="modal-close" onClick={() => setApiModal(false)}>×</button>
            </div>
            <div className="field">
              <label>رابط Apps Script</label>
              <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://script.google.com/..." />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { localStorage.setItem('sg_api_url', apiUrl); setApiModal(false); }}>
              حفظ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  nav: { position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(26,154,72,.1)' },
  navInner: { maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontFamily: "'Amiri',serif", fontSize: 20, fontWeight: 700, textDecoration: 'none' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: '6px 12px', borderRadius: 8, transition: 'background .2s' },
  hero: { position: 'relative', overflow: 'hidden', padding: '100px 24px 80px', textAlign: 'center', color: '#fff' },
  heroTitle: { fontFamily: "'Amiri',serif", fontSize: 52, marginBottom: 16, position: 'relative' },
  heroSub: { fontSize: 18, opacity: 0.85, marginBottom: 32, position: 'relative' },
  heroCta: { display: 'inline-flex', alignItems: 'center', padding: '14px 32px', background: '#fff', color: '#0B3D22', borderRadius: 50, fontWeight: 700, fontSize: 15, textDecoration: 'none', transition: 'transform .2s,box-shadow .2s', boxShadow: '0 4px 20px rgba(0,0,0,.2)', position: 'relative' },
  leaves: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  leaf: { position: 'absolute', animation: 'float 4s ease-in-out infinite', opacity: 0.3 },
  statsSection: { padding: '40px 24px' },
  statsGrid: { maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 },
  statCard: { borderRadius: 14, padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.07)', borderBottom: '3px solid #1A9A48' },
  section: { padding: '60px 24px' },
  container: { maxWidth: 1000, margin: '0 auto' },
  sectionTitle: { fontFamily: "'Amiri',serif", fontSize: 32, marginBottom: 32, textAlign: 'center' },
  featCard: { borderRadius: 14, padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.07)' },
  phaseCard: { borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.07)' },
  footer: { padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,.7)', fontSize: 14 },
};
