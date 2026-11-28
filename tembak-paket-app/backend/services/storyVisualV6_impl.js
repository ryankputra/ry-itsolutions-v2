const W = 1080, H = 1920;
const L = {
  margin: 90,
  logoX: 90, logoY: 268, logoSize: 56,
  brandBaseline: 318,
  badgeX: 560, badgeY: 280, badgeW: 430, badgeH: 60,
  badgeBaseline: 320,
  eyebrowBaseline: 746,
  h1a: 858, h1b: 956,
  cardX: 90, cardY: 1040, cardW: 900, cardH: 292,
  cardTitle: 1124, line1: 1210, line2: 1280,
  ctaX: 90, ctaY: 1390, ctaW: 900, ctaH: 120,
  ctaBaseline: 1467,
  footerBaseline: 1560,
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function solid(color, opacity = 1) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${color}" opacity="${opacity}"/></svg>`);
}
function gradient(stops) {
  const gs = stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${gs}</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);
}
async function noiseTile() {
  const raw = Buffer.alloc(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    raw[i * 4] = raw[i * 4 + 1] = raw[i * 4 + 2] = v;
    raw[i * 4 + 3] = Math.floor(Math.random() * 30);
  }
  return sharp(raw, { raw: { width: 256, height: 256, channels: 4 } }).png().toBuffer();
}

const HEAD_SIZE = { senin: 92, selasa: 88, rabu: 104, kamis: 92, jumat: 100, sabtu: 86, minggu: 84 };

// Each day uses a different visual system: grid, editorial, brand block, airy split,
// dark neon, lifestyle collage, retro ticket. Info bands stay in the same safe zone.
function textSvg(t) {
  const c = t.content;
  const hs = HEAD_SIZE[t.key] || 92;
  const hw = t.hWeight || 800;
  const hsp = t.hSpacing ?? -2;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${t.font}">`;

  if (t.key === 'senin') {
    return `${open}
    <g opacity="0.16" stroke="#FFFFFF" stroke-width="1">
      <line x1="90" y1="240" x2="90" y2="1600"/><line x1="990" y1="240" x2="990" y2="1600"/>
      <line x1="90" y1="700" x2="990" y2="700"/><line x1="90" y1="1030" x2="990" y2="1030"/>
      <line x1="90" y1="1520" x2="990" y2="1520"/>
    </g>
    <text x="990" y="660" text-anchor="end" font-size="300" font-weight="200" fill="#FFFFFF" opacity="0.10">01</text>
    <rect x="90" y="268" width="56" height="56" rx="0" fill="none" stroke="${t.markFill}" stroke-width="3"/>
    <text x="118" y="303" text-anchor="middle" font-size="30" font-weight="300" fill="${t.markText}">R</text>
    <text x="158" y="318" font-size="28" font-weight="300" letter-spacing="5" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="0" fill="none" stroke="${t.badgeStroke}" stroke-width="2"/>
    <text x="775" y="320" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="2" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="90" y="746" font-size="24" font-weight="300" letter-spacing="7" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <rect x="90" y="806" width="5" height="158" fill="#FFFFFF"/>
    <text x="112" y="${L.h1a}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head1)}</text>
    <text x="112" y="${L.h1b}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head2)}</text>
    <rect x="90" y="1040" width="900" height="292" rx="0" fill="${t.cardFill}" stroke="#FFFFFF" stroke-width="1"/>
    <text x="130" y="1124" font-size="36" font-weight="700" letter-spacing="3" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <line x1="130" y1="1150" x2="950" y2="1150" stroke="${t.cardRule}" stroke-width="1"/>
    <text x="130" y="1210" font-size="27" font-weight="400" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="25" font-weight="300" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <rect x="90" y="1390" width="900" height="120" rx="0" fill="${t.ctaFill}"/>
    <text x="540" y="1467" text-anchor="middle" font-size="36" font-weight="700" letter-spacing="1" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="930" y="1467" text-anchor="end" font-size="40" font-weight="300" fill="${t.ctaText}">â†’</text>
    <text x="90" y="1560" font-size="20" font-weight="400" letter-spacing="4" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  if (t.key === 'selasa') {
    return `${open}
    <line x1="90" y1="240" x2="990" y2="240" stroke="#D8A469" stroke-width="3"/>
    <line x1="90" y1="247" x2="990" y2="247" stroke="#D8A469" stroke-width="1"/>
    <text x="990" y="700" text-anchor="end" font-size="320" font-weight="700" fill="none" stroke="#D8A469" stroke-width="2" opacity="0.28">02</text>
    <text x="90" y="370" font-size="20" font-style="italic" letter-spacing="3" fill="${t.eyebrowColor}">EST. 2026 â€¢ DAILY NOTES</text>
    <circle cx="118" cy="296" r="28" fill="${t.markFill}"/>
    <text x="118" y="306" text-anchor="middle" font-size="30" font-weight="700" fill="${t.markText}">R</text>
    <text x="158" y="306" font-size="30" font-weight="700" font-style="italic" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="30" fill="${t.badgeFill}" stroke="${t.badgeStroke}" stroke-width="2"/>
    <text x="775" y="320" text-anchor="middle" font-size="22" font-weight="700" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="540" y="746" text-anchor="middle" font-size="25" font-weight="700" letter-spacing="6" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <text x="540" y="${L.h1a}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head1)}</text>
    <text x="540" y="${L.h1b}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" font-style="italic" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head2)}</text>
    <rect x="90" y="1040" width="900" height="292" rx="4" fill="${t.cardFill}"/>
    <line x1="560" y1="1070" x2="560" y2="1300" stroke="${t.cardRule}" stroke-width="2"/>
    <text x="130" y="1124" font-size="38" font-weight="700" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <text x="130" y="1210" font-size="27" font-weight="500" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="25" font-weight="400" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <text x="910" y="1260" text-anchor="end" font-size="130" font-weight="700" fill="#D8A469" opacity="0.16">02</text>
    <rect x="90" y="1390" width="900" height="120" rx="2" fill="${t.ctaFill}"/>
    <rect x="98" y="1398" width="884" height="104" rx="2" fill="none" stroke="#D8A469" stroke-width="1" opacity="0.7"/>
    <text x="540" y="1467" text-anchor="middle" font-size="38" font-weight="700" font-style="italic" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="90" y="1560" font-size="23" font-weight="400" font-style="italic" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  if (t.key === 'rabu') {
    return `${open}
    <defs><clipPath id="wedge"><polygon points="0,690 1080,540 1080,1020 0,1170"/></clipPath></defs>
    <g clip-path="url(#wedge)"><rect x="0" y="520" width="1080" height="680" fill="#0071e3" opacity="0.95"/></g>
    <circle cx="1010" cy="700" r="240" fill="#2997ff" opacity="0.35"/>
    <text x="1010" y="1000" text-anchor="end" font-size="330" font-weight="900" fill="#FFFFFF" opacity="0.10">RY</text>
    <rect x="90" y="268" width="56" height="56" rx="10" fill="${t.markFill}"/>
    <text x="118" y="306" text-anchor="middle" font-size="32" font-weight="900" fill="${t.markText}">R</text>
    <text x="158" y="312" font-size="31" font-weight="900" letter-spacing="1" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="30" fill="${t.badgeFill}"/>
    <rect x="560" y="280" width="14" height="60" rx="7" fill="#0071e3"/>
    <text x="783" y="320" text-anchor="middle" font-size="22" font-weight="900" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="90" y="746" font-size="26" font-weight="900" letter-spacing="2" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <line x1="90" y1="762" x2="620" y2="762" stroke="#2997ff" stroke-width="6"/>
    <text x="90" y="${L.h1a}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head1)}</text>
    <text x="90" y="${L.h1b}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head2)}</text>
    <rect x="90" y="1040" width="900" height="292" rx="16" fill="${t.cardFill}"/>
    <rect x="90" y="1040" width="18" height="292" rx="9" fill="#0071e3"/>
    <text x="140" y="1124" font-size="40" font-weight="900" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <line x1="140" y1="1150" x2="950" y2="1150" stroke="${t.cardRule}" stroke-width="3"/>
    <text x="140" y="1210" font-size="27" font-weight="700" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="140" y="1280" font-size="25" font-weight="600" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <text x="940" y="1300" text-anchor="end" font-size="120" font-weight="900" fill="#0071e3" opacity="0.12">NEW</text>
    <rect x="90" y="1390" width="900" height="120" rx="60" fill="${t.ctaFill}"/>
    <text x="530" y="1467" text-anchor="middle" font-size="38" font-weight="900" fill="${t.ctaText}">${esc(c.cta)}</text>
    <circle cx="935" cy="1450" r="38" fill="#FFFFFF" opacity="0.18"/>
    <text x="935" y="1462" text-anchor="middle" font-size="38" font-weight="900" fill="#FFFFFF">â†’</text>
    <text x="90" y="1560" font-size="24" font-weight="900" letter-spacing="2" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  if (t.key === 'kamis') {
    return `${open}
    <line x1="90" y1="360" x2="990" y2="360" stroke="#0071e3" stroke-width="4"/>
    <circle cx="990" cy="700" r="180" fill="none" stroke="#0071e3" stroke-width="2" opacity="0.18"/>
    <circle cx="90" cy="1000" r="120" fill="none" stroke="#0071e3" stroke-width="2" opacity="0.18"/>
    <circle cx="118" cy="296" r="28" fill="${t.markFill}"/>
    <text x="118" y="306" text-anchor="middle" font-size="30" font-weight="700" fill="${t.markText}">R</text>
    <text x="158" y="306" font-size="29" font-weight="600" letter-spacing="3" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="30" fill="${t.badgeFill}" stroke="${t.badgeStroke}" stroke-width="2"/>
    <circle cx="590" cy="310" r="8" fill="#0071e3"/>
    <text x="790" y="320" text-anchor="middle" font-size="22" font-weight="600" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="990" y="746" text-anchor="end" font-size="24" font-weight="600" letter-spacing="5" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <text x="990" y="${L.h1a}" text-anchor="end" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head1)}</text>
    <text x="990" y="${L.h1b}" text-anchor="end" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}">${esc(c.head2)}</text>
    <line x1="690" y1="980" x2="990" y2="980" stroke="#0071e3" stroke-width="5"/>
    <rect x="90" y="1040" width="900" height="292" rx="30" fill="${t.cardFill}" stroke="${t.cardStroke}" stroke-width="2"/>
    <text x="130" y="1124" font-size="40" font-weight="600" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <line x1="130" y1="1150" x2="950" y2="1150" stroke="${t.cardRule}" stroke-width="2"/>
    <text x="130" y="1210" font-size="27" font-weight="600" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="25" font-weight="500" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <g fill="none" stroke="#0071e3" stroke-width="2"><circle cx="850" cy="1230" r="30"/><circle cx="910" cy="1230" r="30"/><circle cx="970" cy="1230" r="30"/></g>
    <text x="850" y="1238" text-anchor="middle" font-size="24" font-weight="700" fill="#0071e3">1</text>
    <text x="910" y="1238" text-anchor="middle" font-size="24" font-weight="700" fill="#0071e3">2</text>
    <text x="970" y="1238" text-anchor="middle" font-size="24" font-weight="700" fill="#0071e3">3</text>
    <rect x="90" y="1390" width="900" height="120" rx="60" fill="${t.ctaFill}"/>
    <text x="540" y="1467" text-anchor="middle" font-size="38" font-weight="600" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="90" y="1560" font-size="22" font-weight="500" letter-spacing="2" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  if (t.key === 'jumat') {
    return `${open}
    <defs><filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <ellipse cx="540" cy="880" rx="540" ry="280" fill="#0071e3" opacity="0.18"/>
    <g fill="#2997ff" opacity="0.35">
      <circle cx="150" cy="500" r="3"/><circle cx="220" cy="500" r="3"/><circle cx="290" cy="500" r="3"/><circle cx="360" cy="500" r="3"/><circle cx="430" cy="500" r="3"/>
      <circle cx="650" cy="500" r="3"/><circle cx="720" cy="500" r="3"/><circle cx="790" cy="500" r="3"/><circle cx="860" cy="500" r="3"/><circle cx="930" cy="500" r="3"/>
    </g>
    <circle cx="118" cy="296" r="28" fill="none" stroke="${t.markFill}" stroke-width="3"/>
    <text x="118" y="306" text-anchor="middle" font-size="30" font-weight="800" fill="${t.markText}">R</text>
    <text x="158" y="306" font-size="29" font-weight="700" letter-spacing="4" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="30" fill="${t.badgeFill}" stroke="${t.badgeStroke}" stroke-width="2"/>
    <text x="775" y="320" text-anchor="middle" font-size="22" font-weight="800" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="540" y="746" text-anchor="middle" font-size="25" font-weight="700" letter-spacing="6" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <text x="540" y="${L.h1a}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}" filter="url(#neonGlow)">${esc(c.head1)}</text>
    <text x="540" y="${L.h1b}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}" filter="url(#neonGlow)">${esc(c.head2)}</text>
    <rect x="90" y="1040" width="900" height="292" rx="30" fill="${t.cardFill}" stroke="#2997ff" stroke-width="2" opacity="0.96"/>
    <text x="130" y="1124" font-size="39" font-weight="700" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <line x1="130" y1="1150" x2="950" y2="1150" stroke="${t.cardRule}" stroke-width="2"/>
    <text x="130" y="1210" font-size="27" font-weight="600" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="25" font-weight="500" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <g fill="#2997ff"><circle cx="880" cy="1120" r="8"/><circle cx="920" cy="1120" r="8" opacity="0.5"/><circle cx="960" cy="1120" r="8" opacity="0.25"/></g>
    <rect x="90" y="1390" width="900" height="120" rx="60" fill="${t.ctaFill}" filter="url(#neonGlow)"/>
    <text x="540" y="1467" text-anchor="middle" font-size="38" font-weight="800" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="90" y="1560" font-size="22" font-weight="500" letter-spacing="2" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  if (t.key === 'sabtu') {
    return `${open}
    <g transform="rotate(-7 880 306)">
      <rect x="800" y="272" width="170" height="62" rx="12" fill="#34c759"/>
      <text x="885" y="312" text-anchor="middle" font-size="26" font-weight="800" fill="#082012">WEEKEND</text>
    </g>
    <line x1="90" y1="700" x2="480" y2="700" stroke="#B7F0C9" stroke-width="3" stroke-dasharray="12 10"/>
    <rect x="90" y="268" width="56" height="56" rx="16" fill="${t.markFill}"/>
    <text x="118" y="306" text-anchor="middle" font-size="32" font-weight="800" fill="${t.markText}">R</text>
    <text x="158" y="310" font-size="29" font-weight="800" letter-spacing="2" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <g transform="rotate(-5 775 310)">
      <rect x="560" y="280" width="430" height="60" rx="30" fill="${t.badgeFill}" stroke="${t.badgeStroke}" stroke-width="2"/>
      <text x="775" y="320" text-anchor="middle" font-size="22" font-weight="800" fill="${t.badgeText}">${esc(c.badge)}</text>
    </g>
    <text x="90" y="746" font-size="25" font-weight="800" letter-spacing="4" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <text x="90" y="${L.h1a}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}" style="filter:drop-shadow(0 8px 14px rgba(0,0,0,0.55))">${esc(c.head1)}</text>
    <text x="90" y="${L.h1b}" font-size="${hs}" font-weight="${hw}" letter-spacing="${hsp}" fill="${t.headColor}" style="filter:drop-shadow(0 8px 14px rgba(0,0,0,0.55))">${esc(c.head2)}</text>
    <rect x="400" y="1020" width="160" height="34" rx="4" fill="#F3E3C3" opacity="0.75" transform="rotate(-4 480 1037)"/>
    <rect x="90" y="1040" width="900" height="292" rx="34" fill="${t.cardFill}"/>
    <text x="130" y="1124" font-size="39" font-weight="800" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <line x1="130" y1="1150" x2="950" y2="1150" stroke="${t.cardRule}" stroke-width="2" stroke-dasharray="10 8"/>
    <text x="130" y="1210" font-size="27" font-weight="700" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="25" font-weight="500" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <rect x="90" y="1390" width="900" height="120" rx="60" fill="${t.ctaFill}"/>
    <text x="540" y="1467" text-anchor="middle" font-size="38" font-weight="800" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="90" y="1560" font-size="22" font-weight="600" letter-spacing="2" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
  }

  return `${open}
    <rect x="0" y="0" width="${W}" height="66" fill="#120B05"/><rect x="0" y="1854" width="${W}" height="66" fill="#120B05"/>
    <g fill="#E8B87E" opacity="0.75">
      <rect x="40" y="16" width="34" height="30" rx="4"/><rect x="140" y="16" width="34" height="30" rx="4"/><rect x="240" y="16" width="34" height="30" rx="4"/>
      <rect x="340" y="16" width="34" height="30" rx="4"/><rect x="440" y="16" width="34" height="30" rx="4"/><rect x="540" y="16" width="34" height="30" rx="4"/>
      <rect x="640" y="16" width="34" height="30" rx="4"/><rect x="740" y="16" width="34" height="30" rx="4"/><rect x="840" y="16" width="34" height="30" rx="4"/>
      <rect x="940" y="16" width="34" height="30" rx="4"/>
    </g>
    <text x="940" y="560" text-anchor="end" font-size="240" font-weight="700" fill="none" stroke="#F0A860" stroke-width="2" opacity="0.28">07</text>
    <rect x="90" y="268" width="56" height="56" rx="4" fill="${t.markFill}"/>
    <text x="118" y="306" text-anchor="middle" font-size="30" font-weight="700" fill="${t.markText}">R</text>
    <text x="158" y="306" font-size="27" font-weight="700" letter-spacing="4" fill="${t.brandColor}">RY-ITSOLUTIONS</text>
    <rect x="560" y="280" width="430" height="60" rx="4" fill="${t.badgeFill}" stroke="${t.badgeStroke}" stroke-width="2" stroke-dasharray="8 5"/>
    <text x="775" y="320" text-anchor="middle" font-size="21" font-weight="700" letter-spacing="1" fill="${t.badgeText}">${esc(c.badge)}</text>
    <text x="540" y="746" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="5" fill="${t.eyebrowColor}">${esc(c.eyebrow)}</text>
    <text x="540" y="${L.h1a}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" letter-spacing="2" fill="${t.headColor}">${esc(c.head1)}</text>
    <text x="540" y="${L.h1b}" text-anchor="middle" font-size="${hs}" font-weight="${hw}" letter-spacing="2" fill="${t.headColor}">${esc(c.head2)}</text>
    <rect x="90" y="1040" width="900" height="292" rx="8" fill="${t.cardFill}"/>
    <circle cx="90" cy="1186" r="18" fill="#120B05"/><circle cx="990" cy="1186" r="18" fill="#120B05"/>
    <line x1="120" y1="1150" x2="960" y2="1150" stroke="${t.cardRule}" stroke-width="2" stroke-dasharray="12 8"/>
    <text x="130" y="1124" font-size="38" font-weight="700" letter-spacing="1" fill="${t.cardTitleColor}">${esc(c.cardTitle)}</text>
    <text x="130" y="1210" font-size="26" font-weight="700" fill="${t.cardText}">${esc(c.line1)}</text>
    <text x="130" y="1280" font-size="24" font-weight="500" fill="${t.cardMuted}">${esc(c.line2)}</text>
    <rect x="90" y="1390" width="900" height="120" rx="0" fill="${t.ctaFill}"/>
    <rect x="100" y="1400" width="880" height="100" rx="0" fill="none" stroke="#F0A860" stroke-width="2" stroke-dasharray="10 6"/>
    <text x="540" y="1467" text-anchor="middle" font-size="37" font-weight="700" letter-spacing="2" fill="${t.ctaText}">${esc(c.cta)}</text>
    <text x="540" y="1810" text-anchor="middle" font-size="26" font-weight="700" letter-spacing="5" fill="#F0A860">MINGGU â€¢ 07</text>
    <text x="90" y="1560" font-size="22" font-weight="700" letter-spacing="3" fill="${t.footerColor}">ry-itsolutionts.web.id</text>
  </svg>`;
}

// Content verified from backend/services/igDirectService.js (baseline Story templates).
const skins = [
  {
    key: 'senin', name: 'Minimal Monokrom', day: 'Senin', themeName: 'Royal Cobalt', font: 'Segoe UI',
    content: {
      badge: 'ONLINE & READY', eyebrow: 'STORY OPEN â€¢ SENIN', head1: 'WE ARE', head2: 'OPEN!',
      cardTitle: 'LAYANAN PRIORITAS HARI INI',
      line1: 'Add Roamer â€¢ Cek Status CEIR â€¢ Klaim Garansi',
      line2: 'Mendukung: Telkomsel, Indosat, XL, Tri, SF',
      cta: 'Fast Response via WhatsApp & Web',
    },
    greyscale: true, brightness: 0.92, saturation: 0,
    scrim: [[0, '#000000', 0.84], [0.15, '#000000', 0.82], [0.22, '#000000', 0.38], [0.32, '#000000', 0.5], [0.38, '#000000', 0.86], [0.55, '#000000', 0.94], [1, '#000000', 0.97]],
    markFill: '#FFFFFF', markText: '#111111', brandColor: '#FFFFFF',
    badgeFill: '#FFFFFF', badgeText: '#15803D', badgeStroke: '#86EFAC',
    rule: `<line x1="90" y1="352" x2="990" y2="352" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2"/>`,
    eyebrowColor: '#E4E4E4', headColor: '#FFFFFF', hWeight: 300, hSpacing: -1,
    cardFill: '#111111', cardTitleColor: '#FFFFFF', cardText: '#FFFFFF', cardMuted: '#DCDCDC', cardRule: '#4A4A4A', cardRadius: 12,
    ctaFill: '#FFFFFF', ctaText: '#111111', footerColor: '#E0E0E0',
  },
  {
    key: 'selasa', name: 'Editorial Hangat', day: 'Selasa', themeName: 'Sapphire Fintech', font: 'Georgia',
    content: {
      badge: 'EDUKASI & TRANSPARANSI', eyebrow: 'DISCLAIMER â€¢ SELASA', head1: 'TIDAK ADA', head2: 'PERMANEN',
      cardTitle: 'LAYANAN ADD ROAMER',
      line1: 'Waspada unblock permanen, Add Roamer berjangka.',
      line2: 'Hanya opsi resmi 1 bulan & 3 bulan, all operator.',
      cta: 'Baca Disclaimer Lengkap',
    },
    brightness: 0.94, saturation: 0.72, tint: { color: '#E9B27C', opacity: 0.22, blend: 'soft-light' },
    scrim: [[0, '#2B1B10', 0.86], [0.15, '#2B1B10', 0.84], [0.22, '#2B1B10', 0.42], [0.32, '#2B1B10', 0.55], [0.38, '#2B1B10', 0.88], [0.55, '#2B1B10', 0.94], [1, '#231509', 0.97]],
    markFill: '#D8A469', markText: '#2B1B10', brandColor: '#F7EFE4',
    badgeFill: '#F7EFE4', badgeText: '#7F1D1D', badgeStroke: '#C9B092',
    rule: `<line x1="90" y1="356" x2="990" y2="356" stroke="#D8A469" stroke-width="2"/><line x1="90" y1="362" x2="990" y2="362" stroke="#D8A469" stroke-opacity="0.5" stroke-width="1"/>`,
    eyebrowColor: '#E7C9A4', headColor: '#FFF6EA', hWeight: 700, hSpacing: -1,
    cardFill: '#F7EFE4', cardTitleColor: '#2B1B10', cardText: '#3B2A1C', cardMuted: '#5C4632', cardRule: '#C9B092', cardRadius: 4,
    ctaFill: '#2B1B10', ctaText: '#FFF6EA', footerColor: '#F1DCC0',
  },
  {
    key: 'rabu', name: 'Bold Brand', day: 'Rabu', themeName: 'Ice Ocean', font: 'Segoe UI Black',
    content: {
      badge: 'NEW SERVICE RELEASE', eyebrow: 'MENU BARU HADIR! â€¢ RABU', head1: '3B SF', head2: 'FAST',
      cardTitle: 'DETAIL LAYANAN TERBARU',
      line1: 'Mode pengerjaan: server FAST, langsung diantrekan.',
      line2: 'All operator & transparan, nota digital otomatis.',
      cta: 'Cek Layanan di Web',
    },
    brightness: 0.78, saturation: 0.75,
    scrim: [[0, '#001C3D', 0.86], [0.15, '#001C3D', 0.84], [0.22, '#001C3D', 0.4], [0.32, '#001C3D', 0.55], [0.38, '#001C3D', 0.88], [0.55, '#001C3D', 0.94], [1, '#001C3D', 0.97]],
    decor: `<rect x="0" y="628" width="1080" height="452" fill="#0071e3" opacity="0.95"/><circle cx="1010" cy="690" r="230" fill="#2997ff" opacity="0.32"/><text x="1010" y="1000" text-anchor="end" font-size="330" font-weight="900" fill="#FFFFFF" opacity="0.09">RY</text>`,
    markFill: '#FFFFFF', markText: '#0071e3', brandColor: '#FFFFFF',
    badgeFill: '#FFFFFF', badgeText: '#0055C6', badgeStroke: '#BFDBFE',
    eyebrowColor: '#FFFFFF', headColor: '#FFFFFF', hWeight: 900, hSpacing: -3,
    cardFill: '#FFFFFF', cardTitleColor: '#0F172A', cardText: '#334155', cardMuted: '#475569', cardRule: '#D2D2D7', cardRadius: 16,
    ctaFill: '#0055C6', ctaText: '#FFFFFF', footerColor: '#FFFFFF',
  },
  {
    key: 'kamis', name: 'Clean White', day: 'Kamis', themeName: 'Navy Minimalist', font: 'Segoe UI Semibold',
    content: {
      badge: 'FEED â€¢ TESTIMONI', eyebrow: 'CUSTOMER FEEDBACK â€¢ KAMIS', head1: 'TESTIMONI', head2: 'PELANGGAN',
      cardTitle: 'Semua Bergaransi Tanpa Drama',
      line1: 'Nota & kartu garansi digital tersimpan otomatis.',
      line2: 'Fast response via WhatsApp & web resmi.',
      cta: 'Lihat Feedback di Web',
    },
    brightness: 1.06, saturation: 0.92,
    scrim: [[0, '#FFFFFF', 0.88], [0.15, '#FFFFFF', 0.86], [0.22, '#FFFFFF', 0.5], [0.32, '#FFFFFF', 0.62], [0.38, '#FFFFFF', 0.97], [0.55, '#FFFFFF', 1], [1, '#FFFFFF', 1]],
    markFill: '#0071E3', markText: '#FFFFFF', brandColor: '#1d1d1f',
    badgeFill: '#EFF6FF', badgeText: '#1E3A8A', badgeStroke: '#CBD5E1',
    rule: `<line x1="90" y1="352" x2="990" y2="352" stroke="#0071e3" stroke-width="3"/>`,
    eyebrowColor: '#0055C6', headColor: '#1d1d1f', hWeight: 600, hSpacing: -2,
    cardFill: '#FFFFFF', cardTitleColor: '#1E3A8A', cardText: '#334155', cardMuted: '#6E6E73', cardRule: '#E5E5EA', cardRadius: 30,
    ctaFill: '#1d1d1f', ctaText: '#FFFFFF', footerColor: '#6E6E73',
  },
  {
    key: 'jumat', name: 'Dark Mode', day: 'Jumat', themeName: 'Pearl Cerulean', font: 'Segoe UI',
    content: {
      badge: 'LIVE SERVER UPDATE', eyebrow: 'SLOT & JALUR ON HARI INI', head1: 'READY', head2: '3B SF FAST',
      cardTitle: 'PEMESANAN WEB 24 JAM',
      line1: 'Web buka 24 jam â€¢ WA tutup 22.00 WIB.',
      line2: 'Slot terbatas per kloter â€¢ antrean otomatis.',
      cta: 'Cek Slot Sekarang',
    },
    brightness: 0.6, saturation: 0.88, tint: { color: '#2B3A55', opacity: 0.25, blend: 'soft-light' },
    scrim: [[0, '#000000', 0.86], [0.15, '#000000', 0.84], [0.22, '#000000', 0.4], [0.32, '#000000', 0.55], [0.38, '#000000', 0.9], [0.55, '#000000', 0.95], [1, '#000000', 0.98]],
    decor: `<ellipse cx="530" cy="880" rx="540" ry="270" fill="#0071e3" opacity="0.18"/>`,
    markFill: '#2997ff', markText: '#000000', brandColor: '#F5F5F7',
    badgeFill: '#DCFCE7', badgeText: '#14532D', badgeStroke: '#86EFAC',
    eyebrowColor: '#2997FF', headColor: '#F5F5F7', hWeight: 700, hSpacing: -2,
    cardFill: '#1C1C1E', cardTitleColor: '#2997FF', cardText: '#F5F5F7', cardMuted: '#A1A1A6', cardRule: '#3A3A3C', cardRadius: 30,
    ctaFill: '#2997ff', ctaText: '#0B1524', footerColor: '#A1A1A6',
  },
  {
    key: 'sabtu', name: 'Lifestyle', day: 'Sabtu', themeName: 'Electric Ice', font: 'Segoe UI',
    content: {
      badge: 'OFFICIAL SERVICE â€¢ SABTU', eyebrow: 'TEMA HARIAN â€¢ ELECTRIC ICE', head1: 'ELECTRIC', head2: 'ICE',
      cardTitle: 'Konsultasi Resmi & Cek IMEI',
      line1: 'Solusi digital & jaringan terpercaya.',
      line2: 'Add Roamer â€¢ CEIR â€¢ Garansi digital.',
      cta: 'Konsultasi via WhatsApp',
    },
    brightness: 1.02, saturation: 1.12,
    scrim: [[0, '#0A120C', 0.85], [0.15, '#0A120C', 0.83], [0.22, '#0A120C', 0.4], [0.32, '#0A120C', 0.54], [0.38, '#0A120C', 0.88], [0.55, '#0A120C', 0.94], [1, '#0A120C', 0.97]],
    decor: `<rect x="830" y="270" width="160" height="56" rx="28" fill="#34c759"/><text x="910" y="307" text-anchor="middle" font-size="26" font-weight="800" fill="#082012">WEEKEND</text>`,
    markFill: '#34c759', markText: '#082012', brandColor: '#FFFFFF',
    badgeFill: '#FFFFFF', badgeText: '#065F46', badgeStroke: '#A7F3D0',
    eyebrowColor: '#B7F0C9', headColor: '#FFFFFF', hWeight: 800, hSpacing: -2, headShadow: 'rgba(0,0,0,0.55)',
    cardFill: '#0A140D', cardTitleColor: '#7BEF9C', cardText: '#FFFFFF', cardMuted: '#D8F5E2', cardRule: '#2F6B45', cardRadius: 34,
    ctaFill: '#34c759', ctaText: '#082012', footerColor: '#E6F7EC',
  },
  {
    key: 'minggu', name: 'Retro Film', day: 'Minggu', themeName: 'Clean Azure', font: 'Courier New',
    content: {
      badge: 'OFFICIAL SERVICE â€¢ MINGGU', eyebrow: 'TEMA HARIAN â€¢ CLEAN AZURE', head1: 'CLEAN', head2: 'AZURE',
      cardTitle: 'Pemesanan & Antrean Via Web / WA',
      line1: 'Semua bergaransi tanpa drama.',
      line2: 'Slot terbatas per kloter â€¢ pengerjaan otomatis.',
      cta: 'Buka Web Resmi',
    },
    brightness: 0.9, saturation: 0.6, tint: { color: '#C8A06A', opacity: 0.35, blend: 'soft-light' },
    grain: true,
    scrim: [[0, '#241608', 0.87], [0.15, '#241608', 0.85], [0.22, '#241608', 0.42], [0.32, '#241608', 0.56], [0.38, '#241608', 0.9], [0.55, '#241608', 0.95], [1, '#241608', 0.97]],
    decor: `<rect x="0" y="0" width="1080" height="66" fill="#120B05"/><rect x="0" y="1854" width="1080" height="66" fill="#120B05"/><text x="990" y="1810" text-anchor="end" font-size="28" font-weight="700" letter-spacing="4" fill="#F0A860">MINGGU &#183; 07</text>`,
    markFill: '#A8543C', markText: '#F3E3C3', brandColor: '#F3E3C3',
    badgeFill: '#F3E3C3', badgeText: '#7C2D12', badgeStroke: '#8C6A45',
    eyebrowColor: '#E8B87E', headColor: '#F3E3C3', hWeight: 700, hSpacing: -1,
    cardFill: '#241608', cardTitleColor: '#F0A860', cardText: '#F3E3C3', cardMuted: '#D9BE95', cardRule: '#7E6244', cardRadius: 8,
    ctaFill: '#8C3F2B', ctaText: '#FFF1D6', footerColor: '#E8B87E',
  },
];

// Ordered content: the seven days cycle through the five baseline Story stages.
// 1 open -> 2 ready -> 3 close-list slow -> 4 partial close -> 5 close toko, then repeat.
const ORDER_CONTENT = {
  senin: {
    step: 1, baseline: '01-story-open.jpg',
    badge: 'ONLINE & READY', eyebrow: 'STORY OPEN â€¢ SENIN', head1: 'WE ARE', head2: 'OPEN!',
    cardTitle: 'LAYANAN PRIORITAS HARI INI',
    line1: 'Add Roamer â€¢ Cek Status CEIR â€¢ Klaim Garansi',
    line2: 'Telkomsel, Indosat, XL, Tri, SF',
    cta: 'Fast Response via WhatsApp & Web',
  },
  selasa: {
    step: 2, baseline: '04-rivera-ready.jpg',
    badge: 'LIVE SERVER UPDATE', eyebrow: 'SLOT & JALUR ON HARI INI', head1: 'READY', head2: '3B SF',
    cardTitle: 'JALUR YANG SIAP HARI INI',
    line1: 'READY: 3B SF FAST â€¢ 1B FAST â€¢ 3B SLOW',
    line2: 'Web buka 24 jam â€¢ WA tutup 22.00 WIB',
    cta: 'Cek Slot Sekarang',
  },
  rabu: {
    step: 3, baseline: '08-rivera-close-list-slow.jpg',
    badge: 'CUT-OFF KLOTER HARI INI', eyebrow: 'CLOSE LIST â€¢ 3B SF SLOW', head1: 'CLOSE LIST', head2: '3B SLOW',
    cardTitle: 'ORDER SEBELUM 15.00 WIB',
    line1: 'Sebelum 15.00: selesai malam ini',
    line2: 'Sesudah 15.00: diproses kloter besok',
    cta: 'Cek Cut-off di Web',
  },
  kamis: {
    step: 4, baseline: '05-rivera-partial-close.jpg',
    badge: 'UPDATE STATUS LAYANAN', eyebrow: 'SEBAGIAN TUTUP â€¢ KAMIS', head1: 'FAST CLOSED', head2: 'SLOW READY',
    cardTitle: 'JALUR LAIN TETAP READY',
    line1: '3B SF FAST ditutup sementara',
    line2: '3B SF SLOW tetap tersedia malam ini',
    cta: 'Cek Jalur di Web',
  },
  jumat: {
    step: 5, baseline: '06-rivera-full-close.jpg',
    badge: 'ORDERAN KLOTER CLOSED', eyebrow: 'CLOSE TOKO â€¢ JUMAT', head1: 'CLOSED', head2: 'HARI INI',
    cardTitle: 'ORDERAN KLOTER DITUTUP',
    line1: 'Web buka 24 jam â€¢ WA tutup 22.00 WIB',
    line2: 'Sampai jumpa di kloter berikutnya',
    cta: 'Cek Kloter Berikutnya',
  },
  sabtu: {
    step: 1, baseline: '01-story-open.jpg',
    badge: 'ONLINE & READY', eyebrow: 'STORY OPEN â€¢ SABTU', head1: 'WE ARE', head2: 'OPEN!',
    cardTitle: 'LAYANAN PRIORITAS HARI INI',
    line1: 'Add Roamer â€¢ Cek Status CEIR â€¢ Klaim Garansi',
    line2: 'Telkomsel, Indosat, XL, Tri, SF',
    cta: 'Fast Response via WhatsApp & Web',
  },
  minggu: {
    step: 2, baseline: '04-rivera-ready.jpg',
    badge: 'LIVE SERVER UPDATE', eyebrow: 'SLOT & JALUR ON HARI INI', head1: 'READY', head2: '3B SF',
    cardTitle: 'JALUR YANG SIAP HARI INI',
    line1: 'READY: 3B SF FAST â€¢ 1B FAST â€¢ 3B SLOW',
    line2: 'Web buka 24 jam â€¢ WA tutup 22.00 WIB',
    cta: 'Cek Slot Sekarang',
  },
};

module.exports = { textSvg, skins, ORDER_CONTENT, L, HEAD_SIZE, esc };


