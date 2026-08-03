const puppeteer = require('puppeteer-core');
const config = require('../config');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: config.chromiumPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      .catch((err) => {
        browserPromise = null; // tillad et nyt forsøg ved næste import i stedet for at forblive "død"
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Beskærer en SVG's viewBox ind til det faktisk synlige indholds bounding box
 * (målt via en rigtig browser-rendering, svg.getBBox()), så ikonet fylder hele
 * sit eget lærred i stedet for at have indbygget "luft" fra kildens kvadratiske
 * 1:1-normalisering (typisk for selfh.st/icons). Resultatet er stadig kvadratisk,
 * så det passer ind i faste ikon-fliser (fx Authentik) uden at blive forvrænget.
 *
 * Falder tilbage til den uændrede SVG ved enhver fejl (manglende Chromium,
 * korrupt SVG, tomt indhold osv.) - beskæring er en "nice to have", aldrig en
 * grund til at fejle selve importen.
 */
async function autoCropSvg(buffer) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const svgString = buffer.toString('utf8');
    await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${svgString}</body></html>`, {
      waitUntil: 'load',
      timeout: 8000,
    });

    const bbox = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return null;
      try {
        const box = svg.getBBox();
        if (!box || box.width === 0 || box.height === 0) return null;
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      } catch (e) {
        return null;
      }
    });

    if (!bbox) return buffer;

    const pad = Math.max(bbox.width, bbox.height) * 0.06; // ~6% luft, ikke helt kant-til-kant
    const side = Math.max(bbox.width, bbox.height) + pad * 2;
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const newViewBox = `${(cx - side / 2).toFixed(2)} ${(cy - side / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`;

    const svgTagMatch = svgString.match(/<svg\b[^>]*>/i);
    if (!svgTagMatch) return buffer;

    let tag = svgTagMatch[0];
    if (/viewBox\s*=/i.test(tag)) {
      tag = tag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${newViewBox}"`);
    } else {
      tag = tag.replace(/<svg\b/i, `<svg viewBox="${newViewBox}"`);
    }

    return Buffer.from(svgString.replace(svgTagMatch[0], tag), 'utf8');
  } catch (err) {
    console.error('Auto-beskæring af SVG fejlede, bruger original:', err.message);
    return buffer;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { autoCropSvg, getBrowser };
