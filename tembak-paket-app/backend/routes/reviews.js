/**
 * Customer Reviews & Ratings Routes
 */

const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// 1. GET /api/reviews
router.get('/reviews', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const productId = req.query.productId || req.query.serviceType || 'add-roamer';
        // LEFT JOIN transactions: enrich variation dengan packageName + speed_option asli,
        // sehingga ulasan tidak pernah menampilkan nama paket yang tidak pernah dijual.
        let query = `SELECT r.*, t.packageName AS trxPackageName, t.speed_option AS trxSpeed FROM reviews r LEFT JOIN transactions t ON r.orderId = t.id WHERE 1=1`;
        const params = [];
        if (productId && productId !== 'all') {
            if (productId === 'unblock-imei' || productId === 'imei' || productId === 'add-roamer') {
                query += " AND (r.productId IN ('unblock-imei', 'imei', 'add-roamer') AND r.serviceType IN ('unblock-imei', 'imei'))";
            } else {
                query += " AND (r.productId = ? OR r.serviceType = ?)";
                params.push(productId, productId);
            }
        }
        query += " ORDER BY r.createdAt DESC";

        const reviewsList = await dbAll(query, params);

        let sumRating = 0;
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let withPhotosCount = 0;

        const formattedReviews = (reviewsList || []).map(r => {
            sumRating += Number(r.rating) || 5;
            const star = Math.min(5, Math.max(1, Math.round(r.rating)));
            ratingCounts[star] = (ratingCounts[star] || 0) + 1;
            const imgs = [];
            try { imgs = JSON.parse(r.images || '[]'); } catch(e){}
            if (imgs && imgs.length > 0) withPhotosCount++;

            // Enrich variation: pakai packageName + speed_option asli dari transaksi
            // supaya label selalu akurat (cepat/lambat), tidak bisa salah input user.
            let finalVariation = r.variation || "";
            if (r.trxPackageName) {
                const pkg = String(r.trxPackageName).replace(/\s*\((slow|fast|normal)\)$/i, "").trim();
                const speed = r.trxSpeed ? String(r.trxSpeed).trim() : "";
                finalVariation = speed
                    ? `${pkg} (${speed.charAt(0).toUpperCase()}${speed.slice(1).toLowerCase()})`
                    : pkg;
            }
            return {
                ...r,
                variation: finalVariation,
                images: imgs
            };
        });

        const total = formattedReviews.length;
        const avgRating = total > 0 ? (sumRating / total).toFixed(1) : "0.0";

        res.json({
            status: true,
            summary: {
                averageRating: Number(avgRating),
                totalReviews: total,
                ratingCounts: {
                    5: ratingCounts[5] || 0,
                    4: ratingCounts[4] || 0,
                    3: ratingCounts[3] || 0,
                    2: ratingCounts[2] || 0,
                    1: ratingCounts[1] || 0,
                },
                withPhotosCount
            },
            reviews: formattedReviews
        });
    } catch (err) {
        console.error("Error fetching reviews:", err);
        res.status(500).json({ status: false, message: "Gagal memuat ulasan." });
    }
});

// 2. GET /api/reviews/check-eligibility
// Hanya yang sudah punya transaksi IMEI sukses (success ATAU completed) untuk produk ini yang boleh mengulas.
// Per-order review: satu review per order/transaksi, bukan per user selamanya.
router.get('/reviews/check-eligibility', isAuthenticated, async (req, res) => {
    try {
        const targetProduct = (req.query.productId || req.query.serviceType || 'add-roamer').toString();

        // BUG RATING (a): terima 'success' DAN 'completed' (konsisten dengan frontend)
        const userTrx = await dbAll(
            `SELECT t.id, t.packageName, t.service_type, t.speed_option, t.createdAt, t.status
             FROM transactions t
             WHERE t.userId = ? AND t.status IN ('success', 'completed') AND t.service_type = 'imei'
             ORDER BY t.createdAt DESC`,
            [req.session.userId]
        );

        const hasImeiOrder = (userTrx || []).length > 0;

        // Cek apakah user sudah pernah memberi ulasan UNTUK ORDER TERTENTU (per-order, bukan per-user-forever)
        // Jika client mengirim orderId, cek per order; jika tidak, cek apakah ada order manapun yang belum diulas
        const requestedOrderId = req.query.orderId;
        let existingReview = null;
        if (requestedOrderId) {
            existingReview = await dbGet(
                `SELECT r.id FROM reviews r WHERE r.userId = ? AND r.orderId = ? LIMIT 1`,
                [req.session.userId, requestedOrderId]
            );
        } else {
            // Fallback lama (untuk kompatibilitas): cek per produk
            existingReview = await dbGet(
                `SELECT r.id FROM reviews r
                 WHERE r.userId = ? AND (r.productId = ? OR r.serviceType = 'imei')
                 LIMIT 1`,
                [req.session.userId, targetProduct]
            );
        }

        const canReview = hasImeiOrder && !existingReview;

        res.json({
            status: true,
            canReview,
            reason: !hasImeiOrder
                ? "Belum ada transaksi Add Roamer yang selesai. Pesan dulu untuk bisa mengulas."
                : existingReview
                    ? "Anda sudah pernah memberikan ulasan untuk order ini."
                    : null,
            completedOrders: userTrx || []
        });
    } catch (err) {
        res.status(500).json({ status: false, canReview: false });
    }
});

// 3. POST /api/reviews
router.post('/reviews', isAuthenticated, async (req, res) => {
    try {
        const { orderId, productId, rating, comment, variation, images } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ status: false, message: "Rating bintang 1-5 wajib diisi." });
        }
        if (!comment || comment.trim().length < 2) {
            return res.status(400).json({ status: false, message: "Tulis ulasan minimal 2 karakter." });
        }

        const userObj = await dbGet("SELECT id, name, email, avatar, role, verifiedPhone, createdAt FROM users WHERE id = ?", [req.session.userId]);
        if (!userObj) {
            return res.status(401).json({ status: false, message: "User tidak ditemukan. Silakan login ulang." });
        }

        // Validasi server-side: wajib transaksi IMEI sukses (success ATAU completed), dan belum pernah ulas ORDER INI.
        // BUG RATING (b): batas satu review per ORDER/TRANSAKSI (bukan per user selamanya)
        // orderId WAJIB dikirim client; kalau tidak, tolak (mencegah spam review tanpa order)
        if (!orderId) {
            return res.status(400).json({ status: false, message: "orderId wajib diisi untuk menautkan review ke transaksi." });
        }
        const trx = await dbGet(
            `SELECT id, packageName, speed_option, createdAt, status FROM transactions
             WHERE id = ? AND userId = ? AND status IN ('success', 'completed') AND service_type = 'imei'
             LIMIT 1`,
            [orderId, req.session.userId]
        );
        if (!trx) {
            return res.status(403).json({ status: false, message: "Transaksi tidak ditemukan atau belum selesai (harus success/completed)." });
        }

        // Cek review per order
        const alreadyReviewed = await dbGet(
            `SELECT id FROM reviews WHERE userId = ? AND orderId = ? LIMIT 1`,
            [req.session.userId, orderId]
        );
        if (alreadyReviewed) {
            return res.status(403).json({ status: false, message: "Anda sudah pernah memberikan ulasan untuk order ini." });
        }

        const orderCount = await dbGet("SELECT COUNT(*) AS total FROM transactions WHERE userId = ?", [req.session.userId]);
        const userName = userObj.name || userObj.email?.split('@')[0] || 'Pembeli Terverifikasi';
        const userAvatar = userObj.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`;
        const userTotalOrders = Number(orderCount?.total) || 1;
        const accountRole = String(userObj.role || '').toLowerCase();
        const userRole = accountRole.includes('admin') ? 'Official Admin' : (accountRole.includes('konter') || accountRole.includes('mitra') ? 'Konter Mitra' : userTotalOrders >= 5 ? 'Reseller VIP' : 'Pembeli Terverifikasi');
        const joinedAt = new Date(userObj.createdAt || '2026-01-02T00:00:00.000Z');
        const userJoinedAt = joinedAt.toISOString();
        const transactionDate = trx.createdAt || new Date().toISOString();

        const reviewId = `rev_${Date.now()}`;
        const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);

        // finalVariation selalu dari transaksi asli + speed_option (Slow/Fast)
        const pkgClean = String(trx.packageName || variation || "Layanan Add Roamer").replace(/\s*\((slow|fast|normal)\)$/i, "").trim();
        const speedRaw = String(trx.speed_option || "").trim();
        const speedLabel = speedRaw ? ` (${speedRaw.charAt(0).toUpperCase()}${speedRaw.slice(1).toLowerCase()})` : "";
        const finalVariation = `${pkgClean}${speedLabel}`;

        await dbRun(
            `INSERT INTO reviews (id, userId, userName, userAvatar, orderId, productId, serviceType, variation, rating, comment, images, likesCount, transactionDate, userJoinedAt, userTotalOrders, userRole, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
            [reviewId, req.session.userId, userName, userAvatar, orderId, productId || 'add-roamer', 'imei', finalVariation, Number(rating), comment.trim(), imagesJson, transactionDate, userJoinedAt, userTotalOrders, userRole, new Date().toISOString()]
        );

        // Bonus Reward +10 RyPoints — BUG RATING (b): non-repeatable per ORDER via user_coin_claims
        // claim_type = 'review_bonus' + orderId sebagai differentiator
        try {
            const claimId = `clm_review_${orderId}_${Date.now()}`;
            const existingClaim = await dbGet(
                `SELECT id FROM user_coin_claims WHERE userId = ? AND claim_type = ? AND claimed_at LIKE ?`,
                [req.session.userId, `review_bonus_${orderId}`, `${new Date().toISOString().slice(0, 10)}%`]
            );
            if (!existingClaim) {
                await dbRun("UPDATE users SET coins = coins + 10 WHERE id = ?", [req.session.userId]);
                await dbRun("INSERT INTO user_coin_claims (id, userId, claim_type, coins_amount, claimed_at) VALUES (?, ?, ?, 10, ?)", [claimId, req.session.userId, `review_bonus_${orderId}`, new Date().toISOString()]);
            }
        } catch (e) {
            console.warn('[reviews] Gagal bonus coin:', e.message);
        }

        const newReviewObj = {
            id: reviewId,
            userId: req.session.userId,
            userName,
            userAvatar,
            orderId,
            productId: productId || 'add-roamer',
            serviceType: 'imei',
            variation: finalVariation,
            rating: Number(rating),
            comment: comment.trim(),
            images: Array.isArray(images) ? images : [],
            likesCount: 0,
            transactionDate,
            userJoinedAt,
            userTotalOrders,
            userRole,
            createdAt: new Date().toISOString()
        };

        res.json({
            status: true,
            message: "Ulasan Anda berhasil dikirim dan ditampilkan! Bonus +10 RyPoints telah masuk ke akun Anda.",
            reviewId,
            review: newReviewObj
        });
    } catch (err) {
        console.error("Error creating review:", err);
        res.status(500).json({ status: false, message: "Gagal menyimpan ulasan: " + err.message });
    }
});

// 4. POST /api/reviews/:id/like
router.post('/reviews/:id/like', async (req, res) => {
    try {
        await dbRun("UPDATE reviews SET likesCount = likesCount + 1 WHERE id = ?", [req.params.id]);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

module.exports = router;
