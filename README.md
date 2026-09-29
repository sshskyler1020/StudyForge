# StudyForge AI — Gemini + Firebase

GitHub Pages frontend + Firebase accounts/Firestore + Cloudflare Worker + Gemini.

## Included
- Email/password account creation and sign-in
- Google Sign-In
- Firestore-synced XP, levels, achievements, quiz totals, and study history
- Per-user Firestore security rules
- Firebase ID token sent to the Worker before Gemini can be used
- YouTube URL or TXT/MD/CSV/JSON/PDF input
- Gemini 1.5-paragraph summary + 10-question quiz

## 1. Firebase setup
1. Create a Firebase project and add a **Web App**.
2. Authentication → Sign-in method: enable **Email/Password** and **Google**.
3. Authentication → Settings → Authorized domains: add your GitHub Pages host, e.g. `YOURNAME.github.io`.
4. Firestore Database → create a database.
5. Paste the Web App `firebaseConfig` values into `app.js`.
6. Firestore → Rules: replace the rules with `firestore.rules` from this repo, then publish them.

Firebase's browser config is not a secret. Do not put Gemini or other private server keys in the frontend.

## 2. Cloudflare Worker
```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put FIREBASE_PROJECT_ID
npm run deploy
```
For `FIREBASE_PROJECT_ID`, enter the same Firebase project ID used by `firebaseConfig.projectId`.

Copy your deployed Worker URL and change `API_URL` in `app.js` to `https://YOUR-WORKER.workers.dev/api/study`.

## 3. GitHub Pages
Push the project to GitHub. Settings → Pages → Deploy from branch → `main` → `/ (root)`.

## Firestore layout
```
users/{uid}
  displayName, email, xp, sets, quizzes, perfect, createdAt, updatedAt
users/{uid}/studySessions/{sessionId}
  title, sourceType, sourceURL, summary, score, totalQuestions, percent, createdAt
```

## Security
Firestore rules only let an authenticated user access their own profile/subcollections. The Worker requires a Firebase ID token before accepting a Gemini request. The Gemini key remains a Cloudflare secret.
