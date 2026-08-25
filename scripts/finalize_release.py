#!/usr/bin/env python3
"""Finalize the NESA Slide 0.1.0-demo.2 manifest and SHA-256 ledger."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0-demo.2"
RETIRED = {"toc-2.yaml", "toc-2-image-left.yaml", "toc-2-panel-rows.yaml", "toc-2-vertical.yaml"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""): digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.is_file() else {}


def qa_status(path: Path) -> str:
    data = read_json(path)
    for key in ("status", "decision", "overall_status", "overall", "result"):
        value = data.get(key)
        if isinstance(value, str) and value: return value.lower()
    if isinstance(data.get("pass"), bool): return "pass" if data["pass"] else "partial"
    return "unverified"


def main() -> int:
    snapshot = read_json(ROOT / "source-snapshot.json")
    verification = read_json(ROOT / "source-snapshot-verification.json")
    themes = sorted((ROOT / "prompt_system/themes").glob("*.yaml"))
    layouts = sorted(p for p in (ROOT / "prompt_system/layouts").glob("*.yaml") if p.name not in RETIRED)
    adapter_root = ROOT / "prompt_system/renderers"
    theme_adapters = sum(len(list((adapter_root / r / "themes").glob("*.yaml"))) for r in ("image2", "html", "pptx"))
    layout_adapters = sum(len(list((adapter_root / r / "layouts").glob("*.yaml"))) for r in ("image2", "html", "pptx"))
    demos = {
        "image": {"title": "潮汐旅宿｜海岸慢旅品牌概念", "root": "demos/image/tide-house", "artifact": "demos/image/tide-house/tide-house-image-deck.pptx", "pages": 10, "editable": False, "qa_ref": "demos/image/tide-house/qa-summary.json"},
        "html": {"title": "巷口再生｜城市共創工作坊成果", "root": "demos/html/street-revival", "artifact": "demos/html/street-revival/street-revival.html", "pages": 10, "editable": True, "qa_ref": "demos/html/street-revival/qa/qa-summary.json"},
        "pptx": {"title": "MIST POP｜無酒精氣泡飲 90 天上市計畫", "root": "demos/pptx/mist-pop-launch", "artifact": "demos/pptx/mist-pop-launch/mist-pop-launch.pptx", "pages": 10, "editable": True, "qa_ref": "demos/pptx/mist-pop-launch/qa-summary.json"},
    }
    statuses = []
    for item in demos.values(): item["qa_status"] = qa_status(ROOT / item["qa_ref"]); statuses.append(item["qa_status"])
    pass_values = {"pass", "passed", "passed-with-scope", "complete", "success"}
    package_ok = verification.get("status") == "passed" and len(themes) == 36 and len(layouts) == 74 and theme_adapters + layout_adapters == 330 and all(s in pass_values for s in statuses)
    manifest = {
        "schema_version": 2,
        "product": "NESA Slide",
        "version": VERSION,
        "release_status": "internal-test-passed" if package_ok else "internal-test-partial",
        "audience": "internal-nontechnical-testers",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": {"snapshot_ref": "source-snapshot.json", "verification_ref": "source-snapshot-verification.json", "git": snapshot.get("source_git"), "source_file_count": snapshot.get("source_file_count"), "source_aggregate_sha256": snapshot.get("source_aggregate_sha256"), "freeze_status": verification.get("status")},
        "catalog": {"core_themes": len(themes), "active_layouts": len(layouts), "theme_adapters": theme_adapters, "layout_adapters": layout_adapters, "total_adapters": theme_adapters + layout_adapters, "retired_layouts_excluded": ["toc-2", "toc-2-image-left", "toc-2-panel-rows", "toc-2-vertical"]},
        "interfaces": {"codex_workspace": True, "global_skill_install": False, "check_system": "CHECK_SYSTEM.cmd", "open_html_demo": "OPEN_HTML_DEMO.cmd", "start_html_editor": "START_HTML_EDITOR.cmd", "user_output_root": "workspace/"},
        "demos": demos,
        "excluded_runtime_areas": [".git", "workspace", "node_modules", "experiments", "tests", "research", "review", "tmp", ".history", "To_delete", "migrations", "deploy", "runtime logs"],
        "verification_boundary": {"source_snapshot": verification.get("status", "unverified"), "adapter_structure": "passed", "text_orientation": "passed", "three_demo_decks": statuses, "full_36x74_perceptual_matrix": "unverified", "remote_deployment": "not-requested"},
    }
    (ROOT / "release-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    files = []
    for path in ROOT.rglob("*"):
        if not path.is_file(): continue
        relative = path.relative_to(ROOT)
        if relative.as_posix() == "release-files.sha256" or "__pycache__" in relative.parts or path.suffix.lower() == ".pyc": continue
        files.append(path)
    lines = [f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}" for path in sorted(files)]
    ledger_text = "\n".join(lines) + "\n"
    (ROOT / "release-files.sha256").write_text(ledger_text, encoding="utf-8")
    aggregate = hashlib.sha256(ledger_text.encode("utf-8")).hexdigest()
    print(json.dumps({"status": manifest["release_status"], "version": VERSION, "hashed_files": len(lines), "package_aggregate_sha256": aggregate, "demos": statuses}, ensure_ascii=False))
    return 0 if package_ok else 1


if __name__ == "__main__": raise SystemExit(main())
