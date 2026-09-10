import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmt } from '../api';

// settings_admin يرى فقط الإعدادات
// admin / super_admin يرون كل شيء عدا الإعدادات
const ALL_TABS = [
  { id: 'users',     label: 'المستخدمون',     icon: '👥', adminOnly: false },
  { id: 'broadcast', label: 'إعلانات',        icon: '📢', adminOnly: false },
  { id: 'roles',     label: 'الأدوار',        icon: '🔑', adminOnly: false },
  { id: 'audit',     label: 'سجل التدقيق',   icon: '📝', adminOnly: false },
  { id: 'settings',  label: 'الإعدادات',      icon: '⚙️', settingsOnly: true },
  { id: 'devtools',  label: 'أدوات التطوير',  icon: '🛠️', settingsOnly: true },
];

// حالات المستخدم المعيارية من Apps Script
const STATUS_MAP = {
  ACTIVE:               { label: 'نشط',              cls: 'badge-active'    },
  PENDING_VERIFICATION: { label: 'ينتظر التحقق',      cls: 'badge-pending'   },
  PENDING_APPROVAL:     { label: 'ينتظر الموافقة',    cls: 'badge-pending'   },
  SUSPENDED:            { label: 'موقوف',             cls: 'badge-suspended' },
  REJECTED:             { label: 'مرفوض',             cls: 'badge-rejected'  },
};

export default function Admin() {
  const { session, logout, api, isSettingsAdmin } = useAuth();

  const visibleTabs = ALL_TABS.filter(t => {
    if (t.settingsOnly) return isSettingsAdmin;
    return !isSettingsAdmin;
  });

  const [tab, setTab] = useState(() =>
    isSettingsAdmin ? 'settings' : 'users'
  );
  const [msg, setMsg] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);

  function toast(text, type = 'error') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div style={S.shell}>
      {msg && <div className={`alert-toast alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

      <aside className={`app-sidebar${sideOpen ? ' open' : ''}`} style={S.side}>
        <div style={S.sideHead}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <span style={S.sideName}>لوحة الإدارة</span>
        </div>
        <div style={S.userCard}>
          <div style={S.avatar}>{(session?.fullName || 'أ').charAt(0)}</div>
          <div>
            <div style={S.userName}>{session?.fullName}</div>
            <span className="badge badge-admin" style={{ fontSize: 10 }}>{session?.roleId}</span>
          </div>
        </div>
        <nav style={S.nav}>
          {visibleTabs.map(t => (
            <button key={t.id}
              style={{ ...S.navBtn, ...(tab === t.id ? S.navActive : {}) }}
              onClick={() => { setTab(t.id); setSideOpen(false); }}>
              <span style={{ fontSize: 15, minWidth: 20 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
          <a href="/dashboard"
            style={{ ...S.navBtn, textDecoration: 'none', color: 'rgba(255,255,255,.5)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, minWidth: 20 }}>←</span>لوحة المستخدم
          </a>
        </nav>
        <button className="btn btn-ghost btn-sm" style={{ margin: '0 16px 16px', width: 'calc(100% - 32px)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={logout}>
          تسجيل الخروج
        </button>
      </aside>

      {sideOpen && <div style={S.overlay} onClick={() => setSideOpen(false)} />}

      <main className="app-main" style={S.main}>
        <header style={S.topbar}>
          <button className="app-menu-btn" style={S.menuBtn} onClick={() => setSideOpen(o => !o)}>☰</button>
          <h2 style={S.pageTitle}>{visibleTabs.find(t => t.id === tab)?.label}</h2>
        </header>
        <div style={S.content}>
          {tab === 'users'     && <UsersTab     api={api} toast={toast} />}
          {tab === 'broadcast' && <BroadcastTab api={api} toast={toast} />}
          {tab === 'roles'     && <RolesTab     api={api} toast={toast} />}
          {tab === 'audit'     && <AuditTab     api={api} />}
          {tab === 'settings'  && isSettingsAdmin && <SettingsTab api={api} toast={toast} />}
          {tab === 'devtools'  && isSettingsAdmin && <DevToolsTab api={api} toast={toast} />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  UsersTab
// ═══════════════════════════════════════════════════════════════
function UsersTab({ api, toast }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('getUsers');
      if (r.success) setUsers(r.data?.users || []);
      else toast(r.message || 'فشل تحميل المستخدمين');
    } catch { toast('خطأ في الاتصال'); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function doAction(action, userId) {
    try {
      const r = await api(action, { targetUserId: userId });
      if (r.success) { toast('تم التحديث', 'success'); load(); }
      else toast(r.message || 'فشل التحديث');
    } catch { toast('خطأ في الاتصال'); }
  }

  async function exportUsers() {
    setExporting(true);
    try {
      const r = await api('exportUsers');
      if (r.success && r.data) {
        // تحويل البيانات إلى CSV
        const rows = r.data?.users || users;
        if (!rows.length) { toast('لا يوجد مستخدمون للتصدير'); return; }
        const headers = ['الاسم', 'الهاتف', 'الدور', 'الحالة', 'تاريخ التسجيل'];
        const csv = [
          '﻿' + headers.join(','),
          ...rows.map(u => [u.fullName, u.phone, u.roleId, u.status, u.createdAt].map(v => `"${v || ''}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `users-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast('تم التصدير', 'success');
      } else {
        // تصدير من البيانات المحلية
        if (!users.length) { toast('لا يوجد مستخدمون'); return; }
        const headers = ['الاسم', 'الهاتف', 'الدور', 'الحالة', 'تاريخ التسجيل'];
        const csv = [
          '﻿' + headers.join(','),
          ...users.map(u => [u.fullName, u.phone, u.roleId, u.status, u.createdAt].map(v => `"${v || ''}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `users-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast('تم التصدير', 'success');
      }
    } catch { toast('فشل التصدير'); }
    finally { setExporting(false); }
  }

  const filtered = users.filter(u => {
    const matchStatus = filter === 'all' || u.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || u.fullName?.toLowerCase().includes(q) || u.phone?.includes(q) || u.roleId?.includes(q);
    return matchStatus && matchSearch;
  });

  const pendingCount = users.filter(u => u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_VERIFICATION').length;

  return (
    <div style={S.panel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ ...S.panelTitle, marginBottom: 0 }}>
          إدارة المستخدمين ({users.length})
          {pendingCount > 0 && <span className="notif-dot" title={`${pendingCount} ينتظر الموافقة`} />}
        </h3>
        <input className="search-box" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <select style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontFamily: 'inherit', fontSize: 13 }}
          value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">الكل ({users.length})</option>
          <option value="PENDING_APPROVAL">ينتظر الموافقة ({users.filter(u=>u.status==='PENDING_APPROVAL').length})</option>
          <option value="PENDING_VERIFICATION">ينتظر التحقق ({users.filter(u=>u.status==='PENDING_VERIFICATION').length})</option>
          <option value="ACTIVE">نشط ({users.filter(u=>u.status==='ACTIVE').length})</option>
          <option value="SUSPENDED">موقوف ({users.filter(u=>u.status==='SUSPENDED').length})</option>
          <option value="REJECTED">مرفوض ({users.filter(u=>u.status==='REJECTED').length})</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
        <button className="btn btn-ghost btn-sm" onClick={exportUsers} disabled={exporting} title="تصدير CSV">
          {exporting ? '...' : '⬇ CSV'}
        </button>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th><th>الهاتف</th><th>الدور</th>
                <th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} className="no-data">لا يوجد مستخدمون</td></tr>
                : filtered.map(u => {
                  const st = STATUS_MAP[u.status] || { label: u.status, cls: 'badge-pending' };
                  return (
                    <tr key={u.userId} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                      <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                      <td dir="ltr">{u.phone}</td>
                      <td>
                        <span className={`badge ${u.roleId === 'admin' ? 'badge-admin' : u.roleId === 'super_admin' ? 'badge-super' : 'badge-blue'}`}>
                          {u.roleName || u.roleId}
                        </span>
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ fontSize: 12, color: '#587A68' }}>{fmtDate(u.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_VERIFICATION') && <>
                            <button className="btn btn-success btn-sm" onClick={() => doAction('approveUser', u.userId)}>موافقة</button>
                            <button className="btn btn-danger btn-sm"  onClick={() => doAction('rejectUser',  u.userId)}>رفض</button>
                          </>}
                          {u.status === 'ACTIVE'    && <button className="btn btn-warning btn-sm" onClick={() => doAction('suspendUser',       u.userId)}>إيقاف</button>}
                          {u.status === 'SUSPENDED' && <button className="btn btn-success btn-sm" onClick={() => doAction('activateUserAdmin', u.userId)}>تفعيل</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} api={api} toast={toast} reload={load} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  UserModal
// ═══════════════════════════════════════════════════════════════
function UserModal({ user, onClose, api, toast, reload }) {
  const [roleId, setRoleId] = useState(user.roleId);
  const [roles, setRoles]   = useState([]);

  useEffect(() => {
    api('getRoles').then(r => {
      if (r.success) setRoles(r.data?.roles || []);
    });
  }, [api]);

  async function save() {
    try {
      const r = await api('updateUserRole', { targetUserId: user.userId, roleId });
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
          {[['الاسم', user.fullName], ['الهاتف', user.phone], ['تاريخ التسجيل', fmtDate(user.createdAt)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F8F3', fontSize: 14 }}>
              <span style={{ color: '#587A68' }}>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
        <div className="field">
          <label>الدور</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)}>
            {roles.length > 0
              ? roles.map(r => <option key={r.roleId} value={r.roleId}>{r.roleNameAr || r.roleId}</option>)
              : <option value={user.roleId}>{user.roleName || user.roleId}</option>
            }
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

// ═══════════════════════════════════════════════════════════════
//  BroadcastTab — إعلانات جماعية عبر WhatsApp
// ═══════════════════════════════════════════════════════════════
function BroadcastTab({ api, toast }) {
  const [msg, setMsg]       = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult]  = useState(null);

  async function send(e) {
    e.preventDefault();
    if (!msg.trim()) return toast('أدخل نص الرسالة');
    if (msg.trim().length < 10) return toast('الرسالة قصيرة جداً (10 أحرف على الأقل)');
    setSending(true); setResult(null);
    try {
      const r = await api('broadcast', { message: msg.trim(), targetGroup: target });
      if (r.success) {
        setResult({ ok: true, data: r.data, message: r.message });
        toast(r.message || 'تم الإرسال', 'success');
        setMsg('');
      } else {
        setResult({ ok: false, message: r.message });
        toast(r.message || 'فشل الإرسال');
      }
    } catch { toast('خطأ في الاتصال'); }
    finally { setSending(false); }
  }

  const TARGET_LABELS = {
    all:     'جميع المستخدمين النشطين',
    pending: 'ينتظرون الموافقة',
    new:     'المسجلون حديثاً (آخر 7 أيام)',
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={S.panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>📢</span>
          <div>
            <h3 style={{ ...S.panelTitle, marginBottom: 2 }}>إعلانات جماعية</h3>
            <p style={{ fontSize: 12, color: '#587A68' }}>إرسال رسالة WhatsApp لمجموعة من المستخدمين</p>
          </div>
        </div>

        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          ⚠️ يتم حفظ الإعلانات في سجل Announcements. إرسال WhatsApp يتطلب تفعيله في الإعدادات.
        </div>

        <form onSubmit={send}>
          <div className="field">
            <label>الفئة المستهدفة</label>
            <select value={target} onChange={e => setTarget(e.target.value)}>
              {Object.entries(TARGET_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>نص الرسالة</label>
            <textarea
              value={msg} onChange={e => setMsg(e.target.value)}
              rows={6} placeholder="اكتب رسالتك هنا..."
              style={{ width: '100%', padding: '11px 15px', border: '1.5px solid rgba(26,154,72,.2)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none' }}
            />
            <div style={{ fontSize: 11, color: '#587A68', marginTop: 4, textAlign: 'left' }}>{msg.length} حرف</div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: '100%' }}>
            {sending ? '⏳ جاري الإرسال...' : '📤 إرسال الإعلان'}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 16, background: result.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${result.ok ? '#86EFAC' : '#FECACA'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            {result.ok ? (
              <>
                <div style={{ color: '#166534', fontWeight: 700, marginBottom: 4 }}>✅ {result.message || 'تم حفظ الإعلان بنجاح'}</div>
                <div style={{ color: '#166534' }}>تم تسجيل الإعلان في قاعدة البيانات.</div>
              </>
            ) : (
              <div style={{ color: '#991B1B', fontWeight: 600 }}>❌ {result.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RolesTab
// ═══════════════════════════════════════════════════════════════
function RolesTab({ api, toast }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api('getRoles');
      if (r.success) setRoles(r.data?.roles || []);
      else toast(r.message || 'فشل تحميل الأدوار');
    } catch { toast('خطأ في الاتصال'); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>إدارة الأدوار</h3>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>الكود</th><th>الاسم</th><th>تسجيل عام</th><th>يتطلب موافقة</th></tr>
            </thead>
            <tbody>
              {roles.length === 0
                ? <tr><td colSpan={4} className="no-data">لا توجد أدوار</td></tr>
                : roles.map(r => (
                  <tr key={r.roleId}>
                    <td><code style={{ background: '#F1F8F3', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{r.roleId}</code></td>
                    <td style={{ fontWeight: 600 }}>{r.roleNameAr}</td>
                    <td><span className={`badge ${r.publicRegistration ? 'badge-active' : 'badge-suspended'}`}>{r.publicRegistration ? 'نعم' : 'لا'}</span></td>
                    <td><span className={`badge ${r.requiresApproval ? 'badge-pending' : 'badge-active'}`}>{r.requiresApproval ? 'نعم' : 'لا'}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AuditTab
// ═══════════════════════════════════════════════════════════════
function AuditTab({ api }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('getAuditLog').then(r => {
      if (r.success) setLogs(r.data?.logs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [api]);

  const ACTIONS = {
    LOGIN: 'دخول', LOGOUT: 'خروج',
    REGISTER_PENDING: 'تسجيل جديد',
    ACCOUNT_ACTIVATED: 'تفعيل حساب',
    PENDING_APPROVAL: 'ينتظر موافقة',
    LOGIN_FAILED: 'دخول فاشل',
    APPROVE_USER: 'موافقة على مستخدم',
    REJECT_USER: 'رفض مستخدم',
    SUSPEND_USER: 'إيقاف مستخدم',
    ACTIVATE_USER: 'تفعيل مستخدم',
    UPDATE_ROLE: 'تغيير الدور',
    CHANGE_PASSWORD: 'تغيير كلمة مرور',
    PASSWORD_UPDATED: 'تحديث كلمة مرور',
    SYNC_API_SECRET: 'تزامن السر',
    UPDATE_SETTINGS: 'تحديث الإعدادات',
    BROADCAST: 'إعلان جماعي',
  };

  return (
    <div style={S.panel}>
      <h3 style={S.panelTitle}>سجل التدقيق</h3>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr>
            </thead>
            <tbody>
              {logs.length === 0
                ? <tr><td colSpan={4} className="no-data">لا توجد سجلات</td></tr>
                : logs.map((l, i) => (
                  <tr key={l.logId || i}>
                    <td style={{ fontSize: 12, color: '#587A68', whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</td>
                    <td style={{ fontSize: 12 }}>{l.userId || '—'}</td>
                    <td><span className="badge badge-blue">{ACTIONS[l.action] || l.action}</span></td>
                    <td style={{ fontSize: 12, color: '#587A68', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SettingsTab — للـ settings_admin فقط
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ api, toast }) {
  const [settings, setSettings] = useState([]);
  const [saving, setSaving]     = useState(null);
  const [vals, setVals]         = useState({});
  const [secret, setSecret]     = useState({ newSecret: '', confirmSecret: '' });
  const [syncing, setSyncing]   = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [sysVars, setSysVars] = useState({
    APPS_SCRIPT_URL:          '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN:    '',
    WHATSAPP_ADMIN_PHONE:     '',
    ALLOWED_ORIGIN:           '',
  });
  const [sysLoading, setSysLoading] = useState(false);
  const [sysResult, setSysResult]   = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult]   = useState(null);

  useEffect(() => {
    api('getSettings').then(r => {
      if (r.success && r.data?.settings) {
        // r.data = { ok, settings: { key: value, ... } }
        const arr = Object.entries(r.data.settings).map(([key, value]) => ({ key, value }));
        setSettings(arr);
        const v = {};
        arr.forEach(s => { v[s.key] = s.value; });
        setVals(v);
      }
    }).catch(() => {});
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
    setSyncing(true); setSyncResult(null);
    try {
      const r = await api('syncApiSecret', secret);
      if (r.success) {
        setSyncResult(r.data);
        toast(r.message, 'success');
        setSecret({ newSecret: '', confirmSecret: '' });
      } else { toast(r.message || 'فشل التزامن'); }
    } catch { toast('خطأ في الاتصال'); }
    finally { setSyncing(false); }
  }

  async function testConnection() {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await api('testGasConnection', { url: sysVars.APPS_SCRIPT_URL.trim() || undefined });
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
    if (Object.keys(toSend).length === 0) return toast('أدخل متغيراً واحداً على الأقل');
    if (toSend.APPS_SCRIPT_URL && !toSend.APPS_SCRIPT_URL.includes('script.google.com'))
      return toast('رابط Apps Script يجب أن يحتوي على script.google.com');
    setSysLoading(true); setSysResult(null);
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

      {/* ══ إعداد النظام ══ */}
      <div style={{ ...S.panel, border: '2px solid rgba(26,154,72,.3)', background: '#F0FDF4', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <div>
            <h3 style={{ ...S.panelTitle, color: '#0B3D22', marginBottom: 2 }}>إعداد النظام</h3>
            <p style={{ fontSize: 12, color: '#587A68' }}>أدخل المتغيرات التي تريد تحديثها — الحقول الفارغة تُتجاهَل</p>
          </div>
        </div>

        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
          ✅ APPS_SCRIPT_URL يُحفظ في Netlify Blobs — يعمل فوراً لجميع المتصفحات.
        </div>

        <form onSubmit={saveSysVars}>
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
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#587A68', marginBottom: 10, fontWeight: 600 }}>
            الحقول التالية اختيارية
          </div>
          {[
            { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'واتساب — Phone Number ID', placeholder: '123456789012345', type: 'text' },
            { key: 'WHATSAPP_ACCESS_TOKEN',    label: 'واتساب — Access Token',    placeholder: 'EAAxxxxx...',      type: 'password' },
            { key: 'WHATSAPP_ADMIN_PHONE',     label: 'واتساب — رقم المدير',     placeholder: '+249912345678',    type: 'text' },
            { key: 'ALLOWED_ORIGIN',           label: 'النطاق المسموح (CORS)',   placeholder: 'https://your-site.netlify.app', type: 'url' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key} className="field" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#3A5C4A', display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                <code style={{ fontSize: 10, background: 'rgba(26,154,72,.08)', padding: '1px 5px', borderRadius: 4, color: '#587A68' }}>{key}</code>
              </label>
              <input type={type} value={sysVars[key]}
                onChange={e => setSysVars(v => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ background: '#fff', border: '1.5px solid rgba(26,154,72,.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', fontFamily: 'monospace', direction: 'ltr', marginTop: 4 }}
              />
            </div>
          ))}

          <button type="submit" className="btn btn-primary" disabled={sysLoading} style={{ width: '100%', marginTop: 8 }}>
            {sysLoading ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
          </button>
        </form>

        {sysResult && (
          <div style={{ marginTop: 14, background: sysResult.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${sysResult.ok ? '#86EFAC' : '#FECACA'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            {sysResult.ok ? (
              <>
                <div style={{ color: '#166534', fontWeight: 700, marginBottom: 4 }}>✅ {sysResult.message}</div>
                <div style={{ color: '#166534' }}>المتغيرات المحدَّثة: {sysResult.data?.updatedKeys?.join(' • ') || '—'}</div>
              </>
            ) : (
              <div style={{ color: '#991B1B', fontWeight: 600 }}>❌ {sysResult.message}</div>
            )}
          </div>
        )}
      </div>

      {/* ══ تزامن السر ══ */}
      <div style={{ ...S.panel, border: '2px solid rgba(220,38,38,.2)', background: '#FFF8F8', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🔐</span>
          <div>
            <h3 style={{ ...S.panelTitle, marginBottom: 2, color: '#991B1B' }}>تغيير السر المشترك</h3>
            <p style={{ fontSize: 12, color: '#587A68' }}>يُحدِّث <code>API_SHARED_SECRET</code> في جداول البيانات</p>
          </div>
        </div>
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          ⚠️ بعد تغيير السر حدِّث <strong>APPS_SCRIPT_SHARED_SECRET</strong> يدوياً في Netlify Environment Variables.
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
          <button type="submit" className="btn btn-danger"
            disabled={syncing || secret.newSecret !== secret.confirmSecret || secret.newSecret.length < 16}>
            {syncing ? 'جاري التزامن...' : '🔄 تزامن السر'}
          </button>
        </form>
        {syncResult && (
          <div style={{ marginTop: 16, background: syncResult.netlifyUpdated ? '#DCFCE7' : '#FEF9C3', border: `1px solid ${syncResult.netlifyUpdated ? '#BBF7D0' : '#FEF08A'}`, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            {syncResult.netlifyUpdated ? (
              <div style={{ color: '#166534', fontWeight: 600 }}>✅ تم تحديث Netlify</div>
            ) : (
              <>
                <div style={{ color: '#92400E', fontWeight: 600, marginBottom: 8 }}>⚠️ تم تحديث جداول البيانات فقط</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A', fontSize: 13, wordBreak: 'break-all' }}>
                    {syncResult.newSecret}
                  </code>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => navigator.clipboard.writeText(syncResult.newSecret)}>
                    نسخ
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#92400E', marginTop: 8 }}>
                  المتغير: <code>APPS_SCRIPT_SHARED_SECRET</code> — أضفه في Netlify ثم أعد النشر
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ إعدادات GAS العامة (للـ admin فقط — مخفية لـ settings_admin غالباً) ══ */}
      {settings.length > 0 && (
        <div style={S.panel}>
          <h3 style={S.panelTitle}>إعدادات Apps Script</h3>
          {settings
            .filter(s => !['API_SHARED_SECRET', 'API_URL'].includes(s.key))
            .map(s => (
              <div key={s.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F1F8F3' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#587A68', marginBottom: 6 }}>{s.key}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ flex: 1, padding: '9px 12px', border: '1.5px solid rgba(26,154,72,.2)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}
                    value={vals[s.key] ?? ''} onChange={e => setVals(v => ({ ...v, [s.key]: e.target.value }))} />
                  <button className="btn btn-primary btn-sm" disabled={saving === s.key} onClick={() => save(s.key)}>
                    {saving === s.key ? '...' : 'حفظ'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DevToolsTab — أدوات التطوير (settings_admin فقط)
// ═══════════════════════════════════════════════════════════════
function DevToolsTab({ api, toast }) {
  const [status, setStatus]       = useState(null);
  const [statusLoading, setSL]    = useState(false);
  const [regTest, setRegTest]     = useState(null);
  const [regLoading, setRL]       = useState(false);
  const [logs, setLogs]           = useState([]);
  const [logsLoading, setLL]      = useState(false);
  const [copied, setCopied]       = useState(false);

  function buildReport() {
    const lines = [];
    lines.push('══════════════════════════════════════');
    lines.push('   تقرير أخطاء — السودان الأخضر 🌿');
    lines.push('══════════════════════════════════════');
    lines.push(`التاريخ: ${new Date().toLocaleString('ar-SA')}`);
    lines.push('');

    lines.push('🔍 حالة النظام:');
    if (status) {
      lines.push(`  Apps Script: ${status.gasStatus?.ok ? '✅ متصل' : `❌ ${status.gasStatus?.error || 'غير متصل'}`}`);
      if (status.gasStatus?.stats) {
        lines.push(`  الإحصاء: ${status.gasStatus.stats.totalUsers} مستخدم • ${status.gasStatus.stats.totalProjects} مشروع`);
      }
      lines.push('  متغيرات البيئة:');
      const VAR_SHORT = {
        APPS_SCRIPT_URL: 'APPS_SCRIPT_URL', APPS_SCRIPT_URL_BLOB: 'APPS_SCRIPT_URL_BLOB',
        APPS_SCRIPT_SHARED_SECRET: 'APPS_SCRIPT_SHARED_SECRET', AUTH_PASSWORD_PEPPER: 'AUTH_PASSWORD_PEPPER',
        SETTINGS_SESSION_SECRET: 'SETTINGS_SESSION_SECRET', AUTH_OTP_SECRET: 'AUTH_OTP_SECRET',
        SETTINGS_ADMIN_ACCOUNT: 'SETTINGS_ADMIN_ACCOUNT', SETTINGS_ADMIN_PIN: 'SETTINGS_ADMIN_PIN',
        NETLIFY_BLOBS_CONTEXT: 'NETLIFY_BLOBS_CONTEXT', NETLIFY_ACCESS_TOKEN: 'NETLIFY_ACCESS_TOKEN',
        ALLOWED_ORIGIN: 'ALLOWED_ORIGIN',
      };
      Object.entries(status.vars || {}).forEach(([k, v]) => {
        const icon = v === true ? '✅' : v === false ? '❌' : '📋';
        const val  = typeof v === 'string' ? ` = ${v}` : '';
        lines.push(`    ${icon} ${VAR_SHORT[k] || k}${val}`);
      });
    } else {
      lines.push('  (لم يتم تحميل حالة النظام بعد)');
    }
    lines.push('');

    lines.push('🧪 اختبار تدفق التسجيل:');
    if (regTest) {
      lines.push(`  النتيجة: ${regTest.allOk ? '✅ كل الخطوات تعمل' : '❌ هناك مشكلة'}`);
      (regTest.steps || []).forEach(s => {
        const icon = s.ok ? '✅' : '❌';
        const err  = s.response?.error ? ` — ${s.response.error}` : '';
        const msg  = s.error ? ` — ${s.error}` : '';
        lines.push(`  ${icon} ${s.step}${err}${msg}`);
      });
    } else {
      lines.push('  (لم يتم تشغيل الاختبار بعد)');
    }
    lines.push('');

    lines.push(`📋 سجل الأخطاء (${logs.length} خطأ):`);
    if (logs.length === 0) {
      lines.push('  ✅ لا توجد أخطاء');
    } else {
      logs.forEach((log, i) => {
        lines.push(`  [${i + 1}] ${log.source} | ${log.code} | ${new Date(log.ts).toLocaleString('ar-SA')}`);
        lines.push(`      الرسالة: ${log.message}`);
        if (log.detail) lines.push(`      التفصيل: ${log.detail}`);
      });
    }
    lines.push('');
    lines.push('══════════════════════════════════════');
    return lines.join('\n');
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('تعذّر النسخ — جرّب تحديد النص يدوياً');
    }
  }

  const loadStatus = useCallback(async () => {
    setSL(true);
    try {
      const r = await api('getSystemStatus');
      if (r.success) setStatus(r.data);
      else toast(r.message || 'فشل تحميل الحالة');
    } catch { toast('خطأ في الاتصال'); }
    finally { setSL(false); }
  }, [api]);

  const loadLogs = useCallback(async () => {
    setLL(true);
    try {
      const r = await api('getDevLogs');
      if (r.success) setLogs(r.data?.logs || []);
    } catch {}
    finally { setLL(false); }
  }, [api]);

  async function testReg() {
    setRL(true); setRegTest(null);
    try {
      const r = await api('testRegistration');
      setRegTest(r.success ? r.data : { allOk: false, steps: [], error: r.message });
      toast(r.message, r.data?.allOk ? 'success' : 'error');
      if (!r.success) toast(r.message);
    } catch { toast('خطأ في الاتصال'); }
    finally { setRL(false); }
  }

  useEffect(() => { loadStatus(); loadLogs(); }, [loadStatus, loadLogs]);

  const VAR_LABELS = {
    APPS_SCRIPT_URL:           'رابط Apps Script (env)',
    APPS_SCRIPT_URL_BLOB:      'رابط Apps Script (Blobs)',
    APPS_SCRIPT_SHARED_SECRET: 'السر المشترك مع GAS',
    AUTH_PASSWORD_PEPPER:      'تشفير كلمات المرور',
    SETTINGS_SESSION_SECRET:   'سر JWT',
    AUTH_OTP_SECRET:           'سر OTP',
    SETTINGS_ADMIN_ACCOUNT:    'حساب مدير الإعدادات',
    SETTINGS_ADMIN_PIN:        'PIN مدير الإعدادات',
    NETLIFY_BLOBS_CONTEXT:     'Netlify Blobs (تلقائي)',
    NETLIFY_ACCESS_TOKEN:      'Netlify Access Token',
    ALLOWED_ORIGIN:            'النطاق المسموح (CORS)',
  };

  return (
    <div style={{ maxWidth: 720 }}>

      {/* ══ حالة النظام ══ */}
      <div style={{ ...S.panel, border: '2px solid rgba(59,130,246,.3)', background: '#EFF6FF', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <h3 style={{ ...S.panelTitle, color: '#1E40AF', marginBottom: 0, flex: 1 }}>حالة النظام</h3>
          <button className="btn btn-ghost btn-sm" onClick={loadStatus} disabled={statusLoading}>
            {statusLoading ? '⏳' : '↻ تحديث'}
          </button>
        </div>

        {status ? (
          <>
            {/* GAS */}
            <div style={{ background: status.gasStatus?.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${status.gasStatus?.ok ? '#86EFAC' : '#FECACA'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <strong style={{ color: status.gasStatus?.ok ? '#166534' : '#991B1B' }}>
                {status.gasStatus?.ok ? '✅ Apps Script متصل' : `❌ Apps Script ${status.gasStatus?.error || 'غير متصل'}`}
              </strong>
              {status.gasStatus?.stats && (
                <span style={{ color: '#166534', marginRight: 12, fontSize: 12 }}>
                  {status.gasStatus.stats.totalUsers} مستخدم • {status.gasStatus.stats.totalProjects} مشروع
                </span>
              )}
            </div>

            {/* متغيرات البيئة */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(status.vars || {}).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderRadius: 6, border: `1px solid ${v === true ? 'rgba(22,163,74,.2)' : v === false ? 'rgba(220,38,38,.2)' : 'rgba(59,130,246,.15)'}`, fontSize: 12 }}>
                  <span>{v === true ? '✅' : v === false ? '❌' : '📋'}</span>
                  <span style={{ color: '#374151', flex: 1, fontSize: 11 }}>{VAR_LABELS[k] || k}</span>
                  {typeof v === 'string' && <span style={{ color: '#6B7280', fontSize: 11, fontFamily: 'monospace' }}>{v.slice(0, 30)}</span>}
                </div>
              ))}
            </div>
          </>
        ) : statusLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : null}
      </div>

      {/* ══ اختبار التسجيل ══ */}
      <div style={{ ...S.panel, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🧪</span>
          <h3 style={{ ...S.panelTitle, marginBottom: 0, flex: 1 }}>اختبار تدفق التسجيل</h3>
          <button className="btn btn-primary btn-sm" onClick={testReg} disabled={regLoading}>
            {regLoading ? '⏳' : '▶ اختبار'}
          </button>
        </div>

        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', marginBottom: 14 }}>
          يختبر: checkPhone → getRoleById → getPublicRoles. إذا فشلت أي خطوة، التسجيل لن يعمل.
        </div>

        {regTest && (
          <div>
            <div style={{ fontWeight: 700, color: regTest.allOk ? '#166534' : '#991B1B', fontSize: 14, marginBottom: 10 }}>
              {regTest.allOk ? '✅ كل الخطوات تعمل — التسجيل يعمل' : '❌ هناك مشكلة — التسجيل لا يعمل'}
            </div>
            {(regTest.steps || []).map((step, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: step.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${step.ok ? '#86EFAC' : '#FECACA'}`, fontSize: 13, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{step.ok ? '✅' : '❌'}</span>
                  <code style={{ fontWeight: 600, color: '#111827' }}>{step.step}</code>
                  {!step.ok && step.response?.error && (
                    <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 8px', borderRadius: 4, fontSize: 11, marginRight: 'auto' }}>{step.response.error}</span>
                  )}
                </div>
                {step.error && <div style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{step.error}</div>}
              </div>
            ))}
            {!regTest.allOk && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#FFF8F8', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#7F1D1D' }}>
                <strong>الحل:</strong> في Code.gs تحقق أن <code>REGISTER_ENABLED = true</code> في ورقة Settings
                أو أن <code>APPS_SCRIPT_SHARED_SECRET</code> في Netlify يطابق <code>API_SHARED_SECRET</code> في GAS.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ سجل الأخطاء ══ */}
      <div style={S.panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <h3 style={{ ...S.panelTitle, marginBottom: 0, flex: 1 }}>سجل الأخطاء ({logs.length})</h3>
          <button className="btn btn-ghost btn-sm" onClick={loadLogs} disabled={logsLoading}>
            {logsLoading ? '⏳' : '↻'}
          </button>
        </div>

        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', marginBottom: 14 }}>
          ⚠️ السجل مؤقت — يُمسح عند إعادة تشغيل Lambda. للأخطاء الدائمة راجع: Netlify → Functions → Logs.
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#587A68', padding: 20, fontSize: 14 }}>
            {logsLoading ? <Spin /> : '✅ لا توجد أخطاء مسجلة في هذا الـ instance'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((log, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ color: '#991B1B', fontWeight: 700, fontSize: 11 }}>{log.source}</span>
                  <code style={{ background: '#FEE2E2', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{log.code}</code>
                  <span style={{ color: '#9CA3AF', marginRight: 'auto', fontSize: 10 }}>{new Date(log.ts).toLocaleTimeString('ar-SA')}</span>
                </div>
                <div style={{ color: '#7F1D1D' }}>{log.message}</div>
                {log.detail && <div style={{ color: '#991B1B', marginTop: 3, fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{log.detail}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ صندوق نسخ التقرير ══ */}
      <div style={{ ...S.panel, marginTop: 20, border: '2px solid rgba(99,102,241,.3)', background: '#F5F3FF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>📤</span>
          <h3 style={{ ...S.panelTitle, color: '#4338CA', marginBottom: 0, flex: 1 }}>نسخ تقرير الأخطاء</h3>
          <button
            className="btn btn-sm"
            style={{ background: copied ? '#16A34A' : '#4F46E5', color: '#fff', border: 'none', minWidth: 90 }}
            onClick={copyReport}
          >
            {copied ? '✅ تم النسخ' : '📋 نسخ الكل'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#6366F1', marginBottom: 10 }}>
          انسخ هذا النص وألصقه في المحادثة للحصول على مساعدة — يشمل حالة النظام + الاختبار + سجل الأخطاء.
        </div>
        <textarea
          readOnly
          value={buildReport()}
          style={{
            width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 11,
            border: '1px solid rgba(99,102,241,.3)', borderRadius: 8,
            padding: '10px 12px', background: '#fff', color: '#1e1b4b',
            resize: 'vertical', lineHeight: 1.6, direction: 'ltr', textAlign: 'left',
            outline: 'none',
          }}
          onClick={e => e.target.select()}
        />
      </div>
    </div>
  );
}

function Spin() {
  return <div style={{ width: 32, height: 32, border: '3px solid rgba(26,154,72,.2)', borderTop: '3px solid #1A9A48', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />;
}

const S = {
  shell:    { display: 'flex', minHeight: '100vh', background: '#F8FAF9', direction: 'rtl' },
  side:     { width: 240, background: 'linear-gradient(180deg,#060E09,#0B3D22)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0, height: '100vh', zIndex: 200, transition: 'transform .3s' },
  sideOpen: { transform: 'translateX(0)' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 199 },
  sideHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px', color: '#fff', borderBottom: '1px solid rgba(255,255,255,.1)' },
  sideName: { fontFamily: "'Amiri',serif", fontSize: 16, fontWeight: 700 },
  userCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, margin: '12px', background: 'rgba(255,255,255,.08)', borderRadius: 10 },
  avatar:   { width: 36, height: 36, borderRadius: '50%', background: 'rgba(44,198,101,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#2CC665', fontWeight: 700, flexShrink: 0 },
  userName: { color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 3 },
  nav:      { display: 'flex', flexDirection: 'column', padding: '8px 12px', flex: 1 },
  navBtn:   { padding: '11px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,.65)', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, textAlign: 'right', transition: 'all .2s', marginBottom: 4 },
  navActive:{ background: 'rgba(44,198,101,.15)', color: '#2CC665', fontWeight: 600 },
  main:     { flex: 1, marginRight: 240, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar:   { background: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 0 rgba(26,154,72,.1)', position: 'sticky', top: 0, zIndex: 100 },
  menuBtn:  { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#0B3D22', display: 'none' },
  pageTitle:{ flex: 1, fontFamily: "'Amiri',serif", fontSize: 20, color: '#0B3D22' },
  content:  { padding: 24, flex: 1 },
  panel:    { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 20 },
  panelTitle:{ fontFamily: "'Amiri',serif", fontSize: 18, color: '#0B3D22', marginBottom: 16 },
};
