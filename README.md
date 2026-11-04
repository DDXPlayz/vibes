# VIBES — Love your legacy.

A luxury handloom saree house built around one idea:

> **One saree scan → one digital asset → infinite digital presentations.**

A store employee photographs a saree once, lays in a few details, and the
platform drapes it on a reusable 3D mannequin, lights it, renders every view
and publishes a complete product page — in minutes, with no photoshoot.

```
SAREE SCAN → TEXTILE PROCESSING → TEXTURE / MATERIAL → DRAPE → MANNEQUIN → LIGHTING → CAMERA → RENDERS
```

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

- **Storefront** — `/`
- **Studio (admin)** — `/admin`
  - `owner@vibes.in` / `loveyourlegacy` (everything)
  - `manager@vibes.in` / `manager-demo` (products, content, studio, delete)
  - `staff@vibes.in` / `staff-demo` (add & edit sarees, inventory, orders)

The saree is shown on a realistic model built from MakeHuman's CC0 body
(`public/model/*.bin`, rebuilt by `scripts/build-model.ts`), and the draped cloth
is pre-simulated on her: `npm run bake` regenerates `public/drapes/*.bin`
(nine style × pose bakes, ~30 s each) after changing the model or drape code.

Data lives in `.data/` (created on first run, git-ignored). Reset it any time
from **Studio → Settings → Reset sample data**.

Try the core flow: **Studio → Add a saree → “Try a sample photograph”**. The
sample is a synthetic phone photo of a saree lying on a cutting table; the
pipeline really finds the cloth, rotates it, finds the borders and pallu,
measures colour and zari, then drapes, renders and publishes it.

Environment variables (all optional in development):

| Variable | Purpose |
|---|---|
| `VIBES_SESSION_SECRET` | HMAC key for admin sessions — **set in production** |
| `VIBES_OWNER_PASSWORD` | Owner password used when seeding |
| `VIBES_DATA_DIR` | Where the file store and media live (default `.data`) |

## What is built

| Area | Where |
|---|---|
| Design system (tokens, type, controls, motion, both themes) | `src/app/globals.css`, `/design-system` |
| Digital Saree Studio — mannequin, drape engine, lighting, cameras | `src/studio/` |
| Hero: mannequin drapes, turns, then weaves into the next saree | `src/components/store/home/Hero.tsx` |
| Homepage editorial journey (idea scroll-story, gallery hang, craft, draping timeline, collection stories, legacy) | `src/app/(store)/page.tsx` |
| Collection: natural-language search, filters, Grid / Editorial / 3D room | `/collection` |
| Product page: real-time 3D viewer, 8 camera views, 4 lighting rigs, textile inspector with loupe | `/saree/[slug]` |
| Wishlist (“Your collection”), bag, checkout with server-side reservation | `/wishlist`, `/bag`, `/checkout` |
| Artisans, collection stories, craft | `/artisans`, `/collections/[slug]`, `/craft` |
| Admin: dashboard, products, add-product workflow, editor, inventory, collections, orders, customers, artisans, Digital Studio, content CMS, analytics, settings | `/admin/*` |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit and
what to change for production.
