// ═══════════════════════════════════════════════════════════════
//  السودان الأخضر — Code.gs  v2.1
//  Google Apps Script API — ملف واحد كامل
//  يستقبل طلبات من Netlify Function فقط (عبر API_SHARED_SECRET)
// ═══════════════════════════════════════════════════════════════

// ── § 1  تعريف التطبيق وإصدار المخطط ─────────────────────────
const APP_NAME       = 'السودان الأخضر';
const APP_VER        = '2.1.0';
const APP_ID         = 'SUDAN_GREEN_V2';
const SCHEMA_VERSION = 2;

// ── § 2  Script Properties ────────────────────────────────────
function getProps_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return {
    API_SHARED_SECRET: p.API_SHARED_SECRET || '',
    PASSWORD_PEPPER:   p.PASSWORD_PEPPER   || '',
    SPREADSHEET_ID:    p.SPREADSHEET_ID    || '',
    APP_ID:            p.APP_ID            || APP_ID,
    SCHEMA_VERSION:    parseInt(p.SCHEMA_VERSION || '1'),
  };
}

// السر المشترك يُقرأ من Script Properties فقط — لا يُخزَّن في Sheets
function getApiSecret_() {
  return getProps_().API_SHARED_SECRET;
}

// ═══════════════════════════════════════════════════════════════
//  doGet / doPost
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  return jsonOut({ ok: true, app: APP_NAME, version: APP_VER });
}

function doPost(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  try {
    const body   = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data   = JSON.parse(body);
    const action = data.action || p.action || '';

    ensureSheets_();

    // التحقق من السر (يُعفى منه: init, getStats, getCrops, getProjects, getRegions)
    const publicActions = new Set(['getStats','getCrops','getProjects','getRegions','doGet']);
    if (!publicActions.has(action)) {
      const secret = getApiSecret_();
      if (secret && data._secret !== secret) {
        return jsonOut({ ok: false, error: 'FORBIDDEN', message: 'Unauthorized' });
      }
    }

    switch (action) {
      // ── التحقق
      case 'checkPhone':          return jsonOut(checkPhone_(data));
      case 'savePendingUser':     return jsonOut(savePendingUser_(data));
      case 'saveOTP':             return jsonOut(saveOTP_(data));
      case 'verifyAndConsumeOTP': return jsonOut(verifyAndConsumeOTP_(data));
      case 'activateUser':        return jsonOut(activateUser_(data));
      case 'saveResetToken':      return jsonOut(saveResetToken_(data));
      case 'verifyResetToken':    return jsonOut(verifyResetToken_(data));

      // ── المصادقة
      case 'getUserForAuth':      return jsonOut(getUserForAuth_(data));
      case 'getUser':             return jsonOut(getUser_(data));
      case 'recordFailedLogin':   return jsonOut(recordFailedLogin_(data));
      case 'recordSuccessLogin':  return jsonOut(recordSuccessLogin_(data));
      case 'updatePasswordHash':  return jsonOut(updatePasswordHash_(data));

      // ── الملف الشخصي
      case 'getProfile':          return jsonOut(getProfile_(data));
      case 'updateProfile':       return jsonOut(updateProfile_(data));

      // ── المستخدمون (admin)
      case 'getUsers':            return jsonOut(getUsers_(data));
      case 'approveUser':         return jsonOut(approveUser_(data));
      case 'rejectUser':          return jsonOut(rejectUser_(data));
      case 'updateUserRole':      return jsonOut(updateUserRole_(data));
      case 'suspendUser':         return jsonOut(suspendUser_(data));
      case 'activateUserAdmin':   return jsonOut(activateUserAdmin_(data));
      case 'exportUsers':         return jsonOut(exportUsers_(data));

      // ── الأدوار
      case 'getRoles':            return jsonOut(getRoles_(data));
      case 'getRoleById':         return jsonOut(getRoleById_(data));
      case 'createRole':          return jsonOut(createRole_(data));
      case 'updateRole':          return jsonOut(updateRole_(data));

      // ── الإعدادات
      case 'getSettings':         return jsonOut(getSettings_(data));
      case 'updateSettings':      return jsonOut(updateSettings_(data));
      case 'saveApiUrl':          return jsonOut(saveApiUrl_(data));

      // ── سجل التدقيق
      case 'writeAuditLog':       return jsonOut(writeAuditLog_(data));
      case 'getAuditLog':         return jsonOut(getAuditLog_(data));

      // ── المحاصيل والبيانات الزراعية (موجودة سابقاً)
      case 'getCrops':            return jsonOut(getCrops_(data));
      case 'updateCrop':          return jsonOut(updateCrop_(data));
      case 'addCrop':             return jsonOut(addCrop_(data));
      case 'getProjects':         return jsonOut(getProjects_(data));
      case 'addProject':          return jsonOut(addProject_(data));
      case 'updateProject':       return jsonOut(updateProject_(data));
      case 'getRegions':          return jsonOut(getRegions_(data));
      case 'getStats':            return jsonOut(getStats_(data));
      case 'broadcast':           return jsonOut(broadcast_(data));

      default:
        return jsonOut({ ok: false, error: 'UNKNOWN_ACTION', action });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonOut({ ok: false, error: 'INTERNAL_ERROR', message: err.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════
//  § 3  setup — تُشغَّل يدوياً مرة واحدة لمنح الصلاحيات
// ═══════════════════════════════════════════════════════════════
function setup() {
  ensureSheets_();
  // تعيين القيم الافتراضية لـ Script Properties إن لم تكن موجودة
  const sp = PropertiesService.getScriptProperties();
  const existing = sp.getProperties();
  const defaults = {
    API_SHARED_SECRET: existing.API_SHARED_SECRET || 'CHANGE_ME',
    PASSWORD_PEPPER:   existing.PASSWORD_PEPPER   || 'CHANGE_ME',
    SCHEMA_VERSION:    String(SCHEMA_VERSION),
    APP_ID:            APP_ID,
    SPREADSHEET_ID:    SpreadsheetApp.getActiveSpreadsheet().getId(),
  };
  sp.setProperties(defaults, false); // false = لا تحذف الموجود
  Logger.log('setup() complete — APP_ID: ' + APP_ID + ' — SCHEMA_VERSION: ' + SCHEMA_VERSION);
  return jsonOut({ ok: true, app: APP_ID, schema: SCHEMA_VERSION });
}

// ═══════════════════════════════════════════════════════════════
//  ensureSheets_ — إنشاء الأوراق تلقائياً (آمن وقابل للتكرار)
// ═══════════════════════════════════════════════════════════════
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const defs = {
    'Users': [
      'userId','phone','passwordHash','salt','fullName','roleId',
      'status','phoneVerified','mustChangePassword',
      'failedLoginCount','lockedUntil',
      'approvedBy','approvedAt','notes',
      'createdAt','lastLoginAt'
    ],
    'Roles': [
      'roleId','roleNameAr','roleNameEn','permissions',
      'publicRegistration','requiresApproval','active','createdAt'
    ],
    'OTP': [
      'otpId','phone','purpose','otpHash','expiresAt',
      'attempts','used','createdAt'
    ],
    'ResetTokens': [
      'phone','resetHash','expiresAt','used'
    ],
    'Sessions': [
      'sessionId','userId','phone','fullName','roleId',
      'createdAt','expiresAt','revoked'
    ],
    'Settings': ['key','value','encrypted','updatedAt','updatedBy'],
    'AuditLog': [
      'logId','userId','action','targetType','targetId',
      'details','createdAt'
    ],
    // الأوراق الزراعية (كما هي)
    'Crops': [
      'CropID','NameAr','NameEn','Region','PriceToday','PriceYesterday',
      'Unit','Currency','Change','ChangePercent','UpdatedAt','UpdatedBy'
    ],
    'Projects': [
      'ProjectID','TitleAr','TitleEn','Region','Category','Description',
      'TargetAmount','RaisedAmount','Currency','Status','StartDate',
      'EndDate','CreatedAt','CreatedBy','ImageURL'
    ],
    'Regions': [
      'RegionID','NameAr','NameEn','MainCrops','Area','IrrigationPct',
      'FarmersCount','Color','Lat','Lng'
    ],
    'Investments': [
      'InvID','ProjectID','InvestorID','Amount','Currency','Date','Status','Notes'
    ],
    'Announcements': [
      'AnnID','Title','Message','TargetType','SentAt','SentBy','SentCount','Status'
    ],
    'Schema': ['key','value','updatedAt']
  };

  for (const [name, headers] of Object.entries(defs)) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(headers);
      sh.setFrozenRows(1);
    }
  }

  // إعدادات افتراضية
  const setSheet = ss.getSheetByName('Settings');
  const existing = {};
  setSheet.getDataRange().getValues().forEach(r => { if (r[0]) existing[r[0]] = true; });

  const defaults = {
    'SESSION_HOURS':       '12',
    'MAX_FAILED_ATTEMPTS': '5',
    'LOCKOUT_MINUTES':     '30',
    'OTP_MAX_ATTEMPTS':    '3',
    'OTP_VALIDITY_MINUTES':'5',
    'WHATSAPP_ENABLED':    'false',
    'DEFAULT_CURRENCY':    'SDG',
    'APP_NAME':            APP_NAME,
    'API_URL':             '',
    'MAINTENANCE_MODE':    'false',
    'REGISTER_ENABLED':    'true',
    'DEFAULT_ROLE':        'user'
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (!existing[k]) setSheet.appendRow([k, v, false, new Date().toISOString(), 'system']);
  }

  // أدوار افتراضية
  const rolesSheet = ss.getSheetByName('Roles');
  if (rolesSheet.getLastRow() < 2) {
    const roles = [
      ['user',       'مستخدم عادي', 'User',       '[]', true,  false, true, new Date().toISOString()],
      ['farmer',     'مزارع',       'Farmer',      '[]', true,  false, true, new Date().toISOString()],
      ['employee',   'موظف',        'Employee',    '[]', true,  true,  true, new Date().toISOString()],
      ['supervisor', 'مشرف',        'Supervisor',  '[]', false, false, true, new Date().toISOString()],
      ['admin',      'مدير',        'Admin',       '[]', false, false, true, new Date().toISOString()],
      ['super_admin','مدير أساسي', 'Super Admin', '[]', false, false, true, new Date().toISOString()]
    ];
    roles.forEach(r => rolesSheet.appendRow(r));
  }

  // بيانات زراعية افتراضية
  const crops = ss.getSheetByName('Crops');
  if (crops.getLastRow() < 2) {
    [
      ['C001','سمسم كسلا','Kassala Sesame','كسلا',225000,207500,'طن','SDG','+17500','+8.4%',new Date().toISOString(),'system'],
      ['C002','ذرة الجزيرة','Gezira Sorghum','الجزيرة',85000,82400,'طن','SDG','+2600','+3.1%',new Date().toISOString(),'system'],
      ['C003','فول سوداني','Kordofan Groundnuts','كردفان',190000,192295,'طن','SDG','-2295','-1.2%',new Date().toISOString(),'system'],
      ['C004','قمح الشمالية','Northern Wheat','الشمالية',140000,132453,'طن','SDG','+7547','+5.7%',new Date().toISOString(),'system'],
      ['C005','صمغ عربي','Gum Arabic','كردفان',312000,299616,'طن','SDG','+12384','+4.1%',new Date().toISOString(),'system'],
    ].forEach(r => crops.appendRow(r));
  }

  const regions = ss.getSheetByName('Regions');
  if (regions.getLastRow() < 2) {
    [
      ['R001','مشروع الجزيرة','Gezira Scheme','قطن·ذرة·قمح','2.1M هكتار','78%',350000,'#22C55E','14.4','33.5'],
      ['R002','ولاية كسلا','Kassala State','سمسم·فول سوداني','800K هكتار','55%',180000,'#F59E0B','15.5','36.4'],
      ['R003','كردفان','Kordofan','فول سوداني·صمغ','3.5M هكتار','30%',420000,'#F97316','12.5','27.0'],
    ].forEach(r => regions.appendRow(r));
  }
}

// ═══════════════════════════════════════════════════════════════
//  checkPhone_ — هل الرقم مسجل؟
// ═══════════════════════════════════════════════════════════════
function checkPhone_(p) {
  const phone = String(p.phone || '');
  const data  = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Users').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);
  const exists = data.slice(1).some(r => r[idx('phone')] === phone);
  return { ok: true, exists };
}

// ═══════════════════════════════════════════════════════════════
//  savePendingUser_ — حفظ مستخدم في انتظار التحقق
// ═══════════════════════════════════════════════════════════════
function savePendingUser_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Users');
    const data = sh.getDataRange().getValues();
    const hdr = data[0]; const idx = c => hdr.indexOf(c);

    // تكرار؟
    if (data.slice(1).some(r => r[idx('phone')] === p.phone)) {
      return { ok: false, error: 'PHONE_EXISTS' };
    }

    const uid = Utilities.getUuid();
    sh.appendRow([
      uid, p.phone, p.passwordHash, p.salt,
      p.fullName, p.roleId, p.status || 'PENDING_VERIFICATION',
      false, false, // phoneVerified, mustChangePassword
      0, '', '', '', '',
      new Date().toISOString(), ''
    ]);

    // حفظ OTP في ورقة OTP
    if (p.otpHash) {
      ss.getSheetByName('OTP').appendRow([
        Utilities.getUuid(), p.phone, 'REGISTER',
        p.otpHash, p.otpExpiry, 0, false,
        new Date().toISOString()
      ]);
    }

    writeAuditLog_({ userId: uid, action: 'REGISTER_PENDING', targetType: 'USER', targetId: uid, details: 'طلب تسجيل جديد' });
    return { ok: true, userId: uid };
  } finally { lock.releaseLock(); }
}

// ═══════════════════════════════════════════════════════════════
//  saveOTP_ — حفظ OTP جديد
// ═══════════════════════════════════════════════════════════════
function saveOTP_(p) {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sh     = ss.getSheetByName('OTP');
  const data   = sh.getDataRange().getValues();
  const hdr    = data[0]; const idx = c => hdr.indexOf(c);

  // إلغاء OTP السابق لنفس الرقم والغرض
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] === p.phone &&
        data[i][idx('purpose')] === p.purpose &&
        !data[i][idx('used')]) {
      sh.getRange(i + 1, idx('used') + 1).setValue(true);
    }
  }

  // البحث عن بيانات المستخدم (للاسم)
  const usersData = ss.getSheetByName('Users').getDataRange().getValues();
  const uHdr = usersData[0]; const uIdx = c => uHdr.indexOf(c);
  const user = usersData.slice(1).find(r => r[uIdx('phone')] === p.phone);

  sh.appendRow([
    Utilities.getUuid(), p.phone, p.purpose,
    p.otpHash, p.otpExpiry, 0, false,
    new Date().toISOString()
  ]);

  return { ok: true, fullName: user ? user[uIdx('fullName')] : '' };
}

// ═══════════════════════════════════════════════════════════════
//  verifyAndConsumeOTP_ — التحقق من OTP واستهلاكه
// ═══════════════════════════════════════════════════════════════
function verifyAndConsumeOTP_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('OTP');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  const maxAttempts = parseInt(getSetting_('OTP_MAX_ATTEMPTS')) || 3;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[idx('phone')] !== p.phone) continue;
    if (r[idx('purpose')] !== p.purpose) continue;
    if (r[idx('used')]) continue;

    // انتهت الصلاحية؟
    if (r[idx('expiresAt')] && new Date(r[idx('expiresAt')]) < new Date()) {
      return { ok: false, error: 'OTP_EXPIRED' };
    }

    // تجاوز المحاولات؟
    const attempts = parseInt(r[idx('attempts')]) || 0;
    if (attempts >= maxAttempts) return { ok: false, error: 'OTP_MAX_ATTEMPTS' };

    // التحقق من الرمز
    if (r[idx('otpHash')] !== p.otpHash) {
      sh.getRange(i + 1, idx('attempts') + 1).setValue(attempts + 1);
      return { ok: false, error: 'OTP_INVALID' };
    }

    // استهلاك OTP
    sh.getRange(i + 1, idx('used') + 1).setValue(true);
    return { ok: true };
  }

  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  activateUser_ — تفعيل المستخدم بعد التحقق من الهاتف
// ═══════════════════════════════════════════════════════════════
function activateUser_(p) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;

    // الدور يحتاج موافقة؟
    const roleId = data[i][idx('roleId')];
    const roleR  = getRoleById_({ roleId });
    const requiresApproval = roleR.role?.requiresApproval || false;
    const newStatus = requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE';

    sh.getRange(i + 1, idx('phoneVerified') + 1).setValue(true);
    sh.getRange(i + 1, idx('status')        + 1).setValue(newStatus);

    const user = {
      userId:   data[i][idx('userId')],
      fullName: data[i][idx('fullName')],
      phone:    p.phone,
      roleId,
      status:   newStatus
    };

    if (newStatus === 'ACTIVE') {
      writeAuditLog_({ userId: user.userId, action: 'ACCOUNT_ACTIVATED', targetType: 'USER', targetId: user.userId, details: 'تفعيل تلقائي بعد OTP' });
    } else {
      writeAuditLog_({ userId: user.userId, action: 'PENDING_APPROVAL', targetType: 'USER', targetId: user.userId, details: 'في انتظار موافقة المدير' });
    }

    return { ok: true, user, requiresApproval };
  }

  return { ok: false, error: 'USER_NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  saveResetToken_ / verifyResetToken_
// ═══════════════════════════════════════════════════════════════
function saveResetToken_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('ResetTokens');
  const data = sh.getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);

  // إلغاء القديمة
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] === p.phone && !data[i][idx('used')]) {
      sh.getRange(i + 1, idx('used') + 1).setValue(true);
    }
  }

  sh.appendRow([p.phone, p.resetHash, p.expiresAt, false]);
  return { ok: true };
}

function verifyResetToken_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ResetTokens');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;
    if (data[i][idx('used')]) continue;
    if (data[i][idx('resetHash')] !== p.resetHash) continue;
    if (new Date(data[i][idx('expiresAt')]) < new Date()) return { ok: false, error: 'TOKEN_EXPIRED' };

    sh.getRange(i + 1, idx('used') + 1).setValue(true);
    return { ok: true };
  }

  return { ok: false, error: 'TOKEN_INVALID' };
}

// ═══════════════════════════════════════════════════════════════
//  getUserForAuth_ — للتحقق من تسجيل الدخول (يُرجع الهاش)
// ═══════════════════════════════════════════════════════════════
function getUserForAuth_(p) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName('Users').getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;

    const roleId  = data[i][idx('roleId')];
    const roleR   = getRoleById_({ roleId });

    return {
      ok: true,
      user: {
        userId:            data[i][idx('userId')],
        phone:             data[i][idx('phone')],
        passwordHash:      data[i][idx('passwordHash')],
        salt:              data[i][idx('salt')],
        fullName:          data[i][idx('fullName')],
        roleId,
        roleName:          roleR.role?.roleNameAr || roleId,
        status:            data[i][idx('status')],
        phoneVerified:     data[i][idx('phoneVerified')],
        mustChangePassword:data[i][idx('mustChangePassword')],
        failedLoginCount:  data[i][idx('failedLoginCount')],
        lockedUntil:       data[i][idx('lockedUntil')]
      },
      sessionHours: getSetting_('SESSION_HOURS') || '12'
    };
  }

  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  getUser_ — بيانات المستخدم الآمنة (بدون هاش)
// ═══════════════════════════════════════════════════════════════
function getUser_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Users').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone && data[i][idx('userId')] !== p.userId) continue;
    const roleId = data[i][idx('roleId')];
    const roleR  = getRoleById_({ roleId });
    return {
      ok: true,
      user: {
        userId:      data[i][idx('userId')],
        phone:       data[i][idx('phone')],
        fullName:    data[i][idx('fullName')],
        roleId,
        roleName:    roleR.role?.roleNameAr || roleId,
        status:      data[i][idx('status')],
        phoneVerified:data[i][idx('phoneVerified')],
        mustChangePassword: data[i][idx('mustChangePassword')],
        createdAt:   data[i][idx('createdAt')],
        lastLoginAt: data[i][idx('lastLoginAt')]
      }
    };
  }

  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  recordFailedLogin_ / recordSuccessLogin_
// ═══════════════════════════════════════════════════════════════
function recordFailedLogin_(p) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  const max  = parseInt(getSetting_('MAX_FAILED_ATTEMPTS')) || 5;
  const mins = parseInt(getSetting_('LOCKOUT_MINUTES'))    || 30;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;
    const fails = (parseInt(data[i][idx('failedLoginCount')]) || 0) + 1;
    sh.getRange(i + 1, idx('failedLoginCount') + 1).setValue(fails);
    if (fails >= max) {
      const until = new Date(Date.now() + mins * 60000).toISOString();
      sh.getRange(i + 1, idx('lockedUntil') + 1).setValue(until);
    }
    writeAuditLog_({ userId: data[i][idx('userId')], action: 'LOGIN_FAILED', targetType: 'USER', targetId: data[i][idx('userId')], details: `محاولة فاشلة ${fails}` });
    return { ok: true };
  }
  return { ok: false };
}

function recordSuccessLogin_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;
    sh.getRange(i + 1, idx('failedLoginCount') + 1).setValue(0);
    sh.getRange(i + 1, idx('lockedUntil')      + 1).setValue('');
    sh.getRange(i + 1, idx('lastLoginAt')      + 1).setValue(new Date().toISOString());
    return { ok: true };
  }
  return { ok: false };
}

// ═══════════════════════════════════════════════════════════════
//  updatePasswordHash_
// ═══════════════════════════════════════════════════════════════
function updatePasswordHash_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p.phone) continue;
    sh.getRange(i + 1, idx('passwordHash')      + 1).setValue(p.passwordHash);
    sh.getRange(i + 1, idx('salt')              + 1).setValue(p.salt);
    sh.getRange(i + 1, idx('mustChangePassword')+ 1).setValue(false);

    if (p.revokeAllSessions) {
      // حذف جميع جلسات المستخدم
      const sessSh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
      const sessData = sessSh.getDataRange().getValues();
      const sHdr     = sessData[0]; const sIdx = c => sHdr.indexOf(c);
      const uid = data[i][idx('userId')];
      for (let j = sessData.length - 1; j >= 1; j--) {
        if (sessData[j][sIdx('userId')] === uid) sessSh.deleteRow(j + 1);
      }
    }

    writeAuditLog_({ userId: data[i][idx('userId')], action: 'PASSWORD_UPDATED', targetType: 'USER', targetId: data[i][idx('userId')], details: 'تحديث كلمة المرور' });
    return { ok: true };
  }

  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  getUsers_ — قائمة المستخدمين (للمدير)
// ═══════════════════════════════════════════════════════════════
function getUsers_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };

  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Users').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);

  const safe = ['userId','phone','fullName','roleId','status','phoneVerified',
                'failedLoginCount','lockedUntil','approvedBy','approvedAt',
                'notes','createdAt','lastLoginAt'];

  const users = data.slice(1).map(r => {
    const obj = {}; safe.forEach(f => { obj[f] = r[idx(f)]; });
    const roleR = getRoleById_({ roleId: obj.roleId });
    obj.roleName = roleR.role?.roleNameAr || obj.roleId;
    return obj;
  });

  // فلترة
  let result = users;
  if (p.status) result = result.filter(u => u.status === p.status);
  if (p.roleId) result = result.filter(u => u.roleId === p.roleId);
  if (p.q) {
    const q = p.q.toLowerCase();
    result = result.filter(u =>
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.phone   || '').includes(q)
    );
  }

  return { ok: true, users: result, total: result.length };
}

// ═══════════════════════════════════════════════════════════════
//  approveUser_ / rejectUser_
// ═══════════════════════════════════════════════════════════════
function approveUser_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };

  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('userId')] !== p.targetUserId) continue;
    sh.getRange(i + 1, idx('status')     + 1).setValue('ACTIVE');
    sh.getRange(i + 1, idx('approvedBy') + 1).setValue(p._userId);
    sh.getRange(i + 1, idx('approvedAt') + 1).setValue(new Date().toISOString());
    if (p.notes) sh.getRange(i + 1, idx('notes') + 1).setValue(p.notes);

    writeAuditLog_({ userId: p._userId, action: 'APPROVE_USER', targetType: 'USER', targetId: p.targetUserId, details: `موافقة على الحساب` });
    return { ok: true, user: { userId: data[i][idx('userId')], phone: data[i][idx('phone')], fullName: data[i][idx('fullName')] } };
  }

  return { ok: false, error: 'USER_NOT_FOUND' };
}

function rejectUser_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };

  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('userId')] !== p.targetUserId) continue;
    sh.getRange(i + 1, idx('status') + 1).setValue('REJECTED');
    if (p.notes) sh.getRange(i + 1, idx('notes') + 1).setValue(p.notes);
    writeAuditLog_({ userId: p._userId, action: 'REJECT_USER', targetType: 'USER', targetId: p.targetUserId, details: p.reason || 'رفض الطلب' });
    return { ok: true };
  }

  return { ok: false, error: 'USER_NOT_FOUND' };
}

function updateUserRole_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('userId')] !== p.targetUserId) continue;
    // لا تسمح بتغيير دور المدير الأساسي إلا بإذن خاص
    if (data[i][idx('roleId')] === 'super_admin' && p._roleId !== 'super_admin') {
      return { ok: false, error: 'CANNOT_CHANGE_SUPER_ADMIN' };
    }
    const old = data[i][idx('roleId')];
    sh.getRange(i + 1, idx('roleId') + 1).setValue(p.roleId);
    writeAuditLog_({ userId: p._userId, action: 'UPDATE_ROLE', targetType: 'USER', targetId: p.targetUserId, details: `${old} → ${p.roleId}` });
    return { ok: true };
  }
  return { ok: false, error: 'USER_NOT_FOUND' };
}

function suspendUser_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  return setUserStatus_(p, 'SUSPENDED', 'SUSPEND_USER');
}

function activateUserAdmin_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  return setUserStatus_(p, 'ACTIVE', 'ACTIVATE_USER');
}

function setUserStatus_(p, status, action) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('userId')] !== p.targetUserId) continue;
    if (data[i][idx('roleId')] === 'super_admin') return { ok: false, error: 'CANNOT_MODIFY_SUPER_ADMIN' };
    sh.getRange(i + 1, idx('status') + 1).setValue(status);
    writeAuditLog_({ userId: p._userId, action, targetType: 'USER', targetId: p.targetUserId, details: status });
    return { ok: true };
  }
  return { ok: false, error: 'USER_NOT_FOUND' };
}

function exportUsers_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  return getUsers_(p);
}

// ═══════════════════════════════════════════════════════════════
//  الملف الشخصي
// ═══════════════════════════════════════════════════════════════
function getProfile_(p) {
  return getUser_({ phone: p._phone, userId: p._userId });
}

function updateProfile_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('phone')] !== p._phone) continue;
    if (p.fullName) sh.getRange(i + 1, idx('fullName') + 1).setValue(p.fullName);
    return { ok: true };
  }
  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  الأدوار
// ═══════════════════════════════════════════════════════════════
function getRoles_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Roles').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);

  let roles = data.slice(1).map(r => ({
    roleId:             r[idx('roleId')],
    roleNameAr:         r[idx('roleNameAr')],
    roleNameEn:         r[idx('roleNameEn')],
    publicRegistration: r[idx('publicRegistration')],
    requiresApproval:   r[idx('requiresApproval')],
    active:             r[idx('active')]
  }));

  if (p.publicOnly) roles = roles.filter(r => r.publicRegistration && r.active);
  else if (!isAdmin_(p._roleId)) roles = roles.filter(r => r.active);

  return { ok: true, roles };
}

function getRoleById_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Roles').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);
  const row = data.slice(1).find(r => r[idx('roleId')] === p.roleId);
  if (!row) return { ok: false, role: null };
  return {
    ok: true,
    role: {
      roleId:             row[idx('roleId')],
      roleNameAr:         row[idx('roleNameAr')],
      roleNameEn:         row[idx('roleNameEn')],
      publicRegistration: row[idx('publicRegistration')],
      requiresApproval:   row[idx('requiresApproval')],
      active:             row[idx('active')]
    }
  };
}

function createRole_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Roles');
  sh.appendRow([
    p.roleId, p.roleNameAr, p.roleNameEn || '',
    '[]', p.publicRegistration || false,
    p.requiresApproval || false, true,
    new Date().toISOString()
  ]);
  writeAuditLog_({ userId: p._userId, action: 'CREATE_ROLE', targetType: 'ROLE', targetId: p.roleId, details: p.roleNameAr });
  return { ok: true };
}

function updateRole_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Roles');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('roleId')] !== p.roleId) continue;
    if (p.roleNameAr !== undefined) sh.getRange(i + 1, idx('roleNameAr') + 1).setValue(p.roleNameAr);
    if (p.publicRegistration !== undefined) sh.getRange(i + 1, idx('publicRegistration') + 1).setValue(p.publicRegistration);
    if (p.requiresApproval !== undefined) sh.getRange(i + 1, idx('requiresApproval') + 1).setValue(p.requiresApproval);
    if (p.active !== undefined) sh.getRange(i + 1, idx('active') + 1).setValue(p.active);
    writeAuditLog_({ userId: p._userId, action: 'UPDATE_ROLE', targetType: 'ROLE', targetId: p.roleId, details: 'تعديل دور' });
    return { ok: true };
  }
  return { ok: false, error: 'ROLE_NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  الإعدادات
// ═══════════════════════════════════════════════════════════════
function getSettings_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Settings').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);

  // لا نُرجع أي مفاتيح محجوبة
  const hidden = new Set([]);
  const settings = {};
  data.slice(1).forEach(r => {
    const k = r[idx('key')];
    if (!hidden.has(k)) settings[k] = r[idx('value')];
  });

  return { ok: true, settings };
}

function updateSettings_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  const hidden = new Set([]); // الأسرار في Script Properties فقط

  const updates = p.settings || {};
  for (const [k, v] of Object.entries(updates)) {
    if (hidden.has(k)) continue;
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx('key')] === k) {
        sh.getRange(i + 1, idx('value')     + 1).setValue(v);
        sh.getRange(i + 1, idx('updatedAt') + 1).setValue(new Date().toISOString());
        sh.getRange(i + 1, idx('updatedBy') + 1).setValue(p._userId || 'admin');
        found = true; break;
      }
    }
    if (!found) {
      sh.appendRow([k, v, false, new Date().toISOString(), p._userId || 'admin']);
    }
  }

  writeAuditLog_({ userId: p._userId, action: 'UPDATE_SETTINGS', targetType: 'SETTINGS', targetId: 'global', details: Object.keys(updates).join(', ') });
  return { ok: true };
}

function saveApiUrl_(p) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('key')] === 'API_URL') {
      sh.getRange(i + 1, idx('value') + 1).setValue(p.apiUrl || '');
      return { ok: true };
    }
  }
  sh.appendRow(['API_URL', p.apiUrl || '', false, new Date().toISOString(), 'system']);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  سجل التدقيق
// ═══════════════════════════════════════════════════════════════
function writeAuditLog_(p) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AuditLog').appendRow([
      Utilities.getUuid(),
      p.userId    || '',
      p.action    || '',
      p.targetType|| '',
      p.targetId  || '',
      p.details   || '',
      new Date().toISOString()
    ]);
  } catch(e) { Logger.log('AuditLog error: ' + e); }
  return { ok: true };
}

function getAuditLog_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('AuditLog').getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);
  const logs = data.slice(1).reverse().slice(0, parseInt(p.limit) || 200).map(r =>
    Object.fromEntries(hdr.map((h, i) => [h, r[i]]))
  );
  return { ok: true, logs };
}

// ═══════════════════════════════════════════════════════════════
//  البيانات الزراعية (موجودة سابقاً — محتفظ بها)
// ═══════════════════════════════════════════════════════════════
function getCrops_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Crops').getDataRange().getValues();
  const hdr = data[0];
  return { ok: true, crops: data.slice(1).map(r => Object.fromEntries(hdr.map((h,i)=>[h,r[i]]))) };
}

function updateCrop_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Crops');
  const data = sh.getDataRange().getValues();
  const hdr = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('CropID')] !== p.cropId) continue;
    const old = data[i][idx('PriceToday')];
    const nw  = parseFloat(p.price) || old;
    const chg = nw - parseFloat(data[i][idx('PriceYesterday')]);
    const pct = ((chg / parseFloat(data[i][idx('PriceYesterday')])) * 100).toFixed(1);
    sh.getRange(i+1,idx('PriceYesterday')+1).setValue(old);
    sh.getRange(i+1,idx('PriceToday')+1).setValue(nw);
    sh.getRange(i+1,idx('Change')+1).setValue((chg>=0?'+':'')+chg.toFixed(0));
    sh.getRange(i+1,idx('ChangePercent')+1).setValue((chg>=0?'+':'')+pct+'%');
    sh.getRange(i+1,idx('UpdatedAt')+1).setValue(new Date().toISOString());
    sh.getRange(i+1,idx('UpdatedBy')+1).setValue(p._userId || '');
    return { ok: true };
  }
  return { ok: false, error: 'CROP_NOT_FOUND' };
}

function addCrop_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const id = 'C' + String(Date.now()).slice(-6);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Crops').appendRow([
    id, p.nameAr||'', p.nameEn||'', p.region||'',
    parseFloat(p.price)||0, parseFloat(p.price)||0,
    p.unit||'طن', p.currency||'SDG', '0', '0%',
    new Date().toISOString(), p._userId || ''
  ]);
  return { ok: true, cropId: id };
}

function getProjects_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Projects').getDataRange().getValues();
  const hdr = data[0];
  return { ok: true, projects: data.slice(1).map(r => Object.fromEntries(hdr.map((h,i)=>[h,r[i]]))) };
}

function addProject_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const id = 'P' + String(Date.now()).slice(-6);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Projects').appendRow([
    id, p.titleAr||'', p.titleEn||'', p.region||'', p.category||'',
    p.description||'', parseFloat(p.targetAmount)||0, 0,
    p.currency||'USD', p.status||'active',
    p.startDate||'', p.endDate||'',
    new Date().toISOString(), p._userId || '', p.imageURL||''
  ]);
  return { ok: true, projectId: id };
}

function updateProject_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Projects');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = c => hdr.indexOf(c);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('ProjectID')] !== p.projectId) continue;
    ['TitleAr','TitleEn','Region','Category','Description','TargetAmount','Status','EndDate'].forEach(f => {
      const v = p[f.charAt(0).toLowerCase()+f.slice(1)];
      if (v !== undefined) sh.getRange(i+1,idx(f)+1).setValue(v);
    });
    return { ok: true };
  }
  return { ok: false, error: 'NOT_FOUND' };
}

function getRegions_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Regions').getDataRange().getValues();
  const hdr = data[0];
  return { ok: true, regions: data.slice(1).map(r => Object.fromEntries(hdr.map((h,i)=>[h,r[i]]))) };
}

function getStats_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users    = ss.getSheetByName('Users');
  const projects = ss.getSheetByName('Projects');
  return {
    ok: true,
    stats: {
      totalUsers:    Math.max(0, users.getLastRow() - 1),
      totalProjects: Math.max(0, projects.getLastRow() - 1),
      trees:         250000,
      farmers:       12000,
      hectares:      85000
    }
  };
}

function broadcast_(p) {
  if (!isAdmin_(p._roleId)) return { ok: false, error: 'FORBIDDEN' };
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Announcements').appendRow([
    Utilities.getUuid(), p.title||'', p.message||'',
    p.targetType||'all', new Date().toISOString(), p._userId||'',
    0, 'sent'
  ]);
  writeAuditLog_({ userId: p._userId, action: 'BROADCAST', targetType: 'ANNOUNCEMENT', targetId: 'all', details: p.title });
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  المساعدات
// ═══════════════════════════════════════════════════════════════
function isAdmin_(roleId) {
  return ['admin','super_admin'].includes(roleId);
}

function getSetting_(key) {
  try {
    const data = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('Settings').getDataRange().getValues();
    const hdr = data[0]; const idx = c => hdr.indexOf(c);
    const row = data.slice(1).find(r => r[idx('key')] === key);
    return row ? String(row[idx('value')]) : '';
  } catch { return ''; }
}

function sha256_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    str, Utilities.Charset.UTF_8)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
