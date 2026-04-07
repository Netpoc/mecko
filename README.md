# Mecko

**Mecko** is a progressive web app (PWA) for car owners to track mileage, get servicing reminders, log maintenance activities, and view heuristic service guidance. It includes a **Vue 3** frontend and a **Node.js** backend with **MongoDB** storage.

---

## Features

- **Accounts** — Register and sign in with email + password (JWT sessions).
- **Vehicles** — Add vehicles with make, model, year, odometer, and optional last-service metadata.
- **Mileage** — Log odometer readings with history; usage trend feeds recommendations.
- **Reminders** — After ~1 week without a new reading: weekly-style nudges; from ~week 3: morning-window nudges (browser notifications + periodic background sync where supported).
- **Service & component guidance** — Server-side heuristics from mileage delta, vehicle age, and logged last service (not a substitute for the owner’s manual or a qualified mechanic).
- **Service activity log** — Record spark plug work, OBD-II scans/fixes, tires, brake fluid, “recommended item done,” and more; stored per vehicle in MongoDB.
- **Maintenance guide** — In-app general how-to content (oil, fluids, tires, brakes, etc.).
- **Offline-friendly UI** — Service worker caches the app shell and API GETs; vehicle list and last advisory snapshot are stored in **IndexedDB** on the device (cleared on logout).
- **PWA** — Install from the browser; manifest and icons for home screen / standalone window.
- **UX** — Collapsible main nav on small screens, collapsible sections on vehicle detail, skip link, back-to-top FAB, accessible forms.

---

## Repository layout

```
mecko/
├── package.json          # Root scripts (run client + server from one place)
├── client/                 # Vue 3 + Vite PWA
│   ├── src/
│   │   ├── api/            # HTTP client
│   │   ├── components/     # AppShell, OfflineBanner, …
│   │   ├── composables/    # Mileage reminders, periodic sync registration
│   │   ├── constants/      # Service activity labels
│   │   ├── lib/            # deviceCache (IndexedDB)
│   │   ├── router/
│   │   ├── stores/         # Pinia (auth, vehicles)
│   │   ├── views/          # Login, Dashboard, Vehicles, Vehicle detail, Guide, Settings
│   │   └── sw.js           # InjectManifest service worker (Workbox)
│   ├── public/             # favicon, PWA icons (SVG)
│   └── .env.development    # VITE_API_URL (see Environment)
└── server/                 # Express 5 API
    ├── src/
    │   ├── mongo.js        # MongoDB connection
    │   ├── index.js        # App bootstrap
    │   ├── middleware/
    │   ├── routes/         # auth, vehicles (+ mileage, recommendations, service-activities)
    │   └── lib/            # recommendations engine
    ├── data/               # (legacy) SQLite location; no longer used when using MongoDB
    └── .env.example
```

---

## Prerequisites

- **Node.js** 18+ (20+ recommended).
- **npm** (uses `package.json` `overrides` for Vite 8 + `vite-plugin-pwa`).

---

## Quick start

1. **Clone** the repo and install dependencies. The repo root includes a `package.json` so running commands from **`mecko/`** avoids npm picking up a `package.json` in your home directory.

   ```bash
   cd mecko
   npm install --prefix ./server
   npm install --prefix ./client
   ```

   (Optional: `npm install` at the root if you want a root lockfile; the root package has no runtime dependencies.)

2. **Configure the API** — copy env and set a strong secret:

   ```bash
   cp server/.env.example server/.env
   # Edit server/.env: JWT_SECRET, PORT (default 3001), CLIENT_ORIGIN (default http://localhost:5173)
   ```

3. **Configure the client** (development) — ensure the API URL matches the server:

   ```bash
   # client/.env.development (already present in repo)
   VITE_API_URL=http://localhost:3001
   ```

4. **Run both apps** (from repo root):

   ```bash
   npm run dev
   ```

   This starts the API (port **3001**) and Vite (port **5173**) in the background. Alternatively run two terminals:

   ```bash
   npm run dev:server
   npm run dev:client
   ```

5. Open **http://localhost:5173**, register an account, add a vehicle, and use the app.

After updating the server, restart the API once so it reconnects cleanly to MongoDB.

---

## npm scripts

| Location | Command | Purpose |
|----------|---------|---------|
| **Root** | `npm run dev` | Start server + client (background `&` on Unix) |
| **Root** | `npm run dev:server` | API only (`nodemon`) |
| **Root** | `npm run dev:client` | Vite dev server |
| **Root** | `npm run build:client` | Production build of the PWA into `client/dist` |
| **Root** | `npm run start:server` | Run API with `node` (use after `server/.env` is set) |
| **client/** | `npm run dev` / `build` / `preview` | Standard Vite workflow |
| **server/** | `npm run dev` / `npm start` | API with reload / plain node |

---

## Environment variables

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3001`) |
| `JWT_SECRET` | Secret for signing JWTs (**required** in production; use a long random string) |
| `CLIENT_ORIGIN` | CORS origin for the browser app (e.g. `http://localhost:5173`) |
| `MONGODB_URI` | **Required**; MongoDB Atlas connection string |

### Client

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL of the API **without** trailing slash (e.g. `http://localhost:3001`). Used at **build time** for the service worker’s API cache; set correctly before `npm run build` for production. |

---

## API overview

Base URL: `{VITE_API_URL}` (e.g. `http://localhost:3001`).

- **Health** — `GET /api/health`
- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`
- **User** — `GET /api/me` (Bearer token)
- **Vehicles** — `GET/POST /api/vehicles`, `GET/PATCH/DELETE /api/vehicles/:id`
- **Mileage** — `GET/POST /api/vehicles/:id/mileage`
- **Recommendations** — `GET /api/vehicles/:id/recommendations`
- **Service activities** — `GET/POST /api/vehicles/:id/service-activities`, `DELETE /api/vehicles/:id/service-activities/:activityId`

Send `Authorization: Bearer <token>` on protected routes.

---

## Production build

1. Set `VITE_API_URL` to your public API URL and build the client:

   ```bash
   cd client
   VITE_API_URL=https://api.example.com npm run build
   ```

2. Serve **`client/dist`** over **HTTPS** (recommended for PWA install, notifications, and secure cookies if you add them later).

3. Run the API with `NODE_ENV=production`, a real `JWT_SECRET`, and `CLIENT_ORIGIN` set to your frontend origin.

4. **Important (deployments):** if you deploy on a platform with **ephemeral disk**, do not use file-based databases for persistence. MongoDB Atlas will persist across redeploys/restarts.

---

## PWA, offline behavior, and notifications

- **Install** — Use the browser’s install / “Add to Home Screen” flow; icons come from `client/public/`.
- **Caching** — Workbox precaches the app shell; API GETs use a network-first strategy with a short timeout so recent data can be shown offline.
- **Device cache** — Vehicle list and the last advisory snapshot per vehicle are written to IndexedDB (plain JSON clones, not Vue proxies). **Logout clears** that data on the device.
- **Notifications** — Optional; Settings explains behavior. **Periodic Background Sync** for mileage checks is limited to supporting browsers (often Chromium) and usually requires an installed PWA. Foreground reminders still run while the tab is open.

---

## Client dependency notes

- **Vite 8** and **vite-plugin-pwa** declare overlapping peer ranges; this repo uses **`overrides`** in `client/package.json` so `vite-plugin-pwa` uses the project’s Vite version, and pins **`serialize-javascript@7.0.5`** for a clean `npm audit` where applicable.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `npm i` at repo root touches `~/node_modules` or EACCES | Always run `npm install` from **`mecko/`** (root has its own `package.json`). Fix home `node_modules` permissions if you previously used `sudo npm`. |
| `404` on `/api/vehicles/.../service-activities` | Restart the API after schema updates; confirm `VITE_API_URL` points at the same host/port as the running server. |
| `DataCloneError` in IndexedDB | Fixed in current `deviceCache` by cloning with `JSON.parse(JSON.stringify(...))` before `idb-keyval` writes. Hard-refresh after updates. |
| CORS errors | Align `CLIENT_ORIGIN` on the server with the exact origin of the Vite dev server or production URL (scheme + host + port). |

---

## License

ISC (see `server/package.json`). Add or adjust a top-level license file if you redistribute the project.

---

## Disclaimer

Maintenance recommendations and the in-app guide are **general information only**. Always follow your vehicle manufacturer’s documentation and a qualified professional for service and safety decisions.
