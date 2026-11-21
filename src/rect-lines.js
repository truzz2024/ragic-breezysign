/**
 * Recognize a real four-sided rectangular signature box from PDF vector strokes.
 * A visible edge may consist of several joined PDF path segments (LibreOffice
 * Writer text boxes commonly split the bottom border at its midpoint).
 * This code does not synthesize missing borders or infer arbitrary boxes.
 */
export function findEnclosingRectFromLines(lines, point, pageSize) {
  const axisTol = 1.5;
  const joinTol = 2.8;
  const num = n => typeof n === 'number' && Number.isFinite(n);
  const round = n => Math.round(n * 100) / 100;
  if (!num(point?.x) || !num(point?.y) || !num(pageSize?.width) || !num(pageSize?.height)) return null;
  const horizontal = [], vertical = [];
  for (const l of lines || []) {
    if (![l.x1, l.y1, l.x2, l.y2].every(num)) continue;
    const dx = Math.abs(l.x1 - l.x2), dy = Math.abs(l.y1 - l.y2);
    if (dy <= axisTol && dx > 1) {
      horizontal.push({pos: (l.y1 + l.y2) / 2, start: Math.min(l.x1, l.x2), end: Math.max(l.x1, l.x2)});
    } else if (dx <= axisTol && dy > 1) {
      vertical.push({pos: (l.x1 + l.x2) / 2, start: Math.min(l.y1, l.y2), end: Math.max(l.y1, l.y2)});
    }
  }

  // Merge contiguous / overlapping collinear strokes into actual visible edges.
  // Keep the coordinate tolerance conservative, so separated boxes don't merge.
  function mergeStrokes(strokes) {
    const merged = [];
    for (const s of [...strokes].sort((a, b) => a.pos - b.pos || a.start - b.start)) {
      // The same coordinate can appear as several adjacent PDF path fragments.
      const match = merged.find(m =>
        Math.abs(m.pos - s.pos) <= axisTol &&
        s.start <= m.end + joinTol && s.end >= m.start - joinTol
      );
      if (match) {
        match.start = Math.min(match.start, s.start);
        match.end = Math.max(match.end, s.end);
      } else {
        merged.push({...s});
      }
    }
    // A later fragment can bridge two earlier groups: merge to fixed point.
    let changed;
    do {
      changed = false;
      outer: for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          const a = merged[i], b = merged[j];
          if (Math.abs(a.pos - b.pos) <= axisTol &&
              b.start <= a.end + joinTol && b.end >= a.start - joinTol) {
            a.start = Math.min(a.start, b.start);
            a.end = Math.max(a.end, b.end);
            merged.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    } while (changed);
    return merged;
  }

  const h = mergeStrokes(horizontal).map(s => ({y:s.pos, minX:s.start, maxX:s.end}));
  const v = mergeStrokes(vertical).map(s => ({x:s.pos, minY:s.start, maxY:s.end}));

  const left = v.filter(s => s.x < point.x && s.minY <= point.y + joinTol && s.maxY >= point.y - joinTol)
    .sort((a,b)=>b.x-a.x).slice(0,12);
  const right = v.filter(s => s.x > point.x && s.minY <= point.y + joinTol && s.maxY >= point.y - joinTol)
    .sort((a,b)=>a.x-b.x).slice(0,12);
  const top = h.filter(s => s.y < point.y).sort((a,b)=>b.y-a.y).slice(0,12);
  const bottom = h.filter(s => s.y > point.y).sort((a,b)=>a.y-b.y).slice(0,12);
  let best = null;
  for (const l of left) for (const r of right) {
    const width = r.x-l.x;
    if (width < 15 || width >= pageSize.width * .98) continue;
    for (const t of top) {
      if (t.minX > l.x + joinTol || t.maxX < r.x - joinTol) continue;
      for (const b of bottom) {
        if (b.minX > l.x + joinTol || b.maxX < r.x - joinTol) continue;
        const height = b.y-t.y;
        if (height < 15 || height >= pageSize.height * .98) continue;
        if (l.minY > t.y + joinTol || l.maxY < b.y - joinTol ||
            r.minY > t.y + joinTol || r.maxY < b.y - joinTol) continue;
        const area=width*height;
        if (!best || area < best.area) best={x:round(l.x),y:round(t.y),width:round(width),height:round(height),area};
      }
    }
  }
  if (!best) return null;
  return {x:best.x, y:best.y, width:best.width, height:best.height};
}
