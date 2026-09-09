import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmt } from '../api';

const TABS = [
  { id: 'users', label: 'المستخدمون' },
  { id: 'roles', label: 'الأدوار' },
  { id: 'audit', label: 'سجل التدقيق' },
  { id: 'settings', label: 'الإعدادات' },
];

export default function Admin() {
  const { session, logout, api, isSettingsAdmin } = useAuth();
  const [tab, setTab] = useState('users');
  const [msg, setMsg] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);

  function toast(text, type = 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div style={S.shell}>
      {msg && <div className={`alert-toast alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

      <aside style={{ ...S.side, ...(sideOpen ? S.sideOpen : {}) }}>
        <div style={S.sideHead}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <span style={S.sideName}>لوحة الإدارة</span>
        </div>
        <div style={S.userCard}>
          <div style={S.avatar}>{(session?.name || 'أ').charAt(0)}</div>
          <div>
            <div style={S.userName}>{session?.name}</div>
            <span className="badge badge-admin" style={{ fontSize: 10 }}>{session?.roleId}</span>
          </div>
        </div>
        <nav style={S.nav}>
          {TABS.filter(t => t.id !== 'settings' || isSettingsAdmin).map(t => (
            <button key={t.id} style={{ ...S.navBtn, ...(tab === t.id ? S.navActive : {}) }}
              onClick={() => { setTab(t.id); setSideOpen(false); }}>
              {t.label}
            </button>
          ))}
          <a href="/dashboard" style={{ ...S.navBtn, display: 'block', textDecoration: 'none', color: 'rgba(255,255,255,.7)' }}>← لوحة المستخدم</a>
        </nav>
        <button className="btn btn-ghost btn-sm" style={{ margin: '0 16px 16px', width: 'calc(100% - 32px)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={logout}>
          تسجيل الخروج
        </button>
      </aside>

      {sideOpen && <div style={S.overlay} onClick={() => setSideOpen(false)} />}

      <main style={S.main}>
        <header style={S.topbar}>
          <button style={S.menuBtn} onClick={() => setSideOpen(o => !o)}>☰</button>
          <h2 style={S.pageTitle}>{TABS.find(t => t.id === tab)?.label}</h2>
        </header>
        <div style={S.content}>
          {tab === 'users' && <UsersTab api={api} toast={toast} />}
          {tab === 'roles' && <RolesTab api={api} toast={toast} />}
          {tab === 'audit' && <AuditTab api={api} />}
          {tab === 'settings' && isSettingsAdmin && <SettingsTab api={api} toast={toast} />}
        </div>
      </main>
    </div>
  );
}

function UsersTab({ api, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('getUsers');
      if (r.success) setUsers(r.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(userId, status) {
    try {
      const r = await api('updateUserStatus', { userId, status });
      if (r.success) { toast('تم التحديث', 'success'); load(); }
      else toast(r.message || 'فشل التحديث');
    } catch { toast('خطأ في الاتصال'); }
  }

  const filtered = filter === 'all' ? users : users.filter(u => u.status === filter);
  const STATUS = { active: { label: 'نشط', cls: 'badge-active' }, pending: { label: 'قيد الانتظار', cls: 'badge-pending' }, suspended: { label: 'موقوف', cls: 'badge-suspended' }, rejected: { label: 'مرفوض', cls: 'badge-rejected' } };

  return (
    <div style={S.panel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ ...S.panelTitle, marginBottom: 0, flex: 1 }}>إدارة المستخدمين ({users.length})</h3>
        <select style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontFamily: 'inherit', fontSize: 13 }}
          value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">الكل</option>
          <option value="pending">قيد الانتظار</option>
          <option value="active">نشط</option>
          <option value="suspended">موقوف</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>تحديث</button>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>الدور</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="no-data">لا يوجد مستخدمون</td></tr>
                : filtered.map(u => (
                  <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td dir="ltr">{u.phone}</td>
                    <td><span className={`badge ${u.roleId === 'admin' ? 'badge-admin' : u.roleId === 'super_admin' ? 'badge-super' : 'badge-blue'}`}>{u.roleId}</span></td>
                    <td><span className={`badge ${STATUS[u.status]?.cls || 'badge-pending'}`}>{STATUS[u.status]?.label || u.status}</span></td>
                    <td style={{ fontSize: 12, color: '#587A68' }}>{fmtDate(u.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.status === 'pending' && <>
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(u.id, 'active')}>موافقة</button>
                          <button className="btn btn-danger btn-sm" onClick={() => updateStatus(u.id, 'rejected')}>رفض</button>
                        </>}
                        {u.status === 'active' && <button className="btn btn-warning btn-sm" onClick={() => updateStatus(u.id, 'suspended')}>إيقاف</button>}
                        {u.status === 'suspended' && <button className="btn btn-success btn-sm" onClick={() => updateStatus(u.id, 'active')}>تفعيل</button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} api={api} toast={toast} reload={load} />}
    </div>
  );
}

function UserModal({ user, onClose, api, toast, reload }) {
  const [role, setRole] = useState(user.roleId);
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    api('getRoles').then(r => { if (r.success) setRoles(r.data || []); });
  }, [api]);

  async function save() {
    try {
      const r = await api('updateUserRole', { userId: user.id, roleId: role });
      if (r.success) { toast('تم تغيير الدور', 'success'); reload(); onClose(); }
      else toast(r.message || 'فشل');
    } catch { toast('خطأ'); }
  }

  return (
    <div className="modal-overlay show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>تفاصيل المستخدم</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[['الاسم', user.name], ['الهاتف', user.phone], ['تاريخ التسجيل', fmtDate(user.createdAt)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F8F3', fontSize: 14 }}>
              <span style={{ color: '#587A68' }}>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
        <div className="field">
          <label>الدور</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            {!roles.length && <option value={user.roleId}>{user.roleId}</option>}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={save}>حفظ</button>
        </div>
      </div>
    </div>
  );
}

function RolesTab({ api, toast }) {
  const [roles, setRoles] = useState([]);
  const load = useCallback(async () => {
    const r = await api('getRoles');
    if (r.success) setRoles(r.data || []);
  }, [api]);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>إدارة الأدوار</h3>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>الدور</th><th>الاسم</th><th>الصلاحيات</th><th>عدد المستخدمين</th></tr></thead>
          <tbody>
            {roles.length === 0 ? <tr><td colSpan={4} className="no-data">لا توجد أدوار</td></tr>
              : roles.map(r => (
                <tr key={r.id}>
                  <td><code style={{ background: '#F1F8F3', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{r.id}</code></td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: 12, color: '#587A68' }}>{(r.permissions || []).join('، ')}</td>
                  <td>{fmt(r.userCount || 0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab({ api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('getAuditLog').then(r => { if (r.success) setLogs(r.data || []); }).finally(() => setLoading(false));
  }, [api]);
  const ACTIONS = { login: 'دخول', logout: 'خروج', register: 'تسجيل', updateStatus: 'تحديث الحالة', updateRole: 'تغيير الدور' };
  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>سجل التدقيق</h3>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>IP</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={5} className="no-data">لا توجد سجلات</td></tr>
                : logs.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: '#587A68', whiteSpace: 'nowrap' }}>{fmtDate(l.timestamp)}</td>
                    <td>{l.userName || l.userId}</td>
                    <td><span className="badge badge-blue">{ACTIONS[l.action] || l.action}</span></td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: '#587A68' }}>{l.ip}</td>
                    <td style={{ fontSize: 12, color: '#587A68', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ api, toast }) {
  const [settings, setSettings] = useState([]);
  const [saving, setSaving] = useState(null);
  const [vals, setVals] = useState({});
  const [secret, setSecret] = useState({ newSecret: '', confirmSecret: '' });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // إعداد النظام — متغيرات Netlify
  const [sysVars, setSysVars] = useState({
    APPS_SCRIPT_URL: '',
    NETLIFY_SITE_ID: '',
    NETLIFY_ACCESS_TOKEN: '',
    NETLIFY_DEPLOY_HOOK: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_ADMIN_PHONE: '',
    ALLOWED_ORIGIN: '',
  });
  const [sysLoading, setSysLoading] = useState(false);
  const [sysResult, setSysResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api('getSettings').then(r => {
      if (r.success) {
        setSettings(r.data || []);
        const v = {};
        (r.data || []).forEach(s => { v[s.key] = s.value; });
        setVals(v);
      }
    });
  }, [api]);

  async function save(key) {
    setSaving(key);
    try {
      const r = await api('updateSetting', { key, value: vals[key] });
      if (r.success) toast('تم الحفظ', 'success');
      else toast(r.message || 'فشل الحفظ');
    } catch { toast('خطأ في الاتصال'); }
    finally { setSaving(null); }
  }

  async function syncSecret(e) {
    e.preventDefault();
    if (!secret.newSecret || secret.newSecret.length < 16)
      return toast('السر يجب أن يكون 16 حرفاً على الأقل');
    if (secret.newSecret !== secret.confirmSecret)
      return toast('السران غير متطابقان');
    if (secret.newSecret === 'CHANGE_ME_STRONG_SECRET')
      return toast('لا تستخدم السر الافتراضي');
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await api('syncApiSecret', secret);
      if (r.success) {
        setSyncResult(r.data);
        toast(r.message, 'success');
        setSecret({ newSecret: '', confirmSecret: '' });
      } else {
        toast(r.message || 'فشل التزامن');
      }
    } catch { toast('خطأ في الاتصال'); }
    finally { setSyncing(false); }
  }

  async function testConnection() {
    const url = sysVars.APPS_SCRIPT_URL.trim();
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await api('testGasConnection', { url: url || undefined });
      setTestResult({ ok: r.success, message: r.message, data: r.data });
      if (r.success) toast(r.message, 'success');
      else toast(r.message || 'فشل الاختبار');
    } catch { toast('خطأ في الاتصال'); }
    finally { setTestLoading(false); }
  }

  async function saveSysVars(e) {
    e.preventDefault();
    const toSend = Object.fromEntries(
      Object.entries(sysVars).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(toSend).length === 0)
      return toast('أدخل متغيراً واحداً على الأقل');
    if (toSend.APPS_SCRIPT_URL && !toSend.APPS_SCRIPT_URL.includes('script.google.com'))
      return toast('رابط Apps Script يجب أن يحتوي على script.google.com');
    setSysLoading(true);
    setSysResult(null);
    try {
      const r = await api('updateNetlifyEnv', { vars: toSend });
      if (r.success) {
        setSysResult({ ok: true, data: r.data, message: r.message });
        toast(r.message, 'success');
        setSysVars(v => Object.fromEntries(Object.keys(v).map(k => [k, ''])));
      } else {
        setSysResult({ ok: false, message: r.message });
        toast(r.message || 'فشل التحديث');
      }
    } catch { toast('خطأ في الاتصال'); }
    finally { setSysLoading(false); }
  }

  const secretStrength = secret.newSecret.length >= 32 ? 'قوي جداً' : secret.newSecret.length >= 24 ? 'جيد' : secret.newSecret.length >= 16 ? 'مقبول' : '';
  const secretColor    = secret.newSecret.length >= 32 ? '#16A34A' : secret.newSecret.length >= 24 ? '#D97706' : '#DC2626';

  return (
    <div style={{ maxWidth: 600 }}>
      {/* ══ إعداد النظام — متغيرات Netlify ══ */}
      <div style={{ ...S.panel, border: '2px solid rgba(26,154,72,.3)', background: '#F0FDF4', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <div>
            <h3 style={{ ...S.panelTitle, color: '#0B3D22', marginBottom: 2 }}>إعداد النظام</h3>
            <p style={{ fontSize: 12, color: '#587A68' }}>
              أدخل المتغيرات التي تريد تحديثها — الحقول الفارغة تُتجاهَل
            </p>
          </div>
        </div>

        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
          💡 أدخل <strong>Site ID</strong> و<strong>Access Token</strong> من Netlify مرة واحدة — بعدها تُحفظ تلقائياً لكل المرات القادمة.
        </div>

        <form onSubmit={saveSysVars}>
          {/* ── رابط Apps Script — مطلوب + زر اختبار ── */}
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#0B3D22', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              رابط Apps Script (exec) <span style={{ color: '#DC2626' }}>*</span>
              <code style={{ fontSize: 10, background: 'rgba(26,154,72,.1)', padding: '1px 6px', borderRadius: 4, color: '#1A9A48' }}>APPS_SCRIPT_URL</code>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="url"
                value={sysVars.APPS_SCRIPT_URL}
                onChange={e => { setSysVars(v => ({ ...v, APPS_SCRIPT_URL: e.target.value })); setTestResult(null); }}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{ flex: 1, background: '#fff', border: `1.5px solid ${testResult ? (testResult.ok ? '#16A34A' : '#DC2626') : 'rgba(26,154,72,.3)'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', direction: 'ltr' }}
              />
              <button type="button" onClick={testConnection} disabled={testLoading}
                style={{ whiteSpace: 'nowrap', padding: '9px 16px', background: testResult?.ok ? '#DCFCE7' : '#F0FDF4', border: `1.5px solid ${testResult?.ok ? '#16A34A' : 'rgba(26,154,72,.4)'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: testResult?.ok ? '#166534' : '#0B3D22' }}>
                {testLoading ? '⏳' : testResult?.ok ? '✅ متصل' : '🔗 اختبار'}
              </button>
            </div>
            {testResult && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: testResult.ok ? '#DCFCE7' : '#FEE2E2', color: testResult.ok ? '#166534' : '#991B1B', border: `1px solid ${testResult.ok ? '#86EFAC' : '#FECACA'}` }}>
                {testResult.message}
                {testResult.ok && testResult.data?.stats && (
                  <span style={{ marginRight: 8, opacity: 0.8 }}>
                    | مستخدمون: {testResult.data.stats.totalUsers ?? '?'} | مشاريع: {testResult.data.stats.totalProjects ?? '?'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── باقي الحقول اختيارية ── */}
          <div style={{ fontSize: 12, color: '#587A68', marginBottom: 10, fontWeight: 600 }}>
            الحقول التالية اختيارية — اتركها فارغة إذا لم تحتجها الآن
          </div>
          {[
            { key: 'NETLIFY_SITE_ID',          label: 'Netlify Site ID',           placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text',     hint: 'من Netlify → Site settings → General → Site ID' },
            { key: 'NETLIFY_ACCESS_TOKEN',     label: 'Netlify Access Token',      placeholder: 'nfp_xxxxxxxxxxxx...', type: 'password', hint: 'من netlify.com/user/applications' },
            { key: 'NETLIFY_DEPLOY_HOOK',      label: 'Netlify Deploy Hook (اختياري)', placeholder: 'https://api.netlify.com/build_hooks/...', type: 'url' },
            { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'واتساب — Phone Number ID', placeholder: '123456789012345', type: 'text' },
            { key: 'WHATSAPP_ACCESS_TOKEN',    label: 'واتساب — Access Token',    placeholder: 'EAAxxxxx...',      type: 'password' },
            { key: 'WHATSAPP_ADMIN_PHONE',     label: 'واتساب — رقم المدير',      placeholder: '+249912345678',    type: 'text' },
            { key: 'ALLOWED_ORIGIN',           label: 'النطاق المسموح (CORS)',    placeholder: 'https://your-site.netlify.app', type: 'url' },
          ].map(({ key, label, placeholder, type, hint }) => (
            <div key={key} className="field" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#3A5C4A', display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                <code style={{ fontSize: 10, background: 'rgba(26,154,72,.08)', padding: '1px 5px', borderRadius: 4, color: '#587A68' }}>{key}</code>
              </label>
              <input
                type={type}
                value={sysVars[key]}
                onChange={e => setSysVars(v => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ background: '#fff', border: '1.5px solid rgba(26,154,72,.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', fontFamily: 'monospace', direction: 'ltr', marginTop: 4 }}
              />
              {hint && <div style={{ fontSize: 11, color: '#587A68', marginTop: 3 }}>💡 {hint}</div>}
            </div>
          ))}

          <button type="submit" className="btn btn-primary" disabled={sysLoading}
            style={{ width: '100%', marginTop: 8 }}>
            {sysLoading ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
          </button>
        </form>

        {sysResult && (
          <div style={{ marginTop: 14, background: sysResult.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${sysResult.ok ? '#86EFAC' : '#FECACA'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            {sysResult.ok ? (
              <>
                <div style={{ color: '#166534', fontWeight: 700, marginBottom: 4 }}>✅ {sysResult.message}</div>
                <div style={{ color: '#166534' }}>
                  المتغيرات المحدَّثة: {sysResult.data?.updatedKeys?.join(' • ') || '—'}
                </div>
                {sysResult.data?.redeploying && (
                  <div style={{ color: '#15803D', marginTop: 4 }}>🔄 الموقع يُعاد بناؤه — انتظر دقيقتين ثم أعد تسجيل الدخول</div>
                )}
              </>
            ) : (
              <div style={{ color: '#991B1B', fontWeight: 600 }}>❌ {sysResult.message}</div>
            )}
          </div>
        )}
      </div>

      {/* ── قسم تزامن السر المشترك ── */}
      <div style={{ ...S.panel, border: '2px solid rgba(220,38,38,.2)', background: '#FFF8F8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🔐</span>
          <div>
            <h3 style={{ ...S.panelTitle, marginBottom: 2, color: '#991B1B' }}>تغيير السر المشترك</h3>
            <p style={{ fontSize: 12, color: '#587A68' }}>يُحدِّث <code style={{ background: '#FEE2E2', padding: '1px 6px', borderRadius: 4 }}>API_SHARED_SECRET</code> في جداول البيانات و<code style={{ background: '#FEE2E2', padding: '1px 6px', borderRadius: 4 }}>APPS_SCRIPT_SHARED_SECRET</code> في Netlify</p>
          </div>
        </div>

        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          ⚠️ بعد تغيير السر يجب تحديث قيمة <strong>APPS_SCRIPT_SHARED_SECRET</strong> يدوياً في متغيرات Netlify.
        </div>

        <form onSubmit={syncSecret}>
          <div className="field">
            <label>السر الجديد <span style={{ fontSize: 11, color: '#587A68' }}>(16 حرفاً على الأقل)</span></label>
            <div style={{ position: 'relative' }}>
              <input type="password" value={secret.newSecret}
                onChange={e => setSecret(s => ({ ...s, newSecret: e.target.value }))}
                placeholder="سر قوي وعشوائي..." />
              {secret.newSecret.length >= 16 && (
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: secretColor }}>
                  {secretStrength}
                </span>
              )}
            </div>
          </div>
          <div className="field">
            <label>تأكيد السر الجديد</label>
            <input type="password" value={secret.confirmSecret}
              onChange={e => setSecret(s => ({ ...s, confirmSecret: e.target.value }))}
              placeholder="أعِد كتابة السر..." />
            {secret.confirmSecret && secret.newSecret !== secret.confirmSecret && (
              <span style={{ fontSize: 12, color: '#DC2626' }}>السران غير متطابقان</span>
            )}
          </div>
          <button type="submit" className="btn btn-danger" disabled={syncing || secret.newSecret !== secret.confirmSecret || secret.newSecret.length < 16}>
            {syncing ? 'جاري التزامن...' : '🔄 تزامن السر'}
          </button>
        </form>

        {/* نتيجة التزامن */}
        {syncResult && (
          <div style={{ marginTop: 16, background: syncResult.netlifyUpdated ? '#DCFCE7' : '#FEF9C3', border: `1px solid ${syncResult.netlifyUpdated ? '#BBF7D0' : '#FEF08A'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            {syncResult.netlifyUpdated ? (
              <>
                <div style={{ color: '#166534', fontWeight: 600, marginBottom: 4 }}>✅ تم تحديث Netlify</div>
                {syncResult.redeploying && <div style={{ color: '#166534' }}>🔄 جارٍ إعادة النشر — انتظر دقيقتين</div>}
              </>
            ) : (
              <>
                <div style={{ color: '#92400E', fontWeight: 600, marginBottom: 8 }}>⚠️ تم تحديث جداول البيانات فقط</div>
                <p style={{ color: '#92400E', marginBottom: 6 }}>انسخ السر التالي وأضفه يدوياً في Netlify → Environment variables:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A', fontSize: 13, wordBreak: 'break-all' }}>
                    {syncResult.newSecret}
                  </code>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(syncResult.newSecret).then(() => toast('تم النسخ', 'success'))}>
                    نسخ
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#92400E', marginTop: 8 }}>
                  المتغير: <code>APPS_SCRIPT_SHARED_SECRET</code> — أضفه ثم انشر من Netlify
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── الإعدادات العامة ── */}
      <div style={S.panel}>
        <h3 style={S.panelTitle}>إعدادات النظام</h3>
        {settings.length === 0 ? <p style={{ color: '#587A68', fontSize: 14 }}>لا توجد إعدادات متاحة</p>
          : settings.map(s => (
            <div key={s.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F1F8F3' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#587A68', marginBottom: 6 }}>{s.key}</label>
              {s.description && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>{s.description}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1, padding: '9px 12px', border: '1.5px solid rgba(26,154,72,.2)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
                  value={vals[s.key] || ''} onChange={e => setVals(v => ({ ...v, [s.key]: e.target.value }))} />
                <button className="btn btn-primary btn-sm" disabled={saving === s.key} onClick={() => save(s.key)}>
                  {saving === s.key ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Spin() {
  return <div style={{ width: 32, height: 32, border: '3px solid rgba(26,154,72,.2)', borderTop: '3px solid #1A9A48', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />;
}

const S = {
  shell: { display: 'flex', minHeight: '100vh', background: '#F8FAF9', direction: 'rtl' },
  side: { width: 240, background: 'linear-gradient(180deg,#060E09,#0B3D22)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0, height: '100vh', zIndex: 200, transition: 'transform .3s' },
  sideOpen: { transform: 'translateX(0)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 199 },
  sideHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px', color: '#fff', borderBottom: '1px solid rgba(255,255,255,.1)' },
  sideName: { fontFamily: "'Amiri',serif", fontSize: 16, fontWeight: 700 },
  userCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, margin: '12px', background: 'rgba(255,255,255,.08)', borderRadius: 10 },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'rgba(44,198,101,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#2CC665', fontWeight: 700, flexShrink: 0 },
  userName: { color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 3 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 12px', flex: 1 },
  navBtn: { padding: '11px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,.65)', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, textAlign: 'right', transition: 'all .2s', marginBottom: 4 },
  navActive: { background: 'rgba(44,198,101,.15)', color: '#2CC665', fontWeight: 600 },
  main: { flex: 1, marginRight: 240, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: { background: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 0 rgba(26,154,72,.1)', position: 'sticky', top: 0, zIndex: 100 },
  menuBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#0B3D22', display: 'none' },
  pageTitle: { flex: 1, fontFamily: "'Amiri',serif", fontSize: 20, color: '#0B3D22' },
  content: { padding: 24, flex: 1 },
  panel: { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 20 },
  panelTitle: { fontFamily: "'Amiri',serif", fontSize: 18, color: '#0B3D22', marginBottom: 16 },
};
