import test from 'node:test';
import assert from 'node:assert/strict';
import { findEnclosingRectFromLines as find } from '../src/rect-lines.js';

const page = {width: 595.304, height: 841.89};
const line = (x1,y1,x2,y2) => ({x1,y1,x2,y2});

// Measurements from the uploaded LibreOffice Writer PDF: the bottom borders
// of the two top textboxes consist of two adjoining independent segments.
const leftBox = [
  line(182.95,203.50,90.00,203.50),
  line(90.00,203.50,90.00,100.30),
  line(90.00,100.30,275.90,100.30),
  line(275.90,100.30,275.90,203.50),
  line(275.90,203.50,182.95,203.50)
];
const rightBox = [
  line(370.50,203.50,277.55,203.50),
  line(277.55,203.50,277.55,100.30),
  line(277.55,100.30,463.45,100.30),
  line(463.45,100.30,463.45,203.50),
  line(463.45,203.50,370.50,203.50)
];
const table = [
  line(90.05,277.25,505.35,277.25),
  line(90.05,455.85,505.35,455.85),
  line(90.30,277.00,90.30,456.10),
  line(297.70,277.50,297.70,455.60),
  line(505.10,277.00,505.10,456.10)
];
const graphicBox = [
  line(166.80,576.25,90.00,576.25),
  line(90.00,576.25,90.00,514.45),
  line(90.00,514.45,243.60,514.45),
  line(243.60,514.45,243.60,576.25),
  line(243.60,576.25,166.80,576.25)
];

test('uploaded PDF: textbox SIGN:1 with split bottom edge',()=> {
  assert.deepEqual(find(leftBox,{x:157.70,y:112},page),{x:90,y:100.3,width:185.9,height:103.2});
});
test('uploaded PDF: textbox SIGN:2 with split bottom edge',()=> {
  assert.deepEqual(find(rightBox,{x:345.25,y:112},page),{x:277.55,y:100.3,width:185.9,height:103.2});
});
test('uploaded PDF: table SIGN:1 from shared borders',()=> {
  assert.deepEqual(find(table,{x:168.65,y:370.45},page),{x:90.3,y:277.25,width:207.4,height:178.6});
});
test('uploaded PDF: table SIGN:2 from shared borders',()=> {
  assert.deepEqual(find(table,{x:376.05,y:370.45},page),{x:297.7,y:277.25,width:207.4,height:178.6});
});
test('uploaded PDF: graphic SIGN:1 with split bottom edge',()=> {
  assert.deepEqual(find(graphicBox,{x:141.55,y:545},page),{x:90,y:514.45,width:153.6,height:61.8});
});
test('missing border must not be invented',()=> {
  assert.equal(find(leftBox.slice(1,4),{x:157.70,y:112},page),null);
});
test('visible gap in bottom border must not be invented',()=> {
  const b=leftBox.map(s=>({...s}));b[0].x1=177;b[4].x2=188;
  assert.equal(find(b,{x:157.70,y:112},page),null);
});
