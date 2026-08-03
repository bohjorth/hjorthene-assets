const sanitizeHtml = require('sanitize-html');

// SVG'er kan indeholde <script>, on*-event-handlers og javascript:-URI'er,
// helt ligesom HTML - en ondsindet uploadet SVG kunne derfor køre kode i
// browseren, hvis den blev serveret uændret fra vores eget domæne (stored
// XSS). Vi bruger en ALLOWLIST af strukturelle/præsentationsmæssige tags og
// attributter (i stedet for en denylist) - det er den sikre vej, da det ikke
// kræver at vi kender alle mulige angrebsvarianter på forhånd.
const ALLOWED_TAGS = [
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'text', 'tspan', 'textPath', 'defs', 'symbol', 'use', 'title', 'desc',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
  'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feColorMatrix',
  'feFlood', 'feComposite', 'feBlend', 'style',
];

const ALLOWED_ATTRS = [
  'viewBox', 'xmlns', 'xmlns:xlink', 'version', 'width', 'height',
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-opacity', 'stroke-miterlimit',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points',
  'transform', 'opacity', 'class', 'id', 'style', 'clip-path', 'clip-rule', 'mask',
  'gradientUnits', 'gradientTransform', 'offset', 'stop-color', 'stop-opacity',
  'patternUnits', 'patternContentUnits', 'patternTransform', 'preserveAspectRatio',
  'xlink:href', 'href', 'in', 'in2', 'result', 'stdDeviation', 'dx', 'dy',
  'flood-color', 'flood-opacity', 'font-family', 'font-size', 'font-weight',
  'text-anchor', 'dominant-baseline', 'filterUnits',
];

function sanitizeSvg(svgString) {
  return sanitizeHtml(svgString, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTRS },
    allowedSchemes: ['data', 'http', 'https'], // udelukker "javascript:" URI'er
    allowVulnerableTags: false,
    disallowedTagsMode: 'discard', // fjerner fx <script>...</script> HELT, inkl. indhold
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  });
}

/** Renser en SVG-buffer og returnerer en ny, ren Buffer. */
function sanitizeSvgBuffer(buffer) {
  try {
    const clean = sanitizeSvg(buffer.toString('utf8'));
    return Buffer.from(clean, 'utf8');
  } catch (err) {
    // Ved tvivl: en tom/fejlende sanitization er sikrere end at servere ubehandlet input.
    console.error('SVG-sanitization fejlede, forkaster indhold:', err.message);
    return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  }
}

module.exports = { sanitizeSvg, sanitizeSvgBuffer };
