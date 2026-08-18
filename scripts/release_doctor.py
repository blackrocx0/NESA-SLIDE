#!/usr/bin/env python3
"""Validate the portable NESA Slide internal-test package."""

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
RETIRED_LAYOUTS = {
    "toc-2.yaml",
    "toc-2-image-left.yaml",
    "toc-2-panel-rows.yaml",
    "toc-2-vertical.yaml",
}
FORBIDDEN_PARTS = {
    ".git",
    ".cache",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "experiments",
    "tests",
    "research",
    "review",
    "reviews",
    "tmp",
    ".history",
    "To_delete",
    "migrations",
    "deploy",
}
TEXT_SUFFIXES = {
    ".cmd", ".html", ".js", ".json", ".md", ".mjs", ".ps1",
    ".py", ".txt", ".yaml", ".yml",
}
ABSOLUTE_PATH_PATTERNS = (
    re.compile(r"C:[\\/]Users[\\/]NEO(?:[\\/]|$)", re.IGNORECASE),
    re.compile(r"C:[\\/]Users[\\/]NEO[\\/]OneDrive", re.IGNORECASE),
    re.compile(r"file:///C:/Users/NEO/", re.IGNORECASE),
)


class SlideCounter(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.slides = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = dict(attrs).get("class") or ""
        if "slide" in classes.split():
            self.slides += 1


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as stream:
        header = stream.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", header[16:24])


def pptx_structure(path: Path) -> dict[str, int]:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        slide_xml = [name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]
        masters = [name for name in names if re.fullmatch(r"ppt/slideMasters/slideMaster\d+\.xml", name)]
        layouts = [name for name in names if re.fullmatch(r"ppt/slideLayouts/slideLayout\d+\.xml", name)]
        text_nodes = sum(archive.read(name).count(b"<a:t") for name in slide_xml)
        pictures = sum(archive.read(name).count(b"<p:pic") for name in slide_xml)
    return {
        "slides": len(slide_xml),
        "masters": len(masters),
        "layouts": len(layouts),
        "text_nodes": text_nodes,
        "slide_pictures": pictures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check NESA Slide package integrity")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--preflight", action="store_true", help="Allow release hashes to be absent during assembly")
    args = parser.parse_args()

    checks: list[dict[str, object]] = []

    def add(name: str, ok: bool, detail: object, *, warn: bool = False) -> None:
        checks.append({
            "check": name,
            "status": "PASS" if ok else ("WARN" if warn else "FAIL"),
            "detail": detail,
        })

    required = [
        ROOT / "AGENTS.md",
        ROOT / "README.md",
        ROOT / "source-snapshot.json",
        ROOT / "source-snapshot-verification.json",
        ROOT / "prompt_system" / "renderers" / "manifest.yaml",
        ROOT / "artifacts" / "renderer-matrix" / "matrix.json",
        ROOT / "src" / "html-editor" / "edit-mode.js",
        ROOT / "artifacts" / "html-test" / "dev_server.py",
        ROOT / "artifacts" / "html-test" / "pptxgen.bundle.js",
        ROOT / "artifacts" / "html-test" / "pptx-browser-export.js",
    ]
    add("required-files", all(path.is_file() for path in required), [str(path.relative_to(ROOT)) for path in required if not path.is_file()])

    freeze = json.loads((ROOT / "source-snapshot-verification.json").read_text(encoding="utf-8")) if (ROOT / "source-snapshot-verification.json").is_file() else {}
    freeze_checks = freeze.get("checks", {}) if isinstance(freeze, dict) else {}
    freeze_ok = (
        freeze.get("status") == "passed"
        and freeze_checks.get("allowlisted_files_checked") == 668
        and freeze_checks.get("missing_files") == 0
        and freeze_checks.get("sha256_changes") == 0
        and freeze_checks.get("mtime_changes") == 0
    )
    add("source-freeze", freeze_ok, freeze)

    themes = sorted((ROOT / "prompt_system" / "themes").glob("*.yaml"))
    layouts = sorted((ROOT / "prompt_system" / "layouts").glob("*.yaml"))
    retired_present = sorted(path.name for path in layouts if path.name in RETIRED_LAYOUTS)
    add("core-counts", len(themes) == 36 and len(layouts) == 77 and not retired_present, {
        "themes": len(themes), "active_layouts": len(layouts), "retired_present": retired_present,
    })

    adapter_root = ROOT / "prompt_system" / "renderers"
    theme_adapters = sum(len(list((adapter_root / renderer / "themes").glob("*.yaml"))) for renderer in ("image2", "html", "pptx"))
    layout_adapters = sum(len(list((adapter_root / renderer / "layouts").glob("*.yaml"))) for renderer in ("image2", "html", "pptx"))
    add("adapter-counts", theme_adapters == 108 and layout_adapters == 231, {
        "theme_adapters": theme_adapters, "layout_adapters": layout_adapters, "total": theme_adapters + layout_adapters,
    })

    skills = ["design-presentations", "generate-image-slide", "html-image-slide", "html-pattern-slide", "ppt-builder", "slide-background-image", "slide-outline-planner"]
    add("project-skills", all((ROOT / ".agents" / "skills" / name / "SKILL.md").is_file() for name in skills), skills)

    forbidden_paths = []
    for path in ROOT.rglob("*"):
        if any(part in FORBIDDEN_PARTS for part in path.relative_to(ROOT).parts):
            forbidden_paths.append(path.relative_to(ROOT).as_posix())
    add("forbidden-directories", not forbidden_paths, forbidden_paths[:25])

    suspicious_names = [
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file() and (path.name.lower() == ".env" or path.suffix.lower() in {".key", ".pem", ".pfx"})
    ]
    add("credential-files", not suspicious_names, suspicious_names)

    disposable_files = [
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".pyc", ".log"}
    ]
    add("runtime-logs-and-caches", not disposable_files, disposable_files)

    absolute_hits = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if any(pattern.search(text) for pattern in ABSOLUTE_PATH_PATTERNS):
            absolute_hits.append(path.relative_to(ROOT).as_posix())
    add("portable-text-paths", not absolute_hits, absolute_hits)

    image_root = ROOT / "demos" / "image" / "tide-house"
    yaml_files = sorted((image_root / "prompts").glob("*.assembled.yaml"))
    png_files = sorted((image_root / "slides").glob("*.png"))
    yaml_ok = len(yaml_files) == 10
    try:
        import yaml  # type: ignore
        expected_keys = [
            "page_type_and_mood", "visual_base_2a", "corner_decoration_2b",
            "layout_description", "content", "safe_zone_constraints", "closing_design_intent",
        ]
        yaml_ok = yaml_ok and all(list((yaml.safe_load(path.read_text(encoding="utf-8")) or {}).keys()) == expected_keys for path in yaml_files)
    except ImportError:
        add("yaml-runtime", False, "PyYAML is unavailable; exact seven-section validation skipped", warn=True)
    png_details = []
    png_ok = len(png_files) == 10
    for path in png_files:
        try:
            width, height = png_size(path)
            ratio_ok = abs(width / height - 16 / 9) < 0.02
            png_details.append({"file": path.name, "size": [width, height], "ratio_ok": ratio_ok})
            png_ok = png_ok and ratio_ok
        except Exception as exc:  # pragma: no cover - diagnostic path
            png_ok = False
            png_details.append({"file": path.name, "error": str(exc)})
    add("image-demo-yaml", yaml_ok, {"files": len(yaml_files)})
    add("image-demo-png", png_ok, png_details)
    image_pptx = image_root / "tide-house-image-deck.pptx"
    image_structure = pptx_structure(image_pptx) if image_pptx.is_file() else {}
    add("image-demo-pptx", bool(image_structure) and image_structure.get("slides") == 10, image_structure)
    image_qa = json.loads((image_root / "qa-summary.json").read_text(encoding="utf-8")) if (image_root / "qa-summary.json").is_file() else {}
    add("image-demo-evidence", image_qa.get("status") == "passed-with-scope" and (image_root / "contact-sheet.png").is_file(), {
        "qa_status": image_qa.get("status"), "contact_sheet": (image_root / "contact-sheet.png").is_file(),
    })

    html_root = ROOT / "demos" / "html" / "street-revival"
    html_path = html_root / "street-revival.html"
    html_slides = 0
    if html_path.is_file():
        counter = SlideCounter()
        counter.feed(html_path.read_text(encoding="utf-8"))
        html_slides = counter.slides
    add("html-demo", html_slides == 10 and (html_root / "street-revival.manifest.json").is_file() and (html_root / "edit-mode.js").is_file(), {
        "slides": html_slides,
        "manifest": (html_root / "street-revival.manifest.json").is_file(),
        "editor": (html_root / "edit-mode.js").is_file(),
    })
    html_qa = json.loads((html_root / "qa" / "qa-summary.json").read_text(encoding="utf-8")) if (html_root / "qa" / "qa-summary.json").is_file() else {}
    add("html-demo-evidence", html_qa.get("status") == "passed" and (html_root / "contact-sheet.png").is_file(), {
        "qa_status": html_qa.get("status"), "contact_sheet": (html_root / "contact-sheet.png").is_file(),
    })

    pptx_root = ROOT / "demos" / "pptx" / "mist-pop-launch"
    pptx_path = pptx_root / "mist-pop-launch.pptx"
    editable_structure = pptx_structure(pptx_path) if pptx_path.is_file() else {}
    editable_ok = bool(editable_structure) and editable_structure.get("slides") == 10 and editable_structure.get("masters", 0) >= 1 and editable_structure.get("layouts", 0) >= 1 and editable_structure.get("text_nodes", 0) > 0
    add("pptx-demo", editable_ok, editable_structure)
    pptx_qa = json.loads((pptx_root / "qa-summary.json").read_text(encoding="utf-8")) if (pptx_root / "qa-summary.json").is_file() else {}
    add("pptx-demo-evidence", pptx_qa.get("status") == "passed" and (pptx_root / "contact-sheet.png").is_file() and (pptx_root / "package-inspection.json").is_file(), {
        "qa_status": pptx_qa.get("status"),
        "contact_sheet": (pptx_root / "contact-sheet.png").is_file(),
        "package_inspection": (pptx_root / "package-inspection.json").is_file(),
    })

    manifest_path = ROOT / "release-manifest.json"
    release_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    add("release-manifest", manifest_path.is_file() and release_manifest.get("release_status") == "internal-test-passed", {
        "path": str(manifest_path.relative_to(ROOT)), "release_status": release_manifest.get("release_status"),
    })

    hash_path = ROOT / "release-files.sha256"
    if hash_path.is_file():
        mismatches = []
        entries = 0
        for raw in hash_path.read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            expected, relative = raw.split("  ", 1)
            target = ROOT / relative
            entries += 1
            if not target.is_file() or sha256(target) != expected:
                mismatches.append(relative)
        add("release-hashes", not mismatches and entries > 0, {"entries": entries, "mismatches": mismatches[:25]})
    else:
        add("release-hashes", False, "release-files.sha256 is missing", warn=args.preflight)

    status = "FAIL" if any(row["status"] == "FAIL" for row in checks) else ("WARN" if any(row["status"] == "WARN" for row in checks) else "PASS")
    report = {"schema_version": 1, "package": "NESA Slide 0.1.0-demo.1", "status": status, "checks": checks}
    for row in checks:
        print(f"[{row['status']}] {row['check']}: {json.dumps(row['detail'], ensure_ascii=False)}")
    print(f"\nNESA Slide system check: {status}")

    if args.report:
        report_path = args.report if args.report.is_absolute() else ROOT / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return 1 if status == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
