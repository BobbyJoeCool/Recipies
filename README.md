# Family Recipe Book

A static recipe site for GitHub Pages. Every recipe is a JSON object in `data/recipes.json`; the page reads that file and renders one card per recipe. Click a card for the full recipe, or hit **Print** for a clean one-page printout of just that recipe.

Live at **https://bobbyjoecool.dev/Recipies/**

## How it's hosted

This is a GitHub Pages *project site*. GitHub serves project sites under the custom domain of the owner's *user site* (`bobbyjoecool.github.io`), at a path equal to the repo name. So:

- The repo is named **`Recipies`**, which makes the path `/Recipies/`.
- The domain `bobbyjoecool.dev` is configured on the `bobbyjoecool.github.io` repo, not here.
- This repo deliberately has **no `CNAME` file**. Adding one would try to claim a separate domain for this repo instead of living under the main one.
- All asset paths are relative (`styles.css`, `data/recipes.json`), so the site works under any sub-path.

Setup, once:

1. **Settings → Pages** on this repo: Source **Deploy from a branch**, branch **main**, folder **/ (root)**, **Save**.
2. On the `bobbyjoecool.github.io` repo, **Settings → Pages → Custom domain** must be `bobbyjoecool.dev` (with DNS pointing at GitHub Pages). If that's already in place, nothing else is needed.

No build step. `.nojekyll` tells Pages to serve the files as-is.

## Run it locally

The page loads the JSON with `fetch`, which browsers block on `file://`. Start a tiny server from this folder instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Add a recipe

Add an object to the array in `data/recipes.json`:

```json
{
  "id": "grandmas-apple-crisp",
  "title": "Grandma's Apple Crisp",
  "category": "Desserts",
  "contributor": "Grandma Lois",
  "preheatF": 350,
  "components": [
    {
      "name": null,
      "ingredients": ["6 apples, sliced", "1 cup oats"],
      "directions": ["Put apples in a 9x13 pan.", "Bake at 350°F for 40 minutes."]
    }
  ],
  "notes": []
}
```

| Field | Notes |
| --- | --- |
| `id` | Unique, lowercase, dashes. Used in links (`…/#grandmas-apple-crisp`). |
| `category` | One of: Appetizers, Breads & Rolls, Soups, Salads & Veggies, Entrees, Desserts, Canning, Miscellaneous. A new category also works; it gets added to the end of the filter list. |
| `contributor` | Who the recipe came from, or `null`. |
| `preheatF` | Oven temperature as a number, or `null` for no-bake recipes. |
| `components` | Usually one with `"name": null`. For multi-part recipes (cake + frosting), add one per part with a name. |
| `notes` | Tips, yield, storage. Empty array if none. |

Validate the file before pushing so a stray comma doesn't blank the site:

```bash
python3 -m json.tool data/recipes.json > /dev/null && echo OK
```

## Files

```
index.html          page shell
styles.css          layout, dark mode, print styles
app.js              loads the JSON, search, category filter, dialog, printing
data/recipes.json   all the recipes
```
