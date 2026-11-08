# Family Recipe Book

Live at **https://bobbyjoecool.dev/Recipies/**

A static recipe site on GitHub Pages. Each recipe is its own JSON file in `recipes/`. On every push, a GitHub Action validates all of them, bundles them into one file, and deploys the site. Recipes show as searchable, filterable cards. Click one for the full recipe, or hit **Print** for a clean printout of just that recipe.

## How it fits together

```
recipes/*.json  ──►  scripts/build.py  ──►  data/recipes.json  ──►  index.html + app.js
 (one per recipe)     validates + bundles     (generated, not       (cards, search,
  you edit these      fails on any error       committed)            print)
```

GitHub Pages can't list a folder, so the browser can't discover the individual files on its own. The build step bundles them into one `data/recipes.json` that the page loads. That file is generated. Never edit it by hand, and it's git-ignored.

## Adding a recipe

### 1. Create the file

**Option A: use the script (recommended).** From the repo root:

```bash
python3 scripts/new_recipe.py "Apple Crisp" --category Desserts --by "Grandma Lois" --preheat 350
```

Leave out any option and it will ask you. For recipes with several parts (cake + frosting, crust + filling), name the parts:

```bash
python3 scripts/new_recipe.py "Zucchini Bread" --category "Breads & Rolls" --by "Brenda Bradley" --preheat 350 --parts Bread Glaze
```

This creates `recipes/apple-crisp.json` with the header filled in and `REPLACE:` placeholders for the ingredients and directions.

**Option B: copy the template by hand.** Copy `recipes/_template.json` to `recipes/<id>.json`, where `<id>` is the title in lowercase with dashes (`Apple Crisp` → `apple-crisp.json`). Files starting with `_` are ignored by the build.

### 2. Fill it in

Open the file and replace every `REPLACE` placeholder. The build refuses to publish a recipe that still has one. In VS Code, the `$schema` line at the top gives you autocomplete and red squiggles for mistakes as you type.

```json
{
  "$schema": "../recipe.schema.json",
  "id": "apple-crisp",
  "title": "Apple Crisp",
  "category": "Desserts",
  "contributor": "Grandma Lois",
  "preheatF": 350,
  "components": [
    {
      "name": null,
      "ingredients": ["6 apples, peeled and sliced", "1 cup oats", "1/2 cup brown sugar"],
      "directions": ["Spread apples in a 9x13 pan.", "Mix oats and sugar; sprinkle over apples.", "Bake at 350°F for 40 minutes."]
    }
  ],
  "notes": ["Serve warm with vanilla ice cream."]
}
```

### 3. Check it

```bash
python3 scripts/build.py
```

You'll see `✓ 120 recipes valid`, or a list of exactly what's wrong and in which file.

### 4. Preview it (optional)

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 and find your recipe. (Opening `index.html` directly doesn't work; browsers block loading the data file over `file://`.)

### 5. Publish

```bash
git add recipes/apple-crisp.json
git commit -m "Add Apple Crisp"
git push
```

The **Validate and deploy** action runs automatically. When it goes green (about a minute, see the repo's **Actions** tab), the recipe is live. If validation fails, nothing is deployed and the live site stays as it was. The failed run's log shows the same error list as step 3.

## Recipe fields

| Field | Required | Rules |
| --- | --- | --- |
| `id` | yes | Lowercase letters, numbers and dashes. **Must match the file name** (`apple-crisp` ↔ `apple-crisp.json`). Used in share links: `…/Recipies/#apple-crisp`. |
| `title` | yes | Shown on the card. |
| `category` | yes | One of: `Appetizers`, `Breads & Rolls`, `Soups, Salads & Veggies`, `Entrees`, `Desserts`, `Canning`, `Miscellaneous`. |
| `contributor` | yes | Who it's from, or `null`. |
| `preheatF` | yes | Oven temperature as a whole number (`350`), or `null` for no-bake. |
| `components` | yes | At least one part. Single-part recipes use one part with `"name": null`. Multi-part recipes need a `name` on every part. |
| `components[].ingredients` | yes | List of strings, one per ingredient. |
| `components[].directions` | yes | List of strings, one per step. They're numbered automatically. |
| `notes` | yes | List of tips, yield or storage info. Use `[]` for none. |

Two recipes with the same title (e.g. two family versions of Banana Pie) just need different ids: `banana-pie.json` and `banana-pie-schwerin.json`.

## Editing or removing a recipe

- **Edit:** change the file, run `python3 scripts/build.py`, commit, push.
- **Remove:** `git rm recipes/<id>.json`, commit, push.
- **Rename the id:** rename the file *and* the `id` field together. Old share links to that recipe will stop opening it.

## Adding a category

Add it to `CATEGORIES` in `scripts/recipe_config.py`. The list order is the filter order on the site. Also add it to the `category` enum in `recipe.schema.json` so the editor accepts it.

## What the pipeline checks

`scripts/build.py` fails the build if any recipe:

- isn't valid JSON (it reports the line and column),
- is missing a field or has an unknown one (catches typos like `"ingrediants"`),
- has an `id` that doesn't match its file name, or duplicates another recipe's id,
- uses a category that isn't in the list,
- has a `preheatF` that isn't a whole number from 150 to 550 (or `null`),
- has an empty part, or an unnamed part in a multi-part recipe,
- still contains `REPLACE` placeholder text.

Pull requests are validated too, so if family members send recipes as PRs, you'll see a red ✗ on any broken file before you merge. PRs never deploy.

## Hosting setup (one time)

This is a GitHub Pages *project site*. GitHub serves project sites under the custom domain of the owner's *user site* (`bobbyjoecool.github.io`), at a path equal to the repo name.

1. The repo must be named **`Recipies`**, which makes the path `/Recipies/`.
2. In this repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Not "Deploy from a branch": the generated data file isn't committed, so a branch deploy would show an empty site.)
3. In the `bobbyjoecool.github.io` repo, **Settings → Pages → Custom domain** must be `bobbyjoecool.dev`.
4. This repo deliberately has **no `CNAME` file**. Adding one would try to claim a separate domain instead of living under the main one.

All asset paths are relative, so the site works under any sub-path.

## Files

```
recipes/              one JSON file per recipe (edit these)
recipes/_template.json  starting point for a hand-made recipe (ignored by the build)
recipe.schema.json    editor autocomplete/validation for recipe files
scripts/new_recipe.py create a new recipe file
scripts/build.py      validate + bundle (CI runs this too)
scripts/recipe_config.py  category list and other settings
.github/workflows/deploy.yml  validate on every push/PR, deploy on main
index.html, styles.css, app.js  the site
```

Scripts need only Python 3 (no packages to install).
