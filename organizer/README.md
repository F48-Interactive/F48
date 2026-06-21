# F48 Organizer Website

React + Vite frontend for organizer onboarding and tournament management.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill the Firebase web app values from Firebase Console.
3. Set `VITE_API_URL` to the backend API prefix, for example:

```text
VITE_API_URL=http://localhost:3000/api/v1
```

4. Start the app:

```bash
npm run dev
```

## Required Backend Environment

The backend must allow the organizer origin in `CORS_ORIGINS`.

For local Vite development:

```text
CORS_ORIGINS=http://localhost:3001,http://localhost:5173
```

For production, add the deployed organizer website origin too.

## Scripts

```bash
npm run build
npm run lint
npm run preview
```

## Railway Deployment

Create a new Railway service from this repo and set the service root directory
to `organizer`.

Use Docker as the builder. The included `Dockerfile` builds the Vite app and
serves `dist/` with nginx using Railway's `$PORT`.

Required organizer service variables:

```text
VITE_API_URL=https://your-backend-domain.up.railway.app/api/v1
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=f48-int.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=f48-int
VITE_FIREBASE_STORAGE_BUCKET=f48-int.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=918066351105
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

After Railway gives the organizer domain, add it to:

- Backend `CORS_ORIGINS`
- Firebase Authentication authorized domains

## Current Product Flow

Google sign-in -> backend session cookie -> organizer profile -> YouTube channel -> dashboard -> create tournament draft -> configure/publish from workspace.
