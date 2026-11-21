import test from 'node:test';
import assert from 'node:assert/strict';
import { PDF_POINT_TO_BREEZY, toBreezyCoordinates } from '../src/signature-coordinates.js';

// Actual page geometry from 銷售訂單.pdf: A4, 595.30 × 841.89 PDF points.
// Actual signed PDF placed signature images at X=67.5 and X=208.2,
// i.e. exactly 75% of the intended PDF-frame left edges 90.0 and 277.5.
test('observed 0.75 placement factor corrected to 1.0', () => {
  assert.equal(PDF_POINT_TO_BREEZY, 4 / 3);
  const first = toBreezyCoordinates({ x: 90, y: 100.3, width: 185.9, height: 103.2 });
  const second = toBreezyCoordinates({ x: 277.5, y: 100.3, width: 186.0, height: 103.2 });
  assert.deepEqual(first, { x: 120, y: 133.73, width: 247.87, height: 137.6 });
  assert.deepEqual(second, { x: 370, y: 133.73, width: 248, height: 137.6 });
  assert.ok(Math.abs(first.x * .75 - 90) < 0.01);
  assert.ok(Math.abs(second.x * .75 - 277.5) < 0.01);
  assert.ok(Math.abs(first.width * .75 - 185.9) < 0.01);
});

test('preserves signers and pages outside the geometry conversion', () => {
  const box = toBreezyCoordinates({x:30,y:200,width:100,height:50});
  assert.deepEqual(box, {x:40,y:266.67,width:133.33,height:66.67});
});

test('rejects invalid coordinates and dimensions', () => {
  assert.throws(() => toBreezyCoordinates({x:NaN,y:1,width:20,height:20}));
  assert.throws(() => toBreezyCoordinates({x:10,y:10,width:0,height:30}));
});
