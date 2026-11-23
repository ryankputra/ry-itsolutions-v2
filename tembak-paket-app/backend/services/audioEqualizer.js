/**
 * RyTone Equalizer (server-side)
 *
 * The mobile app cannot run a native equalizer, so the preset is applied here
 * with ffmpeg while the audio is proxied. The app sends ?eq=<preset> on the
 * /api/music/stream request.
 *
 * Presets:
 *   normal - passthrough (no ffmpeg, keeps streaming fast)
 *   bass   - low shelf boost + high shelf cut
 *   vocal  - presence/mid boost, bass and treble cut
 *   rock   - stronger treble and bass
 */

// ffmpeg equalizer filter chain per preset.
const PRESET_FILTERS = {
    normal: null,
    bass: 'equalizer=f=80:t=q:w=1.0:g=6,equalizer=f=8000:t=q:w=1.4:g=-3',
    vocal: 'equalizer=f=250:t=q:w=0.9:g=-4,equalizer=f=3000:t=q:w=1.6:g=5,equalizer=f=11000:t=q:w=1.4:g=-3',
    rock: 'equalizer=f=100:t=q:w=1.0:g=4,equalizer=f=4500:t=q:w=1.2:g=3,equalizer=f=11000:t=q:w=1.0:g=2',
};

const VALID_PRESETS = Object.keys(PRESET_FILTERS);

/** Normalizes ?eq= into a known preset name, or null when not valid. */
function normalizePreset(raw) {
    if (!raw) return null;
    const key = String(raw).trim().toLowerCase();
    return VALID_PRESETS.includes(key) ? key : null;
}

/**
 * Builds the ffmpeg argument list that applies a preset to an input URL.
 * Returns null for the normal preset (the raw stream is proxied as-is).
 */
function buildFfmpegArgs(preset, inputUrl) {
    const filter = PRESET_FILTERS[preset];
    if (!filter) return null;
    return [
        '-i', inputUrl,
        '-af', filter,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3',
        'pipe:1',
    ];
}

module.exports = { PRESET_FILTERS, VALID_PRESETS, normalizePreset, buildFfmpegArgs };
