/**
 * Test publish Story Disclaimer (redesign) ke WhatsApp Story saja.
 * Dipakai manual: node scripts/test-disclaimer-story.js
 * Catatan: jalankan saat proses backend (pm2) berhenti agar sesi Baileys tidak bentrok.
 */
const sharp = require('sharp');
const ig = require('../services/igDirectService');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    const wa = require('../services/waBot');
    try {
        console.log('[test] init WA bot...');
        await wa.initWABot(false);

        let st = wa.getWAStatus();
        for (let i = 0; i < 60; i++) {
            st = wa.getWAStatus();
            if (st.connected || st.isConnected) break;
            await wait(2000);
        }
        if (!(st.connected || st.isConnected)) {
            throw new Error('Bot WA tidak terhubung (state: ' + st.state + ')');
        }
        console.log('[test] WA connected:', st.connectedPhone || '-');

        const theme = ig.getSoftDailyTheme();
        const track = ig.getRandomTrack();
        const bg = await ig.getStoryBackgroundMarkup(theme);
        const svg = await ig.generateSoftDisclaimerSvg(theme, track, bg);
        const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
        console.log('[test] banner disclaimer dibuat:', jpeg.length, 'bytes');

        const videoData = await ig.generateStoryVideo(jpeg, track);
        const media = videoData?.videoBuffer || jpeg;
        const isVid = Boolean(videoData?.videoBuffer);
        console.log('[test] media:', isVid ? 'video' : 'foto', media.length, 'bytes');

        const caption = `⚠️ *DISCLAIMER RESMI ADD ROAMER*\n\n` +
            `❌ *Tidak ada Add Roamer yang permanen.* Waspada penipuan!\n` +
            `✅ *Hanya tersedia opsi 1 Bulan & 3 Bulan* (All Operator).\n\n` +
            `🛡️ Garansi penuh & nota transaksi digital resmi.\n` +
            `🌐 https://ry-itsolutionts.web.id`;

        const res = await wa.publishWhatsAppStory(media, caption, isVid);
        console.log('[test] RESULT:', JSON.stringify(res));
        process.exit(0);
    } catch (e) {
        console.error('[test] GAGAL:', e.message);
        process.exit(1);
    }
})();
