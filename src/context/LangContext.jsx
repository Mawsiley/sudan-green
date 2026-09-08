import { createContext, useContext, useState, useEffect } from 'react';

const STRINGS = {
  ar: {
    // Nav
    'nav.prices':    'الأسعار',
    'nav.projects':  'المشاريع',
    'nav.kalaklah':  'كلاكلة',
    'nav.login':     'دخول / تسجيل',
    'nav.dashboard': 'لوحة التحكم',
    'nav.admin':     'الإدارة',
    'nav.logout':    'خروج',
    // Auth tabs
    'auth.tab_login':    'دخول',
    'auth.tab_register': 'حساب جديد',
    // Login form
    'auth.welcome':      'مرحباً بعودتك',
    'auth.phone':        'رقم الهاتف',
    'auth.password':     'كلمة المرور',
    'auth.pw_ph':        'أدخل كلمة المرور',
    'auth.submit_login': 'دخول',
    'auth.loading':      'جاري الدخول...',
    'auth.forgot':       'نسيت كلمة المرور؟',
    // Register form
    'auth.create':       'إنشاء حساب',
    'auth.fullname':     'الاسم الكامل',
    'auth.name_ph':      'اسمك الكامل',
    'auth.pw_hint':      '8 أحرف على الأقل',
    'auth.submit_reg':   'إنشاء حساب',
    'auth.loading_reg':  'جاري التسجيل...',
    // Forgot
    'auth.forgot_title': 'استعادة كلمة المرور',
    'auth.forgot_hint':  'أدخل رقم هاتفك وسنرسل لك رمز التحقق',
    'auth.send_otp':     'إرسال رمز OTP',
    'auth.loading_otp':  'جاري الإرسال...',
    'auth.back_login':   '← العودة للدخول',
    // OTP
    'auth.otp_title':    'إدخال رمز OTP',
    'auth.otp_hint':     'أُرسل رمز مكوّن من 6 أرقام إلى هاتفك',
    'auth.new_pw':       'كلمة المرور الجديدة',
    'auth.new_pw_ph':    'كلمة مرور جديدة قوية',
    'auth.submit_reset': 'تغيير كلمة المرور',
    'auth.resend':       'إعادة إرسال الرمز',
    // Brand
    'brand.name':   'السودان الأخضر',
    'brand.tagline':'منصة التنمية الزراعية المستدامة',
    'brand.f1':     'متابعة أسعار المحاصيل لحظياً',
    'brand.f2':     'إدارة مشاريع زراعية متكاملة',
    'brand.f3':     'تواصل مع مزارعين ومستثمرين',
    'brand.f4':     'دعم مبادرات التشجير الوطنية',
    // Strength
    'pw.weak':      'ضعيفة',
    'pw.fair':      'متوسطة',
    'pw.good':      'جيدة',
    'pw.strong':    'قوية جداً',
    // Toast errors
    'err.phone':    'أدخل رقم الهاتف',
    'err.password': 'أدخل كلمة المرور',
    'err.name':     'أدخل الاسم الكامل',
    'err.pw_weak':  'كلمة المرور ضعيفة جداً',
    'err.connect':  'خطأ في الاتصال',
    'err.otp_full': 'أدخل الرمز كاملاً',
    'err.new_pw':   'كلمة المرور الجديدة ضعيفة',
    // Home hero
    'hero.badge':   'منصة التنمية الزراعية',
    'hero.h1a':     'السودان',
    'hero.h1b':     'الأخضر',
    'hero.sub':     'نحو مستقبل زراعي مستدام — نربط المزارعين بالأسواق، ندعم مشاريع التشجير، ونحوّل البيانات إلى قرارات.',
    'hero.cta1':    'ابدأ الآن',
    'hero.cta2':    'تعرف على المشاريع',
  },
  en: {
    // Nav
    'nav.prices':    'Prices',
    'nav.projects':  'Projects',
    'nav.kalaklah':  'Kalaklah',
    'nav.login':     'Login / Register',
    'nav.dashboard': 'Dashboard',
    'nav.admin':     'Admin Panel',
    'nav.logout':    'Sign Out',
    // Auth tabs
    'auth.tab_login':    'Login',
    'auth.tab_register': 'Register',
    // Login form
    'auth.welcome':      'Welcome Back',
    'auth.phone':        'Phone Number',
    'auth.password':     'Password',
    'auth.pw_ph':        'Enter your password',
    'auth.submit_login': 'Sign In',
    'auth.loading':      'Signing in...',
    'auth.forgot':       'Forgot Password?',
    // Register form
    'auth.create':       'Create Account',
    'auth.fullname':     'Full Name',
    'auth.name_ph':      'Your full name',
    'auth.pw_hint':      'At least 8 characters',
    'auth.submit_reg':   'Create Account',
    'auth.loading_reg':  'Creating...',
    // Forgot
    'auth.forgot_title': 'Reset Password',
    'auth.forgot_hint':  'Enter your phone number and we will send a verification code',
    'auth.send_otp':     'Send OTP Code',
    'auth.loading_otp':  'Sending...',
    'auth.back_login':   '← Back to Login',
    // OTP
    'auth.otp_title':    'Enter OTP Code',
    'auth.otp_hint':     'A 6-digit code was sent to your phone',
    'auth.new_pw':       'New Password',
    'auth.new_pw_ph':    'Strong new password',
    'auth.submit_reset': 'Change Password',
    'auth.resend':       'Resend Code',
    // Brand
    'brand.name':   'Green Sudan',
    'brand.tagline':'Sustainable Agricultural Development Platform',
    'brand.f1':     'Real-time crop price tracking',
    'brand.f2':     'Integrated agricultural project management',
    'brand.f3':     'Connect farmers with investors',
    'brand.f4':     'Support national afforestation initiatives',
    // Strength
    'pw.weak':   'Weak',
    'pw.fair':   'Fair',
    'pw.good':   'Good',
    'pw.strong': 'Very Strong',
    // Toast errors
    'err.phone':    'Enter phone number',
    'err.password': 'Enter password',
    'err.name':     'Enter full name',
    'err.pw_weak':  'Password is too weak',
    'err.connect':  'Connection error',
    'err.otp_full': 'Enter the complete code',
    'err.new_pw':   'New password is too weak',
    // Home hero
    'hero.badge':   'Agricultural Development Platform',
    'hero.h1a':     'Green',
    'hero.h1b':     'Sudan',
    'hero.sub':     'Toward a sustainable agricultural future — connecting farmers to markets, supporting afforestation, and turning data into decisions.',
    'hero.cta1':    'Get Started',
    'hero.cta2':    'Explore Projects',
  }
};

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('sg_lang') || 'ar'; } catch { return 'ar'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('sg_lang', lang); } catch {}
  }, [lang]);

  const toggle = () => setLang(l => l === 'ar' ? 'en' : 'ar');
  const t = (key) => STRINGS[lang]?.[key] ?? STRINGS.ar[key] ?? key;
  const isAr = lang === 'ar';

  return (
    <LangContext.Provider value={{ lang, toggle, t, isAr }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
