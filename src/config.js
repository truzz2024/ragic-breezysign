/**
 * Ragic 欄位對照表（Worker 唯一的欄位 ID 定義處）
 * 安裝到不同資料庫時，請修改下方 ID；不要直接修改 src/index.js 或 src/ragic.js。
 * 設定表單 1001500/1001508 由 Ragic JS 讀取，不需要在 Worker 內設定。
 * 已移除的「簽署結果」1001460，以及不使用的發起人帳號 1001488，均不再寫入。
 */
export const F = Object.freeze({
  // ===== 電子簽署任務：主表單 =====
  taskNo: 1001458, // Ragic 任務編號
  status: 1001459, // 簽署狀態（主表單）
  startMode: 1001461, // 發起方式：直接／手動
  taskName: 1001462, // 任務文件名稱
  pdf: 1001465, // 待簽署 PDF（單一檔案）
  expiry: 1001466, // 文件簽署期限
  signedPdf: 1001467, // 已簽署 PDF
  schedule: 1001468, // 排程簽署發送時間
  trackPdf: 1001469, // 簽署軌跡檔案
  emailSubject: 1001482, // 簽署信件主旨
  emailMessage: 1001501, // 簽署邀請信訊息內容
  overlay: 1001483, // 顯示前一人簽署內容
  sendDone: 1001485, // 寄送完成通知給簽署人
  returnUrl: 1001484, // 簽署完成後前往網址
  orderMode: 1001486, // 簽署順序模式：同時／依序
  instanceId: 1001487, // 好好簽任務 ID
  initiatorName: 1001489, // 簽署發起人名稱
  cancelName: 1001509, // 簽署取消人名稱
  startTime: 1001491, // 任務開始時間
  endTime: 1001492, // 任務結束時間
  signUrl: 1001490, // 現場簽署網址
  apiStatus: 1001497, // API 執行狀態
  apiMessage: 1001498, // API 訊息
  syncedAt: 1001499, // API 最後同步時間

  // ===== 簽署關卡子表格 =====
  subtable: 1001494, // 簽署關卡子表格 Key
  signerOrder: 1001470, // 簽署順序
  signerName: 1001471, // 簽署人姓名
  signerEmail: 1001472, // 簽署人 Email
  signerPhone: 1001473, // 簽署人手機號碼
  signerStatus: 1001474, // 簽署人個別狀態
  signerSignedTime: 1001475, // 簽署時間
  signerReason: 1001495, // 簽署原因／拒簽原因
  signerFace: 1001477, // 現場簽署
  signerOtp: 1001478, // 需要 OTP 驗證
  signerHostEmail: 1001479, // 現場簽主持人 Email
  signerHostName: 1001480, // 現場簽主持人姓名
  signerCulture: 1001481, // 通知語言
  signerVideo: 1001496, // 需要聲明錄影
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
