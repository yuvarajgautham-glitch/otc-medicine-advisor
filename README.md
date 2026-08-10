# OTC Medicine Advisor

Search over-the-counter medicines sold in US pharmacies by describing how you feel — and get
told to see a doctor when that's the real answer.

Built with [Astro](https://astro.build). Every page is static HTML; search runs in the browser,
so nothing anyone types is ever sent to a server.

## Running it

```bash
npm install
npm run dev      # http://localhost:4322/otc-medicine-advisor
```

The URL carries the repo name because the site is published to GitHub Pages, which serves a
project from a subfolder. `base` in `astro.config.mjs` sets it, and the dev server mirrors it so
local and live behave identically. **Rename the repo and you must change `REPO` in
`astro.config.mjs` to match**, or every published link will 404.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
Because the monthly data refresh commits to `main`, a refresh reaches the live site on its own.

Enable it once: **repo → Settings → Pages → Source → GitHub Actions**.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run data` | Re-fetch the catalog from openFDA (uses the local cache) |
| `npm run data:fresh` | Re-fetch, ignoring the cache |
| `npm run data:check` | Report how old the catalog is; pull only if over 30 days |
| `npm run data:now` | Pull from the FDA immediately, whatever its age |
| `npm test` | Search-quality and red-flag checks (no browser needed) |
| `npm run test:browser` | End-to-end UI test, drives Microsoft Edge |
| `npm run rank "sore throat"` | Show why a query ranks the way it does |

## How it works

### Data

The catalog is built from the FDA's [openFDA drug label API](https://open.fda.gov/apis/drug/label/)
by `scripts/fetch-openfda.mjs`. It asks openFDA which active ingredients are most widely marketed,
then pulls the best-documented label for each — so you get one good "Ibuprofen" entry instead of
400 near-identical supermarket own-brands.

Excluded on purpose:

- **Cosmetics and hygiene.** The FDA classes sunscreen, toothpaste, antiperspirant and hand
  sanitiser as OTC drugs. Nobody searching "my head hurts" needs them.
- **Homeopathic products.** They are FDA-registered as OTC drugs, but listing a 30C dilution
  beside ibuprofen would imply an equivalence that does not exist.
- **Marketing names.** Some manufacturers file "Cough Drops Cherry" in the *generic name* field.

Output lands in `src/data/medicines.json` (full detail, used to build pages) and
`public/search-index.json` (slim, fetched by the browser on first interaction).

Responses are cached under `.cache/openfda/`, so re-runs stay well inside the API's anonymous
limit of 1000 requests/day.

### Search

Two layers, because drug labels are legal documents — they say "temporarily relieves nasal
congestion", not "unblocks your nose":

1. **`src/data/taxonomy.mjs`** — a symptom taxonomy. Each symptom lists the everyday phrases
   people type (`"stuffy nose"`, `"blocked up"`) *and* the label terminology to match against.
2. **`src/lib/search.mjs`** — query understanding and ranking. Whole-word matching with light
   stemming, a popularity prior, and a penalty for combination products when you only asked
   about one thing.

At build time each medicine is tagged with the symptoms its label says it treats, pooled across
every label for that ingredient.

### Tailoring filters

The "Anything else to know?" section narrows results by age, form and drowsiness. These run on
fields parsed from the label text at build time, not on guesswork:

- **Age** — `minAgeYears` is parsed from directions and restrictions. Explicit permissions
  ("children 12 years and over") are trusted first; failing that, restrictions ("do not use under
  6 years") are read at their most restrictive. Selecting an age tests the *bottom* of the band,
  and medicines whose label states no age at all are **excluded** — "the label doesn't say" is not
  the same as "it's fine for a toddler".
- **Form** — grouped from openFDA's `route` values.
- **Non-drowsy** — excludes labels carrying a drowsiness warning.

## Keeping the catalog current

Two mechanisms, so it stays fresh whether or not the project is deployed.

**On launch.** `npm run dev` and `npm run build` run `scripts/ensure-fresh.mjs` first (via npm's
`predev`/`prebuild` hooks). It reads the timestamp in `src/data/meta.json` and re-pulls from the
FDA only if the catalog is **more than 30 days old**. On any ordinary day it prints one line and
gets out of the way; roughly once a month it spends a few minutes pulling fresh labels.

A failed pull is not fatal — being offline shouldn't stop you launching the site, so it warns and
carries on with the data already on disk.

```bash
npm run data:check    # report how old the catalog is
npm run data:now      # pull now regardless of age
SKIP_DATA_REFRESH=1 npm run dev   # launch immediately, never pull
node scripts/ensure-fresh.mjs --dry-run   # show the decision without fetching
```

**On a schedule.** `.github/workflows/refresh-data.yml` runs the same pull on the 1st of each
month once the project is on GitHub with Actions enabled. It runs the tests and a build before
committing, so a bad fetch fails the job instead of shipping.

Either way the fetch stamps `src/data/meta.json`, and the About page prints it as
*"Last pulled from FDA — 8/7/2026 at 4:59 PM"*. Nothing needs editing by hand.

If a deployed copy is never rebuilt, its timestamp would quietly age — so the About page also
flags itself as overdue in the browser once the stamp passes 30 days.

### Safety routing

**`src/data/red-flags.mjs`** is written by hand and always wins. If a search matches an
`emergency` pattern — chest pain, stroke signs, trouble breathing, self-harm — the medicine
results are suppressed entirely and a referral is shown instead. `urgent` patterns (pregnancy,
suspected infection, symptoms lasting weeks) show a warning alongside results.

Patterns deliberately over-match. A false "see a doctor" is a minor annoyance; a false
"here's some ibuprofen" is not.

## Project layout

```text
scripts/
  fetch-openfda.mjs    build the catalog from the FDA API
  smoke-test.mjs       search quality + red-flag coverage
  browser-test.mjs     end-to-end UI test
  debug-rank.mjs       explain a query's ranking
src/
  data/
    taxonomy.mjs       symptoms, everyday phrasing, label terminology
    red-flags.mjs      when to refuse to suggest a medicine
    faq.mjs            general safety questions
    medicines.json     generated catalog
    meta.json          generated - last refresh date, catalog size
  lib/
    search.mjs         query matching, ranking, age/form filters
    format.mjs         label text presentation
  pages/
    index.astro        search + tailoring filters (Home)
    browse.astro       A–Z medicine catalog
    medicine/[slug]    one page per medicine
    safety.astro       Safety FAQ hub
    safety/
      how-to-use.astro             general questions
      is-this-an-emergency.astro   from red-flags.mjs (emergency)
      do-i-need-a-doctor.astro     from red-flags.mjs (urgent)
    about.astro        data provenance and limitations
    contact.astro      feedback address
```

## Limitations

- **One label per ingredient.** Strengths and formulations vary between products; the box in
  someone's hand is authoritative, not this site.
- **United States only.** Availability and brand names differ elsewhere.
- **No interaction checking.** The site doesn't know what else someone takes.
- **Matching is by wording, not diagnosis.** It cannot tell heartburn from something cardiac.

Not affiliated with or endorsed by the FDA. Retailer links are plain searches with no affiliate
tracking.
