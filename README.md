# NESA Slide v0.1.0-demo.1

NESA Slide 是一個給 Codex Desktop 使用的可攜式簡報工作區，可以製作三種不同成品：圖片式簡報、可編輯 HTML 簡報，以及真正可編輯的 PPTX 簡報。

這是第一個「內部測試版」。它已保留正式生成核心與三份 10 頁展示案例，但不代表所有 Theme × Layout 組合都已逐一人工驗收。

## 60 秒快速開始

1. 開啟 Codex Desktop。
2. 選擇 **Open folder／開啟資料夾**，開啟桌面的 `nesa slide`。
3. 建立新 task，貼上其中一段：

```text
請用 NESA Slide 幫我做一份圖片式簡報，內容是：……
```

```text
請用 NESA Slide 幫我做一份可編輯 HTML 簡報，內容是：……
```

```text
請用 NESA Slide 幫我做一份可編輯 PPTX 簡報，內容是：……
```

4. 新成品會放在 `workspace/`，不會覆蓋展示案例。

第一次使用，建議先雙擊 `CHECK_SYSTEM.cmd`。若電腦找不到 Python，可直接在 Codex 中輸入：

```text
幫我檢查 NESA Slide 系統。
```

## 三種格式怎麼選

| 格式 | 適合情境 | 可編輯程度 | 主要限制 |
|---|---|---|---|
| 圖片式簡報 | 提案視覺、品牌概念、需要每頁像完整海報 | 圖片本身不可拆開編輯 | 圖中文字若要修改，通常需要重新生成 |
| HTML 簡報 | 瀏覽器播放、現場修改、拖拉物件、快速匯出 | 文字、群組、位置、尺寸與樣式可編輯 | 要直接寫回原 HTML，需用 localhost 或完成檔案綁定 |
| PPTX 簡報 | PowerPoint 協作、正式簡報、交給他人續改 | 文字、基本圖形、表格與圖表為原生物件 | 特殊網頁效果在 PowerPoint 中可能採近似呈現 |

這三種格式共用 Theme 與 Layout 的語意核心，但各自重新適配；系統不會拿圖片式成品冒充可編輯 PPTX，也不會要求 HTML 先走圖片生成流程。

## 三份展示案例

### 1. 圖片式｜潮汐旅宿

位置：`demos/image/tide-house/`

- 10 張 16:9 正式 PNG。
- 10 份七段式 assembled YAML。
- `tide-house-image-deck.pptx`：把 10 張圖片封裝成可播放的圖片式 PowerPoint；整頁圖片不可拆開編輯。
- `contact-sheet.png`：快速查看整份視覺節奏。

### 2. HTML｜巷口再生

位置：`demos/html/street-revival/`

- `street-revival.html`：10 頁可編輯瀏覽器簡報。
- `street-revival.manifest.json`：記錄內容、Theme、Layout 與 renderer 來源。
- `edit-mode.js`：相鄰的編輯器 runtime。

最快查看：雙擊 `OPEN_HTML_DEMO.cmd`。

需要自動寫回檔案：雙擊 `START_HTML_EDITOR.cmd`。系統優先使用 `http://127.0.0.1:7394/`；若 7394 已被占用，會自動改用下一個可用 port。

### 3. PPTX｜MIST POP 90 天上市計畫

位置：`demos/pptx/mist-pop-launch/`

- `mist-pop-launch.pptx`：10 頁 native-editable PowerPoint。
- `builder.mjs`：可重建的建檔來源。
- `package-inspection.json`：Master、Custom Layout、Placeholder 與原生物件檢查。
- `contact-sheet.png`：快速查看整份版面節奏。

三份案例的公司、品牌、數據與情境都是虛構示範，不代表真實市場資訊。

## HTML 編輯與儲存

### 直接雙擊 HTML

- 可播放、改字、拖拉、縮放、群組、復原／重做與匯出。
- 瀏覽器會用 localStorage 保留草稿。
- 若尚未完成檔案綁定，不會自動覆寫磁碟上的原檔。

### 使用 `START_HTML_EDITOR.cmd`

- 透過 localhost 開啟可寫入環境。
- 編輯停止約 1.5 秒後會自動透過 `/__save` 寫回 HTML。
- 請保持命令視窗開啟；完成後按 `Ctrl+C` 停止。

### 匯出

- **匯出調整後 HTML**：下載一份包含目前修改的新 HTML。
- **匯出 PPTX**：從目前 DOM 建立可編輯 PowerPoint；複雜 CSS 效果可能以原生近似方式呈現，不會用整頁截圖遮住內容。

## 提示詞範例

### 圖片式簡報

```text
請製作 8 頁圖片式簡報。主題是永續旅遊提案，受眾是品牌合作夥伴；請先完成內容與 Art Direction，再逐頁產生圖片並檢查文字、安全區與整體節奏。不要放 Logo。
```

### HTML 簡報

```text
請製作 10 頁可編輯 HTML 簡報。主題是工作坊成果報告，使用全新內容，不要套用 Preset 的範例故事；完成後請提供可儲存的 localhost 連結。
```

### PPTX 簡報

```text
請製作 10 頁真正可編輯的 PPTX。主題是 90 天產品上市計畫；要有 Master、Custom Layout、Placeholder 與原生文字／圖形，完成後逐頁渲染檢查。
```

## 系統包含什麼

- 36 個 core Theme。
- 77 個 active Layout。
- Image2、HTML、PPTX 共 339 份 renderer adapters。
- 專案內建的大綱、共用設計、圖片 YAML、HTML 與 PPTX Skills。
- HTML 共用 editor、PPTX browser export runtime 與本機儲存 server。

四個已退役的 `toc-2*` 版型沒有放入測試包。17 個已發布 HTML Preset 可供正式自動選擇；仍標記為 draft 的 Preset 不會自動進入一般生成池。

為了讓套件可攜，`clinical-evidence-atlas` 的 Gallery 專用預覽路徑與部署網址已從本測試包的 catalog 移除；Theme、Layout、Preset 選擇與生成語意沒有改變。

## 資料夾說明

```text
nesa slide/
├─ .agents/skills/       Codex 專案 Skills
├─ prompt_system/        Theme、Layout 與三種 adapters
├─ references/           正式生成與 QA 契約
├─ scripts/              renderer、檢查與啟動工具
├─ src/html-editor/      HTML 編輯器正式原稿
├─ artifacts/html-test/  HTML 必要 runtime，不是研發成品庫
├─ demos/                三份正式展示案例
└─ workspace/            你的新簡報與系統檢查報告
```

本測試包不包含原始 repo 的 `.git`、node_modules、experiments、tests、研究資料、歷史 QA、Gallery、部署內容、review、tmp、`.history`、`To_delete` 或失敗候選。

## 驗證狀態

| 項目 | 狀態 | 說明 |
|---|---|---|
| Core／adapter 結構 | **Passed** | 36 Themes、77 active Layouts、339 adapters；4 個退役 `toc-2*` 為零 |
| 圖片案例 | **Passed with scope** | 10 份七段式 YAML、10 張 1920×1080 PNG、逐頁視覺檢查與 PowerPoint 原生渲染 10／10；圖片式 PPTX 本來就不可拆開編輯 |
| HTML 案例 | **Passed** | static、CSS ownership、geometry、visual contract、互動、存檔、下載重開與 browser PPTX export 均通過 |
| PPTX 案例 | **Passed** | 10 頁、Master、10 個 Custom Layout、30 個 Placeholder、原生物件、overflow 與 PowerPoint 原生渲染 10／10 均通過 |
| 全部 36×77 視覺組合 | **Unverified** | 本版只驗證結構覆蓋與三份正式案例，不宣稱全矩陣人工通過 |

最後實際狀態以 `release-manifest.json`、各案例的 `qa-summary.json` 與 `CHECK_SYSTEM.cmd` 為準。

目前仍保留的驗證邊界：HTML 的 live Google Fonts 網路載入未驗證，browser 匯出的 PPTX 尚未另以 PowerPoint Desktop 重開；原生 PPTX 已通過結構與渲染，但尚未逐物件人工編輯，且未安裝 Noto Sans TC 的電腦可能發生字型替代。這些都不影響三份案例在本機的既定展示路徑。

## 常見問題

### Codex 沒有使用 NESA Slide 規則

確認 Codex Desktop 開啟的是整個 `nesa slide` 資料夾，而不是其中的 `demos` 子資料夾；重新建立一個 task 後再試。

### HTML 可以改，但沒有寫回原檔

直接雙擊時可能只有草稿保護。請改用 `START_HTML_EDITOR.cmd`，或在 HTML 中按「綁定並存檔」並選取要寫回的檔案。

### localhost 7394 打不開

啟動器會嘗試 7394 之後的可用 port。若仍失敗，關閉其他本機伺服器，或在 Codex 輸入「幫我開啟可儲存的 HTML Demo」。

### 圖片生成失敗

圖片式簡報依賴 Codex 當下可用的內建 image generation。登入或工具不可用時，系統會標記 blocked；不會偷偷改用需要 API key 的 CLI。

### PPTX 看起來與 HTML 不完全一樣

PowerPoint 與瀏覽器的字型與效果能力不同。系統優先保留原生可編輯物件；無法一對一表達的效果會記錄 approximation，而不是加整頁圖片遮住內容。

### PowerPoint 沒有安裝

仍可建立 PPTX package，但 PowerPoint 原生渲染與人工開檔驗收會標記 unverified。正式交付前建議在有 PowerPoint 的電腦重新驗證。

## 隱私與連線

- 測試包不包含 API key、token、客戶資料或登入憑證。
- HTML 本機 server 只綁定 `127.0.0.1`。
- 圖片式簡報使用內建生圖功能時，只有本次提示內容會依 Codex 服務流程送出；不要放入未經授權的客戶、員工或合約資料。
- 本系統不會自行部署、上傳、寄信、push 或建立 PR。

## 更新與移除

- 更新前先備份 `workspace/`。
- 新版本應安裝到新的空資料夾，完成 `CHECK_SYSTEM.cmd` 後再搬回自己的成品。
- 要移除系統，先備份 `workspace/`，再刪除整個 `nesa slide` 資料夾即可；沒有 Registry 或全域 Skill 需要解除安裝。

## 授權

專案授權與第三方聲明請見 `LICENSE` 與 `THIRD_PARTY_NOTICES.md`。
