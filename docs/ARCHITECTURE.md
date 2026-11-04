# VIBES — Architecture

## 1. The core idea, as code

A `Product` never owns pixels. It points at:

- one **Textile** — the processed scan of the physical saree (plus the untouched
  original). This is the source of truth; nothing downstream repaints it.
- one **Drape configuration** — references to *shared* studio assets: drape
  style, mannequin finish, pose, lighting rig, environment.

Every presentation — hero, cards, 3D viewer, the eight stored views, admin
previews — is derived from those two references by the same code
(`src/studio/scene.ts → Studio`).

```
            ┌───────────── Digital Saree Studio (one, reused) ─────────────┐
 Textile ──▶│ textile.ts   colour + material (roughness/zari) surfaces       │
 (scan)     │ drape.ts     procedural pleats + pallu on the body envelope    │──▶ real-time 3D (R3F)
            │ body.ts      analytic mannequin = collision envelope           │──▶ render farm → stored renders
 Drape  ───▶│ scene.ts     lighting rigs, environments, cameras, fabric mat. │──▶ admin previews
 config     └────────────────────────────────────────────────────────────────┘
```

## 2. The model

Fashion sells the saree, so the saree is shown on a person. The model is a
realistic woman built from **MakeHuman's CC0 assets** — the base mesh, body
targets, skeleton and skin weights — by `scripts/build-model.ts`:

1. shape her (young adult female, ideal proportions, 1.72 m);
2. pose her through the real skeleton with linear-blend skinning — *Poised*
   (weight on one leg, the other knee soft), *At ease*, *Turn* (a quarter turn);
3. one level of Catmull–Clark subdivision for smooth, believable surfaces;
4. tailor a blouse from her own surface (cropped choli, scooped neckline,
   sleeves above the elbow — seams, darts and a turned hem are drawn in its
   shader) and sleek hair drawn into a low chignon;
5. measure her (a radial body profile) so the drape is cut to her body.

Output: `public/model/{pose}.bin` (≈1.5 MB each). Rebuilding needs a MakeHuman
checkout: `MH_ROOT=… npx tsx scripts/build-model.ts`.

Presentation follows luxury fashion photography: a long lens (≈16° vertical
field of view), framed from the jaw to the floor — the semi-anonymous crop of
fashion e-commerce — on a seamless paper sweep, lit by large soft area lights.
The face is deliberately out of frame: an untextured digital face would pull
attention from the saree and toward the technology.

## 3. Digital draping engine (`src/studio`)

| File | Responsibility |
|---|---|
| `human.ts`, `model.ts`, `modelFormat.ts` | Loading and dressing the model: skin (warm, with light that stays warm in shadow), the tailored raw-silk blouse, hair. Three skin tones. |
| `cloth.ts` | A position-based cloth solver: distance constraints with separate stretch / compression stiffness (cloth barely stretches, gathers easily), bending, long-range tethers, and Coulomb-style friction against the body. No DOM, no three.js. |
| `collider.ts` | What the cloth collides with: a signed distance field of her body (6 mm grid, built from the model mesh — shoulders, bust, hips, arms, hands, feet), the floor, and a radius map of the finished skirt so the pallu lies on it. |
| `drapeBake.ts` | Builds and simulates a drape. The skirt is a straight rectangle of fabric (≈1 m, just over hip girth) tucked into a shorter waistline, so it gathers at the tuck, skims hips and seat and falls under gravity; below the hips it may only fold, never shrink. Seven hand-made pleats of slightly different depth are pressed into a crease memory, tight at the tuck and fanning toward a hem that pools on the feet. The pallu is pinned only where a real one is — the waist, a brooch on the shoulder, and (Seedha) the left waist — and settles snug across the bust and down the shoulder blade. Ambient occlusion for fold valleys and contact is baked in. |
| `drape.ts` | `DrapeRig` plays a baked drape: the drape-in animation, a one-sided pallu sway (always away from the body, so it needs no runtime collision) and the woven transition all start from the simulated cloth. Textiles are mapped at true physical scale along the 5.5 m saree. |
| `drapes.ts`, `public/drapes/*.bin` | Nine bakes (3 drape styles × 3 poses of the model, ~117 KB each, quantised). A bake never depends on the textile, so nine files serve every saree. Rebuild with `npm run bake` (≈30 s each) after rebuilding the model. |
| `textile.ts` | Builds the two surfaces the material needs: colour, and a material mask (G = roughness, B = metalness for zari). For scans the photo is used as-is; only the mask is derived (gold-thread detection). |
| `scan.ts` | Textile processing on upload: background separation → crop → orient (length horizontal, pallu at the end, rotating rather than mirroring when possible) → border and pallu detection → k-means dominant colours → zari coverage → pattern estimate. Every detection can be overridden by the admin. |
| `scene.ts` | `Studio`: the reusable scene — the model, the drape (with a back face for cloth thickness and a petticoat beneath), area-light softboxes, a softbox reflection environment, a shadow-catching floor, editorial cameras. `FabricMaterial` extends `MeshPhysicalMaterial` with sheen, a woven normal map, baked AO via vertex colour, and a shader-level *woven transition*. Tone mapping is Khronos PBR Neutral for colour fidelity. |
| `renderFarm.ts` | One hidden renderer + one `Studio` producing stills of any saree from any camera, queued and cached. Waits for the drape bake before rendering. |
| `registry.ts` | Shared cache of decoded textiles and GPU textures, and device-quality selection. |

**Why bake rather than simulate live?** A 5.5 m silk simulation takes tens of
seconds and is not perfectly repeatable; baking once per style × pose gives
identical, physically settled cloth on every device at 60 fps. Self-collision
is not simulated; the two places it matters (the inner wrap under the pleats,
and fold order within the pleats) are handled by a layer constraint and a
pressed-crease memory.

**Hybrid presentation.** The product page is real-time 3D; cards, search and
the archive use stored or cached renders. Without WebGL every image falls back
to the flat textile itself (folded-stack presentation).

## 4. Application

- **Next.js 15 (App Router)** — storefront pages are server components reading
  the repository directly; interactive pieces are client components.
- **React Three Fiber** for the real-time studio; plain Three.js for the render
  farm (same `Studio` class).
- **Repository** — `src/server/db.ts` exposes `read()` / `mutate()` over a JSON
  document so the prototype runs with zero infrastructure. `prisma/schema.prisma`
  is the PostgreSQL model; replacing `db.ts` with a Prisma implementation does
  not change any page or route.
- **Object storage** — `src/server/storage.ts` (`putObject` / `getObject`),
  content-addressed keys (`scans/`, `originals/`, `renders/`, `portraits/`),
  immutable cache headers. Swap the local driver for S3 / R2 / GCS.
- **Auth** — HMAC-signed session cookie (Web Crypto, works in middleware and
  routes); `middleware.ts` guards `/admin` and `/api/admin`. Roles: owner ›
  manager › staff, enforced per route (`requireRole`).
- **Inventory** — `src/server/inventory.ts`: checkout *reserves*, payment
  *commits* (a one-of-one goes to **sold** and stays visible in the archive),
  cancellation *releases*. Prices and stock are always re-read on the server.
- **Search** — `src/lib/search.ts` parses natural language
  (“red sarees from Bengal under ₹50,000”) into structured filters and shows
  them back as removable chips, so search never silently guesses.
- **Assistant** — `src/lib/assist.ts` suggests colour names, description,
  tags, occasions, collections and SEO from the scan analysis. Suggestions are
  never applied without a click. An LLM can replace it behind
  `/api/admin/assist` under the same rule.

## 5. Independent evolution

| Subsystem | Contract | Can change without touching |
|---|---|---|
| Storefront | `ProductView` (`src/lib/view.ts`) | admin, pipeline |
| Admin | `/api/admin/*` | storefront |
| Draping pipeline | `Studio`, `DrapeRig`, `render()` | pages (they only pass a textile + drape config) |
| Storage / DB | `read`/`mutate`, `putObject`/`getObject` | everything above |

## 6. Performance

- Textures generated/decoded once per quality tier and shared across canvases.
- Device-aware quality: draft textures and lower DPR on small or low-memory
  devices; shadows only at “high”.
- Canvases pause (`frameloop="never"`) when scrolled out of view.
- Renders are queued in idle time and cached; stored renders are served with
  immutable caching.
- 3D bundles load lazily (`next/dynamic`, dynamic `import()` of the render farm).
- No WebGL → flat-textile fallback; `prefers-reduced-motion` respected.

## 7. Production checklist

1. Implement `db.ts` with Prisma against PostgreSQL; run migrations from `prisma/schema.prisma`.
2. Replace `storage.ts` with an S3/R2 driver; serve media through a CDN.
3. Set `VIBES_SESSION_SECRET`; move users to a proper identity provider if needed.
4. Wire Razorpay/Stripe: replace `/api/orders/[id]/pay` with a signature-verified webhook; add reservation expiry (cron) to release unpaid holds.
5. Run the render farm headless on publish to store all eight views (the admin “Generate” step already does this from the browser).
6. Optionally plug an LLM into `/api/admin/assist` and a vision model into `scan.ts` segmentation — always as suggestions with admin review.
