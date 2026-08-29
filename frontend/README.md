# VendorIQ Frontend (React + Vite)

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

App runs at http://localhost:5173 — matches the CORS origin already set in the FastAPI backend.

## What's included so far
- Login / Register pages, wired to `backend`'s `/auth/register` and `/auth/login`
- Auth context (`AuthContext`) — holds current user, exposes `login()` / `logout()`
- `ProtectedRoute` — guards pages behind login, optionally restricts by role
- Basic navbar + layout shell
- Dashboard and Vendors pages (placeholders — build these out next)

## Folder structure
```
src/
├── api/            # axios calls to backend, one file per module
├── context/         # React context (auth, later others)
├── routes/          # route guards
├── components/
│   ├── common/       # shared small components (buttons, inputs — add as needed)
│   └── layout/        # navbar, layout shell
└── pages/
    ├── auth/          # login, register
    ├── dashboard/
    └── vendors/
```

## Next steps
- Build out `vendors`, `procurement`, `performance`, `reliability`, `contracts`,
  `notifications`, `reports` pages — same pattern: add `src/api/<module>Api.js`,
  then a page in `src/pages/<module>/`
- Wire real data into the Dashboard once backend endpoints for those modules exist
