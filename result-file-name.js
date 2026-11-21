/**
 * Generate stable Ragic upload filenames from BreezySign's actual completion time.
 * Never use the time of a later manual sync as the completion date.
 */
function parseCompletionTime(value) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  // BreezySign commonly returns ISO 8601 with an offset. If a plain local
  // timestamp is returned, treat it as Asia/Taipei rather than Worker UTC.
  const local = /^(\d{4})[\/-](\d{2})[\/-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  const date = local
    ? new Date(`${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}:${local[6] || '00'}+08:00`)
    : new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateInTaipei(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

export function completionDate(info) {
  // Use task completion timestamp first; otherwise latest signer completion.
  let when = parseCompletionTime(info?.endDate);
  if (!when) {
    const ends = (Array.isArray(info?.data) ? info.data : [])
      .filter(s => String(s.currentStatus || '').toUpperCase() === 'DONE')
      .map(s => parseCompletionTime(s.endTime))
      .filter(Boolean)
      .sort((a,b) => b.getTime() - a.getTime());
    when = ends[0] || null;
  }
  if (!when) throw new Error('好好簽尚未提供簽署完成時間，文件待補，請稍後重新取得狀態');
  return dateInTaipei(when);
}

export function safeDocumentStem(value) {
  let title = String(value || '').normalize('NFC')
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]/g, '_')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/g, '')
    .trim();
  if (!title) title = '未命名文件';
  // Leave headroom for yyyyMMdd_ and suffix within common filename limits.
  const encoder = new TextEncoder();
  let bytes = 0, out = '';
  for (const ch of title) {
    const size = encoder.encode(ch).byteLength;
    if (bytes + size > 160) break;
    bytes += size;
    out += ch;
  }
  return out.replace(/[.\s]+$/g, '') || '未命名文件';
}

export function signedDocumentName(info, taskName, kind) {
  const label = kind === 'getResult' ? '已簽署' : kind === 'getTrack' ? '簽署軌跡' : null;
  if (!label) throw new Error('不支援的結果文件類型');
  return `${completionDate(info)}_${safeDocumentStem(taskName)}_${label}.pdf`;
}
