# Restore Supabase backup → Firebase

## 1. Place your backup

Copy `db_cluster-26-01-2026@14-56-15.backup` into:

```
scripts/backups/
```

## 2. Restore to local Postgres and export JSON

Requires **Docker Desktop**.

```powershell
cd D:\GitHub\familytree
.\scripts\restore\restore-and-export.ps1
```

Output: `scripts/migrate/output/famtree-export.json`

## 3. Create Firebase project

1. [Firebase Console](https://console.firebase.google.com/) → Create project.
2. Enable **Firestore** (production mode), **Authentication** (Email link), **Storage**.
3. Project settings → Service accounts → **Generate new private key** → save as `firebase-service-account.json` (do not commit).
4. Project settings → Your apps → Web app → copy config into `.env.local`.

## 4. Import data into Firestore

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "D:\path\to\firebase-service-account.json"
npm run migrate:import
```

## 5. Deploy rules and hosting

```powershell
npm i -g firebase-tools
firebase login
# Edit .firebaserc → set your project id
firebase deploy --only firestore:rules,storage
```

For the Next.js app:

```powershell
# Set env vars in Firebase App Hosting or use firebase deploy with frameworks
firebase deploy
```

Or keep using **Vercel** for the frontend only (set the same `NEXT_PUBLIC_FIREBASE_*` env vars there).

## 6. Auth setup

Firebase Console → Authentication → Sign-in method → **Email link** enabled.

Authorized domains: `localhost`, your `*.web.app`, and custom domain.

## 7. Verify

- Open the site → tree should show restored members.
- Sign in with `SUPER_ADMIN_EMAILS` → admin bootstrap runs automatically.

## Push to GitHub

```powershell
git add .
git commit -m "Migrate from Supabase to Firebase"
git push origin main
```
