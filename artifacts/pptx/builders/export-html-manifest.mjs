import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const HTML_WIDTH = 1920;
const HTML_HEIGHT = 1080;
const PPTX_WIDTH = 1280;
const PPTX_HEIGHT = 720;
const GEOMETRY_SCALE = PPTX_WIDTH / HTML_WIDTH;

function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--input") {
      options.input = value;
      index += 1;
    } else if (key === "--output") {
      options.output = value;
      index += 1;
    } else if (key === "--qa") {
      options.qa = value;
      index += 1;
    }
  }
  if (!options.input || !options.output) {
    throw new Error("--input and --output are required");
  }
  return options;
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scaledPosition(position = {}) {
  const left = clamp(finite(position.left) * GEOMETRY_SCALE, -PPTX_WIDTH, PPTX_WIDTH * 2);
  const top = clamp(finite(position.top) * GEOMETRY_SCALE, -PPTX_HEIGHT, PPTX_HEIGHT * 2);
  const width = clamp(finite(position.width) * GEOMETRY_SCALE, 0.5, PPTX_WIDTH * 2);
  const height = clamp(finite(position.height) * GEOMETRY_SCALE, 0.5, PPTX_HEIGHT * 2);
  const rotation = finite(position.rotation);
  return {
    left,
    top,
    width,
    height,
    ...(Math.abs(rotation) > 0.01 ? { rotation } : {}),
  };
}

function safeName(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function normalizedColor(value, fallback = "#00000000") {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) return text.toUpperCase();
  return fallback;
}

function visibleColor(value) {
  const color = normalizedColor(value);
  return color.length === 9 ? color.slice(7, 9) !== "00" : true;
}

function lineConfig(element) {
  const width = finite(element.lineWidth);
  const fill = normalizedColor(element.lineColor);
  if (width <= 0 || !visibleColor(fill)) {
    return { style: "solid", fill: "none", width: 0 };
  }
  return {
    style: "solid",
    fill,
    width: Math.max(0.5, width * GEOMETRY_SCALE),
  };
}

function fillConfig(element) {
  const fill = normalizedColor(element.fill);
  return visibleColor(fill) ? fill : "none";
}

function geometryFor(element) {
  if (element.shape === "ellipse") return "ellipse";
  const radius = finite(element.borderRadius);
  return radius >= 3 ? "roundRect" : "rect";
}

function textAlignment(value) {
  return ["left", "center", "right", "justify"].includes(value) ? value : "left";
}

function verticalAlignment(value) {
  if (value === "center") return "middle";
  return ["top", "middle", "bottom"].includes(value) ? value : "top";
}

function typeface(value) {
  const first = String(value || "Noto Sans TC").split(",")[0].trim();
  return first.replace(/^["']|["']$/g, "") || "Noto Sans TC";
}

function addTextElement(slide, element, name) {
  const text = String(element.text || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return false;
  const position = scaledPosition(element.position);
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: fillConfig(element),
    line: lineConfig(element),
    ...(finite(element.borderRadius) >= 3
      ? { borderRadius: Math.max(1, finite(element.borderRadius) * GEOMETRY_SCALE) }
      : {}),
    ...(element.hasShadow ? { shadow: "shadow-sm" } : {}),
  });
  shape.text = text;
  shape.text.style = {
    fontSize: clamp(finite(element.fontSizePt, 18), 1, 240),
    color: normalizedColor(element.color, "#111111"),
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
    typeface: typeface(element.fontFamily),
    alignment: textAlignment(element.textAlign),
    verticalAlignment: verticalAlignment(element.verticalAlign),
    autoFit: "shrinkText",
    wrap: "square",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return true;
}

function addImageElement(slide, element, name, warnings) {
  if (!element.dataUrl || !String(element.dataUrl).startsWith("data:image/")) {
    warnings.push({ element: name, issue: "image-source-unavailable" });
    return false;
  }
  const image = slide.images.add({
    dataUrl: element.dataUrl,
    alt: element.alt || name,
    fit: element.fit === "contain" ? "contain" : "cover",
    position: scaledPosition(element.position),
    geometry: element.shape === "ellipse" ? "ellipse" : "rect",
  });
  if (finite(element.borderRadius) >= 3 && element.shape !== "ellipse") {
    image.geometry = "roundRect";
    image.borderRadius = Math.max(1, finite(element.borderRadius) * GEOMETRY_SCALE);
  }
  return true;
}

function addShapeElement(slide, element, name) {
  const fill = fillConfig(element);
  const line = lineConfig(element);
  if (fill === "none" && (!line.width || line.fill === "none")) return false;
  const geometry = geometryFor(element);
  slide.shapes.add({
    geometry,
    name,
    position: scaledPosition(element.position),
    fill,
    line,
    ...(geometry !== "ellipse" && finite(element.borderRadius) >= 3
      ? { borderRadius: Math.max(1, finite(element.borderRadius) * GEOMETRY_SCALE) }
      : {}),
    ...(element.hasShadow ? { shadow: "shadow-sm" } : {}),
  });
  return true;
}

function placeholderType(role) {
  if (role === "title") return "title";
  if (role === "subtitle") return "subtitle";
  return "body";
}

function semanticRole(element) {
  const text = `${element.role || ""} ${element.name || ""}`.toLowerCase();
  if (text.includes("subtitle") || text.includes("sub-title")) return "subtitle";
  if (text.includes("title") || text.includes("headline")) return "title";
  return "body";
}

function makeLayouts(deck, slides) {
  const layouts = new Map();
  for (const [slideIndex, slideSpec] of slides.entries()) {
    const id = safeName(slideSpec.layoutId, `slide-${slideIndex + 1}`);
    if (!layouts.has(id)) layouts.set(id, { id, sample: slideSpec });
  }

  const master = deck.masters.add(`HTML Export · ${safeName(slides[0]?.themeId, "theme")}`);
  const layoutMap = new Map();
  for (const entry of layouts.values()) {
    const layout = deck.layouts.add(`HTML · ${entry.id}`);
    layout.setParentLayoutId(master.id);
    const textElements = (entry.sample.elements || []).filter((element) => String(element.text || "").trim());
    const used = new Map();
    for (const element of textElements.slice(0, 8)) {
      const role = semanticRole(element);
      const index = used.get(role) || 0;
      used.set(role, index + 1);
      const placeholder = layout.placeholders.add({
        type: placeholderType(role),
        index,
        geometry: "textbox",
        position: scaledPosition(element.position),
        text: "",
        fill: "none",
        line: { style: "solid", fill: "none", width: 0 },
      });
      placeholder.name = `html-${role}-${index + 1}`;
    }
    layoutMap.set(entry.id, layout);
  }
  return { master, layoutMap };
}

async function buildPresentation(manifest) {
  if (!manifest || !Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    throw new Error("manifest.slides must contain at least one slide");
  }
  if (manifest.slides.length > 200) {
    throw new Error("manifest contains more than 200 slides");
  }

  const deck = Presentation.create({ slideSize: { width: PPTX_WIDTH, height: PPTX_HEIGHT } });
  const { master, layoutMap } = makeLayouts(deck, manifest.slides);
  const warnings = [];
  const qaSlides = [];

  for (const [slideIndex, slideSpec] of manifest.slides.entries()) {
    const layoutId = safeName(slideSpec.layoutId, `slide-${slideIndex + 1}`);
    const slide = deck.slides.add();
    slide.setLayout(layoutMap.get(layoutId));
    slide.background.fill = normalizedColor(slideSpec.backgroundColor, "#FFFFFF");

    let nativeObjects = 0;
    let rasterObjects = 0;
    const elements = Array.isArray(slideSpec.elements) ? slideSpec.elements : [];
    for (const [elementIndex, element] of elements.entries()) {
      const name = safeName(element.name, `slide-${slideIndex + 1}-element-${elementIndex + 1}`);
      let added = false;
      if (element.kind === "image") {
        added = addImageElement(slide, element, name, warnings);
        if (added) rasterObjects += 1;
      } else if (String(element.text || "").trim()) {
        added = addTextElement(slide, element, name);
        if (added) nativeObjects += 1;
      } else {
        added = addShapeElement(slide, element, name);
        if (added) nativeObjects += 1;
      }
    }
    qaSlides.push({
      slide: slideIndex + 1,
      layoutId,
      fidelity: rasterObjects > 0 ? "hybrid" : "native",
      nativeObjects,
      rasterObjects,
    });
  }

  return {
    deck,
    qa: {
      status: "generated",
      title: manifest.title || "HTML presentation",
      themeId: manifest.themeId || "html-edited",
      slideCount: manifest.slides.length,
      master: master.name,
      layouts: layoutMap.size,
      source: "edited HTML DOM manifest",
      slides: qaSlides,
      warnings,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const manifest = JSON.parse(await fs.readFile(path.resolve(options.input), "utf8"));
  const { deck, qa } = await buildPresentation(manifest);
  await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(path.resolve(options.output));
  if (options.qa) {
    await fs.mkdir(path.dirname(path.resolve(options.qa)), { recursive: true });
    await fs.writeFile(path.resolve(options.qa), JSON.stringify(qa, null, 2), "utf8");
  }
  process.stdout.write(`${JSON.stringify(qa)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exitCode = 1;
});
