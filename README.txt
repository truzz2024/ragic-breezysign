Ragic x BreezySign｜失敗重試與金鑰遮罩修正版

【修正內容】
1. Ragic 串接設定（/breezysign/2）的 1001508 可改為「文字遮罩」。
   JS 只以 query.addIgnoreMaskDomain(1001508) 取得 Worker Token 原值。
2. 已知未建立好好簽任務的錯誤（例如 PDF 驗證失敗、好好簽明確拒絕 createByPdf）
   API 執行狀態改為「失敗」，修正後可在同一筆 Ragic 任務按「發起簽署」重試。
3. 網路中斷、結果不明、建立成功但 Ragic 回寫失敗：保持「待確認」，不自動重試。
4. 只要 1001487 好好簽任務 ID 有值，就禁止重新發起。

【檔案】
- src/index.js             Worker 的 /start 錯誤分類及狀態回寫
- src/breezy.js            判斷好好簽 API 明確拒絕建立的結果
- ragic/action-buttons.js Ragic Installed Sheet Scope
- ragic/post-workflow.js  Ragic Post-workflow（直接發起模式也要同步更新）

【部署順序】
1. 在 worker 資料夾先備份 src/index.js、src/breezy.js。
2. 將 ZIP 解壓縮覆蓋到 worker 資料夾（zip 根層為 src、ragic、tests）。
3. 執行 node --check .\src\index.js、node --check .\src\breezy.js
4. 執行 node --test .\tests\retry-mask.test.mjs
5. 執行 npx.cmd wrangler deploy
6. Ragic /breezysign/3 的 Installed Sheet Scope 替換為 ragic/action-buttons.js。
7. 同表單的 Post-workflow 替換為 ragic/post-workflow.js。
8. Ragic 串接設定欄位 1001508 改成「文字遮罩」，只讓管理員檢視完整值。
   請確認欄位 ID 未變、原值仍存在；若已清空需重填原有 Token。

【操作規則】
- 沒有 instanceId 且狀態為「未發起」、「失敗」：可以重試。
- 有 instanceId，或狀態「發起中」、「成功」、「待確認」：不得直接重新發起。
- 「待確認」須先在好好簽後台確認沒有建立任務，由有權限的人手動改回
  「失敗」，再嘗試。若已建立，應補回 instanceId 並使用重新取得狀態。
- 直接發起模式只在新建當下自動執行；修改後請使用手動發起動作按鈕。

【安全注意】
文字遮罩只是 Ragic 介面中的顯示限制，不是外部 Secrets Vault。
可編輯 Workflow 或具有高階資料權限的管理者仍可能取得金鑰，請限制權限。
不要把金鑰寫進 JavaScript 常數、Log 或 Browser 顯示文字。
