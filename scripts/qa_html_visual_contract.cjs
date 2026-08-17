const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { loadPlaywright, browserExecutable } = require("./playwright_runtime.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function portableReportPath(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative === "") return ".";
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return resolved.split(path.sep).join("/");
}

function argsOf(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--file") { out.file = value; i += 1; }
    else if (key === "--report") { out.report = value; i += 1; }
  }
  if (!out.file || !out.report) throw new Error("--file and --report are required");
  return out;
}

async function main() {
  const options = argsOf(process.argv);
  const { chromium } = loadPlaywright();
  const htmlPath = path.resolve(options.file);
  const markup = await fs.readFile(htmlPath, "utf8");
  const baseHref = pathToFileURL(`${path.dirname(htmlPath)}${path.sep}`).href;
  const markupWithBase = markup.replace(/<head>/i, `<head><base href="${baseHref}">`);
  const executablePath = browserExecutable();
  if (!process.env.BROWSER_CDP_URL && !executablePath) throw new Error("No Chrome or Edge executable found for visual contract QA");
  const browser = process.env.BROWSER_CDP_URL
    ? await chromium.connectOverCDP(process.env.BROWSER_CDP_URL)
    : await chromium.launch({ headless: true, executablePath });
  const report = {
    file: portableReportPath(htmlPath),
    fileSha256: crypto.createHash("sha256").update(markup).digest("hex"),
    slides: 0,
    issues: [],
    checks: { centerAxis: 0, centerAxisMembers: 0, timelineSpacing: 0, timelineTextFlow: 0, accentSurface: 0 },
  };
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.setContent(markupWithBase, { waitUntil: "domcontentloaded", timeout: 120000 });
    await Promise.race([
      page.evaluate(() => document.fonts?.ready),
      page.waitForTimeout(3000),
    ]);
    await page.waitForFunction(
      () => document.documentElement.dataset.layoutReady === "true",
      null,
      { timeout: 120000 },
    );
    await page.addStyleTag({ content: "#stage > .slide { display: block !important; visibility: visible !important; opacity: 1 !important; }" });
    const result = await page.evaluate(() => {
      const issues = [];
      let centerAxis = 0;
      let centerAxisMembers = 0;
      let timelineSpacing = 0;
      let timelineTextFlow = 0;
      let accentSurface = 0;
      const round = (value) => Math.round(value * 100) / 100;
      const color = (value) => {
        const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
        return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] == null ? 1 : Number(match[4])] : null;
      };
      const sameColor = (left, right) => {
        const a = color(left), b = color(right);
        return Boolean(a && b && a.slice(0, 3).every((value, index) => Math.abs(value - b[index]) <= 1));
      };
      const resolvedColor = (element, variable, property) => {
        const probe = document.createElement("span");
        const rawValue = getComputedStyle(element).getPropertyValue(variable).trim();
        probe.style.setProperty(property === "backgroundColor" ? "background-color" : property, rawValue || `var(${variable})`);
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        element.appendChild(probe);
        const value = getComputedStyle(probe)[property];
        probe.remove();
        return value;
      };
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const slides = [...document.querySelectorAll("#stage > .slide")];
      for (const slide of slides) {
        const content = slide.querySelector('.content[data-content-area="true"]');
        if (!content) continue;
        const contentRect = content.getBoundingClientRect();
        const centerAreas = [...slide.querySelectorAll('.title-flow-stack[data-layout-flow-align="center"]')].filter(visible);
        for (const centerArea of centerAreas) {
          centerAxis += 1;
          const areaRect = centerArea.getBoundingClientRect();
          const expectedCenter = areaRect.left + areaRect.width / 2;
          const members = [...centerArea.querySelectorAll(':scope > [data-edit-align-contract="center-axis"]')];
          const visibleMembers = members.filter(visible);
          const visibleChildren = [...centerArea.querySelectorAll(":scope > .el")].filter(visible);
          centerAxisMembers += visibleMembers.length;
          if (visibleMembers.length !== visibleChildren.length) {
            issues.push({
              slide: slide.dataset.pageNumber,
              contract: "center-axis",
              issue: "missing-centered-member-contract",
              members: visibleMembers.length,
              children: visibleChildren.length,
            });
          }
          if (["cover-center-title-edge-decor", "title-center"].includes(slide.dataset.layoutId)) {
            const contentCenter = contentRect.left + contentRect.width / 2;
            const containerDelta = Math.abs(expectedCenter - contentCenter);
            if (containerDelta > 3) {
              issues.push({ slide: slide.dataset.pageNumber, contract: "center-axis", issue: "center-container-drift", delta: round(containerDelta) });
            }
          }
          for (const member of visibleMembers) {
            const rect = member.getBoundingClientRect();
            const delta = Math.abs(rect.left + rect.width / 2 - expectedCenter);
            if (delta > 3) {
              issues.push({ slide: slide.dataset.pageNumber, contract: "center-axis", issue: "center-drift", element: member.className, delta: round(delta) });
            }
          }
        }
        for (const timeline of slide.querySelectorAll('.sequence-timeline')) {
          if (!visible(timeline)) continue;
          const milestones = [...timeline.querySelectorAll(':scope > .timeline-milestone')].filter(visible);
          if (milestones.length < 2) continue;
          const centers = milestones.map((milestone) => {
            const rect = milestone.getBoundingClientRect();
            return rect.left + rect.width / 2;
          });
          const expectedStep = (centers[centers.length - 1] - centers[0]) / (centers.length - 1);
          let spacingDelta = 0;
          for (let index = 1; index < centers.length; index += 1) {
            spacingDelta = Math.max(spacingDelta, Math.abs((centers[index] - centers[index - 1]) - expectedStep));
          }
          const axis = timeline.querySelector(':scope > .timeline-axis');
          const axisRect = axis && visible(axis) ? axis.getBoundingClientRect() : null;
          const axisDelta = axisRect
            ? Math.max(Math.abs(axisRect.left - centers[0]), Math.abs(axisRect.right - centers[centers.length - 1]))
            : 0;
          timelineSpacing += 1;
          if (spacingDelta > 3 || axisDelta > 3) {
            issues.push({
              slide: slide.dataset.pageNumber,
              contract: "timeline-milestones",
              issue: "uneven-milestone-distribution",
              spacingDelta: round(spacingDelta),
              axisDelta: round(axisDelta),
              milestoneCount: milestones.length,
            });
          }
          for (const milestone of milestones) {
            const textNodes = [...milestone.querySelectorAll('[data-edit-layer="text"],[data-edit-layer="metric"]')]
              .filter(visible)
              .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
            const textRects = textNodes.map((node) => node.getBoundingClientRect());
            const textOverlap = textRects.reduce((maximum, rect, index) => {
              if (index === 0) return maximum;
              return Math.max(maximum, Math.min(textRects[index - 1].bottom, rect.bottom) - Math.max(textRects[index - 1].top, rect.top));
            }, 0);
            const marker = milestone.querySelector(':scope > i');
            const markerRect = marker && visible(marker) ? marker.getBoundingClientRect() : null;
            const textTop = textRects.length ? textRects[0].top : 0;
            const textBottom = textRects.length ? textRects[textRects.length - 1].bottom : 0;
            const markerOverlap = markerRect
              ? Math.max(0, Math.min(textBottom, markerRect.bottom) - Math.max(textTop, markerRect.top))
              : 0;
            timelineTextFlow += 1;
            if (textOverlap > 1 || markerOverlap > 1) {
              issues.push({
                slide: slide.dataset.pageNumber,
                contract: "timeline-milestones",
                issue: "milestone-text-overlap",
                textOverlap: round(textOverlap),
                markerOverlap: round(markerOverlap),
              });
            }
          }
        }
        for (const root of slide.querySelectorAll('[data-visual-surface-role="accent"]')) {
          if (!visible(root)) continue;
          const bg = root.querySelector(":scope > .diagram-node-bg");
          const inkNodes = [...root.querySelectorAll("span, b, p, em")].filter(visible);
          const expectedBg = resolvedColor(root, "--accent", "backgroundColor");
          const expectedInk = resolvedColor(root, "--accent-text", "color");
          const bgStyle = bg ? getComputedStyle(bg) : null;
          accentSurface += 1;
          if (!bg || !sameColor(bgStyle.backgroundColor, expectedBg) || bgStyle.backgroundImage !== "none") {
            issues.push({ slide: slide.dataset.pageNumber, contract: "accent-surface", issue: "surface-ink-pair-background-drift", element: root.className, background: bgStyle?.background || null, expectedBackground: expectedBg });
          }
          for (const inkNode of inkNodes) {
            const actual = getComputedStyle(inkNode).color;
            if (!sameColor(actual, expectedInk)) {
              issues.push({ slide: slide.dataset.pageNumber, contract: "accent-surface", issue: "surface-ink-pair-foreground-drift", element: inkNode.className || inkNode.tagName, actual, expected: expectedInk });
            }
          }
        }
      }
      return { slides: slides.length, issues, centerAxis, centerAxisMembers, timelineSpacing, timelineTextFlow, accentSurface };
    });
    report.slides = result.slides;
    report.issues.push(...result.issues);
    report.checks.centerAxis = result.centerAxis;
    report.checks.centerAxisMembers = result.centerAxisMembers;
    report.checks.timelineSpacing = result.timelineSpacing;
    report.checks.timelineTextFlow = result.timelineTextFlow;
    report.checks.accentSurface = result.accentSurface;
    report.status = report.issues.length ? "fail" : "pass";
    await fs.mkdir(path.dirname(path.resolve(options.report)), { recursive: true });
    await fs.writeFile(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === "pass" ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
