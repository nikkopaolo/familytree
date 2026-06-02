# FamTree Cloud

Collaborative family tree web app with branch permissions, history, and an interactive tree view.

## Stack

- **Frontend:** Next.js 14
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (email link)
- **Storage:** Firebase Storage (photos)
- **Hosting:** Firebase App Hosting (see `firebase.json`) or Vercel + Firebase backend

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill Firebase web config + SUPER_ADMIN_EMAILS
npm run dev
```

Open `http://localhost:3000`.

## Restore from Supabase backup

If you have a `.backup` file from Supabase, follow **[docs/MIGRATION.md](docs/MIGRATION.md)** to restore into Firestore.

## Deploy (Firebase)

```bash
npm i -g firebase-tools
firebase login
# Set project id in .firebaserc
firebase deploy
```

Set environment variables in Firebase App Hosting (or Vercel) matching `.env.example`.

## Features

- Multi-clan support with per-clan admins
- Guest read on public clans
- Branch-based editing
- Change history
- Tree, list, stats views
- CSV / JSON import-export

## Super admin

Emails in `SUPER_ADMIN_EMAILS` are promoted to admin on all clans after sign-in (via `/api/admin/bootstrap`).
