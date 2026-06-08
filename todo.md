TO-DO:
while editig the supervisor, it should load the original data as well in the edit form
in the wotk type, no need to show created at, instead we can show how many sites are associated to that work type.


DONE:
- CRUD in work type — Edit (rename) and Delete (blocked if in use) added to WorkTypesClient.tsx
- Loader while loading different pages and modules — loading.tsx added to admin/{dashboard,workers,work-types,sites,cities,supervisors} and supervisor/{dashboard,workers,sites}
- CRUD in workers — Edit (admin EditWorkerDialog), Delete (admin inline confirm), View all details (WorkerDetailDialog with Approve/Reject/Edit/Delete inline)
- In adding a worker: removed joinDate and address from forms; age is required (18–45); Aadhaar is required; OT rate split into 3 tiers (2hr/4hr/6hr) in all worker forms and actions
- Phone no is unique — checked at application level across workers + employees tables in all create/submit/update/resubmit actions
- Admin view all details + directly approve or reject — WorkerDetailDialog shows all fields; Approve/Reject buttons launch sub-dialogs; table row also has direct Approve/Reject buttons for pending workers
- Add Aadhaar checksum validation — Verhoeff algorithm implemented in src/lib/aadhaar-validate.ts; applied in all worker forms (client-side) and server actions
- No need to show all details on worker page — main table now shows only Name, Category, City, Daily Wage, Status, Actions; all details accessible via "View" button opening WorkerDetailDialog