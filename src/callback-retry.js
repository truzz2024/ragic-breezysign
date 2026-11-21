/**
 * Never log callback request body, PDF content, signer identity, or credentials.
 * Status is authoritative only after getInfo; callback is only a signal.
 */
export const retryDelaysMs = [800, 1600, 3000, 5000];

export function expectsFinalCompletion(event) {
  if (String(event?.status||'').toUpperCase() === 'DONE') return true;
  if (event?.result === true) return true;
  // An assignees array may be partial; do not treat all listed assignees signed as proof of task completion.
  return false;
}

export function isTerminalSyncState(status) {
  return status === '簽署完成' || status === '已刪除' || status === '拒絕簽署';
}

export function describeSync(eventStatus, info, state) {
  return { eventStatus, infoResult: info?.result===true?true:info?.result===false?false:null,
    signerStatuses:Array.isArray(info?.data)?info.data.map(x=>String(x?.currentStatus||'').slice(0,24)):[],
    computedStatus:state };
}
