---
name: html-image-slide
description: Create or redesign a new editable HTML presentation whose Layout decisions include image-led, half-image, or full-bleed compositions, then generate and attach real per-slide raster backgrounds by default. Use when images affect a new deck's structure; use slide-background-image directly when an existing HTML deck only needs backgrounds attached or replaced.
---

# Image HTML Slide

專門處理「新建或重新規劃含圖片版型的可編輯 HTML 簡報」。本 Skill 是使用者的一站式入口：先從內容與構圖把圖片納入 Layout 決策，再強制接續 `slide-background-image` 的逐頁量測、生圖、套用與 QA。背景實作仍只存在於 `slide-background-image`，本 Skill 不複製其 SAFE ZONE、mask、apply 或 PPTX export 規則。

## Scope

- 適用於新建 HTML deck、以新內容重製 deck，或使用者明確要求從第一版就考慮照片、插圖、地圖、人物、滿版／半版圖片構圖。
- 不適用於已有 HTML 只要附加、替換或檢查背景；那是 `slide-background-image` 的既有流程。
- HTML 仍必須保留語意化 DOM、獨立文字與可編輯物件；不要把整頁做成圖片，也不要把 Image2 assembled YAML 當成 HTML runtime payload。

## Background mode

- `background_mode=auto` 是呼叫本 Skill 的預設語意：新 HTML foreground 通過 QA 後，必須讀取並完整執行 `.agents/skills/slide-background-image/SKILL.md`，逐頁量測、生成、套用與驗證 raster 背景。使用者明確呼叫 `$html-image-slide` 即代表要求這條本機產製流程，不必再追問是否要補圖。
- 只有使用者明確說「只規劃圖片版位／只做 image-aware Layout／不要生圖」時，才可使用 `background_mode=planned-only`，停在 foreground 與圖片 handoff。此模式只能標為 `ready-for-background`／partial，不是完成的圖片簡報。
- 使用者已提供合法圖片時仍維持 `background_mode=auto`，但背景階段改為選取／裁切／套用提供素材；不得無故重新生成替代圖。

## Design handoff before Layout

在選 Layout 前先完成 Story／Content Plan、Art Direction 與逐頁圖片意圖。每頁至少記錄：

- `scene_role`、`content_relation`、主要訊息與內容密度。
- `image_role`：`ambient-background`、`half-image`、`full-bleed` 或 `image-led-content`。
- `focal_region`、`text_safe_region`、`crop_behavior`、`safe_zone_profile`。
- 圖片來源：使用者提供、已授權素材或待生成；保留來源、seed／prompt hash 或待補狀態。
- 預期的 `media_requirement`：需要圖片的頁面使用 `with-image`，流程、表格、數據等不需要圖片的頁面仍可使用 `no-image`。
- `with-image` Layout 只有在當頁有真實素材來源、待生成 image provenance，或明確的 image-role handoff 時才成立；
  `image-planned` 本身不是把空白欄位預留給未來圖片的許可。沒有媒體來源時，改選相容的 `no-image` Layout。

新建圖片 HTML 必須在 Layout 選擇前宣告：

```text
asset_policy=image-planned
layout_selection=dynamic
```

`image-planned` 是混合候選池，不代表每頁都要放圖片。只有使用者要求整份 deck 都是圖片主導時，才使用 `--media-mode with-image`。

## Renderer handoff

先依內容關係選 Layout，再由 `html-pattern-slide` 產生可編輯 foreground。正式入口可使用：

```powershell
python scripts\render_randomized_html_demo.py `
  --output artifacts\html-test\deck.html `
  --content-mode new-deck `
  --asset-policy image-planned `
  --layout-selection dynamic `
  --seed <integer>
```

確認 renderer manifest 保留 `asset_policy`、`layout_selection`、每頁 `media_requirement`、候選池與實際 Layout。不要自動沿用 Preset example story、example layouts 或舊 HTML DOM/CSS。

## Required downstream orchestration

`background_mode=auto` 時，foreground renderer QA 通過只代表中繼 Gate，不是完成。接著必須：

1. 鎖定來源 HTML、renderer manifest 與 image-layout handoff；不得在背景階段重新選 Theme、Layout 或改寫前景內容。
2. 讀取 `.agents/skills/slide-background-image/SKILL.md`，以來源 HTML 執行 `prepare-deck`，完成 browser measurement 與 `masks.json`。
3. 依該 Skill 的 prompt 與 SAFE ZONE 契約逐頁提供真實圖片；待生成素材使用內建 `imagegen` 依序生成，不得用 placeholder、PIL、SVG、Canvas 或 CSS 冒充。
4. 執行 `materialize-deck`／`apply-deck`，只寫入隔離成品；來源 foreground 必須保持未修改。
5. 完成 composite contrast、逐頁 visual、縮圖、editor interaction 與需要時的 PPTX background export QA。

handoff 必須記錄 `background_mode` 與背景狀態序列：`foreground-ready → masks-ready → images-ready → applied → qa-pass`。任何階段未完成時停止完成宣告，保留最後通過狀態與失敗證據；不得自動降級成純色或 placeholder 成品。

## QA

至少確認：

- 圖片意圖在 Layout 選擇前已存在，且 `image-planned` 下確實有相容的 `with-image` 候選或明確逐頁 Layout。
- `no-image` 頁面沒有被為了填圖硬改成照片版；內容關係、閱讀路徑與資訊密度仍正確。
- HTML 有固定 1920×1080 stage、唯一 Content Area、可編輯 `.el`／semantic module 與 editor runtime。
- 沒有 flatten、整頁 screenshot、假圖片 placeholder 冒充正式圖片或把文字烘焙進背景。
- `background_mode=auto` 時，每頁都有對應且可追溯的 raster asset，final HTML 已內嵌背景 data URL，且背景資產與 composite 的 visual／contrast QA 依 `slide-background-image` 結果通過。
- 只有 Layout routing 或 foreground QA 通過，不能宣稱圖片簡報完成。

## Completion boundary

- `background_mode=auto`：只有 image-aware Layout、可編輯 foreground、逐頁 raster 背景、套用結果與 composite/editor QA 全部完成，才算本 Skill 完成。
- `background_mode=planned-only`：完成邊界是 `ready-for-background`，必須標為 partial；不得把 Layout handoff 或 placeholder 描述成完整圖片簡報。
