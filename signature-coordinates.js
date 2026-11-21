/**
 * Convert PDF.js scale=1 viewport (PDF points, 72dpi) to BreezySign's
 * coordinates inferred from signed-PDF placement (CSS pixels, 96dpi).
 *
 * Evidence from the user's original PDF and resulting signed PDF:
 * original frame left 90.0 pt -> signed frame left 67.5 pt;
 * original frame left 277.5 pt -> signed frame left 208.2 pt.
 * Thus the downstream placement factor is approximately 0.75 and
 * the outgoing coordinates must be multiplied by 4/3.
 *
 * This correction is specific to the BreezySign API as observed and
 * should be checked with a fresh test signature before production.
 */
export const PDF_POINT_TO_BREEZY = 96 / 72;

const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function toBreezyCoordinates(box) {
  if (!box || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(Number(box[k])))) {
    throw new Error('PDF 簽署框座標不正確');
  }
  if (Number(box.width) <= 0 || Number(box.height) <= 0) {
    throw new Error('PDF 簽署框尺寸必須大於零');
  }
  return Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, round2(Number(box[k]) * PDF_POINT_TO_BREEZY)]));
}
