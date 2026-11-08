#!/usr/bin/env python3
"""Validate every recipe in recipes/ and bundle them into data/recipes.json.

Usage:
  python3 scripts/build.py              # validate + write data/recipes.json (for local preview)
  python3 scripts/build.py --check      # validate only, write nothing
  python3 scripts/build.py --out _site  # validate + assemble a deployable site folder (used by CI)

Exits with status 1 and a list of problems if any recipe is invalid.
"""
import argparse
import json
import re
import shutil
import sys

from recipe_config import CATEGORIES, INBOX_DIR, INBOX_FILE_TYPES, RECIPES_DIR, ROOT, STATIC_FILES

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_KEYS = {"$schema", "id", "title", "category", "contributor", "preheatF", "components", "notes"}
REQUIRED_KEYS = ALLOWED_KEYS - {"$schema"}


def is_str_list(v, allow_empty=True):
    return isinstance(v, list) and (allow_empty or v) and all(isinstance(s, str) and s.strip() for s in v)


def validate(path, r):
    errs = []
    if not isinstance(r, dict):
        return ["top level must be a JSON object { ... }"]
    missing = REQUIRED_KEYS - r.keys()
    extra = r.keys() - ALLOWED_KEYS
    if missing:
        errs.append(f"missing field(s): {', '.join(sorted(missing))}")
    if extra:
        errs.append(f"unknown field(s) (typo?): {', '.join(sorted(extra))}")

    rid = r.get("id")
    if not isinstance(rid, str) or not ID_RE.match(rid):
        errs.append('"id" must be lowercase letters/numbers separated by dashes, e.g. "apple-crisp"')
    elif rid != path.stem:
        errs.append(f'"id" is "{rid}" but the file is named "{path.name}"; they must match')

    if not isinstance(r.get("title"), str) or not r.get("title", "").strip():
        errs.append('"title" must be a non-empty string')
    if r.get("category") not in CATEGORIES:
        errs.append(f'"category" must be one of: {", ".join(CATEGORIES)} (add new ones in scripts/recipe_config.py)')
    c = r.get("contributor")
    if c is not None and (not isinstance(c, str) or not c.strip()):
        errs.append('"contributor" must be a name or null')
    p = r.get("preheatF")
    if p is not None and (not isinstance(p, int) or isinstance(p, bool) or not 150 <= p <= 550):
        errs.append('"preheatF" must be a whole number between 150 and 550, or null for no-bake')

    comps = r.get("components")
    if not isinstance(comps, list) or not comps:
        errs.append('"components" must be a list with at least one part')
    else:
        for i, comp in enumerate(comps, 1):
            where = f"components[{i}]"
            if not isinstance(comp, dict):
                errs.append(f"{where} must be an object"); continue
            bad = comp.keys() - {"name", "ingredients", "directions"}
            if bad:
                errs.append(f"{where} has unknown field(s): {', '.join(sorted(bad))}")
            n = comp.get("name")
            if n is not None and (not isinstance(n, str) or not n.strip()):
                errs.append(f'{where} "name" must be text or null')
            if len(comps) > 1 and n is None:
                errs.append(f'{where} needs a "name" because the recipe has more than one part')
            if not is_str_list(comp.get("ingredients")):
                errs.append(f'{where} "ingredients" must be a list of non-empty strings')
            if not is_str_list(comp.get("directions")):
                errs.append(f'{where} "directions" must be a list of non-empty strings')
            if not comp.get("ingredients") and not comp.get("directions"):
                errs.append(f"{where} has no ingredients and no directions")
    if not is_str_list(r.get("notes")):
        errs.append('"notes" must be a list of strings (use [] for none)')
    if "REPLACE" in json.dumps(r):
        errs.append('still contains "REPLACE" placeholder text from the template')
    return errs


INBOX_KEYS = {"id", "title", "type", "submittedBy", "submitted", "link", "file", "notes"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_inbox(path, it):
    """Inbox items are links or files someone sent that still need typing up."""
    if not isinstance(it, dict):
        return ["top level must be a JSON object { ... }"]
    errs = []
    missing, extra = INBOX_KEYS - it.keys(), it.keys() - INBOX_KEYS
    if missing:
        errs.append(f"missing field(s): {', '.join(sorted(missing))}")
    if extra:
        errs.append(f"unknown field(s): {', '.join(sorted(extra))}")
    if it.get("id") != path.stem:
        errs.append(f'"id" must match the file name ("{path.stem}")')
    for k in ("title", "submittedBy"):
        if not isinstance(it.get(k), str) or not it[k].strip():
            errs.append(f'"{k}" must be a non-empty string')
    if not isinstance(it.get("submitted"), str) or not DATE_RE.match(it["submitted"]):
        errs.append('"submitted" must be a date like 2026-11-08')
    t = it.get("type")
    if t == "link":
        if not isinstance(it.get("link"), str) or not re.match(r"^https?://", it["link"]):
            errs.append('"link" must be a full URL starting with http:// or https://')
    elif t == "file":
        f = it.get("file")
        if not isinstance(f, str) or "/" in f or "\\" in f:
            errs.append('"file" must be a file name in the inbox/ folder')
        elif not (INBOX_DIR / f).is_file():
            errs.append(f'"file" says {f} but inbox/{f} doesn\'t exist (did you save the attachment with that name?)')
        elif (INBOX_DIR / f).suffix.lower() not in INBOX_FILE_TYPES:
            errs.append(f"inbox file type must be one of {', '.join(sorted(INBOX_FILE_TYPES))}")
    else:
        errs.append('"type" must be "link" or "file"')
    if not is_str_list(it.get("notes")):
        errs.append('"notes" must be a list of strings (use [] for none)')
    return errs


def load_inbox():
    items, problems = [], {}
    if not INBOX_DIR.is_dir():
        return items, problems
    for path in sorted(p for p in INBOX_DIR.glob("*.json") if not p.name.startswith("_")):
        try:
            it = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems[f"inbox/{path.name}"] = [f"not valid JSON: {e.msg} at line {e.lineno}, column {e.colno}"]
            continue
        errs = validate_inbox(path, it)
        if errs:
            problems[f"inbox/{path.name}"] = errs
        else:
            items.append(it)
    items.sort(key=lambda it: it["submitted"])
    return items, problems


def load_all():
    recipes, problems, seen = [], {}, {}
    files = sorted(p for p in RECIPES_DIR.glob("*.json") if not p.name.startswith("_"))
    for path in files:
        try:
            r = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems[f"recipes/{path.name}"] = [f"not valid JSON: {e.msg} at line {e.lineno}, column {e.colno}"]
            continue
        errs = validate(path, r)
        if isinstance(r, dict) and r.get("id") in seen:
            errs.append(f'duplicate id, also used by {seen[r["id"]]}')
        if errs:
            problems[f"recipes/{path.name}"] = errs
        else:
            seen[r["id"]] = path.name
            r.pop("$schema", None)
            recipes.append(r)
    order = {c: i for i, c in enumerate(CATEGORIES)}
    recipes.sort(key=lambda r: (order[r["category"]], r["title"].lower()))
    return recipes, problems, len(files)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="validate only")
    ap.add_argument("--out", help="assemble a deployable site in this folder")
    args = ap.parse_args()

    recipes, problems, total = load_all()
    inbox, inbox_problems = load_inbox()
    problems.update(inbox_problems)
    if problems:
        print(f"✗ {len(problems)} file(s) have problems:\n", file=sys.stderr)
        for name, errs in problems.items():
            print(f"  {name}", file=sys.stderr)
            for e in errs:
                print(f"    - {e}", file=sys.stderr)
        sys.exit(1)

    print(f"✓ {len(recipes)} recipes valid, {len(inbox)} inbox item(s) waiting to be typed up")
    if args.check:
        return

    bundle = json.dumps(recipes, ensure_ascii=False, separators=(",", ":"))
    categories = json.dumps(CATEGORIES, ensure_ascii=False)
    inbox_json = json.dumps(inbox, ensure_ascii=False, separators=(",", ":"))
    if args.out:
        out = (ROOT / args.out).resolve()
        if out == ROOT:
            sys.exit("--out must be a separate folder")
        shutil.rmtree(out, ignore_errors=True)
        (out / "data").mkdir(parents=True)
        for f in STATIC_FILES:
            shutil.copy2(ROOT / f, out / f)
        (out / "data" / "recipes.json").write_text(bundle, encoding="utf-8")
        (out / "data" / "categories.json").write_text(categories, encoding="utf-8")
        (out / "data" / "inbox.json").write_text(inbox_json, encoding="utf-8")
        files = [it["file"] for it in inbox if it["file"]]
        if files:
            (out / "inbox").mkdir()
            for f in files:
                shutil.copy2(INBOX_DIR / f, out / "inbox" / f)
        print(f"✓ site assembled in {out.relative_to(ROOT)}/")
    else:
        (ROOT / "data").mkdir(exist_ok=True)
        (ROOT / "data" / "recipes.json").write_text(bundle, encoding="utf-8")
        (ROOT / "data" / "categories.json").write_text(categories, encoding="utf-8")
        (ROOT / "data" / "inbox.json").write_text(inbox_json, encoding="utf-8")
        print("✓ wrote data/ (recipes, categories, inbox) (preview with: python3 -m http.server 8000)")


if __name__ == "__main__":
    main()
