# Coding guidelines — FamTree

## Stack

- **UI:** Next.js 14 (App Router), React, Tailwind
- **Data:** Cloud Firestore (not Supabase)
- **Auth:** Firebase Auth (email magic link)
- **Files:** Firebase Storage (`person-photos/...`)
- **Hosting:** Firebase App Hosting (`firebase.json`) or Vercel with Firebase env vars

## Conventions

- Keep data access in `src/lib/firebase/` (`db.ts`, `auth.ts`, `storage.ts`). Avoid Firestore calls scattered in components.
- Admin-only server work uses `src/lib/firebase/admin.ts` from `src/app/api/admin/*` only.
- Client hook: `useAppData.ts` — do not duplicate business rules in UI components.
- IDs are UUID strings; `isUuid()` in `useAppData` gates cloud loads.

## Env vars

See `.env.example`. Never commit `.env.local` or service account JSON.

## Migrations

- Postgres backup restore: `scripts/restore/restore-and-export.ps1`
- Firestore import: `npm run migrate:import`
- Details: `docs/MIGRATION.md`

## Scope

- Prefer minimal diffs; match existing naming and patterns.
- Update this file when stack or folder conventions change.
