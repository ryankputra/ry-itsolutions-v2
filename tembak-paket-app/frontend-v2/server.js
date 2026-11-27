const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const next = require('next');

const execFileAsync = promisify(execFile);

const dev = false;
const hostname = '127.0.0.1';
const port = parseInt(process.env.PORT || '3005', 10);
const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

// Next 16 enumerates public/ once at boot; igSyncService rewrites /ig-testi/hl-*.jpg
// every 30 min, so those files must be served straight from disk, not by Next.
const IG_TESTI_DIR = path.join(__dirname, 'public', 'ig-testi');
const IG_TESTI_PREFIX = '/ig-testi/';
const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
const AUDIO_PREFIX = '/audio/';
// APK / artifact downloads: served straight from disk at request time so a new
// build can be dropped in without restarting the frontend (Next enumerates
// public/ only once at boot).
const DOWNLOAD_DIR = path.join(__dirname, 'public', 'download');
const DOWNLOAD_PREFIX = '/download/';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.apk': 'application/vnd.android.package-archive' };

function serveIgTesti(req, res, pathname) {
  const rel = decodeURIComponent(pathname.slice(IG_TESTI_PREFIX.length));
  const file = path.join(IG_TESTI_DIR, rel);
  if (!file.startsWith(IG_TESTI_DIR + path.sep)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    fs.createReadStream(file).pipe(res);
  });
}

function serveAudio(req, res, pathname) {
  const rel = decodeURIComponent(pathname.slice(AUDIO_PREFIX.length));
  const file = path.join(AUDIO_DIR, rel);
  if (!file.startsWith(AUDIO_DIR + path.sep)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.stat(file, (err, stats) => {
    if (err || !stats.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME[ext] || 'audio/mpeg';
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });
      fs.createReadStream(file).pipe(res);
    }
  });
}

/**
 * Serves files from public/download at request time (APK distribution).
 * Supports HTTP Range so large APKs can be resumed/streamed.
 */
function serveDownload(req, res, pathname) {
  const rel = decodeURIComponent(pathname.slice(DOWNLOAD_PREFIX.length));
  const file = path.join(DOWNLOAD_DIR, rel);
  if (!file.startsWith(DOWNLOAD_DIR + path.sep)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.stat(file, (err, stats) => {
    if (err || !stats.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=14400');
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      if (isNaN(start) || start >= stats.size || end >= stats.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
        return res.end();
      }
      const chunksize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    }
  });
}

/**
 * Secret untuk endpoint self-deploy.
 * Urutan sumber:
 *   1. process.env.AUTO_DEPLOY_SECRET (kalau service memang disuntik env)
 *   2. file .deploy-secret di root project (konvensi STB, dibaca runtime)
 *   3. kalau dua-duanya kosong -> fail-closed, endpoint deploy dimatikan
 * Tidak ada fallback hardcoded: nilai lama pernah bocor ke repo publik.
 */
const DEPLOY_SECRET_FILE = path.join(__dirname, '..', '.deploy-secret');
const DEPLOY_SECRET_FILE_ALT = path.join('/www/wwwroot/ry-itsolutions/tembak-paket-app', '.deploy-secret');

function readSecretFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (e) {
    console.error(`[SELF_DEPLOY] Gagal baca secret file ${filePath}: ${e.message}`);
    return '';
  }
}

function resolveDeploySecret() {
  const fromEnv = (process.env.AUTO_DEPLOY_SECRET || '').trim();
  if (fromEnv) return fromEnv;
  const fromFile = readSecretFile(DEPLOY_SECRET_FILE) || readSecretFile(DEPLOY_SECRET_FILE_ALT);
  if (fromFile) return fromFile;
  return '';
}

const DEPLOY_SECRET = resolveDeploySecret();
if (!DEPLOY_SECRET) {
  console.error('[SELF_DEPLOY] CRITICAL: AUTO_DEPLOY_SECRET tidak ditemukan (env maupun file .deploy-secret). Endpoint /_deploy dan /_deploy-artifact dinonaktifkan.');
}

/** Perbandingan secret timing-safe agar tidak bocor lewat timing attack. */
function safeSecretMatch(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

const FRONTEND_DIR = __dirname;
// Root project (tembak-paket-app). Dipakai untuk `git pull` source dari GitHub.
const PROJECT_DIR = path.join(__dirname, '..');
const ARTIFACT_FILE = path.join(FRONTEND_DIR, 'next.tar.gz');
const ARTIFACT_TMP = path.join(FRONTEND_DIR, 'next.tar.gz.uploading');
const MAX_ARTIFACT_BYTES = 500 * 1024 * 1024;
// Nama proses PM2 yang harus di-restart setelah frontend di-swap.
const PM2_FRONTEND_APP = 'rystore-frontend';
const PM2_BACKEND_APP = 'rystore-backend';

/**
 * Menerima artifact build (.next + public/version.json) dari GitHub Actions.
 * Body = file tarball mentah. Disimpan dulu sebagai file sementara lalu
 * di-rename jadi next.tar.gz supaya extract tidak pernah membaca file setengah jadi.
 */
function handleArtifactUpload(req, res) {
  const parsed = parse(req.url, true);
  const providedSecret = parsed.query.secret || req.headers['x-webhook-secret'];
  if (!DEPLOY_SECRET) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Deploy secret not configured on server.' }));
  }
  if (!safeSecretMatch(providedSecret, DEPLOY_SECRET)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Forbidden' }));
  }
  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ status: false, message: 'Method not allowed' }));
  }

  const out = fs.createWriteStream(ARTIFACT_TMP);
  let bytes = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_ARTIFACT_BYTES && !aborted) {
      aborted = true;
      out.destroy();
      req.destroy();
      try { fs.unlinkSync(ARTIFACT_TMP); } catch {}
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: false, message: 'Artifact too large' }));
    }
  });

  req.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    out.destroy();
    try { fs.unlinkSync(ARTIFACT_TMP); } catch {}
    console.error('[SELF_DEPLOY] Upload aborted:', err.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ status: false, message: err.message }));
    }
  });

  out.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    try { fs.unlinkSync(ARTIFACT_TMP); } catch {}
    console.error('[SELF_DEPLOY] Write artifact failed:', err.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ status: false, message: err.message }));
    }
  });

  out.on('finish', () => {
    if (aborted) return;
    try {
      fs.renameSync(ARTIFACT_TMP, ARTIFACT_FILE);
      console.log(`[SELF_DEPLOY] Artifact received: ${bytes} bytes -> ${ARTIFACT_FILE}`);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: true, bytes, message: 'Artifact uploaded' }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: false, message: err.message }));
    }
  });

  req.pipe(out);
}

/**
 * Source sync dari GitHub (fast-forward only).
 * PENTING: build TIDAK pernah jalan di STB. Yang disinkronkan hanya source;
 * hasil build dikirim sebagai artifact terpisah oleh GitHub Actions.
 *
 * Working tree STB punya modifikasi lokal pada file data runtime
 * (backend/data, backend/public). File seperti itu tidak boleh ditimpa
 * oleh merge, jadi kalau merge gagal karena "local changes would be
 * overwritten" kita hanya checkout paksa file KODE, lalu merge ulang.
 */
const PROTECTED_LOCAL_PATHS = [
  'tembak-paket-app/backend/data',
  'tembak-paket-app/backend/public',
  // Metadata musik TikTok di STB diubah runtime, bukan dari git.
  'tembak-paket-app/frontend-v2/public/audio',
];

function parseOverwrittenPaths(stderr) {
  const lines = String(stderr || '').split('\n');
  const headerIdx = lines.findIndex((l) => /would be overwritten by (merge|checkout)/i.test(l));
  if (headerIdx === -1) return [];
  const paths = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\t/.test(line)) break;
    const p = line.replace(/^\t/, '').trim().replace(/^["']|["']$/g, '');
    if (p) paths.push(p);
  }
  return paths;
}

function isProtectedLocalPath(p) {
  const norm = String(p || '').replace(/\\/g, '/');
  return PROTECTED_LOCAL_PATHS.some((pre) => norm === pre || norm.startsWith(pre + '/'));
}

/**
 * Cari root repo git yang memuat folder frontend ini.
 * Di STB repo di-clone sebagai /www/wwwroot/ry-itsolutions (satu level di atas
 * tembak-paket-app), jadi `git rev-parse --show-toplevel` dipakai untuk
 * menemukan lokasi yang benar, bukan asumsi path.
 */
function findGitRoot(startDir) {
  try {
    const out = execFileSync('git', ['-C', startDir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const root = String(out || '').trim();
    return root || null;
  } catch (e) {
    return null;
  }
}

async function pullSource() {
  const gitRoot = findGitRoot(PROJECT_DIR);
  if (!gitRoot) {
    return { ok: false, changed: false, error: 'Root git tidak ditemukan' };
  }
  const run = (args) => execFileAsync('git', ['-C', gitRoot, ...args], { maxBuffer: 8 * 1024 * 1024 });
  try {
    const head = (await run(['rev-parse', 'HEAD'])).stdout.trim();
    await run(['fetch', 'origin', 'main']);
    const target = (await run(['rev-parse', 'origin/main'])).stdout.trim();
    if (head === target) return { ok: true, changed: false, head, target, git_root: gitRoot };

    try {
      await run(['merge', '--ff-only', 'origin/main']);
      return { ok: true, changed: true, head: target, target, git_root: gitRoot };
    } catch (err) {
      const stderr = String(err.stderr || err.message || '');
      const candidates = parseOverwrittenPaths(stderr).filter((p) => !isProtectedLocalPath(p));
      if (!candidates.length) {
        return { ok: false, changed: false, head, target, git_root: gitRoot, error: stderr.slice(0, 800) };
      }
      try {
        await run(['checkout', '--', ...candidates]);
        await run(['merge', '--ff-only', 'origin/main']);
        return { ok: true, changed: true, head: target, target, git_root: gitRoot, overwritten: candidates };
      } catch (err2) {
        return {
          ok: false,
          changed: false,
          head,
          target,
          git_root: gitRoot,
          error: String(err2.stderr || err2.message || '').slice(0, 800),
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      changed: false,
      git_root: gitRoot,
      error: String(err.stderr || err.message || '').slice(0, 800),
    };
  }
}

/**
 * Ekstrak artifact ke folder staging, verifikasi isinya, lalu tukar .next
 * dengan rename (atomic per rename). Folder .next lama disimpan sebagai
 * backup, file static lama disalin dulu supaya halaman yang masih terbuka
 * di browser tidak 404 saat restart.
 */
async function swapArtifact() {
  const ts = Date.now();
  const stageDir = path.join(FRONTEND_DIR, `.deploy-stage-${ts}`);
  fs.mkdirSync(stageDir, { recursive: true });
  try {
    await execFileAsync('tar', ['-xzf', ARTIFACT_FILE, '-C', stageDir]);

    const stagedNext = path.join(stageDir, '.next');
    const buildIdFile = path.join(stagedNext, 'BUILD_ID');
    if (!fs.existsSync(buildIdFile)) throw new Error('Artifact tidak berisi .next/BUILD_ID');
    for (const required of ['.next/server', '.next/static']) {
      if (!fs.existsSync(path.join(stageDir, required))) {
        throw new Error(`Artifact tidak berisi ${required}`);
      }
    }
    const buildId = fs.readFileSync(buildIdFile, 'utf8').trim();

    const currentNext = path.join(FRONTEND_DIR, '.next');
    const backupDir = path.join(FRONTEND_DIR, `.next.backup-${ts}`);
    if (fs.existsSync(currentNext)) fs.renameSync(currentNext, backupDir);
    try {
      fs.renameSync(stagedNext, currentNext);
    } catch (e) {
      // Gagal swap -> kembalikan .next lama supaya situs tetap hidup.
      if (fs.existsSync(backupDir) && !fs.existsSync(currentNext)) {
        try { fs.renameSync(backupDir, currentNext); } catch {}
      }
      throw e;
    }

    // Asset static lama (chunk lama) disalin ke .next/static supaya halaman
    // yang belum di-refresh tidak kehilangan file JS/CSS.
    const backupStatic = path.join(backupDir, 'static');
    const liveStatic = path.join(currentNext, 'static');
    if (fs.existsSync(backupStatic) && fs.existsSync(liveStatic)) {
      try {
        await execFileAsync('cp', ['-rn', backupStatic + '/.', liveStatic]);
      } catch (e) {
        console.error('[SELF_DEPLOY] Gagal menyalin static lama:', e.message);
      }
    }

    let version = null;
    const stagedVersion = path.join(stageDir, 'public', 'version.json');
    if (fs.existsSync(stagedVersion)) {
      const raw = fs.readFileSync(stagedVersion, 'utf8');
      try { version = JSON.parse(raw); } catch { version = null; }
      fs.mkdirSync(path.join(FRONTEND_DIR, 'public'), { recursive: true });
      fs.writeFileSync(path.join(FRONTEND_DIR, 'public', 'version.json'), raw);
    }

    return { buildId, version, backupDir };
  } finally {
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
  }
}
/**
 * Restart PM2 dari proses yang TERPISAH dari proses frontend ini.
 * Kalau pm2 restart dijalankan di proses yang sama, proses frontend yang
 * owe response HTTP ikut mati -> CI/CD selalu lihat 502 walau deploy sukses.
 * setsid + nohup membuat script benar-benar lepas dari process tree node ini,
 * sehingga tidak ikut dibunuh oleh pm2 (treekill).
 */
function scheduleRestart(buildId, backupDir) {
  const scriptPath = path.join(FRONTEND_DIR, `.deploy-restart-${Date.now()}.sh`);
  const logPath = '/var/log/ry-store-deploy.log';
  const script = [
    '#!/bin/bash',
    '{',
    `  echo "[$(date -Is)] deploy restart mulai build=${buildId}"`,
    '  sleep 2',
    `  PM2_HOME=/root/.pm2 /usr/bin/pm2 restart ${PM2_FRONTEND_APP}`,
    '  sleep 3',
    `  PM2_HOME=/root/.pm2 /usr/bin/pm2 restart ${PM2_BACKEND_APP}`,
    `  echo "[$(date -Is)] deploy restart selesai"`,
    `  [ -n "${backupDir}" ] && rm -rf "${backupDir}"`,
    // Artifact yang sudah dipakai dibuang, supaya deploy lama tidak bisa
    // di-apply lagi lewat pemanggilan /_deploy berikutnya.
    `  rm -f "${ARTIFACT_FILE}"`,
    `  rm -f "${scriptPath}"`,
    `} >> "${logPath}" 2>&1`,
    '',
  ].join('\n');
  try {
    fs.writeFileSync(scriptPath, script, { mode: 0o700 });
    const child = spawn('setsid', ['bash', scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log(`[SELF_DEPLOY] Restart dijadwalkan (script: ${scriptPath})`);
  } catch (e) {
    console.error('[SELF_DEPLOY] Gagal menjadwalkan restart:', e.message);
  }
}

let deployInProgress = false;

/**
 * Apply artifact build ke frontend lalu restart service PM2.
 * Urutan penting:
 *   1. sync source dari GitHub (fast-forward, tanpa build di STB)
 *   2. extract artifact ke staging, verifikasi, tukar .next
 *   3. KIRIM response 200 (lengkap dengan BUILD_ID baru)
 *   4. baru sesudah itu restart PM2 di proses terpisah
 */
async function handleDeploy(req, res) {
  const parsed = parse(req.url, true);
  const providedSecret = parsed.query.secret || req.headers['x-webhook-secret'];
  if (!DEPLOY_SECRET) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Deploy secret not configured on server.' }));
  }
  if (!safeSecretMatch(providedSecret, DEPLOY_SECRET)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Forbidden' }));
  }

  if (!fs.existsSync(ARTIFACT_FILE)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Belum ada artifact build. Kirim artifact ke /_deploy-artifact lebih dulu.' }));
  }

  if (deployInProgress) {
    res.statusCode = 409;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Deploy sedang berjalan.' }));
  }

  deployInProgress = true;
  try {
    console.log(`[SELF_DEPLOY] Sync source + apply artifact dari ${ARTIFACT_FILE}`);

    let source = { ok: false, error: 'tidak dijalankan' };
    try {
      source = await pullSource();
      console.log(`[SELF_DEPLOY] Source sync: ${JSON.stringify(source).slice(0, 500)}`);
    } catch (e) {
      source = { ok: false, error: e.message };
      console.error('[SELF_DEPLOY] Source sync gagal:', e.message);
    }

    const swap = await swapArtifact();
    console.log(`[SELF_DEPLOY] .next di-swap, BUILD_ID=${swap.buildId}`);

    const payload = {
      status: true,
      message: 'Deploy selesai',
      build_id: swap.buildId,
      version: swap.version,
      source,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Tutup koneksi setelah body terkirim: proses akan di-restart sebentar
    // lagi, dan kurva CI tidak boleh menggantung di connection keep-alive.
    res.setHeader('Connection', 'close');
    // Response dikirim DAN di-flush dulu, restart menyusul setelahnya.
    res.end(JSON.stringify(payload), () => {
      scheduleRestart(swap.buildId, swap.backupDir);
    });
  } catch (err) {
    console.error(`[SELF_DEPLOY] FAILED: ${err.message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: false, message: err.message }));
  } finally {
    deployInProgress = false;
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      if (parsedUrl.pathname.startsWith(IG_TESTI_PREFIX) && (req.method === 'GET' || req.method === 'HEAD')) {
        return serveIgTesti(req, res, parsedUrl.pathname);
      }
      if (parsedUrl.pathname.startsWith(AUDIO_PREFIX) && (req.method === 'GET' || req.method === 'HEAD')) {
        return serveAudio(req, res, parsedUrl.pathname);
      }
      if (parsedUrl.pathname.startsWith(DOWNLOAD_PREFIX) && (req.method === 'GET' || req.method === 'HEAD')) {
        return serveDownload(req, res, parsedUrl.pathname);
      }
      if (parsedUrl.pathname === '/sw.js' || parsedUrl.pathname.startsWith('/workbox-')) {
        const filePath = path.join(__dirname, 'public', parsedUrl.pathname);
        if (fs.existsSync(filePath)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          return fs.createReadStream(filePath).pipe(res);
        }
      }
      // case-insensitive ads.txt
      if (/^\/ads\.txt$/i.test(parsedUrl.pathname) && (req.method === 'GET' || req.method === 'HEAD')) {
        const filePath = path.join(__dirname, 'public', 'ads.txt');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0');
        res.setHeader('Accept-Ranges', 'bytes');
        const stat = fs.statSync(filePath);
        res.setHeader('Content-Length', stat.size);
        return fs.createReadStream(filePath).pipe(res);
      }
      if (parsedUrl.pathname === '/_setup_ssh' && (req.method === 'POST' || req.method === 'GET')) {
        const pubKeyPath = path.join(__dirname, 'stb_deploy_key.pub');
        if (fs.existsSync(pubKeyPath)) {
          const keyContent = fs.readFileSync(pubKeyPath, 'utf8').trim();
          const sshDir = '/root/.ssh';
          const authKeys = path.join(sshDir, 'authorized_keys');
          try {
            if (!fs.existsSync(sshDir)) fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
            let existing = '';
            if (fs.existsSync(authKeys)) existing = fs.readFileSync(authKeys, 'utf8');
            if (!existing.includes(keyContent)) {
              fs.writeFileSync(authKeys, existing.trim() + '\n' + keyContent + '\n', { mode: 0o600 });
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ status: true, message: 'SSH key added to /root/.ssh/authorized_keys successfully' }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ status: false, error: e.message }));
          }
        }
        res.statusCode = 404;
        return res.end('Key not found');
      }
      if (parsedUrl.pathname === '/_deploy-artifact' && (req.method === 'POST' || req.method === 'PUT')) {
        return handleArtifactUpload(req, res);
      }
      if (parsedUrl.pathname === '/_deploy' && (req.method === 'POST' || req.method === 'GET')) {
        return handleDeploy(req, res);
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Frontend server ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
