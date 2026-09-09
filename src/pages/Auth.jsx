import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { apiCall } from '../api';

const COUNTRIES = [
  { code: '249', name: 'السودان', flag: '🇸🇩' },
  { code: '966', name: 'السعودية', flag: '🇸🇦' },
  { code: '971', name: 'الإمارات', flag: '🇦🇪' },
  { code: '974', name: 'قطر', flag: '🇶🇦' },
  { code: '965', name: 'الكويت', flag: '🇰🇼' },
  { code: '968', name: 'عُمان', flag: '🇴🇲' },
  { code: '20',  name: 'مصر',  flag: '🇪🇬' },
  { code: '1',   name: 'USA',  flag: '🇺🇸' },
  { code: '44',  name: 'UK',   flag: '🇬🇧' },
];

function pwStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH_COLOR = ['', '#DC2626', '#D97706', '#16A34A', '#059669'];

export default function Auth() {
  const { login } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { t, isAr, toggle: toggleLang, lang } = useLang();

  const [mode, setMode] = useState('login'); // login | register | otp | forgot
  const [country, setCountry] = useState('249');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(n => n - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timer]);

  function toast(text, type = 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  function otpChange(i, val) {
    const digit = val.replace(/\D/g, '').slice(0, 1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function otpKey(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function otpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) { setOtp(text.split('')); otpRefs.current[5]?.focus(); }
    e.preventDefault();
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!phone.trim()) return toast(t('err.phone'));
    if (!password.trim()) return toast(t('err.password'));
    setLoading(true);
    try {
      const r = await login(phone.trim(), password, country);
      if (!r.success) toast(r.message || t('err.connect'));
    } catch { toast(t('err.connect')); }
    finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim()) return toast(t('err.name'));
    if (!phone.trim()) return toast(t('err.phone'));
    if (pwStrength(password) < 2) return toast(t('err.pw_weak'));
    setLoading(true);
    try {
      const r = await apiCall('register', {
        fullName: name.trim(), phone: phone.trim(),
        password, confirmPassword: password,
        acceptTerms: true, countryCode: country
      });
      if (r.success) {
        toast(r.message || (isAr ? 'تم التسجيل بنجاح' : 'Registered successfully'), 'success');
        setMode('login');
      } else { toast(r.message || (isAr ? 'فشل التسجيل' : 'Registration failed')); }
    } catch { toast(t('err.connect')); }
    finally { setLoading(false); }
  }

  async function sendOtp(e) {
    e?.preventDefault();
    if (!phone.trim()) return toast(t('err.phone'));
    setLoading(true);
    try {
      const r = await apiCall('sendOtp', { phone: phone.trim(), countryCode: country });
      if (r.success) {
        toast(isAr ? 'تم إرسال رمز OTP' : 'OTP sent', 'success');
        setMode('otp'); setTimer(120);
      } else { toast(r.message || (isAr ? 'فشل إرسال الرمز' : 'Failed to send code')); }
    } catch { toast(t('err.connect')); }
    finally { setLoading(false); }
  }

  async function handleOtp(e) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return toast(t('err.otp_full'));
    if (!newPw.trim() || pwStrength(newPw) < 2) return toast(t('err.new_pw'));
    setLoading(true);
    try {
      const r = await apiCall('resetPassword', { phone: phone.trim(), countryCode: country, otp: code, newPassword: newPw });
      if (r.success) {
        toast(isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully', 'success');
        setMode('login'); setOtp(['', '', '', '', '', '']); setNewPw('');
      } else { toast(r.message || (isAr ? 'رمز OTP غير صحيح' : 'Invalid OTP')); }
    } catch { toast(t('err.connect')); }
    finally { setLoading(false); }
  }

  const strength = pwStrength(mode === 'otp' ? newPw : password);
  const STRENGTH_LABEL = ['', t('pw.weak'), t('pw.fair'), t('pw.good'), t('pw.strong')];

  // Dynamic colors based on theme
  const bg        = isDark ? '#060E09' : '#F0F7F2';
  const cardBg    = isDark ? '#0D1A12' : '#fff';
  const cardBdr   = isDark ? 'rgba(44,198,101,.18)' : 'rgba(26,154,72,.15)';
  const tabBg     = isDark ? 'rgba(255,255,255,.05)' : '#F1F8F3';
  const tabActive = isDark ? '#1A2E1E' : '#fff';
  const textMain  = isDark ? '#E8F5EC' : '#0B3D22';
  const textMuted = '#587A68';
  const inputBg   = isDark ? 'rgba(255,255,255,.06)' : '#fff';
  const inputBdr  = isDark ? 'rgba(44,198,101,.25)' : 'rgba(26,154,72,.25)';
  const labelClr  = isDark ? '#A7C4AF' : '#3A5C4A';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', direction: isAr ? 'rtl' : 'ltr', background: bg, position: 'relative' }}>
      {/* Toast */}
      {msg && (
        <div className={`alert-toast alert-${msg.type === 'success' ? 'success' : msg.type === 'warn' ? 'warn' : 'error'}`}>
          {msg.text}
        </div>
      )}

      {/* Top-right controls */}
      <div style={{ position: 'fixed', top: 16, insetInlineEnd: 16, display: 'flex', gap: 8, zIndex: 200 }}>
        <button onClick={toggleLang} style={iconBtn(isDark)} title="Toggle language">
          <span style={{ fontSize: 12, fontWeight: 700 }}>{isAr ? 'EN' : 'ع'}</span>
        </button>
        <button onClick={toggleTheme} style={iconBtn(isDark)} title="Toggle theme">
          <span style={{ fontSize: 15 }}>{isDark ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* Left brand panel */}
      <div style={{
        flex: 1, background: 'linear-gradient(160deg,#0B3D22,#1A9A48)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: 'clamp(32px,6vw,60px) clamp(24px,5vw,48px)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }} className="auth-left">
        {/* Decorative circle */}
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.04)', bottom: -80, insetInlineStart: -80, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.06)', top: -40, insetInlineEnd: -40, pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🌿</div>
          <h1 style={{ fontFamily: "'Amiri',serif", fontSize: 'clamp(24px,3.5vw,36px)', marginBottom: 8 }}>{t('brand.name')}</h1>
          <p style={{ fontSize: 15, opacity: 0.8, marginBottom: 48 }}>{t('brand.tagline')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[t('brand.f1'), t('brand.f2'), t('brand.f3'), t('brand.f4')].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, opacity: 0.9 }}>
                <span style={{ background: 'rgba(255,255,255,.2)', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,4vw,32px)', background: bg }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: cardBg,
          borderRadius: 20,
          padding: 'clamp(24px,4vw,36px) clamp(20px,4vw,32px)',
          boxShadow: isDark ? `0 0 0 1px ${cardBdr}, 0 12px 40px rgba(0,0,0,.5)` : '0 8px 32px rgba(11,61,34,.1)',
          border: `1px solid ${cardBdr}`,
        }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: tabBg, borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
            {['login', 'register'].map(m => (
              <button key={m}
                style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, transition: 'all .2s',
                  background: (mode === m || (mode === 'otp' && m === 'login') || (mode === 'forgot' && m === 'login')) ? tabActive : 'none',
                  color: (mode === m || (mode === 'otp' && m === 'login') || (mode === 'forgot' && m === 'login')) ? textMain : textMuted,
                  fontWeight: (mode === m || (mode === 'otp' && m === 'login') || (mode === 'forgot' && m === 'login')) ? 600 : 500,
                  boxShadow: (mode === m || (mode === 'otp' && m === 'login') || (mode === 'forgot' && m === 'login')) ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                }}
                onClick={() => setMode(m)}>
                {m === 'login' ? t('auth.tab_login') : t('auth.tab_register')}
              </button>
            ))}
          </div>

          {/* Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 22, color: textMain, marginBottom: 20 }}>{t('auth.welcome')}</h2>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} label={t('auth.phone')} inputBg={inputBg} inputBdr={inputBdr} labelClr={labelClr} textMain={textMain} />
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: labelClr }}>{t('auth.password')}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.pw_ph')}
                  style={inputStyle(inputBg, inputBdr, textMain)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? t('auth.loading') : t('auth.submit_login')}
              </button>
              <button type="button" onClick={() => setMode('forgot')} style={forgotStyle(textMuted)}>
                {t('auth.forgot')}
              </button>
            </form>
          )}

          {/* Register */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 22, color: textMain, marginBottom: 20 }}>{t('auth.create')}</h2>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: labelClr }}>
                  <span style={{ color: '#DC2626', marginInlineEnd: 2 }}>*</span>{t('auth.fullname')}
                </label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t('auth.name_ph')}
                  style={inputStyle(inputBg, inputBdr, textMain)} />
              </div>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} label={t('auth.phone')} inputBg={inputBg} inputBdr={inputBdr} labelClr={labelClr} textMain={textMain} />
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: labelClr }}>
                  <span style={{ color: '#DC2626', marginInlineEnd: 2 }}>*</span>{t('auth.password')}
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.pw_hint')}
                  style={inputStyle(inputBg, inputBdr, textMain)} />
                {password && <StrengthBar s={strength} label={STRENGTH_LABEL[strength]} />}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? t('auth.loading_reg') : t('auth.submit_reg')}
              </button>
            </form>
          )}

          {/* Forgot */}
          {mode === 'forgot' && (
            <form onSubmit={sendOtp}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 22, color: textMain, marginBottom: 8 }}>{t('auth.forgot_title')}</h2>
              <p style={{ fontSize: 13, color: textMuted, marginBottom: 16 }}>{t('auth.forgot_hint')}</p>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} label={t('auth.phone')} inputBg={inputBg} inputBdr={inputBdr} labelClr={labelClr} textMain={textMain} />
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? t('auth.loading_otp') : t('auth.send_otp')}
              </button>
              <button type="button" onClick={() => setMode('login')} style={forgotStyle(textMuted)}>
                {t('auth.back_login')}
              </button>
            </form>
          )}

          {/* OTP */}
          {mode === 'otp' && (
            <form onSubmit={handleOtp}>
              <h2 style={{ fontFamily: "'Amiri',serif", fontSize: 22, color: textMain, marginBottom: 8 }}>{t('auth.otp_title')}</h2>
              <p style={{ fontSize: 13, color: textMuted, marginBottom: 16 }}>{t('auth.otp_hint')}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12, direction: 'ltr' }} onPaste={otpPaste}>
                {otp.map((d, i) => (
                  <input key={i} ref={el => otpRefs.current[i] = el}
                    style={{ width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700, border: `2px solid ${inputBdr}`, borderRadius: 10, outline: 'none', background: inputBg, color: textMain, transition: 'border .2s' }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => otpChange(i, e.target.value)}
                    onKeyDown={e => otpKey(i, e)} />
                ))}
              </div>
              {timer > 0
                ? <p style={{ textAlign: 'center', fontSize: 13, color: textMuted, marginBottom: 8 }}>
                    {isAr ? `انتهاء الرمز خلال ${Math.floor(timer/60)}:${String(timer%60).padStart(2,'0')}` : `Code expires in ${Math.floor(timer/60)}:${String(timer%60).padStart(2,'0')}`}
                  </p>
                : <button type="button" onClick={sendOtp} style={forgotStyle(textMuted)}>{t('auth.resend')}</button>
              }
              <div style={{ marginBottom: 16, marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: labelClr }}>{t('auth.new_pw')}</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder={t('auth.new_pw_ph')}
                  style={inputStyle(inputBg, inputBdr, textMain)} />
                {newPw && <StrengthBar s={pwStrength(newPw)} label={STRENGTH_LABEL[pwStrength(newPw)]} />}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? '...' : t('auth.submit_reset')}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .auth-left { display: none !important; } }
      `}</style>
    </div>
  );
}

function PhoneField({ country, setCountry, phone, setPhone, label, inputBg, inputBdr, labelClr, textMain }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: labelClr }}>
        <span style={{ color: '#DC2626', marginInlineEnd: 2 }}>*</span>{label}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={country} onChange={e => setCountry(e.target.value)}
          style={{ ...inputStyle(inputBg, inputBdr, textMain), width: 130, flexShrink: 0 }}>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>)}
        </select>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="0912345678" style={{ ...inputStyle(inputBg, inputBdr, textMain), flex: 1 }} />
      </div>
    </div>
  );
}

function StrengthBar({ s, label }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= s ? STRENGTH_COLOR[s] : 'rgba(128,128,128,.2)', transition: 'background .3s' }} />)}
      </div>
      <span style={{ fontSize: 11, color: STRENGTH_COLOR[s] }}>{label}</span>
    </div>
  );
}

function inputStyle(bg, border, color) {
  return {
    width: '100%', padding: '11px 15px',
    border: `1.5px solid ${border}`,
    borderRadius: 10, fontFamily: 'inherit', fontSize: 14,
    background: bg, color: color, outline: 'none',
    transition: 'border-color .2s',
  };
}

function forgotStyle(color) {
  return {
    background: 'none', border: 'none', color,
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
    marginTop: 12, width: '100%', textAlign: 'center',
    fontFamily: 'inherit',
  };
}

function iconBtn(isDark) {
  return {
    width: 36, height: 36, borderRadius: 9,
    border: `1px solid ${isDark ? 'rgba(44,198,101,.25)' : 'rgba(26,154,72,.2)'}`,
    background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(26,154,72,.07)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: isDark ? '#A7C4AF' : '#3A5C4A',
  };
}
