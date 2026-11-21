/*
 * Ragic /breezysign/3 Post-workflow
 * TruzzDemo 2026-11-21 欄位定義；部署到其他資料庫時 ID 請重新比對。
 * 1. 只於新增且子表格為空時，將隱藏雙關卡匯入子表格。
 * 2. 發起方式「直接」且任務尚未發起時，由 Ragic 主動呼叫專屬 Worker。
 * 3. 更新入庫時不重複呼叫 Worker；Worker 回寫不能再次觸發本流程。
 */
(function () {
  // ==================== 安裝設定（請先修改此區）====================
  // 注意：Sheet Scope 和 Post-workflow 是各自獨立的程式，兩份都需更新。
  var PATHS = {
    task: '/breezysign/3',      // 電子簽署任務表單路徑（不含資料庫名稱）
    settings: '/breezysign/2'   // 串接設定表單路徑（不含資料庫名稱）
  };
  var SETTING_FIELDS = {
    workerUrl: 1001500,   // 串接設定：Cloudflare Worker URL
    workerToken: 1001508  // 串接設定：Cloudflare Worker 驗證金鑰（文字遮罩）
  };
  var ROUTES = {
    start: '/start',       // 發起簽署 API
    cancel: '/cancel',     // 取消簽署 API
    sync: '/sync'          // 重新取得簽署狀態 API
  };
  // ==================== Ragic 欄位 ID（只需修改此區）====================
  var F = {
    taskNo: 1001458, // Ragic 任務編號
    status: 1001459, // 簽署狀態（主表單）
    startMode: 1001461, // 發起方式：直接／手動
    taskName: 1001462, // 任務文件名稱
    pdf: 1001465, // 待簽署 PDF（單一檔案）
    expiry: 1001466, // 文件簽署期限
    schedule: 1001468, // 排程簽署發送時間
    emailSubject: 1001482, // 簽署信件主旨
    emailMessage: 1001501, // 簽署邀請信訊息內容
    overlay: 1001483, // 顯示前一人簽署內容
    sendDone: 1001485, // 寄送完成通知給簽署人
    returnUrl: 1001484, // 簽署完成後前往網址
    orderMode: 1001486, // 簽署順序模式：同時／依序
    instanceId: 1001487, // 好好簽任務 ID
    initiatorName: 1001489, // 簽署發起人名稱
    apiStatus: 1001497, // API 執行狀態
    apiMessage: 1001498, // API 訊息

    // ----- 簽署關卡子表格 -----
    subtable: 1001494, // 簽署關卡子表格 Key
    signerOrder: 1001470, // 簽署順序
    signerName: 1001471, // 簽署人姓名
    signerEmail: 1001472, // 簽署人 Email
    signerPhone: 1001473, // 簽署人手機號碼
    signerFace: 1001477, // 現場簽署
    signerOtp: 1001478, // 需要 OTP 驗證
    signerHostEmail: 1001479, // 現場簽主持人 Email
    signerHostName: 1001480, // 現場簽主持人姓名
    signerCulture: 1001481, // 通知語言
    signerVideo: 1001496, // 需要聲明錄影

    // ----- 快速拋轉專用隱藏欄位 -----
    importName1: 1001502, // 第１位簽核人姓名（拋轉隱藏欄位）
    importEmail1: 1001504, // 第１位簽核人信箱（拋轉隱藏欄位）
    importPhone1: 1001506, // 第１位簽核人電話（拋轉隱藏欄位）
    importName2: 1001503, // 第２位簽核人姓名（拋轉隱藏欄位）
    importEmail2: 1001505, // 第２位簽核人信箱（拋轉隱藏欄位）
    importPhone2: 1001507, // 第２位簽核人電話（拋轉隱藏欄位）
  };
  // ==================== 以下是執行邏輯，通常不需要修改 ====================

  function v(x){return x==null?'':String(x).trim();}
  function flag(x){return x===true||v(x).toLowerCase()==='true'||v(x)==='Yes';}
  function setState(e,s,m){e.setFieldValue(F.apiStatus,s);e.setFieldValue(F.apiMessage,m||'');e.save();}
  function config(){
    var q=db.getAPIQuery(PATHS.settings);
    q.addIgnoreMaskDomain(SETTING_FIELDS.workerToken);
    var c=q.getAPIResult();
    if(!c)throw new Error('找不到串接設定：請建立 '+PATHS.settings+' 的設定資料');
    var url=v(c.getFieldValue(SETTING_FIELDS.workerUrl)).replace(/\/$/,'');
    var token=v(c.getFieldValue(SETTING_FIELDS.workerToken));
    if(!/^https:\/\/[^?#\s]+$/i.test(url)||!token)throw new Error('Worker URL 或驗證金鑰未設定');
    return {url:url,token:token};
  }
  function sub(e,f,i){return v(e.getSubtableFieldValue(F.subtable,i,String(f)));}
  function payload(e){
    var rows=[];
    for(var i=0;i<e.getSubtableSize(F.subtable);i++){
      rows.push({rowId:e.getSubtableRootNodeId(F.subtable,i),order:Number(sub(e,F.signerOrder,i))||i+1,
        name:sub(e,F.signerName,i),email:sub(e,F.signerEmail,i),phone:sub(e,F.signerPhone,i),
        isFace:flag(sub(e,F.signerFace,i)),isNeedOtp:flag(sub(e,F.signerOtp,i)),
        hostEmail:sub(e,F.signerHostEmail,i),hostName:sub(e,F.signerHostName,i),
        culture:sub(e,F.signerCulture,i)||'zh-TW',needVideo:flag(sub(e,F.signerVideo,i))});
    }
    rows.sort(function(a,b){return a.order-b.order||a.rowId-b.rowId;});
    if(!rows.length)throw new Error('請至少新增一個簽署關卡');
    if(!v(e.getFieldValue(F.pdf)))throw new Error('未上傳待簽署 PDF');
    return {recordId:e.getRootNodeId(),
      ragic:{account:db.getApname(),path:db.getPath(),sheetIndex:db.getSheetIndex()},
      task:{name:v(e.getFieldValue(F.taskName))||v(e.getFieldValue(F.taskNo)),
        fileName:v(e.getFieldValue(F.pdf)),initiatorName:v(user.getUserName()),
        expiry:v(e.getFieldValue(F.expiry)),schedule:v(e.getFieldValue(F.schedule)),
        emailSubject:v(e.getFieldValue(F.emailSubject)),emailMessage:v(e.getFieldValue(F.emailMessage)),
        overlay:flag(e.getFieldValue(F.overlay)),sendDone:flag(e.getFieldValue(F.sendDone)),
        returnUrl:v(e.getFieldValue(F.returnUrl)),orderMode:v(e.getFieldValue(F.orderMode))},
      signers:rows};
  }
  function dispatch(e){
    if(v(e.getFieldValue(F.instanceId)))return;
    var status=v(e.getFieldValue(F.apiStatus));
    if(status==='發起中'||status==='成功'||status==='待確認')return;
    var req=payload(e), c=config();
    e.setFieldValue(F.initiatorName,v(user.getUserName()));
    setState(e,'發起中','已送交 Worker，等待建立回應');
    try{
      util.setHeader('Content-Type','application/json');
      util.setHeader('X-Worker-Token',c.token);
      var raw=util.postURL(c.url+ROUTES.start,JSON.stringify(req));
      var d=JSON.parse(String(raw));
      if(!d || d.ok !== true){
        var reason=d && d.message ? String(d.message) : 'Worker 回傳失敗';
        var state=d && d.retrySafe === true ? '失敗' : '待確認';
        var latest=db.getAPIQuery(PATHS.task).getAPIEntry(e.getRootNodeId());
        if(latest&&!v(latest.getFieldValue(F.instanceId)))setState(latest,state,reason.slice(0,240));
        // 已收到 Worker 判定結果，不要在 catch 覆寫成待確認。
        log.info('BreezySign start：'+state+'，'+reason.slice(0,150));
      }else{
        // Worker 將自行回寫 instanceId；此處不再儲存舊 entry，避免覆蓋回填。
        log.info('BreezySign start 已送達 Worker：recordId='+e.getRootNodeId());
      }
    }catch(err){
      // 請求逾時或未取得 Worker 的明確回覆，才設為待確認。
      var fresh=db.getAPIQuery(PATHS.task).getAPIEntry(e.getRootNodeId());
      if(fresh&&!v(fresh.getFieldValue(F.instanceId)))setState(fresh,'待確認','開始請求結果不明，請先檢查好好簽：'+String(err).slice(0,200));
      log.info('BreezySign start 待確認：'+String(err));
    }finally{util.removeHeader('X-Worker-Token');util.removeHeader('Content-Type');}
  }
  if(!param.isCreateNew())return;
  var entry=param.getUpdatedEntry();
  if(!entry)return;
  if(entry.getSubtableSize(F.subtable)===0){
    var people=[
      {name:v(entry.getFieldValue(F.importName1)),email:v(entry.getFieldValue(F.importEmail1)),phone:v(entry.getFieldValue(F.importPhone1))},
      {name:v(entry.getFieldValue(F.importName2)),email:v(entry.getFieldValue(F.importEmail2)),phone:v(entry.getFieldValue(F.importPhone2))}
    ];
    var seq=0;
    for(var p=0;p<people.length;p++){
      if(!people[p].email&&!people[p].name&&!people[p].phone)continue;
      var rid=-100-seq;
      seq++;
      entry.setSubtableFieldValue(F.signerOrder,rid,String(seq));
      entry.setSubtableFieldValue(F.signerName,rid,people[p].name);
      entry.setSubtableFieldValue(F.signerEmail,rid,people[p].email);
      entry.setSubtableFieldValue(F.signerPhone,rid,people[p].phone);
    }
    if(seq>0)entry.save(); // 同張表單預設不重新執行 Post-workflow
  }
  if(v(entry.getFieldValue(F.startMode))==='直接'){
    // 重新取回剛寫入的實際子表格 rowId，避免把負數暫存列 ID 傳給 Worker。
    var saved=db.getAPIQuery(PATHS.task).getAPIEntry(entry.getRootNodeId());
    try{dispatch(saved);}catch(e){
      if(saved)setState(saved,'失敗',String(e).slice(0,250));
      log.info('直接發起前檢查失敗：'+String(e));
    }
  }
})();
