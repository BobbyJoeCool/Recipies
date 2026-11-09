# Family Recipe Book

Live at **https://recipes.bobbyjoecool.dev/**

A static recipe site on GitHub Pages. Family can send recipes from the **Add a recipe** page without a GitHub account, and they arrive by email. Each recipe is its own JSON file in `recipes/`. On every push, a GitHub Action validates all of them, bundles them into one file, and deploys the site. The home page opens on a table of contents grouped by category (or switch to Cards), with search, category filters, and **Sourdough** / **High protein** badge filters. Click a recipe for the full version, or hit **Print** for a clean printout of just that recipe.

## How it fits together

```
recipes/*.json  ──►  scripts/build.py  ──►  data/recipes.json  ──►  index.html + app.js
 (one per recipe)     validates + bundles     (generated, not       (cards, search,
  you edit these      fails on any error       committed)            print)
```

GitHub Pages can't list a folder, so the browser can't discover the individual files on its own. The build step bundles them into one `data/recipes.json` that the page loads. That file is generated. Never edit it by hand, and it's git-ignored.

## Family submissions: the "Add a recipe" page

`add.html` (the **+ Add a recipe** button on the home page) lets anyone send a recipe. Family need no GitHub account. Nothing is saved on the site directly: GitHub Pages can't store anything. Instead the page opens the sender's own email app with a message to you, already filled in. You review it and add it, so nothing goes live without your approval.

Three ways to send:

| Tab | What they do | What you get |
| --- | --- | --- |
| **Type it in** | Fill in a form (ingredients and steps one per line; numbering and bullets are cleaned up automatically) with a live preview | A readable copy of the recipe plus a ready-to-save `recipes/<id>.json` block |
| **Link to a recipe** | Paste a URL plus notes | An `inbox/<id>.json` block to save for later |
| **PDF or photo** | Add notes, then attach the file to the email | The attachment plus an `inbox/<id>.json` block |

There are also **Copy** (for texting it to you) and **Download file** buttons. The form saves a draft on their device, so a half-typed recipe survives closing the tab.

### One-time setup

Set your address in `config.js`:

```js
submitEmail: 'you@example.com',
```

It's visible in the page source, so a dedicated address or forwarding alias (e.g. `recipes@bobbyjoecool.dev`) will keep spam out of your main inbox. Until it's set, the page offers Copy/Download only.

### When a typed-in recipe arrives

1. Copy everything under the `----- For Bob: save everything below as recipes/<id>.json -----` line into a new file with that name. The id is already unique: if a recipe with that name exists, the sender's last name is appended (e.g. `banana-bread-sass`).
2. Fix anything you want to tidy up.
3. Run `python3 scripts/build.py`, commit, and push (steps 3–5 under [Adding a recipe](#adding-a-recipe)).

### When a link or PDF arrives: the inbox

Links and files go in `inbox/` until someone types them up. They're listed on the Add a recipe page under **Waiting to be typed up**, with links to open each one.

1. Save the JSON block as `inbox/<id>.json`.
2. For a PDF or photo, save the attachment into `inbox/` with the name in its `"file"` field. For a photo, use `.jpg`/`.png` and change `"file"` to match.
3. Commit and push.

When you've typed it up, add the recipe (see below) and delete its `inbox/<id>.json` and attachment in the same commit.

Note: the repo and site are public, so anything in `inbox/` is publicly viewable.

### Later: sending straight to your own server

If you set up a server, the form can POST to it instead of opening email. Only the submit handler in `add.js` changes. The submission objects it builds stay the same. A server-side version should also check a family passcode, since a public URL can receive submissions from anyone.

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
| `id` | yes | Lowercase letters, numbers and dashes. **Must match the file name** (`apple-crisp` ↔ `apple-crisp.json`). Used in share links: `recipes.bobbyjoecool.dev/#apple-crisp`. |
| `title` | yes | Shown on the card. |
| `category` | yes | One of: `Appetizers`, `Breads & Rolls`, `Soups, Salads & Veggies`, `Entrees`, `Desserts`, `Canning`, `Miscellaneous`. |
| `contributor` | yes | Who it's from, or `null`. |
| `preheatF` | yes | Oven temperature as a whole number (`350`), or `null` for no-bake. |
| `components` | yes | At least one part. Single-part recipes use one part with `"name": null`. Multi-part recipes need a `name` on every part. |
| `components[].ingredients` | yes | List of strings, one per ingredient. |
| `components[].directions` | yes | List of strings, one per step. They're numbered automatically. |
| `notes` | yes | List of tips, yield or storage info. Use `[]` for none. |
| `tags` | no | Badges shown on the recipe and filterable on the site: `"sourdough"`, `"high-protein"`. Leave it out (or `[]`) for none. |

Two recipes with the same title (e.g. two family versions of Banana Pie) just need different ids: `banana-pie.json` and `banana-pie-schwerin.json`.

## Tags (badges)

Tags are optional badges that sit next to the category, e.g. a sourdough loaf is filed under **Breads & Rolls** and tagged **Sourdough**. Each tag gets a filter chip under **Show only**. Picking more than one shows recipes that have all of them. The filter is saved in the address (`recipes.bobbyjoecool.dev/?tag=sourdough`), so you can share a link to just the sourdough recipes.

```json
"tags": ["sourdough"]
```

When creating a recipe with the script, add `--tags sourdough` (or `--tags high-protein`, or both).

To add a new tag, add it to `TAGS` in `scripts/recipe_config.py` (the key goes in recipe files, the value is the label people see) and to the `tags` enum in `recipe.schema.json`. For a custom badge color, add a `[data-tag="your-tag"]` rule in `styles.css`; otherwise it uses the plain badge color.

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
- uses a tag that isn't in `TAGS`, or lists a tag twice,
- still contains `REPLACE` placeholder text.

It also checks every `inbox/*.json`: required fields, a valid link for link items, and that the attached file actually exists in `inbox/` for file items.

Pull requests are validated too, so if family members send recipes as PRs, you'll see a red ✗ on any broken file before you merge. PRs never deploy.

## Hosting setup (one time)

The site lives on its own subdomain, `recipes.bobbyjoecool.dev`. The main domain `bobbyjoecool.dev` belongs to the Portfolio repo (through its `CNAME` file), so this setup leaves the portfolio untouched.

1. **Pages source:** in this repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Don't use "Deploy from a branch": the generated data files aren't committed, so a branch deploy shows "Couldn't load recipes (HTTP 404)".
2. **DNS:** at your domain's DNS provider, add a record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `recipes` | `bobbyjoecool.github.io` |

3. **Custom domain:** in this repo, go to **Settings → Pages → Custom domain**, enter `recipes.bobbyjoecool.dev`, and Save. Wait for the DNS check to pass, then tick **Enforce HTTPS**. `.dev` domains only load over HTTPS, so the site won't open until GitHub has issued the certificate (usually minutes, sometimes up to an hour).

Notes:

- No `CNAME` file is needed in this repo. Sites deployed with GitHub Actions take their custom domain from the Settings page and ignore a `CNAME` file.
- The repo name no longer affects the URL. Renaming it later is harmless.
- All asset paths are relative, so the site also works at `bobbyjoecool.github.io/<repo-name>/` (GitHub redirects that to the custom domain once it's set).
- Optional but recommended: verify `bobbyjoecool.dev` under your GitHub account's **Settings → Pages → Verified domains**. That stops anyone else's repo from claiming one of your subdomains if a DNS record is ever left dangling.

## Files

```
recipes/              one JSON file per recipe (edit these)
inbox/                links and PDFs/photos waiting to be typed up
recipes/_template.json  starting point for a hand-made recipe (ignored by the build)
recipe.schema.json    editor autocomplete/validation for recipe files
scripts/new_recipe.py create a new recipe file
scripts/build.py      validate + bundle (CI runs this too)
scripts/recipe_config.py  category list, tag list, and other settings
.github/workflows/deploy.yml  validate on every push/PR, deploy on main
index.html, app.js    the cookbook
add.html, add.js      the Add a recipe page
render.js             recipe rendering shared by both pages
config.js             submission email address
styles.css            styles for both pages
```

Scripts need only Python 3 (no packages to install).
