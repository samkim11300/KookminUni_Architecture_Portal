# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kookmin University Architecture College portal (국민대학교 건축대학 포털사이트). A single-page React app for managing room reservations, equipment rentals, print requests, and student inquiries. Three user roles: student, worker (근로학생), admin.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build (output in `dist/`)
- `npm run preview` — Preview production build locally

No test framework or linter is configured.

## Tech Stack

- React 18 + Vite 5, JSX (no TypeScript)
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin, no `tailwind.config.js`)
- Supabase (DB via `portal_data` table, file storage via `certificates` and `forms` buckets)
- Google Apps Script webhooks for Google Sheets sync, email notifications, and Drive file management
- Framer Motion for animations
- Path alias: `@` → `src/`

## Architecture

**No router** — navigation is state-driven via `page` state in `App.jsx` (`login | student | worker | admin | help`). Browser back/forward is handled with `history.pushState`/`popstate`.

**Data flow**: `App.jsx` is the central state owner. It loads all persistent data on mount, holds ~20 state variables (reservations, equipment rentals, print requests, workers, etc.), and passes them as props to page components. There is no Redux/Zustand/Context — everything flows through props.

**Storage is dual-write**: Data is written to both Supabase (`supabaseStore` in `src/supabase.js`) and `window.storage` (which itself writes to Supabase with localStorage fallback, defined in `src/main.jsx`). On load, Supabase is treated as the Single Source of Truth (SSOT) for certain keys (workers, roomStatus, bannerText, equipmentDB, categoryOrder, formFiles). Cross-browser sync uses polling with role-based intervals (student: 2min, worker: 1min, admin: 5min).

**Storage layers** (`src/utils/storage.js`):
- `store.get/set` — reads/writes via `window.storage` (Supabase → localStorage fallback)
- `store.localGet/localSet` — localStorage only, for device-specific data (login session)
- `supabaseStore` — direct Supabase `portal_data` table operations
- Real-time subscriptions available via `supabaseStore.subscribe` (used for inquiries)

**Key directories**:
- `src/pages/` — top-level page components per role (LoginPage, StudentPortal, WorkerPortal, AdminPortal, HelpPage)
- `src/features/` — feature modules (RoomReservation, EquipmentRental, PrintRequest, PrintManagement, StudentInquiries, etc.)
- `src/constants/data.js` — all editable configuration (rooms, equipment inventory, worker accounts, GAS URLs, API keys via env vars)
- `src/constants/theme.js` — theme tokens with dark/light mode support

## Environment Variables

All prefixed with `VITE_` (exposed to browser):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_WORKER1_PASSWORD_HASH`, `VITE_ADMIN_PASSWORD_HASH`
- `VITE_GAS_API_KEY`

## Language

UI text and comments are in Korean. Code identifiers are in English.
