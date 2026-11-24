'use strict';

/**
 * Unit test parser jadwal buka Rivera.
 * Fokus: pesan contoh user (bug jam menempel di baris layanan tertelan jadi cut-off SLOW).
 *
 * Jalankan: node tests/rivera-schedule-parser.test.js
 */

const assert = require('assert');
const {
    extractServiceOpenSchedules,
    extractSlowCutoff,
    extractHourFromLine,
    splitRiveraLines
} = require('../services/riveraScheduleParser');

let pass = 0;
function check(name, fn) {
    try {
        fn();
        pass++;
        console.log(`  ok  ${name}`);
    } catch (e) {
        console.error(`  FAIL ${name}\n       ${e.message}`);
        process.exitCode = 1;
    }
}

// Pesan nyata yang dilaporkan user
const USER_MESSAGE = [
    '3B SLOW SENT LAGI SAMPE SORE DONE SEKITARAN JAM 9 - 10 MALAM WIB',
    '3B FAST ON JAM 12:00 WIB',
    '1B FAST ON JAM 11:00 WIB'
].join('\n');

// Varian satu baris dengan pemisah "/" seperti yang biasa dipakai Rivera
const USER_MESSAGE_INLINE =
    '3B SLOW SENT LAGI SAMPE SORE DONE SEKITARAN JAM 9 - 10 MALAM WIB / 3B FAST ON JAM 12:00 WIB / 1B FAST ON JAM 11:00 WIB';

console.log('riveraScheduleParser — unit test');

check('pesan contoh user: FAST dijadwalkan 12:00 WIB', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE);
    assert.strictEqual(r.schedules.fast, '12:00');
});

check('pesan contoh user: 1B dijadwalkan 11:00 WIB', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE);
    assert.strictEqual(r.schedules.oneB, '11:00');
});

check('pesan contoh user: EXE tidak dijadwalkan (tidak disebut)', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE);
    assert.strictEqual(r.schedules.exe, null);
});

check('pesan contoh user (satu baris, pemisah "/"): hasil sama', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE_INLINE);
    assert.strictEqual(r.schedules.fast, '12:00');
    assert.strictEqual(r.schedules.oneB, '11:00');
});

check('pesan contoh user: 3B SLOW TIDAK ikut jadi jadwal buka', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE);
    assert.strictEqual(r.schedules.fast === '12:00' && r.schedules.oneB === '11:00', true);
    assert.strictEqual(r.scheduledLines.length, 2, 'hanya 2 baris layanan yang berjadwal');
});

check('pesan contoh user: jam layanan TIDAK terbaca sebagai cut-off SLOW', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE);
    const cutoff = extractSlowCutoff(USER_MESSAGE, r.scheduledLines);
    assert.strictEqual(cutoff, null, `cut-off seharusnya null, dapat ${JSON.stringify(cutoff)}`);
});

check('pesan contoh user (satu baris): jam layanan juga tidak jadi cut-off SLOW', () => {
    const r = extractServiceOpenSchedules(USER_MESSAGE_INLINE);
    const cutoff = extractSlowCutoff(USER_MESSAGE_INLINE, r.scheduledLines);
    assert.strictEqual(cutoff, null, `cut-off seharusnya null, dapat ${JSON.stringify(cutoff)}`);
});

check('"3B FAST ON" tanpa jam = buka sekarang, bukan jadwal', () => {
    const r = extractServiceOpenSchedules('3B FAST ON\n1B ON');
    assert.strictEqual(r.schedules.fast, null);
    assert.strictEqual(r.schedules.oneB, null);
    assert.strictEqual(r.openNowLines.length, 2);
    assert.strictEqual(r.scheduledLines.length, 0);
});

check('"1B FAST ON JAM 11:00 WIB" -> 1B menang atas FAST', () => {
    const r = extractServiceOpenSchedules('1B FAST ON JAM 11:00 WIB');
    assert.strictEqual(r.schedules.oneB, '11:00');
    assert.strictEqual(r.schedules.fast, null);
});

check('"3B IND EXE ON JAM 14:00 WIB" -> exe', () => {
    const r = extractServiceOpenSchedules('3B IND EXE ON JAM 14:00 WIB');
    assert.strictEqual(r.schedules.exe, '14:00');
});

check('baris tutup tidak dianggap jadwal buka', () => {
    const r = extractServiceOpenSchedules('3B FAST OFF\n1B CLOSE');
    assert.strictEqual(r.scheduledLines.length, 0);
    assert.strictEqual(r.openNowLines.length, 0);
});

check('cut-off SLOW tetap terbaca bila memang disebut', () => {
    const r = extractServiceOpenSchedules('3B slow last list jam 15:00 wib');
    const cutoff = extractSlowCutoff('3B slow last list jam 15:00 wib', r.scheduledLines);
    assert.deepStrictEqual(cutoff, { time: '15:00', day: 'today' });
});

check('cut-off SLOW tetap terbaca padahal ada baris FAST berjadwal', () => {
    const text = '3B slow last list jam 15:00 wib / 3B FAST ON JAM 12:00 WIB';
    const r = extractServiceOpenSchedules(text);
    const cutoff = extractSlowCutoff(text, r.scheduledLines);
    assert.deepStrictEqual(cutoff, { time: '15:00', day: 'today' });
    assert.strictEqual(r.schedules.fast, '12:00');
});

check('cut-off besok tetap terdeteksi', () => {
    const r = extractServiceOpenSchedules('3B done besok malam last list besok jam 11:00 wib');
    const cutoff = extractSlowCutoff('3B done besok malam last list besok jam 11:00 wib', r.scheduledLines);
    assert.deepStrictEqual(cutoff, { time: '11:00', day: 'tomorrow' });
});

check('extractHourFromLine menerima format jam tanpa menit', () => {
    assert.strictEqual(extractHourFromLine('3B FAST ON JAM 12 WIB'), '12:00');
    assert.strictEqual(extractHourFromLine('1B ON PUKUL 09:30'), '09:30');
    assert.strictEqual(extractHourFromLine('1B ON JAM 25:00'), null);
});

check('splitRiveraLines tidak memecah URL', () => {
    const lines = splitRiveraLines('Info: https://ry-itsolutionts.web.id/history?tab=completed&ulasan=1');
    assert.strictEqual(lines.length, 1);
});

console.log(`\n${pass} test lulus${process.exitCode ? ' (ada yang gagal)' : ', semua lulus'}`);
