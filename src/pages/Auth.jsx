import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../api';

const COUNTRIES = [
  { code: '249', name: 'السودان', flag: '🇸🇩' },
  { code: '966', name: 'السعودية', flag: '🇸🇦' },
  { code: '971', name: 'الإمارات', flag: '🇦🇪' },
  { code: '974', name: 'قطر', flag: '🇶🇦' },
  { code: '965', name: 'الكويت', flag: '🇰🇼' },
  { code: '968', name: 'عُمان', flag: '🇴🇲' },
  { code: '20', name: 'مصر', flag: '🇪🇬' },
  { code: '1', name: 'أمريكا', flag: '🇺🇸' },
  { code: '44', name: 'بريطانيا', flag: '🇬🇧' },
];

function pwStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH_LABEL = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية جداً'];
const STRENGTH_COLOR = ['', '#DC2626', '#D97706', '#16A34A', '#059669'];

export default function Auth() {
  const { login } = useAuth();
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
      timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timer]);

  function toast(text, type = 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  function otpChange(i, val) {
    const digits = val.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[i] = digits;
    setOtp(next);
    if (digits && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function otpKey(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  function otpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!phone.trim()) return toast('أدخل رقم الهاتف');
    if (!password.trim()) return toast('أدخل كلمة المرور');
    setLoading(true);
    try {
      const r = await login(phone.trim(), password, country);
      if (!r.success) toast(r.message || 'بيانات غير صحيحة');
    } catch {
      toast('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim()) return toast('أدخل الاسم الكامل');
    if (!phone.trim()) return toast('أدخل رقم الهاتف');
    if (pwStrength(password) < 2) return toast('كلمة المرور ضعيفة جداً');
    setLoading(true);
    try {
      const r = await apiCall('register', { name: name.trim(), phone: phone.trim(), password, countryCode: country });
      if (r.success) {
        toast('تم التسجيل! يمكنك الدخول بعد موافقة المشرف.', 'success');
        setMode('login');
      } else {
        toast(r.message || 'فشل التسجيل');
      }
    } catch {
      toast('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp(e) {
    e?.preventDefault();
    if (!phone.trim()) return toast('أدخل رقم الهاتف');
    setLoading(true);
    try {
      const r = await apiCall('sendOtp', { phone: phone.trim(), countryCode: country });
      if (r.success) {
        toast('تم إرسال رمز OTP', 'success');
        setMode('otp');
        setTimer(120);
      } else {
        toast(r.message || 'فشل إرسال الرمز');
      }
    } catch {
      toast('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return toast('أدخل الرمز كاملاً');
    if (!newPw.trim() || pwStrength(newPw) < 2) return toast('كلمة المرور الجديدة ضعيفة');
    setLoading(true);
    try {
      const r = await apiCall('resetPassword', { phone: phone.trim(), countryCode: country, otp: code, newPassword: newPw });
      if (r.success) {
        toast('تم تغيير كلمة المرور بنجاح', 'success');
        setMode('login');
        setOtp(['', '', '', '', '', '']);
        setNewPw('');
      } else {
        toast(r.message || 'رمز OTP غير صحيح');
      }
    } catch {
      toast('خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  const strength = pwStrength(mode === 'otp' ? newPw : password);

  return (
    <div style={S.page}>
      {msg && (
        <div className={`alert-toast alert-${msg.type === 'success' ? 'success' : msg.type === 'warn' ? 'warn' : 'error'}`}>
          {msg.text}
        </div>
      )}

      <div style={S.left}>
        <div style={S.brand}>
          <div style={S.logo}>🌿</div>
          <h1 style={S.brandName}>السودان الأخضر</h1>
          <p style={S.brandSub}>منصة التنمية الزراعية المستدامة</p>
        </div>
        <div style={S.features}>
          {['متابعة أسعار المحاصيل لحظياً', 'إدارة مشاريع زراعية متكاملة', 'تواصل مع مزارعين ومستثمرين', 'دعم مبادرات التشجير الوطنية'].map(f => (
            <div key={f} style={S.feat}>
              <span style={S.featIcon}>✓</span> {f}
            </div>
          ))}
        </div>
      </div>

      <div style={S.right}>
        <div style={S.card}>
          <div style={S.tabs}>
            {['login', 'register'].map(m => (
              <button key={m} style={{ ...S.tab, ...(mode === m || (mode === 'otp' && m === 'login') || (mode === 'forgot' && m === 'login') ? S.tabActive : {}) }}
                onClick={() => setMode(m)}>
                {m === 'login' ? 'دخول' : 'حساب جديد'}
              </button>
            ))}
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <h2 style={S.formTitle}>مرحباً بعودتك</h2>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} />
              <div className="field">
                <label>كلمة المرور</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? 'جاري الدخول...' : 'دخول'}
              </button>
              <button type="button" style={S.forgotBtn} onClick={() => setMode('forgot')}>نسيت كلمة المرور؟</button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <h2 style={S.formTitle}>إنشاء حساب</h2>
              <div className="field">
                <label><span className="req">*</span>الاسم الكامل</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك الكامل" />
              </div>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} />
              <div className="field">
                <label><span className="req">*</span>كلمة المرور</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 أحرف على الأقل" />
                {password && <StrengthBar s={strength} />}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? 'جاري التسجيل...' : 'إنشاء حساب'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={sendOtp}>
              <h2 style={S.formTitle}>استعادة كلمة المرور</h2>
              <p style={S.hint}>أدخل رقم هاتفك وسنرسل لك رمز التحقق</p>
              <PhoneField country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} />
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? 'جاري الإرسال...' : 'إرسال رمز OTP'}
              </button>
              <button type="button" style={S.forgotBtn} onClick={() => setMode('login')}>← العودة للدخول</button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleOtp}>
              <h2 style={S.formTitle}>إدخال رمز OTP</h2>
              <p style={S.hint}>أُرسل رمز مكوّن من 6 أرقام إلى هاتفك</p>
              <div style={S.otpRow} onPaste={otpPaste}>
                {otp.map((d, i) => (
                  <input key={i} ref={el => otpRefs.current[i] = el} style={S.otpBox}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => otpChange(i, e.target.value)}
                    onKeyDown={e => otpKey(i, e)} />
                ))}
              </div>
              {timer > 0 ? (
                <p style={S.timer}>انتهاء الرمز خلال {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</p>
              ) : (
                <button type="button" style={S.forgotBtn} onClick={sendOtp}>إعادة إرسال الرمز</button>
              )}
              <div className="field" style={{ marginTop: 16 }}>
                <label>كلمة المرور الجديدة</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="كلمة مرور جديدة قوية" />
                {newPw && <StrengthBar s={pwStrength(newPw)} />}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneField({ country, setCountry, phone, setPhone }) {
  return (
    <div className="field">
      <label><span className="req">*</span>رقم الهاتف</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 130, flexShrink: 0 }}>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>
          ))}
        </select>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="رقم الهاتف" style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function StrengthBar({ s }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= s ? STRENGTH_COLOR[s] : '#E5E7EB', transition: 'background .3s' }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: STRENGTH_COLOR[s] }}>{STRENGTH_LABEL[s]}</span>
    </div>
  );
}

const S = {
  page: { display: 'flex', minHeight: '100vh', direction: 'rtl' },
  left: {
    flex: 1, background: 'linear-gradient(160deg,#0B3D22,#1A9A48)',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    padding: '60px 48px', color: '#fff',
  },
  brand: { marginBottom: 48 },
  logo: { fontSize: 56, marginBottom: 12 },
  brandName: { fontFamily: "'Amiri',serif", fontSize: 36, marginBottom: 8 },
  brandSub: { fontSize: 16, opacity: 0.8 },
  features: { display: 'flex', flexDirection: 'column', gap: 16 },
  feat: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, opacity: 0.9 },
  featIcon: { background: 'rgba(255,255,255,.2)', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 },
  right: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#F8FAF9' },
  card: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 8px 32px rgba(11,61,34,.1)' },
  tabs: { display: 'flex', background: '#F1F8F3', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 },
  tab: { flex: 1, padding: '9px 0', border: 'none', borderRadius: 7, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#587A68', transition: 'all .2s' },
  tabActive: { background: '#fff', color: '#0B3D22', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  formTitle: { fontFamily: "'Amiri',serif", fontSize: 22, color: '#0B3D22', marginBottom: 20 },
  hint: { fontSize: 13, color: '#587A68', marginBottom: 16 },
  forgotBtn: { background: 'none', border: 'none', color: '#1A9A48', cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 12, width: '100%', textAlign: 'center', fontFamily: 'inherit' },
  otpRow: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 },
  otpBox: { width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700, border: '2px solid #D1D5DB', borderRadius: 10, outline: 'none', transition: 'border .2s', color: '#0B3D22' },
  timer: { textAlign: 'center', fontSize: 13, color: '#587A68', marginBottom: 8 },
};

// Responsive
const mq = window.matchMedia('(max-width:768px)');
if (mq.matches) {
  S.left.display = 'none';
  S.page.minHeight = '100vh';
}
