# Gallery Module — Design & Implementation Spec

Use this document to replicate the look, feel, and structure of the EMS Gallery module in another project. It covers visual design tokens, layout, component breakdown, data model, and UX behavior so it can be rebuilt independently of this codebase's specific stack.

---

## 1. Tech Stack This Was Built With

- **Framework:** Next.js (App Router), Server Components + Client Components split
- **Styling:** Tailwind CSS v4 + shadcn/ui (built on `@base-ui/react` primitives)
- **Icons:** lucide-react
- **Images:** `next/image` with `fill` + `object-cover`, served from Cloudinary
- **Data fetching:** Server-side queries on the page, React Query (`@tanstack/react-query`) for dashboard widgets
- **DB:** PostgreSQL via Drizzle ORM

None of this is required to replicate the *design* — swap in whatever stack the new project uses. The important parts are the visual tokens and structural patterns below.

---

## 2. Design Tokens

### Color palette (light mode, OKLCH)

```css
--background: oklch(0.97 0.013 80);       /* warm off-white/beige page bg */
--card: oklch(0.995 0.005 80);             /* near-white card surface */
--card-foreground: oklch(0.145 0 0);
--primary: oklch(0.52 0.22 27.3);          /* red — primary actions, hover accents */
--primary-foreground: oklch(0.985 0 0);
--secondary: oklch(0.93 0.04 250);         /* light blue */
--secondary-foreground: oklch(0.25 0.12 250);
--muted: oklch(0.94 0.01 80);              /* warm neutral, used as image placeholder bg */
--muted-foreground: oklch(0.50 0 0);       /* secondary text, icons */
--destructive: oklch(0.577 0.245 27.325);  /* delete actions */
--border: oklch(0.90 0.01 80);
--radius: 0.625rem;                        /* base radius; derive sm/md/lg/xl/2xl by scaling */
```

Dark mode equivalents (same hues, adjusted lightness):
```css
--background: oklch(0.16 0.01 260);
--card: oklch(0.21 0.01 260);
--primary: oklch(0.60 0.22 27.3);
--secondary: oklch(0.25 0.05 250);
--muted: oklch(0.26 0.01 260);
--border: oklch(1 0 0 / 10%);
```

Radius scale derived from `--radius`:
```
--radius-sm: calc(var(--radius) * 0.6)
--radius-md: calc(var(--radius) * 0.8)
--radius-lg: var(--radius)
--radius-xl: calc(var(--radius) * 1.4)
```

### Tag/category badge colors (hardcoded, not theme tokens)

Each gallery item has an optional category tag, rendered as a small pill badge with a fixed color per category — this gives the grid quick visual scannability:

```js
const TAG_COLORS = {
  site:     "bg-blue-500/80",
  material: "bg-orange-500/80",
  team:     "bg-green-500/80",
  process:  "bg-purple-500/80",
  brochure: "bg-pink-500/80",
};
const TAG_LABELS = {
  site: "Site", material: "Material", team: "Team",
  process: "Process", brochure: "Brochure",
};
```
Unrecognized/null tags fall back to `bg-gray-500/80`.

---

## 3. Layout & Grid

**Main gallery grid** (the core visual pattern):

```html
<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
  <!-- image cards -->
</div>
```
- 2 columns on mobile → 3 on tablet (`sm`) → 4 on desktop (`lg`)
- `gap-4` (1rem) between cells
- Each cell is a perfect square: `aspect-square overflow-hidden rounded-lg border bg-muted`

**Dashboard preview variants:**
- Admin dashboard widget: dense `grid-cols-4 gap-1.5` with small 80px thumbnails (a "recent uploads" teaser, links out to full gallery)
- Supervisor dashboard widget: horizontal scroll strip (`ScrollArea` + `ScrollBar`) of 80px square thumbnails, `shrink-0` so they don't squish — good when space is constrained to a sidebar/card

**Toolbar above the grid:**
```html
<div class="flex flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <!-- filter selects -->
    <!-- "Clear filters" ghost button, only rendered when a filter is active -->
  </div>
  <div class="flex items-center gap-2">
    <p class="text-sm text-muted-foreground">{count} images</p>
    <!-- Upload button -->
  </div>
</div>
```

---

## 4. Image Card Anatomy

This is the single most important reusable piece. Each grid cell is a relatively-positioned square with layered absolutely-positioned overlays that fade in on hover:

```html
<div class="group relative aspect-square overflow-hidden rounded-lg border bg-muted">

  <!-- 1. The image itself, fills the square, fill+object-cover -->
  <img class="object-cover transition-transform duration-200 group-hover:scale-105" />

  <!-- 2. Tag badge, top-left, always visible -->
  <div class="absolute left-2 top-2 max-w-[70%]">
    <span class="inline-block truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white {tagColor}">
      {TagLabel} {tag === 'site' ? `· ${siteName}` : ''}
    </span>
  </div>

  <!-- 3. Action buttons (edit/delete), top-right, hidden until hover -->
  <div class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
    <button class="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-primary">
      <PencilIcon class="size-3.5" />
    </button>
    <button class="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600">
      <TrashIcon class="size-3.5" />
    </button>
  </div>

  <!-- 4. Bottom info bar, gradient overlay, hidden until hover -->
  <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
    <p class="truncate text-xs font-medium text-white">{uploaderName}</p>
    <p class="text-xs text-white/70">{date}</p>
  </div>

</div>
```

Key interaction details:
- The whole card is `group` so children can react to `group-hover`.
- Image scales to `105%` on hover (`group-hover:scale-105`) — subtle zoom, 200ms.
- Action buttons and the bottom info bar are both `opacity-0` → `opacity-100` on hover, not always visible — keeps the grid clean until the user engages.
- Action button circles are `size-7`, semi-transparent black (`bg-black/60`), turning to `primary` (edit) or `red-600` (delete) on their own hover.
- A version of this card with no action buttons and no uploader name (just date) is used for the "view-only" role (e.g. a supervisor viewing their own uploads needs less chrome than an admin moderating everyone's).

---

## 5. Filters

Simple controlled `<select>`-style dropdowns (shadcn `Select`), each rendered as a trigger that shows a label + current value inline:

```html
<Select>
  <SelectTrigger class="w-36">
    <span class="text-sm">
      <span class="text-muted-foreground">Tag: </span>{currentValueLabel}
    </span>
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All tags</SelectItem>
    ...per-tag items...
  </SelectContent>
</Select>
```

Pattern used: 3 independent filters (tag, site, uploader for the admin/moderator view; just tag for the restricted/own-uploads view), each defaulting to `"all"`, combined with AND logic client-side via a `useMemo` filter over the full image list (no server round-trip — fine for moderate dataset sizes). A "Clear filters" button only renders when at least one filter is non-default.

---

## 6. Empty State

```html
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <ImagesIcon class="size-10 text-muted-foreground/40" />
  <p class="text-sm font-medium text-muted-foreground">
    {hasNoImagesAtAll ? "No images uploaded yet." : "No images match the current filters."}
  </p>
</div>
```
Two distinct messages depending on whether the *dataset* is empty vs. the *filtered view* is empty — don't conflate them.

---

## 7. Upload Dialog

A modal (shadcn `Dialog`, `sm:max-w-md`) containing:
1. A clickable dashed dropzone-style box:
   ```html
   <div class="cursor-pointer rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-center hover:border-muted-foreground/50">
     <UploadCloudIcon />
     <p>Click to select an image</p>
     <p class="text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
   </div>
   <input type="file" class="sr-only" />
   ```
2. Once a file is chosen, swap the dropzone for an inline preview: `max-h-48 rounded object-contain`.
3. A tag `<Select>` (one of the fixed categories, or none).
4. A conditional site/sub-category `<Select>` that only appears when the chosen tag requires it (e.g. tag === "site").
5. Submit button shows a spinner (`Loader2` rotating icon) + "Uploading..." label while in flight; inline error text renders above the actions if the upload fails.

## 8. Edit Dialog

Smaller modal (`sm:max-w-sm`) to retroactively change an image's tag/category and conditional sub-field, with Cancel + Save (spinner while saving), same inline error pattern as upload.

---

## 9. Data Model

```ts
type GalleryImage = {
  id: string;
  url: string;                 // public CDN URL
  publicId: string;            // storage provider's internal id (for delete)
  folder: "public" | "aadhar"; // or whatever access-tier buckets you need
  tag?: "site" | "material" | "team" | "process" | "brochure" | null;
  siteId?: string | null;      // present only when tag needs a sub-entity link
  siteName?: string | null;    // denormalized/joined for display
  uploadedAt: Date;
  uploadedById: string;
  uploadedByName?: string;     // only exposed to the moderator/admin role
};
```

Two role-scoped projections of the same table:
- **Full/admin view**: includes `uploadedByName`, can filter by uploader, can edit/delete any image.
- **Restricted/owner view**: same shape minus `uploadedByName`; query is scoped `WHERE uploadedById = currentUser`; no edit/delete controls rendered, no uploader filter.

---

## 10. Role-Based Behavior Summary

| Capability | Admin/Moderator view | Owner/Restricted view |
|---|---|---|
| Sees images from | everyone | only self |
| Filters | tag + site + uploader | tag only |
| Upload | yes | yes |
| Edit tag | yes (hover pencil icon) | no |
| Delete | yes (hover trash icon, `confirm()` before delete) | no |
| Card hover info | uploader name + date | date only |

---

## 11. Dashboard Widget Variants

Two condensed previews exist outside the full gallery page, both fetched client-side with a data-fetching/caching layer (React Query) so they refresh without a full page reload:

- **Dense grid teaser** (`grid-cols-4 gap-1.5`, small thumbnails, tooltip with uploader + relative time on hover, "View all" link to the full gallery page). Shows a skeleton grid of the same shape while loading.
- **Horizontal scroll strip** (fixed-size square thumbnails, `shrink-0`, wrapped in a horizontally scrollable container) — better suited to a narrow dashboard card.

Both widgets render `null`/nothing if there's no data, rather than showing an empty-state message — that messaging is reserved for the full gallery page.

---

## 12. Reusable Primitives Needed

To replicate this, you need (or equivalent of):
- `Button`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`, `Dialog`, `Label`, `Card`, `Skeleton`, `Tooltip`, `ScrollArea` — i.e. a basic shadcn/ui-style component set.
- An icon set with: image-stack/gallery icon, trash, pencil, upload-cloud, spinner/loader.
- A toast/alert mechanism for delete confirmation (here it's a plain `window.confirm()` — acceptable for a v1, swap for a proper confirm dialog if polish matters more).

---

## 13. Things to Carry Over Deliberately

- **Square aspect-ratio grid cells** — keeps the layout predictable regardless of source image dimensions; crop via `object-cover`.
- **Hover-reveal chrome** — actions and metadata are invisible until hover/focus, keeping the default grid visually quiet.
- **Color-coded category badges** that are always visible (unlike the rest of the overlay) so the grid is scannable without hovering anything.
- **Two-tier role projection of the same component** rather than one component with a dozen conditional flags — the admin and restricted views are separate (but near-identical) client components sharing the same card markup pattern. Consider extracting the card itself as a shared component parameterized by `showActions`/`showUploader` if rebuilding from scratch.
