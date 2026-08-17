const fs = require("node:fs/promises");
const path = require("node:path");
const { browserExecutable, loadPlaywright } = require("./playwright_runtime.cjs");

function argsOf(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--url") out.url = argv[++index];
    else if (argv[index] === "--output-dir") out.outputDir = argv[++index];
    else if (argv[index] === "--report") out.report = argv[++index];
  }
  if (!out.url || !out.outputDir || !out.report) throw new Error("--url, --output-dir and --report are required");
  return out;
}

function portable(value) {
  return path.relative(process.cwd(), path.resolve(value)).split(path.sep).join("/");
}

async function main() {
  const options = argsOf(process.argv);
  const outputDir = path.resolve(options.outputDir);
  const reportPath = path.resolve(options.report);
  await fs.mkdir(outputDir, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.goto(options.url, { waitUntil: "commit", timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.layoutReady === "true" && Boolean(window.EditMode), null, { timeout: 120000 });
    await page.evaluate(() => window.EditMode.toggle(false));
    await page.evaluate(() => window.MotionPreview?.setEnabled(false, false));
    await page.waitForTimeout(150);
    const stageSelector = "#player > #canvasBox > #stage";
    const count = await page.locator(`${stageSelector} > .slide`).count();
    const captures = [];
    for (let index = 0; index < count; index += 1) {
      await page.evaluate((value) => window.setSlide(value), index);
      await page.waitForTimeout(1700);
      const output = path.join(outputDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
      await page.locator(stageSelector).screenshot({ path: output });
      const state = await page.evaluate(() => {
        const active = document.querySelector("#player > #canvasBox > #stage > .slide.active");
        const title = active?.querySelector(".prod-title,.cover-center-title,.statement-focus-quote,.statement-center-headline");
        const style = title ? getComputedStyle(title) : null;
        return {
          index: Number(active?.dataset.index),
          editorChrome: document.documentElement.classList.contains("edit-shell-active"),
          projectionToolbarVisible: getComputedStyle(document.getElementById("bar")).opacity !== "0",
          activeRevealLayers: document.querySelectorAll("#player > #canvasBox > #stage [data-object-reveal-layer]").length,
          activeRevealClones: document.querySelectorAll("#player > #canvasBox > #stage [data-object-reveal-slide]").length,
          titleDiagnostics: title ? {
            text: title.textContent.trim(),
            matchingTextNodes: [...active.querySelectorAll("*")].filter((node) => node.textContent.trim() === title.textContent.trim()).length,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            textShadow: style.textShadow,
            webkitTextStroke: style.webkitTextStroke,
            transform: style.transform,
          } : null,
        };
      });
      captures.push({ file: portable(output), ...state });
    }
    const report = {
      schema_version: 1,
      artifact: "demos/html/street-revival/street-revival.html",
      url_mode: "localhost",
      slides: count,
      captures,
      page_errors: errors,
      status: count === 10 && errors.length === 0
        && captures.every((row, index) => row.index === index && !row.editorChrome && !row.projectionToolbarVisible)
        ? "pass" : "fail",
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify({ status: report.status, slides: count, errors }));
    if (report.status !== "pass") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
