const impl = require('./storyVisualV6_impl.js');
const { textSvg, skins, ORDER_CONTENT } = impl;

const W = 1080, H = 1920;

function buildPhotoFilter(skin) {
  const sat = (skin.saturation == null ? 1 : skin.saturation);
  const gray = skin.greyscale ? 0 : sat;
  const bright = (skin.brightness == null ? 1 : skin.brightness);
  return `<filter id="v6photo" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${gray}"/><feComponentTransfer><feFuncR type="linear" slope="${bright}" intercept="0"/><feFuncG type="linear" slope="${bright}" intercept="0"/><feFuncB type="linear" slope="${bright}" intercept="0"/></feComponentTransfer></filter>`;
}

function renderV6(dayKey, content, photoDataUri) {
  const skin = (skins || []).find(s => s.key === dayKey) || (skins || [])[0];
  if (!skin) return '';
  if (content) skin.content = content;
  const full = textSvg(skin);
  const inner = String(full).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const scrimStops = (skin.scrim || []).map(([o, c, a]) => `<stop offset="${Math.round(o * 100)}%" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  const photo = photoDataUri ? `<image href="${photoDataUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" filter="url(#v6photo)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${skin.font}"><defs>${buildPhotoFilter(skin)}<linearGradient id="v6scrim" x1="0" y1="0" x2="0" y2="1">${scrimStops}</linearGradient></defs>${photo}<rect width="${W}" height="${H}" fill="url(#v6scrim)"/>${inner}</svg>`;
}

module.exports = { renderV6, skins, ORDER_CONTENT, textSvg };
