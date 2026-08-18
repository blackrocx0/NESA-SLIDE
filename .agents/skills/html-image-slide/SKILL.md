---
name: html-image-slide
description: Create or redesign a new editable HTML presentation whose Layout decisions include image-led, half-image, or full-bleed visual compositions from the beginning. Use when images affect the slide structure; use slide-background-image instead when an existing HTML deck only needs backgrounds attached or replaced.
---

# Image HTML Slide

專門處理「新建或重新規劃含圖片版型的可編輯 HTML 簡報」。本 Skill 負責從內容與構圖開始把圖片納入 Layout 決策；逐頁 raster 背景的量測、生成、套用與 PPTX export 仍交給 `slide-background-image`。

## Scope

- 適用於新建 HTML deck、以新內容重製 deck，或使用者明確要求從第一版就考慮照片、插圖、地圖、人物、滿版／半版圖片構圖。
- 不適用於已有 HTML 只要附加、替換或檢查背景；那是 `slide-background-image` 的既有流程。
- HTML 仍必須保留語意化 DOM、獨立文字與可編輯物件；不要把整頁做成圖片，也不要把 Image2 assembled YAML 當成 HTML runtime payload。

## Design handoff before Layout

在選 Layout 前先完成 Story／Content Plan、Art Direction 與逐頁圖片意圖。每頁至少記錄：

- `scene_role`、`content_relation`、主要訊息與內容密度。
- `image_role`：`ambient-background`、`half-image`、`full-bleed` 或 `image-led-content`。
- `focal_region`、`text_safe_region`、`crop_behavior`、`safe_zone_profile`。
- 圖片來源：使用者提供、已授權素材或待生成；保留來源、seed／prompt hash 或待補狀態。
- 預期的 `media_requirement`：需要圖片的頁面使用 `with-image`，流程、表格、數據等不需要圖片的頁面仍可使用 `no-image`。

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

若要把真正的逐頁 raster 背景生成並套回這份新 HTML：

1. 保留 `html-pattern-slide` 產出的 HTML foreground 與 manifest。
2. 交給 `.agents/skills/slide-background-image/SKILL.md`，從 `prepare-deck` 的 browser measurement 開始。
3. 由該 Skill 產生／選取每頁背景、執行 `materialize-deck`／`apply-deck`，再做 HTML editor、contrast、visual 與 PPTX QA。

## QA

至少確認：

- 圖片意圖在 Layout 選擇前已存在，且 `image-planned` 下確實有相容的 `with-image` 候選或明確逐頁 Layout。
- `no-image` 頁面沒有被為了填圖硬改成照片版；內容關係、閱讀路徑與資訊密度仍正確。
- HTML 有固定 1920×1080 stage、唯一 Content Area、可編輯 `.el`／semantic module 與 editor runtime。
- 沒有 flatten、整頁 screenshot、假圖片 placeholder 冒充正式圖片或把文字烘焙進背景。
- 若已套用 raster 背景，背景資產與 composite 的 visual／contrast QA 必須依 `slide-background-image` 的結果回報；只有 Layout routing 通過不能宣稱背景成品完成。

## Completion boundary

本 Skill 的完成是「新 HTML 的 image-aware Layout 與可編輯 foreground 已產生並通過 renderer QA」。逐頁背景若尚未生成、套用或完成視覺 QA，必須明確標記為 partial，不得把 Layout handoff 當成完整圖片背景交付。
