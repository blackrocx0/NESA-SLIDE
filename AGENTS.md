# NESA Slide 內部測試版規則

## 使用者介面

- 預設以繁體中文回覆，先說明結論，再補充必要細節。
- 使用者要求製作簡報但未指定格式時，只先確認：圖片式簡報、網頁式簡報或 PPTX 簡報。
- 新產生的內容一律放在 `workspace/`，不得覆蓋 `demos/`、`prompt_system/` 或系統 runtime。
- 預設不放 Logo；只有使用者本次明確要求時才加入。

## 三種輸出

- 圖片式：先完成 Story、Art Direction 與逐頁 Content Plan，再以七段式 assembled YAML 逐頁呼叫內建 image generation。圖片式簡報不宣稱文字或物件可原生編輯。
- 網頁式：使用 `.agents/skills/render-html-slide/` 與正式 renderer，維持 1920×1080、語意 DOM、編輯器與 localhost 儲存能力；不得把整頁壓成圖片。
- PPTX：使用 `.agents/skills/ppt-builder/` 與 `@oai/artifact-tool`，保留 Master、Custom Layout、Placeholder 與原生可編輯物件；不得用整頁截圖冒充。

## 核心來源與邊界

- `prompt_system/themes/` 與 `prompt_system/layouts/` 是共用語意來源；三種 renderer 使用各自 adapter。
- 本測試包保留 36 個 core Theme、77 個 active Layout、339 份 adapters；四個已退役 `toc-2*` 版型不在包內。
- `demos/` 只是展示與驗收證據，不能作為 new-deck 的內容、Layout sequence 或 CSS runtime source。
- 先完成內容與 Art Direction，再檢查現有 Theme/Layout coverage；不得從範例版型反推文案。

## 完成條件

- 每次交付分開列出實際 artifact、source/manifest、已通過 QA、partial 與 unverified。
- 檔案存在或指令成功不等於成品完成；圖片、HTML、PPTX 必須分別通過對應 renderer QA。
- 未經使用者明確授權，不部署、上傳、push、建立 PR、寄信或修改遠端資料。

