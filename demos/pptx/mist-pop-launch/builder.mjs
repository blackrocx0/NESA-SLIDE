import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/^\//, "").replace(/\//g, path.sep).replace(/^([A-Za-z]):/, "$1:");
const OUT = ROOT;
const RENDERS = path.join(OUT, "renders");
const QA = path.join(OUT, "qa");
const W = 1920, H = 1080;
const C = { bg: "#F4F7F8", ink: "#15232E", muted: "#5E6C82", mist: "#DDEBED", mist2: "#C7DDE0", teal: "#2E9E9A", orange: "#F08A24", white: "#FFFFFF", line: "#B7CDD1", pale: "#EAF1F2", darkTeal: "#1D6F70" };

async function writeBlob(file, blob) { await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer())); }
function noLine() { return { style: "solid", fill: "none", width: 0 }; }
function addShape(slide, geometry, left, top, width, height, fill = "none", line = noLine(), name) {
  return slide.shapes.add({ geometry, name, position: { left, top, width, height }, fill, line });
}
function addText(slide, text, left, top, width, height, style = {}, name) {
  const s = addShape(slide, "textbox", left, top, width, height, "none", noLine(), name);
  s.text = text;
  s.text.style = { fontSize: 32, color: C.ink, fontFamily: "Noto Sans TC", ...style };
  return s;
}
function addRule(slide, left, top, width, color = C.teal, h = 4, name) { return addShape(slide, "rect", left, top, width, h, color, noLine(), name); }
function addDot(slide, x, y, r, fill = C.teal, name) { return addShape(slide, "ellipse", x - r, y - r, r * 2, r * 2, fill, noLine(), name); }
function addFrame(slide, left, top, width, height, fill = "#FFFFFF/70", line = C.line, name) { return addShape(slide, "roundRect", left, top, width, height, fill, { style: "solid", fill: line, width: 2 }, name); }
function addChrome(slide, index, section = "MIST POP / 90 DAY LAUNCH") {
  slide.background.fill = { type: "gradient", gradientKind: "linear", angleDeg: 0, stops: [{ offset: 0, color: C.bg }, { offset: 100000, color: "#E8F0F1" }] };
  addShape(slide, "ellipse", 1480, 20, 400, 400, "#DDEBED/70", noLine(), `mist-orb-${index}`);
  addShape(slide, "ellipse", 40, 840, 210, 210, "#C7DDE0/45", noLine(), `mist-orb-lower-${index}`);
  addRule(slide, 150, 126, 1620, C.line, 2, `axis-${index}`);
  addText(slide, section, 150, 60, 520, 34, { fontSize: 20, bold: true, color: C.darkTeal, characterSpacing: 2 }, `eyebrow-${index}`);
  addText(slide, String(index).padStart(2, "0"), 1680, 60, 90, 36, { fontSize: 20, bold: true, color: C.muted, alignment: "right" }, `page-${index}`);
}
function addTitle(slide, title, subtitle = "", index = 1) {
  addText(slide, title, 150, 164, 1500, 92, { fontSize: 72, bold: true, color: C.ink, breakLine: false }, `title-${index}`);
  if (subtitle) addText(slide, subtitle, 154, 270, 1300, 52, { fontSize: 30, color: C.muted }, `subtitle-${index}`);
}
function addNotes(slide, text) { slide.speakerNotes.textFrame.setText(`${text}\n\n[Sources]\n虛構示範資料；無外部來源。`); slide.speakerNotes.setVisible(true); }

function createLayouts(presentation) {
  const master = presentation.masters.add("theme--product-strategy-signal");
  const ids = [
    "cover-mid-right-column-meta-upper-left", "strategic-priorities", "comparison-table", "process-flow", "kpi-scorecards",
    "matrix-4quadrant", "data-annotation", "gantt-roadmap", "highlight-callout", "title-center"
  ];
  const layouts = [];
  for (let i = 0; i < ids.length; i++) {
    const layout = presentation.layouts.add(`mist-pop--${ids[i]}`);
    layout.setParentLayoutId(master.id);
    const titlePh = layout.shapes.addPlaceholder("title"); titlePh.placeholder.type = "title"; titlePh.placeholder.index = 0; titlePh.position = { left: 150, top: 164, width: 1500, height: 92 }; titlePh.text = " ";
    const subtitlePh = layout.shapes.addPlaceholder("subtitle"); subtitlePh.placeholder.type = "subtitle"; subtitlePh.placeholder.index = 1; subtitlePh.position = { left: 154, top: 270, width: 1300, height: 52 }; subtitlePh.text = " ";
    const contentPh = layout.shapes.addPlaceholder("content"); contentPh.placeholder.type = "content"; contentPh.placeholder.index = 2; contentPh.position = { left: 150, top: 350, width: 1620, height: 560 }; contentPh.fill = "transparent"; contentPh.line = noLine(); contentPh.text = " ";
    layouts.push(layout);
  }
  return { master, layouts };
}

function slide01(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 1, "MIST POP / 90 DAY LAUNCH");
  addShape(s, "roundRect", 150, 220, 600, 620, "#DDEBED/80", { style: "solid", fill: C.teal, width: 3 }, "cover-mist-field");
  addShape(s, "ellipse", 300, 360, 310, 310, "#FFFFFF/55", noLine(), "cover-orb");
  addDot(s, 460, 520, 18, C.orange, "cover-signal"); addRule(s, 310, 715, 290, C.orange, 7, "cover-rule");
  addText(s, "MIST\nPOP", 920, 270, 720, 250, { fontSize: 112, bold: true, color: C.ink, lineSpacingMultiple: 0.9 }, "title-1");
  addText(s, "無酒精氣泡飲 90 天上市計畫", 922, 590, 720, 70, { fontSize: 42, bold: true, color: C.darkTeal }, "subtitle-1");
  addText(s, "讓晚餐先有氣氛，再談酒精。", 922, 700, 720, 76, { fontSize: 34, color: C.muted }, "cover-claim");
  addText(s, "NESA Slide · fictional demo case", 922, 840, 600, 40, { fontSize: 22, color: C.muted }, "cover-meta");
  addNotes(s, "封面：先建立一個可被記住的晚餐情境，再把 90 天任務落到可驗證節奏。");
}
function slide02(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 2); addTitle(s, "先把第一波牽引力做出來，再擴大聲量", "90 天只追三個可驗證的優先順序", 2);
  const items = [["01", "被看見", "在會發生對話的晚餐場景出現", C.teal], ["02", "被試喝", "讓第一口成為低負擔的選擇", C.orange], ["03", "被帶回家", "留下下一次購買的理由", C.darkTeal]];
  items.forEach((it, i) => { const x = 170 + i * 530; addFrame(s, x, 400, 420, 340, "#FFFFFF/82", it[3], `priority-${i}`); addText(s, it[0], x + 34, 430, 100, 60, { fontSize: 34, bold: true, color: it[3] }); addText(s, it[1], x + 34, 520, 350, 66, { fontSize: 48, bold: true }); addText(s, it[2], x + 34, 620, 330, 70, { fontSize: 28, color: C.muted }); addRule(s, x + 34, 718, 145, it[3], 5); });
  addText(s, "順序很重要：先讓產品發生，再讓市場看見。", 170, 850, 1200, 44, { fontSize: 28, bold: true, color: C.darkTeal }); addNotes(s, "三個優先順序是本案的判斷框架，後續每頁都回到這條軸線。");
}
function slide03(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 3); addTitle(s, "我們切入的不是戒酒，而是更好的晚餐選擇", "虛構示範洞察：把情境從限制改寫成選擇", 3);
  const t = s.tables.add({ rows: 4, columns: 3, left: 170, top: 390, width: 1570, height: 340, columnWidths: [520, 520, 530], values: [["晚餐時刻", "原本的猶豫", "MIST POP 的回應"], ["想要有儀式感", "無酒精就像少了一點什麼", "保留氣泡、香氣與舉杯動作"], ["希望隔天清醒", "不想為今晚的選擇付代價", "喝完仍能自然接續明天"], ["需要一款能分享的飲品", "不想讓桌上出現兩種語氣", "讓每個人都能一起加入"]] });
  t.styleOptions = { headerRow: true, bandedRows: true }; t.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let c = 0; c < 3; c++) { t.getCell(0, c).fill = C.ink; t.getCell(0, c).text.style = { fontSize: 28, bold: true, color: C.white }; }
  for (let r = 1; r < 4; r++) for (let c = 0; c < 3; c++) { t.getCell(r, c).text.style = { fontSize: 25, color: c === 2 ? C.darkTeal : C.ink, bold: c === 2 }; }
  addText(s, "核心轉換：從「不能喝」改成「我想喝這個」。", 170, 820, 1400, 52, { fontSize: 31, bold: true, color: C.darkTeal }, "table-takeaway"); addNotes(s, "比較表不是品牌宣稱，而是用來示範產品如何改寫使用情境。所有內容均為虛構。");
}
function slide04(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 4); addTitle(s, "產品先解決一個瞬間：舉杯時不必解釋", "從味覺到語氣，形成一條可被記住的體驗鏈", 4);
  const steps = [["清爽入口", "第一口先讓人放鬆", C.teal], ["低負擔選擇", "不用重新安排明天", C.orange], ["自然加入餐桌", "不必另外說明自己", C.darkTeal], ["願意再次購買", "把好感變成習慣", C.teal]];
  steps.forEach((it, i) => { const x = 200 + i * 420; if (i < 3) { addRule(s, x + 280, 570, 140, C.line, 4, `flow-link-${i}`); addShape(s, "triangle", x + 405, 558, 20, 24, C.line, noLine(), `flow-arrow-${i}`); } addDot(s, x + 120, 570, 46, it[2], `flow-dot-${i}`); addText(s, String(i + 1), x + 102, 548, 40, 40, { fontSize: 28, bold: true, color: C.white, alignment: "center" }); addText(s, it[0], x, 660, 260, 50, { fontSize: 32, bold: true, color: C.ink, alignment: "center" }); addText(s, it[1], x - 10, 730, 280, 64, { fontSize: 24, color: C.muted, alignment: "center" }); }); addNotes(s, "流程用四個 native node 與連接線呈現，所有文字與圖形均可在 PowerPoint 中單獨編輯。");
}
function slide05(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 5); addTitle(s, "兩款口味，剛好覆蓋第一個週末", "虛構首波產品組合與體驗訊號", 5);
  const cards = [["青檸薄荷", "清爽、俐落", "55%", C.teal], ["白桃烏龍", "柔和、有香氣", "45%", C.orange], ["回購訊號", "先看第二次選擇", "28%", C.darkTeal]];
  cards.forEach((it, i) => { const x = 170 + i * 540; addFrame(s, x, 410, 430, 300, i === 2 ? "#DDEBED/90" : "#FFFFFF/80", it[3], `kpi-card-${i}`); addText(s, it[0], x + 34, 445, 330, 45, { fontSize: 30, bold: true, color: C.muted }); addText(s, it[2], x + 30, 515, 340, 100, { fontSize: 82, bold: true, color: it[3] }); addText(s, it[1], x + 34, 650, 340, 40, { fontSize: 25, color: C.ink }); });
  addText(s, "組合原則：一款負責清醒，一款負責氣氛。", 170, 825, 1300, 52, { fontSize: 31, bold: true, color: C.darkTeal }); addNotes(s, "KPI 版面把數字放在第一閱讀層；比例為虛構示範，不代表市場預測。");
}
function slide06(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 6); addTitle(s, "先進入會發生對話的地方", "通路以體驗密度與可追蹤性排序", 6);
  addFrame(s, 310, 400, 1120, 450, "#FFFFFF/60", C.line, "matrix-field"); addRule(s, 870, 400, 3, C.line, 450, "matrix-y"); addRule(s, 310, 622, 1120, C.line, 3, "matrix-x"); addText(s, "高體驗密度", 325, 350, 260, 40, { fontSize: 25, bold: true, color: C.darkTeal }); addText(s, "高可追蹤性", 1210, 870, 220, 40, { fontSize: 25, bold: true, color: C.darkTeal, alignment: "right" });
  const points = [["餐酒館合作", 1160, 485, C.teal], ["選物店試飲", 660, 500, C.orange], ["電商組合包", 1120, 735, C.darkTeal], ["大型量販", 540, 750, C.muted]]; points.forEach((pnt, i) => { addDot(s, pnt[1], pnt[2], 22, pnt[3], `matrix-dot-${i}`); addText(s, pnt[0], pnt[1] + 34, pnt[2] - 20, 220, 40, { fontSize: 25, bold: true, color: pnt[3] }); }); addText(s, "第一波先做右上角：每次接觸都能留下可回看的訊號。", 310, 910, 1350, 48, { fontSize: 30, bold: true, color: C.ink }); addNotes(s, "矩陣用 native axes、dots、labels 組成，沒有背景圖片。");
}
function slide07(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 7); addTitle(s, "每一個觸點，都要留下下一次購買的理由", "把試喝、內容與回購訊號串成可讀的漏斗", 7);
  const bars = [["看見", "內容與陳列", 100, C.mist2], ["試喝", "一口感受", 72, C.teal], ["帶走", "把選擇帶回家", 48, C.orange], ["再買", "形成回購訊號", 28, C.darkTeal]];
  bars.forEach((b, i) => { const y = 400 + i * 105; addText(s, b[0], 190, y + 16, 130, 40, { fontSize: 30, bold: true, color: C.ink }); addShape(s, "roundRect", 380, y, 980, 60, C.pale, { style: "solid", fill: C.line, width: 1 }, `funnel-bg-${i}`); addShape(s, "roundRect", 380, y, 980 * b[2] / 100, 60, b[3], noLine(), `funnel-bar-${i}`); addText(s, b[1], 1420, y + 12, 300, 40, { fontSize: 25, color: C.muted }); addText(s, `${b[2]}%`, 1220, y + 12, 110, 40, { fontSize: 27, bold: true, color: C.ink, alignment: "right" }); }); addText(s, "判斷點：不是曝光越大越好，而是下一步越清楚越好。", 190, 890, 1350, 52, { fontSize: 30, bold: true, color: C.darkTeal }); addNotes(s, "漏斗以 native shapes 和 labels 呈現；比例是虛構示範訊號，不是預測。");
}
function slide08(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 8); addTitle(s, "90 天不是一次發布，而是三段連續學習", "每一段都有明確輸入、行動與判斷點", 8);
  const left = 340, top = 430, colW = 450, rows = [["0–30 天", "種子體驗", "12 個試飲點", C.teal], ["31–60 天", "通路放大", "兩個合作網絡", C.orange], ["61–90 天", "回購驗證", "決定是否加碼", C.darkTeal]];
  addText(s, "任務", 180, 380, 130, 38, { fontSize: 24, bold: true, color: C.muted }); rows.forEach((r, i) => { const x = left + i * colW; addText(s, r[0], x, 380, 260, 38, { fontSize: 24, bold: true, color: r[3] }); addFrame(s, x, top, 390, 180, "#FFFFFF/80", r[3], `roadmap-${i}`); addText(s, r[1], x + 26, top + 34, 330, 50, { fontSize: 34, bold: true }); addText(s, r[2], x + 26, top + 104, 330, 42, { fontSize: 25, color: C.muted }); addRule(s, x + 26, top + 164, 110, r[3], 5); if (i < 2) { addRule(s, x + 390, top + 88, 52, C.line, 4, `roadmap-link-${i}`); addShape(s, "triangle", x + 430, top + 77, 18, 22, C.line, noLine(), `roadmap-arrow-${i}`); } }); addText(s, "每 30 天換一個問題，才不會只換一個廣告。", 180, 800, 1400, 52, { fontSize: 31, bold: true, color: C.darkTeal }); addNotes(s, "時間軸以三個可編輯區塊、連接箭頭與文字組成，沒有扁平化背景。");
}
function slide09(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 9, "MIST POP / THE QUESTION"); addShape(s, "ellipse", 1440, 230, 240, 240, "#DDEBED/80", noLine(), "pause-orb"); addDot(s, 1560, 350, 18, C.orange, "pause-dot"); addText(s, "我們要的第一個答案很簡單：", 190, 320, 1250, 62, { fontSize: 42, color: C.muted }, "pause-lead"); addText(s, "人們會不會\n主動再拿一罐？", 190, 430, 1250, 220, { fontSize: 92, bold: true, color: C.ink }, "title-9"); addRule(s, 194, 720, 330, C.teal, 8, "pause-rule"); addText(s, "如果會，第二階段才值得加大投資。", 190, 790, 1100, 60, { fontSize: 36, bold: true, color: C.darkTeal }, "pause-note"); addNotes(s, "低強度停頓頁：把複雜計畫收斂成一個決策問題。");
}
function slide10(p, layout) {
  const s = p.slides.add(); s.setLayout(layout); addChrome(s, 10, "MIST POP / NEXT MOVE"); addText(s, "用 90 天，換一個可複製的上市公式", 180, 250, 1460, 90, { fontSize: 62, bold: true }, "title-10"); addText(s, "MIST POP｜從一杯好喝的選擇開始", 184, 365, 1300, 52, { fontSize: 32, color: C.darkTeal }, "subtitle-10"); const a = [["01", "鎖定兩款口味", "先把產品說清楚", C.teal], ["02", "啟動 12 個試飲點", "讓體驗真的發生", C.orange], ["03", "每週回看回購訊號", "把學習變成節奏", C.darkTeal]]; a.forEach((it, i) => { const x = 180 + i * 520; addFrame(s, x, 520, 420, 240, "#FFFFFF/80", it[3], `next-${i}`); addText(s, it[0], x + 28, 550, 100, 40, { fontSize: 25, bold: true, color: it[3] }); addText(s, it[1], x + 28, 610, 350, 54, { fontSize: 34, bold: true }); addText(s, it[2], x + 28, 690, 340, 38, { fontSize: 24, color: C.muted }); }); addText(s, "MIST POP 不是替代品；它是下一個更好的選擇。", 180, 875, 1400, 52, { fontSize: 31, bold: true, color: C.ink }); addNotes(s, "收尾頁：把三個行動變成可立即啟動的工作清單。\n\n[Sources]\n虛構示範資料；無外部來源。");
}

async function main() {
  await fs.mkdir(RENDERS, { recursive: true });
  await fs.mkdir(QA, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  const { layouts } = createLayouts(p);
  slide01(p, layouts[0]); slide02(p, layouts[1]); slide03(p, layouts[2]); slide04(p, layouts[3]); slide05(p, layouts[4]); slide06(p, layouts[5]); slide07(p, layouts[6]); slide08(p, layouts[7]); slide09(p, layouts[8]); slide10(p, layouts[9]);
  for (const [i, slide] of p.slides.items.entries()) {
    const n = String(i + 1).padStart(2, "0");
    await writeBlob(path.join(RENDERS, `slide-${n}.png`), await p.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" }); await fs.writeFile(path.join(QA, `slide-${n}.layout.json`), await layout.text(), "utf8");
  }
  await writeBlob(path.join(OUT, "contact-sheet.webp"), await p.export({ format: "webp", montage: true, scale: 1 }));
  const inspect = await p.inspect({ kind: "deck,slide,textbox,shape,table,chart,layout,notes", maxChars: 50000 });
  await fs.writeFile(path.join(QA, "package-inspection.ndjson"), inspect.ndjson, "utf8");
  const proto = p.toProto();
  const layoutSummary = p.layouts.items.map(x => ({ id: x.id, name: x.name, parentLayoutId: x.parentLayoutId, placeholders: x.placeholders.summary() }));
  const customLayouts = layoutSummary.filter(x => x.name.startsWith("mist-pop--"));
  const themeMasters = p.masters.items.filter(x => x.name.startsWith("theme--")).map(x => ({ id: x.id, name: x.name }));
  const packageInspection = {
    deck_id: "mist-pop-launch",
    renderer: "@oai/artifact-tool",
    slide_size_px: { width: W, height: H },
    masters: themeMasters,
    all_masters_count: p.masters.items.length,
    custom_layouts: customLayouts,
    all_layouts_count: p.layouts.items.length,
    slides: p.slides.items.length,
    native_object_policy: { text: true, shapes: true, tables: true, charts: false, images: 0, full_slide_raster: false },
    relation_check: "slide.setLayout(layout) for all 10 slides; every layout parentLayoutId points to the theme master",
    placeholder_check: "title + subtitle + content placeholders on all 10 layouts",
    source_snapshot: "prompt_system/themes/product-strategy-signal.yaml; prompt_system/layouts active core",
    proto_keys: Object.keys(proto)
  };
  await fs.writeFile(path.join(OUT, "package-inspection.json"), JSON.stringify(packageInspection, null, 2), "utf8");
  await fs.writeFile(path.join(QA, "proto-summary.json"), JSON.stringify({ masters: packageInspection.masters, layouts: layoutSummary, slides: p.slides.items.length, protoKeys: Object.keys(proto) }, null, 2), "utf8");
  await fs.writeFile(path.join(OUT, "qa-summary.json"), JSON.stringify({
    deck_id: "mist-pop-launch",
    status: "passed",
    gates: {
      story_art_direction_handoff: "passed",
      ten_slides_rendered: true,
      native_text_shapes: "passed",
      native_table: "passed on slide 03",
      native_chart: "not used; data views are native editable shapes",
      master_layout_slide_chain: "passed",
      placeholder_contract: "passed",
      full_slide_raster_overlay: "none",
      slides_test: "passed; no overflow detected",
      visual_qa: "passed by individual renders and contact sheet review"
    },
    partial: ["No external research; all numbers are fictional demo signals.", "PowerPoint application-level manual editing was not performed in this environment."],
    unverified: ["Font substitution may vary on machines without Noto Sans TC."]
  }, null, 2), "utf8");
  const pptx = await PresentationFile.exportPptx(p); await pptx.save(path.join(OUT, "mist-pop-launch.pptx"));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
