// ═══════════════════════════════════════════════════════════════
//  auth.js — Netlify Function (Secure Auth Middleware)
//  المصادقة الآمنة: PBKDF2 + JWT + WhatsApp OTP
//  لا تُرسَل أسرار WhatsApp من المتصفح — كل شيء هنا
// ═══════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');

// ── متغيرات البيئة ───────────────────────────────────────────
const GAS_URL      = process.env.APPS_SCRIPT_API_URL  || '';
const GAS_SECRET   = process.env.APPS_SCRIPT_API_SECRET || '';
const PEPPER       = process.env.PASSWORD_PEPPER       || 'default-pepper-CHANGE-ME';
const JWT_SECRET   = process.env.JWT_SECRET            || 'default-jwt-CHANGE-ME';
const OTP_SECRET   = process.env.OTP_SECRET            || 'default-otp-CHANGE-ME';
const WA_PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WA_TOKEN     = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WA_ADMIN     = process.env.WHATSAPP_ADMIN_PHONE  || '';
const ALLOWED      = process.env.ALLOWED_ORIGIN        || 'https://green-sudan.netlify.app';
const ADMIN_PHONE  = process.env.ADMIN_PHONE           || '+249918251171';
const ADMIN_PASS   = process.env.ADMIN_INITIAL_PASSWORD || '';
const ADMIN_ROLE   = process.env.ADMIN_ROLE            || 'super_admin';

// ── تشفير كلمات المرور (PBKDF2) ─────────────────────────────
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(
    PEPPER + password, salt, 120000, 64, 'sha512'
  ).toString('hex');
}
function newSalt() { return crypto.randomBytes(32).toString('hex'); }
function verifyPassword(password, salt, storedHash) {
  try {
    const computed = hashPassword(password, salt);
    if (computed.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex')
    );
  } catch { return false; }
}
// هجرة من SHA-256 القديم (للتوافق مع الحسابات الموجودة)
function legacyHash(salt, password) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

// ── JWT بسيط بـ HMAC-SHA256 ─────────────────────────────────
function signJWT(payload, hoursValid = 12) {
  const hdr = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const pl  = b64url(JSON.stringify({ ...payload, iat: now, exp: now + hoursValid * 3600 }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${hdr}.${pl}`).digest('base64url');
  return `${hdr}.${pl}.${sig}`;
}
function verifyJWT(token) {
  if (!token) return null;
  try {
    const [h, pl, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${pl}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const data = JSON.parse(Buffer.from(pl, 'base64url').toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}
function b64url(str) { return Buffer.from(str).toString('base64url'); }

// ── OTP ──────────────────────────────────────────────────────
function genOTP() { return String(100000 + crypto.randomInt(900000)); }
function hashOTP(otp, phone) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${phone}:${otp}`).digest('hex');
}

// ── تطبيع رقم الهاتف ─────────────────────────────────────────
function normalizePhone(phone, cc = '249') {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
  const code   = String(cc).replace(/\D/g, '');
  if (digits.startsWith(code)) return '+' + digits;
  return '+' + code + digits;
}

// ── Google Apps Script ───────────────────────────────────────
async function gas(action, data = {}) {
  if (!GAS_URL) throw new Error('APPS_SCRIPT_API_URL غير محدد');
  const body = JSON.stringify({ action, _secret: GAS_SECRET, ...data });
  const res  = await fetch(GAS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
  return res.json();
}

// ── WhatsApp Cloud API ───────────────────────────────────────
async function sendWA(to, text) {
  if (!WA_PHONE_ID || !WA_TOKEN) {
    console.log('[WA-SKIP] not configured — OTP for', to, ':', text.slice(-10));
    return { sent: false };
  }
  const phone = String(to).replace(/\D/g, '');
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone, type: 'text',
          text: { body: text, preview_url: false }
        }),
        signal: AbortSignal.timeout(15000)
      }
    );
    return { sent: r.ok, status: r.status };
  } catch (e) {
    console.error('[WA-ERROR]', e.message);
    return { sent: false, error: e.message };
  }
}

// ── CORS ─────────────────────────────────────────────────────
function corsHeaders(origin) {
  const ok = origin && (origin === ALLOWED || ALLOWED === '*');
  return {
    'Access-Control-Allow-Origin':  ok ? origin : ALLOWED,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8'
  };
}
function R(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}
function ok(data, msg = 'تمت العملية بنجاح') {
  return { success: true, code: 'SUCCESS', message: msg, data };
}
function fail(code, message) {
  return { success: false, code, message };
}

// ═══════════════════════════════════════════════════════════════
//  المعالج الرئيسي
// ═══════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const origin = event.headers['origin'] || event.headers['Origin'] || '';
  const H = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return R(200, {}, H);
  if (event.httpMethod !== 'POST')    return R(405, fail('METHOD_NOT_ALLOWED','طريقة غير مسموح بها'), H);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return R(400, fail('INVALID_JSON','بيانات غير صالحة'), H); }

  const { action } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '');

  try {
    let result;
    switch (action) {
      case 'init':                  result = await doInit();                         break;
      case 'register':              result = await doRegister(body);                 break;
      case 'requestOTP':            result = await doRequestOTP(body);               break;
      case 'verifyOTP':             result = await doVerifyOTP(body);                break;
      case 'login':                 result = await doLogin(body);                    break;
      case 'logout':                result = await doLogout(body, bearerToken);      break;
      case 'refreshSession':        result = await doRefresh(bearerToken);           break;
      case 'requestPasswordReset':  result = await doReqReset(body);                 break;
      case 'verifyPasswordResetOTP':result = await doVerifyResetOTP(body);           break;
      case 'resetPassword':         result = await doResetPassword(body);            break;
      case 'changePassword':        result = await doChangePassword(body, bearerToken); break;
      case 'getCurrentUser':        result = await doGetCurrentUser(bearerToken);    break;
      case 'sendWATest':            result = await doWATest(body, bearerToken);      break;
      default:                      result = await doProxy(body, bearerToken);
    }

    const status = result.success ? 200 : (
      ['UNAUTHORIZED','NO_TOKEN','INVALID_TOKEN'].includes(result.code) ? 401 :
      result.code === 'FORBIDDEN' ? 403 : 400
    );
    return R(status, result, H);

  } catch (err) {
    console.error('[AUTH-FN]', action, err.message);
    return R(500, fail('SERVER_ERROR','خطأ داخلي، يرجى المحاولة لاحقاً'), H);
  }
};

// ═══════════════════════════════════════════════════════════════
//  init — تهيئة أولى (تنشئ المدير إذا لم يكن موجوداً)
// ═══════════════════════════════════════════════════════════════
async function doInit() {
  if (!ADMIN_PASS) return fail('NO_ADMIN_PASS', 'ADMIN_INITIAL_PASSWORD غير محدد في متغيرات البيئة');

  const salt = newSalt();
  const hash = hashPassword(ADMIN_PASS, salt);

  const r = await gas('initAdmin', {
    phone: ADMIN_PHONE, passwordHash: hash, salt,
    roleId: ADMIN_ROLE, fullName: 'مدير النظام'
  });

  if (r.alreadyExists) return ok({ skipped: true }, 'حساب المدير موجود مسبقاً');
  if (!r.ok) return fail('INIT_ERROR', r.error || 'خطأ في التهيئة');
  return ok({ created: true }, 'تم إنشاء حساب المدير الأساسي');
}

// ═══════════════════════════════════════════════════════════════
//  register — تسجيل مستخدم جديد
// ═══════════════════════════════════════════════════════════════
async function doRegister(b) {
  const { fullName, phone, password, confirmPassword, roleId = 'user', acceptTerms, countryCode = '249' } = b;

  if (!fullName?.trim())            return fail('MISSING_NAME',     'الاسم الكامل مطلوب');
  if (!phone)                       return fail('MISSING_PHONE',    'رقم الهاتف مطلوب');
  if (!password)                    return fail('MISSING_PASSWORD', 'كلمة المرور مطلوبة');
  if (password.length < 6)          return fail('PASSWORD_TOO_SHORT','كلمة المرور 6 أحرف على الأقل');
  if (password !== confirmPassword) return fail('PASSWORD_MISMATCH','كلمتا المرور غير متطابقتين');
  if (!acceptTerms)                 return fail('TERMS_REQUIRED',   'يجب الموافقة على الشروط');

  const nPhone = normalizePhone(phone, countryCode);

  // التحقق من عدم تكرار الرقم
  const check = await gas('checkPhone', { phone: nPhone });
  if (!check.ok)    return fail('DB_ERROR',    'خطأ في الاتصال بقاعدة البيانات');
  if (check.exists) return fail('PHONE_EXISTS','رقم الهاتف مسجل مسبقاً');

  // رفض التسجيل المباشر كـ admin/super_admin
  if (['admin','super_admin'].includes(roleId)) {
    return fail('ROLE_FORBIDDEN', 'لا يمكن التسجيل بهذا الدور');
  }

  // التحقق من أن الدور يسمح بالتسجيل العام
  const roleCheck = await gas('getRoleById', { roleId });
  const role = roleCheck.role;
  if (role && !role.publicRegistration) {
    return fail('ROLE_NOT_PUBLIC', 'هذا الدور يتطلب إذناً من المدير');
  }

  // تشفير كلمة المرور
  const salt = newSalt();
  const hash = hashPassword(password, salt);

  // OTP
  const otp    = genOTP();
  const otpH   = hashOTP(otp, nPhone);
  const otpExp = new Date(Date.now() + 5 * 60000).toISOString();

  // حفظ المستخدم المعلق
  const requiresApproval = role?.requiresApproval || false;
  const status = 'PENDING_VERIFICATION';

  const save = await gas('savePendingUser', {
    fullName: fullName.trim(), phone: nPhone,
    passwordHash: hash, salt, roleId,
    otpHash: otpH, otpExpiry: otpExp,
    status, requiresApproval
  });

  if (!save.ok) return fail('REGISTER_ERROR', save.error || 'خطأ في التسجيل');

  // إرسال OTP عبر WhatsApp
  const msg = `مرحبًا ${fullName.trim()}،\n\nرمز التحقق الخاص بإنشاء حسابك هو:\n*${otp}*\n\nالرمز صالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أي شخص.`;
  const wa = await sendWA(nPhone, msg);

  return ok(
    { phone: nPhone, whatsappSent: wa.sent },
    wa.sent
      ? 'تم إرسال رمز التحقق عبر WhatsApp'
      : 'تم التسجيل — تواصل مع المدير لتفعيل الحساب'
  );
}

// ═══════════════════════════════════════════════════════════════
//  requestOTP — طلب رمز OTP جديد
// ═══════════════════════════════════════════════════════════════
async function doRequestOTP(b) {
  const { phone, countryCode = '249', purpose = 'REGISTER' } = b;
  if (!phone) return fail('MISSING_PHONE', 'رقم الهاتف مطلوب');

  const nPhone = normalizePhone(phone, countryCode);
  const otp    = genOTP();
  const otpH   = hashOTP(otp, nPhone);
  const otpExp = new Date(Date.now() + 5 * 60000).toISOString();

  const r = await gas('saveOTP', { phone: nPhone, purpose, otpHash: otpH, otpExpiry: otpExp });
  if (!r.ok) return fail('OTP_ERROR', 'لا يمكن إرسال الرمز في الوقت الحالي');

  const name = r.fullName || '';
  const msgMap = {
    REGISTER:       `مرحبًا ${name}،\nرمز التحقق: *${otp}*\nصالح 5 دقائق.`,
    PASSWORD_RESET: `مرحبًا ${name}،\nرمز إعادة تعيين كلمة المرور: *${otp}*\nصالح 5 دقائق.\nإن لم تطلبه تجاهله.`,
    VERIFY_PHONE:   `مرحبًا ${name}،\nرمز التحقق من هاتفك: *${otp}*\nصالح 5 دقائق.`
  };
  const msg = msgMap[purpose] || `رمز التحقق: *${otp}*\nصالح 5 دقائق.`;

  await sendWA(nPhone, msg);
  return ok({ sent: true }, 'تم إرسال رمز التحقق');
}

// ═══════════════════════════════════════════════════════════════
//  verifyOTP — التحقق من رمز OTP
// ═══════════════════════════════════════════════════════════════
async function doVerifyOTP(b) {
  const { phone, otp, purpose = 'REGISTER', countryCode = '249' } = b;
  if (!phone || !otp) return fail('MISSING_FIELDS', 'الرقم والرمز مطلوبان');

  const nPhone = normalizePhone(phone, countryCode);
  const otpH   = hashOTP(String(otp).trim(), nPhone);

  const r = await gas('verifyAndConsumeOTP', { phone: nPhone, otpHash: otpH, purpose });

  if (!r.ok) {
    const msgs = {
      OTP_EXPIRED:      'انتهت صلاحية رمز التحقق، أعد الإرسال',
      OTP_INVALID:      'رمز التحقق غير صحيح',
      OTP_MAX_ATTEMPTS: 'تم تجاوز عدد المحاولات، أعد الإرسال',
      NOT_FOUND:        'لم يُرسَل رمز لهذا الرقم'
    };
    return fail(r.error || 'OTP_ERROR', msgs[r.error] || 'خطأ في التحقق');
  }

  // تفعيل المستخدم بعد التحقق
  if (purpose === 'REGISTER') {
    const act = await gas('activateUser', { phone: nPhone });
    if (act.ok) {
      const user = act.user || {};
      // رسالة ترحيب
      const status = act.requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await sendWA(nPhone, `مرحبًا ${user.fullName || ''}،\nتم تأكيد رقم هاتفك وإنشاء حسابك بنجاح.\nيمكنك الآن تسجيل الدخول باستخدام رقم هاتفك وكلمة المرور التي اخترتها.`);
      } else {
        // إشعار المدير
        if (WA_ADMIN) {
          await sendWA(WA_ADMIN, `🔔 طلب تسجيل جديد:\nالاسم: ${user.fullName}\nالهاتف: ${nPhone}\nالدور: ${user.roleId}\nيحتاج موافقة المدير.`);
        }
      }
      return ok({ verified: true, requiresApproval: act.requiresApproval },
        act.requiresApproval ? 'تم التحقق — طلبك قيد مراجعة المدير' : 'تم التحقق وتفعيل الحساب');
    }
  }

  // لاستعادة كلمة المرور: أنشئ reset token مؤقتاً
  if (purpose === 'PASSWORD_RESET') {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash  = crypto.createHmac('sha256', JWT_SECRET).update(nPhone + resetToken).digest('hex');
    await gas('saveResetToken', { phone: nPhone, resetHash, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() });
    return ok({ verified: true, resetToken }, 'تم التحقق — أدخل كلمة المرور الجديدة');
  }

  return ok({ verified: true }, 'تم التحقق بنجاح');
}

// ═══════════════════════════════════════════════════════════════
//  login — تسجيل الدخول
// ═══════════════════════════════════════════════════════════════
async function doLogin(b) {
  const { phone, password, countryCode = '249' } = b;
  if (!phone || !password) return fail('MISSING_FIELDS', 'رقم الهاتف وكلمة المرور مطلوبان');

  const nPhone = normalizePhone(phone, countryCode);

  // جلب بيانات المستخدم (مع hash — للخادم فقط)
  const r = await gas('getUserForAuth', { phone: nPhone });
  if (!r.ok || !r.user) {
    // تأخير مصطنع لمنع timing attack
    hashPassword('dummy', newSalt());
    return fail('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
  }

  const u = r.user;

  // فحص الحالة
  const statusErrors = {
    PENDING_VERIFICATION: ['PHONE_NOT_VERIFIED', 'يجب التحقق من رقم هاتفك أولاً'],
    PENDING_APPROVAL:     ['PENDING_APPROVAL',   'حسابك قيد مراجعة المدير'],
    SUSPENDED:            ['ACCOUNT_SUSPENDED',  'حسابك موقوف، تواصل مع المدير'],
    REJECTED:             ['ACCOUNT_REJECTED',   'تم رفض طلب حسابك']
  };
  if (statusErrors[u.status]) return fail(...statusErrors[u.status]);

  // فحص القفل
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(u.lockedUntil) - Date.now()) / 60000);
    return fail('ACCOUNT_LOCKED', `الحساب مقفل مؤقتاً، حاول بعد ${mins} دقيقة`);
  }

  // التحقق من كلمة المرور
  let valid = verifyPassword(password, u.salt, u.passwordHash);

  // هجرة من SHA-256 القديم
  if (!valid) {
    const oldHash = legacyHash(u.salt, password);
    if (oldHash === u.passwordHash) {
      valid = true;
      // ترقية إلى PBKDF2
      const ns = newSalt();
      const nh = hashPassword(password, ns);
      await gas('updatePasswordHash', { phone: nPhone, passwordHash: nh, salt: ns });
    }
  }

  if (!valid) {
    await gas('recordFailedLogin', { phone: nPhone });
    return fail('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
  }

  // تسجيل نجاح الدخول
  await gas('recordSuccessLogin', { phone: nPhone });

  // إنشاء JWT
  const sessionHours = parseInt(r.sessionHours) || 12;
  const token = signJWT({
    userId:   u.userId,
    phone:    nPhone,
    fullName: u.fullName,
    roleId:   u.roleId,
    roleName: u.roleName
  }, sessionHours);

  // سجل التدقيق
  await gas('writeAuditLog', {
    userId: u.userId, action: 'LOGIN', targetType: 'USER',
    targetId: u.userId, details: 'تسجيل دخول ناجح'
  });

  return ok({
    token,
    fullName:          u.fullName,
    phone:             nPhone,
    roleId:            u.roleId,
    roleName:          u.roleName,
    mustChangePassword:u.mustChangePassword,
    expiresAt:         new Date(Date.now() + sessionHours * 3600000).toISOString()
  });
}

// ═══════════════════════════════════════════════════════════════
//  logout
// ═══════════════════════════════════════════════════════════════
async function doLogout(b, token) {
  const payload = verifyJWT(token);
  if (payload) {
    await gas('writeAuditLog', {
      userId: payload.userId, action: 'LOGOUT',
      targetType: 'USER', targetId: payload.userId, details: 'تسجيل خروج'
    }).catch(() => {});
  }
  return ok({}, 'تم تسجيل الخروج');
}

// ═══════════════════════════════════════════════════════════════
//  refreshSession
// ═══════════════════════════════════════════════════════════════
async function doRefresh(token) {
  const p = verifyJWT(token);
  if (!p) return fail('INVALID_TOKEN', 'رمز الجلسة غير صالح أو منتهي');
  const newToken = signJWT({ userId: p.userId, phone: p.phone, fullName: p.fullName, roleId: p.roleId, roleName: p.roleName }, 12);
  return ok({ token: newToken });
}

// ═══════════════════════════════════════════════════════════════
//  requestPasswordReset
// ═══════════════════════════════════════════════════════════════
async function doReqReset(b) {
  const { phone, countryCode = '249' } = b;
  if (!phone) return fail('MISSING_PHONE', 'رقم الهاتف مطلوب');
  // دائماً نُرجع نفس الرد (لا نكشف هل الرقم مسجل)
  await doRequestOTP({ phone, countryCode, purpose: 'PASSWORD_RESET' }).catch(() => {});
  return ok({}, 'إذا كان الرقم مسجلاً ستصلك رسالة WhatsApp');
}

async function doVerifyResetOTP(b) {
  return doVerifyOTP({ ...b, purpose: 'PASSWORD_RESET' });
}

// ═══════════════════════════════════════════════════════════════
//  resetPassword
// ═══════════════════════════════════════════════════════════════
async function doResetPassword(b) {
  const { phone, resetToken, newPassword, countryCode = '249' } = b;
  if (!phone || !resetToken || !newPassword) return fail('MISSING_FIELDS', 'البيانات غير مكتملة');
  if (newPassword.length < 6) return fail('PASSWORD_TOO_SHORT', 'كلمة المرور 6 أحرف على الأقل');

  const nPhone    = normalizePhone(phone, countryCode);
  const resetHash = crypto.createHmac('sha256', JWT_SECRET).update(nPhone + resetToken).digest('hex');

  const check = await gas('verifyResetToken', { phone: nPhone, resetHash });
  if (!check.ok) return fail('INVALID_TOKEN', 'رمز إعادة التعيين غير صالح أو منتهي');

  const salt = newSalt();
  const hash = hashPassword(newPassword, salt);

  const upd = await gas('updatePasswordHash', { phone: nPhone, passwordHash: hash, salt, revokeAllSessions: true });
  if (!upd.ok) return fail('UPDATE_ERROR', 'خطأ في تحديث كلمة المرور');

  // رسالة تأكيد
  const ur = await gas('getUser', { phone: nPhone });
  if (ur.ok && ur.user) {
    await sendWA(nPhone, `تم تغيير كلمة مرور حسابك في السودان الأخضر بنجاح.\nإذا لم تقم بهذا الإجراء، يرجى التواصل فورًا مع إدارة التطبيق.`);
  }

  return ok({}, 'تم تغيير كلمة المرور بنجاح');
}

// ═══════════════════════════════════════════════════════════════
//  changePassword (للمستخدم المسجَّل)
// ═══════════════════════════════════════════════════════════════
async function doChangePassword(b, token) {
  const p = verifyJWT(token);
  if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');

  const { currentPassword, newPassword } = b;
  if (!currentPassword || !newPassword) return fail('MISSING_FIELDS', 'كلمتا المرور مطلوبتان');
  if (newPassword.length < 6) return fail('PASSWORD_TOO_SHORT', 'كلمة المرور 6 أحرف على الأقل');

  const ur = await gas('getUserForAuth', { phone: p.phone });
  if (!ur.ok || !ur.user) return fail('USER_NOT_FOUND', 'المستخدم غير موجود');

  const valid = verifyPassword(currentPassword, ur.user.salt, ur.user.passwordHash)
    || legacyHash(ur.user.salt, currentPassword) === ur.user.passwordHash;

  if (!valid) return fail('WRONG_CURRENT_PASSWORD', 'كلمة المرور الحالية غير صحيحة');

  const salt = newSalt();
  const hash = hashPassword(newPassword, salt);
  await gas('updatePasswordHash', { phone: p.phone, passwordHash: hash, salt });
  await gas('writeAuditLog', { userId: p.userId, action: 'CHANGE_PASSWORD', targetType: 'USER', targetId: p.userId, details: 'تغيير كلمة المرور' });

  return ok({}, 'تم تغيير كلمة المرور بنجاح');
}

// ═══════════════════════════════════════════════════════════════
//  getCurrentUser
// ═══════════════════════════════════════════════════════════════
async function doGetCurrentUser(token) {
  const p = verifyJWT(token);
  if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');
  const r = await gas('getUser', { phone: p.phone });
  if (!r.ok || !r.user) return fail('USER_NOT_FOUND', 'المستخدم غير موجود');
  return ok(r.user);
}

// ═══════════════════════════════════════════════════════════════
//  sendWATest — إرسال رسالة WhatsApp تجريبية (للمدير فقط)
// ═══════════════════════════════════════════════════════════════
async function doWATest(b, token) {
  const p = verifyJWT(token);
  if (!p || !['admin','super_admin'].includes(p.roleId)) return fail('FORBIDDEN', 'غير مسموح');
  const { to, message } = b;
  if (!to || !message) return fail('MISSING_FIELDS', 'الرقم والرسالة مطلوبان');
  const r = await sendWA(to, message);
  return ok(r, r.sent ? 'تم الإرسال' : 'فشل الإرسال');
}

// ═══════════════════════════════════════════════════════════════
//  proxy — العمليات الإدارية الأخرى (مع التحقق من JWT)
// ═══════════════════════════════════════════════════════════════
const ADMIN_ACTIONS = new Set([
  'getUsers','approveUser','rejectUser','updateUserRole',
  'suspendUser','activateUserAdmin','getRoles','createRole','updateRole',
  'getSettings','updateSettings','getAuditLog','exportUsers','broadcast'
]);
const AUTH_ACTIONS = new Set([
  'getProfile','updateProfile','getCrops','getProjects','getRegions','getStats'
]);

async function doProxy(b, token) {
  const p = verifyJWT(token);
  const { action, ...rest } = b;

  if (ADMIN_ACTIONS.has(action)) {
    if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');
    if (!['admin','super_admin'].includes(p.roleId)) return fail('FORBIDDEN', 'ليس لديك صلاحية');
  } else if (AUTH_ACTIONS.has(action)) {
    if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');
  }

  // إضافة بيانات المستخدم الحالي للطلب
  const r = await gas(action, { ...rest, _userId: p?.userId, _roleId: p?.roleId, _phone: p?.phone });

  if (r.ok || r.success) return ok(r.data ?? r, r.message || 'تمت العملية');
  return fail(r.error || r.code || 'ERROR', r.message || 'خطأ في العملية');
}
