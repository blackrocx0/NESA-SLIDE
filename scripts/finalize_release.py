#!/usr/bin/env python3
"""Create the portable release manifest and static-file SHA-256 ledger."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8-sig"))


def qa_status(path: Path) -> str:
    data = read_json(path)
    for key in ("status", "decision", "overall_status", "overall", "result"):
        value = data.get(key)
        if isinstance(value, str) and value:
            return value.lower()
    if isinstance(data.get("pass"), bool):
        return "pass" if data["pass"] else "partial"
    return "unverified"


def main() -> int:
    snapshot = read_json(ROOT / "source-snapshot.json")
    snapshot_verification = read_json(ROOT / "source-snapshot-verification.json")
    demos = {
        "image": {
            "title": "潮汐旅宿｜海岸慢旅品牌概念",
            "root": "demos/image/tide-house",
            "artifact": "demos/image/tide-house/tide-house-image-deck.pptx",
            "pages": 10,
            "editable": False,
            "qa_ref": "demos/image/tide-house/qa-summary.json",
        },
        "html": {
            "title": "巷口再生｜城市共創工作坊成果",
            "root": "demos/html/street-revival",
            "artifact": "demos/html/street-revival/street-revival.html",
            "pages": 10,
            "editable": True,
            "qa_ref": "demos/html/street-revival/qa/qa-summary.json",
        },
        "pptx": {
            "title": "MIST POP｜無酒精氣泡飲 90 天上市計畫",
            "root": "demos/pptx/mist-pop-launch",
            "artifact": "demos/pptx/mist-pop-launch/mist-pop-launch.pptx",
            "pages": 10,
            "editable": True,
            "qa_ref": "demos/pptx/mist-pop-launch/qa-summary.json",
        },
    }
    statuses = []
    for item in demos.values():
        item["qa_status"] = qa_status(ROOT / item["qa_ref"])
        statuses.append(item["qa_status"])

    pass_values = {"pass", "passed", "passed-with-scope", "complete", "success"}
    package_status = "internal-test-passed" if all(value in pass_values for value in statuses) else "internal-test-partial"
    manifest = {
        "schema_version": 1,
        "product": "NESA Slide",
        "version": "0.1.0-demo.1",
        "release_status": package_status,
        "audience": "internal-nontechnical-testers",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "snapshot_ref": "source-snapshot.json",
            "git_head": snapshot.get("source_git", {}).get("head"),
            "git_branch": snapshot.get("source_git", {}).get("branch"),
            "working_tree_dirty": snapshot.get("source_git", {}).get("working_tree_dirty"),
            "source_file_count": snapshot.get("source_file_count"),
            "source_aggregate_sha256": snapshot.get("source_aggregate_sha256"),
            "freeze_verification_ref": "source-snapshot-verification.json",
            "freeze_verification": snapshot_verification,
        },
        "catalog": {
            "core_themes": 36,
            "active_layouts": 77,
            "theme_adapters": 108,
            "layout_adapters": 231,
            "total_adapters": 339,
            "retired_layouts_excluded": [
                "toc-2", "toc-2-image-left", "toc-2-panel-rows", "toc-2-vertical",
            ],
        },
        "interfaces": {
            "codex_workspace": True,
            "global_skill_install": False,
            "check_system": "CHECK_SYSTEM.cmd",
            "open_html_demo": "OPEN_HTML_DEMO.cmd",
            "start_html_editor": "START_HTML_EDITOR.cmd",
            "user_output_root": "workspace/",
        },
        "demos": demos,
        "excluded_runtime_areas": [
            ".git", "node_modules", "experiments", "tests", "research", "review",
            "tmp", ".history", "To_delete", "migrations", "deploy", "runtime logs",
        ],
        "portable_sanitizations": [
            {
                "path": "prompt_system/presets/catalog.yaml",
                "change": "removed deployment-only Gallery artifact path and URL from clinical-evidence-atlas",
                "generation_semantics_changed": False,
            }
        ],
        "verification_boundary": {
            "source_snapshot": snapshot_verification.get("status", "unverified"),
            "adapter_structure": "passed",
            "three_demo_decks": statuses,
            "full_36x77_perceptual_matrix": "unverified",
            "remote_deployment": "not-requested",
        },
    }
    (ROOT / "release-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    static_files = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if relative.as_posix() == "release-files.sha256":
            continue
        if relative.parts and relative.parts[0] == "workspace":
            continue
        if "__pycache__" in relative.parts or path.suffix.lower() == ".pyc":
            continue
        static_files.append(path)
    lines = [f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}" for path in sorted(static_files)]
    (ROOT / "release-files.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"status": package_status, "hashed_files": len(lines), "demos": statuses}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
