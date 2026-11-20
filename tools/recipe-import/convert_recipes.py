#!/usr/bin/env python3
"""SamOS recipe Markdown -> Supabase-compatible JSON preview (NO NETWORK/WRITES TO DB).

Usage:
  python convert_recipes.py /path/to/SamOS/community-center/food-room/recipe-book/recipes

Writes preview files next to the script's working dir unless --out is supplied.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

FIELDS = (
    'Status', 'Difficulty', 'Category', 'Servings', 'Prep Time', 'Cook Time',
    'Total Time', 'Equipment', 'Meal Prep Friendly', 'Freezer Friendly',
    'Last Cooked', 'Author', 'Sources', 'Last Updated', 'Tags',
)
CATEGORIES = (
    'Breakfast', 'Lunch', 'Dinner', 'Snackies & Appies', 'Sides',
    'Sauces, Spices & Condiments', 'Dessert', 'Drinks', 'Bread', 'Soup', 'Unknown',
)
FOLDER_CATEGORIES = {
    'bread': 'Bread', 'breakfast': 'Breakfast', 'dessert': 'Dessert',
    'dinner': 'Dinner', 'drinks': 'Drinks',
    'sauces-spices-and-condiments': 'Sauces, Spices & Condiments',
    'sides': 'Sides', 'snackies-and-appies': 'Snackies & Appies', 'soup': 'Soup',
}
STATUS_VALUES = ('Generated', 'Ready', 'Tested', 'Final')
STORAGE_KEYS = (
    ('Room Temperature', 'room_temperature'), ('Refrigerated', 'refrigerated'),
    ('Frozen', 'frozen'), ('Canned', 'canned'),
)
SECTION_NAMES = {'Metadata', 'Ingredients', 'Steps', 'Storage', 'Notes', 'Variations', 'Canning Method'}


def split_sections(md: str) -> list[tuple[str, str]]:
    """Return sections with original Markdown preserved, including ## sections.

    Handles exceptional legacy plain headings (Pickled Radish). This is intentionally
    conservative and only recognizes known, standalone standard headings.
    """
    lines = md.splitlines(keepends=True)
    matches: list[tuple[str, int]] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = re.fullmatch(r'##\s+(.+?)\s*', stripped)
        if m:
            matches.append((m.group(1), i))
        elif stripped in SECTION_NAMES:
            matches.append((stripped, i))
    if not matches:
        return []
    pieces = []
    for j, (name, index) in enumerate(matches):
        end = matches[j + 1][1] if j + 1 < len(matches) else len(lines)
        pieces.append((name, ''.join(lines[index + 1:end])))
    return pieces


def parse_metadata(section: str) -> tuple[dict[str, str], list[str]]:
    meta: dict[str, str] = {}
    issues: list[str] = []
    for line in section.splitlines():
        if not line.strip().startswith('|'):
            continue
        cells = [re.sub(r'^\*\*(.*?)\*\*$', r'\1', c.strip()) for c in line.strip().strip('|').split('|')]
        if len(cells) < 2:
            continue
        key, val = cells[0], '|'.join(cells[1:]).strip()
        if key.lower() == 'source':
            key = 'Sources'
            issues.append('legacy Source label normalized to Sources')
        if key in FIELDS:
            meta[key] = val
    missing = [field for field in FIELDS if field not in meta]
    if missing:
        issues.append('Missing metadata fields: ' + ', '.join(missing))
    blank = [field for field in FIELDS if field in meta and not meta[field].strip()]
    if blank:
        issues.append('Blank metadata values set to Unknown: ' + ', '.join(blank))
    for key in FIELDS:
        if not meta.get(key, '').strip():
            meta[key] = 'Unknown'
    return meta, issues


def split_blocks(section: str, kind: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Preserve numbered step order and component subsections.

    Every block is {heading, items}; extra prose becomes a review flag AND stays in
    original_markdown. A dedicated review flag prevents a lossy import from being
    mistaken for a fully parsed recipe.
    """
    result = []
    issues = []
    heading = ''
    items: list[str] = []
    prose = []
    in_fence = False
    def flush():
        nonlocal items
        if items:
            result.append({'heading': heading, 'items': items})
            items = []
    for line in section.splitlines():
        trimmed = line.strip()
        if trimmed.startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = re.match(r'^#{3,4}\s+(.+)$', trimmed)
        if match:
            flush()
            heading = match.group(1).strip()
            continue
        match = (re.match(r'^\s*[-*]\s+(.+)$', line)
                 if kind == 'ingredients' else re.match(r'^\s*\d+[.)]\s+(.+)$', line))
        if match:
            items.append(match.group(1).strip())
        elif trimmed and not trimmed.startswith(('>', '|', '---')):
            prose.append(trimmed)
    flush()
    if prose:
        issues.append(f'{kind.capitalize()} contain non-list prose; inspect original Markdown')
    if not result:
        issues.append(f'No parseable {kind}')
    return result, issues


def parse_storage(section: str) -> tuple[dict[str, str], str, list[str]]:
    values = {key: 'Unknown' for _, key in STORAGE_KEYS}
    issues = []
    lines = section.splitlines()
    canning_start = next((i for i, s in enumerate(lines) if re.fullmatch(r'\s*#{3,4}\s+Canning Method\s*', s)), None)
    canning = '\n'.join(lines[canning_start:]).strip() if canning_start is not None else ''
    before = lines[:canning_start] if canning_start is not None else lines
    for raw in before:
        for display, key in STORAGE_KEYS:
            m = re.match(r'^\s*[-*]\s*(?:\*\*)?' + re.escape(display) + r':(?:\*\*)?\s*(.*)$', raw, re.I)
            if m:
                values[key] = m.group(1).strip() or 'Unknown'
                break
    missing = [d for d, k in STORAGE_KEYS if values[k] == 'Unknown']
    if missing:
        issues.append('Missing storage values: ' + ', '.join(missing))
    return values, canning, issues


def extract_outside_notes(md: str, sections: list[tuple[str, str]]) -> str:
    """Collect additional sections and callouts verbatim without changing source facts."""
    notes = []
    # Preserve explicit Variations and Notes sections as Markdown.
    for name, body in sections:
        if name in ('Variations', 'Notes') or name not in SECTION_NAMES:
            notes.append('## ' + name + '\n' + body.strip())
    # Preserve callouts from Steps/Storage separately; they carry important context.
    for name, body in sections:
        if name not in ('Steps', 'Storage'):
            continue
        current = []
        for line in body.splitlines():
            if line.lstrip().startswith('>'):
                current.append(line)
            elif current:
                notes.append('\n'.join(current).strip())
                current = []
        if current:
            notes.append('\n'.join(current).strip())
    return '\n\n'.join(x for x in notes if x).strip()


def parse_recipe(path: Path, root: Path) -> dict[str, Any]:
    md = path.read_text(encoding='utf-8-sig')
    rel = path.relative_to(root)
    issues = []
    title_match = re.search(r'^#\s+(.+?)\s*$', md, re.M)
    title = title_match.group(1) if title_match else (md.splitlines()[0].strip() if md.strip() else path.stem.replace('-', ' ').title())
    if not title_match:
        issues.append('Legacy or missing # title heading')
    sections = split_sections(md)
    if not sections:
        issues.append('No recognized sections')
    sec = {name: body for name, body in sections}
    meta, new_issues = parse_metadata(sec.get('Metadata', ''))
    issues += new_issues
    raw_status = meta['Status']
    if raw_status not in STATUS_VALUES:
        issues.append(f'Unrecognized status {raw_status!r}; preview defaults to Generated pending review')
        status = 'Generated'
    else:
        status = raw_status
    raw_cat = meta['Category']
    category = raw_cat.replace('Sauces, Spices, & Condiments', 'Sauces, Spices & Condiments')
    if category != raw_cat:
        issues.append(f'Category punctuation normalized: {raw_cat} -> {category}')
    folder = rel.parts[0] if len(rel.parts) > 1 else ''
    folder_cat = FOLDER_CATEGORIES.get(folder)
    if folder_cat and category != folder_cat:
        issues.append(f'Folder/category mismatch: folder={folder_cat}; source={raw_cat}')
        # For established directory 'soup' / Potato Soup, use requested normalization.
        if folder == 'soup' and category == 'Dinner':
            category = 'Soup'
            issues.append('Potato Soup category normalized to Soup by approved rule')
    if category not in CATEGORIES:
        issues.append(f'Unrecognized category {category!r}; preview uses Unknown')
        category = 'Unknown'
    ingr, iissues = split_blocks(sec.get('Ingredients', ''), 'ingredients')
    steps, sissues = split_blocks(sec.get('Steps', ''), 'steps')
    issues.extend(iissues + sissues)
    storage, canning, storage_issues = parse_storage(sec.get('Storage', ''))
    issues += storage_issues
    if not sec.get('Storage'):
        issues.append('Missing Storage section')
    if meta['Difficulty'] not in ('Easy', 'Medium', 'Hard', 'Unknown', 'N/A'):
        issues.append('Unknown difficulty value; normalized to Unknown')
        meta['Difficulty'] = 'Unknown'
    for field in ('Meal Prep Friendly', 'Freezer Friendly'):
        if meta[field] not in ('Yes', 'No', 'Unknown', 'N/A'):
            issues.append(f'Invalid {field}; normalized to Unknown')
            meta[field] = 'Unknown'
    # Text-safe slug based on directory + filename prevents collisions of names.
    slug = '-'.join(rel.with_suffix('').parts).lower()
    if not re.fullmatch(r'[a-z0-9-]+', slug):
        slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')
    if len(slug) > 160:
        issues.append('Slug exceeds database limit (160)')
    payload = {
        'slug': slug, 'title': title, 'status': status,
        'difficulty': meta['Difficulty'], 'category': category,
        'servings': meta['Servings'], 'prep_time': meta['Prep Time'],
        'cook_time': meta['Cook Time'], 'total_time': meta['Total Time'],
        'equipment': [x.strip() for x in meta['Equipment'].split(',') if x.strip() and x.strip() not in ('Unknown', 'N/A')],
        'tags': [x.strip() for x in meta['Tags'].split(',') if x.strip() and x.strip() not in ('Unknown', 'N/A')],
        'meal_prep_friendly': meta['Meal Prep Friendly'],
        'freezer_friendly': meta['Freezer Friendly'],
        'last_cooked': meta['Last Cooked'], 'author': meta['Author'],
        'sources': meta['Sources'], 'source_last_updated': meta['Last Updated'],
        'ingredients': ingr, 'steps': steps, 'storage': storage,
        'notes_markdown': extract_outside_notes(md, sections),
        'canning_method_markdown': canning,
        'original_markdown': md, 'source_repo': 'hazel-maris/SamOS',
        'source_path': 'community-center/food-room/recipe-book/recipes/' + rel.as_posix(),
        'review_flags': issues,
    }
    return {'recipe': payload, 'preview_metadata': {
        'source_sha256': hashlib.sha256(md.encode('utf-8')).hexdigest(),
        'source_relative_path': rel.as_posix(),
        'review_flag_count': len(issues),
    }}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipes_dir', type=Path, help='Recipes folder in original SamOS vault')
    parser.add_argument('--out', type=Path, default=Path('./recipe-conversion-preview'))
    args = parser.parse_args()
    if not args.recipes_dir.is_dir():
        parser.error(f'Not a directory: {args.recipes_dir}')
    files = sorted(args.recipes_dir.rglob('*.md'))
    if not files:
        parser.error('No .md recipe files found')
    output = [parse_recipe(p, args.recipes_dir) for p in files]
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'recipes-preview.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    flagged = [entry for entry in output if entry['recipe']['review_flags']]
    rows = [
        '# SamOS Kitchen — Conversion Report', '',
        f'- Markdown files processed: **{len(output)}**',
        f'- Recipes with any conversion notes: **{len(flagged)}**',
        '- Database inserts performed: **0**',
        '- Original Markdown modified: **No**', '',
        '## Recipes and review notes', '',
        '| Recipe | Original status | Target category | Conversion notes |',
        '| --- | --- | --- | --- |',
    ]
    for entry in output:
        r = entry['recipe']
        notes = '; '.join(r['review_flags']) or 'None'
        rows.append('| ' + ' | '.join(x.replace('|', '\\|').replace('\n', ' ') for x in (r['title'], r['status'], r['category'], notes)) + ' |')
    rows += ['', '## Preservation guarantees', '',
             '- Every record includes `original_markdown` and its `source_path`.',
             '- Numerical quantities and time ranges are never inferred.',
             '- Original Tested status remains Tested.',
             '- Source variations and inline callouts are retained verbatim.',
             '- Canning instructions must be manually compared before any database import.',
             '- The preview is NOT a database import script.']
    (args.out / 'conversion-report.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(f'Preview created: {len(output)} recipes, {len(flagged)} with review notes')
    print('Statuses:', dict(Counter(v['recipe']['status'] for v in output)))
    print('Outputs:', args.out.resolve())


if __name__ == '__main__':
    main()