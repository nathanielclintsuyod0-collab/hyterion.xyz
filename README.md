# Seraphyx Finance

## Files
- `index.html` — website structure and styling
- `script.js` — dashboard logic, localStorage bookkeeping, admin demo login, reports, CSV/JSON backup, and optional Discord webhook notifications

## Run
Keep `index.html` and `script.js` in the same folder, then open `index.html` in a modern browser.

To change the demo admin password, edit `ADMIN_PASSWORD` near the top of `script.js`.

## Security warning
This is a client-side prototype. The password is visible in JavaScript source and localStorage data is not protected. Do not use this as production security for a public finance site; use server-side authentication, authorization, and a protected database.
