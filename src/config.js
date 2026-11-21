// 所有公開模組共用的欄位 ID；不保存任何 API Key。
export const F = Object.freeze({
  taskNo: 1001458, status: 1001459, startMode: 1001461,
  taskName: 1001462, pdf: 1001465, expiry: 1001466,
  signedPdf: 1001467, schedule: 1001468, trackPdf: 1001469,
  emailSubject: 1001482, emailMessage: 1001501, overlay: 1001483,
  sendDone: 1001485, returnUrl: 1001484, orderMode: 1001486,
  instanceId: 1001487, initiatorName: 1001489, cancelName: 1001509,
  startTime: 1001491, endTime: 1001492, signUrl: 1001490,
  apiStatus: 1001497, apiMessage: 1001498, syncedAt: 1001499,
  subtable: 1001494, signerOrder: 1001470, signerName: 1001471,
  signerEmail: 1001472, signerPhone: 1001473, signerStatus: 1001474,
  signerSignedTime: 1001475, signerReason: 1001495,
  signerFace: 1001477, signerOtp: 1001478,
  signerHostEmail: 1001479, signerHostName: 1001480,
  signerCulture: 1001481, signerVideo: 1001496,
});
export const MAX_PDF_SIZE = 8 * 1024 * 1024;
export const BREEZY_API = 'https://app.breezysign.com/pdfbpmn/api/v1/task/';

export function taskConfig(env) {
  if (!env.RAGIC_TASK_FORM_URL) throw new Error('未設定 RAGIC_TASK_FORM_URL');
  const u = new URL(env.RAGIC_TASK_FORM_URL);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) {
    throw new Error('RAGIC_TASK_FORM_URL 必須是 HTTPS 表單網址，不能帶參數');
  }
  const m = /^\/([^/]+)(\/[^?#]+)\/(\d+)\/?$/.exec(u.pathname);
  if (!m) throw new Error('RAGIC_TASK_FORM_URL 格式：/資料庫名稱/表單路徑/索引');
  return {base: u.origin, account: decodeURIComponent(m[1]),
    path: m[2].replace(/\/$/, ''), sheetIndex: Number(m[3]),
    form: u.origin + '/' + m[1] + m[2] + '/' + m[3]};
}
export function recordUrl(env, id) {
  const c = taskConfig(env);
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('無效的 recordId');
  return c.form + '/' + Number(id);
}
export function rDate(iso, withSeconds = true) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const o = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', hour12:false, year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${o.year}/${o.month}/${o.day} ${o.hour}:${o.minute}`+(withSeconds?`:${o.second}`:'');
}
export function utcFromRagic(s) {
  if (!s) return null;
  const m = /^(\d{4})\/(\d\d)\/(\d\d)\s+(\d\d):(\d\d)(?::(\d\d))?$/.exec(String(s));
  if (!m) throw new Error('日期格式錯誤：' + s);
  const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}+08:00`);
  if (!Number.isFinite(ms)) throw new Error('無效日期：'+s);
  return new Date(ms).toISOString();
}
export function rawFileName(value) {
  const s = String(value||'').trim();
  if (!s || s.length > 350 || /[\r\n<>]/.test(s) || !/\.pdf$/i.test(s) || !s.includes('@')) {
    throw new Error('待簽 PDF 欄位須為單一 PDF 的 Ragic raw 檔名（例如 abc@合約.pdf）');
  }
  // 待簽署 PDF 已改為單一檔案欄位。
  if (s.startsWith('[') || /\.pdf\s*[,|;]\s*\S+@/i.test(s)) throw new Error('V1 僅支援單一 PDF');
  return s;
}
export function pdfDownloadUrl(env, recordId, fileName) {
  const c = taskConfig(env); const u = new URL('/sims/file.jsp',c.base);
  u.searchParams.set('a',c.account);u.searchParams.set('f',rawFileName(fileName));
  u.searchParams.set('p',c.path);u.searchParams.set('si',String(c.sheetIndex));
  u.searchParams.set('nid',String(recordId)); return u.toString();
}
export function str(x){return x == null?'':String(x).trim();}
export function bool(x){return x===true||String(x).toLowerCase()==='true'||x==='Yes'||x==='Y';}
