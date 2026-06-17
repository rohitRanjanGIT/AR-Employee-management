TO-DO:

also mark the time when the attendanece is bein marked, so that when the attendance is marked late the admin can view when the attendance was marked
login with only the id without @anuranjan.com check @CLAUDE.md for more context.
give option to archive a worker, if a worker is archived, 

DONE:
- Edit supervisor loads original data — confirmed EditSupervisorDialog uses react-hook-form `values` prop so all fields (name, phone, join date, salary, home city) pre-fill from the selected supervisor; removed leftover dead no-op code
- Work type table shows associated site count instead of created-at — getAllWorkTypes() now aggregates site_work_types counts; WorkTypesClient column reads "Associated Sites" ("N sites" / "Not in use")
- Supervisor workers table shows Contact (phone) instead of Aadhaar column
- OT rates display condensed — supervisor workers OT summary now renders "₹205/₹500/₹1,000" (dropped the 2h/4h/6h prefixes and spaces)
- Redesigned admin/attendance — new 3-tab layout (Overview | Records | Edit Requests). Overview (AttendanceOverview.tsx) has a per-day date navigator, 6 KPI cards (Marked, Full, Half, OT, Sites Active, Cities Active), a city-wise table (with coverage % vs active worker headcount) and a site-wise table that lists every active site (flags unmarked ones) with a "View records" drill-down that jumps to the Records tab pre-filtered by site+date. Records tab gained a date filter. page.tsx now computes per-city active-worker counts.
- Clubbed Cities, Sites and Work Types under a collapsible "Site Management" group in the admin sidebar (AppSidebar now supports nav groups; mobile flattens groups to chips)
- Sidebar is collapsible — desktop rail toggles between full (w-64) and icon-only (w-16), state persisted in localStorage; collapsed group icons expand the rail and open the group on click

PREVIOUSLY DONE:
- CRUD in work type — Edit (rename) and Delete (blocked if in use) added to WorkTypesClient.tsx
- Loader while loading different pages and modules — loading.tsx added to admin/{dashboard,workers,work-types,sites,cities,supervisors} and supervisor/{dashboard,workers,sites}
- CRUD in workers — Edit (admin EditWorkerDialog), Delete (admin inline confirm), View all details (WorkerDetailDialog with Approve/Reject/Edit/Delete inline)
- In adding a worker: removed joinDate and address from forms; age is required (18–45); Aadhaar is required; OT rate split into 3 tiers (2hr/4hr/6hr) in all worker forms and actions
- Phone no is unique — checked at application level across workers + employees tables in all create/submit/update/resubmit actions
- Admin view all details + directly approve or reject — WorkerDetailDialog shows all fields; Approve/Reject buttons launch sub-dialogs; table row also has direct Approve/Reject buttons for pending workers
- Add Aadhaar checksum validation — Verhoeff algorithm implemented in src/lib/aadhaar-validate.ts; applied in all worker forms (client-side) and server actions
- No need to show all details on worker page — main table now shows only Name, Category, City, Daily Wage, Status, Actions; all details accessible via "View" button opening WorkerDetailDialog