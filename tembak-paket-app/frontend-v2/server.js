const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const next = require('next');

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
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

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

const DEPLOY_SECRET = process.env.AUTO_DEPLOY_SECRET || 'RyITSolutionsAutoDeploy2026';

const FRONTEND_DIR = __dirname;
const ARTIFACT_FILE = path.join(FRONTEND_DIR, 'next.tar.gz');
const ARTIFACT_TMP = path.join(FRONTEND_DIR, 'next.tar.gz.uploading');
const MAX_ARTIFACT_BYTES = 500 * 1024 * 1024;

/**
 * Menerima artifact build (.next + public/version.json) dari GitHub Actions.
 * Body = file tarball mentah. Disimpan dulu sebagai file sementara lalu
 * di-rename jadi next.tar.gz supaya extract tidak pernah membaca file setengah jadi.
 */
function handleArtifactUpload(req, res) {
  const parsed = parse(req.url, true);
  const providedSecret = parsed.query.secret || req.headers['x-webhook-secret'];
  if (!providedSecret || providedSecret !== DEPLOY_SECRET) {
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
 * Extract artifact .next ke folder frontend lalu restart service PM2.
 * Menjawab dengan status sebenarnya (sukses/gagal) supaya GitHub Actions
 * tidak menandai deploy sukses saat extract atau restart ternyata gagal.
 */
function handleDeploy(req, res) {
  const parsed = parse(req.url, true);
  const providedSecret = parsed.query.secret || req.headers['x-webhook-secret'];
  if (!providedSecret || providedSecret !== DEPLOY_SECRET) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Forbidden' }));
  }

  if (!fs.existsSync(ARTIFACT_FILE)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: false, message: 'Belum ada artifact build. Kirim artifact ke /_deploy-artifact lebih dulu.' }));
  }

  const { exec } = require('child_process');
  console.log(`[SELF_DEPLOY] Extract + restart dari ${ARTIFACT_FILE}`);

  const deployCmd = `tar -xzf "${ARTIFACT_FILE}" -C "${FRONTEND_DIR}" && rm -f "${ARTIFACT_FILE}" && pm2 restart rystore-frontend && pm2 restart rystore-backend`;

  exec(deployCmd, { cwd: FRONTEND_DIR, shell: true, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[SELF_DEPLOY] FAILED: ${err.message}`);
      if (stderr) console.error(`[SELF_DEPLOY] stderr:\n${stderr}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ status: false, message: err.message, stderr: String(stderr || '').slice(0, 2000) }));
    }
    console.log(`[SELF_DEPLOY] Success. Output:\n${stdout}`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: true, message: 'Deploy selesai', output: String(stdout || '').slice(0, 2000) }));
  });
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
