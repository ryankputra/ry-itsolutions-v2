const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// WEBHOOK_SECRET wajib via env (no hardcoded fallback)
const WEBHOOK_SECRET = process.env.AUTO_DEPLOY_SECRET;
if (!WEBHOOK_SECRET) {
    console.error('[WEBHOOK] CRITICAL: AUTO_DEPLOY_SECRET env var tidak diset. Webhook deploy dinonaktifkan.');
}

// In-memory store untuk replay protection (max 1000 delivery IDs)
const processedDeliveries = new Set();
const MAX_DELIVERIES = 1000;

function recordDelivery(deliveryId) {
    if (processedDeliveries.size >= MAX_DELIVERIES) {
        const first = processedDeliveries.values().next().value;
        processedDeliveries.delete(first);
    }
    processedDeliveries.add(deliveryId);
}

function isDuplicateDelivery(deliveryId) {
    return processedDeliveries.has(deliveryId);
}

// Perbandingan secret timing-safe untuk mencegah timing attack
function safeSecretMatch(provided, expected) {
    if (typeof provided !== 'string' || !expected) return false;
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function findRepoRoot() {
    const candidates = [
        path.resolve(__dirname, '../../../'),
        path.resolve(__dirname, '../../'),
        path.resolve(__dirname, '../'),
        process.cwd(),
        path.resolve(process.cwd(), '../')
    ];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, '.git'))) {
            return dir;
        }
    }
    return process.cwd();
}

/**
 * POST /api/webhook/deploy
 * Public webhook endpoint for automated GitHub CI/CD deployments.
 * Authentication: HMAC SHA256 via X-Hub-Signature-256 header + replay protection via X-GitHub-Delivery
 */
router.post(['/deploy', '/webhook/deploy'], (req, res) => {
    // 1. Check WEBHOOK_SECRET is configured
    if (!WEBHOOK_SECRET) {
        return res.status(503).json({
            success: false,
            status: false,
            message: 'Webhook secret not configured on server.'
        });
    }

    // 2. Replay protection: check X-GitHub-Delivery header
    const deliveryId = req.headers['x-github-delivery'];
    if (!deliveryId) {
        return res.status(400).json({
            success: false,
            status: false,
            message: 'Missing X-GitHub-Delivery header (replay protection required).'
        });
    }
    if (isDuplicateDelivery(deliveryId)) {
        console.warn(`[WEBHOOK_DEPLOY] Duplicate delivery rejected: ${deliveryId}`);
        return res.status(409).json({
            success: false,
            status: false,
            message: 'Duplicate delivery rejected (replay protection).'
        });
    }

    // 3. HMAC SHA256 verification (X-Hub-Signature-256)
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || !signature.startsWith('sha256=')) {
        return res.status(401).json({
            success: false,
            status: false,
            message: 'Missing or invalid X-Hub-Signature-256 header.'
        });
    }
    const receivedSig = signature.slice(7);
    // Gunakan raw body asli dari GitHub; JSON.stringify(req.body) bisa berbeda urutan key/spasi
    const payload = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const expectedSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

    // Timing-safe comparison (panjang buffer harus sama, jika tidak langsung tolak)
    const receivedBuf = Buffer.from(receivedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (receivedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
        console.warn(`[WEBHOOK_DEPLOY] Invalid HMAC signature for delivery: ${deliveryId}`);
        return res.status(401).json({
            success: false,
            status: false,
            message: 'Invalid HMAC signature.'
        });
    }

    // 4. Record delivery ID for replay protection
    recordDelivery(deliveryId);

    const repoRoot = findRepoRoot();

    // 5. Immediately return HTTP 200 JSON so GitHub webhook does not time out
    res.status(200).json({
        success: true,
        status: true,
        message: "Auto deploy triggered successfully!",
        repo_root: repoRoot,
        timestamp: new Date().toISOString()
    });

    // 6. Asynchronously execute git fetch, git reset, and pm2 restart
    setImmediate(() => {
        console.log(`\n==================================================`);
        console.log(`[WEBHOOK_DEPLOY] Auto deploy triggered by GitHub Webhook.`);
        console.log(`[WEBHOOK_DEPLOY] Delivery ID: ${deliveryId}`);
        console.log(`[WEBHOOK_DEPLOY] Working Directory: ${repoRoot}`);
        console.log(`==================================================`);

        const deployCmd = `git -C "${repoRoot}" pull origin main && npm --prefix "${repoRoot}/tembak-paket-app/backend" install --omit=dev --no-audit && pm2 restart all`;

        exec(deployCmd, { cwd: repoRoot, shell: true }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[WEBHOOK_DEPLOY] Deploy failed with error:`, err.message);
                if (stderr) console.error(`[WEBHOOK_DEPLOY] stderr:\n`, stderr);
                return;
            }
            console.log(`[WEBHOOK_DEPLOY] Deploy output:\n`, stdout);
            console.log(`[WEBHOOK_DEPLOY] Deploy Berhasil Tanpa Rebuild! Server telah diperbarui.`);
        });
    });
});

/**
 * GET /api/webhook/deploy
 * Health check / ping test endpoint for GitHub Webhook verification
 * Uses secret query param for manual verification (not HMAC - GET has no body)
 */
router.get(['/deploy', '/webhook/deploy'], (req, res) => {
    if (!WEBHOOK_SECRET) {
        return res.status(503).json({
            success: false,
            message: 'Webhook secret not configured on server.'
        });
    }
    const providedSecret = req.query.secret || req.headers['x-webhook-secret'];
    if (!safeSecretMatch(providedSecret, WEBHOOK_SECRET)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Akses ditolak.'
        });
    }
    res.json({
        success: true,
        message: 'Webhook Auto Deploy endpoint aktif dan siap menerima payload POST dari GitHub.',
        repo_root: findRepoRoot()
    });
});


/**
 * POST or GET /api/webhook/test-admin-wa
 * Test sending all admin notification types to both admin phone numbers
 */
router.all(["/test-admin-wa", "/webhook/test-admin-wa"], async (req, res) => {
    const providedSecret = req.query.secret || req.body?.secret || req.headers["x-webhook-secret"];
    if (!safeSecretMatch(providedSecret, WEBHOOK_SECRET)) {
        return res.status(403).json({ success: false, message: "Forbidden: Invalid secret." });
    }

    try {
        const { getAdminPhoneNumbers, sendTextMessage } = require("../services/waBot");
        const adminPhones = await getAdminPhoneNumbers();
        const timeStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        const testMessages = [
            `*TEST 1: NOTIFIKASI PENGGUNA BARU (GOOGLE)*\n──────────────────────\n*Nama:* Ryan Test (Google)\n*Email:* test.google@ry-itsolutions.web.id\n*Metode:* Login via Google (Otomatis Aktif)\n*Waktu:* ${timeStr}\n──────────────────────\nPanel Admin: https://ry-itsolutionts.web.id/admin`,

            `*TEST 2: REGISTRASI PENGGUNA BARU (PENDING)*\n──────────────────────\n*Nama:* Pelanggan Test (Manual)\n*Email:* test.manual@ry-itsolutions.web.id\n*Metode:* Form Registrasi Web\n*Waktu:* ${timeStr}\n──────────────────────\nHarap tinjau & setujui akun ini di Panel Admin:\nhttps://ry-itsolutionts.web.id/admin`,

            `*TEST 3: PESANAN BARU MASUK*\n──────────────────────\n*Order ID:* \`RY-TEST-2026\`\n*Pelanggan:* Toko Ryan Pratama\n*Layanan:* Add Roamer 3 Bulan (All Operator)\n*IMEI:* \`354892018492019\`\n*Total Biaya:* Rp 150.000\n*Kecepatan:* Fast (1-3 Jam)\n──────────────────────\n*CARA CEPAT PROSES (BALAS PESAN INI):*\n• Ketik *1* atau *.proses* -> Mulai proses\n• Ketik *2* atau *.sukses* -> Selesaikan\n• Ketik *3* atau *.gagal* -> Tolak & refund\n──────────────────────`
        ];

        const results = [];
        for (const phone of adminPhones) {
            for (let i = 0; i < testMessages.length; i++) {
                const msg = testMessages[i];
                const sendRes = await sendTextMessage(phone, msg);
                results.push({ phone, testIndex: i + 1, result: sendRes });
                await new Promise(r => setTimeout(r, 600));
            }
        }

        res.json({
            success: true,
            timestamp: timeStr,
            adminPhones,
            results
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
