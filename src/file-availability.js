/** Only retry known file-not-yet-available errors. No secret or PII logs. */
export const retryableFileDelaysMs = [900, 1800, 3000];
export function isTemporarilyMissingFile(error) {
  const message = String(error?.message ?? error ?? '').toUpperCase();
  return message.includes('FILE_NOT_FOUND');
}
export function describeFileIssue(error) {
  const message = String(error?.message ?? error ?? '').toUpperCase();
  if (message.includes('FILE_NOT_FOUND')) return 'FILE_NOT_FOUND';
  if (message.includes('回傳非 JSON')) return 'INVALID_JSON';
  if (message.includes('過大') || message.includes('超過設定上限')) return 'FILE_TOO_LARGE';
  if (message.includes('RAGIC 回寫'.toUpperCase())) return 'RAGIC_UPLOAD_FAILED';
  return 'DOWNLOAD_OR_UPLOAD_FAILED';
}
