# FamTree Cloud

FamTree Cloud is a collaborative family tree web app with branch-based permissions, guest suggestions, full diff history, and a smooth interactive tree view. The UI also includes list and stats dashboards, plus CSV/JSON import-export.

## Features
- Multi-clan support with per-clan admins
- Guest suggestions that require approval
- Branch-based editing for non-admin family members
- Full diff history and audit trail
- Interactive tree with drag-and-drop positioning
- List and analytics views
- CSV and JSON import-export

## Quick Start
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## Supabase Setup (Free Tier)
1) Create a Supabase project (free tier).
2) Run the SQL in `supabase/schema.sql` in the SQL Editor.
3) Run the SQL in `supabase/storage.sql` to create the photo bucket.
4) Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPER_ADMIN_EMAILS=katigbaknikkopaolo@gmail.com
NEXT_PUBLIC_SITE_URL=https://familytree-4x64.vercel.app
```

If env vars are missing, the app falls back to mock data for UI review.

## Deploy (Free Link)
1) Push the repo to GitHub.
2) Import it in Vercel (free tier).
3) Add the same env vars in Vercel → Project Settings → Environment Variables.
4) Deploy to get a public `vercel.app` link.

## Permissions Model
- Admins can edit all members and approve any suggestion inside their clan.
- Branch owners can edit members in their assigned branch (based on `branch_root_id`).
- Guests can only submit suggestions and cannot approve.
- Clans can be public (`is_public = true`) for guest read access.

## Admin Bootstrap
When a signed-in user's email matches `SUPER_ADMIN_EMAILS`, the app auto-assigns admin membership for all clans using the server-side service role key.

## Import / Export
- CSV: exports and imports a flat list of people (no relationships).
- JSON: exports and imports full tree (people + relationships).

## Next Steps
- Wire Supabase client calls in `src/lib/useAppData.ts`
- Add auth (Supabase Auth or Firebase Auth)
- Add invite flow for branch owners
- Add image uploads per person
