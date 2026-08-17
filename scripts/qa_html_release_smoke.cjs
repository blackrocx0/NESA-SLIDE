const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");
const { browserExecutable, loadPlaywright } = require("./playwright_runtime.cjs");

function argsOf(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--url") out.url = argv[++index];
    else if (argv[index] === "--file") out.file = argv[++index];
    else if (argv[index] === "--report") out.report = argv[++index];
    else if (argv[index] === "--pptx-output") out.pptxOutput = argv[++index];
  }
  if (!out.url || !out.file || !out.report || !out.pptxOutput) {
    throw new Error("--url, --file, --report and --pptx-output are required");
  }
  return out;
}

function portable(value) {
  return path.relative(process.cwd(), path.resolve(value)).split(path.sep).join("/");
}

function closeEnough(actual, expected, tolerance = 1.2) {
  return Math.abs(actual - expected) <= tolerance;
}

async function main() {
  const options = argsOf(process.argv);
  const filePath = path.resolve(options.file);
  const reportPath = path.resolve(options.report);
  const pptxPath = path.resolve(options.pptxOutput);
  const originalHash = require("node:crypto").createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  try {
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.goto(options.url, { waitUntil: "commit", timeout: 30000 });
    await page.waitForFunction(() => (
      document.documentElement.dataset.layoutReady === "true" && Boolean(window.EditMode)
    ), null, { timeout: 120000 });

    const initial = await page.evaluate(() => ({
      slides: document.querySelectorAll("#stage > .slide").length,
      contentAreas: document.querySelectorAll(".content[data-content-area]").length,
      modules: document.querySelectorAll('.el[data-edit-structure="module"][data-edit-composite]').length,
      historyLimit: window.EditMode.historyLimit,
      editor: Boolean(window.EditMode),
    }));

    const target = await page.evaluate(async () => {
      const candidates = [...document.querySelectorAll('#stage > .slide .el[data-edit-structure="module"][data-edit-composite]')];
      const node = candidates[0];
      if (!node) return null;
      const slide = node.closest('.slide');
      window.setSlide(Number(slide.dataset.index));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      node.dataset.qaReleaseTarget = "true";
      const rect = node.getBoundingClientRect();
      if (rect.width <= 30 || rect.height <= 30) return null;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    if (!target) throw new Error("No semantic module available for release interaction QA");
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(100);

    const selectedGroup = await page.evaluate(() => {
      const frame = document.getElementById("edit-selection-frame");
      return Boolean(frame && frame.dataset.selectionMode === "group" && getComputedStyle(frame).display !== "none");
    });
    const beforeLeft = await page.evaluate(() => document.querySelector('[data-qa-release-target="true"]').getBoundingClientRect().left);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    const movedLeft = await page.evaluate(() => document.querySelector('[data-qa-release-target="true"]').getBoundingClientRect().left);
    await page.evaluate(() => window.EditMode.undo());
    await page.waitForTimeout(100);
    const undoLeft = await page.evaluate(() => document.querySelector('[data-qa-release-target="true"]').getBoundingClientRect().left);
    await page.evaluate(() => window.EditMode.redo());
    await page.waitForTimeout(100);
    const redoLeft = await page.evaluate(() => document.querySelector('[data-qa-release-target="true"]').getBoundingClientRect().left);

    await page.evaluate(() => window.EditMode.ungroup());
    await page.waitForTimeout(100);
    const ungrouped = await page.evaluate(() => {
      const target = document.querySelector('[data-qa-release-target="true"]');
      const members = [...document.querySelectorAll(".edit-selection-member-frame")]
        .filter((item) => getComputedStyle(item).display !== "none").length;
      return { state: target?.dataset.editGroupState || null, members };
    });
    await page.evaluate(() => window.EditMode.undo());
    await page.waitForTimeout(100);
    const groupRestored = await page.evaluate(() => {
      const target = document.querySelector('[data-qa-release-target="true"]');
      const frame = document.getElementById("edit-selection-frame");
      return target?.dataset.editGroupState !== "ungrouped" && frame?.dataset.selectionMode === "group";
    });

    const marker = `NESA-RELEASE-QA-${Date.now()}`;
    await page.evaluate(async (value) => {
      const target = document.querySelector('#stage > .slide.active [data-edit-fit="text"], #stage > .slide.active [data-edit-layer="text"]');
      if (!target) throw new Error("No editable text target found");
      target.innerHTML += ` ${value}`;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      window.__qaReleaseBlobs = [];
      window.__qaExportedHtml = "";
      window.showSaveFilePicker = async () => ({
        name: "street-revival-export-qa.html",
        createWritable: async () => ({
          write: async (payload) => {
            window.__qaExportedHtml = typeof payload === "string" ? payload : await payload.text();
          },
          close: async () => {},
        }),
      });
      const originalCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        window.__qaReleaseBlobs.push(blob);
        return originalCreate(blob);
      };
      HTMLAnchorElement.prototype.click = function qaNoopClick() {};
    }, marker);

    await page.evaluate(() => window.EditMode.export());
    await page.waitForTimeout(200);
    const exportedHtml = await page.evaluate(async () => {
      if (window.__qaExportedHtml) return window.__qaExportedHtml;
      const blob = window.__qaReleaseBlobs.at(-1);
      return blob ? await blob.text() : "";
    });
    const exportChecks = {
      bytes: Buffer.byteLength(exportedHtml),
      markerPreserved: exportedHtml.includes(marker),
      contenteditableRemoved: !/contenteditable=/i.test(exportedHtml),
      editorEmbedded: /data-edit-mode-embedded="true"/.test(exportedHtml),
    };
    exportChecks.pass = exportChecks.bytes > 10000 && exportChecks.markerPreserved
      && exportChecks.contenteditableRemoved && exportChecks.editorEmbedded;

    const exportedHtmlPath = filePath.replace(/\.html?$/i, "-exported.html");
    await fs.writeFile(exportedHtmlPath, exportedHtml, "utf8");
    const reopenedPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await reopenedPage.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await reopenedPage.route("https://fonts.gstatic.com/**", (route) => route.abort());
    const reopenedUrl = new URL(path.basename(exportedHtmlPath), options.url).href;
    await reopenedPage.goto(reopenedUrl, { waitUntil: "commit", timeout: 30000 });
    await reopenedPage.waitForFunction(() => (
      document.documentElement.dataset.layoutReady === "true" && Boolean(window.EditMode)
    ), null, { timeout: 120000 });
    const exportReopen = await reopenedPage.evaluate((value) => ({
      slides: document.querySelectorAll("#stage > .slide").length,
      markerPresent: document.body.textContent.includes(value),
      editor: Boolean(window.EditMode),
    }), marker);
    exportReopen.pass = exportReopen.slides === 10 && exportReopen.markerPresent && exportReopen.editor;
    await reopenedPage.close();

    await page.evaluate(() => { window.__qaReleaseBlobs = []; });
    await page.evaluate(async () => window.EditMode.exportPptx());
    await page.waitForFunction(() => window.__qaReleaseBlobs?.some((blob) => /presentation|powerpoint|officedocument/.test(blob.type) || blob.size > 30000), null, { timeout: 120000 });
    const pptxBlob = await page.evaluate(async () => {
      const blob = window.__qaReleaseBlobs.at(-1);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return { base64: btoa(binary), size: bytes.length, type: blob.type };
    });
    const pptxBytes = Buffer.from(pptxBlob.base64, "base64");
    await fs.mkdir(path.dirname(pptxPath), { recursive: true });
    await fs.writeFile(pptxPath, pptxBytes);
    const zip = await JSZip.loadAsync(pptxBytes);
    const names = Object.keys(zip.files);
    const pptxChecks = {
      bytes: pptxBytes.length,
      slides: names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length,
      masters: names.filter((name) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).length,
      layouts: names.filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).length,
    };
    pptxChecks.pass = pptxChecks.slides === 10 && pptxChecks.masters >= 1 && pptxChecks.layouts >= 1;

    const runtimeSaveBinding = await page.evaluate(() => {
      const button = document.querySelector('[data-save-binding-method]');
      return button ? {
        state: button.dataset.saveBindingState || null,
        method: button.dataset.saveBindingMethod || null,
        verified: button.dataset.saveBindingVerified || null,
      } : null;
    });
    await page.evaluate(async () => window.EditMode.save());
    await page.waitForTimeout(1800);
    const savedHtml = await fs.readFile(filePath, "utf8");
    const saveChecks = {
      markerPersisted: savedHtml.includes(marker),
      runtimeBinding: runtimeSaveBinding,
      dataSaveStateBound: runtimeSaveBinding?.state === "bound"
        && runtimeSaveBinding?.method === "dev-server"
        && runtimeSaveBinding?.verified === "true",
    };
    saveChecks.pass = saveChecks.markerPersisted && saveChecks.dataSaveStateBound;

    const interactionChecks = {
      selectedGroup,
      moveDelta: movedLeft - beforeLeft,
      undoRestored: closeEnough(undoLeft, beforeLeft),
      redoRestoredMove: closeEnough(redoLeft, movedLeft),
      ungroupedState: ungrouped.state,
      ungroupedMembers: ungrouped.members,
      groupRestored,
    };
    interactionChecks.pass = interactionChecks.selectedGroup
      && interactionChecks.moveDelta > 0.2
      && interactionChecks.undoRestored
      && interactionChecks.redoRestoredMove
      && interactionChecks.ungroupedState === "ungrouped"
      && interactionChecks.ungroupedMembers > 0
      && interactionChecks.groupRestored;

    const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("Failed to load resource"));
    const report = {
      schema_version: 1,
      artifact: "demos/html/street-revival/street-revival.html",
      tested_disposable_copy: portable(filePath),
      source_sha256: originalHash,
      url_mode: "localhost-writable",
      initial,
      interactions: interactionChecks,
      html_export: exportChecks,
      html_export_reopen: { ...exportReopen, tested_copy: portable(exportedHtmlPath) },
      pptx_browser_export: { ...pptxChecks, output: portable(pptxPath) },
      save_to_server: saveChecks,
      console_errors_from_intentionally_aborted_font_requests: consoleErrors,
      unexpected_console_errors: unexpectedConsoleErrors,
    };
    report.status = interactionChecks.pass && exportChecks.pass && exportReopen.pass && pptxChecks.pass && saveChecks.pass
      && unexpectedConsoleErrors.length === 0 ? "pass" : "fail";
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify({ status: report.status, interactions: interactionChecks, html_export: exportChecks, pptx: pptxChecks, save: saveChecks }));
    if (report.status !== "pass") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
