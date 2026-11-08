"""Shared settings for the recipe scripts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "recipes"

# Order here is the order the category filters appear on the site.
# To add a new category, add it to this list (nothing else needs to change).
CATEGORIES = [
    "Appetizers",
    "Breads & Rolls",
    "Soups, Salads & Veggies",
    "Entrees",
    "Desserts",
    "Canning",
    "Miscellaneous",
]

# Files copied into the published site alongside the generated data.
STATIC_FILES = ["index.html", "styles.css", "app.js", ".nojekyll"]
