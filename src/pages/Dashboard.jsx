import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmt } from '../api';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'crops', label: 'أسعار المحاصيل' },
  { id: 'projects', label: 'المشاريع' },
  { id: 'profile', label: 'حسابي' },
];

export default function Dashboard() {
  const { session, logout, api } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({ stats: {}, crops: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);

  function toast(text, type = 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('getDashboard');
      if (r.success) setData(r.data || {});
    } catch { toast('تعذر تحميل البيانات'); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={S.shell}>
      {msg && <div className={`alert-toast alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

      {/* Sidebar */}
      <aside style={{ ...S.side, ...(sideOpen ? S.sideOpen : {}) }}>
        <div style={S.sideHead}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <span style={S.sideName}>السودان الأخضر</span>
        </div>
        <div style={S.userCard}>
          <div style={S.avatar}>{(session?.name || 'م').charAt(0)}</div>
          <div>
            <div style={S.userName}>{session?.name || 'مستخدم'}</div>
            <div style={S.userRole}>{session?.roleId || 'user'}</div>
          </div>
        </div>
        <nav style={S.nav}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...S.navBtn, ...(tab === t.id ? S.navActive : {}) }}
              onClick={() => { setTab(t.id); setSideOpen(false); }}>
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn btn-ghost btn-sm" style={{ margin: '0 16px 16px', width: 'calc(100% - 32px)' }} onClick={logout}>
          تسجيل الخروج
        </button>
      </aside>

      {/* Mobile overlay */}
      {sideOpen && <div style={S.overlay} onClick={() => setSideOpen(false)} />}

      {/* Main */}
      <main style={S.main}>
        <header style={S.topbar}>
          <button style={S.menuBtn} onClick={() => setSideOpen(o => !o)}>☰</button>
          <h2 style={S.pageTitle}>{TABS.find(t => t.id === tab)?.label}</h2>
          <button className="btn btn-ghost btn-sm" onClick={load}>تحديث</button>
        </header>

        <div style={S.content}>
          {loading ? <div style={S.center}><div style={S.spin} /></div> : (
            <>
              {tab === 'overview' && <Overview data={data} />}
              {tab === 'crops' && <Crops crops={data.crops || []} api={api} toast={toast} reload={load} />}
              {tab === 'projects' && <Projects projects={data.projects || []} />}
              {tab === 'profile' && <Profile session={session} api={api} toast={toast} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Overview({ data }) {
  const stats = data.stats || {};
  const cards = [
    { label: 'إجمالي المحاصيل', value: fmt(stats.totalCrops || 0), icon: '🌾', color: '#0B3D22' },
    { label: 'المشاريع النشطة', value: fmt(stats.activeProjects || 0), icon: '📋', color: '#1A5E38' },
    { label: 'إجمالي المستخدمين', value: fmt(stats.totalUsers || 0), icon: '👥', color: '#1A9A48' },
    { label: 'آخر تحديث', value: fmtDate(stats.lastUpdate), icon: '🕐', color: '#587A68', small: true },
  ];
  return (
    <div>
      <div style={S.statsGrid}>
        {cards.map(c => (
          <div key={c.label} style={{ ...S.statCard, borderRight: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: c.small ? 13 : 28, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#587A68' }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={S.panel}>
        <h3 style={S.panelTitle}>آخر أسعار المحاصيل</h3>
        <CropsTable rows={(data.crops || []).slice(0, 5)} />
      </div>
    </div>
  );
}

function Crops({ crops, api, toast, reload }) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState({});

  function startEdit(c) {
    setEditing(c.id);
    setEditVal({ price: c.price, unit: c.unit });
  }

  async function saveEdit(c) {
    try {
      const r = await api('updateCropPrice', { id: c.id, price: Number(editVal.price), unit: editVal.unit });
      if (r.success) { toast('تم التحديث', 'success'); reload(); setEditing(null); }
      else toast(r.message || 'فشل التحديث');
    } catch { toast('خطأ في الاتصال'); }
  }

  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>أسعار المحاصيل</h3>
      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th>المحصول</th><th>السعر</th><th>الوحدة</th><th>الفئة</th><th>آخر تحديث</th><th>إجراء</th>
          </tr></thead>
          <tbody>
            {crops.length === 0 ? (
              <tr><td colSpan={6} className="no-data">لا توجد بيانات</td></tr>
            ) : crops.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>
                  {editing === c.id
                    ? <input style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB' }} type="number" value={editVal.price} onChange={e => setEditVal(v => ({ ...v, price: e.target.value }))} />
                    : <span className={c.change > 0 ? 'price-up' : c.change < 0 ? 'price-down' : ''}>{fmt(c.price)}</span>}
                </td>
                <td>{editing === c.id
                  ? <input style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB' }} value={editVal.unit} onChange={e => setEditVal(v => ({ ...v, unit: e.target.value }))} />
                  : c.unit}</td>
                <td><span className="badge badge-green">{c.category}</span></td>
                <td style={{ fontSize: 12, color: '#587A68' }}>{fmtDate(c.updatedAt)}</td>
                <td>
                  {editing === c.id
                    ? <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => saveEdit(c)}>حفظ</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
                      </div>
                    : <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>تعديل</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CropsTable({ rows }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>المحصول</th><th>السعر</th><th>الوحدة</th><th>الفئة</th></tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={4} className="no-data">لا توجد محاصيل</td></tr>
            : rows.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td><span className={c.change > 0 ? 'price-up' : c.change < 0 ? 'price-down' : ''}>{fmt(c.price)}</span></td>
                <td>{c.unit}</td>
                <td><span className="badge badge-green">{c.category}</span></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function Projects({ projects }) {
  const STATUS = { active: { label: 'نشط', cls: 'badge-active' }, pending: { label: 'معلق', cls: 'badge-pending' }, completed: { label: 'مكتمل', cls: 'badge-blue' } };
  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>المشاريع الزراعية</h3>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>المشروع</th><th>الموقع</th><th>الحالة</th><th>التقدم</th><th>تاريخ البداية</th></tr></thead>
          <tbody>
            {projects.length === 0
              ? <tr><td colSpan={5} className="no-data">لا توجد مشاريع</td></tr>
              : projects.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.location}</td>
                  <td><span className={`badge ${STATUS[p.status]?.cls || 'badge-pending'}`}>{STATUS[p.status]?.label || p.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 3 }}>
                        <div style={{ width: `${p.progress || 0}%`, height: '100%', background: '#1A9A48', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#587A68', width: 32 }}>{p.progress || 0}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#587A68' }}>{fmtDate(p.startDate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Profile({ session, api, toast }) {
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  async function changePw(e) {
    e.preventDefault();
    if (pw.newPw !== pw.confirm) return toast('كلمة المرور الجديدة غير متطابقة');
    if (pw.newPw.length < 8) return toast('كلمة المرور قصيرة جداً');
    setLoading(true);
    try {
      const r = await api('changePassword', { currentPassword: pw.current, newPassword: pw.newPw });
      if (r.success) { toast('تم تغيير كلمة المرور', 'success'); setPw({ current: '', newPw: '', confirm: '' }); }
      else toast(r.message || 'فشل التغيير');
    } catch { toast('خطأ في الاتصال'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={S.panel}>
        <h3 style={S.panelTitle}>معلومات الحساب</h3>
        <div style={S.infoRow}><span style={S.infoLabel}>الاسم</span><span>{session?.name}</span></div>
        <div style={S.infoRow}><span style={S.infoLabel}>رقم الهاتف</span><span dir="ltr">{session?.phone}</span></div>
        <div style={S.infoRow}><span style={S.infoLabel}>الدور</span><span className={`badge ${session?.roleId === 'admin' ? 'badge-admin' : 'badge-blue'}`}>{session?.roleId}</span></div>
        <div style={S.infoRow}><span style={S.infoLabel}>الحالة</span><span className="badge badge-active">نشط</span></div>
      </div>
      <div style={S.panel}>
        <h3 style={S.panelTitle}>تغيير كلمة المرور</h3>
        <form onSubmit={changePw}>
          {['current', 'newPw', 'confirm'].map((k, i) => (
            <div className="field" key={k}>
              <label>{['كلمة المرور الحالية', 'كلمة المرور الجديدة', 'تأكيد كلمة المرور'][i]}</label>
              <input type="password" value={pw[k]} onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  shell: { display: 'flex', minHeight: '100vh', background: '#F8FAF9', direction: 'rtl' },
  side: {
    width: 240, background: 'linear-gradient(180deg,#0B3D22,#1A5E38)',
    display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0,
    height: '100vh', zIndex: 200, transition: 'transform .3s',
    '@media(max-width:768px)': { transform: 'translateX(100%)' },
  },
  sideOpen: { transform: 'translateX(0)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 199 },
  sideHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px', color: '#fff', borderBottom: '1px solid rgba(255,255,255,.1)' },
  sideName: { fontFamily: "'Amiri',serif", fontSize: 16, fontWeight: 700 },
  userCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px', margin: '12px 12px', background: 'rgba(255,255,255,.1)', borderRadius: 10 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 700, flexShrink: 0 },
  userName: { color: '#fff', fontWeight: 600, fontSize: 14 },
  userRole: { color: 'rgba(255,255,255,.6)', fontSize: 12 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 12px', flex: 1 },
  navBtn: { padding: '11px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, textAlign: 'right', transition: 'all .2s', marginBottom: 4 },
  navActive: { background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 600 },
  main: { flex: 1, marginRight: 240, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: { background: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 0 rgba(26,154,72,.1)', position: 'sticky', top: 0, zIndex: 100 },
  menuBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#0B3D22', display: 'none' },
  pageTitle: { flex: 1, fontFamily: "'Amiri',serif", fontSize: 20, color: '#0B3D22' },
  content: { padding: '24px', flex: 1 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 14, padding: '20px 16px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' },
  panel: { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 20 },
  panelTitle: { fontFamily: "'Amiri',serif", fontSize: 18, color: '#0B3D22', marginBottom: 16 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spin: { width: 36, height: 36, border: '3px solid rgba(26,154,72,.2)', borderTop: '3px solid #1A9A48', borderRadius: '50%', animation: 'spin .7s linear infinite' },
  infoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F8F3', fontSize: 14 },
  infoLabel: { color: '#587A68', fontSize: 13 },
};
