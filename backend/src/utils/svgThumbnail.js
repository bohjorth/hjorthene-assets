const { getBrowser } = require('./svgCrop');

/**
 * Genererer en JPEG-thumbnail af en SVG via en Chromium-screenshot i stedet
 * for sharp/librsvg. Det er bevidst - autoCropSvg (svgCrop.js) beregner sin
 * beskæring VED AT RENDERE i Chromium, og librsvg (som sharp bruger) tolker
 * ikke altid præcis samme SVG identisk (strokes, filtre, komplekse paths).
 * Ved at bruge samme motor til både beskæring og thumbnail undgår vi at de
 * to trin er "uenige" om hvor ikonet reelt er, hvilket ellers kan give
 * thumbnails der ser forkert beskåret/zoomet ud.
 *
 * Baggrunden sættes eksplicit til appens cremefarve, så transparente SVG'er
 * ikke ender med sort baggrund (sharps JPEG-eksport flader transparens til
 * sort som standard, medmindre man selv sætter en baggrundsfarve).
 */
async function generateSvgThumbnail(svgBuffer, outputPath, size = 400) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 2 });
    const svgString = svgBuffer.toString('utf8');
    const padding = Math.round(size * 0.12);

    await page.setContent(
      `<!doctype html><html><body style="margin:0;padding:0;width:${size}px;height:${size}px;
        display:flex;align-items:center;justify-content:center;background:#fffcf4;box-sizing:border-box;">
        <div id="icon-wrap" style="width:${size - padding * 2}px;height:${size - padding * 2}px;
          display:flex;align-items:center;justify-content:center;">
          ${svgString}
        </div>
      </body></html>`,
      { waitUntil: 'load', timeout: 8000 }
    );

    // Nogle kilde-SVG'er mangler width/height=100% og vil ellers vise sig i
    // deres browser-standardstørrelse (300x150) i stedet for at fylde containeren.
    await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.maxWidth = '100%';
        svg.style.maxHeight = '100%';
      }
    });

    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 88 });
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generateSvgThumbnail };
