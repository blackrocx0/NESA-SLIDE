import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

function argsOf(argv) {
  const out = { themes: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--theme") { out.themes.push(value); i += 1; }
    else if (key === "--matrix") { out.matrix = value; i += 1; }
    else if (key === "--output-dir") { out.outputDir = value; i += 1; }
    else if (key === "--preview-dir") { out.previewDir = value; i += 1; }
    else if (key === "--inspect-dir") { out.inspectDir = value; i += 1; }
    else if (key === "--limit-layouts") { out.limitLayouts = Number(value); i += 1; }
  }
  if (!out.matrix || !out.outputDir) throw new Error("--matrix and --output-dir are required");
  return out;
}

function sampleText(role) {
  if (role === "decoration") return "";
  if (role === "title") return "清楚的重點標題";
  if (role === "subtitle") return "用一句話補充背景與用途";
  if (role === "picture") return "圖片內容區";
  if (role === "chart") return "數據視覺區";
  if (role === "table") return "比較資訊區";
  return "重點內容";
}

function fontSize(role, height) {
  if (role === "title") return Math.max(28, Math.min(48, Math.floor(height * 0.42)));
  if (role === "subtitle") return Math.max(18, Math.min(28, Math.floor(height * 0.34)));
  return Math.max(16, Math.min(24, Math.floor(height * 0.22)));
}

function placeholderType(role) {
  if (role === "decoration") return "content";
  return ["title", "subtitle", "body", "picture", "chart", "table"].includes(role) ? role : "body";
}

function addVisibleSlot(slide, theme, slot, slotIndex) {
  const [x, y, w, h] = slot.region;
  const position = { left: x * 12.8, top: y * 7.2, width: w * 12.8, height: h * 7.2 };
  const role = slot.semantic_role;
  const shape = slide.shapes.add({
    geometry: "roundRect",
    name: `slot-${slotIndex}-${slot.id}`,
    position,
    fill: role === "title" || role === "subtitle" ? "none" : role === "decoration" ? theme.colors.accent : theme.colors.surface,
    line: { style: "solid", fill: role === "title" || role === "subtitle" || role === "decoration" ? "none" : theme.colors.accent, width: 1 },
  });
  shape.text = sampleText(role);
  shape.text.style = {
    fontSize: fontSize(role, position.height),
    color: role === "subtitle" ? theme.colors.secondary : theme.colors.primary,
    bold: role === "title",
    alignment: role === "title" ? "left" : "center",
    typeface: theme.typography?.heading?.family || theme.typography?.body?.family || "Noto Sans TC",
  };
  return shape;
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function buildTheme(theme, layouts, options) {
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const master = deck.masters.add(`theme--${theme.id}`);
  const slides = [];

  for (const [layoutIndex, spec] of layouts.entries()) {
    const layout = deck.layouts.add(`layout--${spec.id}`);
    layout.setParentLayoutId(master.id);
    for (const [slotIndex, slot] of spec.slots.entries()) {
      const [x, y, w, h] = slot.region;
      const position = { left: x * 12.8, top: y * 7.2, width: w * 12.8, height: h * 7.2 };
      const role = slot.semantic_role;
      const ph = layout.placeholders.add({
        type: placeholderType(role),
        index: slotIndex,
        geometry: "roundRect",
        position,
        text: sampleText(role),
        fill: role === "title" || role === "subtitle" ? "none" : role === "decoration" ? theme.colors.accent : theme.colors.surface,
        line: { style: "solid", fill: role === "title" || role === "subtitle" || role === "decoration" ? "none" : theme.colors.accent, width: 1 },
      });
      ph.name = slot.id;
      ph.text.style = {
        fontSize: fontSize(role, position.height),
        color: role === "subtitle" ? theme.colors.secondary : theme.colors.primary,
        bold: role === "title",
        alignment: role === "title" ? "left" : "center",
        typeface: theme.typography?.heading?.family || theme.typography?.body?.family || "Noto Sans TC",
      };
    }
    const slide = deck.slides.add();
    slide.setLayout(layout);
    slide.background.fill = theme.colors.background;
    for (const [slotIndex, slot] of spec.slots.entries()) addVisibleSlot(slide, theme, slot, slotIndex);
    const footer = slide.shapes.add({
      geometry: "textbox",
      name: `footer-${layoutIndex + 1}`,
      position: { left: 24, top: 690, width: 1232, height: 18 },
      fill: "none",
      line: { style: "solid", fill: "none", width: 0 },
    });
    footer.text = `${String(layoutIndex + 1).padStart(2, "0")} / ${String(layouts.length).padStart(2, "0")}   ${spec.id}   ·   ${theme.id}`;
    footer.text.style = { fontSize: 11, color: theme.colors.secondary, typeface: "Noto Sans TC", alignment: "right" };
    slides.push(slide);
  }

  await fs.mkdir(options.outputDir, { recursive: true });
  const outPath = path.join(options.outputDir, `${theme.id}.pptx`);
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(outPath);

  if (options.inspectDir) {
    await fs.mkdir(options.inspectDir, { recursive: true });
    const inspection = await deck.inspect({ kind: "slide,layout", maxChars: 2000000 });
    await fs.writeFile(path.join(options.inspectDir, `${theme.id}.ndjson`), inspection.ndjson, "utf8");
  }
  if (options.previewDir) {
    const themePreviewDir = path.join(options.previewDir, theme.id);
    await fs.mkdir(themePreviewDir, { recursive: true });
    for (const [index, slide] of slides.entries()) {
      await writeBlob(path.join(themePreviewDir, `slide-${String(index + 1).padStart(3, "0")}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    }
  }
  return { theme: theme.id, slides: slides.length, output: outPath };
}

async function main() {
  const options = argsOf(process.argv);
  const matrix = JSON.parse(await fs.readFile(options.matrix, "utf8"));
  const selected = new Set(options.themes);
  const themes = matrix.themes.filter((theme) => selected.size === 0 || selected.has(theme.id));
  const layouts = matrix.layouts.slice(0, options.limitLayouts || matrix.layouts.length);
  const results = [];
  for (const theme of themes) {
    results.push(await buildTheme(theme, layouts, options));
    console.log(JSON.stringify(results.at(-1)));
  }
  console.log(JSON.stringify({ themes: themes.length, layoutsPerTheme: layouts.length, slides: themes.length * layouts.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
