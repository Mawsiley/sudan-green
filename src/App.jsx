import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Kalaklah from './pages/Kalaklah';

function NotFound() {
  const { pathname } = useLocation();
  return (
    <div style={{ minHeight: '100vh', background: '#060E09', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans Arabic', sans-serif", color: '#E8F5EC', textAlign: 'center', padding: '2rem', direction: 'rtl' }}>
      <div style={{ fontSize: '6rem', lineHeight: 1, marginBottom: '1rem', opacity: 0.15, fontWeight: 700, color: '#2CC665' }}>٤٠٤</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem', color: '#2CC665' }}>الصفحة غير موجودة</h1>
      <p style={{ color: '#587A68', marginBottom: '0.5rem' }}>لا توجد صفحة على هذا المسار:</p>
      <code style={{ background: 'rgba(44,198,101,0.08)', border: '1px solid rgba(44,198,101,0.2)', borderRadius: 6, padding: '4px 14px', fontSize: 14, color: '#2CC665', marginBottom: '2.5rem', direction: 'ltr' }}>{pathname}</code>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <a href="/" style={{ padding: '10px 24px', background: '#1A9A48', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>الصفحة الرئيسية</a>
        <a href="/auth" style={{ padding: '10px 24px', border: '1.5px solid rgba(44,198,101,0.4)', color: '#2CC665', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>تسجيل الدخول</a>
      </div>
    </div>
  );
}

function Protected({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
    <LangProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<GuestOnly><Auth /></GuestOnly>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
          <Route path="/kalaklah" element={<Kalaklah />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LangProvider>
    </ThemeProvider>
  );
}
