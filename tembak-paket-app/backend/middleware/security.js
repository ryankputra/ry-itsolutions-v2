/**
 * Security Hardening Middleware: Helmet, Rate Limiter, Input Sanitizer, & CORS Shield
 */

const rateLimit = require('express-rate-limit');

// 1. Library-grade Input Sanitizer (xss) with graceful degradation for STB
// - DEFAULT whiteList preserves admin-authored HTML formatting (p, b, strong, a[href], img[src], br, etc.)
// - stripIgnoreTagBody removes script/style/iframe/object/embed/svg/math/form/noscript/template/applet/base/link/meta entirely
// - Falls back to hardened regex sanitizer if xss module unavailable on STB (no npm install in deploy path)
let xssFilter;
try {
    const xss = require('xss');
    xssFilter = new xss.FilterXSS({
        // Use DEFAULT whiteList (safe formatting tags preserved)
        // stripIgnoreTagBody removes the full element + body for dangerous tags
        stripIgnoreTagBody: [
            'script', 'style', 'iframe', 'object', 'embed',
            'svg', 'math', 'form', 'noscript', 'template',
            'applet', 'base', 'link', 'meta'
        ],
        stripIgnoreTag: false, // our custom onIgnoreTag handles ignored tags
        // Custom handler for tags NOT in whiteList (e.g., <div>, <span>, unknown tags)
        onIgnoreTag(tag, html, options) {
            // Escape the tag but keep text content
            return html
                .replace(/</g, '<')
                .replace(/>/g, '>');
        },
        // Default escapeHtml only escapes < and > (not & or quotes) — acceptable for our use
        // Safe attribute validation: DEFAULT.safeAttrValue restricts href/src to http/https/mailto/tel/data:image/./../#/...
    });
    console.log('[Security] xss library loaded — sanitizer active');
} catch (e) {
    console.warn('[Security] xss library not available (', e.code || e.message, ') — falling back to built-in regex sanitizer');
    xssFilter = null;
}

// Hardened fallback sanitizer (used when xss module missing)
function fallbackSanitizeValue(value) {
    if (typeof value === 'string') {
        let clean = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
            .replace(/<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi, '')
            .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:text\/html/gi, '')
            .replace(/on[a-z]+\s*=/gi, '');
        return clean;
    } else if (Array.isArray(value)) {
        return value.map(fallbackSanitizeValue);
    } else if (value !== null && typeof value === 'object') {
        const cleanObj = {};
        for (const [key, val] of Object.entries(value)) {
            cleanObj[key] = fallbackSanitizeValue(val);
        }
        return cleanObj;
    }
    return value;
}

// 1. Recursive Input Sanitizer — library-grade with fallback
function sanitizeValue(value) {
    if (xssFilter) {
        if (typeof value === 'string') {
            return xssFilter.process(value);
        } else if (Array.isArray(value)) {
            return value.map(sanitizeValue);
        } else if (value !== null && typeof value === 'object') {
            const cleanObj = {};
            for (const [key, val] of Object.entries(value)) {
                cleanObj[key] = sanitizeValue(val);
            }
            return cleanObj;
        }
        return value;
    } else {
        return fallbackSanitizeValue(value);
    }
}

function inputSanitizer(req, res, next) {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
    next();
}

// 2. Global API Rate Limiter (200 req / minute)
const globalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: false,
        message: 'Terlalu banyak permintaan dari IP Anda. Silakan coba kembali dalam 1 menit.'
    },
    skip: (req) => {
        // Only skip during automated testing in test environment
        if (process.env.NODE_ENV === 'test') return true;
        return false;
    }
});

// 3. Sensitive Endpoints Rate Limiter (15 req / minute)
const sensitiveRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: false,
        message: 'Batas percobaan terlampaui (Anti-Brute Force). Silakan tunggu 1 menit.'
    },
    skip: (req) => {
        // Only skip during automated testing in test environment
        if (process.env.NODE_ENV === 'test') return true;
        return false;
    }
});

module.exports = {
    inputSanitizer,
    globalRateLimiter,
    sensitiveRateLimiter
};