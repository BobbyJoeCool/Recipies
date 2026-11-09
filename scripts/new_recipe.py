#!/usr/bin/env python3
"""Create a new recipe file from the template.

Usage:
  python3 scripts/new_recipe.py "Apple Crisp" --category Desserts --by "Grandma Lois" --preheat 350
  python3 scripts/new_recipe.py "Sourdough Rye" --category "Breads & Rolls" --tags sourdough
  python3 scripts/new_recipe.py "Apple Crisp"      # asks for anything you leave out
  python3 scripts/new_recipe.py "Apple Crisp" --parts Crisp Topping   # multi-part recipe

Writes recipes/<id>.json with the header filled in and placeholder ingredients/directions
for you to replace. Refuses to overwrite an existing file.
"""
import argparse
import json
import re
import sys
import unicodedata

from recipe_config import CATEGORIES, RECIPES_DIR, TAGS


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def ask(prompt, default=None):
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val or default


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("title")
    ap.add_argument("--category", help="one of: " + ", ".join(CATEGORIES))
    ap.add_argument("--by", dest="contributor", help="who the recipe is from")
    ap.add_argument("--preheat", type=int, help="oven temperature in °F (leave out for no-bake)")
    ap.add_argument("--parts", nargs="+", metavar="NAME", help="names of each part, e.g. Cake Frosting")
    ap.add_argument("--tags", nargs="+", metavar="TAG", choices=list(TAGS), default=[],
                    help="optional badges: " + ", ".join(TAGS))
    ap.add_argument("--id", help="override the generated id/filename")
    args = ap.parse_args()

    category = args.category
    while category not in CATEGORIES:
        if category:
            print(f'"{category}" is not a category.')
        for i, c in enumerate(CATEGORIES, 1):
            print(f"  {i}. {c}")
        choice = ask("Category (number or name)")
        category = CATEGORIES[int(choice) - 1] if choice and choice.isdigit() and 0 < int(choice) <= len(CATEGORIES) else choice

    contributor = args.contributor if args.contributor is not None else ask("Who is it from? (Enter to skip)")
    preheat = args.preheat
    if preheat is None and sys.stdin.isatty() and args.category is None:
        p = ask("Preheat °F (Enter for no-bake)")
        preheat = int(p) if p else None

    rid = args.id or slugify(args.title)
    path = RECIPES_DIR / f"{rid}.json"
    if path.exists():
        sys.exit(f"recipes/{path.name} already exists. Pick a different title or pass --id something-else.")

    parts = args.parts or [None]
    recipe = {
        "$schema": "../recipe.schema.json",
        "id": rid,
        "title": args.title,
        "category": category,
        "contributor": contributor or None,
        "preheatF": preheat,
        **({"tags": args.tags} if args.tags else {}),
        "components": [
            {"name": name, "ingredients": ["REPLACE: 1 cup something"], "directions": ["REPLACE: first step."]}
            for name in parts
        ],
        "notes": [],
    }
    path.write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ created recipes/{path.name}")
    print("  Next: fill in the ingredients and directions, then run  python3 scripts/build.py")


if __name__ == "__main__":
    main()
