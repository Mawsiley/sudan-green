import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = process.env.PORT || 8080;
const WORK_DIR = process.env.WORK_DIR || '/tmp/apk-lab';
const APKTOOL_JAR = process.env.APKTOOL_JAR || '/opt/tools/apktool.jar';
const SIGNER_JAR = process.env.SIGNER_JAR || '/opt/tools/uber-apk-signer.jar';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 150);
const MAX_AI_CHARS = 60000;

await fs.mkdir(WORK_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(','), exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '5mb' }));

const upload = multer({ dest: path.join(WORK_DIR, 'uploads'), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

// ---------- helpers ----------
function run(cmd, args, { timeout = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const append = (d) => { out += d; if (out.length > 20000) out = out.slice(-20000); };
    p.stdout.on('data', append);
    p.stderr.on('data', append);
    const timer = setTimeout(() => p.kill('SIGKILL'), timeout);
    p.on('error', reject);
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(out.trim() || `exit code ${code}`));
    });
  });
}

const sessionDir = (id) => {
  if (!/^[a-f0-9]{24}$/.test(id || '')) throw httpError(400, 'معرّف الجلسة غير صالح');
  return path.join(WORK_DIR, id);
};

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Resolve a user-supplied relative path inside the decompiled dir; blocks traversal and symlinks.
async function safePath(id, rel) {
  const root = path.join(sessionDir(id), 'src');
  const full = path.resolve(root, rel || '');
  if (full !== root && !full.startsWith(root + path.sep)) throw httpError(400, 'مسار غير مسموح');
  const real = await fs.realpath(full).catch(() => null);
  const realRoot = await fs.realpath(root).catch(() => null);
  if (!real || !realRoot) throw httpError(404, 'غير موجود');
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw httpError(400, 'مسار غير مسموح');
  return real;
}

async function walk(dir, base = dir, acc = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) await walk(full, base, acc);
    else acc.push({ path: path.relative(base, full).split(path.sep).join('/'), size: (await fs.stat(full)).size });
  }
  return acc;
}

const TEXT_EXT = /\.(xml|smali|yml|yaml|txt|json|properties|html|js|css|md|cfg|ini|mf|sf)$/i;

// Periodic cleanup of old sessions.
setInterval(async () => {
  try {
    for (const name of await fs.readdir(WORK_DIR)) {
      if (!/^[a-f0-9]{24}$/.test(name)) continue;
      const st = await fs.stat(path.join(WORK_DIR, name));
      if (Date.now() - st.mtimeMs > SESSION_TTL_MS) await fs.rm(path.join(WORK_DIR, name), { recursive: true, force: true });
    }
  } catch { /* ignore */ }
}, 10 * 60 * 1000).unref();

// ---------- auth ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', (req, res, next) => {
  if (ACCESS_TOKEN && req.get('x-access-token') !== ACCESS_TOKEN) {
    return res.status(401).json({ error: 'رمز الدخول غير صحيح' });
  }
  next();
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- decompile ----------
app.post('/api/decompile', upload.single('apk'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'لم يتم رفع ملف');
  const id = randomBytes(12).toString('hex');
  const dir = sessionDir(id);
  await fs.mkdir(dir, { recursive: true });
  const apkPath = path.join(dir, 'original.apk');
  await fs.rename(req.file.path, apkPath);
  try {
    await run('java', ['-jar', APKTOOL_JAR, 'd', '-f', '-o', path.join(dir, 'src'), apkPath]);
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true });
    throw httpError(422, 'فشل فك الملف: ' + e.message);
  }
  const files = await walk(path.join(dir, 'src'));
  res.json({ id, name: req.file.originalname, files });
}));

// ---------- file read / write ----------
app.get('/api/file', wrap(async (req, res) => {
  const full = await safePath(req.query.id, req.query.path);
  const st = await fs.stat(full);
  if (!st.isFile()) throw httpError(400, 'ليس ملفاً');
  if (!TEXT_EXT.test(full) || st.size > 2 * 1024 * 1024) {
    return res.json({ binary: true, size: st.size });
  }
  res.json({ binary: false, content: await fs.readFile(full, 'utf8') });
}));

app.put('/api/file', wrap(async (req, res) => {
  const { id, path: rel, content } = req.body || {};
  if (typeof content !== 'string') throw httpError(400, 'المحتوى مطلوب');
  const full = await safePath(id, rel);
  if (!TEXT_EXT.test(full)) throw httpError(400, 'يمكن تعديل الملفات النصية فقط');
  await fs.writeFile(full, content, 'utf8');
  res.json({ ok: true });
}));

// ---------- DeepSeek ----------
async function deepseek(apiKey, messages) {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw httpError(400, 'مفتاح DeepSeek غير موجود');
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages, temperature: 0.2, stream: false }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, 'DeepSeek: ' + (data?.error?.message || r.statusText));
  return data.choices?.[0]?.message?.content || '';
}

const clip = (s) => (s.length > MAX_AI_CHARS ? s.slice(0, MAX_AI_CHARS) + '\n…[تم الاقتطاع]' : s);

app.post('/api/analyze', wrap(async (req, res) => {
  const { id, apiKey, question } = req.body || {};
  const src = path.join(sessionDir(id), 'src');
  const read = (p) => fs.readFile(path.join(src, p), 'utf8').catch(() => '');
  const files = await walk(src);
  const summary = files.map((f) => f.path).filter((p) => !p.startsWith('res/') && !p.startsWith('smali')).join('\n');
  const smaliCount = files.filter((f) => f.path.endsWith('.smali')).length;
  const context = [
    '## AndroidManifest.xml', await read('AndroidManifest.xml'),
    '## apktool.yml', await read('apktool.yml'),
    '## res/values/strings.xml', (await read('res/values/strings.xml')).slice(0, 8000),
    `## ملفات ليست smali/res\n${summary}`,
    `## عدد ملفات smali: ${smaliCount}`,
  ].join('\n');
  const answer = await deepseek(apiKey, [
    { role: 'system', content: 'أنت خبير هندسة تطبيقات أندرويد وأمان. حلّل ملفات APK المفكوكة بواسطة Apktool. أجب بالعربية وبشكل منظم: نظرة عامة، الصلاحيات، المكونات (Activities/Services/Receivers)، مخاطر أمنية أو سلوك مريب، واقتراحات تعديل.' },
    { role: 'user', content: clip(context) + (question ? `\n\nسؤال المستخدم: ${question}` : '') },
  ]);
  res.json({ answer });
}));

app.post('/api/ai-edit', wrap(async (req, res) => {
  const { id, apiKey, path: rel, instruction } = req.body || {};
  if (!instruction) throw httpError(400, 'اكتب التعليمات');
  const full = await safePath(id, rel);
  if (!TEXT_EXT.test(full)) throw httpError(400, 'ملف غير نصي');
  const content = await fs.readFile(full, 'utf8');
  if (content.length > MAX_AI_CHARS) throw httpError(413, 'الملف كبير جداً على الذكاء الاصطناعي');
  let out = await deepseek(apiKey, [
    { role: 'system', content: 'أنت خبير تعديل ملفات APK (Apktool/smali/XML). عدّل الملف حسب التعليمات وأعد المحتوى الكامل للملف الجديد فقط داخل كتلة ``` واحدة، بدون أي شرح خارجها. حافظ على صحة الصياغة.' },
    { role: 'user', content: `الملف: ${rel}\n\nالتعليمات: ${instruction}\n\n\`\`\`\n${content}\n\`\`\`` },
  ]);
  const m = out.match(/```[\w-]*\n([\s\S]*?)```/);
  if (m) out = m[1];
  // Returned to the editor only; nothing is written until the user saves.
  res.json({ content: out });
}));

// ---------- build / download ----------
app.post('/api/build', wrap(async (req, res) => {
  const dir = sessionDir(req.body?.id);
  const src = path.join(dir, 'src');
  await fs.access(src).catch(() => { throw httpError(404, 'الجلسة غير موجودة أو انتهت'); });
  const unsigned = path.join(dir, 'rebuilt.apk');
  const outDir = path.join(dir, 'signed');
  await fs.rm(outDir, { recursive: true, force: true });
  try {
    await run('java', ['-jar', APKTOOL_JAR, 'b', '-o', unsigned, src]);
  } catch (e) {
    throw httpError(422, 'فشل البناء: ' + e.message);
  }
  try {
    // zipalign + توقيع بمفتاح debug
    await run('java', ['-jar', SIGNER_JAR, '-a', unsigned, '-o', outDir, '--allowResign', '--overwrite']);
  } catch (e) {
    throw httpError(422, 'فشل التوقيع: ' + e.message);
  }
  const signed = (await fs.readdir(outDir)).find((f) => f.endsWith('.apk'));
  if (!signed) throw httpError(500, 'لم يتم إنتاج ملف موقّع');
  await fs.rename(path.join(outDir, signed), path.join(dir, 'final.apk'));
  res.json({ ok: true });
}));

app.get('/api/download', wrap(async (req, res) => {
  const file = path.join(sessionDir(req.query.id), 'final.apk');
  await fs.access(file).catch(() => { throw httpError(404, 'ابنِ الملف أولاً') });
  res.download(file, 'modified.apk');
}));

app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'خطأ داخلي' });
});

app.listen(PORT, () => console.log(`apk-lab server on :${PORT}`));
