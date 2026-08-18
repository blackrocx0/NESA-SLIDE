import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";


function argsOf(argv) {
  const out = { roles: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--runtime-manifest") { out.manifest = value; i += 1; }
    else if (key === "--output") { out.output = value; i += 1; }
    else if (key === "--preview-dir") { out.previewDir = value; i += 1; }
    else if (key === "--inspect-output") { out.inspectOutput = value; i += 1; }
    else if (key === "--role") { out.roles.push(value); i += 1; }
  }
  if (!out.manifest || !out.output) throw new Error("--runtime-manifest and --output are required");
  return out;
}


function absoluteFromManifest(manifestPath, value) {
  if (path.isAbsolute(value)) return value;
  const projectRoot = path.resolve(path.dirname(manifestPath), "..", "..", "..");
  return path.resolve(projectRoot, value);
}


function position(region, canvas) {
  const [x, y, w, h] = region;
  return {
    left: x * canvas.width_px / 100,
    top: y * canvas.height_px / 100,
    width: w * canvas.width_px / 100,
    height: h * canvas.height_px / 100,
  };
}


function sampleText(roleId, placeholder) {
  const samples = {
    cover: { title: "可編輯的主標題", subtitle: "底圖鎖定品牌視覺，文字仍是 PowerPoint 原生物件", meta: "SLIDE FIRM · MASTER DEMO" },
    toc: { title: "本次內容", intro: "母片先定義底圖與留白，Placeholder 再承接真正的資訊結構。", "toc-content": "01  封面\n02  目錄\n03  內文\n04  QA" },
    "content-a": { title: "左側內容版", subtitle: "右側視覺由 Image2 底圖負責", body: "這裡可以放段落、重點清單或原生圖表。\n\n所有文字都能在 PowerPoint 中直接修改。" },
    "content-b": { title: "右側內容版", subtitle: "左側視覺由 Image2 底圖負責", body: "同一個 Theme 保持品牌質感；Placeholder 保持後續編輯彈性。" },
    "content-c": { title: "中央內容版", subtitle: "適合流程、比較、圖表與長段落", body: "中央保留大面積低細節區域，內容結構完全由母片 Placeholder 決定。" },
    qa: { title: "QA 驗收頁", subtitle: "四個 Placeholder 可改成 KPI、檢核項或比較結果", "metric-1": "01\n結構", "metric-2": "02\n視覺", "metric-3": "03\n編輯", "metric-4": "04\n交付" },
  };
  return samples[roleId]?.[placeholder.name] || `〔${placeholder.name}〕`;
}


function colorFor(style, manifest) {
  return manifest.colors[style.color_role] || manifest.colors.primary_text;
}


async function addBackground(layout, manifestPath, role, canvas) {
  const assetPath = absoluteFromManifest(manifestPath, role.asset);
  const bytes = await fs.readFile(assetPath);
  const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  const image = layout.images.add({ dataUrl, fit: "fill", alt: `${role.label} Image2 background`, name: `background-${role.id}` });
  image.position = { left: 0, top: 0, width: canvas.width_px, height: canvas.height_px };
}


async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}


async function main() {
  const options = argsOf(process.argv);
  const manifestPath = path.resolve(options.manifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const canvas = manifest.canvas;
  const deck = Presentation.create({ slideSize: { width: canvas.width_px, height: canvas.height_px } });
  const master = deck.masters.add(manifest.master_name);
  const slides = [];

  const selectedRoles = options.roles.length ? manifest.roles.filter((role) => options.roles.includes(role.id)) : manifest.roles;
  if (options.roles.length && selectedRoles.length !== options.roles.length) throw new Error("Unknown --role value");
  for (const role of selectedRoles) {
    const layout = deck.layouts.add(`layout--${role.id}`);
    layout.setParentLayoutId(master.id);
    await addBackground(layout, manifestPath, role, canvas);
    for (const placeholder of role.placeholders) {
      const style = manifest.placeholder_styles[placeholder.style];
      const item = layout.placeholders.add({
        type: placeholder.type,
        index: placeholder.index,
        geometry: "textbox",
        position: position(placeholder.region, canvas),
        text: `〔${placeholder.name}〕`,
        fill: "none",
        line: { style: "solid", fill: "none", width: 0 },
      });
      item.text.style = {
        fontSize: style.font_size,
        bold: style.bold,
        color: colorFor(style, manifest),
        alignment: style.alignment,
        typeface: manifest.fonts[style.font_role],
      };
    }
    const slide = deck.slides.add();
    slide.setLayout(layout);
    for (const placeholder of role.placeholders) {
      const target = slide.placeholders.getAll(placeholder.type).find((item) => item.placeholder.index === placeholder.index);
      if (!target) throw new Error(`Placeholder ${role.id}.${placeholder.type}[${placeholder.index}] not found on slide.`);
      target.text = sampleText(role.id, placeholder);
    }
    slides.push(slide);
  }

  const output = path.resolve(options.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const file = await PresentationFile.exportPptx(deck);
  await file.save(output);

  if (options.previewDir) {
    const previewDir = path.resolve(options.previewDir);
    await fs.mkdir(previewDir, { recursive: true });
    for (const [index, slide] of slides.entries()) {
      await writeBlob(path.join(previewDir, `slide-${index + 1}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    }
  }
  if (options.inspectOutput) {
    const inspect = await deck.inspect({ kind: "slide,layout,textbox,image", maxChars: 200000 });
    const inspectPath = path.resolve(options.inspectOutput);
    await fs.mkdir(path.dirname(inspectPath), { recursive: true });
    await fs.writeFile(inspectPath, inspect.ndjson, "utf8");
  }
  console.log(JSON.stringify({ theme: manifest.theme_id, master: manifest.master_name, layouts: selectedRoles.length, slides: slides.length, output }));
}


main().catch((error) => { console.error(error); process.exitCode = 1; });
