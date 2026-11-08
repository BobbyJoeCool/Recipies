"""Shared settings for the recipe scripts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "recipes"
INBOX_DIR = ROOT / "inbox"

# File types allowed as inbox attachments (recipes waiting to be typed up).
INBOX_FILE_TYPES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"}

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
STATIC_FILES = [
    "index.html", "add.html", "styles.css",
    "config.js", "render.js", "app.js", "add.js", ".nojekyll",
]
