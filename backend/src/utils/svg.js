/**
 * Fjerner faste width/height-attributter fra rod-<svg>-tagget, så ikonet altid
 * skalerer efter sin container (via viewBox) i stedet for at blive låst til
 * en lille, hardcodet pixelstørrelse fra kilden. Dette er årsagen til at nogle
 * importerede ikoner virker "for små" i andre systemer (fx Authentiks
 * application-fliser) sammenlignet med andre - de mangler ikke pixels, deres
 * <svg> har bare eksplicit width="48" height="48" osv. i stedet for at være
 * fritflydende.
 *
 * Rører kun selve <svg>-taggets attributter, ikke det visuelle indhold.
 */
function normalizeSvg(buffer) {
  try {
    let svg = buffer.toString('utf8');

    const svgTagMatch = svg.match(/<svg\b[^>]*>/i);
    if (!svgTagMatch) return buffer; // ikke en genkendelig SVG-struktur, rør den ikke

    let tag = svgTagMatch[0];
    const hasViewBox = /viewBox\s*=/i.test(tag);

    // Hvis der ikke er nogen viewBox, men der ER width/height, byg en viewBox
    // ud fra dem FØR de fjernes, ellers mister vi proportionerne helt.
    if (!hasViewBox) {
      const w = tag.match(/\bwidth\s*=\s*["']?([\d.]+)/i);
      const h = tag.match(/\bheight\s*=\s*["']?([\d.]+)/i);
      if (w && h) {
        tag = tag.replace(/<svg\b/i, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
      }
    }

    // Fjern faste width/height, så forbrugeren (browser/Authentik/etc.) styrer størrelsen
    tag = tag.replace(/\swidth\s*=\s*["'][^"']*["']/i, '');
    tag = tag.replace(/\sheight\s*=\s*["'][^"']*["']/i, '');

    svg = svg.replace(svgTagMatch[0], tag);
    return Buffer.from(svg, 'utf8');
  } catch (err) {
    return buffer; // ved tvivl: brug filen uændret frem for at knække importen
  }
}

module.exports = { normalizeSvg };
