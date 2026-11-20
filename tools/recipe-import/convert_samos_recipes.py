#!/usr/bin/env python3
"""Simple iSH wrapper for the existing SamOS recipe preview converter.

Only reads recipes and writes JSON/report locally. Use --pull to update the
separate iSH vault clone first, using Git fast-forward only.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

DEFAULT_VAULT = Path('/root/samos-vault')
DEFAULT_HUB = Path('/root/samos-hub')
DEFAULT_OUTPUT = Path('/root/recipe-conversion-preview')
RECIPE_SUBPATH = Path('community-center/food-room/recipe-book/recipes')
CONVERTER_SUBPATH = Path('tools/recipe-import/convert_recipes.py')


def main() -> int:
    parser = argparse.ArgumentParser(
        prog='convert-samos-recipes',
        description='Create a local JSON preview of SamOS recipes (never imports to Supabase).',
    )
    parser.add_argument('--pull', action='store_true', help='Fast-forward the separate iSH vault clone before conversion (network access required).')
    parser.add_argument('--vault', type=Path, default=DEFAULT_VAULT, help='Vault checkout root (default: /root/samos-vault).')
    parser.add_argument('--hub', type=Path, default=DEFAULT_HUB, help='Hub checkout root (default: /root/samos-hub).')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUTPUT, help='Local output directory (default: /root/recipe-conversion-preview).')
    args = parser.parse_args()

    vault = args.vault.expanduser().resolve()
    hub = args.hub.expanduser().resolve()
    recipes = vault / RECIPE_SUBPATH
    converter = hub / CONVERTER_SUBPATH

    if args.pull:
        if not (vault / '.git').exists():
            print(f'Cannot pull: not a Git checkout: {vault}', file=sys.stderr)
            return 2
        print('Updating the iSH vault clone (fast-forward only)...', flush=True)
        try:
            outcome = subprocess.run(['git', '-C', str(vault), 'pull', '--ff-only'], check=False)
        except OSError as exc:
            print(f'Could not run Git: {exc}', file=sys.stderr)
            return 2
        if outcome.returncode != 0:
            print('Pull failed; conversion was not started. No forced merge or reset was performed.', file=sys.stderr)
            return outcome.returncode

    if not recipes.is_dir():
        print(f'Recipes folder not found: {recipes}', file=sys.stderr)
        print('Check that the private SamOS vault was cloned to iSH.', file=sys.stderr)
        return 2
    if not converter.is_file():
        print(f'Converter not found: {converter}', file=sys.stderr)
        print('Run: git -C /root/samos-hub pull --ff-only', file=sys.stderr)
        return 2

    print(f'Converting recipes from: {recipes}', flush=True)
    print('This does not modify vault recipes or connect to Supabase.', flush=True)
    try:
        result = subprocess.run(
            [sys.executable, str(converter), str(recipes), '--out', str(args.out.expanduser())],
            check=False,
        )
    except OSError as exc:
        print(f'Could not run converter: {exc}', file=sys.stderr)
        return 2
    if result.returncode == 0:
        print('\nDone! Review these files:')
        print(f'  {args.out.expanduser().resolve() / "conversion-report.md"}')
        print(f'  {args.out.expanduser().resolve() / "recipes-preview.json"}')
        print('No Git commits, pushes, or Supabase imports were performed.')
    return result.returncode


if __name__ == '__main__':
    sys.exit(main())