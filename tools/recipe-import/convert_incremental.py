#!/usr/bin/env python3
"""SamOS a-Shell incremental export with immutable timestamped JSON and reports.

Run after pulling the private vault. Uses the existing converter for only new/changed
Markdown files. --full reparses every recipe and is a recovery/export option.
No Git operations or Supabase writes happen here.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

STATE_NAME = '.recipe-export-state.json'


def digest(path: Path) -> str:
    # Match the existing converter's utf-8-sig handling.
    raw = path.read_text(encoding='utf-8-sig')
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def load_state(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or not isinstance(data.get('hashes'), dict):
        raise ValueError('Export state is invalid; move it aside and use --full after reviewing it')
    hashes = data['hashes']
    if not all(isinstance(k, str) and isinstance(v, str) and len(v) == 64 for k, v in hashes.items()):
        raise ValueError('Export state contains invalid hashes')
    return hashes


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('recipes_dir', type=Path)
    ap.add_argument('--converter', type=Path, required=True, help='Existing convert_recipes.py')
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--full', action='store_true', help='Export every recipe instead of only changes')
    args = ap.parse_args(argv)
    root = args.recipes_dir.expanduser().resolve()
    converter = args.converter.expanduser().resolve()
    out = args.out.expanduser().resolve()
    if not root.is_dir() or not converter.is_file():
        ap.error('Recipe folder or existing converter is missing')
    if out == root or root in out.parents:
        ap.error('Output must not be inside the source recipe directory')
    files = sorted(root.rglob('*.md'))
    if not files:
        ap.error('No recipes found')
    out.mkdir(parents=True, exist_ok=True)
    state_path = out / STATE_NAME
    before = load_state(state_path)
    now = {p.relative_to(root).as_posix(): digest(p) for p in files}
    changed = sorted(rel for rel, sha in now.items() if args.full or before.get(rel) != sha)
    removed = sorted(set(before) - set(now))
    if not changed and not removed:
        print('No recipe changes since previous export; no new files created.')
        return 0

    # Unique per run, UTC, down to microseconds. Fail rather than overwrite an export.
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    json_path = out / f'recipes-preview-{stamp}.json'
    report_path = out / f'conversion-report-{stamp}.md'
    if json_path.exists() or report_path.exists():
        raise FileExistsError('Timestamp collision; no file overwritten')

    payload = []
    converter_report = ''
    if changed:
        with tempfile.TemporaryDirectory(prefix='samos-recipe-stage-') as temp:
            temp_path = Path(temp)
            stage = temp_path / 'recipes'
            for rel in changed:
                target = stage / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / rel, target)
            temp_out = temp_path / 'converted'
            result = subprocess.run([sys.executable, str(converter), str(stage), '--out', str(temp_out)],
                                    capture_output=True, text=True, check=False)
            if result.returncode:
                print(result.stdout, file=sys.stderr)
                print(result.stderr, file=sys.stderr)
                return result.returncode
            payload = json.loads((temp_out / 'recipes-preview.json').read_text(encoding='utf-8'))
            converter_report = (temp_out / 'conversion-report.md').read_text(encoding='utf-8')
    for entry in payload:
        md = entry['preview_metadata']
        rel = md['source_relative_path']
        # The prior source hash allows Kitchen to detect divergence BEFORE update.
        md['previous_source_sha256'] = before.get(rel)
        md['change_kind'] = 'new' if rel not in before else 'changed'
        md['export_timestamp_utc'] = stamp
    # Deletions are audit-only. Never delete from Supabase automatically.
    report_lines = [f'# SamOS Recipe Export — {stamp}', '',
                    f'- Mode: **{"full" if args.full else "incremental"}**',
                    f'- New/changed recipes exported: **{len(payload)}**',
                    f'- Deleted source paths (no database deletions): **{len(removed)}**',
                    '- No source recipes or database rows changed.', '',
                    '## Source files removed since last export (manual review only)', '']
    report_lines += [f'- `{rel}`' for rel in removed] or ['- None']
    report_lines += ['', '## Conversion detail', '', converter_report or 'No new/changed recipe files were converted.']
    encoded = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    # Exclusive creation: no collisions, and previews are not overwritten.
    try:
        with json_path.open('x', encoding='utf-8') as fp:
            fp.write(encoded)
        with report_path.open('x', encoding='utf-8') as fp:
            fp.write('\n'.join(report_lines) + '\n')
    except BaseException:
        json_path.unlink(missing_ok=True)
        report_path.unlink(missing_ok=True)
        raise
    # Update local state only AFTER both exports are written.
    state_tmp = out / (STATE_NAME + '.tmp')
    state_tmp.write_text(json.dumps({'schema': 1, 'hashes': now}, indent=2) + '\n', encoding='utf-8')
    os.replace(state_tmp, state_path)
    print(f'Exported {len(payload)} recipe(s): {sum(x["preview_metadata"]["change_kind"] == "new" for x in payload)} new; '
          f'{sum(x["preview_metadata"]["change_kind"] == "changed" for x in payload)} changed; '
          f'{len(removed)} deleted paths noted')
    print('JSON:  ', json_path)
    print('Report:', report_path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
