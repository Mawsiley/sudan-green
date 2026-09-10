// ═══════════════════════════════════════════════════════════════
//  auth.js — Netlify Function (Secure Auth Middleware)
//  المصادقة الآمنة: PBKDF2 + JWT + WhatsApp OTP
//  لا تُرسَل أسرار WhatsApp من المتصفح — كل شيء هنا
// ═══════════════════════════════════════════════════════════════
'use strict';
const crypto   = require('crypto');
const { getStore } = require('@netlify/blobs');

// ── متغيرات البيئة الأساسية ───────────────────────────────────
const GAS_URL        = process.env.APPS_SCRIPT_URL            || '';
let   GAS_URL_BLOB   = '';   // مخزَّن عند أول قراءة من Netlify Blobs
const GAS_SECRET     = process.env.APPS_SCRIPT_SHARED_SECRET  || '';
const PEPPER         = process.env.AUTH_PASSWORD_PEPPER        || '';
const JWT_SECRET     = process.env.SETTINGS_SESSION_SECRET     || '';
const OTP_SECRET     = process.env.AUTH_OTP_SECRET             || '';
const ALLOWED        = process.env.ALLOWED_ORIGIN              || '*';

// ── Remote config cache (يُقرأ من Apps Script ويُخزَّن 5 دقائق) ─
let _rcache = null; let _rcacheAt = 0;
async function remoteVar(key) {
  const now = Date.now();
  if (!_rcache || now - _rcacheAt > 300000) {
    try {
      const r = await gas('getConfig', {});
      if (r?.ok && r.config) { _rcache = r.config; _rcacheAt = now; }
    } catch { _rcache = _rcache || {}; }
  }
  return (_rcache && _rcache[key]) || '';
}
async function getWaPhoneId() { return process.env.WHATSAPP_PHONE_NUMBER_ID || await remoteVar('WHATSAPP_PHONE_NUMBER_ID'); }
async function getWaToken()   { return process.env.WHATSAPP_ACCESS_TOKEN    || await remoteVar('WHATSAPP_ACCESS_TOKEN'); }
async function getWaAdmin()   { return process.env.WHATSAPP_ADMIN_PHONE     || await remoteVar('WHATSAPP_ADMIN_PHONE'); }
// مدير الإعدادات — يُتحقق منه هنا فقط، لا يُحفظ في Sheets أبداً
const SETTINGS_ADMIN = process.env.SETTINGS_ADMIN_ACCOUNT      || '';
const SETTINGS_PIN   = process.env.SETTINGS_ADMIN_PIN          || '';

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

// ── Netlify Blobs store (لتخزين APPS_SCRIPT_URL بين البارد والساخن) ─
// SITE_ID يُحقن تلقائياً من Netlify runtime — لا حاجة لإضافته يدوياً
// NETLIFY_ACCESS_TOKEN مطلوب مرة واحدة فقط في Netlify → Environment Variables
function cfgStore() {
  // إذا كان NETLIFY_BLOBS_CONTEXT متاحاً (runtime جديد) يعمل تلقائياً
  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    return getStore({ name: 'app-config' });
  }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '';
  const token  = process.env.NETLIFY_ACCESS_TOKEN || '';
  if (!siteID || !token) throw new Error('BLOBS_NOT_CONFIGURED');
  return getStore({ name: 'app-config', siteID, token });
}

// ── Google Apps Script ───────────────────────────────────────
async function getGasUrl() {
  if (GAS_URL)       return GAS_URL;        // env var له الأولوية
  if (GAS_URL_BLOB)  return GAS_URL_BLOB;   // مخزن في الذاكرة لهذا المثيل
  try {
    const url = await cfgStore().get('APPS_SCRIPT_URL');
    if (url) { GAS_URL_BLOB = url; return url; }
  } catch {}
  return '';
}

async function gas(action, data = {}) {
  const url = await getGasUrl();
  if (!url) throw new Error('رابط Apps Script غير محدد — أضفه من لوحة المدير → الإعدادات');
  const payload = GAS_SECRET ? { action, _secret: GAS_SECRET, ...data } : { action, ...data };
  const body = JSON.stringify(payload);
  const res  = await fetch(url, {
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
  const [WA_PHONE_ID, WA_TOKEN] = await Promise.all([getWaPhoneId(), getWaToken()]);
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
      case 'register':              result = await doRegister(body);                        break;
      case 'requestOTP':            result = await doRequestOTP(body);                      break;
      case 'verifyOTP':             result = await doVerifyOTP(body);                       break;
      case 'login':                 result = await doLogin(body);                           break;
      case 'logout':                result = await doLogout(body, bearerToken);             break;
      case 'refreshSession':        result = await doRefresh(bearerToken);                  break;
      case 'requestPasswordReset':  result = await doReqReset(body);                        break;
      case 'verifyPasswordResetOTP':result = await doVerifyResetOTP(body);                  break;
      case 'resetPassword':         result = await doResetPassword(body);                   break;
      case 'changePassword':        result = await doChangePassword(body, bearerToken);     break;
      case 'getCurrentUser':        result = await doGetCurrentUser(bearerToken);           break;
      case 'sendWATest':            result = await doWATest(body, bearerToken);             break;
      case 'syncApiSecret':         result = await doSyncApiSecret(body, bearerToken);      break;
      case 'updateNetlifyEnv':      result = await doUpdateNetlifyEnv(body, bearerToken);   break;
      case 'testGasConnection':     result = await doTestGasConnection(body, bearerToken);  break;
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

  const check = await gas('checkPhone', { phone: nPhone });
  if (!check.ok)    return fail('DB_ERROR',    'خطأ في الاتصال بقاعدة البيانات');
  if (check.exists) return fail('PHONE_EXISTS','رقم الهاتف مسجل مسبقاً');

  if (['admin','super_admin'].includes(roleId)) {
    return fail('ROLE_FORBIDDEN', 'لا يمكن التسجيل بهذا الدور');
  }

  const roleCheck = await gas('getRoleById', { roleId });
  const role = roleCheck.role;
  if (role && !role.publicRegistration) {
    return fail('ROLE_NOT_PUBLIC', 'هذا الدور يتطلب إذناً من المدير');
  }

  const salt = newSalt();
  const hash = hashPassword(password, salt);

  const otp    = genOTP();
  const otpH   = hashOTP(otp, nPhone);
  const otpExp = new Date(Date.now() + 5 * 60000).toISOString();

  const requiresApproval = role?.requiresApproval || false;
  const status = 'PENDING_VERIFICATION';

  const save = await gas('savePendingUser', {
    fullName: fullName.trim(), phone: nPhone,
    passwordHash: hash, salt, roleId,
    otpHash: otpH, otpExpiry: otpExp,
    status, requiresApproval
  });

  if (!save.ok) return fail('REGISTER_ERROR', save.error || 'خطأ في التسجيل');

  const msg = `مرحبًا ${fullName.trim()}،\n\nرمز التحقق الخاص بإنشاء حسابك هو:\n*${otp}*\n\nالرمز صالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أي شخص.`;
  const wa = await sendWA(nPhone, msg);

  // إذا لم يُرسَل OTP عبر WhatsApp → فعِّل الحساب تلقائياً
  let autoActivated = false;
  if (!wa.sent) {
    try {
      const act = await gas('activateUser', { phone: nPhone });
      autoActivated = act.ok;
    } catch { /* تجاهل */ }
  }

  // إشعار المدير بتسجيل مستخدم جديد
  try {
    const adminPhone = await getWaAdmin();
    if (adminPhone && adminPhone !== nPhone) {
      const status = autoActivated ? 'مفعّل تلقائياً' : 'ينتظر الموافقة';
      const adminMsg = `📋 *مستخدم جديد*\nالاسم: ${fullName.trim()}\nالهاتف: ${nPhone}\nالحالة: ${status}\n\nراجع لوحة الإدارة للموافقة.`;
      await sendWA(adminPhone, adminMsg);
    }
  } catch { /* تجاهل خطأ إشعار المدير */ }

  return ok(
    { phone: nPhone, whatsappSent: wa.sent, autoActivated },
    wa.sent
      ? 'تم إرسال رمز التحقق عبر WhatsApp'
      : (autoActivated
          ? 'تم التسجيل والتفعيل — يمكنك تسجيل الدخول الآن'
          : 'تم التسجيل — تواصل مع المدير لتفعيل الحساب')
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

  if (purpose === 'REGISTER') {
    const act = await gas('activateUser', { phone: nPhone });
    if (act.ok) {
      const user = act.user || {};
      const status = act.requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await sendWA(nPhone, `مرحبًا ${user.fullName || ''}،\nتم تأكيد رقم هاتفك وإنشاء حسابك بنجاح.\nيمكنك الآن تسجيل الدخول باستخدام رقم هاتفك وكلمة المرور التي اخترتها.`);
      } else {
        const WA_ADMIN = await getWaAdmin();
        if (WA_ADMIN) {
          await sendWA(WA_ADMIN, `🔔 طلب تسجيل جديد:\nالاسم: ${user.fullName}\nالهاتف: ${nPhone}\nالدور: ${user.roleId}\nيحتاج موافقة المدير.`);
        }
      }
      return ok({ verified: true, requiresApproval: act.requiresApproval },
        act.requiresApproval ? 'تم التحقق — طلبك قيد مراجعة المدير' : 'تم التحقق وتفعيل الحساب');
    }
  }

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

  // ── مدير الإعدادات: يُتحقق منه هنا فقط، لا يصل لـ Sheets ────
  if (SETTINGS_ADMIN && nPhone === SETTINGS_ADMIN && SETTINGS_PIN) {
    const pwBuf  = Buffer.from(password);
    const pinBuf = Buffer.from(SETTINGS_PIN);
    if (pwBuf.length !== pinBuf.length || !crypto.timingSafeEqual(pwBuf, pinBuf)) {
      return fail('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
    }
    const token = signJWT({
      userId:   'settings_admin',
      phone:    SETTINGS_ADMIN,
      fullName: 'مدير الإعدادات',
      roleId:   'settings_admin',
      roleName: 'مدير الإعدادات'
    }, 24);
    return ok({
      token,
      fullName:           'مدير الإعدادات',
      phone:              SETTINGS_ADMIN,
      roleId:             'settings_admin',
      roleName:           'مدير الإعدادات',
      mustChangePassword: false,
      expiresAt:          new Date(Date.now() + 24 * 3600000).toISOString()
    });
  }

  const r = await gas('getUserForAuth', { phone: nPhone });
  if (!r.ok || !r.user) {
    hashPassword('dummy', newSalt());
    return fail('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
  }

  const u = r.user;

  const statusErrors = {
    PENDING_VERIFICATION: ['PHONE_NOT_VERIFIED', 'يجب التحقق من رقم هاتفك أولاً'],
    PENDING_APPROVAL:     ['PENDING_APPROVAL',   'حسابك قيد مراجعة المدير'],
    SUSPENDED:            ['ACCOUNT_SUSPENDED',  'حسابك موقوف، تواصل مع المدير'],
    REJECTED:             ['ACCOUNT_REJECTED',   'تم رفض طلب حسابك']
  };
  if (statusErrors[u.status]) return fail(...statusErrors[u.status]);

  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(u.lockedUntil) - Date.now()) / 60000);
    return fail('ACCOUNT_LOCKED', `الحساب مقفل مؤقتاً، حاول بعد ${mins} دقيقة`);
  }

  let valid = verifyPassword(password, u.salt, u.passwordHash);

  if (!valid) {
    const oldHash = legacyHash(u.salt, password);
    if (oldHash === u.passwordHash) {
      valid = true;
      const ns = newSalt();
      const nh = hashPassword(password, ns);
      await gas('updatePasswordHash', { phone: nPhone, passwordHash: nh, salt: ns });
    }
  }

  if (!valid) {
    await gas('recordFailedLogin', { phone: nPhone });
    return fail('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
  }

  await gas('recordSuccessLogin', { phone: nPhone });

  const sessionHours = parseInt(r.sessionHours) || 12;
  const token = signJWT({
    userId:   u.userId,
    phone:    nPhone,
    fullName: u.fullName,
    roleId:   u.roleId,
    roleName: u.roleName
  }, sessionHours);

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
//  syncApiSecret — تزامن السر المشترك (settings_admin فقط)
//  يُحدِّث API_SHARED_SECRET في جداول Apps Script وNetlify معاً
// ═══════════════════════════════════════════════════════════════
async function doSyncApiSecret(b, token) {
  const p = verifyJWT(token);
  if (!p || p.roleId !== 'settings_admin')
    return fail('FORBIDDEN', 'هذا الإجراء متاح لمدير الإعدادات فقط');

  const { newSecret, confirmSecret } = b;
  if (!newSecret || newSecret.length < 16)
    return fail('TOO_SHORT', 'السر يجب أن يكون 16 حرفاً على الأقل');
  if (newSecret !== confirmSecret)
    return fail('MISMATCH', 'السران غير متطابقان');
  if (newSecret === 'CHANGE_ME_STRONG_SECRET')
    return fail('DEFAULT_SECRET', 'لا تستخدم السر الافتراضي');

  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID       || '';
  const NETLIFY_TOKEN   = process.env.NETLIFY_ACCESS_TOKEN  || '';
  const DEPLOY_HOOK     = process.env.NETLIFY_DEPLOY_HOOK   || '';

  // 1. تحديث API_SHARED_SECRET في ورقة Settings عبر إجراء خاص
  const gasRes = await gas('syncSecretGas', { newSecret });
  if (!gasRes.ok && !gasRes.success)
    return fail('GAS_ERROR', gasRes.message || 'فشل تحديث السر في جداول البيانات');

  // 2. تحديث APPS_SCRIPT_SHARED_SECRET في Netlify عبر API
  let netlifyUpdated = false;
  if (NETLIFY_SITE_ID && NETLIFY_TOKEN) {
    try {
      const nr = await fetch(
        `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/env`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NETLIFY_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            key: 'APPS_SCRIPT_SHARED_SECRET',
            scopes: ['functions', 'builds', 'runtime'],
            values: [{ value: newSecret, context: 'all' }]
          }]),
          signal: AbortSignal.timeout(15000)
        }
      );
      netlifyUpdated = nr.ok;
    } catch { /* Netlify API غير متاح */ }
  }

  // 3. إطلاق إعادة النشر عبر Deploy Hook أو Netlify Builds API
  let redeploying = false;
  if (DEPLOY_HOOK) {
    try {
      await fetch(DEPLOY_HOOK, { method: 'POST', signal: AbortSignal.timeout(10000) });
      redeploying = true;
    } catch {}
  } else if (NETLIFY_SITE_ID && NETLIFY_TOKEN && netlifyUpdated) {
    try {
      await fetch(
        `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/builds`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000)
        }
      );
      redeploying = true;
    } catch {}
  }

  // إن لم تكن Netlify API مهيأة — أعِد السر للنسخ اليدوي
  if (!netlifyUpdated && !DEPLOY_HOOK) {
    return ok(
      { netlifyUpdated: false, redeploying: false, newSecret },
      'تم تحديث جداول البيانات — انسخ السر الجديد وحدِّثه يدوياً في Netlify'
    );
  }

  return ok(
    { netlifyUpdated, redeploying },
    redeploying
      ? 'تم تحديث السر — سيُعاد تشغيل الموقع خلال دقيقتين'
      : 'تم تحديث السر في جداول البيانات وNetlify'
  );
}

// ═══════════════════════════════════════════════════════════════
//  updateNetlifyEnv — تحديث متغيرات Netlify من لوحة المدير
// ═══════════════════════════════════════════════════════════════
async function doTestGasConnection(b, token) {
  const p = verifyJWT(token);
  if (!p || !['settings_admin','admin','super_admin'].includes(p.roleId))
    return fail('FORBIDDEN', 'غير مصرح');

  const testUrl = (b.url || '').trim() || GAS_URL;
  if (!testUrl) return fail('MISSING_URL', 'أدخل رابط Apps Script أولاً');
  if (!testUrl.includes('script.google.com'))
    return fail('INVALID_URL', 'الرابط يجب أن يكون من script.google.com');

  try {
    const res = await fetch(testUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action: 'getStats' }),
      signal:  AbortSignal.timeout(20000)
    });
    if (!res.ok) return fail('HTTP_ERROR', `Apps Script أعاد: HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok) {
      return ok({
        connected: true,
        stats: data.stats || {},
        url: testUrl
      }, `✅ الاتصال ناجح — ${data.stats?.totalUsers ?? '?'} مستخدم، ${data.stats?.totalProjects ?? '?'} مشروع`);
    }
    return fail('GAS_ERROR', data.message || 'Apps Script أعاد استجابة غير متوقعة');
  } catch (e) {
    if (e.name === 'TimeoutError') return fail('TIMEOUT', 'انتهت مهلة الاتصال (20 ثانية) — تحقق من النشر كـ Anyone');
    return fail('CONNECTION_FAILED', `تعذر الاتصال: ${e.message}`);
  }
}

async function doUpdateNetlifyEnv(b, token) {
  const p = verifyJWT(token);
  if (!p || p.roleId !== 'settings_admin')
    return fail('FORBIDDEN', 'هذا الإجراء متاح لمدير الإعدادات فقط');

  const BLOCKED = new Set([
    'SETTINGS_SESSION_SECRET','AUTH_PASSWORD_PEPPER','AUTH_OTP_SECRET',
    'SETTINGS_ADMIN_ACCOUNT','SETTINGS_ADMIN_PIN','API_SHARED_SECRET'
  ]);

  const { vars } = b;
  if (!vars || typeof vars !== 'object' || Object.keys(vars).length === 0)
    return fail('MISSING_FIELDS', 'لا توجد متغيرات للحفظ');

  for (const key of Object.keys(vars)) {
    if (BLOCKED.has(key))
      return fail('FORBIDDEN', `لا يمكن تغيير ${key} من هنا لأسباب أمنية`);
  }

  const savedKeys = [];

  // ── 1. إذا أُرسِل APPS_SCRIPT_URL → حفظه في Netlify Blobs أولاً ──
  const newGasUrl = String(vars.APPS_SCRIPT_URL || '').trim();
  if (newGasUrl) {
    if (!newGasUrl.includes('script.google.com'))
      return fail('INVALID_URL', 'رابط Apps Script يجب أن يكون من script.google.com');
    try {
      await cfgStore().set('APPS_SCRIPT_URL', newGasUrl);
      GAS_URL_BLOB = newGasUrl;   // تحديث الكاش الداخلي فوراً
      savedKeys.push('APPS_SCRIPT_URL');
    } catch (e) {
      if (e.message === 'BLOBS_NOT_CONFIGURED') {
        return fail('BLOBS_NOT_CONFIGURED',
          'أضف NETLIFY_ACCESS_TOKEN في Netlify → Environment Variables مرة واحدة فقط (من User Settings → Personal access tokens)');
      }
      return fail('STORE_ERROR', `فشل حفظ الرابط: ${e.message}`);
    }
  }

  // ── 2. تحقق من وجود رابط للاتصال بـ Apps Script ──────────────
  const url = await getGasUrl();
  if (!url)
    return fail('NOT_CONFIGURED', 'أدخل رابط Apps Script أولاً في حقل APPS_SCRIPT_URL');

  // ── 3. حفظ بقية المتغيرات في Apps Script Script Properties ───
  const otherVars = Object.entries(vars).filter(([k]) => k !== 'APPS_SCRIPT_URL');
  if (otherVars.length > 0) {
    try {
      const configs = {};
      for (const [k, v] of otherVars) {
        if (String(v).trim()) configs[k] = String(v);
      }
      if (Object.keys(configs).length > 0) {
        const r = await gas('saveConfig', { configs });
        if (!r?.ok) return fail('GAS_ERROR', 'فشل الحفظ في Apps Script');
        savedKeys.push(...(r.saved || Object.keys(configs)));
        _rcache = null; _rcacheAt = 0;
      }
    } catch (e) {
      return fail('GAS_ERROR', `فشل الحفظ: ${e.message}`);
    }
  }

  return ok(
    { updatedKeys: savedKeys, redeploying: false },
    `✅ تم حفظ ${savedKeys.length} إعداد — يعمل فوراً لجميع المتصفحات`
  );
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
  'getProfile','updateProfile','getCrops','getProjects','getRegions','getStats',
  'getDashboard','updateCropPrice','updateUserStatus','getAuditLog','getRoles',
  'updateSetting','getSettings','volunteerRegister'
]);

async function doProxy(b, token) {
  const p = verifyJWT(token);
  const { action, ...rest } = b;

  if (ADMIN_ACTIONS.has(action)) {
    if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');
    if (!['admin','super_admin','settings_admin'].includes(p.roleId)) return fail('FORBIDDEN', 'ليس لديك صلاحية');
  } else if (AUTH_ACTIONS.has(action)) {
    if (!p) return fail('UNAUTHORIZED', 'يجب تسجيل الدخول');
  }

  const r = await gas(action, { ...rest, _userId: p?.userId, _roleId: p?.roleId, _phone: p?.phone });

  if (r.ok || r.success) return ok(r.data ?? r, r.message || 'تمت العملية');
  return fail(r.error || r.code || 'ERROR', r.message || 'خطأ في العملية');
}
