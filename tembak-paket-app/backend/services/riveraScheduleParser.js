'use strict';

/**
 * Parser murni (tanpa DB / tanpa jaringan) untuk pesan grup Rivera.
 *
 * Tujuan: memisahkan dua hal yang sebelumnya tertukar —
 *   1. Jam yang MENEMPEL pada baris layanan, mis. "3B FAST ON JAM 12:00 WIB"
 *      => itu JADWAL BUKA layanan Fast (12:00 WIB), BUKAN jam cut-off 3B Slow.
 *   2. Jam cut-off / last list 3B Slow, mis. "last list jam 15:00 wib" atau
 *      "cut off besok jam 11:00".
 *
 * Modul ini sengaja tidak mengimpor config/db agar bisa diuji dengan `node` biasa.
 */

// Baris yang menyebut nama layanan spesifik (bukan sekadar "3B").
const SERVICE_LINE_RE = /\b(3B\s*SF\s*FAST|3B\s*FAST|FAST|1B|DIGIPOS|INBOUND|EXE|3B\s*IND|3B\s*INB)\b/i;
const LINE_OPEN_RE = /\b(ON|OPEN|READY|GAS|LANJUT|BUKA)\b/i;
const LINE_CLOSED_RE = /\b(OFF|FULL|TUTUP|CLOSE|CLOSED|STOP|PENDING|MODAR|DONE)\b/i;
const EXE_NAME_RE = /\b(EXE|3B\s*IND|3B\s*INBOUND)\b/i;
const ONEB_NAME_RE = /\b(1B|DIGIPOS|INBOUND)\b/i;
const FAST_NAME_RE = /\bFAST\b/i;

/**
 * Pecah pesan menjadi baris. Mendukung pemisah "/" dan "|" yang lazim dipakai
 * Rivera sebagai pemisah antrean layanan, mis. "3B FAST ON ... / 1B FAST ON ...",
 * tanpa merusak URL (butuh spasi di sekitar pemisah).
 */
function splitRiveraLines(text) {
    return String(text || '')
        .split(/\r?\n|[;,]+|\s+\/\s+|\s+\|\s+/)
        .map(l => l.trim())
        .filter(Boolean);
}

function extractHourFromLine(line) {
    const m = line.match(/\b(?:jam|pukul)\s*(\d{1,2})[.:](\d{2})/i)
        || line.match(/\b(?:jam|pukul)\s*(\d{1,2})\s*(?:wib)?\s*$/i)
        || line.match(/(\d{1,2})[.:](\d{2})\s*wib/i);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    if (!Number.isFinite(hh) || hh > 23) return null;
    const mm = (m[2] === undefined || m[2] === null) ? '00' : String(m[2]);
    if (!/^\d{2}$/.test(mm) || parseInt(mm, 10) > 59) return null;
    return `${String(hh).padStart(2, '0')}:${mm}`;
}

/**
 * Ambil jadwal buka per kecepatan dari baris layanan yang menyebut jam.
 * "3B FAST ON JAM 12:00 WIB" -> { fast: "12:00" }
 * "1B FAST ON JAM 11:00 WIB" -> { oneB: "11:00" }  (1B menang atas FAST)
 * "3B IND EXE ON JAM 14:00 WIB" -> { exe: "14:00" }
 *
 * Baris yang menyebut layanan + kata buka TANPA jam => jadwal null = "buka sekarang".
 *
 * @returns {{ schedules: {fast: string|null, oneB: string|null, exe: string|null},
 *             scheduledLines: string[], openNowLines: string[] }}
 */
function extractServiceOpenSchedules(rawText = '') {
    const schedules = { fast: null, oneB: null, exe: null };
    const scheduledLines = [];
    const openNowLines = [];

    for (const line of splitRiveraLines(rawText)) {
        if (!SERVICE_LINE_RE.test(line)) continue;
        if (!LINE_OPEN_RE.test(line)) continue;
        // Baris "3B FAST OFF" / "1B TUTUP" bukan jadwal buka.
        if (LINE_CLOSED_RE.test(line) && !LINE_OPEN_RE.test(line)) continue;

        const upper = line.toUpperCase();
        let target = null;
        if (EXE_NAME_RE.test(upper)) target = 'exe';
        else if (ONEB_NAME_RE.test(upper)) target = 'oneB';
        else if (FAST_NAME_RE.test(upper)) target = 'fast';
        if (!target) continue;

        const hour = extractHourFromLine(line);
        if (hour) {
            schedules[target] = hour;
            scheduledLines.push(line);
        } else {
            openNowLines.push(line);
        }
    }

    return { schedules, scheduledLines, openNowLines };
}

/** Buang baris jadwal buka dari teks, agar jamnya tidak ikut terbaca sebagai cut-off Slow. */
function stripLines(text, lines = []) {
    let out = String(text || '');
    for (const line of lines) {
        if (line) out = out.split(line).join(' ');
    }
    return out;
}

/**
 * Jam cut-off / last list 3B Slow, dari teks yang sudah dibersihkan dari baris jadwal buka.
 * @returns {{time: string, day: 'today'|'tomorrow'}|null}
 */
function extractSlowCutoff(rawText = '', excludeLines = []) {
    const text = stripLines(rawText, excludeLines);
    const m = text.match(/(?:cut\s*off|close\s*list|last\s*list|list\s*sampai)\s*(?:besok\s*(?:pagi|siang|sore|malem|malam)?\s*)?(?:jam\s*)?(\d{1,2})[.:](\d{2})/i)
        || text.match(/(?:jam\s*)(\d{1,2})[.:](\d{2})\s*wib/i);
    if (!m) return null;
    return {
        time: `${m[1].padStart(2, '0')}:${m[2]}`,
        day: /besok/i.test(text) ? 'tomorrow' : 'today'
    };
}

module.exports = {
    splitRiveraLines,
    extractHourFromLine,
    extractServiceOpenSchedules,
    extractSlowCutoff
};
