import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

export default function Navbar({ scrolled = false, forceLight = false }) {
  const { isAuthenticated, isAdmin, logout, session } = useAuth();
  const { theme, toggle: toggleTheme, isDark } = useTheme();
  const { lang, toggle: toggleLang, t, isAr } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const dark = isDark && !forceLight;

  const navBg = forceLight
    ? 'var(--surface)'
    : scrolled
      ? (dark ? 'rgba(6,14,9,.95)' : 'rgba(248,250,249,.95)')
      : 'transparent';

  const linkColor = forceLight ? 'var(--text-2)' : (dark || !scrolled ? 'rgba(232,245,236,.85)' : 'var(--text-2)');
  const brandColor = forceLight ? 'var(--accent-dark)' : (dark || !scrolled ? '#fff' : 'var(--accent-dark)');
  const borderColor = forceLight ? 'var(--border)' : (scrolled ? 'var(--border)' : 'transparent');

  async function handleLogout() {
    await logout();
    navigate('/auth');
    setMenuOpen(false);
  }

  const navLinks = [
    { href: '/#crops',    label: t('nav.prices'),   anchor: true },
    { href: '/#projects', label: t('nav.projects'),  anchor: true },
    { href: '/kalaklah',  label: t('nav.kalaklah'),  anchor: false },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: navBg,
      backdropFilter: scrolled || forceLight ? 'blur(14px)' : 'none',
      borderBottom: `1px solid ${borderColor}`,
      transition: 'background .3s, border-color .3s',
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', height: 60,
        direction: isAr ? 'rtl' : 'ltr',
        gap: 16,
      }}>
        {/* Brand */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>🌿</span>
          <span style={{ fontFamily: "'Amiri',serif", fontSize: 18, fontWeight: 700, color: brandColor, transition: 'color .3s' }}>
            {t('brand.name')}
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }} className="nav-desktop">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} style={{
              padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 500, color: linkColor,
              transition: 'all .2s',
            }}
              onMouseEnter={e => { e.target.style.background = 'rgba(44,198,101,.12)'; e.target.style.color = '#2CC665'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = linkColor; }}
            >{l.label}</a>
          ))}
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Lang toggle */}
          <button onClick={toggleLang} style={S.iconBtn(dark || !forceLight && !scrolled)} title="Toggle language">
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{isAr ? 'EN' : 'ع'}</span>
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme} style={S.iconBtn(dark || !forceLight && !scrolled)} title="Toggle theme">
            <span style={{ fontSize: 15 }}>{isDark ? '☀️' : '🌙'}</span>
          </button>

          {/* Auth CTA */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="nav-desktop">
              <Link to={isAdmin ? '/admin' : '/dashboard'} style={{
                padding: '7px 16px', borderRadius: 8, textDecoration: 'none',
                fontSize: 13, fontWeight: 600,
                background: 'rgba(44,198,101,.15)', color: '#2CC665',
                border: '1px solid rgba(44,198,101,.3)',
              }}>
                {isAdmin ? t('nav.admin') : t('nav.dashboard')}
              </Link>
              <button onClick={handleLogout} style={{
                padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, background: 'transparent',
                color: linkColor,
              }}>{t('nav.logout')}</button>
            </div>
          ) : (
            <Link to="/auth" className="nav-desktop" style={{
              padding: '8px 20px', borderRadius: 9, textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg,#1A9A48,#0B3D22)',
              color: '#fff',
              boxShadow: '0 2px 10px rgba(26,154,72,.3)',
            }}>
              {t('nav.login')}
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ ...S.iconBtn(dark || !forceLight && !scrolled), display: 'none' }}
            className="nav-hamburger"
          >
            <span style={{ fontSize: 18 }}>{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: isDark ? '#0D1A12' : '#fff',
          borderTop: `1px solid var(--border)`,
          padding: '12px 0',
          direction: isAr ? 'rtl' : 'ltr',
        }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{
              display: 'block', padding: '12px 24px',
              textDecoration: 'none', fontSize: 15, fontWeight: 500,
              color: isDark ? '#A7C4AF' : '#3A5C4A',
            }}>{l.label}</a>
          ))}
          <div style={{ padding: '12px 24px', borderTop: `1px solid var(--border)`, marginTop: 8, display: 'flex', gap: 10 }}>
            {isAuthenticated ? (
              <>
                <Link to={isAdmin ? '/admin' : '/dashboard'} onClick={() => setMenuOpen(false)} style={{
                  flex: 1, padding: '10px', textAlign: 'center', borderRadius: 9, textDecoration: 'none',
                  background: 'rgba(44,198,101,.12)', color: '#2CC665', fontWeight: 600, fontSize: 14,
                }}>
                  {isAdmin ? t('nav.admin') : t('nav.dashboard')}
                </Link>
                <button onClick={handleLogout} style={{
                  flex: 1, padding: '10px', borderRadius: 9, border: `1px solid var(--border)`,
                  background: 'transparent', cursor: 'pointer', color: isDark ? '#A7C4AF' : '#3A5C4A', fontSize: 14,
                }}>{t('nav.logout')}</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setMenuOpen(false)} style={{
                flex: 1, padding: '12px', textAlign: 'center', borderRadius: 9, textDecoration: 'none',
                background: 'linear-gradient(135deg,#1A9A48,#0B3D22)', color: '#fff',
                fontWeight: 600, fontSize: 14,
              }}>{t('nav.login')}</Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}

const S = {
  iconBtn: (darkBg) => ({
    width: 36, height: 36, borderRadius: 9,
    border: `1px solid ${darkBg ? 'rgba(255,255,255,.12)' : 'rgba(26,154,72,.2)'}`,
    background: darkBg ? 'rgba(255,255,255,.06)' : 'rgba(26,154,72,.06)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: darkBg ? 'rgba(232,245,236,.9)' : '#3A5C4A',
    transition: 'all .2s',
    flexShrink: 0,
  }),
};
