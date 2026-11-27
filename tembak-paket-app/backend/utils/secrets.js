const crypto = require('crypto');

// Cache per-process: nilai acak fallback harus SAMA untuk seluruh durasi proses,
// supaya tidak berubah di tengah request (mis. saat helper dipanggil di beberapa modul).
const fallbackCache = new Map();

/**
 * Required secret: must be set via env var. If not set or too short,
 * generates a random ephemeral value ONCE per process and logs a WARNING
 * (name only, no value). Use for authentication keys, session secrets, webhook secrets.
 */
function requiredSecret(name) {
    const v = process.env[name];
    if (v && v.length >= 16) return v;
    if (fallbackCache.has(name)) return fallbackCache.get(name);
    if (v) console.warn(`[SECRET] ${name} terlalu pendek, memakai nilai acak sementara`);
    else console.warn(`[SECRET] ${name} tidak diset di env, memakai nilai acak sementara`);
    const generated = crypto.randomBytes(32).toString('hex');
    fallbackCache.set(name, generated);
    return generated;
}

/**
 * Timing-safe string comparison for secret verification.
 * Returns false if either argument is not a string, if lengths differ,
 * or if the expected value is empty (fail-closed: an unset secret must never match).
 */
function safeSecretMatch(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    if (!expected.length || !provided.length) return false;
    if (provided.length !== expected.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
        return false;
    }
}

module.exports = { requiredSecret, safeSecretMatch };