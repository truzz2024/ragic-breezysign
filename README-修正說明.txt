BreezySign Worker PDF 框線辨識修正（2026-11-21）

問題：原版只會直接辨識封閉矩形路徑，Word 匯出 PDF 的表格可能以獨立橫線和直線構成，因此會把表格中的 [[SIGN:n]] 判斷為沒有矩形框。

已修改：
  src/pdf-inspect.js － 保留封閉矩形判斷，額外蒐集 PDF 的線段並重建表格儲存格。
  src/rect-lines.js － 新增四邊線段幾何辨識函式。
  tests/rect-lines.test.mjs － 4 個幾何測試，使用上傳 PDF 表格的實際座標。

Windows PowerShell（請先切換至原本 worker 資料夾）：
  Expand-Archive -Path "$HOME\Downloads\breezysign-pdf-fix.zip" -DestinationPath "." -Force
  node --check .\src\pdf-inspect.js
  node --check .\src\rect-lines.js
  node --test .\tests\rect-lines.test.mjs
  npx.cmd wrangler deploy

重要：
  1. 壓縮包不包含、也不會覆蓋 Secrets、wrangler.jsonc 或其他 JS 檔案。
  2. 只影響 PDF 框線偵測，Ragic 動作按鈕與 API 寫回流程不變。
  3. 幾何測試通過不代表部署環境下 pdfjs-serverless 完整解析一定成功；部署後仍需用一筆全新測試任務確認。
  4. 目前的 PDF 有 5 個標記（[[SIGN:1]] 共 3 個、[[SIGN:2]] 共 2 個）。如果任務只有一位簽署人，仍會因為 PDF 包含 SIGN:2 而被拒絕；請配置兩位簽署人，或另用只包含 SIGN:1 的 PDF 測試。
  5. 之前 Ragic 顯示「待確認」的任務不要直接重發；請另建一筆測試資料。
