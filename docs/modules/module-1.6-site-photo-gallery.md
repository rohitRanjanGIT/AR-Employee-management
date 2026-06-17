# Module 1.6 — Site Photo Gallery

**Type:** New module. Self-contained. One new table (`site_photos`), per-site + global gallery pages, upload flow, dashboard previews.

**Depends on:** `sites`, `cities`, `users`, `employees`, `site_supervisor_assignments` (all existing). Cloudinary already wired (workers/employees photos in 1.2.5).

**Core principle:** the **site owns the photo**, not the person. `site_id` is the primary relationship; `uploaded_by` is attribution only. No approval flow — photos appear immediately. Low-stakes content; admin can hide/remove after the fact.

---

## 1. Schema — `site_photos`

```
site_photos:
  id                    uuid, primary key, default gen_random_uuid()
  site_id               uuid, fk → sites, not null
  city_id               uuid, fk → cities, not null        -- DENORMALIZED, snapshot at upload
  uploaded_by           uuid, fk → users, not null         -- attribution; admin or supervisor
  description           text, not null                      -- per-row (see §5)
  tags                  text[], not null, default '{}'      -- locked vocabulary only
  cloudinary_public_id  text, not null
  cloudinary_url        text, not null
  taken_at              timestamptz, nullable               -- from EXIF, stored UTC
  uploaded_at           timestamptz, not null, default now()
  is_hidden             boolean, not null, default false
  hidden_at             timestamptz, nullable
  hidden_by             uuid, fk → users, nullable
```

### Indexes
- `(site_id, uploaded_at desc)` — chronological per-site queries.
- `(uploaded_by)` — "my uploads."
- `(city_id)` — global gallery city filter.
- **GIN index on `tags`** — for `&&` / `@>` array operators.

### Denormalization note (`city_id`)
- Snapshotted at upload time from the site's **current** `cityId`. Consistent with the `cityId` denormalization on `attendance` and `transactions`.
- Sites don't change city in practice; this is a point-in-time copy and is not re-synced if a site's city were ever edited. That's acceptable and matches the attendance/transactions precedent.

### `uploaded_by` target
- Points at `users` — the only table holding both admins and supervisors.
- Uploader **name** is resolved via the same join path used everywhere else for actor display (`users → employees`, employee holds the name). Be consistent with the existing actor-name pattern; do not invent a new join.

---

## 2. Authorization

### Visibility
- **Admin:** all sites, plus the global gallery.
- **Supervisor:** only sites they are **currently** assigned to (`site_supervisor_assignments`). No global gallery.
- Enforce **server-side** on every gallery query and every photo action — not just by hiding nav links. A supervisor must not reach another site's photos by guessing the URL.

### Modify helper — `canModifySitePhoto(userId, photoId)`
Single helper used by **all** hide/edit actions. Returns true when:
- the user is **admin**, OR
- the user is the **uploader** (`uploaded_by === userId`) **AND** is **currently assigned** to that photo's site.

Consequence (already decided): a supervisor unassigned from a site loses the site from their view entirely and therefore loses all ability to hide/edit those photos. Control follows visibility; admin retains everything.

### Hard delete & unhide
- **Admin only.** Not exposed to supervisors at all.

---

## 3. Upload flow

### Entry points
- Gallery section / dashboard "Upload" action.
- Site dropdown filtered to the supervisor's currently-assigned sites (admin: all active sites). Pre-filled when entering from a specific site's gallery page.

### Batch rules
- **Max 10 photos per batch.** Enforced **client and server**.
- **Max 10 MB per photo.** Enforced **client and server**.
- Accept jpg, png, webp, heic.
- **One description + one tag set per batch** (v1). No per-photo captions at upload. (Rows become independently editable afterward — see §5.)

### Tags (locked vocabulary — no free-form)
`progress`, `completion`, `team`, `issue`, `materials`, `safety`, `before`, `after`.
Predefined chips only. Reject any tag outside this set server-side.

### Site-status guard
- Block new uploads when the site status is **completed or cancelled**. Existing photos on such sites remain viewable (read-only gallery). Enforce server-side.

### Processing
1. Validate count (≤10), per-file size (≤10 MB), site assignment, site status, tag vocabulary — server-side.
2. Upload to Cloudinary folder `eems/public/site-photos/`. Use `q_auto` + `f_auto`.
3. Parse EXIF server-side (see §4) → `taken_at`.
4. Snapshot the site's current `city_id` onto each row.
5. Insert one `site_photos` row per photo, all sharing the batch's description + tags at insert time.

### Partial failure — `Promise.allSettled`
- Upload the batch with `Promise.allSettled`. **Commit successes, report failures** — do not roll back successful uploads.
- Return to client: `{ succeeded: number, failed: number, failures: [{ filename, reason }, ...] }`.
- Client surfaces a summary and offers a **retry-failed** action for the failed files only.

---

## 4. EXIF / `taken_at`

- Parse **`DateTimeOriginal`** and **`OffsetTimeOriginal`**.
- If an offset is present, use it. If **no offset**, assume **Asia/Kolkata**.
- **Store as UTC** (`timestamptz`).
- If EXIF is absent or unparseable (common after messaging-app re-saves), leave `taken_at` **null**.
- Sort order everywhere: `ORDER BY COALESCE(taken_at, uploaded_at) DESC` (newest first). The "by taken date" sort option uses the same COALESCE; the default may also sort newest-first by upload — keep one consistent COALESCE-based ordering for v1.

---

## 5. Edit / hide / delete

### Edit description & tags — per-row, independent
- After upload, each row's description and tags are **independently editable**. No `batch_id` concept; the shared batch values were only the insert-time defaults.
- Gated by `canModifySitePhoto`. Tag edits still restricted to the locked vocabulary.

### Hide (soft delete) — per-row
- Sets `is_hidden = true`, `hidden_at = now()`, `hidden_by = userId`.
- Hides **only that one row**, never the whole batch.
- Gated by `canModifySitePhoto` (admin, or uploader currently assigned).

### Unhide — admin only
- Clears `is_hidden`, `hidden_at`, `hidden_by`.

### Hard delete — admin only, Cloudinary first
1. Delete the asset from Cloudinary **first**.
2. Only on Cloudinary success, delete the DB row.
3. If Cloudinary deletion **fails**, **abort and surface the error** — do **not** delete the DB row. Never orphan a visible record pointing at a missing asset.

---

## 6. Hidden-photo visibility rules

- Default gallery views, global gallery, and **all dashboard previews exclude `is_hidden = true`.**
- **Admin** gets an **"Include hidden"** toggle on gallery views to reveal hidden photos (for review/unhide/hard-delete).
- **Supervisors never see hidden photos** — not even their own. Once hidden, it's gone from their view; only admin can bring it back.

---

## 7. Pages

### Per-site gallery — `/admin/sites/[id]/gallery`, `/supervisor/sites/[id]/gallery`
- Masonry grid, responsive (1 col phone / 2 tablet / 3–4 desktop).
- Thumbnail overlay: uploader name + relative time ("2 hours ago"). **Uploader name shown regardless of the employee's active/inactive status** (historical attribution).
- Tap → lightbox: full image, description, tags as badges, uploader, exact timestamp, action menu (`canModifySitePhoto` → hide/edit; admin → hide/unhide/hard-delete).
- Filters: date range, tag, uploader. Sort: newest first (COALESCE rule).
- Supervisor access enforced server-side by current assignment.

### Global gallery — `/admin/gallery` (admin only)
- All photos across all sites, masonry.
- Filters: **site, city, date range, tag, uploader.** City filter uses the denormalized `city_id`.
- "Include hidden" toggle available here too.

### Tag filtering — OR default, AND toggle
- Default **OR**: `tags && ARRAY[...]` (photos with any selected tag).
- **"Match all selected"** toggle → **AND**: `tags @> ARRAY[...]` (photos with all selected tags).
- Backed by the GIN index on `tags`.

### Dashboard previews
- **Admin dashboard:** "Recent Site Activity" card — last **8** photos across all sites, masonry strip. Excludes hidden.
- **Supervisor dashboard:** horizontal scrollable strip — last **6** photos from currently-assigned sites + trailing "+ Upload" tile. Excludes hidden.

---

## 8. Cloudinary

- Folder: `eems/public/site-photos/`.
- Transforms: thumbnail (200×200 `c_fill`), grid (~400×400 `c_fit`), lightbox (1200px wide), original on demand. `q_auto` + `f_auto` throughout.
- Compression handled by Cloudinary; phone originals (4–8 MB) retained at full quality, display served small.

---

## 9. Explicitly out of scope (v1)
- No comments / replies / reactions.
- No free-form tags.
- No video.
- No `site_snapshots` photo reference — gallery stays queryable by `site_id` after closure; nothing captured into the snapshot.
- No audit logging of gallery actions.
- No per-photo captions at upload (rows editable individually afterward).

---

## 10. Gate checklist (manual click-through before next module)

1. [ ] `site_photos` table created with all columns, FKs, the three btree indexes, and the **GIN index on tags**.
2. [ ] Upload as supervisor to an **assigned** site → photos land in `eems/public/site-photos/`, rows inserted, `city_id` snapshotted, appear immediately.
3. [ ] Upload to an **unassigned** site blocked server-side (URL-guess attempt fails, not just hidden link).
4. [ ] Batch of 11 rejected (client and server). Single 11 MB file rejected (client and server).
5. [ ] One description + one tag set applied across a multi-photo batch on insert.
6. [ ] Partial failure path: force 2 of 5 to fail → 3 commit, response `{ succeeded:3, failed:2, failures:[...] }`, client shows retry-failed.
7. [ ] EXIF photo with offset → correct UTC `taken_at`. EXIF without offset → Asia/Kolkata assumed. No-EXIF photo → `taken_at` null, sorts by `uploaded_at`.
8. [ ] Sort uses `COALESCE(taken_at, uploaded_at) DESC` everywhere.
9. [ ] Edit description/tags per-row works for admin (any) and uploader-currently-assigned; blocked for others.
10. [ ] Tag edit rejects a value outside the locked vocabulary.
11. [ ] Hide is per-row (sibling batch photos stay visible). Gated by `canModifySitePhoto`.
12. [ ] Unassign a supervisor from a site → that site's gallery disappears from their view; they can no longer hide/edit their photos there; admin still can.
13. [ ] Hidden photo: absent from default views, global gallery, and dashboard previews. Admin "Include hidden" reveals it. Supervisor never sees it (even own).
14. [ ] Hard delete (admin): Cloudinary deleted first, then DB row. Simulate Cloudinary failure → DB row preserved, error surfaced, no orphan.
15. [ ] Global gallery (`/admin/gallery`) admin-only; supervisor cannot reach it. City filter works via denormalized `city_id`.
16. [ ] Multi-tag filter: OR by default; "Match all selected" switches to AND. Both hit the GIN index.
17. [ ] Uploader name displays for an **inactive** employee's past uploads.
18. [ ] Upload blocked when site status is completed/cancelled; existing photos still viewable read-only.
19. [ ] Admin dashboard: last 8 across all sites, hidden excluded. Supervisor dashboard: last 6 from assigned sites + "+ Upload" tile, hidden excluded.
20. [ ] Records with no `taken_at` and no photo issues render cleanly; no broken images anywhere.
