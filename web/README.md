# Web — Continue with Configure

A minimal Express app: a **“Continue with Configure”** button, a hosted sign-in, and the user’s profile back — in one file ([`server.ts`](./server.ts)).

## Run it

```bash
cp .env.example .env     # add your keys
npm install
npm run dev              # → http://localhost:4000
```

Open http://localhost:4000, click **Continue with Configure**, sign in, and you’ll land on a page showing the profile your server just read.

## The flow (what `server.ts` does)

1. **`GET /login`** → `configure.auth.signInUrl({ publishableKey, returnTo })` builds the hosted link and redirects the user to it.
2. The user verifies their phone and consents **on Configure’s page**, then gets redirected back to **`GET /callback?code=…`**.
3. **`GET /callback`** → `configure.auth.exchangeSignInCode(code)` trades the one-time code for a token, then `configure.profile({ token }).read()` returns the profile.

The secret key (`sk_`) is used only in steps 1 and 3 — always on the server. The browser only ever sees the publishable key and a one-time code.
