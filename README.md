# HydraIQ (MVP)

HydraIQ is a hydration tracking web app built with Next.js that’s designed to be fast, mobile-friendly, and PWA-ready. The MVP focuses on an easy daily logging flow, a consistent “selected date” experience across the app, and (optionally) Supabase authentication.

## Tech Stack
- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS**
- **PWA** (manifest + service worker registration)
- **Supabase** (optional auth)
- Vercel deployment

---

## Core UX
- **Top date bar**: navigate days (Prev/Next) with a persistent selected date.
- **Mobile-first layout**: top bar + bottom nav.
- **PWA support**: installable on mobile; supports offline caching depending on SW config.

---

## Project Structure (high level)
- `app/`
  - `layout.tsx` – global layout, PWA meta/manifest, TopBar/BottomNav wiring
  - `auth/login/page.tsx` – Supabase login (optional)
- `components/`
  - `TopBarClient.tsx` – date navigation + display
  - `TopBar.tsx`, `BottomNav.tsx`
  - `RegisterSW.tsx` – service worker registration
  - `StartupMigration.tsx` – startup/local migrations (if used)
- `lib/`
  - `selectedDate.ts` – selected ISO date state helpers (used by TopBarClient)
  - `supabaseClient.ts` – Supabase browser client factory

---

## Getting Started

### 1) Install
```bash
npm install
```

### 2) Run locally
```bash
npm run dev
```
App will be at `http://localhost:3000`.

### Environment Variables (if using Supabase)
Create `.env.local`:
```ini
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```
If you aren’t using auth yet, you can keep the login route unused.

---

## PWA Notes
HydraIQ includes:
- a web app manifest (`/public/manifest.json`)
- service worker registration via `components/RegisterSW`

If you change SW behavior, remember:
- SW updates can be “sticky” on devices. Test in an incognito profile or clear site data on mobile when debugging.

---

## Deployment (Vercel)
1) Push to GitHub  
2) Import repo in Vercel  
3) Add env vars (if using Supabase)  
4) Deploy

---

## Roadmap (suggested next steps)
- Hydration logging model (water/electrolytes/other beverages) + daily targets
- Insights view (streaks, adherence, trends)
- WHOOP integration (OAuth + daily recovery/strain context)
- Data storage strategy:
  - Local-first (IndexedDB/localStorage) + optional cloud sync
  - Decide if sign-in is required or optional
- App Store path:
  - wrap as PWA-first or package via native shell (depending on your plan)
- WHOOP developer portal approval beyond limited testers

