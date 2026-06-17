# Module 1.2.5 — Profile Photos, Bank Details & DOB

**Type:** Schema amendment to existing Workers (1.2) and Supervisors (1.1.5) modules.
**Scope:** Add profile photos, optional bank details, and replace `age` with `dateOfBirth` (displaying computed age). Touches the `workers` and `employees` tables and their respective create/edit forms, list pages, and detail pages.

This is a surgical amendment — do **not** rebuild the modules. Add the new fields, wire the new flows, leave everything else untouched.

---

## 1. Schema changes

### 1.1 `workers` table

**Remove:**
- `age` (integer) — drop the column entirely.

**Add:**
- `dateOfBirth` — `date`, nullable. Leave blank for all existing and new records for now (no back-fill).
- `accountNumber` — `text`, nullable. Plaintext (NOT encrypted).
- `ifscCode` — `text`, nullable. Plaintext.
- `photoCloudinaryPublicId` — `text`, nullable.
- `photoCloudinaryUrl` — `text`, nullable.

### 1.2 `employees` table (supervisors)

**Add:**
- `dateOfBirth` — `date`, nullable.
- `accountNumber` — `text`, nullable. Plaintext.
- `ifscCode` — `text`, nullable. Plaintext.
- `photoCloudinaryPublicId` — `text`, nullable.
- `photoCloudinaryUrl` — `text`, nullable.

### 1.3 Migration notes

- Existing `workers` rows have `age` but no `dateOfBirth`. The `age` column is dropped; `dateOfBirth` is added as nullable and left NULL on all existing rows. No attempt to back-fill DOB from age.
- Generate the Drizzle migration, review the generated SQL, then apply. The `age` drop is destructive — confirm there is no other code reading `workers.age` before dropping (search the codebase for `.age` references on the worker entity and remove/replace them with computed age).

---

## 2. Computed age (display only)

Age is **never stored**. It is derived from `dateOfBirth` at render time.

Add a shared helper, e.g. `lib/utils/age.ts`:

```ts
export function computeAge(dob: Date | string | null): string {
  if (!dob) return "-";
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  if (isNaN(birth.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : "-";
}
```

**Display rule:** when `dateOfBirth` is null, show `-` (a single dash). Since all DOBs are blank for now, every age cell will show `-` initially — this is expected and correct.

Use `computeAge` everywhere age is displayed:
- `/workers` list page — Age column.
- `/supervisors` list page — Age column.
- Worker detail page.
- Supervisor detail page.

Do **not** add a DOB column to the list pages — list pages show **age**, not DOB. The DOB itself is editable in the create/edit form and visible on the detail page.

---

## 3. Bank details — visibility rules

`accountNumber` and `ifscCode` are plaintext, optional, and **admin-only**.

- **NOT shown** on `/workers` or `/supervisors` list pages — no column, not in any tooltip or expandable row.
- Shown **only** inside the individual worker/supervisor detail (info) section.
- The bank block on the detail page is **conditionally rendered by role**: admins see it, supervisors do not. This is one detail page with a role-gated block — not a separate page.
  - Server-side: when the viewer is a supervisor, do not include `accountNumber` / `ifscCode` in the data sent to the client at all (don't just hide it in the UI — omit it from the payload so it never reaches a non-admin browser).
  - Client-side: render the bank block only when role === admin.
- Both fields are editable by admin in the create/edit forms. Supervisors creating/editing a worker do not see these fields.

**Display when empty:** if `accountNumber` or `ifscCode` is null, show `-` in the bank block (admin view).

---

## 4. Profile photos

One optional photo per worker and per supervisor.

### 4.1 Cloudinary folders
- Worker photos → `eems/public/worker-photos/`
- Employee (supervisor) photos → `eems/public/employee-photos/`

### 4.2 Upload flow
- Add a photo upload control to the worker create/edit form and the supervisor create/edit form.
- Single image, optional. Accept standard image types (jpg, png, webp, heic). Reasonable client-side size guard before upload.
- On upload, send to Cloudinary into the correct folder. Cloudinary returns `public_id` and `secure_url` → store in `photoCloudinaryPublicId` and `photoCloudinaryUrl`.
- Use Cloudinary `q_auto` + `f_auto` for delivery. A square crop transform (e.g. 200×200 `c_fill`) is fine for avatars.
- Replacing a photo: upload new one, then delete the old `public_id` from Cloudinary (don't orphan it).
- Removing a photo: clear both columns and delete the `public_id` from Cloudinary.

### 4.3 Display
- **List pages:** small circular avatar thumbnail next to the name. When no photo, show a neutral placeholder (initials or a generic avatar icon).
- **Detail pages:** larger avatar at the top of the info section, same placeholder fallback when null.
- Permissions follow existing module visibility — supervisors who can already see a worker can see that worker's avatar. The avatar is not sensitive (unlike bank details).

---

## 5. Form changes summary

**Worker create/edit form gains:**
- `dateOfBirth` — date picker, optional.
- Profile photo — upload control, optional.
- `accountNumber` — text, optional, **admin-only field** (not rendered for supervisors).
- `ifscCode` — text, optional, **admin-only field**.

Remove the `age` input from the worker form entirely.

**Supervisor create/edit form gains:**
- `dateOfBirth` — date picker, optional.
- Profile photo — upload control, optional.
- `accountNumber` — text, optional, admin-only.
- `ifscCode` — text, optional, admin-only.

Update the Zod schemas and react-hook-form definitions accordingly. All four new fields are optional in validation. `ifscCode` may get a light format check (4 letters + 0 + 6 alphanumerics) but keep it non-blocking / optional — do not reject submission when empty.

---

## 6. Gate checklist (manual click-through before next module)

1. [ ] Drizzle migration generated, SQL reviewed, applied cleanly. `age` column gone from `workers`; new columns present on both `workers` and `employees`.
2. [ ] No remaining code references `workers.age`; all age displays use `computeAge`.
3. [ ] `/workers` list shows an **Age** column computing from DOB; shows `-` for null DOB (all rows currently).
4. [ ] `/supervisors` list shows an **Age** column, same behavior.
5. [ ] Worker detail page shows computed age and (admin only) the bank block.
6. [ ] Supervisor detail page shows computed age and (admin only) the bank block.
7. [ ] Logged in as a **supervisor**: bank details appear **nowhere** — not in list, not in detail, not in the network payload (verify in devtools that `accountNumber`/`ifscCode` are absent from the response).
8. [ ] Logged in as **admin**: bank block visible on detail pages; editable in forms; shows `-` when empty.
9. [ ] Worker photo: upload works → lands in `eems/public/worker-photos/` → avatar shows on list + detail.
10. [ ] Supervisor photo: upload works → lands in `eems/public/employee-photos/` → avatar shows on list + detail.
11. [ ] Replace a photo → old Cloudinary asset deleted, new one shows. Remove a photo → columns cleared, asset deleted, placeholder shows.
12. [ ] Records with no photo show the placeholder avatar everywhere, no broken images.
13. [ ] All four new fields are optional — a worker/supervisor can be created with none of them set.

---

## 7. Out of scope (do not build here)
- Site Photo Gallery — separate module, built later.
- Any encryption of bank details — explicitly plaintext.
- Any reveal/audit logging for bank details — none needed (not encrypted, simple role gate).
- DOB back-fill — left null intentionally.
