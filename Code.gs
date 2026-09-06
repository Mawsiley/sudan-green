// ═══════════════════════════════════════════════════════════════
//  السودان الأخضر — Code.gs  (Apps Script Backend)
//  نمط: Google Sheets قاعدة بيانات + Apps Script API
//  المصادقة: هاتف + كلمة سر (SHA-256) + جلسات + واتساب OTP
// ═══════════════════════════════════════════════════════════════

// ── إعدادات عامة ──────────────────────────────────────────────
const APP_NAME   = 'السودان الأخضر';
const APP_VER    = '1.0.0';
const ADMIN_PHONE = '18251171';   // رقم المدير الافتراضي
const ADMIN_PASS  = '55123';      // كلمة سر المدير الافتراضية (تُغيَّر أول دخول)

// ═══════════════════════════════════════════════════════════════
//  doGet / doPost
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  return jsonOut({ ok: true, app: APP_NAME, version: APP_VER, action: 'get' });
}

function doPost(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  try {
    const body   = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data   = JSON.parse(body);
    const action = data.action || p.action || '';

    ensureSheets_();

    switch (action) {
      // ── Auth
      case 'login':          return jsonOut(login_(data));
      case 'register':       return jsonOut(register_(data));
      case 'logout':         return jsonOut(logout_(data));
      case 'sendOtp':        return jsonOut(sendOtp_(data));
      case 'verifyOtp':      return jsonOut(verifyOtp_(data));
      case 'changePassword': return jsonOut(changePassword_(data));

      // ── المحاصيل والأسعار
      case 'getCrops':       return jsonOut(getCrops_(data));
      case 'updateCrop':     return jsonOut(updateCrop_(data));
      case 'addCrop':        return jsonOut(addCrop_(data));

      // ── المشاريع الاستثمارية
      case 'getProjects':    return jsonOut(getProjects_(data));
      case 'addProject':     return jsonOut(addProject_(data));
      case 'updateProject':  return jsonOut(updateProject_(data));

      // ── المناطق الزراعية
      case 'getRegions':     return jsonOut(getRegions_(data));

      // ── المستخدمون (admin)
      case 'getUsers':       return jsonOut(getUsers_(data));
      case 'updateUser':     return jsonOut(updateUser_(data));

      // ── الإعلانات / واتساب
      case 'broadcast':      return jsonOut(broadcast_(data));

      // ── الإحصائيات والداشبورد
      case 'getStats':       return jsonOut(getStats_(data));

      // ── الملف الشخصي
      case 'getProfile':     return jsonOut(getProfile_(data));
      case 'updateProfile':  return jsonOut(updateProfile_(data));

      // ── الإعدادات (admin)
      case 'getSettings':    return jsonOut(getSettings_(data));
      case 'saveSettings':   return jsonOut(saveSettings_(data));
      case 'saveApiUrl':     return jsonOut(saveApiUrl_(data));

      default:
        return jsonOut({ ok: false, error: 'UNKNOWN_ACTION', action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: err.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════
//  إنشاء الأوراق والإعدادات الافتراضية
// ═══════════════════════════════════════════════════════════════
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = {
    // اسم الورقة : [رؤوس الأعمدة]
    'Users': [
      'UserID','Phone','PasswordHash','Salt','FullName','UserType',
      'Country','CountryCode','Active','FailedAttempts','LockedUntil',
      'MustChangePassword','OtpCode','OtpExpiry','CreatedAt','LastLogin'
    ],
    'Sessions': [
      'Token','UserID','Phone','FullName','UserType','CreatedAt','ExpiresAt'
    ],
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
    'ChangeLog': [
      'Timestamp','UserID','RecordID','Table','Field','OldValue','NewValue'
    ],
    'Settings': ['Key','Value']
  };

  for (const [name, headers] of Object.entries(sheets)) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(headers);
      sh.setFrozenRows(1);
    }
  }

  // ── إعدادات افتراضية
  const setSheet = ss.getSheetByName('Settings');
  const existing = {};
  setSheet.getDataRange().getValues().forEach(r => { if (r[0]) existing[r[0]] = true; });

  const defaults = {
    'SESSION_HOURS':        '12',
    'MAX_FAILED_ATTEMPTS':  '5',
    'LOCKOUT_MINUTES':      '30',
    'WHATSAPP_TOKEN':       '',
    'WHATSAPP_PHONE_ID':    '',
    'WHATSAPP_ENABLED':     'false',
    'LOW_STOCK_THRESHOLD':  '10',
    'DEFAULT_CURRENCY':     'SDG',
    'APP_NAME':             APP_NAME,
    'API_URL':              ''
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (!existing[k]) setSheet.appendRow([k, v]);
  }

  // ── مدير افتراضي
  const users = ss.getSheetByName('Users');
  const allUsers = users.getDataRange().getValues();
  const adminExists = allUsers.some(r => r[1] === ADMIN_PHONE);
  if (!adminExists) {
    const salt = Utilities.getUuid();
    const hash = sha256_(salt + ADMIN_PASS);
    users.appendRow([
      Utilities.getUuid(), ADMIN_PHONE, hash, salt,
      'مدير النظام', 'admin', 'السودان', '249',
      true, 0, '', false, '', '',
      new Date().toISOString(), ''
    ]);
  }

  // ── بيانات المحاصيل الافتراضية
  const crops = ss.getSheetByName('Crops');
  if (crops.getLastRow() < 2) {
    const defaultCrops = [
      ['C001','سمسم كسلا','Kassala Sesame','كسلا',225000,207500,'طن','SDG','+17500','+8.4%',new Date().toISOString(),'system'],
      ['C002','ذرة الجزيرة','Gezira Sorghum','الجزيرة',85000,82400,'طن','SDG','+2600','+3.1%',new Date().toISOString(),'system'],
      ['C003','فول سوداني كردفان','Kordofan Groundnuts','كردفان',190000,192295,'طن','SDG','-2295','-1.2%',new Date().toISOString(),'system'],
      ['C004','قمح الشمالية','Northern Wheat','الشمالية',140000,132453,'طن','SDG','+7547','+5.7%',new Date().toISOString(),'system'],
      ['C005','صمغ عربي','Gum Arabic','كردفان',312000,299616,'طن','SDG','+12384','+4.1%',new Date().toISOString(),'system'],
      ['C006','فلفل النيل الأزرق','Blue Nile Chilli','النيل الأزرق',68000,68545,'طن','SDG','-545','-0.8%',new Date().toISOString(),'system'],
      ['C007','عباد الشمس','Sunflower','الجزيرة',98000,92365,'طن','SDG','+5635','+6.1%',new Date().toISOString(),'system'],
      ['C008','بصل','Onions','نهر النيل',45000,40075,'طن','SDG','+4925','+12.3%',new Date().toISOString(),'system'],
    ];
    defaultCrops.forEach(r => crops.appendRow(r));
  }

  // ── بيانات المناطق الافتراضية
  const regions = ss.getSheetByName('Regions');
  if (regions.getLastRow() < 2) {
    const defaultRegions = [
      ['R001','مشروع الجزيرة','Gezira Scheme','قطن·ذرة·قمح·فول سوداني','2.1M هكتار','78%',350000,'#22C55E','14.4','33.5'],
      ['R002','ولاية كسلا','Kassala State','سمسم·فول سوداني·موز·خضار','800K هكتار','55%',180000,'#F59E0B','15.5','36.4'],
      ['R003','كردفان','Kordofan Region','فول سوداني·صمغ عربي·دخن','3.5M هكتار','30%',420000,'#F97316','12.5','27.0'],
      ['R004','الولاية الشمالية','Northern State','قمح·تمر·حبوب·برسيم','1.2M هكتار','65%',85000,'#3B82F6','19.0','33.2'],
      ['R005','النيل الأزرق','Blue Nile State','فلفل·ذرة·سمسم·قهوة','650K هكتار','48%',110000,'#14B8A6','11.5','34.5'],
    ];
    defaultRegions.forEach(r => regions.appendRow(r));
  }
}

// ═══════════════════════════════════════════════════════════════
//  المصادقة
// ═══════════════════════════════════════════════════════════════
function login_(p) {
  const phone    = String(p.phone    || '').replace(/\D/g,'').replace(/^0+/,'');
  const password = String(p.password || '').trim();
  if (!phone || !password) return { ok: false, error: 'MISSING_FIELDS' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('Users').getDataRange().getValues();
  const hdr   = users[0];
  const idx   = col => hdr.indexOf(col);

  for (let i = 1; i < users.length; i++) {
    const row = users[i];
    if (row[idx('Phone')] !== phone) continue;

    // قفل الحساب؟
    const locked = row[idx('LockedUntil')];
    if (locked && new Date(locked) > new Date()) {
      const mins = Math.ceil((new Date(locked) - new Date()) / 60000);
      return { ok: false, error: 'LOCKED', minutesLeft: mins };
    }

    // تحقق كلمة السر
    const hash = sha256_(row[idx('Salt')] + password);
    if (hash !== row[idx('PasswordHash')]) {
      // زيادة عداد الفشل
      const fails = (parseInt(row[idx('FailedAttempts')]) || 0) + 1;
      const max   = parseInt(getSetting_('MAX_FAILED_ATTEMPTS')) || 5;
      const sh    = ss.getSheetByName('Users');
      sh.getRange(i + 1, idx('FailedAttempts') + 1).setValue(fails);
      if (fails >= max) {
        const mins = parseInt(getSetting_('LOCKOUT_MINUTES')) || 30;
        const until = new Date(Date.now() + mins * 60000).toISOString();
        sh.getRange(i + 1, idx('LockedUntil') + 1).setValue(until);
        logChange_(row[idx('UserID')], row[idx('UserID')], 'Users', 'LockedUntil', '', until);
        return { ok: false, error: 'LOCKED', minutesLeft: mins };
      }
      return { ok: false, error: 'WRONG_PASSWORD', attemptsLeft: max - fails };
    }

    if (!row[idx('Active')]) return { ok: false, error: 'INACTIVE' };

    // صفّر عداد الفشل وسجّل آخر دخول
    const sh = ss.getSheetByName('Users');
    sh.getRange(i + 1, idx('FailedAttempts') + 1).setValue(0);
    sh.getRange(i + 1, idx('LockedUntil')     + 1).setValue('');
    sh.getRange(i + 1, idx('LastLogin')        + 1).setValue(new Date().toISOString());

    // إنشاء جلسة
    const hours  = parseInt(getSetting_('SESSION_HOURS')) || 12;
    const token  = Utilities.getUuid();
    const expiry = new Date(Date.now() + hours * 3600000).toISOString();
    ss.getSheetByName('Sessions').appendRow([
      token, row[idx('UserID')], phone,
      row[idx('FullName')], row[idx('UserType')],
      new Date().toISOString(), expiry
    ]);

    // تغيير كلمة السر إلزامي؟
    if (row[idx('MustChangePassword')]) {
      return { ok: true, mustChangePassword: true, token,
               fullName: row[idx('FullName')], userType: row[idx('UserType')] };
    }

    return { ok: true, token,
             fullName: row[idx('FullName')], userType: row[idx('UserType')],
             phone, expiresAt: expiry };
  }
  return { ok: false, error: 'NOT_FOUND' };
}

function register_(p) {
  ensureSheets_();
  const country  = String(p.country  || '249').replace(/\D/g,'');
  const phone    = String(p.phone    || '').replace(/\D/g,'').replace(/^0+/,'');
  const fullName = String(p.fullName || '').trim();
  const userType = String(p.userType || 'مزارع').trim();

  if (phone.length < 6) return { ok: false, error: 'INVALID_PHONE' };
  if (!fullName)         return { ok: false, error: 'MISSING_NAME' };

  const fullPhone = country + phone;
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('Users').getDataRange().getValues();
  const hdr   = users[0];
  const idx   = col => hdr.indexOf(col);

  // التحقق من التكرار
  for (let i = 1; i < users.length; i++) {
    if (String(users[i][idx('Phone')]) === phone) {
      return { ok: false, error: 'PHONE_EXISTS' };
    }
  }

  // إنشاء OTP وحفظ المستخدم
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const salt   = Utilities.getUuid();
  const hash   = sha256_(salt + otp);
  const expiry = new Date(Date.now() + 15 * 60000).toISOString(); // 15 دقيقة

  ss.getSheetByName('Users').appendRow([
    Utilities.getUuid(), phone, hash, salt, fullName, userType,
    '', country, false, 0, '', true, otp, expiry,
    new Date().toISOString(), ''
  ]);

  // إرسال OTP عبر واتساب
  const sent = sendWhatsApp_(fullPhone, fullName, otp);
  return { ok: true, sent, phone: fullPhone, message: sent
    ? 'تم إرسال كلمة السر عبر واتساب'
    : 'تم التسجيل — تواصل مع المدير للحصول على كلمة السر' };
}

function logout_(p) {
  const token = p.token || '';
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'SESSION_NOT_FOUND' };
}

function sendOtp_(p) {
  const phone = String(p.phone || '').replace(/\D/g,'').replace(/^0+/,'');
  const country = String(p.country || '249').replace(/\D/g,'');
  if (!phone) return { ok: false, error: 'MISSING_PHONE' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sh    = ss.getSheetByName('Users');
  const data  = sh.getDataRange().getValues();
  const hdr   = data[0]; const idx = col => hdr.indexOf(col);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx('Phone')]) === phone) {
      const otp    = String(Math.floor(100000 + Math.random() * 900000));
      const salt   = data[i][idx('Salt')];
      const hash   = sha256_(salt + otp);
      const expiry = new Date(Date.now() + 15 * 60000).toISOString();
      sh.getRange(i + 1, idx('OtpCode')   + 1).setValue(otp);
      sh.getRange(i + 1, idx('OtpExpiry') + 1).setValue(expiry);
      sh.getRange(i + 1, idx('PasswordHash') + 1).setValue(hash);
      const sent = sendWhatsApp_(country + phone, data[i][idx('FullName')], otp);
      return { ok: true, sent };
    }
  }
  return { ok: false, error: 'NOT_FOUND' };
}

function verifyOtp_(p) {
  const phone = String(p.phone || '').replace(/\D/g,'').replace(/^0+/,'');
  const otp   = String(p.otp   || '').trim();
  if (!phone || !otp) return { ok: false, error: 'MISSING_FIELDS' };

  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx('Phone')]) !== phone) continue;
    const storedOtp    = String(data[i][idx('OtpCode')]);
    const otpExpiry    = data[i][idx('OtpExpiry')];
    if (storedOtp !== otp) return { ok: false, error: 'WRONG_OTP' };
    if (otpExpiry && new Date(otpExpiry) < new Date()) return { ok: false, error: 'OTP_EXPIRED' };

    // تفعيل الحساب
    sh.getRange(i + 1, idx('Active')            + 1).setValue(true);
    sh.getRange(i + 1, idx('MustChangePassword') + 1).setValue(false);
    sh.getRange(i + 1, idx('OtpCode')           + 1).setValue('');
    sh.getRange(i + 1, idx('OtpExpiry')         + 1).setValue('');
    return { ok: true, message: 'تم تفعيل الحساب بنجاح' };
  }
  return { ok: false, error: 'NOT_FOUND' };
}

function changePassword_(p) {
  const sess   = verifySession_(p.token);
  if (!sess.ok) return sess;
  const newPass = String(p.newPassword || '').trim();
  if (newPass.length < 4) return { ok: false, error: 'PASSWORD_TOO_SHORT' };

  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx('Phone')]) === sess.phone) {
      const salt = Utilities.getUuid();
      const hash = sha256_(salt + newPass);
      sh.getRange(i + 1, idx('Salt')            + 1).setValue(salt);
      sh.getRange(i + 1, idx('PasswordHash')    + 1).setValue(hash);
      sh.getRange(i + 1, idx('MustChangePassword') + 1).setValue(false);
      return { ok: true };
    }
  }
  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  المحاصيل والأسعار
// ═══════════════════════════════════════════════════════════════
function getCrops_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Crops').getDataRange().getValues();
  const hdr = data[0];
  const crops = data.slice(1).map(r =>
    Object.fromEntries(hdr.map((h, i) => [h, r[i]]))
  );
  return { ok: true, crops };
}

function updateCrop_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };

  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Crops');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('CropID')] !== p.cropId) continue;
    const old = data[i][idx('PriceToday')];
    const nw  = parseFloat(p.price) || old;
    const chg = nw - parseFloat(data[i][idx('PriceYesterday')]);
    const pct = ((chg / parseFloat(data[i][idx('PriceYesterday')])) * 100).toFixed(1);
    sh.getRange(i + 1, idx('PriceYesterday') + 1).setValue(old);
    sh.getRange(i + 1, idx('PriceToday')     + 1).setValue(nw);
    sh.getRange(i + 1, idx('Change')         + 1).setValue((chg >= 0 ? '+' : '') + chg.toFixed(0));
    sh.getRange(i + 1, idx('ChangePercent')  + 1).setValue((chg >= 0 ? '+' : '') + pct + '%');
    sh.getRange(i + 1, idx('UpdatedAt')      + 1).setValue(new Date().toISOString());
    sh.getRange(i + 1, idx('UpdatedBy')      + 1).setValue(sess.fullName);
    logChange_(sess.userID, p.cropId, 'Crops', 'PriceToday', old, nw);
    return { ok: true };
  }
  return { ok: false, error: 'CROP_NOT_FOUND' };
}

function addCrop_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const id = 'C' + String(Date.now()).slice(-6);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Crops').appendRow([
    id, p.nameAr||'', p.nameEn||'', p.region||'',
    parseFloat(p.price)||0, parseFloat(p.price)||0,
    p.unit||'طن', p.currency||'SDG', '0', '0%',
    new Date().toISOString(), sess.fullName
  ]);
  return { ok: true, cropId: id };
}

// ═══════════════════════════════════════════════════════════════
//  المشاريع الاستثمارية
// ═══════════════════════════════════════════════════════════════
function getProjects_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Projects').getDataRange().getValues();
  const hdr = data[0];
  const projects = data.slice(1).map(r =>
    Object.fromEntries(hdr.map((h, i) => [h, r[i]]))
  );
  return { ok: true, projects };
}

function addProject_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const id = 'P' + String(Date.now()).slice(-6);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Projects').appendRow([
    id, p.titleAr||'', p.titleEn||'', p.region||'', p.category||'',
    p.description||'', parseFloat(p.targetAmount)||0, 0,
    p.currency||'USD', p.status||'active',
    p.startDate||'', p.endDate||'',
    new Date().toISOString(), sess.fullName, p.imageURL||''
  ]);
  return { ok: true, projectId: id };
}

function updateProject_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Projects');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('ProjectID')] !== p.projectId) continue;
    const fields = ['TitleAr','TitleEn','Region','Category','Description',
                    'TargetAmount','Status','EndDate'];
    fields.forEach(f => {
      if (p[f.charAt(0).toLowerCase() + f.slice(1)] !== undefined) {
        sh.getRange(i + 1, idx(f) + 1).setValue(p[f.charAt(0).toLowerCase() + f.slice(1)]);
      }
    });
    return { ok: true };
  }
  return { ok: false, error: 'PROJECT_NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  المناطق
// ═══════════════════════════════════════════════════════════════
function getRegions_(p) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Regions').getDataRange().getValues();
  const hdr = data[0];
  return {
    ok: true,
    regions: data.slice(1).map(r => Object.fromEntries(hdr.map((h, i) => [h, r[i]])))
  };
}

// ═══════════════════════════════════════════════════════════════
//  المستخدمون (admin)
// ═══════════════════════════════════════════════════════════════
function getUsers_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Users').getDataRange().getValues();
  const hdr  = data[0];
  const safe = ['UserID','Phone','FullName','UserType','Country','Active',
                'FailedAttempts','LockedUntil','CreatedAt','LastLogin'];
  const users = data.slice(1).map(r => {
    const obj = {};
    safe.forEach(f => { obj[f] = r[hdr.indexOf(f)]; });
    return obj;
  });
  return { ok: true, users };
}

function updateUser_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx('UserID')] !== p.userId) continue;
    if (p.active    !== undefined) sh.getRange(i+1, idx('Active')   +1).setValue(p.active);
    if (p.userType  !== undefined) sh.getRange(i+1, idx('UserType') +1).setValue(p.userType);
    if (p.fullName  !== undefined) sh.getRange(i+1, idx('FullName') +1).setValue(p.fullName);
    // reset lock
    if (p.resetLock) {
      sh.getRange(i+1, idx('FailedAttempts') +1).setValue(0);
      sh.getRange(i+1, idx('LockedUntil')    +1).setValue('');
    }
    logChange_(sess.userID, p.userId, 'Users', 'Updated', '', JSON.stringify(p));
    return { ok: true };
  }
  return { ok: false, error: 'USER_NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  الإعلانات / واتساب Broadcast
// ═══════════════════════════════════════════════════════════════
function broadcast_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };

  const message    = String(p.message || '').trim();
  const targetType = String(p.targetType || 'all'); // all | مزارع | مستثمر | شريك
  if (!message) return { ok: false, error: 'MISSING_MESSAGE' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('Users').getDataRange().getValues();
  const hdr   = users[0]; const idx = col => hdr.indexOf(col);

  let count = 0;
  const country = getSetting_('COUNTRY_CODE') || '249';

  for (let i = 1; i < users.length; i++) {
    const row = users[i];
    if (!row[idx('Active')]) continue;
    if (targetType !== 'all' && row[idx('UserType')] !== targetType) continue;
    const phone = (row[idx('CountryCode')] || country) + String(row[idx('Phone')]);
    const text  = `*${APP_NAME}*\n\n${message}\n\n_السودان الأخضر_`;
    sendWhatsAppText_(phone, text);
    count++;
    Utilities.sleep(300); // منع الحظر
  }

  ss.getSheetByName('Announcements').appendRow([
    Utilities.getUuid(), p.title||'إعلان', message, targetType,
    new Date().toISOString(), sess.fullName, count, 'sent'
  ]);

  return { ok: true, sentCount: count };
}

// ═══════════════════════════════════════════════════════════════
//  الإحصائيات
// ═══════════════════════════════════════════════════════════════
function getStats_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return { ok: false, error: 'UNAUTHORIZED' };

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const users    = ss.getSheetByName('Users').getDataRange().getValues();
  const crops    = ss.getSheetByName('Crops').getDataRange().getValues();
  const projects = ss.getSheetByName('Projects').getDataRange().getValues();
  const phdr     = projects[0]; const pidx = col => phdr.indexOf(col);

  const totalUsers     = users.length - 1;
  const activeUsers    = users.slice(1).filter(r => r[1]).length;
  const farmerCount    = users.slice(1).filter(r => r[5] === 'مزارع').length;
  const investorCount  = users.slice(1).filter(r => r[5] === 'مستثمر').length;
  const totalCrops     = crops.length - 1;
  const totalProjects  = projects.length - 1;
  const totalRaised    = projects.slice(1).reduce((s, r) =>
    s + (parseFloat(r[pidx('RaisedAmount')]) || 0), 0);

  return {
    ok: true,
    stats: {
      totalUsers, activeUsers, farmerCount, investorCount,
      totalCrops, totalProjects, totalRaised,
      lastUpdate: new Date().toISOString()
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  الملف الشخصي
// ═══════════════════════════════════════════════════════════════
function getProfile_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Users').getDataRange().getValues();
  const hdr = data[0]; const idx = col => hdr.indexOf(col);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx('Phone')]) === sess.phone) {
      return {
        ok: true,
        profile: {
          phone:    data[i][idx('Phone')],
          fullName: data[i][idx('FullName')],
          userType: data[i][idx('UserType')],
          country:  data[i][idx('Country')],
          createdAt:data[i][idx('CreatedAt')],
          lastLogin:data[i][idx('LastLogin')]
        }
      };
    }
  }
  return { ok: false, error: 'NOT_FOUND' };
}

function updateProfile_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Users');
  const data = sh.getDataRange().getValues();
  const hdr  = data[0]; const idx = col => hdr.indexOf(col);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx('Phone')]) !== sess.phone) continue;
    if (p.fullName) sh.getRange(i+1, idx('FullName') +1).setValue(p.fullName);
    if (p.country)  sh.getRange(i+1, idx('Country')  +1).setValue(p.country);
    return { ok: true };
  }
  return { ok: false, error: 'NOT_FOUND' };
}

// ═══════════════════════════════════════════════════════════════
//  الإعدادات
// ═══════════════════════════════════════════════════════════════
function getSettings_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Settings').getDataRange().getValues();
  const settings = {};
  data.slice(1).forEach(r => {
    // إخفاء التوكن في الاستجابة
    settings[r[0]] = r[0].includes('TOKEN') ? '***' : r[1];
  });
  return { ok: true, settings };
}

function saveSettings_(p) {
  const sess = verifySession_(p.token);
  if (!sess.ok) return sess;
  if (sess.userType !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Settings');
  const data = sh.getDataRange().getValues();
  const allowed = ['SESSION_HOURS','MAX_FAILED_ATTEMPTS','LOCKOUT_MINUTES',
                   'WHATSAPP_TOKEN','WHATSAPP_PHONE_ID','WHATSAPP_ENABLED',
                   'DEFAULT_CURRENCY','LOW_STOCK_THRESHOLD'];
  allowed.forEach(key => {
    if (p[key] === undefined) return;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sh.getRange(i + 1, 2).setValue(p[key]);
        return;
      }
    }
    sh.appendRow([key, p[key]]);
  });
  return { ok: true };
}

function saveApiUrl_(p) {
  const token = p.token || '';
  const url   = String(p.apiUrl || '').trim();
  if (!url) return { ok: false, error: 'MISSING_URL' };
  // حفظ بدون تحقق جلسة (يُستدعى عند أول دخول)
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sh   = ss.getSheetByName('Settings');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'API_URL') { sh.getRange(i+1,2).setValue(url); return { ok:true }; }
  }
  sh.appendRow(['API_URL', url]);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  واتساب — Meta Cloud API v19
// ═══════════════════════════════════════════════════════════════
function sendWhatsApp_(toPhone, name, otp) {
  const token   = getSetting_('WHATSAPP_TOKEN');
  const phoneId = getSetting_('WHATSAPP_PHONE_ID');
  const enabled = getSetting_('WHATSAPP_ENABLED') === 'true';
  if (!enabled || !token || !phoneId) return false;

  const message =
    `🌱 *${APP_NAME}*\n` +
    `أهلاً ${name}!\n\n` +
    `كلمة السر الخاصة بك:\n` +
    `*${otp}*\n\n` +
    `هذه الكلمة صالحة لمدة 15 دقيقة.\n` +
    `---\n` +
    `Green Sudan — Your one-time password: *${otp}*`;

  return sendWhatsAppText_(toPhone, message);
}

function sendWhatsAppText_(toPhone, message) {
  try {
    const token   = getSetting_('WHATSAPP_TOKEN');
    const phoneId = getSetting_('WHATSAPP_PHONE_ID');
    const url     = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to:   toPhone.replace(/\D/g,''),
      type: 'text',
      text: { preview_url: false, body: message }
    };
    const res = UrlFetchApp.fetch(url, {
      method:      'post',
      contentType: 'application/json',
      headers:     { Authorization: 'Bearer ' + token },
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  دوال مساعدة
// ═══════════════════════════════════════════════════════════════
function verifySession_(token) {
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  const sessions = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Sessions').getDataRange().getValues();
  // [Token, UserID, Phone, FullName, UserType, CreatedAt, ExpiresAt]
  for (const row of sessions.slice(1)) {
    if (row[0] !== token) continue;
    if (new Date(row[6]) < new Date()) return { ok: false, error: 'SESSION_EXPIRED' };
    return { ok: true, userID: row[1], phone: row[2], fullName: row[3], userType: row[4] };
  }
  return { ok: false, error: 'INVALID_TOKEN' };
}

function getSetting_(key) {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Settings').getDataRange().getValues();
  for (const row of data) { if (row[0] === key) return String(row[1]); }
  return '';
}

function sha256_(text) {
  const bytes  = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('');
}

function logChange_(userID, recordID, table, field, oldVal, newVal) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ChangeLog').appendRow([
      new Date().toISOString(), userID, recordID, table, field, oldVal, newVal
    ]);
  } catch(e) {}
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
