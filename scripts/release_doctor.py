#!/usr/bin/env python3
"""Validate the self-contained NESA Slide 0.1.0-demo.2 package."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0-demo.2"
EXPECTED_THEMES = 36
EXPECTED_LAYOUTS = 74
EXPECTED_THEME_ADAPTERS = 108
EXPECTED_LAYOUT_ADAPTERS = 222
EXPECTED_ADAPTERS = 330
SKILLS = ["design-presentations", "generate-image-slide", "html-image-slide", "html-pattern-slide", "ppt-builder", "slide-background-image", "slide-outline-planner"]
RETIRED = {"toc-2.yaml", "toc-2-image-left.yaml", "toc-2-panel-rows.yaml", "toc-2-vertical.yaml"}
REMOVED_COVERS = {"cover-lower-right-hero-left-rail.yaml", "cover-mid-right-column-meta-upper-left.yaml", "cover-top-center-hero-bottom-center-support.yaml", "cover-upper-right-hero-lower-left-support.yaml"}
FORBIDDEN = {".git", ".cache", ".pytest_cache", "__pycache__", "node_modules", "experiments", "tests", "research", "review", "reviews", "tmp", ".history", "history", "To_delete", "migrations", "deploy", "staging", "runtime"}
TEXT_SUFFIXES = {".cmd", ".html", ".js", ".json", ".md", ".mjs", ".cjs", ".ps1", ".py", ".txt", ".yaml", ".yml"}
ABSOLUTE = (re.compile(r"[A-Za-z]:[\\/]Users[\\/]", re.I), re.compile(r"file:///[A-Za-z]:/Users/", re.I))
EXPECTED_HTML_LAYOUTS = ["cover-center-title-edge-decor", "toc-6-panel-rows", "strategic-priorities", "before-after", "heat-map", "timeline-vertical", "matrix-4quadrant", "multi-line-chart", "quote-focus", "title-center"]


class SlideCounter(HTMLParser):
    def __init__(self):
        super().__init__(); self.slides = 0
    def handle_starttag(self, tag, attrs):
        if "slide" in (dict(attrs).get("class") or "").split(): self.slides += 1


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""): digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.is_file() else {}


def pptx_structure(path: Path) -> dict[str, int]:
    if not path.is_file(): return {}
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        slides = [n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        masters = [n for n in names if re.fullmatch(r"ppt/slideMasters/slideMaster\d+\.xml", n)]
        layouts = [n for n in names if re.fullmatch(r"ppt/slideLayouts/slideLayout\d+\.xml", n)]
        text_nodes = sum(archive.read(n).count(b"<a:t") for n in slides)
        pictures = sum(archive.read(n).count(b"<p:pic") for n in slides)
    return {"slides": len(slides), "masters": len(masters), "layouts": len(layouts), "text_nodes": text_nodes, "slide_pictures": pictures}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    checks = []
    def add(name, ok, detail, warn=False): checks.append({"check": name, "status": "PASS" if ok else ("WARN" if warn else "FAIL"), "detail": detail})

    required = [ROOT / "AGENTS.md", ROOT / "README.md", ROOT / "source-snapshot.json", ROOT / "source-snapshot-verification.json", ROOT / "prompt_system/renderers/manifest.yaml", ROOT / "artifacts/renderer-matrix/matrix.json", ROOT / "src/html-editor/edit-mode.js", ROOT / "artifacts/html-test/edit-mode.js", ROOT / "scripts/qa_html_text_orientation.py", ROOT / "scripts/python_chart_renderer.py", ROOT / "scripts/html_visible_copy.py"]
    add("required-files", all(p.is_file() for p in required), [p.relative_to(ROOT).as_posix() for p in required if not p.is_file()])
    snapshot = read_json(ROOT / "source-snapshot.json")
    freeze = read_json(ROOT / "source-snapshot-verification.json")
    freeze_checks = freeze.get("checks", {})
    freeze_ok = (
        freeze.get("status") == "passed"
        and freeze_checks.get("allowlisted_files_checked") == snapshot.get("source_file_count")
        and freeze_checks.get("source_hash_or_mtime_drift") == 0
        and freeze_checks.get("unexpected_package_mismatches") == 0
    )
    add("source-freeze", freeze_ok, {"source_file_count": snapshot.get("source_file_count"), "aggregate": snapshot.get("source_aggregate_sha256"), "verification": freeze.get("checks")})

    themes = sorted((ROOT / "prompt_system/themes").glob("*.yaml"))
    layouts = sorted((ROOT / "prompt_system/layouts").glob("*.yaml"))
    retired_present = sorted(p.name for p in layouts if p.name in RETIRED)
    removed_present = sorted(p.name for p in layouts if p.name in REMOVED_COVERS)
    add("core-counts", len(themes) == EXPECTED_THEMES and len(layouts) == EXPECTED_LAYOUTS and not retired_present and not removed_present, {"themes": len(themes), "active_layouts": len(layouts), "retired_present": retired_present, "removed_cover_present": removed_present})
    adapter_root = ROOT / "prompt_system/renderers"
    theme_adapters = sum(len(list((adapter_root / r / "themes").glob("*.yaml"))) for r in ("image2", "html", "pptx"))
    layout_adapters = sum(len(list((adapter_root / r / "layouts").glob("*.yaml"))) for r in ("image2", "html", "pptx"))
    add("adapter-counts", theme_adapters == EXPECTED_THEME_ADAPTERS and layout_adapters == EXPECTED_LAYOUT_ADAPTERS, {"theme_adapters": theme_adapters, "layout_adapters": layout_adapters, "total": theme_adapters + layout_adapters})

    actual_skills = sorted(p.name for p in (ROOT / ".agents/skills").iterdir() if p.is_dir())
    skill_issues = []
    for name in SKILLS:
        skill = ROOT / ".agents/skills" / name / "SKILL.md"
        openai = ROOT / ".agents/skills" / name / "agents/openai.yaml"
        text = skill.read_text(encoding="utf-8") if skill.is_file() else ""
        match = re.search(r"(?m)^name:\s*([^\r\n]+)", text)
        if not match or match.group(1).strip() != name or not openai.is_file(): skill_issues.append(name)
    add("project-skills", actual_skills == sorted(SKILLS) and not skill_issues, {"actual": actual_skills, "issues": skill_issues})

    forbidden = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if any(part in FORBIDDEN for part in p.relative_to(ROOT).parts)]
    add("forbidden-directories", not forbidden, forbidden[:30])
    credentials = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file() and (p.name.lower() == ".env" or p.suffix.lower() in {".key", ".pem", ".pfx"})]
    add("credential-files", not credentials, credentials)
    disposable = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file() and p.suffix.lower() in {".pyc", ".log"}]
    add("runtime-logs-and-caches", not disposable, disposable[:30])
    absolute_hits = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES or path.resolve() == Path(__file__).resolve(): continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if any(pattern.search(text) for pattern in ABSOLUTE): absolute_hits.append(path.relative_to(ROOT).as_posix())
    add("portable-text-paths", not absolute_hits, absolute_hits)

    sys.path.insert(0, str(ROOT / "scripts"))
    import qa_html_text_orientation as orientation
    ledger = ROOT / "release-files.sha256"
    if ledger.is_file(): candidates = orientation.ledger_paths(ledger, root=ROOT)
    else: candidates = [p for p in ROOT.rglob("*") if p.is_file() and p.suffix.lower() in orientation.TEXT_EXTENSIONS]
    demo_html = ROOT / "demos/html/street-revival/street-revival.html"
    if demo_html.is_file(): candidates.append(demo_html)
    unique = sorted({p.resolve() for p in candidates if p.exists()}, key=lambda p: p.as_posix())
    orientation_issues = [issue for p in unique for issue in orientation.scan_path(p, root=ROOT)]
    add("text-orientation", not orientation_issues, {"checked_files": len(unique), "issues": orientation_issues[:20]})

    image_root = ROOT / "demos/image/tide-house"
    image_pngs = sorted((image_root / "slides").glob("*.png"))
    image_pptx = pptx_structure(image_root / "tide-house-image-deck.pptx")
    image_qa = read_json(image_root / "qa-summary.json")
    add("image-demo", len(image_pngs) == 10 and image_pptx.get("slides") == 10 and image_qa.get("status") == "passed-with-scope", {"pngs": len(image_pngs), "structure": image_pptx, "qa": image_qa.get("status")})
    pptx_root = ROOT / "demos/pptx/mist-pop-launch"
    pptx_data = pptx_structure(pptx_root / "mist-pop-launch.pptx")
    pptx_qa = read_json(pptx_root / "qa-summary.json")
    add("pptx-demo", pptx_data.get("slides") == 10 and pptx_data.get("masters", 0) >= 1 and pptx_data.get("layouts", 0) >= 1 and pptx_data.get("text_nodes", 0) > 0 and pptx_qa.get("status") == "passed", {"structure": pptx_data, "qa": pptx_qa.get("status")})
    counter = SlideCounter()
    if demo_html.is_file(): counter.feed(demo_html.read_text(encoding="utf-8"))
    html_manifest = read_json(ROOT / "demos/html/street-revival/street-revival.manifest.json")
    html_qa = read_json(ROOT / "demos/html/street-revival/qa/qa-summary.json")
    layouts_used = html_manifest.get("layouts") or html_manifest.get("layout_diversity", {}).get("selected_layouts") or []
    html_ok = counter.slides == 10 and layouts_used == EXPECTED_HTML_LAYOUTS and html_manifest.get("content_mode") == "new-deck" and html_qa.get("status") == "passed" and (ROOT / "demos/html/street-revival/contact-sheet.png").is_file()
    add("html-demo", html_ok, {"slides": counter.slides, "layouts": layouts_used, "content_mode": html_manifest.get("content_mode"), "qa": html_qa.get("status")})
    add("editor-sync", sha256(ROOT / "src/html-editor/edit-mode.js") == sha256(ROOT / "artifacts/html-test/edit-mode.js") == sha256(ROOT / "demos/html/street-revival/edit-mode.js"), {"sha256": sha256(ROOT / "src/html-editor/edit-mode.js")})

    manifest = read_json(ROOT / "release-manifest.json")
    manifest_ok = manifest.get("version") == VERSION and manifest.get("release_status") == "internal-test-passed"
    add("release-manifest", manifest_ok, {"version": manifest.get("version"), "status": manifest.get("release_status")}, warn=args.preflight and not manifest)
    if ledger.is_file():
        mismatches = []; entries = 0
        for raw in ledger.read_text(encoding="utf-8").splitlines():
            if not raw.strip(): continue
            expected, relative = raw.split("  ", 1); target = ROOT / relative; entries += 1
            if not target.is_file() or sha256(target) != expected: mismatches.append(relative)
        add("release-hashes", not mismatches and entries > 0, {"entries": entries, "mismatches": mismatches[:30]})
    else: add("release-hashes", False, "release-files.sha256 is missing", warn=args.preflight)

    status = "FAIL" if any(row["status"] == "FAIL" for row in checks) else ("WARN" if any(row["status"] == "WARN" for row in checks) else "PASS")
    report = {"schema_version": 2, "package": f"NESA Slide {VERSION}", "status": status, "checks": checks}
    for row in checks: print(f"[{row['status']}] {row['check']}: {json.dumps(row['detail'], ensure_ascii=False)}")
    print(f"\nNESA Slide system check: {status}")
    if args.report:
        output = args.report if args.report.is_absolute() else ROOT / args.report
        output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if status == "FAIL" else 0


if __name__ == "__main__": raise SystemExit(main())
