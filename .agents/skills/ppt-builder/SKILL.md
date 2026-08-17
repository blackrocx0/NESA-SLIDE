---
name: ppt-builder
description: Build an editable PPTX from this project's Art Direction, Theme and Layout core, PPTX adapters, content manifest, and optional edited HTML or assembled YAML. Use when the user requests a PowerPoint, PPTX export, masters, custom layouts, placeholders, or native PowerPoint QA.
---

# PPT Builder

將本專案的 Art Direction、Theme／Layout core、PPTX adapters 與內容轉成可編輯 PPTX。HTML 可提供已調整內容與幾何；assembled YAML 可提供內容，但兩者都不是必要的共同 runtime payload。

## 必讀

1. `references/pptx-generation-rules.md`
2. `references/project-format-guide.md`
3. 目標 Theme／Layout core、PPTX adapters、content manifest，以及任務實際提供的 HTML 或 assembled YAML
4. 若 deck 有 Art Direction，讀取並驗證 `prompt_system/art_direction/` handoff
5. `prompt_system/renderers/pptx/themes/<theme-id>.yaml`
6. `prompt_system/renderers/pptx/layouts/<layout-id>.yaml`
7. 若有 HTML 輸入，再讀 `references/html-generation-rules.md`
8. Presentations skill 的 `artifact_tool/API_QUICK_START.md`、`artifact_tool/api/API_DOCS.md`、`artifact_tool/api/references/master.spec.md`、`artifact_tool/api/references/layout.spec.md`

## 實作限制

- 依使用入口選擇 JavaScript builder：Codex／專案正式建檔使用 `@oai/artifact-tool`；HTML 編輯器的一鍵匯出使用內嵌 PptxGenJS browser adapter。
- 兩條路徑必須消費同一份 content／DOM manifest，並產生相同的 master、layout、placeholder 與 native-editable 契約；不得因工具不同降低交付標準。
- 禁止使用 `python-pptx` 或整頁 screenshot 作正式預設輸出。PptxGenJS 只允許用於上述 HTML 編輯器的一鍵匯出情境。
- 每個 theme 建立 master；每個 layout family 建立 child layout 與 placeholders；slide 必須連結 layout。
- renderer 以 theme/layout core 與 PPTX adapters 組成 manifest；既有 `pptx_spec` 只能作
  renderer override，不得直接套用 `html_spec`。
- 有 Art Direction 時，deck manifest 必須保留 direction id、source hash、scene role、
  visual intensity、signature move variant 與素材 provenance。Layout 必須在 scene role
  之後選擇，且不得把招牌手法烘焙成不可編輯的整頁圖片。
- HTML 轉換前先產生 DOM manifest，記錄文字、geometry、computed style、transform、z-index、image source 與 semantic role。
- 轉換採 `native` 優先、`hybrid` fallback；`flat` 只能用於 debug。

## 流程

1. 驗證 Art Direction gate，以及 content manifest、Theme／Layout core、PPTX adapters 與可選 HTML／assembled YAML 的頁數和引用一致。
2. 從 content manifest、core 與 adapters 建立 deck manifest；若有 HTML，合併使用者編輯後的文字與 stage-space geometry；若有 assembled YAML，只擷取本次需要的內容欄位。
3. 建立 theme master、color map、背景與共用 chrome。
4. 建立 layout family、placeholders 與固定結構，連結 parent master。
5. 建立 slides 並以 `slide.setLayout(layout)` 指派；將內容 materialize 成可編輯物件。
6. 匯出 PPTX 與 layout inspection JSON。
7. render 全部投影片、執行 overflow test、逐頁視覺 QA 與 Perceptual QA。
8. 產生 QA ledger，列出每頁 fidelity 與 raster fallback。

## 輸出

- 正式 PPTX：`artifacts/pptx/<deck-name>.pptx`
- renderer source：`artifacts/pptx/builders/<deck-name>.mjs`
- manifest：`artifacts/pptx/manifests/<deck-name>.json`
- QA：`artifacts/qa/pptx/<deck-name>.json`

不得把 scratch preview 或 layout JSON 當成正式交付物。
