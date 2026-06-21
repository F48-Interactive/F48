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

## Current Product Flow

Google sign-in -> backend session cookie -> organizer profile -> YouTube channel -> dashboard -> create tournament draft -> configure/publish from workspace.
