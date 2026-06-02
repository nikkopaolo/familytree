# Deploy on Google Cloud Shell

Cloud Shell ships with **Node 14** by default. This app needs **Node 18+** (use Node 20).

## One-time setup

```bash
cd ~
git clone https://github.com/nikkopaolo/familytree.git
cd familytree
git pull origin main
```

Create `.env.local` (same values as on your PC):

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=familytree-70db5.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=familytree-70db5
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=familytree-70db5.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_SITE_URL=https://familytree-70db5.web.app
SUPER_ADMIN_EMAILS=katigbaknikkopaolo@gmail.com
EOF
```

## Deploy (recommended)

```bash
bash scripts/cloudshell-deploy.sh
```

## Manual steps (if script fails)

```bash
nvm install 20
nvm use 20
node -v   # must show v20.x

firebase login
firebase use familytree-70db5
firebase experiments:enable webframeworks
npm ci
firebase deploy --only hosting --project familytree-70db5
```

## URLs

| What | URL |
|------|-----|
| App (after deploy) | https://familytree-70db5.web.app |
| Firestore data | https://console.firebase.google.com/project/familytree-70db5/firestore/databases/-default-/data |

## Errors

| Error | Fix |
|-------|-----|
| `could not locate firebase.json` | `cd ~/familytree` first |
| `EBADENGINE` / Node 14 | `nvm use 20` |
| `Failed to list functions` | Run deploy script (enables APIs) or upgrade Node |
